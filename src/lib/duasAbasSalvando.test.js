// FRENTE 17 do MODELO-AUDITORIA — CONCORRÊNCIA ENTRE ABAS ("uma salva, a outra
// sobrescreve"). Âncora automatizada do MECANISMO; a frente continua tendo uma
// parte manual, declarada no fim deste comentário.
//
// A regra da casa aqui NÃO é "impedir": o "último a salvar vence" é ASSUMIDO
// (nada de lock, decidido no hardening 4.2). O que é obrigatório é o AVISO — a
// faixa âmbar que `multiAba.js` acende nas duas abas. Este arquivo prende as
// duas metades juntas, que é o ponto:
//   (1) a perda é REAL e mensurável (por isso o aviso é carga, não enfeite);
//   (2) na hora exata da perda, o vigia das abas estava ACESO nas duas.
// Quem tirar o aviso deixando a perda de pé quebra este arquivo.
//
// ————— O QUE ESTE ARQUIVO NÃO COBRE (declarado, princípio 4) —————
// Não há como abrir duas abas de navegador dentro do Vitest, então aqui as duas
// abas são duas LEITURAS do mesmo localStorage de mentira e dois `saveStore`
// em sequência — fiel ao mecanismo do `storage.js` (grava o store INTEIRO numa
// chave só), e nada além disso. Especificamente, ESTE ARQUIVO NÃO PROVA:
//   • que a faixa âmbar aparece NA TELA de uma segunda aba de verdade (a lição
//     do H3-AUDIT foi essa: conferir a TELA, não só o dado salvo). O fio
//     App → faixa está em App.fio.test.jsx; a aba de verdade segue MANUAL, na
//     cópia de teste, e continua no MODELO-AUDITORIA como passo ao vivo;
//   • o TEMPO real (o auto-save do App dispara por efeito de React; aqui as
//     gravações são síncronas e ordenadas de propósito);
//   • BroadcastChannel de verdade entre processos — o canal é injetado.
// Um teste que fingisse cobrir isso seria pior que teste nenhum.
//
// SE UM DIA HOUVER TRAVA DURA (bloquear o save da aba velha), este arquivo tem
// de ser REESCRITO junto: os testes de "a perda é real" afirmam a decisão de
// hoje (avisar, não impedir), e a trava nova é que passa a precisar de teste
// que morda. Ver a frente 17 do MODELO-AUDITORIA.
//
// Fixtures sintéticos ("Festa da Aba A" / "Festa da Aba B") — nenhum dado real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadStore, saveStore, liberarGravacao } from './storage.js'
import { vigiarOutrasAbas } from './multiAba.js'
import { novoEvento } from './defaults.js'

// localStorage de mentira compartilhado pelas "duas abas" — mesma superfície
// que o storage.js usa. Os dados REAIS do Marco nunca entram aqui.
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

// Canal de mentira no formato do BroadcastChannel: todas as instâncias criadas
// com o mesmo nome falam entre si. Mesmo truque de multiAba.test.js.
function fabricaDeCanais() {
  const porNome = new Map()
  return (nome) => {
    const turma = porNome.get(nome) || new Set()
    porNome.set(nome, turma)
    const canal = {
      onmessage: null,
      postMessage: (data) => {
        for (const outro of turma) if (outro !== canal && outro.onmessage) outro.onmessage({ data })
      },
      close: () => turma.delete(canal),
    }
    turma.add(canal)
    return canal
  }
}

const festa = (nome, id) => ({ ...novoEvento(nome), id })

