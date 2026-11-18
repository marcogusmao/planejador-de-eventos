// Prova do defeito de IDENTIDADE das linhas de backup antigo (conserto 2,
// autorizado pelo Marco em 20/07/2026).
//
// Lotes e itens de custo criados DENTRO do app sempre têm id (`uid()`), mas
// `migracao.js` não gerava id para nenhum dos dois (só para patrocínios e
// parcelas). Backup antigo abre com essas linhas SEM id — e aí:
//
//  - as listas usam `key={l.id}` / `key={i.id}`; com id `undefined` o React
//    cai no índice, a instância do botão de ordem não acompanha a linha, e
//    reordenar PELO TECLADO mexe na linha ERRADA (com o desfazer nomeando um
//    lote que o Marco não clicou);
//  - `planejarMovimento` vê várias linhas com o MESMO id (`undefined`), entra
//    no caminho de desempate por posição e avisa — corretamente — que a lista
//    tem "linhas sem identificador próprio".
//
// O conserto NÃO é campo novo: o schema já define `id` nessas linhas. O que
// existe é valor AUSENTE em dado antigo, e a migração já normaliza outras
// coisas do mesmo jeito. Por isso o princípio 2 vale inteiro e está provado
// aqui: números intactos, ordem intacta, id ESTÁVEL entre aberturas, e id
// existente JAMAIS tocado.

import { describe, expect, it } from 'vitest'
import { migrarEvento, migrarEventos } from './migracao.js'
import { planejarMovimento } from './ordenar.js'
import { computeCenarios } from './calc.js'

// ————— o dado do Marco como ele está no backup antigo —————
// Sem `id` em nenhum lote e em nenhum item de custo, exatamente como a
// migração antiga deixava.
const eventoLegado = () => ({
  id: 'ev-legado',
  nome: 'Marfim Alto 09/05',
  data: '2026-05-09',
  local: 'O Galeao',
  publicoEstimado: 400,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  outrasReceitas: { bar: 8000, patrocinio: '' },
  lotes: [
    { nome: 'Lote A', valor: 60, quantidade: 100, somenteOtimista: false },
    { nome: 'Lote B', valor: 80, quantidade: 120, somenteOtimista: false },
    { nome: 'Lote C', valor: 100, quantidade: 150, somenteOtimista: false },
    { nome: 'Lote D', valor: 120, quantidade: 80, somenteOtimista: true },
  ],
  categorias: [
    {
      id: 'producao',
      nome: 'Produção',
      itens: [
        { servico: 'Som', estimado: 5000, status: 'FECHADO' },
        { servico: 'Luz', estimado: 3000, status: 'ORÇAR' },
        { servico: 'Palco', estimado: 7000, status: 'NEGOCIANDO' },
      ],
    },
    {
      id: 'ab',
      nome: 'A&B',
      itens: [
        { servico: 'Gelo', estimado: 900, status: 'PAGO' },
        { servico: 'Copos', estimado: 400, status: 'PAGO' },
      ],
    },
  ],
})

const todosLotes = (e) => e.lotes
const todosItens = (e) => e.categorias.flatMap((c) => c.itens)

