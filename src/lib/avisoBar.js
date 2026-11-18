// Aviso de BAR NÃO INFORMADO num cenário (Marco, 27/07/2026 — decisão por
// questionário: "avisar alto, nunca inventar").
//
// O QUE ACONTECEU, e é a razão inteira deste arquivo existir. Em 27/07/2026 o
// Marco abriu a aba Cenários da próxima edição da Marfim Alto no Casa Norte e
// viu três cartões que não podiam ser verdade ao mesmo tempo: o otimista, com o
// MESMO público do realista e ticket 8% MAIOR, mostrava R$ 133 mil de receita a
// MENOS. A causa era simples e completamente silenciosa — o evento cobra bar POR
// PESSOA e o ticket de bar estava preenchido só no realista (R$ 110), vazio no
// pessimista e no otimista. Vazio vira R$ 0 de bar, como se o bar deixasse de
// existir porque se vendeu menos ingresso.
//
// O tamanho do estrago, medido nos dados dele com os controles daquela tela:
//
//     cenário       como estava           com o bar contado      diferença
//     pessimista    PREJUÍZO   3.980      LUCRO    148.260       152.240
//     realista      lucro    212.570      lucro    212.570             —
//     otimista      lucro     88.430      lucro    254.310       165.880
//
// Ou seja: o cenário PESSIMISTA — o que decide se a festa acontece — dizia "não
// fecha" para uma festa que fecha com R$ 148.260. Este é o defeito que o
// rulebook chama de pior que crash: número errado mostrado como certo.
//
// POR QUE NÃO HERDAR O VALOR DO REALISTA (a opção que o Marco recusou, e ele
// tem razão): nos outros eventos dele o ticket de bar varia DE PROPÓSITO por
// cenário — a Marfim 09/05 tem 100 / 110 / 120. Herdar seria o app inventar um
// número de negócio que ele não digitou, e inventar calado é a mesma família de
// defeito, só que mais difícil de pegar. Aqui nada é inventado: a tela diz o que
// falta e oferece um clique para copiar.
//
// Este módulo é PURO e não faz conta de dinheiro: ele só responde "este cenário
// tem ticket de bar?" e "qual valor a tela pode oferecer para copiar". Nenhuma
// fórmula muda por causa dele — a conta do bar segue exatamente a mesma
// (`barPorPessoa` em calc.js).

import { num } from './util.js'
import { isBarPorPessoa, isOpenBar } from './calc.js'

export const CENARIOS = ['pessimista', 'realista', 'otimista']

export const ROTULO_CENARIO = {
  pessimista: 'pessimista',
  realista: 'realista',
  otimista: 'otimista',
}

/**
 * Este cenário vai contar R$ 0 de bar sem que ninguém tenha dito isso?
 *
 * Só vale quando o bar é cobrado POR PESSOA: no modo fixo o valor é um só para
 * os três cenários, e "vazio" ali significa mesmo "não tem bar". Open bar
 * também não avisa — lá o R$ 0 é a resposta certa e declarada (sugestão 27).
 */
export function barNaoInformado(evento, cenario) {
  if (!evento || isOpenBar(evento) || !isBarPorPessoa(evento)) return false
  return naoInformado(evento.barTicket?.[cenario])
}

/**
 * "NÃO INFORMADO" É CAMPO VAZIO — zero digitado não é (Marco, 07/08/2026, por
 * questionário; revisa a régua de 27/07/2026 sem revogar o aviso).
 *
 * A regra original testava `> 0`, então zero e vazio acendiam o mesmo aviso. Isso
 * acertava no mundo em que ela nasceu: o único jeito de pôr bar num cenário era
 * DIGITAR na aba Receita, e lá campo em zero é quase sempre campo esquecido.
 *
 * O slider do bar na grade de cenários (05/08/2026) mudou o mundo: arrastar até a
 * ponta esquerda passou a ser um gesto de UM segundo, e um Marco que DECIDIU que o
 * pessimista não tem bar recebia, na tela, um aviso âmbar dizendo que ele esqueceu.
 * Aviso que acusa escolha deliberada ensina a ignorar aviso — e este aviso
 * específico é o que impediu o pessimista de dizer "prejuízo de R$ 3.980" numa
 * festa que fecha com R$ 148.260. A credibilidade dele é cara demais para gastar
 * em falso positivo.
 *
 * A distinção é a MESMA que o resumo do rascunho já fazia ("não informado" ×
 * "R$ 0,00"), agora aplicada aqui. Risco declarado e aceito por ele: zerar sem
 * querer deixa de acender o aviso — mas o R$ 0,00 aparece escrito no cartão do
 * mesmo jeito, e a conta continua contando zero, como sempre contou.
 */
const naoInformado = (v) => v === '' || v == null

/** Os cenários (em ordem) que vão contar bar zero sem ninguém ter dito. */
export const cenariosSemBar = (evento) => CENARIOS.filter((c) => barNaoInformado(evento, c))

/**
 * O valor que a tela pode oferecer para copiar nos três — o primeiro ticket de
 * bar realmente preenchido, na ordem realista → otimista → pessimista.
 *
 * O realista vem primeiro de propósito: é o cenário que o Marco preenche
 * primeiro na prática (foi o único preenchido no evento que revelou o defeito).
 * Devolve null quando não há NENHUM preenchido — aí não há o que copiar, e a
 * tela só avisa.
 */
export function ticketBarParaCopiar(evento) {
  if (!evento || isOpenBar(evento) || !isBarPorPessoa(evento)) return null
  for (const c of ['realista', 'otimista', 'pessimista']) {
    const v = num(evento.barTicket?.[c])
    if (v > 0) return v
  }
  return null
}

/**
 * O texto do aviso, montado aqui para a tela não escrever regra em JSX e para
 * poder ser afirmado por teste. Devolve null quando não há o que avisar.
 */
export function textoAvisoBar(evento, cenario) {
  if (!barNaoInformado(evento, cenario)) return null
  const copiar = ticketBarParaCopiar(evento)
  return copiar != null
    ? `bar não informado neste cenário — contado como R$ 0 (o ${ROTULO_CENARIO[cenario]} está vazio; o outro cenário usa R$ ${copiar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por pessoa)`
    : 'bar não informado neste cenário — contado como R$ 0'
}
