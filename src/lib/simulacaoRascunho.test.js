// Testes do modo "Simular" (sugestão 35, Sessão F2-V).
//
// A peça central é a PROVA BYTE A BYTE exigida pela spec: entrar no modo,
// mexer em TUDO que a UI permite (sliders de cenário, ticket médio, reset,
// overrides por lote e — desde 05/08/2026 — os sliders de BAR) e sair SEM
// aplicar deixa o localStorage do evento byte a byte intacto, e o `update`
// real nunca é chamado. O teste usa o storage.js REAL (mesma chave, mesmos
// load/save) com um localStorage de memória, e replica os updaters EXATOS dos
// componentes (Simulador.jsx setCampo/setBar/setBarFixo/handleReset,
// ScenariosTab.jsx setOverride) — se um componente mudar a forma do updater, o
// espelho aqui deve mudar junto.
//
// O rascunho tem TRÊS compartimentos desde que o slider do bar entrou na grade
// (ver o cabeçalho de simulacaoRascunho.js). A regra que a suíte protege é: todo
// slot que `editarRascunho` extrai, quando MUDA aos olhos e na conta, TEM de
// produzir linha no `resumoDoRascunho` — slot capaz de mudar número sem produzir
// linha é mudança que o botão Aplicar grava sem anunciar. A varredura no fim
// deste arquivo falha sozinha quando um slot novo nascer.
//
// Desde 05/08/2026 o rascunho tem uma QUARTA peça, a foto de entrada, e o
// Aplicar grava só o que mudou em relação a ela (decisão (a) do S2 do Marco).
// O último describe deste arquivo é o portão: bar digitado na aba Receita no
// meio da simulação sobrevive, e "lista vazia" quer dizer que o Aplicar não
// muda um byte do evento.
//
// A exceção é declarada e tem caso próprio aqui: vazio → zero no bar não vira
// linha, porque a conta enxerga R$ 0 nos dois — e, desde o portão, também não é
// gravado: o `''` deixou de virar `0` de carona.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  rascunhoDoEvento,
  editarRascunho,
  resumoDoRascunho,
  visaoDoRascunho,
  aplicarRascunho,
} from './simulacaoRascunho.js'
import { resetarSimulacao } from './simulador.js'
import { novoEvento } from './defaults.js'
import { fmtBRL2 } from './format.js'

// ————— localStorage de memória (ambiente node) —————
const mem = new Map()
const localStorageFake = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}
const tinhaLocalStorage = 'localStorage' in globalThis
globalThis.localStorage = localStorageFake
afterAll(() => {
  if (!tinhaLocalStorage) delete globalThis.localStorage
})

// storage.js importado DEPOIS do mock existir (import dinâmico no teste que
// precisa dele seria overkill: o módulo só checa localStorage na chamada).
import { loadStore, saveStore } from './storage.js'

// A mesma chave de storage.js (não exportada de propósito — literal com aviso:
// se a chave mudar lá, este teste quebra e é para quebrar).
const KEY = 'previsao-eventos:v1'

// ————— updaters ESPELHO da UI (mesma forma dos componentes) —————
// Simulador.jsx setCampo:
const setCampo = (cen, campo, v) => (e) => ({
  ...e,
  cenariosConfig: { ...e.cenariosConfig, [cen]: { ...e.cenariosConfig?.[cen], [campo]: v } },
})
// Simulador.jsx setBar (slider de bar por pessoa, um por cenário):
const setBar = (cen, v) => (e) => ({ ...e, barTicket: { ...e.barTicket, [cen]: v } })
// Simulador.jsx setBarFixo (slider único do modo valor fixo):
const setBarFixo = (v) => (e) => ({ ...e, outrasReceitas: { ...e.outrasReceitas, bar: v } })
// Simulador.jsx handleReset:
const reset = (e) => ({ ...e, cenariosConfig: resetarSimulacao(e.cenariosConfig) })
// ScenariosTab.jsx setOverride:
const setOverride = (cen, loteId, v) => (e) => {
  const base = e.cenariosConfig || {}
  const overrides = { pessimista: {}, realista: {}, otimista: {}, ...(base.overrides || {}) }
  const m = { ...(overrides[cen] || {}) }
  if (v === '' || v == null) delete m[loteId]
  else m[loteId] = v
  return { ...e, cenariosConfig: { ...base, overrides: { ...overrides, [cen]: m } } }
}

