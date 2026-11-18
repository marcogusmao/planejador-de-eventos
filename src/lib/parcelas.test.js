// Sessão F2-C — data de pagamento + parcelamento no custo.
// Regra do Marco (19/07/2026): "parcelamento muda o FLUXO, não o CUSTO" —
// nenhuma fórmula de cenário lê os campos novos (provado byte a byte abaixo,
// padrão das sessões N/O) e a soma das parcelas é TRAVADA ao valor do custo
// (divergiu = aviso, nunca silêncio — divergenciaParcelas é a fonte do aviso).

import { describe, it, expect } from 'vitest'
import {
  temParcelas,
  somaParcelas,
  dividirIgual,
  criarParcelasIguais,
  novaParcela,
  divergenciaParcelas,
  agendaDoItem,
  resumoParcelas,
  resumoQuitacao,
  progressoParcelasPagas,
  realizadoVazio,
  alternarParcelaPaga,
} from './parcelas.js'
import { computeCenarios, valorConsiderado } from './calc.js'
import { migrarEvento } from './migracao.js'
import { parseBackup, montarBackup } from './storage.js'
import { novoItem, novoEvento } from './defaults.js'

// Evento no formato PRÉ-F2-C (sem dataPagamento/parcelas/caixaInicial),
// com o caminho completo de cálculo — mesma base do patrocinio.test.js.
const eventoAntigo = () => ({
  id: 'ev-parc',
  nome: 'Evento Parcelas',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  descontoMedioPct: 12,
  outrasReceitas: { bar: 40000, patrocinio: '' },
  patrocinios: [{ id: 'p1', patrocinador: 'Mirante', valor: 20000, estagio: 'confirmado' }],
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 200 },
    { id: 'porta', nome: 'Porta', valor: 150, quantidade: 60, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesia', valor: 0, quantidade: 50 },
  ],
  categorias: [
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { id: 'i1', servico: 'Insumos', estimado: 12000, realizado: 0, status: 'ORÇAR' },
        { id: 'i2', servico: 'Gelo', estimado: 1500, realizado: 1725.4, status: 'PAGO' },
      ],
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      itens: [
        {
          id: 'i3',
          servico: 'DJ',
          estimado: 9000,
          realizado: '',
          status: 'NEGOCIANDO',
          viaFinanceiro: { categoria: 'Artístico / DJ', valor: 9000, em: '2026-07-01T00:00:00Z' },
        },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

// O MESMO evento antigo com o pessimista já em 80. A migração passou a subir o
// pessimista de 70 para 80 (Marco, 27/07/2026 — decisão A, aprovada por
// questionário com o impacto evento a evento na frente dele), então "migrado
// calcula igual ao cru" deixou de valer nesse único ponto. As provas byte a
// byte abaixo comparam contra ISTO: continuam sendo byte a byte e continuam
// pegando qualquer outro centavo que se mexer.
const eventoAntigoCom80 = () => {
  const e = eventoAntigo()
  return {
    ...e,
    cenariosConfig: { ...e.cenariosConfig, pessimista: { vendaPct: 80, custoPct: 10 } },
  }
}

const itemParcelado = (parcelas, patch = {}) =>
  novoItem({ servico: 'DJ', estimado: 9000, parcelas, ...patch })

describe('dividirIgual — divisão igual, sobra de centavos na última', () => {
  it('R$ 100 em 3× → 33,33 + 33,33 + 33,34 (soma exata)', () => {
    expect(dividirIgual(100, 3)).toEqual([33.33, 33.33, 33.34])
  })
  it('divisão exata não inventa sobra', () => {
    expect(dividirIgual(9000, 3)).toEqual([3000, 3000, 3000])
  })
  it('1 parcela = o valor inteiro; n inválido = nada', () => {
    expect(dividirIgual(1234.56, 1)).toEqual([1234.56])
    expect(dividirIgual(100, 0)).toEqual([])
    expect(dividirIgual(100, -2)).toEqual([])
    expect(dividirIgual(100, 'abc')).toEqual([])
  })
  it('centavos extremos: R$ 0,01 em 3× → 0 + 0 + 0,01', () => {
    expect(dividirIgual(0.01, 3)).toEqual([0, 0, 0.01])
  })
  it('a soma SEMPRE bate com o total (propriedade, casos com dízima)', () => {
    for (const [total, n] of [
      [100, 3],
      [9999.99, 7],
      [1234.56, 12],
      [0.05, 4],
      [8800, 6],
    ]) {
      const soma = dividirIgual(total, n).reduce((s, v) => s + Math.round(v * 100), 0)
      expect(soma, `${total} em ${n}×`).toBe(Math.round(total * 100))
    }
  })
})

describe('criarParcelasIguais', () => {
  it('gera N parcelas com id único e data vazia (o Marco preenche)', () => {
    const ps = criarParcelasIguais(9000, 3)
    expect(ps).toHaveLength(3)
    expect(new Set(ps.map((p) => p.id)).size).toBe(3)
    expect(ps.every((p) => p.data === '')).toBe(true)
    expect(ps.map((p) => p.valor)).toEqual([3000, 3000, 3000])
  })
  it('toda parcela nasce PREVISTA (sugestão 38): paga false, sem data efetiva', () => {
    expect(criarParcelasIguais(9000, 3).every((p) => p.paga === false && p.dataPaga === '')).toBe(true)
    expect(novaParcela()).toMatchObject({ valor: '', data: '', paga: false, dataPaga: '' })
  })
})

describe('soma travada — divergenciaParcelas (a fonte do aviso vermelho)', () => {
  it('sem parcelas: não há o que divergir', () => {
    expect(divergenciaParcelas(novoItem({ estimado: 9000 }))).toBeNull()
    expect(temParcelas(novoItem())).toBe(false)
  })
  it('soma batendo com o estimado: null (sem aviso)', () => {
    const item = itemParcelado(criarParcelasIguais(9000, 3))
    expect(somaParcelas(item)).toBe(9000)
    expect(divergenciaParcelas(item)).toBeNull()
  })
  it('parcela editada para fora da soma → divergência com a diferença exata', () => {
    const item = itemParcelado([
      { id: 'a', valor: 3000, data: '' },
      { id: 'b', valor: 3000, data: '' },
      { id: 'c', valor: 3500, data: '' },
    ])
    expect(divergenciaParcelas(item)).toEqual({ soma: 9500, valor: 9000, diferenca: 500 })
  })
  it('a régua é o valorConsiderado: realizado preenchido muda o valor travado', () => {
    // Parcelas somam o estimado (9000), mas o realizado chegou em 8800 —
    // o app considera 8800 (regra de sempre) e o aviso aparece.
    const item = itemParcelado(criarParcelasIguais(9000, 3), { realizado: 8800 })
    const d = divergenciaParcelas(item)
    expect(d.valor).toBe(8800)
    expect(d.soma).toBe(9000)
    expect(d.diferenca).toBeCloseTo(200, 10)
  })
  it('meio centavo de float não vira falso alarme', () => {
    const item = itemParcelado([
      { id: 'a', valor: 33.33, data: '' },
      { id: 'b', valor: 33.33, data: '' },
      { id: 'c', valor: 33.34, data: '' },
    ], { estimado: 100 })
    expect(divergenciaParcelas(item)).toBeNull()
  })
})

describe('agendaDoItem — a leitura única da Análise e dos exports', () => {
  it('com parcelas: uma entrada por parcela, com k/N na ordem da lista', () => {
    const agenda = agendaDoItem(
      itemParcelado([
        { id: 'a', valor: 3000, data: '2026-08-05' },
        { id: 'b', valor: 3000, data: '' },
        { id: 'c', valor: 3000, data: '2026-10-05' },
      ])
    )
    expect(agenda).toEqual([
      { valor: 3000, data: '2026-08-05', parcela: { k: 1, n: 3 }, paga: false, dataPaga: '' },
      { valor: 3000, data: '', parcela: { k: 2, n: 3 }, paga: false, dataPaga: '' },
      { valor: 3000, data: '2026-10-05', parcela: { k: 3, n: 3 }, paga: false, dataPaga: '' },
    ])
  })
  it('sem parcelas: uma entrada com o valorConsiderado e a dataPagamento', () => {
    expect(agendaDoItem(novoItem({ estimado: 5000, dataPagamento: '2026-08-01' }))).toEqual([
      { valor: 5000, data: '2026-08-01', parcela: null, paga: false, dataPaga: '' },
    ])
    // realizado preenchido vence o estimado — a régua de sempre
    expect(
      agendaDoItem(novoItem({ estimado: 5000, realizado: 4800, dataPagamento: '' }))
    ).toEqual([{ valor: 4800, data: '', parcela: null, paga: false, dataPaga: '' }])
  })
  it('parcela paga sai com paga: true e a dataPaga dela (sugestão 38)', () => {
    const agenda = agendaDoItem(
      itemParcelado([
        { id: 'a', valor: 3000, data: '2026-08-05', paga: true, dataPaga: '2026-08-03' },
        { id: 'b', valor: 6000, data: '2026-09-05', paga: false, dataPaga: '' },
      ])
    )
    expect(agenda[0]).toMatchObject({ paga: true, dataPaga: '2026-08-03' })
    expect(agenda[1]).toMatchObject({ paga: false, dataPaga: '' })
    // paga é ESTRITO: 'true' (string), 1, 'sim' não quitam — e dataPaga só
    // acompanha parcela de fato paga (quitar melhora o caixa; nada torto quita)
    const torta = agendaDoItem(
      itemParcelado([
        { id: 'x', valor: 3000, data: '', paga: 'true', dataPaga: '2026-08-03' },
        { id: 'y', valor: 3000, data: '', paga: 1, dataPaga: '2026-08-03' },
      ])
    )
    expect(torta.every((p) => p.paga === false && p.dataPaga === '')).toBe(true)
  })
})

describe('resumoQuitacao — "R$ 1.200 pagos de R$ 4.000 · 1 em aberto" (sugestão 38)', () => {
  it('null sem parcelas ou sem nenhuma paga (nada a dizer)', () => {
    expect(resumoQuitacao(novoItem({ estimado: 4000, dataPagamento: '2026-08-01' }))).toBeNull()
    expect(resumoQuitacao(itemParcelado(criarParcelasIguais(4000, 3)))).toBeNull()
  })
  it('a leitura do exemplo da spec: R$ 1.200 pagos de R$ 4.000 · 1 em aberto', () => {
    const item = novoItem({
      servico: 'Som',
      estimado: 4000,
      parcelas: [
        { id: 'a', valor: 1200, data: '2026-08-05', paga: true, dataPaga: '2026-08-05' },
        { id: 'b', valor: 2800, data: '2026-09-05', paga: false, dataPaga: '' },
      ],
    })
    expect(resumoQuitacao(item)).toEqual({
      qtdPagas: 1,
      valorPago: 1200,
      emAberto: 1,
      valorCusto: 4000,
    })
  })
  it('todas pagas: emAberto 0; e o "de R$ X" segue o valorConsiderado (realizado vence)', () => {
    const item = novoItem({
      estimado: 4000,
      realizado: 3800,
      parcelas: [
        { id: 'a', valor: 2000, data: '', paga: true, dataPaga: '2026-08-01' },
        { id: 'b', valor: 1800, data: '', paga: true, dataPaga: '2026-08-20' },
      ],
    })
    expect(resumoQuitacao(item)).toEqual({
      qtdPagas: 2,
      valorPago: 3800,
      emAberto: 0,
      valorCusto: 3800,
    })
  })
  it('marcar paga NÃO mexe na soma travada: divergência aparece igual', () => {
    const item = itemParcelado([
      { id: 'a', valor: 3000, data: '', paga: true, dataPaga: '2026-08-01' },
      { id: 'b', valor: 3000, data: '', paga: false, dataPaga: '' },
      { id: 'c', valor: 3500, data: '', paga: false, dataPaga: '' },
    ])
    expect(divergenciaParcelas(item)).toEqual({ soma: 9500, valor: 9000, diferenca: 500 })
  })
})

describe('resumoParcelas — célula da tabela de custos', () => {
  it('resume quantidade e intervalo de datas', () => {
    expect(
      resumoParcelas(
        itemParcelado([
          { id: 'a', valor: 3000, data: '2026-08-05' },
          { id: 'b', valor: 3000, data: '2026-10-05' },
          { id: 'c', valor: 3000, data: '2026-09-05' },
        ])
      )
    ).toBe('3× · 05/08–05/10')
    expect(resumoParcelas(itemParcelado([{ id: 'a', valor: 1, data: '' }]))).toBe('1× sem datas')
    expect(resumoParcelas(novoItem())).toBeNull()
  })
})

describe('FÓRMULAS INTOCADAS — parcelas são fluxo, não custo (prova byte a byte)', () => {
  it('evento PRÉ-F2-C: cenários idênticos byte a byte antes × depois da migração', () => {
    const antes = JSON.stringify(computeCenarios(eventoAntigoCom80()))
    const depois = JSON.stringify(computeCenarios(migrarEvento(eventoAntigo())))
    expect(depois).toBe(antes)
  })
  it('parcelar um custo NÃO muda um centavo de nenhum cenário', () => {
    const sem = eventoAntigo()
    const com = eventoAntigo()
    com.categorias[1].itens[0].dataPagamento = '2026-08-01'
    com.categorias[1].itens[0].parcelas = criarParcelasIguais(9000, 3)
    com.caixaInicial = 15000
    expect(JSON.stringify(computeCenarios(com))).toBe(JSON.stringify(computeCenarios(sem)))
  })
  it('até parcelas DIVERGENTES não tocam os cenários (o aviso é da tela, a conta é do Marco)', () => {
    const sem = eventoAntigo()
    const com = eventoAntigo()
    com.categorias[0].itens[0].parcelas = [{ id: 'x', valor: 999999, data: '2026-01-01' }]
    expect(JSON.stringify(computeCenarios(com))).toBe(JSON.stringify(computeCenarios(sem)))
  })
  it('marcar parcela PAGA não muda um centavo de cenário — e o realizado fica INTOCADO (sugestão 38)', () => {
    const sem = eventoAntigo()
    const com = eventoAntigo()
    com.categorias[1].itens[0].parcelas = [
      { id: 'a', valor: 4500, data: '2026-08-01', paga: true, dataPaga: '2026-07-30' },
      { id: 'b', valor: 4500, data: '2026-09-01', paga: false, dataPaga: '' },
    ]
    expect(JSON.stringify(computeCenarios(com))).toBe(JSON.stringify(computeCenarios(sem)))
    // Mexer nas parcelas pela migração/dados NÃO preenche o realizado — o
    // preenchimento automático é do HANDLER (ver bloco da Decisão 22/07 abaixo),
    // e aqui só 1 de 2 parcelas está paga.
    expect(com.categorias[1].itens[0].realizado).toBe(sem.categorias[1].itens[0].realizado)
  })
})

// Decisão do Marco (22/07/2026) — "progresso auto + grava no fim". Parcela paga
// deixa de ser 100% desacoplada do realizado: enquanto faltam parcelas a célula
// Realizado mostra só o PROGRESSO (nada gravado, o custo previsto NÃO cai); ao
// pagar a ÚLTIMA, grava realizado = soma REAL das parcelas; desmarcar essa
// gravação automática limpa de volta. Um realizado digitado à mão VENCE.
describe('parcela paga → Realizado (Decisão 22/07/2026): progresso auto + grava no fim', () => {
  const apply = (item, patch) => ({ ...item, ...patch })
  const tresParcelas = (patch = {}) =>
    novoItem({
      servico: 'DJ',
      estimado: 45000,
      realizado: '',
      parcelas: [
        { id: 'a', valor: 15000, data: '2026-08-01', paga: false, dataPaga: '' },
        { id: 'b', valor: 15000, data: '2026-09-01', paga: false, dataPaga: '' },
        { id: 'c', valor: 15000, data: '2026-10-01', paga: false, dataPaga: '' },
      ],
      ...patch,
    })

  it('realizadoVazio: só "" / null / ausente; um 0 é valor do dono e NÃO é vazio', () => {
    expect(realizadoVazio({ realizado: '' })).toBe(true)
    expect(realizadoVazio({ realizado: null })).toBe(true)
    expect(realizadoVazio({})).toBe(true)
    expect(realizadoVazio({ realizado: 0 })).toBe(false)
    expect(realizadoVazio({ realizado: 45000 })).toBe(false)
  })

  it('progressoParcelasPagas: soma das pagas + contagem (display-only); null sem parcelas', () => {
    let item = tresParcelas()
    expect(progressoParcelasPagas(item)).toEqual({ valorPago: 0, qtdPagas: 0, n: 3 })
    item = apply(item, alternarParcelaPaga(item, 'a', true, '2026-08-01').patch)
    expect(progressoParcelasPagas(item)).toEqual({ valorPago: 15000, qtdPagas: 1, n: 3 })
    expect(progressoParcelasPagas(novoItem())).toBeNull()
  })

  it('RED→GREEN: pagar 1ª NÃO grava e o custo previsto NÃO cai; a 3ª grava; desmarcar volta', () => {
    let item = tresParcelas()
    expect(valorConsiderado(item)).toBe(45000) // parte do estimado (realizado vazio)

    // pagar a 1ª: nada gravado, valorConsiderado intacto (o coração do desenho)
    let r = alternarParcelaPaga(item, 'a', true, '2026-08-01')
    expect(r.patch.realizado).toBeUndefined()
    expect(r.efeito).toBeNull()
    item = apply(item, r.patch)
    expect(item.realizado).toBe('')
    expect(valorConsiderado(item)).toBe(45000)

    // pagar a 2ª: idem
    item = apply(item, alternarParcelaPaga(item, 'b', true, '2026-09-01').patch)
    expect(item.realizado).toBe('')
    expect(valorConsiderado(item)).toBe(45000)

    // pagar a 3ª (última): grava realizado = soma REAL das parcelas, marca a
    // gravação como AUTOMÁTICA (realizadoAuto=true — lote de travas 23/07/2026)
    // + efeito p/ toast
    r = alternarParcelaPaga(item, 'c', true, '2026-10-01')
    expect(r.patch.realizado).toBe(45000)
    expect(r.patch.realizadoAuto).toBe(true)
    expect(r.efeito).toEqual({ tipo: 'gravou', valor: 45000, n: 3 })
    item = apply(item, r.patch)
    expect(item.realizado).toBe(45000)
    expect(item.realizadoAuto).toBe(true)
    expect(valorConsiderado(item)).toBe(45000)

    // desmarcar a 3ª: a gravação foi AUTOMÁTICA (realizadoAuto=true) → limpa de
    // volta para '' e zera a flag junto (simétrico). Já NÃO é a heurística
    // "realizado == soma": é a flag que autoriza a limpeza.
    r = alternarParcelaPaga(item, 'c', false)
    expect(r.patch.realizado).toBe('')
    expect(r.patch.realizadoAuto).toBe(false)
    expect(r.efeito).toEqual({ tipo: 'limpou' })
    item = apply(item, r.patch)
    expect(item.realizado).toBe('')
    expect(item.realizadoAuto).toBe(false)
    expect(valorConsiderado(item)).toBe(45000)
  })

  it('manual VENCE: realizado 40000 digitado + parcelas → pagar todas NÃO sobrescreve; desmarcar NÃO limpa', () => {
    let item = tresParcelas({ realizado: 40000 })
    expect(valorConsiderado(item)).toBe(40000)
    item = apply(item, alternarParcelaPaga(item, 'a', true, 'x').patch)
    item = apply(item, alternarParcelaPaga(item, 'b', true, 'x').patch)
    const r = alternarParcelaPaga(item, 'c', true, 'x') // última paga
    expect(r.patch.realizado).toBeUndefined() // manual não é tocado
    expect(r.efeito).toBeNull()
    item = apply(item, r.patch)
    expect(item.realizado).toBe(40000)
    expect(valorConsiderado(item)).toBe(40000)
    // desmarcar: 40000 != soma 45000 → não limpa
    const d = alternarParcelaPaga(item, 'c', false)
    expect(d.patch.realizado).toBeUndefined()
    expect(apply(item, d.patch).realizado).toBe(40000)
  })

  // A pré-condição RARA que a heurística por valor não distinguia (lente
  // adversarial 22/07, BACKLOG "Desmarcar parcela pode apagar um Realizado
  // MANUAL"): o manual COINCIDE ao centavo com a soma. Antes, desmarcar via a
  // heurística "realizado == soma" APAGAVA o manual (45000 == 45000). Agora o
  // manual não tem realizadoAuto, então NUNCA é apagado.
  it('RED→GREEN (lote de travas, Marco 23/07/2026): manual que COINCIDE com a soma NUNCA é apagado', () => {
    // estimado 50.000, manual 45.000, parcelas 3×15.000 (soma 45.000, coincidência)
    let item = tresParcelas({ estimado: 50000, realizado: 45000 })
    expect(valorConsiderado(item)).toBe(45000) // realizado manual vence o estimado
    // o Marco quita as 3 parcelas — mas o realizado foi DIGITADO à mão, não gravado
    item = apply(item, alternarParcelaPaga(item, 'a', true, 'x').patch)
    item = apply(item, alternarParcelaPaga(item, 'b', true, 'x').patch)
    const marc = alternarParcelaPaga(item, 'c', true, 'x')
    expect(marc.patch.realizado).toBeUndefined() // manual não é sobrescrito
    expect(marc.patch.realizadoAuto).toBeUndefined() // NEM a flag é ligada
    item = apply(item, marc.patch)
    expect(item.realizado).toBe(45000)
    expect(item.realizadoAuto).toBe(false) // nunca marcado auto (novoItem nasce false)
    // desmarcar uma: sob a heurística ANTIGA (45000 == soma 45000) LIMPARIA — o
    // bug. Com a flag (realizadoAuto=false), o manual é PRESERVADO.
    const d = alternarParcelaPaga(item, 'c', false)
    expect(d.patch.realizado).toBeUndefined() // NÃO limpa
    expect(d.patch.realizadoAuto).toBeUndefined()
    expect(d.efeito).toBeNull()
    expect(apply(item, d.patch).realizado).toBe(45000) // o manual 45.000 continua lá
  })

  it('aditivo: item ANTIGO (sem realizadoAuto) trata flag ausente como false — não limpa por engano', () => {
    // backup pré-lote: o item chega SEM a chave realizadoAuto. Uma gravação
    // automática só existe com a flag true; ausente = manual/indefinido = nunca
    // apaga no desmarcar.
    const antigo = {
      parcelas: [
        { id: 'a', valor: 15000, paga: true, dataPaga: 'x' },
        { id: 'b', valor: 15000, paga: true, dataPaga: 'x' },
        { id: 'c', valor: 15000, paga: true, dataPaga: 'x' },
      ],
      realizado: 45000, // coincide com a soma, mas SEM a flag
    }
    expect(antigo.realizadoAuto).toBeUndefined()
    const d = alternarParcelaPaga(antigo, 'c', false)
    expect(d.patch.realizado).toBeUndefined() // preservado
    expect(d.efeito).toBeNull()
  })

  it('marcar paga guarda a dataPaga (padrão hoje); desmarcar zera paga e dataPaga', () => {
    const item = tresParcelas()
    const marc = alternarParcelaPaga(item, 'a', true, '2026-08-05')
    const pa = marc.patch.parcelas.find((p) => p.id === 'a')
    expect(pa.paga).toBe(true)
    expect(pa.dataPaga).toBe('2026-08-05')
    const desm = alternarParcelaPaga(apply(item, marc.patch), 'a', false)
    const pa2 = desm.patch.parcelas.find((p) => p.id === 'a')
    expect(pa2.paga).toBe(false)
    expect(pa2.dataPaga).toBe('')
  })
})

describe('migração leve — forma dos campos novos', () => {
  it('evento sem os campos ganha dataPagamento \'\', parcelas [] e caixaInicial \'\'', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.caixaInicial).toBe('')
    for (const c of m.categorias)
      for (const i of c.itens) {
        expect(i.dataPagamento).toBe('')
        expect(i.parcelas).toEqual([])
      }
  })
  it('campos extras do item (viaFinanceiro) passam intocados', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.categorias[1].itens[0].viaFinanceiro).toEqual({
      categoria: 'Artístico / DJ',
      valor: 9000,
      em: '2026-07-01T00:00:00Z',
    })
  })
  it('realizadoAuto é ADITIVO (lote de travas, item 4): ausente → false; true preservado; estrito', () => {
    // backup antigo (sem a chave) → o item ganha realizadoAuto:false (aditiva,
    // princípio 2 — schema é contrato, backup antigo continua importando).
    const m = migrarEvento(eventoAntigo())
    for (const c of m.categorias) for (const i of c.itens) expect(i.realizadoAuto).toBe(false)
    // uma gravação automática salva (true) faz round-trip preservando true.
    const e = eventoAntigo()
    e.categorias[0].itens[0].realizadoAuto = true
    expect(migrarEvento(e).categorias[0].itens[0].realizadoAuto).toBe(true)
    // ESTRITO: lixo ('sim', 1, {}) nunca vira true.
    const lixo = eventoAntigo()
    lixo.categorias[0].itens[0].realizadoAuto = 'sim'
    lixo.categorias[0].itens[1] = { ...lixo.categorias[0].itens[1], realizadoAuto: 1 }
    const mi = migrarEvento(lixo)
    expect(mi.categorias[0].itens[0].realizadoAuto).toBe(false)
    expect(mi.categorias[0].itens[1].realizadoAuto).toBe(false)
  })
  it('normaliza tortos: parcela lixo é descartada, data inválida vira \'\', valor não-numérico vira \'\'', () => {
    const e = eventoAntigo()
    e.categorias[0].itens[0].dataPagamento = '05/08/2026' // formato errado
    e.categorias[0].itens[0].parcelas = [
      { id: 'ok', valor: 3000, data: '2026-08-05' },
      'lixo',
      { valor: '1500.5', data: 'amanhã' },
      { id: 'v', valor: 'abc', data: '2026-09-01' },
      null,
    ]
    e.caixaInicial = { valor: 10 }
    const m = migrarEvento(e)
    const item = m.categorias[0].itens[0]
    expect(item.dataPagamento).toBe('')
    expect(item.parcelas).toHaveLength(3)
    expect(item.parcelas[0]).toEqual({ id: 'ok', valor: 3000, data: '2026-08-05', paga: false, dataPaga: '' })
    expect(item.parcelas[1].valor).toBe('1500.5') // string numérica preservada
    expect(item.parcelas[1].data).toBe('')
    expect(item.parcelas[1].id).toBeTruthy()
    expect(item.parcelas[2]).toMatchObject({ id: 'v', valor: '', data: '2026-09-01' })
    expect(m.caixaInicial).toBe('')
  })
  it('migração de paga é ESTRITA (sugestão 38): só o booleano true quita; dataPaga ISO ou \'\'', () => {
    const e = eventoAntigo()
    e.categorias[0].itens[0].parcelas = [
      { id: 'a', valor: 100, data: '', paga: true, dataPaga: '2026-08-01' }, // quitada de verdade
      { id: 'b', valor: 100, data: '', paga: 'true', dataPaga: '2026-08-01' }, // string NÃO quita
      { id: 'c', valor: 100, data: '', paga: 1, dataPaga: '01/08/2026' }, // número NÃO quita; data BR vira ''
      { id: 'd', valor: 100, data: '' }, // sem o campo = prevista
    ]
    const ps = migrarEvento(e).categorias[0].itens[0].parcelas
    expect(ps.map((p) => p.paga)).toEqual([true, false, false, false])
    expect(ps.map((p) => p.dataPaga)).toEqual(['2026-08-01', '2026-08-01', '', ''])
  })
  it('valores válidos passam como vieram (número e string numérica)', () => {
    const e = eventoAntigo()
    e.caixaInicial = '2500.75'
    e.categorias[0].itens[0].dataPagamento = '2026-08-15'
    e.categorias[0].itens[0].parcelas = criarParcelasIguais(12000, 2)
    const m = migrarEvento(e)
    expect(m.caixaInicial).toBe('2500.75')
    expect(m.categorias[0].itens[0].dataPagamento).toBe('2026-08-15')
    expect(m.categorias[0].itens[0].parcelas.map((p) => p.valor)).toEqual([6000, 6000])
  })
  it('é idempotente: migrar duas vezes = migrar uma vez', () => {
    const e = eventoAntigo()
    e.categorias[0].itens[0].parcelas = criarParcelasIguais(12000, 3)
    e.caixaInicial = 5000
    const uma = migrarEvento(e)
    expect(migrarEvento(uma)).toEqual(uma)
  })
  it('evento novo já nasce com a forma completa', () => {
    const e = novoEvento('Teste')
    expect(e.caixaInicial).toBe('')
    expect(migrarEvento(e)).toEqual(e)
  })
})

