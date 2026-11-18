import { describe, it, expect } from 'vitest'
import {
  fechamentoCustos,
  fechamentoReceita,
  resultadoRealizado,
  montarBenchmarkDeEvento,
  MOTIVO_SEM_BILHETERIA_REALIZADA,
} from './fechamento.js'
import { computeCenario, valorConsiderado } from './calc.js'
import { novoEvento, novoItem } from './defaults.js'
import { FIXED_BENCHMARKS, somaCustos, consolidarCustosDePlanilha } from './benchmarks.js'
import { clone } from './util.js'

const categorias = () => [
  {
    id: 'aeb',
    nome: 'A&B',
    itens: [
      novoItem({ servico: 'Gelo', estimado: 1000, realizado: 1300 }), // estouro
      novoItem({ servico: 'Copos', estimado: 500, realizado: '' }),
    ],
  },
  {
    id: 'artistico',
    nome: 'Artístico',
    itens: [novoItem({ servico: 'DJs', estimado: 8000, realizado: 7000 })], // economia
  },
  { id: 'marketing', nome: 'Marketing', itens: [novoItem({ servico: 'Design', estimado: 2000 })] },
]

describe('fechamentoCustos', () => {
  it('desvio é contra o estimado DOS MESMOS itens, não contra o orçamento da categoria', () => {
    // A&B tem Gelo (1000 → 1300, estourou 300) e Copos (500, ainda sem
    // realizado). O desvio da categoria é +300 (estouro), não os −200 que a
    // conta antiga dava ao descontar o orçamento do Copos não pago — S1 de
    // 20/07/2026, o defeito que fazia o Fechamento contradizer a aba Custos.
    const f = fechamentoCustos(categorias())
    const aeb = f.porCategoria.find((c) => c.id === 'aeb')
    expect(aeb).toMatchObject({
      estimado: 1500, // o orçamento da categoria, que a tela mostra à parte
      estimadoComparavel: 1000, // o par honesto do realizado
      realizado: 1300,
      desvio: 300,
      estouro: true,
      nComRealizado: 1,
      nSemRealizado: 1,
      estimadoPendente: 500,
    })
    expect(aeb.desvioPct).toBeCloseTo(30)
    // Categoria com TODOS os itens realizados: as duas leituras coincidem.
    const art = f.porCategoria.find((c) => c.id === 'artistico')
    expect(art).toMatchObject({
      estimado: 8000,
      estimadoComparavel: 8000,
      realizado: 7000,
      desvio: -1000,
      estouro: false,
      nSemRealizado: 0,
    })
    expect(art.desvioPct).toBeCloseTo(-12.5)
  })

  it('marca estouro quando o realizado passa do estimado', () => {
    const f = fechamentoCustos([
      { id: 'x', nome: 'X', itens: [novoItem({ estimado: 1000, realizado: 1300 })] },
    ])
    expect(f.porCategoria[0]).toMatchObject({ desvio: 300, estouro: true })
    expect(f.porCategoria[0].desvioPct).toBeCloseTo(30)
  })

  it('categoria sem nenhum realizado não ganha desvio (sem número inventado)', () => {
    const mkt = fechamentoCustos(categorias()).porCategoria.find((c) => c.id === 'marketing')
    expect(mkt).toMatchObject({ temRealizado: false, desvio: null, desvioPct: null, estouro: false })
  })

  it('totais e desvio total', () => {
    const f = fechamentoCustos(categorias())
    expect(f.totalEstimado).toBe(11500) // orçamento de TODOS os itens
    expect(f.totalRealizado).toBe(8300)
    // Estimado dos itens já realizados: Gelo 1000 + DJs 8000 = 9000.
    expect(f.totalEstimadoComparavel).toBe(9000)
    // −700, e não os −3200 da conta antiga (que abatia o orçamento de Copos e
    // Design, ainda não pagos, como se fosse economia).
    expect(f.desvioTotal).toBe(-700)
    expect(f.desvioTotalPct).toBeCloseTo((-700 / 9000) * 100)
    expect(f.algumRealizado).toBe(true)
  })

  it('sem realizado nenhum: totais existem, desvios nulos', () => {
    const f = fechamentoCustos([
      { id: 'x', nome: 'X', itens: [novoItem({ estimado: 1000 })] },
    ])
    expect(f.algumRealizado).toBe(false)
    expect(f.desvioTotal).toBeNull()
    expect(f.desvioTotalPct).toBeNull()
  })

  it('vazio não quebra', () => {
    expect(fechamentoCustos([]).porCategoria).toEqual([])
    expect(fechamentoCustos(undefined).algumRealizado).toBe(false)
  })
})

