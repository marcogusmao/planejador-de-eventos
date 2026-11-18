// @vitest-environment jsdom
//
// O DADO QUEBRADO PARA DE ENTRAR NA RÉGUA PELA PROMOÇÃO E PELO "CARREGAR DE
// BENCHMARK", A COMPARAÇÃO AVISA QUANDO A RÉGUA JÁ ESTÁ QUEBRADA, E A FAIXA
// PARA DE AFIRMAR O QUE NÃO VERIFICOU.
//
// O que NÃO está fechado, dito para ninguém ler o título como mais do que é
// (corrigido em 05/10/2026 — o título anterior dizia "para de contaminar festa
// sã", e o revisor do PR #98 achou duas portas abertas): o importador de
// planilha e o backup JSON ainda podem trazer benchmark quebrado. Contra
// esses, a faixa da comparação AVISA; ninguém recusa.
//
// ===========================================================================
// 1. O CONTÁGIO — o que estava medido antes desta frente (26/07/2026)
// ===========================================================================
// Uma Brisa com "Som e luz" em 1 seguido de 308 zeros é fechada e PROMOVIDA a
// benchmark. O objeto que ia para `store.benchmarksCustom` — dado SALVO,
// princípio 3 do CLAUDE.md — nascia assim:
//
//     custoTotal ......... Infinity
//     custos.estrutura ... 1e+308
//     lucro .............. -Infinity
//
// Esse objeto vira RÉGUA das outras festas. Numa "Marfim de outubro" que não
// tem defeito nenhum (custo R$ 29 mil), as duas telas de comparação passavam a
// escrever, sem aviso:
//
//   aba Cenários › Comparação com eventos passados
//     Custo total ...... Marfim R$ 29 mil (barra 0%) × Brisa quebrada R$ 0
//     Estrutura ........ Previsão R$ 20 mil (barra 2e-302%) × quebrada 100%,
//                        com 367 caracteres de número na célula de valor
//   aba Custos › Referências
//     A&B .............. Brisa quebrada R$ 3 mil
//     Estrutura ........ Brisa quebrada R$ 1000…000 (323 caracteres)
//
// Este arquivo trava: a promoção RECUSA (custos e, desde 05/10/2026, o
// benchmark montado — receita ou Pix de 1e308), o "carregar de benchmark"
// RECUSA referência quebrada (05/10/2026), e a comparação AVISA (a recusa não
// limpa benchmark já salvo, e não é a única entrada — o importador de planilha
// e o backup JSON também criam benchmark).
//
// ===========================================================================
// 2. A FAIXA QUE AFIRMAVA DEMAIS
// ===========================================================================
// A frase "no lugar do valor da festa o app escreve R$ 0" era MENTIRA em três
// situações, todas medidas:
//
//   (a) festa FECHADA com fotografia SÃ e o custo corrompido depois — a tela
//       imprime "Custos considerados − R$ 403.000" e "Resultado parcial
//       − R$ 384.000", e a faixa ainda mandava "voltar a uma cópia de
//       segurança", o que trocaria a fotografia CORRETA por uma versão
//       anterior. Conselho danoso.
//   (b) aba Análise — a tela não zera, ela imprime o número por extenso:
//       "saldo -R$ 100.000.000…000 no primeiro dia negativo".
//   (c) item com "realizado" em TEXTO ("a combinar") e estimado R$ 5.000 — o
//       total considerado imprime R$ 5.000, certo, e a faixa dizia R$ 0.
//
// (c) não estava no relatório do provador: apareceu ao procurar POR QUE (a)
// acontecia. É a mesma família — a faixa afirmava sem medir.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import CostsTab from './CostsTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import AnaliseTab from './AnaliseTab.jsx'
import ReportView from './ReportView.jsx'
import EventEditor from './EventEditor.jsx'
import { ToastHost } from './ui.jsx'
import {
  TITULO_CUSTO_QUEBRADO,
  TITULO_BENCHMARK_QUEBRADO,
  CONSEQ_ZERA,
  CONSEQ_LUCRO,
  CONSEQ_TEXTO,
  CONSEQ_NUMERO_GIGANTE,
  CONSEQ_NAO_USADO,
  CONSEQ_FOTO_INTACTA,
  CONSERTO_CORRIGIR,
  CONSERTO_NAO_MEXER,
  FRASE_CONSERTO_BENCHMARK,
  MAX_ITENS_NOMEADOS,
  fraseEMais,
} from './AvisoCustoQuebrado.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { fecharEvento, reabrirEvento } from '../lib/fechamentoEvento.js'
import { montarBenchmarkDeEvento } from '../lib/fechamento.js'
import {
  motivoNaoPromover,
  motivoBenchmarkQuebrado,
  benchmarkQuebrado,
} from '../lib/dadoQuebrado.js'
import { FIXED_BENCHMARKS, montarBenchmarkDePlanilha } from '../lib/benchmarks.js'

