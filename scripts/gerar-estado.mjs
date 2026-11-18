#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// gerar-estado.mjs — gera docs/ESTADO.md: o retrato do repositório onde cada
// número tem UM endereço só (Hardening 4, frente do estado).
//
// O PROBLEMA QUE ESTE SCRIPT EXISTE PARA MATAR: dez regras deste repositório
// viviam em duas ou mais cópias mantidas à mão, e pelo menos quatro já tinham
// derivado — quatro contagens diferentes de "quantos testes existem", três
// listas diferentes de dependências aprovadas, três números para a lista de
// arquivos protegidos pelo portão do golden. Sempre o mesmo enredo: alguém
// escreveu um número numa prosa, o código andou, o número ficou.
//
// Por isso este script NUNCA carrega um número dentro dele. Tudo que sai no
// documento é LIDO na hora, do arquivo onde o número já mora:
//
//   contagem de testes ...... scripts/gerar-indice-testes.mjs — a MESMA contagem,
//                             reaproveitada do código-fonte dele (ver
//                             contarTestes()), conferida contra a tabela
//                             "Resumo" do EVIDENCIA-TESTES.md commitado
//   arquivos protegidos ..... scripts/portao-golden.sh (variável PADRAO_PORTAO)
//   dependências ............ package.json
//   Node que a esteira usa .. .github/workflows/ci.yml (passo actions/setup-node)
//   Node que o app aceita ... package.json (engines.node)
//   trabalhos e passos ...... .github/workflows/ci.yml
//
// COMO RODAR:
//     node scripts/gerar-estado.mjs                  # escreve docs/ESTADO.md
//     node scripts/gerar-estado.mjs --saida <arq>    # escreve em outro lugar
//
// O --saida existe para CONFERIR sem sobrescrever a árvore de trabalho: gera
// num arquivo temporário e compara com o que está commitado. Um conferidor que
// escreve por cima do artefato que deveria auditar conserta a divergência em
// silêncio — e aí ninguém fica sabendo que ela existiu.
//
// DETERMINÍSTICO de propósito: sem data, sem hora, sem sha de commit. Duas
// rodadas seguidas dão byte por byte o mesmo arquivo, para que `diff` (ou um
// `md5`) seja prova, e não opinião.
//
// HONESTO de propósito: se um arquivo-fonte mudar de forma e este script não
// achar o que procura, ele PARA (falhar()) dizendo O QUÊ e ONDE, e não escreve
// nada. Documento gerado que chuta é pior que documento velho: ninguém
// desconfia dele.
//
// Este script só LÊ os arquivos-fonte. O único arquivo que ele escreve é a
// saída (docs/ESTADO.md, ou o caminho do --saida).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')

// Caminhos relativos à raiz — usados também como rótulo nas mensagens de erro,
// para a pessoa saber exatamente qual arquivo abrir.
const FONTES = {
  contagemTestes: 'scripts/gerar-indice-testes.mjs',
  indiceTestes: 'EVIDENCIA-TESTES.md',
  portao: 'scripts/portao-golden.sh',
  pacote: 'package.json',
  esteira: '.github/workflows/ci.yml',
}

const SAIDA_PADRAO = path.join(RAIZ, 'docs', 'ESTADO.md')

// ───────────────────────────── falha alta, nunca palpite ───────────────────

function falhar(oQue, onde, comoResolver) {
  console.error('')
  console.error('✗ gerar-estado.mjs PAROU — não consegui LER um número do arquivo onde ele mora.')
  console.error('')
  console.error(`  O quê: ${oQue}`)
  console.error(`  Onde:  ${onde}`)
  if (comoResolver) {
    console.error('')
    console.error(`  Como resolver: ${comoResolver}`)
  }
  console.error('')
  console.error('  Nenhum arquivo foi escrito. Este script prefere parar a inventar: um')
  console.error('  documento gerado que mente é pior que um documento desatualizado,')
  console.error('  porque ninguém desconfia dele.')
  console.error('')
  process.exit(1)
}

function lerFonte(chave) {
  const rel = FONTES[chave]
  const abs = path.join(RAIZ, rel)
  if (!existsSync(abs)) {
    falhar(
      'o arquivo-fonte não existe neste checkout',
      rel,
      'Este documento não tem de onde tirar os números desse arquivo. Confira se ele foi renomeado ou movido e ajuste FONTES em scripts/gerar-estado.mjs.',
    )
  }
  try {
    return readFileSync(abs, 'utf8')
  } catch (e) {
    falhar(`não consegui ler o arquivo (${e.message})`, rel)
  }
}

// Separador de milhar do português — feito à mão de propósito (Intl depende do
// ICU do build do Node; isto dá o mesmo byte em qualquer máquina).
const numero = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Célula de tabela Markdown: "|" quebraria a coluna; quebra de linha, a linha.
const celula = (s) => String(s).replace(/\r?\n+/g, ' ⏎ ').replace(/\|/g, '\\|')