const eventoComReceita = (rr) => {
  const e = novoEvento('Fechável')
  e.lotes = [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 500, somenteOtimista: false },
  ]
  e.cenariosConfig.realista.vendaPct = 90
  // Sugestão 42: evento NOVO nasce no modo bar por pessoa; este teste é do
  // valor FIXO — o modo é declarado (evento salvo antigo cai igual, em '').
  e.barModo = 'fixo'
  e.outrasReceitas = { bar: 10000, patrocinio: 3000 }
  e.receitaRealizada = rr
  e.categorias[0].itens = [novoItem({ servico: 'Gelo', estimado: 2000, realizado: 2500 })]
  return e
}

describe('fechamentoReceita', () => {
  it('compara bilheteria real com a bruta do realista e bar real com o bar previsto', () => {
    const e = eventoComReceita({ bilheteria: 40000, bar: 12000 })
    const r = computeCenario(e, 'realista') // bruta = 450 × 100 = 45000
    const f = fechamentoReceita(e, r)
    expect(f.linhas[0]).toMatchObject({ estimado: 45000, realizado: 40000, desvio: -5000 })
    expect(f.linhas[1]).toMatchObject({ estimado: 10000, realizado: 12000, desvio: 2000 })
    expect(f.linhas[1].desvioPct).toBeCloseTo(20)
    expect(f.totalRealizado).toBe(52000)
  })

  it('campo vazio/ausente → linha sem desvio, sem número inventado', () => {
    const e = eventoComReceita({ bilheteria: '', bar: '' })
    const f = fechamentoReceita(e, computeCenario(e, 'realista'))
    expect(f.algumRealizado).toBe(false)
    expect(f.linhas[0]).toMatchObject({ realizado: null, desvio: null })
    expect(f.totalRealizado).toBeNull()
  })

  it('evento antigo sem receitaRealizada funciona (comportamento atual)', () => {
    const e = eventoComReceita(undefined)
    delete e.receitaRealizada
    const f = fechamentoReceita(e, computeCenario(e, 'realista'))
    expect(f.algumRealizado).toBe(false)
  })

  // Open bar (Sessão Q — sugestão 27): o fechamento não cobra bar realizado.
  it('open bar: a linha de Bar sai da conta — só bilheteria; bar realizado salvo NÃO soma', () => {
    const e = { ...eventoComReceita({ bilheteria: 40000, bar: 12000 }), openBar: true }
    const f = fechamentoReceita(e, computeCenario(e, 'realista'))
    expect(f.linhas.map((l) => l.nome)).toEqual(['Bilheteria (bruta)'])
    expect(f.totalRealizado).toBe(40000) // sem os 12.000 de bar
    const res = resultadoRealizado(e, computeCenario(e, 'realista'))
    // Saída (B), 20/07/2026: a receita do card é a bilheteria LÍQUIDA — o
    // evento-padrão tem taxa 10% e cashback 5%, logo 40.000 − 4.000 + 2.000.
    // O que este teste guarda é o BAR fora da conta, e ele segue fora.
    expect(res.bilheteriaBruta).toBe(40000)
    expect(res.bar).toBe(0)
    expect(res.receita).toBe(38000)
  })

  it('openBar false/ausente/"torto": a linha de Bar continua na conta (comportamento atual)', () => {
    for (const openBar of [false, undefined, 'true', 1]) {
      const e = { ...eventoComReceita({ bilheteria: 40000, bar: 12000 }), openBar }
      const f = fechamentoReceita(e, computeCenario(e, 'realista'))
      expect(f.linhas.map((l) => l.nome)).toEqual(['Bilheteria (bruta)', 'Bar (lucro líquido)'])
      expect(f.totalRealizado).toBe(52000)
    }
  })
})

