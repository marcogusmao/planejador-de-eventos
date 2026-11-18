// Os casos da ponte na TELA do Mac, compartilhados por dois arquivos de teste
// que só diferem na ORIGEM do jsdom (Marco, 05/10/2026 — tela no Railway):
//   pontePeloMac.evidencia.test.jsx     → http://localhost:4173 (o "Iniciar Previsão.command")
//   pontePeloMac127.evidencia.test.jsx  → http://127.0.0.1:4173
// Nas duas, a mudança da nuvem não pode encostar: token pedido como sempre,
// Ajustes com campo e botão do token, e os SEIS botões da ponte ligados.
// Não é arquivo de teste (o vitest só roda *.test.*); é importado por eles. Os
// `it` ficam escritos NOS arquivos de teste, para o EVIDENCIA-TESTES.md (que lê
// o texto dos *.test.*) continuar listando cada caso pelo nome.
import { expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './Home.jsx'
import Ajustes from './Ajustes.jsx'
import EventEditor from './EventEditor.jsx'
import AnaliseTab from './AnaliseTab.jsx'
import CurvaVendas from './CurvaVendas.jsx'
import { RitmoTiqueteira } from './RevenueTab.jsx'
import { novoEvento } from '../lib/defaults.js'
import { ajustesVazio } from '../lib/premissas.js'
import { loadAparencia } from '../lib/aparencia.js'
import {
  MSG_BACKUP_NA_NUVEM,
  MSG_BACKUP_SEM_TOKEN,
  TEXTO_BACKUP_AUTOMATICO_NUVEM,
  TEXTO_BACKUP_AUTOMATICO_MAC,
} from '../lib/backupExterno.js'

export function localStorageDeMentira() {
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

/**
 * Os seis botões da ponte, cada um montado na tela onde mora. Devolve
 * `[rotulo, botao]`. Usado também pelo teste da nuvem.
 */
export function montarBotoesDaPonte() {
  const achados = []
  const pegar = (rotulo, nome) => {
    achados.push([rotulo, screen.getByRole('button', { name: nome })])
    cleanup()
  }
  render(<Ajustes store={store()} setStore={vi.fn()} aparencia={loadAparencia()} setAparencia={vi.fn()} onBack={vi.fn()} />)
  pegar('Ajustes › Enviar ao Financeiro', 'Enviar ao Financeiro')
  render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
  pegar('Home › Enviar ao Financeiro', /Enviar ao Financeiro/)
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
  pegar('Evento › Buscar dados do Financeiro', /Buscar dados do Financeiro/)
  render(<AnaliseTab evento={novoEvento('Marfim Alto')} update={vi.fn()} />)
  pegar('Análise › Buscar curva no Financeiro', /Buscar curva no Financeiro/)
  render(<CurvaVendas evento={novoEvento('Marfim Alto')} update={vi.fn()} breakEvenRealista={100} />)
  pegar('Cenários › curva › Buscar curva no Financeiro', /Buscar curva no Financeiro/)
  render(<RitmoTiqueteira evento={novoEvento('Marfim Alto')} update={vi.fn()} />)
  pegar('Receita › Buscar ritmo no Financeiro', /Buscar ritmo no Financeiro/)
  return achados
}

/** Prepara cada teste: armazenamento de mentira e uma rede que só falha. */
export function prepararAmbiente() {
  const estado = { rede: null }
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageDeMentira())
    estado.rede = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', estado.rede)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  return estado
}

/** Home sem token: a faixa pede o token, como sempre — e nada do aviso da nuvem. */
export async function conferirHomePedeToken(rede) {
  render(<Home store={store()} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
  expect(await screen.findByText(MSG_BACKUP_SEM_TOKEN)).toBeTruthy()
  expect(screen.queryByText(MSG_BACKUP_NA_NUVEM)).toBeNull()
  // Sem token o envio nem toca a rede (H2-B) — igual a antes.
  expect(rede).not.toHaveBeenCalled()
}

/** Ajustes › Backup como antes: frase do envio diário, campo e botão do token. */
export function conferirAjustesComToken() {
  render(<Ajustes store={store()} setStore={vi.fn()} aparencia={loadAparencia()} setAparencia={vi.fn()} onBack={vi.fn()} />)
  expect(screen.getByText(TEXTO_BACKUP_AUTOMATICO_MAC, { exact: false })).toBeTruthy()
  expect(screen.queryByText(TEXTO_BACKUP_AUTOMATICO_NUVEM, { exact: false })).toBeNull()
  expect(screen.getByText('ainda não configurado')).toBeTruthy()
  expect(screen.getByLabelText('Token da ponte com o Financeiro')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Salvar token da ponte' })).toBeTruthy()
}

/** Os seis botões da ponte LIGADOS, com os títulos de antes. */
export function conferirSeisBotoesLigados() {
  const botoes = montarBotoesDaPonte()
  expect(botoes).toHaveLength(6)
  for (const [rotulo, botao] of botoes) {
    expect(botao.disabled, rotulo).toBe(false)
    expect(botao.title, rotulo).not.toContain('cópia da nuvem')
  }
  const titulo = Object.fromEntries(botoes.map(([r, b]) => [r, b.title]))
  expect(titulo['Ajustes › Enviar ao Financeiro']).toContain('pasta de backups do Financeiro local')
  expect(titulo['Home › Enviar ao Financeiro']).toContain('pasta de backups do Financeiro local')
  expect(titulo['Evento › Buscar dados do Financeiro']).toContain('Financeiro local')
  expect(titulo['Análise › Buscar curva no Financeiro']).toContain('Financeiro local')
  expect(titulo['Cenários › curva › Buscar curva no Financeiro']).toContain('Financeiro local')
  expect(titulo['Receita › Buscar ritmo no Financeiro']).toBe('')
}
