// @vitest-environment jsdom
import { it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import OrcamentoProdutorModal from './OrcamentoProdutorModal.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { montarAOAOrcamento } from '../lib/xlsxOrcamento.js'
import { gerarXlsx } from '../lib/xlsxOrcamentoV2.js'
import { COL_V2 } from '../lib/orcamentoV2Contrato.js'
vi.mock('../lib/marcaPng.js',()=>({gerarLogoPng:vi.fn(async()=>null)}))
beforeEach(()=>{const mem=new Map();vi.stubGlobal('localStorage',{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),key:i=>[...mem.keys()][i]??null,get length(){return mem.size}});vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Rede não autorizada no teste')}))})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const file=(aoa)=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Orçamento');return {name:'orcamento.xlsx',arrayBuffer:async()=>XLSX.write(wb,{type:'array',bookType:'xlsx'})}}
it.each(['v1','v2'])('P3 — modal %s expõe original e recusa sem dizer nenhuma diferença',async versao=>{
  const ev=novoEvento('Festa sintética');ev.tipo='Brisa';const item=novoItem({servico:'Gerador',estimado:12000});ev.categorias[0].itens=[item]
  let aoa
  if(versao==='v1'){aoa=montarAOAOrcamento(ev);aoa.find(r=>r[0]===item.id)[4]='R$ 8.000 (2 dias)'}
  else {const wb=XLSX.read(await gerarXlsx(ev,{}),{type:'buffer'});aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});aoa.find(r=>r[COL_V2.id]===item.id)[COL_V2.estimado]='R$ 8.000 (2 dias)'}
  const update=vi.fn();const {container}=render(<OrcamentoProdutorModal evento={ev} update={update} store={{eventos:[ev]}} onClose={()=>{}} />)
  fireEvent.change(container.querySelector('input[type=file]'),{target:{files:[file(aoa)]}})
  expect(await screen.findByText(/R\$ 8\.000 \(2 dias\)/)).toBeTruthy()
  expect(screen.queryByText(/Nenhuma diferença entre/)).toBeNull()
  expect(update).not.toHaveBeenCalled()
})

it('P3 — a proposta de limpar texto salvo ilegível mostra o original, sem apresentá-lo como R$ 0', async () => {
  const ev = novoEvento('Limpeza sintética')
  const item = novoItem({ servico: 'Gerador', estimado: 12000 })
  ev.categorias[0].itens = [item]
  ev.patrocinios = [{ id: 'pat-sintetico', patrocinador: 'Marca sintética', valor: 9000, estagio: 'proposta' }]
  const aoa = montarAOAOrcamento(ev)
  aoa.find(r => r[0] === item.id)[4] = ''
  aoa.find(r => r[0] === 'pat-sintetico')[2] = ''
  item.estimado = 'R$ 8 mil'
  ev.patrocinios[0].valor = 'R$ 9 mil'
  const { container } = render(<OrcamentoProdutorModal evento={ev} update={vi.fn()} store={{ eventos: [ev] }} onClose={() => {}} />)
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file(aoa)] } })
  await screen.findByRole('heading', { name: 'Revisar retorno do produtor' })
  expect(screen.getByText(/Estimado:.*R\$ 8 mil.*não reconhecido/)).toBeTruthy()
  expect(screen.getByText(/Valor:.*R\$ 9 mil.*não reconhecido/)).toBeTruthy()
  expect(screen.queryByText(/(?:Estimado|Valor): R\$\s*0 →/)).toBeNull()
})

it('a revisão mostra a diferença de um centavo no custo e no patrocínio', async () => {
  const ev = novoEvento('Centavos sintéticos')
  const item = novoItem({ servico: 'Som', estimado: 8000.01 })
  ev.categorias[0].itens = [item]
  ev.patrocinios = [{ id: 'pat-centavos', patrocinador: 'Marca sintética', valor: 8000.01, estagio: 'proposta' }]
  const aoa = montarAOAOrcamento(ev)
  aoa.find(r => r[0] === item.id)[4] = 8000.02
  aoa.find(r => r[0] === 'pat-centavos')[2] = 8000.02
  const { container } = render(<OrcamentoProdutorModal evento={ev} update={vi.fn()} store={{ eventos: [ev] }} onClose={() => {}} />)
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file(aoa)] } })
  await screen.findByRole('heading', { name: 'Revisar retorno do produtor' })
  expect(screen.getAllByText(/R\$\s*8\.000,01 → R\$\s*8\.000,02/)).toHaveLength(2)
})


it.each(['v1', 'v2'])('erro nativo Excel no produtor %s é recusado com original, e a linha saudável segue na proposta', async versao => {
  const ev = novoEvento('Erros Excel sintéticos')
  const invalido = novoItem({ servico: 'Gerador inválido', estimado: 12000 })
  const saudavel = novoItem({ servico: 'Som saudável', estimado: 1000 })
  ev.categorias[0].itens = [invalido, saudavel]
  let wb
  if (versao === 'v1') {
    wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(montarAOAOrcamento(ev)), 'Orçamento')
  } else wb = XLSX.read(await gerarXlsx(ev, {}), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const linhaInvalida = linhas.findIndex(r => r[0] === invalido.id)
  const linhaSaudavel = linhas.findIndex(r => r[0] === saudavel.id)
  ws[XLSX.utils.encode_cell({ r: linhaInvalida, c: 4 })] = { t: 'e', v: 15 }
  ws[XLSX.utils.encode_cell({ r: linhaSaudavel, c: 4 })] = { t: 'n', v: 2000 }
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  expect(XLSX.read(bytes, { type: 'array' }).Sheets[wb.SheetNames[0]][XLSX.utils.encode_cell({ r: linhaInvalida, c: 4 })].t).toBe('e')
  const update = vi.fn()
  const { container } = render(<OrcamentoProdutorModal evento={ev} update={update} store={{ eventos: [ev] }} onClose={() => {}} />)
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [{ name: 'erro.xlsx', arrayBuffer: async () => bytes }] } })
  await screen.findByRole('heading', { name: 'Revisar retorno do produtor' })
  expect(screen.getByText(/#VALUE!/)).toBeTruthy()
  expect(screen.getByText(/Som saudável/)).toBeTruthy()
  expect(screen.queryByText(/Estimado:.*12\.000.*→/)).toBeNull()
  expect(update).not.toHaveBeenCalled()
  expect(ev.categorias[0].itens.map(i => i.estimado)).toEqual([12000, 1000])
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: versao === 'v1' ? /Aplicar 1 mudança selecionada/ : /Aplicar 1 alt/ }))
  expect(update).toHaveBeenCalledTimes(1)
  const aplicado = update.mock.calls[0][0](structuredClone(ev))
  expect(aplicado.categorias[0].itens.map(i => i.estimado)).toEqual([12000, 2000])
  expect(ev.categorias[0].itens.map(i => i.estimado)).toEqual([12000, 1000])
})
