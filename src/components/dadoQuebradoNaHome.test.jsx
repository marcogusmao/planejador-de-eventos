// @vitest-environment jsdom
//
// O CARTÃO DA TELA INICIAL PARA DE IMPRIMIR R$ 0 PARA FESTA COM DADO QUEBRADO.
//
// Achado no teste ao vivo de 05/10/2026 (Chromium sem janela, ramo e main):
// com "Som e luz" em 1 seguido de 308 zeros, as cinco abas da festa já
// avisavam, mas o cartão da Home escrevia, nos dois:
//
//     Brisa quebrada  12/12/2026 · 450 pessoas
//     Pessimista R$ 0 · Realista R$ 0 · Otimista R$ 0
//
// e a festa fechada, "Resultado realizado R$ 0" com desvio "−NaN". É o número
// derivado de lixo mostrado como conta boa que a decisão do Marco de
// 26/07/2026 manda a tela parar de fazer. Na tabela de benchmarks da mesma
// tela, uma referência promovida de festa quebrada aparecia com custo "R$ 0".
//
// Precondição exata: `computeCenarios` devolve lucro −Infinity, e `fmtCompact`
// passa por `num()`, que devolve 0 para o que não é finito (format.js). O
// conserto é de EXIBIÇÃO, em Home.jsx: nenhum número muda.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import {
  FRASE_CARTAO_QUEBRADO,
  FRASE_CELULA_BENCHMARK_QUEBRADO,
} from './AvisoCustoQuebrado.jsx'

afterEach(cleanup)

function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
})

const cat = (id, nome, itens) => ({ id, nome, padrao: false, itens })

// As duas festas do teste ao vivo, exatamente: Bar R$ 5.000, Lote 1 de
// 500 × R$ 100, e "Som e luz" sã (R$ 12.000) ou quebrada (1e308).
function festa(nome, somELuz, realizadoDoSom = '') {
  const e = novoEvento(nome)
  e.data = '2026-12-12'
  e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 500 })]
  e.categorias = [
    cat('aeb', 'A&B', [novoItem({ servico: 'Bar', estimado: 5000 })]),
    cat('estrutura', 'Estrutura', [
      novoItem({ servico: 'Som e luz', estimado: somELuz, realizado: realizadoDoSom }),
    ]),
  ]
  return e
}

const montar = (eventos, benchmarksCustom = []) =>
  render(
    <Home
      store={{ eventos, benchmarksCustom }}
      setStore={vi.fn()}
      aparencia={{}}
      abrir={vi.fn()}
      abrirAjustes={vi.fn()}
    />
  )

// O cartão inteiro de uma festa: o botão esticado "Abrir <nome>" é filho
// direto do Card, então o pai dele é o cartão.
const cartao = (nome) =>
  screen.getByRole('button', { name: `Abrir ${nome}` }).parentElement.textContent.replace(/\s+/g, ' ')

describe('o cartão da Home não imprime número de festa com dado quebrado', () => {
  it('festa ABERTA quebrada: no lugar dos três R$ 0, a frase em português', () => {
    montar([festa('Brisa quebrada', 1e308), festa('Marfim sã', 12000)])
    const t = cartao('Brisa quebrada')
    expect(t).toContain(FRASE_CARTAO_QUEBRADO)
    expect(t).not.toContain('R$ 0')
    expect(t).not.toContain('Pessimista')
    expect(t).not.toContain('Realista')
    expect(t).not.toContain('Otimista')
  })

  it('a festa SÃ ao lado continua com os números dela', () => {
    montar([festa('Brisa quebrada', 1e308), festa('Marfim sã', 12000)])
    const t = cartao('Marfim sã')
    expect(t).not.toContain(FRASE_CARTAO_QUEBRADO)
    expect(t).toContain('PessimistaR$ 18 mil')
    expect(t).toContain('RealistaR$ 25 mil')
    expect(t).toContain('OtimistaR$ 31 mil')
  })

  it('o selo não afirma "margem 0%" — a bola da festa quebrada diz a mesma frase', () => {
    montar([festa('Brisa quebrada', 1e308)])
    const t = cartao('Brisa quebrada')
    expect(t).not.toContain('margem realista 0%')
  })

  it('festa FECHADA quebrada: nem "R$ 0" nem "NaN" no resultado realizado', () => {
    const e = festa('Brisa quebrada', 1e308)
    e.receitaRealizada = { bilheteria: 40000, bar: '' }
    const fechada = fecharEvento(e, '2026-12-13T12:00:00.000Z')
    expect(fechada).toBeTruthy()
    montar([fechada])
    const t = cartao('Brisa quebrada')
    expect(t).toContain(FRASE_CARTAO_QUEBRADO)
    expect(t).not.toContain('R$ 0')
    expect(t).not.toContain('NaN')
  })

  it('FALSO POSITIVO: realizado em texto que a conta ignora não esconde número certo', () => {
    // "a combinar" no realizado acusa o custo (dadoQuebrado.js), mas o app usa
    // o estimado e o cartão continua certo — escondê-lo seria o defeito oposto.
    montar([festa('Marfim a combinar', 12000, 'a combinar')])
    const t = cartao('Marfim a combinar')
    expect(t).not.toContain(FRASE_CARTAO_QUEBRADO)
    expect(t).toContain('RealistaR$ 25 mil')
  })
})

describe('a tabela de benchmarks da Home não imprime R$ 0 para referência quebrada', () => {
  // O benchmark como fica depois de uma volta pelo localStorage: custoTotal
  // vira null, e o 1e+308 da categoria sobra inteiro.
  const bmQuebrado = {
    id: 'bm-quebrado',
    nome: 'Brisa promovida quebrada',
    custom: true,
    custoTotal: null,
    custos: { estrutura: 1e308 },
    receita: 40000,
    lucro: null,
    publico: 450,
  }

  it('a linha da referência quebrada mostra a frase, não R$ 0', () => {
    montar([], [bmQuebrado])
    const linha = screen.getByText('Brisa promovida quebrada').closest('tr')
    const t = linha.textContent.replace(/\s+/g, ' ')
    expect(t).toContain(FRASE_CELULA_BENCHMARK_QUEBRADO)
    expect(t).not.toContain('R$ 0')
  })

  it('os embutidos continuam com o custo deles', () => {
    montar([], [bmQuebrado])
    const linha = screen.getByText('Marfim 09/05').closest('tr')
    expect(linha.textContent).toContain('R$ 333 mil')
    expect(linha.textContent).not.toContain(FRASE_CELULA_BENCHMARK_QUEBRADO)
  })
})

// "Precisão das previsões" na Home (2ª revisão do PR #98, 05/10/2026): festa
// fechada com dado quebrado entrava na média da festa sã, calada. Agora fica
// fora, e a seção diz quantas e quais.
describe('a precisão das previsões da Home não mistura festa quebrada', () => {
  it('diz que a festa quebrada ficou fora da média, nomeando-a', () => {
    const q = festa('Brisa quebrada', 1e308, 5000)
    q.receitaRealizada = { bilheteria: 40000, bar: '' }
    montar([fecharEvento(q, '2026-12-13T12:00:00.000Z')])
    expect(document.body.textContent).toContain(
      '1 evento ficou fora desta média por ter um valor que o app não consegue calcular (“Brisa quebrada”)'
    )
  })
})
