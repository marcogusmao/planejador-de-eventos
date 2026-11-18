// Sessão O — sugestão 22: patrocínio por estágio.
// Vocabulário do módulo de Patrocínios do Financeiro (CHECK da tabela
// `patrocinios`): proposta → confirmado → recebido. Regra aprovada pelo Marco
// (18/07/2026): só confirmado/recebido ("fechado") conta na receita dos
// cenários e no semáforo; proposta é potencial visível, nunca somado.
// Condição inegociável: a migração preserva os números de TODO evento antigo
// (número solto vira item 'confirmado', que conta) — provado aqui byte a byte.

import { describe, it, expect } from 'vitest'
import { patrocinioPorEstagio, computeCenario, computeCenarios, veredito } from './calc.js'
import { migrarEvento } from './migracao.js'
import { duplicarNovaEdicao } from './novaEdicao.js'
import { parseBackup } from './storage.js'
import { montarItensPlano } from './planoFinanceiro.js'

// Evento old-style completo (patrocínio como número solto), com desconto,
// ticket manual, override, cortesia e lote só-otimista — o caminho inteiro.
const eventoAntigo = () => ({
  id: 'ev-pat',
  nome: 'Evento Patrocínio',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  descontoMedioPct: 12,
  outrasReceitas: { bar: 40000, patrocinio: 12500.5 },
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 200 },
    { id: 'porta', nome: 'Porta', valor: 150, quantidade: 60, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesia', valor: 0, quantidade: 50 },
  ],
  categorias: [
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { id: 'i1', servico: 'Insumos', estimado: 12000, realizado: 0, status: 'ORÇAR' },
        { id: 'i2', servico: 'Gelo', estimado: 1500, realizado: 1725.4, status: 'PAGO' },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10, ticketMedio: 95, ticketPct: -5 },
    realista: { vendaPct: 90 },
    otimista: { custoPct: -5 },
    overrides: { pessimista: { l1: 120 }, realista: {}, otimista: {} },
  },
})

// Evento já no formato novo, com lista por estágio.
const eventoComLista = (patrocinios) => ({
  ...eventoAntigo(),
  outrasReceitas: { bar: 40000, patrocinio: '' },
  patrocinios,
})

describe('patrocinioPorEstagio — a regra de contagem', () => {
  it('sem a lista (evento antigo): número solto conta inteiro como fechado', () => {
    const r = patrocinioPorEstagio(eventoAntigo())
    expect(r).toEqual({ fechado: 12500.5, potencial: 0, total: 12500.5 })
  })

  it('proposta é potencial; confirmado e recebido são fechado', () => {
    const r = patrocinioPorEstagio(
      eventoComLista([
        { id: 'p1', patrocinador: 'Mirante', valor: 20000, estagio: 'confirmado' },
        { id: 'p2', patrocinador: 'Coroado', valor: 5000, estagio: 'recebido' },
        { id: 'p3', patrocinador: 'Patrocinador A', valor: 8000, estagio: 'proposta' },
      ])
    )
    expect(r).toEqual({ fechado: 25000, potencial: 8000, total: 33000 })
  })

  it('estágio desconhecido NUNCA conta como fechado (vai para potencial)', () => {
    const r = patrocinioPorEstagio(
      eventoComLista([{ id: 'p1', patrocinador: 'X', valor: 1000, estagio: 'fechado' }])
    )
    expect(r).toEqual({ fechado: 0, potencial: 1000, total: 1000 })
  })

  it('lista vazia = zero; valor string numérica e vazio funcionam', () => {
    expect(patrocinioPorEstagio(eventoComLista([]))).toEqual({ fechado: 0, potencial: 0, total: 0 })
    const r = patrocinioPorEstagio(
      eventoComLista([
        { id: 'p1', patrocinador: 'A', valor: '1500.5', estagio: 'confirmado' },
        { id: 'p2', patrocinador: 'B', valor: '', estagio: 'proposta' },
      ])
    )
    expect(r).toEqual({ fechado: 1500.5, potencial: 0, total: 1500.5 })
  })
})

