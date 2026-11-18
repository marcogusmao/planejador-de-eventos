// Contrato vigente: zero implícito usa estimado; custouZero:true registra cortesia.
// A proposta histórica de aceitar zero implícito foi superada pela marca explícita.
import { describe, it, expect } from 'vitest'
import { valorConsiderado, custosPorCategoria, contingencia } from './calc.js'

// Caso da vida real: o DJ foi orçado em 8.000 e no fim tocou de graça (permuta).
const DJ_CORTESIA = { servico: 'DJ', estimado: 8000, realizado: 0 }

describe('HOJE — realizado 0 é lido como "não preenchido"', () => {
  it('valorConsiderado volta ao estimado quando o realizado é 0', () => {
    expect(valorConsiderado(DJ_CORTESIA)).toBe(8000)
  })

  it('0 digitado como texto ("0") também é ignorado', () => {
    expect(valorConsiderado({ estimado: 8000, realizado: '0' })).toBe(8000)
  })

  it('zero não confirmado mantém orçamento de 23392', () => {
    const categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          { servico: 'Gelo', estimado: 500, realizado: 520 },
          { servico: 'Bebidas', estimado: 28050, realizado: 14872 },
        ],
      },
      { id: 'artistico', nome: 'Artístico', itens: [DJ_CORTESIA] },
    ]
    const c = custosPorCategoria(categorias)
    const gastoReal = 520 + 14872 + 0
    expect(c.totalConsiderado).toBe(520 + 14872 + 8000) // 23.392
    expect(c.totalConsiderado - gastoReal).toBe(8000) // 8.000 de estimado sem marca
    // A contingência segue o considerado.
    expect(contingencia(c.totalConsiderado, 10)).toBeCloseTo(2339.2, 6)
  })

  it('zero sem marca continua no estimado; marca explícita permite custou zero', () => {
    for (const r of [0, '0', '0.00', -0]) {
      expect(valorConsiderado({ estimado: 8000, realizado: r })).toBe(8000)
    }
  })
})

describe('Contrato vigente com marca custouZero', () => {
  it('0 preenchido significa "custou zero"', () => {
    expect(valorConsiderado({ ...DJ_CORTESIA, custouZero: true })).toBe(0)
    expect(valorConsiderado({ estimado: 8000, realizado: '0', custouZero: true })).toBe(0)
  })

  it('vazio, null e undefined seguem sendo "não preenchido" (usa o estimado)', () => {
    expect(valorConsiderado({ estimado: 8000, realizado: '' })).toBe(8000)
    expect(valorConsiderado({ estimado: 8000, realizado: null })).toBe(8000)
    expect(valorConsiderado({ estimado: 8000 })).toBe(8000)
  })

  it('o Custo total previsto passa a bater com o gasto real', () => {
    const categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          { servico: 'Gelo', estimado: 500, realizado: 520 },
          { servico: 'Bebidas', estimado: 28050, realizado: 14872 },
        ],
      },
      { id: 'artistico', nome: 'Artístico', itens: [DJ_CORTESIA] },
    ]
    categorias[1].itens[0] = { ...DJ_CORTESIA, custouZero: true }
    expect(custosPorCategoria(categorias).totalConsiderado).toBe(15392)
  })

  it('evento SEM nenhum realizado zerado não muda um centavo (o golden tem de continuar intacto)', () => {
    const categorias = [
      { id: 'aeb', nome: 'A&B', itens: [{ estimado: 500, realizado: 520 }, { estimado: 900 }] },
    ]
    expect(custosPorCategoria(categorias).totalConsiderado).toBe(1420)
  })
})
