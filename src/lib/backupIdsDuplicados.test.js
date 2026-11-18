// H3-AUDIT — S2: backup com ids duplicados DENTRO do arquivo colapsava em
// silêncio no mesclarBackup (Object.fromEntries; o primeiro sumia). Decisão do
// Marco (opção 1): recusar o arquivo inteiro, nomeando os repetidos — mas SÓ a
// duplicidade intra-arquivo. Colisão backup×store é o re-import normal (atualizar
// um evento) e tem de continuar funcionando.
import { describe, it, expect } from 'vitest'
import { parseBackup, mesclarBackup } from './storage.js'
import { novoEvento } from './defaults.js'

const ev = (id, nome) => ({ ...novoEvento(nome), id })
const backupJSON = (eventos) => JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos })
const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  ajustes: {},
})

describe('backup com ids duplicados no arquivo — recusa nomeando (H3-AUDIT S2)', () => {
  it('(a) dois eventos com o MESMO id no arquivo → parseBackup RECUSA, nomeando id e eventos', () => {
    const texto = backupJSON([ev('DUP', 'Festa A'), ev('DUP', 'Festa B')])
    expect(() => parseBackup(texto)).toThrow()
    let msg = ''
    try {
      parseBackup(texto)
    } catch (e) {
      msg = e.message
    }
    expect(msg).toContain('DUP') // nomeia o id repetido
    expect(msg).toContain('Festa A') // e os dois eventos
    expect(msg).toContain('Festa B')
    expect(msg).toMatch(/[Nn]ada foi importado/) // nada entra pela metade
  })

  it('(b) id do backup que TAMBÉM existe no store NÃO é recusado: re-import atualiza como hoje', () => {
    // ids únicos DENTRO do arquivo → parseBackup passa
    const backup = parseBackup(backupJSON([ev('mesmo-id', 'Versão NOVA')]))
    const store = { ...storeVazio(), eventos: [ev('mesmo-id', 'Versão antiga')] }
    const merged = mesclarBackup(store, backup)
    expect(merged.eventos).toHaveLength(1) // atualizou, não duplicou
    expect(merged.eventos[0].nome).toBe('Versão NOVA') // o backup vence no id (update normal)
  })

  it('(c) backup normal (ids únicos) → importa sem reclamar', () => {
    const backup = parseBackup(backupJSON([ev('a', 'Festa 1'), ev('b', 'Festa 2')]))
    const merged = mesclarBackup(storeVazio(), backup)
    expect(merged.eventos.map((e) => e.nome).sort()).toEqual(['Festa 1', 'Festa 2'])
  })

  it('(a2) três eventos, um par repetido no meio → recusa e nomeia SÓ o par', () => {
    const texto = backupJSON([ev('x', 'Único'), ev('y', 'Repetido 1'), ev('y', 'Repetido 2')])
    let msg = ''
    try {
      parseBackup(texto)
    } catch (e) {
      msg = e.message
    }
    expect(msg).toContain('y')
    expect(msg).toContain('Repetido 1')
    expect(msg).toContain('Repetido 2')
    expect(msg).not.toContain('Único') // o id que não repete não é citado
  })
})
