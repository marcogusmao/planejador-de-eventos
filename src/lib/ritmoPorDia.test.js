// O ritmo necessário passa a ser em DIAS (Marco, 10/08/2026, por questionário).
//
// Este arquivo existe porque a frase do ritmo NÃO tinha teste nenhum: nenhuma
// asserção da casa citava "Faltam … precisa vender …" antes de 10/08/2026, e foi
// justamente ela que fez o Marco desconfiar de um número correto. O que se fixa
// aqui não é a redação — é a PROPRIEDADE que faltava: o ritmo mostrado, vezes a
// janela mostrada, cobre o que falta para o break-even.
import { describe, it, expect } from 'vitest'
import { ritmoVendas } from './calc.js'
import { fraseRitmo, ritmoPorDia, linhaRitmoRelatorio } from './resumo.js'
import { linhaRitmoHome } from '../components/RitmoVendas.jsx'

// O caso exato do print do Marco: Brisa #3, festa em 22/08/2026, olhado em
// 10/08/2026, 84 vendidos, break-even 364.
const CASO_DO_MARCO = { vendidos: 84, dataEvento: '2026-08-22', breakEven: 364, hoje: '2026-08-10' }

describe('o ritmo em dias — o caso que o Marco derrubou olhando a tela', () => {
  const r = ritmoVendas(CASO_DO_MARCO)

  it('a janela é de 12 dias e o ritmo é 24 por dia', () => {
    const d = ritmoPorDia(r)
    expect(d.diasVenda).toBe(12)
    expect(d.porDia).toBe(24) // ceil(280 / 12) = ceil(23,33)
  })

  it('a frase diz dias, não semanas — e não traz mais janela arredondada', () => {
    const frase = fraseRitmo(r)
    expect(frase).toBe(
      'Faltam 280 ingressos em 12 dia(s) de venda → precisa vender 24 por dia para cobrir o break-even (364).'
    )
    // A regressão que este conserto fecha: a frase antiga dizia "1,7 semana(s)"
    // e "164 por semana", e 164 × 1,7 = 278,8 < 280.
    expect(frase).not.toContain('semana(s) de venda')
    expect(frase).not.toContain('por semana')
    expect(frase).not.toContain('1,7')
  })

  it('A CONTA FECHA quando o Marco a refaz com os números MOSTRADOS na tela', () => {
    const d = ritmoPorDia(r)
    // Era exatamente isto que falhava antes: 164 × 1,7 = 278,8 < 280.
    expect(d.porDia * d.diasVenda).toBeGreaterThanOrEqual(r.faltam)
    expect(24 * 12).toBe(288)
  })
})

describe('a propriedade que faltava: o ritmo mostrado nunca subestima o necessário', () => {
  // A varredura começa em 1 DIA (era 7), porque a semana final deixou de ser
  // uma zona sem ritmo: as janelas de 1 a 6 dias agora imprimem número, e é
  // exatamente nelas que um teto frouxo apareceria primeiro (faltam 280 em 1
  // dia → 280 por dia, sem folga nenhuma para errar).
  it('varredura de 406 janelas × 40 quantidades: porDia × diasVenda >= faltam, sempre', () => {
    let casosComRitmo = 0
    let piorSobra = Infinity
    for (let dias = 1; dias <= 406; dias++) {
      for (let faltam = 1; faltam <= 40; faltam++) {
        const breakEven = 1000
        const r = ritmoVendas({
          vendidos: breakEven - faltam,
          dataEvento: new Date(Date.UTC(2026, 0, 1 + dias)).toISOString().slice(0, 10),
          breakEven,
          hoje: '2026-01-01',
        })
        const d = ritmoPorDia(r)
        if (!d) continue
        casosComRitmo++
        // a promessa da frase, para cada caso
        expect(d.porDia * d.diasVenda).toBeGreaterThanOrEqual(r.faltam)
        piorSobra = Math.min(piorSobra, d.porDia * d.diasVenda - r.faltam)
      }
    }
    expect(casosComRitmo).toBeGreaterThan(15000)
    expect(piorSobra).toBe(0) // existe caso exato (divisão inteira) — o teto não é folgado de graça
  })
})

// A semana final era a única janela sem ritmo, e é a que mais precisa dele: o
// Marco pediu o número explicitamente em 10/08/2026 — "é a informação que faz
// eu agir". Este describe INVERTE o que o arquivo afirmava até o PR #85 (lá,
// "menos de uma semana de venda: nenhum ritmo"), e essa inversão é o teste: se
// alguém restaurar a porta velha (`porSemana == null`) em `ritmoPorDia`, os
// quatro casos abaixo ficam vermelhos de uma vez.
describe('a semana final mostra o ritmo, em vez de calar', () => {
  // 280 faltando (84 de 364), olhado em 10/08/2026 — os números do print dele.
  const casos = [
    { dataEvento: '2026-08-16', dias: 6, porDia: 47 }, // ceil(280/6) = 46,66…
    { dataEvento: '2026-08-14', dias: 4, porDia: 70 }, // o caso da conversa
    { dataEvento: '2026-08-12', dias: 2, porDia: 140 },
    { dataEvento: '2026-08-11', dias: 1, porDia: 280 }, // véspera: tudo em um dia
  ]

  for (const c of casos) {
    it(`${c.dias} dia(s) até a festa → ${c.porDia} por dia`, () => {
      const r = ritmoVendas({ ...CASO_DO_MARCO, dataEvento: c.dataEvento })
      const d = ritmoPorDia(r)
      expect(d.diasVenda).toBe(c.dias)
      expect(d.porDia).toBe(c.porDia)
      // a promessa da frase vale aqui também, e é o que o teto garante
      expect(d.porDia * d.diasVenda).toBeGreaterThanOrEqual(r.faltam)
      expect(fraseRitmo(r)).toBe(
        `Faltam 280 ingressos em ${c.dias} dia(s) de venda → precisa vender ${c.porDia} por dia para cobrir o break-even (364).`
      )
      // o texto que a janela curta imprimia até aqui não sobrou em lugar nenhum
      expect(fraseRitmo(r)).not.toContain('menos de uma semana')
    })
  }
})

