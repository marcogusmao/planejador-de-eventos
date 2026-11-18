// Confronto honesto entre o que JÁ FOI REALIZADO e o que se estimou PARA ESSES
// MESMOS ITENS (Sessão de clareza, 20/07/2026).
//
// O PROBLEMA. A faixa de resumo dos Custos mostrava, lado a lado, "Total
// estimado" e "Total realizado". Os dois números existem e cada um está certo,
// mas eles NÃO SÃO COMPARÁVEIS: `totalEstimado` soma TODOS os itens do evento e
// `totalRealizado` soma só os que já têm realizado (quem não tem entra como 0).
// Ler os dois juntos convida à conclusão "gastamos um pouco menos que o
// previsto" — e nos números reais do Marco a verdade era o OPOSTO:
//
//   estimado (todos os itens) ...... 335.120
//   realizado (só quem já tem) ..... 334.387   → parece 733 abaixo do orçado
//   estimado DESSES MESMOS itens ... 331.240
//   ------------------------------------------
//   delta verdadeiro ............... +3.147 ACIMA  (estourou)
//
// A diferença some porque os itens ainda sem realizado carregam 3.880 de
// estimado que entravam na coluna da esquerda e não na da direita. Pela régua
// da casa isso é do tipo mais grave: número certo levando à leitura errada.
//
// A CORREÇÃO É DE TELA, NÃO DE CONTA. Nada aqui inventa fórmula nova nem toca
// calc.js: é só somar, dos MESMOS itens, os dois lados — e dizer quantos ainda
// não têm realizado, para o leitor saber o tamanho do que falta.
import { num, somaCentavos } from './util.js'
import { custouZeroEfetivo } from './calc.js'

/**
 * O LIMIAR ÚNICO da casa para "isto é zero". Dinheiro tem duas casas; somas em
 * ponto flutuante produzem resíduos de 1e-12 que não são desvio nenhum. Meio
 * centavo é o piso: abaixo disso, nada de sinal, nada de cor, nada de selo.
 *
 * Mora aqui, exportado, porque toda decisão de sinal deste app tem de usar ESTE
 * número — foi uma cópia sem limiar (`estouro: delta > 0`) que fez uma linha do
 * Fechamento sair vermelha com selo ESTOURO enquanto a célula de desvio da
 * MESMA linha saía neutra.
 */
export const LIMIAR_ZERO = 0.005

/**
 * O SINAL do delta em custo, como conceito de domínio — 'estouro' (gastou mais
 * que o orçado para aqueles itens), 'economia' ou 'neutro'. A tradução para
 * cor mora na camada visual (`corDelta` em ui.jsx); o julgamento mora aqui,
 * para as duas telas nunca pintarem o mesmo número de cores opostas.
 */
export const sinalDelta = (delta) =>
  delta == null || Math.abs(delta) < LIMIAR_ZERO ? 'neutro' : delta > 0 ? 'estouro' : 'economia'

/**
 * O SINAL de um RESULTADO (receita − custo), que se lê com a régua OPOSTA à do
 * desvio de custo: aqui positivo é bom. Mesmo limiar, para um resultado de
 * fração de centavo não ser anunciado como lucro nem como prejuízo.
 */
export const sinalResultado = (resultado) =>
  resultado == null || Math.abs(resultado) < LIMIAR_ZERO
    ? 'neutro'
    : resultado > 0
      ? 'lucro'
      : 'prejuizo'

