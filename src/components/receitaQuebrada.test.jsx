// @vitest-environment jsdom
//
// RECEITA REALIZADA QUE NÃO CABE NUMA CONTA: A TELA DIZ QUAL CAMPO, E NÃO
// IMPRIME O NÚMERO.
//
// O que estava quebrado (2ª revisão adversarial do PR #98, 05/10/2026): a
// migração aceita 1e308 na bilheteria, no bar e no Pix líquido realizados (#95).
//   - Pix em 1e308: a foto do fechamento grava `resultado: 1e308`, que é
//     FINITO — `fotoQuebrada` usava `Number.isFinite` e deixava passar; o
//     Relatório, a Apresentação, o Fechamento e a Home imprimiam
//     "R$ 100.000.000…000" sem aviso.
//   - Bilheteria em 1e308: a foto grava `resultado: null`, o Relatório e a
//     Apresentação escreviam "não dá para calcular" — e nenhuma faixa dizia por
//     quê, porque a faixa de custo só aparece com custo quebrado.
// Regra pedida pelo revisor: sempre que um número vira "não dá para calcular",
// a tela tem uma faixa que diz qual campo está quebrado.
//
// Decisão do Marco, 26/07/2026: a tela DIZ que a festa tem dado quebrado em vez
// de imprimir número derivado de lixo. Só exibição; nenhuma conta muda.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import Home from './Home.jsx'
import {
  NUMERO_NAO_CALCULA,
  TITULO_CUSTO_QUEBRADO,
  TITULO_RECEITA_QUEBRADA,
  FRASE_CARTAO_RECEITA_QUEBRADA,
  CONSERTO_RECEITA,
  CONSERTO_RECEITA_FOTO_SA,
} from './AvisoCustoQuebrado.jsx'
import { receitaQuebrada, fotoQuebrada } from '../lib/dadoQuebrado.js'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import { resultadoRealizado, fechamentoReceita } from '../lib/fechamento.js'
import { computeCenarios } from '../lib/calc.js'
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
const EM = '2026-10-05T12:00:00.000Z'
const salva = (e) => migrarEvento(JSON.parse(JSON.stringify(e)))
const txt = (el) => el.textContent.replace(/\s+/g, ' ')
const GIGANTE = /R\$ ?-?[\d.]{40,}/

function festa(nome, rr) {
  const e = novoEvento(nome)
  e.tipo = 'Brisa'
  e.data = '2026-09-10'
  e.publicoEstimado = 200
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.contingenciaPct = 10
  e.categorias = [
    { id: 'aeb', nome: 'A&B', padrao: false, itens: [novoItem({ servico: 'Bebidas', estimado: 3000, realizado: 3300 })] },
  ]
  e.receitaRealizada = rr
  return e
}
// Fotografia já guardada ANTES do S4: a porta atual corretamente recusa
// essas origens, mas a leitura ainda precisa explicar fotografias legadas.
// A forma vem de um fechamento válido; os números antigos vêm dos módulos
// canônicos, com o mesmo JSON que convertia não-finitos em null no disco.
const fechada = (rr) => {
  const evento = salva(festa('Marfim', rr))
  const controle = fecharEvento({ ...evento, receitaRealizada: { bilheteria: 20000, bar: '' } }, EM)
  const realista = computeCenarios(evento).realista
  return salva({
    ...controle,
    receitaRealizada: evento.receitaRealizada,
    fechamento: { ...controle.fechamento, foto: {
      ...controle.fechamento.foto,
      resultado: resultadoRealizado(evento, realista),
      receita: fechamentoReceita(evento, realista),
    } },
  })
}
const PIX = { bilheteria: 20000, bar: '', pix: 1e308 }
const BILHETERIA = { bilheteria: 1e308, bar: '' }
const st = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

const TELAS = {
  Relatório: (e) => {
    mapa.set('previsao-eventos:relatorio-nivel:v1', 'resumido')
    return <ReportView evento={e} store={st(e)} onBack={noop} />
  },
  Apresentação: (e) => <PresentationMode evento={e} store={st(e)} update={noop} aparencia={{}} onClose={noop} />,
  Fechamento: (e) => (
    <FechamentoTab evento={e} update={noop} store={st(e)} onPromoverBenchmark={noop} onFecharEvento={noop} onReabrirEvento={noop} />
  ),
  Cenários: (e) => <ScenariosTab evento={e} update={noop} store={st(e)} />,
}

