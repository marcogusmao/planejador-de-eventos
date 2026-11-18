// AS QUATRO SUPERFÍCIES DE CUSTO TÊM DE DIZER O MESMO NÚMERO.
//
// ---------------------------------------------------------------------------
// O DEFEITO, MEDIDO (26/07/2026)
// ---------------------------------------------------------------------------
// Uma festa com QUATRO itens numa única categoria — 1.215,82 / 6.571,21 /
// 6.605,32 / 920,15 —, nenhum deles pago ainda, bilheteria realizada de 20.000:
//
//   aba Custos ............ 15312,5                → a tela escrevia R$ 15.313
//   aba Cenários .......... 15312,5                → a tela escrevia R$ 15.313
//   aba Fechamento (card) . 15312,499999999998     → a tela escrevia R$ 15.312
//   aba Fechamento (tabela) 15312,499999999998     → a tela escrevia R$ 15.312
//
// Duas abas do MESMO app, R$ 1 de diferença na MESMA festa. A soma dos quatro
// valores dá 15.312,50 exatos; em ponto flutuante ela cai em
// 15.312,499999999998 e o arredondamento da tela desce para 15.312 em vez de
// subir para 15.313.
//
// ---------------------------------------------------------------------------
// A RÉGUA — ARREDONDAR CADA PARCELA (Marco, 25/07/2026; reafirmada em 26/07)
// ---------------------------------------------------------------------------
// `somaCentavos()` (util.js) transforma CADA parcela em centavos inteiros
// (`Math.round(v * 100)`) e só então soma. Soma de inteiros é associativa e
// exata: reordenar os itens não muda o último dígito. As abas Custos e
// Cenários já bebiam dessa régua (`custosPorCategoria()` em calc.js, desde
// 25/07/2026); o Fechamento ficou de fora e é por isso que ele discordava.
//
// O MARCO RECUSOU EXPLICITAMENTE a outra régua ("somar cru e arredondar o
// total"). Ela é mais curta de escrever e reabre dois defeitos já fechados:
//   1. volta a depender da ORDEM dos itens (medido: três itens de planilha com
//      três casas decimais davam 5.141,14 em duas ordens e 5.141,15 nas outras
//      quatro);
//   2. faz o relatório imprimir a linha fantasma "Outras categorias  −R$ 1"
//      numa festa que não tem categoria nenhuma fora do mapa.
// Os testes 2 e 3 deste arquivo existem para matar essa tentação: quem trocar a
// régua vê os dois vermelhos.
import { describe, it, expect } from 'vitest'
import { computeCenario, custosPorCategoria } from './calc.js'
import { confrontoCustos } from './confrontoCustos.js'
import { resultadoRealizado, fechamentoCustos } from './fechamento.js'
import { colunaCustoPrevisao } from './comparacaoCustos.js'
import { novoEvento, novoItem } from './defaults.js'
import { fmtBRL } from './format.js'

// Festa-régua: contingência 0, taxa 0, sem cashback, sem bar, sem patrocínio —
// para o custo dos itens ser a ÚNICA coisa que as quatro telas leem. Bilheteria
// realizada informada (20.000) porque o card do Fechamento só existe quando há
// receita realizada.
const festa = (categorias, over = {}) => ({
  ...novoEvento('Quatro superfícies'),
  contingenciaPct: 0,
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
  receitaRealizada: { bilheteria: 20000, bar: '' },
  categorias,
  ...over,
})

const umaCategoria = (valores, catId = 'aeb') => [
  {
    id: catId,
    nome: 'A&B',
    itens: valores.map((v, i) => novoItem({ servico: `Item ${i + 1}`, estimado: v })),
  },
]

const catPrevisao = (cen) => (k) =>
  cen.custosCategorias.find((x) => x.id === k)?.considerado || 0

