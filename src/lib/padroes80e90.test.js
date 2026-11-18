// PADRÕES 80/90/100 — as duas decisões do Marco de 27/07/2026, tomadas por
// questionário com a lista de impacto evento a evento na frente dele.
//
// DECISÃO A — o pessimista supõe 80% dos lotes vendidos, e não mais 70%. Vale
// para o evento novo, para o botão "Voltar ao padrão", para o evento com o
// campo VAZIO (fallback de calc.js) e TAMBÉM para os eventos já salvos em 70
// (migração `padraoPessimista80`).
//
// DECISÃO B — o realista parou de discordar de si mesmo. O botão "Voltar ao
// padrão" e o evento novo sempre disseram 90%, mas o CÁLCULO usava 100% com o
// campo vazio: a tela prometia 90 e a conta entregava 100. Agora é 90 nos dois
// lugares. Só o campo VAZIO é alcançado — 100 GRAVADO continua sendo 100.
//
// O que estes testes NÃO fazem: mexer no golden. O evento golden tem
// vendaPct explícito nos três cenários, então nenhum fallback o alcança e
// nenhuma fotografia de fórmula muda — conferido rodando a suíte inteira.
//
// Impacto medido no backup real do Marco de 27/07/2026 (lucro do cenário):
//   Marfim 09/05/26 ...... pessimista 70 → 80 ....... −68.410 → −27.530
//   Marfim Salao Sul ......... pessimista vazio → 80 .... −87.120 → −57.640
//   Marfim Casa Norte 2025  pessimista 70 → 80 ...... −152.870 → −122.960
//   Marfim Salao Sul ......... realista vazio → 90 ....... 33.970 → 4.310
//   Brisa 05/12/25 ...... pessimista 70 → 80 ....... não muda (sem lote)
// Não mudam: Brisa #3 e Marfim #15 (já em 80), Casa Norte 2026 (78) e a Cine
// (47 posto à mão pelo Marco).

import { describe, expect, it } from 'vitest'
import { loteQtdCenario } from './calc.js'
import { migrarEvento, migrarEventos } from './migracao.js'
import { novoEvento } from './defaults.js'
import { ALVO_RESET, FALLBACK_DISPLAY, resetarSimulacao, valorEfetivo } from './simulador.js'
import { PADROES_APP } from './premissas.js'

// Um lote redondo de 1.000 ingressos: a quantidade do cenário LÊ o padrão
// direto, sem arredondamento no meio para confundir a leitura.
const LOTE = { id: 'l1', nome: 'Único', valor: 100, quantidade: 1000 }

describe('DECISÃO A — o pessimista supõe 80% dos lotes, não mais 70%', () => {
  it('campo VAZIO: o cálculo usa 80% (era 70%) — 800 ingressos de um lote de 1.000', () => {
    expect(loteQtdCenario(LOTE, 'pessimista', {})).toBe(800)
  })

  it('o valor GRAVADO continua mandando: 47% na Cine vende 470, o padrão não atropela', () => {
    expect(loteQtdCenario(LOTE, 'pessimista', { pessimista: { vendaPct: 47 } })).toBe(470)
  })

  it('evento NOVO nasce com pessimista 80 gravado', () => {
    expect(novoEvento().cenariosConfig.pessimista.vendaPct).toBe(80)
  })

  it('"Voltar ao padrão" leva o pessimista a 80, e o slider mostra 80 no campo vazio', () => {
    expect(ALVO_RESET.pessimista.vendaPct).toBe(80)
    expect(FALLBACK_DISPLAY.pessimista.vendaPct).toBe(80)
    expect(resetarSimulacao({ pessimista: { vendaPct: 47 } }).pessimista.vendaPct).toBe(80)
    expect(valorEfetivo({}, 'pessimista', 'vendaPct')).toBe(80)
  })

  it('a premissa herdada por festa também nasce em 80 (espelha o evento novo)', () => {
    expect(PADROES_APP.cenarios.pessimista.vendaPct).toBe(80)
  })

  it('o otimista NÃO foi arrastado junto: segue esgotando o lote (100%)', () => {
    expect(loteQtdCenario(LOTE, 'otimista', {})).toBe(1000)
  })
})

describe('DECISÃO B — o realista para de discordar de si mesmo: 90 no cálculo e na tela', () => {
  it('campo VAZIO: o cálculo usa 90% (era 100%) — 900 de um lote de 1.000', () => {
    expect(loteQtdCenario(LOTE, 'realista', {})).toBe(900)
  })

  it('quem tem 100 GRAVADO continua em 100 — o padrão novo não reescreve escolha salva', () => {
    expect(loteQtdCenario(LOTE, 'realista', { realista: { vendaPct: 100 } })).toBe(1000)
  })

  it('o slider deixou de mostrar um número diferente do que a conta usa: 90 dos dois lados', () => {
    expect(FALLBACK_DISPLAY.realista.vendaPct).toBe(90)
    expect(ALVO_RESET.realista.vendaPct).toBe(90)
    expect(valorEfetivo({}, 'realista', 'vendaPct')).toBe(
      loteQtdCenario(LOTE, 'realista', {}) / 10
    )
  })

  it('o evento novo já dizia 90 e continua dizendo 90', () => {
    expect(novoEvento().cenariosConfig.realista.vendaPct).toBe(90)
  })
})