afterEach(cleanup)

const ABSURDO = 1e308
const noop = () => {}
const cat = (id, nome, itens) => ({ id, nome, padrao: false, itens })

const mapa = new Map()
globalThis.localStorage = {
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
  clear: () => mapa.clear(),
}

function festa(nome, categorias) {
  const e = novoEvento(nome)
  e.publicoEstimado = 200
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.contingenciaPct = 10
  e.categorias = categorias
  e.receitaRealizada = { bilheteria: 20000, bar: '' }
  return e
}

const CAT_SA = () => [
  cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 3000 })]),
  cat('estrutura', 'Estrutura', [novoItem({ servico: 'Som e luz', estimado: 400000 })]),
]
const CAT_QUEBRADA = () => [
  cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 3000 })]),
  cat('estrutura', 'Estrutura', [novoItem({ servico: 'Som e luz', estimado: ABSURDO })]),
]

const NIVEL_RELATORIO = 'previsao-eventos:relatorio-nivel:v1'
const EM = '2026-07-26T12:00:00.000Z'
// O EventEditor lembra a última aba no localStorage; "Promover a benchmark"
// mora na aba Fechamento, então o teste abre o editor lá — como o Marco faz.
const abrirNoFechamento = () =>
  globalThis.localStorage.setItem('previsao-eventos:aba-editor:v1', 'fechamento')
const txt = (c) => c.textContent.replace(/\s+/g, ' ')
const n = (s) => s.replace(/\s+/g, ' ')
const store = (e, bms = []) => ({
  eventos: [e],
  benchmarksCustom: bms,
  benchmarkOverrides: {},
  benchmarksOcultos: [],
  benchmarksPadrao: {},
  benchmarksApagados: [],
  ajustes: {},
})

