// EVIDÊNCIA — "quem responde 'ganhamos dinheiro nesta festa?' fora do card".
//
// Este arquivo é EVIDÊNCIA PURA, nunca trava de comportamento. Ele NÃO diz o
// que o app deve fazer: ele fotografa, com os módulos reais, o que o app FAZ
// hoje em festas que JÁ ACONTECERAM. A decisão do que mudar é do Marco
// (princípio "Quando parar e perguntar" do CLAUDE.md) e ainda não foi tomada.
// Nenhum componente foi alterado para escrever isto.
//
// ---------------------------------------------------------------------------
// O ACHADO (varredura de superfícies de 20/07/2026 — S2 no BACKLOG)
// ---------------------------------------------------------------------------
// Em 20/07 o card "Resultado do evento" da aba Fechamento passou a responder
// "ganhamos dinheiro nesta festa?" com DINHEIRO REAL (resultadoRealizado()).
// Mas `resultadoRealizado` tem UM ÚNICO consumidor: FechamentoTab.jsx.
// Copiar resumo, PDF, modo apresentação, versão de reunião, veredito e
// benchmark promovido seguem em `computeCenarios` — a PREVISÃO — mesmo depois
// da festa e mesmo com o realizado lançado.
//
// Isto é PRÉ-EXISTENTE (o resumo sempre foi da previsão). O que 20/07 criou foi
// uma SEGUNDA resposta oficial para a MESMA pergunta, com a ponte construída
// num sentido só: o card sabe explicar por que difere da Home; a Home, o PDF e
// o WhatsApp não sabem que o card existe.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO É GRAVE PELA RÉGUA DA CASA
// ---------------------------------------------------------------------------
// "Um número errado mostrado como certo é o pior bug possível." O caso (a)
// abaixo mede uma festa que deu PREJUÍZO de R$ 5.900 e sobre a qual o texto
// copiado para o grupo das sócias anuncia "🟢 Esse evento sai · realista
// R$ 47 mil". R$ 53.200 de diferença, SINAL INVERTIDO, no canal com MENOS
// contexto e MENOS chance de conferência.
//
// As festas abaixo são construídas para a medição — não são dados do Marco.

import { describe, it, expect } from 'vitest'
import { computeCenarios, computeCenario, veredito, ritmoVendas, custosPorCategoria } from './calc.js'
import { resultadoRealizado, montarBenchmarkDeEvento } from './fechamento.js'
import { resumoCurto, fraseRitmo } from './resumo.js'
import { fraseVeredito, TITULO_VEREDITO } from './vereditoTexto.js'
import { resumoComparacao } from './versaoReuniao.js'
import { montarItensPlano } from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem, novoPatrocinio } from './defaults.js'

const HOJE = '2026-07-20'
const lote = (nome, valor, quantidade) => novoLote({ nome, valor, quantidade })
const item = (servico, estimado, realizado) =>
  novoItem({ servico, estimado, realizado, status: 'PAGO' })

const cats = (mapa) =>
  novoEvento('tmp').categorias.map((c) => ({ ...c, itens: mapa[c.id] || [] }))

// Os padrões de cenário da MEDIÇÃO (20/07/2026): o pessimista vendia 70%. Em
// 27/07/2026 o Marco subiu o padrão para 80 (decisão A) e o evento novo passou
// a nascer em 80 — mas os R$ afirmados neste arquivo são os que foram MEDIDOS
// naquele dia, e o assunto aqui é o sinal invertido do realizado, não o padrão
// de venda. Por isso as festas da medição carregam o 70 explícito e a marca
// `padraoPessimista80`, que impede a migração de subi-lo.
const cenariosDaMedicao = () => ({
  pessimista: { vendaPct: 70, custoPct: 10 },
  realista: { vendaPct: 90, custoPct: 0 },
  otimista: { vendaPct: 100, custoPct: -5 },
  overrides: { pessimista: {}, realista: {}, otimista: {} },
})

const festa = (nome, patch) => ({
  ...novoEvento(nome),
  cenariosConfig: cenariosDaMedicao(),
  padraoPessimista80: { de: null },
  ...patch,
})

