// FRENTE 17 do MODELO-AUDITORIA — backup adulterado: CAMPO-NÚCLEO COM O TIPO
// TROCADO. A frente 17 nasceu manual; este arquivo é a âncora automatizada da
// parte que dava para automatizar: o arquivo montado à mão que não é "lixo
// óbvio" (o parse não quebra, os ids são únicos, a identidade está certa) mas
// traz um campo de dinheiro com o TIPO errado dentro do evento.
//
// O QUE JÁ ESTAVA COBERTO E NÃO SE REPETE AQUI (conferido antes de escrever):
//   • ids repetidos no arquivo ....... backupIdsDuplicados.test.js
//   • `app` de outro app, `versao` FUTURA, backup sem identidade
//                                       backupIdentidade.test.js
//   • evento-lixo no topo da lista ... migracao.test.js ("parseBackup estrito")
//   • número presente e FORA da faixa + o censo do import
//                                       vendaPctEcensoImport.evidencia.test.js
//   • conteúdo do localStorage que parseia mas não é store
//                                       leituraCorrompida.test.js
// O buraco que sobrava é o deste arquivo: OBJETO onde se espera número, DINHEIRO
// EM TEXTO BRASILEIRO ("1.234,56") onde se espera número, `null` no meio da
// lista de custos e `versao` AUSENTE.
//
// Todos os fixtures são SINTÉTICOS (festa "Teste do Envenenamento") — nenhum
// dado real do Marco entra em teste.
//
// ATUALIZADO 25/07/2026 — régua do backup mexido à mão (decisão do Marco, com
// os números medidos abaixo em cada describe): os três achados abertos deste
// arquivo (null na lista de custos, tipo trocado sem aviso, `versao` ausente
// entrando calada) viraram comportamento de produção. Os pares
// EVIDÊNCIA/PROPOSTA que os descreviam trocaram de lugar — cada `it.skip`
// "PROPOSTA" virou o teste vivo; a evidência do "antes" que contradiz o novo
// comportamento foi ajustada para descrever o "depois", com a data da mudança.
//
// Convenção deste arquivo, para ninguém confundir spec com cobertura:
//   • `it(...)` verde     = comportamento de HOJE, medido e afirmado;
//   • `it(...)` com "EVIDÊNCIA" no nome = comportamento de hoje que é o ACHADO
//     em aberto — o teste existe para o defeito não sumir da vista;
//   • `it.skip(...)` com "PROPOSTA" no nome = especificação do comportamento
//     CORRETO, parada na porta do Marco (é decisão de produto e mudaria código
//     de produção). Quando ela for aprovada e implementada, o par
//     EVIDÊNCIA/PROPOSTA troca de lugar — os dois vivem lado a lado de propósito.
import { describe, it, expect } from 'vitest'
import { parseBackup, montarBackup, APP_ID, VERSAO_BACKUP } from './storage.js'
import { migrarEvento, censoNormalizacoes } from './migracao.js'
import { computeCenario, custosPorCategoria } from './calc.js'
import { novoEvento } from './defaults.js'

// Festa sintética com números redondos, para a conta ficar legível no teste:
// 500 ingressos a R$ 100 e um custo de R$ 20.000.
function festaDeTeste(patch = {}) {
  return {
    ...novoEvento('Teste do Envenenamento'),
    id: 'evento-sintetico-1',
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 500 }],
    categorias: [
      { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
    ],
    ...patch,
  }
}

const arquivoDeBackup = (eventos) =>
  JSON.stringify({ app: APP_ID, versao: VERSAO_BACKUP, exportadoEm: '2026-07-25T03:00:00.000Z', eventos })

