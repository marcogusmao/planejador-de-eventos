// A TRANSAÇÃO INTEIRA: lixeira + store + pilha de desfazer, juntas.
//
// (Verificação adversarial 19/07/2026 — achados S1-A e S1-B, os dois com
// perda de dado do Marco.) Estes testes montam o ciclo de verdade — mesmo
// localStorage, mesmo reducer de histórico, mesmos updaters da UI — e cobram
// a regra nova: um passo de desfazer cobre a transação inteira, ou não existe.
//
// O que cada bloco prova, na ordem em que os achados chegaram:
//   S1-A  restaurar da lixeira + Cmd+Z NÃO some com a previsão (ela existe em
//         algum lugar depois — este é o teste que era vermelho e perdia dado);
//   S1-B  excluir + Cmd+Z não deixa DUAS verdades para a mesma previsão, e o
//         id colidente não consome mais a cópia da lixeira em silêncio.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  excluirEventoParaLixeira,
  restaurarEventoDaLixeira,
  restaurarComoCopiaDaLixeira,
  loadLixeira,
  semOEvento,
  comOEvento,
} from './protecao.js'
import {
  estadoInicial,
  reduzirComHistorico,
  podeDesfazer,
  textoDesfazer,
} from './historico.js'

// localStorage de memória — o mesmo truque de chavePonte.test.js/benchmarks.
function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  }
}

const eventoBrisa = () => ({
  id: 'ev-brisa',
  nome: 'Brisa 14/03',
  lotes: [{ id: 'l1', nome: '1º lote', preco: 80, quantidade: 300 }],
  categorias: [],
})

const storeCom = (...eventos) => ({
  eventos,
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: { porTipo: {} },
})

// Mini-app: segura o par { store, hist } e expõe as MESMAS portas do App.jsx.
// `aplicar` é a porta 'foraDoHistorico'; `editar` é o setStore normal.
function appDeMentira(store) {
  let estado = estadoInicial(store)
  return {
    get store() {
      return estado.store
    },
    get hist() {
      return estado.hist
    },
    aplicar: (fn, motivo) => {
      estado = reduzirComHistorico(estado, { tipo: 'foraDoHistorico', fn, motivo })
    },
    editar: (fn, rotulo) => {
      estado = reduzirComHistorico(estado, { tipo: 'alterar', fn, descritor: { rotulo }, em: 1 })
    },
    desfazer: () => {
      estado = reduzirComHistorico(estado, { tipo: 'desfazer' })
    },
    refazer: () => {
      estado = reduzirComHistorico(estado, { tipo: 'refazer' })
    },
  }
}

const temNoStore = (app, id) => app.store.eventos.some((e) => e.id === id)
const temNaLixeira = (id) => loadLixeira().some((i) => i.evento?.id === id)

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
})

