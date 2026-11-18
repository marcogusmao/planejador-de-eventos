// Custo marcado "custou zero" no arquivo do plano (S2; decisão do Marco,
// 07/10/2026, por questionário): a tela conta R$ 0, então a linha NÃO vai para
// o Financeiro, e o custo é nomeado em "Fora deste arquivo" com os dois números.
// Antes o arquivo mandava o estimado (R$ 8.000) calado, e a conferência dizia
// "confere".
import { describe, it, expect } from 'vitest'
import { montarItensPlano, gerarCSVPlano } from './planoFinanceiro.js'
import { computeCenario } from './calc.js'
import { novoEvento, novoLote, novoItem, TIPOS_PADRAO } from './defaults.js'

function festa({ marcado = true, realizado = '' } = {}) {
  const e = novoEvento('Festa permuta')
  e.tipo = TIPOS_PADRAO[0]
  e.data = '2027-01-01'
  e.contingenciaPct = 5
  e.lotes = [novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 1000 })]
  const permuta = novoItem({ id: 'p', estimado: 8000, servico: 'Buffet permuta', realizado })
  if (marcado) permuta.custouZero = true
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [permuta, novoItem({ id: 'x', estimado: 20000, servico: 'Bebidas' })] : [],
  }))
  return e
}

const custos = (r) => Object.fromEntries(r.itens.filter((i) => i.grupo === 'custo').map((i) => [i.rotulo, i.valor]))
const textos = (r) => [...r.avisos, ...r.alertas, ...r.foraDoArquivo.map((f) => `${f.rotulo} ${f.explicacao}`)].join('\n')

describe('custo "custou zero" no arquivo do plano', () => {
  it('a linha não vai, e o custo aparece em "Fora deste arquivo" com R$ 0 e o estimado', () => {
    const e = festa()
    const r = montarItensPlano(e)
    expect(computeCenario(e, 'realista').custoItens).toBe(20000) // controle: a tela conta zero
    expect(custos(r)).toEqual({ Bebidas: 20000, 'Contingência (5%)': 1000 })
    expect(gerarCSVPlano(r.itens, e)).not.toContain('Buffet permuta')
    const fora = r.foraDoArquivo.find((f) => f.rotulo.startsWith('Buffet permuta'))
    expect(fora).toBeTruthy()
    expect(fora.valor).toBe(0)
    expect(fora.explicacao).toContain('R$ 0 na aba Custos')
    expect(fora.explicacao).toMatch(/estimado R\$\s8\.000\)/) // fmtBRL usa espaço não separável
    expect(r.alertas).toEqual([]) // o bloco confere em zero: nada de alarme falso
    // O Financeiro REMOVE a linha que o plano deixou de produzir, pela prévia de
    // importação (commit e1e3555 de lá, 07/08/2026). A primeira versão deste
    // texto dizia o contrário e mandava apagar à mão (corrigido em 07/10/2026).
    expect(fora.explicacao).toContain('a prévia a lista como linha que o plano não produz mais')
    expect(fora.explicacao).not.toMatch(/não remove|apague-a lá à mão/)
  })

  it('o aviso de "realizado preenchido" não conta a permuta como realizado de R$ 0', () => {
    expect(montarItensPlano(festa()).avisos.some((a) => a.includes('realizado preenchido'))).toBe(false)
  })

  it('SEM a marcação, o mesmo custo de R$ 8.000 vai no arquivo e não ganha texto novo (falso positivo)', () => {
    const r = montarItensPlano(festa({ marcado: false }))
    expect(custos(r)['Buffet permuta']).toBe(8000)
    expect(textos(r)).not.toContain('custou zero')
    expect(textos(r)).not.toContain('Buffet permuta')
  })

  it('marcado mas com realizado > 0: a marcação não vale (P1 de 20/07) — a linha vai pelo previsto, como antes', () => {
    const r = montarItensPlano(festa({ realizado: 3000 }))
    expect(custos(r)['Buffet permuta']).toBe(8000)
    expect(r.foraDoArquivo.some((f) => f.rotulo.includes('custou zero'))).toBe(false)
  })
})
