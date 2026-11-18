import { describe, it, expect } from 'vitest'
import { duplicarNovaEdicao, duplicarCopia } from './novaEdicao.js'
import { novoEvento, novoItem } from './defaults.js'
import { computeCenario } from './calc.js'
import { clone } from './util.js'

const eventoRealizado = () => {
  const e = novoEvento('Brisa')
  e.data = '2026-03-14'
  e.vendidosAteHoje = 950
  e.receitaRealizada = { bilheteria: 186420, bar: 22500 }
  e.outrasReceitas = { bar: 20000, patrocinio: 5000 }
  e.categorias = [
    {
      id: 'aeb',
      nome: 'A&B',
      padrao: true,
      itens: [
        novoItem({ servico: 'Gelo', estimado: 1000, realizado: 1300, status: 'PAGO' }),
        novoItem({ servico: 'Copos', estimado: 500, realizado: '', status: 'FECHADO' }),
      ],
    },
  ]
  return e
}

describe('duplicarNovaEdicao (sugestão 4)', () => {
  it('NÃO muta o evento original', () => {
    const orig = eventoRealizado()
    const congelado = clone(orig)
    duplicarNovaEdicao(orig)
    duplicarNovaEdicao(orig, { usarRealizadoComoEstimado: true })
    expect(orig).toEqual(congelado)
  })

  it('nasce limpa: realizado vazio, status ORÇAR, receita realizada e vendidos zerados, sem data', () => {
    const nova = duplicarNovaEdicao(eventoRealizado())
    for (const c of nova.categorias)
      for (const i of c.itens) {
        expect(i.realizado).toBe('')
        expect(i.status).toBe('ESTIMADO')
      }
    expect(nova.receitaRealizada).toEqual({ bilheteria: '', bar: '' })
    expect(nova.vendidosAteHoje).toBe('')
    expect(nova.data).toBe('')
    expect(nova.nome).toBe('Brisa (nova edição)')
    expect(nova.id).not.toBe(eventoRealizado().id)
  })

  it('lote de travas (item 4): a nova edição NÃO herda realizadoAuto (nasce com realizado vazio)', () => {
    const base = eventoRealizado()
    // a edição anterior teve um realizado GRAVADO por parcelas (realizadoAuto=true)
    base.categorias[0].itens[0] = {
      ...base.categorias[0].itens[0],
      realizado: 3000,
      realizadoAuto: true,
    }
    const nova = duplicarNovaEdicao(base)
    for (const c of nova.categorias)
      for (const i of c.itens) {
        expect(i.realizado).toBe('')
        expect(i.realizadoAuto).toBeFalsy() // a flag não viaja para a próxima edição
      }
  })

  it('sem a opção: estimados e bar previsto ficam como estavam', () => {
    const nova = duplicarNovaEdicao(eventoRealizado())
    expect(nova.categorias[0].itens.map((i) => i.estimado)).toEqual([1000, 500])
    expect(nova.outrasReceitas.bar).toBe(20000)
    expect(nova.outrasReceitas.patrocinio).toBe(5000)
  })

  it('com a opção: realizado vira o novo estimado (fallback: estimado antigo)', () => {
    const nova = duplicarNovaEdicao(eventoRealizado(), { usarRealizadoComoEstimado: true })
    // Gelo tinha realizado 1300 → novo estimado 1300; Copos sem realizado → mantém 500
    expect(nova.categorias[0].itens.map((i) => i.estimado)).toEqual([1300, 500])
    // bar realizado 22500 vira o novo bar previsto
    expect(nova.outrasReceitas.bar).toBe(22500)
    // e a nova edição continua limpa
    expect(nova.categorias[0].itens.every((i) => i.realizado === '' && i.status === 'ESTIMADO')).toBe(true)
    expect(nova.receitaRealizada).toEqual({ bilheteria: '', bar: '' })
  })

  it('com a opção mas sem bar realizado: bar previsto mantém o antigo', () => {
    const e = eventoRealizado()
    e.receitaRealizada = { bilheteria: 186420, bar: '' }
    const nova = duplicarNovaEdicao(e, { usarRealizadoComoEstimado: true })
    expect(nova.outrasReceitas.bar).toBe(20000)
  })

  it('lotes, cenários, margens e benchmarks ativos são mantidos', () => {
    const orig = eventoRealizado()
    const nova = duplicarNovaEdicao(orig)
    expect(nova.lotes).toEqual(orig.lotes)
    expect(nova.cenariosConfig).toEqual(orig.cenariosConfig)
    expect(nova.benchmarksAtivos).toEqual(orig.benchmarksAtivos)
  })

  it('herda o tipo de festa (sugestão 16 — a próxima edição é da mesma festa)', () => {
    const orig = { ...eventoRealizado(), tipo: 'Brisa' }
    expect(duplicarNovaEdicao(orig).tipo).toBe('Brisa')
    // sem tipo, continua sem tipo — nada é inventado
    const semTipo = eventoRealizado()
    expect(duplicarNovaEdicao(semTipo).tipo).toBe(semTipo.tipo)
  })

  it('herda o marcador open bar (sugestão 27 — a próxima edição da festa segue open bar até o Marco desmarcar)', () => {
    expect(duplicarNovaEdicao({ ...eventoRealizado(), openBar: true }).openBar).toBe(true)
    expect(duplicarNovaEdicao({ ...eventoRealizado(), openBar: false }).openBar).toBe(false)
  })

  it('open bar + usar realizado: a nova edição continua open bar e o bar segue R$ 0 na conta', () => {
    const e = { ...eventoRealizado(), openBar: true }
    const nova = duplicarNovaEdicao(e, { usarRealizadoComoEstimado: true })
    // o valor pode ficar guardado no campo, mas openBar: true mantém a
    // receita de bar em 0 na conta dos cenários
    expect(nova.openBar).toBe(true)
    expect(computeCenario(nova, 'realista').bar).toBe(0)
  })

  it('evento antigo sem os campos opcionais não quebra', () => {
    const e = eventoRealizado()
    delete e.receitaRealizada
    delete e.vendidosAteHoje
    const nova = duplicarNovaEdicao(e, { usarRealizadoComoEstimado: true })
    expect(nova.receitaRealizada).toEqual({ bilheteria: '', bar: '' })
    expect(nova.vendidosAteHoje).toBe('')
  })
})

