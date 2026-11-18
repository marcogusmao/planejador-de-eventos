// O que ESTA feature não pode fazer: mudar um número.
//
// Reordenar linhas é uma mudança de LEITURA. As setas ↑↓ dos custos, dos lotes
// e dos patrocínios mexem na posição de um item dentro de um array — e nada
// mais. Se alguma conta do app dependesse da posição sem ser por definição,
// arrastar uma linha viraria "número errado mostrado como certo", que é o pior
// bug possível neste app (CLAUDE.md, princípio 1).
//
// Este arquivo prova as três coisas que importam:
//
// 1. INVARIÂNCIA — várias permutações de lotes, de itens de custo e de
//    patrocínios, comparando TODOS os campos numéricos de computeCenarios
//    antes × depois, em DOIS eventos diferentes.
// 2. O QUE MUDA POR DEFINIÇÃO — a coluna Acumulada dos lotes e a curva de
//    vendas SÃO somas corridas na ordem exibida: elas acompanham a nova ordem
//    e continuam somando certo (a acumulada da última linha, que é o total,
//    não se mexe).
// 3. ROUND-TRIP — reordenar, exportar o backup JSON e reimportar devolve a
//    ordem nova.
//
// ————— CORREÇÃO DE ROTA (rodada 2 da verificação adversarial, 20/07/2026) —————
//
// A primeira versão deste arquivo dizia "Igualdade EXATA, byte a byte do ponto
// flutuante" e cravava `toEqual` em transposições de vizinhos. Isso estava
// ERRADO de duas maneiras, e as duas enganavam quem viesse depois:
//
//  · A exatidão era propriedade DAQUELES SEIS LOTES, não do código. Naquela
//    data — e num evento perfeitamente comum — trocar dois lotes vizinhos
//    dava desvio diferente de zero rotineiramente. O `eventoDoEmpate` abaixo
//    era um desses, medido: um clique de seta mudava a receita bruta em
//    2,9 × 10⁻¹¹. Com um teste que cravasse igualdade exata, no dia em que
//    alguém mexesse no fixture a leitura natural do vermelho seria "afrouxa
//    o teste".
//  · O comentário mandava desprezar desvios abaixo de meio centavo dizendo que
//    eles "não chegam à tela". FALSO, e refutado por medição: quando o total
//    cai EM CIMA de um empate de arredondamento (…,4999999 × …,5000000), meio
//    bilionésimo de real virava UM REAL no número exibido. A prova estava em
//    `ordenarHonestidade.test.js`, achado [H]: R$ 169.963 virava R$ 169.964
//    com um clique.
//
// ————— ACHADO [H] CONSERTADO em 25/07/2026 (portão do Marco) —————
//
// A raiz era a soma em ponto flutuante dentro de calc.js — PORTÃO DO MARCO
// (princípios 1 e 8), por isso não se consertava aqui; ficou registrada no
// BACKLOG.md com a pergunta pronta. O Marco decidiu quantizar a centavos
// ANTES de somar (tabela de valores antigos × novos na mesa — ver
// APROVADO-PELO-MARCO no commit): soma de centavos inteiros é associativa.
// Efeito medido NESTE arquivo: a troca de vizinhos nos LOTES do
// `eventoDoEmpate` — construído de propósito para expor o resíduo — também
// passou a dar desvio ZERO (ver o describe "a igualdade EXATA…" abaixo). A
// régua de meio centavo dos testes acima continua valendo como rede — ela
// cobre qualquer resíduo que ainda sobreviva em outra soma (patrocínios,
// totais entre categorias) que esta mudança não tocou.
//
// O que este arquivo passa a afirmar, e só isso: NENHUMA conta LÊ a posição da
// linha. A régua é meio centavo — o mesmo limiar de "isto é outro número" que
// o app usa em toda decisão de sinal (LIMIAR_ZERO, confrontoCustos.js). Desvio
// ACIMA disso é conta lendo posição, e é S1.
//
// Não é teste de fórmula nem golden: nenhuma conta é fotografada aqui, o que
// se compara é sempre "o mesmo evento consigo mesmo, noutra ordem".

