// @vitest-environment jsdom
//
// O IMPOSTO NO CAMINHO DO EVENTO FECHADO / REALIZADO — os dois S1 que a revisão
// cética achou em 27/07/2026, cada um com o teste que fica VERMELHO se ele
// voltar.
//
// POR QUE ESTE ARQUIVO EXISTE, além de `impostoNaTela.evidencia.test.jsx`. A
// primeira entrega do imposto ligou o DRE, os cards de cenário, o relatório, o
// modo apresentação e o texto do WhatsApp — e deixou de fora uma FAMÍLIA
// inteira: tudo o que responde "ganhamos dinheiro nesta festa?" depois que ela
// aconteceu. A suíte ficou verde com os dois defeitos de pé, 2.486 testes
// passando, porque nenhum deles olhava para essas telas.
//
// OS DOIS DEFEITOS, medidos no DOM antes do conserto:
//
// 1. A PONTE DO FECHAMENTO CULPAVA A RECEITA PELO IMPOSTO. `desvioDeReceita`
//    era derivado por subtração supondo que o lucro tem DOIS termos (receita e
//    custo). Com três, o imposto inteiro caía dentro dele: num evento cuja
//    bilheteria realizada é EXATAMENTE a prevista, a aba Fechamento imprimia
//    "a receita deste card está R$ 1.300 acima da prevista no cenário" — e os
//    R$ 1.300 eram o imposto. A identidade fechava (R$ 1.600 = 300 de
//    contingência + 1.300), então nada parecia errado. Número certo, causa
//    errada — a terceira encarnação da mesma doença neste arquivo de código.
//
// 2. DOIS LUCROS PARA A MESMA FESTA, NA MESMA ROLAGEM. O card do cenário
//    realista dizia Lucro R$ 7.900, com "Imposto − R$ 1.300" impresso logo
//    acima; o card "Resultado realizado", a centímetros dele, dizia R$ 9,5 mil
//    e "+R$ 0 acima do estimado". E a foto do fechamento congelava os dois.
//
// A RÉGUA DESTE ARQUIVO: cada superfície é RENDERIZADA de verdade e o texto sai
// do DOM. Nada aqui passa por "o módulo devolve o campo certo" — quatro vezes
// na semana de 27/07/2026 esta casa entregou módulo certo com tela muda.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import FechamentoTab from './FechamentoTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import Home from './Home.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import { classeDelta } from './VersaoReuniao.jsx'
import { resumoCurto } from '../lib/resumo.js'
import { computeCenarios } from '../lib/calc.js'
import { resultadoRealizado, montarBenchmarkDeEvento } from '../lib/fechamento.js'
import { fecharEvento } from '../lib/fechamentoEvento.js'
import { resumoComparacao } from '../lib/versaoReuniao.js'
import { migrarEvento } from '../lib/migracao.js'
import { lucroNaoFecha } from '../lib/benchmarks.js'

afterEach(cleanup)

// A lixeira (protecao.js) toca o localStorage de verdade ao montar a Home.
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

// ─────────────────────────────────────────────────────────────────────────
// O EVENTO-RÉGUA — os MESMOS números redondos de `impostoNaTela`, de propósito:
// quem ler os dois arquivos reconhece a conta sem calculadora.
//
//   bilheteria bruta 10.000 · taxa 10% · cashback 5% → líquida 9.500
//   bar 2.000 · patrocínio confirmado 1.000  →  receita 12.500
//   custos 3.000 · contingência 10%          →  custoTotal 3.300
//   imposto 10% sobre as três bases: 10% de 13.000 = 1.300
//
//   CENÁRIO realista .... lucro    12.500 − 1.300 − 3.300 = 7.900
//   CARD realizado ...... resultado 12.500 − 1.300 − 3.000 = 8.200
//   a diferença de 300 é a CONTINGÊNCIA, e só ela.
//
// `receitaRealizada` é IGUAL à prevista de propósito: assim qualquer coisa que
// apareça em "desvio de receita" é, por construção, um erro.
// ─────────────────────────────────────────────────────────────────────────
const eventoBase = (extra = {}) =>
  migrarEvento({
    id: 'ev-imposto-realizado',
    nome: 'Festa fechada — imposto',
    data: '2026-05-09',
    taxaBilheteria: 10,
    cashbackPct: 5,
    contingenciaPct: 10,
    publicoEstimado: 100,
    outrasReceitas: { bar: 2000, patrocinio: '' },
    patrocinios: [{ id: 'p1', patrocinador: 'Marca', valor: 1000, estagio: 'confirmado' }],
    lotes: [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 100 }],
    categorias: [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [{ id: 'i1', servico: 'Insumos', estimado: 3000, realizado: 3000 }],
      },
    ],
    cenariosConfig: {
      pessimista: { vendaPct: 100, custoPct: 0 },
      realista: { vendaPct: 100, custoPct: 0 },
      otimista: { vendaPct: 100, custoPct: 0 },
      overrides: { pessimista: {}, realista: {}, otimista: {} },
    },
    receitaRealizada: { bilheteria: 10000, bar: 2000 },
    ...extra,
  })

