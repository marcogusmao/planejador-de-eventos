// FOTOGRAFIAS BYTE A BYTE do arquivo de plano (CSV) — a prova de não-regressão
// do refactor do emissor guardado (20/07/2026).
//
// POR QUE ESTE ARQUIVO EXISTE, e por que ele nasceu SOZINHO, num commit sem uma
// linha de produção: `planoFinanceiro.js` ia ser reescrito por dentro (o emissor
// guardado + as duas decisões do Marco de 20/07/2026). A única maneira honesta de
// provar que um evento SEM problema nenhum continua gerando o MESMO arquivo é
// capturar o arquivo ANTES, com o código antigo rodando, e travá-lo aqui.
//
// As strings abaixo NÃO foram digitadas à mão: foram geradas rodando
// `montarItensPlano` + `gerarCSVPlano` no commit 2187b4d (HEAD anterior ao
// refactor) e coladas verbatim. Se este arquivo passar SEM nenhuma mudança de
// código, ele retrata o "antes"; se quebrar depois do refactor, o refactor mudou
// o arquivo que vai para o Financeiro — ou seja, mudou o arquivo de alguém.
//
// São `toBe` com string literal, de propósito, e não `toMatchSnapshot`: snapshot
// se regrava com uma tecla; literal exige um diff que uma pessoa lê e aprova.
//
// Ids CONGELADOS (evt, l1, l2, gelo, dj, pa, pb…) em vez de uid(): o id_linha do
// CSV é construído com eles, e o contrato com o Financeiro depende dele.

import { describe, it, expect } from 'vitest'
import { montarItensPlano, gerarCSVPlano } from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { novaParcela } from './parcelas.js'

const CRLF = '\r\n'

const lote = (id, patch) => ({ ...novoLote(patch), id })
const item = (id, patch) => ({ ...novoItem(patch), id })
const parcela = (id, patch) => ({ ...novaParcela(patch), id })

/** Evento rico e SEM problema nenhum: 2 lotes vendendo, 2 custos, contingência 5%. */
export function eventoFoto() {
  const e = novoEvento('Brisa 15/08')
  e.id = 'evt'
  e.tipo = 'Brisa'
  e.data = '2026-08-15'
  e.lotes = [
    lote('l1', { nome: 'Lote 1', valor: 100, quantidade: 250 }),
    lote('l2', { nome: 'Lote 2', valor: 120, quantidade: 150 }),
  ]
  e.categorias = [
    { id: 'aeb', nome: 'A&B', padrao: true, itens: [item('gelo', { servico: 'Gelo', estimado: 500 })] },
    { id: 'artistico', nome: 'Artístico', padrao: true, itens: [item('dj', { servico: 'DJ', estimado: 8000 })] },
  ]
  return e
}

