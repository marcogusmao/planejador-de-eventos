// @vitest-environment jsdom
//
// O FIO do slider de bar na grade de cenários (Marco, 05/08/2026).
//
// Por que este arquivo existe, e por que ele afirma sobre o RESULTADO DO
// UPDATER em vez de sobre o input: a lição nº 1 deste repositório é que a suíte
// inteira fica verde com a parte nova desligada. Um teste que só conte sliders
// na tela passaria com o `onChange` ligado em lugar nenhum. Aqui cada caso pega
// a função que o componente entregou ao `update`, roda ela sobre um evento e
// afirma sobre o objeto que sairia — que é exatamente o que o store gravaria.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SimuladorSliders from './Simulador.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

const eventoPorPessoa = () => {
  const ev = novoEvento('Marfim de teste')
  ev.barModo = 'porPessoa'
  ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
  ev.outrasReceitas = { bar: '', patrocinio: 50000 }
  return ev
}

function montar(evento, props = {}) {
  const update = vi.fn()
  render(<SimuladorSliders evento={evento} update={update} comTicket {...props} />)
  return { update, evento }
}

// Roda o updater que o componente entregou e devolve o evento resultante.
const resultado = (update, evento, chamada = 0) => update.mock.calls[chamada][0](evento)

const sliders = (nome) => screen.getAllByLabelText(nome)
const campo = (nome) => screen.getAllByLabelText(`${nome} (digite o valor)`)

