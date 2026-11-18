// O SERVIDOR do Planejador na nuvem. Node puro, zero dependência.
//
// ————— por que ele existe (Marco, 05/10/2026, por questionário) —————
//
// Uma cópia da TELA do Planejador é servida pelo Railway em
// https://planejador.casa.example, atrás da entrada da casa — a mesma portaria
// do Calendário (emissor https://entrar.casa.example/api/auth). Este servidor
// só serve o `dist/` a quem entrou. Ele NÃO guarda dado: os eventos continuam no
// navegador de cada pessoa (localStorage), e a ponte com o Financeiro e o backup
// diário só funcionam no app do Mac (http://localhost:4173). Recusados na mesma
// pergunta: senha única e aberto sem entrada.
//
// ————— a diferença que importa em relação ao Calendário —————
//
// No Calendário o `dist/` é servido SEM porteira, porque o dado mora atrás da
// API. Aqui o dado de negócio está DENTRO do JS: `FIXED_BENCHMARKS`
// (src/lib/benchmarks.js) leva receita, custo e lucro de quatro festas para o
// bundle (na versão pública esses valores são fictícios; a porteira continua
// valendo para quem usa o app com dados próprios). Então TODO pedido — `/`, `/index.html`, `/assets/*.js`, o
// favicon, qualquer caminho — exige ingresso válido. As únicas exceções são
// `/api/saude` (o Railway precisa saber que o processo vive) e `/api/auth/*`
// (sem elas ninguém conseguiria entrar). Sem ingresso:
//
//   navegação (Accept com text/html) → 302 para /api/auth/entrar?volta=<caminho>
//   qualquer outro pedido            → 401, sem o conteúdo
//
// Trocar a ordem — servir o estático antes da porteira — publica os números das
// quatro festas para quem tiver o endereço. Dois testes de servidor.test.mjs,
// no bloco "sem ingresso, nenhum arquivo do app sai — o JS leva os números das
// festas", existem para ficar vermelhos no dia em que isso acontecer:
// "GET /assets/<arquivo>.js pedindo HTML: 302 para a entrada, com o caminho de
// volta, e SEM o JS" e "GET /assets/<arquivo>.js sem pedir HTML (o `<script>`,
// o `curl`): 401, e SEM o JS".
//
// ————— os três modos de porta —————
//
//   `portaria`  — as cinco variáveis presentes e bem formadas. É o modo da nuvem.
//   `aberto`    — nenhuma variável, e só FORA da nuvem (HOST=127.0.0.1). Serve
//                 para conferir o build no Mac; o muro do Host continua de pé.
//   `sem-porta` — falta variável, ou alguma está torta. Tudo, menos a saúde,
//                 responde 503 NOMEANDO a variável. Na nuvem nunca se abre sem
//                 porta: "nada definido" na nuvem é `sem-porta`, não `aberto`.
//
// ————— quem é "a nuvem" —————
//
// O mesmo critério do Calendário: escutando em qualquer endereço que não seja
// 127.0.0.1 (o Dockerfile põe HOST=0.0.0.0), OU com `RAILWAY_ENVIRONMENT`
// definido — que é o carimbo que o Railway põe em todo serviço.
//
// Peças copiadas do Calendário (calendario, servidor/servidor.mjs, commit
// c38fb0b): `responder`, `responderHTML`, `paginaDeRecusa`, `conferirOrigemPublica`,
// `conferirEmissor`, `escolherModo` (sem senha), a entrada/volta da portaria, o
// muro do Host, a porteira com renovação, `servirEstatico` e a barreira do
// `createServer`. O que é deste arquivo: a porteira na frente do estático, a
// saída por navegação em `/api/auth/sair`, os cabeçalhos do estático e o muro do
// Host também no modo `aberto`.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { montarPortaria, mesmoSegredo, voltaLocal } from './portaria.mjs'
import {
  DEZ_MINUTOS_S,
  NOME_DO_INGRESSO,
  NOME_DO_PEDIDO,
  chaveDoCookie,
  cookieApagado,
  cookieDoIngresso,
  cookieDoPedido,
  decifrar,
  lerCookie,
} from './ingresso.mjs'

const AQUI = resolve(fileURLToPath(new URL('.', import.meta.url)))
const RAIZ = resolve(AQUI, '..')

// `||` e não `??`: `PORT=""` no painel viraria a porta 0, que o sistema troca por
// uma porta qualquer — o servidor subiria num lugar que ninguém procura.
const PORTA = Number(process.env.PORT || 4180)
const ENDERECO = process.env.HOST || '127.0.0.1'
const NA_NUVEM = ENDERECO !== '127.0.0.1' || Boolean(process.env.RAILWAY_ENVIRONMENT)
const PASTA_ESTATICA = resolve(RAIZ, 'dist')

/**
 * As cinco variáveis da portaria, com o nome EXATO que o Railway precisa ter.
 * A lista é a fonte da mensagem de 503: quem esquecer uma lê o nome dela.
 */
export const VARIAVEIS_DA_PORTARIA = [
  ['emissor', 'PORTARIA_EMISSOR'],
  ['clienteId', 'PORTARIA_CLIENTE_ID'],
  ['clienteSegredo', 'PORTARIA_CLIENTE_SEGREDO'],
  ['chaveDoCookie', 'CHAVE_DO_COOKIE'],
  ['origemPublica', 'ORIGEM_PUBLICA'],
]

