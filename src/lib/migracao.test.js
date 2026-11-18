import { describe, it, expect } from 'vitest'
import { migrarEvento, migrarEventos } from './migracao.js'
// veredito importado SÓ para LER o efeito da migração (§9.9) — calc.js intocado.
import { computeCenarios, veredito, MARGEM_ALVO_PADRAO, MARGEM_MINIMA_PADRAO } from './calc.js'
import { novoEvento, novoItem } from './defaults.js'
import { clone } from './util.js'

// Evento no formato ANTIGO (pré-Sessões E, H, N, O e Q): sem receitaRealizada,
// sem vínculo com o Financeiro, sem tipo de festa, sem desconto médio, sem a
// lista de patrocínios (patrocínio como número solto, que a Sessão O migra) e
// sem o marcador openBar (Sessão Q).
const eventoAntigo = () => {
  const e = novoEvento('Evento antigo')
  delete e.receitaRealizada // garantia: formato pré-migração
  delete e.financeiro
  delete e.tipo
  delete e.descontoMedioPct
  delete e.patrocinios
  delete e.openBar
  e.lotes = e.lotes.map((l, i) => ({ ...l, valor: l.valor === 0 ? 0 : 80 + i * 10, quantidade: 100 }))
  e.categorias[0].itens = [novoItem({ servico: 'Gelo', estimado: 1200, realizado: 1350 })]
  e.outrasReceitas = { bar: 5000, patrocinio: 2000 }
  return e
}

describe('migrarEvento (Sessão E — campo opcional receitaRealizada)', () => {
  it('adiciona receitaRealizada vazia a evento antigo', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.receitaRealizada).toEqual({ bilheteria: '', bar: '' })
  })

  it('NÃO altera nenhum outro campo do evento', () => {
    const antes = eventoAntigo()
    const congelado = clone(antes)
    const m = migrarEvento(antes)
    // original intocado
    expect(antes).toEqual(congelado)
    // migrado = original + campos novos (Sessões E, H, N e Q), nada mais.
    // Exceção CONSCIENTE da Sessão O (sugestão 22): outrasReceitas.patrocinio
    // é MOVIDO para a lista `patrocinios` como item 'confirmado' (que conta na
    // receita ⇒ número preservado — provas em patrocinio.test.js); o campo
    // solto sai consumido (''). Por isso os dois ficam fora do "resto
    // intocado" e são conferidos à parte aqui.
    const { receitaRealizada, financeiro, tipo, descontoMedioPct, patrocinios, openBar, outrasReceitas, ...resto } = m
    const { outrasReceitas: outrasOriginais, ...congeladoSemOutras } = congelado
    expect(resto).toEqual(congeladoSemOutras)
    expect(openBar).toBe(false) // Sessão Q (sugestão 27): campo novo, false = conta de sempre
    expect(outrasReceitas).toEqual({ ...outrasOriginais, patrocinio: '' })
    expect(patrocinios).toHaveLength(1)
    expect(patrocinios[0]).toMatchObject({ valor: outrasOriginais.patrocinio, estagio: 'confirmado' })
  })

  it('todos os números calculados ficam idênticos após a migração', () => {
    const antes = eventoAntigo()
    expect(computeCenarios(migrarEvento(antes))).toEqual(computeCenarios(antes))
  })

  it('é idempotente', () => {
    const uma = migrarEvento(eventoAntigo())
    expect(migrarEvento(uma)).toEqual(uma)
  })

  it('preserva valores já preenchidos', () => {
    const e = { ...eventoAntigo(), receitaRealizada: { bilheteria: 55000, bar: 8000 } }
    expect(migrarEvento(e).receitaRealizada).toEqual({ bilheteria: 55000, bar: 8000 })
  })

  it('completa subcampo ausente sem tocar no presente', () => {
    const e = { ...eventoAntigo(), receitaRealizada: { bilheteria: 55000 } }
    expect(migrarEvento(e).receitaRealizada).toEqual({ bilheteria: 55000, bar: '' })
  })

  it('receitaRealizada inválida (não-objeto) vira vazia', () => {
    const e = { ...eventoAntigo(), receitaRealizada: 'lixo' }
    expect(migrarEvento(e).receitaRealizada).toEqual({ bilheteria: '', bar: '' })
  })

  it('round-trip: backup JSON antigo importa, exporta e reimporta com números idênticos', async () => {
    const { parseBackup } = await import('./storage.js')
    const antigo = eventoAntigo()
    // backup no formato antigo, exatamente como exportBackup gravava pré-Sessão E
    const backupAntigo = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      exportadoEm: '2026-07-10T12:00:00.000Z',
      eventos: [antigo],
      benchmarksCustom: [],
      benchmarkOverrides: {},
    })
    const importado = parseBackup(backupAntigo)
    expect(importado.eventos[0].receitaRealizada).toEqual({ bilheteria: '', bar: '' })
    // números idênticos aos do evento antigo
    expect(computeCenarios(importado.eventos[0])).toEqual(computeCenarios(antigo))
    // exporta (mesmo payload do exportBackup) e reimporta → estável
    const reexportado = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    const reimportado = parseBackup(reexportado)
    expect(reimportado.eventos).toEqual(importado.eventos)
  })

  it('migrarEventos cobre listas e entradas inválidas', () => {
    expect(migrarEventos(null)).toEqual([])
    const lista = migrarEventos([eventoAntigo()])
    expect(lista).toHaveLength(1)
    expect(lista[0].receitaRealizada).toEqual({ bilheteria: '', bar: '' })
  })
})

