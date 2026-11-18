// teste_ponte_cliente.mjs — metade "lado cliente" da prova de integração da
// ponte entre os dois apps (Sessão H3-I, PLANO-HARDENING-3.md da previsão).
//
// ESTE ARQUIVO É ESPELHO. A fonte canônica vive em
// Financeiro/scripts/teste_ponte_cliente.mjs (aquele repositório tem
// o servidor + o dados_teste.db + a infra de smoke test já madura). Esta
// cópia existe em previsao-eventos/scripts/teste_ponte_cliente.mjs porque o
// CI do GitHub não faz checkout dos dois repos na mesma árvore — enquanto
// isso não existir (ver comentário no workflow), cada repo precisa do
// arquivo local para poder rodar. Mudar um lado exige mudar o outro
// (canônico) à mão; isso está declarado como limitação no relatório da
// sessão.
//
// O QUE ESTE SCRIPT FAZ DE DIFERENTE do smoke test Python (teste_fumaca.py):
// aquele exercita a ponte do lado SERVIDOR (curl/urllib genérico simulando
// requisições). Este importa e roda o CÓDIGO REAL do lado CLIENTE —
// src/lib/financeiro.js, curvaVendas.js, backupExterno.js, chavePonte.js e
// ponteOrigem.js da previsão, sem reescrever nem uma linha deles — contra um
// servidor Financeiro de verdade, na porta de teste. Isso fecha o risco que
// nenhum dos dois lados cobria sozinho: será que a URL/método/cabeçalho que o
// CLIENTE realmente manda continua batendo com o que o SERVIDOR realmente
// espera? Os dois podiam divergir em silêncio e nenhuma suíte perceberia.
//
// Como aponta para a porta de teste sem editar as constantes hardcoded
// (URL_FINANCEIRO/URL_CURVA/URL_BACKUP_FINANCEIRO apontam para
// http://localhost:8777 no código-fonte, de propósito — é a exceção de rede
// aprovada pelo Marco): os módulos aceitam `fetchFn` injetável (o MESMO
// mecanismo que os testes unitários deles já usam, ver *.test.js). Passamos
// um fetchFn que troca só a autoridade (host:porta) da URL que o código real
// pediu para chamar, antes de fazer a chamada de verdade — método, caminho,
// cabeçalhos e corpo continuam 100% os que o código do cliente escreveu.
//
// Variáveis de ambiente esperadas (o teste_ponte.sh define todas):
//   PONTE_PREVISAO_DIR   caminho da raiz do repo previsao-eventos
//   PONTE_URL_BASE       ex.: http://127.0.0.1:58779 (a porta de teste)
//   PONTE_TOKEN          token da ponte que este processo vai chamar de
//                        "correto" (a prova de mordida sabota isto de fora)
//
// Uso: node scripts/teste_ponte_cliente.mjs
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const PREVISAO_DIR = process.env.PONTE_PREVISAO_DIR
const URL_BASE = process.env.PONTE_URL_BASE
const TOKEN_CERTO = process.env.PONTE_TOKEN
const FINANCEIRO_DIR = process.env.PONTE_FINANCEIRO_DIR

if (!PREVISAO_DIR || !URL_BASE || !TOKEN_CERTO || !FINANCEIRO_DIR) {
  console.error(
    'teste_ponte_cliente.mjs: faltam variáveis de ambiente ' +
      '(PONTE_PREVISAO_DIR, PONTE_URL_BASE, PONTE_TOKEN, PONTE_FINANCEIRO_DIR).'
  )
  process.exit(1)
}

// Polyfill mínimo de localStorage — os módulos da previsão testam
// `typeof localStorage !== 'undefined'` antes de usar; Node não tem esse
// global embutido. Só precisa das 3 operações que chavePonte.js/curvaVendas.js
// usam.
const _mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(String(k), String(v)),
  removeItem: (k) => _mem.delete(k),
}

const importarDaPrevisao = (relPath) =>
  import(pathToFileURL(join(PREVISAO_DIR, 'src/lib', relPath)).href)

