// @vitest-environment jsdom
import { it,expect,vi,beforeEach,afterEach } from 'vitest'
import { render,screen,fireEvent,cleanup,act } from '@testing-library/react'
import { novoEvento } from '../lib/defaults.js'
import { saveStore,loadStore,liberarGravacao } from '../lib/storage.js'
import { loadSnapshots } from '../lib/protecao.js'
import { montarFotoFechamento } from '../lib/fechamentoEvento.js'
import { subscribeToast } from '../lib/toast.js'
import FechamentoTab from './FechamentoTab.jsx'
const bancada=vi.hoisted(()=>({props:null}))
// Dublê somente para alcançar o callback do App sem o disabled da tela.
vi.mock('./EventEditor.jsx',()=>({default:props=>{bancada.props=props;return <p>Funil do App</p>}}))
import App from '../App.jsx'
const RealEditor=(await vi.importActual('./EventEditor.jsx')).default
let cancelar,avisos
const e=(bar='14.200,00')=>({...novoEvento('S4 sintético'),id:'s4',barModo:'fixo',outrasReceitas:{bar:0},taxaBilheteria:0,cashbackPct:0,receitaRealizada:{bilheteria:20000,bar},categorias:[{id:'aeb',nome:'A&B',itens:[{id:'c',estimado:20800,realizado:20800}]}]})
beforeEach(()=>{liberarGravacao();const m=new Map();vi.stubGlobal('localStorage',{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size}});avisos=[];cancelar=subscribeToast(t=>avisos.push(t));vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(window,'alert').mockImplementation(()=>{})})
afterEach(()=>{cleanup();cancelar();vi.restoreAllMocks();vi.unstubAllGlobals();liberarGravacao()})
it('App recusa origem antes de snapshot/carimbo/histórico mesmo chamado diretamente',()=>{
 saveStore({eventos:[e()],benchmarksCustom:[],ajustes:{porTipo:{}}});render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Abrir S4 sintético'}));const antes=JSON.stringify(loadStore());const n=loadSnapshots().length;let r;act(()=>{r=bancada.props.onFecharEvento()});expect(r.ok).toBe(false);expect(r.motivo).toMatch(/bar realizado/);expect(loadSnapshots()).toHaveLength(n);expect(JSON.stringify(loadStore())).toBe(antes);fireEvent.keyDown(window,{key:'z',metaKey:true});expect(JSON.stringify(loadStore())).toBe(antes)
})
it('FechamentoTab mostra recusa junto à ação, não chama fechamento',()=>{const fn=vi.fn();render(<FechamentoTab evento={e()} update={vi.fn()} onFecharEvento={fn}/>);const b=screen.getByRole('button',{name:/Fechar evento/});expect(b.disabled).toBe(true);expect(b.title).toMatch(/bar realizado/);expect(screen.getByText(/nenhuma fotografia foi criada/)).toBeTruthy();fireEvent.click(b);expect(fn).not.toHaveBeenCalled();expect(window.confirm).not.toHaveBeenCalled()})
for(const campo of ['bar','pix','bilheteria'])it(`EventEditor real recusa promoção de ${campo} ilegível antes de confirmar/gravar`,()=>{
 const sano=e(14200);const foto=montarFotoFechamento(sano);const ev={...sano,status:'fechado',fechamento:{em:'2026-10-06T10:00:00Z',foto},receitaRealizada:{...sano.receitaRealizada,[campo]:'14.200,00'}};const store={eventos:[ev],benchmarksCustom:[],ajustes:{porTipo:{}}};const setStore=vi.fn();const antes=JSON.stringify(store);render(<RealEditor evento={ev} store={store} setStore={setStore} update={vi.fn()} aparencia={{festas:{}}} onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Fechamento'}));fireEvent.click(screen.getByRole('button',{name:'Promover a benchmark'}));expect(avisos.at(-1)?.mensagem || '').toMatch(new RegExp(campo==='pix'?'Pix':campo));expect(window.confirm).not.toHaveBeenCalled();expect(setStore).not.toHaveBeenCalled();expect(JSON.stringify(store)).toBe(antes)
})
it('promoção open bar aceita bar ilegível excluído da conta',()=>{const sano={...e(14200),openBar:true};const ev={...sano,status:'fechado',fechamento:{em:'2026-10-06T10:00:00Z',foto:montarFotoFechamento(sano)},receitaRealizada:{bilheteria:20000,bar:'14.200,00'}};const setStore=vi.fn();render(<RealEditor evento={ev} store={{eventos:[ev],benchmarksCustom:[],ajustes:{porTipo:{}}}} setStore={setStore} update={vi.fn()} aparencia={{festas:{}}} onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Fechamento'}));fireEvent.click(screen.getByRole('button',{name:'Promover a benchmark'}));expect(window.confirm).toHaveBeenCalled();expect(setStore).toHaveBeenCalled()})

it('bilheteria zero válida mantém confirmação extra e chama uma vez; correção explícita libera fechamento',()=>{const fn=vi.fn(()=>({ok:true}));const ev={...e(0),receitaRealizada:{bilheteria:0,bar:0}};render(<FechamentoTab evento={ev} update={vi.fn()} onFecharEvento={fn}/>);fireEvent.click(screen.getByRole('button',{name:'Fechar evento — congela os números'}));expect(window.confirm).toHaveBeenCalledTimes(2);expect(fn).toHaveBeenCalledTimes(1)})
