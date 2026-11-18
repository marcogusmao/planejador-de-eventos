// Premissas por festa (Sessão P — sugestão 20 do MELHORIAS.md, aprovada pelo
// Marco em 18/07/2026): valores com que toda previsão NOVA de um tipo de
// festa nasce — grade dos cenários, margens do semáforo, desconto do cupom,
// contingência, taxa e cashback. A Sessão F2-R (sugestão 29c) somou os 3
// campos da bilheteria nova: ingressos com desconto (modo + valor) e quem
// paga a taxa — herdados como os demais, SÓ no nascimento.
//
// Regras inegociáveis da sugestão:
// 1. Premissa age SÓ no nascimento do evento — evento existente NUNCA muda
//    (nada aqui toca evento; `novoEventoDoTipo` só CRIA).
// 2. Herança campo a campo: tipo → "Padrão geral" → padrões atuais do app.
//    Campo em branco ('') = herda do nível de cima.
// 3. Tudo continua editável no evento — premissa é valor de nascimento, não
//    trava nada.
//
// Armazenamento: campo ADITIVO `ajustes` do store (storage.js) — entra no
// backup JSON e nos snapshots; backup antigo sem o campo abre normalmente
// (round-trip provado em premissas.test.js).
//
// Custos padrão por festa (sugestão 21, também aqui): lista digitada PELO
// MARCO nos Ajustes — categoria, descrição, valor estimado, status ORÇAR.
// Evento novo do tipo nasce com esses custos lançados. NUNCA derivada
// automaticamente de evento nenhum e NUNCA retroage.
//
// Decisões registradas para o Marco revisar (Sessão P, madrugada):
// - Evento SEM tipo ("sem categoria") herda do Padrão geral (→ app): o
//   Padrão geral existe para valer para toda festa nova; sem ele valer aqui,
//   o nome mentiria. Sem nada configurado, nasce como sempre nasceu.
// - Ticket médio MANUAL (R$) NÃO é premissa: depende dos lotes de cada
//   evento; a premissa da grade cobre os percentuais (venda/custos/ticket).
// - Custos padrão herdam por LISTA INTEIRA (tipo com lista usa a sua; sem
//   lista, a do Padrão geral) — misturar as duas listas duplicaria itens
//   como "Alvará" sem ninguém pedir.
// - Categoria desconhecida num custo padrão (backup editado à mão) vira
//   'extras' (Extras & Contingência): o valor aparece em vez de sumir calado.

import { novoEvento, novoItem, novoLote, CATEGORIAS_PADRAO } from './defaults.js'
import { CENARIOS } from './calc.js'
import { num, uid } from './util.js'

// número finito ou string numérica preservados como vieram; resto vira ''
// (= herda) — mesma regra dos campos opcionais da migração (migracao.js).
const valorNumericoOuVazio = (v) =>
  (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
    ? v
    : ''

// Trava dos percentuais (Marco, 20/07/2026) TAMBÉM na premissa: os campos de
// CONTA vivem em 0..100 — sem isto, uma premissa antiga com taxa 150 (gravada
// antes da trava, ou por backup à mão) paria evento NASCENDO torto, e a conta
// rodava o absurdo a sessão inteira (achado A1 da verificação hostil de
// 20/07). Fora da faixa vira '' (= herda o nível de baixo), nunca conta.
const pctNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= 0 && Number(s) <= 100) ? s : ''
}
const CAMPOS_EVENTO_FAIXA = ['taxaBilheteria', 'cashbackPct', 'contingenciaPct', 'descontoMedioPct']

