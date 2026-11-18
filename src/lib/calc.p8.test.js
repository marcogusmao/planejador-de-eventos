// P8 — lote SEM PREÇO fica fora de público e bar (Marco, 06/10/2026, por
// questionário; ficha "S1 — P8" do BACKLOG.md). A fotografia de ponta a ponta
// mora em golden.test.js; este arquivo existe porque ela SOZINHA não guarda o
// conserto: o conserto tem quatro guardas em calc.js (isCortesia,
// loteQtdCenario, bilheteria e a busca do mínimo em pctsDeDegrau), e desfazer
// QUALQUER UMA isoladamente deixa a fotografia verde (medido em 06/10/2026).
// Cada guarda tem aqui o teste que só ela satisfaz.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { isPrecoAusente, isCortesia, loteQtdCenario, bilheteria, computeCenarios, computeCenario } from './calc.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { migrarEvento, censoNormalizacoes } from './migracao.js'
import { receitaQuebrada } from './dadoQuebrado.js'
import { ingressosPrevistosRealista } from './financeiro.js'
import { totalPlanoLotes, lotesDoPlano } from './curvaVendas.js'
import { montarBackup, parseBackup } from './storage.js'

// Fixture LOCAL — cópia do corpo de eventoSemPreco() em
// scripts/provas-s0/cenarios.fixture.js (não importar de scripts/).
function eventoSemPreco() {
  const e = novoEvento('S7 — evento sintético com preço ausente')
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Lote sem preço', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}

const CENARIOS = ['pessimista', 'realista', 'otimista']
const CAMPOS = ['pagos', 'cortesias', 'publico', 'bruta', 'taxa', 'cashback', 'liquida', 'bar', 'receitaTotal', 'custoTotal', 'lucro', 'breakEven']
const foto = (c) => Object.fromEntries(CENARIOS.map((k) => [k, Object.fromEntries(CAMPOS.map((f) => [f, c[k][f]]))]))
const semOLote = (e) => ({ ...e, lotes: e.lotes.filter((l) => l.id !== 'l4') })
const comAjuste = (e, v) => ({
  ...e,
  cenariosConfig: {
    ...e.cenariosConfig,
    overrides: { pessimista: { l4: v }, realista: { l4: v }, otimista: { l4: v } },
  },
})
const comPreco = (e, v) => ({ ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, valor: v } : l)) })
const comLote = (e, patch) => ({ ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, ...patch } : l)) })
const cfgDe = (e) => e.cenariosConfig

describe('API nova — isPrecoAusente e isCortesia (P8)', () => {
  it('1. isPrecoAusente: vazio, null, undefined e campo ausente são ausentes; 0, texto e espaços não', () => {
    for (const v of ['', null, undefined]) expect(isPrecoAusente({ valor: v })).toBe(true)
    expect(isPrecoAusente({})).toBe(true)
    for (const v of [0, '0', 100, '100', 'abc', '   ']) expect(isPrecoAusente({ valor: v })).toBe(false)
    // '   ' cru não é ausente — mas a migração o normaliza para '' ao abrir.
    const e = novoEvento('Migração')
    e.lotes = [novoLote({ id: 'x', nome: 'X', valor: '   ', quantidade: 10 })]
    expect(isPrecoAusente(migrarEvento(e).lotes[0])).toBe(true)
  })

  it('2. isCortesia: ausente NÃO é cortesia; 0 e "0" declarados são; 100 não é', () => {
    for (const v of ['', null, undefined]) expect(isCortesia({ valor: v })).toBe(false)
    expect(isCortesia({})).toBe(false)
    expect(isCortesia({ valor: 0 })).toBe(true)
    expect(isCortesia({ valor: '0' })).toBe(true)
    expect(isCortesia({ valor: 100 })).toBe(false)
  })
})

describe('loteQtdCenario — o lote sem preço vale 0 ANTES do override e do "só otimista" (P8)', () => {
  it('3. 0 para preço vazio/null/undefined × qualquer ajuste × só-otimista × três cenários', () => {
    const ajustes = [undefined, 125, 450, 0, '0', '', null]
    for (const valor of ['', null, undefined])
      for (const ov of ajustes)
        for (const somenteOtimista of [false, true])
          for (const k of CENARIOS) {
            const lote = { id: 'l4', nome: 'X', valor, quantidade: 300, somenteOtimista }
            const cfg = { overrides: { [k]: ov === undefined ? {} : { l4: ov } } }
            expect(loteQtdCenario(lote, k, cfg), `valor=${String(valor)} ov=${String(ov)} so=${somenteOtimista} ${k}`).toBe(0)
          }
  })

  it('4. controle: preço 0 declarado entra inteiro (300) e obedece o ajuste; preço 100 obedece o %', () => {
    const e = eventoSemPreco()
    const cort = { id: 'l4', nome: 'X', valor: 0, quantidade: 300 }
    expect(CENARIOS.map((k) => loteQtdCenario(cort, k, cfgDe(e)))).toStrictEqual([300, 300, 300])
    const cfg125 = cfgDe(comAjuste(e, 125))
    expect(CENARIOS.map((k) => loteQtdCenario(cort, k, cfg125))).toStrictEqual([125, 125, 125])
    const pago = { id: 'l4', nome: 'X', valor: 100, quantidade: 300 }
    expect(CENARIOS.map((k) => loteQtdCenario(pago, k, cfgDe(e)))).toStrictEqual([240, 270, 300])
  })
})