describe('migrarEvento (Sessão H — campo opcional financeiro)', () => {
  const vinculo = () => ({
    eventoId: 1,
    eventoNome: 'Turnê Exterior #2',
    empresa: 'Marfim Alto',
    atualizadoEm: '2026-07-18T14:32:00.000Z',
    puxado: {
      vendidosAteHoje: { valor: 143, em: '2026-07-18T14:32:00.000Z' },
      bilheteria: { valor: 34000, em: '2026-07-18T14:32:00.000Z' },
    },
  })

  it('evento antigo (sem o campo) ganha financeiro: null — sem vínculo', () => {
    expect(migrarEvento(eventoAntigo()).financeiro).toBeNull()
  })

  it('vínculo válido é preservado por inteiro (carimbos incluídos)', () => {
    const e = { ...eventoAntigo(), financeiro: vinculo() }
    expect(migrarEvento(e).financeiro).toEqual(vinculo())
  })

  it('financeiro inválido (lixo ou sem eventoId) vira null', () => {
    expect(migrarEvento({ ...eventoAntigo(), financeiro: 'lixo' }).financeiro).toBeNull()
    expect(migrarEvento({ ...eventoAntigo(), financeiro: { eventoNome: 'X' } }).financeiro).toBeNull()
  })

  it('carimbo malformado é descartado sem derrubar o vínculo', () => {
    const f = { ...vinculo(), puxado: { vendidosAteHoje: { valor: 143 }, bilheteria: 'lixo' } }
    const m = migrarEvento({ ...eventoAntigo(), financeiro: f }).financeiro
    expect(m.eventoId).toBe(1)
    expect(m.puxado).toEqual({})
  })

  it('nenhum número calculado muda com o vínculo presente', () => {
    const antes = eventoAntigo()
    const com = { ...clone(antes), financeiro: vinculo() }
    expect(computeCenarios(migrarEvento(com))).toEqual(computeCenarios(antes))
  })

  it('round-trip: backup COM vínculo exporta e reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const evento = { ...eventoAntigo(), financeiro: vinculo() }
    const backup = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [evento] })
    const importado = parseBackup(backup)
    expect(importado.eventos[0].financeiro).toEqual(vinculo())
    const reimportado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos }))
    expect(reimportado.eventos).toEqual(importado.eventos)
  })
})

describe('migrarEvento (Sessão N — campo opcional tipo de festa)', () => {
  it('evento antigo (sem o campo) ganha tipo: "" — sem categoria', () => {
    expect(migrarEvento(eventoAntigo()).tipo).toBe('')
  })

  it('tipo preenchido é preservado como veio (inclusive tipo custom)', () => {
    expect(migrarEvento({ ...eventoAntigo(), tipo: 'Brisa' }).tipo).toBe('Brisa')
    expect(migrarEvento({ ...eventoAntigo(), tipo: 'Festa Junina' }).tipo).toBe('Festa Junina')
  })

  it('tipo inválido (não-string) vira "" — sem categoria', () => {
    expect(migrarEvento({ ...eventoAntigo(), tipo: 7 }).tipo).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), tipo: { nome: 'X' } }).tipo).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), tipo: null }).tipo).toBe('')
  })

  it('nenhum número calculado muda com o tipo presente', () => {
    const antes = eventoAntigo()
    const com = { ...clone(antes), tipo: 'Sobrado' }
    expect(computeCenarios(migrarEvento(com))).toEqual(computeCenarios(antes))
  })

  it('round-trip: backup antigo importa com tipo "" e backup COM tipo reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const backupAntigo = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [eventoAntigo()] })
    expect(parseBackup(backupAntigo).eventos[0].tipo).toBe('')
    const comTipo = { ...eventoAntigo(), tipo: 'O Galeao' }
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comTipo] }))
    expect(importado.eventos[0].tipo).toBe('O Galeao')
    const reimportado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos }))
    expect(reimportado.eventos).toEqual(importado.eventos)
  })
})

