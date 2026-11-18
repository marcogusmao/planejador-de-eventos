// @vitest-environment jsdom
//
// PÚBLICO ILEGÍVEL NUMA REFERÊNCIA — S1 do BACKLOG, 06/10/2026 (fechado em
// 07/10/2026). Um benchmark com `publico: "ilegível"` aparecia como "0 pessoas"
// no cabeçalho da comparação do relatório. Medido na base `abbaa68`, nas cinco
// telas que mostram ou usam o público de uma referência, com um benchmark
// próprio e com o override de um embutido (os dois dão o mesmo):
//
//   público gravado      relatório        Cenários "Por pessoa"  Custos › Referências  tela inicial  campo do Editar
//   "ilegível"/"1.2.3"/{} "0 pessoas"     "R$ 0"                 "(R$ 0/pessoa)"       "0"           "0"
//   1e308                 309 dígitos      "R$ 0"                 "(R$ 0/pessoa)"       309 dígitos   309 dígitos
//   NaN                   "—"              "—"                    (nada)                "—"           "0"
//   −5                    "-5 pessoas"     "-R$ 8.400"            "(-R$ 1.200/pessoa)"  "-5"          "-5"
//   0 / '' / undefined    "—"              "—"                    (nada)                "—"           "0" / "" / ""
//
// Nenhuma faixa em nenhum caso. Cada teste abaixo localiza a CÉLULA (o
// cabeçalho daquela referência, a linha daquela barra), não o texto global da
// tela: "0 pessoas" ou "R$ 0" de outra coluna passariam num `textContent`.
//
// O que NÃO muda, e também é provado aqui: zero legítimo e ausência saem
// exatamente como antes (a expressão antiga é recalculada no próprio teste), e
// o valor guardado não é tocado — nem no store, nem no backup.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import ReportView from './ReportView.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import CostsTab from './CostsTab.jsx'
import Home from './Home.jsx'
import BenchmarksEditor from './BenchmarksEditor.jsx'
import {
  TITULO_BENCHMARK_QUEBRADO,
  FRASE_CONSEQUENCIA_BENCHMARK,
  FRASE_CONSEQUENCIA_PUBLICO,
  FRASE_CONSERTO_BENCHMARK,
  FRASE_CONSERTO_PUBLICO,
  frasePublicoIlegivel,
  AvisoBenchmarkQuebrado,
  FRASE_EMBUTIDOS_SAOS,
} from './AvisoCustoQuebrado.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { CAT_KEYS, FIXED_BENCHMARKS, benchmarksDisponiveis, porPessoa } from '../lib/benchmarks.js'
import {
  publicoDaReferencia,
  ESTADO_PUBLICO,
  PUBLICO_ILEGIVEL,
  NUMERO_NAO_CALCULA,
  VALOR_ILEGIVEL,
} from '../lib/dadoQuebrado.js'
import { fmtInt, fmtBRL2, fmtCompact, DASH } from '../lib/format.js'

afterEach(cleanup)

const mapa = new Map()
globalThis.localStorage = {
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
  clear: () => mapa.clear(),
}

// Os seis da ficha do BACKLOG, com o rótulo que aparece no nome do teste.
// Terceiro elemento: o que o campo Público do "Editar" mostra — o valor
// guardado cru (revisão adversarial de 07/10/2026), vazio só para objeto.
const ILEGIVEIS = [
  ['texto “ilegível”', 'ilegível', 'ilegível'],
  ['“1.2.3”', '1.2.3', '1.2.3'],
  ['objeto', { a: 1 }, ''],
  ['1e308', 1e308, '1e+308'],
  ['NaN', NaN, 'NaN'],
  ['−5', -5, '-5'],
  // Decisão do Marco, 07/10/2026 (questionário): régua de quantidade do app.
  ['0,4', 0.4, '0,4'],
  ['400,5', 400.5, '400,5'],
  ['100.000.001', 100_000_001, '100.000.001'],
  ['1e306', 1e306, '1e+306'],
]
// Zero legítimo e ausência: a saída de hoje fica. 400 é o controle do válido.
const PRESERVADOS = [
  ['zero', 0],
  ['vazio', ''],
  ['undefined', undefined],
  ['null', null],
  ['400', 400],
  ['100.000.000 (o teto, válido)', 100_000_000],
]
const ORIGENS = ['custom', 'override']
const OURICO = FIXED_BENCHMARKS.find((b) => b.id === 'bm-cordel')

