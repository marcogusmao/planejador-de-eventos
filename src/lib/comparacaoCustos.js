import { num } from './util.js'
import { CAT_KEYS } from './benchmarks.js'
import { ajusteCustoValor } from './dre.js'
import { arredondadoComoAMoeda } from './exibicaoQueFecha.js'

/**
 * Coluna da PREVISÃO na tabela "Comparação com eventos passados" — os inteiros
 * que a tela realmente imprime, montados de modo que a coluna SEMPRE feche no
 * "Custo total" exibido.
 *
 * O PROBLEMA (achado da verificação adversarial, 19/07/2026). A matriz virada
 * transformou o "Custo total" em LINHA DE TOTAL — régua acima e negrito. Essa é
 * a assinatura visual que CONVIDA a soma: quem lê na reunião soma a coluna com
 * o dedo. Só que a tabela exibe R$ SEM CENTAVOS (`fmtInt`), e a decomposição tem
 * ~10 linhas. Cada linha erra até R$ 0,50 no arredondamento; somadas, dão vários
 * reais. Medido num evento real do Marco: a soma do que está na tela dava 74.021
 * e o total exibido dizia 74.016 — cinco reais de diferença.
 *
 * Nenhum número estava ERRADO: cada linha era o arredondamento correto do seu
 * valor. Errada estava a TELA, que prometia uma soma e não a entregava. Pela
 * régua da casa isso é grave por si: "desconfiar de um número certo custa quase
 * o mesmo que ver um errado" (PADRAO-DA-CASA, 19/07/2026).
 *
 * A DECISÃO DO MARCO (19/07/2026): a coluna tem que fechar sempre, e o resíduo
 * do arredondamento é absorvido pela linha "Outras categorias".
 *
 * COMO ESTA IMPLEMENTAÇÃO CUMPRE A DECISÃO — e por que não absorve TUDO numa
 * linha só. O Marco cravou junto um teto: nenhuma linha exibida pode se afastar
 * do seu valor verdadeiro por mais de R$ 1, "o resíduo é de poucos reais e não
 * pode virar distorção material". Jogar os 5 reais medidos inteiros em "Outras
 * categorias" fecharia a coluna, mas afastaria ESSA linha em R$ 5 do valor real
 * — quebrando o teto e trocando um problema de tela por um número torto.
 *
 * Então o resíduo é distribuído pelo método do MAIOR RESTO (Hamilton, o mesmo
 * das apurações proporcionais): cada linha exibe o PISO do seu valor, e as
 * unidades que faltam para fechar o total vão uma a uma para as linhas de maior
 * parte fracionária. A vontade do Marco sobre "Outras categorias" é honrada na
 * PRIORIDADE: ela é a primeira da fila a receber unidade.
 *
 * ------------------------------------------------------------------------
 * O TETO DE R$ 1 POR LINHA NÃO É SEMPRE ALCANÇÁVEL — e este módulo passa a
 * dizer a verdade sobre isso (achado 2 da verificação adversarial, 19/07/2026).
 * Até esta correção o comentário aqui prometia "toda linha exibe piso ou
 * piso+1, nunca se afasta mais de R$ 1 da verdade". Era FALSO, e medido: em
 * 0,01–0,02% dos eventos alguma linha saía em piso−1 ou piso+3, desvio máximo
 * observado R$ 2,10. Promessa falsa no código é pior que limite declarado.
 *
 * A PROVA de que o teto de R$ 1 é impossível, no caso mais curto que existe
 * (REPRO B dos testes): evento com uma única categoria, A&B = R$ 8,43,
 * contingência 42,15%, ajuste −12,43%. O DRE imprime custo total 10 (de
 * 10,4937), contingência 4 (de 3,5532) e ajuste −1 (de −1,4895) — três números
 * TRAVADOS, porque são exatamente os que o DRE mostra duas seções acima, no
 * mesmo relatório. Sobra para as categorias 10 − 4 − (−1) = 7. Existe UMA linha
 * só, então ela TEM que imprimir 7 para a coluna fechar — e 7 está a R$ 1,43 de
 * 8,43. Nenhum arranjo de piso/piso+1 fecha: qualquer linha em piso ou acima
 * soma 8 ou mais. Ou a coluna fecha, ou o teto de R$ 1 vale; as duas juntas são
 * impossíveis enquanto contingência e ajuste ficarem travados no arredondamento
 * do DRE — e eles ficam, pelo motivo em "O QUE NÃO ENTRA NA DISTRIBUIÇÃO".
 * Entre as duas, fechar a coluna é a que o Marco cravou e a que a tela promete.
 *
 * A GARANTIA REAL, então, é esta — e é exatamente o que os testes cobram:
 *   • a soma das linhas exibidas é EXATAMENTE o total exibido, dentro da faixa
 *     de valores que um double representa com precisão de centavo (na prática:
 *     custos até ~R$ 1e13; acima disso o próprio `Math.round` do JavaScript
 *     deixa de distinguir centavos e nem o fechamento se sustenta — dizer
 *     "sempre, sem asterisco" seria a mesma promessa falsa que esta seção veio
 *     corrigir). Para os custos de uma festa, a faixa é folgada em ordens de
 *     grandeza, e esta é a propriedade que não pode regredir;
 *   • nenhuma linha aparece do nada: resíduo de arredondamento não vira mais
 *     uma linha de "Outras categorias — R$ −1" (achado 1, resolvido na raiz por
 *     `emCentavos` abaixo);
 *   • no caso normal — o resíduo cabe na fila de linhas elegíveis, que é a
 *     esmagadora maioria dos eventos — toda linha exibe piso ou piso+1: no
 *     MÁXIMO R$ 1,00 de distância da verdade;
 *   • no caso raro em que ele NÃO cabe, UMA única linha vai a piso−1 ou piso+2,
 *     escolhida para minimizar o desvio, que fica ABAIXO DE R$ 1,54.
 *
 * DE ONDE SAI O R$ 1,54 (a conta, para quem for auditar). Como
 * `ajusteCustoValor` é definido POR DIFERENÇA, vale exatamente
 * custoTotal = custoItens + contingência + ajuste. Chamando de "e" o erro de
 * cada arredondamento travado e de F a soma das partes fracionárias das linhas,
 * o que sobra para a fila é
 *     restante = e(total) − e(contingência) − e(ajuste) + F − δ,
 * cada "e" vive em [−0,5 ; 0,5] (desde 07/10/2026 o meio real negativo também
 * vai para LONGE do zero, como no DRE) e δ é o resíduo da quantização a
 * centavos (meio centavo em cada uma das 8 linhas de item: |δ| ≤ 0,04; com o
 * motor publicando centavos exatos, δ = 0). Daí:
 *   • para FALTAR unidade (restante = −1) é preciso F < 0,5 + δ. Ou seja: a
 *     linha de MENOR fração está a menos de 0,54 do piso dela, e piso−1 fica a
 *     menos de R$ 1,54 do valor real;
 *   • para SOBRAR unidade além da fila (restante = m+1, com m = número de linhas
 *     elegíveis) é preciso F > m − 0,5 − δ. Ou seja: a linha de MAIOR fração
 *     está a mais de 1 − (0,5+δ)/m do piso, e piso+2 fica a menos de
 *     1 + (0,5+δ)/m ≤ R$ 1,54.
 * Por isso a distribuição desce pela MENOR fração e sobe pela MAIOR: é a escolha
 * que faz o teto valer, em vez de cair na primeira linha que aparecer (era o que
 * o código antigo fazia ao despejar tudo no absorvedor, e é de onde vinham os
 * R$ 2,10).
 *
 * EM QUE CONDIÇÃO o teto vale — a parte que a versão anterior omitia. Ele vale
 * para DINHEIRO DE VERDADE, de no máximo duas casas decimais. Não é uma
 * hipótese otimista: é o que `emCentavos` GARANTE na entrada deste módulo, e é
 * por isso que a quantização veio antes do teto no conserto. Sem ela, valores
 * sub-centavo vindos de planilha derrubavam o teto até R$ 7 numa linha.
 * MEDIDO (fuzzing de 200 mil eventos com valores de duas casas, negativos,
 * contingência 0–100% e ajuste −100%..+100%, 19/07/2026): zero falhas de
 * fechamento, zero linhas fantasma, PIOR desvio observado R$ 1,48 — dentro do
 * teto declarado, e com a distribuição concentrada abaixo de R$ 1,00 (99,3%
 * dos eventos). O teste de propriedade re-roda essa prova a cada `npm test`.
 * ------------------------------------------------------------------------
 *
 * FALLBACK quando "Outras categorias" não existe (o caso comum: o Marco não
 * criou categoria fora das 7 do histórico). Absorver ali criaria uma linha
 * fantasma "Outras categorias — R$ 1" num evento que não tem outras categorias:
 * inventar rubrica para fechar conta é exatamente o tipo de mentira que este app
 * não conta. Nesse caso o absorvedor é a MAIOR categoria em valor absoluto —
 * escolhida porque é onde R$ 1 tem o menor peso relativo, e porque é uma linha
 * que existe de verdade.
 *
 * O QUE NÃO ENTRA NA DISTRIBUIÇÃO — e por quê. A "Contingência" e o "Ajuste de
 * custos do cenário" ficam travados no arredondamento do DRE — o do formatador
 * de moeda, meio real para LONGE do zero (`arredondadoComoAMoeda`), que o DRE
 * usa algumas seções acima, no MESMO relatório. Até 07/10/2026 esta trava era
 * `Math.round`, que leva −50,5 a −50 enquanto o DRE escreve "− R$ 51": as duas
 * tabelas discordavam em todo ajuste negativo de meio real exato. Se
 * entrassem no rateio, poderiam cair no piso e aparecer com R$ 1 de diferença da
 * linha homônima do DRE — duas tabelas da mesma peça discordando sobre o mesmo
 * número. É essa trava que cria o caso raro descrito acima; é um preço
 * consciente, e menor: divergir do DRE seria visível em TODA reunião, enquanto
 * o desvio acima de R$ 1,00 numa linha aparece em 0,7% dos eventos — 1 a cada
 * ~140 — e nunca passa do teto declarado (fuzzing de 200 mil eventos com
 * dinheiro de duas casas, 19/07/2026).
 *
 * É também por essa trava que contingência e ajuste NÃO passam por
 * `emCentavos`: eles precisam sair do mesmo `Math.round` do valor CRU que o DRE
 * usa. Ver o comentário no corpo de `colunaCustoPrevisao`.
 *
 * Nada aqui é conta nova: todos os valores saem prontos de `computeCenarios`
 * (calc.js é PORTÃO e não foi tocado) e de `ajusteCustoValor`. Este módulo só
 * decide COMO arredondar para exibir.
 */

