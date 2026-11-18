// Prova S7/P8 no navegador: o app REAL (vite dev) com uma festa sintética que
// tem um lote sem preço ("Camarote", 300 ingressos). Importa pelo Ajustes, abre
// a festa, confere Receita, Cenários, Relatório (com PDF A4), Apresentação,
// Copiar resumo, Exportar backup e recarga.
// Uso (servidor já de pé, a partir da raiz do repositório):
//   npm run dev -- --host 127.0.0.1 --port <PORTA> --strictPort
//   ~/bin/fila node scripts/provas-s7/fluxo-lote-sem-preco.mjs --porta <PORTA> --saida .context/s7/navegador
// Saída: 0 = tudo conferido; 1 = conteúdo divergente (lista das falhas);
// 2 = instrumento/ambiente não concluiu. Mesmo instrumento tem de acusar a base.
// PDF de Chromium headless não é o diálogo de impressão do Mac.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const opcao = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
const porta = opcao('--porta')
if (!porta || !opcao('--saida')) {
  console.error('Informe --porta e --saida.')
  process.exit(2)
}
const saida = resolve(opcao('--saida'))
mkdirSync(saida, { recursive: true })
const poppler = process.env.POPPLER_DE || '/opt/homebrew/bin'
const playwrightDe = process.env.PLAYWRIGHT_DE || join(homedir(), 'Desktop/Dev/calendario')
const { chromium } = createRequire(join(playwrightDe, 'node_modules/'))('playwright')
const normalizar = (t) => String(t).replace(/\s+/g, ' ').trim()

const TEXTO_RECEITA =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço.'
const TEXTO_COMPLETO =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
const CURTO = '1 lote sem preço fora do público e do bar (300 ingressos)'
const TEXTO_IMPORT =
  'Neste arquivo há 1 lote sem preço: Festa P8 — “Camarote” (300 ingressos). Lote sem preço fica fora do público, das cortesias e do bar até ter preço; para contar como cortesia, ponha 0 no preço, na aba Receita.'
const ROTULO = 'sem preço — fora da previsão'
const ROTULO_AJUSTE = 'sem preço — ajuste não conta'

const falhas = []
const exigir = (cond, msg) => {
  if (!cond) falhas.push(msg)
}
const recibo = { porta, capturas: [], dialogos: [], pedidosFora: [] }

// (1) a festa sintética, gerada pelos módulos do próprio app
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 }
const { novoEvento, novoLote, novoItem } = await import('../../src/lib/defaults.js')
const { montarBackup } = await import('../../src/lib/storage.js')
const e = novoEvento('Festa P8')
e.data = '2027-01-01'
e.categorias = e.categorias.map((c) => ({
  ...c,
  itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
}))
e.lotes = [
  novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
  novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
  novoLote({ id: 'l4', nome: 'Camarote', valor: '', quantidade: 300 }),
]
e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
e.barTaxaSistemaPct = 5
e.barCustoSistema = 500
const arquivoSintetico = join(saida, 'sintetico-p8.json')
writeFileSync(arquivoSintetico, JSON.stringify(montarBackup({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }), null, 2))

