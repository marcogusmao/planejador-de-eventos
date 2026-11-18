import { describe, it, expect, afterEach } from 'vitest'
import {
  LIMITE_PADRAO,
  JANELA_AGRUPAMENTO_MS,
  ROTULO_GENERICO,
  historicoVazio,
  podeDesfazer,
  podeRefazer,
  textoDesfazer,
  textoRefazer,
  registrar,
  desfazer,
  refazer,
  estadoInicial,
  reduzirComHistorico,
  definirModoEstrito,
  modoEstritoLigado,
  congelarProfundo,
} from './historico.js'
import { descritorDeCampo } from './descritorEdicao.js'

// Store de mentira com a mesma FORMA do de verdade (eventos + benchmarks +
// ajustes aninhados): o que interessa aqui é provar que o estado volta
// IGUALZINHO, profundo, não que a conta bate — desfazer não recalcula nada.
const storeBase = () => ({
  eventos: [
    {
      id: 'ev1',
      nome: 'Brisa 14/03',
      lotes: [{ id: 'l1', nome: '1º lote', preco: 80, quantidade: 300 }],
      categorias: [{ id: 'c1', nome: 'Estrutura', itens: [{ id: 'i1', valor: 12000 }] }],
      cenariosConfig: { realista: { vendaPct: 85 } },
    },
  ],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: { porTipo: {} },
})

// Aplica um updater imutável (como o app inteiro faz) e devolve o store novo.
const mudarPreco = (s, v) => ({
  ...s,
  eventos: s.eventos.map((e) => ({
    ...e,
    lotes: e.lotes.map((l) => (l.id === 'l1' ? { ...l, preco: v } : l)),
  })),
})

const alterar = (estado, fn, descritor, em) =>
  reduzirComHistorico(estado, { tipo: 'alterar', fn, descritor, em })

describe('pilha de desfazer — o básico', () => {
  it('histórico novo não tem o que desfazer nem refazer', () => {
    const h = historicoVazio()
    expect(podeDesfazer(h)).toBe(false)
    expect(podeRefazer(h)).toBe(false)
    expect(textoDesfazer(h)).toBe('Nada para desfazer')
    expect(textoRefazer(h)).toBe('Nada para refazer')
  })

  it('desfazer com pilha vazia é no-op seguro (mesmo estado, mesmo histórico)', () => {
    const h = historicoVazio()
    const store = storeBase()
    const r = desfazer(h, store)
    expect(r.mudou).toBe(false)
    expect(r.estado).toBe(store)
    expect(r.hist).toBe(h)
  })

  it('refazer com ramo vazio é no-op seguro', () => {
    const h = historicoVazio()
    const store = storeBase()
    const r = refazer(h, store)
    expect(r.mudou).toBe(false)
    expect(r.estado).toBe(store)
    expect(r.hist).toBe(h)
  })

  it('reducer: desfazer/refazer no vazio devolvem o MESMO objeto de estado', () => {
    const e0 = estadoInicial(storeBase())
    expect(reduzirComHistorico(e0, { tipo: 'desfazer' })).toBe(e0)
    expect(reduzirComHistorico(e0, { tipo: 'refazer' })).toBe(e0)
  })
})

describe('desfazer restaura o estado anterior EXATAMENTE', () => {
  it('um passo: o store volta profundamente igual ao de antes', () => {
    const antes = storeBase()
    const e0 = estadoInicial(antes)
    const fotoAntes = structuredClone(antes)

    const e1 = alterar(e0, (s) => mudarPreco(s, 120), { rotulo: 'mudar Preço' }, 1000)
    expect(e1.store.eventos[0].lotes[0].preco).toBe(120)

    const e2 = reduzirComHistorico(e1, { tipo: 'desfazer' })
    expect(e2.store).toEqual(fotoAntes)
    expect(e2.store).toEqual(antes)
    // e é literalmente o objeto que existiu antes — nada foi recalculado
    expect(e2.store).toBe(antes)
  })

  it('vários passos voltam um a um, na ordem inversa', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    e = alterar(e, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1000)
    const s1 = e.store
    e = alterar(
      e,
      (s) => ({ ...s, eventos: s.eventos.map((ev) => ({ ...ev, nome: 'Brisa 15/03' })) }),
      { rotulo: 'mudar Nome' },
      5000
    )
    const s2 = e.store

    expect(s2.eventos[0].nome).toBe('Brisa 15/03')
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s1)
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s0)
    expect(podeDesfazer(e.hist)).toBe(false)
  })

  it('desfazer não toca em nada aninhado que não mudou (mesma referência dos ramos intactos)', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    e = alterar(e, (s) => mudarPreco(s, 200), { rotulo: 'mudar Preço' }, 1000)
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store.eventos[0].categorias).toBe(s0.eventos[0].categorias)
  })
})

