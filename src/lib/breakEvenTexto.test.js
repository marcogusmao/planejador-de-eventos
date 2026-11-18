// Como o break-even é ESCRITO — o teste do módulo que as cinco superfícies
// usam. O que este arquivo defende, em uma frase: quando não existe meta, a
// tela DIZ que não existe, em português de leigo; nunca um traço (que quer
// dizer "não sei") e nunca um número (que seria mentira).

import { describe, it, expect } from 'vitest'
import {
  BREAK_EVEN_NAO_FECHA,
  BREAK_EVEN_QUANTIDADE_TRAVADA,
  textoBreakEven,
  fraseBreakEvenDoCenario,
  temQuantidadeTravada,
  avisoBreakEven,
} from './breakEvenTexto.js'
import { computeCenario, computeCenarios } from './calc.js'
import { novoLote } from './defaults.js'
import { eventoTravado } from '../../scripts/provas-s0/cenarios.fixture.js'
import { NUMERO_NAO_CALCULA, cenarioQuebrado, receitaDoCenarioQuebrada } from './dadoQuebrado.js'
import { resumoCurto } from './resumo.js'
import { legendasRelatorio } from './premissaTexto.js'

describe('o valor do break-even na tela', () => {
  it('com meta, imprime o número com o sufixo que a tela pediu', () => {
    expect(textoBreakEven({ breakEven: 1234 })).toBe('1.234')
    expect(textoBreakEven({ breakEven: 1234 }, ' ingressos pagos')).toBe('1.234 ingressos pagos')
    expect(textoBreakEven({ breakEven: 851 }, ' pagos')).toBe('851 pagos')
  })

  it('sem meta, diz que não fecha — e o sufixo não entra no meio da frase', () => {
    const s = { breakEven: null, breakEvenNaoFecha: true }
    expect(textoBreakEven(s)).toBe('não fecha nem vendendo tudo')
    expect(textoBreakEven(s, ' ingressos pagos')).toBe('não fecha nem vendendo tudo')
    expect(textoBreakEven(s, ' pagos')).toBe(BREAK_EVEN_NAO_FECHA)
  })

  it('zero é um número de verdade e é impresso como tal — não é "sem informação"', () => {
    expect(textoBreakEven({ breakEven: 0, breakEvenNaoFecha: false }, ' pagos')).toBe('0 pagos')
  })

  it('o traço fica só para o que realmente não dá para calcular', () => {
    expect(textoBreakEven({ breakEven: null, breakEvenNaoFecha: false })).toBe('—')
    expect(textoBreakEven(null)).toBe('—')
    expect(textoBreakEven(undefined)).toBe('—')
  })
})

describe('a frase de posição embaixo do cartão do cenário', () => {
  it('coberto: diz quantos contra quantos, com tom de ok', () => {
    expect(fraseBreakEvenDoCenario({ pagos: 900, breakEven: 733 })).toEqual({
      tom: 'ok',
      texto: 'break-even coberto neste cenário (900 ≥ 733)',
    })
  })

  it('faltando: diz quantos ingressos faltam, com tom de alerta', () => {
    expect(fraseBreakEvenDoCenario({ pagos: 700, breakEven: 913 })).toEqual({
      tom: 'alerta',
      texto: 'faltam 213 ingressos para o break-even',
    })
  })

  it('sem meta: a frase é sobre o prejuízo, não sobre quantos faltam', () => {
    const fr = fraseBreakEvenDoCenario({ pagos: 700, breakEven: null, breakEvenNaoFecha: true })
    expect(fr.tom).toBe('alerta')
    expect(fr.texto).toBe('nem vendendo todos os ingressos este cenário sai do prejuízo')
    // e nunca aparece um número de ingressos que faltam — não existe esse número
    expect(fr.texto).not.toMatch(/\d/)
  })

  it('sem ingresso pago e sem aviso: não há frase nenhuma', () => {
    expect(fraseBreakEvenDoCenario({ pagos: 0, breakEven: 100 })).toBeNull()
    expect(fraseBreakEvenDoCenario({ pagos: 500, breakEven: null })).toBeNull()
  })
})

// ------------------------------------------------- as pontas, de verdade

