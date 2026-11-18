// @vitest-environment jsdom
//
// O gesto "usar um benchmark como base" — a TELA, que até 27/07/2026 não tinha
// teste nenhum (só o módulo puro, carregarBenchmark.test.js). Três achados do
// BACKLOG viram asserção aqui:
//
//   S4 — o botão não dizia que traz só o TOTAL. O Marco importou a planilha da
//        Marfim Alto Casa Norte com 81 linhas, clicou esperando as 81 e veio
//        uma linha por categoria. Agora o rótulo e o modal dizem a forma do
//        dado, e o modal aponta o caminho de quem quer as linhas ("Nova
//        edição", no card da festa, na tela inicial).
//   S3 — o "Desfazer" do toast devolvia o EVENTO INTEIRO: o que fosse digitado
//        nos 6 segundos de vida do toast ia junto. Aqui o fio inteiro é
//        exercitado — o que o modal manda gravar e o que ele manda desfazer.
//   S3 — a recusa de evento fechado do modal era código morto pela tela, e
//        ninguém sabia QUAL das duas travas segurava. Agora as duas têm teste
//        com nome próprio: o <fieldset disabled> do EventEditor (a viva) e a
//        recusa do modal (a redundância deliberada).
//
// Sem dublê de protecao.js nem de toast.js: os dois rodam de verdade — o
// snapshot é conferido lendo os snapshots gravados, e o toast é capturado
// pelo subscribeToast real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import CarregarBenchmarkModal from './CarregarBenchmarkModal.jsx'
import EventEditor from './EventEditor.jsx'
import { novoEvento, novoItem } from '../lib/defaults.js'
import { benchmarksVisiveis } from '../lib/benchmarks.js'
import { subscribeToast } from '../lib/toast.js'
import { loadSnapshots } from '../lib/protecao.js'

const STORE = {} // sem custom nem oculto: sobram os 4 benchmarks embutidos
const NOME_BM = benchmarksVisiveis(STORE).filter((b) =>
  Object.values(b.custos || {}).some((v) => v != null)
)[0].nome

const eventoAberto = (nome = 'Marfim Alto Casa Norte') => novoEvento(nome)
const eventoFechado = () => ({
  ...novoEvento('Marfim Alto Casa Norte'),
  status: 'fechado',
  fechamento: { em: '2026-07-20T21:00:00.000Z', foto: { resultado: { resultado: 1 } } },
})

const montarModal = (evento, extra = {}) => {
  const props = { evento, update: vi.fn(() => ({ ok: true })), store: STORE, bm: null, soCategoria: null, onClose: vi.fn(), ...extra }
  const r = render(<CarregarBenchmarkModal {...props} />)
  return { ...props, ...r }
}

