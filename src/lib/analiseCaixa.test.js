// Sessão F2-C — aba Análise: a CONTA APROVADA pelo Marco (19/07/2026),
// testada função a função e conferida À MÃO num exemplo completo (abaixo).

import { describe, it, expect } from 'vitest'
import {
  saidasDoEvento,
  entradaAteODia,
  analisarCaixa,
  temAgendaDePagamento,
} from './analiseCaixa.js'
import { novoItem } from './defaults.js'

// ————— Evento do EXEMPLO CONFERIDO À MÃO —————
//
// Festa em 2026-08-29. Caixa inicial R$ 2.000. Patrocínio fechado R$ 3.000.
// Curva do plano (modo "pelas datas", esparsa): D-60 → R$ 0 · D-30 → R$ 10.000
// · D-0 → R$ 20.000 (retas entre os marcos).
// Custos:
//   Sinal do espaço  R$ 8.000  vence 2026-07-30 (D-30)
//   DJ               R$ 6.000  em 2 parcelas: 3.000 em 2026-08-14 (D-15)
//                                           e 3.000 em 2026-09-05 (D+7, PÓS-festa)
//   Gelo             R$ 1.000  SEM data (fora da linha do tempo, com aviso)
//
// CONTA À MÃO (saldo = 2.000 + entrada até o dia − saídas até o dia):
//   D-60 … D-31: entrada 0…(reta), sem saída.
//     D-45: entrada = 10.000 × (60−45)/30 = 5.000 → saldo 7.000
//   D-30: entrada 10.000; saída 8.000 (sinal) → saldo 2.000+10.000−8.000 = 4.000
//   D-29: entrada 10.000 + 10.000×(1/30) = 10.333,33… → saldo 4.333,33…
//   D-15: entrada 10.000 + 10.000×(15/30) = 15.000; saídas 8.000+3.000 = 11.000
//         → saldo 2.000+15.000−11.000 = 6.000
//   D-0:  entrada 20.000 + patrocínio 3.000 = 23.000; saídas 11.000
//         → saldo 2.000+23.000−11.000 = 14.000
//   Menor saldo da linha: D-60…D-31 a entrada cresce de 0 a ~9.666 sem saída
//         → menor é D-60: saldo 2.000 (caixa mínimo = R$ 2.000 em D-60).
//   Nunca negativo. Parcela 2 do DJ (D+7) fica FORA, listada como pós-festa.
//   Gelo sem data: FORA, com aviso.
const DATA_FESTA = '2026-08-29'
const eventoExemplo = () => ({
  id: 'ev-analise',
  nome: 'Brisa Exemplo',
  data: DATA_FESTA,
  caixaInicial: 2000,
  patrocinios: [
    { id: 'p1', patrocinador: 'Mirante', valor: 3000, estagio: 'confirmado' },
    { id: 'p2', patrocinador: 'Patrocinador A', valor: 5000, estagio: 'proposta' }, // NÃO entra
  ],
  categorias: [
    {
      id: 'locacao',
      nome: 'Locação & Documentação',
      itens: [
        novoItem({ id: 'sinal', servico: 'Sinal do espaço', estimado: 8000, dataPagamento: '2026-07-30' }),
      ],
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      itens: [
        novoItem({
          id: 'dj',
          servico: 'DJ',
          estimado: 6000,
          parcelas: [
            { id: 'dj1', valor: 3000, data: '2026-08-14' },
            { id: 'dj2', valor: 3000, data: '2026-09-05' },
          ],
        }),
      ],
    },
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [novoItem({ id: 'gelo', servico: 'Gelo', estimado: 1000 })],
    },
  ],
})
const PONTOS_PLANO = [
  { dia: -60, valor: 0 },
  { dia: -30, valor: 10000 },
  { dia: 0, valor: 20000 },
]