// "1 arquivo está" / "7 arquivos estão" — o documento é lido pelo Marco, não
// por uma máquina; "1 arquivo(s)" é preguiça aparecendo no texto.
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`

// Trecho citado numa mensagem de erro: se o arquivo-fonte foi mangado, o valor
// lido pode ser enorme. Mensagem de erro ilegível não ajuda ninguém.
const resumir = (s, limite = 120) => {
  const uma = String(s).replace(/\r?\n/g, '⏎')
  return uma.length <= limite ? uma : uma.slice(0, limite) + '…'
}

// ───────────────────────── 1. contagem de testes ────────────────────────────
//
// Não existe um segundo contador aqui. Este trecho PEGA EMPRESTADO o contador
// de scripts/gerar-indice-testes.mjs: lê o texto-fonte daquele script, recorta
// o pedaço que só conta (da tabela DIRETORIOS até o fim do laço de coleta,
// parando antes da renderização em Markdown) e importa esse pedaço como
// módulo. Assim os dois documentos não têm como discordar — é literalmente o
// mesmo código contando.
//
// Por que recortar em vez de `import` do arquivo inteiro: aquele script escreve
// EVIDENCIA-TESTES.md no topo do módulo. Importá-lo inteiro sobrescreveria a
// árvore de trabalho como efeito colateral de gerar um relatório — a mesma
// armadilha do conferidor que conserta o que deveria auditar.

const MARCA_INICIO = '\nconst DIRETORIOS = ['
const MARCA_FIM = '\nfunction slug('
const NOMES_DA_CONTAGEM = [
  'DIRETORIOS',
  'relatorio',
  'totalArquivos',
  'totalDescribes',
  'totalIts',
  'totalPulados',
]

async function contarTestes() {
  const fonte = lerFonte('contagemTestes')

  const ini = fonte.indexOf(MARCA_INICIO)
  if (ini < 0) {
    falhar(
      `não achei o começo do contador (a linha \`${MARCA_INICIO.trim()}\`)`,
      FONTES.contagemTestes,
      'O gerador do índice de testes mudou de forma. Ajuste MARCA_INICIO em scripts/gerar-estado.mjs para o novo começo do bloco que conta — e confira se o bloco continua sem efeito colateral (o pedaço recortado não pode escrever arquivo).',
    )
  }
  const fim = fonte.indexOf(MARCA_FIM, ini)
  if (fim < 0) {
    falhar(
      `não achei o fim do contador (a linha \`${MARCA_FIM.trim()}\`, onde começa a renderização em Markdown)`,
      FONTES.contagemTestes,
      'Ajuste MARCA_FIM em scripts/gerar-estado.mjs para a primeira linha DEPOIS do laço que conta.',
    )
  }

  const bloco = fonte.slice(ini + 1, fim)

  for (const nome of NOMES_DA_CONTAGEM) {
    const declarado = new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${nome}\\b`)
    if (!declarado.test(bloco)) {
      falhar(
        `o contador não declara mais \`${nome}\` — sem esse nome eu não sei de onde tirar a contagem`,
        `${FONTES.contagemTestes} (trecho entre \`${MARCA_INICIO.trim()}\` e \`${MARCA_FIM.trim()}\`)`,
        'Ajuste NOMES_DA_CONTAGEM em scripts/gerar-estado.mjs para os nomes novos, ou reponha o nome antigo no gerador do índice.',
      )
    }
  }

  // Só builtins com prefixo node: — é o que um módulo data: consegue resolver.
  const moduloEmprestado = [
    "import { readdirSync, readFileSync, existsSync } from 'node:fs'",
    "import path from 'node:path'",
    `const RAIZ = ${JSON.stringify(RAIZ)}`,
    '',
    bloco,
    '',
    `export { ${NOMES_DA_CONTAGEM.join(', ')} }`,
    '',
  ].join('\n')

  const url =
    'data:text/javascript;base64,' + Buffer.from(moduloEmprestado, 'utf8').toString('base64')

  try {
    return await import(url)
  } catch (e) {
    falhar(
      `o contador emprestado não rodou (${e.message})`,
      `${FONTES.contagemTestes} (trecho entre \`${MARCA_INICIO.trim()}\` e \`${MARCA_FIM.trim()}\`)`,
      'O bloco que conta passou a depender de algo que não vem junto no recorte (uma constante do topo do arquivo, um import que não é builtin). Ajuste o recorte ou o preâmbulo em contarTestes(), em scripts/gerar-estado.mjs.',
    )
  }
}

// A tabela "Resumo" do EVIDENCIA-TESTES.md commitado — usada como CONFERÊNCIA
// da contagem ao vivo. Se as duas discordarem, o índice está velho e este
// script para: gerar um ESTADO.md certo ao lado de um índice errado é criar a
// quinta contagem em vez de matar as quatro.
function lerResumoDoIndice() {
  const texto = lerFonte('indiceTestes')
  const i = texto.indexOf('\n## Resumo')
  if (i < 0) {
    falhar(
      'não achei a seção "## Resumo" (a tabela com a contagem por diretório)',
      FONTES.indiceTestes,
      'Rode `node scripts/gerar-indice-testes.mjs` e confira se o índice ainda publica essa tabela; se o título mudou, ajuste lerResumoDoIndice() em scripts/gerar-estado.mjs.',
    )
  }

  const linhas = texto.slice(i + 1).split('\n').slice(1)
  const porDiretorio = new Map()
  let total = null

  for (const linha of linhas) {
    if (linha.startsWith('## ')) break
    if (!linha.startsWith('|')) continue
    const celulas = linha
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim().replace(/\*\*/g, ''))
    if (celulas.length !== 5) continue
    const rotulo = celulas[0]
    const nums = celulas.slice(1).map((c) => Number(c.replace(/\./g, '')))
    if (nums.some((n) => !Number.isInteger(n))) continue // cabeçalho ou separador
    const registro = {
      arquivos: nums[0],
      describes: nums[1],
      its: nums[2],
      pulados: nums[3],
    }
    if (/^total$/i.test(rotulo)) total = registro
    else porDiretorio.set(rotulo, registro)
  }

  if (total === null || porDiretorio.size === 0) {
    falhar(
      'a tabela "Resumo" existe mas não tem linhas legíveis (esperava `| diretório | arquivos | describe | it/test | skip |` e uma linha de Total)',
      `${FONTES.indiceTestes} (seção "## Resumo")`,
      'Rode `node scripts/gerar-indice-testes.mjs` para regerar o índice; se o formato da tabela mudou de propósito, ajuste lerResumoDoIndice() em scripts/gerar-estado.mjs.',
    )
  }
  return { porDiretorio, total }
}

function conferirContagem(medido, documentado) {
  const divergencias = []
  const compara = (rotulo, campo, a, b) => {
    if (a !== b) divergencias.push(`${rotulo} · ${campo}: ${b} no índice × ${a} medido agora`)
  }

  for (const dir of medido.relatorio) {
    const doc = documentado.porDiretorio.get(dir.rotulo)
    if (!doc) {
      divergencias.push(`${dir.rotulo}: o índice não tem linha para este diretório`)
      continue
    }
    const arquivos = dir.arquivosInfo.length
    const describes = dir.arquivosInfo.reduce((a, f) => a + f.nDescribes, 0)
    const its = dir.arquivosInfo.reduce((a, f) => a + f.nIts, 0)
    const pulados = dir.arquivosInfo.reduce((a, f) => a + f.nPulados, 0)
    compara(dir.rotulo, 'arquivos', arquivos, doc.arquivos)
    compara(dir.rotulo, 'describe', describes, doc.describes)
    compara(dir.rotulo, 'it/test', its, doc.its)
    compara(dir.rotulo, 'skip', pulados, doc.pulados)
  }
  compara('Total', 'arquivos', medido.totalArquivos, documentado.total.arquivos)
  compara('Total', 'describe', medido.totalDescribes, documentado.total.describes)
  compara('Total', 'it/test', medido.totalIts, documentado.total.its)
  compara('Total', 'skip', medido.totalPulados, documentado.total.pulados)

  if (divergencias.length > 0) {
    falhar(
      `o índice de testes commitado e os testes que existem de verdade discordam:\n         ${divergencias.join('\n         ')}`,
      `${FONTES.indiceTestes} (tabela "Resumo") × ${FONTES.contagemTestes} rodando agora`,
      'Rode `node scripts/gerar-indice-testes.mjs`, confira o diff e commite o EVIDENCIA-TESTES.md junto da mudança que alterou os testes. Só depois rode este script — dois documentos com contagens diferentes é exatamente o que ele existe para acabar.',
    )
  }
}

