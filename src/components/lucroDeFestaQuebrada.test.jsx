// @vitest-environment jsdom
//
// LUCRO, RESULTADO E MARGEM DE FESTA COM CUSTO QUEBRADO: A TELA DIZ, NÃO INVENTA.
//
// O que estava quebrado (medido pelo revisor do PR #98, 05/10/2026): com "Som e
// luz" em 1 seguido de 308 zeros, o custo saía R$ 0 e o LUCRO saía IGUAL À
// RECEITA, positivo e verde — Cenários R$ 15.200 / 17.100 / 19.000 numa festa
// de bilheteria R$ 20.000; o Relatório da festa fechada, "Resultado real
// R$ 19.000" em VERDE; a Apresentação, R$ 19.000 projetado na reunião.
//
// Precondição exata e caminho: `computeCenario` devolve custoTotal Infinity e
// lucro −Infinity (a conta grita, certo). Mas a tela imprimia (de 07/08 a
// 07/10/2026; hoje o cartão imprime o lucro do motor com centavos, P6 do
// plano dos centavos) `lucroQueFecha(c)` (exibicaoQueFecha.js), que refaz
// receita − custo com os termos arredondados por `num()`, e `num(Infinity)` é
// 0 — sobra a receita. No resultado real, a foto volta do localStorage com
// `resultado: null`, e a cor era `f.resultado >= 0` — `null >= 0` é true.
//
// Decisão do Marco, 26/07/2026: a tela DIZ que a festa tem dado quebrado em
// vez de imprimir número derivado de lixo. O conserto é só de exibição; este
// arquivo lê o número que cada tela imprime no lugar de lucro, resultado e
// margem — não o componente novo isolado.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import { VeredictoPainel, VeredictoSelo } from './Veredito.jsx'
import {
  NUMERO_NAO_CALCULA,
  CONSEQ_LUCRO,
  CONSEQ_NAO_USADO,
  TITULO_VEREDITO_QUEBRADO,
  FRASE_VEREDITO_QUEBRADO,
  CONSEQ_FOTO_E_AGORA,
  CONSERTO_NAO_MEXER,
  CONSERTO_CORRIGIR,
} from './AvisoCustoQuebrado.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'

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
const NIVEL_RELATORIO = 'previsao-eventos:relatorio-nivel:v1'
const DINHEIRO = /R\$\s?-?\d/

// A festa do revisor: bilheteria realizada R$ 20.000; o "Som e luz" decide.
function festa(nome, somELuz, realizadoDoSom = '') {
  const e = novoEvento(nome)
  e.data = '2026-12-12'
  e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 })]
  e.categorias = [
    cat('aeb', 'A&B', [novoItem({ servico: 'Bar', estimado: 3000 })]),
    cat('estrutura', 'Estrutura', [
      novoItem({ servico: 'Som e luz', estimado: somELuz, realizado: realizadoDoSom }),
    ]),
  ]
  e.receitaRealizada = { bilheteria: 20000, bar: '' }
  return e
}
const quebrada = () => festa('Brisa quebrada', 1e308)
const sa = () => festa('Marfim sã', 12000)
// Fechada e depois de uma volta pelo localStorage — é assim que o Marco a abre.
const fechadaSalva = (e) =>
  JSON.parse(JSON.stringify(fecharEvento(e, '2026-12-13T12:00:00.000Z')))
const store = (e) => ({
  eventos: [e],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksOcultos: [],
  benchmarksPadrao: {},
  benchmarksApagados: [],
  ajustes: {},
})

// Elementos-folha cujo texto é exatamente o rótulo. `tag` separa o rótulo do
// card (div/dt) da primeira célula da DRE (td), que tem o mesmo texto.
const rotulos = (raiz, texto, tag = 'div') =>
  Array.from(raiz.querySelectorAll(tag)).filter(
    (el) => el.children.length === 0 && el.textContent.trim() === texto
  )
// Células de uma linha de tabela pelo rótulo da primeira coluna.
const celulasDaLinha = (raiz, rotulo) => {
  const tr = Array.from(raiz.querySelectorAll('tr')).find(
    (l) => l.firstElementChild?.textContent.trim() === rotulo
  )
  return tr ? Array.from(tr.children).slice(1) : []
}

const montarCenarios = (e) =>
  render(<ScenariosTab evento={e} update={noop} store={store(e)} />).container
