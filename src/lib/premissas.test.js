// Testes das premissas por festa (Sessão P — sugestão 20 do MELHORIAS.md).
// Regras cobertas: herança campo a campo (tipo → Padrão geral → padrões do
// app), premissa age SÓ no nascimento (novoEventoDoTipo apenas CRIA), evento
// sem nada configurado nasce EXATAMENTE como novoEvento(), e round-trip de
// backup — arquivo antigo sem o campo `ajustes` abre e não zera os atuais.
import { describe, it, expect } from 'vitest'
import {
  formaAjustes,
  ajustesVazio,
  premissaVazia,
  resolverPremissas,
  temPremissas,
  novoEventoDoTipo,
  custosPadraoEfetivos,
  lotesPadraoEfetivos,
  PADROES_APP,
  CAMPOS_EVENTO,
} from './premissas.js'
import { novoEvento } from './defaults.js'
import { isCortesia } from './calc.js'
import { CENARIOS } from './calc.js'
import { parseBackup, mesclarBackup } from './storage.js'

const ajustesExemplo = () => ({
  geral: {
    ...premissaVazia(),
    taxaBilheteria: 12,
    contingenciaPct: 8,
    cenarios: {
      ...premissaVazia().cenarios,
      realista: { vendaPct: 80, custoPct: '', ticketPct: '' },
    },
  },
  porTipo: {
    Brisa: {
      ...premissaVazia(),
      taxaBilheteria: 8,
      margemAlvo: 30,
      descontoMedioPct: 10,
      cenarios: {
        ...premissaVazia().cenarios,
        realista: { vendaPct: 85, custoPct: 5, ticketPct: '' },
      },
    },
  },
})

describe('formaAjustes — forma do campo aditivo do store', () => {
  it('ausente/inválido vira o vazio "herda tudo"', () => {
    expect(formaAjustes(null)).toEqual(ajustesVazio())
    expect(formaAjustes(undefined)).toEqual(ajustesVazio())
    expect(formaAjustes('lixo')).toEqual(ajustesVazio())
    expect(formaAjustes(42)).toEqual(ajustesVazio())
  })
  it('preserva números e strings numéricas; lixo em campo vira "" (= herda)', () => {
    const a = formaAjustes({
      geral: { taxaBilheteria: 12, cashbackPct: '4', margemAlvo: 'abc' },
      porTipo: { Brisa: { contingenciaPct: 7 } },
    })
    expect(a.geral.taxaBilheteria).toBe(12)
    expect(a.geral.cashbackPct).toBe('4')
    expect(a.geral.margemAlvo).toBe('')
    expect(a.porTipo.Brisa.contingenciaPct).toBe(7)
    expect(a.porTipo.Brisa.cenarios.realista.vendaPct).toBe('')
  })
  it('tipo com nome vazio é descartado; idempotente (forma da forma = forma)', () => {
    const a = formaAjustes({ porTipo: { '': { taxaBilheteria: 9 }, '  ': { cashbackPct: 1 } } })
    expect(Object.keys(a.porTipo)).toEqual([])
    const b = formaAjustes(ajustesExemplo())
    expect(formaAjustes(b)).toEqual(b)
  })
})

