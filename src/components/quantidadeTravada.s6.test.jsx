// @vitest-environment jsdom
//
// S6 — quantidade travada à mão, nas telas REAIS (componentes montados, sem
// dublê). Decisão do Marco, 05/09/2026: onde o cenário tem lote com quantidade
// ajustada à mão, o app publica "quantidade travada à mão neste cenário" no
// lugar do mínimo de ingressos e das metas de ritmo derivadas dele.
//
// REGRA DE ESCRITA DESTE ARQUIVO: a presença do aviso é afirmada na CÉLULA —
// o `dd` do `dt` do cartão, a linha da DRE pelo rótulo e a coluna pelo índice,
// o card da Home pelo nome do evento. Nunca em `container.textContent` global:
// com o aviso impresso em três lugares da mesma tela, uma busca global fica
// verde mesmo com a DRE ainda imprimindo o número. (A ausência global só é
// afirmada onde o aviso NÃO PODE aparecer em lugar nenhum — os casos de dado
// inválido, #98.)
//
// Fixture histórica da S0 (`eventoTravado`, só importada): três lotes 400/600/
// 200, sem trava o mínimo realista é 568. Relógio fixo em 01/12/2026, festa em
// 01/01/2027, 100 vendidos. Cada caso monta uma CÓPIA nova.
import React, { useState } from 'react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { eventoTravado } from '../../scripts/provas-s0/cenarios.fixture.js'
import { computeCenarios } from '../lib/calc.js'
import { fmtInt } from '../lib/format.js'
import { MARCACAO_REALIZADA, DATA_DO_EVENTO_ILEGIVEL } from '../lib/resumo.js'
import { NUMERO_NAO_CALCULA, cenarioQuebrado, receitaDoCenarioQuebrada } from '../lib/dadoQuebrado.js'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import Home from './Home.jsx'
import { RitmoVendasCard } from './RitmoVendas.jsx'
import CurvaVendas from './CurvaVendas.jsx'
import { Bola } from './ui.jsx'
import { TITULO_CUSTO_QUEBRADO, TITULO_RECEITA_QUEBRADA } from './AvisoCustoQuebrado.jsx'
import { saveCurvaCache } from '../lib/curvaVendas.js'

const AVISO = 'quantidade travada à mão neste cenário'
// Com trava e vendidos preenchidos (a fixture traz 100), a linha de ritmo do relatório conta o dado
// da bilheteria e cede só a META. Home e card de ritmo seguem só com o aviso, sem prefixo.
const RITMO_RELATORIO_TRAVADO = `Ritmo de vendas: 100 vendidos até hoje. ${AVISO}`
// Verbete do break-even quando o realista está quebrado (#98): a definição genérica, sem número e sem trava.
const DEFINICAO_GENERICA_BE =
  'Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro.'
// Tudo o que é meta de ritmo/curva — inclusive a frase REAL da curva ("Pela curva, faltam 1.198 para o
// break-even do realista — ritmo necessário: 39/dia.") e a do card ("precisa vender 16 por dia").
const META_DE_RITMO = /faltam \d|\d+\/dia|por dia|coberto|precisa vender|≥|não fecha nem vendendo tudo/i
// A curva traz texto fixo de legenda com "por dia" ("% vendido por dia das festas passadas"), então a regex
// DELA é a que só pega meta de verdade.
const META_DA_CURVA = /faltam \d|\d+\/dia|coberto|precisa vender/i
const CHEIO = { l1: 400, l2: 600, l3: 200 }
const BAIXO = { l1: 100, l2: 100, l3: 20 }
const ZERO = { l1: 0 }
const NIVEL = 'previsao-eventos:relatorio-nivel:v1'

const storeDe = (...es) => ({ eventos: es, benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })
const festa = (mapa = CHEIO, ajuste) => {
  const e = { ...eventoTravado(), vendidosAteHoje: 100 }
  e.cenariosConfig.overrides.realista = mapa
  if (ajuste) ajuste(e)
  return e
}
const comCustoQuebrado = (e) => { e.categorias.find((c) => c.id === 'aeb').itens[0].estimado = 1e308 }
const comBarQuebrado = (e) => { e.barTicket.realista = 1e308 }

// --- localizadores de CÉLULA ---------------------------------------------
/** Os `dd` de todos os `dt` com este rótulo, na ordem do documento (pessimista, realista, otimista). */
const valorDt = (root, rotulo) =>
  [...root.querySelectorAll('dt')].filter((n) => n.textContent === rotulo).map((n) => n.nextElementSibling)
/** A linha da DRE pelo rótulo da primeira célula. Colunas: 1 pessimista, 2 realista, 3 otimista. */
const linhaDre = (root, rotulo) =>
  [...root.querySelectorAll('tr')].find((n) => n.firstElementChild?.textContent === rotulo)
const celulaDre = (root, rotulo, coluna) => linhaDre(root, rotulo)?.children[coluna]
/** O cartão inteiro do cenário (o pai do `dl`) a que este `dd` pertence. */
const cartaoDe = (dd) => dd.closest('dl').parentElement
const textoDe = (el) => el.textContent.replace(/\s+/g, ' ')
const cartaoDoEventoNaHome = (root, nomeDoEvento) => {
  let el = [...root.querySelectorAll('span[title]')].find((n) => n.getAttribute('title') === nomeDoEvento)
  // sobe enquanto o pai ainda tem no máximo ESTE evento (um h3); para antes da lista inteira
  while (el.parentElement !== root && el.parentElement.querySelectorAll('h3').length <= 1) el = el.parentElement
  return el
}
const frasesDe = (root) => [...root.querySelectorAll('p')].map((p) => p.textContent.trim())

