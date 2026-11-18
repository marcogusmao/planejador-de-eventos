// Testes do módulo da curva de vendas (Sessão F2-B — sugestão 14).
// Bloco 1: validação do contrato da rota, fetch injetável, cache e acumulação.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  validarCurvaFinanceiro,
  buscarCurvaFinanceiro,
  acumularDias,
  acumuladoAteODia,
  diaRelativoHoje,
  eventoCurvaVinculado,
  mediaHistorica,
  totalPlanoLotes,
  lotesDoPlano,
  curvaPlanoForma,
  curvaPlanoDatas,
  consolidarPontosDoPlano,
  modoCurva,
  inicioVendasEfetivo,
  janelaHistoricaDias,
  mediaHistoricaNormalizada,
  fracaoNormalizada,
  curvaPlanoJanela,
  avisoJanelaCurta,
  referenciaCurva,
  refIdsDaCurva,
  festasPassadasDisponiveis,
  rotuloReferencia,
  URL_CURVA,
  addDiasISO,
} from './curvaVendas.js'
import { migrarEvento } from './migracao.js'
import { MSG_FINANCEIRO_FECHADO, MSG_RESPOSTA_ESTRANHA } from './financeiro.js'

// Resposta no formato EXATO do contrato (item 15 do BACKLOG do Financeiro).
const respostaValida = () => ({
  eventos: [
    {
      evento_id: 7,
      nome: 'Brisa 05/12',
      data: '2025-12-05',
      status: 'realizado',
      empresa_id: 2,
      empresa: 'Brisa',
      total_pagamentos: 5,
      total_valor: 550,
      dias: [
        { dia: -30, pagamentos: 2, valor: 200 },
        { dia: -10, pagamentos: 2, valor: 250 },
        { dia: 0, pagamentos: 1, valor: 100 },
      ],
    },
    {
      evento_id: 9,
      nome: 'Marfim 09/05',
      data: '2026-05-09',
      status: 'realizado',
      empresa_id: 1,
      empresa: 'Marfim Alto',
      total_pagamentos: 0,
      total_valor: 0,
      dias: [],
    },
  ],
  eventos_sem_data: [{ evento_id: 12, nome: 'Evento da sync', empresa: 'Brisa' }],
})

describe('validarCurvaFinanceiro', () => {
  it('normaliza a resposta válida do contrato', () => {
    const c = validarCurvaFinanceiro(respostaValida())
    expect(c).not.toBeNull()
    expect(c.eventos).toHaveLength(2)
    expect(c.eventos[0]).toMatchObject({
      id: 7,
      nome: 'Brisa 05/12',
      empresa: 'Brisa',
      totalPagamentos: 5,
      totalValor: 550,
    })
    expect(c.eventos[0].dias).toEqual([
      { dia: -30, pagamentos: 2, valor: 200 },
      { dia: -10, pagamentos: 2, valor: 250 },
      { dia: 0, pagamentos: 1, valor: 100 },
    ])
    expect(c.eventos[1].dias).toEqual([]) // evento sem venda vem com dias: []
    expect(c.eventosSemData).toEqual([{ id: 12, nome: 'Evento da sync', empresa: 'Brisa' }])
  })

  it('ordena dias fora de ordem (defesa barata; o contrato promete ordenado)', () => {
    const r = respostaValida()
    r.eventos[0].dias = [
      { dia: 0, pagamentos: 1, valor: 100 },
      { dia: -30, pagamentos: 2, valor: 200 },
    ]
    const c = validarCurvaFinanceiro(r)
    expect(c.eventos[0].dias.map((d) => d.dia)).toEqual([-30, 0])
  })

  it.each([
    ['null', null],
    ['sem eventos', {}],
    ['eventos não-array', { eventos: 1, eventos_sem_data: [] }],
    ['sem eventos_sem_data', { eventos: [] }],
    ['evento sem id', { eventos: [{ nome: 'x', dias: [] }], eventos_sem_data: [] }],
    ['evento sem dias', { eventos: [{ evento_id: 1, nome: 'x' }], eventos_sem_data: [] }],
    [
      'dia não numérico',
      {
        eventos: [{ evento_id: 1, nome: 'x', dias: [{ dia: 'amanhã', pagamentos: 1, valor: 1 }] }],
        eventos_sem_data: [],
      },
    ],
  ])('rejeita formato irreconhecível (%s) devolvendo null', (_rotulo, dados) => {
    expect(validarCurvaFinanceiro(dados)).toBeNull()
  })
})

describe('buscarCurvaFinanceiro (fetch injetável — mesmo regime da ponte)', () => {
  it('busca na URL da rota irmã e devolve a curva normalizada', async () => {
    let urlChamada = null
    const fake = async (url) => {
      urlChamada = url
      return { ok: true, json: async () => respostaValida() }
    }
    const c = await buscarCurvaFinanceiro(fake)
    expect(urlChamada).toBe(URL_CURVA)
    expect(URL_CURVA).toBe('http://localhost:8777/api/previsao/curva') // único destino permitido
    expect(c.eventos).toHaveLength(2)
  })

  it('Financeiro fechado (fetch lança) → mensagem em português da ponte', async () => {
    const fake = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(buscarCurvaFinanceiro(fake)).rejects.toThrow(MSG_FINANCEIRO_FECHADO)
  })

  it('HTTP 404 (Financeiro aberto numa versão antiga) → mensagem que explica o reabrir', async () => {
    const fake = async () => ({ ok: false, status: 404 })
    await expect(buscarCurvaFinanceiro(fake)).rejects.toThrow(/HTTP 404.*feche e reabra o Financeiro/s)
  })

  it('HTTP 500 → mensagem de erro com o status', async () => {
    const fake = async () => ({ ok: false, status: 500 })
    await expect(buscarCurvaFinanceiro(fake)).rejects.toThrow(/HTTP 500/)
  })

  it('JSON inválido ou formato estranho → MSG_RESPOSTA_ESTRANHA (nunca dado torto na tela)', async () => {
    const quebrado = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('x')
      },
    })
    await expect(buscarCurvaFinanceiro(quebrado)).rejects.toThrow(MSG_RESPOSTA_ESTRANHA)
    const estranho = async () => ({ ok: true, json: async () => ({ outra: 'coisa' }) })
    await expect(buscarCurvaFinanceiro(estranho)).rejects.toThrow(MSG_RESPOSTA_ESTRANHA)
  })
})

describe('acumularDias / acumuladoAteODia', () => {
  const dias = [
    { dia: -30, pagamentos: 2, valor: 200 },
    { dia: -10, pagamentos: 2, valor: 250 },
    { dia: 0, pagamentos: 1, valor: 100 },
  ]

  it('acumula pagamentos e valor na ordem dos dias', () => {
    expect(acumularDias(dias)).toEqual([
      { dia: -30, pagamentosAcum: 2, valorAcum: 200 },
      { dia: -10, pagamentosAcum: 4, valorAcum: 450 },
      { dia: 0, pagamentosAcum: 5, valorAcum: 550 },
    ])
  })

  it('lista vazia acumula vazio (evento sem venda não desenha curva)', () => {
    expect(acumularDias([])).toEqual([])
    expect(acumularDias(undefined)).toEqual([])
  })

  it('acumuladoAteODia soma só até o dia (inclusive), mesmo sem venda no dia exato', () => {
    expect(acumuladoAteODia(dias, -11)).toEqual({ pagamentos: 2, valor: 200 })
    expect(acumuladoAteODia(dias, -10)).toEqual({ pagamentos: 4, valor: 450 })
    expect(acumuladoAteODia(dias, 5)).toEqual({ pagamentos: 5, valor: 550 })
    expect(acumuladoAteODia(dias, -60)).toEqual({ pagamentos: 0, valor: 0 })
  })
})

describe('diaRelativoHoje', () => {
  it('negativo antes da festa, 0 no dia, positivo depois', () => {
    expect(diaRelativoHoje('2026-08-01', '2026-07-18')).toBe(-14)
    expect(diaRelativoHoje('2026-08-01', '2026-08-01')).toBe(0)
    expect(diaRelativoHoje('2026-08-01', '2026-08-03')).toBe(2)
  })
  it('sem data → null (a leitura simplesmente não aparece)', () => {
    expect(diaRelativoHoje('', '2026-07-18')).toBeNull()
    expect(diaRelativoHoje('2026-08-01', '')).toBeNull()
    expect(diaRelativoHoje('data-torta', '2026-07-18')).toBeNull()
  })
})