describe('S1-A — restaurar da lixeira e desfazer não pode perder a previsão', () => {
  it('o ciclo inteiro: excluir → restaurar → Cmd+Z → a previsão CONTINUA existindo', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    expect(temNoStore(app, 'ev-brisa')).toBe(false)
    expect(temNaLixeira('ev-brisa')).toBe(true)

    const item = loadLixeira()[0]
    const r = restaurarEventoDaLixeira(item.id, app.store, app.aplicar)
    expect(r.ok).toBe(true)
    expect(temNoStore(app, 'ev-brisa')).toBe(true)
    expect(temNaLixeira('ev-brisa')).toBe(false)

    // O repro do achado: apertar Cmd+Z logo depois de restaurar. Antes, o
    // store voltava para "sem a previsão" e a lixeira já tinha soltado a
    // cópia — a previsão do Marco não existia em lugar NENHUM.
    app.desfazer()
    expect(temNoStore(app, 'ev-brisa') || temNaLixeira('ev-brisa')).toBe(true)
    // e, no desenho escolhido, ela fica onde o Marco acabou de pedir: na lista
    expect(temNoStore(app, 'ev-brisa')).toBe(true)
  })

  it('restaurar não cria passo de desfazer (a ação não promete o que não cumpre)', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    const item = loadLixeira()[0]
    restaurarEventoDaLixeira(item.id, app.store, app.aplicar)
    expect(podeDesfazer(app.hist)).toBe(false)
  })

  // O caminho que derrubou a alternativa "reconciliar a pilha em vez de zerar":
  // com a pilha preservada, o passo "mudar Nome" sobrevivia à ida e volta pela
  // lixeira prometendo um nome que a cópia restaurada já não tinha.
  it('depois da ida e volta pela lixeira, a pilha não guarda passo que mente', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    app.editar(
      (s) => ({ ...s, eventos: s.eventos.map((e) => ({ ...e, nome: 'Brisa 14/03 (rev)' })) }),
      'mudar Nome'
    )
    excluirEventoParaLixeira(app.store.eventos[0], app.aplicar)
    const item = loadLixeira()[0]
    restaurarEventoDaLixeira(item.id, app.store, app.aplicar)

    expect(podeDesfazer(app.hist)).toBe(false)
    expect(textoDesfazer(app.hist)).toMatch(/o histórico recomeçou depois de/i)
    expect(textoDesfazer(app.hist)).toMatch(/Proteção de dados/)
    // e o dado, que é o que importa, está inteiro e num lugar só
    expect(app.store.eventos.filter((e) => e.id === 'ev-brisa')).toHaveLength(1)
    expect(app.store.eventos[0].nome).toBe('Brisa 14/03 (rev)')
    expect(temNaLixeira('ev-brisa')).toBe(false)
  })
})

describe('S1-B — excluir não pode deixar duas verdades', () => {
  it('excluir → Cmd+Z: a previsão NÃO volta à lista com a cópia ainda na lixeira', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    app.editar((s) => ({ ...s, ajustes: { porTipo: { a: 1 } } }), 'mudar Ajustes')
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)

    app.desfazer() // não há mais o que desfazer — e é isso que se prova
    const naLista = temNoStore(app, 'ev-brisa')
    const naLixeira = temNaLixeira('ev-brisa')
    expect(naLista && naLixeira).toBe(false) // nunca as duas
    expect(naLista || naLixeira).toBe(true) // e nunca nenhuma
    expect(naLixeira).toBe(true)
  })

  it('excluir não cria passo de desfazer — quem desfaz é a lixeira', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    expect(podeDesfazer(app.hist)).toBe(false)
  })

  it('desfazer e refazer em sequência não duplicam nem somem com a previsão', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    app.editar((s) => ({ ...s, ajustes: { porTipo: { a: 1 } } }), 'mudar Ajustes')
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    app.desfazer()
    app.refazer()
    expect(temNoStore(app, 'ev-brisa')).toBe(false)
    expect(temNaLixeira('ev-brisa')).toBe(true)
  })

  it('id colidente: AVISA na tela e NÃO consome a cópia da lixeira', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    const item = loadLixeira()[0]
    // O fantasma do achado: a previsão voltou à lista por outro caminho
    // (importação de backup, outra aba) e a cópia ainda está na lixeira.
    app.aplicar(comOEvento(eventoBrisa()))

    const r = restaurarEventoDaLixeira(item.id, app.store, app.aplicar)
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/já existe um evento/i)
    expect(r.erro).toMatch(/nada foi perdido/i)
    // o dado continua lá: a lixeira não foi consumida em silêncio
    expect(temNaLixeira('ev-brisa')).toBe(true)
  })

  // Pego AO VIVO, não na leitura: o "Restaurar" do toast recusava restaurar
  // toda vez. O callback do toast nasce no render em que a previsão AINDA
  // estava na lista, então um store capturado por valor faz a checagem de
  // colisão ver a previsão que acabou de sair — e o botão recusa a própria
  // restauração que ele promete. Por isso o store entra como LEITOR.
  it('o Restaurar do toast lê o store de AGORA, não o de quando o toast nasceu', () => {
    const app = appDeMentira(storeCom(eventoBrisa()))
    const storeDeAntes = app.store // o que o callback do toast teria capturado
    excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    const item = loadLixeira()[0]

    // por VALOR (o jeito errado): o store de antes ainda tem a previsão
    const errado = restaurarEventoDaLixeira(item.id, storeDeAntes, app.aplicar)
    expect(errado.ok).toBe(false)
    expect(errado.erro).toMatch(/já existe um evento/i)

    // por LEITOR (o jeito certo): lê o store de agora e restaura
    const certo = restaurarEventoDaLixeira(item.id, () => app.store, app.aplicar)
    expect(certo.ok).toBe(true)
    expect(temNoStore(app, 'ev-brisa')).toBe(true)
    expect(temNaLixeira('ev-brisa')).toBe(false)
  })

  it('item que não está mais na lixeira avisa em português, sem quebrar', () => {
    const app = appDeMentira(storeCom())
    const r = restaurarEventoDaLixeira('id-que-nao-existe', app.store, app.aplicar)
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/não está mais na lixeira/i)
  })

  it('lixeira cheia (quota): NADA é excluído e o motivo volta escrito', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    })
    // E3 (auditoria externa 22/07/2026): o catch de saveLixeira loga em
    // português — capturamos e ASSERTAMOS a mensagem em vez de deixar vazar
    // no output da suíte (que é o esperado aqui: a quota estourando de propósito).
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appDeMentira(storeCom(eventoBrisa()))
    const r = excluirEventoParaLixeira(eventoBrisa(), app.aplicar)
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/NÃO foi excluído/)
    expect(temNoStore(app, 'ev-brisa')).toBe(true) // store intacto
    expect(espiaErro).toHaveBeenCalledWith('Erro ao salvar a lixeira', expect.any(Error))
    // Contagem fechada (lente adversarial 22/07): sem ela, um console.error
    // EXTRA e inesperado neste mesmo fluxo passaria batido pelo spy.
    expect(espiaErro).toHaveBeenCalledTimes(1)
    espiaErro.mockRestore()
  })
})

