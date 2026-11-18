// @vitest-environment jsdom
//
// O FIO INTEIRO do bar no modo Simular (Marco, 05/08/2026), nas DUAS telas em
// que ele existe — o editor e a apresentação.
//
// O que este arquivo protege, e que nenhum teste de lib pega: o rascunho
// aprendeu a carregar o bar, mas quem GRAVA são dois handlers em dois arquivos
// diferentes (EventEditor.jsx e PresentationMode.jsx). Esquecer um deles daria
// suíte verde e mentira na tela: o slider respondendo na reunião e o "Aplicar"
// gravando só os cenários, com o bar voltando ao valor antigo.
//
// A outra metade é a promessa da tela: enquanto o card diz "rascunho — nada é
// salvo", o `update` real não pode ser chamado NENHUMA vez.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import EventEditor from './EventEditor.jsx'
import PresentationMode from './PresentationMode.jsx'
import { novoEvento } from '../lib/defaults.js'
import { subscribeToast } from '../lib/toast.js'
// snapshotSeguranca toca localStorage e tem teste próprio (protecao.test.js).
// Aqui o que se prova é o FIO: o snapshot passa, e o que interessa é o que
// chega ao update.
vi.mock('../lib/protecao.js', () => ({ snapshotSeguranca: () => ({ ok: true }) }))

afterEach(cleanup)

const eventoDeTeste = () => {
  const ev = novoEvento('Marfim de teste')
  ev.barModo = 'porPessoa'
  ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
  ev.outrasReceitas = { bar: '', patrocinio: 50000 }
  ev.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 200, quantidade: 1000 }]
  return ev
}

const sliderDeBar = (i = 0) => screen.getAllByLabelText('Bar por pessoa (R$)')[i]

// ————————————————————————————————————————————————————————————————
// EDITOR
// ————————————————————————————————————————————————————————————————

function montarEditor(evento) {
  const update = vi.fn()
  render(
    <EventEditor
      evento={evento}
      store={{ eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
      setStore={vi.fn()}
      aparencia={{}}
      update={update}
      onBack={vi.fn()}
      onApresentar={vi.fn()}
      onRelatorio={vi.fn()}
      onModoRascunho={vi.fn()}
      onFecharEvento={vi.fn()}
      onReabrirEvento={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Cenários & Resultado/i }))
  return { update }
}

const entrarNoModoSimular = () =>
  fireEvent.click(screen.getByRole('button', { name: /Simular sem salvar/i }))

describe('editor — mexer só no bar durante o Simular', () => {
  it('o rodapé conta a mudança do bar: "Aplicar 1 mudança ao evento"', () => {
    montarEditor(eventoDeTeste())
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    expect(screen.getByRole('button', { name: /Aplicar 1 mudança ao evento/i })).toBeTruthy()
  })

  it('o rodapé DIZ o que mudou, em reais e em português', () => {
    montarEditor(eventoDeTeste())
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    expect(screen.getByText(/Pessimista: bar por pessoa/)).toBeTruthy()
  })

  it('enquanto simula, o update REAL não é chamado nenhuma vez', () => {
    const { update } = montarEditor(eventoDeTeste())
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    fireEvent.change(sliderDeBar(1), { target: { value: '145' } })
    expect(update).not.toHaveBeenCalled()
  })

  it('DESCARTAR joga o rascunho fora sem gravar nada', () => {
    const { update } = montarEditor(eventoDeTeste())
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByText(/Simulando — nada está sendo salvo/)).toBeNull()
  })

  // A asserção sobre `outrasReceitas` prova a FRONTEIRA DO SLOT: o rascunho é
  // dono do `bar` e de mais nada, e as outras chaves do objeto vêm do evento.
  // (Não confundir com a feature de patrocínio: desde a Sessão O ela mora em
  // `evento.patrocinios`, e `outrasReceitas.patrocinio` é a chave legada que a
  // migração mantém vazia. A prova de fronteira que vale contra um escritor de
  // verdade é a do describe "evento FRESCO do store", mais abaixo.)
  it('APLICAR grava o bar do rascunho — e não encosta nas outras chaves de outrasReceitas', () => {
    const evento = eventoDeTeste()
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 1 mudança ao evento/i }))
    expect(update).toHaveBeenCalledTimes(1)
    const novo = update.mock.calls[0][0](evento)
    expect(novo.barTicket).toEqual({ pessimista: 130, realista: 110, otimista: 120 })
    expect(novo.outrasReceitas.patrocinio).toBe(50000)
  })

  it('bar E cenário juntos: as duas mudanças são contadas e as duas são gravadas', () => {
    const evento = eventoDeTeste()
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    fireEvent.change(screen.getAllByLabelText('Ingressos vendidos')[0], { target: { value: '55' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 2 mudanças ao evento/i }))
    const novo = update.mock.calls[0][0](evento)
    expect(novo.barTicket.pessimista).toBe(130)
    expect(novo.cenariosConfig.pessimista.vendaPct).toBe(55)
  })
})

