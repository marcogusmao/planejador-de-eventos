import { describe, it, expect } from 'vitest'
import {
  ehCampoDeTexto,
  ehControleContinuo,
  descritorDeCampo,
  resolverDescritor,
} from './descritorEdicao.js'

describe('o que conta como campo de digitação', () => {
  it('input de texto, número e afins contam', () => {
    expect(ehCampoDeTexto({ tag: 'INPUT', tipo: 'text' })).toBe(true)
    expect(ehCampoDeTexto({ tag: 'input', tipo: 'number' })).toBe(true)
    expect(ehCampoDeTexto({ tag: 'INPUT', tipo: null })).toBe(true)
    expect(ehCampoDeTexto({ tag: 'TEXTAREA' })).toBe(true)
    expect(ehCampoDeTexto({ tag: 'DIV', editavel: true })).toBe(true)
  })

  it('clique não é digitação: checkbox, radio, botão, arquivo e range ficam de fora', () => {
    for (const tipo of ['checkbox', 'radio', 'button', 'file', 'range', 'submit']) {
      expect(ehCampoDeTexto({ tag: 'INPUT', tipo })).toBe(false)
    }
    expect(ehCampoDeTexto({ tag: 'BUTTON' })).toBe(false)
    expect(ehCampoDeTexto({ tag: 'SELECT' })).toBe(false)
    expect(ehCampoDeTexto(null)).toBe(false)
    expect(ehCampoDeTexto({})).toBe(false)
  })
})

describe('rótulo do passo a partir do campo em foco', () => {
  const el = { id: 'fake' }

  it('usa o rótulo que o Marco está vendo na tela', () => {
    const d = descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: el, rotulo: 'Margem alvo' })
    expect(d.rotulo).toBe('mudar Margem alvo')
    expect(d.grupo).toBe(el)
  })

  it('tira a unidade entre parênteses e o espaço não-quebrável do Field', () => {
    expect(
      descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: el, rotulo: 'Preço (R$)' }).rotulo
    ).toBe('mudar Preço')
    expect(
      descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: el, rotulo: 'Contingência (%)' })
        .rotulo
    ).toBe('mudar Contingência')
  })

  it('rótulo inútil (vazio, curto demais ou comprido demais) vira genérico, nunca errado', () => {
    for (const rotulo of ['', '   ', 'x', '(R$)', 'a'.repeat(80)]) {
      expect(descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: el, rotulo }).rotulo).toBe('')
    }
  })

  it('fora de um campo de digitação: sem rótulo e SEM grupo (ação discreta)', () => {
    const d = descritorDeCampo({ tag: 'BUTTON', elemento: el, rotulo: 'Apagar' })
    expect(d).toEqual({ rotulo: '', grupo: null })
  })

  it('sem elemento (ambiente sem DOM) o grupo é nulo — não agrupa às cegas', () => {
    const d = descritorDeCampo({ tag: 'INPUT', tipo: 'text', rotulo: 'Preço' })
    expect(d.rotulo).toBe('mudar Preço')
    expect(d.grupo).toBe(null)
  })

  it('campos diferentes com o MESMO rótulo têm grupos diferentes', () => {
    const a = { id: 'lote-1-preco' }
    const b = { id: 'lote-2-preco' }
    const dA = descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: a, rotulo: 'Preço' })
    const dB = descritorDeCampo({ tag: 'INPUT', tipo: 'text', elemento: b, rotulo: 'Preço' })
    expect(dA.rotulo).toBe(dB.rotulo)
    expect(dA.grupo).not.toBe(dB.grupo)
  })
})

// ————— S2-C: o slider é agrupável, mas não é campo de texto —————
describe('controle contínuo (slider)', () => {
  it('input[type=range] é controle contínuo', () => {
    expect(ehControleContinuo({ tag: 'INPUT', tipo: 'range' })).toBe(true)
  })

  it('mas NÃO é campo de texto — o Cmd+Z ali é do app, não do navegador', () => {
    // (slider não tem desfazer nativo para devolver; ver atalhoHistorico.js)
    expect(ehCampoDeTexto({ tag: 'INPUT', tipo: 'range' })).toBe(false)
  })

  it('o range vira descritor COM grupo — é o que faz o arrasto ser 1 passo', () => {
    const el = {}
    const d = descritorDeCampo({ tag: 'INPUT', tipo: 'range', elemento: el, rotulo: 'Ingressos vendidos' })
    expect(d.grupo).toBe(el)
    expect(d.rotulo).toBe('mudar Ingressos vendidos')
  })

  it('checkbox e botão seguem sendo ação discreta (grupo nulo)', () => {
    expect(ehControleContinuo({ tag: 'INPUT', tipo: 'checkbox' })).toBe(false)
    expect(ehControleContinuo({ tag: 'BUTTON' })).toBe(false)
    expect(descritorDeCampo({ tag: 'INPUT', tipo: 'checkbox', elemento: {} }).grupo).toBe(null)
  })
})

// ————— S2-D: ação grande não pode herdar o nome de um campo em foco —————
//
// (Verificação adversarial 19/07/2026.) As ações do princípio 7 — carregar um
// benchmark por cima dos custos, aplicar valores do Financeiro — chamavam
// `update` com um argumento só. O App então lia o CAMPO EM FOCO. Em Chrome o
// clique tira o foco do campo e o rótulo cai no genérico; em Safari e Firefox
// no macOS o <button> não recebe foco ao clicar, o campo de texto continua
// focado, e o botão de desfazer passa a prometer "mudar Margem alvo" para uma
// ação que substituiu a tabela de custos inteira.
describe('resolverDescritor — quem nomeou a ação ganha (S2-D)', () => {
  // O pior caso do achado: o Marco digitou na Margem alvo e clicou no botão.
  const focoNoCampoDeTexto = () => ({ rotulo: 'mudar Margem alvo', grupo: {} })

  it('sem descritor, o rótulo vem mesmo do campo em foco (o comportamento antigo)', () => {
    expect(resolverDescritor(undefined, focoNoCampoDeTexto).rotulo).toBe('mudar Margem alvo')
  })

  it('com descritor explícito, o foco NÃO é nem consultado', () => {
    let leu = false
    const foco = () => {
      leu = true
      return focoNoCampoDeTexto()
    }
    const d = resolverDescritor('carregar Festa do Cordel em Estrutura', foco)
    expect(d.rotulo).toBe('carregar Festa do Cordel em Estrutura')
    expect(leu).toBe(false)
  })

  it('descritor em string vira { rotulo } — a forma curta das ações discretas', () => {
    expect(resolverDescritor('apagar um lote', focoNoCampoDeTexto)).toEqual({
      rotulo: 'apagar um lote',
    })
  })

  it('descritor em objeto passa inteiro (rótulo + grupo do agrupamento)', () => {
    const el = {}
    expect(resolverDescritor({ rotulo: 'mudar Ingressos vendidos', grupo: el }, focoNoCampoDeTexto))
      .toEqual({ rotulo: 'mudar Ingressos vendidos', grupo: el })
  })
})
