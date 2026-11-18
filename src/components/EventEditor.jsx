import { useCallback, useEffect, useRef, useState } from 'react'
import { Btn, Field, TextInput, NumInput, Select, Bola, CampoData } from './ui.jsx'
import { FAIXA_QUANTIDADE } from '../lib/campoNumerico.js'
import {
  AppIcon,
  ICON_SIZE_STATUS,
  ArrowLeft,
  RefreshCw,
  Download,
  FileUp,
  Copy,
  FileText,
  Presentation,
  CircleCheck,
  TriangleAlert,
  CircleDollarSign,
  Receipt,
  ChartNoAxesCombined,
  ChartColumn,
  ClipboardCheck,
  FlaskConical,
} from './AppIcon.jsx'
import { TIPOS_PADRAO } from '../lib/defaults.js'
import { corFesta, temaEscuroEfetivo } from '../lib/aparencia.js'
import RevenueTab from './RevenueTab.jsx'
import CostsTab from './CostsTab.jsx'
import ScenariosTab from './ScenariosTab.jsx'
import AnaliseTab from './AnaliseTab.jsx'
import FechamentoTab from './FechamentoTab.jsx'
import FinanceiroModal from './FinanceiroModal.jsx'
import ExportarPagamentosModal from './ExportarPagamentosModal.jsx'
import OrcamentoProdutorModal from './OrcamentoProdutorModal.jsx'
import CopiarResumoModal from './CopiarResumo.jsx'
import { VeredictoPainel } from './Veredito.jsx'
import { LogoBrisa } from './Marca.jsx'
import { montarBenchmarkDeEvento, MOTIVO_SEM_BILHETERIA_REALIZADA } from '../lib/fechamento.js'
import { eventoFechado, carimbarBenchmark } from '../lib/fechamentoEvento.js'
import { motivoNaoPromover, motivoBenchmarkQuebrado, motivoReceitaInvalidaParaPromover } from '../lib/dadoQuebrado.js'
import { fmtData } from '../lib/format.js'
import { num, agora } from '../lib/util.js'
import {
  rascunhoDoEvento,
  editarRascunho,
  resumoDoRascunho,
  visaoDoRascunho,
  aplicarRascunho,
} from '../lib/simulacaoRascunho.js'
import {
  destinoDoDesfazer,
  NO_EVENTO,
  NO_RASCUNHO,
  FIM_APLICADO,
  FIM_DESCARTADO,
} from '../lib/desfazerDoRascunho.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { showToast } from '../lib/toast.js'
import { dataLocalDoInstante } from '../lib/dataLocal.js'
import { origemNaNuvem, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'

const TABS = [
  { id: 'receita', label: 'Receita', icon: CircleDollarSign },
  { id: 'custos', label: 'Custos', icon: Receipt },
  { id: 'cenarios', label: 'Cenários & Resultado', icon: ChartNoAxesCombined },
  // Análise (Sessão F2-C — sugestão 15): fluxo de caixa do evento, leitura
  // pura — semáforo e DRE não mudam por nada de lá.
  { id: 'analise', label: 'Análise', icon: ChartColumn },
  { id: 'fechamento', label: 'Fechamento', icon: ClipboardCheck },
]

// A rodada semanal abre direto onde o trabalho está: o editor lembra a
// última aba usada (chave própria). Evento ainda SEM lotes preenchidos abre
// na Receita — é o primeiro passo de uma previsão nova.
const ABA_KEY = 'previsao-eventos:aba-editor:v1'
const loadAba = () => {
  try {
    const v = localStorage.getItem(ABA_KEY)
    return TABS.some((t) => t.id === v) ? v : 'receita'
  } catch {
    return 'receita'
  }
}

export default function EventEditor({
  evento,
  store,
  setStore,
  aparencia,
  update,
  onBack,
  onApresentar,
  onRelatorio,
  onModoRascunho,
  onFecharEvento,
  onReabrirEvento,
}) {
  const [tab, setTabState] = useState(() =>
    (evento.lotes || []).some((l) => num(l.quantidade) > 0) ? loadAba() : 'receita'
  )
  const setTab = (t) => {
    setTabState(t)
    try {
      localStorage.setItem(ABA_KEY, t)
    } catch {
      // preferência cosmética
    }
  }
  const [ponteAberta, setPonteAberta] = useState(false)
  const [exportarAberto, setExportarAberto] = useState(false)
  const [orcamentoAberto, setOrcamentoAberto] = useState(false)
  const [resumoAberto, setResumoAberto] = useState(false)
  const [resumoCopiado, setResumoCopiado] = useState(null) // 'resumido' | 'completo'
  const patch = (p) => update((e) => ({ ...e, ...p }))

  // ————— Modo "Simular" (sugestão 35, Sessão F2-V) —————
  // O rascunho vive AQUI (React state, efêmero — morre ao sair do evento),
  // nunca no localStorage. Desde 05/08/2026 ele carrega três compartimentos —
  // cenários, bar por pessoa e bar fixo — porque o slider do bar entrou na
  // mesma grade (ver o cabeçalho de simulacaoRascunho.js). `eventoView` é a
  // visão que alimenta SÓ o semáforo e a aba Cenários (as superfícies da
  // spec); exports, resumo, relatório e as demais abas seguem lendo o SALVO —
  // um número de rascunho nunca sai do app como se fosse o número real.
  const [rascunho, setRascunho] = useState(null) // null = fora do modo
  const simulando = rascunho != null
  const eventoView = simulando ? visaoDoRascunho(evento, rascunho) : evento
  // Canal de escrita dos cenários: simulando, os MESMOS updaters da UI editam
  // o rascunho via editarRascunho (que não tem como persistir — ver
  // simulacaoRascunho.js); fora do modo, é o update real de sempre.
  //
  // A ESCOLHA DO CANAL É FEITA NA HORA DO CLIQUE, não na hora do render. O toast
  // do botão "Usar R$ X de bar nos três" oferece um "Desfazer" que sobrevive ao
  // fim da simulação (o toast dura 6 s; aplicar e descartar levam um clique).
  // Com o canal capturado no closure do render, o Desfazer clicado DEPOIS do
  // Aplicar chamava o roteador de rascunho num modo que já tinha acabado: não
  // desfazia nada E reabria o rascunho sozinho.
  //
  // Mas o estado ATUAL da tela não basta para decidir, e isso foi medido em
  // 05/08/2026: depois de DESCARTAR, o mesmo despacho mandava para o `update`
  // real um "antes" que tinha sido lido da VISÃO — ou seja, gravava no evento
  // justamente o número que o descarte prometeu não gravar (S1: R$ 213.728,20 de
  // receita descartada virando o bar salvo da Marfim). Por isso a ação agora
  // CARIMBA onde escreveu, e quem decide para onde vai o desfazer é a regra pura
  // de desfazerDoRascunho.js (Marco, 05/08/2026, por questionário — opção (a)).
  const canalCenarios = useRef(null)
  canalCenarios.current = simulando
    ? { alvo: NO_RASCUNHO, escrever: (fn) => setRascunho((r) => editarRascunho(r, evento, fn)) }
    : { alvo: NO_EVENTO, escrever: update }
  // O `update` real também vai por referência: o desfazer roteado precisa do
  // update de AGORA, não do que existia quando a ação aconteceu.
  const updateReal = useRef(update)
  updateReal.current = update
  // A identidade do rascunho (`geracao` sobe a cada entrada) e como o último
  // terminou. Vive em ref, e não em state, de propósito: é lido no clique de um
  // toast, não desenhado — mudar isso não pode causar render.
  const marcaRascunho = useRef({ geracao: 0, fim: null })

  /** Escreve pelo canal do momento e DEVOLVE o carimbo de onde caiu. */
  const updateCenarios = useCallback((fn, descritor) => {
    const { alvo, escrever } = canalCenarios.current
    escrever(fn, descritor)
    return { alvo, geracao: marcaRascunho.current.geracao }
  }, [])

  /**
   * Desfaz uma ação carimbada. Devolve para onde foi (NO_EVENTO / NO_RASCUNHO /
   * EM_LUGAR_NENHUM) para que a tela possa dizer em português quando não houve
   * o que desfazer — nada falha em silêncio (princípio 4).
   */
  const desfazerCenarios = useCallback((marca, fn, descritor) => {
    const destino = destinoDoDesfazer(marca, {
      simulando: canalCenarios.current.alvo === NO_RASCUNHO,
      geracao: marcaRascunho.current.geracao,
      fim: marcaRascunho.current.fim,
    })
    if (destino === NO_RASCUNHO) canalCenarios.current.escrever(fn, descritor)
    else if (destino === NO_EVENTO) updateReal.current(fn, descritor)
    return destino
  }, [])
  const mudancas = simulando ? resumoDoRascunho(rascunho, evento.lotes) : []

  // Avisa o App que há rascunho aberto: enquanto houver, o desfazer/refazer da
  // sessão fica desabilitado (a pilha é do store SALVO — desfazer ali desfaria
  // uma edição salva enquanto o Marco olha para um rascunho). Ver App.jsx. O
  // `false` na limpeza cobre sair do evento com a simulação aberta.
  useEffect(() => {
    onModoRascunho?.(simulando)
    return () => onModoRascunho?.(false)
  }, [simulando, onModoRascunho])
  const entrarSimulacao = () => {
    // Rascunho novo = geração nova: um Desfazer carimbado pela simulação
    // anterior deixa de ter para onde ir, em vez de cair nesta.
    marcaRascunho.current = { geracao: marcaRascunho.current.geracao + 1, fim: null }
    setRascunho(rascunhoDoEvento(evento))
  }
  const descartarSimulacao = () => {
    marcaRascunho.current = { ...marcaRascunho.current, fim: FIM_DESCARTADO }
    setRascunho(null)
    showToast('Simulação descartada — nada foi salvo no evento.')
  }
  const aplicarSimulacao = () => {
    if (mudancas.length === 0) return
    // Evento fechado: no EDITOR o fieldset já desabilita a entrada da
    // simulação junto com a aba Cenários; este portão fica de cinto — e é a
    // trava REAL do caminho da Apresentação, onde simular (olhar) continua
    // permitido mas APLICAR não. Sem ele, a trava do funil bloqueava a
    // gravação e o toast dizia "N mudanças aplicadas" sobre um store intacto
    // (achado adversarial 20/07/2026).
    if (eventoFechado(evento)) {
      showToast(
        'Este evento está fechado — a simulação NÃO foi aplicada. Reabra na aba Fechamento para editar.'
      )
      return
    }
    // Princípio 7: snapshot de segurança ANTES de gravar. Se o snapshot
    // falhar (quota cheia), NÃO aplica — nada de gravar sem caminho de volta.
    const seg = snapshotSeguranca(store, agora(), `antes de aplicar simulação — ${evento.nome}`)
    if (!seg.ok) {
      window.alert(
        `Não deu para criar o snapshot de segurança antes de aplicar (${seg.erro || 'armazenamento cheio'}). ` +
          'Nada foi aplicado — o rascunho continua na tela. Libere espaço em Ajustes › Proteção de dados e tente de novo.'
      )
      return
    }
    const n = mudancas.length
    // `aplicarRascunho` roda DENTRO do updater, sobre o evento fresco do
    // store: é ele que sabe qual slot vai em qual campo (cenários, bar por
    // pessoa, bar fixo) e clona antes de gravar. Os dois lugares que aplicam
    // — este e o da apresentação — passam pela MESMA função, de propósito:
    // um esquecimento num deles daria suíte verde e mentira na tela.
    update((e) => aplicarRascunho(e, rascunho), 'aplicar a simulação aos cenários')
    // O rascunho VIROU o evento: um Desfazer carimbado por ele passa a valer no
    // evento salvo, que é onde a mudança mora agora.
    marcaRascunho.current = { ...marcaRascunho.current, fim: FIM_APLICADO }
    setRascunho(null)
    showToast(
      `${n} ${n === 1 ? 'mudança aplicada' : 'mudanças aplicadas'} aos cenários — snapshot criado antes (Proteção de dados).`
    )
  }
  // Esc descarta (padrão da spec) — mas só quando nenhum modal está aberto:
  // o Esc do modal fecha o modal (listener próprio em Modal/ui.jsx), não o
  // rascunho da simulação.
  useEffect(() => {
    if (!simulando) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (ponteAberta || exportarAberto || orcamentoAberto || resumoAberto) return
      descartarSimulacao()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulando, ponteAberta, exportarAberto, orcamentoAberto, resumoAberto])

  const avisarCopiado = (nivel) => {
    setResumoCopiado(nivel)
    window.setTimeout(() => setResumoCopiado(null), 4000)
  }

  // Tipo de festa (sugestão 16): as 4 marcas do Financeiro + tipos custom já
  // usados em outras previsões + criar novo. Campo opcional ('' = sem categoria).
  const tiposCustom = [
    ...new Set(store.eventos.map((e) => e.tipo).filter((t) => t && t.trim())),
  ]
    .filter((t) => !TIPOS_PADRAO.includes(t))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const NOVO_TIPO = '__criar-tipo-novo__'
  const mudarTipo = (v) => {
    if (v !== NOVO_TIPO) {
      patch({ tipo: v })
      return
    }
    const nome = window.prompt(
      'Nome da nova festa (ela passa a aparecer no seletor e agrupa a Home):'
    )?.trim()
    if (nome) patch({ tipo: nome })
    // cancelado ou vazio: o seletor volta sozinho ao valor atual (controlado)
  }

  // Promover a benchmark (sugestão 5c): cria um benchmark CUSTOM a partir do
  // evento — os 4 embutidos nunca são tocados (princípio 3 do rulebook), e
  // nenhum benchmark JÁ SALVO é recalculado (restrição dura do Marco): este
  // caminho só ACRESCENTA um objeto novo à lista.
  //
  // A RECUSA (decisão 5 do Marco, 20/07/2026): sem bilheteria realizada
  // lançada, `montarBenchmarkDeEvento` devolve null e o botão explica o que
  // falta, em vez de gravar uma receita tirada da capacidade dos lotes.
  // O aviso vem ANTES do confirm — não faz sentido perguntar "quer criar?"
  // para em seguida dizer que não dá.
  const promoverBenchmark = () => {
    // Portão do fechamento (contrato da sessão de fechamento de evento): o
    // benchmark grava a foto de um evento FECHADO, nunca uma edição em
    // andamento — sem isso a régua de comparação nasceria de um número que
    // ainda pode mudar. O aviso vem antes de tudo, inclusive antes de checar
    // se há bilheteria realizada (essa checagem é sobre o CONTEÚDO da foto,
    // esta é sobre o evento já ter foto).
    if (!eventoFechado(evento)) {
      window.alert(
        `Para promover "${evento.nome}" a benchmark, primeiro faça o FECHAMENTO do evento (aba Fechamento) — o benchmark grava a foto de um evento fechado, não uma edição em andamento.`
      )
      return
    }
    // PORTÃO DO CONTÁGIO (26/07/2026). Promover uma festa com custo quebrado
    // GRAVA a corrupção num dado de referência — princípio 3 do CLAUDE.md,
    // benchmark é dado salvo. Medido rodando: o objeto que ia para
    // `store.benchmarksCustom` nascia com custoTotal Infinity, custos.estrutura
    // 1e+308 e lucro -Infinity, e daí em diante virava RÉGUA de outras festas.
    // Numa "Marfim de outubro" completamente sã, a comparação passava a
    // imprimir "Custo total — Marfim R$ 29 mil × Brisa quebrada R$ 0" e a
    // barra da festa sã encolhia para 2 pixels ao lado da barra cheia da
    // quebrada. Nenhum aviso em tela nenhuma.
    //
    // A escolha é RECUSAR, e não "deixar gravar e avisar depois", pela
    // assimetria: recusar custa corrigir um custo e clicar de novo; gravar não
    // tem volta — `montarBenchmarkDeEvento` nunca recalcula um benchmark salvo
    // (restrição dura do Marco), então o número errado fica na régua para
    // sempre. É o mesmo formato do portão que esta função já tem para a
    // bilheteria realizada (decisão 5 do Marco, 20/07/2026): texto em
    // português, dito ANTES de qualquer confirmação, nomeando o que falta.
    //
    // Isto não toca `montarBenchmarkDeEvento` (arquivo do portão do golden) nem
    // nenhuma conta: é uma pergunta a mais, feita antes.
    //
    // A RECUSA SAI NA TELA, NÃO NUMA JANELA (Marco, 05/10/2026, questionário).
    // Na origem (26/07/2026) ela era `window.alert`; agora vai pelo mesmo
    // toast que este editor já usa para recusar "Aplicar simulação" em evento
    // fechado. 20 s em vez dos 6 s padrão. O texto foi encurtado para DUAS
    // frases curtas (o que houve, o que fazer) em 05/10/2026: com três
    // parágrafos e 653 caracteres, o toast perdia as quebras de linha e virava
    // um bloco ilegível (revisão adversarial do PR #98). O ToastHost não foi
    // tocado.
    const motivoQuebrado = motivoNaoPromover(evento)
    if (motivoQuebrado) {
      showToast(motivoQuebrado, { duracao: 20000 })
      return
    }
    const motivoReceita = motivoReceitaInvalidaParaPromover(evento)
    if (motivoReceita) {
      showToast(motivoReceita, { duracao: 20000 })
      return
    }
    const bm = montarBenchmarkDeEvento(evento)
    if (!bm) {
      window.alert(
        `Ainda não dá para promover "${evento.nome}" a benchmark.\n\n${MOTIVO_SEM_BILHETERIA_REALIZADA}`
      )
      return
    }
    // A segunda pergunta da porta (05/10/2026): o benchmark MONTADO cabe na
    // régua? A primeira só olha custos; uma bilheteria ou um Pix realizado de
    // 1e308 passavam e gravavam receita e lucro que não são dinheiro.
    const motivoBm = motivoBenchmarkQuebrado(evento, bm)
    if (motivoBm) {
      showToast(motivoBm, { duracao: 20000 })
      return
    }
    if (
      !window.confirm(
        `Criar um benchmark de comparação a partir do FECHAMENTO de "${evento.nome}"? Ele grava o mesmo resultado do card "Resultado realizado" (bilheteria líquida + bar + patrocínio fechado, menos os custos considerados), sem reserva de contingência. Entra na lista como benchmark importado (pode ser removido depois); os benchmarks históricos embutidos e os já criados não mudam.`
      )
    )
      return
    setStore(
      (s) => ({
        ...s,
        benchmarksCustom: [...s.benchmarksCustom, bm],
        // Carimba no próprio evento o benchmark a que ele deu origem — o
        // card do fechamento usa isso para o selo "Benchmark" e para o
        // reabrir avisar do vínculo. `carimbarBenchmark` é pura e idempotente
        // (segura sob o double-invoke do StrictMode).
        eventos: s.eventos.map((e) => (e.id === evento.id ? carimbarBenchmark(e, bm.id) : e)),
      }),
      `criar o benchmark "${bm.nome}"`
    )
    window.alert(
      `Benchmark "${bm.nome}" criado com o resultado do fechamento. Ele já aparece nos chips de benchmark e na Home, marcado como "sem reserva" nas comparações.`
    )
  }

  // max-w-[1400px] (era 6xl/1152): em monitor largo a margem branca sobrava
  // dos dois lados enquanto a grade de Custos rolava de lado por falta de
  // largura — pedido do Marco, 20/07/2026. Telas menores seguem limitadas
  // pelo viewport; a densidade interna não muda.
  return (
    <div className={`mx-auto max-w-[1400px] px-4 py-6 ${simulando ? 'pb-24' : ''}`}>
      {/* linha 1: voltar · bola da festa · nome com espaço de verdade · salvo */}
      {/* flex-wrap: em tela estreita esta fileira não cabe em uma linha (o
          "Início", o logo e o "Salvo automaticamente" não encolhem) e antes
          ela VAZAVA por cima do que estivesse à direita. Agora quebra a linha.
          Em tela larga nada muda — continua tudo numa fileira só. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={onBack}>
          <AppIcon icon={ArrowLeft} /> Início
        </Btn>
        {/* bola na cor da festa (Aparência) — acento decorativo, não veredito.
            Na Brisa, o logo script oficial entra no lugar da bola (F2-B);
            o dot vermelho continua onde o logo não cabe. */}
        {(evento.tipo || '').trim() &&
          (evento.tipo.trim() === 'Brisa' ? (
            <LogoBrisa compacto height={22} className="mx-0.5" />
          ) : (
            <Bola size={16} cor={corFesta(evento.tipo, aparencia, temaEscuroEfetivo(aparencia))} title={evento.tipo} />
          ))}
        <input
          value={evento.nome}
          onChange={(e) => patch({ nome: e.target.value })}
          disabled={eventoFechado(evento)}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none hover:bg-[var(--papel)] focus:bg-[var(--papel)]"
          aria-label="Nome do evento"
        />
        <span className="shrink-0 text-xs text-[var(--tinta-3)]">
          Salvo automaticamente ·{' '}
          {new Date(evento.atualizadoEm).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Faixa de evento fechado: os números da foto estão congelados e os
          campos travados — dito aqui, antes de qualquer campo, para quem abre
          o editor não precisar chegar na aba Fechamento para descobrir por
          que nada responde ao toque. Tons neutros/âmbar de aviso (mesma
          receita do resto do app — alfa sobre var(--papel), nunca um
          bg-red-50 fixo que apaga no tema escuro). */}
      {eventoFechado(evento) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[rgba(180,145,0,0.4)] bg-[rgba(254,205,7,0.12)] px-3 py-2 text-sm text-[var(--ambar-texto)]">
          <AppIcon icon={TriangleAlert} size={ICON_SIZE_STATUS} className="shrink-0" />
          <span>
            Evento fechado em <strong>{fmtData(dataLocalDoInstante(evento.fechamento.em))}</strong> — os
            números do fechamento estão congelados e os campos travados. Para editar, reabra na
            aba Fechamento.
          </span>
        </div>
      )}

      {/* linha 2: metadados do evento — grade de campos da raiz (rótulos de
          altura reservada, inputs ancorados pela base: fileira sempre alinhada).
          O fieldset trava a fileira inteira em evento fechado (mesma verdade
          visual das abas de edição, abaixo). */}
      <fieldset disabled={eventoFechado(evento)} className="contents">
      <div className="mb-3 flex flex-wrap items-end gap-3 px-2">
        <Field label="Festa" className="w-44">
          <Select
            value={evento.tipo || ''}
            onChange={(e) => mudarTipo(e.target.value)}
            title="De qual festa é este evento — mesmos nomes das marcas do Financeiro. Opcional: sem categoria também vale."
            options={[
              { value: '', label: 'Sem categoria' },
              ...TIPOS_PADRAO.map((t) => ({ value: t, label: t })),
              ...tiposCustom.map((t) => ({ value: t, label: t })),
              { value: NOVO_TIPO, label: '+ Criar tipo novo…' },
            ]}
          />
        </Field>
        <Field label="Data" className="w-44">
          {/* Calendário próprio (Marco, 05/08/2026). Esta é a data de maior
              consequência do app: alimenta o ritmo de vendas, a curva, a
              Análise, o resumo do WhatsApp, o PDF e — em `curvaVendas` — uma
              comparação de STRING contra hoje. Por isso o componente só emite
              ISO válido: um "05/08/2026" vazado classificaria o evento como
              passado ou futuro pelo motivo errado, em silêncio. */}
          <CampoData value={evento.data || ''} onChange={(iso) => patch({ data: iso })} />
        </Field>
        <Field label="Local" className="w-44">
          <TextInput
            value={evento.local || ''}
            onChange={(e) => patch({ local: e.target.value })}
            placeholder="ex.: Komplexo Tempo"
          />
        </Field>
        <Field label="Público estimado" className="w-44">
          <NumInput
            value={evento.publicoEstimado}
            onChange={(v) => patch({ publicoEstimado: v })}
            min="0"
            step="1"
            placeholder="—"
            faixa={FAIXA_QUANTIDADE}
          />
        </Field>
      </div>
      </fieldset>

      {/* linha 3: barra de ações coesa — grupo DADOS (buscar/exportar) ·
          grupo COMPARTILHAR (copiar/relatório) · APRESENTAR (primária, à
          direita). Princípio 7: cada botão diz a ação e o efeito no title. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-2">
        <Btn
          onClick={() => setPonteAberta(true)}
          // Na cópia da nuvem (05/10/2026) a ponte não existe: desligado, e o
          // title diz por quê — antes do motivo de evento fechado, porque na
          // nuvem nem reabrir o evento faria a ponte funcionar.
          disabled={origemNaNuvem() || eventoFechado(evento)}
          title={
            origemNaNuvem()
              ? TITULO_PONTE_NA_NUVEM
              : eventoFechado(evento)
                ? 'Evento fechado — a ponte não pode aplicar valores. Reabra na aba Fechamento.'
                : 'Busca vendas e custos realizados no Financeiro local para você revisar e escolher o que aplicar — nada muda sem a sua confirmação.'
          }
        >
          <AppIcon icon={RefreshCw} /> Buscar dados do Financeiro
        </Btn>
        <Btn
          onClick={() => setExportarAberto(true)}
          title="Gera um arquivo com o plano ou os pagamentos deste evento — para o Financeiro, para o contador ou para você. Não altera nada aqui nem lá."
        >
          <AppIcon icon={Download} /> Exportar…
        </Btn>
        <Btn
          onClick={() => setOrcamentoAberto(true)}
          title="Planilha .xlsx do orçamento para o produtor ajustar e devolver — custos e patrocínio, com revisão antes de aplicar."
        >
          <AppIcon icon={FileUp} /> Planilha do produtor
        </Btn>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--borda-2)] sm:block" />
        <Btn
          onClick={() => setResumoAberto(true)}
          title="Copia um resumo em texto pronto para o WhatsApp — você escolhe entre Resumido e Completo ao clicar. Nada no evento muda."
        >
          <AppIcon icon={Copy} /> Copiar resumo
        </Btn>
        <Btn onClick={onRelatorio} title="Relatório para imprimir, salvar em PDF ou mandar no WhatsApp">
          <AppIcon icon={FileText} /> Relatório / PDF
        </Btn>
        <Btn
          variant="primary"
          onClick={onApresentar}
          title="Tela escura de reunião — projetor ou share de tela"
          className="ml-auto"
        >
          <AppIcon icon={Presentation} /> Apresentação
        </Btn>
      </div>

      {resumoCopiado && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-[rgba(0,120,42,0.25)] bg-[rgba(0,120,42,0.07)] px-3 py-1.5 text-xs font-medium text-[var(--verde-texto)]">
          <AppIcon icon={CircleCheck} /> Resumo {resumoCopiado === 'completo' ? 'completo' : 'resumido'} copiado — é só colar
          no grupo das sócias.
        </p>
      )}

      {/* Semáforo lê a VISÃO: simulando, mostra a cor do rascunho com selo
          explícito (nunca se passa por salvo). Margens editam pelo update
          real — o updater usa o evento salvo, não a visão. */}
      <div className="mb-4">
        {/* O painel do veredito também EDITA (margens do semáforo, "já
            incluso") — em evento fechado entra na mesma trava visual. */}
        <fieldset disabled={eventoFechado(evento)} className="contents">
          <VeredictoPainel evento={eventoView} update={update} simulando={simulando} />
        </fieldset>
      </div>

      {/* abas GRUDAM no topo ao rolar (como as .abas do Financeiro) — trocar de
          aba sem voltar ao topo. -mx-8 px-8 estende o fundo até as bordas do
          container; bg cobre o conteúdo que rola por baixo. */}
      <nav className="sticky top-0 z-30 -mx-4 mb-5 flex gap-4 overflow-x-auto border-b border-[var(--borda-2)] bg-[var(--fundo)] px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-[var(--acento)] text-[var(--tinta)]'
                : 'border-transparent text-[var(--tinta-2)] hover:text-[var(--tinta)]'
            }`}
          >
            <AppIcon icon={t.icon} /> {t.label}
          </button>
        ))}
        {/* Fechar/Reabrir PINNED (Marco 24/07): sempre visível na nav sticky, de
            qualquer aba. Reabrir age direto (com confirmação); fechar leva à aba
            Fechamento, onde se revisa o realizado antes de congelar — os
            controles guardados (guarda de bilheteria, promover benchmark) moram
            lá, sem duplicar a lógica. */}
        {eventoFechado(evento) ? (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Reabrir "${evento.nome}"? A foto do fechamento será descartada — fechar de novo tira outra foto, dos números de então. (Um desfazer devolve o fechamento.)`
                )
              )
                onReabrirEvento()
            }}
            title="Reabrir para editar — descarta a foto do fechamento (reversível no desfazer)"
            className="-mb-px ml-auto shrink-0 self-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-[var(--verde-texto)] transition-colors hover:bg-[var(--papel-2)]"
          >
            Reabrir evento
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTab('fechamento')}
            title="Ir para o Fechamento — revise o realizado e congele os números"
            className="-mb-px ml-auto shrink-0 self-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-[var(--tinta-2)] transition-colors hover:bg-[var(--papel-2)] hover:text-[var(--tinta)]"
          >
            Fechar evento
          </button>
        )}
      </nav>

      {/* Evento fechado: as abas de EDIÇÃO inteiras ficam desabilitadas de
          verdade — o <fieldset disabled> propaga para todo input/select/botão
          lá dentro, nativamente. Sem isto, a faixa dizia "campos travados"
          mas só 2 inputs estavam; o resto aceitava digitação que o funil
          descartava em silêncio, com o rascunho do campo mostrando um número
          que o store não tinha (achado adversarial 20/07/2026). A trava de
          gravação (updateEvento) continua por baixo — isto é a VERDADE VISUAL
          dela. `display: contents` = o fieldset não muda o layout. A aba
          Fechamento fica FORA: lá moram Reabrir e Promover, que continuam
          permitidos em evento fechado. */}
      <fieldset disabled={eventoFechado(evento)} className="contents">
        {tab === 'receita' && <RevenueTab evento={evento} update={update} />}
        {tab === 'custos' && (
          <CostsTab evento={evento} update={update} store={store} setStore={setStore} />
        )}
        {tab === 'cenarios' && (
          <ScenariosTab
            evento={eventoView}
            update={update}
            store={store}
            setStore={setStore}
            updateCenarios={updateCenarios}
            desfazerCenarios={desfazerCenarios}
            simulando={simulando}
            onSimular={entrarSimulacao}
          />
        )}
        {tab === 'analise' && <AnaliseTab evento={evento} update={update} />}
      </fieldset>
      {tab === 'fechamento' && (
        <FechamentoTab
          evento={evento}
          update={update}
          store={store}
          onPromoverBenchmark={promoverBenchmark}
          onFecharEvento={onFecharEvento}
          onReabrirEvento={onReabrirEvento}
        />
      )}

      {ponteAberta && (
        <FinanceiroModal
          evento={evento}
          store={store}
          update={update}
          onClose={() => setPonteAberta(false)}
        />
      )}

      {exportarAberto && (
        <ExportarPagamentosModal evento={evento} onClose={() => setExportarAberto(false)} />
      )}

      {orcamentoAberto && (
        <OrcamentoProdutorModal
          evento={evento}
          update={update}
          store={store}
          onClose={() => setOrcamentoAberto(false)}
        />
      )}

      {resumoAberto && (
        <CopiarResumoModal
          evento={evento}
          onClose={() => setResumoAberto(false)}
          onCopiado={avisarCopiado}
        />
      )}

      {/* Barra do modo Simular: fixa embaixo (não briga com os stickies do
          topo — AncoraNav/abas), sempre à vista enquanto o rascunho existe.
          O botão de aplicar diz o efeito e a contagem (princípio 7); o title
          lista o diff completo, linha a linha. */}
      {simulando && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[var(--acento)] bg-[var(--papel)] shadow-[var(--sombra-2)]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--acento)]">
              <AppIcon icon={FlaskConical} size={ICON_SIZE_STATUS} /> Simulando — nada está sendo salvo
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--tinta-2)]" title={mudancas.join('\n')}>
              {mudancas.length === 0
                ? 'Mexa nos sliders e campos da aba Cenários — o que mudar aparece aqui.'
                : mudancas.length <= 2
                  ? mudancas.join(' · ')
                  : `${mudancas.slice(0, 2).join(' · ')} · +${mudancas.length - 2} ${mudancas.length - 2 === 1 ? 'outra' : 'outras'}`}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Btn
                variant="primary"
                onClick={aplicarSimulacao}
                disabled={mudancas.length === 0}
                className={mudancas.length === 0 ? 'cursor-not-allowed opacity-50' : ''}
                title={
                  mudancas.length === 0
                    ? 'Nada mudou ainda — não há o que aplicar'
                    : `Cria um snapshot de segurança e grava no evento:\n${mudancas.join('\n')}`
                }
              >
                {mudancas.length === 0
                  ? 'Aplicar ao evento'
                  : `Aplicar ${mudancas.length} ${mudancas.length === 1 ? 'mudança' : 'mudanças'} ao evento`}
              </Btn>
              <Btn
                onClick={descartarSimulacao}
                title="Fecha o modo Simular jogando o rascunho fora — o evento fica exatamente como estava"
              >
                Descartar (Esc)
              </Btn>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
