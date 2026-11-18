// @vitest-environment jsdom
//
// O FIO da tela que restaura — decisão 18 do Marco (25/07/2026, "corrigir E
// mostrar"). A lógica pura já tem teste próprio (revisaoRestauracao.test.js) e
// as portas de protecao.js também (censoImportAtaque.test.js). O que se prova
// AQUI é o comportamento da tela, que é onde o princípio 7 acontece:
//
//   1. instantâneo com número fora de faixa NÃO é aplicado sozinho — a revisão
//      aparece primeiro, e o store do app continua intocado;
//   2. a revisão diz, na tela, o campo, o valor salvo, para onde ele vai e o
//      efeito em R$ — item a item, não um aviso genérico;
//   3. o botão diz a AÇÃO e o EFEITO ("Aplicar 1 correção e restaurar"), e só
//      ele aplica — e o que entra no app é o CORRIGIDO;
//   4. existe o caminho de VER como foi salvo, sem aplicar;
//   5. cancelar não aplica nada;
//   6. instantâneo são não paga o pedágio: restaura direto, sem tela no meio.
//
// A pergunta adversarial que este arquivo responde: "a tela de revisão pode ser
// pulada sem querer?". A resposta tem de ser um teste, não uma leitura do JSX.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ProtecaoModal from './ProtecaoModal.jsx'
import { snapshotSeguranca, loadSnapshots } from '../lib/protecao.js'
import { computeCenario } from '../lib/calc.js'
import { novoEvento } from '../lib/defaults.js'

function memoriaFalsa() {
  const mem = new Map()
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i) => [...mem.keys()][i] ?? null,
  }
}

// Mesma festa sintética dos testes de lib: 500 × R$ 100, custo R$ 20.000.
const festa = (patch = {}) => ({
  ...novoEvento('Marfim de Teste'),
  id: 'e1',
  lotes: [{ id: 'l1', nome: '1º lote', valor: 100, quantidade: 500 }],
  categorias: [
    { nome: 'Produção', itens: [{ id: 'c1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
  ],
  ...patch,
})

// vendaPct 70 + a marca `padraoPessimista80` de propósito (27/07/2026): os R$
// que esta tela exibe nas asserções abaixo são os NÚMEROS MEDIDOS do achado de
// 20/07, num evento que vendia 70% no pessimista. A subida do padrão para 80
// (decisão A do Marco) é outro assunto; segurá-la aqui mantém este teste
// falando de UMA correção só — a do custoPct −200.
const festaVenenosa = () =>
  festa({
    cenariosConfig: { pessimista: { vendaPct: 70, custoPct: -200 }, realista: {}, otimista: {} },
    padraoPessimista80: { de: null },
  })

const storeAtual = { eventos: [], benchmarksCustom: [] }

function montar(eventoGuardado) {
  snapshotSeguranca({ eventos: [eventoGuardado], benchmarksCustom: [] }, '2026-07-21T10:00:00.000Z', 'versão de teste')
  const onRestaurarStore = vi.fn()
  render(
    <ProtecaoModal
      store={storeAtual}
      onClose={() => {}}
      onRestaurarEvento={() => ({ ok: true })}
      onRestaurarEventoComoCopia={() => ({ ok: true })}
      onRestaurarStore={onRestaurarStore}
    />
  )
  // O primeiro "Restaurar" da lista de Versões automáticas é o da versão que
  // acabamos de plantar (a lixeira está vazia neste cenário).
  fireEvent.click(screen.getAllByRole('button', { name: 'Restaurar' })[0])
  return onRestaurarStore
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoriaFalsa())
  // O confirm de "vai substituir todos os eventos" continua sendo o de sempre.
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('restaurar um instantâneo com número fora de faixa — a revisão vem ANTES', () => {
  it('nada é aplicado até o clique: a revisão aparece e o store do app não foi tocado', () => {
    const onRestaurarStore = montar(festaVenenosa())
    expect(onRestaurarStore).not.toHaveBeenCalled()
    expect(screen.getByText(/foi salva antes de uma correção do app/i)).toBeTruthy()
  })

  it('a revisão diz o campo, o valor salvo, para onde vai e o efeito em R$ — item a item', () => {
    montar(festaVenenosa())
    // o campo e o valor como foi salvo (rótulo verbatim do censo)
    expect(screen.getByText(/cenário pessimista, ajuste de custos/i)).toBeTruthy()
    // para onde ele vai, e o microtexto que explica a regra ao lado
    expect(screen.getByText('não informado')).toBeTruthy()
    expect(screen.getByText(/o cenário volta a usar o ajuste padrão dele/i)).toBeTruthy()
    // e o efeito no dinheiro, com o antes e o depois
    expect(screen.getByText('Lucro (pessimista):')).toBeTruthy()
    expect(screen.getByText('R$ 54.250')).toBeTruthy()
    expect(screen.getByText('R$ 10.150')).toBeTruthy()
  })

  it('o botão diz a AÇÃO e o EFEITO, e é ele que aplica — com o store CORRIGIDO', () => {
    const onRestaurarStore = montar(festaVenenosa())
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar 1 correção e restaurar' }))

    expect(onRestaurarStore).toHaveBeenCalledTimes(1)
    const aplicado = onRestaurarStore.mock.calls[0][0]
    expect(Math.round(computeCenario(aplicado.eventos[0], 'pessimista').lucro)).toBe(10150)
    // e o veneno não entrou no app
    expect(aplicado.eventos[0].cenariosConfig.pessimista.custoPct).toBeUndefined()
  })

  it('o caminho de NÃO APLICAR existe: dá para ver como foi salvo, com o aviso de que a conta estava errada', () => {
    const onRestaurarStore = montar(festaVenenosa())
    fireEvent.click(screen.getByRole('button', { name: 'Ver como foi salvo, sem corrigir' }))

    expect(screen.getByText(/como foram salvos/i)).toBeTruthy()
    expect(screen.getByText(/A conta daquela época estava errada/i)).toBeTruthy()
    expect(screen.getByText('R$ 54.250')).toBeTruthy()
    // ver não é aplicar: continua sem nada entrar no app
    expect(onRestaurarStore).not.toHaveBeenCalled()

    // e dá para voltar e aplicar a correção de lá mesmo
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à revisão' }))
    expect(screen.getByText(/foi salva antes de uma correção do app/i)).toBeTruthy()
  })

  it('cancelar não aplica nada e diz isso', () => {
    const onRestaurarStore = montar(festaVenenosa())
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar — não restaurar nada' }))
    expect(onRestaurarStore).not.toHaveBeenCalled()
    expect(screen.getByText(/Nada foi restaurado/i)).toBeTruthy()
  })

  it('o instantâneo guardado NÃO é reescrito pela restauração — dá para restaurar de novo', () => {
    montar(festaVenenosa())
    const guardado = loadSnapshots().find((s) => s.rotulo === 'versão de teste')
    expect(guardado.store.eventos[0].cenariosConfig.pessimista.custoPct).toBe(-200)
  })
})

describe('restaurar um instantâneo SÃO — o risco aceito só é cobrado quando há o que explicar', () => {
  it('sem correção nenhuma, restaura direto: nenhuma tela no meio', () => {
    const onRestaurarStore = montar(festa())
    expect(onRestaurarStore).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/foi salva antes de uma correção do app/i)).toBeNull()
  })
})