describe('Parte 2 do fechamento (20/07/2026) — cópia e nova edição nascem ABERTAS', () => {
  const eventoFechadoDeTeste = () => ({
    ...eventoRealizado(),
    status: 'fechado',
    fechamento: { em: '2026-07-20T21:00:00.000Z', foto: { resultado: { resultado: 1 } } },
  })

  it('nova edição de evento fechado nasce aberta e sem foto (o spread carregaria a trava)', () => {
    const nova = duplicarNovaEdicao(eventoFechadoDeTeste())
    expect(nova.status).toBe('aberto')
    expect(nova.fechamento).toBeNull()
  })

  it('duplicarCopia: cópia idêntica, mas aberta e sem foto — e não muta o original', () => {
    const orig = eventoFechadoDeTeste()
    const congelado = clone(orig)
    const copia = duplicarCopia(orig, '2026-07-21T10:00:00.000Z')
    expect(copia.status).toBe('aberto')
    expect(copia.fechamento).toBeNull()
    expect(copia.nome).toBe('Brisa (cópia)')
    expect(copia.id).not.toBe(orig.id)
    expect(copia.criadoEm).toBe('2026-07-21T10:00:00.000Z')
    // o resto é cópia fiel (realizados INCLUSIVE — duplicar não é nova edição)
    expect(copia.receitaRealizada).toEqual(orig.receitaRealizada)
    expect(copia.categorias).toEqual(orig.categorias)
    expect(orig).toEqual(congelado)
  })
})

