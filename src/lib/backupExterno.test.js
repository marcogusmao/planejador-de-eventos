// Testes do backup externo (hardening 1.1 — segunda exceção de rede, Marco
// 18/07/2026). Cobrem: o guard de 1×/dia, o envio com fetch injetado (sucesso
// e todas as falhas SEM lançar), o payload idêntico ao do export manual, e a
// prova (b) do prompt de hardening: o arquivo enviado REIMPORTA e produz
// números idênticos (round-trip por computeCenarios).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  URL_BACKUP_FINANCEIRO,
  deveEnviarHoje,
  enviarBackupExterno,
  talvezEnviarBackupDiario,
  mensagemFalhaBackup,
  avisoDoBackupDiario,
  textoBackupAutomatico,
  MSG_BACKUP_SEM_DADOS,
  MSG_BACKUP_SEM_TOKEN,
  MSG_BACKUP_NA_NUVEM,
  TEXTO_BACKUP_AUTOMATICO_MAC,
  TEXTO_BACKUP_AUTOMATICO_NUVEM,
} from './backupExterno.js'
import { montarBackup, parseBackup, mesclarBackup } from './storage.js'
import { migrarEventos } from './migracao.js'
import { ajustesVazio } from './premissas.js'
import { computeCenarios } from './calc.js'

// Evento realista o bastante para o cálculo passar por lotes, taxas, cashback,
// contingência e custos — se qualquer número sobreviver diferente ao
// round-trip, computeCenarios acusa.
const storeTeste = () => ({
  eventos: migrarEventos([
    {
      id: 'ev-rt',
      nome: 'Brisa round-trip',
      taxaBilheteria: 10,
      cashbackPct: 5,
      contingenciaPct: 10,
      outrasReceitas: { bar: 40000, patrocinio: 12500.5 },
      lotes: [
        { id: 'l1', nome: '1º lote', valor: 70, quantidade: 250 },
        { id: 'l2', nome: '2º lote', valor: 90.9, quantidade: 350 },
      ],
      categorias: [
        {
          id: 'c1',
          nome: 'Estrutura',
          itens: [
            { id: 'i1', servico: 'Palco', estimado: 8000, realizado: '', status: 'ORÇAR' },
            { id: 'i2', servico: 'Som', estimado: 3000.75, realizado: 2900.5, status: 'PAGO' },
          ],
        },
      ],
    },
  ]),
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksOcultos: [],
  ajustes: ajustesVazio(),
})

const respostaOk = (corpo = { ok: true, arquivo: 'previsao-eventos-2026-07-18.json', google_drive: false }) => ({
  ok: true,
  json: async () => corpo,
})

describe('deveEnviarHoje (guard de 1×/dia)', () => {
  // Timestamps montados no FUSO DA MÁQUINA (a partir de componentes locais),
  // para o teste ser determinístico em QUALQUER fuso — inclusive UTC no CI.
  // deveEnviarHoje compara o DIA LOCAL (diaLocal) dos dois instantes. Fixar o
  // offset -03:00 no texto amarrava o teste a quem roda em ~-03:00: numa máquina
  // UTC, '2026-07-17T23:50-03:00' e '2026-07-18T09:00-03:00' caem no MESMO dia
  // UTC, e o caso 'enviou ontem → envia' falhava. Construir a partir de
  // componentes locais garante que "ontem 23:50" e "hoje 09:00" sejam sempre
  // dias locais distintos, sem mudar o comportamento de produção (1×/dia local).
  const isoLocal = (a, m, d, h, min) => new Date(a, m - 1, d, h, min, 0, 0).toISOString()
  const agora = isoLocal(2026, 7, 18, 9, 0)
  it('nunca enviou → deve enviar', () => {
    expect(deveEnviarHoje(null, agora)).toBe(true)
    expect(deveEnviarHoje('', agora)).toBe(true)
  })
  it('já enviou hoje → não envia de novo', () => {
    expect(deveEnviarHoje(isoLocal(2026, 7, 18, 7, 0), agora)).toBe(false)
  })
  it('enviou ontem → envia', () => {
    expect(deveEnviarHoje(isoLocal(2026, 7, 17, 23, 50), agora)).toBe(true)
  })
  it('marcador ilegível → envia (nunca trava o backup)', () => {
    expect(deveEnviarHoje('isso não é data', agora)).toBe(true)
  })
})

