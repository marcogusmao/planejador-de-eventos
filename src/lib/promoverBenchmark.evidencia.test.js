// EVIDÊNCIA + ESPECIFICAÇÃO do conserto de `montarBenchmarkDeEvento`.
//
// ESTADO (20/07/2026): o Marco APROVOU a mudança, com o diff de números na mesa
// antes (princípio 1 do CLAUDE.md), e ela está implementada. Este arquivo virou
// o teste da mudança:
//
//   • bloco 1 — a conta ANTIGA, transcrita neste arquivo em `contaAntiga()` e
//     medida linha a linha. É a fotografia do "antes", e ela RODA: a evidência
//     que abriu o caso não virou comentário;
//   • bloco 2 — a conta NOVA (era o `describe.skip`), agora rodando contra o
//     `montarBenchmarkDeEvento` de verdade;
//   • bloco 3 — a RESTRIÇÃO DURA do Marco, "NÃO MUDE BENCHMARKS ANTIGOS JÁ
//     LANÇADOS": um benchmark montado pela conta ANTIGA é plantado no store e
//     tem de sair de todos os caminhos de leitura idêntico, por identidade de
//     objeto, inclusive depois do round-trip de backup JSON;
//   • bloco 4 — o dano na régua, que é a razão de o conserto existir.
//
// ---------------------------------------------------------------------------
// O ACHADO (varredura de 20/07/2026) — S1, e o único S1 que não se corrige
// relendo a tela
// ---------------------------------------------------------------------------
// `montarBenchmarkDeEvento` montava as DUAS metades do benchmark com réguas
// DIFERENTES:
//
//   • custo  → `valorConsiderado(item)` (fechamento.js:132) — a régua de todo
//              o app, a MESMA que o card do Fechamento usa. Comparável.
//   • receita → a bilheteria BRUTA e nada mais (fechamento.js:138-140):
//              sem taxa, sem cashback, sem bar, sem patrocínio. NÃO comparável.
//
// Metade do benchmark fala a língua do app, a outra metade não. E o número que
// sai da subtração das duas é gravado.
//
// A MEDIÇÃO QUE ABRIU O CASO — O Galeao 12/07, mesma festa, mesmo clique:
//
//     card do Fechamento .... +R$ 24.100
//     benchmark gravado ..... −R$  2.500
//
// R$ 26.600 de diferença, SINAL OPOSTO. Já medido em
// `superficiesRealizado.evidencia.test.js` ("AGRAVANTE 3"); aqui a medição vira
// a TABELA DE DIFERENÇAS que o princípio 1 do CLAUDE.md exige antes de mexer
// em fórmula.
//
// POR QUE É MAIS URGENTE QUE O RESTO. O benchmark é PERSISTIDO: vai para
// `store.benchmarksCustom`, para o backup JSON e para o Financeiro, e vira a
// régua contra a qual as PRÓXIMAS festas são medidas. Um número errado numa
// tela se corrige recarregando; este fica.
//
// As festas abaixo são construídas para a medição — não são dados do Marco.

import { describe, it, expect } from 'vitest'
import { computeCenarios } from './calc.js'
import { montarBenchmarkDeEvento, resultadoRealizado } from './fechamento.js'
import { benchmarksDisponiveis, benchmarksVisiveis, benchmarksAtivos, somaCustos } from './benchmarks.js'
import { montarBackup, parseBackup, mesclarBackup } from './storage.js'
import { novoEvento, novoLote, novoItem, novoPatrocinio } from './defaults.js'

const lote = (nome, valor, quantidade) => novoLote({ nome, valor, quantidade })
const item = (servico, estimado, realizado) =>
  novoItem({ servico, estimado, realizado, status: 'PAGO' })
const cats = (mapa) => novoEvento('tmp').categorias.map((c) => ({ ...c, itens: mapa[c.id] || [] }))
const festa = (nome, patch) => ({ ...novoEvento(nome), ...patch })

