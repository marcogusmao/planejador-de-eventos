// @vitest-environment jsdom
//
// Evidência do achado S3 do BACKLOG (seção "Três decisões datadas do Marco
// sem teste que as trave", item (c)): os tickets bruto/líquido dos cards do
// "Resumo por cenário" já sumiram do relatório INTEIRO uma vez, sem aviso —
// commit 44be58f ("cada número tem um endereço") tirou as duas linhas dos 3
// cards achando que Números-chave bastava; Números-chave só mostra o
// REALISTA, então pessimista e otimista perderam o ticket sem ninguém notar
// até a verificação adversarial da própria sessão. 32 minutos depois, o
// commit ef1f6a6 devolveu as linhas por decisão do Marco (19/07/2026),
// aceitando conscientemente a duplicação do ticket do realista (card ×
// Números-chave) em troca de nenhum cenário perder informação. Este arquivo
// é o cadeado dessa decisão: trava que os TRÊS cards (pessimista, realista,
// otimista) continuam mostrando "Ticket bruto" e "Ticket líquido" — não só
// "a palavra Ticket aparece em algum lugar da página" (Números-chave sempre
// tem "Ticket médio (bruto)"/líquido do realista, rótulo DIFERENTE, e não
// morderia a regressão).
//
// Ambiente jsdom só aqui (como em PresentationMode.test.jsx) — a suíte de
// libs roda em 'node'.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ReportView from './ReportView.jsx'
import { novoEvento, novoLote } from '../lib/defaults.js'
import { computeCenarios, CENARIOS, CENARIO_LABEL } from '../lib/calc.js'
import { fmtBRL2 } from '../lib/format.js'

afterEach(cleanup)

// Fixture com um ticket MANUAL diferente por cenário (cenariosConfig.*.ticketMedio)
// — de propósito, para os 3 valores serem numericamente distintos. Sem isso, um
// card vazio "passaria" comparando com o número certo por coincidência (o
// pessimista mostraria o número do otimista sem o teste perceber).
function montarEvento() {
  const evento = novoEvento('Festa de Teste — tickets por cenário')
  evento.publicoEstimado = 200
  evento.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  evento.cenariosConfig = {
    pessimista: { ticketMedio: 80 },
    realista: { ticketMedio: 100 },
    otimista: { ticketMedio: 120 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  }
  return evento
}

function montarStore(evento) {
  return { eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }
}

// Os cards do "Resumo por cenário" são os ÚNICOS elementos da tela com
// style={{ borderTop: ... }} (ReportView.jsx, dentro do CENARIOS.map) — por
// isso achar por esse estilo inline, em vez de por classe (a classe
// "rounded-lg border border-stone-200 p-3" também aparece, com classes
// extras, num outro bloco fora do Resumo por cenário).
function cardsPorCenario(container) {
  const divs = Array.from(container.querySelectorAll('div')).filter((d) => d.style.borderTop)
  return divs
}

describe('ReportView — cards do "Resumo por cenário" continuam com Ticket bruto/líquido', () => {
  it('renderiza sem lançar exceção com o fixture mínimo', () => {
    const evento = montarEvento()
    const store = montarStore(evento)
    expect(() =>
      render(<ReportView evento={evento} store={store} onBack={() => {}} />)
    ).not.toThrow()
  })

  it('existem exatamente 3 cards de cenário, um por CENARIO_LABEL', () => {
    const evento = montarEvento()
    const store = montarStore(evento)
    const { container } = render(<ReportView evento={evento} store={store} onBack={() => {}} />)
    const cards = cardsPorCenario(container)
    expect(cards).toHaveLength(3)
    CENARIOS.forEach((k, i) => {
      expect(cards[i].textContent).toContain(CENARIO_LABEL[k])
    })
  })

  it('CADA card mostra "Ticket bruto"/"Ticket líquido" com o valor do PRÓPRIO cenário', () => {
    const evento = montarEvento()
    const store = montarStore(evento)
    const c = computeCenarios(evento)
    const { container } = render(<ReportView evento={evento} store={store} onBack={() => {}} />)
    const cards = cardsPorCenario(container)
    expect(cards).toHaveLength(3)

    CENARIOS.forEach((k, i) => {
      const texto = cards[i].textContent
      // textContent, não getByText: React quebra {expr} em vários text nodes
      // (mesmo padrão de BarraOrcamentoFechado.test.jsx) — o valor mora
      // concatenado no elemento, não isolado num node.
      expect(texto).toContain('Ticket bruto')
      expect(texto).toContain(fmtBRL2(c[k].ticketMedio))
      expect(texto).toContain('Ticket líquido')
      expect(texto).toContain(fmtBRL2(c[k].ticketMedioLiquido))

      // achado (d) do BACKLOG: Break-even e Ingressos pagos vivem no MESMO
      // card, ao lado dos tickets — para uma futura "limpeza da sobreposição"
      // com Números-chave não apagar os tickets pensando que são redundantes
      // sem este teste avisar.
      expect(texto).toContain('Break-even (pagos)')
      expect(texto).toContain('Ingressos pagos')
    })
  })

  it('escopo por card: o ticket do pessimista NÃO aparece no card do otimista (nem vice-versa)', () => {
    const evento = montarEvento()
    const store = montarStore(evento)
    const c = computeCenarios(evento)
    const { container } = render(<ReportView evento={evento} store={store} onBack={() => {}} />)
    const cards = cardsPorCenario(container)
    const [cardPessimista, , cardOtimista] = cards

    // fixture desenhada para os 3 tickets serem numericamente distintos —
    // senão um card vazio "passaria" comparando com o número certo por
    // coincidência.
    expect(c.pessimista.ticketMedio).not.toBe(c.otimista.ticketMedio)

    expect(cardPessimista.textContent).not.toContain(fmtBRL2(c.otimista.ticketMedio))
    expect(cardOtimista.textContent).not.toContain(fmtBRL2(c.pessimista.ticketMedio))
  })
})
