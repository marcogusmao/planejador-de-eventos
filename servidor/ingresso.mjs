// CÓPIA, com origem registrada (Marco, 05/10/2026, por questionário).
//
//   origem:  calendario, servidor/ingresso.mjs, commit c38fb0b (origin/main
//            de 22/09/2026), copiado em 05/10/2026.
//   mudou:   a frase do comentário que dizia "o calendário caiu", e (05/10/2026,
//            revisão de segurança do PR #100) `cookieDoIngresso` e `cookieDoPedido`
//            aceitam `nome`, para o servidor usar o prefixo `__Host-` na nuvem;
//            `cookieApagado` passou a montar pelo mesmo `montar` (aceita
//            `{ seguro }`), e `__Host-`/`__Secure-` levam `Secure` sempre. A
//            cifra, os prazos e os nomes de reserva são os mesmos.
//   O cookie é host-only: o `entrada` do Planejador e o do Calendário não se veem,
//   mesmo com o mesmo nome, porque moram em hosts diferentes.
//
// O INGRESSO — o cookie cifrado que prova quem entrou (decisão #46).
//
// Toma o lugar do `servidor/senha.mjs`, que guardava um HMAC da palavra
// `entrou` e não sabia dizer QUEM era. Aqui o cookie carrega e-mail, nome,
// `sub`, quando o ingresso vence e o token de renovação — por isso ele é
// CIFRADO, e não só assinado: o token de renovação vale 7 dias e não pode
// viajar legível.
//
// AES-256-GCM, chave de 32 bytes vinda do ambiente (`CHAVE_DO_COOKIE`), IV novo
// a cada gravação. O selo do GCM é o que faz um byte trocado virar "cookie
// ausente" em vez de "conteúdo diferente".
//
// ————— cookie ilegível é cookie AUSENTE —————
//
// Chave girada no Railway, cookie de uma versão anterior do formato, byte
// corrompido no caminho: tudo isso devolve `null` e a pessoa vê a tela de
// entrada. Nunca um 500. Um erro de servidor aqui transformaria "troquei a
// chave" em "o Planejador caiu", e o Marco não tem como saber a diferença
// olhando a tela.
//
// ————— por que dois cookies —————
//
//   `entrada` (7 dias) — o ingresso. Quem manda na validade é o `venceEm` de
//   dentro, não o `Max-Age`; o `Max-Age` só varre o cookie morto do navegador.
//
//   `pedido` (10 minutos) — o `state`, o `nonce`, o verificador PKCE e o
//   caminho de volta, entre o clique em "Entrar" e a volta da portaria. Apagado
//   no retorno. Sem ele não há como conferir que a volta responde ao pedido que
//   saiu daqui.

import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto'

export const NOME_DO_INGRESSO = 'entrada'
export const NOME_DO_PEDIDO = 'pedido'

export const SETE_DIAS_S = 60 * 60 * 24 * 7
export const DEZ_MINUTOS_S = 600

/** Teto prático de um cookie no navegador. Acima disso o Chrome descarta calado. */
const TETO_DO_COOKIE = 3800

const IV_BYTES = 12
const SELO_BYTES = 16

/**
 * Lê a chave do ambiente. Devolve `{ ok, chave, motivo }` — nunca estoura.
 *
 * Aceita 64 caracteres em hexadecimal ou 44 em base64/base64url; as duas formas
 * dão os mesmos 32 bytes. Qualquer outra coisa é recusada COM A RECEITA da
 * chave certa, porque "chave inválida" sem a receita manda a pessoa adivinhar.
 */
export function chaveDoCookie(texto) {
  const cru = String(texto ?? '').trim()
  if (!cru) {
    return { ok: false, chave: null, motivo: 'A chave do cookie está vazia.' }
  }
  let bytes = null
  if (/^[0-9a-fA-F]{64}$/.test(cru)) bytes = Buffer.from(cru, 'hex')
  else {
    const tentativa = Buffer.from(cru, 'base64url')
    if (tentativa.length === 32) bytes = tentativa
  }
  if (!bytes || bytes.length !== 32) {
    return {
      ok: false,
      chave: null,
      motivo:
        'A chave do cookie precisa ter 32 bytes — 64 caracteres em hexadecimal, ou 44 em base64. ' +
        'Gere uma com:  node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"',
    }
  }
  return { ok: true, chave: bytes, motivo: '' }
}