describe('migrarEvento (Sessão N — campo opcional descontoMedioPct, sugestão 17)', () => {
  it('evento antigo (sem o campo) ganha descontoMedioPct: "" — 0%, conta idêntica', () => {
    expect(migrarEvento(eventoAntigo()).descontoMedioPct).toBe('')
  })

  it('desconto preenchido é preservado como veio (número; inclui 0 e 100)', () => {
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: 12 }).descontoMedioPct).toBe(12)
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: 0 }).descontoMedioPct).toBe(0)
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: 100 }).descontoMedioPct).toBe(100)
    // string numérica (backup editado à mão) também passa — num() resolve no cálculo
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: '12' }).descontoMedioPct).toBe('12')
  })

  it('desconto inválido (lixo, NaN, objeto) vira "" — nunca finge ser dado', () => {
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: 'abc' }).descontoMedioPct).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: NaN }).descontoMedioPct).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: {} }).descontoMedioPct).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), descontoMedioPct: null }).descontoMedioPct).toBe('')
  })

  it('a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico', () => {
    const antes = eventoAntigo()
    expect(computeCenarios(migrarEvento(antes))).toEqual(computeCenarios(antes))
  })
})

describe('migrarEvento (§9.9 — margens do semáforo com forma imposta, 20/07/2026)', () => {
  it('evento antigo (sem os campos) NÃO ganha chave nova — segue caindo nos padrões 28/20', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.margemAlvo).toBeUndefined()
    expect(m.margemMinima).toBeUndefined()
  })

  it('número, string numérica, 0 e vazio são preservados como vieram', () => {
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: 25 }).margemAlvo).toBe(25)
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: '25' }).margemAlvo).toBe('25')
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: 0 }).margemAlvo).toBe(0)
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: '' }).margemAlvo).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), margemMinima: 15 }).margemMinima).toBe(15)
  })

  it("valor torto ('abc', NaN, objeto) vira '' — não informado, nunca dado", () => {
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: 'abc' }).margemAlvo).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), margemAlvo: NaN }).margemAlvo).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), margemMinima: {} }).margemMinima).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), margemMinima: 'xyz' }).margemMinima).toBe('')
  })

  it('ponta a ponta: o backup hostil que pintava VERDE FALSO passa a cair nos padrões', () => {
    // A fotografia do bug (§9.9): com margens 'abc'/'xyz' CRUAS, num() coagia
    // para alvo 0 / mínima 0 — e uma margem realista de 10% (que os padrões
    // 28/20 pintariam de VERMELHO) saía VERDE. Cenários montados à mão só para
    // ler veredito(); calc.js segue intocado.
    const cenarios = { realista: { margem: 10 }, pessimista: { lucro: 1000 } }
    const hostil = { ...eventoAntigo(), margemAlvo: 'abc', margemMinima: 'xyz' }

    const cru = veredito(cenarios, hostil)
    expect(cru.cor).toBe('verde') // o bug, fotografado: alvo 0 aprova qualquer coisa
    expect(cru.margemAlvo).toBe(0)

    const migrado = veredito(cenarios, migrarEvento(hostil))
    expect(migrado.margemAlvo).toBe(MARGEM_ALVO_PADRAO)
    expect(migrado.margemMinima).toBe(MARGEM_MINIMA_PADRAO)
    expect(migrado.cor).toBe('vermelho') // 10% < mínima 20 — a leitura honesta
  })

  it('round-trip: backup antigo → "" e backup COM desconto reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const backupAntigo = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [eventoAntigo()] })
    expect(parseBackup(backupAntigo).eventos[0].descontoMedioPct).toBe('')
    const comDesconto = { ...eventoAntigo(), tipo: 'Brisa', descontoMedioPct: 12 }
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comDesconto] }))
    expect(importado.eventos[0].descontoMedioPct).toBe(12)
    const reimportado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos }))
    expect(reimportado.eventos).toEqual(importado.eventos)
    // e os números calculados sobrevivem ao round-trip
    expect(computeCenarios(reimportado.eventos[0])).toEqual(computeCenarios(importado.eventos[0]))
  })
})

