// @vitest-environment jsdom
// Diagnóstico S0: asserções do comportamento esperado, deliberadamente vermelhas
// na base. Não é autorização para escolher regra de produto ou alterar schema.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import ImportModal from '../../src/components/ImportModal.jsx'
import FinanceiroModal from '../../src/components/FinanceiroModal.jsx'
import CostsTab from '../../src/components/CostsTab.jsx'
import { novoEvento, novoItem } from '../../src/lib/defaults.js'
import { parseMoney, parseWorkbookData, somaItens } from '../../src/lib/xlsxImport.js'
import { validarEventosFinanceiro, montarPropostas, aplicarSelecionados } from '../../src/lib/financeiro.js'
import { custosPorCategoria, computeCenarios } from '../../src/lib/calc.js'
import { censoNormalizacoes } from '../../src/lib/migracao.js'
import { loadStore, saveStore, liberarGravacao, montarBackup, parseBackup } from '../../src/lib/storage.js'
import { loadSnapshots, restaurarSnapshot } from '../../src/lib/protecao.js'

const instante = '2026-10-05T12:00:00.000Z'
const vazio = () => ({ eventos: [], benchmarksCustom: [], benchmarkOverrides: {}, benchmarksPadrao: {}, ajustes: {} })
const eventoVazio = () => {
  const e = novoEvento('Festa sintética S0')
  e.categorias = e.categorias.map(c => ({ ...c, itens: [] }))
  e.contingenciaPct = 0
  return e
}
const custo = e => custosPorCategoria(e.categorias).totalConsiderado
const recibo = (id, dados) => console.info(`S0 ${id} ${JSON.stringify(dados)}`)
const cabecalho = ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status']
const linha = (nome, valor) => ['Produção', nome, 'Fornecedor sintético', valor, 'ORÇAR']
const arquivo = (aoa) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Orçamento')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return { name: '2026-10-05-fixture-sintetica.xlsx', arrayBuffer: async () => buffer, buffer }
}
const planilhaTexto = () => [['ESTRUTURA + CENOGRAFIA'], cabecalho,
  linha('Palco', 'R$ 8.000 (2 dias)'), linha('PA', 'R$ 2.000/dia'),
  linha('Iluminação', 'R$ 15.000 - 3 diárias'), linha('Gerador', 12000)]
const equipe = () => [['EQUIPE'], ['Serviço / produto', 'Fornecedor', 'Qtd', 'Valor unitário', 'Status'],
  ['Garçom', 'Fornecedor sintético', 20, 250, 'ORÇAR'], ['Segurança', 'Fornecedor sintético', 8, 300, 'ORÇAR']]
const tresSecoes = () => [['ESTRUTURA + CENOGRAFIA'], cabecalho, linha('Som', 15000), linha('Luz', 18000), [],
  ...equipe(), [], ['ARTISTICO'], cabecalho, linha('DJ', 30000)]
const negativos = () => [['ESTRUTURA + CENOGRAFIA'], cabecalho, linha('Som', 15000),
  linha('Desconto do fornecedor', '(2.500,00)'), [], ['Lote', 'Valor unitário', 'Qtd'],
  ['Lote 1', 100, 200], ['Lote 2', -50, 300]]

// Formato antigo: prova histórica s1-ponte.json, plano-volta-como-realizado-da-tiqueteira.
// Formato novo: handoff consolidado S1 e fonte técnica §3, Financeiro 608b12a.
// A rota nova já exclui plano dos agregados; plano_realizado informa o excluído.
const resposta = ({ categorias = [], pagamentos = 0, receita = 0, nova = false } = {}) => ({ eventos: [{
  evento_id: 71, nome: 'Festa sintética S0', ingressos_aprovados: pagamentos,
  receita_ingressos: receita, custos_total: categorias.reduce((s, c) => s + c.total, 0),
  custos_por_categoria: categorias,
  ...(nova ? { plano_realizado: { receita: 20250, custos: 14000 } } : {}),
}] })
const normalizar = p => validarEventosFinanceiro(p)[0]
const aplicar = (e, p) => {
  const ef = normalizar(p)
  const m = montarPropostas(e, ef)
  return { ...m, evento: aplicarSelecionados(e, ef, m.propostas, m.propostas.map(p => p.id), instante).evento }
}
beforeEach(() => {
  const mem = new Map()
  vi.stubGlobal('localStorage', {
    getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null,
    get length() { return mem.size },
  })
  liberarGravacao()
  // Nenhuma consulta real: todo fetch precisa ser substituído explicitamente.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede real proibida na S0') }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function abrirPlanilha(aoa) {
  let store = vazio()
  const antes = structuredClone(store)
  render(<ImportModal store={store} setStore={fn => { store = fn(store) }} abrir={() => {}} onClose={() => {}} />)
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [arquivo(aoa)] } })
  await waitFor(() => expect(screen.queryByText('Revisar importação')).not.toBeNull())
  return { ler: () => store, antes, confirmar: () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar importação' })) }
}
async function abrirPonte(payload, e = eventoVazio()) {
  e.financeiro = { eventoId: 71, eventoNome: 'Festa sintética S0', puxado: {} }
  const store = { ...vazio(), eventos: [e] }
  let atual = e
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })))
  render(<FinanceiroModal evento={e} store={store} update={fn => { atual = fn(atual) }} onClose={() => {}} />)
  await waitFor(() => expect(screen.queryByText('Revisar dados do Financeiro')).not.toBeNull())
  return { ler: () => atual, store, aplicar: () => {
    const botao = screen.queryByRole('button', { name: /^Aplicar \d/ })
    if (botao) fireEvent.click(botao)
  } }
}

