// Sessão H3-H — a constituição prometia "100% cobertos por Vitest" e util.js
// não tinha teste homônimo. Cobre as 5 funções — num/uid/clone/agora, e o
// armazenamentoUsavel somado em 24/07/2026 — com casos reais (borda,
// não-feliz e comportamento documentado no próprio código), não smoke test.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { agora, armazenamentoUsavel, clone, num, uid, emCentavos, somaEmCentavos, somaCentavos } from './util.js'

describe('num — coerção numérica segura (nunca deixa NaN escapar pro app)', () => {
  it('número e string numérica passam direto', () => {
    expect(num(123)).toBe(123)
    expect(num('123')).toBe(123)
    expect(num('3.5')).toBe(3.5)
  })

  it('lixo/ausente vira 0, nunca NaN', () => {
    expect(num('abc')).toBe(0)
    expect(num(undefined)).toBe(0)
    expect(num(null)).toBe(0)
    expect(num({})).toBe(0)
    expect(num('')).toBe(0)
    expect(Number.isNaN(num('abc'))).toBe(false)
  })

  it('Infinity/-Infinity (não-finito) vira 0', () => {
    expect(num(Infinity)).toBe(0)
    expect(num(-Infinity)).toBe(0)
  })

  it('normaliza -0 para 0 (o comentário do código: "-0" não pode aparecer em tela)', () => {
    expect(Object.is(num(-0), -0)).toBe(false)
    expect(Object.is(num(-0), 0)).toBe(true)
    expect(Object.is(num(-1 * 0), 0)).toBe(true)
  })

  it('NÃO é parser de formato brasileiro — vírgula decimal vira 0 (isso é papel do campoNumerico/parseMoney)', () => {
    expect(num('1,5')).toBe(0)
  })
})

describe('uid — identificador único de item/lote/categoria', () => {
  it('gera string não-vazia', () => {
    const id = uid()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('1000 gerações seguidas, zero colisão', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) ids.add(uid())
    expect(ids.size).toBe(1000)
  })

  it('usa crypto.randomUUID quando disponível (formato UUID padrão)', () => {
    const id = uid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('cai no fallback (Math.random + timestamp) quando crypto.randomUUID não existe, e continua único', () => {
    vi.stubGlobal('crypto', { randomUUID: undefined })
    const a = uid()
    const b = uid()
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
    // o fallback não produz o formato UUID com hífens nas posições certas
    expect(a).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    vi.unstubAllGlobals()
  })
})

describe('clone — cópia profunda (nunca compartilha referência com o original)', () => {
  it('objeto clonado é igual em valor mas é outra referência (inclusive aninhada)', () => {
    const original = { a: 1, b: { c: 2 } }
    const copia = clone(original)
    expect(copia).toEqual(original)
    expect(copia).not.toBe(original)
    expect(copia.b).not.toBe(original.b)
  })

  it('mutar a cópia NÃO muta o original — a razão de existir da função', () => {
    const original = { itens: [{ id: 1, nome: 'Som' }] }
    const copia = clone(original)
    copia.itens[0].nome = 'Luz'
    copia.itens.push({ id: 2, nome: 'Gelo' })
    expect(original.itens.length).toBe(1)
    expect(original.itens[0].nome).toBe('Som')
  })

  it('preserva arrays, primitivos e null aninhados', () => {
    const original = { lista: [1, 2, 3], texto: 'ok', valor: 12.5, ativo: true, vazio: null }
    const copia = clone(original)
    expect(copia).toEqual(original)
    expect(Array.isArray(copia.lista)).toBe(true)
  })
})

describe('agora — timestamp ISO 8601 do relógio do sistema', () => {
  afterEach(() => vi.useRealTimers())

  it('formato ISO 8601 com milissegundos e Z (UTC)', () => {
    expect(agora()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('acompanha o relógio (não é um valor congelado no import do módulo)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'))
    expect(agora()).toBe('2026-03-09T12:00:00.000Z')
    vi.setSystemTime(new Date('2026-12-31T23:59:00.000Z'))
    expect(agora()).toBe('2026-12-31T23:59:00.000Z')
  })

  it('é parseável de volta (round-trip Date → string → Date)', () => {
    const s = agora()
    expect(new Date(s).toISOString()).toBe(s)
  })
})

describe('armazenamentoUsavel — o localStorage deste ambiente serve para guardar?', () => {
  // Nasceu do achado S2 do BACKLOG (24/07/2026): `typeof localStorage ===
  // "undefined"` não bastava. O Node 22+ expõe um localStorage GLOBAL cujo
  // getItem não é função, então a guarda antiga escapava e o código estourava
  // no acesso — e o comportamento passou a depender da versão do Node, com o
  // CI (Node 20) vermelho e a suíte local (Node 25) verde.
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('localStorage completo (o do navegador) → usável', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
    expect(armazenamentoUsavel()).toBe(true)
  })

  it('sem localStorage nenhum → NÃO usável', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(armazenamentoUsavel()).toBe(false)
  })

  it('localStorage nulo → NÃO usável (null passa por typeof "object")', () => {
    vi.stubGlobal('localStorage', null)
    expect(armazenamentoUsavel()).toBe(false)
  })

  it('meio-inicializado: objeto vazio (o que o Node 22+ entrega) → NÃO usável', () => {
    vi.stubGlobal('localStorage', {})
    expect(armazenamentoUsavel()).toBe(false)
  })

  it('cada função que falta sozinha já torna inusável (as três são cobradas)', () => {
    const completo = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    for (const faltando of ['getItem', 'setItem', 'removeItem']) {
      const parcial = { ...completo }
      delete parcial[faltando]
      vi.stubGlobal('localStorage', parcial)
      expect(armazenamentoUsavel()).toBe(false)
    }
  })

  it('função trocada por valor que não é função → NÃO usável', () => {
    vi.stubGlobal('localStorage', { getItem: 'nao sou funcao', setItem: () => {}, removeItem: () => {} })
    expect(armazenamentoUsavel()).toBe(false)
  })
})

