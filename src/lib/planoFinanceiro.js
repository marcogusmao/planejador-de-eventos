// Ponte 2 com o Financeiro (Sessão M — sugestão 12 do MELHORIAS.md).
//
// Gera o ARQUIVO de plano (CSV) que o Financeiro importa pelo tradutor da
// Sessão L (item 11b do BACKLOG.md de lá — contrato lido na íntegra antes de
// escrever este módulo). A previsão NUNCA escreve direto no Financeiro: só
// produz um arquivo local para o Marco importar à mão, pela tela de Importar
// → Plano da Previsão de lá — mesmo princípio da regra do Marco (18/07/2026)
// para toda troca de dados entre os apps: revisão item a item antes de sair
// qualquer coisa daqui.
//
// Nenhum número é digitado de novo e nenhuma fórmula nova entra aqui: os
// valores exportados são exatamente os que computeCenario('realista') e os
// itens de custo (campo `estimado`) já mostram nas telas do evento.
//
// Tudo aqui é puro e testado em planoFinanceiro.test.js — só o clique do
// botão "Baixar arquivo" tem efeito colateral (download), como já é o padrão
// de storage.js (exportBackup).

import { num, emCentavos, cabeEmCentavos } from './util.js'
import { hojeISO } from './dataLocal.js'
import { computeCenario, custouZeroEfetivo, isBarPorPessoa, isOpenBar, isTaxaCliente } from './calc.js'
import { fmtBRL, fmtData } from './format.js'
import { TIPOS_PADRAO } from './defaults.js'
import { temParcelas, somaParcelas } from './parcelas.js'
import { temRealizado } from './confrontoCustos.js'
import { textoAvisoLotesSemPreco } from './loteSemPreco.js'

// Categorias de RECEITA do Financeiro que este módulo sabe preencher (grafia
// exata conferida no seed do banco — backend/database.py do Financeiro,
// 18/07/2026). Não existe categoria "Bar" isolada lá: é "Bar / Consumo".
export const CATEGORIA_FIN_INGRESSOS = 'Ingressos'
export const CATEGORIA_FIN_BAR = 'Bar / Consumo'
export const CATEGORIA_FIN_PATROCINIO = 'Patrocínio'

// Categoria de custo do Financeiro usada como "balde" quando a categoria da
// previsão não tem equivalente 1:1 exato do outro lado (marketing, extras,
// categorias custom criadas pelo Marco). Nunca falha em silêncio: toda vez
// que este balde é usado, uma linha de aviso explica o motivo.
const CATEGORIA_FIN_OUTRAS_DESPESAS = 'Outras despesas'

// Categoria da previsão (id de CATEGORIAS_PADRAO em defaults.js) → nome EXATO
// de categoria de custo_evento no Financeiro. Construído como o espelho do
// MAPA_CATEGORIAS de financeiro.js (Sessão H, sentido Financeiro→previsão),
// mas nem toda categoria daqui tem par exclusivo lá: "locacao" agrupa
// Locação+Documentação e "equipe" agrupa Equipe+Segurança no lado da previsão
// — a exportação escolhe o par mais próximo (Locação do espaço / Equipe de
// evento) e o Marco pode recategorizar à mão na revisão do Financeiro se
// precisar separar. "marketing" e "extras" não têm par específico e caem em
// "Outras despesas" (mesma escolha do lado de leitura, onde "outras despesas"
// do Financeiro já volta como "extras" aqui).
const MAPA_CATEGORIA_CUSTO = {
  aeb: 'A&B / CMV',
  locacao: 'Locação do espaço',
  estrutura: 'Estrutura / Cenografia',
  equipe: 'Equipe de evento',
  artistico: 'Artístico / DJ',
  marketing: CATEGORIA_FIN_OUTRAS_DESPESAS,
  extras: CATEGORIA_FIN_OUTRAS_DESPESAS,
}

export function categoriaFinanceiroCusto(categoriaId) {
  return MAPA_CATEGORIA_CUSTO[categoriaId] || CATEGORIA_FIN_OUTRAS_DESPESAS
}

// ————— O EMISSOR GUARDADO (20/07/2026) —————
//
// POR QUE ESTE MECANISMO EXISTE, contado inteiro para ninguém o desfazer sem
// saber o que está desfazendo.
//
// Este módulo tinha um defeito REINCIDENTE, encontrado oito vezes em dois dias,
// sempre com a mesma forma: CONFERIA UM CONJUNTO E EMITIA OUTRO. Lia um número
// da fonte, conferia contra ele, e só DEPOIS filtrava o que ia para o arquivo
// (`if (valor <= 0) continue`). Quem foi conferido e quem foi emitido eram
// conjuntos diferentes — então o arquivo podia sair discordando da tela com
// `alertas: []` e `avisos: []`, que é exatamente o S1 do §9.1 do laudo externo
// voltando por outra porta. Três buracos foram fechados um a um no commit
// 452b957 — e um quarto nasceu na MESMA sessão. Consertar ponto a ponto não
// estava funcionando.
//
// A cura é estrutural: `itens` deixou de ser um array solto no escopo da função
// (ao alcance de qualquer `itens.push` distraído) e passou a viver dentro deste
// closure. A ÚNICA porta para o arquivo é `emitir()`, e `emitir()` não aceita um
// bloco de linhas sem uma `referencia` (o número que a TELA mostra para aquele
// bloco) e sem um texto de divergência. Quem for escrever o bloco 9 — "couvert
// artístico", o que vier — é obrigado a responder "referência a quê?" antes de
// conseguir emitir a primeira linha.
//
// E se esquecer de chamar `emitir()`? `BLOCOS_DO_PLANO` + `selar()` acusam a
// AUSÊNCIA. Um bloco que some do arquivo inteiro é tão silencioso quanto um
// bloco que sai errado; este é o único mecanismo aqui que enxerga esse caso.

/** Meio centavo — a mesma tolerância de parcelas.js. Dinheiro é em centavos;
 *  diferença >= R$ 0,005 é divergência de verdade, não ruído de float. */
export const TOLERANCIA_CONFERENCIA = 0.005

/** Os blocos que TÊM de ser conferidos antes de o arquivo existir. Bloco de
 *  custo entra como `custos:<id do item>` — a checagem olha o prefixo. */
export const BLOCOS_DO_PLANO = ['ingressos', 'bar', 'patrocinio', 'custos', 'contingencia']

