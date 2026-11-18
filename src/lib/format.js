import { num } from './util.js'

export const fmtBRL = (v, dec = 0) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num(v))

// mostra centavos apenas quando existem
export const fmtBRL2 = (v) => {
  const n = num(v)
  return fmtBRL(n, Math.abs(n % 1) > 0.004 ? 2 : 0)
}

export const fmtInt = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(num(v)))

export const fmtPct = (v, dec = 1) =>
  v == null
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(num(v))}%`

// Formato compacto que NÃO ENGANA (Sessão F2-P, tema D — print do Marco: duas
// barras de alturas diferentes rotuladas ambas "R$ 2 mil"). Regra:
// - abaixo de R$ 10 mil ganha 1 casa decimal (2.400 vira "R$ 2,4 mil", não
//   "R$ 2 mil"); usa maximumFractionDigits, então valor redondo não fica com
//   ",0" pendurado (2.000 segue "R$ 2 mil").
// - `dec` força o nº de casas — é o que o formatadorCompacto usa para subir a
//   precisão até desempatar qualquer par comparado.
const milhar = (x, dec) =>
  x.toLocaleString('pt-BR', { maximumFractionDigits: dec, minimumFractionDigits: 0 })

export const fmtCompact = (v, dec = null) => {
  const n = num(v)
  const abs = Math.abs(n)
  if (abs >= 1e6) return `R$ ${milhar(n / 1e6, dec ?? 1)} mi`
  if (abs >= 1e3) return `R$ ${milhar(n / 1e3, dec ?? (abs < 1e4 ? 1 : 0))} mil`
  return fmtBRL(n, dec ?? 0)
}

/**
 * Formatador compacto calibrado a um CONJUNTO de valores comparados: devolve
 * uma função (v)=>string que usa o MENOR número de casas (0→1→2) tal que dois
 * valores DISTINTOS nunca caem no mesmo rótulo. É a fonte única para toda
 * superfície de comparação (barras dos gráficos, tríade de cenários, resumo):
 * se as barras desempatam, os rótulos também desempatam. Fora de comparação,
 * use fmtCompact direto.
 */
export function formatadorCompacto(valores) {
  const distintos = [
    ...new Set((valores || []).map(num).filter(Number.isFinite).map((x) => Math.round(x * 100) / 100)),
  ]
  for (let dec = 0; dec <= 2; dec++) {
    const vistos = new Map()
    let colide = false
    for (const x of distintos) {
      const rotulo = fmtCompact(x, dec)
      if (vistos.has(rotulo) && vistos.get(rotulo) !== x) {
        colide = true
        break
      }
      vistos.set(rotulo, x)
    }
    if (!colide) return (v) => fmtCompact(v, dec)
  }
  return (v) => fmtCompact(v, 2)
}

export const fmtData = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

export const DASH = '—'

/**
 * Tamanho de fonte que faz um número grande CABER na largura do cartão, sem
 * cortar o último dígito (07/10/2026, cartão de lucro com centavos — P6 do
 * plano dos centavos). Medido a 390 px: "R$ 30.423,84" em text-3xl passava 20 px
 * da largura do cartão da aba Cenários e a tela mostrava "R$ 30.423,8".
 *
 * Devolve um valor CSS para `font-size`: o tamanho cheio (`maxRem`) quando cabe,
 * e menor quando o texto é longo para a largura do contêiner (`100cqw`). O
 * contêiner tem de declarar `container-type: inline-size`. O fator 0,62 em é a
 * largura média medida de um caractere de dinheiro (dígitos tabulares, "R$",
 * ponto, vírgula) na fonte da casa em peso semibold, com folga.
 */
export const fonteQueCabe = (texto, maxRem) =>
  `min(${maxRem}rem, calc(100cqw / ${(0.62 * Math.max(1, String(texto ?? '').length)).toFixed(2)}))`
