// S6 — quantidade travada à mão, nos consumidores PUROS de texto: WhatsApp
// curto e completo, linha de ritmo (resumo, relatório, Home), glossário do
// relatório. Decisão do Marco, 05/09/2026: onde o cenário tem lote com
// quantidade ajustada à mão, o app publica "quantidade travada à mão neste
// cenário" no lugar do mínimo de ingressos e das metas de ritmo derivadas dele.
//
// Fixture histórica da S0 (`eventoTravado`, só importada): três lotes
// 400/600/200 a R$ 60/90/120, bar R$ 55 por pessoa, custo R$ 70 mil. Sem
// trava: mínimo realista 568 e público 1.080. Relógio fixo em 01/12/2026
// (festa em 01/01/2027, vendidos = 100). Cada caso monta uma CÓPIA nova.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { eventoTravado } from '../../scripts/provas-s0/cenarios.fixture.js'
import { computeCenarios } from './calc.js'
import {
  resumoCurto,
  resumoCompleto,
  linhaRitmoRelatorio,
  avisoRitmoQuantidadeTravada,
  MARCACAO_REALIZADA,
  DATA_DO_EVENTO_ILEGIVEL,
} from './resumo.js'
import { legendasRelatorio } from './premissaTexto.js'
import { linhaRitmoHome } from '../components/RitmoVendas.jsx'
import { BREAK_EVEN_NAO_FECHA, RITMO_NAO_FECHA } from './breakEvenTexto.js'
import { NUMERO_NAO_CALCULA, cenarioQuebrado, receitaDoCenarioQuebrada } from './dadoQuebrado.js'

