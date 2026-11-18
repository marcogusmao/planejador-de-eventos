// Hardening 4.1: o save NORMAL do store nunca falha em silêncio. A camada de
// proteção (lixeira/snapshots, Sessão C) já avisava; a lacuna era saveStore —
// chamado a cada edição pelo App. Aqui a exceção de quota é SIMULADA, como o
// prompt de hardening exige.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { saveStore, loadStore } from './storage.js'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('saveStore nunca falha em silêncio (hardening 4.1)', () => {
  it('quota estourada → { ok:false, erro } SEM lançar (a UI mostra a faixa)', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new DOMException('quota do navegador esgotada', 'QuotaExceededError')
      },
      getItem: () => null,
    })
    const r = saveStore({ eventos: [] })
    expect(r.ok).toBe(false)
    expect(r.erro).toBeTruthy()
  })

  it('gravação normal → { ok:true } e o round-trip com loadStore funciona', () => {
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      setItem: (k, v) => mem.set(k, v),
      getItem: (k) => mem.get(k) ?? null,
    })
    const r = saveStore({
      eventos: [],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksOcultos: [],
      ajustes: null,
    })
    expect(r).toEqual({ ok: true })
    expect(loadStore().eventos).toEqual([])
  })

  it('ambiente sem localStorage → { ok:false } com motivo (nunca exceção)', () => {
    vi.stubGlobal('localStorage', undefined)
    // stubGlobal(undefined) mantém a chave definida; simula o ambiente sem
    // armazenamento pelo caminho do typeof no módulo
    const r = saveStore({ eventos: [] })
    expect(r.ok).toBe(false)
  })
})
