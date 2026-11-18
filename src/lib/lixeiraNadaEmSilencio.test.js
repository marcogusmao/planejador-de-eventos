// Três coisas que a rede de proteção fazia CALADA (verificação adversarial
// 19/07/2026) — princípio 4 do CLAUDE.md, "nada falha em silêncio":
//
//   2. a 51ª exclusão empurrava a cópia mais antiga para fora da lixeira sem
//      dizer nada, logo depois de o confirm ter prometido que dava para
//      restaurar depois;
//   3. `podados` (quantos snapshots a falta de espaço fez o app jogar fora) era
//      calculado e NUNCA lido — o app sabia e não contava;
//   4. o item zumbi: previsão viva no store E cópia na lixeira, com um botão
//      "Restaurar" que ia falhar toda vez.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  rotacionarComDescarte,
  rotacionar,
  proximoDescarteDaLixeira,
  mensagemPoda,
  estadoItemLixeira,
  restaurarComoCopiaDaLixeira,
  moverParaLixeira,
  excluirEventoParaLixeira,
  MAX_LIXEIRA,
} from './protecao.js'

const LIXEIRA_KEY = 'previsao-eventos:lixeira:v1'

function memoriaFalsa(inicial = {}) {
  const mem = new Map(Object.entries(inicial))
  return {
    mem,
    api: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      get length() {
        return mem.size
      },
      key: (i) => [...mem.keys()][i] ?? null,
    },
  }
}

