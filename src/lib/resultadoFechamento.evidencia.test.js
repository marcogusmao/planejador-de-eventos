// EVIDÊNCIA + TRAVA do card "Resultado do evento" (aba Fechamento).
//
// Este arquivo nasceu como EVIDÊNCIA pura — a conta "certo × errado" do S1
// aberto, na forma que os princípios 1 e 8 do CLAUDE.md exigem ANTES de
// qualquer mudança: números na mesa, decisão do Marco depois. A decisão veio em
// 20/07/2026 e o arquivo virou o que ele sempre foi para ser: a trava do
// comportamento escolhido, com a história de como se chegou nele preservada.
//
// ---------------------------------------------------------------------------
// O SINTOMA (registrado no HANDOFF de 19–20/07/2026)
// ---------------------------------------------------------------------------
// Com contingência 15%, o card do Fechamento mostrava +R$ 4.000 em VERDE
// enquanto Home e Cenários pintavam −R$ 650 em VERMELHO, para o MESMO evento no
// MESMO dia.
//
// ---------------------------------------------------------------------------
// A CAUSA, MEDIDA (e não a que o handoff supunha)
// ---------------------------------------------------------------------------
// A base de CUSTO dos dois lados era rigorosamente o mesmo número — verificado
// item a item e por varredura adversarial de 4.000 eventos aleatórios:
//
//     conf.realizado + conf.estimadoPendente  ===  custos.totalConsiderado
//
// O card não "refazia a conta errada" dos custos: ele parava uma etapa antes. As
// divergências eram SEIS, não uma:
//
//   ESTRUTURAIS (o card não aplicava)
//     1. contingência ................. custoTotal = (considerado + cont) × …
//     2. ajustePct do cenário ......... … × (1 + ajustePct/100)
//     3. bilheteria BRUTA × LÍQUIDA ... −taxa +cashback; no repasse
//                                       (`taxaPagaPor: 'cliente'`) é só +cashback
//     4. patrocínio fechado ........... o card omitia inteiramente
//
//   DE PROPÓSITO (é a razão de existir do card)
//     5. bilheteria realizada × prevista
//     6. bar realizado × previsto
//
// ---------------------------------------------------------------------------
// POR QUE O CONSERTO SUGERIDO NO HANDOFF NÃO SERVIA COMO ESTAVA
// ---------------------------------------------------------------------------
// O handoff propôs "fazer o card usar o mesmo custoTotal/lucro que
// computeCenario já produz". Isso apagaria as divergências 5 e 6 — ou seja,
// apagaria o REALIZADO. O card deixaria de ser fechamento e viraria uma segunda
// cópia da previsão. O que dava para unificar era a base de CUSTO; a receita,
// não.
//
// ---------------------------------------------------------------------------
// A DECISÃO — SAÍDA (B), "DINHEIRO REAL" (Marco, aprovada e datada 20/07/2026)
// ---------------------------------------------------------------------------
// Três saídas coerentes estavam na mesa:
//   (A) ESPELHO DO CENÁRIO — o card repetiria o lucro do realista. Descartada:
//       enterra o realizado e declara como "resultado" uma contingência que
//       ninguém pagou.
//   (B) DINHEIRO REAL — bilheteria LÍQUIDA realizada + bar realizado +
//       patrocínio FECHADO − custos considerados. ESCOLHIDA.
//   (C) HÍBRIDO — contingência só sobre a parte ainda pendente. Descartada:
//       inventa uma terceira régua de contingência, que passaria a existir só
//       nesta tela.
//
// O porquê da (B), na palavra do critério: o card responde "ganhamos dinheiro
// nesta festa?", e contingência é RESERVA, não despesa — com tudo pago e tudo
// recebido, um buffer de 15% por cima é dinheiro que não vai sair do caixa de
// ninguém. O `ajustePct` do cenário cai pela mesma razão: é régua de projeção.
// As divergências 3 e 4 (líquida e patrocínio) eram erro puro e foram
// consertadas — o card errava nos DOIS sentidos ao mesmo tempo, subestimando ao
// jogar fora patrocínio recebido e superestimando ao ignorar a taxa retida.
//
// CONSEQUÊNCIA ACEITA: o card continua PROPOSITALMENTE diferente da Home. Por
// isso `resultadoRealizado` devolve a ponte (`contingenciaDoCenario`,
// `ajusteDoCenario`, `lucroDoCenario`) e a tela é obrigada a dizer, com número,
// por que difere. Número certo que parece errado custa quase o mesmo que número
// errado (PADRÃO DA CASA §3).
import { describe, it, expect } from 'vitest'
import { resultadoRealizado } from './fechamento.js'
import { computeCenario, custosPorCategoria, contingencia } from './calc.js'
import { confrontoCustos } from './confrontoCustos.js'
import { novoEvento, novoItem } from './defaults.js'

