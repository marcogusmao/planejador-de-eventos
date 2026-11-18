// A CERCA da fonte única em receitaLiquida.js.
//
// Até 07/10/2026 `liquidaDeBruta()` era uma CÓPIA da líquida que morava dentro
// de `bilheteria()` em calc.js. Desde a régua do centavo, calc.js chama
// `liquidaDeBruta()` nos dois caminhos (bilheteria e ticket manual). Este
// arquivo continua rodando a MESMA grade de casos pelos dois caminhos e
// exigindo igualdade byte a byte em `taxa`, `cashback` e `liquida`: se alguém
// devolver a calc.js uma conta própria, ESTE teste quebra primeiro.
import { describe, it, expect } from 'vitest'
import { liquidaDeBruta } from './receitaLiquida.js'
import { bilheteria } from './calc.js'

// Grade: as taxas reais da casa (0, 5, 10 e os 23,5 quebrados de um contrato
// ruim), os cashbacks praticados, os dois modos de taxa e brutas que incluem
// zero, um real e valores com centavos.
const TAXAS = [0, 5, 10, 23.5]
const CASHBACKS = [0, 3, 5]
const MODOS = [false, true]
// Cada bruta é construída como 1 lote de `qtd × valor`, para poder passar pelo
// `bilheteria()` de verdade em vez de por um atalho.
const LOTES_DE_BRUTA = [
  { rotulo: '0', qtd: 0, valor: 350 },
  { rotulo: '1', qtd: 1, valor: 1 },
  { rotulo: '35.000', qtd: 100, valor: 350 },
  { rotulo: '12.345,67 (centavos)', qtd: 1, valor: 12345.67 },
  { rotulo: '333 × 33,33', qtd: 333, valor: 33.33 },
  { rotulo: '7 × 99,99', qtd: 7, valor: 99.99 },
]

describe('liquidaDeBruta espelha bilheteria() de calc.js', () => {
  for (const l of LOTES_DE_BRUTA) {
    for (const taxaPct of TAXAS) {
      for (const cashbackPct of CASHBACKS) {
        for (const taxaCliente of MODOS) {
          const nome = `bruta ${l.rotulo} · taxa ${taxaPct}% · cashback ${cashbackPct}% · ${
            taxaCliente ? 'repasse (cliente paga)' : 'taxa paga por nós'
          }`
          it(nome, () => {
            const lotes = [{ id: 'l1', nome: 'Único', valor: l.valor, quantidade: l.qtd }]
            const bil = bilheteria(lotes, { l1: l.qtd }, taxaPct, cashbackPct, 0, taxaCliente)
            const r = liquidaDeBruta(bil.bruta, taxaPct, cashbackPct, taxaCliente)
            expect(r.bruta).toBe(bil.bruta)
            expect(r.taxa).toBe(bil.taxa)
            expect(r.cashback).toBe(bil.cashback)
            expect(r.liquida).toBe(bil.liquida)
          })
        }
      }
    }
  }
})

describe('as duas regras, ditas com número', () => {
  it('taxa paga por nós: 35.000 com taxa 10% e cashback 5% → 33.250', () => {
    expect(liquidaDeBruta(35000, 10, 5, false)).toEqual({
      bruta: 35000,
      taxa: 3500,
      cashback: 1750,
      liquida: 33250,
    })
  })

  it('REPASSE: a mesma bilheteria vira 36.750 — a taxa existe e não desconta', () => {
    expect(liquidaDeBruta(35000, 10, 5, true)).toEqual({
      bruta: 35000,
      taxa: 3500, // continua calculada: é o que o cliente paga por fora
      cashback: 1750,
      liquida: 36750, // 35.000 + 1.750, sem subtrair a taxa
    })
  })

  it('sem taxa nem cashback a líquida é a própria bruta, nos dois modos', () => {
    expect(liquidaDeBruta(35000, 0, 0, false).liquida).toBe(35000)
    expect(liquidaDeBruta(35000, 0, 0, true).liquida).toBe(35000)
  })

  it('entrada vazia/ausente não vira NaN', () => {
    expect(liquidaDeBruta('', '', '', false)).toEqual({
      bruta: 0,
      taxa: 0,
      cashback: 0,
      liquida: 0,
    })
    expect(liquidaDeBruta(1000, undefined, null, false).liquida).toBe(1000)
  })
})