describe('o bar realizado vai para o campo QUE O EVENTO LÊ (Marco, 27/07/2026)', () => {
  // O defeito, medido no evento real do Marco em 27/07/2026: a edição de
  // 05/07/2024 fechou com R$ 180.000 de bar REALIZADO e cobra bar POR PESSOA.
  // A nova edição gravava os R$ 180.000 em outrasReceitas.bar (campo do bar
  // FIXO), e o calc.js, em modo 'porPessoa', lê barTicket[cenario] e nunca olha
  // aquele campo. A tela dele mostrava o cenário pessimista com PREJUÍZO de
  // R$ 3.980 quando, com o bar contado, ele dá LUCRO de R$ 148.260 — R$ 152.240
  // de diferença no cenário que decide se a festa acontece.
  const festaPorPessoa = (extra = {}) => ({
    ...novoEvento('Marfim Alto Casa Norte'),
    publicoEstimado: 1758,
    barModo: 'porPessoa',
    barTicket: { pessimista: '', realista: 110, otimista: '' },
    outrasReceitas: { bar: '' },
    receitaRealizada: { bilheteria: '', bar: 180000 },
    lotes: [{ id: 'l1', nome: 'Lote 1', valor: 200, quantidade: 1758 }],
    ...extra,
  })

  it('modo POR PESSOA: converte para ticket por pessoa nos TRÊS cenários', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa(), { usarRealizadoComoEstimado: true })
    // 180.000 ÷ 1.758 = 102,3891… → 102,39
    expect(nova.barTicket).toEqual({ pessimista: 102.39, realista: 102.39, otimista: 102.39 })
  })

  it('modo POR PESSOA: os R$ 180.000 NÃO ficam no campo que o cálculo ignora', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa(), { usarRealizadoComoEstimado: true })
    expect(nova.outrasReceitas.bar).toBe('')
  })

  it('os TRÊS cenários passam a ter receita de bar — antes só o realista tinha', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa(), { usarRealizadoComoEstimado: true })
    for (const c of ['pessimista', 'realista', 'otimista']) {
      expect(computeCenario(nova, c).bar).toBeGreaterThan(0)
    }
  })

  it('o lucro volta a crescer do pessimista para o otimista (era o que estava invertido)', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa(), { usarRealizadoComoEstimado: true })
    const p = computeCenario(nova, 'pessimista').lucro
    const r = computeCenario(nova, 'realista').lucro
    const o = computeCenario(nova, 'otimista').lucro
    expect(r).toBeGreaterThanOrEqual(p)
    expect(o).toBeGreaterThanOrEqual(r)
  })

  it('modo FIXO continua EXATAMENTE como era: o realizado vai para outrasReceitas.bar', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa({ barModo: 'fixo' }), {
      usarRealizadoComoEstimado: true,
    })
    expect(nova.outrasReceitas.bar).toBe(180000)
    // e não inventa ticket por pessoa num evento que não cobra por pessoa
    expect(nova.barTicket).toEqual({ pessimista: '', realista: 110, otimista: '' })
  })

  it('SEM público não há conversão, e o valor é PRESERVADO no campo fixo', () => {
    // Escrito duas vezes: a primeira versão não carregava nada, e um teste que
    // já existia derrubou — 'porPessoa' é o padrão de todo evento novo e o
    // público nasce vazio, então "não carregar" jogaria fora, na maioria dos
    // eventos, o número que o Marco acabou de pedir para carregar. Preservar
    // vence; quem tira o silêncio é o aviso do cenário, não o descarte.
    const nova = duplicarNovaEdicao(festaPorPessoa({ publicoEstimado: '' }), {
      usarRealizadoComoEstimado: true,
    })
    expect(nova.outrasReceitas.bar).toBe(180000)
    expect(nova.barTicket).toEqual({ pessimista: '', realista: 110, otimista: '' })
  })

  it('OPEN BAR não carrega nada — a receita de bar é 0 em qualquer modo', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa({ openBar: true }), {
      usarRealizadoComoEstimado: true,
    })
    expect(nova.outrasReceitas.bar).toBe('')
    expect(computeCenario(nova, 'realista').bar).toBe(0)
  })

  it('sem "usar os realizados", nada muda em nenhum modo', () => {
    const nova = duplicarNovaEdicao(festaPorPessoa(), { usarRealizadoComoEstimado: false })
    expect(nova.outrasReceitas.bar).toBe('')
    expect(nova.barTicket).toEqual({ pessimista: '', realista: 110, otimista: '' })
  })

  it('o evento ORIGINAL não é mutado (a promessa da função pura)', () => {
    const orig = festaPorPessoa()
    const antes = clone(orig)
    duplicarNovaEdicao(orig, { usarRealizadoComoEstimado: true })
    expect(orig).toEqual(antes)
  })
})
