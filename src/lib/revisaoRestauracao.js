// Revisão do que a migração muda quando um dado GUARDADO volta ao app —
// "corrigir E mostrar" (decisão 18 do Marco, 25/07/2026).
//
// ————— o defeito que este módulo existe para fechar —————
//
// Medido em 25/07/2026 (classe S1): `restaurarSnapshot` devolvia o store CRU,
// sem passar pela migração. Um instantâneo salvo ANTES da trava dos ajustes de
// cenário (22/07) voltava com `custoPct −200` e a tela mostrava R$ 54.250 de
// lucro e 163% de margem onde a verdade é R$ 10.150 e 31% — e o número ainda
// MUDAVA SOZINHO no recarregamento seguinte, porque a abertura roda a migração
// calada. O mesmo evento, dois resultados em duas visitas, sem nada explicar.
//
// ————— por que a saída não era nenhuma das duas óbvias —————
//
// Devolver cru quebra o princípio 1 (número errado mostrado como certo).
// Corrigir calado quebra o princípio 7 (o caminho de volta deixa de devolver o
// que foi guardado, e o dado do Marco muda sem revisão). A decisão do Marco foi
// a terceira: a migração RODA, a tela DIZ item a item o que mudou, o dado cru
// CONTINUA guardado, e existe o caminho de ver o guardado sem aplicar.
//
// ————— o que este módulo é, e o que ele não é —————
//
// É LEITURA PURA e sem React: monta a revisão comparando o dado como foi salvo
// com o mesmo dado depois de `migrarEventos`. NENHUMA fórmula nasce aqui —
// `censoNormalizacoes` (as réguas da migração, fonte única desde a decisão 3a)
// e `computeCenarios` (calc.js, intocado) fazem todo o trabalho de conta. O que
// é novo é só o INVENTÁRIO: quais campos, em quais eventos, de que valor para
// qual, e quanto dinheiro isso move.
//
// A régua de "isto é zero" é a única da casa (`LIMIAR_ZERO`, meio centavo):
// resíduo de ponto flutuante não pode virar uma linha de correção na tela.

import { migrarEventos, migrarEvento, censoNormalizacoes } from './migracao.js'
import { computeCenarios, CENARIO_LABEL, CENARIOS } from './calc.js'
import { LIMIAR_ZERO } from './confrontoCustos.js'

/** Para onde vai todo valor que a migração recusa: "não informado". */
export const PARA_NAO_INFORMADO = 'não informado'

/**
 * Um campo da GRADE de cenário (`pessimista.custoPct`) some de um jeito
 * diferente dos outros: a migração REMOVE a chave (delete) em vez de gravar
 * '', para o cálculo cair no fallback documentado do calc. Os dois casos
 * terminam em "não informado", mas o efeito na conta é outro — e o microtexto
 * ao lado do número tem de dizer qual dos dois é.
 */
const ehGradeDeCenario = (campo) => typeof campo === 'string' && campo.includes('.')

const explicacaoDe = (campo) =>
  ehGradeDeCenario(campo)
    ? 'fora da faixa que o app aceita — o cenário volta a usar o ajuste padrão dele'
    : 'fora da faixa que o app aceita — o campo fica vazio e pede o número de novo'

/**
 * As correções que a migração vai fazer numa lista de eventos CRUS, item a
 * item e em português.
 *
 * `oQueMudou` é o rótulo do censo VERBATIM ("cenário pessimista, ajuste de
 * custos −200%") — o mesmo texto que o aviso do import já mostra ao Marco
 * desde a decisão 3a. Reusar a frase inteira, em vez de remontá-la aqui, é o
 * que garante que as duas telas nunca divirjam sobre o mesmo campo.
 *
 * @returns [{ evento, campo, oQueMudou, para, explicacao }]
 */
export function correcoesDaMigracao(eventosCrus) {
  return censoNormalizacoes(eventosCrus, { normalizarBarRealizado: false }).map((c) => ({
    evento: c.evento,
    campo: c.campo,
    oQueMudou: c.rotulo,
    para: c.para || PARA_NAO_INFORMADO,
    explicacao: c.explicacao || explicacaoDe(c.campo),
  }))
}

// Nome do evento para a tela — mesma régua do censo, para as duas listas da
// revisão falarem do mesmo jeito da mesma festa.
const nomeDoEvento = (e) =>
  e && typeof e === 'object' && typeof e.nome === 'string' && e.nome.trim()
    ? e.nome.trim()
    : '(sem nome)'

