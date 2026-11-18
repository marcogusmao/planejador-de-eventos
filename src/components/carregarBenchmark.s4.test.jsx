// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { StrictMode } from 'react'
import App from '../App.jsx'
import { novoEvento } from '../lib/defaults.js'
import { saveStore, loadStore, montarBackup } from '../lib/storage.js'
import { subscribeToast } from '../lib/toast.js'
import { loadSnapshots } from '../lib/protecao.js'
let toast, cancelar
beforeEach(()=>{
 const dados=new Map()
 vi.stubGlobal('localStorage',{getItem:k=>dados.get(k)??null,setItem:(k,v)=>dados.set(k,String(v)),removeItem:k=>dados.delete(k),clear:()=>dados.clear(),key:i=>[...dados.keys()][i],get length(){return dados.size}})
 const e={...novoEvento('S4 sintético'),id:'s4',receitaRealizada:{bilheteria:20000,bar:0},atualizadoEm:'2026-10-01T00:00:00Z',categorias:[{id:'aeb',nome:'A&B',padrao:true,itens:[{id:'original',servico:'Original',estimado:12000,realizado:'',status:'ESTIMADO'}]}]}
 saveStore({eventos:[e],benchmarksCustom:[{id:'s4-bm',nome:'S4 referência',custos:{aeb:16420},custom:true}],ajustes:{porTipo:{}}})
 cancelar=subscribeToast(t=>{if(t.onAcao)toast=t})
})
afterEach(()=>{cleanup();cancelar?.();vi.restoreAllMocks();vi.unstubAllGlobals()})
const atual=()=>loadStore().eventos.find(e=>e.id==='s4')
const carregar=(modo = 'substituir')=>{
 render(<StrictMode><App /></StrictMode>)
 fireEvent.click(screen.getByRole('button',{name:'Abrir S4 sintético'}))
 fireEvent.click(screen.getByRole('button',{name:'Custos'}))
 fireEvent.click(screen.getByRole('button',{name:/Usar um benchmark como base/}))
 const dialog=screen.getByRole('heading',{name:'Usar um benchmark como base'}).parentElement.parentElement
 fireEvent.change(within(dialog).getByRole('combobox'),{target:{value:'s4-bm'}})
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Incluir A&B'}))
 const selects=within(dialog).getAllByRole('combobox')
 fireEvent.change(selects.at(-1),{target:{value:modo}})
 fireEvent.click(within(dialog).getByRole('button',{name:/Adicionar 1 item da S4 referência/}))
 expect(atual().categorias[0].itens.map(i=>i.estimado)).toEqual(modo === 'somar' ? [12000, 16420] : [16420])
 expect(loadSnapshots().filter(s=>s.rotulo==='antes de carregar S4 referência')).toHaveLength(1)
 return toast
}
it('App/modal/reducer/ToastHost: Cmd+Z depois toast mantém 12000, refazer e carimbo',()=>{
 const t=carregar();fireEvent.keyDown(window,{key:'z',metaKey:true});expect(atual().categorias[0].itens.map(i=>i.estimado)).toEqual([12000]);const antes=JSON.stringify(atual());
 const refazer=screen.getByRole('button',{name:/Refazer: adicionar/});expect(refazer.disabled).toBe(false)
 fireEvent.click(screen.getByRole('button',{name:'Desfazer',exact:true}));
 expect(JSON.stringify(atual())).toBe(antes);expect(refazer.disabled).toBe(false);expect(montarBackup(loadStore())).not.toHaveProperty('carregamentosAtivos')
})
it('refazer carregamento reativa toast efetivo',()=>{carregar();fireEvent.keyDown(window,{key:'z',metaKey:true});fireEvent.keyDown(window,{key:'z',metaKey:true,shiftKey:true});expect(atual().categorias[0].itens[0].estimado).toBe(16420);fireEvent.click(screen.getByRole('button',{name:'Desfazer',exact:true}));expect(atual().categorias[0].itens.map(i=>i.estimado)).toEqual([12000])})
it('↶ e apagar original: toast não ressuscita 12000',()=>{carregar();fireEvent.keyDown(window,{key:'z',metaKey:true});fireEvent.click(screen.getByRole('button',{name:'Remover Original'}));expect(atual().categorias[0].itens).toEqual([]);fireEvent.click(screen.getByRole('button',{name:'Desfazer',exact:true}));expect(atual().categorias[0].itens).toEqual([])})
it('apagar carregado sem ↶: toast recupera original; callback antigo não repete',()=>{const t=carregar();fireEvent.click(screen.getByRole('button',{name:'Remover S4 referência'}));fireEvent.click(screen.getByRole('button',{name:'Desfazer',exact:true}));expect(atual().categorias[0].itens.map(i=>i.estimado)).toEqual([12000]);fireEvent.click(screen.getByRole('button',{name:'Remover Original'}));const antes=JSON.stringify(atual());t.onAcao();expect(JSON.stringify(atual())).toBe(antes)})

