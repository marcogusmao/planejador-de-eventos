// EVIDÊNCIA — o CONTRATO do que está salvo, depois do campo novo do benchmark.
//
// Decisão 6 do Marco (DECISOES-MARCO-H4.md, 25/07/2026): guardar a bilheteria
// BRUTA nos benchmarks novos, campo opcional e aditivo, "com migração que
// preenche vazio e não inventa valor". O princípio 2 do rulebook cobra a prova
// que este arquivo entrega: mudou o formato do que está salvo, então um backup
// JSON ANTIGO tem de importar sem perder nada — provado antes de entrar.
//
// AS QUATRO AFIRMAÇÕES QUE ESTE ARQUIVO TRAVA:
//
//   1. Um backup gravado ANTES desta mudança importa e volta a sair idêntico,
//      campo por campo, e nenhum benchmark dele ganha uma chave que não tinha.
//   2. A migração devolve o MESMO OBJETO quando não há o que fazer — é a
//      restrição datada de 20/07/2026 ("não mude benchmarks antigos já
//      lançados"), que morreria calada com um `{ ...bm, bilheteriaBruta: null }`.
//   3. Um backup gravado DEPOIS desta mudança abre numa versão do app que não
//      conhece o campo: o envelope não mudou de versão, e o campo desconhecido
//      atravessa sem destruir nada.
//   4. Vazio e ZERO continuam distinguíveis do começo ao fim do round-trip.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStore,
  saveStore,
  montarBackup,
  parseBackup,
  mesclarBackup,
  VERSAO_BACKUP,
  APP_ID,
} from './storage.js'
import { migrarBenchmark, migrarBenchmarks } from './migracao.js'
import {
  benchmarksDisponiveis,
  restaurarBenchmarkFabrica,
  aplicarOverride,
  montarBenchmarkDePlanilha,
  FIXED_BENCHMARKS,
} from './benchmarks.js'
import {
  reguaDoTicket,
  bilheteriaBrutaDe,
  REGUA_BILHETERIA,
  REGUA_RECEITA,
  REGUA_PAGANTES,
} from './reguaTicket.js'

function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    get length() {
      return mapa.size
    },
    key: (i) => [...mapa.keys()][i] ?? null,
  }
}

beforeEach(() => {
  globalThis.localStorage = localStorageDeMentira()
})

// ---------------------------------------------------------------------------
// O BACKUP ANTIGO — o arquivo do Marco de antes de 25/07/2026, na forma exata
// em que ele era gravado. Escrito como TEXTO JSON de propósito: é assim que o
// arquivo chega, e um objeto literal esconderia diferenças de serialização.
// Números sintéticos; nenhuma festa real.
// ---------------------------------------------------------------------------
const BACKUP_ANTIGO = JSON.stringify({
  app: 'previsao-eventos',
  versao: 1,
  exportadoEm: '2026-07-24T22:10:00.000Z',
  eventos: [
    { id: 'ev-1', nome: 'Festa da Alameda', data: '2026-06-14', categorias: [], lotes: [] },
  ],
  benchmarksCustom: [
    {
      id: 'bm-promovido-antigo',
      nome: 'Alameda Norte',
      custom: true,
      semReserva: true,
      publico: 500,
      custos: { aeb: 10000, locacao: 5000, estrutura: 20000, equipe: 15000, artistico: 8000, marketing: null, extras: null },
      custoTotal: 58000,
      receita: 100000,
      ticketMedio: 200,
      lucro: 42000,
      obs: 'Promovido do fechamento de "Alameda Norte" (14/06/2026).',
    },
    {
      id: 'bm-importado-antigo',
      nome: 'Alameda Sul (planilha)',
      custom: true,
      publico: 800,
      custos: { aeb: 20000, locacao: null, estrutura: 30000, equipe: null, artistico: null, marketing: null, extras: null },
      custoTotal: 50000,
      receita: 120000,
      ticketMedio: 160,
      lucro: 70000,
    },
  ],
  benchmarkOverrides: { 'bm-cordel': { publico: 420 } },
  benchmarksPadrao: {},
  benchmarksOcultos: ['bm-brisa-1205'],
  benchmarksApagados: [],
  ajustes: {},
})

