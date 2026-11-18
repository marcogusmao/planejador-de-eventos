// Prova do defeito do RELÓGIO (conserto 1, autorizado pelo Marco em 20/07/2026).
//
// `hojeISO()` era `new Date().toISOString().slice(0, 10)` — a data em UTC.
// São Paulo é UTC−3: das 21h à meia-noite DA NOITE DA FESTA o app já
// devolvia o dia SEGUINTE e, com isso, anunciava "Evento já realizado"
// enquanto a festa acontecia — no WhatsApp, no PDF, na Home e na curva.
//
// Este arquivo prova a regra nos DOIS sentidos, para que nenhum fuso a
// aprove por acaso:
//  - fuso NEGATIVO (São Paulo): 21h30 local → o UTC já virou o dia;
//  - fuso POSITIVO (Tóquio, Kiritimati): 00h30 local → o UTC ainda é ontem.
// Em TZ=UTC os dois casos são triviais e passam nas duas implementações —
// por isso a suíte roda também nos fusos deslocados.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hojeISO, dataLocalDoInstante, dataISOLocal } from './dataLocal.js'
import { MARCACAO_REALIZADA, resumoCurto } from './resumo.js'
import { linhaRitmoRelatorio } from './resumo.js'

afterEach(() => vi.useRealTimers())

/** Data local do relógio, montada sem passar por UTC — a referência honesta. */
function dataLocalEsperada(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Fixa o relógio num instante LOCAL (não em UTC). */
function fixarRelogioLocal(ano, mes, dia, hora, minuto) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(ano, mes - 1, dia, hora, minuto, 0, 0))
}

describe('hojeISO() — o relógio da casa é o LOCAL, nunca o UTC', () => {
  it('21h30 da noite da festa ainda é o DIA DA FESTA (falha em fuso negativo com UTC)', () => {
    fixarRelogioLocal(2026, 7, 20, 21, 30)
    expect(hojeISO()).toBe('2026-07-20')
    expect(hojeISO()).toBe(dataLocalEsperada())
  })

  it('00h30 ainda é o dia que começou (falha em fuso positivo com UTC)', () => {
    fixarRelogioLocal(2026, 7, 21, 0, 30)
    expect(hojeISO()).toBe('2026-07-21')
    expect(hojeISO()).toBe(dataLocalEsperada())
  })

  it('sai sempre em AAAA-MM-DD com zero à esquerda', () => {
    fixarRelogioLocal(2026, 3, 9, 23, 59)
    expect(hojeISO()).toBe('2026-03-09')
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a virada do ano às 23h59 de 31/12 ainda é 31/12', () => {
    fixarRelogioLocal(2026, 12, 31, 23, 59)
    expect(hojeISO()).toBe('2026-12-31')
  })

  it('varre o ano inteiro em horários de borda e nunca discorda do relógio local', () => {
    for (let mes = 1; mes <= 12; mes++) {
      for (const [h, m] of [
        [0, 0],
        [0, 30],
        [12, 0],
        [21, 30],
        [23, 59],
      ]) {
        fixarRelogioLocal(2026, mes, 15, h, m)
        expect(hojeISO()).toBe(dataLocalEsperada())
        vi.useRealTimers()
      }
    }
  })
})

// ————— o defeito como o Marco o vê: a festa acontecendo e o app enterrando —————

const eventoDaNoite = (dataISO) => ({
  id: 'ev-relogio',
  nome: 'Brisa na Varanda',
  data: dataISO,
  local: 'O Galeao',
  publicoEstimado: 300,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  vendidosAteHoje: 120,
  outrasReceitas: { bar: '', patrocinio: '' },
  patrocinios: [],
  lotes: [{ id: 'l1', nome: 'Lote 1', valor: 80, quantidade: 300, somenteOtimista: false }],
  categorias: [
    { nome: 'Produção', itens: [{ id: 'i1', servico: 'Som', estimado: 5000, status: 'FECHADO' }] },
  ],
})