describe('computeCenario — só o fechado entra na receita e no break-even', () => {
  it('proposta fica fora da receita; confirmar o MESMO valor muda a receita', () => {
    // bar vazio de propósito: com bar 40.000 as outras receitas cobririam o
    // custo sozinhas e o break-even seria 0 dos dois lados — aqui queremos
    // ver o patrocínio fechado abatendo o custo a cobrir.
    const semBar = (patrocinios) => ({
      ...eventoComLista(patrocinios),
      outrasReceitas: { bar: '', patrocinio: '' },
    })
    const proposta = semBar([
      { id: 'p1', patrocinador: 'Mirante', valor: 10000, estagio: 'proposta' },
    ])
    const confirmado = semBar([
      { id: 'p1', patrocinador: 'Mirante', valor: 10000, estagio: 'confirmado' },
    ])
    const semNada = semBar([])
    const cP = computeCenario(proposta, 'realista')
    const cC = computeCenario(confirmado, 'realista')
    const c0 = computeCenario(semNada, 'realista')
    // proposta: receita idêntica a não ter patrocínio nenhum, potencial visível
    expect(cP.receitaTotal).toBe(c0.receitaTotal)
    expect(cP.patrocinio).toBe(0)
    expect(cP.patrocinioPotencial).toBe(10000)
    // confirmado: soma exata
    expect(cC.receitaTotal).toBe(c0.receitaTotal + 10000)
    expect(cC.patrocinio).toBe(10000)
    expect(cC.patrocinioPotencial).toBe(0)
    // break-even: patrocínio fechado abate custo a cobrir; proposta não
    expect(cC.breakEven).toBeLessThan(cP.breakEven)
    expect(cP.breakEven).toBe(c0.breakEven)
  })

  it('recebido conta igual a confirmado nos três cenários', () => {
    const recebido = eventoComLista([
      { id: 'p1', patrocinador: 'Coroado', valor: 7000, estagio: 'recebido' },
    ])
    const confirmado = eventoComLista([
      { id: 'p1', patrocinador: 'Coroado', valor: 7000, estagio: 'confirmado' },
    ])
    expect(JSON.stringify(computeCenarios(recebido))).toBe(JSON.stringify(computeCenarios(confirmado)))
  })
})

describe('semáforo — patrocínio em proposta não muda o veredito', () => {
  // Evento enxuto: receita realista líquida ≈ custo → margem controlável.
  const base = (patrocinios) => ({
    taxaBilheteria: 0,
    cashbackPct: 0,
    contingenciaPct: 0,
    outrasReceitas: { bar: '', patrocinio: '' },
    patrocinios,
    lotes: [{ id: 'l1', nome: 'Único', valor: 100, quantidade: 100 }],
    categorias: [{ id: 'c', nome: 'C', itens: [{ id: 'i', servico: 'x', estimado: 80000 }] }],
    cenariosConfig: { pessimista: { vendaPct: 70, custoPct: 0 }, realista: { vendaPct: 100 }, otimista: { custoPct: 0 } },
  })
  // realista sem patrocínio: receita 10.000 × custo 80.000 → vermelho
  it('proposta grande mantém vermelho; confirmada, o mesmo valor muda a cor', () => {
    const emProposta = veredito(
      computeCenarios(base([{ id: 'p', patrocinador: 'X', valor: 200000, estagio: 'proposta' }]))
    )
    const confirmada = veredito(
      computeCenarios(base([{ id: 'p', patrocinador: 'X', valor: 200000, estagio: 'confirmado' }]))
    )
    expect(emProposta.cor).toBe('vermelho')
    // 210.000 de receita × 80.000 de custo → margem ~62% no realista e lucro
    // positivo até no pessimista → verde
    expect(confirmada.cor).toBe('verde')
  })
})

