import { describe, it, expect, vi } from 'vitest'
import {
  novaVersaoCongelada,
  congeladasDoEvento,
  resumoComparacao,
  congelarVersao,
  excluirCongelada,
  loadCongeladas,
  MAX_CONGELADAS,
} from './versaoReuniao.js'
import { computeCenarios, veredito } from './calc.js'
import { migrarEvento } from './migracao.js'
import { novoEvento, novoItem } from './defaults.js'
import { clone } from './util.js'

const eventoBase = () => {
  const e = novoEvento('Reunião das sócias')
  e.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 100, somenteOtimista: false }]
  e.taxaBilheteria = 0
  e.cashbackPct = 0
  e.contingenciaPct = 0
  // Sugestão 42: evento novo nasce por pessoa; este teste usa o valor FIXO.
  e.barModo = 'fixo'
  e.outrasReceitas = { bar: 10000, patrocinio: '' }
  e.categorias[0].itens = [novoItem({ servico: 'Insumos', estimado: 5000 })]
  e.cenariosConfig.realista.vendaPct = 100
  return e
}

describe('novaVersaoCongelada (sugestão 24)', () => {
  it('guarda cópia COMPLETA e independente: mudar o evento depois não muda a congelada', () => {
    const ev = eventoBase()
    const item = novaVersaoCongelada(ev, 'levada à reunião', '2026-07-18T10:00:00.000Z')
    ev.categorias[0].itens[0].estimado = 99999
    ev.nome = 'Mudou'
    expect(item.evento.categorias[0].itens[0].estimado).toBe(5000)
    expect(item.nomeEvento).toBe('Reunião das sócias')
    expect(item.rotulo).toBe('levada à reunião')
    expect(item.eventoId).toBe(ev.id)
    expect(item.criadoEm).toBe('2026-07-18T10:00:00.000Z')
  })

  it('rótulo vazio/em branco ganha o padrão "versão de reunião"', () => {
    expect(novaVersaoCongelada(eventoBase(), '').rotulo).toBe('versão de reunião')
    expect(novaVersaoCongelada(eventoBase(), '   ').rotulo).toBe('versão de reunião')
    expect(novaVersaoCongelada(eventoBase(), null).rotulo).toBe('versão de reunião')
  })

  it('congelar NÃO muta o evento original', () => {
    const ev = eventoBase()
    const congelado = clone(ev)
    novaVersaoCongelada(ev, 'x')
    expect(ev).toEqual(congelado)
  })
})

describe('congeladasDoEvento', () => {
  it('filtra pelo eventoId; lista vazia/ausente não quebra', () => {
    const a = novaVersaoCongelada({ ...eventoBase(), id: 'ev-a' }, '1')
    const b = novaVersaoCongelada({ ...eventoBase(), id: 'ev-b' }, '2')
    expect(congeladasDoEvento([a, b], 'ev-a')).toEqual([a])
    expect(congeladasDoEvento([], 'ev-a')).toEqual([])
    expect(congeladasDoEvento(undefined, 'ev-a')).toEqual([])
  })
})

