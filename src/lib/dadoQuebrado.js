import { camposReceitaRealizadaInvalidos } from './migracao.js'
// CUSTO QUE NÃO CABE NUMA CONTA DE DINHEIRO — a leitura que faz a tela falar.
//
// Decisão do Marco, 26/07/2026 (questionário): a tela passa a DIZER que a festa
// tem dado quebrado, em vez de imprimir R$ 0 calada. Ele escolheu isto contra
// "só fechar a porta de entrada" e contra "só registrar num arquivo".
//
// ---------------------------------------------------------------------------
// O QUE ESTE MÓDULO RESPONDE, E O QUE ELE NÃO RESPONDE
// ---------------------------------------------------------------------------
// Responde: "algum custo desta festa deixa de virar dinheiro na régua da casa?"
// NÃO responde: "esse custo é alto demais?" — isso seria teto de negócio, e teto
// de negócio erra em festa legítima grande. Um aviso que aparece numa festa boa
// ensina o dono a ignorar aviso, e aí o aviso não serve para a festa ruim.
//
// A régua é a do DOUBLE. `somaCentavos()` (util.js) multiplica cada parcela por
// 100 antes de arredondar, então um valor acima de ~1,8 × 10^306 vira infinito
// já na primeira conta. A festa mais cara da casa (Marfim 09/05) custou R$ 360
// mil: está 10^301 vezes longe do limite. Não existe festa real perto disto.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO É PRECISO EXISTIR — a corrente inteira, medida
// ---------------------------------------------------------------------------
// 1. A porta do backup ainda aceita 1 seguido de 308 zeros no estimado de um
//    item (achado EM ABERTO — não há teto para dinheiro na fronteira do backup;
//    a migração só recusa negativo e não-número).
// 2. A guarda de 26/07 (calc.js, fechamento.js) faz o número INTERNO continuar
//    gritando (infinito) em vez de virar zero — é ela que impede o card do
//    Fechamento de anunciar lucro falso.
// 3. Mas `fmtBRL` passa todo valor por `num()`, e `num()` devolve 0 para tudo
//    que não é finito. Resultado medido: a TELA escreve "R$ 0" nas quatro
//    superfícies de custo, antes e depois da guarda, sem aviso nenhum.
//
// Este módulo é o passo 4: a leitura que permite a tela dizer o que houve.
// Ele NÃO muda nenhum número e NÃO impede nada — é leitura pura.

import { custosPorCategoria, computeCenarios, CENARIOS, isOpenBar, isBarPorPessoa } from './calc.js'
import { CAT_KEYS, CAT_LABELS } from './benchmarks.js'
import { FAIXA_QUANTIDADE } from './campoNumerico.js'

export const CUSTO_SEM_NOME = '(custo sem nome)'

/**
 * O que a tela escreve NO LUGAR de um lucro, resultado ou margem que deixou de
 * ser dinheiro. Sem número nenhum, nem "R$ 0": qualquer número ali seria
 * derivado de lixo (decisão do Marco, 26/07/2026).
 */
export const NUMERO_NAO_CALCULA = 'não dá para calcular'

/**
 * Valor digitado que não cabe e NÃO entra em conta nenhuma (patrocínio em
 * proposta, 05/10/2026): não acende faixa nem tira a festa da acurácia, e onde
 * ele é impresso cru sai esta frase, que se explica sozinha.
 */
export const VALOR_ILEGIVEL = 'valor que o app não consegue calcular'
/** O valor formatado, ou VALOR_ILEGIVEL quando ele não cabe na régua. */
export const fmtOuIlegivel = (v, fmt) => (cabeComoDinheiro(v) ? fmt(v) : VALOR_ILEGIVEL)

/** O veredito de uma festa cujo lucro não é dinheiro. */
export const TITULO_VEREDITO_QUEBRADO = 'Sem veredito'
export const FRASE_VEREDITO_QUEBRADO =
  'Um custo desta festa não cabe numa conta de dinheiro, então o app não consegue dizer se ela é viável. Corrija o custo na aba Custos.'
/** A mesma frase quando quem não cabe é a RECEITA (05/10/2026). */
export const FRASE_VEREDITO_QUEBRADO_RECEITA =
  'Uma receita desta festa não cabe numa conta de dinheiro, então o app não consegue dizer se ela é viável. Corrija o valor na aba Receita.'
