import { describe, it, expect } from 'vitest'
import { linhasParaRotulosProximos } from './rotulosGrafico.js'

describe('linhasParaRotulosProximos — empilha rótulos próximos sem sobrepor', () => {
  it('sem rótulos → sem linhas', () => {
    expect(linhasParaRotulosProximos([], 72)).toEqual([])
  })

  it('rótulo único fica na linha 0', () => {
    expect(linhasParaRotulosProximos([100], 72)).toEqual([0])
  })

  it('dois rótulos LONGE (>= gap) ficam os dois na linha 0 — caso comum, desenho de antes', () => {
    // 100 e 300 distam 200px, gap 72 → nenhuma colisão
    expect(linhasParaRotulosProximos([100, 300], 72)).toEqual([0, 0])
  })

  it('dois rótulos PRÓXIMOS (< gap) empilham: o segundo desce para a linha 1 (o bug do "hoje" × "início de vendas")', () => {
    // 100 e 140 distam 40px < 72 → o segundo empilha
    expect(linhasParaRotulosProximos([100, 140], 72)).toEqual([0, 1])
  })

  it('exatamente no limite do gap não é colisão (distância == gap fica na mesma linha)', () => {
    // 100 e 172 distam 72 == gap → NÃO colide (a régua é "< gap")
    expect(linhasParaRotulosProximos([100, 172], 72)).toEqual([0, 0])
  })

  it('três rótulos: dois próximos empilham e o terceiro, longe do primeiro, volta para a linha 0', () => {
    // 10 e 40 colidem (30<72) → [0,1]; 200 dista 190 do último da linha 0 (10)
    // → volta para a linha 0
    expect(linhasParaRotulosProximos([10, 40, 200], 72)).toEqual([0, 1, 0])
  })

  it('três rótulos todos apertados ocupam três linhas distintas', () => {
    // 10, 30, 50: 30-10=20<72 → linha1; 50 dista 40 de 10 (linha0) e 20 de 30
    // (linha1), ambos < 72 → linha2
    expect(linhasParaRotulosProximos([10, 30, 50], 72)).toEqual([0, 1, 2])
  })

  it('a comparação é contra o ÚLTIMO da linha, não o primeiro — cadeia larga não empilha à toa', () => {
    // 0, 60, 120: 60-0=60<72 → 60 vai p/ linha1; 120-0=120>=72 → linha0 livre
    expect(linhasParaRotulosProximos([0, 60, 120], 72)).toEqual([0, 1, 0])
  })
})