// Um evento que não fecha nem vendendo tudo: custo alto, um lote só.
const NAO_FECHA = () => ({
  nome: 'Festa que não fecha',
  data: '2026-11-22',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 8000, patrocinio: 0 },
  lotes: [{ id: 'l1', nome: 'Lote único', valor: 50, quantidade: 200 }],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 17300 }] }],
  // O argumento deste evento é "não fecha NEM VENDENDO TUDO", então o realista
  // precisa vender o lote inteiro. Isso vinha do fallback antigo do calc (100);
  // desde 27/07/2026 o padrão é 90 (decisão B do Marco), e o 100 passa a ser
  // dito aqui, explícito, para o argumento continuar sendo o mesmo.
  cenariosConfig: { realista: { vendaPct: 100 } },
})

describe('as pontas que o Marco lê, com um evento que não fecha', () => {
  it('o cenário realmente não fecha — é a premissa das asserções abaixo', () => {
    const c = computeCenario(NAO_FECHA(), 'realista')
    expect(c.pagos).toBe(200) // o lote inteiro
    expect(c.lucro).toBeLessThan(0)
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(true)
  })

  it('"Copiar resumo" do WhatsApp diz que não fecha, em vez de mandar um traço', () => {
    const txt = resumoCurto(NAO_FECHA())
    expect(txt).toContain(BREAK_EVEN_NAO_FECHA)
    expect(txt).not.toContain('break-even —')
  })

  it('a legenda "Como ler este relatório" explica em vez de prometer uma meta', () => {
    const c = computeCenario(NAO_FECHA(), 'realista')
    const legendas = Object.fromEntries(legendasRelatorio(NAO_FECHA(), c))
    const be = legendas['Break-even (BE)']
    expect(be).toContain('não existe esse número')
    expect(be).toContain('nem vendendo todos os ingressos')
    // e não promete "Neste evento: N ingressos pagos"
    expect(be).not.toMatch(/Neste evento: [\d.]+ ingressos pagos/)
  })
})

// ===========================================================================
// S6 — quantidade travada à mão (decisão do Marco, 05/09/2026; plano de
// 06/10/2026). Onde o cenário tem lote com quantidade ajustada no "Ajuste
// manual por lote", a tela publica a frase da trava no lugar do mínimo de
// ingressos. A fixture é a histórica da S0 (`eventoTravado`): três lotes
// 400/600/200, custo e preços sintéticos; sem trava o mínimo realista é 568.
// Cada caso monta uma CÓPIA nova (o resumo guarda cache por identidade).
// ===========================================================================

const FRASE = 'quantidade travada à mão neste cenário'

/** `eventoTravado` com o mapa de overrides do realista trocado pelo do caso. */
const comRealista = (mapa, ajuste) => {
  const e = eventoTravado()
  e.cenariosConfig.overrides.realista = mapa
  if (ajuste) ajuste(e)
  return e
}
/** Sem nenhum ajuste: o mínimo realista de referência é 568. */
const semTrava = () => comRealista({})

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}

describe('S6 — o texto da trava é o aprovado, palavra por palavra', () => {
  it('a constante exportada é a frase do Marco', () => {
    expect(BREAK_EVEN_QUANTIDADE_TRAVADA).toBe(FRASE)
  })
})