describe('refazer volta ao estado posterior EXATAMENTE', () => {
  it('desfazer → refazer devolve o store de depois, profundamente igual', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    e = alterar(e, (s) => mudarPreco(s, 150), { rotulo: 'mudar Preço' }, 1000)
    const depois = structuredClone(e.store)

    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s0)

    e = reduzirComHistorico(e, { tipo: 'refazer' })
    expect(e.store).toEqual(depois)
    expect(e.store.eventos[0].lotes[0].preco).toBe(150)
    expect(podeRefazer(e.hist)).toBe(false)
    expect(podeDesfazer(e.hist)).toBe(true)
  })

  it('desfazer tudo e refazer tudo fecha o ciclo nos dois sentidos', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    e = alterar(e, (s) => mudarPreco(s, 10), { rotulo: 'a' }, 1000)
    const s1 = structuredClone(e.store)
    e = alterar(e, (s) => mudarPreco(s, 20), { rotulo: 'b' }, 5000)
    const s2 = structuredClone(e.store)

    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s0)
    e = reduzirComHistorico(e, { tipo: 'refazer' })
    expect(e.store).toEqual(s1)
    e = reduzirComHistorico(e, { tipo: 'refazer' })
    expect(e.store).toEqual(s2)
  })
})

describe('edição nova depois de desfazer descarta o ramo de refazer', () => {
  it('comportamento clássico: o futuro que deixou de existir some', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    e = alterar(e, (s) => mudarPreco(s, 100), { rotulo: 'mudar Preço' }, 1000)
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(podeRefazer(e.hist)).toBe(true)

    e = alterar(e, (s) => mudarPreco(s, 999), { rotulo: 'mudar Preço' }, 9000)
    expect(podeRefazer(e.hist)).toBe(false)
    expect(textoRefazer(e.hist)).toBe('Nada para refazer')

    // e o desfazer continua funcionando para o caminho novo
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s0)
  })
})

describe('digitação contínua no mesmo campo vira UM passo', () => {
  const campoPreco = { campo: 'preco' } // identidade do grupo (no app, o elemento em foco)

  it('quatro teclas dentro da janela = um passo só, e ele volta ao valor original', () => {
    const s0 = storeBase()
    let e = estadoInicial(s0)
    // digitando "1500": 1 → 15 → 150 → 1500
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'mudar Preço', grupo: campoPreco }, 1000)
    e = alterar(e, (s) => mudarPreco(s, 15), { rotulo: 'mudar Preço', grupo: campoPreco }, 1200)
    e = alterar(e, (s) => mudarPreco(s, 150), { rotulo: 'mudar Preço', grupo: campoPreco }, 1400)
    e = alterar(e, (s) => mudarPreco(s, 1500), { rotulo: 'mudar Preço', grupo: campoPreco }, 1600)

    expect(e.hist.passado).toHaveLength(1)
    expect(e.store.eventos[0].lotes[0].preco).toBe(1500)

    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(e.store).toEqual(s0)
    expect(e.store.eventos[0].lotes[0].preco).toBe(80)
  })

  it('a janela é ROLANTE: digitar devagar (mas sem parar) continua um passo', () => {
    let e = estadoInicial(storeBase())
    let t = 0
    for (let i = 1; i <= 10; i++) {
      t += JANELA_AGRUPAMENTO_MS - 50
      e = alterar(e, (s) => mudarPreco(s, i), { rotulo: 'mudar Preço', grupo: campoPreco }, t)
    }
    expect(e.hist.passado).toHaveLength(1)
  })

  it('pausa maior que a janela abre um passo novo', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'mudar Preço', grupo: campoPreco }, 1000)
    e = alterar(
      e,
      (s) => mudarPreco(s, 2),
      { rotulo: 'mudar Preço', grupo: campoPreco },
      1000 + JANELA_AGRUPAMENTO_MS + 1
    )
    expect(e.hist.passado).toHaveLength(2)
  })

  it('campos DIFERENTES nunca se misturam, mesmo com o mesmo rótulo e no mesmo instante', () => {
    const outroCampo = { campo: 'preco-do-lote-2' }
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'mudar Preço', grupo: campoPreco }, 1000)
    e = alterar(e, (s) => mudarPreco(s, 2), { rotulo: 'mudar Preço', grupo: outroCampo }, 1010)
    expect(e.hist.passado).toHaveLength(2)
  })

  it('ação discreta (grupo nulo) nunca agrupa, nem em rajada', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'apagar item de custo' }, 1000)
    e = alterar(e, (s) => mudarPreco(s, 2), { rotulo: 'apagar item de custo' }, 1005)
    expect(e.hist.passado).toHaveLength(2)
  })

  it('agrupou, mas o rótulo continua o do passo (o botão fala do campo certo)', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'mudar Preço', grupo: campoPreco }, 1000)
    e = alterar(e, (s) => mudarPreco(s, 12), { rotulo: 'mudar Preço', grupo: campoPreco }, 1100)
    expect(textoDesfazer(e.hist)).toBe('Desfazer: mudar Preço')
  })
})