describe('resolverPremissas — herança tipo → Padrão geral → padrões do app', () => {
  it('sem nada configurado, tudo resolve nos padrões do app (origem "app")', () => {
    const r = resolverPremissas(null, 'Brisa')
    for (const campo of CAMPOS_EVENTO) {
      expect(r[campo]).toEqual({ valor: PADROES_APP[campo], origem: 'app' })
    }
    for (const cen of CENARIOS) {
      expect(r.cenarios[cen].vendaPct.valor).toBe(PADROES_APP.cenarios[cen].vendaPct)
      expect(r.cenarios[cen].vendaPct.origem).toBe('app')
    }
  })
  it('campo do tipo vence o geral; campo só no geral herda do geral; resto do app', () => {
    const r = resolverPremissas(ajustesExemplo(), 'Brisa')
    expect(r.taxaBilheteria).toEqual({ valor: 8, origem: 'tipo' }) // tipo vence geral (12)
    expect(r.contingenciaPct).toEqual({ valor: 8, origem: 'geral' })
    expect(r.cashbackPct).toEqual({ valor: 5, origem: 'app' })
    expect(r.margemAlvo).toEqual({ valor: 30, origem: 'tipo' })
    expect(r.cenarios.realista.vendaPct).toEqual({ valor: 85, origem: 'tipo' })
    expect(r.cenarios.realista.custoPct).toEqual({ valor: 5, origem: 'tipo' })
    // Padrão do app = 80 desde 27/07/2026 (decisão A do Marco).
    expect(r.cenarios.pessimista.vendaPct).toEqual({ valor: 80, origem: 'app' })
  })
  it('tipo sem premissa própria e evento SEM tipo herdam do Padrão geral (decisão registrada)', () => {
    const soGeral = resolverPremissas(ajustesExemplo(), 'Sobrado')
    expect(soGeral.taxaBilheteria).toEqual({ valor: 12, origem: 'geral' })
    expect(soGeral.cenarios.realista.vendaPct).toEqual({ valor: 80, origem: 'geral' })
    const semTipo = resolverPremissas(ajustesExemplo(), '')
    expect(semTipo.taxaBilheteria).toEqual({ valor: 12, origem: 'geral' })
  })
})

describe('temPremissas', () => {
  it('vazio não tem; qualquer campo preenchido (evento ou grade) tem', () => {
    expect(temPremissas(premissaVazia())).toBe(false)
    expect(temPremissas(null)).toBe(false)
    expect(temPremissas({ ...premissaVazia(), taxaBilheteria: 8 })).toBe(true)
    expect(
      temPremissas({
        ...premissaVazia(),
        cenarios: { ...premissaVazia().cenarios, otimista: { vendaPct: 95, custoPct: '', ticketPct: '' } },
      })
    ).toBe(true)
  })
})

describe('novoEventoDoTipo — premissa age SÓ no nascimento', () => {
  // ids e timestamps variam por natureza; o resto tem que ser IGUAL.
  const semVariaveis = (e) => ({
    ...e,
    id: '#',
    criadoEm: '#',
    atualizadoEm: '#',
    lotes: e.lotes.map((l) => ({ ...l, id: '#' })),
  })

  it('sem premissa nenhuma configurada, nasce EXATAMENTE como novoEvento() + tipo', () => {
    expect(semVariaveis(novoEventoDoTipo('Brisa', null))).toEqual(
      semVariaveis({ ...novoEvento(), tipo: 'Brisa' })
    )
    expect(semVariaveis(novoEventoDoTipo('', ajustesVazio()))).toEqual(
      semVariaveis(novoEvento())
    )
  })
  it('campo resolvido no nível "app" não é regravado: sem premissa de margem, o evento nem ganha a chave', () => {
    const ev = novoEventoDoTipo('Brisa', null)
    expect('margemAlvo' in ev).toBe(false)
    expect('margemMinima' in ev).toBe(false)
    expect(ev.descontoMedioPct).toBe('') // o '' de sempre do novoEvento
  })
  it('nasce com as premissas do tipo (e herdadas do geral), tudo numérico', () => {
    const ev = novoEventoDoTipo('Brisa', ajustesExemplo())
    expect(ev.tipo).toBe('Brisa')
    expect(ev.taxaBilheteria).toBe(8) // do tipo
    expect(ev.contingenciaPct).toBe(8) // do geral
    expect(ev.cashbackPct).toBe(5) // padrão do app (novoEvento)
    expect(ev.margemAlvo).toBe(30)
    expect(ev.descontoMedioPct).toBe(10)
    expect(ev.cenariosConfig.realista).toEqual({ vendaPct: 85, custoPct: 5 })
    expect(ev.cenariosConfig.pessimista).toEqual({ vendaPct: 80, custoPct: 10 }) // app (80 desde 27/07/2026)
    expect(ev.cenariosConfig.otimista).toEqual({ vendaPct: 100, custoPct: -5 }) // app
  })
  it('string numérica de premissa vira número no evento', () => {
    const ev = novoEventoDoTipo('X', { porTipo: { X: { taxaBilheteria: '7,5'.replace(',', '.') } } })
    expect(ev.taxaBilheteria).toBe(7.5)
  })
  it('só CRIA: os ajustes passados não são mutados', () => {
    const a = ajustesExemplo()
    const antes = JSON.stringify(a)
    novoEventoDoTipo('Brisa', a)
    expect(JSON.stringify(a)).toBe(antes)
  })
})