describe('S6 — detector temQuantidadeTravada: uma linha por situação, três cenários cada', () => {
  // [nome, evento, { pessimista, realista, otimista }]
  const T = true
  const F = false
  const casos = [
    ['cheio 400/600/200', () => comRealista({ l1: 400, l2: 600, l3: 200 }), [F, T, F]],
    ['baixo 100/100/20', () => comRealista({ l1: 100, l2: 100, l3: 20 }), [F, T, F]],
    ['zero numérico num lote só', () => comRealista({ l1: 0 }), [F, T, F]],
    ["'0' em texto", () => comRealista({ l1: '0' }), [F, T, F]],
    ["'' (campo esvaziado)", () => comRealista({ l1: '' }), [F, F, F]],
    ['null', () => comRealista({ l1: null }), [F, F, F]],
    ['undefined explícito', () => comRealista({ l1: undefined }), [F, F, F]],
    ['cenariosConfig ausente', () => comRealista({}, (e) => { delete e.cenariosConfig }), [F, F, F]],
    ['overrides ausente', () => comRealista({}, (e) => { e.cenariosConfig = {} }), [F, F, F]],
    ['mapa do cenário ausente', () => comRealista({}, (e) => { delete e.cenariosConfig.overrides.realista }), [F, F, F]],
    ['mapa vazio', () => semTrava(), [F, F, F]],
    ['chave órfã: ID que não é de nenhum lote, =100', () => comRealista({ removido: 100 }), [F, F, F]],
    [
      'lote removido depois do ajuste (a chave sobra no mapa)',
      () => comRealista({ l1: 100 }, (e) => { e.lotes = e.lotes.filter((l) => l.id !== 'l1') }),
      [F, F, F],
    ],
    [
      'lote removido, mas outro lote ainda tem ajuste',
      () => comRealista({ l1: 100, l2: 600 }, (e) => { e.lotes = e.lotes.filter((l) => l.id !== 'l1') }),
      [F, T, F],
    ],
    ['override IGUAL à quantidade automática (360 = 90% de 400)', () => comRealista({ l1: 360 }), [F, T, F]],
    [
      'lote só-otimista com ajuste no realista',
      () => comRealista({ l2: 50 }, (e) => { e.lotes[1].somenteOtimista = true }),
      [F, T, F],
    ],
    [
      'lote só-otimista SEM ajuste',
      () => comRealista({}, (e) => { e.lotes[1].somenteOtimista = true }),
      [F, F, F],
    ],
    [
      'cortesia com quantidade ajustada à mão',
      () => comRealista({ c: 10 }, (e) => { e.lotes.push(novoLote({ id: 'c', nome: 'Cortesias', valor: 0, quantidade: 50 })) }),
      [F, T, F],
    ],
    [
      'cortesia automática, sem ajuste',
      () => comRealista({}, (e) => { e.lotes.push(novoLote({ id: 'c', nome: 'Cortesias', valor: 0, quantidade: 50 })) }),
      [F, F, F],
    ],
    [
      'trava só no pessimista',
      () => comRealista({}, (e) => { e.cenariosConfig.overrides.pessimista = { l1: 100 } }),
      [T, F, F],
    ],
    [
      'trava só no otimista',
      () => comRealista({}, (e) => { e.cenariosConfig.overrides.otimista = { l3: 20 } }),
      [F, F, T],
    ],
    [
      'travas nos três, cada uma no seu mapa',
      () => comRealista({ l1: 1 }, (e) => {
        e.cenariosConfig.overrides.pessimista = { l2: 2 }
        e.cenariosConfig.overrides.otimista = { l3: 3 }
      }),
      [T, T, T],
    ],
  ]
  it.each(casos)('%s', (_nome, monta, [pess, real, otim]) => {
    const e = monta()
    expect(temQuantidadeTravada(e, 'pessimista')).toBe(pess)
    expect(temQuantidadeTravada(e, 'realista')).toBe(real)
    expect(temQuantidadeTravada(e, 'otimista')).toBe(otim)
  })

  it('evento ausente, sem lotes e cenário desconhecido nunca acusam trava (e não estouram)', () => {
    expect(temQuantidadeTravada(null, 'realista')).toBe(false)
    expect(temQuantidadeTravada(undefined, 'realista')).toBe(false)
    expect(temQuantidadeTravada({}, 'realista')).toBe(false)
    const e = comRealista({ l1: 100 }, (x) => { x.lotes = undefined })
    expect(temQuantidadeTravada(e, 'realista')).toBe(false)
    expect(temQuantidadeTravada(comRealista({ l1: 100 }), 'inexistente')).toBe(false)
    expect(temQuantidadeTravada(comRealista({ l1: 100 }))).toBe(false)
  })

  it('o detector é só presença: vale mesmo quando o ajuste repete a quantidade automática', () => {
    // 360 = o automático (90% de 400). O lote continua TRAVADO — a regra é a
    // do cálculo, que olha o campo e não compara valores — e o mínimo deixa
    // de acompanhar o slider (609, e não os 568 de quando o lote é livre).
    // É o motivo de a tela não poder imprimir esse número como meta.
    const igual = computeCenarios(comRealista({ l1: 360 })).realista
    const sem = computeCenarios(semTrava()).realista
    expect(igual.pagos).toBe(sem.pagos)
    expect(sem.breakEven).toBe(568)
    expect(igual.breakEven).toBe(609)
    expect(temQuantidadeTravada(comRealista({ l1: 360 }), 'realista')).toBe(true)
  })
})