const PORTARIA_DO_AMBIENTE = Object.fromEntries(
  VARIAVEIS_DA_PORTARIA.map(([campo, variavel]) => [campo, process.env[variavel] ?? '']),
)

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  // A Jost do app vem em .ttf (dist/assets/Jost-var-*.ttf, medido no build de 05/10/2026).
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * Os cabeçalhos de TODA resposta deste servidor.
 *
 * `no-store` (como o Calendário): o JS leva os números de fábrica das quatro
 * festas, e nenhum cache — nem o compartilhado de um proxy no caminho — pode
 * guardá-lo para entregar a quem não entrou. `nosniff`: o navegador não
 * adivinha tipo. `Cross-Origin-Resource-Policy: same-origin`: uma página de
 * fora não consegue nem embutir o JS por `<script src>` — o cookie `SameSite=Lax`
 * já não iria junto, e esta é a segunda camada. `frame-ancestors 'none'` e
 * `X-Frame-Options`: o app não abre dentro de moldura de outro site.
 */
const CABECALHOS_DA_CASA = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

/**
 * A política de conteúdo do APP servido (revisão de segurança do PR #100,
 * 05/10/2026). Script, conexão, fonte e imagem só do próprio endereço; nada de
 * `eval`, nada de script de fora; o app não abre dentro de moldura de outro
 * site. `img-src data:` cobre ícone embutido. `style-src 'unsafe-inline'` é
 * folga deixada de propósito: o fluxo medido passou SEM ela (o React escreve
 * estilo pelo CSSOM, que a política não alcança), mas Apresentação, Relatório
 * e os modais de importação não foram medidos — tirar a folga é candidato a
 * aperto, com a mesma prova antes. `connect-src 'self'` também
 * fecha, por mais uma camada, a chamada da tela a localhost:8777 — que na nuvem
 * a tela já nem tenta (src/lib/ponteOrigem.js).
 *
 * Provado num Chromium sem janela (Playwright 1.62), com o app servido por
 * este servidor no modo aberto: `node scripts/prova-csp-nuvem.mjs <endereço>`
 * — Home, festa, abas, a planilha do produtor (baixada, com o logo dentro) e o
 * CSV "Para mim" (download por `blob:`), zero `securitypolicyviolation`.
 * Controles positivos: `font-src 'none'` acusa a fonte Jost; o logo por
 * `blob:` acusa `img-src` e "0 imagens". A primeira versão da prova não baixava
 * arquivo nenhum, e por isso não viu que esta política tirava o logo da
 * planilha calada (reconferência do PR #100, 05/10/2026) — `img-src` continua
 * sem `blob:`: o logo passou a usar `data:` (src/lib/marcaPng.js).
 */
export const POLITICA_DO_APP = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const responder = (res, codigo, corpo, tipo = 'application/json; charset=utf-8', extras = {}) => {
  res.writeHead(codigo, {
    'Content-Type': tipo,
    ...CABECALHOS_DA_CASA,
    ...extras,
  })
  res.end(typeof corpo === 'string' ? corpo : JSON.stringify(corpo))
}

/**
 * Uma página HTML escrita por este servidor (recusa, 421, 503). Ela não carrega
 * script, imagem nem estilo de fora — e a política diz exatamente isso.
 */
const responderHTML = (res, codigo, html, extras = {}) =>
  responder(res, codigo, html, 'text/html; charset=utf-8', {
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    ...extras,
  })

