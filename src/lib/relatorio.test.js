import { describe, it, expect } from 'vitest'
import { nomeArquivoPdf } from './relatorio.js'

describe('nomeArquivoPdf (sugestão 41): nome sugerido do PDF', () => {
  it('nome + data (DD-MM-AAAA com hífen) + "plano"', () => {
    expect(nomeArquivoPdf({ nome: 'Brisa #3', data: '2026-08-22' })).toBe(
      'Brisa #3 — 22-08-2026 — plano'
    )
  })

  it('sem data válida, sai só o nome + "plano"', () => {
    expect(nomeArquivoPdf({ nome: 'Brisa #3', data: '' })).toBe('Brisa #3 — plano')
    expect(nomeArquivoPdf({ nome: 'Brisa #3' })).toBe('Brisa #3 — plano')
    expect(nomeArquivoPdf({ nome: 'Brisa #3', data: '2026-08' })).toBe('Brisa #3 — plano')
  })

  it('nome vazio/ausente vira "plano"', () => {
    expect(nomeArquivoPdf({ nome: '   ', data: '2026-08-22' })).toBe('22-08-2026 — plano')
    expect(nomeArquivoPdf({})).toBe('plano')
    expect(nomeArquivoPdf(null)).toBe('plano')
  })

  it('tira caracteres inválidos de nome de arquivo (barra, dois-pontos etc.)', () => {
    expect(nomeArquivoPdf({ nome: 'Festa 01/02: Especial', data: '2026-08-22' })).toBe(
      'Festa 01-02- Especial — 22-08-2026 — plano'
    )
  })
})
