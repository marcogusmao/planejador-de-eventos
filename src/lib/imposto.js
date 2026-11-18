// IMPOSTO SOBRE A RECEITA DO EVENTO — o desenho aprovado pelo Marco em
// 27/07/2026, em duas perguntas por questionário.
//
// O QUE FALTAVA. Até 27/07/2026 a palavra "imposto" não existia neste app: o
// DRE ia de receita bruta a lucro sem passar por tributo, e o único percentual
// parecido era a taxa da bilheteria — que é COMISSÃO da Tiqueteira, não imposto.
// Ou seja: o lucro que ele decidia em reunião era lucro ANTES de imposto, e
// nada na tela dizia isso. Ele descobriu perguntando "onde eu adiciono imposto
// no planejador?".
//
// AS QUATRO DECISÕES DELE, cada uma com o motivo:
//
// 1. UMA alíquota por evento, com TRÊS chaves de liga-desliga (bilheteria,
//    bar, patrocínio). Palavras dele: "alíquotas iguais mas separado, pq nem
//    sempre vai ter imposto sobre cada categoria". Ele RECUSOU três alíquotas
//    separadas — então não existe `impostoPctBar`: existe uma alíquota e três
//    interruptores.
//
// 2. A BASE DA BILHETERIA É A BRUTA — antes da comissão da Tiqueteira e antes do
//    cashback. Medido nos eventos dele em 27/07/2026 e mostrado a ele antes de
//    decidir: como a taxa está no modo repasse (o cliente paga), a LÍQUIDA é
//    MAIOR que a bruta em todos eles — exatamente o cashback de 5%. Em Marfim
//    Raiz Cine, bruta R$ 250.000,00 × líquida R$ 262.500,00: tributar a
//    líquida a 10% custaria R$ 1.250,00 a mais, todo ano, em imposto sobre
//    dinheiro que a produção recebe de volta. Bar e patrocínio entram pelo
//    valor deles (o bar já é lucro líquido; o patrocínio, só o FECHADO).
//
// 3. O IMPOSTO É DEDUÇÃO DE RECEITA, não custo: entra no DRE DEPOIS da receita
//    total e ANTES do lucro.
//
// 4. FORA DA BASE DA CONTINGÊNCIA. A contingência é uma reserva para CUSTO
//    estourar (custos × %); imposto não estoura — ele é uma fração conhecida
//    da receita. Se o imposto virasse custo, o app passaria a reservar
//    contingência SOBRE imposto, inventando dinheiro de reserva que ninguém
//    pediu. Em calc.js a contingência sai de `custos.totalConsiderado`, e o
//    imposto não encosta nesse número — há teste que quebra se encostar.
//
// EVENTO QUE JÁ EXISTE NÃO MUDA NENHUM NÚMERO (princípio 2 — o formato salvo é
// contrato): a alíquota nasce vazia e as três chaves nascem desligadas, e
// nesse estado este módulo devolve `null` — calc.js nem soma zero, não
// acrescenta campo nenhum ao objeto do cenário, e os 8 eventos do backup real
// saem idênticos ao centavo.
//
// POR QUE O DESCRITOR CARREGA A HISTÓRIA, e não só o número. Chave desligada e
// alíquota 0% dão o MESMO R$ 0 e contam histórias DIFERENTES. Sem dizer qual é
// qual, em três meses ninguém sabe se o bar ficou de fora de propósito ou
// porque alguém esqueceu de marcar — foi assim que o bar sumiu dos cenários em
// 27/07/2026, o defeito mais caro do dia. Por isso `impostoDoCenario` devolve
// as BASES junto com o valor, e `impostoTexto` transforma isso na frase que a
// linha do DRE imprime.
import { num, emCentavos, somaEmCentavos } from './util.js'

/** As três bases, na ordem em que aparecem no DRE (mesma ordem da receita). */
export const IMPOSTO_BASES = ['bilheteria', 'bar', 'patrocinio']

/** Como cada base se chama na frase do DRE — a linguagem do Marco, não a do
 *  código. "bilheteria bruta" tem a palavra BRUTA de propósito: é a decisão 2,
 *  e ela precisa estar visível na tela, não só neste comentário. */
