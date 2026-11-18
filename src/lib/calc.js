// Funções puras de cálculo. Todas as telas derivam destes números —
// nenhum valor é digitado duas vezes.

import { num, somaCentavos, emCentavos, somaEmCentavos, cabeEmCentavos, arredondarCentavos } from './util.js'
import { liquidaDeBruta } from './receitaLiquida.js'
// Imposto sobre a receita (Marco, 27/07/2026 — desenho aprovado por
// questionário). A REGRA mora em imposto.js, fora deste arquivo, de propósito:
// aqui entra só o passo do DRE que ele decidiu — deduzir da receita ANTES do
// lucro. Ver o cabeçalho de imposto.js para as quatro decisões e os números
// medidos que as sustentam.
import { impostoDoCenario } from './imposto.js'

// PREÇO AUSENTE NÃO É CORTESIA (P8 — direção do Marco em 05/09/2026; diff
// aprovado em 06/10/2026, ficha "S1 — P8" do BACKLOG.md). Ausente é o campo
// vazio: '', null ou undefined. Lote assim fica FORA de todo cenário — nem
// pagante, nem cortesia, nem pessoa no bar —, mesmo com ajuste manual, até ter
// preço. Preço 0 DECLARADO (0 ou '0') continua cortesia. Texto ilegível no
// preço não é ausente: é dado quebrado, e quem avisa é dadoQuebrado.js (#98).
export const isPrecoAusente = (lote) =>
  lote.valor === '' || lote.valor === null || lote.valor === undefined
export const isCortesia = (lote) => !isPrecoAusente(lote) && num(lote.valor) === 0

// ---------------------------------------------------------------- cenários

/**
 * Quantidade de ingressos de um lote em um cenário.
 * A quantidade preenchida no lote é o TAMANHO do lote (esgotado);
 * cada cenário aplica seu % de venda sobre ela.
 * Prioridade: override manual > regra do cenário.
 * - otimista: vendaPct do otimista (default 100% = esgota tudo, INCLUINDO os
 *   lotes "só no otimista", ex.: Lote Porta — a conta de sempre). Sugestão 19
 *   (grade completa, aprovada em 18/07/2026): com vendaPct < 100, aplica a
 *   MESMA conta dos cenários vizinhos, inclusive sobre os lotes só-otimista.
 * - realista: vendaPct do realista (default 90%)
 * - pessimista: vendaPct do pessimista (default 80%)
 * - cortesias (valor R$ 0 DECLARADO) entram inteiras em todos os cenários
 * - lote com preço AUSENTE vale 0 em todos os cenários, ANTES do override e
 *   da marca "só otimista" (P8, 06/10/2026 — ver isPrecoAusente)
 *
 * ——— PADRÕES 80/90/100 (duas decisões do Marco, 27/07/2026, por questionário,
 * com a lista de impacto evento a evento na frente dele) ———
 *
 * DECISÃO A — o pessimista subiu de 70% para 80%, e vale TAMBÉM para os
 * eventos já salvos em 70 (migração `subirPessimistaPara80` em migracao.js).
 * Impacto medido no dado do Marco: Marfim 09/05/26 −68.410 → −27.530;
 * Marfim Salao Sul (campo vazio) −87.120 → −57.640; Marfim Casa Norte 05/07/25
 * −152.870 → −122.960; Brisa 05/12/25 não muda (benchmark, sem lote).
 *
 * DECISÃO B — o realista parou de discordar de si mesmo. O botão "Voltar ao
 * padrão" e o evento novo sempre disseram 90%, mas ESTE fallback usava 100%
 * quando o campo estava vazio: a tela prometia 90 e a conta entregava 100.
 * Agora é 90 nos dois. Só evento com o campo VAZIO é alcançado — quem tem
 * 100 salvo continua em 100. Impacto medido: Marfim Salao Sul 33.970 → 4.310.
 */
export function loteQtdCenario(lote, cenario, cfg = {}) {
  if (isPrecoAusente(lote)) return 0
  const ov = cfg.overrides?.[cenario]?.[lote.id]
  if (ov !== undefined && ov !== null && ov !== '') return Math.max(0, num(ov))
  const q = Math.max(0, num(lote.quantidade))
  if (cenario === 'otimista') {
    if (isCortesia(lote)) return q
    const pct = num(cfg.otimista?.vendaPct ?? 100)
    // 100% devolve q CRU — o caminho byte a byte idêntico ao de sempre (a
    // conta simétrica arredondaria quantidade fracionária; provado nas
    // fotografias pré/pós da Sessão P). Abaixo de 100, a conta dos vizinhos.
    if (pct === 100) return q
    return Math.round((q * pct) / 100)
  }
  if (lote.somenteOtimista) return 0
  if (isCortesia(lote)) return q
  const pct =
    cenario === 'pessimista'
      ? num(cfg.pessimista?.vendaPct ?? 80)
      : num(cfg.realista?.vendaPct ?? 90)
  return Math.round((q * pct) / 100)
}

// ---------------------------------------------------------------- taxa paga pelo cliente (sugestão 29b)

/**
 * Taxa da bilheteria paga pelo CLIENTE (Sessão F2-R — sugestão 29b; conta
 * aprovada pelo Marco em 19/07/2026): no modo repasse, a taxa NÃO é
 * descontada da receita (o cliente paga o preço final = pós-desconto ×
 * (1 + taxa)); o CASHBACK segue INALTERADO nos dois modos (recebido sobre a
 * receita de ingressos, como sempre).
 *
 * Checagem ESTRITA (mesma filosofia do openBar): só a string exata 'cliente'
 * liga o repasse — ausente, 'nos', true, 'CLIENTE' ou qualquer valor torto
 * de backup editado à mão = "paga por nós" = conta EXATAMENTE atual (nenhum
 * evento existente muda; prova: golden intacto + fotografias byte a byte).
 */
export const isTaxaCliente = (evento) => evento?.taxaPagaPor === 'cliente'

// ---------------------------------------------------------------- receita

/**
 * Bilheteria a partir dos lotes e das quantidades resolvidas ({loteId: qtd}).
 *
 * `descontoPct` — desconto médio nos ingressos (sugestão 17; FÓRMULA APROVADA
 * pelo Marco em 18/07/2026, palavra por palavra):
 *
 *     receita de bilheteria prevista = (lotes × preço) × (1 − desconto médio)
 *
 * Cupons e promoções fazem o valor médio realmente pago ficar abaixo do preço
 * de tabela — sem isso a previsão batia acima da realidade. O fator é aplicado
 * lote a lote (matematicamente idêntico a aplicar no total, e preserva o
 * invariante bruta = Σ porLote). Taxa e cashback agem POR CIMA da receita já
 * descontada, como hoje agem sobre a bruta — a Tiqueteira cobra taxa sobre o que
 * foi de fato pago. Vazio/ausente = 0% = conta EXATAMENTE igual à anterior
 * (×1 é exato em ponto flutuante; provado pelo golden). O REALIZADO não passa
 * por aqui: a Tiqueteira já manda valores líquidos de cupom.
 *
 * `taxaCliente` (sugestão 29b): true = a taxa é paga pelo CLIENTE e NÃO é
 * descontada da líquida (o valor `taxa` continua calculado, para exibição —
 * é o que o cliente paga por fora); o cashback segue inalterado. false
 * (padrão) = conta EXATAMENTE atual.
 */
