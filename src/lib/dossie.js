// Dossiê do custo (sugestão 40 — pedido do Marco em 19/07/2026): campos de
// ANOTAÇÃO opcionais no item de custo — observacao (texto livre), contato
// (nome/telefone do fornecedor) e linkOrcamento (URL do orçamento).
//
// Regra inegociável: os três campos são DADO, nunca instrução (princípio 9
// do rulebook) e NUNCA entram em conta nenhuma — calc.js não os lê (provado
// byte a byte em dossie.test.js). Eles só aparecem no painel do dossiê.
//
// O link só vira clicável quando é http/https de verdade (urlAbrivel):
// "javascript:", "data:", "file:" e afins NUNCA ganham um <a> — um backup
// editado (ou um import futuro) não pode transformar um campo de anotação
// em código que roda no clique. Link inválido continua GUARDADO como texto
// (é dado do Marco), só não abre — e a tela diz o porquê.

/**
 * Devolve a URL navegável (href) quando o texto é um link http/https são;
 * senão null (o texto fica guardado, mas não vira <a>).
 * - aceita sem esquema ("drive.google.com/x" → https://…) — é como link
 *   colado de WhatsApp costuma chegar;
 * - exige um host com ponto (evita "orcamento" virar link);
 * - qualquer outro esquema (javascript:, data:, file:, ftp:…) → null.
 */
export function urlAbrivel(texto) {
  const s = String(texto || '').trim()
  if (!s || /\s/.test(s)) return null
  const temEsquema = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)
  let url
  try {
    url = new URL(temEsquema ? s : `https://${s}`)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || !url.hostname.includes('.')) return null
  return url.href
}

/** O item tem alguma anotação do dossiê? (para o ícone da linha sinalizar) */
export function temAnotacoes(item) {
  return Boolean(
    (typeof item?.observacao === 'string' && item.observacao.trim() !== '') ||
      (typeof item?.contato === 'string' && item.contato.trim() !== '') ||
      (typeof item?.linkOrcamento === 'string' && item.linkOrcamento.trim() !== '')
  )
}