import { describe, it, expect } from 'vitest'
import { computeCenarios, computeCenario, custosPorCategoria, CENARIOS } from './calc.js'
import { lotesDoPlano, curvaPlanoForma, totalPlanoLotes } from './curvaVendas.js'
import { moverItem, moverPorId } from './ordenar.js'
import { montarBackup, parseBackup, mesclarBackup } from './storage.js'

// Evento RICO de propósito: lote pago, cortesia, lote só-otimista, override
// manual de quantidade, ajuste de ticket, cupom com fração, taxa nossa,
// cashback, bar por pessoa, patrocínios nos três estágios, custos com
// realizado > 0, realizado 0, realizado '' e centavos quebrados.
const eventoRico = () => ({
  id: 'ev-teste',
  nome: 'Evento de teste da reordenação',
  data: '2026-09-12',
  publicoEstimado: 800,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  descontoMedioPct: 12,
  descontoIngressosModo: 'numero',
  descontoIngressosValor: 300,
  barModo: 'porPessoa',
  barTicket: { pessimista: 90.5, realista: 110.35, otimista: 130 },
  barTaxaSistemaPct: 3.5,
  barCustoSistema: 1200.75,
  outrasReceitas: { bar: 40000, patrocinio: 0 },
  inicioVendas: '2026-07-15',
  lotes: [
    { id: 'l1', nome: 'Lote Promocional', valor: 70, quantidade: 250 },
    { id: 'l2', nome: 'Lote 1', valor: 90.33, quantidade: 350 },
    { id: 'l3', nome: 'Lote 2', valor: 110.9, quantidade: 400 },
    { id: 'l4', nome: 'Último Lote', valor: 145.5, quantidade: 120 },
    { id: 'porta', nome: 'Lote Porta', valor: 130, quantidade: 100, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesia', valor: 0, quantidade: 80 },
  ],
  patrocinios: [
    { id: 'p1', patrocinador: 'Mirante', valor: 15000, estagio: 'confirmado' },
    { id: 'p2', patrocinador: 'Coroado', valor: 8000.55, estagio: 'proposta' },
    { id: 'p3', patrocinador: 'Patrocinador A', valor: 4500.1, estagio: 'recebido' },
  ],
  categorias: [
    {
      id: 'atracoes',
      nome: 'Atrações',
      itens: [
        { id: 'c1', servico: 'DJ principal', estimado: 15000, realizado: 14000 },
        { id: 'c2', servico: 'DJs locais', estimado: 6000, realizado: 0 },
        { id: 'c3', servico: 'Backline', estimado: 2333.33, realizado: '' },
      ],
    },
    {
      id: 'estrutura',
      nome: 'Estrutura',
      itens: [
        { id: 'c4', servico: 'Som e luz', estimado: 18000.75, realizado: '' },
        { id: 'c5', servico: 'Palco', estimado: 12000 },
        { id: 'c6', servico: 'Gerador', estimado: 4100.1, realizado: 4099.99 },
        { id: 'c7', servico: 'Banheiros', estimado: 3200.07 },
      ],
    },
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { id: 'c8', servico: 'Insumos do bar', estimado: 25000 },
        { id: 'c9', servico: 'Gelo', estimado: 3000, realizado: 3218.43 },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10, ticketPct: -5 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: { l3: 371 }, otimista: {} },
  },
  // O assunto deste arquivo é "a ORDEM das linhas não muda número nenhum", e
  // ele prova isso levando o evento por exportar→importar. Desde 27/07/2026 o
  // import também SOBE o pessimista de 70 para 80 (decisão A do Marco), o que
  // faria o round-trip devolver números diferentes por um motivo que não é a
  // ordem. A marca `padraoPessimista80` é o que o app grava num evento cujo
  // dono escolheu 70 depois da subida — com ela, o round-trip volta a medir só
  // a ordem.
  padraoPessimista80: { de: null },
})