/**
 * A frase do veredito pela CAUSA: custo acusado manda; senão, a receita, e a
 * aba é a do insumo culpado (5ª revisão do PR #98, 05/10/2026: o ticket médio
 * manual fica na aba Cenários, e a frase mandava para a aba Receita). Só
 * contam os insumos do realista, do pessimista ou compartilhados — o veredito
 * não depende do otimista. Receita realizada se corrige no Fechamento.
 */
export const fraseVereditoQuebrado = (evento) => {
  if (custosQuebrados(evento).ha) return FRASE_VEREDITO_QUEBRADO
  const rr = evento?.receitaRealizada || {}
  const abas = [
    ...insumosDaReceitaDoPlano(evento)
      .filter((x) => x.cenario == null || x.cenario === 'realista' || x.cenario === 'pessimista')
      .map((x) => x.aba),
    ...((camposReceitaRealizadaInvalidos(evento).length > 0 || CAMPOS_RECEITA_REALIZADA.some(([k]) => !cabeComoDinheiro(rr[k]))) ? ['Fechamento'] : []),
  ]
  const unicas = [...new Set(abas)]
  if (unicas.length === 0 || (unicas.length === 1 && unicas[0] === 'Receita'))
    return FRASE_VEREDITO_QUEBRADO_RECEITA
  return `Uma receita desta festa não cabe numa conta de dinheiro, então o app não consegue dizer se ela é viável. Corrija o valor na aba ${unicas.join(' ou na aba ')}.`
}
/** Veredito de festa cujo lucro do realista ou do pessimista não é dinheiro. */
export const vereditoQuebrado = (evento, c) =>
  cenarioQuebrado(evento, c.realista, c) || cenarioQuebrado(evento, c.pessimista, c)
export const BENCHMARK_SEM_NOME = '(referência sem nome)'

/**
 * O valor sobrevive à régua de centavos da casa?
 *
 * Vazio (`''`, `null`, `undefined`) CABE: "não informado" é estado legítimo de
 * item ainda sem orçamento. Negativo CABE: quem recusa negativo é a porta do
 * campo (FAIXA_CUSTO, Marco 22/07/2026); um −500 que já esteja salvo soma sem
 * estourar e não é dado quebrado.
 */
export const cabeComoDinheiro = (v) => {
  if (v === '' || v === null || v === undefined) return true
  const n = Number(v)
  // texto no campo de dinheiro, Infinity vindo de um JSON, NaN: o app não
  // consegue ler o valor, e hoje ele vira 0 em silêncio.
  if (!Number.isFinite(n)) return false
  // 1 seguido de 308 zeros é finito, mas × 100 não é.
  return Number.isFinite(n * 100)
}

/**
 * Leitura de uma festa: quais custos não cabem, e se a soma não cabe.
 *
 * Devolve:
 *   itens       — [{ categoria, servico, campos }] com `campos` em
 *                 ['estimado'] / ['realizado'] / ['estimado','realizado']
 *   somaNaoCabe — a soma estourou mesmo com todo item cabendo sozinho (dois
 *                 itens de 10^306 cabem cada um; a soma dos dois, não)
 *   ha          — tem alguma coisa a dizer ao Marco
 */
export function custosQuebrados(evento) {
  const categorias = evento?.categorias || []
  const itens = []
  for (const c of categorias) {
    for (const i of c?.itens || []) {
      const campos = []
      if (!cabeComoDinheiro(i?.estimado)) campos.push('estimado')
      if (!cabeComoDinheiro(i?.realizado)) campos.push('realizado')
      if (campos.length > 0) {
        itens.push({
          categoria: String(c?.nome || '').trim(),
          servico: String(i?.servico || '').trim() || CUSTO_SEM_NOME,
          campos,
        })
      }
    }
  }
  const totais = custosPorCategoria(categorias)
  const somaNaoCabe = ![
    totais.totalEstimado,
    totais.totalRealizado,
    totais.totalConsiderado,
  ].every(Number.isFinite)
  return { itens, somaNaoCabe, ha: itens.length > 0 || somaNaoCabe }
}

/**
 * Algum destes números que a tela vai imprimir deixou de ser dinheiro POR
 * CAUSA de um custo acusado? É a pergunta que decide trocar lucro, resultado e
 * margem por "não dá para calcular" (decisão do Marco, 26/07/2026: a tela DIZ,
 * em vez de imprimir número derivado de lixo).
 *
 * As duas metades são precisas. Só a acusação não basta: um "a combinar" no
 * realizado acusa o custo, mas a conta usa o estimado e o número sai certo —
 * escondê-lo seria o defeito oposto. Só o número não-finito também não: aí a
 * frase "um custo desta festa…" poderia estar mentindo sobre a causa.
 *
 * `null`/`undefined` contam como "nada a imprimir", não como quebrado (margem
 * de festa sem receita é null de propósito). Para a FOTOGRAFIA do fechamento,
 * onde null é justamente o rastro do infinito depois do JSON, use
 * `fotoQuebrada`.
 */
