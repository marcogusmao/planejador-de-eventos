// Backup externo automático (hardening 1.1 — 18/07/2026).
//
// SEGUNDA exceção de rede do app, aprovada pelo Marco em 18/07/2026 no
// SESSAO-HARDENING-PROMPT.md e registrada no CLAUDE.md: ENVIAR (POST) o
// export JSON completo para o Financeiro local (http://localhost:8777), que
// o guarda como arquivo na pasta de backups dele. Limites da exceção:
//   - só `localhost:8777`, rota /api/previsao/backup;
//   - só o envio do export (o mesmo payload do botão "Exportar backup");
//   - automático no máximo 1×/dia, ao abrir o app — mais o clique manual;
//   - nada contínuo em segundo plano, nenhum outro destino.
//
// Nada falha em silêncio, mas nada bloqueia: Financeiro fechado vira aviso
// discreto na Home ("backup externo não feito hoje"), nunca erro. Os dados
// continuam salvos no navegador de qualquer forma.
//
// Camadas: helpers PUROS (testados em backupExterno.test.js, ambiente node)
// separados da camada localStorage (padrão de protecao.js).

import { agora, armazenamentoUsavel } from './util.js'
import { diaLocal, storeTemDados } from './protecao.js'
import { montarBackup } from './storage.js'
import { HEADER_PONTE, loadChavePonte } from './chavePonte.js'
import { origemAtual, origemAutorizada, origemNaNuvem, msgOrigemErrada } from './ponteOrigem.js'

export const URL_BACKUP_FINANCEIRO = 'http://localhost:8777/api/previsao/backup'

const ULTIMO_ENVIO_KEY = 'previsao-eventos:ultimo-backup-externo:v1'

// Marcador do aviso da nuvem — escolha de implementação (05/10/2026), não
// decisão do Marco. Chave PRÓPRIA, fora do store e fora do backup JSON, como a
// do último envio: diz só "o aviso já apareceu neste navegador". Sem armazenamento usável, o aviso volta a cada abertura —
// degradação prevista, nunca erro.
const AVISO_NUVEM_KEY = 'previsao-eventos:aviso-backup-nuvem:v1'

export const MSG_BACKUP_EXTERNO_NAO_FEITO =
  'Backup externo não feito hoje: o Financeiro está fechado. Seus dados continuam salvos neste navegador — abra o Financeiro e o envio acontece sozinho amanhã, ou use “Enviar backup ao Financeiro agora” em Ajustes › Backup.'

// Hardening 2 (H2-B): o Financeiro exige o token da ponte em toda gravação.
export const MSG_BACKUP_SEM_TOKEN =
  'Backup externo não enviado: falta o token da ponte. Abra a pasta do Financeiro, copie o conteúdo do arquivo token_ponte.txt e cole em Ajustes › Backup — só precisa uma vez. Seus dados continuam salvos neste navegador.'

// Correção S2 (19/07/2026): app aberto fora da origem autorizada da ponte — o
// navegador barra por CORS e o erro do fetch é igualzinho ao de servidor
// fechado. A mensagem carrega a origem REAL para o diagnóstico ser verdadeiro.
export const msgBackupOrigemErrada = (origem) => msgOrigemErrada(origem, 'o envio do backup')

// §9.11 nº 5 da auditoria externa (20/07/2026): o envio AUTOMÁTICO já se
// recusava a mandar um store vazio; os botões manuais, não. O encadeamento é o
// perigoso: depois de uma corrupção de leitura, o Marco vê a lista vazia,
// clica no botão que "protege" — e o arquivo do dia no Financeiro (e no Drive)
// vira esse vazio, por cima do backup bom. A guarda agora mora no ÚNICO ponto
// que fala com a rede, então vale para os dois caminhos e para os futuros.
export const MSG_BACKUP_SEM_DADOS =
  'Backup externo não enviado: não há nenhum evento nem benchmark próprio para enviar, e mandar um backup vazio apagaria o arquivo bom que já está no Financeiro. Se a sua lista deveria ter conteúdo, NÃO mexa: abra Ajustes › Proteção de dados e restaure a versão mais recente antes de tentar de novo.'

// A cópia da nuvem. O Marco decidiu por questionário (05/10/2026) subir a tela
// ao Railway e aceitou que lá a ponte não funciona: não existe backup diário
// para o Financeiro, e pedir o token a cada abertura seria mandar colar uma
// coisa que não resolve nada. O FORMATO do aviso — calmo, UMA vez por
// navegador — é escolha de implementação (05/10/2026), não decisão do Marco.
export const MSG_BACKUP_NA_NUVEM =
  'Nesta cópia da nuvem não há backup diário para o Financeiro: ele e a ponte com o Financeiro só funcionam no app do Mac (http://localhost:4173). Os eventos daqui ficam salvos só neste navegador — use “Exportar backup” de vez em quando para guardar uma cópia fora dele.'

