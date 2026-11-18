// TRAVA DO NEGATIVO — evidência e especificação (decisão do Marco, 22/07/2026,
// via orquestrador). Irmã da percentuaisForaDaFaixa.evidencia.test.js.
//
// A decisão, em uma linha: campos de DINHEIRO e QUANTIDADE (custo estimado/
// realizado, preço de lote, quantidade de ingressos, patrocínio) vivem em ≥ 0;
// os AJUSTES DE CENÁRIO (vendaPct/custoPct/ticketPct de cenariosConfig e das
// premissas) vivem em −50..100. A trava é NA PORTA — o campo recusa com aviso
// (ui.jsx, prop `faixa`), a migração descarta o herdado absurdo (→ '' = "não
// informado") e a planilha do produtor RECUSA a linha na revisão. O parser
// contábil segue INTOCADO: `(500)` continua sendo −500; a recusa acontece na
// camada onde o negativo não faz sentido. calc.js/golden intocados: o primeiro
// bloco fotografa que a conta computa o que recebe (por isso a porta recusa).

import { describe, expect, it } from 'vitest'
import { computeCenario } from './calc.js'
import { migrarEvento } from './migracao.js'
import { formaAjustes } from './premissas.js'
import { reconciliar } from './xlsxReconciliar.js'
import { SENTINELA_V2 } from './orcamentoV2Contrato.js'
import {
  parseCampoNumerico,
  foraDaFaixa,
  FAIXA_CUSTO,
  FAIXA_QUANTIDADE,
  FAIXA_PRECO,
  FAIXA_PATROCINIO,
  FAIXA_CENARIO,
} from './campoNumerico.js'
import { novoEvento, novoItem, novoLote } from './defaults.js'

// Evento legível: 1 lote 100 × 100 ingressos, 1 custo (DJ 5.000), sem taxa/
// cashback/cupom/contingência. `estimadoExtra` injeta um 2º item — o "estorno"
// negativo do ataque. Base em novoEvento() para o evento ficar bem-formado.
function ev({ estimadoExtra } = {}) {
  const e = novoEvento('Trava do negativo')
  e.taxaBilheteria = 0
  e.cashbackPct = 0
  e.contingenciaPct = 0
  e.lotes = [novoLote({ id: 'l1', nome: 'Único', valor: 100, quantidade: 100 })]
  e.categorias = [
    {
      id: 'atracoes',
      nome: 'Atrações',
      itens: [
        novoItem({ id: 'dj', servico: 'DJ', estimado: 5000 }),
        ...(estimadoExtra != null
          ? [novoItem({ id: 'x', servico: 'Estorno', estimado: estimadoExtra })]
          : []),
      ],
    },
  ]
  return e
}

describe('calc.js intocado — a conta computa o que recebe (a trava é na porta)', () => {
  it('RED: um item de custo −1.000 INFLA o lucro em R$ 1.000 (por isso a porta recusa)', () => {
    const sa = computeCenario(ev(), 'realista')
    const atacado = computeCenario(ev({ estimadoExtra: -1000 }), 'realista')
    expect(atacado.custoTotal).toBeCloseTo(sa.custoTotal - 1000, 6)
    expect(atacado.lucro).toBeCloseTo(sa.lucro + 1000, 6) // lucro inflado
  })
})

describe('o cadeado da migração — dinheiro/quantidade < 0 vira "não informado"', () => {
  it('GREEN: estimado −1.000 vira "" na migração → o lucro volta ao certo', () => {
    const migrado = migrarEvento(ev({ estimadoExtra: -1000 }))
    const item = migrado.categorias[0].itens.find((i) => i.id === 'x')
    expect(item.estimado).toBe('')
    expect(computeCenario(migrado, 'realista').lucro).toBeCloseTo(
      computeCenario(ev(), 'realista').lucro,
      6
    )
  })

  it('custo estimado e realizado negativos herdados viram ""', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      categorias: [{ id: 'c', nome: 'C', itens: [{ id: 'i', estimado: -1000, realizado: -200 }] }],
    })
    expect(m.categorias[0].itens[0].estimado).toBe('')
    expect(m.categorias[0].itens[0].realizado).toBe('')
  })

  it('quantidade de ingressos −10 e preço de lote negativo viram ""', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      lotes: [{ id: 'l1', nome: 'Único', valor: -100, quantidade: -10 }],
    })
    expect(m.lotes[0].valor).toBe('')
    expect(m.lotes[0].quantidade).toBe('')
  })

  it('patrocínio negativo (na lista e no campo solto antigo) vira "" / não vira item', () => {
    const lista = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      patrocinios: [{ id: 'p', patrocinador: 'X', valor: -6000, estagio: 'confirmado' }],
    })
    expect(lista.patrocinios[0].valor).toBe('')
    const solto = migrarEvento({ id: 'e2', nome: 'Teste', outrasReceitas: { patrocinio: -6000 } })
    expect(solto.patrocinios).toEqual([])
  })

  it('valores VÁLIDOS passam byte a byte — 0 (cortesia/permuta), "" e positivos', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      lotes: [{ id: 'l1', valor: 0, quantidade: 250 }],
      categorias: [{ id: 'c', nome: 'C', itens: [{ id: 'i', estimado: 5000, realizado: '' }] }],
      patrocinios: [{ id: 'p', patrocinador: 'X', valor: 3000, estagio: 'confirmado' }],
    })
    expect(m.lotes[0].valor).toBe(0) // cortesia continua sendo R$ 0
    expect(m.lotes[0].quantidade).toBe(250)
    expect(m.categorias[0].itens[0].estimado).toBe(5000)
    expect(m.categorias[0].itens[0].realizado).toBe('')
    expect(m.patrocinios[0].valor).toBe(3000)
  })
})