export function numeroQuebradoPorCusto(evento, ...valores) {
  // Régua da casa, não `Number.isFinite` (05/10/2026): 1e308 é finito e sai
  // na tela com centenas de dígitos. `cabeComoDinheiro(null)` é verdadeiro.
  if (valores.every(cabeComoDinheiro)) return false
  return custosQuebrados(evento).ha
}

/**
 * A RECEITA REALIZADA que não cabe na régua (05/10/2026, 2ª revisão do PR
 * #98). A migração aceita 1e308 na bilheteria, no bar e no Pix líquido (#95):
 * com o Pix em 1e308, a foto do fechamento grava `resultado: 1e308` e o
 * Relatório, a Apresentação, o Fechamento e a Home imprimiam
 * "R$ 100.000.000…000"; com a bilheteria em 1e308, saíam "não dá para
 * calcular" sem nenhuma faixa dizendo por quê.
 */
export const CAMPOS_RECEITA_REALIZADA = [
  ['bilheteria', 'a bilheteria realizada'],
  ['bar', 'o bar realizado'],
  ['pix', 'o Pix recebido'],
]
/** Origens realizadas que entram na conta, sem sanear nem tornar campo obrigatório. */
export function camposRealizadosAtivosInvalidos(evento) {
  const rr = evento?.receitaRealizada || {}
  const invalidos = camposReceitaRealizadaInvalidos(evento)
  return CAMPOS_RECEITA_REALIZADA
    .filter(([campo]) => campo !== 'bar' || !isOpenBar(evento))
    .filter(([campo]) => invalidos.includes(campo) || !cabeComoDinheiro(rr[campo]))
    .map(([campo, rotulo]) => ({ campo, rotulo }))
}

export const textoRealizadosInvalidos = (campos) =>
  `${campos.map((c) => c.rotulo).join(' e ')} ${campos.length === 1 ? 'tem um valor' : 'têm valores'} que o app não consegue calcular`

export function motivoReceitaInvalidaParaPromover(evento) {
  const campos = camposRealizadosAtivosInvalidos(evento)
  if (!campos.length) return null
  const nome = String(evento?.nome || '').trim() || 'esta festa'
  const caminho = evento?.status === 'fechado'
    ? 'Para promover, reabra na aba Fechamento, corrija o campo e feche novamente; reabrir descarta a fotografia atual.'
    : 'Corrija o campo na aba Fechamento antes de fechar e promover.'
  return `Não dá para promover “${nome}” a benchmark: ${textoRealizadosInvalidos(campos)}. ${caminho}`
}

// Os estágios de patrocínio que ENTRAM na conta — a MESMA regra de
// `patrocinioPorEstagio` (calc.js): confirmado ou recebido. Proposta não entra
// em conta nenhuma, então não acende faixa nem tira a festa da acurácia (4ª
// revisão do PR #98, 05/10/2026: uma proposta de 1e308 fazia as duas coisas).
const ESTAGIOS_QUE_CONTAM = ['confirmado', 'recebido']

/**
 * Os INSUMOS da receita dos cenários que não cabem na régua (4ª revisão do PR
 * #98, 05/10/2026). Medido antes: com um patrocínio confirmado de 1e308, a aba
 * Cenários imprimia 29 números gigantes ("Lucro R$ 100.000…") e o Relatório
 * "Viável … margem realista 100%"; com o valor de um lote em 1e307, a receita
 * saía NaN e o veredito "Viável com ressalvas"; com a quantidade em 1e307,
 * pagantes e público de centenas de dígitos. Só o que entra na conta é olhado.
 */
