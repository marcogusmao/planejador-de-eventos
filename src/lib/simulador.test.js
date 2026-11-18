import { describe, it, expect } from 'vitest'
import { valorEfetivo, simulacaoAtiva, resetarSimulacao, FALLBACK_DISPLAY, ALVO_RESET } from './simulador.js'
import { computeCenario } from './calc.js'

const eventoBase = () => ({
  lotes: [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 200 }],
  taxaBilheteria: 10,
  cashbackPct: 0,
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ estimado: 1000, realizado: '' }] }],
  contingenciaPct: 0,
  outrasReceitas: {},
  cenariosConfig: {},
})

describe('valorEfetivo', () => {
  it('campo ausente devolve o fallback de exibição', () => {
    // Padrões 80/90/100 (Marco, 27/07/2026): o pessimista subiu de 70 para
    // 80, e o realista deixou de exibir 100 enquanto a conta prometia 90.
    expect(valorEfetivo({}, 'pessimista', 'vendaPct')).toBe(80)
    expect(valorEfetivo({}, 'realista', 'vendaPct')).toBe(90)
    expect(valorEfetivo({}, 'otimista', 'custoPct')).toBe(-5)
  })
  it('campo preenchido devolve o valor gravado', () => {
    expect(valorEfetivo({ pessimista: { vendaPct: 55 } }, 'pessimista', 'vendaPct')).toBe(55)
  })
  it('campo vazio ("") devolve o fallback, não NaN', () => {
    expect(valorEfetivo({ realista: { ticketPct: '' } }, 'realista', 'ticketPct')).toBe(0)
  })
})

describe('simulacaoAtiva', () => {
  it('cenariosConfig vazio não está ativa', () => {
    expect(simulacaoAtiva({})).toBe(false)
    expect(simulacaoAtiva(undefined)).toBe(false)
  })
  it('valores explícitos iguais ao alvo (80/90/100) não contam como ativa', () => {
    expect(
      simulacaoAtiva({
        pessimista: { vendaPct: 80, custoPct: 10, ticketPct: 0 },
        realista: { vendaPct: 90, ticketPct: 0 },
        otimista: { custoPct: -5, ticketPct: 0 },
      })
    ).toBe(false)
  })
  it('um slider fora do alvo já ativa', () => {
    expect(simulacaoAtiva({ pessimista: { vendaPct: 60 } })).toBe(true)
    expect(simulacaoAtiva({ realista: { ticketPct: -10 } })).toBe(true)
    expect(simulacaoAtiva({ otimista: { custoPct: 5 } })).toBe(true)
  })
  it('campo ausente (evento antigo sem realista.vendaPct) não dispara alarme falso', () => {
    // Campo nunca tocado não é "simulação ativa" — ninguém mexeu em nada.
    // Antes de 27/07/2026 este teste também cobria uma divergência (fallback
    // 100 ≠ alvo 90) que a decisão B eliminou; a garantia de silêncio no
    // campo ausente continua valendo e é o que ele guarda hoje.
    expect(simulacaoAtiva({ realista: {} })).toBe(false)
  })
  it('ticketMedio manual e overrides não interferem (não são campo de slider)', () => {
    expect(
      simulacaoAtiva({
        realista: { ticketMedio: 250 },
        overrides: { pessimista: { l1: 10 } },
      })
    ).toBe(false)
  })
})

describe('resetarSimulacao', () => {
  it('grava exatamente 80/90/100 (venda) e 10/-5 (custo) e 0 (ticket) em todos os cenários', () => {
    const r = resetarSimulacao({
      pessimista: { vendaPct: 30, custoPct: 40, ticketPct: -20 },
      realista: { vendaPct: 55, ticketPct: 15 },
      otimista: { custoPct: 20, ticketPct: 8 },
    })
    expect(r.pessimista).toMatchObject({ vendaPct: 80, custoPct: 10, ticketPct: 0 })
    expect(r.realista).toMatchObject({ vendaPct: 90, ticketPct: 0 })
    expect(r.otimista).toMatchObject({ custoPct: -5, ticketPct: 0 })
    expect(simulacaoAtiva(r)).toBe(false)
  })
  it('a partir de cenariosConfig vazio também grava o alvo explícito (não deixa ausente)', () => {
    const r = resetarSimulacao({})
    expect(r.realista.vendaPct).toBe(90)
  })
  it('preserva ticketMedio manual e overrides por lote intactos', () => {
    const r = resetarSimulacao({
      pessimista: { vendaPct: 30, ticketMedio: 180 },
      overrides: { pessimista: { l1: 12 }, realista: {}, otimista: {} },
    })
    expect(r.pessimista.ticketMedio).toBe(180)
    expect(r.overrides).toEqual({ pessimista: { l1: 12 }, realista: {}, otimista: {} })
  })
  it('não muta o objeto original (imutável)', () => {
    const original = { pessimista: { vendaPct: 30 } }
    resetarSimulacao(original)
    expect(original.pessimista.vendaPct).toBe(30)
  })
})