// Evento-régua: os números do handoff, isolados para a contingência ser a
// ÚNICA diferença — taxa 0, cashback 0, sem patrocínio, sem bar (open bar).
const base = (over = {}) => ({
  ...novoEvento('Evidência S1'),
  contingenciaPct: 15,
  taxaBilheteria: 0,
  cashbackPct: 0,
  openBar: true,
  patrocinios: [],
  outrasReceitas: { bar: '', patrocinio: '' },
  lotes: [{ id: 'l1', nome: 'Único', valor: 350, quantidade: 100 }],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 100, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
  receitaRealizada: { bilheteria: 35000, bar: '' },
  ...over,
})

// 31.000 de custo considerado, TUDO já realizado.
const CUSTOS_FECHADOS = [
  { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Bebidas', estimado: 20000, realizado: 20000 })] },
  { id: 'artistico', nome: 'Artístico', itens: [novoItem({ servico: 'DJs', estimado: 11000, realizado: 11000 })] },
]

// Mesmos 31.000, mas os 11.000 do DJ ainda NÃO foram pagos.
const CUSTOS_PARCIAIS = [
  { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Bebidas', estimado: 20000, realizado: 20000 })] },
  { id: 'artistico', nome: 'Artístico', itens: [novoItem({ servico: 'DJs', estimado: 11000 })] },
]

describe('a base de CUSTO nunca foi o problema — e continua intocada', () => {
  const evento = base({ categorias: CUSTOS_FECHADOS })

  it('custo do card === totalConsiderado do resto do app, exato', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.custos).toBe(31000)
    expect(custosPorCategoria(evento.categorias).totalConsiderado).toBe(31000)
    expect(r.custosRealizados + r.custosPendentes).toBe(31000)
  })
})

// ---------------------------------------------------------------------------
// "custou zero" (Marco, aprovado e datado 20/07/2026) — fixture MARCADA no
// cadeado. Antes desta sessão NENHUMA fixture de resultadoFechamento tinha item
// marcado; o invariante `conf.realizado + conf.estimadoPendente ===
// totalConsiderado` ficava CEGO para o campo novo. Aqui ele passa a ver.
// ---------------------------------------------------------------------------
describe('item "custou zero" conta como realizado 0, e a base de custo continua fechando', () => {
  // 20.000 de Bebidas realizado + Banda de permuta (orçada 11.000, custou 0).
  const CUSTOS_MARCADO = [
    { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Bebidas', estimado: 20000, realizado: 20000 })] },
    {
      id: 'artistico',
      nome: 'Artístico',
      itens: [novoItem({ servico: 'Banda (permuta)', estimado: 11000, custouZero: true })],
    },
  ]
  const evento = base({ categorias: CUSTOS_MARCADO })

  it('a Banda marcada vale 0, sai da coluna de pendentes, e o invariante das duas telas fecha', () => {
    const conf = confrontoCustos(CUSTOS_MARCADO)
    const custos = custosPorCategoria(CUSTOS_MARCADO)
    // a Banda de permuta vale 0; só as Bebidas ficam de pé no custo
    expect(custos.totalConsiderado).toBe(20000)
    // o item marcado CONTA como realizado (0) — acaba o orçamento fantasma
    expect(conf.nComRealizado).toBe(2)
    expect(conf.nSemRealizado).toBe(0)
    expect(conf.estimadoPendente).toBe(0)
    expect(conf.realizado).toBe(20000)
    // O CADEADO do S1, agora COM item marcado na fixture (antes era cego a ele).
    expect(conf.realizado + conf.estimadoPendente).toBe(custos.totalConsiderado)
  })

  it('o card do Fechamento usa a MESMA base de custo — 20.000, não os 31.000 orçados', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.custos).toBe(20000)
    expect(r.custosRealizados).toBe(20000)
    expect(r.custosPendentes).toBe(0)
    expect(r.nSemRealizado).toBe(0)
    // dinheiro real: 35.000 de bilheteria − 20.000 de custo = +15.000
    expect(r.resultado).toBe(15000)
  })
})

