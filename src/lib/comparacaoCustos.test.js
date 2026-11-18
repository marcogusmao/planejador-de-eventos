import { describe, it, expect } from 'vitest'
import { computeCenarios } from './calc.js'
import { CAT_KEYS } from './benchmarks.js'
import { colunaCustoPrevisao, somaColunaExibida, maiorDesvioDaColuna } from './comparacaoCustos.js'
import { ajusteCustoValor, ajusteCustoTexto } from './dre.js'

// ── itPesado: as varreduras que NÃO rodam no portão de cada push ────────────
//
// Este arquivo tem três varreduras de propriedade — 13 mil, 20 mil e 100 mil
// eventos. Elas são o que prova, de verdade, que a coluna fecha em QUALQUER
// combinação de centavos. Também são 21 dos 43 segundos da suíte inteira nesta
// máquina, e laços SÍNCRONOS: enquanto rodam, o event loop do worker fica travado.
//
// Medido em 01/08/2026, na esteira: com elas no portão de cada push, o worker do
// vitest perde o heartbeat de RPC e a run morre com
// "[vitest-worker]: Timeout calling onTaskUpdate" — COM os 2518 testes passando.
// A main ficou vermelha assim por quatro dias sem ninguém ver.
//
// A saída não foi enfraquecer a prova nem aumentar timeout: foi tirá-la do
// caminho crítico. Na SUA máquina elas rodam sempre (é onde você olha).
// Na esteira elas rodam no .github/workflows/varredura-pesada.yml, todo dia às
// 4h e sob demanda, com VARREDURA_PESADA=1. Se quebrarem, você recebe a falha
// do agendado — o que não acontece mais é uma varredura de um minuto derrubar
// o portão de um commit de uma linha.
const PULAR_PESADO = Boolean(process.env.CI && !process.env.VARREDURA_PESADA)

// ── CEDER O EVENT LOOP: por que estas três varreduras são `async` ───────────
//
// Medido em 30/08/2026, na esteira: a varredura pesada saiu VERMELHA em 13 das
// últimas 15 noites — e NÃO era o motor. No run de 29/08 os 26 testes PASSARAM
// e o trabalho ainda assim saiu com código 1, por
//     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
// O laço de 100 mil eventos leva 72,6 s no runner do GitHub. Enquanto ele roda,
// o event loop do worker do vitest fica travado: o worker não responde ao
// heartbeat de RPC, e a rodada morre COM a prova tendo passado.
//
// O conserto não encolhe a prova nem afrouxa asserção nenhuma: são as MESMAS
// iterações e as MESMAS asserções. O que muda é que, a cada CEDER_A_CADA
// eventos, o laço devolve a vez ao event loop por um `setImmediate` — tempo
// suficiente para o worker responder ao heartbeat e continuar de onde parou.
//
// 2.000 eventos ≈ 1,5 s no runner (o pior caso é o laço de 100 mil), contra o
// tempo de RPC de 60 s do vitest: 40× de folga. O custo é ~50 `setImmediate`
// numa varredura de 72 s — ruído.
//
// Se um dia isto não bastar, os dois planos seguintes estão escritos no
// cabeçalho de .github/workflows/varredura-pesada.yml (`--pool=forks`, que
// NUNCA foi investigado até o fim, e `--reporter=dot`).
const CEDER_A_CADA = 2000
const cederAVez = () => new Promise((prosseguir) => setImmediate(prosseguir))

// Nota de implementação, e ela importa: o pulo acontece DENTRO do teste, com
// `ctx.skip()`, e não trocando `it` por um alias. Motivo medido em 01/08/2026:
// scripts/gerar-indice-testes.mjs conta ocorrências literais de `it(`, e o
// ci.yml recusa o commit quando EVIDENCIA-TESTES.md não bate. Com um alias, as
// três varreduras SUMIAM do índice — justamente as provas mais fortes deste
// arquivo desapareciam do documento que existe para registrá-las. O índice
// continua contando 26; o relatório do vitest é que mostra 3 pulados.

/**
 * A promessa que estes testes guardam: na tabela "Comparação com eventos
 * passados", a soma das linhas VISÍVEIS da coluna da previsão é exatamente o
 * "Custo total" impresso no pé — em qualquer combinação de centavos.
 *
 * A conta dos testes é a mesma que o Marco faz com o dedo na reunião
 * (`somaColunaExibida`): só as linhas que a tela mostra, com os inteiros que ela
 * mostra. Nada de comparar com o valor "de verdade" em ponto flutuante — o que
 * precisa fechar é o que está na TELA.
 */

