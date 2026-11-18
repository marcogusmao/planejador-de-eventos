// TRAVA — a festa passada fala mesmo com o campo "vendidos até hoje" VAZIO.
//
// Decisão do Marco, 26/07/2026 (questionário: "No arquivo das fórmulas").
//
// O conserto anterior (marcacaoRealizada.test.js) levou a marcação às quatro
// superfícies, mas ela só aparecia quando "ingressos vendidos até hoje" estava
// PREENCHIDO — e o padrão do campo é vazio. Com o campo em branco,
// `ritmoVendas` devolvia `null` ANTES de olhar a data, e a festa que já
// aconteceu ficava indistinguível de uma festa futura sem dado nas quatro:
// card da aba Cenários, linha da Home, texto de "Copiar resumo" (curto e
// completo) e relatório/PDF.
//
// O que a decisão mudou, em uma célula só:
//   evento PASSADO + campo VAZIO ....... null → { eventoPassado: true }
// As outras três combinações (passado+preenchido, futuro+vazio,
// futuro+preenchido) não mudaram, e este arquivo cobra as três.
//
// Nenhum número de negócio entra neste caminho: o objeto devolvido tem UMA
// chave booleana, a mesma que as telas já usavam.
import { describe, it, expect } from 'vitest'
import { computeCenarios, ritmoVendas } from './calc.js'
import { resumoCurto, resumoCompleto, linhaRitmoRelatorio, MARCACAO_REALIZADA } from './resumo.js'
import { linhaRitmoHome } from '../components/RitmoVendas.jsx'
import { novoEvento, novoLote, novoItem } from './defaults.js'

const HOJE = '2026-07-20'
const lote = (nome, valor, quantidade) => novoLote({ nome, valor, quantidade })
const item = (servico, estimado) => novoItem({ servico, estimado, status: 'FECHADO' })
const cats = (mapa) => novoEvento('tmp').categorias.map((c) => ({ ...c, itens: mapa[c.id] || [] }))

// Mesma festa do arquivo irmão, para os dois poderem ser lidos juntos — mas
// com o campo VAZIO, que é o padrão de todo evento novo.
const base = {
  ...novoEvento('Brisa 14/03'),
  local: 'Casa Brisa',
  tipo: 'Brisa',
  publicoEstimado: 1000,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  barModo: 'fixo',
  outrasReceitas: { bar: 8000, patrocinio: '' },
  vendidosAteHoje: '',
  lotes: [lote('Lote 1', 100, 400), lote('Lote 2', 100, 400), lote('Último Lote', 100, 200)],
  categorias: cats({
    artistico: [item('DJs', 15000)],
    estrutura: [item('Som e luz', 13000)],
    equipe: [item('Produção + segurança', 10000)],
  }),
}
const passadaVazia = { ...base, data: '2026-03-14' } // 4 meses ANTES de HOJE
const futuraVazia = { ...base, data: '2026-12-31' } // depois de HOJE
const passadaPreenchida = { ...base, data: '2026-03-14', vendidosAteHoje: 420 }

const beDe = (ev) => computeCenarios(ev).realista.breakEven

describe('festa PASSADA com o campo vazio: as quatro superfícies falam', () => {
  it('ritmoVendas devolve a marcação, e só ela', () => {
    const r = ritmoVendas({
      vendidos: passadaVazia.vendidosAteHoje,
      dataEvento: passadaVazia.data,
      breakEven: beDe(passadaVazia),
      hoje: HOJE,
    })
    expect(r).toEqual({ eventoPassado: true })
    // Nenhum número de negócio veio junto — o objeto tem UMA chave.
    expect(Object.keys(r)).toEqual(['eventoPassado'])
  })

  it('card da Home', () => {
    expect(linhaRitmoHome(passadaVazia, beDe(passadaVazia), HOJE)).toEqual({
      tom: 'neutro',
      texto: MARCACAO_REALIZADA,
    })
  })

  it('texto do WhatsApp — curto e completo', () => {
    expect(resumoCurto(passadaVazia, { hoje: HOJE })).toContain(MARCACAO_REALIZADA)
    expect(resumoCompleto(passadaVazia, { hoje: HOJE })).toContain(MARCACAO_REALIZADA)
    // Sem o prefixo "Vendidos até hoje" — não há número, e "até hoje" não quer
    // dizer nada depois da festa.
    expect(resumoCurto(passadaVazia, { hoje: HOJE })).not.toContain('Vendidos até hoje')
  })

  it('relatório/PDF', () => {
    expect(linhaRitmoRelatorio(passadaVazia, beDe(passadaVazia), HOJE)).toBe(MARCACAO_REALIZADA)
  })
})

describe('as outras três combinações não mudaram', () => {
  it('festa PASSADA com o campo preenchido: igual ao que já era', () => {
    const r = ritmoVendas({
      vendidos: passadaPreenchida.vendidosAteHoje,
      dataEvento: passadaPreenchida.data,
      breakEven: beDe(passadaPreenchida),
      hoje: HOJE,
    })
    expect(r).toEqual({ eventoPassado: true })
  })

  it('festa FUTURA com o campo vazio: segue sem ritmo e SEM a marcação', () => {
    expect(
      ritmoVendas({
        vendidos: futuraVazia.vendidosAteHoje,
        dataEvento: futuraVazia.data,
        breakEven: beDe(futuraVazia),
        hoje: HOJE,
      })
    ).toBe(null)
    expect(resumoCurto(futuraVazia, { hoje: HOJE })).not.toContain('já realizado')
    expect(resumoCompleto(futuraVazia, { hoje: HOJE })).not.toContain('já realizado')
    expect(linhaRitmoRelatorio(futuraVazia, beDe(futuraVazia), HOJE)).toBe(null)
    expect(linhaRitmoHome(futuraVazia, beDe(futuraVazia), HOJE)).toBe(null)
  })

  it('festa FUTURA com o campo preenchido: o ritmo continua sendo calculado', () => {
    const futuraPreenchida = { ...futuraVazia, vendidosAteHoje: 420 }
    const r = ritmoVendas({
      vendidos: futuraPreenchida.vendidosAteHoje,
      dataEvento: futuraPreenchida.data,
      breakEven: beDe(futuraPreenchida),
      hoje: HOJE,
    })
    expect(r.eventoPassado).toBe(false)
    expect(r.vendidos).toBe(420)
  })
})