export const IMPOSTO_BASE_LABEL = {
  bilheteria: 'bilheteria bruta',
  bar: 'bar',
  patrocinio: 'patrocínio',
}

/** Rótulo da linha do DRE e do card de edição. */
export const IMPOSTO_LABEL = 'Imposto sobre a receita'

/**
 * Forma estrita das três chaves. Mesma filosofia do `openBar` e do `barModo`
 * (migração da casa desde a Sessão Q): SÓ o booleano exato `true` liga uma
 * base. Backup editado à mão, string "sim", 1, "true" — nada disso liga
 * imposto sozinho. Ligar uma base DIMINUI o lucro mostrado; um valor torto
 * nunca pode mexer no resultado de uma festa sem o Marco ter marcado.
 */
export function formaImpostoSobre(v) {
  const o = v && typeof v === 'object' ? v : {}
  return {
    bilheteria: o.bilheteria === true,
    bar: o.bar === true,
    patrocinio: o.patrocinio === true,
  }
}

/** As três chaves de um evento, já na forma estrita. */
export const impostoSobreDoEvento = (evento) => formaImpostoSobre(evento?.impostoSobre)

/** A alíquota está em branco? ('' / null / undefined = nunca preenchida.) */
const aliquotaVazia = (evento) => evento?.impostoPct === '' || evento?.impostoPct == null

/**
 * Alguma base ligada — LENDO os campos crus, sem construir objeto nenhum.
 *
 * A falta de elegância aqui é medida, não gosto: `impostoConfigurado` roda
 * dentro de `computeCenario`, e `computeCenario` roda ~100 vezes por busca de
 * break-even, em três cenários, por evento. Construir o objeto das três
 * chaves só para perguntar "alguma é true?" custou 480 mil alocações nos 8
 * eventos reais do Marco e deixou o cálculo 2,6× mais lento (768 ms → 2.100 ms
 * em 200 passadas, medido em 27/07/2026) — lento a ponto de estourar o
 * cronômetro de um teste de fuzz que nada tem a ver com imposto. A checagem
 * estrita é EXATAMENTE a mesma de `formaImpostoSobre`; se um dia divergirem, é
 * `imposto.test.js` que quebra, porque as duas são exercitadas lado a lado.
 */
const algumaBaseLigada = (evento) => {
  const o = evento?.impostoSobre
  if (!o || typeof o !== 'object') return false
  return o.bilheteria === true || o.bar === true || o.patrocinio === true
}

/**
 * O evento tem imposto CONFIGURADO?
 *
 * Verdadeiro quando o Marco fez um dos dois gestos deliberados: digitou uma
 * alíquota (mesmo 0) OU ligou pelo menos uma chave. Os dois estados que
 * sobram são o evento que nunca viu a tela de imposto — e nele a linha não
 * aparece no DRE, porque não há história para contar.
 *
 * Repare que "alíquota 0 com bilheteria marcada" é configurado, e "alíquota
 * 10 com nada marcado" também: são gestos, e cada um ganha a frase dele.
 */
export const impostoConfigurado = (evento) =>
  !aliquotaVazia(evento) || algumaBaseLigada(evento)

/**
 * O imposto de UM cenário.
 *
 * Recebe os três valores do cenário já calculados por calc.js — a bilheteria
 * BRUTA (decisão 2), o bar do cenário e o patrocínio fechado — e devolve o
 * descritor, ou `null` quando o evento não tem imposto configurado.
 *
 * O `null` não é preguiça: é o que mantém o objeto do cenário EXATAMENTE como
 * era para os eventos que já existem (calc.js só acrescenta a chave quando há
 * descritor), e é o que a tela lê para decidir se a linha do DRE existe.
 *
 * O descritor:
 *   aliquota  número (0 quando o campo está vazio — a conta é a mesma)
 *   vazia     true quando o campo NUNCA foi preenchido (muda a frase, não o nº)
 *   sobre     as três chaves, forma estrita
 *   bases     só as ligadas, na ordem do DRE — é a HISTÓRIA da linha
 *   base      soma dos valores das bases ligadas (o que foi tributado, em R$)
 *   valor     base × alíquota / 100, arredondado ao centavo pela régua da
 *             casa (util.js) — o que sai da receita, em R$
 */