describe('migrarEvento (Sessão F2-R — desconto parcial em dois modos, sugestão 29a)', () => {
  it('evento antigo ganha modo "" e valor "" — o campo antigo migra para "cupom = X, modo %, 100%"', () => {
    const antes = { ...eventoAntigo(), descontoMedioPct: 12 }
    const m = migrarEvento(antes)
    expect(m.descontoIngressosModo).toBe('')
    expect(m.descontoIngressosValor).toBe('')
    // e a conta segue idêntica: modo/valor vazios = cupom em todos
    expect(computeCenarios(m)).toEqual(computeCenarios(antes))
  })

  it('modo e valor válidos são preservados como vieram', () => {
    const ev = {
      ...eventoAntigo(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 180,
    }
    const m = migrarEvento(ev)
    expect(m.descontoIngressosModo).toBe('numero')
    expect(m.descontoIngressosValor).toBe(180)
    expect(migrarEvento({ ...ev, descontoIngressosModo: 'pct', descontoIngressosValor: '40' }).descontoIngressosValor).toBe('40')
  })

  it('modo fora do vocabulário e valor inválido viram "" — backup editado à mão nunca muda conta sozinho', () => {
    const m = migrarEvento({
      ...eventoAntigo(),
      descontoIngressosModo: 'NÚMERO',
      descontoIngressosValor: 'abc',
    })
    expect(m.descontoIngressosModo).toBe('')
    expect(m.descontoIngressosValor).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), descontoIngressosModo: {}, descontoIngressosValor: NaN }).descontoIngressosModo).toBe('')
  })

  it('é idempotente e não muda nenhum número calculado', () => {
    const ev = { ...eventoAntigo(), descontoMedioPct: 12 }
    const uma = migrarEvento(ev)
    expect(migrarEvento(uma)).toEqual(uma)
    expect(computeCenarios(uma)).toEqual(computeCenarios(ev))
  })

  it('round-trip: backup antigo → campos "" e backup COM os campos reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const antesDoBackup = { ...eventoAntigo(), descontoMedioPct: 12 }
    const antigo = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [antesDoBackup] })
    )
    expect(antigo.eventos[0].descontoIngressosModo).toBe('')
    expect(antigo.eventos[0].descontoIngressosValor).toBe('')
    expect(computeCenarios(antigo.eventos[0])).toEqual(computeCenarios(antesDoBackup))
    const comCampos = {
      ...eventoAntigo(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 180,
    }
    const importado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comCampos] })
    )
    const reimportado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    )
    expect(reimportado.eventos).toEqual(importado.eventos)
    expect(computeCenarios(reimportado.eventos[0])).toEqual(computeCenarios(importado.eventos[0]))
  })
})

describe('migrarEvento (Sessão F2-R — taxa paga pelo cliente, sugestão 29b)', () => {
  it('evento antigo ganha taxaPagaPor: "" — paga por nós, conta idêntica', () => {
    const antes = eventoAntigo()
    const m = migrarEvento(antes)
    expect(m.taxaPagaPor).toBe('')
    expect(computeCenarios(m)).toEqual(computeCenarios(antes))
  })

  it('"cliente" e "nos" são preservados; qualquer valor torto vira "" (repasse NUNCA liga sozinho)', () => {
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: 'cliente' }).taxaPagaPor).toBe('cliente')
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: 'nos' }).taxaPagaPor).toBe('nos')
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: 'CLIENTE' }).taxaPagaPor).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: true }).taxaPagaPor).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: 1 }).taxaPagaPor).toBe('')
    expect(migrarEvento({ ...eventoAntigo(), taxaPagaPor: {} }).taxaPagaPor).toBe('')
  })

  it('round-trip: backup antigo → "" e backup COM "cliente" reimporta idêntico (números incluídos)', async () => {
    const { parseBackup } = await import('./storage.js')
    const semCampo = eventoAntigo()
    const antigo = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [semCampo] })
    )
    expect(antigo.eventos[0].taxaPagaPor).toBe('')
    expect(computeCenarios(antigo.eventos[0])).toEqual(computeCenarios(semCampo))
    const comCliente = { ...eventoAntigo(), taxaPagaPor: 'cliente' }
    const importado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comCliente] })
    )
    const reimportado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    )
    expect(reimportado.eventos).toEqual(importado.eventos)
    expect(computeCenarios(reimportado.eventos[0])).toEqual(computeCenarios(importado.eventos[0]))
  })
})

