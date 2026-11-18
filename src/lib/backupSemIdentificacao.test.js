// FESTA SEM IDENTIFICAÇÃO NO BACKUP — decisão do Marco, 26/07/2026
// (questionário): a festa que chega sem `id` RECEBE UMA na hora e entra. Ele
// escolheu isto contra a recomendação de recusar o arquivo, sabendo do risco
// que está medido no último bloco deste arquivo.
//
// O DEFEITO MEDIDO, antes desta trava (receita reproduzida em
// `medir-defeito.mjs`, sessão de 26/07/2026): backup com 3 festas sem a chave
// `id` — Brisa 05/12 (bilheteria bruta realista R$ 63.000), Marfim Alto
// 09/05 (R$ 54.000) e O Galeao 14/03 (R$ 32.400), R$ 149.400 no arquivo.
//   • `parseBackup` NÃO recusava e devolvia os 3;
//   • `mesclarBackup` monta o índice por id com `Object.fromEntries`, e três
//     ids `undefined` colapsam em UMA chave só — ficava 1 festa, R$ 32.400;
//   • R$ 117.000 de bilheteria bruta sumiam CALADOS (Brisa + Marfim), e a
//     tela anunciava "Backup importado: 3 evento(s)" porque lia o tamanho do
//     ARQUIVO, não o que entrou.
// O mesmo colapso valia para `id: null`, `id: {}` e `id: []` (todos viram a
// mesma chave de texto), e para a MISTURA (1 festa com id + 2 sem: entravam 2
// de 3).
import { describe, it, expect } from 'vitest'
import {
  parseBackup,
  mesclarBackup,
  censoImportacao,
  textoImportacaoFeita,
  APP_ID,
  VERSAO_BACKUP,
} from './storage.js'
import { computeCenario } from './calc.js'
import { novoEvento } from './defaults.js'

// Festas sintéticas com bilheteria BRUTA realista redonda (o cenário realista
// é 90% do lote): 700 × R$ 100 = R$ 63.000, 600 × R$ 100 = R$ 54.000,
// 360 × R$ 100 = R$ 32.400. Nenhum dado real do Marco entra em teste.
function festa(nome, quantidade, idPatch) {
  const e = {
    ...novoEvento(nome),
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade }],
  }
  delete e.id // o arquivo NÃO traz a chave
  if (idPatch !== undefined) e.id = idPatch.id
  return e
}

const BRISA = () => festa('Brisa 05/12', 700)
const MARFIM = () => festa('Marfim Alto 09/05', 600)
const GALEAO = () => festa('O Galeao 14/03', 360)

const arquivo = (eventos, extra = {}) =>
  JSON.stringify({
    app: APP_ID,
    versao: VERSAO_BACKUP,
    exportadoEm: '2026-07-26T03:00:00.000Z',
    eventos,
    ...extra,
  })

const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  ajustes: {},
})

const bruta = (e) => computeCenario(e, 'realista').bruta
const totalBruta = (eventos) => eventos.reduce((s, e) => s + bruta(e), 0)

describe('backup sem identificação — caso 1: a chave `id` NÃO existe no arquivo', () => {
  const texto = () => arquivo([BRISA(), MARFIM(), GALEAO()])

  it('as 3 festas entram — nenhuma some no índice por id', () => {
    const merged = mesclarBackup(storeVazio(), parseBackup(texto()))
    expect(merged.eventos).toHaveLength(3)
    expect(merged.eventos.map((e) => e.nome).sort()).toEqual([
      'Brisa 05/12',
      'Marfim Alto 09/05',
      'O Galeao 14/03',
    ])
  })

  it('os R$ 149.400 de bilheteria bruta chegam inteiros (antes chegavam R$ 32.400)', () => {
    const merged = mesclarBackup(storeVazio(), parseBackup(texto()))
    expect(totalBruta(merged.eventos)).toBe(149400)
  })

  it('cada festa fica com identificação PRÓPRIA, em texto, e as três diferentes', () => {
    const merged = mesclarBackup(storeVazio(), parseBackup(texto()))
    const ids = merged.eventos.map((e) => e.id)
    for (const id of ids) {
      expect(typeof id).toBe('string')
      expect(id.trim()).not.toBe('')
    }
    expect(new Set(ids).size).toBe(3)
  })

  it('o parse DIZ quais festas ganharam identificação, pelo nome', () => {
    const backup = parseBackup(texto())
    expect(backup.eventosSemIdentificacao).toEqual([
      'Brisa 05/12',
      'Marfim Alto 09/05',
      'O Galeao 14/03',
    ])
  })
})

