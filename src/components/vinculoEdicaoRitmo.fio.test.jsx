// @vitest-environment jsdom
//
// O VÍNCULO "Edição desta festa" — o fio inteiro, do clique até o evento salvo.
//
// ACHADO S2 de 30/08/2026 — e são DOIS defeitos na mesma linha, cada um
// bastando sozinho para o vínculo nunca salvar:
//
//  1. O ARGUMENTO DO onChange ERA LIDO COMO VALOR. `Select` (ui.jsx) é um
//     `<select>` nativo com `{...props}`: o React entrega o EVENTO. As outras
//     13 chamadas de `<Select>` do app leem `e.target.value`; só esta lia o
//     argumento direto. `String(evento)` dá "[object Object]", o `find` devolve
//     `undefined`, e o `if (ed)` engole o clique CALADO — sem erro, sem aviso.
//     Este foi achado escrevendo este teste: com o defeito 2 já consertado, o
//     `update` continuava sendo chamado ZERO vezes.
//
//  2. `update` RECEBIA OBJETO ONDE ESPERA FUNÇÃO. `update` é o
//     `atualizarEvento` do App.jsx e faz `fn(e)` sobre o evento fresco do
//     store. Todas as outras ~20 chamadas do mesmo arquivo passam arrow
//     function; esta, não. Medido sobre a composição exata:
//
//        como as outras fazem (função): {"id":"ev1","ritmoTiqueteira":{...}}
//        como esta fazia   (objeto)   : TypeError: fn is not a function
//
// O vínculo "Edição desta festa" nunca funcionou desde que foi escrito — e não
// havia teste de tela para dizer isso, porque o componente não era montável de
// fora.
//
// O QUE ESTE TESTE NÃO PROVA, e é preciso dizer: a ponte de verdade com o
// Financeiro (http://localhost:8777) não roda num workspace — o Financeiro só
// libera CORS para http://localhost:4173. O `fetch` aqui é um dublê da REDE, e
// só dela: `buscarCurvaEdicoes`, `salvarEdicaoRitmo` e o `update` são os reais.
// A prova ao vivo com o Financeiro no ar é tarefa da máquina do Marco.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { RitmoTiqueteira } from './RevenueTab.jsx'
import { salvarEdicaoRitmo } from '../lib/financeiro.js'
import { novoEvento } from '../lib/defaults.js'
import { Select } from './ui.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const EDICOES = [
  {
    evento_id: 77,
    nome: 'Brisa #3',
    data: '2026-08-22',
    empresa: 'Marfim Alto',
    dias: [{ dia: -10, pagamentos: 12, valor: 1200 }],
    total_pagamentos: 84,
    total_valor: 8400,
  },
  {
    evento_id: 78,
    nome: 'Sobrado #1',
    data: '2026-09-05',
    empresa: 'Marfim Alto',
    dias: [],
    total_pagamentos: 3,
    total_valor: 300,
  },
]

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ edicoes: EDICOES }) }))
  )
})

const eventoBase = () => ({ ...novoEvento('Brisa'), id: 'ev1', data: '2026-08-22' })

async function montarComEdicoesCarregadas(update) {
  render(<RitmoTiqueteira evento={eventoBase()} update={update} />)
  fireEvent.click(screen.getByText('Buscar ritmo no Financeiro'))
  await waitFor(() => expect(screen.getByText('Edição desta festa:')).toBeTruthy())
  return screen.getByRole('combobox')
}

describe('vínculo "Edição desta festa": o clique GRAVA em vez de estourar', () => {
  it('escolher a edição chama update com uma FUNÇÃO, e ela devolve o evento vinculado', async () => {
    const recebido = []
    const update = vi.fn((arg) => recebido.push(arg))
    const select = await montarComEdicoesCarregadas(update)

    fireEvent.change(select, { target: { value: '77' } })

    expect(update).toHaveBeenCalledTimes(1)
    // A asserção que o defeito violava, dita pelo nome: `update` faz `fn(e)`.
    expect(typeof recebido[0]).toBe('function')
    // E a função devolve o que salvarEdicaoRitmo promete, sobre o evento FRESCO
    // que o store entregar — não sobre a foto que o render tinha em mãos.
    const eventoDoStore = { ...eventoBase(), nome: 'Brisa (renomeada por fora)' }
    const salvo = recebido[0](eventoDoStore)
    expect(salvo.ritmoTiqueteira).toEqual({ edicaoId: 77, edicaoNome: 'Brisa #3' })
    expect(salvo.nome).toBe('Brisa (renomeada por fora)')
  })

  it('rodando o update DE VERDADE (fn(e)), como o App.jsx faz, nada estoura', async () => {
    // Este é o repro do achado: o `update` daqui é a mesma forma do App.jsx.
    // Com o objeto, esta linha lançava "fn is not a function".
    let evento = eventoBase()
    const update = (fn) => {
      evento = fn(evento)
    }
    const select = await montarComEdicoesCarregadas(update)

    expect(() => fireEvent.change(select, { target: { value: '78' } })).not.toThrow()
    expect(evento.ritmoTiqueteira).toEqual({ edicaoId: 78, edicaoNome: 'Sobrado #1' })
  })

  it('defeito 2, isolado: a forma ANTIGA da chamada quebra o mesmo update', () => {
    const update = (fn) => fn(eventoBase())
    const ed = EDICOES[0]
    // como o arquivo fazia até 30/08/2026: objeto onde se espera função
    expect(() => update(salvarEdicaoRitmo(eventoBase(), ed))).toThrow(TypeError)
    // como ele faz agora
    expect(() => update((ev) => salvarEdicaoRitmo(ev, ed))).not.toThrow()
  })

  it('defeito 1, isolado: o argumento do onChange é o EVENTO, não o valor', () => {
    // A premissa que a linha antiga violava, afirmada aqui em vez de suposta:
    // `Select` repassa props a um `<select>` nativo, e o React chama onChange
    // com o evento. Ler o argumento como valor procura a edição de id
    // "[object Object]" e não acha nenhuma — clique engolido, em silêncio.
    // O que o handler VÊ é lido DENTRO dele: o campo é controlado (`value=""`
    // e nenhum estado muda), então depois do handler o React devolve o
    // `<select>` ao valor da prop e um `recebido.target.value` lido de fora
    // diria "" — o que provaria outra coisa.
    let tipo
    let comoValorDireto
    let comoOsOutrosLeem
    render(
      <Select
        value=""
        onChange={(arg) => {
          tipo = typeof arg
          comoValorDireto = String(arg)
          comoOsOutrosLeem = arg.target.value
        }}
        options={[{ value: '', label: '—' }, { value: '77', label: 'Brisa #3' }]}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '77' } })
    expect(tipo).toBe('object')
    // como as outras 13 chamadas do app leem — e é o valor de verdade
    expect(comoOsOutrosLeem).toBe('77')
    // como esta linha lia até 30/08/2026 — e é por isso que o clique sumia
    expect(comoValorDireto).not.toBe('77')
    expect(comoValorDireto).toMatch(/^\[object/)
    expect(EDICOES.find((e) => String(e.evento_id) === comoValorDireto)).toBeUndefined()
  })

  it('escolher a opção vazia não grava nada (não existe edição de id "")', async () => {
    const update = vi.fn()
    const select = await montarComEdicoesCarregadas(update)
    fireEvent.change(select, { target: { value: '' } })
    expect(update).not.toHaveBeenCalled()
  })
})
