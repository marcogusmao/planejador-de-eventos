// Curva de vendas via Financeiro (Sessão F2-B — sugestão 14 do MELHORIAS.md).
//
// Consome a rota irmã GET /api/previsao/curva do Financeiro — MESMA
// exceção de rede da ponte (CLAUDE.md, exceção 1, Marco 17/07/2026): consulta
// somente-leitura, disparada por clique, só para http://localhost:8777.
// Nenhum outro destino, nada automático, nenhuma escrita lá.
//
// IMPORTANTE (fronteira com o princípio 7): os dados da curva são LEITURA
// PARA EXIBIÇÃO — nada daqui é aplicado a campo nenhum do evento. Por isso
// não há tela de revisão: revisão existe quando dado externo vira dado do
// Marco (ponte da Sessão H); aqui o dado externo vira só desenho na tela,
// com carimbo de origem e hora ("via Financeiro em DD/MM HH:MM"). O cache
// do último fetch mora em CHAVE PRÓPRIA do localStorage, fora do store e
// do backup JSON.
//
// Contrato da resposta (item 15 do BACKLOG.md do Financeiro, Sessão F2-A):
//   { eventos: [{ evento_id, nome, data, status, empresa_id, empresa,
//                 total_pagamentos, total_valor,
//                 dias: [{ dia, pagamentos, valor }] }],
//     eventos_sem_data: [{ evento_id, nome, empresa }] }
//   - `dia` é INTEIRO relativo à data do evento (negativo = antes da festa,
//     0 = dia da festa, positivo = depois); `dias` é ESPARSO (só dias com
//     venda) — quem consome preenche os buracos.
//   - `pagamentos` conta PAGAMENTOS aprovados da Tiqueteira — NÃO pessoas nem
//     nº de ingressos. Esse limite honesto do dado aparece na tela.
//
// Tudo além do fetch é puro e testado em curvaVendas.test.js.

import { dataISOLocal } from './dataLocal.js'
import { num } from './util.js'
import { fmtBRL2 } from './format.js'
import { descontoEfetivoPct } from './calc.js'
import {
  MSG_FINANCEIRO_FECHADO,
  MSG_RESPOSTA_ESTRANHA,
  msgConsultaOrigemErrada,
  normalizarNome,
} from './financeiro.js'
import { origemAtual, origemAutorizada, origemNaNuvem } from './ponteOrigem.js'

export const URL_CURVA = 'http://localhost:8777/api/previsao/curva'

// ————— Validação da resposta —————

const intOuZero = (v) => Math.round(num(v))

/**
 * Valida e normaliza a resposta de GET /api/previsao/curva. Retorna
 * { eventos, eventosSemData } ou null se o formato for irreconhecível —
 * quem chama avisa e não desenha nada com dado torto.
 */
export function validarCurvaFinanceiro(dados) {
  if (
    !dados ||
    typeof dados !== 'object' ||
    !Array.isArray(dados.eventos) ||
    !Array.isArray(dados.eventos_sem_data)
  )
    return null
  const eventos = []
  for (const ev of dados.eventos) {
    if (!ev || typeof ev !== 'object' || ev.evento_id == null || typeof ev.nome !== 'string')
      return null
    if (!Array.isArray(ev.dias)) return null
    const dias = []
    for (const d of ev.dias) {
      // dia precisa ser inteiro de verdade — um "dia" torto deslocaria a
      // curva inteira em silêncio.
      if (!d || typeof d !== 'object' || !Number.isFinite(Number(d.dia))) return null
      dias.push({
        dia: Math.round(Number(d.dia)),
        pagamentos: intOuZero(d.pagamentos),
        valor: num(d.valor),
      })
    }
    dias.sort((a, b) => a.dia - b.dia)
    eventos.push({
      id: ev.evento_id,
      nome: ev.nome,
      data: typeof ev.data === 'string' ? ev.data : '',
      status: typeof ev.status === 'string' ? ev.status : '',
      empresaId: ev.empresa_id ?? null,
      empresa: typeof ev.empresa === 'string' ? ev.empresa : '',
      totalPagamentos: intOuZero(ev.total_pagamentos),
      totalValor: num(ev.total_valor),
      dias,
    })
  }
  const eventosSemData = dados.eventos_sem_data
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      id: e.evento_id ?? null,
      nome: typeof e.nome === 'string' ? e.nome : '',
      empresa: typeof e.empresa === 'string' ? e.empresa : '',
    }))
  return { eventos, eventosSemData }
}

// ————— Consulta (rota irmã — mesmo regime do fetch da ponte) —————

/**
 * Busca a curva no Financeiro local. Só LÊ — nenhum dado sai daqui para lá.
 * Lança Error com mensagem em português pronta para a tela (mesmas mensagens
 * da ponte da Sessão H, incluindo o diagnóstico de origem errada da correção
 * S2 — ver ponteOrigem.js). `fetchFn` e `origem` são injetáveis para teste.
 */