describe('a pilha respeita o limite', () => {
  it('passando do limite, o passo MAIS ANTIGO cai fora', () => {
    const limite = 5
    const s0 = storeBase()
    let e = estadoInicial(s0)
    for (let i = 1; i <= 8; i++) {
      e = reduzirComHistorico(e, {
        tipo: 'alterar',
        fn: (s) => mudarPreco(s, i),
        descritor: { rotulo: `passo ${i}` },
        em: i * 10000,
        limite,
      })
    }
    expect(e.hist.passado).toHaveLength(limite)
    // o topo é o passo mais recente...
    expect(e.hist.passado[0].rotulo).toBe('passo 8')
    // ...e o fundo já não é mais o estado original: os três primeiros caíram
    expect(e.hist.passado[limite - 1].rotulo).toBe('passo 4')
    expect(e.hist.passado[limite - 1].estado.eventos[0].lotes[0].preco).toBe(3)

    // desfazendo tudo, para no passo mais antigo que ainda existe (não volta
    // ao original — e isso é honesto: aquele estado saiu da pilha)
    for (let i = 0; i < limite; i++) e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(podeDesfazer(e.hist)).toBe(false)
    expect(e.store.eventos[0].lotes[0].preco).toBe(3)
  })

  it('o limite padrão é 50', () => {
    expect(LIMITE_PADRAO).toBe(50)
    let e = estadoInicial(storeBase())
    for (let i = 1; i <= 60; i++) {
      e = alterar(e, (s) => mudarPreco(s, i), { rotulo: `p${i}` }, i * 10000)
    }
    expect(e.hist.passado).toHaveLength(50)
  })
})

describe('o que o botão diz', () => {
  it('nomeia a ação que vai desfazer', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'apagar item de custo' }, 1000)
    expect(textoDesfazer(e.hist)).toBe('Desfazer: apagar item de custo')
  })

  it('sem rótulo honesto, cai no genérico — nunca num rótulo errado', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), {}, 1000)
    expect(textoDesfazer(e.hist)).toBe(`Desfazer: ${ROTULO_GENERICO}`)
  })

  it('o refazer herda o rótulo da ação desfeita', () => {
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 1), { rotulo: 'mudar margem alvo' }, 1000)
    e = reduzirComHistorico(e, { tipo: 'desfazer' })
    expect(textoRefazer(e.hist)).toBe('Refazer: mudar margem alvo')
    expect(textoDesfazer(e.hist)).toBe('Nada para desfazer')
  })
})