function montar(publico, origem) {
  const e = novoEvento('Festa sintética')
  e.publicoEstimado = 200
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.categorias.forEach((c, i) => {
    c.itens = [novoItem({ servico: `Item ${i}`, estimado: 1000 * (i + 1) })]
  })
  const custom = {
    id: 'bm-sint',
    nome: 'Referência sintética',
    custom: true,
    publico,
    custos: Object.fromEntries(CAT_KEYS.map((k, j) => [k, 6000 + j])),
    custoTotal: 6000 * CAT_KEYS.length + 21,
  }
  const override = origem === 'override'
  const store = {
    eventos: [e],
    benchmarksCustom: override ? [] : [custom],
    benchmarkOverrides: override ? { 'bm-cordel': { publico } } : {},
    benchmarksOcultos: [],
    benchmarksPadrao: {},
    benchmarksApagados: [],
    ajustes: {},
  }
  e.benchmarksAtivos = [override ? 'bm-cordel' : 'bm-sint']
  const bm = benchmarksDisponiveis(store).find((b) => b.id === e.benchmarksAtivos[0])
  return { e, store, bm, nome: override ? OURICO.nome : custom.nome }
}

const n = (s) => s.replace(/\s+/g, ' ').trim()
const txt = (el) => (el ? n(el.textContent) : null)

// ---------------------------------------------------------------- localizadores
function cabecalhoRelatorio(container, nome) {
  mapa.set('previsao-eventos:relatorio-nivel:v1', 'completo')
  const secao = [...container.querySelectorAll('h2')].find((h) => h.textContent === 'Comparação com eventos passados')
    ?.parentElement
  const th = [...secao.querySelectorAll('thead tr:last-child th')].find((x) => x.firstElementChild?.textContent === nome)
  return { secao, th, publico: th?.lastElementChild }
}
function renderRelatorio(e, store) {
  mapa.set('previsao-eventos:relatorio-nivel:v1', 'completo')
  return render(<ReportView evento={e} store={store} onBack={() => {}} />).container
}
function linhaDaBarra(container, nome) {
  const card = container.querySelector('#cen-comparacao')
  const rotulo = [...card.querySelectorAll('[title]')].find((x) => x.getAttribute('title') === nome)
  const linha = rotulo?.parentElement
  return { linha, barra: linha?.children[1], valor: linha?.children[2] }
}
function renderCenarios(e, store, modo) {
  const r = render(
    <ScenariosTab evento={e} update={() => {}} updateCenarios={() => {}} store={store} setStore={() => {}} />
  )
  if (modo === 'pp') fireEvent.click(r.getAllByText('Por pessoa')[0])
  return r.container
}
function referenciasDaCategoria(container, nome) {
  const bloco = [...container.querySelectorAll('div')].find((d) => d.firstElementChild?.textContent === 'Referências:')
  return [...bloco.children].find((x) => x.textContent.startsWith(nome))
}
function celulaPublicoHome(container, nome) {
  const tr = [...container.querySelectorAll('tbody tr')].find((x) => x.firstElementChild?.textContent.includes(nome))
  return tr?.children[2]
}
function campoPublicoEditor(nome) {
  const nomeIn = [...document.querySelectorAll('input[aria-label="Nome do evento antigo"]')].find((i) => i.value === nome)
  let cartao = nomeIn
  while (cartao && !cartao.querySelector('label')) cartao = cartao.parentElement
  const label = [...cartao.querySelectorAll('label')].find((l) => l.firstElementChild?.textContent === 'Público')
  return { input: label.querySelector('input'), label }
}