// ————————————————————————————————————————————————————————————————
// O TOAST QUE SOBREVIVE AO FIM DA SIMULAÇÃO
//
// Regressão medida pela revisão adversarial em 05/08/2026, e a razão de o canal
// dos cenários despachar por referência em vez de por closure de render. O toast
// do botão "Usar R$ X de bar nos três" dura 6 segundos; aplicar a simulação leva
// um clique. Com o canal capturado no render, o "Desfazer" clicado depois do
// Aplicar chamava o roteador de rascunho num modo já encerrado: não desfazia
// nada E reabria o rascunho sozinho.
// ————————————————————————————————————————————————————————————————

describe('o Desfazer do toast continua desfazendo depois que a simulação acaba', () => {
  const eventoSemBarNoPessimista = () => {
    const ev = eventoDeTeste()
    ev.barTicket = { pessimista: '', realista: 110, otimista: '' }
    return ev
  }

  it('APLICAR e então Desfazer: cai no update REAL, não no rascunho encerrado', () => {
    const evento = eventoSemBarNoPessimista()
    let toast = null
    // o Aplicar dispara o SEU próprio toast (sem ação) logo depois; guardamos
    // só o que traz o "Desfazer", que é o botão em julgamento aqui
    const parar = subscribeToast((t) => { if (t.onAcao) toast = t })
    const { update } = montarEditor(evento)
    entrarNoModoSimular()

    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    expect(toast?.acaoLabel).toBe('Desfazer')
    // o clique foi para o rascunho — nada gravado ainda
    expect(update).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Aplicar \d+ mudança/i }))
    expect(update).toHaveBeenCalledTimes(1)
    // acabou a simulação
    expect(screen.queryByText(/Simulando — nada está sendo salvo/)).toBeNull()

    // agora o Desfazer do toast antigo: tem de GRAVAR o estado anterior
    act(() => toast.onAcao())
    parar()
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[1][0](evento).barTicket).toEqual({
      pessimista: '',
      realista: 110,
      otimista: '',
    })
    // e não pode reabrir o modo Simular sozinho
    expect(screen.queryByText(/Simulando — nada está sendo salvo/)).toBeNull()
  })

  // ————— A REGRESSÃO DO S1 (Marco, 05/08/2026, opção (a) do questionário) —————
  //
  // Até este conserto, o Desfazer clicado DEPOIS de "Descartar" caía no `update`
  // real e gravava o `antes`, que tinha sido lido da VISÃO — ou seja, gravava o
  // número que o descarte prometeu não gravar. Medido na Marfim Alto do The
  // State (1.582 pessoas no realista, bar por pessoa):
  //
  //     bar salvo R$ 110/pessoa  → receita de bar R$ 167.929,30
  //     bar descartado R$ 250    → receita de bar R$ 381.657,50
  //     diferença gravada em silêncio: R$ 213.728,20
  //
  // O teste que existia aqui contava chamadas e nunca rodava o updater, então
  // passava com o defeito dentro. Este roda.
  it('DESCARTAR e então Desfazer: NÃO grava nada — nem o número que só existiu no rascunho', () => {
    const evento = eventoSemBarNoPessimista()
    const toasts = []
    const parar = subscribeToast((t) => toasts.push(t))
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    // arrastar o realista para 250 SÓ no rascunho, e então copiar nos três:
    // é isso que faz o `antes` do botão carregar um valor que nunca foi salvo
    fireEvent.change(sliderDeBar(1), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    const desfazer = toasts.find((t) => t.onAcao)
    expect(desfazer?.acaoLabel).toBe('Desfazer')

    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }))
    expect(update).not.toHaveBeenCalled()

    act(() => desfazer.onAcao())
    parar()
    // O 250 descartado NÃO chega ao evento — nenhuma gravação acontece.
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByText(/Simulando — nada está sendo salvo/)).toBeNull()
    // E a tela diz por quê: botão inerte e mudo ensina a desconfiar do resto.
    expect(toasts.some((t) => /não havia nada salvo para desfazer/i.test(t.mensagem))).toBe(true)
  })

  // O espelho: a cópia aconteceu FORA da simulação (gravou de verdade), e o
  // Desfazer só é clicado depois de entrar no modo Simular. Aí o desfazer tem
  // de ir para o evento salvo, que é onde a cópia está — nunca para o rascunho,
  // que não foi quem a recebeu.
  it('copiar FORA da simulação e desfazer DENTRO dela: o desfazer vai para o evento', () => {
    const evento = eventoSemBarNoPessimista()
    let toast = null
    const parar = subscribeToast((t) => { if (t.onAcao) toast = t })
    const { update } = montarEditor(evento)
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    expect(update).toHaveBeenCalledTimes(1) // a cópia gravou de verdade

    entrarNoModoSimular()
    act(() => toast.onAcao())
    parar()
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[1][0](evento).barTicket).toEqual({
      pessimista: '',
      realista: 110,
      otimista: '',
    })
  })

  // Rascunho novo por cima: a hipótese a que a ação pertencia não existe mais,
  // e escrever num rascunho diferente seria mexer numa conta que não é aquela.
  it('DESCARTAR, entrar de novo, e então Desfazer: continua sem gravar nada', () => {
    const evento = eventoSemBarNoPessimista()
    const toasts = []
    const parar = subscribeToast((t) => toasts.push(t))
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    const desfazer = toasts.find((t) => t.onAcao)
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }))
    entrarNoModoSimular()

    act(() => desfazer.onAcao())
    parar()
    expect(update).not.toHaveBeenCalled()
    // e o rascunho NOVO segue intocado: o rodapé continua sem nada a aplicar
    const aplicar = screen.getByRole('button', { name: /Aplicar/i })
    expect(aplicar.textContent.trim()).toBe('Aplicar ao evento')
    expect(aplicar.disabled).toBe(true)
  })

  it('DENTRO da simulação, o Desfazer continua indo para o rascunho (nada é gravado)', () => {
    const evento = eventoSemBarNoPessimista()
    let toast = null
    // o Aplicar dispara o SEU próprio toast (sem ação) logo depois; guardamos
    // só o que traz o "Desfazer", que é o botão em julgamento aqui
    const parar = subscribeToast((t) => { if (t.onAcao) toast = t })
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    fireEvent.click(screen.getByRole('button', { name: /de bar nos três/i }))
    act(() => toast.onAcao())
    parar()
    expect(update).not.toHaveBeenCalled()
    // e o rodapé volta a dizer que não há o que aplicar
    const aplicar = screen.getByRole('button', { name: /Aplicar/i })
    expect(aplicar.textContent.trim()).toBe('Aplicar ao evento')
    expect(aplicar.disabled).toBe(true)
  })
})

