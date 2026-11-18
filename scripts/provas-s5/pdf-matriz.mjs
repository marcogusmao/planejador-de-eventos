// Prova S5: componente real, todas as células/faixas, geometria e PDF A4.
// npm run build; ~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/pdf
// 0=aceite; 1=conteúdo/limite divergente; 2=instrumento/ambiente não concluiu.
// Mesmo instrumento deve acusar a base. PDF headless não é diálogo do Mac.
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { fixtureMatriz } from './fixture.mjs'
import { fmtBRL, DASH } from '../../src/lib/format.js'
import { CAT_LABELS } from '../../src/lib/benchmarks.js'

const args = process.argv.slice(2)
const opcao = nome => args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined
if (!opcao('--saida')) throw new Error('Informe --saida para guardar os artefatos sintéticos.')
const saida = resolve(opcao('--saida'))
mkdirSync(saida, { recursive: true })
const casos = (opcao('--casos') || '0,1,4,5,6,7,9,9l').split(',')
const raiz = process.cwd()
const pasta = dirname(fileURLToPath(import.meta.url))
const normalizar = t => t.replace(/\s+/g, ' ').trim()
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const poppler = process.env.POPPLER_DE || '/opt/homebrew/bin'
const playwright = process.env.PLAYWRIGHT_DE || join(homedir(), 'Desktop/Dev/calendario')
const { chromium } = createRequire(join(playwright, 'node_modules/'))('playwright')
const recibo = { base: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  node: process.version, formato: 'A4', escala: 1, margemMm: 12,
  instrumento: Object.fromEntries(['pdf-matriz.mjs', 'fixture.mjs', 'extrair-pdf.py'].map(f => [f, hash(join(pasta, f))])),
  fontes: Object.fromEntries(['src/components/ReportView.jsx', 'src/index.css'].map(f => [f, hash(f)])),
  limite: 'Chromium headless; DOM emulado complementa o PDF. Conferir PNG de todas as páginas da matriz.', casos: [] }
let servidor, browser

