import { describe, it, expect } from 'vitest'
import { computeCenarios } from './calc.js'
import { ajusteCustoValor, ajusteCustoTexto } from './dre.js'
import { DASH, fmtBRL2 } from './format.js'

// Evento do print do Marco (19/07/2026): custos 133.200, contingência 3,5%
// (= 4.662), ajuste de custos +5% / 0% / +3%. O DRE mostrava 137.862 somando
// as linhas visíveis e 144.755 no "Custo total do cenário" — o buraco que a
// linha nova fecha.
const eventoDoPrint = {
  lotes: [{ id: 'l1', nome: 'Único', valor: 100, quantidade: 1000 }],
  taxaBilheteria: 0,
  cashbackPct: 0,
  contingenciaPct: 3.5,
  categorias: [{ id: 'c1', nome: 'Produção', itens: [{ id: 'i1', nome: 'Tudo', estimado: 133200 }] }],
  cenariosConfig: {
    pessimista: { custoPct: 5 },
    realista: { custoPct: 0 },
    otimista: { custoPct: 3 },
  },
}

describe('linha do ajuste de custos no DRE', () => {
  const c = computeCenarios(eventoDoPrint)

  it('reproduz os números do print do Marco (base 137.862)', () => {
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(c[k].custoItens).toBe(133200)
      expect(c[k].contingencia).toBeCloseTo(4662, 6)
    }
    expect(c.pessimista.custoTotal).toBeCloseTo(144755.1, 6)
    expect(c.realista.custoTotal).toBeCloseTo(137862, 6)
    expect(c.otimista.custoTotal).toBeCloseTo(141997.86, 6)
  })

  it('mostra o valor do ajuste em R$ por cenário', () => {
    expect(ajusteCustoValor(c.pessimista)).toBeCloseTo(6893.1, 6)
    expect(ajusteCustoValor(c.realista)).toBeCloseTo(0, 9)
    expect(ajusteCustoValor(c.otimista)).toBeCloseTo(4135.86, 6)
  })

  // O CRITÉRIO DE ACEITE da sessão: a soma do que está NA TELA bate com o
  // "Custo total do cenário" nos três cenários. Sem a linha nova, pessimista
  // e otimista não fechavam.
  it('a soma das linhas exibidas fecha com o Custo total nos três cenários', () => {
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const s = c[k]
      const somaVisivel = s.custoItens + s.contingencia + ajusteCustoValor(s)
      expect(somaVisivel).toBeCloseTo(s.custoTotal, 9)
    }
  })

  // fmtBRL usa espaço NÃO-QUEBRÁVEL depois do "R$" (Intl pt-BR); as asserções
  // montam o esperado pelo próprio formatador para não travar num caractere
  // invisível.
  it('texto da célula: sinal, valor e % de origem', () => {
    expect(ajusteCustoTexto(c.pessimista)).toBe(`+ ${fmtBRL2(6893.1)} (+5%)`)
    expect(ajusteCustoTexto(c.otimista)).toBe(`+ ${fmtBRL2(4135.86)} (+3%)`)
  })

  it('ajuste zero vira travessão (coerente com o resto do DRE)', () => {
    expect(ajusteCustoTexto(c.realista)).toBe(DASH)
  })

  it('ajuste NEGATIVO aparece como dedução e ainda fecha a coluna', () => {
    const ev = {
      ...eventoDoPrint,
      cenariosConfig: { ...eventoDoPrint.cenariosConfig, otimista: { custoPct: -5 } },
    }
    const o = computeCenarios(ev).otimista
    expect(ajusteCustoValor(o)).toBeCloseTo(-6893.1, 6)
    expect(ajusteCustoTexto(o)).toBe(`− ${fmtBRL2(6893.1)} (−5%)`)
    expect(o.custoItens + o.contingencia + ajusteCustoValor(o)).toBeCloseTo(o.custoTotal, 9)
  })

  // Prova de que a diferença é EXATAMENTE o ajuste e não engloba mais nada:
  // bate com a conta independente custoBase × ajustePct/100.
  it('a diferença é exatamente o ajuste (confere com a conta independente)', () => {
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const s = c[k]
      const esperado = (s.custoItens + s.contingencia) * (s.ajustePct / 100)
      expect(ajusteCustoValor(s)).toBeCloseTo(esperado, 6)
    }
  })

  it('evento sem cenariosConfig usa os defaults e continua fechando', () => {
    const semCfg = computeCenarios({ ...eventoDoPrint, cenariosConfig: undefined })
    expect(semCfg.pessimista.ajustePct).toBe(10)
    expect(semCfg.otimista.ajustePct).toBe(-5)
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const s = semCfg[k]
      expect(s.custoItens + s.contingencia + ajusteCustoValor(s)).toBeCloseTo(s.custoTotal, 9)
    }
  })
})