describe('o cadeado da migração — ajuste de cenário fora da faixa REMOVE a chave', () => {
  // Decisão 3b-anexo (Marco, 22/07/2026): fora da faixa a migração de EVENTO
  // agora faz delete da chave (não grava ''), para "não informado" cair no
  // fallback documentado do calc (o '' PRESENTE virava 0 e ZERAVA o cenário).
  // Ver vendaPctEcensoImport.evidencia.test.js para a régua completa.
  it('cenariosConfig.custoPct −200 (achado de 20/07) → chave REMOVIDA; o −5 do otimista FICA', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      cenariosConfig: {
        pessimista: { vendaPct: 70, custoPct: -200, ticketPct: 0 },
        realista: { vendaPct: 90, custoPct: 0, ticketPct: 0 },
        otimista: { vendaPct: 100, custoPct: -5, ticketPct: 0 },
      },
    })
    expect('custoPct' in m.cenariosConfig.pessimista).toBe(false) // −200 fora → removida
    expect(m.cenariosConfig.otimista.custoPct).toBe(-5) // −5 é de propósito, fica
    expect(m.cenariosConfig.realista.vendaPct).toBe(90) // válido, byte a byte
  })

  it('overrides por lote e ticketMedio de cenariosConfig passam INTOCADOS', () => {
    const m = migrarEvento({
      id: 'e1',
      nome: 'Teste',
      cenariosConfig: {
        realista: { vendaPct: 90, custoPct: 0, ticketMedio: 137 },
        overrides: { realista: { l1: 250 } },
      },
    })
    expect(m.cenariosConfig.realista.ticketMedio).toBe(137)
    expect(m.cenariosConfig.overrides).toEqual({ realista: { l1: 250 } })
  })
})

describe('premissas (ajustes gerais) — grade de cenário fora de −50..100 vira ""', () => {
  it('custoPct −200 na premissa vira "" (= herda); custoPct −5 e vendaPct 90 ficam', () => {
    const a = formaAjustes({
      geral: {
        cenarios: {
          pessimista: { vendaPct: 70, custoPct: -200, ticketPct: 0 },
          realista: { vendaPct: 90, custoPct: 0, ticketPct: 0 },
          otimista: { vendaPct: 100, custoPct: -5, ticketPct: 0 },
        },
      },
    })
    expect(a.geral.cenarios.pessimista.custoPct).toBe('')
    expect(a.geral.cenarios.otimista.custoPct).toBe(-5)
    expect(a.geral.cenarios.realista.vendaPct).toBe(90)
  })
})

