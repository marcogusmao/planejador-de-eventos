// @vitest-environment jsdom
//
// O FIO DO App.jsx — a classe de defeito que a frente 17 do MODELO-AUDITORIA
// nomeou e que nenhum teste pegava: "a lib pura estava testada, mas o FIO do
// componente não". O canário 2 do H3-AUDIT foi exatamente isso — um
// `useCallback` com dependências velhas fez o "Aplicar ao evento" parar de
// salvar EM SILÊNCIO, e nem a suíte nem a varredura de números acusaram.
// `PresentationMode.test.jsx` fechou aquele componente; o App.jsx, que é onde
// moram a ÚNICA porta de escrita do store e todas as faixas de aviso, não tinha
// nenhum teste (o próprio modelo registrava "não existe App.test.js").
//
// Este arquivo NÃO busca cobertura de linhas. Ele prende os fios em que uma
// dependência velha, um efeito com `[]` no lugar de `[store]` ou um handler
// removido fazem o app PARAR DE FAZER e não avisar ninguém:
//   1. mudança na tela → `saveStore` com o store NOVO (o auto-save);
//   2. mudança na tela → `window.__backupAoSair()` com o store NOVO (o backup
//      da casca nativa, que é um `useEffect([store])` — o padrão exato do
//      canário 2);
//   3. mudança na tela → Cmd+Z devolve (o atalho, achado S3-F);
//   4. gravação/leitura que falha → a faixa vermelha CERTA, em português;
//   5. segunda aba → a faixa âmbar (a metade de tela que
//      duasAbasSalvando.test.js declara que não cobre);
//   6. o fio até o CÁLCULO: o número da tela é o que o módulo puro devolve.
//
// Fixtures sintéticos. `storage.js` é mockado nas duas pontas (loadStore/
// saveStore) de propósito: o miolo dele já tem teste próprio
// (leituraCorrompida.test.js, storageQuota.test.js) — aqui o que se mede é o
// FIO entre a tela e ele.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { computeCenarios, CENARIOS } from '../lib/calc.js'
import { formatadorCompacto } from '../lib/format.js'
import { novoEvento } from '../lib/defaults.js'

// Bancada compartilhada com os mocks (declarada antes do vi.mock por causa do
// hoisting: os factories abaixo só a LEEM quando o teste já rodou o beforeEach).
const bancada = {
  store: null,
  saves: [],
  resultadoSave: { ok: true },
  leitura: null,
  acenderOutraAba: false,
}

vi.mock('../lib/storage.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return {
    ...real,
    loadStore: () => bancada.store,
    saveStore: (s) => {
      bancada.saves.push(s)
      return bancada.resultadoSave
    },
    estadoLeitura: () => bancada.leitura,
  }
})

// O vigia de abas de verdade abre um BroadcastChannel; aqui ele é um interruptor.
// (O protocolo real tem teste próprio em multiAba.test.js.)
vi.mock('../lib/multiAba.js', () => ({
  vigiarOutrasAbas: (aoMudar) => {
    if (bancada.acenderOutraAba) aoMudar(true)
    return () => {}
  },
}))

