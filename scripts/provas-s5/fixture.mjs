// Dados sintéticos compartilhados pelas provas de PDF e de navegação S5.
import { novoEvento, novoLote, novoItem } from '../../src/lib/defaults.js'
import { FIXED_BENCHMARKS } from '../../src/lib/benchmarks.js'

export function fixtureMatriz(n, montarBenchmarkDeEvento, longo = false) {
  const evento = novoEvento('S5 — relatório sintético')
  evento.id = 's5-prova'
  evento.data = '2027-01-01'
  evento.tipo = 'Brisa'
  evento.lotes = [novoLote({ valor: 100, quantidade: 1000 })]
  evento.categorias = evento.categorias.map((c, i) => ({ ...c, itens: [
    novoItem({ servico: `Custo sintético ${i}`, estimado: 5000 + i * 123 }),
  ] }))
  const benchmarksCustom = Array.from({ length: n }, (_, i) => {
    const b = novoEvento(`Referência sintética ${i + 1}`)
    b.receitaRealizada = { bilheteria: 250000 + i * 1000, bar: 5000 }
    b.categorias = b.categorias.map((c, j) => ({ ...c, itens: [
      novoItem({ servico: 'Custo sintético', estimado: 10000 + i * 1000 + j * 111,
        realizado: 10000 + i * 1000 + j * 111 }),
    ] }))
    const benchmark = { ...montarBenchmarkDeEvento(b), id: `s5-ref-${i}`, nome: b.nome }
    if (longo) {
      benchmark.nome += ' — encontro de fornecedores e produção da festa ' + 'NomeSemEspacos'.repeat(5)
      benchmark.custos.equipe = 123456789012 + i
      benchmark.custoTotal = 123456900000 + i
      benchmark.obs = 'Observação sintética preservada após a última faixa.'
    }
    return benchmark
  })
  evento.benchmarksAtivos = benchmarksCustom.map(b => b.id)
  const store = { eventos: [evento], benchmarksCustom,
    benchmarksApagados: FIXED_BENCHMARKS.map(b => b.id), benchmarkOverrides: {}, ajustes: {} }
  return { evento, store, referencias: benchmarksCustom }
}
