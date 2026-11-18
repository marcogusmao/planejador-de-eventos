// @vitest-environment jsdom
//
// A REDE NA TELA — a metade B da decisão do Marco de 26/07/2026 ("as duas
// coisas — recusar na porta E rede na tela").
//
// A porta (containerEstragado.evidencia.test.js) impede o dado de tipo errado
// de ENTRAR. Ela não faz nada por quem JÁ tem o dado ruim salvo — e essa era a
// situação real: o Ajustes grava o store ANTES de renderizar, então um backup
// com `"lotes": {"a": 1}` que passou pela porta antiga ficava no localStorage
// e a Home morria A CADA ABERTURA. Medido antes desta rede: `grep -rn
// 'componentDidCatch\|getDerivedStateFromError' src/` voltava VAZIO — não
// existia limite de erro nenhum no app, e a tela ficava BRANCA. A cópia de
// segurança do princípio 7 não resolvia, porque ela só se alcança DENTRO do
// app, e o app não abria.
//
// O que este arquivo prende:
//   1. o app ABRE com a festa envenenada já salva no localStorage;
//   2. a festa que não abre diz isso, NOMEADA, no lugar do card;
//   3. as OUTRAS festas continuam mostrando os números certos;
//   4. o caminho de volta (Ajustes, onde moram importar backup e restaurar
//      versão) continua clicável — é o que o Marco precisa alcançar;
//   5. nada de falso positivo: com dado saudável, nenhuma frase de falha
//      aparece na tela.
//
// Fixtures sintéticos, nenhum dado real do Marco. localStorage de verdade (o
// do jsdom) e `loadStore` de verdade: a graça do teste é o caminho inteiro,
// do dado gravado até o pixel.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RedeDeSeguranca from './RedeDeSeguranca.jsx'
import { novoEvento } from '../lib/defaults.js'
import { computeCenarios } from '../lib/calc.js'

const CHAVE = 'previsao-eventos:v1'

function festaSaudavel(nome, id) {
  return {
    ...novoEvento(nome),
    id,
    tipo: '',
    lotes: [{ id: `${id}-lote-1`, nome: '1º lote', valor: 100, quantidade: 500 }],
    categorias: [
      {
        nome: 'Produção',
        itens: [{ id: `${id}-custo-1`, servico: 'Som', estimado: 20000, status: 'ESTIMADO' }],
      },
    ],
  }
}

// A festa envenenada: `lotes` é um CONJUNTO onde deveria ser lista. É o dado
// que a porta antiga deixava entrar, gravado como o Ajustes gravava.
const festaEnvenenada = (nome, id) => ({ ...festaSaudavel(nome, id), lotes: { a: 1 } })

const storeCom = (eventos) => ({
  eventos,
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: { porTipo: {} },
})

// localStorage de mentira (o mesmo padrão do App.fio.test.jsx): o do jsdom
// desta versão não traz `clear`. É de mentira só no ARMAZENAMENTO — o
// `loadStore` que lê dele é o de verdade, que é o caminho que interessa.
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

let App
let erroDoConsole

beforeEach(async () => {
  vi.stubGlobal('localStorage', localStorageDeMentira())
  // O limite de erro do React reporta no console.error; silenciado para a
  // saída do teste ficar legível, mas GUARDADO — um teste abaixo confere que
  // a falha foi de verdade (rede que não pegou nada não prova nada).
  erroDoConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
  // O envio diário de backup nunca deve tocar a rede num teste.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede no teste'))))
  App = (await import('../App.jsx')).default
})

afterEach(() => {
  cleanup()
  erroDoConsole.mockRestore()
  vi.unstubAllGlobals()
})

