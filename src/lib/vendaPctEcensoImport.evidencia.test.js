// vendaPct FAIXA PRÓPRIA + delete-da-chave + censo do import — evidência e
// especificação (decisões do Marco, 22/07/2026, 3a e 3b, via orquestrador).
// Irmã de negativoTravado.evidencia.test.js e percentuaisForaDaFaixa.evidencia.
//
// As decisões, em uma linha:
// - 3b: "Ingressos vendidos (%)" (vendaPct de cenário) é percentual ABSOLUTO do
//   lote (calc.js: Math.round(q*vendaPct/100)) → faixa PRÓPRIA 0..100, separada
//   dos IRMÃOS custoPct/ticketPct (ajustes relativos, seguem em −50..100).
// - 3b-anexo: fora da faixa (ou '') na grade de cenário, a migração REMOVE a
//   chave (delete) em vez de gravar '' — "não informado" volta a cair no
//   fallback documentado do calc (?? só pega chave AUSENTE; '' PRESENTE virava 0
//   e ZERAVA o cenário).
// - 3a: aviso AGREGADO na importação — censo do que a migração vai normalizar,
//   com confirm antes de aplicar, nas duas telas de import.
// calc.js/golden intocados: o delete só troca chave-'' por chave-ausente; valor
// DENTRO da faixa passa byte a byte.

import { describe, expect, it } from 'vitest'
import { loteQtdCenario } from './calc.js'
import { migrarEvento, censoNormalizacoes, textoAvisoNormalizacoes } from './migracao.js'
import { foraDaFaixa, FAIXA_VENDA, FAIXA_CENARIO } from './campoNumerico.js'
import { novoEvento } from './defaults.js'
import { clone } from './util.js'
// Os rótulos usam os formatadores da casa (o R$ leva ESPAÇO FINO U+00A0, como
// em todo dinheiro do app) — construir o esperado com eles prova prefixo +
// formatador certos sem depender de digitar o caractere invisível na string.
import { fmtBRL2, fmtInt, fmtPct } from './format.js'

describe('3b — vendaPct ganha faixa PRÓPRIA 0..100 (os irmãos seguem em −50..100)', () => {
  it('a régua nova RECUSA vendaPct −50 e 150; ACEITA 0 e 100 (as pontas)', () => {
    expect(foraDaFaixa(-50, FAIXA_VENDA)).toBe(true) // não vende "menos que nada"
    expect(foraDaFaixa(150, FAIXA_VENDA)).toBe(true) // nem mais que o lote inteiro
    expect(foraDaFaixa(0, FAIXA_VENDA)).toBe(false)
    expect(foraDaFaixa(100, FAIXA_VENDA)).toBe(false)
  })

  it('RED-evidência: a régua dos IRMÃOS (−50..100) aceitava vendaPct −50 — a lacuna que a faixa própria fecha', () => {
    // Sem a faixa própria, vendaPct herdava −50..100 e um −50 ABSOLUTO passava.
    expect(foraDaFaixa(-50, FAIXA_CENARIO)).toBe(false) // aceito na régua dos irmãos
    expect(foraDaFaixa(-50, FAIXA_VENDA)).toBe(true) // recusado na régua própria
    // o custoPct (IRMÃO) segue aceitando −50 de propósito; 120 recusa nos dois
    expect(foraDaFaixa(-50, FAIXA_CENARIO)).toBe(false)
    expect(foraDaFaixa(120, FAIXA_CENARIO)).toBe(true)
  })

  it('o aviso da faixa própria fala português e ENSINA o range', () => {
    expect(FAIXA_VENDA.aviso).toMatch(/0%.*100%/)
    expect(FAIXA_VENDA).toEqual({ min: 0, max: 100, aviso: expect.any(String) })
  })
})

