// VERSÃO PÚBLICA (17/11/2026): os quatro benchmarks embutidos abaixo, os nomes
// de festas e marcas e os "casos reais" citados em comentários e testes foram
// trocados por valores e nomes FICTÍCIOS, preservando as relações que os testes
// conferem (somas, diferenças de R$ 1, sinal do lucro). Nenhum número aqui é de
// evento real.
//
// Benchmarks — eventos passados usados como referência de comparação.
// Os fixos vêm embutidos; edições do usuário ficam em store.benchmarkOverrides
// e podem ser restauradas ao padrão. Nunca aparecem na lista de eventos.
//
// Gestão pelo Marco (Sessão de Gestão de Benchmarks, 19/07/2026 — princípio 3
// do CLAUDE.md ampliado com aval explícito e datado do Marco). O dono pode
// EDITAR (já podia), APAGAR e SALVAR-COMO-PADRÃO um benchmark embutido, sempre
// com aviso + snapshot + desfazer (princípio 7) e com os VALORES DE FÁBRICA
// (FIXED_BENCHMARKS, aqui no código) sempre recuperáveis. O que continua
// imutável é a mudança AUTOMÁTICA/SILENCIOSA: nenhum refactor, migração ou
// sessão de IA mexe nesses números sozinho. Três camadas no store, todas
// ADITIVAS e reversíveis, e nenhuma delas apaga o dado de fábrica do código:
//   • benchmarkOverrides[id] — edição por cima da base (marca "editado").
//   • benchmarksPadrao[id]    — base ADOTADA pelo Marco ("salvar como padrão");
//                               vira a nova base; a fábrica segue no código.
//   • benchmarksApagados      — IDs de embutidos apagados de TUDO (some da lista
//                               também); "restaurar apagado"/"de fábrica" volta.

import { uid, num } from './util.js'
import { REGUA_PAGANTES } from './reguaTicket.js'

export const CAT_KEYS = ['aeb', 'locacao', 'estrutura', 'equipe', 'artistico', 'marketing', 'extras']

export const CAT_LABELS = {
  aeb: 'A&B',
  locacao: 'Locação & Doc',
  estrutura: 'Estrutura & Ceno',
  equipe: 'Equipe',
  artistico: 'Artístico',
  marketing: 'Marketing',
  extras: 'Extras & Conting.',
}

export const FIXED_BENCHMARKS = [
  {
    id: 'bm-cordel',
    nome: 'Festa do Cordel',
    publico: 400,
    custos: { aeb: 16420, locacao: 5500, estrutura: 41250, equipe: 6180, artistico: 15300, marketing: null, extras: null },
    custoTotal: 84650,
    receita: 118740,
    ticketMedio: 297,
    lucro: 32140,
  },
  {
    id: 'bm-brisa-1205',
    nome: 'Brisa 05/12',
    publico: null,
    custos: { aeb: 35210, locacao: 17400, estrutura: 76830, equipe: 24590, artistico: 1000, marketing: null, extras: 2860 },
    custoTotal: 157891,
    receita: null,
    ticketMedio: null,
    lucro: null,
  },
  {
    id: 'bm-marfim-0905',
    nome: 'Marfim 09/05',
    publico: 1500,
    custos: { aeb: 58420, locacao: 43150, estrutura: 108760, equipe: 71280, artistico: 21940, marketing: null, extras: 29870 },
    custoTotal: 333419,
    receita: 336150,
    ticketMedio: 164,
    lucro: -6480,
  },
  {
    id: 'bm-brisa-1403',
    nome: 'Brisa 14/03/26',
    publico: null,
    custos: { aeb: 27340, locacao: 20000, estrutura: 13980, equipe: 18260, artistico: 26000, marketing: 7380, extras: null },
    custoTotal: 112959,
    receita: 186420,
    ticketMedio: null,
    lucro: 73461,
    obs: 'A&B inclui CMV de consignados (R$ 10.830). Marketing (R$ 7.380) = patrocínios/designer/filmmaker. Equipe inclui staff de bar/segurança/limpeza (R$ 10.960).',
  },
]

export const somaCustos = (custos) => CAT_KEYS.reduce((s, k) => s + (custos?.[k] || 0), 0)