export function criarEmissorDoPlano() {
  const itens = []
  const avisos = []
  const alertas = []
  const bloqueios = []
  const conferencias = []
  const foraDoArquivo = []

  /**
   * A única porta do arquivo.
   *
   * `linhas` são montadas PRIMEIRO pelo chamador; a soma conferida é a soma
   * DELAS, nunca a da fonte de onde vieram — é essa inversão que fecha o
   * defeito reincidente. Bateu com `referencia` (o número da tela): as linhas
   * entram. Não bateu: NENHUMA linha daquele bloco sai e `aoDivergir` vira
   * alerta vermelho, dizendo o que ficou de fora, quanto, e o que fazer.
   */
  const emitir = ({ bloco, rotulo, linhas = [], referencia, aoDivergir }) => {
    const somaEmitida = linhas.reduce((s, l) => s + num(l.valor), 0)
    const ref = num(referencia)
    const confere = Math.abs(somaEmitida - ref) < TOLERANCIA_CONFERENCIA
    if (confere) for (const linha of linhas) itens.push(linha)
    else alertas.push(...[].concat(aoDivergir({ referencia: ref, somaEmitida })))
    // A trilha vai para a TELA (a tabela "o que a tela diz × o que este arquivo
    // leva"). Registrada SEMPRE, inclusive quando confere: um bloco que fecha
    // também é informação, e é o que permite ao rodapé prometer "cada real que
    // a tela mostra está neste arquivo, ou está explicado acima".
    conferencias.push({ bloco, rotulo, referencia: ref, somaEmitida, confere, qtdLinhas: linhas.length })
    return confere
  }

  /**
   * A soma do que REALMENTE ENTROU no arquivo até agora (opcionalmente de um
   * grupo só). Existe para uma regra que a verificação adversarial de
   * 20/07/2026 escreveu com sangue: NENHUM TEXTO PODE AFIRMAR UM NÚMERO QUE
   * NÃO VEIO DO QUE FOI EMITIDO. O aviso do ajuste de custo recalculava o
   * "cru" da FONTE (cen.custoItens, que prioriza o realizado e ignora
   * parcelas) e afirmava um total que o arquivo não tinha — às vezes com o
   * sentido invertido. É o mesmo defeito do emissor, escrito em português.
   * Quem precisar citar um total do arquivo pergunta aqui.
   */
  const totalEmitido = (grupo) =>
    itens.filter((l) => !grupo || l.grupo === grupo).reduce((s, l) => s + num(l.valor), 0)

  /**
   * O NONO FURO, nomeado (S2-a da verificação adversarial de 20/07/2026).
   *
   * `emitir()` só enxerga o que alguém nomeou como bloco. Taxa da Tiqueteira e
   * cashback nunca foram nomeados — logo os cinco blocos podiam CONFERIR
   * todos, com zero alerta e zero aviso, enquanto R$ 1.935 líquidos ficavam
   * de fora e o rodapé da tela jurava que "cada real está neste arquivo".
   * Não era mentira do emissor: era a prova de que ele não vê o que ninguém
   * declara.
   *
   * Este canal é para grandezas que estão na tela e que o arquivo NÃO leva
   * DE PROPÓSITO. Não é alerta (nada quebrou) nem aviso (não é ressalva a
   * conferir): é uma DECLARAÇÃO com nome e valor em R$, que a tela imprime.
   * Publicar a bilheteria bruta é comportamento antigo e decisão do Marco —
   * o que muda aqui é que ele deixa de ser invisível.
   */
  const declararFora = ({ id, rotulo, valor, explicacao }) => {
    foraDoArquivo.push({ id, rotulo, valor: num(valor), explicacao })
  }

  const avisar = (texto) => avisos.push(texto)
  const alertar = (texto) => alertas.push(texto)
  const bloquear = (texto) => bloqueios.push(texto)
  const temBloqueio = () => bloqueios.length > 0

  /**
   * Fecha a montagem. Antes de devolver, confere a AUSÊNCIA: bloco previsto em
   * BLOCOS_DO_PLANO que nunca passou por `emitir()` vira alerta de erro interno
   * — porque um bloco esquecido some do arquivo inteiro, calado, e nenhuma das
   * conferências de valor enxerga isso.
   *
   * `parcial: true` no caminho de bloqueio: ali o arquivo nem chega a existir,
   * então cobrar conferência de bloco seria ruído em cima de um "não dá para
   * exportar" que já está dito.
   */
  const selar = ({ parcial = false } = {}) => {
    if (!parcial) {
      const conferidos = new Set(conferencias.map((c) => String(c.bloco).split(':')[0]))
      for (const bloco of BLOCOS_DO_PLANO) {
        if (!conferidos.has(bloco)) {
          alertas.push(
            `Erro interno da exportação: o bloco "${bloco}" não foi conferido antes de gerar o arquivo. ` +
              'Não exporte este arquivo — avise o Marco. Nenhum dado do evento foi alterado.'
          )
        }
      }
    }
    return { itens, avisos, alertas, bloqueios, conferencias, foraDoArquivo }
  }

  return { emitir, avisar, alertar, bloquear, declararFora, temBloqueio, totalEmitido, selar }
}

// ————— Montagem dos itens exportáveis (LEITURA pura sobre o evento) —————

/**
 * Monta a lista de itens candidatos a exportar (cada um vira, no máximo, uma
 * linha do CSV se for selecionado na revisão) + avisos em português + o
 * motivo de bloqueio quando o evento não tem o mínimo para exportar.
 *
 * Três canais de conversa com a tela, do mais grave para o menos:
 *   bloqueios — não dá para exportar nada (falta marca ou data);
 *   alertas   — dá para exportar, mas alguma coisa que você VÊ na tela não
 *               entrou no arquivo, de propósito;
 *   avisos    — foi tudo, com uma ressalva a conferir do outro lado.
 *
 * Cada item: { id (id_linha estável), grupo: 'receita'|'custo', categoria
 * (nome exato do Financeiro), rotulo (exibição), descricao (coluna do CSV),
 * valor (magnitude positiva) }.
 *
 * id_linha é construído com os UIDs que já são estáveis e únicos no app
 * (evento.id + lote.id / item.id) em vez de índice de posição — mais forte
 * que a recomendação do contrato (que citava índice): sobrevive a reordenar
 * ou inserir itens no meio, nunca muda de linha lógica entre exportações.
 *
 * A ORDEM das chamadas abaixo É A ORDEM DOS BYTES DO CSV, e está travada pelas
 * fotografias de planoFinanceiro.foto.test.js. Não é detalhe de estilo.
 */
export function montarItensPlano(evento) {
  const E = criarEmissorDoPlano()

  if (!evento.tipo || !evento.tipo.trim()) {
    E.bloquear(
      'O evento não tem "Festa" definida (aba do topo) — é a marca que o Financeiro usa para achar a empresa certa. Defina antes de exportar.'
    )
  } else if (!TIPOS_PADRAO.includes(evento.tipo)) {
    E.avisar(
      `"Festa" deste evento é "${evento.tipo}", que não é uma das marcas conhecidas do Financeiro (${TIPOS_PADRAO.join(', ')}). Se essa marca não existir lá, o Financeiro vai sinalizar as linhas para revisão em vez de descartar.`
    )
  }
  if (!evento.data) {
    E.bloquear('O evento não tem "Data" definida (aba do topo) — é obrigatória para o Financeiro. Defina antes de exportar.')
  }

  if (E.temBloqueio()) return E.selar({ parcial: true })

  // Lote com preço em branco fica fora do público e do bar (P8, aprovado pelo
  // Marco em 06/10/2026): os números exportados já vêm sem ele — este aviso só
  // diz POR QUE, para a revisão não mostrar Ingressos/Bar menores em silêncio.
  // Mesmo texto da aba Cenários e do relatório (loteSemPreco.js).
  const avisoSemPreco = textoAvisoLotesSemPreco(evento)
  if (avisoSemPreco) E.avisar(avisoSemPreco)

  const cen = computeCenario(evento, 'realista')

  emitirIngressos(E, evento, cen)
  declararTaxaECashback(E, evento, cen)
  emitirBar(E, evento, cen)
  emitirPatrocinio(E, evento, cen)
  avisarRealizado(E, evento, cen)
  emitirCustos(E, evento, cen)
  emitirContingencia(E, evento, cen)
  // DEPOIS de todos os blocos de custo, de propósito: este aviso cita o total
  // que ENTROU no arquivo, e ele só existe quando tudo já foi emitido.
  avisarAjusteDeCustoDoCenario(E, cen)

  return E.selar()
}

// ————— Bloco: ingressos —————