const TRES_BASES = { bilheteria: true, bar: true, patrocinio: true }
const comImposto = (extra = {}) =>
  eventoBase({ impostoPct: 10, impostoSobre: TRES_BASES, ...extra })

// A festa que VENDEU O DOBRO: a base do imposto cresce com a receita, e as duas
// parcelas da ponte têm de aparecer SEPARADAS, cada uma com o nome dela.
//   bruta realizada 20.000 → líquida 19.000 → receita 22.000
//   imposto 10% de 23.000 = 2.300  →  resultado 22.000 − 2.300 − 3.000 = 16.700
//   desvio de receita 22.000 − 12.500 = 9.500 · desvio de imposto 2.300 − 1.300 = 1.000
const vendeuODobro = () => comImposto({ receitaRealizada: { bilheteria: 20000, bar: 2000 } })

const cardDe = (ev) => resultadoRealizado(ev, computeCenarios(ev).realista)
const fechar = (ev) => fecharEvento(ev, '2026-05-10T21:00:00.000Z')

const abrirFechamento = (ev) =>
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

const abrirCenarios = (ev) =>
  render(
    <ScenariosTab
      evento={ev}
      update={() => {}}
      updateCenarios={() => {}}
      store={{ eventos: [ev], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} }}
      setStore={() => {}}
    />
  )

const abrirHome = (ev) =>
  render(
    <Home
      store={{ eventos: [ev], benchmarksCustom: [] }}
      setStore={vi.fn()}
      aparencia={{}}
      abrir={vi.fn()}
    />
  )

// O `Intl` de moeda em pt-BR separa "R$" do número com espaço INQUEBRÁVEL
// (U+00A0), que é invisível no editor e faz um `toContain('R$ 8.200')`
// perfeitamente correto falhar. O escape explícito existe para o padrão de
// busca nunca depender de qual espaço foi digitado aqui.
const norm = (s) => String(s).replace(new RegExp('\\u00a0', 'g'), ' ')

// Os rótulos da tabela Estimado × Realizado × Desvio, EM ORDEM. Ancorados pelo
// rodapé do próprio card (o irmão anterior dele é a tabela): "Receita" e
// "Estimado" aparecem em meia dúzia de outros lugares da aba Cenários, e um
// matcher solto pegaria o card errado sem avisar.
const rotulosDaTabelaRealizado = () => {
  const tabela = screen.getByText(/o orçamento digitado/).closest('p').previousElementSibling
  return Array.from(tabela.children)
    .map((linha) => linha.firstElementChild.textContent)
    .filter((t) => t !== '')
}

// Os dígitos, sem depender do espaço fino que o Intl põe depois de "R$".
const temValor = (no, digitos) => expect(norm(no.textContent)).toContain(digitos)

// ═══════════════════════════════════════════════════════════════════════════
// 1. A PONTE DO FECHAMENTO — O S1 DA CAUSA ERRADA
// ═══════════════════════════════════════════════════════════════════════════