export function impostoDoCenario(evento, valores) {
  if (!impostoConfigurado(evento)) return null
  const sobre = impostoSobreDoEvento(evento)
  const porBase = {
    bilheteria: num(valores?.bruta),
    bar: num(valores?.bar),
    patrocinio: num(valores?.patrocinio),
  }
  const bases = IMPOSTO_BASES.filter((b) => sobre[b])
  // BASE NEGATIVA NÃO GERA IMPOSTO (Marco, 28/07/2026, por questionário, com o
  // número medido no evento real dele na frente).
  //
  // O BAR PODE SER NEGATIVO: `barPorPessoa` devolve prejuízo quando o custo do
  // sistema supera o consumo. Sem esta trava a base ia negativa, o imposto ia
  // negativo, e como o lucro é `receita − imposto − custo`, ele SOMAVA — um
  // crédito tributário que não existe, melhorando justamente o cenário que
  // decide se a festa acontece.
  //
  // MEDIDO, e estava a UMA edição de distância: Marfim Alto Cine, custo de
  // sistema de bar R$ 4.800 já salvo, ticket de bar do pessimista em branco →
  // bar −R$ 4.800 → imposto −R$ 480 → o pessimista MELHORAVA de −81.292,29 para
  // −80.812,29.
  //
  // A trava é POR BASE, não sobre a soma, e a diferença importa: somando
  // primeiro, um bar muito negativo abateria da base da bilheteria e o app
  // cobraria menos imposto do que se deve. Compensar receita com receita é
  // decisão do contador dele, não do app — e um app que decide isso sozinho
  // entrega número otimista sobre tributo, que é o pior lado para errar.
  const base = somaEmCentavos(bases.map((b) => Math.max(0, porBase[b])))
  const aliquota = num(evento?.impostoPct)
  return {
    aliquota,
    vazia: aliquotaVazia(evento),
    sobre,
    bases,
    base,
    valor: emCentavos((base * aliquota) / 100),
  }
}

/** "a, b e c" — lista em português, sem vírgula antes do "e". */
const listar = (itens) =>
  itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`

/**
 * A FRASE que o DRE imprime entre parênteses, e a razão de existir deste
 * módulo: ela diz SOBRE O QUE o imposto incidiu.
 *
 * Os três estados possíveis, e por que cada um tem texto próprio:
 *   - alíquota em branco, com chave(s) ligada(s) → o valor é R$ 0 porque
 *     FALTA a alíquota. Dizer "0%" aqui seria mentir por omissão: 0% é uma
 *     escolha, campo vazio é uma pendência.
 *   - alíquota preenchida, nenhuma chave ligada → o valor é R$ 0 porque o
 *     Marco decidiu que nada é tributado neste evento. É informação, não
 *     esquecimento — e é a diferença que faz a linha existir.
 *   - o caso normal → a lista das bases, com "bruta" escrito na bilheteria.
 */
export function impostoTexto(imp) {
  if (!imp) return ''
  const nomes = imp.bases.map((b) => IMPOSTO_BASE_LABEL[b])
  if (imp.vazia) {
    return nomes.length === 0
      ? 'alíquota não preenchida e nenhuma base marcada'
      : `alíquota não preenchida — ${listar(nomes)} ${nomes.length === 1 ? 'marcada' : 'marcadas'}`
  }
  if (nomes.length === 0) return `${imp.aliquota}% — nenhuma base marcada`
  return `${imp.aliquota}% sobre ${listar(nomes)}`
}

/** Rótulo completo da linha do DRE: "Imposto sobre a receita (10% sobre …)". */
export const impostoLinhaLabel = (imp) => `${IMPOSTO_LABEL} (${impostoTexto(imp)})`

/**
 * O imposto de um cenário JÁ CALCULADO, em R$ — 0 quando não há.
 * Existe para as telas não repetirem `c.imposto ? c.imposto.valor : 0` em sete
 * lugares e uma delas esquecer (é assim que nasce a segunda verdade na tela).
 */
export const impostoValor = (cenario) => num(cenario?.imposto?.valor)

/** O cenário tem linha de imposto para mostrar? */
export const temImposto = (cenario) => cenario?.imposto != null