// O texto fixo de Ajustes › Backup, nas duas origens. Mora aqui para a tela não
// decidir sozinha o que dizer.
export const TEXTO_BACKUP_AUTOMATICO_MAC =
  'Além do arquivo baixado, o app envia sozinho (1× por dia, ao abrir) uma cópia deste mesmo backup para a pasta de backups do Financeiro local, quando ele está aberto — assim existe uma cópia fora do navegador mesmo sem export manual.'
export const TEXTO_BACKUP_AUTOMATICO_NUVEM =
  'Nesta cópia da nuvem não há envio automático ao Financeiro: ele só funciona no app do Mac (http://localhost:4173). Os eventos daqui ficam só neste navegador — o arquivo baixado é a única cópia fora dele.'

export function textoBackupAutomatico(origem = origemAtual()) {
  return origemNaNuvem(origem) ? TEXTO_BACKUP_AUTOMATICO_NUVEM : TEXTO_BACKUP_AUTOMATICO_MAC
}

export const MSG_BACKUP_TOKEN_RECUSADO =
  'Backup externo não enviado: o Financeiro recusou o token da ponte. Copie de novo o conteúdo de token_ponte.txt (pasta do Financeiro) e cole em Ajustes › Backup; se o arquivo não existir lá, feche e abra o Financeiro para gerar outro. Seus dados continuam salvos neste navegador.'

/**
 * Motivo da falha → texto do aviso discreto (banner da Home e botão "Enviar ao
 * Financeiro"). Existe para o mapeamento morar em UM lugar só: era duplicado em
 * dois pontos da Home, e foi assim que o motivo novo 'origem' quase escapou
 * dizendo "Financeiro fechado" — a mentira que esta correção veio matar.
 */
export function mensagemFalhaBackup(r) {
  const motivo = r?.motivo
  if (motivo === 'sem-dados') return MSG_BACKUP_SEM_DADOS
  if (motivo === 'sem-token') return MSG_BACKUP_SEM_TOKEN
  if (motivo === 'token') return MSG_BACKUP_TOKEN_RECUSADO
  if (motivo === 'origem') return msgBackupOrigemErrada(r.origem)
  return MSG_BACKUP_EXTERNO_NAO_FEITO
}

// ————— Marcador do último envio (localStorage) —————

export function loadUltimoEnvio() {
  try {
    if (!armazenamentoUsavel()) return null
    return localStorage.getItem(ULTIMO_ENVIO_KEY) || null
  } catch (e) {
    console.error('Erro ao ler a data do último backup externo', e)
    return null
  }
}

// Registrado só após envio bem-sucedido. Falha aqui não desfaz o envio (o
// arquivo já está no Financeiro) — só faz o app tentar de novo mais cedo,
// o que é inofensivo: o arquivo do dia é sobrescrito, nunca duplicado.
export function marcarEnvioAgora(agoraIso = agora()) {
  try {
    if (!armazenamentoUsavel()) return
    localStorage.setItem(ULTIMO_ENVIO_KEY, agoraIso)
  } catch (e) {
    console.error('Erro ao registrar a data do backup externo', e)
  }
}

function avisoNuvemJaMostrado() {
  try {
    if (!armazenamentoUsavel()) return false
    return Boolean(localStorage.getItem(AVISO_NUVEM_KEY))
  } catch (e) {
    console.error('Erro ao ler o marcador do aviso da nuvem', e)
    return false
  }
}

function marcarAvisoNuvemMostrado(agoraIso = agora()) {
  try {
    if (!armazenamentoUsavel()) return
    localStorage.setItem(AVISO_NUVEM_KEY, agoraIso)
  } catch (e) {
    console.error('Erro ao registrar o aviso da nuvem', e)
  }
}

// ————— Helpers puros —————

// O envio automático roda no máximo 1× por dia local. Marcador ausente ou
// ilegível = nunca enviou = deve tentar.
export function deveEnviarHoje(ultimoEnvioIso, agoraIso = agora()) {
  if (!ultimoEnvioIso) return true
  const dia = diaLocal(ultimoEnvioIso)
  return !dia || dia !== diaLocal(agoraIso)
}

// ————— Envio (o único POST do app — ver limites no topo) —————

