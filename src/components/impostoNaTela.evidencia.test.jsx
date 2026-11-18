// @vitest-environment jsdom
//
// O IMPOSTO NA TELA — o teste que existe porque a suíte verde não prova nada.
//
// POR QUE ESTE ARQUIVO, além de src/lib/imposto.test.js. A regra do imposto é
// pura e tem 40 verificações no módulo dela. Mas neste repositório, QUATRO
// vezes na semana de 27/07/2026, a suíte fechou verde com a parte nova
// desligada na tela: o aviso de bar não recebia a prop `evento`, o botão de
// copiar o ticket não existia no DOM, e a linha de ajuste de custos já tinha
// sumido do DRE sem nada ficar vermelho. Módulo certo com tela muda é
// exatamente o defeito que este app passou dois dias consertando — e no caso
// do imposto ele é pior que os anteriores, porque o LUCRO já sai descontado:
// uma tela sem a linha mostra receita e custo que não chegam no lucro impresso
// ao lado deles. Duas verdades na mesma tela.
//
// Por isso cada superfície abaixo é RENDERIZADA de verdade e o texto é lido do
// DOM. O ataque adversarial correspondente (apagar a linha e ver vermelho) está
// registrado no relatório da sessão.
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import RevenueTab from './RevenueTab.jsx'
import { computeCenario } from '../lib/calc.js'

afterEach(cleanup)

// Evento pequeno e redondo — os mesmos números do teste do módulo, para quem
// ler os dois reconhecer a conta: bruta 10.000 · bar 2.000 · patrocínio 1.000
// · custos 3.000 + 10% de contingência. A 10% sobre as três bases o imposto é
// R$ 1.300 e o lucro cai de 9.200 para 7.900.
const evento = (extra = {}) => ({
  id: 'ev-imposto',
  nome: 'Festa de teste — imposto',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  publicoEstimado: 100,
  outrasReceitas: { bar: 2000, patrocinio: '' },
  patrocinios: [{ id: 'p1', patrocinador: 'Marca', valor: 1000, estagio: 'confirmado' }],
  lotes: [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 100 }],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ id: 'i1', servico: 'Insumos', estimado: 3000 }] }],
  cenariosConfig: {
    pessimista: { vendaPct: 100, custoPct: 0 },
    realista: { vendaPct: 100, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: 0 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
  ...extra,
})

const comImposto = (pct = 10, sobre = { bilheteria: true, bar: true, patrocinio: true }) =>
  evento({ impostoPct: pct, impostoSobre: sobre })

const store = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })

const abrirCenarios = (e) =>
  render(
    <ScenariosTab
      evento={e}
      update={() => {}}
      updateCenarios={() => {}}
      store={store(e)}
      setStore={() => {}}
    />
  )

// O relatório nasce no nível "Resumido"; o DRE por cenário só existe no
// "Completo" (ReportView.jsx). Clicar no seletor é o que o Marco faz — e
// deixa o teste provando a tela que ele de fato lê na reunião.
const abrirRelatorio = (e, { completo = false } = {}) => {
  const r = render(<ReportView evento={e} store={store(e)} onBack={() => {}} />)
  if (completo) fireEvent.click(screen.getByRole('button', { name: 'Completo' }))
  return r
}

// ─────────────────────────────────────────────────────────────────────────
// A LINHA DO DRE
// ─────────────────────────────────────────────────────────────────────────

