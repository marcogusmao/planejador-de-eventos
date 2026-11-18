// @vitest-environment jsdom
//
// O CARTÃO DE LUCRO FECHA COM AS PRÓPRIAS LINHAS E COM O DRE (Marco,
// 07/10/2026, por questionário — P6 refeito, depois da auditoria de dinheiro
// do plano dos centavos). Com o DRE em centavos (P3), o cartão do topo (aba
// Cenários, relatório, modo apresentação) imprimia em reais inteiros um lucro
// refeito de receita, imposto e custo arredondados um a um (`lucroQueFecha`,
// regra de 07/08/2026): fechava com as linhas do cartão, mas podia cair R$ 1
// longe da linha Lucro do DRE ("R$ 76.698" × "R$ 76.697,31"). Decisão: o
// cartão também mostra centavos. Receita, Imposto, Custo e Lucro saem do motor
// em centavos exatos, então as duas contas fecham ao mesmo tempo:
//   (a) lucro do cartão = receita − imposto − custo do cartão, lidos do texto;
//   (b) lucro do cartão = linha Lucro do DRE, mesmo cenário.
//
// Controle positivo (base 474c658 + patches A–D, cartão em reais): o evento 1
// escrevia R$ 59.999 no cartão (R$ 100.000 − R$ 40.001) e R$ 59.999,80 no DRE.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'

vi.mock('../lib/toast.js', () => ({ showToast: vi.fn() }))
vi.mock('../lib/protecao.js', () => ({ snapshotSeguranca: () => ({ ok: true }) }))

afterEach(cleanup)
beforeEach(() => {
  const mapa = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  })
})

const CENARIOS = ['pessimista', 'realista', 'otimista']

// Uma venda e um custo, sem taxa, cashback, contingência nem bar: os centavos
// da receita e do custo arredondam para lados opostos quando vistos em reais.
const evento = (id, receita, custo, extra = {}) => ({
  id,
  nome: `Sintético ${id}`,
  taxaBilheteria: 0,
  cashbackPct: 0,
  contingenciaPct: 0,
  outrasReceitas: { bar: 0, patrocinio: 0 },
  lotes: [{ id: 'l1', nome: 'Único', valor: receita, quantidade: 1 }],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ id: 'i1', servico: 'Custo sintético', estimado: custo }] }],
  cenariosConfig: {
    pessimista: { vendaPct: 100, custoPct: 0 },
    realista: { vendaPct: 100, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: 0 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
  ...extra,
})

// evento 1: R$ 100.000,40 − R$ 40.000,60 = R$ 59.999,80 (em reais: 100.000 − 40.001 = 59.999)
// evento 2: R$ 40.000,60 − R$ 100.000,10 = −R$ 59.999,50 (meio real negativo)
// evento 3: com imposto de 6% sobre a bilheteria: R$ 100.000,40 − R$ 6.000,02 − R$ 40.000,60 = R$ 53.999,78
const CASOS = [
  { e: evento('positivo', 100000.4, 40000.6), lucro: 'R$ 59.999,80' },
  { e: evento('meio-negativo', 40000.6, 100000.1), lucro: '-R$ 59.999,50' },
  {
    e: evento('com-imposto', 100000.4, 40000.6, { impostoPct: 6, impostoSobre: { bilheteria: true, bar: false, patrocinio: false } }),
    lucro: 'R$ 53.999,78',
  },
]

const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })
const limpo = (t) => String(t).replace(/\s/g, ' ').trim()