describe('robustez do reducer', () => {
  it('updater que não muda nada não vira passo', () => {
    const e0 = estadoInicial(storeBase())
    const e1 = alterar(e0, (s) => s, { rotulo: 'nada' }, 1000)
    expect(e1).toBe(e0)
    expect(podeDesfazer(e1.hist)).toBe(false)
  })

  // O modo estrito do React roda o reducer DUAS VEZES sobre o MESMO estado de
  // entrada e fica com um dos resultados. A garantia que importa é pureza: as
  // duas rodadas dão o mesmo resultado, então nenhum passo fantasma aparece.
  // (Era exatamente isto que o "empilhar por fora do setStore" não dava — a
  // razão de este módulo ser um reducer.)
  it('reducer é puro: rodar a mesma ação duas vezes sobre o mesmo estado dá o mesmo resultado', () => {
    const e0 = estadoInicial(storeBase())
    const acao = {
      tipo: 'alterar',
      fn: (s) => mudarPreco(s, 42),
      descritor: { rotulo: 'mudar Preço' },
      em: 1000,
    }
    const a = reduzirComHistorico(e0, acao)
    const b = reduzirComHistorico(e0, acao)
    expect(a.hist.passado).toHaveLength(1)
    expect(b.hist.passado).toHaveLength(1)
    expect(a.store).toEqual(b.store)
    expect(a.hist.passado[0].estado).toBe(b.hist.passado[0].estado)
    expect(a.store.eventos[0].lotes[0].preco).toBe(42)
    // e o estado de entrada não foi mutado por nenhuma das rodadas
    expect(e0.store.eventos[0].lotes[0].preco).toBe(80)
    expect(e0.hist.passado).toHaveLength(0)
  })

  it('ação desconhecida não mexe em nada', () => {
    const e0 = estadoInicial(storeBase())
    expect(reduzirComHistorico(e0, { tipo: 'inventada' })).toBe(e0)
  })

  it('registrar aceita descritor ausente sem explodir', () => {
    const h = registrar(historicoVazio(), storeBase(), undefined, 0)
    expect(h.passado).toHaveLength(1)
    expect(textoDesfazer(h)).toBe(`Desfazer: ${ROTULO_GENERICO}`)
  })
})

// ————— S2-C: um arrasto de slider é UM passo, não N —————
//
// (Verificação adversarial 19/07/2026.) Fora do modo Simular, os sliders de
// cenário escrevem direto no store, e cada tique do <input type="range"> vinha
// com `grupo: null` — ação discreta, passo próprio. Um arrasto de ponta a
// ponta gerava dezenas de passos, estourava o limite de 50 e o desfazer
// deixava de alcançar as ações reais da sessão.
describe('arrasto contínuo de slider (S2-C)', () => {
  // O descritor sai da função DE VERDADE (descritorEdicao.js), não de um
  // objeto escrito à mão: é ela que decidia `grupo: null` para o range e fazia
  // cada tique virar um passo. Assim o teste cobre a corrente inteira.
  const descritorDoSlider = (el) =>
    descritorDeCampo({ tag: 'INPUT', tipo: 'range', elemento: el, rotulo: 'Ingressos vendidos' })

  const arrastar = (estado, el, de, ate, tPorTique = 16) => {
    let e = estado
    for (let i = 0, v = de; v <= ate; v++, i++) {
      e = alterar(
        e,
        (s) => ({
          ...s,
          eventos: s.eventos.map((ev) => ({
            ...ev,
            cenariosConfig: { ...ev.cenariosConfig, realista: { vendaPct: v } },
          })),
        }),
        descritorDoSlider(el),
        1000 + i * tPorTique
      )
    }
    return e
  }

  it('arrastar de ponta a ponta (0 → 100) gera 1 passo, não 101', () => {
    const el = {} // identidade estável, como o nó do DOM do slider
    const e0 = estadoInicial(storeBase())
    const e1 = arrastar(e0, el, 0, 100)

    expect(e1.store.eventos[0].cenariosConfig.realista.vendaPct).toBe(100)
    expect(e1.hist.passado).toHaveLength(1)
    expect(textoDesfazer(e1.hist)).toBe('Desfazer: mudar Ingressos vendidos')
  })

  it('e esse 1 passo volta ao valor de ANTES do arrasto (não ao penúltimo tique)', () => {
    const el = {}
    const e0 = estadoInicial(storeBase())
    const e1 = arrastar(e0, el, 0, 100)
    const e2 = reduzirComHistorico(e1, { tipo: 'desfazer' })
    expect(e2.store.eventos[0].cenariosConfig.realista.vendaPct).toBe(85)
  })

  it('o arrasto NÃO engole a pilha: o que veio antes continua alcançável', () => {
    const el = {}
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1)
    e = arrastar(e, el, 0, 100)

    expect(e.hist.passado).toHaveLength(2) // o preço + o arrasto inteiro
    e = reduzirComHistorico(e, { tipo: 'desfazer' }) // desfaz o arrasto
    e = reduzirComHistorico(e, { tipo: 'desfazer' }) // alcança o preço
    expect(e.store.eventos[0].lotes[0].preco).toBe(80)
  })

  it('dois arrastos separados por uma pausa humana são DOIS passos', () => {
    const el = {}
    let e = estadoInicial(storeBase())
    e = arrastar(e, el, 0, 10)
    // parou, pensou, voltou: passada a janela de agrupamento, passo novo
    e = alterar(e, (s) => mudarPreco(s, 77), descritorDoSlider(el), 99999)
    expect(e.hist.passado).toHaveLength(2)
  })

  it('sliders DIFERENTES nunca caem no mesmo passo, mesmo em sequência rápida', () => {
    const pessimista = {}
    const otimista = {}
    let e = estadoInicial(storeBase())
    e = arrastar(e, pessimista, 0, 5)
    e = arrastar(e, otimista, 0, 5)
    expect(e.hist.passado).toHaveLength(2)
  })
})