// ===========================================================================
// 1. A PORTA — promover festa quebrada não grava mais a corrupção
// ===========================================================================
describe('a promoção a benchmark recusa a festa com dado quebrado', () => {
  it('CONTRAPROVA do defeito: sem a porta, o benchmark nasce com Infinity dentro', () => {
    // Esta é a medição que abriu o caso, e ela é sobre `montarBenchmarkDeEvento`,
    // que NÃO foi tocado (arquivo do portão do golden). O conserto é a porta
    // ANTES dela — se um dia alguém tirar a porta, este teste continua verde e
    // os de baixo é que morrem. Ele existe para provar que o defeito é real.
    const fechado = fecharEvento(festa('Brisa quebrada', CAT_QUEBRADA()), EM)
    const bm = montarBenchmarkDeEvento(fechado)
    expect(bm.custoTotal).toBe(Infinity)
    expect(bm.custos.estrutura).toBe(ABSURDO)
    expect(bm.lucro).toBe(-Infinity)
  })

  it('a porta recusa, e a recusa NOMEIA o custo e diz por que', () => {
    const fechado = fecharEvento(festa('Brisa quebrada', CAT_QUEBRADA()), EM)
    const motivo = motivoNaoPromover(fechado)
    expect(motivo).toBeTruthy()
    expect(motivo).toContain('Brisa quebrada')
    expect(motivo).toContain('“Som e luz” (Estrutura)')
    // Curta (05/10/2026): duas frases, o que houve e o que fazer. A de
    // 26/07 tinha 653 caracteres e, num toast, virava um bloco sem quebras.
    expect(motivo.split(/[.](?:\s|$)/).filter(Boolean).length).toBeLessThanOrEqual(2)
    expect(motivo.length).toBeLessThanOrEqual(260)
    expect(motivo).not.toContain('\n')
    // e o PREÇO do caminho (2ª revisão do PR #98): reabrir descarta a foto
    expect(motivo).toContain('reabrir descarta a fotografia atual')
    // e diz a verdade sobre o preço de corrigir: os campos estão travados
    expect(motivo).toContain('reabrir')
  })

  it('a festa SÃ continua promovendo — a porta não fecha na cara de quem está bem', () => {
    const fechado = fecharEvento(festa('Marfim de outubro', CAT_SA()), EM)
    expect(motivoNaoPromover(fechado)).toBe(null)
    expect(montarBenchmarkDeEvento(fechado).custoTotal).toBe(403000)
  })

  it('no APP, o clique em "Promover a benchmark" não escreve nada no store, e a recusa aparece NA TELA', () => {
    // O caminho inteiro, como o Marco o percorre: aba Fechamento › Promover.
    //
    // A recusa saía por `window.alert` (26/07/2026). Marco, 05/10/2026, por
    // questionário: sai NA TELA. Este teste monta o ToastHost como o App monta
    // e lê o texto do documento — volta o alert e ele fica vermelho, porque a
    // janela não escreve nada no DOM e o espião abaixo a acusa.
    abrirNoFechamento()
    const fechado = fecharEvento(festa('Brisa quebrada', CAT_QUEBRADA()), EM)
    const alertou = vi.spyOn(window, 'alert').mockImplementation(noop)
    const confirmou = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const setStore = vi.fn()
    const { container } = render(
      <>
        <EventEditor
          evento={fechado}
          store={store(fechado)}
          setStore={setStore}
          aparencia={{}}
          update={noop}
          onBack={noop}
          onApresentar={noop}
          onRelatorio={noop}
          onModoRascunho={noop}
          onFecharEvento={noop}
          onReabrirEvento={noop}
        />
        <ToastHost />
      </>
    )
    const botao = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Promover a benchmark'
    )
    expect(botao).toBeTruthy()
    act(() => botao.click())

    // nada foi gravado, e nem chegou a perguntar "quer criar?"
    expect(setStore).not.toHaveBeenCalled()
    expect(confirmou).not.toHaveBeenCalled()
    // nenhuma janela de alerta — a recusa é texto em português na página
    expect(alertou).not.toHaveBeenCalled()
    const tela = txt(document.body)
    expect(tela).toContain('Não dá para promover “Brisa quebrada” a benchmark')
    expect(tela).toContain('“Som e luz” (Estrutura)')
    expect(tela).toContain('reabra na aba Fechamento')
    expect(tela).toContain('reabrir descarta a fotografia atual')
    vi.restoreAllMocks()
  })

  it('e o clique na festa SÃ continua gravando o benchmark', () => {
    // Contraprova do teste acima: ele passaria verde num botão que nunca
    // funciona. Aqui o mesmo caminho, com a festa boa, tem de gravar.
    abrirNoFechamento()
    const fechado = fecharEvento(festa('Marfim de outubro', CAT_SA()), EM)
    vi.spyOn(window, 'alert').mockImplementation(noop)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const setStore = vi.fn()
    const { container } = render(
      <EventEditor
        evento={fechado}
        store={store(fechado)}
        setStore={setStore}
        aparencia={{}}
        update={noop}
        onBack={noop}
        onApresentar={noop}
        onRelatorio={noop}
        onModoRascunho={noop}
        onFecharEvento={noop}
        onReabrirEvento={noop}
      />
    )
    Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent.trim() === 'Promover a benchmark')
      .click()
    expect(setStore).toHaveBeenCalledTimes(1)
    // e o que ele grava é dinheiro de verdade
    const novo = setStore.mock.calls[0][0](store(fechado))
    const bm = novo.benchmarksCustom.at(-1)
    expect(Number.isFinite(bm.custoTotal)).toBe(true)
    expect(bm.custoTotal).toBe(403000)
    vi.restoreAllMocks()
  })
})

