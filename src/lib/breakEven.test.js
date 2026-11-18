// BREAK-EVEN — a prova da definição do Marco (27/07/2026).
//
// Palavra por palavra: o break-even é "a quantidade MÍNIMA de ingressos que eu
// preciso vender para não dar prejuízo".
//
// Uma definição de MÍNIMO só está provada por duas asserções juntas, e é isso
// que este arquivo cobra em todo evento que monta:
//
//   1. no número exibido, o lucro é >= 0;
//   2. no degrau IMEDIATAMENTE ABAIXO dele, o lucro é < 0.
//
// Sem a segunda, qualquer número grande o bastante passaria — inclusive o
// número inteiro de ingressos do evento. Sem a primeira, qualquer número
// pequeno. As duas juntas cravam o mínimo.
//
// "Degrau" é a palavra certa e não é detalhe: a alavanca do app é o `vendaPct`
// do cenário, e vender X% é vender X% de CADA lote. Num evento com dois lotes
// de 100, a escala anda de dois em dois — 132, 134, 136 —, e o break-even tem
// de ser um número que essa alavanca ALCANÇA. É a mesma alavanca que o Marco
// arrasta na tela até o lucro zerar; se o break-even usasse outra régua, ele e
// o slider mostrariam duas verdades no mesmo cartão.
//
// AS FERRAMENTAS INDEPENDENTES, ambas pelo caminho PÚBLICO (`computeCenario`,
// o mesmo que a tela chama) — nenhuma delas olha o código da busca:
//   · `degrauAbaixoDoSlider` acha, por bissecção, o degrau imediatamente
//     abaixo de um ponto — é o "um a menos" da definição;
//   · `escadaExaustiva` monta a escada INTEIRA de um evento pequeno, com passo
//     provadamente menor que o menor degrau possível — é a régua completa,
//     que só cabe num evento pequeno.

import { describe, it, expect } from 'vitest'
import { computeCenario, computeCenarios, buscaBreakEven, ritmoVendas } from './calc.js'

const CENARIOS = ['pessimista', 'realista', 'otimista']

// Empate no fio da navalha: a mesma tolerância de ruído de ponto flutuante que
// o cálculo usa (calc.js) e que o veredito já usava desde 20/07/2026.
const EPS = 1e-9

// ---------------------------------------------------------------- as festas

const custos = (v) => [
  { id: 'atracoes', nome: 'Atrações', itens: [{ servico: 'DJ', estimado: v.dj }] },
  { id: 'estrutura', nome: 'Estrutura', itens: [{ servico: 'Som e luz', estimado: v.estrutura }] },
  { id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: v.aeb }] },
  { id: 'equipe', nome: 'Equipe', itens: [{ servico: 'Staff', estimado: v.equipe }] },
]

const CONFIG = {
  pessimista: { vendaPct: 70, custoPct: 10 },
  realista: { vendaPct: 90 },
  otimista: { custoPct: -5 },
}

/** Bar FIXO — o lucro de bar é um valor digitado, igual nos três cenários.
 *  Aqui NÃO existe a circularidade: o número quase não muda com a conta nova. */
const BRISA_BAR_FIXO = () => ({
  nome: 'Brisa 14/03 (bar fixo)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  barModo: 'fixo',
  outrasReceitas: { bar: 12000, patrocinio: 3000 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 60, quantidade: 300 },
    { id: 'l2', nome: '2º lote', valor: 80, quantidade: 400 },
    { id: 'l3', nome: '3º lote', valor: 100, quantidade: 300 },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 60 },
  ],
  categorias: custos({ dj: 18000, estrutura: 14000, aeb: 9000, equipe: 11000 }),
  cenariosConfig: { ...CONFIG },
})