// — DECISÃO DO MARCO, 25/07/2026 (aprovada e reconfirmada no mesmo dia ao
//   resolver um conflito entre dois registros) — A BILHETERIA VIRA UMA
//   LINHA SÓ, SEMPRE —
//
// Até aqui (trava do §9.1, auditoria externa 19–20/07/2026 — S1) este bloco
// dividia a bilheteria POR LOTE, e só exportava quando a soma dos lotes
// batia com `cen.bruta` (o número que a TELA mostra). No caminho do ticket
// médio manual — ou do ajuste de ticket em % —, calc.js reescreve a bruta e
// mantém a divisão antiga por baixo: a tela dizia R$ 20.000 e a soma dos
// lotes ficava em R$ 10.000, então NENHUMA linha de ingresso saía, e o
// Marco tinha de lançar a bilheteria à mão no Financeiro.
//
// A partir de agora o arquivo NUNCA divide por lote: sai sempre UMA linha,
// "Ingressos (bilheteria)", com `valor: cen.bruta` — o mesmo número que a
// tela mostra, com ou sem ticket manual. O id da linha é ESTÁVEL
// (`${evento.id}:ingressos`, sem sufixo de lote) DE PROPÓSITO: o Financeiro
// deduplica por esse id e NUNCA apaga linha antiga do mesmo evento (só pula
// id repetido — backend/services/plano_previsao.py:371 no Financeiro).
// Se a forma da linha mudasse conforme o caso (por lote numa exportação,
// consolidada noutra), o MESMO evento reexportado depois de trocar de forma
// ficaria com as DUAS linhas no Financeiro, dobrando a bilheteria. Com a
// linha sempre igual, o id nunca muda e a dobra não tem como acontecer.
//
// Como a linha agora É o próprio `cen.bruta`, a conferência interna
// (soma emitida × referência) nunca mais diverge — o que era ALERTA
// (bloqueio: nada sai) vira AVISO informativo (o arquivo sai certo, e a
// tela só explica por que o número não é a soma ingênua dos lotes×preço
// que aparece na aba Receita). Ver `avisosInformativosIngressos` abaixo.
function emitirIngressos(E, evento, cen) {
  const bruta = num(cen.bruta)
  const linhas =
    bruta > 0
      ? [
          {
            id: `${evento.id}:ingressos`,
            grupo: 'receita',
            categoria: CATEGORIA_FIN_INGRESSOS,
            rotulo: 'Ingressos (bilheteria)',
            descricao: 'Ingressos (bilheteria)',
            valor: bruta,
          },
        ]
      : []

  E.emitir({
    bloco: 'ingressos',
    rotulo: 'Ingressos (bilheteria)',
    linhas,
    referencia: bruta,
    // Só dispara quando a bilheteria do cenário realista fecha NEGATIVA no
    // total (não apenas um lote isolado — esse caso agora é informativo,
    // ver avisosInformativosIngressos): valor negativo não vira linha de
    // receita no Financeiro, igual ao bar e ao patrocínio.
    aoDivergir: () =>
      `A receita de INGRESSOS ficou de fora deste arquivo, de propósito: a bilheteria do cenário realista fechou NEGATIVA (${fmtBRL(bruta)}) — valor negativo não vira linha de receita no Financeiro. ` +
      'O que fazer: confira os lotes na aba Receita — um valor de lote errado ou um desconto lançado como lote pode ser a causa — e exporte de novo.',
  })

  if (bruta === 0) {
    const causas = causasBrutaZero(cen)
    if (causas.length === 0) {
      E.avisar('Nenhum lote tem receita prevista no cenário realista (venda 0 ou preço R$ 0) — nada de "Ingressos" para exportar.')
    } else {
      for (const causa of causas) E.avisar(causa)
    }
  } else if (bruta > 0) {
    for (const aviso of avisosInformativosIngressos(cen)) E.avisar(aviso)
  }
}

// Achado do provador adversarial (26/07/2026): com `bruta === 0` o texto
// SEMPRE dizia "venda 0 ou preço R$ 0", mesmo quando essa não era a causa —
// e, no caso do lote negativo, a causa real ficava totalmente INVISÍVEL,
// porque `avisosInformativosIngressos` (acima) só é chamada com `bruta > 0`.
// Dois casos medidos, ambos com o texto antigo mentindo:
//
// (1) ticket manual R$ 100, 250 vendidos (R$ 25.000 de venda REAL), mais
//     ajuste de ticket em -100% — o ajuste zera o número por cima de uma
//     venda que existe. "Venda 0 ou preço R$ 0" é falso: há venda.
// (2) um lote de 200 × R$ 100 e outro de 200 × R$ −100 (sem ticket manual,
//     sem ajuste) — os dois se cancelam exatamente. O texto antigo dizia a
//     mesma frase falsa, E o lote negativo ficava mudo, porque o aviso que
//     o nomeia só disparava com `bruta > 0` — a mesma classe de bug que o
//     lote negativo já tinha tido corrigida no aviso ACIMA (linhas ~334–352),
//     reaberta aqui por outra porta.
//
// Esta função usa a MESMA família de checagens que `avisosInformativosIngressos`
// já usa (ticket manual, ajuste %, lote negativo) — cada causa ativa é
// avaliada e narrada por conta própria, sem `if/else if` que cale uma causa
// quando duas estão ligadas ao mesmo tempo. Só quando NENHUMA das três está
// ativa a bruta zerada é mesmo "venda 0 ou preço R$ 0" — aí o texto de
// sempre continua valendo, porque nesse caso ele é verdadeiro: sem lote
// negativo, sem ticket manual e sem ajuste, a soma só fecha em R$ 0,00 se
// cada lote tiver, individualmente, venda 0 ou preço R$ 0.
//
// Achado do provador adversarial (26/07/2026, terceira porta do mesmo
// defeito): o texto de cada causa acima AFIRMA UMA NEGATIVA — "a causa NÃO
// é venda 0 nem preço R$ 0" — sem nunca checar se a venda É zero. Dois casos
// alcançáveis pela UI (ticket manual vive na aba Simulador; os lotes, na aba
// Receita — dá para configurar um e zerar o outro):
//
//   - ticket manual de R$ 150 com todos os lotes em quantidade 0 (pagos = 0):
//     o texto dizia "a causa NÃO é venda 0 — é o ticket MANUAL", quando a
//     causa É venda 0 e o ticket é irrelevante (qualquer ticket × 0 pagantes
//     fecha em R$ 0,00).
//   - ajuste de -50% com todos os lotes em quantidade 0: mesmo erro, mesma
//     frase falsa.
//
// A regra: nunca negar "venda 0" sem checar a venda real. `cen.pagos` é a
// MESMA contagem que `calc.js` usa (bilheteria() soma qtd por lote, exceto
// cortesia — linha ~90) — nenhuma recontagem paralela aqui. Com `pagos <= 0`
// a venda real é zero: essa passa a ser a causa citada, e cada flag ativa
// (ticket manual, ajuste, lote negativo) vira OBSERVAÇÃO — nunca causa,
// porque nenhuma delas muda nada quando não há pagante. Só com `pagos > 0`
// a negativa "NÃO é venda 0" continua sendo dita, porque aí ela foi
// verificada e é verdadeira.
function causasBrutaZero(cen) {
  const causas = []
  const pagos = num(cen.pagos)
  const vendaReal = pagos > 0
  const porTicketManual = cen.ticketMedioManual === true
  const porAjuste = num(cen.ticketAjustePct) !== 0
  const loteNegativo = cen.porLote.find((l) => num(l.receita) < 0)

  if (porTicketManual) {
    causas.push(
      vendaReal
        ? 'Nenhuma linha de "Ingressos" para exportar: a causa NÃO é venda 0 nem preço R$ 0 — é o ticket médio MANUAL do cenário realista (com o ajuste do cenário, se houver) fechando em R$ 0,00. Confira o ticket manual na aba Receita.'
        : 'Nenhuma linha de "Ingressos" para exportar: a causa é venda 0 — nenhum ingresso pago no cenário realista (confira os lotes na aba Receita). Há um ticket médio MANUAL configurado, mas ele não é a causa: qualquer ticket vezes 0 ingressos pagos fecha em R$ 0,00.'
    )
  }
  if (porAjuste) {
    causas.push(
      vendaReal
        ? `Nenhuma linha de "Ingressos" para exportar: a causa NÃO é venda 0 nem preço R$ 0 — é o ajuste de ticket de ${num(cen.ticketAjustePct)}% do cenário realista, que pode estar zerando uma venda real (confira os lotes na aba Receita).`
        : `Nenhuma linha de "Ingressos" para exportar: a causa é venda 0 — nenhum ingresso pago no cenário realista (confira os lotes na aba Receita). Há um ajuste de ticket de ${num(cen.ticketAjustePct)}% configurado, mas ele não é a causa: qualquer ajuste sobre 0 ingressos pagos fecha em R$ 0,00.`
    )
  }
  if (loteNegativo) {
    causas.push(
      vendaReal
        ? `Nenhuma linha de "Ingressos" para exportar: a causa NÃO é venda 0 nem preço R$ 0 — há lote com receita NEGATIVA na aba Receita (${fmtBRL(loteNegativo.receita)}) que cancela exatamente o(s) lote(s) positivo(s), fechando o total em R$ 0,00.`
        : `Nenhuma linha de "Ingressos" para exportar: a causa é venda 0 — nenhum ingresso pago no cenário realista (confira os lotes na aba Receita). Há lote com receita NEGATIVA (${fmtBRL(loteNegativo.receita)}), mas ele não é a causa: sem ingresso pago, não há o que cancelar.`
    )
  }
  return causas
}

