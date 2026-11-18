// RÉGUA DO BACKUP MEXIDO À MÃO — decisão do Marco, 25/07/2026, com os números
// medidos na mesa: "recusa o que quebra, avisa o resto". Três defeitos de
// backup editado à mão, cada um com o tratamento que o Marco escolheu:
//
//   1. item de custo VAZIO (null) no meio da lista de uma categoria
//      → RECUSA o arquivo, nomeando o evento e a categoria (medido: sem a
//        trava, a conta de custos ESTOURA com "Cannot read properties of
//        null (reading 'estimado')" — aceitar avisando seria aceitar o app
//        quebrar ao somar).
//   2. campo com TIPO errado ou infinito (texto onde se espera número,
//      Infinity) → ENTRA, mas com AVISO na mesma lista que o app já mostra
//      antes de aplicar um backup (censoNormalizacoes/textoAvisoNormalizacoes)
//      — medido: essa lista devolvia ZERO avisos para os dois casos.
//   3. backup sem carimbo de `versao` → ENTRA, com AVISO (reusa a marca
//      `formatoAntigo` que a tela já lê) — medido: `Number(undefined)` é NaN,
//      a checagem de versão futura não dispara, e o arquivo entrava como se
//      fosse a versão atual, sem nenhum sinal.
//
// Este arquivo nasce do achado registrado em backupEnvenenado.test.js e
// censoImportAtaque.test.js (pares EVIDÊNCIA/PROPOSTA, agora implementados) —
// é a âncora dedicada da decisão datada, com os quatro casos lado a lado:
// os três defeitos acima + o caso feliz (backup bom continua importando,
// princípio 2 — contrato do localStorage).
import { describe, it, expect } from 'vitest'
import { parseBackup, montarBackup, APP_ID, VERSAO_BACKUP } from './storage.js'
import { censoNormalizacoes, textoAvisoNormalizacoes } from './migracao.js'
import { computeCenario } from './calc.js'
import { novoEvento } from './defaults.js'

// Festa sintética com números redondos: 500 ingressos a R$ 100, um custo de
// R$ 20.000. Nenhum dado real do Marco entra em teste.
function festaDeTeste(patch = {}) {
  return {
    ...novoEvento('Teste da Régua do Backup'),
    id: 'evento-regua-1',
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 500 }],
    categorias: [
      {
        nome: 'Produção',
        itens: [{ id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }],
      },
    ],
    ...patch,
  }
}

const arquivoDeBackup = (eventos, extra = {}) =>
  JSON.stringify({
    app: APP_ID,
    versao: VERSAO_BACKUP,
    exportadoEm: '2026-07-25T03:00:00.000Z',
    eventos,
    ...extra,
  })