describe('migração — números preservados (condição inegociável)', () => {
  it('número solto vira UM item confirmado e o campo antigo é consumido', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.patrocinios).toHaveLength(1)
    expect(m.patrocinios[0]).toMatchObject({
      patrocinador: 'Patrocínio',
      valor: 12500.5,
      estagio: 'confirmado',
    })
    expect(m.patrocinios[0].id).toBeTruthy()
    expect(m.outrasReceitas.patrocinio).toBe('')
    expect(m.outrasReceitas.bar).toBe(40000) // bar intocado
  })

  it('cenários ANTES e DEPOIS da migração são idênticos byte a byte', () => {
    const antes = JSON.stringify(computeCenarios(eventoAntigo()))
    const depois = JSON.stringify(computeCenarios(migrarEvento(eventoAntigo())))
    expect(depois).toBe(antes)
  })

  it('preserva zero, vazio, inválido e POSITIVO byte a byte (o negativo é recusado à parte)', () => {
    // Trava do negativo (Marco, 22/07/2026): patrocínio é receita de ENTRADA e
    // não pode ser negativo. Soltos VÁLIDOS seguem idênticos à conta de antes —
    // 0/vazio/inválido = sem item (0 antes = 0 depois), positivo = item que
    // conta. O NEGATIVO saiu desta lista: deixou de virar item, então a conta
    // muda de propósito (testado abaixo). Antes de 22/07 o −500 somava.
    for (const solto of [0, '', 'abc', '9999.99', undefined]) {
      const e = eventoAntigo()
      e.outrasReceitas = { bar: 40000, patrocinio: solto }
      const antes = JSON.stringify(computeCenarios(e))
      const depois = JSON.stringify(computeCenarios(migrarEvento(e)))
      expect(depois, `patrocinio solto = ${JSON.stringify(solto)}`).toBe(antes)
    }
  })

  it('zero/vazio/inválido/NEGATIVO não viram item; só o positivo vira (Marco 22/07/2026)', () => {
    // −500 entra aqui agora: a trava do negativo descarta o solto negativo como
    // "não informado", igual ao valor negativo de um item da lista.
    for (const solto of [0, '', 'abc', -500, undefined]) {
      const e = eventoAntigo()
      e.outrasReceitas = { bar: 1, patrocinio: solto }
      expect(migrarEvento(e).patrocinios, `solto = ${JSON.stringify(solto)}`).toEqual([])
    }
    const e = eventoAntigo()
    e.outrasReceitas = { bar: 1, patrocinio: 500 }
    expect(migrarEvento(e).patrocinios[0]).toMatchObject({ valor: 500, estagio: 'confirmado' })
  })

  it('é idempotente: migrar duas vezes = migrar uma vez', () => {
    const uma = migrarEvento(eventoAntigo())
    expect(migrarEvento(uma)).toEqual(uma)
  })

  it('lista existente vence: solto preenchido junto NÃO vira item (conta nunca dobra)', () => {
    const e = eventoAntigo()
    e.patrocinios = [{ id: 'p1', patrocinador: 'Mirante', valor: 3000, estagio: 'confirmado' }]
    // solto 12500.5 continua no evento — backup editado à mão
    const m = migrarEvento(e)
    expect(m.patrocinios).toHaveLength(1)
    expect(m.outrasReceitas.patrocinio).toBe('')
    expect(computeCenario(m, 'realista').patrocinio).toBe(3000)
  })

  it('normaliza itens: estágio inválido vira proposta (não conta), id ausente ganha id', () => {
    const e = eventoAntigo()
    e.patrocinios = [
      { patrocinador: 'X', valor: 1000, estagio: 'FECHADO' },
      'lixo',
      { id: 'ok', patrocinador: 'Y', valor: 2000, estagio: 'recebido' },
    ]
    const m = migrarEvento(e)
    expect(m.patrocinios).toHaveLength(2)
    expect(m.patrocinios[0].estagio).toBe('proposta')
    expect(m.patrocinios[0].id).toBeTruthy()
    expect(m.patrocinios[1]).toMatchObject({ id: 'ok', estagio: 'recebido' })
    expect(computeCenario(m, 'realista').patrocinio).toBe(2000)
    expect(computeCenario(m, 'realista').patrocinioPotencial).toBe(1000)
  })
})