/**
 * Um item "tem realizado" pela MESMA régua de `valorConsiderado()` em calc.js:
 * realizado preenchido e maior que zero, OU marcado "custou zero"
 * (custouZeroEfetivo). A duplicação é deliberada e vigiada por teste
 * (confrontoCustos.test.js cobra equivalência com valorConsiderado): a tela não
 * pode dizer "realizado" para um item que a projeção está tratando como não
 * preenchido.
 *
 * A marcação "custou zero" (Marco, 20/07/2026) faz o item CONTAR no confronto —
 * ele soma o realizado CRU (0, portanto acrescenta 0) e sai da coluna de
 * pendentes, então o invariante das duas telas
 * (`realizado + estimadoPendente === totalConsiderado`) continua fechando: o
 * item vale 0 nos dois lados. Com realizado > 0 a marcação é ignorada
 * (custouZeroEfetivo já garante P1), e a primeira cláusula já o inclui.
 */
export const temRealizado = (item) =>
  item != null &&
  ((item.realizado != null && item.realizado !== '' && num(item.realizado) > 0) ||
    custouZeroEfetivo(item))

/**
 * Confronto de UMA lista de itens de custo. É o núcleo: tudo que compara
 * estimado com realizado neste app passa por aqui.
 *
 * Devolve:
 *   algum             — existe ao menos um item com realizado
 *   nItens            — quantos itens ao todo
 *   nComRealizado     — quantos itens já têm realizado
 *   nSemRealizado     — quantos ainda não têm
 *   realizado         — soma do realizado desses itens
 *   estimadoDosMesmos — soma do ESTIMADO desses mesmos itens (o par honesto)
 *   estimadoTodos     — soma do estimado de TODOS os itens (o orçamento)
 *   estimadoPendente  — estimado dos itens que ainda não têm realizado
 *   estimadoComparavel — o número que a coluna "Estimado" pode exibir ao lado
 *                        do realizado sem mentir: `estimadoDosMesmos` quando há
 *                        o que confrontar; o orçamento inteiro quando não há
 *                        (aí a tela não promete comparação nenhuma). É o que
 *                        faz `estimado − realizado = desvio` fechar na tela,
 *                        para quem soma com o dedo na reunião.
 *   delta             — realizado − estimadoDosMesmos (+ = estourou); null sem realizado
 *   deltaPct          — delta sobre estimadoDosMesmos, em %; null quando não dá
 *   estouro           — sinalDelta(delta) === 'estouro' (MESMO limiar do resto)
 */
