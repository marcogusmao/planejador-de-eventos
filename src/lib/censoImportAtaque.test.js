// FRENTE 19 do MODELO-AUDITORIA — ATAQUE POR PORTA: faixas de domínio, a
// fronteira do backup e o censo do import. Âncora automatizada dos casos que a
// frente já nomeava por escrito mas ninguém tinha executado.
//
// O QUE JÁ ESTAVA COBERTO E NÃO SE REPETE AQUI (conferido antes de escrever):
//   • percentual/cenário fora da faixa NA PORTA DE UI ..... Simulador.faixa.test.jsx,
//                                                           loteTravas.faixa.test.jsx
//   • régua da migração + censo do import de valor fora da faixa
//                                     vendaPctEcensoImport.evidencia.test.js,
//                                     percentuaisForaDaFaixa.evidencia.test.js
//   • política do restaurar (cópia de segurança obrigatória) ... restaurarSnapshot.test.js
// O que NINGUÉM tinha executado, e é o que este arquivo cobre:
//   (1) número GRANDE DEMAIS — o que a fronteira faz com 1e308 e com Infinity;
//   (2) a mesma normalização que o IMPORT anuncia, a ABERTURA faz calada;
//   (3) o instantâneo restaurado, que volta SEM passar pela migração — a porta
//       por onde o custoPct −200 (achado de 20/07) ainda entra hoje.
//
// Convenção (igual à de backupEnvenenado.test.js): "EVIDÊNCIA" no nome = o
// comportamento de HOJE, que é o achado em aberto; `it.skip` com "PROPOSTA" =
// especificação do comportamento correto, parada na porta do Marco por mexer em
// produção. Fixtures 100% sintéticos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadStore, saveStore, liberarGravacao } from './storage.js'
import { migrarEvento, censoNormalizacoes } from './migracao.js'
import {
  restaurarSnapshot,
  snapshotSeguranca,
  moverParaLixeira,
  loadLixeira,
  restaurarEventoDaLixeira,
  restaurarComoCopiaDaLixeira,
} from './protecao.js'
import { computeCenario } from './calc.js'
import { novoEvento } from './defaults.js'

const CHAVE_STORE = 'previsao-eventos:v1'
const CHAVE_SNAPSHOTS = 'previsao-eventos:snapshots:v1'

function memoriaFalsa() {
  const mem = new Map()
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    get length() {
      return mem.size
    },
    key: (i) => [...mem.keys()][i] ?? null,
  }
}