describe('S0 P3 — dinheiro com anotação', () => {
  it.each(['R$ 8.000 (2 dias)', 'R$ 2.000/dia', 'R$ 15.000 - 3 diárias', 'R$ 8 mil', '1e3'])('recusa %s em vez de inventar valor', entrada => {
    const valor = parseMoney(entrada); recibo('P3', { entrada, valor, esperado: null }); expect(valor).toBeNull()
  })
  it.each(['1.234,56-', '2.500-'])('preserva menos à direita: %s', entrada => {
    const esperado = entrada === '2.500-' ? -2500 : -1234.56
    recibo('P3-sinal', { entrada, observado: parseMoney(entrada), esperado }); expect(parseMoney(entrada)).toBe(esperado)
  })
  it('mantém os formatos brasileiros saudáveis', () => {
    expect(parseMoney('R$ 25.000,00')).toBe(25000)
    expect(parseMoney('(500)')).toBe(-500)
  })
  it('recusa três anotações e conserva somente R$ 12.000 na revisão real', async () => {
    const r = parseWorkbookData(arquivo(planilhaTexto()).buffer)
    const itens = Object.values(r.categorias).flat()
    await abrirPlanilha(planilhaTexto())
    recibo('P3-planilha', { itens, descartes: r.descartes, total: somaItens(itens), tela: document.body.textContent })
    expect.soft(somaItens(itens)).toBe(12000)
    expect.soft(r.descartes).toHaveLength(3)
    expect.soft(document.body.textContent).toContain('R$ 8.000 (2 dias)')
  })
})

describe('S0 P5 — equipe é custo', () => {
  it('controle: lote explicitamente nomeado continua sendo lote', () => {
    const r = parseWorkbookData(arquivo([['Lote', 'Valor unitário', 'Qtd'], ['Lote 1', 100, 200]]).buffer)
    expect(r.lotes).toEqual([{ nome: 'Lote 1', valor: 100, quantidade: 200 }])
  })
  it.each([['só equipe', equipe, 7400, 2], ['três seções', tresSecoes, 70400, 5]])('%s: quantidade × unitário é custo, nenhum lote', async (nome, criar, total, quantidade) => {
    const r = parseWorkbookData(arquivo(criar()).buffer)
    const fluxo = await abrirPlanilha(criar())
    fluxo.confirmar()
    const e = fluxo.ler().eventos[0]
    const itens = Object.values(r.categorias).flat()
    recibo('P5', { nome, itens, lotes: r.lotes, avisos: r.avisos, total: somaItens(itens), custoEvento: custo(e), brutaOtimista: computeCenarios(e).otimista.bruta })
    expect.soft(itens).toHaveLength(quantidade)
    expect.soft(somaItens(itens)).toBe(total)
    expect.soft(r.lotes).toHaveLength(0)
    expect.soft(custo(e)).toBe(total)
  })
})

