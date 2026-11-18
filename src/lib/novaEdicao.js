// Duplicar como "nova edição" (Sessão E — sugestão 4 do MELHORIAS.md).
// A próxima edição da festa nasce LIMPA a partir da anterior: nada de
// realizado antigo, status PAGO ou contingência calculada sobre custo velho.
// Função pura: NUNCA muta o evento original (coberto por teste).

import { uid, clone, agora } from './util.js'
import { num } from './util.js'
import { STATUS_CUSTO_PADRAO } from './statusCusto.js'
import { valorConsiderado, custouZeroEfetivo, isBarPorPessoa, isOpenBar } from './calc.js'

export const CENARIOS_BAR = ['pessimista', 'realista', 'otimista']

/**
 * Para onde vai o BAR REALIZADO da edição anterior quando o Marco pede "usar os
 * realizados como novo estimado" (Marco, 27/07/2026 — decisão por questionário,
 * tomada depois de o defeito lhe mostrar uma tela inteira de números errados).
 *
 * O DEFEITO, medido no evento real dele: a edição de 05/07/2024 fechou com
 * R$ 180.000 de bar REALIZADO e cobra bar POR PESSOA (`barModo: 'porPessoa'`).
 * A nova edição gravava esses R$ 180.000 em `outrasReceitas.bar`, que é o campo
 * do bar FIXO — e o `calc.js`, ao ver `barModo` 'porPessoa', lê
 * `barTicket[cenario]` e NUNCA olha aquele campo. R$ 180.000 de previsão
 * entravam nos dados dele e sumiam da conta, sem uma linha de aviso.
 *
 * Agora a conversão é explícita: bar realizado ÷ público da edição anterior =
 * ticket por pessoa, gravado nos TRÊS cenários — nos três de propósito, porque
 * gravar só um foi exatamente o que produziu o cenário pessimista sem bar
 * nenhum. No evento dele dá R$ 180.000 ÷ 1.758 = R$ 102,39.
 *
 * DUAS COISAS QUE ESTE NÚMERO NÃO ESCONDE, ditas aqui para ninguém redescobrir:
 * · R$ 102,39 fica ABAIXO dos R$ 110 que ele vinha digitando à mão, e está
 *   certo: o realizado divide pelo público INTEIRO (cortesia inclusa), enquanto
 *   o ticket digitado é expectativa por cabeça. O que sai é o que aconteceu.
 * · arredondar a centavos deixa um resíduo: 102,39 × 1.758 = R$ 179.981,62,
 *   R$ 18,38 abaixo dos R$ 180.000. É previsão de bar para outra festa, com
 *   outro público — precisão de centavo aqui seria falsa. O resíduo é
 *   declarado, não escondido.
 *
 * SEM PÚBLICO NÃO HÁ CONVERSÃO — e aí o valor vai para `outrasReceitas.bar`,
 * como sempre foi. Esta parte foi ESCRITA DUAS VEZES, e a primeira estava
 * errada: ela não carregava nada, "para não parquear dinheiro num campo morto".
 * Quem derrubou foi um teste que já existia (o do bar 22.500), e ele tinha
 * razão — `barModo: 'porPessoa'` é o PADRÃO de todo evento novo
 * (`defaults.js`) e `publicoEstimado` nasce vazio, então "não carregar" jogaria
 * fora, na maioria dos eventos, um número que o Marco acabou de pedir para
 * carregar. Destruir informação é pior que guardá-la num lugar pouco visível:
 * o número preservado volta a valer no instante em que ele preencher o público
 * ou trocar o modo, e a metade visual da decisão do mesmo dia — o cenário
 * dizendo "bar não informado neste cenário, contado como R$ 0" — é quem tira o
 * silêncio. Um teste verde não prova; um teste VERMELHO provou.
 *
 * MODO FIXO segue idêntico ao de sempre: lá `outrasReceitas.bar` é o campo que
 * o cálculo lê, e nada muda para quem usa esse modo.
 */
export function barDaProximaEdicao(e, usarRealizadoComoEstimado, barRealizado) {
  const barAnterior = e.outrasReceitas?.bar ?? ''
  const semMudanca = { outrasReceitas: { ...e.outrasReceitas, bar: barAnterior } }
  if (!usarRealizadoComoEstimado || !(barRealizado > 0)) return semMudanca
  // Open bar: a receita de bar é 0 em qualquer modo (sugestão 27), então não há
  // para onde levar o realizado — carregá-lo só criaria número morto no dado.
  if (isOpenBar(e)) return semMudanca
  const noCampoFixo = { outrasReceitas: { ...e.outrasReceitas, bar: barRealizado } }
  if (!isBarPorPessoa(e)) return noCampoFixo
  const publico = num(e.publicoEstimado)
  if (!(publico > 0)) return noCampoFixo
  const porPessoa = Math.round((barRealizado / publico) * 100) / 100
  return {
    ...semMudanca,
    barTicket: CENARIOS_BAR.reduce((acc, c) => ({ ...acc, [c]: porPessoa }), {
      ...e.barTicket,
    }),
  }
}

