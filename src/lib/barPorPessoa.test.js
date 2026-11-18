// Bar em dois modos (sugestão 42 — conta cravada e aprovada pelo Marco em
// 19/07/2026):
//   modo FIXO (padrão de todo evento existente): o valor digitado é o lucro
//   líquido, igual nos três cenários — comportamento EXATAMENTE atual.
//   modo POR PESSOA: por cenário,
//     consumo = ticket_do_cenário × pessoas_do_cenário  (pessoas = pagos +
//     cortesias — cortesia consome no bar)
//     bar_líquido = consumo − (taxa_sistema% × consumo) − custo_sistema
// A preservação byte a byte do modo fixo (evento antigo) está aqui E no
// golden.test.js (fotografias intactas + casos neutros). Open bar manda em
// tudo: bar = 0 em qualquer modo.

import { describe, it, expect } from 'vitest'
import { computeCenarios, computeCenario, isBarPorPessoa, barPorPessoa, isOpenBar } from './calc.js'
import { fechamentoReceita } from './fechamento.js'
import { novoEvento } from './defaults.js'
import { migrarEvento } from './migracao.js'
import { premissaBar, contaBarPorPessoa } from './premissaTexto.js'

// Evento de prova SEM os campos novos — um evento salvo de hoje. Números
// redondos para as contas à mão: realista 90% → 90 pagos + 20 cortesias.
const eventoFixo = () => ({
  nome: 'Evento fixo (prova)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 40000, patrocinio: 3000 },
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 100 },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 20 },
  ],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 8000 }] }],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 90 },
    otimista: { custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

// O MESMO evento de prova com o pessimista já em 80. A migração passou a
// subir o pessimista de 70 para 80 (Marco, 27/07/2026 — decisão A), então
// "migrado = cru" deixou de valer nesse único ponto. Os testes de preservação
// abaixo comparam contra ISTO: continuam provando que o BAR não move um
// centavo na migração, sem fingir que a subida não aconteceu.
const eventoFixoCom80 = () => {
  const e = eventoFixo()
  return {
    ...e,
    cenariosConfig: { ...e.cenariosConfig, pessimista: { vendaPct: 80, custoPct: 10 } },
  }
}

const porPessoa = (extra = {}) => ({
  ...eventoFixo(),
  barModo: 'porPessoa',
  barTicket: { pessimista: 110, realista: 110, otimista: 110 },
  barTaxaSistemaPct: 5,
  barCustoSistema: 500,
  ...extra,
})

describe('isBarPorPessoa — checagem estrita (filosofia do openBar)', () => {
  it("só a string exata 'porPessoa' liga o modo novo", () => {
    expect(isBarPorPessoa({ barModo: 'porPessoa' })).toBe(true)
    for (const torto of [undefined, '', 'fixo', 'PORPESSOA', 'porpessoa', true, 1, null])
      expect(isBarPorPessoa({ barModo: torto })).toBe(false)
    expect(isBarPorPessoa(undefined)).toBe(false)
  })
})

describe('preservação: evento fixo é byte a byte o de sempre', () => {
  it('campo ausente, "", "fixo" e valores tortos: computeCenarios profundo-idêntico ao evento cru', () => {
    const base = computeCenarios(eventoFixo())
    for (const torto of ['', 'fixo', 'PORPESSOA', true, null])
      expect(computeCenarios({ ...eventoFixo(), barModo: torto })).toStrictEqual(base)
  })

  it('campos por-pessoa preenchidos NÃO vazam no modo fixo (ticket guardado, fora da conta)', () => {
    const comCampos = {
      ...eventoFixo(),
      barModo: 'fixo',
      barTicket: { pessimista: 90, realista: 110, otimista: 130 },
      barTaxaSistemaPct: 5,
      barCustoSistema: 500,
    }
    expect(computeCenarios(comCampos)).toStrictEqual(computeCenarios(eventoFixo()))
  })

  it('evento antigo migrado fica no modo fixo e calcula profundo-idêntico ao cru (com o pessimista já subido)', () => {
    const mig = migrarEvento(eventoFixo())
    expect(mig.barModo).toBe('')
    expect(mig.barTicket).toEqual({ pessimista: '', realista: '', otimista: '' })
    // A subida do pessimista é a ÚNICA diferença permitida; tudo mais — bar,
    // taxa, cashback, custos, contingência, os outros dois cenários — é
    // profundo-idêntico. Se a subida escapar para qualquer outro número, é
    // aqui que fica vermelho.
    expect(mig.cenariosConfig.pessimista.vendaPct).toBe(80)
    expect(computeCenarios(mig)).toStrictEqual(computeCenarios(eventoFixoCom80()))
  })
})

describe('a conta por pessoa (aprovada em 19/07/2026)', () => {
  // Públicos do evento de prova: pessimista 70+20=90 · realista 90+20=110 ·
  // otimista 100+20=120 (cortesia inteira em todos — e ela CONSOME no bar).
  it('cortesia conta como pessoa: consumo = ticket × (pagos + cortesias)', () => {
    const c = computeCenarios(porPessoa({ barTaxaSistemaPct: '', barCustoSistema: '' }))
    expect(c.realista.pagos).toBe(90)
    expect(c.realista.cortesias).toBe(20)
    expect(c.realista.bar).toBe(110 * 110) // 12.100 — com as 20 cortesias dentro
    expect(c.pessimista.bar).toBe(110 * 90) // 9.900
    expect(c.otimista.bar).toBe(110 * 120) // 13.200
  })

  it('taxa do sistema aplicada UMA vez sobre o consumo e custo do sistema descontado UMA vez', () => {
    // à mão (realista): consumo 110 × 110 = 12.100 − 5% (605) − 500 = 10.995
    const c = computeCenarios(porPessoa())
    expect(c.realista.bar).toBe(12100 - 605 - 500)
    // pessimista: 9.900 − 495 − 500 = 8.905 · otimista: 13.200 − 660 − 500 = 12.040
    expect(c.pessimista.bar).toBe(8905)
    expect(c.otimista.bar).toBe(12040)
  })

  it('3 tickets distintos geram 3 bares distintos (ticket é POR CENÁRIO)', () => {
    const c = computeCenarios(
      porPessoa({ barTicket: { pessimista: 90, realista: 110, otimista: 130 } })
    )
    expect(c.pessimista.bar).not.toBe(c.realista.bar)
    expect(c.realista.bar).not.toBe(c.otimista.bar)
    // à mão: 90×90=8.100−405−500=7.195 · 110×110=12.100−605−500=10.995 ·
    // 130×120=15.600−780−500=14.320
    expect(c.pessimista.bar).toBe(7195)
    expect(c.realista.bar).toBe(10995)
    expect(c.otimista.bar).toBe(14320)
  })

  it('o bar por pessoa mexe SÓ no bar — bilheteria e custos idênticos; receita/lucro se movem pelo bar', () => {
    const fixo = computeCenarios(eventoFixo())
    const pp = computeCenarios(porPessoa())
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(pp[k].bruta).toBe(fixo[k].bruta)
      expect(pp[k].liquida).toBe(fixo[k].liquida)
      expect(pp[k].patrocinio).toBe(fixo[k].patrocinio)
      expect(pp[k].custoTotal).toBe(fixo[k].custoTotal)
      expect(pp[k].receitaTotal).toBe(fixo[k].liquida + pp[k].bar + fixo[k].patrocinio)
      expect(pp[k].lucro).toBe(pp[k].receitaTotal - pp[k].custoTotal)
    }
  })

  it('open bar MANDA em tudo: bar = 0 nos DOIS modos', () => {
    const fixoOpen = computeCenarios({ ...eventoFixo(), openBar: true })
    const ppOpen = computeCenarios(porPessoa({ openBar: true }))
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(fixoOpen[k].bar).toBe(0)
      expect(ppOpen[k].bar).toBe(0)
    }
    // com tudo igual fora o modo, open bar deixa os dois modos idênticos
    expect(ppOpen).toStrictEqual(
      computeCenarios({ ...eventoFixo(), openBar: true, barModo: 'porPessoa', barTicket: { pessimista: 110, realista: 110, otimista: 110 }, barTaxaSistemaPct: 5, barCustoSistema: 500 })
    )
  })

  it('barPorPessoa expõe as parcelas da continha (consumo, sistema, líquido)', () => {
    const b = barPorPessoa(porPessoa(), 'realista', 110)
    expect(b).toEqual({
      ticket: 110,
      pessoas: 110,
      consumo: 12100,
      taxaPct: 5,
      taxaSistema: 605,
      custoSistema: 500,
      liquido: 10995,
    })
  })

  it('campos vazios valem 0: evento por pessoa sem ticket tem bar R$ 0 (sem NaN)', () => {
    const c = computeCenarios({ ...eventoFixo(), barModo: 'porPessoa' })
    for (const k of ['pessimista', 'realista', 'otimista']) expect(c[k].bar).toBe(0)
  })
})

