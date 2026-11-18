// Testes da correção S2 (19/07/2026): a ponte com o Financeiro dava
// diagnóstico MENTIROSO — dizia "o Financeiro está fechado" quando o problema
// real era o app aberto fora da origem autorizada (npm run dev na 5173 em vez
// da 4173 do "Iniciar Previsão.command"), barrado por CORS pelo navegador.
//
// EVIDÊNCIA que motivou a correção (curl contra o Financeiro rodando):
//   OPTIONS /api/previsao/backup  Origin: http://localhost:5173 → HTTP 404
//   OPTIONS /api/previsao/backup  Origin: http://localhost:4173 → HTTP 204
// Ou seja: com o Financeiro ABERTO, a chamada falha por origem — e o app
// mandava o dono abrir o que já estava aberto.
//
// A origem é INJETÁVEL nos três pontos de rede justamente para o teste poder
// exercitar os dois mundos sem navegador.

import { describe, it, expect, vi } from 'vitest'
import {
  ORIGEM_PONTE,
  origemAutorizada,
  origemAtual,
  origemNaNuvem,
  msgOrigemErrada,
} from './ponteOrigem.js'
import { enviarBackupExterno, mensagemFalhaBackup } from './backupExterno.js'
import { buscarEventosFinanceiro, buscarCurvaEdicoes, MSG_FINANCEIRO_FECHADO } from './financeiro.js'
import { buscarCurvaFinanceiro } from './curvaVendas.js'

const ORIGEM_DEV = 'http://localhost:5173'
const falha = () => {
  throw new TypeError('Failed to fetch')
}
const storeTeste = () => ({ eventos: [{ id: 'e1', nome: 'Brisa', categorias: [] }], ajustes: {} })

describe('ponteOrigem — a constante é o espelho do config.py do Financeiro', () => {
  it('a origem autorizada é a porta do "Iniciar Previsão.command" (4173)', () => {
    // Se este teste falhar, o ORIGEM_PREVISAO do Financeiro mudou (ou
    // este mudou sem o outro) — os dois lados TÊM que andar juntos.
    expect(ORIGEM_PONTE).toBe('http://localhost:4173')
  })

  it('origem igual à autorizada passa; origem de desenvolvimento não passa', () => {
    expect(origemAutorizada(ORIGEM_PONTE)).toBe(true)
    expect(origemAutorizada(ORIGEM_DEV)).toBe(false)
  })

  it('sem navegador (origem vazia) conta como autorizada — não há CORS para barrar', () => {
    expect(origemAutorizada('')).toBe(true)
    expect(origemAtual()).toBe('') // ambiente node dos testes
  })

  it('a mensagem carrega a origem REAL — o dono precisa ver onde ele está', () => {
    const m = msgOrigemErrada(ORIGEM_DEV, 'o envio do backup')
    expect(m).toContain(ORIGEM_DEV)
    expect(m).toContain(ORIGEM_PONTE)
    expect(m).toContain('Iniciar Previsão.command')
    expect(m).toContain('seus dados continuam salvos neste navegador')
    // O ponto da correção: não pode culpar o Financeiro.
    expect(m).toContain('e não porque o Financeiro esteja fechado')
  })
})

describe('backup (POST) — origem errada não vira mais "Financeiro fechado"', () => {
  it('origem errada + falha → motivo "origem" com a origem real', async () => {
    const r = await enviarBackupExterno(storeTeste(), falha, 'chave-teste', ORIGEM_DEV)
    expect(r).toEqual({ ok: false, motivo: 'origem', origem: ORIGEM_DEV })
    expect(mensagemFalhaBackup(r)).toContain(ORIGEM_DEV)
    expect(mensagemFalhaBackup(r)).not.toContain('Financeiro está fechado')
  })

  it('origem certa + falha → "fechado" (agora a mensagem é verdadeira)', async () => {
    const r = await enviarBackupExterno(storeTeste(), falha, 'chave-teste', ORIGEM_PONTE)
    expect(r).toEqual({ ok: false, motivo: 'fechado' })
  })

  it('origem certa + sucesso → ok, com o arquivo gravado', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, arquivo: 'previsao-2026-07-19.json' }),
    }))
    const r = await enviarBackupExterno(storeTeste(), f, 'chave-teste', ORIGEM_PONTE)
    expect(r).toEqual({ ok: true, arquivo: 'previsao-2026-07-19.json', googleDrive: false })
  })

  it('origem errada NÃO bloqueia a chamada: se a ponte aceitar, o envio vale', async () => {
    // A checagem de origem é diagnóstico do fracasso, não porteiro. Se um dia o
    // Financeiro autorizar outra origem, o backup continua funcionando sozinho.
    // Exceção desde 05/10/2026: a cópia da nuvem (https fora do próprio
    // computador) nem tenta — ver o bloco "cópia da nuvem" no fim do arquivo.
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, arquivo: 'x.json' }) }))
    const r = await enviarBackupExterno(storeTeste(), f, 'chave-teste', ORIGEM_DEV)
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalled()
  })
})

