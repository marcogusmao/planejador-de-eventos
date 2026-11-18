// @vitest-environment jsdom
//
// Gate 3c — o FIO da tela de reimportação v2. A lógica pura (xlsxReconciliar) já
// tem 17 testes; aqui o que se prova é o componente: sobe um .xlsx v2 EDITADO,
// a tela de revisão aparece com o alvo em destaque, a alteração e a remoção, e
// clicar "Aplicar" chama o update. E a rede da planilha-copiada: arquivo de
// OUTRO evento é RECUSADO nomeando, sem entrar na revisão.
//
// jsdom só aqui; marcaPng (canvas) e protecao/toast são isolados por mock.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import OrcamentoProdutorModal from './OrcamentoProdutorModal.jsx'
import { gerarXlsx } from '../lib/xlsxOrcamentoV2.js'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { COL_V2 } from '../lib/orcamentoV2Contrato.js'

vi.mock('../lib/toast.js', () => ({ showToast: vi.fn() }))
vi.mock('../lib/marcaPng.js', () => ({ gerarLogoPng: vi.fn(async () => null) })) // canvas não roda no jsdom
vi.mock('../lib/protecao.js', () => ({ snapshotSeguranca: vi.fn(() => ({ ok: true })) })) // tem teste próprio

function eventoComItens(nome = 'Brisa 05/12') {
  const ev = novoEvento(nome)
  ev.tipo = 'Brisa'
  ev.categorias.find((c) => c.nome === 'A&B').itens = [
    novoItem({ servico: 'Bar', estimado: 15000, status: 'ESTIMADO' }),
    novoItem({ servico: 'Gelo', estimado: 6000, status: 'ORÇADO' }),
  ]
  return ev
}

// Gera o v2 do evento, edita o AOA (muda o Bar, apaga o Gelo) e devolve um
// File-mock com arrayBuffer() — como o que o <input type=file> entrega.
async function fileEditado(ev) {
  const buf = await gerarXlsx(ev, {})
  const wb = XLSX.read(buf, { type: 'buffer' })
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  aoa[aoa.findIndex((r) => String(r[COL_V2.servico] ?? '').trim() === 'Bar')][COL_V2.estimado] = 18000
  aoa.splice(aoa.findIndex((r) => String(r[COL_V2.servico] ?? '').trim() === 'Gelo'), 1)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb2 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb2, ws, 'ORÇAMENTO')
  const bytes = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' })
  return { name: 'orcamento.xlsx', arrayBuffer: async () => bytes }
}

const inputArquivo = (container) => container.querySelector('input[type="file"]')

describe('OrcamentoProdutorModal — fio da reimportação v2 (tela 3c)', () => {
  beforeEach(cleanup)

  it('sobe v2 editado → revisão com alvo em destaque, alteração e remoção; aplicar chama update', async () => {
    const ev = eventoComItens()
    const update = vi.fn(() => ({ ok: true }))
    const file = await fileEditado(ev)
    const { container } = render(
      <OrcamentoProdutorModal evento={ev} update={update} store={{ eventos: [ev] }} onClose={() => {}} />
    )
    fireEvent.change(inputArquivo(container), { target: { files: [file] } })

    await screen.findByText(/Aplicando em:/) // entrou na revisão v2
    // o alvo aparece no banner do topo E na linha junto do botão (Marco: visível
    // na hora do clique destrutivo) — por isso getAllByText, não getByText
    expect(screen.getAllByText(ev.nome).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Remoções/)).toBeTruthy() // seção própria
    expect(screen.getByText('Gelo')).toBeTruthy() // a linha apagada
    expect(screen.getByText('Bar')).toBeTruthy() // a linha alterada

    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('planilha de OUTRO evento → recusa nomeando, sem entrar na revisão nem chamar update', async () => {
    const evA = eventoComItens('Brisa 05/12')
    const evB = eventoComItens('Marfim 09/05') // id diferente
    const file = await fileEditado(evA) // A2 carimba o evA
    const update = vi.fn(() => ({ ok: true }))
    const { container } = render(
      <OrcamentoProdutorModal evento={evB} update={update} store={{ eventos: [evA, evB] }} onClose={() => {}} />
    )
    fireEvent.change(inputArquivo(container), { target: { files: [file] } })

    await screen.findByText(/é do evento/) // recusa nomeando o evento certo
    expect(screen.queryByText(/Aplicando em:/)).toBeNull() // NÃO entrou na revisão
    expect(update).not.toHaveBeenCalled()
  })
})
