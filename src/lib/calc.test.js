import { describe, it, expect } from 'vitest'
import {
  bilheteria,
  loteQtdCenario,
  computeCenario,
  computeCenarios,
  custosPorCategoria,
  contingencia,
  valorConsiderado,
  custosPorStatus,
  veredito,
  ritmoVendas,
  descontoEfetivoPct,
  isTaxaCliente,
  decomposicaoTicket,
} from './calc.js'

const evento = () => ({
  taxaBilheteria: 10,
  contingenciaPct: 10,
  outrasReceitas: { bar: 5000, patrocinio: 1000 },
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 100 },
    { id: 'l2', nome: 'Lote 2', valor: 150, quantidade: 100 },
    { id: 'porta', nome: 'Lote Porta', valor: 200, quantidade: 50, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesia', valor: 0, quantidade: 40 },
  ],
  categorias: [
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { estimado: 10000, realizado: 0 },
        { estimado: 2000, realizado: 2500 },
      ],
    },
    { id: 'equipe', nome: 'Equipe', itens: [{ estimado: 8000 }] },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    // O realista nasce com 100 EXPLÍCITO desde 27/07/2026. Ele sempre foi 100
    // aqui — só que por omissão, apoiado no fallback do calc.js. A decisão B
    // do Marco mudou esse fallback para 90, e sem esta linha todo teste deste
    // arquivo (cupom, repasse da taxa, ticket manual, break-even) mudaria de
    // número por um motivo que não é o assunto dele. Os testes que falam DO
    // PADRÃO passam cfg próprio e não usam esta base.
    realista: { vendaPct: 100 },
    otimista: { custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

describe('receita por lote e taxa da bilheteria', () => {
  it('calcula receita por lote, acumulada, total e ticket médio', () => {
    const lotes = evento().lotes
    const r = bilheteria(lotes, { l1: 100, l2: 100, porta: 0, cort: 40 }, 10)
    expect(r.porLote[0].receita).toBe(10000)
    expect(r.porLote[1].receita).toBe(15000)
    expect(r.porLote[1].acumulada).toBe(25000)
    expect(r.bruta).toBe(25000)
    expect(r.taxa).toBe(2500)
    expect(r.liquida).toBe(22500)
    expect(r.pagos).toBe(200)
    expect(r.cortesias).toBe(40)
    expect(r.publico).toBe(240)
    expect(r.ticketMedio).toBe(125)
    expect(r.ticketMedioLiquido).toBe(112.5)
  })

  it('cashback Tiqueteira de 5% é recebido sobre a receita de ingressos', () => {
    const lotes = evento().lotes
    const r = bilheteria(lotes, { l1: 100, l2: 100, porta: 0, cort: 40 }, 10, 5)
    expect(r.taxa).toBe(2500)
    expect(r.cashback).toBe(1250)
    expect(r.liquida).toBe(23750) // 25000 − 2500 (taxa) + 1250 (cashback recebido)
    expect(r.ticketMedioLiquido).toBe(118.75)
  })

  it('sem cashback informado, desconto é só a taxa (compatível com eventos antigos)', () => {
    const r = bilheteria([{ id: 'a', nome: 'L', valor: 100, quantidade: 10 }], { a: 10 }, 10)
    expect(r.cashback).toBe(0)
    expect(r.liquida).toBe(900)
  })

  it('cortesia (valor 0) entra no público mas não na receita', () => {
    const r = bilheteria([{ id: 'c', nome: 'Cortesia', valor: 0, quantidade: 30 }], { c: 30 }, 10)
    expect(r.bruta).toBe(0)
    expect(r.cortesias).toBe(30)
    expect(r.pagos).toBe(0)
  })
})

// Sugestão 17 — desconto médio nos ingressos. FÓRMULA APROVADA pelo Marco em
// 18/07/2026: receita de bilheteria prevista = (lotes × preço) × (1 − desconto).
// Teste por caso, como manda o MELHORIAS.md: vazio, 0%, 12%, 100%.
describe('desconto médio nos ingressos (sugestão 17 — fórmula aprovada 18/07/2026)', () => {
  it('vazio, ausente e 0% = conta EXATAMENTE igual à anterior', () => {
    const base = computeCenarios(evento())
    expect(computeCenarios({ ...evento(), descontoMedioPct: '' })).toStrictEqual(base)
    expect(computeCenarios({ ...evento(), descontoMedioPct: 0 })).toStrictEqual(base)
    // ausente já é o próprio evento() — reflexivo, mas deixa o caso escrito
    expect(computeCenarios(evento())).toStrictEqual(base)
  })

  it('12%: realista à mão — bruta 25.000 × 0,88 = 22.000; taxa e cashback POR CIMA da descontada', () => {
    const c = computeCenario({ ...evento(), descontoMedioPct: 12 }, 'realista')
    // lotes realista: 100×R$100 + 100×R$150 = 25.000 de tabela → ×0,88 = 22.000
    expect(c.bruta).toBeCloseTo(22000, 10)
    expect(c.taxa).toBeCloseTo(2200, 10) // 10% sobre a receita já descontada
    expect(c.liquida).toBeCloseTo(19800, 10)
    expect(c.ticketMedio).toBeCloseTo(110, 10) // 125 de tabela × 0,88
    expect(c.ticketMedioLiquido).toBeCloseTo(99, 10)
    // desconto age por lote (bruta = Σ porLote continua valendo)
    expect(c.porLote[0].receita).toBeCloseTo(8800, 10) // 100×100×0,88
    expect(c.porLote[1].receita).toBeCloseTo(13200, 10) // 100×150×0,88
    expect(c.porLote.reduce((s, l) => s + l.receita, 0)).toBeCloseTo(c.bruta, 10)
  })

  it('12%: cenários agem por cima — pessimista 70% dos lotes E o desconto', () => {
    const c = computeCenario({ ...evento(), descontoMedioPct: 12 }, 'pessimista')
    // 70×100 + 70×150 = 17.500 de tabela → ×0,88 = 15.400
    expect(c.bruta).toBeCloseTo(15400, 10)
  })

  it('100%: tudo de graça — receita zero, sem quebrar (break-even vira null)', () => {
    const c = computeCenario({ ...evento(), descontoMedioPct: 100 }, 'realista')
    expect(c.bruta).toBe(0)
    expect(c.taxa).toBe(0)
    expect(c.liquida).toBe(0)
    expect(c.ticketMedio).toBe(0)
    expect(c.pagos).toBe(200) // os ingressos continuam contados — só a receita zera
    // custo 22.550 − outras receitas 6.000 = 16.550 a cobrir, sem ticket → null
    expect(c.breakEven).toBeNull()
    expect(c.lucro).toBeCloseTo(6000 - 22550, 10)
  })

  it('break-even fica coerente: com desconto, precisa de MAIS ingressos', () => {
    const sem = computeCenario(evento(), 'realista')
    const com = computeCenario({ ...evento(), descontoMedioPct: 12 }, 'realista')
    // sem: ceil(16.550 / 112,50) = 148 · com: ceil(16.550 / 99) = 168
    expect(sem.breakEven).toBe(148)
    expect(com.breakEven).toBe(168)
  })

  it('ticket médio MANUAL é preço de tabela: recebe o mesmo × (1 − desconto)', () => {
    const ev = evento()
    ev.cenariosConfig = { ...ev.cenariosConfig, realista: { vendaPct: 100, ticketMedio: 100 } }
    const c = computeCenario({ ...ev, descontoMedioPct: 12 }, 'realista')
    // ticket efetivo 100 × 0,88 = 88 · bruta = 200 pagos × 88 = 17.600
    expect(c.ticketMedio).toBeCloseTo(88, 10)
    expect(c.bruta).toBeCloseTo(17600, 10)
    expect(c.taxa).toBeCloseTo(1760, 10)
    // e com desconto vazio, o manual continua exatamente como era
    const semDesconto = computeCenario({ ...ev, descontoMedioPct: '' }, 'realista')
    expect(semDesconto.ticketMedio).toBe(100)
    expect(semDesconto.bruta).toBe(20000)
  })

  it('ajuste % do ticket age por cima do desconto — nunca aplica desconto 2×', () => {
    const ev = evento()
    ev.cenariosConfig = { ...ev.cenariosConfig, realista: { vendaPct: 100, ticketPct: -10 } }
    const c = computeCenario({ ...ev, descontoMedioPct: 12 }, 'realista')
    // automático 125 de tabela → ×0,88 = 110 → ajuste −10% = 99
    expect(c.ticketMedio).toBeCloseTo(99, 10)
    expect(c.bruta).toBeCloseTo(200 * 99, 10)
  })

  it('o REALIZADO não muda: computeCenarios nem lê receitaRealizada', () => {
    const com = { ...evento(), descontoMedioPct: 12, receitaRealizada: { bilheteria: 55000, bar: 8000 } }
    const sem = { ...evento(), descontoMedioPct: 12 }
    expect(computeCenarios(com)).toStrictEqual(computeCenarios(sem))
  })

  it('custos e contingência não são tocados pelo desconto', () => {
    const sem = computeCenario(evento(), 'realista')
    const com = computeCenario({ ...evento(), descontoMedioPct: 12 }, 'realista')
    expect(com.custoItens).toBe(sem.custoItens)
    expect(com.contingencia).toBe(sem.contingencia)
    expect(com.custoTotal).toBe(sem.custoTotal)
  })
})

// Sugestão 29a — desconto parcial em dois modos (Sessão F2-R). CONTA APROVADA
// pelo Marco em 19/07/2026: desconto efetivo = cupom × fração com desconto;
// modo % = fração fixa · modo nº = min(1, nº ÷ vendidos do cenário), POR
// CENÁRIO. Vendidos = pagos (cortesias fora). Pagos do evento() por cenário:
// pessimista 140 · realista 200 · otimista 250 (com o Lote Porta).
describe('desconto parcial em dois modos (sugestão 29a — conta aprovada 19/07/2026)', () => {
  it('descontoEfetivoPct: sem cupom = 0, qualquer que seja a fração', () => {
    expect(descontoEfetivoPct({ descontoMedioPct: '' }, 200)).toBe(0)
    expect(descontoEfetivoPct({ descontoMedioPct: 0, descontoIngressosValor: 40 }, 200)).toBe(0)
    expect(descontoEfetivoPct({}, 200)).toBe(0)
  })

  it('descontoEfetivoPct: campos da fração vazios/ausentes = cupom em todos (campo antigo age como sempre)', () => {
    expect(descontoEfetivoPct({ descontoMedioPct: 10 }, 200)).toBe(10)
    expect(descontoEfetivoPct({ descontoMedioPct: 10, descontoIngressosValor: '' }, 200)).toBe(10)
    expect(
      descontoEfetivoPct(
        { descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: '' },
        200
      )
    ).toBe(10)
    // modo fora do vocabulário cai no modo % (nunca vira nº sozinho)
    expect(
      descontoEfetivoPct(
        { descontoMedioPct: 10, descontoIngressosModo: 'torto', descontoIngressosValor: 40 },
        200
      )
    ).toBe(4)
  })

  it('descontoEfetivoPct modo %: cupom 10 em 40% = 4%; 100% = cupom exato; 0% = 0', () => {
    const ev = (v) => ({ descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: v })
    expect(descontoEfetivoPct(ev(40), 200)).toBe(4)
    expect(descontoEfetivoPct(ev(100), 200)).toBe(10)
    expect(descontoEfetivoPct(ev(0), 200)).toBe(0)
  })

  it('descontoEfetivoPct modo nº: fração = min(1, nº ÷ vendidos); negativo vale 0; sem vendidos = 0', () => {
    const ev = (v) => ({ descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: v })
    expect(descontoEfetivoPct(ev(70), 140)).toBe(5) // 10 × 70/140
    expect(descontoEfetivoPct(ev(500), 140)).toBe(10) // min(1, …) trava no cupom
    expect(descontoEfetivoPct(ev(-30), 140)).toBe(0)
    expect(descontoEfetivoPct(ev(70), 0)).toBe(0) // sem vendidos não há divisão
  })

  // Borda cupom === 1 (H2-D, mutante #7): o early-return é só de `cupom === 0`;
  // com cupom de 1% o efetivo é 1 × fração, NUNCA 0. Fixa a fronteira que o
  // mutante `cupom === 1 → return 0` mordia despercebido. Valores conferidos à mão.
  it('descontoEfetivoPct: cupom de 1% NÃO é zerado (borda cupom === 1)', () => {
    // campos da fração ausentes: efetivo = cupom exato = 1
    expect(descontoEfetivoPct({ descontoMedioPct: 1 }, 200)).toBe(1)
    // modo %, 50%: 1 × 0,5 = 0,5
    expect(
      descontoEfetivoPct(
        { descontoMedioPct: 1, descontoIngressosModo: 'pct', descontoIngressosValor: 50 },
        200
      )
    ).toBe(0.5)
  })

  it('neutralidade byte a byte: campos novos ausentes, vazios ou "modo %, 100%" = conta EXATAMENTE atual', () => {
    const base = computeCenarios(evento())
    expect(
      computeCenarios({ ...evento(), descontoIngressosModo: '', descontoIngressosValor: '' })
    ).toStrictEqual(base)
    expect(
      computeCenarios({ ...evento(), descontoIngressosModo: 'pct', descontoIngressosValor: 100 })
    ).toStrictEqual(base)
    // com desconto legado: cupom 12 + campos novos vazios = cupom 12 puro
    const legado = computeCenarios({ ...evento(), descontoMedioPct: 12 })
    expect(
      computeCenarios({
        ...evento(),
        descontoMedioPct: 12,
        descontoIngressosModo: 'pct',
        descontoIngressosValor: 100,
      })
    ).toStrictEqual(legado)
  })

  it('modo % à mão: cupom 10 em 40% → efetivo 4% — realista bruta 25.000 × 0,96 = 24.000', () => {
    const c = computeCenario(
      { ...evento(), descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 40 },
      'realista'
    )
    expect(c.bruta).toBeCloseTo(24000, 10)
    expect(c.taxa).toBeCloseTo(2400, 10)
    expect(c.porLote[0].receita).toBeCloseTo(9600, 10) // 100×100×0,96
  })

  it('modo nº à mão: 70 ingressos com cupom 10 — a fração muda POR CENÁRIO', () => {
    const ev = {
      ...evento(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 70,
    }
    // pessimista: 70/140 = 50% → efetivo 5% → 17.500 × 0,95 = 16.625
    expect(computeCenario(ev, 'pessimista').bruta).toBeCloseTo(16625, 10)
    // realista: 70/200 = 35% → efetivo 3,5% → 25.000 × 0,965 = 24.125
    expect(computeCenario(ev, 'realista').bruta).toBeCloseTo(24125, 10)
    // otimista: 70/250 = 28% → efetivo 2,8% → 35.000 × 0,972 = 34.020
    expect(computeCenario(ev, 'otimista').bruta).toBeCloseTo(34020, 10)
  })

  it('modo nº: o denominador são os VENDIDOS (pagos) — cortesias ficam fora da conta', () => {
    // realista tem 200 pagos + 40 cortesias. nº = 200 → fração exatamente 1
    // (se o público 240 entrasse no denominador, a fração seria 200/240).
    const c = computeCenarios({
      ...evento(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 200,
    })
    const todos = computeCenarios({ ...evento(), descontoMedioPct: 10 })
    expect(c.realista).toStrictEqual(todos.realista)
  })

  it('modo nº: lote "só otimista" entra nos vendidos SÓ do otimista', () => {
    // nº 210: realista min(1, 210/200) = 1 (efetivo 10%); otimista 210/250 =
    // 84% (efetivo 8,4%) — o Porta só existe lá.
    const ev = {
      ...evento(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 210,
    }
    expect(computeCenario(ev, 'realista').bruta).toBeCloseTo(25000 * 0.9, 10)
    expect(computeCenario(ev, 'otimista').bruta).toBeCloseTo(35000 * 0.916, 10)
  })

  it('equivalência exata entre os modos quando a fração coincide: nº 100 no realista = 50% (o break-even é a ÚNICA exceção, e por um motivo)', () => {
    // realista: 100/200 = 0,5 — a MESMA fração do modo % 50 → byte a byte igual
    const porNumero = computeCenario(
      { ...evento(), descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: 100 },
      'realista'
    )
    const porPct = computeCenario(
      { ...evento(), descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 50 },
      'realista'
    )
    const { breakEven: beNum, ...restoNum } = porNumero
    const { breakEven: bePct, ...restoPct } = porPct
    expect(restoNum).toStrictEqual(restoPct)

    // O BREAK-EVEN DIVERGE, e está certo (Marco, 27/07/2026 — conta nova).
    // A fração só coincide NO CHEIO: são 200 vendidos, e 100 com cupom são
    // metade. O break-even pergunta o que acontece vendendo MENOS, e aí os
    // mesmos 100 cupons pesam mais — no modo nº a fração sobe conforme o
    // público cai, o ticket médio encolhe e faltam mais ingressos. O modo %
    // mantém a metade em qualquer volume. Dois ingressos de diferença.
    expect(bePct).toBe(156)
    expect(beNum).toBe(158)
  })

  it('ticket médio MANUAL recebe o desconto EFETIVO 1× (regra da Sessão N, agora com fração)', () => {
    const ev = evento()
    ev.cenariosConfig = { ...ev.cenariosConfig, realista: { vendaPct: 100, ticketMedio: 100 } }
    const c = computeCenario(
      { ...ev, descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 50 },
      'realista'
    )
    // efetivo 5% → ticket 100 × 0,95 = 95 · bruta = 200 pagos × 95 = 19.000
    expect(c.ticketMedio).toBeCloseTo(95, 10)
    expect(c.bruta).toBeCloseTo(19000, 10)
  })

  it('custos, contingência e realizado seguem intocados pela fração', () => {
    const sem = computeCenario(evento(), 'realista')
    const com = computeCenario(
      { ...evento(), descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 40 },
      'realista'
    )
    expect(com.custoItens).toBe(sem.custoItens)
    expect(com.contingencia).toBe(sem.contingencia)
    expect(com.custoTotal).toBe(sem.custoTotal)
  })
})

// Sugestão 29b — taxa da bilheteria paga pelo CLIENTE (Sessão F2-R; conta
// aprovada pelo Marco em 19/07/2026): no repasse a taxa NÃO desconta da
// receita; o cashback segue INALTERADO nos dois modos. Padrão "paga por nós"
// = conta exatamente atual.
describe('taxa paga pelo cliente (sugestão 29b — conta aprovada 19/07/2026)', () => {
  it('isTaxaCliente é ESTRITO: só a string exata "cliente" liga o repasse', () => {
    expect(isTaxaCliente({ taxaPagaPor: 'cliente' })).toBe(true)
    expect(isTaxaCliente({ taxaPagaPor: 'nos' })).toBe(false)
    expect(isTaxaCliente({ taxaPagaPor: '' })).toBe(false)
    expect(isTaxaCliente({})).toBe(false)
    expect(isTaxaCliente({ taxaPagaPor: 'CLIENTE' })).toBe(false)
    expect(isTaxaCliente({ taxaPagaPor: true })).toBe(false)
    expect(isTaxaCliente({ taxaPagaPor: 1 })).toBe(false)
  })

  it('padrão e valores tortos: conta EXATAMENTE atual, byte a byte', () => {
    const base = computeCenarios(evento())
    expect(computeCenarios({ ...evento(), taxaPagaPor: '' })).toStrictEqual(base)
    expect(computeCenarios({ ...evento(), taxaPagaPor: 'nos' })).toStrictEqual(base)
    expect(computeCenarios({ ...evento(), taxaPagaPor: 'CLIENTE' })).toStrictEqual(base)
    expect(computeCenarios({ ...evento(), taxaPagaPor: true })).toStrictEqual(base)
  })

  it('repasse à mão: a taxa não desconta — realista líquida 25.000 (vs 22.500), break-even cai 148 → 134', () => {
    const c = computeCenario({ ...evento(), taxaPagaPor: 'cliente' }, 'realista')
    expect(c.bruta).toBe(25000)
    expect(c.taxa).toBe(2500) // continua calculada — é o que o cliente paga por fora
    expect(c.liquida).toBe(25000) // sem cashback no evento() → líquida = bruta
    expect(c.ticketMedioLiquido).toBe(125)
    // 27/07/2026 — a conta nova do break-even. A antiga dividia: custo a
    // cobrir 22.550 − 6.000 = 16.550 → ceil(16.550 / 125) = 133. Mas 133 é um
    // número que o slider NÃO alcança: este evento tem dois lotes de 100, e
    // vender X% vende X% de cada um, então a escala anda de dois em dois —
    // 132, 134, 136. Em 132 ainda falta (R$ 22.500 de receita contra R$ 22.550
    // de custo); em 134 fecha. O número exibido passa a ser um número que o
    // Marco consegue de fato atingir arrastando o cenário.
    expect(c.breakEven).toBe(134)
    expect(computeCenario(evento(), 'realista').breakEven).toBe(148)
  })

  it('cashback INALTERADO nos dois modos (regra explícita da sugestão)', () => {
    const nos = computeCenario({ ...evento(), cashbackPct: 5 }, 'realista')
    const cliente = computeCenario({ ...evento(), cashbackPct: 5, taxaPagaPor: 'cliente' }, 'realista')
    expect(cliente.cashback).toBe(nos.cashback) // 1.250 nos dois
    expect(cliente.cashback).toBe(1250)
    // líquida repasse = bruta + cashback (taxa fora): 25.000 + 1.250
    expect(cliente.liquida).toBe(26250)
    expect(nos.liquida).toBe(23750)
  })

  it('ticket médio MANUAL respeita o modo: repasse não desconta a taxa da líquida', () => {
    const ev = evento()
    ev.cenariosConfig = { ...ev.cenariosConfig, realista: { vendaPct: 100, ticketMedio: 100 } }
    const c = computeCenario({ ...ev, taxaPagaPor: 'cliente' }, 'realista')
    expect(c.bruta).toBe(20000) // 200 pagos × 100
    expect(c.taxa).toBe(2000)
    expect(c.liquida).toBe(20000)
    expect(computeCenario(ev, 'realista').liquida).toBe(18000)
  })

  it('desconto (29a) e repasse (29b) compõem: líquida = bruta descontada + cashback', () => {
    const c = computeCenario(
      { ...evento(), cashbackPct: 5, descontoMedioPct: 12, taxaPagaPor: 'cliente' },
      'realista'
    )
    // bruta 25.000 × 0,88 = 22.000; cashback 5% = 1.100; líquida = 23.100
    expect(c.bruta).toBeCloseTo(22000, 10)
    expect(c.cashback).toBeCloseTo(1100, 10)
    expect(c.liquida).toBeCloseTo(23100, 10)
  })

  it('custos e contingência não mudam com o modo da taxa', () => {
    const nos = computeCenario(evento(), 'realista')
    const cliente = computeCenario({ ...evento(), taxaPagaPor: 'cliente' }, 'realista')
    expect(cliente.custoItens).toBe(nos.custoItens)
    expect(cliente.custoTotal).toBe(nos.custoTotal)
  })
})

describe('quantidades por cenário', () => {
  const ev = evento()
  it('realista usa o que foi digitado, sem os lotes só-otimista', () => {
    expect(loteQtdCenario(ev.lotes[0], 'realista', ev.cenariosConfig)).toBe(100)
    expect(loteQtdCenario(ev.lotes[2], 'realista', ev.cenariosConfig)).toBe(0)
    expect(loteQtdCenario(ev.lotes[3], 'realista', ev.cenariosConfig)).toBe(40)
  })
  it('pessimista aplica vendaPct nos pagos e mantém cortesias', () => {
    expect(loteQtdCenario(ev.lotes[0], 'pessimista', ev.cenariosConfig)).toBe(70)
    expect(loteQtdCenario(ev.lotes[3], 'pessimista', ev.cenariosConfig)).toBe(40)
    expect(loteQtdCenario(ev.lotes[2], 'pessimista', ev.cenariosConfig)).toBe(0)
  })
  it('otimista esgota todos os lotes, incluindo o lote porta', () => {
    expect(loteQtdCenario(ev.lotes[2], 'otimista', ev.cenariosConfig)).toBe(50)
  })
  it('realista com % de venda ajustável (sobre o tamanho do lote)', () => {
    const cfg = { realista: { vendaPct: 90 }, overrides: {} }
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'realista', cfg)).toBe(180)
    expect(loteQtdCenario({ id: 'c', valor: 0, quantidade: 40 }, 'realista', cfg)).toBe(40) // cortesia inteira
    expect(
      loteQtdCenario({ id: 'p', valor: 150, quantidade: 50, somenteOtimista: true }, 'realista', cfg)
    ).toBe(0)
  })
  it('sem realista.vendaPct configurado, realista usa 90% (padrão desde 27/07/2026)', () => {
    // DECISÃO B do Marco: era 100 e discordava do botão "Voltar ao padrão",
    // que sempre disse 90. Agora a conta e a tela dizem a mesma coisa.
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'realista', {})).toBe(180)
    // 100 GRAVADO continua valendo 100 — o padrão não reescreve escolha salva.
    expect(
      loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'realista', {
        realista: { vendaPct: 100 },
      })
    ).toBe(200)
  })
  it('sem pessimista.vendaPct configurado, pessimista usa 80% (padrão desde 27/07/2026)', () => {
    // DECISÃO A do Marco, mesma data.
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'pessimista', {})).toBe(160)
  })
  it('override manual vence a regra automática', () => {
    const cfg = { ...ev.cenariosConfig, overrides: { pessimista: { l1: 55 }, realista: {}, otimista: {} } }
    expect(loteQtdCenario(ev.lotes[0], 'pessimista', cfg)).toBe(55)
  })
  it('arredonda o percentual pessimista', () => {
    const cfg = { pessimista: { vendaPct: 70 }, overrides: {} }
    expect(loteQtdCenario({ id: 'x', valor: 50, quantidade: 33 }, 'pessimista', cfg)).toBe(23) // 23,1 → 23
  })
  // Sessão P — sugestão 19 (grade completa, aprovada em 18/07/2026):
  // otimista ganhou vendaPct, MESMA conta dos campos homólogos dos vizinhos.
  it('otimista com % de venda ajustável — conta dos vizinhos, incluindo o lote só-otimista', () => {
    const cfg = { otimista: { vendaPct: 70 }, overrides: {} }
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'otimista', cfg)).toBe(140)
    expect(
      loteQtdCenario({ id: 'p', valor: 150, quantidade: 50, somenteOtimista: true }, 'otimista', cfg)
    ).toBe(35)
    expect(loteQtdCenario({ id: 'c', valor: 0, quantidade: 40 }, 'otimista', cfg)).toBe(40) // cortesia inteira
    expect(loteQtdCenario({ id: 'y', valor: 50, quantidade: 33 }, 'otimista', cfg)).toBe(23) // arredonda igual ao pessimista
  })
  it('otimista sem vendaPct (evento antigo) e com 100 explícito: esgota tudo, conta de sempre', () => {
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'otimista', {})).toBe(200)
    expect(
      loteQtdCenario(
        { id: 'p', valor: 150, quantidade: 50, somenteOtimista: true },
        'otimista',
        { otimista: { vendaPct: 100 } }
      )
    ).toBe(50)
    // 100% preserva até quantidade fracionária CRUA — o caminho byte a byte
    // de sempre (a conta simétrica arredondaria; ver comentário em calc.js).
    expect(loteQtdCenario({ id: 'f', valor: 80, quantidade: 250.5 }, 'otimista', {})).toBe(250.5)
  })
  it('override manual vence a regra também no otimista com vendaPct', () => {
    const cfg = { otimista: { vendaPct: 70 }, overrides: { otimista: { x: 12 } } }
    expect(loteQtdCenario({ id: 'x', valor: 100, quantidade: 200 }, 'otimista', cfg)).toBe(12)
  })
})

