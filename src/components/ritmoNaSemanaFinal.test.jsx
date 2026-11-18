// @vitest-environment jsdom
//
// O card que o Marco olha, RENDERIZADO — não a função por trás dele.
//
// O conserto de 10/08/2026 (a semana final passa a mostrar ritmo) tem prova de
// unidade em `src/lib/ritmoPorDia.test.js`. Falta a prova de que o texto chega
// à TELA: entre a função e o card existem o relógio (`hojeISO()`, lido dentro
// do componente, não injetado) e o `inicioVendas` puxado da configuração da
// curva. Este arquivo fecha esse vão — é o mais perto de "olhar a tela" que se
// prova rodando.
//
// O relógio é fixado num instante que dá o MESMO dia nos dois fusos em que a
// esteira roda (TZ=UTC e TZ=America/Sao_Paulo): 10/08/2026 15h em São Paulo é
// 10/08/2026 18h em UTC. Sem isso o teste passaria a depender do dia em que
// alguém o rodasse.
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RitmoVendasCard, linhaRitmoHome } from './RitmoVendas.jsx'
import { novoEvento } from '../lib/defaults.js'

afterEach(cleanup)

const INSTANTE_10_08_2026 = new Date('2026-08-10T18:00:00.000Z')

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(INSTANTE_10_08_2026)
})
afterAll(() => vi.useRealTimers())

// Os números do print dele: Brisa #3, 84 vendidos, break-even 364 → faltam 280.
const eventoEm = (data) => ({ ...novoEvento(), nome: 'Brisa #3', data, vendidosAteHoje: 84 })
const BREAK_EVEN = 364

const textoDoCard = (data) =>
  render(<RitmoVendasCard evento={eventoEm(data)} update={() => {}} breakEvenRealista={BREAK_EVEN} />)
    .container.textContent

describe('o card "Estamos vendendo no ritmo?" na semana final', () => {
  it('a 4 dias da festa mostra 70 por dia — onde antes calava', () => {
    const t = textoDoCard('2026-08-14')
    expect(t).toContain('Faltam 280 ingressos em 4 dia(s) de venda')
    expect(t).toContain('precisa vender 70 por dia para cobrir o break-even (364)')
    // o texto que ocupava este lugar até 10/08/2026, e que não mostrava número
    expect(t).not.toContain('menos de uma semana de venda')
  })

  it('a 1 dia da festa mostra 280 por dia — a véspera não é exceção', () => {
    const t = textoDoCard('2026-08-11')
    expect(t).toContain('precisa vender 280 por dia')
  })

  it('no DIA da festa fala no presente, com o quanto falta', () => {
    const t = textoDoCard('2026-08-10')
    expect(t).toContain('A festa é hoje — faltam 280 ingressos para o break-even (364)')
    // festa que já aconteceu é outra frase, e não pode vazar para o dia dela
    expect(t).not.toContain('já realizado')
    // "semana" solto não serve de asserção: o microtexto do próprio card pede
    // que ele cole o total "1× por semana". O que não pode voltar é a frase de
    // ritmo antiga — e é ela que se afirma aqui.
    expect(t).not.toContain('menos de uma semana de venda')
  })

  it('a janela longa continua igual ao que o PR #85 entregou (12 dias, 24 por dia)', () => {
    const t = textoDoCard('2026-08-22')
    expect(t).toContain('Faltam 280 ingressos em 12 dia(s) de venda')
    expect(t).toContain('precisa vender 24 por dia')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A MESMA TELA, com a data que não é uma data (achado S1, 30/08/2026).
//
// Antes deste conserto, com 280 ingressos faltando, o card renderizava
// "Faltam 280 ingressos em 0 dia(s) de venda → precisa vender 0 por dia" e a
// linha da Home renderizava "Faltam 280 p/ break-even · 0/dia". Os dois zeros
// nascem de NaN passando por `fmtInt`, e os dois afirmam ao Marco que não falta
// vender nada por dia.
//
// '05/12/2026' está aqui de propósito e não é entrada absurda: é o formato que
// a própria tela IMPRIME, e `evento.data` é a única data do app que a migração
// deixa passar sem conferir (`migracao.js`: `sobrevive` devolve true para
// 'data'). Um backup editado à mão chega assim.
// ─────────────────────────────────────────────────────────────────────────────
describe('o mesmo card com a data ilegível: diz o problema, nunca um número', () => {
  const AVISO = 'A data desta festa não é uma data válida'

  it.each(['abacaxi', '05/12/2026', '2026-13-45', '31/02/2026'])(
    'data %s → o card avisa e não mostra "0 por dia"',
    (data) => {
      const t = textoDoCard(data)
      expect(t).toContain(AVISO)
      expect(t).not.toContain('0 por dia')
      expect(t).not.toContain('0 dia(s) de venda')
      expect(t).not.toContain('Faltam 280 ingressos em')
    }
  )

  it('a linha da Home também para de dizer "0/dia"', () => {
    expect(linhaRitmoHome(eventoEm('05/12/2026'), BREAK_EVEN).texto).toContain(AVISO)
    expect(linhaRitmoHome(eventoEm('05/12/2026'), BREAK_EVEN).texto).not.toContain('0/dia')
    // e a data boa segue idêntica
    expect(linhaRitmoHome(eventoEm('2026-08-22'), BREAK_EVEN).texto).toBe(
      'Faltam 280 p/ break-even · 24/dia'
    )
  })
})