beforeEach(() => {
  vi.stubGlobal('localStorage', memoriaFalsa())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  liberarGravacao()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('duas abas salvando — a perda é REAL (é isso que faz o aviso ser carga)', () => {
  it('a aba B, com estado velho em memória, apaga o evento que a aba A acabou de salvar', () => {
    // Estado de partida gravado: uma festa antiga, que as duas abas leem.
    saveStore({ ...loadStore(), eventos: [festa('Festa Antiga', 'ev-antiga')] })

    // As duas abas abrem e leem o MESMO conteúdo. A partir daqui cada uma tem
    // a sua cópia em memória — é exatamente o que o app faz no `useReducer`.
    const abaA = loadStore()
    const abaB = loadStore()
    expect(abaA.eventos.map((e) => e.id)).toEqual(['ev-antiga'])
    expect(abaB.eventos.map((e) => e.id)).toEqual(['ev-antiga'])

    // A aba A cria uma festa e o auto-save grava o store INTEIRO.
    saveStore({ ...abaA, eventos: [...abaA.eventos, festa('Festa da Aba A', 'ev-a')] })
    expect(loadStore().eventos.map((e) => e.id)).toEqual(['ev-antiga', 'ev-a'])

    // A aba B cria a sua festa. Ela NUNCA soube da festa da aba A: grava o
    // store inteiro que tem em memória, e a festa 'ev-a' deixa de existir.
    saveStore({ ...abaB, eventos: [...abaB.eventos, festa('Festa da Aba B', 'ev-b')] })

    const gravado = loadStore().eventos.map((e) => e.id)
    expect(gravado).toEqual(['ev-antiga', 'ev-b'])
    expect(gravado).not.toContain('ev-a') // a perda, nomeada
  })

  it('a aba A continua mostrando na tela um evento que já não existe no armazenamento', () => {
    // A outra metade do estrago, e a mais traiçoeira: depois da sobrescrita, o
    // que está em memória na aba A DIVERGE do que está gravado. Nada no app
    // escuta o evento `storage` para reconciliar — a divergência só aparece
    // quando alguém recarrega (ou quando a aba A salva de novo e devolve a
    // sobrescrita).
    saveStore({ ...loadStore(), eventos: [] })
    const abaA = loadStore()
    const abaB = loadStore()

    const memoriaDaAbaA = { ...abaA, eventos: [festa('Festa da Aba A', 'ev-a')] }
    saveStore(memoriaDaAbaA)
    saveStore({ ...abaB, eventos: [festa('Festa da Aba B', 'ev-b')] })

    expect(memoriaDaAbaA.eventos.map((e) => e.id)).toEqual(['ev-a']) // a tela
    expect(loadStore().eventos.map((e) => e.id)).toEqual(['ev-b']) // o gravado

    // E o troco: o próximo save da aba A devolve a sobrescrita na outra direção.
    saveStore(memoriaDaAbaA)
    expect(loadStore().eventos.map((e) => e.id)).toEqual(['ev-a'])
  })
})

describe('duas abas salvando — o AVISO estava aceso na hora exata da perda', () => {
  it('as duas abas se enxergam, a sobrescrita acontece, e nenhuma das duas estava sem aviso', () => {
    const criarCanal = fabricaDeCanais()
    const avisoA = []
    const avisoB = []

    saveStore({ ...loadStore(), eventos: [] })
    const abaA = loadStore()
    const pararA = vigiarOutrasAbas((ha) => avisoA.push(ha), { criarCanal, msBatida: 10_000 })

    const abaB = loadStore()
    const pararB = vigiarOutrasAbas((ha) => avisoB.push(ha), { criarCanal, msBatida: 10_000 })

    // Detecção imediata nos dois lados (o 'oi' da B e o 'estou-aqui' da A).
    expect(avisoA.at(-1)).toBe(true)
    expect(avisoB.at(-1)).toBe(true)

    // A perda acontece COM o aviso de pé — é assim que a casa aceita conviver
    // com o "último a salvar vence".
    saveStore({ ...abaA, eventos: [festa('Festa da Aba A', 'ev-a')] })
    saveStore({ ...abaB, eventos: [festa('Festa da Aba B', 'ev-b')] })
    expect(loadStore().eventos.map((e) => e.id)).toEqual(['ev-b'])
    expect(avisoA.at(-1)).toBe(true)
    expect(avisoB.at(-1)).toBe(true)

    pararA()
    pararB()
  })

  it('aba sozinha NÃO acende aviso — sobrescrever a si mesma é só salvar', () => {
    // O outro lado da moeda: alarme falso numa aba só seria ruído, e ruído
    // ensina a ignorar a faixa justamente quando ela importa.
    const criarCanal = fabricaDeCanais()
    const avisos = []
    const parar = vigiarOutrasAbas((ha) => avisos.push(ha), { criarCanal, msBatida: 10_000 })

    saveStore({ ...loadStore(), eventos: [festa('Festa Sozinha', 'ev-so')] })
    saveStore({ ...loadStore(), eventos: [festa('Festa Sozinha', 'ev-so'), festa('Outra', 'ev-2')] })

    expect(loadStore().eventos.map((e) => e.id)).toEqual(['ev-so', 'ev-2'])
    expect(avisos).toEqual([]) // nunca acendeu
    parar()
  })
})
