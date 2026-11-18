// @vitest-environment jsdom
import { useState,useEffect } from 'react'
import { it,expect,vi,afterEach,beforeEach } from 'vitest'
import { render,screen,fireEvent,cleanup,waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import ImportModal from './ImportModal.jsx'
import { NumInput } from './ui.jsx'
import { loadSnapshots,restaurarSnapshot } from '../lib/protecao.js'
import { loadStore,saveStore,liberarGravacao,montarBackup,parseBackup,mesclarBackup } from '../lib/storage.js'
import { censoNormalizacoes } from '../lib/migracao.js'
import { novoEvento } from '../lib/defaults.js'
import { computeCenarios } from '../lib/calc.js'
let mem
beforeEach(()=>{
 liberarGravacao();mem=new Map();vi.stubGlobal('localStorage',{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),key:i=>[...mem.keys()][i]??null,get length(){return mem.size}})
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Rede não autorizada no teste')}))
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();liberarGravacao()})
const arquivo=aoa=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Custos');return {name:'festa.xlsx',arrayBuffer:async()=>XLSX.write(wb,{type:'array',bookType:'xlsx'})}}
const base=[['ESTRUTURA'],['Macro','Serviço','Fornecedor','Estimado','Realizado']]
const mistura=[...base,['','Som','',15000],['','Estorno','',-2500],[],['Lote','Valor unitário','Quantidade'],['Bom',100,200],['Ruim',-50,300]]
function criarFio(inicial=loadStore()) {
 const fio={store:inicial,setStore:null,dispatch:vi.fn(),abrir:vi.fn(),fechar:vi.fn()}
 function Fio(){const [store,setStore]=useState(inicial);fio.store=store;fio.setStore=setStore;useEffect(()=>{saveStore(store)},[store]);return <ImportModal store={store} setStore={fn=>{fio.snapshotsQuandoDispatch=loadSnapshots().length;fio.dispatch(fn);setStore(fn)}} abrir={fio.abrir} onClose={fio.fechar} />}
 fio.view=render(<Fio/>);return fio
}
async function ler(fio,aoa){fireEvent.change(fio.view.container.querySelector('input[type=file]'),{target:{files:[arquivo(aoa)]}});await screen.findByText(/Revisar importação/)}
const aplicar=()=>fireEvent.click(screen.getByRole('button',{name:/^Importar .*evento|^Importar referência histórica|Confirmar importação/}))
async function resultado(){await screen.findByText('Planilha importada')}
const destinoEvento=()=>screen.getByRole('checkbox',{name:/Salvar como evento/})
const destinoBenchmark=()=>screen.getByRole('checkbox',{name:/Adicionar aos benchmarks/})
it('P3 — texto completo recusado, Gerador e realizado não informado no store',async()=>{
 const fio=criarFio();await ler(fio,[...base,['','Palco','','R$ 8.000 (2 dias)'],['','PA','','R$ 2.000/dia'],['','Iluminação','','R$ 15.000 - 3 diárias'],['','Gerador','',12000,'R$ 8 mil']])
 for(const text of ['R$ 8.000 (2 dias)','R$ 2.000/dia','R$ 15.000 - 3 diárias','R$ 8 mil'])expect(screen.getByText(text,{exact:false})).toBeTruthy()
 expect(screen.getByText(/realizado ficou não informado/i)).toBeTruthy();expect(screen.getByText(/Linhas recusadas/).closest('section').querySelector('input')).toBeNull()
 aplicar();await resultado();const itens=loadStore().eventos[0].categorias.flatMap(c=>c.itens)
 expect(itens).toHaveLength(1);expect(itens[0]).toMatchObject({servico:'Gerador',estimado:12000,realizado:''});expect(itens[0]).not.toHaveProperty('recusasCelulas')
})
it('P3 — integralmente recusado mantém revisão e não aplica',async()=>{
 const fio=criarFio();await ler(fio,[...base,['','Palco','','R$ 8 mil']]);expect(screen.getByText(/R\$ 8 mil/)).toBeTruthy()
 const botao=screen.getByRole('button',{name:'Nenhuma linha válida para importar'});expect(botao.disabled).toBe(true);fireEvent.click(botao);expect(fio.dispatch).not.toHaveBeenCalled()
})
it.each(['1/2','12-34','R$ 8.000 (2 dias)'])('P3 — NumInput conserva %s sem salvar',texto=>{const onChange=vi.fn();render(<NumInput value={12000} onChange={onChange}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:texto}});expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole('textbox').value).toBe(texto)})
it('P6 — destinos separados, snapshot, resultado, reload e backup real preservam números',async()=>{
 const fio=criarFio();await ler(fio,mistura);fireEvent.click(destinoBenchmark())
 expect(screen.getByText(/Evento: 1 custo/).textContent).toContain('15.000');expect(screen.getByText(/Referência histórica: 2 custos/).textContent).toContain('12.500')
 expect(screen.queryByRole('checkbox',{name:'Incluir Estorno como evento'})).toBeNull();expect(screen.getByRole('checkbox',{name:'Incluir Estorno como benchmark'})).toBeTruthy()
 const botao=screen.getByRole('button',{name:/^Importar .*evento/});fireEvent.click(botao);fireEvent.click(botao);await resultado()
 expect(fio.dispatch).toHaveBeenCalledTimes(1);expect(fio.abrir).not.toHaveBeenCalled();expect(fio.fechar).not.toHaveBeenCalled()
 expect(loadSnapshots()).toHaveLength(1);expect(loadSnapshots()[0].store.eventos).toEqual([])
 const salvo=loadStore();const itens=salvo.eventos[0].categorias.flatMap(c=>c.itens);expect(itens.map(i=>i.estimado)).toEqual([15000]);expect(salvo.benchmarksCustom[0].custoTotal).toBe(12500)
 expect(salvo.eventos[0].lotes).toHaveLength(1);expect(salvo.eventos[0].lotes[0]).toMatchObject({valor:100,quantidade:200});expect(censoNormalizacoes(salvo.eventos)).toEqual([])
 expect(computeCenarios(salvo.eventos[0]).realista.custoItens).toBe(15000)
 const json=JSON.stringify(montarBackup(salvo));expect(json).not.toMatch(/fonte|originais|metadados|recusasCelulas/)
 const backup=parseBackup(json);const mesclado=mesclarBackup({...salvo,eventos:[],benchmarksCustom:[]},backup);expect(mesclado.benchmarksCustom[0].custoTotal).toBe(12500);expect(censoNormalizacoes(mesclado.eventos)).toEqual([])
 expect(mesclado.eventos[0].categorias.flatMap(c=>c.itens).map(i=>i.estimado)).toEqual([15000])
 fireEvent.click(screen.getByRole('button',{name:'Abrir evento importado'}));expect(fio.abrir).toHaveBeenCalledWith(salvo.eventos[0].id)
})
it('P6 — benchmark negativo isolado permite trocar destino sem perder original',async()=>{
 const fio=criarFio();await ler(fio,[...base,['','Estorno','',-5000]])
 expect(screen.getByRole('button',{name:'Nenhuma linha válida para importar'}).disabled).toBe(true)
 fireEvent.click(destinoEvento());fireEvent.click(destinoBenchmark());expect(screen.getByRole('checkbox',{name:'Incluir Estorno como benchmark'}).checked).toBe(true)
 aplicar();await resultado();expect(loadStore().eventos).toEqual([]);expect(loadStore().benchmarksCustom[0].custoTotal).toBe(-5000)
})
it('P6 — desfazer pontual preserva anteriores e edição de outra festa após importar',async()=>{
 const inicial=loadStore();const outro=novoEvento('Anterior');inicial.eventos=[outro];inicial.benchmarksCustom=[{id:'anterior',nome:'Referência',custos:{estrutura:200},custoTotal:200,custom:true}]
 const fio=criarFio(inicial);await ler(fio,mistura);fireEvent.click(destinoBenchmark());aplicar();await resultado();expect(loadSnapshots()[0].store).toEqual(inicial)
 fio.setStore(s=>({...s,eventos:s.eventos.map(e=>e.id===outro.id?{...e,nome:'Outra festa editada'}:e)}));await screen.findByRole('button',{name:'Desfazer importação da planilha'})
 fireEvent.click(screen.getByRole('button',{name:'Desfazer importação da planilha'}));await screen.findByText('Importação desfeita')
 expect(fio.store.eventos).toHaveLength(1);expect(fio.store.eventos[0].nome).toBe('Outra festa editada');expect(fio.store.benchmarksCustom).toEqual(inicial.benchmarksCustom)
 expect(loadStore().eventos).toHaveLength(1);expect(loadStore().eventos[0].nome).toBe('Outra festa editada')
})
it('P6 — objeto importado editado impede desfazer, histórico que removeu antes não recria',async()=>{
 const fio=criarFio();await ler(fio,mistura);aplicar();await resultado()
 fio.setStore(s=>({...s,eventos:s.eventos.map(e=>({...e,nome:'Editado depois'}))}));await waitFor(()=>expect(fio.store.eventos[0].nome).toBe('Editado depois'))
 fireEvent.click(screen.getByRole('button',{name:'Desfazer importação da planilha'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('editado depois'));expect(fio.store.eventos).toHaveLength(1)
 fio.setStore(s=>({...s,eventos:[]}));await waitFor(()=>expect(fio.store.eventos).toEqual([]));fireEvent.click(screen.getByRole('button',{name:'Desfazer importação da planilha'}));await screen.findByText('Importação desfeita');expect(fio.store.eventos).toEqual([])
})
it('P6 — restauração usa snapshot realmente criado e aplica store restaurado',async()=>{
 const inicial=loadStore();inicial.eventos=[novoEvento('Antes')];const fio=criarFio(inicial);await ler(fio,mistura);aplicar();await resultado()
 const snap=loadSnapshots().find(s=>s.rotulo==='antes de importar a planilha XLSX');const r=restaurarSnapshot(snap.id,fio.store);expect(r.ok).toBe(true)
 fio.setStore(r.store);await waitFor(()=>expect(fio.store.eventos).toHaveLength(1));expect(fio.store.eventos[0].nome).toBe('Antes');expect(loadStore().eventos.map(e=>e.nome)).toEqual(['Antes'])
 fireEvent.click(screen.getByRole('button',{name:'Desfazer importação da planilha'}));await screen.findByText('Importação desfeita');expect(fio.store.eventos.map(e=>e.nome)).toEqual(['Antes'])
})
it('P6 — snapshot falhando mantém revisão sem dispatch, abrir ou fechar',async()=>{
 const fio=criarFio();await ler(fio,mistura);const set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k.includes('snapshots'))throw new Error('Quota');set(k,v)}
 aplicar();expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('nada foi importado'));expect(fio.dispatch).not.toHaveBeenCalled();expect(fio.abrir).not.toHaveBeenCalled();expect(fio.fechar).not.toHaveBeenCalled();expect(screen.getByText('Revisar importação')).toBeTruthy()
})
it('P6 — gravação já bloqueada recusa antes de snapshot e cancelar não muda store',async()=>{
 const inicial=loadStore();mem.set('previsao-eventos:v1','{quebrado');loadStore();const fio=criarFio(inicial);await ler(fio,mistura);aplicar()
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('gravação está bloqueada'));expect(loadSnapshots()).toEqual([]);expect(fio.dispatch).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Escolher outro arquivo'}));expect(screen.getByRole('button',{name:/Arraste a planilha/}).tagName).toBe('BUTTON');expect(fio.store).toEqual(inicial)
})

