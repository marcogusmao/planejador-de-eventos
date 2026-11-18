// @vitest-environment jsdom
//
// FECHAMENTO E ANÁLISE: A FAIXA DESCREVE A TELA INTEIRA, E O NÚMERO QUE VEM DO
// LIXO VIRA TEXTO.
//
// O que estava quebrado (2ª revisão adversarial do PR #98, 05/10/2026):
//
//   Fechamento, estimado 1e308 + realizado R$ 5.000 — a faixa dizia "Os
//   números desta tela não usam esse valor e continuam valendo", e a tabela
//   imprimia "Estrutura ESTOURO R$ 0 R$ 5.000 + R$ 5.000 (+0%)" e "Orçamento de
//   custos (todos os itens) R$ 0". Causa: a frase decidia só pelo card
//   (`cardCabeComoDinheiro`), e a tabela Estimado × Realizado passa cada valor
//   por `fmtBRL`, que devolve R$ 0 para o que não é finito.
//   Fechamento, custo quebrado sem realizado — "Resultado parcial R$ 0".
//   Fechamento, festa fechada sã e corrompida depois — "Se fosse fechado hoje,
//   o resultado seria R$ 0 — fórmulas ou premissas mudaram", atribuindo a
//   fórmulas o que é um custo que não é dinheiro.
//   Análise, mesmo caso do estimado 1e308 + realizado — a faixa dizia que os
//   saldos "saem com um número de centenas de dígitos", e a tela imprimia
//   "Vamos ter caixa? Sim" e "Caixa mínimo R$ 0 em D-60": decidia por
//   `somaNaoCabe` e não pelo que a aba imprime.
//
// Decisão do Marco, 26/07/2026: a tela DIZ que a festa tem dado quebrado em vez
// de imprimir número derivado de lixo. Só exibição; nenhuma conta muda.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import FechamentoTab from './FechamentoTab.jsx'
import AnaliseTab from './AnaliseTab.jsx'
import {
  NUMERO_NAO_CALCULA,
  CONSEQ_TEXTO,
  CONSEQ_NAO_USADO,
  CONSEQ_NUMERO_GIGANTE,
  CONSEQ_FOTO_INTACTA,
  CONSERTO_NAO_MEXER,
} from './AvisoCustoQuebrado.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import { migrarEvento } from '../lib/migracao.js'

afterEach(cleanup)

const mapa = new Map()
globalThis.localStorage = {
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
  clear: () => mapa.clear(),
}

const noop = () => {}
const cat = (id, nome, itens) => ({ id, nome, padrao: false, itens })
const EM = '2026-10-05T12:00:00.000Z'
// Volta pelo localStorage, como o Marco abre a festa.
const salva = (e) => migrarEvento(JSON.parse(JSON.stringify(e)))
const n = (s) => s.replace(/\s+/g, ' ')
const txt = (el) => n(el.textContent)

// As festas do revisor: bilheteria realizada R$ 20.000, A&B R$ 3.000.
function festa(nome, somELuz, extra = {}) {
  const e = novoEvento(nome)
  e.tipo = 'Brisa'
  e.data = '2026-12-05'
  e.publicoEstimado = 200
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.contingenciaPct = 10
  e.categorias = [
    cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 3000 })]),
    cat('estrutura', 'Estrutura', [novoItem({ servico: 'Som e luz', estimado: somELuz, ...extra })]),
  ]
  e.receitaRealizada = { bilheteria: 20000, bar: '' }
  return e
}
const st = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })
const fechamento = (e) =>
  render(
    <FechamentoTab
      evento={e}
      update={noop}
      store={st(e)}
      onPromoverBenchmark={noop}
      onFecharEvento={noop}
      onReabrirEvento={noop}
    />
  ).container
// Linha da tabela pelo rótulo da primeira célula (que pode trazer a pendência).
const linha = (c, rotulo) =>
  Array.from(c.querySelectorAll('tr')).find((tr) =>
    tr.firstElementChild?.textContent.trim().startsWith(rotulo)
  )
// Linha do card pelo rótulo.
const linhaDoCard = (c, rotulo) =>
  Array.from(c.querySelectorAll('div.flex.items-baseline')).find((d) =>
    d.textContent.includes(rotulo)
  )

describe('Fechamento: estimado 1e308 com realizado de R$ 5.000', () => {
  const v5 = () => salva(festa('V5', 1e308, { realizado: 5000 }))

  it('a linha Estrutura não imprime R$ 0 nem ESTOURO: o estimado vira texto', () => {
    const c = fechamento(v5())
    const tr = linha(c, 'Estrutura')
    expect(tr).toBeTruthy()
    expect(tr.textContent).not.toContain('ESTOURO')
    expect(tr.textContent).not.toMatch(/R\$\s?0(?![\d.,])/)
    expect(tr.textContent).toContain(NUMERO_NAO_CALCULA)
    expect(tr.textContent).toMatch(/R\$\s?5\.000/) // o realizado é dinheiro e fica
  })

  it('"Orçamento de custos (todos os itens)" diz que não dá para calcular', () => {
    const c = fechamento(v5())
    const tr = linha(c, 'Orçamento de custos')
    expect(tr.textContent).toContain(NUMERO_NAO_CALCULA)
    expect(tr.textContent).not.toMatch(/R\$/)
  })

  it('a faixa não diz mais que os números "continuam valendo"', () => {
    const t = txt(fechamento(v5()))
    expect(t).toContain(n(CONSEQ_TEXTO))
    expect(t).not.toContain(n(CONSEQ_NAO_USADO))
  })

  it('o card continua com o resultado certo (usa o realizado)', () => {
    const c = fechamento(v5())
    expect(linhaDoCard(c, 'Resultado parcial').textContent).toMatch(/R\$\s?11\.000/)
  })
})

