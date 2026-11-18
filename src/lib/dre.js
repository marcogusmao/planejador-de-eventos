import { num, somaEmCentavos } from './util.js'
import { fmtBRL2, DASH } from './format.js'

/**
 * Linha "Ajuste de custos do cenário" do DRE (Sessão de Clareza do DRE,
 * 19/07/2026 — decisão do Marco).
 *
 * PROBLEMA que ela resolve: o DRE mostrava
 *
 *     Custos (itens)           133.200
 *     Contingência (3,5%)        4.662
 *     Custo total do cenário   144.755   ← não fecha somando
 *
 * A conta estava CERTA (o ajuste de custos por cenário, +5% no pessimista,
 * age por cima), mas a explicação morava em outra tela. Quem lê o DRE numa
 * reunião somava as linhas e não fechava — e desconfiar de um número certo é
 * quase tão ruim quanto mostrar um errado.
 *
 * REGRA DA CASA que esta linha materializa: toda coluna do DRE tem que somar
 * na frente de quem lê. Se existe um passo na conta, ele tem linha.
 *
 * COMO O VALOR É DERIVADO — e por que por diferença, não por fórmula própria.
 * Em calc.js a conta é (desde 07/10/2026, régua do centavo — o ajuste é uma
 * PARCELA, arredondada ao centavo sozinha, como as outras linhas):
 *
 *     custoBase  = custoItens + contingencia
 *     custoTotal = custoBase + centavos(custoBase × ajustePct / 100)
 *
 * Logo `custoTotal − (custoItens + contingencia)` é EXATAMENTE o ajuste: os
 * dois termos subtraídos são os mesmos campos que o DRE exibe nas duas linhas
 * de cima, e nada mais entra em custoTotal. Derivar por diferença (em vez de
 * recalcular custoBase × ajustePct/100) garante que a coluna FECHA na tela ao
 * centavo: o que a linha mostra é, por construção, o que falta para chegar no
 * total exibido. A diferença é feita em centavos inteiros (`somaEmCentavos`),
 * então o valor sai exato, sem o resíduo de ponto flutuante.
 *
 * Não cria campo novo em calc.js e não muda nenhum número — só dá nome e
 * lugar a um passo que já existia na conta.
 */
export const ajusteCustoValor = (c) =>
  somaEmCentavos([num(c?.custoTotal), -somaEmCentavos([num(c?.custoItens), num(c?.contingencia)])])

/**
 * Texto da célula: sinal explícito + valor, no estilo das outras linhas de
 * movimento do DRE ("− R$ 1.234" na taxa, "+ R$ 500" no cashback), com o %
 * do cenário entre parênteses para o leitor conferir a origem.
 *
 * Ajuste zero vira travessão — coerente com o resto do DRE, e some da soma
 * sem deixar buraco (0 não muda o total).
 */
export function ajusteCustoTexto(c) {
  const v = ajusteCustoValor(c)
  const pct = num(c?.ajustePct)
  // Trava de coerência: sem ajuste (0%) a diferença é 0 e a linha é travessão.
  // Usa o VALOR (não só o %) para decidir: é ele que precisa fechar a coluna.
  if (Math.abs(v) < 0.005) return DASH
  const sinal = v > 0 ? '+' : '−'
  const pctTxt = pct === 0 ? '' : ` (${pct > 0 ? '+' : '−'}${Math.abs(pct)}%)`
  return `${sinal} ${fmtBRL2(Math.abs(v))}${pctTxt}`
}

export const AJUSTE_CUSTO_LABEL = 'Ajuste de custos do cenário'
