// Texto do veredito — extraído VERBATIM de Veredito.jsx na Sessão K para a
// lib, porque tem consumidores fora do React visual: o painel/apresentação
// (via re-export em Veredito.jsx) e o "Copiar resumo" para o WhatsApp
// (lib/resumo.js). Fonte ÚNICA do vocabulário — trocar aqui troca em toda
// superfície de uma vez.
//
// VOCABULÁRIO TROCADO A PEDIDO DO MARCO (20/07/2026): "Esse evento sai" era
// coloquial demais para relatório e reunião — o novo é técnico e
// profissional (viável / com ressalvas / inviável), mantendo os números na
// frase. Os nomes das CORES não mudam (verde/amarelo/vermelho seguem sendo
// o significado; a cor mora na BOLA, nunca no texto — PADRÃO §3).
import { fmtBRL, fmtPct } from './format.js'

export const TITULO_VEREDITO = {
  verde: 'Evento viável',
  amarelo: 'Viável com ressalvas',
  vermelho: 'Inviável como está',
}

// Emoji do semáforo: na TELA morreu (bola pintada da marca), mas em TEXTO
// copiado (WhatsApp) ele é a linguagem viva do grupo das sócias.
export const EMOJI_SEMAFORO = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }

// Frase no padrão Visão Sócias, sempre citando os números.
export function fraseVeredito(c, v) {
  const mR = c.realista.margem
  const alvos = `(alvo ${fmtPct(v.margemAlvo)}, mínima ${fmtPct(v.margemMinima)})`
  if (v.cor === 'verde')
    return `Viável: margem realista ${fmtPct(mR)} ${alvos} e lucro até no cenário pessimista (${fmtBRL(c.pessimista.lucro)}).`
  if (v.cor === 'amarelo') {
    if (v.rebaixadoPeloPessimista)
      return `Viável com ressalvas: a margem realista ${fmtPct(mR)} bate o alvo ${alvos}, porém o cenário pessimista fecha em ${fmtBRL(c.pessimista.lucro)} — prejuízo se as vendas caírem.`
    return `Viável com ressalvas: margem realista ${fmtPct(mR)} abaixo do alvo ${alvos}.`
  }
  return mR == null
    ? `Sem receita prevista ainda — preencha lotes e valores para o veredito.`
    : `Inviável como está: margem realista ${fmtPct(mR)} abaixo da mínima ${alvos}. Reveja custos ou receita.`
}