const montarRelatorio = (e, nivel) => {
  globalThis.localStorage.setItem(NIVEL_RELATORIO, nivel)
  return render(<ReportView evento={e} store={store(e)} onBack={noop} />).container
}
const montarApresentacao = (e) =>
  render(
    <PresentationMode evento={e} store={store(e)} update={noop} aparencia={{}} onClose={noop} />
  ).container

describe('aba Cenários: lucro e margem de festa quebrada', () => {
  it('o card de cada cenário diz "não dá para calcular" no lugar do lucro, sem verde', () => {
    const c = montarCenarios(quebrada())
    const lucros = rotulos(c, 'Lucro')
      .map((el) => el.nextElementSibling)
      .filter(Boolean)
    expect(lucros.length).toBe(3)
    for (const el of lucros) {
      expect(el.textContent).toBe(NUMERO_NAO_CALCULA)
      expect(el.className).not.toContain('verde')
    }
    expect(c.textContent).not.toMatch(/margem\s?-?\d/)
  })

  it('a DRE escreve o texto nas linhas Lucro e Margem dos três cenários', () => {
    const c = montarCenarios(quebrada())
    for (const rotulo of ['Lucro', 'Margem']) {
      const cel = celulasDaLinha(c, rotulo)
      expect(cel.length).toBe(3)
      for (const td of cel) {
        expect(td.textContent).toBe(NUMERO_NAO_CALCULA)
        expect(td.textContent).not.toMatch(DINHEIRO)
        expect(td.className).not.toContain('verde')
      }
    }
  })

  it('a faixa diz o que ESTA aba faz agora (custo R$ 0, lucro como texto)', () => {
    const c = montarCenarios(quebrada())
    expect(c.textContent).toContain(CONSEQ_LUCRO)
  })

  it('CONTRAPROVA: a festa sã continua com lucro em reais, na cor do resultado', () => {
    const c = montarCenarios(sa())
    const lucros = rotulos(c, 'Lucro').map((el) => el.nextElementSibling)
    expect(lucros.length).toBe(3)
    for (const el of lucros) {
      expect(el.textContent).toMatch(DINHEIRO)
      expect(el.className).toMatch(/verde-texto|vermelho-texto/)
    }
    expect(c.textContent).not.toContain(NUMERO_NAO_CALCULA)
  })

  it('estimado quebrado com realizado lançado: os números estão certos, e a faixa NÃO diz que zeram', () => {
    // Caso do revisor: a conta usa o realizado (R$ 5.000); "Custo total
    // R$ 8.800" é verdade, e a faixa dizia que a tela escrevia R$ 0.
    const c = montarCenarios(festa('Estimado quebrado', 1e308, 5000))
    expect(c.textContent).toContain(CONSEQ_NAO_USADO)
    expect(c.textContent).not.toContain(CONSEQ_LUCRO)
    expect(c.textContent).not.toContain(NUMERO_NAO_CALCULA)
  })
})

describe('Relatório: lucro, margem e resultado real de festa quebrada', () => {
  for (const nivel of ['resumido', 'completo']) {
    it(`${nivel}: o card de cada cenário não imprime lucro em reais`, () => {
      const c = montarRelatorio(quebrada(), nivel)
      // No card do relatório o rótulo "lucro" vem DEPOIS do número.
      const lucros = rotulos(c, 'lucro').map((el) => el.previousElementSibling)
      expect(lucros.length).toBe(3)
      for (const el of lucros) {
        expect(el.textContent).toBe(NUMERO_NAO_CALCULA)
        expect(el.getAttribute('style') || '').not.toContain('#00782a')
      }
      // Só os cards: o glossário do Completo também tem um <dt>Margem</dt>,
      // com a frase genérica "Margem 30% = …" (exemplo, não número da festa).
      const margens = rotulos(c, 'Margem', 'dt')
        .map((el) => el.nextElementSibling)
        .filter((dd) => dd && !dd.textContent.startsWith('Quanto sobra'))
      expect(margens.length).toBeGreaterThanOrEqual(3)
      for (const el of margens) expect(el.textContent).not.toMatch(/\d/)
      expect(c.textContent).not.toMatch(/margem realista -?\d/)
      expect(c.textContent).toContain(CONSEQ_LUCRO)
    })

    it(`${nivel}: festa FECHADA — o resultado real não sai em reais nem em verde`, () => {
      const c = montarRelatorio(fechadaSalva(quebrada()), nivel)
      const titulo = Array.from(c.querySelectorAll('div')).find(
        (d) => d.children.length === 0 && d.textContent.startsWith('Resultado real do evento')
      )
      expect(titulo).toBeTruthy()
      const valor = titulo.nextElementSibling
      expect(valor.textContent).toBe(NUMERO_NAO_CALCULA)
      expect(valor.className).not.toContain('green')
    })
  }

  it('completo: a DRE escreve o texto em Lucro e Margem', () => {
    const c = montarRelatorio(quebrada(), 'completo')
    for (const rotulo of ['Lucro', 'Margem']) {
      const cel = celulasDaLinha(c, rotulo)
      expect(cel.length).toBe(3)
      for (const td of cel) expect(td.textContent).toBe(NUMERO_NAO_CALCULA)
    }
    expect(c.textContent).not.toMatch(/margem de -?\d/)
  })

  it('CONTRAPROVA: festa sã fechada mostra o resultado real em reais, verde', () => {
    const c = montarRelatorio(fechadaSalva(sa()), 'resumido')
    const titulo = Array.from(c.querySelectorAll('div')).find(
      (d) => d.children.length === 0 && d.textContent.startsWith('Resultado real do evento')
    )
    expect(titulo.nextElementSibling.textContent).toMatch(DINHEIRO)
    expect(titulo.nextElementSibling.className).toContain('green')
  })
})