// ---------------------------------------------------------------- sugestão 21
describe('custos padrão por festa (sugestão 21) — lista do Marco, nunca derivada de evento', () => {
  const ajustesComCustos = () => ({
    geral: {
      custosPadrao: [{ id: 'g1', categoria: 'locacao', servico: 'Alvará', estimado: 5000 }],
    },
    porTipo: {
      Brisa: {
        custosPadrao: [
          { id: 'c1', categoria: 'aeb', servico: 'Gelo', estimado: 3000 },
          { id: 'c2', categoria: 'locacao', servico: 'ECAD', estimado: '4500' },
          { id: 'c3', categoria: 'estrutura', servico: 'Ambulância', estimado: '' },
        ],
      },
    },
  })

  it('forma: categoria desconhecida vira "extras" (valor visível, nunca some calado); lixo é descartado; id gerado', () => {
    const a = formaAjustes({
      geral: {
        custosPadrao: [
          { categoria: 'inexistente', servico: 'Misterioso', estimado: 100 },
          'lixo',
          null,
          { id: 'ok', categoria: 'aeb', servico: 'Gelo', estimado: 'abc' },
        ],
      },
    })
    expect(a.geral.custosPadrao).toHaveLength(2)
    expect(a.geral.custosPadrao[0].categoria).toBe('extras')
    expect(a.geral.custosPadrao[0].id).toBeTruthy()
    expect(a.geral.custosPadrao[1]).toEqual({ id: 'ok', categoria: 'aeb', servico: 'Gelo', estimado: '' })
  })

  it('herança por LISTA INTEIRA: tipo com lista usa a sua; sem lista, a do Padrão geral; sem nada, nenhuma', () => {
    expect(custosPadraoEfetivos(ajustesComCustos(), 'Brisa').map((c) => c.servico)).toEqual([
      'Gelo',
      'ECAD',
      'Ambulância',
    ])
    expect(custosPadraoEfetivos(ajustesComCustos(), 'Sobrado').map((c) => c.servico)).toEqual([
      'Alvará',
    ])
    expect(custosPadraoEfetivos(ajustesComCustos(), '').map((c) => c.servico)).toEqual(['Alvará'])
    expect(custosPadraoEfetivos(null, 'Brisa')).toEqual([])
  })

  it('evento novo do tipo nasce com os custos lançados: categoria certa, status ORÇAR, id NOVO por evento', () => {
    const ev = novoEventoDoTipo('Brisa', ajustesComCustos())
    const itens = (catId) => ev.categorias.find((c) => c.id === catId).itens
    expect(itens('aeb')).toHaveLength(1)
    expect(itens('aeb')[0]).toMatchObject({ servico: 'Gelo', estimado: 3000, status: 'ESTIMADO' })
    expect(itens('aeb')[0].id).not.toBe('c1') // id da lista dos Ajustes não vaza para o evento
    expect(itens('locacao')[0]).toMatchObject({ servico: 'ECAD', estimado: 4500 }) // string numérica vira número
    expect(itens('estrutura')[0]).toMatchObject({ servico: 'Ambulância', estimado: '' }) // "a orçar" continua vazio
    expect(itens('equipe')).toHaveLength(0)
    // dois eventos do mesmo tipo não compartilham ids de item
    const ev2 = novoEventoDoTipo('Brisa', ajustesComCustos())
    expect(ev2.categorias.find((c) => c.id === 'aeb').itens[0].id).not.toBe(itens('aeb')[0].id)
  })

  it('tipo sem lista própria nasce com os custos do Padrão geral; sem nada configurado, sem custos (como sempre)', () => {
    const ev = novoEventoDoTipo('Sobrado', ajustesComCustos())
    expect(ev.categorias.find((c) => c.id === 'locacao').itens[0]).toMatchObject({
      servico: 'Alvará',
      estimado: 5000,
      status: 'ESTIMADO',
    })
    const semNada = novoEventoDoTipo('Brisa', null)
    expect(semNada.categorias.every((c) => c.itens.length === 0)).toBe(true)
  })

  it('só CRIA — não retroage: os ajustes não são mutados e nenhum evento é lido', () => {
    const a = ajustesComCustos()
    const antes = JSON.stringify(a)
    novoEventoDoTipo('Brisa', a)
    expect(JSON.stringify(a)).toBe(antes)
  })

  it('temPremissas conta a lista de custos (chip ● e legenda do modal)', () => {
    expect(temPremissas({ custosPadrao: [{ categoria: 'aeb', servico: 'Gelo', estimado: 1 }] })).toBe(true)
    expect(temPremissas({ custosPadrao: [] })).toBe(false)
  })
})