/** OPEN BAR — receita de bar zero em qualquer modo. Também sem circularidade. */
const MARFIM_OPEN_BAR = () => ({
  nome: 'Marfim Alto (open bar)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  openBar: true,
  outrasReceitas: { bar: 12000, patrocinio: 9000 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 120, quantidade: 200 },
    { id: 'l2', nome: '2º lote', valor: 160, quantidade: 250 },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 40 },
  ],
  categorias: custos({ dj: 9000, estrutura: 7000, aeb: 16000, equipe: 6000 }),
  cenariosConfig: { ...CONFIG },
})

/** Bar POR PESSOA — o caso que derrubou a conta antiga. O bar depende do
 *  público, e a conta antiga abatia do custo o bar da casa CHEIA antes de
 *  perguntar quantos ingressos faltavam para encher a casa. */
const SOBRADO_BAR_POR_PESSOA = () => ({
  nome: 'Sobrado (bar por pessoa)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  barModo: 'porPessoa',
  barTicket: { pessimista: 70, realista: 85, otimista: 100 },
  barTaxaSistemaPct: 4,
  barCustoSistema: 900,
  outrasReceitas: { bar: 0, patrocinio: 2000 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 50, quantidade: 500 },
    { id: 'l2', nome: '2º lote', valor: 70, quantidade: 600 },
    { id: 'l3', nome: '3º lote', valor: 90, quantidade: 400 },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 100 },
  ],
  categorias: custos({ dj: 26000, estrutura: 30000, aeb: 42000, equipe: 24000 }),
  cenariosConfig: { ...CONFIG },
})

// ------------------------------------------------- a régua independente

const comVenda = (evento, cenario, pct) => ({
  ...evento,
  cenariosConfig: {
    ...(evento.cenariosConfig || {}),
    [cenario]: { ...(evento.cenariosConfig?.[cenario] || {}), vendaPct: pct },
  },
})

/** Um ponto do slider, pelo caminho público. */
const noSlider = (evento, cenario, pct) => computeCenario(comVenda(evento, cenario, pct), cenario)

/**
 * O DEGRAU IMEDIATAMENTE ABAIXO de um ponto do slider — achado por bissecção,
 * sem grade e sem adivinhar resolução.
 *
 * (E POR QUE NÃO UMA GRADE: a primeira versão deste arquivo varria o slider
 * com passo fixo, e ela ERRAVA. Dois lotes de tamanhos diferentes criam
 * janelas de percentual estreitíssimas — no Brisa, o degrau de 519 ingressos
 * vive numa faixa de 0,042 ponto percentual, e uma grade de 0,0625 passava por
 * cima dele. A grade dizia "o mínimo é 520" e a busca dizia 519; quem estava
 * certo era a busca. O limite inferior da largura de uma janela é
 * 50/(q1·q2) pontos percentuais, ou seja, some conforme os lotes crescem —
 * grade não serve de régua aqui, bissecção serve.)
 *
 * A quantidade de ingressos é monótona no slider (cada lote é
 * `round(q × pct/100)`, que nunca desce quando o pct sobe), então a bissecção
 * é exata: ela encontra a fronteira entre "tem `alvo` ingressos ou mais" e
 * "tem menos", e devolve o ponto logo abaixo dela.
 */
function degrauAbaixoDoSlider(evento, cenario, pctDoEmpate, alvo) {
  let alto = pctDoEmpate
  let baixo = 0
  if (noSlider(evento, cenario, 0).pagos >= alvo) return null // não há degrau abaixo
  for (let i = 0; i < 80; i++) {
    const meio = (alto + baixo) / 2
    if (noSlider(evento, cenario, meio).pagos >= alvo) alto = meio
    else baixo = meio
  }
  return noSlider(evento, cenario, baixo)
}

/**
 * AS ASSERÇÕES QUE DEFINEM A RÉGUA, para um evento e um cenário:
 *
 *  (1) existe um ponto do slider com exatamente `breakEven` ingressos pagos e
 *      lucro >= 0 — recalculado pelo caminho PÚBLICO, não pelo que a busca diz;
 *  (2) no degrau imediatamente abaixo, o lucro é < 0;
 *  (3) e, pela régua grossa que o próprio Marco usa arrastando o slider de 1
 *      em 1 ponto, nenhum percentual INTEIRO menor fecha.
 */
