// AS DUAS TELAS DIZEM A MESMA COISA — o cadeado do S1 de 20/07/2026.
//
// O defeito: a faixa da aba Custos (confrontoCustos.js) e a tabela da aba
// Fechamento (fechamento.js) comparavam estimado com realizado de jeitos
// DIFERENTES. Nos números reais do Marco (Marfim 09/05) os Custos diziam
// "+R$ 3.147 acima" em VERMELHO e o Fechamento dizia "−R$ 733 (−0,2%)" em
// VERDE: sinal oposto, cor oposta, mesma grandeza, mesmo evento, mesmo dia.
//
// O conserto foi de FONTE, não de fórmula: o Fechamento passou a beber de
// confrontoCustos.js. Este arquivo é a prova de que ele continua bebendo — não
// testa uma implementação contra a outra por acaso, testa a PROMESSA: para
// qualquer evento, o número, o sinal, a cor e a frase que uma tela mostra são
// os mesmos que a outra mostra.

import { describe, it, expect } from 'vitest'
import { confrontoCustos, textoDelta, sinalDelta } from './confrontoCustos.js'
import { fechamentoCustos } from './fechamento.js'
import { fmtBRL } from './format.js'

const item = (estimado, realizado) => ({ estimado, realizado })

// Os cenários variados que o conserto tem de aguentar.
const CENARIOS = {
  'nenhum realizado (evento ainda aberto)': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000), item(500)] },
    { id: 'art', nome: 'Artístico', itens: [item(8000)] },
  ],
  'metade dos itens realizados': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 1300), item(500)] },
    { id: 'art', nome: 'Artístico', itens: [item(8000, 7000), item(2000)] },
  ],
  'todos os itens realizados': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 1300), item(500, 480)] },
    { id: 'art', nome: 'Artístico', itens: [item(8000, 7000)] },
  ],
  'economia limpa (tudo abaixo do orçado)': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 800), item(500, 400)] },
  ],
  'estouro limpo (tudo acima do orçado)': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 1200), item(500, 700)] },
  ],
  'item com realizado ZERO (não conta como preenchido)': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 0), item(500, 600)] },
  ],
  'item marcado "custou zero" (conta como realizado 0)': [
    // Marco, 20/07/2026: o item marcado passa a CONTAR (temRealizado true),
    // vale 0 nos dois lados e o invariante das duas telas continua fechando.
    // Se a régra 3.2 tivesse sido escolhida (marcação vence realizado digitado),
    // este é o cenário em que o cadeado gritaria — por isso ele existe aqui.
    { id: 'aeb', nome: 'A&B', itens: [{ estimado: 8000, custouZero: true }, item(500, 600)] },
  ],
  'item marcado "custou zero" com realizado 0 explícito': [
    { id: 'art', nome: 'Artístico', itens: [{ estimado: 6000, realizado: 0, custouZero: true }, item(1000, 1300)] },
  ],
  // Marco, 20/07/2026 (achado da verificação hostil): realizado NEGATIVO não é
  // "vazio nem 0" (P1), então a marca "custou zero" fica IGNORADA e o item cai
  // no estimado nos DOIS lados — as telas não podem divergir. Sem esta trava, a
  // projeção ia a 0 e o Fechamento somava −500: a fronteira do S1 reaberta.
  'item marcado "custou zero" com realizado NEGATIVO (marca ignorada)': [
    { id: 'aeb', nome: 'A&B', itens: [{ estimado: 1000, realizado: -500, custouZero: true }, item(500, 600)] },
  ],
  'item com estimado ZERO e realizado cheio': [
    { id: 'aeb', nome: 'A&B', itens: [item(0, 900), item(500, 500)] },
  ],
  'categoria vazia no meio': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 1300)] },
    { id: 'vazia', nome: 'Vazia', itens: [] },
    { id: 'semItens', nome: 'Sem lista de itens' },
  ],
  'delta exatamente zero (realizado = estimado)': [
    { id: 'aeb', nome: 'A&B', itens: [item(1000, 1000), item(500)] },
  ],
  'centavos (nada de NaN nem de arredondamento torto)': [
    { id: 'aeb', nome: 'A&B', itens: [item('1234.56', '1234.57'), item('', undefined)] },
  ],
  'o caso real do Marco — Marfim 09/05': [
    { id: 'aeb', nome: 'A&B', itens: [item(331240, 334387), item(3880)] },
  ],
}