// CAUSA E AÇÃO ANDAVAM JUNTAS aqui até 25/07/2026, porque cada causa
// (ticket manual, ajuste de ticket, lote negativo) travava a exportação e
// exigia uma ação para destravar. Com a linha única elas deixam de travar
// qualquer coisa — o arquivo já saiu, com o número certo, em `emitirIngressos`
// acima — então a AÇÃO que existia aqui ("tire o ticket manual", "tire o
// ajuste", "tire o lote negativo") deixou de fazer sentido: segui-la mudaria
// o número da TELA para nada, e essa não é mais uma correção, é uma
// instrução para produzir um número diferente do real. Por isso ela foi
// REMOVIDA, não adaptada — decisão registrada no retorno desta sessão para
// o Marco conferir. O que fica é só o motivo, para a linha não parecer uma
// conta simples de "lotes × preço" quando não é.
//
// Duas correções de TEXTO em 26/07/2026 (achados do provador adversarial —
// o valor exportado já estava certo nos dois casos, só a explicação mentia):
//
// (1) ticket manual e ajuste % NÃO são excludentes — calc.js (por volta da
//     linha 396) é explícito: "o ajuste % do cenário age por cima nos dois
//     casos". Um evento com ticket manual R$ 200 e ajuste +15% ao mesmo
//     tempo gera cen.bruta com as DUAS causas dentro, mas o `if/else if` de
//     antes só deixava a primeira falar. Agora cada causa ativa é avaliada e
//     narrada por conta própria — nenhuma cala a outra.
//
// (2) o aviso do lote negativo descrevia sempre o caminho AUTOMÁTICO ("a
//     linha já soma esse valor negativo"), mesmo quando o ticket manual está
//     ligado — e nesse caminho o cálculo IGNORA os lotes (usa pagos ×
//     ticket digitado; ver calc.js linha ~401). Com ticket manual ativo o
//     lote negativo não entra na conta nenhuma, e o texto agora diz isso.
//     O ajuste % sozinho (sem ticket manual) continua no caminho automático
//     — a base do ajuste é o ticket médio dos LOTES (bil.ticketMedio), que
//     já carrega o lote negativo por dentro — então a frase de sempre
//     continua verdadeira nesse caso.
function avisosInformativosIngressos(cen) {
  const avisos = []
  const porTicketManual = cen.ticketMedioManual === true
  const porAjuste = num(cen.ticketAjustePct) !== 0
  const temLoteNegativo = cen.porLote.some((l) => num(l.receita) < 0)

  if (porTicketManual) {
    avisos.push(
      `A linha "Ingressos (bilheteria)" (${fmtBRL(cen.bruta)}) usa o ticket médio MANUAL do cenário realista, não a mistura de preços dos lotes — é o mesmo valor que a tela mostra, mas pode diferir do que você vê somando os lotes na aba Receita.`
    )
  }
  if (porAjuste) {
    avisos.push(
      `A linha "Ingressos (bilheteria)" (${fmtBRL(cen.bruta)}) já inclui o ajuste de ticket de ${num(cen.ticketAjustePct)}% do cenário realista — é o mesmo valor que a tela mostra, mas pode diferir do que você vê somando os lotes na aba Receita.`
    )
  }
  if (temLoteNegativo) {
    avisos.push(
      porTicketManual
        ? `Há lote com receita NEGATIVA na aba Receita (um desconto ou abatimento lançado como lote) — mas a linha "Ingressos (bilheteria)" (${fmtBRL(cen.bruta)}) veio do ticket médio MANUAL (pagos × ticket digitado), não da soma dos lotes: esse lote negativo NÃO entrou nesta conta.`
        : `Há lote com receita NEGATIVA na aba Receita (um desconto ou abatimento lançado como lote) — a linha "Ingressos (bilheteria)" (${fmtBRL(cen.bruta)}) já soma esse valor negativo: o total exportado é o líquido dele, igual ao que a tela mostra.`
    )
  }
  return avisos
}

// ————— Declaração: taxa da Tiqueteira e cashback (S2-a, 20/07/2026) —————
//
// A tela mostra a bilheteria LÍQUIDA (bruta − taxa + cashback); este arquivo
// publica a BRUTA. Isso é anterior a esta sessão e não muda aqui — o que sai
// no arquivo é decisão do Marco. O que muda é o silêncio: as duas grandezas
// passam a ter nome e valor em R$ na tela de exportação, para o rodapé poder
// dizer "está no arquivo, ou está explicado acima" sem mentir.
//
// A taxa só é declarada quando ela de fato sai do bolso da produção: no modo
// "taxa paga pelo CLIENTE" (sugestão 29b) ela não desconta da receita, então
// não há diferença nenhuma a explicar.
function declararTaxaECashback(E, evento, cen) {
  const taxa = num(cen.taxa)
  const cashback = num(cen.cashback)
  if (!isTaxaCliente(evento) && Math.abs(taxa) >= TOLERANCIA_CONFERENCIA) {
    E.declararFora({
      id: 'taxa-bilheteria',
      rotulo: `Taxa da Tiqueteira (${num(evento.taxaBilheteria)}% da bilheteria)`,
      valor: -taxa,
      explicacao:
        'A tela desconta a taxa da receita; este arquivo leva a bilheteria BRUTA, que é o que o Financeiro espera receber como previsão de ingressos. A taxa entra lá como despesa da Tiqueteira, pelo lançamento de vocês.',
    })
  }
  if (Math.abs(cashback) >= TOLERANCIA_CONFERENCIA) {
    E.declararFora({
      id: 'cashback',
      rotulo: `Cashback da Tiqueteira (${num(evento.cashbackPct)}% da bilheteria)`,
      valor: cashback,
      explicacao:
        'A tela soma o cashback à receita; este arquivo não leva linha de cashback — ele é dinheiro que a Tiqueteira devolve depois, e entra no Financeiro quando cair, não como previsão de ingressos.',
    })
  }
}

// ————— Bloco: bar —————
//
// PONTO 5 do diagnóstico arquitetural (medido em 20/07/2026). O código antigo
// empurrava a linha direto para a lista sob um `if (cen.bar > 0)`, sem
// conferência nenhuma (a chamada crua está proibida por teste de fonte,
// então nem citada aqui ela pode ser): bar com
// receita <= 0 sumia do arquivo sem uma palavra. E o caso NÃO exige digitar
// número negativo: bar no modo POR PESSOA com ticket R$ 40, 100 pessoas e
// R$ 8.000 de custo de sistema dá líquido −R$ 4.000 — a tela mostrava
// R$ 5.500 de receita total e o arquivo levava R$ 10.000, com 0 alerta.
//
// Bar = 0 (open bar, campo vazio): referência 0, zero linhas, soma 0 →
// CONFERE, silêncio total. Nenhum ruído no caso normal.
function emitirBar(E, evento, cen) {
  const linhas =
    num(cen.bar) > 0
      ? [
          {
            id: `${evento.id}:bar:1`,
            grupo: 'receita',
            categoria: CATEGORIA_FIN_BAR,
            rotulo: 'Bar / Consumo',
            descricao: 'Receita de bar (estimada)',
            valor: cen.bar,
          },
        ]
      : []

  E.emitir({
    bloco: 'bar',
    rotulo: 'Bar / Consumo',
    linhas,
    referencia: cen.bar,
    aoDivergir: ({ referencia }) => {
      const porPessoa = isBarPorPessoa(evento) && !isOpenBar(evento)
      return (
        `A receita de BAR ficou de fora deste arquivo, de propósito: a previsão mostra ${fmtBRL(referencia)} de bar no cenário realista, ` +
        'e valor negativo não vira linha de receita no Financeiro — exportar assim mandaria para lá mais receita do que você vê na tela. ' +
        (porPessoa
          ? 'O bar deste evento está no modo POR PESSOA: o líquido é o consumo (ticket × público) menos a taxa e o custo do sistema, e aqui o custo do sistema ficou maior que o consumo previsto. ' +
            'O que fazer: na aba Receita, confira o ticket do bar do cenário realista e o custo do sistema; se o custo do sistema é despesa mesmo, tire-o dali e lance-o como um custo na aba Custos (categoria A&B) — aí ele sai no arquivo como despesa, que é o que ele é.'
          : 'O que fazer: na aba Receita, tire o valor negativo do bar; se o que você quis registrar foi uma despesa (aluguel de sistema, permuta), lance-a como custo na aba Custos — aí ela sai no arquivo como despesa, que é o que ela é.')
      )
    },
  })
}

