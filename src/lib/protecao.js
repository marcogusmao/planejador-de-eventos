// Rede de proteção de dados (Sessão C): lixeira de eventos, snapshots
// automáticos e marcador do último backup JSON. TUDO vive em chaves próprias
// do localStorage — o schema do store principal ('previsao-eventos:v1') não
// muda e o backup JSON exportado continua idêntico.
//
// Divisão proposital: helpers PUROS (testáveis no ambiente 'node' do Vitest)
// separados das camadas que tocam localStorage (validadas ao vivo no navegador,
// onde localStorage existe). Nada falha em silêncio: quota estourada avisa.
//
// ————— TODO CAMINHO DE VOLTA PASSA PELA MIGRAÇÃO (25/07/2026) —————
//
// Decisão 18 do Marco: "corrigir E mostrar". Até 25/07 este arquivo tinha TRÊS
// portas por onde dado guardado voltava CRU ao app — restaurar um instantâneo,
// restaurar da lixeira e restaurar da lixeira como cópia. `loadStore` e o
// importador de backup já rodavam `migrarEventos` havia meses; estas três, não.
// Consequência medida: um instantâneo salvo antes da trava de 22/07 devolvia
// `custoPct −200` e a tela mostrava R$ 54.250 de lucro onde a verdade é
// R$ 10.150 (evidência em censoImportAtaque.test.js).
//
// Agora as três migram, e as três devolvem `revisao` — o inventário do que a
// migração mudou, para a tela contar item a item (revisaoRestauracao.js). O que
// foi GUARDADO nunca é tocado: o instantâneo continua na lista exatamente como
// foi salvo, e o dado cru sobe no retorno (`storeCru` / `eventoCru`) para o
// caminho de "ver sem aplicar" existir.
//
// A ordem dos campos do retorno é de propósito: o campo com o nome ANTIGO
// (`store`, `evento`) passou a carregar o dado CORRIGIDO. Quem chamar sem saber
// desta mudança recebe a conta certa — errar para o lado seguro é o único jeito
// de essa correção não ser meia.

import { uid, clone, agora } from './util.js'
import { showToast } from './toast.js'
import { revisarRestauracao, revisarEventoRestaurado } from './revisaoRestauracao.js'

const LIXEIRA_KEY = 'previsao-eventos:lixeira:v1'
const SNAPSHOTS_KEY = 'previsao-eventos:snapshots:v1'
const ULTIMO_EXPORT_KEY = 'previsao-eventos:ultimo-export:v1'

// Idade máxima (dias) do último backup JSON antes do aviso discreto na Home.
// 14 → 7 em 18/07/2026 (hardening, Bloco 1.1): enquanto o backup externo
// automático não cobre todos os dias, a janela de perda aceitável é menor.
export const LIMITE_BACKUP_DIAS = 7

// Quantos snapshots automáticos manter (~1 por dia de uso → ~15 dias).
export const MAX_SNAPSHOTS = 15

// Limite de itens guardados na lixeira. A lixeira é uma rede contra exclusão
// por engano, não um arquivo permanente — o backup JSON é o arquivo. Sem limite,
// exclusões repetidas encheriam a quota do localStorage.
export const MAX_LIXEIRA = 50

// ————— Helpers puros —————

// Insere o item mais recente no topo e mantém no máximo `max`, descartando os
// mais antigos (fim da lista) — e DIZ o que descartou. Usada pela lixeira e
// pelos snapshots.
//
// (Verificação adversarial 19/07/2026.) A versão que só devolvia a lista era
// uma promessa quebrada em silêncio: na 51ª exclusão, o `window.confirm` tinha
// acabado de dizer "você poderá restaurá-la depois em Proteção de dados" e a
// cópia mais antiga saía da lixeira sem existir em lugar nenhum — nem toast,
// nem aviso. Quem descarta tem de contar o que descartou.
export function rotacionarComDescarte(lista, novo, max) {
  const cheia = [novo, ...lista]
  return { lista: cheia.slice(0, max), descartados: cheia.slice(max) }
}

/** Só a lista — para quem não precisa saber do descarte. */
export function rotacionar(lista, novo, max) {
  return rotacionarComDescarte(lista, novo, max).lista
}

