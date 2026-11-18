// Curva de vendas — 3 linhas (Sessão F2-B — sugestão 14 do MELHORIAS.md,
// formato decidido pelo Marco em 18/07/2026): vendas reais (via Financeiro) ×
// média histórica × plano dos lotes, em dias até a festa.
//
// Os dados vindos do Financeiro aqui são LEITURA PARA EXIBIÇÃO — nada é
// aplicado a campo nenhum do evento (por isso não há tela de revisão; ver
// nota no topo de src/lib/curvaVendas.js). Aplicar dados de verdade continua
// sendo papel da ponte "⇄ Buscar dados do Financeiro" (Sessão H).
//
// O PLANO tem DOIS modos com seletor (decisão do Marco, 19/07/2026):
// "Pela forma histórica" (padrão, zero digitação) e "Pelas datas dos lotes"
// (campo opcional "virada prevista" por lote). A escolha é lembrada POR
// EVENTO (campo curvaModo); nenhum número difere entre os modos no total —
// mesmo plano, duas distribuições (prova em curvaVendas.test.js).

import { useState } from 'react'
import { Btn, Card, Modal, Segmented, Select, Bola, CampoData } from './ui.jsx'
import { AppIcon, RefreshCw, Pencil, TriangleAlert } from './AppIcon.jsx'
import { LinhasCurva, VIZ } from './Charts.jsx'
import {
  buscarCurvaFinanceiro,
  loadCurvaCache,
  saveCurvaCache,
  eventoCurvaVinculado,
  acumularDias,
  acumuladoAteODia,
  diaRelativoHoje,
  mediaHistorica,
  mensagensAjustesCurva,
  mediaHistoricaNormalizada,
  fracaoNormalizada,
  inicioVendasEfetivo,
  inicioVendasParaRitmo,
  curvaPlanoJanela,
  avisoJanelaCurta,
  referenciaCurva,
  refIdsDaCurva,
  festasPassadasDisponiveis,
  rotuloReferencia,
  janelaHistoricaDias,
  totalPlanoLotes,
  lotesDoPlano,
  curvaPlanoForma,
  curvaPlanoDatas,
  modoCurva,
} from '../lib/curvaVendas.js'
import { fmtDataHora } from '../lib/financeiro.js'
import { fmtCompact, fmtData, fmtInt } from '../lib/format.js'
import { hojeISO } from './RitmoVendas.jsx'
import { ritmoVendas } from '../lib/calc.js'
import { avisoRitmoQuantidadeTravada, fraseRitmoNaoFecha, MARCACAO_REALIZADA, ritmoPorDia } from '../lib/resumo.js'
import { agora } from '../lib/util.js'
import { origemNaNuvem, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import { fmtOuIlegivel } from '../lib/dadoQuebrado.js'
import { NotaLoteSemPreco } from './AvisoLoteSemPreco.jsx'

// Identidade das 3 linhas (fora da língua do semáforo): real no azul de
// receita da casa · plano em tinta tracejada · média em cinza quente.
const COR_REAL = VIZ.light.receita
export const COR_PLANO = VIZ.light.ink
export const COR_MEDIA = VIZ.light.muted

const fmtPctInteiro = (v) => `${Math.round(v)}%`

// Modal do grupo de referência (Sessão F2-S — sugestão 30): checkbox por
// festa passada disponível na última busca; princípio 7 — o botão diz a ação
// e o efeito, cancelar = zero mudança.
function ModalGrupoReferencia({ disponiveis, iniciais, onAplicar, onClose }) {
  const [sel, setSel] = useState(() => new Set(iniciais))
  const alternar = (id) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return (
    <Modal title="Referência da curva — escolher festas" onClose={onClose}>
      <p className="mb-3 text-xs text-[var(--tinta-3)]">
        Festas passadas disponíveis na <strong>última busca</strong> no Financeiro. As marcadas
        viram a referência: alimentam a linha histórica E a forma do plano.
      </p>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {disponiveis.map((f) => (
          <label
            key={f.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--borda)] px-3 py-2 text-sm hover:border-[var(--acento)]"
          >
            <input
              type="checkbox"
              checked={sel.has(f.id)}
              onChange={() => alternar(f.id)}
              className="size-4 cursor-pointer accent-[var(--acento)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-[var(--tinta)]">{f.nome}</span>
              <span className="block text-[11px] text-[var(--tinta-3)]">
                {[f.empresa, f.data ? fmtData(f.data) : null,
                  janelaHistoricaDias(f) > 0 ? `janela de ${janelaHistoricaDias(f)} dias` : 'só vendeu no dia da festa']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Cancelar (nada muda)
        </Btn>
        <Btn
          variant="primary"
          disabled={sel.size === 0}
          onClick={() =>
            onAplicar(disponiveis.filter((f) => sel.has(f.id)).map((f) => ({ id: f.id, nome: f.nome })))
          }
        >
          Usar {sel.size} {sel.size === 1 ? 'festa' : 'festas'} como referência
        </Btn>
      </div>
    </Modal>
  )
}

export default function CurvaVendas({ evento, update, breakEvenRealista, breakEvenNaoFecha, cenarios = null }) {
  const [cache, setCache] = useState(loadCurvaCache)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState(null)
  const [avisoCache, setAvisoCache] = useState(null)
  const [unidade, setUnidade] = useState('pct') // '%' do plano × R$ — só exibição
  const [escolhendoGrupo, setEscolhendoGrupo] = useState(false)

  const buscar = async () => {
    setBuscando(true)
    setErro(null)
    setAvisoCache(null)
    try {
      const curva = await buscarCurvaFinanceiro()
      const em = agora()
      const r = saveCurvaCache(curva, em)
      if (!r.ok)
        setAvisoCache(
          `A curva foi buscada e está na tela, mas não deu para guardá-la para a próxima visita (${r.erro}). Nada foi perdido — busque de novo quando voltar.`
        )
      setCache({ em, curva })
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  const hoje = hojeISO()
  const diaHoje = diaRelativoHoje(evento.data, hoje)
  const evCurva = eventoCurvaVinculado(cache?.curva, evento)
  const realAcum = evCurva ? acumularDias(evCurva.dias) : []
  const realAteHoje =
    evCurva && diaHoje != null ? acumuladoAteODia(evCurva.dias, Math.min(diaHoje, 0)) : null

  // Média histórica (bloco 2): fração por dia das festas passadas do mesmo
  // tipo, posta na régua deste evento (× total do plano dos lotes).
  const totalPlano = totalPlanoLotes(evento)
  // Referência escolhível (bloco 3 da F2-S): média da festa (padrão) · grupo
  // por checkbox · uma festa específica — lembrada por evento (curvaRef) e
  // alimentando a linha histórica E a forma do plano (as três curvas contam
  // a mesma história).
  const ref = referenciaCurva(evento)
  const refIds = refIdsDaCurva(evento)
  const opcoesRef = {
    tipo: evento.tipo,
    empresaVinculo: evento.financeiro?.empresa,
    hoje,
    excluirEventoId: evento.financeiro?.eventoId,
    refIds,
  }
  const disponiveis = cache
    ? festasPassadasDisponiveis(cache.curva, { hoje, excluirEventoId: evento.financeiro?.eventoId })
    : []
  const setRef = (modo, itens) =>
    update(
      (e) => ({ ...e, curvaRef: { modo: modo === 'grupo' || modo === 'festa' ? modo : '', itens } }),
      'trocar a referência da curva de vendas'
    )
  const media = cache ? mediaHistorica(cache.curva, opcoesRef) : null
  const rotuloDe = (m) =>
    m
      ? m.base === 'ref'
        ? m.nEventos === 1
          ? `Referência — ${m.nomes[0]}`
          : `Referência — grupo de ${m.nEventos} festas`
        : m.base === 'tipo'
          ? `Média histórica — ${m.chave} (${m.nEventos} ${m.nEventos === 1 ? 'festa' : 'festas'})`
          : `Média histórica — geral (${m.nEventos} ${m.nEventos === 1 ? 'festa' : 'festas'})`
      : null
  const rotuloMedia = rotuloDe(media)

  // Início de vendas (Sessão F2-S — sugestão 30): com ele, a média e o plano
  // passam à régua do TEMPO NORMALIZADO da janela deste evento; sem ele,
  // tudo abaixo é EXATAMENTE o comportamento de sempre (fallback da spec).
  const ini = inicioVendasEfetivo(evento)
  const iniValido = ini && !ini.depoisDaFesta && ini.dia != null && ini.dia <= 0 ? ini : null
  const mediaNorm = cache && iniValido ? mediaHistoricaNormalizada(cache.curva, opcoesRef) : null
  const janelaEvento = iniValido ? -iniValido.dia : null
  const avisoJanela =
    iniValido && mediaNorm ? avisoJanelaCurta(janelaEvento, mediaNorm.janelaMediaDias) : null

  // Plano (bloco 3): dois modos, escolha lembrada por evento. Com início de
  // vendas, o modo forma usa a janela normalizada e o modo datas respeita o
  // início como piso (curvaVendas.js).
  const modo = modoCurva(evento)
  const setModo = (m) => update((e) => ({ ...e, curvaModo: m === 'datas' ? 'datas' : 'forma' }))
  const plano =
    totalPlano > 0
      ? modo === 'datas'
        ? curvaPlanoDatas(evento, { inicioDia: iniValido ? iniValido.dia : null })
        : iniValido
          ? curvaPlanoJanela(evento, mediaNorm, iniValido.dia)
          : curvaPlanoForma(evento, media)
      : null
  const planoOk = plano && !plano.erro && Array.isArray(plano.pontos)
  const lotesPlano = lotesDoPlano(evento)
  const setVirada = (loteId, v) =>
    update((e) => ({
      ...e,
      lotes: e.lotes.map((l) => (l.id === loteId ? { ...l, viradaPrevista: v } : l)),
    }))

  // Unidade do eixo Y: % do plano (padrão, compara as três réguas) ou R$.
  const emPct = unidade === 'pct' && totalPlano > 0
  const escala = (v) => (emPct ? (v / totalPlano) * 100 : v)

  const series = []
  if (realAcum.length > 0)
    series.push({
      label: `Vendas reais — ${evCurva.nome} (via Financeiro)`,
      color: COR_REAL,
      width: 2.5,
      pontos: realAcum.map((d) => ({ x: d.dia, y: escala(d.valorAcum) })),
    })
  if (iniValido && mediaNorm && totalPlano > 0) {
    // A linha histórica na régua da janela DESTE evento (sugestão 30): a
    // forma normalizada mapeada de volta em dias, do início à festa — as
    // três linhas contam a mesma história.
    const pontosNorm = []
    for (let dia = iniValido.dia; dia <= 0; dia++) {
      const u = janelaEvento === 0 ? 1 : (dia - iniValido.dia) / janelaEvento
      pontosNorm.push({ x: dia, y: escala(fracaoNormalizada(mediaNorm.festas, u) * totalPlano) })
    }
    series.push({
      label: `${rotuloDe(mediaNorm)} · janela normalizada`,
      color: COR_MEDIA,
      width: 1.8,
      pontos: pontosNorm,
    })
  } else if (media && totalPlano > 0)
    series.push({
      label: rotuloMedia,
      color: COR_MEDIA,
      width: 1.8,
      pontos: media.pontos.map((p) => ({ x: p.dia, y: escala(p.fracao * totalPlano) })),
    })
  if (planoOk)
    series.push({
      label: modo === 'datas' ? 'Plano — pelas datas dos lotes' : 'Plano — pela forma histórica',
      color: COR_PLANO,
      width: 1.8,
      dash: '6 4',
      pontos: plano.pontos.map((p) => ({ x: p.dia, y: escala(p.valor) })),
      marcadores: plano.viradas.map((v) => ({
        x: v.dia,
        y: escala(v.acumulada),
        titulo: `${v.nome} esgota ${v.dia === 0 ? 'no dia da festa' : `~D${v.dia}`} (${fmtCompact(v.acumulada)} acumulados)${modo === 'forma' ? ' — pelo ritmo histórico' : ''}`,
      })),
    })

  const temVinculo = evento.financeiro?.eventoId != null

  return (
    <Card className="p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          Curva de vendas
          {/* contexto no card: um print recortado se explica sozinho */}
          <span className="text-[10px] font-normal text-[var(--tinta-3)]">
            {[evento.nome, evento.data ? fmtData(evento.data) : null].filter(Boolean).join(' · ')}
          </span>
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {cache && (
            <span className="text-[10px] text-[var(--azul-texto)]">
              via Financeiro em {fmtDataHora(cache.em)}
            </span>
          )}
          <Btn
            onClick={buscar}
            // Na cópia da nuvem (05/10/2026) a ponte não existe: desligado, e
            // o title diz por quê — como os outros botões da ponte.
            disabled={buscando || origemNaNuvem()}
            title={
              origemNaNuvem()
                ? TITULO_PONTE_NA_NUVEM
                : 'Consulta somente-leitura ao Financeiro local: atualiza este gráfico e nada mais — nenhum dado do evento muda.'
            }
          >
            {buscando ? 'Buscando…' : <><AppIcon icon={RefreshCw} /> Buscar curva no Financeiro</>}
          </Btn>
        </div>
      </div>
      <p className="mb-3 text-xs text-[var(--tinta-3)]">
        Acumulado de vendas de ingressos por dia até a festa. A contagem vem dos{' '}
        <strong>pagamentos aprovados</strong> na Tiqueteira — pagamentos, não pessoas (um pagamento
        pode cobrir mais de um ingresso).
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          value={modo}
          onChange={setModo}
          options={[
            ['forma', 'Plano pela forma histórica'],
            ['datas', 'Plano pelas datas dos lotes'],
          ]}
        />
        {totalPlano > 0 && (
          <Segmented
            value={unidade}
            onChange={setUnidade}
            options={[
              ['pct', '% do plano'],
              ['brl', 'R$'],
            ]}
          />
        )}
        <span className="text-[11px] text-[var(--tinta-3)]">
          escolha lembrada neste evento · total do plano: <span className="tnum">{fmtOuIlegivel(totalPlano, fmtCompact)}</span>
        </span>
      </div>

      {/* — referência escolhível (bloco 3 da F2-S — sugestão 30) — */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          value={ref.modo === '' ? 'media' : ref.modo}
          onChange={(m) => {
            // voltar à média NÃO apaga as festas marcadas (reescolher o modo
            // restaura a escolha — nada se perde num clique)
            if (m === 'media') setRef('', ref.itens)
            else if (m === 'grupo') setEscolhendoGrupo(true)
            else setRef('festa', ref.itens.slice(0, 1))
          }}
          options={[
            ['media', 'Média da festa'],
            ['grupo', 'Grupo de festas'],
            ['festa', 'Uma festa'],
          ]}
        />
        {ref.modo === 'grupo' && (
          <Btn onClick={() => setEscolhendoGrupo(true)} disabled={disponiveis.length === 0}
            title="Abre a lista das festas passadas da última busca para marcar as que entram na referência.">
            <AppIcon icon={Pencil} /> Escolher festas… ({ref.itens.length})
          </Btn>
        )}
        {ref.modo === 'festa' && (
          <Select
            value={ref.itens[0]?.id ?? ''}
            onChange={(e) => {
              const f = disponiveis.find((x) => String(x.id) === e.target.value)
              if (f) setRef('festa', [{ id: f.id, nome: f.nome }])
            }}
            options={[
              ...(ref.itens[0] && !disponiveis.some((x) => x.id === ref.itens[0].id)
                ? [{ value: ref.itens[0].id, label: `${ref.itens[0].nome || 'festa escolhida'} (fora da última busca)` }]
                : []),
              ...(ref.itens.length === 0 ? [{ value: '', label: 'escolha a festa…' }] : []),
              ...disponiveis.map((f) => ({ value: f.id, label: f.nome })),
            ]}
            className="w-56"
          />
        )}
        <span className="text-[11px] font-medium text-[var(--tinta-2)]">
          {rotuloReferencia(evento, (iniValido && mediaNorm) || media ? (iniValido && mediaNorm ? mediaNorm : media) : null)}
          {iniValido && mediaNorm ? ' · janela normalizada' : ''}
        </span>
      </div>

      {escolhendoGrupo && (
        <ModalGrupoReferencia
          disponiveis={disponiveis}
          iniciais={ref.itens.map((x) => x.id)}
          onAplicar={(itens) => {
            setRef('grupo', itens)
            setEscolhendoGrupo(false)
          }}
          // cancelar = zero mudança (princípio 7): o modo só vira 'grupo' no aplicar
          onClose={() => setEscolhendoGrupo(false)}
        />
      )}
      {ref.modo === 'grupo' && ref.itens.length === 0 && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Nenhuma festa escolhida para o grupo ainda — a curva segue na média da festa até você
          escolher (botão “Escolher festas…”).
        </p>
      )}
      {ref.modo === 'festa' && ref.itens.length === 0 && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Nenhuma festa escolhida ainda — a curva segue na média da festa até você escolher no
          seletor acima{disponiveis.length === 0 ? ' (busque a curva no Financeiro primeiro)' : ''}.
        </p>
      )}
      {(() => {
        const m = iniValido && mediaNorm ? mediaNorm : media
        if (!m || !Array.isArray(m.refAusentes) || m.refAusentes.length === 0) return null
        const nomes = m.refAusentes.map(
          (id) => ref.itens.find((x) => x.id === id)?.nome || `id ${id}`
        )
        return (
          <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            Da referência escolhida, {nomes.length === 1 ? 'não veio na última busca' : 'não vieram na última busca'}:{' '}
            <strong>{nomes.join(', ')}</strong> —{' '}
            {m.base === 'ref'
              ? 'a referência está usando só as encontradas.'
              : 'nenhuma veio; a curva caiu na média da festa.'}{' '}
            Busque a curva de novo (ou reescolha a referência).
          </p>
        )
      })()}

      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
      {erro && (
        <p className="mb-3 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
          {erro}
        </p>
      )}
      {avisoCache && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          {avisoCache}
        </p>
      )}

      {!cache && !erro && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          Clique em <strong>Buscar curva no Financeiro</strong> (com o Financeiro aberto) para
          trazer as vendas por dia — deste evento e das festas passadas que servem de referência.
        </p>
      )}

      {cache && !temVinculo && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Este evento ainda não está vinculado a um evento do Financeiro — a linha de vendas
          reais fica de fora. Vincule pela ponte “Buscar dados do Financeiro” (no topo da
          tela) e busque a curva de novo.
        </p>
      )}
      {cache && temVinculo && !evCurva && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          O evento vinculado ({evento.financeiro?.eventoNome || 'sem nome'}) não veio na curva do
          Financeiro — provavelmente está <strong>sem data</strong> lá (sem data não há “dias até
          a festa”). Preencha a data do evento no Financeiro e busque de novo.
        </p>
      )}
      {cache && evCurva && realAcum.length === 0 && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          O Financeiro ainda não tem venda de ingresso registrada para {evCurva.nome}. Se a festa
          já vendeu, rode a sincronização Tiqueteira no Financeiro e busque a curva de novo.
        </p>
      )}

      {/* — avisos da média histórica (bloco 2): nada some em silêncio — */}
      {mensagensAjustesCurva(iniValido && mediaNorm ? mediaNorm : media).map((mensagem) => (
        <p
          key={mensagem}
          className="mb-3 flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]"
        >
          <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
          <span>{mensagem}</span>
        </p>
      ))}
      {cache && !media && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          Sem festa passada com vendas no Financeiro — a linha da média histórica fica de fora
          até existir histórico.
        </p>
      )}
      {(() => {
        // com início de vendas, quem manda é a média NORMALIZADA — os avisos
        // contam a história da média em uso, nunca de outra.
        const m = iniValido && mediaNorm ? mediaNorm : media
        if (!m) return null
        return (
          <>
            {m.base === 'geral' && (evento.tipo || '').trim() && (
              <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
                Sem festas <strong>{evento.tipo.trim()}</strong> passadas no Financeiro — a média
                histórica mostrada é a <strong>geral</strong>, de todas as festas ({m.nEventos}).
              </p>
            )}
            {m.nEventos < 2 && (
              <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
                A média histórica tem <strong>só 1 festa</strong> ({m.nomes[0]}) — leia como
                indício, não como padrão.
              </p>
            )}
          </>
        )
      })()}

      {/* — início de vendas (Sessão F2-S — sugestão 30) — */}
      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
      {ini?.depoisDaFesta && (
        <p className="mb-3 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
          O início de vendas ({fmtData(ini.data)}) está DEPOIS da festa — a curva está
          ignorando a data até ela fazer sentido. Confira na aba Receita.
        </p>
      )}
      {avisoJanela && (
        <p className="mb-3 flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs font-medium text-[var(--ambar-texto)]">
          <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>Início de vendas em {fmtData(iniValido.data)}: {avisoJanela.texto}.</span>
        </p>
      )}
      {iniValido && mediaNorm && mediaNorm.semJanela.length > 0 && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          Fora da forma normalizada por só ter venda registrada no dia da festa (ou depois):{' '}
          {mediaNorm.semJanela.join(', ')} — sem janela, não há forma para tirar.
        </p>
      )}
      {iniValido && cache && !mediaNorm && media && modo !== 'datas' && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Nenhuma festa passada tem venda ANTES do dia da festa — não há forma normalizada para
          o plano com início de vendas. Use o modo <strong>pelas datas dos lotes</strong> (que
          respeita o início como piso).
        </p>
      )}
      {totalPlano <= 0 && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Preencha os lotes (preço e quantidade) na aba Receita para desenhar o plano — e para
          pôr a média histórica na régua deste evento.
        </p>
      )}

      {/* — avisos do plano (bloco 3) — */}
      {totalPlano > 0 && modo === 'forma' && !planoOk && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          O plano “pela forma histórica” precisa da média histórica (busque a curva no
          Financeiro). Sem histórico, use o modo <strong>pelas datas dos lotes</strong>.
        </p>
      )}
      {totalPlano > 0 && modo === 'datas' && plano?.erro === 'sem-data-evento' && (
        <p className="mb-3 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          Defina a <strong>data do evento</strong> (no topo da tela) para desenhar o plano pelas
          datas — sem ela não existe “dias até a festa”.
        </p>
      )}
      {totalPlano > 0 && modo === 'datas' && plano?.erro === 'sem-nenhuma-virada' && (
        <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
          Nenhum lote tem virada prevista ainda — preencha as datas abaixo (ou use o modo
          “pela forma histórica”, que não precisa de datas).
        </p>
      )}
      {modo === 'datas' &&
        planoOk &&
        (plano?.avisos || []).map((a) => (
          <p
            key={a}
            className="mb-2 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]"
          >
            {a}
          </p>
        ))}

      {series.length > 0 && (
        <>
          <LinhasCurva
            series={series}
            hojeX={diaHoje != null && diaHoje < 0 ? diaHoje : null}
            marcosX={iniValido ? [{ x: iniValido.dia, rotulo: 'início de vendas' }] : []}
            yFmt={emPct ? fmtPctInteiro : fmtCompact}
          />
          {realAteHoje && diaHoje != null && diaHoje < 0 && (
            <p className="mt-2 text-xs text-[var(--tinta-2)]">
              Até hoje (D{diaHoje}): <strong className="tnum">{fmtInt(realAteHoje.pagamentos)}</strong>{' '}
              pagamentos · <strong className="tnum">{fmtCompact(realAteHoje.valor)}</strong>{' '}
              vendidos
              {totalPlano > 0 && (
                <>
                  {' '}
                  (<span className="tnum">{fmtPctInteiro((realAteHoje.valor / totalPlano) * 100)}</span>{' '}
                  do plano)
                </>
              )}
              .
            </p>
          )}
          {/* Integração com o ritmo (bloco 4): o "faltam N → X/semana" também
              pelo REAL da curva — leitura derivada na hora (mesma
              ritmoVendas() do card acima), nenhum campo do evento muda. */}
          {(() => {
            if (!realAteHoje || diaHoje == null) return null
            const avisoTravado = avisoRitmoQuantidadeTravada(evento, hoje, cenarios)
            if (avisoTravado) {
              if (avisoTravado.tom === 'neutro')
                return <p className="mt-1 text-xs text-[var(--tinta-3)]">{avisoTravado.texto}</p>
              if (diaHoje >= 0) return null
              return (
                <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-[var(--tinta)]">
                  <Bola size={8} cor="var(--ambar-texto)" className="mt-1 shrink-0" />
                  <span>{avisoTravado.texto}</span>
                </p>
              )
            }
            // Sem break-even não há "faltam N". Mas há DOIS motivos para não
            // haver break-even, e eles pedem telas opostas (Marco,
            // 27/07/2026): "não sei calcular" (segue calado, como sempre) e
            // "não fecha nem vendendo tudo" — este último é a notícia mais
            // importante do painel, e era justamente ele que sumia. A frase é
            // a MESMA das outras três telas, e a ordem também: festa que já
            // aconteceu ganha a marcação de realizada (mesma linha do
            // `r.eventoPassado` abaixo), e no DIA da festa nada aparece.
            if (breakEvenRealista == null) {
              if (!breakEvenNaoFecha) return null
              const aviso = fraseRitmoNaoFecha(evento, hoje)
              if (aviso.tom === 'neutro')
                return <p className="mt-1 text-xs text-[var(--tinta-3)]">{aviso.texto}</p>
              if (diaHoje >= 0) return null
              return (
                <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-[var(--tinta)]">
                  {/* alerta na bola, texto neutro (Marco 24/07) */}
                  <Bola size={8} cor="var(--ambar-texto)" className="mt-1 shrink-0" />
                  <span>{aviso.texto}</span>
                </p>
              )
            }
            const r = ritmoVendas({
              vendidos: realAteHoje.pagamentos,
              dataEvento: evento.data,
              breakEven: breakEvenRealista,
              hoje,
              inicioVendas: inicioVendasParaRitmo(evento),
            })
            if (!r) return null
            // Festa já realizada: a curva continuava desenhada e NADA dizia
            // que a festa já foi — quem batesse o olho lia acompanhamento ao
            // vivo. A frase que o app já tinha ocupa o lugar da linha de
            // ritmo. Quem decide "já passou" é ritmoVendas (a MESMA régua das
            // outras superfícies), não o diaHoje: no DIA da festa nada disto
            // aparece, exatamente como antes.
            if (r.eventoPassado)
              return <p className="mt-1 text-xs text-[var(--tinta-3)]">{MARCACAO_REALIZADA}</p>
            if (diaHoje >= 0) return null
            // Ritmo em DIAS (Marco, 10/08/2026), da mesma fonte única das outras
            // superfícies — calculado uma vez, não a cada ramo do texto.
            const dRitmo = ritmoPorDia(r)
            return (
              <>
              <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-[var(--tinta)]">
                {/* saúde na bola, texto neutro (Marco 24/07) */}
                <Bola size={8} cor={r.cobriu ? 'var(--verde-texto)' : 'var(--ambar-texto)'} className="mt-1 shrink-0" />
                <span>
                {r.cobriu
                  ? `Pela curva, o break-even do realista já está coberto (${fmtInt(r.vendidos)} pagamentos ≥ ${fmtInt(r.breakEven)}).`
                  : dRitmo == null
                    ? // A semana final passou a ter ritmo (Marco, 10/08/2026), e o
                      // DIA da festa não chega aqui — o `diaHoje >= 0` acima já
                      // devolveu null. Sobra só a janela de venda zero (início das
                      // vendas na data da festa ou depois), e é ela que este texto
                      // descreve; por isso o "a festa é hoje" das outras telas não
                      // tem gêmeo nesta.
                      `Pela curva, faltam ${fmtInt(r.faltam)} para o break-even do realista — menos de um dia de venda.`
                    : `Pela curva, faltam ${fmtInt(r.faltam)} para o break-even do realista — ritmo necessário: ${fmtInt(dRitmo.porDia)}/dia.`}
                </span>
                <span className="ml-1 font-normal text-[var(--tinta-3)]">
                  (contagem de pagamentos via Financeiro; o campo “vendidos até hoje” do card
                  acima continua sendo a fonte oficial)
                </span>
              </p>
              {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): o
                  break-even desta linha já não conta o lote — a linha curta
                  diz por quê. */}
              <NotaLoteSemPreco evento={evento} className="mt-1" />
              </>
            )
          })()}
        </>
      )}

      {/* Viradas previstas por lote — só no modo 2, editando o MESMO campo
          opcional do lote (migração leve; backup antigo abre sem ele). */}
      {modo === 'datas' && lotesPlano.length > 0 && (
        <div className="mt-3 border-t border-[var(--borda)] pt-3">
          <h4 className="mb-1 text-xs font-semibold text-[var(--tinta-2)]">
            Virada prevista por lote
          </h4>
          <p className="mb-2 text-[11px] text-[var(--tinta-3)]">
            A data em que cada lote deve <strong>esgotar</strong>. Opcional — lote sem data entra
            na reta até a virada seguinte (ou até a festa). Só o desenho do plano usa estas
            datas; nenhum cálculo de cenário muda.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {lotesPlano.map((l) => (
              <label key={l.id} className="block">
                <span className="mb-0.5 block text-[11px] font-medium text-[var(--tinta-2)]">
                  {l.nome} <span className="tnum text-[var(--tinta-3)]">({fmtCompact(l.receita)})</span>
                </span>
                <CampoData
                  className="w-36"
                  value={l.viradaPrevista || ''}
                  onChange={(iso) => setVirada(l.id, iso)}
                  aria-label={`Virada prevista do ${l.nome}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 border-t border-[var(--borda)] pt-2 text-[11px] text-[var(--tinta-3)]">
        As três linhas na mesma régua: <strong>real</strong> = pagamentos da Tiqueteira (líquidos de
        cupom) · <strong>média histórica</strong> = % vendido por dia das festas passadas, escalado
        ao plano deste evento · <strong>plano</strong> = lotes esgotados (incluindo “só otimista”),
        com o desconto efetivo aplicado (cupom × fração de ingressos com desconto) — por isso
        real e plano fecham na mesma conta. Dados do
        Financeiro são só exibição: nada aqui altera campos do evento.
      </p>
    </Card>
  )
}