// ————— Bloco: patrocínio —————
//
// PONTO 8 do diagnóstico (medido em 20/07/2026): dois patrocínios confirmados,
// R$ 5.000 e −R$ 6.000, dão fechado −R$ 1.000 — a tela mostrava o negativo e a
// linha simplesmente não existia no arquivo, calada.
//
// Desde a Sessão O (sugestão 22), cen.patrocinio é só o FECHADO
// (confirmado/recebido) — o plano publica o que conta na receita; propostas
// (potencial) ficam de fora de propósito.
function emitirPatrocinio(E, evento, cen) {
  const linhas =
    num(cen.patrocinio) > 0
      ? [
          {
            id: `${evento.id}:patrocinio:1`,
            grupo: 'receita',
            categoria: CATEGORIA_FIN_PATROCINIO,
            rotulo: 'Patrocínio',
            descricao: 'Patrocínio (fechado)',
            valor: cen.patrocinio,
          },
        ]
      : []

  E.emitir({
    bloco: 'patrocinio',
    rotulo: 'Patrocínio (fechado)',
    linhas,
    referencia: cen.patrocinio,
    aoDivergir: ({ referencia }) =>
      `O PATROCÍNIO ficou de fora deste arquivo, de propósito: somados, os patrocínios confirmados deste evento dão ${fmtBRL(referencia)} — ` +
      'ou seja, o abatimento lançado como patrocínio é maior que o patrocínio fechado, e valor negativo não vira linha de receita no Financeiro. ' +
      'O que fazer: na aba Receita, olhe a lista de patrocínios e ache o de valor negativo. Se ele é um abatimento (permuta, desconto dado ao patrocinador), ' +
      'registre-o no CUSTO a que pertence em vez de como patrocínio negativo, e exporte de novo; se o valor negativo estiver errado, corrija-o ali mesmo.',
  })
}

// ————— Bloco: custos —————

/**
 * O custo tem parcelas CRIADAS mas NENHUMA com valor preenchido?
 *
 * DECISÃO 1 DO MARCO (20/07/2026) — "mandar os R$ 8.000 e avisar que a data é
 * provisória". Contexto medido: DJ estimado 8.000 com 2 parcelas em branco e
 * contingência de 5% — a tela mostrava custoTotal R$ 8.400 e o arquivo levava
 * R$ 400 (só a contingência, calculada sobre um custo que não estava no
 * arquivo), com `alertas: []` e `avisos: []`. Parcela nasce com `valor: ''`
 * (parcelas.js/novaParcela), então este era o caso MAIS COMUM, não uma borda.
 *
 * A RÉGUA É `num(p.valor) === 0` PARA TODAS — o que engloba parcela em branco
 * E parcela zerada à mão. Escolha minha, não do Marco; vai registrada no
 * BACKLOG como pergunta em aberto. O motivo: a alternativa estreita (só
 * `String(valor).trim() === ''`) deixa de pé exatamente o S1 que esta sessão
 * veio matar — com `[0, 0]` digitados e estimado 8.000, a tela mostra 8.000 (o
 * considerado ignora parcelas) e o arquivo levaria 0, calado. A régua ampla
 * nunca produz silêncio: no pior caso produz um aviso nomeando o custo.
 */
export const agendaEmBranco = (it) => temParcelas(it) && it.parcelas.every((p) => num(p?.valor) === 0)

/**
 * O que o arquivo se propõe a publicar para ESTE custo — a referência contra a
 * qual as linhas dele são conferidas.
 *
 * - 'parcelas'       → a soma das parcelas (a agenda combinada). Caso VIZINHO
 *                      da Decisão 1, que o Marco NÃO decidiu: parcelas
 *                      parcialmente preenchidas seguem exatamente como antes,
 *                      com o aviso que já existia sobre a soma diferir do
 *                      estimado.
 * - 'agendaEmBranco' → o ESTIMADO (Decisão 1). Antes disto a referência vinha
 *                      da soma do próprio conjunto emitido (0), e a conferência
 *                      aprovava a própria omissão.
 * - 'estimado'       → o orçamento, como sempre.
 */
export function referenciaDoCusto(it) {
  if (agendaEmBranco(it)) return { referencia: num(it.estimado), modo: 'agendaEmBranco' }
  if (temParcelas(it)) return { referencia: somaParcelas(it), modo: 'parcelas' }
  return { referencia: num(it.estimado), modo: 'estimado' }
}