describe('bar por pessoa — três sliders, um por cenário', () => {
  it('existem exatamente 3 sliders de "Bar por pessoa (R$)", com o valor de cada cenário', () => {
    montar(eventoPorPessoa())
    const s = sliders('Bar por pessoa (R$)')
    expect(s.length).toBe(3)
    expect(s.map((el) => el.value)).toEqual(['100', '110', '120'])
  })

  it('arrastar o do PESSIMISTA grava barTicket.pessimista — e não encosta nos outros dois', () => {
    const { update, evento } = montar(eventoPorPessoa())
    fireEvent.change(sliders('Bar por pessoa (R$)')[0], { target: { value: '130' } })
    const novo = resultado(update, evento)
    expect(novo.barTicket).toEqual({ pessimista: 130, realista: 110, otimista: 120 })
  })

  it('digitar no campo acoplado do OTIMISTA entende o formato brasileiro', () => {
    const { update, evento } = montar(eventoPorPessoa())
    fireEvent.change(campo('Bar por pessoa (R$)')[2], { target: { value: '1.234,56' } })
    expect(resultado(update, evento).barTicket.otimista).toBe(1234.56)
  })

  it('o slider do bar não mexe em cenariosConfig — são compartimentos diferentes', () => {
    const { update, evento } = montar(eventoPorPessoa())
    fireEvent.change(sliders('Bar por pessoa (R$)')[1], { target: { value: '95' } })
    const novo = resultado(update, evento)
    expect(novo.cenariosConfig).toBe(evento.cenariosConfig)
    expect(novo.outrasReceitas).toBe(evento.outrasReceitas)
  })

  it('o arrasto manda o ELEMENTO no descritor — um arrasto vira UM passo de desfazer', () => {
    const { update } = montar(eventoPorPessoa())
    const el = sliders('Bar por pessoa (R$)')[0]
    fireEvent.change(el, { target: { value: '130' } })
    const descritor = update.mock.calls[0][1]
    expect(descritor.rotulo).toBe('mudar Bar por pessoa (Pessimista)')
    expect(descritor.grupo).toBe(el)
  })

  it('cenário SEM bar preenchido mostra o slider em zero e o primeiro toque grava', () => {
    const ev = eventoPorPessoa()
    ev.barTicket = { pessimista: '', realista: 110, otimista: '' }
    const { update } = montar(ev)
    expect(sliders('Bar por pessoa (R$)')[0].value).toBe('0')
    fireEvent.change(sliders('Bar por pessoa (R$)')[0], { target: { value: '110' } })
    expect(resultado(update, ev).barTicket.pessimista).toBe(110)
  })

  it('o alcance do arrasto é R$ 0 a R$ 300, e o title diz isso em reais', () => {
    montar(eventoPorPessoa())
    const el = sliders('Bar por pessoa (R$)')[0]
    expect(el.min).toBe('0')
    expect(el.max).toBe('300')
    expect(el.closest('div').getAttribute('title')).toBe('Bar por pessoa (R$): de R$ 0 a R$ 300')
  })

  it('digitar acima do arrasto continua valendo (a régua do campo é a FAIXA_CONSUMO)', () => {
    const { update, evento } = montar(eventoPorPessoa())
    fireEvent.change(campo('Bar por pessoa (R$)')[0], { target: { value: '450' } })
    expect(resultado(update, evento).barTicket.pessimista).toBe(450)
  })

  it('digitar NEGATIVO é recusado — consumo de bar não é negativo', () => {
    const { update } = montar(eventoPorPessoa())
    fireEvent.change(campo('Bar por pessoa (R$)')[0], { target: { value: '-10' } })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('bar por pessoa — na tela da reunião (props do modo apresentação)', () => {
  it('os 3 sliders aparecem e respondem no escuro, sem o campo Ticket médio', () => {
    const update = vi.fn()
    const ev = eventoPorPessoa()
    render(<SimuladorSliders evento={ev} update={update} dark simulando />)
    expect(sliders('Bar por pessoa (R$)').length).toBe(3)
    expect(screen.queryByText('Ticket médio (R$)')).toBeNull()
    fireEvent.change(sliders('Bar por pessoa (R$)')[2], { target: { value: '150' } })
    expect(resultado(update, ev).barTicket.otimista).toBe(150)
  })
})

describe('modo VALOR FIXO — um slider só, acima das três colunas', () => {
  const eventoFixo = () => {
    const ev = eventoPorPessoa()
    ev.barModo = 'fixo'
    ev.outrasReceitas = { bar: 180000, patrocinio: 50000 }
    return ev
  }

  it('não há slider por coluna, e há exatamente UM "Bar — lucro líquido"', () => {
    montar(eventoFixo())
    expect(screen.queryAllByLabelText('Bar por pessoa (R$)').length).toBe(0)
    expect(sliders('Bar — lucro líquido (R$)').length).toBe(1)
    expect(sliders('Bar — lucro líquido (R$)')[0].value).toBe('180000')
  })

  it('arrastar grava outrasReceitas.bar e NÃO apaga o patrocínio (que mora no mesmo objeto)', () => {
    const { update, evento } = montar(eventoFixo())
    fireEvent.change(sliders('Bar — lucro líquido (R$)')[0], { target: { value: '200000' } })
    const novo = resultado(update, evento)
    expect(novo.outrasReceitas.bar).toBe(200000)
    expect(novo.outrasReceitas.patrocinio).toBe(50000)
    expect(novo.barTicket).toBe(evento.barTicket)
  })

  it('o arrasto vai de R$ 0 a R$ 300.000, de mil em mil, e o title diz em reais', () => {
    montar(eventoFixo())
    const el = sliders('Bar — lucro líquido (R$)')[0]
    expect([el.min, el.max, el.step]).toEqual(['0', '300000', '1000'])
    expect(el.closest('div').getAttribute('title')).toBe(
      'Bar — lucro líquido (R$): de R$ 0 a R$ 300.000'
    )
  })

  it('digitar NEGATIVO é aceito — prejuízo de bar é fato, e é a regra escrita da casa', () => {
    const { update, evento } = montar(eventoFixo())
    fireEvent.change(campo('Bar — lucro líquido (R$)')[0], { target: { value: '-5.000' } })
    expect(resultado(update, evento).outrasReceitas.bar).toBe(-5000)
  })

  it('a tela diz que este valor vale para os três cenários, e onde trocar de modo', () => {
    montar(eventoFixo())
    expect(screen.getByText(/Vale para os três cenários/)).toBeTruthy()
    expect(screen.getByText(/troque para .por pessoa. na aba Receita/)).toBeTruthy()
  })

  it('na apresentação (escuro) o slider único também aparece e responde', () => {
    const update = vi.fn()
    const ev = eventoFixo()
    render(<SimuladorSliders evento={ev} update={update} dark simulando />)
    fireEvent.change(sliders('Bar — lucro líquido (R$)')[0], { target: { value: '150000' } })
    expect(resultado(update, ev).outrasReceitas.bar).toBe(150000)
  })
})

describe('OPEN BAR — nenhum controle, e a razão escrita', () => {
  const eventoOpenBar = () => {
    const ev = eventoPorPessoa()
    ev.openBar = true
    return ev
  }

  it('nenhum slider de bar de espécie alguma', () => {
    montar(eventoOpenBar())
    expect(screen.queryAllByLabelText('Bar por pessoa (R$)').length).toBe(0)
    expect(screen.queryAllByLabelText('Bar — lucro líquido (R$)').length).toBe(0)
  })

  it('a frase explica por que não há o que arrastar', () => {
    montar(eventoOpenBar())
    expect(screen.getByText(/Open bar — sem receita de bar/)).toBeTruthy()
  })

  it('open bar manda também sobre o modo VALOR FIXO', () => {
    const ev = eventoOpenBar()
    ev.barModo = 'fixo'
    ev.outrasReceitas = { bar: 180000, patrocinio: 0 }
    montar(ev)
    expect(screen.queryAllByLabelText('Bar — lucro líquido (R$)').length).toBe(0)
    expect(screen.getByText(/Open bar — sem receita de bar/)).toBeTruthy()
  })

  it('sem open bar, a frase não aparece', () => {
    montar(eventoPorPessoa())
    expect(screen.queryByText(/Open bar — sem receita de bar/)).toBeNull()
  })
})

describe('os três sliders de cenário não regridem', () => {
  it('"Ingressos vendidos" continua sendo o primeiro controle da coluna', () => {
    montar(eventoPorPessoa())
    // o primeiro slider da tela é o de ingressos do pessimista, como sempre foi
    expect(screen.getAllByRole('slider')[0].getAttribute('aria-label')).toBe('Ingressos vendidos')
  })

  it('o botão de voltar ao padrão avisa que NÃO mexe no bar', () => {
    const ev = eventoPorPessoa()
    ev.cenariosConfig = { ...ev.cenariosConfig, realista: { vendaPct: 55 } }
    montar(ev)
    const botao = screen.getByText(/Voltar ao padrão/).closest('button')
    expect(botao.getAttribute('title')).toContain('não mexe no bar')
  })
})

// ————— Marco, 10/08/2026 —————
// "queria que o ticket médio em baixo mudasse de acordo com o slider". Ele não
// mudava: o placeholder era calculado com `ticketPct: 0`, então a tela mostrava
// o automático CRU enquanto a conta usava o automático AJUSTADO.
describe('o Ticket médio acompanha o Ajuste do ticket', () => {
  const eventoBase = (ticketPct) => {
    const ev = novoEvento('Marfim')
    ev.lotes = [{ id: 'l1', nome: 'Lote', valor: 200, quantidade: 1000 }]
    ev.cenariosConfig = { realista: { vendaPct: 90, ticketPct } }
    return ev
  }
  const ticketDoRealista = () =>
    screen.getAllByLabelText(/Ticket médio/i)[1].getAttribute('placeholder')

  it('sem ajuste e com +10% o placeholder é DIFERENTE, e na proporção', () => {
    const { unmount } = render(<SimuladorSliders evento={eventoBase(0)} update={vi.fn()} comTicket />)
    const semAjuste = Number(ticketDoRealista())
    unmount()
    render(<SimuladorSliders evento={eventoBase(10)} update={vi.fn()} comTicket />)
    const comAjuste = Number(ticketDoRealista())
    expect(semAjuste).toBeGreaterThan(0)
    expect(comAjuste).toBe(Math.round(semAjuste * 1.1))
  })

  it('ajuste negativo desce o número', () => {
    render(<SimuladorSliders evento={eventoBase(-20)} update={vi.fn()} comTicket />)
    expect(Number(ticketDoRealista())).toBeLessThan(200)
  })

  // Com ticket DIGITADO o campo guarda a base, então o efetivo vira uma linha.
  it('com ticket digitado, a tela DIZ qual é o efetivo do ajuste', () => {
    const ev = eventoBase(10)
    ev.cenariosConfig.realista.ticketMedio = 300
    render(<SimuladorSliders evento={ev} update={vi.fn()} comTicket />)
    expect(screen.getByText(/com o ajuste de \+10%/)).toBeTruthy()
  })
})
