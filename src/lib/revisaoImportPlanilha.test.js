import { describe,it,expect } from 'vitest'
import { montarRevisaoPlanilha,revisarImportPlanilha,montarDadosImportPlanilha,aplicarImportPlanilha,desfazerImportPlanilha } from './revisaoImportPlanilha.js'
import { parseAOA } from './xlsxImport.js'
import { censoNormalizacoes } from './migracao.js'
import { novoEvento } from './defaults.js'
const base=()=>montarRevisaoPlanilha(parseAOA([['ESTRUTURA'],['Macro','Serviço','Fornecedor','Estimado','Realizado'],['','Som','',15000],['','Estorno','',-2500],[],['Lote','Valor unitário','Quantidade'],['Bom',100,200],['Ruim',-50,300]],{categorias:{},lotes:[],avisos:[]},'Custos'),'Festa.xlsx')
const vazio=()=>({eventos:[],benchmarksCustom:[],ajustes:{teste:true}})
const freeze=x=>{Object.freeze(x);for(const v of Object.values(x))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return x}
describe('P6 — contratos separados por destino',()=>{
 it('evento recusa negativo, referência conserva, lote inválido não entra em nenhum',()=>{
  const rev=base();rev.salvarBenchmark=true;freeze(rev);const r=revisarImportPlanilha(rev)
  expect(r.evento.itens).toHaveLength(1);expect(r.evento.lotes).toHaveLength(1);expect(r.evento.recusas).toHaveLength(2);expect(r.evento.totalCustos).toBe(15000)
  expect(r.benchmark.itens).toHaveLength(2);expect(r.benchmark.totalCustos).toBe(12500);expect(r.benchmark.lotes).toHaveLength(1)
  const p=montarDadosImportPlanilha(rev);expect(p.ok).toBe(true);expect(censoNormalizacoes([p.evento])).toEqual([]);expect(p.benchmark.custoTotal).toBe(12500)
  expect(JSON.stringify(p.evento)+JSON.stringify(p.benchmark)).not.toMatch(/fonte|originais|incluir|recusasCelulas|metadados/)
 })
 it('IDs transitórios permanecem e res deep-freeze não muda',()=>{
  const res=freeze(parseAOA([['A&B'],['','Bar','',100]],{categorias:{},lotes:[],avisos:[]},'A'));const rev=montarRevisaoPlanilha(res,'A.xlsx');const id=rev.itens[0].id
  revisarImportPlanilha(rev);revisarImportPlanilha(rev);expect(rev.itens[0].id).toBe(id);expect(res.categorias.aeb[0]).not.toHaveProperty('id')
 })
 it.each(['estimado','realizado','valor','quantidade','publico'])('%s respeita matriz de faixa e vazio',campo=>{
  for(const valor of ['',0,-0,-0.1,100000000,100000000.01,NaN,Infinity]) {
   const rev=base();rev.itens=[rev.itens[0]];rev.lotes=[]
   if(campo==='valor'||campo==='quantidade'){rev.lotes=[{id:'l',incluir:true,nome:'L',valor:100,quantidade:1}];rev.lotes[0][campo]=valor}
   else if(campo==='publico')rev.publico=valor
   else rev.itens[0][campo]=valor
   const r=revisarImportPlanilha(rev).evento;const invalido=valor!==''&&(!Number.isFinite(valor)||valor<0||valor>100000000)
   expect(r.recusas.some(c=>c.campo===campo)).toBe(invalido)
   if(campo==='realizado'&&invalido)expect(r.itens[0].realizado).toBe('')
   if(campo==='estimado'&&invalido)expect(r.itens).toHaveLength(0)
  }
 })
 it('quantidade negativa antes de round e acima do teto não escapam',()=>{
  const rev=montarRevisaoPlanilha(parseAOA([['Lote','Valor unitário','Quantidade'],['Negativo',100,-0.1],['Excesso',100,100000000.1]],{categorias:{},lotes:[],avisos:[]},'Ingressos'),'L.xlsx')
  expect(rev.lotes[0].quantidade).toBe(-0);expect(revisarImportPlanilha(rev).evento.lotes).toHaveLength(0)
  expect(revisarImportPlanilha(rev).evento.recusas.map(r=>r.original)).toEqual([-0.1,100000000.1])
 })
 it('seleção forçada não passa valores recusados; benchmark negativo isolado continua -5000',()=>{
  const rev=base();rev.itens=[{...rev.itens[1],estimado:-5000}];rev.lotes=[];rev.salvarEvento=false;rev.salvarBenchmark=true
  expect(montarDadosImportPlanilha(rev).benchmark.custoTotal).toBe(-5000)
  rev.salvarEvento=true;expect(montarDadosImportPlanilha(rev).ok).toBe(false)
 })
})
describe('P6 — aplicar e desfazer pontual',()=>{
 it('aplica pacote uma vez, protege IDs repetidos e não muda argumento',()=>{
  const pacote=montarDadosImportPlanilha(base());const s=freeze(vazio());const a=aplicarImportPlanilha(s,pacote)
  expect(a.ok).toBe(true);expect(s.eventos).toEqual([]);expect(aplicarImportPlanilha(a.store,pacote).ok).toBe(false)
  expect(aplicarImportPlanilha(s,{ok:false}).ok).toBe(false)
  expect(aplicarImportPlanilha(s,{ok:true,evento:{id:'inválido'}}).ok).toBe(false)
 })
 it('desfazer conserva outra festa editada, recusa importado editado e ausente é no-op',()=>{
  const pacote=montarDadosImportPlanilha(base());const a=aplicarImportPlanilha(vazio(),pacote);const outro=novoEvento('Outra festa');outro.nome='Outra editada'
  const atual=freeze({...a.store,eventos:[...a.store.eventos,outro]});const d=desfazerImportPlanilha(atual,a.recibo)
  expect(d.ok).toBe(true);expect(d.store.eventos).toEqual([outro]);expect(d.store.ajustes).toEqual({teste:true});expect(desfazerImportPlanilha(d.store,a.recibo).jaDesfeito).toBe(true)
  const editado={...atual,eventos:[{...pacote.evento,nome:'Editado'},outro]};const recusado=desfazerImportPlanilha(editado,a.recibo)
  expect(recusado.ok).toBe(false);expect(recusado.store).toBe(editado)
 })
})