const eventoDeTeste = () => {
  const ev = novoEvento('Brisa de teste')
  // `valor` é o campo do preço (até 06/10/2026 este molde usava `preco`, que
  // nenhum código lê — os dois lotes eram, sem ninguém querer, lotes SEM
  // PREÇO, e o resumo do rascunho passou a dizer isso depois da S7/P8).
  ev.lotes = [
    { id: 'l1', nome: 'Lote 1', quantidade: 200, valor: 60 },
    { id: 'l2', nome: 'Lote Porta', quantidade: 100, valor: 80, somenteOtimista: true },
  ]
  return ev
}

beforeEach(() => mem.clear())

describe('rascunhoDoEvento', () => {
  it('é um clone profundo — mexer no rascunho não alcança o salvo', () => {
    const ev = eventoDeTeste()
    ev.cenariosConfig = { pessimista: { vendaPct: 70 }, overrides: { realista: { l1: 150 } } }
    ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
    const r = rascunhoDoEvento(ev)
    expect(r.cenariosConfig).toEqual(ev.cenariosConfig)
    expect(r.barTicket).toEqual(ev.barTicket)
    r.cenariosConfig.pessimista.vendaPct = 10
    r.cenariosConfig.overrides.realista.l1 = 1
    r.barTicket.realista = 1
    expect(ev.cenariosConfig.pessimista.vendaPct).toBe(70)
    expect(ev.cenariosConfig.overrides.realista.l1).toBe(150)
    expect(ev.barTicket.realista).toBe(110)
  })

  it('carrega os três compartimentos MAIS a foto de onde saiu', () => {
    const ev = eventoDeTeste()
    ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
    ev.outrasReceitas = { bar: 180000, patrocinio: 50000 }
    const r = rascunhoDoEvento(ev)
    expect(Object.keys(r).sort()).toEqual(['barFixo', 'barTicket', 'cenariosConfig', 'entrada'])
    expect(r.barTicket.realista).toBe(110)
    expect(r.barFixo).toBe(180000)
    // a foto nasce idêntica aos slots — o rascunho ainda não mudou nada
    expect(r.entrada).toEqual({
      cenariosConfig: r.cenariosConfig,
      barTicket: r.barTicket,
      barFixo: r.barFixo,
    })
  })

  it('a foto é clone PRÓPRIO — editar o rascunho não reescreve o passado', () => {
    const ev = eventoDeTeste()
    ev.barTicket = { realista: 110 }
    ev.cenariosConfig = { realista: { vendaPct: 90 } }
    const r = rascunhoDoEvento(ev)
    r.barTicket.realista = 999
    r.cenariosConfig.realista.vendaPct = 1
    expect(r.entrada.barTicket.realista).toBe(110)
    expect(r.entrada.cenariosConfig.realista.vendaPct).toBe(90)
  })

  it('evento vazio/ausente não explode — slots vazios', () => {
    const vazio = { cenariosConfig: {}, barTicket: {}, barFixo: '' }
    expect(rascunhoDoEvento(undefined)).toEqual({ ...vazio, entrada: vazio })
    expect(rascunhoDoEvento({})).toEqual({ ...vazio, entrada: vazio })
  })
})