// Trava dos ajustes de cenário (Marco, 22/07/2026) TAMBÉM na premissa: a grade
// trava POR CAMPO — custoPct/ticketPct em −50..100 (AJUSTES relativos) e
// vendaPct em 0..100 (ABSOLUTO, faixa própria da decisão 3b). Sem isto, uma
// premissa antiga com custoPct −200 (backup à mão) paria evento NASCENDO torto
// (irmão do achado A1 dos percentuais de conta). Fora da faixa vira '' (= herda)
// — na premissa, '' SEMPRE significa "premissa não define" e cai no nível de
// baixo (NÃO é delete como na migração de evento: aqui o vazio já É o padrão).
const cenarioNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= -50 && Number(s) <= 100) ? s : ''
}
const vendaNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= 0 && Number(s) <= 100) ? s : ''
}
const reguaGrade = (campo) => (campo === 'vendaPct' ? vendaNaFaixaOuVazio : cenarioNaFaixaOuVazio)

const preenchido = (v) => v !== '' && v != null

// Campos de premissa "do evento" (fora da grade): premissa → campo homônimo
// do evento no nascimento.
export const CAMPOS_EVENTO = [
  'taxaBilheteria',
  'cashbackPct',
  'contingenciaPct',
  'descontoMedioPct',
  'descontoIngressosValor',
  'margemAlvo',
  'margemMinima',
  // Sessão F2-S (sugestão 30): "vendas abrem N dias antes" — no nascimento o
  // N herdado vira o campo homônimo do evento; o início efetivo = data − N
  // quando o campo de data está vazio (inicioVendasEfetivo, curvaVendas.js).
  'vendasAbremDiasAntes',
]

// Campos de ESCOLHA (Sessão F2-R — sugestão 29c): valores de vocabulário
// fechado, herdados pela MESMA cadeia campo a campo (tipo → geral → app);
// '' = herda. No nascimento a string vai como está (nunca passa por num()).
export const CAMPOS_EVENTO_ESCOLHA = {
  descontoIngressosModo: ['pct', 'numero'],
  taxaPagaPor: ['nos', 'cliente'],
}

export const CAMPOS_GRADE = ['vendaPct', 'custoPct', 'ticketPct']

// Padrões ATUAIS do app — o último nível da herança. Fonte: novoEvento()
// (defaults.js) para taxa/cashback/contingência e a grade completa da
// sugestão 19; descontoMedioPct '' = 0%; margens '' = 28/20 via veredito()
// (calc.js) — manter '' preserva o comportamento de sempre do evento novo.
export const PADROES_APP = {
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  descontoMedioPct: '',
  // sugestão 29: '' = fração cheia (cupom em todos) · modo % · taxa por nós —
  // os padrões do evento novo (defaults.js), conta de sempre.
  descontoIngressosValor: '',
  descontoIngressosModo: '',
  taxaPagaPor: '',
  margemAlvo: '',
  margemMinima: '',
  // sugestão 30: '' = sem premissa de início de vendas (o campo de data do
  // evento continua opcional e vence sempre) — comportamento de sempre.
  vendasAbremDiasAntes: '',
  cenarios: {
    // Pessimista 80 desde 27/07/2026 (decisão A do Marco) — espelha
    // novoEvento() em defaults.js, que é a fonte deste bloco.
    pessimista: { vendaPct: 80, custoPct: 10, ticketPct: 0 },
    realista: { vendaPct: 90, custoPct: 0, ticketPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5, ticketPct: 0 },
  },
}

export const premissaVazia = () => ({
  taxaBilheteria: '',
  cashbackPct: '',
  contingenciaPct: '',
  descontoMedioPct: '',
  descontoIngressosValor: '',
  descontoIngressosModo: '',
  taxaPagaPor: '',
  margemAlvo: '',
  margemMinima: '',
  vendasAbremDiasAntes: '',
  cenarios: {
    pessimista: { vendaPct: '', custoPct: '', ticketPct: '' },
    realista: { vendaPct: '', custoPct: '', ticketPct: '' },
    otimista: { vendaPct: '', custoPct: '', ticketPct: '' },
  },
  custosPadrao: [],
  // Lotes padrão por festa (Sessão F2-U — sugestão 32): o "gabarito" de lotes
  // com que uma previsão NOVA da festa nasce (irmão dos custos padrão). Lista
  // vazia = a festa nasce com os lotes padrão de sempre (LOTES_PADRAO em
  // defaults.js). Herança por LISTA INTEIRA, como os custos padrão.
  lotesPadrao: [],
})

