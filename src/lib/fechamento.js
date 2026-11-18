// Fechamento do evento (Sessão E — sugestão 5 do MELHORIAS.md).
// LEITURAS puras sobre dados que o app já tem: estimado × realizado × desvio.
// Nenhuma fórmula de negócio nova — desvio é subtração e %, a mesma
// aritmética já exibida nas outras telas. Nada aqui entra em computeCenarios.

import { num, uid, somaCentavos, emCentavos, somaEmCentavos } from './util.js'
import {
  valorConsiderado,
  isOpenBar,
  isBarPorPessoa,
  isTaxaCliente,
  patrocinioPorEstagio,
  computeCenarios,
} from './calc.js'
import { confrontoCustos, sinalResultado } from './confrontoCustos.js'
import { liquidaDeBruta } from './receitaLiquida.js'
import { CAT_KEYS } from './benchmarks.js'
import { impostoDoCenario, impostoTexto } from './imposto.js'
import { REGUA_BILHETERIA, FRASE_OBS_REGUA_BILHETERIA } from './reguaTicket.js'

// O NOME DA LINHA DA BILHETERIA, em UM lugar só.
//
// Ele é escrito aqui e PROCURADO em `acuracia.js`, que acha a linha pelo nome
// (`rec.linhas.find((l) => l.nome === …)`). Enquanto o texto morava duplicado
// nos dois arquivos, renomear a linha num deles quebrava o outro EM SILÊNCIO:
// o `find` devolveria `undefined`, a acurácia deixaria de contar a bilheteria,
// e nenhum teste do lado de cá acusaria — o número simplesmente sumiria da
// estatística. Não é hipótese: é o acoplamento por string registrado no
// BACKLOG desde 20/07/2026.
//
// O conserto ficou fora da árvore por três semanas porque este arquivo é
// portão do golden e não se abre o portão por uma extração de rótulo. Entrou
// em 30/08/2026, com aprovação do Marco dada sobre o diff em português: nenhum
// número muda e o texto exibido é o mesmo caractere por caractere.
export const NOME_BILHETERIA_BRUTA = 'Bilheteria (bruta)'

/**
 * "Foi isto mesmo" — o campo tem um valor INFORMADO, mesmo que esse valor seja
 * 0 ou negativo. DECISÃO DO MARCO, 25/07/2026 (aprovada e datada, com a conta
 * na mesa — princípio 1 do CLAUDE.md): a régua antiga exigia `num(v) > 0`, e
 * isso tratava "0" e qualquer negativo digitado como "não preenchi", voltando
 * ao PREVISTO. No caso que abriu o achado — bar previsto R$ 8.000, realizado
 * -R$ 2.000 — a régua antiga lia "não informado" e o card de Resultado
 * realizado somava os 8.000 previstos: +R$ 10.250 na tela, quando a verdade
 * (bar -2.000 de fato, contado) é +R$ 250. R$ 10.000 de erro, mostrado como
 * certo.
 *
 * A distinção que importa não é "o número é positivo?" — é "o campo tem
 * alguma coisa escrita?". `''` e `null`/`undefined` são as DUAS formas de
 * "campo vazio" que este app produz (o parser de `campoNumerico.js` devolve
 * `''` para texto vazio, nunca 0); qualquer outro valor, incluindo 0 e
 * negativo, é o Marco tendo digitado algo — e o app tem de acreditar nele.
 *
 * A MESMA IDEIA (não uma nova) já resolve o lado do CUSTO: `custouZeroEfetivo`
 * e `temRealizado` em calc.js/confrontoCustos.js também partem de checar o
 * campo cru (`item.realizado == null || item.realizado === ''`) antes de
 * decidir "não preenchido" — só que lá o Marco escolheu exigir, ALÉM disso,
 * uma marcação explícita (`custouZero`) para o zero valer, porque custo é
 * SEMPRE ≥ 0 e "0 custo" é raro o bastante para pedir confirmação em dobro.
 * Bilheteria e bar realizados não têm essa ambiguidade adicional: o campo é
 * limpo (a UI grava `''`) ou tem o número que o Marco digitou — inclusive
 * negativo, que aqui é possível e é FATO (bar deu prejuízo), não erro de
 * digitação. Por isso a mesma distinção "campo cru vazio × campo cru
 * preenchido" basta aqui, sem precisar da marcação extra.
 */
const temValor = (v) => v !== '' && v != null

/**
 * Fechamento de custos por categoria: estimado × realizado × desvio.
 *
 * FONTE ÚNICA (conserto S1, 20/07/2026). Esta função NÃO faz mais a sua própria
 * comparação: ela é um adaptador de nomes sobre `confrontoCustos.js`, o mesmo
 * módulo que a faixa da aba Custos usa. Antes daqui havia uma segunda conta —
 * `desvio = totalRealizado − totalEstimado`, ou seja, o realizado de QUEM JÁ TEM
 * contra o estimado de TODOS os itens — e ela contradizia a aba Custos no mesmo
 * evento, no mesmo dia: nos números reais do Marco (Marfim 09/05) o Fechamento
 * dizia "−R$ 733 (−0,2%)" em VERDE enquanto os Custos diziam "+R$ 3.147 acima"
 * em VERMELHO. Sinal oposto, cor oposta, mesma grandeza. O mesmo defeito se
 * repetia linha a linha: categoria com 1 de 3 itens realizados tinha o desvio
 * medido contra o estimado dos 3.
 *
 * Agora, em TODA linha e no total:
 * - `estimadoComparavel` é o par honesto do realizado (o estimado DESSES itens),
 *   e é ele que a coluna "Estimado" exibe — então `estimado − realizado` fecha
 *   com o desvio impresso, para quem soma com o dedo na reunião;
 * - `estimado` segue existindo como o ORÇAMENTO (todos os itens), que a tela
 *   mostra à parte e nomeia como tal;
 * - `desvio` = realizado − estimadoDosMesmos (positivo = estouro); null sem
 *   nenhum realizado — sem dado, nada de número inventado.
 */