describe('3b-anexo — a migração REMOVE a chave da grade fora da faixa (não grava "")', () => {
  const loteBase = () => ({ id: 'l1', nome: 'Único', valor: 100, quantidade: 200 })

  it('mecanismo (fato do calc): vendaPct "" PRESENTE ZERA o cenário; chave AUSENTE cai no fallback', () => {
    const lote = loteBase()
    // '' PRESENTE: o ?? não pega (só chave ausente), num('') = 0 → cenário zerado
    expect(loteQtdCenario(lote, 'realista', { realista: { vendaPct: '' } })).toBe(0)
    // chave AUSENTE: fallback documentado do calc — 90 desde 27/07/2026
    // (decisão B do Marco; era 100) → 180
    expect(loteQtdCenario(lote, 'realista', { realista: {} })).toBe(180)
  })

  it('vendaPct 150 e −50 fora da faixa → chave REMOVIDA → loteQtdCenario cai no fallback', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'T',
      lotes: [loteBase()],
      cenariosConfig: {
        realista: { vendaPct: 150, custoPct: 0 },
        pessimista: { vendaPct: -50 },
      },
    })
    expect('vendaPct' in m.cenariosConfig.realista).toBe(false)
    expect('vendaPct' in m.cenariosConfig.pessimista).toBe(false)
    expect(m.cenariosConfig.realista.custoPct).toBe(0) // válido, preservado
    expect(loteQtdCenario(m.lotes[0], 'realista', m.cenariosConfig)).toBe(180) // ?? 90
    expect(loteQtdCenario(m.lotes[0], 'pessimista', m.cenariosConfig)).toBe(160) // ?? 80
  })

  it('custoPct −200 (irmão, achado de 20/07) → chave REMOVIDA (default do calc)', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'T',
      cenariosConfig: { pessimista: { custoPct: -200 } },
    })
    expect('custoPct' in m.cenariosConfig.pessimista).toBe(false)
  })

  it("'' pré-existente na grade → chave REMOVIDA (não informado = padrão)", () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'T',
      cenariosConfig: { realista: { vendaPct: '', custoPct: 0 } },
    })
    expect('vendaPct' in m.cenariosConfig.realista).toBe(false)
    expect(m.cenariosConfig.realista.custoPct).toBe(0) // 0 é válido, fica
  })

  it('valores DENTRO da faixa passam byte a byte (0 e 100 nas pontas do vendaPct)', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'T',
      cenariosConfig: {
        pessimista: { vendaPct: 0, custoPct: -50 },
        realista: { vendaPct: 90, custoPct: 0 },
        otimista: { vendaPct: 100, custoPct: -5, ticketPct: 30 },
      },
    })
    expect(m.cenariosConfig.pessimista).toEqual({ vendaPct: 0, custoPct: -50 })
    expect(m.cenariosConfig.realista).toEqual({ vendaPct: 90, custoPct: 0 })
    expect(m.cenariosConfig.otimista).toEqual({ vendaPct: 100, custoPct: -5, ticketPct: 30 })
  })

  it('overrides e ticketMedio de cenariosConfig passam INTOCADOS pelo delete', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'T',
      cenariosConfig: {
        realista: { vendaPct: 150, ticketMedio: 137 },
        overrides: { realista: { l1: 250 } },
      },
    })
    expect('vendaPct' in m.cenariosConfig.realista).toBe(false) // fora da faixa some
    expect(m.cenariosConfig.realista.ticketMedio).toBe(137) // não é grade, fica
    expect(m.cenariosConfig.overrides).toEqual({ realista: { l1: 250 } })
  })
})

