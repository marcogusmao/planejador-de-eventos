// Como o break-even é ESCRITO nas telas — fonte ÚNICA das cinco superfícies
// que o imprimem (cartão de cenário, tabela de comparação da aba Cenários,
// Números-chave e DRE do relatório/PDF, modo apresentação, "Copiar resumo" do
// WhatsApp e a legenda "Como ler este relatório").
//
// Existe por causa de um caso concreto (Marco, 27/07/2026): quando NEM
// vendendo 100% de cada lote o cenário sai do prejuízo, não há número de
// ingressos que sirva de meta — e a conta antiga imprimia um mesmo assim.
// Medido no evento golden com open bar: ela pedia "1.388 ingressos pagos" num
// cenário onde existem 1.000 ingressos à venda. Meta impossível impressa como
// meta é o pior defeito desta casa: número errado mostrado como certo.
//
// A regra de escrita, então: nesse caso a tela DIZ, em português de leigo,
// que não fecha — nunca um traço (que quer dizer "não sei"), nunca um número
// (que seria mentira).
//
// Duas guardas vêm ANTES dela (`avisoBreakEven`), nesta ordem: dado inválido
// (#98, "não dá para calcular") e quantidade travada à mão no cenário (S6,
// decisão do Marco de 05/09/2026). Com lote travado o mínimo foi calculado com
// quantidades que não acompanham o slider de vendas — o número existe mas não
// serve de meta, então a tela diz que está travado em vez de imprimi-lo.

import { fmtInt, DASH } from './format.js'
import { cenarioQuebrado, receitaDoCenarioQuebrada, NUMERO_NAO_CALCULA } from './dadoQuebrado.js'
import { isPrecoAusente } from './calc.js'

export const BREAK_EVEN_QUANTIDADE_TRAVADA = 'quantidade travada à mão neste cenário'

/** Presença do ajuste nos lotes atuais, com a mesma regra do cálculo. */
export function temQuantidadeTravada(evento, cenario) {
  return (evento?.lotes || []).some(lote => {
    // Lote sem preço (P8): o cálculo ignora o ajuste dele — espelho de
    // loteQtdCenario. Decisão do Marco, 06/10/2026 (pergunta P1 da S7).
    if (isPrecoAusente(lote)) return false
    const valor = evento.cenariosConfig?.overrides?.[cenario]?.[lote.id]
    return valor !== undefined && valor !== null && valor !== ''
  })
}

/** Guarda de publicação: insumo inválido vem antes do ajuste manual. */
export function avisoBreakEven(evento, s, cenarios) {
  if (!s) return null
  if (evento && (cenarioQuebrado(evento, s, cenarios) || receitaDoCenarioQuebrada(evento, s, cenarios)))
    return NUMERO_NAO_CALCULA
  return temQuantidadeTravada(evento, s.cenario) ? BREAK_EVEN_QUANTIDADE_TRAVADA : null
}

/** O texto curto, para onde cabe só uma linha (célula de tabela, dl do cartão). */
export const BREAK_EVEN_NAO_FECHA = 'não fecha nem vendendo tudo'

/**
 * A MESMA notícia, dita para as QUATRO superfícies que falam de RITMO de venda
 * ("faltam N ingressos → X por semana"): o card "Estamos vendendo no ritmo?",
 * a linha do card da Home, a linha do relatório/PDF e a leitura pela curva de
 * vendas. Todas as quatro derivam do break-even do cenário REALISTA — por isso
 * a frase o nomeia.
 *
 * Existe como constante, e não como texto solto em cada tela, porque foi
 * exatamente assim que o defeito nasceu: a régua nova passou a devolver `null`
 * também para "não fecha", UMA superfície ganhou frase própria e as outras
 * três continuaram sumindo com a linha (Marco, 27/07/2026). Linha que some diz
 * "não há nada para ver aqui" — e o que havia era prejuízo garantido.
 */
export const RITMO_NAO_FECHA =
  'O cenário realista não sai do prejuízo nem vendendo tudo — não há ritmo de vendas que alcance.'

/**
 * O valor do break-even como ele deve aparecer na tela.
 * `sufixo` é o que vem depois do número ('' na tabela, ' ingressos pagos' no
 * cartão, ' pagos' na apresentação) — o caso "não fecha" ignora o sufixo,
 * porque a frase já é uma frase. Com `evento` (e os três `cenarios`), as
 * guardas de `avisoBreakEven` vêm antes; sem eles, comportamento antigo.
 */
export function textoBreakEven(s, sufixo = '', evento = null, cenarios = undefined) {
  const aviso = avisoBreakEven(evento, s, cenarios)
  if (aviso) return aviso
  if (s?.breakEvenNaoFecha) return BREAK_EVEN_NAO_FECHA
  if (s?.breakEven == null) return DASH
  return `${fmtInt(s.breakEven)}${sufixo}`
}

/**
 * A frase de posição que fica embaixo do cartão do cenário: onde este cenário
 * está em relação ao próprio break-even. Devolve `null` quando não há o que
 * dizer: cenário sem ingresso pago e sem o aviso de "não fecha", ou dado
 * inválido (#98 — a faixa do campo quebrado já explica). Com quantidade
 * travada, a frase é o próprio aviso, sem "coberto"/"faltam".
 *
 * `tom` é 'ok' | 'alerta' — quem chama escolhe a cor; este módulo não conhece
 * cor (regra da casa: verde só no resultado).
 */
export function fraseBreakEvenDoCenario(s, evento = null, cenarios = undefined) {
  const aviso = avisoBreakEven(evento, s, cenarios)
  if (aviso === NUMERO_NAO_CALCULA) return null
  if (aviso) return { tom: 'alerta', texto: aviso }
  if (s?.breakEvenNaoFecha) {
    return {
      tom: 'alerta',
      texto: 'nem vendendo todos os ingressos este cenário sai do prejuízo',
    }
  }
  if (s?.breakEven == null || !(s?.pagos > 0)) return null
  if (s.pagos >= s.breakEven) {
    return {
      tom: 'ok',
      texto: `break-even coberto neste cenário (${fmtInt(s.pagos)} ≥ ${fmtInt(s.breakEven)})`,
    }
  }
  return {
    tom: 'alerta',
    texto: `faltam ${fmtInt(s.breakEven - s.pagos)} ingressos para o break-even`,
  }
}
