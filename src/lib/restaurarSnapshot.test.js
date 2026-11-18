// §9.11.3 (H3-D, 21/07/2026) — política ÚNICA do princípio 7 no restaurar:
// sem a cópia de segurança do estado atual, NÃO se aplica — a exceção é um
// SIM explícito do usuário (forcarSemSeguranca), nunca um aviso depois do
// fato. Antes, restaurava mesmo assim, quebrando a promessa do confirm.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { restaurarSnapshot, snapshotSeguranca } from './protecao.js'

function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    _mapa: mapa,
  }
}

const STORE_A = { eventos: [{ id: 'a', nome: 'A' }], benchmarksCustom: [] }
const STORE_B = { eventos: [{ id: 'b', nome: 'B' }], benchmarksCustom: [] }

let ls
beforeEach(() => {
  ls = localStorageDeMentira()
  vi.stubGlobal('localStorage', ls)
})

const criarSnapshotDe = (store) => {
  snapshotSeguranca(store, '2026-07-20T10:00:00.000Z', 'versão de teste')
  const snaps = JSON.parse(ls.getItem('previsao-eventos:snapshots:v1') || '[]')
  return snaps[0].id
}

describe('restaurarSnapshot — sem rede de volta, não aplica', () => {
  it('caminho feliz: restaura e guarda a cópia de segurança do atual', () => {
    const id = criarSnapshotDe(STORE_A)
    const r = restaurarSnapshot(id, STORE_B)
    expect(r.ok).toBe(true)
    expect(r.segurancaOk).toBe(true)
    expect(r.store.eventos[0].id).toBe('a')
  })

  it('cópia de segurança FALHOU (quota): recusa com semSeguranca e erro em português — nada aplicado', () => {
    const id = criarSnapshotDe(STORE_A)
    ls.setItem = () => {
      throw new Error('quota')
    }
    // E3 (auditoria externa 22/07/2026): a quota estourando é o propósito do
    // teste — saveSnapshots (protecao.js) loga no catch final. Capturamos e
    // ASSERTAMOS em vez de deixar vazar no output da suíte.
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = restaurarSnapshot(id, STORE_B)
    expect(r.ok).toBe(false)
    expect(r.semSeguranca).toBe(true)
    expect(r.erro).toMatch(/cópia de segurança/i)
    expect(r.erro).toMatch(/nada foi restaurado/i)
    expect(r.store).toBeNull()
    expect(espiaErro).toHaveBeenCalledWith(
      'Erro ao salvar snapshot (quota do navegador esgotada)',
      expect.any(Error)
    )
    // Contagem fechada (lente adversarial 22/07): erro extra inesperado no
    // mesmo fluxo não pode passar em silêncio pelo spy.
    expect(espiaErro).toHaveBeenCalledTimes(1)
    espiaErro.mockRestore()
  })

  it('com o SIM explícito (forcarSemSeguranca), aplica e declara segurancaOk: false', () => {
    const id = criarSnapshotDe(STORE_A)
    ls.setItem = () => {
      throw new Error('quota')
    }
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = restaurarSnapshot(id, STORE_B, { forcarSemSeguranca: true })
    expect(r.ok).toBe(true)
    expect(r.segurancaOk).toBe(false)
    expect(r.store.eventos[0].id).toBe('a')
    expect(espiaErro).toHaveBeenCalledWith(
      'Erro ao salvar snapshot (quota do navegador esgotada)',
      expect.any(Error)
    )
    // Contagem fechada (lente adversarial 22/07) — mesma razão do teste acima.
    expect(espiaErro).toHaveBeenCalledTimes(1)
    espiaErro.mockRestore()
  })

  it('snapshot inexistente segue recusando como antes', () => {
    const r = restaurarSnapshot('nao-existe', STORE_B)
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/não encontrado/)
  })
})
