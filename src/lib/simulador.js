// Simulador "e se" ao vivo (sugestão 6 do MELHORIAS.md, Sessão I). Nenhuma
// fórmula nova: os sliders editam os MESMOS campos de `cenariosConfig`
// (vendaPct/custoPct/ticketPct) que o painel de cenários já usa — o motor
// (calc.js) não muda uma linha.
//
// `FALLBACK_DISPLAY` espelha EXATAMENTE o fallback que cada campo já tem em
// ScenariosTab.jsx (`value={cfg.X?.Y ?? Z}`) e em calc.js — garante que o
// slider nunca mostre um número diferente do que já está sendo calculado.
//
// `ALVO_RESET` é o padrão do evento NOVO (defaults.js, `novoEvento`): o botão
// "voltar ao padrão (80/90/100)" grava esses valores explicitamente.
// Sessão P (sugestão 19 — grade completa): realista ganhou custoPct (fallback
// e alvo 0 = conta de sempre) e otimista ganhou vendaPct (fallback e alvo
// 100 = esgota tudo, incluindo os "só otimista" = conta de sempre). Os dois
// novos têm fallback = alvo, então não mudam o reset nem o selo "ativa" de
// eventos antigos.
//
// PADRÕES 80/90/100 (Marco, 27/07/2026 — duas decisões por questionário):
// o pessimista subiu de 70 para 80 nas DUAS tabelas, e o `realista.vendaPct`
// deixou de ser o campo que divergia. Ele valia 100 aqui e 90 no ALVO_RESET
// porque calc.js calculava 100 com o campo vazio — o slider mostrava o que a
// conta fazia, e o botão prometia outra coisa. A decisão B pôs 90 no cálculo,
// então as duas tabelas passam a dizer 90: fallback = alvo em todo campo,
// e o slider volta a nunca mostrar número diferente do que está sendo
// calculado (que é a razão de existir desta tabela).
export const FALLBACK_DISPLAY = {
  pessimista: { vendaPct: 80, custoPct: 10, ticketPct: 0 },
  realista: { vendaPct: 90, custoPct: 0, ticketPct: 0 },
  otimista: { vendaPct: 100, custoPct: -5, ticketPct: 0 },
}

export const ALVO_RESET = {
  pessimista: { vendaPct: 80, custoPct: 10, ticketPct: 0 },
  realista: { vendaPct: 90, custoPct: 0, ticketPct: 0 },
  otimista: { vendaPct: 100, custoPct: -5, ticketPct: 0 },
}

/** Valor mostrado no slider: preenchido ou o fallback de exibição do campo. */
export function valorEfetivo(cfg, cenario, campo) {
  const v = cfg?.[cenario]?.[campo]
  return v === '' || v == null ? FALLBACK_DISPLAY[cenario][campo] : Number(v)
}

/**
 * true quando algum campo tocado pelos sliders está PREENCHIDO e diferente
 * do alvo do reset. Campo ausente/vazio nunca conta como "simulação ativa"
 * — ninguém mexeu em nada, não há o que avisar (evita alarme falso em
 * evento antigo que nunca teve o campo gravado).
 */
export function simulacaoAtiva(cfg) {
  return Object.keys(ALVO_RESET).some((cen) =>
    Object.keys(ALVO_RESET[cen]).some((campo) => {
      const v = cfg?.[cen]?.[campo]
      if (v === '' || v == null) return false
      return Number(v) !== ALVO_RESET[cen][campo]
    })
  )
}

/**
 * Volta só os campos vendaPct/custoPct/ticketPct (os que os sliders tocam)
 * para o alvo 80/90/100 — grava valores explícitos, não apaga o campo. Desde
 * 27/07/2026 apagar cairia no MESMO 90 (decisão B), mas gravar explícito
 * continua sendo o certo: é o que faz o evento carregar o próprio número em
 * vez de depender de um padrão que pode mudar de novo. Preserva ticketMedio
 * manual e overrides por lote —
 * nenhum dos dois é campo de slider, resetar a simulação não pode mexer
 * neles em silêncio.
 */
export function resetarSimulacao(cfg) {
  const novo = { ...(cfg || {}) }
  for (const cen of Object.keys(ALVO_RESET)) {
    novo[cen] = { ...(novo[cen] || {}), ...ALVO_RESET[cen] }
  }
  return novo
}