describe('bilheteria — quantidade passada para lote sem preço não vira pagante nem cortesia (P8)', () => {
  it('5. bilheteria(lotes, {l1: 540, c: 50, l4: 125}) → 540 pagos, 50 cortesias, 590 público, R$ 54.000', () => {
    const e = eventoSemPreco()
    const b = bilheteria(e.lotes, { l1: 540, c: 50, l4: 125 }, 10, 5)
    expect([b.pagos, b.cortesias, b.publico, b.bruta]).toStrictEqual([540, 50, 590, 54000])
    expect(b.porLote[2]).toMatchObject({ id: 'l4', qtd: 0, receita: 0 })
    // controle: com preço 0 declarado, as 125 são cortesias
    const z = bilheteria(comPreco(e, 0).lotes, { l1: 540, c: 50, l4: 125 }, 10, 5)
    expect(z.cortesias).toBe(175)
  })
})

describe('computeCenarios — com o lote sem preço é EXATAMENTE a festa sem ele (P8)', () => {
  const variacoes = [
    ['sem ajuste', (e) => e],
    ['ajuste 125', (e) => comAjuste(e, 125)],
    ['ajuste 450', (e) => comAjuste(e, 450)],
    ['desconto 10% em 270 ingressos (modo nº)', (e) => ({ ...e, descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: 270 })],
    ['desconto modo nº + ajuste 125', (e) => comAjuste({ ...e, descontoMedioPct: 10, descontoIngressosModo: 'numero', descontoIngressosValor: 270 }, 125)],
    ['ticket médio manual 120 no realista', (e) => ({ ...e, cenariosConfig: { ...e.cenariosConfig, realista: { ...e.cenariosConfig.realista, ticketMedio: 120 } } })],
    ['imposto 6% sobre bilheteria e bar', (e) => ({ ...e, impostoPct: 6, impostoSobre: { bilheteria: true, bar: true, patrocinio: false } })],
    ['open bar', (e) => ({ ...e, openBar: true })],
    ['bar fixo R$ 20.000', (e) => ({ ...e, barModo: '', outrasReceitas: { bar: 20000, patrocinio: '' } })],
    ['só otimista + ajuste 450', (e) => comAjuste(comLote(e, { somenteOtimista: true }), 450)],
    ['preço null', (e) => comPreco(e, null)],
    ['preço undefined', (e) => comPreco(e, undefined)],
  ]
  it.each(variacoes)('6. %s', (_nome, montar) => {
    const e = montar(eventoSemPreco())
    expect(foto(computeCenarios(e))).toStrictEqual(foto(computeCenarios(semOLote(e))))
  })

  it(
    '7. lote sem preço de 100.000.000 ingressos: a conta leva menos de 1 s e o mínimo realista é 293',
    () => {
      const e = comLote(eventoSemPreco(), { quantidade: 100000000 })
      const t0 = performance.now()
      const c = computeCenarios(e)
      const ms = performance.now() - t0
      expect(ms, `computeCenarios levou ${ms.toFixed(0)} ms`).toBeLessThan(1000)
      expect(c.realista.breakEven).toBe(293)
    },
    15000
  )

  it('8. texto ilegível no preço continua dado quebrado, não "sem preço"', () => {
    const e = eventoSemPreco()
    expect(receitaQuebrada({ ...e, lotes: [{ id: 'x', nome: 'X', valor: 'abc', quantidade: 10 }] }).ha).toBe(true)
  })

  it('9. consumidores: ingressos previstos 590 (= público realista) e o plano dos lotes sem o lote', () => {
    const e = eventoSemPreco()
    expect(ingressosPrevistosRealista(e)).toBe(590)
    expect(ingressosPrevistosRealista(e)).toBe(computeCenario(e, 'realista').publico)
    expect(totalPlanoLotes(e)).toBe(totalPlanoLotes(semOLote(e)))
    expect(totalPlanoLotes(e)).toBe(60000)
    expect(lotesDoPlano(e).map((l) => l.id)).toStrictEqual(['l1'])
  })
})

describe('persistência — o lote sem preço e o ajuste ficam salvos como estavam (P8)', () => {
  // storage.js toca localStorage em algumas rotas; um de mentira por garantia.
  let original
  beforeAll(() => {
    original = globalThis.localStorage
    const mapa = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
      setItem: (k, v) => mapa.set(k, String(v)),
      removeItem: (k) => mapa.delete(k),
      clear: () => mapa.clear(),
      get length() {
        return mapa.size
      },
      key: (i) => [...mapa.keys()][i] ?? null,
    })
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    if (original !== undefined) globalThis.localStorage = original
  })

  it('10. censo vazio; export → import devolve valor "" e quantidade 300 com o ajuste 125; mesmos números', () => {
    const e = eventoSemPreco()
    const e2 = comAjuste(e, 125)
    expect(censoNormalizacoes([e2])).toStrictEqual([])
    const texto = JSON.stringify(montarBackup({ eventos: [e2], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }))
    const volta = parseBackup(texto).eventos[0]
    const l4 = volta.lotes.find((l) => l.id === 'l4')
    expect(l4.valor).toBe('')
    expect(l4.quantidade).toBe(300)
    expect(volta.cenariosConfig.overrides.realista.l4).toBe(125)
    expect(foto(computeCenarios(volta))).toStrictEqual(foto(computeCenarios(semOLote(e))))
  })
})
