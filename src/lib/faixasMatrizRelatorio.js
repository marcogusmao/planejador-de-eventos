// Limite de apresentação; os dados e sua ordem vêm de benchmarksAtivos.
export const REFERENCIAS_POR_FAIXA = 4

export function dividirReferenciasEmFaixas(referencias) {
  const faixas = []
  for (let inicio = 0; inicio < referencias.length; inicio += REFERENCIAS_POR_FAIXA) {
    faixas.push(referencias.slice(inicio, inicio + REFERENCIAS_POR_FAIXA))
  }
  return faixas
}
