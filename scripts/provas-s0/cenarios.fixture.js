import { novoEvento, novoLote, novoItem } from '../../src/lib/defaults.js'

export function eventoSemPreco() {
  const e = novoEvento('S0 — evento sintético com preço ausente')
  e.data = '2027-01-01'
  e.categorias = e.categorias.map(c => ({ ...c, itens: c.id === 'aeb'
    ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [] }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Lote sem preço', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}

export function eventoTravado(quantidades = [400, 600, 200]) {
  const e = novoEvento('S0 — evento sintético com quantidades travadas')
  e.data = '2027-01-01'
  e.contingenciaPct = 10
  e.barTicket = { pessimista: 55, realista: 55, otimista: 55 }
  e.categorias = e.categorias.map(c => ({ ...c, itens: c.id === 'aeb'
    ? [novoItem({ id: 'custo', estimado: 65200, servico: 'Custo sintético' }),
       novoItem({ id: 'sistema', estimado: 4800, servico: 'Sistema sintético' })] : [] }))
  e.lotes = [
    novoLote({ id: 'l1', valor: 60, quantidade: 400, nome: 'Lote 1' }),
    novoLote({ id: 'l2', valor: 90, quantidade: 600, nome: 'Lote 2' }),
    novoLote({ id: 'l3', valor: 120, quantidade: 200, nome: 'Lote 3' }),
  ]
  e.cenariosConfig.overrides.realista = Object.fromEntries(e.lotes.map((l, i) => [l.id, quantidades[i]]))
  return e
}