describe('S0 P6 — negativo no evento importado', () => {
  it('revisão recusa custo e preço negativos; salvar e reabrir mantém R$ 15.000', async () => {
    const fluxo = await abrirPlanilha(negativos())
    const texto = document.body.textContent
    const linhas = [...document.querySelectorAll('tbody tr')].filter(tr => /Desconto do fornecedor|Lote 2/.test(tr.textContent))
    const selecionaveis = linhas.map(tr => ({ texto: tr.textContent, marcado: tr.querySelector('input[type="checkbox"]')?.checked }))
    fluxo.confirmar()
    const antes = fluxo.ler().eventos[0]
    const censo = censoNormalizacoes([antes])
    expect(saveStore(fluxo.ler()).ok).toBe(true)
    const depois = loadStore().eventos[0]
    cleanup()
    const telaCustos = render(<CostsTab evento={antes} store={fluxo.ler()} update={() => {}} />)
    const custosAntes = telaCustos.container.textContent
    telaCustos.rerender(<CostsTab evento={depois} store={loadStore()} update={() => {}} />)
    const custosDepois = telaCustos.container.textContent
    recibo('P6', { texto, selecionaveis, censo, antes: custo(antes), depois: custo(depois), lotesAntes: antes.lotes, lotesDepois: depois.lotes, snapshots: loadSnapshots().length,
      telaAntes: custosAntes.slice(0, 1000), telaDepois: custosDepois.slice(0, 1000),
      avisoQuebradoAntes: custosAntes.includes('não consegue calcular'), avisoQuebradoDepois: custosDepois.includes('não consegue calcular') })
    expect.soft(texto).toMatch(/recusad/i)
    expect.soft(selecionaveis.every(l => !l.marcado)).toBe(true)
    expect.soft(custo(antes)).toBe(15000)
    expect.soft(custo(depois)).toBe(15000)
    expect.soft(censo).toHaveLength(0)
  })
  it('cria snapshot antes de importar xlsx e permite restaurar o estado anterior', async () => {
    const fluxo = await abrirPlanilha(negativos())
    fluxo.confirmar()
    const snapshots = loadSnapshots()
    recibo('P6-snapshot', { quantidade: snapshots.length })
    expect(snapshots.length).toBeGreaterThan(0)
    const volta = restaurarSnapshot(snapshots[0].id, fluxo.ler())
    expect(volta.ok).toBe(true)
    expect(volta.store.eventos).toEqual(fluxo.antes.eventos)
  })
  it('controle: benchmark permite o saldo negativo de R$ 5.000', async () => {
    const fluxo = await abrirPlanilha([['MARKETING'], cabecalho, linha('Estorno', '(5.000,00)')])
    fireEvent.click(screen.getByLabelText('Salvar como evento (editável)'))
    fireEvent.click(screen.getByLabelText('Adicionar aos benchmarks de comparação'))
    fluxo.confirmar()
    expect(fluxo.ler().benchmarksCustom[0].custos.marketing).toBe(-5000)
    expect(fluxo.ler().eventos).toHaveLength(0)
  })
})

describe('S0 P4 — custos que voltam pela ponte', () => {
  it('controle de contrato: categoriaId aditivo sobrevive backup e reload; antigo sem ID continua válido', () => {
    const e = eventoVazio()
    e.categorias.find(c => c.id === 'marketing').itens = [novoItem({ servico: 'Ativação', realizado: 9000,
      viaFinanceiro: { categoria: 'Ativação', categoriaId: 71, valor: 9000, em: instante } })]
    const store = { ...vazio(), eventos: [e] }
    expect(saveStore(store).ok).toBe(true)
    const reload = loadStore()
    const novo = parseBackup(JSON.stringify(montarBackup(reload)))
    const antigo = structuredClone(e)
    delete antigo.categorias.find(c => c.id === 'marketing').itens[0].viaFinanceiro.categoriaId
    const legado = parseBackup(JSON.stringify({ eventos: [antigo], benchmarksCustom: [] }))
    const carimbo = ev => ev.categorias.find(c => c.id === 'marketing').itens[0].viaFinanceiro
    recibo('P4-schema', { reload: carimbo(reload.eventos[0]), novo: carimbo(novo.eventos[0]), antigo: carimbo(legado.eventos[0]) })
    expect(carimbo(novo.eventos[0]).categoriaId).toBe(71)
    expect(carimbo(legado.eventos[0]).categoriaId).toBeUndefined()
  })
  it('não duplica o mesmo gasto ao receber realizado sobre estimado e exige revisão do conflito', async () => {
    const e = eventoVazio()
    const valores = [['artistico', 'DJ headliner', 12345.67, 'Artístico / DJ'], ['locacao', 'Aluguel', 10000, 'Locação do espaço'], ['extras', 'Outras despesas', 1222.29, 'Outras despesas']]
    for (const [id, servico, estimado] of valores) e.categorias.find(c => c.id === id).itens = [novoItem({ servico, estimado })]
    const p = resposta({ categorias: valores.map((v, i) => ({ categoria: v[3], categoria_id: 20 + i, total: v[2] })), nova: true })
    const m = aplicar(e, p)
    const fluxo = await abrirPonte(p, e)
    const selecao = screen.getAllByRole('checkbox').map(c => c.checked)
    recibo('P4-volta', { antes: custo(e), depois: custo(m.evento), avisos: m.avisos, selecao, tela: document.body.textContent })
    // Nenhuma regra automática de substituir/somar é fixada aqui: conflito
    // precisa de aviso e escolha. O mesmo gasto não pode entrar silenciosamente.
    expect.soft(m.avisos.join(' ')).toMatch(/estimado|23\.567|12\.345/)
    expect.soft(selecao.every(v => !v)).toBe(true)
    fluxo.aplicar()
    expect.soft(custo(fluxo.ler())).toBe(23567.96)
  })
  it('mesmo categoria_id após renomeação atualiza o custo de R$ 9.000', () => {
    const e = eventoVazio()
    const primeiro = aplicar(e, resposta({ nova: true, categorias: [{ categoria: 'Ativação', categoria_id: 71, total: 9000 }] })).evento
    const segundo = aplicar(primeiro, resposta({ nova: true, categorias: [{ categoria: 'Ativações', categoria_id: 71, total: 9000 }] }))
    recibo('P4-renomear', { antes: custo(primeiro), depois: custo(segundo.evento), propostas: segundo.propostas, avisos: segundo.avisos })
    expect.soft(custo(segundo.evento)).toBe(9000)
    expect.soft(segundo.evento.categorias.flatMap(c => c.itens)).toHaveLength(1)
  })
  it('duas categorias externas no mesmo destino mostram efeito conjunto e conflito com estimado', async () => {
    const e = eventoVazio()
    e.categorias.find(c => c.id === 'equipe').itens = [novoItem({ servico: 'Equipe consolidada', estimado: 8000 })]
    const p = resposta({ nova: true, categorias: [{ categoria: 'Equipe de evento', categoria_id: 81, total: 5000 }, { categoria: 'Segurança', categoria_id: 82, total: 2400 }] })
    const direto = aplicar(e, p)
    const inverso = aplicar(e, resposta({ nova: true, categorias: [...p.eventos[0].custos_por_categoria].reverse() }))
    await abrirPonte(p, e)
    const tela = document.body.textContent
    recibo('P4-colisao', { antes: custo(e), depois: custo(direto.evento), invertido: custo(inverso.evento), avisos: direto.avisos, tela })
    expect.soft(custo(direto.evento)).toBe(custo(inverso.evento))
    expect.soft(tela).toContain('8.000')
    expect.soft(tela).toContain('15.400')
    expect.soft(screen.getAllByRole('checkbox').every(c => !c.checked)).toBe(true)
  })
})

