// EVIDÊNCIA — a rodada ADVERSARIAL sobre "quem responde 'a festa deu dinheiro?'".
//
// Este arquivo NÃO conserta nada e NÃO decide nada. Ele é o contraditório da
// medição de 20/07 (`superficiesRealizado.evidencia.test.js`), escrito por
// quem foi encarregado de tentar derrubá-la. A medição SOBREVIVEU: os números
// batem com os módulos reais. O que este arquivo acrescenta são os casos que a
// medição NÃO mediu — e que, medidos, mudam a conversa:
//
//   1. `resultadoRealizado` dispara com QUALQUER receita realizada informada.
//      Basta o BAR. Com só o bar lançado, a "verdade em dinheiro" da Brisa é
//      +R$ 43.500 — dos quais R$ 85.500 de receita são PREVISÃO e R$ 2.000 são
//      dinheiro real. A verdade da festa é −R$ 5.900.
//   2. Portanto: promover esse número a resposta oficial (Desenho A) ou
//      apontar para ele (Desenhos B e C) pode publicar no WhatsApp um erro de
//      R$ 49.400 com a palavra "real" na frente. Hoje o mesmo erro sai com a
//      palavra "previsão" na frente. A régua da casa diz que a etiqueta mais
//      forte no número mais errado é PIOR, não melhor.
//   3. A suposição do Desenho A sobre o fechamento pela metade está ERRADA:
//      ele supõe que sem custos lançados o card vira "lucro de R$ 36.100"
//      (receita cheia menos custos zerados). Isso é o S1 que já foi fechado em
//      21/07 — custo pendente entra pelo ESTIMADO. O número medido é +R$ 100.
//      A direção da crítica se sustenta; o número dela não.
//
// Como sempre: os `it(...)` passam HOJE e travam o comportamento atual; os
// `describe.skip(...)` são a especificação de CADA desenho, prontos para virar
// o teste da mudança no dia em que o Marco escolher um. Nenhum componente foi
// alterado. `calc.js` e `golden.test.js` não foram tocados.
//
// As festas abaixo são construídas para a medição — não são dados do Marco.

import { describe, it, expect } from 'vitest'
import { computeCenarios, veredito, ritmoVendas } from './calc.js'
import { resultadoRealizado, montarBenchmarkDeEvento } from './fechamento.js'
import { resumoCurto, fraseRitmo } from './resumo.js'
import { TITULO_VEREDITO } from './vereditoTexto.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'

const HOJE = '2026-07-20' // festa em 14/03: quatro meses no passado, em qualquer fuso

const lote = (nome, valor, quantidade) => novoLote({ nome, valor, quantidade })
const item = (servico, estimado, realizado) =>
  novoItem({ servico, estimado, realizado, status: 'PAGO' })
const cats = (mapa) => novoEvento('tmp').categorias.map((c) => ({ ...c, itens: mapa[c.id] || [] }))

// A Brisa 14/03 da medição: 1.000 lugares a R$ 100, custo de R$ 44.000 todo
// realizado, bilheteria realizada de R$ 38.000 e bar realizado de R$ 2.000
// (previsto: R$ 8.000). Lida em 20/07/2026.
const BRISA = {
  ...novoEvento('Brisa 14/03'),
  // Padrões de cenário da MEDIÇÃO (20/07/2026): pessimista 70%. O Marco subiu
  // o padrão para 80 em 27/07/2026 (decisão A); os R$ afirmados aqui são os
  // MEDIDOS, então o 70 vem explícito, com a marca que impede a migração de
  // subi-lo. O assunto deste arquivo é o sinal invertido, não o padrão.
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
  padraoPessimista80: { de: null },
  data: '2026-03-14',
  local: 'Casa Brisa',
  tipo: 'Brisa',
  publicoEstimado: 1000,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  barModo: 'fixo',
  outrasReceitas: { bar: 8000, patrocinio: '' },
  vendidosAteHoje: 420,
  lotes: [lote('Lote 1', 100, 400), lote('Lote 2', 100, 400), lote('Último Lote', 100, 200)],
  categorias: cats({
    artistico: [item('DJs', 15000, 15000)],
    estrutura: [item('Som e luz', 13000, 13000)],
    equipe: [item('Produção + segurança', 10000, 10000)],
    aeb: [item('Insumos de bar', 6000, 6000)],
  }),
  receitaRealizada: { bilheteria: 38000, bar: 2000 },
}