describe('S1 — a ponte do Fechamento não culpa mais a receita pelo imposto', () => {
  it('NA TELA: a frase "a receita deste card está R$ 1.300 acima" NÃO aparece', () => {
    // ESTE É O TESTE DO DEFEITO. Antes do conserto a aba imprimia exatamente
    // esta frase, num evento cuja bilheteria realizada é IGUAL à prevista.
    abrirFechamento(comImposto())
    const ponte = screen.getByText(/Por que difere dos Cenários/).closest('p')
    expect(ponte.textContent).not.toMatch(/a receita deste card está/)
    expect(ponte.textContent).not.toMatch(/1\.300 acima/)
    // e a parcela que a tela DEVE nomear continua lá, com o número dela
    expect(ponte.textContent).toMatch(/contingência/)
    temValor(ponte, '300')
  })

  it('o desvio de receita é ZERO quando a receita realizada é a prevista', () => {
    const card = cardDe(comImposto())
    expect(card.desvioDeReceita).toBe(0)
    // o número que o defeito produzia, cravado como proibido
    expect(card.desvioDeReceita).not.toBe(1300)
    expect(card.desvioDeImposto).toBe(0)
  })

  it('a identidade fecha com TRÊS parcelas — reserva + receita − imposto', () => {
    const card = cardDe(vendeuODobro())
    expect(card.desvioDeReceita).toBe(9500)
    expect(card.desvioDeImposto).toBe(1000)
    expect(card.reservaDoCenario).toBe(300)
    expect(card.reservaDoCenario + card.desvioDeReceita - card.desvioDeImposto).toBeCloseTo(
      card.diferencaParaCenario,
      9
    )
  })

  it('NA TELA: quem vendeu mais vê as DUAS parcelas, cada uma com o nome dela', () => {
    abrirFechamento(vendeuODobro())
    const ponte = screen.getByText(/Por que difere dos Cenários/).closest('p')
    const txt = norm(ponte.textContent)
    expect(txt).toMatch(/a receita deste card está .*9\.500 acima da prevista no cenário/)
    expect(txt).toMatch(/o imposto deste card está .*1\.000 acima do previsto no cenário/)
  })

  it('quem vendeu MENOS: as duas parcelas ficam ABAIXO, e a identidade fecha', () => {
    // bruta realizada 5.000 → líquida 4.750 → receita 7.750
    // imposto 10% de 8.000 = 800 → resultado 7.750 − 800 − 3.000 = 3.950
    const ev = comImposto({ receitaRealizada: { bilheteria: 5000, bar: 2000 } })
    const card = cardDe(ev)
    expect(card.resultado).toBe(3950)
    expect(card.desvioDeReceita).toBe(-4750)
    expect(card.desvioDeImposto).toBe(-500)
    expect(card.reservaDoCenario + card.desvioDeReceita - card.desvioDeImposto).toBeCloseTo(
      card.diferencaParaCenario,
      9
    )
    abrirFechamento(ev)
    const txt = norm(screen.getByText(/Por que difere dos Cenários/).closest('p').textContent)
    expect(txt).toMatch(/a receita deste card está .*4\.750 abaixo da prevista no cenário/)
    expect(txt).toMatch(/o imposto deste card está .*500 abaixo do previsto no cenário/)
  })

  it('FOTO ANTIGA (cenário sem a chave `imposto`) não estoura nem inventa número', () => {
    // Cinto para a foto gravada ANTES de 27/07/2026 chegar a estas contas um
    // dia: o imposto do lado estimado vale 0 e a coluna volta a ser a de antes,
    // em vez de derrubar a tela ou afirmar um número que a foto não tem.
    const ev = comImposto({ receitaRealizada: { bilheteria: 5000, bar: 2000 } })
    const cenSemChave = { ...computeCenarios(ev).realista }
    delete cenSemChave.imposto
    const card = resultadoRealizado(ev, cenSemChave)
    expect(card.estimado.lucro).toBe(9500)
    expect('imposto' in card.estimado).toBe(false)
    expect(card.imposto.valor).toBe(800)
  })

  it('SEM cenário nenhum: o card existe, com imposto e sem parcelas de ponte', () => {
    const card = resultadoRealizado(comImposto(), null)
    expect(card.imposto.valor).toBe(1300)
    expect(card.resultado).toBe(8200)
    expect('desvioDeImposto' in card).toBe(false)
    expect(card.desvioDeReceita).toBeNull()
  })

  it('evento SEM imposto: nem a chave nem a frase existem (a tela de sempre)', () => {
    const card = cardDe(eventoBase())
    expect('imposto' in card).toBe(false)
    expect('desvioDeImposto' in card).toBe(false)
    expect(card.desvioDeReceita).toBe(0)
    abrirFechamento(eventoBase())
    expect(screen.queryByText(/Imposto sobre a receita/)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. UM LUCRO SÓ PARA A MESMA FESTA
// ═══════════════════════════════════════════════════════════════════════════

describe('S1 — o card "Resultado realizado" desconta o mesmo imposto do DRE', () => {
  it('a diferença entre o card e o cenário é SÓ a reserva — como era antes do imposto', () => {
    const ev = comImposto()
    const cen = computeCenarios(ev).realista
    const card = cardDe(ev)
    expect(cen.lucro).toBe(7900)
    expect(card.resultado).toBe(8200)
    expect(card.resultado - cen.lucro).toBe(card.reservaDoCenario)
    // o número que o defeito imprimia, cravado como proibido
    expect(card.resultado).not.toBe(9500)
  })

  it('a coluna "Estimado" também é pós-imposto — senão o "vs. estimado" mentia', () => {
    const card = cardDe(comImposto())
    expect(card.estimado.lucro).toBe(8200)
    expect(card.estimado.imposto.valor).toBe(1300)
    // realizado == estimado ⇒ desvio de lucro ZERO, e agora isso é verdade
    expect(card.resultado - card.estimado.lucro).toBe(0)
  })

  it('NA ABA CENÁRIOS: o card imprime R$ 8,2 mil, e NÃO os R$ 9,5 mil de antes', () => {
    const ev = fechar(comImposto())
    abrirCenarios(ev)
    const heroi = screen.getByText('Resultado realizado').parentElement
    temValor(heroi, 'R$ 8,2 mil')
    expect(heroi.textContent).not.toContain('9,5 mil')
  })

  it('NA ABA CENÁRIOS: a tabela ganha a linha Imposto, nas duas colunas', () => {
    abrirCenarios(fechar(comImposto()))
    // a ORDEM é a do DRE: o imposto entra depois da receita e antes do custo
    expect(rotulosDaTabelaRealizado()).toEqual([
      'Receita',
      'Imposto',
      'Custo',
      'Lucro',
      'Margem',
    ])
    const linha = screen.getByText('Imposto', { exact: true }).parentElement
    const celulas = Array.from(linha.querySelectorAll('span')).map((s) => norm(s.textContent))
    // rótulo · estimado · realizado · desvio
    expect(celulas[0]).toBe('Imposto')
    expect(celulas[1]).toContain('1,3 mil')
    expect(celulas[2]).toContain('1,3 mil')
    expect(celulas[3]).toBe('+0')
  })

  it('NA ABA CENÁRIOS: o rodapé DIZ que o imposto sai das duas colunas', () => {
    abrirCenarios(fechar(comImposto()))
    const rodape = screen.getByText(/o orçamento digitado/).closest('p')
    expect(rodape.textContent).toMatch(/imposto/)
    expect(rodape.textContent).toMatch(/10% sobre bilheteria bruta, bar e patrocínio/)
  })

  it('NA HOME: o mesmo card, o mesmo número — as duas telas não se contradizem', () => {
    abrirHome(fechar(comImposto()))
    const heroi = screen.getByText('Resultado realizado').parentElement
    temValor(heroi, 'R$ 8,2 mil')
    expect(screen.getByText('Imposto', { exact: true })).toBeTruthy()
  })

  it('evento SEM imposto: a tabela segue com QUATRO linhas, sem "R$ 0" de enfeite', () => {
    abrirCenarios(fechar(eventoBase()))
    expect(screen.queryByText('Imposto', { exact: true })).toBeNull()
    // as quatro de sempre, lidas DENTRO da tabela do card (o nome "Receita"
    // aparece em meia dúzia de lugares na aba Cenários)
    const rotulos = rotulosDaTabelaRealizado()
    expect(rotulos).toEqual(['Receita', 'Custo', 'Lucro', 'Margem'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. A CONTA DA ABA FECHAMENTO, PASSO A PASSO
// ═══════════════════════════════════════════════════════════════════════════

describe('a aba Fechamento mostra o imposto como passo da conta', () => {
  it('a linha existe entre a receita e os custos, com valor e bases', () => {
    abrirFechamento(comImposto())
    const rotulo = screen.getByText('Imposto sobre a receita')
    const linha = rotulo.closest('div').parentElement
    temValor(linha, '1.300')
    expect(linha.textContent).toContain('10% sobre bilheteria bruta, bar e patrocínio')
  })

  it('a coluna FECHA na tela: 12.500 − 1.300 − 3.000 = 8.200', () => {
    abrirFechamento(comImposto())
    const receita = screen.getByText('Receita do evento').closest('div').parentElement
    const imposto = screen.getByText('Imposto sobre a receita').closest('div').parentElement
    const custos = screen.getByText('Custos considerados').closest('div').parentElement
    const total = screen.getByText('Resultado realizado', { selector: 'span' })
      .closest('div').parentElement
    temValor(receita, '12.500')
    temValor(imposto, '1.300')
    temValor(custos, '3.000')
    temValor(total, '8.200')
  })

  it('o rodapé escreve o imposto na fórmula e diz que a base é a BRUTA', () => {
    abrirFechamento(comImposto())
    const rodape = screen.getByText(/^Conta:/).closest('p')
    expect(rodape.textContent).toContain('imposto sobre a receita')
    expect(rodape.textContent).toMatch(/base da bilheteria é a/)
    expect(rodape.textContent).toContain('bruta')
  })

  it('alíquota digitada sem base marcada: R$ 0 que EXPLICA por que é zero', () => {
    abrirFechamento(
      comImposto({ impostoSobre: { bilheteria: false, bar: false, patrocinio: false } })
    )
    const linha = screen.getByText('Imposto sobre a receita').closest('div').parentElement
    expect(linha.textContent).toContain('10% — nenhuma base marcada')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. A FOTO DO FECHAMENTO — as duas verdades não são congeladas
// ═══════════════════════════════════════════════════════════════════════════

describe('a foto do fechamento congela UM lucro, não dois', () => {
  it('a foto guarda o descritor do imposto nos DOIS blocos e eles conciliam', () => {
    const { foto } = fechar(comImposto()).fechamento
    expect(foto.resultado.imposto.valor).toBe(1300)
    expect(foto.cenarioRealista.imposto.valor).toBe(1300)
    expect(foto.resultado.resultado).toBe(8200)
    expect(foto.cenarioRealista.lucro).toBe(7900)
    // a única diferença congelada é a reserva — nada de imposto pendurado
    expect(foto.resultado.resultado - foto.cenarioRealista.lucro).toBe(
      foto.resultado.reservaDoCenario
    )
    expect(foto.resultado.desvioDeReceita).toBe(0)
  })

  it('foto de evento SEM imposto não ganha campo novo (contrato do salvo)', () => {
    const { foto } = fechar(eventoBase()).fechamento
    expect('imposto' in foto.resultado).toBe(false)
    expect('imposto' in foto.cenarioRealista).toBe(false)
    expect('desvioDeImposto' in foto.resultado).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. AS TRÊS TELAS QUE PUBLICAM A FOTO — a frase que não fechava
//
// Relatório impresso, modo apresentação e texto do WhatsApp imprimem a MESMA
// frase: "receita real X · custos Y", ao lado do resultado. Com o resultado
// pós-imposto e a frase sem o imposto, X − Y ≠ resultado — R$ 1.300 sem
// explicação numa peça impressa, numa tela projetada em reunião e na mensagem
// para as sócias, que é o canal com MENOS chance de conferência.
// ═══════════════════════════════════════════════════════════════════════════

describe('as três telas que publicam a foto fecham a conta', () => {
  const fotoDe = (ev) => fechar(ev).fechamento.foto.resultado

  it('o texto do WhatsApp nomeia o imposto, e a linha FECHA', () => {
    const linhas = resumoCurto(fechar(comImposto()), { hoje: '2026-05-11' })
      .split('\n')
      .map(norm)
    const linha = linhas.find((l) => l.startsWith('Receita real'))
    expect(linha).toBe('Receita real R$ 12.500 · imposto R$ 1.300 · custos considerados R$ 3.000')
    // e a frase FECHA com o número que a linha de cima publica
    const f = fotoDe(comImposto())
    expect(f.receita - f.imposto.valor - f.custos).toBe(f.resultado)
    expect(linhas.some((l) => l.includes('R$ 8.200'))).toBe(true)
  })

  it('festa fechada SEM imposto: a frase do WhatsApp é a de sempre', () => {
    const linhas = resumoCurto(fechar(eventoBase()), { hoje: '2026-05-11' })
      .split('\n')
      .map(norm)
    const linha = linhas.find((l) => l.startsWith('Receita real'))
    expect(linha).toBe('Receita real R$ 12.500 · custos considerados R$ 3.000')
  })

  it('NO RELATÓRIO impresso: a linha do resultado real cita o imposto', () => {
    const ev = fechar(comImposto())
    render(<ReportView evento={ev} store={{ eventos: [ev], benchmarksCustom: [] }} onBack={() => {}} />)
    const bloco = screen.getByText(/Resultado real do evento/).closest('section')
    const txt = norm(bloco.textContent)
    expect(txt).toContain('R$ 8.200')
    expect(txt).toContain('Receita real R$ 12.500')
    expect(txt).toMatch(/imposto R\$ 1\.300/)
  })

  it('NO MODO APRESENTAÇÃO: a faixa da reunião cita o imposto', () => {
    const ev = fechar(comImposto())
    render(<PresentationMode evento={ev} store={{ eventos: [ev], benchmarksCustom: [] }} onClose={() => {}} />)
    const faixa = screen.getByText(/Festa realizada/).closest('div')
    const txt = norm(faixa.textContent)
    expect(txt).toContain('R$ 8.200')
    expect(txt).toMatch(/imposto R\$ 1\.300/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. O BENCHMARK PROMOVIDO — o aviso do editor ganha a resposta junto
// ═══════════════════════════════════════════════════════════════════════════

describe('benchmark promovido de festa com imposto', () => {
  it('o lucro gravado é pós-imposto e a obs EXPLICA a diferença que o editor acusa', () => {
    const bm = montarBenchmarkDeEvento(comImposto())
    expect(bm.lucro).toBe(8200)
    expect(bm.receita).toBe(12500)
    // `lucroNaoFecha` vai acusar (receita − custo = 9.500 ≠ 8.200) — de
    // propósito, é a decisão do Marco de 27/07/2026 "avisar, nunca recalcular".
    // O que este teste cobra é que a resposta viaje GRAVADA junto.
    expect(lucroNaoFecha(bm).diferenca).toBe(-1300)
    expect(bm.obs).toContain('imposto sobre a receita')
    expect(bm.obs).toContain('1300.00')
    expect(bm.obs).toContain('10% sobre bilheteria bruta, bar e patrocínio')
  })

  it('festa SEM imposto: a obs é a de sempre, sem uma palavra a mais', () => {
    // O nome do evento-régua tem a palavra "imposto" dentro, então a
    // verificação é da FRASE que o conserto acrescenta, não da palavra solta.
    const bm = montarBenchmarkDeEvento(eventoBase())
    expect(bm.obs).not.toMatch(/de imposto sobre a receita/)
    // A obs deixou de TERMINAR em "Sem reserva de contingência." em
    // 30/08/2026: a decisão 6 do Marco pôs, no fim dela, a frase que diz qual
    // conta produziu o ticket. A âncora de fim de texto virou essa frase, e a
    // verificação do imposto — que é o assunto deste arquivo — segue sendo a
    // linha acima, intacta.
    expect(bm.obs).toContain('Sem reserva de contingência.')
    expect(bm.obs).toMatch(/Ticket médio = bilheteria bruta ÷ público \(régua de 24\/07\/2026 em diante\)\.$/)
    expect(lucroNaoFecha(bm)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. A VERSÃO DE REUNIÃO — mostra o efeito E a causa
// ═══════════════════════════════════════════════════════════════════════════

describe('a comparação de versão explica o lucro que mudou', () => {
  it('mudando SÓ a alíquota, a linha de imposto aparece e as outras ficam zeradas', () => {
    const antes = comImposto({ impostoPct: 0 })
    const agora = comImposto({ impostoPct: 10 })
    const { linhas } = resumoComparacao(antes, agora)
    const por = (l) => linhas.find((x) => x.label === l)
    expect(por('Receita total (realista)').delta).toBe(0)
    expect(por('Custo total (realista)').delta).toBe(0)
    const imp = por('Imposto sobre a receita (realista)')
    expect(imp).toBeTruthy()
    expect(imp.antes).toBe(0)
    expect(imp.agora).toBe(1300)
    expect(imp.delta).toBe(1300)
    // e a causa FECHA com o efeito: o lucro caiu exatamente o imposto que subiu
    expect(por('Lucro (realista)').delta).toBe(-imp.delta)
  })

  it('sem imposto em nenhum dos dois lados, a tabela segue com cinco linhas', () => {
    const { linhas } = resumoComparacao(eventoBase(), eventoBase())
    expect(linhas).toHaveLength(5)
    expect(linhas.some((l) => /Imposto/.test(l.label))).toBe(false)
  })

  it('imposto que SOBE é vermelho — a régua do custo, não a do resultado', () => {
    // Sem isto, a tela projetada na reunião pintaria de VERDE um aumento de
    // R$ 35 mil de tributo. Verde é a cor do resultado bom nesta casa.
    const vermelho = classeDelta('Imposto sobre a receita (realista)', 35473.51)
    expect(vermelho).toContain('vermelho')
    expect(classeDelta('Imposto sobre a receita (realista)', -35473.51)).toContain('verde')
    // e as linhas de sempre não mudaram de régua
    expect(classeDelta('Lucro (realista)', 1000)).toContain('verde')
    expect(classeDelta('Custo total (realista)', 1000)).toContain('vermelho')
  })
})