describe('Fechamento: custo quebrado sem realizado', () => {
  it('festa ABERTA: "Resultado parcial" e "Custos considerados" viram texto, sem R$ 0', () => {
    const c = fechamento(salva(festa('V1', 1e308)))
    for (const rotulo of ['Resultado parcial', 'Custos considerados']) {
      // o VALOR da linha (a nota ao lado traz "R$ 0 realizado", que é verdade)
      const valor = linhaDoCard(c, rotulo).lastElementChild
      expect(valor.textContent).toBe(NUMERO_NAO_CALCULA)
    }
  })

  it('corrompida e DEPOIS fechada (foto com null): o card não imprime R$ 0 nem verde', () => {
    const c = fechamento(salva(fecharEvento(salva(festa('V3', 1e308)), EM)))
    const el = linhaDoCard(c, 'Resultado')
    expect(el.textContent).toContain(NUMERO_NAO_CALCULA)
    expect(el.innerHTML).not.toContain('verde')
  })
})

describe('Fechamento: festa fechada SÃ e corrompida depois (fotografia boa)', () => {
  const v4 = () => {
    const f = salva(fecharEvento(salva(festa('V4', 400000)), EM))
    f.categorias[1].itens[0].estimado = 1e308
    return f
  }

  it('o card mostra a fotografia, e a faixa manda NÃO mexer', () => {
    const c = fechamento(v4())
    const t = txt(c)
    expect(linhaDoCard(c, 'Resultado').textContent).toMatch(/384\.000/)
    expect(t).toContain(n(CONSEQ_FOTO_INTACTA))
    expect(t).toContain(n(CONSERTO_NAO_MEXER))
  })

  it('a nota de recálculo culpa o custo, não "fórmulas ou premissas", e não imprime R$ 0', () => {
    const t = txt(fechamento(v4()))
    expect(t).toContain('Se fosse fechado hoje, não daria para calcular o resultado')
    expect(t).toContain('um custo do cadastro desta festa não cabe numa conta de dinheiro')
    expect(t).not.toContain('fórmulas ou premissas')
    expect(t).not.toMatch(/resultado seria R\$/)
  })
})

describe('Fechamento: CONTRAPROVA com festa sã', () => {
  it('nenhum "não dá para calcular", e o ESTOURO de verdade continua', () => {
    const c = fechamento(salva(festa('Sã', 4000, { realizado: 5000 })))
    const t = txt(c)
    expect(t).not.toContain(NUMERO_NAO_CALCULA)
    expect(linha(c, 'Estrutura').textContent).toContain('ESTOURO')
  })
})

describe('Análise: a frase da faixa sai do que a aba imprime', () => {
  // A linha do tempo precisa de data, de curva pelas datas dos lotes e de
  // pagamento com data — a montagem do revisor (P3).
  const comAgenda = (somELuz, extra = {}) => {
    const e = festa('Análise', somELuz, { dataPagamento: '2026-09-05', ...extra })
    e.receitaRealizada = { bilheteria: '', bar: '' }
    e.categorias[0].itens[0].dataPagamento = '2026-09-01'
    e.curvaModo = 'datas'
    e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200, viradaPrevista: '2026-09-01' })]
    return salva(e)
  }

  it('estimado 1e308 + realizado: os saldos são dinheiro, e a faixa diz que valem', () => {
    const t = txt(render(<AnaliseTab evento={comAgenda(1e308, { realizado: 5000 })} update={noop} />).container)
    expect(t).toContain('Vamos ter caixa?')
    expect(t).toContain(n(CONSEQ_NAO_USADO))
    expect(t).not.toContain(n(CONSEQ_NUMERO_GIGANTE))
  })

  it('CONTRAPROVA: sem o realizado, os saldos explodem e a faixa diz isso', () => {
    const t = txt(render(<AnaliseTab evento={comAgenda(1e308)} update={noop} />).container)
    expect(t).toMatch(/R\$ ?-?[\d.]{40,}/)
    expect(t).toContain(n(CONSEQ_NUMERO_GIGANTE))
  })
})

// A acurácia no Fechamento da festa SÃ (P4 do revisor, 05/10/2026): com a
// quebrada fechada ao lado, "Estrutura +10%" virava "+5%" sem aviso.
describe('Fechamento da festa SÃ: a acurácia não mistura a festa quebrada', () => {
  const comRealizado = (nome, est, real) => {
    const e = festa(nome, est, { realizado: real })
    e.data = '2026-09-10'
    e.categorias[0].itens[0].realizado = 3300
    return salva(fecharEvento(salva(e), EM))
  }

  it('continua +10% em Estrutura, e diz que uma festa ficou de fora', () => {
    const sa = comRealizado('Brisa sã', 20000, 22000)
    const q = comRealizado('Brisa V5', 1e308, 5000)
    const c = render(
      <FechamentoTab
        evento={sa}
        update={noop}
        store={{ eventos: [sa, q], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
        onPromoverBenchmark={noop}
        onFecharEvento={noop}
        onReabrirEvento={noop}
      />
    ).container
    const t = txt(c)
    expect(t).toMatch(/Estrutura \(1 ev\.\)\+10%/)
    expect(t).not.toMatch(/Estrutura \(2 ev\.\)/)
    expect(t).toContain('1 evento ficou fora desta média por ter um valor que o app não consegue calcular (“Brisa V5”)')
  })
})