describe('montarBenchmarkDeEvento (promover a benchmark)', () => {
  const eventoFechado = () => {
    const e = novoEvento('Brisa fechada')
    e.data = '2026-03-14'
    e.publicoEstimado = 1200
    e.lotes = [
      { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 800, somenteOtimista: false },
      { id: 'lp', nome: 'Lote Porta', valor: 120, quantidade: 100, somenteOtimista: true },
      { id: 'lc', nome: 'Cortesia', valor: 0, quantidade: 50, somenteOtimista: false },
    ]
    e.categorias = [
      { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ estimado: 25000, realizado: 27340 })] },
      { id: 'artistico', nome: 'Artístico', padrao: true, itens: [novoItem({ estimado: 24000 })] },
      { id: 'cat-custom', nome: 'Categoria extra', padrao: false, itens: [novoItem({ estimado: 1000, realizado: 900 })] },
    ]
    e.receitaRealizada = { bilheteria: 186420, bar: 20000 }
    return e
  }

  it('usa valorConsiderado (realizado > estimado) e agrupa categoria custom em extras', () => {
    const bm = montarBenchmarkDeEvento(eventoFechado())
    expect(bm.custos.aeb).toBe(27340)
    expect(bm.custos.artistico).toBe(24000) // sem realizado → estimado
    expect(bm.custos.extras).toBe(900) // categoria custom cai em extras
    expect(bm.custos.marketing).toBeNull() // categoria zerada → null (como no importador)
    expect(bm.custoTotal).toBe(52240)
  })

  // Mudança de 20/07/2026, aprovada e datada pelo Marco (princípio 1). A conta
  // do benchmark promovido é a MESMA do card do Fechamento; a evidência, o diff
  // e a conta antiga transcrita estão em `promoverBenchmark.evidencia.test.js`.
  it('receita = a MESMA do card do Fechamento (líquida + bar + patrocínio fechado)', () => {
    const e = eventoFechado()
    const bm = montarBenchmarkDeEvento(e)
    const card = resultadoRealizado(e, computeCenario(e, 'realista'))

    // Fonte única: os três números do benchmark são os três do card.
    expect(bm.receita).toBe(card.receita)
    expect(bm.custoTotal).toBe(card.custos)
    expect(bm.lucro).toBe(card.resultado)

    // E não são mais a bilheteria bruta: era receita 186.420 e lucro 134.180.
    expect(bm.receita).not.toBe(186420)
    expect(card.bilheteriaLiquida).toBeLessThan(186420)
    expect(bm.publico).toBe(1200)
    expect(bm.custom).toBe(true)
    // A etiqueta da decisão 3: o promovido não carrega reserva de contingência.
    expect(bm.semReserva).toBe(true)
  })

  it('ticketMedio é bilheteria BRUTA ÷ público — a régua dos embutidos, não receita ÷ público', () => {
    const ev = eventoFechado()
    const bm = montarBenchmarkDeEvento(ev)
    const card = resultadoRealizado(ev, computeCenario(ev, 'realista'))

    // A conta vigente (Marco, 24/07/2026): bilheteria BRUTA ÷ público, lida da
    // MESMA fonte que a tela do Fechamento imprime — não uma segunda conta.
    expect(bm.ticketMedio).toBeCloseTo(card.bilheteriaBruta / bm.publico, 9)

    // E NÃO mais receita ÷ público: receita carrega bar e patrocínio, que não
    // são ingresso, e dividi-los por cabeça inflava o ticket acima do preço
    // que a pessoa pagou. Nesta festa a distância é medida:
    expect(bm.ticketMedio).not.toBeCloseTo(bm.receita / bm.publico, 6)

    // O que NÃO mudou (decisão 4 do Marco, 20/07/2026): segue longe da
    // CAPACIDADE dos lotes pagos (800), que não corresponde nem ao previsto
    // nem ao realizado.
    expect(bm.ticketMedio).not.toBeCloseTo(bm.receita / 800, 6)
    expect(bm.ticketMedio).not.toBeCloseTo(card.bilheteriaBruta / 800, 6)
  })

  it('sem bilheteria realizada informada, RECUSA — não inventa receita da capacidade dos lotes', () => {
    const e = eventoFechado()
    e.receitaRealizada = { bilheteria: '', bar: '' }
    // Era: R$ 80.000 tirados dos lotes esgotados (100 × 800), ingressos que
    // talvez nunca tenham sido vendidos (decisão 5 do Marco).
    expect(montarBenchmarkDeEvento(e)).toBeNull()
    expect(MOTIVO_SEM_BILHETERIA_REALIZADA).toMatch(/Fechamento/)
  })

  it('bar realizado sozinho NÃO basta: sem a bilheteria lançada a promoção segue recusando', () => {
    const e = eventoFechado()
    e.receitaRealizada = { bilheteria: '', bar: 20000 }
    // O card existiria (ele aceita qualquer linha realizada e completa o resto
    // pelo previsto), mas o benchmark é mais estrito de propósito: a bilheteria
    // é a maior parcela e ela viria de projeção.
    expect(resultadoRealizado(e, computeCenario(e, 'realista'))).not.toBeNull()
    expect(montarBenchmarkDeEvento(e)).toBeNull()
  })

  it('evento sem receita nenhuma → recusa', () => {
    const e = eventoFechado()
    e.receitaRealizada = { bilheteria: '', bar: '' }
    e.lotes = []
    expect(montarBenchmarkDeEvento(e)).toBeNull()
  })

  it('NÃO toca nos benchmarks embutidos e gera id próprio', () => {
    const congelados = clone(FIXED_BENCHMARKS)
    const bm = montarBenchmarkDeEvento(eventoFechado())
    expect(FIXED_BENCHMARKS).toEqual(congelados)
    expect(FIXED_BENCHMARKS.some((b) => b.id === bm.id)).toBe(false)
  })

  it('não muta o evento de origem', () => {
    const e = eventoFechado()
    const congelado = clone(e)
    montarBenchmarkDeEvento(e)
    expect(e).toEqual(congelado)
  })

  // DECISÃO 1 do Marco, 26/07/2026 (aprovada, com a conta na mesa —
  // princípio 1). MEDIDO: A&B estimado R$ 10.000, Marketing estimado
  // −R$ 3.000 (um estorno, sem realizado lançado) — `custoTotal` fechava em
  // 7.000, mas a categoria Marketing virava `null` e sumia do detalhe, e
  // `somaCustos(bm.custos)` dava 10.000: um gap de R$ 3.000 entre o total
  // exibido e a soma das categorias do MESMO benchmark.
  it('categoria com soma NEGATIVA aparece no detalhe com o valor real; categoria ZERO continua oculta', () => {
    const e = eventoFechado()
    e.categorias = [
      { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ estimado: 10000 })] },
      { id: 'marketing', nome: 'Marketing', padrao: true, itens: [novoItem({ estimado: -3000 })] },
    ]
    e.receitaRealizada = { bilheteria: 50000, bar: '' }
    const bm = montarBenchmarkDeEvento(e)

    expect(bm.custos.aeb).toBe(10000)
    // Antes: null (a mesma régua que zera categoria SEM item zerava também a
    // categoria com estorno) — agora aparece com o valor real, negativo.
    expect(bm.custos.marketing).toBe(-3000)
    // Categoria sem nenhum item — soma exatamente 0 — CONTINUA oculta
    // (comportamento intencional, preservado): não há o que mostrar.
    expect(bm.custos.locacao).toBeNull()
    expect(bm.custos.estrutura).toBeNull()
    expect(bm.custos.equipe).toBeNull()
    expect(bm.custos.artistico).toBeNull()
    expect(bm.custos.extras).toBeNull()
    expect(bm.custoTotal).toBe(7000)
    // A soma do detalhe por categoria volta a fechar com o total exibido —
    // o gap de R$ 3.000 medido no achado deixa de existir.
    expect(somaCustos(bm.custos)).toBe(bm.custoTotal)
  })

  // DECISÃO 2 do Marco, 26/07/2026 — a `obs` distingue REALIZADO de
  // PREVISTO quando alguma parcela (bar ou custos) entra pelo previsto.
  // Benchmarks já promovidos guardam a `obs` antiga gravada e não são
  // reescritos — as duas redações convivem, então o teste "tudo realizado"
  // também prova que a redação de sempre continua valendo nesse caso.
  // AS QUATRO ESPERAS ABAIXO GANHARAM A FRASE DA RÉGUA em 30/08/2026, e a
  // mudança é DE PROPÓSITO: a decisão 6 do Marco (25/07/2026, reafirmada por
  // questionário em 12/08) pede que a observação do benchmark diga qual conta
  // produziu o ticket. A frase vem de `reguaTicket.js`, a MESMA fonte da
  // etiqueta que a tela mostra — se as duas divergirem, esta espera cai.
  describe('obs distingue realizado de previsto', () => {
    const eventoObs = ({ barInformado, custosCompletos }) => {
      const e = novoEvento('Evento com obs')
      e.data = '2026-05-09'
      e.publicoEstimado = 100
      e.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 100, somenteOtimista: false }]
      e.barModo = 'fixo'
      e.outrasReceitas = { bar: 5000, patrocinio: 0 }
      e.categorias = [
        {
          id: 'aeb',
          nome: 'A&B',
          padrao: true,
          itens: [novoItem({ estimado: 3000, realizado: custosCompletos ? 3000 : '' })],
        },
      ]
      e.receitaRealizada = { bilheteria: 20000, bar: barInformado ? 6000 : '' }
      return e
    }

    it('tudo realizado (bar informado + custos todos com realizado): texto de sempre, sem mudança', () => {
      const bm = montarBenchmarkDeEvento(eventoObs({ barInformado: true, custosCompletos: true }))
      expect(bm.obs).toBe(
        'Promovido do fechamento de "Evento com obs" (09/05/2026) — bilheteria líquida realizada + bar + patrocínio fechado, menos os custos considerados. Sem reserva de contingência. Ticket médio = bilheteria bruta ÷ público (régua de 24/07/2026 em diante).'
      )
    })

    it('bar sem realizado lançado (entra pelo previsto): a obs nomeia "bar pelo previsto"', () => {
      const bm = montarBenchmarkDeEvento(eventoObs({ barInformado: false, custosCompletos: true }))
      expect(bm.obs).toBe(
        'Promovido do fechamento de "Evento com obs" (09/05/2026) — bilheteria líquida realizada + bar pelo previsto + patrocínio fechado, menos os custos realizados. Sem reserva de contingência. Ticket médio = bilheteria bruta ÷ público (régua de 24/07/2026 em diante).'
      )
    })

    it('custo sem realizado lançado (entra pelo previsto): a obs nomeia os custos', () => {
      const bm = montarBenchmarkDeEvento(eventoObs({ barInformado: true, custosCompletos: false }))
      expect(bm.obs).toBe(
        'Promovido do fechamento de "Evento com obs" (09/05/2026) — bilheteria líquida realizada + bar + patrocínio fechado, menos os custos considerados (parte pelo previsto). Sem reserva de contingência. Ticket médio = bilheteria bruta ÷ público (régua de 24/07/2026 em diante).'
      )
    })

    it('open bar: a linha de bar nem entra na conta — nunca é "pelo previsto"', () => {
      const e = eventoObs({ barInformado: false, custosCompletos: true })
      e.openBar = true
      const bm = montarBenchmarkDeEvento(e)
      expect(bm.obs).toBe(
        'Promovido do fechamento de "Evento com obs" (09/05/2026) — bilheteria líquida realizada + bar + patrocínio fechado, menos os custos considerados. Sem reserva de contingência. Ticket médio = bilheteria bruta ÷ público (régua de 24/07/2026 em diante).'
      )
    })
  })
})

