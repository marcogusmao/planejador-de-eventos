import { expect, it } from 'vitest'
import { prepararAplicacaoFinanceiro, montarPropostas } from './financeiro.js'
const em = '2026-10-05T12:00:00Z'
it('reconhecer retorno sem ID tira o aviso de ausente e não chama contribuição atualizada de mantida', () => {
 const origem = { eventoId: 71, categoriaId: 10, categoria: 'Equipe', valor: 5000, em }
 const evento = { id: 'festa', categorias: [{ id: 'equipe', nome: 'Equipe', itens: [
  { id: 'item', servico: 'Equipe', estimado: 8000, realizado: 5000, viaFinanceiro: { versao: 2, valor: 5000, em, origens: [origem] } },
 ] }] }
 const ef = { id: 71, nome: 'Festa', receitaIngressos: 0, custosPorCategoria: [{ categoriaId: null, categoria: 'Equipe nova', total: 5300 }], planoRealizado: { receita: 0, custos: 0 } }
 const p = montarPropostas(evento, ef).propostas[0]
 const escolha = { selecionado: true, destino: { tipo: 'existente', catId: 'equipe', itemId: 'item' }, substituiOrigemLegada: JSON.stringify(['id',71,10]) }
 const r = prepararAplicacaoFinanceiro(evento, ef, { [p.id]: escolha }, { em })
 expect(r.ok).toBe(true)
 expect(r.grupos[0].total).toBe(5300)
 expect(r.grupos[0].mantidas).toEqual([])
 expect(r.avisos.some(a => a.includes('não veio'))).toBe(false)
 const desmarcada = prepararAplicacaoFinanceiro(evento, ef, { [p.id]: { ...escolha, selecionado: false } }, { em })
 expect(desmarcada.avisos.some(a => a.includes('5.000') && a.includes('não veio'))).toBe(true)
 expect(desmarcada.evento).toBe(evento)
 for (const [base, resposta] of [[{ ...evento, status: 'fechado' }, ef], [evento, { ...ef, receitaIngressos: 1.005 }]]) {
  const recusada = prepararAplicacaoFinanceiro(base, resposta, { [p.id]: escolha }, { em })
  expect(recusada.ok).toBe(false)
  expect(recusada.evento).toBe(base)
  expect(recusada.avisos).toEqual(montarPropostas(base, resposta).avisos)
 }
})