describe('backup antigo: toda linha precisa de identidade própria', () => {
  it('todo lote sai da migração com id não-vazio e ÚNICO', () => {
    const e = migrarEvento(eventoLegado())
    const ids = todosLotes(e).map((l) => l.id)
    for (const id of ids) expect(typeof id === 'string' && id !== '').toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo item de custo sai da migração com id não-vazio e ÚNICO no evento inteiro', () => {
    const e = migrarEvento(eventoLegado())
    const ids = todosItens(e).map((i) => i.id)
    for (const id of ids) expect(typeof id === 'string' && id !== '').toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('o id é ESTÁVEL: abrir, fechar e reabrir o app dá os MESMOS ids', () => {
    const a = migrarEvento(eventoLegado())
    const b = migrarEvento(eventoLegado())
    expect(todosLotes(b).map((l) => l.id)).toEqual(todosLotes(a).map((l) => l.id))
    expect(todosItens(b).map((i) => i.id)).toEqual(todosItens(a).map((i) => i.id))
  })

  it('migrar duas vezes = migrar uma vez (idempotente, inclusive nos ids)', () => {
    const uma = migrarEvento(eventoLegado())
    const duas = migrarEvento(uma)
    expect(duas).toEqual(uma)
  })
})

describe('o clique do Marco passa a mexer na linha certa', () => {
  it('mover o Lote D para cima move O LOTE D — e sem aviso de "sem identificador"', () => {
    const e = migrarEvento(eventoLegado())
    const loteD = e.lotes[3]
    expect(loteD.nome).toBe('Lote D')

    const p1 = planejarMovimento(e.lotes, loteD.id, 'cima', 3)
    expect(p1.mudou).toBe(true)
    expect(p1.aviso).toBe(null)
    expect(p1.lista.map((l) => l.nome)).toEqual(['Lote A', 'Lote B', 'Lote D', 'Lote C'])

    // segunda seta na MESMA linha: o Lote D sobe de novo (era aqui que o dado
    // legado devolvia a linha errada)
    const p2 = planejarMovimento(p1.lista, loteD.id, 'cima', 2)
    expect(p2.mudou).toBe(true)
    expect(p2.aviso).toBe(null)
    expect(p2.lista.map((l) => l.nome)).toEqual(['Lote A', 'Lote D', 'Lote B', 'Lote C'])
  })

  it('o mesmo vale para os itens de custo', () => {
    const e = migrarEvento(eventoLegado())
    const itens = e.categorias[0].itens
    const palco = itens[2]
    const p = planejarMovimento(itens, palco.id, 'cima', 2)
    expect(p.mudou).toBe(true)
    expect(p.aviso).toBe(null)
    expect(p.lista.map((i) => i.servico)).toEqual(['Som', 'Palco', 'Luz'])
  })
})

describe('o que NÃO pode mudar', () => {
  it('id que JÁ EXISTE não é tocado — nem em lote, nem em item', () => {
    const base = eventoLegado()
    base.lotes[0].id = 'lote-antigo-real'
    base.lotes[2].id = 'outro-id-real'
    base.categorias[0].itens[1].id = 'item-antigo-real'
    const e = migrarEvento(base)
    expect(e.lotes[0].id).toBe('lote-antigo-real')
    expect(e.lotes[2].id).toBe('outro-id-real')
    expect(e.categorias[0].itens[1].id).toBe('item-antigo-real')
    // e os que faltavam ganharam id sem colidir com os que já existiam
    const ids = todosLotes(e).map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a ORDEM das linhas é preservada exatamente', () => {
    const e = migrarEvento(eventoLegado())
    expect(e.lotes.map((l) => l.nome)).toEqual(['Lote A', 'Lote B', 'Lote C', 'Lote D'])
    expect(e.categorias[0].itens.map((i) => i.servico)).toEqual(['Som', 'Luz', 'Palco'])
    expect(e.categorias[1].itens.map((i) => i.servico)).toEqual(['Gelo', 'Copos'])
  })

  it('NENHUM número muda: os 3 cenários saem idênticos antes e depois do id', () => {
    const semId = migrarEvento(eventoLegado())
    // o MESMO evento, mas com ids já preenchidos por outro caminho
    const comId = migrarEvento(eventoLegado())
    const antes = computeCenarios(semId)
    const depois = computeCenarios(comId)
    expect(JSON.stringify(depois)).toBe(JSON.stringify(antes))
  })

  it('todos os demais campos da linha passam intocados', () => {
    const e = migrarEvento(eventoLegado())
    const l = e.lotes[3]
    expect(l.nome).toBe('Lote D')
    expect(l.valor).toBe(120)
    expect(l.quantidade).toBe(80)
    expect(l.somenteOtimista).toBe(true)
    const i = e.categorias[1].itens[0]
    expect(i.servico).toBe('Gelo')
    expect(i.estimado).toBe(900)
    expect(i.status).toBe('PAGO')
  })

  it('lote/item que não é objeto continua sendo descartado ou preservado como era', () => {
    const e = migrarEvento({ ...eventoLegado(), lotes: [null, { nome: 'ok' }] })
    expect(e.lotes[0]).toBe(null)
    expect(typeof e.lotes[1].id).toBe('string')
  })

  it('migrarEventos aplica a mesma regra na lista inteira', () => {
    const [a, b] = migrarEventos([eventoLegado(), { ...eventoLegado(), id: 'ev-2' }])
    expect(a.lotes.every((l) => l.id)).toBe(true)
    expect(b.lotes.every((l) => l.id)).toBe(true)
  })
})