/**
 * DINHEIRO TEM DUAS CASAS — a quantização a centavos, e por que ela é a
 * causa-raiz (terceira rodada de verificação adversarial, 19/07/2026).
 *
 * A rodada anterior tinha consertado o sintoma. Havia uma trava (`semRuido`)
 * que dizia "valor a menos de 1e−6 de um inteiro É esse inteiro", nascida do
 * `outrasValor` que sai de uma SUBTRAÇÃO e aparecia como −3,3e−16 num evento
 * SEM outras categorias: `Math.floor` fazia disso −1 e a tela ganhava a linha
 * "Outras categorias — R$ −1", rubrica negativa que não existe em lugar nenhum
 * da previsão. Pior: a fração desse −1 valia ~1,0 e inflava o `restante`,
 * empurrando a distribuição para fora da faixa declarada.
 *
 * O 1e−6 fechava a porta do ponto flutuante e deixava aberta a do SUB-CENTAVO.
 * Um valor de −0,0001 passa pela trava (é maior que 1e−6), vira piso −1 e
 * imprime a MESMA linha fantasma — de uma rubrica que vale um décimo de
 * milésimo de real. E na faixa entre 1e−6 e 0,005 o valor também escapa do
 * corte de elegibilidade (`>= 0,005`) lá embaixo, então some da fila de
 * distribuição mas continua contando piso: era daí que saíam os desvios de até
 * R$ 7 numa linha.
 *
 * A CAUSA-RAIZ não é o algoritmo de distribuição. Um revisor rodou 400 mil
 * eventos com valores de no máximo DUAS casas decimais — dinheiro de verdade —
 * e achou ZERO violações, com pior desvio de R$ 1,40. TODA falha exigia valor
 * sub-centavo. Eles entram porque `parseMoney` (xlsxImport.js) aceita célula de
 * planilha com 4 casas sem arredondar.
 *
 * O CONSERTO, então, é na ENTRADA deste módulo: o que a matriz consome é
 * arredondado a centavos ANTES de qualquer piso ou distribuição. A faixa cega
 * entre 1e−6 e 0,005 deixa de existir (um valor ou é 0, ou vale ao menos R$
 * 0,01), a linha fantasma morre na raiz e o corte de elegibilidade passa a
 * significar exatamente "não é zero".
 *
 * O que este passo NÃO faz, de propósito: não toca o dado salvo do Marco nem o
 * parser de importação. A quantização é só da CÓPIA que a matriz exibe — o
 * valor guardado continua como veio, e nenhuma outra tela muda.
 *
 * (`+ 0` normaliza o −0 que `Math.round` devolve para entrada negativa
 * minúscula: −0 passaria adiante e poderia imprimir "-0" na tela.)
 */
