import { useState } from 'react'
import { Btn, Card, NumInput, BarraOrcamentoFechado, Select, Segmented, Bola, AncoraNav, EtiquetaSemReserva } from './ui.jsx'
import { FAIXA_QUANTIDADE } from '../lib/campoNumerico.js'
import { AppIcon, CircleCheck, TriangleAlert, ChevronDown, ChevronRight } from './AppIcon.jsx'
import { computeCenarios, computeCenario, CENARIOS, CENARIO_LABEL, loteQtdCenario, isPrecoAusente, custosPorStatus, isOpenBar, descontoEfetivoPct, isTaxaCliente, isBarPorPessoa } from '../lib/calc.js'
import { premissaDesconto, TICKET_LIQUIDO_LABEL, fraseTicketLiquido, premissaBar, contaBarPorPessoa } from '../lib/premissaTexto.js'
import { textoBreakEven, fraseBreakEvenDoCenario, BREAK_EVEN_QUANTIDADE_TRAVADA } from '../lib/breakEvenTexto.js'
import { fmtBRL, fmtBRL2, fmtInt, fmtPct, fmtCompact, fmtData, DASH, fonteQueCabe } from '../lib/format.js'
import { ajusteCustoTexto, ajusteCustoValor, AJUSTE_CUSTO_LABEL } from '../lib/dre.js'
import { impostoLinhaLabel, impostoTexto, impostoValor, temImposto, IMPOSTO_LABEL } from '../lib/imposto.js'
import { resultadoRealizado } from '../lib/fechamento.js'
import { eventoFechado } from '../lib/fechamentoEvento.js'
import { ResumoRealizado } from './ResumoRealizado.jsx'
import { GroupedBars, HBars, VIZ, CENARIO_TONS } from './Charts.jsx'
import {
  benchmarksAtivos,
  ocultarBenchmark,
  mostrarBenchmark,
  CAT_KEYS,
  CAT_LABELS,
  porPessoa,
  divPorPessoa,
  pseudoBenchmarkDeCenario,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import { showToast } from '../lib/toast.js'
import { BenchmarkChips } from './CostsTab.jsx'
import { RitmoVendasCard } from './RitmoVendas.jsx'
import CurvaVendas from './CurvaVendas.jsx'
import SimuladorSliders from './Simulador.jsx'
import VersaoReuniao from './VersaoReuniao.jsx'
import AvisoCustoQuebrado, {
  AvisoReceitaQuebrada,
  faixaDaFotoSa,
  AvisoBenchmarkQuebrado,
  NUMERO_NAO_CALCULA,
} from './AvisoCustoQuebrado.jsx'
import {
  numeroQuebradoPorCusto,
  numeroQuebradoPorReceita,
  cenarioQuebrado,
  receitaDoCenarioQuebrada,
  fmtOuIlegivel,
  publicoIlegivel,
  publicoDaReferencia,
  ESTADO_PUBLICO,
} from '../lib/dadoQuebrado.js'
import { num } from '../lib/util.js'
import { textoAvisoBar, cenariosSemBar, ticketBarParaCopiar } from '../lib/avisoBar.js'
import { textoCurtoLotesSemPreco, ROTULO_AJUSTE_SEM_PRECO } from '../lib/loteSemPreco.js'
import { NO_EVENTO, EM_LUGAR_NENHUM, AVISO_SEM_DESFAZER } from '../lib/desfazerDoRascunho.js'

// Identidade dos 3 cenários (Charts.jsx, validada): NÃO fala a língua do
// semáforo — pessimista âmbar · realista azul da marca · otimista rosa.
const TONE = {
  pessimista: { dot: CENARIO_TONS.light.pessimista.dot, nome: 'Pessimista' },
  realista: { dot: CENARIO_TONS.light.realista.dot, nome: 'Realista' },
  otimista: { dot: CENARIO_TONS.light.otimista.dot, nome: 'Otimista' },
}

const lucroTone = (v) => (v >= 0 ? 'text-[var(--verde-texto)]' : 'text-[var(--vermelho-texto)]')

function CenarioCard({ c, contexto, evento, cenarios }) {
  const t = TONE[c.cenario]
  const avisoBar = textoAvisoBar(evento, c.cenario)
  const avisoSemPreco = textoCurtoLotesSemPreco(evento)
  // Dado quebrado (Marco, 26/07/2026; aplicado ao lucro em 05/10/2026): com um
  // custo infinito o lucro impresso saía IGUAL À RECEITA, positivo e verde —
  // lucroQueFecha refazia a conta com o custo arredondado, e o infinito virava 0
  // (desde 07/10/2026 o cartão imprime o lucro do motor, com centavos; a guarda
  // segue igual).
  // A conta não muda; a tela diz que não dá para calcular.
  //
  // 4ª revisão do PR #98 (05/10/2026): a pergunta olha também a ORIGEM do
  // lucro — receita e custo do cenário —, porque com um patrocínio de 1e308 a
  // margem dava 100% (cabe, e mente). E os números de RECEITA do card viram
  // texto quando a receita do cenário não é dinheiro.
  const quebrado = cenarioQuebrado(evento, c, cenarios)
  const recQ = receitaDoCenarioQuebrada(evento, c, cenarios)
  const txt = (q, v) => (q ? NUMERO_NAO_CALCULA : v)
  return (
    <Card className="p-4" style={{ borderTop: `3px solid ${t.dot}` }}>
      <div className="flex items-center gap-2">
        <Bola size={12} cor={t.dot} />
        <h3 className="text-sm font-semibold">{t.nome}</h3>
        {c.ajustePct !== 0 && (
          <span className="ml-auto text-[11px] text-[var(--tinta-3)]">
            custos {c.ajustePct > 0 ? '+' : ''}
            {c.ajustePct}%
          </span>
        )}
      </div>
      {/* print recortado se explica sozinho: o card diz de que evento é */}
      {contexto && (
        <p className="mt-0.5 truncate text-[10px] text-[var(--tinta-3)]" title={contexto}>
          {contexto}
        </p>
      )}
      <div className="mt-3" style={{ containerType: 'inline-size' }}>
        <div className="text-xs text-[var(--tinta-2)]">Lucro</div>
        {quebrado ? (
          <div className="text-xl font-semibold text-[var(--tinta-2)]">{NUMERO_NAO_CALCULA}</div>
        ) : (
          <>
            {/* Cartão COM CENTAVOS, como o DRE (Marco, 07/10/2026, por
                questionário — P6 refeito): Receita, Imposto, Custo e Lucro
                saem do motor em centavos exatos, então o lucro escrito aqui é
                a subtração das linhas escritas logo abaixo (regra de
                07/08/2026) E é o mesmo número da linha Lucro do DRE. Com
                centavos o número fica mais longo: o tamanho encolhe para caber
                no cartão estreito em vez de cortar o último dígito. */}
            <div
              className={`whitespace-nowrap font-semibold ${lucroTone(c.lucro)}`}
              style={{ fontSize: fonteQueCabe(fmtBRL2(c.lucro), 1.875), lineHeight: 1.2 }}
            >
              {fmtBRL2(c.lucro)}
            </div>
            <div className="text-xs text-[var(--tinta-3)]">margem {fmtPct(c.margem)}</div>
          </>
        )}
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-[var(--borda)] pt-3 text-sm">
        {[
          ['Receita total', txt(recQ, fmtBRL2(c.receitaTotal))],
          // Imposto entre a receita e o custo — a MESMA ordem do DRE, para
          // quem lê o card e o DRE na mesma reunião não ver duas histórias.
          // Sem imposto configurado a linha não existe e o card é o de sempre.
          ...(temImposto(c) ? [[IMPOSTO_LABEL, txt(recQ, `− ${fmtBRL2(impostoValor(c))}`)]] : []),
          ['Custo total', fmtBRL2(c.custoTotal)],
          ['Break-even', txt(quebrado || recQ, textoBreakEven(c, ' ingressos pagos', evento, cenarios))],
          ['Custo por pessoa', txt(recQ, c.custoPorPessoa == null ? DASH : fmtBRL2(c.custoPorPessoa))],
          ['Público', txt(recQ, `${fmtInt(c.publico)} (${fmtInt(c.pagos)} pagos)`)],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between gap-2">
            <dt className="text-[var(--tinta-2)]">{l}</dt>
            <dd className="tnum font-medium text-[var(--tinta)]">{v}</dd>
          </div>
        ))}
      </dl>
      {/* Bar não informado neste cenário (Marco, 27/07/2026). Fica ACIMA do
          aviso de break-even de propósito: quando ele aparece, o próprio
          break-even está calculado sobre uma receita incompleta, e ler o de
          baixo antes deste levaria à conclusão errada. Âmbar, não vermelho —
          não é erro do Marco, é informação que falta. */}
      {avisoBar && (
        <p className="mt-2 flex items-start gap-1 text-[11px] text-[var(--ambar-texto,var(--tinta-2))]">
          <AppIcon icon={TriangleAlert} size={13} />
          <span>{avisoBar}</span>
        </p>
      )}
      {/* Lote sem preço (P8, Marco 06/10/2026): o público e o bar deste
          cartão já não contam esse lote — a linha diz por quê. */}
      {avisoSemPreco && (
        <p className="mt-2 flex items-start gap-1 text-[11px] text-[var(--ambar-texto,var(--tinta-2))]">
          <AppIcon icon={TriangleAlert} size={13} />
          <span>{avisoSemPreco}</span>
        </p>
      )}
      {/* A posição deste cenário contra o próprio break-even. O texto vem de
          breakEvenTexto.js — a MESMA frase da tabela, do PDF e do WhatsApp —
          e inclui o caso em que não existe meta: nem vendendo tudo o cenário
          sai do prejuízo (Marco, 27/07/2026). */}
      {(() => {
        const fr = quebrado || recQ ? null : fraseBreakEvenDoCenario(c, evento, cenarios)
        if (!fr) return null
        const ok = fr.tom === 'ok'
        // Quantidade travada (S6) não é resultado ruim, é aviso de leitura:
        // âmbar, como no card de ritmo (LINGUAGEM-DE-COR, regra 5).
        const travada = fr.texto === BREAK_EVEN_QUANTIDADE_TRAVADA
        return (
          <p
            className={`mt-2 flex items-center gap-1 text-[11px] ${ok ? 'text-[var(--verde-texto)]' : travada ? 'text-[var(--ambar-texto)]' : 'text-[var(--vermelho-texto)]'}`}
          >
            <AppIcon icon={ok ? CircleCheck : TriangleAlert} size={13} /> {fr.texto}
          </p>
        )
      })()}
    </Card>
  )
}