// ------------------------------------------------- etiqueta "sem reserva"
// (Decisão 3 do Marco, 20/07/2026.) Um benchmark PROMOVIDO de um fechamento
// grava o dinheiro que mudou de mão e NÃO carrega reserva de contingência —
// reserva não é despesa. Os 4 embutidos, medidos de planilhas fechadas,
// carregam a reserva DENTRO das categorias (a categoria se chama literalmente
// "Extras & Conting."; Marfim 09/05 leva R$ 29.870 ali).
//
// Sem dizer isso na tela, o promovido parece simplesmente MAIS BARATO que os
// históricos, e a diferença some na comparação lado a lado — que é justamente
// para onde o benchmark existe. Por isso a etiqueta mora aqui, ao lado dos
// dados, e aparece em TODA superfície de comparação, não só onde ele é criado.
//
// `semReserva` só existe em benchmark promovido DEPOIS de 20/07/2026 — os
// antigos e os importados de planilha não têm o campo e não ganham etiqueta,
// que é o comportamento certo: ninguém sabe o que havia dentro deles.
export const ETIQUETA_SEM_RESERVA = 'sem reserva'

export const EXPLICACAO_SEM_RESERVA =
  'Promovido de um fechamento: soma o dinheiro que mudou de mão e não inclui reserva de contingência. Os benchmarks históricos embutidos carregam a reserva dentro das categorias (em "Extras & Conting."), então o promovido tende a parecer mais barato na comparação.'

export const temSemReserva = (b) => b?.semReserva === true

/**
 * Aplica uma edição do usuário (override) sobre um benchmark fixo.
 * O custo total é recalculado a partir das categorias resultantes.
 */
export function aplicarOverride(bm, ov) {
  if (!ov) return bm
  const custos = { ...bm.custos, ...(ov.custos || {}) }
  return { ...bm, ...ov, custos, custoTotal: somaCustos(custos), editado: true }
}

/**
 * BASE de um benchmark embutido: o padrão ADOTADO pelo Marco
 * (store.benchmarksPadrao[id]), se houver; senão os valores de FÁBRICA
 * (FIXED_BENCHMARKS). Nunca marca "editado" — a base é a base; edição é o
 * override por cima. Mescla sobre a fábrica para que qualquer campo ausente no
 * padrão salvo caia no valor de fábrica (defensivo), e recalcula o custo total.
 */
export function benchmarkBase(fixo, store) {
  const salvo = store?.benchmarksPadrao?.[fixo.id]
  if (!salvo) return fixo
  const custos = { ...fixo.custos, ...(salvo.custos || {}) }
  const base = { ...fixo, ...salvo, custos, custoTotal: somaCustos(custos) }
  delete base.editado
  return base
}

/** IDs de embutidos apagados de tudo (saneado: só strings). */
export const benchmarksApagadosIds = (store) =>
  Array.isArray(store?.benchmarksApagados)
    ? store.benchmarksApagados.filter((id) => typeof id === 'string')
    : []

// `store` = { benchmarksCustom, benchmarkOverrides, benchmarksOcultos,
//             benchmarksPadrao, benchmarksApagados }
// Lista COMPLETA (inclui os ocultos, exclui os APAGADOS) — uso interno e telas
// de gestão (BenchmarksEditor, seção Benchmarks dos Ajustes). Telas de
// comparação e referência usam benchmarksVisiveis/benchmarksAtivos abaixo.
export const benchmarksDisponiveis = (store) => {
  const apagados = new Set(benchmarksApagadosIds(store))
  return [
    ...FIXED_BENCHMARKS.filter((b) => !apagados.has(b.id)).map((b) =>
      aplicarOverride(benchmarkBase(b, store), store?.benchmarkOverrides?.[b.id])
    ),
    ...(store?.benchmarksCustom || []).filter((b) => !apagados.has(b.id)),
  ]
}

// ---------------------------------------------------- ocultos (sugestão 25)
// "Ocultar das comparações" é REVERSÍVEL e aditivo (Sessão Q — pedido do
// Marco em 18→19/07/2026, desenho acordado: ocultar, não deletar): a lista
// `store.benchmarksOcultos` guarda só IDs — nenhum número é alterado nem
// apagado, e os 4 benchmarks embutidos continuam imutáveis (princípio 3 do
// rulebook). Backup antigo sem a chave abre normalmente (= nada oculto).

export const benchmarksOcultosIds = (store) =>
  Array.isArray(store?.benchmarksOcultos)
    ? store.benchmarksOcultos.filter((id) => typeof id === 'string')
    : []

/** Benchmarks que aparecem nas telas de comparação/referência (todos − ocultos). */
export const benchmarksVisiveis = (store) => {
  const ocultos = new Set(benchmarksOcultosIds(store))
  return benchmarksDisponiveis(store).filter((b) => !ocultos.has(b.id))
}

