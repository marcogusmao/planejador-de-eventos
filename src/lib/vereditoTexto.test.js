// Sessão H3-H — a constituição prometia "100% cobertos por Vitest" e
// vereditoTexto.js não tinha teste homônimo. Cobre o vocabulário NOVO
// (20/07/2026: "Evento viável / Viável com ressalvas / Inviável como está",
// trocado do coloquial "Esse evento sai") e as 4 combinações de cor/caso de
// fraseVeredito. Usa fmtBRL/fmtPct importados de verdade (já testados em
// format.test.js) para montar o esperado — assim o teste prova a
// COMPOSIÇÃO da frase (quais números entram em qual lugar, qual branch é
// escolhido), sem duplicar a formatação em si.

import { describe, expect, it } from 'vitest'
import { fmtBRL, fmtPct } from './format.js'
import { EMOJI_SEMAFORO, fraseVeredito, TITULO_VEREDITO } from './vereditoTexto.js'

describe('TITULO_VEREDITO — vocabulário técnico (trocado a pedido do Marco, 20/07/2026)', () => {
  it('as 3 cores têm o texto exato — não o coloquial antigo ("Esse evento sai")', () => {
    expect(TITULO_VEREDITO.verde).toBe('Evento viável')
    expect(TITULO_VEREDITO.amarelo).toBe('Viável com ressalvas')
    expect(TITULO_VEREDITO.vermelho).toBe('Inviável como está')
  })

  it('nenhum título carrega emoji (a cor mora na bola, nunca no texto — PADRÃO §3)', () => {
    Object.values(TITULO_VEREDITO).forEach((titulo) => {
      expect(titulo).not.toMatch(/[🟢🟡🔴]/)
    })
  })
})

describe('EMOJI_SEMAFORO — só existe no texto copiado (WhatsApp), nunca na tela', () => {
  it('mapeia as 3 cores para o emoji certo', () => {
    expect(EMOJI_SEMAFORO.verde).toBe('🟢')
    expect(EMOJI_SEMAFORO.amarelo).toBe('🟡')
    expect(EMOJI_SEMAFORO.vermelho).toBe('🔴')
  })
})

const cenarios = (margemRealista, lucroPessimista = -500) => ({
  pessimista: { lucro: lucroPessimista },
  realista: { margem: margemRealista },
  otimista: { lucro: 99999 },
})

describe('fraseVeredito — as 4 cores/casos', () => {
  it('verde: cita margem realista, os dois alvos e o lucro do pessimista', () => {
    const c = cenarios(25, 8000)
    const v = { cor: 'verde', margemAlvo: 20, margemMinima: 10 }
    const frase = fraseVeredito(c, v)
    expect(frase).toBe(
      `Viável: margem realista ${fmtPct(25)} (alvo ${fmtPct(20)}, mínima ${fmtPct(10)}) e lucro até no cenário pessimista (${fmtBRL(8000)}).`,
    )
    expect(frase.startsWith('Viável:')).toBe(true)
  })

  it('amarelo SEM rebaixamento: margem × alvo, não menciona o pessimista', () => {
    const c = cenarios(15)
    const v = { cor: 'amarelo', margemAlvo: 20, margemMinima: 10, rebaixadoPeloPessimista: false }
    const frase = fraseVeredito(c, v)
    expect(frase).toBe(
      `Viável com ressalvas: margem realista ${fmtPct(15)} abaixo do alvo (alvo ${fmtPct(20)}, mínima ${fmtPct(10)}).`,
    )
    expect(frase).not.toContain('pessimista')
  })

  it('amarelo REBAIXADO pelo pessimista: bate o alvo, mas avisa do prejuízo no pessimista', () => {
    const c = cenarios(22, -1200)
    const v = { cor: 'amarelo', margemAlvo: 20, margemMinima: 10, rebaixadoPeloPessimista: true }
    const frase = fraseVeredito(c, v)
    expect(frase).toBe(
      `Viável com ressalvas: a margem realista ${fmtPct(22)} bate o alvo (alvo ${fmtPct(20)}, mínima ${fmtPct(10)}), porém o cenário pessimista fecha em ${fmtBRL(-1200)} — prejuízo se as vendas caírem.`,
    )
    expect(frase).toContain('prejuízo se as vendas caírem')
  })

  it('vermelho: margem abaixo da mínima, não menciona o pessimista', () => {
    const c = cenarios(5)
    const v = { cor: 'vermelho', margemAlvo: 20, margemMinima: 10 }
    const frase = fraseVeredito(c, v)
    expect(frase).toBe(
      `Inviável como está: margem realista ${fmtPct(5)} abaixo da mínima (alvo ${fmtPct(20)}, mínima ${fmtPct(10)}). Reveja custos ou receita.`,
    )
  })

  it('sem receita ainda (margem null): frase própria — não vira "abaixo da mínima" com número quebrado', () => {
    const c = cenarios(null)
    const v = { cor: 'vermelho', margemAlvo: 20, margemMinima: 10 }
    const frase = fraseVeredito(c, v)
    expect(frase).toBe('Sem receita prevista ainda — preencha lotes e valores para o veredito.')
  })
})
