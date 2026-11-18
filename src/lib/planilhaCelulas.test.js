import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { planilhaParaAOA } from './planilhaCelulas.js'

describe('planilhaParaAOA — erro nativo sem perder números ou coordenadas', () => {
  it.each([0, 7, 15, 23, 29, 36, 42])('conserva o texto do erro Excel de código %s em bytes XLSX', codigo => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Coluna'], ['dado'], ['outro']])
    ws.A2 = { t: 'e', v: codigo }
    XLSX.utils.book_append_sheet(wb, ws, 'Sintética')
    const reaberta = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' }).Sheets['Sintética']
    const antes = structuredClone(reaberta)
    const texto = XLSX.utils.format_cell({ ...reaberta.A2 })
    expect(planilhaParaAOA(reaberta, { header: 1, raw: true, defval: null })).toEqual([['Coluna'], [texto], ['outro']])
    expect(reaberta).toEqual(antes)
  })

  it.each([null, ''])('mantém defval %s, linha vazia, zero e número válido sem conversão a texto', defval => {
    const ws = XLSX.utils.aoa_to_sheet([['Cabeçalho', '', null, 0, 1234.56], [], ['Última']])
    const antes = structuredClone(ws)
    expect(planilhaParaAOA(ws, { header: 1, raw: true, defval })).toEqual(XLSX.utils.sheet_to_json(structuredClone(ws), { header: 1, raw: true, defval }))
    expect(planilhaParaAOA(ws, { header: 1, raw: true, defval })[0].slice(3)).toEqual([0, 1234.56])
    expect(ws).toEqual(antes)
  })

  it('opções de faixa e formatação conservam endereço e não gravam cache no original', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Ignorar'], [1234.56, 0], ['Última']])
    ws.A2.z = '#,##0.00'
    ws.B3 = { t: 'e', v: 15 }
    const antes = structuredClone(ws)
    expect(planilhaParaAOA(ws, { header: 1, raw: false, defval: '', range: 'A2:B3' })).toEqual([['1,234.56', '0'], ['Última', '#VALUE!']])
    expect(ws).toEqual(antes)
  })
})
