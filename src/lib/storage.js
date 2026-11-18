// Persistência em localStorage + backup JSON.
// Todo evento que ENTRA no app (localStorage ou backup) passa por migrarEventos
// — campos novos opcionais ganham forma padrão, nada existente é alterado
// (Sessão E; testes de round-trip em migracao.test.js e storage round-trip).
// Campo ADITIVO `ajustes` (Sessão P — sugestão 20): premissas por festa;
// ausente (store/backup antigo) vira o vazio "herda tudo" — nada muda.
// Campo ADITIVO `benchmarksOcultos` (Sessão Q — sugestão 25): lista de IDs de
// benchmarks ocultos das comparações; ausente = [] = nada oculto. Só IDs —
// os números dos benchmarks nunca são alterados nem apagados por aqui.
// Campos ADITIVOS `benchmarksPadrao` e `benchmarksApagados` (Sessão de Gestão
// de Benchmarks — 19/07/2026): o padrão adotado pelo Marco por benchmark
// (id→valores) e os embutidos apagados (lista de IDs). Ambos ausentes em
// backup/store antigo viram o vazio ({} e []) — nada muda; a fábrica
// (FIXED_BENCHMARKS) segue no código, sempre recuperável.
// Campos ADITIVOS `bilheteriaBruta` e `reguaTicket` DENTRO de cada benchmark
// (decisão 6 do Marco, 25/07/2026): a bilheteria bruta da festa e a conta que
// produziu o ticket. `migrarBenchmarks` sane um valor impossível e NUNCA cria
// nenhum dos dois — benchmark antigo entra e sai o MESMO OBJETO, que é a
// restrição datada de 20/07/2026 ("não mude benchmarks antigos já lançados").

import { migrarEventos, migrarBenchmarks, normalizarReceitaRealizadaDoImport } from './migracao.js'
import { hojeISO } from './dataLocal.js'
import { uid } from './util.js'
import { benchmarksOcultosIds, benchmarksApagadosIds } from './benchmarks.js'
import { formaAjustes, ajustesVazio } from './premissas.js'

const KEY = 'previsao-eventos:v1'

// ————— Identidade e versão do ENVELOPE de backup (item E2, 22/07/2026) —————
//
// O export SEMPRE carimbou os dois (commit 2e96d68, 17/07): `app` diz de qual
// app da casa é o arquivo; `versao` é o formato do ENVELOPE (não o schema de
// cada evento — campos novos de evento são aditivos e a migração os resolve,
// por isso o envelope segue na versão 1). O que faltava era o IMPORT CONFERIR:
// sem isso, um backup "versão 999" ou de OUTRO app entrava como se fosse desta
// app, em silêncio (BACKLOG "Backup adulterado/hostil aceito em silêncio",
// caso 3). Uma constante só: montarBackup ESCREVE, parseBackup CONFERE o mesmo
// número — não há como os dois divergirem.
export const APP_ID = 'previsao-eventos'
export const VERSAO_BACKUP = 1

// Onde o dado ilegível é preservado quando a leitura falha (ver o bloco grande
// em loadStore). Chave PRÓPRIA, com carimbo de hora: a quarentena nunca
// sobrescreve o store, e uma falha nova nunca sobrescreve a quarentena antiga.
const PREFIXO_QUARENTENA = 'previsao-eventos:quarentena:'

// ————— Falha de LEITURA: o estado mais perigoso do app —————
//
// (Verificação adversarial 19/07/2026 — o achado mais grave da lista.) Antes,
// `loadStore()` engolia um JSON corrompido com um console.error e devolvia o
// store VAZIO. Duas consequências, a segunda pior que a primeira:
//   (a) o app abria como se o Marco nunca o tivesse usado — sem nada na tela
//       dizendo que aquilo não era a lista dele;
//   (b) ele começava a mexer e o auto-save do App gravava o VAZIO por cima do
//       dado corrompido — corrupção recuperável virava perda definitiva.
//
// Agora a leitura que falha deixa uma marca aqui, e essa marca faz três coisas,
// nesta ordem de importância: preserva o bruto (quarentena), TRAVA a gravação
// (saveStore recusa enquanto ela existir) e dá ao App o que dizer na tela.
//
// Sai daqui só por `liberarGravacao()` — chamada por uma ação deliberada do
// Marco que substitui o store inteiro (restaurar um snapshot). Não há saída
// automática de propósito: o que destravaria sozinho voltaria a gravar sozinho.
let falhaLeitura = null

/** O que houve na última leitura falha (ou null). Para a faixa de aviso. */
export function estadoLeitura() {
  return falhaLeitura
}

/** Enquanto true, saveStore recusa gravar — nada passa por cima do corrompido. */
export function gravacaoBloqueada() {
  return falhaLeitura !== null
}

/**
 * Destrava a gravação. Chamada pelo caminho de volta (restaurar um snapshot):
 * ali o Marco está substituindo o store inteiro de propósito, que é exatamente
 * a hora em que gravar volta a ser o certo. Devolve a falha que estava ativa.
 */
export function liberarGravacao() {
  const anterior = falhaLeitura
  falhaLeitura = null
  return anterior
}

/**
 * Copia a string ilegível para uma chave de quarentena. É a PRIMEIRA coisa que
 * acontece quando a leitura falha: mesmo que o parse jamais volte a funcionar,
 * o conteúdo original continua existindo e dá para exportar e periciar.
 *
 * Recarregar a página não multiplica cópias: se alguma quarentena já guarda
 * exatamente este conteúdo, ela é reusada — encher a quota com cópias iguais
 * consumiria justamente o espaço de que o resgate precisa.
 */
