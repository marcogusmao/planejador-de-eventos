// @vitest-environment jsdom
//
// AS QUATRO TELAS QUE FALAM DE RITMO DE VENDA, RENDERIZADAS DE VERDADE.
//
// O que este arquivo trava (Marco, 27/07/2026): quando o cenário realista não
// sai do prejuízo nem vendendo todos os ingressos, o break-even é `null` — e
// `null` chegando cru numa tela de ritmo faz a LINHA INTEIRA sumir. Sumir é a
// pior resposta possível: uma tela sem linha se lê como "não há nada de
// especial aqui", e o que havia era prejuízo garantido (princípio 4 do
// CLAUDE.md — nada falha em silêncio).
//
// POR QUE RENDERIZANDO, e não chamando a função. Nesta mudança a suíte já
// ficou verde QUATRO vezes com a parte nova desligada: o texto existia no
// módulo, o módulo tinha teste, e as telas continuavam sem receber o aviso
// porque ninguém passava a chave `breakEvenNaoFecha` do cenário para o
// componente. Teste de módulo não vê fio solto; só a tela montada vê. Por isso
// cada asserção abaixo procura a frase no DOM de um componente REAL —
// desligue qualquer um dos fios e um destes testes fica vermelho.
//
// A FRASE É UMA SÓ, importada de breakEvenTexto.js. Se alguém reescrever o
// texto em uma das telas, o teste daquela tela cai — que é exatamente o que se
// quer de uma fonte única.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import ReportView from './ReportView.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import { RITMO_NAO_FECHA } from '../lib/breakEvenTexto.js'
import { MARCACAO_REALIZADA } from '../lib/resumo.js'
import { computeCenario } from '../lib/calc.js'
import { novoEvento, novoLote } from '../lib/defaults.js'
import { dataISOLocal } from '../lib/dataLocal.js'

afterEach(cleanup)

// localStorage de memória — mesmo padrão de Home.evidencia.test.jsx e
// ReportView.bilheteriaDoCenario.test.jsx. A curva de vendas lê o cache do
// Financeiro daqui, e a Home escreve na lixeira.
function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    get length() {
      return mapa.size
    },
    key: (i) => [...mapa.keys()][i] ?? null,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
})

// Datas ANCORADAS NO RELÓGIO DE VERDADE, porque três das quatro telas chamam
// hojeISO() por dentro (não dá para injetar "hoje" por parâmetro). Um dia
// cravado no calendário viraria "festa passada" sozinho com a passagem do
// tempo, e o teste começaria a falhar sem ninguém ter mexido em código.
const emDias = (n) => dataISOLocal(new Date(Date.now() + n * 86400000))

/**
 * A festa que NÃO FECHA — e ela não fecha por conta própria, não por um campo
 * que diga isso: um lote de 200 ingressos a R$ 50 (bilheteria máxima
 * R$ 10.000), bar de R$ 8.000 e um custo de A&B de R$ 17.300 com 5% de
 * contingência (R$ 18.165). Vendendo TUDO entram R$ 17.500 — faltam R$ 665.
 * A premissa é conferida no primeiro teste, para nenhuma asserção abaixo
 * passar por acidente sobre um evento que na verdade fecha.
 */
function festaQueNaoFecha({ dataEvento = emDias(40) } = {}) {
  const ev = novoEvento('Festa que não fecha')
  ev.data = dataEvento
  ev.barModo = 'fixo'
  ev.outrasReceitas = { bar: 8000, patrocinio: '' }
  ev.lotes = [novoLote({ nome: 'Lote único', valor: 50, quantidade: 200 })]
  ev.categorias = ev.categorias.map((c) =>
    c.id === 'aeb' ? { ...c, itens: [{ nome: 'Insumos', estimado: 17300 }] } : c
  )
  return ev
}

/**
 * A MESMA festa com um custo que cabe no caixa: fecha, e por isso as telas
 * voltam a falar de ritmo. É o contraste que prova que os testes acima não
 * passam com a tela vazia.
 *
 * O bar cai para R$ 2.000 de propósito: com os R$ 8.000 da outra festa o custo
 * já estaria coberto sem vender ingresso nenhum, o break-even seria ZERO e a
 * tela diria "break-even coberto" — um contraste fraco, que não exercita a
 * linha "faltam N ingressos". Com bar R$ 2.000 e custo R$ 6.300 há uma meta de
 * verdade a alcançar.
 */
