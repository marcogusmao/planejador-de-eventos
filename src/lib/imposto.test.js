// IMPOSTO SOBRE A RECEITA — a bateria do desenho aprovado pelo Marco em
// 27/07/2026 (ver o cabeçalho de src/lib/imposto.js para as quatro decisões).
//
// O que este arquivo prova, em ordem de gravidade:
//   1. evento que já existe NÃO muda um centavo (os 8 do backup real, campo a
//      campo, e o objeto do cenário sem uma chave a mais);
//   2. a base da bilheteria é a BRUTA — a decisão que custa dinheiro de
//      verdade e que um refactor distraído inverteria sem ninguém notar;
//   3. a contingência NÃO cresce quando o imposto entra (decisão 4) — o teste
//      que fica VERMELHO se alguém somar o imposto nos custos;
//   4. cada chave sozinha, as três juntas, e o R$ 0 que sabe explicar por quê.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { computeCenario, computeCenarios } from './calc.js'
import { migrarEvento, migrarEventos } from './migracao.js'
import {
  impostoConfigurado,
  impostoDoCenario,
  impostoSobreDoEvento,
  impostoTexto,
  impostoLinhaLabel,
  impostoValor,
  temImposto,
  formaImpostoSobre,
} from './imposto.js'

// Evento pequeno e explícito: bilheteria de R$ 10.000 brutos, taxa 10%,
// cashback 5%, bar R$ 2.000, patrocínio R$ 1.000, custos R$ 3.000 e
// contingência 10%. Números redondos de propósito — cada conta abaixo é
// conferível de cabeça, sem calculadora e sem copiar o "Received" do vitest.
const eventoBase = (extra = {}) => ({
  nome: 'Evento de teste do imposto',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 2000, patrocinio: '' },
  patrocinios: [{ id: 'p1', patrocinador: 'Marca', valor: 1000, estagio: 'confirmado' }],
  lotes: [{ id: 'l1', nome: 'Lote único', valor: 100, quantidade: 100 }],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 3000 }] }],
  cenariosConfig: {
    pessimista: { vendaPct: 100, custoPct: 0 },
    realista: { vendaPct: 100, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: 0 },
  },
  ...extra,
})

const ligar = (bases, pct = 10) =>
  eventoBase({
    impostoPct: pct,
    impostoSobre: {
      bilheteria: bases.includes('bilheteria'),
      bar: bases.includes('bar'),
      patrocinio: bases.includes('patrocinio'),
    },
  })

// ─────────────────────────────────────────────────────────────────────────
// 1. O EVENTO QUE JÁ EXISTE NÃO MUDA NADA
// ─────────────────────────────────────────────────────────────────────────

