// NÃO-REGRESSÃO da mudança de 20/07/2026 em `montarBenchmarkDeEvento`
// ("nunca quebre nada", regra permanente do Marco).
//
// A mudança acertou a conta do benchmark PROMOVIDO. Três coisas não podiam ser
// arrastadas junto, e cada uma tem o seu cadeado aqui:
//
//   1. os 4 benchmarks EMBUTIDOS não mudam um centavo — eles são a âncora
//      histórica do princípio 3, e a tabela de fábrica está transcrita abaixo
//      inteira, campo a campo;
//   2. um benchmark PROMOVIDO ANTES da mudança, já salvo no store do Marco,
//      não muda nada — nem lido, nem exportado, nem reimportado de um backup
//      JSON antigo (restrição dura do Marco: "NÃO MUDE BENCHMARKS ANTIGOS JÁ
//      LANÇADOS");
//   3. a comparação continua funcionando com os DOIS tipos lado a lado — o
//      antigo (sem `semReserva`) e o novo (com), o embutido e o promovido.
//
// O cadeado da restrição por IDENTIDADE de objeto (nenhum caminho de leitura
// recalcula um custom) mora em `promoverBenchmark.evidencia.test.js`, bloco 3.
// Aqui é o lado dos VALORES e do round-trip.

import { describe, it, expect } from 'vitest'
import {
  FIXED_BENCHMARKS,
  benchmarksDisponiveis,
  benchmarksVisiveis,
  benchmarksAtivos,
  somaCustos,
  porPessoa,
  temSemReserva,
} from './benchmarks.js'
import { montarBenchmarkDeEvento } from './fechamento.js'
import { montarBackup, parseBackup, mesclarBackup } from './storage.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { clone } from './util.js'

// ===========================================================================
// 1. OS 4 EMBUTIDOS — a tabela de fábrica, transcrita
// ===========================================================================
// Transcrição literal de `FIXED_BENCHMARKS` (benchmarks.js). Se um refactor,
// uma migração ou uma sessão de IA encostar num desses números, este teste
// grita — que é exatamente o que o princípio 3 pede contra a mudança
// SILENCIOSA. (O Marco segue podendo editar e apagar pela tela: isso mexe no
// store, nunca nesta tabela.)
const FABRICA = [
  {
    id: 'bm-cordel',
    nome: 'Festa do Cordel',
    publico: 400,
    custos: { aeb: 16420, locacao: 5500, estrutura: 41250, equipe: 6180, artistico: 15300, marketing: null, extras: null },
    custoTotal: 84650,
    receita: 118740,
    ticketMedio: 297,
    lucro: 32140,
  },
  {
    id: 'bm-brisa-1205',
    nome: 'Brisa 05/12',
    publico: null,
    custos: { aeb: 35210, locacao: 17400, estrutura: 76830, equipe: 24590, artistico: 1000, marketing: null, extras: 2860 },
    custoTotal: 157891,
    receita: null,
    ticketMedio: null,
    lucro: null,
  },
  {
    id: 'bm-marfim-0905',
    nome: 'Marfim 09/05',
    publico: 1500,
    custos: { aeb: 58420, locacao: 43150, estrutura: 108760, equipe: 71280, artistico: 21940, marketing: null, extras: 29870 },
    custoTotal: 333419,
    receita: 336150,
    ticketMedio: 164,
    lucro: -6480,
  },
  {
    id: 'bm-brisa-1403',
    nome: 'Brisa 14/03/26',
    publico: null,
    custos: { aeb: 27340, locacao: 20000, estrutura: 13980, equipe: 18260, artistico: 26000, marketing: 7380, extras: null },
    custoTotal: 112959,
    receita: 186420,
    ticketMedio: null,
    lucro: 73461,
    obs: 'A&B inclui CMV de consignados (R$ 10.830). Marketing (R$ 7.380) = patrocínios/designer/filmmaker. Equipe inclui staff de bar/segurança/limpeza (R$ 10.960).',
  },
]

