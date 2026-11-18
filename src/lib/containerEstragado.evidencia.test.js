// CONTAINER DE TIPO ERRADO — o vetor do evento que veio no lugar da LISTA.
// Decisão do Marco, 26/07/2026 (questionário): "as duas coisas — recusar na
// porta E rede na tela". Este arquivo é a metade da PORTA.
//
// A régua de 25/07/2026 (reguaBackup.evidencia.test.js) fechou o lixo DENTRO
// das listas: `lotes: [null]`, `categorias: [null]`, `patrocinios: [null]`,
// `categorias[].itens: [null]`. Todas aquelas travas começam com
// `if (!Array.isArray(evento.lotes)) continue` — então o caso em que a LISTA
// INTEIRA não é lista passava reto:
//
//     "lotes": {"a": 1}          → parseBackup devolvia OK
//     "categorias": {"a": 1}     → parseBackup devolvia OK
//     "patrocinios": {"a": 1}    → parseBackup devolvia OK
//     "categorias[].itens": {}   → parseBackup devolvia OK
//
// O QUE FOI MEDIDO ANTES DA TRAVA (node, sobre este mesmo parseBackup):
//   • `lotes` como conjunto      → computeCenarios estoura
//     "object is not iterable (cannot read property Symbol(Symbol.iterator))"
//   • `categorias` como conjunto → "(categorias || []).map is not a function"
//   • `itens` como conjunto      → "itens.reduce is not a function"
//   • `patrocinios` como conjunto → NÃO estoura, e é PIOR: a mesma festa que
//     mostra lucro de R$ 26.850 (bilheteria de 200 × R$ 100, patrocínio de
//     R$ 15.000, custo de R$ 5.000, premissas padrão) passa a mostrar
//     R$ 11.850 — exatamente R$ 15.000 a menos, o patrocínio inteiro somindo
//     sem uma linha de aviso, porque a migração só lê `patrocinios` quando é
//     lista e cai no caminho antigo (`outrasReceitas.patrocinio`, vazio)
//     quando não é. Número errado mostrado como certo: S1.
//
// O FALSO POSITIVO QUE NÃO PODE ACONTECER (medido também): ausente e `null`
// nesses quatro lugares FUNCIONAM hoje — `(lotes || []).map` trata os dois
// como lista vazia e a festa fecha em R$ 0 sem estourar. Backup antigo é
// exatamente isso (as chaves nem existiam). Logo a trava recusa só o que
// QUEBRA ou MENTE: valor que não é lista e não é vazio.
import { describe, it, expect } from 'vitest'
import { parseBackup, montarBackup, APP_ID, VERSAO_BACKUP } from './storage.js'
import { computeCenarios } from './calc.js'
import { novoEvento } from './defaults.js'

// Festa sintética com números redondos. Nenhum dado real do Marco em teste.
function festaDeTeste(patch = {}) {
  return {
    ...novoEvento('Teste do Container Estragado'),
    id: 'evento-container-1',
    nome: 'Brisa 05/12 (teste)',
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 200 }],
    patrocinios: [
      { id: 'patro-1', patrocinador: 'Marca A', valor: 15000, estagio: 'confirmado' },
    ],
    categorias: [
      {
        nome: 'Produção',
        itens: [{ id: 'custo-1', servico: 'Som', estimado: 5000, status: 'ESTIMADO' }],
      },
    ],
    ...patch,
  }
}

const arquivoDeBackup = (eventos, extra = {}) =>
  JSON.stringify({
    app: APP_ID,
    versao: VERSAO_BACKUP,
    exportadoEm: '2026-07-26T03:00:00.000Z',
    eventos,
    ...extra,
  })

// Os quatro lugares onde o app espera uma LISTA dentro de um evento, e o
// nome que a mensagem tem de dizer ao Marco.
const VETORES = [
  ['lotes', (v) => festaDeTeste({ lotes: v })],
  ['categorias', (v) => festaDeTeste({ categorias: v })],
  ['patrocinios', (v) => festaDeTeste({ patrocinios: v })],
]

// Valores que NÃO são lista e NÃO são vazio — os que quebram ou mentem.
const ESTRAGADOS = [
  ['um conjunto de chaves e valores', { a: 1 }],
  ['um texto', 'x'],
  ['um número', 7],
]