describe('migrarEvento (Sessão Q — campo opcional openBar, sugestão 27)', () => {
  it('evento antigo (sem o campo) ganha openBar: false — conta idêntica', () => {
    expect(migrarEvento(eventoAntigo()).openBar).toBe(false)
  })

  it('openBar: true é preservado', () => {
    expect(migrarEvento({ ...eventoAntigo(), openBar: true }).openBar).toBe(true)
  })

  it('valor "torto" (string, 1, objeto, null) vira false — NUNCA promove evento a open bar sozinho', () => {
    // zerar receita de bar sem o Marco pedir seria número errado como certo
    expect(migrarEvento({ ...eventoAntigo(), openBar: 'true' }).openBar).toBe(false)
    expect(migrarEvento({ ...eventoAntigo(), openBar: 1 }).openBar).toBe(false)
    expect(migrarEvento({ ...eventoAntigo(), openBar: {} }).openBar).toBe(false)
    expect(migrarEvento({ ...eventoAntigo(), openBar: null }).openBar).toBe(false)
  })

  it('a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico', () => {
    const antes = eventoAntigo()
    expect(computeCenarios(migrarEvento(antes))).toEqual(computeCenarios(antes))
  })

  it('idempotente: migrar duas vezes = uma vez (com e sem openBar: true)', () => {
    const uma = migrarEvento(eventoAntigo())
    expect(migrarEvento(clone(uma))).toEqual(uma)
    const umaOpen = migrarEvento({ ...eventoAntigo(), openBar: true })
    expect(migrarEvento(clone(umaOpen))).toEqual(umaOpen)
  })

  it('round-trip: backup antigo → false; backup COM openBar reimporta idêntico e mantém bar zerado na conta', async () => {
    const { parseBackup } = await import('./storage.js')
    const backupAntigo = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [eventoAntigo()] })
    expect(parseBackup(backupAntigo).eventos[0].openBar).toBe(false)
    const comOpenBar = { ...eventoAntigo(), openBar: true }
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comOpenBar] }))
    expect(importado.eventos[0].openBar).toBe(true)
    const reimportado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos }))
    expect(reimportado.eventos).toEqual(importado.eventos)
    // o bar (5000 no fixture) fica fora da receita nos dois lados do round-trip
    const c = computeCenarios(reimportado.eventos[0])
    expect(c.realista.bar).toBe(0)
    expect(computeCenarios(reimportado.eventos[0])).toEqual(computeCenarios(importado.eventos[0]))
  })
})

describe('migrarEvento (Sessão F2-S — início de vendas, sugestão 30)', () => {
  it('evento antigo (sem os campos) ganha inicioVendas: "" e vendasAbremDiasAntes: "" — nada mais muda', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.inicioVendas).toBe('')
    expect(m.vendasAbremDiasAntes).toBe('')
  })

  it('valores válidos são preservados; tortos viram "" (data quebrada nunca vira régua da curva)', () => {
    const ok = migrarEvento({ ...eventoAntigo(), inicioVendas: '2026-08-01', vendasAbremDiasAntes: 45 })
    expect(ok.inicioVendas).toBe('2026-08-01')
    expect(ok.vendasAbremDiasAntes).toBe(45)
    // string numérica de backup editado à mão é preservada como veio
    expect(migrarEvento({ ...eventoAntigo(), vendasAbremDiasAntes: '30' }).vendasAbremDiasAntes).toBe('30')
    for (const torto of ['01/08/2026', '2026-8-1', 42, {}, null]) {
      expect(migrarEvento({ ...eventoAntigo(), inicioVendas: torto }).inicioVendas).toBe('')
    }
    for (const torto of ['abc', {}, null, NaN]) {
      expect(migrarEvento({ ...eventoAntigo(), vendasAbremDiasAntes: torto }).vendasAbremDiasAntes).toBe('')
    }
  })

  it('a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico', () => {
    const antes = eventoAntigo()
    expect(computeCenarios(migrarEvento(antes))).toEqual(computeCenarios(antes))
  })

  it('idempotente: migrar duas vezes = uma vez (com e sem os campos novos)', () => {
    const uma = migrarEvento(eventoAntigo())
    expect(migrarEvento(clone(uma))).toEqual(uma)
    const umaCom = migrarEvento({ ...eventoAntigo(), inicioVendas: '2026-08-01', vendasAbremDiasAntes: 45 })
    expect(migrarEvento(clone(umaCom))).toEqual(umaCom)
  })

  it('round-trip: backup antigo → "" nos dois; backup COM os campos reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const backupAntigo = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [eventoAntigo()] })
    const semCampos = parseBackup(backupAntigo).eventos[0]
    expect(semCampos.inicioVendas).toBe('')
    expect(semCampos.vendasAbremDiasAntes).toBe('')
    const comCampos = { ...eventoAntigo(), inicioVendas: '2026-08-01', vendasAbremDiasAntes: 45 }
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [comCampos] }))
    expect(importado.eventos[0].inicioVendas).toBe('2026-08-01')
    const reimportado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos }))
    expect(reimportado.eventos).toEqual(importado.eventos)
    expect(computeCenarios(reimportado.eventos[0])).toEqual(computeCenarios(importado.eventos[0]))
  })
})