export function bilheteria(lotes, qtds, taxaPct, cashbackPct = 0, descontoPct = 0, taxaCliente = false) {
  const fatorDesconto = 1 - num(descontoPct) / 100
  let pagos = 0
  let cortesias = 0
  // Acumulação quantizada a centavos (Marco, 25/07/2026 — achado do BACKLOG
  // "a soma de ponto flutuante não é associativa"): cada receita de lote vira
  // centavos inteiros ANTES de entrar na soma corrente, então reordenar os
  // lotes não muda mais o total exibido. Desde 07/10/2026 (régua do centavo,
  // util.js) a própria `receita` do lote sai em centavos — é a parcela que a
  // tabela de lotes imprime, e as parcelas impressas somam a bruta.
  // Taxa, cashback e líquida saem de `liquidaDeBruta` (receitaLiquida.js), a
  // MESMA função que o Fechamento usa: uma régua só.
  let acumuladaCentavos = 0
  const porLote = (lotes || []).map((l) => {
    // P8: lote sem preço não vira pagante nem cortesia, nem quando quem chama
    // esta função exportada passa uma quantidade para ele.
    const qtd = isPrecoAusente(l) ? 0 : num(qtds[l.id])
    const receita = emCentavos(qtd * num(l.valor) * fatorDesconto)
    acumuladaCentavos += cabeEmCentavos(receita) ? arredondarCentavos(receita * 100) : Math.round(receita * 100)
    if (isCortesia(l)) cortesias += qtd
    else pagos += qtd
    return { id: l.id, nome: l.nome, valor: num(l.valor), qtd, receita, acumulada: acumuladaCentavos / 100 }
  })
  // cashback da Tiqueteira: % da receita de ingressos RECEBIDO pela produção
  // (INALTERADO nos dois modos da taxa — regra da sugestão 29b)
  const { bruta, taxa, cashback, liquida } = liquidaDeBruta(acumuladaCentavos / 100, taxaPct, cashbackPct, taxaCliente)
  return {
    porLote,
    bruta,
    taxa,
    cashback,
    liquida,
    pagos,
    cortesias,
    publico: pagos + cortesias,
    ticketMedio: pagos > 0 ? bruta / pagos : 0,
    ticketMedioLiquido: pagos > 0 ? liquida / pagos : 0,
  }
}

// ---------------------------------------------------------------- desconto parcial (sugestão 29a)

/**
 * Desconto EFETIVO nos ingressos, em % (Sessão F2-R — sugestão 29a; CONTA
 * APROVADA pelo Marco em 19/07/2026, palavra por palavra):
 *
 *     desconto efetivo = desconto do cupom × fração com desconto
 *     receita = lotes × preço × (1 − desconto efetivo)
 *
 * Dois modos para a fração (`descontoIngressosModo`):
 * - Modo % (''/'pct', PADRÃO): fração fixa dos vendidos com cupom, a mesma
 *   nos três cenários. `descontoIngressosValor` vazio = 100% = cupom em
 *   todos os ingressos = comportamento EXATAMENTE anterior (cupom × 1 é
 *   exato em ponto flutuante — provado pelo golden intacto e pelas
 *   fotografias byte a byte da sessão). O campo antigo "desconto médio"
 *   equivale a cupom = X, modo %, 100%.
 * - Modo nº ('numero'): nº absoluto de ingressos com cupom;
 *   fração = min(1, nº ÷ vendidos do cenário) — recalculada POR CENÁRIO
 *   (no pessimista os mesmos ingressos com cupom pesam mais).
 *
 * "Vendidos do cenário" = ingressos PAGOS do cenário — cortesias ficam FORA
 * da conta (não são vendidos); lotes "só otimista" só entram nos vendidos do
 * otimista, como sempre. Sem vendidos (pagos ≤ 0) no modo nº: efetivo 0 — a
 * receita é 0 de qualquer forma; evita divisão por zero. Valor vazio no modo
 * nº = cupom em todos (sem nº informado vale o comportamento de sempre; a
 * tela avisa — nada muda em silêncio). nº negativo conta como 0.
 *
 * O ticket médio MANUAL recebe o MESMO desconto efetivo, 1× (regra da
 * Sessão N: manual é preço de tabela; o automático já sai descontado da
 * bilheteria — nunca 2×). Taxa e cashback agem por cima, como sempre.
 * O REALIZADO não passa por aqui: a Tiqueteira já manda valores líquidos.
 */
export function descontoEfetivoPct(evento, pagos) {
  const cupom = num(evento?.descontoMedioPct)
  if (cupom === 0) return 0
  const v = evento?.descontoIngressosValor
  if (v === '' || v == null) return cupom
  if (evento?.descontoIngressosModo !== 'numero') return cupom * (num(v) / 100)
  const p = num(pagos)
  if (p <= 0) return 0
  return cupom * Math.min(1, Math.max(0, num(v)) / p)
}

// ---------------------------------------------------------------- decomposição do ticket (F2-Y — item 4)

/**
 * DISPLAY-ONLY (Sessão F2-Y — item 4 do QA de PDF do Marco): reparte o ticket
 * médio JÁ CALCULADO nas parcelas POR INGRESSO, para a "continha com números
 * reais" do microtexto do relatório. NÃO é conta nova de negócio — só decompõe
 * números que computeCenario/bilheteria já produziram, por identidades EXATAS
 * (divisão da própria identidade da bilheteria por `pagos`):
 *
 *     tabela − cupom = bruto              (tabela = preço de tabela ÷ ingresso)
 *     bruto − taxa + cashback = líquido   (taxa some quando paga pelo cliente)
 *
 * `tabela` desfaz o fator de desconto EFETIVO do cenário (o MESMO que a
 * bilheteria usou: descontoEfetivoPct sobre os pagos do cenário), então
 * tabela − cupom fecha no bruto exibido. Não muda nenhum cenário nem o golden.
 * Sem ingresso pago (pagos ≤ 0) não há "por ingresso" → null.
 */
export function decomposicaoTicket(s, evento) {
  const pagos = num(s?.pagos)
  if (pagos <= 0) return null
  const bruto = num(s.ticketMedio)
  const liquido = num(s.ticketMedioLiquido)
  const taxaCliente = isTaxaCliente(evento)
  const taxaPorIng = taxaCliente ? 0 : num(s.taxa) / pagos
  const cashbackPorIng = num(s.cashback) / pagos
  const ef = descontoEfetivoPct(evento, pagos) / 100
  const temCupom = ef > 0
  const tabela = temCupom && ef < 1 ? bruto / (1 - ef) : bruto
  const cupom = tabela - bruto
  return { bruto, liquido, tabela, cupom, taxaPorIng, cashbackPorIng, taxaCliente, temCupom }
}