let fetchSpy
let erroSpy
beforeEach(() => {
  const dados = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 11, 1, 12))
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    throw Error('Não deve buscar rede')
  })
  erroSpy = vi.spyOn(console, 'error')
})
afterEach(() => {
  // nenhum teste daqui pode ter chamado a rede, nem feito o React reclamar do
  // atributo `fill` recebendo `false` (a cor da Bola em RitmoVendas.jsx)
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(erroSpy.mock.calls.filter((a) => /non-boolean attribute/.test(String(a[0])))).toEqual([])
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ===========================================================================
describe('S6 aba Cenários — cartões e DRE', () => {
  const montar = (e) => render(<ScenariosTab evento={e} store={storeDe(e)} update={vi.fn()} />)

  it.each([
    ['cheio 400/600/200', CHEIO],
    ['100/100/20', BAIXO],
    ['zero num lote só', ZERO],
  ])('%s: o cartão e a DRE (Absoluto e R$/pax) trocam SÓ a coluna realista', (_n, mapa) => {
    const e = festa(mapa)
    const antes = structuredClone(e)
    const c = computeCenarios(e)
    const cAntes = structuredClone(c)
    const r = montar(e)
    // controle: o cálculo tem mesmo mínimo (ou "não fecha") para os vizinhos
    const be = (s) => `${fmtInt(c[s].breakEven)}`
    // --- cartões: um `dd` por cenário
    const dds = valorDt(r.container, 'Break-even')
    expect(dds).toHaveLength(3)
    expect(dds[0].textContent).toBe(`${be('pessimista')} ingressos pagos`)
    expect(dds[1].textContent).toBe(AVISO) // sem o sufixo "ingressos pagos"
    expect(dds[2].textContent).toBe(`${be('otimista')} ingressos pagos`)
    // --- DRE em Absoluto
    for (const [coluna, texto] of [[1, be('pessimista')], [2, AVISO], [3, be('otimista')]])
      expect(celulaDre(r.container, 'Break-even (ingressos pagos)', coluna).textContent).toBe(texto)
    // --- DRE em R$/pax: o aviso não vira moeda, e os vizinhos não viram moeda
    fireEvent.click(r.getByText('R$/pax'))
    expect(celulaDre(r.container, 'Lucro', 2).textContent).toMatch(/R\$/) // controle: o modo mudou de fato
    for (const [coluna, texto] of [[1, be('pessimista')], [2, AVISO], [3, be('otimista')]])
      expect(celulaDre(r.container, 'Break-even (ingressos pagos)', coluna).textContent).toBe(texto)
    // leitura pura
    expect(e).toEqual(antes)
    expect(c).toEqual(cAntes)
    expect(computeCenarios(e)).toEqual(cAntes)
  })

  it('o cartão realista não traz "coberto" nem "faltam" do mínimo; a frase de posição é o aviso', () => {
    const e = festa(CHEIO)
    const r = montar(e)
    const [pess, real, otim] = valorDt(r.container, 'Break-even').map(cartaoDe)
    expect(textoDe(real)).not.toMatch(/coberto|faltam|sai do prejuízo|≥/)
    expect([...real.querySelectorAll('p')].map((p) => p.textContent.trim())).toContain(AVISO)
    // controle: o leitor de texto enxerga a frase de posição dos vizinhos, que seguem numéricos
    expect(textoDe(pess)).toMatch(/coberto|faltam/)
    expect(textoDe(otim)).toMatch(/coberto|faltam/)
    expect([...pess.querySelectorAll('p')].map((p) => p.textContent.trim())).not.toContain(AVISO)
  })

  it('cor da frase de posição: a trava sai em ÂMBAR (aviso de leitura), nunca em vermelho; "faltam" segue vermelho e "coberto" verde', () => {
    const fraseDe = (cartao, re) => [...cartao.querySelectorAll('p')].find((p) => re.test(p.textContent.trim()))
    const trava = festa(CHEIO)
    const r = montar(trava)
    const [, real] = valorDt(r.container, 'Break-even').map(cartaoDe)
    const pTrava = fraseDe(real, new RegExp(`^${AVISO}$`))
    expect(pTrava).toBeTruthy() // controle: a frase existe, senão "sem vermelho" seria verdade vazia
    expect(pTrava.className).toContain('text-[var(--ambar-texto)]')
    expect(pTrava.className).not.toContain('--vermelho-texto')
    expect(pTrava.className).not.toContain('--verde-texto')
    cleanup()

    // controle: SEM trava o mesmo cartão usa as outras duas cores — a regra não ficou "tudo âmbar"
    const livre = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const r2 = montar(livre)
    const cartoes = valorDt(r2.container, 'Break-even').map(cartaoDe)
    const todas = cartoes.flatMap((cartao) => [...cartao.querySelectorAll('p')])
    const faltam = todas.filter((p) => /faltam/i.test(p.textContent))
    const coberto = todas.filter((p) => /coberto/i.test(p.textContent))
    expect(faltam.length + coberto.length).toBeGreaterThan(0)
    for (const p of faltam) {
      expect(p.className).toContain('text-[var(--vermelho-texto)]')
      expect(p.className).not.toContain('--ambar-texto')
    }
    for (const p of coberto) {
      expect(p.className).toContain('text-[var(--verde-texto)]')
      expect(p.className).not.toContain('--ambar-texto')
    }
    // o cartão pessimista travado (único com o aviso) também sai em âmbar
    const pAvisoPess = fraseDe(cartoes[0], new RegExp(`^${AVISO}$`))
    expect(pAvisoPess.className).toContain('text-[var(--ambar-texto)]')
  })

  it('"nem vendendo todos os ingressos este cenário sai do prejuízo" SEM trava segue vermelho (a trava não pegou a cor do caso antigo)', () => {
    const e = festa({}, (x) => { x.categorias.find((c) => c.id === 'aeb').itens[0].estimado = 400000 })
    expect(computeCenarios(e).realista.breakEvenNaoFecha).toBe(true) // controle: este cenário realmente não fecha
    const r = montar(e)
    const real = cartaoDe(valorDt(r.container, 'Break-even')[1])
    const p = [...real.querySelectorAll('p')].find((x) => /nem vendendo todos os ingressos/i.test(x.textContent))
    expect(p).toBeTruthy()
    expect(p.className).toContain('text-[var(--vermelho-texto)]')
    expect(p.className).not.toContain('--ambar-texto')
  })

  it('100/100/20: o cartão não diz "não fecha nem vendendo tudo" — diz a trava', () => {
    const e = festa(BAIXO)
    expect(computeCenarios(e).realista.breakEvenNaoFecha).toBe(true) // controle
    const r = montar(e)
    const real = cartaoDe(valorDt(r.container, 'Break-even')[1])
    expect(textoDe(real)).not.toMatch(/não fecha|sai do prejuízo/)
    expect([...real.querySelectorAll('p')].map((p) => p.textContent.trim())).toContain(AVISO)
  })

  it('trava só no pessimista: a coluna realista segue numérica (cartão e DRE) e a pessimista cede', () => {
    const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const c = computeCenarios(e)
    const r = montar(e)
    const dds = valorDt(r.container, 'Break-even')
    expect(dds[0].textContent).toBe(AVISO)
    expect(dds[1].textContent).toBe(`${fmtInt(c.realista.breakEven)} ingressos pagos`)
    expect(c.realista.breakEven).toBe(568)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 1).textContent).toBe(AVISO)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe('568')
  })

  it('o card de ritmo e a curva, dentro da aba, trocam a meta pelo aviso e mantêm o editor', () => {
    const e = festa(CHEIO)
    const r = montar(e)
    const card = [...r.container.querySelectorAll('h3')]
      .find((h) => h.textContent.startsWith('Estamos vendendo no ritmo?')).closest('.p-4')
    // o card certo: tem o campo de vendidos e NÃO é a página inteira (não tem a DRE)
    expect(card.querySelector('input')).toBeTruthy()
    expect(card.querySelector('table')).toBeNull()
    expect(frasesDe(card)).toContain(AVISO)
    expect(textoDe(card)).not.toMatch(/por dia|Faltam \d|coberto/)
    expect(r.getByLabelText('Vendidos até hoje').value).toBe('100')
  })
})

