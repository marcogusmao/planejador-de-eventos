// @vitest-environment jsdom
//
// O FIO da decisão do Marco de 26/07/2026, na TELA: festa sem identificação no
// backup entra, e o aviso que o Marco lê conta a verdade.
//
// Por que este arquivo existe além do teste do módulo: o número mentiroso
// morava no COMPONENTE — `Backup importado: ${backup.eventos.length}` lia o
// tamanho do ARQUIVO. Provar só o módulo puro deixaria de fora justamente o
// pedaço que mentia: a chamada, o argumento (`store` de antes do merge) e o
// texto que aparece na caixa de aviso. Aqui o arquivo JSON é solto no campo de
// arquivo de verdade, e o que se afirma é o texto do `window.alert`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ImportModal from './ImportModal.jsx'
import Ajustes from './Ajustes.jsx'
import { formaAparencia } from '../lib/aparencia.js'
import { APP_ID, VERSAO_BACKUP } from '../lib/storage.js'
import { novoEvento } from '../lib/defaults.js'
import { computeCenario } from '../lib/calc.js'

afterEach(cleanup)

// Mesmas festas medidas na sessão: bilheteria bruta realista R$ 63.000,
// R$ 54.000 e R$ 32.400 (R$ 149.400). Nenhum dado real do Marco em teste.
function festa(nome, quantidade, id) {
  const e = {
    ...novoEvento(nome),
    lotes: [{ id: 'lote-1', nome: '1º lote', valor: 100, quantidade }],
  }
  delete e.id
  if (id !== undefined) e.id = id
  return e
}

const arquivoJSON = (eventos) =>
  JSON.stringify({
    app: APP_ID,
    versao: VERSAO_BACKUP,
    exportadoEm: '2026-07-26T03:00:00.000Z',
    eventos,
  })

const storeVazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  ajustes: {},
})

// O componente lê o arquivo com `file.text()`; o File do jsdom não tem o
// método, então o arquivo de teste é um objeto com nome e texto — é isso que o
// `onChange` do input entrega.
const arquivoFalso = (nome, texto) => ({ name: nome, text: async () => texto })

let alertas
let confirmados
beforeEach(() => {
  alertas = []
  confirmados = []
  // Armazenamento de mentira, em memória: o import só aplica depois de guardar
  // a cópia de segurança (princípio 7), e neste Node o `localStorage` global
  // existe mas `setItem` NÃO é função (a armadilha documentada em util.js) —
  // sem o stub o fluxo pararia na cópia de segurança e nunca chegaria ao aviso.
  const mem = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  })
  vi.spyOn(window, 'alert').mockImplementation((t) => alertas.push(t))
  vi.spyOn(window, 'confirm').mockImplementation((t) => {
    confirmados.push(t)
    return true
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function soltarArquivo(texto, store) {
  let depois = null
  const setStore = (fn) => {
    depois = typeof fn === 'function' ? fn(store) : fn
  }
  render(<ImportModal store={store} setStore={setStore} abrir={() => {}} onClose={() => {}} />)
  const input = document.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', {
    value: [arquivoFalso('backup.json', texto)],
    configurable: true,
  })
  fireEvent.change(input)
  await waitFor(() => expect(alertas.length).toBe(1))
  return depois
}