/** Benchmarks ocultos, na forma completa (para a lista dos Ajustes). */
export const benchmarksOcultosLista = (store) => {
  const ocultos = new Set(benchmarksOcultosIds(store))
  return benchmarksDisponiveis(store).filter((b) => ocultos.has(b.id))
}

/** Oculta um benchmark das comparações (idempotente; nada além do ID muda). */
export const ocultarBenchmark = (store, id) =>
  benchmarksOcultosIds(store).includes(id)
    ? store
    : { ...store, benchmarksOcultos: [...benchmarksOcultosIds(store), id] }

/** Mostra de novo um benchmark oculto (idempotente). */
export const mostrarBenchmark = (store, id) => ({
  ...store,
  benchmarksOcultos: benchmarksOcultosIds(store).filter((x) => x !== id),
})

/**
 * Exclui de verdade um benchmark CUSTOM (os embutidos não passam por aqui —
 * eles não podem ser excluídos, só ocultados). Limpa o id da lista de
 * ocultos junto, para não sobrar id órfão no store.
 */
export const excluirBenchmarkCustom = (store, id) => ({
  ...store,
  benchmarksCustom: (store.benchmarksCustom || []).filter((b) => b.id !== id),
  benchmarksOcultos: benchmarksOcultosIds(store).filter((x) => x !== id),
})

// -------------------------------------- apagar / salvar-como-padrão (Sessão de
// Gestão de Benchmarks, 19/07/2026). Tudo reversível; a FÁBRICA nunca some do
// código, e nenhuma dessas funções muda um número em silêncio — cada uma é
// disparada por um clique do Marco, com snapshot + desfazer na UI.

/**
 * Apaga um benchmark EMBUTIDO de TUDO (some da lista do editor também, mais
 * forte que ocultar). Não remove o dado de fábrica — só adiciona o id à lista
 * de apagados. Idempotente. Os importados (custom) não passam por aqui: eles
 * têm exclusão de verdade (excluirBenchmarkCustom).
 */
export const apagarBenchmarkEmbutido = (store, id) =>
  benchmarksApagadosIds(store).includes(id)
    ? store
    : { ...store, benchmarksApagados: [...benchmarksApagadosIds(store), id] }

/** Traz de volta um embutido apagado (desfazer/restaurar). Idempotente. */
export const restaurarBenchmarkApagado = (store, id) => ({
  ...store,
  benchmarksApagados: benchmarksApagadosIds(store).filter((x) => x !== id),
})

/** Embutidos apagados, na forma completa (base + override) — para a UI listar. */
export const benchmarksApagadosLista = (store) => {
  const apagados = new Set(benchmarksApagadosIds(store))
  return FIXED_BENCHMARKS.filter((b) => apagados.has(b.id)).map((b) =>
    aplicarOverride(benchmarkBase(b, store), store?.benchmarkOverrides?.[b.id])
  )
}

/** Este embutido tem um "padrão" adotado pelo Marco (base ≠ fábrica)? */
export const benchmarkTemPadraoSalvo = (store, id) =>
  Boolean(store?.benchmarksPadrao?.[id])

/**
 * SALVAR COMO PADRÃO: adota os valores editados atuais como a NOVA BASE do
 * embutido. O override some (não há mais divergência → "editado" some com
 * verdade); "Restaurar padrão" passa a restaurar para ESSES valores. A âncora
 * de fábrica (FIXED_BENCHMARKS) continua no código, recuperável por
 * restaurarBenchmarkFabrica. No-op se o id não é embutido.
 */
export const salvarBenchmarkComoPadrao = (store, id) => {
  const fixo = FIXED_BENCHMARKS.find((b) => b.id === id)
  if (!fixo) return store
  const atual = aplicarOverride(benchmarkBase(fixo, store), store?.benchmarkOverrides?.[id])
  const novoPadrao = { ...atual }
  delete novoPadrao.editado
  const overrides = { ...(store.benchmarkOverrides || {}) }
  delete overrides[id]
  return {
    ...store,
    benchmarksPadrao: { ...(store.benchmarksPadrao || {}), [id]: novoPadrao },
    benchmarkOverrides: overrides,
  }
}

/**
 * RESTAURAR PADRÃO: limpa só o override → volta à base (padrão salvo, se houver;
 * senão fábrica). É a ação que já existia no editor, centralizada aqui.
 */