// Card de evento REALIZADO (Marco 24/07): substitui os 3 cenários projetados
// pelo que de fato aconteceu — Estimado × Realizado, as DUAS colunas vindas de
// `resultadoRealizado` (a MESMA conta da aba Fechamento). Título sempre "Resultado
// realizado" — evento fechado é realizado (decisão do Marco 24/07); o detalhe do
// estimado remanescente mora na aba Fechamento (selo "realizado + previsto").
//
// SEM `est` (Marco, 27/07/2026): a coluna "Estimado" saía do cenário realista, e
// o cenário soma o REALIZADO onde ele já existe — num evento fechado o card
// comparava o realizado contra ele mesmo. Hoje o estimado é o ORÇAMENTO, e ele
// viaja dentro de `real.estimado`; devolver o cenário a este card reabre o
// defeito.
function CardRealizado({ real, contexto, quebrado = false, fotoSa = false }) {
  return (
    <Card className="p-4" style={{ borderLeft: '3px solid var(--verde-texto)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <Bola size={12} cor="var(--verde-texto)" />
        <h3 className="text-sm font-semibold">Resultado do evento</h3>
        <span className="rounded-full bg-[rgba(0,120,42,0.1)] px-2 py-0.5 text-[11px] font-medium text-[var(--verde-texto)]">
          Realizado
        </span>
      </div>
      {contexto && (
        <p className="mt-0.5 truncate text-[10px] text-[var(--tinta-3)]" title={contexto}>
          {contexto}
        </p>
      )}
      <div className="mt-3">
        {/* Custo quebrado: o resumo escrevia "Resultado realizado R$ 0" e
            desvio "−NaN" (medido em 05/10/2026). */}
        {quebrado ? (
          <p className="text-sm font-medium text-[var(--tinta-2)]">
            Resultado realizado: {NUMERO_NAO_CALCULA}
            {/* Foto sã (05/10/2026): o número que VALE existe, só não é este
                cálculo de agora — dizer só "não dá" escondia isso. */}
            {fotoSa ? ' com o cadastro de agora — o da fotografia do fechamento, que vale, está na aba Fechamento.' : '.'}
          </p>
        ) : (
          <ResumoRealizado real={real} />
        )}
      </div>
    </Card>
  )
}

// `raw` = valor monetário puro (para o toggle R$/pax, sugestão 8); linhas sem
// `raw` (contagens, %, ticket já é "por pessoa" por natureza) ignoram o toggle.
// Linhas da DRE que dependem da RECEITA do cenário (4ª revisão do PR #98,
// 05/10/2026): viram texto quando ela não é dinheiro. A linha do imposto é
// montada no componente e marcada lá.
const DRE_DEPENDE_DA_RECEITA = new Set([
  'Ingressos pagos',
  'Cortesias',
  'Receita bruta bilheteria',
  'Taxa da bilheteria',
  'Cashback Tiqueteira',
  'Receita líquida bilheteria',
  'Bar (lucro líquido)',
  'Patrocínio (fechado)',
  'Receita total',
  'Ticket médio (bruto)',
  TICKET_LIQUIDO_LABEL,
  'Break-even (ingressos pagos)',
  'Custo por pessoa',
])

const DRE_LINHAS = [
  { label: 'Ingressos pagos', get: (c) => fmtInt(c.pagos) },
  { label: 'Cortesias', get: (c) => fmtInt(c.cortesias) },
  { label: 'Receita bruta bilheteria', get: (c) => fmtBRL2(c.bruta), raw: (c) => c.bruta },
  { label: 'Taxa da bilheteria', get: (c) => `− ${fmtBRL2(c.taxa)}`, raw: (c) => -c.taxa },
  { label: 'Cashback Tiqueteira', get: (c) => `+ ${fmtBRL2(c.cashback)}`, raw: (c) => c.cashback },
  { label: 'Receita líquida bilheteria', get: (c) => fmtBRL2(c.liquida), raw: (c) => c.liquida },
  { label: 'Bar (lucro líquido)', get: (c) => fmtBRL2(c.bar), raw: (c) => c.bar },
  { label: 'Patrocínio (fechado)', get: (c) => fmtBRL2(c.patrocinio), raw: (c) => c.patrocinio },
  { label: 'Receita total', get: (c) => fmtBRL2(c.receitaTotal), raw: (c) => c.receitaTotal, strong: true },
  { label: 'Custos (itens)', get: (c) => fmtBRL2(c.custoItens), raw: (c) => c.custoItens },
  { label: 'Contingência', get: (c) => fmtBRL2(c.contingencia), raw: (c) => c.contingencia },
  // Sessão de Clareza do DRE (19/07/2026): esta linha mostrava só o "%", então
  // a coluna não fechava em R$ — o leitor via 133.200 + 4.662 e um total de
  // 144.755. Agora mostra o valor em R$ (com o % entre parênteses) e entra no
  // toggle R$/pax como as outras linhas de dinheiro. Ver src/lib/dre.js.
  {
    label: AJUSTE_CUSTO_LABEL,
    get: (c) => ajusteCustoTexto(c),
    raw: (c) => ajusteCustoValor(c),
  },
  { label: 'Custo total', get: (c) => fmtBRL2(c.custoTotal), raw: (c) => c.custoTotal, strong: true },
  {
    label: 'Lucro',
    get: (c) => fmtBRL2(c.lucro),
    raw: (c) => c.lucro,
    strong: true,
    tone: (c) => lucroTone(c.lucro),
    dependeDoLucro: true,
  },
  { label: 'Margem', get: (c) => fmtPct(c.margem), dependeDoLucro: true },
  {
    label: 'Ticket médio (bruto)',
    get: (c) =>
      `${fmtBRL2(c.ticketMedio)}${c.ticketMedioManual ? ' · manual' : ''}${
        c.ticketAjustePct ? ` · ${c.ticketAjustePct > 0 ? '+' : ''}${c.ticketAjustePct}%` : ''
      }`,
  },
  { label: TICKET_LIQUIDO_LABEL, get: (c) => fmtBRL2(c.ticketMedioLiquido) },
  {
    label: 'Break-even (ingressos pagos)',
    get: (c, evento, cenarios) => textoBreakEven(c, '', evento, cenarios),
  },
  { label: 'Custo por pessoa', get: (c) => (c.custoPorPessoa == null ? DASH : fmtBRL2(c.custoPorPessoa)) },
]

// Modo "Simular" (sugestão 35, F2-V): `updateCenarios` é o canal de TODA
// escrita em cenariosConfig desta aba (sliders E overrides por lote). No modo
// normal ele É o update real; simulando, o EventEditor passa o roteador de
// rascunho (nada persiste) — e `evento` chega como a visão com o rascunho.
// Os demais usos de `update` (ritmo, curva) seguem no canal real: só cenários
// são rascunho.
export default function ScenariosTab({
  evento,
  update,
  store,
  setStore,
  updateCenarios = update,
  // Desfazer roteado (Marco, 05/08/2026): o editor decide para onde vai um
  // desfazer carimbado — ver desfazerDoRascunho.js. Montada fora do editor, a
  // aba não tem rascunho nenhum, então o desfazer é o `update` de sempre.
  desfazerCenarios = (marca, fn, descritor) => {
    update(fn, descritor)
    return NO_EVENTO
  },
  simulando = false,
  onSimular,
}) {
  const [mostrarOverrides, setMostrarOverrides] = useState(false)
  const [modoBm, setModoBm] = useState('abs')
  const [modoDre, setModoDre] = useState('abs')
  const [outroId, setOutroId] = useState('')
  const [modoComp, setModoComp] = useState('abs')
  const c = computeCenarios(evento)
  // Evento FECHADO troca os cenários projetados pelo Estimado × Realizado — o
  // que de fato aconteceu (Marco 24/07). Mesma conta da aba Fechamento
  // (resultadoRealizado), então os números batem; null = evento não fechado.
  const real = eventoFechado(evento) ? resultadoRealizado(evento, c.realista) : null
  // Dado quebrado: algum cenário com lucro que não é dinheiro por causa de um
  // custo acusado. Decide a faixa (CONSEQ_LUCRO × CONSEQ_NAO_USADO — com o
  // realizado lançado, o estimado quebrado nem entra nestes números) e o
  // gráfico Receita × Custo × Lucro.
  const algumCenarioQuebrado = CENARIOS.some(
    (k) => cenarioQuebrado(evento, c[k], c) || receitaDoCenarioQuebrada(evento, c[k], c)
  )
  const realQuebrado =
    real != null &&
    (numeroQuebradoPorCusto(evento, real.custos, real.resultado, real.estimado?.lucro) ||
      // receita realizada quebrada (05/10/2026): Pix ou bilheteria de 1e308
      numeroQuebradoPorReceita(evento, real.receita, real.resultado))
  const cfg = evento.cenariosConfig || {}
  const bms = benchmarksAtivos(evento, store)
  // Copiar o ticket de bar para os cenários que estão sem (Marco, 27/07/2026).
  // O aviso do cartão diz o que falta; isto resolve num clique. Nada é copiado
  // sozinho — o app nunca inventa um número de negócio que ele não digitou.
  //
  // Desfazer visível na própria tela (princípio 7): a foto guardada é dos TRÊS
  // valores, então o Desfazer devolve exatamente o que havia, inclusive o
  // cenário que já estava preenchido.
  //
  // O CANAL É O `updateCenarios`, não o `update` real (Marco, 05/08/2026).
  // Este botão escreve em `barTicket` — o MESMO campo que o slider de bar da
  // grade passou a mexer. Fora do modo Simular os dois são a mesma função e
  // nada muda; DENTRO dele, ficar no `update` real faria este botão gravar no
  // evento enquanto a tela inteira diz "nada está sendo salvo". Seria a
  // mentira que o rascunho existe para impedir, entrando pela porta de trás.
  //
  // E o DESFAZER anda com o carimbo da ação, não com o estado da tela: o toast
  // dura 6 s e a simulação acaba num clique, então quando ele é clicado o lugar
  // onde a cópia caiu pode não existir mais. `antes` foi lido de `evento`, que
  // no modo Simular é a VISÃO — mandá-lo para o evento salvo depois de um
  // DESCARTE gravava justamente o número descartado (S1 de 05/08/2026).
  const copiarTicketBarNosTres = () => {
    const valor = ticketBarParaCopiar(evento)
    if (valor == null) return
    const antes = { ...(evento.barTicket || {}) }
    const faltavam = cenariosSemBar(evento).length
    const marca = updateCenarios(
      (e) => ({ ...e, barTicket: { pessimista: valor, realista: valor, otimista: valor } }),
      `usar ${fmtBRL2(valor)} de bar nos três cenários`
    )
    showToast(
      `Bar de ${fmtBRL2(valor)} por pessoa em ${faltavam === 1 ? '1 cenário' : `${faltavam} cenários`}`,
      {
        acaoLabel: 'Desfazer',
        onAcao: () => {
          const destino = desfazerCenarios(
            marca,
            (e) => ({ ...e, barTicket: antes }),
            'desfazer o bar nos três cenários'
          )
          // Não havia o que desfazer: a tela diz isso em vez de ficar muda —
          // botão que não faz nada e não explica ensina a desconfiar do resto.
          if (destino === EM_LUGAR_NENHUM) showToast(AVISO_SEM_DESFAZER)
        },
      }
    )
  }
  // Ocultar de TODAS as comparações a partir da própria linha/referência (tema
  // F + princípio "ação mora no objeto"): × no hover da barra, some na hora,
  // toast com Desfazer. Reversível (benchmarksOcultos = só IDs).
  const ocultarBmGlobal = (b) => {
    if (!setStore) return
    setStore((s) => ocultarBenchmark(s, b.id), `ocultar "${b.nome}" das comparações`)
    showToast(`${b.nome} ocultado das comparações`, {
      acaoLabel: 'Desfazer',
      onAcao: () => setStore((s) => mostrarBenchmark(s, b.id), `mostrar "${b.nome}" nas comparações`),
    })
  }
  const onHideBm = (b) =>
    setStore
      ? { onHide: () => ocultarBmGlobal(b), hideTitle: `Ocultar ${b.nome} de todas as comparações` }
      : {}
  const statusTotais = custosPorStatus(evento.categorias)
  // Taxa paga pelo cliente (sugestão 29b): no repasse a taxa tem efeito ZERO no
  // resultado — a linha SOME do DRE (F2-Y, adendo do Marco: era ruído num painel
  // de decisão). Paga por nós = a linha continua, aí ela deduz de verdade. O
  // "preço final ao cliente" segue na nota de preço abaixo (info de preço).
  const taxaCliente = isTaxaCliente(evento)
  const semTaxa = taxaCliente
    ? DRE_LINHAS.filter((l) => l.label !== 'Taxa da bilheteria')
    : DRE_LINHAS
  // IMPOSTO (Marco, 27/07/2026): entra DEPOIS da receita total e ANTES dos
  // custos — é dedução de receita, não custo, e a posição na tela é o que
  // ensina isso a quem lê. O rótulo é montado aqui, e não na tabela lá em
  // cima, porque ele carrega a alíquota e as BASES marcadas: sem elas, uma
  // chave desligada e uma alíquota zero imprimem o mesmo R$ 0 contando
  // histórias diferentes. Alíquota e bases são do EVENTO, iguais nos três
  // cenários, então um rótulo serve para a linha inteira.
  const impostoRealista = c.realista.imposto
  const linhasDre = impostoRealista
    ? (() => {
        const i = semTaxa.findIndex((l) => l.label === 'Receita total')
        const linha = {
          label: impostoLinhaLabel(impostoRealista),
          get: (s) => `− ${fmtBRL2(impostoValor(s))}`,
          raw: (s) => -impostoValor(s),
          dependeDaReceita: true,
        }
        return [...semTaxa.slice(0, i + 1), linha, ...semTaxa.slice(i + 1)]
      })()
    : semTaxa

  // Comparar com outra previsão (sugestão 7, Sessão J): o realista da OUTRA
  // previsão vira pseudo-benchmark descartável — nada é salvo, é recalculado
  // a cada render a partir do que já está no store. Só um evento por vez
  // (fora do escopo comparar mais de dois); cenário sempre o realista dos
  // dois lados (fora do escopo comparar outro cenário).
  const outrasPrevisoes = (store?.eventos || []).filter((e) => e.id !== evento.id)
  const outroEvento = outrasPrevisoes.find((e) => e.id === outroId) || null
  const outroRealista = outroEvento ? computeCenario(outroEvento, 'realista') : null
  const outroPseudo = outroRealista ? pseudoBenchmarkDeCenario(outroEvento.nome, outroRealista) : null
  // /pax usa o público de CADA lado — é o ponto todo do toggle quando os
  // públicos são muito diferentes (validação da Sessão J).
  const ppMeu = (v) => (modoComp === 'pp' ? divPorPessoa(v, c.realista.publico) : v)
  const ppOutro = (v) => (modoComp === 'pp' ? divPorPessoa(v, outroRealista?.publico) : v)

  const setOverride = (cen, loteId, v) =>
    updateCenarios((e) => {
      const base = e.cenariosConfig || {}
      const overrides = {
        pessimista: {},
        realista: {},
        otimista: {},
        ...(base.overrides || {}),
      }
      const m = { ...(overrides[cen] || {}) }
      if (v === '' || v == null) delete m[loteId]
      else m[loteId] = v
      return { ...e, cenariosConfig: { ...base, overrides: { ...overrides, [cen]: m } } }
    })


  const publicoPrev = c.realista.publico || num(evento.publicoEstimado)
  // Só o público VÁLIDO divide (S1, 07/10/2026): o texto "0" passava pelo
  // `publico &&` de `divPorPessoa` e dividia por zero ("R$ 0" por pessoa).
  const valorBm = (bm, v) =>
    modoBm === 'pp' ? (publicoDaReferencia(bm).estado === ESTADO_PUBLICO.VALIDO ? porPessoa(bm, v) : null) : v
  // Público ilegível (S1, 07/10/2026): dividir por "ilegível" dava NaN e a
  // barra escrevia "R$ 0" por pessoa; por 1e308, "R$ 0"; por −5, "-R$ 8.400".
  // No "Por pessoa" a linha dessa referência fica sem barra e diz que não dá
  // para calcular. No "Absoluto" o público não entra, e nada muda.
  const linhaBm = (b, v) =>
    modoBm === 'pp' && publicoIlegivel(b)
      ? { label: rotuloBm(b), value: null, texto: NUMERO_NAO_CALCULA, ...onHideBm(b) }
      : { label: rotuloBm(b), value: valorBm(b, v), ...onHideBm(b) }
  // Etiqueta "sem reserva" (decisão 3 do Marco, 20/07/2026) no rótulo da barra:
  // aqui o rótulo é TEXTO (o HBars usa a mesma string no `title`), então a
  // etiqueta entra como sufixo em vez de chip. O motivo completo fica na nota
  // de rodapé do cartão, logo abaixo das barras.
  const rotuloBm = (b) => (temSemReserva(b) ? `${b.nome} · ${ETIQUETA_SEM_RESERVA}` : b.nome)
  const valorPrev = (v) => (modoBm === 'pp' ? (publicoPrev > 0 ? v / publicoPrev : null) : v)

  // Âncoras (item 8, sugestão 39): os quatro marcos desta aba longa.
  const ancoras = [
    { id: 'cen-simulacao', label: 'Simulação' },
    { id: 'cen-resumo', label: 'Resumo' },
    { id: 'cen-dre', label: 'DRE' },
    { id: 'cen-comparacao', label: 'Comparação' },
  ]

  return (
    <div className="space-y-5">
      {/* Dado quebrado (Marco, 26/07/2026). O que esta aba faz com um custo
          que não cabe numa conta de dinheiro, medido em 05/10/2026: o custo
          total sai R$ 0, e lucro, margem e o resultado realizado saem como
          "não dá para calcular" (antes desta data o lucro saía IGUAL À
          RECEITA, positivo — ver CONSEQ_LUCRO). Quem decide a frase é o que a
          aba IMPRIME: com o realizado lançado, o estimado quebrado não entra
          na conta e a faixa diz que os números continuam valendo. */}
      <AvisoCustoQuebrado
        evento={evento}
        efeito="lucro"
        numeroQuebrouAqui={algumCenarioQuebrado || realQuebrado}
        {...faixaDaFotoSa(evento, algumCenarioQuebrado || realQuebrado)}
      />
      <AvisoReceitaQuebrada evento={evento} />
      <AncoraNav itens={ancoras} />
      {/* Grade de cenários UNIFICADA (tema E, print do Marco: "dois painéis
          editando os mesmos números"). A grade numérica antiga e o painel
          "Simulação ao vivo" viraram UM só: slider + campo numérico por valor,
          na mesma linha, mais o Ticket médio (R$) por cenário. Os MESMOS campos
          de cenariosConfig (fonte única); calc.js e golden intocados. */}
      <div id="cen-simulacao" className="scroll-mt-16">
        <SimuladorSliders
          evento={evento}
          update={updateCenarios}
          comTicket
          simulando={simulando}
          onSimular={onSimular}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="max-w-3xl text-[11px] text-[var(--tinta-3)]">
          Ingressos vendidos (%) = quanto do tamanho dos lotes vende (realista hoje{' '}
          {num(cfg.realista?.vendaPct ?? 90)}%; otimista {num(cfg.otimista?.vendaPct ?? 100)}% — em
          100% esgota tudo, incluindo os “só otimista” como o Lote Porta; cortesias entram inteiras
          sempre). Ajuste de custos (%) age sobre custos + contingência (0% = conta padrão). Ticket
          médio em branco = automático (pela mistura de lotes do cenário); preenchido, a receita de
          ingressos vira pagos × ticket, com taxa e cashback recalculados. O ajuste do ticket (%)
          aumenta ou diminui o ticket médio do cenário — sobre o automático ou o manual.
        </p>
        <Btn variant="ghost" onClick={() => setMostrarOverrides(!mostrarOverrides)}>
          <AppIcon icon={mostrarOverrides ? ChevronDown : ChevronRight} /> Ajuste manual por lote
        </Btn>
      </div>

      {mostrarOverrides && (
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Ingressos por lote, por cenário</h3>
          <p className="mb-3 text-xs text-[var(--tinta-3)]">
            Deixe em branco para usar a regra automática (mostrada como sugestão). Digite um número
            para sobrescrever aquele lote naquele cenário.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                  <th className="py-2 pr-3 font-medium">Lote</th>
                  {CENARIOS.map((k) => (
                    <th key={k} className="w-32 py-2 pr-3 font-medium">
                      {CENARIO_LABEL[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evento.lotes.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--borda)]">
                    <td className="py-1.5 pr-3">
                      {l.nome || '—'}
                      {l.somenteOtimista && (
                        <span className="ml-1.5 text-[10px] text-[var(--tinta-3)]">só otimista</span>
                      )}
                      {isPrecoAusente(l) && (
                        <span className="ml-1.5 text-[10px] text-[var(--ambar-texto,var(--tinta-2))]">{ROTULO_AJUSTE_SEM_PRECO}</span>
                      )}
                    </td>
                    {CENARIOS.map((k) => {
                      const ov = cfg.overrides?.[k]?.[l.id]
                      const auto = loteQtdCenario(l, k, { ...cfg, overrides: {} })
                      return (
                        <td key={k} className="py-1.5 pr-3">
                          <NumInput
                            value={ov ?? ''}
                            onChange={(v) => setOverride(k, l.id, v)}
                            placeholder={String(auto)}
                            min="0"
                            step="1"
                            faixa={FAIXA_QUANTIDADE}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div id="cen-resumo" className="scroll-mt-16">
        {real ? (
          <CardRealizado
            real={real}
            quebrado={realQuebrado}
            fotoSa={faixaDaFotoSa(evento, true).conserto != null}
            contexto={[evento.nome, fmtData(evento.data)].filter(Boolean).join(' · ')}
          />
        ) : (
          <>
            {/* A metade cômoda da decisão do Marco de 27/07/2026 ("avisar alto,
                nunca inventar"): o cartão diz o que falta, este botão resolve
                num clique — e continua sendo ele quem manda, nada é copiado
                sozinho. Só aparece quando há cenário sem bar E existe valor
                para copiar; sem nenhum preenchido não há o que oferecer e a
                tela apenas avisa. */}
            {cenariosSemBar(evento).length > 0 && ticketBarParaCopiar(evento) != null && (
              <div className="mb-3 flex justify-end">
                <Btn
                  onClick={copiarTicketBarNosTres}
                  title="Copia o ticket de bar já preenchido para os cenários que estão sem — dá para desfazer"
                >
                  Usar {fmtBRL2(ticketBarParaCopiar(evento))} de bar nos três
                </Btn>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {CENARIOS.map((k) => (
                <CenarioCard
                  key={k}
                  c={c[k]}
                  cenarios={c}
                  evento={evento}
                  contexto={[evento.nome, fmtData(evento.data)].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Ritmo e curva de vendas são forward-looking ("estamos vendendo no
          ritmo?") — não se aplicam a evento já realizado; somem quando fechado
          (o card acima mostra o que de fato aconteceu). */}
      {/* As duas recebem TAMBÉM o `breakEvenNaoFecha`: sem ele, o `null` do
          break-even chega cru e as duas somem com a leitura de ritmo em vez de
          dizer que a festa não fecha nem vendendo tudo (Marco, 27/07/2026). */}
      {!real && (
        <RitmoVendasCard
          evento={evento}
          update={update}
          breakEvenRealista={c.realista.breakEven}
          breakEvenNaoFecha={c.realista.breakEvenNaoFecha}
          cenarios={c}
        />
      )}
      {!real && (
        <CurvaVendas
          evento={evento}
          update={update}
          breakEvenRealista={c.realista.breakEven}
          breakEvenNaoFecha={c.realista.breakEvenNaoFecha}
          cenarios={c}
        />
      )}

      {/* Versão de reunião (sugestão 24): congelar × atual — só leitura */}
      <VersaoReuniao evento={evento} />

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">% do orçamento fechado</h3>
        <BarraOrcamentoFechado totais={statusTotais} fmt={fmtBRL} />
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Receita × Custo × Lucro por cenário</h3>
        {/* Com custo quebrado as barras rotulam "Lucro: R$ 0" e "Custo: R$ 0"
            — número derivado de lixo desenhado como conta boa. */}
        {algumCenarioQuebrado ? (
          <p className="text-sm text-[var(--tinta-2)]">Gráfico sem dados: lucro {NUMERO_NAO_CALCULA}.</p>
        ) : (
        <GroupedBars
          groups={CENARIOS.map((k) => ({
            label: CENARIO_LABEL[k],
            values: [c[k].receitaTotal, c[k].custoTotal, c[k].lucro],
          }))}
          series={[
            { label: 'Receita', color: VIZ.light.receita },
            { label: 'Custo', color: VIZ.light.custoNeutro },
            {
              label: 'Lucro',
              color: VIZ.light.lucro,
              // lucro vermelho SÓ quando é prejuízo (tema C) — verde no positivo.
              colorFn: (v) => (v < 0 ? VIZ.light.prejuizo : VIZ.light.lucro),
            },
          ]}
          labelSeries="all"
        />
        )}
        {/* As três barras são rotuladas com o valor (labelSeries="all"), então
            quem olha SUBTRAI: receita menos custo tem de dar o lucro. Com
            imposto ligado não dá — falta o degrau do meio. Fica como nota, e
            não como uma quarta barra, de propósito: barra nova pede cor nova,
            e cor é decisão de marca (LINGUAGEM-DE-COR.md), não de sessão. */}
        {impostoRealista && (
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            O lucro das barras já está <strong>depois do imposto</strong> (
            {impostoTexto(impostoRealista)}) — por isso receita menos custo não fecha no lucro
            aqui. O passo aparece com valor na linha do DRE, logo abaixo.
          </p>
        )}
      </Card>

      <Card id="cen-dre" className="scroll-mt-16 overflow-x-auto p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold">DRE por cenário</h3>
          <Segmented
            className="ml-auto"
            value={modoDre}
            onChange={setModoDre}
            options={[
              ['abs', 'Absoluto'],
              ['pp', 'R$/pax'],
            ]}
          />
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--borda)] text-xs text-[var(--tinta-2)]">
              <th className="py-2 pr-3 text-left font-medium">Linha</th>
              {CENARIOS.map((k) => (
                <th key={k} className="w-36 py-2 pr-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Bola size={10} cor={TONE[k].dot} />
                    {CENARIO_LABEL[k]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasDre.map((linha) => (
              <tr
                key={linha.label}
                className={`border-b border-[var(--borda)] ${linha.strong ? 'bg-[var(--papel-2)] font-semibold' : ''}`}
              >
                <td
                  className="py-1.5 pr-3 text-[var(--tinta-2)]"
                  title={linha.label === TICKET_LIQUIDO_LABEL ? fraseTicketLiquido() : undefined}
                >
                  {linha.label}
                </td>
                {CENARIOS.map((k) => {
                  // Lucro e margem de um cenário com custo quebrado: o texto, e
                  // nunca o lucro refeito com o custo zerado (ver CenarioCard).
                  const naoCalcula =
                    ((linha.dependeDoLucro || linha.label === 'Break-even (ingressos pagos)') &&
                      cenarioQuebrado(evento, c[k], c)) ||
                    ((linha.dependeDaReceita || DRE_DEPENDE_DA_RECEITA.has(linha.label)) &&
                      receitaDoCenarioQuebrada(evento, c[k], c))
                  const usaPp = modoDre === 'pp' && linha.raw
                  const valor = naoCalcula
                    ? NUMERO_NAO_CALCULA
                    : usaPp
                    ? (() => {
                        const pp = divPorPessoa(linha.raw(c[k]), c[k].publico)
                        return pp == null ? DASH : fmtBRL2(pp)
                      })()
                    : linha.get(c[k], evento, c)
                  return (
                    <td
                      key={k}
                      className={`py-1.5 pr-3 text-right tnum ${linha.tone && !naoCalcula ? linha.tone(c[k]) : ''}`}
                    >
                      {valor}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {modoDre === 'pp' && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            R$/pax usa o público de cada cenário (pagos + cortesias); linhas de contagem, ticket e % não
            mudam de forma (já são "por pessoa" ou proporcionais por natureza).
          </p>
        )}
        {c.realista.patrocinioPotencial > 0 && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            📝 <strong>{fmtOuIlegivel(c.realista.patrocinioPotencial, fmtBRL)}</strong> de patrocínio em proposta
            fora desta conta — potencial visível, só entra na receita (e no semáforo) quando for
            marcado como confirmado ou recebido, na aba Receita.
          </p>
        )}
        {isOpenBar(evento) && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            <strong>Evento open bar</strong> — sem receita de bar: a linha “Bar (lucro líquido)”
            vale R$ 0 nos três cenários (sugestão 27, regra de 18/07/2026). O custo do bar
            continua nos Custos (A&amp;B), sob seu controle.
          </p>
        )}
        {!isOpenBar(evento) && isBarPorPessoa(evento) && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            <strong>Bar por pessoa</strong> (sugestão 42, conta aprovada em 19/07/2026): a linha
            “Bar (lucro líquido)” varia por cenário — {premissaBar(evento)}. No realista:{' '}
            {contaBarPorPessoa(evento, c.realista)}
          </p>
        )}
        {taxaCliente && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            <strong>Taxa paga pelo cliente</strong> (sugestão 29b): a taxa de{' '}
            {num(evento.taxaBilheteria)}% não desconta da receita — o cliente paga o preço
            final (pós-desconto × (1 + taxa), coluna “Ao cliente” na aba Receita). O cashback
            segue inalterado.
          </p>
        )}
        {num(evento.descontoMedioPct) !== 0 && (
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            Receita bruta e ticket médio já aplicam o desconto —{' '}
            <strong>{premissaDesconto(evento)}</strong>: receita = lotes × preço × (1 − desconto
            efetivo), com taxa e cashback por cima; desconto efetivo = cupom × fração
            {evento.descontoIngressosModo === 'numero' &&
            evento.descontoIngressosValor !== '' &&
            evento.descontoIngressosValor != null ? (
              <>
                {' '}
                (por cenário: pessimista {fmtPct(descontoEfetivoPct(evento, c.pessimista.pagos), 2)} ·
                realista {fmtPct(descontoEfetivoPct(evento, c.realista.pagos), 2)} · otimista{' '}
                {fmtPct(descontoEfetivoPct(evento, c.otimista.pagos), 2)})
              </>
            ) : (
              <> = {fmtPct(descontoEfetivoPct(evento, c.realista.pagos), 2)}</>
            )}{' '}
            — sugestão 29, contas aprovadas em 19/07/2026.
          </p>
        )}
      </Card>

      <Card id="cen-comparacao" className="scroll-mt-16 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">Comparação com eventos passados</h3>
          <Segmented
            value={modoBm}
            onChange={setModoBm}
            options={[
              ['abs', 'Absoluto'],
              ['pp', 'Por pessoa'],
            ]}
          />
          <div className="ml-auto">
            <BenchmarkChips evento={evento} update={update} store={store} setStore={setStore} />
          </div>
        </div>

        {modoBm === 'pp' && !publicoPrev && (
          <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            Preencha o público (lotes ou público estimado) para ver a previsão por pessoa.
          </p>
        )}

        {/* O CONTÁGIO (26/07/2026): a régua quebrada estraga a leitura da festa
            SÃ. Uma "Marfim de outubro" sem defeito nenhum, comparada contra um
            benchmark promovido de uma festa com custo quebrado, saiu assim —
            medido, largura lida do estilo de cada barra:
              Custo total ..... Marfim R$ 29 mil → 0% (2px)  ×  quebrada R$ 0
              Estrutura ....... Previsão R$ 20 mil → 2e-302% ×  quebrada → 100%
            O número da festa sã continua certo na coluna; a BARRA dela vira um
            risco. A faixa nomeia a referência culpada. Ela não esconde nem
            recalcula nada — as barras seguem idênticas. */}
        <AvisoBenchmarkQuebrado benchmarks={bms} className="mb-3" />

        <h4 className="mb-1.5 text-xs font-semibold text-[var(--tinta-2)]">Custo total</h4>
        <HBars
          rows={[
            {
              label: `${evento.nome} (previsão)`,
              value: valorPrev(c.realista.custoTotal),
              highlight: true,
            },
            ...bms.map((b) => linhaBm(b, b.custoTotal)),
          ]}
          valueFmt={modoBm === 'pp' ? fmtBRL2 : fmtCompact}
        />

        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
          {CAT_KEYS.map((key) => {
            const prev = c.realista.custosCategorias.find((x) => x.id === key)?.considerado || 0
            const linhas = [
              { label: 'Previsão', value: prev > 0 ? valorPrev(prev) : prev === 0 ? valorPrev(0) : null, highlight: true },
              ...bms
                .filter((b) => b.custos?.[key] != null)
                .map((b) => linhaBm(b, b.custos[key])),
            ]
            if (linhas.length <= 1 && prev === 0) return null
            return (
              <div key={key}>
                <h4 className="mb-1.5 text-xs font-semibold text-[var(--tinta-2)]">{CAT_LABELS[key]}</h4>
                <HBars rows={linhas} valueFmt={modoBm === 'pp' ? fmtBRL2 : fmtCompact} />
              </div>
            )
          })}
        </div>

        {(bms.some((b) => b.obs) || bms.some(temSemReserva)) && (
          <div className="mt-4 space-y-1 border-t border-[var(--borda)] pt-3">
            {/* O motivo da etiqueta "sem reserva" (decisão 3 do Marco): sem
                esta linha o benchmark promovido apenas PARECE mais barato que
                os históricos, e a comparação lado a lado engana em silêncio. */}
            {bms.some(temSemReserva) && (
              <p className="text-[11px] text-[var(--tinta-3)]">
                <EtiquetaSemReserva
                  texto={ETIQUETA_SEM_RESERVA}
                  explicacao={EXPLICACAO_SEM_RESERVA}
                  className="mr-1 align-middle"
                />
                {EXPLICACAO_SEM_RESERVA}
              </p>
            )}
            {bms
              .filter((b) => b.obs)
              .map((b) => (
                <p key={b.id} className="text-[11px] text-[var(--tinta-3)]">
                  <span className="font-medium">{b.nome}:</span> {b.obs}
                </p>
              ))}
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">Comparar com outro evento</h3>
          {outroEvento && (
            <Segmented
              value={modoComp}
              onChange={setModoComp}
              options={[
                ['abs', 'Absoluto'],
                ['pp', 'Por pessoa'],
              ]}
            />
          )}
          <div className="ml-auto w-64">
            <Select
              value={outroId}
              onChange={(e) => setOutroId(e.target.value)}
              options={[
                {
                  value: '',
                  label: outrasPrevisoes.length
                    ? 'Escolher evento…'
                    : 'Nenhum outro evento salvo',
                },
                ...outrasPrevisoes.map((e) => ({
                  value: e.id,
                  label: `${e.nome}${e.data ? ` — ${fmtData(e.data)}` : ''}`,
                })),
              ]}
            />
          </div>
        </div>

        {!outroEvento && (
          <p className="text-xs text-[var(--tinta-3)]">
            Escolha outro evento salvo para ver o cenário realista dele lado a lado com este —
            é só visualização, nada é salvo (tira o alt-tab de decisões como "Komplexo Tempo ×
            outro espaço").
          </p>
        )}

        {outroEvento && outroRealista && (
          <>
            <p className="mb-4 text-xs text-[var(--tinta-2)]">
              Comparando <strong className="text-[var(--tinta-2)]">{evento.nome}</strong>
              {evento.data ? ` (${fmtData(evento.data)})` : ''} · cenário realista ×{' '}
              <strong className="text-[var(--tinta-2)]">{outroEvento.nome}</strong>
              {outroEvento.data ? ` (${fmtData(outroEvento.data)})` : ''} · cenário realista.
              Sempre o realista dos dois lados — pessimista/otimista não entram aqui.
            </p>

            <h4 className="mb-2 text-xs font-semibold text-[var(--tinta-2)]">
              Resultado (cenário realista)
            </h4>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-3">
              {[
                ['Receita total', c.realista.receitaTotal, outroRealista.receitaTotal],
                // Imposto (27/07/2026): entra quando QUALQUER um dos dois lados
                // tem — sem esta barra, comparar duas previsões em que só uma
                // paga imposto mostraria receita e lucro que não se explicam
                // entre si, e o lado sem imposto pareceria simplesmente melhor.
                ...(temImposto(c.realista) || temImposto(outroRealista)
                  ? [[IMPOSTO_LABEL, impostoValor(c.realista), impostoValor(outroRealista)]]
                  : []),
                ['Custo total', c.realista.custoTotal, outroRealista.custoTotal],
                ['Lucro', c.realista.lucro, outroRealista.lucro],
              ].map(([label, meu, dele]) => (
                <div key={label}>
                  <h5 className="mb-1.5 text-[11px] font-medium text-[var(--tinta-3)]">{label}</h5>
                  <HBars
                    rows={[
                      { label: evento.nome, value: ppMeu(meu), highlight: true },
                      { label: outroEvento.nome, value: ppOutro(dele) },
                    ]}
                    valueFmt={modoComp === 'pp' ? fmtBRL2 : fmtCompact}
                  />
                </div>
              ))}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 border-t border-[var(--borda)] pt-3 text-xs sm:grid-cols-4">
              {[
                ['Ticket médio', fmtBRL2(c.realista.ticketMedio), fmtBRL2(outroRealista.ticketMedio)],
                ['Margem', fmtPct(c.realista.margem), fmtPct(outroRealista.margem)],
                ['Público', fmtInt(c.realista.publico), fmtInt(outroRealista.publico)],
              ].map(([label, meu, dele]) => (
                <div key={label} className="flex justify-between gap-2 sm:block">
                  <dt className="text-[var(--tinta-3)]">{label}</dt>
                  <dd className="tnum text-[var(--tinta-2)]">
                    {meu} <span className="text-[var(--tinta-3)]">×</span> {dele}
                  </dd>
                </div>
              ))}
            </dl>

            <h4 className="mb-1.5 mt-5 text-xs font-semibold text-[var(--tinta-2)]">
              Custos por categoria
            </h4>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
              {CAT_KEYS.map((key) => {
                const meu = c.realista.custosCategorias.find((x) => x.id === key)?.considerado || 0
                const dele = outroPseudo.custos[key] || 0
                if (meu === 0 && dele === 0) return null
                return (
                  <div key={key}>
                    <h5 className="mb-1.5 text-xs font-semibold text-[var(--tinta-2)]">{CAT_LABELS[key]}</h5>
                    <HBars
                      rows={[
                        { label: evento.nome, value: ppMeu(meu), highlight: true },
                        { label: outroEvento.nome, value: ppOutro(dele) },
                      ]}
                      valueFmt={modoComp === 'pp' ? fmtBRL2 : fmtCompact}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