// Festa sintética: 500 ingressos a R$ 100 e um custo de R$ 20.000.
function festaDeTeste(patch = {}) {
  return {
    ...novoEvento('Teste do Ataque por Porta'),
    id: 'evento-sintetico-1',
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade: 500 }],
    categorias: [
      { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
    ],
    ...patch,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoriaFalsa())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  liberarGravacao()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ataque por porta — número GRANDE DEMAIS na fronteira do backup', () => {
  const NOVES_310 = '9'.repeat(310)
  const DIGITOS_309 = `1${'0'.repeat(308)}` // 1e308: grande, e ainda FINITO

  it('310 noves como número do JSON já chegam como infinito ao app — o JSON.parse não avisa nada', () => {
    // O primeiro fato do ataque, e o mais importante de entender: quem estraga
    // o número não é o app, é o JSON.parse. Ele devolve Infinity sem lançar.
    expect(JSON.parse(`{"v":${NOVES_310}}`).v).toBe(Infinity)
  })

  it('o infinito vira "não informado" na migração — o custo de R$ 20.000 do arquivo some', () => {
    const migrado = migrarEvento(
      festaDeTeste({
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: Infinity }] }],
      })
    )
    expect(migrado.categorias[0].itens[0].estimado).toBe('')
    expect(computeCenario(migrado, 'realista').custoItens).toBe(0)
  })

  it('CONSERTO (Marco, 25/07/2026, caso 2 — régua do backup mexido à mão): o censo do import agora CONTA o infinito', () => {
    // Até 25/07/2026 o censo perguntava só "é número presente e FORA da
    // faixa?" — Infinity não passava pela régua numérica (`Number.isFinite`),
    // então respondia "não é número presente" e o item nunca era listado,
    // apesar de a migração mudar o valor exatamente como muda um
    // fora-de-faixa. `precisaAvisoNumerico` (migracao.js) agora pergunta "está
    // PRESENTE e a régua vai apagar?" — cobre os dois motivos com o mesmo aviso.
    const censo = censoNormalizacoes([
      festaDeTeste({
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: Infinity }] }],
      }),
    ])
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('estimado')
  })

  it('EVIDÊNCIA (achado em aberto): 309 dígitos (1e308) são FINITOS — atravessam inteiros e a conta devolve um absurdo', () => {
    // O outro lado do mesmo ataque: um dígito a menos e o número é finito, logo
    // está "dentro da faixa" (FAIXA_CUSTO não tem teto, `max: Infinity`), passa
    // byte a byte e a conta o usa. Não há teto declarado para dinheiro.
    //
    // Remedido em 25/07/2026, depois da quantização a centavos de
    // `custosPorCategoria` (achado do BACKLOG "a soma de ponto flutuante não
    // é associativa", conta aprovada pelo Marco): o absurdo MUDA de forma,
    // não desaparece. `somaCentavos` faz `Math.round(v * 100)` antes de
    // somar — 1e308 × 100 estoura o double (> Number.MAX_VALUE) e vira
    // `Infinity`, não mais 1e308. Continua sendo o MESMO achado em aberto
    // (nenhum teto para dinheiro na fronteira do backup), só que agora o
    // absurdo já chega em `custoItens` como `Infinity` em vez de um número
    // finito enorme.
    const migrado = migrarEvento(
      festaDeTeste({
        categorias: [
          { nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: Number(DIGITOS_309) }] },
        ],
      })
    )
    expect(migrado.categorias[0].itens[0].estimado).toBe(1e308)
    expect(computeCenario(migrado, 'realista').custoItens).toBe(Infinity)
    expect(censoNormalizacoes([migrado])).toEqual([])
  })

  it('EVIDÊNCIA (achado em aberto): o mesmo 1e308 escrito como TEXTO no arquivo também atravessa', () => {
    // A régua de string aceita notação decimal e confere `Number.isFinite` —
    // 1e308 é finito, então a string de 309 caracteres fica guardada como está.
    // Mesmo remedido de 25/07/2026 do teste acima: a quantização a centavos
    // estoura 1e308 × 100 e `custoItens` chega como `Infinity`.
    const migrado = migrarEvento(
      festaDeTeste({
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: DIGITOS_309 }] }],
      })
    )
    expect(migrado.categorias[0].itens[0].estimado).toBe(DIGITOS_309)
    expect(computeCenario(migrado, 'realista').custoItens).toBe(Infinity)
  })

  it('o mesmo 310 noves como TEXTO é barrado pela régua de string (Number(…) não é finito)', () => {
    // O único caminho dos quatro que já é honesto por acidente: como texto, o
    // número que estoura vira "não informado".
    const migrado = migrarEvento(
      festaDeTeste({
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: NOVES_310 }] }],
      })
    )
    expect(migrado.categorias[0].itens[0].estimado).toBe('')
  })

  it.skip('PROPOSTA (aguarda decisão do Marco): valor de dinheiro grande demais para o app somar é recusado ou anunciado', () => {
    // Especificação proposta: existe um TETO declarado para campos de dinheiro
    // (qual número — R$ 100 milhões? R$ 1 bilhão? — é decisão do Marco), e o
    // valor acima dele é recusado na porta e listado no censo na fronteira.
    // Mudaria campoNumerico.js/migracao.js (produção): fora do escopo.
    const censo = censoNormalizacoes([
      festaDeTeste({
        categorias: [{ nome: 'Produção', itens: [{ id: 'custo-1', servico: 'Som', estimado: 1e308 }] }],
      }),
    ])
    expect(censo).toHaveLength(1)
  })
})