export function confrontoDeItens(itens) {
  const lista = itens || []
  const comRealizado = lista.filter(temRealizado)
  const semRealizado = lista.filter((it) => !temRealizado(it))
  const algum = comRealizado.length > 0
  // AS QUATRO SOMAS PASSAM PELA RÉGUA POR PARCELA (Marco, 25/07/2026, aplicada
  // aqui em 26/07/2026). `somaCentavos()` arredonda CADA item a centavos antes
  // de somar — a mesma régua que `custosPorCategoria()` (calc.js) já usava.
  //
  // Sem ela, este módulo somava cru e ficava R$ 1 abaixo das abas Custos e
  // Cenários na hora de imprimir: numa festa de quatro itens numa categoria
  // (1.215,82 / 6.571,21 / 6.605,32 / 920,15, soma exata 15.312,50) o total
  // caía em 15.312,499999999998 e o Fechamento escrevia R$ 15.312 enquanto as
  // outras duas abas escreviam R$ 15.313 — duas telas do mesmo app discordando
  // sobre a mesma festa.
  //
  // NÃO trocar por "somar cru e arredondar o total": o Marco recusou essa régua
  // explicitamente, e ela reabre a dependência da ORDEM dos itens que a sessão
  // de 25/07 fechou (medido: três itens de três casas dando 5.141,14 em duas
  // ordens e 5.141,15 nas outras quatro). Soma de centavos INTEIROS é
  // associativa; soma de reais em ponto flutuante não é.
  const realizado = somaCentavos(comRealizado.map((it) => num(it.realizado)))
  const estimadoDosMesmos = somaCentavos(comRealizado.map((it) => num(it.estimado)))
  const estimadoTodos = somaCentavos(lista.map((it) => num(it.estimado)))
  // O DESVIO TAMBÉM. As duas pontas já são exatas em centavos, mas a SUBTRAÇÃO
  // devolve o cisco de volta: 7.800,00 − 7.787,03 dá 12,970000000000255 em
  // ponto flutuante. Medido em 26/07/2026 sobre 500 mil subtrações cujo desvio
  // verdadeiro cai exatamente em X,50 (a fronteira do arredondamento da tela):
  // em 11,9% delas a coluna "Desvio" escrevia R$ 1 a menos do que a subtração
  // que o leitor faz com o dedo entre as colunas "Estimado" e "Realizado" da
  // MESMA linha. É o mesmo defeito das somas, na casa ao lado.
  const delta = algum ? somaCentavos([realizado, -estimadoDosMesmos]) : null
  return {
    algum,
    nItens: lista.length,
    nComRealizado: comRealizado.length,
    nSemRealizado: semRealizado.length,
    realizado,
    estimadoDosMesmos,
    estimadoTodos,
    estimadoPendente: somaCentavos(semRealizado.map((it) => num(it.estimado))),
    estimadoComparavel: algum ? estimadoDosMesmos : estimadoTodos,
    delta,
    deltaPct: algum && estimadoDosMesmos > 0 ? (delta / estimadoDosMesmos) * 100 : null,
    // MESMA régua de `sinalDelta` — nunca `delta > 0` cru. Antes daqui `estouro`
    // era a 4ª cópia da decisão de sinal e a única SEM o limiar: um delta de
    // fração de centavo (dinheiro de duas casas somado em ponto flutuante)
    // acendia a tarja vermelha e o selo ESTOURO na linha do Fechamento enquanto
    // a célula de desvio DA MESMA LINHA saía neutra e as abas Custos e Relatório
    // diziam "em linha com o estimado". A linha se contradizia sozinha.
    estouro: sinalDelta(delta) === 'estouro',
  }
}

/**
 * Confronto sobre as categorias de custo do evento: o total (campos do núcleo
 * na raiz, para quem já lia este formato) MAIS o mesmo confronto categoria a
 * categoria em `porCategoria`.
 *
 * O `porCategoria` nasceu do achado da verificação adversarial (20/07/2026): a
 * aba Fechamento fazia a comparação antiga (realizado de quem tem × estimado de
 * TODOS) e dizia o OPOSTO da faixa dos Custos para o mesmo evento no mesmo dia
 * — "−R$ 733 abaixo" em verde contra "+R$ 3.147 acima" em vermelho. Duas telas
 * discordando sobre o mesmo número é do tipo mais grave da casa. A cura não foi
 * copiar a conta para lá: foi ampliar ESTE módulo e fazer o Fechamento (total e
 * por categoria), o relatório e a acurácia beberem todos da mesma fonte.
 */
export function confrontoCustos(categorias) {
  const cats = categorias || []
  return {
    ...confrontoDeItens(cats.flatMap((c) => c.itens || [])),
    porCategoria: cats.map((c) => ({
      id: c.id,
      nome: c.nome,
      ...confrontoDeItens(c.itens || []),
    })),
  }
}

/**
 * O delta escrito por extenso — a MESMA frase nas duas telas. Vive aqui, e não
 * em cada componente, porque foi exatamente a duplicação de rótulo e de regra
 * de cor que deixou Custos e Fechamento falarem línguas diferentes.
 *
 * `fmt` é o formatador da tela (absoluto ou R$/pessoa nos Custos). Abaixo de
 * meio centavo não vira sinal nenhum: "em linha".
 */
export const textoDelta = (delta, fmt) => {
  if (delta == null) return '—'
  if (Math.abs(delta) < LIMIAR_ZERO) return 'em linha com o estimado'
  const v = fmt(Math.abs(delta))
  if (v === '—') return delta > 0 ? 'acima do estimado' : 'abaixo do estimado'
  return delta > 0 ? `+${v} acima` : `−${v} abaixo`
}