// ---------------------------------------------------------------- patrocínio (sugestão 22)

/**
 * Patrocínio por estágio (Sessão O — sugestão 22; regra aprovada pelo Marco em
 * 18/07/2026). Vocabulário IGUAL ao módulo de Patrocínios do Financeiro
 * (CHECK da tabela `patrocinios` de lá): 'proposta' → 'confirmado' →
 * 'recebido'. O "FECHADO" da regra do Marco equivale a confirmado OU recebido
 * (recebido é além de fechado: dinheiro em caixa).
 *
 * - fechado  = Σ valor de confirmado + recebido → ÚNICA parte que entra na
 *   receita dos cenários e, por consequência, no semáforo e no break-even.
 * - potencial = Σ valor de proposta (e de estágio desconhecido, normalizado
 *   pela migração) → aparece nas telas como potencial, NUNCA somado.
 *
 * Evento sem a lista (backup antigo ainda não migrado, testes old-style): o
 * número solto `outrasReceitas.patrocinio` conta INTEIRO como fechado — o
 * comportamento de sempre, nenhum número existente muda (prova: golden intacto
 * + fotografias byte a byte da Sessão O).
 */
export function patrocinioPorEstagio(evento) {
  const lista = evento?.patrocinios
  if (!Array.isArray(lista)) {
    const v = emCentavos(num(evento?.outrasReceitas?.patrocinio))
    return { fechado: v, potencial: 0, total: v }
  }
  const fechados = []
  const propostas = []
  for (const p of lista) {
    const v = emCentavos(num(p?.valor))
    if (p?.estagio === 'confirmado' || p?.estagio === 'recebido') fechados.push(v)
    else propostas.push(v)
  }
  const fechado = somaEmCentavos(fechados)
  const potencial = somaEmCentavos(propostas)
  return { fechado, potencial, total: somaEmCentavos([fechado, potencial]) }
}

// ---------------------------------------------------------------- open bar (sugestão 27)

/**
 * Open bar (Sessão Q — sugestão 27; regra do Marco, 18/07/2026): evento
 * marcado como open bar NÃO tem receita de bar — o bar previsto vale 0 nos
 * três cenários e o fechamento não cobra bar realizado. O CUSTO de bar não
 * muda sozinho (o Marco controla nos Custos, categoria A&B).
 *
 * A checagem é ESTRITA (`=== true`): campo ausente, false, 0, 'true' ou
 * qualquer outra coisa = comportamento EXATAMENTE atual (nenhum evento
 * existente muda — prova: golden intacto + fotografias byte a byte da
 * Sessão Q). A migração (migracao.js) normaliza o campo para booleano.
 */
export const isOpenBar = (evento) => evento?.openBar === true

// ---------------------------------------------------------------- bar por pessoa (sugestão 42)

/**
 * Modo do bar (sugestão 42 — conta cravada e aprovada pelo Marco em
 * 19/07/2026). Dois modos, com seletor por evento:
 * - FIXO (padrão de todo evento existente): `outrasReceitas.bar` é o lucro
 *   líquido, o MESMO nos três cenários — comportamento EXATAMENTE atual.
 * - POR PESSOA ('porPessoa'): por cenário,
 *       consumo = ticket_do_cenário × pessoas_do_cenário
 *       bar_líquido = consumo − (taxa_sistema% × consumo) − custo_sistema
 *   • pessoas = PAGOS + CORTESIAS do cenário (cortesia consome no bar);
 *   • ticket do bar é POR CENÁRIO (consumo por pessoa, NÃO lucro);
 *   • taxa do sistema = % sobre o consumo, a MESMA nos três cenários;
 *   • custo do sistema = R$ fixo por evento, igual nos três.
 *
 * Checagem ESTRITA (mesma filosofia do openBar/taxaPagaPor): só a string
 * exata 'porPessoa' liga o modo novo — ausente, '', 'fixo', 'PORPESSOA',
 * true ou qualquer valor torto de backup editado à mão = modo fixo = conta
 * EXATAMENTE atual (prova: golden intacto + fotografias byte a byte).
 * "Por pessoa é o padrão" vale SÓ para evento NOVO (novoEvento grava
 * barModo: 'porPessoa' explícito); evento salvo nunca muda de modo sozinho.
 * Open bar MANDA em tudo: isOpenBar → bar = 0 em qualquer modo.
 */
export const isBarPorPessoa = (evento) => evento?.barModo === 'porPessoa'

/**
 * A conta do bar POR PESSOA de um cenário, com as parcelas expostas para a
 * "continha com números reais" das telas (régua da F2-Y). `pessoas` vem do
 * chamador (computeCenario passa o público do cenário: pagos + cortesias).
 * Campos vazios valem 0 (evento novo nasce com bar R$ 0, como sempre).
 */
export function barPorPessoa(evento, cenario, pessoas) {
  const ticket = num(evento?.barTicket?.[cenario])
  const p = Math.max(0, num(pessoas))
  const consumo = emCentavos(ticket * p)
  const taxaPct = num(evento?.barTaxaSistemaPct)
  const taxaSistema = emCentavos((consumo * taxaPct) / 100)
  const custoSistema = emCentavos(num(evento?.barCustoSistema))
  return {
    ticket,
    pessoas: p,
    consumo,
    taxaPct,
    taxaSistema,
    custoSistema,
    liquido: somaEmCentavos([consumo, -taxaSistema, -custoSistema]),
  }
}

// ---------------------------------------------------------------- custos

/**
 * "Custou zero" (Marco, aprovado e datado 20/07/2026): marcação EXPLÍCITA de
 * que um item saiu de graça — permuta, cortesia, serviço cancelado depois de
 * orçado. Sem ela, o Marco digita 0 no realizado e a régua abaixo trata o 0
 * como "não preenchido" e volta ao estimado — não havia como REGISTRAR que algo
 * custou zero. A marcação NÃO muda o significado do 0: só cria um jeito de dizer
 * "este item, sim, custou zero".
 *
 * Checagem ESTRITA (`=== true`, mesma filosofia do openBar/taxaPagaPor): campo
 * ausente, false, 'true', 1, 'sim' ou qualquer lixo de backup editado à mão NÃO
 * marca nada. A migração normaliza o campo para booleano (migracao.js).
 *
 * P1 (decisão do Marco, 20/07/2026): a marcação SÓ vale quando o Realizado está
 * VAZIO ou é 0. Com realizado > 0, a marcação é IGNORADA — o realizado digitado
 * vence, e a trava das duas telas (confrontoCustos × projeção) fica intacta.
 */
export const custouZeroEfetivo = (item) =>
  item?.custouZero === true &&
  (item.realizado == null || item.realizado === '' || num(item.realizado) === 0)