describe('leituras (GET) — mesmo diagnóstico dos dois lados da ponte', () => {
  it('eventos: origem errada + falha → mensagem de origem, não "Abra o Financeiro"', async () => {
    await expect(buscarEventosFinanceiro(falha, ORIGEM_DEV)).rejects.toThrow(ORIGEM_DEV)
    await expect(buscarEventosFinanceiro(falha, ORIGEM_DEV)).rejects.not.toThrow(
      MSG_FINANCEIRO_FECHADO
    )
  })

  it('eventos: origem certa + falha → "Abra o Financeiro…"', async () => {
    await expect(buscarEventosFinanceiro(falha, ORIGEM_PONTE)).rejects.toThrow(
      MSG_FINANCEIRO_FECHADO
    )
  })

  it('curva: origem errada + falha → mensagem de origem com a origem real', async () => {
    await expect(buscarCurvaFinanceiro(falha, ORIGEM_DEV)).rejects.toThrow(ORIGEM_DEV)
  })

  it('curva: origem certa + falha → "Abra o Financeiro…"', async () => {
    await expect(buscarCurvaFinanceiro(falha, ORIGEM_PONTE)).rejects.toThrow(
      MSG_FINANCEIRO_FECHADO
    )
  })

  it('curva: origem certa + sucesso → devolve a curva validada', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        eventos_sem_data: [],
        eventos: [
          {
            evento_id: 7,
            nome: 'Brisa 05/12',
            data: '2025-12-05',
            status: 'realizado',
            empresa_id: 2,
            empresa: 'Brisa',
            total_pagamentos: 5,
            total_valor: 550,
            dias: [
              { dia: -30, pagamentos: 2, valor: 200 },
              { dia: -10, pagamentos: 2, valor: 250 },
              { dia: 0, pagamentos: 1, valor: 100 },
            ],
          },
        ],
      }),
    }))
    const c = await buscarCurvaFinanceiro(f, ORIGEM_PONTE)
    expect(c.eventos).toHaveLength(1)
  })
})

