import { describe, it, expect } from 'vitest'
import { interpretarAtalho } from './atalhoHistorico.js'

const botao = { tag: 'BUTTON' }
const campo = { tag: 'INPUT', tipo: 'text' }

describe('atalhos fora de campo de texto', () => {
  it('Cmd+Z desfaz e Cmd+Shift+Z refaz', () => {
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: botao })).toBe('desfazer')
    expect(interpretarAtalho({ key: 'z', metaKey: true, shiftKey: true, alvo: botao })).toBe(
      'refazer'
    )
  })

  it('Ctrl serve igual (teclado de PC), e Ctrl+Y também refaz', () => {
    expect(interpretarAtalho({ key: 'z', ctrlKey: true, alvo: botao })).toBe('desfazer')
    expect(interpretarAtalho({ key: 'z', ctrlKey: true, shiftKey: true, alvo: botao })).toBe(
      'refazer'
    )
    expect(interpretarAtalho({ key: 'y', ctrlKey: true, alvo: botao })).toBe('refazer')
  })

  it('maiúscula (Shift muda o key para Z) continua valendo', () => {
    expect(interpretarAtalho({ key: 'Z', metaKey: true, shiftKey: true, alvo: botao })).toBe(
      'refazer'
    )
  })

  it('sem foco nenhum (corpo da página) o atalho vale', () => {
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: null })).toBe('desfazer')
  })
})

describe('o atalho NÃO é sequestrado dentro de um campo de texto', () => {
  it('digitando num campo, Cmd+Z é o desfazer nativo do input', () => {
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: campo })).toBe(null)
    expect(interpretarAtalho({ key: 'z', metaKey: true, shiftKey: true, alvo: campo })).toBe(null)
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: { tag: 'TEXTAREA' } })).toBe(null)
    expect(
      interpretarAtalho({ key: 'z', metaKey: true, alvo: { tag: 'DIV', editavel: true } })
    ).toBe(null)
  })

  it('mas um checkbox ou um select não são digitação — ali o atalho vale', () => {
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: { tag: 'INPUT', tipo: 'checkbox' } })).toBe(
      'desfazer'
    )
    expect(interpretarAtalho({ key: 'z', metaKey: true, alvo: { tag: 'SELECT' } })).toBe('desfazer')
  })
})

describe('o que NÃO é atalho de histórico', () => {
  it('Z sem modificador, outras teclas com modificador, e Alt junto', () => {
    expect(interpretarAtalho({ key: 'z', alvo: botao })).toBe(null)
    expect(interpretarAtalho({ key: 's', metaKey: true, alvo: botao })).toBe(null)
    expect(interpretarAtalho({ key: 'z', metaKey: true, altKey: true, alvo: botao })).toBe(null)
    expect(interpretarAtalho(null)).toBe(null)
  })
})
