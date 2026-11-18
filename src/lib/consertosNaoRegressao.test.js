// PROVA DE NÃO-REGRESSÃO dos dois consertos de 20/07/2026 (relógio local +
// identidade das linhas de backup antigo).
//
// A regra permanente do Marco é "NUNCA QUEBRE NADA": estes dois consertos
// existem para o trabalho da noite subir sem defeito conhecido, então se um
// deles mexer em QUALQUER número, ele falhou no próprio propósito. Este
// arquivo é o que prova que não mexeram.
//
// Três frentes:
//  1. FUZZ — centenas de eventos gerados (futuros, passados e NO DIA da
//     festa), com todos os números exibidos comparados COM e SEM o id
//     preenchido, e com o relógio variando dentro do dia;
//  2. ROUND-TRIP — backup JSON antigo (sem id, datas variadas) → importa →
//     exporta → nada se perdeu e a ORDEM das linhas é a mesma;
//  3. GUARDA — o relógio não pode voltar a ser duplicado nem voltar ao UTC.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { migrarEvento, migrarEventos } from './migracao.js'
import { migrarStatusCusto } from './statusCusto.js'
import { montarBackup, parseBackup } from './storage.js'
import { computeCenarios } from './calc.js'
import { resumoCurto, resumoCompleto, linhaRitmoRelatorio } from './resumo.js'
import { hojeISO } from './dataLocal.js'

afterEach(() => vi.useRealTimers())

// ————————————————————— gerador determinístico —————————————————————
// Semente fixa: o fuzz precisa ser reproduzível para uma falha ser
// investigável (rodar de novo tem de dar o mesmo caso).
function rng(semente) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const STATUS = ['ORÇAR', 'NEGOCIANDO', 'FECHADO', 'PAGO']

/** Evento SEM id em lotes e itens — a forma do backup antigo do Marco. */
function eventoAleatorioLegado(r, dataISO) {
  const nLotes = 1 + Math.floor(r() * 6)
  const nCats = 1 + Math.floor(r() * 4)
  return {
    id: `ev-${Math.floor(r() * 1e9)}`,
    nome: `Festa ${Math.floor(r() * 1000)}`,
    data: dataISO,
    local: 'O Galeao',
    publicoEstimado: Math.floor(r() * 800),
    taxaBilheteria: Math.floor(r() * 15),
    cashbackPct: Math.floor(r() * 10),
    contingenciaPct: Math.floor(r() * 12),
    descontoMedioPct: r() < 0.4 ? Math.floor(r() * 30) : '',
    taxaPagaPor: r() < 0.3 ? 'cliente' : '',
    openBar: r() < 0.2,
    barModo: r() < 0.5 ? 'porPessoa' : 'fixo',
    barTicket: { pessimista: 80, realista: 110, otimista: 140 },
    barTaxaSistemaPct: Math.floor(r() * 8),
    barCustoSistema: Math.floor(r() * 2000),
    vendidosAteHoje: r() < 0.7 ? Math.floor(r() * 500) : '',
    outrasReceitas: { bar: Math.floor(r() * 20000), patrocinio: '' },
    caixaInicial: Math.floor(r() * 5000),
    lotes: Array.from({ length: nLotes }, (_, i) => ({
      nome: `Lote ${i + 1}`,
      valor: 40 + Math.floor(r() * 160),
      quantidade: Math.floor(r() * 250),
      somenteOtimista: r() < 0.2,
    })),
    categorias: Array.from({ length: nCats }, (_, c) => ({
      id: `cat-${c}`,
      nome: `Categoria ${c}`,
      itens: Array.from({ length: Math.floor(r() * 5) }, (_, j) => ({
        servico: `Serviço ${c}-${j}`,
        estimado: Math.floor(r() * 9000),
        realizado: r() < 0.5 ? Math.floor(r() * 9000) : '',
        status: STATUS[Math.floor(r() * STATUS.length)],
      })),
    })),
  }
}

/** Remove SÓ os ids que a migração preencheu — o resultado é exatamente o
 *  que a migração ANTIGA produzia para o mesmo evento. */
