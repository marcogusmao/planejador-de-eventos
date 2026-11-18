// Marca da casa — a ostra desenhada à mão (bone_ostra contorno, do material
// oficial em src/assets/marca/ostra-contorno.svg). MESMO desenho que o topo
// do Financeiro usa: os dois apps assinam igual. `currentColor`
// permite vesti-la no acento (tela inicial) ou em tinta (relatório impresso).

// Logos da Brisa vetorizados por potrace (script manuscrito + wordmark bloco;
// entregues pelo Marco em 18/07/2026 — Sessão F2-B; vetorizados em 19/07 — F2-C).
//
// Sessão F2-P (19/07/2026): trocado o <img src={svg}> por SVG INLINE em
// `currentColor`. Motivos, pela raiz:
//   1. um <img> de asset externo pode virar "ícone quebrado" quando o build
//      antigo referencia um caminho que mudou (foi o que o print do Marco
//      mostrou: preview buildado antes da troca PNG→SVG da F2-C);
//   2. SVG preto fixo some no fundo escuro — inline em currentColor herda a
//      cor do texto e fica legível no tema claro E no escuro (sugestão 31);
//   3. mesma linguagem do LogoOstra logo abaixo (já é SVG inline).
// Os arquivos .svg em src/assets/marca/ seguem sendo a FONTE DA VERDADE: o
// desenho é lido deles em tempo de build (?raw) — nada de path copiado à mão.
import { Bola } from './ui.jsx'
import brisaScriptRaw from '../assets/marca/brisa-script.svg?raw'
import brisaBlocoRaw from '../assets/marca/brisa-bloco.svg?raw'
import sobradoWordmarkRaw from '../assets/marca/sobrado-wordmark.svg?raw'

// Extrai o grupo de desenho (<g>…</g>) do SVG do potrace e troca o preto fixo
// por currentColor. Conteúdo é asset PRÓPRIO da casa (não é dado do usuário) —
// dangerouslySetInnerHTML aqui é seguro.
function corpoSvg(raw) {
  const ini = raw.indexOf('<g ')
  const fim = raw.lastIndexOf('</g>')
  if (ini < 0 || fim < 0) return ''
  return raw.slice(ini, fim + 4).replace(/fill="#0{6}"/gi, 'fill="currentColor"')
}

const BRISA_SCRIPT = { corpo: corpoSvg(brisaScriptRaw), w: 723.144778, h: 283.999221 }
const BRISA_BLOCO = { corpo: corpoSvg(brisaBlocoRaw), w: 145.185062, h: 140.611101 }
const SOBRADO_WORDMARK = { corpo: corpoSvg(sobradoWordmarkRaw), w: 1747, h: 365.424779 }

// Só o cursivo "Brisa", sem o lockup "WORDMARK" (item logo, F2-W — print do
// Marco: o "m" final do cursivo estava sendo CORTADO).
// O SVG oficial é um lockup: cursivo "Brisa" à esquerda + wordmark "WORDMARK"
// empilhado à direita. A variante compacta da F2-P recortava o viewBox em
// x:[0,580] para tirar o lockup — mas o "m" final do cursivo termina em x≈595
// e o lockup começa em x≈595 (medido ao vivo): eles se SOBREPÕEM em x, então
// QUALQUER recorte de viewBox que exclua o lockup corta o "m".
// Conserto de raiz: em vez de recortar o viewBox, REMOVE os paths do lockup e
// mantém o viewBox CHEIO — o cursivo (com o "m" e a cauda decorativa, que vai
// até a borda direita) aparece inteiro, nada é cortado. O potrace emite os
// paths do lockup com o `d` começando em x-local alto (> 7000; o cursivo começa
// em ≤ 6526 — gap limpo, medido ao vivo). Sobre o mesmo viewBox/ratio do full.
function corpoSvgCursivo(raw) {
  return corpoSvg(raw).replace(/<path d="M(\d+)[^"]*"\s*\/>/g, (m, x) =>
    Number(x) > 7000 ? '' : m
  )
}
const BRISA_CURSIVO = { corpo: corpoSvgCursivo(brisaScriptRaw), w: 723.144778, h: 283.999221 }

function LogoSvgInline({ corpo, viewBox, ratio, height, className, title }) {
  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={height * ratio}
      className={`inline-block shrink-0 select-none align-middle ${className}`}
      role="img"
      aria-label={title}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: `<title>${title}</title>${corpo}` }}
    />
  )
}