describe('Apresentação: lucro e resultado real de festa quebrada', () => {
  it('a faixa aparece, e nenhum card projeta lucro em reais', () => {
    const c = montarApresentacao(quebrada())
    expect(c.querySelector('[role="alert"]')).toBeTruthy()
    expect(c.textContent).toContain(CONSEQ_LUCRO)
    const lucros = rotulos(c, 'Lucro')
      .map((el) => el.nextElementSibling)
      .filter(Boolean)
    expect(lucros.length).toBe(3)
    for (const el of lucros) expect(el.textContent).toBe(NUMERO_NAO_CALCULA)
    expect(c.textContent).not.toMatch(/margem -?\d/)
    expect(c.textContent).not.toMatch(/Lucro: R\$/)
  })

  it('festa FECHADA: o resultado real não sai em reais', () => {
    const c = montarApresentacao(fechadaSalva(quebrada()))
    const forte = Array.from(c.querySelectorAll('strong')).find((s) =>
      s.parentElement.textContent.startsWith('Festa realizada')
    )
    expect(forte.textContent.trim()).toBe(NUMERO_NAO_CALCULA)
  })

  it('CONTRAPROVA: festa sã projeta o lucro em reais e sem faixa', () => {
    const c = montarApresentacao(sa())
    expect(c.querySelector('[role="alert"]')).toBe(null)
    const lucros = rotulos(c, 'Lucro')
      .map((el) => el.nextElementSibling)
      .filter(Boolean)
    for (const el of lucros) expect(el.textContent).toMatch(DINHEIRO)
  })
})

describe('veredito de festa quebrada: sem margem inventada', () => {
  // O painel no topo do editor dizia "Inviável como está: margem realista 0%
  // abaixo da mínima" — uma margem que não existe, e uma cor também.
  it('o painel do editor diz "Sem veredito" e não cita margem', () => {
    const c = render(<VeredictoPainel evento={quebrada()} update={noop} />).container
    expect(c.textContent).toContain(TITULO_VEREDITO_QUEBRADO)
    expect(c.textContent).toContain(FRASE_VEREDITO_QUEBRADO)
    expect(c.textContent).not.toMatch(/margem realista -?\d/)
  })

  it('o selo leva a mesma frase, não a margem', () => {
    const c = render(<VeredictoSelo evento={quebrada()} />).container
    expect(c.textContent).toContain(FRASE_VEREDITO_QUEBRADO)
    expect(c.textContent).not.toMatch(/margem realista -?\d/)
  })

  it('CONTRAPROVA: festa sã continua com o veredito de sempre', () => {
    const c = render(<VeredictoPainel evento={sa()} update={noop} />).container
    expect(c.textContent).not.toContain(TITULO_VEREDITO_QUEBRADO)
    expect(c.textContent).toMatch(/margem realista -?\d/)
  })
})