describe('evento sem imposto configurado — nada muda, nem o formato', () => {
  it('sem os campos, o cenário sai SEM a chave `imposto` (o objeto é o de sempre)', () => {
    const c = computeCenario(eventoBase(), 'realista')
    expect('imposto' in c).toBe(false)
    expect(temImposto(c)).toBe(false)
    expect(impostoValor(c)).toBe(0)
  })

  it('sem os campos, o lucro é exatamente receita − custo (nenhum zero somado no meio)', () => {
    const c = computeCenario(eventoBase(), 'realista')
    // bruta 10.000 · taxa 1.000 · cashback 500 → líquida 9.500
    // receita 9.500 + 2.000 + 1.000 = 12.500
    // custo 3.000 + contingência 300 = 3.300
    expect(c.receitaTotal).toBe(12500)
    expect(c.custoTotal).toBe(3300)
    expect(c.lucro).toBe(12500 - 3300)
  })

  it('alíquota vazia E as três chaves desligadas continuam sendo "não configurado"', () => {
    const ev = eventoBase({
      impostoPct: '',
      impostoSobre: { bilheteria: false, bar: false, patrocinio: false },
    })
    expect(impostoConfigurado(ev)).toBe(false)
    expect('imposto' in computeCenario(ev, 'realista')).toBe(false)
    expect(computeCenario(ev, 'realista').lucro).toBe(computeCenario(eventoBase(), 'realista').lucro)
  })

  it('o evento que passou pela MIGRAÇÃO (campos neutros gravados) também não muda', () => {
    const cru = eventoBase()
    const migrado = migrarEvento(cru)
    expect(migrado.impostoPct).toBe('')
    expect(migrado.impostoSobre).toEqual({ bilheteria: false, bar: false, patrocinio: false })
    expect(computeCenarios(migrado)).toStrictEqual(computeCenarios(cru))
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 2. OS 8 EVENTOS REAIS DO MARCO, CAMPO A CAMPO
// ─────────────────────────────────────────────────────────────────────────
//
// O backup real de 27/07/2026 mora FORA do repositório (dado do Marco não se
// commita — regra de commits do CLAUDE.md). Quando ele não está na máquina, o
// teste diz que pulou e por quê, em vez de passar calado fingindo que provou.
const BACKUP_REAL =
  process.env.BACKUP_REAL || '/caminho/para/o/backup-real.json'

describe('os 8 eventos do backup real — resultado idêntico ao centavo', () => {
  const existe = fs.existsSync(BACKUP_REAL)
  it.skipIf(!existe)(
    'nenhum dos 8 ganha chave `imposto`, e cada cenário bate campo a campo com o de antes',
    () => {
      const backup = JSON.parse(fs.readFileSync(BACKUP_REAL, 'utf8'))
      const eventos = migrarEventos(backup.eventos)
      expect(eventos).toHaveLength(8)
      for (const e of eventos) {
        // A migração gravou os neutros — e neutro NÃO configura imposto.
        expect(e.impostoPct).toBe('')
        expect(e.impostoSobre).toEqual({ bilheteria: false, bar: false, patrocinio: false })
        expect(impostoConfigurado(e)).toBe(false)
        const c = computeCenarios(e)
        for (const k of ['pessimista', 'realista', 'otimista']) {
          expect('imposto' in c[k], `${e.nome}/${k} ganhou chave imposto`).toBe(false)
          // A invariante do DRE de sempre: lucro = receita − custo, sem termo
          // intermediário nenhum.
          expect(c[k].lucro).toBe(c[k].receitaTotal - c[k].custoTotal)
        }
      }
    }
  )

  it.skipIf(!existe)('o backup antigo (sem os campos novos) continua importando', () => {
    const backup = JSON.parse(fs.readFileSync(BACKUP_REAL, 'utf8'))
    // Nenhum evento do arquivo tem os campos — é literalmente um backup de
    // antes do imposto existir.
    for (const e of backup.eventos) {
      expect(e.impostoPct).toBeUndefined()
      expect(e.impostoSobre).toBeUndefined()
    }
    expect(() => migrarEventos(backup.eventos)).not.toThrow()
    // Idempotência: migrar duas vezes = migrar uma.
    const uma = migrarEventos(backup.eventos)
    expect(migrarEventos(uma)).toStrictEqual(uma)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 3. A BASE DA BILHETERIA É A BRUTA — a decisão que custa dinheiro
// ─────────────────────────────────────────────────────────────────────────

describe('base da bilheteria: BRUTA, antes da comissão e do cashback', () => {
  it('a 10% sobre a bilheteria, o imposto é 10% da BRUTA — não da líquida', () => {
    const c = computeCenario(ligar(['bilheteria']), 'realista')
    expect(c.bruta).toBe(10000)
    expect(c.liquida).toBe(9500)
    expect(c.imposto.valor).toBe(1000) // 10% de 10.000, não de 9.500
    expect(c.imposto.base).toBe(10000)
  })

  it('NO MODO REPASSE (taxa paga pelo cliente) a líquida é MAIOR que a bruta — e a base continua a bruta', () => {
    // É o modo dos eventos REAIS do Marco: medido em 27/07/2026, nos 8 eventos
    // do backup a líquida é a bruta + 5% de cashback. Tributar a líquida
    // cobraria imposto sobre dinheiro que volta para a produção — em Marfim
    // Raiz Cine (bruta R$ 250.000,00) seriam R$ 1.250,00 a mais, a 10%.
    const c = computeCenario(ligar(['bilheteria'], 10) && {
      ...ligar(['bilheteria'], 10),
      taxaPagaPor: 'cliente',
    }, 'realista')
    expect(c.liquida).toBeGreaterThan(c.bruta)
    expect(c.liquida).toBe(10500) // 10.000 + 500 de cashback, sem descontar a taxa
    expect(c.imposto.valor).toBe(1000) // 10% de 10.000 — e não 1.050
  })

  it('a bilheteria BRUTA acompanha o ticket médio manual (a base não congela)', () => {
    const ev = {
      ...ligar(['bilheteria']),
      cenariosConfig: {
        pessimista: { vendaPct: 100 },
        realista: { vendaPct: 100, ticketMedio: 200 },
        otimista: { vendaPct: 100 },
      },
    }
    const c = computeCenario(ev, 'realista')
    expect(c.bruta).toBe(20000) // 100 pagos × R$ 200
    expect(c.imposto.valor).toBe(2000)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 4. A CONTINGÊNCIA NÃO CRESCE — decisão 4, o teste adversarial
// ─────────────────────────────────────────────────────────────────────────

describe('imposto FORA da base da contingência (decisão 4 do Marco)', () => {
  it('ligar o imposto não mexe em custoItens, contingência nem custoTotal', () => {
    const sem = computeCenario(eventoBase(), 'realista')
    const com = computeCenario(ligar(['bilheteria', 'bar', 'patrocinio'], 20), 'realista')
    expect(com.custoItens).toBe(sem.custoItens)
    expect(com.contingencia).toBe(sem.contingencia)
    expect(com.custoTotal).toBe(sem.custoTotal)
  })

  it('a contingência continua sendo 10% dos CUSTOS, com imposto de R$ 2.600 na conta', () => {
    const c = computeCenario(ligar(['bilheteria', 'bar', 'patrocinio'], 20), 'realista')
    // base = 10.000 (bruta) + 2.000 (bar) + 1.000 (patrocínio) = 13.000
    expect(c.imposto.base).toBe(13000)
    expect(c.imposto.valor).toBe(2600)
    // Se o imposto tivesse virado custo, a contingência seria 10% de
    // (3.000 + 2.600) = 560. Ela é 300 — 10% dos 3.000 de custo, e mais nada.
    expect(c.contingencia).toBe(300)
    expect(c.contingencia).not.toBe(560)
  })

  it('o imposto sai do LUCRO, não do custo: receita − imposto − custo', () => {
    const c = computeCenario(ligar(['bilheteria', 'bar', 'patrocinio'], 20), 'realista')
    expect(c.receitaTotal).toBe(12500) // a receita total NÃO muda com o imposto
    expect(c.lucro).toBe(12500 - 2600 - 3300)
    expect(c.lucro).toBe(6600)
  })

  it('a margem usa o lucro DEPOIS do imposto (a tela não pode ter duas margens)', () => {
    const c = computeCenario(ligar(['bilheteria'], 10), 'realista')
    expect(c.margem).toBeCloseTo((c.lucro / c.receitaTotal) * 100, 10)
    expect(c.lucro).toBe(12500 - 1000 - 3300)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 5. CADA CHAVE SOZINHA, E AS TRÊS JUNTAS
// ─────────────────────────────────────────────────────────────────────────

describe('as três chaves, uma a uma e juntas', () => {
  const casos = [
    ['bilheteria', 10000, 1000],
    ['bar', 2000, 200],
    ['patrocinio', 1000, 100],
  ]
  for (const [base, valorBase, imposto] of casos) {
    it(`só "${base}": base R$ ${valorBase}, imposto R$ ${imposto} a 10%`, () => {
      const c = computeCenario(ligar([base]), 'realista')
      expect(c.imposto.bases).toEqual([base])
      expect(c.imposto.base).toBe(valorBase)
      expect(c.imposto.valor).toBe(imposto)
      expect(c.lucro).toBe(12500 - imposto - 3300)
    })
  }

  it('as três juntas somam as três bases, e a ordem é a do DRE', () => {
    const c = computeCenario(ligar(['bilheteria', 'bar', 'patrocinio']), 'realista')
    expect(c.imposto.bases).toEqual(['bilheteria', 'bar', 'patrocinio'])
    expect(c.imposto.base).toBe(13000)
    expect(c.imposto.valor).toBe(1300)
  })

  it('duas chaves = a soma exata das duas sozinhas (nada de dupla contagem)', () => {
    const so1 = computeCenario(ligar(['bilheteria']), 'realista').imposto.valor
    const so2 = computeCenario(ligar(['bar']), 'realista').imposto.valor
    const juntas = computeCenario(ligar(['bilheteria', 'bar']), 'realista').imposto.valor
    expect(juntas).toBe(so1 + so2)
  })

  it('só o patrocínio FECHADO entra na base — proposta fica de fora', () => {
    const ev = {
      ...ligar(['patrocinio']),
      patrocinios: [
        { id: 'p1', patrocinador: 'Fechado', valor: 1000, estagio: 'confirmado' },
        { id: 'p2', patrocinador: 'Proposta', valor: 9000, estagio: 'proposta' },
      ],
    }
    const c = computeCenario(ev, 'realista')
    expect(c.patrocinioPotencial).toBe(9000)
    expect(c.imposto.base).toBe(1000)
    expect(c.imposto.valor).toBe(100)
  })

  it('open bar zera a receita de bar E a base do bar junto (não sobra imposto órfão)', () => {
    const c = computeCenario({ ...ligar(['bar']), openBar: true }, 'realista')
    expect(c.bar).toBe(0)
    expect(c.imposto.base).toBe(0)
    expect(c.imposto.valor).toBe(0)
  })

  it('cada cenário tem o próprio imposto — base menor no pessimista', () => {
    const ev = {
      ...ligar(['bilheteria']),
      cenariosConfig: {
        pessimista: { vendaPct: 50, custoPct: 0 },
        realista: { vendaPct: 100, custoPct: 0 },
        otimista: { vendaPct: 100, custoPct: 0 },
      },
    }
    const c = computeCenarios(ev)
    expect(c.pessimista.imposto.valor).toBe(500) // 50 pagos × R$ 100 × 10%
    expect(c.realista.imposto.valor).toBe(1000)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 6. O R$ 0 QUE SABE EXPLICAR POR QUÊ
// ─────────────────────────────────────────────────────────────────────────

describe('R$ 0 com história: chave desligada × alíquota zero', () => {
  it('alíquota 10% com NENHUMA base marcada: R$ 0, e o texto diz que é por falta de base', () => {
    const c = computeCenario(ligar([], 10), 'realista')
    expect(c.imposto.valor).toBe(0)
    expect(impostoTexto(c.imposto)).toBe('10% — nenhuma base marcada')
    expect(c.lucro).toBe(12500 - 3300)
  })

  it('alíquota 0% com a bilheteria marcada: R$ 0, e o texto diz que a alíquota é ZERO', () => {
    const c = computeCenario(ligar(['bilheteria'], 0), 'realista')
    expect(c.imposto.valor).toBe(0)
    expect(impostoTexto(c.imposto)).toBe('0% sobre bilheteria bruta')
  })

  it('alíquota EM BRANCO com base marcada: R$ 0, e o texto separa "vazia" de "zero"', () => {
    const c = computeCenario(ligar(['bilheteria'], ''), 'realista')
    expect(c.imposto.valor).toBe(0)
    expect(c.imposto.vazia).toBe(true)
    expect(impostoTexto(c.imposto)).toBe('alíquota não preenchida — bilheteria bruta marcada')
  })

  it('os três R$ 0 dão o mesmo número e TRÊS textos diferentes — que é o ponto', () => {
    const textos = [
      impostoTexto(computeCenario(ligar([], 10), 'realista').imposto),
      impostoTexto(computeCenario(ligar(['bilheteria'], 0), 'realista').imposto),
      impostoTexto(computeCenario(ligar(['bilheteria'], ''), 'realista').imposto),
    ]
    expect(new Set(textos).size).toBe(3)
  })

  it('a lista das bases sai em português, sem vírgula antes do "e"', () => {
    const um = computeCenario(ligar(['bar'], 5), 'realista').imposto
    const dois = computeCenario(ligar(['bilheteria', 'bar'], 5), 'realista').imposto
    const tres = computeCenario(ligar(['bilheteria', 'bar', 'patrocinio'], 5), 'realista').imposto
    expect(impostoTexto(um)).toBe('5% sobre bar')
    expect(impostoTexto(dois)).toBe('5% sobre bilheteria bruta e bar')
    expect(impostoTexto(tres)).toBe('5% sobre bilheteria bruta, bar e patrocínio')
    expect(impostoLinhaLabel(tres)).toBe(
      'Imposto sobre a receita (5% sobre bilheteria bruta, bar e patrocínio)'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 7. FORMA ESTRITA — backup torto nunca liga imposto sozinho
// ─────────────────────────────────────────────────────────────────────────

describe('forma estrita das chaves (a filosofia do openBar, aqui valendo dobrado)', () => {
  const tortos = ['true', 1, 'sim', {}, [], 'on', -1]
  for (const t of tortos) {
    it(`valor torto ${JSON.stringify(t)} NÃO liga a base`, () => {
      expect(formaImpostoSobre({ bilheteria: t }).bilheteria).toBe(false)
      const ev = eventoBase({ impostoPct: 10, impostoSobre: { bilheteria: t } })
      expect(computeCenario(ev, 'realista').imposto.valor).toBe(0)
    })
  }

  it('objeto ausente/torto vira as três desligadas', () => {
    expect(formaImpostoSobre(undefined)).toEqual({ bilheteria: false, bar: false, patrocinio: false })
    expect(formaImpostoSobre('bilheteria')).toEqual({ bilheteria: false, bar: false, patrocinio: false })
    expect(impostoSobreDoEvento({})).toEqual({ bilheteria: false, bar: false, patrocinio: false })
  })

  it('SÓ o booleano exato `true` liga', () => {
    expect(formaImpostoSobre({ bilheteria: true, bar: false })).toEqual({
      bilheteria: true,
      bar: false,
      patrocinio: false,
    })
  })

  it('a migração trava a alíquota em 0..100 — 150% herdado vira "não preenchida"', () => {
    expect(migrarEvento(eventoBase({ impostoPct: 150 })).impostoPct).toBe('')
    expect(migrarEvento(eventoBase({ impostoPct: -5 })).impostoPct).toBe('')
    expect(migrarEvento(eventoBase({ impostoPct: 'abc' })).impostoPct).toBe('')
    expect(migrarEvento(eventoBase({ impostoPct: 10 })).impostoPct).toBe(10)
    // Ponto decimal em string é preservado; VÍRGULA não — e isso não é um
    // defeito desta sessão, é a régua da casa (DECIMAL_NUMERICO em
    // migracao.js) valendo igualzinho para a taxa e o cashback. Fixado aqui
    // para que uma sessão futura que "conserte" só o imposto veja em vermelho
    // que acabou de criar uma régua diferente das irmãs. Na tela isso nunca
    // aparece: o campo converte a vírgula ANTES de salvar (campoNumerico.js).
    expect(migrarEvento(eventoBase({ impostoPct: '10.5' })).impostoPct).toBe('10.5')
    expect(migrarEvento(eventoBase({ impostoPct: '10,5' })).impostoPct).toBe(
      migrarEvento(eventoBase({ taxaBilheteria: '10,5' })).taxaBilheteria
    )
  })

  it('migrar duas vezes = migrar uma (idempotência, com imposto ligado)', () => {
    const uma = migrarEvento(ligar(['bilheteria', 'bar'], 12))
    expect(migrarEvento(uma)).toStrictEqual(uma)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 8. O MÓDULO SOZINHO, sem passar por calc.js
// ─────────────────────────────────────────────────────────────────────────

describe('impostoDoCenario, chamado direto', () => {
  it('devolve null quando o evento não tem imposto configurado', () => {
    expect(impostoDoCenario({}, { bruta: 100, bar: 100, patrocinio: 100 })).toBeNull()
  })

  it('valores ausentes contam como zero, sem NaN', () => {
    const imp = impostoDoCenario({ impostoPct: 10, impostoSobre: { bilheteria: true } }, {})
    expect(imp.base).toBe(0)
    expect(imp.valor).toBe(0)
    expect(Number.isNaN(imp.valor)).toBe(false)
  })

  it('impostoTexto("") e temImposto(undefined) não explodem', () => {
    expect(impostoTexto(null)).toBe('')
    expect(temImposto(undefined)).toBe(false)
    expect(impostoValor(undefined)).toBe(0)
  })
})

describe('base NEGATIVA não gera imposto (Marco, 28/07/2026)', () => {
  // O bar pode dar prejuízo — barPorPessoa devolve negativo quando o custo do
  // sistema supera o consumo. Sem a trava, a base ia negativa, o imposto ia
  // negativo, e como o lucro é receita − imposto − custo, ele SOMAVA. Um
  // crédito tributário que não existe, melhorando o cenário que decide a festa.
  // Achado pelo revisor, não pelos testes — a rede é esta.
  const comImposto = (pct, sobre) => ({
    impostoPct: pct,
    impostoSobre: { bilheteria: false, bar: false, patrocinio: false, ...sobre },
  })

  it('bar negativo contribui ZERO, não um crédito', () => {
    const r = impostoDoCenario(comImposto(10, { bar: true }), { bruta: 0, bar: -4800, patrocinio: 0 })
    expect(r.base).toBe(0)
    expect(r.valor).toBe(0)
  })

  it('o caso REAL: bar negativo não pode melhorar o lucro do pessimista', () => {
    // Marfim Alto Cine tinha custo de sistema de R$ 4.800 salvo; com o
    // ticket de bar do pessimista em branco o bar dá −R$ 4.800.
    const r = impostoDoCenario(comImposto(10, { bar: true }), { bruta: 0, bar: -4800, patrocinio: 0 })
    expect(r.valor).not.toBeLessThan(0)
  })

  it('a trava é POR BASE: um bar negativo NÃO abate da bilheteria', () => {
    // Somando primeiro e travando depois, os −4.800 do bar reduziriam a base
    // dos ingressos e o app cobraria menos imposto do que se deve.
    const r = impostoDoCenario(comImposto(10, { bilheteria: true, bar: true }), {
      bruta: 250000,
      bar: -4800,
      patrocinio: 0,
    })
    expect(r.base).toBeCloseTo(250000, 2)
    expect(r.valor).toBeCloseTo(25000, 2)
  })

  it('base positiva continua exatamente como era', () => {
    const r = impostoDoCenario(comImposto(10, { bilheteria: true, bar: true, patrocinio: true }), {
      bruta: 10000,
      bar: 2000,
      patrocinio: 1000,
    })
    expect(r.base).toBe(13000)
    expect(r.valor).toBe(1300)
  })
})