describe('S6 — a referência medida: o detector e o cálculo concordam sobre o que está travado', () => {
  it('sem trava o mínimo realista é 568; só l1=0 → 523; cortesia extra com ajuste c=10 → 564; trava só no pessimista → realista 568', () => {
    expect(computeCenarios(semTrava()).realista.breakEven).toBe(568)
    expect(computeCenarios(comRealista({ l1: 0 })).realista.breakEven).toBe(523)
    const cortesia = comRealista({ c: 10 }, (e) => {
      e.lotes.push(novoLote({ id: 'c', nome: 'Cortesias', valor: 0, quantidade: 50 }))
    })
    expect(computeCenarios(cortesia).realista.breakEven).toBe(564)
    const soPess = comRealista({}, (e) => { e.cenariosConfig.overrides.pessimista = { l1: 100 } })
    expect(computeCenarios(soPess).realista.breakEven).toBe(568)
  })
})

describe('S6 — texto exato nas três funções, caso a caso', () => {
  const lidos = (e) => {
    const c = computeCenarios(e)
    return {
      c,
      aviso: avisoBreakEven(e, c.realista, c),
      curto: textoBreakEven(c.realista, '', e, c),
      cartao: textoBreakEven(c.realista, ' ingressos pagos', e, c),
      apresentacao: textoBreakEven(c.realista, ' pagos', e, c),
      frase: fraseBreakEvenDoCenario(c.realista, e, c),
    }
  }

  it.each([
    ['cheio 400/600/200', { l1: 400, l2: 600, l3: 200 }],
    ['baixo 100/100/20', { l1: 100, l2: 100, l3: 20 }],
    ['zero num lote só', { l1: 0 }],
    ["'0' em texto", { l1: '0' }],
    ['igual ao automático', { l1: 360 }],
  ])('%s: o sufixo some e a frase do cartão é o aviso, com tom de alerta', (_n, mapa) => {
    const r = lidos(comRealista(mapa))
    expect(r.aviso).toBe(FRASE)
    expect(r.curto).toBe(FRASE)
    expect(r.cartao).toBe(FRASE)
    expect(r.apresentacao).toBe(FRASE)
    expect(r.frase).toEqual({ tom: 'alerta', texto: FRASE })
  })

  it('cheio: o cálculo dá 1.200 pagos e mínimo 1.200 — e nenhum dos dois é impresso como meta', () => {
    const { c, cartao, frase } = lidos(comRealista({ l1: 400, l2: 600, l3: 200 }))
    expect(c.realista.pagos).toBe(1200)
    expect(c.realista.breakEven).toBe(1200)
    expect(cartao).not.toMatch(/1\.200/)
    expect(frase.texto).not.toMatch(/\d/)
  })

  it('100/100/20: o cálculo diz "não fecha" (mínimo nulo) e a tela NÃO diz isso — diz a trava', () => {
    const { c, curto, cartao, frase } = lidos(comRealista({ l1: 100, l2: 100, l3: 20 }))
    expect(c.realista.pagos).toBe(220)
    expect(c.realista.breakEven).toBeNull()
    expect(c.realista.breakEvenNaoFecha).toBe(true)
    expect(curto).toBe(FRASE)
    expect(cartao).not.toContain(BREAK_EVEN_NAO_FECHA)
    expect(frase.texto).toBe(FRASE)
    expect(frase.texto).not.toContain('sai do prejuízo')
  })

  it('só l1=0: o mínimo calculado (523) não aparece em nenhuma das três funções', () => {
    const { c, curto, cartao, apresentacao, frase } = lidos(comRealista({ l1: 0 }))
    expect(c.realista.breakEven).toBe(523)
    for (const t of [curto, cartao, apresentacao, frase.texto]) expect(t).not.toContain('523')
  })

  it('cortesia com ajuste manual (c=10): trava; cortesia automática: continua numérico', () => {
    const adiciona = (e) => { e.lotes.push(novoLote({ id: 'c', nome: 'Cortesias', valor: 0, quantidade: 50 })) }
    expect(lidos(comRealista({ c: 10 }, adiciona)).cartao).toBe(FRASE)
    const auto = lidos(comRealista({}, adiciona))
    expect(auto.c.realista.breakEven).not.toBeNull()
    expect(auto.cartao).toBe(`${auto.c.realista.breakEven.toLocaleString('pt-BR')} ingressos pagos`)
  })

  it('sem trava (vazio, null, ausente, órfã): texto numérico IDÊNTICO ao de antes', () => {
    for (const mapa of [{}, { l1: '' }, { l1: null }, { l1: undefined }, { removido: 100 }]) {
      const r = lidos(comRealista(mapa))
      expect(r.aviso).toBeNull()
      expect(r.curto).toBe('568')
      expect(r.cartao).toBe('568 ingressos pagos')
      expect(r.apresentacao).toBe('568 pagos')
      expect(r.frase.texto).toMatch(/^faltam \d+ ingressos para o break-even$|^break-even coberto/)
      expect(r.frase.texto).toBe(fraseBreakEvenDoCenario(r.c.realista).texto) // a chamada antiga dá a mesma frase
    }
    const semConfig = comRealista({}, (e) => { delete e.cenariosConfig })
    expect(textoBreakEven(computeCenarios(semConfig).realista, '', semConfig, computeCenarios(semConfig))).toMatch(/^\d/)
  })

  it('trava só no pessimista: a coluna realista continua numérica, a pessimista diz a frase', () => {
    const e = comRealista({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const c = computeCenarios(e)
    expect(textoBreakEven(c.realista, ' pagos', e, c)).toBe('568 pagos')
    expect(textoBreakEven(c.pessimista, ' pagos', e, c)).toBe(FRASE)
    expect(textoBreakEven(c.otimista, ' pagos', e, c)).toMatch(/^\d[\d.]* pagos$/)
    expect(avisoBreakEven(e, c.realista, c)).toBeNull()
    expect(avisoBreakEven(e, c.pessimista, c)).toBe(FRASE)
    expect(fraseBreakEvenDoCenario(c.realista, e, c)).toEqual({ tom: 'ok', texto: 'break-even coberto neste cenário (1.080 ≥ 568)' })
    expect(fraseBreakEvenDoCenario(c.pessimista, e, c)).toEqual({ tom: 'alerta', texto: FRASE })
  })

  it('o cartão olha o cenário que recebe, não o realista: cada coluna tem a sua trava', () => {
    const e = comRealista({}, (x) => { x.cenariosConfig.overrides.otimista = { l3: 20 } })
    const c = computeCenarios(e)
    expect(textoBreakEven(c.otimista, '', e, c)).toBe(FRASE)
    expect(textoBreakEven(c.realista, '', e, c)).toBe('568')
    expect(textoBreakEven(c.pessimista, '', e, c)).not.toBe(FRASE)
  })
})

describe('S6 — precedência: dado inválido (#98) > trava > não fecha > número/traço', () => {
  const travado = () => comRealista({ l1: 100, l2: 100, l3: 20 })

  it('1. custo estimado 1e308 + trava: as guardas acusam ANTES, e a notícia é "não dá para calcular"', () => {
    const e = travado()
    e.categorias.find((cat) => cat.id === 'aeb').itens[0].estimado = 1e308
    const c = computeCenarios(e)
    // controle: a guarda existente enxerga o defeito neste cenário
    expect(cenarioQuebrado(e, c.realista, c)).toBe(true)
    expect(temQuantidadeTravada(e, 'realista')).toBe(true)
    expect(avisoBreakEven(e, c.realista, c)).toBe(NUMERO_NAO_CALCULA)
    expect(textoBreakEven(c.realista, ' pagos', e, c)).toBe(NUMERO_NAO_CALCULA)
    expect(textoBreakEven(c.realista, '', e, c)).not.toContain(FRASE)
    // sem frase de posição: a faixa do campo quebrado é quem explica
    expect(fraseBreakEvenDoCenario(c.realista, e, c)).toBeNull()
  })

  it('1b. ticket de bar realista 1e308 + trava: a RECEITA acusa e a notícia é a mesma', () => {
    const e = travado()
    e.barTicket.realista = 1e308
    const c = computeCenarios(e)
    expect(receitaDoCenarioQuebrada(e, c.realista, c)).toBe(true)
    expect(avisoBreakEven(e, c.realista, c)).toBe(NUMERO_NAO_CALCULA)
    expect(textoBreakEven(c.realista, '', e, c)).toBe(NUMERO_NAO_CALCULA)
    expect(fraseBreakEvenDoCenario(c.realista, e, c)).toBeNull()
  })

  it('1c. ticket de bar do OTIMISTA 1e308 + realista travado: cada cenário diz o seu, ninguém contamina ninguém', () => {
    const e = comRealista({ l1: 400, l2: 600, l3: 200 })
    e.barTicket.otimista = 1e308
    const c = computeCenarios(e)
    expect(receitaDoCenarioQuebrada(e, c.otimista, c)).toBe(true) // controle: o otimista acusa
    expect(cenarioQuebrado(e, c.realista, c) || receitaDoCenarioQuebrada(e, c.realista, c)).toBe(false)
    expect(avisoBreakEven(e, c.realista, c)).toBe(FRASE)
    expect(avisoBreakEven(e, c.otimista, c)).toBe(NUMERO_NAO_CALCULA)
    expect(fraseBreakEvenDoCenario(c.realista, e, c)).toEqual({ tom: 'alerta', texto: FRASE })
  })

  it('1d. a soma que não cabe em OUTRO cenário (lote de R$ 1e306): só a visão dos três enxerga, e a notícia é "não dá para calcular"', () => {
    const e = comRealista({ l1: 1 }, (x) => { x.lotes[0].valor = 1e306 })
    const c = computeCenarios(e)
    // controle: o realista, sozinho, cabe; com os três cenários, as guardas acusam
    expect(cenarioQuebrado(e, c.realista)).toBe(false)
    expect(cenarioQuebrado(e, c.realista, c)).toBe(true)
    expect(avisoBreakEven(e, c.realista, c)).toBe(NUMERO_NAO_CALCULA)
    expect(textoBreakEven(c.realista, '', e, c)).toBe(NUMERO_NAO_CALCULA)
    expect(fraseBreakEvenDoCenario(c.realista, e, c)).toBeNull()
    // sem os três cenários a função não tem como saber — por isso as telas passam `c`
    expect(avisoBreakEven(e, c.realista)).toBe(FRASE)
  })

  it('2. trava > "não fecha": o cenário que não fecha COM ajuste não promete nem nega meta', () => {
    const e = travado()
    const c = computeCenarios(e)
    expect(c.realista.breakEvenNaoFecha).toBe(true) // controle: o cálculo diz "não fecha"
    expect(textoBreakEven(c.realista, '', e, c)).toBe(FRASE)
    expect(textoBreakEven(c.realista, '', e, c)).not.toBe(BREAK_EVEN_NAO_FECHA)
    // a MESMA conta sem ajuste, na chamada antiga (sem evento), continua dizendo "não fecha"
    expect(textoBreakEven(c.realista)).toBe(BREAK_EVEN_NAO_FECHA)
    expect(fraseBreakEvenDoCenario(c.realista).texto).toBe('nem vendendo todos os ingressos este cenário sai do prejuízo')
  })

  it('3. sem trava, "não fecha" segue valendo — mesmo passando o evento e os cenários', () => {
    const e = {
      nome: 'Festa que não fecha',
      data: '2026-11-22',
      taxaBilheteria: 10,
      cashbackPct: 5,
      contingenciaPct: 10,
      outrasReceitas: { bar: 8000, patrocinio: 0 },
      lotes: [{ id: 'l1', nome: 'Lote único', valor: 50, quantidade: 200 }],
      categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 17300 }] }],
      cenariosConfig: { realista: { vendaPct: 100 } },
    }
    const c = computeCenarios(e)
    expect(c.realista.breakEvenNaoFecha).toBe(true)
    expect(textoBreakEven(c.realista, ' pagos', e, c)).toBe(BREAK_EVEN_NAO_FECHA)
    expect(fraseBreakEvenDoCenario(c.realista, e, c).texto).toBe('nem vendendo todos os ingressos este cenário sai do prejuízo')
  })

  it('4. sem trava e sem meta: número, e o traço só quando não há como calcular', () => {
    const e = semTrava()
    const c = computeCenarios(e)
    expect(textoBreakEven(c.realista, ' pagos', e, c)).toBe('568 pagos')
    expect(textoBreakEven({ breakEven: null, breakEvenNaoFecha: false, cenario: 'realista' }, '', e, c)).toBe('—')
    expect(textoBreakEven({ breakEven: 0, breakEvenNaoFecha: false, cenario: 'realista' }, ' pagos', e, c)).toBe('0 pagos')
  })

  it('cenário ausente: aviso nulo, texto traço, sem estourar', () => {
    const e = travado()
    expect(avisoBreakEven(e, null, undefined)).toBeNull()
    expect(avisoBreakEven(e, undefined, {})).toBeNull()
    expect(textoBreakEven(undefined, '', e)).toBe('—')
    expect(fraseBreakEvenDoCenario(null, e)).toBeNull()
  })

  it('sem evento (chamada antiga): a trava nunca é lida, qualquer que seja o cenário', () => {
    const c = computeCenarios(travado())
    expect(avisoBreakEven(null, c.realista, c)).toBeNull()
    expect(avisoBreakEven(undefined, c.realista)).toBeNull()
    expect(textoBreakEven(c.realista, ' pagos')).toBe(BREAK_EVEN_NAO_FECHA)
    expect(textoBreakEven(c.realista, ' pagos', null, c)).toBe(BREAK_EVEN_NAO_FECHA)
  })

  it('cenarios omitido com evento presente: a trava vale e as guardas rodam sem a visão dos três', () => {
    const e = travado()
    const c = computeCenarios(e)
    expect(avisoBreakEven(e, c.realista)).toBe(FRASE)
    expect(textoBreakEven(c.realista, '', e)).toBe(FRASE)
    expect(fraseBreakEvenDoCenario(c.realista, e).texto).toBe(FRASE)
  })
})