describe('mediaHistorica (bloco 2 — média por tipo de festa)', () => {
  // Duas Brisas passadas com contas fáceis de conferir à mão + uma Marfim
  // passada + uma Brisa futura (não pode entrar) + uma sem venda.
  const curva = {
    eventos: [
      {
        id: 1,
        nome: 'Brisa A',
        data: '2026-04-11',
        empresa: 'Brisa',
        totalValor: 400,
        dias: [
          { dia: -40, pagamentos: 1, valor: 100 },
          { dia: -20, pagamentos: 1, valor: 100 },
          { dia: 0, pagamentos: 1, valor: 200 },
        ],
      },
      {
        id: 2,
        nome: 'Brisa B',
        data: '2026-02-07',
        empresa: 'Brisa',
        // 100 de venda pós-festa: a fração NÃO chega a 1,0 no dia 0 — honesto
        totalValor: 400,
        dias: [
          { dia: -10, pagamentos: 1, valor: 300 },
          { dia: 5, pagamentos: 1, valor: 100 },
        ],
      },
      {
        id: 3,
        nome: 'Marfim passada',
        data: '2025-11-15',
        empresa: 'Marfim Alto',
        totalValor: 1000,
        dias: [{ dia: -5, pagamentos: 1, valor: 1000 }],
      },
      {
        id: 4,
        nome: 'Brisa futura',
        data: '2026-08-29',
        empresa: 'Brisa',
        totalValor: 500,
        dias: [{ dia: -42, pagamentos: 1, valor: 500 }],
      },
      {
        id: 5,
        nome: 'Brisa sem venda',
        data: '2026-01-10',
        empresa: 'Brisa',
        totalValor: 0,
        dias: [],
      },
    ],
    eventosSemData: [],
  }
  const hoje = '2026-07-18'
  const fracaoNoDia = (m, dia) => m.pontos.find((p) => p.dia === dia)?.fracao

  it('média do tipo: só Brisas passadas com venda, frações conferidas à mão', () => {
    const m = mediaHistorica(curva, { tipo: 'Brisa', hoje })
    expect(m.base).toBe('tipo')
    expect(m.nEventos).toBe(2)
    expect(m.nomes).toEqual(['Brisa A', 'Brisa B'])
    // D-60: ninguém vendeu → 0
    expect(fracaoNoDia(m, -60)).toBe(0)
    // D-20: A = 200/400 = 0,5 · B = 0 → média 0,25
    expect(fracaoNoDia(m, -20)).toBeCloseTo(0.25, 10)
    // D-10: A = 0,5 · B = 300/400 = 0,75 → média 0,625
    expect(fracaoNoDia(m, -10)).toBeCloseTo(0.625, 10)
    // D-0: A = 1,0 · B = 0,75 (100 entram pós-festa) → média 0,875
    expect(fracaoNoDia(m, 0)).toBeCloseTo(0.875, 10)
    // régua começa em D-60 (formato do Marco) e termina no dia da festa
    expect(m.pontos[0].dia).toBe(-60)
    expect(m.pontos[m.pontos.length - 1].dia).toBe(0)
  })

  it('sem festas passadas do tipo → média geral, dita pela base', () => {
    const m = mediaHistorica(curva, { tipo: 'Sobrado', hoje })
    expect(m.base).toBe('geral')
    expect(m.nEventos).toBe(3) // Brisa A + Brisa B + Marfim passada
  })

  it('sem tipo, usa a empresa do vínculo; sem nada, média geral', () => {
    const porVinculo = mediaHistorica(curva, { tipo: '', empresaVinculo: 'Brisa', hoje })
    expect(porVinculo.base).toBe('tipo')
    expect(porVinculo.nEventos).toBe(2)
    const geral = mediaHistorica(curva, { tipo: '', hoje })
    expect(geral.base).toBe('geral')
  })

  it('exclui o próprio evento vinculado (não se compara consigo mesmo)', () => {
    const m = mediaHistorica(curva, { tipo: 'Brisa', hoje, excluirEventoId: 1 })
    expect(m.nEventos).toBe(1)
    expect(m.nomes).toEqual(['Brisa B'])
  })

  it('venda antes de D-60 estica a régua para trás', () => {
    const c2 = {
      eventos: [
        {
          id: 9,
          nome: 'Longa',
          data: '2026-01-01',
          empresa: 'Brisa',
          totalValor: 100,
          dias: [{ dia: -75, pagamentos: 1, valor: 100 }],
        },
      ],
      eventosSemData: [],
    }
    const m = mediaHistorica(c2, { tipo: 'Brisa', hoje })
    expect(m.pontos[0].dia).toBe(-75)
    expect(fracaoNoDia(m, -75)).toBeCloseTo(1, 10)
  })

  it('nenhuma festa passada → null (a tela explica em vez de inventar)', () => {
    expect(mediaHistorica({ eventos: [], eventosSemData: [] }, { tipo: 'Brisa', hoje })).toBeNull()
    expect(mediaHistorica(null, { tipo: 'Brisa', hoje })).toBeNull()
    // só a futura e a sem venda: nada entra
    const soFuturas = { eventos: [curva.eventos[3], curva.eventos[4]], eventosSemData: [] }
    expect(mediaHistorica(soFuturas, { tipo: 'Brisa', hoje })).toBeNull()
  })
})

describe('totalPlanoLotes', () => {
  const lotes = [
    { id: 'a', nome: 'Promo', valor: 50, quantidade: 100 },
    { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120 },
    { id: 'c', nome: 'Lote 2', valor: 80, quantidade: 150 },
    { id: 'd', nome: 'Cortesia', valor: 0, quantidade: 30 }, // não é venda
    { id: 'e', nome: 'Vazio', valor: '', quantidade: '' },
  ]
  it('Σ qtd × preço, sem cortesias nem lotes vazios (conferido à mão)', () => {
    // 100×50 + 120×60 + 150×80 = 5.000 + 7.200 + 12.000 = 24.200
    expect(totalPlanoLotes({ lotes })).toBe(24200)
  })
  it('desconto médio entra na régua (realizado da Tiqueteira é líquido de cupom)', () => {
    expect(totalPlanoLotes({ lotes, descontoMedioPct: 10 })).toBeCloseTo(21780, 10)
  })
  it('sem lotes → 0', () => {
    expect(totalPlanoLotes({})).toBe(0)
    expect(totalPlanoLotes({ lotes: [] })).toBe(0)
  })
  // Sugestão 29a: o plano usa o desconto EFETIVO (cupom × fração). Vendidos
  // do plano = 100 + 120 + 150 = 370 (cortesia e vazio não são venda).
  it('29a — campos novos vazios/neutros: régua idêntica à legada (cupom em todos)', () => {
    expect(
      totalPlanoLotes({ lotes, descontoMedioPct: 10, descontoIngressosModo: '', descontoIngressosValor: '' })
    ).toBe(totalPlanoLotes({ lotes, descontoMedioPct: 10 }))
    expect(
      totalPlanoLotes({ lotes, descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 100 })
    ).toBe(totalPlanoLotes({ lotes, descontoMedioPct: 10 }))
  })
  it('29a — modo %: cupom 10 em 40% → efetivo 4% → 24.200 × 0,96 = 23.232', () => {
    expect(
      totalPlanoLotes({ lotes, descontoMedioPct: 10, descontoIngressosModo: 'pct', descontoIngressosValor: 40 })
    ).toBeCloseTo(23232, 10)
  })
  it('29a — modo nº usa os vendidos do PLANO completo: 185 de 370 → fração 50% → efetivo 5% → 22.990', () => {
    expect(
      totalPlanoLotes({ lotes, descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: 185 })
    ).toBeCloseTo(22990, 10)
    // e lotesDoPlano fecha na MESMA régua (acumulada final = total)
    const plano = lotesDoPlano({
      lotes,
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 185,
    })
    expect(plano[plano.length - 1].acumulada).toBeCloseTo(22990, 10)
  })
})

describe('eventoCurvaVinculado', () => {
  const curva = validarCurvaFinanceiro(respostaValida())
  it('acha o evento da curva pelo vínculo da Sessão H', () => {
    const evento = { financeiro: { eventoId: 7 } }
    expect(eventoCurvaVinculado(curva, evento)?.nome).toBe('Brisa 05/12')
  })
  it('sem vínculo (ou vínculo sem par na curva) → null', () => {
    expect(eventoCurvaVinculado(curva, { financeiro: null })).toBeNull()
    expect(eventoCurvaVinculado(curva, {})).toBeNull()
    expect(eventoCurvaVinculado(curva, { financeiro: { eventoId: 999 } })).toBeNull()
  })
})

// ————— Bloco 3: plano com DOIS modos (decisão do Marco, 19/07/2026) —————