// ===========================================================================
// 1b. A PORTA OLHA O BENCHMARK MONTADO, NÃO SÓ OS CUSTOS
// ===========================================================================
// Revisão adversarial do PR #98, 05/10/2026: a porta acima só perguntava pelos
// custos. Com a bilheteria realizada ou o Pix líquido (#95) em 1e308 — a
// migração aceita os dois —, `motivoNaoPromover` devolvia null e o benchmark
// era gravado com receita e lucro que não são dinheiro. A segunda pergunta é
// feita sobre o objeto que ia ser gravado.
describe('a promoção recusa também o benchmark que sairia quebrado pela receita', () => {
  const fechadaCom = (receitaRealizada) => {
    const e = festa('Marfim com receita quebrada', CAT_SA())
    e.receitaRealizada = { bilheteria: 20000, bar: '' }
    const fechado = fecharEvento(e, EM)
    // Fotografia sã já salva: origem atual alterada não deve virar benchmark.
    return { ...fechado, receitaRealizada }
  }
  const CASOS = {
    'bilheteria realizada em 1e308': { bilheteria: ABSURDO, bar: '' },
    'Pix líquido em 1e308': { bilheteria: 20000, bar: '', pix: ABSURDO },
  }

  for (const [caso, rr] of Object.entries(CASOS)) {
    it(`${caso}: os custos passam, o benchmark montado não`, () => {
      const fechado = fechadaCom(rr)
      expect(fechado).toBeTruthy()
      expect(motivoNaoPromover(fechado)).toBe(null)
      const bm = montarBenchmarkDeEvento(fechado)
      expect(benchmarkQuebrado(bm).ha).toBe(true)
      const motivo = motivoBenchmarkQuebrado(fechado, bm)
      expect(motivo).toContain('Não dá para promover')
      // duas frases curtas, como a primeira recusa (05/10/2026)
      expect(motivo.split(/[.](?:\s|$)/).filter(Boolean).length).toBeLessThanOrEqual(2)
      expect(motivo.length).toBeLessThanOrEqual(260)
      expect(motivo).toContain('reabrir descarta a fotografia atual')
    })

    it(`${caso}: no APP, o clique não grava e a recusa aparece NA TELA`, () => {
      abrirNoFechamento()
      const fechado = fechadaCom(rr)
      const alertou = vi.spyOn(window, 'alert').mockImplementation(noop)
      const confirmou = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const setStore = vi.fn()
      const { container } = render(
        <>
          <EventEditor
            evento={fechado}
            store={store(fechado)}
            setStore={setStore}
            aparencia={{}}
            update={noop}
            onBack={noop}
            onApresentar={noop}
            onRelatorio={noop}
            onModoRascunho={noop}
            onFecharEvento={noop}
            onReabrirEvento={noop}
          />
          <ToastHost />
        </>
      )
      act(() =>
        Array.from(container.querySelectorAll('button'))
          .find((b) => b.textContent.trim() === 'Promover a benchmark')
          .click()
      )
      expect(setStore).not.toHaveBeenCalled()
      expect(confirmou).not.toHaveBeenCalled()
      expect(alertou).not.toHaveBeenCalled()
      expect(txt(document.body)).toContain('Não dá para promover “Marfim com receita quebrada” a benchmark')
      vi.restoreAllMocks()
    })
  }

  it('CONTRAPROVA: o benchmark da festa sã passa pela segunda pergunta', () => {
    const fechado = fecharEvento(festa('Marfim de outubro', CAT_SA()), EM)
    expect(motivoBenchmarkQuebrado(fechado, montarBenchmarkDeEvento(fechado))).toBe(null)
  })
})

// ===========================================================================
// 2. A RÉGUA JÁ SALVA — a comparação para de mentir sobre ela
// ===========================================================================
// O benchmark exatamente como ele fica DEPOIS de uma volta pelo localStorage:
// JSON.stringify vira não-finito em null, então `custoTotal` some, mas
// `custos.estrutura` (finito, 1e+308) sobrevive inteiro.
const BM_QUEBRADO_APOS_RELOAD = JSON.parse(
  JSON.stringify({
    id: 'bm-quebrado',
    nome: 'Brisa quebrada',
    custom: true,
    semReserva: true,
    publico: 200,
    custos: {
      aeb: 3000,
      locacao: null,
      estrutura: ABSURDO,
      equipe: null,
      artistico: null,
      marketing: null,
      extras: null,
    },
    custoTotal: Infinity,
    receita: 19000,
    ticketMedio: 100,
    lucro: -Infinity,
  })
)

const FESTA_SA_COMPARANDO = () => {
  const e = festa('Marfim de outubro', [
    cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 6000 })]),
    cat('estrutura', 'Estrutura', [novoItem({ servico: 'Palco', estimado: 20000 })]),
  ])
  e.benchmarksAtivos = ['bm-quebrado']
  return e
}

const TELAS_DE_COMPARACAO = {
  // O relatório também desenha as barras dos benchmarks, e é o papel que sai
  // por PDF ao contador — a faixa tem de estar lá também (nível Completo, que é
  // onde a seção "Comparação com eventos passados" existe).
  relatório: (e, bms) => {
    // O nível do relatório é lembrado no localStorage; a seção de comparação só
    // existe no "Completo", que é o que vai por PDF ao contador.
    globalThis.localStorage.setItem(NIVEL_RELATORIO, 'completo')
    return <ReportView evento={e} store={store(e, bms)} onBack={noop} />
  },
  'aba Cenários': (e, bms) => (
    <ScenariosTab
      evento={e}
      update={noop}
      store={store(e, bms)}
      setStore={noop}
      updateCenarios={noop}
      simulando={false}
      onSimular={noop}
    />
  ),
  'aba Custos': (e, bms) => (
    <CostsTab evento={e} update={noop} store={store(e, bms)} setStore={noop} />
  ),
}

