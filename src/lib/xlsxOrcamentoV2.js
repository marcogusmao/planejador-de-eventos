// Export v2 do PRODUTOR — writer (exceljs). A planilha com a cara da casa:
// seções cinza por categoria, TOTAIS por fórmula com RESULT CACHEADO, logo da
// marca, dropdown de status, cor por formatação condicional. Números vêm do
// módulo de cálculo real — as ÚNICAS fórmulas do arquivo são os =SUM/refs de
// apresentação. O import continua no SheetJS (xlsxImport.js).
//
// Layout casado CÉLULA A CÉLULA com docs/mockup-export-v2.xlsx (Marco, 21/07):
// cabeçalho r2-6, 7 seções (título C:K, cabeçalho de colunas, itens, TOTAIS),
// TOTAL GERAL, PATROCÍNIO, RESUMO POR CATEGORIA, COMO USAR. As linhas FLEXAM com
// a quantidade real de itens; TOTAL GERAL e RESUMO referenciam as linhas de
// TOTAIS de verdade (calculadas na hora), não posições fixas do mockup.
//
// Três exigências técnicas do Marco:
//  1. RESULT CACHEADO: cada =SUM/ref é {formula, result}, o result do cálculo
//     real. Excel recalcula, mas Quick Look/Sheets/WhatsApp NÃO — sem o result,
//     a produtora vê total em branco. Um teste confere que o result BATE com a
//     soma dos itens (writer que mente = falha).
//  2. LOGO POR INJEÇÃO: gerarXlsx(evento, { logoPng }) recebe o PNG pronto; a
//     rasterização SVG→canvas mora em marcaPng.js (só navegador).
//  3. ROUND-TRIP CRUZADO: o teste-fumaça é o arquivo do exceljs LIDO pelo SheetJS.
import ExcelJS from 'exceljs'
import { custosPorCategoria } from './calc.js'
import { num } from './util.js'
import { fmtData } from './format.js'
import { STATUS_CUSTO, STATUS_CUSTO_IDS } from './statusCusto.js'
import { SENTINELA_V2 } from './orcamentoV2Contrato.js'

// Re-export: a fonte única da sentinela mora no contrato compartilhado com o
// import (o import não pode puxar o exceljs deste writer só pra ler a sentinela).
export { SENTINELA_V2 }

// Formato de moeda R$ do mockup (accounting: zero vira "-").
const MOEDA = '_-[$R$-416]* #,##0.00_-;-[$R$-416]* #,##0.00_-;_-[$R$-416]* "-"_-'
const CINZA = 'FFCCCCCC'
// Âmbar do destaque "FECHADO sem dados de pgto" (derivado, item 4 do Marco): NÃO
// é cor de status (essas vêm do statusCusto.js) — é um alerta de dado faltando.
const AMBAR = 'FFFFD966'
const COLS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] // conteúdo mora em C..K
// Cabeçalhos de coluna de uma seção de custo (C..K), na ordem do mockup.
const COLS_SECAO = [
  'SERVIÇO / PRODUTO', 'FORNECEDOR', 'ESTIMADO', 'REALIZADO', 'STATUS',
  'RESPONSÁVEL', 'DATA PGTO', 'PAGAMENTO (Pix / boleto / dados)', 'OBS',
]
const LISTA_STATUS = `"${STATUS_CUSTO_IDS.join(',')}"` // dropdown = lista canônica (11)
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase()
const fonte = (o = {}) => ({ name: 'Arial', size: 10, ...o })
const cinza = () => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } })
// Fórmula com RESULT CACHEADO (exigência 1). result do cálculo real.
const somaCache = (range, result) => ({ formula: `SUM(${range})`, result })
const refCache = (ref, result) => ({ formula: ref, result })
// Número de célula: vazio vira em BRANCO (não 0), como o mockup.
const celNum = (v) => (v === '' || v == null ? null : num(v))