/**
 * As QUATRO TELAS em que o Marco lê "quanto esta festa custa", cada uma pela via
 * que a tela de verdade usa:
 *
 *   custos     — aba Custos, card "Custo total" (custosPorCategoria)
 *   cenarios   — aba Cenários, e a linha "Custos (itens)" do DRE do relatório
 *                (computeCenario → custoItens)
 *   fechamento — aba Fechamento, card "Resultado do evento"
 *                (resultadoRealizado → custos)
 *   relatorio  — o relatório impresso: o INTEIRO que a coluna de custo fecha
 *                (colunaCustoPrevisao → total). É a única das quatro que já sai
 *                arredondada, porque é a única que imprime reais sem centavos.
 *
 * DELIBERADAMENTE FORA DESTA LISTA: `fechamentoCustos().totalEstimadoComparavel`,
 * a coluna "Estimado" da tabela do Fechamento. Ela PARECE a quinta superfície e
 * não é: quando algum item já foi pago, ela mostra de propósito o estimado
 * SÓ DESSES itens (o par honesto do realizado, decisão de 20/07/2026), que é
 * outra grandeza. Medido numa varredura de 20.000 festas com itens
 * parcialmente pagos: ela difere das outras em 91% delas — e está certa. Cobrar
 * igualdade dela seria um teste verde sobre uma afirmação falsa; a relação real
 * dela está no teste do invariante, mais abaixo.
 */
const quatroSuperficies = (evento) => {
  const cen = computeCenario(evento, 'realista')
  const card = resultadoRealizado(evento, cen)
  return {
    custos: custosPorCategoria(evento.categorias).totalConsiderado,
    cenarios: cen.custoItens,
    fechamento: card.custos,
    relatorio: colunaCustoPrevisao(cen, catPrevisao(cen)).total,
  }
}

// O que o leitor VÊ, não o que o módulo devolve. É nesta linha que o R$ 1
// aparecia: os quatro números diferiam na 12ª casa e a tela os arredondava para
// lados opostos.
const naTela = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, fmtBRL(v)]))