const eventoComLotes = (extra = {}, lotesExtra) => ({
  data: '2026-08-29',
  lotes: lotesExtra || [
    { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '' },
    { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120, viradaPrevista: '' },
    { id: 'c', nome: 'Lote 2', valor: 80, quantidade: 150, viradaPrevista: '' },
    { id: 'd', nome: 'Cortesia', valor: 0, quantidade: 30, viradaPrevista: '' },
  ],
  ...extra,
})

// média sintética simples: 0 em D-60, 0,4 em D-30, 0,8 em D-10, 1,0 em D-0
const mediaSintetica = () => {
  const pontos = []
  for (let dia = -60; dia <= 0; dia++) {
    const fracao = dia <= -30 ? ((dia + 60) / 30) * 0.4 : dia <= -10 ? 0.4 + ((dia + 30) / 20) * 0.4 : 0.8 + ((dia + 10) / 10) * 0.2
    pontos.push({ dia, fracao })
  }
  return { pontos, base: 'tipo', chave: 'Brisa', nEventos: 2, nomes: ['A', 'B'] }
}

describe('lotesDoPlano', () => {
  it('ordem da tabela, acumulada certa, cortesia fora', () => {
    const lotes = lotesDoPlano(eventoComLotes())
    expect(lotes.map((l) => l.nome)).toEqual(['Promo', 'Lote 1', 'Lote 2'])
    expect(lotes[2].acumulada).toBe(24200)
  })
})

describe('curvaPlanoForma (modo 1 — pela forma histórica)', () => {
  it('escala a forma ao total do plano e termina EXATAMENTE no total', () => {
    const r = curvaPlanoForma(eventoComLotes(), mediaSintetica())
    expect(r.total).toBe(24200)
    expect(r.pontos[r.pontos.length - 1]).toEqual({ dia: 0, valor: 24200 })
    // D-30: 0,4 × 24.200 = 9.680 (conferido à mão)
    expect(r.pontos.find((p) => p.dia === -30).valor).toBeCloseTo(9680, 6)
  })

  it('deriva a virada de cada lote pelo ritmo histórico', () => {
    const r = curvaPlanoForma(eventoComLotes(), mediaSintetica())
    // Promo esgota em 5.000/24.200 = 20,66%; forma = 0,4×(d+60)/30 nos dias
    // inteiros: D-45 dá 0,2000 (< alvo) e D-44 dá 0,2133 (≥ alvo) → D-44
    const vPromo = r.viradas.find((v) => v.nome === 'Promo')
    expect(vPromo.dia).toBe(-44)
    // último lote vira no dia da festa (forma chega a 100% em D-0)
    expect(r.viradas[r.viradas.length - 1].dia).toBe(0)
  })

  it('média que não chega a 100% no dia é normalizada (o plano vende tudo até a festa)', () => {
    const media = mediaSintetica()
    media.pontos = media.pontos.map((p) => ({ ...p, fracao: p.fracao * 0.875 }))
    const r = curvaPlanoForma(eventoComLotes(), media)
    expect(r.pontos[r.pontos.length - 1].valor).toBeCloseTo(24200, 6)
  })

  it('sem média ou sem lotes → null (a tela explica; nada inventado)', () => {
    expect(curvaPlanoForma(eventoComLotes(), null)).toBeNull()
    expect(curvaPlanoForma({ lotes: [] }, mediaSintetica())).toBeNull()
  })
})

describe('curvaPlanoDatas (modo 2 — pelas datas dos lotes)', () => {
  const comViradas = () =>
    eventoComLotes({}, [
      { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '2026-07-30' }, // D-30
      { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120, viradaPrevista: '2026-08-19' }, // D-10
      { id: 'c', nome: 'Lote 2', valor: 80, quantidade: 150, viradaPrevista: '' }, // até a festa
    ])

  it('marcos nos dias das viradas, fechando o total no dia da festa', () => {
    const r = curvaPlanoDatas(comViradas())
    expect(r.pontos).toEqual([
      { dia: -60, valor: 0 },
      { dia: -30, valor: 5000 },
      { dia: -10, valor: 12200 },
      { dia: 0, valor: 24200 },
    ])
    expect(r.avisos).toEqual([
      '“Lote 2” está sem virada prevista — entrou na reta até o dia da festa.',
    ])
  })

  it('lote sem data NO MEIO entra na reta até a virada seguinte, com aviso nomeando', () => {
    const ev = eventoComLotes({}, [
      { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '' },
      { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120, viradaPrevista: '2026-08-19' },
      { id: 'c', nome: 'Lote 2', valor: 80, quantidade: 150, viradaPrevista: '' },
    ])
    const r = curvaPlanoDatas(ev)
    // no D-10 o acumulado inclui Promo + Lote 1 (Promo foi absorvido)
    expect(r.pontos).toEqual([
      { dia: -60, valor: 0 },
      { dia: -10, valor: 12200 },
      { dia: 0, valor: 24200 },
    ])
    expect(r.avisos.some((a) => a.includes('“Promo” está sem virada prevista') && a.includes('“Lote 1”'))).toBe(true)
    expect(r.avisos.some((a) => a.includes('“Lote 2”') && a.includes('dia da festa'))).toBe(true)
  })

  it('virada depois da festa é encostada no dia da festa, com aviso', () => {
    const ev = eventoComLotes({}, [
      { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '2026-09-05' },
    ])
    const r = curvaPlanoDatas(ev)
    expect(r.pontos[r.pontos.length - 1]).toEqual({ dia: 0, valor: 5000 })
    expect(r.avisos.some((a) => a.includes('DEPOIS da festa'))).toBe(true)
  })

  it('viradas fora de ordem são encostadas na anterior, com aviso', () => {
    const ev = eventoComLotes({}, [
      { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '2026-08-19' }, // D-10
      { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120, viradaPrevista: '2026-07-30' }, // D-30 → encosta em D-10
    ])
    const r = curvaPlanoDatas(ev)
    const dias = r.pontos.map((p) => p.dia)
    expect([...dias].sort((x, y) => x - y)).toEqual(dias) // monotônico
    expect(r.avisos.some((a) => a.includes('ANTES da virada do lote anterior'))).toBe(true)
  })

  it('sem data do evento → erro nomeado; sem nenhuma virada → erro nomeado', () => {
    expect(curvaPlanoDatas(eventoComLotes({ data: '' }))).toMatchObject({ erro: 'sem-data-evento' })
    expect(curvaPlanoDatas(eventoComLotes())).toMatchObject({ erro: 'sem-nenhuma-virada' })
  })
})

describe('PROVA: nenhum número difere entre os modos no TOTAL (mesmo plano, duas réguas)', () => {
  it('modo forma e modo datas terminam no MESMO total (= totalPlanoLotes)', () => {
    const evForma = eventoComLotes()
    const evDatas = eventoComLotes({}, [
      { id: 'a', nome: 'Promo', valor: 50, quantidade: 100, viradaPrevista: '2026-07-30' },
      { id: 'b', nome: 'Lote 1', valor: 60, quantidade: 120, viradaPrevista: '2026-08-14' },
      { id: 'c', nome: 'Lote 2', valor: 80, quantidade: 150, viradaPrevista: '2026-08-29' },
    ])
    const forma = curvaPlanoForma(evForma, mediaSintetica())
    const datas = curvaPlanoDatas(evDatas)
    const fimForma = forma.pontos[forma.pontos.length - 1].valor
    const fimDatas = datas.pontos[datas.pontos.length - 1].valor
    expect(fimForma).toBe(fimDatas)
    expect(fimForma).toBe(totalPlanoLotes(evForma))
    expect(fimForma).toBe(24200)
  })

  it('com desconto médio a igualdade se mantém (mesma régua nos dois modos)', () => {
    const ev = eventoComLotes({ descontoMedioPct: 10 })
    const evDatas = { ...ev, lotes: ev.lotes.map((l) => ({ ...l, viradaPrevista: l.valor > 0 ? '2026-08-01' : '' })) }
    const forma = curvaPlanoForma(ev, mediaSintetica())
    const datas = curvaPlanoDatas(evDatas)
    expect(forma.pontos[forma.pontos.length - 1].valor).toBeCloseTo(21780, 9)
    expect(datas.pontos[datas.pontos.length - 1].valor).toBeCloseTo(21780, 9)
  })
})

