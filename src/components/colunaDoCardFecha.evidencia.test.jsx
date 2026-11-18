// @vitest-environment jsdom
//
// A COLUNA DO CARD DE FECHAMENTO SOMA NA FRENTE DE QUEM LÊ.
//
// A ficha (BACKLOG, S3, 20/07/2026) mediu que ela NÃO somava em 35,7% dos
// eventos — fuzz de 25.767, pior caso R$ 2 — porque cada linha era impressa em
// reais INTEIROS e o arredondamento de cada uma sobrava no total. O exemplo
// canônico, que este arquivo reproduz linha a linha:
//
//     Bilheteria realizada (bruta)   R$ 47.850
//     Taxa da bilheteria (12,5%)   − R$  5.981   (o cru é 5.981,25)
//     Cashback (5%)                + R$  2.393   (o cru é 2.392,50)
//     Bar (lucro líquido)          + R$  3.000
//     = Receita do evento            R$ 47.261   ← as quatro somam 47.262
//
// DECISÃO DO MARCO, 12/08/2026, por questionário: o card passa a mostrar
// CENTAVOS. A alternativa (manter inteiros e distribuir o resto para a coluna
// fechar) foi recusada, porque faria uma linha exibir um valor até R$ 1
// distante do cru — trocaria um erro de soma por um erro de linha.
//
// A RÉGUA DESTE ARQUIVO: nada aqui pergunta ao módulo se o campo está certo. O
// card é RENDERIZADO, os valores saem do DOM como texto, e a soma é refeita a
// partir do que está ESCRITO na tela — que é a única coisa que a coluna
// promete (PADRÃO DA CASA §3). Um teste que somasse os campos do objeto
// passaria verde com a tela mentindo, que é exatamente o defeito que a ficha
// registrou.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import FechamentoTab from './FechamentoTab.jsx'
import { migrarEvento } from '../lib/migracao.js'

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

// O `Intl` de moeda em pt-BR separa "R$" do número com espaço INQUEBRÁVEL
// (U+00A0), invisível no editor. Sem esta normalização um matcher correto
// falha por causa de um caractere que ninguém vê.
const norm = (s) => String(s).replace(new RegExp('\\u00a0', 'g'), ' ')

// Lê "− R$ 5.981,25" e devolve -5981.25. É o inverso EXATO do que a tela fez:
// se o formatador mudar de ideia sobre milhar ou vírgula, isto quebra junto —
// de propósito.
function reaisDoTexto(txt) {
  const t = norm(txt).trim()
  const negativo = t.startsWith('−') || t.startsWith('-')
  const digitos = t.replace(/[−-]/g, '').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(digitos)
  return negativo ? -n : n
}

const evento = ({ bilheteria, bar, custo, taxa = 12.5, cashback = 5 }) =>
  migrarEvento({
    id: 'ev-coluna-fecha',
    nome: 'Festa da coluna que fecha',
    data: '2026-05-09',
    taxaBilheteria: taxa,
    cashbackPct: cashback,
    contingenciaPct: 0,
    publicoEstimado: 300,
    outrasReceitas: { bar, patrocinio: '' },
    patrocinios: [],
    lotes: [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 300 }],
    categorias: [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [{ id: 'i1', servico: 'Insumos', estimado: custo, realizado: custo }],
      },
    ],
    cenariosConfig: {
      pessimista: { vendaPct: 100, custoPct: 0 },
      realista: { vendaPct: 100, custoPct: 0 },
      otimista: { vendaPct: 100, custoPct: 0 },
      overrides: { pessimista: {}, realista: {}, otimista: {} },
    },
    receitaRealizada: { bilheteria, bar },
  })

