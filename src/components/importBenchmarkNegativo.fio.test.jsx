// @vitest-environment jsdom
//
// O FIO da decisão do Marco de 27/07/2026, na TELA: importar uma planilha com
// categoria de saldo NEGATIVO (estorno) e marcar "salvar como benchmark" grava
// uma foto em que o total FECHA com as categorias que ela mostra.
//
// POR QUE ESTE ARQUIVO EXISTE ALÉM DO TESTE DO MÓDULO. A régua de "quando a
// categoria some da foto" agora mora em benchmarks.js e tem teste próprio
// (benchmarks.test.js). Mas o defeito que ela conserta morava no COMPONENTE, e
// medido em 27/07/2026 NENHUM teste do repositório passava pelo caminho
// `salvarBenchmark` do ImportModal — nem o fio irmão (importSemIdentificacao),
// que para no ramo do .json. Provar só o módulo puro deixaria de fora
// exatamente o pedaço que mentia: a chamada, o argumento e o que é gravado.
//
// Aqui a planilha .xlsx é montada de verdade (SheetJS), solta no campo de
// arquivo, a caixa "salvar como benchmark" é marcada e o botão é clicado — e o
// que se afirma é o OBJETO que foi parar em benchmarksCustom.
import { useState,useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import ImportModal from './ImportModal.jsx'
import { saveStore } from '../lib/storage.js'
import { CAT_KEYS, somaCustos } from '../lib/benchmarks.js'

afterEach(cleanup)

// Planilha mínima, nenhum dado real do Marco: A&B positiva e MARKETING com
// saldo líquido negativo (impulsionamento R$ 2.000 menos estorno R$ 5.000).
// O "(5.000,00)" é a convenção contábil que o parseMoney lê como −5000
// (decisão do Marco, 20/07/2026).
const planilhaComEstorno = () => {
  const aoa = [
    ['A & B'],
    ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status'],
    ['Bar', 'Operação Bar', 'MZ', 10000, 'FECHADO'],
    [],
    ['MARKETING'],
    ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status'],
    ['Mídia', 'Impulsionamento', 'Meta', 2000, 'PAGO'],
    ['Mídia', 'Estorno da campanha cancelada', 'Meta', '(5.000,00)', 'PAGO'],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'teste')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

// O componente lê com `file.arrayBuffer()`; o File do jsdom não serve, então o
// arquivo de teste é um objeto com nome e o buffer — é o que o onChange entrega.
const arquivoFalso = (nome, buffer) => ({ name: nome, arrayBuffer: async () => buffer })

const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  ajustes: {},
})

beforeEach(() => {
  // Mesmo armazenamento de mentira do fio irmão: sem ele o fluxo para na cópia
  // de segurança do princípio 7 e nunca chega a gravar.
  const mem = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(window, 'confirm').mockImplementation(() => true)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function importarComBenchmark() {
  const store = storeVazio()
  let depois = null
  function Fio() {
    const [atual,setAtual] = useState(store)
    useEffect(()=>{saveStore(atual)},[atual])
    depois = atual.eventos.length ? atual : null
    return <ImportModal store={atual} setStore={setAtual} abrir={() => {}} onClose={() => {}} />
  }
  render(<Fio />)

  const input = document.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', {
    value: [arquivoFalso('festa.xlsx', planilhaComEstorno())],
    configurable: true,
  })
  fireEvent.change(input)

  // a tela de revisão apareceu?
  await waitFor(() => expect(screen.getByText(/Revisar importação/i)).toBeTruthy())

  // marca "salvar como benchmark" (nasce desmarcada de propósito)
  const caixaBenchmark = screen
    .getAllByRole('checkbox')
    .find((c) => /benchmark/i.test(c.closest('label')?.textContent || ''))
  expect(caixaBenchmark).toBeTruthy()
  if (!caixaBenchmark.checked) fireEvent.click(caixaBenchmark)

  const botao = screen.getByRole('button', { name: /^Importar .*evento/i })
  fireEvent.click(botao)

  await waitFor(() => expect(depois).not.toBeNull())
  return depois
}

describe('o fio na tela: planilha com estorno vira benchmark que não esconde dinheiro', () => {
  it('a categoria negativa FICA na foto e o custoTotal fecha com o que se vê', async () => {
    const depois = await importarComBenchmark()

    expect(depois.benchmarksCustom).toHaveLength(1)
    const bm = depois.benchmarksCustom[0]

    // o que o defeito fazia: marketing sumia (null) e os −3.000 ficavam só no total
    expect(bm.custos.marketing).toBe(-3000)
    expect(bm.custos.aeb).toBe(10000)
    expect(bm.custoTotal).toBe(7000)

    // a asserção que importa, e que a régua antiga quebrava: o total tem de
    // bater com a soma das categorias que a tela mostra
    const visivel = CAT_KEYS.reduce((s, k) => s + (typeof bm.custos[k] === 'number' ? bm.custos[k] : 0), 0)
    expect(visivel).toBe(bm.custoTotal)
    // e o somador do próprio app tem de concordar com o total gravado
    expect(somaCustos(bm.custos)).toBe(bm.custoTotal)
  })

  it('o EVENTO recusa estorno, enquanto o benchmark conserva os três valores históricos', async () => {
    const depois = await importarComBenchmark()

    expect(depois.eventos).toHaveLength(1)
    const itens = depois.eventos[0].categorias.flatMap((c) => c.itens)
    expect(itens).toHaveLength(2)
    const estorno = itens.find((i) => /Estorno/i.test(i.servico))
    expect(estorno).toBeUndefined()
    expect(depois.benchmarksCustom[0].custos.marketing).toBe(-3000)
    expect(depois.benchmarksCustom[0].custoTotal).toBe(7000)
  })
})