// ————— S3-E: a fidelidade do passado, verificável —————
//
// `registrar` guarda a REFERÊNCIA do store anterior. Isso só é correto porque
// todo updater do app copia em vez de mutar — e, até aqui, isso era convenção
// sem verificação: um updater desatento contaminaria o passado em silêncio e o
// desfazer devolveria um estado que nunca existiu.
describe('modo estrito — mutação acidental não contamina o passado (S3-E)', () => {
  afterEach(() => definirModoEstrito(false))

  it('o updater IMUTÁVEL de sempre continua passando (nada quebra no caminho certo)', () => {
    definirModoEstrito(true)
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1)
    e = alterar(e, (s) => mudarPreco(s, 95), { rotulo: 'mudar Preço' }, 99999)
    expect(e.store.eventos[0].lotes[0].preco).toBe(95)
    expect(e.hist.passado).toHaveLength(2)
  })

  it('mutar em profundidade um estado já guardado LANÇA em vez de corromper', () => {
    definirModoEstrito(true)
    const e0 = estadoInicial(storeBase())
    const e1 = alterar(e0, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1)

    // O acidente que o achado descreve: alguém mexe no objeto por dentro.
    expect(() => {
      e1.hist.passado[0].estado.eventos[0].lotes[0].preco = 999
    }).toThrow()
    // e o passado continua sendo o que era: o desfazer devolve a verdade
    expect(e1.hist.passado[0].estado.eventos[0].lotes[0].preco).toBe(80)
    const e2 = reduzirComHistorico(e1, { tipo: 'desfazer' })
    expect(e2.store.eventos[0].lotes[0].preco).toBe(80)
  })

  // O vetor de verdade: um updater imutável copia o que MEXE e COMPARTILHA o
  // resto. `mudarPreco` devolve store novo e eventos novos, mas `ajustes` é o
  // MESMO objeto do estado anterior — que já está na pilha. Mutar esse pedaço
  // compartilhado é o jeito realista de contaminar o passado, e é exatamente
  // o que o congelamento pega.
  it('pega o updater que muta um pedaço COMPARTILHADO com o passado', () => {
    definirModoEstrito(true)
    let e = estadoInicial(storeBase())
    e = alterar(e, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1)
    expect(e.store.ajustes).toBe(e.hist.passado[0].estado.ajustes) // compartilhado

    expect(() =>
      alterar(
        e,
        (s) => {
          s.ajustes.porTipo.brisa = { margemAlvo: 40 } // mexe em vez de copiar
          return { ...s }
        },
        { rotulo: 'mudar Margem alvo' },
        99999
      )
    ).toThrow()
    // o passado seguiu limpo
    expect(e.hist.passado[0].estado.ajustes.porTipo).toEqual({})
  })

  it('em produção o custo é ZERO: desligado, nada é congelado', () => {
    definirModoEstrito(false)
    const e0 = estadoInicial(storeBase())
    const e1 = alterar(e0, (s) => mudarPreco(s, 90), { rotulo: 'mudar Preço' }, 1)
    expect(Object.isFrozen(e1.hist.passado[0].estado)).toBe(false)
    expect(modoEstritoLigado()).toBe(false)
  })

  it('congelar é amortizado: objeto já congelado não é percorrido de novo', () => {
    const store = storeBase()
    congelarProfundo(store)
    expect(Object.isFrozen(store.eventos[0].lotes[0])).toBe(true)
    // segunda passada devolve na hora, sem descer a árvore
    expect(congelarProfundo(store)).toBe(store)
  })
})