const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: {},
})

// ===========================================================================
// 1. O CAMINHO DE VOLTA — backup antigo entra, sai idêntico
// ===========================================================================
describe('1. um backup JSON ANTIGO importa sem perder nada e sem ganhar nada', () => {
  const cru = JSON.parse(BACKUP_ANTIGO)

  it('importa sem erro e traz os dois benchmarks do arquivo', () => {
    const backup = parseBackup(BACKUP_ANTIGO)
    expect(backup.benchmarksCustom).toHaveLength(2)
    expect(backup.benchmarksCustom.map((b) => b.id)).toEqual([
      'bm-promovido-antigo',
      'bm-importado-antigo',
    ])
  })

  it('cada benchmark volta CAMPO POR CAMPO como estava no arquivo', () => {
    const backup = parseBackup(BACKUP_ANTIGO)
    expect(backup.benchmarksCustom).toEqual(cru.benchmarksCustom)
  })

  it('e nenhum deles ganhou uma chave nova — nem bilheteriaBruta, nem reguaTicket', () => {
    const backup = parseBackup(BACKUP_ANTIGO)
    backup.benchmarksCustom.forEach((b, i) => {
      expect(Object.keys(b).sort()).toEqual(Object.keys(cru.benchmarksCustom[i]).sort())
      expect('bilheteriaBruta' in b).toBe(false)
      expect('reguaTicket' in b).toBe(false)
    })
  })

  it('round-trip completo — importar e exportar de novo devolve o MESMO JSON de benchmarks', () => {
    const backup = parseBackup(BACKUP_ANTIGO)
    const store = mesclarBackup(storeVazio(), backup)
    const saido = montarBackup(store)
    expect(JSON.stringify(saido.benchmarksCustom)).toBe(JSON.stringify(cru.benchmarksCustom))
    // E o resto do envelope de benchmarks também volta inteiro.
    expect(saido.benchmarkOverrides).toEqual(cru.benchmarkOverrides)
    expect(saido.benchmarksOcultos).toEqual(cru.benchmarksOcultos)
  })

  it('pelo localStorage é a mesma história: gravar o antigo e ler devolve tudo igual', () => {
    const store = mesclarBackup(storeVazio(), parseBackup(BACKUP_ANTIGO))
    expect(saveStore(store).ok).toBe(true)
    const lido = loadStore()
    expect(lido.benchmarksCustom).toEqual(cru.benchmarksCustom)
    lido.benchmarksCustom.forEach((b, i) =>
      expect(Object.keys(b).sort()).toEqual(Object.keys(cru.benchmarksCustom[i]).sort())
    )
  })

  it('a régua de cada um é LIDA, não gravada: nada é escrito no dado do Marco', () => {
    const backup = parseBackup(BACKUP_ANTIGO)
    const [promovido, importado] = backup.benchmarksCustom
    // 100.000 ÷ 500 = 200 → a régua antiga, reconferida na aritmética.
    expect(reguaDoTicket(promovido)).toBe(REGUA_RECEITA)
    // 120.000 ÷ 800 = 150, mas o ticket salvo é 160 (dividido por PAGOS na
    // planilha) → nada fecha, e o app diz isso em vez de chutar.
    expect(reguaDoTicket(importado)).toBe('nao-registrada')
    // e nenhuma dessas leituras escreveu nada
    expect('reguaTicket' in promovido).toBe(false)
    expect('reguaTicket' in importado).toBe(false)
  })
})