/**
 * Valor usado nas projeções: o realizado quando preenchido (> 0); senão, se o
 * item está marcado "custou zero" (custouZeroEfetivo), ZERO; senão o estimado.
 */
export const valorConsiderado = (item) =>
  item.realizado != null && item.realizado !== '' && num(item.realizado) > 0
    ? num(item.realizado)
    : custouZeroEfetivo(item)
      ? 0
      : num(item.estimado)

export function custosPorCategoria(categorias) {
  // Reduces quantizados a centavos (Marco, 25/07/2026 — mesmo achado do
  // BACKLOG da acumulação de bilheteria acima): cada item vira centavos
  // inteiros antes de somar, então reordenar os itens de uma categoria (setas
  // ↑/↓ do CostsTab) não muda mais o total exibido.
  const porCategoria = (categorias || []).map((c) => {
    const itens = c.itens || []
    return {
      id: c.id,
      nome: c.nome,
      estimado: somaCentavos(itens.map((i) => num(i.estimado))),
      realizado: somaCentavos(itens.map((i) => num(i.realizado))),
      considerado: somaCentavos(itens.map((i) => valorConsiderado(i))),
    }
  })
  // O total ENTRE categorias também passa pela régua por parcela (26/07/2026).
  // Cada categoria já sai exata em centavos acima, mas somá-las cru trazia o
  // resíduo de volta: com A&B em 0,10 e Equipe em 0,20 o total virava
  // 0,30000000000000004. É a mesma régua e a mesma razão — e sem isto o
  // Fechamento, que soma os itens numa lista só, discordaria da aba Custos,
  // que soma categoria a categoria, em toda festa de mais de uma categoria.
  // Idempotente: para valor que já é centavo exato, `somaCentavos` devolve o
  // mesmo número.
  //
  // A GUARDA DO ABSURDO, e por que ela não é enfeite. `somaCentavos` normaliza
  // para 0 tudo que não é número finito — é o `num()` de util.js, a defesa da
  // ENTRADA. Aqui a entrada não é o dedo do Marco, é uma soma que este módulo
  // acabou de fazer, e ela PODE ser infinita: o backup com 1e308 no estimado de
  // um item (achado ainda EM ABERTO, sem teto para dinheiro na fronteira do
  // backup) estoura o double já na categoria. Sem esta guarda, esse evento
  // deixaria de mostrar um custo absurdo e escancarado e passaria a mostrar
  // custo R$ 0 — ou seja, lucro falso do tamanho da festa inteira, calado. Um
  // número errado exibido como certo é o pior defeito da casa; um absurdo
  // visível é só um absurdo. Quando alguma categoria não é finita, o total
  // volta a ser a soma crua e o absurdo continua gritando.
  const total = (k) => {
    const valores = porCategoria.map((c) => c[k])
    return valores.every(Number.isFinite)
      ? somaCentavos(valores)
      : valores.reduce((s, v) => s + v, 0)
  }
  return {
    porCategoria,
    totalEstimado: total('estimado'),
    totalRealizado: total('realizado'),
    totalConsiderado: total('considerado'),
  }
}

export const contingencia = (base, pct) => emCentavos((num(base) * num(pct)) / 100)

// ---------------------------------------------------------------- resultado

// A FUNÇÃO `breakEven({ custoTotal, outrasReceitas, ticketMedioLiquido })`
// MORAVA EXATAMENTE AQUI, exportada, e foi REMOVIDA em 27/07/2026 junto com a
// régua que ela implementava — teto((custo − outras receitas) ÷ ticket médio
// líquido). Quem vier procurar por ela: não sumiu por acidente, nem por
// arrumação de estilo.
//
// Ela caiu porque era CIRCULAR quando o bar é por pessoa: abatia do custo o
// bar da casa CHEIA e, na linha seguinte, perguntava quantos ingressos
// faltavam para encher a casa. Chegou a imprimir meta impossível — 1.388
// ingressos pagos numa festa com 1.000 à venda. A conta de hoje é
// `buscaBreakEven`, mais abaixo neste arquivo, e é a régua do slider.
//
// O `export` saiu junto porque nenhum módulo do app a importava — conferido em
// 27/07/2026, arquivo por arquivo: os cenários sempre a chamaram por dentro de
// `computeCenario`. A conta antiga continua no histórico do git para quem
// precisar conferir um número velho; trazê-la de volta para a tela é mudança
// de fórmula, e passa pelo portão dos princípios 1 e 8.

/**
 * NÚCLEO do cenário: tudo menos o break-even.
 *
 * Existe separado por UM motivo, e ele é explícito: a busca do break-even
 * (buscaBreakEven, abaixo) precisa recalcular o cenário inteiro dezenas de
 * vezes, e se ela chamasse `computeCenario` — que calcula o break-even — a
 * chamada seria infinita e a bateria travaria. O núcleo é o caminho interno
 * que NÃO recalcula o break-even; `computeCenario` é o núcleo mais o
 * break-even, e é o único jeito de o resto do app pedir um cenário.
 *
 * `vendaPctForcado` (null = usa o que está salvo) troca SÓ o `vendaPct` deste
 * cenário — o resto do `cenariosConfig` (ajuste de custos, ajuste de ticket,
 * ticket manual, overrides por lote) passa intacto. É a alavanca que a busca
 * arrasta, a MESMA que o Marco arrasta na tela.
 *
 * `custosPre` (null = calcula) é o resultado de `custosPorCategoria`, que não
 * depende do quanto se vende: quem varre 100 pontos passa a soma dos custos
 * pronta em vez de refazê-la 100 vezes. Não é atalho de precisão — é o mesmo
 * número, calculado uma vez.
 */