// — Custos: cada item com estimado > 0, mapeado por categoria. Usa o
// ESTIMADO (o orçamento), não o "considerado" (que prioriza realizado) —
// o plano publica PREVISTOS; o realizado já entra no Financeiro por conta
// própria (lançamento direto ou pela ponte 1, sugestão 11).
// Sessão F2-C: custo PARCELADO vira UMA LINHA POR PARCELA (id_linha por
// parcela — estável: uid do item + uid da parcela; formato v1 inalterado,
// o importador de lá já entende N previstos com N datas), cada uma com a
// data da parcela em data_lancamento; custo com data única de pagamento
// preenche data_lancamento (o campo do contrato para "custos que vencem
// antes da festa"). Sem data → vazio = data do evento, como sempre. —
//
// A conferência é POR ITEM de propósito: assim a mensagem nomeia o custo
// culpado, e um item errado não pode ser compensado por outro errado ao
// contrário numa soma global.
function emitirCustos(E, evento, cen) {
  const categoriasCustom = new Set()
  let algumItem = false

  for (const catg of evento.categorias || []) {
    const destino = categoriaFinanceiroCusto(catg.id)
    if (destino === CATEGORIA_FIN_OUTRAS_DESPESAS && catg.id !== 'marketing' && catg.id !== 'extras') {
      categoriasCustom.add(catg.nome)
    }
    for (const it of catg.itens || []) {
      algumItem = true
      const nomeItem = it.servico || catg.nome

      // CUSTOU ZERO (Marco, 07/10/2026, por questionário — ficha S2 do BACKLOG):
      // a tela conta R$ 0 (valorConsiderado) e o arquivo mandava o ESTIMADO,
      // calado — uma permuta de R$ 8.000 virava despesa prevista no Financeiro
      // que nenhum pagamento ia baixar. Agora a linha NÃO vai, e o custo é
      // nomeado em "Fora deste arquivo" com os dois números. O bloco confere
      // em zero (a tela conta zero, o arquivo leva zero).
      if (custouZeroEfetivo(it)) {
        E.declararFora({
          id: `custou-zero:${it.id}`,
          rotulo: `${nomeItem} (custou zero)`,
          valor: 0,
          explicacao: `Marcado como custou zero: R$ 0 na aba Custos (estimado ${fmtBRL(num(it.estimado))}). Não vai para o Financeiro como despesa prevista. Se um plano anterior já levou esta linha, ao importar este no Financeiro a prévia a lista como linha que o plano não produz mais — marque-a lá para removê-la.`,
        })
        E.emitir({ bloco: `custos:${it.id}`, rotulo: nomeItem, linhas: [], referencia: 0, aoDivergir: () => '' })
        continue
      }

      const { referencia, modo } = referenciaDoCusto(it)
      const linhas = []

      if (modo === 'parcelas') {
        const n = it.parcelas.length
        if (referencia > 0 && Math.abs(referencia - num(it.estimado)) >= TOLERANCIA_CONFERENCIA) {
          E.avisar(
            `As parcelas de "${nomeItem}" somam ${fmtBRL(referencia)}, diferente do estimado ${fmtBRL(num(it.estimado))} — o arquivo leva as parcelas (a agenda combinada de pagamento). Ajuste na aba Custos se não for isso.`
          )
        }
        it.parcelas.forEach((p, idx) => {
          const valor = num(p.valor)
          if (valor <= 0) return
          linhas.push({
            id: `${evento.id}:${catg.id}:${it.id}:${p.id}`,
            grupo: 'custo',
            categoria: destino,
            rotulo: `${nomeItem} · parcela ${idx + 1}/${n}`,
            descricao: `${it.servico || `${catg.nome} (previsto)`} · parcela ${idx + 1}/${n}`,
            valor,
            dataLancamento: p.data || '',
          })
        })
      } else {
        // 'estimado' e 'agendaEmBranco' saem IGUAIS no arquivo: uma linha só,
        // com o id do item (sem parcela). É essa igualdade que faz a Decisão 1
        // ser barata — nada de id novo, nada de formato novo do lado de lá.
        if (referencia > 0) {
          linhas.push({
            id: `${evento.id}:${catg.id}:${it.id}`,
            grupo: 'custo',
            categoria: destino,
            rotulo: nomeItem,
            descricao: it.servico || `${catg.nome} (previsto)`,
            valor: referencia,
            dataLancamento: it.dataPagamento || '',
          })
        }
        if (modo === 'agendaEmBranco' && referencia > 0) E.avisar(avisoAgendaEmBranco(it, nomeItem, referencia))
      }

      // S2-b (20/07/2026): custo com estimado VAZIO e realizado preenchido
      // some do arquivo, some da tabela da tela, e a conferência aprovava a
      // própria omissão (referência 0, emitido 0, ok true). Medido: Gelo com
      // realizado 5.000 e contingência 5% → tela R$ 5.250, arquivo R$ 250,
      // zero alerta. O que sai no arquivo NÃO muda (o arquivo leva o
      // previsto — decisão do Marco); o que muda é que o caso deixa de ser
      // silencioso: a referência do bloco passa a ser o valor que a tela
      // mostra, o bloco não fecha, e a linha aparece na tabela.
      const soRealizado = Math.abs(referencia) < TOLERANCIA_CONFERENCIA && temRealizado(it)
      const realizado = num(it.realizado)

      E.emitir({
        bloco: `custos:${it.id}`,
        rotulo: nomeItem,
        linhas,
        referencia: soRealizado ? realizado : referencia,
        aoDivergir: ({ referencia: ref, somaEmitida }) =>
          soRealizado
            ? divergenciaCustoSoRealizado(nomeItem, ref)
            : divergenciaCusto(nomeItem, modo, ref, somaEmitida),
      })
    }
  }

  // Evento sem NENHUM item de custo ainda precisa conferir o bloco: zero
  // custos, zero linhas, referência 0 → confere. Sem isto, `selar()` acusaria
  // ausência num evento perfeitamente saudável — alarme falso ensina a ignorar
  // o alarme, e este guarda existe justamente para não ser ignorado.
  if (!algumItem) E.emitir({ bloco: 'custos', rotulo: 'Custos', linhas: [], referencia: 0, aoDivergir: () => '' })

  for (const nome of categoriasCustom) {
    E.avisar(
      `A categoria "${nome}" é própria deste evento e não tem par exato no Financeiro — os itens dela entram como "${CATEGORIA_FIN_OUTRAS_DESPESAS}". Recategorize lá se quiser separar.`
    )
  }
}

// DECISÃO 1 DO MARCO (20/07/2026), o aviso obrigatório que veio junto dela.
// Canal AMARELO, não vermelho: nada ficou de fora do arquivo — o dinheiro está
// lá. O que é provisório é a DATA, e o Marco aceitou esse preço de olhos
// abertos ("mandar os R$ 8.000 e avisar que a data é provisória"). Por isso o
// aviso é obrigatório e tem de dizer isso com todas as letras, nomeando o custo.
//
// S3-b (20/07/2026): a RÉGUA estava certa (é a decisão do Marco); o TEXTO não
// acompanhava a régua. Ele negava uma agenda que o Marco tinha preenchido pela
// metade — com parcelas sem valor mas COM datas (10/07 e 10/08) o aviso dizia
// "a agenda de pagamento ainda não existe" e "a DATA dessa linha é um chute do
// app: saiu vazia", descartando as duas datas sem uma palavra. E o MESMO texto
// saía para parcelas com 0 digitado à mão — aí a ação errava o alvo: quem
// digitou 0 de propósito não fica sabendo que o app lê 0 como "ainda não sei",
// e "preencha os valores" não é a ação de quem já preencheu.
function avisoAgendaEmBranco(it, nomeItem, estimado) {
  const parcelas = it.parcelas
  const n = parcelas.length
  const plural = n === 1 ? 'parcela criada' : 'parcelas criadas'
  const zeros = parcelas.filter((p) => String(p?.valor ?? '').trim() !== '').length
  const datas = parcelas.map((p) => p?.data).filter(Boolean)
  const temData = Boolean(it.dataPagamento)

  const abertura =
    zeros === 0
      ? `"${nomeItem}" tem ${n} ${plural} e nenhuma com valor preenchido — a agenda de pagamento ainda não existe.`
      : zeros === n
        ? `"${nomeItem}" tem ${n} ${plural}, todas com valor 0 — e o app lê 0 como "ainda não sei", não como "esta parcela não custa nada". Ou seja: a agenda de pagamento ainda não tem dinheiro nenhum distribuído.`
        : `"${nomeItem}" tem ${n} ${plural}: ${zeros} com 0 digitado e ${n - zeros} em branco — e o app lê 0 como "ainda não sei", igual a vazio. Ou seja: a agenda de pagamento ainda não tem dinheiro nenhum distribuído.`

  const destinoDaData = temData
    ? `a data de pagamento do custo (${fmtData(it.dataPagamento)}), que não é uma data que você combinou parcela a parcela.`
    : 'vazia, então o Financeiro vai lançar na data do evento.'

  const linhaData =
    datas.length > 0
      ? ` ${datas.length === 1 ? 'A data que você preencheu na parcela' : `As datas que você preencheu nas parcelas`} (${datas
          .map(fmtData)
          .join(', ')}) NÃO vão para o arquivo: sem valor, não há parcela para agendar. A data desta linha única é ${destinoDaData}`
      : ` A DATA dessa linha é um chute do app: saiu ${destinoDaData}`

  const acao =
    zeros > 0
      ? ` O que fazer: se essas parcelas existem mesmo, preencha os valores delas na aba Custos e exporte de novo. Se você digitou 0 para dizer "esta parcela não existe", APAGUE a parcela em vez de zerá-la — zerada, ela conta como não preenchida.`
      : ' O que fazer: se a agenda importa para o caixa, preencha os valores das parcelas na aba Custos e exporte de novo.'

  return (
    abertura +
    ` O arquivo leva o estimado (${fmtBRL(estimado)}) numa linha só, como se não houvesse parcelamento.` +
    linhaData +
    acao
  )
}

// A AÇÃO NÃO PODE SER IMPOSSÍVEL. Quando o próprio total do item é
// negativo, "lance à mão pelo valor da aba Custos" mandava o Marco
// registrar uma despesa de −R$ 3.000 — exatamente o que a frase
// anterior acabou de declarar que o Financeiro não aceita.
// S2-b: o custo existe na tela (com realizado), não tem orçamento, e por isso
// não tem NENHUMA linha no arquivo. Nada está errado no arquivo — mas é
// dinheiro que o Marco vê na tela e que o Financeiro não recebe por aqui, e
// isso não pode passar calado. Causa e ação juntas, e as duas ações possíveis.
function divergenciaCustoSoRealizado(nomeItem, realizado) {
  return (
    `O custo "${nomeItem}" aparece na aba Custos por ${fmtBRL(realizado)} — o valor REALIZADO —, e nenhuma linha dele entrou neste arquivo: ele não tem valor estimado, ` +
    'e este arquivo leva o PREVISTO (o orçamento), nunca o realizado. Não é erro do arquivo, mas é dinheiro que você vê na tela e que o Financeiro NÃO vai receber por ele. ' +
    `O que fazer: se esse gasto já foi pago, lance-o no Financeiro por lá, como qualquer despesa realizada — é o caminho normal, e assim ele não conta em dobro. ` +
    `Se ele deveria estar no orçamento deste evento, preencha o Estimado de "${nomeItem}" na aba Custos e exporte de novo.`
  )
}