// ===========================================================================
describe('S6 aba Cenários — soltar o ajuste manual, passo a passo (estado real)', () => {
  function Harness({ inicial, aoMudar }) {
    const [e, setE] = useState(inicial)
    const update = (fn) => {
      setE((anterior) => {
        const novo = typeof fn === 'function' ? fn(anterior) : fn
        aoMudar?.(novo)
        return novo
      })
    }
    return <ScenariosTab evento={e} store={storeDe(e)} update={update} />
  }
  const campo = (r, lote, cenario) => {
    const linha = [...r.container.querySelectorAll('tbody tr')].find((tr) => tr.firstElementChild.textContent.startsWith(lote))
    return linha.children[{ pessimista: 1, realista: 2, otimista: 3 }[cenario]].querySelector('input')
  }
  const digitar = (input, valor) => {
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: valor } })
    fireEvent.blur(input)
  }
  const realista = (r) => ({
    cartao: valorDt(r.container, 'Break-even')[1].textContent,
    dre: celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent,
  })

  it('o aviso fica enquanto resta um lote ajustado; sai quando o último é limpo; 0 volta a travar', () => {
    const inicial = festa(CHEIO)
    const original = structuredClone(inicial)
    const r = render(<Harness inicial={inicial} />)
    fireEvent.click(r.getByText('Ajuste manual por lote'))
    // controle: os campos existem e trazem o ajuste de partida
    expect(campo(r, 'Lote 1', 'realista').value).toBe('400')
    expect(realista(r)).toEqual({ cartao: AVISO, dre: AVISO })

    digitar(campo(r, 'Lote 1', 'realista'), '')
    expect(campo(r, 'Lote 1', 'realista').value).toBe('')
    expect(realista(r)).toEqual({ cartao: AVISO, dre: AVISO }) // restam l2 e l3

    digitar(campo(r, 'Lote 2', 'realista'), '')
    expect(realista(r)).toEqual({ cartao: AVISO, dre: AVISO }) // resta l3

    digitar(campo(r, 'Lote 3', 'realista'), '')
    // sem nenhum ajuste: o mínimo numérico VOLTA, nas duas células e com o sufixo do cartão
    expect(realista(r)).toEqual({ cartao: '568 ingressos pagos', dre: '568' })
    expect(textoDe(cartaoDe(valorDt(r.container, 'Break-even')[1]))).toMatch(/coberto/)

    // digitar 0 de novo reativa o aviso (zero é ajuste, não campo vazio)
    digitar(campo(r, 'Lote 1', 'realista'), '0')
    expect(campo(r, 'Lote 1', 'realista').value).toBe('0')
    expect(realista(r)).toEqual({ cartao: AVISO, dre: AVISO })

    // o evento de partida não foi mutado por nenhum desses passos
    expect(inicial).toEqual(original)
  })

  it('cada cenário é independente: ajustar o pessimista não trava o realista já solto', () => {
    const r = render(<Harness inicial={festa({})} />)
    fireEvent.click(r.getByText('Ajuste manual por lote'))
    expect(realista(r)).toEqual({ cartao: '568 ingressos pagos', dre: '568' })
    digitar(campo(r, 'Lote 1', 'pessimista'), '100')
    expect(valorDt(r.container, 'Break-even')[0].textContent).toBe(AVISO)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 1).textContent).toBe(AVISO)
    expect(realista(r)).toEqual({ cartao: '568 ingressos pagos', dre: '568' })
    // e o otimista também fica de fora
    expect(valorDt(r.container, 'Break-even')[2].textContent).toMatch(/ingressos pagos$/)
    // soltar o pessimista não mexe no realista
    digitar(campo(r, 'Lote 1', 'pessimista'), '')
    expect(valorDt(r.container, 'Break-even')[0].textContent).toMatch(/ingressos pagos$/)
    expect(realista(r).dre).toBe('568')
  })

  it('o ajuste igual ao automático (360) também trava; apagar a chave destrava', () => {
    const r = render(<Harness inicial={festa({})} />)
    fireEvent.click(r.getByText('Ajuste manual por lote'))
    digitar(campo(r, 'Lote 1', 'realista'), '360')
    expect(realista(r)).toEqual({ cartao: AVISO, dre: AVISO })
    digitar(campo(r, 'Lote 1', 'realista'), '')
    expect(realista(r)).toEqual({ cartao: '568 ingressos pagos', dre: '568' })
  })
})