describe('mensagemFalhaBackup — o mapeamento mora em um lugar só', () => {
  it('cada motivo tem sua mensagem, e só "fechado" fala em Financeiro fechado', () => {
    expect(mensagemFalhaBackup({ motivo: 'sem-token' })).toContain('token_ponte.txt')
    expect(mensagemFalhaBackup({ motivo: 'token' })).toContain('recusou o token')
    expect(mensagemFalhaBackup({ motivo: 'origem', origem: ORIGEM_DEV })).toContain(ORIGEM_DEV)
    expect(mensagemFalhaBackup({ motivo: 'fechado' })).toContain('o Financeiro está fechado')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A CÓPIA DA NUVEM (Marco, 05/10/2026, por questionário)
//
// A tela sobe para o Railway em https://planejador.casa.example, atrás da
// entrada da casa. De lá a ponte não funciona — risco aceito pelo Marco. O que
// estes testes afirmam: a frase de lá diz a verdade ("só no app do Mac"), sem
// "modo desenvolvimento" e sem mandar abrir um .command; nenhum ponto de rede
// chega a chamar localhost; e na 4173 do Mac tudo continua como era.
// ═══════════════════════════════════════════════════════════════════════════

const ORIGEM_NUVEM = 'https://planejador.casa.example'

// A frase de ANTES, escrita por extenso: é o "comportamento de hoje intacto"
// fora da nuvem. Se ela mudar sem querer, este teste acusa.
const FRASE_DE_ANTES = (origem, acao) =>
  `Este app está aberto em ${origem} (modo desenvolvimento). ` +
  `A ponte com o Financeiro só aceita o app aberto pelo “Iniciar Previsão.command” (http://localhost:4173) — ` +
  `por isso o navegador bloqueou ${acao}, e não porque o Financeiro esteja fechado. ` +
  'Abra por lá e tente de novo — seus dados continuam salvos neste navegador.'

describe('cópia da nuvem — quem é nuvem', () => {
  it('https fora do próprio computador é nuvem', () => {
    expect(origemNaNuvem(ORIGEM_NUVEM)).toBe(true)
    expect(origemNaNuvem('https://planejador-producao.up.railway.app')).toBe(true)
  })

  it('a 4173 do Mac, o modo dev, http de rede local, https em localhost e origem vazia NÃO são nuvem', () => {
    for (const origem of [
      ORIGEM_PONTE,
      ORIGEM_DEV,
      'http://127.0.0.1:4180',
      'http://192.168.0.12:4173',
      'https://localhost:4173',
      'https://127.0.0.1:4173',
      'https://[::1]:4173',
      '',
      'isto não é endereço',
    ]) {
      expect(origemNaNuvem(origem)).toBe(false)
    }
  })
})

describe('cópia da nuvem — a frase diz a verdade', () => {
  it('na nuvem: "cópia da nuvem", "só no app do Mac", sem "modo desenvolvimento" e sem .command', () => {
    for (const acao of ['o envio do backup', 'a consulta ao Financeiro']) {
      const m = msgOrigemErrada(ORIGEM_NUVEM, acao)
      expect(m).toContain(ORIGEM_NUVEM)
      expect(m).toContain('cópia da nuvem')
      expect(m).toContain('só funcionam no app do Mac (http://localhost:4173)')
      expect(m).toContain('backup diário')
      expect(m).toContain(acao)
      expect(m).toContain('e não porque o Financeiro esteja fechado')
      expect(m).toContain('Exportar backup')
      expect(m).not.toContain('modo desenvolvimento')
      expect(m).not.toContain('.command')
      expect(m).not.toContain('token')
    }
  })

  it('na 4173 e no modo dev: a frase de ANTES, palavra por palavra', () => {
    expect(msgOrigemErrada(ORIGEM_DEV, 'o envio do backup')).toBe(FRASE_DE_ANTES(ORIGEM_DEV, 'o envio do backup'))
    expect(msgOrigemErrada('http://127.0.0.1:4180', 'a consulta ao Financeiro')).toBe(
      FRASE_DE_ANTES('http://127.0.0.1:4180', 'a consulta ao Financeiro')
    )
  })
})

describe('cópia da nuvem — as leituras nem chamam localhost', () => {
  const nuncaChamar = () => vi.fn(async () => {
    throw new Error('não era para chamar a rede')
  })

  it('eventos, curva e curva-edições: rejeitam com a frase da nuvem e o fetch NÃO é chamado', async () => {
    for (const buscar of [buscarEventosFinanceiro, buscarCurvaFinanceiro, buscarCurvaEdicoes]) {
      const f = nuncaChamar()
      await expect(buscar(f, ORIGEM_NUVEM)).rejects.toThrow('cópia da nuvem')
      expect(f).not.toHaveBeenCalled()
    }
  })

  it('na 4173 as três continuam CHAMANDO a rede, e falha continua sendo "Abra o Financeiro"', async () => {
    for (const buscar of [buscarEventosFinanceiro, buscarCurvaFinanceiro, buscarCurvaEdicoes]) {
      const f = vi.fn(falha)
      await expect(buscar(f, ORIGEM_PONTE)).rejects.toThrow(MSG_FINANCEIRO_FECHADO)
      expect(f).toHaveBeenCalledTimes(1)
    }
  })
})