describe('updaters guardados (usados também na reconciliação da pilha)', () => {
  it('semOEvento devolve o MESMO store quando a previsão não está lá', () => {
    const s = storeCom()
    expect(semOEvento('ev-brisa')(s)).toBe(s)
  })

  it('comOEvento devolve o MESMO store quando a previsão já está lá', () => {
    const s = storeCom(eventoBrisa())
    expect(comOEvento(eventoBrisa())(s)).toBe(s)
  })
})

describe('Parte 2 do fechamento — evento FECHADO na lixeira (achado adversarial 20/07/2026)', () => {
  const eventoFechadoBrisa = () => ({
    ...eventoBrisa(),
    status: 'fechado',
    fechamento: {
      em: '2026-07-20T21:00:00.000Z',
      foto: { resultado: { resultado: 43000 } },
      benchmarkId: 'bm-99',
    },
  })

  it('restaurar NORMAL preserva o fechamento — é o mesmo evento voltando', () => {
    const app = appDeMentira(storeCom())
    excluirEventoParaLixeira(eventoFechadoBrisa(), app.aplicar)
    const item = loadLixeira()[0]
    const r = restaurarEventoDaLixeira(item.id, () => app.store, app.aplicar)
    expect(r.ok).toBe(true)
    const devolvido = app.store.eventos.find((e) => e.id === 'ev-brisa')
    expect(devolvido.status).toBe('fechado')
    expect(devolvido.fechamento.benchmarkId).toBe('bm-99')
  })

  it('restaurar COMO CÓPIA nasce ABERTA e sem foto — senão a cópia carrega a trava e o benchmarkId clonado, e reabrir a cópia apagaria o benchmark do ORIGINAL', () => {
    const app = appDeMentira(storeCom(eventoFechadoBrisa()))
    excluirEventoParaLixeira(eventoFechadoBrisa(), app.aplicar)
    const item = loadLixeira()[0]
    const r = restaurarComoCopiaDaLixeira(item.id, app.aplicar, '2026-07-21T10:00:00.000Z', 'id-novo')
    expect(r.ok).toBe(true)
    const copia = app.store.eventos.find((e) => e.id === 'id-novo')
    expect(copia).toBeTruthy()
    expect(copia.status).toBe('aberto')
    expect(copia.fechamento).toBeNull()
  })
})