describe('os 4 benchmarks EMBUTIDOS não mudaram um centavo', () => {
  it('a tabela de fábrica está byte a byte onde estava', () => {
    expect(FIXED_BENCHMARKS).toEqual(FABRICA)
  })

  it('nenhum deles ganhou a etiqueta "sem reserva" — eles CARREGAM a reserva por dentro', () => {
    for (const b of FIXED_BENCHMARKS) {
      expect(temSemReserva(b)).toBe(false)
      expect(b.semReserva).toBeUndefined()
    }
    // A prova de que a reserva está lá dentro: a categoria se chama
    // "Extras & Conting." e a Marfim 09/05 carrega R$ 29.870 nela. É por causa
    // disto que o promovido precisa da etiqueta — senão ele só parece barato.
    expect(FIXED_BENCHMARKS.find((b) => b.id === 'bm-marfim-0905').custos.extras).toBe(29870)
  })

  it('promover uma festa não encosta na tabela de fábrica', () => {
    const congelada = clone(FIXED_BENCHMARKS)
    montarBenchmarkDeEvento(eventoFechado())
    expect(FIXED_BENCHMARKS).toEqual(congelada)
  })
})

// ===========================================================================
// 2. O PROMOVIDO ANTIGO — salvo antes da mudança, sobrevive inteiro
// ===========================================================================
// Objeto no formato exato em que a conta ANTIGA o gravava: receita BRUTA,
// lucro pela subtração dela, e SEM o campo `semReserva`, que só nasceu em
// 20/07/2026. É o que existe hoje no store do Marco.
const PROMOVIDO_ANTIGO = {
  id: 'bm-promovido-antes-da-mudanca',
  nome: 'Festa promovida em junho',
  custom: true,
  publico: 800,
  custos: { aeb: null, locacao: 12000, estrutura: 29500, equipe: 14000, artistico: 35000, marketing: null, extras: null },
  custoTotal: 90500,
  receita: 88000,
  ticketMedio: 110,
  lucro: -2500,
  obs: 'Promovido da previsão "Festa promovida em junho" (12/06/2026)',
}

const storeCom = (...customs) => ({
  eventos: [],
  benchmarksCustom: customs.map((b) => clone(b)),
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: {},
})

function eventoFechado() {
  const e = novoEvento('O Galeao 12/07')
  e.data = '2026-07-12'
  e.publicoEstimado = 800
  e.taxaBilheteria = 22
  e.cashbackPct = 2
  e.contingenciaPct = 8
  e.lotes = [
    novoLote({ nome: 'Lote 1', valor: 130, quantidade: 400 }),
    novoLote({ nome: 'Lote 2', valor: 160, quantidade: 400 }),
  ]
  e.outrasReceitas = { bar: 15000, patrocinio: '' }
  e.categorias = e.categorias.map((c) =>
    c.id === 'artistico'
      ? { ...c, itens: [novoItem({ servico: 'Line-up', estimado: 35000, realizado: 35000 })] }
      : c.id === 'estrutura'
        ? { ...c, itens: [novoItem({ servico: 'Estrutura', estimado: 28000, realizado: 29500 })] }
        : c
  )
  e.receitaRealizada = { bilheteria: 88000, bar: 14200 }
  return e
}

describe('benchmark JÁ PROMOVIDO e salvo não muda — nem lido, nem exportado, nem reimportado', () => {
  it('sai da leitura exatamente como entrou, com os números ANTIGOS', () => {
    const s = storeCom(PROMOVIDO_ANTIGO)
    const lido = benchmarksDisponiveis(s).find((b) => b.id === PROMOVIDO_ANTIGO.id)
    expect(lido).toEqual(PROMOVIDO_ANTIGO)
    expect(lido.receita).toBe(88000) // a BRUTA da conta velha, preservada
    expect(lido.lucro).toBe(-2500)
  })

  it('não ganha `semReserva` retroativamente — ninguém sabe o que havia dentro dele', () => {
    const s = storeCom(PROMOVIDO_ANTIGO)
    const lido = benchmarksVisiveis(s).find((b) => b.id === PROMOVIDO_ANTIGO.id)
    expect(lido.semReserva).toBeUndefined()
    expect(temSemReserva(lido)).toBe(false)
  })

  it('round-trip de BACKUP JSON: exporta, reimporta e continua idêntico', () => {
    const s = storeCom(PROMOVIDO_ANTIGO)
    const texto = JSON.stringify(montarBackup(s))
    const backup = parseBackup(texto)
    expect(backup.benchmarksCustom).toEqual([PROMOVIDO_ANTIGO])

    // E a volta para um store que NÃO o tinha: o merge por id devolve o objeto
    // inteiro, sem passar por nenhum recálculo.
    const vazio = { ...storeCom(), benchmarksCustom: [] }
    const remontado = mesclarBackup(vazio, backup)
    expect(remontado.benchmarksCustom.find((b) => b.id === PROMOVIDO_ANTIGO.id)).toEqual(
      PROMOVIDO_ANTIGO
    )
  })

  it('promover uma festa NOVA acrescenta — não reescreve o antigo', () => {
    const s = storeCom(PROMOVIDO_ANTIGO)
    const novo = montarBenchmarkDeEvento(eventoFechado())
    const depois = { ...s, benchmarksCustom: [...s.benchmarksCustom, novo] }

    expect(depois.benchmarksCustom).toHaveLength(2)
    expect(depois.benchmarksCustom[0]).toEqual(PROMOVIDO_ANTIGO)
    expect(novo.id).not.toBe(PROMOVIDO_ANTIGO.id)
    // A MESMA festa, pela conta nova, dá outro número — e é justamente por isso
    // que o antigo não pode ser recalculado sozinho: seria o app reescrevendo
    // a régua histórica do Marco pelas costas dele.
    expect(novo.lucro).toBe(20100)
    expect(PROMOVIDO_ANTIGO.lucro).toBe(-2500)
  })
})

