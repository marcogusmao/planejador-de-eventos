// @vitest-environment jsdom
//
// Decisão do Marco (26/07/2026), com o número medido na mesa: no MESMO
// relatório a tabela Bilheteria somava R$ 66.000 e o DRE mostrava R$ 59.400
// (evento real "Brisa #3 — teste F2-W", 19/07/2026) — diferença de R$ 6.600
// sem uma linha nem uma nota. A tabela usava o preço CHEIO do lote; o DRE
// aplicava o % de venda do cenário Realista, lote a lote
// (180×60 + 270×80 + 270×100 = 59.400 = 66.000 × 90%).
//
// Este arquivo trava o motivo: a coluna "Receita (Realista)" da tabela
// Bilheteria tem de SOMAR exatamente o que a linha "Receita bruta bilheteria"
// do DRE mostra, no MESMO relatório — sem cupom e COM cupom (onde entram os
// dois fatores, % de venda e desconto). A coluna "Potencial (100%)" continua
// existindo, com o preço cheio (o que a tabela mostrava antes), para não
// desaparecer a informação que serve para decidir preço.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ReportView from './ReportView.jsx'
import { novoEvento, novoLote } from '../lib/defaults.js'

afterEach(cleanup)

const NIVEL_KEY = 'previsao-eventos:relatorio-nivel:v1'

// localStorage de mentira (mesmo padrão de App.fio.test.jsx) — o global do
// ambiente de teste não tem setItem confiável; sem isso o "Completo" nunca
// liga e a seção Bilheteria nem chega a renderizar.
function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    get length() {
      return mapa.size
    },
    key: (i) => [...mapa.keys()][i] ?? null,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
})

// Números do exemplo real do Marco: 3 lotes de 200/300/300 ingressos a
// 60/80/100, cenário Realista com vendaPct 90% (o padrão de todo evento novo,
// em defaults.js) — 66.000 de potencial, 59.400 no Realista.
function montarEvento({ cupom = 0 } = {}) {
  const evento = novoEvento('Brisa #3 — teste F2-W')
  evento.lotes = [
    novoLote({ nome: 'Lote 1', valor: 60, quantidade: 200 }),
    novoLote({ nome: 'Lote 2', valor: 80, quantidade: 300 }),
    novoLote({ nome: 'Lote 3', valor: 100, quantidade: 300 }),
    novoLote({ nome: 'Lote Porta', somenteOtimista: true, valor: 50, quantidade: 40 }),
    novoLote({ nome: 'Cortesia', valor: 0, quantidade: 10 }),
  ]
  if (cupom !== 0) evento.descontoMedioPct = cupom
  return evento
}

function montarStore(evento) {
  return { eventos: [evento], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }
}

// "R$ 66.000" / "R$ 1.234,56" → número. Remove tudo que não é dígito, vírgula
// ou sinal; troca a vírgula decimal por ponto. Mesma leitura que um humano
// faria da célula, não um valor calculado em paralelo.
function parseBRL(texto) {
  const limpo = (texto || '').replace(/[^\d,-]/g, '')
  if (!limpo) return NaN
  return Number(limpo.replace(',', '.'))
}

function renderCompleto(evento) {
  localStorage.setItem(NIVEL_KEY, 'completo')
  const store = montarStore(evento)
  return render(<ReportView evento={evento} store={store} onBack={() => {}} />)
}

// Acha, na tabela do DRE, a célula da coluna Realista na linha de rótulo dado.
// Colunas do DRE (nesta ordem): [Linha, Pessimista, Realista, Otimista].
function celulaDreRealista(container, rotuloLinha) {
  const linhas = Array.from(container.querySelectorAll('tr'))
  const linha = linhas.find((tr) => tr.querySelector('td')?.textContent === rotuloLinha)
  if (!linha) throw new Error(`Linha do DRE não encontrada: "${rotuloLinha}"`)
  const tds = Array.from(linha.querySelectorAll('td'))
  return tds[2].textContent // 0=label, 1=pessimista, 2=realista, 3=otimista
}