// A lixeira está cheia? Devolve quem vai ser expulso na PRÓXIMA exclusão (ou
// null). Serve ao aviso que vem ANTES — melhor avisar antes de perder que
// depois. Pura: a UI só formata.
export function proximoDescarteDaLixeira(lista, max = MAX_LIXEIRA) {
  if (!Array.isArray(lista) || lista.length < max) return null
  const maisAntigo = lista[lista.length - 1]
  if (!maisAntigo) return null
  return { nome: maisAntigo.nome || 'sem nome', excluidoEm: maisAntigo.excluidoEm || null }
}

// Aviso da poda de snapshots forçada por falta de espaço. Note que NÃO é a
// rotação de rotina (manter 15): essa é esperada e já está escrita na tela.
// Esta é a outra — a que o navegador impôs, jogando fora versões que o app
// tinha prometido guardar. Rara, e quando acontece é perda de dado.
export function mensagemPoda(podados) {
  if (!podados || podados <= 0) return null
  return podados === 1
    ? 'O armazenamento do navegador encheu: a versão automática mais antiga foi descartada para caber a nova. Exporte um backup JSON — as versões automáticas não são mais garantia suficiente.'
    : `O armazenamento do navegador encheu: ${podados} versões automáticas mais antigas foram descartadas para caber a nova. Exporte um backup JSON — as versões automáticas não são mais garantia suficiente.`
}

// Dia local (AAAA-MM-DD) de um ISO. Usado para "1 snapshot por dia de uso".
export function diaLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Já existe um snapshot automático do dia de `agoraIso`? Só os automáticos
// contam para o limite diário — os de segurança (antes de restaurar) são extra.
export function jaTemSnapshotHoje(snapshots, agoraIso) {
  const hoje = diaLocal(agoraIso)
  return snapshots.some((s) => s.tipo === 'auto' && diaLocal(s.criadoEm) === hoje)
}

// Vale a pena guardar snapshot deste store? Store completamente vazio não —
// evita encher a lista de fotos de "nada" antes do Marco criar qualquer coisa.
export function storeTemDados(store) {
  if (!store) return false
  const ev = Array.isArray(store.eventos) ? store.eventos.length : 0
  const bm = Array.isArray(store.benchmarksCustom) ? store.benchmarksCustom.length : 0
  return ev > 0 || bm > 0
}

// Dias inteiros entre dois ISO (>= 0). Retorna null se `iso` for inválido.
export function diasEntre(iso, agoraIso) {
  if (!iso) return null
  const a = new Date(iso).getTime()
  const b = new Date(agoraIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.floor((b - a) / 86400000)
}

// Estado do backup JSON para o aviso da Home. `ultimoExportIso` ausente =
// nunca exportou → vencido. Vencido quando passou de `limite` dias.
export function statusBackup(ultimoExportIso, agoraIso = agora(), limite = LIMITE_BACKUP_DIAS) {
  if (!ultimoExportIso) return { vencido: true, nunca: true, dias: null }
  const dias = diasEntre(ultimoExportIso, agoraIso)
  if (dias == null) return { vencido: true, nunca: true, dias: null }
  return { vencido: dias >= limite, nunca: false, dias }
}

// ————— Lixeira (localStorage) —————

export function loadLixeira() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(LIXEIRA_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : []
  } catch (e) {
    console.error('Erro ao carregar a lixeira', e)
    return []
  }
}

// Retorna { ok, erro }. Nunca lança — a falha vira aviso na UI.
function saveLixeira(lista) {
  try {
    if (typeof localStorage === 'undefined') return { ok: false, erro: 'sem armazenamento' }
    localStorage.setItem(LIXEIRA_KEY, JSON.stringify(lista))
    return { ok: true }
  } catch (e) {
    console.error('Erro ao salvar a lixeira', e)
    return { ok: false, erro: e?.message || 'quota do navegador esgotada' }
  }
}

// Move um evento para a lixeira (guarda cópia completa + data de exclusão).
export function moverParaLixeira(evento, agoraIso = agora()) {
  const item = {
    id: uid(),
    eventoId: evento.id,
    nome: evento.nome,
    excluidoEm: agoraIso,
    evento: clone(evento),
  }
  // `descartado` = a cópia mais antiga que saiu da lixeira para esta caber.
  // Vai no retorno para a UI poder contar — antes ela sumia calada (achado da
  // verificação adversarial 19/07/2026). null quando não houve descarte.
  const { lista, descartados } = rotacionarComDescarte(loadLixeira(), item, MAX_LIXEIRA)
  const r = saveLixeira(lista)
  return { ...r, lista, item, descartado: descartados[0] || null }
}

