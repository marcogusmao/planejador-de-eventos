// Faixa âmbar do lote SEM PREÇO (P8 — Marco, 06/10/2026). Âmbar e não
// vermelho, como o aviso de bar não informado: não é erro, é informação que
// falta. O texto mora em src/lib/loteSemPreco.js; aqui só a moldura de cada
// superfície. role="status": informa, não interrompe.
import { AppIcon, TriangleAlert } from './AppIcon.jsx'
import { textoAvisoLotesSemPreco, textoCurtoLotesSemPreco } from '../lib/loteSemPreco.js'

const MOLDURA = {
  tela: 'rounded-lg border border-[var(--borda-2)] bg-[var(--papel-2)] p-3 text-xs text-[var(--ambar-texto,var(--tinta-2))]',
  // papel: cores FIXAS, como o resto do relatório (peça de impressão)
  papel: 'rounded-lg border border-[#8a6a00] bg-white p-3 text-xs text-[#8a6a00]',
  // apresentação: superfície preta fixa; o âmbar de texto do tema escuro
  apresentacao: 'rounded-2xl border border-white/10 bg-[#1a1a19] px-5 py-3 text-sm text-[#e6be52]',
}

export default function AvisoLoteSemPreco({ evento, variante = 'tela', naReceita = false, className = '' }) {
  const texto = textoAvisoLotesSemPreco(evento, { naReceita })
  if (!texto) return null
  return (
    <div role="status" className={`${MOLDURA[variante] || MOLDURA.tela} break-inside-avoid ${className}`}>
      <p className="flex items-start gap-1.5">
        <AppIcon icon={TriangleAlert} size={14} className="mt-0.5 shrink-0" />
        <span>{texto}</span>
      </p>
    </div>
  )
}

/** A LINHA CURTA (revisão adversarial da S7, 06/10/2026), para as superfícies
 *  que mostram um número que mudou por causa do lote sem preço mas não têm
 *  lugar para a faixa inteira: o painel do veredito (visível em todas as
 *  abas), o cartão da Home, o custo por pessoa da aba Custos, o card de ritmo
 *  e a curva de vendas. Mesmo texto do cartão de cenário
 *  (`textoCurtoLotesSemPreco`); `prefixo` só diz qual número da superfície
 *  ele explica. role="note": é informação ao lado de um número, não um
 *  anúncio — e não se confunde com as faixas (role="status"). */
export function NotaLoteSemPreco({ evento, prefixo = '', className = '' }) {
  const texto = textoCurtoLotesSemPreco(evento)
  if (!texto) return null
  return (
    <p
      role="note"
      data-aviso="lote-sem-preco"
      className={`flex items-start gap-1 text-[11px] text-[var(--ambar-texto,var(--tinta-2))] ${className}`}
    >
      <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
      <span>{prefixo}{texto}</span>
    </p>
  )
}