// ————————————————————————————————————————————————————————————————————————
// A migração: o fallback só alcança campo VAZIO; quem tem 70 SALVO precisa
// dela. E ela precisa acontecer UMA VEZ — `migrarEvento` roda a cada abertura
// do app, então sem marca isto viraria uma regra permanente contra o 70.
// ————————————————————————————————————————————————————————————————————————

const eventoCom = (pessimista) => ({
  id: 'ev1',
  nome: 'Festa de teste',
  lotes: [LOTE],
  categorias: [],
  cenariosConfig: {
    pessimista: pessimista === undefined ? {} : { vendaPct: pessimista, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

describe('MIGRAÇÃO padraoPessimista80 — o 70 salvo vira 80, uma vez só', () => {
  it('evento com 70 SALVO vira 80, e a marca guarda o valor anterior', () => {
    const m = migrarEvento(eventoCom(70))
    expect(m.cenariosConfig.pessimista.vendaPct).toBe(80)
    expect(m.padraoPessimista80).toEqual({ de: 70 })
    // 800 ingressos onde antes eram 700 — a conta segue o campo, não o padrão.
    expect(loteQtdCenario(LOTE, 'pessimista', m.cenariosConfig)).toBe(800)
  })

  it("'70' vindo de backup editado à mão também sobe (mesma régua do resto da grade)", () => {
    const m = migrarEvento(eventoCom('70'))
    expect(m.cenariosConfig.pessimista.vendaPct).toBe(80)
    expect(m.padraoPessimista80).toEqual({ de: '70' })
  })

  it('o 47 que o Marco pôs à mão na Cine NÃO muda — só o 70 exato é alcançado', () => {
    const m = migrarEvento(eventoCom(47))
    expect(m.cenariosConfig.pessimista.vendaPct).toBe(47)
    expect(m.padraoPessimista80).toEqual({ de: null })
  })

  it('78, 80 e o campo vazio também passam intocados', () => {
    expect(migrarEvento(eventoCom(78)).cenariosConfig.pessimista.vendaPct).toBe(78)
    expect(migrarEvento(eventoCom(80)).cenariosConfig.pessimista.vendaPct).toBe(80)
    expect(migrarEvento(eventoCom(undefined)).cenariosConfig.pessimista.vendaPct).toBeUndefined()
  })

  it('rodar duas vezes dá exatamente o mesmo — inclusive o custoPct que viaja junto', () => {
    const uma = migrarEvento(eventoCom(70))
    const duas = migrarEvento(uma)
    expect(duas).toEqual(uma)
    expect(duas.cenariosConfig.pessimista).toEqual({ vendaPct: 80, custoPct: 10 })
  })

  it('roda UMA VEZ: um 70 digitado DE PROPÓSITO depois da subida é respeitado', () => {
    // O Marco arrasta o slider do pessimista de volta para 70 num evento já
    // migrado, salva e fecha o app. Na abertura seguinte o número tem de ser
    // o dele — trocar em silêncio o número do dono é o pior defeito do app.
    const jaMigrado = migrarEvento(eventoCom(70))
    const escolhaDoMarco = {
      ...jaMigrado,
      cenariosConfig: {
        ...jaMigrado.cenariosConfig,
        pessimista: { ...jaMigrado.cenariosConfig.pessimista, vendaPct: 70 },
      },
    }
    expect(migrarEvento(escolhaDoMarco).cenariosConfig.pessimista.vendaPct).toBe(70)
  })

  it('evento NOVO já nasce marcado — a janela entre criar e reabrir não existe', () => {
    const novo = novoEvento()
    expect(novo.padraoPessimista80).toEqual({ de: null })
    const comSetenta = {
      ...novo,
      cenariosConfig: {
        ...novo.cenariosConfig,
        pessimista: { ...novo.cenariosConfig.pessimista, vendaPct: 70 },
      },
    }
    expect(migrarEvento(comSetenta).cenariosConfig.pessimista.vendaPct).toBe(70)
  })

  it('marca de forma torta segue valendo como marca (nunca reabre a porta do 70)', () => {
    for (const torta of ['sim', 1, true, false, null, [], { de: undefined }]) {
      const m = migrarEvento({ ...eventoCom(70), padraoPessimista80: torta })
      expect(m.cenariosConfig.pessimista.vendaPct).toBe(70)
      expect(m.padraoPessimista80).toEqual({ de: null })
    }
  })

  it('migrarEventos aplica a subida na lista inteira, e nada mais', () => {
    const lista = migrarEventos([eventoCom(70), eventoCom(47), eventoCom(undefined)])
    expect(lista.map((e) => e.cenariosConfig.pessimista.vendaPct)).toEqual([80, 47, undefined])
  })

  it('a subida não encosta no realista nem no otimista do mesmo evento', () => {
    const m = migrarEvento(eventoCom(70))
    expect(m.cenariosConfig.realista).toEqual({ vendaPct: 90, custoPct: 0 })
    expect(m.cenariosConfig.otimista).toEqual({ vendaPct: 100, custoPct: -5 })
    expect(m.cenariosConfig.overrides).toEqual({ pessimista: {}, realista: {}, otimista: {} })
  })

  it('cenariosConfig ausente: nada quebra, e o evento sai marcado', () => {
    const m = migrarEvento({ id: 'x', nome: 'Sem grade', lotes: [], categorias: [] })
    expect(m.cenariosConfig).toBeUndefined()
    expect(m.padraoPessimista80).toEqual({ de: null })
  })
})