it('P6 — snapshot existe antes do primeiro dispatch, que não abre nem fecha',async()=>{
 const fio=criarFio();await ler(fio,[...base,['','Som','',15000]])
 aplicar();expect(fio.snapshotsQuandoDispatch).toBe(1);expect(fio.abrir).not.toHaveBeenCalled();expect(fio.fechar).not.toHaveBeenCalled();await resultado()
})

it.each([['calculado',7400],['declarado',6900]])('P5 — escolha %s visível sem pré-seleção, ambos destinos persistem %s',async(escolha,total)=>{
 const fio=criarFio();await ler(fio,[['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',20,250,4500],['Segurança',8,300,'']]);fireEvent.click(destinoBenchmark())
 const calcular=screen.getByRole('radio',{name:/Usar total calculado de Garçom/});const informado=screen.getByRole('radio',{name:/Usar total informado de Garçom/})
 expect(calcular.checked).toBe(false);expect(informado.checked).toBe(false);expect(screen.getByRole('button',{name:/Escolha o total/}).disabled).toBe(true)
 expect(calcular.closest('label').textContent).toContain('5.000');expect(informado.closest('label').textContent).toContain('4.500')
 fireEvent.click(escolha==='calculado'?calcular:informado);aplicar();await resultado()
 const salvo=loadStore();expect(salvo.eventos[0].categorias.flatMap(c=>c.itens).every(i=>i.status === 'ESTIMADO')).toBe(true);expect(salvo.eventos[0].lotes.every(l=>!l.quantidade)).toBe(true);expect(computeCenarios(salvo.eventos[0]).realista.custoItens).toBe(total);expect(salvo.benchmarksCustom[0].custoTotal).toBe(total)
 const backup=parseBackup(JSON.stringify(montarBackup(salvo)));const mesclado=mesclarBackup({...salvo,eventos:[],benchmarksCustom:[]},backup);saveStore(mesclado);expect(computeCenarios(loadStore().eventos[0]).realista.custoItens).toBe(total)
 expect(JSON.stringify(montarBackup(salvo))).not.toMatch(/conflito|escolha|unitario|totalCalculado/)
})
it('P5 — subcentavo aparece com precisão e conflito desmarcado não bloqueia restante',async()=>{
 const fio=criarFio();await ler(fio,[['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',20,250,4999.999],['Segurança',8,300,'']])
 expect(screen.getByRole('radio',{name:/Usar total informado de Garçom/}).closest('label').textContent).toContain('4.999,999')
 fireEvent.click(screen.getByRole('checkbox',{name:'Incluir Garçom como evento'}));aplicar();await resultado();expect(computeCenarios(loadStore().eventos[0]).realista.custoItens).toBe(2400)
})