const semRealizadoNosCustos = (ev) => ({
  ...ev,
  categorias: ev.categorias.map((c) => ({ ...c, itens: c.itens.map((i) => ({ ...i, realizado: '' })) })),
})

const verdadeDe = (ev) => {
  const c = computeCenarios(ev)
  return { c, rr: resultadoRealizado(ev, c.realista) }
}

// ---------------------------------------------------------------------------
describe('A MEDIÇÃO SOBREVIVE — refeita com os módulos reais', () => {
  it('a Brisa perdeu R$ 5.900 e o WhatsApp anuncia lucro de R$ 47 mil, com o sinal invertido', () => {
    const { c, rr } = verdadeDe(BRISA)

    expect(rr.resultado).toBe(-5900) // a verdade, fechamento completo
    expect(rr.completo).toBe(true)
    expect(c.realista.lucro).toBe(47300) // o que sai no texto do grupo
    expect(c.realista.lucro - rr.resultado).toBe(53200)
    expect(Math.sign(c.realista.lucro)).not.toBe(Math.sign(rr.resultado))

    // Os TRÊS cenários dizem lucro: não existe cenário de escape no texto.
    expect(c.pessimista.lucro).toBeCloseTo(23680, 6)
    expect(c.otimista.lucro).toBe(59110)

    // E o texto copiado, palavra por palavra (medido, não estimado):
    const texto = resumoCurto(BRISA, { hoje: HOJE })
    expect(texto).toContain('🟢 *Brisa 14/03* — 14/03/2026 · Casa Brisa')
    expect(texto).toContain('*Evento viável.*')
    expect(texto).toContain('Lucro: pessimista R$ 24 mil · *realista R$ 47 mil* · otimista R$ 59 mil')
    // ATUALIZAÇÃO DA FOTOGRAFIA (20/07/2026, sessão da marcação de festa
    // realizada). Até aqui esta linha media a AUSÊNCIA:
    //     expect(texto).not.toContain('realizado')
    // A ausência era o bug: quatro das cinco superfícies jogavam fora a frase
    // que o app já tinha. A frase voltou; a foto passa a medir a PRESENÇA.
    // O que esta evidência denuncia NÃO foi resolvido e segue de pé: os
    // NÚMEROS acima continuam sendo os da previsão (R$ 47 mil) numa festa que
    // perdeu R$ 5.900 — decisão pendente do Marco.
    expect(texto).toContain('Evento já realizado')
  })

  it('o veredito fala no PRESENTE sobre uma festa de quatro meses atrás', () => {
    const { c } = verdadeDe(BRISA)
    expect(TITULO_VEREDITO[veredito(c, BRISA).cor]).toBe('Evento viável')
  })

  it('o módulo que SABE que a festa passou tem a frase pronta — e o texto voltou a mostrá-la', () => {
    const { c } = verdadeDe(BRISA)
    const r = ritmoVendas({
      vendidos: BRISA.vendidosAteHoje,
      dataEvento: BRISA.data,
      breakEven: c.realista.breakEven,
      hoje: HOJE,
    })
    expect(r).toEqual({ eventoPassado: true })
    expect(fraseRitmo(r)).toBe('Evento já realizado — o acompanhamento de vendas não se aplica.')
    // Era `.not.toContain(...)` até 20/07/2026 — o descarte foi corrigido.
    expect(resumoCurto(BRISA, { hoje: HOJE })).toContain('Evento já realizado')
  })
})