// ————— o SEGUNDO fixture: o evento que EXPUNHA o resíduo, até 25/07/2026 —————
//
// Existe para o arquivo parar de provar propriedade de um evento só. Os quatro
// lotes vieram de uma busca por valores em que a soma caía em cima de um
// empate de arredondamento: aqui trocar dois lotes VIZINHOS mudava a receita
// bruta em 2,9 × 10⁻¹¹ — e, por azar do empate, mudava também o último dígito
// EXIBIDO. É o mesmo evento do achado [H] em ordenarHonestidade.test.js.
//
// O Marco aprovou quantizar a centavos antes de somar em 25/07/2026 (achado
// do BACKLOG "a soma de ponto flutuante não é associativa") — este fixture
// passou a dar desvio ZERO na troca de lotes, exatamente como o comentário
// abaixo já previa que aconteceria: nenhum teste deste arquivo exigia que o
// desvio existisse, EXCETO um (corrigido no mesmo commit desta mudança — ver
// o describe "a igualdade EXATA…" no fim do arquivo).
const eventoDoEmpate = () => ({
  id: 'ev-empate',
  nome: 'Evento do empate de arredondamento',
  data: '2026-09-12',
  publicoEstimado: 1059,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  descontoMedioPct: 7,
  outrasReceitas: { bar: 18000, patrocinio: 0 },
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 142.51, quantidade: 431 },
    { id: 'l2', nome: 'Lote 2', valor: 151.43, quantidade: 59 },
    { id: 'l3', nome: 'Lote 3', valor: 179.28, quantidade: 391 },
    { id: 'l4', nome: 'Lote 4', valor: 165.78, quantidade: 178 },
  ],
  patrocinios: [
    { id: 'p1', patrocinador: 'Marca A', valor: 12500.55, estagio: 'confirmado' },
    { id: 'p2', patrocinador: 'Marca B', valor: 7333.33, estagio: 'proposta' },
  ],
  categorias: [
    {
      id: 'atracoes',
      nome: 'Atrações',
      itens: [
        { id: 'a1', servico: 'DJ 1', estimado: 18333.33 },
        { id: 'a2', servico: 'DJ 2', estimado: 9666.67 },
        { id: 'a3', servico: 'Banda', estimado: 24000.01 },
      ],
    },
    {
      id: 'estrutura',
      nome: 'Estrutura',
      itens: [
        { id: 'e1', servico: 'Som', estimado: 15111.11 },
        { id: 'e2', servico: 'Luz', estimado: 8888.89 },
        { id: 'e3', servico: 'Palco', estimado: 30000.33 },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
  },
  // O assunto deste arquivo é "a ORDEM das linhas não muda número nenhum", e
  // ele prova isso levando o evento por exportar→importar. Desde 27/07/2026 o
  // import também SOBE o pessimista de 70 para 80 (decisão A do Marco), o que
  // faria o round-trip devolver números diferentes por um motivo que não é a
  // ordem. A marca `padraoPessimista80` é o que o app grava num evento cujo
  // dono escolheu 70 depois da subida — com ela, o round-trip volta a medir só
  // a ordem.
  padraoPessimista80: { de: null },
})

/**
 * O LIMIAR DA CASA, repetido aqui de propósito com o nome inteiro: é o mesmo
 * `LIMIAR_ZERO` de confrontoCustos.js. Toda comparação deste arquivo passa por
 * ele. Desvio abaixo = ruído de IEEE 754 (nenhuma conta leu a posição da
 * linha). Desvio ACIMA = alguma conta passou a ler a posição, e isso é S1:
 * pare e mostre ao Marco. Não afrouxe este número.
 */
const MEIO_CENTAVO = 0.005