describe('migrarEvento (Sessão F2-S — referência da curva, campo curvaRef)', () => {
  it('evento antigo (sem o campo) ganha { modo: "", itens: [] } — média da festa, como sempre', () => {
    expect(migrarEvento(eventoAntigo()).curvaRef).toEqual({ modo: '', itens: [] })
  })

  it('modo e itens válidos preservados; modo torto vira ""; item sem id é descartado', () => {
    const ok = migrarEvento({
      ...eventoAntigo(),
      curvaRef: { modo: 'grupo', itens: [{ id: 7, nome: 'Brisa #2' }, { id: 9, nome: '' }] },
    })
    expect(ok.curvaRef).toEqual({ modo: 'grupo', itens: [{ id: 7, nome: 'Brisa #2' }, { id: 9, nome: '' }] })
    const torto = migrarEvento({
      ...eventoAntigo(),
      curvaRef: { modo: 'GRUPO', itens: [{ nome: 'sem id' }, 'lixo', { id: 3, nome: 42 }] },
    })
    expect(torto.curvaRef).toEqual({ modo: '', itens: [{ id: 3, nome: '' }] })
    expect(migrarEvento({ ...eventoAntigo(), curvaRef: 'lixo' }).curvaRef).toEqual({ modo: '', itens: [] })
  })

  it('idempotente e round-trip de backup com e sem o campo', async () => {
    const { parseBackup } = await import('./storage.js')
    const uma = migrarEvento({ ...eventoAntigo(), curvaRef: { modo: 'festa', itens: [{ id: 7, nome: 'Brisa #2' }] } })
    expect(migrarEvento(clone(uma))).toEqual(uma)
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [uma] }))
    expect(importado.eventos[0].curvaRef).toEqual({ modo: 'festa', itens: [{ id: 7, nome: 'Brisa #2' }] })
    expect(parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [eventoAntigo()] })).eventos[0].curvaRef)
      .toEqual({ modo: '', itens: [] })
  })
})

describe('migrarEvento (Sessão F2-W — campo opcional itensDispensados, sugestão 37)', () => {
  // Evento SEM o campo (backup anterior à F2-W): a migração dá []; o aviso do
  // semáforo continua completo, comportamento de sempre.
  const semCampo = () => {
    const e = eventoAntigo()
    delete e.itensDispensados
    return e
  }

  it('evento sem o campo → itensDispensados: []', () => {
    expect(migrarEvento(semCampo()).itensDispensados).toEqual([])
  })

  it('preserva a lista válida e descarta lixo (não-string / vazio)', () => {
    const e = { ...semCampo(), itensDispensados: ['Alvará', '', '  ', 42, 'CET', null] }
    expect(migrarEvento(e).itensDispensados).toEqual(['Alvará', 'CET'])
  })

  it('campo inválido (não-array) → []', () => {
    expect(migrarEvento({ ...semCampo(), itensDispensados: 'lixo' }).itensDispensados).toEqual([])
    expect(migrarEvento({ ...semCampo(), itensDispensados: null }).itensDispensados).toEqual([])
  })

  it('display-only: os números calculados ficam IDÊNTICOS com o campo cheio', () => {
    const base = semCampo()
    const comDispensa = { ...clone(base), itensDispensados: ['Alvará', 'CET', 'Gerador'] }
    // prova byte a byte de que o campo não toca cálculo nenhum
    expect(computeCenarios(comDispensa)).toEqual(computeCenarios(base))
    expect(computeCenarios(migrarEvento(comDispensa))).toEqual(computeCenarios(migrarEvento(base)))
  })

  it('é idempotente', () => {
    const uma = migrarEvento({ ...semCampo(), itensDispensados: ['CET'] })
    expect(migrarEvento(clone(uma))).toEqual(uma)
  })

  it('round-trip: backup COM dispensados exporta e reimporta idêntico; backup SEM o campo abre com []', async () => {
    const { parseBackup } = await import('./storage.js')
    const uma = migrarEvento({ ...semCampo(), itensDispensados: ['Alvará', 'Gerador'] })
    const importado = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [uma] }))
    expect(importado.eventos[0].itensDispensados).toEqual(['Alvará', 'Gerador'])
    const reexport = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    expect(parseBackup(reexport).eventos[0].itensDispensados).toEqual(['Alvará', 'Gerador'])
    // backup antigo, sem a chave → abre com []
    expect(
      parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [semCampo()] })).eventos[0].itensDispensados
    ).toEqual([])
  })
})