// ===========================================================================
// 3. A COMPARAÇÃO com os dois tipos lado a lado
// ===========================================================================
describe('a comparação segue funcionando com embutido, promovido antigo e promovido novo juntos', () => {
  const montar = () => {
    const novo = montarBenchmarkDeEvento(eventoFechado())
    const s = storeCom(PROMOVIDO_ANTIGO, novo)
    return { s, novo }
  }

  it('os três tipos aparecem na mesma lista, na ordem esperada (embutidos primeiro)', () => {
    const { s, novo } = montar()
    const todos = benchmarksDisponiveis(s)
    expect(todos).toHaveLength(FIXED_BENCHMARKS.length + 2)
    expect(todos.slice(0, 4).map((b) => b.id)).toEqual(FIXED_BENCHMARKS.map((b) => b.id))
    expect(todos.slice(4).map((b) => b.id)).toEqual([PROMOVIDO_ANTIGO.id, novo.id])
  })

  it('o /pax das barras (porPessoa) responde para os três, sem quebrar em nenhum', () => {
    const { s, novo } = montar()
    for (const b of benchmarksAtivos({}, s)) {
      const pp = porPessoa(b, b.custoTotal)
      // publico null (Brisa 05/12 e 14/03) → null, não NaN. É a regra de
      // sempre, e ela tem de valer igual para o promovido.
      if (b.publico) expect(pp).toBeCloseTo(b.custoTotal / b.publico, 9)
      else expect(pp).toBeNull()
      expect(Number.isNaN(pp)).toBe(false)
    }
    expect(novo.custoTotal).toBe(64500)
    expect(porPessoa(novo, novo.custoTotal)).toBeCloseTo(64500 / 800, 9)
  })

  it('só o promovido NOVO carrega a etiqueta — é ela que explica a diferença de régua', () => {
    const { s, novo } = montar()
    const comEtiqueta = benchmarksVisiveis(s).filter(temSemReserva)
    expect(comEtiqueta.map((b) => b.id)).toEqual([novo.id])
  })

  it('o detalhe por categoria do promovido fecha com o custo total exibido', () => {
    // As barras por categoria da aba Cenários leem `b.custos[key]`, e a barra
    // de "Custo total" lê `b.custoTotal`. Se as duas leituras discordassem, a
    // tela mostraria um total que as suas próprias partes não somam.
    const { novo } = montar()
    expect(somaCustos(novo.custos)).toBeCloseTo(novo.custoTotal, 6)
    expect(novo.receita - novo.custoTotal).toBeCloseTo(novo.lucro, 6)
    // O ticket NÃO fecha com receita ÷ público, e isso é de propósito desde
    // 24/07/2026 (Marco): o ticket é bilheteria BRUTA ÷ público, a régua dos
    // embutidos, porque receita carrega bar e patrocínio, que não são ingresso.
    // Aqui a festa não tem bar nem patrocínio, então receita = bilheteria
    // LÍQUIDA e o ticket bruto fica ACIMA de receita ÷ público — a distância é
    // exatamente a taxa e o cashback.
    expect(novo.ticketMedio).toBeGreaterThan(novo.receita / novo.publico)
  })
})
