// @vitest-environment jsdom
//
// REVISÃO ADVERSARIAL DA S7 (06/10/2026) — lote sem preço (P8). A revisão
// achou superfícies que mostram número que mudou por causa do lote sem preço
// e não diziam nada (item 1), o caso misto da trava (item 3), o resumo do
// rascunho que anunciava um ajuste que não conta (item 5) e a Apresentação sem
// teste que distinguisse o rascunho do evento salvo (item 6). Cada caso aqui
// tem uma mutação no corredor `scripts/provas-s7/mutacoes-p8.mjs` (IDs R1a…R6)
// que o derruba. A festa é a do diff aprovado: Lote 1 (R$ 100 × 600),
// Cortesias declaradas (R$ 0 × 50) e o Camarote SEM PREÇO × 300.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { VeredictoPainel } from './Veredito.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import Home from './Home.jsx'
import CostsTab from './CostsTab.jsx'
import { RitmoVendasCard } from './RitmoVendas.jsx'
import CurvaVendas from './CurvaVendas.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import PresentationMode from './PresentationMode.jsx'
import { novoEvento, novoLote, novoItem } from '../lib/defaults.js'
import { computeCenarios } from '../lib/calc.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import { temQuantidadeTravada, BREAK_EVEN_QUANTIDADE_TRAVADA } from '../lib/breakEvenTexto.js'
import { resumoCurto } from '../lib/resumo.js'
import { rascunhoDoEvento, resumoDoRascunho } from '../lib/simulacaoRascunho.js'
import { saveCurvaCache } from '../lib/curvaVendas.js'
import { liberarGravacao } from '../lib/storage.js'

let dados
beforeEach(() => {
  liberarGravacao()
  dados = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    clear: () => dados.clear(),
    key: (i) => [...dados.keys()][i] ?? null,
    get length() {
      return dados.size
    },
  })
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Rede não autorizada no teste')
  }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  liberarGravacao()
})

function festaP8() {
  const e = novoEvento('Festa P8')
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Camarote', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}
const comCamarote = (e, patch) => ({ ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, ...patch } : l)) })
const comAjustes = (e, realista) => ({
  ...e,
  cenariosConfig: { ...e.cenariosConfig, overrides: { ...e.cenariosConfig.overrides, realista } },
})
const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

const CURTO = '1 lote sem preço fora do público e do bar (300 ingressos)'
const TEXTO_COMPLETO =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
const notas = (raiz = document.body) =>
  [...raiz.querySelectorAll('[role="note"][data-aviso="lote-sem-preco"]')].map((n) => n.textContent)
const faixas = () => screen.queryAllByRole('status').filter((n) => n.textContent.includes('sem preço'))

// ———————————————————————————————————————————— item 1a: painel do veredito
describe('1a — painel do veredito (topo de todas as abas)', () => {
  it('a linha curta aparece uma vez no painel; controle preço 0: não aparece', () => {
    const { container } = render(<VeredictoPainel evento={festaP8()} update={() => {}} />)
    expect(notas(container)).toStrictEqual([CURTO])
    cleanup()
    const r = render(<VeredictoPainel evento={comCamarote(festaP8(), { valor: 0 })} update={() => {}} />)
    expect(notas(r.container)).toStrictEqual([])
  })
})

