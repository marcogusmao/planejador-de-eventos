// Frases-fonte-única das premissas de bilheteria (Sessão F2-R — sugestão 29;
// regra da casa "feature não é ilha"): o rodapé do relatório, a apresentação,
// o resumo de WhatsApp e os microtextos citam a MESMA regra, escrita UMA vez
// aqui. Display puro — nenhuma conta de dinheiro mora neste arquivo (a conta
// é descontoEfetivoPct em calc.js).

import { avisoBreakEven } from './breakEvenTexto.js'
import { num } from './util.js'
import { fmtData, fmtInt, fmtBRL, fmtBRL2, fmtPct } from './format.js'
import { decomposicaoTicket, isBarPorPessoa, isOpenBar, barPorPessoa } from './calc.js'
import { inicioVendasEfetivo, referenciaCurva } from './curvaVendas.js'
import { cabeComoDinheiro, NUMERO_NAO_CALCULA } from './dadoQuebrado.js'

// Número em português: vírgula decimal, sem zeros à direita ("10", "7,5").
const pctBR = (v) => String(num(v)).replace('.', ',')

// Rótulo ÚNICO do ticket médio líquido (Sessão F2-P, tema C — "mesma definição
// em todo lugar: cards, relatório, resumo, legenda"; Sessão F2-U tirou o
// "(bilheteria)" provisório, item 4). HONESTO ao que a fórmula calcula:
// ticketMedioLiquido = liquida ÷ pagos, e liquida = bilheteria − taxa +
// cashback (no repasse "taxa paga pelo cliente": + cashback, a taxa NÃO
// desconta). NÃO inclui bar nem patrocínio — esses entram na RECEITA TOTAL,
// não por ingresso.
export const TICKET_LIQUIDO_LABEL = 'Ticket médio líquido'

// ── Régua "frase de gente + continha com números reais" (Sessão F2-Y — item 4
//    do QA do Marco: "para alguém ruim de conta entender fácil"). A FRASE diz o
//    que o número é em português; a CONTINHA mostra a conta com os R$ reais do
//    evento. Display puro: a decomposição mora em calc.decomposicaoTicket (só
//    reparte números já calculados); aqui é só o texto. A MESMA em todo lugar
//    (nota dos números-chave, legenda "Como ler", apresentação).

// Rótulo do ticket bruto — o mesmo usado nos cards/números-chave.
export const TICKET_BRUTO_LABEL = 'Ticket médio (bruto)'

/** Frase de gente do ticket BRUTO. Sem cupom, a menção ao desconto sai. */
export function fraseTicketBruto(evento) {
  return num(evento?.descontoMedioPct) !== 0
    ? 'O preço do ingresso, com o desconto do cupom já aplicado e sem a taxa da Tiqueteira.'
    : 'O preço do ingresso (o preço de tabela), sem a taxa da Tiqueteira.'
}

/** Frase de gente do ticket LÍQUIDO (não cita bar nem patrocínio — Marco). */
export function fraseTicketLiquido() {
  return 'Quanto sobra pra gente, por ingresso vendido.'
}

/**
 * Continha do ticket BRUTO com os R$ reais do cenário `s`:
 *   "Neste evento: R$ tabela (tabela) − R$ cupom (cupom) = R$ bruto por ingresso."
 * Sem cupom, vira o próprio preço de tabela. '' quando não há ingresso pago.
 */
// Continha com número que não é dinheiro some (05/10/2026, 4ª revisão do PR
// #98): com um ticket manual de 1e307 o Relatório explicava "Neste evento:
// R$ 10.000.000…000 por ingresso". Sem continha, fica a frase de gente.
const decomposicaoCabe = (d) => Object.values(d).every((v) => typeof v !== 'number' || cabeComoDinheiro(v))

export function contaTicketBruto(evento, s) {
  const d = decomposicaoTicket(s, evento)
  if (!d || !decomposicaoCabe(d)) return ''
  if (!d.temCupom)
    return `Neste evento: ${fmtBRL2(d.bruto)} por ingresso (não há cupom — é o próprio preço de tabela).`
  return `Neste evento: ${fmtBRL2(d.tabela)} (tabela) − ${fmtBRL2(d.cupom)} (cupom) = ${fmtBRL2(
    d.bruto
  )} por ingresso.`
}

