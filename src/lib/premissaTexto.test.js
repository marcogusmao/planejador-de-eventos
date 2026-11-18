import { describe, it, expect } from 'vitest'
import {
  premissaDesconto,
  premissaTaxa,
  premissasBilheteria,
  premissaInicioVendas,
  premissaReferenciaCurva,
  premissasCurva,
  fraseTicketBruto,
  fraseTicketLiquido,
  contaTicketBruto,
  contaTicketLiquido,
  microTicketLiquido,
  legendasRelatorio,
  TICKET_LIQUIDO_LABEL,
  TICKET_BRUTO_LABEL,
} from './premissaTexto.js'
import { fmtBRL2 } from './format.js'

// Frases-fonte-única das premissas (sugestão 29 — regra "feature não é
// ilha"): relatório, apresentação, resumo e microtextos citam ESTAS frases.
describe('premissaDesconto (sugestão 29a)', () => {
  it('sem cupom (vazio, 0, ausente) → "" — nenhuma premissa a citar', () => {
    expect(premissaDesconto({})).toBe('')
    expect(premissaDesconto({ descontoMedioPct: '' })).toBe('')
    expect(premissaDesconto({ descontoMedioPct: 0 })).toBe('')
  })

  it('campo antigo (só cupom) → "em todos os ingressos"', () => {
    expect(premissaDesconto({ descontoMedioPct: 10 })).toBe('cupom de 10% em todos os ingressos')
  })

  it('modo % → "em X% dos ingressos" (100% continua "todos")', () => {
    expect(
      premissaDesconto({ descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 40 })
    ).toBe('cupom de 10% em 40% dos ingressos')
    expect(
      premissaDesconto({ descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 100 })
    ).toBe('cupom de 10% em todos os ingressos')
  })

  it('modo nº → "em até N ingressos (fração por cenário)"; sem nº → "todos"', () => {
    expect(
      premissaDesconto({ descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: 180 })
    ).toBe('cupom de 10% em até 180 ingressos (fração por cenário)')
    expect(
      premissaDesconto({ descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: '' })
    ).toBe('cupom de 10% em todos os ingressos')
  })

  it('números em português: vírgula decimal ("7,5%")', () => {
    expect(
      premissaDesconto({ descontoMedioPct: 7.5, descontoIngressosModo: 'pct', descontoIngressosValor: 12.5 })
    ).toBe('cupom de 7,5% em 12,5% dos ingressos')
  })
})

describe('premissaTaxa (sugestão 29b)', () => {
  it('só cita no modo repasse — o padrão "por nós" não vira premissa', () => {
    expect(premissaTaxa({})).toBe('')
    expect(premissaTaxa({ taxaPagaPor: 'nos', taxaBilheteria: 10 })).toBe('')
    expect(premissaTaxa({ taxaPagaPor: 'CLIENTE', taxaBilheteria: 10 })).toBe('')
    expect(premissaTaxa({ taxaPagaPor: 'cliente', taxaBilheteria: 10 })).toBe(
      'taxa de 10% paga pelo cliente (não desconta da receita)'
    )
  })
})

describe('premissasBilheteria (lista para o rodapé)', () => {
  it('sem premissa → lista vazia; com desconto → a frase exata', () => {
    expect(premissasBilheteria({})).toEqual([])
    expect(premissasBilheteria({ descontoMedioPct: 10 })).toEqual([
      'cupom de 10% em todos os ingressos',
    ])
  })

  it('desconto + taxa repassada = as duas frases, na ordem do mapa da sugestão', () => {
    expect(
      premissasBilheteria({
        descontoMedioPct: 10,
        descontoIngressosModo: 'pct',
        descontoIngressosValor: 40,
        taxaBilheteria: 10,
        taxaPagaPor: 'cliente',
      })
    ).toEqual([
      'cupom de 10% em 40% dos ingressos',
      'taxa de 10% paga pelo cliente (não desconta da receita)',
    ])
  })
})