export const FIXTURES = {
  // 1 — evento simples (2 lotes + 2 custos + contingência 5%)
  simples: () => eventoFoto(),

  // 2 — bar fixo > 0 + patrocínio confirmado > 0
  barEPatrocinio: () => {
    const e = eventoFoto()
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: 12000, patrocinio: '' }
    e.patrocinios = [{ id: 'p1', nome: 'Cerveja X', valor: 15000, estagio: 'confirmado' }]
    return e
  },

  // 3 — custo parcelado com valores PREENCHIDOS e datas
  parceladoPreenchido: () => {
    const e = eventoFoto()
    e.categorias[1].itens[0].parcelas = [
      parcela('pa', { valor: 4000, data: '2026-07-10' }),
      parcela('pb', { valor: 4000, data: '2026-08-10' }),
    ]
    return e
  },

  // 4 — custo com dataPagamento única
  dataUnica: () => {
    const e = eventoFoto()
    e.categorias[1].itens[0].dataPagamento = '2026-07-31'
    return e
  },

  // 5 — parcelas PARCIALMENTE preenchidas: o caso VIZINHO da Decisão 1, que o
  //     Marco NÃO decidiu e que NÃO pode mudar. Esta foto é o cadeado disso.
  parcialmentePreenchido: () => {
    const e = eventoFoto()
    e.categorias[1].itens[0].parcelas = [
      parcela('pa', { valor: 10000, data: '2026-07-10' }),
      parcela('pb', {}),
    ]
    return e
  },

  // 6 — open bar (bar = 0): referência 0, zero linhas, silêncio total
  openBar: () => {
    const e = eventoFoto()
    e.openBar = true
    return e
  },

  // 7 — categoria custom (aviso do balde "Outras despesas")
  categoriaCustom: () => {
    const e = eventoFoto()
    e.categorias.push({
      id: 'cat-custom',
      nome: 'Fogos',
      padrao: false,
      itens: [item('fg', { servico: 'Fogos de artifício', estimado: 3000 })],
    })
    return e
  },

  // 8 — evento com realizado + contingência > 0 (o aviso comprido)
  comRealizado: () => {
    const e = eventoFoto()
    e.categorias[0].itens[0].realizado = 620
    return e
  },

  // 9 — nenhum lote com receita
  semReceitaLote: () => {
    const e = eventoFoto()
    e.lotes = [lote('l1', { nome: 'Cortesia', valor: 0, quantidade: 50 })]
    return e
  },

  // 10 — ticket médio manual (a trava do §9.1: zero linha de ingresso + alerta)
  ticketManual: () => {
    const e = eventoFoto()
    e.lotes = [lote('l1', { nome: 'Lote 1', valor: 100, quantidade: 100 })]
    e.cenariosConfig.realista = { ...e.cenariosConfig.realista, ticketMedio: 200 }
    return e
  },

  // 11 — custo negativo (alerta por item)
  custoNegativo: () => {
    const e = eventoFoto()
    e.categorias[1].itens.push(item('desc', { servico: 'Desconto negociado', estimado: -3000 }))
    return e
  },

  // 12 — custoPct = 0 EXPLÍCITO no realista: a prova de que a Decisão 2 CALA
  //      quando não há ajuste nenhum a declarar (0 é o default).
  custoPctZero: () => {
    const e = eventoFoto()
    e.cenariosConfig.realista = { ...e.cenariosConfig.realista, custoPct: 0 }
    return e
  },
}

// A LINHA DE INGRESSOS FOI REGRAVADA EM 25/07/2026 (decisão do Marco: a
// bilheteria vira UMA LINHA SÓ, sempre — ver a nota grande em cima de
// `emitirIngressos` em planoFinanceiro.js). Nas fotos abaixo, ela deixa de
// aparecer como `evt:ingressos:l1` + `evt:ingressos:l2` (uma por lote) e
// passa a aparecer como uma linha única `evt:ingressos`, descrição
// "Ingressos (bilheteria)", valor = a SOMA das duas linhas de antes
// (22.500 + 16.200 = 38.700 nas fixtures com 2 lotes vendendo) — o TOTAL
// não muda em nenhuma fixture; só a forma da linha.
const CSV = {
  simples: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  barEPatrocinio: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:bar:1,Brisa,Brisa 15/08,2026-08-15,Bar / Consumo,Receita de bar (estimada),12000,',
    'evt:patrocinio:1,Brisa,Brisa 15/08,2026-08-15,Patrocínio,Patrocínio (fechado),15000,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  parceladoPreenchido: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj:pa,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ · parcela 1/2,4000,2026-07-10',
    'evt:artistico:dj:pb,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ · parcela 2/2,4000,2026-08-10',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  dataUnica: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,2026-07-31',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  parcialmentePreenchido: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj:pa,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ · parcela 1/2,10000,2026-07-10',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  openBar: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  categoriaCustom: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:cat-custom:fg,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Fogos de artifício,3000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),575,',
  ].join(CRLF) + CRLF,
  comRealizado: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),431,',
  ].join(CRLF) + CRLF,
  semReceitaLote: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  // ticketManual, 25/07/2026: antes desta data, nenhuma linha de ingressos
  // saía (a trava do §9.1 bloqueava) — hoje ela sai, com o valor da TELA
  // (18.000 = 90 ingressos pagos [100 × vendaPct 90%] × ticket manual 200).
  ticketManual: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),18000,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
  custoNegativo: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),275,',
  ].join(CRLF) + CRLF,
  custoPctZero: [
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento',
    'evt:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),38700,',
    'evt:aeb:gelo,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,',
    'evt:artistico:dj,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ,8000,',
    'evt:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,',
  ].join(CRLF) + CRLF,
}

