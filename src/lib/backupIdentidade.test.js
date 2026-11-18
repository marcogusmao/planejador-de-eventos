// Item E2 do plano de correção (22/07/2026) — identidade + versão no envelope
// do backup, com recusa HONESTA no import. Fecha o caso (3) do item de BACKLOG
// "Backup adulterado/hostil aceito em silêncio": a `versao` do backup NUNCA era
// conferida — um arquivo "versão 999" ou de OUTRO app entrava como se fosse
// desta app, em silêncio. (Os casos (1) evento-lixo e (2) ids duplicados já
// eram recusados nomeando — backupIdsDuplicados.test.js + storage.js; não se
// repetem aqui.)
//
// Contrato da casa (princípio 2 — o formato do backup é CONTRATO): backup
// ANTIGO, gravado ANTES do carimbo de identidade (commit 2e96d68, 17/07),
// TEM de continuar importando. A novidade é só que ele importa MARCADO como
// formato antigo, para a tela avisar (princípio 4 — nada em silêncio), nunca
// recusado.
import { describe, it, expect } from 'vitest'
import { parseBackup, montarBackup, mesclarBackup } from './storage.js'
import { migrarEventos } from './migracao.js'
import { novoEvento } from './defaults.js'

const ev = (id, nome) => ({ ...novoEvento(nome), id })
// Eventos já na forma que o store guarda de verdade (migrados) e JSON-limpos
// (é isso que vai para o localStorage / arquivo), para o round-trip comparar
// dado com dado sem ruído de campos `undefined`.
const eventosLimpos = (...pares) =>
  JSON.parse(JSON.stringify(migrarEventos(pares.map(([id, nome]) => ev(id, nome)))))

const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: {},
})

const erroDe = (fn) => {
  try {
    fn()
    return ''
  } catch (e) {
    return e.message
  }
}

describe('backup: identidade + versão conferidas no import (E2 — plano 22/07/2026)', () => {
  // ————————— (b) versão MAIOR que a atual → recusa honesta —————————

  it('(b) backup de versão FUTURA (999) é RECUSADO nomeando a versão — nada importa', () => {
    const texto = JSON.stringify({
      app: 'previsao-eventos',
      versao: 999,
      eventos: [ev('a', 'Festa')],
    })
    expect(() => parseBackup(texto)).toThrow()
    const msg = erroDe(() => parseBackup(texto))
    expect(msg).toContain('999') // nomeia a versão do arquivo
    expect(msg).toMatch(/vers[aã]o mais nova/i) // explica o porquê, em português
    expect(msg).toMatch(/[Nn]ada foi importado/) // nada entra pela metade
  })

  it('(b2) versão futura como STRING "999" (backup editado à mão) também é recusada', () => {
    const texto = JSON.stringify({ app: 'previsao-eventos', versao: '999', eventos: [] })
    expect(() => parseBackup(texto)).toThrow(/999/)
  })

  it('(b3) versão IGUAL à atual passa (não é futura) e não é marcada como antiga', () => {
    const bk = montarBackup(storeVazio())
    const texto = JSON.stringify({ ...bk, eventos: [ev('a', 'Festa')] })
    expect(() => parseBackup(texto)).not.toThrow()
    expect(parseBackup(texto).formatoAntigo).toBe(false)
  })

  // ————————————— (c) app DIFERENTE → recusa nomeando —————————————

  it('(c) arquivo de OUTRO app é RECUSADO, nomeando o app do arquivo — nada importa', () => {
    const texto = JSON.stringify({
      app: 'financeiro-marfim',
      versao: 1,
      eventos: [ev('a', 'X')],
    })
    const msg = erroDe(() => parseBackup(texto))
    expect(msg).toContain('financeiro-marfim') // nomeia o app errado
    expect(msg).toContain('Planejamento de Eventos') // e diz qual é o certo
    expect(msg).toMatch(/[Nn]ada foi importado/)
  })

  // ————————————— (d) SEM identidade → importa COM aviso —————————————

  it('(d) backup ANTIGO (sem app/versao) IMPORTA, marcado formatoAntigo=true — aviso, nunca silêncio', () => {
    const texto = JSON.stringify({
      eventos: [ev('a', 'Festa antiga')],
      benchmarksCustom: [],
    })
    const backup = parseBackup(texto)
    expect(backup.formatoAntigo).toBe(true) // a tela avisa antes de aplicar
    expect(backup.eventos).toHaveLength(1) // mas os dados entram
    expect(backup.eventos[0].nome).toBe('Festa antiga')
    // e mescla como qualquer backup
    const merged = mesclarBackup(storeVazio(), backup)
    expect(merged.eventos.map((e) => e.nome)).toEqual(['Festa antiga'])
  })

  it('(d2) fixture de backup ANTIGO REAL (formato pré-17/07: sem app, sem versao) importa ao vivo', () => {
    // Montado à mão no formato que o app gravava ANTES do carimbo de identidade
    // (commit 2e96d68, 17/07): sem `app`, sem `versao`, com a forma de store.
    const backupAntigo = {
      exportadoEm: '2026-07-15T12:00:00.000Z',
      eventos: [
        {
          id: 'ev1',
          nome: 'Cordel 2024',
          publicoEstimado: 300,
          taxaBilheteria: 10,
          lotes: [{ nome: '1º lote', valor: 100, quantidade: 200 }],
          categorias: [],
        },
      ],
      benchmarksCustom: [],
      benchmarkOverrides: {},
    }
    const backup = parseBackup(JSON.stringify(backupAntigo))
    expect(backup.formatoAntigo).toBe(true)
    expect(backup.eventos[0].nome).toBe('Cordel 2024')
    // a migração normalizou os campos novos SEM tocar os antigos (princípio 2)
    expect(backup.eventos[0].publicoEstimado).toBe(300)
    expect(backup.eventos[0].lotes[0].valor).toBe(100)
    expect(backup.eventos[0].lotes[0].quantidade).toBe(200)
    // backup antigo sem a chave não zera listas atuais (regra já existente)
    expect(backup.benchmarksOcultos).toBe(null)
    expect(backup.ajustes).toBe(null)
  })

  // ———————— (a) backup NOVO: exporta com identidade e reimporta limpo ————————

  it('(a) backup NOVO exporta com app+versao e REIMPORTA limpo (round-trip byte-fiel nos dados)', () => {
    const eventos = eventosLimpos(['a', 'Festa 1'], ['b', 'Festa 2'])
    const store = { ...storeVazio(), eventos }
    const arquivo = JSON.stringify(montarBackup(store), null, 2)

    // o envelope carrega a identidade
    const cru = JSON.parse(arquivo)
    expect(cru.app).toBe('previsao-eventos')
    expect(cru.versao).toBe(1)

    // reimporta sem reclamar e SEM marca de formato antigo
    const backup = parseBackup(arquivo)
    expect(backup.formatoAntigo).toBe(false)
    // dado com dado, byte a byte: os eventos voltam idênticos (migração idempotente)
    expect(backup.eventos).toEqual(eventos)
  })

  it('(a2) backup NOVO com app certo e versao 1 não é confundido com formato antigo', () => {
    const texto = JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [] })
    expect(parseBackup(texto).formatoAntigo).toBe(false)
  })
})