describe('o dia da festa tem texto próprio, no presente', () => {
  // A festa é HOJE: `ritmoVendas` devolve dias 0 (não é evento passado — o dia
  // não acabou), a janela de venda antecipada é zero e não há ritmo a mostrar.
  const r = ritmoVendas({ ...CASO_DO_MARCO, dataEvento: '2026-08-10' })

  it('não é evento passado, e a janela é zero', () => {
    expect(r.eventoPassado).toBe(false)
    expect(r.dias).toBe(0)
    expect(ritmoPorDia(r)).toBeNull()
  })

  it('a frase diz que a festa é hoje e quanto falta — sem falar em semana', () => {
    expect(fraseRitmo(r)).toBe(
      'A festa é hoje — faltam 280 ingressos para o break-even (364).'
    )
    expect(fraseRitmo(r)).not.toContain('semana')
    // presente, não passado: ainda pode entrar venda na porta
    expect(fraseRitmo(r)).not.toContain('já realizado')
  })
})

// A frase longa e as duas linhas curtas são superfícies DIFERENTES do mesmo
// número, e já divergiram nesta casa. Aqui elas são medidas juntas: a semana
// final não pode imprimir "70 por dia" no card e "última semana" na Home.
describe('as superfícies não divergem de unidade na semana final', () => {
  const HOJE = '2026-08-10'
  const eventoEm = (data) => ({ nome: 'Brisa #3', data, vendidosAteHoje: 84 })

  it('a 4 dias da festa, card, Home e relatório falam do MESMO ritmo por dia', () => {
    const ev = eventoEm('2026-08-14')
    const frase = fraseRitmo(ritmoVendas({ ...CASO_DO_MARCO, dataEvento: ev.data }))
    const home = linhaRitmoHome(ev, 364, HOJE)
    const relatorio = linhaRitmoRelatorio(ev, 364, HOJE)

    expect(frase).toContain('70 por dia')
    expect(home.texto).toBe('Faltam 280 p/ break-even · 70/dia')
    expect(relatorio).toContain('70 por dia')
    // nenhuma das três volta a falar em semana
    for (const t of [frase, home.texto, relatorio]) expect(t).not.toContain('semana')
  })

  it('no dia da festa, as três dizem que a festa é hoje — nenhuma diz "última semana"', () => {
    const ev = eventoEm(HOJE)
    const home = linhaRitmoHome(ev, 364, HOJE)
    const relatorio = linhaRitmoRelatorio(ev, 364, HOJE)

    expect(home.texto).toBe('Faltam 280 p/ break-even · a festa é hoje')
    expect(relatorio).toContain('A festa é hoje — faltam 280 ingressos')
    for (const t of [home.texto, relatorio]) expect(t).not.toContain('semana')
  })
})

describe('as portas de sempre continuam onde estavam', () => {
  it('venda que nem chega a abrir (início na data da festa): sem ritmo, e a nota explica', () => {
    // festa em 22/08 e vendas abrindo só em 22/08 → janela de venda ZERO com a
    // festa ainda no futuro. É o único caso que sobrou sem ritmo além do dia da
    // festa, e a frase não pode virar enigma.
    const r = ritmoVendas({ ...CASO_DO_MARCO, inicioVendas: '2026-08-22' })
    expect(r.dias).toBe(12)
    expect(ritmoPorDia(r)).toBeNull()
    expect(fraseRitmo(r)).toBe(
      'Faltam 280 ingressos para o break-even (364) e menos de um dia de venda (vendas abrem em 12 dia(s)).'
    )
  })

  it('break-even coberto: a frase do coberto, sem ritmo', () => {
    const r = ritmoVendas({ ...CASO_DO_MARCO, vendidos: 400 })
    expect(ritmoPorDia(r)).toBeNull()
    expect(fraseRitmo(r)).toContain('Break-even coberto')
  })

  it('festa já realizada: a marcação, sem ritmo', () => {
    const r = ritmoVendas({ ...CASO_DO_MARCO, dataEvento: '2026-08-01' })
    expect(ritmoPorDia(r)).toBeNull()
    expect(fraseRitmo(r)).toContain('já realizado')
  })

  it('vendas que ainda não abriram: a janela é a de venda REAL, e a nota fica', () => {
    // festa em 22/08, vendas abrem em 15/08 → 7 dias de venda, não 12
    const r = ritmoVendas({ ...CASO_DO_MARCO, inicioVendas: '2026-08-15' })
    const d = ritmoPorDia(r)
    expect(d.diasVenda).toBe(7)
    expect(d.porDia).toBe(40) // ceil(280 / 7)
    expect(fraseRitmo(r)).toContain('vendas abrem em 5 dia(s)')
    expect(d.porDia * d.diasVenda).toBeGreaterThanOrEqual(r.faltam)
  })

  it('sem resultado de ritmo (campo vazio, sem data): nada explode', () => {
    expect(ritmoPorDia(null)).toBeNull()
    expect(ritmoPorDia(undefined)).toBeNull()
    expect(fraseRitmo(null)).toBeNull()
  })
})