// ============================================================ a leitura (lib)
describe('publicoDaReferencia — os quatro estados', () => {
  it.each([
    ["''", 'ausente', ''],
    ['null', 'ausente', null],
    ['undefined', 'ausente', undefined],
    ['0', 'zero', 0],
    ["'0'", 'zero', '0'],
    ['400', 'valido', 400],
    ["'400'", 'valido', '400'],
    ["'ilegível'", 'ilegivel', 'ilegível'],
    ["'1.2.3'", 'ilegivel', '1.2.3'],
    ['{ a: 1 }', 'ilegivel', { a: 1 }],
    ['[400]', 'ilegivel', [400]],
    ['true', 'ilegivel', true],
    ['1e308', 'ilegivel', 1e308],
    ['Infinity', 'ilegivel', Infinity],
    ['NaN', 'ilegivel', NaN],
    ['-5', 'ilegivel', -5],
    ["' ' (só espaço)", 'zero', ' '],
    ['false', 'ilegivel', false],
    ['0,4', 'ilegivel', 0.4],
    ['400,5', 'ilegivel', 400.5],
    ["'400.5'", 'ilegivel', '400.5'],
    ['100.000.000', 'valido', 100_000_000],
    ['100.000.001', 'ilegivel', 100_000_001],
    ['1e306', 'ilegivel', 1e306],
  ])('público %s → %s', (_rotulo, estado, publico) => {
    expect(publicoDaReferencia({ publico }).estado).toBe(estado)
  })

  it('não muda o objeto lido (o original segue no store e no backup)', () => {
    const bm = { id: 'x', nome: 'X', publico: 'ilegível' }
    const antes = JSON.stringify(bm)
    publicoDaReferencia(bm)
    expect(JSON.stringify(bm)).toBe(antes)
  })

  it('o override de embutido com público ilegível chega à lista com o ORIGINAL, sem normalizar', () => {
    for (const [, publico] of ILEGIVEIS) {
      const { bm } = montar(publico, 'override')
      expect(Object.is(bm.publico, publico)).toBe(true)
      expect(publicoDaReferencia(bm).estado).toBe(ESTADO_PUBLICO.ILEGIVEL)
    }
  })
})

