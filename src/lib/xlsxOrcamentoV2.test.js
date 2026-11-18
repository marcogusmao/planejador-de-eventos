// Teste-fumaça do writer v2 (Marco, 21/07/2026). O writer escreve com exceljs; o
// import lê com SheetJS. TRAVESSIA CRUZADA (exigência 3): gera pelo exceljs, lê
// pelo SheetJS, confere sentinela, ids da coluna oculta, valores, datas.
//
// Exigência 1 (result cacheado que NÃO mente) vira o cheque central e GENÉRICO:
// varre toda fórmula do arquivo lido de volta e confirma que o result cacheado
// bate com a recontagem das próprias células. Writer que mente em QUALQUER total
// (seção, TOTAL GERAL, RESUMO, patrocínio) falha aqui.
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { gerarXlsx, SENTINELA_V2 } from './xlsxOrcamentoV2.js'
import { novoEvento, novoItem, novoPatrocinio } from './defaults.js'

// PNG fake de 1×1 — a injeção do logo (exigência 2) é testável headless com isto;
// a rasterização SVG→canvas real (marcaPng.js) se prova no navegador.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// Evento de prova espelhando o mockup (Brisa 05/12): 3 das 7 categorias com
// itens (incluindo um FECHADO sem dados de pgto, pro âmbar) + 1 patrocínio.
function eventoDeProva() {
  const ev = novoEvento('Brisa 05/12')
  ev.tipo = 'Brisa'
  ev.local = 'Armazém Sólon'
  ev.data = '2026-12-05'
  ev.publicoEstimado = 1500
  const porNome = Object.fromEntries(ev.categorias.map((c) => [c.nome, c]))
  porNome['A&B'].itens = [
    novoItem({ servico: 'Equipe de bar', fornecedor: 'MZ', estimado: 15000, status: 'FECHAR' }),
    novoItem({ servico: 'Insumos, gelo e copos', estimado: 3000, status: 'ESTIMADO' }),
    novoItem({ servico: 'Consignados', fornecedor: 'King', estimado: 12000, status: 'FECHADO', pagamento: '' }), // FECHADO sem dados → âmbar
  ]
  porNome['Locação & Documentação'].itens = [
    novoItem({ servico: 'Locação do espaço', fornecedor: 'Central', estimado: 45000, status: 'NEGOCIAR' }),
    novoItem({ servico: 'Seguro', fornecedor: 'EventSeg', estimado: 2100, realizado: 1904.14, status: 'PAGO', responsavel: 'THAIS', dataPgto: '29/05', pagamento: 'Pix CNPJ 12.345' }),
  ]
  porNome['Artístico'].itens = [
    novoItem({ servico: 'DJ', fornecedor: 'Rost', estimado: 4000, status: 'ORÇADO' }),
    novoItem({ servico: 'DJ', fornecedor: 'Puff', estimado: 1500, status: 'ESTIMADO' }),
  ]
  ev.patrocinios = [novoPatrocinio({ patrocinador: 'Patrocinador B', valor: 8500, estagio: 'confirmado' })]
  return ev
}

async function gerarELer(ev, opts) {
  const buf = await gerarXlsx(ev, opts)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return { buf, wb, ws }
}

// ——— Cheque genérico da exigência 1: nenhuma fórmula mente ———
const valRef = (ws, ref) => (ws[ref] && typeof ws[ref].v === 'number' ? ws[ref].v : 0)
function somaColuna(ws, a, b) {
  const col = a.match(/[A-Z]+/)[0]
  const r0 = +a.match(/\d+/)[0]
  const r1 = +b.match(/\d+/)[0]
  let s = 0
  for (let r = r0; r <= r1; r++) s += valRef(ws, col + r)
  return s
}
/** Para CADA fórmula do arquivo (lida pelo SheetJS), recomputa o valor a partir
 *  das próprias células e devolve as divergências. Vazio = ninguém mente. */
