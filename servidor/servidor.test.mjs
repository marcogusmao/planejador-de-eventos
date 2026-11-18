// O SERVIDOR DO PLANEJADOR NA NUVEM — o que ele recusa e o que ele deixa passar
// (Marco, 05/10/2026, por questionário: a tela sobe para o Railway atrás da
// entrada da casa; recusados senha única e aberto sem entrada).
//
// Cada teste sobe um servidor de verdade numa porta livre e fala com ele por
// HTTP cru — o mesmo caminho do navegador e do Railway. O `dist/` é FALSO, num
// diretório temporário: um `index.html` e um `assets/index-TESTE.js` com uma
// marca reconhecível. Assim a bateria não depende de `npm run build`, e a
// pergunta "o JS saiu?" se responde procurando a marca no corpo.
//
// O emissor falso Ed25519 foi adaptado de calendario,
// servidor/servidor.test.mjs (commit c38fb0b): par de chaves gerado na hora,
// chaves públicas em `/jwks` e ingressos ASSINADOS DE VERDADE — um emissor que
// devolvesse JSON sem assinar provaria só que o código lê JSON.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServer, request } from 'node:http'
import { generateKeyPairSync, sign as assinarBytes } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { escolherModo, montarServidor, conferirOrigemPublica, POLITICA_DO_APP } from './servidor.mjs'
import {
  NOME_DO_INGRESSO as INGRESSO_SEM_PREFIXO,
  NOME_DO_PEDIDO as PEDIDO_SEM_PREFIXO,
  chaveDoCookie,
  cifrar,
  cookieDoIngresso,
  decifrar,
} from './ingresso.mjs'
import { desafioS256 } from './portaria.mjs'

// A marca do JS falso imita o que o bundle de verdade carrega: os números de
// fábrica de uma festa. Se ela aparecer num corpo de resposta sem ingresso, o
// número vazou.
const MARCA_DO_JS = 'FIXED_BENCHMARKS:{nome:"Festa do Cordel",receita:118740}'
const MARCA_DO_INDEX = '<div id="root">PLANEJADOR-INDEX</div>'
const SEGREDO_FORA = 'ARQUIVO-FORA-DO-DIST-NAO-PODE-SAIR'
const JS = '/assets/index-TESTE.js'

let raiz
let dist
let servidor
let base

/**
 * Um pedido HTTP cru. O `fetch` do Node DESCARTA o cabeçalho `Host`, e é o `Host`
 * que simula o proxy do Railway. O caminho vai CRU também (`path`), para `/../` e
 * `%2e%2e` chegarem ao servidor como um robô os mandaria.
 */
/**
 * Todo Set-Cookie de nome `__Host-` que não tenha `Secure`, `Path=/` e nenhum
 * `Domain` — inclusive o que APAGA. O navegador IGNORA calado um Set-Cookie
 * desses sem os três, e foi assim que "Sair" respondia 200 sem tirar ninguém
 * (revisão de segurança do PR #100, medido no Chromium em 05/10/2026). Os 59
 * testes de antes passavam com e sem o defeito: nenhum olhava o cookie que
 * apaga. Agora `pedir` confere TODA resposta da bateria.
 */
const cookiesHostTortos = (cookies) =>
  cookies.filter((c) => {
    if (!c.startsWith('__Host-')) return false
    const atributos = c.split(';').slice(1).map((a) => a.trim().toLowerCase())
    return !atributos.includes('secure') || !atributos.includes('path=/') || atributos.some((a) => a.startsWith('domain='))
  })
let cookiesHostConferidos = 0

const pedir = async (caminho, opcoes) => {
  const r = await pedirCru(caminho, opcoes)
  cookiesHostConferidos += r.cookies.filter((c) => c.startsWith('__Host-')).length
  expect(cookiesHostTortos(r.cookies), `Set-Cookie __Host- sem Secure/Path=/ ou com Domain em ${caminho}`).toEqual([])
  return r
}

const pedirCru = (caminho, { method = 'GET', headers = {} } = {}) =>
  new Promise((resolvido, rejeitado) => {
    const u = new URL(base)
    const req = request({ hostname: u.hostname, port: u.port, path: caminho, method, headers }, (res) => {
      let texto = ''
      res.setEncoding('utf8')
      res.on('data', (parte) => (texto += parte))
      res.on('end', () =>
        resolvido({
          status: res.statusCode,
          headers: {
            get: (nome) => {
              const v = res.headers[nome.toLowerCase()]
              return v == null ? null : Array.isArray(v) ? v.join('; ') : v
            },
          },
          cookies: [].concat(res.headers['set-cookie'] ?? []),
          texto,
          json: () => JSON.parse(texto),
        }),
      )
    })
    req.on('error', rejeitado)
    req.end()
  })

/** Uma porta livre de verdade: abre, lê, fecha. */
const portaLivre = () =>
  new Promise((resolvido) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolvido(port))
    })
  })