describe('S6 — leitura pura: nada do evento nem dos cenários muda', () => {
  it('evento e cenários congelados em profundidade atravessam as três funções e o detector', () => {
    const e = deepFreeze(comRealista({ l1: 100, l2: 100, l3: 20 }, (x) => {
      x.cenariosConfig.overrides.pessimista = { l1: 1 }
    }))
    const c = deepFreeze(computeCenarios(e))
    const eAntes = structuredClone(e)
    const cAntes = structuredClone(c)
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(() => {
        temQuantidadeTravada(e, k)
        avisoBreakEven(e, c[k], c)
        textoBreakEven(c[k], ' pagos', e, c)
        fraseBreakEvenDoCenario(c[k], e, c)
      }).not.toThrow()
    }
    expect(e).toEqual(eAntes)
    expect(c).toEqual(cAntes)
    expect(computeCenarios(e)).toEqual(cAntes)
    expect(Object.isFrozen(e.cenariosConfig.overrides.realista)).toBe(true)
  })

  it('a leitura não deixa chave de apresentação no evento nem nos cenários', () => {
    const chaves = (o, acc = new Set()) => {
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { acc.add(k); chaves(v, acc) }
      return acc
    }
    const e = deepFreeze(comRealista({ l1: 100 }))
    const c = deepFreeze(computeCenarios(e))
    const antes = [...chaves(e), ...chaves(c)].sort()
    textoBreakEven(c.realista, '', e, c)
    fraseBreakEvenDoCenario(c.realista, e, c)
    expect([...chaves(e), ...chaves(c)].sort()).toEqual(antes)
    expect(antes.filter((k) => /travad|aviso/i.test(k))).toEqual([])
  })
})
