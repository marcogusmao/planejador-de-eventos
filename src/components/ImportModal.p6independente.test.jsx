// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import ImportModal from './ImportModal.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { custosPorCategoria } from '../lib/calc.js'
import { liberarGravacao, loadStore, saveStore, montarBackup, parseBackup, mesclarBackup } from '../lib/storage.js'
import { loadSnapshots, restaurarSnapshot } from '../lib/protecao.js'

const vazio = () => ({ eventos: [], benchmarksCustom: [], benchmarkOverrides: {}, benchmarksPadrao: {}, ajustes: {} })
const custo = evento => custosPorCategoria(evento.categorias).totalConsiderado
const cabecalho = ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status']
const linha = (nome, valor) => ['Produção', nome, 'Fornecedor sintético', valor, 'ORÇAR']
const planilha = () => [['ESTRUTURA + CENOGRAFIA'], cabecalho,
  linha('Som', 15000), linha('Desconto do fornecedor', '(2.500,00)'), [],
  ['Lote', 'Valor unitário', 'Qtd'], ['Lote válido', 100, 200], ['Lote inválido', -50, 300]]
const arquivo = aoa => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Ensaio sintético')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return { name: 'Ensaio sintético P6.xlsx', arrayBuffer: async () => buffer }
}
let falharSnapshot
beforeEach(() => {
  const mem = new Map()
  falharSnapshot = false
  vi.stubGlobal('localStorage', {
    getItem: k => mem.get(k) ?? null,
    setItem: (k, v) => {
      if (falharSnapshot && k.includes(':snapshots:')) throw new Error('Quota simulada dos snapshots')
      mem.set(k, String(v))
    },
    removeItem: k => mem.delete(k), clear: () => mem.clear(),
    key: i => [...mem.keys()][i] ?? null, get length() { return mem.size },
  })
  liberarGravacao()
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede real proibida no ensaio') }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function abrir(inicial = vazio()) {
  let atual
  let alterar
  const fechar = vi.fn()
  const navegar = vi.fn()
  function Ensaio() {
    const [store, setStore] = useState(inicial)
    atual = store
    alterar = setStore
    return <ImportModal store={store} setStore={setStore} abrir={navegar} onClose={fechar} />
  }
  render(<Ensaio />)
  fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [arquivo(planilha())] } })
  await screen.findByRole('heading', { name: 'Revisar importação' })
  return { ler: () => atual, alterar: fn => alterar(fn), fechar, navegar }
}
async function aplicar(fluxo) {
  const antes = fluxo.ler().eventos.length
  fireEvent.click(screen.getByRole('button', { name: /^Importar \d|^Confirmar importação$/ }))
  await waitFor(() => expect(fluxo.ler().eventos.length).toBe(antes + 1))
}

describe('P6 — conferência independente do ciclo de importação', () => {
  it('R$ 15.000 aceitos permanecem iguais no store, reload, backup reimportado e restauração real', async () => {
    const fluxo = await abrir()
    await aplicar(fluxo)
    expect(fluxo.ler().eventos).toHaveLength(1)
    const evento = fluxo.ler().eventos[0]
    expect(custo(evento)).toBe(15000)
    expect(evento.lotes.map(l => [l.valor, l.quantidade])).toEqual([[100, 200]])
    expect(fluxo.fechar).not.toHaveBeenCalled()
    expect(fluxo.navegar).not.toHaveBeenCalled()
    expect(saveStore(fluxo.ler()).ok).toBe(true)
    expect(custo(loadStore().eventos[0])).toBe(15000)
    const backup = parseBackup(JSON.stringify(montarBackup(fluxo.ler())))
    const reimportado = mesclarBackup(vazio(), backup)
    expect(saveStore(reimportado).ok).toBe(true)
    expect(custo(loadStore().eventos[0])).toBe(15000)
    const snapshots = loadSnapshots()
    expect(snapshots.length).toBeGreaterThan(0)
    const volta = restaurarSnapshot(snapshots[0].id, fluxo.ler())
    expect(volta.ok).toBe(true)
    expect(volta.store.eventos).toEqual([])
    expect(saveStore(volta.store).ok).toBe(true)
    expect(loadStore().eventos).toEqual([])
  })

  it('falha no snapshot mantém a revisão e não cria evento nem navega', async () => {
    const fluxo = await abrir()
    falharSnapshot = true
    fireEvent.click(screen.getByRole('button', { name: /^Importar \d|^Confirmar importação$/ }))
    await waitFor(() => expect(screen.getByText(/NADA foi importado/i)).toBeTruthy())
    expect(fluxo.ler().eventos).toEqual([])
    expect(fluxo.fechar).not.toHaveBeenCalled()
    expect(fluxo.navegar).not.toHaveBeenCalled()
    expect(loadSnapshots()).toEqual([])
  })

  it('desfazer pela tela remove só a importação e preserva uma edição posterior em outra festa', async () => {
    const anterior = novoEvento('Festa anterior sintética')
    anterior.categorias = anterior.categorias.map(c => ({ ...c, itens: c.id === 'estrutura' ? [novoItem({ servico: 'Luz anterior', estimado: 6000 })] : [] }))
    const fluxo = await abrir({ ...vazio(), eventos: [anterior] })
    await aplicar(fluxo)
    // A atualização vem de outra operação na mesma sessão, com novo render.
    const { act } = await import('@testing-library/react')
    await act(async () => fluxo.alterar(s => ({ ...s, eventos: s.eventos.map(e => e.id === anterior.id ? { ...e, nome: 'Festa anterior editada depois' } : e) })))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer importação da planilha' }))
    await waitFor(() => expect(fluxo.ler().eventos).toHaveLength(1))
    expect(fluxo.ler().eventos[0].id).toBe(anterior.id)
    expect(fluxo.ler().eventos[0].nome).toBe('Festa anterior editada depois')
    expect(custo(fluxo.ler().eventos[0])).toBe(6000)
    expect(saveStore(fluxo.ler()).ok).toBe(true)
    expect(loadStore().eventos.map(e => e.nome)).toEqual(['Festa anterior editada depois'])
  })
})