/**
 * Compara dois cenários campo a campo. Números pela régua de meio centavo;
 * qualquer outra coisa (string, boolean, null) por igualdade estrita — se um
 * campo não-numérico mudar de valor com a ordem, isso não é arredondamento
 * nenhum. Devolve o maior desvio numérico visto, para os testes poderem
 * também DOCUMENTAR quanto foi.
 */
const compararCenario = (depois, antes) => {
  expect(Object.keys(depois).sort()).toEqual(Object.keys(antes).sort())
  let maior = 0
  for (const campo of Object.keys(antes)) {
    if (typeof antes[campo] !== 'number' || typeof depois[campo] !== 'number') {
      expect({ campo, v: depois[campo] }).toEqual({ campo, v: antes[campo] })
      continue
    }
    const d = Math.abs(depois[campo] - antes[campo])
    expect({ campo, dentroDoLimiar: d < MEIO_CENTAVO }).toEqual({ campo, dentroDoLimiar: true })
    maior = Math.max(maior, d)
  }
  return maior
}

// ————— as permutações que serão testadas —————
// Cada uma devolve um evento novo; nenhuma toca em valor nenhum.

const permutacoesDeLotes = [
  ['inverter a ordem inteira dos lotes', (e) => ({ ...e, lotes: [...e.lotes].reverse() })],
  ['subir o último lote uma posição', (e) => ({ ...e, lotes: moverPorId(e.lotes, 'cort', 'cima') })],
  ['descer o primeiro lote uma posição', (e) => ({ ...e, lotes: moverPorId(e.lotes, 'l1', 'baixo') })],
  ['mandar a cortesia para o topo', (e) => ({ ...e, lotes: moverItem(e.lotes, 5, 0) })],
  ['mandar o lote só-otimista para o topo', (e) => ({ ...e, lotes: moverItem(e.lotes, 4, 0) })],
  [
    'quatro movimentos seguidos',
    (e) => {
      let l = e.lotes
      l = moverPorId(l, 'l3', 'cima')
      l = moverPorId(l, 'porta', 'cima')
      l = moverPorId(l, 'l1', 'baixo')
      l = moverPorId(l, 'cort', 'cima')
      return { ...e, lotes: l }
    },
  ],
]

const permutacoesDeCustos = [
  [
    'inverter os itens de todas as categorias',
    (e) => ({
      ...e,
      categorias: e.categorias.map((c) => ({ ...c, itens: [...c.itens].reverse() })),
    }),
  ],
  [
    'subir um item dentro de Estrutura',
    (e) => ({
      ...e,
      categorias: e.categorias.map((c) =>
        c.id === 'estrutura' ? { ...c, itens: moverPorId(c.itens, 'c7', 'cima') } : c
      ),
    }),
  ],
  [
    'mandar o item com realizado para o fim de Atrações',
    (e) => ({
      ...e,
      categorias: e.categorias.map((c) =>
        c.id === 'atracoes' ? { ...c, itens: moverItem(c.itens, 0, 2) } : c
      ),
    }),
  ],
]

const permutacoesDePatrocinios = [
  ['inverter os patrocínios', (e) => ({ ...e, patrocinios: [...e.patrocinios].reverse() })],
  [
    'subir a proposta acima do confirmado',
    (e) => ({ ...e, patrocinios: moverPorId(e.patrocinios, 'p2', 'cima') }),
  ],
  [
    'mandar o recebido para o topo',
    (e) => ({ ...e, patrocinios: moverItem(e.patrocinios, 2, 0) }),
  ],
]

// Todos os campos numéricos de um cenário, MENOS `porLote` — que é a única
// coisa legitimamente definida PELA ordem (tratada no describe seguinte).
const semPorLote = (s) => {
  const { porLote, ...resto } = s
  return resto
}

// A lista por lote comparada como CONJUNTO (chaveada por id): mesmo lote,
// mesma quantidade, mesma receita — independentemente de onde ele está.
const porLotePorId = (s) =>
  Object.fromEntries(
    s.porLote.map((l) => [l.id, { nome: l.nome, valor: l.valor, qtd: l.qtd, receita: l.receita }])
  )