describe('a régua quebrada é NOMEADA nas duas telas de comparação', () => {
  for (const [tela, montar] of Object.entries(TELAS_DE_COMPARACAO)) {
    it(`${tela}: a faixa nomeia a referência e o campo`, () => {
      const { container } = render(
        montar(FESTA_SA_COMPARANDO(), [BM_QUEBRADO_APOS_RELOAD])
      )
      const t = txt(container)
      expect(`${tela}: ${t.includes(TITULO_BENCHMARK_QUEBRADO) ? 'avisou' : 'SEM AVISO'}`).toBe(
        `${tela}: avisou`
      )
      expect(t).toContain('A referência “Brisa quebrada”')
      expect(t).toContain('Estrutura & Ceno')
      // e manda para a tela que EXISTE (o botão "Editar" da tela inicial), não
      // para Ajustes › Benchmarks, que só lista os ocultos e apagados
      expect(t).toContain(n(FRASE_CONSERTO_BENCHMARK))
    })

    it(`${tela}: a festa SÃ não ganha a faixa DELA por causa da régua`, () => {
      // O contágio é sobre a régua; a festa não tem defeito e não pode ser
      // acusada de ter.
      const { container } = render(
        montar(FESTA_SA_COMPARANDO(), [BM_QUEBRADO_APOS_RELOAD])
      )
      expect(txt(container)).not.toContain(TITULO_CUSTO_QUEBRADO)
    })
  }

  it('FALSO POSITIVO: os 4 benchmarks embutidos nunca são acusados', () => {
    for (const b of FIXED_BENCHMARKS) {
      const r = benchmarkQuebrado(b)
      expect(`${b.nome}: ${r.ha ? 'ACUSADO ERRADO' : 'limpo'}`).toBe(`${b.nome}: limpo`)
    }
  })

  it('FALSO POSITIVO: promovido de festa sã e importado de planilha, limpos', () => {
    const promovido = montarBenchmarkDeEvento(
      fecharEvento(festa('Marfim de outubro', CAT_SA()), EM)
    )
    expect(benchmarkQuebrado(promovido).ha).toBe(false)
    const dePlanilha = montarBenchmarkDePlanilha({
      nome: 'O Galeao 12/07',
      publico: 1500,
      custos: { aeb: 58420.55, locacao: 43150, estrutura: 108760, equipe: 71280, artistico: 21940, marketing: null, extras: 29870 },
      custoTotal: 333420.55,
      receita: 336150,
      pagos: 1420,
    })
    expect(benchmarkQuebrado(dePlanilha).ha).toBe(false)
  })

  it('FALSO POSITIVO: comparação sem régua quebrada não mostra faixa nenhuma', () => {
    const e = FESTA_SA_COMPARANDO()
    e.benchmarksAtivos = null
    for (const [tela, montar] of Object.entries(TELAS_DE_COMPARACAO)) {
      cleanup()
      const { container } = render(montar(e, []))
      const achou = txt(container).includes(TITULO_BENCHMARK_QUEBRADO)
      expect(`${tela}: ${achou ? 'AVISOU ERRADO' : 'limpo'}`).toBe(`${tela}: limpo`)
    }
  })

  it('categoria ausente (null) NÃO é dado quebrado — os embutidos usam null de propósito', () => {
    const r = benchmarkQuebrado({
      nome: 'Brisa 05/12',
      custos: { aeb: 35210, estrutura: null },
      custoTotal: 157891,
      receita: null,
      lucro: null,
      ticketMedio: null,
    })
    expect(r.ha).toBe(false)
  })
})

