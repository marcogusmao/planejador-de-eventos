import { describe, expect, it } from 'vitest'
import { carimboItem } from './financeiro.js'
import { parseBackup, montarBackup } from './storage.js'
import { censoNormalizacoes } from './migracao.js'

describe('carimbo de origem inválida continua legível após importar', () => {
  it.each([
    { versao: 2, valor: 100, em: { toString: 0 }, origens: [] },
    { versao: 99, valor: 100, em: '2026-10-05T12:00:00Z', origens: [] },
    false,
    0,
  ])('preserva o bruto e mostra aviso, sem formatar metadado inválido: %j', bruto => {
    const evento = { id: 'festa-carimbo', nome: 'Festa sintética', categorias: [
      { id: 'equipe', nome: 'Equipe', itens: [
        { id: 'equipe-1', servico: 'Equipe', estimado: 100, realizado: 100, viaFinanceiro: bruto },
      ] },
    ] }
    const backup = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [evento] }))
    const item = backup.eventos[0].categorias[0].itens[0]
    expect(censoNormalizacoes(backup.eventosCrus).some(c => c.campo === 'viaFinanceiro')).toBe(true)
    expect(() => carimboItem(item)).not.toThrow()
    expect(carimboItem(item)).toMatchObject({ manual: true, texto: expect.stringMatching(/inválido.*preservado/) })
    expect(item.viaFinanceiro).toEqual(bruto)
    expect(montarBackup({ eventos: backup.eventos }).eventos[0].categorias[0].itens[0].viaFinanceiro).toEqual(bruto)
  })
})
