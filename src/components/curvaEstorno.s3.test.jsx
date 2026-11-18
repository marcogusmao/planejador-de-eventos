// @vitest-environment jsdom
// P2 S3 — cache v1 real; curva, caixa e telas reais, sem mocks de domínio.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import CurvaVendas from './CurvaVendas.jsx'
import AnaliseTab from './AnaliseTab.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import * as curvas from '../lib/curvaVendas.js'
import { montarBackup, liberarGravacao } from '../lib/storage.js'
import { analisarCaixa } from '../lib/analiseCaixa.js'

const dom = new JSDOM('', { url: 'http://s3.invalid' })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage })
const texto = el => el.textContent.replace(/\s+/g, ' ')
const noop = () => {}
const opts = { hoje: '2026-08-10' }
const referencia = (centavos = false) => ({ id: 7, nome: 'Brisa sintética com estorno', empresa: 'Brisa', data: '2026-05-01', totalValor: centavos ? 74999.75 : 80000, dias: [{ dia: -11, valor: 100000, pagamentos: 1 }, { dia: -10, valor: centavos ? -20000.12 : -20000, pagamentos: 1 }, ...(centavos ? [{ dia: 5, valor: -5000.13, pagamentos: 1 }] : [])] })
const curva = (centavos = false) => ({ eventos: [referencia(centavos), { id: 8, nome: 'Marfim sã', empresa: 'Marfim', data: '2026-04-01', totalValor: 100, dias: [{ dia: -10, valor: 50, pagamentos: 1 }, { dia: 0, valor: 50, pagamentos: 1 }] }], eventosSemData: [] })
function festa(inicioVendas = '') {
  return { ...novoEvento('Festa sintética S3'), id: 's3', tipo: 'Brisa', data: '2026-09-09', vendasAbremDiasAntes: 0, inicioVendas, curvaModo: 'forma', taxaBilheteria: 0, cashbackPct: 0, contingenciaPct: 0, caixaInicial: 0,
    lotes: [novoLote({ id: 'l', nome: 'Lote sintético', quantidade: 1000, valor: 200, viradaPrevista: '2026-08-29' })],
    categorias: [{ id: 'artistico', nome: 'Artístico', itens: [novoItem({ servico: 'Cachê sintético', estimado: 220000, dataPagamento: '2026-08-29' })] }] }
}
function montar(Tela, e) { return render(<Tela evento={e} update={noop} />) }
let fetchSpy
beforeEach(() => {
  localStorage.clear(); liberarGravacao()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Montagem não deve buscar rede') })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
const aviso = 'A referência ‘Brisa sintética com estorno’ tem R$ 20.000 em estornos. A fração da curva histórica foi limitada entre 0% e 100% e não recua; os valores originais foram preservados.'

describe('P2 S3 — aviso nas telas com cache legado', () => {
  it.each([['curva forma', CurvaVendas, ''], ['curva janela', CurvaVendas, '2026-08-29'], ['análise forma', AnaliseTab, ''], ['análise janela', AnaliseTab, '2026-08-29']])('%s: remonta nome/valor, sem rede/update/escrita', (_nome, Tela, inicio) => {
    const c = curva(); curvas.saveCurvaCache(c, '2026-08-10T12:00:00Z')
    const cacheAntes = localStorage.getItem('previsao-eventos:curva-financeiro:v1')
    const escrever = vi.spyOn(dom.window.Storage.prototype, 'setItem'), update = vi.fn()
    for (let i = 0; i < 2; i++) {
      const r = render(<Tela evento={festa(inicio)} update={update} />)
      expect(texto(r.container)).toContain(aviso)
      if (Tela === AnaliseTab) {
        expect(texto(r.container)).toContain('Caixa mínimo para iniciar-R$ 20.000 em D-11')
        const agenda = [...r.container.querySelectorAll('tr')].find(tr => tr.textContent.includes('Cachê sintético'))
        expect(agenda).toBeTruthy()
        expect(texto(agenda)).toContain('-R$ 20.000')
        expect(texto(agenda)).not.toContain('coberto')
      }
      r.unmount()
    }
    expect(fetchSpy).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(escrever).not.toHaveBeenCalled()
    expect(localStorage.getItem('previsao-eventos:curva-financeiro:v1')).toBe(cacheAntes)
    expect(curvas.loadCurvaCache()).toEqual({ em: '2026-08-10T12:00:00Z', curva: c })
  })
  it.each([['Curva', CurvaVendas], ['Análise', AnaliseTab]])('dois estornos inclusive pós-festa mantêm todos os centavos em %s', (_nome, Tela) => {
    curvas.saveCurvaCache(curva(true), '2026-08-10T12:00:00Z')
    expect(texto(montar(Tela, festa()).container)).toContain('tem R$ 25.000,25 em estornos')
  })
  it.each([['Curva', CurvaVendas], ['Análise', AnaliseTab]])('trocar referência sã retira aviso e voltar o recupera em %s', (_nome, Tela) => {
    curvas.saveCurvaCache(curva(), '2026-08-10T12:00:00Z')
    const e = festa(), r = montar(Tela, e)
    expect(texto(r.container)).toContain(aviso)
    r.rerender(<Tela evento={{ ...e, curvaRef: { modo: 'festa', itens: [{ id: 8, nome: 'Marfim sã' }] } }} update={noop} />)
    expect(texto(r.container)).not.toContain('em estornos')
    r.rerender(<Tela evento={e} update={noop} />)
    expect(texto(r.container)).toContain(aviso)
  })
  it('modo datas avisa histórico na Curva; Análise preserva conta por datas sem atribuir ajuste', () => {
    const c = curva(); curvas.saveCurvaCache(c, '2026-08-10T12:00:00Z')
    const e = { ...festa(), curvaModo: 'datas' }
    const planoAntes = curvas.curvaPlanoDatas(e), caixaAntes = analisarCaixa(e, planoAntes.pontos)
    const r = montar(CurvaVendas, e)
    expect(texto(r.container)).toContain(aviso); r.unmount()
    const a = montar(AnaliseTab, e)
    expect(texto(a.container)).not.toContain('em estornos')
    expect(texto(a.container)).toContain('Caixa mínimo para iniciar-R$ 20.000 em D-11')
    expect(curvas.curvaPlanoDatas(e)).toEqual(planoAntes)
    expect(analisarCaixa(e, curvas.curvaPlanoDatas(e).pontos)).toEqual(caixaAntes)
  })
  it('início válido sem janela utilizável não atribui média por dia ao caixa', () => {
    const c = curva(); c.eventos[0].dias = [{ dia: 0, valor: 100000, pagamentos: 1 }, { dia: 5, valor: -20000, pagamentos: 1 }]
    c.eventos = [c.eventos[0]]; curvas.saveCurvaCache(c, '2026-08-10T12:00:00Z')
    const e = festa('2026-08-29')
    const r = montar(CurvaVendas, e); expect(texto(r.container)).toContain(aviso); r.unmount()
    expect(texto(montar(AnaliseTab, e).container)).not.toContain('em estornos')
  })
  it('cache desordenado permanece intacto; backup não adquire ajuste/cache derivado', () => {
    const c = curva(); c.eventos[0].dias.reverse()
    curvas.saveCurvaCache(c, '2026-08-10T12:00:00Z')
    const store = { eventos: [festa()], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }
    const antes = JSON.stringify(montarBackup(store)), cacheAntes = localStorage.getItem('previsao-eventos:curva-financeiro:v1')
    const escrever = vi.spyOn(dom.window.Storage.prototype, 'setItem')
    curvas.mediaHistorica(c, opts); curvas.mediaHistoricaNormalizada(c, opts)
    const r = montar(CurvaVendas, festa('2026-08-29')); expect(texto(r.container)).toContain(aviso); r.unmount()
    expect(texto(montar(AnaliseTab, festa('2026-08-29')).container)).toContain(aviso)
    expect(JSON.stringify(montarBackup(store))).toBe(antes)
    expect(antes).not.toContain('estorno'); expect(antes).not.toContain('curva-financeiro')
    expect(escrever).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem('previsao-eventos:curva-financeiro:v1')).toBe(cacheAntes)
    expect(curvas.loadCurvaCache().curva).toEqual(c)
  })
  it('mensagem pura não altera média e identifica nome vazio/estorno somado', () => {
    expect(curvas.mensagensAjustesCurva(null)).toEqual([])
    expect(curvas.mensagensAjustesCurva({})).toEqual([])
    const c = curva(true); c.eventos[0].nome = ''
    const m = curvas.mediaHistorica(c, opts), antes = JSON.stringify(m)
    expect(curvas.mensagensAjustesCurva(m).map(s => s.replace(/\s+/g, ' '))).toEqual(['A referência ‘Festa sem nome (id 7)’ tem R$ 25.000,25 em estornos. A fração da curva histórica foi limitada entre 0% e 100% e não recua; os valores originais foram preservados.'])
    expect(JSON.stringify(m)).toBe(antes)
  })
})

describe('S3 adendo — realizado e caixa nas telas reais', () => {
  it('Até hoje conserva dois pagamentos, 80 mil e 40%; ritmo usa os pagamentos brutos', () => {
    const c=curva()
    c.eventos.push({id:9,nome:'Festa vinculada',empresa:'Brisa',data:'2026-09-09',totalValor:80000,dias:[{dia:-31,valor:100000,pagamentos:1},{dia:-30,valor:-20000,pagamentos:1}]})
    curvas.saveCurvaCache(c,'2026-08-10T12:00:00Z')
    const e={...festa(),financeiro:{eventoId:9}}
    const antes=JSON.stringify(e), cacheAntes=localStorage.getItem('previsao-eventos:curva-financeiro:v1')
    const escrever=vi.spyOn(dom.window.Storage.prototype,'setItem'), update=vi.fn()
    // 1.100 − 2 pagamentos = 1.098; 30 dias de venda → ceil(1.098/30) = 37/dia.
    const r=render(<CurvaVendas evento={e} update={update} breakEvenRealista={1100} />)
    const hoje=[...r.container.querySelectorAll('p')].find(p=>texto(p).startsWith('Até hoje'))
    expect(texto(hoje)).toBe('Até hoje (D-30): 2 pagamentos · R$ 80 mil vendidos (40% do plano).')
    const ritmo=[...r.container.querySelectorAll('p')].find(p=>texto(p).includes('Pela curva, faltam'))
    expect(texto(ritmo).split('(contagem')[0].trim()).toBe('Pela curva, faltam 1.098 para o break-even do realista — ritmo necessário: 37/dia.')
    expect(escrever).not.toHaveBeenCalled();expect(update).not.toHaveBeenCalled();expect(fetchSpy).not.toHaveBeenCalled()
    expect(JSON.stringify(e)).toBe(antes);expect(localStorage.getItem('previsao-eventos:curva-financeiro:v1')).toBe(cacheAntes)
  })
  it('datas empatadas mostram menos 5 mil no card e na agenda, com as duas viradas', () => {
    curvas.saveCurvaCache(curva(),'2026-08-10T12:00:00Z')
    const e={...festa(),curvaModo:'datas',lotes:[novoLote({id:'a',nome:'Primeiro',quantidade:100,valor:100,viradaPrevista:'2026-08-10'}),novoLote({id:'b',nome:'Segundo',quantidade:100,valor:150,viradaPrevista:'2026-08-10'})],categorias:[{id:'artistico',nome:'Artístico',itens:[novoItem({servico:'Cachê empatado',estimado:30000,dataPagamento:'2026-08-10'})]}]}
    const r=montar(AnaliseTab,e)
    expect(texto(r.container)).toContain('Caixa mínimo para iniciar-R$ 5.000 em D-30')
    const agenda=[...r.container.querySelectorAll('tr')].find(tr=>texto(tr).includes('Cachê empatado'))
    expect(texto(agenda)).toContain('-R$ 5.000');r.unmount()
    const v=montar(CurvaVendas,e)
    expect(texto(v.container)).toContain('Primeiro');expect(texto(v.container)).toContain('Segundo')
    expect(curvas.curvaPlanoDatas(e).viradas).toHaveLength(2)
    // Ler a reta realmente desenhada, sem consultar o consumidor do caixa:
    // ele pode estar correto enquanto o gráfico ainda usa o primeiro marco.
    const marcador=[...v.container.querySelectorAll('circle title')].find(t=>t.textContent.startsWith('Primeiro esgota'))
    const caminho=marcador.closest('g').querySelector('path').getAttribute('d')
    const pontos=[...caminho.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}))
    const primeiro=pontos[0], ultimo=pontos.at(-1)
    const receitaDesenhada=dia=>{
      // Os extremos desta fixture são D-60/R$0 e D0/R$25 mil.
      // A proporção independe das dimensões e margens do SVG.
      const x=primeiro.x+(ultimo.x-primeiro.x)*(dia+60)/60
      const i=pontos.findIndex(p=>p.x>=x)
      const antes=pontos[i-1], depois=pontos[i]
      const y=depois.x===x?depois.y:antes.y+(depois.y-antes.y)*(x-antes.x)/(depois.x-antes.x)
      return (primeiro.y-y)/(primeiro.y-ultimo.y)*25000
    }
    expect(receitaDesenhada(-45)).toBeCloseTo(12500,2)
    expect(receitaDesenhada(-31)).toBeCloseTo(24166.666666666668,2)
    expect(receitaDesenhada(-30)).toBeCloseTo(25000,2)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