// ---------------------------------------------------------------------------
// O ACHADO NOVO DESTA RODADA. É o que decide entre os três desenhos.
// ---------------------------------------------------------------------------
describe('O GATILHO DA "VERDADE" É FRACO — qualquer receita realizada liga o card', () => {
  it('só o BAR lançado (R$ 2.000) já produz um "resultado" de +R$ 43.500', () => {
    const soBar = { ...BRISA, receitaRealizada: { bilheteria: '', bar: 2000 } }
    const { rr } = verdadeDe(soBar)

    expect(rr).not.toBeNull() // o card EXISTE
    expect(rr.resultado).toBe(43500) // e diz LUCRO
    expect(rr.completo).toBe(false) // com a ressalva, é verdade

    // De onde vem esse número: R$ 2.000 de dinheiro real e R$ 85.500 de
    // bilheteria PREVISTA que ninguém conferiu.
    expect(rr.bilheteriaInformada).toBe(false)
    expect(rr.bilheteriaBruta).toBe(90000) // a bruta do cenário realista
    expect(rr.bilheteriaLiquida).toBe(85500)
    expect(rr.receitaInformada).toBe(2000)
    expect(rr.receitaPrevista).toBe(85500)
    expect(rr.linhasPrevistas).toEqual(['Bilheteria (bruta)'])

    // A verdade da mesma festa, com a bilheteria de fato lançada: −R$ 5.900.
    // Diferença: R$ 49.400, sinal invertido — e este número é o que os três
    // desenhos chamariam de "resultado REAL".
    expect(verdadeDe(BRISA).rr.resultado).toBe(-5900)
    expect(rr.resultado - verdadeDe(BRISA).rr.resultado).toBe(49400)
  })

  it('bilheteria lançada e NENHUM custo lançado NÃO vira "lucro de R$ 36.100" — vira +R$ 100', () => {
    // O Desenho A supõe que aqui a receita cheia bate contra custo zero. Não
    // bate: custo pendente entra pelo ESTIMADO (`valorConsiderado`, a régua do
    // app inteiro). Essa era a falha S1 fechada em 21/07 e ela continua fechada.
    const semCusto = {
      ...semRealizadoNosCustos(BRISA),
      receitaRealizada: { bilheteria: 38000, bar: '' },
    }
    const { rr } = verdadeDe(semCusto)
    expect(rr.custosRealizados).toBe(0)
    expect(rr.custosPendentes).toBe(44000) // o orçamento não some
    expect(rr.custos).toBe(44000)
    expect(rr.resultado).toBe(100)

    // Ainda assim o sinal está invertido, e por outro motivo: o BAR entra
    // pelos R$ 8.000 previstos, quando o bar real foi R$ 2.000.
    expect(rr.bar).toBe(8000)
    expect(rr.barInformado).toBe(false)
    expect(rr.receitaPrevista).toBe(8000)
    expect(Math.sign(rr.resultado)).not.toBe(Math.sign(-5900))
  })

  it('"o bar não vendeu nada" agora é dizível: realizado 0 conta como zero, não como o previsto', () => {
    // MUDANÇA DE REGRA (Marco, 25/07/2026, aprovada e datada): `temValor` em
    // fechamento.js deixou de exigir `> 0` — 0 e negativo digitados agora
    // valem "foi isto mesmo", distinto de campo vazio/ausente. Até
    // 25/07/2026 esta mesma festa lia "não preenchido" e voltava ao bar
    // previsto (R$ 8.000), dando resultado +R$ 100 quando a verdade era
    // −R$ 7.900 — o achado que abriu o caso.
    const barZero = { ...BRISA, receitaRealizada: { bilheteria: 38000, bar: 0 } }
    const { rr } = verdadeDe(barZero)
    expect(rr.bar).toBe(0) // digitou 0, o app agora lê "foi isto mesmo"
    expect(rr.barInformado).toBe(true)
    expect(rr.resultado).toBe(-7900) // a verdade
    expect(rr.completo).toBe(true)
  })

  it('custos TODOS lançados e receita nenhuma: não existe verdade, e a previsão segue sozinha', () => {
    // Custo real é o que chega primeiro na semana seguinte à festa. Neste
    // estado os três desenhos ficam mudos e o WhatsApp segue igual ao de hoje.
    const soCustos = { ...BRISA, receitaRealizada: { bilheteria: '', bar: '' } }
    const { c, rr } = verdadeDe(soCustos)
    expect(rr).toBeNull()
    expect(c.realista.lucro).toBe(47300)
    expect(veredito(c, soCustos).cor).toBe('verde')
  })

  it('o parcial também erra para o lado pessimista: 2 de 4 custos estourando dá −R$ 20.900', () => {
    const meio = {
      ...BRISA,
      categorias: cats({
        artistico: [item('DJs', 15000, 24000)],
        estrutura: [item('Som e luz', 13000, 19000)],
        equipe: [novoItem({ servico: 'Produção', estimado: 10000, realizado: '', status: 'FECHADO' })],
        aeb: [novoItem({ servico: 'Insumos', estimado: 6000, realizado: '', status: 'ORÇAR' })],
      }),
    }
    const { c, rr } = verdadeDe(meio)
    expect(rr.nComRealizado).toBe(2)
    expect(rr.nSemRealizado).toBe(2)
    expect(rr.custosRealizados).toBe(43000)
    expect(rr.custosPendentes).toBe(16000)
    expect(rr.resultado).toBe(-20900)
    expect(rr.completo).toBe(false)
    expect(c.realista.lucro).toBe(31550)
    // O parcial não é "a previsão com menos erro": é outro número, que erra
    // para qualquer lado conforme quem foi lançado primeiro.
  })
})

