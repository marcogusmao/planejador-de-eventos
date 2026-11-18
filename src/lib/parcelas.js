// Parcelamento de custos (Sessão F2-C — pedido do Marco, 19/07/2026):
// "parcelamento muda o FLUXO, não o CUSTO".
//
// Um custo pode ganhar uma agenda de pagamento: uma data única (campo
// opcional `dataPagamento`) OU N parcelas { valor, data } (campo opcional
// `parcelas`). NADA aqui entra em fórmula de cenário: calc.js não lê estes
// campos (provado por fotografia byte a byte em parcelas.test.js) — o custo
// segue sendo UM item nas telas de custos, com o mesmo valorConsiderado de
// sempre. Quem lê a agenda é a aba Análise (fluxo de caixa) e os exports de
// pagamentos.
//
// Regra da SOMA TRAVADA (Marco, 19/07/2026): as parcelas devem somar o valor
// do custo (o valorConsiderado — realizado quando preenchido, senão estimado,
// a régua de sempre do app). Divergiu → aviso vermelho na tela, NUNCA
// silêncio; o app não "corrige" sozinho nem bloqueia — o número é do Marco.
//
// PARCELA PAGA (sugestão 38 — Interpretação A, aprovada pelo Marco em
// 18/07/2026): cada parcela pode ser marcada `paga`, com `dataPaga` (data do
// pagamento EFETIVO). Parcela paga = fluxo QUITADO — sai da linha do tempo
// "a vencer" da aba Análise (o dinheiro já saiu; o caixa fica exato).
// Reversível: desmarcar volta a parcela a "prevista", idêntica ao que era.
//
// REALIZADO ↔ PARCELAS (Decisão do Marco, 22/07/2026 — "progresso auto + grava
// no fim"): parcela paga deixou de ser 100% desacoplada do `realizado`. A
// regra, com as MESMAS palavras nos microtextos da tela:
//  - enquanto FALTAM parcelas a quitar, a célula Realizado mostra só o
//    PROGRESSO derivado (soma das pagas + contagem) — NADA é gravado, e o
//    custo previsto (valorConsiderado) NÃO cai a cada parcela paga;
//  - ao marcar a ÚLTIMA parcela como paga, grava `realizado` = soma REAL de
//    todas as parcelas (entra no desfazer normal);
//  - desmarcar essa gravação automática (marcada por realizadoAuto=true) limpa
//    o realizado de volta para '' e o progresso reaparece;
//  - um `realizado` digitado À MÃO (inclusive 0) VENCE: nunca é sobrescrito
//    nem apagado — a flag realizadoAuto (Marco, 23/07/2026 — lote de travas)
//    substituiu a heurística "realizado == soma", que apagava um manual
//    coincidente ao centavo com a soma.
// A soma travada continua (parcela paga soma no valor do custo) e — como tudo
// aqui — nenhuma FÓRMULA muda: quem lê `realizado` é o valorConsiderado de
// calc.js, intocado. O motor dessa regra é alternarParcelaPaga (puro, abaixo);
// a migração/o cálculo NÃO gravam realizado — só o handler da tela.

import { uid, num } from './util.js'
import { valorConsiderado } from './calc.js'

// Tolerância de meio centavo: parcelas são dinheiro em centavos; qualquer
// diferença >= R$ 0,005 é divergência de verdade (não ruído de float).
const TOLERANCIA = 0.005

/** O custo tem parcelas de verdade? (array com pelo menos 1 parcela) */
export const temParcelas = (item) => Array.isArray(item?.parcelas) && item.parcelas.length > 0

/** Soma dos valores das parcelas (0 quando não há). */
export const somaParcelas = (item) =>
  temParcelas(item) ? item.parcelas.reduce((s, p) => s + num(p?.valor), 0) : 0

/**
 * Divisão igual com sobra de centavos na ÚLTIMA parcela (regra do prompt da
 * sessão): R$ 100,00 em 3× → 33,33 + 33,33 + 33,34. Devolve um array de
 * valores em reais (2 casas exatas); n inválido (< 1) → [].
 */
export function dividirIgual(valorTotal, n) {
  const parcelas = Math.floor(num(n))
  if (parcelas < 1) return []
  const totalCentavos = Math.round(num(valorTotal) * 100)
  const base = Math.floor(totalCentavos / parcelas)
  const valores = Array.from({ length: parcelas }, () => base / 100)
  valores[parcelas - 1] = (totalCentavos - base * (parcelas - 1)) / 100
  return valores
}