// ————————————————————————————————————————————————————————————————
// APRESENTAÇÃO — nasce simulando e nunca sai
// ————————————————————————————————————————————————————————————————

function montarApresentacao(evento) {
  const update = vi.fn()
  render(
    <PresentationMode
      evento={evento}
      store={{ eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
      update={update}
      aparencia={{}}
      onClose={vi.fn()}
    />
  )
  return { update }
}

describe('apresentação — o mesmo bar, na tela da reunião', () => {
  it('mexer no bar habilita o Aplicar e a contagem aparece', () => {
    montarApresentacao(eventoDeTeste())
    fireEvent.change(sliderDeBar(2), { target: { value: '150' } })
    expect(screen.getByRole('button', { name: /Aplicar 1 mudança/i })).toBeTruthy()
  })

  it('APLICAR na reunião grava o bar — não só os cenários', () => {
    const evento = eventoDeTeste()
    const { update } = montarApresentacao(evento)
    fireEvent.change(sliderDeBar(2), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 1 mudança/i }))
    expect(update).toHaveBeenCalledTimes(1)
    const novo = update.mock.calls[0][0](evento)
    expect(novo.barTicket).toEqual({ pessimista: 100, realista: 110, otimista: 150 })
    expect(novo.outrasReceitas.patrocinio).toBe(50000)
  })

  it('antes de aplicar, nada é gravado', () => {
    const { update } = montarApresentacao(eventoDeTeste())
    fireEvent.change(sliderDeBar(0), { target: { value: '135' } })
    fireEvent.change(sliderDeBar(1), { target: { value: '145' } })
    expect(update).not.toHaveBeenCalled()
  })
})