// ===========================================================================
// 3. A FAIXA SÓ AFIRMA O QUE ELA VERIFICOU NAQUELA TELA
// ===========================================================================
describe('festa FECHADA com fotografia SÃ, corrompida depois', () => {
  const montar = () => {
    const fechado = fecharEvento(festa('Brisa de setembro', CAT_SA()), EM)
    // O caminho real: um backup JSON estragado entra por cima. A fotografia
    // continua a de antes; o cadastro de custos é que apodrece.
    return { ...fechado, categorias: CAT_QUEBRADA() }
  }
  const tela = (e) => (
    <FechamentoTab
      evento={e}
      update={noop}
      store={store(e)}
      onPromoverBenchmark={noop}
      onFecharEvento={noop}
      onReabrirEvento={noop}
    />
  )

  it('a tela imprime os números CERTOS da fotografia — é isto que a faixa tem de respeitar', () => {
    const { container } = render(tela(montar()))
    const t = txt(container)
    expect(t).toContain('Resultado parcial− R$ 384.000')
    expect(t).toContain('R$ 403.000')
  })

  it('a faixa aparece, mas NÃO diz que a tela escreve R$ 0', () => {
    const { container } = render(tela(montar()))
    const t = txt(container)
    expect(t).toContain(TITULO_CUSTO_QUEBRADO)
    expect(t).toContain(n(CONSEQ_FOTO_INTACTA))
    expect(t).not.toContain(n(CONSEQ_ZERA))
  })

  it('e NÃO manda restaurar cópia de segurança — o conselho que destruiria a foto', () => {
    const { container } = render(tela(montar()))
    const t = txt(container)
    expect(t).toContain(n(CONSERTO_NAO_MEXER))
    expect(t).not.toContain(n(CONSERTO_CORRIGIR))
    // a frase que sobrou tem de estar do lado certo: ela DESACONSELHA
    expect(t).toContain('Não restaure cópia de segurança nem reabra')
  })

  it('o conselho é verdade: reabrir DESCARTA a fotografia', () => {
    // A faixa afirma "reabrir descarta a fotografia do fechamento". Isto é a
    // prova dessa afirmação — se um dia reabrir passar a preservar a foto, a
    // frase vira mentira e este teste avisa.
    const fechado = fecharEvento(festa('Brisa de setembro', CAT_SA()), EM)
    expect(fechado.fechamento.foto.resultado.custos).toBe(403000)
    expect(reabrirEvento(fechado).fechamento).toBe(null)
  })

  it('ORDEM OPOSTA (corromper e SÓ ENTÃO fechar): o card diz que não dá para calcular, e a faixa diz isso', () => {
    // Aqui a fotografia nasceu quebrada — o JSON do fechamento vira Infinity em
    // null. Até 05/10/2026 o card imprimia "Resultado parcial R$ 0"; desde a
    // 2ª revisão do PR #98 ele escreve "não dá para calcular" (decisão do
    // Marco de 26/07/2026), e a faixa descreve isso (CONSEQ_TEXTO).
    const fechado = fecharEvento(festa('Brisa de setembro', CAT_QUEBRADA()), EM)
    expect(fechado.fechamento.foto.resultado.custos).toBe(null)
    const { container } = render(tela(fechado))
    const t = txt(container)
    expect(t).toContain('Resultado parcialnão dá para calcular')
    expect(t).not.toContain('Resultado parcialR$ 0')
    expect(t).toContain(n(CONSEQ_TEXTO))
    expect(t).toContain(n(CONSERTO_CORRIGIR))
    expect(t).not.toContain(n(CONSEQ_FOTO_INTACTA))
  })
})

describe('a aba Análise — a tela que não zera, explode', () => {
  const festaComAgenda = (estimadoDoSom) => {
    const e = festa('Brisa de setembro', [
      cat('aeb', 'A&B', [
        novoItem({ servico: 'Bebidas', estimado: 3000, dataPagamento: '2026-09-01' }),
      ]),
      cat('estrutura', 'Estrutura', [
        novoItem({ servico: 'Som e luz', estimado: estimadoDoSom, dataPagamento: '2026-09-05' }),
      ]),
    ])
    e.data = '2026-09-10'
    e.curvaModo = 'datas'
    e.lotes = [
      novoLote({ nome: 'Lote único', valor: 100, quantidade: 200, viradaPrevista: '2026-09-01' }),
    ]
    return e
  }

  it('a faixa aparece — ela não aparecia', () => {
    const e = festaComAgenda(ABSURDO)
    const { container } = render(<AnaliseTab evento={e} update={noop} />)
    const t = txt(container)
    expect(t).toContain(TITULO_CUSTO_QUEBRADO)
    expect(t).toContain('O custo “Som e luz” (categoria Estrutura)')
  })

  it('e a frase descreve ESTA tela: número gigante, não R$ 0', () => {
    const e = festaComAgenda(ABSURDO)
    const { container } = render(<AnaliseTab evento={e} update={noop} />)
    const t = txt(container)
    expect(t).toContain(n(CONSEQ_NUMERO_GIGANTE))
    expect(t).not.toContain(n(CONSEQ_ZERA))
  })

  it('CONTRAPROVA: a tela imprime mesmo o número de centenas de dígitos', () => {
    // Sem esta linha, o teste acima passaria numa tela que não mostra número
    // nenhum. Aqui está a prova de que a frase da faixa descreve a realidade.
    const e = festaComAgenda(ABSURDO)
    const { container } = render(<AnaliseTab evento={e} update={noop} />)
    const t = txt(container)
    const gigante = t.match(/R\$\s?[\d.]{100,}/)
    expect(`dígitos na tela: ${gigante ? 'sim' : 'NÃO ACHEI'}`).toBe('dígitos na tela: sim')
  })

  it('FALSO POSITIVO: a mesma festa com R$ 400.000 no Som e luz não ganha faixa', () => {
    const e = festaComAgenda(400000)
    const { container } = render(<AnaliseTab evento={e} update={noop} />)
    expect(txt(container)).not.toContain(TITULO_CUSTO_QUEBRADO)
  })
})