describe('saidasDoEvento', () => {
  it('separa com data × sem data; parcela vira uma saída cada; valor 0 não é saída', () => {
    const ev = eventoExemplo()
    ev.categorias[2].itens.push(novoItem({ servico: 'Zerado', estimado: 0, dataPagamento: '2026-08-01' }))
    const r = saidasDoEvento(ev)
    expect(r.saidas.map((s) => [s.rotulo, s.valor, s.data])).toEqual([
      ['Sinal do espaço', 8000, '2026-07-30'],
      ['DJ', 3000, '2026-08-14'],
      ['DJ', 3000, '2026-09-05'],
    ])
    expect(r.saidas[1].parcela).toEqual({ k: 1, n: 2 })
    expect(r.semData.map((s) => [s.rotulo, s.valor])).toEqual([['Gelo', 1000]])
    expect(r.divergencias).toEqual([])
  })

  it('parcelas divergentes do custo aparecem em divergencias (aviso, nunca silêncio)', () => {
    const ev = eventoExemplo()
    ev.categorias[1].itens[0].parcelas[1].valor = 3500 // soma 6.500 ≠ 6.000
    const r = saidasDoEvento(ev)
    expect(r.divergencias).toEqual([
      { rotulo: 'DJ', soma: 6500, valor: 6000, diferenca: 500 },
    ])
  })

  it('o valor da saída sem parcelas é o valorConsiderado (realizado vence)', () => {
    const ev = eventoExemplo()
    ev.categorias[0].itens[0].realizado = 7500
    const r = saidasDoEvento(ev)
    expect(r.saidas[0].valor).toBe(7500)
  })
})

describe('entradaAteODia — interpolação linear entre os pontos do plano', () => {
  it('nos marcos devolve o marco; entre marcos, a reta; fora, 0 ou o último', () => {
    expect(entradaAteODia(PONTOS_PLANO, -60)).toBe(0)
    expect(entradaAteODia(PONTOS_PLANO, -30)).toBe(10000)
    expect(entradaAteODia(PONTOS_PLANO, 0)).toBe(20000)
    // D-45: metade do caminho entre D-60 (0) e D-30 (10.000) → 5.000
    expect(entradaAteODia(PONTOS_PLANO, -45)).toBe(5000)
    // D-15: metade entre D-30 (10.000) e D-0 (20.000) → 15.000
    expect(entradaAteODia(PONTOS_PLANO, -15)).toBe(15000)
    expect(entradaAteODia(PONTOS_PLANO, -70)).toBe(0) // antes do primeiro
    expect(entradaAteODia(PONTOS_PLANO, 5)).toBe(20000) // depois do último
    expect(entradaAteODia([], -10)).toBe(0)
    expect(entradaAteODia(null, -10)).toBe(0)
  })
})

