// Gate 1 do export v2 — schema do STATUS. Cobre a lista canônica, as 4
// migrações (preservar, não achatar — Marco 21/07/2026), a garantia de que
// NENHUM item sai da migração sem status (o que torna o `|| 'ORÇAR'` de calc.js
// código morto), os campos novos data_pgto/pagamento, e o round-trip de backup.
import { describe, it, expect } from 'vitest'
import {
  STATUS_CUSTO,
  STATUS_CUSTO_IDS,
  STATUS_CUSTO_PADRAO,
  statusCustoValido,
  isPago,
  migrarStatusCusto,
  fechadoSemDadosPgto,
  estiloStatusCusto,
  contaOrcamentoFechado,
} from './statusCusto.js'
import { novoEvento, novoItem, novoPatrocinio, STATUS } from './defaults.js'
import { migrarEvento, migrarEventos } from './migracao.js'
import { montarBackup, parseBackup } from './storage.js'
import { custosPorStatus } from './calc.js'

describe('statusCusto — a lista canônica (uma fonte só)', () => {
  it('11 status na ordem do ciclo, cada um com id/rótulo/bg/texto', () => {
    expect(STATUS_CUSTO).toHaveLength(11)
    expect(STATUS_CUSTO_IDS[0]).toBe('TBI')
    expect(STATUS_CUSTO_IDS.at(-1)).toBe('PAGO')
    for (const s of STATUS_CUSTO) {
      expect(s.id && s.rotulo).toBeTruthy()
      expect(s.bg).toMatch(/^#[0-9A-F]{6}$/i)
      expect(s.texto).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
  it('defaults.js STATUS é a MESMA lista (não há segunda lista)', () => {
    expect(STATUS).toEqual(STATUS_CUSTO_IDS)
  })
  it('padrão é ESTIMADO; statusCustoValido e isPago', () => {
    expect(STATUS_CUSTO_PADRAO).toBe('ESTIMADO')
    expect(statusCustoValido('FECHADO')).toBe(true)
    expect(statusCustoValido('ORÇAR')).toBe(false) // id ANTIGO não é válido no novo
    expect(isPago('PAGO')).toBe(true)
    expect(isPago('FECHADO')).toBe(false)
  })
})

describe('migrarStatusCusto — preservar, não achatar (as 4 do Marco)', () => {
  it('PAGO→PAGO · FECHADO→FECHADO · NEGOCIANDO→NEGOCIAR · ORÇAR→ESTIMADO', () => {
    expect(migrarStatusCusto('PAGO')).toBe('PAGO')
    expect(migrarStatusCusto('FECHADO')).toBe('FECHADO')
    expect(migrarStatusCusto('NEGOCIANDO')).toBe('NEGOCIAR')
    expect(migrarStatusCusto('ORÇAR')).toBe('ESTIMADO')
  })
  it('id novo já válido passa direto; ausente/desconhecido → ESTIMADO', () => {
    expect(migrarStatusCusto('ORÇADO')).toBe('ORÇADO')
    expect(migrarStatusCusto(undefined)).toBe('ESTIMADO')
    expect(migrarStatusCusto(null)).toBe('ESTIMADO')
    expect(migrarStatusCusto('lixo')).toBe('ESTIMADO')
  })
})

describe('migração no evento — status garantido + campos novos', () => {
  const eventoAntigo = () => {
    const e = novoEvento('Migra')
    e.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          { id: 'i1', servico: 'Bar', status: 'ORÇAR' },
          { id: 'i2', servico: 'DJ', status: 'FECHADO' },
          { id: 'i3', servico: 'Som', status: 'NEGOCIANDO' },
          { id: 'i4', servico: 'Luz', status: 'PAGO' },
          { id: 'i5', servico: 'Sem status' }, // NENHUM status
        ],
      },
    ]
    e.patrocinios = [{ id: 'p1', patrocinador: 'Patrocinador B', valor: 8500, estagio: 'confirmado' }]
    return e
  }

  it('as 4 migrações valem no evento real', () => {
    const m = migrarEvento(eventoAntigo())
    const st = Object.fromEntries(m.categorias[0].itens.map((i) => [i.id, i.status]))
    expect(st).toEqual({ i1: 'ESTIMADO', i2: 'FECHADO', i3: 'NEGOCIAR', i4: 'PAGO', i5: 'ESTIMADO' })
  })

  it('NENHUM item sai da migração sem status válido (condição a do Marco)', () => {
    const m = migrarEvento(eventoAntigo())
    for (const c of m.categorias)
      for (const i of c.itens) expect(statusCustoValido(i.status)).toBe(true)
  })

  it('data_pgto/pagamento nascem "" no item E no patrocínio', () => {
    const m = migrarEvento(eventoAntigo())
    const i = m.categorias[0].itens[0]
    expect(i.dataPgto).toBe('')
    expect(i.pagamento).toBe('')
    expect(m.patrocinios[0].dataPgto).toBe('')
    expect(m.patrocinios[0].pagamento).toBe('')
  })

  it('item novo nasce ESTIMADO e com os campos novos vazios', () => {
    const i = novoItem()
    expect(i.status).toBe('ESTIMADO')
    expect(i.dataPgto).toBe('')
    expect(i.pagamento).toBe('')
    expect(novoPatrocinio().dataPgto).toBe('')
  })

  // Buraco fechado (Marco, item 3): o marcacaoZerado passou seus fixtures pro
  // vocabulário novo, então ninguém mais exercitava custosPorStatus a partir de
  // input LEGADO cru. Aqui: evento com ORÇAR/NEGOCIANDO crus → migração →
  // custosPorStatus agrupa nas keys NOVAS (ESTIMADO/NEGOCIAR), sem sobrar antiga.
  it('input LEGADO → migração → custosPorStatus agrupa nas keys NOVAS', () => {
    const legado = novoEvento('Legado')
    legado.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          { id: 'a', servico: 'X', estimado: 1000, status: 'ORÇAR' },
          { id: 'b', servico: 'Y', estimado: 2000, status: 'NEGOCIANDO' },
          { id: 'c', servico: 'Z', estimado: 3000, status: 'FECHADO' },
          { id: 'd', servico: 'W', estimado: 4000, status: 'PAGO' },
        ],
      },
    ]
    const grupos = custosPorStatus(migrarEvento(legado).categorias)
    expect(grupos).toEqual({ ESTIMADO: 1000, NEGOCIAR: 2000, FECHADO: 3000, PAGO: 4000 })
    expect(grupos.ORÇAR).toBeUndefined()
    expect(grupos.NEGOCIANDO).toBeUndefined()
  })
})