describe('backup sem identificação — caso 2: `id: null` explícito', () => {
  it('as duas festas com id nulo entram, com identificação nova e diferente', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: null }), festa('Marfim Alto 09/05', 600, { id: null })]))
    const merged = mesclarBackup(storeVazio(), backup)
    expect(merged.eventos).toHaveLength(2)
    expect(totalBruta(merged.eventos)).toBe(117000)
    expect(new Set(merged.eventos.map((e) => e.id)).size).toBe(2)
    expect(backup.eventosSemIdentificacao).toEqual(['Brisa 05/12', 'Marfim Alto 09/05'])
  })
})

describe('backup sem identificação — caso 3: `id` que não identifica ninguém (objeto, lista, texto vazio)', () => {
  // `{}` e `[]` viram a MESMA chave de texto no índice por id
  // ("[object Object]" e ""), então duas festas colapsavam em uma; e um id em
  // objeto nunca serve para achar a festa depois.
  it('`id: {}` nas duas festas: as duas entram, com identificação em texto', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: {} }), festa('Marfim Alto 09/05', 600, { id: {} })]))
    const merged = mesclarBackup(storeVazio(), backup)
    expect(merged.eventos).toHaveLength(2)
    expect(totalBruta(merged.eventos)).toBe(117000)
    for (const e of merged.eventos) expect(typeof e.id).toBe('string')
    expect(new Set(merged.eventos.map((e) => e.id)).size).toBe(2)
  })

  it('`id: []` e `id: ""` também recebem identificação — nenhuma festa se sobrepõe à outra', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: [] }), festa('Marfim Alto 09/05', 600, { id: '' })]))
    const merged = mesclarBackup(storeVazio(), backup)
    expect(merged.eventos).toHaveLength(2)
    expect(totalBruta(merged.eventos)).toBe(117000)
    expect(new Set(merged.eventos.map((e) => e.id)).size).toBe(2)
  })
})

describe('backup sem identificação — caso 4: MISTURA (uma festa com id, duas sem)', () => {
  const texto = () =>
    arquivo([festa('Brisa 05/12', 700, { id: 'ev-brisa' }), MARFIM(), GALEAO()])

  it('as 3 entram, e o id que o arquivo trazia é PRESERVADO', () => {
    const merged = mesclarBackup(storeVazio(), parseBackup(texto()))
    expect(merged.eventos).toHaveLength(3)
    expect(merged.eventos.find((e) => e.nome === 'Brisa 05/12').id).toBe('ev-brisa')
    expect(totalBruta(merged.eventos)).toBe(149400)
  })

  it('só as duas SEM identificação são listadas como tendo ganhado uma', () => {
    expect(parseBackup(texto()).eventosSemIdentificacao).toEqual([
      'Marfim Alto 09/05',
      'O Galeao 14/03',
    ])
  })

  it('a festa com id que JÁ existe no store continua ATUALIZANDO, não duplica', () => {
    const store = {
      ...storeVazio(),
      eventos: [{ ...novoEvento('Brisa 05/12 (versão antiga)'), id: 'ev-brisa' }],
    }
    const merged = mesclarBackup(store, parseBackup(texto()))
    expect(merged.eventos).toHaveLength(3) // 1 atualizada + 2 novas
    expect(merged.eventos.find((e) => e.id === 'ev-brisa').nome).toBe('Brisa 05/12')
  })
})