export async function buscarCurvaFinanceiro(fetchFn, origem = origemAtual()) {
  // Cópia da nuvem (Marco, 05/10/2026): a ponte não funciona de lá, e a
  // chamada nem é tentada — ver ponteOrigem.js.
  if (origemNaNuvem(origem)) throw new Error(msgConsultaOrigemErrada(origem))
  const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) throw new Error(MSG_FINANCEIRO_FECHADO)
  let res
  try {
    res = await f(URL_CURVA, {
      signal:
        typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(8000)
          : undefined,
    })
  } catch {
    if (!origemAutorizada(origem)) throw new Error(msgConsultaOrigemErrada(origem))
    throw new Error(MSG_FINANCEIRO_FECHADO)
  }
  if (!res.ok)
    throw new Error(
      `O Financeiro respondeu com erro (HTTP ${res.status}) — nada foi alterado. ` +
        (res.status === 404
          ? 'A rota da curva não existe na versão do Financeiro que está aberta: feche e reabra o Financeiro (Iniciar Financeiro.command) para atualizar.'
          : 'Tente de novo; se continuar, reabra o Financeiro.')
    )
  let dados
  try {
    dados = await res.json()
  } catch {
    throw new Error(MSG_RESPOSTA_ESTRANHA)
  }
  const curva = validarCurvaFinanceiro(dados)
  if (!curva) throw new Error(MSG_RESPOSTA_ESTRANHA)
  return curva
}

// ————— Cache do último fetch (chave própria; fora do store e do backup) —————

const CACHE_KEY = 'previsao-eventos:curva-financeiro:v1'

/** Lê o cache { em, curva } do último fetch; null se não há (ou é torto). */
export function loadCurvaCache() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || typeof d !== 'object' || typeof d.em !== 'string') return null
    // O cache passa pela MESMA validação da rede — cache corrompido à mão
    // não pode fingir ser dado.
    const curva = validarCurvaFinanceiroCacheado(d.curva)
    return curva ? { em: d.em, curva } : null
  } catch (e) {
    console.error('Erro ao ler o cache da curva do Financeiro', e)
    return null
  }
}

// O cache guarda a forma JÁ normalizada (camelCase); revalida a estrutura.
function validarCurvaFinanceiroCacheado(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.eventos) || !Array.isArray(c.eventosSemData))
    return null
  for (const ev of c.eventos) {
    if (!ev || typeof ev !== 'object' || ev.id == null || !Array.isArray(ev.dias)) return null
  }
  return c
}

/**
 * Guarda o resultado de um fetch com carimbo de hora. Nunca lança e nunca
 * falha em silêncio: { ok } ou { ok:false, erro } para a tela avisar (o
 * gráfico continua funcionando com o dado em memória).
 */
export function saveCurvaCache(curva, emIso) {
  try {
    if (typeof localStorage === 'undefined')
      return { ok: false, erro: 'sem armazenamento neste ambiente' }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ em: emIso, curva }))
    return { ok: true }
  } catch (e) {
    console.error('Erro ao guardar o cache da curva', e)
    return { ok: false, erro: e?.message || 'armazenamento do navegador cheio' }
  }
}

// ————— Leituras puras sobre a curva —————

/** Evento da curva vinculado a esta previsão (vínculo da Sessão H). */
export function eventoCurvaVinculado(curva, evento) {
  const id = evento?.financeiro?.eventoId
  if (id == null || !curva) return null
  return curva.eventos.find((e) => e.id === id) || null
}

/**
 * Acumula os dias esparsos: [{ dia, pagamentos, valor }] →
 * [{ dia, pagamentosAcum, valorAcum }], ordenado por dia. Os buracos entre
 * dias não viram pontos — quem desenha liga os pontos (o acumulado é
 * constante entre vendas, e a linha reta entre pontos conta essa história
 * com fidelidade suficiente para leitura de ritmo).
 */
export function acumularDias(dias) {
  const ordenados = [...(dias || [])].sort((a, b) => a.dia - b.dia)
  let pagamentos = 0
  let valor = 0
  return ordenados.map((d) => {
    pagamentos += intOuZero(d.pagamentos)
    valor += num(d.valor)
    return { dia: d.dia, pagamentosAcum: pagamentos, valorAcum: valor }
  })
}

/**
 * Valor/pagamentos acumulados ATÉ um dia relativo (inclusive) — para "quanto
 * já vendeu até hoje" sem depender de haver venda exatamente hoje.
 */
export function acumuladoAteODia(dias, diaLimite) {
  let pagamentos = 0
  let valor = 0
  for (const d of dias || []) {
    if (d.dia <= diaLimite) {
      pagamentos += intOuZero(d.pagamentos)
      valor += num(d.valor)
    }
  }
  return { pagamentos, valor }
}

/** Dia relativo de "hoje" em relação à data do evento (negativo = antes). */
export function diaRelativoHoje(dataEventoISO, hojeISO) {
  if (!dataEventoISO || !hojeISO) return null
  const ev = new Date(`${dataEventoISO}T12:00:00`)
  const hoje = new Date(`${hojeISO}T12:00:00`)
  if (Number.isNaN(ev.getTime()) || Number.isNaN(hoje.getTime())) return null
  return Math.round((hoje - ev) / 86400000)
}

// ————— Média histórica por tipo de festa (bloco 2) —————

// O gráfico sempre abre a régua em D-60 (formato do Marco: D-60…D-0); vendas
// anteriores a isso só esticam o eixo.
export const DIA_INICIO_PADRAO = -60