// ——— (a) fechada COM bilheteria realizada, taxa, cashback, bar e patrocínio ———
const GALEAO_FESTA = festa('O Galeao 12/07', {
  data: '2026-07-12', local: 'Clube O Galeao', tipo: 'O Galeao',
  publicoEstimado: 800, taxaBilheteria: 22, cashbackPct: 2, contingenciaPct: 8,
  barModo: 'fixo', outrasReceitas: { bar: 15000, patrocinio: '' }, vendidosAteHoje: 700,
  patrocinios: [
    novoPatrocinio({ patrocinador: 'Cervejaria', valor: 30000, estagio: 'recebido' }),
    novoPatrocinio({ patrocinador: 'Energético', valor: 20000, estagio: 'proposta' }),
  ],
  lotes: [lote('Lote 1', 130, 400), lote('Lote 2', 160, 400)],
  categorias: cats({
    artistico: [item('Line-up', 35000, 35000)],
    estrutura: [item('Estrutura completa', 28000, 29500)],
    equipe: [item('Equipe', 14000, 14000)],
    locacao: [item('Locação + alvarás', 12000, 12000)],
  }),
  receitaRealizada: { bilheteria: 88000, bar: 14200 },
})

// ——— (b) fechada SEM patrocínio e SEM bar (só bilheteria e custo) ———
const MARFIM = festa('Marfim Alto 09/05', {
  data: '2026-05-09', local: 'Galeão Marfim', tipo: 'Marfim Alto',
  publicoEstimado: 600, taxaBilheteria: 10, cashbackPct: 0, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: '', patrocinio: '' }, vendidosAteHoje: 640,
  lotes: [lote('Lote Promocional', 80, 200), lote('Lote 1', 120, 250), lote('Lote 2', 150, 150)],
  categorias: cats({
    artistico: [item('Atrações', 30000, 30000)],
    estrutura: [item('Estrutura', 25000, 25000)],
    equipe: [item('Equipe', 20000, 20000)],
    locacao: [item('Aluguel do espaço', 14000, 14000)],
  }),
  receitaRealizada: { bilheteria: 92000, bar: '' },
})

// ——— (c) SEM bilheteria realizada informada: cai no caminho dos LOTES CHEIOS ———
const BRISA_SILENCIOSA = festa('Brisa 14/03 (sem realizado lançado)', {
  data: '2026-03-14', local: 'Casa Brisa', tipo: 'Brisa',
  publicoEstimado: 1000, taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: 8000, patrocinio: '' }, vendidosAteHoje: 420,
  lotes: [lote('Lote 1', 100, 400), lote('Lote 2', 100, 400), lote('Último Lote', 100, 200)],
  categorias: cats({
    artistico: [item('DJs', 15000, '')],
    estrutura: [item('Som e luz', 13000, '')],
    equipe: [item('Produção + segurança', 10000, '')],
    aeb: [item('Insumos de bar', 6000, '')],
  }),
  receitaRealizada: { bilheteria: '', bar: '' },
})

// ——— (d) ticket médio MANUAL no cenário realista (R$ 140) ———
const SOBRADO_FESTA = festa('Sobrado 21/06', {
  data: '2026-06-21', local: 'Rooftop Sobrado', tipo: 'Sobrado',
  publicoEstimado: 500, taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: 9000, patrocinio: '' }, vendidosAteHoje: 460,
  lotes: [lote('Lote 1', 90, 300), lote('Lote 2', 110, 250)],
  cenariosConfig: { pessimista: {}, realista: { ticketMedio: 140 }, otimista: {} },
  categorias: cats({
    artistico: [item('DJs', 12000, 12800)],
    estrutura: [item('Som, luz, gerador', 14000, 14000)],
    equipe: [item('Equipe', 8000, 8200)],
    marketing: [item('Tráfego', 4000, 4000)],
  }),
  receitaRealizada: { bilheteria: 61000, bar: 9400 },
})

// ——— (e) PREJUÍZO de verdade: vendeu muito abaixo do previsto ———
const BRISA_PREJUIZO = festa('Brisa 14/03', {
  data: '2026-03-14', local: 'Casa Brisa', tipo: 'Brisa',
  publicoEstimado: 1000, taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: 8000, patrocinio: '' }, vendidosAteHoje: 420,
  lotes: [lote('Lote 1', 100, 400), lote('Lote 2', 100, 400), lote('Último Lote', 100, 200)],
  categorias: cats({
    artistico: [item('DJs', 15000, 15000)],
    estrutura: [item('Som e luz', 13000, 13000)],
    equipe: [item('Produção + segurança', 10000, 10000)],
    aeb: [item('Insumos de bar', 6000, 6000)],
  }),
  receitaRealizada: { bilheteria: 38000, bar: 2000 },
})

