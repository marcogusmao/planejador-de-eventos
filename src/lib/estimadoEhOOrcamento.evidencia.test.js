// EVIDÊNCIA: a coluna "Estimado" do card de evento realizado é o ORÇAMENTO —
// a soma dos valores que o Marco digitou, com o realizado FORA dela.
//
// Decisão do Marco, 27/07/2026, por questionário, com a conta na frente
// (princípio 1 do CLAUDE.md). Ele foi avisado de que cifras a que estava
// acostumado mudam — no evento medido o lucro "estimado" sai de R$ 168 mil para
// R$ 245 mil — e respondeu que as antigas eram o realizado disfarçado.
//
// ═══════════════════════════════════════════════════════════════════════════
// O DEFEITO, MEDIDO NO EVENTO REAL: Marfim Alto Casa Norte, 05/07/2025,
// fechado, 78 de 80 itens de custo com realizado lançado.
//
//     soma dos ESTIMADOS que ele digitou ....... R$ 306.540
//     soma dos REALIZADOS ...................... R$ 376.360
//     o que o card imprimia como "Estimado" .... R$ 376.360   ← o realizado
//     desvio que o card mostrava ............... +0
//     desvio de verdade ........................ +R$ 69.820
//
// A CAUSA. A coluna vinha do CENÁRIO REALISTA, e o cenário soma
// `valorConsiderado()` — o realizado quando ele existe, o estimado quando não
// existe. Numa previsão VIVA isso é certo: durante a produção, o melhor palpite
// para um item já pago é o que ele custou. Num evento FECHADO, com quase tudo
// lançado, o "estimado" VIRA o realizado e o card compara o realizado contra
// ele mesmo. E piorava conforme a festa fechava: quanto mais itens lançados,
// mais o desvio sumia — o número ficava mais errado exatamente quando mais se
// confiava nele.
//
// A CURA. `resultadoRealizado()` passou a devolver o bloco `estimado`, cujo
// custo é `conf.estimadoTodos` — o MESMO campo do MESMO `confrontoCustos()` que
// a aba Fechamento imprime na linha "Orçamento de custos (todos os itens)".
// Nenhuma segunda soma nasceu: é o número que já estava calculado dentro da
// função. A prova disso é o bloco "A MESMA RÉGUA DA ABA FECHAMENTO" mais
// abaixo, que cobra a identidade entre o desvio do card e o da aba.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { novoEvento, novoItem } from './defaults.js'
import { computeCenarios, computeCenario } from './calc.js'
import { resultadoRealizado, fechamentoCustos } from './fechamento.js'
import { confrontoCustos, LIMIAR_ZERO } from './confrontoCustos.js'

// ---------------------------------------------------------------------------
// O EVENTO-RÉGUA: uma maquete FIEL do evento real do Marco. Os números de custo
// são os DELE, ao real: o orçamento digitado soma R$ 306.540, o realizado soma
// R$ 376.360 e a diferença é os R$ 69.820 que o card escondia. A receita foi
// escolhida para o lucro cair exatamente nos R$ 168 mil / R$ 245 mil que ele viu
// no questionário.
//
// `contingenciaPct: 0` é deliberado: é assim que a festa dele está, e é o que
// faz o card ANTIGO imprimir desvio +0 cravado — o sintoma exato do achado.
// A contingência tem o seu próprio caso mais abaixo.
// ---------------------------------------------------------------------------
const marfimCasaNorte = () => {
  const e = novoEvento('Marfim Alto Casa Norte')
  e.data = '2025-07-05'
  e.publicoEstimado = 5000
  e.contingenciaPct = 0
  e.barModo = 'fixo'
  e.outrasReceitas = { bar: 76540, patrocinio: '' }
  e.lotes = [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 5000, somenteOtimista: false }]
  e.cenariosConfig.realista.vendaPct = 100
  // Bilheteria e bar realizados IGUAIS ao previsto, de propósito: assim toda a
  // diferença do card mora no CUSTO, que é onde o defeito estava. Sem isso, um
  // desvio de receita entraria no lucro e embaralharia a leitura da evidência.
  e.receitaRealizada = { bilheteria: 500000, bar: 76540 }
  e.categorias[0].itens = [
    novoItem({ servico: 'Estrutura', estimado: 100000, realizado: 119820 }),
    novoItem({ servico: 'Artístico', estimado: 80000, realizado: 100000 }),
    novoItem({ servico: 'Equipe', estimado: 60000, realizado: 80000 }),
    novoItem({ servico: 'A&B', estimado: 50000, realizado: 60000 }),
    // O item que ainda não fechou — os "2 de 80" da festa dele, em miniatura.
    novoItem({ servico: 'Marketing', estimado: 16540, realizado: '' }),
  ]
  e.status = 'fechado'
  return e
}