// ===========================================================================
// 2. IDENTIDADE — a restrição datada de 20/07/2026 sobrevive
// ===========================================================================
describe('2. a migração devolve o MESMO OBJETO quando não há o que fazer', () => {
  const bmAntigo = JSON.parse(BACKUP_ANTIGO).benchmarksCustom[0]

  it('migrarBenchmark devolve a mesma referência, não uma cópia', () => {
    expect(migrarBenchmark(bmAntigo)).toBe(bmAntigo)
  })

  it('migrarBenchmarks devolve a MESMA LISTA quando nenhum item mudou', () => {
    const lista = [bmAntigo, { ...bmAntigo, id: 'outro' }]
    expect(migrarBenchmarks(lista)).toBe(lista)
  })

  it('benchmark COM o campo novo e já certo também passa por referência', () => {
    const novo = { ...bmAntigo, bilheteriaBruta: 75000 }
    expect(migrarBenchmark(novo)).toBe(novo)
  })

  it('as telas de leitura seguem devolvendo o objeto salvo, por identidade', () => {
    const store = { ...storeVazio(), benchmarksCustom: [bmAntigo] }
    const salvo = store.benchmarksCustom[0]
    expect(benchmarksDisponiveis(store).find((b) => b.id === salvo.id)).toBe(salvo)
  })

  it('migrar DUAS vezes é igual a migrar uma — e a segunda não inventa nada', () => {
    const uma = migrarBenchmarks(JSON.parse(BACKUP_ANTIGO).benchmarksCustom)
    const duas = migrarBenchmarks(uma)
    expect(duas).toBe(uma)
    expect(duas).toEqual(JSON.parse(BACKUP_ANTIGO).benchmarksCustom)
  })
})

// ===========================================================================
// 3. O BACKUP NOVO ABERTO POR UM APP QUE NÃO CONHECE O CAMPO
// ===========================================================================
describe('3. um backup gravado DEPOIS da mudança abre numa versão antiga do app', () => {
  const storeNovo = () => ({
    ...storeVazio(),
    benchmarksCustom: [
      {
        id: 'bm-novo',
        nome: 'Alameda Leste',
        custom: true,
        semReserva: true,
        publico: 500,
        custos: { aeb: 10000, locacao: null, estrutura: null, equipe: null, artistico: null, marketing: null, extras: null },
        custoTotal: 10000,
        receita: 100000,
        bilheteriaBruta: 75000,
        ticketMedio: 150,
        lucro: 90000,
        obs: 'Promovido do fechamento de "Alameda Leste" (25/07/2026).',
      },
    ],
  })

  it('o ENVELOPE não mudou de versão — o app antigo não recusa o arquivo', () => {
    // parseBackup do app antigo recusa `versao` MAIOR que a dele. Subir a
    // versão aqui transformaria todo backup novo em arquivo ilegível para
    // quem não atualizou; o campo é aditivo justamente para não precisar.
    const payload = montarBackup(storeNovo())
    expect(payload.versao).toBe(1)
    expect(VERSAO_BACKUP).toBe(1)
    expect(payload.app).toBe(APP_ID)
  })

  // A LEITURA DE BENCHMARKS DO APP ANTIGO, copiada da linha que existia em
  // storage.js antes desta mudança. Não é uma imitação livre: é aquela linha.
  const leitorAntigoDeBenchmarks = (d) =>
    Array.isArray(d.benchmarksCustom) ? d.benchmarksCustom : []

  it('o app antigo lê o arquivo inteiro sem quebrar e sem perder campo conhecido', () => {
    const arquivo = JSON.parse(JSON.stringify(montarBackup(storeNovo())))
    const lidos = leitorAntigoDeBenchmarks(arquivo)
    expect(lidos).toHaveLength(1)
    const b = lidos[0]
    expect(b.nome).toBe('Alameda Leste')
    expect(b.publico).toBe(500)
    expect(b.receita).toBe(100000)
    expect(b.ticketMedio).toBe(150)
    expect(b.custoTotal).toBe(10000)
  })

  it('e o campo que ele não conhece ATRAVESSA — reexportar pelo app antigo não o destrói', () => {
    const arquivo = JSON.parse(JSON.stringify(montarBackup(storeNovo())))
    const lidos = leitorAntigoDeBenchmarks(arquivo)
    expect(lidos[0].bilheteriaBruta).toBe(75000)
    const reexportado = montarBackup({ ...storeVazio(), benchmarksCustom: lidos })
    expect(reexportado.benchmarksCustom[0].bilheteriaBruta).toBe(75000)
  })

  it('ida e volta pelo app ATUAL preserva o campo e a régua que ele nomeia', () => {
    const backup = parseBackup(JSON.stringify(montarBackup(storeNovo())))
    const store = mesclarBackup(storeVazio(), backup)
    const b = store.benchmarksCustom[0]
    expect(b.bilheteriaBruta).toBe(75000)
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
  })
})