const dataValida = (s) => {
  if (typeof s !== 'string' || !s) return false
  return !Number.isNaN(new Date(`${s}T12:00:00`).getTime())
}

// Soma n dias a uma data ISO.
//
// A ENTRADA já era imune a fuso (âncora no sol-alto LOCAL); a SAÍDA não era, e
// isso foi medido em 05/08/2026 — `toISOString` devolve UTC, então em fuso
// ADIANTADO o sol-alto local já é o dia anterior lá:
//
//     America/Sao_Paulo   addDiasISO('2026-08-05', 0) => 2026-08-05
//     UTC                 addDiasISO('2026-08-05', 0) => 2026-08-05
//     Pacific/Kiritimati  addDiasISO('2026-08-05', 0) => 2026-08-04
//
// É a mesma família do S1 que fez nascer o `dataLocal.js` em 20/07/2026 (o app
// anunciando "evento já realizado" durante a festa), viva num lugar que passou
// despercebido — e invisível para a esteira, que só roda UTC e São Paulo. Sai
// agora pela peça da casa, que é a única que transforma Date em string.
export const addDiasISO = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return dataISOLocal(d)
}

// ————— Início de vendas (Sessão F2-S — sugestão 30) —————

/**
 * Início de vendas EFETIVO do evento — a régua da janela normalizada:
 * - campo `inicioVendas` preenchido → { data, origem: 'campo' } (o campo
 *   SEMPRE vence a premissa);
 * - campo vazio + premissa nascida com o evento (`vendasAbremDiasAntes` =
 *   N > 0) + data do evento → { data: data − N dias, origem: 'premissa',
 *   diasAntes: N } — decisão registrada para o Marco: o evento nasce SEM
 *   data, então a premissa não tem como gravar uma data no nascimento; o N
 *   herdado nasce com o evento e a data efetiva é derivada AO VIVO de
 *   data − N (muda junto se a data do evento mudar; preencher o campo fixa);
 * - senão → null (sem início de vendas = comportamento de sempre).
 *
 * `dia` = dia relativo à festa (negativo = antes; null sem data do evento).
 * `depoisDaFesta` = true quando o início cai depois da festa — a tela avisa
 * e a curva IGNORA o início (plano de vendas que começa depois da festa não
 * existe; nunca desenhamos dado sem sentido em silêncio).
 */
export function inicioVendasEfetivo(evento) {
  const campo = dataValida(evento?.inicioVendas) ? evento.inicioVendas : ''
  if (campo) {
    const dia = dataValida(evento?.data) ? diaRelativoHoje(evento.data, campo) : null
    return { data: campo, origem: 'campo', diasAntes: dia != null ? -dia : null, dia, depoisDaFesta: dia != null && dia > 0 }
  }
  const n = Math.round(num(evento?.vendasAbremDiasAntes))
  if (n > 0 && dataValida(evento?.data)) {
    return { data: addDiasISO(evento.data, -n), origem: 'premissa', diasAntes: n, dia: -n, depoisDaFesta: false }
  }
  return null
}

/** Data efetiva do início para as réguas (ritmo semanal): '' quando não há
 *  início — ou quando ele não faz sentido (depois da festa). */
export function inicioVendasParaRitmo(evento) {
  const ini = inicioVendasEfetivo(evento)
  return ini && !ini.depoisDaFesta ? ini.data : ''
}

// Seleção das festas passadas de referência — compartilhada entre a média
// por dia e a média NORMALIZADA da F2-S. Mesmíssima regra de sempre: só
// passadas com data e venda; o próprio evento fica fora; tipo (ou empresa
// do vínculo) com fallback para a média geral.
//
// `refIds` (Sessão F2-S — referência escolhível): quando presente e não
// vazio, a referência são SÓ essas festas (base 'ref'); as escolhidas que
// não vieram na busca são nomeáveis via `refAusentes` (a tela avisa). Se
// NENHUMA veio, cai na média da festa de sempre — com refAusentes cheio,
// nunca em silêncio. Sem refIds, o retorno é EXATAMENTE o de sempre (sem a
// chave refAusentes — byte a byte).
function festasUsadas(curva, { tipo, empresaVinculo, hoje, excluirEventoId, refIds } = {}) {
  if (!curva || !Array.isArray(curva.eventos)) return null
  const passadas = curva.eventos.filter(
    (e) =>
      e.id !== excluirEventoId &&
      dataValida(e.data) &&
      hoje &&
      e.data < hoje &&
      num(e.totalValor) > 0 &&
      (e.dias || []).length > 0
  )
  if (passadas.length === 0) return null
  const querRef = Array.isArray(refIds) && refIds.length > 0
  if (querRef) {
    const escolhidas = passadas.filter((e) => refIds.includes(e.id))
    const refAusentes = refIds.filter((id) => !escolhidas.some((e) => e.id === id))
    if (escolhidas.length > 0) return { usadas: escolhidas, base: 'ref', chave: '', refAusentes }
    // nenhuma escolhida na busca → média da festa, dizendo o que faltou
    const sel = festasUsadas(curva, { tipo, empresaVinculo, hoje, excluirEventoId })
    return sel ? { ...sel, refAusentes } : null
  }
  const chave = (tipo || '').trim() || (empresaVinculo || '').trim()
  const doTipo = chave
    ? passadas.filter((e) => normalizarNome(e.empresa) === normalizarNome(chave))
    : []
  const usadas = doTipo.length > 0 ? doTipo : passadas
  const base = doTipo.length > 0 ? 'tipo' : 'geral'
  return { usadas, base, chave }
}