/** Cria N parcelas novas (divisão igual, datas vazias para o Marco preencher;
 *  toda parcela nasce prevista — paga: false, sem data de pagamento efetivo). */
export function criarParcelasIguais(valorTotal, n) {
  return dividirIgual(valorTotal, n).map((valor) => novaParcela({ valor }))
}

/** Uma parcela nova na forma completa (sugestão 38: nasce prevista). */
export function novaParcela(patch = {}) {
  return { id: uid(), valor: '', data: '', paga: false, dataPaga: '', ...patch }
}

/**
 * Divergência entre a soma das parcelas e o valor do custo (valorConsiderado
 * — a régua de sempre). null quando não há parcelas ou quando a soma bate;
 * { soma, valor, diferenca } quando divergiu (diferenca = soma − valor:
 * positiva = parcelas somam MAIS que o custo).
 */
export function divergenciaParcelas(item) {
  if (!temParcelas(item)) return null
  const soma = somaParcelas(item)
  const valor = valorConsiderado(item)
  const diferenca = soma - valor
  if (Math.abs(diferenca) < TOLERANCIA) return null
  return { soma, valor, diferenca }
}

/**
 * Agenda de pagamento de um custo — a leitura única que a aba Análise e os
 * exports usam. Devolve uma lista de pagamentos
 * { valor, data, parcela, paga, dataPaga }:
 * - com parcelas: uma entrada por parcela, na ordem da lista, com
 *   parcela = { k, n } (1-based) para o rótulo "parcela k/N";
 * - sem parcelas: UMA entrada com o valorConsiderado e a dataPagamento do
 *   item (data '' = sem data — quem consome decide o aviso); pagamento único
 *   não tem "paga" (a sugestão 38 é POR PARCELA — decisão do Marco), então
 *   sai sempre paga: false;
 * - parcela sem data sai com data '' (nunca some em silêncio);
 * - paga é o booleano ESTRITO da parcela (só `true` quita — mesma régua da
 *   migração); dataPaga só acompanha parcela de fato paga.
 */
export function agendaDoItem(item) {
  if (temParcelas(item)) {
    const n = item.parcelas.length
    return item.parcelas.map((p, i) => ({
      valor: num(p?.valor),
      data: typeof p?.data === 'string' ? p.data : '',
      parcela: { k: i + 1, n },
      paga: p?.paga === true,
      dataPaga: p?.paga === true && typeof p?.dataPaga === 'string' ? p.dataPaga : '',
    }))
  }
  return [
    {
      valor: valorConsiderado(item),
      data: typeof item?.dataPagamento === 'string' ? item.dataPagamento : '',
      parcela: null,
      paga: false,
      dataPaga: '',
    },
  ]
}

/**
 * Leitura de quitação do custo (sugestão 38): "R$ 1.200 pagos de R$ 4.000 ·
 * 1 em aberto". null quando não há parcelas ou nenhuma está paga (nada a
 * dizer). O "de R$ X" é o valorConsiderado — a régua de sempre; se as
 * parcelas divergirem do custo, o aviso vermelho da soma travada já acusa.
 */
export function resumoQuitacao(item) {
  if (!temParcelas(item)) return null
  const pagas = item.parcelas.filter((p) => p?.paga === true)
  if (pagas.length === 0) return null
  return {
    qtdPagas: pagas.length,
    valorPago: pagas.reduce((s, p) => s + num(p?.valor), 0),
    emAberto: item.parcelas.length - pagas.length,
    valorCusto: valorConsiderado(item),
  }
}

/** Realizado "vazio" para a régua da Decisão 22/07/2026: só '' / null /
 *  ausente. Um realizado 0 é VALOR do dono (permuta/"custou zero") e NÃO é
 *  vazio — vence e mantém a célula editável (mesma filosofia do custouZero). */
export const realizadoVazio = (item) => item?.realizado == null || item.realizado === ''

/**
 * Progresso das parcelas pagas — leitura DISPLAY-ONLY da célula Realizado
 * enquanto o custo tem parcelas e o realizado ainda está vazio (Decisão do
 * Marco, 22/07/2026): { valorPago (soma das paga:true), qtdPagas, n }. NÃO é
 * gravado em lugar nenhum — existe justamente para o custo previsto
 * (valorConsiderado) NÃO cair a cada parcela paga; só a ÚLTIMA parcela grava o
 * realizado (ver alternarParcelaPaga). null quando o item não tem parcelas.
 */