describe('sem data ou sem break-even continua devolvendo null', () => {
  it('sem data não dá para dizer que passou', () => {
    expect(
      ritmoVendas({ vendidos: '', dataEvento: '', breakEven: 500, hoje: HOJE })
    ).toBe(null)
  })
  it('sem break-even também não', () => {
    expect(
      ritmoVendas({ vendidos: '', dataEvento: '2026-03-14', breakEven: null, hoje: HOJE })
    ).toBe(null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AS DUAS FRONTEIRAS DA LINHA QUE ESTE COMMIT ACRESCENTOU — o buraco que a
// verificação adversarial de 26/07/2026 nomeou nos nove testes acima.
//
// Medido: com os nove testes no lugar, a suíte inteira (98 arquivos, 2011 testes,
// nos dois fusos) ficava VERDE sob duas mutações que mudam o comportamento numa
// festa real:
//
//   · `if (dias < 0)` trocado por `return dias <= 0 ? { eventoPassado: true } : null`
//     → o app enterra a festa NO DIA em que ela acontece, desde que o campo de
//     vendidos esteja vazio (o padrão). É o dia em que o Marco mais olha a tela.
//
//   · `if (dias < 0)` trocado por `if (dias < 0 || Number.isNaN(dias))`
//     → data ilegível passa a valer como festa já realizada, e o app para de
//     acompanhar uma festa que talvez ainda vá acontecer.
//
// Os nove afirmavam o MEIO da regra (passado sim, futuro não) e nenhuma das duas
// pontas. Estes fecham as pontas.
// ─────────────────────────────────────────────────────────────────────────────
describe('as duas fronteiras: o dia da festa e a data ilegível', () => {
  it('festa HOJE não está realizada — nem com o campo de vendidos vazio', () => {
    const hoje = { ...base, data: HOJE }
    const r = ritmoVendas({
      vendidos: hoje.vendidosAteHoje,
      dataEvento: hoje.data,
      breakEven: beDe(hoje),
      hoje: HOJE,
    })
    // Campo vazio + festa que NÃO passou = sem ritmo a calcular, e sem
    // marcação. `null`, não `{ eventoPassado: true }`.
    expect(r).toBe(null)
    expect(resumoCurto(hoje, { hoje: HOJE })).not.toContain('já realizado')
    expect(resumoCompleto(hoje, { hoje: HOJE })).not.toContain('já realizado')
    expect(linhaRitmoRelatorio(hoje, beDe(hoje), HOJE)).toBe(null)
    expect(linhaRitmoHome(hoje, beDe(hoje), HOJE)).toBe(null)
  })

  it('festa HOJE com o campo preenchido também não está realizada — ela é o caso "faltam N"', () => {
    const hoje = { ...base, data: HOJE, vendidosAteHoje: 100 }
    const r = ritmoVendas({
      vendidos: hoje.vendidosAteHoje,
      dataEvento: hoje.data,
      breakEven: beDe(hoje),
      hoje: HOJE,
    })
    expect(r.eventoPassado).toBe(false)
    expect(r.dias).toBe(0)
  })

  it('festa ONTEM está realizada — a fronteira é exatamente aqui', () => {
    const ontem = { ...base, data: '2026-07-19' } // HOJE é 2026-07-20
    expect(
      ritmoVendas({
        vendidos: ontem.vendidosAteHoje,
        dataEvento: ontem.data,
        breakEven: beDe(ontem),
        hoje: HOJE,
      })
    ).toEqual({ eventoPassado: true })
  })

  it('data ILEGÍVEL não vira festa realizada — em nenhuma das quatro superfícies', () => {
    for (const dataRuim of ['31/03/2026', 'amanhã', '2026-13-45', '0000-00-00']) {
      const ruim = { ...base, data: dataRuim }
      const r = ritmoVendas({
        vendidos: ruim.vendidosAteHoje,
        dataEvento: ruim.data,
        breakEven: beDe(ruim),
        hoje: HOJE,
      })
      // O que NÃO pode acontecer é o app afirmar que a festa já foi com base
      // numa data que ele não conseguiu ler.
      expect(r?.eventoPassado).not.toBe(true)
      expect(resumoCurto(ruim, { hoje: HOJE })).not.toContain('já realizado')
      expect(linhaRitmoRelatorio(ruim, beDe(ruim), HOJE)).not.toBe(MARCACAO_REALIZADA)
    }
  })

  it('data ilegível COM o campo preenchido também não vira realizada', () => {
    const ruim = { ...base, data: 'amanhã', vendidosAteHoje: 420 }
    const r = ritmoVendas({
      vendidos: ruim.vendidosAteHoje,
      dataEvento: ruim.data,
      breakEven: beDe(ruim),
      hoje: HOJE,
    })
    expect(r?.eventoPassado).not.toBe(true)
  })
})