// A ORDEM das linhas é a ordem dos bytes do arquivo, e é contrato de conferência
// visual do Marco. Isolada num expect próprio para a falha dizer "a ordem mudou"
// em vez de cuspir 400 caracteres de CSV.
// Ids ATUALIZADOS em 25/07/2026: `evt:ingressos:l1` + `evt:ingressos:l2` (uma
// linha por lote) viraram um único `evt:ingressos` — decisão do Marco, ver a
// nota grande em cima de `emitirIngressos` em planoFinanceiro.js.
const IDS = {
  simples: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  barEPatrocinio: [
    'evt:ingressos',
    'evt:bar:1',
    'evt:patrocinio:1',
    'evt:aeb:gelo',
    'evt:artistico:dj',
    'evt:contingencia:1',
  ],
  parceladoPreenchido: [
    'evt:ingressos',
    'evt:aeb:gelo',
    'evt:artistico:dj:pa',
    'evt:artistico:dj:pb',
    'evt:contingencia:1',
  ],
  dataUnica: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  parcialmentePreenchido: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj:pa', 'evt:contingencia:1'],
  openBar: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  categoriaCustom: [
    'evt:ingressos',
    'evt:aeb:gelo',
    'evt:artistico:dj',
    'evt:cat-custom:fg',
    'evt:contingencia:1',
  ],
  comRealizado: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  semReceitaLote: ['evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  // ticketManual, 25/07/2026: antes a linha de ingressos ficava de fora
  // (trava do §9.1); hoje ela sai — 'evt:ingressos' entra na lista, na mesma
  // posição de sempre (a ordem de emissão do módulo não mudou).
  ticketManual: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  custoNegativo: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
  custoPctZero: ['evt:ingressos', 'evt:aeb:gelo', 'evt:artistico:dj', 'evt:contingencia:1'],
}

const AVISOS = {
  simples: [],
  barEPatrocinio: [],
  parceladoPreenchido: [],
  dataUnica: [],
  parcialmentePreenchido: [
    'As parcelas de "DJ" somam R$\u00A010.000, diferente do estimado R$\u00A08.000 — o arquivo leva as parcelas (a agenda combinada de pagamento). Ajuste na aba Custos se não for isso.',
  ],
  openBar: [],
  categoriaCustom: [
    'A categoria "Fogos" é própria deste evento e não tem par exato no Financeiro — os itens dela entram como "Outras despesas". Recategorize lá se quiser separar.',
  ],
  comRealizado: [
    '1 item de custo já tem realizado preenchido (R$\u00A0620 no total), e as LINHAS DE CUSTO deste arquivo não levam esses valores: elas levam o PREVISTO (o orçamento), de propósito. O que já foi pago entra no Financeiro pelos lançamentos de lá — se o arquivo levasse os dois, a mesma despesa contaria em dobro. Por isso as linhas abaixo podem mostrar valor diferente do que você vê na aba Custos. Uma exceção, para você não se surpreender conferindo: a linha de contingência (R$\u00A0431) é 5% sobre o custo CONSIDERADO — que usa o realizado onde ele existe e o estimado no resto, a mesma base da tela. Ela é o único valor do arquivo derivado do realizado.',
  ],
  semReceitaLote: [
    'Nenhum lote tem receita prevista no cenário realista (venda 0 ou preço R$ 0) — nada de "Ingressos" para exportar.',
  ],
  // ticketManual, 25/07/2026: até aqui este caso não tinha aviso nenhum — a
  // trava bloqueava com ALERTA (ver ALERTAS.ticketManual, abaixo, que hoje é
  // []). Com a linha única, o arquivo sai certo e o motivo pelo qual o
  // valor não é a soma ingênua dos lotes vira este AVISO informativo.
  ticketManual: [
    'A linha "Ingressos (bilheteria)" (R$ 18.000) usa o ticket médio MANUAL do cenário realista, não a mistura de preços dos lotes — é o mesmo valor que a tela mostra, mas pode diferir do que você vê somando os lotes na aba Receita.',
  ],
  custoNegativo: [],
  custoPctZero: [],
}

// ticketManual: ALERTAS PASSA A SER [] EM 25/07/2026 — a decisão do Marco.
// Até 25/07 este era o único caso do arquivo inteiro com alerta (a trava do
// §9.1 bloqueando a bilheteria inteira); o texto abaixo, com o histórico do
// achado S3-c (20/07/2026), fica registrado aqui como REGISTRO HISTÓRICO —
// não é mais o comportamento do código, mas é a evidência do que motivou a
// mudança e não se apaga:
//
//   'A receita de INGRESSOS ficou de fora deste arquivo, de propósito: o
//   cenário realista usa ticket médio MANUAL, e a divisão por lote não
//   acompanha esse ticket. A previsão mostra R$ 18.000 de bilheteria, mas as
//   linhas por lote que iriam para o arquivo somam R$ 9.000 — exportá-las
//   mandaria para o Financeiro um número diferente do que você vê na tela.'
//   +
//   'O que fazer: exporte assim mesmo — os demais blocos saem por conta
//   própria, e a tabela logo abaixo mostra, bloco a bloco, o que entrou
//   neste arquivo e o que não entrou — e lance a bilheteria à mão no
//   Financeiro pelo valor da tela; ou tire o ticket médio manual do cenário
//   realista, e exporte de novo.'
//
// (achado S3-c, 20/07/2026: a frase original garantia "bar, patrocínio e
// custos abaixo estão corretos", algo que o alerta dos ingressos nunca
// inspecionou — corrigido naquela data, sem mudar nenhum byte do CSV.)
const ALERTAS = {
  simples: [],
  barEPatrocinio: [],
  parceladoPreenchido: [],
  dataUnica: [],
  parcialmentePreenchido: [],
  openBar: [],
  categoriaCustom: [],
  comRealizado: [],
  semReceitaLote: [],
  ticketManual: [],
  custoNegativo: [
    'O custo "Desconto negociado" ficou de fora deste arquivo, de propósito: a aba Custos mostra -R$\u00A03.000 previsto para ele, mas as linhas que iriam para o arquivo somam R$\u00A00 — a diferença é valor NEGATIVO (desconto), que não vira linha de despesa no Financeiro. Exportar assim mandaria para lá mais dinheiro do que você vê na tela. Como o total deste item é negativo, ele é um abatimento, não uma despesa: registre o desconto direto no Financeiro do jeito que vocês fazem, ou embuta o abatimento no custo a que ele pertence e exporte de novo.',
  ],
  custoPctZero: [],
}

describe('planoFinanceiro — fotografias byte a byte do CSV (prova de não-regressão)', () => {
  for (const nome of Object.keys(FIXTURES)) {
    describe(nome, () => {
      it('gera o MESMO arquivo, byte a byte', () => {
        const e = FIXTURES[nome]()
        const { itens } = montarItensPlano(e)
        expect(gerarCSVPlano(itens, e)).toBe(CSV[nome])
      })

      it('mantém a ORDEM das linhas', () => {
        const e = FIXTURES[nome]()
        const { itens } = montarItensPlano(e)
        expect(itens.map((i) => i.id)).toEqual(IDS[nome])
      })

      it('mantém avisos, alertas e bloqueios palavra por palavra', () => {
        const r = montarItensPlano(FIXTURES[nome]())
        expect(r.avisos).toEqual(AVISOS[nome])
        expect(r.alertas).toEqual(ALERTAS[nome])
        expect(r.bloqueios).toEqual([])
      })
    })
  }

  it('o evento rico e saudável sai LIMPO: sem aviso, sem alerta, sem bloqueio', () => {
    const r = montarItensPlano(FIXTURES.simples())
    expect(r.avisos).toEqual([])
    expect(r.alertas).toEqual([])
    expect(r.bloqueios).toEqual([])
    // 25/07/2026: eram 5 linhas (2 lotes de ingresso + gelo + dj +
    // contingência); a bilheteria virou 1 linha só, então agora são 4.
    expect(r.itens.length).toBe(4)
  })
})
