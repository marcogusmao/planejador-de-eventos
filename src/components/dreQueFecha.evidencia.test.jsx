// @vitest-environment jsdom
//
// O DRE DA ABA CENÁRIOS E DO RELATÓRIO SOMA NA FRENTE DE QUEM LÊ (Marco,
// 07/10/2026, pergunta 3 do plano dos centavos: o DRE passa a mostrar
// centavos, como o card do Fechamento desde 12/08/2026). Os números saem do
// DOM como texto e a conta é refeita a partir do que está ESCRITO — a mesma
// régua de colunaDoCardFecha.evidencia.test.jsx.
//
// Controle positivo: com o DRE em reais inteiros, o realista do evento abaixo
// escrevia Receita líquida R$ 80.982 + Bar R$ 40.000 + Patrocínio R$ 12.501 =
// R$ 133.483 sob uma Receita total de R$ 133.482.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import RevenueTab from './RevenueTab.jsx'

afterEach(cleanup)

// localStorage de mentira, como em colunaDoCardFecha.evidencia.test.jsx: a aba
// Cenários lê o cache da curva do Financeiro ao montar.
beforeEach(() => {
  const mapa = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  })
})

// O evento do golden (src/lib/golden.test.js), copiado: cobre lote com
// centavos, cortesia, só-otimista, override, ajuste de ticket, contingência e
// ajuste de custo ±.
const evento = () => ({
  id: 'ev-dre-fecha',
  nome: 'Evento Golden (fixo — não é festa real)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 40000, patrocinio: 12500.5 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 70, quantidade: 250 },
    { id: 'l2', nome: '2º lote', valor: 90, quantidade: 350 },
    { id: 'l3', nome: '3º lote', valor: 110.9, quantidade: 400 },
    { id: 'porta', nome: 'Lote Porta', valor: 130, quantidade: 100, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 80 },
  ],
  categorias: [
    { id: 'atracoes', nome: 'Atrações', itens: [{ id: 'a1', servico: 'DJ principal', estimado: 15000, realizado: 14000 }, { id: 'a2', servico: 'DJs locais', estimado: 6000, realizado: 0 }] },
    { id: 'estrutura', nome: 'Estrutura', itens: [{ id: 'e1', servico: 'Som e luz', estimado: 18000.75, realizado: '' }, { id: 'e2', servico: 'Palco', estimado: 12000 }] },
    { id: 'aeb', nome: 'A&B', itens: [{ id: 'b1', servico: 'Insumos do bar', estimado: 25000 }, { id: 'b2', servico: 'Gelo', estimado: 3000, realizado: 3218.43 }] },
    { id: 'equipe', nome: 'Equipe', itens: [{ id: 'q1', servico: 'Staff', estimado: 21500 }] },
    { id: 'marketing', nome: 'Marketing', itens: [{ id: 'm1', servico: 'Tráfego pago', estimado: 6000 }, { id: 'm2', servico: 'Design', estimado: 1500, realizado: 1200 }] },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10, ticketPct: -5 },
    realista: { vendaPct: 90 },
    otimista: { custoPct: -5 },
    overrides: { pessimista: {}, realista: { l3: 371 }, otimista: {} },
  },
})

const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

// "− R$ 1.234,56 (−5%)" → −123456. O travessão (linha de valor zero) é 0.
const centavos = (txt) => {
  const t = String(txt).replace(/\s/g, ' ').trim()
  if (t === '—') return 0
  const negativo = t.startsWith('−') || t.startsWith('-')
  const n = Number(
    t
      .replace(/\(.*$/, '')
      .replace(/[−+-]/g, '')
      .replace('R$', '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  )
  return Math.round((negativo ? -n : n) * 100)
}

// A busca fica DENTRO da tabela do DRE (a que tem a linha "Receita bruta
// bilheteria"): o relatório repete rótulos como "Contingência (10%)" em outras
// tabelas. Coluna 0 = rótulo · 1 pessimista · 2 realista · 3 otimista.
let tabela = null
const acharDRE = () => {
  tabela = screen.getByText(/^Receita bruta bilheteria$/, { selector: 'td' }).closest('table')
}
const coluna = (regex, i) => {
  const tr = within(tabela).getByText(regex, { selector: 'td' }).closest('tr')
  return centavos(within(tr).getAllByRole('cell')[i].textContent)
}
const conferir = (r) => {
  for (const i of [1, 2, 3]) {
    const v = (x) => coluna(x, i)
    expect(v(r.bruta) + v(r.taxa) + v(r.cashback), `líquida, coluna ${i}`).toBe(v(r.liquida))
    expect(v(r.liquida) + v(r.bar) + v(r.patrocinio), `receita total, coluna ${i}`).toBe(v(r.receita))
    expect(v(r.itens) + v(r.contingencia) + v(r.ajuste), `custo total, coluna ${i}`).toBe(v(r.custo))
    expect(v(r.receita) - v(r.custo), `lucro, coluna ${i}`).toBe(v(r.lucro))
  }
}

describe('o DRE soma na frente de quem lê', () => {
  it('aba Cenários: as quatro contas da coluna fecham nos três cenários', () => {
    const e = evento()
    render(<ScenariosTab evento={e} update={() => {}} updateCenarios={() => {}} store={store(e)} setStore={() => {}} />)
    acharDRE()
    conferir({
      bruta: /^Receita bruta bilheteria$/, taxa: /^Taxa da bilheteria$/, cashback: /^Cashback Tiqueteira$/,
      liquida: /^Receita líquida bilheteria$/, bar: /^Bar \(lucro líquido\)$/, patrocinio: /^Patrocínio \(fechado\)$/,
      receita: /^Receita total$/, itens: /^Custos \(itens\)$/, contingencia: /^Contingência$/,
      ajuste: /^Ajuste de custos do cenário$/, custo: /^Custo total$/, lucro: /^Lucro$/,
    })
  })

  it('relatório Completo: as mesmas quatro contas fecham', () => {
    const e = evento()
    render(<ReportView evento={e} store={store(e)} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }))
    acharDRE()
    conferir({
      bruta: /^Receita bruta bilheteria$/, taxa: /^Taxa da bilheteria \(10%\)$/, cashback: /^Cashback Tiqueteira \(5%\)$/,
      liquida: /^Receita líquida bilheteria$/, bar: /^Bar \(lucro líquido\)$/, patrocinio: /^Patrocínio \(fechado\)$/,
      receita: /^Receita total$/, itens: /^Custos \(itens\)$/, contingencia: /^Contingência \(10%\)$/,
      ajuste: /^Ajuste de custos do cenário$/, custo: /^Custo total do cenário$/, lucro: /^Lucro$/,
    })
  })

  it('aba Receita: a faixa do realista (bruta − taxa + cashback = líquida; líquida + bar + patrocínio = total) fecha', () => {
    render(<RevenueTab evento={evento()} update={() => {}} />)
    const stat = (rotulo) => centavos(screen.getByText(rotulo).nextElementSibling.textContent)
    expect(stat('Receita bruta bilheteria') + stat('Taxa bilheteria (10%)') + stat('Cashback Tiqueteira (5%)')).toBe(
      stat('Receita líquida bilheteria')
    )
    expect(stat('Receita líquida bilheteria') + stat('Bar (lucro esperado)') + stat('Patrocínio (fechado)')).toBe(
      stat('Receita total (realista)')
    )
  })
})