// Metade BAIXA da restauração: tira o item da lixeira e devolve o que estava
// guardado. Retorna { ok, erro, eventoGuardado, lista }.
//
// ATENÇÃO (25/07/2026): `eventoGuardado` é o dado CRU, como foi salvo — pode
// trazer valores que o app hoje recusa (o `custoPct −200` de antes da trava de
// 22/07 é o caso medido). Ele NÃO serve para ir direto ao store: quem devolve
// uma previsão à lista é `restaurarEventoDaLixeira` ou
// `restaurarComoCopiaDaLixeira`, e as duas passam pela migração antes.
//
// O campo se chamava `evento` e foi RENOMEADO de propósito: um nome neutro num
// retorno cru é um convite a `aplicar(comOEvento(r.evento))` — exatamente o
// caminho que produziu o S1. O nome agora diz o que a coisa é.
export function restaurarDaLixeira(itemId) {
  const lista = loadLixeira()
  const item = lista.find((i) => i.id === itemId)
  if (!item) return { ok: false, erro: 'item não encontrado', eventoGuardado: null, lista }
  const restante = lista.filter((i) => i.id !== itemId)
  const r = saveLixeira(restante)
  return { ...r, eventoGuardado: item.evento, lista: r.ok ? restante : lista }
}

// Exclusão definitiva de um item (sai da lixeira, não volta para o store).
export function excluirDaLixeira(itemId) {
  const lista = loadLixeira()
  const restante = lista.filter((i) => i.id !== itemId)
  const r = saveLixeira(restante)
  return { ...r, lista: r.ok ? restante : lista }
}

export function esvaziarLixeira() {
  const r = saveLixeira([])
  return { ...r, lista: r.ok ? [] : loadLixeira() }
}

// ————— A transação inteira: store + lixeira num passo só —————
//
// (Verificação adversarial 19/07/2026, achados S1-A e S1-B.) Mover para a
// lixeira e restaurar de lá são as DUAS ações do app que mexem no store e no
// localStorage ao mesmo tempo. Antes, cada metade morava num arquivo: a UI
// chamava `restaurarDaLixeira` (apaga o item) e depois um `setStore` com passo
// de desfazer — e o Cmd+Z desfazia só a metade dele, sumindo com a previsão
// dos dois lados.
//
// Agora as duas metades moram AQUI, na mesma função, com a ordem escolhida de
// propósito: nada é gravado enquanto ainda pode dar errado, e a metade do
// store só acontece depois que a metade da lixeira deu certo. O chamador passa
// `aplicar` — o escritor do store — e recebe { ok, erro }; erro nenhum é
// engolido, todos têm texto em português para a tela.
//
// Os updaters abaixo são GUARDADOS: devolvem o MESMO store quando não há o que
// fazer. É o que faz a transação ser segura de repetir — o botão "Restaurar" do
// toast e o da Proteção de dados podem cair no mesmo item sem nunca duplicar a
// previsão na lista.

/** Updater: tira a previsão `id` do store. Sem ela lá, devolve o mesmo store. */
export const semOEvento = (id) => (s) =>
  s?.eventos?.some((e) => e.id === id)
    ? { ...s, eventos: s.eventos.filter((e) => e.id !== id) }
    : s

/** Updater: põe a previsão de volta no store. Já lá, devolve o mesmo store. */
export const comOEvento = (evento) => (s) =>
  s?.eventos?.some((e) => e.id === evento.id) ? s : { ...s, eventos: [...s.eventos, evento] }

/**
 * Exclusão: copia para a lixeira e TIRA do store — nessa ordem.
 * A cópia primeiro porque é a etapa que pode falhar (quota); falhou, o store
 * nem é tocado e a previsão continua na lista, inteira.
 * @param aplicar (updater, motivo) => void — escreve o store FORA do histórico
 */
export function excluirEventoParaLixeira(evento, aplicar, agoraIso = agora()) {
  const r = moverParaLixeira(evento, agoraIso)
  if (!r.ok) {
    return {
      ok: false,
      erro:
        'Não foi possível mover para a lixeira (armazenamento do navegador cheio). O evento NÃO foi excluído. Exporte um backup e esvazie a lixeira antes de tentar de novo.',
    }
  }
  aplicar(semOEvento(evento.id), `mandar “${evento.nome}” para a lixeira`)
  // `descartado` sobe até a Home: a lixeira encheu e alguma coisa saiu dela de
  // vez. O toast conta na hora — a promessa do confirm ("você poderá
  // restaurá-la depois") não vale para quem foi expulso.
  return { ok: true, item: r.item, lista: r.lista, descartado: r.descartado }
}