// ————— Referência escolhível (Sessão F2-S — sugestão 30, pedido do Marco) —————

/** Forma segura do campo `curvaRef` do evento (mesma régua da migração). */
export function referenciaCurva(evento) {
  const v = evento?.curvaRef
  if (!v || typeof v !== 'object') return { modo: '', itens: [] }
  return {
    modo: v.modo === 'grupo' || v.modo === 'festa' ? v.modo : '',
    itens: Array.isArray(v.itens)
      ? v.itens
          .filter((x) => x && typeof x === 'object' && x.id != null)
          .map((x) => ({ id: x.id, nome: typeof x.nome === 'string' ? x.nome : '' }))
      : [],
  }
}

/** Ids da referência escolhida, ou null quando é a média da festa (padrão).
 *  No modo 'festa' vale SÓ a primeira (uma festa específica, por definição). */
export function refIdsDaCurva(evento) {
  const ref = referenciaCurva(evento)
  if (ref.modo === '' || ref.itens.length === 0) return null
  return ref.modo === 'festa' ? [ref.itens[0].id] : ref.itens.map((x) => x.id)
}

/** Festas passadas disponíveis na última busca — a lista do modal/seletor. */
export function festasPassadasDisponiveis(curva, { hoje, excluirEventoId } = {}) {
  const sel = festasUsadas(curva, { hoje, excluirEventoId })
  return sel ? sel.usadas : []
}

/**
 * Rótulo da referência EM USO ("referência: Brisa #2" · "referência:
 * grupo de 3 festas" · "referência: média Brisa") — o que o card, o
 * rodapé de premissas e a apresentação citam. `m` é a média em uso
 * (mediaHistorica ou mediaHistoricaNormalizada); null = sem histórico.
 */
export function rotuloReferencia(evento, m) {
  if (m && m.base === 'ref') {
    const ref = referenciaCurva(evento)
    if (ref.modo === 'festa' && m.nEventos === 1)
      return `referência: ${m.nomes[0] || ref.itens[0]?.nome || 'festa sem nome'}`
    return `referência: grupo de ${m.nEventos} ${m.nEventos === 1 ? 'festa' : 'festas'}`
  }
  if (m)
    return m.base === 'tipo'
      ? `referência: média ${m.chave}`
      : `referência: média geral (todas as festas)`
  return 'referência: média da festa'
}

/**
 * @typedef {{ id: string|number, nome: string, estorno: number }} AjusteHistorico
 * Metadado somente de retorno das médias, nunca de evento/cache/store.
 * Estorno é a magnitude dos dias negativos brutos, inclusive pós-festa;
 * não representa dinheiro acrescentado ao plano.
 */
function ajustesDasFestas(festas) {
  return festas.flatMap((e) => {
    const estorno = (e.dias || []).reduce((s, d) => s + Math.max(0, -num(d.valor)), 0)
    return estorno > 0
      ? [{ id: e.id, nome: e.nome || `Festa sem nome (id ${e.id})`, estorno }]
      : []
  })
}

// Preserva os dígitos decimais do Number recebido, sem escolher uma unidade
// monetária mínima. BigInt fica restrito à soma dos históricos com estorno.
function decimalExato(valor) {
  const [mantissa, expoente = '0'] = valor.toString().split('e')
  const casas = (mantissa.split('.')[1] || '').length
  const escala = casas - Number(expoente)
  const coeficiente = BigInt(mantissa.replace('.', ''))
  return escala < 0
    ? { coeficiente: coeficiente * 10n ** BigInt(-escala), escala: 0 }
    : { coeficiente, escala }
}

function pontosComEstorno(dias, total) {
  const parcelas = dias.map(d => decimalExato(num(d.valor)))
  const denominador = decimalExato(total)
  const escala = Math.max(denominador.escala, ...parcelas.map(p => p.escala))
  const inteiro = p => p.coeficiente * 10n ** BigInt(escala - p.escala)
  const teto = inteiro(denominador)
  const agrupados = []
  dias.forEach((d, i) => {
    const valor = inteiro(parcelas[i])
    const ultimo = agrupados[agrupados.length - 1]
    if (ultimo && ultimo.dia === d.dia) ultimo.valor += valor
    else agrupados.push({ dia: d.dia, valor })
  })
  let acumulado = 0n
  let maximo = 0n
  return agrupados.map(d => {
    acumulado += d.valor
    const limitado = acumulado < 0n ? 0n : acumulado > teto ? teto : acumulado
    if (limitado > maximo) maximo = limitado
    const fracao = maximo === 0n ? 0 : maximo === teto ? 1 : Number(`${maximo}e-${escala}`) / total
    return { dia: d.dia, fracao }
  })
}