// ---------------------------------------------------------------------------
// 1. AS QUATRO CONCORDAM — a festa dos quatro itens
// ---------------------------------------------------------------------------
describe('as quatro superfícies de custo devolvem o MESMO total', () => {
  const VALORES = [1215.82, 6571.21, 6605.32, 920.15] // soma exata: 15.312,50
  const evento = festa(umaCategoria(VALORES))

  it('a festa dos quatro itens: 15.312,50 até o centavo nas três que guardam centavos', () => {
    const s = quatroSuperficies(evento)
    expect(s.custos).toBe(15312.5)
    expect(s.cenarios).toBe(15312.5)
    expect(s.fechamento).toBe(15312.5)
    // o relatório imprime reais inteiros — é o arredondamento do MESMO número
    expect(s.relatorio).toBe(15313)
  })

  // O texto esperado sai do PRÓPRIO formatador (`fmtBRL(15313)`), nunca de uma
  // constante escrita à mão: o pt-BR usa espaço INQUEBRÁVEL depois do "R$", e
  // uma string literal com espaço comum falha por um motivo que nada tem a ver
  // com dinheiro — teste que reprova por engano ensina a ignorar vermelho.
  it('e as quatro escrevem a MESMA coisa na tela — R$ 15.313 nas quatro', () => {
    const t = naTela(quatroSuperficies(evento))
    const esperado = fmtBRL(15313)
    expect(t).toEqual({
      custos: esperado,
      cenarios: esperado,
      fechamento: esperado,
      relatorio: esperado,
    })
    // e o texto é mesmo o que o Marco lê na tela
    expect(esperado.replace(/\s/g, ' ')).toBe('R$ 15.313')
  })

  // Falha se QUALQUER par discordar — inclusive um par que os dois testes
  // acima não nomeiem, caso alguém acrescente uma quinta superfície aqui.
  it('nenhum par das quatro discorda, em nenhuma das festas de prova', () => {
    const provas = [
      [1215.82, 6571.21, 6605.32, 920.15],
      [0.1, 0.2],
      [1546.1, 1914.283, 1680.762],
      [1000.005, 2000.005, 3000.005],
      [33.33, 33.33, 33.34],
      [12345.67],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    ]
    const discordantes = []
    for (const vals of provas) {
      const s = quatroSuperficies(festa(umaCategoria(vals)))
      // A comparação é sobre o que a TELA escreve, porque é isso que o Marco lê
      // e é a única régua em que as quatro são a mesma grandeza (o relatório
      // imprime reais inteiros; as outras três guardam centavos).
      const t = naTela(s)
      if (new Set(Object.values(t)).size > 1) {
        discordantes.push(
          `${vals.join(' + ')} → ` +
            Object.entries(t)
              .map(([k, v]) => `${k}=${v}`)
              .join('  ')
        )
      }
      // e as três que guardam centavos batem ao centavo entre si
      const cents = [s.custos, s.cenarios, s.fechamento]
      if (new Set(cents).size > 1) {
        discordantes.push(`${vals.join(' + ')} → centavos divergentes: ${cents.join(' / ')}`)
      }
    }
    expect(discordantes).toEqual([])
  })

  // Duas categorias: o total de cada uma é exato em centavos, e o total geral
  // também tem de ser — senão a soma entre categorias reabre o buraco.
  it('com DUAS categorias as quatro continuam idênticas', () => {
    const cats = [
      { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Bebidas', estimado: 0.1 })] },
      { id: 'equipe', nome: 'Equipe', itens: [novoItem({ servico: 'Garçons', estimado: 0.2 })] },
    ]
    const s = quatroSuperficies(festa(cats))
    expect(s.custos).toBe(0.3)
    expect(s.cenarios).toBe(0.3)
    expect(s.fechamento).toBe(0.3)
  })

  // Metade paga, metade não: o card soma realizado + estimado pendente. As duas
  // parcelas precisam ser exatas E a soma delas também.
  it('com parte dos itens já pagos, o card continua batendo com a aba Custos', () => {
    const cats = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          novoItem({ servico: 'Bebidas', estimado: 1215.82, realizado: 1215.82 }),
          novoItem({ servico: 'Gelo', estimado: 6571.21, realizado: 6571.21 }),
          novoItem({ servico: 'Copos', estimado: 6605.32 }),
          novoItem({ servico: 'Frutas', estimado: 920.15 }),
        ],
      },
    ]
    const evento2 = festa(cats)
    const cen = computeCenario(evento2, 'realista')
    const card = resultadoRealizado(evento2, cen)
    const conf = confrontoCustos(cats)
    expect(card.custos).toBe(15312.5)
    expect(custosPorCategoria(cats).totalConsiderado).toBe(15312.5)
    // O invariante das duas telas, com o centavo fechado.
    expect(conf.realizado + conf.estimadoPendente).toBe(15312.5)
    expect(conf.realizado).toBe(7787.03)
    expect(conf.estimadoPendente).toBe(7525.47)
  })

  // A COLUNA "ESTIMADO" DA TABELA DO FECHAMENTO — a quinta superfície aparente,
  // que de propósito NÃO é igual às quatro. Este teste existe para que ninguém
  // "conserte" a diferença dela achando que é o mesmo defeito: ela responde
  // outra pergunta ("o que estava orçado PARA OS ITENS QUE JÁ PAGUEI"), e a
  // relação verdadeira entre ela e o resto é a que está escrita aqui.
  it('a coluna Estimado do Fechamento é OUTRA grandeza — e a relação dela fecha ao centavo', () => {
    const cats = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          novoItem({ servico: 'Bebidas', estimado: 1215.82, realizado: 1300.0 }),
          novoItem({ servico: 'Gelo', estimado: 6571.21, realizado: 6500.0 }),
          novoItem({ servico: 'Copos', estimado: 6605.32 }),
          novoItem({ servico: 'Frutas', estimado: 920.15 }),
        ],
      },
    ]
    const tabela = fechamentoCustos(cats)
    const conf = confrontoCustos(cats)

    // o orçamento inteiro (todos os itens) é o mesmo total das outras telas
    expect(tabela.totalEstimado).toBe(15312.5)
    // a coluna "Estimado" mostra só o par honesto dos itens já pagos
    expect(tabela.totalEstimadoComparavel).toBe(7787.03)
    expect(tabela.totalRealizado).toBe(7800)
    // e o desvio impresso fecha com a subtração que o leitor faz com o dedo.
    // 7.800,00 − 7.787,03 = 12,97 EXATOS. Somado cru, isto dava
    // 12.970000000000255 — o mesmo cisco que a régua por parcela remove.
    expect(tabela.desvioTotal).toBe(12.97)
    // A conta fecha EM CENTAVOS — que é a régua da casa e a do leitor. Fazer a
    // subtração aqui em ponto flutuante devolveria 12.970000000000255; é
    // exatamente esse cisco que o módulo deixou de propagar.
    expect(Math.round(tabela.totalRealizado * 100) - Math.round(tabela.totalEstimadoComparavel * 100)).toBe(
      Math.round(tabela.desvioTotal * 100)
    )
    // O invariante que amarra a tabela ao custo total das outras três telas:
    // realizado de quem já pagou + estimado de quem falta = custo da festa.
    // Cobrado pelo número que o CARD publica (é ele que aplica a régua) e em
    // centavos — somar as duas parcelas em ponto flutuante AQUI devolveria
    // 15.325,470000000001, que é o cisco, não o dado.
    const evento2 = festa(cats)
    const card = resultadoRealizado(evento2, computeCenario(evento2, 'realista'))
    expect(card.custos).toBe(custosPorCategoria(cats).totalConsiderado)
    expect(card.custos).toBe(15325.47)
    expect(Math.round(conf.realizado * 100) + Math.round(conf.estimadoPendente * 100)).toBe(
      Math.round(card.custos * 100)
    )
  })
})