const CATEGORIA_KEYS = CATEGORIAS_PADRAO.map((c) => c.key)

// Item de custo padrão (sugestão 21): { id, categoria, servico, estimado }.
// Categoria fora das 7 do app vira 'extras' — valor visível, nunca some
// calado. Status não é campo: custo padrão nasce sempre ORÇAR (regra da
// sugestão). Não-objeto é descartado.
const formaCustoPadrao = (c) => {
  if (!c || typeof c !== 'object') return null
  return {
    id: typeof c.id === 'string' && c.id !== '' ? c.id : uid(),
    categoria: CATEGORIA_KEYS.includes(c.categoria) ? c.categoria : 'extras',
    servico: typeof c.servico === 'string' ? c.servico : '',
    estimado: valorNumericoOuVazio(c.estimado),
  }
}

// Item de lote padrão (sugestão 32): { id, nome, valor, quantidade,
// somenteOtimista, cortesia }. valor/quantidade seguem a régua dos números
// opcionais (número/string numérica ou ''); marcações são booleanas. Cortesia
// = lote de valor R$ 0 (calc.js/isCortesia); no nascimento a marcação vira
// valor 0 — nenhuma fórmula nova, só pré-preenche o campo de lote. Não-objeto
// é descartado.
const formaLotePadrao = (l) => {
  if (!l || typeof l !== 'object') return null
  return {
    id: typeof l.id === 'string' && l.id !== '' ? l.id : uid(),
    nome: typeof l.nome === 'string' ? l.nome : '',
    valor: valorNumericoOuVazio(l.valor),
    quantidade: valorNumericoOuVazio(l.quantidade),
    somenteOtimista: l.somenteOtimista === true,
    cortesia: l.cortesia === true,
  }
}

const formaPremissa = (p) => {
  const base = premissaVazia()
  if (!p || typeof p !== 'object') return base
  for (const campo of CAMPOS_EVENTO)
    base[campo] = CAMPOS_EVENTO_FAIXA.includes(campo)
      ? pctNaFaixaOuVazio(p[campo])
      : valorNumericoOuVazio(p[campo])
  // campos de escolha: fora do vocabulário vira '' (= herda) — premissa torta
  // nunca liga modo nº nem repasse sozinha (mesma régua da migração).
  for (const [campo, valores] of Object.entries(CAMPOS_EVENTO_ESCOLHA)) {
    base[campo] = valores.includes(p[campo]) ? p[campo] : ''
  }
  // Fração do cupom: a faixa 0..100 só vale quando ESTA premissa declara o
  // modo % — com modo herdado ('') a mesma casa pode significar CONTAGEM de
  // ingressos, e apagar contagem seria perda de dado (achado A3).
  if (base.descontoIngressosModo === 'pct')
    base.descontoIngressosValor = pctNaFaixaOuVazio(base.descontoIngressosValor)
  for (const cen of CENARIOS) {
    for (const campo of CAMPOS_GRADE) {
      base.cenarios[cen][campo] = reguaGrade(campo)(p.cenarios?.[cen]?.[campo])
    }
  }
  if (Array.isArray(p.custosPadrao)) {
    base.custosPadrao = p.custosPadrao.map(formaCustoPadrao).filter(Boolean)
  }
  if (Array.isArray(p.lotesPadrao)) {
    base.lotesPadrao = p.lotesPadrao.map(formaLotePadrao).filter(Boolean)
  }
  return base
}

export const ajustesVazio = () => ({ geral: premissaVazia(), porTipo: {} })

/**
 * Garante a forma do campo `ajustes` do store. Ausente/inválido → vazio
 * (tudo herda dos padrões do app = comportamento de sempre). Backup antigo
 * sem o campo abre normalmente por aqui.
 */