// Uso DISCRETO onde a marca Brisa aparece com espaço de sobra. `compacto`
// (rótulo de grupo, escala pequena) mostra só o cursivo, sem o lockup "WORDMARK".
export function LogoBrisa({ height = 18, className = '', title = 'Brisa', compacto = false }) {
  // compacto = só o cursivo (sem o lockup ruidoso); full = o lockup inteiro.
  // Os dois usam o MESMO viewBox/ratio cheio — o compacto só omite os paths do
  // lockup, então o "m" final e a cauda do cursivo aparecem sem corte.
  const src = compacto ? BRISA_CURSIVO : BRISA_SCRIPT
  return (
    <LogoSvgInline
      corpo={src.corpo}
      viewBox={`0 0 ${src.w} ${src.h}`}
      ratio={src.w / src.h}
      height={height}
      className={className}
      title={title}
    />
  )
}

// Wordmark bloco "WORDMARK" (variante compacta — PADRAO-DA-CASA.md, seção 3).
// Guardada aqui junto do script para peças Brisa; hoje nenhuma tela a usa.
export function LogoBrisaBloco({ height = 18, className = '', title = 'Brisa' }) {
  return (
    <LogoSvgInline
      corpo={BRISA_BLOCO.corpo}
      viewBox={`0 0 ${BRISA_BLOCO.w} ${BRISA_BLOCO.h}`}
      ratio={BRISA_BLOCO.w / BRISA_BLOCO.h}
      height={height}
      className={className}
      title={title}
    />
  )
}

// Wordmark oficial da Sobrado (vetor entregue pelo Marco —
// scratchpad/marca/sobrado; copiado para src/assets/marca em F2-P). Inline em
// currentColor, mesma razão do Brisa: sem asset externo, legível claro/escuro.
export function LogoSobrado({ height = 14, className = '', title = 'Sobrado' }) {
  return (
    <LogoSvgInline
      corpo={SOBRADO_WORDMARK.corpo}
      viewBox={`0 0 ${SOBRADO_WORDMARK.w} ${SOBRADO_WORDMARK.h}`}
      ratio={SOBRADO_WORDMARK.w / SOBRADO_WORDMARK.h}
      height={height}
      className={className}
      title={title}
    />
  )
}

// Assinatura da festa para RÓTULOS e RODAPÉS (cabeçalho de grupo da Home,
// relatório, apresentação) — uma fonte só para todo lugar que "assina" a festa
// (feature não é ilha). Onde o logo SOLETRA o nome (Brisa cursivo, Sobrado
// wordmark) ele faz o papel do nome; onde a marca é forma (Marfim) ou não há
// logo ainda (O Galeao / sem tipo), o nome vem em texto. Altura única ⇒ mesma
// linha-base e mesmo eixo em todos os grupos. currentColor ⇒ herda a tinta.
export function MarcaFesta({ tipo, height = 15, className = '' }) {
  const t = (tipo || '').trim()
  if (t === 'Brisa') return <LogoBrisa compacto height={height} className={className} />
  if (t === 'Sobrado') return <LogoSobrado height={height - 1} className={className} />
  return <span className={className}>{t || 'Sem categoria'}</span>
}

// Cor de EXIBIÇÃO da marca (PADRAO-DA-CASA.md, seção 3 — NOVO mapa da casa,
// Marco 19/07/2026, F2-Y): Marfim Alto AZUL, Brisa vermelho, Sobrado
// VERDE, O Galeao laranja pastel. É a cor com que a MARCA aparece — não é
// semáforo (aquele é significado). O LOGO script da Brisa é exceção: sai em
// tinta, não no vermelho (regra própria, tratada no case abaixo).
const COR_MARCA = {
  Brisa: '#ff000c',
  'Sobrado': '#00782a',
  'Marfim Alto': '#0045dd',
  'O Galeao': '#c2410c',
}

// Cores da marca sobre fundo ESCURO (apresentação/preto verdadeiro): o azul,
// o verde e o laranja escuros perderiam contraste no preto — sobem para
// versões legíveis, mantendo a identidade (mesma lógica do VIZ.dark).
const COR_MARCA_DARK = {
  Brisa: '#ff5a63',
  'Sobrado': '#2fbf6b',
  'Marfim Alto': '#4d7dff',
  'O Galeao': '#f0894a',
}

