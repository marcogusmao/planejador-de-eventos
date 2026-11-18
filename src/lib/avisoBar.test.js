import { describe, it, expect } from 'vitest'
import {
  barNaoInformado,
  cenariosSemBar,
  ticketBarParaCopiar,
  textoAvisoBar,
  CENARIOS,
} from './avisoBar.js'
import { computeCenario } from './calc.js'

// O evento REAL do Marco em 27/07/2026, reduzido ao que importa: bar por
// pessoa, ticket só no realista. Foi esta forma que fez o cenário pessimista
// dizer "prejuízo" para uma festa que dá R$ 148.260 de lucro.
const comoEstavaOEventoDoMarco = () => ({
  nome: 'Marfim Alto Casa Norte (nova edição)',
  publicoEstimado: 1758,
  barModo: 'porPessoa',
  openBar: false,
  barTicket: { pessimista: '', realista: 110, otimista: '' },
  barTaxaSistemaPct: 3.5,
})

describe('aviso de bar não informado (Marco, 27/07/2026)', () => {
  it('avisa exatamente nos cenários vazios, e não no que está preenchido', () => {
    const e = comoEstavaOEventoDoMarco()
    expect(barNaoInformado(e, 'pessimista')).toBe(true)
    expect(barNaoInformado(e, 'otimista')).toBe(true)
    expect(barNaoInformado(e, 'realista')).toBe(false)
    expect(cenariosSemBar(e)).toEqual(['pessimista', 'otimista'])
  })

  it('o aviso é sobre um R$ 0 que ninguém digitou — provado contra o cálculo real', () => {
    // não basta a função dizer "vazio": o cenário tem de estar mesmo contando
    // zero de bar, senão o aviso seria decorativo
    const e = {
      ...comoEstavaOEventoDoMarco(),
      lotes: [{ id: 'l1', nome: 'Lote', valor: 200, quantidade: 1000 }],
    }
    expect(computeCenario(e, 'pessimista').bar).toBe(0)
    expect(computeCenario(e, 'otimista').bar).toBe(0)
    expect(computeCenario(e, 'realista').bar).toBeGreaterThan(0)
    for (const c of CENARIOS) {
      expect(barNaoInformado(e, c)).toBe(computeCenario(e, c).bar === 0)
    }
  })

  it('bar FIXO nunca avisa — lá o valor é um só para os três', () => {
    const e = { ...comoEstavaOEventoDoMarco(), barModo: 'fixo' }
    expect(cenariosSemBar(e)).toEqual([])
  })

  it('OPEN BAR nunca avisa — o R$ 0 ali é a resposta certa e declarada', () => {
    const e = { ...comoEstavaOEventoDoMarco(), openBar: true }
    expect(cenariosSemBar(e)).toEqual([])
  })

  it('com os três preenchidos não há aviso nenhum', () => {
    const e = { ...comoEstavaOEventoDoMarco(), barTicket: { pessimista: 100, realista: 110, otimista: 120 } }
    expect(cenariosSemBar(e)).toEqual([])
    expect(textoAvisoBar(e, 'pessimista')).toBeNull()
  })

  // ————— Marco, 07/08/2026, por questionário: a régua mudou —————
  // Até 05/08 zero e vazio acendiam o mesmo aviso, e isso acertava: o único jeito
  // de pôr bar num cenário era DIGITAR, e campo em zero era campo esquecido. O
  // slider na grade tornou zerar um gesto de um segundo — e o aviso passou a
  // acusar escolha deliberada. Agora "não informado" é campo VAZIO.
  it('zero digitado À MÃO não avisa mais — é resposta, não esquecimento', () => {
    const e = { ...comoEstavaOEventoDoMarco(), barTicket: { pessimista: 0, realista: 110, otimista: 0 } }
    expect(cenariosSemBar(e)).toEqual([])
    expect(barNaoInformado(e, 'pessimista')).toBe(false)
  })

  it('mas o campo VAZIO continua avisando — a metade que a regra de 27/07 protege', () => {
    const e = { ...comoEstavaOEventoDoMarco(), barTicket: { pessimista: '', realista: 110, otimista: null } }
    expect(cenariosSemBar(e)).toEqual(['pessimista', 'otimista'])
  })

  // O zero deliberado continua contando R$ 0 na conta — o que muda é só o aviso.
  it('e a CONTA não muda: zero explícito segue contando R$ 0 de bar', () => {
    const e = {
      ...comoEstavaOEventoDoMarco(),
      barTicket: { pessimista: 0, realista: 110, otimista: 0 },
      lotes: [{ id: 'l1', nome: 'Lote', valor: 200, quantidade: 1000 }],
    }
    expect(computeCenario(e, 'pessimista').bar).toBe(0)
    expect(computeCenario(e, 'realista').bar).toBeGreaterThan(0)
  })

  it('o valor oferecido para copiar é o do realista quando ele existe', () => {
    expect(ticketBarParaCopiar(comoEstavaOEventoDoMarco())).toBe(110)
  })

  it('sem realista, cai no otimista; sem nenhum, não há o que copiar', () => {
    const so = (bt) => ticketBarParaCopiar({ ...comoEstavaOEventoDoMarco(), barTicket: bt })
    expect(so({ pessimista: '', realista: '', otimista: 125 })).toBe(125)
    expect(so({ pessimista: 90, realista: '', otimista: '' })).toBe(90)
    expect(so({ pessimista: '', realista: '', otimista: '' })).toBeNull()
  })

  it('o texto do aviso diz o valor do outro cenário, para o número não virar mistério', () => {
    const t = textoAvisoBar(comoEstavaOEventoDoMarco(), 'pessimista')
    expect(t).toContain('bar não informado neste cenário')
    expect(t).toContain('contado como R$ 0')
    expect(t).toContain('110,00')
  })

  it('sem nenhum ticket preenchido, o aviso não inventa valor nenhum', () => {
    const e = { ...comoEstavaOEventoDoMarco(), barTicket: { pessimista: '', realista: '', otimista: '' } }
    const t = textoAvisoBar(e, 'realista')
    expect(t).toBe('bar não informado neste cenário — contado como R$ 0')
  })

  it('evento sem nada não quebra', () => {
    for (const e of [null, undefined, {}]) {
      expect(cenariosSemBar(e)).toEqual([])
      expect(ticketBarParaCopiar(e)).toBeNull()
      expect(textoAvisoBar(e, 'realista')).toBeNull()
    }
  })
})