const financeiro = await importarDaPrevisao('financeiro.js')
const curvaVendas = await importarDaPrevisao('curvaVendas.js')
const backupExterno = await importarDaPrevisao('backupExterno.js')
const chavePonte = await importarDaPrevisao('chavePonte.js')
const ponteOrigem = await importarDaPrevisao('ponteOrigem.js')

let falhas = 0
const checar = (cond, msg) => {
  console.log(`  [${cond ? 'ok' : 'FALHOU'}] ${msg}`)
  if (!cond) falhas++
}

// Troca só host:porta da URL real por variáveis do que o próprio código-fonte
// pediu para chamar — método, rota, cabeçalhos e corpo continuam do código
// real. `HOST_REAL` é o único endereço que os 3 módulos conhecem hardcoded.
const HOST_REAL = 'http://localhost:8777'
const paraPortaDeTeste = (url) => url.replace(HOST_REAL, URL_BASE)

function fetchDeTeste(origemInjetada) {
  let chamou = false
  const fn = async (url, opts = {}) => {
    chamou = true
    const alvo = paraPortaDeTeste(url)
    const headers = { ...(opts.headers || {}) }
    if (origemInjetada) headers.Origin = origemInjetada
    return fetch(alvo, { ...opts, headers })
  }
  fn.foiChamado = () => chamou
  return fn
}

console.log('— ponte (lado cliente): GET eventos e GET curva com o código real —')

// GRUPO 1 — round-trip real das duas rotas GET, com o parser de verdade do
// cliente (validarEventosFinanceiro / validarCurvaFinanceiro rodam por
// dentro das funções abaixo — se o formato do servidor mudasse, o parser
// devolveria null e a função lançaria MSG_RESPOSTA_ESTRANHA).
try {
  const eventos = await financeiro.buscarEventosFinanceiro(
    fetchDeTeste(ponteOrigem.ORIGEM_PONTE),
    ponteOrigem.ORIGEM_PONTE
  )
  checar(Array.isArray(eventos), 'GET /api/previsao/eventos: o cliente real parseou uma lista')
} catch (e) {
  checar(false, `GET /api/previsao/eventos não deveria lançar erro (${e.message})`)
}

try {
  const curva = await curvaVendas.buscarCurvaFinanceiro(
    fetchDeTeste(ponteOrigem.ORIGEM_PONTE),
    ponteOrigem.ORIGEM_PONTE
  )
  checar(
    curva && Array.isArray(curva.eventos) && Array.isArray(curva.eventosSemData),
    'GET /api/previsao/curva: o cliente real parseou {eventos, eventosSemData}'
  )
} catch (e) {
  checar(false, `GET /api/previsao/curva não deveria lançar erro (${e.message})`)
}

console.log('— ponte (lado cliente): cabeçalho CORS visto pela URL que o cliente realmente chama —')

// GRUPO 2 — as 3 URLs são as CONSTANTES exportadas pelos módulos reais
// (não reescritas à mão aqui) — se o cliente e o servidor um dia divergirem
// de rota, isto vira 404 em vez de silenciosamente "passar".
async function corsHeader(urlReal, origem) {
  const res = await fetch(paraPortaDeTeste(urlReal), { headers: origem ? { Origin: origem } : {} })
  return res.headers.get('access-control-allow-origin')
}

checar(
  (await corsHeader(financeiro.URL_FINANCEIRO, ponteOrigem.ORIGEM_PONTE)) === ponteOrigem.ORIGEM_PONTE,
  'GET eventos: origem autorizada (4173) recebe o cabeçalho CORS'
)
checar(
  (await corsHeader(financeiro.URL_FINANCEIRO, 'http://evil.example')) == null,
  'GET eventos: origem não autorizada não recebe cabeçalho CORS'
)
checar(
  (await corsHeader(curvaVendas.URL_CURVA, ponteOrigem.ORIGEM_PONTE)) === ponteOrigem.ORIGEM_PONTE,
  'GET curva: origem autorizada (4173) recebe o cabeçalho CORS'
)
checar(
  (await corsHeader(curvaVendas.URL_CURVA, 'http://evil.example')) == null,
  'GET curva: origem não autorizada não recebe cabeçalho CORS'
)

