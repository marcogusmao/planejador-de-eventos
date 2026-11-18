// Testes do protocolo de detecção de segunda aba (hardening 4.2), usando o
// BroadcastChannel REAL do Node (mesma semântica de entrega assíncrona do
// navegador). Cobrem: detecção nos dois lados, saída limpa (tchau), morte
// SEM despedida (o caso real que o pagehide não cobre — provado necessário
// no teste ao vivo do painel) e degradação sem alarme falso.

import { describe, it, expect, vi } from 'vitest'
import { vigiarOutrasAbas, CANAL_ABAS } from './multiAba.js'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function ate(cond, prazoMs = 1500) {
  const inicio = Date.now()
  while (!cond()) {
    if (Date.now() - inicio > prazoMs) return false
    await espera(10)
  }
  return true
}

const RAPIDO = { msBatida: 40, msSumico: 150 }

describe('vigiarOutrasAbas (hardening 4.2)', () => {
  it('duas abas se detectam; saída LIMPA some com o aviso na hora', async () => {
    const a = { outra: null }
    const b = { outra: null }
    const pararA = vigiarOutrasAbas((v) => (a.outra = v), RAPIDO)
    await espera(60)
    expect(a.outra).toBe(null) // sozinha: nenhum sinal, nenhum alarme falso

    const pararB = vigiarOutrasAbas((v) => (b.outra = v), RAPIDO)
    expect(await ate(() => a.outra === true)).toBe(true)
    expect(await ate(() => b.outra === true)).toBe(true)

    pararB() // fechar limpo grita 'tchau'
    expect(await ate(() => a.outra === false)).toBe(true)
    pararA()
  })

  it('aba que MORRE sem se despedir: o aviso expira sozinho pelo batimento', async () => {
    const a = { outra: null }
    const pararA = vigiarOutrasAbas((v) => (a.outra = v), RAPIDO)

    // "aba" fantasma: um canal cru que dá oi e depois some SEM tchau —
    // exatamente o que o painel de navegador fez no teste ao vivo
    const fantasma = new BroadcastChannel(CANAL_ABAS)
    fantasma.postMessage({ tipo: 'oi', id: 'fantasma' })
    expect(await ate(() => a.outra === true)).toBe(true)
    fantasma.close() // morre calada

    expect(await ate(() => a.outra === false, 2000)).toBe(true)
    pararA()
  })

  it('três abas: fechar UMA não faz as outras acharem que estão sozinhas', async () => {
    const a = { outra: null }
    const b = { outra: null }
    const c = { outra: null }
    const pararA = vigiarOutrasAbas((v) => (a.outra = v), RAPIDO)
    const pararB = vigiarOutrasAbas((v) => (b.outra = v), RAPIDO)
    const pararC = vigiarOutrasAbas((v) => (c.outra = v), RAPIDO)
    expect(await ate(() => a.outra === true && b.outra === true && c.outra === true)).toBe(true)

    pararC()
    await espera(300) // bem além do msSumico — A e B seguem se ouvindo
    expect(a.outra).toBe(true)
    expect(b.outra).toBe(true)
    pararA()
    pararB()
  })

  it('canal indisponível → degrada sem lançar e sem alarme falso', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cb = vi.fn()
    const parar = vigiarOutrasAbas(cb, {
      criarCanal: () => {
        throw new Error('sem canal')
      },
    })
    await espera(60)
    expect(typeof parar).toBe('function')
    parar()
    expect(cb).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
