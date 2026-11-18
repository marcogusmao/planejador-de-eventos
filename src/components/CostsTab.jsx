import { useState } from 'react'
import { Btn, Card, Stat, Field, TextInput, MoneyInput, PctInput, Select, Segmented, Badge, BarraOrcamentoFechado, AncoraNav, BotoesOrdem, corDelta, EtiquetaSemReserva, CampoData } from './ui.jsx'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { AppIcon, ChevronDown, ChevronRight, X, TriangleAlert, Copy, NotebookPen } from './AppIcon.jsx'
import CarregarBenchmarkModal from './CarregarBenchmarkModal.jsx'
import AvisoCustoQuebrado, { AvisoBenchmarkQuebrado, NUMERO_NAO_CALCULA } from './AvisoCustoQuebrado.jsx'
import { publicoIlegivel, publicoDaReferencia, ESTADO_PUBLICO } from '../lib/dadoQuebrado.js'
import { NotaLoteSemPreco } from './AvisoLoteSemPreco.jsx'
import { custosPorCategoria, contingencia, computeCenario, computeCenarios, custosPorStatus, custouZeroEfetivo } from '../lib/calc.js'
import { fmtBRL, fmtBRL2, fmtCompact, fmtInt } from '../lib/format.js'
import { CATEGORIAS_PADRAO, STATUS, novoItem, itensDispensadosDoEvento } from '../lib/defaults.js'
import {
  benchmarksAtivos,
  benchmarksVisiveis,
  ocultarBenchmark,
  mostrarBenchmark,
  porPessoa,
  divPorPessoa,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import { showToast } from '../lib/toast.js'
import { FAIXA_PCT, FAIXA_CUSTO } from '../lib/campoNumerico.js'
import { carimboItem } from '../lib/financeiro.js'
import { temParcelas, resumoParcelas, divergenciaParcelas, resumoQuitacao, progressoParcelasPagas, realizadoVazio } from '../lib/parcelas.js'
import { temAnotacoes } from '../lib/dossie.js'
import ParcelasModal from './ParcelasModal.jsx'
import DossieCustoModal from './DossieCustoModal.jsx'
import { uid, num } from '../lib/util.js'
import { moverEmLista, planejarMovimento } from '../lib/ordenar.js'
// A frase e a cor do delta vêm de fora (confrontoCustos.js + ui.jsx): são as
// MESMAS que a aba Fechamento usa. Antes cada tela tinha a sua cópia, e foi
// assim que as duas passaram a dizer coisas opostas sobre o mesmo evento.
import { confrontoCustos, confrontoDeItens, textoDelta } from '../lib/confrontoCustos.js'

export function BenchmarkChips({ evento, update, store, setStore }) {
  // Só os visíveis (sugestão 25): benchmark oculto some dos chips também —
  // volta ao aparecer de novo (o evento não é tocado).
  const todos = benchmarksVisiveis(store)
  const ativos = Array.isArray(evento.benchmarksAtivos)
    ? evento.benchmarksAtivos
    : todos.map((b) => b.id)
  // Deriva a lista de `e` (não do render): cliques no mesmo batch do React
  // não se engolem (achado S3 do BACKLOG).
  const toggle = (id) =>
    update(
      (e) => {
        const atuais = Array.isArray(e.benchmarksAtivos)
          ? e.benchmarksAtivos
          : todos.map((b) => b.id)
        return {
          ...e,
          benchmarksAtivos: atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
        }
      },
      'ligar/desligar um benchmark da comparação'
    )
  // Ocultar de TODAS as comparações (tema F + princípio "ação mora no objeto"):
  // o × mora no próprio chip, oculta na hora e some com toast + Desfazer — não
  // precisa ir aos Ajustes. Reversível: benchmarksOcultos guarda só IDs.
  const ocultarGlobal = (b) => {
    setStore((s) => ocultarBenchmark(s, b.id), `ocultar "${b.nome}" das comparações`)
    showToast(`${b.nome} ocultado das comparações`, {
      acaoLabel: 'Desfazer',
      onAcao: () => setStore((s) => mostrarBenchmark(s, b.id), `mostrar "${b.nome}" nas comparações`),
    })
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-[var(--tinta-2)]">Benchmarks:</span>
      {todos.map((b) => {
        const on = ativos.includes(b.id)
        return (
          <span key={b.id} className="group/chip inline-flex items-center">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => toggle(b.id)}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                on
                  ? 'border-[var(--ativo-fundo)] bg-[var(--ativo-fundo)] text-[var(--ativo-texto)]'
                  : 'border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-3)] hover:border-[var(--tinta-3)]'
              }`}
              title={
                [
                  temSemReserva(b) ? EXPLICACAO_SEM_RESERVA : null,
                  b.obs,
                  on ? 'Clique para tirar desta comparação' : 'Clique para incluir nesta comparação',
                ]
                  .filter(Boolean)
                  .join(' — ')
              }
            >
              {b.nome}
              {temSemReserva(b) && (
                <span className="ml-1 opacity-70">· {ETIQUETA_SEM_RESERVA}</span>
              )}
            </button>
            {setStore && (
              <button
                type="button"
                onClick={() => ocultarGlobal(b)}
                title={`Ocultar ${b.nome} de todas as comparações (reversível)`}
                aria-label={`Ocultar ${b.nome} de todas as comparações`}
                className="ml-0.5 hidden h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--tinta-3)] hover:bg-[var(--papel-2)] hover:text-[var(--vermelho-texto)] group-hover/chip:inline-flex"
              >
                <AppIcon icon={X} size={13} />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

const SUGESTOES = Object.fromEntries(CATEGORIAS_PADRAO.map((c) => [c.key, c.sugestoes]))

function Categoria({ cat, evento, update, bms, onUsarBenchmark }) {
  const [aberta, setAberta] = useState(true)
  // Item com o modal "Parcelar…" aberto (Sessão F2-C) — o modal edita o
  // MESMO item do estado (salvo automático, como qualquer campo).
  const [parcelandoId, setParcelandoId] = useState(null)
  // Item com o Dossiê aberto (sugestão 40) — mesmo padrão: o modal edita o
  // item do estado atual, nada é cópia.
  const [dossieId, setDossieId] = useState(null)
  const itens = cat.itens || []
  // Cabeçalho da categoria pela FONTE ÚNICA. Aqui morava a QUARTA cópia do par
  // incomparável do S1 (20/07/2026): "Estimado (todos os itens) · Realizado (só
  // de quem tem)", lado a lado, no mesmo cabeçalho — o A&B do Marco mostrava
  // "Estimado R$ 303.880 · Realizado R$ 303.147" e parecia economia, quando a
  // verdade era estouro de R$ 3.147.
  const cf = confrontoDeItens(itens)

  // setCat aceita patch simples ou função de (c): itens SEMPRE derivam da
  // categoria atual dentro do update, nunca do closure do render — senão
  // adições/remoções no mesmo batch do React se perdem (achado S3 do BACKLOG).
  // O 2º argumento é o rótulo do passo de desfazer (opcional — ver App.jsx).
  // `p` pode devolver NULL para dizer "nada a fazer": aí o evento volta pela
  // MESMA referência e o reducer não empilha passo de desfazer (achado S3-F —
  // o `{ ...e }` incondicional daqui fazia até o clique impossível virar um
  // "Desfazer: mover X para cima" que não mexia em nada na tela).
  const setCat = (p, descritor) =>
    update((e) => {
      const atual = e.categorias.find((c) => c.id === cat.id)
      if (!atual) return e
      const patch = typeof p === 'function' ? p(atual) : p
      if (patch == null) return e
      return {
        ...e,
        categorias: e.categorias.map((c) => (c.id === cat.id ? { ...c, ...patch } : c)),
      }
    }, descritor)
  const setItem = (id, p) =>
    setCat((c) => ({ itens: (c.itens || []).map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const addItem = (servico = '') => {
    setCat((c) => ({ itens: [...(c.itens || []), novoItem({ servico })] }), 'adicionar um item de custo')
    setAberta(true)
  }
  const rmItem = (id) => setCat((c) => ({ itens: (c.itens || []).filter((i) => i.id !== id) }), 'apagar um item de custo')
  // Reordenar (setas ↑↓): passa pelo MESMO setCat de qualquer edição, então o
  // desfazer/refazer pega de graça e o save automático também. A posição é
  // achada pelo id DENTRO do update (ordenar.js), nunca pelo índice do render
  // — dois cliques rápidos no mesmo batch do React não se atrapalham (S3 do
  // BACKLOG). Nenhum campo é criado: a lista é a mesma, noutra ordem.
  //
  // O patch é NULL quando nada muda — aí o evento volta pela mesma referência e
  // não vira passo de desfazer vazio (S3-F).
  //
  // O aviso sai da lista do RENDER, não de dentro do updater: `update` é um
  // dispatch de reducer e o updater só roda depois, no render — ler o aviso lá
  // dentro dava sempre `null` e o toast nunca aparecia (pego ao vivo).
  const moverItemCusto = (item, direcao, indice) => {
    const aviso = planejarMovimento(itens, item.id, direcao, indice).aviso
    setCat(
      (c) => {
        const r = moverEmLista(c, 'itens', item.id, direcao, indice)
        return r.mudou ? { itens: r.obj.itens } : null
      },
      `mover ${item.servico?.trim() ? `“${item.servico.trim()}”` : 'um item de custo'} para ${direcao}`
    )
    if (aviso) showToast(aviso)
  }
  const rmCategoria = () => {
    if (itens.length > 0 && !window.confirm(`Remover a categoria "${cat.nome}" e seus ${itens.length} itens?`)) return
    update(
      (e) => ({ ...e, categorias: e.categorias.filter((c) => c.id !== cat.id) }),
      `remover a categoria "${cat.nome}"`
    )
  }

  const refs = bms
    // Público ilegível (S1, 07/10/2026): a divisão dava NaN e saía
    // "(R$ 0/pessoa)". `ppIlegivel` troca o número pela frase; zero e
    // ausência seguem sem o parêntese, como sempre — e só o público válido
    // divide (o texto "0" passava pelo `publico &&` e dividia por zero).
    .map((b) => ({
      b,
      nome: b.nome,
      valor: b.custos?.[cat.id],
      pp: publicoDaReferencia(b).estado === ESTADO_PUBLICO.VALIDO ? porPessoa(b, b.custos?.[cat.id]) : null,
      ppIlegivel: publicoIlegivel(b),
    }))
    .filter((r) => r.valor != null)
  const sugestoes = (SUGESTOES[cat.id] || []).filter(
    (s) => !itens.some((i) => i.servico.trim().toLowerCase() === s.toLowerCase())
  )

  return (
    // id + scroll-mt: alvo das âncoras (item 8); a seção não aterrissa atrás
    // da fileira sticky.
    <Card id={`cat-${cat.id}`} className="scroll-mt-16">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--tinta)]"
          aria-label={aberta ? 'Recolher' : 'Expandir'}
        >
          <AppIcon icon={aberta ? ChevronDown : ChevronRight} />
        </button>
        <input
          value={cat.nome}
          onChange={(e) => setCat({ nome: e.target.value })}
          className="min-w-40 flex-1 rounded bg-transparent text-sm font-semibold outline-none hover:bg-[var(--papel-2)] focus:bg-[var(--papel-2)]"
        />
        <span className="text-xs text-[var(--tinta-2)]">
          Orçamento <span className="tnum font-semibold text-[var(--tinta)]">{fmtBRL(cf.estimadoTodos)}</span>
          {cf.algum && (
            <>
              {' · '}Realizado{' '}
              <span className="tnum font-semibold text-[var(--tinta)]">{fmtBRL(cf.realizado)}</span>{' '}
              <span className="text-[var(--tinta-3)]">
                ({cf.nComRealizado}/{cf.nItens} · estimado desses {fmtBRL(cf.estimadoDosMesmos)})
              </span>
              {' · '}
              <span className={`tnum font-semibold ${corDelta(cf.delta)}`}>
                {textoDelta(cf.delta, fmtBRL)}
              </span>
            </>
          )}
        </span>
        {!cat.padrao && (
          <button
            type="button"
            onClick={rmCategoria}
            className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--vermelho-texto)]"
            title="Remover categoria"
            aria-label={`Remover categoria ${cat.nome}`}
          >
            <AppIcon icon={X} size={14} />
          </button>
        )}
      </div>

      {refs.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--borda)] bg-[var(--papel-2)] px-4 py-1.5 text-[11px] text-[var(--tinta-2)]">
          <span className="font-medium">Referências:</span>
          {refs.map((r) =>
            // Cada referência vira clicável (sugestão 33, gesto "por categoria"):
            // "usar como base em {categoria}" — puxa só o total desta categoria
            // como item, com revisão antes. Ação mora no objeto (princípio 9).
            onUsarBenchmark ? (
              <button
                key={r.nome}
                type="button"
                onClick={() => onUsarBenchmark(r.b, cat.id)}
                title={`Usar ${r.nome} como base em ${cat.nome} — adiciona o total (${fmtCompact(r.valor)}) como um item, com revisão antes`}
                className="tnum cursor-pointer rounded border border-transparent px-1 py-0.5 underline decoration-dotted underline-offset-2 hover:border-[var(--borda-2)] hover:bg-[var(--papel)] hover:text-[var(--tinta)]"
              >
                {r.nome} {fmtCompact(r.valor)}
                {r.ppIlegivel ? ` (por pessoa: ${NUMERO_NAO_CALCULA})` : r.pp != null ? ` (${fmtBRL2(r.pp)}/pessoa)` : ''}
                {temSemReserva(r.b) && (
                  <EtiquetaSemReserva
                    texto={ETIQUETA_SEM_RESERVA}
                    explicacao={EXPLICACAO_SEM_RESERVA}
                    className="ml-1 align-middle"
                  />
                )}
              </button>
            ) : (
              <span key={r.nome} className="tnum">
                {r.nome} {fmtCompact(r.valor)}
                {r.ppIlegivel ? ` (por pessoa: ${NUMERO_NAO_CALCULA})` : r.pp != null ? ` (${fmtBRL2(r.pp)}/pessoa)` : ''}
                {temSemReserva(r.b) && (
                  <EtiquetaSemReserva
                    texto={ETIQUETA_SEM_RESERVA}
                    explicacao={EXPLICACAO_SEM_RESERVA}
                    className="ml-1 align-middle"
                  />
                )}
              </span>
            )
          )}
        </div>
      )}

      {aberta && (
        <div className="border-t border-[var(--borda)] p-4 pt-3">
          {itens.length > 0 && (
            <div className="overflow-x-auto">
              {/* Grade da EDIÇÃO de custos (item 3, F2-W · punho à esquerda —
                  pedido do Marco, 20/07/2026): a coluna Serviço é a identidade
                  da linha e nunca encolhe abaixo do legível — ganha um piso de
                  largura (min-w) como a F2-P protegeu o Serviço no RELATÓRIO.
                  TODAS as ações da linha (ordem ↑↓, dossiê, remover) moram num
                  punho único à ESQUERDA, onde a mão procura — o desenho
                  anterior grudava dossiê/remover na borda direita com colunas
                  sticky, e numa janela comum era preciso saber que elas
                  existiam atrás do arrasto. Em tela estreita a linha reflui
                  pelo overflow-x-auto (scroll), o nome nunca vira
                  "Loca"/"Segu"/"ECA". */}
              <table className="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--tinta-2)]">
                    <th
                      className="w-24 py-1.5 pr-1 font-medium"
                      title="Ações da linha: as setas mudam a ordem do item nesta categoria (nenhuma conta lê a posição; só o arredondamento do último dígito pode oscilar num empate); o caderno abre o dossiê; o × remove o item."
                    >
                      Ações
                    </th>
                    <th className="min-w-[12rem] py-1.5 pr-2 font-medium">Serviço / produto</th>
                    <th className="w-36 py-1.5 pr-2 font-medium">Fornecedor</th>
                    <th className="w-32 py-1.5 pr-2 font-medium">Estimado</th>
                    <th className="w-32 py-1.5 pr-2 font-medium">Realizado</th>
                    <th className="w-36 py-1.5 pr-2 font-medium">Status</th>
                    <th
                      className="w-44 py-1.5 pr-2 font-medium"
                      title="Data de pagamento/vencimento (opcional) — alimenta a aba Análise e o Exportar pagamentos. Nenhum cenário muda."
                    >
                      Pagamento
                    </th>
                    <th className="w-28 py-1.5 pr-2 font-medium">Responsável</th>
                    <th className="w-36 py-1.5 pr-2 font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, indice) => (
                    <tr key={i.id} className="border-t border-[var(--borda)]">
                      <td className="py-1 pr-1">
                        {/* O punho da linha: ordem + dossiê + remover, juntos
                            à esquerda (ghost, fundo só no hover — guia
                            Linear). O caderno fica azul quando o item tem
                            anotações; o × só avermelha no hover (destrutivo
                            não grita parado). */}
                        <span className="inline-flex items-center gap-0.5">
                          <BotoesOrdem
                            nome={i.servico}
                            tipo="item"
                            indice={indice}
                            total={itens.length}
                            onSubir={() => moverItemCusto(i, 'cima', indice)}
                            onDescer={() => moverItemCusto(i, 'baixo', indice)}
                          />
                          <button
                            type="button"
                            onClick={() => setDossieId(i.id)}
                            className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors hover:bg-[var(--papel-2)] ${
                              temAnotacoes(i)
                                ? 'text-[var(--azul-texto)] hover:opacity-75'
                                : 'text-[var(--tinta-3)] hover:text-[var(--tinta)]'
                            }`}
                            title={`Dossiê de ${i.servico || 'custo sem nome'} — números, pagamento e anotações${temAnotacoes(i) ? ' (tem anotações)' : ''}`}
                            aria-label={`Abrir o dossiê de ${i.servico || 'custo sem nome'}`}
                          >
                            <AppIcon icon={NotebookPen} size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => rmItem(i.id)}
                            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--tinta-3)] transition-colors hover:bg-[var(--tarja-alerta-fundo)] hover:text-[var(--vermelho-texto)]"
                            title={`Remover ${i.servico || 'este item'}`}
                            aria-label={`Remover ${i.servico || 'este item'}`}
                          >
                            <AppIcon icon={X} size={14} />
                          </button>
                        </span>
                      </td>
                      <td className="py-1 pr-2">
                        <TextInput value={i.servico} onChange={(e) => setItem(i.id, { servico: e.target.value })} placeholder="Serviço" />
                        {(() => {
                          // Carimbo da ponte (Sessão H): item criado/atualizado
                          // pelo "Buscar dados do Financeiro" diz origem e hora.
                          const c = carimboItem(i)
                          return c ? (
                            <p className="mt-0.5 text-[10px] text-[var(--tinta-3)]">
                              {c.texto}
                            </p>
                          ) : null
                        })()}
                      </td>
                      <td className="py-1 pr-2">
                        <TextInput value={i.fornecedor} onChange={(e) => setItem(i.id, { fornecedor: e.target.value })} placeholder="—" />
                      </td>
                      <td className="py-1 pr-2">
                        <MoneyInput value={i.estimado} onChange={(v) => setItem(i.id, { estimado: v })} faixa={FAIXA_CUSTO} />
                      </td>
                      <td className="py-1 pr-2">
                        {/* Decisão do Marco (22/07/2026): com parcelas e o
                            Realizado ainda vazio, a célula deixa de ser campo e
                            mostra o PROGRESSO derivado das parcelas (nada
                            gravado; o custo previsto não cai). Marcar a ÚLTIMA
                            parcela grava aqui a soma. Realizado digitado à mão
                            vence e volta a ser campo editável. */}
                        {temParcelas(i) && realizadoVazio(i) ? (
                          (() => {
                            const prog = progressoParcelasPagas(i)
                            return (
                              <span
                                className="tnum inline-flex items-center rounded-lg border border-dashed border-[var(--borda-2)] bg-[var(--papel-2)] px-2 py-1 text-xs text-[var(--tinta-2)]"
                                title="Derivado das parcelas — edite as parcelas. Ao marcar a última como paga, o Realizado é gravado aqui."
                              >
                                {fmtBRL(prog.valorPago)} · {prog.qtdPagas}/{prog.n} pagas
                              </span>
                            )
                          })()
                        ) : (
                          <>
                            <MoneyInput value={i.realizado} onChange={(v) => setItem(i.id, { realizado: v, realizadoAuto: false })} faixa={FAIXA_CUSTO} />
                            {custouZeroEfetivo(i) && (
                              <p
                                className="mt-0.5 text-[10px] font-medium text-[var(--tinta-3)]"
                                title="Marcado “custou zero” no dossiê (permuta/cortesia) — vale R$ 0, não o orçamento."
                              >
                                custou zero
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <Select
                          value={i.status}
                          onChange={(e) => setItem(i.id, { status: e.target.value })}
                          options={STATUS}
                          className="font-medium"
                          style={estiloStatusCusto(i.status)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        {/* Agenda de pagamento (F2-C): data única OU parcelas.
                            Nada aqui muda cenário — só Análise e exports. */}
                        {temParcelas(i) ? (
                          <button
                            type="button"
                            onClick={() => setParcelandoId(i.id)}
                            title="Editar as parcelas deste custo"
                            className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium ${
                              divergenciaParcelas(i)
                                ? // B3 (BACKLOG S4): tarja de alerta tema-aware —
                                  // border-red-300/bg-red-50/text-red-700 fixos
                                  // sumiam (viravam barra clara) no tema escuro.
                                  'border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] text-[var(--vermelho-texto)]'
                                : 'border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-2)] hover:border-[var(--tinta-3)]'
                            }`}
                          >
                            {resumoParcelas(i)}
                            {(() => {
                              // Sugestão 38: a célula já diz quantas parcelas
                              // estão quitadas ("2 pagas") — a leitura completa
                              // em R$ mora no editor/dossiê.
                              const q = resumoQuitacao(i)
                              return q ? (
                                <span className="text-[var(--verde-texto)]">
                                  {' · '}{q.qtdPagas} {q.qtdPagas === 1 ? 'paga' : 'pagas'}
                                </span>
                              ) : ''
                            })()}
                            {divergenciaParcelas(i) ? (
                              <> · <AppIcon icon={TriangleAlert} size={13} className="mx-0.5 align-[-2px]" /> soma difere</>
                            ) : ''}
                          </button>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CampoData
                              className="w-[8.2rem]"
                              value={i.dataPagamento || ''}
                              onChange={(iso) => setItem(i.id, { dataPagamento: iso })}
                              aria-label={`Data de pagamento de ${i.servico || 'custo'}`}
                              title="Data de pagamento/vencimento (opcional)"
                            />
                            <button
                              type="button"
                              onClick={() => setParcelandoId(i.id)}
                              className="cursor-pointer whitespace-nowrap text-[11px] text-[var(--tinta-3)] hover:text-[var(--tinta)]"
                              title="Dividir este custo em N parcelas {valor, data} — muda só o fluxo de pagamento, nunca o custo"
                            >
                              Parcelar…
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <TextInput value={i.responsavel} onChange={(e) => setItem(i.id, { responsavel: e.target.value })} placeholder="—" />
                      </td>
                      <td className="py-1 pr-2">
                        <TextInput value={i.obs} onChange={(e) => setItem(i.id, { obs: e.target.value })} placeholder="—" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Btn onClick={() => addItem()}>
              + Adicionar item
            </Btn>
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addItem(s)}
                className="cursor-pointer rounded-full border border-dashed border-[var(--borda-2)] px-2 py-0.5 text-[11px] text-[var(--tinta-3)] hover:border-[var(--tinta-3)] hover:text-[var(--tinta)]"
                title="Adicionar item sugerido"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {parcelandoId &&
        (() => {
          // O item vem SEMPRE do estado atual — o modal edita e re-renderiza
          // com o valor salvo (salvo automático, como qualquer campo).
          const item = itens.find((x) => x.id === parcelandoId)
          if (!item) return null
          return (
            <ParcelasModal
              item={item}
              onChange={(p) => setItem(item.id, p)}
              onClose={() => setParcelandoId(null)}
            />
          )
        })()}

      {dossieId &&
        (() => {
          // Mesmo padrão do Parcelar…: o item vem sempre do estado atual.
          const item = itens.find((x) => x.id === dossieId)
          if (!item) return null
          return (
            <DossieCustoModal
              item={item}
              categoriaNome={cat.nome}
              onChange={(p) => setItem(item.id, p)}
              onClose={() => setDossieId(null)}
            />
          )
        })()}
    </Card>
  )
}

export default function CostsTab({ evento, update, store }) {
  const [modoValor, setModoValor] = useState('abs')
  // Carregar de benchmark (sugestão 33): { bm, soCategoria } aberto no modal.
  // bm null + soCategoria null = modo planilha inteira (escolhe no seletor);
  // bm + soCategoria = gesto por categoria (referência clicada).
  const [carregar, setCarregar] = useState(null)
  const custos = custosPorCategoria(evento.categorias)
  const confronto = confrontoCustos(evento.categorias)
  const cont = contingencia(custos.totalConsiderado, evento.contingenciaPct)
  const bms = benchmarksAtivos(evento, store)
  const statusTotais = custosPorStatus(evento.categorias)
  // Dispensados "já incluso" (sug. 37): o DESFAZER migrou do bloco do veredito
  // para cá (Sessão Polimento Visual — item 1). A MARCAÇÃO segue no aviso do
  // semáforo; a REVERSÃO fica na faixa de resumo dos Custos, sempre visível e
  // reversível. Display-only — nenhum cálculo lê `itensDispensados`.
  const dispensados = itensDispensadosDoEvento(evento)
  const desfazerDispensa = (nome) =>
    update(
      (e) => ({
        ...e,
        itensDispensados: (e.itensDispensados || []).filter((n) => n !== nome),
      }),
      `trazer de volta o aviso de “${nome}”`
    )

  const publicoPrev = computeCenarios(evento).realista.publico || num(evento.publicoEstimado)
  const pp = modoValor === 'pp'
  const val = (v) => (pp ? divPorPessoa(v, publicoPrev) : v)
  const fmtVal = (v) => {
    const x = val(v)
    return x == null ? '—' : pp ? fmtBRL2(x) : fmtBRL(x)
  }

  const addCategoria = () =>
    update(
      (e) => ({
        ...e,
        categorias: [...e.categorias, { id: uid(), nome: 'Nova categoria', padrao: false, itens: [] }],
      }),
      'adicionar uma categoria de custo'
    )

  // Âncoras (item 8, sugestão 39): um chip por categoria; rótulo curto (o nome
  // longo "Locação & Documentação" vira "Locação"). A fileira some em impressão.
  const rotuloCurto = (nome) => {
    const n = (nome || 'Categoria').trim()
    return n.length <= 14 ? n : n.split(' & ')[0].trim() || n
  }
  const ancoras = evento.categorias.map((cat) => ({ id: `cat-${cat.id}`, label: rotuloCurto(cat.nome) }))

  return (
    <div className="space-y-5">
      {/* Dado quebrado (Marco, 26/07/2026): quando um custo não cabe numa conta
          de dinheiro, os totais desta aba imprimem R$ 0. A faixa vem ANTES
          deles, para ninguém ler o zero achando que é o custo da festa. */}
      <AvisoCustoQuebrado evento={evento} />
      {/* O CONTÁGIO (26/07/2026): as linhas "Referências:" de cada categoria
          imprimem o valor do benchmark cru. Com uma referência quebrada, medido
          numa festa SÃ: a de A&B saiu "Brisa quebrada R$ 3 mil" e a de
          Estrutura saiu "Brisa quebrada R$ 1000…000" — 323 caracteres de
          número numa faixa de rodapé, sem aviso nenhum. A faixa nomeia a
          referência; nenhum valor é escondido nem recalculado. */}
      <AvisoBenchmarkQuebrado benchmarks={bms} />
      <AncoraNav itens={ancoras} />
      <Card className="p-4">
        {/* Faixa de resumo redesenhada (Sessão Polimento Visual — item 3): TRÊS
            grupos que se leem juntos, separados por divisórias —
              1) leituras-base: Total estimado · Total realizado;
              2) contingência: o campo (%) COM o seu resultado em R$;
              3) o HERÓI "Custo total previsto" (= considerado + contingência),
                 destacado num bloco próprio e no maior corpo da faixa.
            O toggle Absoluto/R$pessoa fica no canto (controla a unidade de
            TODOS os números). Nenhum número, rótulo ou microtexto normativo
            mudou ("usa o realizado quando preenchido" segue no herói). O total
            usa TINTA NORMAL — só fica vermelho se de fato ficar negativo. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            {/* 1) leituras-base. O par "Total estimado × Total realizado" saiu
                daqui (Sessão de clareza, 20/07/2026): os dois números estavam
                certos e não eram COMPARÁVEIS — o estimado soma todos os itens,
                o realizado só os que já têm realizado. Lado a lado, convidavam
                a "gastamos menos que o previsto" quando a verdade podia ser o
                contrário (nos números do Marco: parecia −733, era +3.147 acima).
                Agora o realizado é confrontado com o estimado DOS MESMOS itens,
                com o delta escrito por extenso e o que falta declarado.
                É leitura pura (confrontoCustos.js) — nenhuma conta nova. */}
            <div className="flex items-end gap-x-6">
              <Stat
                label="Total estimado"
                value={fmtVal(custos.totalEstimado)}
                valueClass="text-[var(--tinta-2)]"
                sub={confronto.algum ? 'orçamento de todos os itens' : undefined}
              />
              {confronto.algum ? (
                <Stat
                  label={`Realizado (${confronto.nComRealizado} de ${confronto.nComRealizado + confronto.nSemRealizado} itens)`}
                  value={fmtVal(confronto.realizado)}
                  valueClass="text-[var(--tinta-2)]"
                  sub={
                    <>
                      <div>
                        estimado desses itens {fmtVal(confronto.estimadoDosMesmos)} ·{' '}
                        <b className={corDelta(confronto.delta)}>{textoDelta(confronto.delta, fmtVal)}</b>
                      </div>
                      <div>
                        {confronto.nSemRealizado === 0
                          ? 'todos os itens já têm realizado'
                          : `${confronto.nSemRealizado} ${confronto.nSemRealizado === 1 ? 'item ainda sem realizado' : 'itens ainda sem realizado'} (${fmtVal(confronto.estimadoPendente)} de estimado)`}
                      </div>
                    </>
                  }
                />
              ) : (
                <Stat
                  label="Total realizado"
                  value="—"
                  valueClass="text-[var(--tinta-3)]"
                  sub="nenhum item com realizado ainda"
                />
              )}
            </div>
            <span aria-hidden className="hidden h-10 w-px self-center bg-[var(--borda)] sm:block" />
            {/* 2) contingência: campo + resultado, lado a lado. w-28: o rótulo
                mede 95px — em w-24 (96px) vivia no limite do pixel (regra da
                casa F2-V: o campo tem a largura do seu rótulo, com folga). */}
            <div className="flex items-end gap-x-4">
              <Field label="Contingência (%)" className="w-28">
                <PctInput
                  value={evento.contingenciaPct}
                  onChange={(v) => update((e) => ({ ...e, contingenciaPct: v }))}
                  faixa={FAIXA_PCT}
                />
              </Field>
              <Stat label="Contingência" value={fmtVal(cont)} valueClass="text-[var(--tinta-2)]" />
            </div>
            <span aria-hidden className="hidden h-10 w-px self-center bg-[var(--borda)] sm:block" />
            {/* 3) HERÓI: bloco destacado, maior corpo da faixa */}
            <div className="rounded-xl border border-[var(--borda)] bg-[var(--papel-2)] px-4 py-2.5">
              <Stat
                label="Custo total previsto"
                value={fmtVal(custos.totalConsiderado + cont)}
                valueSize="text-3xl"
                sub={pp && !publicoPrev ? 'sem público para dividir' : 'usa o realizado quando preenchido'}
                valueClass={custos.totalConsiderado + cont < 0 ? 'text-[var(--vermelho-texto)]' : ''}
              />
            </div>
          </div>
          {/* toggle da UNIDADE de todos os valores da aba */}
          <Segmented
            value={modoValor}
            onChange={setModoValor}
            options={[
              ['abs', 'Absoluto'],
              ['pp', 'R$/pessoa'],
            ]}
          />
        </div>
        {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): em
            R$/pessoa, todo valor desta aba é dividido pelo público do
            realista, que já não conta o lote — a nota diz por que o divisor
            encolheu. Só no modo por pessoa: em Absoluto nenhum número daqui
            depende do público. */}
        {pp && publicoPrev > 0 && (
          <NotaLoteSemPreco
            evento={evento}
            prefixo={`R$/pessoa divide por ${fmtInt(publicoPrev)} pessoas — `}
            className="mt-3"
          />
        )}
        {/* Benchmarks — faixa PRÓPRIA (item 3): os chips de comparação à esquerda,
            o gesto "usar um benchmark como base" à direita. Sugestão 33, gesto
            "planilha inteira": carrega os custos de uma festa passada como base
            editável, com revisão antes (princípio 9). */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--borda)] pt-3">
          <BenchmarkChips evento={evento} update={update} store={store} />
          {/* O rótulo diz o que VEM (achado S4 do BACKLOG, 27/07/2026): o Marco
              importou a planilha da Marfim Alto Casa Norte com 81 linhas,
              clicou aqui esperando as 81 e recebeu UMA linha por categoria, com
              o nome da festa no campo "Serviço / produto". O gesto está certo —
              um benchmark guarda sete números, um por categoria — quem mentia
              era o botão: "usar como base" faz esperar a base inteira. O aviso
              já existia, mas só no chip POR CATEGORIA, logo acima. */}
          <Btn
            variant="ghost"
            onClick={() => setCarregar({ bm: null, soCategoria: null })}
            title="Traz o TOTAL de cada categoria da festa escolhida — uma linha por categoria, não as linhas de custo da planilha dela."
          >
            <AppIcon icon={Copy} /> Usar um benchmark como base (1 linha por categoria)…
          </Btn>
        </div>
        <div className="mt-3 border-t border-[var(--borda)] pt-3">
          {/* B5 (BACKLOG S4, 20/07/2026): a barra usava fmtBRL fixo enquanto os
              Stat da mesma faixa usam fmtVal (respeita o toggle Absoluto/R$
              pessoa) — "R$ 356,50" ao lado de "de R$ 31.000,00", mesma
              grandeza, unidades diferentes. statusTotais chega em R$
              absoluto, como os Stat acima; fmtVal já faz a divisão por
              pessoa quando o toggle está em "R$/pessoa". Nenhum total muda. */}
          <BarraOrcamentoFechado totais={statusTotais} fmt={fmtVal} />
        </div>
        {/* Itens comuns marcados "já incluso" (sug. 37) — o DESFAZER mora AQUI
            (item 1): saiu do bloco do veredito para não poluir o semáforo, mas
            segue reversível e visível. Só aparece quando há dispensados. */}
        {dispensados.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 border-t border-[var(--borda)] pt-3 text-[11px] text-[var(--tinta-3)]">
            <span>Itens comuns marcados como “já incluso” (fora do aviso do topo):</span>
            {dispensados.map((nome) => (
              <span key={nome} className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="line-through">{nome}</span>
                <button
                  type="button"
                  onClick={() => desfazerDispensa(nome)}
                  title={`Desfazer — “${nome}” volta a aparecer no aviso de itens comuns não cadastrados`}
                  className="cursor-pointer rounded px-1 font-medium text-[var(--tinta-2)] underline decoration-dotted underline-offset-2 hover:text-[var(--tinta)]"
                >
                  desfazer
                </button>
              </span>
            ))}
          </div>
        )}
        {evento.categorias.every((cat) => (cat.itens || []).length === 0) && (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--borda-2)] bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
            Nenhum custo lançado ainda. Crie o primeiro custo nas categorias abaixo — os chips
            sugerem os itens comuns (ECAD, Seguro, Gerador…) e as referências mostram o que cada
            festa passada gastou. Ou traga os custos realizados do Financeiro pelo botão
            “Buscar dados do Financeiro”, no topo.
          </p>
        )}
      </Card>

      {evento.categorias.map((cat) => (
        <Categoria
          key={cat.id}
          cat={cat}
          evento={evento}
          update={update}
          bms={bms}
          onUsarBenchmark={(bm, catId) => setCarregar({ bm, soCategoria: catId })}
        />
      ))}

      <Btn onClick={addCategoria}>+ Nova categoria</Btn>

      {carregar && (
        <CarregarBenchmarkModal
          evento={evento}
          update={update}
          store={store}
          bm={carregar.bm}
          soCategoria={carregar.soCategoria}
          onClose={() => setCarregar(null)}
        />
      )}
    </div>
  )
}