const cardDe = (ev) => resultadoRealizado(ev, computeCenarios(ev).realista)

// ---------------------------------------------------------------------------
// A CONTA ANTIGA, transcrita (era fechamento.js:128-154 até 20/07/2026).
//
// Ela saiu do código quando o Marco aprovou a mudança, e vive AQUI de
// propósito: a evidência que abriu o caso não pode virar comentário. Com esta
// transcrição o bloco 1 abaixo continua RODANDO — ele mede o "antes" de
// verdade, não uma lembrança dele — e o bloco 3 consegue construir um
// benchmark "salvo antes da mudança" sem depender da função nova.
//
// É cópia morta: nada no app a chama. Se alguém a mudar, muda a fotografia,
// não o app.
// ---------------------------------------------------------------------------
function contaAntiga(evento) {
  const CATS = ['aeb', 'locacao', 'estrutura', 'equipe', 'artistico', 'marketing', 'extras']
  const n = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v))
  const considerado = (i) =>
    i.realizado != null && i.realizado !== '' && n(i.realizado) > 0 ? n(i.realizado) : n(i.estimado)
  const custos = Object.fromEntries(CATS.map((k) => [k, 0]))
  for (const c of evento.categorias || []) {
    const key = CATS.includes(c.id) ? c.id : 'extras'
    for (const i of c.itens || []) custos[key] += considerado(i)
  }
  const custoTotal = CATS.reduce((s, k) => s + custos[k], 0)
  for (const k of CATS) if (custos[k] <= 0) custos[k] = null
  const lotes = (evento.lotes || []).filter((l) => !l.somenteOtimista)
  const receitaLotes = lotes.reduce((s, l) => s + n(l.valor) * n(l.quantidade), 0)
  const bilhReal = n(evento.receitaRealizada?.bilheteria)
  const receita = bilhReal > 0 ? bilhReal : receitaLotes > 0 ? receitaLotes : null
  const pagos = lotes.filter((l) => n(l.valor) > 0).reduce((s, l) => s + n(l.quantidade), 0)
  return {
    id: 'bm-conta-antiga',
    nome: evento.nome || 'Evento promovido',
    custom: true,
    publico: n(evento.publicoEstimado) || null,
    custos,
    custoTotal,
    receita,
    ticketMedio: receita != null && pagos > 0 ? receita / pagos : null,
    lucro: receita != null ? receita - custoTotal : null,
    obs: `Promovido da previsão "${evento.nome}"`,
  }
}