describe('a régua da receita e da foto', () => {
  it('receitaQuebrada nomeia o campo; festa sã passa limpa', () => {
    expect(receitaQuebrada(festa('x', PIX)).campos).toEqual(['o Pix recebido'])
    expect(receitaQuebrada(festa('x', BILHETERIA)).campos).toEqual(['a bilheteria realizada'])
    expect(receitaQuebrada(festa('x', { bilheteria: 20000, bar: '', pix: 1500 })).ha).toBe(false)
    expect(receitaQuebrada(festa('x', { bilheteria: '', bar: '' })).ha).toBe(false)
  })

  it('fotoQuebrada acusa o 1e308 FINITO do Pix, e não a foto sã', () => {
    expect(fechada(PIX).fechamento.foto.resultado.resultado).toBe(1e308)
    expect(fotoQuebrada(fechada(PIX).fechamento.foto.resultado)).toBe(true)
    expect(fotoQuebrada(fechada({ bilheteria: 20000, bar: '' }).fechamento.foto.resultado)).toBe(false)
  })
})

for (const [caso, rr] of [['Pix em 1e308', PIX], ['bilheteria em 1e308', BILHETERIA]]) {
  describe(`fotografia antiga já guardada com ${caso}`, () => {
    for (const [tela, montar] of Object.entries(TELAS)) {
      it(`${tela}: nenhum número gigante, e todo "não dá para calcular" vem com a faixa da receita`, () => {
        const t = txt(render(montar(fechada(rr))).container)
        expect(t).not.toMatch(GIGANTE)
        if (t.includes(NUMERO_NAO_CALCULA)) expect(t).toContain(TITULO_RECEITA_QUEBRADA)
        expect(t).toContain(TITULO_RECEITA_QUEBRADA)
        expect(t).not.toContain(TITULO_CUSTO_QUEBRADO) // não acusa custo que está são
      })
    }

    it('Relatório: o resultado real diz que não dá para calcular, e a faixa nomeia o campo', () => {
      const t = txt(render(TELAS.Relatório(fechada(rr))).container)
      expect(t).toMatch(/Resultado real do evento · fechado em [\d/]+não dá para calcular/)
      expect(t).toContain(caso.startsWith('Pix') ? 'O valor do Pix recebido' : 'O valor da bilheteria realizada')
      expect(t).toContain(CONSERTO_RECEITA)
    })
  })
}

describe('Home: o cartão da festa com receita quebrada', () => {
  it('diz que a RECEITA não dá para calcular, sem número gigante', () => {
    const c = render(
      <Home store={st(fechada(PIX))} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />
    ).container
    const t = txt(c)
    expect(t).toContain(FRASE_CARTAO_RECEITA_QUEBRADA)
    expect(t).not.toMatch(GIGANTE)
  })
})

describe('festa fechada SÃ e receita corrompida depois', () => {
  const corrompidaDepois = () => {
    const f = fechada({ bilheteria: 20000, bar: '' })
    f.receitaRealizada = { ...f.receitaRealizada, pix: 1e308 }
    return f
  }

  it('Relatório: o resultado real continua em reais, e o conselho é NÃO mexer', () => {
    const t = txt(render(TELAS.Relatório(corrompidaDepois())).container)
    expect(t).toContain(TITULO_RECEITA_QUEBRADA)
    expect(t).toContain(CONSERTO_RECEITA_FOTO_SA)
    expect(t).not.toContain(CONSERTO_RECEITA)
    expect(t).toMatch(/Resultado real do evento · fechado em [\d/]+R\$/)
  })
})

describe('CONTRAPROVA: festa sã', () => {
  for (const [tela, montar] of Object.entries(TELAS)) {
    it(`${tela}: nem faixa de receita, nem "não dá para calcular"`, () => {
      const t = txt(render(montar(fechada({ bilheteria: 20000, bar: '', pix: 1500 }))).container)
      expect(t).not.toContain(TITULO_RECEITA_QUEBRADA)
      expect(t).not.toContain(NUMERO_NAO_CALCULA)
    })
  }
})

