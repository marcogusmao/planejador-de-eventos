// @vitest-environment jsdom
//
// FIO COMPLETO, ATÉ O PIXEL: o número que a tela IMPRIME na coluna "Estimado"
// do card de evento realizado.
//
// POR QUE ESTE ARQUIVO EXISTE. A suíte inteira deste repositório ficou VERDE com
// o defeito de pé — nenhum teste olhava para essa coluna. Um teste de módulo
// prova que `resultadoRealizado()` devolve o orçamento; ele NÃO prova que a tela
// usa o campo novo. É a diferença entre a peça existir e a peça estar LIGADA, e
// nesta semana a casa mediu quatro entregas verdes com a parte nova desligada.
//
// Por isso aqui se renderiza a HOME de verdade — o caminho inteiro
// Home → resultadoRealizado → ResumoRealizado → texto na tela — e se lê a
// célula. Trocar o `real={real}` da Home de volta por `est={c.realista}` derruba
// este arquivo; um teste de módulo sozinho, não.
//
// O evento é a maquete do caso real do Marco (Marfim Alto Casa Norte,
// 05/07/2025): orçamento digitado R$ 306.540, realizado R$ 376.360. A régua e a
// origem dos números estão em `src/lib/estimadoEhOOrcamento.evidencia.test.js`.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'

afterEach(cleanup)

// localStorage de memória — mesmo truque de Home.evidencia.test.jsx: a lixeira
// (protecao.js) toca o localStorage de verdade ao montar a Home.
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

const marfimCasaNorte = () => {
  const e = novoEvento('Marfim Alto Casa Norte')
  e.data = '2025-07-05'
  e.publicoEstimado = 5000
  e.contingenciaPct = 0
  e.barModo = 'fixo'
  e.outrasReceitas = { bar: 76540, patrocinio: '' }
  e.lotes = [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 5000, somenteOtimista: false }]
  e.cenariosConfig.realista.vendaPct = 100
  e.receitaRealizada = { bilheteria: 500000, bar: 76540 }
  e.categorias[0].itens = [
    novoItem({ servico: 'Estrutura', estimado: 100000, realizado: 119820 }),
    novoItem({ servico: 'Artístico', estimado: 80000, realizado: 100000 }),
    novoItem({ servico: 'Equipe', estimado: 60000, realizado: 80000 }),
    novoItem({ servico: 'A&B', estimado: 50000, realizado: 60000 }),
    novoItem({ servico: 'Marketing', estimado: 16540, realizado: '' }),
  ]
  e.status = 'fechado'
  e.fechamento = { em: '2025-07-06T21:00:00.000Z', foto: { resultado: { resultado: 175180 } } }
  return e
}

const montar = () => {
  render(
    <Home
      store={{ eventos: [marfimCasaNorte()], benchmarksCustom: [] }}
      setStore={vi.fn()}
      aparencia={{}}
      abrir={vi.fn()}
      abrirAjustes={vi.fn()}
    />
  )
}

// O card, ancorado no herói "Resultado realizado" (único na tela com um evento
// fechado). Dele saem os três blocos do corpo, na ordem em que o componente os
// monta: [0] herói, [1] tabela, [2] a nota que explica a régua. A busca é por
// ESTRUTURA e não por nome de classe — classe de estilo muda, a ordem não.
const corpoDoCard = () => screen.getByText('Resultado realizado').parentElement.parentElement.parentElement

// Lê uma linha da tabela Estimado × Realizado × Desvio pela etiqueta dela. A
// linha é um grid de 4 células, na ordem em que o cabeçalho as nomeia. Escopada
// à tabela de propósito: "Custo" e "Receita" também aparecem noutros cantos da
// Home, e um teste que lesse a célula errada não estaria provando nada.
const linhasDaTabela = () => [...corpoDoCard().children[1].children]
const linhaDoCard = (rotulo) => {
  const linha = linhasDaTabela().find((l) => l.children[0]?.textContent.trim() === rotulo)
  if (!linha) throw new Error(`linha "${rotulo}" não existe na tabela do card`)
  const celulas = [...linha.children].map((n) => n.textContent.trim())
  return { rotulo: celulas[0], estimado: celulas[1], realizado: celulas[2], desvio: celulas[3] }
}

