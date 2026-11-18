// @vitest-environment jsdom
import { describe,it,expect,beforeEach,afterEach,vi } from 'vitest'
import { render,screen,cleanup,fireEvent,waitFor } from '@testing-library/react'
import FechamentoTab from './FechamentoTab.jsx'
import { novoEvento } from '../lib/defaults.js'
import { computeCenario } from '../lib/calc.js'
import { resultadoRealizado,fechamentoReceita } from '../lib/fechamento.js'
import { useState, useEffect } from 'react'
import ImportModal from './ImportModal.jsx'
import Ajustes from './Ajustes.jsx'
import { saveStore,loadStore,montarBackup,liberarGravacao } from '../lib/storage.js'
import { loadSnapshots,restaurarSnapshot } from '../lib/protecao.js'
let dados, falharSnapshot
beforeEach(()=>{
 liberarGravacao(); dados=new Map();falharSnapshot=false
 vi.stubGlobal('localStorage',{getItem:k=>dados.get(k)??null,setItem:(k,v)=>{if(falharSnapshot&&k.includes('snapshots'))throw new Error('quota sintética');dados.set(k,String(v))},removeItem:k=>dados.delete(k),key:i=>[...dados.keys()][i],get length(){return dados.size}})
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();liberarGravacao()})
const evento=bar=>({...novoEvento('S4 sintético'),barModo:'fixo',outrasReceitas:{bar:0},taxaBilheteria:0,cashbackPct:0,receitaRealizada:{bilheteria:20000,bar},categorias:[{id:'aeb',nome:'A&B',itens:[{id:'c',estimado:20800,realizado:20800}]}]})
const montar=(e,update=vi.fn())=>render(<FechamentoTab evento={e} update={update} />)
const linha=texto=>screen.getAllByText(texto,{exact:true}).find(n=>n.closest('tr')).closest('tr')
const card=()=>screen.getByRole('heading',{name:/Resultado realizado/}).parentElement
it('bar bruto 14.200,00 mascara linha e card em vez de publicar -800/zero',()=>{montar(evento('14.200,00'));expect(linha('Bar (lucro líquido)').textContent).toContain('não dá para calcular');expect(card().textContent).toContain('não dá para calcular');expect(card().querySelector('.max-w-lg').lastElementChild.textContent).not.toContain('800');expect(screen.getByText(/Valor guardado:.*14.200,00/)).toBeTruthy()})
it('abrir focar sair conserva bruto e correção segue funil normal',()=>{const update=vi.fn();montar(evento('14.200,00'),update);const inp=screen.getByRole('textbox',{name:/Bar realizado/});expect(inp.value).toBe('');fireEvent.focus(inp);fireEvent.blur(inp);expect(update).not.toHaveBeenCalled();fireEvent.change(inp,{target:{value:'14200'}});fireEvent.blur(inp);expect(update).toHaveBeenCalled();const fn=update.mock.calls.at(-1)[0];expect(fn(evento('14.200,00')).receitaRealizada.bar).toBe(14200)})
for(const [bar,resultado] of [[0,'800'],[-2000,'2.800'],[14200,'13.400']]) it(`bar válido ${bar} mantém resultado`,()=>{montar(evento(bar));expect(card().textContent).toContain(resultado);expect(card().textContent).not.toContain('não dá para calcular')})
it('open bar exclui origem inválida do resultado e da tabela',()=>{montar({...evento('14.200,00'),openBar:true});expect(card().textContent).toContain('800');expect(card().textContent).not.toContain('não dá para calcular');expect(screen.queryByText('Bar (lucro líquido)',{exact:true})).toBeNull()})
for(const quadro of [true,false]) it(`fotografia válida ${quadro?'com quadro':'com fallback vivo'} mantém card`,()=>{const s=evento(14200);const foto={resultado:resultadoRealizado(s,computeCenario(s,'realista')),...(quadro?{receita:fechamentoReceita(s,computeCenario(s,'realista'))}:{})};montar({...evento('14.200,00'),status:'fechado',fechamento:{em:'2026-10-06T10:00:00Z',foto}});expect(card().textContent).toContain('13.400');expect(card().textContent).not.toContain('não dá para calcular');expect(linha('Bar (lucro líquido)').textContent.includes('não dá para calcular')).toBe(!quadro)})

for(const porta of ['ImportModal','Ajustes']) for(const antigo of [true,false]) for(const acao of ['cancelar','confirmar','snapshot falha']) it(`${porta} JSON ${antigo?'antigo':'atual'} ${acao}: aviso original e snapshot antes`,async()=>{
 const inicial={eventos:[{...evento(123),id:'antes',nome:'Antes'}],benchmarksCustom:[],ajustes:{porTipo:{}}}
 saveStore(inicial);const dispatch=vi.fn();let snapshotsAntes
 function Fio(){const [store,setStore]=useState(inicial);useEffect(()=>{saveStore(store)},[store]);const props={store,setStore:fn=>{snapshotsAntes=loadSnapshots().length;dispatch(fn);setStore(fn)}};return porta==='ImportModal'?<ImportModal {...props} abrir={()=>{}} onClose={()=>{}}/>:<Ajustes {...props} aparencia={{festas:{},tema:'claro'}} setAparencia={()=>{}} onBack={()=>{}}/>}
 const view=render(<Fio/>); const fonte=JSON.stringify(antigo?{eventos:[evento('14.200,00')]}:montarBackup({eventos:[evento('14.200,00')]}));
 const confirmar=vi.spyOn(window,'confirm').mockImplementation(texto=>!texto.includes('14.200,00')||acao!=='cancelar');vi.spyOn(window,'alert').mockImplementation(()=>{});falharSnapshot=acao==='snapshot falha'
 const input=view.container.querySelector(porta==='Ajustes'?'input[accept=".json,application/json"]':'input[type=file]');fireEvent.change(input,{target:{files:[{name:'sintetico.json',text:async()=>fonte}]}})
 await waitFor(()=>expect(confirmar.mock.calls.some(([t])=>t.includes('14.200,00'))).toBe(true))
 if(acao==='confirmar'){
  await waitFor(()=>expect(dispatch).toHaveBeenCalledTimes(1));expect(snapshotsAntes).toBe(1);expect(loadStore().eventos.find(e=>e.id!== 'antes').receitaRealizada.bar).toBe('');expect(loadSnapshots()).toHaveLength(1)
  const r=restaurarSnapshot(loadSnapshots()[0].id,loadStore());expect(r.ok).toBe(true);expect(r.store.eventos.map(e=>e.id)).toEqual(['antes'])
 }else{await new Promise(r=>setTimeout(r,0));expect(dispatch).not.toHaveBeenCalled();expect(loadSnapshots()).toEqual([]);expect(loadStore().eventos.map(e=>e.id)).toEqual(['antes'])}
 expect(fonte).toContain('14.200,00')
})