/** Cifra um objeto. O resultado é `iv.selo.conteúdo`, tudo em base64url. */
export function cifrar(objeto, chave) {
  const iv = randomBytes(IV_BYTES)
  const cifra = createCipheriv('aes-256-gcm', chave, iv)
  const conteudo = Buffer.concat([cifra.update(JSON.stringify(objeto), 'utf8'), cifra.final()])
  return [iv.toString('base64url'), cifra.getAuthTag().toString('base64url'), conteudo.toString('base64url')].join('.')
}

/** Decifra. Devolve o objeto ou `null` — ilegível é ausente, nunca erro. */
export function decifrar(texto, chave) {
  try {
    const partes = String(texto ?? '').split('.')
    if (partes.length !== 3) return null
    const iv = Buffer.from(partes[0], 'base64url')
    const selo = Buffer.from(partes[1], 'base64url')
    if (iv.length !== IV_BYTES || selo.length !== SELO_BYTES) return null
    const decifra = createDecipheriv('aes-256-gcm', chave, iv)
    decifra.setAuthTag(selo)
    const claro = Buffer.concat([decifra.update(Buffer.from(partes[2], 'base64url')), decifra.final()])
    const objeto = JSON.parse(claro.toString('utf8'))
    return objeto && typeof objeto === 'object' ? objeto : null
  } catch {
    return null
  }
}

/** Lê um cookie pelo nome no cabeçalho cru. Devolve `''` quando não há. */
export function lerCookie(headers, nome) {
  const cru = String(headers?.cookie ?? '')
  for (const parte of cru.split(';')) {
    const corte = parte.indexOf('=')
    if (corte < 0) continue
    if (parte.slice(0, corte).trim() === nome) return parte.slice(corte + 1).trim()
  }
  return ''
}

const montar = (nome, valor, { seguro, maxIdade }) => {
  const partes = [`${nome}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxIdade}`]
  // `Secure` só atrás de HTTPS: em 127.0.0.1 o Chrome descartaria o cookie e a
  // entrada certa pareceria errada. Sem `Domain` — o cookie é host-only, e é o
  // que garante que cada app da casa guarda o ingresso dele e só dele.
  //
  // Nome `__Host-`/`__Secure-` leva `Secure` SEMPRE, inclusive para APAGAR
  // (revisão de segurança do PR #100, 05/10/2026): o navegador ignora calado
  // qualquer Set-Cookie desses nomes sem `Secure`. Medido no Chromium: sem
  // isto, "Sair" respondia 200 e os dois cookies ficavam, com o JS servido.
  if (seguro || exigeSecure(nome)) partes.push('Secure')
  return partes.join('; ')
}

/** Os prefixos com que o navegador só aceita o cookie se ele vier `Secure`. */
const exigeSecure = (nome) => String(nome).startsWith('__Host-') || String(nome).startsWith('__Secure-')

/**
 * O `Set-Cookie` do ingresso.
 *
 * O `idToken` entra só SE COUBER: ele serve de `id_token_hint` na saída e é a
 * parte mais gorda do conteúdo. Cookie acima do teto é descartado pelo
 * navegador em silêncio — e cookie descartado é a pessoa não conseguindo
 * entrar, sem uma linha na tela explicando. Sem o `idToken`, a saída apaga o
 * cookie e volta para a entrada, que é o caminho previsto no contrato.
 */
export function cookieDoIngresso(dados, chave, { seguro = false, maxIdade = SETE_DIAS_S, nome = NOME_DO_INGRESSO } = {}) {
  const completo = montar(nome, cifrar(dados, chave), { seguro, maxIdade })
  if (completo.length <= TETO_DO_COOKIE || !dados.idToken) return completo
  const { idToken: _fora, ...enxuto } = dados
  return montar(nome, cifrar(enxuto, chave), { seguro, maxIdade })
}

/** O `Set-Cookie` do pedido de entrada (10 minutos). */
export function cookieDoPedido(dados, chave, { seguro = false, nome = NOME_DO_PEDIDO } = {}) {
  return montar(nome, cifrar(dados, chave), { seguro, maxIdade: DEZ_MINUTOS_S })
}

/**
 * O `Set-Cookie` que apaga um cookie deste app. Os mesmos atributos de quem o
 * gravou — com `__Host-`, `Secure` obrigatório (ver `montar`). Apagar com
 * atributo diferente é pedido que o navegador descarta sem dizer nada.
 */
export function cookieApagado(nome, { seguro = false } = {}) {
  return montar(nome, '', { seguro, maxIdade: 0 })
}