function provaDaRegra(evento, cenario) {
  const c = computeCenario(evento, cenario)
  const busca = buscaBreakEven(evento, cenario)

  if (c.breakEvenNaoFecha) {
    expect(c.breakEven).toBeNull()
    // nenhum ponto inteiro do slider fecha — nem o de 100%
    for (let pct = 0; pct <= 100; pct++) {
      expect(noSlider(evento, cenario, pct).lucro).toBeLessThan(0)
    }
    return { c }
  }

  // (1) no break-even, o lucro é >= 0
  const empate = noSlider(evento, cenario, busca.vendaPct)
  expect(empate.pagos).toBe(c.breakEven)
  expect(empate.lucro).toBeGreaterThanOrEqual(-EPS)

  // (2) um degrau abaixo, é prejuízo
  const abaixo = degrauAbaixoDoSlider(evento, cenario, busca.vendaPct, c.breakEven)
  if (c.breakEven > 0) {
    expect(abaixo).not.toBeNull()
    expect(abaixo.pagos).toBeLessThan(c.breakEven)
    expect(abaixo.lucro).toBeLessThan(0)
  }

  // (3) e nenhum ponto inteiro do slider abaixo do empate fecha
  for (let pct = 0; pct < Math.floor(busca.vendaPct); pct++) {
    expect(noSlider(evento, cenario, pct).lucro).toBeLessThan(0)
  }
  return { c, empate, abaixo }
}

/**
 * Para eventos PEQUENOS: a varredura EXAUSTIVA, com passo justificado.
 * Dois degraus distintos do slider nunca ficam a menos de 50/(q1·q2) pontos
 * percentuais um do outro (a conta sai de |(2k1−1)q2 − (2k2−1)q1| >= 1); com
 * lotes de 20 e 30 isso dá 0,083 ponto, e o passo abaixo é metade disso.
 * Nenhum ponto alcançável escapa — é a régua completa, e ela só cabe num
 * evento pequeno.
 */
function escadaExaustiva(evento, cenario) {
  const qs = (evento.lotes || []).map((l) => Number(l.quantidade) || 0).filter((q) => q > 0)
  const maiores = [...qs].sort((a, b) => b - a)
  const passo = 25 / ((maiores[0] || 1) * (maiores[1] || maiores[0] || 1))
  const porPagos = new Map()
  for (let pct = 0; pct <= 100 + 1e-12; pct += passo) {
    const s = noSlider(evento, cenario, Math.min(100, pct))
    const antes = porPagos.get(s.pagos)
    if (antes === undefined || s.lucro > antes) porPagos.set(s.pagos, s.lucro)
  }
  return [...porPagos.entries()]
    .map(([pagos, lucro]) => ({ pagos, lucro }))
    .sort((a, b) => a.pagos - b.pagos)
}

/** A conta ANTIGA, reimplementada AQUI (e só aqui) para medir a diferença.
 *  Não existe mais em calc.js de propósito: duas réguas da mesma coisa dentro
 *  do módulo é como duas telas passam a discordar. */
const contaAntiga = (s) => {
  const aCobrir = s.custoTotal - (s.bar + s.patrocinio)
  if (aCobrir <= 0) return 0
  if (s.ticketMedioLiquido <= 0) return null
  return Math.ceil(aCobrir / s.ticketMedioLiquido)
}

/** Quantos ingressos pagos o cenário tem para vender, vendendo TUDO. */
const ingressosDaCasa = (evento, cenario) =>
  computeCenario(comVenda(evento, cenario, 100), cenario).pagos

// ---------------------------------------------------------------- a régua