// =============================================== as cinco telas, célula a célula
describe.each(ORIGENS)('benchmark %s — público ilegível', (origem) => {
  describe.each(ILEGIVEIS)('%s', (_rotulo, publico, campoEsperado) => {
    it('Relatório › cabeçalho da comparação: diz que não consegue calcular, nunca “N pessoas”', () => {
      const { e, store, nome } = montar(publico, origem)
      const { secao, publico: celula } = cabecalhoRelatorio(renderRelatorio(e, store), nome)
      expect(txt(celula)).toBe(PUBLICO_ILEGIVEL)
      expect(txt(celula)).not.toMatch(/pessoas/)
      // a faixa da seção nomeia a referência e o original, e não afirma R$ 0
      const faixa = [...secao.querySelectorAll('[role="alert"]')].find((f) => f.textContent.includes(TITULO_BENCHMARK_QUEBRADO))
      expect(faixa).toBeTruthy()
      expect(txt(faixa)).toContain(frasePublicoIlegivel({ nome, original: publico }))
      expect(txt(faixa)).toContain(FRASE_CONSEQUENCIA_PUBLICO)
      expect(txt(faixa)).toContain(FRASE_CONSERTO_PUBLICO)
      expect(txt(faixa)).not.toContain(FRASE_CONSEQUENCIA_BENCHMARK)
      expect(txt(faixa)).not.toContain(FRASE_CONSERTO_BENCHMARK)
    })

    it('Cenários › “Por pessoa”: a barra da referência some e o valor diz “não dá para calcular”', () => {
      const { e, store, nome } = montar(publico, origem)
      const { barra, valor } = linhaDaBarra(renderCenarios(e, store, 'pp'), nome)
      expect(txt(valor)).toBe(NUMERO_NAO_CALCULA)
      expect(barra.children).toHaveLength(0)
    })

    it('Cenários › “Absoluto”: o público não entra, o custo total sai como antes', () => {
      const { e, store, bm, nome } = montar(publico, origem)
      const { valor } = linhaDaBarra(renderCenarios(e, store, 'abs'), nome)
      expect(txt(valor)).not.toBe(NUMERO_NAO_CALCULA)
      expect(txt(valor)).toMatch(/^R\$/)
      expect(bm.custoTotal).toBeGreaterThan(0)
    })

    it('Custos › Referências: “por pessoa: não dá para calcular”, nunca “R$ 0/pessoa”', () => {
      const { e, store, bm, nome } = montar(publico, origem)
      const ref = referenciasDaCategoria(render(<CostsTab evento={e} update={() => {}} store={store} />).container, nome)
      const k = CAT_KEYS.find((x) => e.categorias.some((c) => c.id === x))
      expect(txt(ref)).toBe(n(`${nome} ${fmtCompact(bm.custos[k])} (por pessoa: ${NUMERO_NAO_CALCULA})`))
    })

    it('tela inicial › coluna Público: o texto de valor ilegível, com o original no title', () => {
      const { store, nome } = montar(publico, origem)
      const celula = celulaPublicoHome(
        render(<Home store={store} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />).container,
        nome
      )
      expect(txt(celula)).toBe(VALOR_ILEGIVEL)
      expect(celula.querySelector('span').getAttribute('title')).toBe(
        `Valor guardado: ${typeof publico === 'object' ? JSON.stringify(publico) : String(publico)}`
      )
    })

    it('Editar benchmarks › campo Público: o valor guardado cru, com o aviso embaixo, e nada gravado', () => {
      const { store, nome } = montar(publico, origem)
      const setStore = vi.fn()
      render(<BenchmarksEditor store={store} setStore={setStore} onClose={() => {}} />)
      const { input } = campoPublicoEditor(nome)
      expect(input.value).toBe(campoEsperado)
      expect(input.value).not.toBe('0')
      const descr = document.getElementById(input.getAttribute('aria-describedby'))
      const original = typeof publico === 'object' ? JSON.stringify(publico) : String(publico)
      expect(txt(descr)).toBe(
        `Valor guardado: ${original}. Não dá para calcular; informe o número correto neste campo. O original fica guardado até você editar.`
      )
      // focar e sair sem digitar não grava nada: o original continua no store
      fireEvent.focus(input)
      expect(input.value).toBe(campoEsperado) // o foco não troca o texto cru por "0"
      fireEvent.blur(input)
      expect(setStore).not.toHaveBeenCalled()
      const guardado = origem === 'override' ? store.benchmarkOverrides['bm-cordel'].publico : store.benchmarksCustom[0].publico
      expect(Object.is(guardado, publico)).toBe(true)
    })
  })
})

// =========================== o texto "0": lido como o zero que é (mudou de propósito)
describe.each(ORIGENS)('benchmark %s — público gravado como o texto "0"', (origem) => {
  it('relatório, Cenários “Por pessoa”, Custos e tela inicial escrevem como o zero numérico — nada de dividir por zero', () => {
    const zeroTexto = montar('0', origem)
    const zeroNum = montar(0, origem)
    const ler = ({ e, store, nome }) => {
      const rel = txt(cabecalhoRelatorio(renderRelatorio(e, store), nome).publico)
      cleanup()
      const pp = txt(linhaDaBarra(renderCenarios(e, store, 'pp'), nome).valor)
      cleanup()
      const custos = txt(referenciasDaCategoria(render(<CostsTab evento={e} update={() => {}} store={store} />).container, nome))
      cleanup()
      const home = txt(
        celulaPublicoHome(
          render(<Home store={store} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />).container,
          nome
        )
      )
      cleanup()
      return { rel, pp, custos, home }
    }
    const t = ler(zeroTexto)
    expect(t).toEqual(ler(zeroNum))
    expect(t.rel).toBe(DASH)
    expect(t.pp).toBe('—')
    expect(t.custos).not.toMatch(/pessoa/)
  })
})

