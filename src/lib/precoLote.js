// Preço de lote EXIBIDO por linha (H3-E — §7.2 do dossiê, 20/07/2026): estas
// três continhas moravam DUPLICADAS dentro do JSX (RevenueTab ×2 e
// ReportView), fora do Vitest — se a fórmula de desconto/taxa mudasse em
// calc.js, o golden não morderia essas telas e o Marco veria dois números
// para a mesma grandeza. Agora moram aqui, puras e testadas; os componentes
// só CHAMAM. Módulo IRMÃO de calc.js de propósito: calc.js está no portão do
// golden e este refactor não muda resultado nenhum — a paridade com as
// expressões antigas é pinada em precoLote.test.js.

import { num } from './util.js'

/** Fator do repasse (taxa paga pelo cliente): pós-desconto × (1 + taxa%). */
export const fatorTaxaCliente = (evento) => 1 + num(evento?.taxaBilheteria) / 100

/**
 * Preço EFETIVO da linha do lote: o preço de tabela líquido do desconto
 * efetivo do cenário (descontoEfetivoPct — a conta mora em calc.js; aqui só
 * se aplica o percentual já calculado).
 */
export const precoEfetivoLote = (valor, efetivoPct) => num(valor) * (1 - num(efetivoPct) / 100)

/** Preço final AO CLIENTE no repasse: efetivo × (1 + taxa). */
export const precoAoCliente = (valor, efetivoPct, evento) =>
  precoEfetivoLote(valor, efetivoPct) * fatorTaxaCliente(evento)

/**
 * Receita EFETIVA da linha do lote (decisão do Marco, 20/07/2026, no print
 * da tabela: "não quero a receita sem desconto, quero a efetiva"): preço
 * efetivo × tamanho do lote. Cortesia (valor 0) e "só otimista" continuam
 * valendo 0 na coluna — regra de exibição da própria tabela.
 */
export const receitaEfetivaLote = (lote, efetivoPct) =>
  lote?.somenteOtimista ? 0 : precoEfetivoLote(lote?.valor, efetivoPct) * num(lote?.quantidade)
