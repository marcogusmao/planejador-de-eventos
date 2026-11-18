// P4 — ZERO ESCRITO NO BACKUP (decisão do Marco, 06/10/2026).
//
// Achado da auditoria de dinheiro: a migração (que roda ao carregar o app e ao
// importar backup JSON) transformava preço de lote escrito como texto de zero
// — "0,00", "R$ 0", "R$ 0,00" — em '' ("não informado"). Desde a S7/P8, '' é
// preço AUSENTE: o lote sai do público e do bar. Na festa P8, um Camarote de
// 300 ingressos com "0,00" no preço derrubava o público realista de 890 para
// 590. Decisão: zero escrito vira o NÚMERO 0 (cortesia declarada); texto
// ilegível continua '' com o aviso do censo; número, '', null e undefined
// seguem como sempre.
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { migrarEvento, censoNormalizacoes, textoAvisoNormalizacoes, avisoDeImport } from './migracao.js'
import { computeCenarios } from './calc.js'
import { montarBackup, parseBackup } from './storage.js'
import { eventoSemPreco } from '../../scripts/provas-s0/cenarios.fixture.js'
import { FESTAS_REALISTAS } from '../../scripts/provas-s7/p4-festas-realistas.fixture.js'

const comPrecoNoL4 = (valor) => {
  const e = eventoSemPreco()
  e.lotes = e.lotes.map((l) => (l.id === 'l4' ? { ...l, valor } : l))
  return e
}
const l4 = (e) => e.lotes.find((l) => l.id === 'l4')

describe('P4 (1) — a tabela: preço do lote → valor migrado → público realista da festa P8', () => {
  it.each([
    // zero escrito como texto: vira o número 0, cortesia, público 890
    ['"0"', '0', 0, 890],
    ['" 0 "', ' 0 ', 0, 890],
    ['"0,00"', '0,00', 0, 890],
    ['"R$ 0"', 'R$ 0', 0, 890],
    ['"R$ 0,00"', 'R$ 0,00', 0, 890],
    // texto ilegível: continua "não informado" = sem preço, público 590
    ['"abc"', 'abc', '', 590],
    ['"R$ abc"', 'R$ abc', '', 590],
    // comportamento de sempre
    ['número 0', 0, 0, 890],
    // pago: 90% de 300 no realista (vendaPct padrão), público 860
    ['número 50', 50, 50, 860],
    ['texto "50"', '50', '50', 860],
    ['vazio', '', '', 590],
    ['null', null, '', 590],
    ['undefined', undefined, '', 590],
    ['negativo −5', -5, '', 590],
  ])('%s: entrada %j → valor %j, público realista %i', (_n, entrada, valor, publico) => {
    const m = migrarEvento(comPrecoNoL4(entrada))
    expect(l4(m).valor).toStrictEqual(valor)
    expect(l4(m).quantidade).toBe(300)
    expect(computeCenarios(m).realista.publico).toBe(publico)
  })
})

describe('P4 (2) — backup sem zero escrito importa igual ao de antes', () => {
  const ida = (eventos) =>
    parseBackup(JSON.stringify(montarBackup({ eventos, benchmarksCustom: [] }), null, 2))

  it('duas festas com a forma de hoje: export → import byte-idêntico ao do código de ANTES do P4', () => {
    // O sha256 foi medido em 06/10/2026 rodando ESTE mesmo export → import numa
    // cópia da árvore com o conserto desfeito (`scripts/provas-s7/p4-antes.mjs`).
    // Versão pública (17/11/2026): os nomes da fixture foram anonimizados e o
    // hash foi recalculado sobre ela; só nomes mudaram, nenhum valor.
    const json = JSON.stringify(ida(FESTAS_REALISTAS).eventos)
    expect(createHash('sha256').update(json).digest('hex')).toBe(
      '025cf9fccbd027977d248722dc7caa114dd6b49e632166ea07dcf7eeb07edca5'
    )
    const r = ida(FESTAS_REALISTAS)
    expect(r.eventos[0].lotes.map((l) => l.valor)).toStrictEqual([120, '150', 0, 180, ''])
    expect(r.eventos[1].lotes.map((l) => l.valor)).toStrictEqual([60, 45.5, ''])
    expect(censoNormalizacoes(FESTAS_REALISTAS)).toStrictEqual([])
  })

  it('a segunda volta também não muda nada (o que entrou é o que sai)', () => {
    const uma = ida(FESTAS_REALISTAS).eventos
    const duas = ida(uma).eventos
    expect(JSON.stringify(duas)).toBe(JSON.stringify(uma))
  })

  it('festa P8 com "0,00" no Camarote: entra como cortesia (0), público 890; a volta seguinte é idêntica', () => {
    const uma = ida([comPrecoNoL4('0,00')]).eventos
    expect(l4(uma[0]).valor).toBe(0)
    expect(computeCenarios(uma[0]).realista.publico).toBe(890)
    expect(JSON.stringify(ida(uma).eventos)).toBe(JSON.stringify(uma))
  })
})

describe('P4 (3) — o aviso de import não chama zero escrito de "não informado"', () => {
  const crus = () => {
    const e = eventoSemPreco()
    e.nome = 'Festa P4'
    e.lotes = [
      { id: 'z1', nome: 'Zero com vírgula', valor: '0,00', quantidade: 10 },
      { id: 'z2', nome: 'Zero com moeda', valor: 'R$ 0', quantidade: 10 },
      { id: 'z3', nome: 'Zero completo', valor: 'R$ 0,00', quantidade: 10 },
      { id: 'i1', nome: 'Ilegível', valor: 'abc', quantidade: 10 },
      { id: 'i2', nome: 'Ilegível com moeda', valor: 'R$ abc', quantidade: 10 },
    ]
    return [e]
  }
  it('o censo lista só os dois ilegíveis', () => {
    const censo = censoNormalizacoes(crus())
    // fmtBRL2 escreve "R$" + espaço fixo (U+00A0); normaliza para comparar
    expect(censo.map((c) => c.rotulo.replace(/\u00a0/g, ' '))).toStrictEqual([
      "lote 'Ilegível', preço R$ 0",
      "lote 'Ilegível com moeda', preço R$ 0",
    ])
  })
  it('o texto da confirmação não cita nenhum lote de zero escrito e continua citando os ilegíveis', () => {
    const censo = censoNormalizacoes(crus())
    for (const t of [textoAvisoNormalizacoes(censo), avisoDeImport(censo)]) {
      expect(t).not.toMatch(/Zero com/)
      expect(t).not.toMatch(/Zero completo/)
      expect(t).toContain("lote 'Ilegível', preço")
      expect(t).toContain("lote 'Ilegível com moeda', preço")
    }
    expect(textoAvisoNormalizacoes(censo)).toContain("Este backup traz 2 valores fora das faixas do app, que entrarão como 'não informado':")
  })
})