// ————————————————————————————————————————————————————————————————
// O UPDATER TEM DE SER FUNCIONAL NAS DUAS TELAS
//
// Achado por DUAS revisões independentes em 05/08/2026, e o motivo de os testes
// acima não o pegarem: eles rodavam o updater com o MESMO evento que o
// componente já tinha, então uma foto do closure e uma leitura do store dão o
// mesmo resultado. A asserção que morde roda o updater com um evento DIFERENTE
// — que é o que o store entrega quando alguma coisa foi salva entre o último
// render e o clique.
// ————————————————————————————————————————————————————————————————

describe('aplicar roda sobre o evento FRESCO do store, não sobre a foto do render', () => {
  // o que o store entregaria: mesmo evento, com uma mudança salva por fora
  const eventoMaisNovo = (base) => ({
    ...base,
    nome: 'renomeado enquanto a tela estava aberta',
    publicoEstimado: 777,
    outrasReceitas: { ...base.outrasReceitas, patrocinio: 25000 },
  })

  it('EDITOR: a mudança salva por fora sobrevive ao Aplicar', () => {
    const evento = eventoDeTeste()
    const { update } = montarEditor(evento)
    entrarNoModoSimular()
    fireEvent.change(sliderDeBar(0), { target: { value: '130' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 1 mudança/i }))
    const novo = update.mock.calls[0][0](eventoMaisNovo(evento))
    expect(novo.barTicket.pessimista).toBe(130) // o rascunho entrou
    expect(novo.nome).toBe('renomeado enquanto a tela estava aberta') // e o resto sobreviveu
    expect(novo.publicoEstimado).toBe(777)
    expect(novo.outrasReceitas.patrocinio).toBe(25000)
  })

  it('APRESENTAÇÃO: idem — as duas telas passam pela MESMA função e pelo mesmo envelope', () => {
    const evento = eventoDeTeste()
    const { update } = montarApresentacao(evento)
    fireEvent.change(sliderDeBar(2), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 1 mudança/i }))
    const novo = update.mock.calls[0][0](eventoMaisNovo(evento))
    expect(novo.barTicket.otimista).toBe(150)
    expect(novo.nome).toBe('renomeado enquanto a tela estava aberta')
    expect(novo.publicoEstimado).toBe(777)
    expect(novo.outrasReceitas.patrocinio).toBe(25000)
  })
})