describe('enviarBackupExterno', () => {
  it('sucesso: POST no destino único, com o MESMO payload do export manual e o token no cabeçalho', async () => {
    const store = storeTeste()
    const chamadas = []
    const f = vi.fn(async (url, opts) => {
      chamadas.push({ url, opts })
      return respostaOk()
    })
    const r = await enviarBackupExterno(store, f, 'chave-teste')
    expect(r).toEqual({ ok: true, arquivo: 'previsao-eventos-2026-07-18.json', googleDrive: false })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toBe(URL_BACKUP_FINANCEIRO)
    expect(chamadas[0].opts.method).toBe('POST')
    expect(chamadas[0].opts.headers['Content-Type']).toBe('application/json')
    // H2-B: o token da ponte viaja no cabeçalho da mutação — e SÓ no cabeçalho
    expect(chamadas[0].opts.headers['X-Ponte-Token']).toBe('chave-teste')
    expect(chamadas[0].url).not.toContain('chave-teste')
    const enviado = JSON.parse(chamadas[0].opts.body)
    const manual = montarBackup(store)
    // exportadoEm é o relógio — fora ele, payload idêntico ao export manual
    expect({ ...enviado, exportadoEm: null }).toEqual({ ...manual, exportadoEm: null })
    expect(enviado.app).toBe('previsao-eventos')
    // o token NÃO viaja dentro do backup (o arquivo circula; o segredo não)
    expect(chamadas[0].opts.body).not.toContain('chave-teste')
  })

  it('sem token configurado → { ok:false, motivo:sem-token }, rede intocada (H2-B)', async () => {
    const f = vi.fn()
    await expect(enviarBackupExterno(storeTeste(), f, '')).resolves.toEqual({
      ok: false,
      motivo: 'sem-token',
    })
    expect(f).not.toHaveBeenCalled()
  })

  it('Financeiro recusa o token (403) → { ok:false, motivo:token } (H2-B)', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ erro: 'x' }) }))
    await expect(enviarBackupExterno(storeTeste(), f, 'chave-errada')).resolves.toEqual({
      ok: false,
      motivo: 'token',
      status: 403,
    })
  })

  it('Financeiro fechado (fetch lança) → { ok:false, motivo:fechado }, sem exceção', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(enviarBackupExterno(storeTeste(), f, 'chave-teste')).resolves.toEqual({
      ok: false,
      motivo: 'fechado',
    })
  })

  it('resposta HTTP de erro → { ok:false, motivo:erro, status }', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ erro: 'x' }) }))
    await expect(enviarBackupExterno(storeTeste(), f, 'chave-teste')).resolves.toEqual({
      ok: false,
      motivo: 'erro',
      status: 400,
    })
  })

  it('corpo ilegível ou sem ok:true → { ok:false, motivo:erro }', async () => {
    const semJson = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('não é JSON')
      },
    }))
    await expect(enviarBackupExterno(storeTeste(), semJson, 'chave-teste')).resolves.toEqual({
      ok: false,
      motivo: 'erro',
    })
    const okFalso = vi.fn(async () => respostaOk({ qualquer: 'coisa' }))
    await expect(enviarBackupExterno(storeTeste(), okFalso, 'chave-teste')).resolves.toEqual({
      ok: false,
      motivo: 'erro',
    })
  })
})

