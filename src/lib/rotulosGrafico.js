// Empilhamento de rótulos próximos no topo dos gráficos (LinhasCurva) — módulo
// puro, sem React, para ter teste homônimo. Motivação: no "Saldo dia a dia" o
// rótulo "hoje" e o marco "início de vendas" saíam no mesmo x/y e se escreviam
// um por cima do outro quando as datas eram próximas (handoff UX 23/07, Marco:
// "mto mal feito"). Aqui só decidimos a LINHA de cada rótulo — a geometria (x,
// cor, linha vertical) e nenhum número de negócio passam por aqui.

/**
 * Dada uma lista de posições horizontais JÁ ORDENADAS (px crescente), devolve
 * a linha de cada rótulo (0 = topo). Um rótulo a menos de `gap` px do último
 * colocado na sua linha desce para a próxima linha, em vez de sobrepor.
 * Guloso da esquerda para a direita: sempre a linha mais alta que ainda tem
 * folga. Sem colisão, todos ficam na linha 0 (desenho idêntico ao de antes).
 *
 * @param {number[]} pxsOrdenados posições x em px, crescentes
 * @param {number} gap distância mínima em px entre rótulos na mesma linha
 * @returns {number[]} linha (>=0) de cada rótulo, na mesma ordem da entrada
 */
export function linhasParaRotulosProximos(pxsOrdenados, gap) {
  const ultimoPx = [] // px do último rótulo já colocado em cada linha
  return pxsOrdenados.map((px) => {
    let linha = 0
    while (ultimoPx[linha] != null && px - ultimoPx[linha] < gap) linha++
    ultimoPx[linha] = px
    return linha
  })
}