function guardarNaQuarentena(raw, agoraIso) {
  try {
    if (typeof localStorage === 'undefined') return { ok: false, erro: 'sem armazenamento' }
    if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(PREFIXO_QUARENTENA) && localStorage.getItem(k) === raw)
          return { ok: true, chave: k, reusada: true }
      }
    }
    const chave = `${PREFIXO_QUARENTENA}${agoraIso}`
    localStorage.setItem(chave, raw)
    return { ok: true, chave, reusada: false }
  } catch (e) {
    console.error('Erro ao guardar o dado ilegível na quarentena', e)
    return { ok: false, erro: e?.message || 'não foi possível guardar a cópia' }
  }
}

/** Chaves de quarentena existentes, da mais recente para a mais antiga. */
export function listarQuarentena() {
  try {
    if (typeof localStorage === 'undefined') return []
    if (typeof localStorage.length !== 'number' || typeof localStorage.key !== 'function') return []
    const chaves = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIXO_QUARENTENA)) chaves.push(k)
    }
    return chaves.sort().reverse()
  } catch (e) {
    console.error('Erro ao listar a quarentena', e)
    return []
  }
}

/**
 * Baixa como arquivo o conteúdo bruto guardado na quarentena. É o "leve o dado
 * embora" da faixa de aviso: sai do navegador, vira arquivo, para de depender
 * de um localStorage que já deu problema uma vez.
 */