describe('fonte única: aba Custos e aba Fechamento não podem discordar', () => {
  for (const [nome, categorias] of Object.entries(CENARIOS)) {
    describe(nome, () => {
      const custos = confrontoCustos(categorias) // o que a aba Custos lê
      const fech = fechamentoCustos(categorias) // o que a aba Fechamento lê

      it('o TOTAL é o mesmo número, com o mesmo sinal', () => {
        expect(fech.desvioTotal).toBe(custos.delta)
        expect(fech.totalRealizado).toBe(custos.realizado)
        expect(fech.totalEstimadoComparavel).toBe(custos.estimadoComparavel)
        expect(fech.totalEstimado).toBe(custos.estimadoTodos)
        expect(fech.algumRealizado).toBe(custos.algum)
        expect(fech.desvioTotalPct).toBe(custos.deltaPct)
      })

      it('a COR e a FRASE do total são as mesmas nas duas telas', () => {
        // Custos escreve o delta por extenso; Fechamento pinta a célula.
        // As duas leem o MESMO delta, então o julgamento tem de bater.
        expect(sinalDelta(fech.desvioTotal)).toBe(sinalDelta(custos.delta))
        expect(textoDelta(fech.desvioTotal, fmtBRL)).toBe(textoDelta(custos.delta, fmtBRL))
      })

      it('cada CATEGORIA do Fechamento bate com o confronto da mesma categoria', () => {
        expect(fech.porCategoria).toHaveLength(custos.porCategoria.length)
        fech.porCategoria.forEach((linha, i) => {
          const c = custos.porCategoria[i]
          expect(linha.id).toBe(c.id)
          expect(linha.desvio).toBe(c.delta)
          expect(linha.realizado).toBe(c.realizado)
          expect(linha.estimadoComparavel).toBe(c.estimadoComparavel)
          expect(linha.estouro).toBe(c.estouro)
          expect(sinalDelta(linha.desvio)).toBe(sinalDelta(c.delta))
        })
      })

      it('a soma das categorias fecha com o total (a tela não promete soma que não entrega)', () => {
        const somaDesvios = fech.porCategoria.reduce((s, c) => s + (c.desvio ?? 0), 0)
        expect(somaDesvios).toBeCloseTo(fech.desvioTotal ?? 0, 6)
        const somaReal = fech.porCategoria.reduce((s, c) => s + c.realizado, 0)
        expect(somaReal).toBeCloseTo(fech.totalRealizado, 6)
      })

      it('a linha exibida fecha: estimado − realizado é o desvio impresso ao lado', () => {
        // A régua de quem soma com o dedo na reunião. Só vale onde há
        // comparação; sem realizado nenhum a tela imprime "—" e não promete
        // subtração nenhuma.
        for (const linha of [...fech.porCategoria, { ...fech, estimadoComparavel: fech.totalEstimadoComparavel, realizado: fech.totalRealizado, desvio: fech.desvioTotal }]) {
          if (!linha.temRealizado) {
            expect(linha.desvio).toBeNull()
            continue
          }
          expect(linha.realizado - linha.estimadoComparavel).toBeCloseTo(linha.desvio, 6)
        }
      })

      it('nenhum número vira NaN', () => {
        for (const v of [fech.desvioTotal, fech.totalRealizado, fech.totalEstimado, fech.totalEstimadoComparavel]) {
          expect(Number.isNaN(v)).toBe(false)
        }
      })
    })
  }

  it('o caso do Marco: as duas telas agora dizem ESTOURO, e não uma cada coisa', () => {
    const categorias = CENARIOS['o caso real do Marco — Marfim 09/05']
    const custos = confrontoCustos(categorias)
    const fech = fechamentoCustos(categorias)
    // A verdade: estourou 3.147 no que já fechou.
    expect(custos.delta).toBe(3147)
    expect(fech.desvioTotal).toBe(3147)
    // E o −733 da conta antiga (realizado de quem tem × estimado de TODOS) não
    // é mais mostrado por tela nenhuma.
    expect(fech.totalRealizado - fech.totalEstimado).toBe(-733)
    expect(fech.desvioTotal).not.toBe(-733)
    expect(sinalDelta(fech.desvioTotal)).toBe('estouro')
    expect(sinalDelta(custos.delta)).toBe('estouro')
  })

  it('sem nenhum realizado, NENHUMA das duas telas inventa desvio', () => {
    const categorias = CENARIOS['nenhum realizado (evento ainda aberto)']
    expect(confrontoCustos(categorias).delta).toBeNull()
    expect(fechamentoCustos(categorias).desvioTotal).toBeNull()
    expect(fechamentoCustos(categorias).desvioTotalPct).toBeNull()
    // E a coluna "Estimado" volta a ser o orçamento — não some para zero.
    expect(fechamentoCustos(categorias).totalEstimadoComparavel).toBe(9500)
  })

  it('realizado ZERO não vira comparação (a régua de valorConsiderado, em toda tela)', () => {
    const f = fechamentoCustos(CENARIOS['item com realizado ZERO (não conta como preenchido)'])
    expect(f.nComRealizado).toBe(1)
    expect(f.totalEstimadoComparavel).toBe(500) // só o item de 500, não os 1000
    expect(f.desvioTotal).toBe(100)
  })
})