// ───────────────────── 2. arquivos protegidos pelo portão ───────────────────
//
// Lidos da variável PADRAO_PORTAO de scripts/portao-golden.sh — a lista viva,
// a mesma que o hook commit-msg e a esteira usam para barrar. Nada copiado.

function lerArquivosProtegidos() {
  const texto = lerFonte('portao')
  const m = /^PADRAO_PORTAO='([^']*)'/m.exec(texto)
  if (!m) {
    falhar(
      "não achei a linha `PADRAO_PORTAO='…'` (a lista viva de arquivos que o portão do golden protege)",
      FONTES.portao,
      'O portão mudou de forma. Ajuste lerArquivosProtegidos() em scripts/gerar-estado.mjs para ler a lista nova — e nunca copie a lista para dentro deste script: uma cópia é exatamente o problema que este documento existe para matar.',
    )
  }

  const bruto = m[1]
  if (!bruto.startsWith('^') || !bruto.endsWith('$')) {
    falhar(
      `o padrão do portão (\`${resumir(bruto)}\`) não está ancorado em \`^\` e \`$\` — não sei expandi-lo em caminhos sem chutar`,
      `${FONTES.portao} (variável PADRAO_PORTAO)`,
      'Formas que este script entende: `^prefixo/(a.js|b.js)$` ou `^caminho/unico.js$`.',
    )
  }

  // Um `|` de topo separa alternativas; um `|` dentro de parênteses não. Este
  // corte respeita a profundidade — sem ele, `src/lib/(a|b).js|package.json`
  // sairia partido no meio do grupo. (Sessão de 26/07/2026: até esta data o
  // script só sabia ler UM grupo e nada mais, e o portão ampliado de 25/07 o
  // fez PARAR — o docs/ESTADO.md ficou congelado sem ninguém notar.)
  const cortarNoTopo = (s) => {
    const partes = []
    let atual = ''
    let profundidade = 0
    for (let i = 0; i < s.length; i += 1) {
      const c = s[i]
      if (c === '\\') {
        atual += c + (s[i + 1] ?? '')
        i += 1
        continue
      }
      if (c === '(') profundidade += 1
      if (c === ')') profundidade -= 1
      if (c === '|' && profundidade === 0) {
        partes.push(atual)
        atual = ''
        continue
      }
      atual += c
    }
    partes.push(atual)
    return partes
  }

  const semEscape = (x) => x.replace(/\\(.)/g, '$1')
  const aindaÉRegex = (x) => /[\\^$*+?()[\]{}|]/.test(x)

  // O padrão de hoje é `^( … | … )$` — um grupo só, envolvendo tudo. Descascar
  // esse grupo é o que faz o corte de topo enxergar as alternativas; sem isso o
  // texto inteiro fica em profundidade 1 e vira "uma alternativa só", ilegível.
  // Só descasca quando o parêntese que abre é o MESMO que fecha no fim (senão
  // `(a|b)/(c|d)` seria lido como um grupo, e não é).
  const descascar = (s) => {
    if (!s.startsWith('(') || !s.endsWith(')')) return s
    let profundidade = 0
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '\\') { i += 1; continue }
      if (s[i] === '(') profundidade += 1
      if (s[i] === ')') {
        profundidade -= 1
        if (profundidade === 0) return i === s.length - 1 ? s.slice(1, -1) : s
      }
    }
    return s
  }

  const itens = []
  for (const alternativa of cortarNoTopo(descascar(bruto.slice(1, -1)))) {
    // (a) `prefixo/(a|b|c)sufixo` — um grupo só, o caso mais comum.
    const grupo = /^([^()|]*)\(([^()]*)\)([^()|]*)$/.exec(alternativa)
    if (grupo) {
      const [, prefixo, dentro, sufixo] = grupo
      for (const alt of dentro.split('|')) {
        const caminho = semEscape(prefixo + alt + sufixo)
        if (aindaÉRegex(caminho)) {
          falhar(
            `depois de expandir, o caminho \`${resumir(caminho)}\` ainda tem sintaxe de expressão regular — não é um arquivo de verdade`,
            `${FONTES.portao} (variável PADRAO_PORTAO)`,
            'Ensine lerArquivosProtegidos() (scripts/gerar-estado.mjs) a entender esse pedaço do padrão. Enquanto não entender, o documento não pode afirmar quantos arquivos o portão protege.',
          )
        }
        itens.push({ caminho, regra: null })
      }
      continue
    }

    // (b) `pasta/.+` — a regra que protege TUDO dentro de uma pasta. Não é um
    // arquivo, é uma regra: o documento lista os arquivos que existem lá hoje e
    // diz de onde eles vieram, em vez de fingir que o padrão é um caminho.
    const pasta = /^(.+?)\/\.\+$/.exec(alternativa)
    if (pasta) {
      const dir = semEscape(pasta[1])
      const regra = `${dir}/` + '.+'
      const achados = existsSync(path.join(RAIZ, dir))
        ? readdirSync(path.join(RAIZ, dir), { withFileTypes: true })
            .filter((d) => d.isFile())
            .map((d) => `${dir}/${d.name}`)
            .sort()
        : []
      if (achados.length === 0) {
        // Pasta vazia ou inexistente: a regra continua valendo, e um portão que
        // protege pasta vazia é exatamente o que precisa aparecer no documento.
        itens.push({ caminho: `${dir}/ (pasta vazia ou inexistente)`, regra })
      }
      for (const caminho of achados) itens.push({ caminho, regra })
      continue
    }

    // (c) caminho literal, sem nenhuma sintaxe sobrando.
    const literal = semEscape(alternativa)
    if (!aindaÉRegex(literal)) {
      itens.push({ caminho: literal, regra: null })
      continue
    }

    falhar(
      `não sei expandir o pedaço \`${resumir(alternativa)}\` do padrão do portão em uma lista de caminhos`,
      `${FONTES.portao} (variável PADRAO_PORTAO)`,
      'Formas que este script entende: `prefixo/(a.js|b.js)sufixo`, `pasta/.+` e `caminho/unico.js`, separadas por `|` no topo. Se o padrão ficou mais esperto que isso, ensine lerArquivosProtegidos() (scripts/gerar-estado.mjs) a lê-lo — não escreva a lista à mão aqui.',
    )
  }

  // Ordem do arquivo-fonte, de propósito: é a ordem em que o Marco escreveu a
  // lista. Existe? é conferido aqui — portão apontando para arquivo que não
  // existe é portão que nunca fecha, e isso tem de aparecer.
  return itens.map((it) => ({
    ...it,
    existe: it.caminho.includes(' (') ? false : existsSync(path.join(RAIZ, it.caminho)),
  }))
}

