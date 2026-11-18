// Para onde vai um "Desfazer" que ficou na tela depois que o mundo mudou
// (Marco, 05/08/2026, por questionário — opção (a): "ele passa a saber de onde
// veio").
//
// ————— o defeito que este módulo existe para consertar —————
//
// O toast do botão "Usar R$ X de bar nos três" vive 6 segundos e traz um
// "Desfazer". Aplicar ou descartar a simulação leva UM clique. Então o botão
// sobrevive de propósito ao fim da simulação, e no instante do clique o lugar
// onde a ação escreveu pode não existir mais.
//
// Até 05/08/2026 o canal era escolhido pelo estado ATUAL da tela: "está
// simulando? escreve no rascunho; não está? escreve no evento". Isso acerta
// dois dos quatro caminhos e erra os outros dois. O erro medido, com a Marfim
// Raiz do Casa Norte (1.582 pessoas no realista, bar por pessoa):
//
//     bar salvo R$ 110/pessoa  →  receita de bar R$ 167.929,30
//     entrar em Simular, arrastar o realista para R$ 250, "usar nos três",
//     DESCARTAR (a tela diz "nada foi salvo no evento"), e então "Desfazer"
//     →  o evento passa a valer bar R$ 250/pessoa: R$ 381.657,50
//     →  R$ 213.728,20 de receita que o Marco tinha jogado fora, salvos e
//        exibidos como certos nos três cartões.
//
// A causa é que o "antes" guardado pelo botão foi lido da VISÃO (o rascunho),
// não do evento salvo — então mandá-lo para o evento depois de um descarte
// grava exatamente o que o descarte prometeu não gravar.
//
// ————— a regra —————
//
// A ação carimba ONDE escreveu (`alvo`) e em QUAL rascunho (`geracao`). O
// desfazer apresenta o carimbo e pergunta para onde ir. As quatro respostas:
//
//     escreveu no EVENTO                       → desfaz no EVENTO (a mudança
//                                                está lá, simulando ou não)
//     escreveu no rascunho, ele AINDA está aberto → desfaz no RASCUNHO
//     escreveu no rascunho, foi APLICADO       → desfaz no EVENTO (o rascunho
//                                                virou o evento; é lá que a
//                                                mudança mora agora)
//     escreveu no rascunho, foi DESCARTADO     → NÃO ESCREVE EM LUGAR NENHUM,
//                                                e a tela diz por quê
//
// A `geracao` existe para o caso de o Marco entrar numa simulação NOVA antes de
// clicar no Desfazer antigo: o rascunho a que aquela ação pertencia não existe
// mais, e escrever num rascunho diferente seria mexer numa hipótese que não é a
// dele. Aí também é lugar nenhum, com a mesma frase.
//
// Módulo PURO — sem React, sem DOM, sem localStorage. Quem tem o estado é o
// EventEditor; aqui só mora a decisão, para que ela possa ser afirmada rodando
// sem montar tela nenhuma.

/** Onde uma escrita caiu, e para onde um desfazer vai. */
export const NO_EVENTO = 'evento'
export const NO_RASCUNHO = 'rascunho'
/** O desfazer não tem para onde ir — e isso é a resposta certa, não uma falha. */
export const EM_LUGAR_NENHUM = 'nada'

/** Como um rascunho terminou. */
export const FIM_APLICADO = 'aplicado'
export const FIM_DESCARTADO = 'descartado'

/**
 * Para onde vai este desfazer?
 *
 * @param marca  o carimbo devolvido pela ação: { alvo, geracao }. Ausente =
 *               a ação não passou pelo canal roteado (a aba Cenários montada
 *               fora do editor, por exemplo) — aí é o evento, como sempre foi.
 * @param agora  { simulando, geracao, fim } — o estado do rascunho no momento
 *               do clique.
 * @returns NO_EVENTO | NO_RASCUNHO | EM_LUGAR_NENHUM
 */
export function destinoDoDesfazer(marca, agora = {}) {
  if (!marca || marca.alvo !== NO_RASCUNHO) return NO_EVENTO
  // A ação escreveu num rascunho. Ele ainda é o MESMO rascunho?
  if (marca.geracao !== agora.geracao) return EM_LUGAR_NENHUM
  if (agora.simulando) return NO_RASCUNHO
  if (agora.fim === FIM_APLICADO) return NO_EVENTO
  return EM_LUGAR_NENHUM
}

/**
 * A frase que a tela diz quando não há para onde desfazer. Mora aqui, e não no
 * JSX, para poder ser afirmada por teste e para ser a MESMA nos dois motivos —
 * descartado e rascunho novo dão no mesmo lugar para quem está olhando: o que
 * havia para desfazer não chegou a ser salvo.
 */
export const AVISO_SEM_DESFAZER =
  'A simulação foi descartada — não havia nada salvo para desfazer no evento.'