export const restaurarBenchmarkPadrao = (store, id) => {
  const overrides = { ...(store.benchmarkOverrides || {}) }
  delete overrides[id]
  return { ...store, benchmarkOverrides: overrides }
}

/**
 * RESTAURAR VALORES DE FÁBRICA: limpa o padrão salvo E o override — a âncora
 * histórica (FIXED_BENCHMARKS) volta inteira. Rede de segurança mais funda.
 */
export const restaurarBenchmarkFabrica = (store, id) => {
  const overrides = { ...(store.benchmarkOverrides || {}) }
  delete overrides[id]
  const padroes = { ...(store.benchmarksPadrao || {}) }
  delete padroes[id]
  return { ...store, benchmarkOverrides: overrides, benchmarksPadrao: padroes }
}

export const benchmarksAtivos = (evento, store) => {
  // Visíveis apenas: benchmark oculto some de TODAS as telas de comparação,
  // mesmo que ainda esteja em evento.benchmarksAtivos (o campo do evento não
  // é tocado — mostrar de novo devolve tudo como era).
  const todos = benchmarksVisiveis(store)
  const ativos = evento.benchmarksAtivos
  if (!Array.isArray(ativos)) return todos
  return todos.filter((b) => ativos.includes(b.id))
}

// Genérico: valor dividido pelo público-base. Usado pelos benchmarks
// (porPessoa) e generalizado para DRE/Custos na sugestão 8 do MELHORIAS.md —
// mesma conta, uma fonte só.
export const divPorPessoa = (valor, publico) =>
  publico && valor != null ? valor / publico : null

export const porPessoa = (bm, valor) => divPorPessoa(valor, bm.publico)

/**
 * Benchmark nascido de uma PLANILHA importada (ImportModal). Estava escrito
 * dentro do componente; veio para cá inteiro, sem uma vírgula de conta mudada,
 * por dois motivos: componente não faz conta (regra de código do rulebook), e o
 * que mora no componente não tem como ser provado rodando.
 *
 * A RÉGUA DO TICKET aqui é `receita ÷ ingressos PAGOS` — o denominador exclui
 * cortesia, e é diferente tanto de `receita ÷ público` quanto de
 * `bilheteria bruta ÷ público`. Ela é gravada (`reguaTicket`) porque é
 * INDEDUZÍVEL depois: o número de pagos não vai para o store, então nenhuma
 * conta sobre o benchmark salvo conseguiria reconhecê-la (decisão 6 do Marco,
 * 25/07/2026). `bilheteriaBruta` NÃO é gravada de propósito — a planilha não
 * separa bilheteria de receita, e repetir `receita` sob outro nome criaria uma
 * segunda fonte da mesma grandeza.
 */
/**
 * Consolida as somas por categoria de uma planilha importada no par
 * `{ custos, custoTotal }` que o benchmark grava.
 *
 * POR QUE ISTO EXISTE, e por que fora do componente (Marco, 27/07/2026 — decisão
 * por questionário, "usar a régua que você já aprovou"). Até hoje esta conta
 * morava dentro do ImportModal.jsx, e a régua dela era `soma > 0 ? soma : null`
 * enquanto o total somava a mesma parcela sem filtro. Com uma categoria de saldo
 * NEGATIVO (estorno, reembolso de campanha — o parseMoney aceita "(5.000,00)" e
 * "−500"), a categoria sumia da lista e o dinheiro dela continuava dentro do
 * `custoTotal`. Medido em 27/07/2026 com os módulos de verdade: A&B R$ 10.000 e
 * MARKETING líquido −R$ 3.000 gravavam `custoTotal` R$ 7.000 com as categorias
 * visíveis somando R$ 10.000 — R$ 3.000 que a foto afirma e não mostra. E nenhuma
 * leitura recalcula esse total; ele é impresso como está, inclusive no R$/pessoa
 * dos chips de comparação.
 *
 * A RÉGUA É A MESMA DO FECHAMENTO (`fechamento.js:256`), palavra por palavra, e
 * de propósito: o Marco já a aprovou em 26/07/2026 para o caminho da promoção, e
 * duas réguas para a mesma decisão foi como este defeito nasceu. Ela pergunta
 * "sobra algum centavo?" em vez de "é maior que zero?" — então categoria zerada
 * até o centavo some (é ruído, não informação) e categoria negativa FICA, com o
 * sinal dela. O valor guardado não é arredondado: o `Math.round(× 100)` decide
 * apenas se a categoria some, nunca mexe no número de quem tem dinheiro real.
 *
 * Mora aqui, e não no componente, pelo mesmo par de motivos do
 * `montarBenchmarkDePlanilha` logo abaixo: componente não faz conta (regra de
 * código do rulebook), e o que mora no componente não tem como ser provado
 * rodando — foi exatamente por ficar lá que esta régua envelheceu sozinha
 * enquanto a irmã dela era corrigida.
 *
 * @param somasPorCategoria mapa categoria → soma já calculada dos itens dela.
 * @returns `{ custos, custoTotal }` — custoTotal é a soma CRUA de todas as
 *   categorias (inclusive as que viraram null por serem zero), porque o total
 *   tem de continuar batendo com o que se vê.
 */