// ———————————————————————————————————————————— item 1b: Fechamento
describe('1b — aba Fechamento', () => {
  it('festa aberta: a faixa completa, logo antes do cartão de receita realizada', () => {
    render(<FechamentoTab evento={festaP8()} update={() => {}} />)
    const f = faixas()
    expect(f).toHaveLength(1)
    expect(f[0].textContent).toBe(TEXTO_COMPLETO)
    const cartao = screen.getByRole('heading', { name: 'Receita realizada' })
    expect(f[0].compareDocumentPosition(cartao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('festa fechada: sem a faixa (os números são a fotografia); controle preço 0 aberta: sem faixa', () => {
    const fechada = fecharEvento(
      { ...festaP8(), receitaRealizada: { bilheteria: 50000, bar: 30000 } },
      '2027-01-02T12:00:00.000Z'
    )
    expect(fechada?.status).toBe('fechado')
    render(<FechamentoTab evento={fechada} update={() => {}} />)
    expect(faixas()).toHaveLength(0)
    cleanup()
    render(<FechamentoTab evento={comCamarote(festaP8(), { valor: 0 })} update={() => {}} />)
    expect(faixas()).toHaveLength(0)
  })
})

// ———————————————————————————————————————————— item 1c: Home
describe('1c — cartão da Home', () => {
  const montar = (eventos) =>
    render(
      <Home
        store={{ eventos, benchmarksCustom: [] }}
        setStore={vi.fn()}
        aparencia={{}}
        abrir={vi.fn()}
        abrirAjustes={vi.fn()}
      />
    )
  const cartao = (nome) => screen.getByRole('button', { name: `Abrir ${nome}` }).parentElement
  it('festa com o Camarote sem preço: a linha curta no cartão dela, não no da festa vizinha', () => {
    const vizinha = { ...comCamarote(festaP8(), { valor: 0 }), id: 'viz', nome: 'Festa vizinha' }
    montar([festaP8(), vizinha])
    expect(notas(cartao('Festa P8'))).toStrictEqual([CURTO])
    expect(cartao('Festa P8').textContent).toContain('590 pessoas')
    expect(notas(cartao('Festa vizinha'))).toStrictEqual([])
  })
})

// ———————————————————————————————————————————— item 1d: Custos
describe('1d — aba Custos, R$/pessoa', () => {
  it('em R$/pessoa a nota diz o divisor e o lote de fora; em Absoluto, não', () => {
    const e = festaP8()
    render(<CostsTab evento={e} update={() => {}} store={store(e)} />)
    expect(notas()).toStrictEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'R$/pessoa' }))
    expect(notas()).toStrictEqual([`R$/pessoa divide por 590 pessoas — ${CURTO}`])
  })
  it('controle preço 0: em R$/pessoa, nenhuma nota', () => {
    const e = comCamarote(festaP8(), { valor: 0 })
    render(<CostsTab evento={e} update={() => {}} store={store(e)} />)
    fireEvent.click(screen.getByRole('button', { name: 'R$/pessoa' }))
    expect(notas()).toStrictEqual([])
  })
})

// ———————————————————————————————————————————— item 1e: ritmo e curva
describe('1e — card de ritmo e curva de vendas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 11, 1, 12))
  })
  const ritmo = (e) => {
    const c = computeCenarios(e)
    return render(
      <RitmoVendasCard
        evento={e}
        update={() => {}}
        breakEvenRealista={c.realista.breakEven}
        breakEvenNaoFecha={c.realista.breakEvenNaoFecha}
        cenarios={c}
      />
    )
  }
  it('"Estamos vendendo no ritmo?": a meta é 293 e a linha curta diz por quê; controle preço 0: sem linha', () => {
    const { container } = ritmo({ ...festaP8(), vendidosAteHoje: 100 })
    expect(container.textContent).toContain('break-even (293)')
    expect(notas(container)).toStrictEqual([CURTO])
    cleanup()
    const r = ritmo({ ...comCamarote(festaP8(), { valor: 0 }), vendidosAteHoje: 100 })
    expect(notas(r.container)).toStrictEqual([])
  })
  it('curva com o realizado do Financeiro: a linha "Pela curva, faltam" vem com a linha curta', () => {
    const e = { ...festaP8(), financeiro: { eventoId: 'fin-s7' } }
    const c = computeCenarios(e)
    saveCurvaCache(
      { eventos: [{ id: 'fin-s7', nome: e.nome, data: e.data, dias: [{ dia: -50, pagamentos: 2, valor: 8000 }] }], eventosSemData: [] },
      '2026-12-01T12:00:00Z'
    )
    const { container } = render(
      <CurvaVendas evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />
    )
    expect(container.textContent).toMatch(/Pela curva, faltam 291 para o break-even do realista/)
    expect(notas(container)).toStrictEqual([CURTO])
  })
})

