// TRAVA DOS PERCENTUAIS — evidência e especificação aprovada
// (§9.5 do laudo externo + item 2 da fila; APROVADO PELO MARCO em 20/07/2026:
// "travar na porta" e "contingência 0..100", com a conta apresentada antes).
//
// A decisão, em uma linha: cupom, taxa, cashback, contingência e a fração do
// cupom no modo % vivem em 0..100. A trava é NA PORTA — o campo recusa com
// aviso (ui.jsx, prop `faixa`) e a migração descarta o herdado absurdo
// (migracao.js, pctNaFaixaOuVazio → '' = "não informado"). O calc.js segue
// INTOCADO: o primeiro bloco abaixo fotografa que a conta continua computando
// o que recebe — a garantia de que nada absurdo chega até ela mora nos dois
// cadeados da porta, provados no segundo bloco.
//
// Antes da trava (evidência medida em 20/07/2026, festa estilo Brisa de
// 1.000 × R$ 100): cupom 150% → receita NEGATIVA (−R$ 47.500); cupom −20% →
// festa INFLADA (+R$ 19.000); taxa −20% → +R$ 30.000; nos 3 backups em disco
// (4 eventos): ZERO valores fora da faixa — nenhum número real mudou.

import { describe, expect, it } from 'vitest'
import { bilheteria, contingencia, descontoEfetivoPct } from './calc.js'
import { migrarEvento } from './migracao.js'
import { formaAjustes, novoEventoDoTipo } from './premissas.js'

const LOTES = [{ id: 'l1', nome: 'Único', valor: 100 }]
const QTDS = { l1: 1000 }

const sa = bilheteria(LOTES, QTDS, 10, 5, 0)

describe('calc.js intocado — a conta computa o que recebe (a trava é na porta)', () => {
  it('sanidade: taxa 10 + cashback 5 sem cupom → líquida R$ 95.000', () => {
    expect(sa.bruta).toBe(100_000)
    expect(sa.liquida).toBe(95_000)
  })

  it('cupom 150% direto na conta → bruta R$ -50.000 (por isso a porta recusa)', () => {
    const b = bilheteria(LOTES, QTDS, 10, 5, 150)
    expect(b.bruta).toBe(-50_000)
    expect(b.liquida).toBe(-47_500)
  })

  it('cupom -20% direto na conta → líquida inflada R$ 114.000', () => {
    const b = bilheteria(LOTES, QTDS, 10, 5, -20)
    expect(b.bruta).toBe(120_000)
    expect(b.liquida).toBe(114_000)
  })

  it('taxa -20% direto na conta → líquida R$ 125.000 (+R$ 30.000 sobre a sã)', () => {
    const b = bilheteria(LOTES, QTDS, -20, 5, 0)
    expect(b.taxa).toBe(-20_000)
    expect(b.liquida).toBe(125_000)
  })

  it('taxa 150% direto na conta → líquida R$ -45.000', () => {
    const b = bilheteria(LOTES, QTDS, 150, 5, 0)
    expect(b.liquida).toBe(-45_000)
  })

  it('cashback 150% direto na conta → líquida R$ 240.000 (2,4× a bruta)', () => {
    const b = bilheteria(LOTES, QTDS, 10, 150, 0)
    expect(b.liquida).toBe(240_000)
  })

  it('cashback -50% direto na conta → líquida R$ 40.000', () => {
    const b = bilheteria(LOTES, QTDS, 10, -50, 0)
    expect(b.liquida).toBe(40_000)
  })

  it('contingência negativa direta na conta → -R$ 2.000 (por isso a porta recusa)', () => {
    expect(contingencia(20_000, -10)).toBe(-2_000)
  })

  it('fração 150 no modo % direta na conta → efetivo 15% (por isso a porta recusa)', () => {
    const ev = { descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 150 }
    expect(descontoEfetivoPct(ev, 1000)).toBe(15)
  })
})

describe('o cadeado da migração — fora da faixa vira "não informado", nunca conta', () => {
  it('cupom 150 e taxa -20 herdados de backup viram "" na migração', () => {
    const m = migrarEvento({ id: 'e1', nome: 'Teste', descontoMedioPct: 150, taxaBilheteria: -20 })
    expect(m.descontoMedioPct).toBe('')
    expect(m.taxaBilheteria).toBe('')
  })

  it("taxa 'abc' (o S2 do BACKLOG) vira '' — deixa de fingir que é um número guardado", () => {
    const m = migrarEvento({ id: 'e1', nome: 'Teste', taxaBilheteria: 'abc' })
    expect(m.taxaBilheteria).toBe('')
    // e o efeito na conta é o MESMO de antes ('abc' já era coagido a 0 por
    // num()): nenhum número muda — só a tela deixa de exibir lixo no campo.
    expect(bilheteria(LOTES, QTDS, m.taxaBilheteria, 5, 0).taxa).toBe(0)
  })

  it('cashback 150 e contingência -10 herdados viram ""', () => {
    const m = migrarEvento({ id: 'e1', nome: 'Teste', cashbackPct: 150, contingenciaPct: -10 })
    expect(m.cashbackPct).toBe('')
    expect(m.contingenciaPct).toBe('')
  })

  it('valores VÁLIDOS passam byte a byte — número e string numérica, 0 e 100 inclusos', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      taxaBilheteria: 10,
      cashbackPct: '4.5', // string numérica de backup editado à mão
      contingenciaPct: 0,
      descontoMedioPct: 100,
    })
    expect(m.taxaBilheteria).toBe(10)
    expect(m.cashbackPct).toBe('4.5')
    expect(m.contingenciaPct).toBe(0)
    expect(m.descontoMedioPct).toBe(100)
  })

  it('fração do cupom: 150 no modo % vira ""; 150 no modo nº FICA (é contagem de ingressos)', () => {
    const pct = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      descontoIngressosModo: 'pct',
      descontoIngressosValor: 150,
    })
    expect(pct.descontoIngressosValor).toBe('')
    const numero = migrarEvento({
      id: 'e2',
      nome: 'Teste',
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 150,
    })
    expect(numero.descontoIngressosValor).toBe(150)
  })
})