console.log('— ponte (lado cliente): POST de backup com o código real de backupExterno.js —')

// store mínimo (só precisa passar storeTemDados — ver protecao.js)
const store = { eventos: [{ id: 'ev-ponte-teste', nome: 'Evento da prova de ponte' }], benchmarksCustom: [] }

// GRUPO 3 — chavePonte.js de verdade: simula o Marco colando o token em
// Ajustes › Backup (salva no localStorage, lê de volta).
chavePonte.saveChavePonte(TOKEN_CERTO)
checar(chavePonte.loadChavePonte() === TOKEN_CERTO, 'chavePonte.js: token colado é lido de volta igual')

// GRUPO 4 — credencial certa → sucesso real (grava arquivo, round-trip
// completo com o servidor de teste)
{
  const r = await backupExterno.enviarBackupExterno(
    store,
    fetchDeTeste(ponteOrigem.ORIGEM_PONTE),
    chavePonte.loadChavePonte(),
    ponteOrigem.ORIGEM_PONTE
  )
  checar(r.ok === true && !!r.arquivo, 'POST backup com token certo → sucesso (arquivo gravado)')
}

// GRUPO 5 — credencial errada → 403 traduzido pelo cliente real como motivo 'token'
{
  const r = await backupExterno.enviarBackupExterno(
    store,
    fetchDeTeste(ponteOrigem.ORIGEM_PONTE),
    'token-errado-de-proposito-ponte',
    ponteOrigem.ORIGEM_PONTE
  )
  checar(r.ok === false && r.motivo === 'token', "POST backup com token errado → recusado (motivo 'token')")
}

// GRUPO 6 — mutação SEM credencial: o cliente real nem toca a rede (guarda
// própria) — e, em paralelo, o SERVIDOR real também recusa por conta própria
// (defesa em profundidade) se alguém pular a guarda do cliente.
{
  const fn = fetchDeTeste(ponteOrigem.ORIGEM_PONTE)
  const r = await backupExterno.enviarBackupExterno(store, fn, '', ponteOrigem.ORIGEM_PONTE)
  checar(
    r.ok === false && r.motivo === 'sem-token' && !fn.foiChamado(),
    "POST backup sem credencial: o cliente recusa ANTES de tocar a rede (motivo 'sem-token')"
  )
}
{
  const res = await fetch(paraPortaDeTeste(backupExterno.URL_BACKUP_FINANCEIRO), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ponteOrigem.ORIGEM_PONTE },
    body: JSON.stringify({ app: 'previsao-eventos', eventos: [] }),
  })
  checar(res.status === 403, 'POST backup sem cabeçalho X-Ponte-Token: o SERVIDOR recusa com 403 mesmo assim')
}

console.log('— ponte: contrato de origem visto dos dois lados —')

// GRUPO 7 — ORIGEM_PONTE (previsão) == ORIGEM_PREVISAO (Financeiro): os dois
// lados são o MESMO contrato, cada um com seu próprio nome de constante — se
// alguém mudar um sem o outro, a ponte quebra em silêncio (é exatamente o
// risco que a bala (d) do plano pede para travar).
const configPy = readFileSync(join(FINANCEIRO_DIR, 'backend/config.py'), 'utf8')
const m = configPy.match(/ORIGEM_PREVISAO\s*=\s*"([^"]+)"/)
checar(!!m, 'consegui ler ORIGEM_PREVISAO de backend/config.py do Financeiro')
if (m) {
  checar(
    m[1] === ponteOrigem.ORIGEM_PONTE,
    `ORIGEM_PONTE (previsão, "${ponteOrigem.ORIGEM_PONTE}") == ORIGEM_PREVISAO (Financeiro, "${m[1]}")`
  )
}

console.log('')
if (falhas > 0) {
  console.error(`✗ ${falhas} verificação(ões) do lado cliente da ponte falharam.`)
  process.exit(1)
}
console.log('✓ lado cliente da ponte: todas as verificações passaram.')