describe('evento novo × evento antigo (o portão do padrão)', () => {
  it("evento NOVO nasce com barModo 'porPessoa' EXPLÍCITO e campos vazios (bar R$ 0, como sempre nasceu)", () => {
    const ev = novoEvento('Nova festa')
    expect(ev.barModo).toBe('porPessoa')
    expect(ev.barTicket).toEqual({ pessimista: '', realista: '', otimista: '' })
    expect(ev.barTaxaSistemaPct).toBe('')
    expect(ev.barCustoSistema).toBe('')
    // com os campos vazios, o evento novo calcula idêntico a se fosse fixo
    expect(computeCenarios(ev)).toStrictEqual(computeCenarios({ ...ev, barModo: '' }))
  })

  it('migração NUNCA retroage o padrão: evento salvo sem o campo segue fixo; modos válidos são preservados', () => {
    expect(migrarEvento(eventoFixo()).barModo).toBe('')
    expect(migrarEvento({ ...eventoFixo(), barModo: 'fixo' }).barModo).toBe('fixo')
    expect(migrarEvento(porPessoa()).barModo).toBe('porPessoa')
    // torto de backup editado à mão nunca liga o modo novo sozinho
    for (const torto of ['PORPESSOA', true, 1, {}])
      expect(migrarEvento({ ...eventoFixo(), barModo: torto }).barModo).toBe('')
  })

  it('migração preserva ticket/taxa/custo válidos (número e string numérica) e normaliza torto para ""', () => {
    const mig = migrarEvento(
      porPessoa({
        barTicket: { pessimista: '90', realista: 110, otimista: 'lixo' },
        barTaxaSistemaPct: '5',
        barCustoSistema: {},
      })
    )
    expect(mig.barTicket).toEqual({ pessimista: '90', realista: 110, otimista: '' })
    expect(mig.barTaxaSistemaPct).toBe('5')
    expect(mig.barCustoSistema).toBe('')
    // idempotente
    expect(migrarEvento(mig)).toEqual(mig)
  })

  it('round-trip de backup ANTIGO (sem os campos): importa em modo fixo com números idênticos e reimporta estável', async () => {
    const { parseBackup } = await import('./storage.js')
    const antigo = eventoFixo()
    const backupAntigo = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [antigo],
      benchmarksCustom: [],
      benchmarkOverrides: {},
    })
    const importado = parseBackup(backupAntigo)
    expect(importado.eventos[0].barModo).toBe('')
    // Mesma régua do teste de preservação acima: o backup v1 continua abrindo
    // e o bar continua idêntico; o pessimista chega subido para 80.
    expect(importado.eventos[0].cenariosConfig.pessimista.vendaPct).toBe(80)
    expect(computeCenarios(importado.eventos[0])).toEqual(computeCenarios(eventoFixoCom80()))
    const reimportado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    )
    expect(reimportado.eventos).toEqual(importado.eventos)
  })

  it('computeCenarios não muta o evento (nos dois modos)', () => {
    const f = eventoFixo()
    computeCenarios(f)
    expect(f).toStrictEqual(eventoFixo())
    const p = porPessoa()
    computeCenarios(p)
    expect(p).toStrictEqual(porPessoa())
  })
})

