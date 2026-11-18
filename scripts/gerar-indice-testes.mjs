#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// gerar-indice-testes.mjs — índice regra → teste (H3-L item 3, PLANO-HARDENING-3.md)
//
// Node puro, sem dependência: varre src/lib/*.test.js e src/components/*.test.jsx
// (se houver), extrai os nomes de describe()/it()/test() do TEXTO-FONTE dos
// testes (não executa nada) e gera EVIDENCIA-TESTES.md — índice navegável,
// agrupado por módulo, com contagem por arquivo e total.
//
// Como rodar:
//     node scripts/gerar-indice-testes.mjs
//
// scripts/auditoria.sh chama este script e falha (vermelho) se o
// EVIDENCIA-TESTES.md já commitado ficar desatualizado
// (git diff --exit-code EVIDENCIA-TESTES.md). Por isso a saída do .md é
// DETERMINÍSTICA: nada de data/hora — só o que dá para derivar do
// texto-fonte dos testes no momento em que o script roda.
//
// O que este script NÃO faz: não executa a suíte, não decide se um teste
// passa, não altera nenhum arquivo de teste ou de cálculo — só lê e relata.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const SAIDA = path.join(RAIZ, 'EVIDENCIA-TESTES.md')

const DIRETORIOS = [
  { rotulo: 'src/lib', caminho: path.join(RAIZ, 'src/lib'), sufixos: ['.test.js'] },
  { rotulo: 'src/components', caminho: path.join(RAIZ, 'src/components'), sufixos: ['.test.jsx', '.test.js'] },
]

// ───────────────────────────── utilidades de linha ─────────────────────────

function indiceDeLinhas(texto) {
  const offs = [0]
  for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') offs.push(i + 1)
  return offs
}

function linhaNoOffset(offs, pos) {
  let lo = 0
  let hi = offs.length - 1
  let r = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offs[mid] <= pos) {
      r = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return r + 1
}

// ───────────────────────── scanner de describe/it/test ─────────────────────
//
// Não é um parser de JS completo — é um varredor de texto que sabe pular
// strings ('..', "..", `..`) e comentários (// e /* */) para não confundir
// texto comentado ou nomes de teste com chamadas reais. Suficiente para o
// estilo real deste projeto (confirmado por amostragem): describe()/it() com
// nome sempre na mesma chamada, no máximo 1 nível de describe aninhado
// (describe(variável) dentro de um describe(string) que faz for-loop).

function lerString(texto, pos) {
  const aspas = texto[pos]
  const n = texto.length
  let j = pos + 1
  let conteudo = ''
  while (j < n && texto[j] !== aspas) {
    if (texto[j] === '\\' && j + 1 < n) {
      conteudo += texto[j] + texto[j + 1]
      j += 2
      continue
    }
    conteudo += texto[j]
    j++
  }
  return { conteudo, fim: Math.min(j + 1, n) }
}

function pularEspacos(texto, pos) {
  const n = texto.length
  while (pos < n && /\s/.test(texto[pos])) pos++
  return pos
}

// pos aponta para o '(' de abertura; devolve o índice logo após o ')' que fecha,
// respeitando parênteses aninhados, strings e comentários dentro do grupo.
function pularParenteses(texto, pos) {
  const n = texto.length
  let profundidade = 0
  let j = pos
  while (j < n) {
    const c = texto[j]
    if (c === '(') {
      profundidade++
      j++
      continue
    }
    if (c === ')') {
      profundidade--
      j++
      if (profundidade === 0) return j
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      j = lerString(texto, j).fim
      continue
    }
    if (c === '/' && texto[j + 1] === '/') {
      while (j < n && texto[j] !== '\n') j++
      continue
    }
    if (c === '/' && texto[j + 1] === '*') {
      j += 2
      while (j < n && !(texto[j] === '*' && texto[j + 1] === '/')) j++
      j += 2
      continue
    }
    j++
  }
  return j
}

// Varre o texto de um arquivo de teste e devolve a lista de chamadas
// describe()/it()/test() encontradas em ordem de aparição no arquivo.
function extrairChamadas(texto) {
  const achados = []
  const offs = indiceDeLinhas(texto)
  const n = texto.length
  let i = 0

  while (i < n) {
    const c = texto[i]

    if (c === "'" || c === '"' || c === '`') {
      i = lerString(texto, i).fim
      continue
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < n && texto[i] !== '\n') i++
      continue
    }
    if (c === '/' && texto[i + 1] === '*') {
      i += 2
      while (i < n && !(texto[i] === '*' && texto[i + 1] === '/')) i++
      i += 2
      continue
    }

    const precedidoPorPalavra = i > 0 && /[\w$]/.test(texto[i - 1])
    if (!precedidoPorPalavra) {
      const m = /^(describe|it|test)\b/.exec(texto.slice(i, i + 20))
      if (m) {
        const linha = linhaNoOffset(offs, i)
        let j = i + m[1].length
        let modificador = null

        if (texto.slice(j, j + 5) === '.skip') {
          modificador = 'skip'
          j += 5
        } else if (texto.slice(j, j + 5) === '.only') {
          modificador = 'only'
          j += 5
        } else if (texto.slice(j, j + 5) === '.each') {
          modificador = 'each'
          j += 5
          j = pularEspacos(texto, j)
          if (texto[j] === '(') j = pularParenteses(texto, j)
        }

        j = pularEspacos(texto, j)
        if (texto[j] === '(') {
          j = pularEspacos(texto, j + 1)
          let nome = null
          let dinamico = false
          if (texto[j] === "'" || texto[j] === '"' || texto[j] === '`') {
            const r = lerString(texto, j)
            nome = r.conteudo
            j = r.fim
          } else {
            const idm = /^[A-Za-z_$][\w$]*/.exec(texto.slice(j, j + 200))
            if (idm) {
              nome = idm[0]
              dinamico = true
              j += idm[0].length
            }
          }
          if (nome !== null) {
            achados.push({ tipo: m[1], nome, dinamico, modificador, linha })
            i = j
            continue
          }
        }
        // não deu para extrair um nome (ex.: chamada exótica) — não trava,
        // só não conta como achado. Avança além da palavra-chave.
        i += m[1].length
        continue
      }
    }
    i++
  }
  return achados
}