// ————— O CARD DO FECHAMENTO, LINHA A LINHA (3ª revisão do PR #98, 05/10/2026) —————
// A rodada anterior trocou bilheteria, Pix, receita, custos e resultado e
// deixou passar os vizinhos: "Bar (lucro líquido) + R$ 100.000…" (bar 1e308),
// "Taxa da bilheteria (10%) − R$ 1.000.000…" (bilheteria 1e307 — a taxa de
// 1e306 cabe na régua sozinha) e "Taxa da bilheteria + R$ 0" (bilheteria
// 1e308, sinal trocado). Lição do revisor: "a cada rodada o conserto cobriu
// exatamente os campos que o teste hostil anterior usava". Por isso este bloco
// varre TODA a família de receita, nas duas grandezas, com taxa, cashback,
// imposto e patrocínio ligados, e lê TODA linha do card — não uma lista.
describe('card do Fechamento: nenhuma linha imprime número derivado de receita quebrada', () => {
  const completa = (campo, valor) => {
    const e = festa(`Marfim ${campo} ${valor}`, { bilheteria: 20000, bar: 1500, pix: 700 })
    e.taxaBilheteria = 10
    e.cashbackPct = 5
    e.impostoPct = 10
    e.impostoSobre = { bilheteria: true, bar: true, patrocinio: true }
    e.patrocinios = [{ id: 'p1', patrocinador: 'Marca', valor: 1000, estagio: 'confirmado' }]
    if (campo === 'patrocínio') e.patrocinios[0].valor = valor
    else e.receitaRealizada[campo] = valor
    return salva(e)
  }
  const fechamento = (e) =>
    render(
      <FechamentoTab evento={e} update={noop} store={st(e)} onPromoverBenchmark={noop} onFecharEvento={noop} onReabrirEvento={noop} />
    ).container
  // As linhas da conta: rótulo à esquerda, valor (último filho) à direita.
  const linhasDoCard = (c) =>
    Array.from(c.querySelectorAll('div.flex.items-baseline.justify-between')).map((d) => ({
      rotulo: d.firstElementChild.textContent.replace(/\s+/g, ' ').trim(),
      sinal: d.firstElementChild.firstElementChild?.textContent.trim(),
      valor: d.lastElementChild.textContent.replace(/\s+/g, ' ').trim(),
    }))

  for (const campo of ['bilheteria', 'bar', 'pix', 'patrocínio']) {
    for (const valor of [1e307, 1e308]) {
      it(`${campo} em ${valor}: toda linha é dinheiro ou "não dá para calcular" sem "+", e a faixa nomeia o campo`, () => {
        const c = fechamento(completa(campo, valor))
        const t = txt(c)
        expect(t).not.toMatch(GIGANTE)
        const linhas = linhasDoCard(c)
        expect(linhas.length).toBeGreaterThanOrEqual(8) // a conta inteira está na tela
        for (const l of linhas) {
          // "=" (totais) e o "−" fixo dos custos são estrutura da conta; o sinal
          // CALCULADO de um número quebrado some — nunca um "+" de lixo
          if (l.valor === NUMERO_NAO_CALCULA) expect(l.sinal, l.rotulo).not.toBe('+')
          // dinheiro de tamanho de festa: até 15 caracteres de dígitos e pontos
          else expect(l.valor, l.rotulo).toMatch(/^[+−-]? ?R\$\s?[\d.]{1,15}(,\d{2})?$/)
        }
        expect(linhas.some((l) => l.valor === NUMERO_NAO_CALCULA)).toBe(true)
        expect(t).toContain(TITULO_RECEITA_QUEBRADA)
      })
    }
  }

  it('bilheteria em 1e308: a taxa não sai "+ R$ 0" com o sinal trocado', () => {
    const taxa = linhasDoCard(fechamento(completa('bilheteria', 1e308))).find((l) => l.rotulo.includes('Taxa da bilheteria'))
    expect(taxa.valor).toBe(NUMERO_NAO_CALCULA)
    expect(taxa.sinal).toBe('')
  })

  it('CONTRAPROVA: a mesma festa sã tem toda linha em reais', () => {
    const e = festa('Marfim sã', { bilheteria: 20000, bar: 1500, pix: 700 })
    e.taxaBilheteria = 10
    e.cashbackPct = 5
    e.impostoPct = 10
    e.impostoSobre = { bilheteria: true, bar: true, patrocinio: true }
    e.patrocinios = [{ id: 'p1', patrocinador: 'Marca', valor: 1000, estagio: 'confirmado' }]
    const linhas = linhasDoCard(fechamento(salva(e)))
    expect(linhas.length).toBeGreaterThanOrEqual(8)
    for (const l of linhas) expect(l.valor, l.rotulo).toMatch(/^[+−-]? ?R\$\s?[\d.]{1,15}(,\d{2})?$/)
    // a taxa da festa sã tem sinal — é o que a linha quebrada perde
    expect(linhas.find((l) => l.rotulo.includes('Taxa da bilheteria')).sinal).toBe('−')
  })
})