function insumosDaReceitaDoPlano(evento) {
  // Cada insumo diz ONDE se corrige (`aba`) e, se for de UM cenário só, qual
  // (`cenario`) — 5ª revisão do PR #98, 05/10/2026: a frase do veredito
  // mandava corrigir o ticket médio "na aba Receita", e ele mora em Cenários;
  // e um ticket quebrado só no otimista escondia os outros dois cenários.
  const insumos = []
  for (const l of Array.isArray(evento?.lotes) ? evento.lotes : []) {
    if (!cabeComoDinheiro(l?.valor) || !cabeComoDinheiro(l?.quantidade))
      insumos.push({ rotulo: `o lote “${String(l?.nome || '').trim() || 'sem nome'}”`, aba: 'Receita' })
  }
  if (Array.isArray(evento?.patrocinios)) {
    for (const p of evento.patrocinios) {
      if (ESTAGIOS_QUE_CONTAM.includes(p?.estagio) && !cabeComoDinheiro(p?.valor))
        insumos.push({ rotulo: `o patrocínio “${String(p?.patrocinador || '').trim() || 'sem nome'}”`, aba: 'Receita' })
    }
  } else if (!cabeComoDinheiro(evento?.outrasReceitas?.patrocinio)) {
    // sem a lista, o número solto antigo conta inteiro (patrocinioPorEstagio)
    insumos.push({ rotulo: 'o patrocínio', aba: 'Receita' })
  }
  if (!isOpenBar(evento)) {
    if (isBarPorPessoa(evento)) {
      for (const k of CENARIOS)
        if (!cabeComoDinheiro(evento?.barTicket?.[k]))
          insumos.push({ rotulo: `o consumo de bar por pessoa (${k})`, aba: 'Receita', cenario: k })
    } else if (!cabeComoDinheiro(evento?.outrasReceitas?.bar)) {
      insumos.push({ rotulo: 'o bar previsto', aba: 'Receita' })
    }
  }
  for (const k of CENARIOS) {
    if (!cabeComoDinheiro(evento?.cenariosConfig?.[k]?.ticketMedio))
      insumos.push({ rotulo: `o ticket médio do cenário ${k}`, aba: 'Cenários', cenario: k })
  }
  return insumos
}
const camposDaReceitaDoPlano = (evento) => insumosDaReceitaDoPlano(evento).map((x) => x.rotulo)

/**
 * O cenário `k` tem um insumo QUEBRADO SÓ DELE (ticket médio manual, consumo
 * de bar por pessoa)? Então a quebra dele não diz nada sobre os outros dois.
 */
const insumoDoCenarioQuebrado = (evento, k) =>
  insumosDaReceitaDoPlano(evento).some((x) => x.cenario === k)

// Os números de receita de UM cenário que a tela imprime. Se algum não cabe,
// a receita do cenário está quebrada — tenha o insumo nome ou não.
const receitaDoCenario = (s) => [
  s?.bruta,
  s?.taxa,
  s?.cashback,
  s?.liquida,
  s?.bar,
  s?.patrocinio,
  s?.receitaTotal,
  s?.pagos,
  s?.cortesias,
  s?.publico,
  s?.ticketMedio,
  s?.ticketMedioLiquido,
]

export function receitaQuebrada(evento) {
  const rr = evento?.receitaRealizada || {}
  const invalidos = camposReceitaRealizadaInvalidos(evento)
  const campos = CAMPOS_RECEITA_REALIZADA.filter(([k]) => invalidos.includes(k) || !cabeComoDinheiro(rr[k])).map(
    ([, rotulo]) => rotulo
  )
  for (const c of camposDaReceitaDoPlano(evento)) if (!campos.includes(c)) campos.push(c)
  // O alarme de SOMA, para o que não tem nome: lote de R$ 1e305 com 200
  // pagantes cabe sozinho e estoura na bilheteria. Só calcula os cenários
  // quando nenhum campo já acusou (a resposta não muda, e é a parte cara).
  const somaNaoCabe =
    campos.length === 0 &&
    (() => {
      const c = computeCenarios(evento)
      return !CENARIOS.every((k) => receitaDoCenario(c[k]).every(cabeComoDinheiro))
    })()
  return { campos, somaNaoCabe, ha: campos.length > 0 || somaNaoCabe }
}

/** Custo OU receita acusados: a festa tem algo que a faixa vai nomear. */
export const dadoQuebrado = (evento) => custosQuebrados(evento).ha || receitaQuebrada(evento).ha

/**
 * O LUCRO, a MARGEM, o veredito e o break-even de UM cenário viram texto?
 * Olha o valor E a origem dele (lição da 3ª revisão do PR #98): com a receita
 * em 1e307 o lucro também é ~1e307, mas a margem dá 100% — CABE, e mente. Por
 * isso a receita e o custo do cenário entram na pergunta.
 */