// Agrupa a sequência linear de chamadas: cada describe abre um grupo nomeado;
// cada it/test entra no describe mais recente já visto (raiz se nenhum ainda).
// Suficiente para a estrutura real do projeto (ver comentário acima).
function agruparPorDescribe(achados) {
  const grupos = []
  let atual = null
  for (const a of achados) {
    if (a.tipo === 'describe') {
      atual = { nome: a.nome, dinamico: a.dinamico, modificador: a.modificador, linha: a.linha, its: [] }
      grupos.push(atual)
    } else {
      if (!atual) {
        atual = { nome: '(fora de qualquer describe)', dinamico: false, modificador: null, linha: a.linha, its: [] }
        grupos.push(atual)
      }
      atual.its.push({ nome: a.nome, dinamico: a.dinamico, modificador: a.modificador, linha: a.linha, tipo: a.tipo })
    }
  }
  return grupos
}

function contarPulados(grupo) {
  if (grupo.modificador === 'skip') return grupo.its.length
  return grupo.its.filter((it) => it.modificador === 'skip').length
}

// ───────────────────────────── coleta por diretório ─────────────────────────

function listarArquivos(caminho, sufixos) {
  if (!existsSync(caminho)) return []
  return readdirSync(caminho)
    .filter((f) => sufixos.some((s) => f.endsWith(s)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

const relatorio = []
let totalArquivos = 0
let totalDescribes = 0
let totalIts = 0
let totalPulados = 0

for (const dir of DIRETORIOS) {
  const arquivos = listarArquivos(dir.caminho, dir.sufixos)
  const arquivosInfo = []
  for (const nomeArquivo of arquivos) {
    const caminhoCompleto = path.join(dir.caminho, nomeArquivo)
    let texto
    try {
      texto = readFileSync(caminhoCompleto, 'utf8')
    } catch (e) {
      console.error(`AVISO: não consegui ler ${dir.rotulo}/${nomeArquivo}: ${e.message}`)
      continue
    }
    const achados = extrairChamadas(texto)
    const grupos = agruparPorDescribe(achados)
    const nDescribes = grupos.length
    const nIts = grupos.reduce((acc, g) => acc + g.its.length, 0)
    const nPulados = grupos.reduce((acc, g) => acc + contarPulados(g), 0)
    arquivosInfo.push({ nomeArquivo, grupos, nDescribes, nIts, nPulados })
    totalArquivos++
    totalDescribes += nDescribes
    totalIts += nIts
    totalPulados += nPulados
  }
  relatorio.push({ rotulo: dir.rotulo, arquivosInfo })
}

// ───────────────────────────── renderização em Markdown ─────────────────────

function slug(texto) {
  return texto
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function escaparTexto(s) {
  // Bullets em Markdown simples — só neutraliza o que quebraria a lista
  // (marcador de lista/heading no início da linha).
  return s.replace(/\n+/g, ' ⏎ ').replace(/^[-*#]\s*/, '​$&')
}

const linhas = []

linhas.push('# EVIDÊNCIA DE TESTES — índice regra → teste (gerado)')
linhas.push('')
linhas.push('> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/gerar-indice-testes.mjs`,')
linhas.push('> que varre `src/lib/*.test.js` e `src/components/*.test.jsx` (se houver) e extrai os')
linhas.push('> nomes de `describe`/`it`/`test` do texto-fonte dos testes — sem executar nada.')
linhas.push('>')
linhas.push('> **Como regenerar** (depois de mudar testes):')
linhas.push('>')
linhas.push('>     node scripts/gerar-indice-testes.mjs')
linhas.push('>')
linhas.push('> Regenere e commite o resultado junto da mudança. `scripts/auditoria.sh` roda essa')
linhas.push('> checagem (`git diff --exit-code EVIDENCIA-TESTES.md`) e falha se o arquivo commitado')
linhas.push('> ficar desatualizado — por isso esta saída nunca leva data/hora de geração, só o que')
linhas.push('> dá para derivar do texto-fonte dos testes.')
linhas.push('>')
linhas.push('> **`(SKIP)`** marca `describe.skip`/`it.skip`: especificação PROPOSTA, aguardando aval')
linhas.push('> datado do Marco (princípios 1 e 8 do CLAUDE.md) — não conta como cobertura ativa, mas')
linhas.push('> aparece listada (nada fica de fora em silêncio, princípio 4). **`(ONLY)`** marcaria')
linhas.push('> `it.only`/`describe.only` esquecido — se aparecer aqui, é bug de CI (só esse teste')
linhas.push('> rodaria). **`(EACH)`** roda 1× por linha da tabela de casos em tempo de execução; o')
linhas.push('> índice mostra a ocorrência única no código-fonte, não a multiplicação em runtime.')
linhas.push('')
linhas.push('## Resumo')
linhas.push('')
linhas.push('| Diretório | Arquivos | describe | it/test | dos quais SKIP |')
linhas.push('|---|---:|---:|---:|---:|')
for (const dir of relatorio) {
  const nArq = dir.arquivosInfo.length
  const nDesc = dir.arquivosInfo.reduce((a, f) => a + f.nDescribes, 0)
  const nIts = dir.arquivosInfo.reduce((a, f) => a + f.nIts, 0)
  const nPul = dir.arquivosInfo.reduce((a, f) => a + f.nPulados, 0)
  linhas.push(`| ${dir.rotulo} | ${nArq} | ${nDesc} | ${nIts} | ${nPul} |`)
}
linhas.push(`| **Total** | **${totalArquivos}** | **${totalDescribes}** | **${totalIts}** | **${totalPulados}** |`)
linhas.push('')

linhas.push('## Índice por arquivo')
linhas.push('')
for (const dir of relatorio) {
  if (dir.arquivosInfo.length === 0) {
    linhas.push(`- **${dir.rotulo}** — nenhum arquivo de teste encontrado`)
    continue
  }
  linhas.push(`- **[${dir.rotulo}](#${slug(dir.rotulo)})**`)
  for (const f of dir.arquivosInfo) {
    const pulTag = f.nPulados > 0 ? ` · ${f.nPulados} skip` : ''
    linhas.push(`  - [${f.nomeArquivo}](#${slug(f.nomeArquivo)}) — ${f.nDescribes} describe · ${f.nIts} it/test${pulTag}`)
  }
}
linhas.push('')

for (const dir of relatorio) {
  linhas.push(`## ${dir.rotulo}`)
  linhas.push('')
  if (dir.arquivosInfo.length === 0) {
    linhas.push('_Nenhum arquivo de teste encontrado neste diretório._')
    linhas.push('')
    continue
  }
  for (const f of dir.arquivosInfo) {
    linhas.push(`### ${f.nomeArquivo}`)
    linhas.push('')
    const pulTag = f.nPulados > 0 ? ` · ${f.nPulados} skip` : ''
    linhas.push(`*${f.nDescribes} describe · ${f.nIts} it/test${pulTag}*`)
    linhas.push('')
    if (f.grupos.length === 0) {
      linhas.push('_(nenhum describe/it reconhecido — confira o arquivo à mão)_')
      linhas.push('')
    }
    for (const g of f.grupos) {
      const nomeG = g.dinamico
        ? `(dinâmico: \`${escaparTexto(g.nome)}\` — variável, valor muda por caso; ver código-fonte, linha ${g.linha})`
        : escaparTexto(g.nome)
      const skipG = g.modificador === 'skip' ? ' **(SKIP)**' : g.modificador === 'only' ? ' **(ONLY)**' : ''
      linhas.push(`- **${nomeG}**${skipG} — linha ${g.linha}`)
      for (const it of g.its) {
        const nomeIt = it.dinamico
          ? `(dinâmico: \`${escaparTexto(it.nome)}\` — variável, valor muda por caso; ver código-fonte, linha ${it.linha})`
          : escaparTexto(it.nome)
        const tag =
          it.modificador === 'skip'
            ? ' **(SKIP)**'
            : it.modificador === 'only'
              ? ' **(ONLY)**'
              : it.modificador === 'each'
                ? ' *(each)*'
                : ''
        linhas.push(`  - ${nomeIt}${tag} — linha ${it.linha}`)
      }
    }
    linhas.push('')
  }
}

writeFileSync(SAIDA, linhas.join('\n') + '\n', 'utf8')

console.log('Índice de testes gerado em EVIDENCIA-TESTES.md')
for (const dir of relatorio) {
  const nArq = dir.arquivosInfo.length
  const nDesc = dir.arquivosInfo.reduce((a, f) => a + f.nDescribes, 0)
  const nIts = dir.arquivosInfo.reduce((a, f) => a + f.nIts, 0)
  const nPul = dir.arquivosInfo.reduce((a, f) => a + f.nPulados, 0)
  console.log(`  ${dir.rotulo}: ${nArq} arquivos · ${nDesc} describe · ${nIts} it/test (${nPul} skip)`)
}
console.log(`  TOTAL: ${totalArquivos} arquivos · ${totalDescribes} describe · ${totalIts} it/test (${totalPulados} skip)`)