describe('resultadoRealizado', () => {
  // Saída (B) do Marco, 20/07/2026: a receita do card virou bilheteria
  // LÍQUIDA + bar + patrocínio fechado. Este evento tem taxa 10% e cashback 5%
  // (padrão de `novoEvento`) e nenhum patrocínio na lista `patrocinios`:
  //   40.000 − 4.000 + 2.000 = 38.000 de líquida, + 12.000 de bar = 50.000.
  // O bar entra INTEIRO — já é lucro líquido, não passa por taxa nem cashback.
  it('tudo realizado dos dois lados: bilheteria líquida + bar − custos, e `completo`', () => {
    const e = eventoComReceita({ bilheteria: 40000, bar: 12000 })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r).toMatchObject({
      bilheteriaBruta: 40000,
      taxa: 4000,
      cashback: 2000,
      bilheteriaLiquida: 38000,
      bar: 12000,
      patrocinio: 0,
      receita: 50000,
      custos: 2500,
      resultado: 47500,
      completo: true,
      custosPendentes: 0,
      receitaPrevista: 0,
      sinal: 'lucro',
    })
  })

  it('sem receita realizada → null (nada aparece)', () => {
    const e = eventoComReceita({ bilheteria: '', bar: '' })
    expect(resultadoRealizado(e, computeCenario(e, 'realista'))).toBeNull()
  })

  // O CASO QUE ABRIU O ACHADO (Marco, 25/07/2026, aprovado e datado — decisão
  // "zero e negativo no realizado valem"). Bar previsto R$ 8.000, realizado
  // −R$ 2.000 (prejuízo de bar é FATO, não erro de digitação — a UI nem trava
  // negativo aqui: FechamentoTab.jsx/MoneyInput do bar não usa FAIXA_CUSTO).
  //
  // ANTES de 25/07/2026, `temValor` exigia `num(v) > 0`: −2.000 caía no MESMO
  // balde de "não preenchi", e o card voltava ao bar PREVISTO (R$ 8.000). Com
  // bilheteria 10.000 e custos 7.750 (fixos, para isolar só o efeito do bar):
  //   errado (bar = previsto 8.000) ... 10.000 + 8.000 − 7.750 = +R$ 10.250
  //   certo  (bar = realizado −2.000) .. 10.000 − 2.000 − 7.750 = +R$    250
  // R$ 10.000 de diferença — o tamanho exato do bar que nunca aconteceu.
  it('bar realizado NEGATIVO (−R$ 2.000, previsto R$ 8.000) conta o prejuízo: resultado +250, nunca +10.250', () => {
    const e = novoEvento('Bar no prejuízo')
    e.taxaBilheteria = 0
    e.cashbackPct = 0
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: 8000, patrocinio: '' }
    e.receitaRealizada = { bilheteria: 10000, bar: -2000 }
    e.categorias[0].itens = [novoItem({ servico: 'Custo fixo', estimado: 7750, realizado: 7750 })]

    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.bilheteriaInformada).toBe(true)
    expect(r.barInformado).toBe(true)
    expect(r.bar).toBe(-2000)
    expect(r.receita).toBe(8000) // 10.000 de bilheteria líquida − 2.000 de bar
    expect(r.custos).toBe(7750)
    expect(r.resultado).toBe(250)
    expect(r.resultado).not.toBe(10250) // o número que a tela mostrava até 24/07/2026
    expect(r.sinal).toBe('lucro')
    expect(r.completo).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// S1 de 21/07/2026 — o card "Resultado realizado" anunciava LUCRO FALSO, em
// verde, a poucos centímetros da tabela que dizia ESTOURO em vermelho.
//
// A conta antiga era `receita informada INTEIRA − custos JÁ PAGOS`: base cheia
// de um lado, base parcial do outro. O orçamento de quem ainda não pagou sumia
// da conta e reaparecia como lucro.
// ───────────────────────────────────────────────────────────────────────────

// O evento medido pelo revisor, ao pé da letra.
const eventoDoRepro = () => {
  const e = novoEvento('Repro do S1')
  e.openBar = true // sem linha de bar: a receita é só a bilheteria informada
  e.receitaRealizada = { bilheteria: 30000, bar: '' }
  e.categorias = [
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        novoItem({ servico: 'Bebidas', estimado: 10000, realizado: 11000 }),
        novoItem({ servico: 'Comida', estimado: 12000, realizado: '' }),
        novoItem({ servico: 'Gelo', estimado: 8000, realizado: '' }),
      ],
    },
  ]
  return e
}