// ---------------------------------------------------------------- sugestão 32
describe('lotes padrão por festa (sugestão 32) — gabarito de nascimento, zero fórmula', () => {
  const ajustesComLotes = () => ({
    geral: {
      lotesPadrao: [{ id: 'g1', nome: 'Lote único', valor: 80, quantidade: 100 }],
    },
    porTipo: {
      Brisa: {
        lotesPadrao: [
          { id: 'l1', nome: 'Pré-venda', valor: '50', quantidade: '200' },
          { id: 'l2', nome: 'Lote Porta', valor: 120, quantidade: 50, somenteOtimista: true },
          { id: 'l3', nome: 'Cortesia', quantidade: 30, cortesia: true },
        ],
      },
    },
  })

  it('forma: valor/quantidade seguem a régua numérica; marcações booleanas; lixo descartado; id gerado', () => {
    const a = formaAjustes({
      geral: {
        lotesPadrao: [
          { nome: 'Sem id', valor: 'abc', quantidade: 10, somenteOtimista: 'sim', cortesia: 1 },
          'lixo',
          null,
          { id: 'ok', nome: 'Bom', valor: '60', quantidade: '', somenteOtimista: true, cortesia: true },
        ],
      },
    })
    expect(a.geral.lotesPadrao).toHaveLength(2)
    // valor inválido vira '' (herda/vazio), marcações não-booleanas viram false
    expect(a.geral.lotesPadrao[0]).toMatchObject({ nome: 'Sem id', valor: '', quantidade: 10, somenteOtimista: false, cortesia: false })
    expect(a.geral.lotesPadrao[0].id).toBeTruthy()
    expect(a.geral.lotesPadrao[1]).toEqual({ id: 'ok', nome: 'Bom', valor: '60', quantidade: '', somenteOtimista: true, cortesia: true })
  })

  it('herança por LISTA INTEIRA: tipo com lista usa a sua; sem lista, a do Padrão geral; sem nada, nenhuma', () => {
    expect(lotesPadraoEfetivos(ajustesComLotes(), 'Brisa').map((l) => l.nome)).toEqual([
      'Pré-venda',
      'Lote Porta',
      'Cortesia',
    ])
    expect(lotesPadraoEfetivos(ajustesComLotes(), 'Sobrado').map((l) => l.nome)).toEqual(['Lote único'])
    expect(lotesPadraoEfetivos(ajustesComLotes(), '').map((l) => l.nome)).toEqual(['Lote único'])
    expect(lotesPadraoEfetivos(null, 'Brisa')).toEqual([])
  })

  it('evento novo do tipo nasce com o gabarito: nomes/valores certos, cortesia = valor 0, id NOVO por evento', () => {
    const ev = novoEventoDoTipo('Brisa', ajustesComLotes())
    expect(ev.lotes.map((l) => l.nome)).toEqual(['Pré-venda', 'Lote Porta', 'Cortesia'])
    expect(ev.lotes[0]).toMatchObject({ nome: 'Pré-venda', valor: 50, quantidade: 200, somenteOtimista: false })
    expect(ev.lotes[1]).toMatchObject({ nome: 'Lote Porta', valor: 120, quantidade: 50, somenteOtimista: true })
    // cortesia vira valor 0 e calc.js/isCortesia reconhece — nenhuma fórmula nova
    expect(ev.lotes[2].valor).toBe(0)
    expect(isCortesia(ev.lotes[2])).toBe(true)
    expect(ev.lotes[0].id).not.toBe('l1') // id da lista dos Ajustes não vaza para o evento
    // dois eventos do mesmo tipo não compartilham ids de lote
    const ev2 = novoEventoDoTipo('Brisa', ajustesComLotes())
    expect(ev2.lotes[0].id).not.toBe(ev.lotes[0].id)
  })

  it('tipo sem gabarito próprio nasce com o do Padrão geral; sem nada, os lotes padrão de sempre', () => {
    const ev = novoEventoDoTipo('Sobrado', ajustesComLotes())
    expect(ev.lotes.map((l) => l.nome)).toEqual(['Lote único'])
    // sem gabarito nenhum: os lotes padrão de sempre (defaults.js), byte a byte
    const semNada = novoEventoDoTipo('Brisa', null)
    expect(semNada.lotes.map((l) => l.nome)).toEqual(novoEvento().lotes.map((l) => l.nome))
    expect(semNada.lotes.map((l) => ({ ...l, id: '#' }))).toEqual(
      novoEvento().lotes.map((l) => ({ ...l, id: '#' }))
    )
  })

  it('só CRIA — não retroage: os ajustes não são mutados', () => {
    const a = ajustesComLotes()
    const antes = JSON.stringify(a)
    novoEventoDoTipo('Brisa', a)
    expect(JSON.stringify(a)).toBe(antes)
  })

  it('temPremissas conta a lista de lotes (chip ● e legenda do modal)', () => {
    expect(temPremissas({ lotesPadrao: [{ nome: 'Lote 1', valor: 50, quantidade: 100 }] })).toBe(true)
    expect(temPremissas({ lotesPadrao: [] })).toBe(false)
  })
})