function computeCenarioNucleo(evento, cenario, vendaPctForcado = null, custosPre = null) {
  const cfgSalvo = evento.cenariosConfig || {}
  const cfg =
    vendaPctForcado == null
      ? cfgSalvo
      : {
          ...cfgSalvo,
          [cenario]: { ...(cfgSalvo[cenario] || {}), vendaPct: vendaPctForcado },
        }
  const qtds = {}
  let pagosCenario = 0
  for (const l of evento.lotes || []) {
    qtds[l.id] = loteQtdCenario(l, cenario, cfg)
    if (!isCortesia(l)) pagosCenario += qtds[l.id]
  }
  // Desconto nos ingressos (sugestão 17, estendida pela 29a — contas
  // aprovadas pelo Marco em 18/07 e 19/07/2026; detalhe na doc de
  // descontoEfetivoPct()). Sem os campos: efetivo = cupom = conta idêntica
  // à anterior. No modo nº a fração usa os PAGOS deste cenário.
  const descontoEfetivo = descontoEfetivoPct(evento, pagosCenario)
  const fatorDesconto = 1 - descontoEfetivo / 100
  // Taxa paga pelo cliente (sugestão 29b): no repasse a taxa não desconta da
  // líquida; padrão "paga por nós" = conta de sempre (ver isTaxaCliente).
  const taxaCliente = isTaxaCliente(evento)
  let bil = bilheteria(
    evento.lotes || [],
    qtds,
    evento.taxaBilheteria,
    evento.cashbackPct,
    descontoEfetivo,
    taxaCliente
  )

  // Ticket médio do cenário:
  // - ticketMedio (R$) manual substitui o automático (mistura de lotes)
  // - ticketPct (%) ajusta o ticket para cima/baixo (sobre o manual ou o automático)
  // Quando qualquer um está ativo, a receita de ingressos vira pagos × ticket,
  // com taxa e cashback recalculados sobre ela.
  // Com desconto: o ticket MANUAL é preço de tabela (substitui a mistura de
  // lotes), então recebe o mesmo × (1 − desconto EFETIVO) que os lotes
  // receberiam — 1× (regra da Sessão N); o automático (bil.ticketMedio) já
  // vem descontado da bilheteria. O ajuste % do cenário age por cima nos
  // dois casos — desconto nunca é aplicado 2×.
  const tmManual = cfg[cenario]?.ticketMedio
  const tmPct = num(cfg[cenario]?.ticketPct ?? 0)
  const temManual = tmManual !== '' && tmManual != null && num(tmManual) > 0
  if (temManual || tmPct !== 0) {
    const base = temManual ? num(tmManual) * fatorDesconto : bil.ticketMedio
    const tm = base * (1 + tmPct / 100)
    // mesma regra da bilheteria(): no repasse a taxa não desconta (29b)
    const { bruta, taxa, cashback, liquida } = liquidaDeBruta(bil.pagos * tm, evento.taxaBilheteria, evento.cashbackPct, taxaCliente)
    bil = {
      ...bil,
      bruta,
      taxa,
      cashback,
      liquida,
      ticketMedio: tm,
      ticketMedioLiquido: bil.pagos > 0 ? liquida / bil.pagos : 0,
      ticketMedioManual: temManual,
      ticketAjustePct: tmPct,
    }
  }

  // Open bar (sugestão 27): marcado → receita de bar = 0 em QUALQUER modo.
  // Bar em dois modos (sugestão 42, conta aprovada em 19/07/2026): modo
  // 'porPessoa' calcula ticket × público do cenário − sistema (ver
  // barPorPessoa acima); qualquer outro valor de barModo cai na conta de
  // sempre — o valor fixo digitado, igual nos três cenários.
  const bar = isOpenBar(evento)
    ? 0
    : isBarPorPessoa(evento)
      ? barPorPessoa(evento, cenario, bil.publico).liquido
      : emCentavos(num(evento.outrasReceitas?.bar))
  // Sessão O (sugestão 22): só o patrocínio FECHADO (confirmado/recebido)
  // entra na receita; proposta fica de fora, exposta em patrocinioPotencial.
  // Evento sem a lista: número solto conta inteiro, como sempre (fallback).
  const pat = patrocinioPorEstagio(evento)
  const patrocinio = pat.fechado
  const receitaTotal = somaEmCentavos([bil.liquida, bar, patrocinio])

  // IMPOSTO SOBRE A RECEITA (Marco, 27/07/2026). Dedução de RECEITA, não custo
  // — e é por isso que ele é calculado AQUI, entre a receita total e o lucro, e
  // não junto dos custos logo abaixo. A base da bilheteria é a BRUTA (decisão
  // dele, com a conta na frente: no modo repasse a líquida é MAIOR que a bruta,
  // e tributar a líquida cobraria imposto sobre o cashback que volta para a
  // produção). Regra completa em imposto.js.
  //
  // `null` quando o evento não tem imposto configurado — e então a chave
  // `imposto` NEM EXISTE no objeto devolvido. É deliberado: evento salvo antes
  // de 27/07/2026 continua com o MESMO objeto, campo por campo, e a ausência da
  // chave é o que a tela lê para não desenhar uma linha que não tem história.
  const imp = impostoDoCenario(evento, { bruta: bil.bruta, bar, patrocinio })
  const imposto = imp ? imp.valor : 0

  const custos = custosPre || custosPorCategoria(evento.categorias)
  // A CONTINGÊNCIA SAI DOS CUSTOS, E O IMPOSTO NÃO ESTÁ NELES (decisão 4 do
  // Marco). A contingência é reserva para custo estourar; imposto não estoura.
  // Somar o imposto em `custos.totalConsiderado` faria o app reservar
  // contingência SOBRE imposto — dinheiro de reserva que ninguém pediu.
  // `imposto.test.js` quebra em vermelho se alguém encostar o imposto aqui.
  const cont = contingencia(custos.totalConsiderado, evento.contingenciaPct)
  // Ajuste de custos por cenário. Sugestão 19 (grade completa, aprovada em
  // 18/07/2026): o realista ganhou custoPct com default 0 = a conta de sempre
  // (×1 é exato em ponto flutuante; provado pelo golden intacto). Preenchido,
  // é a MESMA conta dos vizinhos.
  const ajustePct =
    cenario === 'pessimista'
      ? num(cfg.pessimista?.custoPct ?? 10)
      : cenario === 'otimista'
        ? num(cfg.otimista?.custoPct ?? -5)
        : num(cfg.realista?.custoPct ?? 0)
  const custoBase = somaEmCentavos([custos.totalConsiderado, cont])
  // o ajuste do cenário é PARCELA do DRE (linha "Ajuste de custos do cenário"):
  // arredonda sozinho, como as outras linhas, e o total é a soma das parcelas
  const custoTotal = cabeEmCentavos(custoBase)
    ? somaEmCentavos([custoBase, emCentavos((custoBase * ajustePct) / 100)])
    : custoBase * (1 + ajustePct / 100)

  const lucro = somaEmCentavos([receitaTotal, -imposto, -custoTotal])
  return {
    cenario,
    ...bil,
    bar,
    patrocinio,
    patrocinioPotencial: pat.potencial,
    receitaTotal,
    // Chave CONDICIONAL: sem imposto configurado ela não existe, e o objeto do
    // cenário fica idêntico ao que sempre foi (a fotografia golden continua
    // batendo byte a byte, sem uma linha regravada). Quando existe, carrega a
    // história junto do número — alíquota, bases marcadas e a base em R$ —,
    // porque chave desligada e alíquota zero dão o MESMO R$ 0 e contam
    // histórias diferentes.
    ...(imp ? { imposto: imp } : {}),
    custosCategorias: custos.porCategoria,
    custoItens: custos.totalConsiderado,
    contingencia: cont,
    ajustePct,
    custoTotal,
    lucro,
    margem: receitaTotal > 0 ? (lucro / receitaTotal) * 100 : null,
    custoPorPessoa: bil.publico > 0 ? custoTotal / bil.publico : null,
  }
}

// ------------------------------------------------------------- break-even

