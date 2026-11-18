// @vitest-environment jsdom
// Modal e motor reais; somente rede e armazenamento são fronteiras simuladas.
import { StrictMode, useState } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FinanceiroModal from './FinanceiroModal.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { loadSnapshots, restaurarSnapshot } from '../lib/protecao.js'
import { loadStore, saveStore, montarBackup, parseBackup, mesclarBackup } from '../lib/storage.js'

function armazenamento() {
  const dados = new Map()
  return {
    get length() { return dados.size },
    key: (i) => [...dados.keys()][i] ?? null,
    getItem: (k) => dados.get(String(k)) ?? null,
    setItem: (k, v) => { dados.set(String(k), String(v)) },
    removeItem: (k) => { dados.delete(String(k)) },
    clear: () => dados.clear(),
  }
}

const eventoInicial = () => ({
  ...novoEvento('Brisa — prova sintética'), id: 'festa-s1', vendidosAteHoje: 87,
  categorias: [{ id: 'equipe', nome: 'Equipe', itens: [novoItem({ id: 'item-equipe', servico: 'Equipe completa', estimado: 8000 })] }],
})
const resposta = ({ legado = false, equipe = 5000, seguranca = 2400, nomeEquipe = 'Equipe de evento' } = {}) => ({ eventos: [{
  evento_id: 71, nome: 'Brisa externo', data: '2026-10-05', status: 'realizado', empresa: 'Sobrado',
  ingressos_aprovados: 1, receita_ingressos: 400, custos_total: equipe + (seguranca ?? 0),
  ...(legado ? {} : { plano_realizado: { receita: 1234.56, custos: 2345.67 } }),
  custos_por_categoria: [
    { categoria_id: 10, categoria: nomeEquipe, grupo: 'custo_evento', total: equipe },
    ...(seguranca == null ? [] : [{ categoria_id: 20, categoria: 'Segurança', grupo: 'custo_evento', total: seguranca }]),
  ],
}] })

beforeEach(() => {
  vi.stubGlobal('localStorage', armazenamento())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => resposta() })))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

// Reenvia evento E store após cada update; o updater roda no setState React.
// A fila permite introduzir uma edição antes da efetivação, sem trocar props à mão.
function montar({ evento = eventoInicial(), strict = false, enfileirar = false, recusar = false } = {}) {
  const controle = { store: null, pendentes: [], despachos: [] }
  function Harness() {
    const [store, setStore] = useState({ eventos: [evento], benchmarksCustom: [], ajustes: {} })
    controle.store = store
    controle.alterar = (fn) => setStore(fn)
    const efetivar = (fn) => setStore((atual) => {
      const alvo = atual.eventos.find((e) => e.id === evento.id)
      if (!alvo || alvo.status === 'fechado') return atual
      const proximo = fn(alvo)
      return proximo === alvo ? atual : { ...atual, eventos: atual.eventos.map((e) => e.id === alvo.id ? proximo : e) }
    })
    controle.efetivar = () => { for (const fn of controle.pendentes.splice(0)) efetivar(fn) }
    const update = (fn, motivo) => {
      controle.despachos.push(motivo)
      if (recusar && !motivo.startsWith('vincular')) return { ok: false, motivo: 'A previsão mudou; revise os valores novamente.' }
      if (enfileirar && !motivo.startsWith('vincular')) controle.pendentes.push(fn)
      else efetivar(fn)
      return { ok: true }
    }
    return <FinanceiroModal evento={store.eventos.find((e) => e.id === evento.id) || evento} store={store} update={update} onClose={() => {}} />
  }
  render(strict ? <StrictMode><Harness /></StrictMode> : <Harness />)
  return controle
}
async function revisar() {
  fireEvent.click(await screen.findByRole('button', { name: 'Vincular e revisar valores' }))
  await screen.findByText('Revisar dados do Financeiro')
}
const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const aplicado = () => screen.queryByText('Valores aplicados')
const item = (c) => c.store.eventos[0].categorias[0].itens[0]
function somenteBilheteria() {
  const dados = resposta()
  dados.eventos[0].custos_total = 0
  dados.eventos[0].custos_por_categoria = []
  fetch.mockImplementation(async () => ({ ok: true, json: async () => dados }))
}
function aplicar() { fireEvent.click(screen.getByRole('button', { name: /^Aplicar / })) }
function marcar(nome, valor = true) {
  const campo = screen.getByRole('checkbox', { name: `Selecionar ${nome}` })
  if (campo.checked !== valor) fireEvent.click(campo)
}
function escolherDestino(nome) {
  const campo = screen.getByRole('combobox', { name: `Destino de ${nome}` })
  const opcao = [...campo.options].find((o) => o.textContent.includes('Equipe completa'))
  expect(opcao.textContent).toContain('Equipe')
  expect(opcao.textContent).toMatch(/previsto.*8\.000/i)
  fireEvent.change(campo, { target: { value: opcao.value } })
}
function confirmar() {
  const campo = screen.getByRole('checkbox', { name: 'Confirmar total de Equipe completa' })
  expect(campo.checked).toBe(false)
  fireEvent.click(campo)
}
async function consolidar(c) {
  await revisar()
  marcar('Bilheteria realizada (bruta)', false)
  for (const nome of ['Equipe de evento', 'Segurança']) { marcar(nome); escolherDestino(nome) }
  expect(texto()).toContain('7.400')
  expect(texto()).toContain('8.000')
  expect(screen.getByRole('button', { name: /^Aplicar / }).disabled).toBe(true)
  confirmar()
  expect(screen.getByRole('button', { name: /Aplicar 2 valores selecionados em 1 item/ }).disabled).toBe(false)
  aplicar()
  await waitFor(() => expect(aplicado()).not.toBeNull())
  expect(item(c).estimado).toBe(8000)
  expect(item(c).realizado).toBe(7400)
  expect(c.store.eventos[0].categorias[0].itens).toHaveLength(1)
  expect(item(c).viaFinanceiro.origens).toHaveLength(2)
  expect(item(c).viaFinanceiro.origens.map((o) => [o.categoriaId, o.valor])).toEqual([[10, 5000], [20, 2400]])
  expect(c.store.eventos[0].vendidosAteHoje).toBe(87)
}
const eventoComOrigens = () => {
  const e = eventoInicial()
  e.financeiro = { eventoId: 71, eventoNome: 'Brisa externo', empresa: 'Sobrado', atualizadoEm: '2026-10-05T12:00:00.000Z', puxado: {} }
  Object.assign(e.categorias[0].itens[0], {
    realizado: 7400, realizadoAuto: false, status: 'PAGO',
    viaFinanceiro: { versao: 2, valor: 7400, em: '2026-10-05T12:00:00.000Z', origens: [
      { eventoId: 71, categoriaId: 10, categoria: 'Equipe de evento', valor: 5000, em: '2026-10-05T12:00:00.000Z' },
      { eventoId: 71, categoriaId: 20, categoria: 'Segurança', valor: 2400, em: '2026-10-05T12:00:00.000Z' },
    ] },
  })
  return e
}
async function revisarVinculado() { await screen.findByText('Revisar dados do Financeiro') }