describe('round-trip de backup antigo (formato pré-Sessão O)', () => {
  it('importa, preserva os números e sobrevive a export→import de novo', () => {
    const backupAntigo = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [eventoAntigo()],
      benchmarksCustom: [],
    })
    const antes = JSON.stringify(computeCenarios(eventoAntigo()))
    const store1 = parseBackup(backupAntigo)
    expect(JSON.stringify(computeCenarios(store1.eventos[0]))).toBe(antes)
    // export (mesma forma do exportBackup) → import de novo
    const reexport = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: store1.eventos, benchmarksCustom: [] })
    const store2 = parseBackup(reexport)
    expect(store2.eventos[0]).toEqual(store1.eventos[0])
    expect(JSON.stringify(computeCenarios(store2.eventos[0]))).toBe(antes)
  })
})

describe('export do plano para o Financeiro — publica só o fechado', () => {
  const exportavel = (patrocinios) => ({
    ...eventoComLista(patrocinios),
    tipo: 'Brisa',
    data: '2026-09-01',
  })

  it('linha Patrocínio sai com a soma do fechado; proposta fica fora', () => {
    const r = montarItensPlano(
      exportavel([
        { id: 'p1', patrocinador: 'Mirante', valor: 20000, estagio: 'confirmado' },
        { id: 'p2', patrocinador: 'Patrocinador A', valor: 8000, estagio: 'proposta' },
      ])
    )
    const linha = r.itens.find((i) => i.categoria === 'Patrocínio')
    expect(linha).toBeTruthy()
    expect(linha.valor).toBe(20000)
    expect(linha.descricao).toBe('Patrocínio (fechado)')
  })

  it('só propostas → nenhuma linha de Patrocínio no plano', () => {
    const r = montarItensPlano(
      exportavel([{ id: 'p1', patrocinador: 'Patrocinador A', valor: 8000, estagio: 'proposta' }])
    )
    expect(r.itens.some((i) => i.categoria === 'Patrocínio')).toBe(false)
  })
})

describe('nova edição — patrocínios viram leads (proposta)', () => {
  it('mantém patrocinador e valor, estágio volta a proposta; original não muta', () => {
    const e = eventoComLista([
      { id: 'p1', patrocinador: 'Mirante', valor: 20000, estagio: 'recebido' },
      { id: 'p2', patrocinador: 'Coroado', valor: 5000, estagio: 'confirmado' },
      { id: 'p3', patrocinador: 'Patrocinador A', valor: 8000, estagio: 'proposta' },
    ])
    const congelado = JSON.stringify(e)
    const nova = duplicarNovaEdicao(e)
    expect(nova.patrocinios.map((p) => p.estagio)).toEqual(['proposta', 'proposta', 'proposta'])
    expect(nova.patrocinios.map((p) => p.patrocinador)).toEqual(['Mirante', 'Coroado', 'Patrocinador A'])
    expect(nova.patrocinios.map((p) => p.valor)).toEqual([20000, 5000, 8000])
    // nada somado na receita da nova edição; tudo visível como potencial
    const c = computeCenario(nova, 'realista')
    expect(c.patrocinio).toBe(0)
    expect(c.patrocinioPotencial).toBe(33000)
    expect(JSON.stringify(e)).toBe(congelado)
  })

  it('evento não migrado (número solto) passa intocado — comportamento antigo', () => {
    const e = eventoAntigo()
    const nova = duplicarNovaEdicao(e)
    expect(nova.patrocinios).toBeUndefined()
    expect(nova.outrasReceitas.patrocinio).toBe(12500.5)
  })
})