// Monta um evento com os custos pedidos por categoria. `custos` é um mapa
// id → lista de valores estimados (um por item), então o teste controla o
// centavo de cada item, que é onde o problema nasce.
const eventoCom = (custos, { contingenciaPct = 3.5, custoPct = 0 } = {}) => ({
  taxaBilheteria: 10,
  cashbackPct: 0,
  contingenciaPct,
  outrasReceitas: { bar: 0, patrocinio: 0 },
  lotes: [{ id: 'l1', nome: 'Lote 1', valor: 120, quantidade: 500 }],
  categorias: Object.entries(custos).map(([id, valores]) => ({
    id,
    nome: id,
    itens: valores.map((v, i) => ({ id: `${id}-${i}`, estimado: v })),
  })),
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 100, custoPct },
    otimista: { custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

const colunaDe = (evento) => {
  const c = computeCenarios(evento)
  const porCategoria = (k) => c.realista.custosCategorias.find((x) => x.id === k)?.considerado || 0
  return { col: colunaCustoPrevisao(c.realista, porCategoria), realista: c.realista }
}

// A dupla garantia que o Marco pediu, checada junta em todo caso.
const esperaColunaHonesta = (col) => {
  expect(somaColunaExibida(col)).toBe(col.total)
  for (const cat of col.categorias) {
    expect(Math.abs(cat.exibido - cat.valor)).toBeLessThanOrEqual(1)
  }
  expect(Math.abs(col.outras.exibido - col.outras.valor)).toBeLessThanOrEqual(1)
  expect(Math.abs(col.contingencia.exibido - col.contingencia.valor)).toBeLessThanOrEqual(1)
  expect(Math.abs(col.ajuste.exibido - col.ajuste.valor)).toBeLessThanOrEqual(1)
}

describe('coluna da previsão fecha no custo total exibido', () => {
  it('fecha com valores redondos (o caso fácil, que já fechava)', () => {
    const { col } = colunaDe(eventoCom({ aeb: [10000], equipe: [8000], artistico: [20000] }))
    expect(somaColunaExibida(col)).toBe(col.total)
    esperaColunaHonesta(col)
  })

  it('fecha com centavos em todas as categorias', () => {
    const { col } = colunaDe(
      eventoCom({
        aeb: [16420.37, 2210.49],
        locacao: [5500.91],
        estrutura: [41250.13],
        equipe: [6180.78],
        artistico: [15300.55],
        marketing: [3210.44],
        extras: [1500.29],
      })
    )
    esperaColunaHonesta(col)
  })

  it('fecha com o pior caso do arredondamento: tudo terminando em ,50', () => {
    // Sete categorias a ,50 + contingência e ajuste: é a combinação em que o
    // arredondamento simples erra o máximo possível para o mesmo lado.
    const { col } = colunaDe(
      eventoCom({
        aeb: [10000.5],
        locacao: [2000.5],
        estrutura: [30000.5],
        equipe: [4000.5],
        artistico: [15000.5],
        marketing: [1000.5],
        extras: [500.5],
      })
    )
    esperaColunaHonesta(col)
  })

  it('fecha com rateio de terços (,66 / ,67) — o caso do custo dividido em 3', () => {
    const { col } = colunaDe(
      eventoCom({
        aeb: [3333.33, 3333.33, 3333.34],
        estrutura: [10000.66, 10000.67],
        equipe: [2500.66],
        artistico: [7777.67],
      })
    )
    esperaColunaHonesta(col)
  })

  it('fecha com categoria criada pelo Marco (fora das 7 do histórico)', () => {
    const { col } = colunaDe(
      eventoCom({
        aeb: [12000.4],
        estrutura: [30000.6],
        'cat-nova-do-marco': [4200.55, 1300.45],
      })
    )
    // A categoria nova não tem linha própria: entra em "Outras categorias".
    expect(col.outras.mostrar).toBe(true)
    expect(Math.abs(col.outras.valor - 5501)).toBeLessThan(0.01)
    esperaColunaHonesta(col)
  })

  it('fecha com ajuste de cenário POSITIVO', () => {
    const { col, realista } = colunaDe(
      eventoCom(
        { aeb: [16420.37], estrutura: [41250.13], equipe: [6180.78], artistico: [15300.55] },
        { custoPct: 8 }
      )
    )
    expect(realista.ajustePct).toBe(8)
    expect(col.ajuste.exibido).toBeGreaterThan(0)
    esperaColunaHonesta(col)
  })

  it('fecha com ajuste de cenário NEGATIVO', () => {
    const { col, realista } = colunaDe(
      eventoCom(
        { aeb: [16420.37], estrutura: [41250.13], equipe: [6180.78], artistico: [15300.55] },
        { custoPct: -7 }
      )
    )
    expect(realista.ajustePct).toBe(-7)
    expect(col.ajuste.exibido).toBeLessThan(0)
    esperaColunaHonesta(col)
  })

  it('fecha sem contingência e sem ajuste (evento cru)', () => {
    const { col } = colunaDe(
      eventoCom({ aeb: [10000.5], equipe: [8000.5] }, { contingenciaPct: 0, custoPct: 0 })
    )
    expect(col.contingencia.exibido).toBe(0)
    expect(col.ajuste.mostrar).toBe(false)
    esperaColunaHonesta(col)
  })

  it('não inventa linha "Outras categorias" em evento que não tem outras', () => {
    // Absorver o resíduo numa rubrica inexistente seria criar dinheiro com nome
    // falso: aqui o absorvedor é a maior categoria.
    const { col } = colunaDe(
      eventoCom({
        aeb: [10000.5],
        locacao: [2000.5],
        estrutura: [30000.5],
        equipe: [4000.5],
        artistico: [15000.5],
        marketing: [1000.5],
        extras: [500.5],
      })
    )
    expect(col.outras.mostrar).toBe(false)
    expect(col.outras.exibido).toBe(0)
    esperaColunaHonesta(col)
  })

  it('linha escondida contribui zero — esconder nunca desequilibra a coluna', () => {
    const { col } = colunaDe(eventoCom({ aeb: [10000], equipe: [8000] }))
    if (!col.outras.mostrar) expect(col.outras.exibido).toBe(0)
    if (!col.ajuste.mostrar) expect(col.ajuste.exibido).toBe(0)
    esperaColunaHonesta(col)
  })

  it('contingência e ajuste exibem o MESMO inteiro que o DRE do mesmo relatório', () => {
    // As duas linhas são impressas nas duas tabelas da mesma peça; divergir em
    // R$ 1 entre elas seria trocar um problema por outro.
    const { col, realista } = colunaDe(
      eventoCom(
        { aeb: [16420.37], estrutura: [41250.13], equipe: [6180.78], artistico: [15300.55] },
        { custoPct: 6 }
      )
    )
    expect(col.contingencia.exibido).toBe(Math.round(realista.contingencia))
    expect(col.ajuste.exibido).toBe(
      Math.round(realista.custoTotal - realista.custoItens - realista.contingencia)
    )
  })
})

describe('fuzzing: a coluna fecha em qualquer combinação de centavos', () => {
  // Gerador determinístico (semente fixa) — o teste tem que falhar sempre no
  // mesmo caso, não "às vezes".
  const rng = (semente) => () => {
    semente = (semente * 1664525 + 1013904223) % 4294967296
    return semente / 4294967296
  }

  it('2000 eventos aleatórios: soma das linhas === total exibido, e nenhuma linha erra mais de R$ 1', () => {
    const r = rng(20260719)
    let comOutras = 0
    let comAjusteNegativo = 0

    for (let n = 0; n < 2000; n++) {
      const custos = {}
      for (const k of CAT_KEYS) {
        if (r() < 0.25) continue // categoria ausente também é caso real
        const itens = 1 + Math.floor(r() * 3)
        custos[k] = Array.from(
          { length: itens },
          () => Math.round(r() * 5000000) / 100 // 0 a 50.000 com centavo qualquer
        )
      }
      if (r() < 0.35) {
        custos['cat-do-marco'] = [Math.round(r() * 800000) / 100]
        comOutras++
      }
      // sem nenhuma categoria a conta é trivial; garante ao menos uma
      if (Object.keys(custos).length === 0) custos.aeb = [1234.56]

      const custoPct = Math.round((r() * 30 - 15) * 10) / 10 // −15% a +15%
      if (custoPct < 0) comAjusteNegativo++
      const contingenciaPct = Math.round(r() * 150) / 10 // 0% a 15%

      const { col } = colunaDe(eventoCom(custos, { contingenciaPct, custoPct }))

      expect(somaColunaExibida(col)).toBe(col.total)
      for (const cat of col.categorias) {
        expect(Math.abs(cat.exibido - cat.valor)).toBeLessThanOrEqual(1)
      }
      expect(Math.abs(col.outras.exibido - col.outras.valor)).toBeLessThanOrEqual(1)
      expect(Math.abs(col.contingencia.exibido - col.contingencia.valor)).toBeLessThanOrEqual(1)
      expect(Math.abs(col.ajuste.exibido - col.ajuste.valor)).toBeLessThanOrEqual(1)
    }

    // O fuzzing só vale se tiver passado pelos casos que interessam.
    expect(comOutras).toBeGreaterThan(300)
    expect(comAjusteNegativo).toBeGreaterThan(300)
  })
})

/**
 * Os dois achados da verificação adversarial de 19/07/2026, com os repro exatos
 * que o revisor produziu. Os três repro A/B/C vinham de uma varredura de 800 mil
 * eventos: a coluna SEMPRE fechava (a propriedade principal nunca falhou), mas
 * duas promessas do módulo eram falsas.
 */

const catDe = (col, id) => col.categorias.find((c) => c.id === id)

// Linhas VISÍVEIS cujo valor real é zero: rubrica que a tela inventa.
const linhasFantasma = (col) =>
  [...col.categorias, ...(col.outras.mostrar ? [col.outras] : [])].filter(
    (l) => Math.abs(l.valor) < 0.005 && l.exibido !== 0
  )

describe('achado 1 — resíduo de ponto flutuante não vira linha na tela', () => {
  it('evento sem outras categorias: "Outras categorias" não aparece com R$ −1', () => {
    // `outrasValor` sai de uma subtração e, aqui, dava −3,3e−16. O `Math.floor`
    // transformava isso em −1 e a tela mostrava a linha "Outras categorias —
    // R$ -1", uma rubrica negativa que não existe em lugar nenhum do evento.
    const { col, realista } = colunaDe(
      eventoCom(
        { aeb: [33602.98], marketing: [59867.9], artistico: [20222.98] },
        { contingenciaPct: 8.51, custoPct: 11.38 }
      )
    )
    const outrasCru = realista.custoItens - CAT_KEYS.reduce(
      (s, k) => s + (realista.custosCategorias.find((x) => x.id === k)?.considerado || 0),
      0
    )
    // O resíduo bruto é negativo e minúsculo: é ele que virava −1.
    expect(outrasCru).toBeLessThan(0)
    expect(Math.abs(outrasCru)).toBeLessThan(1e-6)

    expect(col.outras.exibido).toBe(0)
    expect(col.outras.mostrar).toBe(false)
    expect(Object.is(col.outras.exibido, -0)).toBe(false)
    expect(linhasFantasma(col)).toEqual([])
    expect(somaColunaExibida(col)).toBe(col.total)
  })

  it('categoria zerada nunca recebe R$ 1 só para a conta fechar', () => {
    const { col } = colunaDe(
      eventoCom({ aeb: [10000.5], estrutura: [30000.5] }, { contingenciaPct: 7.7, custoPct: 9.3 })
    )
    for (const cat of col.categorias) if (Math.abs(cat.valor) < 0.005) expect(cat.exibido).toBe(0)
    expect(linhasFantasma(col)).toEqual([])
  })
})

describe('achado 2 — o limite por linha é o DECLARADO, e a coluna segue fechando', () => {
  // O teto de R$ 1,00 do comentário antigo era falso. O limite real, provado no
  // comentário do módulo e cobrado aqui: R$ 1,00 no caso normal e, no caso raro
  // em que o resíduo não cabe na fila, abaixo de R$ 1,54 — nunca mais que isso.
  // (R$ 1,50 da prova do maior resto + até R$ 0,04 da quantização a centavos,
  // meio centavo em cada uma das 8 linhas de item.) O teste cobra o número
  // DECLARADO no módulo: se um dia o código ficar melhor que o comentário, é o
  // comentário que desce — promessa e prova andam juntas.
  const LIMITE = 1.54

  it('REPRO A — a linha em piso+3 (R$ 2,10) some: Marketing volta para perto da verdade', () => {
    const { col } = colunaDe(
      eventoCom(
        { aeb: [33602.98], marketing: [59867.9], artistico: [20222.98] },
        { contingenciaPct: 8.51, custoPct: 11.38 }
      )
    )
    // Antes: 59.870 contra 59.867,90 reais — piso+3, R$ 2,10 de distância.
    expect(catDe(col, 'marketing').exibido).toBe(59868)
    expect(Math.abs(catDe(col, 'marketing').exibido - 59867.9)).toBeLessThan(0.5)
    expect(maiorDesvioDaColuna(col)).toBeLessThan(LIMITE)
    expect(somaColunaExibida(col)).toBe(col.total)
  })

  it('REPRO B — o caso onde R$ 1,00 é PROVADAMENTE impossível, e o módulo não mente', () => {
    // A prova, com os números desta linha só: o DRE imprime custo total 10 (de
    // 10,4937), contingência 4 (de 3,5532) e ajuste −1 (de −1,4895). Esses três
    // são travados — são os mesmos inteiros da tabela do DRE, duas seções acima
    // no mesmo relatório. Sobra para as categorias 10 − 4 − (−1) = 7, e existe
    // UMA categoria só: ela TEM que imprimir 7 para a coluna fechar. Como o
    // valor real é 8,43, o desvio de R$ 1,43 não tem para onde ir. Qualquer
    // outro inteiro quebraria a soma que a tela promete.
    const { col, realista } = colunaDe(
      eventoCom({ aeb: [3.8, 2.14, 0.17, 2.32] }, { contingenciaPct: 42.15, custoPct: -12.43 })
    )
    expect(catDe(col, 'aeb').valor).toBeCloseTo(8.43, 10)
    expect(col.total).toBe(10)
    expect(col.contingencia.exibido).toBe(4)
    expect(col.ajuste.exibido).toBe(-1)
    // As três linhas travadas continuam iguais às do DRE — é essa trava que
    // torna o teto de R$ 1,00 impossível aqui, e ela é deliberada.
    expect(col.contingencia.exibido).toBe(Math.round(realista.contingencia))
    expect(col.total).toBe(Math.round(realista.custoTotal))

    expect(catDe(col, 'aeb').exibido).toBe(7)
    expect(maiorDesvioDaColuna(col)).toBeCloseTo(1.43, 10)
    expect(maiorDesvioDaColuna(col)).toBeLessThan(LIMITE)
    // A propriedade que não pode regredir vale mesmo no caso impossível.
    expect(somaColunaExibida(col)).toBe(col.total)
  })

  it('REPRO C — o desvio sai da linha errada e cai onde custa R$ 1,00 exato', () => {
    const { col } = colunaDe(
      eventoCom(
        { estrutura: [6907.01], marketing: [43349.3], extras: [7003.52, 2381.48] },
        { contingenciaPct: 3.2, custoPct: -8.8 }
      )
    )
    // Antes: Marketing imprimia 43.348 contra 43.349,30 — R$ 1,30. Agora a
    // unidade que falta sai da linha de MENOR fração (Extras, 9.385,00 exato),
    // onde piso−1 custa exatamente R$ 1,00.
    expect(catDe(col, 'marketing').exibido).toBe(43349)
    expect(catDe(col, 'extras').exibido).toBe(9384)
    expect(maiorDesvioDaColuna(col)).toBeCloseTo(1, 10)
    expect(somaColunaExibida(col)).toBe(col.total)
  })

  // TEMPO DECLARADO 120 s (Marco, 28/07/2026), e o de antes era }.
  // Medido: esta varredura leva 44 s sozinha e estourava QUANDO A SUÍTE INTEIRA
  // disputava CPU — passava isolada e falhava no conjunto, ora 1 ora 2 casos, e numa
  // das rodadas passou por sorte. Teste que falha por CARGA é pior que teste que
  // falha: o vermelho de amanhã seria lido como "flaky, roda de novo" em vez de ser
  // investigado.
  // A varredura NÃO foi encolhida: ela é a rede dos sobreviventes que a bateria de
  // mutação achou em 27/07/2026, e diminuir a amostra para caber no relógio seria
  // trocar cobertura por conveniência. O que muda é o tempo passar a ser declarado.
  it('varredura determinística: 13 mil eventos, 260+ deles no caso difícil, nenhum acima do limite', async (ctx) => {
    if (PULAR_PESADO) return ctx.skip()   // ver .github/workflows/varredura-pesada.yml
    // Varre a contingência de 0% a 50% de 0,03 em 0,03 sobre as quatro formas de
    // evento dos repro. É determinística de propósito: o caso difícil (resíduo
    // fora da faixa) tem que ser EXERCITADO, não sorteado.
    const formas = [
      { aeb: [8.43] },
      { aeb: [3.8, 2.14, 0.17, 2.32] },
      { estrutura: [6907.01], marketing: [43349.3], extras: [7003.52, 2381.48] },
      { aeb: [33602.98], marketing: [59867.9], artistico: [20222.98] },
    ]
    let eventos = 0
    let casosDificeis = 0
    let pior = 0

    for (let cp = 0; cp <= 5000; cp += 3) {
      for (const custos of formas) {
        for (const custoPct of [-12.43, 11.38]) {
          const { col } = colunaDe(eventoCom(custos, { contingenciaPct: cp / 100, custoPct }))
          eventos++
          // devolve a vez ao event loop — ver CEDER_A_CADA, no topo do arquivo
          if (eventos % CEDER_A_CADA === 0) await cederAVez()
          expect(somaColunaExibida(col)).toBe(col.total)
          expect(linhasFantasma(col)).toEqual([])
          const desvio = maiorDesvioDaColuna(col)
          expect(desvio).toBeLessThan(LIMITE)
          if (desvio > 1.0000001) casosDificeis++
          pior = Math.max(pior, desvio)
        }
      }
    }

    expect(eventos).toBeGreaterThan(13000)
    // A varredura só vale se tiver passado pelo caso que o achado 2 descreve.
    expect(casosDificeis).toBeGreaterThan(200)
    expect(pior).toBeLessThan(LIMITE)
  }, 120000)

  it('fuzzing com centavos hostis: coluna fecha, nada acima do limite, nenhuma linha fantasma', () => {
    const rng = (semente) => () => {
      semente = (semente * 1664525 + 1013904223) % 4294967296
      return semente / 4294967296
    }
    const r = rng(19072026)
    let pior = 0

    for (let n = 0; n < 6000; n++) {
      const custos = {}
      // Eventos minúsculos entram de propósito: é neles que R$ 1,50 de desvio
      // pesa mais em porcentagem, e é lá que o caso difícil aparece.
      const escala = n % 3 === 0 ? 100 : n % 3 === 1 ? 20000 : 5000000
      for (const k of CAT_KEYS) {
        if (r() < 0.35) continue
        const itens = 1 + Math.floor(r() * 4)
        custos[k] = Array.from({ length: itens }, () => Math.round(r() * escala) / 100)
      }
      if (r() < 0.3) custos['cat-do-marco'] = [Math.round(r() * escala) / 100]
      if (Object.keys(custos).length === 0) custos.aeb = [Math.round(r() * escala) / 100]

      const custoPct = Math.round((r() * 60 - 30) * 100) / 100
      const contingenciaPct = Math.round(r() * 5000) / 100

      const { col } = colunaDe(eventoCom(custos, { contingenciaPct, custoPct }))

      expect(somaColunaExibida(col)).toBe(col.total)
      expect(linhasFantasma(col)).toEqual([])
      const desvio = maiorDesvioDaColuna(col)
      expect(desvio).toBeLessThan(LIMITE)
      pior = Math.max(pior, desvio)
    }

    // Contingência e ajuste continuam travados no arredondamento do DRE, então
    // o desvio pode passar de R$ 1,00 — o que não pode é passar do declarado.
    expect(pior).toBeLessThan(LIMITE)
  })
})

describe('achado 3 — dinheiro tem duas casas: a quantização a centavos', () => {
  // A terceira rodada de verificação adversarial (19/07/2026) mostrou que a
  // causa-raiz das linhas fantasma e dos desvios grandes NÃO era o algoritmo de
  // distribuição: era valor SUB-CENTAVO entrando no módulo. Com dinheiro de
  // duas casas o revisor não achou UMA violação em 400 mil eventos. O conserto
  // foi quantizar na ENTRADA (`emCentavos`); estes testes guardam as duas
  // pontas — que o teto vale para dinheiro de verdade, e que os casos
  // sub-centavo do revisor morreram.
  const LIMITE = 1.54

  // TEMPO DECLARADO 120 s (Marco, 28/07/2026), e o de antes era 30000.
  // Medido: esta varredura leva 44 s sozinha e estourava QUANDO A SUÍTE INTEIRA
  // disputava CPU — passava isolada e falhava no conjunto, ora 1 ora 2 casos, e numa
  // das rodadas passou por sorte. Teste que falha por CARGA é pior que teste que
  // falha: o vermelho de amanhã seria lido como "flaky, roda de novo" em vez de ser
  // investigado.
  // A varredura NÃO foi encolhida: ela é a rede dos sobreviventes que a bateria de
  // mutação achou em 27/07/2026, e diminuir a amostra para caber no relógio seria
  // trocar cobertura por conveniência. O que muda é o tempo passar a ser declarado.
  it('PROPRIEDADE — 100 mil eventos com dinheiro de duas casas: teto respeitado, zero linha fantasma, coluna sempre fecha', async (ctx) => {
    if (PULAR_PESADO) return ctx.skip()   // ver .github/workflows/varredura-pesada.yml
    // Gerador determinístico: um teto que "às vezes" vale não é teto.
    let semente = 20260719
    const r = () => {
      semente = (semente * 1664525 + 1013904223) >>> 0
      return semente / 4294967296
    }
    // TODO valor sorteado tem no máximo duas casas — é essa a condição sob a
    // qual o teto é declarado, e `emCentavos` a garante mesmo se a planilha
    // entregar quatro casas (ver o teste seguinte).
    const dinheiro = (max) => Math.round(r() * max * 100) / 100

    let pior = 0
    let acimaDeUmReal = 0
    let comOutras = 0
    let comNegativo = 0

    for (let n = 0; n < 100000; n++) {
      // devolve a vez ao event loop — ver CEDER_A_CADA, no topo do arquivo
      if (n > 0 && n % CEDER_A_CADA === 0) await cederAVez()
      const custos = {}
      let temNegativo = false
      const nCats = 1 + Math.floor(r() * 8)
      // 'cat-do-marco' é categoria fora das 7 do histórico: exercita a linha
      // "Outras categorias", que é onde a linha fantasma nascia.
      const chaves = [...CAT_KEYS, 'cat-do-marco']
      for (let i = 0; i < nCats; i++) {
        const k = chaves[Math.floor(r() * chaves.length)]
        custos[k] = custos[k] || []
        const nItens = 1 + Math.floor(r() * 3)
        for (let j = 0; j < nItens; j++) {
          const sorte = r()
          // Negativos (estorno/desconto lançado como item), centavos miúdos e
          // eventos grandes, todos na mesma varredura.
          if (sorte < 0.1) {
            custos[k].push(-dinheiro(500))
            temNegativo = true
          } else if (sorte < 0.2) custos[k].push(dinheiro(20))
          else custos[k].push(dinheiro(40000))
        }
      }
      if (temNegativo) comNegativo++
      if (custos['cat-do-marco']) comOutras++

      const contingenciaPct = Math.round(r() * 10000) / 100 // 0–100%
      const custoPct = Math.round((r() * 200 - 100) * 100) / 100 // −100%..+100%

      const { col } = colunaDe(eventoCom(custos, { contingenciaPct, custoPct }))

      // 1. A coluna fecha — a promessa que a tela faz ao leitor.
      expect(somaColunaExibida(col)).toBe(col.total)
      // 2. Nenhuma rubrica inventada.
      expect(linhasFantasma(col)).toEqual([])
      // 3. Nenhuma linha acima do teto declarado.
      const desvio = maiorDesvioDaColuna(col)
      expect(desvio).toBeLessThan(LIMITE)
      if (desvio > 1.0000001) acimaDeUmReal++
      pior = Math.max(pior, desvio)
    }

    // A varredura só vale se tiver passado pelos casos que interessam.
    expect(comOutras).toBeGreaterThan(10000)
    expect(comNegativo).toBeGreaterThan(10000)
    // O caso difícil (acima de R$ 1,00) existe e é raro — é o que o módulo diz.
    expect(acimaDeUmReal).toBeGreaterThan(0)
    expect(acimaDeUmReal / 100000).toBeLessThan(0.02)
    expect(pior).toBeLessThan(LIMITE)
    // Orçamento de TEMPO, não de conteúdo: 100 mil eventos levam ~2s no Mac do
    // Marco e passaram de 6s na máquina do CI, estourando o limite padrão de 5s
    // do Vitest — o teste passava aqui e ficava vermelho lá, por hardware. O
    // valor da prova é a COBERTURA (100 mil casos), não a velocidade; nenhuma
    // asserção acima mudou. 30s dá folga para o runner mais lento sem esconder
    // uma regressão de desempenho de verdade.
  }, 120000)

  it('os valores sub-centavo do revisor não produzem mais linha fantasma nem desvio fora do teto', () => {
    // Caso 1 do revisor: item de planilha com QUATRO casas (o que `parseMoney`
    // aceita sem arredondar) somado a um negativo de três casas. A diferença
    // 1234,5669 − 1234,567 = −0,0001 sobrava como "outras categorias": passava
    // pelo antigo corte de 1e−6, virava piso −1 e a tela imprimia a linha
    // "Outras categorias — R$ −1" para uma rubrica que vale um décimo de
    // milésimo de real. Agora `emCentavos` zera antes de qualquer piso.
    const { col } = colunaDe(eventoCom({ aeb: [1234.5669], equipe: [-1234.567] }))
    expect(col.outras.mostrar).toBe(false)
    expect(col.outras.exibido).toBe(0)
    expect(linhasFantasma(col)).toEqual([])
    expect(somaColunaExibida(col)).toBe(col.total)
    expect(maiorDesvioDaColuna(col)).toBeLessThan(LIMITE)
  })

  it('sete categorias a −R$ 0,002: nenhuma vira linha na tela, e a coluna fecha', () => {
    // Caso 2 do revisor: valores na faixa cega entre 1e−6 e 0,005. Cada um
    // escapava do corte de elegibilidade (some da fila de distribuição) mas
    // continuava contando piso −1 — sete linhas fantasma de uma vez, e o
    // `restante` deslocado em sete unidades, que era de onde vinham os desvios
    // de vários reais numa linha.
    const custos = {}
    for (const k of CAT_KEYS) custos[k] = [-0.002]
    const { col } = colunaDe(eventoCom(custos, { contingenciaPct: 7.3, custoPct: -4.1 }))

    for (const cat of col.categorias) {
      // −0,002 não é dinheiro: vira zero, e zero não imprime linha.
      expect(cat.valor).toBe(0)
      expect(cat.exibido).toBe(0)
    }
    expect(linhasFantasma(col)).toEqual([])
    expect(somaColunaExibida(col)).toBe(col.total)
    expect(maiorDesvioDaColuna(col)).toBeLessThan(LIMITE)
  })

  it('a quantização é só de EXIBIÇÃO: contingência e ajuste seguem iguais aos do DRE', () => {
    // A trava que impede as duas tabelas da mesma peça de discordarem. Com
    // valores sub-centavo entrando, é justamente onde um arredondamento a mais
    // faria a matriz mostrar um real de diferença do DRE logo acima.
    const { col, realista } = colunaDe(
      eventoCom({ aeb: [1234.5669], estrutura: [41250.1337], marketing: [3210.4444] }, { custoPct: 6 })
    )
    expect(col.contingencia.exibido).toBe(Math.round(realista.contingencia))
    expect(col.ajuste.exibido).toBe(
      Math.round(realista.custoTotal - realista.custoItens - realista.contingencia)
    )
    expect(somaColunaExibida(col)).toBe(col.total)
  })
})

/**
 * O DESEMPATE POR VALOR ABSOLUTO — quem paga o real do arredondamento quando
 * duas categorias terminam no MESMO centavo.
 *
 * O módulo distribui o resíduo pela fração: sobe pela MAIOR fração, desce pela
 * MENOR. Quando duas linhas têm a MESMA fração, isso não decide nada, e entra o
 * segundo critério — `Math.abs(vals[b]) - Math.abs(vals[a])`, que manda o real
 * para a linha de MAIOR valor, "onde R$ 1 pesa menos" (comentário do módulo, nos
 * dois ramos: sobra e falta).
 *
 * POR QUE ISTO PRECISA DE TESTE PRÓPRIO. Até esta sessão nenhum teste da casa
 * exercitava o empate: todos os repro (A, B, C) e os fuzzings sorteiam centavos
 * livres, e fração exatamente igual entre duas linhas é raríssima no sorteio.
 * Medido em 27/07/2026 pela bateria de mutação: estragar o critério nos DOIS
 * ramos — trocar a subtração por soma nas linhas 230 e 250 — deixava os 2.279
 * testes VERDES. Ou seja: a coluna continuava fechando (a promessa principal
 * nunca quebrou), mas o real do arredondamento passava a cair na linha ERRADA e
 * ninguém percebia.
 *
 * O QUE ISSO CUSTA NUMA REUNIÃO. Na festa deste teste, "Extras" vale
 * R$ 18.500 e "A&B" vale R$ 900. Um real de distorção em Extras é 0,005%
 * daquela linha; o MESMO real em A&B é 0,11% — vinte e duas vezes mais pesado.
 * Nenhum dos dois é errado no sentido de quebrar a soma; a diferença é onde a
 * distorção aparece para quem lê. O módulo escolheu a linha grande de propósito,
 * e esta suíte passa a cobrar a escolha.
 *
 * COMO O EMPATE É GARANTIDO. Fração igual "no papel" (as duas terminando em ,98)
 * não basta: em ponto flutuante 900,98 e 18.500,98 têm frações DIFERENTES, e o
 * desempate nem chega a ser consultado. Por isso cada caso aqui AFIRMA o empate
 * antes de cobrar qualquer coisa — teste que perde a premissa em silêncio vira
 * teste que passa por acidente.
 */
describe('empate de centavos: o real do arredondamento cai onde ele pesa menos', () => {
  const fracao = (v) => v - Math.floor(v)

  it('SOBRA — A&B e Extras fecham as duas em ,98 e sobra um real: ele vai para Extras', () => {
    // Festa com dois blocos de custo: A&B soma R$ 5.300,98 (R$ 3.200,49 do
    // fornecedor de bebida + R$ 2.100,49 de gelo e insumo) e Extras soma
    // R$ 18.500,98 (R$ 12.000,49 de estrutura + R$ 6.500,49 de transporte).
    // As duas fecham no mesmo centavo.
    //
    // Com contingência de 3,01% e o cenário realista a +8% de custo, o resíduo
    // do arredondamento é grande o bastante para dar uma volta completa nas duas
    // linhas e AINDA sobrar um real. Esse real põe uma linha em piso+2 —
    // R$ 1,02 acima do valor verdadeiro. Ele tem de cair em Extras: R$ 1,02 em
    // R$ 18.500,98 é 0,006% daquela linha; em A&B seria 0,019%, três vezes mais.
    const { col } = colunaDe(
      eventoCom(
        { aeb: [3200.49, 2100.49], extras: [12000.49, 6500.49] },
        { contingenciaPct: 3.01, custoPct: 8 }
      )
    )

    // A premissa do caso: sem empate exato não há desempate a testar.
    expect(catDe(col, 'aeb').valor).toBe(5300.98)
    expect(catDe(col, 'extras').valor).toBe(18500.98)
    expect(fracao(catDe(col, 'aeb').valor)).toBe(fracao(catDe(col, 'extras').valor))

    // A linha GRANDE absorve o real que sobrou (piso+2); a pequena fica em piso+1.
    expect(catDe(col, 'extras').exibido).toBe(18502)
    expect(catDe(col, 'aeb').exibido).toBe(5301)

    // E a coluna continua fechando, que é a promessa que a tela faz ao leitor.
    expect(col.total).toBe(26480)
    expect(somaColunaExibida(col)).toBe(col.total)
    expect(maiorDesvioDaColuna(col)).toBeCloseTo(1.02, 10)
  })

  it('FALTA — A&B R$ 900,00 e Extras R$ 18.500,00: quem exibe um real a MENOS é Extras', () => {
    // Orçamento de fornecedor quase sempre chega em real redondo, então o
    // empate de centavo mais COMUM numa festa é o empate em ,00 — e esse é
    // exato em ponto flutuante, não depende de sorte. Aqui A&B fecha em
    // R$ 900,00 (R$ 600 + R$ 300) e Extras em R$ 18.500,00 (R$ 12.000 +
    // R$ 6.500), com contingência de 3,05% e cenário a +6%.
    //
    // Nesse arranjo FALTA um real para a coluna fechar: alguma linha PRECISA
    // exibir piso−1. Tirar R$ 1 de Extras é 0,005% daquela linha; tirar de A&B
    // seria 0,11%. A regra manda tirar da maior — e é isso que se cobra aqui.
    const { col } = colunaDe(
      eventoCom({ aeb: [600, 300], extras: [12000, 6500] }, { contingenciaPct: 3.05, custoPct: 6 })
    )

    expect(catDe(col, 'aeb').valor).toBe(900)
    expect(catDe(col, 'extras').valor).toBe(18500)
    expect(fracao(catDe(col, 'aeb').valor)).toBe(fracao(catDe(col, 'extras').valor))

    // Extras desce um real; A&B fica intacta em R$ 900.
    expect(catDe(col, 'extras').exibido).toBe(18499)
    expect(catDe(col, 'aeb').exibido).toBe(900)

    expect(col.total).toBe(21191)
    expect(somaColunaExibida(col)).toBe(col.total)
    expect(maiorDesvioDaColuna(col)).toBeCloseTo(1, 10)
  })

  it('varredura determinística: 20 mil eventos com empate EXATO de centavo, e o real nunca cai na linha pequena', async (ctx) => {
    if (PULAR_PESADO) return ctx.skip()   // ver .github/workflows/varredura-pesada.yml
    // Os dois casos acima são um ramo cada (sobra e falta). Esta varredura cobra
    // a MESMA regra em toda a faixa de contingência que o Marco usa de verdade
    // (3% a 15%, de 0,03 em 0,03) sobre treze pares de categorias que empatam
    // EXATAMENTE na fração. É determinística de propósito: empate de centavo é
    // raro demais para confiar em sorteio.
    //
    // Cada par é (A&B pequena, Extras grande) — a categoria grande fica DEPOIS
    // na ordem das categorias, que é a disposição em que o desempate realmente
    // muda a ordem da fila; com a grande na frente, os dois critérios dariam a
    // mesma resposta e o teste passaria sem provar nada.
    const PARES = [
      [5300, 12000, 98],
      [5300, 18500, 98],
      [5300, 24000, 98],
      [7400, 12000, 98],
      [7400, 18500, 98],
      [7400, 24000, 98],
      [5300, 12000, 90],
      [7400, 12000, 90],
      [2400, 12000, 99],
      [3300, 12000, 99],
      [900, 18500, 0],
      [2400, 33600, 0],
      [5300, 41200, 0],
    ]

    let eventos = 0
    let faltaNaGrande = 0
    let sobraNaGrande = 0
    let paresComEmpate = 0

    for (const [pequena, grande, centavos] of PARES) {
      const vPequena = pequena + centavos / 100
      const vGrande = grande + centavos / 100
      // Premissa do par, afirmada e não suposta: se um dia `emCentavos` mudar e
      // o empate sumir, este teste falha dizendo isso, em vez de continuar verde
      // exercitando um desempate que não acontece mais.
      expect(fracao(vPequena)).toBe(fracao(vGrande))
      paresComEmpate++

      for (let cp = 300; cp <= 1500; cp += 3) {
        for (const custoPct of [-8.8, -5, 6, 8]) {
          const { col } = colunaDe(
            eventoCom(
              { aeb: [vPequena], extras: [vGrande] },
              { contingenciaPct: cp / 100, custoPct }
            )
          )
          eventos++
          // devolve a vez ao event loop — ver CEDER_A_CADA, no topo do arquivo
          if (eventos % CEDER_A_CADA === 0) await cederAVez()

          // A promessa principal não pode regredir em nenhum destes eventos.
          expect(somaColunaExibida(col)).toBe(col.total)
          expect(linhasFantasma(col)).toEqual([])

          const desvioPequena = catDe(col, 'aeb').exibido - Math.floor(vPequena)
          const desvioGrande = catDe(col, 'extras').exibido - Math.floor(vGrande)
          const pequenaFugiu = desvioPequena < 0 || desvioPequena > 1
          const grandeFugiu = desvioGrande < 0 || desvioGrande > 1

          if (pequenaFugiu && grandeFugiu) continue // ninguém desempatou: as duas foram

          // O CORAÇÃO DESTE TESTE: quando só UMA linha se afasta de piso/piso+1,
          // ela é a GRANDE. A pequena nunca paga o real sozinha. O evento vai
          // junto na comparação para o teste, ao falhar, dizer QUAL festa quebrou
          // em vez de só "true não é false".
          const festa = `A&B ${vPequena} / Extras ${vGrande} · contingência ${cp / 100}% · cenário ${custoPct}%`
          expect({ festa, oRealCaiuNaLinhaPequena: pequenaFugiu }).toEqual({
            festa,
            oRealCaiuNaLinhaPequena: false,
          })

          if (grandeFugiu && desvioGrande === -1) faltaNaGrande++
          if (grandeFugiu && desvioGrande === 2) sobraNaGrande++
        }
      }
    }

    // A varredura só vale se tiver passado pelos DOIS ramos de verdade — sem
    // isto, um dia em que nenhum evento caísse no caso difícil deixaria o teste
    // verde sem ter exercitado desempate nenhum.
    expect(paresComEmpate).toBe(PARES.length)
    expect(eventos).toBeGreaterThan(20000)
    expect(faltaNaGrande).toBeGreaterThan(500)
    expect(sobraNaGrande).toBeGreaterThan(1400)
  }, 120000)
})

// A LINHA TRAVADA IMPRIME O MESMO INTEIRO QUE O DRE (07/10/2026). O DRE
// escreve o ajuste com o formatador de moeda, que arredonda meio real para
// LONGE do zero ("− R$ 51" para −50,50); esta tabela usava Math.round, que
// leva −50,5 a −50. Duas tabelas da mesma peça discordavam do mesmo número.
// Medido no fuzz de 20.000 festas do plano dos centavos: 18 de 60.000
// cenários antes da régua do centavo; 196 depois dela, porque com o ajuste em
// centavos exatos o "−x,50" deixa de ser raro.
describe('as linhas travadas (contingência, ajuste, total) seguem o arredondamento do DRE', () => {
  it('ajuste de −R$ 50,50 (−0,5% sobre R$ 10.100): o DRE escreve − R$ 50,50 e a comparação, em reais, −51', () => {
    const e = eventoCom({ aeb: [10100] }, { contingenciaPct: 0, custoPct: -0.5 })
    const { col, realista } = colunaDe(e)
    expect(ajusteCustoValor(realista)).toBe(-50.5)
    expect(ajusteCustoTexto(realista).replace(/\s/g, ' ')).toBe('− R$ 50,50 (−0.5%)')
    expect(col.ajuste.exibido).toBe(-51)
    expect(somaColunaExibida(col)).toBe(col.total)
  })
})