function divergenciaCusto(nomeItem, modo, referencia, somaEmitida) {
  return (
    `O custo "${nomeItem}" ficou de fora deste arquivo, de propósito: ${
      modo === 'parcelas'
        ? `as parcelas dele somam ${fmtBRL(referencia)}`
        : `a aba Custos mostra ${fmtBRL(referencia)} previsto para ele`
    }, mas as linhas que iriam para o arquivo somam ${fmtBRL(somaEmitida)} — a diferença é valor NEGATIVO (desconto), que não vira linha de despesa no Financeiro. ` +
    'Exportar assim mandaria para lá mais dinheiro do que você vê na tela. ' +
    (referencia < 0
      ? 'Como o total deste item é negativo, ele é um abatimento, não uma despesa: registre o desconto direto no Financeiro do jeito que vocês fazem, ou embuta o abatimento no custo a que ele pertence e exporte de novo.'
      : 'Lance esse custo à mão no Financeiro pelo valor da aba Custos, ou tire o valor negativo e exporte de novo.')
  )
}

// ————— Bloco: contingência —————
//
// PONTO 7 do diagnóstico (medido em 20/07/2026): contingência de −10% sobre um
// custo de R$ 500 dá −R$ 50; a tela mostrava custoTotal R$ 450 e o arquivo
// levava R$ 500, calado. `if (cen.contingencia > 0)` sem conferência nenhuma.
//
// Contingência 0 (o caso de quem desligou): referência 0, zero linhas → confere,
// silêncio total.
function emitirContingencia(E, evento, cen) {
  const pct = num(evento.contingenciaPct)
  const linhas =
    num(cen.contingencia) > 0
      ? [
          {
            id: `${evento.id}:contingencia:1`,
            grupo: 'custo',
            categoria: CATEGORIA_FIN_OUTRAS_DESPESAS,
            rotulo: `Contingência (${pct}%)`,
            descricao: `Contingência (${pct}%)`,
            valor: cen.contingencia,
          },
        ]
      : []

  E.emitir({
    bloco: 'contingencia',
    rotulo: `Contingência (${pct}%)`,
    linhas,
    referencia: cen.contingencia,
    aoDivergir: ({ referencia }) =>
      `A CONTINGÊNCIA ficou de fora deste arquivo, de propósito: ela está em ${pctComSinal(pct)} e vale ${fmtBRL(referencia)} no cenário realista — ` +
      'ou seja, é um ABATIMENTO do custo, não uma reserva, e valor negativo não vira linha de despesa no Financeiro. ' +
      'Os demais custos deste evento continuam saindo normalmente; só esta linha ficou de fora. ' +
      'O que fazer: na aba Custos, coloque a contingência em 0% ou mais. Se a sua intenção era abater um valor do orçamento (desconto fechado com fornecedor), ' +
      'registre o abatimento dentro do custo a que ele pertence — assim ele aparece na tela e no arquivo pelo mesmo número.',
  })
}

// ————— Aviso: evento que já tem realizado —————
//
// O comportamento (publicar o ESTIMADO) está certo por desenho, mas era uma
// surpresa: o Marco exportou um evento 99% pago e só descobriu abrindo o CSV
// que os números não eram os da tela (Bebidas: R$ 14.872 de realizado na tela,
// R$ 28.050 no arquivo). Nada estava errado — nada AVISAVA. Aqui não se muda o
// que sai; deixa-se de ser silencioso. Canal `avisos` (amarelo) de propósito.
//
// "Preenchido" segue a MESMA régua de valorConsiderado() em calc.js — hoje,
// realizado > 0 —, e pela MESMA função que as telas usam (`temRealizado`),
// em vez de uma quarta cópia do filtro. (Que 0 não conte como preenchido é
// achado registrado no BACKLOG, aguardando aval do Marco.)
//
// O AVISO PRECISOU FICAR MAIS COMPRIDO PARA FICAR VERDADEIRO (S2 da
// verificação adversarial, 20/07/2026): a versão anterior jurava que "este
// arquivo NÃO leva esses valores", o que é falso para a linha de CONTINGÊNCIA
// (pct × custo CONSIDERADO, e "considerado" prioriza o realizado). Um aviso que
// mente é pior que aviso nenhum: o Marco confere o CSV contra ele.
function avisarRealizado(E, evento, cen) {
  // O custo marcado "custou zero" é declarado à parte (fora do arquivo); contá-lo
  // aqui como "realizado de R$ 0" e dizer que a linha leva o previsto seria falso.
  const comRealizado = (evento.categorias || [])
    .flatMap((c) => c.itens || [])
    .filter((it) => temRealizado(it) && !custouZeroEfetivo(it))
  if (comRealizado.length === 0) return
  const n = comRealizado.length
  const somaReal = comRealizado.reduce((s, it) => s + num(it.realizado), 0)
  E.avisar(
    `${n} ${n === 1 ? 'item de custo já tem' : 'itens de custo já têm'} realizado preenchido (${fmtBRL(somaReal)} no total), e as LINHAS DE CUSTO deste arquivo não levam esses valores: elas levam o PREVISTO (o orçamento), de propósito. ` +
      'O que já foi pago entra no Financeiro pelos lançamentos de lá — se o arquivo levasse os dois, a mesma despesa contaria em dobro. ' +
      'Por isso as linhas abaixo podem mostrar valor diferente do que você vê na aba Custos.' +
      (cen.contingencia > 0
        ? ` Uma exceção, para você não se surpreender conferindo: a linha de contingência (${fmtBRL(cen.contingencia)}) é ${num(evento.contingenciaPct)}% sobre o custo CONSIDERADO — que usa o realizado onde ele existe e o estimado no resto, a mesma base da tela. Ela é o único valor do arquivo derivado do realizado.`
        : '')
  )
}

// ————— Aviso: o ajuste de custo do cenário (DECISÃO 2 DO MARCO) —————
//
// DECISÃO 2 DO MARCO (20/07/2026) — "orçamento cru + aviso".
//
// O cenário realista pode aplicar um ajuste percentual sobre os custos
// (`custoPct`, default 0). A tela mostra o custo JÁ ajustado; este arquivo
// publica o CRU — o estimado de cada custo e a contingência, sem o ajuste.
//
// A razão, na palavra do Marco: "o arquivo é a lista do que você combinou
// pagar. Você combinou R$ 8.000 com o DJ. Não existe nota fiscal de R$ 8.800.
// O +10% é uma pergunta ('e se estourar?'), não um compromisso — ele pertence
// à tela, não ao arquivo."
//
// O que se conserta aqui é o SILÊNCIO, não o número. Contexto medido: com
// custoPct +10%, DJ 8.000 e contingência 5%, a tela mostrava R$ 9.240 e o
// arquivo levava R$ 8.400, calado; com −20%, tela R$ 6.720 e arquivo R$ 8.400
// — ou seja, o arquivo mandava MAIS dinheiro que a tela. Nos dois sentidos,
// sem uma palavra. O aviso vale nos DOIS sentidos e só existe quando o ajuste
// é diferente de 0 (no default não há nada a dizer).
//
// NENHUMA REFERÊNCIA DE BLOCO MUDA por causa disto: todos os blocos de custo e
// a contingência continuam conferindo contra o cru, que é o que o arquivo
// publica. É isso que faz a Decisão 2 ser verificável como "CSV idêntico + um
// aviso" — e é o que as fotografias provam.
//
// ————— A CORREÇÃO DE 20/07/2026 (S1 e S4 da verificação adversarial) —————
//
// O "cru" era recalculado da FONTE: `cen.custoItens + cen.contingencia`. Mas
// `cen.custoItens` é o totalConsiderado — que PRIORIZA O REALIZADO e IGNORA
// PARCELAS —, enquanto o arquivo emite o ESTIMADO (ou as parcelas, ou NADA
// quando o bloco foi rejeitado). Conferia um conjunto e afirmava outro: a
// assinatura exata que o emissor extinguiu no resto do módulo, reaparecida
// dentro de um texto. Medido: DJ 8.000/realizado 20.000 + Gelo 500, +10% → o
// aviso afirmava "somam R$ 21.525" e "R$ 2.153 a MENOS" quando o arquivo tinha
// R$ 9.525 e a diferença real era R$ 14.152,50; com parcelas, a DIREÇÃO saía
// invertida ("manda MAIS R$ 1.785" quando mandava R$ 215 a MENOS).
//
// Agora o número vem de `E.totalEmitido('custo')` — a soma das linhas que
// REALMENTE entraram — e a direção vem do SINAL dessa diferença, não do sinal
// do percentual. Como a diferença deixou de ser só o ajuste (ela agora inclui
// realizado e blocos rejeitados), o texto diz isso com todas as letras em vez
// de atribuir tudo ao ajuste.
//
// S4: o portão passou a ser a diferença em REAIS. Com custoPct 0,0001 o aviso
// disparava para anunciar "R$ 0 a MENOS" — alarme que não descreve nada ensina
// a ignorar o alarme. Abaixo de meio real o arquivo e a tela dizem o mesmo
// número arredondado, e não há divergência a explicar.
export const LIMIAR_EFEITO_EM_REAIS = 0.5