describe('a planilha do produtor — custo negativo na reimportação é RECUSADO', () => {
  const parsedCom = (estimado) => ({
    sentinela: SENTINELA_V2,
    eventoId: 'e1',
    projeto: 'Brisa',
    secoes: [
      {
        titulo: 'Atrações',
        itens: [
          { id: 'dj', servico: 'DJ', fornecedor: '', estimado, status: '', dataPgto: '', pagamento: '', obs: '', linha: 11 },
        ],
      },
    ],
  })
  const evento = {
    id: 'e1',
    nome: 'Brisa 14/03',
    tipo: 'Brisa',
    categorias: [
      { id: 'c1', nome: 'Atrações', itens: [{ id: 'dj', servico: 'DJ', fornecedor: '', estimado: 4000, status: 'ESTIMADO' }] },
    ],
  }

  it('célula "(500)" (contábil = −500) → linha RECUSADA com motivo, e NÃO vira atualização', () => {
    const plano = reconciliar(parsedCom('(500)'), evento)
    expect(plano.recusadas).toHaveLength(1)
    expect(plano.recusadas[0]).toMatchObject({ linha: 11, servico: 'DJ', valor: -500 })
    expect(plano.recusadas[0].motivo).toMatch(/negativ/i)
    expect(plano.atualizacoes).toHaveLength(0)
  })

  it('o item casado por id fica PROTEGIDO — a linha recusada não o remove', () => {
    const plano = reconciliar(parsedCom('-500'), evento)
    expect(plano.recusadas).toHaveLength(1)
    expect(plano.remocoes).toHaveLength(0)
  })

  it('estimado POSITIVO na mesma porta segue normal (vira atualização, sem recusa)', () => {
    const plano = reconciliar(parsedCom('4500'), evento)
    expect(plano.recusadas).toHaveLength(0)
    expect(plano.atualizacoes[0].campos.estimado.para).toBe(4500)
  })
})

describe('a trava é na PORTA — o parser contábil segue intocado', () => {
  it('"(500)" continua devolvendo −500 no parser; a faixa é que recusa', () => {
    const r = parseCampoNumerico('(500)')
    expect(r.valido).toBe(true)
    expect(r.valor).toBe(-500)
    expect(foraDaFaixa(-500, FAIXA_CUSTO)).toBe(true) // recusa no campo de custo
  })

  it('cada faixa recusa o negativo indevido e aceita o legítimo', () => {
    expect(foraDaFaixa(-1000, FAIXA_CUSTO)).toBe(true)
    expect(foraDaFaixa(-10, FAIXA_QUANTIDADE)).toBe(true)
    expect(foraDaFaixa(-100, FAIXA_PRECO)).toBe(true)
    expect(foraDaFaixa(-6000, FAIXA_PATROCINIO)).toBe(true)
    // dinheiro/quantidade: 0 e positivos passam
    for (const f of [FAIXA_CUSTO, FAIXA_QUANTIDADE, FAIXA_PRECO, FAIXA_PATROCINIO]) {
      expect(foraDaFaixa(0, f)).toBe(false)
      expect(foraDaFaixa(999999, f)).toBe(false)
    }
    // ajuste de cenário: −50..100 (o −5 do otimista passa; −60 e 150 recusam)
    expect(foraDaFaixa(-5, FAIXA_CENARIO)).toBe(false)
    expect(foraDaFaixa(-50, FAIXA_CENARIO)).toBe(false)
    expect(foraDaFaixa(100, FAIXA_CENARIO)).toBe(false)
    expect(foraDaFaixa(-60, FAIXA_CENARIO)).toBe(true)
    expect(foraDaFaixa(150, FAIXA_CENARIO)).toBe(true)
  })

  it('os avisos das faixas falam português e ENSINAM', () => {
    expect(FAIXA_CUSTO.aviso).toMatch(/não pode ser negativo/i)
    expect(FAIXA_QUANTIDADE.aviso).toMatch(/não pode ser negativa/i)
    expect(FAIXA_CENARIO.aviso).toMatch(/−50.*100/)
  })
})

describe('round-trip — backup antigo (schema velho, sem as chaves novas) ainda importa', () => {
  it('migra sem erro, preserva os números válidos e é idempotente', () => {
    const antigo = {
      id: 'e1',
      nome: 'Brisa antigo',
      lotes: [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 250 }],
      categorias: [{ id: 'c', nome: 'Atrações', itens: [{ id: 'i', servico: 'DJ', estimado: 8000 }] }],
      cenariosConfig: { realista: { vendaPct: 90, custoPct: 0 } },
      outrasReceitas: { patrocinio: 5000 },
    }
    const uma = migrarEvento(JSON.parse(JSON.stringify(antigo)))
    // números válidos intactos
    expect(uma.lotes[0].valor).toBe(100)
    expect(uma.lotes[0].quantidade).toBe(250)
    expect(uma.categorias[0].itens[0].estimado).toBe(8000)
    expect(uma.cenariosConfig.realista.custoPct).toBe(0)
    expect(uma.patrocinios[0]).toMatchObject({ valor: 5000, estagio: 'confirmado' })
    // export → import → migra de novo = mesma coisa (contrato do localStorage)
    const duas = migrarEvento(JSON.parse(JSON.stringify(uma)))
    expect(duas).toEqual(uma)
  })
})