describe('S4 identidade transitória de carregamento',()=>{
 it('desfazer e editar/apagar original tornam toast inativo sem chamar updater ou perder futuro',()=>{
  let e=estadoInicial({v:12000}); e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:16420}),descritor:{rotulo:'carregar',carregamentoId:'op'}});
  e=reduzirComHistorico(e,{tipo:'desfazer'});e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:0})});const fn=()=>{throw new Error('toast inativo chamou updater')};expect(reduzirComHistorico(e,{tipo:'alterar',fn,descritor:{desfazerCarregamentoId:'op'}})).toBe(e);
 });
 it('refazer reativa e toast efetivo desativa; mapa nunca entra no store',()=>{let e=estadoInicial({v:12000});e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:16420}),descritor:{carregamentoId:'op'}});e=reduzirComHistorico(e,{tipo:'desfazer'});e=reduzirComHistorico(e,{tipo:'refazer'});expect(e.carregamentosAtivos?.op).toBe(true);e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:12000}),descritor:{desfazerCarregamentoId:'op'}});expect(e.carregamentosAtivos?.op).toBeUndefined();expect(e.store).toEqual({v:12000})});
})

 it('S4 ↶ de edição posterior mantém operação; foraDoHistorico limpa mapa',()=>{
  let e=estadoInicial({v:1});e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:2}),descritor:{carregamentoId:'op'}});e=reduzirComHistorico(e,{tipo:'alterar',fn:()=>({v:3})});e=reduzirComHistorico(e,{tipo:'desfazer'});expect(e.carregamentosAtivos.op).toBe(true);e=reduzirComHistorico(e,{tipo:'foraDoHistorico',fn:s=>s});expect(e.carregamentosAtivos).toEqual({});const fn=()=>{throw new Error('identidade antiga')};expect(reduzirComHistorico(e,{tipo:'alterar',fn,descritor:{desfazerCarregamentoId:'op'}})).toBe(e)
 });
 it('S4 chamada legado e entrada sem mapa equivalem a mapa vazio',()=>{const e={store:{v:2},hist:{passado:[{estado:{v:1}}],futuro:[]}};const r=reduzirComHistorico(e,{tipo:'desfazer'});expect(r.store.v).toBe(1);expect(r.carregamentosAtivos).toEqual({})});

// Exercita o protocolo do App: reducer -> updater de store -> updater do evento.
// As expectativas financeiras são os custos que as operações NÃO desfeitas
// ainda deixam na categoria, em vez de fotografias da implementação do rebase.
import { aplicarCarregar, desfazerCarregar } from './carregarBenchmark.js'

const eventoSobreposto = () => ({
  id: 'sobreposto', nome: 'Festa sintética', lotes: [{ id: 'lote', preco: 90 }],
  categorias: [
    { id: 'aeb', itens: [{ id: 'original', estimado: 12000 }] },
    { id: 'equipe', itens: [{ id: 'equipe-original', estimado: 5000 }] },
  ],
})
const alterarEventoSobreposto = (estado, fn, descritor = {}) => reduzirComHistorico(estado, {
  tipo: 'alterar', descritor,
  fn: (store, contexto) => {
    const anterior = store.eventos[0]
    if (anterior.status === 'fechado') return store
    const evento = fn(anterior, contexto)
    return evento === anterior ? store : { ...store, eventos: [evento] }
  },
})
const carregarSobreposto = (estado, id, modo = 'substituir', cats = ['aeb']) => {
  const eventoAntes = estado.store.eventos[0]
  const escolhas = cats.map(catId => ({ catId, modo, itemId: `${id}-${catId}` }))
  const custos = { aeb: { A: 16420, B: 25000, C: 30000 }[id], equipe: 7000 }
  return alterarEventoSobreposto(estado, e => aplicarCarregar(e, { nome: id, custos }, escolhas), {
    rotulo: `carregar ${id}`, carregamentoId: id, carregamento: { eventoAntes, escolhas },
  })
}
const desfazerSobreposto = (estado, id) => alterarEventoSobreposto(estado,
  (e, contexto) => desfazerCarregar(e, contexto.carregamento.eventoAntes,
    contexto.carregamento.escolhas, contexto.categoriasSubstituidasDepois),
  { rotulo: `desfazer ${id}`, desfazerCarregamentoId: id })
const itensSobrepostos = estado => estado.store.eventos[0].categorias.flatMap(c => c.itens)
const valoresAeb = estado => estado.store.eventos[0].categorias.find(c => c.id === 'aeb').itens.map(i => i.estimado)
const ordens = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']
const modos = ['somar', 'substituir']