function avisarAjusteDeCustoDoCenario(E, cen) {
  const pct = num(cen.ajustePct)
  if (pct === 0) return
  const noArquivo = E.totalEmitido('custo')
  const naTela = num(cen.custoTotal)
  const diferenca = noArquivo - naTela
  if (Math.abs(diferenca) < LIMIAR_EFEITO_EM_REAIS) return
  E.avisar(
    `O cenário realista está aplicando ${pctComSinal(pct)} de ajuste nos custos, e este arquivo não carrega esse ajuste: ele leva o orçamento cru — ` +
      `o estimado de cada custo e a contingência, do jeito que foram combinados. Na tela, o custo total do realista é ${fmtBRL(naTela)}; as linhas de custo que ENTRARAM neste arquivo somam ${fmtBRL(noArquivo)}. ` +
      'O arquivo é a lista do que você combinou pagar: não existe nota fiscal do ajuste. O "e se estourar?" é uma pergunta da tela, não um compromisso com fornecedor. ' +
      (diferenca < 0
        ? `Efeito prático, somando TUDO o que separa a tela deste arquivo (este ajuste e, quando houver, o realizado já preenchido e os blocos que ficaram de fora acima): o Financeiro vai receber ${fmtBRL(-diferenca)} a MENOS do que a tela mostra.`
        : `Efeito prático, e este merece atenção: somando TUDO o que separa a tela deste arquivo (este ajuste e, quando houver, o realizado já preenchido e os blocos que ficaram de fora acima), o arquivo manda ${fmtBRL(diferenca)} a MAIS do que a tela mostra. ` +
          'Se a economia que você simulou já foi fechada de verdade com o fornecedor, baixe o estimado do custo correspondente na aba Custos e exporte de novo — assim o compromisso vira orçamento e sai no arquivo pelo valor combinado.')
  )
}

/** "+10%" / "−20%" (menos tipográfico, como o resto da UI). */
const pctComSinal = (pct) => `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`

// ————— Geração do arquivo CSV (formato v1, contrato do BACKLOG.md do Financeiro) —————

const CABECALHO = ['id_linha', 'marca', 'evento', 'data_evento', 'categoria', 'descricao', 'valor_previsto', 'data_lancamento']

// Escapa um campo para CSV (RFC 4180 simplificado): aspas quando o campo tem
// vírgula, aspas ou quebra de linha (\n OU \r); aspas internas dobradas.
// O \r entrou em 07/10/2026 (Marco aprovou, ficha S2 do BACKLOG): uma célula de
// planilha com \r solto saía sem aspas e o leitor do Financeiro (csv.reader)
// recusava o plano INTEIRO com "new-line character seen in unquoted field".
function campoCSV(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Blindagem anti-fórmula (Marco, 20/07/2026 — portão C da Camada 3). O Marco às
// vezes ABRE este CSV no Excel antes de importar, então uma descrição começando
// com =,+,@,-,TAB,CR abriria como fórmula viva. Prepende apóstrofo, os MESMOS 6
// gatilhos do backend do Financeiro (exportacoes.py) e do CSV do contador
// (exportPagamentos.js). O importador do Financeiro (plano_previsao.py) TIRA
// esse apóstrofo na leitura (round-trip), para a descrição não entrar suja no
// banco — os dois lados casam (prova em planoFinanceiro.test.js). Blinda ANTES
// do campoCSV, para o escape de aspas não desfazer a blindagem.
function blindarCSV(v) {
  const s = String(v ?? '')
  return /^[=+@\t\r-]/.test(s) ? `'${s}` : s
}

// Número PURO — nunca milhar com ponto isolado ("25.000"), a ambiguidade que
// o contrato do Financeiro proíbe explicitamente. Arredonda a 2 casas para
// não vazar ruído de ponto flutuante; String(Number) do JS nunca insere
// separador de milhar, então o resultado é sempre "25000" ou "25000.5".
//
// A RÉGUA É A DO MOTOR (Marco, 07/10/2026, por questionário — P5 do plano dos
// centavos): `emCentavos`, meio centavo para longe do zero, decidido pelo valor
// de papel. Assim o arquivo grava o mesmo centavo que a tela escreve: até
// 07/10/2026 era `Math.round(v × 100) / 100`, que levava 1,005 a "1" (a tela
// dizia R$ 1,01) e −0,005 a "0". Fora da faixa do centavo exato (absurdo,
// Infinity) o valor segue a conta antiga, para o absurdo sair como saía.
function valorCSV(v) {
  const n = num(v)
  return String(cabeEmCentavos(n) ? emCentavos(n) : Math.round(n * 100) / 100)
}

/**
 * Gera o texto CSV a partir dos itens SELECIONADOS na revisão. `evento` só
 * fornece marca/nome/data (iguais em toda linha) — os itens já trazem tudo o
 * resto. Uma linha de cabeçalho, ordem de colunas fixa (o contrato aceita
 * ordem livre por nome, mas manter fixa facilita conferência visual).
 */
export function gerarCSVPlano(itensSelecionados, evento) {
  const linhas = [CABECALHO.join(',')]
  for (const it of itensSelecionados) {
    linhas.push(
      [
        campoCSV(it.id),
        campoCSV(blindarCSV(evento.tipo)),
        campoCSV(blindarCSV(evento.nome)),
        campoCSV(evento.data),
        campoCSV(blindarCSV(it.categoria)),
        campoCSV(blindarCSV(it.descricao)),
        valorCSV(it.valor),
        // data_lancamento (F2-C): a data de pagamento/parcela do custo,
        // quando existe — o campo que o contrato reservou para custos que
        // vencem antes da festa. Vazio = usa data_evento, como sempre.
        campoCSV(it.dataLancamento || ''),
      ].join(',')
    )
  }
  return linhas.join('\r\n') + '\r\n'
}

const slugArquivo = (s) =>
  String(s || 'evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'evento'

export function nomeArquivoPlano(evento) {
  const data = evento.data || hojeISO()
  return `plano-${slugArquivo(evento.nome)}-${data}.csv`
}

/** Efeito colateral (download) — mesmo padrão de storage.js/exportBackup. */
export function baixarArquivoPlano(csv, nomeArquivo) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(a.href)
}

// Reexport de conveniência para a tela de revisão (mesmos formatadores da
// Ponte 1, para os dois fluxos ficarem visualmente parecidos).
export const fmtValorPlano = (v) => fmtBRL(v)
export const fmtDataPlano = (v) => fmtData(v)