describe('fechamento (integração): bar realizado segue pedido igual; previsto acompanha o modo', () => {
  it('modo por pessoa: bar previsto = o bar calculado do realista (o número da DRE)', () => {
    const e = { ...porPessoa(), receitaRealizada: { bilheteria: '', bar: 12000 } }
    const r = computeCenario(e, 'realista')
    const f = fechamentoReceita(e, r)
    const linhaBar = f.linhas.find((l) => l.nome === 'Bar (lucro líquido)')
    expect(linhaBar.estimado).toBe(r.bar) // 10.995
    expect(linhaBar.realizado).toBe(12000)
    expect(linhaBar.desvio).toBe(12000 - 10995)
  })

  it('modo fixo: bar previsto continua o valor digitado (comportamento de sempre)', () => {
    const e = { ...eventoFixo(), receitaRealizada: { bilheteria: '', bar: 42000 } }
    const f = fechamentoReceita(e, computeCenario(e, 'realista'))
    const linhaBar = f.linhas.find((l) => l.nome === 'Bar (lucro líquido)')
    expect(linhaBar.estimado).toBe(40000)
    expect(linhaBar.desvio).toBe(2000)
  })

  it('open bar: a linha de Bar segue fora da conta nos dois modos', () => {
    for (const e of [{ ...eventoFixo(), openBar: true }, porPessoa({ openBar: true })]) {
      const f = fechamentoReceita(e, computeCenario(e, 'realista'))
      expect(f.linhas.some((l) => l.nome.startsWith('Bar'))).toBe(false)
    }
  })
})