// O EventEditor é o único lugar que renderiza o CostsTab — é lá que mora a
// trava viva. Mesmo elenco de props do EventEditor.evidencia.test.jsx.
const montarEditorNaAbaCustos = (evento) => {
  render(
    <EventEditor
      evento={evento}
      store={{ eventos: [evento], benchmarksCustom: [] }}
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
  fireEvent.click(screen.getByRole('button', { name: /^Custos$/ }))
  return screen.getByRole('button', { name: /Usar um benchmark como base/ })
}

const botaoAplicar = () => screen.getByRole('button', { name: /^Adicionar/ })
const itensDe = (ev, catId) => ev.categorias.find((c) => c.id === catId).itens

// Texto do PARÁGRAFO que contém `trecho` — nunca do modal inteiro.
// Por que existe (achado do revisor, 27/07/2026): asserção sobre
// `container.textContent` varre o modal todo, inclusive a TABELA de propostas,
// e por isso continua VERDE com o parágrafo adulterado. Mirar no <p> é o que
// faz a asserção falar do texto que ela diz estar conferindo.
// `getByText` casa o nó cujos filhos de TEXTO DIRETO batem (o <strong> quando o
// trecho está em negrito), então subimos ao <p> e lemos o textContent dele —
// que já inclui os negritos de volta.
const paragrafoDe = (trecho) => {
  const p = screen.getByText(trecho).closest('p')
  expect(p, `nenhum <p> contém ${trecho}`).toBeTruthy()
  return p.textContent
}

// O `localStorage` que chega a esta suíte é um objeto SEM métodos (o global
// experimental do Node sombreia o do jsdom — medido em 27/07/2026:
// `typeof localStorage.setItem` → 'undefined'). Sem uma gaveta que funcione,
// `protecao.js` não conseguiria gravar e o modal recusaria por falta de cópia
// de segurança — o teste passaria a medir a gaveta, não o modal. Storage de
// memória, então, para o snapshot do princípio 7 rodar DE VERDADE aqui (nada
// de dublê de protecao.js: quem é substituído é o navegador).
beforeEach(() => {
  const gaveta = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
    setItem: (k, v) => gaveta.set(k, String(v)),
    removeItem: (k) => gaveta.delete(k),
    clear: () => gaveta.clear(),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('O botão e o modal dizem que vem o TOTAL por categoria, não as linhas da planilha', () => {
  it('o botão da faixa de benchmarks anuncia "1 linha por categoria" — no rótulo e no tooltip', () => {
    const botao = montarEditorNaAbaCustos(eventoAberto())
    expect(botao.textContent).toContain('1 linha por categoria')
    expect(botao.getAttribute('title')).toMatch(/TOTAL de cada categoria/)
    expect(botao.getAttribute('title')).toMatch(/não as linhas de custo da planilha/)
  })

  it('o modal explica que benchmark é RESUMO e manda quem quer as linhas para "Nova edição", na tela inicial', () => {
    montarModal(eventoAberto())
    const explicacao = paragrafoDe('resumo')
    expect(explicacao).toContain('resumo')
    expect(explicacao).toContain('uma linha por categoria')

    const nota = paragrafoDe(/Quer as linhas de custo uma a uma/)
    expect(nota).toContain('Nova edição')
    expect(nota).toContain('tela inicial')
    // A nota tem de descrever o que duplicarNovaEdicao FAZ, lido em
    // src/lib/novaEdicao.js: mapeia todas as categorias com todos os itens,
    // grava `realizado: ''` e `status: STATUS_CUSTO_PADRAO` (= 'ESTIMADO', em
    // src/lib/statusCusto.js) e deixa `data: ''`. E Home.jsx pergunta ANTES,
    // num window.confirm, se os realizados da edição passada viram o novo
    // estimado — a nota promete essa pergunta, então ela é asserção também.
    expect(nota).toMatch(/todas as categorias e todos os itens de custo/)
    expect(nota).toMatch(/realizado em branco/)
    expect(nota).toMatch(/status de volta a ESTIMADO/)
    expect(nota).toMatch(/data nasce vazia/)
    expect(nota).toMatch(/pergunta antes/)
  })

  it('a nota NÃO promete a festa inteira — cópia idêntica é o OUTRO botão do card ("Duplicar")', () => {
    // O defeito que esta asserção nomeia (revisor, 27/07/2026): a nota dizia
    // "ele copia a festa inteira, com todos os itens de custo, já sem os
    // valores realizados". Não copia a festa inteira — duplicarNovaEdicao zera
    // data, realizado, vendidos até hoje e receita realizada, e devolve o
    // status de cada custo ao padrão. Cópia idêntica é duplicarCopia, no botão
    // "Duplicar" ao lado. Prometer a festa inteira aqui manda o Marco pelo
    // caminho errado achando que vai receber a festa como ela está.
    montarModal(eventoAberto())
    const nota = paragrafoDe(/Quer as linhas de custo uma a uma/)
    expect(nota).not.toMatch(/festa inteira/)
    expect(nota).toMatch(/[Nn]ão é uma cópia idêntica/)
  })

  it('no gesto POR CATEGORIA o mesmo texto fala em uma linha só, nomeando a categoria', () => {
    const bm = benchmarksVisiveis(STORE).find((b) => b.custos?.aeb != null)
    montarModal(eventoAberto(), { bm, soCategoria: 'aeb' })
    // MIRA NO PARÁGRAFO. A asserção anterior era
    // `expect(container.textContent).toContain('A&B')` e ficava VERDE com o
    // defeito de volta: a TABELA de propostas imprime "A&B" na coluna
    // Categoria, então o container tem "A&B" mesmo quando o parágrafo troca o
    // nome da categoria por texto fixo — provado pelo revisor em 27/07/2026,
    // que adulterou o trecho e viu os 9 testes seguirem verdes.
    const explicacao = paragrafoDe('uma linha só')
    expect(explicacao).toContain('uma linha só')
    expect(explicacao).toContain('A&B')
  })
})

describe('Evento fechado: a trava VIVA é o fieldset do EventEditor; a recusa do modal é o segundo cinto', () => {
  it('trava viva — com o evento fechado o botão nasce dentro de um <fieldset disabled> (o modal nem abre)', () => {
    const botao = montarEditorNaAbaCustos(eventoFechado())
    const fieldset = botao.closest('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset.hasAttribute('disabled')).toBe(true)
  })

  it('evento ABERTO: o mesmo botão NÃO nasce travado (a trava é condicional, não sempre-on)', () => {
    const botao = montarEditorNaAbaCustos(eventoAberto())
    expect(botao.closest('fieldset').hasAttribute('disabled')).toBe(false)
  })

  it('segundo cinto — chamado direto com evento fechado, o modal recusa em português e NADA é gravado', () => {
    const { update, onClose } = montarModal(eventoFechado())
    fireEvent.click(botaoAplicar())
    expect(screen.getByText(/Este evento está fechado/)).toBeTruthy()
    expect(screen.getByText(/NADA foi carregado/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled() // o modal fica aberto com o motivo à vista
    expect(loadSnapshots()).toHaveLength(0) // recusa ANTES do snapshot: nem cópia de segurança sai
  })
})

describe('O "Desfazer" do toast tira só o que o gesto criou (achado S3 — antes rebobinava o evento inteiro)', () => {
  // Fio completo: clica em aplicar, pega o updater que o modal mandou gravar,
  // simula o Marco digitando nos 6 segundos do toast e roda o updater do
  // "Desfazer" por cima do que ele digitou.
  const aplicarECapturar = (evento) => {
    let toast = null
    const parar = subscribeToast((t) => (toast = t))
    const { update, onClose } = montarModal(evento)
    fireEvent.click(botaoAplicar())
    parar()
    return { toast, update, onClose }
  }

  it('aplica: grava, guarda cópia de segurança nomeando a festa e oferece Desfazer', () => {
    const { toast, update, onClose } = aplicarECapturar(eventoAberto())
    expect(update).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toast.mensagem).toMatch(/^Adicionar .* — pronto$/)
    expect(toast.acaoLabel).toBe('Desfazer')
    const seg = loadSnapshots()
    expect(seg).toHaveLength(1)
    expect(seg[0].rotulo).toBe(`antes de carregar ${NOME_BM}`)
  })

  it('custo, lote e patrocínio digitados na janela do toast sobrevivem ao Desfazer; a linha carregada some', () => {
    const evento = eventoAberto()
    const { toast, update } = aplicarECapturar(evento)

    const depois = update.mock.calls[0][0](evento) // o que o modal mandou gravar
    expect(itensDe(depois, 'aeb').map((i) => i.servico)).toContain(NOME_BM)

    // o Marco digita nos 6 segundos em que o toast fica clicável
    const digitando = {
      ...depois,
      lotes: [{ id: 'l1', nome: 'Lote 1', preco: 120, quantidade: 300 }],
      patrocinios: [{ id: 'p1', patrocinador: 'Cerveja X', valor: 15000, estagio: 'proposta' }],
      categorias: depois.categorias.map((c) =>
        c.id === 'aeb' ? { ...c, itens: [...c.itens, novoItem({ servico: 'Gelo', estimado: 800 })] } : c
      ),
    }

    toast.onAcao()
    expect(update).toHaveBeenCalledTimes(2)
    const desfeito = update.mock.calls[1][0](digitando)

    expect(desfeito.lotes).toEqual(digitando.lotes) // o lote fica
    expect(desfeito.patrocinios).toEqual(digitando.patrocinios) // o patrocínio fica
    expect(itensDe(desfeito, 'aeb').map((i) => i.servico)).toEqual(['Gelo']) // o custo dele fica
    // e nenhuma linha do benchmark sobra em categoria alguma
    const sobrouDoBenchmark = desfeito.categorias.some((c) =>
      (c.itens || []).some((i) => i.servico === NOME_BM)
    )
    expect(sobrouDoBenchmark).toBe(false)
  })

  it('S4 callback acionado uma vez não reaplica depois de edição posterior', () => {
    const { toast, update } = aplicarECapturar(eventoAberto())
    toast.onAcao(); toast.onAcao()
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[0][1].carregamentoId).toBeTruthy()
    expect(update.mock.calls[1][1].desfazerCarregamentoId).toBe(update.mock.calls[0][1].carregamentoId)
  })

  it('o passo do histórico é nomeado nos dois sentidos (o botão ↶ não cai no rótulo do campo em foco)', () => {
    const { toast, update } = aplicarECapturar(eventoAberto())
    expect(update.mock.calls[0][1].rotulo).toMatch(/^adicionar .* da /)
    toast.onAcao()
    expect(update.mock.calls[1][1].rotulo).toMatch(/^desfazer adicionar .* da /)
  })
})

// Referência quebrada (revisão adversarial do PR #98, 05/10/2026): sem a
// recusa, `aplicarCarregar` copiava o 1e308 da referência para um custo da
// festa SÃ — o contágio da decisão do Marco de 26/07/2026 entrando por esta
// porta. O benchmark é o de depois de uma volta pelo localStorage: custoTotal
// null, e o 1e+308 da categoria inteiro.
describe('Referência com dado quebrado: o modal recusa e NADA é carregado', () => {
  const BM_QUEBRADO = {
    id: 'bm-quebrado',
    nome: 'Brisa promovida quebrada',
    custom: true,
    custoTotal: null,
    custos: { aeb: 3000, estrutura: 1e308 },
    receita: 40000,
    lucro: null,
    publico: 450,
  }

  it('recusa em português, nomeando a referência, sem gravar nem tirar snapshot', () => {
    const { update, onClose } = montarModal(eventoAberto(), { bm: BM_QUEBRADO })
    fireEvent.click(botaoAplicar())
    expect(screen.getByText(/A referência “Brisa promovida quebrada” tem valores que o app não consegue calcular/)).toBeTruthy()
    expect(screen.getByText(/NADA foi carregado/)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(loadSnapshots()).toHaveLength(0)
  })

  it('CONTRAPROVA: a mesma referência com valores de dinheiro carrega', () => {
    const { update } = montarModal(eventoAberto(), {
      bm: { ...BM_QUEBRADO, custoTotal: 15000, custos: { aeb: 3000, estrutura: 12000 }, lucro: 25000 },
    })
    fireEvent.click(botaoAplicar())
    expect(update).toHaveBeenCalledTimes(1)
  })
})