describe('P5 — decisão de divergência pertence à revisão',()=>{
 const revComTotal=(total=4500,qtd=20,unit=250)=>montarRevisaoPlanilha(parseAOA([['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',qtd,unit,total],['Segurança',8,300,'']],{categorias:{},lotes:[],avisos:[]},'Equipe'),'Equipe.xlsx')
 it('sem escolha bloqueia pacote; seleção forçada não resolve',()=>{
  const rev=revComTotal();const p=revisarImportPlanilha(rev);expect(p.conflitosPendentes).toHaveLength(1);expect(p.podeAplicar).toBe(false);expect(montarDadosImportPlanilha(rev).ok).toBe(false)
  rev.itens[0].incluirEvento=true;expect(montarDadosImportPlanilha(rev).ok).toBe(false)
 })
 it.each([['calculado',7400],['declarado',6900]])('%s muda ambos destinos sem gravar metadados', (escolha,total)=>{
  const rev=revComTotal();rev.salvarBenchmark=true;rev.itens[0].conflito.escolha=escolha
  const p=montarDadosImportPlanilha(rev);expect(p.ok).toBe(true);expect(p.resumo.evento.totalCustos).toBe(total);expect(p.benchmark.custoTotal).toBe(total)
  expect(p.evento.categorias.flatMap(c=>c.itens).reduce((s,i)=>s+i.estimado,0)).toBe(total);expect(JSON.stringify(p)).not.toMatch(/escolha|totalCalculado|quantidadeOriginal/)
 })
 it('desmarcar conflito dispensa escolha; voltar escolha nula bloqueia novamente',()=>{
  const rev=revComTotal();rev.itens[0].incluirEvento=false;expect(montarDadosImportPlanilha(rev).resumo.evento.totalCustos).toBe(2400)
  rev.itens[0].incluirEvento=true;rev.itens[0].conflito.escolha='calculado';expect(revisarImportPlanilha(rev).podeAplicar).toBe(true);rev.itens[0].conflito.escolha=null;expect(revisarImportPlanilha(rev).podeAplicar).toBe(false)
 })
 it('só tolerância de máquina:0.1×3≈0.3,5000vs4999.999 ainda divergem',()=>{
  expect(revisarImportPlanilha(revComTotal(0.3,3,0.1)).conflitosPendentes).toEqual([])
  expect(revisarImportPlanilha(revComTotal(4999.999)).conflitosPendentes).toHaveLength(1)
 })
})

 it('P5 — produto não finito recusa nos dois destinos sem aproveitar total informado',()=>{
  const rev=montarRevisaoPlanilha(parseAOA([['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Excesso',1e308,1e308,10],['Segurança',8,300,'']],{categorias:{},lotes:[],avisos:[]},'Equipe'),'Equipe.xlsx');rev.salvarBenchmark=true
  const p=revisarImportPlanilha(rev);expect(p.evento.itens).toHaveLength(1);expect(p.benchmark.itens).toHaveLength(1);expect(p.evento.totalCustos).toBe(2400);expect(p.benchmark.totalCustos).toBe(2400);expect(p.evento.recusas).toHaveLength(1);expect(p.benchmark.recusas).toHaveLength(1)
 })