describe('regressão: FALLBACK_DISPLAY/ALVO_RESET batem com o que calc.js realmente calcula', () => {
  it('pessimista: fallback de exibição = alvo do reset = o que calc.js usa sem cenariosConfig', () => {
    const semCfg = computeCenario(eventoBase(), 'pessimista')
    const comAlvo = computeCenario(
      { ...eventoBase(), cenariosConfig: { pessimista: ALVO_RESET.pessimista } },
      'pessimista'
    )
    expect(comAlvo.pagos).toBe(semCfg.pagos)
    expect(comAlvo.custoTotal).toBe(semCfg.custoTotal)
    expect(FALLBACK_DISPLAY.pessimista).toEqual(ALVO_RESET.pessimista)
  })
  it('otimista: fallback de exibição = alvo do reset = o que calc.js usa sem cenariosConfig', () => {
    const semCfg = computeCenario(eventoBase(), 'otimista')
    const comAlvo = computeCenario(
      { ...eventoBase(), cenariosConfig: { otimista: ALVO_RESET.otimista } },
      'otimista'
    )
    expect(comAlvo.custoTotal).toBe(semCfg.custoTotal)
    expect(FALLBACK_DISPLAY.otimista).toEqual(ALVO_RESET.otimista)
  })
  // DECISÃO B (Marco, 27/07/2026): este era o campo que discordava de si
  // mesmo. O fallback de exibição valia 100 porque calc.js calculava 100 com
  // o campo vazio, enquanto o botão "Voltar ao padrão" prometia 90. Agora os
  // três dizem 90 — fallback = alvo = conta.
  it('realista: sem cenariosConfig, calc.js usa 90% — e é o mesmo 90 do fallback E do alvo', () => {
    const semCfg = computeCenario(eventoBase(), 'realista')
    const com90 = computeCenario(
      { ...eventoBase(), cenariosConfig: { realista: { vendaPct: 90 } } },
      'realista'
    )
    expect(semCfg.pagos).toBe(com90.pagos)
    expect(semCfg.pagos).toBe(180) // 200 × 90%
    expect(FALLBACK_DISPLAY.realista.vendaPct).toBe(90)
    expect(ALVO_RESET.realista.vendaPct).toBe(90)
  })
  // Sessão P — sugestão 19 (grade completa): os dois campos novos.
  it('realista.custoPct: fallback de exibição (0) = alvo do reset = o que calc.js usa sem o campo', () => {
    const semCfg = computeCenario(eventoBase(), 'realista')
    const com0 = computeCenario(
      { ...eventoBase(), cenariosConfig: { realista: { custoPct: 0 } } },
      'realista'
    )
    expect(com0.custoTotal).toBe(semCfg.custoTotal)
    expect(FALLBACK_DISPLAY.realista.custoPct).toBe(0)
    expect(ALVO_RESET.realista.custoPct).toBe(0)
  })
  it('otimista.vendaPct: fallback de exibição (100) = alvo do reset = o que calc.js usa sem o campo', () => {
    const semCfg = computeCenario(eventoBase(), 'otimista')
    const com100 = computeCenario(
      { ...eventoBase(), cenariosConfig: { otimista: { vendaPct: 100 } } },
      'otimista'
    )
    expect(com100.pagos).toBe(semCfg.pagos)
    expect(com100.receitaTotal).toBe(semCfg.receitaTotal)
    expect(FALLBACK_DISPLAY.otimista.vendaPct).toBe(100)
    expect(ALVO_RESET.otimista.vendaPct).toBe(100)
  })
  it('sliders novos ativam o selo e o reset os traz de volta ao alvo', () => {
    expect(simulacaoAtiva({ realista: { custoPct: 15 } })).toBe(true)
    expect(simulacaoAtiva({ otimista: { vendaPct: 80 } })).toBe(true)
    const r = resetarSimulacao({ realista: { custoPct: 15 }, otimista: { vendaPct: 80 } })
    expect(r.realista.custoPct).toBe(0)
    expect(r.otimista.vendaPct).toBe(100)
    expect(simulacaoAtiva(r)).toBe(false)
  })
  it('realista: 90 (o padrão) e 100 (escolha salva) dão resultados diferentes — o padrão nunca reescreve escolha salva', () => {
    const com90 = computeCenario(
      { ...eventoBase(), cenariosConfig: { realista: { vendaPct: 90 } } },
      'realista'
    )
    const com100 = computeCenario(
      { ...eventoBase(), cenariosConfig: { realista: { vendaPct: 100 } } },
      'realista'
    )
    expect(com90.pagos).toBe(180) // 200 × 90%
    expect(com100.pagos).toBe(200) // 200 × 100%
    expect(ALVO_RESET.realista.vendaPct).toBe(90)
  })
})