describe('S1 — card e tabela do Fechamento contam a MESMA história', () => {
  it('o repro do revisor: o card dizia +19.000 em VERDE; agora diz −1.000 de PREJUÍZO', () => {
    const e = eventoDoRepro()
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))

    // A conta honesta: bilheteria LÍQUIDA (saída B, 20/07/2026 — 30.000
    // − 3.000 de taxa + 1.500 de cashback) − 11.000 (pago) − 20.000 (ainda por
    // pagar). O que este teste guarda é o CUSTO em base cheia; ele segue cheio,
    // e o prejuízo ficou ainda maior com a taxa entrando na conta.
    expect(r.bilheteriaBruta).toBe(30000)
    expect(r.receita).toBe(28500)
    expect(r.custos).toBe(31000)
    expect(r.resultado).toBe(-2500)
    expect(r.sinal).toBe('prejuizo')

    // O número ANTIGO — 30.000 − 11.000 = 19.000 — não pode mais sair daqui.
    expect(r.resultado).not.toBe(19000)

    // E o card sabe declarar o que ainda é projeção.
    expect(r).toMatchObject({
      completo: false,
      custosRealizados: 11000,
      custosPendentes: 20000,
      nItens: 3,
      nComRealizado: 1,
      nSemRealizado: 2,
      receitaInformada: 28500,
      receitaPrevista: 0,
      linhasPrevistas: [],
    })
  })

  it('a tabela logo acima do card segue dizendo ESTOURO — e agora os dois concordam', () => {
    const e = eventoDoRepro()
    const f = fechamentoCustos(e.categorias)
    const aeb = f.porCategoria.find((c) => c.id === 'aeb')
    // A linha da tabela: +1.000 (+10%), vermelha, selo ESTOURO, 1 de 3 itens.
    expect(aeb).toMatchObject({
      desvio: 1000,
      estouro: true,
      nComRealizado: 1,
      nItens: 3,
      estimadoPendente: 20000,
    })
    expect(aeb.desvioPct).toBeCloseTo(10)

    // O card não pode estar em verde enquanto a tabela está em vermelho.
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.sinal).toBe('prejuizo')
  })

  it('o custo do card é sempre valorConsiderado de TODOS os itens — nunca base parcial', () => {
    // A invariante que fecha esta família de bugs de uma vez: qualquer que seja
    // a combinação de realizados, o custo do card é a MESMA soma que o resto do
    // app usa (custoTotal dos cenários, contingência, benchmark promovido).
    const combos = [
      ['', '', ''], // nenhum realizado
      [11000, '', ''], // 1 de 3 (o repro)
      [11000, 12500, ''], // 2 de 3
      [11000, 12500, 7500], // todos
      [9000, '', ''], // economia no que já pagou
      [10000, '', ''], // exatamente em linha
    ]
    for (const [b, c, g] of combos) {
      const e = eventoDoRepro()
      e.categorias[0].itens[0].realizado = b
      e.categorias[0].itens[1].realizado = c
      e.categorias[0].itens[2].realizado = g
      const r = resultadoRealizado(e, computeCenario(e, 'realista'))
      const esperado = e.categorias[0].itens.reduce((s, i) => s + valorConsiderado(i), 0)
      expect(r.custos).toBe(esperado)
      // e o resultado fecha com os componentes que o card imprime
      expect(r.custos).toBe(r.custosRealizados + r.custosPendentes)
      expect(r.receita).toBe(r.receitaInformada + r.receitaPrevista)
      expect(r.resultado).toBe(r.receita - r.custos)
    }
  })

  it('nenhum realizado de custo: o card cobra o orçamento INTEIRO, não zero', () => {
    const e = eventoDoRepro()
    for (const i of e.categorias[0].itens) i.realizado = ''
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.custos).toBe(30000) // 10.000 + 12.000 + 8.000
    expect(r.custosRealizados).toBe(0)
    // Saída (B), 20/07/2026: a receita é a LÍQUIDA (30.000 − 3.000 + 1.500), e
    // por isso o empate virou um prejuízo de 1.500 — a taxa que a bilheteria
    // retém sempre existiu, ela é que não aparecia na conta do card.
    expect(r.resultado).toBe(-1500)
    expect(r.sinal).toBe('prejuizo')
    expect(r.completo).toBe(false)
  })

  it('economia real vira lucro real (o conserto não pinta tudo de vermelho)', () => {
    const e = eventoDoRepro()
    e.categorias[0].itens[0].realizado = 9000
    e.categorias[0].itens[1].realizado = 10000
    e.categorias[0].itens[2].realizado = 6000
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.custos).toBe(25000)
    expect(r.resultado).toBe(3500) // 28.500 de líquida − 25.000
    expect(r.sinal).toBe('lucro')
    expect(r.completo).toBe(true) // sem pendência de custo NEM de receita
  })

  it('receita com linha ainda sem realizado entra pelo PREVISTO — nunca como zero', () => {
    // O defeito ESPELHADO: se só a bilheteria fosse informada e o bar entrasse
    // como 0, a receita ficaria parcial contra um custo cheio — a mesma base
    // misturada, trocada de lado.
    const e = eventoComReceita({ bilheteria: 40000, bar: '' })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.receitaInformada).toBe(38000) // a bilheteria LÍQUIDA informada
    expect(r.receitaPrevista).toBe(10000) // outrasReceitas.bar previsto
    expect(r.receita).toBe(48000)
    expect(r.linhasPrevistas).toEqual(['Bar (lucro líquido)'])
    expect(r.completo).toBe(false)
  })
})

