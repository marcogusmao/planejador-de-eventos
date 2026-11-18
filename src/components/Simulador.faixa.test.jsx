// @vitest-environment jsdom
//
// Prova RODANDO da faixa POR CAMPO na grade de cenário (decisão do Marco,
// 22/07/2026 — 3b): o campo acoplado do slider de "Ingressos vendidos"
// (vendaPct, percentual ABSOLUTO do lote) recusa fora de 0..100, enquanto os
// IRMÃOS "Ajuste de custos"/"Ajuste do ticket" (ajustes relativos) seguem
// aceitando o negativo em −50..100. Mesma mecânica de NumInput/foraDaFaixa já
// coberta em DossieCustoModal.faixa.test.jsx — aqui prova que a grade passa a
// régua CERTA a cada campo.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SimuladorSliders from './Simulador.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

function montar() {
  const update = vi.fn()
  render(<SimuladorSliders evento={novoEvento('Festa')} update={update} />)
  return { update }
}
// há um campo por cenário com o mesmo rótulo; o [0] é o pessimista.
const campo = (label) => screen.getAllByLabelText(`${label} (digite o valor)`)[0]

describe('Simulador — faixa POR CAMPO (3b): vendaPct 0..100, irmãos −50..100', () => {
  it('vendaPct: digitar −5 avisa (0% a 100% do lote) e NÃO grava', () => {
    const { update } = montar()
    fireEvent.change(campo('Ingressos vendidos'), { target: { value: '-5' } })
    expect(screen.getByText(/entre 0% e 100% do lote/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('vendaPct: digitar 150 também recusa (não vende mais que o lote)', () => {
    const { update } = montar()
    fireEvent.change(campo('Ingressos vendidos'), { target: { value: '150' } })
    expect(screen.getByText(/entre 0% e 100% do lote/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('custoPct (IRMÃO): digitar −5 é ACEITO, sem aviso — o negativo é de propósito', () => {
    const { update } = montar()
    fireEvent.change(campo('Ajuste de custos'), { target: { value: '-5' } })
    expect(screen.queryByText(/entre 0% e 100%/)).toBeNull()
    expect(update).toHaveBeenCalled()
  })

  // 75, e não 80: desde 27/07/2026 o pessimista NASCE em 80 (decisão A do
  // Marco), então digitar 80 não muda nada e o campo, com razão, não grava.
  // O valor de prova tem de ser diferente do padrão para provar a gravação.
  it('vendaPct: um valor válido (75) grava — a faixa não quebrou o campo', () => {
    const { update } = montar()
    fireEvent.change(campo('Ingressos vendidos'), { target: { value: '75' } })
    expect(screen.queryByText(/entre 0% e 100%/)).toBeNull()
    expect(update).toHaveBeenCalled()
  })
})
