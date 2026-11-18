// @vitest-environment jsdom
//
// Evidência do achado S3 do BACKLOG, item (b): "teste de que duplicar/
// excluir/restaurar seguem permitidos e só o campo trava". Este arquivo
// COMPLEMENTA EventEditor.evidencia.test.jsx — aquele prova que a EDIÇÃO DE
// CAMPO trava em evento fechado (fieldset + disabled individual); este prova
// a outra metade: os três botões do card na Home (Duplicar, Nova edição,
// Mover para a lixeira) — que vivem no EventoCard dentro de Home.jsx, NÃO no
// EventEditor — continuam SEMPRE permitidos, fechado ou não.
//
// A REGRA QUE ESTE ARQUIVO TRAVA: fechar um evento não pode prender o dono.
// Ele tem de poder duplicar a festa fechada para a próxima edição e mover
// para a lixeira mesmo depois de fechada — Home.jsx nunca importa nem chama
// eventoFechado/status==='fechado' perto desses três botões, de propósito.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

// Mesmo fixture de evento fechado do EventEditor.evidencia.test.jsx — mesma
// forma mínima que o app considera "fechado" (status + registro de fechamento).
const eventoFechadoDeTeste = (nome = 'Evento Fechado') => ({
  ...novoEvento(nome),
  status: 'fechado',
  fechamento: { em: '2026-07-20T21:00:00.000Z', foto: { resultado: { resultado: 1 } } },
})

const eventoAbertoDeTeste = (nome = 'Evento Aberto') => novoEvento(nome)

// localStorage de memória — o mesmo truque de lixeiraTransacao.test.js/
// chavePonte.test.js/benchmarks.js. A lixeira (protecao.js) toca localStorage
// de verdade; sem isto o `moverParaLixeira` chamado por "Mover para a
// lixeira" quebraria (ou vazaria estado de um teste para o outro).
function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  }
}

const montar = (eventos) => {
  const props = {
    store: { eventos, benchmarksCustom: [] },
    setStore: vi.fn(),
    aparencia: {},
    abrir: vi.fn(),
    abrirAjustes: vi.fn(),
  }
  render(<Home {...props} />)
  return props
}

// A lixeira (protecao.js) vive em localStorage de verdade (jsdom simula) —
// limpa entre testes para nenhum excluir de um teste vazar `descartado` ou
// colidir com o próximo.
beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
})

describe('Evento FECHADO: os três botões do card (Duplicar, Nova edição, Mover para a lixeira) continuam permitidos', () => {
  it('o botão "Duplicar (cópia idêntica)" existe e NÃO está desabilitado', () => {
    montar([eventoFechadoDeTeste()])
    const botao = screen.getByRole('button', { name: 'Duplicar (cópia idêntica)' })
    expect(botao.disabled).toBe(false)
  })

  it('o botão "Nova edição" existe e NÃO está desabilitado', () => {
    montar([eventoFechadoDeTeste()])
    const botao = screen.getByRole('button', { name: /Nova edição/ })
    expect(botao.disabled).toBe(false)
  })

  it('o botão "Mover para a lixeira" existe e NÃO está desabilitado', () => {
    montar([eventoFechadoDeTeste()])
    const botao = screen.getByRole('button', { name: 'Mover para a lixeira' })
    expect(botao.disabled).toBe(false)
  })

  it('clicar em "Duplicar" realmente produz um evento novo no store (efeito, não só o botão existir)', () => {
    const evento = eventoFechadoDeTeste()
    const props = montar([evento])
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar (cópia idêntica)' }))

    expect(props.setStore).toHaveBeenCalledTimes(1)
    const [atualizador] = props.setStore.mock.calls[0]
    const novoStore = atualizador({ eventos: [evento], benchmarksCustom: [] })

    expect(novoStore.eventos).toHaveLength(2)
    const copia = novoStore.eventos.find((e) => e.id !== evento.id)
    expect(copia).toBeTruthy()
    expect(copia.nome).toBe('Evento Fechado (cópia)')
  })

  it('duplicar NÃO muta o evento original (o objeto original continua "Evento Fechado", fechado)', () => {
    const evento = eventoFechadoDeTeste()
    const nomeOriginal = evento.nome
    const props = montar([evento])
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar (cópia idêntica)' }))

    const [atualizador] = props.setStore.mock.calls[0]
    atualizador({ eventos: [evento], benchmarksCustom: [] })

    // O mesmo objeto passado para o componente — se duplicarCopia mutasse em
    // vez de clonar, isto teria mudado.
    expect(evento.nome).toBe(nomeOriginal)
    expect(evento.status).toBe('fechado')
  })

  it('clicar em "Mover para a lixeira" (confirmado) realmente tira o evento do store', () => {
    const evento = eventoFechadoDeTeste()
    const props = montar([evento])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(props.setStore).toHaveBeenCalledTimes(1)
    const [atualizador] = props.setStore.mock.calls[0]
    const novoStore = atualizador({ eventos: [evento], benchmarksCustom: [] })
    expect(novoStore.eventos).toHaveLength(0)

    confirmSpy.mockRestore()
  })

  it('cancelando a confirmação de exclusão, o store NÃO é tocado (o clique sozinho não basta)', () => {
    const evento = eventoFechadoDeTeste()
    const props = montar([evento])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    expect(props.setStore).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

describe('CONTRASTE — evento ABERTO: os mesmos três botões também ficam habilitados (a regra é "sempre permitido", não "permitido só quando fechado")', () => {
  it('Duplicar, Nova edição e Mover para a lixeira estão todos habilitados num evento aberto', () => {
    montar([eventoAbertoDeTeste()])
    expect(screen.getByRole('button', { name: 'Duplicar (cópia idêntica)' }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /Nova edição/ }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Mover para a lixeira' }).disabled).toBe(false)
  })
})
