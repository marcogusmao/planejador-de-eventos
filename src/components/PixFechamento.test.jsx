// @vitest-environment jsdom
import { useState } from 'react'
import { it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import FechamentoTab from './FechamentoTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import { novoEvento } from '../lib/defaults.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import { resumoCurto } from '../lib/resumo.js'

afterEach(cleanup)
const evento = () => ({
  ...novoEvento('Teste Pix'),
  categorias: [],
  receitaRealizada: { bilheteria: 10000, bar: 0 },
})
function Tela() {
  const [e, set] = useState(evento)
  return <FechamentoTab evento={e} update={set} />
}

it('digitar valor brasileiro mostra linha do Pix; apagar retira a linha da conta', () => {
  render(<Tela />)
  const input = screen.getByLabelText(/Pix recebido/)
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '1.234,56' } })
  fireEvent.blur(input)
  expect(screen.getByText('adicional, sem descontos automáticos')).toBeTruthy()
  expect(screen.getByText(/1\.234,56/, { selector: 'div.tnum' })).toBeTruthy()
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.blur(input)
  expect(screen.queryByText('adicional, sem descontos automáticos')).toBeNull()
})

it('evento fechado mantém o valor na foto e impede edição do Pix', () => {
  const e = evento()
  e.receitaRealizada.pix = 1000
  const fechado = fecharEvento(e)
  render(<FechamentoTab evento={fechado} update={() => { throw new Error('não deve editar') }} />)
  expect(screen.getByLabelText(/Pix recebido/).disabled).toBe(true)
  expect(screen.getByText('adicional, sem descontos automáticos')).toBeTruthy()
})

it('PDF, apresentação e resumo levam a receita da foto já acrescida do Pix', () => {
  const e = evento()
  e.taxaBilheteria = 0
  e.cashbackPct = 0
  e.receitaRealizada.pix = 1000
  const fechado = fecharEvento(e)
  const store = { eventos: [fechado], benchmarksCustom: [] }
  const normalizar = (texto) => texto.replace(/\u00a0/g, ' ')
  render(<ReportView evento={fechado} store={store} onBack={() => {}} />)
  expect(normalizar(screen.getByText(/Resultado real do evento/).closest('section').textContent))
    .toContain('Receita real R$ 11.000')
  cleanup()
  render(<PresentationMode evento={fechado} store={store} onClose={() => {}} />)
  expect(normalizar(screen.getByText(/Festa realizada/).closest('div').textContent))
    .toContain('receita real R$ 11.000')
  expect(normalizar(resumoCurto(fechado))).toContain('Receita real R$ 11.000')
})