/**
 * BREAK-EVEN — "a quantidade MÍNIMA de ingressos que eu preciso vender para
 * não dar prejuízo" (definição do Marco, palavra por palavra, 27/07/2026).
 *
 * A CONTA QUE CAIU, e por quê. Até 27/07/2026 era
 *
 *     teto((custoTotal − bar − patrocínio) ÷ ticketMédioLíquido)
 *
 * e ela é CIRCULAR quando o bar é POR PESSOA: o `bar` que ela abate do custo
 * é o bar calculado sobre o público CHEIO do cenário — e logo em seguida ela
 * pergunta quantos ingressos faltam para CHEGAR nesse público. Ela gasta
 * antecipadamente uma receita que só existe se a meta for batida. Medido nos
 * eventos do Marco: errava até 284 ingressos, para os DOIS lados (otimista
 * demais em uns, pessimista demais em outros), e em dois cenários imprimia
 * uma meta impossível — um número de ingressos numa festa que não fecha nem
 * vendendo tudo.
 *
 * A CONTA NOVA, decidida pelo Marco em 27/07/2026: varrer a MESMA alavanca
 * que ele arrasta na tela — o `vendaPct` do cenário. Para cada valor de
 * venda, o cenário INTEIRO é recalculado pelo núcleo acima (mesmo ajuste de
 * custos, mesmo ajuste de ticket, mesmo ticket manual, mesmos overrides por
 * lote, mesmo bar por pessoa, mesmo desconto), e se procura o primeiro ponto
 * em que o lucro chega a zero. O break-even é o número de ingressos PAGOS
 * desse ponto.
 *
 * É exatamente o que o Marco faz à mão arrastando o slider até o lucro
 * zerar — por isso a régua de "vender menos" tem de ser a MESMA do app:
 * vender X% é vender X% de CADA lote (`loteQtdCenario`, no topo deste
 * arquivo), e NÃO encher os lotes do mais barato para o mais caro. O modelo
 * do mais barato primeiro dá ~130 ingressos a mais e faz o break-even
 * discordar do slider que fica ao lado dele no MESMO cartão.
 *
 * NENHUMA conta de receita, desconto, taxa, cashback ou bar é reescrita
 * aqui: a busca chama o núcleo do cenário. Uma cópia dessas contas viraria
 * uma segunda régua, que envelhece sozinha.
 */

/**
 * Ruído de ponto flutuante no lucro. A MESMA razão e a MESMA escala do
 * epsilon do `veredito` (Marco, 20/07/2026): sem ele, um cenário que EMPATA
 * EXATO no zero tem o resultado decidido pelo sinal do erro de ponto
 * flutuante — e sempre para pior. Com R$ 11.800 × 1,1 dando 12.980,000000000002,
 * o lucro vira −R$ 0,000000000002 e o break-even pediria um ingresso a mais
 * do que a conta manda. 1e-9 é folgado sobre o ruído medido e milhões de
 * vezes menor que um centavo. Desde 07/10/2026 o lucro sai em centavos exatos
 * (util.js, régua do centavo) e esse ruído não nasce mais; o epsilon fica como
 * cinto, sem custo: nenhum lucro de centavos inteiros cai entre −1e-9 e 0.
 */
const EPS_LUCRO = 1e-9

/**
 * Os pontos de `vendaPct`, dentro de (pctBaixo, pctAlto], em que a quantidade
 * de ALGUM lote muda de degrau — ou seja, os únicos pontos em que o número de
 * ingressos pagos pode mudar dentro da janela.
 *
 * `loteQtdCenario` faz `Math.round(q × pct / 100)`, então o resultado passa a
 * valer k a partir de pct = 100 × (k − 0,5) ÷ q. Enumerar esses pontos é o que
 * permite o critério final ser em INGRESSOS e não em porcento: o passo de 1%
 * é grosseiro (num evento de 1.500 lotes, 1% são 15 ingressos), e varrer os
 * degraus reais da janela devolve o MENOR número de pagos possível.
 *
 * Ficam de fora os lotes que não respondem ao slider — override manual
 * (`loteQtdCenario` lê o override ANTES de olhar o %), cortesia (entra
 * inteira em todo cenário) e lote só-otimista fora do otimista.
 * Lote sem preço (P8) também fica de fora: não entra em cenário nenhum. Sem
 * esta exclusão, um lote sem preço de 100.000.000 ingressos levava ~4 s por
 * conta e um de 10.000.000.000 derrubava a busca com RangeError (medido em
 * 06/10/2026, com isCortesia já devolvendo false para ele).
 *
 * Cada limiar entra duas vezes, ele e ele mais um fio (1e-9), porque o `>=`
 * do arredondamento cai exatamente sobre o limiar e ponto flutuante não
 * garante de que lado ele cai — com os dois, o degrau é visitado de qualquer
 * jeito.
 */
function pctsDeDegrau(evento, cenario, pctBaixo, pctAlto) {
  const cfg = evento.cenariosConfig || {}
  const pcts = [pctBaixo, pctAlto]
  for (const l of evento.lotes || []) {
    if (isPrecoAusente(l)) continue
    const ov = cfg.overrides?.[cenario]?.[l.id]
    if (ov !== undefined && ov !== null && ov !== '') continue
    if (isCortesia(l)) continue
    if (cenario !== 'otimista' && l.somenteOtimista) continue
    const q = Math.max(0, num(l.quantidade))
    if (!(q > 0)) continue
    const kIni = Math.max(0, Math.floor((q * pctBaixo) / 100) - 1)
    const kFim = Math.ceil((q * pctAlto) / 100) + 1
    for (let k = kIni; k <= kFim; k++) {
      const pct = (100 * (k - 0.5)) / q
      if (pct > pctBaixo && pct <= pctAlto) {
        pcts.push(pct)
        if (pct + 1e-9 <= pctAlto) pcts.push(pct + 1e-9)
      }
    }
  }
  return [...new Set(pcts)].sort((a, b) => a - b)
}

/**
 * A busca. Devolve, além do número que vai para a tela, o material que os
 * testes usam para provar a definição do Marco:
 *
 *   breakEven ........... ingressos pagos no ponto de empate; 0 quando o custo
 *                         já está coberto sem vender nada; null quando não
 *                         fecha.
 *   breakEvenNaoFecha ... true quando NEM vendendo 100% de cada lote o lucro
 *                         chega a zero. Existe porque a conta antiga imprimia
 *                         "1.824 ingressos pagos" justamente nesse caso —
 *                         meta impossível impressa como meta.
 *   vendaPct ............ o ponto do slider onde o empate acontece
 *   lucro ............... o lucro nesse ponto (>= 0, a menos do ruído)
 *   degrauAbaixo ........ { pagos, lucro, vendaPct } do maior número de
 *                         ingressos ABAIXO do break-even que a alavanca
 *                         alcança — onde o lucro é negativo. É o "um a menos
 *                         e dá prejuízo" que define o mínimo.
 */
