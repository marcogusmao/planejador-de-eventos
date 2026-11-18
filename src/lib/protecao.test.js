import { describe, it, expect } from 'vitest'
import {
  rotacionar,
  MAX_LIXEIRA,
  diaLocal,
  jaTemSnapshotHoje,
  storeTemDados,
  diasEntre,
  statusBackup,
  LIMITE_BACKUP_DIAS,
} from './protecao.js'

describe('rotacionar', () => {
  it('coloca o novo item no topo', () => {
    expect(rotacionar([{ id: 'a' }, { id: 'b' }], { id: 'c' }, 5)).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ])
  })

  it('mantém no máximo `max` itens, descartando os mais antigos', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const r = rotacionar(lista, { id: 'd' }, 3)
    expect(r).toEqual([{ id: 'd' }, { id: 'a' }, { id: 'b' }])
    expect(r).toHaveLength(3)
  })

  it('não muta a lista original', () => {
    const lista = [{ id: 'a' }]
    rotacionar(lista, { id: 'b' }, 5)
    expect(lista).toEqual([{ id: 'a' }])
  })

  it('respeita o limite da lixeira', () => {
    let lista = []
    for (let i = 0; i < MAX_LIXEIRA + 10; i++) {
      lista = rotacionar(lista, { id: `i${i}` }, MAX_LIXEIRA)
    }
    expect(lista).toHaveLength(MAX_LIXEIRA)
    // o mais recente inserido fica no topo
    expect(lista[0].id).toBe(`i${MAX_LIXEIRA + 9}`)
  })
})

