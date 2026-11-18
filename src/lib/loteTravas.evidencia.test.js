// LOTE DE TRAVAS — evidência e especificação (Marco, 23/07/2026, "quero resolver
// as travas agora"). Achados da auditoria externa cega de 22/07. Este arquivo
// cobre as fronteiras de DADO (migração/censo/régua) dos itens 1, 2 e 6; as
// PORTAS de UI (o campo que recusa ao vivo) moram em
// src/components/loteTravas.faixa.test.jsx; o item 4 (realizadoAuto) mora em
// parcelas.test.js / novaEdicao.test.js / financeiro.test.js.
//
// Régua da casa em TODA trava: recusa com aviso em português, NÃO grava, NÃO
// clampa. Na migração, "fora da faixa" vira '' ("não informado") — o número
// absurdo nunca liga comportamento que muda o resultado; calc.js segue INTOCADO.

import { describe, expect, it } from 'vitest'
import { barPorPessoa, veredito } from './calc.js'
import { migrarEvento, censoNormalizacoes } from './migracao.js'
import { num } from './util.js'

// ---------------------------------------------------------------------------
// ITEM 1 — barTaxaSistemaPct: o ÚNICO percentual de CONTA que faltava travar
// ---------------------------------------------------------------------------
describe('item 1 — taxa do sistema do bar (0..100): a conta, a migração e o censo', () => {
  // RED (medido pelo auditor cego, 22/07): barTaxaSistemaPct 150 fazia a Receita
  // total realista cair de R$ 35.100 para R$ 8.100 — mostrada como certa. A conta
  // é taxaSistema = consumo * taxaPct / 100; acima de 100% ela come mais que o
  // consumo inteiro e o bar líquido vira NEGATIVO, arrastando a receita.
  it('calc.js intocado: taxa 150% torna o bar líquido NEGATIVO (por isso a porta recusa)', () => {
    const ev = { barTicket: { realista: 100 }, barCustoSistema: 0 }
    const sa = barPorPessoa({ ...ev, barTaxaSistemaPct: 50 }, 'realista', 100)
    expect(sa.liquido).toBe(5000) // taxa 50%: 10.000 − 5.000
    const absurdo = barPorPessoa({ ...ev, barTaxaSistemaPct: 150 }, 'realista', 100)
    expect(absurdo.taxaSistema).toBe(15000) // 150% de 10.000
    expect(absurdo.liquido).toBe(-5000) // 10.000 − 15.000: bar líquido negativo
  })

  it('migração: 150 e −30 herdados de backup viram "" (não informado)', () => {
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: 150 }).barTaxaSistemaPct).toBe('')
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: -30 }).barTaxaSistemaPct).toBe('')
  })

  it('migração: valores 0..100 (e string numérica) passam byte a byte', () => {
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: 0 }).barTaxaSistemaPct).toBe(0)
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: 5 }).barTaxaSistemaPct).toBe(5)
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: 100 }).barTaxaSistemaPct).toBe(100)
    expect(migrarEvento({ id: 'e', nome: 'T', barTaxaSistemaPct: '5' }).barTaxaSistemaPct).toBe('5')
  })

  it('censo do import: a taxa do bar fora da faixa entra no aviso agregado, com rótulo próprio', () => {
    const censo = censoNormalizacoes([{ nome: 'Festa X', barTaxaSistemaPct: 150 }])
    const item = censo.find((c) => c.campo === 'barTaxaSistemaPct')
    expect(item).toBeTruthy()
    expect(item.evento).toBe('Festa X')
    expect(item.rotulo).toMatch(/taxa do sistema do bar/)
    // arquivo limpo (taxa 5) → sem aviso
    expect(censoNormalizacoes([{ nome: 'Festa X', barTaxaSistemaPct: 5 }])).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// ITEM 2 — margens do veredito (0..100): margem mínima negativa = VERDE FALSO
// ---------------------------------------------------------------------------
describe('item 2 — margens do semáforo (0..100): prejuízo não pode pintar não-vermelho', () => {
  // RED: com margemMinima −20 CRUA, uma margem realista de −5% (PREJUÍZO) caía em
  // "amarelo" (−5 >= −20) — o semáforo não acusava o prejuízo. Migrada, a −20 vira
  // "não informado" e cai no padrão 20 → −5% < 20 → vermelho (a leitura honesta).
  const cenarios = { realista: { margem: -5 }, pessimista: { lucro: -1000 } }

  it('o bug, fotografado: margemMinima −20 CRUA pinta AMARELO um prejuízo de −5%', () => {
    const cru = veredito(cenarios, { margemMinima: -20 })
    expect(cru.cor).toBe('amarelo') // não-vermelho: o semáforo mente
    expect(cru.margemMinima).toBe(-20)
  })

  it('migração: margemMinima −20 vira "" → padrão 20 → o mesmo prejuízo pinta VERMELHO', () => {
    const migrado = migrarEvento({ id: 'e', nome: 'T', margemMinima: -20 })
    expect(migrado.margemMinima).toBe('')
    expect(veredito(cenarios, migrado).cor).toBe('vermelho')
  })

  it('migração: margem alvo 150 (acima de 100) também vira ""; valores 0..100 passam', () => {
    expect(migrarEvento({ id: 'e', nome: 'T', margemAlvo: 150 }).margemAlvo).toBe('')
    expect(migrarEvento({ id: 'e', nome: 'T', margemAlvo: 28 }).margemAlvo).toBe(28)
    expect(migrarEvento({ id: 'e', nome: 'T', margemMinima: 0 }).margemMinima).toBe(0)
    expect(migrarEvento({ id: 'e', nome: 'T', margemMinima: 100 }).margemMinima).toBe(100)
    // vazio/ausente segue como está (comportamento de sempre — cai nos padrões)
    expect(migrarEvento({ id: 'e', nome: 'T', margemAlvo: '' }).margemAlvo).toBe('')
    expect(migrarEvento({ id: 'e', nome: 'T' }).margemAlvo).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ITEM 6 — edge 0x10: string hexadecimal não é formato BR
// ---------------------------------------------------------------------------
describe('item 6 — "0x10" (hexadecimal) recusado na régua da migração, sem tocar decimais BR', () => {
  // RED: Number('0x10') === 16 e num('0x10') === 16 (util.js usa Number). A régua
  // antiga aceitava a string "0x10" (Number.isFinite(16)) e a preservava — um
  // cashback "0x10" herdado fingia ser 16% na conta. Agora a régua só passa
  // notação decimal; "0x10" cai em '' ("não informado").
  it('confirma o vetor: num("0x10") coage para 16 (por isso a régua precisa barrar)', () => {
    expect(num('0x10')).toBe(16)
  })

  it('cashback "0x10" via backup → "" (não 16); "16" e "4.5" decimais passam', () => {
    expect(migrarEvento({ id: 'e', nome: 'T', cashbackPct: '0x10' }).cashbackPct).toBe('')
    expect(migrarEvento({ id: 'e', nome: 'T', cashbackPct: '16' }).cashbackPct).toBe('16')
    expect(migrarEvento({ id: 'e', nome: 'T', cashbackPct: '4.5' }).cashbackPct).toBe('4.5')
  })

  it('o hex é barrado nas OUTRAS réguas também (dinheiro): custo estimado "0x10" → ""', () => {
    const e = migrarEvento({
      id: 'e',
      nome: 'T',
      categorias: [{ id: 'c', nome: 'C', itens: [{ id: 'i', servico: 'X', estimado: '0x10' }] }],
    })
    expect(e.categorias[0].itens[0].estimado).toBe('')
  })

  it('número real (typeof number) não passa pelo regex e segue intocado', () => {
    expect(migrarEvento({ id: 'e', nome: 'T', cashbackPct: 16 }).cashbackPct).toBe(16)
  })
})