function semIdsLegados(evento) {
  const tira = (o) => {
    if (!o || typeof o !== 'object') return o
    if (typeof o.id === 'string' && o.id.startsWith('legado-')) {
      const { id, ...resto } = o
      return resto
    }
    return o
  }
  return {
    ...evento,
    lotes: Array.isArray(evento.lotes) ? evento.lotes.map(tira) : evento.lotes,
    categorias: Array.isArray(evento.categorias)
      ? evento.categorias.map((c) =>
          c && Array.isArray(c.itens) ? { ...c, itens: c.itens.map(tira) } : c
        )
      : evento.categorias,
  }
}

/** TODOS os números que o app exibe a partir de um evento. */
function numerosExibidos(evento, hoje) {
  const c = computeCenarios(evento)
  return JSON.stringify({
    cenarios: c,
    resumoCurto: resumoCurto(evento, { hoje }),
    resumoCompleto: resumoCompleto(evento, { hoje }),
    ritmoRelatorio: linhaRitmoRelatorio(evento, c.realista.breakEven, hoje),
  })
}

// ⚠️ ————————————————— ACHADO DO FUZZ (20/07/2026) —————————————————
//
// O fuzz abaixo foi escrito para provar que "preencher o id não move um único
// número". ELE FALHOU — e a falha não estava no conserto, estava no app.
//
// `computeCenario` (calc.js:345) indexa as quantidades por id:
//     for (const l of evento.lotes || []) qtds[l.id] = loteQtdCenario(...)
// Com TODOS os lotes sem id, `qtds[undefined]` é UM slot só: cada lote
// sobrescreve o anterior e todos acabam lendo a quantidade do ÚLTIMO lote.
// Três lotes de 10, 20 e 30 ingressos a R$ 100 exibem R$ 9.000 (30+30+30) em
// vez de R$ 6.000 — receita 50% inflada, num app onde "um número errado
// mostrado como certo é o pior bug possível".
//
// Consequência para os consertos: preencher o id de LOTE em dado legado
// CORRIGE esse número — ou seja, MUDA o que a tela mostra para eventos
// antigos. Isso ultrapassa o que foi autorizado ("nada muda de número") e
// está parado esperando decisão do Marco. Os testes abaixo dizem a verdade
// sobre os dois casos, em vez de afirmar uma invariância que não existe.
//
// Itens de custo NÃO têm esse problema: calc.js soma itens iterando, nunca
// indexando por id — o teste logo abaixo prova. A metade "itens" do conserto
// é numericamente inerte; a metade "lotes" não é.

