// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import ReportView from './ReportView.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { benchmarksAtivos, CAT_KEYS, CAT_LABELS, FIXED_BENCHMARKS, ETIQUETA_SEM_RESERVA } from '../lib/benchmarks.js'
import { computeCenarios } from '../lib/calc.js'
import { colunaCustoPrevisao } from '../lib/comparacaoCustos.js'
import { fmtBRL, fmtInt, DASH } from '../lib/format.js'
import { AJUSTE_CUSTO_LABEL } from '../lib/dre.js'
const KEY = 'previsao-eventos:relatorio-nivel:v1'
beforeEach(() => {
  const mapa = new Map([[KEY, 'completo']])
  vi.stubGlobal('localStorage', { getItem: k => mapa.get(k) ?? null, setItem: vi.fn((k,v) => mapa.set(k,String(v))) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function fixture(n, ajuste = 0, outras = false) {
  const evento = novoEvento('Previsão sintética S5')
  evento.categorias.forEach((c,i) => { c.itens = [novoItem({ estimado: 1200.37 + i * 111.13 })] })
  if (outras) evento.categorias.push({ id: 'fora', nome: 'Fora', itens: [novoItem({ estimado: 333.33 })] })
  evento.publicoEstimado = 321
  evento.cenariosConfig.realista.custoPct = ajuste
  const refs = Array.from({length:n}, (_,i) => ({ id: `z-${n-i}`, nome: i===1 ? 'Referência igual' : i===2 ? 'Referência igual' : `Referência ${i+1} integral`, publico: 100+i, semReserva:i===n-1, obs:i===n-1?'Observação final S5':'', custos: Object.fromEntries(CAT_KEYS.map((k,j)=>[k, i===0 && j===0 ? 0 : i===0 && j===1 ? null : i===0 && j===2 ? -321 : (i+1)*10000+(j+1)*137])), custoTotal: 93331+i*1000 }))
  if (refs.length) refs[0].custoTotal = Object.values(refs[0].custos).reduce((s,v)=>s+(v || 0),0)+1
  evento.benchmarksAtivos = refs.map(b=>b.id).reverse()
  return { evento, store: { eventos:[evento], benchmarksCustom:refs, benchmarkOverrides:{}, ajustes:{} } }
}
function secao(container) { return [...container.querySelectorAll('h2')].find(h=>h.textContent==='Comparação com eventos passados')?.parentElement }
function conferir(container, evento, store) {
  const refs = benchmarksAtivos(evento,store)
  if (!refs.length) { expect(secao(container)).toBeUndefined(); return }
  const tables = [...secao(container).querySelectorAll('table')]
  expect(tables).toHaveLength(Math.ceil(refs.length/4))
  const realista = computeCenarios(evento).realista
  const col = colunaCustoPrevisao(realista,k=>realista.custosCategorias.find(c=>c.id===k)?.considerado || 0)
  const previsoes = []
  tables.forEach((table,faixa) => {
    const grupo = refs.slice(faixa*4,faixa*4+4)
    const heads = [...table.querySelectorAll('thead tr:last-child th')]
    expect(heads).toHaveLength(2+grupo.length)
    expect(table.querySelector('thead tr:first-child').textContent).toBe(`Referências ${faixa*4+1}–${faixa*4+grupo.length} de ${refs.length}`)
    expect(heads[0].textContent).toBe('Categoria')
    expect(heads[1].firstElementChild.textContent).toBe(`${evento.nome} (previsão)`)
    expect(heads[1].lastElementChild.textContent).toBe(`${fmtInt(realista.publico || evento.publicoEstimado)} pessoas`)
    grupo.forEach((b,i) => {
      expect(heads[i+2].firstElementChild.textContent).toBe(b.nome)
      expect(heads[i+2].lastElementChild.textContent).toBe(`${b.publico ? `${fmtInt(b.publico)} pessoas` : DASH}${b.semReserva ? ETIQUETA_SEM_RESERVA : ''}`)
    })
    const rows = [...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent))
    const esperado = col.categorias.map(c=>[CAT_LABELS[c.id], c.exibido ? fmtBRL(c.exibido):DASH, ...grupo.map(b=>b.custos[c.id] != null ? fmtBRL(b.custos[c.id]):DASH)])
    if(col.outras.mostrar) esperado.push(['Outras categorias',fmtBRL(col.outras.exibido),...grupo.map(()=>DASH)])
    esperado.push([`Contingência (${evento.contingenciaPct}%)`,fmtBRL(col.contingencia.exibido),...grupo.map(()=>DASH)])
    if(col.ajuste.mostrar) esperado.push([AJUSTE_CUSTO_LABEL,`${col.ajuste.exibido>0?'+ ':'− '}${fmtBRL(Math.abs(col.ajuste.exibido))}`,...grupo.map(()=>DASH)])
    esperado.push(['Custo total',fmtBRL(col.total),...grupo.map(b=>fmtBRL(b.custoTotal))])
    expect(rows).toEqual(esperado)
    previsoes.push(rows.map(r=>r[1]))
  })
  previsoes.forEach(p=>expect(p).toEqual(previsoes[0]))
}
describe('matriz completa por referência e linha', () => {
  it.each([0,1,4,5,6,7,9])('%i referências preservam ordem, células e previsão em faixas de quatro', n => {
    const {evento,store}=fixture(n)
    const antes=structuredClone({evento,store})
    const {container}=render(<ReportView evento={evento} store={store} onBack={()=>{}} />)
    conferir(container,evento,store)
    expect({evento,store}).toEqual(antes)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
  it.each([-12,17])('preserva outras categorias, contingência e ajuste %i do realista', ajuste => {
    const {evento,store}=fixture(9,ajuste,true)
    expect(computeCenarios(evento).realista.custoTotal).not.toBe(computeCenarios(evento).pessimista.custoTotal)
    const {container}=render(<ReportView evento={evento} store={store} onBack={()=>{}} />)
    conferir(container,evento,store)
  })
  it('usa padrões, overrides, ocultos, apagados e seleção do resolvedor',()=>{
    const {evento,store}=fixture(7)
    evento.benchmarksAtivos.push(...FIXED_BENCHMARKS.map(b=>b.id))
    store.benchmarksPadrao={[FIXED_BENCHMARKS[0].id]:{...FIXED_BENCHMARKS[0],nome:'Padrão integral'}}
    store.benchmarkOverrides={[FIXED_BENCHMARKS[1].id]:{nome:'Override integral'}}
    store.benchmarksOcultos=[FIXED_BENCHMARKS[2].id,store.benchmarksCustom[0].id]
    store.benchmarksApagados=[FIXED_BENCHMARKS[3].id]
    evento.benchmarksAtivos=evento.benchmarksAtivos.filter(id=>id!==store.benchmarksCustom[1].id)
    const {container}=render(<ReportView evento={evento} store={store} onBack={()=>{}} />)
    conferir(container,evento,store)
  })
  it('mantém aviso e observação da referência final quebrada',()=>{
    const {evento,store}=fixture(9)
    store.benchmarksCustom[8].custos.aeb='ilegível S5'
    const {container}=render(<ReportView evento={evento} store={store} onBack={()=>{}} />)
    conferir(container,evento,store)
    expect(secao(container).textContent).toContain('Observação final S5')
    expect(secao(container).textContent).toContain('não consegue calcular (A&B)')
    expect(secao(container).textContent).toContain(store.benchmarksCustom[8].nome)
  })
  it('alternar nível mantém preferência e Voltar chama onBack',()=>{
    const {evento,store}=fixture(5)
    const onBack=vi.fn()
    const {container,getByText}=render(<ReportView evento={evento} store={store} onBack={onBack} />)
    fireEvent.click(getByText('Resumido')); expect(secao(container)).toBeUndefined()
    expect(localStorage.setItem).toHaveBeenLastCalledWith(KEY,'resumido')
    fireEvent.click(getByText('Completo')); conferir(container,evento,store)
    fireEvent.click(getByText('Voltar')); expect(onBack).toHaveBeenCalledOnce()
  })
})