describe('migração leve dos campos novos (curvaModo + viradaPrevista)', () => {
  it('backup antigo (sem os campos) ganha forma padrão e NADA mais muda', () => {
    const antigo = {
      id: 'ev1',
      nome: 'Antigo',
      lotes: [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 50, somenteOtimista: false }],
      categorias: [],
    }
    const m = migrarEvento(antigo)
    expect(m.curvaModo).toBe('')
    expect(m.lotes[0].viradaPrevista).toBe('')
    // nada existente mudou
    expect(m.lotes[0]).toMatchObject({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 50 })
    expect(modoCurva(m)).toBe('forma') // padrão = pela forma histórica
  })

  it('valores válidos são preservados; tortos viram vazio (nunca dado inventado)', () => {
    const ev = {
      id: 'ev2',
      curvaModo: 'datas',
      lotes: [
        { id: 'l1', viradaPrevista: '2026-08-19' },
        { id: 'l2', viradaPrevista: 'semana que vem' },
        { id: 'l3', viradaPrevista: 42 },
      ],
    }
    const m = migrarEvento(ev)
    expect(m.curvaModo).toBe('datas')
    expect(m.lotes.map((l) => l.viradaPrevista)).toEqual(['2026-08-19', '', ''])
    const torto = migrarEvento({ id: 'ev3', curvaModo: 'outra-coisa' })
    expect(torto.curvaModo).toBe('')
  })

  it('round-trip: migrar duas vezes = uma vez (idempotente)', () => {
    const ev = migrarEvento({
      id: 'ev4',
      curvaModo: 'datas',
      lotes: [{ id: 'l1', valor: 10, quantidade: 5, viradaPrevista: '2026-08-01' }],
    })
    expect(migrarEvento(ev)).toEqual(ev)
  })
})

// ————— Sessão F2-S (sugestão 30): início de vendas —————

describe('inicioVendasEfetivo (F2-S — o campo vence; premissa deriva data − N)', () => {
  const ev = (patch = {}) => ({ data: '2026-09-12', inicioVendas: '', vendasAbremDiasAntes: '', ...patch })

  it('campo preenchido vence tudo, com dia relativo e dias antes', () => {
    const r = inicioVendasEfetivo(ev({ inicioVendas: '2026-08-13', vendasAbremDiasAntes: 90 }))
    expect(r).toEqual({ data: '2026-08-13', origem: 'campo', diasAntes: 30, dia: -30, depoisDaFesta: false })
  })

  it('campo vazio + premissa N + data do evento → derivado data − N (12/09 − 45 = 29/07)', () => {
    const r = inicioVendasEfetivo(ev({ vendasAbremDiasAntes: 45 }))
    expect(r).toEqual({ data: '2026-07-29', origem: 'premissa', diasAntes: 45, dia: -45, depoisDaFesta: false })
  })

  it('sem campo e sem premissa (ou sem data do evento) → null = comportamento de sempre', () => {
    expect(inicioVendasEfetivo(ev())).toBeNull()
    expect(inicioVendasEfetivo(ev({ data: '', vendasAbremDiasAntes: 45 }))).toBeNull()
    expect(inicioVendasEfetivo(undefined)).toBeNull()
  })

  it('N torto, zero ou negativo NÃO liga a premissa (régua nunca nasce de dado quebrado)', () => {
    expect(inicioVendasEfetivo(ev({ vendasAbremDiasAntes: 'abc' }))).toBeNull()
    expect(inicioVendasEfetivo(ev({ vendasAbremDiasAntes: 0 }))).toBeNull()
    expect(inicioVendasEfetivo(ev({ vendasAbremDiasAntes: -10 }))).toBeNull()
  })

  it('início DEPOIS da festa é sinalizado (a tela avisa; a curva ignora)', () => {
    const r = inicioVendasEfetivo(ev({ inicioVendas: '2026-09-20' }))
    expect(r.depoisDaFesta).toBe(true)
    expect(r.dia).toBe(8)
  })

  it('campo com evento SEM data ainda vale (dia null — vira régua quando a data chegar)', () => {
    const r = inicioVendasEfetivo(ev({ data: '', inicioVendas: '2026-08-01' }))
    expect(r).toEqual({ data: '2026-08-01', origem: 'campo', diasAntes: null, dia: null, depoisDaFesta: false })
  })

  it('premissa em string numérica (backup à mão) funciona ("45" → 45 dias)', () => {
    expect(inicioVendasEfetivo(ev({ vendasAbremDiasAntes: '45' })).diasAntes).toBe(45)
  })
})

// ————— Sessão F2-S (sugestão 30): tempo normalizado da janela de vendas —————
//
// CONTAS À MÃO das fixtures (documentadas aqui, conferidas no papel):
// Brisa #1 — janela 40 (1º pagamento D-40): D-40 2.000 · D-20 3.000 ·
//   D-5 4.000 · D-0 1.000, total 10.000.
// Brisa #2 — janela 60 (1º pagamento D-60): D-60 1.000 · D-30 3.000 ·
//   D-10 3.000 · D-0 1.000, total 8.000.
// Forma normalizada (média simples das frações, leitura em degraus):
//   u=0   → (2000/10000 + 1000/8000)/2 = (0,2 + 0,125)/2   = 0,1625
//   u=0,5 → dia −20 (#1: 5000/10000) e −30 (#2: 4000/8000) = 0,5
//   u=0,9 → dia −4 (#1: 9000/10000=0,9) e −6 (#2: 7000/8000=0,875) = 0,8875
//   u=1   → 1,0 nas duas → 1,0 (norma = 1: sem reescala)
// Janela média = (40 + 60) / 2 = 50 dias.

const curvaJanelas = () =>
  validarCurvaFinanceiro({
    eventos: [
      {
        evento_id: 21, nome: 'Brisa #1', data: '2026-03-14', status: 'realizado',
        empresa_id: 2, empresa: 'Brisa', total_pagamentos: 10, total_valor: 10000,
        dias: [
          { dia: -40, pagamentos: 2, valor: 2000 },
          { dia: -20, pagamentos: 3, valor: 3000 },
          { dia: -5, pagamentos: 4, valor: 4000 },
          { dia: 0, pagamentos: 1, valor: 1000 },
        ],
      },
      {
        evento_id: 22, nome: 'Brisa #2', data: '2025-12-05', status: 'realizado',
        empresa_id: 2, empresa: 'Brisa', total_pagamentos: 8, total_valor: 8000,
        dias: [
          { dia: -60, pagamentos: 1, valor: 1000 },
          { dia: -30, pagamentos: 3, valor: 3000 },
          { dia: -10, pagamentos: 3, valor: 3000 },
          { dia: 0, pagamentos: 1, valor: 1000 },
        ],
      },
      {
        evento_id: 23, nome: 'Brisa dia-zero', data: '2026-01-10', status: 'realizado',
        empresa_id: 2, empresa: 'Brisa', total_pagamentos: 1, total_valor: 500,
        dias: [{ dia: 0, pagamentos: 1, valor: 500 }],
      },
    ],
    eventos_sem_data: [],
  })

const evJanela = (patch = {}) => ({
  data: '2026-09-12',
  tipo: 'Brisa',
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 80, quantidade: 100, somenteOtimista: false },
    { id: 'l2', nome: 'Lote 2', valor: 100, quantidade: 150, somenteOtimista: false },
  ],
  ...patch,
})

describe('janelaHistoricaDias (F2-S — primeiro pagamento → festa)', () => {
  it('janelas 40, 60 e 0 (só vendeu no dia) — e null sem venda', () => {
    const c = curvaJanelas()
    expect(janelaHistoricaDias(c.eventos[0])).toBe(40)
    expect(janelaHistoricaDias(c.eventos[1])).toBe(60)
    expect(janelaHistoricaDias(c.eventos[2])).toBe(0)
    expect(janelaHistoricaDias({ dias: [] })).toBeNull()
  })
})