describe('diaLocal', () => {
  it('extrai AAAA-MM-DD de um ISO', () => {
    expect(diaLocal('2026-07-18T14:32:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('retorna vazio para data inválida', () => {
    expect(diaLocal('não é data')).toBe('')
  })

  // ————— O mês tem de ser o mês do CALENDÁRIO —————
  //
  // `diaLocal` é quem dá NOME ao dia de um dado guardado. Desse nome dependem
  // as duas rotinas que só podem acontecer uma vez por dia: a foto automática
  // do estado do app (`jaTemSnapshotHoje`, logo abaixo) e o envio do backup ao
  // Financeiro (`deveEnviarHoje`, em backupExterno.js).
  //
  // O teste de formato lá em cima cobra só o DESENHO da resposta, e cobra com
  // uma data de julho — um mês em que um mês trocado ainda sai com dois
  // dígitos e passa pelo mesmo `\d{2}`. Estes casos cobram o VALOR, e cobram
  // nas duas datas em que a casa erraria na cara: a virada do Réveillon (a
  // única noite do ano que começa num ano e acaba no outro, e o único dia cujo
  // mês é o primeiro do calendário) e a Brisa de 05/12.
  //
  // As datas vão em hora LOCAL, sem "Z", de propósito: `diaLocal` lê o
  // calendário do relógio do Marco, e a esteira roda a suíte em TZ=UTC e em
  // TZ=America/Sao_Paulo. Escrito em local, o dia é o mesmo nas duas.
  it('a virada do Réveillon é 1º de janeiro, e o mês dela é 01', () => {
    expect(diaLocal('2027-01-01T05:30:00')).toBe('2027-01-01')
  })

  it('a Brisa de 05/12 cai em dezembro — 12, e nunca no mês de outra festa', () => {
    expect(diaLocal('2026-12-05T22:00:00')).toBe('2026-12-05')
  })

  it('cada mês do calendário sai com o próprio número, de 01 a 12', () => {
    const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    for (const mm of MESES) {
      expect(diaLocal(`2026-${mm}-15T12:00:00`)).toBe(`2026-${mm}-15`)
    }
  })
})

describe('jaTemSnapshotHoje', () => {
  const hoje = '2026-07-18T09:00:00'
  it('true quando já existe snapshot AUTO do mesmo dia', () => {
    const snaps = [{ tipo: 'auto', criadoEm: '2026-07-18T02:00:00' }]
    expect(jaTemSnapshotHoje(snaps, hoje)).toBe(true)
  })
  it('false quando o snapshot do dia é só de segurança', () => {
    const snaps = [{ tipo: 'seguranca', criadoEm: '2026-07-18T02:00:00' }]
    expect(jaTemSnapshotHoje(snaps, hoje)).toBe(false)
  })
  it('false quando o único auto é de outro dia', () => {
    const snaps = [{ tipo: 'auto', criadoEm: '2026-07-17T23:00:00' }]
    expect(jaTemSnapshotHoje(snaps, hoje)).toBe(false)
  })
  it('false para lista vazia', () => {
    expect(jaTemSnapshotHoje([], hoje)).toBe(false)
  })
})

describe('storeTemDados', () => {
  it('true com pelo menos um evento', () => {
    expect(storeTemDados({ eventos: [{ id: 'a' }], benchmarksCustom: [] })).toBe(true)
  })
  it('true com pelo menos um benchmark custom', () => {
    expect(storeTemDados({ eventos: [], benchmarksCustom: [{ id: 'b' }] })).toBe(true)
  })
  it('false com store vazio ou nulo', () => {
    expect(storeTemDados({ eventos: [], benchmarksCustom: [] })).toBe(false)
    expect(storeTemDados(null)).toBe(false)
  })
})

describe('diasEntre', () => {
  it('conta dias inteiros', () => {
    expect(diasEntre('2026-07-01T00:00:00', '2026-07-16T00:00:00')).toBe(15)
  })
  it('null para data ausente ou inválida', () => {
    expect(diasEntre(null, '2026-07-16T00:00:00')).toBe(null)
    expect(diasEntre('xx', '2026-07-16T00:00:00')).toBe(null)
  })
})

describe('statusBackup', () => {
  const agoraIso = '2026-07-18T12:00:00'
  it('nunca exportou → vencido', () => {
    expect(statusBackup(null, agoraIso)).toEqual({ vencido: true, nunca: true, dias: null })
  })
  it('export recente (menos que o limite) → não vencido', () => {
    const r = statusBackup('2026-07-15T12:00:00', agoraIso)
    expect(r.vencido).toBe(false)
    expect(r.dias).toBe(3)
  })
  it('no limite exato → vencido', () => {
    const antigo = new Date('2026-07-18T12:00:00')
    antigo.setDate(antigo.getDate() - LIMITE_BACKUP_DIAS)
    expect(statusBackup(antigo.toISOString(), agoraIso).vencido).toBe(true)
  })
  it('bem antigo → vencido com contagem de dias', () => {
    const r = statusBackup('2026-06-01T12:00:00', agoraIso)
    expect(r.vencido).toBe(true)
    expect(r.dias).toBeGreaterThan(LIMITE_BACKUP_DIAS)
  })
})

describe('snapshotSeguranca (rótulo customizável — Sessão H)', () => {
  // Stub de localStorage: o ambiente de teste é node; aqui só interessa o
  // CONTEÚDO gravado (o mecanismo real foi validado ao vivo na Sessão C).
  const comLocalStorageFalso = async (fn) => {
    const mem = {}
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => {
        mem[k] = String(v)
      },
      removeItem: (k) => {
        delete mem[k]
      },
    }
    try {
      return await fn(mem)
    } finally {
      delete globalThis.localStorage
    }
  }

  it('grava tipo seguranca com o rótulo passado (ponte do Financeiro)', async () => {
    await comLocalStorageFalso(async (mem) => {
      const { snapshotSeguranca } = await import('./protecao.js')
      const store = { eventos: [{ id: 'x' }], benchmarksCustom: [] }
      const r = snapshotSeguranca(store, '2026-07-18T14:32:00.000Z', 'antes de aplicar dados do Financeiro')
      expect(r.ok).toBe(true)
      const snaps = JSON.parse(mem['previsao-eventos:snapshots:v1'])
      expect(snaps[0]).toMatchObject({
        tipo: 'seguranca',
        rotulo: 'antes de aplicar dados do Financeiro',
        criadoEm: '2026-07-18T14:32:00.000Z',
      })
      expect(snaps[0].store.eventos).toEqual([{ id: 'x' }])
    })
  })

  it('sem rótulo explícito mantém o padrão "antes de restaurar"', async () => {
    await comLocalStorageFalso(async (mem) => {
      const { snapshotSeguranca } = await import('./protecao.js')
      snapshotSeguranca({ eventos: [] }, '2026-07-18T14:32:00.000Z')
      expect(JSON.parse(mem['previsao-eventos:snapshots:v1'])[0].rotulo).toBe('antes de restaurar')
    })
  })
})
