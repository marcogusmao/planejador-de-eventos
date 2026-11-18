// @vitest-environment jsdom
//
// A data escolhida no calendário próprio chega no DADO SALVO — e sobrevive.
//
// POR QUE ESTE ARQUIVO EXISTE. Medido antes de escrever uma linha do
// calendário: a suíte inteira NÃO tem um teste sequer que toque campo de data.
//
//     grep 'type="date"' em testes ...................... 0 ocorrências
//     grep toHaveValue(.*20[0-9][0-9]-) em src .......... 0
//     fireEvent.change em campo de data ................. 0
//
// Ou seja: 2.639 verificações ficariam VERDES com o calendário completamente
// desligado. Este arquivo é a única coisa que prova a entrega — e ele afirma
// sobre o OBJETO que o store receberia, nunca sobre o input.
//
// E uma medição desta sessão que aumenta o peso de tudo isto: a migração NÃO
// saneia `evento.data` — `formaDataISO` só é aplicada à data das PARCELAS. Um
// '12/08/2026', um '2026-02-31' e até 'lixo' atravessam o carregamento
// INTACTOS. O calendário é a única guarda desta data: o que ele emitir é o que
// fica no disco.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import EventEditor from './EventEditor.jsx'
import Home from './Home.jsx'
import ParcelasModal from './ParcelasModal.jsx'
import DossieCustoModal from './DossieCustoModal.jsx'
import CostsTab from './CostsTab.jsx'
import RevenueTab from './RevenueTab.jsx'
import CurvaVendas from './CurvaVendas.jsx'
import { novoEvento } from '../lib/defaults.js'
import { migrarEvento } from '../lib/migracao.js'
import { montarPagamentos } from '../lib/exportPagamentos.js'
import { computeCenario } from '../lib/calc.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const fixarRelogioLocal = (ano, mes, dia, hora = 12) => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(ano, mes - 1, dia, hora, 0, 0, 0))
}