const cardDe = (e) => resultadoRealizado(e, computeCenarios(e).realista)

describe('O caso do Marco: 4 de 5 itens com realizado lançado', () => {
  it('a coluna Estimado soma os R$ 306.540 que ele DIGITOU — não os R$ 376.360 que ele pagou', () => {
    const e = marfimCasaNorte()
    const card = cardDe(e)

    // O ORÇAMENTO: os cinco estimados, incluindo o do item que ainda não pagou.
    expect(card.estimado.custos).toBe(306540)
    // O REALIZADO na base cheia: o que já foi pago + o orçamento de quem falta.
    expect(card.custos).toBe(376360)
    expect(card.custosRealizados).toBe(359820)
    expect(card.custosPendentes).toBe(16540)

    // O desvio que o card passa a mostrar — o que a festa estourou de verdade.
    expect(card.custos - card.estimado.custos).toBe(69820)
  })

  it('o lucro estimado vai de R$ 175.180 para R$ 245.000 — a mudança que o Marco aprovou', () => {
    const card = cardDe(marfimCasaNorte())
    expect(card.estimado.receita).toBe(551540)
    expect(card.estimado.lucro).toBe(245000)
    // O realizado NÃO se moveu: continua os mesmos R$ 175.180.
    expect(card.resultado).toBe(175180)
    // E o desvio do lucro, que era ZERO, passa a ser o estouro de custo inteiro.
    expect(card.resultado - card.estimado.lucro).toBe(-69820)
  })

  it('a margem estimada acompanha, pela MESMA guarda de calc.js', () => {
    const card = cardDe(marfimCasaNorte())
    expect(card.estimado.margem).toBeCloseTo(44.4211, 3) // 245.000 / 551.540
  })

  // O RETRATO DO DEFEITO, guardado como fato. Estas asserções falam do CENÁRIO,
  // que esta frente NÃO tocou — elas seguem verdadeiras para sempre, e é por
  // isso que servem de prova: mostram que a coluna antiga era, ao centavo, o
  // realizado, e que o desvio impresso era zero cravado.
  it('POR QUE ERA ERRADO: o cenário realista, a fonte antiga da coluna, é o realizado ao centavo', () => {
    const e = marfimCasaNorte()
    const cen = computeCenarios(e).realista
    const card = resultadoRealizado(e, cen)

    expect(cen.custoTotal).toBe(376360)
    expect(cen.custoTotal).toBe(card.custos) // a coluna "Estimado" ERA a coluna "Realizado"
    expect(cen.lucro).toBe(card.resultado) // logo o desvio do lucro saía +0
    expect(cen.custoTotal - card.custos).toBe(0)

    // E o número certo estava a um campo de distância, já calculado:
    expect(confrontoCustos(e.categorias).estimadoTodos).toBe(306540)
    expect(cen.custoTotal - confrontoCustos(e.categorias).estimadoTodos).toBe(69820)
  })
})

describe('A MESMA RÉGUA DA ABA FECHAMENTO (a prova de que não nasceu uma segunda conta)', () => {
  // A identidade, em uma linha:
  //   custos − estimado.custos
  //     = (realizado + estimadoPendente) − (estimadoDosMesmos + estimadoPendente)
  //     = realizado − estimadoDosMesmos
  //     = o "Desvio" total que a aba Fechamento já imprime.
  // O estimado de quem ainda não pagou aparece igual dos DOIS lados e se
  // cancela. Se alguém trocar a régua do card por outra soma, esta identidade
  // quebra — é ela que impede as duas telas de dizerem duas verdades.
  const identidade = (e) => {
    const card = cardDe(e)
    const aba = fechamentoCustos(e.categorias)
    expect(card.estimado.custos).toBe(aba.totalEstimado) // a linha "Orçamento de custos"
    expect(Math.abs(card.custos - card.estimado.custos - aba.desvioTotal)).toBeLessThan(LIMIAR_ZERO)
  }

  it('no evento do Marco, o desvio do card É o desvio da aba Fechamento', () => {
    const e = marfimCasaNorte()
    expect(fechamentoCustos(e.categorias).desvioTotal).toBe(69820)
    identidade(e)
  })

  // VARREDURA DETERMINÍSTICA: 1.500 festas com combinações hostis de centavos,
  // itens pagos e itens pendentes. Determinística de propósito — um teste que
  // sorteia números diferentes a cada rodada não é evidência, é loteria.
  it('varredura: 1.500 eventos de centavos hostis — a identidade fecha em todos', () => {
    let vistos = 0
    let comPendente = 0
    for (let s = 0; s < 1500; s++) {
      const e = marfimCasaNorte()
      const n = 1 + (s % 9)
      e.categorias[0].itens = Array.from({ length: n }, (_, i) => {
        const est = Math.round(((s * 977 + i * 131) % 90000) + 0.07 * ((i + s) % 100) * 100) / 100
        // ~1 em 3 fica SEM realizado — é o caso em que a parcela pendente
        // aparece dos dois lados e precisa se cancelar.
        const pago = (s + i) % 3 !== 0
        return novoItem({
          servico: `i${i}`,
          estimado: est,
          realizado: pago ? Math.round((est * 1.13 + 7.77) * 100) / 100 : '',
        })
      })
      if (e.categorias[0].itens.some((i) => i.realizado === '')) comPendente++
      identidade(e)
      vistos++
    }
    expect(vistos).toBe(1500)
    // O caso difícil existiu de verdade na varredura — sem isto, "passou" podia
    // significar "nunca chegou a exercitar o que interessa".
    expect(comPendente).toBeGreaterThan(1000)
  })
})

