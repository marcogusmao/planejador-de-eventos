// Lote SEM PREÇO fica fora da previsão (P8). Direção do Marco em 05/09/2026;
// diff aprovado em 06/10/2026 — ficha "S1 — P8" do BACKLOG.md. A REGRA mora
// em calc.js (isPrecoAusente, usada por loteQtdCenario, bilheteria e pela busca
// do mínimo); este módulo só responde "quais lotes ficaram de fora?" e monta o
// texto das telas, do relatório, do WhatsApp e do aviso de import. Nenhuma
// conta de dinheiro aqui. O lote e a quantidade continuam SALVOS: basta pôr o
// preço — ou 0, para cortesia — e ele volta para a conta.
import { num } from './util.js'
import { isPrecoAusente, CENARIOS } from './calc.js'
import { fmtInt } from './format.js'

export const ROTULO_LOTE_SEM_PRECO = 'sem preço — fora da previsão'
export const ROTULO_AJUSTE_SEM_PRECO = 'sem preço — ajuste não conta'
export const PRECO_AUSENTE_TEXTO = 'sem preço'

const ehLote = (l) => l != null && typeof l === 'object' && !Array.isArray(l)

/** Lote sem preço que TIRARIA gente da conta: tamanho > 0 ou ajuste manual > 0
 *  em algum cenário. Os lotes em branco de todo evento novo não avisam. */
export function loteFicaDeFora(evento, lote) {
  if (!ehLote(lote) || !isPrecoAusente(lote)) return false
  if (num(lote.quantidade) > 0) return true
  const ov = evento?.cenariosConfig?.overrides
  return CENARIOS.some((k) => num(ov?.[k]?.[lote.id]) > 0)
}

export function lotesSemPreco(evento) {
  return (Array.isArray(evento?.lotes) ? evento.lotes : [])
    .filter((l) => loteFicaDeFora(evento, l))
    .map((l) => ({
      id: l.id,
      nome: (typeof l.nome === 'string' && l.nome.trim()) || 'sem nome',
      quantidade: num(l.quantidade),
    }))
}

const descrever = (l) =>
  `“${l.nome}” (${l.quantidade > 0 ? `${fmtInt(l.quantidade)} ingressos` : 'só ajuste manual'})`
const MAX_NOMES = 3
function listar(lotes) {
  const nomes = lotes.slice(0, MAX_NOMES).map(descrever)
  const resto = lotes.length - nomes.length
  if (resto > 0) return `${nomes.join(', ')} e mais ${resto}`
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0]
}

/** O aviso completo. null quando não há o que avisar. `naReceita`: na própria
 *  aba Receita a instrução não manda ir para onde a pessoa já está. */
export function textoAvisoLotesSemPreco(evento, { naReceita = false } = {}) {
  const lotes = lotesSemPreco(evento)
  if (lotes.length === 0) return null
  const onde = naReceita ? 'no preço' : 'no preço, na aba Receita'
  return lotes.length === 1
    ? `O lote ${listar(lotes)} está sem preço: fica fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 ${onde}.`
    : `${lotes.length} lotes estão sem preço — ${listar(lotes)}: ficam fora do público, das cortesias e do bar até ter preço. Para contar como cortesia, ponha 0 ${onde}.`
}

/** A versão curta, que cabe no cartão do cenário. */
export function textoCurtoLotesSemPreco(evento) {
  const lotes = lotesSemPreco(evento)
  if (lotes.length === 0) return null
  const pessoas = lotes.reduce((s, l) => s + l.quantidade, 0)
  const qtd = pessoas > 0 ? ` (${fmtInt(pessoas)} ingressos)` : ''
  return `${lotes.length === 1 ? '1 lote' : `${lotes.length} lotes`} sem preço fora do público e do bar${qtd}`
}

/** Para o aviso depois do import JSON: só as festas com lote de fora. */
export function censoLotesSemPreco(eventos) {
  return (Array.isArray(eventos) ? eventos : [])
    .filter(ehLote)
    .map((e) => ({ evento: (typeof e.nome === 'string' && e.nome.trim()) || '(sem nome)', lotes: lotesSemPreco(e) }))
    .filter((x) => x.lotes.length > 0)
}

export function textoCensoLotesSemPreco(censo) {
  if (!Array.isArray(censo) || censo.length === 0) return ''
  const total = censo.reduce((s, x) => s + x.lotes.length, 0)
  const cabeca = total === 1 ? 'Neste arquivo há 1 lote sem preço' : `Neste arquivo há ${total} lotes sem preço`
  const lista = censo.map((x) => `${x.evento} — ${listar(x.lotes)}`).join('; ')
  return `${cabeca}: ${lista}. Lote sem preço fica fora do público, das cortesias e do bar até ter preço; para contar como cortesia, ponha 0 no preço, na aba Receita.`
}
