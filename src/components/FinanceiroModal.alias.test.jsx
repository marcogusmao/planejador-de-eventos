// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import FinanceiroModal from './FinanceiroModal.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
const em='2026-10-05T12:00:00.000Z'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('expõe disputa da contribuição na revisão, sem snapshot nem aplicação',async()=>{
  const mapa=new Map();vi.stubGlobal('localStorage',{getItem:k=>mapa.get(k)||null,setItem:(k,v)=>mapa.set(k,String(v)),removeItem:k=>mapa.delete(k),key:i=>[...mapa.keys()][i],get length(){return mapa.size}})
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({eventos:[{evento_id:71,nome:'Brisa externa',ingressos_aprovados:1,receita_ingressos:400,custos_total:7600,plano_realizado:{receita:0,custos:0},custos_por_categoria:[{categoria_id:10,categoria:'Equipe',total:5200},{categoria_id:null,categoria:'Segurança',total:2400}]}]})})))
  const inicial={...novoEvento('Brisa sintética'),financeiro:{eventoId:71,eventoNome:'Brisa externa'},categorias:[{id:'equipe',nome:'Equipe',itens:[novoItem({id:'item',servico:'Equipe completa',estimado:8000,realizado:5000,viaFinanceiro:{versao:2,valor:5000,em,origens:[{eventoId:71,categoriaId:10,categoria:'Equipe',valor:5000,em}]}})]}]}
  let observado
  function Harness(){const [store,setStore]=useState({eventos:[inicial],benchmarksCustom:[],ajustes:{}});observado=store;return <FinanceiroModal evento={store.eventos[0]} store={store} update={fn=>{setStore(s=>({...s,eventos:[fn(s.eventos[0])]}));return {ok:true}}} onClose={()=>{}}/>}
  render(<Harness/>);await screen.findByLabelText('Selecionar Segurança')
  fireEvent.click(screen.getByLabelText('Selecionar Segurança'))
  const reconhecimento=screen.getByLabelText('Reconhecer origem anterior de Segurança')
  fireEvent.change(reconhecimento,{target:{value:JSON.stringify(['id',71,10])}})
  expect(screen.getByText(/selecionam a mesma contribuição de origem/)).toBeTruthy()
  expect(screen.getByRole('button',{name:/^Aplicar/}).disabled).toBe(true)
  expect(observado.eventos[0].categorias[0].itens[0].realizado).toBe(5000)
  expect([...mapa.keys()].some(k=>k.includes('snapshot'))).toBe(false)
})
it('reconhecimento tira o aviso da origem substituída; desmarcar recupera o aviso anterior', async () => {
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ eventos: [{
  evento_id: 71, nome: 'Festa externa', ingressos_aprovados: 0, receita_ingressos: 0,
  custos_total: 5300, plano_realizado: { receita: 0, custos: 0 },
  custos_por_categoria: [{ categoria_id: null, categoria: 'Equipe nova', total: 5300 }],
 }] }) })))
 const origem = { eventoId: 71, categoriaId: 10, categoria: 'Equipe', valor: 5000, em }
 const evento = { ...novoEvento('Festa sintética'), financeiro: { eventoId: 71 }, categorias: [{
  id: 'equipe', nome: 'Equipe', itens: [novoItem({ id: 'item', servico: 'Equipe', estimado: 8000, realizado: 5000,
   viaFinanceiro: { versao: 2, valor: 5000, em, origens: [origem] } })],
 }] }
 render(<FinanceiroModal evento={evento} store={{ eventos: [evento] }} update={() => ({ ok: true })} onClose={() => {}} />)
 await screen.findByLabelText('Selecionar Equipe nova')
 expect(screen.getByText(/5.000 mantidos/)).toBeTruthy()
 fireEvent.click(screen.getByLabelText('Selecionar Equipe nova'))
 fireEvent.change(screen.getByLabelText('Reconhecer origem anterior de Equipe nova'), { target: { value: JSON.stringify(['id',71,10]) } })
 expect(screen.queryByText(/5.000 mantidos/)).toBeNull()
 expect(screen.queryByText(/5.300.*mantidos/)).toBeNull()
 expect(screen.getByText(/atualizarão este item para/).textContent).toContain('5.300')
 fireEvent.click(screen.getByLabelText('Selecionar Equipe nova'))
 expect(screen.getByText(/5.000 mantidos/)).toBeTruthy()
})