// Derivação local: dias iguais são uma observação diária única. Ordenar a
// cópia e agrupar antes do máximo evita inventar ordem intradiária. O bruto
// e seu denominador líquido ficam intactos para as vendas realizadas.
function pontosHistoricosAjustados(evento) {
  const total = num(evento.totalValor)
  if (!(total > 0)) return []
  const dias = [...(evento.dias || [])].sort((a, b) => a.dia - b.dia)
  if (dias.some(d => num(d.valor) < 0)) return pontosComEstorno(dias, total)
  const agrupados = []
  for (const d of dias) {
    const ultimo = agrupados[agrupados.length - 1]
    if (ultimo && ultimo.dia === d.dia) ultimo.valor += num(d.valor)
    else agrupados.push({ dia: d.dia, valor: num(d.valor) })
  }
  let acumulado = 0
  let maximo = 0
  return agrupados.map((d) => {
    acumulado += d.valor
    maximo = Math.max(maximo, Math.max(0, Math.min(1, acumulado / total)))
    return { dia: d.dia, fracao: maximo }
  })
}

function fracaoHistoricaAteODia(pontos, diaLimite) {
  let fracao = 0
  for (const p of pontos) {
    if (p.dia > diaLimite) break
    fracao = p.fracao
  }
  return fracao
}

/** Uma frase por referência ajustada, com centavos; nenhuma escrita. */
export function mensagensAjustesCurva(media) {
  return (media?.ajustes || []).map((a) =>
    `A referência ‘${a.nome}’ tem ${fmtBRL2(a.estorno)} em estornos. A fração da curva histórica foi limitada entre 0% e 100% e não recua; os valores originais foram preservados.`
  )
}

/**
 * Média histórica da curva de vendas, em FRAÇÃO do total (0–1) por dia.
 *
 * - Entram só festas PASSADAS (data < hoje), com data e com venda
 *   (totalValor > 0); o próprio evento vinculado fica de fora
 *   (`excluirEventoId`) — referência não se compara consigo mesma.
 * - A festa de referência é o `tipo` do evento (Sessão N — mesmos nomes das
 *   marcas do Financeiro, casados por normalizarNome com `empresa` da rota);
 *   evento sem tipo usa a empresa do vínculo da ponte; sem nenhum dos dois,
 *   ou sem festas passadas do tipo, cai na MÉDIA GERAL — sempre dito na tela
 *   (`base` conta a história).
 * - Cada festa passada vira fração acumulada por dia (R$ vendidos ÷ total) e
 *   a média é SIMPLES entre festas — festa pequena pesa igual à grande, a
 *   pergunta é "quanto % costuma estar vendido", não R$ somados (mesma
 *   decisão da acurácia, sugestão 23). Venda pós-festa entra no total, então
 *   a fração pode não chegar a 1,0 no dia — leitura honesta ("a Brisa chega
 *   à festa com 97%; o resto entra depois").
 *
 * Retorna { pontos: [{ dia, fracao }], base: 'tipo'|'geral', chave,
 *           nEventos, nomes, ajustes?: AjusteHistorico[] } ou null
 * quando não há festa passada nenhuma.
 */
export function mediaHistorica(curva, opts = {}) {
  const sel = festasUsadas(curva, opts)
  if (!sel) return null
  const { usadas, base, chave } = sel

  const series = usadas.map(pontosHistoricosAjustados)
  const ajustes = ajustesDasFestas(usadas)
  const inicio = usadas.reduce(
    (min, e) => e.dias.reduce((m, d) => Math.min(m, d.dia), min),
    DIA_INICIO_PADRAO
  )
  const pontos = []
  for (let dia = inicio; dia <= 0; dia++) {
    let soma = 0
    for (const pontosDaFesta of series) soma += fracaoHistoricaAteODia(pontosDaFesta, dia)
    pontos.push({ dia, fracao: soma / usadas.length })
  }
  return {
    pontos,
    base,
    chave,
    nEventos: usadas.length,
    nomes: usadas.map((e) => e.nome),
    ...(ajustes.length > 0 ? { ajustes } : {}),
    // presente SÓ quando uma referência foi pedida (byte a byte sem ela)
    ...(sel.refAusentes !== undefined ? { refAusentes: sel.refAusentes } : {}),
  }
}

// ————— Tempo normalizado da janela de vendas (Sessão F2-S — sugestão 30) —————
//
// A FÓRMULA, apresentada e construída com o Marco em 19/07/2026:
// 1. cada festa passada revela a própria janela: início = dia do PRIMEIRO
//    pagamento aprovado → festa;
// 2. curvas históricas normalizadas em % da janela (u = 0 abriu vendas,
//    u = 1 festa) ANTES da média — a forma pura de como a festa vende,
//    independente de janela curta/longa;
// 3. plano(dia) = total do plano × forma((dia − início_de_vendas) ÷ janela
//    DESTE evento), com plano = 0 antes do início.

/**
 * Janela histórica de uma festa passada, em dias: primeiro pagamento →
 * festa. 0 quando a primeira venda registrada é no dia da festa (ou depois)
 * — festa sem forma pré-festa; null sem venda nenhuma.
 */
export function janelaHistoricaDias(eventoCurva) {
  const dias = eventoCurva?.dias || []
  if (dias.length === 0) return null
  const primeiro = dias.reduce((min, d) => Math.min(min, d.dia), Infinity)
  return primeiro < 0 ? -primeiro : 0
}