// ===========================================================================
// 4. VAZIO NÃO É ZERO — do arquivo até a leitura
// ===========================================================================
describe('4. vazio e zero atravessam o round-trip como coisas diferentes', () => {
  const comBruta = (bilheteriaBruta) => ({
    ...storeVazio(),
    benchmarksCustom: [
      { id: 'bm-x', nome: 'Alameda Oeste', custom: true, publico: 500, custos: {}, custoTotal: 0, receita: 20000, ticketMedio: 0, ...(bilheteriaBruta === undefined ? {} : { bilheteriaBruta }) },
    ],
  })

  it('ZERO sobrevive como zero, e não vira "não anotado"', () => {
    const backup = parseBackup(JSON.stringify(montarBackup(comBruta(0))))
    const b = mesclarBackup(storeVazio(), backup).benchmarksCustom[0]
    expect(b.bilheteriaBruta).toBe(0)
    expect(bilheteriaBrutaDe(b)).toBe(0)
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA) // 0 ÷ 500 = 0 = o ticket
  })

  it('AUSENTE sobrevive como ausente, e não vira zero', () => {
    const backup = parseBackup(JSON.stringify(montarBackup(comBruta(undefined))))
    const b = mesclarBackup(storeVazio(), backup).benchmarksCustom[0]
    expect('bilheteriaBruta' in b).toBe(false)
    expect(bilheteriaBrutaDe(b)).toBeNull()
  })

  it('LIMPAR o campo no editor (null) é lido como ausente, nunca como zero', () => {
    const backup = parseBackup(JSON.stringify(montarBackup(comBruta(null))))
    const b = mesclarBackup(storeVazio(), backup).benchmarksCustom[0]
    expect(bilheteriaBrutaDe(b)).toBeNull()
    expect(b.bilheteriaBruta).not.toBe(0)
  })
})

// ===========================================================================
// 5. ATAQUES — arquivo editado à mão, e os embutidos
// ===========================================================================
describe('5. arquivo editado à mão não vira número inventado', () => {
  const arquivoCom = (bilheteriaBruta) =>
    JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [],
      benchmarksCustom: [
        { id: 'bm-z', nome: 'Editado à mão', custom: true, publico: 500, custos: {}, custoTotal: 0, receita: 100000, ticketMedio: 150, bilheteriaBruta },
      ],
    })

  it('bilheteria como TEXTO numérico vira número — o valor anotado não é ignorado', () => {
    const b = parseBackup(arquivoCom('75000')).benchmarksCustom[0]
    expect(b.bilheteriaBruta).toBe(75000)
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
  })

  it('bilheteria como texto SEM número é lida como ausente, e nada explode', () => {
    const b = parseBackup(arquivoCom('setenta e cinco mil')).benchmarksCustom[0]
    expect(bilheteriaBrutaDe(b)).toBeNull()
    expect(reguaDoTicket(b)).toBe('nao-registrada')
  })

  it('a normalização vale também pelo localStorage, não só pelo arquivo importado', () => {
    // O store do Marco vive no navegador; um backup restaurado à mão, ou uma
    // gravação de versão antiga, chega por AQUI e não pelo parseBackup. Sem
    // migrar na leitura do localStorage, a bilheteria ficaria eternamente como
    // texto e a tela diria "não registrada" sobre um dado que está anotado.
    localStorage.setItem(
      'previsao-eventos:v1',
      JSON.stringify({
        eventos: [],
        benchmarksCustom: [
          { id: 'bm-z', nome: 'Editado à mão', custom: true, publico: 500, custos: {}, custoTotal: 0, receita: 100000, ticketMedio: 150, bilheteriaBruta: '75000' },
        ],
      })
    )
    const b = loadStore().benchmarksCustom[0]
    expect(b.bilheteriaBruta).toBe(75000)
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
  })

  it('bilheteria NEGATIVA não é apagada em silêncio — ela aparece, e a tela a denuncia', () => {
    // A migração não policia faixa em benchmark (nenhum irmão é policiado), e
    // apagar calado seria pior: o dono perderia o rastro do erro. O que o app
    // faz é NOMEAR o desencontro, que é o que ele pode afirmar com verdade.
    const b = parseBackup(arquivoCom(-75000)).benchmarksCustom[0]
    expect(b.bilheteriaBruta).toBe(-75000)
    expect(reguaDoTicket(b)).toBe('nao-confere')
  })
})