export function fechamentoCustos(categorias) {
  const total = confrontoCustos(categorias)
  const adaptar = (c) => ({
    estimado: c.estimadoTodos,
    estimadoDosMesmos: c.estimadoDosMesmos,
    estimadoComparavel: c.estimadoComparavel,
    estimadoPendente: c.estimadoPendente,
    realizado: c.realizado,
    temRealizado: c.algum,
    nItens: c.nItens,
    nComRealizado: c.nComRealizado,
    nSemRealizado: c.nSemRealizado,
    desvio: c.delta,
    desvioPct: c.deltaPct,
    estouro: c.estouro,
  })
  return {
    porCategoria: total.porCategoria.map((c) => ({ id: c.id, nome: c.nome, ...adaptar(c) })),
    ...adaptar(total),
    totalEstimado: total.estimadoTodos,
    totalEstimadoComparavel: total.estimadoComparavel,
    totalRealizado: total.realizado,
    algumRealizado: total.algum,
    desvioTotal: total.delta,
    desvioTotalPct: total.deltaPct,
  }
}

/**
 * Fechamento de receita: compara o realizado informado (campos opcionais
 * `receitaRealizada.bilheteria` e `.bar`) com o previsto do próprio evento:
 * - bilheteria prevista = receita BRUTA de bilheteria do cenário informado
 *   (padrão: realista) — número que o app já calcula e exibe;
 * - bar previsto = `outrasReceitas.bar` como digitado (modo fixo — a conta
 *   de sempre); no modo POR PESSOA (sugestão 42) = o bar calculado do
 *   cenário realista, o mesmo número que o app exibe na DRE. O bar
 *   REALIZADO segue pedido exatamente igual nos dois modos.
 * Linha sem realizado informado → desvio null (não aparece).
 * Open bar (sugestão 27): a linha de Bar sai da conta — o fechamento não
 * cobra bar realizado de evento sem receita de bar (a tela explica; um valor
 * de bar realizado eventualmente salvo fica guardado, só fora da conta).
 */
export function fechamentoReceita(evento, cenarioRealista) {
  const rr = evento.receitaRealizada || {}
  const linha = (nome, estimado, realizadoBruto) => {
    const tem = temValor(realizadoBruto)
    const realizado = tem ? emCentavos(num(realizadoBruto)) : null
    const est = emCentavos(num(estimado))
    return {
      nome,
      estimado: est,
      realizado,
      temRealizado: tem,
      desvio: tem ? somaEmCentavos([realizado, -est]) : null,
      desvioPct: tem && num(estimado) > 0 ? ((realizado - num(estimado)) / num(estimado)) * 100 : null,
    }
  }
  const linhas = [
    linha(NOME_BILHETERIA_BRUTA, cenarioRealista?.bruta, rr.bilheteria),
    ...(isOpenBar(evento)
      ? []
      : [
          linha(
            'Bar (lucro líquido)',
            isBarPorPessoa(evento) ? cenarioRealista?.bar : evento.outrasReceitas?.bar,
            rr.bar
          ),
        ]),
  ]
  // Pix não tem projeção: vazio fica fora; zero informado tem linha própria.
  if (temValor(rr.pix)) linhas.push(linha('Pix recebido (líquido)', 0, rr.pix))
  const algumRealizado = linhas.some((l) => l.temRealizado)
  return {
    linhas,
    algumRealizado,
    totalRealizado: algumRealizado
      ? somaEmCentavos(linhas.map((l) => l.realizado ?? 0))
      : null,
  }
}

/**
 * A recusa da promoção, em português, dita ao usuário (decisão 5 do Marco,
 * 20/07/2026). É texto, não exceção: quem chama mostra isto na tela.
 */
export const MOTIVO_SEM_BILHETERIA_REALIZADA =
  'Esta festa ainda não tem a bilheteria realizada lançada. Abra a aba Fechamento e preencha "Bilheteria (bruta)" em Receita realizada — só com esse número o benchmark grava o que a festa de fato faturou.'

/**
 * "Promover a benchmark" (sugestão 5c): monta um benchmark CUSTOM a partir de
 * um evento FECHADO.
 *
 * ---------------------------------------------------------------------------
 * A CONTA MUDOU EM 20/07/2026 — decisão do Marco, datada, com o diff de
 * números na mesa antes (princípio 1 do CLAUDE.md). A evidência que abriu o
 * caso e a especificação estão em `promoverBenchmark.evidencia.test.js`.
 * ---------------------------------------------------------------------------
 *
 * O DEFEITO. Esta função montava as duas metades do benchmark com réguas
 * DIFERENTES: o custo por `valorConsiderado()` (a régua de todo o app) e a
 * receita como bilheteria BRUTA e nada mais — sem taxa, sem cashback, sem bar,
 * sem patrocínio. Metade comparável, metade não, e o resultado da subtração
 * ficava GRAVADO como régua das próximas festas. Medido:
 *
 *   O Galeao 12/07 ..... gravava −R$  2.500, a festa deu +R$ 24.100 (sinal oposto)
 *   Marfim 09/05 ....... gravava +R$  3.000, a festa deu −R$  6.200 (sinal oposto)
 *   Brisa 14/03 ....... gravava +R$ 56.000 vindos da CAPACIDADE dos lotes,
 *                        ingressos que nunca venderam
 *
 * O dano não é a tela — é a decisão seguinte: uma previsão nova comparada
 * contra O Galeao parecia +R$ 16.647 MELHOR com a régua velha e −R$ 9.952 PIOR
 * com a certa.
 *
 * A CONTA DE HOJE é a MESMA do card "Resultado realizado" do Fechamento, e ela
 * não é recriada aqui: chamamos `resultadoRealizado()`, a função que já existe.
 *
 *   receita    = bilheteria LÍQUIDA realizada + bar realizado + patrocínio FECHADO
 *   custoTotal = custos considerados (o que já era, sem mudança)
 *   lucro      = receita − custoTotal
 *
 * A CONTINGÊNCIA NÃO ENTRA (decisão 3), pela mesma razão do card: reserva não é
 * despesa, ninguém emite nota de contingência. Por isso o benchmark promovido
 * sai com `semReserva: true` — a ETIQUETA que as telas de comparação exibem
 * para explicar por que ele parece mais barato que os 4 embutidos, que carregam
 * a reserva DENTRO das categorias (em "Extras & Conting.").
 *
 * O TICKET MÉDIO divide pelo PÚBLICO do próprio benchmark (decisão 4), para
 * `receita ÷ público = ticket` fechar dentro do objeto. Antes dividia pela
 * CAPACIDADE dos lotes, um número que não corresponde nem ao previsto nem ao
 * realizado.
 *
 * SEM BILHETERIA REALIZADA INFORMADA, RECUSA (decisão 5): devolve `null`, como
 * o próprio card faz. Nada de receita vinda da capacidade dos lotes. Quem chama
 * mostra `MOTIVO_SEM_BILHETERIA_REALIZADA`.
 *
 * BENCHMARKS JÁ PROMOVIDOS NÃO MUDAM (restrição dura do Marco): esta função só
 * é chamada na CRIAÇÃO. Ela devolve um objeto novo, com id próprio e
 * `custom: true`, que o chamador ACRESCENTA a store.benchmarksCustom — nenhum
 * caminho de leitura do app recalcula um benchmark salvo a partir do evento.
 * A varredura executável dessa garantia está no bloco "RESTRIÇÃO DURA" de
 * `promoverBenchmark.evidencia.test.js`. NUNCA toca nos embutidos.
 */
