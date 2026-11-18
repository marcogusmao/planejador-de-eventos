import { describe, it, expect } from 'vitest';
import { chaveOrigemFinanceiro, inspecionarOrigensFinanceiro } from './origensFinanceiro.js';
describe('origens financeiras recuperáveis', () => {
  it('separa eventos e IDs mesmo com nomes iguais', () => {
    expect(chaveOrigemFinanceiro({
      eventoId: 1,
      categoriaId: 10
    })).not.toBe(chaveOrigemFinanceiro({
      eventoId: 2,
      categoriaId: 10
    }));
  });
  it('preserva bruto inválido sem atribuir identidade', () => {
    const cru = {
      versao: 3,
      origens: [{}]
    };
    const antes = JSON.stringify(cru);
    expect(inspecionarOrigensFinanceiro(cru).tipo).toBe('invalido');
    expect(JSON.stringify(cru)).toBe(antes);
  });
  it('recusa origem repetida e aceita carimbo antigo sem inventar evento', () => {
    const o = {
      eventoId: 1,
      categoriaId: 10,
      categoria: 'Equipe',
      valor: 5,
      em: '2026-10-05T12:00:00Z'
    };
    expect(inspecionarOrigensFinanceiro({
      versao: 2,
      valor: 10,
      em: o.em,
      origens: [o, o]
    }).tipo).toBe('invalido');
    expect(inspecionarOrigensFinanceiro({
      categoria: 'Equipe',
      valor: 5,
      em: o.em
    })).toEqual({
      tipo: 'legado',
      origens: [],
      problemas: []
    });
  });
});

import { moedaEmCentavosValida } from './origensFinanceiro.js'
it('centavos toleram só ruído float e recusam frações reais',()=>{
  for(const v of [23567.96,0.1+0.2,Array.from({length:1000},()=>.01).reduce((s,v)=>s+v,0),0,-1])expect(moedaEmCentavosValida(v)).toBe(true)
  for(const v of [1.005,1.015,1.025,.001,Infinity,NaN,'1',null,Number.MAX_SAFE_INTEGER])expect(moedaEmCentavosValida(v)).toBe(false)
})
it('origem v2 com fração é preservada e não indexada',()=>{
  const origem={eventoId:71,categoriaId:10,categoria:'Equipe',valor:1.005,em:'2026-10-05T12:00:00.000Z'}
  const bruto={versao:2,valor:1.005,em:origem.em,origens:[origem]};const antes=JSON.stringify(bruto)
  const inspecao=inspecionarOrigensFinanceiro(bruto)
  expect(inspecao.tipo).toBe('invalido');expect(inspecao.origens).toEqual([]);expect(inspecao.problemas.join()).toMatch(/fração de centavo/);expect(JSON.stringify(bruto)).toBe(antes)
})
