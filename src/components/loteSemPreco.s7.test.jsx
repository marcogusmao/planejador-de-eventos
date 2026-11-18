// @vitest-environment jsdom
//
// P8 na TELA (Marco, 06/10/2026): um lote com o preço em branco fica fora do
// público, das cortesias e do bar — e cada superfície DIZ isso, em vez de
// mostrar "(cortesia) R$ 0" ou um total que conta o lote. A regra de conta
// mora em calc.js (golden.test.js e calc.p8.test.js); o texto, em
// loteSemPreco.js. Este arquivo prova o FIO: a tela monta, e a faixa, o selo,
// os travessões e os números estão onde a pessoa olha.
//
// Célula SEMPRE localizada pelo cabeçalho da coluna, nunca pelo texto solto
// no documento (lição da S6: o mesmo número aparece em mais de um lugar).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { useState, useEffect } from 'react'
import RevenueTab from './RevenueTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import ImportModal from './ImportModal.jsx'
import Ajustes from './Ajustes.jsx'
import { novoEvento, novoLote, novoItem } from '../lib/defaults.js'
import { saveStore, montarBackup, liberarGravacao } from '../lib/storage.js'

const NIVEL_KEY = 'previsao-eventos:relatorio-nivel:v1'
let dados
beforeEach(() => {
  liberarGravacao()
  dados = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    clear: () => dados.clear(),
    key: (i) => [...dados.keys()][i] ?? null,
    get length() {
      return dados.size
    },
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  liberarGravacao()
})

// A festa do diff aprovado, com o lote sem preço chamado "Camarote".
function festaP8() {
  const e = novoEvento('Festa P8')
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Camarote', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}
const comCamarote = (e, patch) => ({ ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, ...patch } : l)) })
const comAjusteRealista = (e, v) => ({
  ...e,
  cenariosConfig: { ...e.cenariosConfig, overrides: { ...e.cenariosConfig.overrides, realista: { l4: v } } },
})
const comCfgRealista = (e, patch) => ({
  ...e,
  cenariosConfig: { ...e.cenariosConfig, realista: { ...e.cenariosConfig.realista, ...patch } },
})
const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

const TEXTO_RECEITA =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço.'
const TEXTO_COMPLETO =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
const CURTO = '1 lote sem preço fora do público e do bar (300 ingressos)'

const faixas = () => screen.queryAllByRole('status').filter((n) => n.textContent.includes('sem preço'))
const cabecalhos = (tabela) => [...tabela.querySelectorAll('thead th')].map((th) => th.textContent.trim())
const celula = (tr, coluna) => {
  const i = cabecalhos(tr.closest('table')).indexOf(coluna)
  if (i < 0) throw new Error(`coluna "${coluna}" não existe nesta tabela`)
  return tr.children[i]
}

// ———————————————————————————————————————————— Receita
const abrirReceita = (e) => render(<RevenueTab evento={e} update={() => {}} />)
const linhaReceita = (nome) => screen.getByDisplayValue(nome).closest('tr')