describe('carregamentos dependentes em memória', () => {
  for (const a of modos) for (const b of modos) for (const c of modos) {
    it.each(ordens)(`${a}/${b}/${c}, desfazer %s preserva só ações restantes`, ordem => {
      let estado = estadoInicial({ eventos: [eventoSobreposto()] })
      const operacoes = [a, b, c].map((modo, i) => ({ id: 'ABC'[i], modo, valor: [16420, 25000, 30000][i] }))
      for (const op of operacoes) estado = carregarSobreposto(estado, op.id, op.modo)
      const desfeitas = new Set()
      for (const id of ordem) {
        estado = desfazerSobreposto(estado, id)
        desfeitas.add(id)
        let esperado = [12000]
        for (const op of operacoes.filter(op => !desfeitas.has(op.id))) {
          esperado = op.modo === 'substituir' ? [op.valor] : [...esperado, op.valor]
        }
        expect(valoresAeb(estado)).toEqual(esperado)
        expect(new Set(itensSobrepostos(estado).map(i => i.id)).size).toBe(itensSobrepostos(estado).length)
      }
    })
  }

  it('categorias parciais: desfazer A recupera equipe, A&B segue B, e custo posterior permanece', () => {
    let estado = estadoInicial({ eventos: [eventoSobreposto()] })
    estado = carregarSobreposto(estado, 'A', 'substituir', ['aeb', 'equipe'])
    estado = carregarSobreposto(estado, 'B')
    estado = alterarEventoSobreposto(estado, e => ({ ...e, nome: 'Editado', lotes: [{ id: 'lote', preco: 95 }], categorias: e.categorias.map(c => c.id !== 'aeb' ? c : { ...c, itens: [...c.itens, { id: 'depois', estimado: 900 }] }) }))
    estado = desfazerSobreposto(estado, 'A')
    expect(valoresAeb(estado)).toEqual([25000, 900])
    expect(itensSobrepostos(estado).find(i => i.id === 'equipe-original')?.estimado).toBe(5000)
    estado = desfazerSobreposto(estado, 'B')
    expect(valoresAeb(estado)).toEqual([12000, 900])
    expect(estado.store.eventos[0].nome).toBe('Editado')
    expect(estado.store.eventos[0].lotes[0].preco).toBe(95)
  })

  it('original editado e movido depois de somar não é substituído pela foto velha', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A', 'somar')
    estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.map(c => ({ ...c, itens: c.id === 'aeb' ? c.itens.filter(i => i.id !== 'original') : [...c.itens, { id: 'original', estimado: 13000 }] })) }))
    estado = carregarSobreposto(estado, 'B')
    estado = desfazerSobreposto(estado, 'A')
    estado = desfazerSobreposto(estado, 'B')
    expect(valoresAeb(estado)).toEqual([])
    expect(itensSobrepostos(estado).filter(i => i.id === 'original')).toEqual([{ id: 'original', estimado: 13000 }])
  })

  it('carregado movido e editado sai pelo ID; custo alheio editado permanece', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    const itemB = estado.store.eventos[0].categorias[0].itens[0]
    estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.map(c => ({ ...c, itens: c.id === 'aeb' ? [] : [{ id: 'equipe-original', estimado: 6000 }, { ...itemB, estimado: 27000 }] })) }))
    estado = desfazerSobreposto(estado, 'A')
    estado = desfazerSobreposto(estado, 'B')
    expect(valoresAeb(estado)).toEqual([12000])
    expect(itensSobrepostos(estado)).toEqual([{ id: 'original', estimado: 12000 }, { id: 'equipe-original', estimado: 6000 }])
  })

  it('remoção manual de B não desativa a operação nem faz A ressuscitar cedo', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.map(c => c.id === 'aeb' ? { ...c, itens: [] } : c) }))
    estado = desfazerSobreposto(estado, 'A')
    expect(valoresAeb(estado)).toEqual([])
    estado = desfazerSobreposto(estado, 'B')
    expect(valoresAeb(estado)).toEqual([12000])
  })

  it('categoria removida depois dos carregamentos não ressuscita', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.filter(c => c.id !== 'aeb') }))
    estado = desfazerSobreposto(estado, 'A')
    estado = desfazerSobreposto(estado, 'B')
    expect(estado.store.eventos[0].categorias.map(c => c.id)).toEqual(['equipe'])
  })

  it('↶ e refazer restauram dependências mesmo quando desfazer A não mudou store', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    const antes = estado
    estado = desfazerSobreposto(estado, 'A')
    expect(estado.store).toBe(antes.store)
    expect(estado.hist.passado).toHaveLength(3)
    const depois = estado
    estado = reduzirComHistorico(estado, { tipo: 'desfazer' })
    expect(estado.carregamentosAtivos).toBe(antes.carregamentosAtivos)
    expect(valoresAeb(desfazerSobreposto(estado, 'B'))).toEqual([16420])
    estado = reduzirComHistorico(estado, { tipo: 'refazer' })
    expect(estado.carregamentosAtivos).toBe(depois.carregamentosAtivos)
    expect(valoresAeb(desfazerSobreposto(estado, 'B'))).toEqual([12000])
    expect(desfazerSobreposto(estado, 'A')).toBe(estado)
  })

  it('↶ B, desfazer A, nova operação C e refazer indisponível não perdem o original', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    estado = reduzirComHistorico(estado, { tipo: 'desfazer' })
    estado = desfazerSobreposto(estado, 'A')
    estado = carregarSobreposto(estado, 'C')
    expect(estado.hist.futuro).toEqual([])
    expect(desfazerSobreposto(estado, 'B')).toBe(estado)
    expect(valoresAeb(desfazerSobreposto(estado, 'C'))).toEqual([12000])
  })

  it('reducer repetido é puro: fotos e escolhas congeladas, mesmo resultado sem mutação', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    congelarProfundo(estado)
    const antes = JSON.stringify(estado)
    expect(desfazerSobreposto(estado, 'A')).toEqual(desfazerSobreposto(estado, 'A'))
    expect(JSON.stringify(estado)).toBe(antes)
    expect(estado.carregamentosAtivos.B.eventoAntes.categorias[0].itens[0].estimado).toBe(16420)
  })

  it('evento fechado na fila impede também o rebase transitório', () => {
    let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A')
    estado = carregarSobreposto(estado, 'B')
    estado = alterarEventoSobreposto(estado, e => ({ ...e, status: 'fechado' }))
    expect(desfazerSobreposto(estado, 'A')).toBe(estado)
  })
})