export function montarBenchmarkDeEvento(evento) {
  // Decisão 5 — o portão. Sem bilheteria realizada não há o que promover.
  if (!temValor(evento?.receitaRealizada?.bilheteria)) return null
  const cenario = computeCenarios(evento).realista
  const card = resultadoRealizado(evento, cenario)
  if (!card) return null

  // O DETALHE por categoria segue sendo `valorConsiderado()` — é a mesma régua
  // que `card.custos` soma, só que aberta por categoria para as barras da
  // comparação. Categorias fora das 7 padrão somam em "extras", como no
  // importador.
  const custos = Object.fromEntries(CAT_KEYS.map((k) => [k, 0]))
  for (const c of evento.categorias || []) {
    const key = CAT_KEYS.includes(c.id) ? c.id : 'extras'
    for (const i of c.itens || []) custos[key] += valorConsiderado(i)
  }
  // DECISÃO DO MARCO, 26/07/2026 (aprovada, com a conta na mesa —
  // princípio 1 do CLAUDE.md): esta linha zerava categoria ZERO e categoria
  // NEGATIVA do mesmo jeito, e isso escondia dinheiro real. Medido — A&B
  // estimado R$ 10.000, Marketing estimado −R$ 3.000 (um estorno):
  // `bm.custoTotal` = 7.000 (correto), mas `bm.custos.marketing` virava
  // `null` e SOMAVA de volta ao "sumiço" — `somaCustos(bm.custos)` = 10.000,
  // 3.000 a mais que o total impresso do MESMO benchmark. A distinção que
  // importa é a mesma de `temValor()` acima: categoria SEM item (soma
  // exatamente 0) continua oculta — isso é intencional, não tem o que
  // mostrar; categoria com soma NEGATIVA é dinheiro que voltou, e passa a
  // aparecer com o valor real, para que `somaCustos()` volte a bater com
  // `custoTotal` em qualquer sinal.
  //
  // "ZERO" É ZERO ATÉ O CENTAVO (Marco, 26/07/2026, segunda decisão do mesmo
  // dia — o achado saiu da verificação adversarial da primeira). A soma acima
  // é de ponto flutuante, e ponto flutuante não fecha em zero exato: com
  // R$ 10.000,10 + R$ 20.000,20 − R$ 30.000,30 — matematicamente zero — a
  // soma sai 3,637978807091713e-12. Contra `=== 0` isso é "diferente de
  // zero", e a categoria VAZIA aparecia no detalhe do benchmark mostrando
  // R$ 0,00 — quebrando calada a metade "categoria sem item continua oculta"
  // da regra que o Marco tinha acabado de aprovar.
  //
  // O `Math.round(× 100)` pergunta a pergunta certa: "sobra algum centavo?".
  // Ele decide APENAS se a categoria some; o valor guardado não é
  // arredondado, então nenhuma categoria com dinheiro de verdade tem o seu
  // número mexido. Sob o `<= 0` de antes, resíduo positivo já vazava e
  // resíduo negativo era ocultado por acidente — esta linha fecha os dois
  // lados de propósito, em vez de acertar um por sorte.
  for (const k of CAT_KEYS) if (Math.round(num(custos[k]) * 100) === 0) custos[k] = null

  const publico = num(evento.publicoEstimado) || null
  const receita = card.receita
  const dataBR = evento.data ? ` (${evento.data.split('-').reverse().join('/')})` : ''
  return {
    id: uid(),
    nome: evento.nome || 'Evento promovido',
    custom: true,
    // A etiqueta da decisão 3 — lida pelas telas de comparação.
    semReserva: true,
    publico,
    custos,
    custoTotal: card.custos,
    receita,
    // TICKET MÉDIO = bilheteria BRUTA ÷ público (Marco, 24/07/2026, com o diff
    // de números na mesa — princípio 1).
    //
    // Era `receita / publico`, e isso somava bar e patrocínio por cabeça: numa
    // festa medida deu R$ 173,02 quando a pessoa pagou R$ 160 no ingresso. Um
    // número que não tinha nome — nem o preço pago, nem o líquido por pessoa,
    // nem o ticket que a tela mostra.
    //
    // A régua nova é a DE FÁBRICA, não uma invenção: em `benchmarks.js` a
    // Marfim 09/05 grava ticketMedio 164, e 164 × 1.500 = R$ 246.000, que é a
    // BILHETERIA da festa — não a receita de 336.150 (os R$ 90.150 de
    // diferença são bar e patrocínio). Receita ÷ público daria 241,87, e não é
    // o que está lá. O Cordel bate nas duas contas porque aquela festa não tem
    // bar nem patrocínio na tabela. Ou seja: o promovido era o único fora do
    // padrão da própria coluna.
    //
    // Vem de `card.bilheteriaBruta`, a MESMA fonte que a tela do Fechamento
    // imprime — de propósito, para não nascer uma segunda conta da mesma
    // grandeza (o padrão de erro mais recorrente desta casa).
    ticketMedio: publico > 0 ? card.bilheteriaBruta / publico : null,
    // A BILHETERIA BRUTA E A RÉGUA, GRAVADAS (decisão 6 do Marco, 25/07/2026,
    // reafirmada por questionário em 12/08/2026; entrou em 30/08/2026, quando
    // ele abriu o portão deste arquivo).
    //
    // Os dois campos são ADITIVOS e OPCIONAIS: benchmark antigo que não os tem
    // continua valendo, e `migrarBenchmark` já sabia lidar com eles desde
    // 25/07 — o módulo `reguaTicket.js` inteiro foi escrito para esta decisão.
    // O que faltava era só ISTO: quem promove não gravava, então o dado que a
    // régua precisa nascia e morria na mesma função.
    //
    // POR QUE GRAVAR A BRUTA, e não só o ticket: sem ela o ticket de um
    // promovido é irrecuperável. `receita` inclui bar e patrocínio, e não há
    // como voltar dela para a bilheteria; não existe link para o evento de
    // origem; e recalcular a partir do evento ATUAL não serve, porque ele pode
    // ter sido editado depois da promoção — o benchmark deixaria de ser a foto
    // congelada que promete ser.
    //
    // OS ANTIGOS NÃO SÃO TOCADOS. A restrição datada do Marco de 20/07/2026
    // ("NÃO MUDE BENCHMARKS ANTIGOS JÁ LANÇADOS") segue de pé, com teste
    // próprio. Esta decisão vale só daqui para a frente, que foi exatamente a
    // saída (b) que ele escolheu entre as três.
    bilheteriaBruta: card.bilheteriaBruta,
    reguaTicket: REGUA_BILHETERIA,
    lucro: card.resultado,
    obs: obsBenchmarkPromovido(evento, card, dataBR),
  }
}