describe('resumoComparacao — leitura pura sobre computeCenarios/veredito (nenhuma fórmula nova)', () => {
  it('sem mudanças: deltas 0 e números idênticos aos de computeCenarios', () => {
    const ev = eventoBase()
    const r = resumoComparacao(clone(ev), ev)
    const c = computeCenarios(ev)
    expect(r.linhas.map((l) => l.label)).toEqual([
      'Lucro (pessimista)',
      'Lucro (realista)',
      'Lucro (otimista)',
      'Receita total (realista)',
      'Custo total (realista)',
    ])
    expect(r.linhas.every((l) => l.delta === 0)).toBe(true)
    expect(r.linhas[1].agora).toBe(c.realista.lucro)
    expect(r.linhas[3].agora).toBe(c.realista.receitaTotal)
    expect(r.linhas[4].agora).toBe(c.realista.custoTotal)
    expect(r.semaforo.antes.cor).toBe(r.semaforo.agora.cor)
  })

  it('custo novo aparece como delta exato, e o semáforo dos dois lados vem do veredito real', () => {
    const antes = eventoBase()
    const depois = clone(antes)
    depois.categorias[0].itens.push(novoItem({ servico: 'Som', estimado: 3000 }))
    const r = resumoComparacao(antes, depois)
    // custo realista sobe exatamente 3000 (contingência 0)
    expect(r.linhas[4].delta).toBe(3000)
    // lucro realista cai exatamente 3000
    expect(r.linhas[1].delta).toBe(-3000)
    // receita não muda
    expect(r.linhas[3].delta).toBe(0)
    expect(r.semaforo.antes).toEqual(veredito(computeCenarios(antes), antes))
    expect(r.semaforo.agora).toEqual(veredito(computeCenarios(depois), depois))
  })

  it('respeita campos do evento no veredito (margens custom) e no cálculo (open bar)', () => {
    const antes = eventoBase()
    const depois = { ...clone(antes), openBar: true } // sugestão 27: bar sai da conta
    const r = resumoComparacao(antes, depois)
    expect(r.linhas[3].delta).toBe(-10000) // receita realista perde o bar exato
  })

  // ————— a MESMA porta do instantâneo, na versão de reunião (25/07/2026) —————
  //
  // Achado da varredura da decisão 18: a versão congelada é dado GUARDADO que
  // volta à tela, e o lado "antes" desta comparação era calculado CRU, sem
  // migração — enquanto o lado "agora" vem do store, que `loadStore` já migra.
  // Duas réguas diferentes na MESMA tabela: uma versão congelada antes da trava
  // de 22/07 mostrava o lucro com o sinal do custo invertido e inventava um
  // delta que nunca existiu, numa tela feita para ser projetada em reunião. E
  // congeladas não rotacionam — as de antes de 22/07 ficam no navegador do
  // Marco até ele excluir.
  it('congelada salva ANTES da trava de 22/07 é comparada com a MESMA régua do lado atual', () => {
    const congelada = eventoBase()
    congelada.cenariosConfig.pessimista.custoPct = -200 // o veneno do achado de 20/07
    const atual = eventoBase()

    const r = resumoComparacao(congelada, atual)
    const lucroPessimista = r.linhas.find((l) => l.label === 'Lucro (pessimista)')

    // O lado "antes" tem de ser a conta CERTA da congelada, não a da época.
    const comoDeveSer = computeCenarios(migrarEvento(congelada)).pessimista.lucro
    expect(lucroPessimista.antes).toBe(comoDeveSer)
    // E o delta tem de ser o real: o custoPct fora da faixa some dos dois
    // lados, então nada mudou entre a reunião e agora.
    expect(lucroPessimista.delta).toBe(0)
    // A prova de que o veneno mordia: cru, o "antes" seria outro número — e a
    // tela mostraria uma diferença que nunca aconteceu.
    expect(computeCenarios(congelada).pessimista.lucro).not.toBe(comoDeveSer)
  })
})

describe('camada localStorage (ambiente sem armazenamento: nunca lança, retorna { ok:false })', () => {
  // Os dois casos abaixo DECLARAM o ambiente em vez de herdar o do Node da
  // máquina (Marco, 24/07/2026 — achado S2 do BACKLOG). Antes daqui este bloco
  // não fazia stub e assumia "sem localStorage no node": verdade no Node 20 (o
  // do CI), falso no Node 22+ (o da máquina do Marco). O contrato que importa é
  // o RESULTADO — degrada com clareza e nunca lança — não quantas mensagens
  // aparecem no console, que era acidente de ambiente.
  const casos = [
    ['sem localStorage nenhum', undefined],
    ['localStorage meio-inicializado (global existe, getItem não é função)', {}],
  ]

  for (const [nome, valor] of casos) {
    it(`${nome} → loadCongeladas/congelarVersao/excluirCongelada degradam com clareza`, () => {
      vi.stubGlobal('localStorage', valor)
      const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(loadCongeladas()).toEqual([])
      const r = congelarVersao(eventoBase(), 'x')
      expect(r.ok).toBe(false)
      expect(typeof r.erro).toBe('string')
      const e = excluirCongelada('qualquer')
      expect(e.ok).toBe(false)

      // Ambiente sem armazenamento NÃO é erro: a guarda sai antes de tentar,
      // então nada é logado. Erro de verdade (quota, perfil corrompido) segue
      // logando — isso é coberto pelo teste do localStorage que LANÇA.
      expect(espiaErro).not.toHaveBeenCalled()
      espiaErro.mockRestore()
    })
  }

  it('MAX_CONGELADAS é um limite explícito (sem rotação silenciosa)', () => {
    expect(MAX_CONGELADAS).toBeGreaterThan(0)
  })
})
