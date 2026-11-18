// Acurácia das previsões (Sessão Q — sugestão 23 do MELHORIAS.md).
// LEITURA derivada pura, ZERO schema: nada é gravado, tudo vem dos
// fechamentos que a Sessão E já calcula (fechamentoCustos/fechamentoReceita —
// desvio é subtração e %, a mesma aritmética já exibida). Nada aqui entra em
// computeCenarios.
//
// Regras de honestidade estatística (nada de número inventado):
// - Só evento com ALGUM realizado ("fechado") entra; os demais ficam fora.
// - Categoria só entra na média quando tem realizado E estimado > 0 (sem
//   estimado não existe % de desvio — dividir por zero não vira estatística).
// - Média SIMPLES dos desvios % por evento (cada evento fechado pesa igual:
//   a pergunta é "quanto costumo errar por evento", não "quanto errei em R$
//   somados" — evento grande não deve esconder o erro do pequeno).
// - Bilheteria: realizado informado × receita bruta do realista (a mesma
//   comparação da aba Fechamento). Bar fica de fora da acurácia de propósito
//   (lucro líquido informado à mão + eventos open bar nem têm bar — misturar
//   enviesaria a média; decisão registrada no MELHORIAS.md).
// - Agregação por NOME de categoria (aparado): "A&B" de um evento soma com
//   "A&B" de outro mesmo com ids internos diferentes (importados/custom).

import { num } from './util.js'
import { computeCenario } from './calc.js'
import { fechamentoCustos, fechamentoReceita, NOME_BILHETERIA_BRUTA } from './fechamento.js'
import { custosQuebrados, receitaQuebrada, fotoQuebrada } from './dadoQuebrado.js'

/**
 * FESTA ACUSADA FICA FORA DA MÉDIA (05/10/2026, 2ª revisão do PR #98).
 *
 * Medido pelo revisor: uma Brisa SÃ (Estrutura estimada R$ 20.000, realizada
 * R$ 22.000) mostrava "Estrutura +10%" e "Custo total +10%". Com uma festa
 * "estimado 1e308 + realizado R$ 5.000" fechada ao lado, a mesma Brisa
 * passava a mostrar "+5%" — sem aviso nenhum. O desvio da quebrada é
 * 5.000 / 1e308 − 1 = −100%, que a média simples divide com a festa sã.
 * Decisão do Marco, 26/07/2026: o dado quebrado para de contaminar festa sã.
 *
 * Acusada = custo ou receita realizada que não cabe na régua (dadoQuebrado.js)
 * ou fotografia do fechamento quebrada. Ela não some calada: quem agrega
 * devolve a lista `fora`, e a tela diz quantas ficaram de fora e por quê.
 * Sem festa acusada, NADA muda — nem número, nem texto.
 */
export function festaAcusada(evento) {
  if (custosQuebrados(evento).ha || receitaQuebrada(evento).ha) return true
  const foto = evento?.status === 'fechado' ? evento?.fechamento?.foto?.resultado : null
  return foto != null && fotoQuebrada(foto)
}

/** Evento "fechado" para a acurácia: tem algum realizado (custo ou receita). */
export function temFechamentoInformado(evento) {
  const custos = fechamentoCustos(evento.categorias)
  if (custos.algumRealizado) return true
  const rec = fechamentoReceita(evento, computeCenario(evento, 'realista'))
  return rec.algumRealizado
}

// Desvios de UM evento fechado, prontos para agregar.
function desviosDoEvento(evento) {
  const realista = computeCenario(evento, 'realista')
  const custos = fechamentoCustos(evento.categorias)
  const rec = fechamentoReceita(evento, realista)
  const categorias = custos.porCategoria
    .filter((c) => c.desvioPct != null) // temRealizado && estimado > 0
    .map((c) => ({ nome: (c.nome || '').trim() || 'Sem nome', desvioPct: c.desvioPct }))
  const bilheteria = rec.linhas.find((l) => l.nome === NOME_BILHETERIA_BRUTA)
  return {
    categorias,
    custoTotalPct: custos.desvioTotalPct, // null quando sem realizado/estimado 0
    bilheteriaPct: bilheteria && bilheteria.desvioPct != null ? bilheteria.desvioPct : null,
  }
}

const media = (valores) =>
  valores.length === 0 ? null : valores.reduce((s, v) => s + v, 0) / valores.length