// ---------------------------------------------------------------------------
describe('O CASO SILENCIOSO segue sendo o pior, e nenhum desenho o resolve', () => {
  const SILENCIOSA = {
    ...semRealizadoNosCustos(BRISA),
    receitaRealizada: { bilheteria: '', bar: '' },
  }

  it('sem nada lançado o card não existe e a previsão responde sozinha — mas o benchmark já não inventa', () => {
    const { c, rr } = verdadeDe(SILENCIOSA)
    expect(rr).toBeNull()
    expect(c.realista.lucro).toBe(47300)
    // METADE CONSERTADA EM 20/07/2026 (decisão 5 do Marco). O botão de promover
    // a benchmark gravava um lucro tirado dos lotes ESGOTADOS — 1.000 ingressos
    // que nunca venderam, R$ 56.000 de lucro inventado e permanente. Agora ele
    // RECUSA e diz o que falta preencher.
    expect(montarBenchmarkDeEvento(SILENCIOSA)).toBeNull()
    // O QUE SEGUE ABERTO, e é o assunto deste arquivo: a previsão continua
    // respondendo sozinha por uma festa que já aconteceu (+R$ 47.300), sem
    // nenhum dado real por trás. Isso é desenho de produto, não conta — segue
    // aguardando a escolha do Marco entre os três desenhos abaixo.
    expect(c.realista.lucro).toBe(47300)
  })
})

// ===========================================================================
// ESPECIFICAÇÃO DOS TRÊS DESENHOS — nada disto roda hoje.
// Vira o teste da mudança no dia em que o Marco escolher UM.
// ===========================================================================

describe.skip('DESENHO A — "a verdade vence" (aguardando escolha do Marco)', () => {
  // A troca a fonte da resposta oficial em ~14 superfícies. A especificação
  // ABAIXO já embute o portão que a rodada adversarial mostrou ser obrigatório:
  // sem ele, A publica os R$ 43.500 do caso "só o bar" com a palavra "real".
  it('a verdade só substitui a previsão quando o fechamento está COMPLETO', () => {
    const { rr } = verdadeDe(BRISA)
    expect(rr.completo).toBe(true)
    // texto: "Resultado: −R$ 5.900 — prejuízo. A previsão dizia R$ 47.300."
  })

  it('fechamento INCOMPLETO nunca vira "Resultado real" — nem em texto, nem em número grande', () => {
    const soBar = { ...BRISA, receitaRealizada: { bilheteria: '', bar: 2000 } }
    const { rr } = verdadeDe(soBar)
    expect(rr.completo).toBe(false)
    // A superfície mostra "Fechamento em andamento — 1 de 2 linhas de receita
    // e 4 de 4 custos lançados", SEM cifra de resultado. Melhor mudo que
    // mentiroso: a cifra aqui seria +R$ 43.500 contra uma verdade de −R$ 5.900.
  })

  it('a previsão nunca some: ela desce para a segunda linha, nomeada', () => {
    // "A previsão dizia R$ 47.300 (realista)" — a palavra "Lucro" sozinha
    // deixa de existir em qualquer superfície de festa passada.
  })

  it('festa passada sem NADA lançado perde a bola do semáforo e ganha a palavra previsão duas vezes', () => {
    // Não há veredito honesto sobre uma festa que já aconteceu e não foi
    // conferida. 🟢/🟡/🔴 não aparecem; o texto diz "não foi lançado".
  })
})