/**
 * Envia o export completo ao Financeiro. Nunca lança: devolve
 *   { ok:true, arquivo, googleDrive } ou
 *   { ok:false, motivo: 'fechado' | 'origem' | 'erro' | 'sem-rede' | 'sem-token' | 'token' }.
 * `fetchFn`, `chave` e `origem` são injetáveis para teste (padrão de financeiro.js).
 *
 * Origem (correção S2, 19/07/2026): a falha do fetch só vira 'fechado' quando o
 * app está na origem autorizada da ponte. Fora dela o culpado é o bloqueio de
 * CORS do navegador, não o Financeiro — motivo 'origem', com a origem real
 * junto. A checagem fica DEPOIS da falha de propósito: se um dia a ponte passar
 * a aceitar outra origem, o envio continua funcionando sem precisar mexer aqui.
 *
 * Cópia da nuvem (Marco, 05/10/2026): origem https fora do próprio computador
 * nem toca a rede nem pede token — devolve 'origem' na hora, e a mensagem diz
 * que a ponte só funciona no app do Mac. É a ÚNICA exceção ao "checar depois da
 * falha" acima: dali, chamar localhost faz o Chrome pedir permissão de rede
 * local para uma chamada que o Financeiro recusaria de qualquer jeito, e abrir
 * a ponte para a nuvem exigiria mudar as duas pontas (inclusive esta linha).
 *
 * Token da ponte (H2-B): o Financeiro só aceita a gravação com o cabeçalho
 * X-Ponte-Token certo. Sem chave configurada nem tocamos a rede — o motivo
 * 'sem-token' vira mensagem dizendo onde pegar (MSG_BACKUP_SEM_TOKEN);
 * 403 de lá vira 'token' (MSG_BACKUP_TOKEN_RECUSADO). As leituras da ponte
 * (financeiro.js) seguem sem token — só mutação exige.
 */
export async function enviarBackupExterno(
  store,
  fetchFn,
  chave = loadChavePonte(),
  origem = origemAtual()
) {
  // Na cópia da nuvem a origem vem PRIMEIRO (achado B da revisão do PR #100,
  // 05/10/2026). Lá não existe "arquivo bom no Financeiro" para proteger, e a
  // frase da guarda de baixo ("apagaria o arquivo bom que já está no
  // Financeiro… restaure a versão") mandaria a sócia de app vazio restaurar
  // uma coisa que ela não tem. Nenhuma das duas toca a rede: a ordem muda só a
  // frase, nunca o que sai do navegador.
  if (origemNaNuvem(origem)) return { ok: false, motivo: 'origem', origem }
  // A guarda do §9.11 nº 5, e ela vem antes de tudo o que toca a rede: store
  // sem nada não sai daqui. Sobrescrever o backup do dia com um vazio é perda
  // de dado do Marco do lado de lá — o oposto do que o botão promete.
  if (!storeTemDados(store)) return { ok: false, motivo: 'sem-dados' }
  const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) return { ok: false, motivo: 'sem-rede' }
  if (!chave) return { ok: false, motivo: 'sem-token' }
  const payload = montarBackup(store)
  let res
  try {
    res = await f(URL_BACKUP_FINANCEIRO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [HEADER_PONTE]: chave },
      body: JSON.stringify(payload),
      signal:
        typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(8000)
          : undefined,
    })
  } catch {
    // CORS e conexão-recusada são indistinguíveis aqui — quem desempata é a
    // origem em que o app está aberto, que o app conhece sem perguntar a ninguém.
    if (!origemAutorizada(origem)) return { ok: false, motivo: 'origem', origem }
    return { ok: false, motivo: 'fechado' }
  }
  if (res.status === 403) return { ok: false, motivo: 'token', status: 403 }
  if (!res.ok) return { ok: false, motivo: 'erro', status: res.status }
  let corpo
  try {
    corpo = await res.json()
  } catch {
    corpo = null
  }
  if (!corpo || corpo.ok !== true) return { ok: false, motivo: 'erro' }
  return { ok: true, arquivo: corpo.arquivo || '', googleDrive: corpo.google_drive === true }
}

/**
 * Orquestra o envio automático da abertura do app: só com dados no store,
 * só se ainda não enviou hoje. Sucesso registra o marcador do dia.
 * Retorna { tentou:false } quando não havia o que fazer, senão
 * { tentou:true, ...resultado do envio }.
 *
 * Na cópia da nuvem não tenta nada: devolve { tentou:false, motivo:'nuvem',
 * avisar } — `avisar` é true só na PRIMEIRA vez neste navegador.
 */
export async function talvezEnviarBackupDiario(
  store,
  fetchFn,
  agoraIso = agora(),
  chave = loadChavePonte(),
  origem = origemAtual()
) {
  if (!storeTemDados(store)) return { tentou: false, motivo: 'sem-dados' }
  if (origemNaNuvem(origem)) {
    if (avisoNuvemJaMostrado()) return { tentou: false, motivo: 'nuvem', avisar: false }
    marcarAvisoNuvemMostrado(agoraIso)
    return { tentou: false, motivo: 'nuvem', avisar: true }
  }
  if (!deveEnviarHoje(loadUltimoEnvio(), agoraIso)) return { tentou: false, motivo: 'ja-enviado-hoje' }
  const r = await enviarBackupExterno(store, fetchFn, chave, origem)
  if (r.ok) marcarEnvioAgora(agoraIso)
  return { tentou: true, ...r }
}

/**
 * O aviso da faixa discreta da Home depois do envio automático da abertura, ou
 * `null` quando não há o que dizer. Mora aqui (e não na Home) para o teste
 * alcançar as duas origens sem montar a tela.
 */
export function avisoDoBackupDiario(r) {
  if (r?.motivo === 'nuvem') return r.avisar ? MSG_BACKUP_NA_NUVEM : null
  if (r?.tentou && !r.ok) return mensagemFalhaBackup(r)
  return null
}