/**
 * Cria a próxima edição de um evento:
 * - todo item de custo volta a ORÇAR, com realizado vazio;
 * - `usarRealizadoComoEstimado`: o novo estimado de cada item vira o
 *   valorConsiderado da edição anterior (realizado quando preenchido, senão o
 *   estimado — "a melhor previsão que existe"); o lucro de bar realizado,
 *   quando informado, vira o novo bar previsto. Sem a opção, os estimados
 *   ficam como estavam;
 * - "custou zero" (P4, Marco 20/07/2026): a marcação NÃO é carregada para a
 *   próxima edição, e um item marcado herda o ORÇAMENTO CHEIO (o estimado
 *   original), nunca o 0 — "de graça uma vez não é de graça para sempre". Por
 *   isso o estimado do item marcado usa `i.estimado`, não o valorConsiderado
 *   (que seria 0);
 * - receita realizada e "vendidos até hoje" zeram; a data fica vazia
 *   (a próxima edição ainda não tem data);
 * - patrocínios (sugestão 22) são mantidos como LEADS: mesmo patrocinador e
 *   valor, mas estágio de volta a 'proposta' — um patrocínio confirmado da
 *   edição passada NÃO está confirmado para a próxima; entra como potencial
 *   visível, nunca somado (mesmo espírito do status ORÇAR dos custos; decisão
 *   da Sessão O registrada no MELHORIAS.md para o Marco revisar);
 * - lotes, cenários, benchmarks ativos, margens e o tipo de festa (sugestão
 *   16 — a próxima edição é da mesma festa) são mantidos.
 */
/**
 * Cópia idêntica (botão "Duplicar" da Home): mesmo evento, identidade nova.
 * ÚNICA exceção à identidade (Parte 2 do fechamento — 20/07/2026): a cópia
 * nasce ABERTA e sem foto, mesmo copiando um evento fechado — o clone
 * carregaria `status: 'fechado'` e a cópia nasceria travada para edição, que
 * é o oposto do que "duplicar para mexer" promete. O original não muda.
 */
export function duplicarCopia(evento, agoraIso = agora()) {
  return {
    ...clone(evento),
    id: uid(),
    nome: `${evento.nome} (cópia)`,
    criadoEm: agoraIso,
    atualizadoEm: agoraIso,
    status: 'aberto',
    fechamento: null,
  }
}

export function duplicarNovaEdicao(evento, { usarRealizadoComoEstimado = false } = {}) {
  const e = clone(evento)
  const ts = agora()
  const barRealizado = num(evento.receitaRealizada?.bar)
  return {
    ...e,
    id: uid(),
    nome: `${evento.nome} (nova edição)`,
    data: '',
    criadoEm: ts,
    atualizadoEm: ts,
    // Fechamento de evento (Parte 2 — 20/07/2026): a nova edição nasce
    // ABERTA e sem foto, SEMPRE — o spread `...e` carregaria o status
    // 'fechado' e a foto da edição anterior, e a próxima edição nasceria
    // travada por acidente, quebrando a promessa do confirm ("nasce limpa").
    status: 'aberto',
    fechamento: null,
    vendidosAteHoje: '',
    receitaRealizada: { bilheteria: '', bar: '' },
    // O bar realizado vai para o campo QUE O EVENTO LÊ — ver barDaProximaEdicao
    // logo abaixo (Marco, 27/07/2026, decisão por questionário).
    ...barDaProximaEdicao(e, usarRealizadoComoEstimado, barRealizado),
    // Evento ainda não migrado (sem a lista): passa intocado — o número solto
    // segue o comportamento antigo; no app real todo evento chega migrado.
    patrocinios: Array.isArray(e.patrocinios)
      ? e.patrocinios.map((p) => ({ ...p, estagio: 'proposta' }))
      : e.patrocinios,
    categorias: (e.categorias || []).map((c) => ({
      ...c,
      itens: (c.itens || []).map((i) => {
        // A marcação "custou zero" (P4) NÃO passa para a próxima edição — e nem
        // a flag realizadoAuto (lote de travas, item 4): a nova edição nasce com
        // realizado '' (abaixo), então a gravação automática da edição anterior
        // não pode viajar junto (a migração re-impõe realizadoAuto:false).
        const { custouZero: _descartada, realizadoAuto: _descartadaAuto, ...resto } = i
        return {
          ...resto,
          // Item marcado herda o orçamento CHEIO (estimado original), não o 0
          // que o valorConsiderado devolveria para ele.
          estimado: usarRealizadoComoEstimado
            ? custouZeroEfetivo(i)
              ? i.estimado
              : valorConsiderado(i)
            : i.estimado,
          realizado: '',
          status: STATUS_CUSTO_PADRAO,
        }
      }),
    })),
  }
}