describe('aba Receita', () => {
  it('R1 — a faixa com o texto da Receita existe uma vez e vem ANTES da tabela', () => {
    abrirReceita(festaP8())
    const f = faixas()
    expect(f).toHaveLength(1)
    expect(f[0].textContent).toBe(TEXTO_RECEITA)
    const tabela = linhaReceita('Camarote').closest('table')
    expect(f[0].compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('R2 — a linha do Camarote: selo "sem preço" (title com o rótulo inteiro), sem "cortesia", Receita e Acumulada em travessão; Efetivo e Ao cliente também', () => {
    abrirReceita(festaP8())
    const tr = linhaReceita('Camarote')
    // selo curto; o rótulo inteiro fica no title (regra do selo largo, S7)
    const selo = within(tr).getByText('sem preço', { exact: true })
    expect(selo.closest('[title]').getAttribute('title')).toBe('sem preço — fora da previsão')
    expect(tr.textContent).not.toContain('cortesia')
    expect(celula(tr, 'Receita').textContent).toBe('—')
    expect(celula(tr, 'Acumulada').textContent).toBe('—')
    expect(celula(linhaReceita('Lote 1'), 'Receita').textContent).toContain('R$')
    cleanup()
    abrirReceita({ ...festaP8(), descontoMedioPct: 10 })
    expect(celula(linhaReceita('Camarote'), 'Efetivo').textContent).toBe('—')
    expect(celula(linhaReceita('Lote 1'), 'Efetivo').textContent).toContain('R$')
    cleanup()
    abrirReceita({ ...festaP8(), taxaPagaPor: 'cliente' })
    expect(celula(linhaReceita('Camarote'), 'Ao cliente').textContent).toBe('—')
    expect(celula(linhaReceita('Lote 1'), 'Ao cliente').textContent).toContain('R$')
  })

  it('R3 — total dos lotes sem o Camarote (650) e a linha Realista com 590; controle preço 0: 950 e 350 cortesias', () => {
    abrirReceita(festaP8())
    const pe = linhaReceita('Camarote').closest('table').querySelector('tfoot')
    const [total, realista] = pe.querySelectorAll('tr')
    expect(total.textContent).toContain('Total dos lotes (esgotado)')
    expect(celula(total, 'Qtd').textContent).toBe('650')
    expect(realista.textContent).toContain('540 pagos + 50 cortesias')
    expect(celula(realista, 'Qtd').textContent).toBe('590')
    cleanup()
    abrirReceita(comCamarote(festaP8(), { valor: 0 }))
    const pe0 = linhaReceita('Camarote').closest('table').querySelector('tfoot')
    const [total0, realista0] = pe0.querySelectorAll('tr')
    expect(celula(total0, 'Qtd').textContent).toBe('950')
    expect(realista0.textContent).toContain('350 cortesias')
    expect(faixas()).toHaveLength(0)
  })

  it('R4 — digitar 0 vira cortesia e a faixa some; apagar volta a faixa; a quantidade salva continua 300', () => {
    let atual
    function Bancada() {
      const [e, setE] = useState(festaP8())
      atual = e
      const update = (fn) => setE((prev) => (typeof fn === 'function' ? fn(prev) : { ...prev, ...fn }))
      return <RevenueTab evento={e} update={update} />
    }
    render(<Bancada />)
    expect(faixas()).toHaveLength(1)
    const preco = () => linhaReceita('Camarote').querySelectorAll('input')[1]
    fireEvent.change(preco(), { target: { value: '0' } })
    expect(within(linhaReceita('Camarote')).getByText('cortesia')).toBeTruthy()
    expect(within(linhaReceita('Camarote')).queryByText('sem preço', { exact: true })).toBeNull()
    expect(faixas()).toHaveLength(0)
    fireEvent.change(preco(), { target: { value: '' } })
    expect(faixas()).toHaveLength(1)
    const l4 = atual.lotes.find((l) => l.id === 'l4')
    expect(l4.valor).toBe('')
    expect(l4.quantidade).toBe(300)
  })

  it('R5 — evento novo (seis lotes em branco): nenhuma faixa, nenhum selo', () => {
    abrirReceita(novoEvento('X'))
    expect(faixas()).toHaveLength(0)
    expect(screen.queryByText('sem preço', { exact: true })).toBeNull()
  })
})

// ———————————————————————————————————————————— Cenários
const abrirCenarios = (e) =>
  render(
    <ScenariosTab
      evento={e}
      update={() => {}}
      updateCenarios={() => {}}
      store={store(e)}
      setStore={() => {}}
    />
  )
const CARTOES = ['Pessimista', 'Realista', 'Otimista']
const cartao = (nome) => {
  const achados = screen
    .getAllByRole('heading', { name: nome })
    .map((h) => h.closest('[style]'))
    .filter((c) => c && c.textContent.includes('Break-even') && c.textContent.includes('Público'))
  expect(achados, `cartão ${nome}`).toHaveLength(1)
  return achados[0]
}
const dd = (raiz, rotulo) => {
  const dt = [...raiz.querySelectorAll('dt')].find((d) => d.textContent.trim() === rotulo)
  if (!dt) throw new Error(`sem a linha "${rotulo}"`)
  return dt.nextElementSibling.textContent
}

describe('aba Cenários', () => {
  it('C1 — os três cartões trazem a linha curta, o público sem o Camarote e o mínimo verdadeiro', () => {
    abrirCenarios(festaP8())
    const publico = ['530 (480 pagos)', '590 (540 pagos)', '650 (600 pagos)']
    const be = ['324 ingressos pagos', '293 ingressos pagos', '277 ingressos pagos']
    CARTOES.forEach((nome, i) => {
      const c = cartao(nome)
      expect(within(c).getByText(CURTO)).toBeTruthy()
      expect(dd(c, 'Público')).toBe(publico[i])
      expect(dd(c, 'Break-even')).toBe(be[i])
    })
  })

  it('C2 — controle preço 0: sem a linha curta; 830/890/950 e 167/135/120', () => {
    abrirCenarios(comCamarote(festaP8(), { valor: 0 }))
    expect(screen.queryByText(CURTO)).toBeNull()
    const publico = ['830 (480 pagos)', '890 (540 pagos)', '950 (600 pagos)']
    const be = ['167 ingressos pagos', '135 ingressos pagos', '120 ingressos pagos']
    CARTOES.forEach((nome, i) => {
      const c = cartao(nome)
      expect(dd(c, 'Público')).toBe(publico[i])
      expect(dd(c, 'Break-even')).toBe(be[i])
    })
  })

  it('C3 — "Ajuste manual por lote": o Camarote diz que o ajuste não conta e sugere 0; Lote 1 sugere 480/540/600', () => {
    abrirCenarios(festaP8())
    fireEvent.click(screen.getByRole('button', { name: /Ajuste manual por lote/ }))
    const tabela = screen.getByText('Ingressos por lote, por cenário').closest('div').querySelector('table')
    const linha = (nome) =>
      [...tabela.querySelectorAll('tbody tr')].find((tr) => tr.firstElementChild.textContent.startsWith(nome))
    const cam = linha('Camarote')
    expect(within(cam).getByText('sem preço — ajuste não conta')).toBeTruthy()
    expect([...cam.querySelectorAll('input')].map((i) => i.placeholder)).toStrictEqual(['0', '0', '0'])
    expect([...linha('Lote 1').querySelectorAll('input')].map((i) => i.placeholder)).toStrictEqual(['480', '540', '600'])
    expect(within(linha('Lote 1')).queryByText('sem preço — ajuste não conta')).toBeNull()
  })

  it('T1 — P1 (A), Marco 06/10/2026: ajuste 125 no Camarote sem preço mostra o mínimo 293; com preço 50, o aviso de trava', () => {
    abrirCenarios(comAjusteRealista(festaP8(), 125))
    const c = cartao('Realista')
    expect(dd(c, 'Break-even')).toBe('293 ingressos pagos')
    expect(within(c).getByText(CURTO)).toBeTruthy()
    cleanup()
    abrirCenarios(comCamarote(comAjusteRealista(festaP8(), 125), { valor: 50 }))
    expect(dd(cartao('Realista'), 'Break-even')).toBe('quantidade travada à mão neste cenário')
  })
})

// ———————————————————————————————————————————— Relatório
const abrirRelatorio = (e, nivel) => {
  localStorage.setItem(NIVEL_KEY, nivel)
  return render(<ReportView evento={e} store={store(e)} onBack={() => {}} />)
}
const tabelaBilheteria = (container) =>
  [...container.querySelectorAll('table')].find((t) => cabecalhos(t).includes('Preço cheio × capacidade'))
const linhaBilheteria = (container, nome) =>
  [...tabelaBilheteria(container).querySelectorAll('tbody tr')].find((tr) =>
    tr.firstElementChild.textContent.startsWith(nome)
  )

describe('Relatório', () => {
  for (const nivel of ['resumido', 'completo'])
    it(`P1 — ${nivel}: a faixa com o texto completo e o cabeçalho "590 pessoas"`, () => {
      const { container } = abrirRelatorio(festaP8(), nivel)
      const f = faixas()
      expect(f).toHaveLength(1)
      expect(f[0].textContent).toBe(TEXTO_COMPLETO)
      expect(container.textContent).toContain('590 pessoas')
      expect(container.textContent).not.toContain('890 pessoas')
    })

  it('P2 — Completo, Bilheteria: Camarote marcado, "sem preço" no valor, travessão na receita e no preço cheio', () => {
    const { container } = abrirRelatorio(festaP8(), 'completo')
    const tr = linhaBilheteria(container, 'Camarote')
    expect(celula(tr, 'Lote').textContent).toBe('Camarote (sem preço — fora da previsão)')
    expect(celula(tr, 'Valor unit.').textContent).toBe('sem preço')
    expect(celula(tr, 'Receita (Realista)').textContent).toBe('—')
    expect(celula(tr, 'Preço cheio × capacidade').textContent).toBe('—')
    expect(tr.textContent).not.toContain('(cortesia)')
    expect(tr.textContent).not.toContain('R$ 0')
    // o Lote 1 segue com número
    expect(celula(linhaBilheteria(container, 'Lote 1'), 'Preço cheio × capacidade').textContent).toContain('R$')
  })

  it('P3 — ajuste 0 no Realista para o Camarote sem preço: nada de "zerado no Realista"; Receita em travessão', () => {
    const { container } = abrirRelatorio(comAjusteRealista(festaP8(), 0), 'completo')
    const tr = linhaBilheteria(container, 'Camarote')
    expect(celula(tr, 'Lote').textContent).not.toContain('zerado no Realista')
    expect(celula(tr, 'Receita (Realista)').textContent).toBe('—')
  })

  it('P4 — com cupom e ticket manual (aparece "Com desconto × capacidade"): Efetivo e essa coluna em travessão', () => {
    const e = comCfgRealista({ ...festaP8(), descontoMedioPct: 10 }, { ticketMedio: 120 })
    const { container } = abrirRelatorio(e, 'completo')
    const tr = linhaBilheteria(container, 'Camarote')
    expect(celula(tr, 'Efetivo').textContent).toBe('—')
    expect(celula(tr, 'Com desconto × capacidade').textContent).toBe('—')
    expect(celula(linhaBilheteria(container, 'Lote 1'), 'Com desconto × capacidade').textContent).toContain('R$')
  })
})

// ———————————————————————————————————————————— Apresentação
describe('Apresentação', () => {
  it('A1 — a faixa existe uma vez e o público do realista é 590', () => {
    const e = festaP8()
    render(<PresentationMode evento={e} store={store(e)} update={() => {}} aparencia={{}} onClose={() => {}} />)
    const f = faixas()
    expect(f).toHaveLength(1)
    expect(f[0].textContent).toBe(TEXTO_COMPLETO)
    const publicos = [...document.querySelectorAll('dt')].filter((d) => d.textContent.trim() === 'Público')
    expect(publicos.map((d) => d.nextElementSibling.textContent)).toStrictEqual(['530', '590', '650'])
  })
})

// ———————————————————————————————————————————— Import JSON
describe('Import JSON — o aviso depois de importar', () => {
  for (const porta of ['ImportModal', 'Ajustes'])
    it(`${porta === 'ImportModal' ? 'I1' : 'I2'} — ${porta}: o alerta nomeia a festa e o lote sem preço`, async () => {
      const inicial = { eventos: [], benchmarksCustom: [], ajustes: { porTipo: {} } }
      saveStore(inicial)
      function Fio() {
        const [s, setS] = useState(inicial)
        useEffect(() => {
          saveStore(s)
        }, [s])
        const props = { store: s, setStore: (fn) => setS(fn) }
        return porta === 'ImportModal' ? (
          <ImportModal {...props} abrir={() => {}} onClose={() => {}} />
        ) : (
          <Ajustes {...props} aparencia={{ festas: {}, tema: 'claro' }} setAparencia={() => {}} onBack={() => {}} />
        )
      }
      const view = render(<Fio />)
      const fonte = JSON.stringify(montarBackup({ eventos: [festaP8()], benchmarksCustom: [] }))
      vi.spyOn(window, 'confirm').mockImplementation(() => true)
      const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
      const input = view.container.querySelector(
        porta === 'Ajustes' ? 'input[accept=".json,application/json"]' : 'input[type=file]'
      )
      fireEvent.change(input, { target: { files: [{ name: 'sintetico.json', text: async () => fonte }] } })
      await waitFor(() => expect(alerta).toHaveBeenCalled())
      const textos = alerta.mock.calls.map(([t]) => String(t))
      expect(textos.some((t) => t.includes('Neste arquivo há 1 lote sem preço: Festa P8 — “Camarote” (300 ingressos).'))).toBe(true)
    })
})
