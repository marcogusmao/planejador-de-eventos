// @vitest-environment jsdom
//
// AS QUATRO TELAS DE CUSTO PASSAM A DIZER QUE A FESTA ESTÁ COM DADO QUEBRADO.
//
// ---------------------------------------------------------------------------
// O DEFEITO, MEDIDO RODANDO AS QUATRO TELAS (26/07/2026)
// ---------------------------------------------------------------------------
// Festa montada: Bebidas R$ 3.000 (A&B) + "Som e luz" com 1 seguido de 308
// zeros (Estrutura), contingência 10%, bilheteria realizada R$ 20.000. O que
// cada tela ESCREVIA, antes desta frente:
//
//   aba Custos ...... "Total estimado R$ 0" e "Custo total previsto R$ 0"
//                     (a linha do item mostra o número monstruoso; os TOTAIS
//                      dizem zero — quem decide olha o total)
//   aba Cenários .... "Custos (itens) R$ 0", "Custo total R$ 0", "Lucro R$ 0",
//                     "margem 0%" nos três cenários
//   aba Fechamento .. "Custos R$ 0" e "Resultado R$ 0"
//   relatório ....... "Custo total R$ 0" e o DRE com "Custos (itens) R$ 0"
//
// E nenhum aviso em nenhuma das quatro. O Marco não tinha como saber, olhando
// o app, que aquela festa estava com dado quebrado.
//
// ---------------------------------------------------------------------------
// O QUE ESTE ARQUIVO TRAVA
// ---------------------------------------------------------------------------
// (a) as quatro telas mostram a faixa, NOMEANDO o custo e a categoria;
// (b) a faixa diz o que fazer (a aba onde se conserta e a cópia de segurança);
// (c) FALSO POSITIVO — e este é o risco central: festa NORMAL não ganha aviso
//     em nenhuma das quatro. Uma festa de R$ 500.000 é uma festa que existe;
//     um aviso nela ensina o dono a ignorar aviso, e aí ele ignora o de
//     verdade. Zero, vazio, negativo e festa sem custo nenhum entram na mesma
//     bateria.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import CostsTab from './CostsTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import ReportView from './ReportView.jsx'
import AvisoCustoQuebrado, {
  TITULO_CUSTO_QUEBRADO,
  FRASE_SOMA,
  CONSEQ_ZERA,
  CONSERTO_CORRIGIR,
} from './AvisoCustoQuebrado.jsx'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'

afterEach(cleanup)

const ABSURDO = 1e308 // 1 seguido de 308 zeros

// localStorage de memória — CurvaVendas (dentro de ScenariosTab) lê o cache do
// Financeiro no localStorage; sem isto o render escreve erro no console.
const mapa = new Map()
globalThis.localStorage = {
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
  clear: () => mapa.clear(),
}

const noop = () => {}

function festa(categorias) {
  const e = novoEvento('Festa de prova')
  e.publicoEstimado = 200
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.contingenciaPct = 10
  e.categorias = categorias
  e.receitaRealizada = { bilheteria: 20000, bar: '' }
  return e
}

const cat = (id, nome, itens) => ({ id, nome, padrao: false, itens })

const FESTA_QUEBRADA = () =>
  festa([
    cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 3000 })]),
    cat('estrutura', 'Estrutura', [novoItem({ servico: 'Som e luz', estimado: ABSURDO })]),
  ])

// Uma festa de meio milhão — grande DE VERDADE, e legítima. É a prova de falso
// positivo mais importante do arquivo.
const FESTA_DE_MEIO_MILHAO = () =>
  festa([
    cat('aeb', 'A&B', [novoItem({ servico: 'Open bar', estimado: 180000 })]),
    cat('estrutura', 'Estrutura', [novoItem({ servico: 'Palco e som', estimado: 220000 })]),
    cat('equipe', 'Equipe', [novoItem({ servico: 'Produção', estimado: 100000 })]),
  ])

const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