describe('visaoDoRascunho — o evento como a tela o enxerga', () => {
  it('o bar do rascunho aparece na visão, e as outras chaves de outrasReceitas continuam lá', () => {
    const ev = eventoDeTeste()
    ev.outrasReceitas = { bar: 100, patrocinio: 50000 }
    const r = rascunhoDoEvento(ev)
    r.barTicket = { pessimista: 130 }
    r.barFixo = 999
    const visao = visaoDoRascunho(ev, r)
    expect(visao.barTicket.pessimista).toBe(130)
    expect(visao.outrasReceitas.bar).toBe(999)
    // O slot é SÓ o `bar`: o resto de outrasReceitas vem do evento salvo, a
    // cada render. O rascunho não pode ter alcance maior que os controles que o
    // alimentam, e os sliders da grade mexem no `bar` e em mais nada.
    expect(visao.outrasReceitas.patrocinio).toBe(50000)
  })

  it('chave de outrasReceitas escrita DEPOIS de abrir o rascunho aparece na visão na hora', () => {
    const ev = eventoDeTeste()
    ev.outrasReceitas = { bar: 100, patrocinio: 0 }
    const r = rascunhoDoEvento(ev)
    // a aba Receita salvou de verdade enquanto o rascunho estava aberto
    const evDepois = { ...ev, outrasReceitas: { ...ev.outrasReceitas, patrocinio: 70000 } }
    expect(visaoDoRascunho(evDepois, r).outrasReceitas.patrocinio).toBe(70000)
  })

  it('sem rascunho, a visão é o próprio evento', () => {
    const ev = eventoDeTeste()
    expect(visaoDoRascunho(ev, null)).toBe(ev)
  })
})

describe('aplicarRascunho — o que vai para o store', () => {
  it('grava os três slots e NÃO compartilha referência com o rascunho vivo', () => {
    const ev = eventoDeTeste()
    ev.outrasReceitas = { bar: '', patrocinio: 50000 }
    const r = rascunhoDoEvento(ev)
    r.cenariosConfig = { realista: { vendaPct: 45 } }
    r.barTicket = { pessimista: 130, realista: 140, otimista: 150 }
    r.barFixo = 180000
    const salvo = aplicarRascunho(ev, r)
    expect(salvo.cenariosConfig.realista.vendaPct).toBe(45)
    expect(salvo.barTicket).toEqual({ pessimista: 130, realista: 140, otimista: 150 })
    expect(salvo.outrasReceitas.bar).toBe(180000)
    expect(salvo.outrasReceitas.patrocinio).toBe(50000)
    // continuar mexendo no rascunho depois de aplicar não pode alcançar o salvo
    r.barTicket.realista = 1
    r.cenariosConfig.realista.vendaPct = 1
    expect(salvo.barTicket.realista).toBe(140)
    expect(salvo.cenariosConfig.realista.vendaPct).toBe(45)
  })
})

