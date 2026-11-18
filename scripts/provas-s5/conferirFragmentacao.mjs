// O cabeçalho esperado vem do DOM real antes de repetir as linhas sintéticas.
// Cada página precisa conservar TODOS os termos, inclusive multiplicidades.
const termos = texto => texto.trim().split(/\s+/).filter(Boolean).sort()

export function conferirFragmentacao(paginas, cabecalhoEsperado) {
  const falhas = []
  const esperado = JSON.stringify(termos(cabecalhoEsperado))
  const provas = paginas.flatMap((texto, i) => {
    if (!/Linha L\d+/.test(texto)) return []
    const inicio = texto.indexOf('Referências 1–4 de 4')
    const fim = texto.search(/Linha L\d+/)
    const cabecalho = inicio >= 0 && JSON.stringify(termos(texto.slice(inicio, fim))) === esperado
    if (!cabecalho) falhas.push(`Página ${i + 1}: continuação sem cabeçalho completo da faixa/referências.`)
    return [{ pagina: i + 1, linhas: texto.match(/Linha L\d+/g), cabecalho }]
  })
  const todos = provas.flatMap(p => p.linhas)
  for (let i = 1; i <= 72; i++) {
    const nome = `Linha L${String(i).padStart(3, '0')}`
    if (todos.filter(t => t === nome).length !== 1) falhas.push(`${nome}: ausente ou repetida.`)
  }
  if (provas.length < 2) falhas.push('O diagnóstico não forçou continuação entre páginas.')
  const totais = provas.reduce((n, p) => n + (paginas[p.pagina - 1].match(/^\s*Custo total\s+R\$/gm) || []).length, 0)
  if (totais !== 1) falhas.push(`Total repetido ou ausente: ${totais}.`)
  return { paginas: provas, falhas }
}