describe('o fio na tela: backup com festas SEM identificação', () => {
  it('as 3 festas entram no store e o aviso diz "3 festas entraram" (antes dizia 3 e entrava 1)', async () => {
    const depois = await soltarArquivo(
      arquivoJSON([festa('Brisa 05/12', 700), festa('Marfim Alto 09/05', 600), festa('O Galeao 14/03', 360)]),
      storeVazio()
    )
    expect(depois.eventos).toHaveLength(3)
    expect(depois.eventos.reduce((s, e) => s + computeCenario(e, 'realista').bruta, 0)).toBe(149400)
    expect(alertas[0]).toContain('3 festas entraram')
  })

  it('o aviso nomeia as 3 que ganharam identificação e avisa que reimportar repete', async () => {
    await soltarArquivo(
      arquivoJSON([festa('Brisa 05/12', 700), festa('Marfim Alto 09/05', 600), festa('O Galeao 14/03', 360)]),
      storeVazio()
    )
    expect(alertas[0]).toContain('3 delas não tinham identificação')
    expect(alertas[0]).toContain('Brisa 05/12')
    expect(alertas[0]).toContain('Marfim Alto 09/05')
    expect(alertas[0]).toContain('O Galeao 14/03')
    expect(alertas[0]).toContain('ESTE MESMO arquivo outra vez')
  })

  it('mistura (1 com id + 2 sem): entram 3, e o aviso fala só das 2 que ganharam', async () => {
    const depois = await soltarArquivo(
      arquivoJSON([festa('Brisa 05/12', 700, 'ev-brisa'), festa('Marfim Alto 09/05', 600), festa('O Galeao 14/03', 360)]),
      storeVazio()
    )
    expect(depois.eventos).toHaveLength(3)
    expect(depois.eventos.find((e) => e.nome === 'Brisa 05/12').id).toBe('ev-brisa')
    expect(alertas[0]).toContain('3 festas entraram')
    expect(alertas[0]).toContain('2 delas não tinham identificação')
    expect(alertas[0]).not.toContain('(Brisa 05/12,')
  })

  it('o número do aviso é o que ENTROU, contado com o store de ANTES: 1 nova + 1 atualizada', async () => {
    // Se a chamada usasse o store de DEPOIS do merge, "atualizada" viraria
    // "nova" — é este argumento que o fio prova.
    const store = { ...storeVazio(), eventos: [{ ...novoEvento('Brisa (versão antiga)'), id: 'ev-brisa' }] }
    await soltarArquivo(
      arquivoJSON([festa('Brisa 05/12', 700, 'ev-brisa'), festa('Marfim Alto 09/05', 600, 'ev-marfim')]),
      store
    )
    expect(alertas[0]).toContain('2 festas entraram')
    expect(alertas[0]).toContain('1 nova e 1 atualizada (mesma identificação)')
  })
})

describe('o outro lado — sem alarme falso', () => {
  it('backup normal (todas identificadas) não fala de identificação nova nem de reimportar', async () => {
    const depois = await soltarArquivo(
      arquivoJSON([festa('Brisa 05/12', 700, 'a'), festa('Marfim Alto 09/05', 600, 'b')]),
      storeVazio()
    )
    expect(depois.eventos).toHaveLength(2)
    expect(alertas[0]).toContain('2 festas entraram')
    expect(alertas[0]).not.toMatch(/identificação/i)
    expect(alertas[0]).not.toMatch(/ESTE MESMO arquivo/i)
    expect(alertas[0]).toContain('Proteção de dados')
  })

  it('AJUSTES › Backup: a MESMA verdade na outra tela de import (são duas)', async () => {
    // Duas telas importam backup JSON — Ajustes › Backup e "Importar evento
    // antigo". As duas mentiam o mesmo número; as duas têm de contar a verdade,
    // ou a correção vale só metade das vezes.
    let depois = null
    const store = storeVazio()
    render(
      <Ajustes
        store={store}
        setStore={(fn) => {
          depois = typeof fn === 'function' ? fn(store) : fn
        }}
        aparencia={formaAparencia(null)}
        setAparencia={() => {}}
        onBack={() => {}}
      />
    )
    const input = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', {
      value: [
        arquivoFalso(
          'backup.json',
          arquivoJSON([festa('Brisa 05/12', 700), festa('Marfim Alto 09/05', 600), festa('O Galeao 14/03', 360)])
        ),
      ],
      configurable: true,
    })
    fireEvent.change(input)
    await waitFor(() => expect(alertas.length).toBe(1))
    expect(depois.eventos).toHaveLength(3)
    expect(alertas[0]).toContain('3 festas entraram')
    expect(alertas[0]).toContain('3 delas não tinham identificação')
    expect(alertas[0]).toContain('ESTE MESMO arquivo outra vez')
  })

  it('a caixa de erro continua aparecendo para backup de OUTRO app — nada entra', async () => {
    let mexeu = false
    render(
      <ImportModal
        store={storeVazio()}
        setStore={() => {
          mexeu = true
        }}
        abrir={() => {}}
        onClose={() => {}}
      />
    )
    const input = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', {
      value: [arquivoFalso('backup.json', JSON.stringify({ app: 'outro-app', versao: 1, eventos: [] }))],
      configurable: true,
    })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByText(/Não foi possível ler o arquivo/)).toBeTruthy())
    expect(mexeu).toBe(false)
    expect(alertas).toHaveLength(0)
  })
})