describe('round-trip de backup com o campo aditivo `ajustes`', () => {
  const storeAtual = () => ({
    eventos: [],
    benchmarksCustom: [],
    benchmarkOverrides: {},
    ajustes: formaAjustes(ajustesExemplo()),
  })

  it('backup ANTIGO (sem a chave) abre e NÃO zera os Ajustes atuais', () => {
    const backup = parseBackup(JSON.stringify({ eventos: [], benchmarksCustom: [] }))
    expect(backup.ajustes).toBeNull()
    const mesclado = mesclarBackup(storeAtual(), backup)
    expect(mesclado.ajustes).toEqual(formaAjustes(ajustesExemplo()))
  })
  it('backup NOVO com a chave substitui os Ajustes por inteiro (regra documentada)', () => {
    const outros = { geral: { taxaBilheteria: 15 }, porTipo: {} }
    const backup = parseBackup(JSON.stringify({ eventos: [], ajustes: outros }))
    const mesclado = mesclarBackup(storeAtual(), backup)
    expect(mesclado.ajustes.geral.taxaBilheteria).toBe(15)
    expect(mesclado.ajustes.porTipo).toEqual({})
  })
  it('round-trip: ajustes exportados voltam idênticos pelo parse', () => {
    // o payload do exportBackup grava formaAjustes(store.ajustes); o parse
    // aplica formaAjustes de novo — idempotência já provada acima.
    const payload = JSON.stringify({ eventos: [], ajustes: formaAjustes(ajustesExemplo()) })
    expect(parseBackup(payload).ajustes).toEqual(formaAjustes(ajustesExemplo()))
  })
})