/**
 * Restauração: tira da lixeira e PÕE no store — nessa ordem, e só depois de
 * checar que dá para pôr.
 *
 * A checagem de id colidente vem ANTES de qualquer gravação (era o achado
 * S1-B: a versão antiga apagava o item da lixeira e só então descobria que o
 * store não aceitava a previsão de volta — o dado sumia calado). Não deu para
 * restaurar? A lixeira fica intacta e o motivo volta escrito para a tela.
 *
 * @param storeOuLeitor  o store de AGORA — ou uma função que o devolve.
 *   A forma de função existe porque o "Restaurar" do toast é clicado DEPOIS,
 *   e um store capturado na hora de criar o toast é o de ANTES da exclusão:
 *   a previsão ainda estaria lá e a checagem de colisão recusaria a própria
 *   restauração que o botão promete. Quem chama de dentro de um callback que
 *   sobrevive ao render passa o leitor, não o valor. (Pego ao vivo, não na
 *   leitura — o botão do toast recusava restaurar toda vez.)
 * @param aplicar (updater, motivo) => void — escreve o store FORA do histórico
 */
export function restaurarEventoDaLixeira(itemId, storeOuLeitor, aplicar) {
  const lista = loadLixeira()
  const item = lista.find((i) => i.id === itemId)
  if (!item) {
    return {
      ok: false,
      lista,
      erro: 'Esse evento não está mais na lixeira (talvez tenha sido restaurado em outra aba).',
    }
  }
  const storeAtual = typeof storeOuLeitor === 'function' ? storeOuLeitor() : storeOuLeitor
  const colide = storeAtual?.eventos?.some((e) => e.id === item.evento?.id)
  if (colide) {
    return {
      ok: false,
      lista,
      erro: `Não dá para restaurar “${item.nome || 'este evento'}”: já existe um evento com o mesmo identificador na lista. A cópia continua guardada aqui na lixeira — nada foi perdido.`,
    }
  }
  const r = restaurarDaLixeira(itemId)
  if (!r.ok) {
    return {
      ok: false,
      lista,
      erro: 'Não foi possível restaurar (armazenamento do navegador cheio). O evento continua na lixeira. Tente exportar um backup e esvaziar versões antigas.',
    }
  }
  // A MESMA porta do instantâneo, na lixeira (25/07/2026). Um evento excluído
  // antes de 22/07 continua guardado aqui com os valores daquela época — e
  // voltava cru, com a conta errada, exatamente como o instantâneo voltava.
  // Meia correção seria pior que nenhuma: passaria a sensação de resolvido.
  const revisao = revisarEventoRestaurado(item.evento)
  aplicar(comOEvento(revisao.eventoCorrigido), `restaurar “${item.nome || 'um evento'}” da lixeira`)
  return {
    ok: true,
    lista: r.lista,
    evento: revisao.eventoCorrigido,
    eventoCru: item.evento,
    revisao,
  }
}

/**
 * O item da lixeira dá para restaurar AGORA? (Verificação adversarial
 * 19/07/2026 — o item zumbi.)
 *
 * Restaurar um snapshot ou importar um backup passa pelo setStore normal e não
 * reconcilia com a lixeira: a previsão volta a viver no store E a cópia
 * continua guardada aqui. A checagem de colisão de
 * `restaurarEventoDaLixeira` recusa com mensagem honesta — nada se perde —, mas
 * o botão "Restaurar" continuava lá, prometendo, e falhava TODA vez.
 *
 * Botão que promete e sempre falha é o padrão que já mordeu duas vezes hoje. O
 * estado do item passa a ser calculado aqui, e a UI o exibe: puro, testável, e
 * a UI não repete a regra de colisão que a transação aplica.
 */
export function estadoItemLixeira(item, store) {
  const idEvento = item?.evento?.id
  const gemeoVivo = !!idEvento && !!store?.eventos?.some((e) => e.id === idEvento)
  if (!gemeoVivo) return { restauravel: true, motivo: null }
  const vivo = store.eventos.find((e) => e.id === idEvento)
  return {
    restauravel: false,
    motivo: `Já existe um evento vivo com este identificador${
      vivo?.nome ? ` (“${vivo.nome}”)` : ''
    } — provavelmente ele voltou por um snapshot ou por um backup importado. Restaure como cópia, ou descarte este da lixeira.`,
  }
}

