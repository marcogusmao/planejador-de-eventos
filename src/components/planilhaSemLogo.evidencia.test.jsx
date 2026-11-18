// @vitest-environment jsdom
//
// A PLANILHA DO PRODUTOR NÃO SAI SEM LOGO EM SILÊNCIO (reconferência do PR #100,
// 05/10/2026 — achado pelos dois revisores, de forma independente).
//
// O logo da festa era carregado por `blob:`; a política de conteúdo do servidor
// da nuvem (img-src 'self' data:) bloqueava; e um `catch {}` mudo no modal
// deixava o .xlsx sair sem imagem, com "Planilha baixada" na tela — princípio 4
// ferido. O conserto tem duas metades: o marcaPng.js passou a usar `data:` (a
// prova no Chromium é o scripts/prova-csp-nuvem.mjs, que baixa a planilha e
// exige imagem em xl/media) e, se o logo falhar mesmo assim, a tela AVISA. Este
// arquivo prova a segunda metade: canvas não roda no jsdom, então a falha do
// logo é encenada no mock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import OrcamentoProdutorModal from './OrcamentoProdutorModal.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { gerarLogoPng, msgPlanilhaSemLogo } from '../lib/marcaPng.js'

vi.mock('../lib/toast.js', () => ({ showToast: vi.fn() }))
vi.mock('../lib/protecao.js', () => ({ snapshotSeguranca: vi.fn(() => ({ ok: true })) }))
vi.mock('../lib/marcaPng.js', async (original) => ({
  ...(await original()),
  gerarLogoPng: vi.fn(),
}))

const evento = () => {
  const ev = novoEvento('Marfim Alto #1')
  ev.tipo = 'Marfim Alto'
  ev.categorias.find((c) => c.nome === 'A&B').itens = [novoItem({ servico: 'Bar', estimado: 15000, status: 'ESTIMADO' })]
  return ev
}

beforeEach(() => {
  // jsdom não tem createObjectURL; o download é só um link clicado.
  URL.createObjectURL = vi.fn(() => 'blob:teste')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const baixar = () => {
  render(<OrcamentoProdutorModal evento={evento()} update={vi.fn()} store={{ eventos: [] }} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Baixar planilha do orçamento/ }))
}

describe('planilha do produtor: logo que falha é AVISADO, não engolido', () => {
  it('o logo falha → a planilha baixa assim mesmo, e a tela diz que saiu sem logo e por quê', async () => {
    gerarLogoPng.mockRejectedValue(new Error('o desenho da marca não carregou no navegador'))
    baixar()
    await screen.findByText('Planilha baixada — nada no evento muda ao exportar.')
    const aviso = msgPlanilhaSemLogo('o desenho da marca não carregou no navegador')
    expect(screen.getByText(aviso)).toBeTruthy()
    expect(aviso).toMatch(/sem logo/)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1) // o .xlsx saiu
  })

  it('o logo sai → nenhum aviso', async () => {
    gerarLogoPng.mockResolvedValue(null)
    baixar()
    await screen.findByText('Planilha baixada — nada no evento muda ao exportar.')
    await waitFor(() => expect(gerarLogoPng).toHaveBeenCalled())
    expect(screen.queryByText(/sem logo/)).toBeNull()
  })
})