describe('backup envenenado — OBJETO onde se espera número (preço do lote)', () => {
  it('o preço vira "não informado" na migração e o lote passa a valer R$ 0 na conta', () => {
    const sao = festaDeTeste()
    const envenenado = festaDeTeste({
      lotes: [{ id: 'lote-1', nome: '1º lote', valor: { moeda: 'BRL', quantia: 100 }, quantidade: 500 }],
    })

    const brutaSa = computeCenario(migrarEvento(sao), 'realista').bruta
    const brutaEnvenenada = computeCenario(migrarEvento(envenenado), 'realista').bruta

    // A régua da migração (naoNegativoOuVazio) não deixa o objeto entrar como
    // número — vira '' ("não informado"). O efeito na conta é o que importa:
    // o lote de R$ 100 vira lote de R$ 0 (o app o trata como cortesia).
    // R$ 45.000 = 450 ingressos (90% do lote no cenário realista) × R$ 100.
    expect(migrarEvento(envenenado).lotes[0].valor).toBe('')
    expect(brutaSa).toBe(45000)
    expect(brutaEnvenenada).toBe(0)
  })

  it('parseBackup ACEITA o arquivo (o envenenamento não é recusado na porta)', () => {
    const r = parseBackup(
      arquivoDeBackup([festaDeTeste({ lotes: [{ id: 'lote-1', nome: '1º lote', valor: {}, quantidade: 500 }] })])
    )
    expect(r.eventos).toHaveLength(1)
    expect(r.eventos[0].lotes[0].valor).toBe('')
  })
})

describe('backup envenenado — DINHEIRO EM TEXTO BRASILEIRO onde se espera número', () => {
  it('custo estimado "1.234,56" vira "não informado" — o item some do orçamento', () => {
    // Vetor real: alguém abre o backup no editor de texto e "arruma" o número
    // para o formato que lê na tela. A régua da migração só aceita notação
    // decimal ("1234.56"), então o texto brasileiro cai como não informado.
    const envenenado = festaDeTeste({
      categorias: [
        { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: '1.234,56', status: 'ESTIMADO' }] },
      ],
    })
    const migrado = migrarEvento(envenenado)
    expect(migrado.categorias[0].itens[0].estimado).toBe('')
    expect(computeCenario(migrado, 'realista').custoItens).toBe(0)
  })

  it('a mesma quantia em notação decimal ("1234.56") ATRAVESSA byte a byte — o outro lado da moeda', () => {
    const bom = festaDeTeste({
      categorias: [
        { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: '1234.56', status: 'ESTIMADO' }] },
      ],
    })
    const migrado = migrarEvento(bom)
    expect(migrado.categorias[0].itens[0].estimado).toBe('1234.56')
    expect(computeCenario(migrado, 'realista').custoItens).toBeCloseTo(1234.56, 2)
  })
})

describe('backup envenenado — o censo do import passa a contar o tipo trocado (Marco, 25/07/2026, caso 2)', () => {
  // A fronteira do backup tem UM lugar que fala com o Marco antes de aplicar: o
  // censo (decisão 3a) e o confirm que ele alimenta. Até 25/07/2026 o censo
  // listava só número PRESENTE e FORA DA FAIXA; o TIPO TROCADO (objeto, texto
  // fora da notação decimal, Infinity) também vira "não informado" na migração
  // e atravessava SEM nenhuma linha de aviso — medido pelo par EVIDÊNCIA/
  // PROPOSTA que existia aqui. Decisão do Marco: os dois merecem o MESMO
  // aviso, na MESMA lista — nenhuma segunda superfície nova.
  it('objeto, texto brasileiro fora da notação decimal e Infinity agora GERAM item de censo, um por campo', () => {
    const censo = censoNormalizacoes([
      festaDeTeste({ lotes: [{ id: 'lote-1', nome: '1º lote', valor: {}, quantidade: 500 }] }),
      festaDeTeste({
        id: 'evento-sintetico-2',
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: '1.234,56' }] }],
      }),
      festaDeTeste({
        id: 'evento-sintetico-3',
        cenariosConfig: { realista: { vendaPct: Infinity } },
      }),
    ])
    expect(censo.map((c) => c.campo)).toEqual(['valor', 'estimado', 'realista.vendaPct'])
  })

  it('o censo continua contando o que ele já contava: número presente e fora da faixa', () => {
    // Guarda de não-regressão do lado que já funcionava — se alguém "consertar"
    // o censo quebrando este caso, o teste morde.
    const censo = censoNormalizacoes([
      festaDeTeste({ categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: -1000 }] }] }),
    ])
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('estimado')
  })

  it('o censo NÃO lista campo vazio/ausente — "não informado" de propósito não é corrupção', () => {
    // Guarda contra o extremo oposto: valorPresente() exclui '', null e
    // undefined — só valor QUE VEIO no arquivo entra no censo.
    const censo = censoNormalizacoes([
      festaDeTeste({ categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: '' }] }] }),
      festaDeTeste({ id: 'evento-sintetico-4', lotes: [{ id: 'lote-1', nome: '1º lote' }] }),
    ])
    expect(censo).toEqual([])
  })
})

