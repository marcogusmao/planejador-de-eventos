// @vitest-environment jsdom
// Diagnóstico S0: asserções do comportamento correto, sem consertar produção.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { novoEvento, novoItem, novoLote } from '../../src/lib/defaults.js'
import { validarCurvaFinanceiro, mediaHistorica, mediaHistoricaNormalizada, fracaoNormalizada, curvaPlanoForma, curvaPlanoJanela, curvaPlanoDatas, addDiasISO, saveCurvaCache, loadCurvaCache } from '../../src/lib/curvaVendas.js'
import { entradaAteODia, analisarCaixa } from '../../src/lib/analiseCaixa.js'
import { aplicarCarregar, desfazerCarregar } from '../../src/lib/carregarBenchmark.js'
import { reduzirComHistorico, historicoVazio } from '../../src/lib/historico.js'
import { migrarEvento, censoNormalizacoes } from '../../src/lib/migracao.js'
import { parseBackup, mesclarBackup, saveStore, loadStore, montarBackup, liberarGravacao } from '../../src/lib/storage.js'
import { fechamentoReceita, resultadoRealizado } from '../../src/lib/fechamento.js'
import { computeCenario, valorConsiderado, custosPorCategoria } from '../../src/lib/calc.js'
import FechamentoTab from '../../src/components/FechamentoTab.jsx'
import AnaliseTab from '../../src/components/AnaliseTab.jsx'