// Assinatura VISUAL por festa para peças (rodapé/cabeçalho do relatório,
// apresentação, prints) — pedido do Marco em F2-P: cada festa assina do seu
// jeito. Brisa = script · Sobrado = wordmark azul · Marfim = ostra ·
// sem tipo = ostra da casa · O Galeao = bola verde + nome. Na cor da marca.
export function AssinaturaFesta({ tipo, height = 26, className = '', dark = false }) {
  const t = (tipo || '').trim()
  const mapa = dark ? COR_MARCA_DARK : COR_MARCA
  const cor = mapa[t] || (dark ? '#f0ebe7' : 'var(--acento)')
  if (t === 'Brisa')
    // O logo SCRIPT da Brisa usa TINTA (preto no claro; off-white no escuro),
    // como o material de marca original — NÃO o vermelho de EXIBIÇÃO da festa.
    // O vermelho #ff000c fica no dot da festa, no card da Home, no agrupamento
    // e no gráfico (acentos); o LOGO tem regra própria, separada do acento
    // (pedido do Marco via orquestrador, F2-W; registrado no PADRAO-DA-CASA §3).
    return (
      <span
        className={className}
        style={{ color: dark ? '#f0ebe7' : '#211f1c', display: 'inline-flex' }}
      >
        <LogoBrisa compacto height={height} />
      </span>
    )
  if (t === 'Sobrado')
    return (
      <span className={className} style={{ color: cor, display: 'inline-flex' }}>
        <LogoSobrado height={height * 0.62} />
      </span>
    )
  if (t === 'O Galeao')
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold ${className}`}
        style={{ color: cor, fontSize: height * 0.62 }}
      >
        <Bola cor={cor} size={height * 0.5} title="O Galeao" />
        O Galeao
      </span>
    )
  // Marfim Alto ou sem tipo → a ostra da casa
  return (
    <LogoOstra size={height} className={className} style={{ color: cor }} title={t || 'Marfim Alto Group'} />
  )
}

export function LogoOstra({ size = 34, className = '', title = 'Marfim Alto Group', style }) {
  return (
    <svg
      viewBox="0 0 118.19 185.53"
      width={size}
      height={size * (185.53 / 118.19)}
      fill="currentColor"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M80.42,22.07c.27,2.36.31,4.78.87,7.07.8,3.3,2.62,5.95,6.02,7.23,3.25,1.22,5.98,3.31,8.61,5.49,3.13,2.59,6.29,5.17,9.19,8,4.02,3.92,5.9,9.02,7.33,14.34,1.35,5.03,1.87,10.15,2.18,15.34.48,7.93.87,15.86.67,23.8-.14,5.51-.27,11.01-.51,16.52-.18,3.93-1.5,7.58-2.95,11.22-1.54,3.87-3.91,7.09-6.84,9.91-1.47,1.41-3.29,2.46-4.88,3.76-3.37,2.76-6.67,5.6-10.02,8.37-1.74,1.44-3.29,3-4.52,4.93-1.07,1.68-1.54,3.45-1.47,5.4.05,1.33,1.24,1.61,2.1,2.11,1.14.67,1.62,1.26,1.12,2.5-.75,1.86-1.67,3.65-2.64,5.4-1.13,2.04-2.7,3.73-4.5,5.23-2.53,2.1-5.56,2.78-8.69,3.13-2.85.32-5.72.48-8.58.65-1.75.11-3.1-.78-4.17-2.05-1.16-1.39-1.77-3.01-2.05-4.83-.61-4.06-2.07-7.84-3.91-11.51-1.73-3.43-4.66-5.31-7.91-6.89-2.45-1.19-3.56-3.46-4.31-5.79-.97-3.02-1.77-6.13-2.19-9.26-.49-3.69-2.46-6.17-5.28-8.29-3.33-2.5-6.88-4.61-10.63-6.42-2.74-1.32-5.12-3.15-7.3-5.26-2.02-1.95-4.31-3.67-6.09-5.81-4.12-4.98-7.17-10.55-7.72-17.14-.12-1.39.25-2.84.51-4.23.59-3.16,1.13-6.34,1.94-9.45.59-2.25,1.45-4.44,2.41-6.56,2.02-4.46,3.31-9.12,3.76-13.97.39-4.18,1.47-8.14,3.49-11.78,1.97-3.53,4.23-6.9,6.3-10.38,1.29-2.17,2.39-4.46,3.69-6.63,2.12-3.56,3.71-7.49,6.71-10.47,2.45-2.43,4.95-4.81,7.51-7.13,3.4-3.08,6.67-6.35,10.37-9.04,5.68-4.13,12.17-6.66,19.23-6.88,5.16-.16,9.15,2.44,11.58,7.11,1.85,3.55,1.83,7.44,1.89,11.3,0,.32,0,.64,0,.96-.11.01-.21.02-.32.03ZM78.34,21.2c0-1.71.14-3.44-.04-5.14-.17-1.61-.39-3.32-1.07-4.75-2.07-4.35-5.63-6.57-10.5-6.45-1.26.03-2.54.27-3.77.55-5.43,1.23-10.62,3.14-14.88,6.79-5.33,4.56-10.46,9.36-15.58,14.16-1.36,1.28-2.55,2.83-3.52,4.44-1.9,3.17-3.59,6.48-5.37,9.73-.45.83-.85,1.7-1.35,2.5-1.86,3-3.79,5.97-5.64,8.98-2.58,4.22-4.06,8.79-4.54,13.75-.49,5.01-1.79,9.84-4.16,14.34-.62,1.18-1.16,2.46-1.46,3.75-.9,3.87-1.55,7.8-2.52,11.66-.85,3.4-.22,6.57,1.02,9.67,2.04,5.09,4.89,9.65,9.14,13.24,3.2,2.7,6.13,5.78,10.05,7.49,3.78,1.65,7.18,3.88,10.43,6.36,2.56,1.96,4.91,4.14,5.51,7.57.28,1.61.53,3.22.88,4.82.66,2.97,1.14,6.01,2.89,8.63.67,1,1.43,1.73,2.59,2.29,2.8,1.35,5.42,3,7.19,5.72,2.27,3.5,3.67,7.35,4.74,11.34.42,1.56.51,3.22,1.06,4.73.79,2.16,1.98,3.03,4.09,2.83,2.45-.23,4.93-.23,7.38-.54,2.51-.32,5.05-.62,7.23-2.17,3.27-2.34,5.32-5.58,6.89-9.19.28-.65.11-1.01-.59-1.36-2.13-1.07-2.72-2.37-2.55-4.71.16-2.22,1.1-4.08,2.24-5.93,1.36-2.19,3.31-3.76,5.23-5.37,3.34-2.78,6.59-5.68,10.09-8.24,4.36-3.2,8.12-6.81,10.17-11.93,1.29-3.24,2.71-6.45,2.85-10.01.25-6.34.62-12.68.65-19.02.02-5.94-.39-11.88-.52-17.82-.18-8.2-.88-16.3-3.77-24.07-1.26-3.39-2.96-6.5-5.7-8.93-2.61-2.31-5.32-4.51-7.96-6.79-2.88-2.49-5.91-4.7-9.5-6.1-2.55-1-4.1-3.11-5.36-5.43-1.95-3.58-2.08-7.46-1.95-11.4Z" />
      <path d="M98.35,87.46c-.35,5.5-.35,11.25-1.19,16.86-.52,3.49-2.24,6.81-3.58,10.15-2.02,5.04-4.9,9.6-8.01,14.04-1.23,1.75-2.07,3.81-2.84,5.82-2.05,5.37-4.73,10.33-8.92,14.36-.2.19-.41.37-.64.51-1.48.9-2.6,2.02-3.15,3.77-.75,2.39-1.91,2.82-4.3,1.93-.55-.2-1.16-.42-1.73-.4-3.43.16-5.24-1.64-6.19-4.75-1.57-5.13-4.52-9.52-7.88-13.61-2.01-2.45-4.39-4.59-6.5-6.96-.99-1.11-2.31-1.28-3.56-1.67-1.84-.57-3.69-.98-5.07-2.55-1.04-1.19-2.26-2.28-3.55-3.2-.94-.67-2.11-1.07-3.22-1.48-1.19-.43-2.48-.62-3.64-1.12-2.54-1.07-5.03-2.26-7.52-3.44-.37-.18-.66-.56-.92-.9-.86-1.13-1.65-2.33-2.54-3.44-1.71-2.12-1.52-4.58-1.4-7.06.08-1.67.23-3.36.07-5.02-.64-6.71.72-12.91,4.07-18.78,2.14-3.76,3.39-7.9,4.24-12.16.6-3.04,1.23-6.09,2.17-9.03.55-1.73,1.77-3.23,2.59-4.89,1.63-3.3,3.16-6.64,4.8-9.93.52-1.04,1.08-2.15,1.91-2.93,2.32-2.16,4.72-4.25,7.22-6.2,1.63-1.27,3-2.72,4.27-4.33,1.7-2.16,3.47-4.27,5.35-6.27,2.11-2.26,4.25-4.51,6.6-6.51,2.49-2.12,5.48-3.14,8.75-2.07,2.89.94,4.21,3.23,4.73,6.12.53,2.96.94,5.98,1.83,8.84,1.04,3.33,3.62,5.73,5.82,8.35,1.49,1.78,3.2,3.2,5.22,4.35,1.56.89,2.66,2.29,3.38,3.98,1.4,3.23,3.36,6.1,5.66,8.76.94,1.09,1.62,2.41,2.38,3.64.78,1.26,1.49,2.57,2.3,3.82,1.08,1.65,1.48,3.52,1.66,5.4.39,4.13.66,8.27.96,12.41.13,1.79.23,3.58.36,5.57ZM96.08,87.19c-.27-4.93-.36-8.48-.69-12.01-.38-4.01-.1-8.24-3.03-11.6-.05-.06-.05-.15-.09-.22-1.33-2.14-2.45-4.47-4.06-6.38-2.01-2.38-3.6-4.95-4.89-7.74-.9-1.94-2.23-3.43-4.19-4.35-.62-.29-1.22-.73-1.7-1.23-1.76-1.83-3.55-3.65-5.17-5.6-2.49-2.99-4.25-6.38-4.96-10.24-.37-2-.54-4.03-.91-6.02-.35-1.91-1.96-3.55-3.59-3.69-2.34-.2-4.53.23-6.26,1.96-2.85,2.85-5.68,5.72-8.48,8.62-.93.96-1.69,2.08-2.58,3.08-1.43,1.61-2.8,3.3-4.39,4.74-2.42,2.2-5.02,4.2-7.49,6.35-.57.49-1.01,1.19-1.35,1.88-1.92,3.86-3.8,7.74-5.69,11.61-.79,1.62-1.83,3.17-2.35,4.87-.78,2.58-1.17,5.27-1.78,7.9-.52,2.21-.91,4.47-1.73,6.57-1.18,3.01-2.68,5.9-4.06,8.83-.25.54-.61,1.02-.82,1.57-1.4,3.63-1.76,7.4-1.58,11.27.11,2.43.37,4.94-.08,7.29-.79,4.14,1.66,6.83,4.05,9.23,1.59,1.59,4.22,2.19,6.45,3.07,2.13.85,4.36,1.46,6.51,2.25.57.21,1.09.63,1.56,1.04.92.8,1.74,1.73,2.69,2.49,1.27,1.02,2.46,2.13,4.22,2.45,1.42.25,2.96.67,4.09,1.5,1.65,1.22,2.99,2.87,4.43,4.36.46.47.78,1.08,1.26,1.53,3.24,3.02,5.71,6.62,7.76,10.5,1.29,2.44,2.27,5.06,3.35,7.61.38.9,1,1.34,1.95,1.48,1.33.2,2.68.37,3.96.77,1.02.31,1.5.04,1.7-.91.3-1.46,1.03-2.66,2.28-3.43,1.9-1.18,3.29-2.84,4.65-4.57,2.31-2.95,3.93-6.25,5.32-9.7.78-1.94,1.5-3.95,2.61-5.7,3.31-5.19,6.77-10.28,9.13-16.01,1.33-3.23,2.82-6.41,3.13-9.94.2-2.18.17-4.38.28-6.57.18-3.42.39-6.85.51-8.9Z" />
      <path d="M57.85,43.41c3.24.39,5.8,1.3,7.64,3.29,2.68,2.91,5.24,5.98,7.49,9.24,1.29,1.87,1.85,4.24,2.73,6.38.41.99.62,2.13,1.27,2.92.77.93,1.85,1.65,2.9,2.28,2.02,1.22,3.28,3.02,3.43,5.25.22,3.36,1.2,6.45,2.29,9.59.95,2.72,1.48,5.59,2.09,8.42.64,2.95,1.16,5.93,1.7,8.9.65,3.58.52,7.05-1.02,10.48-1.36,3.02-2.41,6.18-3.52,9.31-1.76,4.98-4.15,9.59-7.47,13.74-1.14,1.43-2.08,3.08-2.81,4.76-1.23,2.82-3.59,4.05-6.25,4.96-.36.12-.81.14-1.19.05-2.14-.51-4.31-.96-5.92-2.67-3.44-3.67-6.53-7.65-8.8-12.11-2.36-4.62-5.55-8.61-8.64-12.67-1.37-1.81-3.4-3.12-5.04-4.74-2.45-2.42-4.65-5.05-5.28-8.58-.16-.88-.03-1.83.09-2.72.45-3.39,1-6.76,1.41-10.15.33-2.72.5-5.46.78-8.19.3-2.97.48-5.97,1.02-8.9.27-1.5,1.2-2.89,1.84-4.33.86-1.94,1.96-3.81,2.55-5.83,1.42-4.9,4.42-8.72,7.92-12.21,1.91-1.9,3.99-3.65,6.12-5.31.86-.67,2.05-.9,2.69-1.16ZM43.84,112.17c-.31-.89-.73-1.76-.9-2.68-.52-2.93-.96-5.88-1.4-8.83-.92-6.23-.73-12.35,1.52-18.35,1.26-3.36,2.91-6.28,5.99-8.4,3.4-2.34,6.92-4.17,11.1-4.36,2.39-.11,4.82-.17,6.95,1.18,4.55,2.9,7.84,6.85,9.19,12.12,1.66,6.48,3.01,13.06,3.15,19.77.15,7.16-.68,14.23-2.91,21.09-1.25,3.85-2.73,7.53-5.64,10.56-2.42,2.52-5.13,3.2-8.39,2.44-.34-.08-.72-.01-1.08-.01-.05.11-.1.22-.15.33.77.71,1.51,1.46,2.33,2.11,3.37,2.7,6.77,1.87,8.89-1.97,1.1-1.98,2.34-3.91,3.68-5.73,2.41-3.29,4.39-6.82,5.91-10.59,1.56-3.85,2.9-7.79,4.38-11.68.73-1.91,1.33-3.87,1.06-5.91-.48-3.62-1.05-7.24-1.72-10.83-.74-4.01-1.43-8.03-3.06-11.85-.82-1.93-1.22-4.11-1.41-6.22-.21-2.32-.89-4.08-3.04-5.27-1.16-.64-2.28-1.56-3.08-2.61-.77-1.01-1.24-2.31-1.58-3.55-.93-3.42-2.4-6.5-4.73-9.2-2.04-2.36-3.87-4.91-6.45-6.74-2.36-1.68-5.25-1.63-7.21.14-1.71,1.55-3.46,3.07-5.09,4.7-3.13,3.12-5.65,6.62-6.94,10.96-.63,2.1-1.73,4.05-2.63,6.07-.56,1.26-1.41,2.45-1.66,3.76-.47,2.46-.67,4.97-.86,7.48-.25,3.25-.18,6.51-.89,9.74-.72,3.29-1.05,6.67-1.47,10.02-.18,1.42-.08,2.79.6,4.17,1.69,3.47,4.52,5.84,7.56,8.14ZM49.45,119.37c.29-2.99.52-6.12.9-9.24.51-4.12,1.84-7.93,4.48-11.23,3.69-4.61,7.61-4.77,12.11-1.23,1.91,1.51,3.43,3.56,4.97,5.49.85,1.06,1.65,2.29,2.04,3.58.96,3.19.64,6.5.21,9.74-.52,3.93-1.23,7.84-1.86,11.76.82-1.65,1.58-3.34,2.14-5.09,1.23-3.88,1.97-7.85,2.35-11.92.45-4.82.76-9.62-.1-14.42-.75-4.15-1.41-8.31-2.27-12.44-1-4.85-3.68-8.65-7.83-11.34-.91-.59-2-1.09-3.05-1.2-4.72-.48-9.11.5-12.83,3.61-1.38,1.16-2.94,2.3-3.83,3.8-2.42,4.06-3.57,8.57-3.53,13.31.03,2.82.25,5.64.48,8.46.3,3.65.67,7.29,2.25,10.68.25.53.33,1.15.41,1.74.32,2.45,1.53,4.41,2.97,5.94ZM72.48,112.2c-.28-1.83-.14-3.86-.91-5.46-1.67-3.47-4.15-6.51-7.52-8.44-2.33-1.32-3.91-1.44-6.03.41-2.33,2.02-3.91,4.59-4.59,7.53-.72,3.13-1.21,6.34-1.43,9.54-.25,3.57.08,7.07,1.92,10.38,2.05,3.68,4.26,7.01,8.56,8.27,3.84,1.13,5.84.11,6.74-3.25,1.66-6.2,2.69-12.52,3.28-18.99Z" />
    </svg>
  )
}