describe('a definição do Marco: o MÍNIMO de ingressos para não dar prejuízo', () => {
  for (const [nome, fabrica] of [
    ['Brisa — bar fixo', BRISA_BAR_FIXO],
    ['Marfim — open bar', MARFIM_OPEN_BAR],
    ['Sobrado — bar por pessoa', SOBRADO_BAR_POR_PESSOA],
  ]) {
    for (const k of CENARIOS) {
      it(`${nome} · ${k}: no break-even o lucro é >= 0, e um degrau abaixo é < 0`, () => {
        provaDaRegra(fabrica(), k)
      })
    }
  }

  it('vale também com override por lote, ticket manual e ajuste de custos ligados ao mesmo tempo', () => {
    const ev = BRISA_BAR_FIXO()
    ev.cenariosConfig = {
      ...ev.cenariosConfig,
      realista: { vendaPct: 90, custoPct: 7, ticketMedio: 95, ticketPct: -4 },
      overrides: { pessimista: {}, realista: { l3: 210 }, otimista: {} },
    }
    const { c } = provaDaRegra(ev, 'realista')
    // o resto do cenário continua exatamente o que estava configurado — a
    // busca só mexe no quanto se vende
    expect(c.ajustePct).toBe(7)
    expect(c.ticketMedioManual).toBe(true)
    expect(c.ticketAjustePct).toBe(-4)
  })

  it('vale com desconto de cupom no modo nº, em que a fração muda conforme o público', () => {
    const ev = {
      ...SOBRADO_BAR_POR_PESSOA(),
      descontoMedioPct: 15,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 300,
    }
    provaDaRegra(ev, 'realista')
  })

  it('vale com a taxa da bilheteria repassada ao cliente', () => {
    provaDaRegra({ ...BRISA_BAR_FIXO(), taxaPagaPor: 'cliente' }, 'realista')
  })
})

// -------------------------------------------- a régua completa, sem atalho

/** Festinha de 50 ingressos — pequena de propósito: com lotes de 20 e 30 dá
 *  para varrer TODOS os pontos do slider e conferir a escada inteira. */
const FESTINHA = () => ({
  nome: 'Festinha (50 ingressos, bar por pessoa)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  barModo: 'porPessoa',
  barTicket: { pessimista: 40, realista: 55, otimista: 70 },
  barTaxaSistemaPct: 5,
  barCustoSistema: 300,
  outrasReceitas: { bar: 0, patrocinio: 500 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 60, quantidade: 20 },
    { id: 'l2', nome: '2º lote', valor: 90, quantidade: 30 },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 5 },
  ],
  categorias: custos({ dj: 1500, estrutura: 900, aeb: 700, equipe: 600 }),
  cenariosConfig: { ...CONFIG },
})

describe('a escada INTEIRA de um evento pequeno: nenhum degrau escapa', () => {
  for (const k of CENARIOS) {
    it(`${k}: o break-even é o MENOR degrau da escada que fecha, e o de baixo dá prejuízo`, () => {
      const ev = FESTINHA()
      const c = computeCenario(ev, k)
      const escada = escadaExaustiva(ev, k)
      // a escada cobre de 0 até a casa cheia
      expect(escada[0].pagos).toBe(0)
      expect(escada[escada.length - 1].pagos).toBe(50)

      const fecham = escada.filter((d) => d.lucro >= -EPS)
      expect(fecham.length).toBeGreaterThan(0)
      expect(c.breakEven).toBe(fecham[0].pagos)
      expect(fecham[0].lucro).toBeGreaterThanOrEqual(-EPS)

      // TODO degrau abaixo do break-even dá prejuízo — não só o de baixo
      for (const d of escada.filter((x) => x.pagos < c.breakEven)) {
        expect(d.lucro).toBeLessThan(0)
      }
    })
  }

  it('os três números da Festinha, fotografados', () => {
    const c = computeCenarios(FESTINHA())
    expect([c.pessimista.breakEven, c.realista.breakEven, c.otimista.breakEven]).toEqual([37, 29, 24])
  })
})

// ------------------------------------------------------------- não fecha

