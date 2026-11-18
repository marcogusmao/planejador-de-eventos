import { describe, it, expect } from 'vitest'
import { novoEvento } from './defaults.js'
import { computeCenario } from './calc.js'
import { fechamentoReceita, resultadoRealizado, montarBenchmarkDeEvento } from './fechamento.js'
import { montarFotoFechamento } from './fechamentoEvento.js'
import { migrarEvento } from './migracao.js'
import { montarBackup, parseBackup } from './storage.js'
import { duplicarCopia, duplicarNovaEdicao } from './novaEdicao.js'

const evento = (pix) => ({
  ...novoEvento('Festa de teste Pix'),
  taxaBilheteria: 13,
  cashbackPct: 5,
  impostoPct: 10,
  impostoSobre: { bilheteria: true, bar: true, patrocinio: true },
  receitaRealizada: { bilheteria: 10000, bar: 2000, ...(pix === undefined ? {} : { pix }) },
  categorias: [],
})
const resultado = (e) => resultadoRealizado(e, computeCenario(e, 'realista'))

describe('Pix líquido adicional no fechamento — Marco, 28/09/2026', () => {
  it('soma integralmente sem taxa, cashback ou imposto automático, inclusive em open bar', () => {
    for (const openBar of [false, true]) {
      const antes = { ...evento(), openBar }
      const depois = { ...antes, receitaRealizada: { ...antes.receitaRealizada, pix: 1234.56 } }
      const a = resultado(antes)
      const b = resultado(depois)
      expect(b.receita - a.receita).toBeCloseTo(1234.56, 8)
      expect(b.resultado - a.resultado).toBeCloseTo(1234.56, 8)
      expect(b).toMatchObject({ pix: 1234.56, taxa: a.taxa, cashback: a.cashback, imposto: a.imposto })
      expect(computeCenario(depois, 'realista')).toEqual(computeCenario(antes, 'realista'))
    }
  })

  it('vazio ou ausente preserva o resultado antigo; zero informado tem linha própria', () => {
    expect(resultado(evento(''))).toEqual(resultado(evento()))
    const e = evento(0)
    const rec = fechamentoReceita(e, computeCenario(e, 'realista'))
    expect(rec.linhas.find(l => l.nome === 'Pix recebido (líquido)')).toMatchObject({ realizado: 0, temRealizado: true })
    expect(resultado(e).resultado).toBe(resultado(evento()).resultado)
  })

  it('Pix sozinho não esconde a bilheteria prevista nem permite fechar sem informá-la', () => {
    const e = evento(1000)
    e.receitaRealizada.bilheteria = ''
    e.receitaRealizada.bar = ''
    expect(resultado(e)).toMatchObject({ pix: 1000, bilheteriaInformada: false, completo: false })
    expect(montarFotoFechamento(e)).toBeNull()
  })

  it('congela Pix na foto e o inclui no benchmark sem alterar ticket de bilheteria', () => {
    const e = evento(1000)
    e.publicoEstimado = 100
    const foto = montarFotoFechamento(e)
    expect(foto.resultado.pix).toBe(1000)
    expect(montarBenchmarkDeEvento(e)).toMatchObject({ receita: resultado(e).receita, ticketMedio: 100 })
    expect(montarBenchmarkDeEvento(e).obs).toContain('Pix líquido')
    e.receitaRealizada.pix = 9000
    expect(foto.resultado.pix).toBe(1000)
  })

  it('exporta/importa o Pix e importa backup antigo sem inventar recebimento', () => {
    for (const pix of [undefined, '', 0, 1234.56]) {
      const e = evento(pix)
      const imported = parseBackup(JSON.stringify(montarBackup({ eventos: [e] }))).eventos[0]
      expect(imported.receitaRealizada.pix).toBe(pix)
      expect(resultado(imported)).toEqual(resultado(migrarEvento(e)))
    }
  })

  it('recusa Pix negativo herdado com a mesma normalização da bilheteria', () => {
    expect(migrarEvento(evento(-1)).receitaRealizada.pix).toBe('')
  })

  it('importar uma foto antiga não adiciona Pix nem recalcula o fechamento', () => {
    const e = evento()
    e.status = 'fechado'
    e.fechamento = { em: '2026-09-01T12:00:00.000Z', foto: montarFotoFechamento(e) }
    const foto = structuredClone(e.fechamento.foto)
    const imported = parseBackup(JSON.stringify(montarBackup({ eventos: [e] }))).eventos[0]
    expect(imported.fechamento.foto).toEqual(foto)
    expect(imported.fechamento.foto.resultado).not.toHaveProperty('pix')
  })

  it('cópia preserva Pix sem mutar original; nova edição limpa o realizado', () => {
    const e = evento(1000)
    const copia = duplicarCopia(e)
    expect(copia.receitaRealizada.pix).toBe(1000)
    copia.receitaRealizada.pix = 500
    expect(e.receitaRealizada.pix).toBe(1000)
    expect(duplicarNovaEdicao(e).receitaRealizada.pix ?? '').toBe('')
  })
})