export function cenarioQuebrado(evento, s, cenarios) {
  if ([s?.lucro, s?.margem, s?.custoTotal].every(cabeComoDinheiro) && !algumaReceitaNaoCabe(evento, cenarios))
    return false
  return dadoQuebrado(evento)
}

/**
 * A receita de ALGUM cenário não cabe? Então a origem dos três está quebrada,
 * mesmo do que cabe: lote de R$ 1e304 com 200 pagantes dá um pessimista de
 * ~1,5e306 (cabe, e imprimia "Lucro R$ 1.519.999…", "margem 100%") enquanto
 * realista e otimista estouram; a quantidade de um lote em 1e307 dava receita
 * R$ 0 no realista e "Inviável", com o otimista estourado. Quem chama passa os
 * três cenários que já tem. É isto, e não o simples "algum insumo está
 * acusado", que decide: com a mesma quantidade quebrada e venda de 0% nos três
 * cenários a receita é R$ 0 de verdade, e escondê-la seria o defeito oposto.
 */
//
// MAS SÓ PARA O QUE É COMPARTILHADO (5ª revisão do PR #98, 05/10/2026). Lotes,
// patrocínio e bar fixo entram nos três cenários; ticket médio manual e
// consumo de bar por pessoa são de UM cenário. Com o ticket do otimista em
// 1e307, pessimista (receita R$ 15.200, lucro R$ 11.570) e realista (R$ 17.100,
// R$ 13.800) estavam certos e saíam "não dá para calcular", com "Sem
// veredito" — número certo escondido. Cenário cuja quebra se explica por um
// insumo só dele não arrasta os outros.
const algumaReceitaNaoCabe = (evento, cenarios) =>
  !!cenarios &&
  CENARIOS.some(
    (k) => !receitaDoCenario(cenarios[k]).every(cabeComoDinheiro) && !insumoDoCenarioQuebrado(evento, k)
  )


/**
 * Os números de RECEITA de um cenário (bilheteria, taxa, cashback, bar,
 * patrocínio, receita total, imposto, ticket, pagantes, público) viram texto?
 * Conservador de propósito: se qualquer número de receita do cenário não
 * cabe, todos viram texto — um "Receita bruta R$ 20.000" certo ao lado de um
 * total que não é dinheiro não ajuda ninguém a ler a coluna.
 */
export function receitaDoCenarioQuebrada(evento, s, cenarios) {
  if (receitaDoCenario(s).every(cabeComoDinheiro) && !algumaReceitaNaoCabe(evento, cenarios)) return false
  return dadoQuebrado(evento)
}

/** O mesmo que `numeroQuebradoPorCusto`, quando a causa é a receita realizada. */
export function numeroQuebradoPorReceita(evento, ...valores) {
  if (valores.every(cabeComoDinheiro)) return false
  return receitaQuebrada(evento).ha
}

/**
 * O resultado da FOTOGRAFIA de fechamento não é dinheiro. A foto de uma festa
 * fechada com custo quebrado nasce com custos Infinity e, depois de uma volta
 * pelo localStorage, com `custos: null` e `resultado: null`. A aba Fechamento
 * já decide assim (`cardCabeComoDinheiro`); este é o mesmo critério, para o
 * Relatório e a Apresentação. Medido em 05/10/2026: com `resultado: null` o
 * Relatório imprimia "R$ 19.000" em VERDE, porque `null >= 0` é verdadeiro.
 */
//
// A régua é a da casa (`cabeComoDinheiro`), não `Number.isFinite`: medido em
// 05/10/2026 (2ª revisão do PR #98), um Pix de 1e308 grava `resultado: 1e308`,
// que é FINITO — e o Relatório, a Apresentação e o Fechamento imprimiam
// "R$ 100.000.000…000" sem aviso. `null` continua contando como quebrado.
export const fotoQuebrada = (f) =>
  f != null &&
  ![f.custos, f.resultado, f.receita].every((v) => v != null && cabeComoDinheiro(v))