describe('estiloStatusCusto — fonte ÚNICA de cor (gate 4, igual à planilha)', () => {
  it('os 11 status têm estilo com as cores canônicas exatas; desconhecido → undefined', () => {
    for (const s of STATUS_CUSTO)
      expect(estiloStatusCusto(s.id)).toEqual({ backgroundColor: s.bg, color: s.texto })
    // status VELHO (morto) e vazios não pintam — some sem cor, não quebra
    expect(estiloStatusCusto('ORÇAR')).toBeUndefined()
    expect(estiloStatusCusto('NEGOCIANDO')).toBeUndefined()
    expect(estiloStatusCusto('')).toBeUndefined()
    expect(estiloStatusCusto(undefined)).toBeUndefined()
  })
})

describe('fechadoSemDadosPgto — o derivado (item 4)', () => {
  it('FECHADO + pagamento vazio → true; com dados → false; outro status → false', () => {
    expect(fechadoSemDadosPgto({ status: 'FECHADO', pagamento: '' })).toBe(true)
    expect(fechadoSemDadosPgto({ status: 'FECHADO', pagamento: '  ' })).toBe(true)
    expect(fechadoSemDadosPgto({ status: 'FECHADO', pagamento: 'Pix 123' })).toBe(false)
    expect(fechadoSemDadosPgto({ status: 'PAGO', pagamento: '' })).toBe(false)
  })
})