describe('custos, valor considerado e contingência', () => {
  it('usa o realizado quando preenchido e maior que zero, senão o estimado', () => {
    expect(valorConsiderado({ estimado: 2000, realizado: 2500 })).toBe(2500)
    expect(valorConsiderado({ estimado: 2000, realizado: 0 })).toBe(2000)
    expect(valorConsiderado({ estimado: 2000, realizado: '' })).toBe(2000)
    expect(valorConsiderado({ estimado: 2000 })).toBe(2000)
  })
  it('subtotais por categoria e totais gerais', () => {
    const c = custosPorCategoria(evento().categorias)
    expect(c.porCategoria[0].estimado).toBe(12000)
    expect(c.porCategoria[0].realizado).toBe(2500)
    expect(c.porCategoria[0].considerado).toBe(12500)
    expect(c.totalEstimado).toBe(20000)
    expect(c.totalConsiderado).toBe(20500)
  })
  it('contingência percentual sobre a base', () => {
    expect(contingencia(20500, 10)).toBe(2050)
  })
})

// 27/07/2026 — A CONTA DE BREAK-EVEN MUDOU (decisão datada do Marco). Este
// bloco testava a função `breakEven({ custoTotal, outrasReceitas,
// ticketMedioLiquido })`, que fazia uma divisão só e FOI REMOVIDA junto com a
// mudança: mantê-la seria deixar uma segunda régua da mesma coisa dentro do
// módulo, e é assim que duas telas passam a discordar. A conta que vale mora
// em `buscaBreakEven`, e a prova completa da definição do Marco ("a quantidade
// MÍNIMA de ingressos para não dar prejuízo") está em breakEven.test.js.
// Aqui ficam as três bordas que este arquivo sempre cobriu.
describe('break-even', () => {
  it('ingressos pagos necessários para o cenário parar de dar prejuízo', () => {
    const c = computeCenario(evento(), 'realista')
    expect(c.breakEven).toBe(148)
    expect(c.breakEvenNaoFecha).toBe(false)
  })

  it('zero quando bar e patrocínio já cobrem o custo sem vender ingresso', () => {
    const ev = { ...evento(), outrasReceitas: { bar: 30000, patrocinio: 1000 } }
    const c = computeCenario(ev, 'realista')
    expect(c.custoTotal).toBeCloseTo(22550) // 31.000 de outras receitas cobrem
    expect(c.breakEven).toBe(0)
    expect(c.breakEvenNaoFecha).toBe(false)
  })

  it('zero também quando as outras receitas cobrem o custo EXATAMENTE (empate no fio)', () => {
    // 22.550 de custo contra 21.550 de bar + 1.000 de patrocínio = empate.
    // O empate NÃO é prejuízo — a regra do Marco é "não dar prejuízo", e lucro
    // zero cabe nela (a mesma leitura do epsilon do veredito, 20/07/2026).
    const ev = { ...evento(), outrasReceitas: { bar: 21550, patrocinio: 1000 } }
    const c = computeCenario(ev, 'realista')
    expect(c.custoTotal).toBeCloseTo(22550)
    expect(c.breakEven).toBe(0)
  })

  it('null + "não fecha" quando nem vendendo tudo o cenário sai do prejuízo', () => {
    const ev = { ...evento(), outrasReceitas: { bar: 0, patrocinio: 0 } }
    // custo 22.550 contra 22.500 de receita líquida com TODOS os ingressos
    const c = computeCenario(ev, 'realista')
    expect(c.pagos).toBe(200) // os dois lotes inteiros
    expect(c.lucro).toBeLessThan(0)
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(true)
  })
})

