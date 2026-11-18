// Lote SEM PREÇO (P8 — Marco, 06/10/2026): quem fica de fora, o texto das
// telas, do WhatsApp e do aviso depois do import JSON. A regra de conta mora
// em calc.js e é guardada por golden.test.js e calc.p8.test.js; aqui só os
// textos e a detecção.
import { describe, it, expect } from 'vitest'
import {
  loteFicaDeFora,
  lotesSemPreco,
  textoAvisoLotesSemPreco,
  textoCurtoLotesSemPreco,
  censoLotesSemPreco,
  textoCensoLotesSemPreco,
} from './loteSemPreco.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { resumoCurto, resumoCompleto } from './resumo.js'
import { fecharEvento } from './fechamentoEvento.js'
import { textoImportacaoFeita } from './storage.js'
import { temQuantidadeTravada } from './breakEvenTexto.js'

// A festa do diff aprovado, com o lote sem preço chamado "Camarote".
function festaP8() {
  const e = novoEvento('Festa P8')
  e.data = '2027-01-01'
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? [novoItem({ id: 'custo', estimado: 60000, servico: 'Custo sintético' })] : [],
  }))
  e.lotes = [
    novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 }),
    novoLote({ id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 }),
    novoLote({ id: 'l4', nome: 'Camarote', valor: '', quantidade: 300 }),
  ]
  e.barTicket = { pessimista: 110, realista: 110, otimista: 110 }
  e.barTaxaSistemaPct = 5
  e.barCustoSistema = 500
  return e
}
const comLotes = (e, lotes) => ({ ...e, lotes })
const comAjusteRealista = (e, id, v) => ({
  ...e,
  cenariosConfig: { ...e.cenariosConfig, overrides: { ...e.cenariosConfig.overrides, realista: { [id]: v } } },
})
const camarote = (patch) => ({ ...festaP8().lotes[2], ...patch })

const TEXTO_RECEITA =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço.'
const TEXTO_COMPLETO =
  'O lote “Camarote” (300 ingressos) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'

const congelar = (o) => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(congelar)
    Object.freeze(o)
  }
  return o
}

describe('(a) loteFicaDeFora — quem avisa', () => {
  it('preço vazio com 300 → sim; quantidade vazia + ajuste 125 → sim; quantidade 0 sem ajuste → não', () => {
    const e = festaP8()
    expect(loteFicaDeFora(e, e.lotes[2])).toBe(true)
    const soAjuste = comAjusteRealista(comLotes(e, [camarote({ quantidade: '' })]), 'l4', 125)
    expect(loteFicaDeFora(soAjuste, soAjuste.lotes[0])).toBe(true)
    const zero = comLotes(e, [camarote({ quantidade: 0 })])
    expect(loteFicaDeFora(zero, zero.lotes[0])).toBe(false)
  })
  it('preço 0 declarado não é "sem preço"; null e [] não são lote', () => {
    const e = festaP8()
    expect(loteFicaDeFora(e, camarote({ valor: 0 }))).toBe(false)
    expect(loteFicaDeFora(e, null)).toBe(false)
    expect(loteFicaDeFora(e, [])).toBe(false)
  })
})

describe('(b) os textos exatos', () => {
  it('1 lote, na Receita e fora dela', () => {
    expect(textoAvisoLotesSemPreco(festaP8(), { naReceita: true })).toBe(TEXTO_RECEITA)
    expect(textoAvisoLotesSemPreco(festaP8())).toBe(TEXTO_COMPLETO)
    expect(textoCurtoLotesSemPreco(festaP8())).toBe('1 lote sem preço fora do público e do bar (300 ingressos)')
  })
  it('2 lotes', () => {
    const e = comLotes(festaP8(), [
      novoLote({ id: 'a', nome: 'A', valor: '', quantidade: 300 }),
      novoLote({ id: 'b', nome: 'B', valor: null, quantidade: 150 }),
    ])
    expect(textoAvisoLotesSemPreco(e)).toBe(
      '2 lotes estão sem preço — “A” (300 ingressos) e “B” (150 ingressos): ficam fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
    )
    expect(textoCurtoLotesSemPreco(e)).toBe('2 lotes sem preço fora do público e do bar (450 ingressos)')
  })
  it('4 lotes: os três primeiros e "e mais 1"; milhar com ponto', () => {
    const e = comLotes(festaP8(), [
      novoLote({ id: 'a', nome: 'A', valor: '', quantidade: 1500 }),
      novoLote({ id: 'b', nome: 'B', valor: '', quantidade: 150 }),
      novoLote({ id: 'c', nome: 'C', valor: '', quantidade: 10 }),
      novoLote({ id: 'd', nome: 'D', valor: '', quantidade: 5 }),
    ])
    expect(textoAvisoLotesSemPreco(e, { naReceita: true })).toBe(
      '4 lotes estão sem preço — “A” (1.500 ingressos), “B” (150 ingressos), “C” (10 ingressos) e mais 1: ficam fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço.'
    )
  })
  it('só ajuste manual e nome em branco', () => {
    const e = comAjusteRealista(comLotes(festaP8(), [camarote({ nome: '  ', quantidade: '' })]), 'l4', 125)
    expect(textoAvisoLotesSemPreco(e)).toBe(
      'O lote “sem nome” (só ajuste manual) está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 no preço, na aba Receita.'
    )
    expect(textoCurtoLotesSemPreco(e)).toBe('1 lote sem preço fora do público e do bar')
  })
  it('evento novo (seis lotes em branco) não avisa', () => {
    const e = novoEvento('X')
    expect(lotesSemPreco(e)).toStrictEqual([])
    expect(textoAvisoLotesSemPreco(e)).toBeNull()
    expect(textoCurtoLotesSemPreco(e)).toBeNull()
  })
})

