import { describe, it, expect } from 'vitest'
import { REFERENCIAS_POR_FAIXA, dividirReferenciasEmFaixas } from './faixasMatrizRelatorio.js'
describe('faixas da matriz preservam referências literalmente', () => {
  it.each(Array.from({length:10},(_,n)=>n))('divide %i referências sem omitir, duplicar ou alterar', n => {
    const entrada=Object.freeze(Array.from({length:n},(_,i)=>Object.freeze({id:`z-${n-i}`,zero:0,negativo:-3,ausente:null,marcador:'ilegível',desconhecido:i})))
    const faixas=dividirReferenciasEmFaixas(entrada)
    expect(REFERENCIAS_POR_FAIXA).toBe(4)
    expect(faixas.map(f=>f.length)).toEqual(Array.from({length:Math.ceil(n/4)},(_,i)=>Math.min(4,n-i*4)))
    expect(faixas.flat()).toEqual(entrada)
    faixas.flat().forEach((b,i)=>expect(b).toBe(entrada[i]))
    expect(faixas).not.toBe(entrada)
    faixas.forEach(f=>expect(f).not.toBe(entrada))
  })
})
