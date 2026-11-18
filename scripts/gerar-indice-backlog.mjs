#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// gerar-indice-backlog.mjs — o índice do BACKLOG.md, gerado do próprio arquivo
//
// Por que existe: até 25/07/2026 ninguém conseguia contar o BACKLOG duas vezes e
// chegar no mesmo número (o handoff de 24/07 falou em "73 itens"; a contagem por
// item atômico dava ~137). O Marco decidiu a convenção única em 24/07/2026
// (DECISOES-MARCO-H4.md, item 4) e este script passou a ser quem CONTA — a
// contagem deixa de ser opinião de quem leu e vira medição do arquivo.
//
// Como rodar (da raiz do repo, ou de qualquer lugar — o script se localiza):
//     node scripts/gerar-indice-backlog.mjs
//
// O que ele faz: lê o BACKLOG.md, conta os itens por SEVERIDADE (S1..S4) e por
// ESTADO (aberto · resolvido · decisão · movido), e reescreve o bloco entre as
// duas marcas no topo do próprio arquivo. Não muda mais nada: só o miolo entre
// as marcas é substituído, byte a byte.
//
// DETERMINISMO (é requisito, não detalhe): não imprime data, hora, versão nem
// nada derivado do relógio ou do ambiente. Rodar duas vezes seguidas produz o
// mesmo arquivo — é isso que permite ao CI usar `git diff --exit-code` para
// recusar um índice desatualizado, como já faz com o EVIDENCIA-TESTES.md.
// Por isso, também, a leitura IGNORA o que está entre as marcas: o índice nunca
// se conta a si mesmo.
//
// Sem dependência nova: só node:fs/path/url.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO = join(RAIZ, 'BACKLOG.md')

const MARCA_INICIO = '<!-- INDICE-BACKLOG:INICIO — gerado por scripts/gerar-indice-backlog.mjs, não edite à mão -->'
const MARCA_FIM = '<!-- INDICE-BACKLOG:FIM -->'

// ── A convenção que o Marco decidiu em 24/07/2026 ────────────────────────────
// Item fechado: `[x] RESOLVIDO (data, commit) — Título`
// Item aberto:  `[ ] Sxx — Título`
// Duas etiquetas acrescentam ESTADO sem sair da convenção (o item segue `[ ]`
// com severidade, e a etiqueta diz por que ele não é simplesmente "aberto"):
//   [DECISÃO DO MARCO]        — está aberto porque espera resposta dele
//   [MOVER PARA O FINANCEIRO] — está aberto e nasceu no repositório errado
// Cabeçalho SEM marca não é item: é seção, ou registro permanente de política
// (decisão datada, risco aceito). Esses são contados à parte, para que "não pôr
// marca" nunca vire um jeito silencioso de sumir com um achado.
const ETIQUETA_DECISAO = '[DECISÃO DO MARCO]'
const ETIQUETA_MOVER = '[MOVER PARA O FINANCEIRO]'

const ESTADOS = ['aberto', 'decisão', 'movido', 'resolvido']
const SEVERIDADES = ['S1', 'S2', 'S3', 'S4', '—']

function morrer(mensagem) {
  console.error(`✗ gerar-indice-backlog: ${mensagem}`)
  process.exit(1)
}

// ── 1. Ler o arquivo e separar o miolo do índice do resto ────────────────────
let texto
try {
  texto = readFileSync(ARQUIVO, 'utf8')
} catch (e) {
  morrer(`não consegui ler ${ARQUIVO} — ${e.message}`)
}

const iInicio = texto.indexOf(MARCA_INICIO)
const iFim = texto.indexOf(MARCA_FIM)

if (iInicio === -1 || iFim === -1) {
  morrer(
    'o BACKLOG.md não tem as marcas do índice. Acrescente estas duas linhas no ' +
      'topo do arquivo (uma vazia entre elas) e rode de novo:\n' +
      `    ${MARCA_INICIO}\n` +
      `    ${MARCA_FIM}`
  )
}
if (iFim < iInicio) {
  morrer('a marca de FIM do índice aparece ANTES da marca de INÍCIO no BACKLOG.md')
}

const antes = texto.slice(0, iInicio)
const depois = texto.slice(iFim + MARCA_FIM.length)

// O conteúdo a contar é TUDO menos o bloco do índice. É o que garante que rodar
// duas vezes não muda nada: a segunda leitura enxerga exatamente o mesmo texto.
const corpo = antes + depois

// ── 2. Achar os cabeçalhos e classificar ─────────────────────────────────────
const linhas = corpo.split('\n')
const itens = []
const semMarca = []

