// Aparência (sugestão 26, Sessão K): cor de cada festa e cor de destaque do
// app, editáveis em Ajustes › Aparência — swatches da paleta oficial do
// branding book ou cor livre, sempre com "voltar ao padrão da marca".
//
// Regras:
// - O SEMÁFORO (verde/amarelo/vermelho do veredito) fica FORA da edição:
//   é significado, não decoração — as variáveis --sem-* não passam por aqui.
// - Preferências em CHAVE PRÓPRIA do localStorage (fora do store e do backup
//   JSON): backup antigo abre sem mudar nada; são só cores de exibição,
//   nenhum dado de dinheiro mora aqui.
// - Padrões = CORES_MARCA do Financeiro (mesma casa). NOVO MAPA da casa
//   (Marco, 19/07/2026 — F2-Y, PADRAO-DA-CASA §3): Marfim Alto AZUL, Brisa
//   VERMELHO, Sobrado VERDE, O Galeao LARANJA PASTEL; festas novas/custom
//   nascem no rosa — a cor livre da paleta.

const KEY = 'previsao-eventos:aparencia:v1'

export const ACENTO_PADRAO = '#0045dd'

// Mesmo mapa do Financeiro (static/js/util.js, CORES_MARCA) — de propósito.
// O Galeao = laranja pastel "fechado" (#c2410c): fora dos 6 acentos do book,
// mas escolhido escuro o bastante para passar AA como texto/dot pequeno no
// papel (≈4,4:1 no fundo, ≈4,9:1 no cartão) — um pastel claro sumiria.
export const CORES_FESTA_PADRAO = {
  'Marfim Alto': '#0045dd',
  Brisa: '#ff000c',
  'Sobrado': '#00782a',
  'O Galeao': '#c2410c',
}

// Rosa: a cor da paleta que ficou livre — padrão das festas novas/custom.
export const COR_FESTA_LIVRE = '#fb9fc6'

// Swatches oferecidos na edição: a paleta oficial (book pág. 10) + o
// quase-preto do lettering da Marfim.
export const SWATCHES_MARCA = [
  { cor: '#0045dd', nome: 'Azul' },
  { cor: '#fb9fc6', nome: 'Rosa' },
  { cor: '#fecd07', nome: 'Amarelo' },
  { cor: '#00782a', nome: 'Verde' },
  { cor: '#ff000c', nome: 'Vermelho' },
  { cor: '#211f1c', nome: 'Quase-preto' },
]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export const corValida = (v) => typeof v === 'string' && HEX_RE.test(v)

// Tema do app (sugestão 31 / tema G, F2-P): claro (padrão), escuro, ou
// automático (segue o sistema). Guardado junto das prefs de aparência (chave
// própria, fora do backup de dados). Só exibição — nenhum número muda.
export const TEMAS = ['claro', 'escuro', 'auto']

/** Forma segura das preferências: qualquer coisa fora do formato vira o
 *  padrão — cor inválida nunca entra calada na tela. */
export function formaAparencia(d) {
  const base = { acento: null, festas: {}, tema: 'claro' }
  if (!d || typeof d !== 'object') return base
  if (corValida(d.acento)) base.acento = d.acento.toLowerCase()
  if (TEMAS.includes(d.tema)) base.tema = d.tema
  if (d.festas && typeof d.festas === 'object') {
    for (const [tipo, cor] of Object.entries(d.festas)) {
      if (typeof tipo === 'string' && tipo.trim() && corValida(cor)) {
        base.festas[tipo] = cor.toLowerCase()
      }
    }
  }
  return base
}

const prefereEscuroSistema = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

/** true quando o tema efetivo é escuro (resolve o 'auto' pelo sistema). */
export function temaEscuroEfetivo(prefs) {
  const tema = prefs?.tema || 'claro'
  return tema === 'escuro' || (tema === 'auto' && prefereEscuroSistema())
}

/** Aplica o tema no <html> (data-theme). O relatório força claro por conta
 *  própria (data-theme='light' no seu root); a impressão idem (@media print). */
export function aplicarTema(prefs) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = temaEscuroEfetivo(prefs) ? 'dark' : 'light'
}

/** No modo 'auto', reaplica quando o sistema troca claro↔escuro. Devolve a
 *  função de limpeza (remove o listener). No claro/escuro fixos, não faz nada. */
