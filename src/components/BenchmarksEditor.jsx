// Editor dos eventos antigos (benchmarks): permite corrigir/reagrupar valores
// por categoria, público, receita e lucro.
//
// Gestão pelo Marco (Sessão de Gestão de Benchmarks, 19/07/2026 — princípio 3
// do CLAUDE.md ampliado, aval explícito e datado do Marco): o dono pode EDITAR,
// APAGAR e SALVAR-COMO-PADRÃO qualquer benchmark, embutido ou importado. Toda
// ação que mexe na base tem a rede do princípio 7 — aviso, snapshot de
// segurança ANTES e desfazer visível — e a FÁBRICA (FIXED_BENCHMARKS, no
// código) fica sempre recuperável em "Restaurar valores de fábrica". O que
// segue imutável é a mudança automática/silenciosa: nenhuma sessão de IA,
// refactor ou migração toca nesses números sozinha.

import { useState } from 'react'
import { Btn, Modal, Card, Field, TextInput, NumInput, MoneyInput, Badge, EtiquetaSemReserva } from './ui.jsx'
import { AppIcon, Eye, RefreshCw, X, Trash2, CircleCheck } from './AppIcon.jsx'
import {
  lucroNaoFecha,
  FIXED_BENCHMARKS,
  CAT_KEYS,
  CAT_LABELS,
  benchmarksDisponiveis,
  benchmarksOcultosIds,
  benchmarksApagadosLista,
  benchmarkTemPadraoSalvo,
  ocultarBenchmark,
  mostrarBenchmark,
  excluirBenchmarkCustom,
  apagarBenchmarkEmbutido,
  restaurarBenchmarkApagado,
  salvarBenchmarkComoPadrao,
  restaurarBenchmarkPadrao,
  restaurarBenchmarkFabrica,
  somaCustos,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import {
  etiquetaRegua,
  explicacaoRegua,
  reguasMisturadas,
  AVISO_REGUAS_MISTURADAS,
} from '../lib/reguaTicket.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { publicoIlegivel, textoPublicoGuardado } from '../lib/dadoQuebrado.js'

// O que o campo Público recebe (S1, 07/10/2026). Válido, zero e ausente: o
// valor, como sempre. Ilegível PRIMITIVO (texto, número): o próprio valor, e o
// texto cru quando `formatarParaEdicao` o escreveria errado ("0" para
// "ilegível" e NaN; centenas de dígitos para 1e308). Ilegível que não é
// primitivo (objeto, array, booleano): campo vazio — o original vai no aviso.
const TEXTO_GRANDE_DEMAIS = 1e15
function campoPublico(bm) {
  const v = bm.publico
  if (!publicoIlegivel(bm)) return { value: v ?? '', texto: undefined }
  if (typeof v === 'string') return { value: v, texto: v }
  if (typeof v === 'number')
    return { value: v, texto: Number.isFinite(v) && Math.abs(v) < TEXTO_GRANDE_DEMAIS ? undefined : String(v) }
  return { value: '', texto: undefined }
}
import { showToast } from '../lib/toast.js'
import { fmtBRL, fmtBRL2 } from '../lib/format.js'
import { uid, agora, clone } from '../lib/util.js'

const vazioOuNum = (v) => (v === '' || v == null ? null : v)

export default function BenchmarksEditor({ store, setStore, onClose }) {
  const todos = benchmarksDisponiveis(store)
  const apagados = benchmarksApagadosLista(store)
  const fixoIds = new Set(FIXED_BENCHMARKS.map((b) => b.id))
  const [erro, setErro] = useState('')
  // Ocultar das comparações (sugestão 25): reversível — só a lista de IDs
  // muda; números nunca são alterados nem apagados.
  const ocultos = new Set(benchmarksOcultosIds(store))
  const ocultar = (id) =>
    setStore((s) => ocultarBenchmark(s, id), 'ocultar um benchmark das comparações')
  const mostrar = (id) =>
    setStore((s) => mostrarBenchmark(s, id), 'mostrar um benchmark nas comparações')

  const patchFixo = (id, patch, patchCustos) =>
    setStore((s) => {
      const atual = s.benchmarkOverrides?.[id] || {}
      const novo = { ...atual, ...patch }
      if (patchCustos) novo.custos = { ...(atual.custos || {}), ...patchCustos }
      return { ...s, benchmarkOverrides: { ...s.benchmarkOverrides, [id]: novo } }
    })

  const patchCustom = (id, patch, patchCustos) =>
    setStore((s) => ({
      ...s,
      benchmarksCustom: s.benchmarksCustom.map((b) => {
        if (b.id !== id) return b
        const custos = patchCustos ? { ...b.custos, ...patchCustos } : b.custos
        return { ...b, ...patch, custos, custoTotal: somaCustos(custos) }
      }),
    }))

  const patch = (bm, p, pc) => (fixoIds.has(bm.id) ? patchFixo(bm.id, p, pc) : patchCustom(bm.id, p, pc))

  // Rede do princípio 7 para as ações que mudam a BASE: snapshot de segurança
  // ANTES (sem ele, nada acontece — não pode haver mudança sem caminho de
  // volta) e toast com Desfazer. `mutar`/`desmutar` são funções store→store.
  const comProtecao = (rotuloSnap, mutar, desmutar, msgToast) => {
    const seg = snapshotSeguranca(store, agora(), rotuloSnap)
    if (!seg.ok) {
      setErro(
        'Não deu para guardar a cópia de segurança antes desta ação (armazenamento do navegador cheio) — NADA foi alterado. Exporte um backup JSON ou libere espaço em “Proteção de dados” e tente de novo.'
      )
      return
    }
    setErro('')
    setStore(mutar, rotuloSnap)
    showToast(msgToast, {
      acaoLabel: 'Desfazer',
      onAcao: () => setStore(desmutar, `desfazer ${rotuloSnap}`),
    })
  }

  // Desfazer de salvar-como-padrão / restaurar-de-fábrica: devolve exatamente o
  // override e o padrão que existiam antes (cada um pode ter sido ausente).
  const desmutarPadraoOverride = (id, overrideAntes, padraoAntes) => (s) => {
    const overrides = { ...(s.benchmarkOverrides || {}) }
    if (overrideAntes === undefined) delete overrides[id]
    else overrides[id] = overrideAntes
    const padroes = { ...(s.benchmarksPadrao || {}) }
    if (padraoAntes === undefined) delete padroes[id]
    else padroes[id] = padraoAntes
    return { ...s, benchmarkOverrides: overrides, benchmarksPadrao: padroes }
  }

  // Restaurar PADRÃO: limpa só o override (volta à base — padrão salvo ou
  // fábrica). Reversível: o Desfazer devolve o override que havia.
  const restaurar = (bm) => {
    const overrideAntes = store.benchmarkOverrides?.[bm.id]
    comProtecao(
      `antes de restaurar padrão de ${bm.nome}`,
      (s) => restaurarBenchmarkPadrao(s, bm.id),
      (s) => ({
        ...s,
        benchmarkOverrides:
          overrideAntes === undefined
            ? s.benchmarkOverrides
            : { ...(s.benchmarkOverrides || {}), [bm.id]: overrideAntes },
      }),
      `“${bm.nome}” voltou ao padrão`
    )
  }

  // Salvar COMO PADRÃO: adota os valores atuais como a nova base (o "editado"
  // some com verdade); a fábrica continua recuperável.
  const salvarPadrao = (bm) => {
    if (
      !window.confirm(
        `Salvar os valores atuais de “${bm.nome}” como o novo padrão?\n\nA etiqueta “editado” some (esta passa a ser a base) e “Restaurar padrão” passará a voltar para estes valores. Os valores originais de fábrica continuam recuperáveis em “Restaurar valores de fábrica”.`
      )
    )
      return
    const overrideAntes = store.benchmarkOverrides?.[bm.id]
    const padraoAntes = store.benchmarksPadrao?.[bm.id]
    comProtecao(
      `antes de salvar padrão de ${bm.nome}`,
      (s) => salvarBenchmarkComoPadrao(s, bm.id),
      desmutarPadraoOverride(bm.id, overrideAntes, padraoAntes),
      `“${bm.nome}” salvo como padrão`
    )
  }

  // Restaurar VALORES DE FÁBRICA: descarta padrão salvo + edições e volta à
  // âncora histórica (FIXED_BENCHMARKS). Rede de segurança mais funda.
  const restaurarFabrica = (bm) => {
    if (
      !window.confirm(
        `Restaurar “${bm.nome}” aos valores de FÁBRICA (a tabela original do app)?\n\nIsso descarta o padrão salvo e as edições atuais deste benchmark. Dá para desfazer logo em seguida.`
      )
    )
      return
    const overrideAntes = store.benchmarkOverrides?.[bm.id]
    const padraoAntes = store.benchmarksPadrao?.[bm.id]
    comProtecao(
      `antes de restaurar de fábrica ${bm.nome}`,
      (s) => restaurarBenchmarkFabrica(s, bm.id),
      desmutarPadraoOverride(bm.id, overrideAntes, padraoAntes),
      `“${bm.nome}” restaurado aos valores de fábrica`
    )
  }

  // Apagar de TUDO (some da lista, mais forte que ocultar). Embutido vai para a
  // lista de apagados (fábrica intacta, restaurável); importado é removido de
  // verdade (só volta pelo Desfazer ou por backup). Snapshot antes nos dois.
  const apagar = (bm) => {
    const fixo = fixoIds.has(bm.id)
    const msg = fixo
      ? `Apagar “${bm.nome}”?\n\nEla some de todas as telas e da lista de benchmarks. Dá para desfazer agora, e restaurar depois em “Benchmarks apagados”, aqui embaixo. Os valores de fábrica nunca se perdem.`
      : `Apagar “${bm.nome}”?\n\nEla some de todas as telas. Dá para desfazer agora; depois disso, só volta por um backup JSON.`
    if (!window.confirm(msg)) return
    if (fixo) {
      comProtecao(
        `antes de apagar ${bm.nome}`,
        (s) => apagarBenchmarkEmbutido(s, bm.id),
        (s) => restaurarBenchmarkApagado(s, bm.id),
        `“${bm.nome}” apagado dos benchmarks`
      )
    } else {
      const copia = clone(bm)
      comProtecao(
        `antes de apagar ${bm.nome}`,
        (s) => excluirBenchmarkCustom(s, bm.id),
        (s) => ({ ...s, benchmarksCustom: [...(s.benchmarksCustom || []), copia] }),
        `“${bm.nome}” apagado dos benchmarks`
      )
    }
  }

  // Restaurar um embutido apagado (direção segura — nada se perde). Toast com
  // Desfazer (re-apagar) para simetria.
  const restaurarApagado = (bm) => {
    setStore((s) => restaurarBenchmarkApagado(s, bm.id), `restaurar o benchmark "${bm.nome}"`)
    showToast(`“${bm.nome}” restaurado aos benchmarks`, {
      acaoLabel: 'Desfazer',
      onAcao: () =>
        setStore((s) => apagarBenchmarkEmbutido(s, bm.id), `apagar o benchmark "${bm.nome}"`),
    })
  }

  const adicionar = () =>
    setStore((s) => ({
      ...s,
      benchmarksCustom: [
        ...s.benchmarksCustom,
        {
          id: uid(),
          nome: 'Novo evento antigo',
          custom: true,
          publico: null,
          custos: {},
          custoTotal: 0,
          receita: null,
          ticketMedio: null,
          lucro: null,
        },
      ],
    }), 'adicionar um evento antigo (benchmark)')

  return (
    <Modal title="Editar eventos antigos (benchmarks)" onClose={onClose} wide>
      <p className="mb-4 text-xs text-[var(--tinta-2)]">
        Corrija e reagrupe os valores como achar certo — tudo salva na hora e vale para as
        comparações e referências em todos os eventos. Campos em branco aparecem como “—”. O custo
        total é sempre a soma das categorias. “Ocultar das comparações” tira o benchmark das telas{' '}
        <strong>sem alterar nem apagar</strong> os números. “Salvar como padrão” adota suas edições
        como a nova base; “Apagar” tira o benchmark de tudo. As duas guardam uma cópia de segurança
        antes e podem ser desfeitas — e os <strong>valores de fábrica</strong> dos 4 embutidos ficam
        sempre recuperáveis.
      </p>

      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
      {erro && (
        <p className="mb-3 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-sm text-[var(--vermelho-texto)]">{erro}</p>
      )}

      {/* RÉGUA DO TICKET (decisão 6 do Marco, 25/07/2026). Esta lista põe
          festas medidas em épocas diferentes uma debaixo da outra, e o
          `ticketMedio` já foi calculado de pelo menos três maneiras na
          história do app. Sem este aviso, "a festa B tem ticket menor" é uma
          conclusão que a tela induz e os números não sustentam. */}
      {reguasMisturadas(todos) && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          {AVISO_REGUAS_MISTURADAS}
        </p>
      )}

      <div className="space-y-4">
        {todos.map((bm) => {
          const fixo = fixoIds.has(bm.id)
          const temPadrao = fixo && benchmarkTemPadraoSalvo(store, bm.id)
          return (
            <Card key={bm.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  value={bm.nome}
                  onChange={(e) => patch(bm, { nome: e.target.value })}
                  className="max-w-56 font-semibold"
                  aria-label="Nome do evento antigo"
                />
                {fixo ? (
                  <Badge className="bg-[var(--papel-2)] text-[var(--tinta-2)]">embutido</Badge>
                ) : (
                  <Badge className="bg-[var(--azul-tinta)] text-[var(--azul-texto)]">importado</Badge>
                )}
                {bm.editado && (
                  <Badge className="bg-[rgba(254,205,7,0.22)] text-[var(--ambar-texto)]">editado</Badge>
                )}
                {/* "sem reserva" (decisão 3 do Marco, 20/07/2026): esta lista
                    põe promovidos e embutidos um debaixo do outro, com os
                    custos abertos — é onde a diferença de régua mais engana. */}
                {temSemReserva(bm) && (
                  <EtiquetaSemReserva
                    texto={ETIQUETA_SEM_RESERVA}
                    explicacao={EXPLICACAO_SEM_RESERVA}
                  />
                )}
                {/* A RÉGUA do ticket desta festa, ao lado do nome — a conta
                    escrita por extenso, não um rótulo. Benchmark sem ticket
                    não ganha etiqueta: não há régua a nomear. */}
                {etiquetaRegua(bm) && (
                  <EtiquetaSemReserva
                    texto={etiquetaRegua(bm)}
                    explicacao={explicacaoRegua(bm)}
                  />
                )}
                {temPadrao && !bm.editado && (
                  <Badge
                    className="bg-[var(--papel-2)] text-[var(--tinta-2)]"
                    title="A base deste benchmark foi salva como padrão pelo Marco — os valores de fábrica seguem recuperáveis"
                  >
                    padrão salvo
                  </Badge>
                )}
                {ocultos.has(bm.id) && (
                  <Badge className="bg-[var(--papel-2)] text-[var(--tinta-2)]">oculto das comparações</Badge>
                )}
                <span className="ml-auto text-xs text-[var(--tinta-2)]">
                  Custo total{' '}
                  <span className="tnum font-semibold text-[var(--tinta)]">{fmtBRL(bm.custoTotal)}</span>
                </span>
                {ocultos.has(bm.id) ? (
                  <Btn variant="ghost" onClick={() => mostrar(bm.id)} title="Volta a aparecer em todas as comparações e referências — nada foi alterado enquanto esteve oculto">
                    <AppIcon icon={Eye} /> Mostrar de novo
                  </Btn>
                ) : (
                  <Btn
                    variant="ghost"
                    onClick={() => ocultar(bm.id)}
                    title="Some das comparações e referências de todos os eventos. Reversível: os números não mudam, e dá para mostrar de novo aqui ou em Ajustes › Benchmarks"
                  >
                    Ocultar das comparações
                  </Btn>
                )}
                {fixo && bm.editado && (
                  <>
                    <Btn
                      variant="ghost"
                      onClick={() => salvarPadrao(bm)}
                      title="Adota os valores atuais como a nova base deste benchmark. A etiqueta “editado” some e “Restaurar padrão” passa a voltar para estes valores. Guarda cópia de segurança antes e dá para desfazer."
                    >
                      <AppIcon icon={CircleCheck} /> Salvar como padrão
                    </Btn>
                    <Btn variant="ghost" onClick={() => restaurar(bm)} title="Descarta as edições e volta à base (padrão salvo ou fábrica). Dá para desfazer.">
                      <AppIcon icon={RefreshCw} /> Restaurar padrão
                    </Btn>
                  </>
                )}
                {fixo && (bm.editado || temPadrao) && (
                  <Btn
                    variant="ghost"
                    onClick={() => restaurarFabrica(bm)}
                    title="Volta aos valores ORIGINAIS de fábrica (a tabela original do app), descartando padrão salvo e edições. Guarda cópia de segurança antes e dá para desfazer."
                  >
                    <AppIcon icon={RefreshCw} /> Restaurar valores de fábrica
                  </Btn>
                )}
                <button
                  type="button"
                  onClick={() => apagar(bm)}
                  className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--vermelho-texto)]"
                  title={`Apagar “${bm.nome}” de tudo (reversível — desfazer na hora${fixo ? ' e restaurar depois' : ''})`}
                  aria-label={`Apagar benchmark ${bm.nome}`}
                >
                  <AppIcon icon={Trash2} size={15} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {CAT_KEYS.map((k) => (
                  <Field key={k} label={CAT_LABELS[k]}>
                    <MoneyInput
                      value={bm.custos?.[k] ?? ''}
                      onChange={(v) => patch(bm, {}, { [k]: vazioOuNum(v) })}
                      placeholder="—"
                    />
                  </Field>
                ))}
                <Field label="Público">
                  {/* Público ilegível (S1, 07/10/2026): o campo mostrava "0"
                      e o original sumia da vista. Agora o campo mostra o
                      valor guardado CRU (texto ou número) e o aviso embaixo
                      diz que ele não dá para calcular, no formato do
                      Fechamento; nada é gravado até o Marco digitar.
                      O campo recebe o valor guardado, e não '', de propósito
                      (revisão adversarial, 07/10/2026): com '' a regra do
                      rascunho largava "-5" assim que ele era gravado, e
                      digitar "-50" num público de 400 acabava gravando 0.
                      Objeto/array não tem texto cru: campo vazio. A porta
                      continua sem régua ("idem benchmark"). */}
                  <NumInput
                    value={campoPublico(bm).value}
                    textoGuardado={campoPublico(bm).texto}
                    onChange={(v) => patch(bm, { publico: vazioOuNum(v) })}
                    min="0"
                    step="1"
                    placeholder="—"
                    aria-describedby={publicoIlegivel(bm) ? `publico-invalido-${bm.id}` : undefined}
                  />
                  {publicoIlegivel(bm) && (
                    <span id={`publico-invalido-${bm.id}`} className="mt-1 block break-words text-xs text-[var(--tinta-2)]">
                      Valor guardado: {textoPublicoGuardado(bm.publico)}. Não dá para calcular; informe o número correto neste campo. O original fica guardado até você editar.
                    </span>
                  )}
                </Field>
                <Field label="Receita">
                  <MoneyInput
                    value={bm.receita ?? ''}
                    onChange={(v) => patch(bm, { receita: vazioOuNum(v) })}
                    placeholder="—"
                  />
                </Field>
                {/* Bilheteria BRUTA (decisão 6 do Marco, 25/07/2026): o que
                    entrou de ingresso antes da taxa. Campo opcional e aditivo
                    — em branco quer dizer "ninguém anotou", e é diferente de
                    zero. Preenchido, é ele que dá nome à régua do ticket: a
                    etiqueta ao lado do nome passa a dizer "ticket = bilheteria
                    ÷ público" assim que os dois números fecharem. */}
                <Field label="Bilheteria bruta">
                  <MoneyInput
                    value={bm.bilheteriaBruta ?? ''}
                    onChange={(v) => patch(bm, { bilheteriaBruta: vazioOuNum(v) })}
                    placeholder="—"
                  />
                </Field>
                <Field label="Ticket médio">
                  <MoneyInput
                    value={bm.ticketMedio ?? ''}
                    onChange={(v) => patch(bm, { ticketMedio: vazioOuNum(v) })}
                    placeholder="—"
                  />
                </Field>
                <Field label="Lucro (pode ser negativo)">
                  <MoneyInput
                    value={bm.lucro ?? ''}
                    onChange={(v) => patch(bm, { lucro: vazioOuNum(v) })}
                    min="-99999999"
                    placeholder="—"
                  />
                  {/* O lucro NÃO se recalcula sozinho (Marco, 27/07/2026, por
                      questionário): ele pode ser a verdade histórica da festa, com
                      dinheiro que não está nas sete categorias, e recalcular
                      reescreveria o resultado de um evento passado — o que o
                      princípio 3 proíbe. Mas o custo total SE recalcula ao editar
                      categoria, e aí os três números passavam a se contradizer em
                      silêncio: ele abriu esta tela e disse "os valores não tão
                      somando direito". Agora ela diz. */}
                  {lucroNaoFecha(bm) && (
                    <p className="mt-1 text-[11px] text-[var(--ambar-texto,var(--tinta-2))]">
                      não fecha com receita − custo (que dá{' '}
                      {fmtBRL2(lucroNaoFecha(bm).esperado)}) — confira se é de propósito
                    </p>
                  )}
                </Field>
              </div>

              <Field label="Observações" className="mt-3">
                <TextInput
                  value={bm.obs || ''}
                  onChange={(e) => patch(bm, { obs: e.target.value })}
                  placeholder="ex.: A&B inclui CMV de consignados"
                />
              </Field>
            </Card>
          )
        })}
      </div>

      {apagados.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--tinta)]">
            <AppIcon icon={Trash2} size={14} /> Benchmarks apagados
          </h3>
          <p className="mb-2 text-xs text-[var(--tinta-3)]">
            Embutidos apagados das telas e da lista. O caminho de volta é permanente: “Restaurar”
            traz o benchmark de volta com os valores que ele tinha; os originais de fábrica nunca se
            perdem.
          </p>
          <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
            {apagados.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-[var(--tinta)]">{b.nome}</span>
                  <span className="ml-2 text-xs text-[var(--tinta-3)]">custo {fmtBRL(b.custoTotal)}</span>
                  <Badge className="ml-2 bg-[var(--papel-2)] text-[var(--tinta-2)]">embutido</Badge>
                </div>
                <Btn onClick={() => restaurarApagado(b)} title="Traz este benchmark de volta a todas as telas e à lista">
                  <AppIcon icon={RefreshCw} /> Restaurar
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <Btn onClick={adicionar}>+ Adicionar evento antigo</Btn>
        <Btn variant="primary" onClick={onClose}>
          Concluir
        </Btn>
      </div>
    </Modal>
  )
}