describe('container de tipo errado no lugar da lista → RECUSA na porta, nomeando festa e campo', () => {
  for (const [campo, montar] of VETORES) {
    for (const [rotulo, valor] of ESTRAGADOS) {
      it(`"${campo}" como ${rotulo} é recusado com mensagem em português`, () => {
        const texto = arquivoDeBackup([montar(valor)])
        let erro = null
        try {
          parseBackup(texto)
        } catch (e) {
          erro = e
        }
        expect(erro, `parseBackup ACEITOU "${campo}" como ${rotulo}`).toBeTruthy()
        // A mensagem nomeia a FESTA e o CAMPO — sem isso o Marco não sabe
        // onde consertar (princípio 4).
        expect(erro.message).toContain('Brisa 05/12 (teste)')
        expect(erro.message).toContain(campo)
        expect(erro.message).toContain('nada foi importado')
      })
    }
  }

  it('"categorias[].itens" como conjunto é recusado nomeando a categoria', () => {
    const texto = arquivoDeBackup([
      festaDeTeste({ categorias: [{ nome: 'Bar & Bebidas', itens: { a: 1 } }] }),
    ])
    let erro = null
    try {
      parseBackup(texto)
    } catch (e) {
      erro = e
    }
    expect(erro, 'parseBackup ACEITOU "itens" como conjunto').toBeTruthy()
    expect(erro.message).toContain('Brisa 05/12 (teste)')
    expect(erro.message).toContain('Bar & Bebidas')
    expect(erro.message).toContain('itens')
    expect(erro.message).toContain('nada foi importado')
  })

  it('a recusa acontece ANTES de qualquer conta — os R$ 15.000 que sumiam não são mais mostrados a menos', () => {
    // Prova a razão de ser da trava do `patrocinios`: sem ela o arquivo entra
    // e a festa mostra R$ 11.850 no lugar de R$ 26.850.
    const bom = parseBackup(arquivoDeBackup([festaDeTeste()]))
    expect(computeCenarios(bom.eventos[0]).realista.lucro).toBe(26850)
    expect(() =>
      parseBackup(arquivoDeBackup([festaDeTeste({ patrocinios: { a: 1 } })]))
    ).toThrow(/patrocinios/)
  })
})

describe('NADA DE FALSO POSITIVO — o que já funcionava continua entrando', () => {
  it('backup legítimo desta casa importa e mantém o lucro de R$ 26.850', () => {
    const lido = parseBackup(arquivoDeBackup([festaDeTeste()]))
    expect(lido.eventos).toHaveLength(1)
    expect(computeCenarios(lido.eventos[0]).realista.lucro).toBe(26850)
  })

  it('backup ANTIGO (sem as três listas e sem identidade) continua entrando, com a marca de formato antigo', () => {
    const antigo = JSON.stringify({
      eventos: [{ id: 'ev-antigo', nome: 'Marfim 09/05', data: '2026-05-09' }],
    })
    const lido = parseBackup(antigo)
    expect(lido.formatoAntigo).toBe(true)
    expect(lido.eventos).toHaveLength(1)
    expect(computeCenarios(lido.eventos[0]).realista.lucro).toBe(0)
  })

  it('as três listas VAZIAS entram (é o estado de uma festa nova)', () => {
    const lido = parseBackup(
      arquivoDeBackup([festaDeTeste({ lotes: [], categorias: [], patrocinios: [] })])
    )
    expect(lido.eventos).toHaveLength(1)
  })

  it('`null` e ausente nos quatro lugares continuam entrando — o app já os trata como lista vazia', () => {
    for (const patch of [
      { lotes: null },
      { categorias: null },
      { patrocinios: null },
      { categorias: [{ nome: 'Produção', itens: null }] },
      { lotes: undefined, categorias: undefined, patrocinios: undefined },
    ]) {
      const texto = arquivoDeBackup([festaDeTeste(patch)])
      expect(() => parseBackup(texto), `recusou ${JSON.stringify(patch)}`).not.toThrow()
      const lido = parseBackup(texto)
      // e a conta roda sem estourar
      expect(() => computeCenarios(lido.eventos[0])).not.toThrow()
    }
  })

  it('round-trip montarBackup → parseBackup do store real continua passando', () => {
    const store = {
      eventos: [festaDeTeste(), { ...festaDeTeste(), id: 'evento-container-2', nome: 'Sobrado' }],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksPadrao: {},
      benchmarksOcultos: [],
      benchmarksApagados: [],
      ajustes: {},
    }
    const texto = JSON.stringify(montarBackup(store))
    const lido = parseBackup(texto)
    expect(lido.eventos).toHaveLength(2)
    expect(computeCenarios(lido.eventos[0]).realista.lucro).toBe(26850)
  })
})
