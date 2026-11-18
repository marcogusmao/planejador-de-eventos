// A BILHETERIA BRUTA PASSA A SER GRAVADA NO BENCHMARK PROMOVIDO.
//
// Decisão 6 do Marco (`DECISOES-MARCO-H4.md`, 25/07/2026), reafirmada por
// questionário em 12/08/2026 e implementada em 30/08/2026, quando ele abriu o
// portão do golden deste arquivo.
//
// O QUE ESTAVA QUEBRADO, e não era o que a ficha do BACKLOG dizia: o módulo
// `reguaTicket.js` inteiro, a migração de `bilheteriaBruta` em `migracao.js` e
// a frase de observação já existiam desde 25/07 — construídos para esta
// decisão. Faltava UMA ligação: quem promove um fechamento não gravava os dois
// campos, então o dado que a régua precisa nascia e morria dentro da mesma
// função. A ficha ficou 36 dias marcada como "decisão pendente" para uma
// decisão que já tinha sido tomada e quase inteiramente construída.
//
// POR QUE GRAVAR A BRUTA, e não deixar para recalcular depois: `receita`
// inclui bar e patrocínio e não dá para voltar dela; não existe link para o
// evento de origem; e recalcular do evento ATUAL não serve, porque ele pode
// ter sido editado depois da promoção — o benchmark deixaria de ser a foto
// congelada que promete ser.
import { describe, it, expect } from 'vitest'
import { montarBenchmarkDeEvento, resultadoRealizado } from './fechamento.js'
import { computeCenarios } from './calc.js'
import { reguaDoTicket, REGUA_BILHETERIA, bilheteriaBrutaDe } from './reguaTicket.js'
import { migrarBenchmark, migrarBenchmarks } from './migracao.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'

// Festa com números redondos: bilheteria bruta 60.000, público 600 → ticket 100.
const festa = () => {
  const e = novoEvento('Festa do ticket redondo')
  e.tipo = 'Brisa'
  e.data = '2026-05-09'
  e.taxaBilheteria = 0
  e.cashbackPct = 0
  e.contingenciaPct = 0
  e.publicoEstimado = 600
  e.lotes = [{ ...novoLote(), id: 'l1', nome: 'Lote único', valor: 100, quantidade: 600 }]
  e.cenariosConfig.realista.vendaPct = 100
  e.categorias = [
    { id: 'aeb', nome: 'A&B', itens: [{ ...novoItem(), id: 'i1', servico: 'Insumos', estimado: 20000, realizado: 20000 }] },
  ]
  e.receitaRealizada = { bilheteria: 60000, bar: '' }
  return e
}

const promovido = () => montarBenchmarkDeEvento(festa())

describe('o benchmark promovido guarda a bilheteria bruta e a régua do ticket', () => {
  it('grava a bilheteria BRUTA, e é a mesma que o card do Fechamento imprime', () => {
    const evento = festa()
    const card = resultadoRealizado(evento, computeCenarios(evento).realista)
    const bm = montarBenchmarkDeEvento(evento)
    expect(bm.bilheteriaBruta).toBe(card.bilheteriaBruta)
    expect(bm.bilheteriaBruta).toBe(60000)
  })

  it('grava a RÉGUA, e ela é a que o módulo da régua reconhece', () => {
    const bm = promovido()
    expect(bm.reguaTicket).toBe(REGUA_BILHETERIA)
    expect(reguaDoTicket(bm)).toBe(REGUA_BILHETERIA)
  })

  it('com os dois campos, o ticket VOLTA a ser recalculável — que é o ponto da decisão', () => {
    const bm = promovido()
    expect(bilheteriaBrutaDe(bm) / bm.publico).toBeCloseTo(bm.ticketMedio, 6)
    expect(bm.ticketMedio).toBe(100)
  })

  it('a observação diz qual conta produziu o ticket, com a frase que a TELA também usa', () => {
    // A frase vem de `reguaTicket.js`. Se alguém a escrever à mão em quem
    // promove, tela e observação passam a poder divergir sobre o mesmo número
    // — que é um erro que esta casa já cometeu.
    expect(promovido().obs).toContain('Ticket médio = bilheteria bruta ÷ público')
  })
})

describe('e o dado JÁ SALVO do Marco não é tocado (princípio 2)', () => {
  // Um benchmark promovido ANTES desta mudança: sem `bilheteriaBruta` e sem
  // `reguaTicket`. É a forma que existe hoje no store dele.
  const antigo = Object.freeze({
    id: 'bm-antigo',
    nome: 'Festa antiga',
    custom: true,
    semReserva: true,
    publico: 500,
    custos: { aeb: 10000 },
    custoTotal: 10000,
    receita: 55000,
    ticketMedio: 110,
    lucro: 45000,
    obs: 'Promovido do fechamento de "Festa antiga" (01/03/2026)',
  })

  it('a migração devolve o benchmark antigo IDÊNTICO — nem preenche, nem inventa', () => {
    // `toBe` e não `toEqual`: a migração devolve o PRÓPRIO objeto quando não há
    // o que fazer, e essa identidade é o que a restrição datada de 20/07/2026
    // ("NÃO MUDE BENCHMARKS ANTIGOS JÁ LANÇADOS") cobra.
    expect(migrarBenchmark(antigo)).toBe(antigo)
    const lista = [antigo]
    expect(migrarBenchmarks(lista)).toBe(lista)
  })

  it('sem os campos novos, a régua dele NÃO é a nova — e a tela não finge que é', () => {
    // O ticket antigo (110) foi calculado por receita ÷ público (55.000/500).
    // Sem `bilheteriaBruta` gravada, nada aqui pode afirmar que é bilheteria.
    expect(bilheteriaBrutaDe(antigo)).toBeNull()
    expect(reguaDoTicket(antigo)).not.toBe(REGUA_BILHETERIA)
  })

  it('a bilheteria bruta vinda como TEXTO de um backup editado à mão vira número', () => {
    // Este caminho já existia na migração desde 25/07; o teste o exercita agora
    // que o campo passou a ser produzido de verdade.
    const comTexto = { ...antigo, bilheteriaBruta: '75000' }
    expect(migrarBenchmark(comTexto).bilheteriaBruta).toBe(75000)
  })
})
