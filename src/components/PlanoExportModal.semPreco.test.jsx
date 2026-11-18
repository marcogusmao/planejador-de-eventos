// @vitest-environment jsdom
// A revisão do export do plano mostra o aviso do lote sem preço (P8, 06/10/2026)
// na faixa âmbar de avisos, ao lado dos números que já saem sem o lote.
import React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import PlanoExportModal from './PlanoExportModal.jsx'
import { novoEvento, novoLote, novoItem, TIPOS_PADRAO } from '../lib/defaults.js'

afterEach(cleanup)

function festaP8(valorCamarote = '') {
  const e = novoEvento('Festa P8')
  e.tipo = TIPOS_PADRAO[0]
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'l4', nome: 'Camarote', valor: valorCamarote, quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  return e
}

const avisoNaFaixa = (container) =>
  [...container.querySelectorAll('p')].find((p) => p.textContent.includes('“Camarote” (300 ingressos) está sem preço'))

describe('PlanoExportModal com lote sem preço', () => {
  it('a faixa de avisos traz o lote que ficou de fora, em âmbar', () => {
    const r = render(<PlanoExportModal evento={festaP8()} onClose={vi.fn()} />)
    const p = avisoNaFaixa(r.container)
    expect(p).toBeTruthy()
    expect(p.parentElement.className).toContain('ambar-texto')
  })

  it('com preço 0 declarado (cortesia), o aviso não aparece', () => {
    const r = render(<PlanoExportModal evento={festaP8(0)} onClose={vi.fn()} />)
    expect(avisoNaFaixa(r.container)).toBeFalsy()
  })
})
