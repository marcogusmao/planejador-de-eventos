// Chave da ponte com o Financeiro (hardening 2 — H2-B, Marco 18/07/2026).
//
// O Financeiro passou a exigir um TOKEN local em toda mutação (POST/PUT/
// DELETE) — fecha o buraco que sobrou do hardening 1: qualquer processo
// local podia mutar o Financeiro com um curl (Origin ausente era aceito).
// Para a previsão, a única mutação é o POST do backup (backupExterno.js);
// as LEITURAS da ponte (financeiro.js e curva de vendas) seguem sem token,
// exatamente como antes — o CORS restrito de lá já as cobre.
//
// O token nasce no Financeiro: arquivo token_ponte.txt na pasta de lá,
// gerado no primeiro boot. O Marco copia o conteúdo e cola UMA vez em
// Ajustes › Backup; fica guardado neste navegador (localStorage), FORA do
// backup JSON de propósito — o backup circula (pasta do Financeiro, Google
// Drive) e o segredo não deve viajar dentro dele. É enviado só no cabeçalho
// X-Ponte-Token, só para http://localhost:8777 — nunca em URL, nunca para
// outro destino, nada hard-coded.
//
// Rotação: apagar o token_ponte.txt lá → fechar e abrir o Financeiro (o
// boot gera outro) → colar o novo aqui.

import { armazenamentoUsavel } from './util.js'

export const HEADER_PONTE = 'X-Ponte-Token'

const CHAVE_PONTE_KEY = 'previsao-eventos:chave-ponte:v1'

// Normaliza o que foi colado: espaços e quebras de linha nas pontas fora —
// colar o arquivo inteiro (que termina em \n) é o caso comum.
export const normalizarChave = (v) => String(v ?? '').trim()

export function loadChavePonte() {
  try {
    if (!armazenamentoUsavel()) return ''
    return normalizarChave(localStorage.getItem(CHAVE_PONTE_KEY) || '')
  } catch (e) {
    console.error('Erro ao ler a chave da ponte', e)
    return ''
  }
}

/**
 * Guarda a chave colada (vazio remove — jeito explícito de "esquecer").
 * Nunca lança; devolve a chave normalizada que ficou valendo.
 */
export function saveChavePonte(valor) {
  const chave = normalizarChave(valor)
  try {
    if (armazenamentoUsavel()) {
      if (chave) localStorage.setItem(CHAVE_PONTE_KEY, chave)
      else localStorage.removeItem(CHAVE_PONTE_KEY)
    }
  } catch (e) {
    console.error('Erro ao guardar a chave da ponte', e)
  }
  return chave
}