/**
 * A obs do benchmark promovido nomeia o que é REALIZADO e o que é PREVISTO
 * (decisão do Marco, 26/07/2026, aprovada — princípio 1). Sem isto, a frase
 * abre com "bilheteria líquida REALIZADA" e segue sem nenhum outro sinal —
 * quando o bar não tem realizado lançado, ou sobra item de custo sem
 * realizado, essas parcelas entram pelo PREVISTO (a mesma régua de
 * `resultadoRealizado()`) e a frase, como estava, dava a entender que tudo
 * ali é fato medido.
 *
 * A bilheteria NUNCA é previsto aqui — é o portão da decisão 5 (sem
 * bilheteria realizada, `montarBenchmarkDeEvento` recusa a promoção antes de
 * chegar aqui). O patrocínio só entra FECHADO (`patrocinioPorEstagio`), nunca
 * "previsto" nesta conta — não há ambiguidade a nomear. Só bar e custos
 * variam:
 * - bar: `card.barInformado` diz se o valor é o realizado ou o previsto do
 *   cenário; em evento open bar a linha de bar nem entra na conta (fora da
 *   ambiguidade — segue "bar", sem qualificação);
 * - custos: `card.nSemRealizado` conta quantos itens de custo NÃO têm
 *   realizado lançado (esses entram pelo estimado, `valorConsiderado()`).
 *
 * QUANDO TUDO É REALIZADO, o texto é exatamente o de antes de 26/07/2026 — de
 * propósito (decisão do Marco): os benchmarks já promovidos guardam a `obs`
 * gravada e não são reescritos; a redação nova só nasce nos promovidos DAQUI
 * PRA FRENTE que tiverem alguma parcela pelo previsto. As duas redações
 * convivem.
 */
// A frase da RÉGUA entra aqui vinda de `reguaTicket.js`, e não escrita à mão:
// a decisão 6 do Marco pedia que "a observação do benchmark passe a dizer qual
// régua produziu aquele ticket", e a etiqueta que a TELA mostra sai do mesmo
// módulo. Duas cópias do mesmo texto é como esta casa já produziu tela e
// observação dizendo coisas diferentes sobre o mesmo número.
function obsBenchmarkPromovido(evento, card, dataBR) {
  const barPeloPrevisto = !isOpenBar(evento) && !card.barInformado
  const custosPeloPrevisto = card.nSemRealizado > 0
  const barTxt = barPeloPrevisto ? 'bar pelo previsto' : 'bar'
  const custosTxt = custosPeloPrevisto
    ? 'custos considerados (parte pelo previsto)'
    : 'custos realizados'
  // O IMPOSTO NA OBS (Marco, 27/07/2026) — e ele não é enfeite: o benchmark
  // grava `receita` BRUTA de imposto e `lucro` JÁ LÍQUIDO dele (é
  // `card.resultado`), então `receita − custoTotal ≠ lucro` de propósito.
  // `lucroNaoFecha()` vai acusar essa diferença no editor de benchmarks, com o
  // aviso "confira se é de propósito" — e esta frase é a resposta, gravada
  // JUNTO do benchmark. Sem ela o Marco encontraria o aviso sem a explicação e
  // desconfiaria de um número certo. É literalmente o caso que o comentário de
  // `lucroNaoFecha` já previa: "o lucro gravado pode ser a verdade histórica da
  // festa, com dinheiro que não está nas sete categorias".
  //
  // Só aparece quando o evento TEM imposto configurado: benchmark promovido de
  // festa sem imposto guarda a frase idêntica à de antes de 27/07/2026.
  const impostoTxt = card.imposto
    ? ` Menos R$ ${(Math.round(card.imposto.valor * 100) / 100).toFixed(2)} de imposto sobre a receita (${impostoTexto(card.imposto)}), que sai do lucro e não está nas categorias de custo.`
    : ''
  const base = `Promovido do fechamento de "${evento.nome}"${dataBR}`
  const pixTxt = card.pix != null ? ' + Pix líquido' : ''
  if (!barPeloPrevisto && !custosPeloPrevisto) {
    return `${base} — bilheteria líquida realizada + bar + patrocínio fechado${pixTxt}, menos os custos considerados. Sem reserva de contingência.${impostoTxt} ${FRASE_OBS_REGUA_BILHETERIA}`
  }
  return `${base} — bilheteria líquida realizada + ${barTxt} + patrocínio fechado${pixTxt}, menos os ${custosTxt}. Sem reserva de contingência.${impostoTxt} ${FRASE_OBS_REGUA_BILHETERIA}`
}