const AVISO = 'quantidade travada à mão neste cenário'
const HOJE = '2026-12-01'
// Com trava e vendidos preenchidos (a fixture traz 100), o ritmo conta o dado da
// bilheteria e cede só a META: o prefixo é o que a bilheteria informou, o resto
// é a notícia. WhatsApp e relatório/PDF têm ordem de frase diferente (como sempre tiveram).
const RITMO_WHATSAPP_TRAVADO = `Vendidos até hoje: 100. ${AVISO}`
const RITMO_RELATORIO_TRAVADO = `100 vendidos até hoje. ${AVISO}`
// Tudo o que é META de ritmo — proibido em toda linha de ritmo travada, com ou sem prefixo.
const META_DE_RITMO = [
  /faltam/i,
  /por dia/i,
  /\d+\s*\/\s*dia/i,
  /coberto/i,
  /≥/,
  /precisa vender/i,
  /break-even \(?\d/i,
  /não fecha nem vendendo tudo/i,
  /não há ritmo que alcance/i,
]
const BASE_SEM_TRAVA_RITMO =
  'Vendidos até hoje: 100. Faltam 468 ingressos em 31 dia(s) de venda → precisa vender 16 por dia para cobrir o break-even (568).'

afterEach(() => vi.useRealTimers())

/** Festa futura (01/01/2027), 100 vendidos, com o mapa de overrides do realista do caso. */
const festa = (mapa = {}, ajuste) => {
  const e = { ...eventoTravado(), vendidosAteHoje: 100 }
  e.cenariosConfig.overrides.realista = mapa
  if (ajuste) ajuste(e)
  return e
}
const CHEIO = { l1: 400, l2: 600, l3: 200 }
const BAIXO = { l1: 100, l2: 100, l3: 20 }
const ZERO = { l1: 0 }
// [nome, mapa, linha-chave exata no WhatsApp]
const TRAVADOS = [
  ['cheio 400/600/200', CHEIO, `Margem realista 52,7% · break-even: ${AVISO} · público 1.200`],
  ['100/100/20 (o cálculo diria "não fecha")', BAIXO, `Margem realista -168,9% · break-even: ${AVISO} · público 220`],
  ['zero num lote só', ZERO, `Margem realista 27,6% · break-even: ${AVISO} · público 720`],
]
const linhas = (txt) => txt.split('\n')
const linhaChave = (txt) => linhas(txt).find((l) => l.startsWith('Margem realista'))
const ritmoCom = (e, c = computeCenarios(e)) => ({
  relatorio: linhaRitmoRelatorio(e, c.realista.breakEven, HOJE, c.realista.breakEvenNaoFecha, c),
  home: linhaRitmoHome(e, c.realista.breakEven, HOJE, c.realista.breakEvenNaoFecha, c),
  puro: avisoRitmoQuantidadeTravada(e, HOJE, c),
})

describe('S6 WhatsApp: linha-chave e ritmo trocam o mínimo pela notícia da trava', () => {
  describe.each([
    ['resumoCurto', resumoCurto],
    ['resumoCompleto', resumoCompleto],
  ])('%s', (_n, resumo) => {
    it.each(TRAVADOS)('%s', (_nome, mapa, esperadaChave) => {
      const e = festa(mapa)
      const antes = structuredClone(e)
      const c = computeCenarios(e)
      const cAntes = structuredClone(c)
      const txt = resumo(e, { hoje: HOJE })
      // a linha-chave, inteira e exata
      expect(linhaChave(txt)).toBe(esperadaChave)
      // o ritmo: UMA linha, exatamente "Vendidos até hoje: 100. <notícia>" — o dado da bilheteria, sem meta
      expect(linhas(txt).filter((l) => l === RITMO_WHATSAPP_TRAVADO)).toHaveLength(1)
      // a notícia NÃO vem mais sozinha em linha própria, e o prefixo aparece uma vez só
      expect(linhas(txt).filter((l) => l === AVISO)).toHaveLength(0)
      expect(txt.match(/Vendidos até hoje/g)).toHaveLength(1)
      // a notícia aparece na linha-chave e na do ritmo, e em mais nenhum lugar
      expect(txt.split(AVISO).length - 1).toBe(2)
      for (const proibido of META_DE_RITMO) expect(txt).not.toMatch(proibido)
      // leitura pura
      expect(e).toEqual(antes)
      expect(c).toEqual(cAntes)
      expect(computeCenarios(e)).toEqual(cAntes)
    })

    it('o resto do texto continua com os números que sempre teve (lucro, público, orçamento)', () => {
      const txt = resumo(festa(CHEIO), { hoje: HOJE })
      expect(txt).toContain(
        _n === 'resumoCurto'
          ? 'Lucro: pessimista R$ 46 mil · *realista R$ 86 mil* · otimista R$ 90 mil'
          : 'Realista: lucro R$ 86 mil (margem 52,7%) — receita R$ 163 mil · custo R$ 77 mil'
      )
      expect(txt).toContain('público 1.200')
      expect(txt).toContain('*Evento viável.*')
    })

    it('SEM trava continua exatamente como era: mínimo 568 e a meta de ritmo numérica', () => {
      const txt = resumo(festa({}), { hoje: HOJE })
      expect(linhaChave(txt)).toBe('Margem realista 47,5% · break-even 568 pagos · público 1.080')
      expect(linhas(txt)).toContain(BASE_SEM_TRAVA_RITMO)
      expect(txt).not.toContain(AVISO)
    })

    it("vazio, null, undefined, ausente e chave órfã NÃO travam: texto idêntico ao de mapa vazio", () => {
      const referencia = resumo(festa({}), { hoje: HOJE })
      for (const mapa of [{ l1: '' }, { l1: null }, { l1: undefined }, { removido: 100 }])
        expect(resumo(festa(mapa), { hoje: HOJE })).toBe(referencia)
      const semConfig = festa({}, (e) => { delete e.cenariosConfig })
      expect(resumo(semConfig, { hoje: HOJE })).toBe(referencia)
    })

    it('trava só no PESSIMISTA: linha-chave e ritmo realistas continuam numéricos', () => {
      const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
      const txt = resumo(e, { hoje: HOJE })
      expect(linhaChave(txt)).toBe('Margem realista 47,5% · break-even 568 pagos · público 1.080')
      expect(linhas(txt)).toContain(BASE_SEM_TRAVA_RITMO)
      expect(txt).not.toContain(AVISO)
    })

    it('trava só no OTIMISTA também não toca o realista', () => {
      const e = festa({}, (x) => { x.cenariosConfig.overrides.otimista = { l3: 20 } })
      const txt = resumo(e, { hoje: HOJE })
      expect(linhaChave(txt)).toContain('break-even 568 pagos')
      expect(txt).not.toContain(AVISO)
    })

    it('"não fecha" SEM trava segue dizendo "não fecha" (a trava não apagou o caso antigo)', () => {
      const e = festa({}, (x) => { x.categorias.find((c) => c.id === 'aeb').itens[0].estimado = 400000 })
      const c = computeCenarios(e)
      expect(c.realista.breakEvenNaoFecha).toBe(true) // controle: este cenário realmente não fecha
      const txt = resumo(e, { hoje: HOJE })
      expect(linhaChave(txt)).toContain(`break-even: ${BREAK_EVEN_NAO_FECHA}`)
      expect(linhas(txt)).toContain(RITMO_NAO_FECHA)
      expect(txt).not.toContain(AVISO)
    })
  })

  it('o relógio padrão (sem `hoje`) também decide: com a trava, a notícia; sem ela, a meta', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 11, 1, 12))
    expect(linhas(resumoCurto(festa(CHEIO))).filter((l) => l === RITMO_WHATSAPP_TRAVADO)).toHaveLength(1)
    expect(linhas(resumoCurto(festa({})))).toContain(BASE_SEM_TRAVA_RITMO)
  })
})