const recibo = (id, observado, esperado) => console.info(JSON.stringify({ id, observado, esperado }))
const texto = (el) => el.textContent.replace(/\s+/g, ' ')
const noop = () => {}
const festa = () => ({ ...novoEvento('Festa sintética S0'), id: 's0', data: '2026-09-09', taxaBilheteria: 0, cashbackPct: 0, contingenciaPct: 0, barModo: 'fixo', categorias: [], lotes: [] })
const categoria = (id, valor) => ({ id, nome: id, itens: [novoItem({ id: `original-${id}`, servico: 'Buffet sintético', estimado: valor })] })
const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })
// Node desta máquina expõe um localStorage sem métodos. Usar a implementação
// real do jsdom com origem sintética; storage.js permanece integral, sem mock.
const armazenamentoDOM = new JSDOM('', { url: 'http://s0.invalid' })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamentoDOM.window.localStorage })
beforeEach(() => { localStorage.clear(); liberarGravacao(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-08-10T12:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers() })

function historico(dias, total) {
  return validarCurvaFinanceiro({ eventos: [{ evento_id: 7, nome: 'Brisa sintética com estorno', data: '2026-05-01', empresa: 'Brisa', total_valor: total, total_pagamentos: dias.length, dias: dias.map(([dia, valor]) => ({ dia, valor, pagamentos: 1 })) }], eventos_sem_data: [] })
}
const opcoes = { hoje: '2026-08-10' }

describe('P2 — estorno na curva', () => {
  it('não excede 100%, não reduz e não cobre cachê acima da receita final', () => {
    const curva = historico([[-11, 100000], [-10, -20000]], 80000)
    const media = mediaHistorica(curva, opcoes)
    const mediaNorm = mediaHistoricaNormalizada(curva, opcoes)
    const e = { ...festa(), lotes: [novoLote({ quantidade: 1000, valor: 200 })], categorias: [{ ...categoria('artistico', 220000), itens: [novoItem({ estimado: 220000, dataPagamento: addDiasISO(festa().data, -11) })] }] }
    for (const [modo, plano] of [['forma', curvaPlanoForma(e, media)], ['janela', curvaPlanoJanela(e, mediaNorm, -11)]]) {
      const caixa = analisarCaixa(e, plano.pontos)
      const pico = Math.max(...plano.pontos.map(p => p.valor))
      const saldo = caixa.dias.find(d => d.dia === -11).saldo
      recibo(`P2-${modo}`, { picoFracao: Math.max(...media.pontos.map(p => p.fracao)), pico, saldoD11: saldo, ajustes: media.ajustes ?? null }, { picoFracao: 1, pico: 200000, saldoD11: -20000, aviso: 'Brisa sintética com estorno / 20000' })
      expect.soft(pico).toBeLessThanOrEqual(200000)
      expect.soft(saldo).toBeLessThanOrEqual(-20000)
      expect.soft(plano.pontos.every((p, i, a) => i === 0 || p.valor >= a[i - 1].valor)).toBe(true)
    }
    expect.soft(media.ajustes).toEqual(expect.arrayContaining([expect.objectContaining({ nome: 'Brisa sintética com estorno', estorno: 20000 })]))
  })
  it('50/-20/70 não volta atrás, inclusive consultando o fim primeiro', () => {
    const festas = mediaHistoricaNormalizada(historico([[-10, 50], [-5, -20], [0, 70]], 100), opcoes).festas
    for (const ordem of [[0, .5, 1], [1, .5, 0], [1, 0, .5]]) {
      const observado = ordem.map(u => fracaoNormalizada(festas, u))
      const esperado = ordem.map(u => u === 1 ? 1 : .5)
      recibo('P2-ordem', { ordem, fracoes: observado }, esperado)
      expect.soft(observado).toEqual(esperado)
    }
  })
  it('controle sem estorno e total não positivo', () => {
    const c = historico([[-10, 50], [-5, 20], [0, 30]], 100)
    const f = mediaHistoricaNormalizada(c, opcoes).festas
    expect([0, .5, 1].map(u => fracaoNormalizada(f, u))).toEqual([.5, .7, 1])
    expect(mediaHistorica(historico([[-1, 0]], 0), opcoes)).toBeNull()
    expect(mediaHistorica(historico([[-1, -10]], -10), opcoes)).toBeNull()
    recibo('P2-controles', [.5, .7, 1], [.5, .7, 1])
  })
  it('cache sem metadados novos permanece legível e Análise avisa o estorno em forma e janela', () => {
    const curva = historico([[-11, 100000], [-10, -20000]], 80000)
    saveCurvaCache(curva, '2026-08-10T12:00:00Z')
    expect(loadCurvaCache().curva).toEqual(curva)
    for (const inicioVendas of ['', addDiasISO(festa().data, -11)]) {
      const e = { ...festa(), curvaModo: 'forma', inicioVendas, lotes: [novoLote({ quantidade: 1000, valor: 200 })] }
      const c = render(<AnaliseTab evento={e} update={noop} />).container
      const t = texto(c)
      recibo(`P2-aviso-${inicioVendas ? 'janela' : 'forma'}`, t, 'Aviso nomeando Brisa sintética com estorno e R$ 20.000')
      expect.soft(t).toMatch(/estorno/i)
      expect.soft(t).toMatch(/Brisa sintética/)
      expect.soft(t).toMatch(/20\.000/)
      cleanup()
    }
  })
})

function comLotes(dias = [-30, -30]) {
  const e = festa()
  return { ...e, curvaModo: 'datas', lotes: dias.map((d, i) => novoLote({ id: `l${i}`, nome: `Lote ${i + 1}`, valor: i ? 150 : 100, quantidade: 100, viradaPrevista: d == null ? '' : addDiasISO(e.data, d) })), categorias: [{ ...categoria('artistico', 30000), itens: [novoItem({ id: 'cache', servico: 'Cachê sintético', estimado: 30000, dataPagamento: addDiasISO(e.data, -30) })] }] }
}
describe('P7 — dois lotes no mesmo dia', () => {
  it('conta R$ 25 mil em D-30 e mostra o efeito integral da fusão proposta', () => {
    const e = comLotes()
    const plano = curvaPlanoDatas(e)
    // Contrafactual explícito do desenho do plano, não alteração nem aprovação de fórmula.
    const proposta = [{ dia: -60, valor: 0 }, { dia: -30, valor: 25000 }, { dia: 0, valor: 25000 }]
    const dias = [-60, -45, -31, -30, -29, 0]
    const atual = dias.map(dia => ({ dia, valor: entradaAteODia(plano.pontos, dia) }))
    const comparativo = dias.map(dia => ({ dia, valor: entradaAteODia(proposta, dia) }))
    recibo('P7-conta', { pontos: plano.pontos, marcos: atual, caixaMinimo: analisarCaixa(e, plano.pontos).caixaMinimo }, { marcosPropostos: comparativo, caixaMinimo: analisarCaixa(e, proposta).caixaMinimo })
    expect.soft(entradaAteODia(plano.pontos, -30)).toBe(25000)
    expect.soft(analisarCaixa(e, plano.pontos).caixaMinimo).toEqual({ dia: -30, saldo: -5000 })
    expect(entradaAteODia(proposta, -45)).toBe(12500)
  })
  it.each([['fora de ordem', [-30, -40], -30], ['último sem virada', [0, null], 0], ['piso D-60', [-60, -60], -60], ['D-122', [-122, -122], -122]])('%s: lê todo o acumulado no marco', (nome, dias, marco) => {
    const plano = curvaPlanoDatas(comLotes(dias))
    const valor = entradaAteODia(plano.pontos, marco)
    recibo(`P7-${nome}`, { pontos: plano.pontos, valor, viradas: plano.viradas }, { dia: marco, valor: 25000 })
    expect(valor).toBe(25000)
  })
  it('aba Análise publica o caixa mínimo sem perder o lote empatado', () => {
    const c = render(<AnaliseTab evento={comLotes()} update={noop} />).container
    const t = texto(c)
    recibo('P7-tela', t, 'Caixa mínimo -R$ 5.000 em D-30')
    expect(t).toMatch(/Caixa mínimo para iniciar-R\$ 5\.000 em D-30/)
  })
})

describe('R2 — leitura do backup e receita realizada', () => {
  it.each([['antigo', false], ['atual', true]])('%s: recusa bar textual com aviso antes de salvar e recarregar', (nome, atual) => {
    const e = { ...festa(), receitaRealizada: { bilheteria: 20000, bar: '14.200,00', pix: '' } }
    const bruto = JSON.stringify({ ...(atual ? { app: 'previsao-eventos', versao: 1 } : {}), eventos: [e] })
    const backup = parseBackup(bruto)
    const censo = censoNormalizacoes([e])
    expect(saveStore(mesclarBackup(store(festa()), backup)).ok).toBe(true)
    const reload = loadStore().eventos[0]
    const linha = fechamentoReceita(reload, computeCenario(reload, 'realista')).linhas.find(l => l.nome.startsWith('Bar'))
    const volta = parseBackup(JSON.stringify(montarBackup(loadStore()))).eventos[0]
    recibo(`R2-${nome}`, { barImportado: backup.eventos[0].receitaRealizada.bar, barReload: reload.receitaRealizada.bar, censo, linha, barReimportado: volta.receitaRealizada.bar }, { bar: '', avisoComOriginal: '14.200,00', temRealizado: false })
    expect.soft(reload.receitaRealizada.bar).toBe('')
    expect.soft(censo.some(x => x.valor === '14.200,00')).toBe(true)
    expect.soft(linha.temRealizado).toBe(false)
    expect(migrarEvento(reload)).toEqual(reload)
  })
  it.each([['texto', '14.200,00'], ['objeto', { errado: 1 }], ['infinito em memória', Infinity]])('%s não vira realizado válido', (nome, bar) => {
    const e = { ...festa(), receitaRealizada: { bilheteria: '', bar } }
    const m = migrarEvento(e)
    recibo(`R2-${nome}`, { bar: String(m.receitaRealizada.bar), censo: censoNormalizacoes([e]) }, { bar: '', aviso: true })
    expect.soft(m.receitaRealizada.bar).toBe('')
    expect.soft(censoNormalizacoes([e]).length).toBeGreaterThan(0)
  })
  it('JSON válido com 1e999 não deixa infinito virar receita realizada', () => {
    const bruto = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [{ ...festa(), receitaRealizada: { bilheteria: '', bar: 'S0_INFINITO' } }] }).replace('"S0_INFINITO"', '1e999')
    const importado = parseBackup(bruto)
    const bar = importado.eventos[0].receitaRealizada.bar
    recibo('R2-infinito-JSON', String(bar), 'recusa ou campo vazio com aviso')
    expect(bar).toBe('')
  })
  it.each([-2000, 14200, 0, ''])('preserva bar numérico/vazio %s e seu significado', bar => {
    const e = migrarEvento({ ...festa(), receitaRealizada: { bilheteria: '', bar } })
    expect(e.receitaRealizada.bar).toBe(bar)
    expect(fechamentoReceita(e, {}).linhas[1].temRealizado).toBe(bar !== '')
  })
  it('censo identifica bilheteria negativa e Pix textual antes de apagá-los', () => {
    const e = { ...festa(), receitaRealizada: { bilheteria: -5, bar: '', pix: '14.200,00' } }
    const censo = censoNormalizacoes([e])
    recibo('R2-censo', { migrado: migrarEvento(e).receitaRealizada, censo }, { avisos: [-5, '14.200,00'] })
    expect.soft(censo.some(x => x.valor === -5)).toBe(true)
    expect.soft(censo.some(x => x.valor === '14.200,00')).toBe(true)
  })
  it('Fechamento com bar textual mostra aviso, e registra valores efetivamente exibidos', () => {
    const e = migrarEvento({ ...festa(), receitaRealizada: { bilheteria: 20000, bar: '14.200,00' }, categorias: [categoria('aeb', 20800)] })
    const c = render(<FechamentoTab evento={e} update={noop} store={store(e)} onPromoverBenchmark={noop} onFecharEvento={noop} onReabrirEvento={noop} />).container
    const t = texto(c)
    const conta = resultadoRealizado(e, computeCenario(e, 'realista'))
    recibo('R2-tela', { texto: t, barDoModulo: conta.bar, resultadoDoModulo: conta.resultado }, 'aviso de valor que não pode ser calculado; sem resultado -800 apresentado como certo')
    expect(t).toMatch(/valor que o app não consegue calcular|não dá para calcular/)
    expect(t).not.toMatch(/−?\s*R\$\s*-?800(?:\D|$)/)
  })
})

