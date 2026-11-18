// Os botões ↶ ↷ do topo (pedido do Marco, 19/07/2026 — "que nem no
// Financeiro"). Uma instância só, no chrome do App, ao lado do toggle de tema:
// o histórico é do APP inteiro (previsões, custos, benchmarks, ajustes), não de
// uma tela — dois pares de botões em telas diferentes mentiriam sobre isso.
//
// Regra da casa "ação anuncia o efeito": o botão DIZ o que vai desfazer, no
// title e no nome acessível ("Desfazer: apagar item de custo"). Sem nada na
// pilha, o botão fica DESABILITADO e diz "Nada para desfazer" — nunca se
// clica no vazio.

import { AppIcon, Undo2, Redo2 } from './AppIcon.jsx'

function BotaoHistorico({ icon, texto, onClick, ativo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ativo}
      title={texto}
      aria-label={texto}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-2)] shadow-sm transition-colors hover:text-[var(--tinta)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--tinta-2)] print:hidden"
    >
      <AppIcon icon={icon} size={18} />
    </button>
  )
}

export default function BotoesHistorico({
  textoDesfazer,
  textoRefazer,
  podeDesfazer,
  podeRefazer,
  onDesfazer,
  onRefazer,
}) {
  return (
    <>
      <BotaoHistorico
        icon={Undo2}
        texto={textoDesfazer}
        ativo={podeDesfazer}
        onClick={onDesfazer}
      />
      <BotaoHistorico icon={Redo2} texto={textoRefazer} ativo={podeRefazer} onClick={onRefazer} />
    </>
  )
}