// ===========================================================================
// O CONTÁGIO — o dado quebrado sai da festa doente e entra na festa sã
// ===========================================================================
//
// MEDIDO EM 26/07/2026, rodando. Uma Brisa com "Som e luz" em 1 seguido de 308
// zeros é FECHADA e PROMOVIDA a benchmark. O objeto que vai para
// `store.benchmarksCustom` — dado SALVO, princípio 3 do CLAUDE.md — nasce com:
//
//     custoTotal ......... Infinity
//     custos.estrutura ... 1e+308
//     lucro .............. -Infinity
//
// Depois de uma volta pelo localStorage (JSON.stringify vira não-finito em
// null) sobra `custoTotal: null` e `custos.estrutura: 1e+308` — ainda quebrado,
// e agora sem nem parecer.
//
// Esse benchmark vira RÉGUA de outras festas. Numa "Marfim de outubro"
// COMPLETAMENTE SÃ (custo R$ 29 mil), medido nas duas telas de comparação:
//
//   aba Cenários › Comparação com eventos passados
//       Custo total ....... Marfim de outubro R$ 29 mil  ×  Brisa quebrada R$ 0
//       Estrutura & Ceno .. Previsão R$ 20 mil × Brisa quebrada R$ 1000…000
//                           (367 caracteres de número numa célula de tabela)
//   aba Custos › Referências
//       A&B ............... Brisa quebrada R$ 3 mil
//       Estrutura ......... Brisa quebrada R$ 1000…000 (323 caracteres)
//
// Aviso nas duas: NENHUM. A festa sã passa a ser comparada contra uma régua
// que diz "aquela festa custou R$ 0" — e quem lê decide em cima disso.
//
// Duas coisas separadas, e as duas são precisas:
//   1. FECHAR A PORTA — não deixar a promoção GRAVAR a corrupção. Ela faz
//      duas perguntas: os custos da festa (`motivoNaoPromover`) e o benchmark
//      já montado (`motivoBenchmarkQuebrado`, 05/10/2026 — antes disso uma
//      receita ou um Pix de 1e308 passavam). Ela fecha SÓ a promoção: o
//      importador de planilha e o backup JSON continuam podendo trazer
//      benchmark quebrado (ver 2).
//   2. AVISAR NA COMPARAÇÃO — a porta não limpa o que JÁ está salvo, e ela não
//      é a única entrada: o importador de planilha e o backup JSON também
//      criam benchmark, e nenhum dos dois tem teto para dinheiro.

/**
 * Campos de dinheiro de um benchmark que não cabem na régua de centavos.
 *
 * Ausente (`null`/`undefined`/`''`) NÃO é quebrado: os quatro embutidos usam
 * `null` de propósito para categoria sem valor e para "Brisa 05/12" sem
 * receita e sem lucro. Só é acusado o campo PRESENTE que deixa de ser número
 * ao virar centavos.
 */
export function benchmarkQuebrado(bm) {
  const campos = []
  for (const [rotulo, v] of [
    ['custo total', bm?.custoTotal],
    ['receita', bm?.receita],
    ['lucro', bm?.lucro],
    ['ticket médio', bm?.ticketMedio],
    ...CAT_KEYS.map((k) => [CAT_LABELS[k], bm?.custos?.[k]]),
  ]) {
    if (!cabeComoDinheiro(v)) campos.push(rotulo)
  }
  // A soma das categorias também tem de caber: duas categorias de 10^306 cabem
  // cada uma, a soma não — e é a soma que a barra da comparação desenha.
  const soma = CAT_KEYS.reduce((s, k) => s + (Number(bm?.custos?.[k]) || 0), 0)
  const somaNaoCabe = !Number.isFinite(soma * 100)
  return {
    nome: String(bm?.nome || '').trim() || BENCHMARK_SEM_NOME,
    campos,
    somaNaoCabe,
    ha: campos.length > 0 || somaNaoCabe,
  }
}

/** Os benchmarks quebrados de uma lista já montada (benchmarksAtivos e afins). */
export const benchmarksQuebrados = (lista) =>
  (Array.isArray(lista) ? lista : []).map(benchmarkQuebrado).filter((b) => b.ha)

