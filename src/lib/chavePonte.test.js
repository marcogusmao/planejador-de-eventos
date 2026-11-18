// Testes da chave da ponte (hardening 2 — H2-B, Marco 18/07/2026): o token
// que o Financeiro exige em toda mutação. Cobrem a normalização do que foi
// colado (o caso comum é colar o arquivo inteiro, com \n no fim), o ciclo
// salvar → ler → remover no localStorage, e as garantias de ambiente sem
// localStorage (nunca lança — padrão de protecao.js).

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  HEADER_PONTE,
  normalizarChave,
  loadChavePonte,
  saveChavePonte,
} from './chavePonte.js'

const stubLocalStorage = () => {
  const memoria = {}
  vi.stubGlobal('localStorage', {
    getItem: (k) => (k in memoria ? memoria[k] : null),
    setItem: (k, v) => {
      memoria[k] = String(v)
    },
    removeItem: (k) => {
      delete memoria[k]
    },
  })
  return memoria
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizarChave', () => {
  it('tira espaços e quebras de linha das pontas (colar o arquivo inteiro)', () => {
    expect(normalizarChave('  abc123  \n')).toBe('abc123')
    expect(normalizarChave('abc123\n')).toBe('abc123')
  })
  it('vazio, null e undefined viram string vazia', () => {
    expect(normalizarChave('')).toBe('')
    expect(normalizarChave('   \n ')).toBe('')
    expect(normalizarChave(null)).toBe('')
    expect(normalizarChave(undefined)).toBe('')
  })
})

describe('saveChavePonte / loadChavePonte', () => {
  it('salvar → ler devolve a chave normalizada', () => {
    stubLocalStorage()
    expect(saveChavePonte(' minha-chave-forte \n')).toBe('minha-chave-forte')
    expect(loadChavePonte()).toBe('minha-chave-forte')
  })

  it('salvar vazio remove a chave (jeito explícito de esquecer)', () => {
    const memoria = stubLocalStorage()
    saveChavePonte('minha-chave')
    expect(saveChavePonte('   ')).toBe('')
    expect(loadChavePonte()).toBe('')
    expect(Object.keys(memoria)).toHaveLength(0)
  })

  // Os dois testes abaixo DECLARAM o ambiente em vez de depender do que o Node
  // da máquina oferece (Marco, 24/07/2026 — achado S2 do BACKLOG). Antes daqui,
  // este bloco não fazia stub nenhum e confiava no comentário "localStorage é
  // undefined no node": isso era verdade no Node 20 (o do CI) e FALSO no
  // Node 22+ (o da máquina do Marco), que expõe um localStorage cujo getItem
  // não é função. O teste passava na máquina por um caminho DIFERENTE do que
  // dizia cobrir (o catch, não a guarda) e falhava no CI. Agora cada caso é
  // explícito e o resultado não depende da versão do Node.
  it('sem localStorage nenhum → devolve vazio, nunca lança e NÃO polui o console', () => {
    vi.stubGlobal('localStorage', undefined)
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(loadChavePonte()).toBe('')
    expect(saveChavePonte('abc')).toBe('abc') // devolve o normalizado mesmo sem guardar
    // Ambiente sem armazenamento NÃO é erro: a guarda sai antes, sem logar.
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('localStorage meio-inicializado (global existe, getItem não é função) → mesmo resultado', () => {
    // É exatamente o que o Node 22+ entrega sem arquivo de apoio válido, e o
    // que um perfil de navegador com armazenamento desligado pode entregar.
    vi.stubGlobal('localStorage', {})
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(loadChavePonte()).toBe('')
    expect(saveChavePonte('abc')).toBe('abc')
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('localStorage que lança (quota/perfil corrompido) → nunca lança', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('quota')
      },
    })
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(loadChavePonte()).toBe('')
    expect(saveChavePonte('abc')).toBe('abc')
    silencio.mockRestore()
  })
})

describe('contrato do cabeçalho', () => {
  it('o nome do cabeçalho é o mesmo que o Financeiro exige', () => {
    expect(HEADER_PONTE).toBe('X-Ponte-Token')
  })
})