const abrirCalendario = (nome) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Abrir calendário — ${nome}`) }))
const painel = () => screen.getByRole('dialog', { name: 'Calendário' })
const dia = (texto) => screen.getByRole('gridcell', { name: texto })

// ————————————————————————————————————————————————————————————————
// EDITOR — a data da festa
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
  return { update }
}

const eventoComData = (data = '2026-08-05') => ({ ...novoEvento('Marfim de teste'), data })

describe('editor — a data da festa chega no evento', () => {
  it('escolher no calendário grava o ISO no objeto que o store receberia', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = eventoComData()
    const { update } = montarEditor(evento)
    fireEvent.click(screen.getByLabelText('Data').nextSibling) // o botão do calendário
    fireEvent.click(dia('12/08/2026'))
    expect(update).toHaveBeenCalled()
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(novo.data).toBe('2026-08-12')
  })

  it('VOLTAR UM ANO e escolher — o atrito que ele reclamou, chegando no dado', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = eventoComData()
    const { update } = montarEditor(evento)
    fireEvent.click(screen.getByLabelText('Data').nextSibling)
    fireEvent.click(screen.getByRole('button', { name: 'Ano anterior' }))
    fireEvent.click(dia('12/08/2025'))
    expect(update.mock.calls.at(-1)[0](evento).data).toBe('2025-08-12')
  })

  it('digitar 05/08/2026 grava ISO, não o texto brasileiro', () => {
    const evento = eventoComData('')
    const { update } = montarEditor(evento)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '05/08/2026' } })
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(novo.data).toBe('2026-08-05')
    expect(novo.data).not.toContain('/')
  })

  it('DATA IMPOSSÍVEL não chega ao store — a rede que o widget do navegador dava', () => {
    const evento = eventoComData('2026-08-05')
    const { update } = montarEditor(evento)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '31/02/2026' } })
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('Fevereiro de 2026 não tem 31 dias')).toBeTruthy()
  })

  // MEDIDO nesta sessão, e é mais grave do que se supunha ao planejar: a
  // migração NÃO saneia `evento.data`. `formaDataISO` só é aplicada à data das
  // PARCELAS (migracao.js:370). Qualquer string sobrevive ao carregamento:
  //     migrarEvento({data:'12/08/2026'}).data => '12/08/2026'
  //     migrarEvento({data:'2026-02-31'}).data => '2026-02-31'
  //     migrarEvento({data:'lixo'}).data       => 'lixo'
  // Ou seja: o calendário é a ÚNICA guarda desta data. O que ele emite é o que
  // fica no disco para sempre — daí a asserção abaixo ser sobre o ISO exato.
  it('a data escolhida atravessa a migração INALTERADA — e nada mais a saneia', () => {
    // Congelar o relógio ANTES de montar: a data do evento é VAZIA, então o
    // calendário abre no mês de hoje. Sem isto, o teste passa em agosto e
    // quebra em 1º de setembro — foi o que aconteceu, e foi assim que a esteira
    // voltou vermelha no primeiro dia em que voltou a rodar.
    fixarRelogioLocal(2026, 8, 5)
    const evento = eventoComData('')
    const { update } = montarEditor(evento)
    fireEvent.click(screen.getByLabelText('Data').nextSibling)
    fireEvent.click(dia('12/08/2026'))
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(migrarEvento(novo).data).toBe('2026-08-12')
    // e a prova de que não há rede embaixo: texto brasileiro NÃO é apagado,
    // ele PERSISTE — por isso o componente não pode deixá-lo sair
    expect(migrarEvento({ ...novo, data: '12/08/2026' }).data).toBe('12/08/2026')
  })

  // ————— Marco, 07/08/2026: o S3 do evento fechado —————
  // O caso abaixo afirmava só que o <fieldset> ancestral TEM o atributo — prova
  // MARCAÇÃO, não inércia. Medido depois: o campo e o botão casam `:disabled`,
  // então o navegador fecha o caminho de mouse e o de teclado. O que ficava
  // aberto era outra coisa: o painel vive em `document.body`, FORA do fieldset,
  // e a célula do dia nunca esteve dentro dele — um painel que sobreviva ao
  // instante em que o evento é fechado ainda gravaria. Agora `CampoData` lê o
  // `:disabled` efetivo no momento da ação. (No jsdom o `fireEvent` dispara em
  // elemento inerte, o que aqui é conveniente: dá para pôr o painel exatamente
  // nesse estado e afirmar que escolher um dia não grava nada.)
  const fechadoComData = () => ({
    ...eventoComData(),
    status: 'fechado',
    fechamento: { em: '2026-08-06T21:00:00.000Z', foto: { resultado: { resultado: 1 } } },
  })

  it('evento FECHADO: o campo é inerte de verdade, não só marcado', () => {
    montarEditor(fechadoComData())
    const campo = screen.getByLabelText('Data')
    expect(campo.closest('fieldset')?.hasAttribute('disabled')).toBe(true)
    // o que o NAVEGADOR usa para decidir inércia (o `.disabled` do IDL só
    // reflete o atributo próprio, então não mede herança de fieldset)
    expect(campo.matches(':disabled')).toBe(true)
    expect(campo.parentElement.querySelector('button').matches(':disabled')).toBe(true)
  })

  it('evento FECHADO: com o painel aberto, escolher um dia NÃO grava — a célula mora no body', () => {
    const { update } = montarEditor(fechadoComData())
    const campo = screen.getByLabelText('Data')
    fireEvent.click(campo.parentElement.querySelector('button'))
    const painelAberto = screen.queryByRole('dialog', { name: 'Calendário' })
    if (painelAberto) {
      fireEvent.click(screen.getAllByRole('gridcell')[15])
    }
    expect(update).not.toHaveBeenCalled()
  })

  it('evento FECHADO: digitar no campo também não grava', () => {
    const { update } = montarEditor(fechadoComData())
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '12/08/2026' } })
    expect(update).not.toHaveBeenCalled()
  })
})

// ————————————————————————————————————————————————————————————————
// HOME — a data no passo de criar a previsão
// ————————————————————————————————————————————————————————————————

function montarHome() {
  fixarRelogioLocal(2026, 8, 5)
  const setStore = vi.fn()
  render(
    <Home
      store={{ eventos: [], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
      setStore={setStore}
      aparencia={{}}
      abrir={vi.fn()}
      abrirAjustes={vi.fn()}
    />
  )
  fireEvent.click(screen.getAllByRole('button', { name: /Novo evento/i })[0])
  return { setStore }
}

// o passo 1 do modal pede a festa; o botão "Sem categoria" leva ao passo 2
const irAoPassoDaData = () => {
  const semCategoria = screen.queryByRole('button', { name: /Sem categoria/i })
  if (semCategoria) fireEvent.click(semCategoria)
}

const eventoCriado = (setStore) => {
  const fn = setStore.mock.calls.at(-1)[0]
  return fn({ eventos: [] }).eventos.at(-1)
}

describe('home — a data no passo de criar a previsão', () => {
  it('escolher no calendário e criar: o evento nasce com o ISO escolhido', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { setStore } = montarHome()
    irAoPassoDaData()
    abrirCalendario('Data da festa \\(opcional\\)')
    fireEvent.click(dia('12/08/2026'))
    fireEvent.click(screen.getByRole('button', { name: /^Criar/ }))
    expect(eventoCriado(setStore).data).toBe('2026-08-12')
  })

  it('ENTER com o calendário ABERTO escolhe o dia e NÃO cria a previsão', () => {
    const { setStore } = montarHome()
    irAoPassoDaData()
    abrirCalendario('Data da festa \\(opcional\\)')
    fireEvent.keyDown(painel(), { key: 'ArrowRight' })
    fireEvent.keyDown(painel(), { key: 'Enter' })
    expect(setStore).not.toHaveBeenCalled() // nada criado
    // e com o painel fechado, o Enter no campo volta a criar
    fireEvent.keyDown(screen.getByLabelText('Data da festa (opcional)'), { key: 'Enter' })
    expect(setStore).toHaveBeenCalledTimes(1)
  })

  // A CONSEQUÊNCIA do achado da revisão, medida onde ela dói: a previsão nasce
  // e o modal fecha. Enquanto o Enter não checava o rascunho, a tela mostrava
  // "12/08/202" (o Marco editando 2026 para 2027), sem aviso nenhum, e o evento
  // nascia com 2026-08-12 — uma festa datada um ano antes da que ele digitava.
  it('ENTER no meio da edição do ano NÃO cria a previsão com a data antiga', () => {
    const { setStore } = montarHome()
    irAoPassoDaData()
    const campo = screen.getByLabelText('Data da festa (opcional)')
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: '12/08/2026' } })
    fireEvent.change(campo, { target: { value: '12/08/202' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(setStore).not.toHaveBeenCalled()
    expect(screen.getByText('Data incompleta — use dd/mm/aaaa (ex.: 05/08/2026)')).toBeTruthy()
    // e terminando de digitar, o Enter volta a criar — com a data certa
    fireEvent.change(campo, { target: { value: '12/08/2027' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(eventoCriado(setStore).data).toBe('2027-08-12')
  })

  it('sem data escolhida, o evento nasce sem data — vazio nunca vira hoje', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { setStore } = montarHome()
    irAoPassoDaData()
    fireEvent.click(screen.getByRole('button', { name: /^Criar/ }))
    expect(eventoCriado(setStore).data).toBe('')
  })
})

// ————————————————————————————————————————————————————————————————
// ONDA 2 — a data de pagamento do custo, no dossiê
// ————————————————————————————————————————————————————————————————

describe('dossiê do custo — a data de pagamento chega no item', () => {
  it('escolher no calendário grava dataPagamento em ISO', () => {
    fixarRelogioLocal(2026, 8, 5)
    const onChange = vi.fn()
    const item = { id: 'c1', servico: 'Cenografia', estimado: 1000, dataPagamento: '' }
    render(<DossieCustoModal item={item} onChange={onChange} onClose={vi.fn()} evento={novoEvento('F')} />)
    abrirCalendario('Data de pagamento de Cenografia')
    fireEvent.click(dia('12/08/2026'))
    expect(onChange).toHaveBeenCalledWith({ dataPagamento: '2026-08-12' })
  })

  it('data impossível digitada não chega ao item', () => {
    fixarRelogioLocal(2026, 8, 5)
    const onChange = vi.fn()
    const item = { id: 'c1', servico: 'Cenografia', estimado: 1000, dataPagamento: '2026-08-05' }
    render(<DossieCustoModal item={item} onChange={onChange} onClose={vi.fn()} evento={novoEvento('F')} />)
    fireEvent.change(screen.getByLabelText('Data de pagamento de Cenografia'), {
      target: { value: '31/02/2026' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ————————————————————————————————————————————————————————————————
// ONDA 3 — as parcelas: a data que a PONTE com o Financeiro ordena e exporta
// ————————————————————————————————————————————————————————————————

describe('parcelas — a data escolhida sai na ordem certa para o Financeiro', () => {
  const itemParcelado = () => ({
    id: 'c1',
    servico: 'Cenografia',
    estimado: 3000,
    parcelas: [
      { id: 'p1', valor: 1000, data: '2026-09-20', paga: false },
      { id: 'p2', valor: 1000, data: '', paga: false },
      { id: 'p3', valor: 1000, data: '2026-07-10', paga: false },
    ],
  })

  it('escolher a data da parcela 2 grava ISO — e o arquivo do contador sai ORDENADO', () => {
    fixarRelogioLocal(2026, 8, 5)
    let itemAtual = itemParcelado()
    const onChange = vi.fn((patch) => {
      itemAtual = { ...itemAtual, ...patch }
    })
    render(<ParcelasModal item={itemAtual} onChange={onChange} onClose={vi.fn()} />)
    abrirCalendario('Data da parcela 2')
    fireEvent.click(dia('12/08/2026'))
    expect(onChange).toHaveBeenCalled()
    expect(itemAtual.parcelas[1].data).toBe('2026-08-12')

    // a ponte lê essa data e ORDENA por ela (exportPagamentos.js) — se o
    // componente emitisse texto brasileiro, a ordem do arquivo do contador
    // sairia errada em silêncio
    const evento = { ...novoEvento('Marfim'), categorias: [{ id: 'a', nome: 'A&B', itens: [itemAtual] }] }
    const { pagamentos } = montarPagamentos(evento)
    const datas = pagamentos.map((p) => p.data).filter(Boolean)
    expect(datas).toEqual([...datas].sort())
    expect(datas).toContain('2026-08-12')
  })
})

// ————————————————————————————————————————————————————————————————
// ONDA 4 — as QUATRO portas que ficaram sem fio (Marco, 07/08/2026)
//
// A parede que proíbe `type="date"` cobre a FORMA das oito portas, e o
// componente tem casos próprios — o que faltava era o fio de cada uma até o
// dado salvo. Baixo risco (as quatro seguem o padrão das provadas), mas é
// exatamente o buraco que esta casa mediu quatro vezes em dois dias: a suíte
// fica verde com a porta desligada. Cada caso abaixo afirma sobre o OBJETO que
// o store receberia, nunca sobre o input.
// ————————————————————————————————————————————————————————————————

describe('as quatro portas que faltavam: da tela até o objeto salvo', () => {
  const eventoComCusto = () => ({
    ...novoEvento('Marfim de teste'),
    categorias: [
      {
        id: 'cat1',
        nome: 'Produção',
        itens: [{ id: 'c1', servico: 'Cenografia', estimado: 3000, dataPagamento: '' }],
      },
    ],
  })

  it('CUSTOS — a data de pagamento na tabela grava ISO no item', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = eventoComCusto()
    const update = vi.fn()
    render(<CostsTab evento={evento} update={update} store={{ eventos: [evento], benchmarksCustom: [] }} />)
    abrirCalendario('Data de pagamento de Cenografia')
    fireEvent.click(dia('12/08/2026'))
    expect(update).toHaveBeenCalled()
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(novo.categorias[0].itens[0].dataPagamento).toBe('2026-08-12')
  })

  it('CUSTOS — data impossível digitada na tabela não chega ao item', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = eventoComCusto()
    evento.categorias[0].itens[0].dataPagamento = '2026-08-05'
    const update = vi.fn()
    render(<CostsTab evento={evento} update={update} store={{ eventos: [evento], benchmarksCustom: [] }} />)
    fireEvent.change(screen.getByLabelText('Data de pagamento de Cenografia'), {
      target: { value: '31/02/2026' },
    })
    expect(update).not.toHaveBeenCalled()
  })

  // A data PAGA é a que sai da linha do tempo da Análise — parcela quitada
  // some do fluxo previsto. Uma data torta aqui muda o que a Análise mostra.
  it('PARCELAS — a data em que a parcela foi PAGA grava ISO', () => {
    fixarRelogioLocal(2026, 8, 5)
    let item = {
      id: 'c1',
      servico: 'Cenografia',
      estimado: 1000,
      parcelas: [{ id: 'p1', valor: 1000, data: '2026-09-20', paga: true, dataPaga: '' }],
    }
    const onChange = vi.fn((patch) => {
      item = { ...item, ...patch }
    })
    render(<ParcelasModal item={item} onChange={onChange} onClose={vi.fn()} />)
    abrirCalendario('Data em que a parcela 1 foi paga')
    fireEvent.click(dia('12/08/2026'))
    expect(item.parcelas[0].dataPaga).toBe('2026-08-12')
  })

  // `inicioVendas` alimenta a curva, o ritmo semanal e a aba Análise. O
  // microtexto do campo promete que nenhum cenário muda — o fio prova as duas
  // metades: a data chega no evento, e o DRE do realista não se mexe.
  it('RECEITA — o início de vendas grava ISO, e nenhum cenário muda', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = { ...novoEvento('Marfim de teste'), inicioVendas: '' }
    evento.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 200, quantidade: 1000 }]
    const update = vi.fn()
    render(<RevenueTab evento={evento} update={update} />)
    abrirCalendario('Início de vendas')
    fireEvent.click(dia('12/08/2026'))
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(novo.inicioVendas).toBe('2026-08-12')
    expect(computeCenario(novo, 'realista').resultado).toBe(
      computeCenario(evento, 'realista').resultado
    )
  })

  it('CURVA — a virada prevista do lote grava ISO no lote certo', () => {
    fixarRelogioLocal(2026, 8, 5)
    const evento = {
      ...novoEvento('Marfim de teste'),
      data: '2026-12-05',
      inicioVendas: '2026-08-01',
      // o painel de viradas só existe no modo "datas", e o modo mora no EVENTO
      // (`setModo` chama o `update`) — num teste com update espião a tela nunca
      // trocaria sozinha, então o modo entra pelo dado, que é a fonte real
      curvaModo: 'datas',
      lotes: [
        { id: 'l1', nome: 'Lote 1', valor: 200, quantidade: 500 },
        { id: 'l2', nome: 'Lote 2', valor: 250, quantidade: 500 },
      ],
    }
    const update = vi.fn()
    render(<CurvaVendas evento={evento} update={update} breakEvenRealista={100} />)
    abrirCalendario('Virada prevista do Lote 2')
    fireEvent.click(dia('12/08/2026'))
    const novo = update.mock.calls.at(-1)[0](evento)
    expect(novo.lotes[1].viradaPrevista).toBe('2026-08-12')
    expect(novo.lotes[0].viradaPrevista).toBeUndefined() // o vizinho não foi tocado
  })
})

// ————————————————————————————————————————————————————————————————
// A PAREDE DESTA ONDA
// ————————————————————————————————————————————————————————————————

describe('a data do evento não tem mais porta pelo calendário do navegador', () => {
  it('NENHUM componente do app volta a abrir uma porta pelo calendário do navegador', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const path = await import('node:path')
    const dir = path.join(process.cwd(), 'src/components')
    // Comentários fora: o cabeçalho do CampoData CITA o widget nativo para
    // explicar o que ele substitui, e isso não é uma porta. O que se procura é
    // a marcação de verdade — por isso o próprio CampoData.jsx continua DENTRO
    // da varredura, e não numa lista de exceções que envelheceria calada.
    const semComentarios = (t) =>
      t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    const comNativo = readdirSync(dir)
      .filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
      .filter((f) => /type=['"]date['"]/.test(semComentarios(readFileSync(path.join(dir, f), 'utf8'))))
    // A lista é VAZIA e tem de continuar vazia: porta nova de data nasce no
    // CampoData, que é quem recusa 31 de fevereiro. Se este teste abrir
    // vermelho, alguém abriu uma porta sem a rede.
    expect(comNativo).toEqual([])
  })
})
