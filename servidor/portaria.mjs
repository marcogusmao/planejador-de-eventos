// CÓPIA, com origem registrada (Marco, 05/10/2026, por questionário: o Planejador
// sobe para o Railway atrás da mesma entrada da casa que o Calendário usa).
//
//   origem:  calendario, servidor/portaria.mjs, commit c38fb0b (origin/main
//            de 22/09/2026), copiado em 05/10/2026.
//   mudou:   só as frases que diziam "calendário" — a recusa de `aud`, o erro de
//            configuração `invalid_client` e a origem de reserva de `voltaLocal`
//            (`https://planejador.invalido`); no original, linhas 300, 368 e 502.
//            Nenhuma regra mudou.
//   se o Calendário consertar algo aqui, o conserto NÃO chega sozinho: compare com
//   `git -C <calendario> diff c38fb0b -- servidor/portaria.mjs` e traga à mão.
//
// A PORTARIA — o cliente do login central (Marco, 17/09/2026, decisão #46).
//
// Quem diz quem entra no Planejador (como no Calendário) é a entrada da casa
// (`entrar.casa.example`, desde 17/09/2026; antes `propostas.casa.example`).
// Ela é servida pelo Propostas, que guarda a lista de contas Google em Equipe.
// Este arquivo é o lado cliente do contrato medido em
// `.context/contrato-portaria.md` do repositório `home`.
//
// ————— zero dependência, de propósito —————
//
// A imagem final do Railway não tem `node_modules` (ver o `Dockerfile`): o
// servidor é Node puro. Então nada de biblioteca de OIDC ou de JWT aqui — é
// `node:crypto` e `fetch`, os dois que o Node 22 já traz. A conferência da
// assinatura EdDSA cabe em quinze linhas e fica visível; uma biblioteca traria
// a imagem inteira de volta.
//
// ————— o que este arquivo NUNCA faz —————
//
// Não guarda lista de e-mails, não tem banco de sessões e não imprime o segredo
// do cliente em log nenhum. A única lista é o `Member.active` do Propostas.
//
// ————— duas famílias de falha, e por que elas não podem se misturar —————
//
// `ErroDaPortaria` carrega `foraDoAr`:
//
//   foraDoAr: false → A PORTARIA RESPONDEU E DISSE NÃO. A pessoa foi desativada
//   em Equipe, ou passou dos 7 dias do token de renovação, ou o ingresso está
//   adulterado. O cookie é apagado e a tela volta para a entrada.
//
//   foraDoAr: true → NINGUÉM DISSE NADA. Rede caiu, DNS falhou, a entrada da
//   casa devolveu 502 — ou se anunciou com outro emissor, que é o painel (ou a
//   troca de endereço) fora de ordem, e não a pessoa. Isso NÃO é recusa: o
//   cookie fica onde está e a resposta é 503 com frase em português, para a
//   pessoa não perder a vez por uma queda de um minuto.
//
// Trocar as duas de lugar é o defeito caro: tratar queda como recusa derruba a
// casa inteira quando a entrada da casa reinicia; tratar recusa como queda deixa
// entrar quem foi desativado.

import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify as verificarAssinatura } from 'node:crypto'

/** Tolerância de relógio na conferência do `exp`, como manda o contrato. */
export const FOLGA_DE_RELOGIO_S = 60

/** Quanto tempo a promessa de uma renovação já concluída fica guardada. */
const ECO_DA_RENOVACAO_MS = 30_000

/** Teto de espera de cada chamada à portaria. Sem ele, um soquete pendurado prende a resposta. */
const ESPERA_MS = 8_000

export class ErroDaPortaria extends Error {
  constructor(mensagem, { foraDoAr = false, configuracao = false, codigo = '', causa } = {}) {
    super(mensagem)
    this.name = 'ErroDaPortaria'
    this.foraDoAr = foraDoAr
    // ————— a terceira família (17/09/2026) —————
    //
    // `invalid_client` é o segredo do cliente errado NO PAINEL DO RAILWAY. Não é
    // a pessoa (recusa) nem a rede (queda): é configuração. Tratá-lo como
    // recusa escrevia "confira o seu e-mail na área Equipe" na tela de uma sócia
    // que não tem como consertar nada — e apagava o cookie de todo mundo, a cada
    // renovação, enquanto o Marco não olhasse o painel.
    this.configuracao = configuracao
    /** O código OAuth devolvido pela portaria. Vai para o log; nunca para a tela. */
    this.codigo = codigo
    if (causa) this.causa = causa
  }
}

