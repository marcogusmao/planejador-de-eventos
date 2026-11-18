// Os números que o leitor SUBTRAI têm de fechar na tela (Marco, 07/08/2026, por
// questionário — decisão sobre o "drift de R$ 1 no Lucro").
//
// ————— desde 07/10/2026, nenhuma tela chama `lucroQueFecha` —————
//
// Plano dos centavos (Marco, por questionário): o DRE passou a mostrar centavos
// e imprime o lucro do motor (P3); os cartões de lucro (aba Cenários,
// relatório, apresentação) também passaram a mostrar Receita, Imposto, Custo e
// Lucro com centavos (P6 refeito). Como o motor publica tudo em centavos exatos,
// a regra deste módulo continua valendo sem ele: o lucro escrito é a subtração
// das linhas escritas ao lado — e é o mesmo número do DRE. `lucroQueFecha` fica
// aqui com o teste dele; `resultadoQueFecha` segue em uso nos cartões de evento
// FECHADO, que continuam em reais inteiros.
//
// ————— o defeito —————
//
// `fmtBRL(v, 0)` arredonda cada valor SOZINHO, e as telas o chamam três vezes
// independentes: Receita, Custo e Lucro. A conta interna está certa (o lucro é
// uma subtração exata), mas o que se lê na folha não fecha:
//
//     Receita R$ 100.003 − Custo R$ 40.001   quem soma na mão vê  R$ 60.002
//                                            o app exibe          R$ 60.001
//
// Nada reconcilia, e sai assim em três telas — Apresentação, Relatório Resumido
// e Completo —, inclusive no PDF que vai para as sócias. Quem confere na mão
// conclui que a conta do app está errada. Ela não está: a EXIBIÇÃO é que não
// fechava.
//
// ————— a régua, e por que ela não é `Math.round` —————
//
// O arredondamento tem de ser BYTE A BYTE o mesmo do formatador, senão a
// reconciliação erra sozinha. `Intl.NumberFormat` arredonda meio para LONGE do
// zero (`halfExpand`, o padrão da especificação): −0,5 vira −1. `Math.round`
// arredonda meio para CIMA: −0,5 vira −0. Num app onde prejuízo é fato e custo
// negativo existe, a diferença aparece.
//
// Há teste varrendo isso: para uma faixa de valores com meio real exato, dos
// dois sinais, `fmtBRL(arredondadoComoAMoeda(v))` tem de ser IDÊNTICO a
// `fmtBRL(v)`.
//
// ————— o que este módulo NÃO faz —————
//
// Nenhuma conta de negócio muda. `calc.js` continua devolvendo o lucro exato
// (`receitaTotal − imposto − custoTotal`, linha 561) e é ele que alimenta
// margem, break-even, semáforo e tudo o mais. O que este módulo devolve serve
// para UMA coisa: o número que vai ser IMPRESSO ao lado dos seus componentes.
// O risco está declarado e foi aceito pelo Marco: em alguns eventos o lucro
// impresso muda em R$ 1 — para bater com a subtração que ele está lendo.

import { num } from './util.js'
// O imposto vem de `impostoValor`, a MESMA função que a tela imprime — e isso é
// o ponto, não detalhe. `cenario.imposto` é um OBJETO (alíquota, bases, valor);
// lê-lo como número dá zero, e o lucro "reconciliado" sairia sem descontar o
// imposto. Foi o defeito que a primeira versão deste módulo teve, pego pelo
// teste que lê os números do DOM (`impostoNaTela.evidencia.test.jsx`).
import { impostoValor } from './imposto.js'

/**
 * Arredonda como a moeda arredonda: meio para LONGE do zero.
 * É a régua do `Intl.NumberFormat` (`roundingMode: 'halfExpand'`, o padrão).
 */
export const arredondadoComoAMoeda = (v) => {
  const n = num(v)
  return n < 0 ? -Math.round(-n) : Math.round(n)
}

/**
 * O LUCRO que a tela deve imprimir para fechar com a Receita e o Custo que ela
 * imprime ao lado — os MESMOS três termos do `calc.js:561`.
 *
 * Recebe o cenário inteiro (e não os três números soltos) de propósito: quem
 * chama não escolhe quais termos entram, então a linha impressa não tem como
 * discordar da conta por esquecimento. `imposto` ausente conta como zero, que é
 * o que a tela faz quando não há imposto configurado.
 */
export function lucroQueFecha(cenario = {}) {
  return (
    arredondadoComoAMoeda(cenario.receitaTotal) -
    arredondadoComoAMoeda(impostoValor(cenario)) -
    arredondadoComoAMoeda(cenario.custoTotal)
  )
}

/**
 * O mesmo, para o par simples "receita − custo" (o card de evento FECHADO, que
 * imprime o resultado real ao lado da receita real e dos custos considerados).
 */
export function resultadoQueFecha({ receita, imposto = 0, custos } = {}) {
  // Aqui o imposto chega como NÚMERO (a fotografia do fechamento guarda
  // `imposto: {valor}` e quem chama passa `.valor`), então não passa pelo
  // `impostoValor` — que espera o cenário inteiro.
  return (
    arredondadoComoAMoeda(receita) - arredondadoComoAMoeda(imposto) - arredondadoComoAMoeda(custos)
  )
}