function festaQueFecha({ dataEvento = emDias(40) } = {}) {
  const ev = festaQueNaoFecha({ dataEvento })
  ev.nome = 'Festa que fecha'
  ev.outrasReceitas = { bar: 2000, patrocinio: '' }
  ev.categorias = ev.categorias.map((c) =>
    c.id === 'aeb' ? { ...c, itens: [{ nome: 'Insumos', estimado: 6000 }] } : c
  )
  ev.vendidosAteHoje = 20
  return ev
}

const storeDe = (evento) => ({
  eventos: [evento],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  ajustes: {},
})

// ---------------------------------------------------------------- a premissa

describe('a premissa das quatro telas', () => {
  it('a festa de teste realmente não fecha — break-even null e o aviso ligado', () => {
    const c = computeCenario(festaQueNaoFecha(), 'realista')
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(true)
    expect(c.lucro).toBeLessThan(0)
  })

  it('a festa de contraste fecha — tem break-even de verdade', () => {
    const c = computeCenario(festaQueFecha(), 'realista')
    expect(c.breakEven).toBeGreaterThan(0)
    expect(c.breakEvenNaoFecha).toBe(false)
  })
})

// ------------------------------------------------------------ tela 1: a Home

describe('TELA 1 — card da Home', () => {
  const montar = (evento) =>
    render(
      <Home
        store={storeDe(evento)}
        setStore={vi.fn()}
        aparencia={{}}
        abrir={vi.fn()}
        abrirAjustes={vi.fn()}
      />
    )

  it('diz que não fecha, em vez de sumir com a linha do ritmo', () => {
    const { container } = montar(festaQueNaoFecha())
    expect(screen.getByText(RITMO_NAO_FECHA)).toBeTruthy()
    // e nunca promete um ritmo que não existe
    expect(container.textContent).not.toMatch(/p\/ break-even/)
  })

  it('CONTRASTE — na festa que fecha, o card volta a falar de ritmo (e não repete o aviso)', () => {
    const { container } = montar(festaQueFecha())
    expect(container.textContent).toMatch(/faltam .* break-even/i)
    expect(screen.queryByText(RITMO_NAO_FECHA)).toBeNull()
  })

  it('festa que JÁ ACONTECEU: a marcação de realizada vence — não se fala de ritmo futuro', () => {
    const { container } = montar(festaQueNaoFecha({ dataEvento: emDias(-3) }))
    expect(container.textContent).toContain(MARCACAO_REALIZADA)
    expect(screen.queryByText(RITMO_NAO_FECHA)).toBeNull()
  })
})

// ------------------------------------------------- tela 2: o relatório / PDF

describe('TELA 2 — relatório (o papel que vai para a reunião)', () => {
  const montar = (evento) =>
    render(<ReportView evento={evento} store={storeDe(evento)} onBack={() => {}} />)

  it('a linha "Ritmo de vendas" existe e diz que não fecha', () => {
    const { container } = montar(festaQueNaoFecha())
    expect(container.textContent).toContain('Ritmo de vendas:')
    expect(container.textContent).toContain(RITMO_NAO_FECHA)
  })

  it('CONTRASTE — na festa que fecha, a mesma linha traz o ritmo em ingressos', () => {
    const { container } = montar(festaQueFecha())
    expect(container.textContent).toContain('Ritmo de vendas:')
    expect(container.textContent).toMatch(/faltam .* break-even/i)
    expect(container.textContent).not.toContain(RITMO_NAO_FECHA)
  })
})

// ------------------------------- telas 3 e 4: as duas da aba Cenários

// O cache da curva que o componente lê do localStorage (mesma chave e mesma
// forma que a busca no Financeiro grava). Um evento vinculado, com pagamentos
// num dia bem antes da festa, é o que faz o painel de leitura aparecer.
const CACHE_KEY = 'previsao-eventos:curva-financeiro:v1'