// Festa FECHADA com a fotografia SÃ e o cadastro corrompido depois (2ª revisão
// do PR #98, 05/10/2026): o Fechamento mandava NÃO restaurar nem reabrir, e
// Cenários, Relatório e Apresentação mandavam "volte a uma cópia de segurança"
// — o conselho que o próprio código chama de danoso nesse caso — e diziam que
// "o resultado" não dá para calcular ao lado do resultado real da fotografia,
// que está certo.
describe('festa fechada sã e corrompida depois: o mesmo conselho do Fechamento', () => {
  const corrompidaDepois = () => {
    const f = fechadaSalva(festa('Brisa fechada', 12000))
    f.categorias[1].itens[0].estimado = 1e308
    return f
  }
  const n = (s) => s.replace(/\s+/g, ' ')
  const TELAS = {
    Cenários: (e) => montarCenarios(e),
    Relatório: (e) => montarRelatorio(e, 'resumido'),
    Apresentação: (e) => montarApresentacao(e),
  }

  for (const [tela, montar] of Object.entries(TELAS)) {
    it(`${tela}: manda NÃO mexer, e diz que o resultado real da foto vale`, () => {
      const t = n(montar(corrompidaDepois()).textContent)
      expect(t).toContain(n(CONSERTO_NAO_MEXER))
      expect(t).not.toContain(n(CONSERTO_CORRIGIR))
      expect(t).toContain(n(CONSEQ_FOTO_E_AGORA))
    })
  }

  it('Relatório: o resultado real continua sendo o da foto, em reais', () => {
    const c = montarRelatorio(corrompidaDepois(), 'resumido')
    const titulo = Array.from(c.querySelectorAll('div')).find(
      (d) => d.children.length === 0 && d.textContent.startsWith('Resultado real do evento')
    )
    expect(titulo.nextElementSibling.textContent).toMatch(DINHEIRO)
  })

  it('Cenários: o card do realizado aponta para a fotografia na aba Fechamento', () => {
    const t = n(montarCenarios(corrompidaDepois()).textContent)
    expect(t).toContain('o da fotografia do fechamento, que vale, está na aba Fechamento')
  })

  it('CONTRAPROVA: corrompida e DEPOIS fechada (foto quebrada) — aí o conselho é corrigir', () => {
    const t = n(montarRelatorio(fechadaSalva(quebrada()), 'resumido').textContent)
    expect(t).toContain(n(CONSERTO_CORRIGIR))
    expect(t).not.toContain(n(CONSERTO_NAO_MEXER))
  })
})

// Dois custos de 1e306 (caso V6 do revisor, 05/10/2026): CADA UM cabe na
// régua, a soma não — nenhum item sozinho é acusado, só `somaNaoCabe`. Medido:
// a soma por centavos estoura e o lucro sai −Infinity, então a tela tem de
// trocá-lo por texto mesmo sem item culpado. (Este teste NÃO distingue
// `Number.isFinite` da régua da casa: no caminho do custo os dois coincidem,
// porque a soma já vira infinito. Quem guarda a régua nova é o Pix de 1e308,
// FINITO, em receitaQuebrada.test.jsx.)
describe('lucro finito mas fora da régua: dois custos de 1e306', () => {
  it('Cenários: o card não imprime o lucro de centenas de dígitos', () => {
    const e = festa('Dois de 1e306', 0)
    e.categorias[1].itens = [
      novoItem({ servico: 'A', estimado: 1e306 }),
      novoItem({ servico: 'B', estimado: 1e306 }),
    ]
    const c = montarCenarios(e)
    const lucros = rotulos(c, 'Lucro').map((el) => el.nextElementSibling)
    expect(lucros.length).toBe(3)
    for (const el of lucros) expect(el.textContent).toBe(NUMERO_NAO_CALCULA)
    expect(c.textContent).not.toMatch(/R\$ ?-?[\d.]{40,}/)
  })
})

// "Orçamento fechado ou pago" nos números-chave do Relatório (05/10/2026): com
// o custo de 1e308 saía "0% (R$ 0 de R$ 100.000…000)", centenas de dígitos no
// papel que vai às sócias.
describe('Relatório: orçamento fechado de festa quebrada', () => {
  it('diz que não dá para calcular, sem número de centenas de dígitos', () => {
    const t = montarRelatorio(quebrada(), 'resumido').textContent.replace(/\s+/g, ' ')
    expect(t).toContain(`Orçamento fechado ou pago${NUMERO_NAO_CALCULA}`)
    expect(t).not.toMatch(/R\$ ?[\d.]{40,}/)
  })
})