describe('cenários completos', () => {
  it('realista', () => {
    const c = computeCenario(evento(), 'realista')
    expect(c.bruta).toBe(25000)
    expect(c.receitaTotal).toBe(28500) // 22500 + 5000 + 1000
    expect(c.custoItens).toBe(20500)
    expect(c.contingencia).toBe(2050)
    expect(c.custoTotal).toBeCloseTo(22550)
    expect(c.lucro).toBeCloseTo(5950)
    expect(c.margem).toBeCloseTo((5950 / 28500) * 100)
    expect(c.breakEven).toBe(148)
    expect(c.custoPorPessoa).toBeCloseTo(22550 / 240)
  })
  it('pessimista: 70% dos ingressos e custos +10%', () => {
    const c = computeCenario(evento(), 'pessimista')
    expect(c.pagos).toBe(140)
    expect(c.bruta).toBe(17500)
    expect(c.receitaTotal).toBe(21750) // 15750 + 6000
    expect(c.custoTotal).toBeCloseTo(22550 * 1.1)
    expect(c.lucro).toBeCloseTo(21750 - 24805)
  })
  it('otimista: lotes esgotados + porta e custos −5%', () => {
    const c = computeCenario(evento(), 'otimista')
    expect(c.pagos).toBe(250)
    expect(c.bruta).toBe(35000)
    expect(c.receitaTotal).toBe(37500)
    expect(c.custoTotal).toBeCloseTo(22550 * 0.95)
    expect(c.lucro).toBeCloseTo(37500 - 21422.5)
  })
  // Sessão P — sugestão 19 (grade completa, aprovada em 18/07/2026)
  it('realista com ajuste de custos: mesma conta dos vizinhos; 0 e "" = conta de sempre', () => {
    const com = (v) =>
      computeCenario(
        {
          ...evento(),
          cenariosConfig: { ...evento().cenariosConfig, realista: { vendaPct: 100, custoPct: v } },
        },
        'realista'
      )
    expect(com(10).custoTotal).toBeCloseTo(22550 * 1.1) // idêntico ao pessimista, que sempre usou 10
    expect(com(10).ajustePct).toBe(10)
    expect(com(10).receitaTotal).toBe(28500) // ajuste de custos não toca a receita
    expect(com(0).custoTotal).toBeCloseTo(22550)
    expect(com(0).ajustePct).toBe(0)
    expect(com('').custoTotal).toBeCloseTo(22550) // vazio = neutro, como nos vizinhos
  })
  it('otimista com % de venda no cenário completo: receita cai, ajuste de custos próprio se mantém', () => {
    const c = computeCenario(
      {
        ...evento(),
        cenariosConfig: { ...evento().cenariosConfig, otimista: { custoPct: -5, vendaPct: 70 } },
      },
      'otimista'
    )
    expect(c.pagos).toBe(175) // 70 + 70 + 35 (porta também no percentual)
    expect(c.bruta).toBe(24500) // 70×100 + 70×150 + 35×200
    expect(c.receitaTotal).toBe(28050) // 24500 − 2450 (taxa) + 6000
    expect(c.custoTotal).toBeCloseTo(22550 * 0.95)
  })
  it('realista com cashback Tiqueteira de 5% sobre ingressos', () => {
    const c = computeCenario({ ...evento(), cashbackPct: 5 }, 'realista')
    expect(c.cashback).toBe(1250)
    expect(c.liquida).toBe(23750)
    expect(c.receitaTotal).toBe(29750) // 23750 + 5000 + 1000
    expect(c.breakEven).toBe(140) // ceil((22550 − 6000) / 118,75)
  })
  it('realista com 90% de venda dos lotes', () => {
    const ev = evento()
    ev.cenariosConfig.realista = { vendaPct: 90 }
    const c = computeCenario(ev, 'realista')
    expect(c.pagos).toBe(180) // 90 + 90
    expect(c.cortesias).toBe(40) // cortesia inteira
    expect(c.bruta).toBe(22500) // 90×100 + 90×150
    expect(c.receitaTotal).toBe(26250) // 20250 + 6000
    expect(c.lucro).toBeCloseTo(26250 - 22550)
  })
  it('ticket médio manual: receita vira pagos × ticket, com taxa recalculada', () => {
    const ev = evento()
    ev.cenariosConfig.realista = { vendaPct: 100, ticketMedio: 120 }
    const c = computeCenario(ev, 'realista')
    expect(c.ticketMedioManual).toBe(true)
    expect(c.ticketMedio).toBe(120)
    expect(c.bruta).toBe(24000) // 200 pagos × 120
    expect(c.taxa).toBe(2400)
    expect(c.liquida).toBe(21600)
    expect(c.receitaTotal).toBe(27600)
    expect(c.ticketMedioLiquido).toBe(108)
  })
  it('ticket médio em branco ou zero mantém o automático', () => {
    const ev = evento()
    ev.cenariosConfig.realista = { vendaPct: 100, ticketMedio: '' }
    expect(computeCenario(ev, 'realista').ticketMedioManual).toBeUndefined()
    ev.cenariosConfig.realista = { vendaPct: 100, ticketMedio: 0 }
    expect(computeCenario(ev, 'realista').bruta).toBe(25000)
  })
  it('ajuste percentual do ticket médio sobre o automático', () => {
    const ev = evento()
    ev.cenariosConfig.realista = { vendaPct: 100, ticketPct: -10 }
    const c = computeCenario(ev, 'realista')
    expect(c.ticketMedio).toBeCloseTo(112.5) // 125 × 0,9
    expect(c.bruta).toBeCloseTo(22500) // 200 × 112,5
    expect(c.taxa).toBeCloseTo(2250)
    expect(c.ticketMedioManual).toBe(false)
    expect(c.ticketAjustePct).toBe(-10)
  })
  it('ajuste percentual do ticket sobre o valor manual', () => {
    const ev = evento()
    ev.cenariosConfig.otimista = { ticketMedio: 120, ticketPct: 10, custoPct: -5 }
    const c = computeCenario(ev, 'otimista')
    expect(c.ticketMedio).toBeCloseTo(132) // 120 × 1,1
    expect(c.bruta).toBeCloseTo(250 * 132) // 250 pagos no otimista
    expect(c.ticketMedioManual).toBe(true)
  })
  it('computeCenarios devolve os três', () => {
    const c = computeCenarios(evento())
    expect(c.pessimista.lucro).toBeLessThan(c.realista.lucro)
    expect(c.realista.lucro).toBeLessThan(c.otimista.lucro)
  })
})