// DINHEIRO EM CENTAVOS (Marco, 07/10/2026 — régua do meio centavo, ver o
// cabeçalho de `arredondarCentavos` em util.js). Cada caso abaixo é uma das
// três coisas que a régua decide: o meio centavo, o meio centavo que o double
// guardou torto, e o que fica de fora (absurdo e não-número).
describe('arredondarCentavos / emCentavos / somaEmCentavos — a régua do centavo', () => {
  it('meio centavo vai para LONGE do zero, dos dois lados (a régua do formatador)', () => {
    expect(emCentavos(0.005)).toBe(0.01)
    expect(emCentavos(-0.005)).toBe(-0.01)
    expect(emCentavos(2700.135)).toBe(2700.14)
    expect(emCentavos(-5880.555)).toBe(-5880.56)
  })

  it('meio centavo que o double guardou um fio abaixo continua sendo meio centavo', () => {
    // 54.002,70 − 5.400,27 + 2.700,135 é 51.302,565 na conta de papel; o
    // double guarda 51302.564999999995.
    expect(54002.7 - 5400.27 + 2700.135).toBe(51302.564999999995)
    expect(emCentavos(54002.7 - 5400.27 + 2700.135)).toBe(51302.57)
    expect(emCentavos(1546.105)).toBe(1546.11)
  })

  it('o que não é meio centavo não sobe: 0,004999 é zero, 123,4549 é 123,45', () => {
    expect(emCentavos(0.004999)).toBe(0)
    expect(emCentavos(123.4549)).toBe(123.45)
    expect(Object.is(emCentavos(-0.001), 0)).toBe(true)
  })

  it('fora da faixa do centavo exato (R$ 10 trilhões) e não-número voltam como estão — o absurdo continua gritando', () => {
    expect(emCentavos(1e306)).toBe(1e306)
    expect(emCentavos(Infinity)).toBe(Infinity)
    expect(Number.isNaN(emCentavos(NaN))).toBe(true)
    expect(somaEmCentavos([1e306, 1e306])).toBe(2e306)
  })

  it('somaEmCentavos soma centavos inteiros: 0,10 + 0,20 é 0,30, não 0,30000000000000004', () => {
    expect(somaEmCentavos([0.1, 0.2])).toBe(0.3)
    expect(somaEmCentavos([])).toBe(0)
    expect(somaEmCentavos([80981.71, 40000, 12500.5])).toBe(133482.21)
  })

  it('somaCentavos (a régua dos custos, 25/07/2026) segue a MESMA régua do meio centavo', () => {
    // 1,005 é guardado pelo double como 1,00499999999999989…: o Math.round de
    // antes dava R$ 1,00; a régua do meio centavo dá R$ 1,01, como no papel.
    expect(somaCentavos([1.005])).toBe(1.01)
    expect(somaCentavos([-0.005])).toBe(-0.01)
    expect(somaCentavos([0.1, 0.2])).toBe(0.3)
  })
})