describe('S6 ritmo puro (relatório, Home e função comum): a mesma notícia, sem meta', () => {
  it.each(TRAVADOS)('%s', (_nome, mapa) => {
    const e = festa(mapa)
    const r = ritmoCom(e)
    // relatório/PDF: o dado da bilheteria + a notícia; Home e função comum: só a notícia (sem prefixo)
    expect(r.relatorio).toBe(RITMO_RELATORIO_TRAVADO)
    expect(r.home).toEqual({ tom: 'alerta', texto: AVISO })
    expect(r.puro).toEqual({ tom: 'alerta', texto: AVISO })
    for (const t of [r.relatorio, r.home.texto, r.puro.texto]) for (const proibido of META_DE_RITMO) expect(t).not.toMatch(proibido)
    // fora o "100" do prefixo, nenhum número sobra no relatório; Home e função comum não têm dígito algum
    expect(r.relatorio.replace('100 vendidos até hoje. ', '')).not.toMatch(/\d/)
    for (const t of [r.home.texto, r.puro.texto]) expect(t).not.toMatch(/\d|vendidos/i)
  })

  it('o prefixo usa o separador de milhar da casa (1.234, não 1234) no WhatsApp e no relatório', () => {
    const e = festa(CHEIO, (x) => { x.vendidosAteHoje = 1234 })
    expect(ritmoCom(e).relatorio).toBe(`1.234 vendidos até hoje. ${AVISO}`)
    expect(linhas(resumoCurto(e, { hoje: HOJE }))).toContain(`Vendidos até hoje: 1.234. ${AVISO}`)
    expect(linhas(resumoCompleto(e, { hoje: HOJE }))).toContain(`Vendidos até hoje: 1.234. ${AVISO}`)
  })

  it('vendidos = 0 (preenchido, não vazio) também imprime o prefixo: zero vendido é dado, não ausência', () => {
    const e = festa(CHEIO, (x) => { x.vendidosAteHoje = 0 })
    expect(ritmoCom(e).relatorio).toBe(`0 vendidos até hoje. ${AVISO}`)
    expect(linhas(resumoCurto(e, { hoje: HOJE }))).toContain(`Vendidos até hoje: 0. ${AVISO}`)
  })

  it('sem trava as três leituras seguem numéricas e idênticas às de antes', () => {
    const e = festa({})
    const r = ritmoCom(e)
    expect(r.puro).toBeNull()
    expect(r.relatorio).toBe(
      '100 vendidos até hoje. Faltam 468 ingressos em 31 dia(s) de venda → precisa vender 16 por dia para cobrir o break-even (568).'
    )
    expect(r.home).toEqual({ tom: 'alerta', texto: 'Faltam 468 p/ break-even · 16/dia' })
    // chamada ANTIGA (sem o argumento dos cenários): mesmo resultado
    const c = computeCenarios(e)
    expect(linhaRitmoRelatorio(e, c.realista.breakEven, HOJE)).toBe(r.relatorio)
    expect(linhaRitmoHome(e, c.realista.breakEven, HOJE)).toEqual(r.home)
  })

  it('a função comum calcula os cenários sozinha quando não os recebe, e só quando há trava', () => {
    const e = festa(CHEIO)
    expect(avisoRitmoQuantidadeTravada(e, HOJE)).toEqual({ tom: 'alerta', texto: AVISO })
    expect(avisoRitmoQuantidadeTravada(festa({}), HOJE)).toBeNull()
    expect(avisoRitmoQuantidadeTravada(null, HOJE)).toBeNull()
  })

  it('trava só no pessimista: o ritmo realista não muda', () => {
    const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const r = ritmoCom(e)
    expect(r.puro).toBeNull()
    expect(r.home.texto).toBe('Faltam 468 p/ break-even · 16/dia')
    expect(r.relatorio).toContain('precisa vender 16 por dia')
  })
})