function comCurvaNoCache(evento, { pagamentos = 40 } = {}) {
  const ev = { ...evento, financeiro: { ...(evento.financeiro || {}), eventoId: 'fin-1' } }
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      em: new Date().toISOString(),
      curva: {
        eventos: [
          {
            id: 'fin-1',
            nome: ev.nome,
            data: ev.data,
            dias: [{ dia: -50, pagamentos, valor: pagamentos * 50 }],
          },
        ],
        eventosSemData: [],
      },
    })
  )
  return ev
}

// A ABA CENÁRIOS INTEIRA, e não os dois componentes soltos. É aqui que estava
// o fio solto que este trabalho veio consertar: `ScenariosTab` já calculava
// `c.realista.breakEvenNaoFecha` e passava só o `breakEven` para os dois
// filhos. Montar `CurvaVendas` ou `RitmoVendasCard` à mão, já com a chave certa
// na prop, testaria o componente e deixaria o fio exatamente como estava —
// verde no terminal e quebrado na tela do Marco.
const abrirCenarios = (evento) =>
  render(
    <ScenariosTab
      evento={evento}
      update={vi.fn()}
      updateCenarios={vi.fn()}
      store={storeDe(evento)}
      setStore={vi.fn()}
    />
  )

describe('TELAS 3 e 4 — aba Cenários: card "Estamos vendendo no ritmo?" e curva de vendas', () => {
  it('as DUAS superfícies dizem que não fecha — a MESMA frase, duas vezes na página', () => {
    abrirCenarios(comCurvaNoCache(festaQueNaoFecha()))
    expect(screen.getAllByText(RITMO_NAO_FECHA)).toHaveLength(2)
  })

  it('o card diz mesmo com o campo "vendidos até hoje" VAZIO — não manda preencher o que não muda nada', () => {
    const ev = festaQueNaoFecha()
    expect(ev.vendidosAteHoje === '' || ev.vendidosAteHoje == null).toBe(true)
    // sem curva no cache, só o card fala (o painel da curva nem existe)
    const { container } = abrirCenarios(ev)
    expect(screen.getAllByText(RITMO_NAO_FECHA)).toHaveLength(1)
    expect(container.textContent).not.toContain('Preencha o campo')
  })

  it('com o campo preenchido, o card continua dizendo que não fecha', () => {
    abrirCenarios({ ...festaQueNaoFecha(), vendidosAteHoje: 120 })
    expect(screen.getAllByText(RITMO_NAO_FECHA)).toHaveLength(1)
  })

  it('CONTRASTE — festa que fecha: as duas voltam a falar de ritmo em ingressos', () => {
    const { container } = abrirCenarios(comCurvaNoCache(festaQueFecha()))
    expect(container.textContent).toMatch(/faltam .* break-even/i)
    expect(container.textContent).toMatch(/Pela curva,/)
    expect(screen.queryByText(RITMO_NAO_FECHA)).toBeNull()
  })

  it('festa que JÁ ACONTECEU: a marcação de realizada vence nas duas — não se fala de futuro', () => {
    const { container } = abrirCenarios(
      comCurvaNoCache(festaQueNaoFecha({ dataEvento: emDias(-3) }))
    )
    expect(container.textContent).toContain(MARCACAO_REALIZADA)
    expect(screen.queryByText(RITMO_NAO_FECHA)).toBeNull()
  })
})

// -------------------------------------------------------- a fonte é uma só

describe('a frase é UMA e vem de breakEvenTexto.js', () => {
  it('as quatro superfícies imprimem exatamente a mesma cadeia de caracteres', () => {
    const evento = comCurvaNoCache(festaQueNaoFecha())

    const home = render(
      <Home
        store={storeDe(evento)}
        setStore={vi.fn()}
        aparencia={{}}
        abrir={vi.fn()}
        abrirAjustes={vi.fn()}
      />
    ).container.textContent
    cleanup()
    const relatorio = render(
      <ReportView evento={evento} store={storeDe(evento)} onBack={() => {}} />
    ).container.textContent
    cleanup()
    // a aba Cenários carrega DUAS das quatro (card e curva)
    const cenarios = abrirCenarios(evento).container.textContent

    for (const texto of [home, relatorio, cenarios]) expect(texto).toContain(RITMO_NAO_FECHA)
    // duas ocorrências na aba Cenários, uma em cada superfície
    expect(cenarios.split(RITMO_NAO_FECHA).length - 1).toBe(2)
  })
})