// Agrega uma lista de desviosDoEvento em médias simples.
function agregar(listaDesvios) {
  const porNome = new Map()
  for (const d of listaDesvios) {
    for (const c of d.categorias) {
      if (!porNome.has(c.nome)) porNome.set(c.nome, [])
      porNome.get(c.nome).push(c.desvioPct)
    }
  }
  const categorias = [...porNome.entries()]
    .map(([nome, pcts]) => ({ nome, n: pcts.length, mediaPct: media(pcts) }))
    .sort((a, b) => Math.abs(b.mediaPct) - Math.abs(a.mediaPct))
  const custoTotais = listaDesvios.map((d) => d.custoTotalPct).filter((v) => v != null)
  const bilheterias = listaDesvios.map((d) => d.bilheteriaPct).filter((v) => v != null)
  return {
    n: listaDesvios.length,
    categorias,
    custoTotal: custoTotais.length > 0 ? { n: custoTotais.length, mediaPct: media(custoTotais) } : null,
    bilheteria: bilheterias.length > 0 ? { n: bilheterias.length, mediaPct: media(bilheterias) } : null,
  }
}

/**
 * Acurácia agregada de todos os eventos fechados: geral + por tipo de festa.
 * `porTipo` traz só tipos com pelo menos um evento fechado; evento sem tipo
 * agrega no tipo '' ("Sem categoria").
 */
export function acuraciaAgregada(eventos) {
  const candidatos = (eventos || []).filter(temFechamentoInformado)
  const fora = candidatos
    .filter(festaAcusada)
    .map((e) => ({ nome: String(e.nome || '').trim() || 'festa sem nome', tipo: (e.tipo || '').trim() }))
  const fechados = candidatos.filter((e) => !festaAcusada(e))
  const desvios = fechados.map((e) => ({ tipo: (e.tipo || '').trim(), d: desviosDoEvento(e) }))
  const tipos = new Map()
  for (const { tipo, d } of desvios) {
    if (!tipos.has(tipo)) tipos.set(tipo, [])
    tipos.get(tipo).push(d)
  }
  return {
    nFechados: fechados.length,
    fora,
    geral: agregar(desvios.map((x) => x.d)),
    porTipo: [...tipos.entries()].map(([tipo, lista]) => ({ tipo, ...agregar(lista) })),
  }
}

/**
 * Acurácia de contexto para a aba Fechamento de UM evento: o agregado da
 * MESMA festa quando existe, senão o geral. Devolve também de onde veio,
 * para a tela dizer ("nos N eventos fechados de Brisa…").
 */
export function acuraciaContexto(eventos, evento) {
  const agregada = acuraciaAgregada(eventos)
  const tipo = (evento?.tipo || '').trim()
  const doTipo = agregada.porTipo.find((t) => t.tipo === tipo)
  if (tipo && doTipo && doTipo.n > 0)
    return {
      ...doTipo,
      escopo: 'tipo',
      nFechados: agregada.nFechados,
      fora: agregada.fora.filter((f) => f.tipo === tipo),
    }
  return { ...agregada.geral, tipo: '', escopo: 'geral', nFechados: agregada.nFechados, fora: agregada.fora }
}

/**
 * A frase que a tela mostra quando festa acusada ficou fora da média, ou null.
 * Nomeia até três festas e conta o resto.
 */
export function fraseForaDaMedia(fora) {
  const n = (fora || []).length
  if (n === 0) return null
  const nomes = fora.slice(0, 3).map((f) => `“${f.nome}”`).join(', ')
  const resto = n > 3 ? ` e mais ${n - 3}` : ''
  // Concordância (3ª revisão do PR #98): "3 eventos … para ele voltar" era o
  // singular grudado no plural.
  return n === 1
    ? `1 evento ficou fora desta média por ter um valor que o app não consegue calcular (${nomes}) — corrija na festa para ele voltar a contar.`
    : `${n} eventos ficaram fora desta média por terem um valor que o app não consegue calcular (${nomes}${resto}) — corrija nas festas para eles voltarem a contar.`
}

/** Frase-modelo em português para uma categoria ("estoura"/"fica abaixo"). */
export function fraseDesvio(nome, mediaPct) {
  const pct = Math.abs(num(mediaPct)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  if (num(mediaPct) > 0) return `${nome} estoura em média +${pct}%`
  if (num(mediaPct) < 0) return `${nome} fica em média −${pct}% abaixo do previsto`
  return `${nome} sai em média como o previsto`
}