describe('o número anunciado é o que ENTROU, contado no resultado do merge', () => {
  it('3 festas sem id no arquivo → "3 festas entraram", 3 novas, 0 atualizadas', () => {
    const backup = parseBackup(arquivo([BRISA(), MARFIM(), GALEAO()]))
    const censo = censoImportacao(storeVazio(), backup)
    expect(censo.entraram).toBe(3)
    expect(censo.novas).toBe(3)
    expect(censo.atualizadas).toBe(0)
    expect(censo.naoEntraram).toEqual([])
    expect(censo.ganharamIdentificacao).toHaveLength(3)
  })

  it('festa do arquivo que já existe no store conta como ATUALIZADA, não como nova', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 'ev-brisa' }), MARFIM()]))
    const store = { ...storeVazio(), eventos: [{ ...novoEvento('antiga'), id: 'ev-brisa' }] }
    const censo = censoImportacao(store, backup)
    expect(censo.entraram).toBe(2)
    expect(censo.novas).toBe(1)
    expect(censo.atualizadas).toBe(1)
  })

  it('o texto do aviso diz quantas entraram, quantas ganharam identificação, e que reimportar repete', () => {
    const backup = parseBackup(arquivo([BRISA(), MARFIM(), GALEAO()]))
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), backup), {})
    expect(t).toContain('3 festas entraram')
    expect(t).toContain('3 delas não tinham identificação')
    expect(t).toContain('Brisa 05/12')
    expect(t).toMatch(/importar .*ESTE MESMO arquivo/i)
    expect(t).toContain('Proteção de dados')
    // não pode anunciar benchmark que não existe no arquivo
    expect(t).not.toMatch(/benchmark/i)
  })

  it('arquivo com TODAS as festas identificadas: o aviso NÃO fala de identificação nova', () => {
    const backup = parseBackup(
      arquivo([festa('Brisa 05/12', 700, { id: 'a' }), festa('Marfim Alto 09/05', 600, { id: 'b' })])
    )
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), backup), {})
    expect(t).toContain('2 festas entraram')
    expect(t).not.toMatch(/identificação/i)
    expect(t).not.toMatch(/ESTE MESMO arquivo/i)
  })

  it('uma festa só: o aviso fala no singular', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 'a' })]))
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), backup), {})
    expect(t).toContain('1 festa entrou')
  })

  it('uma festa só, e ela sem identificação: concordância no singular, sem "1 dela"', () => {
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), parseBackup(arquivo([BRISA()]))), {})
    expect(t).toContain('1 festa entrou')
    expect(t).toContain('Ela não tinha identificação no arquivo (Brisa 05/12) e recebeu uma agora')
    expect(t).toContain('essa festa entra de novo')
    expect(t).not.toContain('1 dela')
  })

  it('duas festas, só uma sem identificação: "1 delas não tinha", no singular', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 'a' }), MARFIM()]))
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), backup), {})
    expect(t).toContain('2 festas entraram')
    expect(t).toContain('1 delas não tinha identificação no arquivo (Marfim Alto 09/05)')
  })

  it('o aviso menciona benchmark e Ajustes SÓ quando o arquivo os trouxe', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 'a' })]))
    const censo = censoImportacao(storeVazio(), backup)
    const semNada = textoImportacaoFeita(censo, { benchmarks: 0, ajustes: false })
    expect(semNada).not.toMatch(/benchmark/i)
    expect(semNada).not.toMatch(/Ajustes/)
    const comTudo = textoImportacaoFeita(censo, { benchmarks: 2, ajustes: true })
    expect(comTudo).toContain('2 benchmarks de comparação também entrou')
    expect(comTudo).toContain('Os Ajustes (premissas por festa) do arquivo substituíram os atuais.')
  })

  it('festa que NÃO aterrissou é denunciada pelo nome — o aviso nunca infla o número', () => {
    // Rede de honestidade, num buraco que ainda EXISTE e é de outra sessão
    // (não desta): `id: 7` (número) e `id: "7"` (texto) são ids DIFERENTES para
    // a trava de repetido, mas viram a MESMA chave no índice por id do
    // mesclarBackup — uma festa se sobrepõe à outra. Este censo não conserta
    // isso; ele impede que a tela ANUNCIE 2 quando entrou 1.
    const backup = parseBackup(
      arquivo([festa('Brisa 05/12', 700, { id: 7 }), festa('Marfim Alto 09/05', 600, { id: '7' })])
    )
    expect(backup.eventos).toHaveLength(2) // o arquivo passou pela régua
    const censo = censoImportacao(storeVazio(), backup)
    expect(censo.entraram).toBe(1) // não 2 — só uma aterrissou
    expect(censo.naoEntraram).toEqual(['Brisa 05/12'])
    const t = textoImportacaoFeita(censo, {})
    expect(t).toContain('1 festa entrou')
    expect(t).toContain('NÃO entrou')
    expect(t).toContain('Brisa 05/12')
  })
})