describe('analisarCaixa — o exemplo completo, conferido à mão', () => {
  const r = analisarCaixa(eventoExemplo(), PONTOS_PLANO)

  it('roda (ok) e a linha vai de D-60 a D-0', () => {
    expect(r.ok).toBe(true)
    expect(r.dias[0].dia).toBe(-60)
    expect(r.dias[r.dias.length - 1].dia).toBe(0)
    expect(r.dias).toHaveLength(61)
  })

  const saldoDe = (dia) => r.dias.find((d) => d.dia === dia).saldo

  it('D-45: saldo = 2.000 + 5.000 − 0 = 7.000 (conferido à mão)', () => {
    expect(saldoDe(-45)).toBeCloseTo(7000, 6)
  })
  it('D-30: saldo = 2.000 + 10.000 − 8.000 = 4.000 (sinal do espaço no dia)', () => {
    expect(saldoDe(-30)).toBeCloseTo(4000, 6)
  })
  it('D-29: saldo = 2.000 + 10.333,33 − 8.000 = 4.333,33 (reta entre marcos)', () => {
    expect(saldoDe(-29)).toBeCloseTo(2000 + 10000 + 10000 / 30 - 8000, 6)
  })
  it('D-15: saldo = 2.000 + 15.000 − 11.000 = 6.000 (parcela 1 do DJ em D-15)', () => {
    expect(saldoDe(-15)).toBeCloseTo(6000, 6)
  })
  it('D-0: saldo = 2.000 + 20.000 + 3.000 (patrocínio fechado no dia da festa) − 11.000 = 14.000', () => {
    expect(saldoDe(0)).toBeCloseTo(14000, 6)
    expect(r.saldoFesta).toBeCloseTo(14000, 6)
  })
  it('caixa mínimo para iniciar = menor saldo da linha = R$ 2.000 em D-60', () => {
    expect(r.caixaMinimo.dia).toBe(-60)
    expect(r.caixaMinimo.saldo).toBeCloseTo(2000, 6)
  })
  it('nunca fica negativo neste exemplo', () => {
    expect(r.primeiroNegativo).toBeNull()
  })
  it('proposta NÃO entra: só o patrocínio fechado (3.000)', () => {
    expect(r.patrocinioFechado).toBe(3000)
  })
  it('parcela pós-festa (DJ 2/2 em D+7) fica fora da linha, listada à parte', () => {
    expect(r.posFesta.map((s) => [s.rotulo, s.dia, s.valor])).toEqual([['DJ', 7, 3000]])
    expect(r.totalSaidas).toBeCloseTo(11000, 6)
  })
  it('custo sem data fica fora, com aviso de quantos são', () => {
    expect(r.semData.map((s) => s.rotulo)).toEqual(['Gelo'])
  })
  it('agenda ordenada por dia, cada vencimento com o saldo do próprio dia', () => {
    expect(r.agenda.map((s) => [s.rotulo, s.dia])).toEqual([
      ['Sinal do espaço', -30],
      ['DJ', -15],
    ])
    expect(r.agenda[0].saldoNoDia).toBeCloseTo(4000, 6)
    expect(r.agenda[1].saldoNoDia).toBeCloseTo(6000, 6)
    expect(r.agenda[1].parcela).toEqual({ k: 1, n: 2 })
  })
  it('totais: entrada final 23.000 (curva 20.000 + patrocínio 3.000), saída 11.000', () => {
    expect(r.totalEntradas).toBeCloseTo(23000, 6)
    expect(r.totalSaidas).toBeCloseTo(11000, 6)
  })
})

