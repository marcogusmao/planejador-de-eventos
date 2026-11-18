// DINHEIRO EM CENTAVOS INTEIROS — o que o motor publica e o que a tela soma.
//
// Ficha do BACKLOG: "S3 — Receita total pode diferir em R$ 0,01 da soma das
// parcelas impressas" e "S3 — Ponto flutuante no caminho do dinheiro". Antes
// desta mudança, com um lote de R$ 0,01, o cashback saía 2.700,135 e a líquida
// 51.302,564999999995: impressos com centavos, R$ 51.302,56 + R$ 89.370,00 =
// R$ 140.672,56 sob uma Receita total de R$ 140.672,57.
//
// A RÉGUA (decisão do Marco, 07/10/2026): cada PARCELA
// em reais vira centavos inteiros no ponto em que nasce (meio centavo para
// longe do zero, a régua do formatador), e todo total é a SOMA das parcelas
// já arredondadas. Por isso os testes abaixo não perguntam "o número está
// perto?": perguntam (1) se o valor É um número de centavos, e (2) se as
// parcelas IMPRESSAS com centavos somam EXATAMENTE o total impresso.
//
// CONTROLE POSITIVO: este arquivo, rodado contra o motor de antes da mudança,
// fica vermelho nos três describes (medido ao escrever o plano).
import { describe, it, expect } from 'vitest'
import { computeCenarios, barPorPessoa, patrocinioPorEstagio, isTaxaCliente } from './calc.js'
import { resultadoRealizado } from './fechamento.js'
import { ajusteCustoValor } from './dre.js'
import { fmtBRL2 } from './format.js'

// ---------------------------------------------------------------- gerador
// Determinístico (semente fixa): o mesmo conjunto de festas sintéticas em toda
// rodada. Cobre preço com centavos, cupom % e nº, taxa paga por nós e pelo
// cliente, cashback, ticket manual e ajuste de ticket, bar fixo e por pessoa,
// open bar, patrocínio solto e em lista, imposto, contingência e ajuste ±%.
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function festa(rnd, i) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const chance = (p) => rnd() < p
  const din = (a, b) => {
    const v = a + rnd() * (b - a)
    return chance(0.5) ? Math.round(v) : Math.round(v * 100) / 100
  }
  const lotes = Array.from({ length: int(1, 5) }, (_, k) => ({
    id: 'l' + k,
    nome: 'Lote ' + k,
    valor: chance(0.08) ? 0 : din(10, 400),
    quantidade: int(0, 1500),
    ...(chance(0.12) ? { somenteOtimista: true } : {}),
  }))
  const categorias = Array.from({ length: int(1, 4) }, (_, c) => ({
    id: ['aeb', 'locacao', 'estrutura', 'equipe'][c],
    nome: 'Cat ' + c,
    itens: Array.from({ length: int(1, 5) }, (_, j) => ({
      id: `i${c}_${j}`,
      servico: `Item ${c}.${j}`,
      estimado: din(100, 40000),
      ...(chance(0.25) ? { realizado: din(100, 40000) } : {}),
    })),
  }))
  const cen = () => ({
    ...(chance(0.7) ? { vendaPct: pick([50, 70, 80, 90, 100, int(30, 100)]) } : {}),
    ...(chance(0.6) ? { custoPct: pick([-10, -5, 0, 5, 10, 12.5, -8.8]) } : {}),
    ...(chance(0.2) ? { ticketPct: pick([-10, -5, 5, 7.5]) } : {}),
    ...(chance(0.15) ? { ticketMedio: din(40, 300) } : {}),
  })
  const e = {
    id: 'ev' + i,
    nome: 'Festa sintética ' + i,
    taxaBilheteria: pick([0, 5, 8, 10, 12.5, 13]),
    cashbackPct: pick([0, 3, 5]),
    contingenciaPct: pick([0, 3.5, 5, 10, 12.1]),
    lotes,
    categorias,
    outrasReceitas: { bar: '', patrocinio: '' },
    cenariosConfig: { pessimista: cen(), realista: cen(), otimista: cen(), overrides: { pessimista: {}, realista: {}, otimista: {} } },
  }
  if (chance(0.3)) e.taxaPagaPor = 'cliente'
  if (chance(0.45)) {
    e.descontoMedioPct = pick([5, 10, 12, 15.5])
    if (chance(0.5)) {
      e.descontoIngressosModo = 'numero'
      e.descontoIngressosValor = int(1, 600)
    }
  }
  if (chance(0.1)) e.openBar = true
  if (chance(0.5)) e.outrasReceitas.bar = din(0, 90000)
  else {
    e.barModo = 'porPessoa'
    e.barTicket = { pessimista: din(20, 150), realista: din(20, 150), otimista: din(20, 150) }
    e.barTaxaSistemaPct = pick([0, 3.5, 5])
    e.barCustoSistema = pick([0, 500, 1234.56])
  }
  if (chance(0.5)) {
    if (chance(0.5)) e.outrasReceitas.patrocinio = din(0, 60000)
    else
      e.patrocinios = Array.from({ length: int(1, 3) }, (_, k) => ({
        id: 'p' + k,
        valor: din(500, 40000),
        estagio: pick(['proposta', 'confirmado', 'recebido']),
      }))
  }
  if (chance(0.4)) {
    e.impostoPct = pick([2, 6, 8.65, 11.33])
    e.impostoSobre = { bilheteria: chance(0.8), bar: chance(0.5), patrocinio: chance(0.3) }
  }
  if (chance(0.5)) {
    e.receitaRealizada = { bilheteria: din(1000, 300000), bar: chance(0.7) ? din(-3000, 90000) : '', ...(chance(0.2) ? { pix: din(0, 20000) } : {}) }
  }
  return e
}