export function exportarQuarentena(chave) {
  const alvo = chave || listarQuarentena()[0]
  if (!alvo) return { ok: false, erro: 'não há nada na quarentena' }
  const bruto = localStorage.getItem(alvo)
  if (bruto == null) return { ok: false, erro: 'a cópia da quarentena não está mais lá' }
  const blob = new Blob([bruto], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `previsao-eventos-BRUTO-ILEGIVEL-${alvo.slice(PREFIXO_QUARENTENA.length).slice(0, 19).replace(/[:.]/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  return { ok: true, chave: alvo, bytes: bruto.length }
}

// ————— Corrupção que PARSEIA (verificação de 20/07/2026) —————
//
// A defesa acima só armava quando o JSON.parse LANÇAVA. Mas há corrupção que
// parseia limpo e não é store nenhum: `[]`, `0`, `{"versao":1}`,
// `{"eventos":null}`, `{"eventos":"undefined"}`, `{"eventos":{"0":{…}}}`.
// Nesses casos a linha `Array.isArray(d.eventos) ? d.eventos : []` COAGIA em
// silêncio: o app abria vazio, sem quarentena, sem trava, sem aviso — e o
// auto-save gravava o vazio por cima. Mesmo estrago do parse quebrado, por
// uma porta que ninguém estava olhando.
//
// A regra agora é a do importador de backup (que já era estrito): formato que
// não parece um store desta app é CORRUPÇÃO, não "comece do zero". Quem
// recusa aqui manda o caso para o mesmo catch — quarentena, trava e aviso.
//
// O outro lado da moeda, testado com o mesmo peso: `{"eventos":[]}` é o store
// de quem apagou todos os eventos, e ausência total da chave é a PRIMEIRA VEZ
// no app. Nenhum dos dois é corrupção e nenhum dos dois pode assustar ninguém.
function descreverConteudo(v) {
  if (v === null) return 'nulo'
  if (Array.isArray(v)) return 'uma lista'
  if (typeof v === 'object') return 'um conjunto sem a lista de eventos'
  return `um ${typeof v === 'number' ? 'número' : typeof v === 'string' ? 'texto' : 'valor'} solto`
}

// Describer do CONTAINER de uma lista do evento (`lotes`, `categorias`,
// `patrocinios`, `categorias[].itens`). Separado do `descreverConteudo` acima
// de propósito: aquele fala do ENVELOPE do backup e, para um objeto, diz "um
// conjunto sem a lista de eventos" — frase que estaria errada aqui, onde o
// objeto está no lugar de uma lista de LOTES, não de eventos.
function descreverContainer(v) {
  if (Array.isArray(v)) return 'uma lista'
  if (v === null) return 'nulo'
  if (typeof v === 'object') return 'um conjunto de chaves e valores'
  if (typeof v === 'number') return `um número (${v})`
  if (typeof v === 'string') return 'um texto'
  if (typeof v === 'boolean') return 'um sim/não'
  return 'um valor solto'
}

// É lista, ou é o vazio que o app já trata como lista vazia?
//
// A fronteira do falso positivo mora AQUI, e foi medida (26/07/2026): com a
// chave AUSENTE ou `null`, o app roda inteiro — `(lotes || []).map` e
// `(categorias || []).map` tratam os dois como lista vazia e a festa fecha em
// R$ 0 sem estourar. Backup antigo é exatamente esse caso (as chaves nem
// existiam). Recusar `null` seria recusar trabalho legítimo do Marco, então a
// trava recusa só o que QUEBRA ou MENTE: um valor que não é lista nem vazio.
const listaOuVazio = (v) => v == null || Array.isArray(v)

function conferirFormato(d) {
  if (d === null || typeof d !== 'object' || Array.isArray(d))
    throw new Error(
      `o conteúdo salvo não tem a forma dos dados deste app (é ${descreverConteudo(d)})`
    )
  if (!Array.isArray(d.eventos))
    throw new Error(
      `o conteúdo salvo não traz a lista de eventos no formato esperado (veio ${descreverConteudo(d.eventos)})`
    )
  const ruim = d.eventos.findIndex((e) => !e || typeof e !== 'object' || Array.isArray(e))
  if (ruim !== -1)
    throw new Error(
      `o evento nº ${ruim + 1} da lista salva não tem forma de evento (é ${descreverConteudo(d.eventos[ruim])})`
    )
}

const vazio = () => ({
  eventos: [],
  benchmarksCustom: [],
  benchmarkOverrides: {},
  benchmarksPadrao: {},
  benchmarksOcultos: [],
  benchmarksApagados: [],
  ajustes: ajustesVazio(),
})

export function loadStore() {
  // `raw` mora FORA do try porque o catch precisa dele: é o dado do Marco, e
  // preservá-lo é a primeira obrigação quando o parse falha.
  let raw = null
  try {
    if (typeof localStorage === 'undefined') return vazio()
    raw = localStorage.getItem(KEY)
    // Sem nada gravado = PRIMEIRA VEZ no app, não falha. A distinção é o que
    // impede a faixa de socorro de assustar quem está começando: store vazio
    // legítimo passa por aqui e nunca marca `falhaLeitura`.
    if (!raw) return vazio()
    const d = JSON.parse(raw)
    // Parsear não basta: o conteúdo tem de TER a forma de um store (ver o
    // bloco de conferirFormato). O que não tem cai no catch como corrupção.
    conferirFormato(d)
    return {
      eventos: migrarEventos(d.eventos),
      benchmarksCustom: migrarBenchmarks(d.benchmarksCustom),
      benchmarkOverrides:
        d.benchmarkOverrides && typeof d.benchmarkOverrides === 'object'
          ? d.benchmarkOverrides
          : {},
      benchmarksPadrao:
        d.benchmarksPadrao && typeof d.benchmarksPadrao === 'object' ? d.benchmarksPadrao : {},
      benchmarksOcultos: benchmarksOcultosIds(d),
      benchmarksApagados: benchmarksApagadosIds(d),
      ajustes: formaAjustes(d.ajustes),
    }
  } catch (e) {
    // O dado existe e não abre. Ordem proposital, do mais grave para o menos:
    //   (a) preservar o bruto — mesmo que o parse jamais funcione, nada some;
    //   (b) marcar a falha, o que TRAVA saveStore: o auto-save não vai gravar
    //       o vazio por cima do que sobrou;
    //   (c) guardar o texto do que houve, para o App avisar na tela.
    // A trava de (b) também é o que protege o próprio bruto no lugar original:
    // com a gravação parada, a chave corrompida continua lá, intacta, mesmo se
    // a quarentena tiver falhado por falta de espaço.
    const emIso = new Date().toISOString()
    const q = guardarNaQuarentena(raw, emIso)
    falhaLeitura = {
      em: emIso,
      erro: e?.message || 'conteúdo ilegível',
      bytes: typeof raw === 'string' ? raw.length : 0,
      quarentenaOk: !!q.ok,
      chaveQuarentena: q.chave || null,
    }
    console.error('Erro ao carregar dados salvos — gravação BLOQUEADA, bruto na quarentena', e)
    return vazio()
  }
}

// Salva o store. NUNCA lança e NUNCA falha em silêncio (hardening 4.1):
// devolve { ok:false, erro } para o App mostrar a faixa de socorro — o dado
// continua em memória e o export JSON continua funcionando sem localStorage.
export function saveStore(store) {
  // A trava (b) do resgate de leitura, e a razão de ela vir ANTES de tudo:
  // enquanto a leitura falhou, nenhuma gravação encosta no localStorage. Este
  // `return` é o que separa "susto recuperável" de "perda definitiva" — sem
  // ele, o auto-save do App grava o store vazio por cima do dado corrompido no
  // primeiro clique do Marco.
  if (falhaLeitura) {
    return {
      ok: false,
      bloqueado: true,
      erro:
        'gravação bloqueada porque não foi possível LER os dados salvos — o conteúdo original continua intacto no navegador',
    }
  }
  try {
    if (typeof localStorage === 'undefined')
      return { ok: false, erro: 'sem armazenamento neste ambiente' }
    localStorage.setItem(KEY, JSON.stringify(store))
    return { ok: true }
  } catch (e) {
    console.error('Erro ao salvar', e)
    return { ok: false, erro: e?.message || 'armazenamento do navegador cheio' }
  }
}

// Payload do backup JSON — usado pelo export manual (arquivo baixado) E pelo
// backup externo automático (backupExterno.js). Um gerador só: o arquivo que
// o Financeiro guarda é byte a byte o mesmo que o export manual produziria.
export function montarBackup(store) {
  return {
    app: APP_ID,
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    eventos: store.eventos,
    benchmarksCustom: store.benchmarksCustom,
    benchmarkOverrides: store.benchmarkOverrides || {},
    benchmarksPadrao: store.benchmarksPadrao || {},
    benchmarksOcultos: benchmarksOcultosIds(store),
    benchmarksApagados: benchmarksApagadosIds(store),
    ajustes: formaAjustes(store.ajustes),
  }
}

export function exportBackup(store) {
  const payload = montarBackup(store)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `previsao-eventos-backup-${hojeISO()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function parseBackup(text) {
  const d = JSON.parse(text)
  if (!d || !Array.isArray(d.eventos)) throw new Error('Arquivo de backup inválido')
  // ————— Identidade + versão do envelope (item E2, 22/07/2026) —————
  // O export carimba `app`+`versao`; o import agora CONFERE (antes qualquer
  // coisa entrava como v1 — BACKLOG "versao nunca é conferida", caso 3). Três
  // portas, todas HONESTAS (princípio 4 — nada em silêncio):
  //   • `app` de OUTRO app → recusa NOMEANDO (não é backup desta app);
  //   • `versao` MAIOR que a atual → recusa (este app é velho demais p/ ler);
  //   • sem identidade (`app` ausente = backup pré-17/07) → ACEITA, mas marca
  //     `formatoAntigo` para a tela avisar antes de aplicar. A heurística que o
  //     deixa entrar é a que já existia: o `Array.isArray(d.eventos)` acima.
  // Backup COM identidade certa e versão ≤ atual segue o caminho de sempre.
  // (A `versao` é coagida com Number() de propósito: um backup editado à mão
  // pode trazer "999" como texto — o número absurdo tem de ser barrado igual.)
  if (d.app != null && d.app !== APP_ID)
    throw new Error(
      `Este arquivo é do app "${d.app}", não do Planejamento de Eventos — nada foi importado.`
    )
  const versaoArquivo = Number(d.versao)
  if (Number.isFinite(versaoArquivo) && versaoArquivo > VERSAO_BACKUP)
    throw new Error(
      `Este backup é de uma versão mais nova do app (versão ${d.versao}) do que esta ` +
        `(versão ${VERSAO_BACKUP}) — atualize o app antes de importar. Nada foi importado.`
    )
  // Régua do backup mexido à mão (Marco, 25/07/2026, caso 3 — "entra, com
  // aviso"): backup COM identidade desta casa mas SEM carimbo de versão
  // legível (chave ausente, ou texto que não é número — "abc") reusa o MESMO
  // aviso do formato antigo, em vez de entrar calado como se fosse a versão
  // atual. Medido: com `d.versao` ausente, `Number(undefined)` é NaN, a
  // checagem de versão futura logo acima não dispara, e sem esta linha o
  // arquivo seguia com `formatoAntigo=false` — nenhum aviso na tela.
  const formatoAntigo = d.app == null || !Number.isFinite(versaoArquivo)
  // Evento-lixo (null/string/número/array) recusado AQUI, em português — a
  // mesma régua que o conferirFormato já aplica na leitura do localStorage.
  // Sem isto, o lixo atravessava o parse e o mesclarBackup estourava DENTRO
  // do updater do setStore: tela morta no lugar de "Não foi possível
  // importar" (achado adversarial 20/07/2026; o snapshot tirado antes já
  // segurava o dado — o buraco era a honestidade do erro).
  const ruim = d.eventos.findIndex((e) => !e || typeof e !== 'object' || Array.isArray(e))
  if (ruim !== -1)
    throw new Error(
      `o evento nº ${ruim + 1} do arquivo não tem forma de evento (é ${descreverConteudo(d.eventos[ruim])}) — o backup parece editado ou corrompido; nada foi importado`
    )
  // ————— CONTAINER de tipo errado no lugar da LISTA —————
  // (Marco, 26/07/2026, questionário: "as duas coisas — recusar na porta E
  // rede na tela". Esta é a porta; a rede é o RedeDeSeguranca.jsx.)
  //
  // As travas de 25/07/2026 logo abaixo cuidam do lixo DENTRO de cada lista, e
  // todas começam com `if (!Array.isArray(evento.lotes)) continue` — então o
  // caso em que a LISTA INTEIRA não é lista passava por cima delas. Medido
  // sobre este mesmo parseBackup, com `"lotes": {"a": 1}` num backup válido no
  // resto:
  //   • `lotes` como conjunto      → parseBackup devolvia OK e depois
  //     computeCenarios estourava "object is not iterable (cannot read
  //     property Symbol(Symbol.iterator))";
  //   • `categorias` como conjunto → "(categorias || []).map is not a function";
  //   • `categorias[].itens`       → "itens.reduce is not a function";
  //   • `patrocinios` como conjunto → NÃO estourava, e é o pior dos quatro: a
  //     festa que mostrava R$ 26.850 de lucro passava a mostrar R$ 11.850 —
  //     R$ 15.000 de patrocínio somindo em silêncio, porque a migração só lê
  //     `patrocinios` quando é lista e cai no caminho antigo
  //     (`outrasReceitas.patrocinio`, vazio) quando não é. Número errado
  //     mostrado como certo: S1.
  //
  // Como o Ajustes GRAVA o store antes de renderizar, os três primeiros
  // deixavam o evento envenenado no localStorage e a Home morria a cada
  // abertura. A recusa aqui é o que impede o dado ruim de entrar; a rede na
  // tela é o que salva quem já o tem salvo.
  //
  // A fronteira do falso positivo é o `listaOuVazio`: ausente e `null` seguem
  // entrando (o app já os trata como lista vazia — é o backup antigo).
  const VETORES_DO_EVENTO = [
    ['lotes', 'a lista de lotes'],
    ['categorias', 'a lista de categorias de custo'],
    ['patrocinios', 'a lista de patrocínios'],
  ]
  for (const evento of d.eventos) {
    const nomeEvento =
      typeof evento.nome === 'string' && evento.nome.trim() ? evento.nome.trim() : '(sem nome)'
    for (const [campo, oQueDeveriaSer] of VETORES_DO_EVENTO) {
      if (listaOuVazio(evento[campo])) continue
      throw new Error(
        `o evento "${nomeEvento}" traz "${campo}" onde deveria haver ${oQueDeveriaSer} ` +
          `(veio ${descreverContainer(evento[campo])}) — o backup parece editado ou ` +
          `corrompido; nada foi importado`
      )
    }
    // Um nível mais fundo: a lista de itens DENTRO de cada categoria.
    if (!Array.isArray(evento.categorias)) continue
    for (const cat of evento.categorias) {
      if (!cat || typeof cat !== 'object' || Array.isArray(cat)) continue
      if (listaOuVazio(cat.itens)) continue
      const nomeCategoria =
        typeof cat.nome === 'string' && cat.nome.trim() ? cat.nome.trim() : '(sem nome)'
      throw new Error(
        `o evento "${nomeEvento}", categoria "${nomeCategoria}" traz "itens" onde deveria ` +
          `haver a lista de itens de custo (veio ${descreverContainer(cat.itens)}) — o backup ` +
          `parece editado ou corrompido; nada foi importado`
      )
    }
  }
  // Item de custo NULO (ou não-objeto) dentro de uma categoria — a mesma
  // classe de lixo que o evento-lixo acima já barra, um nível mais fundo
  // (régua do backup mexido à mão, Marco 25/07/2026, caso 1 — "recusa o que
  // quebra"). Medido: sem esta trava, o item nulo atravessava a migração
  // (formaItemCusto devolve o não-objeto como veio, migracao.js) e a conta de
  // custos ESTOURAVA dentro de custosPorCategoria ("Cannot read properties of
  // null (reading 'estimado')", calc.js) — tela morta em vez de "Não foi
  // possível importar". Nomeia o EVENTO e a CATEGORIA para o Marco achar onde
  // consertar (princípio 4 — nada em silêncio).
  for (let ei = 0; ei < d.eventos.length; ei++) {
    const evento = d.eventos[ei]
    if (!evento || typeof evento !== 'object' || !Array.isArray(evento.categorias)) continue
    const nomeEvento =
      typeof evento.nome === 'string' && evento.nome.trim() ? evento.nome.trim() : '(sem nome)'
    for (const cat of evento.categorias) {
      if (!cat || typeof cat !== 'object' || !Array.isArray(cat.itens)) continue
      const nomeCategoria =
        typeof cat.nome === 'string' && cat.nome.trim() ? cat.nome.trim() : '(sem nome)'
      const idxRuim = cat.itens.findIndex((i) => !i || typeof i !== 'object' || Array.isArray(i))
      if (idxRuim !== -1)
        throw new Error(
          `o evento "${nomeEvento}", categoria "${nomeCategoria}", item nº ${idxRuim + 1} não tem forma de item de custo (é ${descreverConteudo(cat.itens[idxRuim])}) — o backup parece editado ou corrompido; nada foi importado`
        )
    }
  }
  // Lote NULO (ou não-objeto) dentro da lista de lotes de um evento — o vetor
  // que o provador adversarial achou fora da régua de 25/07/2026 (a recusa
  // acima só cobria `categorias[].itens[]`; Marco, 25/07/2026, aprovou
  // estender a mesma régua aos outros vetores do evento). Medido: sem esta
  // trava, o lote nulo sobrevive à migração (migracao.js devolve `l` intocado
  // quando não é objeto — só formata quando `l && typeof l === 'object'`) e o
  // cálculo do cenário ESTOURA em `l.id` ("Cannot read properties of null
  // (reading 'id')", calc.js/computeCenario) — tela morta em vez de "Não foi
  // possível importar".
  for (let ei = 0; ei < d.eventos.length; ei++) {
    const evento = d.eventos[ei]
    if (!evento || typeof evento !== 'object' || !Array.isArray(evento.lotes)) continue
    const nomeEvento =
      typeof evento.nome === 'string' && evento.nome.trim() ? evento.nome.trim() : '(sem nome)'
    const idxRuim = evento.lotes.findIndex((l) => !l || typeof l !== 'object' || Array.isArray(l))
    if (idxRuim !== -1)
      throw new Error(
        `o evento "${nomeEvento}", lote nº ${idxRuim + 1} não tem forma de lote (é ${descreverConteudo(evento.lotes[idxRuim])}) — o backup parece editado ou corrompido; nada foi importado`
      )
  }
  // Patrocínio NULO (ou não-objeto) dentro da lista de patrocínios — mesma
  // extensão (Marco, 25/07/2026). Medido: aqui NÃO há estouro — formaPatro-
  // cinioItem (migracao.js) já devolve null para entrada não-objeto e o
  // `.filter(Boolean)` que monta a lista final descarta o null — mas
  // descartar CALADO é a mesma falta que o princípio 4 proíbe: o patrocínio
  // some do backup sem o Marco saber que sumiu. A recusa aqui troca o
  // sumiço silencioso pela mensagem em português, como os outros vetores.
  for (let ei = 0; ei < d.eventos.length; ei++) {
    const evento = d.eventos[ei]
    if (!evento || typeof evento !== 'object' || !Array.isArray(evento.patrocinios)) continue
    const nomeEvento =
      typeof evento.nome === 'string' && evento.nome.trim() ? evento.nome.trim() : '(sem nome)'
    const idxRuim = evento.patrocinios.findIndex(
      (p) => !p || typeof p !== 'object' || Array.isArray(p)
    )
    if (idxRuim !== -1)
      throw new Error(
        `o evento "${nomeEvento}", patrocínio nº ${idxRuim + 1} não tem forma de patrocínio (é ${descreverConteudo(evento.patrocinios[idxRuim])}) — o backup parece editado ou corrompido; nada foi importado`
      )
  }
  // Categoria NULA (ou não-objeto) na LISTA de categorias — um nível ACIMA do
  // item de custo: a categoria em si, não `categorias[].itens[]` (que já era
  // coberto). Medido: sem esta trava, a categoria nula sobrevive à migração
  // (migracao.js devolve `c` intocado quando não é objeto) e
  // custosPorCategoria ESTOURA em `c.itens` ("Cannot read properties of null
  // (reading 'itens')", calc.js) — tela morta em vez de "Não foi possível
  // importar".
  for (let ei = 0; ei < d.eventos.length; ei++) {
    const evento = d.eventos[ei]
    if (!evento || typeof evento !== 'object' || !Array.isArray(evento.categorias)) continue
    const nomeEvento =
      typeof evento.nome === 'string' && evento.nome.trim() ? evento.nome.trim() : '(sem nome)'
    const idxRuim = evento.categorias.findIndex(
      (c) => !c || typeof c !== 'object' || Array.isArray(c)
    )
    if (idxRuim !== -1)
      throw new Error(
        `o evento "${nomeEvento}", categoria nº ${idxRuim + 1} não tem forma de categoria (é ${descreverConteudo(evento.categorias[idxRuim])}) — o backup parece editado ou corrompido; nada foi importado`
      )
  }
  const nomeDoEvento = (e) =>
    e && typeof e === 'object' && typeof e.nome === 'string' && e.nome.trim()
      ? e.nome.trim()
      : '(sem nome)'
  // ————— Festa SEM IDENTIFICAÇÃO recebe uma AQUI (Marco, 26/07/2026) —————
  //
  // Decisão do Marco por questionário, CONTRA a recomendação de recusar o
  // arquivo: a festa que chega sem `id` ganha um na entrada e entra. Ele
  // aprovou sabendo do risco medido (ver o parágrafo do risco abaixo).
  //
  // O DEFEITO que isto fecha, medido em 26/07/2026 com 3 festas sem a chave
  // `id` (Brisa 05/12, bilheteria bruta realista R$ 63.000; Marfim Alto
  // 09/05, R$ 54.000; O Galeao 14/03, R$ 32.400 — R$ 149.400 no arquivo):
  // `parseBackup` não recusava, e o `mesclarBackup` monta o índice por id com
  // `Object.fromEntries`, onde três ids `undefined` colapsam numa chave só.
  // Ficava 1 festa (R$ 32.400), R$ 117.000 de bilheteria bruta sumiam CALADOS,
  // e a tela ainda anunciava "Backup importado: 3 evento(s)" porque lia o
  // tamanho do ARQUIVO. A trava de id repetido logo abaixo não pegava: ela faz
  // `e.id == null) continue`, de propósito — o nulo era o buraco.
  //
  // O que conta como identificação: texto com conteúdo, ou número finito (os
  // ids legados do app são números — migracaoIdLegado.test.js). `null`, chave
  // ausente, objeto, lista, booleano e texto vazio NÃO identificam ninguém, e
  // pior: `{}`, `[]` e `''` viram a MESMA chave de texto no índice, então duas
  // festas se sobrepunham. Todas essas recebem identificação nova.
  //
  // O RISCO QUE O MARCO ACEITOU, medido: como a identificação nasce nova a
  // cada importação, importar o MESMO arquivo duas vezes cria festas
  // DUPLICADAS — medido: 3 festas viram 6, e R$ 149.400 de bilheteria bruta
  // aparecem duas vezes (R$ 298.800 na lista). Não há conserto por conta
  // própria aqui; a rede escolhida é o AVISO na tela (textoImportacaoFeita),
  // que diz quantas festas ganharam identificação e que reimportar o mesmo
  // arquivo as traz outra vez. Comparar nome + data para reconhecer a mesma
  // festa é uma segunda rede POSSÍVEL, e é decisão do Marco — não desta trava.
  const identificacaoUsavel = (id) =>
    (typeof id === 'string' && id.trim() !== '') || (typeof id === 'number' && Number.isFinite(id))
  const eventosSemIdentificacao = []
  d.eventos = d.eventos.map((e) => {
    if (identificacaoUsavel(e.id)) return e
    eventosSemIdentificacao.push(nomeDoEvento(e))
    return { ...e, id: uid() }
  })
  // Ids repetidos DENTRO do arquivo colapsariam em silêncio no mesclarBackup
  // (Object.fromEntries — o primeiro sumiria sem contagem). Recusa o arquivo
  // inteiro, NOMEANDO os repetidos (mesma régua do resto), em vez de perder um
  // evento sem avisar (H3-AUDIT, S2 — provado que o snapshot não recupera o
  // derrubado). NÃO recusa id que também exista no store: isso é a atualização
  // normal por re-import, tratada no merge (o backup vence no id).
  const primeiroNome = new Map()
  const idsRepetidos = new Map() // id -> [nomes]
  for (const e of d.eventos) {
    if (!e || typeof e !== 'object' || Array.isArray(e) || e.id == null) continue
    if (primeiroNome.has(e.id)) {
      if (!idsRepetidos.has(e.id)) idsRepetidos.set(e.id, [primeiroNome.get(e.id)])
      idsRepetidos.get(e.id).push(nomeDoEvento(e))
    } else {
      primeiroNome.set(e.id, nomeDoEvento(e))
    }
  }
  if (idsRepetidos.size > 0) {
    const lista = [...idsRepetidos.entries()]
      .map(([id, nomes]) => `id "${id}" (${nomes.join(', ')})`)
      .join('; ')
    throw new Error(
      `O backup tem eventos com o mesmo id, o que faria um sumir por cima do outro no ` +
        `import — nada foi importado. Repetidos: ${lista}. O arquivo parece editado à ` +
        `mão ou corrompido.`
    )
  }
  return {
    eventos: migrarEventos(d.eventos).map(normalizarReceitaRealizadaDoImport),
    // Eventos CRUS (antes de migrar) — a tela roda censoNormalizacoes() sobre
    // eles para o aviso agregado da decisão 3a (o que a migração vai virar em
    // "não informado"). Já passaram pelas travas acima (objeto, id único), então
    // são seguros de percorrer. Sinal para a TELA, não lido pelo mesclarBackup.
    eventosCrus: d.eventos,
    benchmarksCustom: migrarBenchmarks(d.benchmarksCustom),
    benchmarkOverrides:
      d.benchmarkOverrides && typeof d.benchmarkOverrides === 'object' ? d.benchmarkOverrides : {},
    // Padrão adotado pelo Marco: como os overrides, mescla por id (backup vence
    // no id que traz); ausente → {} → merge no-op preserva o atual.
    benchmarksPadrao:
      d.benchmarksPadrao && typeof d.benchmarksPadrao === 'object' ? d.benchmarksPadrao : {},
    // null = o arquivo NÃO tem a chave (backup antigo) — mesclarBackup então
    // preserva a lista atual de ocultos em vez de zerá-la (mesma regra dos
    // Ajustes abaixo).
    benchmarksOcultos: d.benchmarksOcultos !== undefined ? benchmarksOcultosIds(d) : null,
    // Apagados: mesma regra dos ocultos — null quando o arquivo não traz a
    // chave (backup antigo), para não desapagar embutidos em silêncio.
    benchmarksApagados: d.benchmarksApagados !== undefined ? benchmarksApagadosIds(d) : null,
    // null = o arquivo NÃO tem a chave (backup antigo) — mesclarBackup então
    // preserva os Ajustes atuais em vez de zerá-los.
    ajustes: d.ajustes !== undefined ? formaAjustes(d.ajustes) : null,
    // Formato ANTIGO (sem identidade): o import mostra um aviso ANTES de aplicar
    // (princípio 4 — nada em silêncio). Backup atual (com `app`) = false. Não é
    // lido pelo mesclarBackup — é sinal para a TELA, como `benchmarksOcultos:
    // null` sinaliza "o arquivo não trouxe a chave".
    formatoAntigo,
    // NOMES das festas que chegaram sem identificação e receberam uma agora
    // (Marco, 26/07/2026). Lista vazia = arquivo com todas identificadas. Sinal
    // para a TELA: é o que faz o aviso contar a verdade — quantas ganharam
    // identificação e que reimportar o mesmo arquivo as traz outra vez.
    eventosSemIdentificacao,
  }
}

// Mescla um backup no estado atual: itens com o mesmo id são substituídos
// pela versão do backup; os demais são mantidos. Ajustes (premissas por
// festa): o backup substitui os atuais POR INTEIRO quando o arquivo traz a
// chave (regra simples e previsível — mesclar campo a campo misturaria
// premissas de duas épocas em silêncio); backup antigo sem a chave não mexe.
export function mesclarBackup(store, backup) {
  const porId = (arr) => Object.fromEntries(arr.map((e) => [e.id, e]))
  return {
    ...store,
    eventos: Object.values({ ...porId(store.eventos), ...porId(backup.eventos) }),
    benchmarksCustom: Object.values({
      ...porId(store.benchmarksCustom),
      ...porId(backup.benchmarksCustom),
    }),
    benchmarkOverrides: {
      ...(store.benchmarkOverrides || {}),
      ...(backup.benchmarkOverrides || {}),
    },
    // Padrão adotado: mescla por id (igual aos overrides); o id que o backup
    // traz vence, os demais ficam. Backup antigo sem a chave = {} = não mexe.
    benchmarksPadrao: {
      ...(store.benchmarksPadrao || {}),
      ...(backup.benchmarksPadrao || {}),
    },
    // Ocultos: o backup substitui a lista POR INTEIRO quando o arquivo traz a
    // chave (regra simples, igual à dos Ajustes — a lista é só de IDs e é
    // reversível a um clique); backup antigo sem a chave não mexe.
    benchmarksOcultos: backup.benchmarksOcultos ?? benchmarksOcultosIds(store),
    // Apagados: mesma regra dos ocultos — substitui por inteiro quando o
    // arquivo traz a chave; ausente (backup antigo) preserva o atual.
    benchmarksApagados: backup.benchmarksApagados ?? benchmarksApagadosIds(store),
    ajustes: backup.ajustes ?? formaAjustes(store.ajustes),
  }
}

/**
 * O QUE ESTE IMPORT REALMENTE FEZ — contado no resultado do merge, não no
 * arquivo (Marco, 26/07/2026).
 *
 * Por que existe: a tela anunciava `backup.eventos.length`, o tamanho do
 * ARQUIVO. Com 3 festas sem identificação, o merge deixava 1 e a tela dizia
 * "3 evento(s)" — R$ 117.000 de bilheteria bruta sumiam e o número na cara do
 * Marco mentia. Aqui o número sai de `mesclarBackup`: a festa é contada como
 * ENTRADA só se o id dela existe na lista DEPOIS do merge. Se algum dia o
 * merge perder uma festa outra vez, ela aparece em `naoEntraram` e a tela diz —
 * em vez de anunciar um número que não aconteceu.
 *
 * Leitura pura: não grava nada, não muda o store. Rodar o merge aqui, ANTES do
 * setStore, tem um efeito colateral bom: se ele fosse estourar, estoura neste
 * ponto — onde a tela mostra "Não foi possível importar o backup" em português
 * — e não DENTRO do updater do setStore, que é a tela morta que o comentário do
 * evento-lixo (lá em cima) descreve.
 *
 *   entraram              — festas do arquivo que aterrissaram (novas + atualizadas)
 *   novas / atualizadas   — nova festa × festa de mesmo id que já existia
 *   naoEntraram           — NOMES das que não aterrissaram (deve ser vazio)
 *   ganharamIdentificacao — NOMES das que chegaram sem id e receberam um
 */
export function censoImportacao(store, backup) {
  const atuais = Array.isArray(store?.eventos) ? store.eventos : []
  const idsAntes = new Set(atuais.map((e) => e?.id))
  const idsDepois = new Set(mesclarBackup(store, backup).eventos.map((e) => e?.id))
  let novas = 0
  let atualizadas = 0
  const naoEntraram = []
  for (const e of backup?.eventos || []) {
    if (!idsDepois.has(e?.id)) {
      naoEntraram.push(typeof e?.nome === 'string' && e.nome.trim() ? e.nome.trim() : '(sem nome)')
      continue
    }
    if (idsAntes.has(e?.id)) atualizadas++
    else novas++
  }
  return {
    entraram: novas + atualizadas,
    novas,
    atualizadas,
    naoEntraram,
    ganharamIdentificacao: backup?.eventosSemIdentificacao || [],
  }
}

/**
 * O aviso que a tela mostra DEPOIS de importar, com o número que entrou e o
 * risco escrito (Marco, 26/07/2026).
 *
 * O texto nunca afirma o que não está no censo: sem festa que ganhou
 * identificação, não fala de identificação; sem benchmark no arquivo, não fala
 * de benchmark. E quando alguma festa ganhou identificação, o aviso diz na cara
 * que reimportar o MESMO arquivo traz essas festas outra vez — é a rede do
 * risco que o Marco aceitou, no lugar de uma recusa.
 *
 * `extras.benchmarks` = quantos benchmarks o arquivo trouxe (0 = não menciona);
 * `extras.ajustes` = true quando o arquivo substituiu as premissas por festa.
 * `extras.lotesSemPreco` = texto pronto do aviso de lote sem preço (loteSemPreco.js);
 * vazio = não menciona.
 */
export function textoImportacaoFeita(censo, extras = {}) {
  const n = censo.entraram
  const partes = [
    `Backup importado: ${n === 1 ? '1 festa entrou' : `${n} festas entraram`}` +
      (censo.atualizadas > 0
        ? ` — ${censo.novas === 1 ? '1 nova' : `${censo.novas} novas`} e ${
            censo.atualizadas === 1
              ? '1 atualizada (mesma identificação)'
              : `${censo.atualizadas} atualizadas (mesma identificação)`
          }`
        : '') +
      '.',
  ]
  if (extras.benchmarks > 0)
    partes.push(
      `${extras.benchmarks === 1 ? '1 benchmark' : `${extras.benchmarks} benchmarks`} de comparação também entrou pelo arquivo.`
    )
  if (extras.ajustes) partes.push('Os Ajustes (premissas por festa) do arquivo substituíram os atuais.')
  const g = censo.ganharamIdentificacao
  if (g.length > 0) {
    // Concordância explícita: uma festa só, uma de várias, ou várias. Texto
    // torto é texto que o Marco lê rápido e entende errado.
    const quem =
      g.length === 1
        ? n === 1
          ? 'Ela não tinha identificação'
          : '1 delas não tinha identificação'
        : `${g.length} delas não tinham identificação`
    partes.push(
      `${quem} no arquivo (${g.join(', ')}) e ${g.length === 1 ? 'recebeu' : 'receberam'} uma agora, ` +
        `para que ${g.length === 1 ? 'ela não sumisse' : 'nenhuma sumisse'} da lista. ` +
        `Atenção: se você importar ESTE MESMO arquivo outra vez, ${
          g.length === 1
            ? 'essa festa entra de novo, como uma festa separada'
            : `essas ${g.length} festas entram de novo, como festas separadas`
        } — importe o arquivo uma vez só, ou apague as repetidas na lista de eventos depois.`
    )
  }
  if (censo.naoEntraram.length > 0)
    partes.push(
      `ATENÇÃO: ${censo.naoEntraram.length === 1 ? 'esta festa do arquivo NÃO entrou' : `estas ${censo.naoEntraram.length} festas do arquivo NÃO entraram`}: ${censo.naoEntraram.join(', ')}. ` +
        `Confira a lista de eventos e, se faltar algo, volte a cópia de segurança em Proteção de dados › Versões automáticas e avise que isto aconteceu.`
    )
  // Lote sem preço (P8, 06/10/2026): parágrafo próprio, antes da cópia.
  if (extras.lotesSemPreco) partes.push(extras.lotesSemPreco)
  partes.push(
    'Uma cópia de segurança de antes do import ficou em Proteção de dados › Versões automáticas.'
  )
  return partes.join('\n\n')
}

/**
 * Eventos FECHADOS de agora que este backup REABRIRIA em silêncio: o
 * mesclarBackup substitui por id, e um arquivo antigo (sem `status`) vence e
 * derruba o fechamento na migração. O import usa esta lista para AVISAR antes
 * de aplicar (decisão delegada, 20/07/2026 — "nada falha em silêncio"); o
 * snapshot de segurança continua sendo a rede de volta. Leitura pura.
 */
export function eventosReabertosPorBackup(eventosAtuais, backup) {
  const porId = new Map(
    (backup?.eventos || [])
      .filter((e) => e && typeof e === 'object' && !Array.isArray(e))
      .map((e) => [e.id, e])
  )
  return (eventosAtuais || []).filter(
    (e) => e?.status === 'fechado' && porId.has(e.id) && porId.get(e.id)?.status !== 'fechado'
  )
}
