// @vitest-environment jsdom
//
// LOTE DE TRAVAS — as PORTAS de UI (Marco, 23/07/2026). Cada trava é na porta:
// o campo RECUSA com aviso em português e NÃO grava (nunca clampa). Aqui os
// campos que faltavam ganham a régua, no mesmo padrão de DossieCustoModal.faixa
// e Simulador.faixa. As fronteiras de DADO (migração/censo/régua) moram em
// src/lib/loteTravas.evidencia.test.js.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RevenueTab from './RevenueTab.jsx'
import { VeredictoPainel } from './Veredito.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

// ITEM 1 — taxa do sistema do bar (0..100), a porta que faltava --------------
describe('item 1 — Taxa do sistema (%) do bar recusa fora de 0..100 na porta', () => {
  const montar = () => {
    const update = vi.fn()
    const evento = { ...novoEvento('Bar'), barModo: 'porPessoa', openBar: false, barTaxaSistemaPct: 7 }
    render(<RevenueTab evento={evento} update={update} />)
    return { update }
  }
  it('digitar 150 (o repro do auditor): avisa 0..100 e NÃO grava', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Taxa do sistema/)
    fireEvent.change(campo, { target: { value: '150' } })
    expect(screen.getByText(/Percentual entre 0 e 100/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
  it('digitar −30 idem: recusado', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Taxa do sistema/)
    fireEvent.change(campo, { target: { value: '-30' } })
    expect(screen.getByText(/Percentual entre 0 e 100/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
  it('valor 0..100 (60) continua gravando — a faixa não quebrou o campo', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Taxa do sistema/)
    fireEvent.change(campo, { target: { value: '60' } })
    expect(update).toHaveBeenCalledTimes(1)
    // o updater aplica barTaxaSistemaPct = 60
    expect(update.mock.calls[0][0]({})).toEqual({ barTaxaSistemaPct: 60 })
  })
})

// ITEM 2 — margens do veredito (0..100) --------------------------------------
describe('item 2 — Margem mínima/alvo recusam fora de 0..100 na porta', () => {
  const montar = () => {
    const update = vi.fn()
    const evento = { ...novoEvento('Margens'), margemAlvo: 33, margemMinima: 17 }
    render(<VeredictoPainel evento={evento} update={update} />)
    return { update }
  }
  it('margem mínima −20 (prejuízo com semáforo não-vermelho): avisa e NÃO grava', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Margem mínima/)
    fireEvent.change(campo, { target: { value: '-20' } })
    expect(screen.getByText(/Margem entre 0% e 100%/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
  it('margem alvo 150 idem: recusado', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Margem alvo/)
    fireEvent.change(campo, { target: { value: '150' } })
    expect(screen.getByText(/Margem entre 0% e 100%/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
  it('margem 20 válida continua gravando', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Margem mínima/)
    fireEvent.change(campo, { target: { value: '20' } })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]({})).toEqual({ margemMinima: 20 })
  })
})

// ITEM 3 — bilheteria realizada BRUTA ≥ 0; bar realizado (LÍQUIDO) livre ------
describe('item 3 — Fechamento: bilheteria bruta ≥ 0; bar líquido aceita negativo', () => {
  const montar = () => {
    const update = vi.fn()
    const evento = { ...novoEvento('Fech'), receitaRealizada: { bilheteria: 5000, bar: 3000 } }
    render(<FechamentoTab evento={evento} update={update} />)
    return { update }
  }
  it('bilheteria realizada −500 (receita bruta não pode ser negativa): avisa e NÃO grava', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Bilheteria realizada/)
    fireEvent.change(campo, { target: { value: '-500' } })
    expect(screen.getByText(/não pode ser negativo/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
  it('bar realizado −3000 (LUCRO LÍQUIDO — prejuízo é fato) PASSA: sem aviso, grava', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Bar realizado/)
    fireEvent.change(campo, { target: { value: '-3000' } })
    expect(screen.queryByText(/não pode ser negativo/)).toBeNull()
    expect(update).toHaveBeenCalledTimes(1)
    // o updater grava bar: -3000 (negativo aceito de propósito)
    expect(update.mock.calls[0][0]({}).receitaRealizada.bar).toBe(-3000)
  })
  it('bilheteria válida (8000) continua gravando', () => {
    const { update } = montar()
    const campo = screen.getByLabelText(/Bilheteria realizada/)
    fireEvent.change(campo, { target: { value: '8000' } })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]({}).receitaRealizada.bilheteria).toBe(8000)
  })
})