const alterar = (estado, fn, em) => reduzirComHistorico(estado, { tipo: 'alterar', fn: s => ({ ...s, eventos: [fn(s.eventos[0])] }), descritor: { rotulo: 'Prova S0' }, em })
const total = e => custosPorCategoria(e.categorias).totalConsiderado
describe('R3 — histórico e desfazer do carregamento', () => {
  it.each(['substituir', 'somar'])('%s → histórico → toast mantém uma linha e R$ 12 mil', modo => {
    const antes = { ...festa(), categorias: [categoria('aeb', 12000)] }
    const escolhas = [{ catId: 'aeb', modo, itemId: 'carregado' }]
    let estado = { store: store(antes), hist: historicoVazio() }
    estado = alterar(estado, e => aplicarCarregar(e, { nome: 'Referência sintética', custos: { aeb: 16420 } }, escolhas), 1)
    estado = reduzirComHistorico(estado, { tipo: 'desfazer' })
    estado = alterar(estado, e => desfazerCarregar(e, antes, escolhas), 2)
    const depois = estado.store.eventos[0]
    recibo(`R3-${modo}`, { total: total(depois), ids: depois.categorias[0].itens.map(i => i.id) }, { total: 12000, ids: ['original-aeb'] })
    expect.soft(total(depois)).toBe(12000)
    expect.soft(depois.categorias[0].itens).toHaveLength(1)
  })
  it('remoção manual parcial ainda recupera originais e preserva edição posterior; repetir não duplica', () => {
    const antes = { ...festa(), categorias: [categoria('aeb', 12000), categoria('estrutura', 5000)] }
    const escolhas = ['aeb', 'estrutura'].map(catId => ({ catId, modo: 'substituir', itemId: `novo-${catId}` }))
    let estado = { store: store(antes), hist: historicoVazio() }
    estado = alterar(estado, e => aplicarCarregar(e, { custos: { aeb: 16420, estrutura: 9000 } }, escolhas), 1)
    estado = alterar(estado, e => ({ ...e, nome: 'Edição posterior preservada', categorias: e.categorias.map(c => c.id === 'aeb' ? { ...c, itens: c.itens.filter(i => i.id !== 'novo-aeb') } : c) }), 2)
    estado = alterar(estado, e => desfazerCarregar(e, antes, escolhas), 3)
    expect(total(estado.store.eventos[0])).toBe(17000)
    expect(estado.store.eventos[0].nome).toBe('Edição posterior preservada')
    recibo('R3-remocao-manual', { total: total(estado.store.eventos[0]), nome: estado.store.eventos[0].nome }, { total: 17000, nome: 'Edição posterior preservada' })
    estado = alterar(estado, e => desfazerCarregar(e, antes, escolhas), 4)
    recibo('R3-repeticao', { total: total(estado.store.eventos[0]), ids: estado.store.eventos[0].categorias.flatMap(c => c.itens.map(i => i.id)) }, { total: 17000, idsUnicos: true })
    expect(total(estado.store.eventos[0])).toBe(17000)
  })
  it('remover manualmente o único item carregado ainda permite recuperar o original', () => {
    const antes = { ...festa(), categorias: [categoria('aeb', 12000)] }
    const escolhas = [{ catId: 'aeb', modo: 'substituir', itemId: 'novo' }]
    const carregado = aplicarCarregar(antes, { custos: { aeb: 16420 } }, escolhas)
    const removido = { ...carregado, categorias: carregado.categorias.map(c => ({ ...c, itens: [] })) }
    const depois = desfazerCarregar(removido, antes, escolhas)
    recibo('R3-remocao-unico', total(depois), 12000)
    expect(total(depois)).toBe(12000)
  })
})

