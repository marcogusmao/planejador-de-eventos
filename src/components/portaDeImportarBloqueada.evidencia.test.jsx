// @vitest-environment jsdom
//
// LEITURA FALHOU = PORTA DE ESCRITA FECHADA, TAMBÉM NO CABEÇALHO.
//
// Medido em 27/07/2026, na Home: com a gravação bloqueada (loadStore não
// conseguiu ler o dado salvo), a tela vazia de baixo é escrita de propósito
// SEM nenhuma porta de escrita — ela diz "Não crie nada aqui agora: siga o
// aviso vermelho no topo da tela e restaure uma versão em Proteção de dados".
// O botão "Importar evento antigo" do CABEÇALHO, porém, continuava clicável e
// abria o fluxo inteiro de importação de planilha.
//
// O que isso custa: não é perda de dado — saveStore recusa gravar enquanto a
// trava está de pé (leituraCorrompida.test.js prova isso) e o App acende a
// faixa vermelha. É TRABALHO PERDIDO, e do tipo caro: o Marco escolhe o
// arquivo .xlsx, revisa item a item na prévia, clica em salvar — e só então
// descobre que nada foi gravado.
//
// O irmão desta porta já fazia certo e serviu de molde: a ponte com o
// Financeiro (EventEditor.jsx) usa `disabled={eventoFechado(evento)}` com o
// motivo escrito no `title`.
//
// O que este arquivo AFIRMA:
//   1. com a gravação bloqueada, o botão do cabeçalho está desabilitado;
//   2. o motivo aparece em português de leigo no `title`, dizendo o que fazer
//      (restaurar em "Proteção de dados") — botão apagado sem explicação é só
//      um beco sem saída;
//   3. clicar nele nesse estado NÃO abre o fluxo de importação;
//   4. sem falha de leitura, o mesmo botão continua clicável, com o title de
//      sempre, e o modal ABRE — a trava não pode virar estorvo no dia a dia.
//
// Nada de dado real do Marco: localStorage de mentira e um JSON truncado
// sintético, no mesmo molde de leituraCorrompida.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import { loadStore, gravacaoBloqueada, liberarGravacao } from '../lib/storage.js'

const CHAVE = 'previsao-eventos:v1'
const NOME_DO_BOTAO = /Importar evento antigo/

// localStorage de mentira com a superfície que storage.js usa (getItem,
// setItem, removeItem, length, key) — a varredura da quarentena precisa de
// length/key, e sem eles a falha de leitura nem chegaria a ser registrada.
function localStorageDeMentira(inicial = {}) {
  const mem = new Map(Object.entries(inicial))
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i) => [...mem.keys()][i] ?? null,
  }
}

const montar = () => {
  const props = {
    // A lista vazia é o estado REAL deste cenário: quando a leitura falha,
    // loadStore devolve o store vazio — é justamente por isso que a tela de
    // baixo é a tela vazia, e por isso o cabeçalho é a única porta que sobra.
    store: { eventos: [], benchmarksCustom: [] },
    setStore: vi.fn(),
    aparencia: {},
    abrir: vi.fn(),
    abrirAjustes: vi.fn(),
  }
  render(<Home {...props} />)
  return props
}

beforeEach(() => {
  // O console.error de storage.js é esperado no caminho da falha; silenciar
  // evita ruído sem esconder nada (a falha é conferida por gravacaoBloqueada).
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  // A trava é estado de MÓDULO: sem destravar aqui, um teste contamina o
  // seguinte e o caso "sem falha de leitura" viraria falso vermelho.
  liberarGravacao()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Home — gravação bloqueada por falha de leitura', () => {
  beforeEach(() => {
    // JSON truncado: o dado do Marco existe, mas não abre. É o gatilho real da
    // trava — nada de forçar a flag por dentro.
    vi.stubGlobal(
      'localStorage',
      localStorageDeMentira({ [CHAVE]: '{"eventos":[{"id":"brisa","nome":"Brisa 14/03"' })
    )
    loadStore()
    expect(gravacaoBloqueada()).toBe(true) // pré-condição do cenário
  })

  it('o botão "Importar evento antigo" do cabeçalho está DESABILITADO', () => {
    montar()
    expect(screen.getByRole('button', { name: NOME_DO_BOTAO }).disabled).toBe(true)
  })

  it('o motivo está no title, em português de leigo, e diz o que fazer', () => {
    montar()
    const title = screen.getByRole('button', { name: NOME_DO_BOTAO }).getAttribute('title')
    expect(title).toMatch(/não conseguiu ler seus dados salvos/i)
    expect(title).toMatch(/Proteção de dados/)
  })

  it('clicar nele NÃO abre o fluxo de importação (o trabalho não chega a começar)', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: NOME_DO_BOTAO }))
    expect(screen.queryByRole('heading', { name: 'Importar evento antigo' })).toBeNull()
  })
})

describe('Home — leitura em ordem (o outro lado: a trava não pode estorvar)', () => {
  beforeEach(() => {
    // Navegador sem nada salvo = primeira vez no app, NÃO é falha de leitura.
    vi.stubGlobal('localStorage', localStorageDeMentira())
    loadStore()
    expect(gravacaoBloqueada()).toBe(false) // pré-condição do cenário
  })

  it('o botão continua clicável e com o title de sempre', () => {
    montar()
    const botao = screen.getByRole('button', { name: NOME_DO_BOTAO })
    expect(botao.disabled).toBe(false)
    expect(botao.getAttribute('title')).toMatch(/planilha \.xlsx de um evento passado/)
  })

  it('e clicar nele ABRE o fluxo de importação', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: NOME_DO_BOTAO }))
    expect(screen.getByRole('heading', { name: 'Importar evento antigo' })).toBeTruthy()
  })
})