// Leitura por coluna dentro de cada faixa impressa. O gráfico fica fora.
function conferirPdf(paginas, tabelas, esperado, falhas) {
  const provas = []
  const encontrados = tabelas.map(() => [])
  let faixaAtual = 0, matrizComecou = false, matrizTerminou = false
  for (let p = 0; p < paginas.length; p++) {
    const pagina = paginas[p]
    const linhas = [...pagina.lines].sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin)
    const titulo = linhas.find(l => /COMPARAÇÃO COM EVENTOS PASSADOS/i.test(l.text))
    if (titulo) matrizComecou = true
    if (!matrizComecou || matrizTerminou) continue
    const fim = linhas.find(l => /Custo total — previsão/.test(l.text))
    const marcas = linhas.filter(l => /^Referências \d+/.test(l.text))
    const partes = marcas.length ? marcas.map((l, i) => ({
      inicio: l.yMax, fim: marcas[i + 1]?.yMin ?? fim?.yMin ?? pagina.height,
      faixa: Math.floor((Number(l.text.match(/^Referências (\d+)/)[1]) - 1) / 4),
    })) : [{ inicio: titulo?.yMax ?? 0, fim: fim?.yMin ?? pagina.height, faixa: faixaAtual }]
    for (const parte of partes) {
      faixaAtual = parte.faixa
      const tabela = tabelas[parte.faixa]
      if (!tabela) { falhas.push(`PDF página ${p + 1}: faixa ${parte.faixa + 1} sem tabela correspondente`); continue }
      // O início físico vem da categoria impressa, não de 655 fixo.
      const categoria = linhas.find(l => l.yMin >= parte.inicio && l.yMin < parte.fim && l.text === 'Categoria')
      const x0 = categoria?.xMin ?? 51.75
      const primeira = tabela.colunas[0]
      const colunas = tabela.colunas.map(c => ({ min: x0 + (c.x - primeira.x) * .75,
        max: x0 + (c.right - primeira.x) * .75 }))
      const rotulos = linhas.filter(l => l.yMin > parte.inicio && l.yMin < parte.fim && l.xMin < colunas[0].max - 2)
        .map(l => ({ linha: l, indice: esperado.findIndex(e => e.rotulo === normalizar(l.text) || e.rotulo.startsWith(normalizar(l.text) + ' ')) }))
        .filter(l => l.indice >= 0)
      if (!rotulos.length) continue
      if (!categoria) falhas.push(`PDF página ${p + 1}: continuação da faixa ${parte.faixa + 1} sem cabeçalho Categoria`)
      // Células são alinhadas pelo meio: dinheiro quebrado em duas linhas pode
      // começar acima do rótulo. As alturas vêm do DOM do mesmo componente/CSS.
      const primeiraLinha = rotulos[0], ultimaLinha = rotulos.at(-1)
      const alto = tabela.linhas[primeiraLinha.indice]?.height ?? 24
      const ultimoAlto = tabela.linhas[ultimaLinha.indice]?.height ?? 24
      const yInicio = (primeiraLinha.linha.yMin + primeiraLinha.linha.yMax) / 2 - alto * .75 / 2 - 1
      const yFim = (ultimaLinha.linha.yMin + ultimaLinha.linha.yMax) / 2 + ultimoAlto * .75 / 2 + 1
      const palavras = linhas.flatMap(l => l.words).filter(w => (w.yMin + w.yMax) / 2 >= yInicio && (w.yMin + w.yMax) / 2 <= yFim)
      const indices = [...new Set(rotulos.map(r => r.indice))]
      const referenciaInicio = parte.faixa * 4
      const ordenar = ws => normalizar(ws.sort((a, b) => Math.abs(a.yMin - b.yMin) < 1 ? a.xMin - b.xMin : a.yMin - b.yMin).map(w => w.text).join(' '))
      const compactar = s => s.replace(/\s+/g, '')
      const inicioCabecalho = categoria ? Math.max(parte.inicio, (categoria.yMin + categoria.yMax) / 2 - tabela.colunas[0].height * .75 / 2 - 2) : parte.inicio
      const header = colunas.map(c => ordenar(linhas.flatMap(l => l.words).filter(w =>
        (w.yMin + w.yMax) / 2 >= inicioCabecalho && (w.yMin + w.yMax) / 2 < yInicio &&
        (w.xMin + w.xMax) / 2 >= c.min - .7 && (w.xMin + w.xMax) / 2 < c.max - .7)))
      header.forEach((h, c) => {
        if (compactar(h) !== compactar(tabela.colunas[c].texto))
          falhas.push(`PDF página ${p + 1}, faixa ${parte.faixa + 1}, cabeçalho ${c}: esperado ${tabela.colunas[c].texto}; encontrado ${h}`)
      })
      const valores = rotulos.map(({ linha, indice }) => {
        const centro = (linha.yMin + linha.yMax) / 2
        const altura = tabela.linhas[indice].height * .75
        const daLinha = palavras.filter(w => (w.yMin + w.yMax) / 2 >= centro - altura / 2 - 1 &&
          (w.yMin + w.yMax) / 2 <= centro + altura / 2 - 1)
        const lidos = colunas.slice(1).map(c => ordenar(daLinha.filter(w =>
          (w.xMin + w.xMax) / 2 >= c.min - .7 && (w.xMin + w.xMax) / 2 < c.max - .7)))
        const esperados = [esperado[indice].previsao,
          ...esperado[indice].referencias.slice(referenciaInicio, referenciaInicio + colunas.length - 2)]
        lidos.forEach((v, c) => {
          if (compactar(v) !== compactar(esperados[c]))
            falhas.push(`PDF página ${p + 1}, faixa ${parte.faixa + 1}, linha ${esperado[indice].rotulo}, coluna ${c + 1}: esperado ${esperados[c]}; encontrado ${v}`)
        })
        return { indice, rotulo: esperado[indice].rotulo, lidos, esperados }
      })
      encontrados[parte.faixa].push(...indices)
      const fora = palavras.filter(w => w.xMin < 12 * 72 / 25.4 - 1 || w.xMax > pagina.width - 12 * 72 / 25.4 + 1)
      if (fora.length) falhas.push(`PDF página ${p + 1}: palavras fora da margem: ${fora.map(w => w.text).join(' ')}`)
      provas.push({ pagina: p + 1, faixa: parte.faixa + 1, indices, header, valores, x0, colunas })
    }
    if (fim) matrizTerminou = true
  }
  encontrados.forEach((indices, i) => {
    if (JSON.stringify(indices) !== JSON.stringify(esperado.map((_, j) => j)))
      falhas.push(`PDF faixa ${i + 1}: linhas encontradas ${indices.join(',')} não cobrem todas as linhas`)
  })
  return provas
}