// Festa sintética com números redondos: 500 ingressos a R$ 100, custo de
// R$ 20.000. Nenhum dado real do Marco.
function festaDeTeste(nome, id) {
  return {
    ...novoEvento(nome),
    id,
    lotes: [{ id: `${id}-lote-1`, nome: '1º lote', valor: 100, quantidade: 500 }],
    categorias: [
      { nome: 'Produção', itens: [{ id: `${id}-custo-1`, servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
    ],
  }
}

const storeDeTeste = (eventos) => ({
  eventos,
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: { porTipo: {} },
})

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
beforeEach(async () => {
  bancada.store = storeDeTeste([festaDeTeste('Festa de Teste', 'ev-1')])
  bancada.saves = []
  bancada.resultadoSave = { ok: true }
  bancada.leitura = null
  bancada.acenderOutraAba = false
  vi.stubGlobal('localStorage', localStorageDeMentira())
  App = (await import('../App.jsx')).default
})

afterEach(() => {
  cleanup()
  delete window.__backupAoSair
  vi.unstubAllGlobals()
})

const ultimoSave = () => bancada.saves.at(-1)
const duplicar = () => fireEvent.click(screen.getAllByLabelText('Duplicar (cópia idêntica)')[0])

describe('App — o fio da MUDANÇA até o auto-save', () => {
  it('duplicar um evento manda o store NOVO (2 eventos) para o saveStore', () => {
    render(<App />)
    expect(ultimoSave().eventos).toHaveLength(1) // o save da montagem

    duplicar()

    // Com um efeito de dependência velha (`[]` no lugar de `[store]`), o
    // auto-save continuaria gravando o store da MONTAGEM: 1 evento para sempre,
    // e a cópia do Marco nunca chegaria ao disco — em silêncio.
    expect(ultimoSave().eventos).toHaveLength(2)
    expect(ultimoSave().eventos.map((e) => e.nome)).toContain('Festa de Teste (cópia)')
  })

  it('o auto-save grava a CADA mudança, não só na primeira', () => {
    render(<App />)
    duplicar()
    duplicar()
    expect(ultimoSave().eventos).toHaveLength(3)
  })
})

describe('App — o fio até o backup ao SAIR (o padrão exato do canário 2)', () => {
  it('window.__backupAoSair devolve o store de AGORA, não o da montagem', () => {
    render(<App />)
    expect(JSON.parse(window.__backupAoSair()).eventos).toHaveLength(1)

    duplicar()

    // Este é o `useEffect([store])` que o canário 2 quebraria: com a
    // dependência velha, o app sairia gravando um backup do estado de quando
    // abriu — arquivo com cara de bom, conteúdo desatualizado.
    const payload = JSON.parse(window.__backupAoSair())
    expect(payload.eventos).toHaveLength(2)
    expect(payload.app).toBe('previsao-eventos')
    expect(payload.versao).toBe(1)
  })

  // ── O "SAIR" QUE FALHA (achado S3, 30/08/2026) ──────────────────────────
  // Era `catch { return '' }`, mudo. O lado Swift guarda com `!json.isEmpty`,
  // então nada era sobrescrito — e nenhum arquivo aparecia, sem uma palavra.
  it('quando o store não serializa, o "Sair" devolve "" e deixa a marca no disco', async () => {
    // O caso plausível de verdade: algo no store que o JSON não consegue
    // serializar. Entra pelo DADO (o store da bancada), não por dublê do
    // módulo — é o caminho inteiro, do App até o backupAoSair.js.
    const circular = { id: 'ev-circular', nome: 'Festa Circular' }
    circular.eu = circular
    bancada.store = storeDeTeste([circular])
    // O snapshot de segurança (protecao.js) grita no console com este store, e
    // com razão. Capturado para a saída da suíte não parecer quebrada — e
    // afirmado, porque calar o grito seria trocar um silêncio por outro.
    const gritou = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)
    expect(gritou).toHaveBeenCalled()
    expect(window.__backupAoSair()).toBe('')
    const { falhaBackupAoSair } = await import('../lib/backupAoSair.js')
    expect(falhaBackupAoSair().motivo).toMatch(/circular/i)
  })
})

describe('App — o fio do atalho de desfazer (achado S3-F)', () => {
  it('Cmd+Z na página de trabalho desfaz a duplicação e o auto-save grava o desfeito', () => {
    render(<App />)
    duplicar()
    expect(ultimoSave().eventos).toHaveLength(2)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    // Sem o listener (ou com ele preso num `historicoAtivo` velho), nada
    // acontece e o teste morde. O que se prova aqui é o fio inteiro:
    // tecla → interpretarAtalho → reducer → store → auto-save.
    expect(ultimoSave().eventos).toHaveLength(1)
    expect(screen.getAllByLabelText('Duplicar (cópia idêntica)')).toHaveLength(1)
  })

  it('Cmd+Shift+Z refaz — e o caminho de ida e volta é 2 → 1 → 2', () => {
    // A ida é afirmada AQUI de novo de propósito: sem ela, um refazer que nunca
    // rodou passaria pelo teste só porque o store já tinha 2 eventos.
    render(<App />)
    duplicar()
    expect(ultimoSave().eventos).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(ultimoSave().eventos).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    expect(ultimoSave().eventos).toHaveLength(2)
  })
})

describe('App — o fio das FAIXAS de aviso (nada falha em silêncio)', () => {
  it('gravação que falha vira faixa vermelha em português, com a saída de exportar', () => {
    bancada.resultadoSave = { ok: false, erro: 'armazenamento do navegador cheio' }
    render(<App />)
    const faixa = screen.getByText(/Não deu para salvar suas alterações no navegador/).closest('div')
    expect(faixa).toBeTruthy()
    // A saída tem de estar DENTRO da faixa (a Home tem um botão de mesmo nome —
    // por isso a busca é escopada): faixa que avisa sem oferecer saída é só susto.
    expect(within(faixa).getByRole('button', { name: /Exportar backup agora/ })).toBeTruthy()
  })

  it('leitura que falhou vira a OUTRA faixa — a que manda não editar nada', () => {
    bancada.leitura = {
      em: '2026-07-25T03:00:00.000Z',
      erro: 'conteúdo ilegível',
      bytes: 1234,
      quarentenaOk: true,
      chaveQuarentena: 'previsao-eventos:quarentena:2026-07-25T03:00:00.000Z',
    }
    bancada.resultadoSave = { ok: false, bloqueado: true, erro: 'gravação bloqueada' }
    render(<App />)
    expect(screen.getByText(/Não foi possível LER os dados salvos neste navegador/)).toBeTruthy()
    expect(screen.getByText(/Não crie nem edite eventos agora/)).toBeTruthy()
    // As duas faixas são excludentes: a de quota NÃO aparece junto.
    expect(screen.queryByText(/Não deu para salvar suas alterações no navegador/)).toBeNull()
  })

  it('gravação em ordem NÃO mostra faixa nenhuma (o outro lado — sem alarme falso)', () => {
    render(<App />)
    expect(screen.queryByText(/Não deu para salvar suas alterações/)).toBeNull()
    expect(screen.queryByText(/Não foi possível LER os dados salvos/)).toBeNull()
    expect(screen.queryByText(/outra aba ou janela/)).toBeNull()
  })

  it('segunda aba aberta acende a faixa âmbar que explica a sobrescrita', () => {
    // A metade que duasAbasSalvando.test.js declara NÃO cobrir: ali fica provado
    // que a perda é real e que o vigia acende; aqui, que a tela diz isso.
    bancada.acenderOutraAba = true
    render(<App />)
    expect(screen.getByText(/outra aba ou janela/)).toBeTruthy()
    expect(screen.getByText(/a última que salvar sobrescreve a outra/)).toBeTruthy()
  })

  // ── A FAIXA DO BACKUP AO SAIR (achado S3, 30/08/2026) ────────────────────
  // A falha acontece com a janela fechando: não há tela, não há tempo de ler.
  // O aviso espera no disco e aparece na abertura seguinte, que é quando ele
  // pode fazer algo a respeito.
  const marcarFalhaAoSair = (motivo = 'Invalid string length') =>
    localStorage.setItem(
      'previsao-eventos:backup-ao-sair:falha:v1',
      JSON.stringify({ em: '2026-08-29T22:10:00.000Z', motivo })
    )

  it('a marca do "Sair" anterior vira faixa na abertura, com o motivo em português', () => {
    marcarFalhaAoSair()
    render(<App />)
    expect(screen.getByText(/O backup automático da última saída não foi gravado/)).toBeTruthy()
    // e diz o que NÃO aconteceu, para não assustar à toa: nada se perdeu
    expect(screen.getByText(/nada foi sobrescrito/)).toBeTruthy()
    expect(screen.getByText('Invalid string length')).toBeTruthy()
  })

  it('marca com instante ilegível não vira " da saída de ." na frente do Marco', () => {
    // `fmtDataHora` devolve '' para um instante que não formata. Sem a guarda,
    // a frase saía com um ponto solto depois de "de" — uma data inválida
    // virando texto quebrado, que é a mesma família do achado do "0/dia".
    localStorage.setItem(
      'previsao-eventos:backup-ao-sair:falha:v1',
      JSON.stringify({ em: 'abacaxi', motivo: 'Invalid string length' })
    )
    render(<App />)
    const faixa = screen.getByText(/O backup automático da última saída/).closest('div')
    expect(faixa.textContent).toContain('cópia em arquivo. Motivo que o navegador deu')
    expect(faixa.textContent).not.toContain('da saída de .')
    // e o motivo, que é a parte acionável, continua lá
    expect(faixa.textContent).toContain('Invalid string length')
  })

  it('sem marca, faixa nenhuma — o aviso não é paisagem', () => {
    render(<App />)
    expect(screen.queryByText(/O backup automático da última saída/)).toBeNull()
  })

  it('"Esconder o aviso" some com a faixa E apaga a marca (não volta na próxima abertura)', () => {
    marcarFalhaAoSair()
    render(<App />)
    fireEvent.click(screen.getByText('Esconder o aviso'))
    expect(screen.queryByText(/O backup automático da última saída/)).toBeNull()
    expect(localStorage.getItem('previsao-eventos:backup-ao-sair:falha:v1')).toBeNull()
  })

  it('o botão que EXPORTA também apaga a marca — o rótulo dele promete as duas coisas', () => {
    // O download é do navegador; aqui ele é destravado (jsdom não tem
    // createObjectURL) para que o que se meça seja o EFEITO NO ESTADO, que é a
    // segunda coisa que o rótulo promete.
    const cliques = []
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      cliques.push(this.download)
    })
    marcarFalhaAoSair()
    render(<App />)
    fireEvent.click(screen.getByText('Exportar backup agora e esconder o aviso'))
    expect(cliques).toHaveLength(1) // o arquivo saiu de verdade
    expect(localStorage.getItem('previsao-eventos:backup-ao-sair:falha:v1')).toBeNull()
    expect(screen.queryByText(/O backup automático da última saída/)).toBeNull()
  })

  it('se a exportação ESTOURA, o aviso FICA — esconder o que não foi resolvido é o defeito', () => {
    // Sem createObjectURL (o que jsdom dá de graça), exportBackup lança. Um
    // `esconder` incondicional apagaria o aviso sem ter havido backup nenhum:
    // seria o mesmo silêncio que esta faixa veio consertar, com outra roupa.
    vi.stubGlobal('URL', {})
    const alertou = vi.fn()
    vi.stubGlobal('alert', alertou)
    marcarFalhaAoSair()
    render(<App />)
    fireEvent.click(screen.getByText('Exportar backup agora e esconder o aviso'))
    expect(alertou).toHaveBeenCalledWith(expect.stringMatching(/Não deu para exportar o backup/))
    expect(localStorage.getItem('previsao-eventos:backup-ao-sair:falha:v1')).toBeTruthy()
    expect(screen.getByText(/O backup automático da última saída/)).toBeTruthy()
  })
})