describe('Evento com POUCOS realizados: a coluna também conta a verdade', () => {
  const poucos = () => {
    const e = marfimCasaNorte()
    e.categorias[0].itens = [
      novoItem({ servico: 'Estrutura', estimado: 100000, realizado: 119820 }),
      novoItem({ servico: 'Artístico', estimado: 80000, realizado: '' }),
      novoItem({ servico: 'Equipe', estimado: 60000, realizado: '' }),
      novoItem({ servico: 'A&B', estimado: 50000, realizado: '' }),
      novoItem({ servico: 'Marketing', estimado: 16540, realizado: '' }),
    ]
    return e
  }

  it('1 de 5 pagos: estimado = o orçamento inteiro, desvio = só o estouro do item pago', () => {
    const card = cardDe(poucos())
    expect(card.estimado.custos).toBe(306540) // o orçamento não muda: é o mesmo
    expect(card.custosRealizados).toBe(119820)
    expect(card.custosPendentes).toBe(206540)
    expect(card.custos).toBe(326360)
    // Só o item pago estourou: 119.820 − 100.000.
    expect(card.custos - card.estimado.custos).toBe(19820)
    expect(fechamentoCustos(poucos().categorias).desvioTotal).toBe(19820)
  })

  it('NENHUM item de custo pago: estimado = realizado = orçamento, desvio zero — e isso é a verdade', () => {
    const e = marfimCasaNorte()
    for (const i of e.categorias[0].itens) i.realizado = ''
    const card = cardDe(e)
    expect(card.estimado.custos).toBe(306540)
    expect(card.custos).toBe(306540)
    expect(card.custos - card.estimado.custos).toBe(0)
    // Aqui o zero é honesto: nada foi pago, então nada estourou ainda. O defeito
    // antigo era o zero aparecer justamente no caso OPOSTO, com tudo pago.
  })
})

describe('Contingência e ajuste de cenário ficam de FORA do estimado — dos dois lados', () => {
  // A razão: o lado REALIZADO já os exclui desde 20/07/2026 (reserva não é
  // despesa; ajuste é régua de projeção). Somá-los só do lado estimado inflaria
  // o desvio pelo tamanho da reserva — "número certo levando à leitura errada",
  // que é o defeito que `confrontoCustos.js` nasceu para matar.
  it('contingência 10% e ajuste de custo +10% NÃO entram na coluna Estimado', () => {
    const e = marfimCasaNorte()
    e.contingenciaPct = 10
    e.cenariosConfig.realista.custoPct = 10
    const cen = computeCenarios(e).realista
    const card = resultadoRealizado(e, cen)

    // O cenário continua carregando as duas coisas — ele não foi tocado.
    expect(cen.contingencia).toBeCloseTo(37636, 6)
    expect(cen.ajustePct).toBe(10)
    expect(cen.custoTotal).toBeCloseTo(455395.6, 6)

    // A coluna Estimado do card, não: é o orçamento puro, o mesmo de sempre.
    expect(card.estimado.custos).toBe(306540)
    // E o realizado também não os carrega — é o que torna a comparação honesta.
    expect(card.custos).toBe(376360)
    expect(card.custos - card.estimado.custos).toBe(69820)
  })
})