describe('migrarEvento (Parte 2 do fechamento — status/fechamento, 20/07/2026)', () => {
  const FECH_VALIDO = {
    em: '2026-07-20T21:00:00.000Z',
    foto: { resultado: { resultado: 1234 }, custos: {}, receita: {}, cenarioRealista: {} },
  }

  it('evento antigo (sem os campos) nasce aberto e sem foto — backfill', () => {
    const e = novoEvento('Sem os campos')
    delete e.status
    delete e.fechamento
    const m = migrarEvento(e)
    expect(m.status).toBe('aberto')
    expect(m.fechamento).toBeNull()
  })

  it('fechado VÁLIDO é preservado inteiro, e a migração é idempotente', () => {
    const e = { ...novoEvento('Fechado'), status: 'fechado', fechamento: clone(FECH_VALIDO) }
    const m = migrarEvento(e)
    expect(m.status).toBe('fechado')
    expect(m.fechamento).toEqual(FECH_VALIDO)
    const m2 = migrarEvento(clone(m))
    expect(m2.status).toBe('fechado')
    expect(m2.fechamento).toEqual(m.fechamento)
  })

  it('benchmarkId string sobrevive; benchmarkId torto é descartado sem derrubar a foto', () => {
    const com = migrarEvento({
      ...novoEvento('x'),
      status: 'fechado',
      fechamento: { ...clone(FECH_VALIDO), benchmarkId: 'bm-1' },
    })
    expect(com.fechamento.benchmarkId).toBe('bm-1')
    const torto = migrarEvento({
      ...novoEvento('x'),
      status: 'fechado',
      fechamento: { ...clone(FECH_VALIDO), benchmarkId: 42 },
    })
    expect(torto.status).toBe('fechado')
    expect(torto.fechamento.benchmarkId).toBeUndefined()
  })

  it('ESTRITO: status torto nunca fecha — fechar trava edição, não liga por acidente', () => {
    for (const status of ['Fechado', 'FECHADO', true, 1, ' fechado', {}]) {
      const m = migrarEvento({ ...novoEvento('x'), status, fechamento: clone(FECH_VALIDO) })
      expect(m.status).toBe('aberto')
      expect(m.fechamento).toBeNull()
    }
  })

  it('ESTRITO: foto inválida derruba o par — status fechado sem foto vira aberto', () => {
    const casos = [
      undefined,
      null,
      'foto',
      [],
      { em: '', foto: {} }, // em vazio
      { em: 42, foto: {} }, // em não-string
      { foto: {} }, // sem em
      { em: '2026-07-20T21:00:00.000Z' }, // sem foto
      { em: '2026-07-20T21:00:00.000Z', foto: [] }, // foto array
      { em: '2026-07-20T21:00:00.000Z', foto: 'x' }, // foto não-objeto
    ]
    for (const fechamento of casos) {
      const m = migrarEvento({ ...novoEvento('x'), status: 'fechado', fechamento })
      expect(m.status).toBe('aberto')
      expect(m.fechamento).toBeNull()
    }
  })

  it('foto órfã (sem status fechado) é descartada — o par viaja junto ou não viaja', () => {
    const m = migrarEvento({ ...novoEvento('x'), status: 'aberto', fechamento: clone(FECH_VALIDO) })
    expect(m.status).toBe('aberto')
    expect(m.fechamento).toBeNull()
  })

  it('round-trip: backup com evento FECHADO exporta e reimporta idêntico', async () => {
    const { parseBackup } = await import('./storage.js')
    const fechado = { ...novoEvento('Brisa fechado'), status: 'fechado', fechamento: clone(FECH_VALIDO) }
    const backup = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [fechado] })
    const importado = parseBackup(backup)
    expect(importado.eventos[0].status).toBe('fechado')
    expect(importado.eventos[0].fechamento).toEqual(FECH_VALIDO)
    const reimportado = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: importado.eventos })
    )
    expect(reimportado.eventos).toEqual(importado.eventos)
  })
})

describe('migrarEvento — foto do fechamento sem `resultado` é INVÁLIDA (achado adversarial 20/07/2026)', () => {
  // A forma frouxa (qualquer objeto como foto) deixava um backup editado à
  // mão com foto {} passar como fechado — e a aba Fechamento crashava com
  // TypeError ao ler foto.resultado.resultado. Foto sem o miolo não é foto.
  it.each([
    ['foto vazia {}', {}],
    ['resultado array', { resultado: [] }],
    ['resultado string', { resultado: 'x' }],
    ['resultado null', { resultado: null }],
  ])('fechamento com %s vira aberto + null', (_nome, foto) => {
    const m = migrarEvento({
      ...novoEvento('x'),
      status: 'fechado',
      fechamento: { em: '2026-07-20T21:00:00.000Z', foto },
    })
    expect(m.status).toBe('aberto')
    expect(m.fechamento).toBeNull()
  })
})