it.each([false, true])('categoria recriada A→B, custo posterior=%s: desfazer remove só o que carregou', posterior => {
  const evento = { ...eventoSobreposto(), categorias: [] }
  let estado = carregarSobreposto(estadoInicial({ eventos: [evento] }), 'A')
  estado = carregarSobreposto(estado, 'B')
  if (posterior) estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.map(c => ({ ...c, itens: [...c.itens, { id: 'posterior', estimado: 300 }] })) }))
  estado = desfazerSobreposto(estado, 'A')
  expect(valoresAeb(estado)).toEqual(posterior ? [25000, 300] : [25000])
  estado = desfazerSobreposto(estado, 'B')
  expect(itensSobrepostos(estado)).toEqual(posterior ? [{ id: 'posterior', estimado: 300 }] : [])
  expect(estado.store.eventos[0].categorias).toHaveLength(posterior ? 1 : 0)
})


it.each([false, true])('toast sem custo nem foto a ajustar preserva futuro; sucessor não afetado=%s', sucessor => {
  let estado = carregarSobreposto(estadoInicial({ eventos: [eventoSobreposto()] }), 'A', 'somar')
  estado = alterarEventoSobreposto(estado, e => ({ ...e, categorias: e.categorias.map(c => c.id === 'aeb' ? { ...c, itens: c.itens.filter(i => i.id !== 'A-aeb') } : c) }))
  if (sucessor) estado = carregarSobreposto(estado, 'B', 'somar', ['equipe'])
  estado = alterarEventoSobreposto(estado, e => ({ ...e, nome: 'Nome posterior' }))
  estado = reduzirComHistorico(estado, { tipo: 'desfazer' })
  expect(estado.hist.futuro).toHaveLength(1)
  const antes = estado
  estado = desfazerSobreposto(estado, 'A')
  expect(estado).toBe(antes)
  expect(estado.hist.futuro).toBe(antes.hist.futuro)
  expect(valoresAeb(estado)).toEqual([12000])
  estado = reduzirComHistorico(estado, { tipo: 'refazer' })
  expect(estado.store.eventos[0].nome).toBe('Nome posterior')
})
