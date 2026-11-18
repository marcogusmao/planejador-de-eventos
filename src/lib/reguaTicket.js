// A RÉGUA DO TICKET DE UM BENCHMARK — qual conta produziu aquele número.
//
// Decisão 6 do Marco (DECISOES-MARCO-H4.md, 25/07/2026): guardar a bilheteria
// BRUTA nos benchmarks novos, "com migração que preenche vazio e não inventa
// valor", e a observação do benchmark passando a dizer qual régua produziu
// aquele ticket.
//
// O PROBLEMA QUE ISTO RESOLVE, medido: o `ticketMedio` de um benchmark já foi
// calculado de pelo menos três maneiras diferentes na história deste app, e
// os três resultados convivem no store do Marco sem nada os distinguindo:
//
//   • até 24/07/2026, promover um fechamento gravava receita ÷ público — a
//     receita INTEIRA, com bar e patrocínio divididos por cabeça. Numa festa
//     com bom patrocínio isso fica ACIMA do preço que a pessoa pagou;
//   • desde 24/07/2026 grava bilheteria BRUTA ÷ público, que é o preço pago;
//   • importar uma planilha (ImportModal) grava receita ÷ ingressos PAGOS —
//     divide por outro denominador, porque cortesia não pagou nada;
//   • e o Marco pode digitar o ticket à mão no editor de benchmarks.
//
// Comparar dois desses lado a lado é comparar coisas medidas de jeitos
// distintos. Este módulo não conserta ticket nenhum — ele NOMEIA a régua, para
// que a tela possa dizer o que está comparando.
//
// A REGRA DE OURO DAQUI: nunca afirmar mais do que os números salvos provam.
// Quando o benchmark traz a régua gravada (`reguaTicket`), ela manda. Quando
// não traz, a régua é RECONFERIDA na aritmética do que está salvo — e só é
// nomeada se fechar. Não fechou, é "não registrada", e a tela diz isso com
// todas as letras em vez de chutar.

// ------------------------------------------------------------------ códigos
export const REGUA_BILHETERIA = 'bilheteria-bruta'
export const REGUA_RECEITA = 'receita'
export const REGUA_PAGANTES = 'receita-pagantes'
export const REGUA_NAO_CONFERE = 'nao-confere'
export const REGUA_NAO_REGISTRADA = 'nao-registrada'

/** Os códigos que podem ser GRAVADOS num benchmark (os outros são conclusões). */
export const REGUAS_GRAVAVEIS = [REGUA_BILHETERIA, REGUA_RECEITA, REGUA_PAGANTES]

// ----------------------------------------------------------------- microtexto
// Etiqueta curta: cabe ao lado do nome do benchmark, e já é a CONTA, não um
// rótulo ("régua A"/"régua B" não ensina nada a quem lê a tela).
export const ETIQUETA_REGUA = {
  [REGUA_BILHETERIA]: 'ticket = bilheteria ÷ público',
  [REGUA_RECEITA]: 'ticket = receita ÷ público',
  [REGUA_PAGANTES]: 'ticket = receita ÷ ingressos pagos',
  [REGUA_NAO_CONFERE]: 'ticket não bate com a bilheteria informada',
  [REGUA_NAO_REGISTRADA]: 'régua do ticket não registrada',
}

// Explicação longa (título do mouse), em português de gente: o que a conta
// significa e o que ela faz com a comparação.
export const EXPLICACAO_REGUA = {
  [REGUA_BILHETERIA]:
    'O ticket deste benchmark é o preço médio do ingresso: bilheteria bruta ÷ público. É a régua que vale desde 24/07/2026.',
  [REGUA_RECEITA]:
    'O ticket deste benchmark é a receita inteira ÷ público — inclui bar e patrocínio divididos por cabeça, então fica acima do preço que a pessoa pagou no ingresso. É a régua antiga, usada até 24/07/2026.',
  [REGUA_PAGANTES]:
    'O ticket deste benchmark é a receita ÷ ingressos pagos, do jeito que a planilha importada trazia — cortesias ficam de fora da divisão, então o número não é comparável com um ticket dividido pelo público inteiro.',
  [REGUA_NAO_CONFERE]:
    'Este benchmark tem uma bilheteria bruta informada, mas o ticket salvo não é essa bilheteria dividida pelo público. Um dos dois números está desatualizado — vale conferir antes de usar esta festa como referência.',
  [REGUA_NAO_REGISTRADA]:
    'Não está registrado como o ticket deste benchmark foi calculado, e os números salvos não fecham com nenhuma das contas conhecidas. Use com cuidado ao comparar com outra festa.',
}

// O aviso da tela quando há mais de uma régua na mesma lista. É o achado
// inteiro numa frase: o perigo não é o número errado, é a comparação errada.
export const AVISO_REGUAS_MISTURADAS =
  'Atenção: os tickets desta lista não foram medidos todos da mesma maneira. Cada festa diz, ao lado do nome, qual conta produziu o ticket dela — comparar duas contas diferentes compara coisas diferentes.'