// DATA "SÁB 05/12/2026": dia-da-semana pelo construtor por COMPONENTES locais
// (new Date(a, m-1, d)) — o off-by-one de fuso vem do parse de STRING ISO, que a
// casa proíbe; fmtData é puro string ("05/12/2026"). Sem new Date("2026-12-05").
function dataExtenso(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || ''
  const [a, m, d] = iso.split('-').map(Number)
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${fmtData(iso)}`
}

// Escreve uma célula (valor + formatação) num endereço A1.
function cel(ws, addr, value, { gray, bold, align, size, fmt, wrap } = {}) {
  const c = ws.getCell(addr)
  if (value !== undefined) c.value = value
  if (gray) c.fill = cinza()
  c.font = fonte({ bold: !!bold, size: size || 10 })
  if (align || wrap) c.alignment = { horizontal: align, wrapText: !!wrap, vertical: 'middle' }
  if (fmt) c.numFmt = fmt
  return c
}

// Faixa-título mesclada, cinza, centralizada (seções, PATROCÍNIO, RESUMO, COMO USAR).
function faixa(ws, range, texto, { size = 11 } = {}) {
  ws.mergeCells(range)
  cel(ws, range.split(':')[0], texto, { gray: true, bold: true, align: 'center', size })
}

// Bordas finas em CADA célula de um retângulo A1 (Marco, 21/07/2026): a grade
// geral fica DESLIGADA (showGridLines=false); as bordas ficam confinadas ao
// conteúdo — cabeçalho e tabelas —, deixando o slot do logo e as margens limpos.
// Em célula mesclada, a borda interna some sozinha; só o contorno externo pinta.
const BORDA_COR = 'FF808080'
const colParaNum = (letra) => letra.charCodeAt(0) - 64 // A=1 (colunas de conteúdo são C..K)
function bordear(ws, range) {
  const b = { style: 'thin', color: { argb: BORDA_COR } }
  const [ini, fim] = range.split(':')
  const c0 = colParaNum(ini.match(/[A-Z]+/)[0])
  const c1 = colParaNum(fim.match(/[A-Z]+/)[0])
  const r0 = Number(ini.match(/\d+/)[0])
  const r1 = Number(fim.match(/\d+/)[0])
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      ws.getCell(r, c).border = { top: b, left: b, bottom: b, right: b }
}

// PNG: largura/altura big-endian nos bytes 16..23 (após assinatura+IHDR). O
// writer dimensiona o logo pela razão REAL do PNG (a ostra é retrato, o wordmark
// panorâmico) — caixa fixa distorceria; assim a assinatura fica { logoPng } = bytes.
function dimensoesPng(bytes) {
  if (!bytes || bytes.length < 24) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length)
  const w = dv.getUint32(16)
  const h = dv.getUint32(20)
  return w && h ? { w, h } : null
}
function encaixar(dim, maxW, maxH) {
  if (!dim) return { width: maxW, height: maxH }
  const r = dim.w / dim.h
  let height = Math.min(maxH, maxW / r)
  let width = height * r
  if (width > maxW) { width = maxW; height = width / r }
  return { width: Math.round(width), height: Math.round(height) }
}

// COMO USAR — instruções da produtora. DUAS linhas foram CORRIGIDAS em relação
// ao mockup, que ficou desatualizado pela mudança de escopo do próprio Marco:
//  • linha 2: o mockup dizia "Status… o app não os lê"; no gate 1 STATUS virou
//    SCHEMA que o app LÊ. Corrigido: Status entra na lista do "lê de volta".
//  • linha 5: o mockup aponta "veja a linha Seguro (EventSeg)" — específico do
//    exemplo; num export real essa linha não existe. Reescrita genérica.
const COMO_USAR = [
  'Células BRANCAS são suas: Serviço, Fornecedor, Estimado, Realizado, Status, Responsável, Data Pgto, Pagamento e Obs. Células CINZAS têm fórmula — não mexa.',
  'O app lê de volta: Serviço, Fornecedor, Estimado, Status, Obs, Data Pgto e Pagamento. Realizado e Responsável são seus — o app não os altera nem os lê (v2).',
  'Custo novo: insira uma linha DENTRO da seção. Para remover, apague a linha inteira. Pode inserir, apagar e reordenar à vontade — o app reconcilia na importação e mostra a revisão antes de aplicar.',
  'Não mexa: na primeira linha e nos títulos das seções. A coluna oculta A ajuda o app a reconhecer as linhas — se sumir, o app ainda casa os itens e pede sua confirmação no que ficar ambíguo.',
  'Exemplo de preenchimento: num custo já pago, preencha Realizado, Status (ex.: PAGO), Data Pgto e os dados de pagamento (Pix/boleto). Data Pgto é TEXTO livre — vale "50% em 07/05 / 50% em 10/05".',
]

/** Escreve uma seção de custo a partir da linha `r`. Devolve o que os blocos de
 *  baixo precisam: a linha de TOTAIS (pro TOTAL GERAL e o RESUMO), os totais
 *  cacheados, e as faixas de status/pagamento (pro dropdown e a cor). */
function escreverSecao(ws, r, categoria, totaisCat) {
  const itens = categoria.itens || []
  faixa(ws, `C${r}:K${r}`, (categoria.nome || '').toUpperCase())
  const rHead = r + 1
  COLS_SECAO.forEach((h, i) => cel(ws, `${COLS[i]}${rHead}`, h, { bold: true, align: 'center', size: 9 }))
  const rItem0 = rHead + 1
  const corpo = Math.max(itens.length, 1) // ≥1 linha de corpo mesmo sem itens
  const rItemFim = rItem0 + corpo - 1
  itens.forEach((it, i) => {
    const rr = rItem0 + i
    cel(ws, `A${rr}`, it.id || '') // identidade na coluna A oculta
    cel(ws, `C${rr}`, it.servico || '', { align: 'left' })
    cel(ws, `D${rr}`, it.fornecedor || '', { align: 'left' })
    cel(ws, `E${rr}`, celNum(it.estimado), { fmt: MOEDA })
    cel(ws, `F${rr}`, celNum(it.realizado), { fmt: MOEDA }) // export-only (o app não lê)
    cel(ws, `G${rr}`, it.status || '', { align: 'center' }) // schema; cor via CF
    cel(ws, `H${rr}`, it.responsavel || '', { align: 'left' }) // export-only
    cel(ws, `I${rr}`, it.dataPgto || '', { align: 'center' }) // TEXTO LIVRE (decisão do Marco)
    cel(ws, `J${rr}`, it.pagamento || '', { align: 'left' })
    cel(ws, `K${rr}`, it.obs || '', { align: 'left' })
    ws.getCell(`G${rr}`).dataValidation = { type: 'list', allowBlank: true, formulae: [LISTA_STATUS] }
  })
  const rTot = rItemFim + 1
  cel(ws, `C${rTot}`, 'TOTAIS', { gray: true, bold: true })
  cel(ws, `E${rTot}`, somaCache(`E${rItem0}:E${rItemFim}`, totaisCat.estimado), { gray: true, bold: true, fmt: MOEDA })
  cel(ws, `F${rTot}`, somaCache(`F${rItem0}:F${rItemFim}`, totaisCat.realizado), { gray: true, bold: true, fmt: MOEDA })
  for (const c of ['D', 'G', 'H', 'I', 'J', 'K']) cel(ws, `${c}${rTot}`, undefined, { gray: true })
  bordear(ws, `C${r}:K${rTot}`) // bordas do bloco inteiro: título → cabeçalho → itens → TOTAIS
  return {
    proxima: rTot + 2, // 1 linha de respiro até a próxima faixa
    totaisRow: rTot,
    estimado: totaisCat.estimado,
    realizado: totaisCat.realizado,
    temItens: itens.length > 0,
    statusRange: `G${rItem0}:G${rItemFim}`,
    pagRange: `J${rItem0}:J${rItemFim}`,
    primItem: rItem0,
  }
}

export async function gerarXlsx(evento, { logoPng } = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('ORÇAMENTO', {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 7 }], // freeze C8
    pageSetup: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  })
  // Larguras do mockup, com dois ajustes: E e F (ESTIMADO/REALIZADO) ambos 15 (o
  // mockup deixou F no default e "R$ 45.000,00" viraria ###); e STATUS (G) = 22
  // pra o texto mais longo ("AGUARDANDO ORÇAMENTO") caber DENTRO da borda — o
  // mockup usava 12, mas só tinha status curtos (Marco, 21/07/2026).
  const larg = { A: 4, B: 3, C: 34, D: 18, E: 15, F: 15, G: 22, H: 14, I: 12, J: 34, K: 30 }
  for (const [c, w] of Object.entries(larg)) ws.getColumn(c).width = w
  ws.getColumn('A').hidden = true // identidade (sentinela + ids)

  cel(ws, 'A1', SENTINELA_V2)
  cel(ws, 'A2', evento.id || '') // id do evento-alvo (col A oculta) — o import reconcilia no evento certo sem adivinhar

  // Cabeçalho PROJETO/LOCAL/DATA/HORARIO/PÚBLICO (rótulo cinza em C, valor em D:E).
  const cab = [
    ['PROJETO', evento.tipo || ''],
    ['LOCAL', evento.local || ''],
    ['DATA', dataExtenso(evento.data)], // "SÁB 05/12/2026" sem off-by-one
    ['HORARIO', evento.horario || ''], // em branco por ora (evento não guarda) — BACKLOG
    ['PÚBLICO', evento.publicoEstimado === '' || evento.publicoEstimado == null ? '' : num(evento.publicoEstimado)],
  ]
  cab.forEach(([rot, val], i) => {
    const r = 2 + i
    cel(ws, `C${r}`, rot, { gray: true, bold: true, align: 'center' })
    ws.mergeCells(`D${r}:E${r}`)
    cel(ws, `D${r}`, val === '' ? undefined : val, { align: 'center' }) // vazio = célula sem valor (HORARIO)
  })
  bordear(ws, 'C2:E6') // caixa do cabeçalho (rótulo + valor por linha)

  // Logo POR INJEÇÃO (exigência 2), dimensionado pela razão real do PNG; sem
  // logo (O Galeao / tipo sem elemento) → nome em texto.
  if (logoPng) {
    const id = wb.addImage({ buffer: logoPng, extension: 'png' })
    ws.addImage(id, { tl: { col: 6.2, row: 1.2 }, ext: encaixar(dimensoesPng(logoPng), 210, 80) })
  } else {
    cel(ws, 'G2', evento.tipo || 'Sem marca', { bold: true, size: 16 })
  }

  // ——— As 7 seções de custo ———
  const porCat = custosPorCategoria(evento.categorias)
  const acharTot = (id) => porCat.porCategoria.find((c) => c.id === id) || { estimado: 0, realizado: 0 }
  const secoes = []
  const statusRanges = []
  let r = 8
  for (const cat of evento.categorias || []) {
    const s = escreverSecao(ws, r, cat, acharTot(cat.id))
    secoes.push({ nome: cat.nome, ...s })
    if (s.temItens) statusRanges.push(s)
    r = s.proxima
  }

  // ——— TOTAL GERAL — CUSTOS (soma das linhas de TOTAIS reais) ———
  const somaLinhas = (col) => secoes.map((s) => `${col}${s.totaisRow}`).join('+') || '0'
  const rGeral = r
  ws.mergeCells(`C${rGeral}:D${rGeral}`)
  cel(ws, `C${rGeral}`, 'TOTAL GERAL — CUSTOS', { gray: true, bold: true, align: 'center', size: 11 })
  cel(ws, `E${rGeral}`, refCache(somaLinhas('E'), porCat.totalEstimado), { gray: true, bold: true, size: 11, fmt: MOEDA })
  cel(ws, `F${rGeral}`, refCache(somaLinhas('F'), porCat.totalRealizado), { gray: true, bold: true, size: 11, fmt: MOEDA })
  bordear(ws, `C${rGeral}:F${rGeral}`)
  r = rGeral + 2

  // PATROCÍNIO fica FORA desta planilha (Marco, 21/07/2026): a planilha do
  // produtor é de CUSTO; patrocínio é receita que o Marco/as sócias decidem (o
  // estágio é do app). Os campos dataPgto/pagamento do patrocínio (gate 1)
  // seguem no schema, só não são exportados/reconciliados aqui.

  // ——— RESUMO POR CATEGORIA (refs às linhas de TOTAIS; TOTAL = TOTAL GERAL) ———
  faixa(ws, `C${r}:F${r}`, 'RESUMO POR CATEGORIA')
  const rResHead = r + 1
  ws.mergeCells(`C${rResHead}:D${rResHead}`)
  cel(ws, `C${rResHead}`, 'CATEGORIA', { bold: true, align: 'center', size: 9 })
  cel(ws, `E${rResHead}`, 'ESTIMADO', { bold: true, align: 'center', size: 9 })
  cel(ws, `F${rResHead}`, 'REALIZADO', { bold: true, align: 'center', size: 9 })
  secoes.forEach((s, i) => {
    const rr = rResHead + 1 + i
    ws.mergeCells(`C${rr}:D${rr}`)
    cel(ws, `C${rr}`, s.nome || '', { align: 'left' })
    cel(ws, `E${rr}`, refCache(`E${s.totaisRow}`, s.estimado), { fmt: MOEDA })
    cel(ws, `F${rr}`, refCache(`F${s.totaisRow}`, s.realizado), { fmt: MOEDA })
  })
  const rResTot = rResHead + 1 + secoes.length
  ws.mergeCells(`C${rResTot}:D${rResTot}`)
  cel(ws, `C${rResTot}`, 'TOTAL', { gray: true, bold: true })
  cel(ws, `E${rResTot}`, refCache(`E${rGeral}`, porCat.totalEstimado), { gray: true, bold: true, fmt: MOEDA })
  cel(ws, `F${rResTot}`, refCache(`F${rGeral}`, porCat.totalRealizado), { gray: true, bold: true, fmt: MOEDA })
  bordear(ws, `C${r}:F${rResTot}`) // bloco do RESUMO (C:F)
  r = rResTot + 2

  // ——— COMO USAR ———
  faixa(ws, `C${r}:K${r}`, 'COMO USAR', { size: 10 })
  COMO_USAR.forEach((linha, i) => {
    const rr = r + 1 + i
    ws.mergeCells(`C${rr}:K${rr}`)
    cel(ws, `C${rr}`, linha, { align: 'left', size: 9, wrap: true })
    ws.getRow(rr).height = 28
  })
  bordear(ws, `C${r}:K${r + COMO_USAR.length}`) // título + linhas do COMO USAR

  // ——— Cor do status por FORMATAÇÃO CONDICIONAL (segue o valor, não a foto) ———
  // As cores vêm do statusCusto.js (fonte única). cellIs-equal é constante, então
  // uma faixa combinada cobre todas as células de status de uma vez.
  if (statusRanges.length) {
    const ref = statusRanges.map((s) => s.statusRange).join(' ')
    const regras = STATUS_CUSTO.map((s, i) => ({
      type: 'cellIs', operator: 'equal', formulae: [`"${s.id}"`], priority: i + 1,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(s.bg) } }, font: { color: { argb: argb(s.texto) } } },
    }))
    ws.addConditionalFormatting({ ref, rules: regras })
    // Âmbar "FECHADO sem dados de pgto" (item 4): por seção, com a fórmula ancorada
    // na 1ª linha de item da seção (ref relativa exige âncora certa).
    for (const s of statusRanges) {
      ws.addConditionalFormatting({
        ref: s.pagRange,
        rules: [{
          type: 'expression', priority: 1,
          formulae: [`AND($G${s.primItem}="FECHADO",$J${s.primItem}="")`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBAR } } },
        }],
      })
    }
  }

  return wb.xlsx.writeBuffer()
}