describe('analisarCaixa — casos de borda', () => {
  it('fica negativo quando a saída vence antes da venda: primeiroNegativo aponta o dia', () => {
    const ev = eventoExemplo()
    ev.caixaInicial = '' // padrão R$ 0 da conta aprovada
    ev.patrocinios = []
    // sinal de 8.000 em D-30, quando só entrou 10.000... vamos apertar: sinal 12.000
    ev.categorias[0].itens[0].estimado = 12000
    const r = analisarCaixa(ev, PONTOS_PLANO)
    // D-30: 0 + 10.000 − 12.000 = −2.000 → primeiro negativo
    expect(r.primeiroNegativo.dia).toBe(-30)
    expect(r.primeiroNegativo.saldo).toBeCloseTo(-2000, 6)
    // caixa mínimo = o ponto mais fundo (D-30; depois a entrada recupera)
    expect(r.caixaMinimo.saldo).toBeCloseTo(-2000, 6)
    // "quanto caixa precisamos para iniciar" = |menor saldo| quando negativo
  })

  it('caixaInicial vazio = R$ 0 (padrão da conta aprovada); string numérica vale', () => {
    const ev = eventoExemplo()
    ev.caixaInicial = ''
    expect(analisarCaixa(ev, PONTOS_PLANO).dias[0].saldo).toBeCloseTo(0, 6)
    ev.caixaInicial = '1500.5'
    expect(analisarCaixa(ev, PONTOS_PLANO).dias[0].saldo).toBeCloseTo(1500.5, 6)
  })

  it('saída antes de D-60 estica a linha do tempo (nada some)', () => {
    const ev = eventoExemplo()
    ev.categorias[0].itens[0].dataPagamento = '2026-05-01' // D-120
    const r = analisarCaixa(ev, PONTOS_PLANO)
    expect(r.dias[0].dia).toBe(-120)
    expect(r.dias.find((d) => d.dia === -120).saldo).toBeCloseTo(2000 - 8000, 6)
    expect(r.caixaMinimo.dia).toBe(-120)
  })

  it('sem data do evento → { ok:false, motivo }', () => {
    const ev = eventoExemplo()
    ev.data = ''
    expect(analisarCaixa(ev, PONTOS_PLANO)).toEqual({ ok: false, motivo: 'sem-data-evento' })
  })

  it('sem curva do plano → { ok:false, motivo } (a conta precisa da entrada)', () => {
    expect(analisarCaixa(eventoExemplo(), null)).toEqual({ ok: false, motivo: 'sem-plano' })
    expect(analisarCaixa(eventoExemplo(), [])).toEqual({ ok: false, motivo: 'sem-plano' })
  })

  it('data de pagamento ilegível vira "sem data" (nunca some em silêncio)', () => {
    const ev = eventoExemplo()
    ev.categorias[0].itens[0].dataPagamento = 'data-torta'
    const r = analisarCaixa(ev, PONTOS_PLANO)
    expect(r.semData.map((s) => s.rotulo).sort()).toEqual(['Gelo', 'Sinal do espaço'])
    expect(r.totalSaidas).toBeCloseTo(3000, 6) // só a parcela 1 do DJ
  })

  it('divergência de parcelas do evento aparece no resultado', () => {
    const ev = eventoExemplo()
    ev.categorias[1].itens[0].parcelas[0].valor = 4000
    const r = analisarCaixa(ev, PONTOS_PLANO)
    expect(r.divergencias).toHaveLength(1)
    expect(r.divergencias[0].rotulo).toBe('DJ')
  })
})

describe('temAgendaDePagamento', () => {
  it('true com data única ou parcelas; false sem nada', () => {
    expect(temAgendaDePagamento(eventoExemplo())).toBe(true)
    const ev = eventoExemplo()
    for (const c of ev.categorias)
      for (const i of c.itens) {
        i.dataPagamento = ''
        i.parcelas = []
      }
    expect(temAgendaDePagamento(ev)).toBe(false)
  })
})

describe('início de vendas (Sessão F2-S — antes do início só há saídas)', () => {
  it('saída antes do início derruba o saldo SEM entrada — o "caixa mínimo para iniciar" fica verdadeiro', () => {
    // plano da F2-S: 0 até a véspera do início (D-30), depois sobe até 20.000
    const pontos = [
      { dia: -60, valor: 0 },
      { dia: -31, valor: 0 },
      { dia: -30, valor: 2000 },
      { dia: 0, valor: 20000 },
    ]
    // sinal do espaço vence em 03/08 = D-40 (antes de abrir as vendas)
    const evento = {
      data: '2026-09-12',
      caixaInicial: '',
      categorias: [
        {
          nome: 'Locação & Documentação',
          itens: [
            { id: 'c1', servico: 'Sinal do espaço', estimado: 5000, realizado: '', status: 'FECHADO', dataPagamento: '2026-08-03', parcelas: [] },
          ],
        },
      ],
    }
    const a = analisarCaixa(evento, pontos)
    expect(a.ok).toBe(true)
    const d40 = a.dias.find((d) => d.dia === -40)
    expect(d40.entrada).toBe(0) // antes do início o plano não gera entrada
    expect(d40.saldo).toBe(-5000) // só a saída conta
    expect(a.caixaMinimo).toEqual({ dia: -40, saldo: -5000 })
    expect(a.primeiroNegativo).toEqual({ dia: -40, saldo: -5000 })
    // no dia da festa a entrada do plano cobre: 20.000 − 5.000 = 15.000
    expect(a.saldoFesta).toBe(15000)
  })
})

