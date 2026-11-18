// Origem autorizada da ponte com o Financeiro (correção de bug S2 — 19/07/2026).
//
// O PROBLEMA que este módulo resolve: o Financeiro só autoriza a ponte para UMA
// origem exata — `ORIGEM_PREVISAO` no backend/config.py de lá. Quando o app é
// aberto por outra porta (típico: `npm run dev`, que sobe na 5173, enquanto o
// "Iniciar Previsão.command" sobe na 4173), o navegador BARRA a chamada por CORS
// antes dela chegar ao servidor. No `fetch`, um bloqueio de CORS e uma conexão
// recusada são INDISTINGUÍVEIS — os dois caem no mesmo `catch`. Por isso o app
// dizia "o Financeiro está fechado" mesmo com o Financeiro aberto: diagnóstico
// mentiroso, que faz o dono abrir de novo o que já estava aberto e concluir que
// a feature é quebrada.
//
// A SAÍDA: o app SABE a própria origem. Em vez de adivinhar pelo erro do fetch,
// olhamos a origem antes de culpar o Financeiro.
//
// ESPELHO: a constante abaixo é o espelho de `ORIGEM_PREVISAO` em
// Financeiro/backend/config.py. **Se uma mudar, a outra TEM que mudar** —
// são o mesmo contrato visto dos dois lados. Rotas autorizadas lá (ROTAS_CORS):
// /api/previsao/eventos (GET), /api/previsao/curva (GET), /api/previsao/backup
// (POST).
export const ORIGEM_PONTE = 'http://localhost:4173'

/**
 * Origem em que o app está aberto agora ('http://localhost:5173'), ou '' quando
 * não há navegador (testes em ambiente node, SSR).
 */
export function origemAtual() {
  try {
    if (typeof window === 'undefined') return ''
    return window.location?.origin || ''
  } catch {
    return ''
  }
}

/**
 * A origem atual pode falar com o Financeiro?
 *
 * Origem VAZIA conta como autorizada de propósito: sem navegador não existe CORS
 * para barrar nada (é o caso dos testes com `fetchFn` injetado, que exercitam os
 * caminhos de rede de verdade). Só uma origem CONHECIDA e DIFERENTE da
 * autorizada é motivo para acusar bloqueio de origem.
 */
export function origemAutorizada(origem = origemAtual()) {
  return !origem || origem === ORIGEM_PONTE
}

// ————— A cópia da nuvem (Marco, 05/10/2026, por questionário) —————
//
// Uma cópia da TELA é servida pelo Railway em https://planejador.casa.example,
// atrás da entrada da casa. De lá a ponte NUNCA funciona: o Financeiro só
// autoriza ORIGEM_PONTE, e fazê-la funcionar seria mudar as duas pontas — risco
// que o Marco aceitou ("na nuvem a ponte com o Financeiro não funciona"). O texto
// de origem errada de antes mentiria lá: diz "modo desenvolvimento" a quem só
// abriu o endereço da casa, e manda abrir um .command que não existe no
// computador da sócia. A origem https fora do próprio computador tem texto
// próprio, e os pontos de rede nem tentam a chamada (ver backupExterno.js,
// financeiro.js e curvaVendas.js): de um site público, chamar localhost faz o
// Chrome pedir permissão de "acesso à rede local" para uma chamada que o
// Financeiro recusaria de qualquer jeito.

const PROPRIO_COMPUTADOR = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * O app está aberto na cópia da nuvem? `https://` num endereço que não é o
 * próprio computador. Origem vazia (testes, sem navegador), `http://` e
 * localhost NÃO são nuvem — ali o comportamento de antes continua igual.
 */
export function origemNaNuvem(origem = origemAtual()) {
  if (!origem) return false
  try {
    const u = new URL(origem)
    return u.protocol === 'https:' && !PROPRIO_COMPUTADOR.has(u.hostname)
  } catch {
    return false
  }
}

/**
 * O que a tela mostra na nuvem NO LUGAR do campo do token (Ajustes › Backup).
 * Lá não há token a configurar: pedir para colar o token_ponte.txt mandaria a
 * pessoa fazer uma coisa que não resolve nada.
 */
export const FRASE_PONTE_SO_NO_MAC =
  `A ponte com o Financeiro e o backup diário só funcionam no app do Mac (${ORIGEM_PONTE}). ` +
  'Nesta cópia da nuvem não há token a configurar: os eventos daqui ficam só neste navegador, ' +
  'e a cópia fora dele é o “Exportar backup”.'

/** O `title` dos botões da ponte, desligados na nuvem: diz por que estão desligados. */
export const TITULO_PONTE_NA_NUVEM =
  `Desligado nesta cópia da nuvem: a ponte com o Financeiro só existe no app do Mac (${ORIGEM_PONTE}).`

/** A frase da nuvem: o que não funciona aqui, onde funciona, e o que fazer. */
export function msgPonteNaNuvem(origem, acao = 'a conversa com o Financeiro') {
  return (
    `Este app está aberto na cópia da nuvem (${origem}). A ponte com o Financeiro e o backup diário ` +
    `só funcionam no app do Mac (${ORIGEM_PONTE}) — por isso ${acao} não acontece aqui, e não porque o ` +
    'Financeiro esteja fechado. Os eventos desta cópia ficam salvos só neste navegador: para guardar uma ' +
    'cópia fora dele, use “Exportar backup”.'
  )
}

/**
 * Mensagem acionável de origem errada, com a origem REAL detectada no texto —
 * o dono precisa ver onde ele está para entender por que não funciona.
 * `acao` completa a frase do que foi bloqueado ("o envio do backup").
 * Na cópia da nuvem a frase é outra (`msgPonteNaNuvem`).
 */
export function msgOrigemErrada(origem, acao = 'a conversa com o Financeiro') {
  if (origemNaNuvem(origem)) return msgPonteNaNuvem(origem, acao)
  return (
    `Este app está aberto em ${origem || 'uma origem desconhecida'} (modo desenvolvimento). ` +
    `A ponte com o Financeiro só aceita o app aberto pelo “Iniciar Previsão.command” (${ORIGEM_PONTE}) — ` +
    `por isso o navegador bloqueou ${acao}, e não porque o Financeiro esteja fechado. ` +
    'Abra por lá e tente de novo — seus dados continuam salvos neste navegador.'
  )
}