// ---------------------------------------------------------------------------
// 2. REORDENAR NÃO MUDA NADA — e a prova PRECISA de três casas decimais
// ---------------------------------------------------------------------------
// ATENÇÃO A QUEM MEXER AQUI: com valores de DUAS casas este teste passa verde
// enquanto a afirmação é falsa, porque a régua errada ("somar cru e arredondar
// o total") também é estável em duas casas. Foi exatamente assim que uma
// tentativa anterior se enganou. Os três números abaixo têm TRÊS casas de
// propósito — é o que uma célula de planilha importada entrega — e é só com
// eles que a régua errada aparece.
describe('reordenar os itens de uma categoria não muda nenhuma das quatro', () => {
  const TRES_CASAS = [1546.1, 1914.283, 1680.762]

  const permutacoes = (a) =>
    a.length <= 1
      ? [a]
      : a.flatMap((x, i) =>
          permutacoes([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])
        )

  it('as 6 ordens dos três itens de três casas dão o MESMO número nas quatro', () => {
    const ordens = permutacoes(TRES_CASAS)
    expect(ordens).toHaveLength(6)
    for (const ordem of ordens) {
      const s = quatroSuperficies(festa(umaCategoria(ordem)))
      // 154610 + 191428 + 168076 centavos = 514114 centavos
      expect(`${ordem.join('/')} custos=${s.custos}`).toBe(`${ordem.join('/')} custos=5141.14`)
      expect(`${ordem.join('/')} cenarios=${s.cenarios}`).toBe(`${ordem.join('/')} cenarios=5141.14`)
      expect(`${ordem.join('/')} fechamento=${s.fechamento}`).toBe(
        `${ordem.join('/')} fechamento=5141.14`
      )
      expect(`${ordem.join('/')} relatorio=${s.relatorio}`).toBe(
        `${ordem.join('/')} relatorio=5141`
      )
    }
  })

  it('e as 6 ordens escrevem a MESMA linha na tela', () => {
    const escritos = new Set(
      permutacoes(TRES_CASAS).map((ordem) =>
        JSON.stringify(naTela(quatroSuperficies(festa(umaCategoria(ordem)))))
      )
    )
    const esperado = fmtBRL(5141)
    expect([...escritos]).toEqual([
      JSON.stringify({
        custos: esperado,
        cenarios: esperado,
        fechamento: esperado,
        relatorio: esperado,
      }),
    ])
    expect(esperado.replace(/\s/g, ' ')).toBe('R$ 5.141')
  })

  // A prova de que o caso escolhido é MESMO capaz de pegar a régua errada:
  // somar cru e arredondar o total dá dois resultados diferentes entre as 6
  // ordens. Se este teste ficar verde com um conjunto novo de valores, o
  // conjunto não serve de prova — troque os valores, não este teste.
  it('o caso escolhido é sensível: a régua recusada (somar cru) dá DOIS valores', () => {
    const somaCruaArredondada = (vals) =>
      Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100
    const distintos = new Set(permutacoes(TRES_CASAS).map(somaCruaArredondada))
    expect([...distintos].sort()).toEqual([5141.14, 5141.15])
  })
})