// ===========================================================================
// 1. A CONTA ANTIGA, travada linha a linha — a fotografia do "antes"
// ===========================================================================
describe('ANTES (até 20/07/2026) — a receita do benchmark era bilheteria BRUTA e nada mais', () => {
  it('(a) O Galeao: taxa (R$ 19.360), cashback (R$ 1.760), bar (R$ 14.200) e patrocínio (R$ 30.000) ficavam TODOS de fora', () => {
    const bm = contaAntiga(GALEAO_FESTA)
    const card = cardDe(GALEAO_FESTA)

    // A receita gravada é literalmente o campo `receitaRealizada.bilheteria`.
    expect(bm.receita).toBe(88000)
    expect(bm.receita).toBe(GALEAO_FESTA.receitaRealizada.bilheteria)

    // O card, com a MESMA festa, vê quatro parcelas que o benchmark não vê.
    expect(card.taxa).toBe(19360)
    expect(card.cashback).toBe(1760)
    expect(card.bilheteriaLiquida).toBe(70400)
    expect(card.bar).toBe(14200)
    expect(card.patrocinio).toBe(30000) // só o RECEBIDO; a proposta de 20.000 fica fora
    expect(card.receita).toBe(114600)

    // O custo, esse sim, é o mesmo dos dois lados — é a metade comparável.
    expect(bm.custoTotal).toBe(90500)
    expect(card.custos).toBe(90500)
    expect(bm.custoTotal).toBe(card.custos)

    // E o resultado inverte o sinal.
    expect(bm.lucro).toBe(-2500)
    expect(card.resultado).toBe(24100)
    expect(Math.sign(bm.lucro)).not.toBe(Math.sign(card.resultado))
    expect(card.resultado - bm.lucro).toBe(26600)
  })

  it('(b) Marfim sem bar e sem patrocínio: só a taxa de 10% já inverte o sinal', () => {
    const bm = contaAntiga(MARFIM)
    const card = cardDe(MARFIM)

    expect(bm.receita).toBe(92000) // bruta
    expect(card.bilheteriaLiquida).toBe(82800) // 92.000 − 10%
    expect(card.receita).toBe(82800) // sem bar, sem patrocínio: é só ela

    expect(bm.custoTotal).toBe(89000)
    expect(bm.lucro).toBe(3000) // o benchmark grava LUCRO
    expect(card.resultado).toBe(-6200) // a festa deu PREJUÍZO
    expect(Math.sign(bm.lucro)).not.toBe(Math.sign(card.resultado))
    expect(card.resultado - bm.lucro).toBe(-9200) // exatamente a taxa
  })

  it('(c) SEM bilheteria realizada: a receita vira a soma dos lotes CHEIOS, ingressos que nunca venderam', () => {
    const bm = contaAntiga(BRISA_SILENCIOSA)

    // fechamento.js:137-140 — valor × quantidade de todo lote não-"só otimista",
    // sem vendaPct, sem cupom, sem ticket manual. 1.000 ingressos a R$ 100.
    expect(bm.receita).toBe(100000)
    expect(BRISA_SILENCIOSA.vendidosAteHoje).toBe(420) // venderam 420
    expect(bm.custoTotal).toBe(44000)
    expect(bm.lucro).toBe(56000) // R$ 56.000 de lucro inventado, gravado

    // E o card não existe — ninguém responde em dinheiro real.
    expect(cardDe(BRISA_SILENCIOSA)).toBeNull()
  })

  it('(d) ticket médio manual (R$ 140) NÃO chega ao benchmark: nem à receita, nem ao ticketMedio', () => {
    const bm = contaAntiga(SOBRADO_FESTA)
    const cen = computeCenarios(SOBRADO_FESTA).realista

    expect(cen.ticketMedioManual).toBe(true)
    expect(cen.ticketMedio).toBe(140) // o que o app mostra em toda tela

    // O benchmark grava OUTRO ticket: bilheteria bruta ÷ CAPACIDADE dos lotes
    // pagos (fechamento.js:141+150) — 61.000 ÷ 550 = 110,91.
    expect(bm.ticketMedio).toBeCloseTo(110.909, 3)
    expect(bm.receita / 550).toBeCloseTo(bm.ticketMedio, 6)

    // O divisor é a CAPACIDADE, não os vendidos (460) nem o público do
    // cenário (550, que aqui coincide por acaso) nem o publicoEstimado (500).
    expect(SOBRADO_FESTA.lotes.reduce((s, l) => s + l.quantidade, 0)).toBe(550)
    expect(SOBRADO_FESTA.vendidosAteHoje).toBe(460)
    expect(bm.publico).toBe(500) // publicoEstimado, um TERCEIRO número
  })

  it('(e) prejuízo de verdade: o benchmark acerta o sinal por sorte, e ainda erra o valor', () => {
    const bm = contaAntiga(BRISA_PREJUIZO)
    const card = cardDe(BRISA_PREJUIZO)

    expect(bm.lucro).toBe(-6000)
    expect(card.resultado).toBe(-5900)
    // Coincidem no sinal porque taxa (−3.800) e cashback (+1.900) + bar
    // (+2.000) quase se anulam: R$ 100 de diferença. Não é acerto de régua,
    // é empate de erros.
    expect(card.resultado - bm.lucro).toBe(100)
    expect(card.taxa).toBe(3800)
    expect(card.cashback).toBe(1900)
    expect(card.bar).toBe(2000)
  })

  it('o público gravado é sempre `publicoEstimado`, nunca o público do cenário', () => {
    // fechamento.js:146 — `num(evento.publicoEstimado) || null`.
    for (const ev of [GALEAO_FESTA, MARFIM, BRISA_PREJUIZO]) {
      expect(contaAntiga(ev).publico).toBe(Number(ev.publicoEstimado))
    }
    expect(contaAntiga(GALEAO_FESTA).publico).toBe(800)
    expect(computeCenarios(GALEAO_FESTA).realista.publico).toBe(720) // o cenário diz outro
  })

  it('os custos por categoria são `valorConsiderado`, e o custoTotal fecha com a soma deles', () => {
    const bm = contaAntiga(GALEAO_FESTA)
    expect(bm.custos.artistico).toBe(35000)
    expect(bm.custos.estrutura).toBe(29500) // realizado (orçado 28.000)
    expect(bm.custos.equipe).toBe(14000)
    expect(bm.custos.locacao).toBe(12000)
    expect(bm.custos.aeb).toBeNull() // categoria sem item vira null (:135)
    expect(somaCustos(bm.custos)).toBe(bm.custoTotal)
    // Contingência NÃO entra em lugar nenhum do promovido.
    expect(computeCenarios(GALEAO_FESTA).realista.contingencia).toBe(7240)
    expect(bm.custoTotal).toBe(90500)
  })
})