describe('FUZZ — o que muda e o que não muda ao preencher o id', () => {
  // TEMPO DECLARADO (07/10/2026, plano dos centavos): sob a suíte inteira, na base, este teste
  // mediu 4.172 ms de um limite de 5.000 ms — sobrava 17% — e a régua do
  // centavo deixou o cálculo de 20% a 60% mais lento. Teste que falha por CARGA é lido
  // como "flaky, roda de novo" (ver a mesma decisão em comparacaoCustos.test.js).
  it('evento cujos lotes JÁ TÊM id: 300 casos, nenhum número se move', { timeout: 20_000 }, () => {
    const r = rng(20260720)
    const hoje = '2026-07-20'
    const datas = ['2026-07-20', '2026-09-15', '2025-11-02', '2026-07-21', '2026-07-19', '']
    for (let n = 0; n < 300; n++) {
      const bruto = eventoAleatorioLegado(r, datas[n % datas.length])
      // o caso realista: lote criado dentro do app sempre teve id
      bruto.lotes.forEach((l, i) => (l.id = `lote-real-${i}`))
      const comId = migrarEvento(bruto)
      const semId = semIdsLegados(comId) // só os ids de ITEM saem
      expect(numerosExibidos(semId, hoje)).toBe(numerosExibidos(comId, hoje))
    }
  })

  it('id de ITEM DE CUSTO é numericamente inerte (300 casos)', { timeout: 20_000 }, () => {
    const r = rng(555)
    const hoje = '2026-07-20'
    for (let n = 0; n < 300; n++) {
      const bruto = eventoAleatorioLegado(r, '2026-07-20')
      bruto.lotes.forEach((l, i) => (l.id = `lote-real-${i}`))
      const comId = migrarEvento(bruto)
      const semItens = {
        ...comId,
        categorias: comId.categorias.map((c) => ({
          ...c,
          itens: c.itens.map(({ id, ...resto }) => (String(id).startsWith('legado-') ? resto : { id, ...resto })),
        })),
      }
      expect(numerosExibidos(semItens, hoje)).toBe(numerosExibidos(comId, hoje))
    }
  })

  it('⚠️ id de LOTE MUDA o número em dado legado — porque conserta um erro real', () => {
    const evento = {
      id: 'ev', nome: 'x', data: '2026-07-20', publicoEstimado: 0, taxaBilheteria: 0,
      cashbackPct: 0, contingenciaPct: 0, outrasReceitas: { bar: 0, patrocinio: '' },
      patrocinios: [], categorias: [],
      lotes: [
        { nome: 'A', valor: 100, quantidade: 10 },
        { nome: 'B', valor: 100, quantidade: 20 },
        { nome: 'C', valor: 100, quantidade: 30 },
      ],
    }
    const semId = computeCenarios(evento).otimista
    const comId = computeCenarios(migrarEvento(evento)).otimista

    // hoje (sem id): os três lotes leem a quantidade do ÚLTIMO — 30+30+30
    expect(semId.porLote.map((l) => l.qtd)).toEqual([30, 30, 30])
    expect(semId.bruta).toBe(9000)

    // com o id preenchido: cada lote lê a SUA quantidade — 10+20+30
    expect(comId.porLote.map((l) => l.qtd)).toEqual([10, 20, 30])
    expect(comId.bruta).toBe(6000)
  })

  it('e o id preenchido é a ÚNICA diferença estrutural entre os dois', () => {
    const r = rng(777)
    for (let n = 0; n < 100; n++) {
      const comId = migrarEvento(eventoAleatorioLegado(r, '2026-07-20'))
      const semId = semIdsLegados(comId)
      // tirando os ids legados dos dois lados, os objetos são iguais
      expect(JSON.stringify(semIdsLegados(semId))).toBe(JSON.stringify(semId))
      // e todo lote/item do lado migrado tem identidade
      for (const l of comId.lotes) expect(typeof l.id).toBe('string')
      for (const c of comId.categorias) for (const i of c.itens) expect(typeof i.id).toBe('string')
    }
  })

  it('os cenários não dependem do relógio: 00h01, 21h30 e 23h59 dão os MESMOS números', () => {
    const r = rng(31337)
    const evento = migrarEvento(eventoAleatorioLegado(r, '2026-07-20'))
    const horas = [
      [0, 1],
      [12, 0],
      [21, 30],
      [23, 59],
    ]
    const vistos = new Set()
    for (const [h, m] of horas) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 20, h, m, 0, 0))
      expect(hojeISO()).toBe('2026-07-20')
      vistos.add(JSON.stringify(computeCenarios(evento)))
      vi.useRealTimers()
    }
    expect(vistos.size).toBe(1)
  })
})