// ===========================================================================
// O PÚBLICO DE UMA REFERÊNCIA (07/10/2026, S1 do BACKLOG "Público inválido de
// referência aparece como “0 pessoas” no relatório")
// ===========================================================================
//
// MEDIDO na base `abbaa68`, com um benchmark próprio e com o override de um
// embutido, público gravado como "ilegível", "1.2.3" ou um objeto:
//
//   Relatório › cabeçalho da comparação ..... "0 pessoas"
//   Cenários › Comparação, "Por pessoa" ..... "R$ 0"
//   Custos › Referências da categoria ....... "(R$ 0/pessoa)"
//   tela inicial › coluna Público ........... "0"
//   Editar benchmarks › campo Público ....... "0" (o original sumia da vista)
//
// Com 1e308: 309 dígitos de "pessoas" no cabeçalho e "R$ 0" por pessoa. Com −5:
// "-5 pessoas" e "-R$ 8.400" por pessoa. Nenhuma faixa em nenhum dos casos.
//
// Nenhuma porta de benchmark tem régua de público: nem o backup (a migração
// não policia faixa de benchmark, decisão datada — ver `migrarBenchmark`), nem
// o campo do "Editar" (decisão datada "idem benchmark" no inventário de portas
// de dinheiro: o `min="0"` dele é atributo solto, o NumInput não o aplica).
// Então é a LEITURA DE EXIBIÇÃO, aqui, que diz o que a tela pode mostrar. Esta leitura NÃO muda
// o valor guardado: ele fica no store e no backup como veio, e o campo de
// edição mostra o original até o Marco digitar outro.
//
// Os quatro estados, e a regra de cada um:
//   ausente  — '' / null / undefined. "Ninguém anotou" (os embutidos usam null
//              de propósito). A tela segue escrevendo "—", como sempre.
//   zero     — o número 0 (ou o texto "0"). A tela segue escrevendo "—" e não
//              divide por ele, como sempre. O texto "0" passava antes como
//              "0 pessoas" e dividia por zero ("R$ 0" por pessoa): agora é lido
//              como o zero que é.
//              O texto " " (só espaço) também é lido como zero: "—", sem
//              aviso (antes "0 pessoas").
//   valido   — número INTEIRO de 1 a 100.000.000, a régua de quantidade do app
//              (FAIXA_QUANTIDADE, sem repetir o número aqui): tudo como antes.
//   ilegivel — qualquer outra coisa: texto que não é número, objeto, array,
//              booleano, NaN, infinito, NEGATIVO (dividir por ele inverte o
//              sinal do custo por pessoa), FRACIONÁRIO (0,4 ou 400,5 pessoas)
//              e ACIMA de 100.000.000 (1e306 dividia o custo e imprimia
//              "R$ 0" por pessoa). Fracionário e acima do teto: decisão do
//              Marco, 07/10/2026, por questionário. A régua do #98
//              (`cabeComoDinheiro`) fica contida nesta, que é mais estreita.
export const ESTADO_PUBLICO = { AUSENTE: 'ausente', ZERO: 'zero', VALIDO: 'valido', ILEGIVEL: 'ilegivel' }

/** O que o cabeçalho escreve no lugar de "N pessoas" quando o público é ilegível. */
export const PUBLICO_ILEGIVEL = `público: ${VALOR_ILEGIVEL}`

/** Leitura do público de uma referência — `{ estado, valor }`; `valor` só no válido. */
export function publicoDaReferencia(bm) {
  const v = bm?.publico
  if (v === '' || v === null || v === undefined) return { estado: ESTADO_PUBLICO.AUSENTE }
  if (typeof v !== 'number' && typeof v !== 'string') return { estado: ESTADO_PUBLICO.ILEGIVEL }
  const n = Number(v)
  if (n === 0) return { estado: ESTADO_PUBLICO.ZERO }
  // NaN e ±infinito não são inteiros: `Number.isInteger` já os recusa (um
  // `Number.isFinite` antes dele era atalho — a mutação que o tirava
  // sobrevivia; tirado em 07/10/2026).
  if (!Number.isInteger(n) || n < FAIXA_QUANTIDADE.min || n > FAIXA_QUANTIDADE.max)
    return { estado: ESTADO_PUBLICO.ILEGIVEL }
  return { estado: ESTADO_PUBLICO.VALIDO, valor: n }
}

/** Atalho: o público desta referência está gravado, mas o app não consegue lê-lo. */
export const publicoIlegivel = (bm) => publicoDaReferencia(bm).estado === ESTADO_PUBLICO.ILEGIVEL

/** As referências de uma lista cujo público é ilegível, com o nome que a faixa usa. */
export const referenciasComPublicoIlegivel = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .filter(publicoIlegivel)
    .map((bm) => ({ nome: String(bm?.nome || '').trim() || BENCHMARK_SEM_NOME, original: bm.publico }))

/** O original como texto, para "Valor guardado: …" (objeto vira JSON, como no Fechamento). */
export const textoPublicoGuardado = (v) =>
  typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)