// ===========================================================================
// 2. A CONTA PROPOSTA — a MESMA do card. Falha de propósito se rodada hoje.
// ===========================================================================
describe('PROPOSTO (aprovado pelo Marco em 20/07/2026 — princípio 1)', () => {
  // Régua proposta, campo a campo:
  //   receita     = card.receita   (bilheteria LÍQUIDA + bar + patrocínio fechado)
  //   custoTotal  = card.custos    (já é assim hoje — nada muda)
  //   lucro       = card.resultado
  //   ticketMedio = PERGUNTA 2 ao Marco (a especificação abaixo assume
  //                 receita ÷ público do benchmark; trocar se ele decidir outro)
  //   publico     = PERGUNTA 2 (a especificação mantém publicoEstimado)
  // Contingência e ajuste de cenário: PERGUNTA 1. A especificação abaixo
  // segue o card e NÃO os inclui.

  it('(a) O Galeao: o benchmark passa a gravar +R$ 24.100, o mesmo do card', () => {
    const bm = montarBenchmarkDeEvento(GALEAO_FESTA)
    expect(bm.receita).toBe(114600)
    expect(bm.custoTotal).toBe(90500)
    expect(bm.lucro).toBe(24100)
    expect(bm.lucro).toBe(cardDe(GALEAO_FESTA).resultado)
  })

  it('(b) Marfim: passa a gravar −R$ 6.200, o prejuízo que a festa deu', () => {
    const bm = montarBenchmarkDeEvento(MARFIM)
    expect(bm.receita).toBe(82800)
    expect(bm.lucro).toBe(-6200)
  })

  it('(d) Sobrado: +R$ 28.350, com bar e cashback dentro', () => {
    const bm = montarBenchmarkDeEvento(SOBRADO_FESTA)
    expect(bm.receita).toBe(67350)
    expect(bm.lucro).toBe(28350)
  })

  it('(e) Brisa: −R$ 5.900, e não mais −R$ 6.000', () => {
    expect(montarBenchmarkDeEvento(BRISA_PREJUIZO).lucro).toBe(-5900)
  })

  it('a regra geral: promovido e card NUNCA divergem em festa com realizado lançado', () => {
    for (const ev of [GALEAO_FESTA, MARFIM, SOBRADO_FESTA, BRISA_PREJUIZO]) {
      const bm = montarBenchmarkDeEvento(ev)
      const card = cardDe(ev)
      expect(bm.receita).toBe(card.receita)
      expect(bm.custoTotal).toBe(card.custos)
      expect(bm.lucro).toBe(card.resultado)
    }
  })

  it('(c) sem bilheteria realizada, a promoção NÃO inventa R$ 56.000 de lucro', () => {
    // PERGUNTA 3 ao Marco: recusar a promoção (null), promover com etiqueta
    // "receita estimada", ou usar o realista? A especificação abaixo assume
    // RECUSAR — a alternativa mais conservadora, alinhada ao card, que também
    // não existe sem realizado. Trocar conforme a decisão dele.
    expect(montarBenchmarkDeEvento(BRISA_SILENCIOSA)).toBeNull()
  })
})