// ======================================= zero, ausência e válido: como antes
describe.each(ORIGENS)('benchmark %s — zero, ausência e válido saem como antes', (origem) => {
  describe.each(PRESERVADOS)('%s', (_rotulo, publico) => {
    it('Relatório: a expressão antiga (`b.publico ? N pessoas : —`), sem faixa', () => {
      const { e, store, bm, nome } = montar(publico, origem)
      const { secao, publico: celula } = cabecalhoRelatorio(renderRelatorio(e, store), nome)
      expect(txt(celula)).toBe(n(bm.publico ? `${fmtInt(bm.publico)} pessoas` : DASH))
      expect(secao.textContent).not.toContain(TITULO_BENCHMARK_QUEBRADO)
    })

    it('Cenários “Por pessoa”: a conta antiga (porPessoa → fmtBRL2 ou —)', () => {
      const { e, store, bm, nome } = montar(publico, origem)
      const { valor } = linhaDaBarra(renderCenarios(e, store, 'pp'), nome)
      const pp = porPessoa(bm, bm.custoTotal)
      expect(txt(valor)).toBe(pp == null ? '—' : n(fmtBRL2(pp)))
    })

    it('Custos › Referências: a expressão antiga', () => {
      const { e, store, bm, nome } = montar(publico, origem)
      const ref = referenciasDaCategoria(render(<CostsTab evento={e} update={() => {}} store={store} />).container, nome)
      const k = CAT_KEYS.find((x) => e.categorias.some((c) => c.id === x))
      const pp = porPessoa(bm, bm.custos[k])
      expect(txt(ref)).toBe(n(`${nome} ${fmtCompact(bm.custos[k])}${pp != null ? ` (${fmtBRL2(pp)}/pessoa)` : ''}`))
    })

    it('tela inicial: a expressão antiga (`b.publico ? fmtInt : —`)', () => {
      const { store, bm, nome } = montar(publico, origem)
      const celula = celulaPublicoHome(
        render(<Home store={store} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />).container,
        nome
      )
      expect(txt(celula)).toBe(bm.publico ? fmtInt(bm.publico) : '—')
    })

    it('Editar: o campo mostra o que mostrava, sem frase embaixo', () => {
      const { store, bm, nome } = montar(publico, origem)
      render(<BenchmarksEditor store={store} setStore={vi.fn()} onClose={() => {}} />)
      const { input, label } = campoPublicoEditor(nome)
      expect(input.value).toBe(bm.publico == null || bm.publico === '' ? '' : fmtInt(bm.publico))
      expect(input.getAttribute('aria-describedby')).toBeNull()
      expect(label.textContent).not.toContain('Valor guardado')
    })
  })
})

// ======================= digitar no campo Público (revisão adversarial, 07/10/2026)
// Com o campo recebendo '' quando o público ficava ilegível, "-5" gravado
// fazia o campo largar o rascunho; a tecla seguinte começava do vazio e
// "-50" num público de 400 terminava gravando 0. A base gravava −50.
function EditorComEstado({ inicial, aoMudar }) {
  const [store, setStoreInterno] = useState(inicial)
  const setStore = (f) =>
    setStoreInterno((s) => {
      const novo = typeof f === 'function' ? f(s) : f
      aoMudar(novo)
      return novo
    })
  return <BenchmarksEditor store={store} setStore={setStore} onClose={() => {}} />
}
describe.each(ORIGENS)('benchmark %s — digitar "-", "-5", "-50" num público de 400', (origem) => {
  it('o valor guardado nunca vira 0, termina em −50, e o campo mostra o que foi digitado', () => {
    const { store, nome } = montar(400, origem)
    const guardados = []
    const lerGuardado = (st) =>
      origem === 'override' ? st.benchmarkOverrides['bm-cordel']?.publico : st.benchmarksCustom[0].publico
    render(<EditorComEstado inicial={store} aoMudar={(st) => guardados.push(lerGuardado(st))} />)
    const { input } = campoPublicoEditor(nome)
    fireEvent.focus(input)
    for (const tecla of ['-', '-5', '-50']) {
      fireEvent.change(input, { target: { value: tecla } })
      expect(campoPublicoEditor(nome).input.value).toBe(tecla)
    }
    expect(guardados).not.toContain(0)
    expect(guardados.at(-1)).toBe(-50)
    // fora da digitação, o campo segue mostrando o valor guardado, e o aviso diz que ele não calcula
    fireEvent.blur(campoPublicoEditor(nome).input)
    const fim = campoPublicoEditor(nome)
    expect(fim.input.value).toBe('-50')
    expect(txt(document.getElementById(fim.input.getAttribute('aria-describedby')))).toMatch(/^Valor guardado: -50\./)
  })
})