describe('eventosReabertosPorBackup — o aviso do import que reabre festa fechada (20/07/2026)', () => {
  it('detecta o evento fechado que o backup (sem status) reabriria', async () => {
    const { eventosReabertosPorBackup } = await import('./storage.js')
    const atuais = [
      { id: 'a', nome: 'Fechada', status: 'fechado', fechamento: { em: 'x', foto: { resultado: {} } } },
      { id: 'b', nome: 'Aberta', status: 'aberto', fechamento: null },
    ]
    const backup = { eventos: [{ id: 'a', nome: 'Fechada (backup velho)' }] }
    const r = eventosReabertosPorBackup(atuais, backup)
    expect(r.map((e) => e.id)).toEqual(['a'])
  })

  it('backup que TAMBÉM traz o evento fechado não dispara o aviso', async () => {
    const { eventosReabertosPorBackup } = await import('./storage.js')
    const atuais = [{ id: 'a', nome: 'F', status: 'fechado', fechamento: { em: 'x', foto: { resultado: {} } } }]
    const backup = { eventos: [{ id: 'a', status: 'fechado', fechamento: { em: 'x', foto: { resultado: {} } } }] }
    expect(eventosReabertosPorBackup(atuais, backup)).toEqual([])
  })

  it('backup sem o id (mescla não toca o evento) e lixo não-objeto não disparam', async () => {
    const { eventosReabertosPorBackup } = await import('./storage.js')
    const atuais = [{ id: 'a', nome: 'F', status: 'fechado', fechamento: { em: 'x', foto: { resultado: {} } } }]
    expect(eventosReabertosPorBackup(atuais, { eventos: [{ id: 'outro' }, null, 'lixo', 42] })).toEqual([])
    expect(eventosReabertosPorBackup(atuais, { eventos: [] })).toEqual([])
  })
})

describe('parseBackup estrito — evento-lixo é recusado em português, nunca derruba a tela (H3-B resto, 20/07/2026)', () => {
  const montar = (eventos) => JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos })

  it.each([
    ['null', [null]],
    ['string', ['lixo']],
    ['número', [42]],
    ['array', [[]]],
  ])('eventos com %s recusa citando a posição', async (_n, eventos) => {
    const { parseBackup } = await import('./storage.js')
    expect(() => parseBackup(montar([...eventos]))).toThrow(/evento nº 1/)
  })

  it('a posição citada é a do PRIMEIRO torto (1-based), com eventos bons antes', async () => {
    const { parseBackup } = await import('./storage.js')
    expect(() => parseBackup(montar([novoEvento('ok'), novoEvento('ok2'), 'lixo']))).toThrow(
      /evento nº 3/
    )
  })

  it('backup 100% válido continua passando igual', async () => {
    const { parseBackup } = await import('./storage.js')
    const r = parseBackup(montar([novoEvento('ok')]))
    expect(r.eventos).toHaveLength(1)
  })
})


// OBS-1 da lente das travas (aprovada pelo Marco, 23/07/2026): bilheteria
// realizada BRUTA negativa herdada de backup antigo é normalizada para ''
// na migração (simetria com custo realizado/barTaxa/margens); o bar LÍQUIDO
// continua aceitando negativo (prejuízo é legítimo).
import { describe as _dObs1, it as _iObs1, expect as _eObs1 } from 'vitest'
import { migrarEvento as _migObs1 } from './migracao.js'
_dObs1('OBS-1: bilheteria realizada não-negativa na migração', () => {
  _iObs1('negativo herdado vira vazio; bar líquido negativo fica', () => {
    const ev = _migObs1({ nome: 'X', receitaRealizada: { bilheteria: -500, bar: -200 } })
    _eObs1(ev.receitaRealizada.bilheteria).toBe('')
    _eObs1(ev.receitaRealizada.bar).toBe(-200)
  })
  _iObs1('valor válido e vazio passam intactos', () => {
    const ev = _migObs1({ nome: 'X', receitaRealizada: { bilheteria: 1234.5, bar: '' } })
    _eObs1(ev.receitaRealizada.bilheteria).toBe(1234.5)
    _eObs1(ev.receitaRealizada.bar).toBe('')
  })
})


// SPEC-PONTE-RITMO (Marco, 23/07/2026): vínculo do ritmo Tiqueteira — aditivo,
// round-trip estável, forma torta nunca sobrevive pela metade.
import { describe as _dRg, it as _iRg, expect as _eRg } from 'vitest'
import { migrarEvento as _migRg } from './migracao.js'
_dRg('ritmoTiqueteira: vínculo da ponte de ritmo', () => {
  _iRg('backup antigo (sem o campo) vira null', () => {
    _eRg(_migRg({ nome: 'X' }).ritmoTiqueteira).toBe(null)
  })
  _iRg('vínculo válido passa inteiro e é idempotente', () => {
    const ev = _migRg({ nome: 'X', ritmoTiqueteira: { edicaoId: 12, edicaoNome: 'Brisa 14/03' } })
    _eRg(ev.ritmoTiqueteira).toEqual({ edicaoId: 12, edicaoNome: 'Brisa 14/03' })
    _eRg(_migRg(ev).ritmoTiqueteira).toEqual(ev.ritmoTiqueteira)
  })
  _iRg('forma torta (sem edicaoId) vira null — nunca vínculo meio-quebrado', () => {
    _eRg(_migRg({ nome: 'X', ritmoTiqueteira: { edicaoNome: 'só nome' } }).ritmoTiqueteira).toBe(null)
    _eRg(_migRg({ nome: 'X', ritmoTiqueteira: 'lixo' }).ritmoTiqueteira).toBe(null)
  })
})