// ===========================================================================
// 3. A RESTRIÇÃO DURA DO MARCO (20/07/2026):
//    "NÃO MUDE BENCHMARKS ANTIGOS JÁ LANÇADOS"
//    Este bloco PASSA hoje e tem de continuar passando DEPOIS da mudança.
// ===========================================================================
describe('RESTRIÇÃO DURA — benchmark já promovido e salvo NÃO muda', () => {
  // Um benchmark gravado pela conta de HOJE, como se estivesse no store do
  // Marco desde antes da mudança. Os números são os de (a): lucro NEGATIVO.
  const bmAntigo = { ...contaAntiga(GALEAO_FESTA), id: 'bm-promovido-antigo' }

  const store = () => ({
    eventos: [],
    benchmarksCustom: [structuredClone(bmAntigo)],
    benchmarkOverrides: {},
    benchmarksPadrao: {},
    benchmarksOcultos: [],
    benchmarksApagados: [],
    ajustes: {},
  })

  it('o benchmark salvo carrega os números ANTIGOS, e é isso que tem de sobreviver', () => {
    expect(bmAntigo.receita).toBe(88000)
    expect(bmAntigo.lucro).toBe(-2500)
    expect(bmAntigo.custom).toBe(true)
  })

  it('benchmarksDisponiveis devolve o objeto SALVO, sem recalcular nada — nem por igualdade, nem por identidade', () => {
    const s = store()
    const salvo = s.benchmarksCustom[0]
    const lido = benchmarksDisponiveis(s).find((b) => b.id === 'bm-promovido-antigo')
    // Igualdade profunda: nenhum campo mudou.
    expect(lido).toEqual(bmAntigo)
    // E IDENTIDADE: é o mesmo objeto, não uma cópia recalculada. Se um dia
    // alguém enfiar um `montarBenchmarkDeEvento` ou um `aplicarOverride` no
    // caminho dos custom, esta linha quebra na hora.
    expect(lido).toBe(salvo)
  })

  it('as três telas de leitura passam o custom adiante intacto (visíveis, ativos, disponíveis)', () => {
    const s = store()
    const salvo = s.benchmarksCustom[0]
    expect(benchmarksVisiveis(s).find((b) => b.id === salvo.id)).toBe(salvo)
    expect(benchmarksAtivos({ benchmarksAtivos: undefined }, s).find((b) => b.id === salvo.id)).toBe(salvo)
    expect(benchmarksAtivos({ benchmarksAtivos: [salvo.id] }, s).find((b) => b.id === salvo.id)).toBe(salvo)
  })

  it('override e "salvar como padrão" só alcançam os EMBUTIDOS — um override com o id do custom é ignorado', () => {
    // A rede de edição (aplicarOverride/benchmarkBase) roda dentro do
    // `FIXED_BENCHMARKS.map(...)` de benchmarks.js:117-119. Os custom entram
    // depois, por spread puro (:120). Prova: plantar um override venenoso
    // com o id do custom e conferir que ele não encosta no número.
    const s = { ...store(), benchmarkOverrides: { 'bm-promovido-antigo': { lucro: 999999 } } }
    expect(benchmarksDisponiveis(s).find((b) => b.id === 'bm-promovido-antigo').lucro).toBe(-2500)
  })

  it('o round-trip do backup JSON devolve o benchmark antigo byte a byte', () => {
    const s = store()
    const backup = parseBackup(JSON.stringify(montarBackup(s)))
    expect(backup.benchmarksCustom).toEqual([bmAntigo])
    const remontado = mesclarBackup({ ...store(), benchmarksCustom: [] }, backup)
    expect(remontado.benchmarksCustom.find((b) => b.id === bmAntigo.id)).toEqual(bmAntigo)
  })

  it('promover a MESMA festa de novo cria um benchmark NOVO, com id próprio — não reescreve o antigo', () => {
    const s = store()
    const novo = montarBenchmarkDeEvento(GALEAO_FESTA)
    expect(novo.id).not.toBe(bmAntigo.id)
    // O caminho real do app (EventEditor.jsx:190) é um append.
    const depois = { ...s, benchmarksCustom: [...s.benchmarksCustom, novo] }
    expect(depois.benchmarksCustom[0]).toEqual(bmAntigo) // o antigo, intocado
    expect(depois.benchmarksCustom).toHaveLength(2)
  })

  it('VARREDURA — os únicos escritores de benchmarksCustom são criação, edição do Marco, exclusão e merge de backup', () => {
    // Levantamento de 20/07/2026 (grep por `benchmarksCustom` em src/):
    //   • ImportModal.jsx:144        → CRIA (importação de planilha)
    //   • EventEditor.jsx:190        → CRIA (promover a benchmark)
    //   • BenchmarksEditor.jsx:202   → CRIA ("Novo evento antigo")
    //   • BenchmarksEditor.jsx:65    → EDITA campo a campo, por clique do Marco
    //   • benchmarks.js:167          → EXCLUI (excluirBenchmarkCustom)
    //   • storage.js:323-325         → MESCLA backup por id
    //   • benchmarks.js:120          → LÊ, por spread puro
    //   • protecao.js:94             → LÊ, só conta quantos são
    // Nenhum deles recalcula um benchmark existente a partir do evento. Esta
    // asserção é a versão executável do levantamento: um store lido e relido
    // por todos os caminhos de LEITURA sai idêntico ao que entrou.
    const s = store()
    const congelado = structuredClone(s)
    benchmarksDisponiveis(s)
    benchmarksVisiveis(s)
    benchmarksAtivos({}, s)
    montarBackup(s)
    expect(s).toEqual(congelado)
  })
})