describe('veredito (semáforo) — regra do Marco 18/07/2026: realista dá a cor, pessimista rebaixa', () => {
  const cen = (mRealista, lucroPess) => ({
    realista: { margem: mRealista },
    pessimista: { margem: null, lucro: lucroPess },
    otimista: { margem: 40 },
  })

  it('verde: realista ≥ margem alvo e pessimista sem prejuízo', () => {
    const v = veredito(cen(30, 1000))
    expect(v.cor).toBe('verde')
    expect(v.rebaixadoPeloPessimista).toBe(false)
  })
  it('amarelo por faixa: realista entre a mínima e o alvo', () => {
    const v = veredito(cen(24, 1000))
    expect(v.cor).toBe('amarelo')
    expect(v.rebaixadoPeloPessimista).toBe(false)
  })
  it('amarelo por rebaixamento: realista ≥ alvo mas pessimista com prejuízo', () => {
    const v = veredito(cen(30, -500))
    expect(v.cor).toBe('amarelo')
    expect(v.rebaixadoPeloPessimista).toBe(true)
  })
  it('vermelho: realista abaixo da mínima (inclui prejuízo)', () => {
    expect(veredito(cen(19.9, 1000)).cor).toBe('vermelho')
    expect(veredito(cen(-3, -500)).cor).toBe('vermelho')
  })
  it('vermelho quando margem do realista é null (sem receita)', () => {
    expect(veredito(cen(null, 0)).cor).toBe('vermelho')
  })
  it('limites exatos: realista = mínima é amarelo; = alvo (sem prejuízo) é verde', () => {
    expect(veredito(cen(20, 0)).cor).toBe('amarelo')
    expect(veredito(cen(28, 0)).cor).toBe('verde') // lucro pess. 0 não é prejuízo
  })
  it('epsilon de ruído (Marco 20/07/2026): empate exato no fio da navalha NÃO é rebaixado por erro de float', () => {
    // Caso do laudo: pessimista lucro que deveria ser R$ 0 mas o float computa
    // −R$ 0,000000000002 (12.980,000000000002 − 12.980). Sem o epsilon virava
    // amarelo "rebaixado pelo pessimista"; agora é verde (lucro 0 não é prejuízo).
    const v = veredito(cen(30, -1.8e-12))
    expect(v.cor).toBe('verde')
    expect(v.rebaixadoPeloPessimista).toBe(false)
    // margem que empata no alvo por ruído (28 − 3e-14) continua verde
    expect(veredito(cen(28 - 3e-14, 1000)).cor).toBe('verde')
    // margem que empata na mínima por ruído (20 − 3e-14) NÃO cai em vermelho
    expect(veredito(cen(20 - 3e-14, 1000)).cor).toBe('amarelo')
    // prejuízo VERDADEIRO (acima do ruído) segue rebaixando — o epsilon não cega
    expect(veredito(cen(30, -0.01)).rebaixadoPeloPessimista).toBe(true)
  })
  it('campos ausentes/vazios usam os padrões 28/20', () => {
    const v = veredito(cen(28, 1), {})
    expect(v.margemAlvo).toBe(28)
    expect(v.margemMinima).toBe(20)
    expect(veredito(cen(28, 1), { margemAlvo: '', margemMinima: '' }).cor).toBe('verde')
  })
  it('campos preenchidos substituem os padrões (0 explícito vale 0)', () => {
    expect(veredito(cen(10, 1), { margemAlvo: 8, margemMinima: 5 }).cor).toBe('verde')
    expect(veredito(cen(6, 1), { margemAlvo: 8, margemMinima: 5 }).cor).toBe('amarelo')
    expect(veredito(cen(4, 1), { margemAlvo: 8, margemMinima: 5 }).cor).toBe('vermelho')
    expect(veredito(cen(0.5, 1), { margemAlvo: 0, margemMinima: 0 }).cor).toBe('verde')
  })
  it('no evento de teste: realista tem margem ~20,9% → amarelo (abaixo do alvo 28)', () => {
    const c = computeCenarios(evento())
    expect(c.realista.margem).toBeGreaterThan(20)
    expect(c.realista.margem).toBeLessThan(28)
    expect(veredito(c).cor).toBe('amarelo')
  })
})