const todasAsPermutacoes = [
  ...permutacoesDeLotes,
  ...permutacoesDeCustos,
  ...permutacoesDePatrocinios,
]

describe('permutar linhas NÃO muda número nenhum', () => {
  const antes = computeCenarios(eventoRico())

  it.each(todasAsPermutacoes)('%s — nenhum campo de computeCenarios sai do limiar', (_n, permutar) => {
    const depois = computeCenarios(permutar(eventoRico()))
    for (const k of CENARIOS) {
      // receita, taxa, cashback, líquida, ticket, bar, patrocínio, custos por
      // categoria, contingência, custo total, lucro, margem, break-even,
      // custo/pessoa — todos pela régua de meio centavo (ver o cabeçalho:
      // exigir igualdade byte a byte aqui provaria o fixture, não o código).
      compararCenario(semPorLote(depois[k]), semPorLote(antes[k]))
    }
  })

  it.each(todasAsPermutacoes)('%s — cada lote mantém sua quantidade e sua receita', (_n, permutar) => {
    const depois = computeCenarios(permutar(eventoRico()))
    for (const k of CENARIOS) {
      expect(porLotePorId(depois[k])).toEqual(porLotePorId(antes[k]))
    }
  })

  it.each(permutacoesDeCustos)('%s — os totais de custo não se mexem', (_n, permutar) => {
    const a = custosPorCategoria(eventoRico().categorias)
    const d = custosPorCategoria(permutar(eventoRico()).categorias)
    expect(d).toEqual(a)
  })

  // ————— TODA transposição adjacente: o que a seta REALMENTE faz —————
  //
  // Um clique de seta troca duas linhas VIZINHAS. Este é o caso exaustivo do
  // gesto, agora rodado nos DOIS fixtures. A régua é meio centavo, e não
  // igualdade byte a byte: no `eventoDoEmpate` a troca de vizinhos dá desvio
  // não-zero de verdade, e um teste que cravasse exatidão simplesmente
  // esconderia esse evento do arquivo.
  const fixtures = [
    ['evento rico', eventoRico],
    ['evento do empate de arredondamento', eventoDoEmpate],
  ]

  it.each(fixtures)('%s — toda troca de vizinhos nos lotes fica dentro do limiar', (_n, fx) => {
    const base = computeCenarios(fx())
    for (let i = 0; i < fx().lotes.length - 1; i++) {
      const e = fx()
      const r = computeCenarios({ ...e, lotes: moverItem(e.lotes, i, i + 1) })
      for (const k of CENARIOS) compararCenario(semPorLote(r[k]), semPorLote(base[k]))
    }
  })

  it.each(fixtures)('%s — toda troca de vizinhos nos itens de custo fica dentro do limiar', (_n, fx) => {
    const base = computeCenarios(fx())
    const e0 = fx()
    for (let c = 0; c < e0.categorias.length; c++) {
      for (let i = 0; i < e0.categorias[c].itens.length - 1; i++) {
        const e = fx()
        const r = computeCenarios({
          ...e,
          categorias: e.categorias.map((cat, idx) =>
            idx === c ? { ...cat, itens: moverItem(cat.itens, i, i + 1) } : cat
          ),
        })
        for (const k of CENARIOS) compararCenario(semPorLote(r[k]), semPorLote(base[k]))
      }
    }
  })

  it.each(fixtures)('%s — toda troca de vizinhos nos patrocínios fica dentro do limiar', (_n, fx) => {
    const base = computeCenarios(fx())
    for (let i = 0; i < (fx().patrocinios || []).length - 1; i++) {
      const e = fx()
      const r = computeCenarios({ ...e, patrocinios: moverItem(e.patrocinios, i, i + 1) })
      for (const k of CENARIOS) compararCenario(semPorLote(r[k]), semPorLote(base[k]))
    }
  })

  // ————— o teste que registrava o achado — agora registra o conserto —————
  //
  // Até 25/07/2026 ele NÃO cobrava conserto: registrava que a igualdade exata
  // era acidente do fixture (`eventoDoEmpate` dava desvio > 0 na troca de
  // lotes vizinhos, e era isso que provava que não era coincidência do
  // código). Depois da quantização a centavos (Marco aprovou — ver
  // APROVADO-PELO-MARCO no commit), a soma da receita bruta virou associativa
  // e ESTE fixture, feito de propósito para expor o resíduo, também passou a
  // dar zero. A igualdade exata deixou de ser "acidente do fixture" e virou
  // garantia do código — é isso que a trava abaixo passa a exigir agora.
  it('a igualdade EXATA de reordenar LOTES é garantia do código desde 25/07/2026 (era acidente do fixture)', () => {
    const desvioMaximoNaTrocaDeVizinhos = (fx) => {
      const base = computeCenarios(fx())
      let maior = 0
      for (let i = 0; i < fx().lotes.length - 1; i++) {
        const e = fx()
        const r = computeCenarios({ ...e, lotes: moverItem(e.lotes, i, i + 1) })
        for (const k of CENARIOS) maior = Math.max(maior, compararCenario(semPorLote(r[k]), semPorLote(base[k])))
      }
      return maior
    }
    // no evento rico, já dava zero antes — e foi disso que a rodada 1 tirou a
    // conclusão errada de que "troca de vizinhos é sempre exata"
    expect(desvioMaximoNaTrocaDeVizinhos(eventoRico)).toBe(0)
    // até 25/07/2026 este dava desvio > 0 (medido: 2,9 × 10⁻¹¹). Quantizado a
    // centavos, a soma de inteiros é associativa — agora dá zero também.
    expect(desvioMaximoNaTrocaDeVizinhos(eventoDoEmpate)).toBe(0)
  })

  // ————— TODAS as 720 ordens possíveis dos 6 lotes —————
  //
  // ACHADO, registrado aqui de propósito (medido em 20/07/2026, este evento):
  // somar em ordem diferente NÃO é bit a bit idêntico em IEEE 754 — a adição
  // de ponto flutuante não é associativa. Nas 720 ordens, o maior desvio de
  // QUALQUER campo foi 2,9 × 10⁻¹¹ (receita total do otimista): três
  // centésimos de BILIONÉSIMO de real.
  //
  // ————— O QUE ESTE COMENTÁRIO DIZIA DE ERRADO (corrigido na rodada 2) —————
  //
  // Ele dizia que um desvio desses "não chega à tela, não chega ao PDF e não
  // chega ao WhatsApp: nenhum número exibido muda". ISSO É FALSO, e foi
  // refutado com medição — não com argumento.
  //
  // O formatador da casa arredonda para o real inteiro. Quando o total cai
  // EXATAMENTE em cima do empate (…,49999999997 de um lado, …,5 do outro), um
  // desvio de meio bilionésimo de real vira UM REAL no número exibido, e a
  // coluna do DRE deixa de fechar aos olhos de quem soma com o dedo na
  // reunião. Está medido em ordenarHonestidade.test.js, achado [H]: um clique
  // de seta leva "Receita bruta bilheteria" de R$ 169.963 para R$ 169.964.
  //
  // Então NÃO despreze desvio pequeno por reflexo. A régua de meio centavo
  // vale para responder à pergunta DESTE arquivo — "alguma conta lê a posição
  // da linha?" — e só. A outra pergunta, "o número exibido pode oscilar?", tem
  // resposta SIM, a raiz mora em calc.js (portão do Marco, princípios 1 e 8) e
  // está no BACKLOG.md esperando decisão dele. Não conserte por conta própria.
  //
  // Se algum dia este teste acusar desvio ACIMA de meio centavo, isso NÃO é
  // ruído de ponto flutuante — é uma conta lendo a posição da linha, e aí é
  // S1: pare e mostre ao Marco.
  it('as 720 ordens possíveis dos lotes não movem nenhum número nem meio centavo', () => {
    const base = computeCenarios(eventoRico())
    const permutacoes = (a) =>
      a.length <= 1
        ? [a]
        : a.flatMap((x, i) =>
            permutacoes([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])
          )
    let maiorDesvio = 0
    const todas = permutacoes(eventoRico().lotes)
    expect(todas).toHaveLength(720)
    for (const lotes of todas) {
      const r = computeCenarios({ ...eventoRico(), lotes })
      for (const k of CENARIOS) {
        const a = semPorLote(base[k])
        const d = semPorLote(r[k])
        expect(Object.keys(d).sort()).toEqual(Object.keys(a).sort())
        for (const campo of Object.keys(a)) {
          if (typeof a[campo] !== 'number') {
            expect(d[campo]).toEqual(a[campo])
            continue
          }
          maiorDesvio = Math.max(maiorDesvio, Math.abs(a[campo] - d[campo]))
        }
      }
    }
    expect(maiorDesvio).toBeLessThan(MEIO_CENTAVO)
    // e, de fato, é ordens de grandeza menor que isso — o ruído do IEEE 754
    expect(maiorDesvio).toBeLessThan(1e-6)
  })

  it('permutar os itens de custo não muda o custo total (100 embaralhadas)', () => {
    const base = computeCenario(eventoRico(), 'realista').custoTotal
    const embaralhar = (l, semente) => {
      const a = l.slice()
      let s = semente
      for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) % 2147483648
        const j = s % (i + 1)
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    for (let semente = 1; semente <= 100; semente++) {
      const e = eventoRico()
      const r = computeCenario(
        {
          ...e,
          categorias: e.categorias.map((c, idx) => ({
            ...c,
            itens: embaralhar(c.itens, semente + idx),
          })),
        },
        'realista'
      )
      // mesmo limiar de "é outro número" do resto do app (meio centavo)
      expect(Math.abs(r.custoTotal - base)).toBeLessThan(0.005)
    }
  })
})