// "− R$ 6.000,02" → −600002 ; "-R$ 59.999,50" → −5999950
const centavos = (txt) => {
  const t = limpo(txt)
  const negativo = t.startsWith('−') || t.startsWith('-')
  const n = Number(t.replace(/[−+-]/g, '').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return Math.round((negativo ? -n : n) * 100)
}

const lucroDoDRE = () => {
  const tabela = screen.getByText(/^Receita bruta bilheteria$/, { selector: 'td' }).closest('table')
  const tr = within(tabela).getByText(/^Lucro$/, { selector: 'td' }).closest('tr')
  return within(tr).getAllByRole('cell').slice(1, 4).map((c) => limpo(c.textContent))
}

// As linhas do cartão: <dt>rótulo</dt><dd>valor</dd>, dentro do mesmo cartão.
const linhaDoCartao = (cartao, rotulo) => {
  const dt = [...cartao.querySelectorAll('dt')].find((d) => d.textContent.trim().startsWith(rotulo))
  return dt ? centavos(dt.nextElementSibling.textContent) : 0
}

// (a) lucro = receita − imposto − custo, ao centavo, lidos do texto do cartão
const conferirCartao = (cartao, lucroTxt, rotulos, nome) => {
  const rec = linhaDoCartao(cartao, rotulos.receita)
  const imp = linhaDoCartao(cartao, 'Imposto')
  const cus = linhaDoCartao(cartao, rotulos.custo)
  expect(rec, `${nome}: receita lida`).not.toBe(0)
  expect(rec + imp - cus, `${nome}: receita − imposto − custo do cartão`).toBe(centavos(lucroTxt))
}

describe('o cartão de lucro fecha com as próprias linhas e com o DRE', () => {
  for (const caso of CASOS) {
    it(`aba Cenários (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE`, () => {
      render(<ScenariosTab evento={caso.e} update={() => {}} updateCenarios={() => {}} store={store(caso.e)} setStore={() => {}} />)
      const dre = lucroDoDRE()
      const rotulos = screen.getAllByText(/^Lucro$/, { selector: 'div' })
      expect(rotulos).toHaveLength(3)
      expect(dre).toEqual([caso.lucro, caso.lucro, caso.lucro])
      rotulos.forEach((d, i) => {
        const lucro = limpo(d.nextElementSibling.textContent)
        expect(lucro, `cartão × DRE, ${CENARIOS[i]}`).toBe(dre[i])
        conferirCartao(d.closest('dl')?.parentElement || d.parentElement.parentElement, lucro, { receita: 'Receita total', custo: 'Custo total' }, CENARIOS[i])
      })
    })

    it(`relatório Completo (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE`, () => {
      render(<ReportView evento={caso.e} store={store(caso.e)} onBack={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'Completo' }))
      const dre = lucroDoDRE()
      // No relatório o valor vem ANTES do rótulo "lucro".
      const rotulos = screen.getAllByText(/^lucro$/, { selector: 'div' })
      expect(rotulos).toHaveLength(3)
      rotulos.forEach((d, i) => {
        const lucro = limpo(d.previousElementSibling.textContent)
        expect(lucro, `cartão × DRE, ${CENARIOS[i]}`).toBe(dre[i])
        conferirCartao(d.parentElement, lucro, { receita: 'Receita', custo: 'Custo' }, CENARIOS[i])
      })
    })

    it(`modo apresentação (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE da aba Cenários`, () => {
      render(<ScenariosTab evento={caso.e} update={() => {}} updateCenarios={() => {}} store={store(caso.e)} setStore={() => {}} />)
      const dre = lucroDoDRE()
      cleanup()
      render(<PresentationMode evento={caso.e} store={store(caso.e)} update={() => {}} aparencia={{}} onClose={() => {}} />)
      const rotulos = screen.getAllByText(/^Lucro$/, { selector: 'div' })
      expect(rotulos).toHaveLength(3)
      rotulos.forEach((d, i) => {
        const lucro = limpo(d.nextElementSibling.textContent)
        expect(lucro, `cartão × DRE, ${CENARIOS[i]}`).toBe(dre[i])
        const cartao = d.closest('div.rounded-2xl') || d.parentElement.parentElement
        conferirCartao(cartao, lucro, { receita: 'Receita', custo: 'Custo' }, CENARIOS[i])
      })
    })
  }
})