/**
 * Média histórica em TEMPO NORMALIZADO (passo 2 da fórmula): seleciona as
 * festas de referência (mesma regra da média por dia) e fica só com as que
 * têm janela > 0. Festas sem janela ficam NOMEADAS em `semJanela` — a tela
 * avisa, nada some em silêncio. `janelaMediaDias` = média SIMPLES das
 * janelas (o "Y dias" do aviso de ritmo). A forma em si é lida com
 * fracaoNormalizada(festas, u). `ajustes?: AjusteHistorico[]` identifica
 * estornos somente das festas com janela. Null quando nenhuma festa tem janela.
 */
export function mediaHistoricaNormalizada(curva, opts = {}) {
  const sel = festasUsadas(curva, opts)
  if (!sel) return null
  const comJanela = sel.usadas.filter((e) => janelaHistoricaDias(e) > 0)
  const semJanela = sel.usadas.filter((e) => !(janelaHistoricaDias(e) > 0)).map((e) => e.nome)
  if (comJanela.length === 0) return null
  const janelas = comJanela.map(janelaHistoricaDias)
  const ajustes = ajustesDasFestas(comJanela)
  return {
    festas: comJanela,
    base: sel.base,
    chave: sel.chave,
    nEventos: comJanela.length,
    nomes: comJanela.map((e) => e.nome),
    janelaMediaDias: janelas.reduce((s, j) => s + j, 0) / janelas.length,
    semJanela,
    ...(ajustes.length > 0 ? { ajustes } : {}),
    ...(sel.refAusentes !== undefined ? { refAusentes: sel.refAusentes } : {}),
  }
}

/**
 * Fração média vendida no instante u da janela (0 = abertura, 1 = festa) —
 * média SIMPLES entre as festas, cada uma lida na PRÓPRIA janela (passo 2
 * da fórmula). A leitura por festa é em degraus, limitada a 0–1 e sem retrocesso:
 * dia lido = início + ⌊u × janela⌋ (u fora de [0,1] é grampeado).
 */
export function fracaoNormalizada(festas, u) {
  if (!Array.isArray(festas) || festas.length === 0) return 0
  const uc = Math.max(0, Math.min(1, u))
  let soma = 0
  for (const e of festas) {
    const janela = janelaHistoricaDias(e)
    const dia = Math.floor(-janela + uc * janela + 1e-9)
    soma += fracaoHistoricaAteODia(pontosHistoricosAjustados(e), dia)
  }
  return soma / festas.length
}

/**
 * Aviso de janela mais curta que a histórica (sugestão 30): "janela de X
 * dias contra média histórica de Y — ritmo exigido N,N× o normal".
 * Null quando não há aperto (janela ≥ média) ou falta dado.
 */
export function avisoJanelaCurta(janelaDias, janelaMediaDias) {
  if (!(janelaDias > 0) || !(janelaMediaDias > 0) || janelaDias >= janelaMediaDias) return null
  const vezes = janelaMediaDias / janelaDias
  return {
    janelaDias,
    janelaMediaDias: Math.round(janelaMediaDias),
    vezes,
    texto: `janela de ${janelaDias} dias contra média histórica de ${Math.round(janelaMediaDias)} — ritmo exigido ${vezes.toFixed(1).replace('.', ',')}× o normal`,
  }
}

// Vendidos do PLANO completo (lotes esgotados): denominador da fração do
// desconto no modo nº para a curva — o plano é a régua do otimista esgotado.
// Mesmo filtro das funções abaixo: cortesia e lote vazio não são venda.
const pagosDoPlano = (evento) =>
  (evento?.lotes || [])
    .filter((l) => num(l.valor) > 0 && num(l.quantidade) > 0)
    .reduce((s, l) => s + num(l.quantidade), 0)

/**
 * Total do plano dos lotes em R$, na MESMA régua do realizado da Tiqueteira:
 * Σ qtd × preço × (1 − desconto efetivo). O desconto entra porque o
 * realizado já vem líquido de cupom (sugestão 17 — previsto × realizado
 * batem); desde a 29a o efetivo = cupom × fração (no modo nº, a fração aqui
 * usa os vendidos do PLANO completo — mesma régua de esgotar tudo). Taxa e
 * cashback ficam de fora dos dois lados (a curva compara VENDAS, não DRE).
 * Só lotes com preço e quantidade > 0 — cortesia não é venda.
 */
export function totalPlanoLotes(evento) {
  const fator = 1 - descontoEfetivoPct(evento, pagosDoPlano(evento)) / 100
  return (evento?.lotes || [])
    .filter((l) => num(l.valor) > 0 && num(l.quantidade) > 0)
    .reduce((s, l) => s + num(l.quantidade) * num(l.valor) * fator, 0)
}

// ————— Plano dos lotes: DOIS modos (bloco 3 — decisão do Marco, 19/07/2026) —————
//
// "Nenhum número difere entre os modos no TOTAL: mesmo plano, duas
// distribuições" — os dois terminam EXATAMENTE em totalPlanoLotes(evento)
// (provado por teste de igualdade em curvaVendas.test.js).