// Um cabeçalho de item pode ser ## ou ### — o NÍVEL diz onde ele mora (item de
// topo × sub-item dentro de uma sessão) e é preservado de propósito, para as
// seções não perderem o aninhamento. Quem define "é item" é a MARCA.
const RE_CABECALHO = /^(#{2,4})\s+(.*\S)\s*$/
const RE_MARCA = /^\[([ xX])\]\s*(.*)$/
const RE_SEVERIDADE = /\bS([1-4])\b/
// "cita o commit ou o arquivo de teste que a prova" — a regra dura do Marco.
// O hash tem de vir ENTRE CRASES, que é como a casa escreve em todo o arquivo. Sem essa
// exigência a contagem mente: `29798861431` (um id de execução do CI, 11 dígitos) e
// qualquer número comprido de 7+ algarismos casam com "hash hexadecimal" e passariam por
// prova. Um guarda que aceita número solto como evidência é pior que nenhum.
const RE_COMMIT = /`[0-9a-f]{7,40}`/
const RE_TESTE = /[\w./-]+\.test\.[jt]sx?\b/

for (let n = 0; n < linhas.length; n++) {
  const mCab = RE_CABECALHO.exec(linhas[n])
  if (!mCab) continue
  const titulo = mCab[2]
  const mMarca = RE_MARCA.exec(titulo)
  if (!mMarca) {
    semMarca.push(titulo)
    continue
  }
  const fechado = mMarca[1].toLowerCase() === 'x'
  const resto = mMarca[2]

  let estado
  if (fechado) estado = 'resolvido'
  else if (resto.includes(ETIQUETA_MOVER)) estado = 'movido'
  else if (resto.includes(ETIQUETA_DECISAO)) estado = 'decisão'
  else estado = 'aberto'

  const mSev = RE_SEVERIDADE.exec(resto)
  const severidade = mSev ? `S${mSev[1]}` : '—'

  // Corpo do item = do cabeçalho até o próximo cabeçalho (qualquer nível).
  let fim = n + 1
  while (fim < linhas.length && !RE_CABECALHO.test(linhas[fim])) fim++
  const bloco = linhas.slice(n, fim).join('\n')
  const temProva = RE_COMMIT.test(bloco) || RE_TESTE.test(bloco)

  itens.push({ titulo: resto, estado, severidade, temProva })
}

// ── 3. Montar o texto do índice ──────────────────────────────────────────────
const contar = (f) => itens.filter(f).length

const linhasTabela = SEVERIDADES.map((sev) => {
  const celulas = ESTADOS.map((e) => contar((i) => i.severidade === sev && i.estado === e))
  const total = celulas.reduce((a, b) => a + b, 0)
  return `| **${sev}** | ${celulas.join(' | ')} | **${total}** |`
})

const totaisPorEstado = ESTADOS.map((e) => contar((i) => i.estado === e))
const total = itens.length

// A regra dura do Marco: resolução que não cita commit nem teste NÃO conta como
// resolvida. O índice não decide por ninguém — ele mostra o número, e o número
// cobra. Zero aqui é o estado saudável.
const resolvidosSemProva = itens.filter((i) => i.estado === 'resolvido' && !i.temProva)

const blocoIndice = [
  MARCA_INICIO,
  '',
  '## Índice do BACKLOG — gerado, não escrito à mão',
  '',
  'Contagem medida pelo `scripts/gerar-indice-backlog.mjs` a partir das marcas dos',
  'cabeçalhos deste arquivo (convenção decidida pelo Marco em 24/07/2026 —',
  '`DECISOES-MARCO-H4.md`, item 4). Regerar: `node scripts/gerar-indice-backlog.mjs`.',
  '',
  '| severidade | aberto | decisão | movido | resolvido | total |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...linhasTabela,
  `| **total** | **${totaisPorEstado.join('** | **')}** | **${total}** |`,
  '',
  '**Como ler os quatro estados**',
  '',
  '- **aberto** — `[ ] Sxx — Título`. Reproduz hoje; só depende de trabalho.',
  `- **decisão** — \`[ ] Sxx — ${ETIQUETA_DECISAO} Título\`. Não depende de trabalho: espera resposta do Marco.`,
  `- **movido** — \`[ ] Sxx — ${ETIQUETA_MOVER} Título\`. Achado que nasceu neste repositório mas é do \`Financeiro\`; está agrupado no fim do arquivo para uma sessão de lá levar de uma vez.`,
  '- **resolvido** — `[x] RESOLVIDO (data, commit) — Título`, **citando o commit ou o arquivo de teste que prova**. É a regra dura do Marco: resolução sem citação volta a ser aberta.',
  '',
  `**Resoluções sem commit nem teste citado: ${resolvidosSemProva.length}.** ` +
    (resolvidosSemProva.length === 0
      ? 'Nenhuma — toda resolução deste arquivo cita a prova.'
      : 'Cada uma delas está fora da regra dura e deve voltar para aberta:'),
  ...(resolvidosSemProva.length === 0 ? [] : ['', ...resolvidosSemProva.map((i) => `- ${i.titulo}`)]),
  '',
  `**Cabeçalhos sem marca de estado: ${semMarca.length}.** Não são achados — são títulos`,
  'de seção e registros permanentes de política (decisão datada, risco aceito, nota de',
  'contexto). Ficam contados aqui de propósito: assim, deixar um achado sem marca não é',
  'um jeito silencioso de sumir com ele — o número sobe e alguém pergunta por quê.',
  '',
  MARCA_FIM,
].join('\n')

// ── 4. Escrever de volta ─────────────────────────────────────────────────────
const novo = antes + blocoIndice + depois
if (novo === texto) {
  console.log('✓ índice do BACKLOG já estava em dia — nada a reescrever')
} else {
  writeFileSync(ARQUIVO, novo, 'utf8')
  console.log('✓ índice do BACKLOG regerado em BACKLOG.md')
}
console.log(
  `  ${total} itens — ` +
    ESTADOS.map((e, k) => `${e} ${totaisPorEstado[k]}`).join(' · ') +
    ` | ${semMarca.length} cabeçalhos sem marca` +
    (resolvidosSemProva.length > 0
      ? ` | ⚠ ${resolvidosSemProva.length} resolução(ões) sem commit nem teste citado`
      : '')
)
