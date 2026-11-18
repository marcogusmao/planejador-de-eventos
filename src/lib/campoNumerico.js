// Entrada numérica brasileira dos campos da UI (sugestão 1 / achado S2 do
// BACKLOG). A interpretação de valores reusa o parseMoney do importador de
// planilhas — os dois caminhos de entrada (digitar/colar e importar) leem os
// formatos exatamente igual.

import { parseMoney } from './xlsxImport.js'
import { num } from './util.js'

// Texto que ainda pode virar número numa digitação legítima ("-", ",", "("):
// não commita nem avisa — o usuário está no meio do caminho.
const SO_PONTUACAO = /^[\s\-+.,()]*$/

/**
 * Interpreta o texto de um campo numérico.
 * Devolve:
 * - { valido: true, valor }            → número interpretado (ou '' para vazio)
 * - { valido: false, incompleto: true }  → digitação a meio caminho; não salvar
 * - { valido: false, incompleto: false } → entrada inválida; não salvar e AVISAR
 *   (letra no meio, ex. "8 mil", ou nenhum dígito) — nada vira NaN/0 em silêncio.
 */
export function parseCampoNumerico(texto) {
  // "%" no fim é tolerado (campo de percentual), mas precisa sair ANTES do
  // parseMoney: "9,5%" com o % dentro viraria 95 — a vírgula seria descartada.
  const bruto = String(texto ?? '').replace(/%\s*$/, '')
  const semPrefixo = bruto.replace(/R\$\s*/gi, '').trim()
  if (!semPrefixo) return { valido: true, valor: '' }
  if (SO_PONTUACAO.test(semPrefixo)) return { valido: false, incompleto: true }
  if (/\p{L}/u.test(semPrefixo) || !/\d/.test(semPrefixo)) {
    return { valido: false, incompleto: false }
  }
  const valor = parseMoney(bruto)
  return Number.isFinite(valor)
    ? { valido: true, valor }
    : { valido: false, incompleto: false }
}

// Faixa dos campos de PERCENTUAL (decisão do Marco, 20/07/2026 — item 2 da
// fila): cupom, taxa, cashback, contingência e a fração do cupom no modo %
// vivem em 0..100. Fora disso a conta produz absurdo em silêncio — cupom 150%
// deixava a receita NEGATIVA, cupom/taxa negativos INFLAVAM a festa
// (evidência em percentuaisForaDaFaixa.evidencia.test.js). A trava é na
// PORTA: o campo recusa com aviso e a migração descarta; calc.js intocado.
// A fração no modo nº fica FORA da faixa: lá o valor é contagem de
// ingressos, não percentual.
export const FAIXA_PCT = { min: 0, max: 100, aviso: 'Percentual entre 0 e 100' }

// Faixa PRÓPRIA das MARGENS do veredito (decisão do Marco, 23/07/2026 — lote de
// travas, item 2). Margem alvo e margem mínima do semáforo vivem em 0..100: são
// percentuais ABSOLUTOS de resultado (não ajuste relativo). Uma margem mínima
// NEGATIVA aceitava prejuízo com semáforo não-vermelho — o alvo/mínima tortos
// pintavam VERDE FALSO (mesma família do §9.9). Aviso próprio (fala "margem",
// não "percentual") porque o campo é a margem, não uma taxa. A trava é na
// porta (Veredito.jsx) e na migração (formaMargemSemaforo); calc.js intocado.
export const FAIXA_MARGEM = { min: 0, max: 100, aviso: 'Margem entre 0% e 100%' }

// Teto ÚNICO de dinheiro/quantidade (decisão do Marco, 25/07/2026 — "travar
// negativo nos 13 campos soltos e por teto de R$ 100 milhões", resposta à
// pergunta (c) do BACKLOG "Existe um valor máximo para um campo de dinheiro
// deste app? Qual?"). Acima disso o campo RECUSA e avisa — a razão é travar o
// erro de digitação (um zero a mais colado sem querer ou um backup mexido),
// não limitar o tamanho de uma festa real: nenhuma festa da casa chega perto
// disso. Vale para as faixas abaixo, que agora TÊM teto; os campos com
// negativo LEGÍTIMO (bar líquido, bar realizado, benchmark, caixa inicial —
// ver `migracao.js`/`naoNegativoOuVazio` e a nota de cada porta em
// `portasDeDinheiro.faixa.test.jsx`) continuam SEM faixa nenhuma, de
// propósito: dar-lhes teto sem dar-lhes mínimo não foi pedido, e a decisão de
// 25/07 fala só nos 13 campos soltos.
export const TETO_DINHEIRO = 100_000_000