describe('custosPorStatus', () => {
  it('soma valorConsiderado por status, ORÇAR quando ausente', () => {
    const categorias = [
      {
        id: 'a',
        itens: [
          { estimado: 1000, status: 'PAGO' },
          { estimado: 500, realizado: 800, status: 'PAGO' },
          { estimado: 300, status: 'FECHADO' },
          { estimado: 200, status: 'NEGOCIANDO' },
          { estimado: 100 }, // sem status = ORÇAR
        ],
      },
    ]
    const t = custosPorStatus(categorias)
    expect(t.PAGO).toBe(1800) // 1000 + 800 (realizado vence)
    expect(t.FECHADO).toBe(300)
    expect(t.NEGOCIANDO).toBe(200)
    expect(t['ORÇAR']).toBe(100)
  })
  it('categorias/itens vazios não quebram', () => {
    expect(custosPorStatus([])).toEqual({})
    expect(custosPorStatus(undefined)).toEqual({})
    expect(custosPorStatus([{ id: 'a', itens: [] }])).toEqual({})
  })
})

describe('ritmoVendas (sugestão 10-P) — regra de três contra o break-even', () => {
  const base = { dataEvento: '2026-08-29', breakEven: 500, hoje: '2026-07-18' } // 42 dias

  // ── `diasVenda` no lugar de `semanas`/`porSemana` (Marco, 10/08/2026) ──────
  // As asserções abaixo eram sobre `semanas` (6) e `porSemana` (50). A janela
  // agora sai em DIAS deste módulo, que é a unidade que as quatro telas usam
  // desde 10/08; o ritmo por dia é do `ritmoPorDia` (resumo.js) e tem teste
  // próprio em `ritmoPorDia.test.js`. Nenhum valor de tela mudou — medido nas
  // quatro telas sobre 1.936 combinações, saída idêntica byte a byte.
  it('exemplo da validação: faltam 300 e a janela de venda é de 42 dias', () => {
    const r = ritmoVendas({ ...base, vendidos: 200 })
    expect(r.faltam).toBe(300)
    expect(r.dias).toBe(42)
    expect(r.diasVenda).toBe(42)
    expect(r.cobriu).toBe(false)
    // a janela sai INTEIRA, e é esse o ganho: `42 / 7 * 7` dava 42.00000000000001
    expect(Number.isInteger(r.diasVenda)).toBe(true)
  })
  it('os campos velhos SAÍRAM — ninguém os lia fora deste módulo', () => {
    const r = ritmoVendas({ ...base, vendidos: 200 })
    expect('semanas' in r).toBe(false)
    expect('porSemana' in r).toBe(false)
  })
  it('vendidos ≥ break-even → cobriu, sem número de ritmo', () => {
    const r = ritmoVendas({ ...base, vendidos: 500 })
    expect(r.cobriu).toBe(true)
    expect(r.faltam).toBeUndefined()
  })
  it('break-even 0 (outras receitas cobrem tudo) → cobriu com 0 vendidos', () => {
    expect(ritmoVendas({ ...base, breakEven: 0, vendidos: 0 }).cobriu).toBe(true)
  })
  it('evento no passado → eventoPassado, nunca número absurdo', () => {
    const r = ritmoVendas({ ...base, dataEvento: '2026-07-01', vendidos: 100 })
    expect(r).toEqual({ eventoPassado: true })
  })
  it('festa hoje → janela de venda ZERO; a menos de uma semana ela é só curta', () => {
    // A porta do ritmo deixou de morar aqui em 10/08/2026: a semana final PASSOU
    // a ter ritmo, e quem decide é o `ritmoPorDia` (`diasVenda >= 1`). Este
    // módulo agora só informa a janela — `porSemana: null` não existe mais.
    expect(ritmoVendas({ ...base, dataEvento: '2026-07-18', vendidos: 100 }).diasVenda).toBe(0)
    expect(ritmoVendas({ ...base, dataEvento: '2026-07-22', vendidos: 100 }).diasVenda).toBe(4)
  })
  it('sem dado (campo vazio, sem data, sem break-even) → null, leitura não aparece', () => {
    expect(ritmoVendas({ ...base, vendidos: '' })).toBeNull()
    expect(ritmoVendas({ ...base, vendidos: null })).toBeNull()
    expect(ritmoVendas({ ...base, vendidos: undefined })).toBeNull()
    expect(ritmoVendas({ ...base, vendidos: 100, dataEvento: '' })).toBeNull()
    expect(ritmoVendas({ ...base, vendidos: 100, breakEven: null })).toBeNull()
  })
  it('vendidos 0 é dado válido (diferente de vazio)', () => {
    const r = ritmoVendas({ ...base, vendidos: 0 })
    expect(r.faltam).toBe(500)
    expect(r.diasVenda).toBe(42)
  })
  it('vendidos negativo é tratado como 0', () => {
    expect(ritmoVendas({ ...base, vendidos: -10 }).faltam).toBe(500)
  })
})

