// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://planejador.casa.example/"}
//
// A CÓPIA DA NUVEM, NA TELA (Marco, 05/10/2026, por questionário).
//
// A tela do Planejador sobe para o Railway em https://planejador.casa.example,
// atrás da entrada da casa. De lá a ponte com o Financeiro e o backup diário não
// funcionam — risco aceito pelo Marco. Antes desta data, abrir o app lá fazia a
// Home pedir "cole o token da ponte em Ajustes" A CADA abertura, e Ajustes dizia
// que o app "envia sozinho, 1× por dia" uma cópia ao Financeiro. As duas frases
// mentiriam na nuvem.
//
// Este arquivo roda o jsdom COM A ORIGEM DA NUVEM (linha 2) e afirma o que a
// tela mostra lá. O irmão pontePeloMac.evidencia.test.jsx roda na 4173 do Mac e
// afirma que lá nada mudou. A lógica mora em src/lib (ponteOrigem.js e
// backupExterno.js, com testes próprios); estes dois arquivos provam o FIO até a
// tela — que a Home e Ajustes chamam o módulo, em vez de repetir a frase velha.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import Ajustes from './Ajustes.jsx'
import EventEditor from './EventEditor.jsx'
import { FRASE_PONTE_SO_NO_MAC, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import { montarBotoesDaPonte } from './ponteNaTela.casos.jsx'
import { novoEvento } from '../lib/defaults.js'
import { ajustesVazio } from '../lib/premissas.js'
import { loadAparencia } from '../lib/aparencia.js'
import {
  MSG_BACKUP_NA_NUVEM,
  MSG_BACKUP_SEM_TOKEN,
  TEXTO_BACKUP_AUTOMATICO_NUVEM,
  TEXTO_BACKUP_AUTOMATICO_MAC,
} from '../lib/backupExterno.js'

function localStorageDeMentira() {
  const mapa = new Map()
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    get length() {
      return mapa.size
    },
    key: (i) => [...mapa.keys()][i] ?? null,
  }
}

const store = () => ({ eventos: [novoEvento('Marfim Alto')], benchmarksCustom: [], ajustes: ajustesVazio() })

let rede
beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
  rede = vi.fn(async () => {
    throw new Error('a nuvem não pode chamar a rede')
  })
  vi.stubGlobal('fetch', rede)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('na cópia da nuvem, a tela diz a verdade sobre a ponte', () => {
  it('o jsdom deste arquivo está mesmo na origem da nuvem', () => {
    expect(window.location.origin).toBe('https://planejador.casa.example')
  })

  it('Home: o aviso calmo da nuvem aparece, sem pedir token, e a rede não é chamada', async () => {
    render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
    expect(await screen.findByText(MSG_BACKUP_NA_NUVEM)).toBeTruthy()
    expect(screen.queryByText(MSG_BACKUP_SEM_TOKEN)).toBeNull()
    expect(rede).not.toHaveBeenCalled()
  })

  it('Home: o aviso aparece UMA vez — na segunda abertura neste navegador, não', async () => {
    const primeira = render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
    expect(await screen.findByText(MSG_BACKUP_NA_NUVEM)).toBeTruthy()
    primeira.unmount()
    render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
    // Dá tempo ao efeito da abertura de terminar antes de afirmar a ausência.
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText(MSG_BACKUP_NA_NUVEM)).toBeNull()
  })

  it('Ajustes › Backup: diz que não há envio automático; NÃO mostra campo nem botão do token, só onde a ponte funciona', () => {
    render(<Ajustes store={store()} setStore={vi.fn()} aparencia={loadAparencia()} setAparencia={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText(TEXTO_BACKUP_AUTOMATICO_NUVEM, { exact: false })).toBeTruthy()
    expect(screen.queryByText(TEXTO_BACKUP_AUTOMATICO_MAC, { exact: false })).toBeNull()
    // Achado A da revisão do PR #100: o campo e o botão do token, e a promessa
    // de que "o backup (diário e o botão manual) passa a enviá-lo", não existem
    // na nuvem — colar o token lá não resolve nada.
    expect(screen.queryByLabelText('Token da ponte com o Financeiro')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar token da ponte' })).toBeNull()
    const backup = document.querySelector('#ajustes-backup').textContent
    expect(backup).not.toContain('token_ponte.txt')
    expect(backup).not.toMatch(/passa a enviá-lo/)
    expect(screen.getByText(FRASE_PONTE_SO_NO_MAC)).toBeTruthy()
  })

  // Achado G da revisão do PR #100: os três botões da ponte ficam DESLIGADOS na
  // nuvem, e o title diz por quê.
  it('Ajustes: "Enviar ao Financeiro" desligado, com o motivo no title', () => {
    render(<Ajustes store={store()} setStore={vi.fn()} aparencia={loadAparencia()} setAparencia={vi.fn()} onBack={vi.fn()} />)
    const botao = screen.getByRole('button', { name: 'Enviar ao Financeiro' })
    expect(botao.disabled).toBe(true)
    expect(botao.title).toBe(TITULO_PONTE_NA_NUVEM)
  })

  it('Home: o atalho "Enviar ao Financeiro" da barra do topo desligado, com o motivo no title', () => {
    render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
    const botao = screen.getByRole('button', { name: /Enviar ao Financeiro/ })
    expect(botao.disabled).toBe(true)
    expect(botao.title).toBe(TITULO_PONTE_NA_NUVEM)
  })

  // Revisão de comportamento do PR #100 (item 5): os botões de curva e ritmo
  // também ficam desligados na nuvem — os SEIS botões da ponte, juntos.
  it('os SEIS botões da ponte desligados, todos com o motivo no title', () => {
    const botoes = montarBotoesDaPonte()
    expect(botoes).toHaveLength(6)
    for (const [rotulo, botao] of botoes) {
      expect(botao.disabled, rotulo).toBe(true)
      expect(botao.title, rotulo).toBe(TITULO_PONTE_NA_NUVEM)
    }
  })

  it('Evento: "Buscar dados do Financeiro" desligado, com o motivo no title', () => {
    render(
      <EventEditor
        evento={novoEvento('Marfim Alto')}
        store={{ eventos: [], benchmarksCustom: [] }}
        setStore={vi.fn()}
        aparencia={{}}
        update={vi.fn()}
        onBack={vi.fn()}
        onApresentar={vi.fn()}
        onRelatorio={vi.fn()}
        onModoRascunho={vi.fn()}
        onFecharEvento={vi.fn()}
        onReabrirEvento={vi.fn()}
      />
    )
    const botao = screen.getByRole('button', { name: /Buscar dados do Financeiro/ })
    expect(botao.disabled).toBe(true)
    expect(botao.title).toBe(TITULO_PONTE_NA_NUVEM)
  })
})
