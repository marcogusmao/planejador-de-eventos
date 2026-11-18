import { camposRealizadosAtivosInvalidos, textoRealizadosInvalidos } from './dadoQuebrado.js'
// Fechamento de EVENTO (Parte 2 da obra — decisões do Marco, 20/07/2026).
//
// Fechar um evento CONGELA os números já computados. O padrão é o do
// benchmark (montarBenchmarkDeEvento: números gravados na criação, leitura
// nunca recalcula), NUNCA o do versaoReuniao.js (que guarda clone e recomputa
// na leitura — uma aprovação de fórmula futura reescreveria retroativamente o
// resultado de festas já fechadas, que é número errado mostrado como certo).
// Um evento fechado é fato histórico: não muda sozinho.
//
// Este módulo fica FORA do portão do golden DE PROPÓSITO: ele só CHAMA
// fechamento.js/calc.js (que estão no PADRAO_PORTAO), jamais os edita. A foto
// é uma FOTOGRAFIA da saída dessas funções no instante do fechamento — mais
// um consumidor da fonte única (confrontoCustos → fechamento.js), nunca uma
// conta paralela.

import { computeCenarios } from './calc.js'
import {
  fechamentoCustos,
  fechamentoReceita,
  resultadoRealizado,
  MOTIVO_SEM_BILHETERIA_REALIZADA,
} from './fechamento.js'

/** O evento está fechado? Checagem ESTRITA — só a string exata conta. */
export const eventoFechado = (evento) => evento?.status === 'fechado'

/**
 * A recusa por bilheteria ausente, em português. A presença é a MESMA do
 * benchmark (decisão 5 do Marco, 20/07/2026): sem a bilheteria realizada
 * informada, a foto gravaria projeção com cara de realizado — o S1 clássico.
 */
export const MOTIVO_NAO_FECHA =
  'Ainda não dá para fazer o fechamento. ' + MOTIVO_SEM_BILHETERIA_REALIZADA

/** Uma razão única para todas as portas que pedem uma fotografia nova. */
export function motivoNaoFechar(evento) {
  const campos = camposRealizadosAtivosInvalidos(evento)
  if (campos.length)
    return `Não dá para fechar este evento: ${textoRealizadosInvalidos(campos)}. Corrija o campo na aba Fechamento; nenhuma fotografia foi criada.`
  const card = resultadoRealizado(evento, computeCenarios(evento).realista)
  return !card || !card.bilheteriaInformada ? MOTIVO_NAO_FECHA : null
}

/**
 * Monta a FOTO do fechamento: os números que o app já computou, congelados.
 *
 * Devolve null quando uma origem realizada ativa é ilegível ou falta bilheteria.
 * A régua de presença NÃO é
 * recriada aqui: usamos `bilheteriaInformada` da saída do próprio
 * `resultadoRealizado` (o portão decide, este módulo obedece).
 *
 * A foto carrega:
 * - `resultado`: a saída INTEIRA de resultadoRealizado — a conta passo a
 *   passo, a pendência declarada (`completo`, nSemRealizado, linhasPrevistas)
 *   e a ponte com o cenário. Congelar sem a pendência junto gravaria uma foto
 *   parcial com cara de final.
 * - `custos` / `receita`: os quadros de fechamentoCustos/fechamentoReceita,
 *   como a aba mostra.
 * - `cenarioRealista`: o resumo do cenário contra o qual a festa fechou.
 *
 * Tudo clonado VIA JSON — de propósito, não por preguiça: o localStorage
 * grava com JSON.stringify, que vira NaN/Infinity em null. Clonar com
 * structuredClone preservaria o não-finito NA MEMÓRIA e o reload mostraria
 * outro número (achado adversarial 20/07/2026: 1.589 de 3.000 fotos fuzzadas
 * com magnitudes ~1e308 mudavam no reload). Nascendo já em JSON, a foto que
 * o Marco vê ao fechar é EXATAMENTE a que ele verá para sempre.
 */
const cloneJSON = (o) => JSON.parse(JSON.stringify(o))

export function montarFotoFechamento(evento) {
  if (motivoNaoFechar(evento)) return null
  const cen = computeCenarios(evento).realista
  const card = resultadoRealizado(evento, cen)
  if (!card || !card.bilheteriaInformada) return null
  return cloneJSON({
    resultado: card,
    custos: fechamentoCustos(evento.categorias),
    receita: fechamentoReceita(evento, cen),
    cenarioRealista: {
      lucro: cen.lucro,
      custoTotal: cen.custoTotal,
      receitaTotal: cen.receitaTotal,
      contingencia: cen.contingencia,
      ajustePct: cen.ajustePct,
      margem: cen.margem,
      breakEven: cen.breakEven,
      // Sem este campo a foto de um cenário que não fechava guardava
      // `breakEven: null` e quem a lesse não teria como distinguir "não sei"
      // de "não fecha nem vendendo tudo" (Marco, 27/07/2026).
      breakEvenNaoFecha: cen.breakEvenNaoFecha,
      bruta: cen.bruta,
      publico: cen.publico,
      // Imposto (Marco, 27/07/2026) — condicional pelo mesmo motivo da chave
      // em calc.js: foto de evento fechado ANTES do imposto existir não ganha
      // campo novo. Quando existe, a foto congela o descritor INTEIRO (a
      // alíquota e as bases, não só o R$): sem ele, quem abrisse esta foto
      // daqui a um ano veria receitaTotal − custoTotal ≠ lucro e não teria
      // como descobrir o porquê — a segunda verdade, congelada para sempre.
      ...(cen.imposto ? { imposto: cen.imposto } : {}),
    },
  })
}

/**
 * Fecha o evento: devolve um evento NOVO com status 'fechado' e a foto — ou
 * null quando não dá (já fechado, origem realizada ativa ilegível ou
 * bilheteria ausente; a tela mostra a razão de motivoNaoFechar).
 * Função PURA, nunca muta o original.
 *
 * StrictMode: quem chama monta o objeto UMA vez FORA do updater (este é o
 * objeto) e o updater só troca por id — nunca chamar isto dentro do fn do
 * setStore.
 */
export function fecharEvento(evento, agoraIso) {
  if (eventoFechado(evento)) return null
  const foto = montarFotoFechamento(evento)
  if (!foto) return null
  return { ...evento, status: 'fechado', fechamento: { em: agoraIso, foto } }
}

/**
 * Reabre o evento: status volta a 'aberto' e a foto é DESCARTADA — reabrir
 * declara que aquele fechamento não vale mais; fechar de novo tira outra
 * foto, dos números de agora. O invariante do par (status ⟺ fechamento)
 * continua de pé. Evento já aberto volta como está (mesma referência).
 */
export function reabrirEvento(evento) {
  if (!eventoFechado(evento)) return evento
  return { ...evento, status: 'aberto', fechamento: null }
}

/**
 * Carimba no fechamento o id do benchmark promovido a partir dele — para o
 * selo "Benchmark" do card saber a que benchmark o evento deu origem (e o
 * reabrir poder avisar/remover). Só faz sentido em evento fechado; em
 * qualquer outro estado devolve o evento como está.
 */
export function carimbarBenchmark(evento, benchmarkId) {
  if (!eventoFechado(evento) || typeof benchmarkId !== 'string' || benchmarkId === '')
    return evento
  return { ...evento, fechamento: { ...evento.fechamento, benchmarkId } }
}