describe('SAÍDA (B) — evento 100% fechado, sem taxa nem patrocínio', () => {
  const evento = base({ categorias: CUSTOS_FECHADOS })

  it('35.000 − 31.000 = +4.000, e o card pode se chamar "Resultado realizado"', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.bilheteriaBruta).toBe(35000)
    expect(r.taxa).toBe(0)
    expect(r.cashback).toBe(0)
    expect(r.bilheteriaLiquida).toBe(35000)
    expect(r.bar).toBe(0) // open bar: fora da conta
    expect(r.patrocinio).toBe(0)
    expect(r.receita).toBe(35000)
    expect(r.resultado).toBe(4000)
    expect(r.sinal).toBe('lucro')
    expect(r.completo).toBe(true)
  })

  it('a contingência NÃO entra — e a ponte diz na tela por que a Home difere', () => {
    const c = computeCenario(evento, 'realista')
    const r = resultadoRealizado(evento, c)
    // Os Cenários seguem em −650: é a previsão, com o buffer por cima.
    expect(c.lucro).toBe(-650)
    expect(c.contingencia).toBe(4650) // 15% de 31.000
    expect(contingencia(31000, 15)).toBe(4650)
    // A diferença INTEIRA entre as duas telas é a contingência, e o card
    // carrega os três números para poder dizer isso com R$ na frente.
    expect(r.resultado - c.lucro).toBe(4650)
    expect(r.contingenciaDoCenario).toBe(4650)
    expect(r.ajusteDoCenario).toBe(0)
    expect(r.lucroDoCenario).toBe(-650)
  })

  it('com tudo pago e tudo recebido, a contingência é ficção — foi o critério da escolha', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.nSemRealizado).toBe(0)
    expect(r.receitaPrevista).toBe(0)
    expect(r.linhasPrevistas).toEqual([])
  })
})

describe('SAÍDA (B) — taxa, cashback e patrocínio: os dois erros consertados', () => {
  // Taxa 10% e cashback 5% sobre 35.000; patrocínio confirmado de 5.000.
  const evento = base({
    categorias: CUSTOS_FECHADOS,
    taxaBilheteria: 10,
    cashbackPct: 5,
    patrocinios: [{ id: 'p1', nome: 'Marca', valor: 5000, estagio: 'confirmado' }],
  })

  it('33.250 (líquida) + 5.000 (patrocínio) − 31.000 (custos) = +7.250', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.bilheteriaBruta).toBe(35000)
    expect(r.taxa).toBe(3500)
    expect(r.cashback).toBe(1750)
    expect(r.bilheteriaLiquida).toBe(33250) // 35.000 − 3.500 + 1.750
    expect(r.patrocinio).toBe(5000)
    expect(r.receita).toBe(38250)
    expect(r.custos).toBe(31000)
    expect(r.resultado).toBe(7250)
    // O número ANTIGO — bruta − custos = 4.000 — não sai mais daqui.
    expect(r.resultado).not.toBe(4000)
  })

  it('cada passo da conta tem seu número, para a tela poder somar na frente do leitor', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.bilheteriaBruta - r.taxa + r.cashback).toBe(r.bilheteriaLiquida)
    expect(r.bilheteriaLiquida + r.bar + r.patrocinio).toBe(r.receita)
    expect(r.receita - r.custos).toBe(r.resultado)
    expect(r.taxaCliente).toBe(false)
  })

  it('patrocínio em NEGOCIAÇÃO não entra — só confirmado ou recebido', () => {
    const e = base({
      categorias: CUSTOS_FECHADOS,
      patrocinios: [
        { id: 'p1', nome: 'Fechada', valor: 5000, estagio: 'confirmado' },
        { id: 'p2', nome: 'Conversando', valor: 9000, estagio: 'proposta' },
      ],
    })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.patrocinio).toBe(5000)
    expect(r.patrocinioPotencial).toBe(9000)
    expect(r.resultado).toBe(9000) // 35.000 + 5.000 − 31.000
  })
})