describe('régua ticket (Sessão F2-Y — item 4): frase de gente + continha real', () => {
  it('rótulos e frases base', () => {
    expect(TICKET_LIQUIDO_LABEL).toBe('Ticket médio líquido')
    expect(TICKET_BRUTO_LABEL).toBe('Ticket médio (bruto)')
    expect(fraseTicketLiquido()).toBe('Quanto sobra pra gente, por ingresso vendido.')
    expect(fraseTicketBruto({ descontoMedioPct: 10 })).toContain('desconto do cupom já aplicado')
    expect(fraseTicketBruto({})).toContain('preço de tabela')
    expect(fraseTicketBruto({})).not.toContain('cupom')
  })

  it('continha do bruto: tabela − cupom = bruto (desfaz o desconto efetivo)', () => {
    // cupom 10% em todos → ef 10% → tabela = 90 ÷ 0,9 = 100; cupom = 10
    const s = { pagos: 100, ticketMedio: 90, ticketMedioLiquido: 0, taxa: 0, cashback: 0 }
    expect(contaTicketBruto({ descontoMedioPct: 10 }, s)).toBe(
      `Neste evento: ${fmtBRL2(100)} (tabela) − ${fmtBRL2(10)} (cupom) = ${fmtBRL2(90)} por ingresso.`
    )
  })

  it('continha do bruto sem cupom = o próprio preço de tabela', () => {
    const s = { pagos: 100, ticketMedio: 80, ticketMedioLiquido: 0, taxa: 0, cashback: 0 }
    expect(contaTicketBruto({}, s)).toBe(
      `Neste evento: ${fmtBRL2(80)} por ingresso (não há cupom — é o próprio preço de tabela).`
    )
  })

  it('continha do líquido (paga por nós): bruto − taxa + cashback = líquido', () => {
    // taxa total 1000 ÷ 100 = 10/ing; cashback 500 ÷ 100 = 5/ing; líquido 95
    const s = { pagos: 100, ticketMedio: 100, ticketMedioLiquido: 95, taxa: 1000, cashback: 500 }
    expect(contaTicketLiquido({ taxaBilheteria: 10, cashbackPct: 5 }, s)).toBe(
      `Neste evento: ${fmtBRL2(100)} − ${fmtBRL2(10)} (taxa) + ${fmtBRL2(5)} (cashback) = ${fmtBRL2(
        95
      )} por ingresso.`
    )
  })

  it('continha do líquido no modo cliente: a parcela da taxa some', () => {
    const s = { pagos: 100, ticketMedio: 100, ticketMedioLiquido: 105, taxa: 1000, cashback: 500 }
    const t = contaTicketLiquido({ taxaPagaPor: 'cliente', cashbackPct: 5 }, s)
    expect(t).not.toContain('(taxa)')
    expect(t).toBe(
      `Neste evento: ${fmtBRL2(100)} + ${fmtBRL2(5)} (cashback) = ${fmtBRL2(105)} por ingresso.`
    )
  })

  it('sem ingresso pago: continha vazia e micro cai só na frase', () => {
    const s = { pagos: 0, ticketMedio: 0, ticketMedioLiquido: 0, taxa: 0, cashback: 0 }
    expect(contaTicketBruto({}, s)).toBe('')
    expect(microTicketLiquido({}, s)).toBe(fraseTicketLiquido())
  })

  it('legendasRelatorio: com o realista põe "Neste evento"; sem ele, genérico; sem bar/patrocínio', () => {
    const evento = { descontoMedioPct: 0, contingenciaPct: 5 }
    const realista = {
      margem: 27,
      breakEven: 320,
      contingencia: 1500,
      pagos: 100,
      ticketMedio: 80,
      ticketMedioLiquido: 76,
      taxa: 0,
      cashback: 0,
    }
    const mapa = Object.fromEntries(legendasRelatorio(evento, realista))
    expect(mapa['Margem']).toContain('margem de 27%')
    expect(mapa['Break-even (BE)']).toContain('320 ingressos pagos')
    expect(mapa['Contingência']).toContain('5% dos custos')
    expect(mapa[TICKET_LIQUIDO_LABEL]).not.toContain('Bar e patrocínio')
    expect(mapa[TICKET_BRUTO_LABEL]).toContain('preço de tabela')
    // sem realista → genéricos, nada de "Neste evento"
    const g = Object.fromEntries(legendasRelatorio(evento))
    expect(g['Break-even (BE)']).not.toContain('Neste evento')
    expect(g['Margem']).not.toContain('Neste evento')
  })
})

describe('premissas da curva (Sessão F2-S — sugestão 30)', () => {
  it('pela premissa da festa: "vendas abrem 45 dias antes da festa (29/07/2026)"', () => {
    const ev = { data: '2026-09-12', inicioVendas: '', vendasAbremDiasAntes: 45 }
    expect(premissaInicioVendas(ev)).toBe('vendas abrem 45 dias antes da festa (29/07/2026)')
  })

  it('data preenchida à mão: "início de vendas em 13/08/2026 (30 dias antes)" — o campo vence', () => {
    const ev = { data: '2026-09-12', inicioVendas: '2026-08-13', vendasAbremDiasAntes: 90 }
    expect(premissaInicioVendas(ev)).toBe('início de vendas em 13/08/2026 (30 dias antes)')
  })

  it('sem início (ou depois da festa) → "" — o rodapé não cita premissa ignorada', () => {
    expect(premissaInicioVendas({ data: '2026-09-12' })).toBe('')
    expect(premissaInicioVendas({ data: '2026-09-12', inicioVendas: '2026-09-20' })).toBe('')
  })

  it('referência escolhida é citada como guardada; padrão cita a média da festa', () => {
    expect(
      premissaReferenciaCurva({ curvaRef: { modo: 'festa', itens: [{ id: 7, nome: 'Brisa #2' }] } })
    ).toBe('referência da curva: Brisa #2')
    expect(
      premissaReferenciaCurva({ curvaRef: { modo: 'grupo', itens: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }] } })
    ).toBe('referência da curva: grupo de 2 festas')
    expect(premissaReferenciaCurva({ tipo: 'Brisa' })).toBe('referência da curva: média Brisa')
    expect(premissaReferenciaCurva({})).toBe('referência da curva: média geral')
  })

  it('premissasCurva: com início vem o par; sem início só referência ESCOLHIDA vira frase', () => {
    const comInicio = { data: '2026-09-12', vendasAbremDiasAntes: 45, tipo: 'Brisa' }
    expect(premissasCurva(comInicio)).toEqual([
      'vendas abrem 45 dias antes da festa (29/07/2026)',
      'referência da curva: média Brisa',
    ])
    expect(premissasCurva({ data: '2026-09-12', tipo: 'Brisa' })).toEqual([])
    expect(
      premissasCurva({ curvaRef: { modo: 'festa', itens: [{ id: 7, nome: 'Brisa #2' }] } })
    ).toEqual(['referência da curva: Brisa #2'])
  })
})