/**
 * Saída do zumbi: tira da lixeira e devolve a previsão ao store com IDENTIDADE
 * NOVA, sem tocar na gêmea viva. Mesma disciplina das outras transações daqui —
 * conferir, gravar a lixeira, e só então o store.
 *
 * O id novo é o que torna a operação possível: era a colisão de id que
 * bloqueava a restauração normal. Nada de dinheiro muda — é o mesmo evento,
 * com outro nome e outro identificador (o mesmo que "duplicar" já faz na Home).
 */
export function restaurarComoCopiaDaLixeira(itemId, aplicar, agoraIso = agora(), novoId = null) {
  const lista = loadLixeira()
  const item = lista.find((i) => i.id === itemId)
  if (!item || !item.evento) {
    return {
      ok: false,
      lista,
      erro: 'Esse evento não está mais na lixeira (talvez tenha sido restaurado em outra aba).',
    }
  }
  // Mesma régua do restaurar normal (25/07/2026): o que sai da lixeira passa
  // pela migração antes de virar previsão viva. A identidade nova é o que muda
  // aqui; a conta é a mesma correção do caminho de cima.
  const revisao = revisarEventoRestaurado(item.evento)
  const copia = {
    ...clone(revisao.eventoCorrigido),
    id: novoId || uid(),
    nome: `${item.evento.nome || 'Sem nome'} (cópia da lixeira)`,
    atualizadoEm: agoraIso,
    // Cópia nasce ABERTA e sem foto (regra da Parte 2 do fechamento, igual a
    // duplicarCopia): o clone de um evento fechado carregaria a trava E o
    // benchmarkId clonado — e reabrir a CÓPIA apagaria o benchmark que o
    // ORIGINAL ainda referencia (achado adversarial 20/07/2026). O restaurar
    // NORMAL preserva o fechamento — lá é o mesmo evento voltando; aqui é
    // identidade nova.
    status: 'aberto',
    fechamento: null,
  }
  const r = restaurarDaLixeira(itemId)
  if (!r.ok) {
    return {
      ok: false,
      lista,
      erro: 'Não foi possível restaurar (armazenamento do navegador cheio). O evento continua na lixeira. Tente exportar um backup e esvaziar versões antigas.',
    }
  }
  aplicar(comOEvento(copia), `restaurar “${item.nome || 'um evento'}” da lixeira como cópia`)
  return { ok: true, lista: r.lista, evento: copia, eventoCru: item.evento, revisao }
}

// ————— Snapshots automáticos (localStorage) —————

export function loadSnapshots() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : []
  } catch (e) {
    console.error('Erro ao carregar os snapshots', e)
    return []
  }
}

// Salva a lista de snapshots. Se a quota estourar, tenta liberar espaço
// descartando os snapshots mais antigos e refaz — mas NUNCA em silêncio:
// retorna { ok:false, erro } para a UI avisar. Nunca lança.
function saveSnapshots(lista) {
  if (typeof localStorage === 'undefined') return { ok: false, erro: 'sem armazenamento' }
  let atual = lista
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(atual))
      const podados = lista.length - atual.length
      // (Verificação adversarial 19/07/2026.) `podados` era calculado aqui e
      // NUNCA lido: `grep -rn podados src/` não achava um consumidor sequer. O
      // app sabia que tinha jogado versões fora e não contava a ninguém.
      //
      // O aviso sai DAQUI, e não nos chamadores, de propósito: este é o único
      // ponto onde a poda por falta de espaço acontece, e são seis caminhos que
      // chegam até ele (snapshot diário, os quatro snapshots de segurança,
      // restaurarSnapshot). Avisar em cada chamador é seis chances de esquecer
      // — e esquecer é exatamente o bug que estamos consertando. toast.js é um
      // módulo folha sem React nem dependências, e sem ouvintes o showToast é
      // um no-op, então isto não atrapalha os testes.
      if (podados > 0) showToast(mensagemPoda(podados), { duracao: 12000 })
      return { ok: true, lista: atual, podados }
    } catch (e) {
      // Quota estourou: descarta o snapshot mais antigo e tenta de novo.
      if (atual.length > 1) {
        atual = atual.slice(0, -1)
        continue
      }
      console.error('Erro ao salvar snapshot (quota do navegador esgotada)', e)
      return { ok: false, erro: e?.message || 'quota do navegador esgotada' }
    }
  }
  return { ok: false, erro: 'não foi possível liberar espaço para o snapshot' }
}