describe('A coluna "Estimado" impressa na Home de um evento fechado', () => {
  it('a linha CUSTO mostra o orçamento (R$ 307 mil), não o realizado (R$ 376 mil)', () => {
    montar()
    const custo = linhaDoCard('Custo')
    expect(custo.estimado).toBe('R$ 307 mil') // 306.540 arredondado pela tela
    expect(custo.realizado).toBe('R$ 376 mil')
    // A trava contra a volta do defeito: as duas células NÃO podem ser iguais
    // neste evento — era exatamente isso que a tela imprimia antes.
    expect(custo.estimado).not.toBe(custo.realizado)
  })

  it('o desvio de custo aparece: +70 (mil) — antes era +0', () => {
    montar()
    expect(linhaDoCard('Custo').desvio).toBe('+70')
    expect(linhaDoCard('Custo').desvio).not.toBe('+0')
  })

  it('a linha LUCRO mostra R$ 245 mil de estimado, e não os R$ 175 mil de antes', () => {
    montar()
    const lucro = linhaDoCard('Lucro')
    expect(lucro.estimado).toBe('R$ 245 mil')
    expect(lucro.realizado).toBe('R$ 175 mil')
    expect(lucro.desvio).toBe('−70') // menos matemático (U+2212), como a tela usa
  })

  it('a RECEITA não mudou de régua: estimado e realizado seguem iguais aqui', () => {
    montar()
    const receita = linhaDoCard('Receita')
    expect(receita.estimado).toBe('R$ 552 mil')
    expect(receita.realizado).toBe('R$ 552 mil')
    expect(receita.desvio).toBe('+0')
  })

  it('a MARGEM estimada acompanha o lucro novo: 44,4% contra 31,8% realizada', () => {
    montar()
    const margem = linhaDoCard('Margem')
    expect(margem.estimado).toBe('44,4%')
    expect(margem.realizado).toBe('31,8%')
    expect(margem.desvio).toBe('−12pt')
  })

  it('o herói diz "vs. estimado R$ 245 mil" e declara o quanto ficou abaixo', () => {
    montar()
    const heroi = corpoDoCard().children[0].textContent
    expect(heroi).toContain('vs. estimado R$ 245 mil')
    // O texto antigo — o realizado se comparando consigo mesmo — não existe mais.
    expect(heroi).not.toContain('vs. estimado R$ 175 mil')
    expect(heroi).toContain('−R$ 70 mil abaixo')
    // E o desvio de +R$ 0, que o card imprimia antes, sumiu junto.
    expect(heroi).not.toContain('R$ 0')
  })

  it('a tela DIZ a régua, em português, embaixo da tabela', () => {
    montar()
    const nota = corpoDoCard().children[2].textContent
    expect(nota).toContain('o orçamento digitado')
    expect(nota).toContain('o realizado lançado não entra')
    expect(nota).toContain('mesma régua da aba Fechamento')
  })

  it('o cabeçalho da tabela continua Estimado · Realizado · Desvio, nessa ordem', () => {
    montar()
    const cabecalho = [...linhasDaTabela()[0].children].map((n) => n.textContent.trim())
    expect(cabecalho).toEqual(['', 'Estimado', 'Realizado', 'Desvio'])
    expect(linhaDoCard('Custo').rotulo).toBe('Custo')
  })
})

// A SEGUNDA TELA. O mesmo corpo de card é montado pela aba Cenários do editor,
// por um caminho de props DIFERENTE (CardRealizado). Provar só a Home deixaria
// metade do fio no escuro — e foi exatamente assim que o aviso de bar viajou
// desligado nesta casa em 27/07/2026 (ver `avisoBarNoCenario.fio.test.jsx`:
// suíte verde, prop não passada, nada na tela).
describe('A MESMA coluna na aba Cenários do editor', () => {
  it('o card da aba Cenários imprime o orçamento, igual à Home', async () => {
    const { default: ScenariosTab } = await import('./ScenariosTab.jsx')
    const e = marfimCasaNorte()
    render(
      <ScenariosTab
        evento={e}
        update={vi.fn()}
        updateCenarios={vi.fn()}
        store={{ eventos: [e], benchmarksCustom: [], ajustes: {} }}
        setStore={vi.fn()}
      />
    )
    expect(linhaDoCard('Custo').estimado).toBe('R$ 307 mil')
    expect(linhaDoCard('Custo').realizado).toBe('R$ 376 mil')
    expect(linhaDoCard('Custo').desvio).toBe('+70')
    expect(linhaDoCard('Lucro').estimado).toBe('R$ 245 mil')
    expect(corpoDoCard().children[0].textContent).toContain('vs. estimado R$ 245 mil')
  })
})

describe('Evento ABERTO: a Home não mostra o card — a previsão viva segue intacta', () => {
  it('sem status fechado, aparecem os três cenários e nenhuma coluna Estimado × Realizado', () => {
    const e = marfimCasaNorte()
    e.status = 'aberto'
    e.fechamento = null
    render(
      <Home
        store={{ eventos: [e], benchmarksCustom: [] }}
        setStore={vi.fn()}
        aparencia={{}}
        abrir={vi.fn()}
        abrirAjustes={vi.fn()}
      />
    )
    expect(screen.queryByText('Resultado realizado')).toBeNull()
    expect(screen.queryByText('Realista')).not.toBeNull()
  })
})

// A CÉLULA VAZIA, sem cair no zero. Uma foto de fechamento gravada ANTES de
// 27/07/2026 não tem o bloco `estimado`; se um dia uma dessas chegar ao card, a
// coluna tem de sair "—". Um "R$ 0" ali seria uma afirmação falsa com cara de
// número — o pior defeito da casa (princípio 4: nada falha em silêncio).
describe('Card sem o bloco estimado (foto antiga): a coluna sai "—", nunca R$ 0', () => {
  it('as quatro linhas mostram traço no estimado e no desvio', async () => {
    const { ResumoRealizado } = await import('./ResumoRealizado.jsx')
    render(<ResumoRealizado real={{ receita: 551540, custos: 376360, resultado: 175180 }} />)
    for (const rotulo of ['Receita', 'Custo', 'Lucro']) {
      const linha = linhaDoCard(rotulo)
      expect(linha.estimado).toBe('—')
      expect(linha.desvio).toBe('—')
    }
    expect(linhaDoCard('Margem').estimado).toBe('—')
    expect(corpoDoCard().children[0].textContent).toContain('vs. estimado —')
    // E nenhum "R$ 0" inventado no lugar do que não se sabe — nem na coluna, nem
    // no herói, que também deixa de afirmar um desvio que não existe.
    expect(linhaDoCard('Custo').estimado).not.toBe('R$ 0')
    expect(corpoDoCard().children[0].textContent).not.toContain('acima')
    expect(corpoDoCard().children[0].textContent).not.toContain('abaixo')
  })
})