describe('S6 glossário "Como ler este relatório"', () => {
  const be = (e, realista, c) => Object.fromEntries(legendasRelatorio(e, realista, c))['Break-even (BE)']

  it.each(TRAVADOS)('%s: a definição é a própria notícia, sem "Neste evento: N"', (_n, mapa) => {
    const e = festa(mapa)
    const c = computeCenarios(e)
    expect(be(e, c.realista, c)).toBe(AVISO)
    expect(be(e, c.realista, c)).not.toMatch(/Neste evento/)
    expect(be(e, c.realista, c)).not.toMatch(/não existe esse número/)
  })

  it('sem trava: a definição com o número do evento, como antes', () => {
    const e = festa({})
    const c = computeCenarios(e)
    expect(be(e, c.realista, c)).toBe(
      'Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro. Neste evento: 568 ingressos pagos.'
    )
    // chamada antiga (sem cenários) idêntica
    expect(be(e, c.realista)).toBe(be(e, c.realista, c))
  })

  it('sem o cenário realista (o ReportView passa null quando há dado quebrado): definição genérica, sem número', () => {
    const e = festa(CHEIO)
    const c = computeCenarios(e)
    expect(be(e, null, c)).toBe('Quantos ingressos pagos precisam ser vendidos para o evento empatar — a partir daí é lucro.')
  })

  it('só o verbete do break-even muda: os demais termos e a ordem são os mesmos de sem trava', () => {
    const comTrava = festa(CHEIO)
    const sem = festa({})
    const lt = legendasRelatorio(comTrava, computeCenarios(comTrava).realista, computeCenarios(comTrava))
    const ls = legendasRelatorio(sem, computeCenarios(sem).realista, computeCenarios(sem))
    expect(lt.map(([t]) => t)).toEqual(ls.map(([t]) => t))
    const difere = lt.filter(([t, d], i) => d !== ls[i][1]).map(([t]) => t)
    // a margem e o ticket dependem dos pagos e também mudam com a trava (conta real); o BE é o que tem de mudar
    expect(difere).toContain('Break-even (BE)')
  })

  it('trava só no pessimista: o realista continua com o número', () => {
    const e = festa({}, (x) => { x.cenariosConfig.overrides.pessimista = { l1: 100 } })
    const c = computeCenarios(e)
    expect(be(e, c.realista, c)).toContain('Neste evento: 568 ingressos pagos.')
  })
})

