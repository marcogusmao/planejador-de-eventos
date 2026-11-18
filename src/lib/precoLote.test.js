// H3-E — paridade BYTE A BYTE com as expressões que moravam no JSX
// (RevenueTab.jsx:352/359 e ReportView.jsx:539 antes do refactor). As
// expressões antigas estão escritas LITERAIS aqui: se alguém mudar o módulo,
// a paridade acusa; se um dia a fórmula mudar em calc.js (portão), estas
// telas passam a morder junto — que era o buraco do §7.2.

import { describe, it, expect } from 'vitest'
import { fatorTaxaCliente, precoEfetivoLote, precoAoCliente, receitaEfetivaLote } from './precoLote.js'
import { descontoEfetivoPct, computeCenario, isTaxaCliente } from './calc.js'
import { novoEvento, novoLote } from './defaults.js'
import { num } from './util.js'

const eventoCom = ({ taxaPagaPor = '', cupom = 0, modo = '', fracao = '' } = {}) => {
  const e = novoEvento('Paridade')
  e.taxaBilheteria = 12
  e.taxaPagaPor = taxaPagaPor
  e.descontoMedioPct = cupom
  e.descontoIngressosModo = modo
  e.descontoIngressosValor = fracao
  e.lotes = [
    novoLote({ nome: 'Pré', valor: 275, quantidade: 60 }),
    novoLote({ nome: 'L1', valor: 300, quantidade: 60 }),
    novoLote({ nome: 'Cortesia', valor: 0, quantidade: 30 }),
  ]
  return e
}

// A grade que o plano H3-E pede: taxa nós/cliente × cupom 0/12% × modo %/nº.
const GRADE = [
  { taxaPagaPor: '', cupom: 0 },
  { taxaPagaPor: '', cupom: 12 },
  { taxaPagaPor: 'cliente', cupom: 0 },
  { taxaPagaPor: 'cliente', cupom: 12 },
  { taxaPagaPor: 'cliente', cupom: 12, modo: 'numero', fracao: 100 },
  { taxaPagaPor: '', cupom: 10, modo: '', fracao: 80 }, // o caso do print do Marco (efetivo 8%)
]

describe('paridade com as expressões antigas do JSX', () => {
  it.each(GRADE.map((g, i) => [i, g]))('caso %i da grade', (_i, g) => {
    const evento = eventoCom(g)
    const r = computeCenario(evento, 'realista')
    const efetivoR = descontoEfetivoPct(evento, r.pagos)
    const fator = 1 + num(evento.taxaBilheteria) / 100 // RevenueTab.jsx:38 antigo
    expect(fatorTaxaCliente(evento)).toBe(fator)
    for (const l of evento.lotes) {
      // RevenueTab.jsx:352 e ReportView.jsx:539 antigos
      expect(precoEfetivoLote(l.valor, efetivoR)).toBe(num(l.valor) * (1 - efetivoR / 100))
      // RevenueTab.jsx:359 antigo
      expect(precoAoCliente(l.valor, efetivoR, evento)).toBe(
        num(l.valor) * (1 - efetivoR / 100) * fator
      )
    }
  })

  it('números conferidos à mão (o print do Marco): tabela 275 com efetivo 8% → 253; ao cliente ×1,12 → 283,36', () => {
    const evento = eventoCom({ taxaPagaPor: 'cliente', cupom: 10, modo: '', fracao: 80 })
    const r = computeCenario(evento, 'realista')
    const efetivoR = descontoEfetivoPct(evento, r.pagos)
    expect(efetivoR).toBe(8) // 10% de cupom em 80% dos ingressos
    expect(precoEfetivoLote(275, efetivoR)).toBe(253)
    expect(precoAoCliente(275, efetivoR, evento)).toBeCloseTo(283.36, 2)
    expect(isTaxaCliente(evento)).toBe(true)
  })
})

describe('receitaEfetivaLote — a coluna Receita da tabela (decisão do Marco, 20/07/2026)', () => {
  it('lote comum: efetivo × quantidade; cortesia vale 0; só-otimista vale 0', () => {
    const evento = eventoCom({ cupom: 10, fracao: 80 })
    const r = computeCenario(evento, 'realista')
    const efetivoR = descontoEfetivoPct(evento, r.pagos)
    const [pre, l1, cortesia] = evento.lotes
    expect(receitaEfetivaLote(pre, efetivoR)).toBe(253 * 60) // 15.180
    expect(receitaEfetivaLote(l1, efetivoR)).toBe(276 * 60)
    expect(receitaEfetivaLote(cortesia, efetivoR)).toBe(0)
    expect(receitaEfetivaLote({ ...l1, somenteOtimista: true }, efetivoR)).toBe(0)
  })

  it('sem cupom, efetiva = tabela (nada muda para quem não usa desconto)', () => {
    const evento = eventoCom({ cupom: 0 })
    const r = computeCenario(evento, 'realista')
    const efetivoR = descontoEfetivoPct(evento, r.pagos)
    expect(receitaEfetivaLote(evento.lotes[0], efetivoR)).toBe(275 * 60)
  })
})