describe('ritmoVendas com início de vendas (Sessão F2-S — janela restante real)', () => {
  // festa 29/08, hoje 18/07 → 42 dias; breakEven 500 (o fixture do bloco acima)
  const base = { dataEvento: '2026-08-29', breakEven: 500, hoje: '2026-07-18' }

  it('vendas ainda fechadas: a janela conta do INÍCIO à festa (42 − 28 = 14 dias)', () => {
    // início 15/08 = 28 dias depois de hoje → sobram 14 dias de venda
    const r = ritmoVendas({ ...base, vendidos: 200, inicioVendas: '2026-08-15' })
    expect(r.vendasAbremEm).toBe(28)
    expect(r.diasVenda).toBe(14)
    expect(r.faltam).toBe(300)
    expect(r.dias).toBe(42) // dias até a FESTA não mudam — só a janela de venda
  })

  it('sem o campo (ou vazio) → byte a byte a conta de sempre, SEM a chave nova', () => {
    const sem = ritmoVendas({ ...base, vendidos: 200 })
    expect('vendasAbremEm' in sem).toBe(false)
    expect(ritmoVendas({ ...base, vendidos: 200, inicioVendas: '' })).toEqual(sem)
  })

  it('início já passado (vendas abertas) → conta idêntica à de sempre', () => {
    const sem = ritmoVendas({ ...base, vendidos: 200 })
    expect(ritmoVendas({ ...base, vendidos: 200, inicioVendas: '2026-07-01' })).toEqual(sem)
    expect(ritmoVendas({ ...base, vendidos: 200, inicioVendas: '2026-07-18' })).toEqual(sem)
  })

  it('início a menos de uma semana da festa → janela curta, e ela é declarada', () => {
    const r = ritmoVendas({ ...base, vendidos: 200, inicioVendas: '2026-08-26' })
    expect(r.diasVenda).toBe(3)
    expect(r.vendasAbremEm).toBe(39)
  })

  it('cobriu não muda com o início (já vendeu o que precisava)', () => {
    const sem = ritmoVendas({ ...base, vendidos: 500 })
    expect(ritmoVendas({ ...base, vendidos: 500, inicioVendas: '2026-08-15' })).toEqual(sem)
  })
})