describe('S6 sobreposição com dado inválido (#98): "não dá para calcular" vence a trava', () => {
  const sintetico = {
    'custo estimado = 1e308': (e) => { e.categorias.find((c) => c.id === 'aeb').itens[0].estimado = 1e308 },
    'ticket de bar realista = 1e308': (e) => { e.barTicket.realista = 1e308 },
  }

  describe.each(Object.entries(sintetico))('%s', (_nome, quebra) => {
    const monta = () => festa(CHEIO, quebra)

    it('controle: as guardas existentes ACUSAM o defeito antes das asserções de texto', () => {
      const e = monta()
      const c = computeCenarios(e)
      expect(cenarioQuebrado(e, c.realista, c) || receitaDoCenarioQuebrada(e, c.realista, c)).toBe(true)
    })

    it.each([
      ['resumoCurto', resumoCurto],
      ['resumoCompleto', resumoCompleto],
    ])('%s: a linha-chave diz NUMERO_NAO_CALCULA e o aviso de trava não aparece em lugar nenhum', (_n, resumo) => {
      const txt = resumo(monta(), { hoje: HOJE })
      expect(linhaChave(txt)).toContain(`break-even: ${NUMERO_NAO_CALCULA}`)
      expect(txt).not.toContain(AVISO)
    })

    it('ritmo (WhatsApp, relatório, Home) diz "não dá para calcular", sem meta e sem aviso de trava', () => {
      const e = monta()
      const r = ritmoCom(e)
      expect(r.relatorio).toBe(NUMERO_NAO_CALCULA)
      expect(r.home).toEqual({ tom: 'alerta', texto: NUMERO_NAO_CALCULA })
      expect(r.puro).toEqual({ tom: 'alerta', texto: NUMERO_NAO_CALCULA })
      const curto = linhas(resumoCurto(e, { hoje: HOJE }))
      expect(curto).toContain(NUMERO_NAO_CALCULA)
      expect(curto).not.toContain(AVISO)
    })

    it('glossário: o verbete do break-even diz "não dá para calcular", não a trava', () => {
      const e = monta()
      const c = computeCenarios(e)
      const def = Object.fromEntries(legendasRelatorio(e, c.realista, c))['Break-even (BE)']
      expect(def).toBe(NUMERO_NAO_CALCULA)
      expect(def).not.toBe(AVISO)
    })
  })

  it('ticket de bar do OTIMISTA = 1e308 com o realista travado: o realista recebe a trava, o otimista o dado inválido', () => {
    const e = festa(CHEIO, (x) => { x.barTicket.otimista = 1e308 })
    const c = computeCenarios(e)
    // controle: o otimista acusa; o realista não
    expect(receitaDoCenarioQuebrada(e, c.otimista, c)).toBe(true)
    expect(cenarioQuebrado(e, c.realista, c) || receitaDoCenarioQuebrada(e, c.realista, c)).toBe(false)
    for (const resumo of [resumoCurto, resumoCompleto]) {
      const txt = resumo(e, { hoje: HOJE })
      expect(linhaChave(txt)).toBe(`Margem realista 52,7% · break-even: ${AVISO} · público 1.200`)
      expect(linhas(txt)).toContain(RITMO_WHATSAPP_TRAVADO)
      expect(txt).toMatch(new RegExp(`otimista:? (lucro )?${NUMERO_NAO_CALCULA}`, 'i'))
    }
    expect(ritmoCom(e).relatorio).toBe(RITMO_RELATORIO_TRAVADO)
    expect(Object.fromEntries(legendasRelatorio(e, c.realista, c))['Break-even (BE)']).toBe(AVISO)
  })
})