function formulasQueMentiram(ws) {
  const erros = []
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const f = ws[addr].f
    if (typeof f !== 'string') continue
    const v = typeof ws[addr].v === 'number' ? ws[addr].v : 0
    let esperado = null
    const mSum = f.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/i)
    if (mSum) esperado = somaColuna(ws, mSum[1], mSum[2])
    else if (/^[A-Z]+\d+(\+[A-Z]+\d+)*$/.test(f)) esperado = f.split('+').reduce((s, ref) => s + valRef(ws, ref), 0)
    if (esperado != null && Math.abs(v - esperado) > 1e-9) erros.push(`${addr} [=${f}] cache=${v} ≠ ${esperado}`)
  }
  return erros
}

describe('writer v2 — travessia cruzada exceljs → SheetJS', () => {
  it('aba ORÇAMENTO + sentinela v2 na A1 + id do evento na A2', async () => {
    const ev = eventoDeProva()
    const { wb, ws } = await gerarELer(ev, { logoPng: PNG_1PX })
    expect(wb.SheetNames[0]).toBe('ORÇAMENTO')
    expect(ws['A1'].v).toBe(SENTINELA_V2)
    expect(ws['A2'].v).toBe(ev.id) // carimbo do evento-alvo (o import reconcilia no certo)
  })

  it('cabeçalho: PROJETO/LOCAL/PÚBLICO e DATA "SÁB 05/12/2026" (sem off-by-one de fuso)', async () => {
    const { ws } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    expect(ws['C2'].v).toBe('PROJETO')
    expect(ws['D2'].v).toBe('Brisa')
    expect(ws['D3'].v).toBe('Armazém Sólon')
    expect(ws['D4'].v).toBe('SÁB 05/12/2026') // dia-da-semana por componentes locais
    expect(ws['C5'].v).toBe('HORARIO')
    expect(ws['D5']).toBeUndefined() // célula nem existe = HORARIO em branco por ora (BACKLOG)
    expect(ws['D6'].v).toBe(1500)
  })

  it('EXIGÊNCIA 1 — NENHUMA fórmula do arquivo mente (seção, TOTAL GERAL, RESUMO)', async () => {
    const { ws } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    // sanidade: existem fórmulas de fato (senão o cheque passaria vazio à toa)
    const nFormulas = Object.keys(ws).filter((k) => !k.startsWith('!') && typeof ws[k].f === 'string').length
    expect(nFormulas).toBeGreaterThan(10)
    expect(formulasQueMentiram(ws)).toEqual([])
  })

  it('TOTAL GERAL bate com a soma de TODOS os itens estimados', async () => {
    const { ws } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    // acha a célula do TOTAL GERAL pela fórmula de +-joined refs em E
    const addr = Object.keys(ws).find((k) => !k.startsWith('!') && /^E\d+\+E/.test(ws[k].f || ''))
    expect(addr).toBeTruthy()
    expect(ws[addr].v).toBe(15000 + 3000 + 12000 + 45000 + 2100 + 4000 + 1500) // 82600
  })

  it('ids dos itens na coluna A: VALOR atravessa (SheetJS); OCULTAÇÃO é de escrita (exceljs)', async () => {
    const ev = eventoDeProva()
    const idAB = ev.categorias.find((c) => c.nome === 'A&B').itens[0].id
    const { buf, ws } = await gerarELer(ev, { logoPng: PNG_1PX })
    expect(ws['A10'].v).toBe(idAB) // 1ª seção: título r8, cabeçalho r9, 1º item r10
    const ExcelJS = (await import('exceljs')).default
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf)
    expect(wb2.getWorksheet('ORÇAMENTO').getColumn('A').hidden).toBe(true)
  })

  it('dropdown de STATUS = lista canônica (11), não os 4 do mockup', async () => {
    const { buf } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    const ExcelJS = (await import('exceljs')).default
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf)
    const dv = wb2.getWorksheet('ORÇAMENTO').getCell('G10').dataValidation
    expect(dv.type).toBe('list')
    expect(dv.formulae[0]).toContain('TBI')
    expect(dv.formulae[0]).toContain('AGUARDANDO ORÇAMENTO')
    expect(dv.formulae[0]).toContain('PAGO')
    expect(dv.formulae[0]).not.toBe('"A PAGAR,PARCIAL,PAGO,FECHADO"') // não é a lista velha do mockup
  })

  it('COMO USAR presente e com a linha de STATUS CORRIGIDA (gate 1: o app LÊ status)', async () => {
    const { ws } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    const textos = Object.keys(ws).filter((k) => !k.startsWith('!')).map((k) => ws[k].v)
    expect(textos).toContain('COMO USAR')
    const linhaLe = textos.find((t) => typeof t === 'string' && t.startsWith('O app lê de volta'))
    expect(linhaLe).toContain('Status') // status entra no "lê de volta"
    expect(linhaLe).toContain('Realizado e Responsável são seus') // não mais "Status … são seus"
    expect(linhaLe).not.toContain('Status e Responsável são seus') // texto velho não sobrou
  })

  it('sem logoPng → fallback de texto (não quebra)', async () => {
    const { ws } = await gerarELer(eventoDeProva(), {})
    expect(ws['G2'].v).toBe('Brisa')
  })

  it('PATROCÍNIO NÃO aparece na planilha, mesmo com o evento tendo patrocínios (Marco 21/07)', async () => {
    const ev = eventoDeProva()
    expect(ev.patrocinios.length).toBeGreaterThan(0) // o evento TEM patrocínio…
    const { ws } = await gerarELer(ev, { logoPng: PNG_1PX })
    const textos = Object.keys(ws).filter((k) => !k.startsWith('!')).map((k) => ws[k].v)
    expect(textos).not.toContain('PATROCÍNIO') // …mas o export é só de custo
    expect(textos).not.toContain('TOTAL PATROCÍNIO')
    expect(textos).not.toContain('Patrocinador B')
  })

  it('bordas nas células de conteúdo (cabeçalho + tabela), grade geral desligada', async () => {
    const { buf } = await gerarELer(eventoDeProva(), { logoPng: PNG_1PX })
    const ExcelJS = (await import('exceljs')).default
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf)
    const ws2 = wb2.getWorksheet('ORÇAMENTO')
    expect(ws2.views[0].showGridLines).toBe(false) // grade global segue desligada
    const temBorda = (addr) => {
      const b = ws2.getCell(addr).border
      return !!(b && b.top && b.bottom && b.left && b.right)
    }
    expect(temBorda('C2')).toBe(true) // cabeçalho
    expect(temBorda('C9')).toBe(true) // cabeçalho de coluna da 1ª seção
    expect(temBorda('E10')).toBe(true) // célula de item
    expect(temBorda('C15')).toBe(true) // TOTAIS
  })
})

// De-risca o detalhe que o Marco nomeou: serial de data entre as libs. Nosso
// schema guarda data como TEXTO (dataExtenso monta string), mas se um dia a DATA
// virar célula-data, é aqui que a discórdia de epoch/fuso apareceria.
describe('interop de data serial exceljs → SheetJS (sonda)', () => {
  it('célula-data de verdade atravessa com o mesmo dia (sem escorregar 1)', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('T')
    const c = ws.getCell('A1')
    c.value = new Date(Date.UTC(2026, 11, 5))
    c.numFmt = 'dd/mm/yyyy'
    const buf = await wb.xlsx.writeBuffer()
    const rb = XLSX.read(buf, { type: 'buffer', cellDates: true, UTC: true })
    const back = rb.Sheets[rb.SheetNames[0]]['A1'].v
    expect(back instanceof Date).toBe(true)
    expect([back.getUTCFullYear(), back.getUTCMonth(), back.getUTCDate()]).toEqual([2026, 11, 5])
  })
})