describe('régua do backup mexido à mão — caso 1: item de custo nulo → RECUSA nomeando evento e categoria', () => {
  const comItemNulo = () =>
    festaDeTeste({
      categorias: [
        {
          nome: 'Bar & Bebidas',
          itens: [
            { id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' },
            null,
            { id: 'custo-2', servico: 'Gelo', estimado: 800, status: 'ESTIMADO' },
          ],
        },
      ],
    })

  it('parseBackup LANÇA — nada foi importado', () => {
    expect(() => parseBackup(arquivoDeBackup([comItemNulo()]))).toThrow()
  })

  it('a mensagem nomeia o EVENTO e a CATEGORIA, em português, e diz que nada foi importado', () => {
    expect(() => parseBackup(arquivoDeBackup([comItemNulo()]))).toThrow(
      /"Teste da Régua do Backup".*"Bar & Bebidas".*não tem forma de item de custo.*nada foi importado/is
    )
  })

  it('categoria SEM a chave `itens` (undefined) não aciona a régua — só lista presente é varrida', () => {
    const semItens = festaDeTeste({ categorias: [{ nome: 'Produção' }] })
    expect(() => parseBackup(arquivoDeBackup([semItens]))).not.toThrow()
  })
})

// Extensão de 25/07/2026 (Marco aprovou estender a mesma régua): o provador
// adversarial atacou além do combinado no caso 1 e achou que um LOTE nulo, um
// PATROCÍNIO nulo ou uma CATEGORIA nula (a categoria em si, não só
// `categorias[].itens[]`) continuavam entrando no mesmo arquivo. O teste
// acima ("item nulo no MEIO de uma lista de LOTES... não aciona esta régua")
// registrava esse buraco como se fosse escopo — a decisão do Marco fechou o
// buraco, então a afirmação virou o contrário: os três vetores agora RECUSAM.
describe('régua do backup mexido à mão — extensão de 25/07/2026: lotes[], patrocinios[] e categorias[] (a categoria em si)', () => {
  it('lote nulo no MEIO da lista de lotes → RECUSA, nomeando o evento e o nº do lote', () => {
    const comLoteNulo = festaDeTeste({
      lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 500 }, null],
    })
    expect(() => parseBackup(arquivoDeBackup([comLoteNulo]))).toThrow(
      /"Teste da Régua do Backup".*lote nº 2.*não tem forma de lote.*nada foi importado/is
    )
  })

  it('lote bom (nenhum nulo) continua passando — caso feliz do vetor', () => {
    const loteBom = festaDeTeste({
      lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 500 }],
    })
    expect(() => parseBackup(arquivoDeBackup([loteBom]))).not.toThrow()
  })

  it('patrocínio nulo no MEIO da lista de patrocínios → RECUSA, nomeando o evento e o nº do patrocínio', () => {
    const comPatrocinioNulo = festaDeTeste({
      patrocinios: [
        { id: 'patro-1', patrocinador: 'Marca X', valor: 5000, estagio: 'confirmado' },
        null,
      ],
    })
    expect(() => parseBackup(arquivoDeBackup([comPatrocinioNulo]))).toThrow(
      /"Teste da Régua do Backup".*patrocínio nº 2.*não tem forma de patrocínio.*nada foi importado/is
    )
  })

  it('patrocínio bom (nenhum nulo) continua passando — caso feliz do vetor', () => {
    const patrocinioBom = festaDeTeste({
      patrocinios: [{ id: 'patro-1', patrocinador: 'Marca X', valor: 5000, estagio: 'confirmado' }],
    })
    expect(() => parseBackup(arquivoDeBackup([patrocinioBom]))).not.toThrow()
  })

  it('categoria nula no MEIO da lista de categorias (a categoria em si, não um item dela) → RECUSA, nomeando o evento e o nº da categoria', () => {
    const comCategoriaNula = festaDeTeste({
      categorias: [
        { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
        null,
      ],
    })
    expect(() => parseBackup(arquivoDeBackup([comCategoriaNula]))).toThrow(
      /"Teste da Régua do Backup".*categoria nº 2.*não tem forma de categoria.*nada foi importado/is
    )
  })

  it('categoria boa (nenhuma nula) continua passando — caso feliz do vetor', () => {
    const categoriaBoa = festaDeTeste({
      categorias: [
        { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
      ],
    })
    expect(() => parseBackup(arquivoDeBackup([categoriaBoa]))).not.toThrow()
  })
})

describe('régua do backup mexido à mão — caso 2: tipo errado ou infinito → ENTRA, com AVISO na lista existente', () => {
  it('venda de cenário como texto "oitenta por cento" — parseBackup aceita, e o aviso aparece no censo', () => {
    const arquivo = arquivoDeBackup([
      festaDeTeste({ cenariosConfig: { realista: { vendaPct: 'oitenta por cento' } } }),
    ])
    const backup = parseBackup(arquivo)
    expect(backup.eventos).toHaveLength(1)
    const censo = censoNormalizacoes(backup.eventosCrus)
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('realista.vendaPct')
  })

  it('custo estimado como Infinity — parseBackup aceita, e o aviso aparece no censo', () => {
    // `JSON.stringify(Infinity)` viraria `null` (perderia o próprio caso que
    // este teste quer provar) — o vetor real de Infinity num ARQUIVO de
    // backup é um número grande demais escrito por extenso (400 noves), que o
    // `JSON.parse` do app já devolve como `Infinity` sem avisar nada (mesmo
    // mecanismo medido em censoImportAtaque.test.js). Por isso o texto do
    // arquivo é montado com um marcador e o marcador é trocado pelo número
    // CRU (sem aspas), não com `estimado: Infinity` direto no objeto JS.
    const NOVES_400 = '9'.repeat(400)
    const textoComMarcador = arquivoDeBackup([
      festaDeTeste({
        categorias: [
          { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: '__MARCADOR_INFINITO__', status: 'ESTIMADO' }] },
        ],
      }),
    ])
    const arquivo = textoComMarcador.replace('"__MARCADOR_INFINITO__"', NOVES_400)
    expect(JSON.parse(arquivo).eventos[0].categorias[0].itens[0].estimado).toBe(Infinity) // a montagem funcionou

    const backup = parseBackup(arquivo)
    expect(backup.eventos).toHaveLength(1)
    const censo = censoNormalizacoes(backup.eventosCrus)
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('estimado')
  })

  it('o aviso do caso 2 é a MESMA superfície que o fora-de-faixa já usa — textoAvisoNormalizacoes lê os dois juntos', () => {
    // Regra do pedido: "não invente uma segunda superfície de aviso". Prova:
    // um censo misturando os DOIS motivos (tipo errado + fora da faixa) gera
    // UM texto de confirm só, contando os dois.
    const censo = censoNormalizacoes([
      festaDeTeste({
        cenariosConfig: { realista: { vendaPct: 'oitenta por cento' } },
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: -500 }] }],
      }),
    ])
    expect(censo).toHaveLength(2)
    const texto = textoAvisoNormalizacoes(censo)
    expect(texto).toMatch(/2 valores fora das faixas do app/)
    expect(texto).toMatch(/realista.*vendaPct|ingressos vendidos/i)
  })

  it('objeto onde se espera número (preço do lote) também soa o aviso', () => {
    const censo = censoNormalizacoes([
      festaDeTeste({ lotes: [{ id: 'lote-1', nome: '1º lote', valor: { moeda: 'BRL' }, quantidade: 500 }] }),
    ])
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('valor')
  })
})