const escaparHTML = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Os códigos de erro que uma portaria OIDC pode devolver na volta (RFC 6749
 * §4.1.2.1 e OpenID Connect Core §3.1.2.6). A página de recusa mostra o código
 * SÓ se ele estiver aqui — e nunca o `error_description`, que vem na URL e
 * qualquer pessoa escreve (revisão de segurança do PR #100, 05/10/2026): um
 * link montado à mão faria a página da casa exibir a frase de um estranho.
 */
const CODIGOS_DE_ERRO_OIDC = new Set([
  'invalid_request',
  'unauthorized_client',
  'access_denied',
  'unsupported_response_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
  'interaction_required',
  'login_required',
  'account_selection_required',
  'consent_required',
  'invalid_request_uri',
  'invalid_request_object',
  'request_not_supported',
  'request_uri_not_supported',
  'registration_not_supported',
])

/** A navegação pede HTML; o `fetch`, o `<script>` e o `curl` não. */
const querHTML = (req) => String(req.headers.accept ?? '').includes('text/html')

/**
 * A página de recusa. Frase em português e um link — nunca JSON cru nem página
 * em branco na cara de uma sócia. Sem CSS externo: tem de abrir quando nada
 * mais abre.
 */
const paginaDeRecusa = ({ titulo, frase, entrada = '/', rotulo = 'Voltar ao Planejador' }) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHTML(titulo)} — Planejador</title>
<style>
  body { background:#F8F7F3; color:#1F345F; font:16px/1.5 system-ui, sans-serif; margin:0; padding:48px 24px; }
  main { max-width:34rem; margin:0 auto; }
  h1 { font-size:1.5rem; margin:0 0 .75rem; }
  p { margin:0 0 1.25rem; }
  a { color:#1F345F; }
</style></head>
<body><main>
<h1>${escaparHTML(titulo)}</h1>
<p>${escaparHTML(frase)}</p>
<p><a href="${escaparHTML(entrada)}">${escaparHTML(rotulo)}</a></p>
</main></body></html>
`

/** Os endereços do ensaio local. Na nuvem nenhum serve: o segredo viajaria em claro. */
const ENSAIO_LOCAL = new Set(['127.0.0.1', 'localhost', '::1'])
const enderecoDeEnsaio = (u, naNuvem) =>
  !naNuvem && u.protocol === 'http:' && ENSAIO_LOCAL.has(u.hostname.replace(/^\[|\]$/g, ''))

/**
 * `ORIGEM_PUBLICA` é o endereço inteiro do app e NADA MAIS (copiado do
 * Calendário). Sem `https://` o muro do 421 sumia calado e o `redirect_uri` saía
 * relativo; barra no fim quebra o `redirect_uri` EXATO que a portaria compara.
 */
export function conferirOrigemPublica(valor, { naNuvem = true } = {}) {
  const cru = String(valor ?? '').trim()
  const receita =
    'O formato é o endereço inteiro e nada mais, como https://planejador.casa.example — ' +
    'com https://, sem barra no fim, sem caminho e sem "?".'
  let u
  try {
    u = new URL(cru)
  } catch {
    return { ok: false, motivo: `ORIGEM_PUBLICA não serve: "${cru}". ${receita}` }
  }
  if (u.protocol !== 'https:' && !enderecoDeEnsaio(u, naNuvem)) {
    return { ok: false, motivo: `ORIGEM_PUBLICA precisa começar com https://, e está "${cru}". ${receita}` }
  }
  if (cru !== u.origin) {
    return { ok: false, motivo: `ORIGEM_PUBLICA tem coisa a mais: "${cru}". ${receita}` }
  }
  return { ok: true, motivo: '' }
}

/** `PORTARIA_EMISSOR`: endereço inteiro, com caminho, `https://` na nuvem (copiado do Calendário). */
export function conferirEmissor(valor, { naNuvem = true } = {}) {
  const cru = String(valor ?? '').trim()
  const receita = 'O formato é https://entrar.casa.example/api/auth — endereço inteiro, com https://.'
  let u
  try {
    u = new URL(cru)
  } catch {
    return { ok: false, motivo: `PORTARIA_EMISSOR não serve: "${cru}". ${receita}` }
  }
  if (u.protocol !== 'https:' && !enderecoDeEnsaio(u, naNuvem)) {
    return { ok: false, motivo: `PORTARIA_EMISSOR precisa começar com https://, e está "${cru}". ${receita}` }
  }
  if (u.search || u.hash) {
    return { ok: false, motivo: `PORTARIA_EMISSOR tem coisa a mais: "${cru}". ${receita}` }
  }
  return { ok: true, motivo: '' }
}

/**
 * Qual porta este processo tem? Devolve `{ modo, motivo, chave }`.
 *
 * Copiado do Calendário sem o modo `legado` (a senha única foi recusada pelo
 * Marco para o Planejador). `motivo` NOMEIA a variável que falta — é essa frase
 * que sai no 503.
 */
export function escolherModo({ portaria = {}, naNuvem = false } = {}) {
  const presentes = VARIAVEIS_DA_PORTARIA.filter(([campo]) => String(portaria[campo] ?? '').trim() !== '')
  const faltando = VARIAVEIS_DA_PORTARIA.filter(([campo]) => String(portaria[campo] ?? '').trim() === '')

  if (presentes.length === 0) {
    if (!naNuvem) return { modo: 'aberto', motivo: '', chave: null }
    return {
      modo: 'sem-porta',
      chave: null,
      motivo:
        'A entrada do Planejador ainda não foi configurada no Railway. Defina as cinco variáveis da portaria no ' +
        `painel do serviço: ${VARIAVEIS_DA_PORTARIA.map(([, v]) => v).join(', ')}. Enquanto isso o Planejador fica fechado.`,
    }
  }

  if (faltando.length) {
    return {
      modo: 'sem-porta',
      chave: null,
      motivo: `A entrada pela conta da casa está pela metade: falta ${faltando
        .map(([, v]) => v)
        .join(', ')} no painel do Railway. Enquanto isso o Planejador fica fechado.`,
    }
  }

  for (const conferir of [
    () => conferirEmissor(portaria.emissor, { naNuvem }),
    () => conferirOrigemPublica(portaria.origemPublica, { naNuvem }),
  ]) {
    const c = conferir()
    if (!c.ok) return { modo: 'sem-porta', chave: null, motivo: c.motivo }
  }

  const { ok, chave, motivo } = chaveDoCookie(portaria.chaveDoCookie)
  if (!ok) return { modo: 'sem-porta', chave: null, motivo: `CHAVE_DO_COOKIE não serve. ${motivo}` }
  return { modo: 'portaria', motivo: '', chave }
}

/**
 * Serve um arquivo do `dist/`. Copiado do Calendário, com duas recusas a mais.
 *
 * SÓ É CHAMADO DEPOIS DA PORTEIRA. Quem chamar isto antes dela publica o JS —
 * e, com ele, os números de fábrica das quatro festas.
 */
async function servirEstatico(req, res, caminhoURL, pastaEstatica, extras = {}) {
  const recusar = (frase) =>
    responderHTML(
      res,
      400,
      paginaDeRecusa({ titulo: 'Esse endereço não dá para ler', frase }),
      extras,
    )
  let decodificado
  try {
    decodificado = decodeURIComponent(caminhoURL)
  } catch {
    // `decodeURIComponent` LANÇA diante de `%` que não forma caractere (`/%`,
    // `/a%ZZ`). No Calendário, até 17/09/2026, esse lance encerrava o processo.
    return recusar(
      'O endereço tem um "%" que não forma um caractere, e eu não consigo adivinhar o que ele queria dizer. ' +
        'Nada foi aberto. Volte à página inicial do Planejador.',
    )
  }
  // `..` escondido em `%2f` (`/..%2fsegredo`) só aparece DEPOIS de decodificar —
  // o `URL` já tinha resolvido os `..` visíveis. Caractere nulo nunca é nome de
  // arquivo de verdade. Os dois são recusados com frase, em vez de virarem
  // "arquivo não achado".
  if (decodificado.includes('\0') || decodificado.split(/[/\\]/).includes('..')) {
    return recusar('O endereço tenta sair da pasta do app. Nada foi aberto. Volte à página inicial do Planejador.')
  }
  const limpo = normalize(decodificado).replace(/^(\.\.[/\\])+/, '')
  let alvo = join(pastaEstatica, limpo === '/' ? 'index.html' : limpo)
  // Com o separador: sem ele, uma pasta irmã chamada `dist-velho` passaria por
  // "começa com dist".
  if (alvo !== pastaEstatica && !alvo.startsWith(pastaEstatica + sep)) {
    return recusar('O endereço tenta sair da pasta do app. Nada foi aberto. Volte à página inicial do Planejador.')
  }

  try {
    const s = await stat(alvo)
    if (s.isDirectory()) alvo = join(alvo, 'index.html')
  } catch {
    // Rota do app que não é arquivo cai no index.html.
    alvo = join(pastaEstatica, 'index.html')
  }
  try {
    const conteudo = await readFile(alvo)
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream',
      ...CABECALHOS_DA_CASA,
      'Content-Security-Policy': POLITICA_DO_APP,
      ...extras,
    })
    res.end(conteudo)
  } catch {
    responder(
      res,
      404,
      'O app ainda não foi construído. Rode `npm run build` antes de subir o servidor.',
      'text/plain; charset=utf-8',
      extras,
    )
  }
}

