// Lista canônica de status do ITEM DE CUSTO — ordem = ciclo de vida.
// UMA fonte só: o app (chip/popover/filtro), o export (dropdown + cor) e o
// import (validação) consomem DAQUI. Nunca duas listas (decisão do Marco,
// 21/07/2026, ao ampliar o escopo do export v2).
//
// Status é METADADO OPERACIONAL — NÃO entra em fórmula/cálculo (golden intocado).
// A única leitura de status em calc.js é `custosPorStatus`, um agrupamento de
// EXIBIÇÃO agnóstico ao valor (agrupa por qualquer string), então a nova lista
// funciona lá sem tocar calc.js — desde que a migração garanta status em todo
// item (ver migrarStatusCusto + o teste "nenhum item sem status").
//
// Cores: print da planilha antiga do Marco (21/07/2026). Hex de partida com
// contraste AA no texto; FECHADO e PAGO são "cheios" (fundo escuro, texto
// branco) — PAGO mais escuro que FECHADO porque pago é o fim da linha.
import { num } from './util.js'

export const STATUS_CUSTO = [
  { id: 'TBI', rotulo: 'TBI', bg: '#FFF2CC', texto: '#BF9000' },
  { id: 'ESTIMADO', rotulo: 'ESTIMADO', bg: '#EFEFEF', texto: '#666666' },
  { id: 'INICIAR', rotulo: 'INICIAR', bg: '#D9D2E9', texto: '#674EA7' },
  { id: 'AGUARDANDO ORÇAMENTO', rotulo: 'AGUARDANDO ORÇAMENTO', bg: '#CFE2F3', texto: '#3D85C6' },
  { id: 'ORÇADO', rotulo: 'ORÇADO', bg: '#D9EAD3', texto: '#38761D' },
  { id: 'ATUALIZAR ORÇAMENTO', rotulo: 'ATUALIZAR ORÇAMENTO', bg: '#F4CCCC', texto: '#CC0000' },
  { id: 'NEGOCIAR', rotulo: 'NEGOCIAR', bg: '#FFE599', texto: '#7F6000' },
  { id: 'FECHAR', rotulo: 'FECHAR', bg: '#F9CB9C', texto: '#B45F06' },
  { id: 'FECHADO', rotulo: 'FECHADO', bg: '#38761D', texto: '#FFFFFF' },
  { id: 'PARCIAL', rotulo: 'PARCIAL', bg: '#CFE2F3', texto: '#1155CC' },
  { id: 'PAGO', rotulo: 'PAGO', bg: '#274E13', texto: '#FFFFFF' },
]

export const STATUS_CUSTO_IDS = STATUS_CUSTO.map((s) => s.id)
// Default do item novo E do item migrado sem status reconhecível.
export const STATUS_CUSTO_PADRAO = 'ESTIMADO'

const PORID = Object.fromEntries(STATUS_CUSTO.map((s) => [s.id, s]))
export const statusCustoValido = (id) => Object.prototype.hasOwnProperty.call(PORID, id)
export const statusCustoInfo = (id) => PORID[id] || null
export const isPago = (id) => id === 'PAGO'

// Estilo (pílula opaca) do status, DERIVADO das cores canônicas — fonte ÚNICA
// de cor (Marco: duas fontes de cor é a doença que este arquivo cura). Devolve
// as MESMAS cores da planilha exportada; undefined se o status não existe (o
// componente fica sem cor, sem quebrar). Objeto pronto para o prop `style`.
export function estiloStatusCusto(id) {
  const info = statusCustoInfo(id)
  return info ? { backgroundColor: info.bg, color: info.texto } : undefined
}

// Migração do status ANTIGO (ORÇAR/NEGOCIANDO/FECHADO/PAGO) para o novo.
// Marco, 21/07/2026: PRESERVAR, não achatar.
const MIGRA_ANTIGO = {
  PAGO: 'PAGO',
  FECHADO: 'FECHADO',
  NEGOCIANDO: 'NEGOCIAR',
  ORÇAR: 'ESTIMADO', // era o default antigo; vira o default novo
}