describe('valor ilegível que os TOTAIS não usam', () => {
  // Achado desta frente: item com "realizado" em texto. `valorConsiderado`
  // ignora o texto e usa o estimado, então a conta da festa NÃO quebra — e a
  // faixa dizia que a tela estava escrevendo R$ 0.
  const eventoTextoNoRealizado = () =>
    festa('Brisa de setembro', [
      cat('aeb', 'A&B', [
        novoItem({ servico: 'Som', estimado: 5000, realizado: 'a combinar' }),
      ]),
    ])

  it('a aba Custos imprime o total CERTO (R$ 5.000), e a faixa não diz R$ 0', () => {
    const e = eventoTextoNoRealizado()
    const { container } = render(
      <CostsTab evento={e} update={noop} store={store(e)} setStore={noop} />
    )
    const t = txt(container)
    expect(t).toContain('R$ 5.500') // 5.000 + 10% de contingência
    expect(t).toContain(TITULO_CUSTO_QUEBRADO)
    expect(t).toContain(n(CONSEQ_NAO_USADO))
    expect(t).not.toContain(n(CONSEQ_ZERA))
  })

  it('e o custo continua NOMEADO — não avisar seria o defeito oposto', () => {
    const e = eventoTextoNoRealizado()
    const { container } = render(
      <CostsTab evento={e} update={noop} store={store(e)} setStore={noop} />
    )
    expect(txt(container)).toContain('O custo “Som” (categoria A&B)')
  })
})

// ===========================================================================
// 4. O RELATÓRIO QUE ENCHIA DE LINHA
// ===========================================================================
describe('a faixa tem teto de linhas e resume o resto', () => {
  const festaCom = (quantos) =>
    festa(
      'Brisa de setembro',
      [
        cat(
          'estrutura',
          'Estrutura',
          Array.from({ length: quantos }, (_, i) =>
            novoItem({ servico: `Custo ${i + 1}`, estimado: ABSURDO })
          )
        ),
      ]
    )

  it('60 custos quebrados: 5 nomeados + 1 linha de resumo, no lugar de 60 linhas', () => {
    const e = festaCom(60)
    const { container } = render(<ReportView evento={e} store={store(e)} onBack={noop} />)
    const faixa = container.querySelector('[role="alert"]')
    expect(faixa.querySelectorAll('li').length).toBe(MAX_ITENS_NOMEADOS + 1)
    expect(n(faixa.textContent)).toContain(fraseEMais(55))
  })

  it('e o relatório encolhe de 5.776 para menos de 1.000 caracteres de aviso', () => {
    // MEDIDO antes: 60 linhas / 5.776 caracteres ANTES do conteúdo, no papel
    // que sai por PDF ao contador.
    const e = festaCom(60)
    const { container } = render(<ReportView evento={e} store={store(e)} onBack={noop} />)
    const chars = n(container.querySelector('[role="alert"]').textContent).length
    expect(`${chars} caracteres`).toBe(`${chars} caracteres`)
    expect(chars).toBeLessThan(1000)
  })

  it('a contagem continua EXATA — o teto esconde nome, nunca custo', () => {
    for (const total of [1, 5, 6, 7, 60]) {
      cleanup()
      const e = festaCom(total)
      const { container } = render(
        <CostsTab evento={e} update={noop} store={store(e)} setStore={noop} />
      )
      const t = n(container.querySelector('[role="alert"]').textContent)
      const sobra = total - Math.min(total, MAX_ITENS_NOMEADOS)
      if (sobra === 0) {
        expect(`${total} custos: ${t.includes('E mais') ? 'RESUMIU SEM PRECISAR' : 'sem resumo'}`).toBe(
          `${total} custos: sem resumo`
        )
      } else {
        expect(t).toContain(fraseEMais(sobra))
      }
    }
  })

  it('até 5 custos, todos continuam nomeados um a um', () => {
    const e = festaCom(5)
    const { container } = render(
      <CostsTab evento={e} update={noop} store={store(e)} setStore={noop} />
    )
    const t = n(container.querySelector('[role="alert"]').textContent)
    for (let i = 1; i <= 5; i++) expect(t).toContain(`O custo “Custo ${i}”`)
  })
})