describe('decomposicaoTicket (F2-Y — item 4): reparte o ticket, sem conta nova', () => {
  it('as identidades fecham no bruto e no líquido exibidos (com cupom, paga por nós)', () => {
    const s = computeCenario({ ...evento(), descontoMedioPct: 12 }, 'realista')
    const d = decomposicaoTicket(s, { ...evento(), descontoMedioPct: 12 })
    // tabela − cupom = bruto (bruto = o ticketMedio já exibido)
    expect(d.bruto).toBeCloseTo(s.ticketMedio, 10)
    expect(d.tabela - d.cupom).toBeCloseTo(s.ticketMedio, 10)
    // bruto − taxa + cashback = líquido (bil.liquida ÷ pagos)
    expect(d.liquido).toBeCloseTo(s.ticketMedioLiquido, 10)
    expect(d.bruto - d.taxaPorIng + d.cashbackPorIng).toBeCloseTo(s.ticketMedioLiquido, 10)
    expect(d.temCupom).toBe(true)
  })

  it('sem cupom: tabela = bruto e cupom = 0', () => {
    const s = computeCenario(evento(), 'realista')
    const d = decomposicaoTicket(s, evento())
    expect(d.temCupom).toBe(false)
    expect(d.tabela).toBeCloseTo(d.bruto, 10)
    expect(d.cupom).toBeCloseTo(0, 10)
  })

  it('taxa paga pelo cliente: a parcela da taxa por ingresso zera', () => {
    const ev = { ...evento(), taxaPagaPor: 'cliente' }
    const d = decomposicaoTicket(computeCenario(ev, 'realista'), ev)
    expect(d.taxaCliente).toBe(true)
    expect(d.taxaPorIng).toBe(0)
  })

  it('sem ingresso pago → null (não há "por ingresso")', () => {
    expect(decomposicaoTicket({ pagos: 0 }, evento())).toBeNull()
    expect(decomposicaoTicket(null, evento())).toBeNull()
  })
})