describe('backup envenenado — null no meio da LISTA DE CUSTOS (Marco, 25/07/2026, caso 1 — recusa o que quebra)', () => {
  const comItemNulo = () =>
    festaDeTeste({
      categorias: [
        {
          nome: 'Produção',
          itens: [
            { id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' },
            null,
            { id: 'custo-2', servico: 'Luz', estimado: 5000, status: 'ESTIMADO' },
          ],
        },
      ],
    })

  it('parseBackup RECUSA o arquivo, nomeando o evento e a categoria — nada foi importado', () => {
    // Até 25/07/2026 a régua de "forma de evento" do parseBackup olhava só o
    // TOPO da lista de eventos; um item de custo nulo um nível abaixo passava,
    // e formaItemCusto devolvia o não-objeto como veio (migracao.js: `: i`).
    // Decisão do Marco: este caso é o único dos três que RECUSA — aceitar
    // avisando seria aceitar o app quebrar ao somar (ver teste abaixo).
    expect(() => parseBackup(arquivoDeBackup([comItemNulo()]))).toThrow(
      /não tem forma de item de custo.*nada foi importado/is
    )
    expect(() => parseBackup(arquivoDeBackup([comItemNulo()]))).toThrow(/"Teste do Envenenamento"/)
    expect(() => parseBackup(arquivoDeBackup([comItemNulo()]))).toThrow(/"Produção"/)
  })

  it('EVIDÊNCIA (o defeito que a recusa acima existe para evitar, medido por baixo do parseBackup): com o null no lugar, a conta de custos LANÇA', () => {
    // migrarEvento()/custosPorCategoria() usadas DIRETO (sem passar pelo
    // parseBackup) continuam sem a trava — é o caminho de leitura do
    // localStorage já salvo, fora do escopo desta régua de backup. Mesmo
    // estrago que o "evento-lixo" já resolvido (storage.js: "o lixo
    // atravessava o parse e o mesclarBackup estourava DENTRO do updater do
    // setStore"), uma camada mais fundo — e a razão de o parseBackup recusar
    // ANTES de chegar aqui.
    expect(() => custosPorCategoria(migrarEvento(comItemNulo()).categorias)).toThrow(TypeError)
  })
})

describe('backup envenenado — `versao` do envelope AUSENTE (Marco, 25/07/2026, caso 3 — entra, com aviso)', () => {
  it('arquivo com `app` desta casa e SEM `versao` agora É SINALIZADO (reusa `formatoAntigo`) antes de aplicar', () => {
    // `montarBackup` SEMPRE carimba a versão; um arquivo com identidade certa e
    // sem versão só existe editado à mão. Até 25/07/2026, `Number(undefined)`
    // era NaN, não passava no `Number.isFinite`, e o arquivo seguia pelo
    // caminho normal com `formatoAntigo=false` — nenhum aviso na tela. Decisão
    // do Marco: reusar o MESMO aviso do formato antigo, sem inventar uma
    // segunda superfície.
    const r = parseBackup(JSON.stringify({ app: APP_ID, eventos: [festaDeTeste()] }))
    expect(r.formatoAntigo).toBe(true)
    expect(r.eventos).toHaveLength(1)
  })

  it('`versao` como texto não-numérico ("abc") tem o mesmo desfecho — sinalizado, não recusado', () => {
    const r = parseBackup(JSON.stringify({ app: APP_ID, versao: 'abc', eventos: [festaDeTeste()] }))
    expect(r.formatoAntigo).toBe(true)
  })
})

describe('backup LIMPO continua entrando — o outro lado de toda régua deste arquivo', () => {
  it('export sintético → parseBackup → mesmos números, sem censo e sem marca de formato antigo', () => {
    const store = { eventos: [festaDeTeste()], benchmarksCustom: [], benchmarkOverrides: {} }
    const r = parseBackup(JSON.stringify(montarBackup(store)))
    expect(r.formatoAntigo).toBe(false)
    expect(censoNormalizacoes(r.eventosCrus)).toEqual([])
    expect(computeCenario(r.eventos[0], 'realista').bruta).toBe(45000)
    expect(computeCenario(r.eventos[0], 'realista').custoItens).toBe(20000)
  })
})