// ————— Sugestão 29c (Sessão F2-R): os 3 campos da bilheteria nova —————
// Ingressos com desconto (modo + valor) e quem paga a taxa entram nas
// premissas por festa, herdados como os demais — herança SÓ no nascimento.
describe('premissas da sugestão 29 (desconto parcial + taxa paga por) — F2-R', () => {
  const ajustes29 = () => ({
    geral: {
      ...premissaVazia(),
      descontoMedioPct: 10,
      descontoIngressosValor: 40,
      taxaPagaPor: 'nos',
    },
    porTipo: {
      Brisa: {
        ...premissaVazia(),
        descontoIngressosModo: 'numero',
        descontoIngressosValor: 180,
        taxaPagaPor: 'cliente',
      },
    },
  })

  it('forma: modo/taxa fora do vocabulário viram "" (= herda) — premissa torta nunca liga nada sozinha', () => {
    const a = formaAjustes({
      geral: { descontoIngressosModo: 'NÚMERO', taxaPagaPor: 'CLIENTE', descontoIngressosValor: 'abc' },
      porTipo: {},
    })
    expect(a.geral.descontoIngressosModo).toBe('')
    expect(a.geral.taxaPagaPor).toBe('')
    expect(a.geral.descontoIngressosValor).toBe('')
    // válidos passam
    const b = formaAjustes({ geral: { descontoIngressosModo: 'numero', taxaPagaPor: 'cliente' }, porTipo: {} })
    expect(b.geral.descontoIngressosModo).toBe('numero')
    expect(b.geral.taxaPagaPor).toBe('cliente')
  })

  it('herança campo a campo: tipo vence o geral; campo só no geral herda; resto cai no app', () => {
    const r = resolverPremissas(ajustes29(), 'Brisa')
    expect(r.descontoIngressosModo).toEqual({ valor: 'numero', origem: 'tipo' })
    expect(r.descontoIngressosValor).toEqual({ valor: 180, origem: 'tipo' })
    expect(r.taxaPagaPor).toEqual({ valor: 'cliente', origem: 'tipo' })
    const g = resolverPremissas(ajustes29(), 'Marfim Alto')
    expect(g.descontoIngressosModo).toEqual({ valor: '', origem: 'app' }) // geral não define modo
    expect(g.descontoIngressosValor).toEqual({ valor: 40, origem: 'geral' })
    expect(g.taxaPagaPor).toEqual({ valor: 'nos', origem: 'geral' })
  })

  it('nascimento: evento do tipo nasce com os 3 campos — e a conta usa exatamente eles', () => {
    const ev = novoEventoDoTipo('Brisa', ajustes29())
    expect(ev.descontoMedioPct).toBe(10) // herdado do geral (numérico)
    expect(ev.descontoIngressosModo).toBe('numero')
    expect(ev.descontoIngressosValor).toBe(180)
    expect(ev.taxaPagaPor).toBe('cliente')
  })

  it('sem premissa dos campos novos, o evento nasce como novoEvento() ("" nos 3 — conta de sempre)', () => {
    const ev = novoEventoDoTipo('Sobrado', null)
    expect(ev.descontoIngressosModo).toBe('')
    expect(ev.descontoIngressosValor).toBe('')
    expect(ev.taxaPagaPor).toBe('')
  })

  it('temPremissas conta os campos de escolha (chip ● dos Ajustes)', () => {
    expect(temPremissas({ ...premissaVazia(), taxaPagaPor: 'cliente' })).toBe(true)
    expect(temPremissas({ ...premissaVazia(), descontoIngressosModo: 'numero' })).toBe(true)
    expect(temPremissas(premissaVazia())).toBe(false)
  })
})

describe('premissa da sugestão 30 (vendas abrem N dias antes) — F2-S', () => {
  const ajustes30 = () => ({
    geral: { ...premissaVazia(), vendasAbremDiasAntes: 60 },
    porTipo: { Brisa: { ...premissaVazia(), vendasAbremDiasAntes: 45 } },
  })

  it('herança campo a campo: tipo vence o geral; sem nada, "" (sem premissa)', () => {
    expect(resolverPremissas(ajustes30(), 'Brisa').vendasAbremDiasAntes).toEqual({ valor: 45, origem: 'tipo' })
    expect(resolverPremissas(ajustes30(), 'Sobrado').vendasAbremDiasAntes).toEqual({ valor: 60, origem: 'geral' })
    expect(resolverPremissas(null, 'Brisa').vendasAbremDiasAntes).toEqual({ valor: '', origem: 'app' })
  })

  it('nascimento: o N herdado NASCE com o evento (a data em si não existe ainda — o evento nasce sem data)', () => {
    const ev = novoEventoDoTipo('Brisa', ajustes30())
    expect(ev.vendasAbremDiasAntes).toBe(45)
    expect(ev.data).toBe('') // sem data não há início derivado ainda
    expect(ev.inicioVendas).toBe('') // o campo de data nasce vazio — premissa não grava data
  })

  it('sem premissa, o evento nasce como novoEvento(): "" no campo (curva como sempre)', () => {
    expect(novoEventoDoTipo('Sobrado', null).vendasAbremDiasAntes).toBe('')
  })

  it('forma: valor torto vira "" e temPremissas conta o campo (chip ● dos Ajustes)', () => {
    expect(formaAjustes({ geral: { vendasAbremDiasAntes: 'abc' }, porTipo: {} }).geral.vendasAbremDiasAntes).toBe('')
    expect(temPremissas({ ...premissaVazia(), vendasAbremDiasAntes: 45 })).toBe(true)
  })
})