describe('quando não existe meta: "não fecha nem vendendo tudo"', () => {
  // O mesmo Sobrado, com o custo que o time levantou de verdade depois do
  // orçamento fechado. Não sai do prejuízo nem esgotando os três lotes.
  const impossivel = () => ({
    ...SOBRADO_BAR_POR_PESSOA(),
    barModo: 'fixo',
    outrasReceitas: { bar: 6000, patrocinio: 2000 },
    categorias: custos({ dj: 60000, estrutura: 55000, aeb: 70000, equipe: 40000 }),
  })

  it('devolve null e liga a marcação — nos três cenários', () => {
    const c = computeCenarios(impossivel())
    for (const k of CENARIOS) {
      expect(c[k].breakEvenNaoFecha).toBe(true)
      expect(c[k].breakEven).toBeNull()
      // e é verdade: nem com 100% de cada lote o lucro chega a zero
      const cheio = computeCenario(comVenda(impossivel(), k, 100), k)
      expect(cheio.lucro).toBeLessThan(0)
    }
  })

  it('a escada inteira do slider é de prejuízo — nenhum ponto fecha', () => {
    provaDaRegra(impossivel(), 'realista')
  })

  it('A META IMPOSSÍVEL: a conta antiga imprimia mais ingressos do que a festa tem para vender', () => {
    const ev = impossivel()
    for (const k of CENARIOS) {
      const antiga = contaAntiga(computeCenario(ev, k))
      const cabem = ingressosDaCasa(ev, k)
      expect(cabem).toBe(1500)
      // é este o defeito: um número maior que a casa inteira, impresso como meta
      expect(antiga).toBeGreaterThan(cabem)
      expect(computeCenario(ev, k).breakEven).toBeNull()
    }
  })

  it('sobre LIXO não se afirma: quantidade estourada de backup editado à mão vira traço, não "não fecha"', () => {
    // É o caso que custosPorCategoria já nomeia: 1e308 no estimado de um item,
    // vindo de backup editado à mão (o teto para dinheiro na fronteira do
    // backup ainda está em aberto). O custo do cenário estoura o número, o
    // lucro deixa de ser um valor de verdade, e nenhum ponto do slider fecha —
    // mas "não fecha nem vendendo tudo" é uma AFIRMAÇÃO, e não dá para afirmar
    // nada sobre isto.
    const ev = {
      taxaBilheteria: 0,
      contingenciaPct: 0,
      outrasReceitas: { bar: 0, patrocinio: 0 },
      lotes: [{ id: 'l1', nome: 'Lote', valor: 100, quantidade: 500 }],
      categorias: [
        { id: 'a', nome: 'A', itens: [{ servico: 'Absurdo', estimado: 1e308 }] },
        { id: 'b', nome: 'B', itens: [{ servico: 'Absurdo', estimado: 1e308 }] },
      ],
      cenariosConfig: { ...CONFIG, realista: { vendaPct: 100, custoPct: 0 } },
    }
    const c = computeCenario(ev, 'realista')
    expect(Number.isFinite(c.custoTotal)).toBe(false) // o absurdo continua gritando
    expect(Number.isFinite(c.lucro)).toBe(false)
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(false) // traço = "não sei", nunca a afirmação
  })

  it('e o contrário: quando todos os pontos dão um lucro de VERDADE e nenhum fecha, aí sim afirma', () => {
    const ev = {
      taxaBilheteria: 0,
      contingenciaPct: 0,
      outrasReceitas: { bar: 0, patrocinio: 0 },
      lotes: [{ id: 'l1', nome: 'Lote', valor: 10, quantidade: 100 }],
      categorias: [{ id: 'a', nome: 'A', itens: [{ estimado: 5000 }] }],
      cenariosConfig: { ...CONFIG, realista: { vendaPct: 100, custoPct: 0 } },
    }
    const c = computeCenario(ev, 'realista')
    expect(c.lucro).toBe(-4000) // 100 × R$ 10 contra R$ 5.000 de custo
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(true)
  })

  it('um evento sem lote nenhum: se o custo não está coberto, não fecha', () => {
    const ev = {
      taxaBilheteria: 10,
      contingenciaPct: 0,
      outrasReceitas: { bar: 1000, patrocinio: 0 },
      lotes: [],
      categorias: [{ id: 'a', nome: 'A', itens: [{ estimado: 5000 }] }],
      cenariosConfig: { ...CONFIG },
    }
    const c = computeCenario(ev, 'realista')
    expect(c.breakEven).toBeNull()
    expect(c.breakEvenNaoFecha).toBe(true)
  })
})