/**
 * Lotes que compõem o plano de venda, na ordem da tabela, com receita
 * acumulada (mesma régua do totalPlanoLotes: preço × qtd × (1 − desconto
 * efetivo do plano)). Inclui os "só otimista" (o plano dos lotes é o plano
 * de esgotar tudo — microtexto na tela); cortesia e lote vazio ficam fora
 * (não são venda).
 */
export function lotesDoPlano(evento) {
  const fator = 1 - descontoEfetivoPct(evento, pagosDoPlano(evento)) / 100
  let acumulada = 0
  return (evento?.lotes || [])
    .filter((l) => num(l.valor) > 0 && num(l.quantidade) > 0)
    .map((l) => {
      const receita = num(l.quantidade) * num(l.valor) * fator
      acumulada += receita
      return {
        id: l.id,
        nome: l.nome || 'Lote sem nome',
        receita,
        acumulada,
        viradaPrevista: typeof l.viradaPrevista === 'string' ? l.viradaPrevista : '',
      }
    })
}

/**
 * Modo 1 — "Pela forma histórica" (PADRÃO, zero digitação): a curva do plano
 * é a FORMA da média histórica normalizada para terminar em 100% no dia da
 * festa (o plano é vender tudo até a festa) e escalada ao total do plano.
 * As viradas de cada lote são derivadas: o dia em que a forma alcança a
 * fração acumulada do lote ("pelo ritmo histórico, o Lote 2 vira ~D-23").
 * Sem média histórica (ou média zerada no dia 0) → null: a tela explica e
 * aponta o modo 2 — nunca uma forma inventada.
 */
export function curvaPlanoForma(evento, media) {
  const lotes = lotesDoPlano(evento)
  const total = lotes.length ? lotes[lotes.length - 1].acumulada : 0
  if (total <= 0 || !media || !Array.isArray(media.pontos) || media.pontos.length === 0)
    return null
  const fim = media.pontos[media.pontos.length - 1]
  if (fim.dia !== 0 || fim.fracao <= 0) return null
  const norma = fim.fracao
  const pontos = media.pontos.map((p) => ({ dia: p.dia, valor: (p.fracao / norma) * total }))
  const viradas = lotes.map((l) => {
    const alvo = l.acumulada / total
    const ponto = media.pontos.find((p) => p.fracao / norma >= alvo - 1e-9)
    return { loteId: l.id, nome: l.nome, dia: ponto ? ponto.dia : 0, acumulada: l.acumulada }
  })
  return { pontos, viradas, total }
}

/**
 * Modo 1 com INÍCIO DE VENDAS (Sessão F2-S — passo 3 da fórmula da sugestão
 * 30): plano(dia) = total × forma((dia − início) ÷ janela deste evento), com
 * u grampeado em [0,1] e plano = 0 EXATO antes do início (antes de abrir
 * vendas não há venda prevista). A forma é a média normalizada reescalada
 * para terminar em 100% no dia da festa (o plano é vender tudo até a festa —
 * mesma normalização do curvaPlanoForma). `inicioDia` = dia relativo do
 * início (negativo; 0 = vendas abrem no dia da festa). Null quando falta o
 * essencial — a tela explica, nunca inventa forma.
 */
export function curvaPlanoJanela(evento, mediaNorm, inicioDia) {
  const lotes = lotesDoPlano(evento)
  const total = lotes.length ? lotes[lotes.length - 1].acumulada : 0
  if (total <= 0) return null
  if (!mediaNorm || !Array.isArray(mediaNorm.festas) || mediaNorm.festas.length === 0) return null
  if (inicioDia == null || !Number.isFinite(inicioDia) || inicioDia > 0) return null
  const norma = fracaoNormalizada(mediaNorm.festas, 1)
  if (norma <= 0) return null
  const janela = -inicioDia
  const forma = (dia) =>
    janela === 0
      ? dia >= 0
        ? 1
        : 0
      : fracaoNormalizada(mediaNorm.festas, (dia - inicioDia) / janela) / norma

  const grafInicio = Math.min(DIA_INICIO_PADRAO, inicioDia)
  const pontos = []
  if (inicioDia > grafInicio) {
    // zero até a véspera do início — "plano = 0 antes do início", exato
    pontos.push({ dia: grafInicio, valor: 0 })
    if (inicioDia - 1 > grafInicio) pontos.push({ dia: inicioDia - 1, valor: 0 })
  }
  for (let dia = inicioDia; dia <= 0; dia++) pontos.push({ dia, valor: forma(dia) * total })

  const viradas = lotes.map((l) => {
    const alvo = l.acumulada / total
    const ponto = pontos.find((p) => p.dia >= inicioDia && p.valor / total >= alvo - 1e-9)
    return { loteId: l.id, nome: l.nome, dia: ponto ? ponto.dia : 0, acumulada: l.acumulada }
  })
  return { pontos, viradas, total, janelaDias: janela }
}

/** Marcos acumulados cronológicos empatados usam o maior valor, sem somar
 * receitas nem alterar as viradas individuais. Preserva a lista sem empates. */
export function consolidarPontosDoPlano(pontos) {
  if (!Array.isArray(pontos) || !pontos.some((p, i) => i > 0 && p.dia === pontos[i - 1].dia)) return pontos
  const unidos = []
  for (const p of pontos) {
    const ultimo = unidos[unidos.length - 1]
    if (ultimo && ultimo.dia === p.dia) ultimo.valor = Math.max(num(ultimo.valor), num(p.valor))
    else unidos.push({ ...p })
  }
  return unidos
}

