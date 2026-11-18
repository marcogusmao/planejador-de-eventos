// TRAVA — um custo corrompido continua GRITANDO no card do Fechamento, em vez de
// virar R$ 0 e anunciar lucro.
//
// Achado da verificação adversarial em 26/07/2026, ANTES de o diff ir ao Marco.
// A frente que fez as quatro telas concordarem passou a somar os custos do card
// com a régua de centavos — e `somaCentavos` multiplica por 100 antes de
// arredondar, então um item de 1 seguido de 308 zeros (valor que a porta do
// backup ainda deixa entrar) estoura o double, vira `Infinity`, e `num()`
// normaliza para 0.
//
// MEDIDO numa festa com bilheteria realizada de R$ 20.000:
//     sem a guarda .... custo R$ 0     e resultado R$ 19.000 de LUCRO, em verde
//     com a guarda .... custo Infinity e resultado -Infinity
//
// Trocar uma falha escancarada por um lucro falso de aparência normal é
// exatamente o pior defeito que este app pode ter. `calc.js` já tinha esta
// guarda; o card do Fechamento ficou sem ela na mesma troca.
import { describe, it, expect } from 'vitest'
import { resultadoRealizado } from './fechamento.js'
import { computeCenarios } from './calc.js'
import { novoEvento, novoItem } from './defaults.js'

const festaComCustoCorrompido = (extra = {}) => {
  const e = novoEvento('festa com item corrompido')
  e.publicoEstimado = 200
  e.contingenciaPct = 0
  e.categorias = novoEvento('t').categorias.map((c) =>
    c.id === 'aeb'
      ? { ...c, itens: [novoItem({ servico: 'Som', estimado: 1e308, status: 'FECHADO' })] }
      : { ...c, itens: [] }
  )
  e.receitaRealizada = { bilheteria: 20000, bar: '' }
  return { ...e, ...extra }
}

describe('card do Fechamento com custo corrompido (26/07/2026)', () => {
  it('o custo NÃO vira R$ 0 — o absurdo continua no número', () => {
    const e = festaComCustoCorrompido()
    const r = resultadoRealizado(e, computeCenarios(e).realista)
    expect(r.custos).not.toBe(0)
    expect(Number.isFinite(r.custos)).toBe(false)
  })

  it('o card NÃO anuncia lucro numa festa cujo custo estourou', () => {
    const e = festaComCustoCorrompido()
    const r = resultadoRealizado(e, computeCenarios(e).realista)
    expect(r.resultado).not.toBeGreaterThan(0)
  })

  it('com bar lançado, mesma coisa — o bar não "salva" o número', () => {
    const e = festaComCustoCorrompido()
    e.receitaRealizada = { bilheteria: 20000, bar: 2000 }
    const r = resultadoRealizado(e, computeCenarios(e).realista)
    expect(Number.isFinite(r.custos)).toBe(false)
    expect(r.resultado).not.toBeGreaterThan(0)
  })

  it('festa NORMAL segue somando pela régua de centavos (a guarda não atrapalha)', () => {
    const e = novoEvento('festa normal')
    e.publicoEstimado = 200
    e.contingenciaPct = 0
    e.categorias = novoEvento('t').categorias.map((c) =>
      c.id === 'aeb'
        ? {
            ...c,
            itens: [
              novoItem({ servico: 'A', estimado: 7800, realizado: 7800, status: 'FECHADO' }),
              novoItem({ servico: 'B', estimado: 7525.47, status: 'FECHADO' }),
            ],
          }
        : { ...c, itens: [] }
    )
    e.receitaRealizada = { bilheteria: 20000, bar: '' }
    const r = resultadoRealizado(e, computeCenarios(e).realista)
    expect(Number.isFinite(r.custos)).toBe(true)
    // 7.800,00 + 7.525,47 — exato ao centavo, sem o cisco de ponto flutuante.
    expect(r.custos).toBe(15325.47)
  })
})