/**
 * O PORTÃO DA PROMOÇÃO: por que esta festa não pode virar régua — ou `null`
 * quando pode.
 *
 * Recusar é a escolha desta frente, e a razão é a assimetria de estrago:
 * recusar custa ao Marco corrigir um custo e clicar de novo; deixar passar
 * grava um número que não é dinheiro dentro de um dado SALVO, que a partir dali
 * entra calado na comparação de todas as outras festas. Não existe "desfazer a
 * régua" — o benchmark promovido não é recalculado nunca (é essa a restrição
 * dura do Marco em `montarBenchmarkDeEvento`), então o erro fica.
 *
 * A recusa segue a forma que a promoção JÁ tem para o outro portão
 * (MOTIVO_SEM_BILHETERIA_REALIZADA, decisão 5 do Marco de 20/07/2026): texto em
 * português, dito antes de qualquer confirmação, nomeando o que falta.
 *
 * Ela NÃO muda `montarBenchmarkDeEvento` (arquivo do portão do golden) nem
 * nenhuma conta: é uma pergunta a mais, feita antes.
 */
export function motivoNaoPromover(evento) {
  const { itens, ha } = custosQuebrados(evento)
  if (!ha) return null
  const nome = String(evento?.nome || '').trim() || 'esta festa'
  // DUAS FRASES CURTAS — o que houve e o que fazer (05/10/2026). A versão de
  // 26/07 tinha três parágrafos e 653 caracteres; num toast eles perdiam as
  // quebras de linha e viravam um bloco que ninguém lê em 20 s (revisão
  // adversarial do PR #98). O "por quê" (a régua das outras festas) mora aqui
  // no código e na faixa da comparação; a recusa diz o essencial.
  const MAX_NOMES = 3
  const nomes = itens.slice(0, MAX_NOMES).map(nomeDoItem).join(', ')
  const resto = itens.length - MAX_NOMES
  const oQue =
    itens.length === 0
      ? 'a soma dos custos não cabe numa conta de dinheiro'
      : itens.length === 1
        ? `o custo ${nomes} não cabe numa conta de dinheiro`
        : `${itens.length} custos não cabem numa conta de dinheiro (${nomes}${resto > 0 ? ` e mais ${resto}` : ''})`
  // O RISCO VOLTOU (05/10/2026, 2ª revisão do PR #98, item S4): a versão curta
  // tinha perdido "reabrir descarta a fotografia". O benchmark sai do CADASTRO
  // (`montarBenchmarkDeEvento`), não da foto — então o caminho é mesmo reabrir,
  // corrigir e fechar de novo, e quem lê precisa saber o preço antes. Isso não
  // contradiz o "não reabra por causa deste aviso" da aba Fechamento: lá o
  // aviso é sobre o número da foto, que vale; aqui é sobre promover.
  return `Não dá para promover “${nome}” a benchmark: ${oQue}. Para promover, reabra na aba Fechamento, corrija o custo e feche de novo — reabrir descarta a fotografia atual (o desfazer devolve).`
}

/**
 * A SEGUNDA PERGUNTA DA PORTA: o benchmark JÁ MONTADO cabe na régua?
 *
 * `motivoNaoPromover` só olha os custos. Revisão adversarial do PR #98
 * (05/10/2026): com o Pix líquido em 1e308 (a migração aceita, #95) ou a
 * bilheteria realizada em 1e308, ela devolvia null e o benchmark era gravado
 * com receita e lucro 1e308 ou NaN — a mesma régua quebrada, entrando pela
 * receita. Esta pergunta é feita sobre o objeto que IA ser gravado, com a
 * mesma régua que a faixa da comparação usa (`benchmarkQuebrado`), então
 * qualquer campo novo que um dia entre no benchmark fica coberto.
 *
 * Devolve a recusa em duas frases (o que houve, o que fazer) ou null.
 */
export function motivoBenchmarkQuebrado(evento, bm) {
  const q = benchmarkQuebrado(bm)
  if (!q.ha) return null
  const nome = String(evento?.nome || '').trim() || 'esta festa'
  const oQue =
    q.campos.length > 0
      ? `${q.campos.join(', ')} não ${q.campos.length === 1 ? 'caberia' : 'caberiam'} numa conta de dinheiro`
      : 'a soma dos custos não cabe numa conta de dinheiro'
  // Mesmo formato e mesmo preço da primeira recusa (05/10/2026).
  return `Não dá para promover “${nome}” a benchmark: ${oQue}. Para promover, reabra na aba Fechamento, corrija o realizado e feche de novo — reabrir descarta a fotografia atual (o desfazer devolve).`
}

const nomeDoItem = (i) => `“${i.servico}”${i.categoria ? ` (${i.categoria})` : ''}`
