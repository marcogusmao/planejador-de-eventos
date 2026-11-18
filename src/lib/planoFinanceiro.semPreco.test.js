// Export do plano ao Financeiro com lote sem preço (P8 — aviso aprovado pelo
// Marco em 06/10/2026). Os números exportados já saem sem o lote (calc.js);
// o que faltava era a revisão dizer POR QUÊ. Evento montado aqui, igual ao
// `eventoSemPreco` das provas da S0 (não se importa de scripts/).
import { describe, it, expect } from 'vitest'
import { montarItensPlano } from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem, TIPOS_PADRAO } from './defaults.js'

function festaP8() {
  const e = novoEvento('Festa P8')
  e.tipo = TIPOS_PADRAO[0]
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Camarote', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}

const receitas = (r) =>
  Object.fromEntries(r.itens.filter((i) => i.grupo !== 'custo').map((i) => [i.rotulo, i.valor]))

const AVISO =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'

describe('export do plano com lote sem preço', () => {
  it('a revisão diz que o lote ficou de fora — e os números são os mesmos de sem o lote', () => {
    const e = festaP8()
    const r = montarItensPlano(e)
    expect(r.bloqueios).toEqual([]) // controle: o export não parou antes de chegar ao aviso
    expect(r.avisos).toContain(AVISO)
    expect(receitas(r)).toEqual({ 'Ingressos (bilheteria)': 54000, 'Bar / Consumo': 61155 })

    const semLote = festaP8()
    semLote.lotes = semLote.lotes.filter((l) => l.id !== 'l4')
    const r2 = montarItensPlano(semLote)
    expect(receitas(r2)).toEqual(receitas(r))
    expect(r2.avisos).not.toContain(AVISO)
  })

  it('preço 0 declarado é cortesia: nenhum aviso de lote sem preço', () => {
    const e = festaP8()
    e.lotes.find((l) => l.id === 'l4').valor = 0
    expect(montarItensPlano(e).avisos.some((a) => a.includes('sem preço'))).toBe(false)
  })

  it('lote em branco de evento novo (quantidade vazia, sem ajuste) não avisa', () => {
    const e = festaP8()
    Object.assign(e.lotes.find((l) => l.id === 'l4'), { quantidade: '' })
    expect(montarItensPlano(e).avisos.some((a) => a.includes('sem preço'))).toBe(false)
  })

  it('evento bloqueado (sem Festa) continua só com o bloqueio — o aviso não passa à frente', () => {
    const e = festaP8()
    e.tipo = ''
    const r = montarItensPlano(e)
    expect(r.bloqueios).toHaveLength(1)
    expect(r.avisos).not.toContain(AVISO)
  })
})