export function consolidarCustosDePlanilha(somasPorCategoria) {
  const custos = {}
  let custoTotal = 0
  for (const k of CAT_KEYS) {
    const soma = num(somasPorCategoria?.[k])
    custos[k] = soma
    custoTotal += soma
  }
  for (const k of CAT_KEYS) if (Math.round(num(custos[k]) * 100) === 0) custos[k] = null
  return { custos, custoTotal }
}

export function montarBenchmarkDePlanilha({ nome, publico, custos, custoTotal, receita, pagos }) {
  return {
    id: uid(),
    nome: nome || 'Evento importado',
    custom: true,
    publico: publico || null,
    custos,
    custoTotal,
    receita: receita > 0 ? receita : null,
    ticketMedio: receita > 0 && pagos > 0 ? receita / pagos : null,
    lucro: receita > 0 ? receita - custoTotal : null,
    reguaTicket: REGUA_PAGANTES,
  }
}

/**
 * Transforma o resultado de computeCenario (cenário realista) de OUTRA
 * previsão num "pseudo-benchmark" — mesma forma de FIXED_BENCHMARKS, só para
 * reusar HBars sem componente paralelo (sugestão 7, Sessão J). Descartável:
 * nada aqui é gravado em nenhum store, é um reshape refeito a cada render a
 * partir do cenário já calculado — nenhuma fórmula nova.
 */
export function pseudoBenchmarkDeCenario(nome, cenarioRealista) {
  const custos = {}
  for (const cat of cenarioRealista.custosCategorias || []) {
    if (CAT_KEYS.includes(cat.id)) custos[cat.id] = cat.considerado
  }
  return {
    id: 'comparacao-previsao',
    nome,
    publico: cenarioRealista.publico,
    custos,
    custoTotal: cenarioRealista.custoTotal,
    receita: cenarioRealista.receitaTotal,
    ticketMedio: cenarioRealista.ticketMedio,
    lucro: cenarioRealista.lucro,
  }
}

/**
 * O lucro GRAVADO do benchmark fecha com receita − custo total?
 *
 * (Marco, 27/07/2026 — decisão por questionário: "avisar na tela, nunca
 * recalcular".) Ele abriu o editor de benchmarks e disse "os valores não tão
 * somando direito". O custo total somava certo; quem não fechava era o LUCRO.
 *
 * POR QUE ACONTECE: `aplicarOverride` recalcula `custoTotal` a partir das
 * categorias, e o `lucro` é campo digitado à parte — editar uma categoria muda
 * o total e deixa o lucro parado. A tela mostrava os três como fato.
 *
 * MEDIDO nos dados dele, 2 dos 4 benchmarks:
 *   Marfim 09/05/26  receita 336.150 − custo 333.420 = +2.730, lucro diz −6.480
 *   Brisa 14/03/26  diferença de R$ 1 (arredondamento)
 * O da Marfim INVERTE O SINAL: as categorias dizem lucro, o campo diz prejuízo.
 *
 * POR QUE NÃO RECALCULAR, que era a opção mais fácil: o lucro gravado pode ser
 * a verdade histórica da festa, com dinheiro que não está nas sete categorias.
 * Recalcular reescreveria o resultado de um evento passado — exatamente o que o
 * princípio 3 do rulebook proíbe. Avisar não destrói nada; só para de fingir.
 *
 * Devolve null quando não há o que conferir (falta receita ou lucro) ou quando
 * fecha até o centavo; senão `{ esperado, diferenca }`.
 */
export function lucroNaoFecha(bm) {
  if (bm?.lucro == null || bm?.receita == null) return null
  const esperado = num(bm.receita) - num(bm.custoTotal)
  const diferenca = num(bm.lucro) - esperado
  // meio centavo, a mesma tolerância das outras conferências da casa
  if (Math.abs(diferenca) <= 0.005) return null
  return { esperado, diferenca }
}