describe('S6 × #98 — a soma que não cabe em OUTRO cenário (insumo compartilhado) também vence a trava', () => {
  // Lote 1 a R$ 1e306 e o realista travado em 1 ingresso nele: a receita do
  // realista, SOZINHA, cabe (9,5e305); pessimista e otimista (que vendem
  // 320 e 400 ingressos do lote) estouram. Quem sabe que a origem dos três
  // está quebrada é a guarda que recebe os TRÊS cenários — por isso o texto
  // precisa receber `cenarios`.
  const monta = () => festa({ l1: 1 }, (e) => { e.lotes[0].valor = 1e306 })

  it('controle: sozinho o realista cabe; com a visão dos três, as guardas acusam', () => {
    const e = monta()
    const c = computeCenarios(e)
    expect(cenarioQuebrado(e, c.realista)).toBe(false)
    expect(cenarioQuebrado(e, c.realista, c)).toBe(true)
    expect(receitaDoCenarioQuebrada(e, c.realista, c)).toBe(true)
  })

  it('aviso, glossário, ritmo e WhatsApp dizem "não dá para calcular" — e a trava não aparece', () => {
    const e = monta()
    const c = computeCenarios(e)
    expect(Object.fromEntries(legendasRelatorio(e, c.realista, c))['Break-even (BE)']).toBe(NUMERO_NAO_CALCULA)
    const r = ritmoCom(e, c)
    expect(r.relatorio).toBe(NUMERO_NAO_CALCULA)
    expect(r.home).toEqual({ tom: 'alerta', texto: NUMERO_NAO_CALCULA })
    expect(r.puro).toEqual({ tom: 'alerta', texto: NUMERO_NAO_CALCULA })
    for (const resumo of [resumoCurto, resumoCompleto]) {
      const txt = resumo(e, { hoje: HOJE })
      expect(linhaChave(txt)).toContain(`break-even: ${NUMERO_NAO_CALCULA}`)
      expect(txt).not.toContain(AVISO)
    }
  })
})

describe('S6 × #98 × tempo — dado inválido vence também a marcação de realizado e a data ilegível', () => {
  // O plano fecha a ordem na função comum de ritmo: dado inválido primeiro, só
  // depois o estado da data. Fica registrado aqui para quem mexer na ordem.
  it.each([
    ['festa já realizada', (e) => { e.data = '2026-11-15' }],
    ['data ilegível', (e) => { e.data = 'abacaxi' }],
  ])('%s + custo 1e308 + trava: o ritmo diz "não dá para calcular"', (_n, tempo) => {
    const e = festa(CHEIO, (x) => { tempo(x); x.categorias.find((cat) => cat.id === 'aeb').itens[0].estimado = 1e308 })
    const c = computeCenarios(e)
    expect(cenarioQuebrado(e, c.realista, c)).toBe(true) // controle
    const r = ritmoCom(e, c)
    expect(r.puro).toEqual({ tom: 'alerta', texto: NUMERO_NAO_CALCULA })
    expect(r.relatorio).toBe(NUMERO_NAO_CALCULA)
    expect(r.home.texto).toBe(NUMERO_NAO_CALCULA)
  })
})