it('P5 — limpar escolha e trocar arquivo retornam decisão para pendente',async()=>{
 const fio=criarFio();const aoa=[['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',20,250,4500],['Segurança',8,300,'']];await ler(fio,aoa)
 fireEvent.click(screen.getByRole('radio',{name:'Usar total calculado de Garçom'}));fireEvent.click(screen.getByRole('button',{name:'Limpar escolha de Garçom'}));expect(screen.getByRole('button',{name:/Escolha o total/}).disabled).toBe(true)
 fireEvent.click(screen.getByRole('radio',{name:'Usar total informado de Garçom'}));fireEvent.click(screen.getByRole('button',{name:'Escolher outro arquivo'}));await ler(fio,aoa)
 expect(screen.getByRole('radio',{name:'Usar total calculado de Garçom'}).checked).toBe(false);expect(screen.getByRole('radio',{name:'Usar total informado de Garçom'}).checked).toBe(false);expect(fio.dispatch).not.toHaveBeenCalled()
})
it('P5 — três seções70400 não criam bilheteria; lote explícito100×200 continua receita',async()=>{
 const fio=criarFio();const header=['Macro','Serviço','Fornecedor','Valor','Status'];await ler(fio,[['ESTRUTURA'],header,['','Som','',15000],['','Luz','',18000],[],['EQUIPE'],['Serviço','Qtd','Valor unitário'],['Garçom',20,250],['Segurança',8,300],[],['ARTISTICO'],header,['','DJ','',30000]])
 aplicar();await resultado();const ev=loadStore().eventos[0];expect(ev.categorias.flatMap(c=>c.itens)).toHaveLength(5);expect(computeCenarios(ev).realista.custoItens).toBe(70400);expect(computeCenarios(ev).otimista.bruta).toBe(0)
 cleanup();const lotes=criarFio();await ler(lotes,[['Lote','Valor unitário','Qtd'],['Lote1',100,200]]);expect(screen.getByText(/Tabela interpretada como lotes de ingresso/)).toBeTruthy();aplicar();await resultado();expect(computeCenarios(loadStore().eventos.at(-1)).otimista.bruta).toBe(20000)
})
it('P5 — escolher informado subcentavo conserva4999.999 no evento e no backup após reload',async()=>{
 const fio=criarFio();await ler(fio,[['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',20,250,4999.999],['Segurança',8,300,'']])
 fireEvent.click(screen.getByRole('radio',{name:'Usar total informado de Garçom'}));aplicar();await resultado()
 const estimado=store=>store.eventos[0].categorias.flatMap(c=>c.itens).find(i=>i.servico==='Garçom').estimado
 const salvo=loadStore();expect(estimado(salvo)).toBe(4999.999)
 const backup=parseBackup(JSON.stringify(montarBackup(salvo)));const mesclado=mesclarBackup({...salvo,eventos:[],benchmarksCustom:[]},backup);saveStore(mesclado);expect(estimado(loadStore())).toBe(4999.999)
 expect(computeCenarios(loadStore().eventos[0]).realista.custoItens).toBe(computeCenarios(salvo.eventos[0]).realista.custoItens)
})

it.each([-250, 100_000_001])('P5 — conflito pendente com unitário %s pode ser desmarcado sem escolher valor',async(unitario)=>{
 const fio=criarFio();await ler(fio,[['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',1,unitario,4500],['Segurança',8,300,'']])
 expect(screen.getByRole('button',{name:/Escolha o total/}).disabled).toBe(true)
 const incluir=screen.getByRole('checkbox',{name:'Incluir Garçom como evento'})
 expect(incluir.checked).toBe(true);fireEvent.click(incluir)
 aplicar();await resultado()
 expect(loadStore().eventos[0].categorias.flatMap(c=>c.itens).map(i=>[i.servico,i.estimado])).toEqual([['Segurança',2400]])
})