try {
  servidor = await createServer({ configFile: resolve('vite.config.js'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  const { default: ReportView } = await servidor.ssrLoadModule('/src/components/ReportView.jsx')
  const { montarBenchmarkDeEvento } = await servidor.ssrLoadModule('/src/lib/fechamento.js')
  const { computeCenarios } = await servidor.ssrLoadModule('/src/lib/calc.js')
  const { colunaCustoPrevisao } = await servidor.ssrLoadModule('/src/lib/comparacaoCustos.js')
  globalThis.localStorage = { getItem: k => k === 'previsao-eventos:relatorio-nivel:v1' ? 'completo' : null }
  const cssNome = readdirSync('dist/assets').find(n => n.endsWith('.css'))
  const css = readFileSync(join('dist/assets', cssNome), 'utf8').replace(/url\(\/?assets\/([^)]*?)(?:["'])?\)/g, (_, nome) => `url(data:font/ttf;base64,${readFileSync(join('dist/assets', nome.replace(/["']/g, ''))).toString('base64')})`)
  recibo.css = { arquivo: cssNome, sha256: hash(join('dist/assets', cssNome)) }
  browser = await chromium.launch({ headless: true }); recibo.navegador = browser.version()
  const pagina = await browser.newPage({ viewport: { width: 703, height: 1123 } })
  await pagina.route(/^https?:/, r => r.abort())
  await pagina.emulateMedia({ media: 'print' })
  for (const caso of casos) {
    const n = parseInt(caso, 10), longo = caso.endsWith('l')
    const { evento, store, referencias } = fixtureMatriz(n, montarBenchmarkDeEvento, longo)
    const realista = computeCenarios(evento).realista
    const coluna = colunaCustoPrevisao(realista, id => realista.custosCategorias.find(c => c.id === id)?.considerado || 0)
    const esperado = coluna.categorias.map(({ id, exibido }) => ({ rotulo: CAT_LABELS[id],
      previsao: exibido ? normalizar(fmtBRL(exibido)) : DASH,
      referencias: referencias.map(b => b.custos?.[id] != null ? normalizar(fmtBRL(b.custos[id])) : DASH) }))
    if (coluna.outras.mostrar) esperado.push({ rotulo: 'Outras categorias', previsao: normalizar(fmtBRL(coluna.outras.exibido)), referencias: referencias.map(() => DASH) })
    esperado.push({ rotulo: `Contingência (${evento.contingenciaPct}%)`, previsao: normalizar(fmtBRL(coluna.contingencia.exibido)), referencias: referencias.map(() => DASH) })
    if (coluna.ajuste.mostrar) throw new Error('Fixture básica passou a ter ajuste: atualize expectativa explicitamente.')
    esperado.push({ rotulo: 'Custo total', previsao: normalizar(fmtBRL(coluna.total)), referencias: referencias.map(b => normalizar(fmtBRL(b.custoTotal))) })
    const html = renderToStaticMarkup(React.createElement(ReportView, { evento, store, onBack() {} }))
    const prefixo = join(saida, `matriz-${caso}`)
    writeFileSync(prefixo + '.html', `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>${css}</style><body>${html}</body></html>`)
    await pagina.goto(pathToFileURL(prefixo + '.html').href)
    await pagina.evaluate(() => document.fonts.ready)
    const mutacao = opcao('--mutacao')
    if (mutacao === 'largura') await pagina.addStyleTag({ content: `@media print { .matriz-relatorio { min-width: ${140 + (1 + n) * 102}px !important; } }` })
    if (mutacao === 'nowrap') await pagina.addStyleTag({ content: '.matriz-relatorio th,.matriz-relatorio td { white-space: nowrap !important; overflow: hidden !important; }' })
    if (mutacao === 'troca') await pagina.evaluate(() => {
      for (const r of document.querySelectorAll('.matriz-relatorio tbody tr')) {
        const c = r.cells; if (c.length < 4) continue
        const a = c[2].textContent; c[2].textContent = c[3].textContent; c[3].textContent = a
      }
    })
    if (mutacao === 'deslocar-linha') await pagina.evaluate(() => {
      for (const c of document.querySelectorAll('.matriz-relatorio tbody tr:first-child td:not(:first-child)')) {
        const s = document.createElement('span'); s.textContent = c.textContent
        s.style.cssText = 'display:inline-block;transform:translateY(25.5px)'; c.replaceChildren(s)
      }
    })
    if (mutacao) writeFileSync(prefixo + '.html', await pagina.content())
    const dom = await pagina.evaluate(() => {
      const norm = t => t.replace(/\s+/g, ' ').trim()
      const s = [...document.querySelectorAll('section')].find(s => s.querySelector('h2')?.textContent === 'Comparação com eventos passados')
      const box = e => { const b = e.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, width: b.width, height: b.height } }
      const falhas = []
      const tabelas = s ? [...s.querySelectorAll('table')].map((t, ti) => {
        const b = box(t), limite = box(s)
        if (b.x < limite.x - 1 || b.right > limite.right + 1) falhas.push(`tabela ${ti + 1} excede seção: ${b.width} > ${limite.width}`)
        const celulas = [...t.querySelectorAll('th,td')].map((c, ci) => {
          const cb = box(c), walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let node; const fragmentos = []
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue
            const range = document.createRange(); range.selectNodeContents(node)
            for (const r of range.getClientRects()) {
              fragmentos.push({ x: r.x, right: r.right, y: r.y, bottom: r.bottom })
              if (r.x < cb.x - 1 || r.right > cb.right + 1 || r.x < limite.x - 1 || r.right > limite.right + 1)
                falhas.push(`tabela ${ti + 1} célula ${ci + 1}: texto fora da célula/folha: ${norm(c.textContent)}`)
              let a = c.parentElement
              while (a && a !== document.body) {
                const st = getComputedStyle(a), ab = box(a)
                if (/(hidden|clip|auto|scroll)/.test(st.overflowX) && (r.x < ab.x - 1 || r.right > ab.right + 1))
                  falhas.push(`tabela ${ti + 1} célula ${ci + 1}: ancestral corta texto`)
                a = a.parentElement
              }
            }
          }
          return { texto: norm(c.textContent), ...cb, fragmentos }
        })
        const cabecalho = [...t.tHead.rows].at(-1)
        return { ...b, celulas, colunas: [...cabecalho.cells].map(c => ({ texto: norm(c.textContent), ...box(c) })),
          linhas: [...t.tBodies[0].rows].map(r => ({ valores: [...r.cells].map(c => norm(c.textContent)), ...box(r) })) }
      }) : []
      return { tabelas, falhas, fontes: [...document.fonts].map(f => ({ familia: f.family, status: f.status })), fontFamily: getComputedStyle(document.body).fontFamily }
    })
    const falhas = [...dom.falhas]
    const cdp = await pagina.context().newCDPSession(pagina)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'section table tbody td' })
    dom.fontesUsadas = nodeId ? (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : []
    dom.fontesPorPapel = {}
    for (const [papel, selector] of Object.entries({ categoria: '.comparacao-relatorio tbody td', nome: '.comparacao-relatorio thead tr:last-child th:nth-child(3)', valor: '.comparacao-relatorio tbody td:nth-child(2)' })) {
      const { nodeId: id } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
      if (id) dom.fontesPorPapel[papel] = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id })).fonts
    }
    await cdp.detach()
    if (!dom.fontesUsadas.some(f => ['Futura', 'Jost'].includes(f.familyName))) throw new Error(`Fonte esperada não usada no caso ${caso}`)
    if (dom.tabelas.length !== Math.ceil(n / 4)) falhas.push(`Estrutura: ${n} referências pedem ${Math.ceil(n / 4)} faixas; vieram ${dom.tabelas.length}`)
    let offset = 0
    dom.tabelas.forEach((t, ti) => {
      const qtd = t.colunas.length - 2
      if (qtd > 4) falhas.push(`Faixa ${ti + 1}: ${qtd} referências excedem quatro`)
      if (!t.colunas[1]?.texto.includes(evento.nome + ' (previsão)')) falhas.push(`Faixa ${ti + 1}: cabeçalho da previsão ausente`)
      t.colunas.slice(2).forEach((c, j) => { if (!c.texto.startsWith(referencias[offset + j]?.nome)) falhas.push(`Faixa ${ti + 1}: cabeçalho ${j + 1} fora de ordem`) })
      esperado.forEach((e, i) => {
        const valores = [e.rotulo, e.previsao, ...e.referencias.slice(offset, offset + qtd)]
        if (JSON.stringify(t.linhas[i]?.valores) !== JSON.stringify(valores)) falhas.push(`DOM faixa ${ti + 1}, linha ${e.rotulo}: esperado ${JSON.stringify(valores)}, encontrado ${JSON.stringify(t.linhas[i]?.valores)}`)
      })
      offset += qtd
    })
    if (offset !== n) falhas.push(`Referências presentes ${offset}; esperado ${n}`)
    await pagina.pdf({ path: prefixo + '.pdf', format: 'A4', scale: 1, printBackground: true, preferCSSPageSize: true })
    execFileSync(join(poppler, 'pdftotext'), ['-layout', prefixo + '.pdf', prefixo + '.txt'])
    execFileSync(join(poppler, 'pdftotext'), ['-bbox-layout', prefixo + '.pdf', prefixo + '-bbox.html'])
    const pdf = JSON.parse(execFileSync('python3', [join(pasta, 'extrair-pdf.py'), prefixo + '-bbox.html']).toString())
    execFileSync(join(poppler, 'pdftoppm'), ['-scale-to', '1600', '-png', prefixo + '.pdf', prefixo])
    const impresso = n ? conferirPdf(pdf, dom.tabelas, esperado, falhas) : []
    const resultado = { caso, mutacao: opcao('--mutacao'), referencias: n, longo, esperado, dom, impresso, paginas: pdf.length, falhas }
    recibo.casos.push(resultado)
    console.log(JSON.stringify({ caso, paginas: pdf.length, faixas: dom.tabelas.length, falhas: falhas.length, primeiras: falhas.slice(0, 5) }))
  }
  process.exitCode = recibo.casos.some(c => c.falhas.length) ? 1 : 0
} catch (erro) {
  recibo.erroInstrumento = erro.stack; process.exitCode = 2; console.error(erro)
} finally {
  if (browser) await browser.close()
  if (servidor) await servidor.close()
  writeFileSync(join(saida, 'resultado.json'), JSON.stringify(recibo, null, 2))
}