describe('ROUND-TRIP — backup antigo entra e sai inteiro', () => {
  const backupAntigo = () => {
    const r = rng(4242)
    return {
      app: 'previsao-eventos',
      versao: 1,
      exportadoEm: '2026-01-05T10:00:00.000Z',
      eventos: [
        eventoAleatorioLegado(r, '2026-07-20'),
        eventoAleatorioLegado(r, '2025-12-05'),
        eventoAleatorioLegado(r, '2026-11-30'),
        eventoAleatorioLegado(r, ''),
      ],
      benchmarksCustom: [],
    }
  }

  it('importa → exporta: nenhum evento, lote, item ou valor se perde', () => {
    const original = backupAntigo()
    const lido = parseBackup(JSON.stringify(original))
    const reexportado = montarBackup({ ...lido, ajustes: lido.ajustes || undefined })

    expect(reexportado.eventos).toHaveLength(original.eventos.length)
    original.eventos.forEach((orig, k) => {
      const volta = reexportado.eventos[k]
      expect(volta.id).toBe(orig.id)
      expect(volta.nome).toBe(orig.nome)
      expect(volta.data).toBe(orig.data)
      expect(volta.publicoEstimado).toBe(orig.publicoEstimado)
      expect(volta.taxaBilheteria).toBe(orig.taxaBilheteria)
      expect(volta.cashbackPct).toBe(orig.cashbackPct)
      expect(volta.contingenciaPct).toBe(orig.contingenciaPct)
      expect(volta.outrasReceitas.bar).toBe(orig.outrasReceitas.bar)

      // ORDEM e VALORES dos lotes, linha a linha
      expect(volta.lotes).toHaveLength(orig.lotes.length)
      orig.lotes.forEach((l, i) => {
        expect(volta.lotes[i].nome).toBe(l.nome)
        expect(volta.lotes[i].valor).toBe(l.valor)
        expect(volta.lotes[i].quantidade).toBe(l.quantidade)
        expect(volta.lotes[i].somenteOtimista).toBe(l.somenteOtimista)
        expect(typeof volta.lotes[i].id).toBe('string')
      })

      // ORDEM e VALORES dos itens de custo, linha a linha
      expect(volta.categorias).toHaveLength(orig.categorias.length)
      orig.categorias.forEach((c, ci) => {
        expect(volta.categorias[ci].itens).toHaveLength(c.itens.length)
        c.itens.forEach((it, ii) => {
          const v = volta.categorias[ci].itens[ii]
          expect(v.servico).toBe(it.servico)
          expect(v.estimado).toBe(it.estimado)
          expect(v.realizado).toBe(it.realizado)
          // status legado migra na volta (ORÇAR→ESTIMADO, NEGOCIANDO→NEGOCIAR) —
          // é o ponto do schema novo; o round-trip preserva o valor MIGRADO.
          expect(v.status).toBe(migrarStatusCusto(it.status))
          expect(typeof v.id).toBe('string')
        })
      })
    })
  })

  it('segunda volta pelo round-trip não muda mais nada (estável e idempotente)', () => {
    const original = backupAntigo()
    const um = montarBackup(parseBackup(JSON.stringify(original)))
    const dois = montarBackup(parseBackup(JSON.stringify(um)))
    expect(JSON.stringify(dois.eventos)).toBe(JSON.stringify(um.eventos))
  })

  it('os números dos eventos sobrevivem ao round-trip byte a byte (mesma migração dos dois lados)', () => {
    const original = backupAntigo()
    const um = montarBackup(parseBackup(JSON.stringify(original)))
    original.eventos.forEach((orig, k) => {
      // o evento migrado calcula igual ao evento cru original
      expect(JSON.stringify(computeCenarios(um.eventos[k]))).toBe(
        JSON.stringify(computeCenarios(migrarEvento(orig)))
      )
    })
  })

  it('backup com eventos que JÁ TÊM id: nenhum id existente muda', () => {
    const r = rng(99)
    const e = eventoAleatorioLegado(r, '2026-07-20')
    e.lotes.forEach((l, i) => (l.id = `id-real-lote-${i}`))
    e.categorias.forEach((c, ci) => c.itens.forEach((it, ii) => (it.id = `id-real-item-${ci}-${ii}`)))
    const [volta] = migrarEventos([e])
    volta.lotes.forEach((l, i) => expect(l.id).toBe(`id-real-lote-${i}`))
    volta.categorias.forEach((c, ci) =>
      c.itens.forEach((it, ii) => expect(it.id).toBe(`id-real-item-${ci}-${ii}`))
    )
  })
})

describe('GUARDA — o relógio não volta a se duplicar nem a virar UTC', () => {
  it('nenhum arquivo do app calcula "hoje" com toISOString fora de dataLocal.js', () => {
    const raiz = new URL('..', import.meta.url).pathname
    const arquivos = []
    const varrer = (dir) => {
      for (const nome of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, nome.name)
        if (nome.isDirectory()) varrer(p)
        else if (/\.(js|jsx)$/.test(nome.name) && !nome.name.includes('.test.')) arquivos.push(p)
      }
    }
    varrer(raiz)
    const infratores = arquivos.filter((p) => {
      if (p.endsWith('dataLocal.js')) return false
      return readFileSync(p, 'utf8')
        .split('\n')
        .some((linha) => {
          const semComentario = linha.replace(/\/\/.*$/, '')
          return /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/.test(semComentario)
        })
    })
    expect(infratores).toEqual([])
  })
})
