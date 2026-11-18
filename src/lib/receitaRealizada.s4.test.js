import { describe, it, expect, beforeEach } from 'vitest'
import { novoEvento } from './defaults.js'
import { parseBackup, loadStore, saveStore, montarBackup } from './storage.js'
import { censoNormalizacoes } from './migracao.js'
import { revisarEventoRestaurado } from './revisaoRestauracao.js'
const evento = (bar) => ({...novoEvento('S4 sintético'), id:'s4', receitaRealizada:{bilheteria:20000,bar}})
beforeEach(() => { const dados=new Map(); globalThis.localStorage={getItem:k=>dados.get(k)??null,setItem:(k,v)=>dados.set(k,v),removeItem:k=>dados.delete(k)} })
describe('S4 receita realizada: fronteira de import e leitura preservada',()=>{
 for(const antigo of [true,false]) for(const bar of ['14.200,00',{errado:1},true,[],Infinity]) it(`import ${antigo?'antigo':'atual'} recusa bar ${JSON.stringify(bar)} com original`,()=>{
  const e=evento(bar); const envelope=antigo?{eventos:[e]}:montarBackup({eventos:[e]});
  const texto=JSON.stringify(envelope).replace('"bar":null','"bar":1e999');
  const parsed=parseBackup(texto); expect(parsed.eventos[0].receitaRealizada.bar).toBe('');
  const aviso=censoNormalizacoes(parsed.eventosCrus).find(c=>c.campo==='receitaRealizada.bar');
  expect(aviso).toBeDefined(); expect(aviso.valor).toEqual(bar); expect(aviso.rotulo).toContain(typeof bar==='string'?bar:typeof bar==='object'?JSON.stringify(bar):String(bar));
  expect(parseBackup(JSON.stringify(montarBackup(parsed))).eventos[0].receitaRealizada.bar).toBe('');
 });
 for(const bar of [-2000,14200,0,'','-2.50','14200']) it(`bar válido ${bar} conserva significado`,()=>{ expect(parseBackup(JSON.stringify({eventos:[evento(bar)]})).eventos[0].receitaRealizada.bar).toBe(bar) });
 it('load, edição de nome e reload preservam bar bruto',()=>{saveStore({eventos:[evento('14.200,00')]}); const s=loadStore(); s.eventos[0]={...s.eventos[0],nome:'editado'};saveStore(s);expect(loadStore().eventos[0].receitaRealizada.bar).toBe('14.200,00')});
 it('bilheteria/Pix corrigidos são listados, bar preservado no restauro',()=>{ const e={...evento('14.200,00'),receitaRealizada:{bilheteria:-5,bar:'14.200,00',pix:'14.200,00'}};const r=revisarEventoRestaurado(e);expect(r.eventoCorrigido.receitaRealizada).toEqual({bilheteria:'',bar:'14.200,00',pix:''});expect(r.correcoes.map(c=>c.campo)).toEqual(['receitaRealizada.bilheteria','receitaRealizada.pix']);expect(r.correcoes.every(c=>c.explicacao.includes('campo fica vazio'))).toBe(true) });
 it('Pix ausente permanece ausente',()=>{ expect(parseBackup(JSON.stringify({eventos:[evento(0)]})).eventos[0].receitaRealizada).not.toHaveProperty('pix') });
})
it('censo nomeia bilheteria/bar/Pix, destino vazio e original por campo',()=>{
 const e={...evento({errado:1}),receitaRealizada:{bilheteria:-5,bar:{errado:1},pix:'14.200,00'}}
 const c=censoNormalizacoes([e]);expect(c.map(x=>x.campo)).toEqual(['receitaRealizada.bilheteria','receitaRealizada.bar','receitaRealizada.pix']);expect(c.map(x=>x.valor)).toEqual([-5,{errado:1},'14.200,00']);expect(c.every(x=>x.para==='não informado')).toBe(true)
})
for(const pix of [-5,'14.200,00',true,[],{ruim:1}])it(`Pix inválido ${JSON.stringify(pix)} normaliza e censo informa original`,()=>{const e={...evento(0),receitaRealizada:{bilheteria:0,bar:0,pix}};const parsed=parseBackup(JSON.stringify({eventos:[e]}));expect(parsed.eventos[0].receitaRealizada.pix).toBe('');expect(censoNormalizacoes(parsed.eventosCrus).find(c=>c.campo==='receitaRealizada.pix').valor).toEqual(pix)})
for(const pix of [0,'0','12.50'])it(`Pix válido ${pix} preserva`,()=>{const e={...evento(0),receitaRealizada:{bilheteria:0,bar:0,pix}};expect(parseBackup(JSON.stringify({eventos:[e]})).eventos[0].receitaRealizada.pix).toBe(pix)})