// A frase que entra na OBSERVAÇÃO de um benchmark nascido da régua nova
// (decisão 6 — "a observação do benchmark passa a dizer qual régua produziu
// aquele ticket"). Mora aqui, e não escrita à mão em quem promove, para que a
// tela e a observação nunca digam coisas diferentes.
export const FRASE_OBS_REGUA_BILHETERIA =
  'Ticket médio = bilheteria bruta ÷ público (régua de 24/07/2026 em diante).'

// ------------------------------------------------------------------- a conta
// "Fechar" quer dizer: são O MESMO NÚMERO quando escritos com duas casas
// decimais. Meio centavo de folga, e nem um a mais — o suficiente para o ruído
// de ponto flutuante (75000/500 contra o literal 150), longe do suficiente para
// aceitar um número que a tela mostraria diferente.
//
// A consequência escolhida: um ticket ARREDONDADO à mão fica de fora. Os
// embutidos gravam 297 onde receita ÷ público dá 296,85, e este módulo então
// diz "não registrada" em vez de "receita ÷ público". Chamar 296,85 de 297
// seria a aproximação que esta casa não faz com dinheiro — e a régua daqueles
// benchmarks é mesmo desconhecida: ninguém anotou.
export const TOLERANCIA_DUAS_CASAS = 0.005

const numeroDeVerdade = (v) => typeof v === 'number' && Number.isFinite(v)

/** O valor é um número utilizável como divisor de público? (0 NÃO é.) */
const publicoUtil = (v) => numeroDeVerdade(v) && v > 0

const bate = (a, b) =>
  numeroDeVerdade(a) && numeroDeVerdade(b) && Math.abs(a - b) < TOLERANCIA_DUAS_CASAS

/**
 * A bilheteria bruta GRAVADA neste benchmark, ou null quando o campo não
 * existe. Campo aditivo e opcional (decisão 6). Ausente e ZERO são coisas
 * diferentes: zero é uma festa que não vendeu ingresso, ausente é "ninguém
 * anotou" — por isso o teste é `!= null`, nunca um teste de valor falso.
 */
export const bilheteriaBrutaDe = (bm) =>
  numeroDeVerdade(bm?.bilheteriaBruta) ? bm.bilheteriaBruta : null

/** Este benchmark tem a bilheteria bruta guardada? */
export const temBilheteriaBruta = (bm) => bilheteriaBrutaDe(bm) !== null

/**
 * A régua que produziu o `ticketMedio` deste benchmark.
 *
 * Devolve `null` quando o benchmark não tem ticket nenhum — não há régua a
 * nomear, e a tela não deve inventar assunto. Fora isso devolve um dos códigos
 * acima, nesta ordem de autoridade:
 *
 *   1. `reguaTicket` GRAVADO no benchmark (quem nasceu sabendo);
 *   2. bilheteria bruta salva que FECHA com o ticket → régua nova;
 *   3. bilheteria bruta salva que NÃO fecha → "não bate" (alarme honesto);
 *   4. receita salva que FECHA com o ticket → régua antiga;
 *   5. nada fecha → "não registrada".
 *
 * O passo 3 vem ANTES do 4 de propósito: se o dono informou a bilheteria, ela
 * é a régua pretendida, e um ticket que não fecha com ela é um problema a
 * mostrar — não uma deixa para reclassificar a festa como régua antiga.
 */
export function reguaDoTicket(bm) {
  const ticket = bm?.ticketMedio
  if (!numeroDeVerdade(ticket)) return null

  if (REGUAS_GRAVAVEIS.includes(bm?.reguaTicket)) return bm.reguaTicket

  const publico = bm?.publico
  const bruta = bilheteriaBrutaDe(bm)

  if (publicoUtil(publico)) {
    if (bruta !== null) return bate(ticket, bruta / publico) ? REGUA_BILHETERIA : REGUA_NAO_CONFERE
    if (numeroDeVerdade(bm?.receita) && bate(ticket, bm.receita / publico)) return REGUA_RECEITA
  }
  return REGUA_NAO_REGISTRADA
}

/** Etiqueta curta da régua deste benchmark, ou null (sem ticket = sem etiqueta). */
export const etiquetaRegua = (bm) => {
  const codigo = reguaDoTicket(bm)
  return codigo ? ETIQUETA_REGUA[codigo] : null
}

/** Explicação longa da régua deste benchmark, ou null. */
export const explicacaoRegua = (bm) => {
  const codigo = reguaDoTicket(bm)
  return codigo ? EXPLICACAO_REGUA[codigo] : null
}

/**
 * As réguas DISTINTAS presentes numa lista de benchmarks, considerando só os
 * que têm ticket (os sem ticket não entram em comparação de ticket). Ordem de
 * primeira aparição, sem repetição.
 */
export function reguasNaLista(lista) {
  const vistas = []
  for (const bm of Array.isArray(lista) ? lista : []) {
    const codigo = reguaDoTicket(bm)
    if (codigo && !vistas.includes(codigo)) vistas.push(codigo)
  }
  return vistas
}

/**
 * Há mais de uma régua entre os tickets desta lista? É a condição do aviso da
 * tela. "Não registrada" CONTA como régua distinta de propósito: um ticket de
 * procedência desconhecida ao lado de um ticket de procedência conhecida é
 * justamente a comparação que engana.
 */
export const reguasMisturadas = (lista) => reguasNaLista(lista).length > 1