// ================== a faixa em todas as combinações (revisão adversarial, 07/10/2026)
// custo/público × próprio/embutido. Antes: com custo quebrado numa referência
// própria e público ilegível no Cordel, a faixa omitia o conserto do público e
// afirmava "Os quatro benchmarks históricos embutidos não têm este problema."
describe('AvisoBenchmarkQuebrado — só o verdadeiro, em cada combinação', () => {
  const custos = Object.fromEntries(CAT_KEYS.map((k) => [k, 1000]))
  const propriaCustoQuebrado = { id: 'p-custo', nome: 'Própria custo', custom: true, publico: 300, custos: { ...custos, estrutura: 1e308 }, custoTotal: 1e308 }
  const propriaPublico = { id: 'p-pub', nome: 'Própria público', custom: true, publico: 'ilegível', custos, custoTotal: 7000 }
  const propriaSa = { id: 'p-sa', nome: 'Própria sã', custom: true, publico: 300, custos, custoTotal: 7000 }
  const cordelCom = (ov) => benchmarksDisponiveis({ benchmarkOverrides: { 'bm-cordel': ov } }).find((b) => b.id === 'bm-cordel')
  const cordelSao = cordelCom(undefined)
  const cordelPublico = cordelCom({ publico: 'ilegível' })
  const cordelCusto = cordelCom({ custos: { estrutura: 1e308 } })
  const faixa = (lista) => {
    const { container } = render(<AvisoBenchmarkQuebrado benchmarks={lista} />)
    const t = txt(container)
    cleanup()
    return t
  }
  const tem = (t, frase) => t.includes(n(frase))
  it.each([
    // [rótulo, lista, conserto do custo, conserto do público, frase dos embutidos]
    ['custo próprio + público do Cordel (o caso da revisão)', () => [propriaCustoQuebrado, cordelPublico], true, true, false],
    ['custo próprio + Cordel são', () => [propriaCustoQuebrado, cordelSao], true, false, true],
    ['custo próprio, sem embutido na lista', () => [propriaCustoQuebrado], true, false, false],
    ['custo do Cordel (override)', () => [cordelCusto, propriaSa], true, false, false],
    ['público próprio + Cordel são', () => [propriaPublico, cordelSao], false, true, true],
    ['público do Cordel', () => [cordelPublico, propriaSa], false, true, false],
    ['público próprio + custo do Cordel', () => [propriaPublico, cordelCusto], true, true, false],
  ])('%s', (_r, lista, consertoCusto, consertoPublico, embutidosSaos) => {
    const t = faixa(lista())
    expect(t).toContain(TITULO_BENCHMARK_QUEBRADO)
    expect(tem(t, FRASE_CONSERTO_BENCHMARK)).toBe(consertoCusto)
    expect(tem(t, FRASE_CONSEQUENCIA_BENCHMARK)).toBe(consertoCusto)
    expect(tem(t, FRASE_CONSERTO_PUBLICO)).toBe(consertoPublico)
    expect(tem(t, FRASE_CONSEQUENCIA_PUBLICO)).toBe(consertoPublico)
    expect(tem(t, FRASE_EMBUTIDOS_SAOS)).toBe(embutidosSaos)
    expect(t).not.toContain('Os quatro benchmarks históricos embutidos')
  })
})