describe('mediaHistoricaNormalizada + fracaoNormalizada (F2-S — a forma pura)', () => {
  const m = () => mediaHistoricaNormalizada(curvaJanelas(), { tipo: 'Brisa', hoje: '2026-07-18' })

  it('usa só festas com janela; nomeia as sem janela; janela média = 50 (conferida à mão)', () => {
    const r = m()
    expect(r.nEventos).toBe(2)
    expect(r.nomes).toEqual(['Brisa #1', 'Brisa #2'])
    expect(r.semJanela).toEqual(['Brisa dia-zero'])
    expect(r.janelaMediaDias).toBe(50)
    expect(r.base).toBe('tipo')
  })

  it('forma normalizada conferida à mão em 4 pontos: 0,1625 · 0,5 · 0,8875 · 1,0', () => {
    const f = m().festas
    expect(fracaoNormalizada(f, 0)).toBeCloseTo(0.1625, 10)
    expect(fracaoNormalizada(f, 0.5)).toBeCloseTo(0.5, 10)
    expect(fracaoNormalizada(f, 0.9)).toBeCloseTo(0.8875, 10)
    expect(fracaoNormalizada(f, 1)).toBeCloseTo(1, 10)
    // u fora de [0,1] é grampeado — antes da abertura não existe "menos que abriu"
    expect(fracaoNormalizada(f, -0.5)).toBeCloseTo(0.1625, 10)
    expect(fracaoNormalizada(f, 1.5)).toBeCloseTo(1, 10)
  })

  it('nenhuma festa com janela → null (a tela explica; nada inventado)', () => {
    const soDiaZero = validarCurvaFinanceiro({
      eventos: [
        {
          evento_id: 23, nome: 'Brisa dia-zero', data: '2026-01-10', status: 'realizado',
          empresa_id: 2, empresa: 'Brisa', total_pagamentos: 1, total_valor: 500,
          dias: [{ dia: 0, pagamentos: 1, valor: 500 }],
        },
      ],
      eventos_sem_data: [],
    })
    expect(mediaHistoricaNormalizada(soDiaZero, { tipo: 'Brisa', hoje: '2026-07-18' })).toBeNull()
  })
})

describe('curvaPlanoJanela (F2-S — plano(dia) = total × forma(u), plano 0 antes do início)', () => {
  const mNorm = () => mediaHistoricaNormalizada(curvaJanelas(), { tipo: 'Brisa', hoje: '2026-07-18' })

  it('janela de 30 dias: pontos conferidos à mão (3.737,50 · 11.500 · 20.412,50 · 23.000)', () => {
    // total do plano = 100×80 + 150×100 = 23.000; início D-30
    const p = curvaPlanoJanela(evJanela(), mNorm(), -30)
    expect(p.total).toBeCloseTo(23000, 10)
    expect(p.janelaDias).toBe(30)
    const em = (dia) => p.pontos.find((x) => x.dia === dia).valor
    expect(em(-30)).toBeCloseTo(23000 * 0.1625, 10) // u=0 → 3.737,50
    expect(em(-15)).toBeCloseTo(23000 * 0.5, 10) // u=0,5 → 11.500
    expect(em(-3)).toBeCloseTo(23000 * 0.8875, 10) // u=0,9 → 20.412,50
    expect(em(0)).toBeCloseTo(23000, 10) // termina EXATAMENTE no total
  })

  it('plano = 0 EXATO antes do início (a régua abre em D-60 zerada)', () => {
    const p = curvaPlanoJanela(evJanela(), mNorm(), -30)
    expect(p.pontos[0]).toEqual({ dia: -60, valor: 0 })
    expect(p.pontos[1]).toEqual({ dia: -31, valor: 0 })
    expect(p.pontos.filter((x) => x.dia < -30).every((x) => x.valor === 0)).toBe(true)
  })

  it('viradas derivadas pela forma: Lote 1 (8.000 de 23.000) vira em D-15; o último no dia da festa', () => {
    const p = curvaPlanoJanela(evJanela(), mNorm(), -30)
    expect(p.viradas.map((v) => v.dia)).toEqual([-15, 0])
  })

  it('mesmo TOTAL do plano em qualquer janela (mesma régua do totalPlanoLotes)', () => {
    const ev = evJanela()
    for (const inicio of [-90, -50, -30, -7]) {
      const p = curvaPlanoJanela(ev, mNorm(), inicio)
      expect(p.pontos[p.pontos.length - 1].valor).toBeCloseTo(totalPlanoLotes(ev), 8)
    }
  })

  it('início no dia da festa (janela 0): tudo no D-0, zero antes', () => {
    const p = curvaPlanoJanela(evJanela(), mNorm(), 0)
    const ultimo = p.pontos[p.pontos.length - 1]
    expect(ultimo).toEqual({ dia: 0, valor: 23000 })
    expect(p.pontos.filter((x) => x.dia < 0).every((x) => x.valor === 0)).toBe(true)
  })

  it('sem média normalizada, sem lotes ou início depois da festa → null (a tela explica)', () => {
    expect(curvaPlanoJanela(evJanela(), null, -30)).toBeNull()
    expect(curvaPlanoJanela({ lotes: [] }, mNorm(), -30)).toBeNull()
    expect(curvaPlanoJanela(evJanela(), mNorm(), 5)).toBeNull()
    expect(curvaPlanoJanela(evJanela(), mNorm(), null)).toBeNull()
  })
})

describe('avisoJanelaCurta (F2-S — "ritmo exigido N,N× o normal")', () => {
  it('exemplo da spec: janela 30 contra histórica 52 → 1,7×', () => {
    const a = avisoJanelaCurta(30, 52)
    expect(a.texto).toBe(
      'janela de 30 dias contra média histórica de 52 — ritmo exigido 1,7× o normal'
    )
    expect(a.vezes).toBeCloseTo(52 / 30, 10)
  })

  it('sem aperto (janela ≥ média) ou sem dado → null', () => {
    expect(avisoJanelaCurta(60, 50)).toBeNull()
    expect(avisoJanelaCurta(50, 50)).toBeNull()
    expect(avisoJanelaCurta(0, 50)).toBeNull()
    expect(avisoJanelaCurta(30, null)).toBeNull()
  })

  it('média fracionária aparece arredondada no texto', () => {
    // janela média 50 (fixture) → "de 50"; 47,5 → "de 48"
    expect(avisoJanelaCurta(30, 47.5).texto).toContain('média histórica de 48')
  })
})

describe('curvaPlanoDatas com início como piso (F2-S — fallback "sem histórico")', () => {
  const evDatas = () =>
    evJanela({
      lotes: [
        { id: 'l1', nome: 'Lote 1', valor: 80, quantidade: 100, somenteOtimista: false, viradaPrevista: '2026-07-20' },
        { id: 'l2', nome: 'Lote 2', valor: 100, quantidade: 150, somenteOtimista: false, viradaPrevista: '2026-09-12' },
      ],
    })

  it('virada ANTES do início é encostada nele, com aviso nomeando o lote', () => {
    // virada 20/07 = D-54; piso D-30 → encostada em D-30
    const p = curvaPlanoDatas(evDatas(), { inicioDia: -30 })
    expect(p.viradas[0].dia).toBe(-30)
    expect(p.avisos.some((a) => a.includes('Lote 1') && a.includes('ANTES do início'))).toBe(true)
  })

  it('o plano fica em 0 até a véspera do início (piso da spec)', () => {
    const p = curvaPlanoDatas(evDatas(), { inicioDia: -30 })
    expect(p.pontos[0]).toEqual({ dia: -60, valor: 0 })
    expect(p.pontos[1]).toEqual({ dia: -31, valor: 0 })
    expect(p.pontos[p.pontos.length - 1].valor).toBeCloseTo(23000, 10)
  })

  it('sem inicioDia (ou null) = comportamento de sempre, byte a byte', () => {
    expect(curvaPlanoDatas(evDatas(), { inicioDia: null })).toEqual(curvaPlanoDatas(evDatas()))
    // e um evento SEM os campos novos continua idêntico com e sem a opção
    const ev = evJanela({
      lotes: [
        { id: 'l1', nome: 'Lote 1', valor: 80, quantidade: 100, somenteOtimista: false, viradaPrevista: '2026-08-10' },
      ],
    })
    expect(curvaPlanoDatas(ev, { inicioDia: null })).toEqual(curvaPlanoDatas(ev))
  })
})

// ————— Sessão F2-S (bloco 3): referência escolhível —————