// ===========================================================================
describe('S6 Relatório (ReportView) — resumo e completo, cada um no seu nível', () => {
  const montar = (e, nivel) => {
    if (nivel) localStorage.setItem(NIVEL, nivel)
    return render(<ReportView evento={e} store={storeDe(e)} onBack={vi.fn()} />)
  }
  const ritmo = (root) => [...root.querySelectorAll('p')].find((p) => p.textContent.startsWith('Ritmo de vendas:'))

  it('Resumido: o cartão por cenário e a linha de ritmo; sem DRE e sem glossário', () => {
    const e = festa(CHEIO)
    const c = computeCenarios(e)
    const r = montar(e, 'resumido')
    // controle: este é o nível resumido (a DRE e o glossário não existem)
    expect(linhaDre(r.container, 'Break-even (ingressos pagos)')).toBeUndefined()
    expect(r.queryByText('Como ler este relatório')).toBeNull()
    const dds = valorDt(r.container, 'Break-even (pagos)')
    expect(dds.map((d) => d.textContent)).toEqual([fmtInt(c.pessimista.breakEven), AVISO, fmtInt(c.otimista.breakEven)])
    expect(ritmo(r.container).textContent).toBe(RITMO_RELATORIO_TRAVADO)
    expect(ritmo(r.container).textContent).not.toMatch(META_DE_RITMO)
    // os números legítimos do cenário realista continuam publicados (público e pagos 1.200)
    expect(valorDt(r.container, 'Ingressos pagos')[1].textContent).toBe('1.200')
  })

  it('Completo: cartão, DRE por cenário, ritmo e glossário — cada um com a notícia, sem a promessa de 1.200', () => {
    const e = festa(CHEIO)
    const c = computeCenarios(e)
    const r = montar(e, 'completo')
    expect(valorDt(r.container, 'Break-even (pagos)').map((d) => d.textContent)).toEqual([
      fmtInt(c.pessimista.breakEven),
      AVISO,
      fmtInt(c.otimista.breakEven),
    ])
    expect(
      [1, 2, 3].map((col) => celulaDre(r.container, 'Break-even (ingressos pagos)', col).textContent)
    ).toEqual([fmtInt(c.pessimista.breakEven), AVISO, fmtInt(c.otimista.breakEven)])
    expect(ritmo(r.container).textContent).toBe(RITMO_RELATORIO_TRAVADO)
    expect(ritmo(r.container).textContent).not.toMatch(META_DE_RITMO)
    // glossário: a definição do verbete é o aviso
    const verbete = r.getByText('Break-even (BE)')
    expect(verbete.nextElementSibling.textContent).toBe(AVISO)
    // o glossário inteiro: nenhum "Neste evento: 1.200 ingressos pagos" (o mínimo calculado), em nenhum verbete
    const glossario = verbete.closest('dl')
    expect(glossario.textContent).not.toMatch(/Neste evento: 1\.200 ingressos pagos/)
    expect(glossario.textContent).not.toMatch(/Neste evento: [\d.]+ ingressos pagos/)
    // a DRE continua publicando os outros números (pagos 1.200 na coluna realista)
    expect(celulaDre(r.container, 'Ingressos pagos', 2).textContent).toBe('1.200')
  })

  it('trocar o nível na própria tela mantém a notícia nos dois', () => {
    const e = festa(BAIXO)
    const r = montar(e, 'resumido')
    expect(valorDt(r.container, 'Break-even (pagos)')[1].textContent).toBe(AVISO)
    fireEvent.click(r.getByText('Completo'))
    expect(valorDt(r.container, 'Break-even (pagos)')[1].textContent).toBe(AVISO)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(AVISO)
    expect(r.getByText('Break-even (BE)').nextElementSibling.textContent).toBe(AVISO)
    fireEvent.click(r.getByText('Resumido'))
    expect(linhaDre(r.container, 'Break-even (ingressos pagos)')).toBeUndefined()
    expect(valorDt(r.container, 'Break-even (pagos)')[1].textContent).toBe(AVISO)
  })

  it('trava só no pessimista: realista numérico em cartão, DRE, ritmo e glossário', () => {
    const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const r = montar(e, 'completo')
    expect(valorDt(r.container, 'Break-even (pagos)').map((d) => d.textContent)[0]).toBe(AVISO)
    expect(valorDt(r.container, 'Break-even (pagos)')[1].textContent).toBe('568')
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe('568')
    expect(ritmo(r.container).textContent).toMatch(/precisa vender 16 por dia/)
    expect(r.getByText('Break-even (BE)').nextElementSibling.textContent).toContain('Neste evento: 568 ingressos pagos.')
  })
})

