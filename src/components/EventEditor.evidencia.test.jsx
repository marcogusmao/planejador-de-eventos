// @vitest-environment jsdom
//
// Evidência do achado S3 do BACKLOG, item (b): "trava de evento fechado no
// EventEditor". Decisão datada que este teste trava (Marco, 24/07/2026 nav
// sticky "Reabrir evento"/"Fechar evento", pinada — comentário em
// EventEditor.jsx linhas 437-441): em evento FECHADO, o EventEditor trava a
// EDIÇÃO DE CAMPO (nome, metadados, painel do veredito, abas Receita/Custos/
// Cenários/Análise) via <fieldset disabled> + disabled individual — mas
// REABRIR (o caminho de volta) e a própria aba Fechamento continuam
// permitidos, de propósito (comentário "A aba Fechamento fica FORA" em
// EventEditor.jsx linha 481). Duplicar/excluir/nova edição vivem em
// Home.jsx (EventoCard), NÃO aqui — a outra metade do item (b) está provada
// em Home.evidencia.test.jsx, que trava que esses três seguem permitidos.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import EventEditor from './EventEditor.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

const eventoFechadoDeTeste = () => ({
  ...novoEvento('Evento Fechado'),
  status: 'fechado',
  fechamento: { em: '2026-07-20T21:00:00.000Z', foto: { resultado: { resultado: 1 } } },
})

const eventoAbertoDeTeste = () => novoEvento('Evento Aberto')

const montar = (evento) => {
  const props = {
    evento,
    store: { eventos: [], benchmarksCustom: [] },
    setStore: vi.fn(),
    aparencia: {},
    update: vi.fn(),
    onBack: vi.fn(),
    onApresentar: vi.fn(),
    onRelatorio: vi.fn(),
    onModoRascunho: vi.fn(),
    onFecharEvento: vi.fn(),
    onReabrirEvento: vi.fn(),
  }
  render(<EventEditor {...props} />)
  return props
}

describe('Evento fechado: a EDIÇÃO DE CAMPO trava (fieldset + disabled individual)', () => {
  it('nome do evento fica desabilitado (disabled individual, linha 279)', () => {
    montar(eventoFechadoDeTeste())
    expect(screen.getByLabelText('Nome do evento').disabled).toBe(true)
  })

  // jsdom (a suíte roda em jsdom, não num navegador real) NÃO implementa a
  // cascata nativa de <fieldset disabled> para os campos de dentro — a
  // propriedade .disabled de um <input> dentro de um fieldset desabilitado
  // continua `false` em jsdom mesmo sendo `true` em qualquer navegador de
  // verdade (confirmado isolado: `new JSDOM('<fieldset disabled><input
  // id=x>').window.document.getElementById('x').disabled` → false). Por
  // isso a prova aqui é estrutural: o campo está DENTRO de um <fieldset>
  // que carrega o atributo disabled — é exatamente essa marcação que faz o
  // navegador aplicar a trava; se o EventEditor parar de marcar o fieldset,
  // esta asserção cai junto.
  it('campo "Data" dos metadados vive dentro de um fieldset com o atributo disabled (1º fieldset)', () => {
    montar(eventoFechadoDeTeste())
    const fieldset = screen.getByLabelText('Data').closest('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset.hasAttribute('disabled')).toBe(true)
  })

  it('campo "Taxa bilheteria (%)" da aba Receita vive dentro de um fieldset com o atributo disabled (3º fieldset)', () => {
    montar(eventoFechadoDeTeste())
    const fieldset = screen.getByLabelText(/Taxa bilheteria/).closest('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset.hasAttribute('disabled')).toBe(true)
  })

  it('botão "Buscar dados do Financeiro" fica desabilitado (disabled individual)', () => {
    montar(eventoFechadoDeTeste())
    expect(screen.getByRole('button', { name: /Buscar dados do Financeiro/ }).disabled).toBe(true)
  })
})

describe('Evento ABERTO: os mesmos campos NÃO travam (a trava é condicional, não sempre-on)', () => {
  it('nome do evento fica habilitado', () => {
    montar(eventoAbertoDeTeste())
    expect(screen.getByLabelText('Nome do evento').disabled).toBe(false)
  })

  // Mesma nota do bloco acima: checa o atributo disabled do fieldset
  // ancestral (não a propriedade .disabled cascateada, que jsdom não simula).
  it('campo "Data" dos metadados: o fieldset que o envolve NÃO carrega disabled', () => {
    montar(eventoAbertoDeTeste())
    const fieldset = screen.getByLabelText('Data').closest('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset.hasAttribute('disabled')).toBe(false)
  })

  it('campo "Taxa bilheteria (%)" da aba Receita: o fieldset que o envolve NÃO carrega disabled', () => {
    montar(eventoAbertoDeTeste())
    const fieldset = screen.getByLabelText(/Taxa bilheteria/).closest('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset.hasAttribute('disabled')).toBe(false)
  })

  it('botão "Buscar dados do Financeiro" fica habilitado', () => {
    montar(eventoAbertoDeTeste())
    expect(screen.getByRole('button', { name: /Buscar dados do Financeiro/ }).disabled).toBe(false)
  })
})

describe('Evento fechado: REABRIR continua permitido — é o caminho de volta, não pode ficar preso atrás da própria trava', () => {
  it('botão "Reabrir evento" da nav sticky aparece sem disabled e, confirmado, chama onReabrirEvento', () => {
    const props = montar(eventoFechadoDeTeste())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const botao = screen.getByRole('button', { name: 'Reabrir evento' })
    expect(botao.disabled).toBe(false)
    fireEvent.click(botao)
    expect(confirmSpy).toHaveBeenCalled()
    expect(props.onReabrirEvento).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('cancelando a confirmação, onReabrirEvento NÃO é chamado (o clique sozinho não basta)', () => {
    const props = montar(eventoFechadoDeTeste())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir evento' }))
    expect(props.onReabrirEvento).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

describe('Evento fechado: a aba Fechamento fica FORA da trava — é onde se reabre e se vê a foto', () => {
  it('o botão de trocar para a aba "Fechamento" não está desabilitado e a troca funciona', () => {
    montar(eventoFechadoDeTeste())
    const abaFechamento = screen.getByRole('button', { name: /Fechamento/ })
    expect(abaFechamento.disabled).toBe(false)
    fireEvent.click(abaFechamento)
    // Conteúdo da FechamentoTab (fora do fieldset que trava as outras abas):
    // o segundo botão "Reabrir evento…" mora dentro dela, na faixa de estado.
    expect(screen.getByRole('button', { name: /Reabrir evento — volta a editar/ })).toBeTruthy()
  })
})
