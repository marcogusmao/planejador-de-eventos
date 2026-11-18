// A regra "o que o leitor subtrai tem de fechar" (Marco, 07/08/2026).
//
// A peça que morde nesta suíte não é o exemplo bonito: é a VARREDURA que lê os
// números do jeito que o Marco lê — pegando o texto impresso e subtraindo — e
// exige que o resultado seja idêntico ao lucro impresso. Ela roda sobre valores
// com meio real exato, dos dois sinais, que é onde o defeito morava.

import { describe, it, expect } from 'vitest'
import { arredondadoComoAMoeda, lucroQueFecha, resultadoQueFecha } from './exibicaoQueFecha.js'
import { fmtBRL } from './format.js'

/** O que o Marco faz na folha: lê o número impresso e volta a ser número. */
const comoOMarcoLe = (v) => {
  const t = fmtBRL(v)
  const n = Number(t.replace(/[^\d,-]/g, '').replace(',', '.'))
  return t.trim().startsWith('-') || t.includes('-') ? -Math.abs(n) : n
}

describe('arredondadoComoAMoeda — a MESMA régua do formatador', () => {
  // Se as duas réguas discordassem, a reconciliação erraria sozinha: o módulo
  // fecharia a conta sobre um número que a tela não imprime.
  it('imprime igual ao valor original, em 4.000 valores com meio real exato', () => {
    for (let i = -1000; i <= 1000; i += 1) {
      for (const meio of [0.5, -0.5]) {
        const v = i + meio
        expect(fmtBRL(arredondadoComoAMoeda(v)), `valor ${v}`).toBe(fmtBRL(v))
      }
    }
  })

  it('meio para LONGE do zero, nos dois sinais (Math.round erraria o negativo)', () => {
    expect(arredondadoComoAMoeda(0.5)).toBe(1)
    expect(arredondadoComoAMoeda(-0.5)).toBe(-1)
    expect(Math.round(-0.5)).toBe(-0) // a régua que NÃO serve, para o contraste ficar escrito
    expect(arredondadoComoAMoeda(2.4)).toBe(2)
    expect(arredondadoComoAMoeda(-2.6)).toBe(-3)
  })

  it('lixo e ausente não explodem — viram zero, como em toda porta da casa', () => {
    expect(arredondadoComoAMoeda('')).toBe(0)
    expect(arredondadoComoAMoeda(undefined)).toBe(0)
    expect(arredondadoComoAMoeda('abc')).toBe(0)
  })
})

describe('lucroQueFecha — o número impresso bate com a subtração impressa', () => {
  it('o exemplo que o Marco viu: R$ 100.003 − R$ 40.001 fecha em R$ 60.002', () => {
    const s = { receitaTotal: 100002.5, custoTotal: 40000.87 }
    expect(fmtBRL(s.receitaTotal)).toBe(fmtBRL(100003))
    expect(fmtBRL(s.custoTotal)).toBe(fmtBRL(40001))
    // o lucro EXATO seria 60.001,63 e imprimiria R$ 60.002 — mas o caso que
    // interessa é o par que NÃO fechava; a varredura abaixo cobre todos.
    expect(fmtBRL(lucroQueFecha(s))).toBe(fmtBRL(100003 - 40001))
  })

  it('VARREDURA: em 2.000 cenários, o impresso sempre fecha com a subtração impressa', () => {
    let houveDivergenciaDoExato = 0
    for (let i = 0; i < 2000; i += 1) {
      const s = {
        receitaTotal: 100000 + i * 0.5 + 0.5,
        custoTotal: 40000 + i * 0.37,
        imposto: i % 3 === 0 ? { valor: 1000 + i * 0.11 } : null,
      }
      const lido =
        comoOMarcoLe(s.receitaTotal) - comoOMarcoLe(s.imposto?.valor) - comoOMarcoLe(s.custoTotal)
      expect(comoOMarcoLe(lucroQueFecha(s)), `cenário ${i}`).toBe(lido)
      const exato = s.receitaTotal - (s.imposto?.valor || 0) - s.custoTotal
      if (fmtBRL(exato) !== fmtBRL(lucroQueFecha(s))) houveDivergenciaDoExato += 1
    }
    // O risco que o Marco aceitou, escrito como número e não como promessa: o
    // impresso difere do exato em alguns cenários — é o preço de fechar.
    expect(houveDivergenciaDoExato).toBeGreaterThan(0)
  })

  it('sem imposto o termo simplesmente não pesa', () => {
    expect(lucroQueFecha({ receitaTotal: 100, custoTotal: 30 })).toBe(70)
    expect(lucroQueFecha({ receitaTotal: 100, custoTotal: 30, imposto: null })).toBe(70)
  })

  // O defeito da PRIMEIRA versão deste módulo, virado teste: `cenario.imposto` é
  // um OBJETO. Lê-lo como número dá zero, e o lucro sairia sem descontar o
  // imposto — R$ 9.200 onde a tela imprime R$ 7.900.
  it('o imposto sai de `impostoValor`, nunca de `cenario.imposto` lido como número', () => {
    const c = { receitaTotal: 12500, custoTotal: 3300, imposto: { valor: 1300 } }
    expect(lucroQueFecha(c)).toBe(7900)
    expect(Number(c.imposto)).toBeNaN() // a leitura ingênua que não serve
  })

  it('prejuízo fecha igual — o sinal não é caso especial', () => {
    const s = { receitaTotal: 40000.5, custoTotal: 100000.5 }
    const lido = comoOMarcoLe(s.receitaTotal) - comoOMarcoLe(s.custoTotal)
    expect(comoOMarcoLe(lucroQueFecha(s))).toBe(lido)
    expect(lucroQueFecha(s)).toBeLessThan(0)
  })

  it('entrada vazia não explode', () => {
    expect(lucroQueFecha()).toBe(0)
    expect(lucroQueFecha({})).toBe(0)
  })
})

describe('resultadoQueFecha — o card do evento FECHADO', () => {
  it('receita real menos custos considerados fecha com o resultado impresso', () => {
    const f = { receita: 305347.5, custos: 111458.5 }
    const lido = comoOMarcoLe(f.receita) - comoOMarcoLe(f.custos)
    expect(comoOMarcoLe(resultadoQueFecha(f))).toBe(lido)
  })
})
