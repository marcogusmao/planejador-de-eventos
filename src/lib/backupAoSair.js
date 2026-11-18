// Backup ao SAIR — e o que acontece quando ele NÃO acontece.
//
// A casca nativa (WKWebView) chama `window.__backupAoSair()` no "Sair"/Cmd+Q e
// grava em arquivo o texto que essa função devolver. O lado Swift só grava com
// `!json.isEmpty` (appwrap.swift), então devolver string vazia é o jeito CERTO
// de dizer "não grave nada" — sem isso, uma falha aqui sobrescreveria o backup
// bom da véspera com lixo.
//
// O DEFEITO CONSERTADO EM 30/08/2026 (achado S3): o `catch` do App.jsx era
// `catch { return '' }`, ponto. Nada era registrado e ninguém era avisado — o
// Marco mandava "Sair", o arquivo de backup simplesmente não aparecia na pasta,
// e o app na abertura seguinte estava idêntico ao de sempre. Não corrompe dado
// nenhum (por isso S3 e não S1), mas viola o princípio 4 da casa: nada falha em
// silêncio.
//
// POR QUE O AVISO MORA NO localStorage, e não num toast: a função roda no
// instante em que a janela está fechando. Não existe tela para mostrar aviso,
// não existe tempo para o usuário ler. O único canal que sobrevive ao "Sair" é
// o disco — a marca fica gravada e a FAIXA aparece na abertura seguinte, que é
// quando ele pode fazer alguma coisa a respeito (exportar um backup à mão).
//
// A chave é PRÓPRIA e fica FORA do backup JSON, pelo mesmo motivo da
// `chavePonte.js`: é estado deste navegador sobre uma falha deste navegador —
// não é dado de festa, e não faz sentido viajar dentro de um export.

import { armazenamentoUsavel } from './util.js'

const CHAVE_FALHA = 'previsao-eventos:backup-ao-sair:falha:v1'

/** Texto curto e legível do que deu errado — nunca a pilha inteira. */
const motivoDe = (e) => {
  const bruto = e && (e.message || e.name) ? String(e.message || e.name) : String(e ?? '')
  const limpo = bruto.trim().replace(/\s+/g, ' ')
  if (!limpo) return 'motivo não informado pelo navegador'
  return limpo.length > 300 ? `${limpo.slice(0, 297)}…` : limpo
}

/**
 * Guarda a marca da falha. NUNCA lança: já estamos no caminho de erro, e uma
 * exceção aqui derrubaria a saída do app em cima de um problema menor.
 */
export function registrarFalhaBackupAoSair(erro, agora = () => new Date().toISOString()) {
  const marca = { em: agora(), motivo: motivoDe(erro) }
  try {
    if (armazenamentoUsavel()) localStorage.setItem(CHAVE_FALHA, JSON.stringify(marca))
  } catch (e) {
    // O armazenamento cheio é justamente uma das causas plausíveis do problema
    // original. Sobra o console — e ele fica, porque calar é o defeito.
    console.error('Não deu para registrar a falha do backup ao sair', e)
  }
  return marca
}

/** A marca da última falha, ou null. Formato estranho no disco = null. */
export function falhaBackupAoSair() {
  try {
    if (!armazenamentoUsavel()) return null
    const bruto = localStorage.getItem(CHAVE_FALHA)
    if (!bruto) return null
    const m = JSON.parse(bruto)
    if (!m || typeof m !== 'object' || typeof m.motivo !== 'string') return null
    return { em: typeof m.em === 'string' ? m.em : '', motivo: m.motivo }
  } catch {
    return null
  }
}

/** Apaga a marca (o usuário leu o aviso e resolveu, ou escondeu). */
export function limparFalhaBackupAoSair() {
  try {
    if (armazenamentoUsavel()) localStorage.removeItem(CHAVE_FALHA)
  } catch (e) {
    console.error('Não deu para limpar a marca do backup ao sair', e)
  }
}

/**
 * O conteúdo que o "Sair" entrega à casca nativa.
 *
 * Contrato com o Swift, e ele não muda: string vazia = NÃO GRAVE NADA. O que
 * muda é que a string vazia deixou de ser muda.
 */
export function conteudoDoBackupAoSair(store, montar) {
  try {
    return JSON.stringify(montar(store))
  } catch (e) {
    registrarFalhaBackupAoSair(e)
    return ''
  }
}