export function vigiarTemaSistema(prefs, aoMudar) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  if ((prefs?.tema || 'claro') !== 'auto') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => aoMudar()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export function loadAparencia() {
  try {
    if (typeof localStorage === 'undefined') return formaAparencia(null)
    return formaAparencia(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return formaAparencia(null)
  }
}

export function saveAparencia(prefs) {
  try {
    if (typeof localStorage === 'undefined') return { ok: true }
    localStorage.setItem(KEY, JSON.stringify(formaAparencia(prefs)))
    return { ok: true }
  } catch {
    return {
      ok: false,
      erro: 'Não foi possível salvar a aparência (armazenamento do navegador cheio). As cores valem só nesta sessão.',
    }
  }
}

// Cor legível no tema ESCURO (tema G): detecta pela DISTÂNCIA do fundo escuro
// (não pela luminância: o vermelho é "escuro" mas bem visível) e clareia SÓ o
// que está perto do fundo, mantendo o calor. Significado preservado, contraste
// garantido.
// Este comentário descrevia o mapa ANTIGO (Marfim quase-preto · Sobrado azul ·
// O Galeao verde) e foi corrigido em 25/07/2026 — só o texto; a regra e o
// limiar são os mesmos. No mapa que vale hoje (CORES_FESTA_PADRAO, acima)
// nenhuma cor de festa padrão é clareada: as quatro passam longe do grafite.
// Quem a função ainda protege é o quase-preto do lettering — swatch da paleta,
// e a antiga cor da Marfim — e qualquer cor livre que o Marco escolha perto do
// fundo.
const FUNDO_ESCURO = { r: 0x1b, g: 0x19, b: 0x16 }
const ALVO_CLARO = { r: 0xcf, g: 0xc9, b: 0xbe }
export function corLegivelNoEscuro(hex) {
  const c = hexParaRgb(hex)
  if (!c) return hex
  const dist = Math.sqrt(
    (c.r - FUNDO_ESCURO.r) ** 2 + (c.g - FUNDO_ESCURO.g) ** 2 + (c.b - FUNDO_ESCURO.b) ** 2
  )
  if (dist >= 70) return hex // já contrasta com o fundo
  const mix = (x, y) => Math.round(x + (y - x) * 0.75)
  return `#${[mix(c.r, ALVO_CLARO.r), mix(c.g, ALVO_CLARO.g), mix(c.b, ALVO_CLARO.b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

/** Cor de exibição de uma festa: escolhida nos Ajustes → padrão da marca →
 *  rosa (cor livre) para festas novas/custom. '' (sem categoria) = neutro.
 *  `escuro` clareia cores que sumiriam no grafite (só as perto do fundo). */
export function corFesta(tipo, prefs, escuro = false) {
  const t = (tipo || '').trim()
  const base = !t ? '#9b958a' : corValida(prefs?.festas?.[t]) ? prefs.festas[t] : CORES_FESTA_PADRAO[t] || COR_FESTA_LIVRE
  return escuro ? corLegivelNoEscuro(base) : base
}

export function corAcento(prefs) {
  return corValida(prefs?.acento) ? prefs.acento : ACENTO_PADRAO
}

// ── derivações de cor (hover mais escuro, tinta com alpha) ────────────────
export function hexParaRgb(hex) {
  if (!corValida(hex)) return null
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

export function escurecer(hex, fator = 0.82) {
  const c = hexParaRgb(hex)
  if (!c) return hex
  const f = (n) => Math.round(Math.max(0, Math.min(255, n * fator)))
  return `#${[f(c.r), f(c.g), f(c.b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

export function comAlpha(hex, alpha) {
  const c = hexParaRgb(hex)
  if (!c) return hex
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

/** Aplica o acento nas variáveis CSS do app (--acento/hover/tinta). O
 *  semáforo (--sem-*) NUNCA é tocado por aqui — regra da sugestão 26. */
export function aplicarAcento(prefs) {
  if (typeof document === 'undefined') return
  const cor = corAcento(prefs)
  const st = document.documentElement.style
  st.setProperty('--acento', cor)
  st.setProperty('--acento-hover', escurecer(cor))
  st.setProperty('--acento-tinta', comAlpha(cor, 0.07))
}