// ------------------------------------------------------- custo já coberto

describe('quando o custo já está coberto sem vender ingresso: zero', () => {
  it('bar e patrocínio maiores que o custo → 0, e não é "não fecha"', () => {
    const ev = {
      ...BRISA_BAR_FIXO(),
      outrasReceitas: { bar: 60000, patrocinio: 20000 },
    }
    const c = computeCenario(ev, 'realista')
    expect(c.custoTotal).toBeLessThan(80000)
    expect(c.breakEven).toBe(0)
    expect(c.breakEvenNaoFecha).toBe(false)
  })

  it('empate exato no zero conta como coberto — lucro zero não é prejuízo', () => {
    // custo dos itens 8.000, contingência 0, ajuste 0 → custo total 8.000,
    // patrocínio 8.000. Sem vender nada, o lucro é exatamente R$ 0.
    const ev = {
      taxaBilheteria: 0,
      contingenciaPct: 0,
      outrasReceitas: { bar: 0, patrocinio: 8000 },
      lotes: [{ id: 'l1', nome: 'Lote', valor: 100, quantidade: 100 }],
      categorias: [{ id: 'a', nome: 'A', itens: [{ estimado: 8000 }] }],
      cenariosConfig: { ...CONFIG, realista: { vendaPct: 100, custoPct: 0 } },
    }
    const semVender = computeCenario(comVenda(ev, 'realista', 0), 'realista')
    expect(semVender.pagos).toBe(0)
    expect(semVender.lucro).toBe(0)
    expect(computeCenario(ev, 'realista').breakEven).toBe(0)
  })
})

// --------------------------------------- bar fixo e open bar quase não mudam

describe('bar FIXO e OPEN BAR: sem circularidade, o número praticamente não muda', () => {
  it('Brisa (bar fixo): a conta nova fica a no máximo 5 ingressos da antiga, nos três cenários', () => {
    const ev = BRISA_BAR_FIXO()
    const deltas = CENARIOS.map((k) => computeCenario(ev, k).breakEven - contaAntiga(computeCenario(ev, k)))
    expect(deltas).toEqual([0, 0, 1]) // pessimista · realista · otimista
    for (const d of deltas) expect(Math.abs(d)).toBeLessThanOrEqual(5)
  })

  it('Marfim (open bar): idêntico à conta antiga nos três cenários', () => {
    const ev = MARFIM_OPEN_BAR()
    for (const k of CENARIOS) {
      const c = computeCenario(ev, k)
      expect(c.breakEven).toBe(contaAntiga(c))
    }
    expect(CENARIOS.map((k) => computeCenario(ev, k).breakEven)).toEqual([274, 243, 228])
  })

  it('e continuam coerentes: cada um desses números passa nas duas asserções da régua', () => {
    for (const k of CENARIOS) {
      provaDaRegra(BRISA_BAR_FIXO(), k)
      provaDaRegra(MARFIM_OPEN_BAR(), k)
    }
  })
})

// ---------------------------------------------- o bar por pessoa: o motivo