export function montarServidor({
  porta = PORTA,
  naNuvem = NA_NUVEM,
  pastaEstatica = PASTA_ESTATICA,
  // As cinco variáveis da portaria. O teste passa um emissor falso aqui.
  portaria = PORTARIA_DO_AMBIENTE,
  // O `fetch` que fala com a portaria. Injetável: o teste gera um par Ed25519 e
  // assina ingressos de verdade, para a conferência ser exercitada e não fingida.
  buscarNaPortaria = fetch,
  esperaNaPortariaMs = undefined,
} = {}) {
  const pasta = resolve(pastaEstatica)
  const escolha = escolherModo({ portaria, naNuvem })
  const MODO = escolha.modo
  const CHAVE = escolha.chave
  const cliente =
    MODO === 'portaria'
      ? montarPortaria({
          emissor: portaria.emissor,
          clienteId: portaria.clienteId,
          clienteSegredo: portaria.clienteSegredo,
          origemPublica: portaria.origemPublica,
          buscar: buscarNaPortaria,
          esperaMs: esperaNaPortariaMs,
        })
      : null

  /**
   * Os `Host` que este processo atende.
   *
   * `portaria`: só o de `ORIGEM_PUBLICA`. O `*.up.railway.app` que o Railway dá a
   * todo serviço seria uma SEGUNDA PORTA — o cookie é host-only e o
   * `redirect_uri` registrado é o do domínio canônico.
   *
   * `aberto`: só 127.0.0.1 e localhost na porta deste processo. É a defesa
   * contra o site de fora que aponta o próprio nome para 127.0.0.1 (DNS
   * rebinding) e lê o JS de quem está testando no Mac.
   */
  const hostsAceitos = (() => {
    if (MODO === 'portaria') {
      try {
        return new Set([new URL(portaria.origemPublica).host.toLowerCase()])
      } catch {
        return new Set()
      }
    }
    if (MODO === 'aberto') return new Set([`127.0.0.1:${porta}`, `localhost:${porta}`])
    return null
  })()
  const enderecoDaCasa = MODO === 'portaria' ? portaria.origemPublica : `http://127.0.0.1:${porta}`

  /** Uma página de recusa com o link certo para este modo. */
  const paginaDaCasa = ({ titulo, frase, voltaPara = '/' }) =>
    MODO === 'portaria'
      ? paginaDeRecusa({
          titulo,
          frase,
          entrada: `/api/auth/entrar?volta=${encodeURIComponent(voltaPara)}`,
          rotulo: 'Tentar de novo',
        })
      : paginaDeRecusa({ titulo, frase })

  // ————— os nomes dos cookies, e de qual app eles são —————
  //
  // Na nuvem os dois cookies levam o prefixo `__Host-` (revisão de segurança
  // do PR #100, 05/10/2026). Com ele o navegador só aceita o cookie se vier com
  // `Secure`, `Path=/` e SEM `Domain` — e é isso que impede um app irmão em
  // outro subdomínio da casa de plantar aqui um cookie `entrada` com
  // `Domain=casa.example`. Fora da nuvem (127.0.0.1, sem HTTPS) o prefixo
  // faria o navegador recusar o cookie, então os nomes ficam os de sempre.
  //
  // E o conteúdo cifrado diz DE QUAL APP ele é (`app: <client_id>`): um cookie
  // cifrado com a mesma chave por outro app da casa — chave copiada de um
  // painel para outro — é tratado como ausente.
  const PREFIXO_DO_COOKIE = naNuvem ? '__Host-' : ''
  const COOKIE_DO_INGRESSO = `${PREFIXO_DO_COOKIE}${NOME_DO_INGRESSO}`
  const COOKIE_DO_PEDIDO = `${PREFIXO_DO_COOKIE}${NOME_DO_PEDIDO}`
  const APP = String(portaria.clienteId ?? '')

  // NA NUVEM o cookie é SEMPRE `Secure` (o `x-forwarded-proto` quem escreve é
  // quem pede). No Mac ele fica sem `Secure`, senão o Chrome o descarta em
  // 127.0.0.1 e a entrada certa parece errada.
  const seguro = (req) => naNuvem || String(req.headers['x-forwarded-proto'] ?? '').toLowerCase() === 'https'

  /** O ingresso guardado no cookie, ou `null`. Ilegível é ausente. */
  const ingressoDe = (req) => {
    const bruto = lerCookie(req.headers, COOKIE_DO_INGRESSO)
    if (!bruto) return null
    const d = decifrar(bruto, CHAVE)
    if (!d || typeof d.venceEm !== 'number' || !d.email) return null
    // De outro app da casa (ou de antes deste campo existir): ausente.
    if (d.app !== APP) return null
    return d
  }

  /** O que vai para dentro do cookie depois de um ingresso conferido. */
  const doIngresso = (claims, tokens) => ({
    app: APP,
    email: String(claims.email).toLowerCase(),
    nome: claims.name ?? '',
    sub: claims.sub ?? '',
    sid: claims.sid ?? '',
    venceEm: claims.exp * 1000,
    renovacao: tokens.refresh_token ?? '',
    idToken: tokens.id_token,
  })

  /** Uma linha de log por recusa, queda ou erro de configuração. Nunca o segredo. */
  const registrarDaPortaria = (onde, e) =>
    console.error(
      `portaria (${onde}): ${e.configuracao ? 'configuração' : e.foraDoAr ? 'queda' : 'recusa'}` +
        `${e.codigo ? ` [${e.codigo}]` : ''} — ${e.message}`,
    )

  /**
   * A PORTEIRA. Devolve uma de quatro coisas:
   *
   *   `{}`                       — modo aberto: passa.
   *   `{ ingresso, cookie? }`    — entrou. `cookie` é a renovação de 15 minutos,
   *                                e TEM de sair na mesma resposta.
   *   `{ falta, cookie? }`       — não entrou (ou a entrada não vale mais).
   *   `{ queda: [corpo] }`       — a portaria não respondeu, ou o painel está
   *                                errado. 503, e o cookie FICA: ninguém perde a
   *                                vez por uma interrupção de um minuto.
   */
  const porteira = async (req) => {
    if (MODO === 'aberto') return {}

    const guardado = ingressoDe(req)
    if (!guardado) return { falta: 'Entre com a conta da casa.' }
    if (guardado.venceEm > Date.now()) return { ingresso: guardado }

    if (!guardado.renovacao) {
      return { falta: 'Sua entrada venceu. Entre de novo com a conta da casa.', cookie: cookieApagado(COOKIE_DO_INGRESSO, { seguro: seguro(req) }) }
    }
    try {
      const tokens = await cliente.renovar(guardado.renovacao)
      // Quem volta tem de ser a MESMA pessoa que entrou.
      const claims = await cliente.conferirIngresso(tokens.id_token, { sub: guardado.sub || null })
      const novo = doIngresso(claims, tokens)
      return { ingresso: novo, cookie: cookieDoIngresso(novo, CHAVE, { seguro: seguro(req), nome: COOKIE_DO_INGRESSO }) }
    } catch (e) {
      registrarDaPortaria('renovação', e)
      if (e.configuracao) {
        return {
          queda: {
            titulo: 'A entrada da casa está mal configurada',
            erro: `Não consegui renovar a sua entrada: ${e.message}.`,
            erroDeConfiguracao: true,
          },
        }
      }
      if (e.foraDoAr) {
        return {
          queda: {
            titulo: 'A portaria da casa não respondeu',
            erro: `A portaria da casa não respondeu agora. Nada foi perdido — tente de novo em instantes. (${e.message})`,
            portariaForaDoAr: true,
          },
        }
      }
      return {
        falta:
          'Sua entrada não vale mais. Entre de novo com a conta da casa — se não entrar, peça a um administrador ' +
          'para conferir o seu e-mail na área Equipe, no Propostas.',
        cookie: cookieApagado(COOKIE_DO_INGRESSO, { seguro: seguro(req) }),
      }
    }
  }

  /** O caminho de volta depois de entrar: o que a pessoa pediu, se for daqui. */
  const voltaDe = (url) => {
    const pedido = `${url.pathname}${url.search}`
    return voltaLocal(pedido) ? pedido : '/'
  }

  /**
   * A BARREIRA (do Calendário, 17/09/2026). Tudo o que atende pedido mora em
   * `atender`; o handler do `createServer` só o segura. Um lance inesperado vira
   * uma linha no log e um 500 com frase — nunca o fim do processo.
   */
  const atender = async (req, res) => {
    const url = new URL(req.url, 'http://planejador.invalido')

    // HSTS na nuvem (revisão de segurança do PR #100, 05/10/2026): depois da
    // primeira visita por HTTPS, o navegador nunca mais tenta este endereço em
    // HTTP — o cookie e o JS não viajam em claro nem num link velho com
    // `http://`. Só na nuvem: no Mac o servidor é HTTP de propósito.
    if (naNuvem) res.setHeader('Strict-Transport-Security', 'max-age=31536000')

    // ————— (a) SAÚDE — antes de tudo, em qualquer Host, sem cookie —————
    //
    // O healthcheck do Railway bate no endereço interno, que não é o domínio
    // público: um 421 aqui derrubaria o processo a cada deploy. Não diz nada
    // além de "estou de pé, neste modo" — nenhum dado, nenhum nome de festa.
    if (url.pathname === '/api/saude') {
      return responder(res, 200, { ok: true, nuvem: naNuvem, modo: MODO })
    }

    // ————— (b) O MURO DO HOST —————
    if (hostsAceitos && !hostsAceitos.has(String(req.headers.host ?? '').toLowerCase())) {
      const frase = `O Planejador atende só em ${enderecoDaCasa}. Este endereço não serve — abra o link da casa.`
      if (querHTML(req)) {
        return responderHTML(
          res,
          421,
          paginaDeRecusa({
            titulo: 'Este não é o endereço do Planejador',
            frase,
            entrada: enderecoDaCasa,
            rotulo: 'Ir para o Planejador da casa',
          }),
        )
      }
      return responder(res, 421, { erro: frase })
    }

    // ————— SEM PORTA: tudo fechado, e a frase nomeia a variável —————
    if (MODO === 'sem-porta') {
      if (querHTML(req)) {
        return responderHTML(
          res,
          503,
          paginaDeRecusa({ titulo: 'O Planejador está fechado', frase: escolha.motivo, rotulo: 'Tentar de novo' }),
        )
      }
      return responder(res, 503, { erro: escolha.motivo, faltaVariavel: true })
    }

    // ————— (c) A ENTRADA PELA PORTARIA —————
    if (url.pathname.startsWith('/api/auth/')) {
      const rota = url.pathname
      if (rota !== '/api/auth/entrar' && rota !== '/api/auth/retorno' && rota !== '/api/auth/sair') {
        return responder(res, 404, { erro: 'Não existe isto na entrada.' })
      }
      if (MODO !== 'portaria') {
        return responderHTML(
          res,
          404,
          paginaDaCasa({
            titulo: 'Esta entrada não existe aqui',
            frase: 'Este Planejador está no modo de teste do Mac, sem a entrada pela conta da casa.',
          }),
        )
      }

      if (rota === '/api/auth/sair') return sair(req, res)

      if (req.method !== 'GET') return responder(res, 405, { erro: `Método ${req.method} não serve aqui.` })

      if (rota === '/api/auth/entrar') {
        const volta = url.searchParams.get('volta') ?? '/'
        if (!voltaLocal(volta)) {
          return responderHTML(
            res,
            400,
            paginaDaCasa({
              titulo: 'Esse caminho de volta não é deste Planejador',
              // O caminho pedido NÃO é repetido na página: ele vem da URL, e
              // repeti-lo deixaria um link de fora escrever na tela da casa.
              frase:
                'Depois de entrar eu só sei voltar para uma página deste Planejador, e o caminho pedido não é uma. ' +
                'Tente de novo pela página inicial.',
            }),
          )
        }
        try {
          const { endereco: paraOnde, pedido } = await cliente.pedidoDeEntrada({ volta })
          return responder(res, 302, '', 'text/html; charset=utf-8', {
            Location: paraOnde,
            'Set-Cookie': cookieDoPedido({ ...pedido, app: APP }, CHAVE, { seguro: seguro(req), nome: COOKIE_DO_PEDIDO }),
          })
        } catch (e) {
          registrarDaPortaria('pedido de entrada', e)
          return responderHTML(
            res,
            e.foraDoAr ? 503 : 500,
            paginaDaCasa({
              titulo: 'A portaria da casa não respondeu',
              frase: `Não consegui abrir a entrada agora: ${e.message}`,
              voltaPara: volta,
            }),
          )
        }
      }

      // ————— A VOLTA DA PORTARIA —————
      const recusar = (titulo, frase, voltaPara = '/') =>
        responderHTML(res, 400, paginaDaCasa({ titulo, frase, voltaPara }), {
          'Set-Cookie': cookieApagado(COOKIE_DO_PEDIDO, { seguro: seguro(req) }),
        })

      const pedido = decifrar(lerCookie(req.headers, COOKIE_DO_PEDIDO), CHAVE)
      // Os TRÊS segredos ou nenhum: sem `nonce` não há como amarrar o ingresso a
      // este pedido, e sem `verificador` não há PKCE. E o pedido tem de ser
      // DESTE app — o de outro app da casa é tratado como ausente.
      if (!pedido?.estado || !pedido?.nonce || !pedido?.verificador || pedido.app !== APP) {
        return recusar(
          'Não encontrei o pedido de entrada',
          'A entrada demorou mais de 10 minutos, ou este navegador apagou o cookie do pedido. Comece de novo.',
        )
      }
      // O prazo é conferido AQUI também: quem guarda o cookie é o navegador.
      if (!Number.isFinite(pedido.criadoEm) || Date.now() - pedido.criadoEm > DEZ_MINUTOS_S * 1000) {
        return recusar(
          'Esse pedido de entrada já passou do prazo',
          'A entrada demorou mais de 10 minutos. Nada foi aceito — comece de novo pela página inicial.',
        )
      }
      const voltaPara = voltaLocal(pedido.volta) ? pedido.volta : '/'

      const erroDaPortaria = url.searchParams.get('error')
      if (erroDaPortaria) {
        // Texto FIXO, em português. Do que veio na URL, só o código — e só se
        // for um código do OIDC. O `error_description` nunca aparece.
        const codigo = CODIGOS_DE_ERRO_OIDC.has(erroDaPortaria) ? erroDaPortaria : ''
        console.error(`portaria (volta da portaria): recusa [${codigo || 'código fora do OIDC'}]`)
        return recusar(
          'A portaria não deixou entrar',
          `A portaria da casa não deixou entrar${codigo ? ` (código ${codigo})` : ''}. ` +
            'Só entra quem está ativo na área Equipe, no Propostas: se o seu e-mail ainda não está lá, ' +
            'peça a um administrador para cadastrá-lo.',
          voltaPara,
        )
      }
      if (!mesmoSegredo(url.searchParams.get('state'), pedido.estado)) {
        return recusar(
          'Essa volta não responde ao pedido que saiu daqui',
          'O código de conferência (state) não bate. Por segurança nada foi aceito — comece a entrada de novo.',
          voltaPara,
        )
      }
      const codigo = url.searchParams.get('code')
      if (!codigo) {
        return recusar('A portaria voltou sem código', 'Nada foi aceito. Comece a entrada de novo.', voltaPara)
      }

      try {
        const tokens = await cliente.trocarCodigo({ codigo, verificador: pedido.verificador })
        const claims = await cliente.conferirIngresso(tokens.id_token, { nonce: pedido.nonce })
        return responder(res, 302, '', 'text/html; charset=utf-8', {
          Location: voltaPara,
          'Set-Cookie': [
            cookieDoIngresso(doIngresso(claims, tokens), CHAVE, { seguro: seguro(req), nome: COOKIE_DO_INGRESSO }),
            cookieApagado(COOKIE_DO_PEDIDO, { seguro: seguro(req) }),
          ],
        })
      } catch (e) {
        registrarDaPortaria('volta da portaria', e)
        if (e.foraDoAr || e.configuracao) {
          return responderHTML(
            res,
            503,
            paginaDaCasa({
              titulo: e.configuracao ? 'A entrada da casa está mal configurada' : 'A portaria da casa não respondeu',
              frase: `Não consegui terminar a entrada agora: ${e.message}`,
              voltaPara,
            }),
            { 'Set-Cookie': cookieApagado(COOKIE_DO_PEDIDO, { seguro: seguro(req) }) },
          )
        }
        return recusar(
          'Não consegui aceitar esta entrada',
          `${e.message} Se isso continuar, peça a um administrador para conferir o seu e-mail na área Equipe, no Propostas.`,
          voltaPara,
        )
      }
    }

    // ————— (d) A PORTEIRA, na frente de TODO o resto —————
    const p = await porteira(req)
    const comCookie = (extras = {}) => (p.cookie ? { ...extras, 'Set-Cookie': p.cookie } : extras)

    if (p.queda) {
      // Sem `Set-Cookie`: a entrada de quem já entrou não tem defeito nenhum.
      const { titulo, ...corpo } = p.queda
      if (querHTML(req)) {
        return responderHTML(res, 503, paginaDaCasa({ titulo, frase: corpo.erro, voltaPara: voltaDe(url) }))
      }
      return responder(res, 503, corpo)
    }
    if (p.falta) {
      if (querHTML(req)) {
        return responder(res, 302, '', 'text/html; charset=utf-8', comCookie({
          Location: `/api/auth/entrar?volta=${encodeURIComponent(voltaDe(url))}`,
        }))
      }
      return responder(res, 401, { erro: p.falta, precisaEntrar: true }, undefined, comCookie())
    }

    if (url.pathname.startsWith('/api/')) {
      return responder(res, 404, { erro: 'Não existe isto aqui.' }, undefined, comCookie())
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return responder(res, 405, { erro: `Método ${req.method} não serve aqui.` }, undefined, comCookie({ Allow: 'GET, HEAD' }))
    }
    // ————— (e) O ESTÁTICO — só aqui, depois da porteira —————
    return servirEstatico(req, res, url.pathname, pasta, comCookie())
  }

  /**
   * A SAÍDA. GET (um link, uma navegação) ou POST (um `fetch`).
   *
   * Os dois cookies daqui — o ingresso e um pedido de entrada que tenha
   * sobrado — são apagados NESTA resposta, com os mesmos atributos com que
   * foram gravados: num `__Host-`, o apagar sem `Secure` é ignorado calado pelo
   * navegador, e foi assim que "Sair" respondia 200 sem tirar ninguém
   * (medido no Chromium, revisão do PR #100, 05/10/2026). Depois a pessoa vai
   * para a saída da portaria, com o `id_token_hint` quando o ingresso guardado
   * é do emissor configurado.
   * Se a portaria não responder, a volta é a própria página: a saída daqui já
   * aconteceu, e travá-la por falta de rede deixaria a pessoa dentro.
   *
   * Pedido vindo de OUTRO site não sai ninguém: `Sec-Fetch-Site: cross-site` ou
   * um `Origin` de fora recebem 403. Sem isto, qualquer página da internet
   * poderia pôr a sócia para fora da casa inteira com um link. `same-site`
   * também é recusado (revisão de segurança do PR #100, 05/10/2026): é o que
   * chega de um subdomínio IRMÃO (outro app em *.casa.example), e um app
   * irmão não tem por que tirar ninguém daqui.
   */
  async function sair(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return responder(res, 405, { erro: `Método ${req.method} não serve aqui.` })
    }
    const origem = req.headers.origin
    let origemDeFora = false
    if (origem != null && origem !== '') {
      try {
        origemDeFora = new URL(origem).host.toLowerCase() !== String(req.headers.host ?? '').toLowerCase()
      } catch {
        origemDeFora = true
      }
    }
    const deOndeVeio = String(req.headers['sec-fetch-site'] ?? '')
    if (deOndeVeio === 'cross-site' || deOndeVeio === 'same-site' || origemDeFora) {
      const frase = 'Este pedido de saída veio de outro site. Por segurança ninguém saiu.'
      return querHTML(req)
        ? responderHTML(res, 403, paginaDaCasa({ titulo: 'Saída recusada', frase }))
        : responder(res, 403, { erro: frase })
    }
    const guardado = ingressoDe(req)
    let paraOnde = '/'
    try {
      paraOnde = await cliente.enderecoDeSaida({ idToken: guardado?.idToken })
    } catch {
      paraOnde = '/'
    }
    const apagado = {
      'Set-Cookie': [
        cookieApagado(COOKIE_DO_INGRESSO, { seguro: seguro(req) }),
        cookieApagado(COOKIE_DO_PEDIDO, { seguro: seguro(req) }),
      ],
    }
    if (req.method === 'POST') return responder(res, 200, { ok: true, endereco: paraOnde }, undefined, apagado)
    return responder(res, 302, '', 'text/html; charset=utf-8', { ...apagado, Location: paraOnde })
  }

  const servidor = createServer(async (req, res) => {
    try {
      await atender(req, res)
    } catch (e) {
      console.error(`erro não previsto em ${req.method} ${req.url}: ${e?.stack ?? e}`)
      if (res.headersSent) {
        res.end()
        return
      }
      responder(res, 500, {
        erro: 'Alguma coisa deu errado aqui dentro e o pedido não foi atendido. Os seus dados continuam no seu navegador.',
      })
    }
  })
  servidor.modo = MODO
  return servidor
}

