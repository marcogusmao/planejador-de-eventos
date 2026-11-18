// O "Sair" que não gravava backup nenhum, e não dizia (achado S3, 30/08/2026).
//
// O que era medido no App.jsx: `catch { return '' }`, sem mais nada. O lado
// Swift guarda com `!json.isEmpty`, então nada era sobrescrito — mas nenhum
// arquivo aparecia na pasta e o app da abertura seguinte estava idêntico ao de
// sempre. Não corrompe dado (S3, não S1); cala uma falha, e é o princípio 4 da
// casa que isso viola.
//
// O localStorage é dublê explícito (mesmo padrão de chavePonte.test.js): o
// ambiente destes testes é `node`, e um localStorage que "às vezes existe"
// esconderia justamente as garantias de ambiente que este módulo promete.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  conteudoDoBackupAoSair,
  falhaBackupAoSair,
  limparFalhaBackupAoSair,
  registrarFalhaBackupAoSair,
} from './backupAoSair.js'

const CHAVE = 'previsao-eventos:backup-ao-sair:falha:v1'

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
  vi.restoreAllMocks()
})

const storeFake = { eventos: [{ id: 'ev1', nome: 'Brisa' }] }
const montarOk = (s) => ({ app: 'previsao-eventos', versao: 1, eventos: s.eventos })

describe('o caminho normal do "Sair" não mudou', () => {
  it('devolve o JSON do backup e não deixa marca de falha nenhuma', () => {
    stubLocalStorage()
    const texto = conteudoDoBackupAoSair(storeFake, montarOk)
    expect(JSON.parse(texto).eventos[0].nome).toBe('Brisa')
    expect(falhaBackupAoSair()).toBeNull()
  })
})

describe('a falha continua devolvendo "" — e agora deixa rastro', () => {
  it('o contrato com o Swift NÃO muda: string vazia quer dizer "não grave nada"', () => {
    // Este é o ponto que não pode regredir nunca. Se um dia isto devolver o
    // texto de um erro, o Swift grava esse texto POR CIMA do backup bom da
    // véspera — trocaria um aviso que faltava por perda de dado.
    stubLocalStorage()
    const texto = conteudoDoBackupAoSair(storeFake, () => {
      throw new TypeError('Converting circular structure to JSON')
    })
    expect(texto).toBe('')
  })

  it('a marca guarda motivo e hora, e mora no DISCO — é o que atravessa o "Sair"', () => {
    const memoria = stubLocalStorage()
    conteudoDoBackupAoSair(storeFake, () => {
      throw new RangeError('Invalid string length')
    })
    const marca = falhaBackupAoSair()
    expect(marca.motivo).toBe('Invalid string length')
    expect(Number.isNaN(new Date(marca.em).getTime())).toBe(false)
    // no instante do "Sair" não existe tela para mostrar aviso nenhum; o único
    // canal que sobrevive é este, e a faixa aparece na abertura seguinte
    expect(memoria[CHAVE]).toBeTruthy()
  })

  it('a estrutura circular de verdade (a causa mais provável) é pega', () => {
    stubLocalStorage()
    const circular = { nome: 'Brisa' }
    circular.eu = circular
    expect(conteudoDoBackupAoSair(storeFake, () => circular)).toBe('')
    expect(falhaBackupAoSair().motivo).toMatch(/circular/i)
  })

  it('erro sem mensagem não vira marca vazia — o aviso sempre diz alguma coisa', () => {
    stubLocalStorage()
    conteudoDoBackupAoSair(storeFake, () => {
      throw new Error('')
    })
    expect(falhaBackupAoSair().motivo).toBe('Error')

    limparFalhaBackupAoSair()
    conteudoDoBackupAoSair(storeFake, () => {
      throw 'só um texto solto'
    })
    expect(falhaBackupAoSair().motivo).toBe('só um texto solto')

    limparFalhaBackupAoSair()
    conteudoDoBackupAoSair(storeFake, () => {
      throw ''
    })
    expect(falhaBackupAoSair().motivo).toBe('motivo não informado pelo navegador')
  })

  it('motivo enorme é cortado — a faixa é uma linha, não um despejo de pilha', () => {
    stubLocalStorage()
    registrarFalhaBackupAoSair(new Error('x'.repeat(5000)))
    expect(falhaBackupAoSair().motivo.length).toBeLessThanOrEqual(300)
    expect(falhaBackupAoSair().motivo.endsWith('…')).toBe(true)
  })

  it('a hora é injetável, então a marca não depende do relógio de quem roda', () => {
    stubLocalStorage()
    registrarFalhaBackupAoSair(new Error('falhou'), () => '2026-08-30T21:15:00.000Z')
    expect(falhaBackupAoSair()).toEqual({ em: '2026-08-30T21:15:00.000Z', motivo: 'falhou' })
  })
})

describe('garantias de ambiente: nunca lança, nem sem localStorage, nem com ele quebrado', () => {
  it('sem localStorage nenhum, o "Sair" ainda devolve "" e não derruba o app', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() =>
      conteudoDoBackupAoSair(storeFake, () => {
        throw new Error('falhou')
      })
    ).not.toThrow()
    expect(
      conteudoDoBackupAoSair(storeFake, () => {
        throw new Error('falhou')
      })
    ).toBe('')
    expect(falhaBackupAoSair()).toBeNull()
  })

  it('armazenamento CHEIO — que é uma das causas plausíveis do problema — não vira segunda falha', () => {
    // Registrar a falha não pode ser mais frágil que a falha que se registra.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    })
    const gritou = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      conteudoDoBackupAoSair(storeFake, () => {
        throw new Error('falhou')
      })
    ).toBe('')
    // e mesmo aí não fica MUDO: sobra o console, porque calar é o defeito
    expect(gritou).toHaveBeenCalled()
  })
})

describe('a marca é lida com desconfiança e some quando o usuário manda', () => {
  it('lixo gravado na chave devolve null em vez de quebrar a abertura do app', () => {
    const memoria = stubLocalStorage()
    memoria[CHAVE] = 'não é json'
    expect(falhaBackupAoSair()).toBeNull()
    memoria[CHAVE] = '{"em":123}' // sem motivo em texto
    expect(falhaBackupAoSair()).toBeNull()
    memoria[CHAVE] = '{"motivo":"falhou"}' // sem hora: vale, com hora vazia
    expect(falhaBackupAoSair()).toEqual({ em: '', motivo: 'falhou' })
  })

  it('limpar apaga a marca', () => {
    stubLocalStorage()
    registrarFalhaBackupAoSair(new Error('falhou'))
    expect(falhaBackupAoSair()).not.toBeNull()
    limparFalhaBackupAoSair()
    expect(falhaBackupAoSair()).toBeNull()
  })
})