// Faixas de DINHEIRO e QUANTIDADE (decisão do Marco, 22/07/2026 — trava do
// negativo, ampliada em 25/07/2026 com o teto acima): custo, preço de lote,
// quantidade de ingressos e patrocínio vivem em 0..100.000.000. A trava é NA
// PORTA, igual à dos percentuais: o campo RECUSA o negativo (ou o valor acima
// do teto) com aviso e NÃO grava (nunca clampa). O parser contábil segue
// intocado — `(500)` continua devolvendo −500; é a faixa que recusa onde o
// negativo não faz sentido. Derivados (lucro, bar líquido, benchmark) NÃO
// usam faixa — prejuízo é fato.
// Avisos que ENSINAM (o campo diz o que fazer, não só que recusou); `avisoMax`
// é o aviso PRÓPRIO do teto (25/07/2026) — diferente do `aviso` do negativo,
// porque são dois erros diferentes e o aviso ensina qual dos dois aconteceu
// (ver `avisoDaFaixa`, abaixo).
export const FAIXA_CUSTO = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Custo não pode ser negativo — crédito/desconto entra reduzindo o valor do item',
  avisoMax: 'Custo acima do máximo aceito (R$ 100.000.000) — confira se não sobrou um zero',
}
export const FAIXA_QUANTIDADE = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Quantidade não pode ser negativa',
  avisoMax: 'Quantidade acima do máximo aceito (100.000.000) — confira se não sobrou um zero',
}
export const FAIXA_PRECO = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Preço não pode ser negativo — uma cortesia é R$ 0',
  avisoMax: 'Preço acima do máximo aceito (R$ 100.000.000) — confira se não sobrou um zero',
}
export const FAIXA_PATROCINIO = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Patrocínio não pode ser negativo',
  avisoMax: 'Patrocínio acima do máximo aceito (R$ 100.000.000) — confira se não sobrou um zero',
}

// Faixa da PARCELA de custo (decisão do Marco, 25/07/2026 — trava dos 13
// campos soltos, campo "valor da parcela" do ParcelasModal). É dinheiro de
// saída como o custo, mas "parcela" não é "custo" nem "preço" — aviso
// próprio para não confundir a leitura.
export const FAIXA_PARCELA = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Valor da parcela não pode ser negativo',
  avisoMax: 'Valor da parcela acima do máximo aceito (R$ 100.000.000) — confira se não sobrou um zero',
}

// Faixa dos DIAS de antecedência de venda (idem, 25/07/2026 — campo
// "Vendas abrem (dias antes)" de Ajustes.jsx). Não pode ser negativo; o teto
// aqui é só o backstop genérico contra dígito a mais — nenhuma venda abre
// 100 milhões de dias antes da festa.
export const FAIXA_DIAS = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Dias de antecedência não pode ser negativo',
  avisoMax: 'Valor acima do máximo aceito — confira se não sobrou um zero',
}

// Faixa do CONSUMO por pessoa do bar (idem, 25/07/2026 — campo
// "Consumo/pessoa" por cenário do bar por-pessoa, RevenueTab.jsx). É dinheiro
// de entrada, mesmo motivo do preço/custo.
export const FAIXA_CONSUMO = {
  min: 0,
  max: TETO_DINHEIRO,
  aviso: 'Consumo por pessoa não pode ser negativo',
  avisoMax: 'Consumo por pessoa acima do máximo aceito (R$ 100.000.000) — confira se não sobrou um zero',
}

// Faixa dos AJUSTES DE CENÁRIO (decisão do Marco, 22/07/2026): a grade
// custoPct/ticketPct de cada cenário vive em −50..100. É faixa PRÓPRIA
// (separada da 0..100 dos percentuais de conta) porque o negativo aqui é DE
// PROPÓSITO — o otimista nasce com custoPct −5. O que a trava barra é o absurdo
// (custoPct −200 do achado de 20/07): fora de −50..100 o campo recusa e a
// migração descarta. calc.js intocado.
// Amplitude vale para custoPct/ticketPct (AJUSTES relativos); vendaPct ganhou
// faixa PRÓPRIA (FAIXA_VENDA, abaixo) na decisão 3b de 22/07 — ver lá.
export const FAIXA_CENARIO = {
  min: -50,
  max: 100,
  aviso: 'Ajuste de cenário entre −50% e 100%',
}