export function formaAjustes(raw) {
  if (!raw || typeof raw !== 'object') return ajustesVazio()
  const porTipo = {}
  if (raw.porTipo && typeof raw.porTipo === 'object') {
    for (const [tipo, p] of Object.entries(raw.porTipo)) {
      if (typeof tipo === 'string' && tipo.trim() !== '') porTipo[tipo] = formaPremissa(p)
    }
  }
  return { geral: formaPremissa(raw.geral), porTipo }
}

/** Alguma premissa preenchida neste nível? (para legendas e o modal de nova previsão) */
export function temPremissas(premissa) {
  const p = formaPremissa(premissa)
  return (
    CAMPOS_EVENTO.some((campo) => preenchido(p[campo])) ||
    Object.keys(CAMPOS_EVENTO_ESCOLHA).some((campo) => preenchido(p[campo])) ||
    CENARIOS.some((cen) => CAMPOS_GRADE.some((campo) => preenchido(p.cenarios[cen][campo]))) ||
    p.custosPadrao.length > 0 ||
    p.lotesPadrao.length > 0
  )
}

/**
 * Resolve um campo pela cadeia tipo → geral → app.
 * Devolve { valor, origem: 'tipo' | 'geral' | 'app' }.
 */
function resolverCampo(ajustes, tipo, ler, valorApp) {
  const doTipo = tipo ? ler(ajustes.porTipo?.[tipo]) : undefined
  if (preenchido(doTipo)) return { valor: doTipo, origem: 'tipo' }
  const doGeral = ler(ajustes.geral)
  if (preenchido(doGeral)) return { valor: doGeral, origem: 'geral' }
  return { valor: valorApp, origem: 'app' }
}

/**
 * Premissas EFETIVAS de um tipo (ou '' = sem categoria), campo a campo, com a
 * origem de cada valor — a UI mostra o efetivo como placeholder e a origem
 * como legenda; o nascimento grava só o que não veio do nível 'app'.
 */
export function resolverPremissas(ajustesRaw, tipo = '') {
  const ajustes = formaAjustes(ajustesRaw)
  const r = { cenarios: {} }
  for (const campo of CAMPOS_EVENTO) {
    r[campo] = resolverCampo(ajustes, tipo, (p) => p?.[campo], PADROES_APP[campo])
  }
  for (const campo of Object.keys(CAMPOS_EVENTO_ESCOLHA)) {
    r[campo] = resolverCampo(ajustes, tipo, (p) => p?.[campo], PADROES_APP[campo])
  }
  for (const cen of CENARIOS) {
    r.cenarios[cen] = {}
    for (const campo of CAMPOS_GRADE) {
      r.cenarios[cen][campo] = resolverCampo(
        ajustes,
        tipo,
        (p) => p?.cenarios?.[cen]?.[campo],
        PADROES_APP.cenarios[cen][campo]
      )
    }
  }
  return r
}

/** Linha nova de custo padrão para a UI dos Ajustes (sugestão 21). */
export const novoCustoPadrao = (patch = {}) => ({
  id: uid(),
  categoria: 'aeb',
  servico: '',
  estimado: '',
  ...patch,
})

/** Linha nova de lote padrão para a UI dos Ajustes (sugestão 32). */
export const novoLotePadrao = (patch = {}) => ({
  id: uid(),
  nome: '',
  valor: '',
  quantidade: '',
  somenteOtimista: false,
  cortesia: false,
  ...patch,
})

/**
 * Lotes padrão EFETIVOS de um tipo (sugestão 32): a lista do TIPO quando tem
 * itens; senão a do Padrão geral; senão nenhuma (padrão do app = a previsão
 * nasce com os lotes padrão de sempre — LOTES_PADRAO em defaults.js). Herança
 * por lista inteira, igual aos custos padrão.
 */
