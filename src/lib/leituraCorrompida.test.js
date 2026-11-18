// O achado mais grave da verificação adversarial de 19/07/2026: dado corrompido
// abria o app VAZIO e o auto-save gravava o vazio por cima — corrupção
// recuperável virando perda definitiva.
//
// Estes testes provam as quatro obrigações do conserto, na ordem de gravidade:
//   (a) o bruto é preservado ANTES de qualquer outra coisa (quarentena);
//   (b) a gravação fica BLOQUEADA — nada passa por cima do corrompido;
//   (c) o app tem o que dizer na tela (estadoLeitura);
//   (d) há saída, e ela devolve a gravação (liberarGravacao).
// Mais a distinção que impede o alarme falso: primeira vez no app NÃO é falha.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadStore,
  saveStore,
  estadoLeitura,
  gravacaoBloqueada,
  liberarGravacao,
  listarQuarentena,
} from './storage.js'

const KEY = 'previsao-eventos:v1'

// localStorage de mentira, com a superfície que o módulo usa (getItem, setItem,
// length, key). Os dados REAIS do Marco nunca entram aqui.
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

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // A trava é estado de MÓDULO: sem isto, um teste que a liga contamina os
  // seguintes. Destravar aqui é o equivalente do "reponha o localStorage" que
  // a validação ao vivo exige.
  liberarGravacao()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('leitura corrompida — (a) o bruto é preservado', () => {
  it('copia a string ilegível para uma chave de quarentena', () => {
    const bruto = '{"eventos":[{"id":"brisa","nome":"Brisa 14/03"'  // JSON truncado
    const { mem, api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    loadStore()

    const chaves = listarQuarentena()
    expect(chaves).toHaveLength(1)
    expect(mem.get(chaves[0])).toBe(bruto)
    // e o original continua exatamente onde estava
    expect(mem.get(KEY)).toBe(bruto)
  })

  it('recarregar a página não multiplica cópias do mesmo conteúdo', () => {
    const bruto = '{quebrado'
    const { api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    loadStore()
    liberarGravacao()
    loadStore()
    liberarGravacao()
    loadStore()

    expect(listarQuarentena()).toHaveLength(1)
  })
})

describe('leitura corrompida — (b) a gravação fica BLOQUEADA', () => {
  it('o auto-save NÃO grava o store vazio por cima do dado corrompido', () => {
    const bruto = '{"eventos":[{"id":"cordel","nome":"Festa do Cordel"'
    const { mem, api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    const store = loadStore()
    expect(store.eventos).toEqual([]) // o app abre vazio…
    expect(gravacaoBloqueada()).toBe(true) // …mas travado

    // isto é o efeito do App.jsx rodando com o store vazio — o momento exato
    // em que a perda definitiva acontecia
    const r = saveStore(store)

    expect(r.ok).toBe(false)
    expect(r.bloqueado).toBe(true)
    expect(mem.get(KEY)).toBe(bruto) // o dado do Marco continua lá, inteiro
  })

  it('mesmo um store COM eventos é recusado enquanto a trava está de pé', () => {
    const bruto = 'nada disso é json'
    const { mem, api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    loadStore()
    const r = saveStore({ eventos: [{ id: 'novo', nome: 'Previsão criada por engano' }] })

    expect(r.bloqueado).toBe(true)
    expect(mem.get(KEY)).toBe(bruto)
  })
})

describe('leitura corrompida — (c) o app tem o que dizer na tela', () => {
  it('estadoLeitura descreve a falha, o tamanho e onde o bruto ficou', () => {
    const bruto = '{"eventos":['
    const { api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    loadStore()
    const e = estadoLeitura()

    expect(e).toBeTruthy()
    expect(e.bytes).toBe(bruto.length)
    expect(e.quarentenaOk).toBe(true)
    expect(e.chaveQuarentena).toMatch(/^previsao-eventos:quarentena:/)
    expect(e.erro).toBeTruthy()
  })

  it('quarentena que falha não desliga a trava — o original é o que importa', () => {
    const bruto = '{quebrado'
    const mem = new Map([[KEY, bruto]])
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      // só a quarentena falha; a leitura do original segue funcionando
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError')
      },
      length: 1,
      key: () => KEY,
    })

    loadStore()

    expect(gravacaoBloqueada()).toBe(true)
    expect(estadoLeitura().quarentenaOk).toBe(false)
    expect(mem.get(KEY)).toBe(bruto)
  })
})

describe('leitura corrompida — (d) há saída, e ela devolve a gravação', () => {
  it('liberarGravacao destrava e o store restaurado finalmente persiste', () => {
    const bruto = '{quebrado'
    const { mem, api } = memoriaFalsa({ [KEY]: bruto })
    vi.stubGlobal('localStorage', api)

    loadStore()
    expect(saveStore({ eventos: [] }).bloqueado).toBe(true)

    // é o que o botão "Restaurar" da Proteção de dados faz antes do setStore
    liberarGravacao()

    const recuperado = { eventos: [{ id: 'brisa', nome: 'Brisa 14/03' }] }
    expect(saveStore(recuperado).ok).toBe(true)
    expect(gravacaoBloqueada()).toBe(false)
    expect(JSON.parse(mem.get(KEY)).eventos[0].nome).toBe('Brisa 14/03')
  })
})

describe('primeira vez no app NÃO é falha de leitura', () => {
  it('localStorage sem a chave: store vazio, nenhuma trava, nenhum aviso', () => {
    const { api } = memoriaFalsa({})
    vi.stubGlobal('localStorage', api)

    const store = loadStore()

    expect(store.eventos).toEqual([])
    expect(gravacaoBloqueada()).toBe(false)
    expect(estadoLeitura()).toBe(null)
    expect(listarQuarentena()).toEqual([])
    // e o app grava normalmente desde o primeiro clique
    expect(saveStore(store).ok).toBe(true)
  })

  it('store legitimamente vazio e JÁ salvo também passa limpo', () => {
    const vazioSalvo = JSON.stringify({ eventos: [], benchmarksCustom: [] })
    const { api } = memoriaFalsa({ [KEY]: vazioSalvo })
    vi.stubGlobal('localStorage', api)

    loadStore()

    expect(gravacaoBloqueada()).toBe(false)
    expect(estadoLeitura()).toBe(null)
  })
})

// ————— Corrupção que PARSEIA (verificação de 20/07/2026) —————
//
// A defesa acima só armava quando o JSON.parse LANÇAVA. Um conteúdo que
// parseia limpo mas não é store nenhum entrava pela linha
// `Array.isArray(d.eventos) ? d.eventos : []` e virava lista vazia EM
// SILÊNCIO — sem quarentena, sem trava, sem aviso — e o auto-save gravava o
// vazio por cima. Mesmo estrago, outra porta.
//
// Cada vetor abaixo é um formato que já saiu de um arquivo real em algum
// momento da vida de alguém: truncado pela metade, sobrescrito por outra
// chave, exportado por script que virou o objeto em lista, ou o clássico
// "undefined" gravado como texto.
describe('corrupção que PARSEIA — formato inválido é corrupção, não "comece do zero"', () => {
  const vetores = [
    ['uma lista no lugar do conjunto', '[]'],
    ['um número solto', '0'],
    ['um conjunto sem a lista de previsões', '{"versao":1}'],
    ['eventos nulo', '{"eventos":null}'],
    ['eventos como texto "undefined"', '{"eventos":"undefined"}'],
    ['eventos virou objeto indexado', '{"eventos":{"0":{"id":"brisa"}}}'],
    ['uma previsão da lista não é objeto', '{"eventos":[{"id":"a"},"brisa"]}'],
  ]

  for (const [nome, bruto] of vetores) {
    it(`${nome}: quarentena + trava de gravação + aviso, e o original fica onde está`, () => {
      const { mem, api } = memoriaFalsa({ [KEY]: bruto })
      vi.stubGlobal('localStorage', api)

      const store = loadStore()

      // (a) o bruto foi preservado — e continua no lugar original também
      const chaves = listarQuarentena()
      expect(chaves).toHaveLength(1)
      expect(mem.get(chaves[0])).toBe(bruto)
      expect(mem.get(KEY)).toBe(bruto)
      // (b) o auto-save não grava o vazio por cima
      expect(gravacaoBloqueada()).toBe(true)
      expect(saveStore(store).bloqueado).toBe(true)
      expect(mem.get(KEY)).toBe(bruto)
      // (c) o app tem o que dizer, em português
      const estado = estadoLeitura()
      expect(estado).not.toBe(null)
      expect(estado.erro).toMatch(/salv[ao]/i)
      expect(estado.bytes).toBe(bruto.length)
      // (d) e há caminho de volta, o mesmo de sempre
      liberarGravacao()
      expect(saveStore({ eventos: [] }).ok).toBe(true)
    })
  }

  it('store de VERDADE com previsões continua abrindo normalmente', () => {
    const bom = JSON.stringify({
      eventos: [{ id: 'brisa', nome: 'Brisa 14/03' }],
      benchmarksCustom: [],
    })
    const { api } = memoriaFalsa({ [KEY]: bom })
    vi.stubGlobal('localStorage', api)

    const store = loadStore()

    expect(store.eventos).toHaveLength(1)
    expect(store.eventos[0].nome).toBe('Brisa 14/03')
    expect(gravacaoBloqueada()).toBe(false)
    expect(estadoLeitura()).toBe(null)
    expect(listarQuarentena()).toEqual([])
  })

  it('lista vazia salva de propósito NÃO é corrupção (o outro lado do teste)', () => {
    const { api } = memoriaFalsa({ [KEY]: JSON.stringify({ eventos: [] }) })
    vi.stubGlobal('localStorage', api)

    const store = loadStore()

    expect(store.eventos).toEqual([])
    expect(gravacaoBloqueada()).toBe(false)
    expect(estadoLeitura()).toBe(null)
    expect(listarQuarentena()).toEqual([])
    expect(saveStore(store).ok).toBe(true)
  })
})