describe('App — o fio até o CÁLCULO (o número da tela é o do módulo puro)', () => {
  // Conferência da conta feita À MÃO, para o teste não virar espelho do código:
  //   450 ingressos (90% dos 500 no cenário realista) × R$ 100 = R$ 45.000
  //   − taxa de bilheteria 10% (R$ 4.500) − cashback 5% (R$ 2.250) = R$ 42.750
  //   custo R$ 20.000 + contingência 5% (R$ 1.000)                 = R$ 21.000
  //   lucro                                                        = R$ 21.750
  const LUCRO_REALISTA = 21750

  // O rótulo da tela vem do formatador compacto da casa (format.js, com teste
  // próprio) calibrado aos três cenários — usá-lo aqui mantém a asserção presa
  // ao NÚMERO calculado, sem depender de como o compacto arredonda hoje.
  const rotuloDoLucro = (evento) => {
    const c = computeCenarios(evento)
    return formatadorCompacto(CENARIOS.map((k) => c[k].lucro))(c.realista.lucro)
  }

  it('o card da Home mostra o lucro realista que computeCenarios devolve', () => {
    render(<App />)
    const evento = bancada.store.eventos[0]
    expect(computeCenarios(evento).realista.lucro).toBe(LUCRO_REALISTA)
    expect(screen.getByText(rotuloDoLucro(evento))).toBeTruthy()
  })

  it('o evento duplicado aparece com o SEU próprio número, calculado de novo', () => {
    render(<App />)
    const rotulo = rotuloDoLucro(bancada.store.eventos[0])
    duplicar()
    // Dois cards, dois lucros — se o App passasse um evento velho (memo com
    // dependência velha) para a Home, o segundo card não existiria ou repetiria
    // o objeto errado.
    expect(screen.getAllByText(rotulo)).toHaveLength(2)
  })
})