// ===========================================================================
// 4. O EFEITO NA RÉGUA — o dano real: o benchmark existe para ser comparado
// ===========================================================================
describe('A RÉGUA — a mesma festa nova é aprovada ou reprovada conforme a régua', () => {
  // Uma previsão NOVA sendo avaliada hoje, comparada contra O Galeao na aba
  // Cenários (ScenariosTab.jsx:218 — `porPessoa(bm, v)` = valor ÷ bm.publico).
  const NOVA = festa('Sobrado 15/08 (previsão nova)', {
    data: '2026-08-15', tipo: 'Sobrado', publicoEstimado: 700,
    taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
    barModo: 'fixo', outrasReceitas: { bar: 10000, patrocinio: '' },
    lotes: [lote('Lote 1', 120, 350), lote('Lote 2', 150, 350)],
    categorias: cats({
      artistico: [item('Line-up', 28000, '')],
      estrutura: [item('Estrutura', 22000, '')],
      equipe: [item('Equipe', 13000, '')],
      locacao: [item('Locação', 10000, '')],
    }),
  })

  const REGUA_HOJE = { publico: 800, receita: 88000, custoTotal: 90500, lucro: -2500 }
  const REGUA_PROPOSTA = { publico: 800, receita: 114600, custoTotal: 90500, lucro: 24100 }

  it('a régua ANTIGA aprova a festa nova; a PROPOSTA reprova a MESMA festa', () => {
    const cen = computeCenarios(NOVA).realista
    expect(cen.publico).toBe(630)
    expect(cen.lucro).toBeCloseTo(14147.5, 6)

    // Barra "Lucro", em valor absoluto.
    expect(cen.lucro - REGUA_HOJE.lucro).toBeCloseTo(16647.5, 6) // parece MELHOR
    expect(cen.lucro - REGUA_PROPOSTA.lucro).toBeCloseTo(-9952.5, 6) // parece PIOR
    expect(cen.lucro > REGUA_HOJE.lucro).toBe(true)
    expect(cen.lucro > REGUA_PROPOSTA.lucro).toBe(false)

    // Barra "Lucro por pessoa" — o modo /pax da aba Cenários.
    const lppNova = cen.lucro / cen.publico
    expect(lppNova - REGUA_HOJE.lucro / REGUA_HOJE.publico).toBeCloseTo(25.58, 2)
    expect(lppNova - REGUA_PROPOSTA.lucro / REGUA_PROPOSTA.publico).toBeCloseTo(-7.67, 2)

    // Barra "Receita por pessoa": a régua antiga faz a nova parecer +R$ 34/pax
    // acima da referência; a proposta empata (+R$ 0,87).
    const rppNova = cen.receitaTotal / cen.publico
    expect(rppNova - REGUA_HOJE.receita / REGUA_HOJE.publico).toBeCloseTo(34.12, 2)
    expect(rppNova - REGUA_PROPOSTA.receita / REGUA_PROPOSTA.publico).toBeCloseTo(0.87, 2)
  })

  it('a régua antiga é uma festa que "perdeu dinheiro" — e O Galeao ganhou R$ 24.100', () => {
    // É esta a inversão que o Marco decide se conserta: enquanto a régua
    // gravada disser −R$ 2.500, toda festa nova com lucro pequeno passa por
    // "melhor que O Galeao", e O Galeao foi a mais lucrativa das quatro.
    expect(REGUA_HOJE.lucro).toBeLessThan(0)
    expect(cardDe(GALEAO_FESTA).resultado).toBe(24100)
  })
})
