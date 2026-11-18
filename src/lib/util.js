// Utilidades básicas compartilhadas.

export const num = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return n === 0 ? 0 : n // normaliza -0
}

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const clone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj))

export const agora = () => new Date().toISOString()

/**
 * DINHEIRO EM CENTAVOS INTEIROS — a régua única da casa (Marco, 07/10/2026,
 * fichas "Receita total pode diferir em R$ 0,01 da soma das parcelas
 * impressas" e "Ponto flutuante no caminho do dinheiro" do BACKLOG).
 *
 * Toda PARCELA em reais que o motor publica (taxa, cashback, contingência,
 * ajuste do cenário, imposto, bar por pessoa, receita de cada lote) vira
 * centavos inteiros no ponto em que nasce, e todo TOTAL é a soma das parcelas
 * já arredondadas — nunca o arredondamento do total cru. É a mesma régua por
 * parcela que o Marco escolheu em 25/07/2026 para as somas de custo e
 * confirmou em 26/07/2026 contra a régua do total (ver a decisão datada no
 * BACKLOG): assim as parcelas impressas com centavos somam exatamente o total
 * impresso.
 *
 * MEIO CENTAVO VAI PARA LONGE DO ZERO — a régua do formatador (Intl,
 * `halfExpand`) e de `arredondadoComoAMoeda` (exibicaoQueFecha.js): R$ 0,005
 * vira R$ 0,01 e −R$ 0,005 vira −R$ 0,01. Quem decide o meio é o valor de
 * papel, não o jeito como o double o guardou: 51.302,565 chega aqui como
 * 51302.564999999995, e a folga relativa de 1e-14 (no máximo 1e-5 centavo)
 * devolve o meio que a conta de papel tem. Nenhuma fração de verdade fica a
 * menos de 1e-4 centavo do meio (preço e percentuais têm duas casas), então
 * a folga não muda o arredondamento de nenhum valor que não seja meio.
 *
 * ATÉ ONDE A RÉGUA É EXATA — medido, não suposto (07/10/2026, 200 mil meios
 * centavos de papel por faixa, "N,NN5" lido como double): até R$ 1 bilhão,
 * todos vão para longe do zero; de R$ 1 bilhão a R$ 10 bilhões, 6,3% vão para
 * baixo; de R$ 10 bilhões a R$ 10 trilhões, 5,7%. O que o app GARANTE é a faixa
 * do dinheiro que entra pela porta: até R$ 100 milhões (TETO_DINHEIRO, o teto
 * dos campos e da importação). `LIMITE_CENTAVO_EXATO` (R$ 10 trilhões) NÃO é
 * "centavo exato até aqui": é só onde a régua desiste e devolve o valor cru.
 *
 * O ABSURDO CONTINUA GRITANDO IGUAL. Só backup adulterado passa da porta de
 * R$ 100 milhões. Valor acima de `LIMITE_CENTAVO_EXATO`, Infinity ou NaN volta
 * EXATAMENTE como veio, e a soma volta a ser a crua, na mesma ordem: a guarda
 * do absurdo (dadoQuebrado.js) continua vendo os mesmos números de antes.
 */
export const LIMITE_CENTAVO_EXATO = 1e13

/** O número é dinheiro que cabe em centavos exatos? */
export const cabeEmCentavos = (v) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < LIMITE_CENTAVO_EXATO

/** Centavos com fração → centavos inteiros, meio para longe do zero. */
export function arredondarCentavos(centavos) {
  const a = centavos < 0 ? -centavos : centavos
  const r = Math.round(a + (a < 1e9 ? a * 1e-14 : 1e-5))
  return (centavos < 0 ? -r : r) + 0
}

/** Reais → reais em centavos exatos (fora da faixa, devolve o próprio valor). */
export const emCentavos = (v) => (cabeEmCentavos(v) ? arredondarCentavos(v * 100) / 100 + 0 : v)

/**
 * Soma de parcelas em reais, feita em centavos inteiros. Sinal vai na parcela:
 * `somaEmCentavos([receita, -imposto, -custo])`. Se alguma parcela não cabe em
 * centavos, devolve a soma crua na MESMA ordem — o que o código fazia antes.
 */
export function somaEmCentavos(valores) {
  let total = 0
  for (let i = 0; i < valores.length; i++) {
    if (!cabeEmCentavos(valores[i])) {
      let cru = 0
      for (let j = 0; j < valores.length; j++) cru += valores[j]
      return cru
    }
    total += arredondarCentavos(valores[i] * 100)
  }
  return total / 100 + 0
}

/**
 * Soma uma lista de valores em reais QUANTIZANDO cada parcela a centavos
 * ANTES de somar (Marco, 25/07/2026 — decisão sobre o achado do BACKLOG "a
 * soma de ponto flutuante não é associativa"). Cada parcela vira centavos
 * inteiros pela régua acima; a soma de inteiros É associativa e exata, então
 * reordenar a lista de origem deixa de mudar o último dígito exibido.
 * Diferente de `somaEmCentavos`, normaliza a ENTRADA com `num()` (texto e
 * vazio viram 0) — é a soma dos campos digitados (itens de custo).
 */
export const somaCentavos = (valores) =>
  (valores || []).reduce((s, v) => s + arredondarCentavos(num(v) * 100), 0) / 100

/**
 * O localStorage deste ambiente é USÁVEL para guardar/ler chave e valor?
 *
 * Por que não basta `typeof localStorage !== 'undefined'` (Marco, 24/07/2026):
 * o Node 22+ passou a expor um `localStorage` GLOBAL mesmo sem arquivo de
 * apoio válido — o global existe, mas `localStorage.getItem` NÃO é função
 * (medido: `TypeError: localStorage.getItem is not a function`). Quem só
 * testava `typeof localStorage === 'undefined'` escapava da guarda e ia
 * estourar no acesso, caindo no catch e imprimindo erro num caso que não é
 * erro: é ambiente sem armazenamento. Pior: o comportamento passou a depender
 * da versão do Node — no 20 a guarda pega, no 22+ não — e foi isso que deixou
 * o CI vermelho com a suíte local verde (achado S2 do BACKLOG, 24/07/2026).
 *
 * Checa as três funções que o app de fato chama, não a existência do global.
 * O `storage.js` já fazia essa defesa inline (com `length`/`key`, que é o que
 * ELE usa, por iterar as chaves da quarentena); este predicado é a mesma ideia
 * com nome, para os módulos que só leem e gravam por chave.
 *
 * No NAVEGADOR isto é sempre `true` — a defesa existe para ambiente de teste
 * e para perfil de navegador com armazenamento desligado.
 */
export const armazenamentoUsavel = () =>
  typeof localStorage !== 'undefined' &&
  localStorage !== null &&
  typeof localStorage.getItem === 'function' &&
  typeof localStorage.setItem === 'function' &&
  typeof localStorage.removeItem === 'function'