// Só sobe quando este arquivo É o programa — importar para teste não abre porta.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const servidor = montarServidor()
  const escolha = escolherModo({ portaria: PORTARIA_DO_AMBIENTE, naNuvem: NA_NUVEM })
  servidor.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(
        `\n  A porta ${PORTA} já está ocupada.\n\n` +
          '  O Planejador NÃO subiu — de propósito: escolher outra porta sozinho abriria\n' +
          '  o app num endereço que ninguém está olhando.\n\n' +
          `  Veja quem está lá com:  lsof -nP -iTCP:${PORTA} -sTCP:LISTEN\n`,
      )
      process.exit(1)
    }
    throw e
  })
  servidor.listen(PORTA, ENDERECO, () => {
    if (NA_NUVEM) {
      console.log(`\n  Planejador NA NUVEM, escutando em ${ENDERECO}:${PORTA}`)
      if (escolha.modo === 'portaria') {
        console.log(`  Entrada: conta da casa, pela portaria ${PORTARIA_DO_AMBIENTE.emissor}`)
        console.log(`  Endereço canônico: ${PORTARIA_DO_AMBIENTE.origemPublica}\n`)
      } else {
        console.log(`  ATENÇÃO: tudo responde 503 até isto ser resolvido — ${escolha.motivo}\n`)
      }
    } else {
      console.log(`\n  Planejador (servidor da nuvem, rodando no Mac) em  http://127.0.0.1:${PORTA}`)
      console.log(`  Modo de entrada: ${escolha.modo}`)
      console.log('  Os eventos deste endereço são OUTROS: o navegador guarda os dados separados por endereço.\n')
    }
  })
}