// ───────────────────────── 3. package.json ──────────────────────────────────

function lerPacote() {
  const texto = lerFonte('pacote')
  let pacote
  try {
    pacote = JSON.parse(texto)
  } catch (e) {
    falhar(`o arquivo não é um JSON válido (${e.message})`, FONTES.pacote)
  }
  for (const chave of ['dependencies', 'devDependencies']) {
    if (!pacote[chave] || typeof pacote[chave] !== 'object') {
      falhar(
        `não achei o bloco \`${chave}\` — sem ele não dá para listar as dependências declaradas`,
        FONTES.pacote,
        'Se o bloco foi removido de propósito, ajuste lerPacote() em scripts/gerar-estado.mjs; se sumiu por acidente, o package.json é que precisa voltar.',
      )
    }
  }
  const faixaNode = pacote.engines && pacote.engines.node
  if (typeof faixaNode !== 'string' || faixaNode.trim() === '') {
    falhar(
      'não achei `engines.node` — sem ele não dá para dizer qual Node este app aceita',
      FONTES.pacote,
      'Declare `"engines": { "node": "…" }` no package.json, ou ajuste lerPacote() em scripts/gerar-estado.mjs se a informação passou a morar em outro lugar.',
    )
  }
  return pacote
}

// Comparador ASCII simples: não depende do ICU do build do Node, então a ordem
// é a mesma em qualquer máquina (determinismo).
const ordemEstavel = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// ───────────────────── 4. Node: esteira × package.json ──────────────────────
//
// Devolve 'sim' | 'talvez' | 'nao' para uma cláusula. 'talvez' é honesto: a
// esteira que fixa só a major (node-version: '20') não permite afirmar se um
// piso como >=20.12.0 é respeitado — e este documento não afirma o que não sabe.

function versaoEmPartes(v) {
  const limpa = String(v).trim().replace(/^v/, '')
  const partes = limpa.split('.')
  if (!/^\d+$/.test(partes[0])) return null
  return {
    major: Number(partes[0]),
    minor: partes.length > 1 && /^\d+$/.test(partes[1]) ? Number(partes[1]) : null,
    patch: partes.length > 2 && /^\d+$/.test(partes[2]) ? Number(partes[2]) : null,
    completa: partes.length >= 3 && /^\d+$/.test(partes[1]) && /^\d+$/.test(partes[2]),
  }
}