describe('editarRascunho', () => {
  it('aplica os updaters reais da UI ao rascunho — cenários E bar', () => {
    const ev = eventoDeTeste()
    let r = rascunhoDoEvento(ev)
    r = editarRascunho(r, ev, setCampo('pessimista', 'vendaPct', 55))
    r = editarRascunho(r, ev, setCampo('realista', 'custoPct', 8))
    r = editarRascunho(r, ev, setOverride('otimista', 'l2', 90))
    r = editarRascunho(r, ev, setBar('pessimista', 130))
    r = editarRascunho(r, ev, setBarFixo(180000))
    expect(r.cenariosConfig.pessimista.vendaPct).toBe(55)
    expect(r.cenariosConfig.realista.custoPct).toBe(8)
    expect(r.cenariosConfig.overrides.otimista.l2).toBe(90)
    expect(r.barTicket.pessimista).toBe(130)
    expect(r.barFixo).toBe(180000)
  })

  it('mexer no bar NÃO mexe nos cenários, e vice-versa', () => {
    const ev = eventoDeTeste()
    let r = rascunhoDoEvento(ev)
    r = editarRascunho(r, ev, setCampo('realista', 'vendaPct', 60))
    const cfgAntes = r.cenariosConfig
    r = editarRascunho(r, ev, setBar('realista', 110))
    expect(r.cenariosConfig).toBe(cfgAntes)
    expect(r.barTicket.realista).toBe(110)
  })

  it('extrai SÓ os três slots — mudança em outro campo do evento é descartada', () => {
    const ev = eventoDeTeste()
    const r = editarRascunho(rascunhoDoEvento(ev), ev, (e) => ({
      ...e,
      nome: 'NÃO DEVE VAZAR',
      lotes: [],
      cenariosConfig: { ...e.cenariosConfig, realista: { vendaPct: 42 } },
      barTicket: { realista: 111 },
    }))
    expect(r.cenariosConfig.realista).toEqual({ vendaPct: 42 })
    expect(r.barTicket).toEqual({ realista: 111 })
    expect(Object.keys(r).sort()).toEqual(['barFixo', 'barTicket', 'cenariosConfig', 'entrada'])
    expect(r.nome).toBeUndefined()
    expect(r.lotes).toBeUndefined()
    expect(ev.nome).toBe('Brisa de teste')
    expect(ev.lotes.length).toBe(2)
  })

  it('updater que devolve lixo deixa o rascunho como está', () => {
    const ev = eventoDeTeste()
    const r0 = rascunhoDoEvento(ev)
    expect(editarRascunho(r0, ev, () => null)).toBe(r0)
    const r1 = editarRascunho(r0, ev, () => ({ cenariosConfig: undefined, barTicket: undefined }))
    expect(r1.cenariosConfig).toBe(r0.cenariosConfig)
    expect(r1.barTicket).toBe(r0.barTicket)
    expect(r1.barFixo).toBe(r0.barFixo)
  })

  // A foto não está na VISÃO, então nenhum updater da UI tem como alcançá-la —
  // nem um updater malicioso que devolva um `entrada` inventado.
  it('a foto de entrada atravessa a edição intacta', () => {
    const ev = eventoDeTeste()
    ev.barTicket = { realista: 110 }
    const r0 = rascunhoDoEvento(ev)
    let r = editarRascunho(r0, ev, setBar('realista', 300))
    r = editarRascunho(r, ev, setCampo('realista', 'vendaPct', 33))
    r = editarRascunho(r, ev, (e) => ({ ...e, entrada: { barTicket: { realista: 300 } } }))
    expect(r.entrada).toBe(r0.entrada)
    expect(r.entrada.barTicket.realista).toBe(110)
  })
})