const emCentavos = (v) => Math.round(num(v) * 100) / 100 + 0

/**
 * Distribui `alvo` (inteiro) entre `valores`, pelo método do maior resto.
 * Devolve inteiros que somam EXATAMENTE `alvo`, para todo valor que um double
 * representa com precisão de centavo (ver a ressalva de faixa no topo).
 *
 * Cada linha fica em piso ou piso+1 sempre que o resíduo couber na fila de
 * linhas elegíveis. Quando não couber (ver a prova no comentário do topo), UMA
 * linha vai a piso−1 ou piso+2, escolhida de modo que o desvio fique abaixo de
 * R$ 1,54 — teto que só vale porque a entrada é dinheiro de duas casas.
 *
 * `iAbsorvedor` tem prioridade na fila de subida (decisão do Marco sobre
 * "Outras categorias") e é a rede de segurança final, caso não exista nenhuma
 * linha elegível.
 *
 * Linhas de valor desprezível não recebem unidade: uma categoria vazia não pode
 * aparecer com R$ 1 só para a conta fechar. Com os valores em centavos, o corte
 * de R$ 0,005 quer dizer exatamente "não é zero" — não existe mais valor entre
 * 0 e 1 centavo para cair na faixa cega.
 */
function distribuirPorMaiorResto(valores, alvo, iAbsorvedor) {
  // Segunda passada de quantização: `colunaCustoPrevisao` já entrega centavos,
  // então aqui isto é idempotente. Fica porque a garantia desta função ("piso
  // ou piso+1, e o desvio abaixo do teto") só vale para dinheiro de duas casas
  // — se alguém chamar direto com sub-centavo, a garantia não pode virar
  // mentira em silêncio.
  const vals = valores.map(emCentavos)
  const pisos = vals.map((v) => Math.floor(v))
  const fracoes = vals.map((v, i) => v - pisos[i])
  const exibidos = [...pisos]
  let restante = alvo - pisos.reduce((s, x) => s + x, 0)

  const elegiveis = vals.map((_, i) => i).filter((i) => Math.abs(vals[i]) >= 0.005)

  // SUBIDA normal — o maior resto de sempre, com "Outras categorias" na frente
  // da fila. Aqui toda linha tocada vai de piso para piso+1: no máximo R$ 1.
  const filaSubida = [...elegiveis].sort(
    (a, b) =>
      (a === iAbsorvedor ? 0 : 1) - (b === iAbsorvedor ? 0 : 1) ||
      fracoes[b] - fracoes[a] ||
      a - b
  )
  for (const i of filaSubida) {
    if (restante <= 0) break
    exibidos[i] += 1
    restante -= 1
  }

  // SOBRA — o resíduo não coube na fila (restante > número de elegíveis). Vai
  // para as MAIORES frações, que é onde piso+2 fica mais perto da verdade, uma
  // volta completa de cada vez para nunca concentrar tudo numa linha só.
  if (restante > 0) {
    const porFracaoDesc = [...elegiveis].sort(
      (a, b) => fracoes[b] - fracoes[a] || Math.abs(vals[b]) - Math.abs(vals[a]) || a - b
    )
    while (restante > 0 && porFracaoDesc.length > 0) {
      for (const i of porFracaoDesc) {
        if (restante <= 0) break
        exibidos[i] += 1
        restante -= 1
      }
    }
  }

  // FALTA — nenhuma combinação de piso/piso+1 alcança o alvo (restante < 0):
  // alguma linha PRECISA exibir piso−1. Escolhe a de MENOR fração, que é onde
  // piso−1 fica mais perto da verdade, desempatando pela linha de maior valor,
  // onde R$ 1 pesa menos. Linha que ficaria negativa na tela fica de fora: o
  // conserto não pode criar o mesmo tipo de rubrica fantasma que o achado 1.
  if (restante < 0) {
    const porFracaoAsc = vals
      .map((_, i) => i)
      .filter((i) => pisos[i] >= 1)
      .sort((a, b) => fracoes[a] - fracoes[b] || Math.abs(vals[b]) - Math.abs(vals[a]) || a - b)
    while (restante < 0 && porFracaoAsc.length > 0) {
      for (const i of porFracaoAsc) {
        if (restante >= 0) break
        exibidos[i] -= 1
        restante += 1
      }
    }
  }

  // Rede de segurança: evento sem NENHUMA linha elegível (tudo zerado, ou tudo
  // abaixo de R$ 1 quando falta unidade). O absorvedor fecha a diferença. A
  // coluna fechar é a promessa que a tela faz ao leitor; ela não pode depender
  // de "na prática isto não acontece".
  if (restante !== 0) exibidos[iAbsorvedor] += restante

  return exibidos
}