// Teste-de-matar da rodada de mutação de 21/07/2026 (H3-L item 3): o
// sobrevivente calc.js:34 (round→floor) era buraco REAL de rede na classe
// que historicamente mais escapa aqui — fronteira de arredondamento. Nada
// pinava o meio-ingresso do otimista. FALHA sob a mutação: provado aplicando
// round→floor à mão num worktree (1 falha, cirúrgica); a bateria oficial lê
// o HEAD, então o placar 37/3 aparece na rodada pós-commit.
// ————— o IRMÃO do teste de baixo (Marco, 07/08/2026) —————
//
// `loteQtdCenario` tem DUAS linhas de arredondamento idênticas, uma por ramo: a
// do otimista e a de pessimista/realista, oito linhas abaixo. O teste de
// 21/07/2026 pinou só a primeira. Medido em 25/07: trocar `Math.round` por
// `Math.floor` na SEGUNDA passava pela suíte inteira sem uma verificação
// vermelha — meio ingresso a menos por lote que caia na fronteira, nos dois
// cenários que decidem se a festa acontece, com a tela sem dizer nada.
//
// A FÓRMULA NÃO MUDA: `Math.round` é o comportamento aprovado e `calc.js` está
// atrás do portão do golden. O que faltava era o pino.
//
// Nota de manutenção: com o pessimista em 80% (decisão A do Marco, 27/07/2026) a
// conta do PADRÃO nunca cai no meio — `q × 0,8` não produz fração `,5` para
// nenhum inteiro. Por isso a fronteira do pessimista é exercitada com `vendaPct`
// explícito, e o realista com o padrão dele, que cai.
describe('loteQtdCenario — fronteira do arredondamento no pessimista e no realista', () => {
  const lote = (quantidade) => ({ id: 'l1', nome: 'Lote 1', valor: 80, quantidade })

  it('realista no PADRÃO (90%): 25 → 22,5 arredonda para CIMA, 23 (floor daria 22)', () => {
    expect(loteQtdCenario(lote(25), 'realista', {})).toBe(23)
    expect(loteQtdCenario(lote(5), 'realista', {})).toBe(5) // 4,5 → 5
  })

  it('pessimista com vendaPct explícito: 25×70% = 17,5 → 18, e 10×25% = 2,5 → 3', () => {
    expect(loteQtdCenario(lote(25), 'pessimista', { pessimista: { vendaPct: 70 } })).toBe(18)
    expect(loteQtdCenario(lote(10), 'pessimista', { pessimista: { vendaPct: 25 } })).toBe(3)
  })

  it('realista com vendaPct explícito também: 25×90% = 22,5 → 23', () => {
    expect(loteQtdCenario(lote(25), 'realista', { realista: { vendaPct: 90 } })).toBe(23)
  })

  // O que a troca custaria em dinheiro, escrito como asserção para o número não
  // virar comentário: no lote de R$ 80, um ingresso a menos é R$ 80 de
  // bilheteria bruta a menos, por lote que caia na fronteira.
  it('a fronteira vale dinheiro: 23 × R$ 80 = R$ 1.840, não R$ 1.760', () => {
    const q = loteQtdCenario(lote(25), 'realista', {})
    expect(q * 80).toBe(1840)
  })
})

describe('loteQtdCenario — fronteira do arredondamento no otimista', () => {
  it('meio ingresso arredonda para CIMA (Math.round, não floor): 25×90% = 22,5 → 23', () => {
    const lote = { id: 'l1', nome: 'Lote 1', valor: 80, quantidade: 25 }
    expect(loteQtdCenario(lote, 'otimista', { otimista: { vendaPct: 90 } })).toBe(23)
    // Segunda fronteira, mais crua: 10×25% = 2,5 → 3 (floor daria 2).
    expect(
      loteQtdCenario({ ...lote, quantidade: 10 }, 'otimista', { otimista: { vendaPct: 25 } })
    ).toBe(3)
  })
})