describe('bar POR PESSOA: a circularidade que derrubou a conta antiga', () => {
  it('o Sobrado realista: a conta antiga pedia 227 ingressos; o mínimo verdadeiro é 851', () => {
    const ev = SOBRADO_BAR_POR_PESSOA()
    const c = computeCenario(ev, 'realista')
    expect(contaAntiga(c)).toBe(227)
    expect(c.breakEven).toBe(851)
    // e o 851 é mínimo de verdade: com 850 dá prejuízo
    const { abaixo } = provaDaRegra(ev, 'realista')
    expect(abaixo.pagos).toBe(850)
    expect(abaixo.lucro).toBeLessThan(0)
  })

  it('o otimista era pior: a conta antiga dizia ZERO — "nem precisa vender ingresso"', () => {
    const ev = SOBRADO_BAR_POR_PESSOA()
    const c = computeCenario(ev, 'otimista')
    expect(contaAntiga(c)).toBe(0)
    expect(c.breakEven).toBe(725)
    // o "zero" da conta antiga é falso na cara: sem vender nada dá prejuízo
    const semVender = computeCenario(comVenda(ev, 'otimista', 0), 'otimista')
    expect(semVender.pagos).toBe(0)
    expect(semVender.lucro).toBeLessThan(0)
  })

  it('POR QUE errava: a conta antiga abatia do custo o bar da casa CHEIA', () => {
    const ev = SOBRADO_BAR_POR_PESSOA()
    const cheio = computeCenario(ev, 'realista')
    const noBreakEven = computeCenario(
      comVenda(ev, 'realista', buscaBreakEven(ev, 'realista').vendaPct),
      'realista'
    )
    // o bar que a conta antiga já dava por recebido (casa cheia do cenário)...
    expect(Math.round(cheio.bar)).toBe(117420)
    // ...contra o bar que existe de verdade no ponto de empate
    expect(Math.round(noBreakEven.bar)).toBe(76702)
    // R$ 40.718 de receita contada antes de existir — é ela que fazia a conta
    // antiga pedir 227 ingressos onde o mínimo verdadeiro é 851
    expect(Math.round(cheio.bar - noBreakEven.bar)).toBe(40718)
  })
})

// ---------------------------------------------- a mesma régua do slider

describe('o break-even e o slider contam a MESMA história', () => {
  it('arrastar o cenário até o break-even zera o lucro — é a definição, verificada na tela', () => {
    for (const fabrica of [BRISA_BAR_FIXO, MARFIM_OPEN_BAR, SOBRADO_BAR_POR_PESSOA]) {
      for (const k of CENARIOS) {
        const ev = fabrica()
        const busca = buscaBreakEven(ev, k)
        const noPonto = computeCenario(comVenda(ev, k, busca.vendaPct), k)
        expect(noPonto.pagos).toBe(computeCenario(ev, k).breakEven)
        expect(noPonto.lucro).toBeGreaterThanOrEqual(-EPS)
        // e o lucro no ponto é rente ao zero, não "muito acima": é empate, não folga
        expect(noPonto.lucro).toBeLessThan(1000)
      }
    }
  })

  it('a régua de vender menos é a do app — X% de CADA lote, nunca "enche o mais barato primeiro"', () => {
    // Se a busca enchesse o lote barato primeiro, o break-even de um evento com
    // lotes de preços muito diferentes cairia (mais ingressos baratos cabem no
    // mesmo dinheiro? não — sobe, porque cada ingresso rende menos). O que
    // importa aqui é que o número bate com a proporção do slider: no ponto de
    // empate, cada lote está no MESMO percentual.
    const ev = BRISA_BAR_FIXO()
    const pct = buscaBreakEven(ev, 'realista').vendaPct
    const s = computeCenario(comVenda(ev, 'realista', pct), 'realista')
    const porId = Object.fromEntries(s.porLote.map((l) => [l.id, l.qtd]))
    expect(porId.l1).toBe(Math.round((300 * pct) / 100))
    expect(porId.l2).toBe(Math.round((400 * pct) / 100))
    expect(porId.l3).toBe(Math.round((300 * pct) / 100))
    expect(porId.cort).toBe(60) // cortesia entra inteira, como em todo cenário
  })
})

// ------------------------------------------------------- recursão e custo