/**
 * Continha do ticket LÍQUIDO com os R$ reais do cenário `s`:
 *   "Neste evento: R$ bruto − R$ taxa (taxa) + R$ cashback (cashback) = R$ líquido…"
 * A parcela da taxa some no modo "paga pelo cliente"; parcelas zeradas somem.
 */
export function contaTicketLiquido(evento, s) {
  const d = decomposicaoTicket(s, evento)
  if (!d || !decomposicaoCabe(d)) return ''
  const partes = [fmtBRL2(d.bruto)]
  if (!d.taxaCliente && Math.abs(d.taxaPorIng) > 0.004)
    partes.push(`− ${fmtBRL2(d.taxaPorIng)} (taxa)`)
  if (Math.abs(d.cashbackPorIng) > 0.004) partes.push(`+ ${fmtBRL2(d.cashbackPorIng)} (cashback)`)
  return `Neste evento: ${partes.join(' ')} = ${fmtBRL2(d.liquido)} por ingresso.`
}

/** Micro completo (frase + continha) do ticket bruto/líquido, um por função. */
export function microTicketBruto(evento, s) {
  const conta = contaTicketBruto(evento, s)
  return conta ? `${fraseTicketBruto(evento)} ${conta}` : fraseTicketBruto(evento)
}
export function microTicketLiquido(evento, s) {
  const conta = contaTicketLiquido(evento, s)
  return conta ? `${fraseTicketLiquido()} ${conta}` : fraseTicketLiquido()
}

// "Como ler este relatório" — fonte ÚNICA das legendas de leigo (Sessão F2-P,
// tema C). Usadas no relatório Completo E no modo apresentação (feature não é
// ilha). Critério do Marco: a sócia entende sem perguntar. Recebe o cenário
// `realista` (Sessão F2-Y — item 4) para pôr a "continha com números reais" de
// margem, break-even, contingência e tickets; sem ele, cai nas frases genéricas.
export function legendasRelatorio(evento, realista = null, cenarios = undefined) {
  const r = realista
  // Margem que não é número finito (custo quebrado, 05/10/2026) cai na frase
  // genérica: a "continha" imprimia "margem de 0% — R$ 0 são lucro", número
  // derivado de lixo no glossário do papel. Festa sã: idêntico ao de sempre.
  const margem =
    r && Number.isFinite(r.margem)
      ? `Quanto sobra de lucro para cada R$ 100 de receita. Neste evento (realista): margem de ${fmtPct(
          r.margem
        )} — de cada R$ 100 que entram, ${fmtBRL(Math.round(num(r.margem)))} são lucro.`
      : 'Quanto sobra de lucro para cada R$ 100 de receita. Margem 30% = de cada R$ 100 que entram, R$ 30 são lucro.'
  // O caso "não fecha" ganhou frase própria (Marco, 27/07/2026): quando nem
  // vendendo todos os ingressos o realista sai do prejuízo, não existe número
  // que sirva de meta — e a legenda imprimia um mesmo assim.
  const aviso = avisoBreakEven(evento, r, cenarios)
  const be = aviso || (r?.breakEvenNaoFecha
    ? 'Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro. Neste evento não existe esse número: nem vendendo todos os ingressos o cenário realista sai do prejuízo.'
    : r && r.breakEven != null
      ? `Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro. Neste evento: ${fmtInt(
          r.breakEven
        )} ingressos pagos.`
      : 'Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro.')
  const cont =
    r && num(r.contingencia) > 0
      ? `Uma reserva sobre os custos para imprevistos — não é um item com fornecedor nem tem vencimento; some se der tudo certo. Neste evento: ${pctBR(
          evento?.contingenciaPct
        )}% dos custos = ${fmtBRL(r.contingencia)}.`
      : 'Uma reserva sobre os custos para imprevistos — não é um item com fornecedor nem tem vencimento; some se der tudo certo.'
  return [
    [
      'Cenários',
      'Pessimista, realista e otimista são três versões do mesmo evento — vendendo menos, no esperado e lotado. O realista é o número da decisão.',
    ],
    ['Margem', margem],
    ['Break-even (BE)', be],
    [
      'Considerado',
      'O custo que entra na conta: o valor realizado quando já foi fechado; senão, o estimado.',
    ],
    ['Contingência', cont],
    [TICKET_BRUTO_LABEL, microTicketBruto(evento, r)],
    [TICKET_LIQUIDO_LABEL, microTicketLiquido(evento, r)],
  ]
}

