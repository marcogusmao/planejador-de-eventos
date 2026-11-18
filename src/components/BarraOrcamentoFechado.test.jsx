// @vitest-environment jsdom
//
// Decisão 1 do Marco (22/07/2026): a barra "fechados ou pagos" e o resumo do
// WhatsApp bebem da MESMA função — contaOrcamentoFechado (statusCusto.js). Este
// arquivo é o cadeado: para uma mesma cesta de status, o número que a BARRA
// pinta e o número que o RESUMO escreve são idênticos, e ambos são exatamente o
// que a função devolve. Import único → não podem divergir.
//
// O bug que isto mata (S2 de exibição): a barra somava só a lista antiga de 4
// status; com a lista nova de 11, o denominador subcontava e mostrava "R$ 60.500
// de R$ 60.500 (100%)" onde o certo era "R$ 60.500 de R$ 140.050 (43%)".
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BarraOrcamentoFechado } from './ui.jsx'
import { contaOrcamentoFechado } from '../lib/statusCusto.js'
import { resumoCompleto } from '../lib/resumo.js'
import { custosPorStatus } from '../lib/calc.js'
import { fmtBRL, fmtCompact } from '../lib/format.js'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'

afterEach(cleanup)

// Cesta com status NOVOS: ESTIMADO (fora do numerador, dentro do denominador),
// PARCIAL (dentro do numerador), FECHADO e PAGO.
const TOTAIS = { ESTIMADO: 79550, PARCIAL: 10500, FECHADO: 40000, PAGO: 10000 }

describe('BarraOrcamentoFechado — trava na fonte ÚNICA contaOrcamentoFechado', () => {
  it('a barra mostra EXATAMENTE o que a função devolve (denominador cheio, 43%)', () => {
    const { fechado, total, pct } = contaOrcamentoFechado(TOTAIS)
    expect(pct).toBe(43) // conta certa, não os 100% do bug
    // textContent (não getByText): o React quebra `{expr}` em vários text nodes,
    // então a frase mora concatenada no elemento, não num node só.
    const { container } = render(<BarraOrcamentoFechado totais={TOTAIS} fmt={fmtBRL} />)
    expect(container.textContent).toContain(
      `${fmtBRL(fechado)} de ${fmtBRL(total)} (${pct}%) fechados ou pagos`
    )
    expect(container.textContent).toContain(`${100 - pct}% ainda é estimativa`)
  })

  it('um segmento por status presente, na cor da FONTE ÚNICA — PARCIAL e ESTIMADO inclusos', () => {
    const { container } = render(<BarraOrcamentoFechado totais={TOTAIS} fmt={fmtBRL} />)
    const titulos = Array.from(container.querySelectorAll('div[title]')).map((d) =>
      d.getAttribute('title')
    )
    expect(titulos.some((t) => t.startsWith('PARCIAL:'))).toBe(true)
    expect(titulos.some((t) => t.startsWith('ESTIMADO:'))).toBe(true)
    expect(titulos.some((t) => t.startsWith('PAGO:'))).toBe(true)
  })

  it('total 0 → não renderiza nada (null)', () => {
    const { container } = render(<BarraOrcamentoFechado totais={{}} fmt={fmtBRL} />)
    expect(container.firstChild).toBeNull()
  })

  it('RESUMO e BARRA usam a MESMA função: a linha "Orçamento" do resumo casa com a conta', () => {
    // Evento cujos custos caem em ESTIMADO+PAGO+PARCIAL — a mesma cesta do bug.
    const ev = novoEvento('Casa')
    ev.lotes = [novoLote({ nome: 'L1', valor: 100, quantidade: 1000 })]
    ev.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          novoItem({ servico: 'A', estimado: 79550, status: 'ESTIMADO' }),
          novoItem({ servico: 'B', estimado: 40000, status: 'FECHADO' }),
          novoItem({ servico: 'C', estimado: 10500, status: 'PARCIAL' }),
          novoItem({ servico: 'D', estimado: 10000, status: 'PAGO' }),
        ],
      },
    ]
    const conta = contaOrcamentoFechado(custosPorStatus(ev.categorias))
    expect(conta).toEqual({ fechado: 60500, total: 140050, pct: 43 })
    const txt = resumoCompleto(ev)
    expect(txt).toContain(
      `${fmtCompact(conta.fechado)} de ${fmtCompact(conta.total)} (${conta.pct}%) fechados ou pagos`
    )
  })
})

// Custo de 1e308 (2ª revisão do PR #98, 05/10/2026): a barra imprimia
// "R$ 0 de R$ 100.000.000…000 (0%)" e o número estourava a largura da tela.
describe('BarraOrcamentoFechado — total que não cabe numa conta de dinheiro', () => {
  it('troca a barra por texto, sem número', () => {
    const { container } = render(<BarraOrcamentoFechado totais={{ ESTIMADO: 1e308, PAGO: 1000 }} fmt={fmtBRL} />)
    expect(container.textContent).toContain('não dá para calcular')
    expect(container.textContent).not.toMatch(/R\$/)
  })
})
