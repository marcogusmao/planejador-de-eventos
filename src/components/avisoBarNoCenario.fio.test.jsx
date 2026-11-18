// @vitest-environment jsdom
//
// O FIO da decisão do Marco de 27/07/2026, na TELA: o cartão do cenário DIZ que
// o bar não foi informado, em vez de mostrar um total que parece completo.
//
// POR QUE ESTE ARQUIVO EXISTE ALÉM DO TESTE DO MÓDULO. A regra ("este cenário
// vai contar R$ 0 de bar sem ninguém ter dito?") mora em src/lib/avisoBar.js e
// tem teste próprio. Mas o defeito que ela conserta é de TELA, e medido hoje
// mesmo neste trabalho: eu liguei o aviso ao cartão, rodei a suíte inteira —
// 109 arquivos, 2.245 verificações, tudo verde — e o aviso NÃO aparecia, porque
// a prop `evento` não estava sendo passada ao componente. Verde não provou nada.
// Este arquivo é o que teria pegado.
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import { subscribeToast } from '../lib/toast.js'

afterEach(cleanup)

// O evento REAL do Marco, reduzido: bar POR PESSOA com ticket só no realista.
// Foi esta forma que fez o pessimista dizer "prejuízo" para uma festa que fecha.
const eventoDoMarco = (extra = {}) => ({
  id: 'ev-1',
  nome: 'Marfim Alto Casa Norte (nova edição)',
  data: '2026-09-26',
  publicoEstimado: 1758,
  barModo: 'porPessoa',
  openBar: false,
  barTicket: { pessimista: '', realista: 110, otimista: '' },
  barTaxaSistemaPct: 3.5,
  lotes: [{ id: 'l1', nome: 'Lote 1', valor: 200, quantidade: 1000 }],
  categorias: [{ id: 'aeb', nome: 'A&B', padrao: true, itens: [] }],
  outrasReceitas: {},
  patrocinios: [],
  ...extra,
})

const abrir = (evento) =>
  render(
    <ScenariosTab
      evento={evento}
      update={() => {}}
      updateCenarios={() => {}}
      store={{ eventos: [evento], benchmarksCustom: [], ajustes: {} }}
      setStore={() => {}}
    />
  )