// Uma lixeira já com `n` itens, do mais recente para o mais antigo.
const lixeiraCom = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`,
    eventoId: `ev-${i}`,
    nome: `Previsão ${i}`,
    excluidoEm: `2026-07-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z`,
    evento: { id: `ev-${i}`, nome: `Previsão ${i}` },
  }))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ————— Item 2: a 51ª exclusão —————

describe('rotacionarComDescarte devolve o que jogou fora', () => {
  it('lista cheia: diz qual item saiu', () => {
    const r = rotacionarComDescarte([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { id: 'novo' }, 3)
    expect(r.lista.map((i) => i.id)).toEqual(['novo', 'a', 'b'])
    expect(r.descartados).toEqual([{ id: 'c' }])
  })

  it('lista com espaço: nada descartado', () => {
    const r = rotacionarComDescarte([{ id: 'a' }], { id: 'novo' }, 5)
    expect(r.descartados).toEqual([])
  })

  it('`rotacionar` continua com o comportamento de sempre', () => {
    expect(rotacionar([{ id: 'a' }, { id: 'b' }], { id: 'c' }, 2)).toEqual([
      { id: 'c' },
      { id: 'a' },
    ])
  })
})

describe('a 51ª exclusão devolve o item descartado', () => {
  it('moverParaLixeira com a lixeira cheia entrega `descartado`', () => {
    const { api } = memoriaFalsa({ [LIXEIRA_KEY]: JSON.stringify(lixeiraCom(MAX_LIXEIRA)) })
    vi.stubGlobal('localStorage', api)

    const r = moverParaLixeira({ id: 'ev-novo', nome: 'Brisa 14/03' })

    expect(r.ok).toBe(true)
    expect(r.lista).toHaveLength(MAX_LIXEIRA)
    expect(r.descartado).toBeTruthy()
    expect(r.descartado.nome).toBe(`Previsão ${MAX_LIXEIRA - 1}`) // o mais antigo
  })

  it('com espaço na lixeira, `descartado` é null (nada de alarme falso)', () => {
    const { api } = memoriaFalsa({ [LIXEIRA_KEY]: JSON.stringify(lixeiraCom(3)) })
    vi.stubGlobal('localStorage', api)

    expect(moverParaLixeira({ id: 'ev-novo', nome: 'Marfim 09/05' }).descartado).toBe(null)
  })

  it('a transação da Home propaga `descartado` até quem mostra o toast', () => {
    const { api } = memoriaFalsa({ [LIXEIRA_KEY]: JSON.stringify(lixeiraCom(MAX_LIXEIRA)) })
    vi.stubGlobal('localStorage', api)

    const r = excluirEventoParaLixeira({ id: 'ev-novo', nome: 'Sobrado' }, () => {})

    expect(r.ok).toBe(true)
    expect(r.descartado?.nome).toBe(`Previsão ${MAX_LIXEIRA - 1}`)
  })
})

describe('proximoDescarteDaLixeira — o aviso que vem ANTES', () => {
  it('lixeira cheia: diz quem vai ser expulso na próxima exclusão', () => {
    const alvo = proximoDescarteDaLixeira(lixeiraCom(MAX_LIXEIRA))
    expect(alvo?.nome).toBe(`Previsão ${MAX_LIXEIRA - 1}`)
  })

  it('lixeira com espaço: null — o confirm não inventa aviso', () => {
    expect(proximoDescarteDaLixeira(lixeiraCom(MAX_LIXEIRA - 1))).toBe(null)
    expect(proximoDescarteDaLixeira([])).toBe(null)
  })
})

// ————— Item 3: `podados` deixa de ser calculado e ignorado —————

describe('mensagemPoda', () => {
  it('sem poda, sem mensagem', () => {
    expect(mensagemPoda(0)).toBe(null)
    expect(mensagemPoda(undefined)).toBe(null)
  })

  it('uma versão descartada: singular, e manda exportar backup', () => {
    const m = mensagemPoda(1)
    expect(m).toContain('a versão automática mais antiga foi descartada')
    expect(m).toContain('backup')
  })

  it('várias: plural com o número', () => {
    expect(mensagemPoda(3)).toContain('3 versões automáticas')
  })
})

// ————— Item 4: o item zumbi —————

describe('estadoItemLixeira — o item diz a verdade sobre si', () => {
  const item = { id: 'i1', nome: 'Brisa 05/12', evento: { id: 'ev-1', nome: 'Brisa 05/12' } }

  it('sem gêmea viva: restaurável', () => {
    expect(estadoItemLixeira(item, { eventos: [{ id: 'outro' }] })).toEqual({
      restauravel: true,
      motivo: null,
    })
  })

  it('gêmea viva no store: NÃO restaurável, com motivo e caminho', () => {
    const est = estadoItemLixeira(item, {
      eventos: [{ id: 'ev-1', nome: 'Brisa 05/12 (voltou pelo snapshot)' }],
    })
    expect(est.restauravel).toBe(false)
    expect(est.motivo).toContain('Já existe um evento vivo')
    expect(est.motivo).toContain('Brisa 05/12 (voltou pelo snapshot)')
    expect(est.motivo).toContain('Restaure como cópia')
  })

  it('item sem evento guardado não quebra', () => {
    expect(estadoItemLixeira({ id: 'x' }, { eventos: [] }).restauravel).toBe(true)
  })
})

describe('restaurarComoCopiaDaLixeira — a saída do zumbi', () => {
  it('devolve a previsão com id novo, sai da lixeira e não toca na gêmea viva', () => {
    const item = {
      id: 'i1',
      eventoId: 'ev-1',
      nome: 'Brisa 05/12',
      excluidoEm: '2026-07-18T10:00:00.000Z',
      evento: { id: 'ev-1', nome: 'Brisa 05/12', publicoEstimado: 400 },
    }
    const { mem, api } = memoriaFalsa({ [LIXEIRA_KEY]: JSON.stringify([item]) })
    vi.stubGlobal('localStorage', api)

    const viva = { id: 'ev-1', nome: 'Brisa 05/12', publicoEstimado: 999 }
    let store = { eventos: [viva] }
    const aplicar = (fn) => {
      store = fn(store)
    }

    const r = restaurarComoCopiaDaLixeira('i1', aplicar, '2026-07-19T12:00:00.000Z', 'ev-copia')

    expect(r.ok).toBe(true)
    expect(store.eventos).toHaveLength(2)
    // a gêmea viva continua intacta
    expect(store.eventos.find((e) => e.id === 'ev-1')).toEqual(viva)
    // e a cópia entrou com identidade nova, conteúdo preservado
    const copia = store.eventos.find((e) => e.id === 'ev-copia')
    expect(copia.nome).toBe('Brisa 05/12 (cópia da lixeira)')
    expect(copia.publicoEstimado).toBe(400)
    // a lixeira ficou vazia
    expect(JSON.parse(mem.get(LIXEIRA_KEY))).toEqual([])
  })

  it('item que sumiu da lixeira: recusa com motivo, sem tocar no store', () => {
    const { api } = memoriaFalsa({ [LIXEIRA_KEY]: JSON.stringify([]) })
    vi.stubGlobal('localStorage', api)

    let mexeu = false
    const r = restaurarComoCopiaDaLixeira('sumiu', () => {
      mexeu = true
    })

    expect(r.ok).toBe(false)
    expect(r.erro).toContain('não está mais na lixeira')
    expect(mexeu).toBe(false)
  })
})
