// @vitest-environment jsdom
//
// EVIDÊNCIA — dois benchmarks na mesma lista, tickets medidos por réguas
// diferentes, e a tela não dizia qual era qual.
//
// O caso, medido (BACKLOG.md, entrada "Recalcular o ticket dos benchmarks JÁ
// promovidos está BLOQUEADO por falta de dado"; decisão 6 do
// DECISOES-MARCO-H4.md, Marco, 25/07/2026): até 24/07/2026 o benchmark
// promovido gravava `ticketMedio = receita ÷ público` — receita inteira, com
// bar e patrocínio divididos por cabeça. Desde 24/07/2026 grava
// `bilheteria bruta ÷ público`, que é o preço que a pessoa pagou no ingresso.
//
// Os dois convivem no store do Marco e aparecem um debaixo do outro nesta
// lista. Sem nada escrito, "a festa B tem ticket menor que a A" é uma
// conclusão que a tela induz e os números não sustentam: as duas festas deste
// arquivo têm EXATAMENTE a mesma bilheteria, o mesmo bar, o mesmo patrocínio e
// o mesmo público — só a régua do ticket difere.
//
// O QUE ESTE ARQUIVO TRAVA: a lista de benchmarks nomeia, por benchmark, a
// conta que produziu aquele ticket, e avisa quando há mais de uma régua na
// mesma tela.
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BenchmarksEditor from './BenchmarksEditor.jsx'

afterEach(cleanup)

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
  globalThis.localStorage = localStorageDeMentira()
})

// ---------------------------------------------------------------- fixtures
// UMA festa sintética, medida duas vezes. Nada aqui é dado real de festa.
const PUBLICO = 500
const BILHETERIA_BRUTA = 75000 // o que entrou de ingresso, antes da taxa
const BILHETERIA_LIQUIDA = 70000 // depois da taxa da bilheteria
const BAR = 20000
const PATROCINIO = 10000
const RECEITA = BILHETERIA_LIQUIDA + BAR + PATROCINIO // 100.000

const custosDeTeste = {
  aeb: 10000,
  locacao: 5000,
  estrutura: 20000,
  equipe: 15000,
  artistico: 8000,
  marketing: null,
  extras: null,
}

// Promovido ANTES de 24/07/2026 — régua antiga (receita ÷ público).
const REGUA_ANTIGA = {
  id: 'bm-alameda-regua-antiga',
  nome: 'Alameda Norte (promovida em 20/07)',
  custom: true,
  semReserva: true,
  publico: PUBLICO,
  custos: custosDeTeste,
  custoTotal: 58000,
  receita: RECEITA,
  ticketMedio: RECEITA / PUBLICO, // 200
  lucro: RECEITA - 58000,
  obs: 'Promovido do fechamento de "Alameda Norte" (20/07/2026).',
}

// Promovido DEPOIS de 24/07/2026 — régua nova (bilheteria bruta ÷ público),
// com o campo aditivo `bilheteriaBruta` gravado junto.
const REGUA_NOVA = {
  id: 'bm-alameda-regua-nova',
  nome: 'Alameda Sul (promovida em 25/07)',
  custom: true,
  semReserva: true,
  publico: PUBLICO,
  custos: custosDeTeste,
  custoTotal: 58000,
  receita: RECEITA,
  bilheteriaBruta: BILHETERIA_BRUTA,
  ticketMedio: BILHETERIA_BRUTA / PUBLICO, // 150
  lucro: RECEITA - 58000,
  obs: 'Promovido do fechamento de "Alameda Sul" (25/07/2026).',
}

const storeCom = (...benchmarks) => ({
  eventos: [],
  benchmarksCustom: benchmarks,
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  // Os 4 embutidos ficam fora deste arquivo de propósito: o achado é sobre os
  // PROMOVIDOS, e a lista curta deixa a asserção sobre a tela sem ruído.
  benchmarksApagados: ['bm-cordel', 'bm-brisa-1205', 'bm-marfim-0905', 'bm-brisa-1403'],
  benchmarksOcultos: [],
  ajustes: {},
})

const abrirLista = (store) =>
  render(<BenchmarksEditor store={store} setStore={() => {}} onClose={() => {}} />)

// ===========================================================================
// 1. O ACHADO, EM NÚMEROS — a mesma festa, dois tickets
// ===========================================================================
describe('o achado — mesma bilheteria, mesmo público, tickets diferentes', () => {
  it('as duas festas são idênticas em dinheiro e público; só a régua do ticket difere', () => {
    expect(REGUA_NOVA.receita).toBe(REGUA_ANTIGA.receita)
    expect(REGUA_NOVA.publico).toBe(REGUA_ANTIGA.publico)
    expect(REGUA_NOVA.custoTotal).toBe(REGUA_ANTIGA.custoTotal)
    expect(REGUA_NOVA.lucro).toBe(REGUA_ANTIGA.lucro)
  })

  it('e mesmo assim os tickets diferem em R$ 50,00 por cabeça — 25% de diferença', () => {
    expect(REGUA_ANTIGA.ticketMedio).toBe(200)
    expect(REGUA_NOVA.ticketMedio).toBe(150)
    // A diferença é exatamente bar + patrocínio por cabeça, mais a taxa da
    // bilheteria: o que a régua antiga somava ao preço do ingresso.
    expect(REGUA_ANTIGA.ticketMedio - REGUA_NOVA.ticketMedio).toBe(50)
  })
})

// ===========================================================================
// 2. O QUE A TELA TEM DE DIZER
// ===========================================================================
describe('a lista de benchmarks nomeia a régua de cada ticket', () => {
  it('o benchmark da régua antiga diz que o ticket é receita ÷ público', () => {
    abrirLista(storeCom(REGUA_ANTIGA))
    expect(screen.getByText(/ticket = receita ÷ público/i)).toBeTruthy()
  })

  it('o benchmark da régua nova diz que o ticket é bilheteria ÷ público', () => {
    abrirLista(storeCom(REGUA_NOVA))
    expect(screen.getByText(/ticket = bilheteria ÷ público/i)).toBeTruthy()
  })

  it('com os dois na mesma tela, as DUAS etiquetas aparecem — nenhuma engole a outra', () => {
    abrirLista(storeCom(REGUA_ANTIGA, REGUA_NOVA))
    expect(screen.getByText(/ticket = receita ÷ público/i)).toBeTruthy()
    expect(screen.getByText(/ticket = bilheteria ÷ público/i)).toBeTruthy()
  })

  it('com réguas MISTURADAS na mesma tela, a lista avisa que os tickets não se comparam', () => {
    abrirLista(storeCom(REGUA_ANTIGA, REGUA_NOVA))
    expect(screen.getByText(/não foram medidos todos da mesma maneira/i)).toBeTruthy()
  })

  it('com uma régua só, o aviso de mistura NÃO aparece — nada de alarme falso', () => {
    abrirLista(storeCom(REGUA_NOVA))
    expect(screen.queryByText(/não foram medidos todos da mesma maneira/i)).toBeNull()
  })
})