describe('parcela PAGA — sugestão 38, Interpretação A (fluxo quitado sai da linha do tempo)', () => {
  // O MESMO exemplo conferido à mão, com a parcela 1 do DJ (D-15, R$ 3.000)
  // marcada como paga. Conta à mão do que MUDA (e só disso):
  //   saídas na linha: só o sinal (8.000) — a parcela paga não é mais "a vencer"
  //   D-15: saldo = 2.000 + 15.000 − 8.000 = 9.000  (antes: 6.000)
  //   D-0:  saldo = 2.000 + 23.000 − 8.000 = 17.000 (antes: 14.000)
  //   totalSaidas = 8.000 (antes: 11.000)
  // E o que NÃO muda: caixa mínimo (D-60, R$ 2.000), semData (Gelo),
  // posFesta (DJ 2/2), divergências (nenhuma) — a fórmula é a mesma,
  // muda só QUAIS saídas entram.
  const eventoComPaga = () => {
    const ev = eventoExemplo()
    ev.categorias[1].itens[0].parcelas[0] = {
      ...ev.categorias[1].itens[0].parcelas[0],
      paga: true,
      dataPaga: '2026-08-10',
    }
    return ev
  }

  it('saidasDoEvento: a parcela paga sai de `saidas` e entra em `pagas` (nunca some)', () => {
    const r = saidasDoEvento(eventoComPaga())
    expect(r.saidas.map((s) => [s.rotulo, s.valor, s.data])).toEqual([
      ['Sinal do espaço', 8000, '2026-07-30'],
      ['DJ', 3000, '2026-09-05'],
    ])
    expect(r.pagas).toHaveLength(1)
    expect(r.pagas[0]).toMatchObject({
      rotulo: 'DJ',
      valor: 3000,
      dataPaga: '2026-08-10',
      parcela: { k: 1, n: 2 },
    })
    expect(r.semData.map((s) => s.rotulo)).toEqual(['Gelo']) // intocado
  })

  it('a linha do tempo fica exata: D-15 sobe a 9.000, festa a 17.000, saídas 8.000 (conta à mão)', () => {
    const r = analisarCaixa(eventoComPaga(), PONTOS_PLANO)
    const saldoDe = (dia) => r.dias.find((d) => d.dia === dia).saldo
    expect(saldoDe(-15)).toBeCloseTo(9000, 6)
    expect(r.saldoFesta).toBeCloseTo(17000, 6)
    expect(r.totalSaidas).toBeCloseTo(8000, 6)
    // a agenda "a vencer" só tem o sinal; a quitada aparece em `pagas`
    expect(r.agenda.map((s) => s.rotulo)).toEqual(['Sinal do espaço'])
    expect(r.pagas.map((s) => [s.rotulo, s.dataPaga])).toEqual([['DJ', '2026-08-10']])
    // o que NÃO muda
    expect(r.caixaMinimo).toEqual({ dia: -60, saldo: 2000 })
    expect(r.semData.map((s) => s.rotulo)).toEqual(['Gelo'])
    expect(r.posFesta.map((s) => s.rotulo)).toEqual(['DJ'])
    expect(r.divergencias).toEqual([])
  })

  it('parcela paga SEM data de vencimento é quitada, não "sem data" (quitada não deve data)', () => {
    const ev = eventoComPaga()
    ev.categorias[1].itens[0].parcelas[0].data = ''
    const r = analisarCaixa(ev, PONTOS_PLANO)
    expect(r.pagas.map((s) => s.rotulo)).toEqual(['DJ'])
    expect(r.semData.map((s) => s.rotulo)).toEqual(['Gelo'])
  })

  it('REVERSÍVEL: desmarcar (paga false + dataPaga \'\') devolve a análise byte a byte', () => {
    const ev = eventoComPaga()
    ev.categorias[1].itens[0].parcelas[0].paga = false
    ev.categorias[1].itens[0].parcelas[0].dataPaga = ''
    expect(JSON.stringify(analisarCaixa(ev, PONTOS_PLANO))).toBe(
      JSON.stringify(analisarCaixa(eventoExemplo(), PONTOS_PLANO))
    )
  })

  it('o realizado do custo permanece INTOCADO — pagar parcela não fecha custo', () => {
    const ev = eventoComPaga()
    analisarCaixa(ev, PONTOS_PLANO)
    // novoItem nasce com realizado '' — segue '' depois de pagar e analisar
    expect(ev.categorias[1].itens[0].realizado).toBe('')
  })
})