// ———————————————————————————————————————————— item 3: P1 caso misto
describe('3 — P1 caso misto: Camarote sem preço 125 + Lote 1 com preço 540 no realista', () => {
  const misto = () => comAjustes(festaP8(), { l4: 125, l1: 540 })
  it('a trava continua: o Lote 1 tem preço e foi fixado à mão', () => {
    expect(temQuantidadeTravada(misto(), 'realista')).toBe(true)
    // controle: só o Camarote ajustado não trava (P1 = A)
    expect(temQuantidadeTravada(comAjustes(festaP8(), { l4: 125 }), 'realista')).toBe(false)
  })
  it('cartão Realista e WhatsApp: "quantidade travada à mão neste cenário"', () => {
    const e = misto()
    render(
      <ScenariosTab evento={e} update={() => {}} updateCenarios={() => {}} store={store(e)} setStore={() => {}} />
    )
    const card = screen
      .getAllByRole('heading', { name: 'Realista' })
      .map((h) => h.closest('[style]'))
      .find((c) => c && c.textContent.includes('Break-even') && c.textContent.includes('Público'))
    const dt = [...card.querySelectorAll('dt')].find((d) => d.textContent.trim() === 'Break-even')
    expect(dt.nextElementSibling.textContent).toBe(BREAK_EVEN_QUANTIDADE_TRAVADA)
    expect(resumoCurto(e, { hoje: '2026-10-06' })).toContain(`break-even: ${BREAK_EVEN_QUANTIDADE_TRAVADA}`)
  })
})

// ———————————————————————————————————————————— item 5: resumo do rascunho
describe('5 — resumo do rascunho', () => {
  it('ajuste no Camarote sem preço diz que não conta; o do Lote 1 sai como sempre', () => {
    const e = festaP8()
    const r = rascunhoDoEvento(e)
    r.cenariosConfig = { ...r.cenariosConfig, overrides: { ...r.cenariosConfig.overrides, realista: { l4: 125, l1: 540 } } }
    const itens = resumoDoRascunho(r, e.lotes)
    expect(itens).toContain('Realista: Camarote fixado em 125 ingressos (sem preço — ajuste não conta)')
    expect(itens).toContain('Realista: Lote 1 fixado em 540 ingressos')
  })
  it('mudar e soltar o ajuste do Camarote também diz que não conta; com preço 50, não diz', () => {
    const e = comAjustes(festaP8(), { l4: 125 })
    const r = rascunhoDoEvento(e)
    r.cenariosConfig = { ...r.cenariosConfig, overrides: { ...r.cenariosConfig.overrides, realista: { l4: 200 } } }
    expect(resumoDoRascunho(r, e.lotes)).toStrictEqual([
      'Realista: Camarote 125 → 200 ingressos (sem preço — ajuste não conta)',
    ])
    r.cenariosConfig = { ...r.cenariosConfig, overrides: { ...r.cenariosConfig.overrides, realista: {} } }
    expect(resumoDoRascunho(r, e.lotes)).toStrictEqual([
      'Realista: Camarote volta ao automático (sem preço — ajuste não conta)',
    ])
    expect(resumoDoRascunho(r, comCamarote(e, { valor: 50 }).lotes)).toStrictEqual([
      'Realista: Camarote volta ao automático',
    ])
  })
})

// ———————————————————————————————————————————— item 6: Apresentação
describe('6 — Apresentação: o aviso lê o RASCUNHO (eventoView), não o evento salvo', () => {
  // Camarote sem preço e com quantidade 0: só o ajuste manual o põe no aviso.
  // O rascunho nasce do evento do PRIMEIRO render e não muda num rerender —
  // então, depois do rerender, evento e rascunho discordam, e o aviso tem de
  // seguir o rascunho (é dele que vêm os números da tela).
  const base = () => comCamarote(festaP8(), { quantidade: 0 })
  const comAjuste = () => comAjustes(base(), { l4: 125 })
  const TEXTO_SO_AJUSTE =
    'O lote “Camarote” (só ajuste manual) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
  const apresentar = (e) => (
    <PresentationMode evento={e} store={store(e)} update={() => {}} aparencia={{}} onClose={() => {}} />
  )
  it('rascunho COM o ajuste, evento salvo SEM: a faixa aparece', () => {
    const { rerender } = render(apresentar(comAjuste()))
    expect(faixas().map((f) => f.textContent)).toStrictEqual([TEXTO_SO_AJUSTE])
    rerender(apresentar(base()))
    expect(faixas().map((f) => f.textContent)).toStrictEqual([TEXTO_SO_AJUSTE])
  })
  it('rascunho SEM o ajuste, evento salvo COM: a faixa não aparece', () => {
    const { rerender } = render(apresentar(base()))
    expect(faixas()).toHaveLength(0)
    rerender(apresentar(comAjuste()))
    expect(faixas()).toHaveLength(0)
    // controle: montado do zero com o evento ajustado, a faixa aparece
    cleanup()
    render(apresentar(comAjuste()))
    expect(within(document.body).getAllByRole('status').filter((n) => n.textContent.includes('sem preço'))).toHaveLength(1)
  })
})
