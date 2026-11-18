// A conta da BILHETERIA LÍQUIDA a partir de uma bruta qualquer — taxa e
// cashback — isolada num módulo puro para o Fechamento poder aplicá-la sobre a
// bilheteria REALIZADA (um número que o Marco digita depois da festa e que
// `computeCenario` nunca vê).
//
// FONTE ÚNICA DESDE 07/10/2026 (régua do centavo, aprovada pelo Marco junto
// com o diff do golden). Até essa data a mesma conta existia em TRÊS lugares —
// aqui, dentro de `bilheteria()` em calc.js e no ramo de ticket manual de
// `computeCenarioNucleo()` —, porque calc.js é portão e não se abria para
// mover uma linha. Quando o portão abriu para arredondar cada parcela ao
// centavo, as duas cópias de calc.js passaram a CHAMAR esta função: a régua
// do centavo é escrita uma vez só, e o Fechamento e os Cenários não têm mais
// como divergir sobre taxa e cashback.
//
// `receitaLiquida.test.js` continua cobrando, para uma grade de taxas,
// cashbacks, modos e valores, que esta função devolva EXATAMENTE o que
// `bilheteria()` devolve — agora como prova de que calc.js não voltou a ter
// uma cópia própria.
import { num, emCentavos, somaEmCentavos } from './util.js'

/**
 * Líquida de uma bilheteria BRUTA, pelas duas regras do app, cada parcela em
 * centavos exatos (régua do centavo, util.js — meio centavo para longe do zero):
 *
 *   taxa     = bruta × taxaPct/100          (arredondada ao centavo)
 *   cashback = bruta × cashbackPct/100      (arredondado ao centavo)
 *   líquida  = bruta − taxa + cashback      (taxa paga por NÓS, padrão)
 *   líquida  = bruta + cashback             (taxa paga pelo CLIENTE — repasse)
 *
 * `taxaCliente` (sugestão 29b) é o modo REPASSE: a taxa continua sendo
 * calculada e devolvida — é o que o cliente paga por fora, e a tela precisa
 * nomear isso —, mas NÃO desconta da líquida. Errar este ramo inverte o sinal
 * do resultado do evento, então ele é caso de teste próprio.
 *
 * O cashback da Tiqueteira (% dos ingressos que volta para a produção) é
 * inalterado nos dois modos.
 *
 * Devolve `{ bruta, taxa, cashback, liquida }` — os quatro números, porque
 * pela régua da casa todo passo da conta tem LINHA na tela, com valor em R$.
 */
export function liquidaDeBruta(bruta, taxaPct, cashbackPct = 0, taxaCliente = false) {
  const b = emCentavos(typeof bruta === 'number' ? bruta : num(bruta))
  const taxa = emCentavos((b * num(taxaPct)) / 100)
  const cashback = emCentavos((b * num(cashbackPct)) / 100)
  const liquida = taxaCliente ? somaEmCentavos([b, cashback]) : somaEmCentavos([b, -taxa, cashback])
  return { bruta: b, taxa, cashback, liquida }
}