describe('durante a festa, o app NÃO pode dizer "já realizado"', () => {
  it('21h30 do dia da festa: o resumo do WhatsApp segue mostrando o ritmo', () => {
    fixarRelogioLocal(2026, 7, 20, 21, 30)
    const texto = resumoCurto(eventoDaNoite('2026-07-20'))
    expect(texto).not.toContain(MARCACAO_REALIZADA)
    expect(texto).toContain('Vendidos até hoje')
  })

  it('21h30 do dia da festa: o relatório/PDF segue mostrando o ritmo', () => {
    fixarRelogioLocal(2026, 7, 20, 21, 30)
    const linha = linhaRitmoRelatorio(eventoDaNoite('2026-07-20'), 200)
    expect(linha).not.toBe(MARCACAO_REALIZADA)
    expect(linha).toContain('vendidos até hoje')
  })

  it('e no dia SEGUINTE a marcação volta a aparecer (o conserto não apaga a regra)', () => {
    fixarRelogioLocal(2026, 7, 21, 10, 0)
    const texto = resumoCurto(eventoDaNoite('2026-07-20'))
    expect(texto).toContain(MARCACAO_REALIZADA)
  })
})

// ————————————————————————————————————————————————————————————————
// O DIA LOCAL DE UM CARIMBO DE INSTANTE (Marco, 07/08/2026 — o S2 das 21h)
//
// `fechamento.em` é ISO completo em UTC, e está certo assim no dado. O errado
// era exibi-lo com `.slice(0, 10)`, que lê a data em UTC — em seis telas, entre
// elas o PDF e o resumo do WhatsApp que vão para as sócias.
// ————————————————————————————————————————————————————————————————

describe('dataLocalDoInstante — o dia em que o Marco fechou, não o dia em Greenwich', () => {
  it('21h30 de São Paulo: o carimbo já é do dia seguinte em UTC, e o dia local não', () => {
    fixarRelogioLocal(2026, 8, 5, 21, 30)
    const carimbo = new Date().toISOString() // o que `agora()` grava
    expect(carimbo.slice(0, 10)).toBe(fusoNegativo() ? '2026-08-06' : '2026-08-05')
    expect(dataLocalDoInstante(carimbo)).toBe('2026-08-05')
  })

  it('meia-noite e meia local: em fuso POSITIVO o UTC ainda é ontem, e o dia local não', () => {
    fixarRelogioLocal(2026, 8, 5, 0, 30)
    expect(dataLocalDoInstante(new Date().toISOString())).toBe('2026-08-05')
  })

  it('vazio e ausente devolvem vazio — `fmtData` já trata isso como não informado', () => {
    expect(dataLocalDoInstante('')).toBe('')
    expect(dataLocalDoInstante(undefined)).toBe('')
    expect(dataLocalDoInstante(null)).toBe('')
  })

  // ————— os dois casos que NÃO são instante —————
  // Achados atacando esta função no dia em que ela nasceu. O primeiro é a MESMA
  // classe que ela existe para consertar: uma data voltando um dia por causa de
  // fuso. Em UTC os dois valores coincidem, então a asserção que morde compara
  // contra o dia LOCAL calculado, e o literal só é exigido em fuso negativo.
  it('DATA PURA não é instante: 2026-08-05 continua 5 de agosto, não 4', () => {
    expect(dataLocalDoInstante('2026-08-05')).toBe('2026-08-05')
    // sem o tratamento, `new Date('2026-08-05')` é meia-noite UTC — 21h do dia 4
    // em São Paulo. A prova de que o perigo é real, e não teórico:
    if (new Date('2026-08-05').getTimezoneOffset() > 0) {
      expect(dataISOLocal(new Date('2026-08-05'))).toBe('2026-08-04')
    }
  })

  it('texto que não é data sai CRU, nunca como NaN', () => {
    for (const lixo of ['lixo', '{}', 'null', '2026-13-45T00:00:00Z']) {
      const saida = dataLocalDoInstante(lixo)
      expect(saida).toBe(lixo)
      expect(saida).not.toContain('NaN')
    }
  })

  it('em qualquer hora do dia, concorda com a data local montada à mão', () => {
    for (const hora of [0, 1, 8, 12, 18, 21, 23]) {
      fixarRelogioLocal(2026, 8, 5, hora, 30)
      const d = new Date()
      expect(dataLocalDoInstante(d.toISOString())).toBe(dataLocalEsperada(d))
    }
  })
})

/** O fuso do processo está atrás de UTC? (São Paulo sim; UTC não.) */
function fusoNegativo() {
  return new Date(2026, 7, 5, 21, 30).getTimezoneOffset() > 0
}