// ————— §9.11 nº 5 (auditoria externa, 20/07/2026): o botão manual não pode
// sobrescrever o backup do dia com nada —————
//
// O envio automático já se recusava a mandar store vazio; o botão manual, não.
// O encadeamento é o que mata: corrupção de leitura → o Marco vê a lista vazia
// → clica no botão que "protege" → o arquivo bom do dia no Financeiro (e no
// Drive) vira o vazio. A guarda passou para dentro do único ponto que fala com
// a rede, então vale para o botão da Home, o de Ajustes e qualquer outro.
describe('enviarBackupExterno — guarda de store vazio (§9.11 nº 5)', () => {
  it('store vazio: NEM TOCA a rede e diz o motivo', async () => {
    const f = vi.fn(async () => respostaOk())
    const r = await enviarBackupExterno(
      { eventos: [], benchmarksCustom: [] },
      f,
      'chave-teste'
    )
    expect(r).toEqual({ ok: false, motivo: 'sem-dados' })
    expect(f).not.toHaveBeenCalled()
    expect(mensagemFalhaBackup(r)).toBe(MSG_BACKUP_SEM_DADOS)
    expect(MSG_BACKUP_SEM_DADOS).toMatch(/vazio/i)
  })

  it('store nulo (o que sobra de uma leitura que falhou) também é recusado', async () => {
    const f = vi.fn(async () => respostaOk())
    expect(await enviarBackupExterno(null, f, 'chave-teste')).toEqual({
      ok: false,
      motivo: 'sem-dados',
    })
    expect(f).not.toHaveBeenCalled()
  })

  it('só um benchmark próprio já é dado de verdade — esse vai', async () => {
    const f = vi.fn(async () => respostaOk())
    const r = await enviarBackupExterno(
      { eventos: [], benchmarksCustom: [{ id: 'bm-proprio' }] },
      f,
      'chave-teste'
    )
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('store com previsões continua enviando normalmente (a guarda não atrapalha)', async () => {
    const f = vi.fn(async () => respostaOk())
    const r = await enviarBackupExterno(storeTeste(), f, 'chave-teste')
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('talvezEnviarBackupDiario (abertura do app)', () => {
  // O cenário destes testes é "ambiente sem armazenamento", e agora ele é
  // DECLARADO em vez de herdado do Node da máquina (Marco, 24/07/2026 —
  // achado S2 do BACKLOG). Antes daqui não havia stub e o bloco confiava em
  // "o node não tem localStorage": verdade no Node 20 (o do CI), falso no
  // Node 22+ (o da máquina do Marco), que expõe um localStorage cujo getItem
  // não é função. Os testes cobravam quantas mensagens apareciam no console —
  // acidente de ambiente — em vez do contrato: o backup diário decide certo
  // mesmo sem lugar para guardar o marcador, e ambiente sem armazenamento não
  // é erro, então nada é logado.
  beforeEach(() => {
    vi.stubGlobal('localStorage', undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('store sem dados → não tenta nem toca a rede', async () => {
    const f = vi.fn()
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await talvezEnviarBackupDiario(
      { eventos: [], benchmarksCustom: [] },
      f,
      '2026-07-18T09:00:00.000-03:00'
    )
    expect(r).toEqual({ tentou: false, motivo: 'sem-dados' })
    expect(f).not.toHaveBeenCalled()
    // Sem o 4º argumento, o default `chave = loadChavePonte()` é avaliado no
    // ato da chamada. Sem armazenamento ele devolve '' pela guarda, sem logar.
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('com dados e sem envio hoje → tenta; sucesso devolve tentou+ok', async () => {
    const f = vi.fn(async () => respostaOk())
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await talvezEnviarBackupDiario(
      storeTeste(),
      f,
      '2026-07-18T09:00:00.000-03:00',
      'chave-teste'
    )
    expect(r.tentou).toBe(true)
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
    // loadUltimoEnvio (guard de 1×/dia) e marcarEnvioAgora saem pela guarda de
    // armazenamento: o envio acontece, o marcador não é gravado, e isso é
    // degradação prevista — não erro. O único efeito é o app tentar de novo
    // mais cedo, inofensivo (o arquivo do dia é sobrescrito, nunca duplicado).
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('Financeiro fechado → tentou e ok:false (vira aviso discreto, nunca erro)', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await talvezEnviarBackupDiario(
      storeTeste(),
      f,
      '2026-07-18T09:00:00.000-03:00',
      'chave-teste'
    )
    expect(r).toEqual({ tentou: true, ok: false, motivo: 'fechado' })
    // Financeiro fechado é aviso discreto, não erro de console; e a leitura do
    // marcador sai pela guarda sem logar.
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('sem token configurado → tentou e motivo sem-token, rede intocada (H2-B)', async () => {
    const f = vi.fn()
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await talvezEnviarBackupDiario(storeTeste(), f, '2026-07-18T09:00:00.000-03:00', '')
    expect(r).toEqual({ tentou: true, ok: false, motivo: 'sem-token' })
    expect(f).not.toHaveBeenCalled()
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })
})

describe('round-trip do arquivo enviado (prova b do hardening 1.1)', () => {
  it('o JSON enviado reimporta via parseBackup e produz números IDÊNTICOS', () => {
    const store = storeTeste()
    const antes = computeCenarios(store.eventos[0])

    // o Financeiro grava byte a byte o que recebeu (provado no teste_fumaca);
    // aqui provamos a outra metade: o que foi enviado volta idêntico.
    const texto = JSON.stringify(montarBackup(store), null, 2)
    const parsed = parseBackup(texto)
    expect(parsed.eventos).toEqual(store.eventos)

    const vazio = {
      eventos: [],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksOcultos: [],
      ajustes: ajustesVazio(),
    }
    const restaurado = mesclarBackup(vazio, parsed)
    expect(restaurado.eventos).toHaveLength(1)
    const depois = computeCenarios(restaurado.eventos[0])
    expect(depois).toEqual(antes)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A CÓPIA DA NUVEM (Marco, 05/10/2026, por questionário)
//
// Lá não existe backup diário para o Financeiro. Antes, a abertura devolvia
// 'sem-token' e a Home pedia "cole o token em Ajustes" A CADA abertura — colar
// não resolve nada lá. O que estes testes afirmam: na nuvem a rede não é tocada
// e o token não é pedido; o aviso é calmo e aparece UMA vez por navegador; e na
// 4173 do Mac o comportamento de antes continua intacto.
// ═══════════════════════════════════════════════════════════════════════════

const ORIGEM_NUVEM = 'https://planejador.casa.example'
const ORIGEM_MAC = 'http://localhost:4173'
const AGORA = '2026-10-05T09:00:00.000-03:00'

/** Um localStorage de mentira, em memória — o marcador do aviso precisa de um. */
const armazenamentoEmMemoria = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

describe('backup na cópia da nuvem — sem rede, sem token, um aviso só', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envio manual na nuvem: motivo "origem" na hora, rede intocada, e a frase NÃO pede token', async () => {
    const f = vi.fn()
    for (const chave of ['', 'chave-colada-na-nuvem']) {
      const r = await enviarBackupExterno(storeTeste(), f, chave, ORIGEM_NUVEM)
      expect(r).toEqual({ ok: false, motivo: 'origem', origem: ORIGEM_NUVEM })
      const m = mensagemFalhaBackup(r)
      expect(m).toContain('cópia da nuvem')
      expect(m).toContain('http://localhost:4173')
      expect(m).not.toContain('token')
    }
    expect(f).not.toHaveBeenCalled()
  })

  // Achado B da revisão do PR #100: com o app VAZIO na nuvem, o envio manual
  // dizia "apagaria o arquivo bom que já está no Financeiro… restaure a versão"
  // — uma sócia de app vazio não tem arquivo bom nenhum lá.
  it('envio manual na nuvem com o app VAZIO: a frase da nuvem, e não a de "apagaria o arquivo bom"', async () => {
    const f = vi.fn()
    const r = await enviarBackupExterno({ eventos: [], benchmarksCustom: [] }, f, 'chave', ORIGEM_NUVEM)
    expect(r).toEqual({ ok: false, motivo: 'origem', origem: ORIGEM_NUVEM })
    expect(mensagemFalhaBackup(r)).toContain('cópia da nuvem')
    expect(mensagemFalhaBackup(r)).not.toContain('apagaria o arquivo bom')
    expect(f).not.toHaveBeenCalled()
  })

  it('envio manual na 4173 com o app vazio: a guarda de sempre ("sem-dados"), intacta', async () => {
    const f = vi.fn()
    const r = await enviarBackupExterno({ eventos: [], benchmarksCustom: [] }, f, 'chave', ORIGEM_MAC)
    expect(r).toEqual({ ok: false, motivo: 'sem-dados' })
    expect(mensagemFalhaBackup(r)).toBe(MSG_BACKUP_SEM_DADOS)
    expect(f).not.toHaveBeenCalled()
  })

  it('envio manual na 4173 sem token: o mesmo "sem-token" de antes, com a mesma frase', async () => {
    const f = vi.fn()
    const r = await enviarBackupExterno(storeTeste(), f, '', ORIGEM_MAC)
    expect(r).toEqual({ ok: false, motivo: 'sem-token' })
    expect(mensagemFalhaBackup(r)).toBe(MSG_BACKUP_SEM_TOKEN)
    expect(f).not.toHaveBeenCalled()
  })

  it('abertura na nuvem: não tenta, não pede token; o aviso calmo sai na PRIMEIRA vez e não na segunda', async () => {
    vi.stubGlobal('localStorage', armazenamentoEmMemoria())
    const f = vi.fn()
    const primeira = await talvezEnviarBackupDiario(storeTeste(), f, AGORA, '', ORIGEM_NUVEM)
    expect(primeira).toEqual({ tentou: false, motivo: 'nuvem', avisar: true })
    expect(avisoDoBackupDiario(primeira)).toBe(MSG_BACKUP_NA_NUVEM)
    const segunda = await talvezEnviarBackupDiario(storeTeste(), f, AGORA, '', ORIGEM_NUVEM)
    expect(segunda).toEqual({ tentou: false, motivo: 'nuvem', avisar: false })
    expect(avisoDoBackupDiario(segunda)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('o aviso da nuvem diz onde o backup diário funciona e o que fazer — e não fala de token', () => {
    expect(MSG_BACKUP_NA_NUVEM).toContain('cópia da nuvem')
    expect(MSG_BACKUP_NA_NUVEM).toContain('app do Mac (http://localhost:4173)')
    expect(MSG_BACKUP_NA_NUVEM).toContain('Exportar backup')
    expect(MSG_BACKUP_NA_NUVEM).not.toContain('token')
  })

  it('na nuvem com app vazio (a sócia abrindo pela primeira vez): nem aviso — não há o que guardar', async () => {
    vi.stubGlobal('localStorage', armazenamentoEmMemoria())
    const r = await talvezEnviarBackupDiario({ eventos: [], benchmarksCustom: [] }, vi.fn(), AGORA, '', ORIGEM_NUVEM)
    expect(r).toEqual({ tentou: false, motivo: 'sem-dados' })
    expect(avisoDoBackupDiario(r)).toBeNull()
  })

  it('na nuvem sem armazenamento usável: o aviso volta a cada abertura, sem erro no console', async () => {
    vi.stubGlobal('localStorage', undefined)
    const espiaErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (let i = 0; i < 2; i++) {
      const r = await talvezEnviarBackupDiario(storeTeste(), vi.fn(), AGORA, '', ORIGEM_NUVEM)
      expect(r.avisar).toBe(true)
    }
    expect(espiaErro).not.toHaveBeenCalled()
    espiaErro.mockRestore()
  })

  it('abertura na 4173 sem token: o mesmo de antes — tentou, "sem-token", e a faixa pede o token', async () => {
    vi.stubGlobal('localStorage', armazenamentoEmMemoria())
    const f = vi.fn()
    const r = await talvezEnviarBackupDiario(storeTeste(), f, AGORA, '', ORIGEM_MAC)
    expect(r).toEqual({ tentou: true, ok: false, motivo: 'sem-token' })
    expect(avisoDoBackupDiario(r)).toBe(MSG_BACKUP_SEM_TOKEN)
    expect(f).not.toHaveBeenCalled()
  })

  it('abertura na 4173 com sucesso: sem aviso, como antes', () => {
    expect(avisoDoBackupDiario({ tentou: true, ok: true, arquivo: 'x.json' })).toBeNull()
    expect(avisoDoBackupDiario({ tentou: false, motivo: 'ja-enviado-hoje' })).toBeNull()
  })

  it('Ajustes › Backup: na nuvem diz que não há envio automático; na 4173, a frase de antes', () => {
    expect(textoBackupAutomatico(ORIGEM_NUVEM)).toBe(TEXTO_BACKUP_AUTOMATICO_NUVEM)
    expect(TEXTO_BACKUP_AUTOMATICO_NUVEM).toContain('não há envio automático')
    expect(textoBackupAutomatico(ORIGEM_MAC)).toBe(TEXTO_BACKUP_AUTOMATICO_MAC)
    // A frase que estava escrita direto no Ajustes.jsx até 05/10/2026, por extenso.
    expect(TEXTO_BACKUP_AUTOMATICO_MAC).toBe(
      'Além do arquivo baixado, o app envia sozinho (1× por dia, ao abrir) uma cópia deste mesmo backup para a pasta de backups do Financeiro local, quando ele está aberto — assim existe uma cópia fora do navegador mesmo sem export manual.'
    )
  })
})