describe('o que muda por definição: a Acumulada e a curva seguem a ordem exibida', () => {
  // A mesma conta que a tela dos lotes faz (RevenueTab): soma corrida na
  // ordem em que as linhas aparecem, com os "só otimista" fora.
  const acumuladaDaTela = (evento) => {
    let acc = 0
    return evento.lotes.map((l) => {
      const fora = !!l.somenteOtimista
      const receita = fora ? 0 : Number(l.valor) * Number(l.quantidade)
      acc += receita
      return { id: l.id, receita, acumulada: acc, fora }
    })
  }

  it('a acumulada é a soma corrida da NOVA ordem, linha a linha', () => {
    const e = { ...eventoRico(), lotes: moverPorId(eventoRico().lotes, 'l4', 'cima') }
    const linhas = acumuladaDaTela(e)
    let esperado = 0
    for (const linha of linhas) {
      esperado += linha.receita
      expect(linha.acumulada).toBe(esperado)
    }
  })

  it('a acumulada da última linha (o total) é a MESMA em qualquer ordem', () => {
    const original = acumuladaDaTela(eventoRico())
    const total = original[original.length - 1].acumulada
    for (const [, permutar] of permutacoesDeLotes) {
      const linhas = acumuladaDaTela(permutar(eventoRico()))
      expect(linhas[linhas.length - 1].acumulada).toBe(total)
    }
  })

  it('a acumulada do lote que mudou de lugar muda — é isso que a coluna significa', () => {
    const antes = acumuladaDaTela(eventoRico())
    const depois = acumuladaDaTela({
      ...eventoRico(),
      lotes: moverItem(eventoRico().lotes, 3, 0),
    })
    const acumDe = (linhas, id) => linhas.find((l) => l.id === id).acumulada
    // 'l4' era a 4ª linha; no topo, sua acumulada passa a ser a própria receita
    expect(acumDe(antes, 'l4')).not.toBe(acumDe(depois, 'l4'))
    expect(acumDe(depois, 'l4')).toBe(depois[0].receita)
  })

  it('o plano da curva usa a nova ordem e fecha no MESMO total', () => {
    const e = eventoRico()
    const permutado = { ...e, lotes: [...e.lotes].reverse() }
    const planoA = lotesDoPlano(e)
    const planoB = lotesDoPlano(permutado)
    // mesmo conjunto de lotes, mesmo total; ordem diferente
    expect(planoB.map((l) => l.id)).toEqual([...planoA.map((l) => l.id)].reverse())
    expect(planoB[planoB.length - 1].acumulada).toBe(planoA[planoA.length - 1].acumulada)
    expect(totalPlanoLotes(permutado)).toBe(totalPlanoLotes(e))
    // e a acumulada do plano continua sendo soma corrida da ordem nova
    let acc = 0
    for (const l of planoB) {
      acc += l.receita
      expect(l.acumulada).toBe(acc)
    }
  })

  it('a curva desenhada com a ordem nova continua terminando em 100% do plano', () => {
    const media = [
      { u: -60, frac: 0 },
      { u: -30, frac: 0.4 },
      { u: 0, frac: 1 },
    ]
    const e = eventoRico()
    const curvaA = curvaPlanoForma(e, media)
    const curvaB = curvaPlanoForma({ ...e, lotes: [...e.lotes].reverse() }, media)
    const fim = (c) => (Array.isArray(c) && c.length ? c[c.length - 1] : null)
    expect(fim(curvaB)).toEqual(fim(curvaA))
  })
})