describe('referência escolhível (F2-S — média da festa · grupo · uma festa)', () => {
  it('referenciaCurva/refIdsDaCurva: forma segura; modo festa vale SÓ a primeira', () => {
    expect(referenciaCurva({})).toEqual({ modo: '', itens: [] })
    expect(refIdsDaCurva({})).toBeNull()
    const grupo = { curvaRef: { modo: 'grupo', itens: [{ id: 21, nome: 'A' }, { id: 22, nome: 'B' }] } }
    expect(refIdsDaCurva(grupo)).toEqual([21, 22])
    const festa = { curvaRef: { modo: 'festa', itens: [{ id: 22, nome: 'B' }, { id: 21, nome: 'A' }] } }
    expect(refIdsDaCurva(festa)).toEqual([22])
    // modo escolhido sem itens = média da festa (nada quebra)
    expect(refIdsDaCurva({ curvaRef: { modo: 'grupo', itens: [] } })).toBeNull()
  })

  it('mediaHistorica com refIds: só as escolhidas, base "ref" — e sem refIds NADA muda (byte a byte)', () => {
    const c = curvaJanelas()
    const semRef = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18' })
    expect(semRef.refAusentes).toBeUndefined() // a chave nem existe sem referência
    const comRef = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18', refIds: [22] })
    expect(comRef.base).toBe('ref')
    expect(comRef.nEventos).toBe(1)
    expect(comRef.nomes).toEqual(['Brisa #2'])
    expect(comRef.refAusentes).toEqual([])
    // fração da Brisa #2 sozinha em D-30: 4000/8000 = 0,5 (conferida à mão)
    expect(comRef.pontos.find((p) => p.dia === -30).fracao).toBeCloseTo(0.5, 10)
    // refIds: null se comporta como ausência (o caminho da média da festa)
    expect(mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18', refIds: null })).toEqual(semRef)
  })

  it('mediaHistoricaNormalizada com refIds: janela média = a da festa escolhida (60)', () => {
    const m = mediaHistoricaNormalizada(curvaJanelas(), { tipo: 'Brisa', hoje: '2026-07-18', refIds: [22] })
    expect(m.base).toBe('ref')
    expect(m.janelaMediaDias).toBe(60)
    expect(m.nomes).toEqual(['Brisa #2'])
    // forma da #2 sozinha: u=0,5 → dia −30 → 4000/8000 = 0,5
    expect(fracaoNormalizada(m.festas, 0.5)).toBeCloseTo(0.5, 10)
  })

  it('escolhida que não veio na busca é NOMEADA; nenhuma veio → cai na média da festa, dito', () => {
    const c = curvaJanelas()
    const parcial = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18', refIds: [22, 999] })
    expect(parcial.base).toBe('ref')
    expect(parcial.nEventos).toBe(1)
    expect(parcial.refAusentes).toEqual([999])
    const nenhuma = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18', refIds: [998, 999] })
    expect(nenhuma.base).toBe('tipo') // caiu na média da festa
    expect(nenhuma.refAusentes).toEqual([998, 999])
  })

  it('festasPassadasDisponiveis: a lista do modal (passadas com venda, sem o próprio evento)', () => {
    const lista = festasPassadasDisponiveis(curvaJanelas(), { hoje: '2026-07-18', excluirEventoId: 21 })
    expect(lista.map((f) => f.nome)).toEqual(['Brisa #2', 'Brisa dia-zero'])
  })

  it('rotuloReferencia diz sempre a referência EM USO', () => {
    const c = curvaJanelas()
    const evFesta = { curvaRef: { modo: 'festa', itens: [{ id: 22, nome: 'Brisa #2' }] } }
    const mFesta = mediaHistorica(c, { hoje: '2026-07-18', refIds: [22] })
    expect(rotuloReferencia(evFesta, mFesta)).toBe('referência: Brisa #2')
    const evGrupo = { curvaRef: { modo: 'grupo', itens: [{ id: 21, nome: 'A' }, { id: 22, nome: 'B' }] } }
    const mGrupo = mediaHistorica(c, { hoje: '2026-07-18', refIds: [21, 22] })
    expect(rotuloReferencia(evGrupo, mGrupo)).toBe('referência: grupo de 2 festas')
    const mTipo = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18' })
    expect(rotuloReferencia({}, mTipo)).toBe('referência: média Brisa')
    expect(rotuloReferencia({}, null)).toBe('referência: média da festa')
    // escolhida que caiu na média (nenhuma na busca): o rótulo conta a VERDADE
    const mCaiu = mediaHistorica(c, { tipo: 'Brisa', hoje: '2026-07-18', refIds: [999] })
    expect(rotuloReferencia(evFesta, mCaiu)).toBe('referência: média Brisa')
  })

  it('a referência alimenta a FORMA do plano (coerência: as três linhas, a mesma história)', () => {
    // plano com janela 30 na referência Brisa #2 sozinha: forma da #2
    const m = mediaHistoricaNormalizada(curvaJanelas(), { hoje: '2026-07-18', refIds: [22] })
    const p = curvaPlanoJanela(evJanela(), m, -30)
    // u=0,5 (D-15): fração da #2 = 0,5 → 23.000 × 0,5 = 11.500 (à mão)
    expect(p.pontos.find((x) => x.dia === -15).valor).toBeCloseTo(11500, 8)
    // u=0 (D-30): 1000/8000 = 0,125 → 2.875 — DIFERENTE da média das duas
    // (0,1625 → 3.737,50): a escolha da referência muda a forma de verdade
    expect(p.pontos.find((x) => x.dia === -30).valor).toBeCloseTo(23000 * 0.125, 8)
  })
})

// ————————————————————————————————————————————————————————————————
// addDiasISO — a saída também sai do relógio LOCAL (conserto de 05/08/2026)
//
// A ENTRADA já ancorava no sol-alto local; a SAÍDA passava por `toISOString`,
// que é UTC. Em fuso ADIANTADO isso devolvia o dia ANTERIOR para o mesmo
// insumo — medido em Pacific/Kiritimati:
//
//     addDiasISO('2026-08-05', 0) => 2026-08-04
//
// A esteira roda TZ=UTC e TZ=America/Sao_Paulo, e nos dois o resultado sempre
// esteve certo: era latente por GEOGRAFIA, não por desenho. Por isso a rede
// principal aqui é a PAREDE DE TEXTO-FONTE, que morde em qualquer fuso — um
// teste de comportamento sozinho continuaria verde com o defeito de volta.
// ————————————————————————————————————————————————————————————————
describe('addDiasISO — a peça que quase repetiu o S1 do relógio', () => {
  it('somar zero devolve exatamente a mesma data', () => {
    for (const iso of ['2026-08-05', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(addDiasISO(iso, 0), iso).toBe(iso)
    }
  })

  it('soma e subtrai atravessando mês, ano e fevereiro bissexto', () => {
    expect(addDiasISO('2026-08-05', 30)).toBe('2026-09-04')
    expect(addDiasISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDiasISO('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDiasISO('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDiasISO('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('ir e voltar o mesmo número de dias fecha, em 400 saltos seguidos', () => {
    let iso = '2026-08-05'
    for (let n = 1; n <= 400; n += 1) {
      expect(addDiasISO(addDiasISO(iso, n), -n), String(n)).toBe(iso)
    }
  })

  it('PAREDE: curvaVendas.js não chama toISOString — a saída é do relógio local', () => {
    const fonte = readFileSync(new URL('./curvaVendas.js', import.meta.url), 'utf8')
    expect(fonte).not.toMatch(/\.toISOString\s*\(/)
    expect(fonte).toContain('dataISOLocal')
  })
})

// P2 — forma derivada com estornos; os dias e totais recebidos continuam brutos.
const opcoesS3 = { hoje: '2026-08-10' }
const festaS3 = (valores, extra = {}) => ({
  id: 7, nome: 'Brisa sintética', empresa: 'Brisa', data: '2026-05-01',
  totalValor: valores.reduce((s, [, v]) => s + v, 0),
  dias: valores.map(([dia, valor]) => ({ dia, valor, pagamentos: 1 })), ...extra,
})
const curvaS3 = (...eventos) => ({ eventos, eventosSemData: [] })
const congelarS3 = (obj) => { Object.values(obj).forEach(v => { if (v && typeof v === 'object') congelarS3(v) }); return Object.freeze(obj) }

describe('P2 S3 — fração por festa, cronológica e sem persistência', () => {
  it('teto 1 em ambas médias; bruto mantém 100 mil → 80 mil', () => {
    const e = festaS3([[-11, 100000], [-10, -20000]])
    const c = congelarS3(curvaS3(e)), antes = JSON.stringify(c)
    const m = mediaHistorica(c, opcoesS3), n = mediaHistoricaNormalizada(c, opcoesS3)
    expect(m.pontos.filter(p => p.dia >= -11).map(p => p.fracao)).toEqual(Array(12).fill(1))
    expect([0, .5, 1].map(u => fracaoNormalizada(n.festas, u))).toEqual([1, 1, 1])
    for (const media of [m, n]) expect(media.ajustes).toEqual([{ id: 7, nome: 'Brisa sintética', estorno: 20000 }])
    expect(n.festas[0]).toBe(e)
    expect(acumularDias(e.dias).map(p => p.valorAcum)).toEqual([100000, 80000])
    expect(acumuladoAteODia(e.dias, -10)).toEqual({ valor: 80000, pagamentos: 2 })
    expect(JSON.stringify(c)).toBe(antes)
  })
  it('50/-20/70 não recua em consultas repetidas, invertidas e intercaladas', () => {
    const a = festaS3([[-10, 50], [-5, -20], [0, 70]])
    const b = festaS3([[-10, 10], [-5, 50], [0, 40]], { id: 8 })
    const m = mediaHistorica(curvaS3(a), opcoesS3)
    expect([-10, -5, 0].map(d => m.pontos.find(p => p.dia === d).fracao)).toEqual([.5, .5, 1])
    for (const ordem of [[0, .5, 1], [1, .5, 0], [1, 0, .5], [.5, .5, 0, 1]]) {
      expect(ordem.map(u => { fracaoNormalizada([b], 1 - u); return fracaoNormalizada([a], u) })).toEqual(ordem.map(u => u === 1 ? 1 : .5))
    }
    expect([0, .5, 1].map(u => fracaoNormalizada([a, b], u))).toEqual([.3, .55, 1])
    const media = mediaHistorica(curvaS3(a, b), opcoesS3)
    expect([-10, -5, 0].map(d => media.pontos.find(p => p.dia === d).fracao)).toEqual([.3, .55, 1])
  })
  it('abertura negativa tem piso zero, sem inventar forma pré-festa', () => {
    const e = festaS3([[-10, -20], [-5, 50], [0, 70]])
    expect([0, .5, 1].map(u => fracaoNormalizada([e], u))).toEqual([0, .3, 1])
    const m = mediaHistorica(curvaS3(e), opcoesS3)
    expect(m.pontos.every(p => p.fracao >= 0)).toBe(true)
    const soEstorno = festaS3([[-10, -20], [5, 120]])
    const plano = { lotes: [{ id: 'l', quantidade: 2, valor: 100 }] }
    expect(curvaPlanoForma(plano, mediaHistorica(curvaS3(soEstorno), opcoesS3))).toBeNull()
    expect(curvaPlanoJanela(plano, mediaHistoricaNormalizada(curvaS3(soEstorno), opcoesS3), -10)).toBeNull()
  })
  it('cache desordenado e rede dão mesma média, janela e avisos sem ordenar o original', () => {
    const e = festaS3([[0, 70], [-10, 50], [-5, -20]])
    const c = congelarS3(curvaS3(e)), antes = JSON.stringify(c)
    const rede = validarCurvaFinanceiro({ eventos: [{ evento_id: e.id, nome: e.nome, empresa: e.empresa, data: e.data, total_valor: e.totalValor, total_pagamentos: 3, dias: e.dias }], eventos_sem_data: [] })
    expect(janelaHistoricaDias(e)).toBe(10)
    expect(mediaHistorica(c, opcoesS3)).toEqual(mediaHistorica(rede, opcoesS3))
    const n = mediaHistoricaNormalizada(c, opcoesS3)
    expect(n.janelaMediaDias).toBe(10)
    expect(n.ajustes).toEqual(mediaHistoricaNormalizada(rede, opcoesS3).ajustes)
    expect([0, .5, 1].map(u => fracaoNormalizada(n.festas, u))).toEqual([.5, .5, 1])
    expect(JSON.stringify(c)).toBe(antes)
  })
  it.each([
    [[[-10, 20], [-10, 30], [0, 50]], .5, undefined],
    [[[-10, 100], [-10, -20], [0, 20]], .8, 20],
    [[[-10, -20], [-10, 100], [0, 20]], .8, 20],
  ])('agrupa registros do dia antes de avaliar máximo: %j', (dias, abertura, estorno) => {
    const e = festaS3(dias), c = curvaS3(e)
    const m = mediaHistorica(c, opcoesS3), n = mediaHistoricaNormalizada(c, opcoesS3)
    expect(m.pontos.find(p => p.dia === -10).fracao).toBe(abertura)
    expect(fracaoNormalizada(n.festas, 0)).toBe(abertura)
    expect(fracaoNormalizada(n.festas, 1)).toBe(1)
    expect(m.ajustes?.[0].estorno).toBe(estorno)
  })
  it('zero/negativo não entram nem reduzem peso; sem janela é nomeada e estorno pós-festa avisa', () => {
    const sa = festaS3([[-75, 75], [5, 25]])
    const zero = festaS3([[-1, 0]], { id: 8 }), neg = festaS3([[-1, -20]], { id: 9 })
    for (const e of [zero, neg]) {
      expect(mediaHistorica(curvaS3(e), opcoesS3)).toBeNull()
      expect(mediaHistoricaNormalizada(curvaS3(e), opcoesS3)).toBeNull()
    }
    expect(mediaHistorica(curvaS3(sa, zero, neg), opcoesS3)).toEqual(mediaHistorica(curvaS3(sa), opcoesS3))
    const sem = festaS3([[0, 120], [5, -20]], { id: 10, nome: 'Sem janela' })
    const m = mediaHistorica(curvaS3(sa, sem), opcoesS3), n = mediaHistoricaNormalizada(curvaS3(sa, sem), opcoesS3)
    expect(m.pontos[0].dia).toBe(-75)
    expect(m.ajustes).toEqual([{ id: 10, nome: 'Sem janela', estorno: 20 }])
    expect(n).toEqual({ festas: [sa], base: 'geral', chave: '', nEventos: 1, nomes: [sa.nome], janelaMediaDias: 75, semJanela: ['Sem janela'] })
    expect(fracaoNormalizada(n.festas, 1)).toBe(.75)
    const p = curvaPlanoJanela({ lotes: [{ id: 'l', valor: 100, quantidade: 2 }] }, n, 0)
    expect(p.pontos).toEqual([{ dia: -60, valor: 0 }, { dia: -1, valor: 0 }, { dia: 0, valor: 200 }])
  })
  it('seleção mantém avisos só de usadas: tipo, geral, referência, vínculo, futuro', () => {
    const a = festaS3([[-10, 50], [-5, -20], [0, 70]])
    const b = festaS3([[-10, 50], [0, 50]], { id: 8, nome: 'Marfim sã', empresa: 'Marfim' })
    const futuro = festaS3([[-10, 100], [0, -20]], { id: 9, data: '2027-01-01' })
    const c = curvaS3(a, b, futuro)
    for (const mediaFn of [mediaHistorica, mediaHistoricaNormalizada]) {
      expect(mediaFn(c, { ...opcoesS3, tipo: 'Marfim' }).ajustes).toBeUndefined()
      expect(mediaFn(c, { ...opcoesS3, empresaVinculo: 'Brisa' }).ajustes).toHaveLength(1)
      expect(mediaFn(c, { ...opcoesS3, excluirEventoId: 7 }).ajustes).toBeUndefined()
      expect(mediaFn(c, { ...opcoesS3, refIds: [8] }).ajustes).toBeUndefined()
      const m = mediaFn(c, { ...opcoesS3, refIds: [7, 404] })
      expect(m.ajustes).toEqual([{ id: 7, nome: a.nome, estorno: 20 }])
      expect(m.refAusentes).toEqual([404])
      expect(mediaFn(c, opcoesS3).ajustes).toHaveLength(1)
    }
  })
  it('objetos completos saudáveis e planos preservados sem chave ajustes', () => {
    const e = festaS3([[-10, 50], [-5, 20], [0, 30]])
    const pontos = Array.from({ length: 61 }, (_, i) => ({ dia: i - 60, fracao: i < 50 ? 0 : i < 55 ? .5 : i < 60 ? .7 : 1 }))
    const m = mediaHistorica(curvaS3(e), opcoesS3)
    expect(m).toEqual({ pontos, base: 'geral', chave: '', nEventos: 1, nomes: [e.nome] })
    const n = mediaHistoricaNormalizada(curvaS3(e), opcoesS3)
    expect(n).toEqual({ festas: [e], base: 'geral', chave: '', nEventos: 1, nomes: [e.nome], janelaMediaDias: 10, semJanela: [] })
    const ev = { lotes: [{ id: 'l', nome: 'Lote', quantidade: 100, valor: 2 }] }
    expect(curvaPlanoForma(ev, m)).toEqual({ pontos: pontos.map(p => ({ dia: p.dia, valor: p.dia < -10 ? 0 : p.dia < -5 ? 100 : p.dia < 0 ? 140 : 200 })), viradas: [{ loteId: 'l', nome: 'Lote', dia: 0, acumulada: 200 }], total: 200 })
    const janela = mediaHistoricaNormalizada(curvaJanelas(), { tipo: 'Brisa', hoje: '2026-07-18' })
    expect(janela).toEqual({ festas: curvaJanelas().eventos.slice(0, 2), base: 'tipo', chave: 'Brisa', nEventos: 2, nomes: ['Brisa #1', 'Brisa #2'], janelaMediaDias: 50, semJanela: ['Brisa dia-zero'] })
    expect([0, .5, .9, 1].map(u => fracaoNormalizada(janela.festas, u))).toEqual([.1625, .5, .8875, 1])
    const p = curvaPlanoJanela(evJanela(), janela, -30)
    expect([-30, -15, -3, 0].map(d => p.pontos.find(x => x.dia === d).valor)).toEqual([3737.5, 11500, 20412.5, 23000])
    // Faixas conferidas das janelas 40/60: em u=5/6 só a segunda festa
    // muda; em u=0,9 ambas já mudaram. Esperado completo, sem helper novo.
    expect(p).toEqual({
      pontos: [{ dia: -60, valor: 0 }, { dia: -31, valor: 0 },
        ...Array.from({ length: 31 }, (_, i) => ({ dia: i - 30,
          valor: i < 15 ? 3737.5 : i < 25 ? 11500 : i < 27 ? 15812.5 : i < 30 ? 20412.5 : 23000 })),
      ],
      viradas: [{ loteId: 'l1', nome: 'Lote 1', dia: -15, acumulada: 8000 },
        { loteId: 'l2', nome: 'Lote 2', dia: 0, acumulada: 23000 }],
      total: 23000, janelaDias: 30,
    })
  })
})

describe('S3 adendo — precisão decimal com estornos', () => {
  const plano = { lotes: [{ id: 'l', quantidade: 1000, valor: 200 }] }
  function conferir(valores, total, fracao) {
    const curva = { eventos: [{ id: 7, nome: 'Sintética', data: '2026-05-01', totalValor: total, dias: valores.map(([dia, valor]) => ({ dia, valor })) }] }
    const antes = JSON.stringify(curva)
    const m = mediaHistorica(curva, { hoje: '2026-08-10' })
    const n = mediaHistoricaNormalizada(curva, { hoje: '2026-08-10' })
    expect(m.pontos.at(-1).fracao).toBe(fracao)
    expect(fracaoNormalizada(n.festas, 1)).toBe(fracao)
    for (const p of [curvaPlanoForma(plano, m), curvaPlanoJanela(plano, n, -10)]) {
      if (fracao === 0) expect(p).toBeNull()
      else { expect(p.total).toBe(200000); expect(p.pontos.at(-1).valor).toBe(200000) }
    }
    if (fracao === 0) expect(m.pontos.every(p => p.fracao === 0)).toBe(true)
    expect(JSON.stringify(curva)).toBe(antes)
    expect(() => JSON.stringify({ m, n })).not.toThrow()
  }
  it.each([-1, 0, 1])('resíduo: variação %s centavo não vira receita inventada', delta => {
    conferir([[-10,-30003/100],[-8,10001/100],[-6,(20002+delta)/100],[-4,-1000],[-2,1000],[5,(10000-delta)/100]],100,delta > 0 ? 0.0001 : 0)
  })
  it('máximo conserva positivo legítimo antes de voltar a zero', () => conferir([[-10,0.01],[-5,-0.01],[5,100]],100,0.0001))
  it.each([[ -300.03,100.01,200.02 ],[200.02,-300.03,100.01],[100.01,200.02,-300.03]])('grupo diário exato %j', (...valores) => {
    conferir([...valores.map(valor => [-10,valor]),[-4,-1000],[-2,1000],[5,100]],100,0)
  })
  it.each([0,1])('subcentavo legítimo: incremento %s de R$ 0,00001', delta => {
    conferir([[-10,-30003/100000],[-8,10001/100000],[-6,(20002+delta)/100000],[-4,-1],[-2,1],[5,(10000-delta)/100000]],0.1,delta ? 0.00001/0.1 : 0)
  })
  it.each([0,1])('notação exponencial: incremento %s de 1e-7', delta => {
    conferir([[-10,-3e-7],[-8,1e-7],[-6,delta ? 3e-7 : 2e-7],[5,delta ? 0.9999999 : 1]],1,delta ? 1e-7 : 0)
  })
  it('escala grande evita overflow intermediário e preserva fração legítima', () => conferir([[-10,-1e-300],[-8,1e-300],[-6,1],[5,1e21]],1e21,1e-21))
})

describe('S3 adendo — marcos acumulados empatados', () => {
  const evento = (a = -30, b = -30) => ({ data: '2026-09-09', lotes: [
    { id: 'a', nome: 'Primeiro', quantidade: 100, valor: 100, viradaPrevista: addDiasISO('2026-09-09', a) },
    { id: 'b', nome: 'Segundo', quantidade: 100, valor: 150, viradaPrevista: b == null ? '' : addDiasISO('2026-09-09', b) },
  ] })
  it('une pelo maior acumulado e conserva as duas viradas', () => {
    expect(curvaPlanoDatas(evento())).toEqual({ pontos: [{ dia:-60,valor:0 },{ dia:-30,valor:25000 },{ dia:0,valor:25000 }], viradas: [{ loteId:'a',nome:'Primeiro',dia:-30,acumulada:10000 },{ loteId:'b',nome:'Segundo',dia:-30,acumulada:25000 }], avisos: [], total:25000 })
  })
  it.each([-60,-122])('empate com zero inicial em D%s', dia => {
    expect(curvaPlanoDatas(evento(dia,dia)).pontos).toEqual([{dia,valor:25000},{dia:0,valor:25000}])
  })
  it('fora de ordem preserva aviso e viradas individuais', () => {
    const p = curvaPlanoDatas(evento(-30,-40))
    expect(p.pontos).toEqual([{dia:-60,valor:0},{dia:-30,valor:25000},{dia:0,valor:25000}])
    expect(p.viradas.map(v=>v.dia)).toEqual([-30,-30])
    expect(p.avisos).toEqual(['A virada prevista de “Segundo” vem ANTES da virada do lote anterior — foi encostada nela (vendas acumuladas não andam para trás). Confira a ordem das datas.'])
  })
  it.each([-20,-60])('piso %s une pontos após encostar as viradas', piso => {
    const p = curvaPlanoDatas(evento(-80,-90),{inicioDia:piso})
    expect(p.pontos).toEqual(piso === -20 ? [{dia:-60,valor:0},{dia:-21,valor:0},{dia:-20,valor:25000},{dia:0,valor:25000}] : [{dia:-60,valor:25000},{dia:0,valor:25000}])
    expect(p.viradas.map(v=>v.dia)).toEqual([piso,piso]); expect(p.avisos).toHaveLength(2)
    expect(p.avisos.every(a=>a.includes('ANTES do início de vendas'))).toBe(true)
  })
  it('fecha lote sem data no mesmo D0 do primeiro marco', () => {
    const p = curvaPlanoDatas(evento(0,null))
    expect(p.pontos).toEqual([{dia:-60,valor:0},{dia:0,valor:25000}])
    expect(p.viradas).toEqual([{loteId:'a',nome:'Primeiro',dia:0,acumulada:10000}])
    expect(p.avisos).toEqual(['“Segundo” está sem virada prevista — entrou na reta até o dia da festa.'])
  })
})

describe('S3 adendo — consolidação sem mutação', () => {
  it('preserva identidade da lista saudável e propriedades do primeiro ponto empatado', () => {
    const saudavel=Object.freeze([{dia:-60,valor:0},{dia:-30,valor:10000},{dia:0,valor:25000}].map(Object.freeze))
    expect(consolidarPontosDoPlano(saudavel)).toBe(saudavel)
    expect(consolidarPontosDoPlano(null)).toBeNull()
    const entrada=Object.freeze([{dia:-30,valor:10000,nome:'primeiro'},{dia:-30,valor:25000,nome:'segundo'}].map(Object.freeze))
    const unido=consolidarPontosDoPlano(entrada)
    expect(unido).toEqual([{dia:-30,valor:25000,nome:'primeiro'}])
    expect(consolidarPontosDoPlano(unido)).toBe(unido)
    expect(entrada[0].valor).toBe(10000)
  })
  it('datas sem empate preservam objeto completo', () => {
    const e={data:'2026-09-09',lotes:[{id:'a',nome:'Primeiro',quantidade:100,valor:100,viradaPrevista:'2026-08-10'},{id:'b',nome:'Segundo',quantidade:100,valor:150,viradaPrevista:'2026-08-30'}]}
    expect(curvaPlanoDatas(e)).toEqual({pontos:[{dia:-60,valor:0},{dia:-30,valor:10000},{dia:-10,valor:25000},{dia:0,valor:25000}],viradas:[{loteId:'a',nome:'Primeiro',dia:-30,acumulada:10000},{loteId:'b',nome:'Segundo',dia:-10,acumulada:25000}],avisos:[],total:25000})
  })
})