describe('régua do backup mexido à mão — caso 3: `versao` ausente → ENTRA, com AVISO (reusa formatoAntigo)', () => {
  it('`versao` AUSENTE num arquivo com identidade desta casa: entra, e formatoAntigo fica true', () => {
    const backup = parseBackup(JSON.stringify({ app: APP_ID, eventos: [festaDeTeste()] }))
    expect(backup.formatoAntigo).toBe(true)
    expect(backup.eventos).toHaveLength(1)
  })

  it('`versao` como texto ilegível ("nao-sei"): mesmo tratamento — entra, formatoAntigo true', () => {
    const backup = parseBackup(JSON.stringify({ app: APP_ID, versao: 'nao-sei', eventos: [festaDeTeste()] }))
    expect(backup.formatoAntigo).toBe(true)
  })

  it('`versao` presente e válida (o caminho normal) continua com formatoAntigo false', () => {
    const backup = parseBackup(arquivoDeBackup([festaDeTeste()]))
    expect(backup.formatoAntigo).toBe(false)
  })
})

describe('régua do backup mexido à mão — o caso feliz: backup BOM continua entrando sem nenhum aviso', () => {
  it('export sintético → parseBackup → mesmos números, sem censo e sem marca de formato antigo', () => {
    const store = { eventos: [festaDeTeste()], benchmarksCustom: [], benchmarkOverrides: {} }
    const backup = parseBackup(JSON.stringify(montarBackup(store)))
    expect(backup.formatoAntigo).toBe(false)
    expect(censoNormalizacoes(backup.eventosCrus)).toEqual([])
    expect(computeCenario(backup.eventos[0], 'realista').bruta).toBe(45000)
    expect(computeCenario(backup.eventos[0], 'realista').custoItens).toBe(20000)
  })
})

describe('régua do backup mexido à mão — princípio 2: um backup ANTIGO válido continua importando', () => {
  // O contrato do localStorage não pode quebrar por causa desta régua nova.
  // Um backup pré-17/07/2026 (sem `app`, sem `versao` — o formato de VERDADE
  // que já existia antes do carimbo de identidade nascer, não um arquivo
  // editado à mão) precisa seguir importando, com o aviso de formato antigo
  // que já existia — quebrar isto é S1 (dado salvo do Marco corrompido).
  it('backup sem `app` e sem `versao` (formato pré-17/07) IMPORTA, com formatoAntigo=true e os números intactos', () => {
    const arquivoAntigo = JSON.stringify({ eventos: [festaDeTeste()] })
    const backup = parseBackup(arquivoAntigo)
    expect(backup.formatoAntigo).toBe(true)
    expect(backup.eventos).toHaveLength(1)
    expect(computeCenario(backup.eventos[0], 'realista').bruta).toBe(45000)
    expect(computeCenario(backup.eventos[0], 'realista').custoItens).toBe(20000)
  })

  it('backup antigo com MÚLTIPLOS eventos e sem identidade nenhuma segue importando todos, byte a byte', () => {
    const doisEventos = [
      festaDeTeste(),
      festaDeTeste({ id: 'evento-regua-2', nome: 'Segunda festa antiga' }),
    ]
    const backup = parseBackup(JSON.stringify({ eventos: doisEventos }))
    expect(backup.formatoAntigo).toBe(true)
    expect(backup.eventos).toHaveLength(2)
    expect(backup.eventos[1].nome).toBe('Segunda festa antiga')
  })
})