describe('round-trip: a ordem sobrevive ao backup JSON', () => {
  const storeVazio = () => ({ versao: 1, eventos: [], benchmarksCustom: [] })
  const storeCom = (evento) => ({ ...storeVazio(), eventos: [evento] })
  // export → arquivo → import, o caminho de verdade (montarBackup é o que o
  // "Exportar backup" grava; parseBackup + mesclarBackup é o que o importador
  // faz, migração de eventos incluída).
  const roundTrip = (evento) => {
    const texto = JSON.stringify(montarBackup(storeCom(evento)), null, 2)
    const backup = parseBackup(texto)
    const store = mesclarBackup(storeVazio(), backup)
    return store.eventos.find((x) => x.id === evento.id)
  }

  it('reordenar → exportar → importar devolve a ordem nova', () => {
    const e = eventoRico()
    const reordenado = {
      ...e,
      lotes: moverPorId(moverPorId(e.lotes, 'cort', 'cima'), 'l1', 'baixo'),
      patrocinios: [...e.patrocinios].reverse(),
      categorias: e.categorias.map((c) => ({ ...c, itens: [...c.itens].reverse() })),
    }
    const ordemLotes = reordenado.lotes.map((l) => l.id)
    const ordemPatrocinios = reordenado.patrocinios.map((p) => p.id)
    const ordemItens = reordenado.categorias.map((c) => c.itens.map((i) => i.id))

    const voltou = roundTrip(reordenado)
    expect(voltou.lotes.map((l) => l.id)).toEqual(ordemLotes)
    expect(voltou.patrocinios.map((p) => p.id)).toEqual(ordemPatrocinios)
    expect(voltou.categorias.map((c) => c.itens.map((i) => i.id))).toEqual(ordemItens)
  })

  it('e os números do evento reimportado são os mesmos do original', () => {
    const e = eventoRico()
    const voltou = roundTrip({ ...e, lotes: [...e.lotes].reverse() })
    const a = computeCenarios(e)
    const d = computeCenarios(voltou)
    for (const k of CENARIOS) {
      expect(semPorLote(d[k])).toEqual(semPorLote(a[k]))
    }
  })
})