let browser
let codigo = 0
try {
  browser = await chromium.launch({ headless: true })
  recibo.navegador = browser.version()
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await contexto.newPage()
  // (2) nenhum pedido sai do app local
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.protocol === 'data:' || u.protocol === 'blob:') return
    if (u.hostname !== '127.0.0.1' || u.port !== String(porta)) recibo.pedidosFora.push(r.url())
  })
  page.on('dialog', async (d) => {
    recibo.dialogos.push({ tipo: d.type(), texto: d.message() })
    await d.accept()
  })
  const capturar = async (nome) => {
    const p = join(saida, `${nome}.png`)
    await page.screenshot({ path: p, fullPage: true })
    recibo.capturas.push(p)
  }
  const botao = (nome) => page.getByRole('button', { name: nome, exact: true })
  const faixasSemPreco = () => page.getByRole('status').filter({ hasText: 'sem preço' })

  await page.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'networkidle' })

  // (3) importa o backup pelo Ajustes
  await botao('Ajustes').click()
  await page.locator('input[accept=".json,application/json"]').setInputFiles(arquivoSintetico)
  await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => {})
  await page.waitForTimeout(800)
  const alerta = recibo.dialogos.map((d) => normalizar(d.texto)).find((t) => t.startsWith('Backup importado'))
  exigir(alerta, 'import: o alerta "Backup importado" não apareceu')
  exigir(alerta && alerta.includes(TEXTO_IMPORT), 'import: o alerta não traz o texto do lote sem preço')

  // (4) Receita
  await botao('Início').click()
  await page.getByRole('button', { name: 'Abrir Festa P8' }).click()
  await botao('Receita').click()
  const abrirReceitaChecar = async (rotulo) => {
    const f = faixasSemPreco()
    exigir((await f.count()) === 1, `${rotulo}: faixa da Receita ausente (ou repetida)`)
    if ((await f.count()) === 1) exigir(normalizar(await f.first().textContent()) === TEXTO_RECEITA, `${rotulo}: texto da faixa divergente`)
    const linha = page.locator('tr', { has: page.locator('input[value="Camarote"]') })
    // selo curto "sem preço" com o rótulo inteiro no title (regra do selo largo)
    exigir((await linha.locator(`[title="${ROTULO}"]`).getByText('sem preço', { exact: true }).count()) === 1, `${rotulo}: selo "sem preço" (title "${ROTULO}") ausente na linha`)
    return linha
  }
  const linha = await abrirReceitaChecar('Receita')
  const total = page.locator('tfoot tr').filter({ hasText: 'Total dos lotes (esgotado)' })
  exigir(normalizar(await total.textContent()).includes('650'), 'Receita: total dos lotes não é 650')
  exigir(!normalizar(await total.textContent()).includes('950'), 'Receita: total dos lotes ainda conta 950')
  const nome = await page.locator('input[value="Camarote"]').boundingBox()
  recibo.larguraNome1440 = nome?.width
  exigir(nome && nome.width >= 120, `Receita: caixa do nome com ${nome?.width} px (< 120)`)
  // a regra do plano mede em 1.440 px; a 1.024 px o selo largo espremia o nome
  // para 22 px — registrar a largura ali também (informativo, sem limite fixo)
  await page.setViewportSize({ width: 1024, height: 900 })
  recibo.larguraNome1024 = (await page.locator('input[value="Camarote"]').boundingBox())?.width
  recibo.larguraCortesia1024 = (await page.locator('input[value="Cortesias declaradas"]').boundingBox())?.width
  await page.setViewportSize({ width: 1440, height: 900 })
  await capturar('receita-1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturar('receita-390')
  await page.setViewportSize({ width: 1440, height: 900 })
  const preco = linha.locator('input').nth(1)
  await preco.fill('0')
  await page.waitForTimeout(150)
  exigir((await faixasSemPreco().count()) === 0, 'Receita: com preço 0 a faixa não sumiu')
  exigir((await linha.getByText('cortesia', { exact: true }).count()) === 1, 'Receita: com preço 0 o selo "cortesia" não apareceu')
  await preco.fill('')
  await page.waitForTimeout(150)
  exigir((await faixasSemPreco().count()) === 1, 'Receita: apagando o preço a faixa não voltou')
  await preco.blur()

  // (5) Cenários
  await botao('Cenários & Resultado').click()
  for (const nome of ['Pessimista', 'Realista', 'Otimista']) {
    const cartao = page.locator('[style]').filter({ has: page.getByRole('heading', { name: nome, exact: true }) }).filter({ hasText: 'Break-even' }).filter({ hasText: 'Público' }).last()
    exigir((await cartao.getByText(CURTO, { exact: true }).count()) === 1, `Cenários ${nome}: linha curta ausente`)
    if (nome === 'Realista') {
      const t = normalizar(await cartao.textContent())
      exigir(t.includes('590 (540 pagos)'), 'Cenários Realista: público não é "590 (540 pagos)"')
      exigir(t.includes('293 ingressos pagos'), 'Cenários Realista: break-even não é 293')
    }
  }
  await capturar('cenarios-1440')
  await page.getByRole('button', { name: /Ajuste manual por lote/ }).click()
  exigir((await page.getByText(ROTULO_AJUSTE, { exact: true }).count()) === 1, `Cenários: "${ROTULO_AJUSTE}" ausente no ajuste manual`)
  await capturar('cenarios-ajuste-1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturar('cenarios-390')
  await page.setViewportSize({ width: 1440, height: 900 })

  // (6) Relatório Completo e PDF
  await botao('Relatório / PDF').click()
  await botao('Completo').click()
  await page.waitForTimeout(200)
  {
    const f = faixasSemPreco()
    exigir((await f.count()) === 1, 'Relatório: faixa ausente')
    if ((await f.count()) === 1) exigir(normalizar(await f.first().textContent()) === TEXTO_COMPLETO, 'Relatório: texto da faixa divergente')
    const corpo = normalizar(await page.locator('body').textContent())
    exigir(corpo.includes(`Camarote (${ROTULO})`), 'Relatório: Camarote sem a marca no nome')
    exigir(corpo.includes('590 pessoas'), 'Relatório: cabeçalho não diz 590 pessoas')
  }
  await capturar('relatorio-completo-1440')
  await page.emulateMedia({ media: 'print' })
  const pdf = join(saida, 'relatorio-completo.pdf')
  await page.pdf({ path: pdf, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  const txt = execFileSync(join(poppler, 'pdftotext'), ['-layout', pdf, '-']).toString()
  const txtN = normalizar(txt)
  exigir(txtN.includes(normalizar(TEXTO_COMPLETO)), 'PDF: texto completo da faixa ausente')
  exigir(txtN.includes(`Camarote (${ROTULO})`), 'PDF: nome marcado do Camarote ausente')
  const linhaPdf = txt.split('\n').find((l) => l.includes('Camarote ('))
  recibo.linhaCamarotePdf = linhaPdf ? normalizar(linhaPdf) : null
  exigir(linhaPdf && !/R\$\s*0(?![\d.,])/.test(linhaPdf), `PDF: linha do Camarote com "R$ 0": ${linhaPdf}`)
  execFileSync(join(poppler, 'pdftoppm'), ['-png', '-r', '80', pdf, join(saida, 'relatorio-pagina')])
  recibo.paginasPdf = readdirSync(saida).filter((n) => n.startsWith('relatorio-pagina')).sort()
  writeFileSync(join(saida, 'relatorio-completo.txt'), txt)
  // volta para o editor
  await page.getByRole('button', { name: /Voltar|Editor|Início/ }).first().click()

  // (7) Apresentação
  await botao('Apresentação').click()
  await page.waitForTimeout(200)
  exigir((await faixasSemPreco().count()) === 1, 'Apresentação: faixa ausente')
  await capturar('apresentacao-1440')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // (8) Copiar resumo — a prévia dos dois níveis
  await botao('Copiar resumo').click()
  for (const nivel of ['Resumido', 'Completo']) {
    await page.getByRole('button', { name: new RegExp(`Copiar o nível ${nivel}`) }).hover()
    const pre = normalizar(await page.locator('pre').first().textContent())
    exigir(pre.includes('⚠️ O lote “Camarote” (300 ingressos) está sem preço'), `Copiar resumo ${nivel}: aviso ausente na prévia`)
    if (nivel === 'Resumido') recibo.previaResumido = pre
  }
  await capturar('copiar-resumo')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // (9) Exportar backup
  await botao('Início').click()
  const [download] = await Promise.all([page.waitForEvent('download'), botao('Exportar backup').click()])
  const exportado = join(saida, 'exportado.json')
  await download.saveAs(exportado)
  const volta = JSON.parse(readFileSync(exportado, 'utf8'))
  const cam = volta.eventos?.[0]?.lotes?.find((l) => l.nome === 'Camarote')
  exigir(cam && cam.valor === '' && cam.quantidade === 300, `Backup: Camarote voltou como ${JSON.stringify(cam)}`)

  // (10) recarregar: o selo continua
  await page.reload({ waitUntil: 'networkidle' })
  const voltar = page.getByRole('button', { name: 'Início', exact: true })
  if (await voltar.count()) await voltar.click()
  await page.getByRole('button', { name: 'Abrir Festa P8' }).click()
  await botao('Receita').click()
  await abrirReceitaChecar('Recarga')
  await capturar('receita-depois-da-recarga')

  exigir(recibo.pedidosFora.length === 0, `rede: pedidos fora do app local: ${recibo.pedidosFora.join(', ')}`)
  codigo = falhas.length ? 1 : 0
} catch (err) {
  falhas.push(`instrumento não concluiu: ${err?.message || err}`)
  codigo = 2
} finally {
  if (browser) await browser.close()
  recibo.falhas = falhas
  writeFileSync(join(saida, 'recibo.json'), JSON.stringify(recibo, null, 2))
  console.log(falhas.length ? `FALHAS (${falhas.length}):\n- ${falhas.join('\n- ')}` : 'tudo conferido')
  console.log(`capturas: ${recibo.capturas.length}; páginas do PDF: ${(recibo.paginasPdf || []).length}; diálogos: ${recibo.dialogos.length}; pedidos fora: ${recibo.pedidosFora.length}`)
  process.exitCode = codigo
}