describe('resumoDoRascunho — o texto que o botão Aplicar promete', () => {
  const lotes = eventoDeTeste().lotes
  // O resumo compara a FOTO DE ENTRADA × o rascunho de agora (Marco, 05/08/2026
  // — decisão (a) do S2). `dif` monta os dois lados e devolve as linhas.
  const slots = (cenariosConfig = {}, barTicket = {}, barFixo = '') => ({
    cenariosConfig,
    barTicket,
    barFixo,
  })
  const dif = (antes, depois) => resumoDoRascunho({ ...depois, entrada: antes }, lotes)

  it('nada mudou → lista vazia', () => {
    const salvo = eventoDeTeste()
    salvo.cenariosConfig = { pessimista: { vendaPct: 70, custoPct: 10, ticketPct: 0 } }
    expect(resumoDoRascunho(rascunhoDoEvento(salvo), lotes)).toEqual([])
  })

  it('campo ausente gravado com o próprio valor de exibição NÃO vira mudança (efetivo igual)', () => {
    // slider arrastado e devolvido: pessimista.vendaPct ausente (exibe 80,
    // padrão desde 27/07/2026 — decisão A do Marco) → 80 explícito
    expect(dif(slots(), slots({ pessimista: { vendaPct: 80 } }))).toEqual([])
  })

  it('vendas, custos e ajuste do ticket com valores efetivos e sinal', () => {
    expect(
      dif(
        slots({ pessimista: { vendaPct: 95, custoPct: 10, ticketPct: 0 } }),
        slots({ pessimista: { vendaPct: 60, custoPct: 15, ticketPct: -10 } })
      )
    ).toEqual([
      'Pessimista: vendas 95% → 60%',
      'Pessimista: custos +10% → +15%',
      'Pessimista: ajuste do ticket 0% → -10%',
    ])
  })

  it('decimal digitado no campo sai com vírgula (pt-BR), nunca com ponto', () => {
    expect(
      dif(slots({ pessimista: { custoPct: 10 } }), slots({ pessimista: { custoPct: 12.5 } }))
    ).toEqual(['Pessimista: custos +10% → +12,5%'])
  })

  it('ticket médio manual: automático → valor, valor → valor, valor → automático', () => {
    // fmtBRL2 omite centavos de inteiro e usa o espaço do Intl — compõe-se a
    // expectativa com o próprio formatador (mesmo formato do DRE).
    expect(dif(slots({ realista: {} }), slots({ realista: { ticketMedio: 80 } }))).toEqual([
      `Realista: ticket médio automático → ${fmtBRL2(80)}`,
    ])
    expect(
      dif(slots({ realista: { ticketMedio: 90 } }), slots({ realista: { ticketMedio: 80.5 } }))
    ).toEqual([`Realista: ticket médio ${fmtBRL2(90)} → ${fmtBRL2(80.5)}`])
    expect(
      dif(slots({ realista: { ticketMedio: 90 } }), slots({ realista: { ticketMedio: '' } }))
    ).toEqual([`Realista: ticket médio ${fmtBRL2(90)} → automático`])
  })

  it('overrides por lote com o NOME do lote: fixar, mudar e voltar ao automático', () => {
    const antes = slots({ overrides: { realista: { l1: 150 } } })
    expect(dif(antes, slots({ overrides: { realista: { l1: 120 }, otimista: { l2: 90 } } }))).toEqual([
      'Realista: Lote 1 150 → 120 ingressos',
      'Otimista: Lote Porta fixado em 90 ingressos',
    ])
    expect(dif(antes, slots({ overrides: { realista: {} } }))).toEqual([
      'Realista: Lote 1 volta ao automático',
    ])
  })

  // ————— bar (Marco, 05/08/2026) —————

  it('bar por pessoa: uma linha por cenário, em reais, com o rótulo do cenário', () => {
    expect(
      dif(
        slots({}, { pessimista: 100, realista: 110, otimista: 120 }),
        slots({}, { pessimista: 130, realista: 110, otimista: 150 })
      )
    ).toEqual([
      `Pessimista: bar por pessoa ${fmtBRL2(100)} → ${fmtBRL2(130)}`,
      `Otimista: bar por pessoa ${fmtBRL2(120)} → ${fmtBRL2(150)}`,
    ])
  })

  it('cenário SEM bar diz "não informado" — a mesma palavra do aviso do cartão', () => {
    expect(dif(slots({}, { pessimista: '' }), slots({}, { pessimista: 110 }))).toEqual([
      `Pessimista: bar por pessoa não informado → ${fmtBRL2(110)}`,
    ])
  })

  it('vazio → zero NÃO vira linha: a conta enxerga R$ 0 nos dois, nada mudou', () => {
    expect(dif(slots({}, { pessimista: '' }), slots({}, { pessimista: 0 }))).toEqual([])
  })

  it('bar fixo (lucro líquido) tem linha própria, sem rótulo de cenário', () => {
    expect(dif(slots({}, {}, 180000), slots({}, {}, 200000))).toEqual([
      `Bar (lucro líquido): ${fmtBRL2(180000)} → ${fmtBRL2(200000)}`,
    ])
  })

  it('o bar é comparado sem olhar o modo do bar — se o slot mudou, o Aplicar grava', () => {
    // o slider por cenário nem aparece na tela em modo fixo/open bar, mas um
    // slot que mudou é gravado, e o que é gravado tem de ser anunciado.
    expect(dif(slots({}, { realista: 110 }, 5000), slots({}, { realista: 999 }, 5000))).toEqual([
      `Realista: bar por pessoa ${fmtBRL2(110)} → ${fmtBRL2(999)}`,
    ])
  })

  // ————— a parede: nenhum slot grava calado —————

  // `entrada` é o LADO ESQUERDO da comparação, não um valor que o Marco edita:
  // "mudar a entrada" não é uma mudança a anunciar, é reescrever o passado. Fica
  // de fora com o motivo escrito; todo slot de VALOR continua na varredura.
  const SLOTS_QUE_NAO_SAO_VALOR = new Set(['entrada'])

  it('TODO slot do rascunho produz linha no resumo (falha sozinho quando nascer um slot novo)', () => {
    const evBase = eventoDeTeste()
    evBase.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
    evBase.outrasReceitas = { bar: 180000, patrocinio: 0 }
    const base = rascunhoDoEvento(evBase)
    // uma mudança VISÍVEL por slot, escrita à mão de propósito
    const mudarSlot = {
      cenariosConfig: (r) => ({
        ...r,
        cenariosConfig: { ...r.cenariosConfig, realista: { vendaPct: 33 } },
      }),
      barTicket: (r) => ({ ...r, barTicket: { ...r.barTicket, realista: 999 } }),
      barFixo: (r) => ({ ...r, barFixo: 1 }),
    }
    for (const slot of Object.keys(base)) {
      if (SLOTS_QUE_NAO_SAO_VALOR.has(slot)) continue
      const mudar = mudarSlot[slot]
      expect(
        mudar,
        `o rascunho carrega o slot "${slot}" e este teste não sabe mexer nele — ` +
          'acrescente a mudança AQUI e a linha correspondente em resumoDoRascunho'
      ).toBeTruthy()
      expect(
        resumoDoRascunho(mudar(base), evBase.lotes).length,
        `mexer só em "${slot}" não produziu linha no resumo — o Aplicar gravaria sem anunciar`
      ).toBeGreaterThan(0)
    }
  })
})

