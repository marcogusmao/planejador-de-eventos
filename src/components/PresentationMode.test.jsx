// @vitest-environment jsdom
//
// H3-AUDIT frente 17 — teste de render do CANÁRIO 2. `aplicarSimulacao` NÃO pode
// virar um `useCallback` com deps velhas: embrulhado assim, o handler lê o
// `mudancas` obsoleto do primeiro render e o "Aplicar ao evento" para de salvar
// EM SILÊNCIO (o buraco que a auditoria leu como "refactor inofensivo, cosmético").
// A lib pura (simulacaoRascunho) já era testada; o que faltava era o FIO do
// componente. Este teste renderiza de verdade, mexe num slider e clica Aplicar —
// se o handler estiver preso no passado, `update` não é chamado e o teste morde.
//
// Ambiente jsdom só AQUI (comentário acima): os ~1600 testes de lib seguem em
// 'node', sem ficar mais lentos.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PresentationMode from './PresentationMode.jsx'
import { novoEvento } from '../lib/defaults.js'

vi.mock('../lib/toast.js', () => ({ showToast: vi.fn() }))
// snapshotSeguranca toca localStorage e já tem teste próprio (protecao.test.js).
// Aqui isolamos o FIO do componente: o snapshot passa, e o que se testa é se o
// handler chega ao update com o rascunho fresco.
vi.mock('../lib/protecao.js', () => ({ snapshotSeguranca: () => ({ ok: true }) }))

beforeEach(() => {
  cleanup()
})

function montar() {
  const evento = novoEvento('Festa de Teste')
  const store = { eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }
  const update = vi.fn()
  render(
    <PresentationMode
      evento={evento}
      store={store}
      update={update}
      aparencia={{}}
      onClose={() => {}}
    />
  )
  return { evento, update }
}

describe('PresentationMode — canário 2: "Aplicar ao evento" não pode ser silencioso', () => {
  it('mexer num slider e clicar Aplicar CHAMA update (o handler lê o rascunho FRESCO)', () => {
    const { update } = montar()

    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThan(0)

    // mexe no 1º slider → cria uma mudança no rascunho (rascunho ≠ salvo)
    fireEvent.change(sliders[0], { target: { value: '42' } })

    // o botão passa a refletir a mudança: "Aplicar N mudança(s) ao evento"
    const btn = screen.getByRole('button', { name: /Aplicar \d+ mudança/i })
    fireEvent.click(btn)

    // COM o useCallback de deps velhas (canário 2), `mudancas` estaria obsoleto
    // (vazio) → early-return → update NUNCA chamado. Com o handler fresco, grava.
    expect(update).toHaveBeenCalledTimes(1)
  })
})