describe('ataque por porta — a normalização que o IMPORT anuncia, a ABERTURA faz calada', () => {
  it('no import, o percentual fora da faixa é ANUNCIADO (o caminho honesto, guarda de não-regressão)', () => {
    const censo = censoNormalizacoes([festaDeTeste({ taxaBilheteria: 150 })])
    expect(censo).toHaveLength(1)
    expect(censo[0].campo).toBe('taxaBilheteria')
  })

  it('EVIDÊNCIA (achado em aberto): o MESMO valor lido do localStorage na abertura vira "" sem nenhum sinal', () => {
    // `loadStore` roda a MESMA migração, mas não há censo nem aviso nesse
    // caminho: quem abre o app com um store escrito por um caminho que pula a
    // migração (instantâneo restaurado, ponte, versão antiga) vê o número mudar
    // e não recebe uma linha explicando. É a mesma classe de silêncio que a
    // decisão 3a fechou na porta do import.
    localStorage.setItem(
      CHAVE_STORE,
      JSON.stringify({ eventos: [festaDeTeste({ taxaBilheteria: 150 })], benchmarksCustom: [] })
    )
    const store = loadStore()
    expect(store.eventos[0].taxaBilheteria).toBe('')
    // Não existe canal nenhum por onde a abertura conte isso: o retorno de
    // loadStore não tem campo de aviso e nada é gravado em lugar nenhum.
    expect(Object.keys(store)).not.toContain('normalizacoes')
  })

  it.skip('PROPOSTA (aguarda decisão do Marco): a abertura também conta o que normalizou', () => {
    // Especificação proposta: `loadStore` devolve o censo do que a migração
    // mudou (mesma função `censoNormalizacoes`, fonte única), e o App mostra a
    // mesma faixa que o import já mostra. Mudaria storage.js + App.jsx.
    localStorage.setItem(
      CHAVE_STORE,
      JSON.stringify({ eventos: [festaDeTeste({ taxaBilheteria: 150 })], benchmarksCustom: [] })
    )
    expect(loadStore().normalizacoes).toHaveLength(1)
  })
})