// ——— (a) vendeu ABAIXO do previsto: prejuízo real, previsão dizia lucro ———
const brisa = festa('Brisa 14/03', {
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

// ——— (b) vendeu ACIMA: lucro real MAIOR do que a previsão previa ———
const marfim = festa('Marfim Alto 09/05', {
  data: '2026-05-09', local: 'Galeão Marfim', tipo: 'Marfim Alto',
  publicoEstimado: 600, taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: 12000, patrocinio: '' }, vendidosAteHoje: 640,
  lotes: [lote('Lote Promocional', 80, 200), lote('Lote 1', 120, 250), lote('Lote 2', 150, 150)],
  categorias: cats({
    artistico: [item('Atrações', 20000, 19500)],
    estrutura: [item('Estrutura', 15000, 15000)],
    equipe: [item('Equipe', 10000, 9800)],
    locacao: [item('Aluguel do espaço', 8000, 8000)],
  }),
  receitaRealizada: { bilheteria: 92000, bar: 17000 },
})

// ——— (c) custos ESTOURARAM depois da festa (realizado > estimado) ———
const sobrado = festa('Sobrado 21/06', {
  data: '2026-06-21', local: 'Rooftop Sobrado', tipo: 'Sobrado',
  publicoEstimado: 500, taxaBilheteria: 10, cashbackPct: 5, contingenciaPct: 5,
  barModo: 'fixo', outrasReceitas: { bar: 9000, patrocinio: '' }, vendidosAteHoje: 460,
  lotes: [lote('Lote 1', 90, 300), lote('Lote 2', 110, 250)],
  categorias: cats({
    artistico: [item('DJs', 12000, 18500)],
    estrutura: [item('Som, luz, gerador', 14000, 21000)],
    equipe: [item('Equipe', 8000, 11500)],
    marketing: [item('Tráfego', 4000, 6200)],
  }),
  receitaRealizada: { bilheteria: 49500, bar: 8600 },
})

// ——— (d) patrocínio RECEBIDO + taxa alta: bruto e líquido divergem muito ———
const galeaoFesta = festa('O Galeao 12/07', {
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

// ——— (e) O CASO SILENCIOSO: festa passada, NENHUM realizado lançado ———
const silenciosa = {
  ...brisa,
  nome: 'Brisa 14/03 (sem realizado lançado)',
  receitaRealizada: { bilheteria: '', bar: '' },
  categorias: brisa.categorias.map((c) => ({
    ...c, itens: c.itens.map((i) => ({ ...i, realizado: '' })),
  })),
}

const verdadeDe = (ev) => {
  const c = computeCenarios(ev)
  const rr = resultadoRealizado(ev, c.realista)
  return { c, rr, verdade: rr ? rr.resultado : null }
}

describe('A verdade em dinheiro de cada festa (card do Fechamento)', () => {
  it('(a) Brisa vendeu abaixo: a festa deu PREJUÍZO de R$ 5.900', () => {
    const { rr } = verdadeDe(brisa)
    expect(rr.bilheteriaBruta).toBe(38000)
    expect(rr.bilheteriaLiquida).toBe(36100) // 38.000 − 10% taxa + 5% cashback
    expect(rr.receita).toBe(38100)
    expect(rr.custos).toBe(44000)
    expect(rr.resultado).toBe(-5900)
    expect(rr.completo).toBe(true)
  })

  it('(b) Marfim vendeu acima: LUCRO real de R$ 52.100', () => {
    expect(verdadeDe(marfim).verdade).toBe(52100)
  })

  it('(c) Sobrado estourou custos: PREJUÍZO real de R$ 1.575', () => {
    const { rr } = verdadeDe(sobrado)
    expect(rr.custos).toBe(57200) // orçado 38.000 → realizado 57.200
    expect(rr.resultado).toBe(-1575)
  })

  it('(d) O Galeao: taxa de 22% come R$ 19.360 entre a bruta e a líquida', () => {
    const { rr } = verdadeDe(galeaoFesta)
    expect(rr.bilheteriaBruta).toBe(88000)
    expect(rr.taxa).toBe(19360)
    expect(rr.bilheteriaLiquida).toBe(70400)
    expect(rr.patrocinio).toBe(30000) // só o RECEBIDO; a proposta de 20.000 fica fora
    expect(rr.patrocinioPotencial).toBe(20000)
    expect(rr.resultado).toBe(24100)
  })

  it('(e) O CASO SILENCIOSO: sem realizado lançado, o card NÃO EXISTE', () => {
    const c = computeCenarios(silenciosa)
    // Ninguém responde a pergunta em dinheiro real. A única resposta na tela é
    // a previsão — e ela não sabe que a festa já aconteceu.
    expect(resultadoRealizado(silenciosa, c.realista)).toBeNull()
    expect(c.realista.lucro).toBe(47300)
  })
})

describe('SINAL INVERTIDO — a superfície diz lucro e a verdade é prejuízo', () => {
  it('(a) o WhatsApp anuncia 🟢 "Evento viável · realista R$ 47 mil" numa festa que perdeu R$ 5.900', () => {
    const { c, verdade } = verdadeDe(brisa)
    const texto = resumoCurto(brisa, { hoje: HOJE })

    expect(verdade).toBe(-5900)          // a verdade: PREJUÍZO
    expect(c.realista.lucro).toBe(47300) // o que o texto publica: LUCRO
    expect(c.realista.lucro - verdade).toBe(53200)
    expect(Math.sign(c.realista.lucro)).not.toBe(Math.sign(verdade))

    expect(texto).toContain('🟢')
    expect(texto).toContain('Evento viável')
    expect(texto).toContain('realista R$ 47 mil')
    // ATUALIZAÇÃO DA FOTOGRAFIA (20/07/2026): estas duas linhas mediam a
    // AUSÊNCIA de qualquer palavra dizendo que a festa já aconteceu. Essa
    // ausência era o bug (a frase existia e era descartada) e foi corrigida.
    // O achado desta evidência CONTINUA VÁLIDO: os números ao lado seguem
    // sendo previsão numa festa que perdeu R$ 5.900 — pendente do Marco.
    expect(texto).toContain('Evento já realizado')
  })

  it('(a) TODAS as 11 superfícies de computeCenarios invertem o sinal, juntas', () => {
    const { c, verdade } = verdadeDe(brisa)
    // Home, Cenários, PDF, Apresentação, versão de reunião, resumo:
    // é literalmente o mesmo número em todas.
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(c[k].lucro).toBeGreaterThan(0)
      expect(verdade).toBeLessThan(0)
    }
    expect(c.pessimista.lucro).toBeCloseTo(23680, 6)
    expect(c.otimista.lucro).toBe(59110)
  })

  it('(a) o veredito diz "Evento viável" no PRESENTE sobre uma festa de 4 meses atrás', () => {
    const { c } = verdadeDe(brisa)
    const v = veredito(c, brisa)
    expect(v.cor).toBe('verde')
    expect(TITULO_VEREDITO[v.cor]).toBe('Evento viável')
    expect(fraseVeredito(c, v)).toContain('Viável: margem realista')
  })

  it('(b) o pessimista publica PREJUÍZO de R$ 2.854 numa festa que lucrou R$ 52.100', () => {
    const { c, verdade } = verdadeDe(marfim)
    expect(Math.round(c.pessimista.lucro)).toBe(-2854)
    expect(verdade).toBe(52100)
    expect(Math.sign(c.pessimista.lucro)).not.toBe(Math.sign(verdade))
    // E o semáforo rebaixa uma festa que foi a mais lucrativa das quatro.
    expect(veredito(c, marfim).cor).toBe('amarelo')
  })

  it('(c) o otimista publica LUCRO de R$ 3.718 numa festa que perdeu R$ 1.575', () => {
    const { c, verdade } = verdadeDe(sobrado)
    expect(Math.round(c.otimista.lucro)).toBe(3718)
    expect(verdade).toBe(-1575)
    expect(Math.sign(c.otimista.lucro)).not.toBe(Math.sign(verdade))
  })
})

describe('AGRAVANTE 1 — o único marcador de "a festa aconteceu" é suprimido', () => {
  it('ritmoVendas SABE que o evento passou, e tem frase própria em português', () => {
    const { c } = verdadeDe(brisa)
    const r = ritmoVendas({
      vendidos: brisa.vendidosAteHoje, dataEvento: brisa.data,
      breakEven: c.realista.breakEven, hoje: HOJE,
    })
    expect(r).toEqual({ eventoPassado: true })
    expect(fraseRitmo(r)).toBe('Evento já realizado — o acompanhamento de vendas não se aplica.')
  })

  it('mas o texto do WhatsApp descarta a frase (resumo.js:70) e some com o vestígio', () => {
    // A supressão não é só do resumo: os MESMOS 4 consumidores descartam.
    //   src/lib/resumo.js:70            → `if (!frase || r.eventoPassado) return null`
    //   src/components/RitmoVendas.jsx:102 → idem (card da Home)
    //   src/components/ReportView.jsx:170  → `ritmo && !ritmo.eventoPassado ? … : null` (PDF)
    //   src/components/CurvaVendas.jsx:583 → idem (curva de vendas)
    // Exibida em UM lugar só: RitmoVendas.jsx:71-78 (o card cheio).
    // CORRIGIDO EM 20/07/2026. Até esta data o texto do WhatsApp descartava a
    // frase e media-se a ausência:
    //     expect(texto).not.toContain('Evento já realizado')
    // Os quatro descartes foram removidos; a frase é a MESMA de sempre e não
    // acompanha número nenhum ("Vendidos até hoje: N" não existe depois da
    // festa, porque ritmoVendas devolve só `{ eventoPassado: true }`).
    const texto = resumoCurto(brisa, { hoje: HOJE })
    expect(texto).toContain('Evento já realizado — o acompanhamento de vendas não se aplica.')
    expect(texto).not.toContain('Vendidos até hoje')

    // A medição que motivou o conserto, refeita: a festa PASSADA e a FUTURA
    // não podem mais sair com o mesmo texto. Antes, a passada era a futura
    // MENOS a linha de ritmo, com NADA no lugar dela.
    const futura = { ...brisa, data: '2026-12-31' }
    const linhasPassada = resumoCurto(brisa, { hoje: HOJE }).split('\n').slice(1)
    const linhasFutura = resumoCurto(futura, { hoje: HOJE }).split('\n').slice(1)

    // Mesmo número de linhas: a marcação OCUPA o lugar da linha de ritmo.
    expect(linhasFutura.length).toBe(linhasPassada.length)
    expect(linhasFutura[linhasFutura.length - 1]).toContain('Vendidos até hoje')
    expect(linhasPassada[linhasPassada.length - 1]).toBe(
      'Evento já realizado — o acompanhamento de vendas não se aplica.'
    )
    // E as linhas ANTERIORES seguem idênticas — nenhum número mudou.
    expect(linhasPassada.slice(0, -1)).toEqual(linhasFutura.slice(0, -1))
  })
})

describe('AGRAVANTE 2 — computeCenarios já mistura as bases dentro da previsão', () => {
  it('(c) custo 100% REALIZADO contra receita 100% PREVISTA, com contingência sobre dinheiro já gasto', () => {
    const cen = computeCenario(sobrado, 'realista')
    const custos = custosPorCategoria(sobrado.categorias)

    // O custo do cenário parte do CONSIDERADO, que aqui é 100% realizado.
    expect(custos.totalEstimado).toBe(38000)
    expect(custos.totalRealizado).toBe(57200)
    expect(cen.custoItens).toBe(57200) // = totalConsiderado, o realizado

    // E a contingência de 5% incide sobre ele: R$ 2.860 de reserva para
    // imprevistos... em despesas que já foram integralmente pagas.
    expect(cen.contingencia).toBe(2860)
    expect(cen.custoTotal).toBe(60060)

    // Do outro lado, a receita segue 100% projetada, ignorando a bilheteria
    // realizada de R$ 49.500 que o Marco já lançou.
    expect(Math.round(cen.bruta)).toBe(49050)
    expect(sobrado.receitaRealizada.bilheteria).toBe(49500)
  })
})

// AGRAVANTE 3 — CONSERTADO EM 20/07/2026, por decisão datada do Marco.
//
// Este bloco mediu o pior dos agravantes: o benchmark promovido gravava um
// TERCEIRO lucro, diferente do card e do cenário, e o gravava PARA SEMPRE. A
// conta agora é a mesma do card (`resultadoRealizado`) — a especificação, o
// diff antigo × novo e a transcrição da conta velha estão em
// `promoverBenchmark.evidencia.test.js`.
//
// O bloco fica, invertido: onde ele cobrava a divergência, agora cobra a
// COINCIDÊNCIA. É o cadeado de não-regressão do conserto nas mesmas fixtures
// que revelaram o defeito.
describe('AGRAVANTE 3 (CONSERTADO) — o benchmark grava o MESMO lucro do card', () => {
  it('(d) montarBenchmarkDeEvento passa pela taxa, pelo cashback, pelo bar e pelo patrocínio', () => {
    const { verdade } = verdadeDe(galeaoFesta)
    const bm = montarBenchmarkDeEvento(galeaoFesta)

    // Era: receita 88.000 (a BRUTA), lucro −2.500 — sinal oposto à verdade.
    expect(verdade).toBe(24100)
    expect(bm.receita).toBe(114600) // líquida + bar + patrocínio fechado
    expect(bm.custoTotal).toBe(90500) // a metade que já estava certa, intocada
    expect(bm.lucro).toBe(24100)
    expect(bm.lucro).toBe(verdade)
    expect(bm.lucro - verdade).toBe(0)
  })

  it('(a) o mesmo evento não vira mais DOIS "lucros realizados" diferentes', () => {
    const { verdade } = verdadeDe(brisa)
    expect(verdade).toBe(-5900) // card do Fechamento
    expect(montarBenchmarkDeEvento(brisa).lucro).toBe(-5900) // era −6.000
  })

  it('(e) no caso silencioso a promoção RECUSA em vez de inventar R$ 56.000', () => {
    // Era: sem bilheteria realizada a receita vinha da soma dos lotes
    // ESGOTADOS — 1.000 ingressos que nunca venderam. Agora o botão recusa e
    // diz o que falta (decisão 5 do Marco, 20/07/2026).
    expect(montarBenchmarkDeEvento(silenciosa)).toBeNull()
  })
})

describe('A ponte existe, mas só num sentido', () => {
  it('o card sabe explicar por que difere da Home — a Home não sabe que o card existe', () => {
    const { c, rr } = verdadeDe(brisa)
    // O card carrega a ponte inteira, com identidade exata.
    expect(rr.lucroDoCenario).toBe(c.realista.lucro)
    expect(rr.diferencaParaCenario).toBe(-53200)
    expect(rr.reservaDoCenario + rr.desvioDeReceita).toBeCloseTo(rr.diferencaParaCenario, 6)
    expect(rr.reservaDoCenario).toBe(2200)      // contingência sobre custo já pago
    expect(rr.desvioDeReceita).toBe(-55400)     // vendeu MUITO menos do que o previsto
    // Nada disso chega ao resumo, ao PDF, à apresentação nem à versão de reunião.
    expect(resumoCurto(brisa, { hoje: HOJE })).not.toContain('53')
  })

  it('a versão de reunião compara PREVISÃO com PREVISÃO mesmo depois da festa', () => {
    const congelado = {
      ...sobrado,
      receitaRealizada: { bilheteria: '', bar: '' },
      categorias: sobrado.categorias.map((c) => ({
        ...c, itens: c.itens.map((i) => ({ ...i, realizado: '' })),
      })),
    }
    const cmp = resumoComparacao(congelado, sobrado)
    const lr = cmp.linhas.find((l) => l.label === 'Lucro (realista)')
    // O estouro de custo de R$ 19.200 aparece como "a PREVISÃO mudou
    // −R$ 20.160", nunca como "a festa aconteceu e deu −R$ 1.575".
    expect(Math.round(lr.antes)).toBe(15698)
    expect(Math.round(lr.agora)).toBe(-4462)
    expect(Math.round(lr.delta)).toBe(-20160)
    expect(verdadeDe(sobrado).verdade).toBe(-1575) // e ninguém mostra este
  })
})

describe('planoFinanceiro.js é o padrão de referência do app', () => {
  it('não muda o número, mas DECLARA em português que está publicando o previsto', () => {
    const plano = montarItensPlano(sobrado)
    const aviso = plano.avisos.find((a) => a.includes('realizado preenchido'))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('4 itens de custo já têm realizado preenchido')
    expect(aviso).toContain('57.200 no total')
    expect(aviso).toContain('elas levam o PREVISTO')
    // É a ÚNICA superfície do app que, ao detectar realizado, nomeia quantos
    // itens, quanto somam, e qual linha foge à regra. Serve de modelo para
    // qualquer decisão que o Marco tomar sobre as outras 22.
  })
})