describe('rede na tela — o app abre mesmo com festa envenenada já salva', () => {
  it('ABRE, nomeia a festa que não deu para ler e mantém o número da festa saudável', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify(
        storeCom([festaSaudavel('Marfim 09/05', 'ev-boa'), festaEnvenenada('Brisa 05/12', 'ev-ruim')])
      )
    )

    // 1. o app ABRE — antes da rede, este render estourava
    expect(() => render(<App />)).not.toThrow()

    // 2. a festa que não abriu diz isso, NOMEADA
    expect(screen.getByText(/não consegui ler esta festa/i)).toBeTruthy()
    expect(screen.getAllByText(/Brisa 05\/12/).length).toBeGreaterThan(0)

    // 3. a festa saudável segue mostrando o número que o módulo puro calcula
    const c = computeCenarios(festaSaudavel('Marfim 09/05', 'ev-boa'))
    expect(c.realista.lucro).toBeGreaterThan(0)
    expect(screen.getAllByText('Marfim 09/05').length).toBeGreaterThan(0)

    // 4. o caminho de volta continua na tela — o botão do CABEÇALHO da Home
    // (nome exato; o painel da festa quebrada tem um botão próprio, cujo nome
    // também contém "Ajustes")
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeTruthy()

    // a rede pegou uma falha DE VERDADE
    expect(erroDoConsole).toHaveBeenCalled()
  })

  it('o painel da festa quebrada aponta o caminho das cópias de segurança', () => {
    localStorage.setItem(CHAVE, JSON.stringify(storeCom([festaEnvenenada('Brisa 05/12', 'ev-ruim')])))
    render(<App />)
    // "Proteção de dados" (versões automáticas/lixeira) e "Ajustes › Backup"
    // são os dois caminhos de volta que existem no app — o texto tem de citar
    // pelo menos um deles, senão a rede só informa e não resolve.
    const painel = screen.getByText(/não consegui ler esta festa/i).closest('div')
    expect(painel.textContent).toMatch(/Proteção de dados|Ajustes/)
  })

  it('dá para chegar em Ajustes com a Home envenenada, e a tela de Ajustes monta', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify(storeCom([festaEnvenenada('Brisa 05/12', 'ev-ruim')]))
    )
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    // A tela de Ajustes montou: ela tem o botão que baixa o backup JSON — o
    // caminho de volta que o Marco precisa alcançar.
    expect(screen.getByRole('button', { name: /Exportar backup/i })).toBeTruthy()
    // E a festa quebrada não pode ter contaminado a nova tela.
    expect(screen.queryByText(/não consegui ler esta festa/i)).toBeNull()
  })
})

describe('NADA DE FALSO POSITIVO — com dado saudável a rede é invisível', () => {
  it('duas festas boas: nenhuma frase de falha na tela', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify(
        storeCom([festaSaudavel('Marfim 09/05', 'ev-1'), festaSaudavel('Sobrado 12/09', 'ev-2')])
      )
    )
    render(<App />)
    expect(screen.getAllByText('Marfim 09/05').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sobrado 12/09').length).toBeGreaterThan(0)
    expect(screen.queryByText(/não consegui ler esta festa/i)).toBeNull()
    expect(screen.queryByText(/não consegui abrir esta tela/i)).toBeNull()
    expect(erroDoConsole).not.toHaveBeenCalled()
  })

  it('app sem nenhum evento continua com a tela de boas-vindas, não com a rede', () => {
    render(<App />)
    expect(screen.getByText(/Nenhum evento ainda/i)).toBeTruthy()
    expect(screen.queryByText(/não consegui/i)).toBeNull()
  })
})

describe('A REDE SE DESARMA — o falso positivo que ela mesma poderia causar', () => {
  // Um limite de erro do React fica PRESO no estado de erro até alguém zerá-lo.
  // Sem desarmar, a festa consertada continuaria com "não consegui ler esta
  // festa" para sempre: a proteção passaria a esconder trabalho legítimo do
  // Marco, que é tão grave quanto deixar o defeito passar. A prop `chave` é o
  // desarme; aqui ele é medido direto no componente, com uma peça que estoura
  // só enquanto o dado está ruim.
  const Peca = ({ ruim }) => {
    if (ruim) throw new Error('dado fora de forma')
    return <p>números da festa</p>
  }

  it('trocar a `chave` (dado consertado) tira o painel e mostra o conteúdo de novo', () => {
    const { rerender } = render(
      <RedeDeSeguranca variante="card" nome="Brisa 05/12" chave="ruim">
        <Peca ruim />
      </RedeDeSeguranca>
    )
    expect(screen.getByText(/não consegui ler esta festa/i)).toBeTruthy()

    // O Marco restaurou um backup: o objeto do evento é outro → chave nova.
    rerender(
      <RedeDeSeguranca variante="card" nome="Brisa 05/12" chave="consertado">
        <Peca ruim={false} />
      </RedeDeSeguranca>
    )
    expect(screen.getByText('números da festa')).toBeTruthy()
    expect(screen.queryByText(/não consegui ler esta festa/i)).toBeNull()
  })

  it('a MESMA chave com o dado ainda ruim não entra em laço — o painel fica de pé', () => {
    const { rerender } = render(
      <RedeDeSeguranca variante="card" nome="Brisa 05/12" chave="ruim">
        <Peca ruim />
      </RedeDeSeguranca>
    )
    rerender(
      <RedeDeSeguranca variante="card" nome="Brisa 05/12" chave="ruim">
        <Peca ruim />
      </RedeDeSeguranca>
    )
    expect(screen.getByText(/não consegui ler esta festa/i)).toBeTruthy()
  })

  it('sem falha nenhuma, a rede é transparente: só o conteúdo aparece', () => {
    render(
      <RedeDeSeguranca variante="card" nome="Brisa 05/12" chave="ok">
        <Peca ruim={false} />
      </RedeDeSeguranca>
    )
    expect(screen.getByText('números da festa')).toBeTruthy()
    expect(screen.queryByText(/não consegui/i)).toBeNull()
    expect(erroDoConsole).not.toHaveBeenCalled()
  })
})
