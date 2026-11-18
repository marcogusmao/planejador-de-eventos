// @vitest-environment jsdom
// Diagnóstico S0: asserções do comportamento desejado; não altera fórmula/golden.
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { computeCenarios } from '../../src/lib/calc.js'
import ScenariosTab from '../../src/components/ScenariosTab.jsx'
import PresentationMode from '../../src/components/PresentationMode.jsx'
import ReportView from '../../src/components/ReportView.jsx'
import { resumoCompleto } from '../../src/lib/resumo.js'
import { eventoSemPreco, eventoTravado } from './cenarios.fixture.js'

beforeEach(() => {
  const dados = new Map([['previsao-eventos:relatorio-nivel:v1', 'completo']])
  vi.stubGlobal('localStorage', {
    getItem: k => dados.get(k) ?? null,
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: k => dados.delete(k),
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const storeDe = evento => ({ eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

describe('P8 — preço ausente não equivale a cortesia', () => {
  it('controle: preço zero declarado continua cortesia', () => {
    const e = eventoSemPreco()
    e.lotes[2].valor = 0
    const c = computeCenarios(e).realista
    expect(c.cortesias).toBe(350)
    expect(c.publico).toBe(890)
  })
  for (const cenario of ['pessimista', 'realista', 'otimista']) {
    it(`${cenario}: preço ausente fica fora de público e bar`, () => {
      const e = eventoSemPreco()
      const atual = computeCenarios(e)[cenario]
      const comparador = computeCenarios({ ...e, lotes: e.lotes.slice(0, 2) })[cenario]
      console.log('P8', cenario, JSON.stringify({
        atual: { publico: atual.publico, cortesias: atual.cortesias, bar: atual.bar, lucro: atual.lucro, breakEven: atual.breakEven },
        comparador: { publico: comparador.publico, cortesias: comparador.cortesias, bar: comparador.bar, lucro: comparador.lucro, breakEven: comparador.breakEven },
      }))
      expect.soft(atual.cortesias).toBe(50)
      expect.soft(atual.publico).toBe(comparador.publico)
      expect.soft(atual.bar).toBe(comparador.bar)
      expect.soft(atual.lucro).toBe(comparador.lucro)
    })
  }
})

describe('R1 — aviso de quantidade travada nas superfícies', () => {
  const aviso = /quantidade travada à mão neste cenário/i
  it('controle: sem ajuste manual o resumo publica break-even numérico', () => {
    const e = eventoTravado()
    e.cenariosConfig.overrides.realista = {}
    const c = computeCenarios(e).realista
    expect(c.breakEven).toBeGreaterThan(0)
    expect(resumoCompleto(e)).toMatch(/break-even [\d.]+ pagos/)
    expect(resumoCompleto(e)).not.toMatch(aviso)
  })
  const superficies = {
    'cartões e DRE': e => render(<ScenariosTab evento={e} store={storeDe(e)} update={vi.fn()} />),
    'relatório completo': e => render(<ReportView evento={e} store={storeDe(e)} onBack={vi.fn()} />),
    'apresentação': e => render(<PresentationMode evento={e} store={storeDe(e)} update={vi.fn()} aparencia={{}} onClose={vi.fn()} />),
  }
  for (const [nome, montar] of Object.entries(superficies)) {
    it(`${nome}: explicita por que não publica um mínimo`, () => {
      const e = eventoTravado()
      const { container } = montar(e)
      const c = computeCenarios(e).realista
      console.log('R1', nome, JSON.stringify({ breakEven: c.breakEven, pagos: c.pagos, aviso: aviso.test(container.textContent) }))
      expect(container.textContent).toMatch(aviso)
    })
  }
  it('WhatsApp: explicita a quantidade travada', () => {
    const texto = resumoCompleto(eventoTravado())
    console.log('R1 WhatsApp', texto.split('\n').filter(l => /break-even/i.test(l)).join(' | '))
    expect(texto).toMatch(aviso)
  })
})