describe('o fio na tela: o cartão avisa quando o bar não foi informado', () => {
  it('aparece nos DOIS cenários sem ticket de bar, e não no que tem', () => {
    abrir(eventoDoMarco())
    const avisos = screen.getAllByText(/bar não informado neste cenário/i)
    // pessimista e otimista — o realista tem R$ 110 e não avisa
    expect(avisos).toHaveLength(2)
  })

  it('o aviso diz o valor do outro cenário, para o número não virar mistério', () => {
    abrir(eventoDoMarco())
    expect(screen.getAllByText(/110,00 por pessoa/i).length).toBeGreaterThan(0)
  })

  it('com os três preenchidos a tela não avisa nada', () => {
    abrir(eventoDoMarco({ barTicket: { pessimista: 100, realista: 110, otimista: 120 } }))
    expect(screen.queryByText(/bar não informado neste cenário/i)).toBeNull()
  })

  it('bar FIXO não avisa — lá o valor é um só para os três', () => {
    abrir(eventoDoMarco({ barModo: 'fixo', outrasReceitas: { bar: 180000 } }))
    expect(screen.queryByText(/bar não informado neste cenário/i)).toBeNull()
  })

  it('o botão de copiar aparece com o valor certo e some quando não há o que copiar', () => {
    // A metade cômoda da decisão. Sem este teste o botão não teria rede: a
    // suíte inteira ficava verde sem ele na tela (medido em 27/07/2026).
    abrir(eventoDoMarco())
    const b = screen.getByRole('button', { name: /de bar nos três/i })
    expect(b.textContent).toContain('110')

    cleanup()
    // com os três preenchidos não falta nada, então não há botão
    abrir(eventoDoMarco({ barTicket: { pessimista: 100, realista: 110, otimista: 120 } }))
    expect(screen.queryByRole('button', { name: /de bar nos três/i })).toBeNull()

    cleanup()
    // sem NENHUM preenchido não há valor para copiar — a tela só avisa
    abrir(eventoDoMarco({ barTicket: { pessimista: '', realista: '', otimista: '' } }))
    expect(screen.queryByRole('button', { name: /de bar nos três/i })).toBeNull()
    expect(screen.getAllByText(/bar não informado neste cenário/i).length).toBe(3)
  })

  it('clicar copia o valor para os TRÊS e oferece Desfazer', () => {
    let gravado = null
    const evento = eventoDoMarco()
    render(
      <ScenariosTab
        evento={evento}
        update={() => {}}
        updateCenarios={(fn) => { gravado = typeof fn === 'function' ? fn(evento) : fn }}
        store={{ eventos: [evento], benchmarksCustom: [], ajustes: {} }}
        setStore={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    expect(gravado.barTicket).toEqual({ pessimista: 110, realista: 110, otimista: 110 })
    // e o original não foi mutado
    expect(evento.barTicket).toEqual({ pessimista: '', realista: 110, otimista: '' })
  })

  // ————— Marco, 05/08/2026 —————
  // Com o slider de bar na grade, este botão passou a mexer no MESMO campo que
  // o rascunho da simulação carrega. Se ele continuasse no `update` real, um
  // clique durante o modo Simular gravaria no evento enquanto a tela diz "nada
  // está sendo salvo" — a mentira que o rascunho existe para impedir, entrando
  // pela porta de trás.
  it('o botão escreve pelo CANAL ROTEADO, nunca pelo update real', () => {
    const evento = eventoDoMarco()
    const chamadasUpdate = []
    const chamadasCenarios = []
    render(
      <ScenariosTab
        evento={evento}
        update={(fn) => chamadasUpdate.push(fn)}
        updateCenarios={(fn) => chamadasCenarios.push(fn)}
        store={{ eventos: [evento], benchmarksCustom: [], ajustes: {} }}
        setStore={() => {}}
        simulando
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    expect(chamadasCenarios.length).toBe(1)
    expect(chamadasUpdate.length).toBe(0)
    expect(chamadasCenarios[0](evento).barTicket).toEqual({
      pessimista: 110,
      realista: 110,
      otimista: 110,
    })
  })

  // Marco, 05/08/2026 (opção (a) do questionário): o desfazer NÃO escolhe o
  // canal pelo estado da tela — ele apresenta o carimbo da ação e o editor
  // decide. Quem monta a aba fora do editor não tem rascunho, e aí o desfazer
  // é o `update` de sempre (a asserção do último caso).
  it('o Desfazer do toast passa pelo desfazer ROTEADO, levando o carimbo da ação', () => {
    const evento = eventoDoMarco()
    const chamadasUpdate = []
    const chamadasCenarios = []
    const desfeitos = []
    // Escuta o toast pelo pub/sub real (toast.js) — é assim que o ToastHost o
    // recebe no app, então a ação capturada aqui é literalmente a que o Marco
    // clica na tela.
    let toast = null
    const parar = subscribeToast((t) => { if (t.onAcao) toast = t })
    render(
      <ScenariosTab
        evento={evento}
        update={(fn) => chamadasUpdate.push(fn)}
        updateCenarios={(fn) => {
          chamadasCenarios.push(fn)
          return { alvo: 'rascunho', geracao: 7 }
        }}
        desfazerCenarios={(marca, fn) => {
          desfeitos.push({ marca, fn })
          return 'rascunho'
        }}
        store={{ eventos: [evento], benchmarksCustom: [], ajustes: {} }}
        setStore={() => {}}
        simulando
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    expect(toast?.acaoLabel).toBe('Desfazer')

    toast.onAcao()
    parar()
    expect(chamadasUpdate.length).toBe(0)
    expect(chamadasCenarios.length).toBe(1) // só a cópia; o desfazer tem porta própria
    expect(desfeitos.length).toBe(1)
    // o carimbo devolvido pela AÇÃO é o mesmo que o desfazer apresenta
    expect(desfeitos[0].marca).toEqual({ alvo: 'rascunho', geracao: 7 })
    // e o desfazer devolve EXATAMENTE o que havia, inclusive o cenário que já
    // estava preenchido
    expect(desfeitos[0].fn(evento).barTicket).toEqual({
      pessimista: '',
      realista: 110,
      otimista: '',
    })
  })

  it('sem rascunho nenhum (aba montada fora do editor), o desfazer é o update de sempre', () => {
    const evento = eventoDoMarco()
    const chamadasUpdate = []
    let toast = null
    const parar = subscribeToast((t) => { if (t.onAcao) toast = t })
    render(
      <ScenariosTab
        evento={evento}
        update={(fn) => chamadasUpdate.push(fn)}
        store={{ eventos: [evento], benchmarksCustom: [], ajustes: {} }}
        setStore={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    toast.onAcao()
    parar()
    expect(chamadasUpdate.length).toBe(2) // copiar + desfazer, os dois no update
    expect(chamadasUpdate[1](evento).barTicket).toEqual({
      pessimista: '',
      realista: 110,
      otimista: '',
    })
  })

  it('OPEN BAR não avisa — o R$ 0 ali é a resposta certa e declarada', () => {
    abrir(eventoDoMarco({ openBar: true }))
    expect(screen.queryByText(/bar não informado neste cenário/i)).toBeNull()
  })
})