export function buscaBreakEven(evento, cenario, custosPre = null) {
  const custos = custosPre || custosPorCategoria(evento.categorias)
  const vistos = []
  const avaliar = (pct) => {
    const s = computeCenarioNucleo(evento, cenario, pct, custos)
    const ponto = { vendaPct: pct, pagos: s.pagos, lucro: s.lucro }
    vistos.push(ponto)
    return ponto
  }

  // PASSO 1 — a varredura grossa, de 1 em 1 ponto percentual, de uma ponta do
  // slider (0%) à outra (100%), exatamente como o Marco o arrasta.
  //
  // O 0 daqui é só o começo da alavanca. Ele NÃO é o que garante a regra do
  // "custo já coberto sem vender ingresso nenhum → break-even 0": essa regra
  // mora no PASSO 2, porque `pctsDeDegrau` devolve sempre a ponta de BAIXO da
  // janela, e o refino reavalia o zero de qualquer jeito. Medido em
  // 27/07/2026: começar esta varredura em 1% não muda um único resultado da
  // bateria. Escrever aqui que o 0 sustenta a regra daria a este laço um
  // crédito que é do refino — e quem lesse acreditaria que mexer no início da
  // varredura derruba o caso do custo já coberto. Não derruba; o que derruba é
  // mexer no refino.
  let achado = null
  for (let pct = 0; pct <= 100; pct++) {
    const p = avaliar(pct)
    if (p.lucro >= -EPS_LUCRO) {
      achado = p
      break
    }
  }
  if (!achado) {
    // A GUARDA DO ABSURDO, da mesma família da de custosPorCategoria. Um
    // backup editado à mão com quantidade estourada (1e308 num lote) faz a
    // soma de ingressos deixar de ser número, e o lucro do ponto vira NaN —
    // que não é >= 0 e cairia aqui. Mas "não fecha nem vendendo tudo" é uma
    // AFIRMAÇÃO, e sobre lixo não se afirma: nesse caso o honesto é o traço,
    // "não sei". Só quando todos os pontos varridos deram um lucro de
    // verdade, e nenhum chegou a zero, é que a tela pode afirmar que a festa
    // não fecha.
    const todosDeVerdade = vistos.every((p) => Number.isFinite(p.lucro))
    return {
      breakEven: null,
      breakEvenNaoFecha: todosDeVerdade,
      vendaPct: null,
      lucro: null,
      degrauAbaixo: null,
    }
  }

  // PASSO 2 — o refino, e é aqui que o critério vira INGRESSO. Dentro da
  // última janela de 1% (a primeira que virou positiva), visita cada degrau
  // real de quantidade e fica com o MENOR número de pagos que ainda fecha.
  // Um evento de 1.500 ingressos tem ~15 degraus por ponto percentual; sem
  // este passo o número exibido erraria por até esses 15.
  let melhor = achado
  if (achado.vendaPct > 0) {
    for (const pct of pctsDeDegrau(evento, cenario, achado.vendaPct - 1, achado.vendaPct)) {
      const p = avaliar(pct)
      if (p.lucro >= -EPS_LUCRO && p.pagos < melhor.pagos) melhor = p
    }
  }

  // O degrau de baixo: o maior número de pagos alcançável ABAIXO do
  // break-even. Por construção do laço acima ele tem lucro negativo — se
  // tivesse lucro >= 0, ELE seria o break-even.
  let degrauAbaixo = null
  for (const p of vistos) {
    if (p.pagos < melhor.pagos && (degrauAbaixo == null || p.pagos > degrauAbaixo.pagos)) {
      degrauAbaixo = p
    }
  }

  return {
    // teto porque ingresso é inteiro: a quantidade de um lote pode ser
    // fracionária (backup editado à mão), e meio ingresso não se vende.
    breakEven: Math.ceil(melhor.pagos),
    breakEvenNaoFecha: false,
    vendaPct: melhor.vendaPct,
    lucro: melhor.lucro,
    degrauAbaixo,
  }
}

export function computeCenario(evento, cenario) {
  // Os custos não dependem de quanto se vende: calculados UMA vez e passados
  // tanto ao cenário quanto à busca, que os reusa em cada ponto varrido.
  const custos = custosPorCategoria(evento.categorias)
  const nucleo = computeCenarioNucleo(evento, cenario, null, custos)
  const be = buscaBreakEven(evento, cenario, custos)
  return { ...nucleo, breakEven: be.breakEven, breakEvenNaoFecha: be.breakEvenNaoFecha }
}

export const CENARIOS = ['pessimista', 'realista', 'otimista']

export const CENARIO_LABEL = {
  pessimista: 'Pessimista',
  realista: 'Realista',
  otimista: 'Otimista',
}

export function computeCenarios(evento) {
  return {
    pessimista: computeCenario(evento, 'pessimista'),
    realista: computeCenario(evento, 'realista'),
    otimista: computeCenario(evento, 'otimista'),
  }
}

// ---------------------------------------------------------------- leitura (sugestão 2)

// Padrões decididos pelo Marco (18/07/2026) para os campos opcionais do evento.
// Margem alvo = o que almejamos todo evento bater; margem mínima = piso
// abaixo do qual o evento não sai.
export const MARGEM_ALVO_PADRAO = 28
export const MARGEM_MINIMA_PADRAO = 20

/**
 * Semáforo de decisão — LEITURA sobre computeCenarios, nenhuma fórmula nova
 * (margem = lucro/receita, a mesma conta já exibida). Regra do Marco
 * (18/07/2026): "o realista dá a cor, o pessimista rebaixa".
 * - verde: margem do realista ≥ margem alvo E pessimista sem prejuízo
 * - amarelo: realista entre a mínima e o alvo; OU realista ≥ alvo mas
 *   pessimista com prejuízo (rebaixadoPeloPessimista = true, p/ frase explicar)
 * - vermelho: realista abaixo da mínima (inclui prejuízo/sem receita)
 * Campos ausentes/vazios usam os padrões 28% (alvo) e 20% (mínima).
 */
export function veredito(cenarios, { margemAlvo, margemMinima } = {}) {
  const alvo = margemAlvo === '' || margemAlvo == null ? MARGEM_ALVO_PADRAO : num(margemAlvo)
  const minima =
    margemMinima === '' || margemMinima == null ? MARGEM_MINIMA_PADRAO : num(margemMinima)
  const mR = cenarios.realista.margem
  // Epsilon de ruído (Marco, 20/07/2026 — decisão do portão). Sem ele, um
  // resultado que EMPATA EXATO numa fronteira tinha a cor decidida pelo sinal
  // do erro de ponto flutuante — sempre para pior (ex.: R$ 11.800 × 1,1 dá
  // 12.980,000000000002, o lucro do pessimista vira −R$ 0,000000000002 e
  // rebaixa verde→amarelo "rebaixado pelo pessimista", quando o lucro é 0).
  // O empate passa a cair para o lado que a REGRA ESCRITA manda: ">= alvo" é
  // verde, lucro 0 não é prejuízo. Não muda a cor de nenhum evento que esteja
  // claramente de um lado — só desempata o fio da navalha.
  //
  // ESCALA: 1e-9 é folgado sobre o ruído medido (≤ R$ 1,4e-11 no lucro,
  // ≤ 4e-14 p.p. na margem) e milhões de vezes menor que um centavo / meio
  // ponto de margem, na escala das festas da casa (receitas até ~R$ 50 mil).
  // Se um dia as festas forem ~10× maiores (receita > R$ 500 mil), a menor
  // diferença VERDADEIRA se aproxima deste epsilon — recalibrar aqui então.
  const EPS = 1e-9
  const pessPrejuizo = num(cenarios.pessimista.lucro) < -EPS
  if (mR == null || mR < minima - EPS)
    return { cor: 'vermelho', rebaixadoPeloPessimista: false, margemAlvo: alvo, margemMinima: minima }
  if (mR >= alvo - EPS && !pessPrejuizo)
    return { cor: 'verde', rebaixadoPeloPessimista: false, margemAlvo: alvo, margemMinima: minima }
  return {
    cor: 'amarelo',
    rebaixadoPeloPessimista: mR >= alvo - EPS && pessPrejuizo,
    margemAlvo: alvo,
    margemMinima: minima,
  }
}

