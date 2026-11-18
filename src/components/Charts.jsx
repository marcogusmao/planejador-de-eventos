// Gráficos em SVG puro (sem libs). Paletas validadas com o validador de
// paletas (CVD + contraste + banda de luminosidade), Sessão K:
// - séries: azul = receita, custo em tinta neutra, verde = lucro (verde claro tem
//   WARN de contraste no claro — o alívio exigido existe: rótulo direto na
//   série de lucro, legenda e a tabela DRE logo abaixo).
// - cenários: pessimista âmbar · realista azul da marca · otimista rosa —
//   identidade própria que NÃO fala a língua do semáforo (verde/vermelho
//   ficam reservados para veredito e lucro/prejuízo, regra da direção).

import { fmtCompact, fmtBRL, formatadorCompacto } from '../lib/format.js'
import { linhasParaRotulosProximos } from '../lib/rotulosGrafico.js'
import { AppIcon, X } from './AppIcon.jsx'

export const VIZ = {
  light: {
    receita: '#0045dd',
    // custo em tinta NEUTRA (Sessão F2-P, tema C): o vermelho fica reservado a
    // PREJUÍZO e ao semáforo — custo não é alarme, é fato. O gráfico usa
    // `custoNeutro`; o antigo `custo` (vermelho) foi removido — nada o lia.
    custoNeutro: '#a79e90',
    lucro: '#1baf7a',
    prejuizo: '#d0362f',
    grid: '#ece7df',
    axis: '#cfc9be',
    paper: '#fbf9f7',
    ink: '#211f1c',
    ink2: '#6c675e',
    muted: '#9b958a',
    neutro: '#d9d3ca',
  },
  dark: {
    receita: '#4d7dff',
    custoNeutro: '#7c7568',
    lucro: '#199e70',
    prejuizo: '#e0655e',
    grid: '#2c2c2a',
    axis: '#383835',
    paper: '#211f1c',
    ink: '#ffffff',
    ink2: '#c3c2b7',
    muted: '#898781',
    neutro: '#52514e',
  },
}

// Identidade dos 3 cenários (dot + texto), clara e escura — validadas.
export const CENARIO_TONS = {
  light: {
    pessimista: { dot: '#8a6a00', texto: '#8a6a00' },
    realista: { dot: '#0045dd', texto: '#0045dd' },
    otimista: { dot: '#b8437d', texto: '#b8437d' },
  },
  dark: {
    pessimista: { dot: '#ab8a10', texto: '#ab8a10' },
    realista: { dot: '#4d7dff', texto: '#4d7dff' },
    otimista: { dot: '#dd5695', texto: '#dd5695' },
  },
}

function niceTicks(min, max, count = 5) {
  const span = max - min || 1
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const norm = step0 / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const ticks = []
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1e6; v += step) ticks.push(v)
  return ticks
}

// barra fina com ponta arredondada (4px) no lado do dado, reta na baseline
function barPath(x, yv, w, y0, r = 4) {
  if (yv <= y0) {
    const rr = Math.min(r, y0 - yv, w / 2)
    return `M${x},${y0} L${x},${yv + rr} Q${x},${yv} ${x + rr},${yv} L${x + w - rr},${yv} Q${x + w},${yv} ${x + w},${yv + rr} L${x + w},${y0} Z`
  }
  const rr = Math.min(r, yv - y0, w / 2)
  return `M${x},${y0} L${x + w},${y0} L${x + w},${yv - rr} Q${x + w},${yv} ${x + w - rr},${yv} L${x + rr},${yv} Q${x},${yv} ${x},${yv - rr} Z`
}

/**
 * Barras agrupadas.
 * groups: [{ label, values: [n, ...] }] — um grupo por cenário
 * series: [{ label, color }] — receita/custo/lucro
 * labelSeries: índice da série que recebe rótulo direto ('all' = todas)
 */