/**
 * Frase exata da premissa de desconto (sugestão 29a). Exemplos:
 * - "cupom de 10% em 40% dos ingressos" (modo %)
 * - "cupom de 10% em até 180 ingressos (fração por cenário)" (modo nº)
 * - "cupom de 10% em todos os ingressos" (padrão — campo antigo)
 * Devolve '' quando não há cupom (nenhuma premissa a citar).
 */
export function premissaDesconto(evento) {
  const cupom = num(evento?.descontoMedioPct)
  if (cupom === 0) return ''
  const v = evento?.descontoIngressosValor
  const modoNum = evento?.descontoIngressosModo === 'numero'
  if (v === '' || v == null || (!modoNum && num(v) === 100))
    return `cupom de ${pctBR(cupom)}% em todos os ingressos`
  if (!modoNum) return `cupom de ${pctBR(cupom)}% em ${pctBR(v)}% dos ingressos`
  return `cupom de ${pctBR(cupom)}% em até ${fmtInt(Math.max(0, num(v)))} ingressos (fração por cenário)`
}

/**
 * Frase da premissa da taxa (sugestão 29b): citada SÓ no modo repasse — o
 * padrão "paga por nós" é o comportamento de sempre e não precisa de aviso.
 * A checagem estrita mora em calc.js (isTaxaCliente); aqui é só a frase.
 */
export function premissaTaxa(evento) {
  if (evento?.taxaPagaPor !== 'cliente') return ''
  const taxa = num(evento?.taxaBilheteria)
  return `taxa de ${pctBR(taxa)}% paga pelo cliente (não desconta da receita)`
}

/**
 * Todas as premissas de bilheteria da sugestão 29 numa lista, prontas para o
 * rodapé ("cupom 10% em 40% dos ingressos · taxa paga pelo cliente").
 * Sem premissa → lista vazia.
 */
export function premissasBilheteria(evento) {
  return [premissaDesconto(evento), premissaTaxa(evento)].filter(Boolean)
}

/**
 * Frase da premissa do bar POR PESSOA (sugestão 42): citada SÓ no modo por
 * pessoa — o modo fixo é o comportamento de sempre e não vira ruído (mesma
 * régua da premissaTaxa). Open bar tem frase própria nas telas ("sem receita
 * de bar") e vence: aqui devolve ''. Exemplos:
 * - "bar por pessoa: consumo de R$ 110 por pessoa · sistema 5% + R$ 500"
 * - tickets distintos: "…consumo de R$ 90 / R$ 110 / R$ 130 por pessoa
 *   (pess./real./otim.) · sistema 5%"
 * A conta mora em calc.js (barPorPessoa); aqui é só a frase.
 */
export function premissaBar(evento) {
  if (!isBarPorPessoa(evento) || isOpenBar(evento)) return ''
  const t = evento?.barTicket || {}
  // Consumo que não cabe numa conta (05/10/2026, 4ª revisão do PR #98): a
  // premissa ecoava "consumo de R$ 100.000.000…" em quatro telas e no WhatsApp.
  if (![t.pessimista, t.realista, t.otimista].every(cabeComoDinheiro))
    return `bar por pessoa: consumo ${NUMERO_NAO_CALCULA}`
  const tp = num(t.pessimista)
  const tr = num(t.realista)
  const to = num(t.otimista)
  const ticket =
    tp === tr && tr === to
      ? `consumo de ${fmtBRL2(tr)} por pessoa`
      : `consumo de ${fmtBRL2(tp)} / ${fmtBRL2(tr)} / ${fmtBRL2(to)} por pessoa (pess./real./otim.)`
  const taxa = num(evento?.barTaxaSistemaPct)
  const custo = num(evento?.barCustoSistema)
  const sistema = [taxa !== 0 ? `${pctBR(taxa)}%` : '', custo !== 0 ? fmtBRL2(custo) : '']
    .filter(Boolean)
    .join(' + ')
  return `bar por pessoa: ${ticket}${sistema ? ` · sistema ${sistema}` : ''}`
}