const abrir = (ev) =>
  render(
    <FechamentoTab
      evento={ev}
      update={() => {}}
      store={{ eventos: [ev], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
      onPromoverBenchmark={() => {}}
      onFecharEvento={() => {}}
      onReabrirEvento={() => {}}
    />
  )

// A coluna inteira, linha a linha, como ela aparece na tela. Ancorada no
// rótulo do total — "Receita do evento" existe uma vez só nesta aba.
// O bloco da esquerda de cada linha traz o SINAL e o RÓTULO em dois <span>
// irmãos, então `textContent` os devolve colados: "−Taxa da bilheteria (12,5%)"
// e "=Receita do evento". Os matchers abaixo contam com isso de propósito —
// escrever "= Receita" com espaço passa despercebido e não casa com nada.
function linhasDaColuna() {
  const coluna = screen.getByText('Receita do evento').closest('.max-w-lg')
  return Array.from(coluna.children).map((linha) => ({
    rotulo: norm(linha.firstElementChild.textContent).trim(),
    valor: norm(linha.lastElementChild.textContent).trim(),
  }))
}

describe('a coluna do card de fechamento soma na frente de quem lê', () => {
  it('o exemplo canônico da ficha: as parcelas somam EXATAMENTE a "Receita do evento" escrita', () => {
    abrir(evento({ bilheteria: 47850, bar: 3000, custo: 30000 }))
    const linhas = linhasDaColuna()

    const iReceita = linhas.findIndex((l) => /^=\s*Receita do evento/.test(l.rotulo))
    expect(iReceita).toBeGreaterThan(0)

    const parcelas = linhas.slice(0, iReceita).map((l) => reaisDoTexto(l.valor))
    const somaEscrita = parcelas.reduce((a, b) => a + b, 0)
    const totalEscrito = reaisDoTexto(linhas[iReceita].valor)

    // Em centavos, para o teste não depender de ponto flutuante — é a mesma
    // régua que o app usa para decidir se um resíduo é dinheiro ou ruído.
    expect(Math.round(somaEscrita * 100)).toBe(Math.round(totalEscrito * 100))
  })

  it('e os centavos que a coluna escondia aparecem: 5.981,25 e 2.392,50, não 5.981 e 2.393', () => {
    abrir(evento({ bilheteria: 47850, bar: 3000, custo: 30000 }))
    const linhas = linhasDaColuna()
    const valor = (prefixo) => linhas.find((l) => l.rotulo.includes(prefixo)).valor

    expect(valor('Taxa da bilheteria')).toContain('5.981,25')
    expect(valor('Cashback')).toContain('2.392,50')
    // O total que a ficha registrava como 47.261 sob uma soma de 47.262.
    expect(valor('Receita do evento')).toContain('47.261,25')
  })

  it('do total até o resultado a conta também fecha: receita, imposto e custos', () => {
    abrir(evento({ bilheteria: 47850, bar: 3000, custo: 30000 }))
    const linhas = linhasDaColuna()

    const iReceita = linhas.findIndex((l) => /^=\s*Receita do evento/.test(l.rotulo))
    const iResultado = linhas.findIndex((l) => /^=\s*Resultado/.test(l.rotulo))
    expect(iResultado).toBeGreaterThan(iReceita)

    const receita = reaisDoTexto(linhas[iReceita].valor)
    const entreOsDois = linhas
      .slice(iReceita + 1, iResultado)
      .map((l) => reaisDoTexto(l.valor))
      .reduce((a, b) => a + b, 0)
    const resultado = reaisDoTexto(linhas[iResultado].valor)

    expect(Math.round((receita + entreOsDois) * 100)).toBe(Math.round(resultado * 100))
  })

  it('festa de números redondos continua SEM centavos — o risco que o Marco aceitou não cobra quem não deve', () => {
    // Taxa e cashback zerados: toda parcela é inteira, e a tela tem de ficar
    // idêntica à de antes desta decisão. `fmtBRL2` só mostra centavo quando
    // ele existe — sem isto, a decisão teria sujado TODA festa, e não só a que
    // tinha a conta quebrada.
    abrir(evento({ bilheteria: 40000, bar: 3000, custo: 30000, taxa: 0, cashback: 0 }))
    for (const linha of linhasDaColuna()) {
      expect(linha.valor).not.toMatch(/,\d\d/)
    }
  })

  it('meio centavo na taxa e no cashback (bilheteria R$ 47.850,05, taxa 10%, cashback 5%): as parcelas escritas somam a "Receita do evento" escrita', () => {
    // Antes da régua do centavo (07/10/2026) a taxa crua era 4.785,005 e o
    // cashback 2.392,5025: a tela escrevia − R$ 4.785,01 e + R$ 2.392,50, as
    // parcelas somavam R$ 48.457,54 e o total escrito era R$ 48.457,55.
    abrir(evento({ bilheteria: 47850.05, bar: 3000, custo: 30000, taxa: 10, cashback: 5 }))
    const linhas = linhasDaColuna()
    const iReceita = linhas.findIndex((l) => /^=\s*Receita do evento/.test(l.rotulo))
    const parcelas = linhas.slice(0, iReceita).map((l) => reaisDoTexto(l.valor))
    const soma = parcelas.reduce((a, b) => a + b, 0)
    expect(Math.round(soma * 100)).toBe(Math.round(reaisDoTexto(linhas[iReceita].valor) * 100))
    expect(linhas[iReceita].valor).toContain('48.457,54')
  })
})