// ===========================================================================
describe('S6 Apresentação (PresentationMode) — decide pela visão do rascunho', () => {
  const montar = (e) =>
    render(<PresentationMode evento={e} store={storeDe(e)} update={vi.fn()} aparencia={{}} onClose={vi.fn()} />)
  const props = (e) => ({ evento: e, store: storeDe(e), update: vi.fn(), aparencia: {}, onClose: vi.fn() })

  it('cartões por cenário e legenda aberta', () => {
    const e = festa(CHEIO)
    const c = computeCenarios(e)
    const r = montar(e)
    expect(valorDt(r.container, 'Break-even').map((d) => d.textContent)).toEqual([
      `${fmtInt(c.pessimista.breakEven)} pagos`,
      AVISO,
      `${fmtInt(c.otimista.breakEven)} pagos`,
    ])
    fireEvent.click(r.getByText('Como ler este relatório'))
    const verbete = r.getByText('Break-even (BE)')
    expect(verbete.nextElementSibling.textContent).toBe(AVISO)
    expect(verbete.closest('dl').textContent).not.toMatch(/Neste evento: 1\.200 ingressos pagos/)
  })

  it('100/100/20 e zero: o mesmo aviso, nunca "não fecha"', () => {
    for (const mapa of [BAIXO, ZERO]) {
      const r = montar(festa(mapa))
      const dd = valorDt(r.container, 'Break-even')[1]
      expect(dd.textContent).toBe(AVISO)
      cleanup()
    }
  })

  it('o rascunho manda: a trava que existe SÓ no rascunho vale, mesmo com o evento salvo já sem ela', () => {
    // O rascunho nasce clonando o evento; depois disso `visaoDoRascunho` o põe
    // no lugar do `cenariosConfig` salvo. Quem decide a trava é a VISÃO.
    // O modo apresentação não tem campo de lote, então o único jeito de ter
    // salvo e rascunho DIVERGINDO é o salvo mudar depois da abertura (outra
    // aba, a ponte, desfazer): `rerender` com o evento sem ajuste.
    const travado = festa(CHEIO)
    const r = render(<PresentationMode {...props(travado)} />)
    expect(valorDt(r.container, 'Break-even')[1].textContent).toBe(AVISO)
    const solto = festa({})
    r.rerender(<PresentationMode {...props(solto)} />)
    // o evento salvo (prop) não tem trava; a visão (rascunho) ainda tem — a tela diz a trava
    expect(valorDt(r.container, 'Break-even')[1].textContent).toBe(AVISO)
    fireEvent.click(r.getByText('Como ler este relatório'))
    expect(r.getByText('Break-even (BE)').nextElementSibling.textContent).toBe(AVISO)
  })

  it('o inverso: o salvo ganha um ajuste depois, mas o rascunho (sem ajuste) segue numérico', () => {
    const solto = festa({})
    const r = render(<PresentationMode {...props(solto)} />)
    expect(valorDt(r.container, 'Break-even')[1].textContent).toBe('568 pagos')
    const travado = festa(CHEIO)
    r.rerender(<PresentationMode {...props(travado)} />)
    // a conta usa o rascunho (sem ajuste) — e o texto tem de seguir a mesma conta, não o evento salvo
    expect(valorDt(r.container, 'Break-even')[1].textContent).toBe('568 pagos')
    fireEvent.click(r.getByText('Como ler este relatório'))
    expect(r.getByText('Break-even (BE)').nextElementSibling.textContent).toContain('Neste evento: 568 ingressos pagos.')
  })

  it('trava só no pessimista: realista e otimista numéricos', () => {
    const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const r = montar(e)
    const dds = valorDt(r.container, 'Break-even').map((d) => d.textContent)
    expect(dds[0]).toBe(AVISO)
    expect(dds[1]).toBe('568 pagos')
    expect(dds[2]).toMatch(/pagos$/)
  })
})