describe('R2 — casos pulados examinados sob contrato vigente de custouZero', () => {
  it('zero exige marcação explícita; a proposta histórica não é autorização vigente', () => {
    const item = { estimado: 8000, realizado: 0 }
    recibo('R2-zero-proposta-historica', { semMarcacao: valorConsiderado(item), comMarcacao: valorConsiderado({ ...item, custouZero: true }) }, { propostaHistorica: 0, contratoVigenteExigeMarcacao: true })
    expect(valorConsiderado({ ...item, custouZero: true })).toBe(0)
  })
  it('vazio/null/ausente continuam usando estimado; caso são não muda', () => {
    for (const realizado of ['', null, undefined]) expect(valorConsiderado({ estimado: 8000, realizado })).toBe(8000)
    expect(custosPorCategoria([{ itens: [{ estimado: 500, realizado: 520 }, { estimado: 900 }] }]).totalConsiderado).toBe(1420)
  })
  it('total com custo zero explicitamente confirmado respeita a marcação', () => {
    const c = [{ itens: [{ estimado: 500, realizado: 520 }, { estimado: 28050, realizado: 14872 }, { estimado: 8000, realizado: 0 }] }]
    recibo('R2-zero-total-historico', custosPorCategoria(c).totalConsiderado, 15392)
    const confirmado = [{ itens: c[0].itens.map((i, n) => n === 2 ? { ...i, custouZero: true } : i) }]
    expect(custosPorCategoria(confirmado).totalConsiderado).toBe(15392)
  })
})
