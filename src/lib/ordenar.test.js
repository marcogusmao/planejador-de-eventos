import { describe, it, expect } from 'vitest'
import { moverItem, moverPorId, podeSubir, podeDescer } from './ordenar.js'

const nomes = (l) => l.map((x) => x.nome)
const lista = () => [
  { id: 'a', nome: 'Lote 1' },
  { id: 'b', nome: 'Lote 2' },
  { id: 'c', nome: 'Lote 3' },
  { id: 'd', nome: 'Lote 4' },
]

describe('moverItem — o movimento em si', () => {
  it('desce uma posição', () => {
    expect(nomes(moverItem(lista(), 0, 1))).toEqual(['Lote 2', 'Lote 1', 'Lote 3', 'Lote 4'])
  })

  it('sobe uma posição', () => {
    expect(nomes(moverItem(lista(), 3, 2))).toEqual(['Lote 1', 'Lote 2', 'Lote 4', 'Lote 3'])
  })

  it('move várias posições de uma vez (do fim para o começo)', () => {
    expect(nomes(moverItem(lista(), 3, 0))).toEqual(['Lote 4', 'Lote 1', 'Lote 2', 'Lote 3'])
  })

  it('não muda o comprimento nem perde nenhum item', () => {
    const antes = lista()
    const depois = moverItem(antes, 1, 3)
    expect(depois).toHaveLength(antes.length)
    expect([...nomes(depois)].sort()).toEqual([...nomes(antes)].sort())
  })

  it('não muta a lista original (o histórico guarda a referência antiga)', () => {
    const antes = lista()
    const copia = nomes(antes)
    moverItem(antes, 0, 3)
    expect(nomes(antes)).toEqual(copia)
  })

  it('preserva os OBJETOS por referência — reordenar não recria item nenhum', () => {
    const antes = lista()
    const depois = moverItem(antes, 0, 2)
    expect(depois[2]).toBe(antes[0])
    expect(depois[0]).toBe(antes[1])
  })
})

describe('moverItem — bordas: pedido impossível não muda nada (mesma referência)', () => {
  it('lista vazia', () => {
    const vazia = []
    expect(moverItem(vazia, 0, 1)).toBe(vazia)
  })

  it('lista de 1 item', () => {
    const uma = [{ id: 'a' }]
    expect(moverItem(uma, 0, 1)).toBe(uma)
    expect(moverItem(uma, 0, -1)).toBe(uma)
    expect(moverItem(uma, 0, 0)).toBe(uma)
  })

  it('primeira linha tentando subir', () => {
    const l = lista()
    expect(moverItem(l, 0, -1)).toBe(l)
  })

  it('última linha tentando descer', () => {
    const l = lista()
    expect(moverItem(l, 3, 4)).toBe(l)
  })

  it('índice de origem fora da faixa', () => {
    const l = lista()
    expect(moverItem(l, 9, 0)).toBe(l)
    expect(moverItem(l, -1, 0)).toBe(l)
  })

  it('de === para', () => {
    const l = lista()
    expect(moverItem(l, 2, 2)).toBe(l)
  })

  it('índice não inteiro ou ausente', () => {
    const l = lista()
    expect(moverItem(l, 1.5, 0)).toBe(l)
    expect(moverItem(l, undefined, 0)).toBe(l)
    expect(moverItem(l, 0, null)).toBe(l)
  })

  it('lista que não é array volta como veio', () => {
    expect(moverItem(null, 0, 1)).toBe(null)
    expect(moverItem(undefined, 0, 1)).toBe(undefined)
  })
})

describe('podeSubir / podeDescer — quem fica desabilitado', () => {
  it('a primeira não sobe, a última não desce', () => {
    const l = lista()
    expect(podeSubir(l, 0)).toBe(false)
    expect(podeDescer(l, 0)).toBe(true)
    expect(podeSubir(l, 3)).toBe(true)
    expect(podeDescer(l, 3)).toBe(false)
  })

  it('item único não sobe nem desce', () => {
    const uma = [{ id: 'a' }]
    expect(podeSubir(uma, 0)).toBe(false)
    expect(podeDescer(uma, 0)).toBe(false)
  })

  it('lista vazia e índices absurdos são falsos, nunca explodem', () => {
    expect(podeSubir([], 0)).toBe(false)
    expect(podeDescer([], 0)).toBe(false)
    expect(podeSubir(lista(), 99)).toBe(false)
    expect(podeDescer(lista(), -3)).toBe(false)
    expect(podeSubir(null, 0)).toBe(false)
    expect(podeDescer(undefined, 0)).toBe(false)
  })
})

describe('moverPorId — a porta que as telas usam', () => {
  it('sobe e desce pelo id', () => {
    expect(nomes(moverPorId(lista(), 'c', 'cima'))).toEqual([
      'Lote 1',
      'Lote 3',
      'Lote 2',
      'Lote 4',
    ])
    expect(nomes(moverPorId(lista(), 'a', 'baixo'))).toEqual([
      'Lote 2',
      'Lote 1',
      'Lote 3',
      'Lote 4',
    ])
  })

  it('id que não existe mais na lista é no-op (mesma referência)', () => {
    const l = lista()
    expect(moverPorId(l, 'zzz', 'cima')).toBe(l)
  })

  it('bordas pelo id: primeiro para cima e último para baixo não mexem', () => {
    const l = lista()
    expect(moverPorId(l, 'a', 'cima')).toBe(l)
    expect(moverPorId(l, 'd', 'baixo')).toBe(l)
  })

  it('itens nulos na lista não quebram a busca', () => {
    const l = [null, { id: 'b' }, { id: 'c' }]
    expect(moverPorId(l, 'c', 'cima')).toEqual([null, { id: 'c' }, { id: 'b' }])
  })

  it('subir e descer de volta devolve exatamente a ordem original', () => {
    const l = lista()
    const ida = moverPorId(l, 'b', 'baixo')
    const volta = moverPorId(ida, 'b', 'cima')
    expect(nomes(volta)).toEqual(nomes(l))
  })
})