// Acha a tabela de Bilheteria (a que segue o <h2>Bilheteria</h2>) e devolve
// o índice da coluna "Receita (Realista)" e as linhas de dados.
function tabelaBilheteria(container) {
  const h2 = Array.from(container.querySelectorAll('h2')).find((h) => h.textContent === 'Bilheteria')
  const table = h2.parentElement.querySelector('table')
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)
  const idxReceita = headers.indexOf('Receita (Realista)')
  const idxPotencial = headers.indexOf('Preço cheio × capacidade')
  const linhas = Array.from(table.querySelectorAll('tbody tr'))
  return { linhas, idxReceita, idxPotencial }
}

describe('ReportView — tabela Bilheteria mostra a Receita do cenário Realista (Marco, 26/07/2026)', () => {
  it('SEM cupom: a soma da coluna Receita bate com a Receita bruta bilheteria do DRE', () => {
    const evento = montarEvento()
    const { container } = renderCompleto(evento)

    const dreTxt = celulaDreRealista(container, 'Receita bruta bilheteria')
    const dreValor = parseBRL(dreTxt)
    expect(dreValor).toBeCloseTo(59400, 2) // 180×60 + 270×80 + 270×100, vendaPct 90%

    const { linhas, idxReceita, idxPotencial } = tabelaBilheteria(container)
    expect(idxReceita).toBeGreaterThanOrEqual(0)
    expect(idxPotencial).toBeGreaterThanOrEqual(0)

    const somaReceita = linhas.reduce((s, tr) => {
      const txt = tr.querySelectorAll('td')[idxReceita].textContent
      return s + (txt === '—' ? 0 : parseBRL(txt))
    }, 0)
    expect(somaReceita).toBeCloseTo(dreValor, 2)

    // A coluna Potencial continua existindo com o preço CHEIO (o que a
    // tabela mostrava sozinha antes desta decisão) — 66.000 de capacidade
    // vendida a 100%, só nos 3 lotes normais. O "só otimista" segue
    // travessão nesta coluna também (decisão desta sessão, ver relato ao
    // Marco): hoje ele já era travessão na única coluna de receita que
    // existia, e o rótulo "Potencial (100%)" continuaria induzindo a somar
    // um número que só existe no cenário Otimista.
    const somaPotencial = linhas.reduce((s, tr) => {
      const txt = tr.querySelectorAll('td')[idxPotencial].textContent
      return s + (txt === '—' ? 0 : parseBRL(txt))
    }, 0)
    expect(somaPotencial).toBeCloseTo(66000, 2)
  })

  it('COM cupom: os dois fatores (vendaPct do cenário + desconto do cupom) entram juntos, e a soma ainda bate com o DRE', () => {
    const evento = montarEvento({ cupom: 20 }) // 20% de desconto médio, modo padrão (100% dos ingressos)
    const { container } = renderCompleto(evento)

    const dreTxt = celulaDreRealista(container, 'Receita bruta bilheteria')
    const dreValor = parseBRL(dreTxt)
    // 59.400 (só vendaPct) × 0,80 (cupom 20%) = 47.520 — os DOIS fatores.
    expect(dreValor).toBeCloseTo(47520, 2)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    const somaReceita = linhas.reduce((s, tr) => {
      const txt = tr.querySelectorAll('td')[idxReceita].textContent
      return s + (txt === '—' ? 0 : parseBRL(txt))
    }, 0)
    expect(somaReceita).toBeCloseTo(dreValor, 2)
  })

  it('lote "só otimista" continua travessão nas duas colunas novas; cortesia continua R$ 0,00 (não quebrou o que já era legível)', () => {
    const evento = montarEvento()
    const { container } = renderCompleto(evento)
    const { linhas, idxReceita, idxPotencial } = tabelaBilheteria(container)

    const linhaPorta = linhas.find((tr) => tr.textContent.includes('Lote Porta'))
    expect(linhaPorta.querySelectorAll('td')[idxReceita].textContent).toBe('—')
    expect(linhaPorta.querySelectorAll('td')[idxPotencial].textContent).toBe('—')

    const linhaCortesia = linhas.find((tr) => tr.textContent.includes('Cortesia'))
    expect(parseBRL(linhaCortesia.querySelectorAll('td')[idxReceita].textContent)).toBe(0)
    expect(parseBRL(linhaCortesia.querySelectorAll('td')[idxPotencial].textContent)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O FURO QUE A VERIFICAÇÃO ADVERSARIAL DE 26/07/2026 ACHOU, e que é MAIOR que
// o defeito original: com ticket médio manual (uma feature que já está em uso),
// computeCenario troca a `bruta` por `pagos × ticket` e NÃO recalcula o
// `porLote`. A coluna nova somava R$ 36.000 enquanto o DRE, no MESMO
// relatório, mostrava R$ 50.000 — R$ 14.000, contra os R$ 6.600 que esta
// coluna veio fechar.
//
// A regra que estes dois testes travam: OU a coluna soma exatamente o que o
// DRE mostra, OU ela não mostra número nenhum e diz por quê. Nunca um número
// que a própria tela contradiz duas seções acima.
// ─────────────────────────────────────────────────────────────────────────────
describe('ReportView — a coluna Receita cala quando não pode provar o que promete (26/07/2026)', () => {
  it('com ticket médio manual no Realista: nenhum lote imprime valor, e o microtexto diz o motivo', () => {
    const evento = montarEvento()
    // 500 pagantes no Realista (90% de 200+300+300 = 720 → pagos do cenário);
    // o ticket manual substitui a mistura de lotes, então a receita do DRE
    // deixa de ser a soma dos lotes.
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      realista: { ...evento.cenariosConfig.realista, ticketMedio: 100 },
    }
    const { container } = renderCompleto(evento)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    expect(linhas.length).toBeGreaterThan(0)
    // A COLUNA NEM EXISTE (Marco, 27/07/2026). Até 26/07 ela ficava presente com
    // travessão em toda linha, e a propriedade guardada era "nenhuma célula
    // imprime número que não fecha com o DRE". A propriedade não mudou — ficou
    // MAIS FORTE, porque agora é garantida por construção: sem coluna não há
    // célula. Mudou o motivo: dez travessões num relatório impresso não
    // comunicam "não se aplica", comunicam "quebrou" — foi como o Marco leu.
    expect(idxReceita).toBe(-1)

    // E a tela não fica muda sobre o porquê (princípio 4 do CLAUDE.md).
    expect(container.textContent).toContain('este cenário não divide a receita por lote')
    // A promessa antiga NÃO pode aparecer neste modo — ela seria falsa aqui.
    expect(container.textContent).not.toContain('a soma desta coluna bate com aquela linha')
  })

  it('com ajuste de % no ticket do Realista: mesma regra, mesmo travessão', () => {
    const evento = montarEvento()
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      realista: { ...evento.cenariosConfig.realista, ticketPct: 15 },
    }
    const { container } = renderCompleto(evento)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    // A COLUNA NEM EXISTE (Marco, 27/07/2026). A propriedade guardada não
    // mudou — ficou MAIS FORTE: sem coluna não há célula que possa imprimir
    // número que não fecha com o DRE. Dez travessões num relatório impresso
    // não comunicam "não se aplica", comunicam "quebrou".
    expect(idxReceita).toBe(-1)
    expect(container.textContent).toContain('este cenário não divide a receita por lote')
  })

  // Pedido literal do Marco em 27/07/2026, ao ver a tabela: "pode sumir com a
  // coluna mas o valor da receita deveria considerar os descontos". Sem esta
  // coluna, sumir a de receita deixaria como ÚNICA coluna de dinheiro por lote
  // o "Preço cheio × capacidade", que ignora o cupom de propósito.
  it('sumindo a de receita, entra a capacidade COM DESCONTO — e ela bate com efetivo × qtd', () => {
    const evento = montarEvento()
    evento.descontoMedioPct = 10
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      realista: { ...evento.cenariosConfig.realista, ticketPct: 15 },
    }
    const { container } = renderCompleto(evento)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    expect(idxReceita).toBe(-1)

    const h2 = Array.from(container.querySelectorAll('h2')).find((h) => h.textContent === 'Bilheteria')
    const headers = Array.from(h2.parentElement.querySelectorAll('thead th')).map((th) => th.textContent)
    const idxDesc = headers.indexOf('Com desconto × capacidade')
    const idxEfetivo = headers.indexOf('Efetivo')
    const idxQtd = headers.indexOf('Qtd')
    const idxCheio = headers.indexOf('Preço cheio × capacidade')
    expect(idxDesc).toBeGreaterThan(-1)

    // Em cada lote pagante a coluna nova é o preço EFETIVO vezes a quantidade,
    // e fica ABAIXO do preço cheio × capacidade — senão o desconto não entrou.
    let conferidos = 0
    for (const tr of linhas) {
      const td = tr.querySelectorAll('td')
      const efetivo = td[idxEfetivo].textContent
      // cortesia não tem preço efetivo; lote "só otimista" não entra numa
      // coluna que fala de capacidade do cenário Realista — os dois em traço.
      if (efetivo === '—' || td[idxDesc].textContent === '—') continue
      const qtd = parseBRL(td[idxQtd].textContent)
      const comDesc = parseBRL(td[idxDesc].textContent)
      const cheio = parseBRL(td[idxCheio].textContent)
      expect(comDesc).toBeCloseTo(parseBRL(efetivo) * qtd, 2)
      expect(comDesc).toBeLessThan(cheio)
      conferidos++
    }
    expect(conferidos).toBeGreaterThan(0)
  })

  it('sem ticket manual: a promessa volta, e a soma continua batendo com o DRE', () => {
    const evento = montarEvento()
    const { container } = renderCompleto(evento)
    expect(container.textContent).toContain('a soma desta coluna bate com aquela linha')
    expect(container.textContent).not.toContain('este cenário não divide a receita por lote')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// As três decisões do Marco de 26/07/2026 sobre esta tabela (questionário):
//   1. a coluna Receita passa a mostrar OS CENTAVOS;
//   2. "Potencial (100%)" vira "Preço cheio × capacidade" — o rótulo antigo
//      convidava a comparar com o cenário Otimista, e os dois somam coisas
//      diferentes (lote "só otimista" entra num e não no outro);
//   3. lote comum zerado à mão no cenário ganha marca no nome, para o "R$ 0"
//      dele parar de ser indistinguível do "R$ 0" de uma cortesia.
// ─────────────────────────────────────────────────────────────────────────────
describe('ReportView — centavos e rótulos da tabela Bilheteria (Marco, 26/07/2026)', () => {
  it('a coluna Receita mostra os centavos, não o real arredondado', () => {
    const evento = novoEvento('Centavos')
    // 3 lotes de R$ 10,50 de receita cada no Realista: 10 ingressos a R$ 1,50
    // com vendaPct 70? Não — simples: 1 ingresso a R$ 10,50, vendaPct 100 no
    // Realista para o número sair redondo na conta e quebrado no centavo.
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      realista: { ...evento.cenariosConfig.realista, vendaPct: 100 },
    }
    evento.lotes = [
      novoLote({ nome: 'A', valor: 10.5, quantidade: 1 }),
      novoLote({ nome: 'B', valor: 10.5, quantidade: 1 }),
      novoLote({ nome: 'C', valor: 10.5, quantidade: 1 }),
    ]
    const { container } = renderCompleto(evento)
    const { linhas, idxReceita } = tabelaBilheteria(container)
    const textos = linhas.map((tr) => tr.querySelectorAll('td')[idxReceita].textContent)
    // Antes desta decisão cada linha imprimia "R$ 11" (soma à mão R$ 33,
    // contra R$ 32 no DRE). Agora imprime o centavo.
    expect(textos.every((t) => t.includes('10,50'))).toBe(true)
    const soma = textos.reduce((s, t) => s + parseBRL(t), 0)
    expect(soma).toBeCloseTo(31.5, 2)
  })

  it('o cabeçalho diz de que soma se trata, e não fala mais em "100%"', () => {
    const { container } = renderCompleto(montarEvento())
    const h2 = Array.from(container.querySelectorAll('h2')).find((h) => h.textContent === 'Bilheteria')
    const headers = Array.from(h2.parentElement.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(headers).toContain('Preço cheio × capacidade')
    expect(headers).not.toContain('Potencial (100%)')
    // E o microtexto avisa que não é o Otimista — a confusão medida.
    expect(container.textContent).toContain('Não é o cenário Otimista')
  })

  it('lote comum zerado à mão no Realista ganha marca; cortesia continua só "(cortesia)"', () => {
    const evento = montarEvento()
    const loteComum = evento.lotes[0]
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      overrides: { ...evento.cenariosConfig.overrides, realista: { [loteComum.id]: 0 } },
    }
    const { container } = renderCompleto(evento)
    const { linhas } = tabelaBilheteria(container)
    const nomes = linhas.map((tr) => tr.querySelectorAll('td')[0].textContent)
    expect(nomes.some((n) => n.includes('zerado no Realista'))).toBe(true)
    // A cortesia NÃO ganha a marca — são coisas diferentes, e era essa a
    // confusão.
    const linhaCortesia = nomes.find((n) => n.includes('(cortesia)'))
    expect(linhaCortesia).toBeTruthy()
    expect(linhaCortesia).not.toContain('zerado no Realista')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OS TRÊS BURACOS QUE A VERIFICAÇÃO ADVERSARIAL DE 26/07/2026 NOMEOU nos testes
// acima — cada um virou teste aqui.
//
// 1. Nenhum teste tocava `cenariosConfig.overrides`, e o S1 nem precisava de
//    mutação para aparecer: um lote "só otimista" com override no Realista
//    VENDE (loteQtdCenario lê o override antes de olhar a marca), o DRE somava
//    R$ 69.400, a coluna imprimia R$ 59.400, e o microtexto continuava
//    afirmando que a soma batia.
// 2. A tolerância da guarda não era afirmada por asserção nenhuma: trocá-la por
//    ZERO ou por R$ 1.000 deixava os testes verdes. R$ 1.000 de divergência
//    seria impresso como se batesse.
// 3. FALSO POSITIVO medido: com a grade padrão do app (preços de centavo) e
//    cupom comum, a coluna inteira desaparecia e o microtexto acusava ticket
//    manual que não existia — porque a soma CRUA dos lotes era comparada com a
//    `bruta` já quantizada a centavo.
// ─────────────────────────────────────────────────────────────────────────────
describe('ReportView — a guarda da tabela olha o que a TELA imprime (26/07/2026)', () => {
  it('lote "só otimista" com override no Realista aparece com a receita dele, e a soma segue fechando', () => {
    const evento = montarEvento()
    const lotePorta = evento.lotes.find((l) => l.somenteOtimista)
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      overrides: { ...evento.cenariosConfig.overrides, realista: { [lotePorta.id]: 200 } },
    }
    const { container } = renderCompleto(evento)

    const dreValor = parseBRL(celulaDreRealista(container, 'Receita bruta bilheteria'))
    // 180×60 + 270×80 + 270×100 = 59.400, mais o Lote Porta vendendo 200 × 50.
    expect(dreValor).toBeCloseTo(69400, 2)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    const soma = linhas.reduce((s, tr) => {
      const txt = tr.querySelectorAll('td')[idxReceita].textContent
      return s + (txt === '—' ? 0 : parseBRL(txt))
    }, 0)
    // Era aqui que faltavam R$ 10.000 com a promessa por escrito em cima.
    expect(soma).toBeCloseTo(dreValor, 2)
    expect(container.textContent).toContain('a soma desta coluna bate com aquela linha')
  })

  it('grade padrão com preços de centavo e cupom NÃO faz a coluna desaparecer (o falso positivo medido)', () => {
    const evento = novoEvento('Falso positivo')
    evento.lotes = [
      novoLote({ nome: 'L1', valor: 39.9, quantidade: 100 }),
      novoLote({ nome: 'L2', valor: 49.9, quantidade: 150 }),
      novoLote({ nome: 'L3', valor: 59.9, quantidade: 150 }),
      novoLote({ nome: 'L4', valor: 69.9, quantidade: 200 }),
      novoLote({ nome: 'L5', valor: 79.9, quantidade: 200 }),
      novoLote({ nome: 'L6', valor: 99.9, quantidade: 100 }),
      novoLote({ nome: 'Porta', somenteOtimista: true, valor: 50, quantidade: 60 }),
      novoLote({ nome: 'Cortesia', valor: 0, quantidade: 40 }),
    ]
    evento.descontoMedioPct = 15
    const { container } = renderCompleto(evento)

    // Nenhum ticket manual e nenhum ajuste de % — a coluna TEM de falar.
    expect(container.textContent).not.toContain('este cenário não divide a receita por lote')
    const { linhas, idxReceita } = tabelaBilheteria(container)
    const textos = linhas.map((tr) => tr.querySelectorAll('td')[idxReceita].textContent)
    // Os seis lotes pagos imprimem número (o "Porta" não vende no Realista).
    expect(textos.filter((t) => t !== '—').length).toBeGreaterThanOrEqual(6)
    const soma = textos.reduce((s, t) => s + (t === '—' ? 0 : parseBRL(t)), 0)
    const dreValor = parseBRL(celulaDreRealista(container, 'Receita bruta bilheteria'))
    // Menos de R$ 0,50, e não ao centavo, DE PROPÓSITO: a coluna imprime o
    // centavo (decisão do Marco) e a linha do DRE sai arredondada ao real, então
    // a diferença legítima entre as duas é de até R$ 0,49. É exatamente o que o
    // microtexto da tabela declara. O que este teste cobra é que a coluna FALE e
    // que a soma dela seja a mesma conta do DRE — não que dois arredondamentos
    // diferentes coincidam.
    expect(Math.abs(soma - dreValor)).toBeLessThan(0.5)
  })

  it('divergência PEQUENA (R$ 5,94) já cala a coluna — a tolerância não é frouxa', () => {
    // O buraco que a verificação adversarial nomeou: os testes de ticket manual
    // criam uma divergência de R$ 12.600, então a guarda tripava mesmo com a
    // tolerância trocada por R$ 1.000 — mil reais de erro passariam como se
    // batessem, e nenhum teste acusaria. Este usa um ajuste de 0,01% no ticket
    // do Realista, que move a bruta em R$ 5,94 sobre os R$ 59.400: pequeno
    // demais para os outros testes pegarem, grande demais para ser resíduo.
    const evento = montarEvento()
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      realista: { ...evento.cenariosConfig.realista, ticketPct: 0.01 },
    }
    const { container } = renderCompleto(evento)
    const dreValor = parseBRL(celulaDreRealista(container, 'Receita bruta bilheteria'))
    expect(dreValor).toBeGreaterThan(59400)
    expect(dreValor).toBeLessThan(59410)

    const { linhas, idxReceita } = tabelaBilheteria(container)
    // Coluna AUSENTE (Marco, 27/07/2026): a tolerância de meio centavo é a
    // mesma de sempre; o que mudou é que, quando ela não fecha, a coluna
    // some em vez de imprimir travessão em toda linha.
    expect(linhas.length).toBeGreaterThan(0)
    expect(idxReceita).toBe(-1)
    expect(container.textContent).toContain('este cenário não divide a receita por lote')
  })

  it('lote zerado à mão continua imprimindo R$ 0,00 com a marca — travessão é para quem NÃO vende', () => {
    const evento = montarEvento()
    const loteComum = evento.lotes[0]
    evento.cenariosConfig = {
      ...evento.cenariosConfig,
      overrides: { ...evento.cenariosConfig.overrides, realista: { [loteComum.id]: 0 } },
    }
    const { container } = renderCompleto(evento)
    const { linhas, idxReceita } = tabelaBilheteria(container)
    const linhaZerada = linhas.find((tr) =>
      tr.querySelectorAll('td')[0].textContent.includes('zerado no Realista')
    )
    expect(linhaZerada).toBeTruthy()
    // Zero DE PROPÓSITO imprime zero; quem não vende no cenário é que fica em
    // travessão. Assim a marca do nome tem um número ao lado para explicar.
    const celula = linhaZerada.querySelectorAll('td')[idxReceita].textContent
    expect(celula).not.toBe('—')
    expect(parseBRL(celula)).toBe(0)
  })
})