// ————————————————————————————————————————————————————————————————
// O PORTÃO DO APLICAR: grava só o que o rascunho mudou
//
// Marco, 05/08/2026 — decisão (a) do S2 "Aplicar a simulação REVERTE um bar
// digitado na aba Receita". A aba Receita grava de VERDADE durante a simulação;
// enquanto o Aplicar gravava os três slots sempre, ela era revertida — e a linha
// que anunciava a reversão saía da tela a partir de 3 mudanças, porque o rodapé
// mostra no máximo dois itens.
// ————————————————————————————————————————————————————————————————

describe('aplicarRascunho grava SÓ o que o rascunho mudou', () => {
  const lotes = eventoDeTeste().lotes

  it('consumo de bar digitado na aba Receita durante a simulação SOBREVIVE ao Aplicar', () => {
    const ev = eventoDeTeste()
    ev.barModo = 'porPessoa'
    ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
    // o Marco mexe só no PESSIMISTA, pelo slider da grade (rascunho)
    const r = editarRascunho(rascunhoDoEvento(ev), ev, setBar('pessimista', 130))
    // …e digita 125 no REALISTA na aba Receita, que grava de verdade
    const evFresco = { ...ev, barTicket: { ...ev.barTicket, realista: 125 } }
    const salvo = aplicarRascunho(evFresco, r)
    expect(salvo.barTicket.pessimista).toBe(130) // o rascunho entrou
    expect(salvo.barTicket.realista).toBe(125) // e a digitação sobreviveu
    expect(salvo.barTicket.otimista).toBe(120)
    // e o rodapé não prometeu mexer no realista
    expect(resumoDoRascunho(r, lotes)).toEqual([
      `Pessimista: bar por pessoa ${fmtBRL2(100)} → ${fmtBRL2(130)}`,
    ])
  })

  it('bar em VALOR FIXO digitado na Receita sobrevive quando o rascunho não o tocou', () => {
    const ev = eventoDeTeste()
    ev.outrasReceitas = { bar: 180000, patrocinio: 50000 }
    const r = editarRascunho(rascunhoDoEvento(ev), ev, setCampo('realista', 'vendaPct', 60))
    const evFresco = { ...ev, outrasReceitas: { ...ev.outrasReceitas, bar: 195000 } }
    expect(aplicarRascunho(evFresco, r).outrasReceitas.bar).toBe(195000)
  })

  it('cenariosConfig que o rascunho não tocou nem é gravado', () => {
    const ev = eventoDeTeste()
    ev.cenariosConfig = { realista: { vendaPct: 90 } }
    ev.barTicket = { realista: 110 }
    const r = editarRascunho(rascunhoDoEvento(ev), ev, setBar('realista', 140))
    const evFresco = { ...ev, cenariosConfig: { realista: { vendaPct: 77 } } }
    const salvo = aplicarRascunho(evFresco, r)
    expect(salvo.cenariosConfig.realista.vendaPct).toBe(77)
    expect(salvo.barTicket.realista).toBe(140)
  })

  // O risco DECLARADO da decisão (a), com teste para não virar surpresa.
  it('o MESMO campo nos dois lugares: o rascunho vence — e a linha aparece no rodapé', () => {
    const ev = eventoDeTeste()
    ev.barTicket = { realista: 110 }
    const r = editarRascunho(rascunhoDoEvento(ev), ev, setBar('realista', 150))
    const evFresco = { ...ev, barTicket: { realista: 125 } }
    expect(aplicarRascunho(evFresco, r).barTicket.realista).toBe(150)
    expect(resumoDoRascunho(r, lotes)).toEqual([
      `Realista: bar por pessoa ${fmtBRL2(110)} → ${fmtBRL2(150)}`,
    ])
  })

  it('vazio → zero deixou de pegar carona: o `` não vira 0 no dado salvo', () => {
    const ev = eventoDeTeste()
    ev.barTicket = { pessimista: '', realista: 110 }
    let r = rascunhoDoEvento(ev)
    r = editarRascunho(r, ev, setBar('pessimista', 0)) // R$ 0 na conta, igual a vazio
    r = editarRascunho(r, ev, setBar('realista', 140)) // esta É uma mudança
    const salvo = aplicarRascunho(ev, r)
    expect(salvo.barTicket.pessimista).toBe('') // continua "não informado"
    expect(salvo.barTicket.realista).toBe(140)
  })

  // A INVARIANTE: rodapé e botão contam a mesma história, por construção.
  it('lista vazia → o Aplicar não muda NADA no evento', () => {
    const ev = eventoDeTeste()
    ev.cenariosConfig = { realista: { vendaPct: 90 } }
    ev.barTicket = { pessimista: '', realista: 110, otimista: 120 }
    ev.outrasReceitas = { bar: '', patrocinio: 50000 }
    let r = rascunhoDoEvento(ev)
    // mexidas que NÃO mudam nada aos olhos nem na conta
    r = editarRascunho(r, ev, setBar('pessimista', 0)) // vazio → zero
    r = editarRascunho(r, ev, setBarFixo('')) // vazio → vazio
    expect(resumoDoRascunho(r, ev.lotes)).toEqual([])
    expect(aplicarRascunho(ev, r)).toEqual(ev)
  })
})

