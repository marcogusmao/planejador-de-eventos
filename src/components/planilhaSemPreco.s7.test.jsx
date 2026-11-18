// @vitest-environment jsdom
//
// P2 da S7 (Marco, 06/10/2026, por questionário): planilha com a célula de
// preço VAZIA importa o lote como SEM PREÇO — fora do público e do bar, com
// "sem preço na planilha — fica fora do público e do bar até ter preço" na
// revisão. Célula com "0" ou "—" escrito continua cortesia (R$ 0). Antes, o
// vazio virava R$ 0 e as 300 pessoas entravam como cortesia: o mesmo defeito
// do P8, entrando pela importação.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import ImportModal from './ImportModal.jsx'
import { parseAOA } from '../lib/xlsxImport.js'
import { montarRevisaoPlanilha, montarDadosImportPlanilha } from '../lib/revisaoImportPlanilha.js'
import { censoNormalizacoes } from '../lib/migracao.js'
import { computeCenarios } from '../lib/calc.js'
import { loadStore, saveStore, liberarGravacao } from '../lib/storage.js'

let mem
beforeEach(() => {
  liberarGravacao()
  mem = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede não autorizada no teste') }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  liberarGravacao()
})

const custos = [['ESTRUTURA'], ['Macro', 'Serviço', 'Fornecedor', 'Estimado', 'Realizado'], ['', 'Som', '', 60000], []]
const planilha = (precoCamarote) => [
  ...custos,
  ['Lote', 'Valor unitário', 'Quantidade'],
  ['Lote 1', 100, 600],
  ['Cortesias declaradas', 0, 50],
  ['Camarote', precoCamarote, 300],
]
const lerAOA = (aoa) => parseAOA(aoa, { categorias: {}, lotes: [], avisos: [] }, 'Custos')
const camarote = (res) => res.lotes.find((l) => l.nome === 'Camarote')

describe('parseAOA — a célula de preço do lote', () => {
  it.each([
    ['null', null],
    ['texto vazio', ''],
    ['só espaços', '   '],
  ])('%s → lote SEM PREÇO (valor "")', (_n, celula) => {
    expect(camarote(lerAOA(planilha(celula)))).toMatchObject({ nome: 'Camarote', valor: '', quantidade: 300 })
  })
  it.each([
    ['"—" escrito', '—'],
    ['0 número', 0],
    ['"0" texto', '0'],
  ])('%s → continua cortesia (valor 0)', (_n, celula) => {
    expect(camarote(lerAOA(planilha(celula)))).toMatchObject({ nome: 'Camarote', valor: 0, quantidade: 300 })
  })
})

// Decisão P3 do Marco (06/10/2026): célula com SÓ "R$" não tem número escrito
// — é lote sem preço, como a vazia. Revisão adversarial da S7: antes ela
// passava por parseMoney, que tira o "R$" e devolve 0 (cortesia).
describe('P3 — a tabela completa da célula de preço', () => {
  const RECUSADO = 'recusado'
  it.each([
    ['null', null, ''],
    ['texto vazio', '', ''],
    ['três espaços', '   ', ''],
    ['espaço fixo (U+00A0)', '\u00a0', ''],
    ['tab', '\t', ''],
    ['"R$"', 'R$', ''],
    ['"R$ "', 'R$ ', ''],
    ['"r$" + espaço fixo', 'r$\u00a0', ''],
    ['"0"', '0', 0],
    ['"—"', '—', 0],
    ['"R$ 0,00"', 'R$ 0,00', 0],
    ['"-"', '-', RECUSADO],
    ['"–"', '–', RECUSADO],
  ])('%s → %s', (_n, celula, esperado) => {
    const res = lerAOA(planilha(celula))
    if (esperado === RECUSADO) {
      expect(camarote(res)).toBeUndefined()
      expect(JSON.stringify(res)).toContain('Camarote')
      return
    }
    expect(camarote(res)).toMatchObject({ nome: 'Camarote', valor: esperado, quantidade: 300 })
  })
})