describe.skip('DESENHO B — "o selo" (aguardando escolha do Marco)', () => {
  // B não muda número nenhum: acrescenta uma faixa em ~10 superfícies dizendo
  // que a festa já aconteceu e apontando para o Fechamento.
  it('a faixa aparece em toda festa passada, com ou sem realizado lançado', () => {
    const passada = BRISA
    expect(new Date(passada.data) < new Date(HOJE)).toBe(true)
    // "Festa já realizada em 14/03. Os valores acima são a PREVISÃO."
  })

  it('a faixa só cita uma cifra de resultado quando o fechamento está COMPLETO', () => {
    const soBar = { ...BRISA, receitaRealizada: { bilheteria: '', bar: 2000 } }
    expect(verdadeDe(soBar).rr.completo).toBe(false)
    // Aqui a faixa diz "fechamento em andamento — falta lançar a bilheteria",
    // e NÃO "resultado real: R$ 43.500".
  })

  it('sem realizado nenhum, a faixa diz o que falta e oferece o caminho', () => {
    const silenciosa = { ...semRealizadoNosCustos(BRISA), receitaRealizada: { bilheteria: '', bar: '' } }
    expect(verdadeDe(silenciosa).rr).toBeNull()
    // "O resultado real ainda não foi lançado. Lançar resultado →"
  })

  it('a linha do WhatsApp deixa de se chamar "Lucro" e passa a se chamar "Lucro (previsto)"', () => {
    expect(resumoCurto(BRISA, { hoje: HOJE })).toContain('Lucro: pessimista')
    // depois: 'Lucro (previsto): pessimista …'
  })

  it('se o selo falhar por qualquer motivo, a tela fica exatamente como hoje', () => {
    // Propriedade central de B: o pior caso do selo é o app de hoje.
  })
})

describe.skip('DESENHO C — "previsto × realizado, lado a lado" (aguardando escolha do Marco)', () => {
  it('a coluna Realizado só traz cifra com fechamento COMPLETO; senão traz "—" e o motivo', () => {
    expect(verdadeDe(BRISA).rr.completo).toBe(true)
    const soBar = { ...BRISA, receitaRealizada: { bilheteria: '', bar: 2000 } }
    expect(verdadeDe(soBar).rr.completo).toBe(false)
  })

  it('no WhatsApp a ordem inverte: o realizado vem primeiro, o previsto vira contexto', () => {
    // "Realizado: −R$ 5.900 · Previsto (realista): R$ 47.300 — erramos
    //  R$ 53.200 para cima."
  })

  it('a diferença publicada é sempre previsto − realizado, com o sinal escrito por extenso', () => {
    const { c, rr } = verdadeDe(BRISA)
    expect(c.realista.lucro - rr.resultado).toBe(53200)
  })

  it('festa futura sai exatamente como sai hoje — C não toca em nada antes da festa', () => {
    const futura = { ...BRISA, data: '2026-12-31' }
    expect(resumoCurto(futura, { hoje: HOJE })).toContain('Vendidos até hoje')
  })
})

describe.skip('COMUM AOS TRÊS — o que nenhum deles resolve, e precisa de decisão separada', () => {
  it('o benchmark promovido continua gravando outra conta, com o sinal invertido', () => {
    // Medido na O Galeao: verdade +R$ 24.100, gravado −R$ 2.500. É o único erro
    // do app que não se corrige relendo a tela — vira âncora permanente.
    expect(montarBenchmarkDeEvento(BRISA).lucro).toBe(-6000)
    expect(verdadeDe(BRISA).rr.resultado).toBe(-5900)
  })

  it('computeCenarios continua misturando custo realizado com receita prevista — isso é FÓRMULA', () => {
    // Princípio 1: portão do Marco, com diff antes. Nenhum desenho encosta.
  })

  it('realizado 0 continua indizível na receita e no custo', () => {
    // Ver realizadoZero.evidencia.test.js. Enquanto isso valer, "o bar não
    // vendeu" e "o fornecedor não cobrou" entram na conta pelo previsto.
  })
})