// ---------------------------------------------------------------------------
// 3. A LINHA FANTASMA "OUTRAS CATEGORIAS" NÃO NASCE
// ---------------------------------------------------------------------------
// O relatório tem uma linha "Outras categorias" para as rubricas que o Marco
// cria na mão e que não existem no mapa de comparação. Ela é calculada por
// DIFERENÇA (custo total do cenário menos a soma das categorias do mapa). Se as
// duas pontas dessa subtração passarem a usar réguas diferentes, a diferença
// deixa de ser zero e a festa ganha uma rubrica que não existe — a régua
// recusada imprimia "Outras categorias  −R$ 1".
describe('festa sem categoria fora do mapa não ganha linha "Outras categorias"', () => {
  const catPrev = (cen) => (k) => cen.custosCategorias.find((x) => x.id === k)?.considerado || 0

  const cat = (id, vals) => ({
    id,
    nome: id,
    itens: vals.map((v, i) => novoItem({ servico: `${id} ${i + 1}`, estimado: v })),
  })

  // ATENÇÃO A QUEM MEXER AQUI: com UMA categoria só, este teste passa verde
  // mesmo com a régua recusada — foi assim que a tentativa anterior deixou a
  // linha fantasma escapar. A linha "Outras categorias" nasce da DIFERENÇA
  // entre o custo total do cenário e a soma das categorias do mapa; com uma
  // categoria as duas pontas são o mesmo número por construção, e não há
  // diferença para dar errado. Os casos de DUAS E TRÊS categorias, cada uma
  // terminando em meio centavo, são os que de fato provam a afirmação:
  // medidos com a régua recusada, eles devolvem valor −0,01 / exibido −1 /
  // mostrar true, e o relatório imprime "Outras categorias  −R$ 1".
  const provas = [
    ['os quatro itens do defeito', [cat('aeb', [1215.82, 6571.21, 6605.32, 920.15])]],
    ['três casas decimais numa categoria', [cat('aeb', [1546.1, 1914.283, 1680.762])]],
    ['centavos redondos', [cat('aeb', [0.1, 0.2])]],
    ['meio centavo em cada parcela', [cat('aeb', [1000.005, 2000.005, 3000.005])]],
    ['um item só', [cat('aeb', [12345.67])]],
    // ↓ os que a tentativa anterior não tinha, e que pegam a régua recusada
    ['DUAS categorias, cada uma em meio centavo', [cat('aeb', [100.005]), cat('equipe', [200.005])]],
    [
      'TRÊS categorias, cada uma em meio centavo',
      [cat('aeb', [1000.005]), cat('equipe', [2000.005]), cat('artistico', [3000.005])],
    ],
    [
      'TRÊS categorias de planilha de três casas',
      [
        cat('aeb', [1546.107, 1914.283]),
        cat('equipe', [1680.762, 920.153]),
        cat('artistico', [1215.826, 6571.214]),
      ],
    ],
  ]

  for (const [nome, cats] of provas) {
    it(`${nome}: a linha nem aparece, e vale zero`, () => {
      const evento = festa(cats)
      const cen = computeCenario(evento, 'realista')
      const col = colunaCustoPrevisao(cen, catPrev(cen))
      expect(`${nome} valor=${col.outras.valor}`).toBe(`${nome} valor=0`)
      expect(`${nome} exibido=${col.outras.exibido}`).toBe(`${nome} exibido=0`)
      expect(`${nome} mostrar=${col.outras.mostrar}`).toBe(`${nome} mostrar=false`)
    })
  }

  it('quando a rubrica fora do mapa EXISTE de verdade, a linha aparece com o valor dela', () => {
    const cats = [
      { id: 'aeb', nome: 'A&B', itens: [novoItem({ servico: 'Bebidas', estimado: 1215.82 })] },
      {
        id: 'cachorro-quente',
        nome: 'Carrinho de cachorro-quente',
        itens: [novoItem({ servico: 'Carrinho', estimado: 920.15 })],
      },
    ]
    const evento = festa(cats)
    const cen = computeCenario(evento, 'realista')
    const col = colunaCustoPrevisao(cen, catPrev(cen))
    expect(col.outras.valor).toBe(920.15)
    expect(col.outras.mostrar).toBe(true)
    // A linha aparece com o valor dela, a menos do real que a coluna redistribui
    // para fechar no total exibido (regra de comparacaoCustos.js, teto R$ 1).
    expect(Math.abs(col.outras.exibido - col.outras.valor)).toBeLessThanOrEqual(1)
  })
})