describe('round-trip de backup antigo (formato pré-F2-C)', () => {
  it('importa, preserva os números e sobrevive a export→import de novo', () => {
    const backupAntigo = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [eventoAntigo()],
      benchmarksCustom: [],
    })
    const antes = JSON.stringify(computeCenarios(eventoAntigoCom80()))
    const store1 = parseBackup(backupAntigo)
    expect(JSON.stringify(computeCenarios(store1.eventos[0]))).toBe(antes)
    // export (mesma forma do exportBackup) → import de novo
    const reexport = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: store1.eventos,
      benchmarksCustom: [],
    })
    const store2 = parseBackup(reexport)
    expect(store2.eventos[0]).toEqual(store1.eventos[0])
    expect(JSON.stringify(computeCenarios(store2.eventos[0]))).toBe(antes)
  })
  it('backup NOVO (com parcelas, uma PAGA) faz round-trip sem perder uma parcela nem a quitação', () => {
    const e = migrarEvento(eventoAntigo())
    e.categorias[1].itens[0].dataPagamento = '2026-08-01'
    e.categorias[1].itens[0].parcelas = [
      { id: 'pa', valor: 4500, data: '2026-08-01', paga: true, dataPaga: '2026-07-28' },
      { id: 'pb', valor: 4500, data: '2026-09-01', paga: false, dataPaga: '' },
    ]
    e.caixaInicial = 15000
    const backup = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [e], benchmarksCustom: [] })
    const store = parseBackup(backup)
    expect(store.eventos[0]).toEqual(e)
  })
  it('realizadoAuto (lote de travas, item 4): export carrega o campo; backup SEM ele importa como false', () => {
    // export→import: uma gravação automática (realizadoAuto:true) sobrevive ao
    // montarBackup + parseBackup (o schema é contrato).
    const e = migrarEvento(eventoAntigo())
    e.categorias[0].itens[0].realizado = 30000
    e.categorias[0].itens[0].realizadoAuto = true
    const store = { eventos: [e], benchmarksCustom: [] }
    const arquivo = JSON.stringify(montarBackup(store))
    expect(arquivo).toContain('"realizadoAuto":true') // o export CARREGA o campo
    const lido = parseBackup(arquivo)
    expect(lido.eventos[0].categorias[0].itens[0].realizadoAuto).toBe(true)
    // backup ANTIGO (item sem a chave) importa com realizadoAuto:false — aditiva.
    const legado = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [
        {
          id: 'ev-legado',
          nome: 'Legado',
          categorias: [{ id: 'c', nome: 'C', itens: [{ id: 'i', servico: 'X', estimado: 1000 }] }],
        },
      ],
      benchmarksCustom: [],
    })
    expect(parseBackup(legado).eventos[0].categorias[0].itens[0].realizadoAuto).toBe(false)
  })
})