/**
 * Resultado do evento em fechamento — a saída "DINHEIRO REAL".
 *
 *   bilheteria LÍQUIDA realizada + bar realizado + patrocínio FECHADO + Pix líquido
 *   − imposto sobre a receita
 *   − custos considerados
 *
 * O IMPOSTO ENTRA AQUI DESDE 27/07/2026, pela mesma decisão que o pôs no DRE
 * (decisão 3 do Marco: dedução de receita, antes do lucro). Não é uma segunda
 * régua: é `impostoDoCenario`, o módulo que calc.js chama, recebendo as três
 * bases deste card. O motivo com números está na linha onde ele é calculado.
 * Evento sem imposto configurado sai com a conta e o objeto de sempre.
 *
 * DECISÃO DO MARCO, 20/07/2026 (aprovada e datada): entre as três saídas
 * coerentes que a evidência pôs na mesa — (A) espelhar o cenário, (B) dinheiro
 * real, (C) contingência só sobre o pendente — vale a (B). O card responde
 * "ganhamos dinheiro nesta festa?" com o dinheiro que MUDOU DE MÃO. Por isso a
 * contingência NÃO entra (é reserva, não despesa: ninguém emite nota de
 * contingência) e o `ajustePct` do cenário também não (é régua de projeção).
 *
 * O QUE ESTA MUDANÇA CONSERTOU (20/07/2026). A varredura adversarial de 4.000
 * eventos aleatórios mediu SEIS divergências entre este card e `computeCenario`.
 * Quatro eram ESTRUTURAIS e duas são a razão de existir do card:
 *
 *   1. contingência ............... fica de fora DE PROPÓSITO (decisão acima)
 *   2. ajustePct do cenário ....... fica de fora DE PROPÓSITO (idem)
 *   3. bilheteria BRUTA × LÍQUIDA . CONSERTADO — agora a líquida
 *   4. patrocínio fechado ......... CONSERTADO — agora entra
 *   5. bilheteria realizada × prevista ... de propósito (é o fechamento)
 *   6. bar realizado × previsto .......... de propósito (idem)
 *
 * As duas primeiras sobrevivem, e é por isso que a função devolve a PONTE:
 * `contingenciaDoCenario`, `ajusteDoCenario` e `lucroDoCenario`, LIDOS do
 * cenário recebido (nunca recalculados aqui). Sem o número da ponte na tela, o
 * card e a Home mostrando cifras diferentes para a mesma festa é exatamente o
 * "desconfiar de um número certo" que o PADRÃO DA CASA proíbe.
 *
 * Nos números do evento-régua: 35.000 de bilheteria com taxa 10% e cashback 5%
 * viram 33.250 de líquida; mais 5.000 de patrocínio confirmado, menos 31.000 de
 * custos considerados = +7.250. Os Cenários dizem +2.600 no mesmo evento, e a
 * diferença inteira são os 4.650 de contingência que ninguém vai desembolsar.
 *
 * O S1 ANTERIOR, QUE CONTINUA FECHADO (21/07/2026). A conta já foi
 * `receita informada INTEIRA − custos.totalRealizado`: receita cheia menos só
 * os custos JÁ PAGOS. O orçamento de quem ainda não pagou sumia e virava
 * "economia" — no evento do revisor, +19.000 em VERDE onde a verdade era
 * −1.000. A base CHEIA dos dois lados fica: custo pendente entra pelo estimado
 * (`valorConsiderado()`, a régua de todo o app) e linha de receita sem
 * realizado entra pelo PREVISTO dela, nunca como zero.
 *
 * O BAR NÃO PASSA POR TAXA NEM CASHBACK: `outrasReceitas.bar` já é lucro
 * líquido de bar por definição no app inteiro. Taxa e cashback são da
 * bilheteria da Tiqueteira e só dela. Open bar segue fora da conta.
 *
 * No modo REPASSE (`taxaPagaPor: 'cliente'`) a taxa não desconta — a regra mora
 * em `liquidaDeBruta()`, que é a cópia vigiada da fórmula de calc.js.
 *
 * Só existe quando HÁ receita realizada informada — sem nenhum dado de
 * fechamento, nada de número inventado.
 */
