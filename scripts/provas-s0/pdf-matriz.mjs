// Prova diagnóstica P1: renderiza o componente real, imprime A4 e confere totais.
// Código 1 = coluna/valor esperado ausente na matriz impressa; não é um conserto.
// Primeiro: npm run build. Depois: ~/bin/fila node scripts/provas-s0/pdf-matriz.mjs
// Usa o Playwright já disponível, como scripts/prova-csp-nuvem.mjs; não instala.
// PLAYWRIGHT_DE pode apontar para outra pasta com node_modules/playwright.
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { novoEvento, novoLote, novoItem } from '../../src/lib/defaults.js'
import { FIXED_BENCHMARKS } from '../../src/lib/benchmarks.js'
import { fmtBRL } from '../../src/lib/format.js'

const raiz = process.cwd()
const saida = resolve('.context/s0/pdf')
mkdirSync(saida, { recursive: true })
const pastaPlaywright = process.env.PLAYWRIGHT_DE || join(homedir(), 'Desktop/Dev/calendario')
const { chromium } = createRequire(join(pastaPlaywright, 'node_modules/'))('playwright')
const poppler = process.env.POPPLER_DE || '/opt/homebrew/bin'
const normalizar = texto => texto.replace(/\s+/g, ' ').trim()
const servidor = await createServer({
  configFile: resolve('vite.config.js'),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
let browser
const resultados = []
try {
  const { default: ReportView } = await servidor.ssrLoadModule('/src/components/ReportView.jsx')
  const { montarBenchmarkDeEvento } = await servidor.ssrLoadModule('/src/lib/fechamento.js')
  globalThis.localStorage = { getItem: k => k === 'previsao-eventos:relatorio-nivel:v1' ? 'completo' : null }
  const cssNome = readdirSync('dist/assets').find(n => n.endsWith('.css'))
  const css = readFileSync(join('dist/assets', cssNome), 'utf8')
    .replaceAll('/assets/', `file://${raiz}/dist/assets/`)
  browser = await chromium.launch({ headless: true })
  const pagina = await browser.newPage()
  // A prova imprime HTML estático local; nenhuma chamada HTTP é necessária.
  await pagina.route('http://**/*', route => route.abort())
  await pagina.route('https://**/*', route => route.abort())

  for (const n of [4, 5, 6, 7]) {
    const evento = novoEvento('S0 — relatório sintético')
    evento.data = '2027-01-01'
    evento.tipo = 'Brisa'
    evento.lotes = [novoLote({ valor: 100, quantidade: 1000 })]
    evento.categorias = evento.categorias.map((c, i) => ({ ...c, itens: [
      novoItem({ servico: `Custo sintético ${i}`, estimado: 5000 + i * 123 }),
    ] }))
    const benchmarksCustom = Array.from({ length: n }, (_, i) => {
      const b = novoEvento(`Referência sintética ${i + 1}`)
      b.receitaRealizada = { bilheteria: 250000 + i * 1000, bar: 5000 }
      b.categorias = b.categorias.map((c, j) => ({ ...c, itens: [
        novoItem({ servico: 'Custo sintético', estimado: 10000 + i * 1000 + j * 111,
          realizado: 10000 + i * 1000 + j * 111 }),
      ] }))
      return { ...montarBenchmarkDeEvento(b), id: `sintetico-${i}`, nome: b.nome }
    })
    evento.benchmarksAtivos = benchmarksCustom.map(b => b.id)
    const store = { eventos: [evento], benchmarksCustom,
      benchmarksApagados: FIXED_BENCHMARKS.map(b => b.id), benchmarkOverrides: {}, ajustes: {} }
    const html = renderToStaticMarkup(React.createElement(ReportView, { evento, store, onBack() {} }))
    const arquivoHtml = join(saida, `matriz-${n}.html`)
    const arquivoPdf = join(saida, `matriz-${n}.pdf`)
    writeFileSync(arquivoHtml, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>${css}</style><body>${html}</body></html>`)
    await pagina.goto(pathToFileURL(arquivoHtml).href)
    await pagina.emulateMedia({ media: 'print' })
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.pdf({ path: arquivoPdf, format: 'A4', scale: 1,
      printBackground: true, preferCSSPageSize: true })
    execFileSync(join(poppler, 'pdftotext'), ['-layout', arquivoPdf, join(saida, `matriz-${n}.txt`)])
    const paginas = readFileSync(join(saida, `matriz-${n}.txt`), 'utf8').split('\f')
    const indice = paginas.findIndex(p => /COMPARAÇÃO COM EVENTOS PASSADOS/i.test(p) && /Custo total/.test(p))
    if (indice < 0) throw new Error(`Instrumento sem matriz: PDF com ${n} referências`)
    const linha = paginas[indice].split('\n').find(l => /^\s*Custo total\s+R\$/.test(l))
    if (!linha) throw new Error(`Instrumento sem linha de total: ${n} referências`)
    const totais = benchmarksCustom.map(b => ({ nome: b.nome, esperado: normalizar(fmtBRL(b.custoTotal)),
      presente: normalizar(linha).includes(normalizar(fmtBRL(b.custoTotal))) }))
    execFileSync(join(poppler, 'pdftoppm'), ['-f', String(indice + 1), '-l', String(indice + 1),
      '-scale-to', '1600', '-png', '-singlefile', arquivoPdf, join(saida, `matriz-${n}-pagina`)])
    const resultado = { benchmarks: n, pagina: indice + 1, linhaImpressa: linha.trim(),
      totais, inteirosPresentes: totais.filter(t => t.presente).length }
    resultados.push(resultado)
    console.log(JSON.stringify(resultado))
  }
  writeFileSync(join(saida, 'resultado.json'), JSON.stringify({
    base: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
    navegador: browser.version(), formato: 'A4', escala: 1,
    limite: 'Chromium headless; não é o diálogo de impressão do Mac. Conferir PNG também.', resultados,
  }, null, 2))
  // O controle de 4 referências precisa passar antes de aceitar o instrumento.
  if (resultados[0].inteirosPresentes !== 4) throw new Error('Controle de 4 referências falhou: rever instrumento')
  process.exitCode = resultados.some(r => r.inteirosPresentes !== r.benchmarks) ? 1 : 0
} finally {
  if (browser) await browser.close()
  await servidor.close()
}
