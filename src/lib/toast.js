// Toast leve com "Desfazer" (Sessão F2-P, tema F + princípio da casa "ação
// mora no objeto: reversível sem medo, desfazer visível na hora"). Pub/sub
// simples para qualquer componente disparar um toast sem prop-drilling — o
// ToastHost (montado uma vez no App) escuta e renderiza.
//
// Display puro: nenhum dado de dinheiro passa por aqui.

let ouvintes = []
let seq = 0

/**
 * Dispara um toast. `opcoes.acaoLabel` + `opcoes.onAcao` criam um botão
 * (ex.: "Desfazer"); `opcoes.duracao` em ms (padrão 6000).
 * Retorna o id (para descartar manualmente, se preciso).
 */
export function showToast(mensagem, opcoes = {}) {
  const t = { id: ++seq, mensagem, ...opcoes }
  ouvintes.forEach((fn) => fn(t))
  return t.id
}

export function subscribeToast(fn) {
  ouvintes.push(fn)
  return () => {
    ouvintes = ouvintes.filter((o) => o !== fn)
  }
}