// ===========================================================================
describe('S6 Home — o card de cada festa pela meta de ritmo', () => {
  const montarHome = (...es) =>
    render(<Home store={storeDe(...es)} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
  const festaNomeada = (nomeDoEvento, mapa, ajuste) => festa(mapa, (e) => { e.nome = nomeDoEvento; ajuste?.(e) })

  it('festa futura travada: o card dela diz o aviso; o card da vizinha sem trava segue com a meta numérica', () => {
    const travada = festaNomeada('Festa A travada', CHEIO)
    const livre = festaNomeada('Festa B livre', {})
    const r = montarHome(travada, livre)
    const a = cartaoDoEventoNaHome(r.container, 'Festa A travada')
    const b = cartaoDoEventoNaHome(r.container, 'Festa B livre')
    expect(a).not.toBe(b)
    expect(frasesDe(a)).toContain(AVISO)
    expect(textoDe(a)).not.toMatch(/p\/ break-even|\/dia|coberto/)
    expect(frasesDe(b)).toContain('Faltam 468 p/ break-even · 16/dia')
    expect(frasesDe(b)).not.toContain(AVISO)
  })

  it('festa JÁ REALIZADA e travada: o card mostra a marcação de realizado, não o aviso nem meta', () => {
    const passada = festaNomeada('Festa C passada', CHEIO, (e) => { e.data = '2026-11-15' })
    const r = montarHome(passada)
    const card = cartaoDoEventoNaHome(r.container, 'Festa C passada')
    expect(frasesDe(card)).toContain(MARCACAO_REALIZADA)
    expect(frasesDe(card)).not.toContain(AVISO)
    expect(textoDe(card)).not.toMatch(/p\/ break-even|\/dia/)
  })

  it('data ilegível e travada: o card diz que a data é inválida, nunca "0/dia"', () => {
    const torta = festaNomeada('Festa D data torta', CHEIO, (e) => { e.data = '05/12/2026' })
    const r = montarHome(torta)
    const card = cartaoDoEventoNaHome(r.container, 'Festa D data torta')
    expect(frasesDe(card)).toContain(DATA_DO_EVENTO_ILEGIVEL)
    expect(textoDe(card)).not.toMatch(/0\/dia|0 por dia/)
  })

  it('trava só no pessimista: o card segue com a meta numérica do realista', () => {
    const e = festaNomeada('Festa E pessimista', {}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const r = montarHome(e)
    expect(frasesDe(cartaoDoEventoNaHome(r.container, 'Festa E pessimista'))).toContain('Faltam 468 p/ break-even · 16/dia')
  })
})

// ===========================================================================
describe('S6 card de ritmo e curva de vendas', () => {
  it('RitmoVendasCard: a frase vira o aviso, o campo de vendidos continua e nada é gravado ao montar', () => {
    const e = festa(CHEIO)
    const c = computeCenarios(e)
    const update = vi.fn()
    const r = render(<RitmoVendasCard evento={e} update={update} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
    expect(frasesDe(r.container)).toContain(AVISO)
    expect(r.getByLabelText('Vendidos até hoje').value).toBe('100')
    expect(update).not.toHaveBeenCalled()
  })

  it('RitmoVendasCard SEM trava (e sem a prop nova): igual ao de antes', () => {
    const e = festa({})
    const c = computeCenarios(e)
    const r = render(<RitmoVendasCard evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} />)
    expect(textoDe(r.container)).toContain('precisa vender 16 por dia para cobrir o break-even (568)')
    expect(frasesDe(r.container)).not.toContain(AVISO)
  })

  it('festa passada e travada: o card dá a marcação, não o aviso', () => {
    const e = festa(CHEIO, (x) => { x.data = '2026-11-15' })
    const c = computeCenarios(e)
    const r = render(<RitmoVendasCard evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
    expect(frasesDe(r.container)).toContain(MARCACAO_REALIZADA)
    expect(frasesDe(r.container)).not.toContain(AVISO)
  })

  it('CurvaVendas com cache: conserva realizado e gráfico, troca só a meta pelo aviso', () => {
    const e = { ...festa(CHEIO), financeiro: { eventoId: 'fin-s6' } }
    const c = computeCenarios(e)
    saveCurvaCache(
      { eventos: [{ id: 'fin-s6', nome: e.nome, data: e.data, dias: [{ dia: -50, pagamentos: 2, valor: 8000 }] }], eventosSemData: [] },
      '2026-12-01T12:00:00Z'
    )
    const cacheAntes = localStorage.getItem('previsao-eventos:curva-financeiro:v1')
    const r = render(<CurvaVendas evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
    expect(frasesDe(r.container)).toContain(AVISO)
    expect(frasesDe(r.container).find((p) => p.includes('Até hoje'))).toContain('2 pagamentos')
    expect(r.container.querySelector('svg path')).toBeTruthy()
    expect(textoDe(r.container)).not.toMatch(META_DA_CURVA)
    expect(localStorage.getItem('previsao-eventos:curva-financeiro:v1')).toBe(cacheAntes)
  })

  it('controle positivo da regex da curva: o MESMO render com o evento SEM trava (overrides realistas vazios) casa com ela', () => {
    const e = { ...festa({}), financeiro: { eventoId: 'fin-s6' } }
    const c = computeCenarios(e)
    saveCurvaCache(
      { eventos: [{ id: 'fin-s6', nome: e.nome, data: e.data, dias: [{ dia: -50, pagamentos: 2, valor: 8000 }] }], eventosSemData: [] },
      '2026-12-01T12:00:00Z'
    )
    const r = render(<CurvaVendas evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
    // sem a trava, a meta existe — e a regex a enxerga (se não enxergasse, o "não casa" de cima seria instrumento cego)
    expect(textoDe(r.container)).toMatch(META_DA_CURVA)
    expect(textoDe(r.container)).toMatch(/faltam \d|\d+\/dia/i)
    expect(frasesDe(r.container)).not.toContain(AVISO)
  })

  it('CurvaVendas SEM cache: não inventa linha de ritmo e não chama a rede', () => {
    const e = { ...festa(CHEIO), financeiro: { eventoId: 'fin-s6' } }
    const c = computeCenarios(e)
    expect(localStorage.getItem('previsao-eventos:curva-financeiro:v1')).toBeNull() // controle: sem cache
    const r = render(<CurvaVendas evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
    expect(frasesDe(r.container)).not.toContain(AVISO)
    expect(textoDe(r.container)).not.toMatch(META_DA_CURVA)
    expect(textoDe(r.container)).not.toMatch(/Até hoje \(/)
    // (a asserção de zero chamadas a `fetch` mora no afterEach, que vale para todos os casos)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ===========================================================================
describe('S6 × #98 — dado inválido vence a trava, em todas as telas', () => {
  const quebras = {
    'custo estimado = 1e308': comCustoQuebrado,
    'ticket de bar realista = 1e308': comBarQuebrado,
  }
  describe.each(Object.entries(quebras))('%s', (_n, quebra) => {
    const monta = () => festa(CHEIO, quebra)

    it('controle: as guardas existentes acusam o cenário realista', () => {
      const e = monta()
      const c = computeCenarios(e)
      expect(cenarioQuebrado(e, c.realista, c) || receitaDoCenarioQuebrada(e, c.realista, c)).toBe(true)
    })

    it('aba Cenários: cartão, DRE e card de ritmo dizem "não dá para calcular"; a faixa do campo quebrado permanece', () => {
      const e = monta()
      const r = render(<ScenariosTab evento={e} store={storeDe(e)} update={vi.fn()} />)
      expect(valorDt(r.container, 'Break-even')[1].textContent).toBe(NUMERO_NAO_CALCULA)
      expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(NUMERO_NAO_CALCULA)
      fireEvent.click(r.getByText('R$/pax'))
      expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(NUMERO_NAO_CALCULA)
      // o aviso de trava não aparece em lugar nenhum desta tela
      expect(r.container.textContent).not.toContain(AVISO)
      // a faixa que explica o campo quebrado continua lá
      expect(r.container.textContent).toMatch(new RegExp(`${TITULO_CUSTO_QUEBRADO}|${TITULO_RECEITA_QUEBRADA}`))
    })

    it('card de ritmo: "não dá para calcular", sem meta e sem aviso de trava', () => {
      const e = monta()
      const c = computeCenarios(e)
      const r = render(<RitmoVendasCard evento={e} update={vi.fn()} breakEvenRealista={c.realista.breakEven} cenarios={c} />)
      expect(frasesDe(r.container)).toContain(NUMERO_NAO_CALCULA)
      expect(r.container.textContent).not.toContain(AVISO)
    })

    it('relatório completo: cartão, DRE, ritmo e glossário; a faixa permanece', () => {
      const e = monta()
      localStorage.setItem(NIVEL, 'completo')
      const r = render(<ReportView evento={e} store={storeDe(e)} onBack={vi.fn()} />)
      expect(valorDt(r.container, 'Break-even (pagos)')[1].textContent).toBe(NUMERO_NAO_CALCULA)
      expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(NUMERO_NAO_CALCULA)
      const ritmo = [...r.container.querySelectorAll('p')].find((p) => p.textContent.startsWith('Ritmo de vendas:'))
      expect(ritmo.textContent).toBe(`Ritmo de vendas: ${NUMERO_NAO_CALCULA}`)
      // o glossário cai na definição genérica quando o dado está quebrado (nenhum número, nenhuma trava)
      const def = r.getByText('Break-even (BE)').nextElementSibling.textContent
      expect(def).toBe(DEFINICAO_GENERICA_BE)
      expect(def).not.toContain(AVISO)
      expect(def).not.toMatch(/Neste evento/)
      expect(r.container.textContent).not.toContain(AVISO)
      expect(r.container.textContent).toMatch(new RegExp(`${TITULO_CUSTO_QUEBRADO}|${TITULO_RECEITA_QUEBRADA}`))
    })

    it('relatório e apresentação dizem a MESMA definição do break-even com o dado quebrado', () => {
      const e = monta()
      localStorage.setItem(NIVEL, 'completo')
      const rel = render(<ReportView evento={e} store={storeDe(e)} onBack={vi.fn()} />)
      const defRelatorio = rel.getByText('Break-even (BE)').nextElementSibling.textContent
      cleanup()
      const ap = render(<PresentationMode evento={e} store={storeDe(e)} update={vi.fn()} aparencia={{}} onClose={vi.fn()} />)
      fireEvent.click(ap.getByText('Como ler este relatório'))
      const defApresentacao = ap.getByText('Break-even (BE)').nextElementSibling.textContent
      expect(defRelatorio).toBe(DEFINICAO_GENERICA_BE) // controle: não é uma comparação de dois textos vazios
      expect(defApresentacao).toBe(defRelatorio)
    })

    it('apresentação: cartão e legenda; a faixa permanece', () => {
      const e = monta()
      const r = render(<PresentationMode evento={e} store={storeDe(e)} update={vi.fn()} aparencia={{}} onClose={vi.fn()} />)
      expect(valorDt(r.container, 'Break-even')[1].textContent).toBe(NUMERO_NAO_CALCULA)
      fireEvent.click(r.getByText('Como ler este relatório'))
      const def = r.getByText('Break-even (BE)').nextElementSibling.textContent
      expect(def).toBe(DEFINICAO_GENERICA_BE)
      expect(def).not.toContain(AVISO)
      expect(r.container.textContent).not.toContain(AVISO)
      expect(r.container.textContent).toMatch(new RegExp(`${TITULO_CUSTO_QUEBRADO}|${TITULO_RECEITA_QUEBRADA}`))
    })
  })

  it('soma que não cabe em OUTRO cenário (lote de R$ 1e306, realista travado em 1): cartão, DRE, legenda da apresentação e Home dizem "não dá para calcular"', () => {
    const e = festa({ l1: 1 }, (x) => { x.lotes[0].valor = 1e306 })
    const c = computeCenarios(e)
    expect(cenarioQuebrado(e, c.realista)).toBe(false) // controle: sozinho o realista cabe
    expect(cenarioQuebrado(e, c.realista, c)).toBe(true)
    const tab = render(<ScenariosTab evento={e} store={storeDe(e)} update={vi.fn()} />)
    expect(valorDt(tab.container, 'Break-even')[1].textContent).toBe(NUMERO_NAO_CALCULA)
    expect(celulaDre(tab.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(NUMERO_NAO_CALCULA)
    expect(tab.container.textContent).not.toContain(AVISO)
    cleanup()
    const ap = render(<PresentationMode evento={e} store={storeDe(e)} update={vi.fn()} aparencia={{}} onClose={vi.fn()} />)
    expect(valorDt(ap.container, 'Break-even')[1].textContent).toBe(NUMERO_NAO_CALCULA)
    fireEvent.click(ap.getByText('Como ler este relatório'))
    // #98: o glossário da apresentação recebe `null` como realista quebrado, igual ao relatório: definição genérica
    const defApresentacao = ap.getByText('Break-even (BE)').nextElementSibling.textContent
    expect(defApresentacao).toBe(DEFINICAO_GENERICA_BE)
    expect(defApresentacao).not.toBe(NUMERO_NAO_CALCULA)
    expect(ap.container.textContent).not.toContain(AVISO)
    cleanup()
    // e o relatório completo diz a MESMA coisa nesse caso (as duas telas não podem divergir)
    localStorage.setItem(NIVEL, 'completo')
    const rel = render(<ReportView evento={e} store={storeDe(e)} onBack={vi.fn()} />)
    expect(rel.getByText('Break-even (BE)').nextElementSibling.textContent).toBe(defApresentacao)
    cleanup()
    const h = render(<Home store={storeDe(e)} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
    expect(h.container.textContent).not.toContain(AVISO)
  })

  it('ticket de bar do OTIMISTA = 1e308 com realista travado: o realista diz a trava, o otimista o dado inválido', () => {
    const e = festa(CHEIO, (x) => { x.barTicket.otimista = 1e308 })
    const c = computeCenarios(e)
    expect(receitaDoCenarioQuebrada(e, c.otimista, c)).toBe(true) // controle
    expect(cenarioQuebrado(e, c.realista, c) || receitaDoCenarioQuebrada(e, c.realista, c)).toBe(false)
    const r = render(<ScenariosTab evento={e} store={storeDe(e)} update={vi.fn()} />)
    const dds = valorDt(r.container, 'Break-even')
    expect(dds[1].textContent).toBe(AVISO)
    expect(dds[2].textContent).toBe(NUMERO_NAO_CALCULA)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 2).textContent).toBe(AVISO)
    expect(celulaDre(r.container, 'Break-even (ingressos pagos)', 3).textContent).toBe(NUMERO_NAO_CALCULA)
    // e o card de ritmo (que lê o realista) também diz a trava
    expect(frasesDe(r.container)).toContain(AVISO)
  })
})

// ===========================================================================
// Por último de propósito: o React avisa uma vez por atributo por processo, e
// este caso gasta o aviso. Aqui só se prova que o espião do `afterEach` enxerga
// o aviso do `fill` — sem isto, "nenhum aviso" seria prova de instrumento cego.
describe('S6 aviso do React sobre o `fill` da Bola', () => {
  it('controle positivo: uma Bola com cor `false` faria o React reclamar (o espião enxerga)', () => {
    erroSpy.mockImplementation(() => {}) // o aviso provocado de propósito não precisa sujar a saída
    render(<Bola cor={false} />)
    const recebidas = erroSpy.mock.calls.filter((a) => /non-boolean attribute/.test(String(a[0])))
    expect(recebidas.length).toBeGreaterThan(0)
    erroSpy.mockClear() // o afterEach não deve tratar o aviso provocado de propósito como regressão
  })
})