/**
 * Continha do bar POR PESSOA com os R$ reais do cenário `s` (régua "frase de
 * gente + continha" da F2-Y): "R$ 110 × 991 pessoas = R$ 109.010 − R$ 5.450,50
 * (sistema 5%) − R$ 500 (custo do sistema) = R$ 103.059,50." Parcelas zeradas
 * somem. '' fora do modo por pessoa (ou em open bar) — nada a explicar.
 */
export function contaBarPorPessoa(evento, s) {
  if (!isBarPorPessoa(evento) || isOpenBar(evento) || !s) return ''
  const b = barPorPessoa(evento, s.cenario, s.publico)
  if (![b.ticket, b.pessoas, b.consumo, b.liquido].every(cabeComoDinheiro))
    return `Bar por pessoa: ${NUMERO_NAO_CALCULA}.`
  const partes = [`${fmtBRL2(b.ticket)} × ${fmtInt(b.pessoas)} pessoas = ${fmtBRL2(b.consumo)}`]
  if (b.taxaSistema !== 0) partes.push(`− ${fmtBRL2(b.taxaSistema)} (sistema ${pctBR(b.taxaPct)}%)`)
  if (b.custoSistema !== 0) partes.push(`− ${fmtBRL2(b.custoSistema)} (custo do sistema)`)
  if (partes.length === 1) return `${partes[0]} de lucro esperado.`
  return `${partes.join(' ')} = ${fmtBRL2(b.liquido)}.`
}

/**
 * Frase da premissa de início de vendas (Sessão F2-S — sugestão 30):
 * - pela premissa da festa → "vendas abrem 45 dias antes da festa (29/07/2026)"
 * - data preenchida à mão  → "início de vendas em 13/08/2026 (30 dias antes)"
 * '' quando não há início (ou ele está depois da festa — a tela avisa; o
 * rodapé não cita premissa que a curva está ignorando).
 */
export function premissaInicioVendas(evento) {
  const ini = inicioVendasEfetivo(evento)
  if (!ini || ini.depoisDaFesta) return ''
  if (ini.origem === 'premissa')
    return `vendas abrem ${fmtInt(ini.diasAntes)} dias antes da festa (${fmtData(ini.data)})`
  return `início de vendas em ${fmtData(ini.data)}${
    ini.diasAntes != null ? ` (${fmtInt(ini.diasAntes)} dias antes)` : ''
  }`
}

/**
 * Frase da referência da curva ESCOLHIDA no evento (sugestão 30) — a
 * escolha guardada, independente de cache: "referência da curva: Brisa #2"
 * · "…grupo de 3 festas" · "…média Brisa" (padrão pela festa do evento).
 */
export function premissaReferenciaCurva(evento) {
  const ref = referenciaCurva(evento)
  if (ref.modo === 'festa' && ref.itens.length > 0)
    return `referência da curva: ${ref.itens[0].nome || 'festa sem nome'}`
  if (ref.modo === 'grupo' && ref.itens.length > 0)
    return `referência da curva: grupo de ${ref.itens.length} ${ref.itens.length === 1 ? 'festa' : 'festas'}`
  const tipo = (evento?.tipo || '').trim()
  return tipo ? `referência da curva: média ${tipo}` : 'referência da curva: média geral'
}

/**
 * Premissas da curva de vendas para o rodapé ("vendas abrem 45 dias antes ·
 * referência: média Brisa"). Sem início, a referência só é citada quando
 * foi escolhida à mão (o padrão não vira ruído em quem nem usa a curva).
 */
export function premissasCurva(evento) {
  const ini = premissaInicioVendas(evento)
  if (ini) return [ini, premissaReferenciaCurva(evento)]
  const ref = referenciaCurva(evento)
  return ref.modo !== '' && ref.itens.length > 0 ? [premissaReferenciaCurva(evento)] : []
}