// Teste-de-matar da rodada de mutação de 21/07/2026 (H3-L item 3): a guarda
// `estimado > 0` do desvioPct sobreviveu a `>=` — nada pinava que estimado
// ZERO não divide. Sob a mutação, (500−0)/0 viraria Infinity exibido como
// percentual. FALHA sob ela: provado aplicando `>=` à mão num worktree (1
// falha, cirúrgica); a bateria oficial lê o HEAD — placar 37/3 pós-commit.
describe('fechamentoReceita — estimado zero não divide', () => {
  it('bilheteria estimada R$ 0 com realizado informado: desvio absoluto existe, desvioPct é null (nunca Infinity)', () => {
    const e = eventoComReceita({ bilheteria: 500, bar: '' })
    const linhas = fechamentoReceita(e, { bruta: 0, bar: 0 }).linhas
    const bilheteria = linhas.find((l) => l.nome === 'Bilheteria (bruta)')
    expect(bilheteria).toMatchObject({ estimado: 0, realizado: 500, desvio: 500, desvioPct: null })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SEGUNDA decisão do Marco de 26/07/2026 (o achado saiu da verificação
// adversarial da primeira): "zero" é zero ATÉ O CENTAVO.
//
// A soma das categorias é de ponto flutuante. Com R$ 10.000,10 + R$ 20.000,20
// − R$ 30.000,30 — matematicamente zero — ela sai 3,637978807091713e-12, e
// contra `=== 0` isso é "diferente de zero": a categoria VAZIA aparecia no
// detalhe do benchmark. A metade "categoria sem item continua oculta" da regra
// aprovada de manhã estava falhando calada.
// ─────────────────────────────────────────────────────────────────────────────
describe('montarBenchmarkDeEvento — "zero" é zero até o centavo (Marco, 26/07/2026)', () => {
  // Mesma montagem do teste da DECISÃO 1, logo acima — evento fechado, com as
  // categorias trocadas por uma só, para o resíduo ser o único protagonista.
  // Evento fechado mínimo, montado aqui (o `eventoFechado` do bloco acima é
  // local àquele describe): uma categoria só, para o resíduo ser o único
  // protagonista.
  const eventoComAeB = (itensAeB) => {
    const e = novoEvento('Resíduo de centavo')
    e.data = '2026-03-14'
    e.publicoEstimado = 1200
    e.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 800, somenteOtimista: false }]
    e.categorias = [{ id: 'aeb', nome: 'A&B', padrao: true, itens: itensAeB }]
    e.receitaRealizada = { bilheteria: 50000, bar: '' }
    return e
  }
  const it_ = (estimado) => novoItem({ estimado })

  it('categoria que soma zero SÓ por resíduo de ponto flutuante continua oculta', () => {
    // A soma crua NÃO é zero exato — é este resíduo que causava o vazamento.
    const somaCrua = 10000.1 + 20000.2 - 30000.3
    expect(somaCrua).not.toBe(0)
    expect(Math.abs(somaCrua)).toBeLessThan(0.005)

    const bm = montarBenchmarkDeEvento(eventoComAeB([it_(10000.1), it_(20000.2), it_(-30000.3)]))
    expect(bm.custos.aeb).toBe(null)
  })

  it('categoria com UM centavo de verdade continua aparecendo — a guarda não engole dinheiro', () => {
    const bm = montarBenchmarkDeEvento(eventoComAeB([it_(10000.1), it_(-10000.09)]))
    expect(bm.custos.aeb).not.toBe(null)
    expect(bm.custos.aeb).toBeCloseTo(0.01, 6)
  })

  it('categoria NEGATIVA de verdade continua aparecendo (a regra da manhã segue de pé)', () => {
    const bm = montarBenchmarkDeEvento(eventoComAeB([it_(10000), it_(-13000)]))
    expect(bm.custos.aeb).toBe(-3000)
  })

  it('categoria realmente vazia continua oculta', () => {
    const bm = montarBenchmarkDeEvento(eventoComAeB([]))
    expect(bm.custos.aeb).toBe(null)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // A RÉGUA É ARREDONDAR, NÃO TRUNCAR (27/07/2026).
  //
  // Os quatro testes acima provam que a régua de 26/07 FAZ o que deve. Nenhum
  // deles prova que ela deixaria de fazer se alguém trocasse o `Math.round` por
  // `Math.floor` em `fechamento.js:256` — medido: com a troca, os 2.279 testes
  // da casa passam verdes. Truncar responde "sobra algum centavo?" de um jeito
  // torto nos dois sinais ao mesmo tempo:
  //   • no positivo ENGOLE dinheiro — R$ 0,006 vira zero e a categoria some;
  //   • no negativo INVENTA linha — −R$ 0,0000000000036 vira −1 centavo e a
  //     categoria vazia volta a aparecer.
  // Os dois testes abaixo cobram um lado cada, com dinheiro de festa.
  // ───────────────────────────────────────────────────────────────────────────

  it('meio centavo LARGO continua aparecendo: o custoTotal cobra R$ 0,01 e a categoria tem de explicá-lo', () => {
    // A carga de gelo de R$ 4.500,00 não chegou e o fornecedor estornou
    // R$ 4.499,994 — o centavo quebrado vem do rateio da nota dele entre três
    // festas. Sobra R$ 0,006: arredondado a centavos isso é UM CENTAVO de
    // dinheiro de verdade, e é exatamente o que o `custoTotal` do MESMO
    // benchmark carrega (medido: R$ 0,01, porque o card soma em centavos).
    // Se a régua truncasse, a categoria sumiria da foto enquanto o total
    // seguiria cobrando o centavo — o benchmark afirmando um dinheiro que
    // nenhuma categoria explica, que é o defeito que a decisão de 26/07/2026
    // fechou, um centavo menor.
    const bm = montarBenchmarkDeEvento(eventoComAeB([it_(4500), it_(-4499.994)]))
    expect(bm.custos.aeb).not.toBe(null)
    expect(bm.custos.aeb).toBeCloseTo(0.006, 6)
    expect(bm.custoTotal).toBe(0.01)
  })

  it('resíduo de ponto flutuante NEGATIVO também continua oculto — sem linha fantasma de R$ -0,00', () => {
    // Gêmeo do primeiro teste deste bloco, com os lançamentos na ordem inversa:
    // o open bar de R$ 30.000,30 foi cancelado e o fornecedor devolveu tudo em
    // dois estornos (R$ 10.000,10 + R$ 20.000,20). A categoria fecha em ZERO de
    // verdade — não há o que mostrar — mas em ponto flutuante ela fecha em
    // −3,6e−12. Quem decide o SINAL desse resíduo é a ordem em que os
    // lançamentos foram digitados, e o dono não escolhe essa ordem: se a régua
    // truncasse, metade dos cancelamentos voltaria à foto do evento como uma
    // categoria de R$ -0,00.
    const somaCrua = 30000.3 - 10000.1 - 20000.2
    expect(somaCrua).toBeLessThan(0)
    expect(Math.abs(somaCrua)).toBeLessThan(0.005)

    const bm = montarBenchmarkDeEvento(eventoComAeB([it_(30000.3), it_(-10000.1), it_(-20000.2)]))
    expect(bm.custos.aeb).toBe(null)
  })

  it('a régua GÊMEA do importador responde igual aos dois casos (benchmarks.js, 27/07/2026)', () => {
    // A mesma pergunta tem duas estradas: promover o evento fechado e importar
    // a planilha. Duas réguas para a mesma decisão foi como o defeito de
    // 27/07/2026 nasceu, então os mesmos dois números do gelo e do open bar
    // cancelado passam também pela cópia do importador.
    expect(consolidarCustosDePlanilha({ aeb: 4500 - 4499.994 }).custos.aeb).toBeCloseTo(0.006, 6)
    expect(consolidarCustosDePlanilha({ aeb: 30000.3 - 10000.1 - 20000.2 }).custos.aeb).toBeNull()
  })
})