describe('3a — censo do que a migração normaliza em silêncio (aviso agregado)', () => {
  it('exemplo aprovado (estimado −1.000 + custoPct −200) → exatamente 2 itens com os rótulos', () => {
    const censo = censoNormalizacoes([
      {
        id: 'e1',
        nome: 'Brisa #3',
        categorias: [{ id: 'c', nome: 'Atrações', itens: [{ id: 'dj', servico: 'DJ', estimado: -1000 }] }],
        cenariosConfig: { pessimista: { vendaPct: 70, custoPct: -200 } },
      },
    ])
    expect(censo).toEqual([
      { evento: 'Brisa #3', campo: 'estimado', rotulo: `custo 'DJ', estimado ${fmtBRL2(-1000)}`, valor: -1000 },
      {
        evento: 'Brisa #3',
        campo: 'pessimista.custoPct',
        rotulo: `cenário pessimista, ajuste de custos ${fmtPct(-200)}`,
        valor: -200,
      },
    ])
  })

  it('arquivo LIMPO (tudo dentro da faixa) → 0 itens', () => {
    expect(censoNormalizacoes([novoEvento('Limpo')])).toEqual([])
    expect(censoNormalizacoes([])).toEqual([])
    expect(censoNormalizacoes(null)).toEqual([])
  })

  it('cobre monetários (preço, quantidade, patrocínio), vendaPct 0..100 e os percentuais 0..100', () => {
    const censo = censoNormalizacoes([
      {
        id: 'e1',
        nome: 'Festa',
        lotes: [{ id: 'l1', nome: 'Pista', valor: -100, quantidade: -50 }],
        patrocinios: [{ id: 'p', patrocinador: 'Marca', valor: -6000, estagio: 'confirmado' }],
        taxaBilheteria: 150,
        cenariosConfig: { realista: { vendaPct: 150 } },
      },
    ])
    const campos = censo.map((c) => c.campo)
    expect(campos).toEqual(['valor', 'quantidade', 'patrocinio', 'taxaBilheteria', 'realista.vendaPct'])
    const rot = (campo) => censo.find((c) => c.campo === campo).rotulo
    expect(rot('valor')).toBe(`lote 'Pista', preço ${fmtBRL2(-100)}`)
    expect(rot('quantidade')).toBe(`lote 'Pista', quantidade ${fmtInt(-50)}`)
    expect(rot('patrocinio')).toBe(`patrocínio 'Marca', valor ${fmtBRL2(-6000)}`)
    expect(rot('taxaBilheteria')).toBe(`taxa da bilheteria ${fmtPct(150)}`)
    expect(rot('realista.vendaPct')).toBe(`cenário realista, ingressos vendidos ${fmtPct(150)}`)
  })

  it('NÃO reporta 0, "" nem valor DENTRO da faixa (só número fora da faixa)', () => {
    expect(
      censoNormalizacoes([
        {
          id: 'e1',
          nome: 'T',
          lotes: [{ id: 'l1', nome: 'Cortesia', valor: 0, quantidade: 200 }],
          cenariosConfig: {
            pessimista: { vendaPct: '', custoPct: -50 }, // '' e −50 são vazio/válido
            otimista: { vendaPct: 100 },
          },
          descontoMedioPct: '',
        },
      ])
    ).toEqual([])
  })

  it('patrocínio SOLTO negativo (evento antigo sem lista) entra no censo', () => {
    const censo = censoNormalizacoes([
      { id: 'e1', nome: 'Antigo', outrasReceitas: { patrocinio: -2000 } },
    ])
    expect(censo).toEqual([
      { evento: 'Antigo', campo: 'patrocinio', rotulo: `patrocínio ${fmtBRL2(-2000)}`, valor: -2000 },
    ])
  })

  it('o texto do aviso segue o padrão aprovado (singular)', () => {
    const censo = censoNormalizacoes([
      {
        id: 'e1',
        nome: 'Brisa #3',
        categorias: [{ id: 'c', nome: 'A', itens: [{ id: 'dj', servico: 'DJ', estimado: -1000 }] }],
      },
    ])
    const t = textoAvisoNormalizacoes(censo)
    expect(t).toContain("Este backup traz 1 valor fora das faixas do app, que entrará como 'não informado':")
    expect(t).toContain(`• Brisa #3 — custo 'DJ', estimado ${fmtBRL2(-1000)}`)
    expect(t).toContain(
      'Continuar? (Uma cópia de segurança de antes do import fica em Proteção de dados; o arquivo original não é alterado.)'
    )
  })

  it('lista longa: até 10 itens + "…e mais N"', () => {
    const lotes = Array.from({ length: 12 }, (_, i) => ({
      id: `l${i}`,
      nome: `Lote ${i}`,
      valor: -1,
      quantidade: 10,
    }))
    const censo = censoNormalizacoes([{ id: 'e1', nome: 'Muitos', lotes }])
    expect(censo).toHaveLength(12)
    const t = textoAvisoNormalizacoes(censo)
    expect(t).toContain('Este backup traz 12 valores fora das faixas do app, que entrarão como')
    const bullets = t.split('\n').filter((l) => l.startsWith('• '))
    expect(bullets).toHaveLength(11) // 10 itens + a linha "…e mais 2"
    expect(bullets.filter((l) => l.startsWith('• …e mais')).length).toBe(1)
    expect(t).toContain('• …e mais 2')
  })
})

describe('round-trip de backup LIMPO — inalterado', () => {
  it('evento novo: migração não muda cenariosConfig válido e o censo é vazio', () => {
    const ev = novoEvento('Festa')
    const m = migrarEvento(clone(ev))
    expect(m.cenariosConfig).toEqual(ev.cenariosConfig)
    expect(censoNormalizacoes([ev])).toEqual([])
  })
})