export function resultadoRealizado(evento, cenarioRealista) {
  const rec = fechamentoReceita(evento, cenarioRealista)
  if (!rec.algumRealizado) return null
  const conf = confrontoCustos(evento.categorias)

  // Custos na base cheia = realizado de quem tem + estimado de quem não tem.
  // É `valorConsiderado()` somado item a item, pela via do confronto (que já
  // separa os dois blocos com a MESMA régua de "tem realizado"). NÃO MEXER:
  // medido igual a `custosPorCategoria().totalConsiderado`, exato.
  //
  // A ÚLTIMA JUNTA (26/07/2026). As duas parcelas já saem exatas em centavos do
  // confronto, mas somá-las cru trazia o cisco de volta: 7.800,00 + 7.525,47
  // dava 15.325,470000000001, e aí o card ficava a um fio de centavo da aba
  // Custos. Medido em 60.000 festas com itens parcialmente pagos: 18% delas
  // carregavam essa sobra. Nenhuma chegou a mudar o número IMPRESSO — mas a
  // promessa desta frente é que as quatro telas digam o mesmo número, e "quase
  // o mesmo" não é o mesmo. Mesma régua por parcela do resto da casa.
  //
  // A MESMA GUARDA DO ABSURDO QUE `calc.js` JÁ TEM — e que faltava aqui
  // (achado da verificação adversarial, 26/07/2026, antes de o Marco ver o
  // diff). `somaCentavos` multiplica por 100 antes de arredondar, então um
  // item corrompido de 1 seguido de 308 zeros — valor que a porta do backup
  // ainda deixa entrar — estoura o double e vira `Infinity`, que `num()`
  // normaliza para 0. MEDIDO numa festa com bilheteria realizada de R$ 20.000:
  //     sem esta guarda .... custo R$ 0     e resultado R$ 19.000 de LUCRO
  //     com esta guarda .... custo Infinity e resultado -Infinity
  // Ou seja: sem ela, esta frente trocaria uma falha escancarada por um lucro
  // falso de aparência perfeitamente normal, em verde, no card que decide se a
  // festa valeu. Um número errado exibido como certo é o pior defeito da casa;
  // um absurdo visível é só um absurdo. Quando alguma parcela não é finita, o
  // total volta a ser a soma crua e o absurdo continua gritando.
  const custosRealizados = conf.realizado
  const custosPendentes = conf.estimadoPendente
  const custos = [custosRealizados, custosPendentes].every(Number.isFinite)
    ? somaCentavos([custosRealizados, custosPendentes])
    : custosRealizados + custosPendentes

  // ------------------------------------------------------------- O ESTIMADO
  //
  // A COLUNA "ESTIMADO" DO CARD É O ORÇAMENTO — DECISÃO DO MARCO, 27/07/2026
  // (por questionário, com a conta na frente; princípio 1 do CLAUDE.md).
  //
  // O DEFEITO QUE ISTO FECHA. A coluna "Estimado" do card de evento realizado
  // (Home e aba Cenários, via `ResumoRealizado`) vinha do CENÁRIO REALISTA, e o
  // cenário realista soma `valorConsiderado()` — o realizado quando ele existe,
  // o estimado quando não existe. Isso é CERTO para uma previsão viva: durante a
  // produção, o melhor palpite para um item já pago é o que ele custou. Mas num
  // evento FECHADO, em que quase todo item já tem realizado lançado, o "estimado"
  // VIRA o realizado — e o card comparava o realizado contra ele mesmo.
  //
  // MEDIDO no evento real do Marco (Marfim Alto Casa Norte, 05/07/2025,
  // fechado, 78 de 80 itens de custo com realizado lançado):
  //
  //     soma dos ESTIMADOS que ele digitou ....... R$ 306.540
  //     soma dos REALIZADOS ...................... R$ 376.360
  //     o que o card imprimia como "Estimado" .... R$ 376.360   ← o realizado
  //     desvio que o card mostrava ............... +0
  //     desvio de verdade ........................ +R$ 69.820 (+22,8%)
  //
  // E PIORAVA CONFORME A FESTA FECHAVA: quanto mais itens lançados, mais o
  // "estimado" convergia para o realizado, até o desvio sumir de vez — o número
  // ficava mais errado exatamente quando mais se confiava nele. O Marco foi
  // avisado de que cifras a que estava acostumado mudam (neste evento o lucro
  // "estimado" sai de R$ 168 mil para R$ 245 mil) e respondeu que as antigas
  // eram o realizado disfarçado.
  //
  // A RÉGUA DE HOJE é a MESMA da aba Fechamento, e ela NÃO é recriada aqui: o
  // orçamento é `conf.estimadoTodos`, que já está calculado logo acima nesta
  // função — o MESMO campo, do MESMO `confrontoCustos()`, que a aba Fechamento
  // imprime na linha "Orçamento de custos (todos os itens)" (via
  // `fechamentoCustos().totalEstimado`). Uma segunda soma da mesma grandeza é o
  // defeito mais recorrente desta casa; aqui não nasce nenhuma.
  //
  // A IDENTIDADE QUE ISSO CRIA, e que é a prova de que a régua é a certa:
  //
  //     custos − estimado.custos
  //   = (realizado + estimadoPendente) − (estimadoDosMesmos + estimadoPendente)
  //   = realizado − estimadoDosMesmos
  //   = `conf.delta`, o "Desvio" total que a aba Fechamento já imprime
  //
  // O estimado de quem ainda não pagou aparece igual nos DOIS lados e se
  // cancela. Ou seja: o card e a aba Fechamento passam a dizer o MESMO desvio
  // para a mesma festa, em vez de duas verdades em duas telas.
  //
  // O QUE NÃO ENTRA, e por quê. Contingência e ajuste de cenário ficam de fora,
  // como já ficam do lado do realizado (decisão de 20/07/2026: reserva não é
  // despesa, ninguém emite nota de contingência; ajuste é régua de projeção).
  // Somá-los só de um lado inflaria o desvio pelo tamanho da reserva — o mesmo
  // "número certo levando à leitura errada" que `confrontoCustos.js` nasceu para
  // matar. Por isso o custo estimado é o orçamento puro, e o lucro estimado é
  // `receita do cenário − orçamento`.
  //
  // A RECEITA ESTIMADA CONTINUA SENDO A DO CENÁRIO REALISTA, sem uma linha
  // mudada: `computeCenario` calcula receita a partir dos lotes, do bar e do
  // patrocínio — nunca de `receitaRealizada` —, então ali não há realizado
  // vazando para dentro do estimado. É por isso que, no evento do Marco, só o
  // lucro se move, e ele se move exatamente os R$ 69.820 do custo.
  //
  // O CENÁRIO NÃO FOI TOCADO. `computeCenarios` segue somando `valorConsiderado`
  // em tudo (DRE, três cenários, break-even, benchmarks): a previsão viva do
  // evento ABERTO é o que este bloco não mexe, de propósito. O que mudou é só a
  // COMPARAÇÃO estimado × realizado do card.
  //
  // A receita entra CRUA (sem `num()`), pela mesma razão da guarda do absurdo
  // acima: normalizar um não-finito para 0 troca um absurdo escancarado por um
  // lucro falso de aparência normal.
  const temCenario = cenarioRealista != null
  const receitaEstimada = temCenario ? cenarioRealista.receitaTotal : null
  const custosEstimados = conf.estimadoTodos
  // O IMPOSTO DO LADO ESTIMADO É O DO PRÓPRIO CENÁRIO — lido, nunca recalculado
  // (mesma regra da ponte logo abaixo: `cenarioRealista.*` entra como veio).
  // A coluna "Estimado" é receita DO CENÁRIO menos orçamento; se ela não
  // descontasse o mesmo imposto que o cenário desconta, o "vs. estimado" do
  // card compararia um lucro pós-imposto contra um lucro pré-imposto e
  // chamaria a diferença de desvio. `?.` e `num()` são cinto para o cenário
  // ausente e para a FOTO antiga (gravada antes de 27/07/2026), que não tem a
  // chave: nesses casos o imposto é 0 e a conta é a de sempre.
  const impostoEstimado = num(cenarioRealista?.imposto?.valor)
  const lucroEstimado = temCenario ? somaEmCentavos([receitaEstimada, -impostoEstimado, -custosEstimados]) : null

  // As linhas de receita, na ordem em que `fechamentoReceita` as monta:
  // [0] bilheteria (bruta), [1] bar quando não é open bar; Pix vem por último.
  const lBilheteria = rec.linhas[0]
  const lBar = isOpenBar(evento) ? null : rec.linhas[1]
  const linhasPrevistas = rec.linhas.filter((l) => !l.temRealizado)

  // Bilheteria: o valor REALIZADO informado quando existe; senão a BRUTA
  // prevista do cenário realista. Sobre esse bruto — e só sobre ele — incidem
  // taxa e cashback.
  const bruta = lBilheteria.temRealizado ? lBilheteria.realizado : lBilheteria.estimado
  const bil = liquidaDeBruta(bruta, evento.taxaBilheteria, evento.cashbackPct, isTaxaCliente(evento))

  // Bar: realizado quando informado, senão o previsto. Já é lucro líquido.
  const bar = lBar ? (lBar.temRealizado ? lBar.realizado : lBar.estimado) : 0

  // Patrocínio: só o FECHADO (confirmado + recebido), pela mesma função de
  // estágios que os Cenários usam — a regra não é recriada aqui.
  const pat = patrocinioPorEstagio(evento)

  // Marco, 28/09/2026: valor adicional já líquido, fora das bases da
  // bilheteria, do bar e do patrocínio. Sem taxa, cashback ou imposto automático.
  const pixInformado = temValor(evento.receitaRealizada?.pix)
  const pix = pixInformado ? emCentavos(num(evento.receitaRealizada.pix)) : 0
  const receita = somaEmCentavos([bil.liquida, bar, pat.fechado, pix])

  // Quanto desta receita ainda é PROJEÇÃO — para o card poder declarar o
  // tamanho do que falta. A bilheteria entra pela LÍQUIDA (é assim que ela
  // pesa na conta), o bar pelo valor dele.
  const receitaPrevista = somaEmCentavos([lBilheteria.temRealizado ? 0 : bil.liquida, lBar && !lBar.temRealizado ? bar : 0])

  // ------------------------------------------------------- O IMPOSTO, AQUI
  //
  // MESMA REGRA, APLICADA AOS NÚMEROS REALIZADOS (Marco, 27/07/2026 — decisão
  // 3: imposto é dedução de RECEITA, entra depois da receita total e antes do
  // lucro). A regra NÃO é recriada aqui: é `impostoDoCenario`, o mesmo módulo
  // que calc.js chama, recebendo as MESMAS três bases — bilheteria BRUTA, bar
  // e patrocínio fechado — só que com os valores deste card (realizado onde
  // ele existe, previsto no resto). Uma segunda régua de imposto é justamente
  // o defeito que esta frente veio evitar.
  //
  // POR QUE ISTO PRECISOU EXISTIR (achado da revisão cética, 27/07/2026). Sem
  // esta linha o app passava a mostrar DOIS lucros para a mesma festa, lado a
  // lado na mesma rolagem da aba Cenários: o card do cenário realista dizia
  // R$ 7.900 (com "Imposto − R$ 1.300" impresso logo acima) e o card
  // "Resultado realizado" dizia R$ 9,5 mil, "+R$ 0 acima do estimado". E a
  // foto do fechamento congelava os dois para sempre.
  //
  // A BASE É A BRUTA aqui pelo mesmo motivo de lá (decisão 2): `bil.bruta` é a
  // bilheteria antes da comissão e do cashback. No modo repasse a líquida é
  // MAIOR que a bruta, e tributar a líquida cobraria imposto sobre o cashback
  // que volta para a produção.
  const imp = impostoDoCenario(evento, { bruta: bil.bruta, bar, patrocinio: pat.fechado })
  const imposto = imp ? imp.valor : 0

  const resultado = somaEmCentavos([receita, -imposto, -custos])
  return {
    // A conta, passo a passo, na ordem em que ela acontece na tela.
    bilheteriaBruta: bil.bruta,
    // Quais parcelas são realizado INFORMADO e quais ainda são previsão — a
    // tela nomeia a linha com isto ("Bilheteria realizada" × "prevista").
    bilheteriaInformada: lBilheteria.temRealizado,
    barInformado: !!(lBar && lBar.temRealizado),
    taxa: bil.taxa,
    cashback: bil.cashback,
    bilheteriaLiquida: bil.liquida,
    bar,
    ...(pixInformado ? { pix } : {}),
    patrocinio: pat.fechado,
    patrocinioPotencial: pat.potencial,
    receita,
    // Chave CONDICIONAL, pelo mesmo motivo da chave `imposto` em calc.js:
    // evento sem imposto configurado sai com o objeto EXATAMENTE como sempre
    // foi — campo por campo —, e é isso que mantém a foto de fechamento dos
    // eventos que já existem idêntica ao que era. Quando existe, carrega o
    // descritor INTEIRO (alíquota e bases, não só o R$): sem ele, quem abrisse
    // esta foto daqui a um ano veria receita − custos ≠ resultado e não teria
    // como descobrir o porquê.
    ...(imp ? { imposto: imp } : {}),
    custos,
    custosRealizados,
    custosPendentes,
    resultado,

    // A COLUNA "ESTIMADO" DO CARD, pronta — o bloco inteiro, para que nenhuma
    // tela precise montá-lo (componente não faz conta) e para que não exista
    // uma segunda régua de "estimado" em lugar nenhum. Ver o comentário longo
    // acima: `custos` é o ORÇAMENTO (todos os itens pelo valor digitado, o
    // realizado ficando de fora), a MESMA soma da aba Fechamento.
    //
    // `custos` existe sempre (é só a soma dos itens); receita, lucro e margem
    // são null sem cenário — sem cenário não há receita prevista, e inventar
    // uma seria o número errado exibido como certo. A tela imprime "—".
    // `margem` usa a MESMA guarda de calc.js (`receitaTotal > 0 ? … : null`).
    estimado: {
      receita: receitaEstimada,
      custos: custosEstimados,
      lucro: lucroEstimado,
      margem: temCenario && receitaEstimada > 0 ? (lucroEstimado / receitaEstimada) * 100 : null,
      // Condicional pela mesma razão da irmã acima. É o descritor DO CENÁRIO
      // (o imposto da previsão), não o deste card — a coluna "Estimado" é a
      // previsão, e a tela precisa dos dois para poder mostrar o desvio.
      ...(cenarioRealista?.imposto ? { imposto: cenarioRealista.imposto } : {}),
    },

    // Pendência declarada.
    nItens: conf.nItens,
    nComRealizado: conf.nComRealizado,
    nSemRealizado: conf.nSemRealizado,
    receitaPrevista,
    // A parte da receita que NÃO é projeção (inclui o patrocínio fechado, que
    // é dinheiro contratado, não previsão).
    receitaInformada: somaEmCentavos([receita, -receitaPrevista]),
    linhasPrevistas: linhasPrevistas.map((l) => l.nome),
    // `completo` = nada mais é projeção dos dois lados. Só nesse caso o card
    // pode se chamar "Resultado realizado" sem ressalva.
    completo: conf.nSemRealizado === 0 && linhasPrevistas.length === 0,
    sinal: sinalResultado(resultado),

    // Para a tela nomear a linha certo ("taxa paga pelo cliente" não desconta).
    taxaCliente: isTaxaCliente(evento),

    // A PONTE COM OS CENÁRIOS — LIDA do cenário, jamais recalculada aqui. É o
    // que permite ao card dizer, com número, por que difere da Home.
    //
    // A DIFERENÇA TEM TRÊS PARCELAS, E SÓ TRÊS (identidade exata):
    //
    //   resultado − lucroDoCenario  =  reserva  +  desvioDeReceita  −  desvioDeImposto
    //
    // onde `reserva` = custoTotal do cenário − custos considerados (ou seja,
    // contingência MAIS o ajuste de custo do cenário, que incide sobre os dois),
    // `desvioDeReceita` = receita deste card − receitaTotal do cenário e
    // `desvioDeImposto` = imposto deste card − imposto do cenário. O
    // patrocínio fechado é o MESMO dos dois lados e se cancela: o desvio é a
    // bilheteria e o bar realizados contra os previstos.
    //
    // A TERCEIRA PARCELA NASCEU EM 27/07/2026, com o imposto, e a sua ausência
    // foi um S1 pego pela revisão cética antes de o Marco ver a tela. Esta
    // subtração assumia que `lucro` tem DOIS termos (receita e custo); o
    // imposto fez três, e o imposto inteiro caía dentro do "desvio de receita".
    // MEDIDO na tela renderizada, num evento cuja receita realizada é
    // EXATAMENTE a prevista: a aba Fechamento imprimia "a receita deste card
    // está R$ 1.300 acima da prevista no cenário" — e os R$ 1.300 eram o
    // imposto. A identidade fechava (R$ 1.600 = 300 de contingência + 1.300),
    // então nada parecia errado: número certo, causa errada, a terceira
    // encarnação da doença que os parágrafos acima descrevem.
    //
    // POR QUE ISSO IMPORTA (achado da verificação adversarial, 20/07/2026):
    // a primeira versão desta ponte dizia que a Home difere "PORQUE a previsão
    // reserva contingência" — uma causa única, afirmada com `porque`. Só é
    // verdade quando realizado == previsto, isto é, exatamente quando o
    // fechamento não fechou nada. Num evento que vendeu abaixo do previsto a
    // frase apontava para o lado errado: card −12.000, cenário −5.725, e o
    // texto nomeava 4.650 de contingência para explicar um gap de 6.275 que
    // vinha, em maior parte, da bilheteria. Número certo com causa errada
    // desinforma igual a número errado.
    //
    // `desvioDeReceita` é derivado da diferença (e não somado à parte) DE
    // PROPÓSITO: assim as duas parcelas sempre fecham com o total na tela, sem
    // resíduo de ponto flutuante para o leitor que soma com o dedo.
    contingenciaDoCenario: cenarioRealista?.contingencia ?? null,
    ajusteDoCenario: cenarioRealista?.ajustePct ?? null,
    lucroDoCenario: cenarioRealista?.lucro ?? null,
    reservaDoCenario: cenarioRealista ? somaEmCentavos([cenarioRealista.custoTotal, -custos]) : null,
    // A reserva ABERTA nas suas duas metades, porque elas podem ter SINAIS
    // OPOSTOS e a tela precisa nomear cada uma com o verbo certo: contingência
    // sempre acrescenta, o ajuste do cenário pode acrescentar OU cortar. Fundir
    // as duas num número só e tirar o verbo do sinal do net fazia a tela dizer
    // "a previsão CORTA R$ 5.500 de contingência" num evento em que a
    // contingência somava 5.000 e quem cortava era um ajuste de −10%
    // (achado adversarial, 9% dos eventos com card).
    // Vem do custoTotal do cenário por subtração — não recalcula fórmula.
    ajusteDoCenarioValor: cenarioRealista
      ? somaEmCentavos([cenarioRealista.custoTotal, -somaEmCentavos([custos, num(cenarioRealista.contingencia)])])
      : null,
    diferencaParaCenario: cenarioRealista ? somaEmCentavos([resultado, -cenarioRealista.lucro]) : null,
    // O desvio de IMPOSTO, direto (não por subtração): as duas pontas são
    // conhecidas exatamente. Chave condicional — evento sem imposto em lado
    // nenhum não ganha campo novo, e o objeto continua idêntico ao de antes.
    ...(cenarioRealista && (imp || cenarioRealista.imposto)
      ? { desvioDeImposto: somaEmCentavos([imposto, -impostoEstimado]) }
      : {}),
    // `desvioDeReceita` continua sendo o RESTO — derivado da diferença, e não
    // somado à parte, de propósito: assim as parcelas sempre fecham com o total
    // na tela, sem resíduo de ponto flutuante para o leitor que soma com o
    // dedo. O `+ (imposto − impostoEstimado)` devolve ao imposto o que é dele:
    // sem esse termo, tudo o que o imposto explica vinha vestido de bilheteria.
    desvioDeReceita: cenarioRealista
      ? somaEmCentavos([
          resultado,
          -cenarioRealista.lucro,
          -somaEmCentavos([cenarioRealista.custoTotal, -custos]),
          somaEmCentavos([imposto, -impostoEstimado]),
        ])
      : null,
  }
}