describe('nada de falso positivo: backup normal segue igual (princípio 2 — contrato)', () => {
  it('festa com id de TEXTO não é tocada, e o censo não acusa nada', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 'ev-brisa' })]))
    expect(backup.eventos[0].id).toBe('ev-brisa')
    expect(backup.eventosSemIdentificacao).toEqual([])
  })

  it('festa com id NUMÉRICO legado (id: 7) não é tocada — id legado é identificação válida', () => {
    const backup = parseBackup(arquivo([festa('Brisa 05/12', 700, { id: 7 })]))
    expect(backup.eventos[0].id).toBe(7)
    expect(backup.eventosSemIdentificacao).toEqual([])
  })

  it('ids repetidos DENTRO do arquivo continuam recusados, nomeando o repetido', () => {
    const texto = arquivo([festa('Festa A', 700, { id: 'DUP' }), festa('Festa B', 600, { id: 'DUP' })])
    expect(() => parseBackup(texto)).toThrow(/DUP/)
    expect(() => parseBackup(texto)).toThrow(/[Nn]ada foi importado/)
  })

  it('re-importar o MESMO arquivo de festas identificadas continua atualizando, sem duplicar', () => {
    const texto = arquivo([festa('Brisa 05/12', 700, { id: 'ev-brisa' })])
    const um = mesclarBackup(storeVazio(), parseBackup(texto))
    const dois = mesclarBackup(um, parseBackup(texto))
    expect(dois.eventos).toHaveLength(1)
    expect(totalBruta(dois.eventos)).toBe(63000)
  })
})

describe('O RISCO QUE O MARCO ACEITOU, medido: reimportar o mesmo arquivo DUPLICA as festas', () => {
  // Isto NÃO é bug — é a consequência da decisão dele de 26/07/2026, medida e
  // registrada aqui para que ninguém a "conserte" sem falar com ele. A
  // identificação nasce nova a cada importação, então o merge por id não tem
  // como reconhecer que é a mesma festa. A rede escolhida é o AVISO na tela,
  // não uma recusa.
  it('mesmo arquivo 2× → 6 festas na lista e R$ 149.400 duplicados (R$ 298.800 no total)', () => {
    const texto = arquivo([BRISA(), MARFIM(), GALEAO()])
    const um = mesclarBackup(storeVazio(), parseBackup(texto))
    const dois = mesclarBackup(um, parseBackup(texto))
    expect(um.eventos).toHaveLength(3)
    expect(totalBruta(um.eventos)).toBe(149400)
    expect(dois.eventos).toHaveLength(6)
    expect(totalBruta(dois.eventos)).toBe(298800)
  })

  it('o aviso da 1ª importação JÁ diz que reimportar o arquivo traz as festas outra vez', () => {
    const backup = parseBackup(arquivo([BRISA(), MARFIM(), GALEAO()]))
    const t = textoImportacaoFeita(censoImportacao(storeVazio(), backup), {})
    expect(t).toMatch(/entram de novo|outra vez/i)
  })
})