// Os números de um evento, ou null quando o evento é torto demais para a conta
// rodar. Um dado guardado pode ser qualquer coisa (backup editado à mão, chave
// mexida no navegador): a revisão não pode MORRER por causa disso — ela avisa e
// segue, que é o oposto de falhar em silêncio.
function numerosOuNull(evento) {
  try {
    const c = computeCenarios(evento)
    const linhas = []
    for (const k of CENARIOS) {
      const cen = CENARIO_LABEL[k].toLowerCase()
      // `formato` viaja com a linha para a tela não ter de adivinhar pelo
      // texto do rótulo qual formatador usar (R$ com vírgula × percentual).
      linhas.push({ label: `Lucro (${cen})`, formato: 'moeda', valor: c[k].lucro })
      linhas.push({ label: `Margem (${cen})`, formato: 'percentual', valor: c[k].margem })
    }
    return linhas
  } catch {
    return null
  }
}

const mudou = (a, b) => {
  if (a == null || b == null) return a !== b
  if (!Number.isFinite(a) || !Number.isFinite(b)) return !Object.is(a, b)
  return Math.abs(a - b) >= LIMIAR_ZERO
}

/**
 * O EFEITO da correção no resultado de UM evento: as linhas de lucro e margem
 * que de fato se movem, com o antes e o depois.
 *
 * Esta metade é o que fecha o buraco que uma lista de campos sozinha deixaria:
 * a migração normaliza mais coisas do que o censo nomeia (fechamento órfão,
 * patrocínio solto, marcações tortas). Se algum número se move sem uma linha de
 * correção para explicá-lo, ele aparece AQUI mesmo assim — a revisão nunca
 * mostra "nada mudou" enquanto o dinheiro na tela muda.
 *
 * @returns { evento, linhas: [{ label, formato, antes, depois }], erro } | null
 */
export function efeitoNoResultado(eventoCru, eventoCorrigido) {
  const nome = nomeDoEvento(eventoCru)
  const antes = numerosOuNull(eventoCru)
  const depois = numerosOuNull(eventoCorrigido)
  if (!antes || !depois)
    return {
      evento: nome,
      linhas: [],
      erro: !antes
        ? 'não foi possível calcular os números desta previsão como ela foi salva (o dado guardado está fora de forma)'
        : 'não foi possível calcular os números desta previsão depois da correção',
    }
  const linhas = antes
    .map((l, i) => ({
      label: l.label,
      formato: l.formato,
      antes: l.valor,
      depois: depois[i].valor,
    }))
    .filter((l) => mudou(l.antes, l.depois))
  return linhas.length > 0 ? { evento: nome, linhas, erro: null } : null
}

/**
 * Revisão de UM evento que volta da lixeira.
 * @returns { eventoCru, eventoCorrigido, correcoes, efeitos, precisaRevisao }
 */
export function revisarEventoRestaurado(eventoCru) {
  const eventoCorrigido = migrarEvento(eventoCru)
  const correcoes = correcoesDaMigracao([eventoCru])
  const efeito = efeitoNoResultado(eventoCru, eventoCorrigido)
  const efeitos = efeito ? [efeito] : []
  return {
    eventoCru,
    eventoCorrigido,
    correcoes,
    efeitos,
    precisaRevisao: correcoes.length > 0 || efeitos.length > 0,
  }
}

/**
 * Revisão de um STORE inteiro que volta de um instantâneo.
 *
 * `storeCru` sai daqui INTOCADO (mesma referência que entrou) — é ele que o
 * caminho de "não aplicar" mostra, e é ele que continua guardado na lista de
 * versões. `storeCorrigido` é o que se aplica no app.
 *
 * @returns { storeCru, storeCorrigido, correcoes, efeitos, precisaRevisao }
 */
export function revisarRestauracao(storeCru) {
  const eventosCrus = Array.isArray(storeCru?.eventos) ? storeCru.eventos : []
  const eventosCorrigidos = migrarEventos(eventosCrus)
  const correcoes = correcoesDaMigracao(eventosCrus)
  const efeitos = eventosCrus
    .map((cru, i) => efeitoNoResultado(cru, eventosCorrigidos[i]))
    .filter(Boolean)
  return {
    storeCru,
    storeCorrigido: { ...storeCru, eventos: eventosCorrigidos },
    correcoes,
    efeitos,
    precisaRevisao: correcoes.length > 0 || efeitos.length > 0,
  }
}

/**
 * Uma frase de cabeçalho que diz o TAMANHO do que mudou, sem números de
 * dinheiro (esses vão nas linhas, formatados pela tela). Serve ao toast do
 * caminho curto e ao título do painel de revisão.
 */
export function resumoRevisao(revisao) {
  if (!revisao?.precisaRevisao) return ''
  const n = revisao.correcoes.length
  const ev = revisao.efeitos.length
  const partes = []
  if (n > 0) partes.push(n === 1 ? '1 valor corrigido' : `${n} valores corrigidos`)
  if (ev > 0)
    partes.push(
      ev === 1 ? 'o resultado de 1 previsão muda' : `o resultado de ${ev} previsões muda`
    )
  // Correção nenhuma e efeito nenhum não chega aqui (precisaRevisao seria
  // false); efeito sem correção nomeada chega, e tem de ter texto próprio.
  return partes.join(' — ')
}