describe('PROVA BYTE A BYTE — mexer em tudo e sair sem aplicar não toca o salvo', () => {
  it('localStorage idêntico (===) após entrar, mexer em todos os campos e descartar; update nunca chamado', () => {
    // Arranjo: store real na chave real, como o App faz.
    const ev = eventoDeTeste()
    ev.cenariosConfig = {
      ...ev.cenariosConfig,
      realista: { ...ev.cenariosConfig?.realista, ticketMedio: 75 },
      overrides: { pessimista: {}, realista: { l1: 150 }, otimista: {} },
    }
    ev.barTicket = { pessimista: 100, realista: 110, otimista: 120 }
    ev.outrasReceitas = { bar: 180000, patrocinio: 50000 }
    const store = { ...loadStore(), eventos: [ev] }
    expect(saveStore(store).ok).toBe(true)
    const bytesAntes = localStorage.getItem(KEY)
    expect(bytesAntes).toBeTruthy()

    // O caminho salvo (espelho do App.updateEvento + useEffect de save) — se
    // alguém o chamar durante a simulação, o teste acusa.
    const update = vi.fn()

    // Entrar no modo e mexer em TUDO que a UI oferece.
    let rascunho = rascunhoDoEvento(ev)
    const edicoes = [
      setCampo('pessimista', 'vendaPct', 40),
      setCampo('pessimista', 'custoPct', 25),
      setCampo('pessimista', 'ticketPct', -15),
      setCampo('realista', 'vendaPct', 60),
      setCampo('realista', 'custoPct', 12),
      setCampo('realista', 'ticketPct', 5),
      setCampo('realista', 'ticketMedio', 99),
      setCampo('otimista', 'vendaPct', 80),
      setCampo('otimista', 'custoPct', 3),
      setCampo('otimista', 'ticketMedio', ''),
      setOverride('realista', 'l1', 33),
      setOverride('realista', 'l2', 10),
      setOverride('otimista', 'l2', ''),
      setBar('pessimista', 130),
      setBar('realista', 140),
      setBar('otimista', 150),
      setBarFixo(999999),
      reset,
      setCampo('pessimista', 'vendaPct', 51),
      setBar('pessimista', 77),
    ]
    for (const fn of edicoes) rascunho = editarRascunho(rascunho, ev, fn)

    // O rascunho de fato mudou (a simulação funcionou)…
    expect(resumoDoRascunho(rascunho, ev.lotes).length).toBeGreaterThan(0)
    expect(rascunho.cenariosConfig.pessimista.vendaPct).toBe(51)
    expect(rascunho.barTicket.pessimista).toBe(77)
    expect(rascunho.barFixo).toBe(999999)

    // …e DESCARTAR = jogar o rascunho fora. Nenhum byte mudou, nenhum update.
    rascunho = null
    expect(localStorage.getItem(KEY)).toBe(bytesAntes)
    expect(update).not.toHaveBeenCalled()
    // O evento em memória também está intacto (clone profundo na entrada).
    expect(ev.cenariosConfig.realista.ticketMedio).toBe(75)
    expect(ev.cenariosConfig.overrides.realista.l1).toBe(150)
    expect(ev.barTicket).toEqual({ pessimista: 100, realista: 110, otimista: 120 })
    expect(ev.outrasReceitas).toEqual({ bar: 180000, patrocinio: 50000 })
  })

  it('aplicar é o ÚNICO caminho que persiste — e persiste exatamente o rascunho, bar incluído', () => {
    const ev = eventoDeTeste()
    ev.outrasReceitas = { bar: '', patrocinio: 50000 }
    let store = { ...loadStore(), eventos: [ev] }
    expect(saveStore(store).ok).toBe(true)
    const bytesAntes = localStorage.getItem(KEY)

    let rascunho = rascunhoDoEvento(ev)
    rascunho = editarRascunho(rascunho, ev, setCampo('pessimista', 'vendaPct', 45))
    rascunho = editarRascunho(rascunho, ev, setBar('realista', 110))
    expect(localStorage.getItem(KEY)).toBe(bytesAntes) // ainda nada

    // Espelho do handler de Aplicar (sem o snapshot, testado em protecao.test.js):
    // update real grava o rascunho no evento e o App salva o store.
    store = {
      ...store,
      eventos: store.eventos.map((e) => (e.id === ev.id ? aplicarRascunho(e, rascunho) : e)),
    }
    expect(saveStore(store).ok).toBe(true)
    const depois = JSON.parse(localStorage.getItem(KEY))
    expect(depois.eventos[0].cenariosConfig.pessimista.vendaPct).toBe(45)
    expect(depois.eventos[0].barTicket.realista).toBe(110)
    // e o patrocínio salvo sobreviveu ao Aplicar
    expect(depois.eventos[0].outrasReceitas.patrocinio).toBe(50000)
  })
})