// ---------------------------------------------------------------- leitura (sugestão 10-P)

/**
 * Ritmo de vendas contra o break-even — regra de três simples (sugestão 10,
 * versão P aprovada; a curva completa NÃO está aprovada). Nenhuma fórmula de
 * negócio nova: usa o breakEven que computeCenario já devolve.
 * `hoje` em ISO (YYYY-MM-DD) vem do chamador — puro e testável.
 * Devolve null quando falta dado (campo vazio, sem data, sem break-even):
 * a leitura simplesmente não aparece, sem erro.
 *
 * `inicioVendas` (Sessão F2-S — sugestão 30): quando as vendas ainda NÃO
 * abriram, as semanas contam da janela RESTANTE real (início → festa), não
 * de hoje — o ritmo exigido fica verdadeiro. Sem o campo (ou início já
 * passado), a conta é byte a byte a de sempre.
 */
export function ritmoVendas({ vendidos, dataEvento, breakEven, hoje, inicioVendas }) {
  // A ORDEM DESTES DOIS TESTES É A DECISÃO DO MARCO DE 26/07/2026.
  //
  // Até esta data o campo "ingressos vendidos até hoje" vazio devolvia `null`
  // ANTES de olhar a data — e o padrão do campo É vazio. Consequência medida:
  // numa festa que já aconteceu, com o campo em branco, QUATRO superfícies
  // ficavam mudas sobre isso e a festa passada ficava indistinguível de uma
  // festa futura sem dado: o card "Estamos vendendo no ritmo?", a linha da
  // Home, o texto de "Copiar resumo" (WhatsApp curto e completo) e o
  // relatório/PDF. Em todas, quem lê a tela decide sobre uma festa achando que
  // ela ainda vai acontecer.
  //
  // O CAMPO VAZIO CONTINUA VALENDO PARA TUDO O MAIS — só perdeu a vez. A
  // pergunta "já passou?" não depende de quantos ingressos foram vendidos, e é
  // a única resposta que este módulo tem como dar sem o campo. Nenhuma conta
  // muda de fórmula e nenhum valor em R$ é calculado neste caminho: o objeto
  // devolvido tem UMA chave booleana, a mesma que as quatro telas já usam há
  // tempos quando o campo está preenchido.
  //
  // O que muda, exatamente (a tabela mostrada ao Marco antes da aprovação):
  //   evento PASSADO  + campo vazio ....... null → { eventoPassado: true }
  //   evento PASSADO  + campo preenchido .. sem mudança
  //   evento FUTURO   + campo vazio ....... sem mudança (segue null)
  //   evento FUTURO   + campo preenchido .. sem mudança
  // Uma célula. É a única.
  if (!dataEvento || breakEven == null || !hoje) return null
  const dias = Math.round(
    (new Date(`${dataEvento}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000
  )
  if (dias < 0) return { eventoPassado: true }
  if (vendidos === '' || vendidos == null) return null
  const v = Math.max(0, num(vendidos))
  const faltam = breakEven - v
  if (faltam <= 0) return { eventoPassado: false, cobriu: true, vendidos: v, breakEven, dias }
  let diasVenda = dias
  let vendasAbremEm = null
  if (inicioVendas) {
    const ateInicio = Math.round(
      (new Date(`${inicioVendas}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000
    )
    if (Number.isFinite(ateInicio) && ateInicio > 0) {
      vendasAbremEm = ateInicio
      diasVenda = Math.max(0, dias - ateInicio)
    }
  }
  // `diasVenda` NO LUGAR de `semanas`/`porSemana` (Marco, aprovado em
  // 10/08/2026 por questionário com a tabela antes × depois na frente; adiado
  // no mesmo dia por falta da janela do gancho, e aplicado em 30/08/2026 na
  // mesma abertura das fotografias novas do golden).
  //
  // POR QUE. Desde 10/08/2026 o ritmo que as telas mostram é POR DIA — as
  // quatro superfícies leem `ritmoPorDia` (resumo.js) e nenhuma imprime semana.
  // Só que a janela continuava saindo daqui em SEMANAS, e o consumidor a
  // remontava em dias com `Math.round(r.semanas * 7)` — um ida-e-volta que
  // existe só para recuperar um inteiro que este módulo já tinha e quebrou no
  // caminho: `12 / 7 * 7` dá 12.000000000000002.
  //
  // `porSemana` sai porque NINGUÉM o lê. Medido antes de mexer: fora dos
  // testes, a única leitura de `semanas` no app inteiro é o `ritmoPorDia`, e
  // `porSemana` não é lido em lugar nenhum — nasceu e morria aqui.
  //
  // NENHUM VALOR DE TELA MUDA, e isso foi medido nas quatro telas de ritmo
  // sobre 1.936 combinações de janela × break-even × início de vendas, antes e
  // depois: saída idêntica byte a byte.
  //
  // NADA GRAVADO: `storage.js` e `migracao.js` não mencionam nenhum dos dois
  // campos, então não há migração a escrever — o retorno desta função é
  // derivado, nunca persistido.
  return {
    eventoPassado: false,
    cobriu: false,
    vendidos: v,
    breakEven,
    faltam,
    dias,
    diasVenda,
    // presente SÓ quando as vendas ainda não abriram (chave nova aditiva)
    ...(vendasAbremEm != null ? { vendasAbremEm } : {}),
  }
}

// ---------------------------------------------------------------- leitura (sugestão 3)

/**
 * Soma de valorConsiderado de todos os itens de custo, agrupada por status
 * (ORÇAR/NEGOCIANDO/FECHADO/PAGO). Puramente derivada — nenhum dado novo.
 */
export function custosPorStatus(categorias) {
  const totais = {}
  for (const c of categorias || []) {
    for (const i of c.itens || []) {
      const st = i.status || 'ORÇAR'
      totais[st] = (totais[st] || 0) + valorConsiderado(i)
    }
  }
  return totais
}