describe('S0 X1 — respostas antiga e nova', () => {
  it('resposta antiga exige aviso de origem desconhecida e seleção explícita', async () => {
    const p = resposta({ pagamentos: 1, receita: 20250 })
    const fluxo = await abrirPonte(p)
    const selecao = screen.getAllByRole('checkbox').map(c => c.checked)
    const tela = document.body.textContent
    fluxo.aplicar()
    const e = fluxo.ler()
    const snapshots = loadSnapshots()
    const volta = restaurarSnapshot(snapshots[0].id, { ...fluxo.store, eventos: [e] })
    recibo('X1-antiga', { selecao, tela, vendidos: e.vendidosAteHoje, bilheteria: e.receitaRealizada.bilheteria, snapshot: snapshots.length, restaurado: volta.ok })
    expect.soft(selecao).toEqual([false, false])
    expect.soft(tela).toMatch(/plano.*(desconhecid|atualiz|confer)|(?:desconhecid|atualiz|confer).*plano/i)
    expect.soft(e.vendidosAteHoje).not.toBe(1)
    expect.soft(e.receitaRealizada.bilheteria).not.toBe(20250)
    // Controle: a proteção existente da ponte realmente restaura os números.
    expect(volta.ok).toBe(true)
    expect(volta.store.eventos[0].receitaRealizada.bilheteria).not.toBe(20250)
  })
  it('resposta nova informa plano excluído e não equivale pagamentos a ingressos', async () => {
    // Um pagamento comprou 4 ingressos de R$ 100. O payload informa 1
    // pagamento e R$ 400; não oferece a quantidade 4 ao Planejador.
    const p = resposta({ nova: true, pagamentos: 1, receita: 400 })
    const normalizado = normalizar(p)
    const fluxo = await abrirPonte(p)
    const selecao = screen.getAllByRole('checkbox').map(c => c.checked)
    const tela = document.body.textContent
    fluxo.aplicar()
    recibo('X1-nova', { normalizado, selecao, tela, vendidos: fluxo.ler().vendidosAteHoje, bilheteria: fluxo.ler().receitaRealizada.bilheteria })
    expect.soft(tela).toMatch(/20\.250.*(?:fora|exclu)|(?:fora|exclu).*20\.250/i)
    expect.soft(selecao[0]).toBe(false)
    expect.soft(fluxo.ler().vendidosAteHoje).not.toBe(1)
    expect(fluxo.ler().receitaRealizada.bilheteria).toBe(400)
  })
})
