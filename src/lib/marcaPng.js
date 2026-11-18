// Rasterização da MARCA para o export v2 — SÓ NAVEGADOR (usa Image + canvas).
// Mora SEPARADA do writer de propósito (Marco, 21/07/2026 — exigência 2 da
// espinha): o writer recebe o PNG pronto em gerarXlsx(evento, { logoPng }), então
// o writer inteiro é testável headless com um PNG fake de 1px. jsdom/vitest NÃO
// rasteriza canvas de verdade — ESTA peça se prova no navegador uma vez, ao ligar
// o botão de export (não tem teste de unidade, por isso).
//
// Mapa marca→elemento espelha o AssinaturaFesta (Marca.jsx), fonte única do
// PADRAO-DA-CASA §3: Brisa → script cursivo (em tinta, regra própria do logo) ·
// Sobrado → wordmark (verde) · Marfim Alto → a ostra (azul) · O Galeao →
// wordmark de texto GENÉRICO (placeholder laranja, Marco 21/07, até o vetor
// oficial chegar). Tipo desconhecido / sem tipo → null → o writer usa nome em texto.
import brisaScriptRaw from '../assets/marca/brisa-script.svg?raw'
import sobradoWordmarkRaw from '../assets/marca/sobrado-wordmark.svg?raw'
import ostraContornoRaw from '../assets/marca/ostra-contorno.svg?raw'
import galeaoGenericoRaw from '../assets/marca/galeao-generico.svg?raw'

const SVG = {
  Brisa: brisaScriptRaw,
  'Sobrado': sobradoWordmarkRaw,
  'Marfim Alto': ostraContornoRaw,
  'O Galeao': galeaoGenericoRaw, // placeholder genérico (wordmark de texto) até o vetor oficial
}
// Tinta de impressão da marca no papel branco da planilha. Espelha COR_MARCA
// (Marca.jsx / PADRAO-DA-CASA §3); a Brisa sai em tinta escura como o material
// de marca (o vermelho de exibição é do dot, não do logo).
const COR = {
  Brisa: '#211f1c',
  'Sobrado': '#00782a',
  'Marfim Alto': '#0045dd',
  'O Galeao': '#c2410c', // laranja da marca (PADRAO-DA-CASA §3)
}

// Pinta o preto do potrace na cor da festa. Dois casos no material da casa:
// sobrado/brisa trazem fill="#000000" nos paths (troca o hex); a ostra não
// declara fill nenhum e herda o preto default (injeta fill na raiz <svg>).
function pintar(raw, cor) {
  const trocado = raw.replace(/#000000/gi, cor).replace(/fill="#000"/gi, `fill="${cor}"`)
  return /<svg[^>]*\sfill=/i.test(trocado)
    ? trocado
    : trocado.replace(/<svg\b/i, `<svg fill="${cor}"`)
}

// Razão largura/altura — do viewBox (a ostra só tem isso) ou de width/height.
function razaoAspecto(raw) {
  const vb = raw.match(/viewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/i)
  if (vb) return Number(vb[1]) / Number(vb[2])
  const w = raw.match(/\bwidth="([\d.]+)/i)
  const h = raw.match(/\bheight="([\d.]+)/i)
  return w && h ? Number(w[1]) / Number(h[1]) : 2
}

/** Rasteriza o SVG da marca da festa num PNG (Uint8Array), pronto pro writer.
 *  Devolve null só quando o tipo não tem elemento no mapa (tipo desconhecido /
 *  vazio) — aí o writer usa o nome em texto. SÓ NAVEGADOR (Image + canvas). */
export async function gerarLogoPng(tipo, { alturaPx = 160, escala = 2 } = {}) {
  const t = (tipo || '').trim()
  const raw = SVG[t]
  if (!raw) return null // tipo sem elemento → o writer cai no nome em texto
  const svg = pintar(raw, COR[t] || '#211f1c')
  // `data:` e não `blob:` (revisão do PR #100, 05/10/2026): a política de
  // conteúdo do servidor da nuvem permite imagem só de 'self' e `data:`, e um
  // `blob:` aqui era bloqueado CALADO — a planilha saía sem logo. Com `data:`
  // a política continua fechada e o logo sai nas duas origens (Mac e nuvem).
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const img = new Image()
  await new Promise((ok, err) => {
    img.onload = ok
    img.onerror = () => err(new Error('o desenho da marca não carregou no navegador'))
    img.src = url
  })
  const h = Math.round(alturaPx * escala)
  const w = Math.round(h * razaoAspecto(raw))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h) // fundo transparente (a planilha é branca)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('o navegador não converteu a marca em imagem')
  return new Uint8Array(await blob.arrayBuffer()) // só os bytes: o writer dimensiona lendo o PNG
}

/**
 * O aviso da tela quando a marca não sai (princípio 4: nada falha em silêncio).
 * A planilha é baixada assim mesmo — sem o logo, com o nome da festa em texto.
 */
export const msgPlanilhaSemLogo = (motivo) =>
  `A planilha foi baixada sem logo: ${motivo}. O orçamento está completo; ` +
  'no lugar do logo vai o nome da festa em texto.'