describe('SAÍDA (B) — modo REPASSE: a taxa existe e NÃO desconta', () => {
  // `taxaPagaPor: 'cliente'` (sugestão 29b): quem paga a taxa é o comprador do
  // ingresso, por fora. Ela continua sendo calculada — a tela precisa nomeá-la —
  // mas somar ou subtrair errado aqui INVERTE o sinal do resultado do evento.
  const evento = base({
    categorias: CUSTOS_FECHADOS,
    taxaBilheteria: 10,
    cashbackPct: 5,
    taxaPagaPor: 'cliente',
  })

  it('35.000 + 1.750 de cashback = 36.750 de líquida → +5.750 (e não +2.250)', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.taxaCliente).toBe(true)
    expect(r.taxa).toBe(3500) // calculada, para a tela poder explicar
    expect(r.bilheteriaLiquida).toBe(36750) // sem subtrair a taxa
    expect(r.resultado).toBe(5750)
    // O que sairia se o modo repasse fosse ignorado (taxa descontando):
    expect(r.resultado).not.toBe(2250)
  })

  it('o card espelha `bilheteria()` de calc.js no mesmo evento', () => {
    const c = computeCenario(evento, 'realista')
    const r = resultadoRealizado(evento, c)
    // Mesma bruta dos dois lados (realizado informado == previsto aqui), logo
    // mesma líquida: a cópia vigiada de receitaLiquida.js não desviou.
    expect(c.bruta).toBe(35000)
    expect(r.bilheteriaLiquida).toBe(c.liquida)
  })
})

describe('SAÍDA (B) — evento PARCIAL: a base cheia dos dois lados sobrevive', () => {
  const evento = base({ categorias: CUSTOS_PARCIAIS })

  it('os 11.000 ainda não pagos continuam na conta, pelo estimado', () => {
    const r = resultadoRealizado(evento, computeCenario(evento, 'realista'))
    expect(r.custosRealizados).toBe(20000)
    expect(r.custosPendentes).toBe(11000)
    expect(r.custos).toBe(31000)
    expect(r.nSemRealizado).toBe(1)
    expect(r.completo).toBe(false)
    expect(r.resultado).toBe(4000)
  })

  it('bar ainda sem realizado entra pelo PREVISTO, nunca como zero', () => {
    const e = base({
      categorias: CUSTOS_FECHADOS,
      openBar: false,
      barModo: 'fixo',
      outrasReceitas: { bar: 8000, patrocinio: '' },
      receitaRealizada: { bilheteria: 35000, bar: '' },
    })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.bar).toBe(8000)
    expect(r.barInformado).toBe(false)
    expect(r.receitaPrevista).toBe(8000)
    expect(r.linhasPrevistas).toEqual(['Bar (lucro líquido)'])
    expect(r.resultado).toBe(12000) // 35.000 + 8.000 − 31.000
  })

  it('o bar NÃO passa por taxa nem cashback — já é lucro líquido', () => {
    const e = base({
      categorias: CUSTOS_FECHADOS,
      taxaBilheteria: 10,
      cashbackPct: 5,
      openBar: false,
      barModo: 'fixo',
      outrasReceitas: { bar: 10000, patrocinio: '' },
      receitaRealizada: { bilheteria: 35000, bar: 10000 },
    })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.bar).toBe(10000) // inteiro, sem −10% nem +5%
    expect(r.receita).toBe(43250) // 33.250 + 10.000
    expect(r.resultado).toBe(12250)
  })
})