describe('montarDadosImportPlanilha — evento e referência histórica', () => {
  const pacote = (celula) => {
    const rev = montarRevisaoPlanilha(lerAOA(planilha(celula)), 'Festa P8.xlsx')
    rev.salvarBenchmark = true
    return montarDadosImportPlanilha(rev)
  }
  it('o evento leva o Camarote com valor "" e censo vazio; fica fora do público', () => {
    const p = pacote(null)
    expect(p.ok).toBe(true)
    expect(p.censo).toStrictEqual([])
    const l = p.evento.lotes.find((x) => x.nome === 'Camarote')
    expect(l).toMatchObject({ valor: '', quantidade: 300 })
    expect(censoNormalizacoes([p.evento])).toStrictEqual([])
    expect(computeCenarios(p.evento).realista.publico).toBe(590)
  })
  it('a referência histórica da mesma planilha não muda: receita e pagos iguais aos do "0"', () => {
    const vazio = pacote(null).benchmark
    const zero = pacote(0).benchmark
    expect([vazio.receita, vazio.ticketMedio, vazio.custoTotal]).toStrictEqual([zero.receita, zero.ticketMedio, zero.custoTotal])
    expect(vazio.receita).toBe(60000)
  })
})

describe('ImportModal — revisão da planilha', () => {
  const arquivo = (aoa) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Custos')
    return { name: 'festa.xlsx', arrayBuffer: async () => XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) }
  }
  function montar() {
    const inicial = loadStore()
    function Fio() {
      const [store, setStore] = useState(inicial)
      useEffect(() => {
        saveStore(store)
      }, [store])
      return <ImportModal store={store} setStore={(fn) => setStore(fn)} abrir={() => {}} onClose={() => {}} />
    }
    return render(<Fio />)
  }
  const linhaLote = (nome) => {
    const tabela = screen.getByText('Lotes de ingresso').parentElement.querySelector('table')
    const cab = [...tabela.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    const tr = [...tabela.querySelectorAll('tbody tr')].find((r) => [...r.children].some((td) => td.textContent === nome))
    return (coluna) => tr.children[cab.indexOf(coluna)].textContent
  }

  it('célula vazia: "sem preço" no valor e a observação da decisão; aplicado, o lote fica salvo sem preço', async () => {
    const view = montar()
    // linha com a célula de preço realmente VAZIA no .xlsx
    fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [arquivo(planilha(null))] } })
    await screen.findByText(/Revisar importação/)
    const cam = linhaLote('Camarote')
    expect(cam('Valor unit.')).toBe('sem preço')
    expect(cam('Observação')).toBe('sem preço na planilha — fica fora do público e do bar até ter preço')
    expect(linhaLote('Cortesias declaradas')('Observação')).toBe('cortesia')
    fireEvent.click(screen.getByRole('button', { name: /^Importar .*evento|Confirmar importação/ }))
    await screen.findByText('Planilha importada')
    const salvo = loadStore().eventos[0]
    expect(salvo.lotes.find((l) => l.nome === 'Camarote')).toMatchObject({ valor: '', quantidade: 300 })
    expect(computeCenarios(salvo).realista.publico).toBe(590)
  })

  it('item 4 da revisão: observações de um lote porta sem preço saem separadas por " · "', async () => {
    const view = montar()
    const aoa = [...planilha(null), ['Porta', null, 100], ['Porta cortesia', 0, 20]]
    fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [arquivo(aoa)] } })
    await screen.findByText(/Revisar importação/)
    expect(linhaLote('Porta')('Observação')).toBe(
      'sem preço na planilha — fica fora do público e do bar até ter preço · lote porta → só otimista'
    )
    expect(linhaLote('Porta cortesia')('Observação')).toBe('cortesia · lote porta → só otimista')
  })

  it('controle: "—" escrito continua cortesia na revisão', async () => {
    const view = montar()
    fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [arquivo(planilha('—'))] } })
    await screen.findByText(/Revisar importação/)
    const cam = linhaLote('Camarote')
    expect(cam('Observação')).toBe('cortesia')
    expect(cam('Valor unit.')).toContain('R$')
    expect(within(screen.getByText('Lotes de ingresso').parentElement).queryByText(/sem preço na planilha/)).toBeNull()
  })
})