it('callback antigo após fechamento é recusado internamente sem carimbo ou sucesso novo',()=>{const t=carregar();vi.spyOn(window,'confirm').mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Fechamento'}));fireEvent.click(screen.getByRole('button',{name:'Fechar evento — congela os números'}));expect(atual().status).toBe('fechado');const antes=JSON.stringify(atual());const avisos=[];const cancelar=subscribeToast(t=>avisos.push(t));act(()=>t.onAcao());expect(JSON.stringify(atual())).toBe(antes);expect(avisos.some(a=>a.mensagem.includes('pronto'))).toBe(false);cancelar()})

const carregarOutraVez = () => {
 fireEvent.click(screen.getByRole('button',{name:/Usar um benchmark como base/}))
 const dialog=screen.getByRole('heading',{name:'Usar um benchmark como base'}).parentElement.parentElement
 fireEvent.change(within(dialog).getByRole('combobox'),{target:{value:'s4-bm'}})
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Incluir A&B'}))
 fireEvent.change(within(dialog).getAllByRole('combobox').at(-1),{target:{value:'substituir'}})
 fireEvent.click(within(dialog).getByRole('button',{name:/Adicionar 1 item da S4 referência/}))
}
it.each(['antigo primeiro','recente primeiro'])('carregamentos sobrepostos: %s devolve só 12000', ordem => {
 carregar(); carregarOutraVez()
 const botoes=screen.getAllByRole('button',{name:'Desfazer',exact:true})
 expect(botoes).toHaveLength(2)
 fireEvent.click(botoes[ordem==='antigo primeiro'?0:1])
 expect(atual().categorias[0].itens.map(i=>i.estimado)).toEqual([16420])
 fireEvent.click(botoes[ordem==='antigo primeiro'?1:0])
 expect(atual().categorias[0].itens.reduce((s,i)=>s+i.estimado,0)).toBe(12000)
 expect(atual().categorias[0].itens.map(i=>i.id)).toEqual(['original'])
})

it('três carregamentos e ↶/refazer do toast antigo mantêm carimbo e dados externos sem metadados', () => {
 carregar(); carregarOutraVez(); carregarOutraVez()
 const botoes = screen.getAllByRole('button', { name: 'Desfazer', exact: true })
 expect(botoes).toHaveLength(3)
 const antes = JSON.stringify(atual())
 fireEvent.click(botoes[0])
 expect(JSON.stringify(atual())).toBe(antes)
 fireEvent.keyDown(window, { key: 'z', metaKey: true })
 expect(JSON.stringify(atual())).toBe(antes)
 fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
 expect(JSON.stringify(atual())).toBe(antes)
 fireEvent.click(botoes[1])
 expect(atual().categorias[0].itens.map(i => i.estimado)).toEqual([16420])
 fireEvent.click(botoes[2])
 expect(atual().categorias[0].itens.map(i => i.estimado)).toEqual([12000])
 for (const dados of [loadStore(), montarBackup(loadStore()), loadSnapshots()]) {
   expect(JSON.stringify(dados)).not.toMatch(/carregamentoId|carregamentosAtivos|eventoAntes|categoriasSubstituidasDepois|escolhasAplicar/)
 }
})


it('somar, apagar linha, editar nome e ↶: toast sem efeito preserva refazer nome e carimbo', () => {
 carregar('somar')
 fireEvent.click(screen.getByRole('button', { name: 'Remover S4 referência' }))
 expect(atual().categorias[0].itens.map(i => i.estimado)).toEqual([12000])
 fireEvent.change(screen.getByRole('textbox', { name: 'Nome do evento' }), { target: { value: 'Nome posterior' } })
 expect(atual().nome).toBe('Nome posterior')
 fireEvent.keyDown(window, { key: 'z', metaKey: true })
 expect(atual().nome).toBe('S4 sintético')
 const refazer = screen.getByRole('button', { name: /^Refazer:/ })
 const rotulo = refazer.getAttribute('aria-label')
 expect(refazer.disabled).toBe(false)
 const antes = JSON.stringify(atual())
 fireEvent.click(screen.getByRole('button', { name: 'Desfazer', exact: true }))
 expect(JSON.stringify(atual())).toBe(antes)
 expect(refazer.disabled).toBe(false)
 expect(refazer.getAttribute('aria-label')).toBe(rotulo)
 fireEvent.click(refazer)
 expect(atual().nome).toBe('Nome posterior')
 expect(atual().categorias[0].itens.map(i => i.estimado)).toEqual([12000])
})