describe('a linha do imposto no DRE da aba Cenários', () => {
  it('a linha EXISTE e diz sobre o que o imposto incidiu', () => {
    abrirCenarios(comImposto())
    const linha = screen.getByText(/Imposto sobre a receita \(10% sobre bilheteria bruta, bar e patrocínio\)/)
    expect(linha).toBeTruthy()
  })

  it('a linha mostra o VALOR, com sinal de dedução, nos três cenários', () => {
    const { container } = abrirCenarios(comImposto())
    const celula = screen.getByText(/Imposto sobre a receita \(10%/)
    const tr = celula.closest('tr')
    const valores = within(tr).getAllByText(/− R\$/)
    expect(valores).toHaveLength(3)
    for (const v of valores) expect(v.textContent).toContain('1.300')
    expect(container).toBeTruthy()
  })

  it('a coluna FECHA na tela: receita − imposto − custo = o lucro impresso', () => {
    // A régua da casa ("toda coluna do DRE tem que somar na frente de quem
    // lê", src/lib/dre.js) aplicada ao termo novo. Conferida contra os
    // NÚMEROS DO DOM, não contra o objeto do cálculo.
    abrirCenarios(comImposto())
    // `selector: 'td'` é obrigatório: "Receita total" e "Custo total" também
    // aparecem como <dt> nos cards dos cenários, logo acima do DRE. Sem o
    // filtro o teste pegava o card e não provava nada sobre a TABELA.
    const valorDaLinha = (regex) => {
      const tr = screen.getByText(regex, { selector: 'td' }).closest('tr')
      const tds = within(tr).getAllByRole('cell')
      // coluna 0 = rótulo · 1 pessimista · 2 realista · 3 otimista
      return tds[2].textContent
    }
    expect(valorDaLinha(/^Receita total$/)).toContain('12.500')
    expect(valorDaLinha(/Imposto sobre a receita \(10%/)).toContain('1.300')
    expect(valorDaLinha(/^Custo total$/)).toContain('3.300')
    expect(valorDaLinha(/^Lucro$/)).toContain('7.900')
    // 12.500 − 1.300 − 3.300 = 7.900 — e o lucro do cálculo confirma.
    expect(computeCenario(comImposto(), 'realista').lucro).toBe(7900)
  })

  it('SEM imposto configurado a linha NÃO existe — a tela de hoje continua a de hoje', () => {
    abrirCenarios(evento())
    expect(screen.queryByText(/Imposto sobre a receita/)).toBeNull()
  })

  it('alíquota 10% com NENHUMA base marcada: a linha aparece e conta a história', () => {
    // O ponto todo do rótulo. Chave desligada e alíquota zero dão o MESMO
    // R$ 0; sem esta frase, em três meses ninguém sabe se o bar ficou de fora
    // de propósito ou porque alguém esqueceu de marcar.
    abrirCenarios(comImposto(10, { bilheteria: false, bar: false, patrocinio: false }))
    expect(screen.getByText(/Imposto sobre a receita \(10% — nenhuma base marcada\)/)).toBeTruthy()
  })

  it('alíquota 0% sobre a bilheteria conta uma história DIFERENTE do caso acima', () => {
    abrirCenarios(comImposto(0, { bilheteria: true, bar: false, patrocinio: false }))
    expect(screen.getByText(/Imposto sobre a receita \(0% sobre bilheteria bruta\)/)).toBeTruthy()
    expect(screen.queryByText(/nenhuma base marcada/)).toBeNull()
  })

  it('bar de fora aparece escrito: a linha nomeia só bilheteria e patrocínio', () => {
    abrirCenarios(comImposto(10, { bilheteria: true, bar: false, patrocinio: true }))
    const linha = screen.getByText(/Imposto sobre a receita \(10% sobre bilheteria bruta e patrocínio\)/)
    expect(linha).toBeTruthy()
    // 10% de (10.000 + 1.000) = 1.100 — o bar de 2.000 não entrou.
    const tr = linha.closest('tr')
    expect(within(tr).getAllByText(/− R\$/)[0].textContent).toContain('1.100')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// O CARD DO CENÁRIO (o número grande que o Marco olha primeiro)
// ─────────────────────────────────────────────────────────────────────────

describe('o card de cada cenário', () => {
  it('mostra a linha de imposto entre a receita e o custo', () => {
    abrirCenarios(comImposto())
    // Um card por cenário → três ocorrências do rótulo curto.
    const linhas = screen.getAllByText('Imposto sobre a receita')
    expect(linhas.length).toBeGreaterThanOrEqual(3)
  })

  it('o gráfico Receita × Custo × Lucro avisa que o lucro já é pós-imposto', () => {
    // As três barras são rotuladas com o valor, então quem olha subtrai.
    // Sem a nota, receita − custo não fecharia no lucro desenhado ao lado.
    abrirCenarios(comImposto())
    expect(screen.getByText(/receita menos custo não fecha no lucro aqui/)).toBeTruthy()
  })

  it('sem imposto o gráfico não ganha nota nenhuma', () => {
    abrirCenarios(evento())
    expect(screen.queryByText(/receita menos custo não fecha/)).toBeNull()
  })

  it('sem imposto o card é o de sempre (receita, custo, break-even…)', () => {
    abrirCenarios(evento())
    expect(screen.queryByText('Imposto sobre a receita')).toBeNull()
    expect(screen.getAllByText('Receita total').length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// O RELATÓRIO (a folha que vai para a reunião e para o PDF)
// ─────────────────────────────────────────────────────────────────────────

describe('o relatório impresso', () => {
  it('o DRE do relatório tem a linha, com alíquota e bases', () => {
    abrirRelatorio(comImposto(), { completo: true })
    expect(
      screen.getByText(/Imposto sobre a receita \(10% sobre bilheteria bruta, bar e patrocínio\)/)
    ).toBeTruthy()
  })

  it('os três cards do resumo mostram "Imposto" junto de receita e custo', () => {
    abrirRelatorio(comImposto())
    expect(screen.getAllByText('Imposto')).toHaveLength(3)
  })

  it('a nota de premissas explica a base BRUTA e a contingência de fora', () => {
    abrirRelatorio(comImposto(), { completo: true })
    expect(screen.getByText(/Imposto sobre a receita: 10% sobre bilheteria bruta/)).toBeTruthy()
    expect(screen.getByText(/antes da comissão da Tiqueteira e antes do cashback/)).toBeTruthy()
    expect(screen.getByText(/NÃO entra na base da contingência/)).toBeTruthy()
  })

  it('sem imposto, o relatório não ganha linha nem premissa nova', () => {
    abrirRelatorio(evento(), { completo: true })
    expect(screen.queryByText(/Imposto/)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// A PORTA DE EDIÇÃO (aba Receita)
// ─────────────────────────────────────────────────────────────────────────

describe('o card de edição na aba Receita', () => {
  it('tem a alíquota e as três chaves, com os nomes que o Marco usa', () => {
    render(<RevenueTab evento={evento()} update={() => {}} />)
    expect(screen.getByText('Imposto sobre a receita')).toBeTruthy()
    expect(screen.getByLabelText('bilheteria bruta')).toBeTruthy()
    expect(screen.getByLabelText('bar')).toBeTruthy()
    expect(screen.getByLabelText('patrocínio')).toBeTruthy()
  })

  it('as três chaves nascem DESLIGADAS num evento que nunca viu esta tela', () => {
    render(<RevenueTab evento={evento()} update={() => {}} />)
    for (const nome of ['bilheteria bruta', 'bar', 'patrocínio'])
      expect(screen.getByLabelText(nome).checked).toBe(false)
  })

  it('a chave marcada aparece marcada (a tela lê o mesmo que a conta lê)', () => {
    render(
      <RevenueTab
        evento={comImposto(10, { bilheteria: true, bar: false, patrocinio: false })}
        update={() => {}}
      />
    )
    expect(screen.getByLabelText('bilheteria bruta').checked).toBe(true)
    expect(screen.getByLabelText('bar').checked).toBe(false)
  })

  it('valor TORTO no dado salvo não marca a caixinha (a conta também o ignora)', () => {
    render(<RevenueTab evento={evento({ impostoPct: 10, impostoSobre: { bar: 'true' } })} update={() => {}} />)
    expect(screen.getByLabelText('bar').checked).toBe(false)
  })

  it('mostra a continha do realista: base × alíquota = imposto', () => {
    render(<RevenueTab evento={comImposto()} update={() => {}} />)
    expect(screen.getByText(/de base ×/)).toBeTruthy()
    expect(screen.getByText(/13\.000/)).toBeTruthy()
  })

  it('alíquota digitada sem nenhuma base marcada AVISA em vez de ficar muda', () => {
    render(
      <RevenueTab
        evento={comImposto(10, { bilheteria: false, bar: false, patrocinio: false })}
        update={() => {}}
      />
    )
    expect(screen.getByText(/sem nenhuma base marcada/)).toBeTruthy()
  })

  it('base marcada sem alíquota AVISA que o imposto fica em R$ 0', () => {
    render(
      <RevenueTab
        evento={evento({ impostoPct: '', impostoSobre: { bilheteria: true } })}
        update={() => {}}
      />
    )
    expect(screen.getByText(/sem alíquota preenchida/)).toBeTruthy()
  })
})
