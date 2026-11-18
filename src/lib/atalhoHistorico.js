// Atalhos de teclado do desfazer/refazer — e a decisão de QUANDO não os usar.
//
// Cmd+Z desfaz, Cmd+Shift+Z refaz (Ctrl no lugar do Cmd também vale, para o
// Marco em teclado de PC; Ctrl+Y idem, hábito de Windows).
//
// DECISÃO (documentada de propósito, porque é a parte que engana se ficar
// implícita): DENTRO DE UM CAMPO DE TEXTO, o atalho NÃO é sequestrado — ele
// continua sendo o desfazer nativo do input.
//
// Por quê. Digitando "1.500" no preço de um lote, o desfazer que o Marco
// espera é o do texto ("volta o último caractere"), não o da previsão inteira.
// E o nativo aqui não é um caminho paralelo perigoso: o input do app é
// controlado — o desfazer nativo dispara o mesmo onChange de sempre, o parser
// brasileiro roda igual e o store recebe o valor pelo caminho normal (virando,
// inclusive, parte do MESMO passo agrupado). Ou seja: dentro do campo o atalho
// é fino; fora do campo (foco num botão, numa aba, no corpo da página) ele é
// grosso e desfaz o passo inteiro. Os BOTÕES ↶ ↷ do topo sempre fazem o passo
// inteiro, inclusive com o cursor dentro de um campo — quem quer o passo
// grande tem o botão a um clique.

import { ehCampoDeTexto } from './descritorEdicao.js'

/**
 * @param ev { key, metaKey, ctrlKey, shiftKey, altKey, alvo:{tag,tipo,editavel} }
 * @returns 'desfazer' | 'refazer' | null
 */
export function interpretarAtalho(ev) {
  if (!ev) return null
  const mod = ev.metaKey || ev.ctrlKey
  if (!mod || ev.altKey) return null
  const tecla = String(ev.key || '').toLowerCase()
  if (tecla !== 'z' && tecla !== 'y') return null

  // Campo de digitação: devolve o atalho ao navegador (ver comentário acima).
  if (ehCampoDeTexto(ev.alvo)) return null

  if (tecla === 'y') return 'refazer'
  return ev.shiftKey ? 'refazer' : 'desfazer'
}

/** Lê um KeyboardEvent de verdade no formato que `interpretarAtalho` espera. */
export function doEventoDeTeclado(e) {
  const alvo = e.target || null
  return {
    key: e.key,
    metaKey: e.metaKey,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    alvo: alvo && alvo.tagName
      ? { tag: alvo.tagName, tipo: alvo.getAttribute ? alvo.getAttribute('type') : null, editavel: !!alvo.isContentEditable }
      : null,
  }
}