const rnd = mulberry32(20261006)
const FESTAS = Array.from({ length: 400 }, (_, i) => festa(rnd, i))
const CENARIOS = ['pessimista', 'realista', 'otimista']

// "É centavo exato": o número é o double que representa um valor de duas casas.
const ehCentavo = (v) => typeof v === 'number' && Number.isFinite(v) && Number(v.toFixed(2)) === v
// O inverso do que a tela faz: "−R$ 1.234,56" → −123456 (centavos inteiros).
const centavosImpressos = (v) => {
  const t = fmtBRL2(v).replace(/\s/g, ' ').trim()
  const neg = t.startsWith('-') || t.startsWith('−')
  const n = Number(t.replace(/[−-]/g, '').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return Math.round((neg ? -n : n) * 100)
}

// ---------------------------------------------------------------- 1
describe('1. todo valor em R$ que o motor publica é um número de centavos', () => {
  it('cenários: receita, custos, lucro, imposto, bar por pessoa, patrocínio e ajuste do DRE', () => {
    const fora = []
    for (const e of FESTAS) {
      const c = computeCenarios(e)
      const p = patrocinioPorEstagio(e)
      for (const [campo, v] of Object.entries({ fechado: p.fechado, potencial: p.potencial, total: p.total }))
        if (!ehCentavo(v)) fora.push(`${e.nome} patrocinio.${campo}=${v}`)
      for (const k of CENARIOS) {
        const s = c[k]
        const campos = {
          bruta: s.bruta, taxa: s.taxa, cashback: s.cashback, liquida: s.liquida, bar: s.bar,
          patrocinio: s.patrocinio, patrocinioPotencial: s.patrocinioPotencial, receitaTotal: s.receitaTotal,
          custoItens: s.custoItens, contingencia: s.contingencia, custoTotal: s.custoTotal, lucro: s.lucro,
          ajusteDoDRE: ajusteCustoValor(s),
          ...(s.imposto ? { impostoValor: s.imposto.valor, impostoBase: s.imposto.base } : {}),
        }
        s.porLote.forEach((l, j) => {
          campos[`porLote${j}.receita`] = l.receita
          campos[`porLote${j}.acumulada`] = l.acumulada
        })
        if (e.barModo === 'porPessoa') {
          const b = barPorPessoa(e, k, s.publico)
          Object.assign(campos, { barConsumo: b.consumo, barTaxaSistema: b.taxaSistema, barCustoSistema: b.custoSistema, barLiquido: b.liquido })
        }
        for (const [campo, v] of Object.entries(campos)) if (!ehCentavo(v)) fora.push(`${e.nome} ${k}.${campo}=${v}`)
      }
    }
    expect(fora.slice(0, 10)).toEqual([])
  })

  it('card do Fechamento: cada linha e cada ponte com o cenário', () => {
    const fora = []
    for (const e of FESTAS) {
      const r = resultadoRealizado(e, computeCenarios(e).realista)
      if (!r) continue
      const campos = {
        bilheteriaBruta: r.bilheteriaBruta, taxa: r.taxa, cashback: r.cashback, bilheteriaLiquida: r.bilheteriaLiquida,
        bar: r.bar, patrocinio: r.patrocinio, receita: r.receita, custos: r.custos, resultado: r.resultado,
        receitaPrevista: r.receitaPrevista, receitaInformada: r.receitaInformada, reservaDoCenario: r.reservaDoCenario,
        ajusteDoCenarioValor: r.ajusteDoCenarioValor, diferencaParaCenario: r.diferencaParaCenario,
        desvioDeReceita: r.desvioDeReceita, estimadoReceita: r.estimado.receita, estimadoLucro: r.estimado.lucro,
        ...(r.pix != null ? { pix: r.pix } : {}),
        ...(r.imposto ? { impostoValor: r.imposto.valor } : {}),
        ...(r.desvioDeImposto != null ? { desvioDeImposto: r.desvioDeImposto } : {}),
      }
      for (const [campo, v] of Object.entries(campos)) if (!ehCentavo(v)) fora.push(`${e.nome} fechamento.${campo}=${v}`)
    }
    expect(fora.slice(0, 10)).toEqual([])
  })
})

// ---------------------------------------------------------------- 2
describe('2. as parcelas impressas com centavos somam EXATAMENTE o total impresso', () => {
  it('DRE: bruta − taxa + cashback = líquida; líquida + bar + patrocínio = receita total; itens + contingência + ajuste = custo total; receita − imposto − custo = lucro', () => {
    const falhas = []
    for (const e of FESTAS) {
      const c = computeCenarios(e)
      for (const k of CENARIOS) {
        const s = c[k]
        const P = centavosImpressos
        const taxa = isTaxaCliente(e) ? 0 : P(s.taxa)
        const imposto = s.imposto ? P(s.imposto.valor) : 0
        if (P(s.bruta) - taxa + P(s.cashback) !== P(s.liquida)) falhas.push(`${e.nome} ${k} líquida`)
        if (P(s.liquida) + P(s.bar) + P(s.patrocinio) !== P(s.receitaTotal)) falhas.push(`${e.nome} ${k} receita total`)
        if (P(s.custoItens) + P(s.contingencia) + P(ajusteCustoValor(s)) !== P(s.custoTotal)) falhas.push(`${e.nome} ${k} custo total`)
        if (P(s.receitaTotal) - imposto - P(s.custoTotal) !== P(s.lucro)) falhas.push(`${e.nome} ${k} lucro`)
        const temManual = s.ticketMedioManual === true || Number(s.ticketAjustePct || 0) !== 0
        if (!temManual && s.porLote.reduce((t, l) => t + P(l.receita), 0) !== P(s.bruta))
          falhas.push(`${e.nome} ${k} tabela de lotes`)
      }
    }
    expect(falhas.slice(0, 10)).toEqual([])
  })

  it('card do Fechamento: as linhas até "Receita do evento" e até o "Resultado" fecham', () => {
    const falhas = []
    for (const e of FESTAS) {
      const r = resultadoRealizado(e, computeCenarios(e).realista)
      if (!r) continue
      const P = centavosImpressos
      const parcelas =
        P(r.bilheteriaBruta) - (r.taxaCliente ? 0 : P(r.taxa)) + P(r.cashback) + P(r.bar) + P(r.patrocinio) + (r.pix != null ? P(r.pix) : 0)
      if (parcelas !== P(r.receita)) falhas.push(`${e.nome} receita do evento`)
      if (P(r.receita) - (r.imposto ? P(r.imposto.valor) : 0) - P(r.custos) !== P(r.resultado)) falhas.push(`${e.nome} resultado`)
    }
    expect(falhas.slice(0, 10)).toEqual([])
  })
})

// ---------------------------------------------------------------- 3
describe('3. o caso da ficha: um lote de R$ 0,01', () => {
  // Mesma festa de scripts/provas-s0/cenarios.fixture.js (eventoSemPreco), com
  // o lote sem preço trocado por R$ 0,01 — o controle da auditoria S7.
  const ev = () => ({
    nome: 'Ficha do centavo',
    taxaBilheteria: 10,
    cashbackPct: 5,
    contingenciaPct: 5,
    outrasReceitas: { bar: '', patrocinio: '' },
    barModo: 'porPessoa',
    barTicket: { pessimista: 110, realista: 110, otimista: 110 },
    barTaxaSistemaPct: 5,
    barCustoSistema: 500,
    lotes: [
      { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 },
      { id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 },
      { id: 'l4', nome: 'Lote de um centavo', valor: 0.01, quantidade: 300 },
    ],
    categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ nome: 'Custo sintético', estimado: 60000 }] }],
    cenariosConfig: {
      pessimista: { vendaPct: 80, custoPct: 10 },
      realista: { vendaPct: 90, custoPct: 0 },
      otimista: { vendaPct: 100, custoPct: -5 },
      overrides: { pessimista: {}, realista: {}, otimista: {} },
    },
  })

  it('cashback 2.700,135 vira 2.700,14 e a líquida fecha em 51.302,57 — a receita total já era 140.672,57', () => {
    const s = computeCenarios(ev()).realista
    expect(s.bruta).toBe(54002.7)
    expect(s.taxa).toBe(5400.27)
    expect(s.cashback).toBe(2700.14)
    expect(s.liquida).toBe(51302.57)
    expect(s.bar).toBe(89370)
    expect(s.receitaTotal).toBe(140672.57)
    expect(s.lucro).toBe(77672.57)
    expect(centavosImpressos(s.liquida) + centavosImpressos(s.bar)).toBe(centavosImpressos(s.receitaTotal))
  })
})
