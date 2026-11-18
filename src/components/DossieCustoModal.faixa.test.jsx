// @vitest-environment jsdom
//
// Lente adversarial 22/07: o Dossiê do Custo edita o MESMO item.estimado/
// realizado que a tabela do CostsTab — é a segunda porta de UI do campo, e
// ficou sem a faixa quando o Bloco B travou a primeira (um custo −500 por
// aqui inflava o lucro em R$ 500, mostrado como certo). Estes testes provam
// que as DUAS portas têm a mesma trava e que o campo continua funcionando.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DossieCustoModal from './DossieCustoModal.jsx'
import { novoItem } from '../lib/defaults.js'

afterEach(cleanup)

function montar() {
  const onChange = vi.fn()
  const item = novoItem({ servico: 'DJ', estimado: 4321, status: 'ESTIMADO' })
  render(
    <DossieCustoModal
      item={item}
      categoriaNome="Artístico"
      onChange={onChange}
      onClose={() => {}}
    />
  )
  return { onChange }
}

describe('Dossiê do Custo — segunda porta do estimado tem a MESMA faixa do CostsTab', () => {
  it('digitar −500 no Estimado: avisa em português e NÃO grava', () => {
    const { onChange } = montar()
    const campo = screen.getByDisplayValue('4.321')
    fireEvent.change(campo, { target: { value: '-500' } })
    expect(screen.getByText(/Custo não pode ser negativo/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalledWith({ estimado: -500 })
  })

  it('parêntese contábil (500) também é recusado nesta porta', () => {
    const { onChange } = montar()
    const campo = screen.getByDisplayValue('4.321')
    fireEvent.change(campo, { target: { value: '(500)' } })
    expect(screen.getByText(/Custo não pode ser negativo/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalledWith({ estimado: -500 })
  })

  it('valor válido continua gravando — a faixa não quebrou o campo', () => {
    const { onChange } = montar()
    const campo = screen.getByDisplayValue('4.321')
    fireEvent.change(campo, { target: { value: '5000' } })
    expect(onChange).toHaveBeenCalledWith({ estimado: 5000 })
  })
})