describe('S1 — revisão real da ponte', () => {
  it('retorno legado começa sem valores marcados e explica a procedência desconhecida', async () => {
    fetch.mockImplementation(async () => ({ ok: true, json: async () => resposta({ legado: true }) }))
    const c = montar({ strict: true })
    await revisar()
    expect(screen.getAllByRole('checkbox').filter((x) => x.checked)).toHaveLength(0)
    expect(texto()).toMatch(/não permite separar plano de realizado/i)
    expect(c.store.eventos[0].vendidosAteHoje).toBe(87)
    expect(loadSnapshots()).toHaveLength(0)
  })

  it('pagamento fica informativo, sem destino vendido, e plano excluído vem do payload', async () => {
    montar()
    await revisar()
    expect(texto()).not.toContain('Vendidos até hoje')
    expect(texto()).toMatch(/1 pagamento aprovado/i)
    expect(texto()).toMatch(/não informa quantos ingressos foram vendidos/i)
    expect(texto()).toContain('1.234,56')
    expect(texto()).toContain('2.345,67')
  })

  it('primeiro vínculo exige destino e confirmação; duas origens atualizam um item previsto', async () => {
    const c = montar({ strict: true })
    await revisar()
    marcar('Bilheteria realizada (bruta)', false)
    marcar('Equipe de evento')
    const destino = screen.getByRole('combobox', { name: 'Destino de Equipe de evento' })
    expect(destino.selectedOptions[0].textContent).toBe('Escolha o item a atualizar')
    expect(screen.getByRole('button', { name: /^Aplicar / }).disabled).toBe(true)
    expect(loadSnapshots()).toHaveLength(0)
    escolherDestino('Equipe de evento')
    marcar('Segurança')
    escolherDestino('Segurança')
    expect(texto()).toContain('7.400')
    expect(texto()).toContain('8.000')
    confirmar()
    aplicar()
    await waitFor(() => expect(aplicado()).not.toBeNull())
    expect(item(c)).toMatchObject({ id: 'item-equipe', estimado: 8000, realizado: 7400 })
    expect(item(c).viaFinanceiro.origens).toHaveLength(2)
    expect(c.store.eventos[0].categorias[0].itens).toHaveLength(1)
    expect(c.store.eventos[0].vendidosAteHoje).toBe(87)
    expect(c.store.eventos[0].financeiro.puxado.vendidosAteHoje).toBeUndefined()
  })

  it('reconsulta parcial mantém Segurança desmarcada e prévia inclui as duas contribuições', async () => {
    fetch.mockImplementation(async () => ({ ok: true, json: async () => resposta({ equipe: 5200 }) }))
    const c = montar({ evento: eventoComOrigens(), strict: true })
    await revisarVinculado()
    marcar('Bilheteria realizada (bruta)', false)
    marcar('Equipe de evento')
    marcar('Segurança', false)
    expect(texto()).toContain('7.600')
    expect(texto()).toContain('2.400')
    aplicar()
    await waitFor(() => expect(aplicado()).not.toBeNull())
    expect(item(c).realizado).toBe(7600)
    expect(item(c).estimado).toBe(8000)
    expect(item(c).viaFinanceiro.origens.map((o) => o.valor)).toEqual([5200, 2400])
  })

  it('origem ausente permanece com aviso e aparece no total final de 7.700', async () => {
    fetch.mockImplementation(async () => ({ ok: true, json: async () => resposta({ equipe: 5300, seguranca: null }) }))
    const c = montar({ evento: eventoComOrigens() })
    await revisarVinculado()
    marcar('Bilheteria realizada (bruta)', false)
    marcar('Equipe de evento')
    expect(texto()).toMatch(/2\.400.*mantid|mantid.*2\.400/i)
    expect(texto()).toMatch(/não veio nesta consulta|ausente/i)
    expect(texto()).toContain('7.700')
    aplicar()
    await waitFor(() => expect(aplicado()).not.toBeNull())
    expect(item(c).realizado).toBe(7700)
    expect(item(c).viaFinanceiro.origens.map((o) => o.valor)).toEqual([5300, 2400])
  })

  it('aplicar, salvar, recarregar e importar backup preserva destino por ID após renomeação', async () => {
    const c = montar()
    await consolidar(c)
    expect(saveStore(c.store).ok).toBe(true)
    const carregado = loadStore()
    const backup = parseBackup(JSON.stringify(montarBackup(carregado)))
    const importado = mesclarBackup({ eventos: [], benchmarksCustom: [], ajustes: {} }, backup)
    expect(importado.eventos[0].categorias[0].itens[0].viaFinanceiro).toEqual(item(c).viaFinanceiro)
    cleanup()
    fetch.mockImplementation(async () => ({ ok: true, json: async () => resposta({ nomeEquipe: 'Produção renomeada', equipe: 5300 }) }))
    const novo = montar({ evento: importado.eventos[0], strict: true })
    await revisarVinculado()
    marcar('Bilheteria realizada (bruta)', false)
    marcar('Produção renomeada')
    marcar('Segurança', false)
    aplicar()
    await waitFor(() => expect(aplicado()).not.toBeNull())
    expect(novo.store.eventos[0].categorias[0].itens).toHaveLength(1)
    expect(item(novo)).toMatchObject({ id: 'item-equipe', estimado: 8000, realizado: 7700 })
    expect(item(novo).viaFinanceiro.origens).toHaveLength(2)
    expect(item(novo).viaFinanceiro.origens.find((o) => o.categoriaId === 10).categoria).toBe('Produção renomeada')
  })

  it('snapshot real restaura item, previsto e vínculo que existiam antes da aplicação', async () => {
    const c = montar()
    await consolidar(c)
    const snapshot = loadSnapshots().find((s) => s.rotulo === 'antes de aplicar dados do Financeiro')
    expect(snapshot).toBeDefined()
    expect(snapshot.store.eventos[0].categorias[0].itens[0].realizado).not.toBe(7400)
    const r = restaurarSnapshot(snapshot.id, c.store)
    expect(r.ok).toBe(true)
    act(() => c.alterar(() => r.store))
    expect(item(c)).toMatchObject({ id: 'item-equipe', estimado: 8000, realizado: '' })
    expect(item(c).viaFinanceiro).toBeUndefined()
    expect(c.store.eventos[0].financeiro.eventoId).toBe(71)
  })

  it('desfazer imediato restaura uma vez e repetição não duplica item nem aplicação', async () => {
    const c = montar({ strict: true })
    await consolidar(c)
    const antes = loadSnapshots()[0].store.eventos[0]
    const botao = screen.getByRole('button', { name: 'Desfazer valores aplicados' })
    act(() => { fireEvent.click(botao); fireEvent.click(botao) })
    await waitFor(() => expect(item(c).realizado).toBe(antes.categorias[0].itens[0].realizado))
    expect(item(c)).toEqual(antes.categorias[0].itens[0])
    expect(c.store.eventos[0].categorias[0].itens).toHaveLength(1)
    const deNovo = screen.queryByRole('button', { name: 'Desfazer valores aplicados' })
    if (deNovo) fireEvent.click(deNovo)
    expect(item(c)).toEqual(antes.categorias[0].itens[0])
  })

  it('desfazer depois de edição manual não perde o valor posterior e explica recuperação', async () => {
    const c = montar()
    await consolidar(c)
    act(() => c.alterar((s) => ({ ...s, eventos: s.eventos.map((e) => ({ ...e, categorias: e.categorias.map((cat) => ({ ...cat, itens: cat.itens.map((i) => ({ ...i, realizado: 7900 })) })) })) })))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer valores aplicados' }))
    expect(item(c).realizado).toBe(7900)
    expect(item(c).estimado).toBe(8000)
    expect(texto()).toMatch(/Proteção de dados/i)
    expect(texto()).toMatch(/edit|alter|mud/i)
  })

  it('desfazer depois de fechar evento preserva os números congelados', async () => {
    const c = montar()
    await consolidar(c)
    act(() => c.alterar((s) => ({ ...s, eventos: s.eventos.map((e) => ({ ...e, status: 'fechado' })) })))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer valores aplicados' }))
    expect(item(c).realizado).toBe(7400)
    expect(c.store.eventos[0].status).toBe('fechado')
    expect(texto()).toMatch(/fechado|Proteção de dados/i)
  })

  it('update recusado mostra motivo sem anunciar aplicação', async () => {
    somenteBilheteria()
    const c = montar({ recusar: true })
    await revisar()
    const antes = structuredClone(c.store)
    aplicar()
    expect(aplicado()).toBeNull()
    expect(c.store).toEqual(antes)
    expect(texto()).toMatch(/previsão mudou|revise os valores/i)
  })

  it('seleção vazia preserva valores e não cria snapshot; vínculo pertence à etapa de escolha', async () => {
    const c = montar()
    await revisar()
    screen.getAllByRole('checkbox').filter((x) => x.checked).forEach((x) => fireEvent.click(x))
    const antes = structuredClone(c.store)
    const botao = screen.getByRole('button', { name: /Nada selecionado para aplicar/i })
    expect(botao.disabled).toBe(true)
    fireEvent.click(botao)
    expect(c.store).toEqual(antes)
    expect(c.store.eventos[0].financeiro.eventoId).toBe(71)
    expect(item(c).estimado).toBe(8000)
    expect(c.store.eventos[0].vendidosAteHoje).toBe(87)
    expect(loadSnapshots()).toHaveLength(0)
  })

  it('snapshot recusado impede valores e sucesso, com mensagem visível', async () => {
    somenteBilheteria()
    const c = montar()
    await revisar()
    const antes = structuredClone(c.store)
    const setItem = localStorage.setItem
    localStorage.setItem = (k, v) => {
      if (k.includes('snapshots')) throw new DOMException('quota da prova', 'QuotaExceededError')
      return setItem(k, v)
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    aplicar()
    expect(c.store).toEqual(antes)
    expect(aplicado()).toBeNull()
    expect(texto()).toMatch(/não deu para guardar.*segurança/i)
    expect(loadSnapshots()).toHaveLength(0)
  })

  it('despacho aguarda props efetivadas e duplo clique não repete aplicação ou snapshot', async () => {
    somenteBilheteria()
    const c = montar({ strict: true, enfileirar: true })
    await revisar()
    const botao = screen.getByRole('button', { name: /^Aplicar / })
    act(() => { fireEvent.click(botao); fireEvent.click(botao) })
    expect(aplicado()).toBeNull()
    expect(c.pendentes).toHaveLength(1)
    expect(loadSnapshots()).toHaveLength(1)
    expect(c.store.eventos[0].receitaRealizada.bilheteria).not.toBe(400)
    act(() => c.efetivar())
    await waitFor(() => expect(aplicado()).not.toBeNull())
    expect(c.store.eventos[0].receitaRealizada.bilheteria).toBe(400)
    expect(c.store.eventos[0].vendidosAteHoje).toBe(87)
  })

  it.each(['fechado', 'alterado', 'removido'])('evento %s antes do updater não recebe valores nem mostra sucesso', async (caso) => {
    somenteBilheteria()
    const c = montar({ strict: true, enfileirar: true })
    await revisar()
    aplicar()
    act(() => {
      c.alterar((s) => ({ ...s, eventos: caso === 'removido' ? [] : s.eventos.map((e) => caso === 'fechado' ? { ...e, status: 'fechado' } : { ...e, nome: 'Brisa editada durante a revisão' }) }))
      c.efetivar()
    })
    expect(aplicado()).toBeNull()
    if (caso !== 'removido') expect(c.store.eventos[0].receitaRealizada.bilheteria).not.toBe(400)
    else expect(c.store.eventos).toHaveLength(0)
    expect(texto()).toMatch(/revis|fechado|não.*aplic|não.*encontr|mud/i)
  })
})