describe('instantâneo restaurado — CORRIGIR E MOSTRAR (decisão 18 do Marco, 25/07/2026)', () => {
  // Este era o caso do enunciado da frente 19 que MORDIA em dinheiro: o
  // custoPct −200 (achado de 20/07) estava travado na porta de UI e na
  // migração, mas um instantâneo salvo ANTES da trava (22/07) voltava CRU — e
  // os instantâneos do Marco de antes dessa data ainda estão no navegador dele.
  //
  // ————— A CONTA, certa × errada, lado a lado —————
  // Festa sintética: 500 ingressos × R$ 100, um custo de R$ 20.000, cenário
  // PESSIMISTA com o veneno `custoPct: −200`.
  //
  //                        COMO VOLTAVA (cru)      COMO É A VERDADE
  //   custo total ........ − R$ 21.000             + R$ 23.100
  //   lucro .............. R$ 54.250               R$ 10.150
  //   margem ............. 163%                    31%
  //
  // De onde vem cada lado: a receita pessimista é R$ 33.250 nos DOIS (o veneno
  // não toca receita). O custo de R$ 20.000 vira R$ 21.000 com a contingência
  // de 5%; daí os caminhos se separam:
  //   • CRU: 21.000 × (1 − 200/100) = − R$ 21.000. O ajuste de −200% INVERTE o
  //     sinal do custo — gastar passa a somar. 33.250 − (−21.000) = R$ 54.250,
  //     R$ 44.100 acima da verdade, e uma margem de 163% numa festa de 31%.
  //   • CERTO: a migração vê o −200 fora da faixa −50..100 e REMOVE a chave,
  //     então o cenário cai no padrão documentado do calc (pessimista,
  //     custoPct +10): 21.000 × 1,10 = R$ 23.100. 33.250 − 23.100 = R$ 10.150.
  //
  // Nenhuma fórmula mudou para isso: `migrarEvento` já fazia essa conta desde
  // 22/07 na abertura do app. O conserto foi fazê-la rodar TAMBÉM aqui, e a
  // tela passar a dizer o que ela mudou.
  const festaComCustoPctVenenoso = () =>
    festaDeTeste({
      // vendaPct 70 + a marca `padraoPessimista80` de propósito (27/07/2026):
      // os R$ afirmados neste bloco são os NÚMEROS MEDIDOS do achado, num
      // evento que vendia 70% no pessimista. A subida do padrão para 80
      // (decisão A do Marco) é outro assunto; segurá-la aqui é o que mantém
      // este teste falando de UMA correção só — a do custoPct −200. A marca é
      // exatamente o que o app grava num evento cujo dono escolheu 70 depois
      // da subida.
      cenariosConfig: { pessimista: { vendaPct: 70, custoPct: -200 }, realista: {}, otimista: {} },
      padraoPessimista80: { de: null },
    })

  const plantarSnapshot = (store) => {
    snapshotSeguranca(store, '2026-07-21T10:00:00.000Z', 'versão de teste')
    return JSON.parse(localStorage.getItem(CHAVE_SNAPSHOTS) || '[]')[0].id
  }

  it('CONSERTO (era S1): o instantâneo restaurado devolve R$ 10.150 de lucro, não os R$ 54.250 crus', () => {
    const id = plantarSnapshot({ eventos: [festaComCustoPctVenenoso()], benchmarksCustom: [] })
    const r = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })
    expect(r.ok).toBe(true)

    // O que se APLICA no app é a conta certa.
    const aplicado = computeCenario(r.store.eventos[0], 'pessimista')
    expect(Math.round(aplicado.custoTotal)).toBe(23100)
    expect(Math.round(aplicado.lucro)).toBe(10150)
    expect(Math.round(aplicado.margem)).toBe(31)

    // E o número errado que ANTES aparecia na tela continua existindo — mas
    // agora só dentro do instantâneo CRU, nomeado como tal.
    const cru = computeCenario(r.storeCru.eventos[0], 'pessimista')
    expect(cru.custoTotal).toBe(-21000)
    expect(cru.lucro).toBe(54250)
    expect(Math.round(cru.margem)).toBe(163)
  })

  it('CONSERTO: o número PARA de mudar sozinho — restaurar, salvar e recarregar dão o mesmo lucro', () => {
    // O achado gêmeo: a restauração gravava o store cru e a abertura seguinte
    // rodava a migração calada. O MESMO evento mostrava dois lucros em duas
    // visitas, e nenhuma das duas telas dizia por quê.
    const id = plantarSnapshot({ eventos: [festaComCustoPctVenenoso()], benchmarksCustom: [] })
    const r = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })
    saveStore(r.store)

    const naRestauracao = Math.round(computeCenario(r.store.eventos[0], 'pessimista').lucro)
    const depoisDeRecarregar = Math.round(
      computeCenario(loadStore().eventos[0], 'pessimista').lucro
    )
    expect(naRestauracao).toBe(10150)
    expect(depoisDeRecarregar).toBe(naRestauracao)
  })

  it('CONSERTO (princípio 7): o instantâneo CRU continua guardado, intacto, depois de restaurar', () => {
    // Corrigir não pode consumir o que foi guardado — senão o caminho de volta
    // deixa de devolver o que o Marco salvou.
    const id = plantarSnapshot({ eventos: [festaComCustoPctVenenoso()], benchmarksCustom: [] })
    const antes = localStorage.getItem(CHAVE_SNAPSHOTS)
    const r = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })

    const guardado = JSON.parse(localStorage.getItem(CHAVE_SNAPSHOTS)).find((s) => s.id === id)
    expect(guardado.store).toEqual(JSON.parse(antes).find((s) => s.id === id).store)
    expect(guardado.store.eventos[0].cenariosConfig.pessimista.custoPct).toBe(-200)
    // e o caminho de "não aplicar" recebe exatamente esse conteúdo
    expect(r.storeCru.eventos[0].cenariosConfig.pessimista.custoPct).toBe(-200)
  })

  it('CONSERTO (princípio 4): a revisão diz item a item o que mudou, em qual evento, de que valor para qual', () => {
    const id = plantarSnapshot({ eventos: [festaComCustoPctVenenoso()], benchmarksCustom: [] })
    const r = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })

    expect(r.revisao.precisaRevisao).toBe(true)
    expect(r.revisao.correcoes).toHaveLength(1)
    const c = r.revisao.correcoes[0]
    expect(c.evento).toBe('Teste do Ataque por Porta')
    expect(c.oQueMudou).toContain('cenário pessimista, ajuste de custos')
    expect(c.oQueMudou).toContain('200')
    expect(c.para).toBe('não informado')
    expect(c.explicacao).toMatch(/padrão/i)

    // E o efeito em dinheiro, que é o que decide uma festa.
    const ef = r.revisao.efeitos.find((e) => e.evento === 'Teste do Ataque por Porta')
    const lucro = ef.linhas.find((l) => l.label === 'Lucro (pessimista)')
    expect(lucro.antes).toBe(54250)
    expect(Math.round(lucro.depois)).toBe(10150)
  })

  it('instantâneo com dados SÃOS não pede revisão nenhuma e volta idêntico', () => {
    // O outro lado da moeda: o problema era a AUSÊNCIA da migração, não a
    // restauração em si. Dado bom atravessa igual pelos dois caminhos, e a
    // tela de revisão NÃO aparece (restaurar continua instantâneo para ele).
    const id = plantarSnapshot({ eventos: [festaDeTeste()], benchmarksCustom: [] })
    const r = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })
    expect(r.revisao.precisaRevisao).toBe(false)
    expect(r.revisao.correcoes).toEqual([])
    expect(r.revisao.efeitos).toEqual([])
    expect(computeCenario(r.store.eventos[0], 'realista').lucro).toBe(
      computeCenario(migrarEvento(r.storeCru.eventos[0]), 'realista').lucro
    )
  })

  it('restaurar DUAS VEZES seguidas não corrige duas vezes — a conta é a mesma', () => {
    // A migração é idempotente por contrato; a restauração herda isso. Sem
    // esta guarda, uma correção aplicada sobre si mesma poderia derivar.
    const id = plantarSnapshot({ eventos: [festaComCustoPctVenenoso()], benchmarksCustom: [] })
    const um = restaurarSnapshot(id, { eventos: [], benchmarksCustom: [] })
    const dois = restaurarSnapshot(id, um.store)
    expect(dois.store.eventos[0]).toEqual(um.store.eventos[0])
    expect(Math.round(computeCenario(dois.store.eventos[0], 'pessimista').lucro)).toBe(10150)
  })
})