/** Status novo válido para qualquer entrada: id novo passa direto; id antigo
 *  mapeia; ausente/desconhecido cai no default. GARANTE status válido sempre —
 *  é o que torna o fallback `|| 'ORÇAR'` de calc.js código morto. */
export function migrarStatusCusto(antigo) {
  if (statusCustoValido(antigo)) return antigo
  if (antigo != null && MIGRA_ANTIGO[antigo]) return MIGRA_ANTIGO[antigo]
  return STATUS_CUSTO_PADRAO
}

// DERIVADO (não é status — item 4): FECHADO com a coluna PAGAMENTO vazia acende
// o destaque âmbar.
//
// AVISO NA UI REMOVIDO (Marco, 22/07/2026): o banner do topo, o tooltip e a
// tarja âmbar da aba Custos saíram — decisão datada do Marco (BACKLOG). A função
// FICA porque a NOÇÃO "FECHADO sem dados de pgto" continua viva no export do
// produtor (xlsxOrcamentoV2.js), onde vira a formatação condicional âmbar da
// planilha — AND($G="FECHADO",$J=""). Esta é a definição canônica dessa noção;
// o export a espelha em fórmula de Excel. Não apague sem antes tirar o âmbar de
// lá também (e o teste de statusCusto.test.js que trava o contrato).
export const fechadoSemDadosPgto = (item) =>
  item?.status === 'FECHADO' && !(typeof item?.pagamento === 'string' && item.pagamento.trim())

// A conta "fechados ou pagos" do orçamento — FONTE ÚNICA, consumida pela barra
// (ui.jsx: BarraOrcamentoFechado), pelo resumo do WhatsApp (resumo.js) e pelo
// relatório/PDF (ReportView.jsx). Decisão do Marco, 22/07/2026:
//  - DENOMINADOR = soma de TODOS os status (agnóstico à lista). O código antigo
//    cravava ['PAGO','FECHADO','NEGOCIANDO','ORÇAR'] e SUBCONTAVA — item migrado
//    (ESTIMADO/ORÇADO/…) caía fora e a barra mostrava "R$ 60.500 de R$ 60.500
//    (100%)" onde o certo era "R$ 60.500 de R$ 140.050 (43%)".
//  - NUMERADOR = PAGO + FECHADO + PARCIAL. PARCIAL conta: é dinheiro
//    comprometido (decisão do Marco).
// Devolve { fechado, total, pct } — pct inteiro 0..100, e 0 (sem divisão por
// zero) quando total <= 0.
export function contaOrcamentoFechado(totais) {
  const t = totais || {}
  const total = Object.values(t).reduce((s, v) => s + num(v), 0)
  const fechado = num(t.PAGO) + num(t.FECHADO) + num(t.PARCIAL)
  // A TRAVA 0..100 (decisão do Marco, 12/08/2026, por questionário). O
  // comentário acima já PROMETIA "pct inteiro 0..100" e a conta não cumpria: um
  // subtotal negativo no denominador produziria pct > 100, e a barra passaria
  // do fim. Hoje isso é INALCANÇÁVEL — estimado negativo é recusado na
  // digitação (`FAIXA_CUSTO`) e normalizado na migração, as duas portas
  // medidas —, então esta linha não muda nenhum número de nenhuma festa que
  // exista. Ela existe para o dia em que uma das duas portas for afrouxada.
  //
  // O CUSTO QUE ELE ACEITOU, escrito para quem for reabrir: a trava MASCARA.
  // Sem ela, um defeito futuro apareceria como barra maluca e chamaria
  // atenção; com ela, aparece como barra cheia e passa despercebido. Ele
  // preferiu assim a depender de as duas portas continuarem apertadas para
  // sempre.
  const cru = total > 0 ? Math.round((fechado / total) * 100) : 0
  const pct = Math.max(0, Math.min(100, cru))
  return { fechado, total, pct }
}