describe('frases fonte-única (premissa e continha)', () => {
  // O Intl do pt-BR usa espaço inflexível (U+00A0) depois de "R$" — o teste
  // normaliza para espaço comum só para a string esperada ficar legível.
  const plana = (s) => s.replace(/ /g, ' ')

  it('premissaBar: só no modo por pessoa; tickets iguais viram um valor só, distintos viram os três', () => {
    expect(premissaBar(eventoFixo())).toBe('')
    expect(premissaBar(porPessoa({ openBar: true }))).toBe('')
    expect(plana(premissaBar(porPessoa()))).toBe(
      'bar por pessoa: consumo de R$ 110 por pessoa · sistema 5% + R$ 500'
    )
    expect(
      plana(premissaBar(porPessoa({ barTicket: { pessimista: 90, realista: 110, otimista: 130 } })))
    ).toBe(
      'bar por pessoa: consumo de R$ 90 / R$ 110 / R$ 130 por pessoa (pess./real./otim.) · sistema 5% + R$ 500'
    )
    expect(plana(premissaBar(porPessoa({ barTaxaSistemaPct: '', barCustoSistema: '' })))).toBe(
      'bar por pessoa: consumo de R$ 110 por pessoa'
    )
  })

  it('contaBarPorPessoa: a continha com os números reais do cenário', () => {
    const e = porPessoa()
    const r = computeCenario(e, 'realista')
    expect(plana(contaBarPorPessoa(e, r))).toBe(
      'R$ 110 × 110 pessoas = R$ 12.100 − R$ 605 (sistema 5%) − R$ 500 (custo do sistema) = R$ 10.995.'
    )
    expect(contaBarPorPessoa(eventoFixo(), r)).toBe('')
  })
})