// ===========================================================================
// 5. NENHUMA TELA FICA COM FRASE ÓRFÃ
// ===========================================================================
describe('toda tela que mostra a faixa mostra uma consequência DECLARADA', () => {
  // CONSEQ_LUCRO entrou em 05/10/2026: Cenários, Relatório e Apresentação
  // deixaram de imprimir lucro (que saía igual à receita) e passaram a dizer
  // "não dá para calcular" — a frase da faixa descreve isso.
  const DECLARADAS = [
    CONSEQ_ZERA,
    CONSEQ_LUCRO,
    CONSEQ_TEXTO,
    CONSEQ_NUMERO_GIGANTE,
    CONSEQ_NAO_USADO,
    CONSEQ_FOTO_INTACTA,
  ]
  const e = () => festa('Brisa de setembro', CAT_QUEBRADA())
  const TODAS = {
    'aba Custos': (x) => <CostsTab evento={x} update={noop} store={store(x)} setStore={noop} />,
    'aba Cenários': (x) => (
      <ScenariosTab
        evento={x}
        update={noop}
        store={store(x)}
        setStore={noop}
        updateCenarios={noop}
        simulando={false}
        onSimular={noop}
      />
    ),
    'aba Análise': (x) => <AnaliseTab evento={x} update={noop} />,
    'aba Fechamento': (x) => (
      <FechamentoTab
        evento={x}
        update={noop}
        store={store(x)}
        onPromoverBenchmark={noop}
        onFecharEvento={noop}
        onReabrirEvento={noop}
      />
    ),
    relatório: (x) => <ReportView evento={x} store={store(x)} onBack={noop} />,
  }

  for (const [tela, montar] of Object.entries(TODAS)) {
    it(`${tela}: a frase de consequência é uma das declaradas`, () => {
      const { container } = render(montar(e()))
      const t = txt(container)
      const quais = DECLARADAS.filter((f) => t.includes(n(f)))
      expect(`${tela}: ${quais.length} frase(s)`).toBe(`${tela}: 1 frase(s)`)
    })
  }
})

// ===========================================================================
// 6. VARREDURA DE FALSO POSITIVO — o risco central desta frente
// ===========================================================================
// Uma faixa que aparece numa referência BOA ensina o Marco a ignorar faixa, e
// aí ela não serve para a referência ruim. A régua é a do double (o valor deixa
// de ser número ao virar centavos), nunca um teto de negócio — teto de negócio
// erra em festa legítima grande.
describe('20.000 referências de dinheiro de verdade: nenhuma acusada', () => {
  // Semente fixa: a varredura é a mesma a cada `npm test`, e uma reprovação é
  // reproduzível.
  const semente = (s) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  it('valores até R$ 900 mil, com centavos, nulos e créditos negativos', () => {
    const r = semente(20260726)
    const acusadas = []
    for (let i = 0; i < 20000; i++) {
      const dinheiro = () => {
        const d = r()
        if (d < 0.18) return null // categoria sem valor — o padrão dos embutidos
        if (d < 0.22) return 0
        if (d < 0.26) return -Math.round(r() * 500000) / 100 // crédito de fornecedor
        return Math.round(r() * 90000000) / 100
      }
      const custos = Object.fromEntries(
        ['aeb', 'locacao', 'estrutura', 'equipe', 'artistico', 'marketing', 'extras'].map((k) => [
          k,
          dinheiro(),
        ])
      )
      const bm = {
        nome: `Festa ${i}`,
        custos,
        custoTotal: dinheiro(),
        receita: dinheiro(),
        lucro: dinheiro(),
        ticketMedio: r() < 0.3 ? null : Math.round(r() * 40000) / 100,
        publico: Math.round(r() * 3000),
      }
      if (benchmarkQuebrado(bm).ha) acusadas.push(bm)
    }
    expect(`acusadas: ${acusadas.length}`).toBe('acusadas: 0')
  })

  it('CONTRAPROVA: a mesma varredura com 1e308 injetado acusa TODAS', () => {
    // Sem esta linha, o teste acima passaria numa função que nunca acusa nada.
    const r = semente(20260726)
    let acusadas = 0
    for (let i = 0; i < 200; i++) {
      const bm = {
        nome: `Festa ${i}`,
        custos: { aeb: Math.round(r() * 90000000) / 100, estrutura: ABSURDO },
        custoTotal: null,
      }
      if (benchmarkQuebrado(bm).ha) acusadas++
    }
    expect(acusadas).toBe(200)
  })

  it('e a festa mais cara que a casa já teve (Marfim 09/05, R$ 360 mil) passa limpa', () => {
    const marfim = FIXED_BENCHMARKS.find((b) => b.id === 'bm-marfim-0905')
    expect(marfim.custoTotal).toBe(333419)
    expect(benchmarkQuebrado(marfim).ha).toBe(false)
  })
})