describe('O item marcado "custou zero" entra no orçamento pelo valor DIGITADO', () => {
  it('R$ 8.000 orçados que custaram zero viram R$ 8.000 de economia, não R$ 0 de orçamento', () => {
    const e = marfimCasaNorte()
    e.categorias[0].itens = [
      novoItem({ servico: 'Gerador', estimado: 8000, realizado: '', custouZero: true }),
    ]
    const card = cardDe(e)
    expect(card.estimado.custos).toBe(8000) // o que ele orçou
    expect(card.custos).toBe(0) // o que ele pagou
    expect(card.custos - card.estimado.custos).toBe(-8000) // economia de 8.000
    expect(fechamentoCustos(e.categorias).desvioTotal).toBe(-8000)
  })
})

describe('Sem cenário: nada é inventado', () => {
  it('receita, lucro e margem estimados vêm null; o orçamento, que não depende do cenário, vem', () => {
    const e = marfimCasaNorte()
    const card = resultadoRealizado(e, null)
    expect(card.estimado.custos).toBe(306540)
    expect(card.estimado.receita).toBeNull()
    expect(card.estimado.lucro).toBeNull()
    expect(card.estimado.margem).toBeNull()
  })

  it('receita zerada não vira margem 0% — vem null, como em calc.js', () => {
    const e = marfimCasaNorte()
    e.lotes = []
    e.outrasReceitas = { bar: 0, patrocinio: '' }
    const card = cardDe(e)
    expect(card.estimado.receita).toBe(0)
    expect(card.estimado.margem).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// O QUE NÃO PODIA MUDAR — e não mudou.
// ═══════════════════════════════════════════════════════════════════════════

describe('O lado REALIZADO ficou intacto (fotografia literal)', () => {
  it('cada número do realizado do evento-régua, ao real', () => {
    const card = cardDe(marfimCasaNorte())
    // Receita realizada, passo a passo.
    expect(card.bilheteriaBruta).toBe(500000)
    expect(card.taxa).toBe(50000)
    expect(card.cashback).toBe(25000)
    expect(card.bilheteriaLiquida).toBe(475000)
    expect(card.bar).toBe(76540)
    expect(card.patrocinio).toBe(0)
    expect(card.receita).toBe(551540)
    // Custos realizados e o resultado.
    expect(card.custos).toBe(376360)
    expect(card.custosRealizados).toBe(359820)
    expect(card.custosPendentes).toBe(16540)
    expect(card.resultado).toBe(175180)
    expect(card.sinal).toBe('lucro')
    // A pendência declarada.
    expect(card.nItens).toBe(5)
    expect(card.nComRealizado).toBe(4)
    expect(card.nSemRealizado).toBe(1)
    expect(card.completo).toBe(false)
    // A ponte com os cenários (LIDA do cenário, nunca recalculada).
    expect(card.lucroDoCenario).toBe(175180)
    expect(card.diferencaParaCenario).toBe(0)
  })
})

describe('A PREVISÃO VIVA do evento ABERTO não foi tocada', () => {
  // Durante a produção, o cenário realista DEVE seguir usando o realizado onde
  // ele existe — é o melhor palpite para um item já pago, e mexer nisso seria
  // outro defeito. O que mudou foi só a COMPARAÇÃO estimado × realizado do card,
  // que nem existe em evento aberto.
  it('o cenário realista continua somando valorConsiderado (realizado onde há)', () => {
    const e = marfimCasaNorte()
    e.status = 'aberto'
    e.fechamento = null
    const cen = computeCenario(e, 'realista')
    // 359.820 pagos + 16.540 do item que falta = a régua de sempre.
    expect(cen.custoItens).toBe(376360)
    expect(cen.custoTotal).toBe(376360)
    expect(cen.lucro).toBe(175180)
    // E os três cenários seguem existindo com a mesma conta.
    const c = computeCenarios(e)
    expect(c.pessimista.custoItens).toBe(376360)
    expect(c.otimista.custoItens).toBe(376360)
  })

  it('o orçamento não vaza para o cenário: trocar o estimado de um item já PAGO não move o cenário', () => {
    const e = marfimCasaNorte()
    e.status = 'aberto'
    const antes = computeCenario(e, 'realista').custoTotal
    e.categorias[0].itens[0].estimado = 1 // o item já tem realizado 119.820
    const depois = computeCenario(e, 'realista').custoTotal
    expect(depois).toBe(antes)
    // Mas o ORÇAMENTO do card sente, porque é isso que ele é.
    expect(cardDe(e).estimado.custos).toBe(206541)
  })
})