export function progressoParcelasPagas(item) {
  if (!temParcelas(item)) return null
  const pagas = item.parcelas.filter((p) => p?.paga === true)
  return {
    valorPago: pagas.reduce((s, p) => s + num(p?.valor), 0),
    qtdPagas: pagas.length,
    n: item.parcelas.length,
  }
}

/**
 * Alterna a parcela `paga` e decide o efeito no `realizado` do custo (Decisão
 * do Marco, 22/07/2026 — "progresso auto + grava no fim"). Puro e testável;
 * NÃO toca fórmula (o realizado é lido por valorConsiderado em calc.js, que
 * segue intocado).
 *
 * - marcar a ÚLTIMA parcela (todas passam a paga) COM realizado vazio →
 *   grava realizado = soma REAL de todas as parcelas E marca realizadoAuto=true;
 * - desmarcar quando realizadoAuto === true (a gravação foi automática) → limpa
 *   realizado de volta para '' e realizadoAuto de volta para false (simétrico);
 * - realizado já preenchido à mão (inclusive 0) VENCE: nunca é sobrescrito
 *   nem apagado — sem a flag, desmarcar NÃO toca o realizado.
 *
 * A flag `realizadoAuto` (schema aditivo, Marco 23/07/2026 — lote de travas,
 * item 4) SUBSTITUI a heurística antiga "realizado == soma": um manual que
 * coincide ao centavo com a soma não tem a flag, então nunca é apagado. Quem
 * grava/limpa a flag é SÓ este motor; a edição manual do campo Realizado a zera
 * (onChange da tela). calc.js NÃO lê a flag.
 *
 * Devolve { patch, efeito }: `patch` é aplicado pelo onChange/setItem de sempre
 * (um passo de desfazer só, o realizado entra junto); `efeito` alimenta o toast
 * da tela: { tipo:'gravou', valor, n } | { tipo:'limpou' } | null.
 */
export function alternarParcelaPaga(item, parcelaId, paga, hoje = '') {
  const parcelas = (item?.parcelas || []).map((p) =>
    p?.id === parcelaId
      ? paga
        ? { ...p, paga: true, dataPaga: p.dataPaga || hoje }
        : { ...p, paga: false, dataPaga: '' }
      : p
  )
  const patch = { parcelas }
  const soma = parcelas.reduce((s, p) => s + num(p?.valor), 0)
  let efeito = null
  if (paga) {
    const todasPagas = parcelas.length > 0 && parcelas.every((p) => p?.paga === true)
    if (todasPagas && realizadoVazio(item)) {
      patch.realizado = soma
      patch.realizadoAuto = true // marca a gravação como AUTOMÁTICA
      efeito = { tipo: 'gravou', valor: soma, n: parcelas.length }
    }
  } else if (item?.realizadoAuto === true) {
    // FIM DA HEURÍSTICA POR VALOR (Marco, 23/07/2026 — lote de travas, item 4):
    // limpar só quando a gravação foi AUTOMÁTICA (flag), nunca por "realizado ==
    // soma". Um manual que coincide ao centavo com a soma (estimado 50.000,
    // manual 45.000, parcelas 3×15.000) NÃO tem a flag → NUNCA é apagado. A
    // limpeza é simétrica: zera o realizado e a flag juntos.
    patch.realizado = ''
    patch.realizadoAuto = false
    efeito = { tipo: 'limpou' }
  }
  return { patch, efeito }
}

/** Resumo curto para a célula da tabela de custos: "3× · 05/08–05/10". */
export function resumoParcelas(item) {
  if (!temParcelas(item)) return null
  const datas = item.parcelas
    .map((p) => (typeof p?.data === 'string' ? p.data : ''))
    .filter(Boolean)
    .sort()
  const curta = (iso) => {
    const [, m, d] = iso.split('-')
    return d && m ? `${d}/${m}` : iso
  }
  const n = item.parcelas.length
  if (datas.length === 0) return `${n}× sem datas`
  if (datas.length === 1) return `${n}× · ${curta(datas[0])}`
  return `${n}× · ${curta(datas[0])}–${curta(datas[datas.length - 1])}`
}