// Cria, no máximo 1×/dia, um snapshot automático do store se ele tiver dados.
// Chamada na abertura do app: fotografa o estado do início do dia — o plano B
// antes de qualquer edição (ou migração) estragar números bons.
export function talvezSnapshotDiario(store, agoraIso = agora()) {
  if (!storeTemDados(store)) return { criado: false }
  const snaps = loadSnapshots()
  if (jaTemSnapshotHoje(snaps, agoraIso)) return { criado: false }
  const novo = { id: uid(), criadoEm: agoraIso, tipo: 'auto', store: clone(store) }
  const r = saveSnapshots(rotacionar(snaps, novo, MAX_SNAPSHOTS))
  return { criado: r.ok, erro: r.erro, podados: r.podados }
}

// Snapshot de segurança tirado imediatamente ANTES de uma ação que substitui
// dados (restaurar outra versão, aplicar dados do Financeiro) — para o estado
// atual não se perder caso a ação tenha sido um engano. O rótulo aparece na
// lista de versões do modal Proteção de dados.
export function snapshotSeguranca(store, agoraIso = agora(), rotulo = 'antes de restaurar') {
  const novo = {
    id: uid(),
    criadoEm: agoraIso,
    tipo: 'seguranca',
    rotulo,
    store: clone(store),
  }
  return saveSnapshots(rotacionar(loadSnapshots(), novo, MAX_SNAPSHOTS))
}

// Devolve o store guardado num snapshot (para o chamador aplicar via setStore).
// Antes de restaurar, guarda um snapshot de segurança do estado atual.
//
// POLÍTICA ÚNICA (H3-D §9.11.3, 21/07/2026 — princípio 7): sem a cópia de
// segurança NÃO se aplica — igual ao FinanceiroModal. Antes, restaurava
// mesmo assim e avisava DEPOIS, quando o confirm já tinha prometido "o
// estado de agora será guardado". A exceção é EXPLÍCITA e do usuário:
// `forcarSemSeguranca` (o modal pergunta de novo, dizendo o risco) — cobre
// o modo-socorro (leitura falhada) sem deadlock e sem promessa quebrada.
// CORRIGIR E MOSTRAR (decisão 18 do Marco, 25/07/2026): o store guardado passa
// pela migração — a MESMA régua que `loadStore` e o importador de backup já
// aplicavam — e o retorno traz as três coisas que a tela precisa para não
// quebrar nenhum princípio:
//   • `store`      — o que se APLICA no app, com a conta certa (princípio 1);
//   • `storeCru`   — exatamente como foi salvo, para o caminho de "ver sem
//                    aplicar" e para o desfazer da volta (princípio 7);
//   • `revisao`    — o que mudou, item a item, em português (princípio 4).
// O snapshot na lista NÃO é reescrito: restaurar não consome nem altera o que
// está guardado, então dá para restaurar de novo, quantas vezes for.
export function restaurarSnapshot(snapshotId, storeAtual, { forcarSemSeguranca = false } = {}) {
  const snaps = loadSnapshots()
  const snap = snaps.find((s) => s.id === snapshotId)
  if (!snap) return { ok: false, erro: 'snapshot não encontrado', store: null }
  const seg = snapshotSeguranca(storeAtual)
  if (!seg.ok && !forcarSemSeguranca)
    return {
      ok: false,
      semSeguranca: true,
      erro:
        'não deu para guardar a cópia de segurança do estado atual (armazenamento do navegador cheio) — nada foi restaurado',
      store: null,
    }
  // O clone vem ANTES da revisão de propósito: quem sai daqui (corrigido e cru)
  // não compartilha referência nenhuma com o snapshot guardado, então nem uma
  // mutação acidental no app alcança a lista de versões.
  const revisao = revisarRestauracao(clone(snap.store))
  return {
    ok: true,
    store: revisao.storeCorrigido,
    storeCru: revisao.storeCru,
    revisao,
    segurancaOk: seg.ok,
    segurancaErro: seg.erro,
  }
}

// ————— Marcador do último backup JSON (localStorage) —————

export function loadUltimoExport() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(ULTIMO_EXPORT_KEY) || null
  } catch (e) {
    console.error('Erro ao ler a data do último backup', e)
    return null
  }
}

// Registrado quando o Marco exporta um backup JSON. Falha aqui não atrapalha o
// download (o backup já baixou) — só deixa o aviso aparecer de novo mais cedo.
export function marcarExportAgora(agoraIso = agora()) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(ULTIMO_EXPORT_KEY, agoraIso)
  } catch (e) {
    console.error('Erro ao registrar a data do backup', e)
  }
}