describe('S6 estados temporais (relógio fixo em 01/12/2026)', () => {
  it('festa JÁ REALIZADA, travada: a marcação de realizado nas leituras de ritmo; a chave segue com o aviso', () => {
    const e = festa(CHEIO, (x) => { x.data = '2026-11-15' })
    const r = ritmoCom(e)
    expect(r.relatorio).toBe(MARCACAO_REALIZADA)
    expect(r.home).toEqual({ tom: 'neutro', texto: MARCACAO_REALIZADA })
    expect(r.puro).toEqual({ tom: 'neutro', texto: MARCACAO_REALIZADA })
    // a marcação vai SOZINHA: "até hoje" não quer dizer nada depois da festa, então sem prefixo de vendidos
    expect(r.relatorio).not.toMatch(/vendidos até hoje/i)
    for (const resumo of [resumoCurto, resumoCompleto]) {
      const txt = resumo(e, { hoje: HOJE })
      expect(txt).not.toMatch(/Vendidos até hoje/)
      expect(linhas(txt)).toContain(MARCACAO_REALIZADA)
      expect(linhaChave(txt)).toContain(`break-even: ${AVISO}`)
      expect(linhas(txt)).not.toContain(AVISO) // a linha própria do ritmo virou a marcação
    }
  })

  it('festa passada travada com o campo de vendidos VAZIO também recebe a marcação', () => {
    const e = festa(BAIXO, (x) => { x.data = '2026-11-15'; x.vendidosAteHoje = '' })
    expect(ritmoCom(e).relatorio).toBe(MARCACAO_REALIZADA)
    expect(linhas(resumoCurto(e, { hoje: HOJE }))).toContain(MARCACAO_REALIZADA)
  })

  it('festa passada SEM trava segue como era (a marcação já existia)', () => {
    const e = festa({}, (x) => { x.data = '2026-11-15' })
    expect(ritmoCom(e).relatorio).toBe(MARCACAO_REALIZADA)
    expect(ritmoCom(e).puro).toBeNull()
  })

  it('o DIA da festa (hoje) ainda é futuro: a trava publica o aviso', () => {
    const e = festa(CHEIO, (x) => { x.data = HOJE })
    expect(ritmoCom(e).relatorio).toBe(RITMO_RELATORIO_TRAVADO)
    expect(linhas(resumoCurto(e, { hoje: HOJE }))).toContain(RITMO_WHATSAPP_TRAVADO)
  })

  it.each(['05/12/2026', 'abacaxi', '2027-13-45'])(
    'data ilegível (%s) com vendidos preenchidos: "data inválida", nunca "0/dia" nem "0 por dia"',
    (data) => {
      const e = festa(CHEIO, (x) => { x.data = data })
      const r = ritmoCom(e)
      expect(r.relatorio).toBe(DATA_DO_EVENTO_ILEGIVEL)
      expect(r.home).toEqual({ tom: 'alerta', texto: DATA_DO_EVENTO_ILEGIVEL })
      for (const resumo of [resumoCurto, resumoCompleto]) {
        const txt = resumo(e, { hoje: HOJE })
        expect(linhas(txt)).toContain(DATA_DO_EVENTO_ILEGIVEL)
        expect(txt).not.toMatch(/0\/dia|0 por dia|0 dia\(s\)/)
      }
    }
  )

  it('data ilegível + campo de vendidos vazio + trava: o aviso da trava (não há meta, não há "0/dia")', () => {
    const e = festa(CHEIO, (x) => { x.data = 'abacaxi'; x.vendidosAteHoje = '' })
    const r = ritmoCom(e)
    expect(r.relatorio).toBe(AVISO)
    expect(r.relatorio).not.toMatch(/0\/dia|0 por dia/)
  })

  it.each([undefined, null, ''])('festa FUTURA travada com vendidos vazio (%s): o aviso — não some a linha', (vazio) => {
    const e = festa(CHEIO, (x) => { x.vendidosAteHoje = vazio })
    const r = ritmoCom(e)
    expect(r.relatorio).toBe(AVISO)
    expect(r.home).toEqual({ tom: 'alerta', texto: AVISO })
    // vendidos vazio: SÓ o aviso, sem prefixo (nada foi informado para imprimir) e sem "0 vendidos"
    expect(r.relatorio).not.toMatch(/vendidos até hoje/i)
    expect(linhas(resumoCurto(e, { hoje: HOJE }))).toContain(AVISO)
    expect(resumoCurto(e, { hoje: HOJE })).not.toMatch(/Vendidos até hoje/)
    expect(resumoCompleto(e, { hoje: HOJE })).not.toMatch(/Vendidos até hoje/)
    expect(linhas(resumoCompleto(e, { hoje: HOJE })).filter((l) => l === AVISO)).toHaveLength(1)
  })

  it('o mesmo evento, SEM trava e com vendidos vazio, não ganha o aviso (a Home segue calada, como antes)', () => {
    const e = festa({}, (x) => { x.vendidosAteHoje = '' })
    expect(ritmoCom(e).puro).toBeNull()
    expect(ritmoCom(e).home).toBeNull()
    expect(resumoCurto(e, { hoje: HOJE })).not.toContain(AVISO)
  })
})