/**
 * Monta as linhas da coluna da previsão.
 *
 * @param cenario cenário realista devolvido por `computeCenarios`
 * @param custoPorCategoria (id) => custo CONSIDERADO da categoria
 */
export function colunaCustoPrevisao(cenario, custoPorCategoria) {
  // ENTRADA QUANTIZADA A CENTAVOS (ver `emCentavos`). É aqui que a classe
  // inteira de bugs sub-centavo morre: tudo que a matriz distribui é dinheiro
  // de duas casas antes de encostar em piso, fração ou fila.
  const catValores = CAT_KEYS.map((k) => emCentavos(custoPorCategoria(k)))
  // Resíduo das categorias fora do mapa de comparação: o Marco pode criar
  // categoria própria na aba Custos, e ela entra no custoItens sem ter linha em
  // CAT_KEYS. Por DIFERENÇA sobre os valores crus (sem conta nova), e então
  // quantizado: num evento sem outras categorias a subtração devolve −3,3e−16 e
  // `emCentavos` a zera, em vez de a tela ganhar a linha "Outras categorias —
  // R$ −1" (achado 1). O mesmo passo mata o −0,0001 que escapava do 1e−6.
  const outrasValor = emCentavos(
    num(cenario?.custoItens) - CAT_KEYS.reduce((s, k) => s + num(custoPorCategoria(k)), 0)
  )
  // Contingência e ajuste NÃO são quantizados de novo aqui: eles não passam
  // pela distribuição (ver "O QUE NÃO ENTRA NA DISTRIBUIÇÃO") e precisam sair
  // do MESMO arredondamento, sobre o MESMO valor, que o DRE usa duas seções
  // acima, no mesmo relatório. Desde 07/10/2026 esse valor já chega de calc.js
  // em centavos exatos (régua do centavo), e o arredondamento é o do
  // formatador (`arredondadoComoAMoeda`). Divergir do DRE é pior que meio
  // centavo.
  const contingenciaValor = num(cenario?.contingencia)
  const ajusteValor = ajusteCustoValor(cenario)

  // `+ 0` normaliza o −0: `Math.round(-0.002)` devolve −0, e um evento cujo
  // total arredonda para zero imprimiria "Custo total — R$ -0" na linha de
  // conclusão da tabela. Achado pelo teste de propriedade desta sessão
  // (19/07/2026) — a mesma normalização que `emCentavos` já fazia, que faltava
  // nas três linhas travadas no arredondamento do DRE. Não muda nenhum valor:
  // para todo número que não é −0, `x + 0` é `x`.
  const totalExibido = arredondadoComoAMoeda(num(cenario?.custoTotal)) + 0
  const contingenciaExibido = arredondadoComoAMoeda(contingenciaValor) + 0
  const ajusteExibido = arredondadoComoAMoeda(ajusteValor) + 0

  const valores = [...catValores, outrasValor]
  const iOutras = valores.length - 1
  // Absorvedor: "Outras categorias" quando ela existe de verdade; senão a maior
  // categoria (ver comentário do topo).
  let iAbsorvedor = iOutras
  if (Math.abs(outrasValor) < 0.5) {
    let maior = 0
    for (let i = 1; i < catValores.length; i++) {
      if (Math.abs(catValores[i]) > Math.abs(catValores[maior])) maior = i
    }
    iAbsorvedor = maior
  }

  const alvoItens = totalExibido - contingenciaExibido - ajusteExibido
  const exibidos = distribuirPorMaiorResto(valores, alvoItens, iAbsorvedor)

  return {
    categorias: CAT_KEYS.map((k, i) => ({
      id: k,
      valor: catValores[i],
      exibido: exibidos[i],
    })),
    // `mostrar: exibido !== 0` mantém a promessa da coluna: linha escondida
    // contribui 0 para a soma da tela, então esconder nunca desequilibra.
    outras: { valor: outrasValor, exibido: exibidos[iOutras], mostrar: exibidos[iOutras] !== 0 },
    contingencia: { valor: contingenciaValor, exibido: contingenciaExibido },
    ajuste: { valor: ajusteValor, exibido: ajusteExibido, mostrar: ajusteExibido !== 0 },
    total: totalExibido,
  }
}