// As quatro telas, cada uma montada como o app a monta (mesmas props de
// EventEditor.jsx e App.jsx).
const TELAS = {
  'aba Custos': (e) => <CostsTab evento={e} update={noop} store={store(e)} setStore={noop} />,
  'aba Cenários': (e) => (
    <ScenariosTab
      evento={e}
      update={noop}
      store={store(e)}
      setStore={noop}
      updateCenarios={noop}
      simulando={false}
      onSimular={noop}
    />
  ),
  'aba Fechamento': (e) => (
    <FechamentoTab
      evento={e}
      update={noop}
      store={store(e)}
      onPromoverBenchmark={noop}
      onFecharEvento={noop}
      onReabrirEvento={noop}
    />
  ),
  relatório: (e) => <ReportView evento={e} store={store(e)} onBack={noop} />,
}

// O texto que o Marco lê, sem depender de classe nem de posição. Normaliza o
// espaço inquebrável (o pt-BR usa um depois de "R$") para o teste não reprovar
// por um motivo que nada tem a ver com o aviso.
const textoDa = (container) => container.textContent.replace(/\s+/g, ' ')

const alertas = (container) => Array.from(container.querySelectorAll('[role="alert"]'))

// O valor de um Stat: rótulo e número são IRMÃOS no DOM (ui.jsx), então ler o
// textContent inteiro colaria "Custo total previstoR$ 0" numa palavra só. Pegar
// o irmão do rótulo é o que separa o número que o Marco lê do resto da tela.
const valorDoStat = (container, rotulo) => {
  const alvo = Array.from(container.querySelectorAll('div')).find(
    (d) => d.textContent.trim() === rotulo && d.className.includes('text-xs')
  )
  return alvo?.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// 1. AS QUATRO TELAS AVISAM, E NOMEIAM O CUSTO
// ---------------------------------------------------------------------------
describe('a festa com custo que não cabe é NOMEADA nas quatro telas', () => {
  for (const [nome, montar] of Object.entries(TELAS)) {
    it(`${nome}: mostra a faixa, com o custo e a categoria por extenso`, () => {
      const { container } = render(montar(FESTA_QUEBRADA()))
      const texto = textoDa(container)
      expect(`${nome} · título`).toBe(
        texto.includes(TITULO_CUSTO_QUEBRADO) ? `${nome} · título` : `${nome} · SEM AVISO`
      )
      expect(texto).toContain('O custo “Som e luz” (categoria Estrutura) está com um valor')
      // e a faixa é anunciada como alerta, não como parágrafo qualquer
      expect(alertas(container).length).toBeGreaterThan(0)
    })
  }

  it('a faixa diz por que o número não vale e o que fazer', () => {
    const { container } = render(TELAS['aba Custos'](FESTA_QUEBRADA()))
    const texto = textoDa(container)
    expect(texto).toContain(CONSEQ_ZERA.replace(/\s+/g, ' '))
    expect(texto).toContain(CONSERTO_CORRIGIR.replace(/\s+/g, ' '))
  })

  it('e o número que ela acompanha continua sendo o R$ 0 que a tela imprime', () => {
    // A faixa NÃO conserta o número — ela diz que ele não vale. Se um dia o
    // número passar a ser outra coisa, este teste avisa que o texto da faixa
    // ("no lugar do valor a festa o app escreve R$ 0") virou mentira.
    const { container } = render(TELAS['aba Custos'](FESTA_QUEBRADA()))
    expect(valorDoStat(container, 'Custo total previsto')).toBe('R$ 0')
  })
})

// ---------------------------------------------------------------------------
// 2. A SOMA QUE NÃO CABE, SEM ITEM CULPADO
// ---------------------------------------------------------------------------
describe('a soma que estoura sem item culpado também é dita', () => {
  it('dois custos de 10^306: cada um cabe, a soma não — e a faixa explica isso', () => {
    const evento = festa([
      cat('aeb', 'A&B', [
        novoItem({ servico: 'Item A', estimado: 1e306 }),
        novoItem({ servico: 'Item B', estimado: 1e306 }),
      ]),
    ])
    const { container } = render(TELAS['aba Custos'](evento))
    const texto = textoDa(container)
    expect(texto).toContain(TITULO_CUSTO_QUEBRADO)
    expect(texto).toContain(FRASE_SOMA)
  })
})

// ---------------------------------------------------------------------------
// 3. FALSO POSITIVO — festa legítima não ganha aviso em tela nenhuma
// ---------------------------------------------------------------------------
describe('festa normal NÃO ganha aviso — em nenhuma das quatro telas', () => {
  const CASOS = {
    'festa de R$ 500.000': FESTA_DE_MEIO_MILHAO,
    'custo zero (permuta)': () => festa([cat('aeb', 'A&B', [novoItem({ servico: 'Permuta', estimado: 0 })])]),
    'custo vazio (ainda sem orçamento)': () =>
      festa([cat('aeb', 'A&B', [novoItem({ servico: 'A definir' })])]),
    'custo negativo (crédito já salvo)': () =>
      festa([cat('aeb', 'A&B', [novoItem({ servico: 'Crédito do fornecedor', estimado: -500 })])]),
    'festa sem custo nenhum': () => festa([cat('aeb', 'A&B', [])]),
    'festa sem categoria nenhuma': () => festa([]),
    'os quatro itens de centavo': () =>
      festa([
        cat(
          'aeb',
          'A&B',
          [1215.82, 6571.21, 6605.32, 920.15].map((v, i) =>
            novoItem({ servico: `Item ${i + 1}`, estimado: v })
          )
        ),
      ]),
  }

  for (const [caso, montarEvento] of Object.entries(CASOS)) {
    for (const [tela, montar] of Object.entries(TELAS)) {
      it(`${caso} · ${tela}: nenhuma faixa de dado quebrado`, () => {
        const { container } = render(montar(montarEvento()))
        const achou = textoDa(container).includes(TITULO_CUSTO_QUEBRADO)
        expect(`${caso} · ${tela}: ${achou ? 'AVISOU ERRADO' : 'limpo'}`).toBe(
          `${caso} · ${tela}: limpo`
        )
      })
    }
  }

  it('e a festa de meio milhão continua mostrando o seu custo de verdade', () => {
    // Contraprova: o teste acima passaria verde numa tela que não renderizou
    // nada. Esta linha confirma que a tela chegou onde deveria chegar.
    const { container } = render(TELAS['aba Custos'](FESTA_DE_MEIO_MILHAO()))
    // R$ 500.000 de itens + 10% de contingência
    expect(valorDoStat(container, 'Custo total previsto')).toBe('R$ 550.000')
  })
})

// ---------------------------------------------------------------------------
// 4. A FAIXA SOZINHA — o componente, fora das telas
// ---------------------------------------------------------------------------
describe('a faixa em si', () => {
  it('não renderiza nada quando a festa está sã', () => {
    const { container } = render(<AvisoCustoQuebrado evento={FESTA_DE_MEIO_MILHAO()} />)
    expect(container.innerHTML).toBe('')
  })

  it('no papel do relatório o texto é o MESMO da tela', () => {
    const { container: tela } = render(<AvisoCustoQuebrado evento={FESTA_QUEBRADA()} />)
    const textoTela = textoDa(tela)
    cleanup()
    const { container: papel } = render(<AvisoCustoQuebrado evento={FESTA_QUEBRADA()} papel />)
    expect(textoDa(papel)).toBe(textoTela)
  })

  it('custo sem nome ainda é nomeado, com o rótulo do app', () => {
    const evento = festa([cat('aeb', 'A&B', [novoItem({ servico: '', estimado: ABSURDO })])])
    const { container } = render(<AvisoCustoQuebrado evento={evento} />)
    expect(textoDa(container)).toContain('O custo “(custo sem nome)” (categoria A&B)')
  })
})