// P2: produtor histórico corrigido, mesma conta de caixa aprovada.
import { mediaHistorica, mediaHistoricaNormalizada, curvaPlanoForma, curvaPlanoJanela } from './curvaVendas.js'
describe('P2 S3 — cachê acima da receita nunca fica coberto por estorno', () => {
  it.each(['forma', 'janela'])('%s: pico e final 200 mil; caixa/agenda -20 mil em D-11', modo => {
    const curva = { eventos: [{ id: 7, nome: 'Brisa sintética', data: '2026-05-01', totalValor: 80000, dias: [{ dia: -11, valor: 100000 }, { dia: -10, valor: -20000 }] }] }
    const e = { data: '2026-09-09', caixaInicial: 0, lotes: [{ id: 'l', quantidade: 1000, valor: 200 }], categorias: [{ id: 'artistico', nome: 'Artístico', itens: [novoItem({ servico: 'Cachê sintético', estimado: 220000, dataPagamento: '2026-08-29' })] }] }
    const opts = { hoje: '2026-08-10' }
    const p = modo === 'forma' ? curvaPlanoForma(e, mediaHistorica(curva, opts)) : curvaPlanoJanela(e, mediaHistoricaNormalizada(curva, opts), -11)
    expect.soft(Math.max(...p.pontos.map(p => p.valor))).toBe(200000)
    expect.soft(p.pontos.at(-1).valor).toBe(200000)
    const caixa = analisarCaixa(e, p.pontos)
    expect.soft(caixa.dias.find(d => d.dia === -11).saldo).toBe(-20000)
    expect.soft(caixa.agenda[0].saldoNoDia).toBe(-20000)
    expect.soft(caixa.primeiroNegativo.saldo).toBe(-20000)
  })
})

describe('S3 adendo — consumidor une marcos antigos antes da interpolação', () => {
  const pontos = Object.freeze([{dia:-60,valor:0},{dia:-30,valor:10000},{dia:-30,valor:25000},{dia:0,valor:25000}].map(Object.freeze))
  it.each([[-61,0],[-45,12500],[-31,25000*29/30],[-30,25000],[-29,25000],[0,25000],[1,25000]])('dia %s: entrada %s', (dia,valor) => {
    expect(entradaAteODia(pontos,dia)).toBeCloseTo(valor,9)
    expect(pontos.map(p=>p.valor)).toEqual([0,10000,25000,25000])
  })
  it.each([-60,-122])('antes e no primeiro marco duplicado D%s', dia => {
    const p=[{dia,valor:0},{dia,valor:25000},{dia:0,valor:25000}]
    expect(entradaAteODia(p,dia-1)).toBe(0); expect(entradaAteODia(p,dia)).toBe(25000)
  })
  it('cachê de 30 mil deixa mínimo, agenda e final em menos 5 mil', () => {
    const e={data:'2026-09-09',categorias:[{nome:'Artístico',itens:[novoItem({servico:'Cachê',estimado:30000,dataPagamento:'2026-08-10'})]}]}
    const c=analisarCaixa(e,pontos)
    expect(c.caixaMinimo).toEqual({dia:-30,saldo:-5000})
    expect(c.agenda[0].saldoNoDia).toBe(-5000); expect(c.saldoFesta).toBe(-5000)
  })
})