describe('(c) entrada congelada', () => {
  it('não quebra nem muda', () => {
    const e = congelar(festaP8())
    const antes = JSON.stringify(e)
    expect(textoAvisoLotesSemPreco(e)).toBe(TEXTO_COMPLETO)
    expect(censoLotesSemPreco([e])).toHaveLength(1)
    expect(JSON.stringify(e)).toBe(antes)
  })
})

describe('(d) censo do import', () => {
  it('1 festa', () => {
    expect(textoCensoLotesSemPreco(censoLotesSemPreco([festaP8(), novoEvento('Vazia')]))).toBe(
      'Neste arquivo há 1 lote sem preço: Festa P8 — “Camarote” (300 ingressos). Lote sem preço fica fora do público, das cortesias e do bar até ter preço; para contar como cortesia, ponha 0 no preço, na aba Receita.'
    )
  })
  it('2 festas com 1 lote cada', () => {
    const a = { ...festaP8(), nome: 'A' }
    const b = { ...festaP8(), nome: 'B', lotes: [camarote({ nome: 'Pista', quantidade: 150 })] }
    expect(textoCensoLotesSemPreco(censoLotesSemPreco([a, b]))).toBe(
      'Neste arquivo há 2 lotes sem preço: A — “Camarote” (300 ingressos); B — “Pista” (150 ingressos). Lote sem preço fica fora do público, das cortesias e do bar até ter preço; para contar como cortesia, ponha 0 no preço, na aba Receita.'
    )
  })
  it('nada a avisar → texto vazio; lixo na lista é ignorado', () => {
    expect(textoCensoLotesSemPreco(censoLotesSemPreco([novoEvento('X'), null, 'x']))).toBe('')
    expect(textoCensoLotesSemPreco(null)).toBe('')
  })
})

describe('(e) WhatsApp — festa aberta', () => {
  const HOJE = { hoje: '2026-10-06' }
  it('curto e completo: a linha 1 é o aviso, uma vez só; mínimo 293 e público 590', () => {
    for (const fn of [resumoCurto, resumoCompleto]) {
      const linhas = fn(festaP8(), HOJE).split('\n')
      expect(linhas[1]).toBe(`⚠️ ${TEXTO_COMPLETO}`)
      expect(linhas.filter((l) => l === `⚠️ ${TEXTO_COMPLETO}`)).toHaveLength(1)
      expect(linhas.join('\n')).toContain('break-even 293 pagos · público 590')
    }
  })
  it('controle: preço 0 declarado não avisa e conta as 300 cortesias', () => {
    const e = comLotes(festaP8(), [...festaP8().lotes.slice(0, 2), camarote({ valor: 0 })])
    for (const fn of [resumoCurto, resumoCompleto]) {
      const texto = fn(e, HOJE)
      expect(texto.split('\n').some((l) => l.startsWith('⚠️ O lote'))).toBe(false)
      expect(texto).toContain('break-even 135 pagos · público 890')
    }
  })
})

describe('(f) WhatsApp — festa fechada', () => {
  it('o Completo traz o aviso uma vez, antes do plano pré-evento; o Curto não', () => {
    const e = { ...festaP8(), receitaRealizada: { bilheteria: 50000, bar: 30000 } }
    const fechada = JSON.parse(JSON.stringify(fecharEvento(e, '2027-01-02T12:00:00.000Z')))
    const completo = resumoCompleto(fechada, { hoje: '2027-01-05' }).split('\n')
    const iAviso = completo.indexOf(`⚠️ ${TEXTO_COMPLETO}`)
    const iPlano = completo.indexOf('_O plano pré-evento (cenários), para comparação:_')
    expect(iAviso).toBeGreaterThan(0)
    expect(iPlano).toBeGreaterThan(iAviso)
    expect(completo.filter((l) => l === `⚠️ ${TEXTO_COMPLETO}`)).toHaveLength(1)
    expect(resumoCurto(fechada, { hoje: '2027-01-05' })).not.toContain('sem preço')
  })
})

describe('(g) aviso depois do import JSON', () => {
  const censo = { entraram: 1, novas: 1, atualizadas: 0, naoEntraram: [], ganharamIdentificacao: [] }
  it('o texto vira parágrafo próprio, antes de "Uma cópia de segurança"', () => {
    const aviso = textoCensoLotesSemPreco(censoLotesSemPreco([festaP8()]))
    const t = textoImportacaoFeita(censo, { lotesSemPreco: aviso })
    const partes = t.split('\n\n')
    const i = partes.indexOf(aviso)
    expect(i).toBeGreaterThan(0)
    expect(partes[i + 1]).toMatch(/^Uma cópia de segurança/)
  })
  it('sem lote sem preço, não menciona', () => {
    expect(textoImportacaoFeita(censo, { lotesSemPreco: '' })).not.toContain('sem preço')
  })
})

describe('P1 (A) — Marco, 06/10/2026: ajuste manual em lote sem preço não trava o mínimo', () => {
  it('sem preço → não travado; com preço 50 → travado', () => {
    const e = comAjusteRealista(festaP8(), 'l4', 125)
    expect(temQuantidadeTravada(e, 'realista')).toBe(false)
    const comPreco = { ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, valor: 50 } : l)) }
    expect(temQuantidadeTravada(comPreco, 'realista')).toBe(true)
  })
  it('o WhatsApp mostra o mínimo verdadeiro (293) junto com o aviso do lote sem preço', () => {
    const t = resumoCurto(comAjusteRealista(festaP8(), 'l4', 125), { hoje: '2026-10-06' })
    expect(t).toContain('break-even 293 pagos · público 590')
    expect(t).toContain(`⚠️ ${TEXTO_COMPLETO}`)
  })
})