describe('a MESMA porta na lixeira — quem sai de lá também passa pela migração', () => {
  // Achado da varredura de 25/07: o instantâneo não era o único caminho de
  // volta que pulava a migração. A lixeira guarda até 50 exclusões e não tem
  // prazo — um evento excluído ANTES da trava de 22/07 ainda está lá com o
  // custoPct −200 e voltava exatamente como o instantâneo voltava: cru, com
  // R$ 54.250 de lucro onde a verdade é R$ 10.150. Consertar só o instantâneo
  // seria pior que não consertar nada: passaria a sensação de resolvido.
  const festaVenenosa = () =>
    festaDeTeste({
      // vendaPct 70 + a marca `padraoPessimista80` de propósito (27/07/2026):
      // os R$ afirmados neste bloco são os NÚMEROS MEDIDOS do achado, num
      // evento que vendia 70% no pessimista. A subida do padrão para 80
      // (decisão A do Marco) é outro assunto; segurá-la aqui é o que mantém
      // este teste falando de UMA correção só — a do custoPct −200. A marca é
      // exatamente o que o app grava num evento cujo dono escolheu 70 depois
      // da subida.
      cenariosConfig: { pessimista: { vendaPct: 70, custoPct: -200 }, realista: {}, otimista: {} },
      padraoPessimista80: { de: null },
    })

  const appDeMentira = (store = { eventos: [], benchmarksCustom: [] }) => {
    const app = { store }
    app.aplicar = (fn) => {
      app.store = fn(app.store)
    }
    return app
  }

  const jogarNaLixeira = (evento) => {
    moverParaLixeira(evento, '2026-07-21T10:00:00.000Z')
    return loadLixeira()[0].id
  }

  it('CONSERTO: o evento restaurado da lixeira volta com R$ 10.150 de lucro, não com os R$ 54.250 crus', () => {
    const app = appDeMentira()
    const itemId = jogarNaLixeira(festaVenenosa())
    const r = restaurarEventoDaLixeira(itemId, () => app.store, app.aplicar)
    expect(r.ok).toBe(true)

    const naLista = app.store.eventos.find((e) => e.id === 'evento-sintetico-1')
    expect(Math.round(computeCenario(naLista, 'pessimista').lucro)).toBe(10150)
    // e o que estava guardado continua acessível como foi salvo, para a tela
    // poder mostrar o antes ao lado do depois
    expect(computeCenario(r.eventoCru, 'pessimista').lucro).toBe(54250)
  })

  it('CONSERTO: e a lixeira também DIZ o que corrigiu, item a item', () => {
    const app = appDeMentira()
    const itemId = jogarNaLixeira(festaVenenosa())
    const r = restaurarEventoDaLixeira(itemId, () => app.store, app.aplicar)

    expect(r.revisao.precisaRevisao).toBe(true)
    expect(r.revisao.correcoes[0].oQueMudou).toContain('cenário pessimista, ajuste de custos')
    expect(r.revisao.correcoes[0].para).toBe('não informado')
    const lucro = r.revisao.efeitos[0].linhas.find((l) => l.label === 'Lucro (pessimista)')
    expect(lucro.antes).toBe(54250)
    expect(Math.round(lucro.depois)).toBe(10150)
  })

  it('CONSERTO: restaurar da lixeira COMO CÓPIA corrige igual — a terceira porta não ficou de fora', () => {
    const app = appDeMentira({
      // a gêmea viva que obriga a saída por cópia
      eventos: [{ ...festaDeTeste(), nome: 'A gêmea viva' }],
      benchmarksCustom: [],
    })
    const itemId = jogarNaLixeira(festaVenenosa())
    const r = restaurarComoCopiaDaLixeira(itemId, app.aplicar, '2026-07-25T10:00:00.000Z', 'id-copia')
    expect(r.ok).toBe(true)

    const copia = app.store.eventos.find((e) => e.id === 'id-copia')
    expect(Math.round(computeCenario(copia, 'pessimista').lucro)).toBe(10150)
    expect(r.revisao.precisaRevisao).toBe(true)
  })

  it('evento SÃO volta da lixeira sem revisão nenhuma — restaurar continua um clique só', () => {
    const app = appDeMentira()
    const itemId = jogarNaLixeira(festaDeTeste())
    const r = restaurarEventoDaLixeira(itemId, () => app.store, app.aplicar)
    expect(r.ok).toBe(true)
    expect(r.revisao.precisaRevisao).toBe(false)
    expect(r.revisao.correcoes).toEqual([])
  })
})