describe('SAÍDA (B) — o resultado ainda sabe ser prejuízo', () => {
  it('bilheteria realizada baixa contra custo cheio: vermelho, sem maquiagem', () => {
    const e = base({
      categorias: CUSTOS_FECHADOS,
      taxaBilheteria: 10,
      cashbackPct: 5,
      receitaRealizada: { bilheteria: 20000, bar: '' },
    })
    const r = resultadoRealizado(e, computeCenario(e, 'realista'))
    expect(r.bilheteriaLiquida).toBe(19000) // 20.000 − 2.000 + 1.000
    expect(r.resultado).toBe(-12000)
    expect(r.sinal).toBe('prejuizo')
  })

  it('sem nenhuma receita realizada informada, o card não existe', () => {
    const e = base({ categorias: CUSTOS_FECHADOS, receitaRealizada: { bilheteria: '', bar: '' } })
    expect(resultadoRealizado(e, computeCenario(e, 'realista'))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// A PONTE COM OS CENÁRIOS — achado da verificação adversarial de 20/07/2026.
//
// A primeira versão da ponte afirmava uma causa ÚNICA: "lá o resultado é X
// PORQUE a previsão reserva contingência". Isso só é verdade quando realizado
// == previsto — ou seja, exatamente quando o fechamento ainda não fechou nada.
// Num evento que vendeu abaixo do previsto a frase apontava para o lado
// errado, com R$ na frente, enquanto a tabela de desvios dois centímetros
// acima já contava a história certa.
//
// A cura não foi apagar a frase: foi a tela parar de afirmar UMA causa e
// passar a decompor a diferença nas duas parcelas que ela realmente tem.
// ---------------------------------------------------------------------------
describe('a ponte com os Cenários decompõe a diferença — e sempre fecha', () => {
  const IDENTIDADE = 'resultado − lucroDoCenario === reservaDoCenario + desvioDeReceita'

  it(`${IDENTIDADE}, no evento em que a causa única mentia`, () => {
    // Vendeu MUITO abaixo do previsto: a contingência empurra o card para
    // cima, a bilheteria puxa para baixo, e a segunda vence. Dizer que a
    // diferença é "porque há contingência" aponta para o lado errado.
    const e = base({
      categorias: CUSTOS_FECHADOS,
      taxaBilheteria: 10,
      cashbackPct: 5,
      receitaRealizada: { bilheteria: 20000, bar: '' },
    })
    const c = computeCenario(e, 'realista')
    const r = resultadoRealizado(e, c)

    expect(r.resultado).toBe(-12000) // 19.000 de líquida − 31.000 de custo
    expect(c.lucro).toBe(-2400) // 33.250 − 35.650
    expect(r.diferencaParaCenario).toBe(-9600) // o card está ABAIXO da Home
    // ...e a contingência sozinha (+4.650) tem o SINAL OPOSTO ao da diferença:
    // ela empurra o card para CIMA. Quem lesse "a Home difere porque há
    // contingência" faria −12.000 + 4.650 = −7.350 e erraria o alvo por
    // R$ 4.950. A causa dominante é a bilheteria, com o dobro do tamanho.
    expect(r.contingenciaDoCenario).toBe(4650)
    expect(r.reservaDoCenario).toBe(4650)
    expect(r.desvioDeReceita).toBe(-14250) // 19.000 − 33.250
    expect(r.reservaDoCenario + r.desvioDeReceita).toBe(r.diferencaParaCenario)
  })

  it('a reserva é contingência MAIS ajuste de custo, não só contingência', () => {
    const e = base({
      categorias: CUSTOS_FECHADOS,
      cenariosConfig: {
        pessimista: { vendaPct: 70, custoPct: 10 },
        realista: { vendaPct: 100, custoPct: 8 }, // ajuste ligado no realista
        otimista: { vendaPct: 100, custoPct: -5 },
        overrides: { pessimista: {}, realista: {}, otimista: {} },
      },
    })
    const c = computeCenario(e, 'realista')
    const r = resultadoRealizado(e, c)
    // custoTotal = (31.000 + 4.650) × 1,08 = 38.502
    expect(c.custoTotal).toBe(38502)
    expect(r.reservaDoCenario).toBe(7502) // 38.502 − 31.000, e NÃO os 4.650
    expect(r.ajusteDoCenario).toBe(8)
    expect(r.reservaDoCenario + r.desvioDeReceita).toBeCloseTo(r.diferencaParaCenario, 9)
  })

  it('com contingência 0 e ajuste 0 a diferença NÃO é zero — e a ponte ainda tem o que dizer', () => {
    // O guard antigo perguntava "existe contingência?" quando a pergunta é
    // "os dois números diferem?". Com contingência 0 e realizado ≠ previsto,
    // as telas discordavam em dezenas de milhares e a tela ficava muda.
    const e = base({
      categorias: CUSTOS_FECHADOS,
      contingenciaPct: 0,
      receitaRealizada: { bilheteria: 12000, bar: '' },
    })
    const c = computeCenario(e, 'realista')
    const r = resultadoRealizado(e, c)
    expect(r.contingenciaDoCenario).toBe(0)
    expect(r.ajusteDoCenario).toBe(0)
    expect(r.reservaDoCenario).toBe(0)
    expect(r.diferencaParaCenario).toBe(-23000) // 12.000 − 35.000
    expect(r.desvioDeReceita).toBe(-23000)
  })

  it('a identidade fecha em 3.000 eventos aleatórios (o leitor soma com o dedo)', () => {
    let semente = 20260720
    const rnd = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648
      return semente / 2147483648
    }
    const cent = (x) => Math.round(x * 100) / 100
    for (let i = 0; i < 3000; i++) {
      const e = base({
        contingenciaPct: cent(rnd() * 30),
        taxaBilheteria: cent(rnd() * 15),
        cashbackPct: cent(rnd() * 8),
        openBar: rnd() < 0.25,
        barModo: 'fixo',
        taxaPagaPor: rnd() < 0.3 ? 'cliente' : 'nos',
        outrasReceitas: { bar: cent(rnd() * 8000 - 1000), patrocinio: '' },
        patrocinios:
          rnd() < 0.5
            ? [{ id: 'p1', nome: 'M', valor: cent(rnd() * 9000), estagio: 'confirmado' }]
            : [],
        lotes: [{ id: 'l1', nome: 'U', valor: cent(rnd() * 400), quantidade: Math.floor(rnd() * 400) }],
        cenariosConfig: {
          pessimista: { vendaPct: 70, custoPct: 10 },
          realista: { vendaPct: 100, custoPct: cent(rnd() * 30 - 15) },
          otimista: { vendaPct: 100, custoPct: -5 },
          overrides: { pessimista: {}, realista: {}, otimista: {} },
        },
        categorias: [
          {
            id: 'aeb',
            nome: 'A&B',
            itens: [
              novoItem({ estimado: cent(rnd() * 20000), realizado: rnd() < 0.6 ? cent(rnd() * 20000) : '' }),
              novoItem({ estimado: cent(rnd() * 15000), realizado: rnd() < 0.6 ? cent(rnd() * 15000) : '' }),
            ],
          },
        ],
        receitaRealizada: {
          bilheteria: rnd() < 0.8 ? cent(rnd() * 60000) : '',
          bar: rnd() < 0.4 ? cent(rnd() * 9000) : '',
        },
      })
      const c = computeCenario(e, 'realista')
      const r = resultadoRealizado(e, c)
      if (!r) continue
      // As duas parcelas que a tela imprime têm de somar EXATAMENTE a
      // diferença que a tela imprime — senão a frase não fecha na reunião.
      expect(r.reservaDoCenario + r.desvioDeReceita).toBeCloseTo(r.diferencaParaCenario, 9)
      expect(r.diferencaParaCenario).toBeCloseTo(r.resultado - c.lucro, 9)
      // E a reserva é SEMPRE o que a previsão põe em cima do custo real.
      expect(r.reservaDoCenario).toBeCloseTo(c.custoTotal - r.custos, 9)
    }
  })
})

describe('a ponte nomeia cada parcela com o VERBO dela (2ª geração do defeito)', () => {
  it('ajuste NEGATIVO maior que a contingência: elas têm sinais opostos e não podem ser fundidas', () => {
    // O caso que a verificação adversarial achou em 9% dos eventos: somar
    // contingência e ajuste numa "reserva" só e tirar o verbo do sinal da soma
    // fazia a tela dizer "a previsão CORTA X de contingência" — enquanto a
    // contingência somava e quem cortava era o ajuste.
    const e = base({
      contingenciaPct: 5,
      categorias: [
        { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Tudo', estimado: 100000, realizado: 100000 })] },
      ],
      cenariosConfig: {
        pessimista: { vendaPct: 70, custoPct: 10 },
        realista: { vendaPct: 100, custoPct: -10 },
        otimista: { vendaPct: 100, custoPct: -5 },
        overrides: { pessimista: {}, realista: {}, otimista: {} },
      },
      receitaRealizada: { bilheteria: 120000, bar: '' },
    })
    const c = computeCenario(e, 'realista')
    const r = resultadoRealizado(e, c)

    expect(r.custos).toBe(100000)
    expect(r.contingenciaDoCenario).toBe(5000) // +5.000: a contingência SOMA
    expect(r.ajusteDoCenarioValor).toBe(-10500) // −10.500: quem CORTA é o ajuste
    // A soma das duas é NEGATIVA — e é ela que a versão anterior usava para
    // escolher o verbo, dizendo "corta" sobre a contingência.
    expect(r.reservaDoCenario).toBe(-5500)
    expect(r.contingenciaDoCenario + r.ajusteDoCenarioValor).toBe(r.reservaDoCenario)
  })

  it('a identidade de TRÊS parcelas fecha em 3.000 eventos aleatórios', () => {
    let semente = 907
    const rnd = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648
      return semente / 2147483648
    }
    const cent = (x) => Math.round(x * 100) / 100
    let comAjusteNegativoEContingenciaPositiva = 0
    for (let i = 0; i < 3000; i++) {
      const e = base({
        contingenciaPct: cent(rnd() * 25),
        taxaBilheteria: cent(rnd() * 15),
        cashbackPct: cent(rnd() * 8),
        openBar: rnd() < 0.2,
        barModo: 'fixo',
        outrasReceitas: { bar: cent(rnd() * 6000 - 1500), patrocinio: '' },
        lotes: [{ id: 'l1', nome: 'U', valor: cent(rnd() * 400), quantidade: Math.floor(rnd() * 300) }],
        cenariosConfig: {
          pessimista: { vendaPct: 70, custoPct: 10 },
          realista: { vendaPct: 100, custoPct: cent(rnd() * 40 - 25) },
          otimista: { vendaPct: 100, custoPct: -5 },
          overrides: { pessimista: {}, realista: {}, otimista: {} },
        },
        categorias: [
          {
            id: 'aeb',
            nome: 'A&B',
            itens: [novoItem({ estimado: cent(rnd() * 30000), realizado: rnd() < 0.7 ? cent(rnd() * 30000) : '' })],
          },
        ],
        receitaRealizada: { bilheteria: rnd() < 0.85 ? cent(rnd() * 70000) : '', bar: rnd() < 0.3 ? cent(rnd() * 6000) : '' },
      })
      const c = computeCenario(e, 'realista')
      const r = resultadoRealizado(e, c)
      if (!r) continue
      // As TRÊS parcelas que a tela nomeia somam exatamente a diferença.
      expect(
        r.contingenciaDoCenario + r.ajusteDoCenarioValor + r.desvioDeReceita
      ).toBeCloseTo(r.diferencaParaCenario, 9)
      // A contingência NUNCA é negativa: o verbo "reserva" é sempre verdade.
      expect(r.contingenciaDoCenario).toBeGreaterThanOrEqual(0)
      if (r.contingenciaDoCenario > 0.5 && r.ajusteDoCenarioValor < -0.5) {
        comAjusteNegativoEContingenciaPositiva++
      }
    }
    // O caso que quebrava a frase precisa existir de verdade na amostra,
    // senão este teste não estaria provando nada.
    expect(comAjusteNegativoEContingenciaPositiva).toBeGreaterThan(100)
  })
})