/**
 * Modo 2 — "Pelas datas dos lotes": cada lote com "virada prevista" vira um
 * marco (naquele dia, tudo até aquele lote está vendido); a linha liga os
 * marcos em reta. Regras honestas, sempre com aviso nomeando o lote:
 * - lote SEM virada entra na reta até a virada seguinte (ou até a festa,
 *   se for dos últimos) — aviso diz isso com o nome do lote;
 * - virada DEPOIS da festa é encostada no dia da festa, com aviso;
 * - viradas fora de ordem são encostadas na anterior (a curva de vendas
 *   acumulada nunca anda para trás), com aviso.
 * Sem data do EVENTO não há "dias até a festa" → { erro: 'sem-data-evento' }.
 *
 * `inicioDia` (Sessão F2-S — sugestão 30): o início de vendas como PISO —
 * virada antes dele é encostada nele (com aviso) e o plano fica em 0 até a
 * véspera do início. Sem o parâmetro (ou null) = comportamento de sempre,
 * salvo a união dos marcos empatados (Marco, 06/10/2026).
 */
export function curvaPlanoDatas(evento, { diaInicio = DIA_INICIO_PADRAO, inicioDia = null } = {}) {
  const lotes = lotesDoPlano(evento)
  const total = lotes.length ? lotes[lotes.length - 1].acumulada : 0
  if (total <= 0) return null
  if (!dataValida(evento?.data)) return { erro: 'sem-data-evento', total }
  const piso = inicioDia != null && Number.isFinite(inicioDia) && inicioDia <= 0 ? inicioDia : null

  const avisos = []
  const marcos = [] // { dia, acumulada, nomes }
  const semData = []
  let diaAnterior = null
  for (const l of lotes) {
    if (!dataValida(l.viradaPrevista)) {
      semData.push(l)
      continue
    }
    // diaRelativoHoje(a, b) = b − a → virada − festa (negativo antes da festa)
    let dia = diaRelativoHoje(evento.data, l.viradaPrevista)
    if (dia > 0) {
      avisos.push(
        `A virada prevista de “${l.nome}” (${fmtDataCurta(l.viradaPrevista)}) é DEPOIS da festa — foi encostada no dia da festa. Confira a data.`
      )
      dia = 0
    }
    if (piso != null && dia < piso) {
      avisos.push(
        `A virada prevista de “${l.nome}” (${fmtDataCurta(l.viradaPrevista)}) é ANTES do início de vendas — foi encostada nele (não se esgota lote antes de abrir as vendas). Confira as datas.`
      )
      dia = piso
    }
    if (diaAnterior != null && dia < diaAnterior) {
      avisos.push(
        `A virada prevista de “${l.nome}” vem ANTES da virada do lote anterior — foi encostada nela (vendas acumuladas não andam para trás). Confira a ordem das datas.`
      )
      dia = diaAnterior
    }
    if (semData.length > 0) {
      avisos.push(
        semData.length === 1
          ? `“${semData[0].nome}” está sem virada prevista — entrou na reta até a virada de “${l.nome}”.`
          : `Sem virada prevista: ${semData.map((x) => `“${x.nome}”`).join(', ')} — entraram na reta até a virada de “${l.nome}”.`
      )
      semData.length = 0
    }
    marcos.push({ dia, acumulada: l.acumulada, nome: l.nome, loteId: l.id })
    diaAnterior = dia
  }
  if (semData.length > 0) {
    avisos.push(
      semData.length === 1
        ? `“${semData[0].nome}” está sem virada prevista — entrou na reta até o dia da festa.`
        : `Sem virada prevista: ${semData.map((x) => `“${x.nome}”`).join(', ')} — entraram na reta até o dia da festa.`
    )
  }
  if (marcos.length === 0)
    return { erro: 'sem-nenhuma-virada', total, avisos }

  const pontos = []
  if (piso != null) {
    // início como piso: 0 exato até a véspera do início; a reta sobe dali
    const grafInicio = Math.min(diaInicio, piso)
    pontos.push({ dia: grafInicio, valor: 0 })
    if (piso - 1 > grafInicio) pontos.push({ dia: piso - 1, valor: 0 })
  } else {
    pontos.push({ dia: Math.min(diaInicio, marcos[0].dia), valor: 0 })
  }
  for (const m of marcos) pontos.push({ dia: m.dia, valor: m.acumulada })
  // o que sobrou (lotes finais sem virada) fecha o total no dia da festa
  const ultimo = pontos[pontos.length - 1]
  if (ultimo.valor < total - 1e-9 || ultimo.dia < 0) pontos.push({ dia: 0, valor: total })

  return {
    pontos: consolidarPontosDoPlano(pontos),
    viradas: marcos.map((m) => ({ loteId: m.loteId, nome: m.nome, dia: m.dia, acumulada: m.acumulada })),
    avisos,
    total,
  }
}

const fmtDataCurta = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

/** Modo efetivo do seletor: escolha lembrada por evento; padrão 'forma'. */
export const modoCurva = (evento) => (evento?.curvaModo === 'datas' ? 'datas' : 'forma')

export { normalizarNome }