export function GroupedBars({
  groups,
  series,
  dark = false,
  height = 300,
  valueFmt = fmtCompact,
  labelSeries = null,
}) {
  const C = dark ? VIZ.dark : VIZ.light
  const W = 760
  const m = { top: 24, right: 8, bottom: 26, left: 64 }
  const all = groups.flatMap((g) => g.values).filter(Number.isFinite)
  // Rótulo que não engana (tema D, F2-P): quando o formato é o compacto padrão,
  // calibra a precisão ao CONJUNTO de barras — se as barras desempatam, os
  // rótulos desempatam. Em modo R$/pax (valueFmt próprio) respeita o de fora.
  const rotularBarra = valueFmt === fmtCompact ? formatadorCompacto(all) : valueFmt
  let lo = Math.min(0, ...all)
  let hi = Math.max(0, ...all)
  if (lo === 0 && hi === 0) hi = 1
  const span = hi - lo
  hi += span * 0.1
  if (lo < 0) lo -= span * 0.08
  const ticks = niceTicks(lo, hi, 5)
  const ih = height - m.top - m.bottom
  const iw = W - m.left - m.right
  const y = (v) => m.top + ih - ((v - lo) / (hi - lo)) * ih
  const y0 = y(0)
  const groupW = iw / groups.length
  // barras MAGRAS (tema C): teto menor e proporção mais enxuta que o antigo 24px.
  const barW = Math.min(18, (groupW * 0.56) / series.length)
  const gap = 3
  const setW = series.length * barW + (series.length - 1) * gap

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label="Gráfico de barras por cenário — receita, custo e lucro"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text
              x={m.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize="11"
              fill={C.muted}
              style={{ fontFamily: 'var(--fonte-num)', fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        <line x1={m.left} x2={W - m.right} y1={y0} y2={y0} stroke={C.axis} strokeWidth="1" />
        {groups.map((g, gi) => {
          const gx = m.left + gi * groupW + (groupW - setW) / 2
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                const x = gx + si * (barW + gap)
                const rotulo = labelSeries === 'all' || labelSeries === si
                const cor = series[si].colorFn ? series[si].colorFn(v) : series[si].color
                return (
                  <g key={si}>
                    <path d={barPath(x, y(v), barW, y0)} fill={cor}>
                      <title>{`${g.label} · ${series[si].label}: ${fmtBRL(v)}`}</title>
                    </path>
                    {rotulo && (
                      <text
                        x={x + barW / 2}
                        y={v >= 0 ? y(v) - 6 : y(v) + 14}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="600"
                        fill={C.ink}
                        // contorno claro (paint-order) para o rótulo ficar legível
                        // sobre barra e grade — projetado ou em print (tema C).
                        stroke={C.paper || '#fbf9f7'}
                        strokeWidth="3"
                        paintOrder="stroke"
                        strokeLinejoin="round"
                        style={{ fontFamily: 'var(--fonte-num)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {rotularBarra(v)}
                      </text>
                    )}
                  </g>
                )
              })}
              <text
                x={m.left + gi * groupW + groupW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="12"
                fill={C.ink2}
              >
                {g.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: C.ink2 }}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Gráfico de linhas da curva de vendas (Sessão F2-B — sugestão 14): eixo X em
 * dias até a festa (D-60 … D-0), eixo Y acumulado (R$ ou % do plano). SVG
 * próprio no padrão da casa — mesma gramática de grid/eixos/tipografia do
 * GroupedBars, sem biblioteca nova. Os pontos são acumulados reais; a linha
 * reta entre pontos é a leitura honesta do "constante entre vendas".
 *
 * series: [{ label, color, dash?, width?, pontos: [{ x, y }],
 *            marcadores?: [{ x, y, titulo }] }]
 * hojeX: dia relativo de hoje (linha vertical "hoje"), quando faz sentido.
 * marcosX: linhas verticais nomeadas extras (Sessão F2-S: "início de
 *   vendas") — [{ x, rotulo }]; aditivo, sem marcos = desenho de sempre.
 */
export function LinhasCurva({ series, hojeX = null, marcosX = [], height = 260, yFmt = fmtCompact }) {
  const C = VIZ.light
  const W = 760
  const m = { top: 16, right: 14, bottom: 30, left: 64 }
  const comPontos = series.filter((s) => (s.pontos || []).length > 0)
  const todosX = comPontos.flatMap((s) => s.pontos.map((p) => p.x))
  const todosY = comPontos.flatMap((s) => s.pontos.map((p) => p.y))
  const xMax = 0 // o dia da festa fecha o gráfico
  const xMin = Math.min(-60, ...todosX, hojeX ?? -60)
  let yHi = Math.max(1, ...todosY)
  yHi += yHi * 0.06
  // Y negativo (Sessão F2-C — saldo da aba Análise pode mergulhar abaixo de
  // zero): a régua desce até o menor ponto; com dados só positivos, yLo = 0 e
  // o desenho fica EXATAMENTE o de antes (curva de vendas da F2-B intocada).
  let yLo = Math.min(0, ...todosY)
  if (yLo < 0) yLo -= Math.abs(yLo) * 0.06
  const ticksY = niceTicks(yLo, yHi, 4)
  const iw = W - m.left - m.right
  const ih = height - m.top - m.bottom
  const x = (v) => m.left + ((v - xMin) / (xMax - xMin)) * iw
  const y = (v) => m.top + ih - ((v - yLo) / (yHi - yLo)) * ih
  // passo "redondo" do eixo X: ~5 rótulos entre xMin e 0
  const passoX = [7, 15, 30, 60, 90].find((p) => Math.abs(xMin) / p <= 5) || 90
  const ticksX = []
  for (let d = 0; d >= xMin; d -= passoX) ticksX.push(d)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label="Gráfico de linha — acumulado por dia até a festa"
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text
              x={m.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize="11"
              fill={C.muted}
              style={{ fontFamily: 'var(--fonte-num)', fontVariantNumeric: 'tabular-nums' }}
            >
              {yFmt(t)}
            </text>
          </g>
        ))}
        <line x1={m.left} x2={W - m.right} y1={y(0)} y2={y(0)} stroke={C.axis} strokeWidth="1" />
        {ticksX.map((d) => (
          <text
            key={d}
            x={x(d)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill={C.ink2}
            style={{ fontFamily: 'var(--fonte-num)', fontVariantNumeric: 'tabular-nums' }}
          >
            {d === 0 ? 'festa' : `D${d}`}
          </text>
        ))}
        {(() => {
          // Rótulos verticais do topo — "hoje" + marcos ("início de vendas").
          // BUG (handoff UX 23/07, Marco: "mto mal feito"): quando "hoje" e um
          // marco caíam em datas próximas, os dois textos saíam no MESMO x e y
          // (m.top - 4) e se escreviam um por cima do outro. Agora os rótulos
          // são empilhados em LINHAS: dois a menos de ~72px de distância descem
          // uma linha em vez de sobrepor. As linhas verticais seguem inteiras;
          // só o texto empilha. Sem colisão, o desenho fica idêntico ao de
          // antes (linha 0 = m.top - 4). Nenhum número muda — é layout do eixo.
          const rotulos = [
            ...(hojeX != null && hojeX >= xMin && hojeX <= xMax
              ? [{ x: hojeX, rotulo: 'hoje', hoje: true }]
              : []),
            ...(marcosX || [])
              .filter((mk) => mk && Number.isFinite(mk.x) && mk.x >= xMin && mk.x <= xMax)
              .map((mk) => ({ x: mk.x, rotulo: mk.rotulo, hoje: false })),
          ].sort((a, b) => a.x - b.x)
          if (rotulos.length === 0) return null
          const GAP = 72 // px mínimos entre rótulos na mesma linha antes de empilhar
          // Lógica de empilhamento em módulo puro testado (rotulosGrafico.js).
          const linhas = linhasParaRotulosProximos(
            rotulos.map((r) => x(r.x)),
            GAP
          )
          rotulos.forEach((r, i) => {
            r.linha = linhas[i]
          })
          return rotulos.map((r, i) => {
            const px = x(r.x)
            const anchor =
              px <= m.left + iw * 0.12 ? 'start' : px >= m.left + iw * 0.88 ? 'end' : 'middle'
            return (
              <g key={`${r.hoje ? 'hoje' : 'marco'}-${i}-${r.rotulo}`}>
                <line
                  x1={px}
                  x2={px}
                  y1={m.top}
                  y2={m.top + ih}
                  stroke={r.hoje ? C.muted : C.ink2}
                  strokeWidth="1"
                  strokeDasharray={r.hoje ? '2 4' : '5 3'}
                />
                <text
                  x={px}
                  y={m.top - 4 + r.linha * 12}
                  textAnchor={anchor}
                  fontSize="10"
                  fill={r.hoje ? C.muted : C.ink2}
                >
                  {r.rotulo}
                </text>
              </g>
            )
          })
        })()}
        {comPontos.map((s) => {
          const visiveis = s.pontos.filter((p) => p.x >= xMin && p.x <= xMax)
          if (visiveis.length === 0) return null
          const d = visiveis
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`)
            .join(' ')
          return (
            <g key={s.label}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width || 2}
                strokeDasharray={s.dash || undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {(s.marcadores || [])
                .filter((mk) => mk.x >= xMin && mk.x <= xMax)
                .map((mk, i) => (
                  <circle key={i} cx={x(mk.x)} cy={y(mk.y)} r="3.5" fill={s.color}>
                    <title>{mk.titulo}</title>
                  </circle>
                ))}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: C.ink2 }}
          >
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="1"
                x2="17"
                y1="3"
                y2="3"
                stroke={s.color}
                strokeWidth={s.width || 2}
                strokeDasharray={s.dash || undefined}
                strokeLinecap="round"
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Barras horizontais de comparação (uma medida). A linha destacada
 * (highlight) usa o ACENTO do app (segue a Aparência dos Ajustes); as demais
 * ficam neutras — a identidade vem do rótulo da linha, o valor é sempre
 * visível à direita.
 */
export function HBars({ rows, valueFmt = fmtCompact }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value || 0)))
  // rótulo calibrado ao conjunto de linhas (tema D): barras que desempatam,
  // rótulos que desempatam. Modo R$/pax mantém o formato de fora.
  const rotular =
    valueFmt === fmtCompact ? formatadorCompacto(rows.map((r) => r.value)) : valueFmt
  // Tema F: se ALGUMA linha oferece "ocultar" (onHide), reserva um slot fixo à
  // direita em TODAS as linhas — a coluna de valores não dança, e o × (só no
  // hover, só nas linhas com onHide) tem lugar garantido.
  const temHide = rows.some((r) => typeof r.onHide === 'function')
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="group/hbar flex items-center gap-3">
          <div className="w-36 shrink-0 truncate text-xs text-[var(--tinta-2)]" title={r.label}>
            {r.label}
          </div>
          <div className="relative h-5 flex-1">
            {r.value != null && (
              <div
                className="absolute inset-y-0 left-0 rounded-r"
                style={{
                  width: `${(Math.abs(r.value) / max) * 100}%`,
                  minWidth: r.value ? '2px' : 0,
                  background: r.highlight ? 'var(--acento)' : VIZ.light.neutro,
                }}
                title={rotular(r.value)}
              />
            )}
          </div>
          <div
            className={`w-28 shrink-0 text-right text-xs tnum ${
              r.highlight ? 'font-semibold text-[var(--tinta)]' : 'text-[var(--tinta-2)]'
            }`}
          >
            {/* `texto` (S1, 07/10/2026): a linha sem número diz por quê — p.ex.
                "não dá para calcular" no lugar de "—", que é ausência. */}
            {r.value == null ? (r.texto ?? '—') : rotular(r.value)}
          </div>
          {temHide && (
            <div className="w-4 shrink-0">
              {r.onHide && (
                <button
                  type="button"
                  onClick={r.onHide}
                  title={r.hideTitle || `Ocultar ${r.label}`}
                  aria-label={r.hideTitle || `Ocultar ${r.label}`}
                  className="hidden h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[var(--tinta-3)] hover:bg-[var(--papel-2)] hover:text-[var(--vermelho-texto)] group-hover/hbar:inline-flex"
                >
                  <AppIcon icon={X} size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