const recusa = (mensagem, codigo = '') => new ErroDaPortaria(mensagem, { foraDoAr: false, codigo })
const queda = (mensagem, causa, codigo = '') => new ErroDaPortaria(mensagem, { foraDoAr: true, causa, codigo })
const erroDeConfiguracao = (mensagem, codigo) =>
  new ErroDaPortaria(mensagem, { foraDoAr: false, configuracao: true, codigo })

const paraB64url = (dados) => Buffer.from(dados).toString('base64url')
const deB64url = (texto) => Buffer.from(String(texto), 'base64url')

/** Codifica um valor como `application/x-www-form-urlencoded`, byte a byte. */
const comoFormulario = (texto) => new URLSearchParams({ v: String(texto ?? '') }).toString().slice(2)

/** Bytes aleatórios em base64url — serve de `state`, de `nonce` e de verificador PKCE. */
export const aleatorio = (bytes = 32) => paraB64url(randomBytes(bytes))

/** O desafio PKCE S256 do verificador. Sem ele a portaria não emite código. */
export const desafioS256 = (verificador) =>
  paraB64url(createHash('sha256').update(verificador, 'ascii').digest())

/** Comparação de tamanho fixo — o `state` que volta da rede não se compara com `===`. */
export function mesmoSegredo(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8')
  const bb = Buffer.from(String(b ?? ''), 'utf8')
  if (ba.length === 0 || ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Decodifica uma parte do JWT. Devolve `null` em vez de estourar. */
const lerParteJSON = (parte) => {
  try {
    return JSON.parse(deB64url(parte).toString('utf8'))
  } catch {
    return null
  }
}

/**
 * O `iss` de um ingresso guardado, SEM conferir a assinatura. Devolve `''`
 * quando não se lê. Serve só para decidir se o ingresso vai como
 * `id_token_hint` na saída — nunca para deixar alguém entrar.
 */
const emissorDoIngresso = (idToken) => {
  const partes = String(idToken ?? '').split('.')
  if (partes.length !== 3) return ''
  const claims = lerParteJSON(partes[1])
  return typeof claims?.iss === 'string' ? claims.iss : ''
}

/**
 * O cliente da portaria.
 *
 * `buscar` é injetável: o teste passa um emissor falso com um par Ed25519
 * gerado na hora e assina ingressos de verdade. Um teste que remendasse a
 * conferência por dentro não provaria que a assinatura é conferida.
 */
export function montarPortaria({
  emissor,
  clienteId,
  clienteSegredo,
  origemPublica,
  buscar = fetch,
  agora = () => Date.now(),
  // O teto de espera é injetável só para o teste conseguir provar que ele
  // existe: esperar 8 s de verdade numa bateria seria trocar a prova por fé.
  esperaMs = ESPERA_MS,
} = {}) {
  const base = String(emissor ?? '').replace(/\/+$/, '')
  const redirecionamento = `${String(origemPublica ?? '').replace(/\/+$/, '')}/api/auth/retorno`

  /** A descoberta, em memória. Uma vez por processo. */
  let descoberta = null
  /** `kid` → JWK. A chave gira; quando o `kid` é desconhecido, busca de novo UMA vez. */
  let chaves = new Map()
  /** token de renovação → promessa em andamento. É o "uma renovação por vez". */
  const renovacoes = new Map()

  const pedir = async (endereco, opcoes = {}) => {
    let r
    try {
      // `redirect: 'error'` é de propósito: um pulo no meio do caminho levaria a
      // conversa da casa para outro servidor sem ninguém ver. O endereço da
      // portaria veio da descoberta, e a descoberta já foi conferida — não há
      // pulo legítimo a seguir.
      r = await buscar(endereco, { signal: AbortSignal.timeout(esperaMs), redirect: 'error', ...opcoes })
    } catch (e) {
      throw queda(`Não consegui falar com a portaria (${endereco}): ${e.message}`, e)
    }
    if (r.status >= 300 && r.status < 400) {
      throw queda(`A portaria respondeu com um redirecionamento (${r.status}) em ${endereco}. Nada foi aceito.`)
    }
    return r
  }

  const lerJSON = async (r, endereco) => {
    try {
      return await r.json()
    } catch (e) {
      throw queda(`A portaria respondeu algo que não é JSON em ${endereco}: ${e.message}`, e)
    }
  }

  /**
   * A descoberta. O `issuer` que volta TEM de ser o emissor configurado: uma
   * portaria que se anuncia com outro nome estaria mandando o navegador para
   * uma tela de entrada que não é a da casa.
   */
  async function descobrir() {
    if (descoberta) return descoberta
    const endereco = `${base}/.well-known/openid-configuration`
    const r = await pedir(endereco)
    if (!r.ok) throw queda(`A portaria respondeu ${r.status} na descoberta (${endereco}).`)
    const d = await lerJSON(r, endereco)
    // O `issuer` AUSENTE também não passa. Até 17/09/2026 ele era conferido "se
    // viesse" — e uma descoberta sem `issuer` passava direto, que é justamente o
    // documento que um servidor no meio do caminho consegue devolver.
    //
    // ————— emissor diferente é QUEDA, não recusa (Marco, 17/09/2026) —————
    //
    // Nada é aceito: sem descoberta conferida não há entrada, troca de código
    // nem renovação. Mas quem está errado é o painel (`PORTARIA_EMISSOR`) ou a
    // ordem da troca de endereço da portaria — nunca a pessoa. Como RECUSA,
    // este erro apagava o cookie de todo mundo que estivesse renovando, até
    // alguém olhar o painel. Como QUEDA, o cookie fica e a casa volta sozinha
    // quando o endereço for acertado. É o mesmo tratamento do Studio.
    if (d?.issuer !== base) {
      const quem = d?.issuer == null || d.issuer === '' ? 'ninguém (a descoberta veio sem issuer)' : String(d.issuer)
      throw queda(
        `A portaria em ${base} se apresentou como ${quem}. Nada foi aceito — confira PORTARIA_EMISSOR no painel do Railway: ` +
          'ele tem de ser exatamente o emissor que a portaria anuncia.',
        undefined,
        'emissor_diferente',
      )
    }
    // ————— todo endereço da descoberta é da MESMA origem —————
    //
    // Um `authorization_endpoint` de outra origem manda o navegador digitar a
    // conta Google numa tela que não é a da entrada da casa; um `token_endpoint` de
    // fora recebe o `client_secret` da casa. A descoberta vem pela rede, e nada
    // que vem pela rede escolhe para onde a casa fala.
    const daCasa = new URL(base)
    const conferirEndereco = (valor, nome) => {
      if (valor == null) return null
      let u
      try {
        u = new URL(String(valor))
      } catch {
        throw recusa(`A portaria devolveu um ${nome} que não é endereço: "${valor}". Nada foi aceito.`)
      }
      if (u.origin !== daCasa.origin) {
        throw recusa(
          `A portaria mandou o ${nome} para ${u.host}, e a portaria da casa é ${daCasa.host}. Nada foi aceito.`,
        )
      }
      return u.toString()
    }
    // Os caminhos do contrato ficam de reserva: uma descoberta sem a chave é
    // portaria velha, não motivo para a casa parar. O que vier, porém, é
    // conferido.
    descoberta = {
      autorizacao: conferirEndereco(d.authorization_endpoint, 'endereço de autorização') ?? `${base}/oauth2/authorize`,
      token: conferirEndereco(d.token_endpoint, 'endereço do token') ?? `${base}/oauth2/token`,
      chaves: conferirEndereco(d.jwks_uri, 'endereço das chaves públicas') ?? `${base}/jwks`,
      saida: conferirEndereco(d.end_session_endpoint, 'endereço de saída') ?? `${base}/oauth2/end-session`,
    }
    return descoberta
  }

  async function buscarChaves() {
    const { chaves: endereco } = await descobrir()
    const r = await pedir(endereco)
    if (!r.ok) throw queda(`A portaria respondeu ${r.status} nas chaves públicas (${endereco}).`)
    const d = await lerJSON(r, endereco)
    const novas = new Map(chaves)
    // UNE em vez de TROCAR. Trocar o mapa inteiro derrubava o ingresso EM VOO:
    // quem tinha recebido o ingresso segundos antes do giro da chave chegava
    // aqui com um `kid` que acabara de sair da lista publicada, e virava
    // "assinado com uma chave que a portaria não publica" — recusa, cookie
    // apagado, tela de entrada. A chave velha não vira perigo por continuar em
    // memória: o `exp` de 15 minutos é quem manda no ingresso.
    for (const jwk of d?.keys ?? []) if (jwk?.kid) novas.set(String(jwk.kid), jwk)
    chaves = novas
    return chaves
  }

  /** A chave pública do `kid`. Desconhecido busca `/jwks` de novo — uma vez só. */
  async function chavePara(kid) {
    if (!chaves.has(kid)) await buscarChaves()
    const jwk = chaves.get(kid)
    if (!jwk) throw recusa(`O ingresso foi assinado com uma chave que a portaria não publica (kid ${kid}).`)
    try {
      return createPublicKey({ key: jwk, format: 'jwk' })
    } catch (e) {
      throw recusa(`A chave pública ${kid} da portaria não serve para conferir: ${e.message}`)
    }
  }

  /**
   * Confere o ingresso e devolve as claims.
   *
   * `nonce` só na ENTRADA — na renovação o contrato diz que não há nonce.
   */
  async function conferirIngresso(idToken, { nonce = null, sub = null } = {}) {
    const partes = String(idToken ?? '').split('.')
    if (partes.length !== 3) throw recusa('O ingresso não tem o formato de um JWT.')
    const [cabecalhoB64, corpoB64, assinaturaB64] = partes

    const cabecalho = lerParteJSON(cabecalhoB64)
    if (!cabecalho) throw recusa('Não consegui ler o cabeçalho do ingresso.')
    // `alg: none` é o ataque clássico: quem manda o token escolhe não assinar.
    // Aqui só existe UM algoritmo, e ele é conferido antes de qualquer outra coisa.
    if (cabecalho.alg !== 'EdDSA') {
      throw recusa(`O ingresso veio assinado com "${cabecalho.alg}" e aqui só vale EdDSA.`)
    }
    if (!cabecalho.kid) throw recusa('O ingresso não diz com qual chave foi assinado (kid).')

    const chave = await chavePara(String(cabecalho.kid))
    const assinado = Buffer.from(`${cabecalhoB64}.${corpoB64}`, 'ascii')
    let confere = false
    try {
      confere = verificarAssinatura(null, assinado, chave, deB64url(assinaturaB64))
    } catch {
      confere = false
    }
    if (!confere) throw recusa('A assinatura do ingresso não confere.')

    const claims = lerParteJSON(corpoB64)
    if (!claims) throw recusa('Não consegui ler o conteúdo do ingresso.')

    if (claims.iss !== base) throw recusa(`O ingresso foi emitido por ${claims.iss ?? 'ninguém'}, e não por ${base}.`)
    const audiencia = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!audiencia.includes(clienteId)) {
      throw recusa('O ingresso foi emitido para outro aplicativo da casa, não para o Planejador.')
    }
    const segundos = Math.floor(agora() / 1000)
    if (!Number.isFinite(claims.exp) || claims.exp + FOLGA_DE_RELOGIO_S <= segundos) {
      throw recusa('O ingresso já venceu.')
    }
    if (nonce != null) {
      // Ausente TAMBÉM é recusa. Conferir "se vier" deixaria passar um ingresso
      // sem nonce, que é exatamente o que um ingresso reaproveitado tem.
      if (!claims.nonce) throw recusa('O ingresso veio sem o código do pedido de entrada (nonce).')
      if (!mesmoSegredo(claims.nonce, nonce)) {
        throw recusa('O ingresso não responde ao pedido de entrada que saiu daqui.')
      }
    }
    // Na RENOVAÇÃO, quem volta tem de ser a mesma pessoa que entrou. Um ingresso
    // de outra conta trocaria a dona do cookie sem ninguém pedir nada.
    if (sub != null && String(claims.sub ?? '') !== String(sub)) {
      throw recusa('A portaria devolveu o ingresso de outra pessoa. Por segurança, nada foi aceito.')
    }
    if (claims.email_verified !== true) {
      throw recusa('A conta Google desta pessoa ainda não tem o e-mail verificado.')
    }
    if (!claims.email) throw recusa('O ingresso veio sem e-mail.')
    return claims
  }

  /** `POST /oauth2/token`, com o `Authorization: Basic` do contrato. */
  async function pedirToken(campos) {
    const { token: endereco } = await descobrir()
    // `base64(urlencode(id):urlencode(segredo))` do contrato é a codificação de
    // FORMULÁRIO: espaço vira `+`, e `!'()*~` são codificados. O
    // `encodeURIComponent` deixa esses cinco passar e manda espaço como `%20` —
    // com um segredo que tenha qualquer um deles, a portaria compararia outra
    // coisa e a resposta seria `invalid_client`, que parece segredo errado.
    const credencial = Buffer.from(
      `${comoFormulario(clienteId)}:${comoFormulario(clienteSegredo)}`,
      'utf8',
    ).toString('base64')
    const r = await pedir(endereco, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${credencial}`,
      },
      body: new URLSearchParams(campos).toString(),
    })
    // 5xx é queda da portaria, não recusa — a pessoa não perde a vez.
    if (r.status >= 500) throw queda(`A portaria respondeu ${r.status} ao trocar o ingresso.`)
    const d = await lerJSON(r, endereco)
    if (!r.ok) {
      // ————— o que é RECUSA e o que é QUEDA (afiado em 17/09/2026) —————
      //
      // Recusa é só o que o contrato mediu como recusa: `400` ou `401` COM
      // corpo de erro OAuth. Antes daqui até `429` (limite de requisições da
      // portaria) e `404` (endereço mudou) apagavam o cookie de todo mundo —
      // uma portaria ocupada punha a casa inteira para fora.
      const codigo = typeof d?.error === 'string' ? d.error : ''
      const ehRecusa = (r.status === 400 || r.status === 401) && codigo !== ''
      if (!ehRecusa) {
        throw queda(
          `A portaria respondeu ${r.status} ao trocar o ingresso${codigo ? ` (${codigo})` : ''}.`,
          undefined,
          codigo,
        )
      }
      if (codigo === 'invalid_client') {
        throw erroDeConfiguracao(
          'a chave do Planejador na portaria não confere — é ajuste no painel do Railway, não na Equipe',
          codigo,
        )
      }
      throw recusa(`A portaria recusou: ${d?.error_description ?? codigo ?? `HTTP ${r.status}`}.`, codigo)
    }
    if (!d?.id_token) throw recusa('A portaria respondeu sem ingresso (id_token).', 'sem_id_token')
    // O contrato: toda resposta 200 traz um token de RENOVAÇÃO novo, porque o
    // anterior é trocado a cada uso. Sem ele o cookie guardava `renovacao: ''`
    // calado, e a pessoa caía na porta 15 minutos depois sem motivo aparente.
    // Portaria que responde assim está com defeito — isso é queda, não recusa.
    if (!d?.refresh_token) {
      throw queda(
        'A portaria respondeu sem token de renovação. Nada foi perdido — tente de novo em instantes.',
        undefined,
        'sem_refresh_token',
      )
    }
    return d
  }

  return {
    /** Só para o teste e para a mensagem de erro — nunca sai em resposta. */
    emissor: base,
    redirecionamento,

    descobrir,

    /**
     * O pedido de entrada. Devolve o endereço da portaria e os segredos que
     * ficam no cookie curto até a volta.
     */
    async pedidoDeEntrada({ volta = '/' } = {}) {
      const { autorizacao } = await descobrir()
      const estado = aleatorio()
      const nonce = aleatorio()
      const verificador = aleatorio()
      const endereco = new URL(autorizacao)
      endereco.searchParams.set('response_type', 'code')
      endereco.searchParams.set('client_id', clienteId)
      endereco.searchParams.set('redirect_uri', redirecionamento)
      endereco.searchParams.set('scope', 'openid profile email offline_access')
      endereco.searchParams.set('state', estado)
      endereco.searchParams.set('nonce', nonce)
      endereco.searchParams.set('code_challenge', desafioS256(verificador))
      endereco.searchParams.set('code_challenge_method', 'S256')
      // `criadoEm` é o carimbo: o cookie do pedido dura 10 minutos no navegador,
      // mas quem apaga cookie escolhe quanto tempo guardar. O prazo tem de ser
      // conferido AQUI também.
      return { endereco: endereco.toString(), pedido: { estado, nonce, verificador, volta, criadoEm: agora() } }
    },

    /** Troca do código, com o verificador PKCE. */
    async trocarCodigo({ codigo, verificador }) {
      return pedirToken({
        grant_type: 'authorization_code',
        code: String(codigo ?? ''),
        redirect_uri: redirecionamento,
        code_verifier: String(verificador ?? ''),
      })
    },

    conferirIngresso,

    /**
     * A renovação, UMA POR VEZ.
     *
     * O contrato mediu: dois pedidos no mesmo instante com o mesmo token de
     * renovação disputam a troca, e um recebe `400 invalid_grant` — ou seja, uma
     * aba a mais derrubaria a sócia. Por isso o mapa: a segunda chamada espera a
     * MESMA promessa. Depois de pronta, a promessa fica guardada por 30 s (a
     * janela de eco que o contrato mediu), para o pedido atrasado receber a
     * mesma resposta em vez de disputar de novo.
     */
    renovar(tokenDeRenovacao) {
      const chave = String(tokenDeRenovacao ?? '')
      const emAndamento = renovacoes.get(chave)
      if (emAndamento) return emAndamento
      const promessa = pedirToken({ grant_type: 'refresh_token', refresh_token: chave })
      renovacoes.set(chave, promessa)
      promessa.then(
        () => {
          const t = setTimeout(() => renovacoes.delete(chave), ECO_DA_RENOVACAO_MS)
          t.unref?.()
        },
        () => renovacoes.delete(chave),
      )
      return promessa
    },

    /** Quantas renovações estão guardadas agora. Serve ao teste de "uma por vez". */
    renovacoesGuardadas: () => renovacoes.size,

    /**
     * O endereço de saída. Sem `idToken` guardado não há `id_token_hint`: o
     * cookie daqui já foi apagado e a pessoa volta para a própria entrada.
     *
     * ————— o ingresso de outro emissor (Marco, 17/09/2026) —————
     *
     * A portaria mudou de endereço (`propostas` → `entrar`), e um cookie de
     * antes da troca guarda um ingresso com o `iss` antigo. A portaria recusa
     * esse hint e mostra à sócia uma página em inglês ("The id_token_hint is
     * invalid"). Então o hint só vai quando o `iss` do ingresso guardado é o
     * emissor configurado; senão a saída é a mesma de quem não tem `idToken`.
     * A assinatura NÃO é conferida aqui: o hint não abre porta nenhuma, e este
     * `iss` só decide se ele vai ou não.
     *
     * O `client_id` vai sempre. Medido na biblioteca da portaria: sem hint, ela
     * pede confirmação e só respeita o `post_logout_redirect_uri` quando o
     * pedido diz de qual aplicativo ele é — sem o `client_id`, a pessoa
     * terminava numa página "Logged out." sem caminho de volta.
     */
    async enderecoDeSaida({ idToken } = {}) {
      const { saida } = await descobrir()
      const endereco = new URL(saida)
      if (idToken && emissorDoIngresso(idToken) === base) {
        endereco.searchParams.set('id_token_hint', String(idToken))
      }
      endereco.searchParams.set('client_id', clienteId)
      endereco.searchParams.set('post_logout_redirect_uri', `${String(origemPublica).replace(/\/+$/, '')}/`)
      return endereco.toString()
    },
  }
}

/**
 * O caminho de volta é local?
 *
 * Só caminho deste app, começando com UMA barra. `//evil.example` e
 * `/\evil.example` são endereços absolutos disfarçados — o navegador os lê como
 * "mesmo esquema, outro host" — e endereço absoluto nem chega aqui, porque não
 * começa com barra. Sem esta recusa, `/api/auth/entrar?volta=//evil.example`
 * seria um redirecionador aberto assinado pela casa.
 */
export function voltaLocal(valor, origem = 'https://planejador.invalido') {
  if (typeof valor !== 'string' || valor === '') return false
  // Espaço em volta: o navegador o apara antes de navegar, e o caminho que ele
  // abre passa a ser outro — diferente do que foi conferido aqui.
  if (valor !== valor.trim()) return false
  if (!valor.startsWith('/')) return false
  if (valor[1] === '/' || valor[1] === '\\') return false
  // Barra invertida e caractere de controle viram outra coisa em navegador
  // diferente. O que passa é o que se lê igual em todos. Os bytes estão
  // escritos com ESCAPES: crus, a classe aparecia como `[\\ -]` no editor, que
  // se lê como "barra invertida, espaço e hífen" — e hífen recusado quebraria
  // `/festa-de-natal`.
  if (/[\\\x00-\x1f\x7f]/.test(valor)) return false
  // Cinto e suspensório: resolvido contra a origem da casa, tem de continuar
  // nela. É a rede de baixo para o dia em que um navegador ler alguma coisa de
  // um jeito que o regex acima não previu.
  try {
    if (new URL(valor, origem).origin !== new URL(origem).origin) return false
  } catch {
    return false
  }
  return true
}