/**
 * Soma dos inteiros que a coluna imprime. Existe para os testes provarem a
 * promessa da tela com a MESMA conta que o leitor faz com o dedo na reunião:
 * só as linhas visíveis, exatamente como aparecem.
 */
export const somaColunaExibida = (col) =>
  col.categorias.reduce((s, c) => s + c.exibido, 0) +
  (col.outras.mostrar ? col.outras.exibido : 0) +
  col.contingencia.exibido +
  (col.ajuste.mostrar ? col.ajuste.exibido : 0)

/**
 * Maior distância, em reais, entre uma linha VISÍVEL da coluna e o valor
 * verdadeiro dela. Existe para os testes cobrarem o limite DECLARADO no
 * comentário do topo — abaixo de R$ 1,54, e R$ 1,00 no caso normal — em vez de
 * o limite viver só na prosa.
 *
 * "Valor verdadeiro" aqui é o valor JÁ QUANTIZADO a centavos, que é o que este
 * módulo representa. A quantização em si desloca a linha em no máximo meio
 * centavo do número cru — abaixo do que a tela, que imprime reais, consegue
 * mostrar.
 *
 * Linha escondida não entra: ela não é lida por ninguém e vale 0 na soma.
 */
export function maiorDesvioDaColuna(col) {
  const linhas = [
    ...col.categorias,
    ...(col.outras.mostrar ? [col.outras] : []),
    col.contingencia,
    ...(col.ajuste.mostrar ? [col.ajuste] : []),
  ]
  return linhas.reduce((pior, l) => Math.max(pior, Math.abs(l.exibido - l.valor)), 0)
}