// Faixa PRÓPRIA do vendaPct de cenário (decisão do Marco, 22/07/2026 — 3b, via
// orquestrador). O "Ingressos vendidos (%)" é percentual ABSOLUTO do lote
// vendido — calc.js faz Math.round(q * vendaPct / 100), então 0..100 é o único
// range que faz sentido (0 = não vendeu nada, 100 = esgotou o lote). É a
// diferença dos IRMÃOS custoPct/ticketPct, que são AJUSTES relativos ("custa 5%
// menos", "ticket 3% acima") e por isso seguem em −50..100 (FAIXA_CENARIO), com
// o negativo de propósito. Sem a faixa própria o vendaPct herdava −50..100 e um
// −50 ABSOLUTO passava. A trava é na porta, igual às demais: o campo recusa fora
// de 0..100 e a migração REMOVE a chave (delete → cai no fallback do calc; ver
// migracao.js/formaCenariosConfig). calc.js intocado.
export const FAIXA_VENDA = {
  min: 0,
  max: 100,
  aviso: 'Ingressos vendidos: entre 0% e 100% do lote',
}

/**
 * O número interpretado está fora da faixa dada? '' e não-número não contam
 * ('' é "não informado"; letra quem barra é o parser). Sem faixa: nunca.
 */
export function foraDaFaixa(valor, faixa) {
  if (!faixa || valor === '' || valor == null) return false
  const n = num(valor)
  return Number.isFinite(n) && (n < faixa.min || n > faixa.max)
}

/**
 * Mensagem de aviso para um valor fora da faixa (decisão do Marco, 25/07/2026
 * — teto de R$ 100 milhões): "negativo demais" (abaixo do mínimo) e "grande
 * demais" (acima do teto) são erros DIFERENTES, e o aviso ensina qual dos
 * dois aconteceu em vez de repetir a mesma frase para os dois. `avisoMax`
 * ausente cai no `aviso` de sempre (é o caso das faixas antigas — percentual,
 * margem, cenário — que nunca tiveram um segundo texto e continuam com um só,
 * como sempre tiveram). Fora da faixa por nenhum lado (`foraDaFaixa` falso):
 * `null`.
 */
export function avisoDaFaixa(valor, faixa) {
  if (!foraDaFaixa(valor, faixa)) return null
  const n = num(valor)
  if (n > faixa.max) return faixa.avisoMax || faixa.aviso || `Entre ${faixa.min} e ${faixa.max}`
  return faixa.aviso || `Entre ${faixa.min} e ${faixa.max}`
}

/**
 * Formata o valor salvo para exibição/edição no campo, em formato brasileiro
 * ("1.234,56"). Round-trip garantido: parseCampoNumerico(formatarParaEdicao(v))
 * devolve o mesmo v para valores com até 2 casas decimais (o que a UI usa).
 */
export function formatarParaEdicao(v) {
  if (v === '' || v == null) return ''
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num(v))
}

/**
 * O rascunho de digitação do campo deve ser LARGADO porque o valor mudou por
 * fora? (desfazer/refazer da sessão, importação, ponte com o Financeiro)
 *
 * Enquanto se digita, o `value` que volta ao campo é exatamente o que o
 * rascunho representa — aí o rascunho FICA, e a vírgula pendente de "1.234,"
 * ou o zero à esquerda sobrevivem à tecla seguinte. Quando o valor novo NÃO é
 * o que o rascunho diz, quem mandou foi outra pessoa (o desfazer, por exemplo):
 * o rascunho sai da frente e o campo passa a mostrar o dado.
 *
 * A regra existe porque o contrário é o pior bug da casa: desfazer trocava o
 * número salvo e o campo em foco continuava exibindo o texto velho — um número
 * errado mostrado como certo.
 */
export function deveLargarRascunho(rascunho, valorNovo) {
  if (rascunho == null) return false
  const r = parseCampoNumerico(rascunho)
  return !(r.valido && r.valor === valorNovo)
}