describe('6. o benchmark que NASCE de uma planilha diz qual régua o mediu', () => {
  // Uma planilha de festa: 3 lotes pagos e 1 de cortesia. Sintético.
  const daPlanilha = () =>
    montarBenchmarkDePlanilha({
      nome: 'Alameda Centro (planilha)',
      publico: 500,
      custos: { aeb: 10000, locacao: null, estrutura: null, equipe: null, artistico: null, marketing: null, extras: null },
      custoTotal: 10000,
      receita: 60000,
      pagos: 400, // 100 cortesias não entram na divisão
    })

  it('o ticket é receita ÷ ingressos PAGOS — 150, e não os 120 de receita ÷ público', () => {
    const b = daPlanilha()
    expect(b.ticketMedio).toBe(150)
    expect(60000 / 500).toBe(120) // o que a régua do público daria
  })

  it('e ele GRAVA a régua, porque o número de pagos não vai para o store', () => {
    const b = daPlanilha()
    expect(b.reguaTicket).toBe(REGUA_PAGANTES)
    expect(reguaDoTicket(b)).toBe(REGUA_PAGANTES)
    expect('pagos' in b).toBe(false) // é exatamente por isso que a régua precisa ser gravada
  })

  it('sem a régua gravada, este mesmo benchmark seria indeduzível — a prova do porquê', () => {
    const semEtiqueta = { ...daPlanilha() }
    delete semEtiqueta.reguaTicket
    expect(reguaDoTicket(semEtiqueta)).toBe('nao-registrada')
  })

  it('a régua sobrevive ao round-trip do backup', () => {
    const store = { ...storeVazio(), benchmarksCustom: [daPlanilha()] }
    const backup = parseBackup(JSON.stringify(montarBackup(store)))
    expect(mesclarBackup(storeVazio(), backup).benchmarksCustom[0].reguaTicket).toBe(REGUA_PAGANTES)
  })

  it('planilha sem receita não inventa ticket nem lucro', () => {
    const b = montarBenchmarkDePlanilha({ nome: 'Sem receita', publico: 0, custos: {}, custoTotal: 5000, receita: 0, pagos: 0 })
    expect(b.receita).toBeNull()
    expect(b.ticketMedio).toBeNull()
    expect(b.lucro).toBeNull()
    expect(b.publico).toBeNull()
  })
})

describe('7. os embutidos do Marco seguem intocados, e a fábrica recuperável', () => {
  it('a migração não encosta nos 4 valores de fábrica', () => {
    const congelado = structuredClone(FIXED_BENCHMARKS)
    migrarBenchmarks(FIXED_BENCHMARKS)
    expect(FIXED_BENCHMARKS).toEqual(congelado)
  })

  it('bilheteria digitada num EMBUTIDO vira override, e "restaurar de fábrica" a remove', () => {
    // É o caminho sancionado do princípio 3: o dono edita, a etiqueta "editado"
    // aparece, e os valores de fábrica continuam recuperáveis.
    const store = { ...storeVazio(), benchmarkOverrides: { 'bm-cordel': { bilheteriaBruta: 122000 } } }
    const cordel = benchmarksDisponiveis(store).find((b) => b.id === 'bm-cordel')
    expect(cordel.bilheteriaBruta).toBe(122000)
    expect(cordel.editado).toBe(true)

    const depois = restaurarBenchmarkFabrica(store, 'bm-cordel')
    const restaurado = benchmarksDisponiveis(depois).find((b) => b.id === 'bm-cordel')
    expect('bilheteriaBruta' in restaurado).toBe(false)
    expect(restaurado).toEqual(FIXED_BENCHMARKS.find((b) => b.id === 'bm-cordel'))
  })

  it('aplicarOverride não inventa o campo em quem não o tem', () => {
    const base = FIXED_BENCHMARKS.find((b) => b.id === 'bm-marfim-0905')
    const comOverride = aplicarOverride(base, { publico: 1600 })
    expect('bilheteriaBruta' in comOverride).toBe(false)
  })
})