export function lotesPadraoEfetivos(ajustesRaw, tipo = '') {
  const ajustes = formaAjustes(ajustesRaw)
  const doTipo = tipo ? ajustes.porTipo[tipo]?.lotesPadrao || [] : []
  if (doTipo.length > 0) return doTipo
  return ajustes.geral.lotesPadrao
}

/**
 * Custos padrão EFETIVOS de um tipo (sugestão 21): a lista do TIPO quando
 * tem itens; senão a do Padrão geral; senão nenhuma (padrão do app = evento
 * nasce sem custos, como sempre). Herança por lista inteira, de propósito —
 * ver decisão no topo do arquivo.
 */
export function custosPadraoEfetivos(ajustesRaw, tipo = '') {
  const ajustes = formaAjustes(ajustesRaw)
  const doTipo = tipo ? ajustes.porTipo[tipo]?.custosPadrao || [] : []
  if (doTipo.length > 0) return doTipo
  return ajustes.geral.custosPadrao
}

/**
 * Cria um evento NOVO do tipo dado, nascendo com as premissas herdadas
 * (sugestão 20) e com os custos padrão do tipo lançados (sugestão 21 —
 * status ORÇAR, como todo item novo). Sem premissa nenhuma configurada, o
 * evento nasce EXATAMENTE como novoEvento() + tipo — campo resolvido no
 * nível 'app' não é regravado (preserva a forma e o comportamento de sempre;
 * provado em premissas.test.js). Só CRIA: nenhum evento existente é lido ou
 * alterado (regra 1) — custo padrão NUNCA retroage.
 */
export function novoEventoDoTipo(tipo = '', ajustesRaw = null, nome = 'Novo evento') {
  const ev = novoEvento(nome)
  ev.tipo = typeof tipo === 'string' ? tipo : ''
  const r = resolverPremissas(ajustesRaw, ev.tipo)
  for (const campo of CAMPOS_EVENTO) {
    if (r[campo].origem !== 'app') ev[campo] = num(r[campo].valor)
  }
  // campos de escolha (sugestão 29c): a string vai como está — o vocabulário
  // já foi validado por formaPremissa (torto virou '' e cai no nível 'app').
  for (const campo of Object.keys(CAMPOS_EVENTO_ESCOLHA)) {
    if (r[campo].origem !== 'app') ev[campo] = r[campo].valor
  }
  for (const cen of CENARIOS) {
    for (const campo of CAMPOS_GRADE) {
      const res = r.cenarios[cen][campo]
      if (res.origem !== 'app') ev.cenariosConfig[cen][campo] = num(res.valor)
    }
  }
  for (const c of custosPadraoEfetivos(ajustesRaw, ev.tipo)) {
    // id NOVO por evento (novoItem) — o id do custo padrão é só da lista dos
    // Ajustes; estimado vazio continua vazio (custo lançado para orçar).
    const cat = ev.categorias.find((x) => x.id === c.categoria)
    if (cat)
      cat.itens.push(
        novoItem({ servico: c.servico, estimado: c.estimado === '' ? '' : num(c.estimado) })
      )
  }
  // Lotes padrão (sugestão 32): quando a festa tem gabarito de lotes, ele
  // SUBSTITUI os lotes padrão de nascimento por inteiro (herança por lista);
  // sem gabarito, ev.lotes fica EXATAMENTE como novoEvento() montou (prova
  // byte a byte de "sem gabarito = comportamento atual"). Cortesia vira valor
  // 0 (calc.js/isCortesia) — pré-preenche o campo de lote, nenhuma fórmula
  // nova. id NOVO por evento (novoLote), como nos custos padrão.
  const lotes = lotesPadraoEfetivos(ajustesRaw, ev.tipo)
  if (lotes.length > 0) {
    ev.lotes = lotes.map((l) =>
      novoLote({
        nome: l.nome,
        valor: l.cortesia ? 0 : l.valor === '' ? '' : num(l.valor),
        quantidade: l.quantidade === '' ? '' : num(l.quantidade),
        somenteOtimista: l.somenteOtimista === true,
      })
    )
  }
  return ev
}