function comparar(a, b) {
  for (const campo of ['major', 'minor', 'patch']) {
    const x = a[campo] ?? 0
    const y = b[campo] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

function avaliarClausula(clausula, usada, faixaCompleta) {
  const c = clausula.trim()
  let m

  const piso = (texto) => versaoEmPartes(texto)
  const mesmaMajor = (alvo) => usada.major === alvo.major

  if ((m = /^\^\s*(\d+(?:\.\d+)*)$/.exec(c))) {
    const alvo = piso(m[1])
    if (!mesmaMajor(alvo)) return 'nao'
    if ((alvo.minor ?? 0) === 0 && (alvo.patch ?? 0) === 0) return 'sim'
    if (!usada.completa) return 'talvez'
    return comparar(usada, alvo) >= 0 ? 'sim' : 'nao'
  }
  if ((m = /^>=\s*(\d+(?:\.\d+)*)$/.exec(c))) {
    const alvo = piso(m[1])
    if (usada.major > alvo.major) return 'sim'
    if (usada.major < alvo.major) return 'nao'
    if ((alvo.minor ?? 0) === 0 && (alvo.patch ?? 0) === 0) return 'sim'
    if (!usada.completa) return 'talvez'
    return comparar(usada, alvo) >= 0 ? 'sim' : 'nao'
  }
  if ((m = /^>\s*(\d+(?:\.\d+)*)$/.exec(c))) {
    const alvo = piso(m[1])
    if (usada.major > alvo.major) return 'sim'
    if (usada.major < alvo.major) return 'nao'
    if (!usada.completa) return 'talvez'
    return comparar(usada, alvo) > 0 ? 'sim' : 'nao'
  }
  if ((m = /^(\d+)\.(?:x|\*)$/.exec(c))) {
    return usada.major === Number(m[1]) ? 'sim' : 'nao'
  }
  if ((m = /^(\d+)$/.exec(c))) {
    return usada.major === Number(m[1]) ? 'sim' : 'nao'
  }
  if ((m = /^(\d+)\.(\d+)\.(\d+)$/.exec(c))) {
    const alvo = piso(c)
    if (usada.major !== alvo.major) return 'nao'
    if (!usada.completa) return 'talvez'
    return comparar(usada, alvo) === 0 ? 'sim' : 'nao'
  }

  falhar(
    `não sei interpretar a faixa de versão \`${c}\``,
    `${FONTES.pacote} (engines.node = "${faixaCompleta}")`,
    'Formas que este script entende, separadas por `||`: `^20.0.0`, `>=22.0.0`, `>20`, `20.x`, `20`, `20.11.1`. Se a faixa passou a usar outra forma, ensine avaliarClausula() (scripts/gerar-estado.mjs) — o documento não pode dar um veredito que ele não sabe calcular.',
  )
}

function conferirNode(versaoDaEsteira, faixa) {
  const usada = versaoEmPartes(versaoDaEsteira)
  if (!usada) {
    falhar(
      `a versão de Node da esteira (\`${versaoDaEsteira}\`) não parece um número de versão`,
      `${FONTES.esteira} (entrada node-version do passo actions/setup-node)`,
      'Se a esteira passou a escolher o Node por outro caminho (arquivo .nvmrc, variável), ensine lerNodeDaEsteira() em scripts/gerar-estado.mjs a ler de lá.',
    )
  }
  const clausulas = faixa
    .split('||')
    .map((c) => c.trim())
    .filter(Boolean)
  if (clausulas.length === 0) {
    falhar(`a faixa \`engines.node\` está vazia`, FONTES.pacote)
  }
  const resultados = clausulas.map((c) => ({ clausula: c, veredito: avaliarClausula(c, usada, faixa) }))
  const aprovada = resultados.find((r) => r.veredito === 'sim')
  const duvidosa = resultados.find((r) => r.veredito === 'talvez')
  if (aprovada) return { veredito: 'compatível', clausula: aprovada.clausula, usada }
  if (duvidosa) return { veredito: 'indeterminado', clausula: duvidosa.clausula, usada }
  return { veredito: 'INCOMPATÍVEL', clausula: null, usada }
}

// ───────────────────────── 5. a esteira (ci.yml) ────────────────────────────
//
// Leitor de YAML pelo recuo — não é um parser completo, é um varredor que sabe
// a forma deste arquivo: `jobs:` na coluna 0, id do trabalho com 2 espaços,
// chaves do trabalho com 4, passos com 6. Blocos literais (`run: |`) são
// pulados por recuo, para que uma linha de shell nunca seja lida como chave.

const ehVazia = (l) => l.trim() === '' || /^\s*#/.test(l)
const recuo = (l) => l.length - l.trimStart().length

function semComentario(valor) {
  const v = valor.trim()
  if (v.startsWith('"') || v.startsWith("'")) return v
  return v.replace(/\s+#.*$/, '').trim()
}

const semAspas = (v) => v.replace(/^['"]|['"]$/g, '')

// Remove as linhas de dentro de blocos literais (chave: | ou chave: >).
function semBlocosLiterais(linhas) {
  const saida = []
  let recuoDoBloco = null
  for (const linha of linhas) {
    if (recuoDoBloco !== null) {
      if (linha.trim() === '' || recuo(linha) > recuoDoBloco) continue
      recuoDoBloco = null
    }
    saida.push(linha)
    if (/^\s*(?:-\s+)?[A-Za-z0-9_-]+:\s*[|>][-+]?\s*$/.test(linha)) recuoDoBloco = recuo(linha)
  }
  return saida
}

function lerEsteira() {
  const texto = lerFonte('esteira')
  const todasAsLinhas = texto.split('\n')
  let i = todasAsLinhas.findIndex((l) => /^jobs:\s*$/.test(l))
  if (i < 0) {
    falhar(
      'não achei a linha `jobs:` — sem ela não dá para listar os trabalhos da esteira',
      FONTES.esteira,
      'Se a esteira foi dividida em vários arquivos de workflow, ensine lerEsteira() (scripts/gerar-estado.mjs) a varrer todos — não liste os trabalhos à mão.',
    )
  }

  const trabalhos = []
  let atual = null
  let dentroDePassos = false
  let passoAtual = null
  // O recuo dos itens de passo NÃO é fixado em 6 espaços: o primeiro `- ` que
  // aparecer depois de `steps:` define o recuo, e os seguintes têm de bater com
  // ele. YAML aceita as duas escritas (item alinhado com a chave ou recuado), e
  // o arquivo da esteira está sendo reescrito por outra frente — um leitor que
  // exige um estilo de recuo dá alarme falso no dia em que o estilo mudar.
  let recuoDosPassos = null

  for (i = i + 1; i < todasAsLinhas.length; i++) {
    const linha = todasAsLinhas[i]
    if (ehVazia(linha)) continue
    const r = recuo(linha)
    if (r === 0) break // saiu do bloco jobs:

    if (r === 2) {
      const mJob = /^ {2}([A-Za-z0-9_.-]+):\s*(?:#.*)?$/.exec(linha)
      if (!mJob) {
        falhar(
          `linha inesperada dentro de \`jobs:\` (esperava o id de um trabalho): \`${linha.trim()}\``,
          `${FONTES.esteira}, linha ${i + 1}`,
          'Ensine lerEsteira() (scripts/gerar-estado.mjs) a entender essa forma, ou confira se o ci.yml está bem formado.',
        )
      }
      atual = { id: mJob[1], nome: null, runner: null, usa: null, passos: [], linhas: [] }
      trabalhos.push(atual)
      dentroDePassos = false
      passoAtual = null
      recuoDosPassos = null
      continue
    }

    if (!atual) continue
    atual.linhas.push(linha)

    if (r === 4) {
      dentroDePassos = false
      passoAtual = null
      recuoDosPassos = null
      let m
      if ((m = /^ {4}name:\s*(.*)$/.exec(linha))) atual.nome = semAspas(m[1].trim())
      else if ((m = /^ {4}runs-on:\s*(.*)$/.exec(linha))) atual.runner = semAspas(semComentario(m[1]))
      else if ((m = /^ {4}uses:\s*(.*)$/.exec(linha))) atual.usa = semAspas(semComentario(m[1]))
      else if (/^ {4}steps:\s*$/.test(linha)) dentroDePassos = true
      continue
    }

    if (dentroDePassos && r > 4) {
      const mItem = /^(\s+)-(?:\s+(.*))?\s*$/.exec(linha)
      const abreItem = mItem && (recuoDosPassos === null || mItem[1].length === recuoDosPassos)
      if (abreItem) {
        recuoDosPassos = mItem[1].length
        passoAtual = { nome: null, usa: null, temRun: false, condicao: null, nodeVersion: null, linhas: [] }
        atual.passos.push(passoAtual)
        const restoDaLinha = (mItem[2] ?? '').trim()
        // O que vem depois do "- " é a primeira chave do passo. Reindentado ao
        // nível das outras chaves para o leitor de blocos literais (que decide
        // por recuo) não achar que essa chave está mais funda que as demais.
        if (restoDaLinha !== '') passoAtual.linhas.push(' '.repeat(recuoDosPassos + 2) + restoDaLinha)
      } else if (passoAtual) {
        passoAtual.linhas.push(linha)
      }
    }
  }

  if (trabalhos.length === 0) {
    falhar(
      'o bloco `jobs:` existe mas não achei nenhum trabalho dentro dele',
      FONTES.esteira,
      'Confira se o ci.yml está bem formado; se a forma mudou de propósito, ajuste lerEsteira() em scripts/gerar-estado.mjs.',
    )
  }

  for (const t of trabalhos) {
    if (t.passos.length === 0 && !t.usa) {
      falhar(
        `o trabalho \`${t.id}\` não tem passos nem \`uses:\` — não sei o que ele faz`,
        FONTES.esteira,
        'Confira o ci.yml; se um trabalho passou a ser declarado de outra forma, ensine lerEsteira() (scripts/gerar-estado.mjs) a reconhecê-la.',
      )
    }
    for (const p of t.passos) {
      const uteis = semBlocosLiterais(p.linhas)
      p.texto = p.linhas.join('\n')
      for (const l of uteis) {
        let m
        if ((m = /^\s*name:\s*(.*)$/.exec(l))) p.nome = p.nome ?? semAspas(m[1].trim())
        else if ((m = /^\s*uses:\s*(.*)$/.exec(l))) p.usa = p.usa ?? semAspas(semComentario(m[1]))
        else if ((m = /^\s*if:\s*(.*)$/.exec(l))) p.condicao = p.condicao ?? semComentario(m[1])
        else if ((m = /^\s*node-version:\s*(.*)$/.exec(l))) p.nodeVersion = semAspas(semComentario(m[1]))
        else if (/^\s*run:/.test(l)) p.temRun = true
      }
    }
  }

  return trabalhos
}

function lerNodeDaEsteira(trabalhos) {
  const achados = []
  for (const t of trabalhos) {
    for (const p of t.passos) {
      if (p.usa && p.usa.startsWith('actions/setup-node')) {
        if (!p.nodeVersion) {
          falhar(
            `o passo \`${p.nome ?? p.usa}\` do trabalho \`${t.id}\` prepara o Node mas não diz qual versão (\`node-version\`)`,
            FONTES.esteira,
            'Se a versão passou a vir de um arquivo (`node-version-file`), ensine lerNodeDaEsteira() (scripts/gerar-estado.mjs) a ler de lá.',
          )
        }
        achados.push({ trabalho: t.id, passo: p.nome ?? p.usa, versao: p.nodeVersion })
      }
    }
  }
  if (achados.length === 0) {
    falhar(
      'nenhum passo `actions/setup-node` na esteira — não sei dizer qual Node ela usa',
      FONTES.esteira,
      'Se a esteira passou a escolher o Node de outro jeito (imagem do container, .nvmrc), ensine lerNodeDaEsteira() (scripts/gerar-estado.mjs) a ler de lá. Não escreva a versão à mão neste script.',
    )
  }
  return achados
}

// ───────────────────────────── montagem do documento ────────────────────────

function lerSaidaDosArgumentos(argv) {
  let saida = SAIDA_PADRAO
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--saida') {
      const valor = argv[i + 1]
      if (!valor || valor.startsWith('--')) {
        falhar(
          'a opção `--saida` veio sem o caminho do arquivo',
          'linha de comando',
          'Use: node scripts/gerar-estado.mjs --saida <arquivo>. Sem a opção, a saída é docs/ESTADO.md.',
        )
      }
      saida = path.resolve(process.cwd(), valor)
      i++
      continue
    }
    falhar(
      `opção desconhecida: \`${arg}\``,
      'linha de comando',
      'Use: node scripts/gerar-estado.mjs [--saida <arquivo>].',
    )
  }
  return saida
}

// Argumentos primeiro: opção errada não merece nem o trabalho de varrer o repo.
const saida = lerSaidaDosArgumentos(process.argv.slice(2))

const contagem = await contarTestes()
conferirContagem(contagem, lerResumoDoIndice())

const protegidos = lerArquivosProtegidos()
const pacote = lerPacote()
const trabalhos = lerEsteira()
const nodeDaEsteira = lerNodeDaEsteira(trabalhos)

const versoesDistintas = [...new Set(nodeDaEsteira.map((a) => a.versao))].sort(ordemEstavel)
const faixaNode = pacote.engines.node
const vereditosNode = versoesDistintas.map((v) => ({ versao: v, ...conferirNode(v, faixaNode) }))

const dependencias = [
  ...Object.entries(pacote.dependencies).map(([nome, versao]) => ({ nome, versao, tipo: 'produção' })),
  ...Object.entries(pacote.devDependencies).map(([nome, versao]) => ({
    nome,
    versao,
    tipo: 'desenvolvimento',
  })),
].sort((a, b) => ordemEstavel(a.nome, b.nome) || ordemEstavel(a.tipo, b.tipo))

const totalPassos = trabalhos.reduce((a, t) => a + t.passos.length, 0)

// O passo que confere ESTE documento na esteira: detectado, nunca suposto.
const passoDoEstado = (() => {
  for (const t of trabalhos) {
    for (const p of t.passos) {
      if ((p.texto ?? '').includes('gerar-estado.mjs')) {
        return { trabalho: t.id, passo: p.nome ?? p.usa ?? '(passo sem nome)' }
      }
    }
  }
  return null
})()

const L = []

L.push('# ESTADO DO REPOSITÓRIO — cada número com um endereço só (gerado)')
L.push('')
L.push('> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/gerar-estado.mjs`,')
L.push('> que LÊ cada número do arquivo onde esse número já mora. Nada aqui é digitado:')
L.push('> editar à mão só cria mais uma cópia do número que este documento existe para')
L.push('> eliminar — e cópia mantida à mão é como as quatro contagens diferentes de')
L.push('> "quantos testes existem" nasceram.')
L.push('>')
L.push('> **Como regenerar:**')
L.push('>')
L.push('>     node scripts/gerar-estado.mjs')
L.push('>')
L.push('> **Como conferir sem escrever na árvore de trabalho** (é assim que a esteira deve')
L.push('> conferir — ver a última seção):')
L.push('>')
L.push('>     node scripts/gerar-estado.mjs --saida "$TMP" && diff -u docs/ESTADO.md "$TMP"')
L.push('>')
L.push('> A saída é **determinística**: sem data, sem hora, sem sha de commit — duas rodadas')
L.push('> seguidas dão byte por byte o mesmo arquivo, para que `diff` seja prova.')
L.push('>')
L.push('> Se um arquivo-fonte mudar de forma e o gerador não achar o que procura, ele **para')
L.push('> com erro dizendo o quê e onde** e não escreve nada — nunca um valor vazio, nunca um')
L.push('> palpite.')
L.push('')

L.push('## De onde vem cada número')
L.push('')
L.push('| Seção | Arquivo-fonte lido na hora | O que é extraído de lá |')
L.push('|---|---|---|')
L.push(
  `| Testes | \`${FONTES.contagemTestes}\` + \`${FONTES.indiceTestes}\` | o próprio contador do índice de testes, reaproveitado (não é uma segunda contagem); o índice commitado serve de conferência |`,
)
L.push(`| Portão do golden | \`${FONTES.portao}\` | a variável \`PADRAO_PORTAO\` |`)
L.push(`| Dependências | \`${FONTES.pacote}\` | \`dependencies\` e \`devDependencies\` |`)
L.push(
  `| Node | \`${FONTES.esteira}\` + \`${FONTES.pacote}\` | \`node-version\` do passo \`actions/setup-node\` e \`engines.node\` |`,
)
L.push(`| Esteira | \`${FONTES.esteira}\` | os trabalhos de \`jobs:\` e os passos de cada um |`)
L.push('')

// ── Testes ──
L.push('## Testes')
L.push('')
L.push(
  `**${plural(contagem.totalArquivos, 'arquivo de teste', 'arquivos de teste')} · ${plural(contagem.totalDescribes, 'bloco', 'blocos')} \`describe\` · ${plural(contagem.totalIts, 'verificação', 'verificações')} (\`it\`/\`test\`)**, das quais **${numero(contagem.totalPulados)} em \`skip\`**.`,
)
L.push('')
L.push('| Diretório | Arquivos | `describe` | Verificações (`it`/`test`) | das quais `skip` |')
L.push('|---|---:|---:|---:|---:|')
for (const dir of contagem.relatorio) {
  const nArq = dir.arquivosInfo.length
  const nDesc = dir.arquivosInfo.reduce((a, f) => a + f.nDescribes, 0)
  const nIts = dir.arquivosInfo.reduce((a, f) => a + f.nIts, 0)
  const nPul = dir.arquivosInfo.reduce((a, f) => a + f.nPulados, 0)
  L.push(`| \`${dir.rotulo}\` | ${numero(nArq)} | ${numero(nDesc)} | ${numero(nIts)} | ${numero(nPul)} |`)
}
L.push(
  `| **Total** | **${numero(contagem.totalArquivos)}** | **${numero(contagem.totalDescribes)}** | **${numero(contagem.totalIts)}** | **${numero(contagem.totalPulados)}** |`,
)
L.push('')
L.push(
  `Contado pelo mesmo código que gera o \`${FONTES.indiceTestes}\`: o gerador deste documento importa o trecho de contagem de \`${FONTES.contagemTestes}\` em vez de varrer os testes por conta própria, e **para com erro** se a tabela "Resumo" do índice commitado discordar do que ele mede agora. Os dois documentos não têm como divergir sem que alguém fique sabendo.`,
)
L.push('')
L.push(
  `**Cuidado ao comparar com a saída do \`npm test\`:** este é o número de verificações **escritas no código-fonte**, contadas sem executar nada. Um \`it.each\` aparece 1× aqui e roda 1× por linha da sua tabela de casos, então o total que o \`vitest\` imprime no fim da suíte é maior — e os dois estão certos, cada um medindo uma coisa. O número de **arquivos** é o mesmo nos dois. A lista caso a caso está em \`${FONTES.indiceTestes}\`.`,
)
L.push('')

// ── Portão ──
L.push('## Portão do golden — arquivos protegidos')
L.push('')
const ausentes = protegidos.filter((p) => !p.existe)
L.push(
  `**${plural(protegidos.length, 'arquivo', 'arquivos')}** ${protegidos.length === 1 ? 'está' : 'estão'} sob o portão do golden. Mudar qualquer um exige, na mensagem do commit, a linha \`APROVADO-PELO-MARCO: dd/mm/aaaa motivo em uma linha\` — o mesmo \`${FONTES.portao}\` recusa no hook \`commit-msg\` e na esteira.`,
)
L.push('')
L.push('| # | Arquivo protegido | Existe no repositório? |')
L.push('|---:|---|---|')
protegidos.forEach((p, indice) => {
  L.push(`| ${indice + 1} | \`${celula(p.caminho)}\` | ${p.existe ? 'sim' : '**NÃO ENCONTRADO**'} |`)
})
L.push('')
if (ausentes.length > 0) {
  L.push(
    `> **Atenção:** ${plural(ausentes.length, 'caminho protegido não existe', 'caminhos protegidos não existem')} neste checkout. Um portão que aponta para arquivo inexistente nunca fecha — confira se o arquivo foi renomeado sem atualizar \`PADRAO_PORTAO\` em \`${FONTES.portao}\`.`,
  )
  L.push('')
}
L.push(
  `Lista lida da variável \`PADRAO_PORTAO\` de \`${FONTES.portao}\`, na ordem em que está escrita lá. Ampliar essa lista é decisão do Marco; este documento só relata o que está no ar.`,
)
L.push('')

// ── Dependências ──
L.push('## Dependências declaradas')
L.push('')
const nProd = dependencias.filter((d) => d.tipo === 'produção').length
const nDev = dependencias.filter((d) => d.tipo === 'desenvolvimento').length
L.push(
  `**${plural(dependencias.length, 'pacote', 'pacotes')}** ${dependencias.length === 1 ? 'declarado' : 'declarados'}: ${numero(nProd)} de produção, ${numero(nDev)} de desenvolvimento.`,
)
L.push('')
L.push('| Pacote | Versão declarada | Onde |')
L.push('|---|---|---|')
for (const d of dependencias) {
  L.push(`| \`${celula(d.nome)}\` | \`${celula(d.versao)}\` | ${d.tipo} |`)
}
L.push('')
L.push(
  `Lido de \`${FONTES.pacote}\` (blocos \`dependencies\` e \`devDependencies\`). Esta é a lista do que **está instalado**; a lista do que é **aprovado** — e a justificativa de cada aprovação — mora no \`CLAUDE.md\`. Se as duas discordarem, quem manda é o \`CLAUDE.md\` e a diferença é um achado.`,
)
L.push('')

// ── Node ──
L.push('## Node — o que a esteira usa × o que o app aceita')
L.push('')
L.push('| Onde | O que está escrito lá |')
L.push('|---|---|')
for (const a of nodeDaEsteira) {
  L.push(
    `| Esteira · trabalho \`${celula(a.trabalho)}\` · passo "${celula(a.passo)}" | \`${celula(a.versao)}\` |`,
  )
}
L.push(`| \`${FONTES.pacote}\` · \`engines.node\` | \`${celula(faixaNode)}\` |`)
L.push('')
for (const v of vereditosNode) {
  if (v.veredito === 'compatível') {
    L.push(
      `- Node \`${v.versao}\` (esteira) **é compatível** com a faixa aceita: satisfaz a cláusula \`${v.clausula}\`.`,
    )
  } else if (v.veredito === 'indeterminado') {
    L.push(
      `- Node \`${v.versao}\` (esteira) — **indeterminado**: a esteira fixa só a linha \`${v.usada.major}\`, e a cláusula \`${v.clausula}\` exige um piso dentro dessa mesma linha. Só dá para afirmar depois de fixar a versão completa na esteira.`,
    )
  } else {
    L.push(
      `- Node \`${v.versao}\` (esteira) **NÃO satisfaz** nenhuma cláusula de \`engines.node\` (\`${celula(faixaNode)}\`) — a esteira está aprovando código num Node que o próprio \`${FONTES.pacote}\` recusa.`,
    )
  }
}
L.push('')

// ── Esteira ──
L.push('## Esteira (CI) — trabalhos e passos')
L.push('')
L.push(
  `**${plural(trabalhos.length, 'trabalho', 'trabalhos')} · ${plural(totalPassos, 'passo', 'passos')}** em \`${FONTES.esteira}\`.`,
)
L.push('')
trabalhos.forEach((t, indice) => {
  L.push(`### ${indice + 1}. \`${t.id}\`${t.nome ? ` — ${celula(t.nome)}` : ''}`)
  L.push('')
  const cabecalho = []
  if (t.runner) cabecalho.push(`roda em \`${celula(t.runner)}\``)
  cabecalho.push(plural(t.passos.length, 'passo', 'passos'))
  L.push(cabecalho.join(' · '))
  L.push('')
  if (t.passos.length === 0) {
    L.push(`_Trabalho reutilizável: \`${celula(t.usa)}\`._`)
    L.push('')
    return
  }
  L.push('| # | Passo | Como roda | Só quando |')
  L.push('|---:|---|---|---|')
  t.passos.forEach((p, j) => {
    const comoRoda = p.usa
      ? `\`${celula(p.usa)}\``
      : p.temRun
        ? 'script (`run:`) no próprio arquivo'
        : '—'
    L.push(
      `| ${j + 1} | ${celula(p.nome ?? '(passo sem nome)')} | ${comoRoda} | ${p.condicao ? `\`${celula(p.condicao)}\`` : 'sempre'} |`,
    )
  })
  L.push('')
})

// ── O passo que confere este documento ──
L.push('## Este documento na esteira')
L.push('')
if (passoDoEstado) {
  L.push(
    `A esteira confere este documento: passo "${celula(passoDoEstado.passo)}" do trabalho \`${celula(passoDoEstado.trabalho)}\` em \`${FONTES.esteira}\`. Se o \`docs/ESTADO.md\` commitado divergir do que o gerador produz, o envio é recusado.`,
  )
  L.push('')
} else {
  L.push(
    `**PENDENTE — nenhum passo de \`${FONTES.esteira}\` menciona \`scripts/gerar-estado.mjs\`.** Hoje este documento pode envelhecer no repositório sem que nada acuse: exatamente a doença que ele existe para curar, só que um andar acima. Detectado por leitura do arquivo da esteira; esta seção some sozinha quando o passo existir.`,
  )
  L.push('')
  L.push(
    'O passo que falta (**proposta**, não implementado aqui — o arquivo da esteira é território de outra frente). Mesmo desenho do passo que já confere o índice de testes, com uma diferença que é o ponto:',
  )
  L.push('')
  L.push('```yaml')
  L.push('      # Colocar no trabalho que já roda o índice de testes, logo depois dele,')
  L.push('      # ANTES do npm ci: é checagem estática e barata, e um passo que só roda')
  L.push('      # depois da suíte fica inalcançável enquanto a suíte estiver vermelha.')
  L.push('      # Não precisa de dependência instalada — o gerador só usa node:fs/path/url.')
  L.push('      - name: Estado do repositório (docs/ESTADO.md) atualizado')
  L.push("        if: matrix.tz == 'UTC'")
  L.push('        run: |')
  L.push('          ESPERADO="$(mktemp)"')
  L.push('          node scripts/gerar-estado.mjs --saida "$ESPERADO"')
  L.push('          if ! diff -u docs/ESTADO.md "$ESPERADO"; then')
  L.push('            echo ""')
  L.push('            echo "docs/ESTADO.md está DESATUALIZADO — o diff acima é a diferença"')
  L.push('            echo "entre o documento commitado e o estado real do repositório."')
  L.push('            echo "Rode \'node scripts/gerar-estado.mjs\', confira o diff e commite"')
  L.push('            echo "docs/ESTADO.md junto da mudança que alterou o estado."')
  L.push('            exit 1')
  L.push('          fi')
  L.push('```')
  L.push('')
  L.push(
    '**A armadilha evitada, e por que o `--saida` existe:** o passo do índice de testes regenera por cima da árvore de trabalho e só depois roda `git diff --exit-code`. Funciona na esteira, mas o mesmo desenho rodando na máquina de alguém (via `scripts/auditoria.sh`) **conserta o artefato em silêncio** — o conferidor reescreve justamente o que deveria auditar, e a divergência desaparece antes de virar notícia. Aqui a geração vai para um arquivo temporário e a comparação é `diff -u` contra o commitado: o arquivo versionado nunca é tocado, e a única saída possível é passar ou falhar dizendo qual linha mudou.',
  )
  L.push('')
  L.push(
    '**Critério de aceite do passo:** (1) com a árvore limpa, o passo passa; (2) alterando uma linha de `docs/ESTADO.md` à mão, o passo falha e o log mostra a linha; (3) depois de o passo rodar, `git status --porcelain docs/ESTADO.md` volta vazio — prova de que o conferidor não escreveu no arquivo versionado.',
  )
  L.push('')
}

// Uma linha em branco no fim e só uma: o arquivo é comparado por `diff`, então
// espaço sobrando vira ruído de diff sem significado nenhum.
while (L.length > 0 && L[L.length - 1] === '') L.pop()

const conteudo = L.join('\n') + '\n'
mkdirSync(path.dirname(saida), { recursive: true })
writeFileSync(saida, conteudo, 'utf8')

console.log(`Estado do repositório gerado em ${path.relative(RAIZ, saida) || saida}`)
console.log(
  `  testes: ${contagem.totalArquivos} arquivos · ${contagem.totalIts} verificações (${contagem.totalPulados} skip) — contagem do ${FONTES.contagemTestes}, conferida com o ${FONTES.indiceTestes}`,
)
console.log(`  portão do golden: ${protegidos.length} arquivos protegidos`)
console.log(`  dependências: ${nProd} de produção · ${nDev} de desenvolvimento`)
console.log(`  Node: esteira ${versoesDistintas.join(', ')} × package.json ${faixaNode}`)
console.log(`  esteira: ${trabalhos.length} trabalhos · ${totalPassos} passos`)
if (!passoDoEstado) {
  console.log('  ATENÇÃO: a esteira ainda NÃO confere este documento (seção "Este documento na esteira").')
}