describe('a busca não morde o próprio rabo', () => {
  it('computeCenario devolve número em vez de estourar a pilha', () => {
    // computeCenario chama a busca, e a busca recalcula o cenário. Se a busca
    // chamasse computeCenario de volta (em vez do núcleo interno), a chamada
    // seria infinita e isto viraria um RangeError de pilha — não um número.
    const c = computeCenarios(SOBRADO_BAR_POR_PESSOA())
    for (const k of CENARIOS) expect(Number.isFinite(c[k].breakEven)).toBe(true)
  })

  it('nenhum outro número do cenário mudou de valor por causa da busca', () => {
    const ev = SOBRADO_BAR_POR_PESSOA()
    const c = computeCenario(ev, 'realista')
    // as parcelas do cenário continuam as do cenário CONFIGURADO (90% de
    // venda), não as do ponto de empate que a busca visitou
    expect(c.pagos).toBe(1350)
    expect(c.publico).toBe(1450)
    expect(Math.round(c.receitaTotal)).toBe(207485)
    expect(Math.round(c.custoTotal)).toBe(134200)
    expect(Math.round(c.lucro)).toBe(73285)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // UMA CONSEQUÊNCIA QUE PRECISA DO OLHO DO MARCO — não é bug deste commit,
  // é uma decisão dele de 26/07/2026 encontrando um caso que não existia
  // naquele dia. Fica registrada aqui, rodando, para não morrer na conversa.
  //
  // `ritmoVendas` (calc.js) devolve `null` quando o break-even é nulo, ANTES
  // de olhar se a festa já aconteceu — e essa ordem é decisão dele, travada
  // pelo teste "sem break-even também não [dá para dizer que passou]" em
  // marcacaoRealizadaCampoVazio.test.js.
  //
  // Até hoje o break-even quase nunca era nulo (a conta antiga só devolvia
  // nulo com ticket líquido zero). Com a conta nova, ele é nulo em TODO
  // cenário que não fecha nem vendendo tudo. Consequência medida: numa festa
  // que JÁ ACONTECEU e cujo realista não fecha, as quatro superfícies de
  // ritmo — o card "Estamos vendendo no ritmo?", a linha da Home, o "Copiar
  // resumo" e o relatório/PDF — deixam de imprimir a marcação "Evento já
  // realizado".
  //
  // Este teste NÃO julga; ele fotografa o comportamento de hoje para que a
  // pergunta chegue ao Marco com a conta na frente.
  it('CONSEQUÊNCIA A DECIDIR: festa passada que não fecha perde a marcação "evento já realizado"', () => {
    const passadaQueNaoFecha = {
      ...SOBRADO_BAR_POR_PESSOA(),
      data: '2026-01-10', // já aconteceu
      barModo: 'fixo',
      outrasReceitas: { bar: 6000, patrocinio: 2000 },
      categorias: custos({ dj: 60000, estrutura: 55000, aeb: 70000, equipe: 40000 }),
      vendidosAteHoje: 900,
    }
    const c = computeCenario(passadaQueNaoFecha, 'realista')
    expect(c.breakEvenNaoFecha).toBe(true)
    expect(c.breakEven).toBeNull()

    // com break-even nulo, a leitura de ritmo some inteira — inclusive a
    // marcação de festa realizada, que não depende de break-even nenhum
    expect(
      ritmoVendas({
        vendidos: passadaQueNaoFecha.vendidosAteHoje,
        dataEvento: passadaQueNaoFecha.data,
        breakEven: c.breakEven,
        hoje: '2026-07-27',
      })
    ).toBeNull()

    // com um break-even qualquer, ela aparece — é só a ordem dos dois testes
    expect(
      ritmoVendas({
        vendidos: passadaQueNaoFecha.vendidosAteHoje,
        dataEvento: passadaQueNaoFecha.data,
        breakEven: 800,
        hoje: '2026-07-27',
      })
    ).toEqual({ eventoPassado: true })
  })

  it('o evento não é mutado pela busca', () => {
    const ev = SOBRADO_BAR_POR_PESSOA()
    const antes = JSON.stringify(ev)
    computeCenarios(ev)
    buscaBreakEven(ev, 'realista')
    expect(JSON.stringify(ev)).toBe(antes)
  })
})