describe('contaOrcamentoFechado — conta "fechados ou pagos", fonte ÚNICA (Marco, 22/07/2026)', () => {
  // A TRAVA 0..100 (Marco, 12/08/2026). O gatilho é inalcançável pelas portas
  // do app — estas duas verificações chamam a função DIRETO, com o denominador
  // que a UI recusa, porque é exatamente esse o dia para o qual a trava existe.
  it('subtotal negativo no total NÃO deixa a barra passar de 100%', () => {
    // fechado 60.000 sobre um total de 50.000 daria 120% sem a trava.
    expect(contaOrcamentoFechado({ PAGO: 60000, ESTIMADO: -10000 }).pct).toBe(100)
  })

  it('e não deixa a barra ficar NEGATIVA quando o numerador é que é negativo', () => {
    expect(contaOrcamentoFechado({ PAGO: -5000, ESTIMADO: 10000 }).pct).toBe(0)
  })

  it('denominador = TODOS os status; numerador = PAGO+FECHADO+PARCIAL (o caso real do Marco: 43%)', () => {
    // No bug antigo, ESTIMADO caía FORA do denominador (lista cravada de 4) e a
    // barra mostrava "R$ 60.500 de R$ 60.500 (100%)". Aqui o certo: 60.500 de
    // 140.050 = 43%.
    const totais = { ESTIMADO: 79550, PARCIAL: 10500, FECHADO: 40000, PAGO: 10000 }
    expect(contaOrcamentoFechado(totais)).toEqual({ fechado: 60500, total: 140050, pct: 43 })
  })
  it('PARCIAL conta no numerador — dinheiro comprometido (decisão do Marco)', () => {
    expect(contaOrcamentoFechado({ ESTIMADO: 100, PAGO: 100 }).fechado).toBe(100)
    const com = contaOrcamentoFechado({ ESTIMADO: 100, PAGO: 100, PARCIAL: 50 })
    expect(com.fechado).toBe(150)
    expect(com.total).toBe(250)
  })
  it('status novos fora do numerador (ORÇADO/NEGOCIAR) contam no total, não no fechado', () => {
    const r = contaOrcamentoFechado({ ORÇADO: 30000, NEGOCIAR: 10000, PAGO: 10000 })
    expect(r).toEqual({ fechado: 10000, total: 50000, pct: 20 })
  })
  it('total <= 0 → pct 0, sem divisão por zero', () => {
    expect(contaOrcamentoFechado({})).toEqual({ fechado: 0, total: 0, pct: 0 })
    expect(contaOrcamentoFechado(undefined)).toEqual({ fechado: 0, total: 0, pct: 0 })
  })
})

describe('round-trip de backup preserva o schema novo', () => {
  it('status + data_pgto + pagamento sobrevivem a montarBackup→parseBackup', () => {
    const e = novoEvento('RT')
    e.categorias[0].itens = [
      novoItem({ servico: 'X', status: 'FECHADO', dataPgto: '29/05', pagamento: 'Pix CNPJ 12.345' }),
    ]
    e.patrocinios = [novoPatrocinio({ patrocinador: 'Patrocinador B', dataPgto: '01/06', pagamento: 'boleto' })]
    const store = { eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, benchmarksPadrao: {}, ajustes: {} }
    const voltou = parseBackup(JSON.stringify(montarBackup(store))).eventos[0]
    const it = voltou.categorias[0].itens[0]
    expect(it.status).toBe('FECHADO')
    expect(it.dataPgto).toBe('29/05')
    expect(it.pagamento).toBe('Pix CNPJ 12.345')
    expect(voltou.patrocinios[0].dataPgto).toBe('01/06')
    expect(voltou.patrocinios[0].pagamento).toBe('boleto')
  })
})
