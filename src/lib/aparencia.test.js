// Aparência (sugestão 26, Sessão K) — testes das partes puras: forma segura
// das preferências, cadeia de fallback das cores e derivações de cor.
// O semáforo NÃO aparece aqui de propósito: ele fica fora da aparência.
import { describe, it, expect } from 'vitest'
import {
  formaAparencia,
  corFesta,
  corAcento,
  corValida,
  escurecer,
  comAlpha,
  hexParaRgb,
  temaEscuroEfetivo,
  ACENTO_PADRAO,
  CORES_FESTA_PADRAO,
  COR_FESTA_LIVRE,
  SWATCHES_MARCA,
  TEMAS,
} from './aparencia.js'

describe('formaAparencia', () => {
  it('qualquer entrada torta vira o padrão (nada inválido entra calado)', () => {
    for (const torto of [null, undefined, 42, 'abc', [], { acento: 'azul' }]) {
      expect(formaAparencia(torto)).toEqual({ acento: null, festas: {}, tema: 'claro' })
    }
  })

  it('aceita acento e festas válidos, normalizando para minúsculas', () => {
    const r = formaAparencia({ acento: '#FF000C', festas: { Brisa: '#0045DD' } })
    expect(r).toEqual({ acento: '#ff000c', festas: { Brisa: '#0045dd' }, tema: 'claro' })
  })

  it('descarta cor de festa inválida e tipo vazio, preservando as válidas', () => {
    const r = formaAparencia({
      festas: { Brisa: 'vermelho', 'Sobrado': '#fecd07', '  ': '#0045dd' },
    })
    expect(r.festas).toEqual({ 'Sobrado': '#fecd07' })
  })
})

describe('corFesta — cadeia escolhida → padrão da marca → rosa livre', () => {
  it('sem preferência, as 4 marcas usam o NOVO mapa da casa (F2-Y)', () => {
    // Marfim AZUL · Brisa VERMELHO · Sobrado VERDE · O Galeao LARANJA PASTEL
    expect(corFesta('Brisa', null)).toBe('#ff000c')
    expect(corFesta('Marfim Alto', null)).toBe('#0045dd')
    expect(corFesta('Sobrado', null)).toBe('#00782a')
    expect(corFesta('O Galeao', null)).toBe('#c2410c')
  })

  it('festa custom sem preferência nasce no rosa (a cor livre da paleta)', () => {
    expect(corFesta('Bloco de Carnaval', null)).toBe(COR_FESTA_LIVRE)
  })

  it('preferência dos Ajustes vence o padrão; inválida cai no padrão', () => {
    const prefs = { festas: { Brisa: '#fecd07', 'Sobrado': 'torto' } }
    expect(corFesta('Brisa', prefs)).toBe('#fecd07')
    expect(corFesta('Sobrado', prefs)).toBe('#00782a')
  })

  it('sem categoria ("" ou null) = neutro, nunca cor de marca', () => {
    expect(corFesta('', null)).toBe('#9b958a')
    expect(corFesta(null, null)).toBe('#9b958a')
  })
})

describe('corAcento', () => {
  it('padrão = azul da marca; escolhido vence; inválido volta ao padrão', () => {
    expect(corAcento(null)).toBe(ACENTO_PADRAO)
    expect(corAcento({ acento: '#00782a' })).toBe('#00782a')
    expect(corAcento({ acento: 'verde' })).toBe(ACENTO_PADRAO)
  })
})

describe('derivações de cor', () => {
  it('hexParaRgb decompõe e rejeita formato inválido', () => {
    expect(hexParaRgb('#0045dd')).toEqual({ r: 0, g: 69, b: 221 })
    expect(hexParaRgb('0045dd')).toBeNull()
    expect(hexParaRgb('#fff')).toBeNull()
  })

  it('escurecer produz hex válido mais escuro (hover do acento)', () => {
    const r = escurecer('#0045dd')
    expect(corValida(r)).toBe(true)
    expect(hexParaRgb(r).b).toBeLessThan(221)
  })

  it('comAlpha vira rgba com o alpha pedido (tinta do acento)', () => {
    expect(comAlpha('#0045dd', 0.07)).toBe('rgba(0, 69, 221, 0.07)')
  })
})

describe('constantes da marca', () => {
  it('os swatches são a paleta oficial + quase-preto, todos válidos', () => {
    expect(SWATCHES_MARCA.map((s) => s.cor)).toEqual([
      '#0045dd',
      '#fb9fc6',
      '#fecd07',
      '#00782a',
      '#ff000c',
      '#211f1c',
    ])
    for (const s of SWATCHES_MARCA) expect(corValida(s.cor)).toBe(true)
  })

  it('padrões por festa batem com o NOVO CORES_MARCA da casa (F2-Y)', () => {
    expect(CORES_FESTA_PADRAO).toEqual({
      'Marfim Alto': '#0045dd',
      Brisa: '#ff000c',
      'Sobrado': '#00782a',
      'O Galeao': '#c2410c',
    })
  })
})

describe('tema (sugestão 31 / tema G)', () => {
  it('formaAparencia aceita tema válido e cai no claro quando inválido/ausente', () => {
    expect(formaAparencia({ tema: 'escuro' }).tema).toBe('escuro')
    expect(formaAparencia({ tema: 'auto' }).tema).toBe('auto')
    expect(formaAparencia({ tema: 'roxo' }).tema).toBe('claro')
    expect(formaAparencia({}).tema).toBe('claro')
    expect(formaAparencia(null).tema).toBe('claro')
  })
  it('TEMAS lista os três modos', () => {
    expect(TEMAS).toEqual(['claro', 'escuro', 'auto'])
  })
  it('temaEscuroEfetivo: escuro=sim, claro=não (independe do sistema)', () => {
    expect(temaEscuroEfetivo({ tema: 'escuro' })).toBe(true)
    expect(temaEscuroEfetivo({ tema: 'claro' })).toBe(false)
    // sem window.matchMedia no ambiente node, 'auto' resolve para claro
    expect(temaEscuroEfetivo({ tema: 'auto' })).toBe(false)
    expect(temaEscuroEfetivo(null)).toBe(false)
  })
})
