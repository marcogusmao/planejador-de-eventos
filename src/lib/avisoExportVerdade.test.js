// O AVISO DO EXPORT TEM DE SER VERDADE — o cadeado do S2 de 20/07/2026.
//
// O defeito: o aviso do plano para o Financeiro afirmava, categórico, que
// "este arquivo NÃO leva esses valores: ele leva o PREVISTO (o orçamento)".
// Isso é verdade para as LINHAS DE CUSTO e FALSO com contingência ligada — que
// é o caso comum, não uma borda. A linha de contingência exportada é
// `pct × totalConsiderado`, e `valorConsiderado()` (calc.js) PRIORIZA o
// realizado: o arquivo leva sim dinheiro derivado do realizado.
//
// O conserto escolhido foi (a) — tornar o TEXTO verdadeiro, sem mexer em
// nenhum valor exportado. Estes testes cobram as duas metades da promessa:
// que as linhas de item de fato vão pelo estimado, e que o aviso DECLARA a
// exceção da contingência sempre que ela existir.

import { describe, it, expect } from 'vitest'
import { montarItensPlano } from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { computeCenario } from './calc.js'
import { num } from './util.js'
import { fmtBRL } from './format.js'

// Evento com realizado CHEIO nos custos — o caso em que o aviso aparece.
function eventoComRealizado(contingenciaPct) {
  const e = novoEvento('Marfim 09/05')
  e.tipo = 'Marfim Alto'
  e.data = '2026-05-09'
  e.contingenciaPct = contingenciaPct
  e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })]
  e.categorias = [
    {
      id: 'aeb',
      nome: 'A&B',
      padrao: true,
      // Estimado 10.000, realizado 14.000: se algo no arquivo usar o
      // considerado, a diferença de 4.000 aparece.
      itens: [novoItem({ servico: 'Bebidas', estimado: 10000, realizado: 14000 })],
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      padrao: true,
      itens: [novoItem({ servico: 'DJ', estimado: 8000 })], // sem realizado
    },
  ]
  return e
}

const avisoDoRealizado = (avisos) => avisos.find((a) => a.includes('realizado preenchido'))
const linhaContingencia = (itens) => itens.find((i) => i.rotulo.startsWith('Contingência'))

describe('o aviso do export diz a verdade — SEM contingência', () => {
  const e = eventoComRealizado(0)
  const { itens, avisos } = montarItensPlano(e)

  it('não há linha de contingência no arquivo', () => {
    expect(linhaContingencia(itens)).toBeUndefined()
  })

  it('toda linha de custo leva o ESTIMADO, nenhuma leva o realizado', () => {
    const custos = itens.filter((i) => i.grupo === 'custo')
    expect(custos.map((i) => i.valor).sort((a, b) => a - b)).toEqual([8000, 10000])
    expect(custos.some((i) => i.valor === 14000)).toBe(false)
  })

  it('o aviso aparece e NÃO fala em exceção — porque aqui não existe nenhuma', () => {
    const aviso = avisoDoRealizado(avisos)
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('LINHAS DE CUSTO')
    expect(aviso).toContain('PREVISTO (o orçamento)')
    expect(aviso).not.toContain('contingência')
  })
})

describe('o aviso do export diz a verdade — COM contingência (o caso comum)', () => {
  const e = eventoComRealizado(10)
  const { itens, avisos } = montarItensPlano(e)
  const cen = computeCenario(e, 'realista')

  it('a linha de contingência exportada É derivada do realizado — o fato que o aviso tem de contar', () => {
    const cont = linhaContingencia(itens)
    expect(cont).toBeTruthy()
    // Base CONSIDERADA: 14.000 (realizado do Bebidas) + 8.000 (estimado do DJ).
    expect(cont.valor).toBeCloseTo(2200, 6)
    // Se fosse pelo estimado seria 1.800. A diferença é justamente o que o
    // aviso antigo jurava que não estava no arquivo.
    expect(cont.valor).not.toBeCloseTo(1800, 6)
    expect(cont.valor).toBeCloseTo(cen.contingencia, 6)
  })

  it('o aviso DECLARA a exceção, com o valor e a base — nada de promessa categórica falsa', () => {
    const aviso = avisoDoRealizado(avisos)
    expect(aviso).toBeTruthy()
    // A afirmação categórica que era falsa não existe mais.
    expect(aviso).not.toMatch(/este arquivo NÃO leva esses valores/)
    // A promessa verdadeira, restrita ao que ela cobre:
    expect(aviso).toContain('LINHAS DE CUSTO')
    // E a exceção, dita por extenso:
    expect(aviso).toContain('contingência')
    expect(aviso).toContain('CONSIDERADO')
    expect(aviso).toContain('usa o realizado onde ele existe')
    // Pelo formatador da casa (fmtBRL usa espaço não-separável): o aviso cita
    // o valor EXATO que o arquivo leva, para o Marco conferir linha a linha.
    expect(aviso).toContain(fmtBRL(linhaContingencia(itens).valor))
    expect(aviso).toContain('10%')
  })

  it('mesmo com contingência, as LINHAS DE ITEM seguem pelo estimado (o número não mudou)', () => {
    const custosItem = itens.filter((i) => i.grupo === 'custo' && !i.rotulo.startsWith('Contingência'))
    expect(custosItem.map((i) => i.valor).sort((a, b) => a - b)).toEqual([8000, 10000])
  })

  it('a contingência é o ÚNICO valor do arquivo derivado do realizado — o aviso não mente por omissão', () => {
    // Varre TODO o arquivo: nenhum outro valor pode bater com o considerado
    // quando ele difere do estimado. Se um dia outra linha passar a usar o
    // realizado, este teste cai e o aviso volta a ser revisto.
    const suspeitos = itens
      .filter((i) => !i.rotulo.startsWith('Contingência'))
      .filter((i) => Math.abs(num(i.valor) - 14000) < 0.005)
    expect(suspeitos).toEqual([])
  })
})

describe('sem nenhum realizado, o aviso nem aparece', () => {
  it('evento só com estimado não ganha o aviso', () => {
    const e = eventoComRealizado(10)
    e.categorias[0].itens[0].realizado = ''
    const { avisos } = montarItensPlano(e)
    expect(avisoDoRealizado(avisos)).toBeUndefined()
  })
})