const subir = async (opcoes = {}) => {
  const porta = await portaLivre()
  // `portaria: {}` por padrão: sem isto o servidor leria as variáveis de quem
  // roda o teste, e uma ORIGEM_PUBLICA esquecida na máquina mudaria o modo.
  servidor = montarServidor({ pastaEstatica: dist, porta, portaria: {}, naNuvem: false, ...opcoes })
  await new Promise((resolvido) => servidor.listen(porta, '127.0.0.1', resolvido))
  base = `http://127.0.0.1:${porta}`
  return { porta }
}

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'planejador-nuvem-'))
  dist = join(raiz, 'dist')
  await mkdir(join(dist, 'assets'), { recursive: true })
  await writeFile(join(dist, 'index.html'), `<!doctype html><html><body>${MARCA_DO_INDEX}</body></html>`, 'utf8')
  await writeFile(join(dist, 'assets', 'index-TESTE.js'), `export const x={${MARCA_DO_JS}}`, 'utf8')
  await writeFile(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8')
  // Irmão do dist/: o que a travessia tentaria ler.
  await writeFile(join(raiz, 'segredo.txt'), SEGREDO_FORA, 'utf8')
})
afterEach(async () => {
  if (servidor) await new Promise((r) => servidor.close(r))
  servidor = null
  await rm(raiz, { recursive: true, force: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// O emissor falso (adaptado do Calendário, c38fb0b)
// ═══════════════════════════════════════════════════════════════════════════

const EMISSOR = 'https://entrar.casa.example/api/auth'
const CLIENTE_ID = 'planejador-da-casa'
const CLIENTE_SEGREDO = 'segredo-do-cliente-que-nunca-pode-vazar'
const ORIGEM_PUBLICA = 'https://planejador.casa.example'
const CHAVE_DO_COOKIE = '4a'.repeat(32)
const HOST_DA_CASA = 'planejador.casa.example'
const RETORNO = `${ORIGEM_PUBLICA}/api/auth/retorno`
const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

const casa = (extras = {}) => ({ host: HOST_DA_CASA, ...extras })
const b64url = (dados) => Buffer.from(dados).toString('base64url')
const emSegundos = (deslocamento = 0) => Math.floor(Date.now() / 1000) + deslocamento
const respostaFalsa = (status, corpo) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo })

function emissorFalso({ kid = 'chave-de-outubro' } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'EdDSA', use: 'sig' }

  const estado = {
    trocas: 0,
    renovacoes: 0,
    emitidos: 0,
    foraDoAr: false,
    atrasoMs: 0,
    statusDoToken: 200,
    corpoDoToken: null,
    claims: {},
    cabecalho: {},
    chavePrivada: privateKey,
    camposRecebidos: [],
  }

  const assinarIngresso = ({ claims = {}, cabecalho = {}, chavePrivada = privateKey } = {}) => {
    const h = b64url(JSON.stringify({ alg: 'EdDSA', kid, ...cabecalho }))
    const c = b64url(
      JSON.stringify({
        iss: EMISSOR,
        aud: CLIENTE_ID,
        sub: 'usuario-1',
        email: 'sofia@casa.example',
        email_verified: true,
        name: 'Sofia',
        sid: 'sessao-1',
        iat: emSegundos(),
        exp: emSegundos(900),
        ...claims,
      }),
    )
    const assinatura =
      cabecalho.alg === 'none' ? '' : b64url(assinarBytes(null, Buffer.from(`${h}.${c}`, 'ascii'), chavePrivada))
    return `${h}.${c}.${assinatura}`
  }

  const buscar = async (endereco, opcoes = {}) => {
    const u = String(endereco)
    if (estado.foraDoAr) throw new Error('a portaria não respondeu')
    if (estado.atrasoMs) await new Promise((r) => setTimeout(r, estado.atrasoMs))
    if (u.endsWith('/.well-known/openid-configuration')) {
      return respostaFalsa(200, {
        issuer: EMISSOR,
        authorization_endpoint: `${EMISSOR}/oauth2/authorize`,
        token_endpoint: `${EMISSOR}/oauth2/token`,
        jwks_uri: `${EMISSOR}/jwks`,
        end_session_endpoint: `${EMISSOR}/oauth2/end-session`,
      })
    }
    if (u.endsWith('/jwks')) return respostaFalsa(200, { keys: [jwk] })
    if (u.endsWith('/oauth2/token')) {
      const campos = Object.fromEntries(new URLSearchParams(opcoes.body))
      estado.camposRecebidos.push(campos)
      if (campos.grant_type === 'refresh_token') estado.renovacoes++
      else estado.trocas++
      if (estado.corpoDoToken) return respostaFalsa(estado.statusDoToken, estado.corpoDoToken)
      if (estado.statusDoToken !== 200) {
        return respostaFalsa(estado.statusDoToken, { error: 'invalid_grant', error_description: 'a conta foi desativada' })
      }
      estado.emitidos++
      return respostaFalsa(200, {
        id_token: assinarIngresso({ claims: estado.claims, cabecalho: estado.cabecalho, chavePrivada: estado.chavePrivada }),
        access_token: `acesso-${estado.emitidos}`,
        refresh_token: `renovacao-${estado.emitidos}`,
        expires_in: 900,
      })
    }
    throw new Error(`o teste não previu esta chamada à portaria: ${u}`)
  }

  return { buscar, estado, assinarIngresso }
}

const AS_CINCO = {
  emissor: EMISSOR,
  clienteId: CLIENTE_ID,
  clienteSegredo: CLIENTE_SEGREDO,
  chaveDoCookie: CHAVE_DO_COOKIE,
  origemPublica: ORIGEM_PUBLICA,
}

const chaveEmBytes = chaveDoCookie(CHAVE_DO_COOKIE).chave

// Na nuvem os cookies levam o prefixo `__Host-` (revisão de segurança do PR #100).
// Todos os testes da portaria sobem o servidor com `naNuvem: true`.
const NOME_DO_INGRESSO = `__Host-${INGRESSO_SEM_PREFIXO}`
const NOME_DO_PEDIDO = `__Host-${PEDIDO_SEM_PREFIXO}`

/** Um cookie de ingresso montado à mão, para exercitar o válido, o vencido e o adulterado. */
const ingressoGuardado = (dados = {}, { nome = NOME_DO_INGRESSO } = {}) =>
  cookieDoIngresso(
    {
      app: CLIENTE_ID,
      email: 'sofia@casa.example',
      nome: 'Sofia',
      sub: 'usuario-1',
      sid: 'sessao-1',
      venceEm: Date.now() + 900_000,
      renovacao: 'renovacao-0',
      idToken: 'ingresso-antigo',
      ...dados,
    },
    chaveEmBytes,
    { nome },
  ).split(';')[0]

const subirComPortaria = async (extras = {}) => {
  const falso = emissorFalso()
  await subir({ naNuvem: true, portaria: AS_CINCO, buscarNaPortaria: falso.buscar, ...extras })
  return falso
}

/** Pega um `Set-Cookie` pelo nome (com os atributos). */
const cookieChamado = (r, nome) => r.cookies.find((c) => c.startsWith(`${nome}=`)) ?? ''
const apagou = (r, nome) => r.cookies.some((c) => c.startsWith(`${nome}=`) && c.includes('Max-Age=0'))

// ═══════════════════════════════════════════════════════════════════════════
// O PONTO CRÍTICO: sem ingresso, o JS não sai
// ═══════════════════════════════════════════════════════════════════════════

describe('sem ingresso, nenhum arquivo do app sai — o JS leva os números das festas', () => {
  it('GET /assets/<arquivo>.js pedindo HTML: 302 para a entrada, com o caminho de volta, e SEM o JS', async () => {
    await subirComPortaria()
    const r = await pedir(JS, { headers: casa({ accept: HTML }) })
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe(`/api/auth/entrar?volta=${encodeURIComponent(JS)}`)
    expect(r.texto).not.toContain(MARCA_DO_JS)
  })

  it('GET /assets/<arquivo>.js sem pedir HTML (o `<script>`, o `curl`): 401, e SEM o JS', async () => {
    await subirComPortaria()
    for (const accept of [undefined, '*/*', 'application/javascript']) {
      const r = await pedir(JS, { headers: casa(accept ? { accept } : {}) })
      expect(r.status).toBe(401)
      expect(r.json().precisaEntrar).toBe(true)
      expect(r.texto).not.toContain(MARCA_DO_JS)
    }
  })

  it('todo caminho fica atrás da porteira: /, /index.html, o favicon, rota do app e HEAD', async () => {
    await subirComPortaria()
    for (const caminho of ['/', '/index.html', '/favicon.svg', '/evento/123', '/assets/nao-existe.js']) {
      const comHTML = await pedir(caminho, { headers: casa({ accept: HTML }) })
      expect(comHTML.status).toBe(302)
      expect(comHTML.headers.get('location')).toMatch(/^\/api\/auth\/entrar\?volta=/)
      expect(comHTML.texto).not.toContain(MARCA_DO_INDEX)
      const semHTML = await pedir(caminho, { headers: casa() })
      expect(semHTML.status).toBe(401)
      expect(semHTML.texto).not.toContain(MARCA_DO_INDEX)
    }
    const head = await pedir(JS, { method: 'HEAD', headers: casa() })
    expect(head.status).toBe(401)
  })

  it('a volta guarda a busca junto do caminho', async () => {
    await subirComPortaria()
    const r = await pedir('/evento/7?aba=custos', { headers: casa({ accept: HTML }) })
    expect(r.headers.get('location')).toBe(`/api/auth/entrar?volta=${encodeURIComponent('/evento/7?aba=custos')}`)
  })

  it('cookie adulterado, ilegível ou cifrado com outra chave é cookie AUSENTE — 401, nunca 500, nunca o JS', async () => {
    await subirComPortaria()
    const bom = ingressoGuardado()
    const outraChave = cookieDoIngresso(
      { app: CLIENTE_ID, email: 'x@y.z', venceEm: Date.now() + 900_000, renovacao: 'r' },
      chaveDoCookie('5b'.repeat(32)).chave,
      { nome: NOME_DO_INGRESSO },
    ).split(';')[0]
    for (const cookie of [`${bom.slice(0, -3)}zzz`, `${NOME_DO_INGRESSO}=nao-e-nem-base64`, `${NOME_DO_INGRESSO}=a.b.c`, outraChave]) {
      const r = await pedir(JS, { headers: casa({ cookie }) })
      expect(r.status).toBe(401)
      expect(r.texto).not.toContain(MARCA_DO_JS)
    }
  })

  // Revisão de segurança do PR #100 (A2): o cookie diz de qual app ele é.
  it('cookie cifrado com a MESMA chave por outro app da casa (`app: calendario`) é cookie AUSENTE — 401, e o JS não sai', async () => {
    await subirComPortaria()
    for (const app of ['calendario', 'calendario-da-casa', '', undefined]) {
      const cookie = ingressoGuardado({ app })
      const r = await pedir(JS, { headers: casa({ cookie }) })
      expect(r.status).toBe(401)
      expect(r.texto).not.toContain(MARCA_DO_JS)
    }
  })

  it('na nuvem só vale o cookie `__Host-entrada`: um `entrada` sem prefixo, mesmo válido, é ignorado', async () => {
    await subirComPortaria()
    const semPrefixo = ingressoGuardado({}, { nome: INGRESSO_SEM_PREFIXO })
    expect(semPrefixo.startsWith(`${INGRESSO_SEM_PREFIXO}=`)).toBe(true)
    const r = await pedir(JS, { headers: casa({ cookie: semPrefixo }) })
    expect(r.status).toBe(401)
    expect(r.texto).not.toContain(MARCA_DO_JS)
  })

  it('com ingresso válido: 200, o conteúdo do JS, e os cabeçalhos que não deixam cache guardar', async () => {
    await subirComPortaria()
    const r = await pedir(JS, { headers: casa({ cookie: ingressoGuardado() }) })
    expect(r.status).toBe(200)
    expect(r.texto).toContain(MARCA_DO_JS)
    expect(r.headers.get('content-type')).toContain('text/javascript')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(r.headers.get('x-frame-options')).toBe('DENY')
    expect(r.headers.get('referrer-policy')).toBe('same-origin')
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")

    const index = await pedir('/', { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
    expect(index.status).toBe(200)
    expect(index.texto).toContain(MARCA_DO_INDEX)
    // Rota do app que não é arquivo cai no index.html.
    const rota = await pedir('/evento/123', { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
    expect(rota.status).toBe(200)
    expect(rota.texto).toContain(MARCA_DO_INDEX)
  })

  // Revisão de segurança do PR #100 (A4): a política de conteúdo do app.
  it('o app servido leva a política inteira: script, conexão e fonte só daqui, sem eval, sem moldura', async () => {
    await subirComPortaria()
    for (const caminho of ['/', JS]) {
      const r = await pedir(caminho, { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
      expect(r.status).toBe(200)
      expect(r.headers.get('content-security-policy')).toBe(POLITICA_DO_APP)
    }
    const diretivas = Object.fromEntries(
      POLITICA_DO_APP.split(';').map((d) => d.trim().split(/\s+/)).map(([nome, ...valores]) => [nome, valores]),
    )
    expect(diretivas['default-src']).toEqual(["'self'"])
    expect(diretivas['script-src']).toEqual(["'self'"])
    expect(diretivas['connect-src']).toEqual(["'self'"])
    expect(diretivas['font-src']).toEqual(["'self'"])
    expect(diretivas['img-src']).toEqual(["'self'", 'data:'])
    expect(diretivas['frame-ancestors']).toEqual(["'none'"])
    expect(diretivas['object-src']).toEqual(["'none'"])
    expect(diretivas['base-uri']).toEqual(["'self'"])
    expect(POLITICA_DO_APP).not.toContain('unsafe-eval')
  })

  // Revisão de segurança do PR #100 (A5).
  it('na nuvem toda resposta leva HSTS — a do JS, a do 302, a do 401 e a da saúde', async () => {
    await subirComPortaria()
    const respostas = [
      await pedir(JS, { headers: casa({ cookie: ingressoGuardado() }) }),
      await pedir('/', { headers: casa({ accept: HTML }) }),
      await pedir(JS, { headers: casa() }),
      await pedir('/api/saude', { headers: casa() }),
    ]
    for (const r of respostas) expect(r.headers.get('strict-transport-security')).toBe('max-age=31536000')
  })

  it('com ingresso, método que não é GET/HEAD: 405; sem ingresso, a porteira responde primeiro (401)', async () => {
    await subirComPortaria()
    expect((await pedir('/', { method: 'POST', headers: casa({ cookie: ingressoGuardado() }) })).status).toBe(405)
    expect((await pedir('/', { method: 'PUT', headers: casa() })).status).toBe(401)
  })

  it('/api/<qualquer coisa> também fica atrás da porteira (401 sem ingresso, 404 com)', async () => {
    await subirComPortaria()
    expect((await pedir('/api/eventos', { headers: casa() })).status).toBe(401)
    expect((await pedir('/api/eventos', { headers: casa({ cookie: ingressoGuardado() }) })).status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Saúde, muro do Host e falta de variável
// ═══════════════════════════════════════════════════════════════════════════

describe('/api/saude — antes de tudo, em qualquer Host, sem cookie', () => {
  it('no modo portaria responde 200 por qualquer Host e sem cookie, e não diz nada além do modo', async () => {
    await subirComPortaria()
    for (const host of [HOST_DA_CASA, 'planejador-producao.up.railway.app', 'healthcheck.railway.app']) {
      const r = await pedir('/api/saude', { headers: { host } })
      expect(r.status).toBe(200)
      expect(r.json()).toEqual({ ok: true, nuvem: true, modo: 'portaria' })
    }
  })

  it('no modo sem-porta também responde 200 — senão o Railway derrubaria o processo antes do 503 aparecer', async () => {
    await subir({ naNuvem: true, portaria: {} })
    const r = await pedir('/api/saude', { headers: { host: 'qualquer.up.railway.app' } })
    expect(r.status).toBe(200)
    expect(r.json().modo).toBe('sem-porta')
  })
})

describe('o muro do Host — o *.up.railway.app não é segunda porta', () => {
  it('navegação por outro Host: 421 com página em português e o link da casa, mesmo com ingresso válido', async () => {
    await subirComPortaria()
    const r = await pedir('/', {
      headers: { host: 'planejador-producao.up.railway.app', accept: HTML, cookie: ingressoGuardado() },
    })
    expect(r.status).toBe(421)
    expect(r.headers.get('content-type')).toContain('text/html')
    expect(r.texto).toContain(`href="${ORIGEM_PUBLICA}"`)
    expect(r.texto).toContain('Planejador')
    expect(r.texto).not.toContain(MARCA_DO_INDEX)
  })

  it('pedido de arquivo por outro Host: 421 em JSON, e nada do JS', async () => {
    await subirComPortaria()
    const r = await pedir(JS, { headers: { host: 'planejador-producao.up.railway.app', cookie: ingressoGuardado() } })
    expect(r.status).toBe(421)
    expect(r.json().erro).toContain(ORIGEM_PUBLICA)
    expect(r.texto).not.toContain(MARCA_DO_JS)
  })

  it('a entrada também não abre por outro Host', async () => {
    await subirComPortaria()
    const r = await pedir('/api/auth/entrar?volta=%2F', { headers: { host: 'planejador-producao.up.railway.app' } })
    expect(r.status).toBe(421)
  })

  it('o Host canônico passa', async () => {
    await subirComPortaria()
    expect((await pedir(JS, { headers: casa({ cookie: ingressoGuardado() }) })).status).toBe(200)
  })
})

describe('na nuvem com variável faltando ou torta: 503 nomeando a variável, e nunca o app', () => {
  it('sem NENHUMA das cinco: 503 que nomeia a primeira (e as outras), em HTML e em JSON', async () => {
    await subir({ naNuvem: true, portaria: {} })
    const nav = await pedir('/', { headers: { host: 'qualquer.up.railway.app', accept: HTML } })
    expect(nav.status).toBe(503)
    expect(nav.texto).toContain('PORTARIA_EMISSOR')
    expect(nav.texto).not.toContain(MARCA_DO_INDEX)
    const js = await pedir(JS, { headers: { host: 'qualquer.up.railway.app' } })
    expect(js.status).toBe(503)
    expect(js.json().erro).toContain('PORTARIA_EMISSOR')
    expect(js.json().faltaVariavel).toBe(true)
    expect(js.texto).not.toContain(MARCA_DO_JS)
  })

  for (const [campo, variavel] of [
    ['emissor', 'PORTARIA_EMISSOR'],
    ['clienteId', 'PORTARIA_CLIENTE_ID'],
    ['clienteSegredo', 'PORTARIA_CLIENTE_SEGREDO'],
    ['chaveDoCookie', 'CHAVE_DO_COOKIE'],
    ['origemPublica', 'ORIGEM_PUBLICA'],
  ]) {
    it(`faltando só ${variavel}: 503 com o nome dela, e o JS não sai`, async () => {
      await subir({ naNuvem: true, portaria: { ...AS_CINCO, [campo]: '' } })
      const r = await pedir(JS, { headers: casa({ cookie: ingressoGuardado() }) })
      expect(r.status).toBe(503)
      expect(r.json().erro).toContain(variavel)
      expect(r.texto).not.toContain(MARCA_DO_JS)
    })
  }

  it('ORIGEM_PUBLICA sem https://, CHAVE_DO_COOKIE curta e emissor em http:// também fecham, nomeando a variável', async () => {
    const casos = [
      [{ origemPublica: 'planejador.casa.example' }, 'ORIGEM_PUBLICA'],
      [{ origemPublica: `${ORIGEM_PUBLICA}/` }, 'ORIGEM_PUBLICA'],
      [{ chaveDoCookie: 'curta' }, 'CHAVE_DO_COOKIE'],
      [{ emissor: 'http://entrar.casa.example/api/auth' }, 'PORTARIA_EMISSOR'],
    ]
    for (const [torto, variavel] of casos) {
      const escolha = escolherModo({ portaria: { ...AS_CINCO, ...torto }, naNuvem: true })
      expect(escolha.modo).toBe('sem-porta')
      expect(escolha.motivo).toContain(variavel)
    }
  })

  it('nada definido FORA da nuvem é `aberto`; nada definido NA nuvem é `sem-porta`', () => {
    expect(escolherModo({ portaria: {}, naNuvem: false }).modo).toBe('aberto')
    expect(escolherModo({ portaria: {}, naNuvem: true }).modo).toBe('sem-porta')
    expect(escolherModo({ portaria: AS_CINCO, naNuvem: true }).modo).toBe('portaria')
  })

  it('a receita da ORIGEM_PUBLICA ensina o endereço do Planejador', () => {
    expect(conferirOrigemPublica('x').motivo).toContain('https://planejador.casa.example')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A entrada, a volta e o fluxo completo
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/auth/entrar — o pedido que sai daqui', () => {
  it('redireciona à portaria com state, nonce, PKCE S256 e o redirect_uri EXATO', async () => {
    await subirComPortaria()
    const r = await pedir('/api/auth/entrar?volta=%2F', { headers: casa() })
    expect(r.status).toBe(302)
    const alvo = new URL(r.headers.get('location'))
    expect(alvo.origin + alvo.pathname).toBe(`${EMISSOR}/oauth2/authorize`)
    expect(alvo.searchParams.get('client_id')).toBe(CLIENTE_ID)
    expect(alvo.searchParams.get('redirect_uri')).toBe(RETORNO)
    expect(alvo.searchParams.get('scope')).toBe('openid profile email offline_access')
    expect(alvo.searchParams.get('code_challenge_method')).toBe('S256')

    const cru = cookieChamado(r, NOME_DO_PEDIDO)
    const pedido = decifrar(cru.split(';')[0].slice(NOME_DO_PEDIDO.length + 1), chaveEmBytes)
    expect(pedido.estado).toBe(alvo.searchParams.get('state'))
    expect(pedido.nonce).toBe(alvo.searchParams.get('nonce'))
    expect(desafioS256(pedido.verificador)).toBe(alvo.searchParams.get('code_challenge'))
    expect(cru).toContain('HttpOnly')
    expect(cru).toContain('SameSite=Lax')
    // Na nuvem o cookie é sempre `Secure`, com ou sem `x-forwarded-proto`.
    expect(cru).toContain('Secure')
    expect(cru).toContain('Max-Age=600')
  })

  it('`volta` com `//`, com `\\`, absoluta ou com HTML é RECUSADA em português — e o caminho pedido não é repetido na página', async () => {
    await subirComPortaria()
    for (const volta of ['//evil.example', '/\\evil.example', 'https://evil.example', '<script>alert(1)</script>']) {
      const r = await pedir(`/api/auth/entrar?volta=${encodeURIComponent(volta)}`, { headers: casa() })
      expect(r.status).toBe(400)
      expect(r.headers.get('location')).toBeNull()
      expect(r.texto).toContain('caminho de volta')
      expect(r.texto).not.toContain('<script>alert(1)</script>')
      // O caminho pedido não é repetido na página, nem escapado.
      expect(r.texto).not.toContain('evil.example')
      expect(r.texto).not.toContain('&lt;script')
    }
  })

  it('portaria fora do ar na hora de entrar: 503 com frase, nunca página em branco', async () => {
    const falso = await subirComPortaria()
    falso.estado.foraDoAr = true
    const r = await pedir('/api/auth/entrar?volta=%2F', { headers: casa() })
    expect(r.status).toBe(503)
    expect(r.texto).toContain('portaria da casa não respondeu')
  })
})

describe('GET /api/auth/retorno — a volta da portaria', () => {
  const iniciar = async (falso, volta = '/') => {
    const r = await pedir(`/api/auth/entrar?volta=${encodeURIComponent(volta)}`, { headers: casa() })
    const alvo = new URL(r.headers.get('location'))
    falso.estado.claims = { nonce: alvo.searchParams.get('nonce') }
    return { estado: alvo.searchParams.get('state'), cookie: cookieChamado(r, NOME_DO_PEDIDO).split(';')[0] }
  }
  const voltar = (ida, { codigo = 'codigo-bom', estado = ida.estado } = {}) =>
    pedir(`/api/auth/retorno?code=${encodeURIComponent(codigo)}&state=${encodeURIComponent(estado)}`, {
      headers: casa({ cookie: ida.cookie, accept: HTML }),
    })

  it('FLUXO COMPLETO: entrar → retorno → GET / e o JS com o cookie → 200', async () => {
    const falso = await subirComPortaria()
    // 1. A pessoa abre o endereço da casa e é mandada para a entrada.
    const primeira = await pedir('/', { headers: casa({ accept: HTML }) })
    expect(primeira.status).toBe(302)
    const entrada = primeira.headers.get('location')
    // 2. A entrada a manda para a portaria, com o pedido no cookie curto.
    const r1 = await pedir(entrada, { headers: casa({ accept: HTML }) })
    expect(r1.status).toBe(302)
    const alvo = new URL(r1.headers.get('location'))
    falso.estado.claims = { nonce: alvo.searchParams.get('nonce') }
    const pedido = cookieChamado(r1, NOME_DO_PEDIDO).split(';')[0]
    // 3. A portaria devolve com código e state; o ingresso vira cookie.
    const r2 = await pedir(`/api/auth/retorno?code=codigo-bom&state=${encodeURIComponent(alvo.searchParams.get('state'))}`, {
      headers: casa({ cookie: pedido, accept: HTML }),
    })
    expect(r2.status).toBe(302)
    expect(r2.headers.get('location')).toBe('/')
    expect(falso.estado.trocas).toBe(1)
    expect(falso.estado.camposRecebidos[0].redirect_uri).toBe(RETORNO)
    expect(falso.estado.camposRecebidos[0].code_verifier).toBeTruthy()
    expect(apagou(r2, NOME_DO_PEDIDO)).toBe(true)
    const ingresso = cookieChamado(r2, NOME_DO_INGRESSO)
    expect(ingresso.startsWith('__Host-entrada=')).toBe(true)
    expect(ingresso).toContain('HttpOnly')
    expect(ingresso).toContain('Secure')
    // O que o navegador exige de um `__Host-`: Path=/ e nenhum Domain.
    expect(ingresso).toContain('Path=/')
    expect(ingresso).not.toMatch(/Domain=/i)
    expect(cookieChamado(r1, NOME_DO_PEDIDO).startsWith('__Host-pedido=')).toBe(true)
    // E por dentro ele diz de qual app é.
    expect(decifrar(ingresso.split(';')[0].slice(NOME_DO_INGRESSO.length + 1), chaveEmBytes).app).toBe(CLIENTE_ID)
    expect(ingresso).not.toContain(CLIENTE_SEGREDO)
    // 4. Com o cookie, o app abre — a página e o JS.
    const cookie = ingresso.split(';')[0]
    const pagina = await pedir('/', { headers: casa({ cookie, accept: HTML }) })
    expect(pagina.status).toBe(200)
    expect(pagina.texto).toContain(MARCA_DO_INDEX)
    const js = await pedir(JS, { headers: casa({ cookie }) })
    expect(js.status).toBe(200)
    expect(js.texto).toContain(MARCA_DO_JS)
  })

  it('a volta devolve ao caminho que a pessoa tinha pedido', async () => {
    const falso = await subirComPortaria()
    const r = await voltar(await iniciar(falso, '/evento/7?aba=custos'))
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('/evento/7?aba=custos')
  })

  it('`state` TROCADO é recusado: 400, nenhum ingresso gravado, nenhuma troca de código', async () => {
    const falso = await subirComPortaria()
    const r = await voltar(await iniciar(falso), { estado: 'um-state-que-nao-e-o-meu' })
    expect(r.status).toBe(400)
    expect(r.texto).toContain('state')
    expect(cookieChamado(r, NOME_DO_INGRESSO)).toBe('')
    expect(falso.estado.trocas).toBe(0)
  })

  it('sem o cookie do pedido: 400 com frase', async () => {
    const falso = await subirComPortaria()
    const ida = await iniciar(falso)
    const r = await pedir(`/api/auth/retorno?code=x&state=${encodeURIComponent(ida.estado)}`, { headers: casa() })
    expect(r.status).toBe(400)
    expect(r.texto).toContain('10 minutos')
  })

  it('pedido de entrada de OUTRO app (mesma chave, `app` diferente): recusado como pedido ausente', async () => {
    const falso = await subirComPortaria()
    const ida = await iniciar(falso)
    const meu = decifrar(ida.cookie.slice(NOME_DO_PEDIDO.length + 1), chaveEmBytes)
    const deOutro = `${NOME_DO_PEDIDO}=${cifrar({ ...meu, app: 'calendario' }, chaveEmBytes)}`
    const r = await pedir(`/api/auth/retorno?code=codigo-bom&state=${encodeURIComponent(ida.estado)}`, {
      headers: casa({ cookie: deOutro }),
    })
    expect(r.status).toBe(400)
    expect(cookieChamado(r, NOME_DO_INGRESSO)).toBe('')
    expect(falso.estado.trocas).toBe(0)
  })

  it('pedido com carimbo de mais de 10 minutos: recusado mesmo que o navegador tenha guardado o cookie', async () => {
    await subirComPortaria()
    const velho = `${NOME_DO_PEDIDO}=${cifrar(
      { app: CLIENTE_ID, estado: 's', nonce: 'n', verificador: 'v', volta: '/', criadoEm: Date.now() - 11 * 60_000 },
      chaveEmBytes,
    )}`
    const r = await pedir('/api/auth/retorno?code=x&state=s', { headers: casa({ cookie: velho }) })
    expect(r.status).toBe(400)
    expect(r.texto).toContain('prazo')
  })

  it('ingresso com `aud` de outro app, assinado com outra chave ou com `alg: none` é recusado', async () => {
    const ajustes = [
      [(f) => (f.estado.claims = { ...f.estado.claims, aud: 'calendario-da-casa' }), 'não para o Planejador'],
      [(f) => (f.estado.chavePrivada = generateKeyPairSync('ed25519').privateKey), 'assinatura'],
      [(f) => (f.estado.cabecalho = { alg: 'none' }), 'EdDSA'],
    ]
    for (const [ajuste, frase] of ajustes) {
      const falso = await subirComPortaria()
      const ida = await iniciar(falso)
      ajuste(falso)
      const r = await voltar(ida)
      expect(r.status).toBe(400)
      expect(r.texto).toContain(frase)
      expect(cookieChamado(r, NOME_DO_INGRESSO)).toBe('')
      await new Promise((ok) => servidor.close(ok))
      servidor = null
    }
  })

  // Revisão de segurança do PR #100 (A7): a página não repete o que veio na URL.
  it('a volta com `error_description`: a descrição NUNCA aparece; código fora do OIDC também não', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const falso = await subirComPortaria()
      const ida = await iniciar(falso)
      const r = await pedir(
        `/api/auth/retorno?error=access_denied&error_description=MARCA-DO-ESTRANHO&state=${encodeURIComponent(ida.estado)}`,
        { headers: casa({ cookie: ida.cookie }) },
      )
      expect(r.status).toBe(400)
      expect(r.texto).not.toContain('MARCA-DO-ESTRANHO')
      expect(r.texto).toContain('código access_denied')
      const ida2 = await iniciar(falso)
      const torto = await pedir(
        `/api/auth/retorno?error=${encodeURIComponent('ligue-0800-123')}&state=${encodeURIComponent(ida2.estado)}`,
        { headers: casa({ cookie: ida2.cookie }) },
      )
      expect(torto.status).toBe(400)
      expect(torto.texto).not.toContain('ligue-0800-123')
      expect(torto.texto).toContain('A portaria da casa não deixou entrar.')
      expect(log.mock.calls.map((c) => c.join(' ')).join('\n')).not.toContain('ligue-0800-123')
    } finally {
      log.mockRestore()
    }
  })

  it('a portaria voltando com `error`: página que manda falar com um administrador da Equipe', async () => {
    const falso = await subirComPortaria()
    const ida = await iniciar(falso)
    const r = await pedir(`/api/auth/retorno?error=access_denied&state=${encodeURIComponent(ida.estado)}`, {
      headers: casa({ cookie: ida.cookie }),
    })
    expect(r.status).toBe(400)
    expect(r.texto).toContain('access_denied')
    expect(r.texto).toContain('Equipe')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A renovação de 15 minutos — o JS também a dispara
// ═══════════════════════════════════════════════════════════════════════════

describe('a renovação de 15 minutos, de servidor para servidor', () => {
  const vencido = (extras = {}) => ingressoGuardado({ venceEm: Date.now() - 1000, ...extras })

  it('ingresso vencido renova sozinho: 200 com o JS e o Set-Cookie novo na mesma resposta', async () => {
    const falso = await subirComPortaria()
    const r = await pedir(JS, { headers: casa({ cookie: vencido() }) })
    expect(r.status).toBe(200)
    expect(r.texto).toContain(MARCA_DO_JS)
    expect(falso.estado.renovacoes).toBe(1)
    const dentro = decifrar(cookieChamado(r, NOME_DO_INGRESSO).split(';')[0].slice(NOME_DO_INGRESSO.length + 1), chaveEmBytes)
    expect(dentro.renovacao).toBe('renovacao-1')
    expect(dentro.venceEm).toBeGreaterThan(Date.now())
  })

  it('a página e o JS pedidos AO MESMO TEMPO com o ingresso vencido geram UMA renovação só', async () => {
    const falso = await subirComPortaria()
    falso.estado.atrasoMs = 40
    const cookie = vencido()
    const [a, b] = await Promise.all([
      pedir('/', { headers: casa({ cookie, accept: HTML }) }),
      pedir(JS, { headers: casa({ cookie }) }),
    ])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(falso.estado.renovacoes).toBe(1)
  })

  it('portaria FORA DO AR na renovação: 503 com frase em português, o cookie FICA, e o JS não sai', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const falso = await subirComPortaria()
      falso.estado.foraDoAr = true
      const nav = await pedir('/', { headers: casa({ cookie: vencido(), accept: HTML }) })
      expect(nav.status).toBe(503)
      expect(nav.texto).toContain('não respondeu')
      expect(nav.cookies).toHaveLength(0)
      const js = await pedir(JS, { headers: casa({ cookie: vencido() }) })
      expect(js.status).toBe(503)
      expect(js.json().portariaForaDoAr).toBe(true)
      expect(js.cookies).toHaveLength(0)
      expect(js.texto).not.toContain(MARCA_DO_JS)
    } finally {
      log.mockRestore()
    }
  })

  it('renovação RECUSADA (desativada em Equipe): navegação volta à entrada com o cookie apagado; o JS leva 401', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const falso = await subirComPortaria()
      falso.estado.statusDoToken = 400
      const nav = await pedir('/', { headers: casa({ cookie: vencido(), accept: HTML }) })
      expect(nav.status).toBe(302)
      expect(nav.headers.get('location')).toMatch(/^\/api\/auth\/entrar\?volta=/)
      expect(apagou(nav, NOME_DO_INGRESSO)).toBe(true)
      const js = await pedir(JS, { headers: casa({ cookie: vencido() }) })
      expect(js.status).toBe(401)
      expect(js.json().erro).toContain('Equipe')
      expect(apagou(js, NOME_DO_INGRESSO)).toBe(true)
      expect(js.texto).not.toContain(MARCA_DO_JS)
    } finally {
      log.mockRestore()
    }
  })

  it('`invalid_client` é erro de configuração: 503 que manda ao painel, o cookie fica, o segredo não vai ao log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const falso = await subirComPortaria()
      falso.estado.statusDoToken = 401
      falso.estado.corpoDoToken = { error: 'invalid_client', error_description: 'client authentication failed' }
      const r = await pedir(JS, { headers: casa({ cookie: vencido() }) })
      expect(r.status).toBe(503)
      expect(r.json().erro).toContain('a chave do Planejador na portaria não confere')
      expect(r.json().erroDeConfiguracao).toBe(true)
      expect(r.cookies).toHaveLength(0)
      const linhas = log.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(linhas).toContain('invalid_client')
      expect(linhas).not.toContain(CLIENTE_SEGREDO)
    } finally {
      log.mockRestore()
    }
  })

  it('renovação recusada: o cookie apagado leva Secure — senão o navegador o mantém e cada pedido volta à portaria', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const falso = await subirComPortaria()
      falso.estado.statusDoToken = 400
      const r = await pedir(JS, { headers: casa({ cookie: vencido() }) })
      expect(r.status).toBe(401)
      const apaga = cookieChamado(r, NOME_DO_INGRESSO)
      expect(apaga).toContain('Max-Age=0')
      expect(apaga.split(';').map((a) => a.trim())).toContain('Secure')
    } finally {
      log.mockRestore()
    }
  })

  it('a bateria inteira conferiu Set-Cookie `__Host-` de verdade (o helper não está olhando o vazio)', () => {
    // Controle positivo do helper: se nenhum `__Host-` tivesse passado por
    // `pedir`, "nenhum torto" não provaria nada.
    expect(cookiesHostConferidos).toBeGreaterThan(10)
  })

  it('vencido SEM token de renovação: volta à entrada direto, sem falar com a portaria', async () => {
    const falso = await subirComPortaria()
    const r = await pedir(JS, { headers: casa({ cookie: vencido({ renovacao: '' }) }) })
    expect(r.status).toBe(401)
    expect(falso.estado.renovacoes).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Travessia e endereço torto
// ═══════════════════════════════════════════════════════════════════════════

describe('travessia de diretório e endereço torto — recusados, e o processo continua de pé', () => {
  it('`..` escondido em %2f: 400 com frase, e o arquivo de fora NÃO sai', async () => {
    await subirComPortaria()
    for (const caminho of ['/..%2fsegredo.txt', '/%2e%2e%2fsegredo.txt', '/assets/..%2f..%2fsegredo.txt', '/..%5csegredo.txt']) {
      const r = await pedir(caminho, { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
      expect(r.status).toBe(400)
      expect(r.texto).toContain('sair da pasta')
      expect(r.texto).not.toContain(SEGREDO_FORA)
    }
  })

  it('`/../` e `%2e%2e/` crus: o arquivo de fora NÃO sai (o `URL` os resolve dentro do app)', async () => {
    await subirComPortaria()
    for (const caminho of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/assets/../../segredo.txt', '/%2E%2E/%2E%2E/segredo.txt']) {
      const r = await pedir(caminho, { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
      expect(r.texto).not.toContain(SEGREDO_FORA)
    }
  })

  it('caractere nulo no caminho: 400', async () => {
    await subirComPortaria()
    const r = await pedir('/index.html%00.js', { headers: casa({ cookie: ingressoGuardado() }) })
    expect(r.status).toBe(400)
  })

  it('`%` torto (`/%`, `/a%ZZ`): 400 com frase, e a saúde responde depois — o processo não caiu', async () => {
    await subirComPortaria()
    for (const caminho of ['/%', '/a%ZZ', '/assets/%E0%A4%A']) {
      const r = await pedir(caminho, { headers: casa({ cookie: ingressoGuardado(), accept: HTML }) })
      expect(r.status).toBe(400)
      expect(r.texto).toContain('não forma um caractere')
    }
    expect((await pedir('/api/saude', { headers: casa() })).status).toBe(200)
  })

  it('sem ingresso, a travessia nem chega ao estático: a porteira responde antes', async () => {
    await subirComPortaria()
    const r = await pedir('/..%2fsegredo.txt', { headers: casa() })
    expect(r.status).toBe(401)
    expect(r.texto).not.toContain(SEGREDO_FORA)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A saída
// ═══════════════════════════════════════════════════════════════════════════

describe('/api/auth/sair', () => {
  it('GET (navegação): apaga o cookie e vai à saída da portaria com hint, client_id e a volta da casa', async () => {
    const falso = await subirComPortaria()
    const idToken = falso.assinarIngresso()
    const r = await pedir('/api/auth/sair', { headers: casa({ cookie: ingressoGuardado({ idToken }), accept: HTML }) })
    expect(r.status).toBe(302)
    expect(apagou(r, NOME_DO_INGRESSO)).toBe(true)
    const saida = new URL(r.headers.get('location'))
    expect(saida.origin + saida.pathname).toBe(`${EMISSOR}/oauth2/end-session`)
    expect(saida.searchParams.get('id_token_hint')).toBe(idToken)
    expect(saida.searchParams.get('client_id')).toBe(CLIENTE_ID)
    // O mesmo endereço que vai no cadastro do cliente na portaria.
    expect(saida.searchParams.get('post_logout_redirect_uri')).toBe(`${ORIGEM_PUBLICA}/`)
  })

  // Revisão de segurança do PR #100 (N1): o apagar de um `__Host-` sem Secure é
  // ignorado pelo navegador. Os dois cookies saem apagados, com Secure.
  it('sair apaga OS DOIS cookies `__Host-` com Secure, Path=/ e sem Domain', async () => {
    await subirComPortaria()
    for (const method of ['GET', 'POST']) {
      const r = await pedir('/api/auth/sair', { method, headers: casa({ cookie: ingressoGuardado() }) })
      for (const nome of [NOME_DO_INGRESSO, NOME_DO_PEDIDO]) {
        const apaga = cookieChamado(r, nome)
        expect(apaga).toContain('Max-Age=0')
        expect(apaga.split(';').map((a) => a.trim())).toContain('Secure')
        expect(apaga).toContain('Path=/')
        expect(apaga).not.toMatch(/Domain=/i)
      }
    }
  })

  it('POST (fetch): 200 com o endereço de saída, e o cookie apagado', async () => {
    await subirComPortaria()
    const r = await pedir('/api/auth/sair', { method: 'POST', headers: casa({ cookie: ingressoGuardado(), origin: ORIGEM_PUBLICA }) })
    expect(r.status).toBe(200)
    expect(r.json().endereco).toContain('/oauth2/end-session')
    expect(apagou(r, NOME_DO_INGRESSO)).toBe(true)
  })

  it('pedido de saída vindo de OUTRO site: 403, e ninguém sai', async () => {
    await subirComPortaria()
    for (const extras of [
      { 'sec-fetch-site': 'cross-site' },
      { origin: 'https://evil.example' },
      // Revisão de segurança do PR #100 (A6): um subdomínio irmão da casa.
      { 'sec-fetch-site': 'same-site' },
      { origin: 'https://calendario.casa.example' },
    ]) {
      const r = await pedir('/api/auth/sair', { headers: casa({ cookie: ingressoGuardado(), ...extras }) })
      expect(r.status).toBe(403)
      expect(r.cookies).toHaveLength(0)
    }
  })

  it('o link de sair DESTE app (`same-origin`) e o endereço digitado (`none`) continuam saindo', async () => {
    await subirComPortaria()
    for (const site of ['same-origin', 'none']) {
      const r = await pedir('/api/auth/sair', { headers: casa({ cookie: ingressoGuardado(), 'sec-fetch-site': site }) })
      expect(r.status).toBe(302)
      expect(apagou(r, NOME_DO_INGRESSO)).toBe(true)
    }
  })

  it('portaria fora do ar: sair daqui acontece igual, e a volta é a própria página', async () => {
    const falso = await subirComPortaria()
    falso.estado.foraDoAr = true
    const r = await pedir('/api/auth/sair', { headers: casa({ cookie: ingressoGuardado() }) })
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('/')
    expect(apagou(r, NOME_DO_INGRESSO)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// O modo `aberto` (só no Mac)
// ═══════════════════════════════════════════════════════════════════════════

describe('modo aberto — só fora da nuvem, para conferir o build no Mac', () => {
  it('serve / e o JS sem entrada', async () => {
    await subir({ naNuvem: false, portaria: {} })
    const { port } = new URL(base)
    const host = `127.0.0.1:${port}`
    expect(servidor.modo).toBe('aberto')
    const index = await pedir('/', { headers: { host, accept: HTML } })
    expect(index.status).toBe(200)
    expect(index.texto).toContain(MARCA_DO_INDEX)
    const js = await pedir(JS, { headers: { host } })
    expect(js.status).toBe(200)
    expect(js.texto).toContain(MARCA_DO_JS)
  })

  it('fora da nuvem NÃO há HSTS — o servidor do Mac é HTTP de propósito', async () => {
    await subir({ naNuvem: false, portaria: {} })
    const { port } = new URL(base)
    const r = await pedir('/', { headers: { host: `127.0.0.1:${port}`, accept: HTML } })
    expect(r.status).toBe(200)
    expect(r.headers.get('strict-transport-security')).toBeNull()
  })

  it('o muro do Host vale também aqui: um nome de fora apontado para 127.0.0.1 recebe 421', async () => {
    await subir({ naNuvem: false, portaria: {} })
    const { port } = new URL(base)
    const r = await pedir(JS, { headers: { host: `evil.example:${port}` } })
    expect(r.status).toBe(421)
    expect(r.texto).not.toContain(MARCA_DO_JS)
  })

  it('a entrada não existe no modo aberto (404 com página, sem laço)', async () => {
    await subir({ naNuvem: false, portaria: {} })
    const { port } = new URL(base)
    const r = await pedir('/api/auth/entrar', { headers: { host: `127.0.0.1:${port}`, accept: HTML } })
    expect(r.status).toBe(404)
    expect(r.texto).toContain('modo de teste')
  })
})
