// "Copiar resumo" (Sessão K): um clique → texto pronto para colar no grupo
// das sócias no WhatsApp. Dois níveis com descrição do que cada um inclui
// (princípio 7); a última escolha fica lembrada e vem destacada. Display-only
// (lib/resumo.js) — nada no evento muda.
import { useState } from 'react'
import { Modal, Bola } from './ui.jsx'
import { resumoCurto, resumoCompleto } from '../lib/resumo.js'

const KEY = 'previsao-eventos:resumo-nivel:v1'

export function loadNivelResumo() {
  try {
    return localStorage.getItem(KEY) === 'completo' ? 'completo' : 'resumido'
  } catch {
    return 'resumido'
  }
}

const salvarNivel = (n) => {
  try {
    localStorage.setItem(KEY, n)
  } catch {
    // preferência é cosmética — sem quota, só não lembra
  }
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

const NIVEIS = [
  {
    id: 'resumido',
    nome: 'Resumido',
    desc: 'Veredito com o semáforo + números-chave: lucro por cenário, margem, break-even e ritmo de vendas. Cabe numa mensagem.',
  },
  {
    id: 'completo',
    nome: 'Completo',
    desc: 'Tudo em texto: cenários abertos (receita/custo/lucro), % do orçamento fechado, patrocínios e premissas (desconto, open bar).',
  },
]

export default function CopiarResumoModal({ evento, onClose, onCopiado }) {
  const [nivel, setNivel] = useState(loadNivelResumo)
  const [falha, setFalha] = useState(null) // texto para copiar à mão se o clipboard falhar

  const textoDe = (n) => (n === 'completo' ? resumoCompleto(evento) : resumoCurto(evento))

  const escolher = async (n) => {
    salvarNivel(n)
    const texto = textoDe(n)
    const ok = await copiarTexto(texto)
    if (ok) {
      onCopiado(n)
      onClose()
    } else {
      setNivel(n)
      setFalha(texto)
    }
  }

  return (
    <Modal title="Copiar resumo para o WhatsApp" onClose={onClose}>
      {falha ? (
        <div>
          <p className="mb-2 text-sm text-[var(--vermelho-texto)]">
            Não foi possível copiar automaticamente neste navegador. Selecione o texto abaixo e
            copie com ⌘C:
          </p>
          <textarea
            readOnly
            value={falha}
            onFocus={(e) => e.target.select()}
            className="h-48 w-full rounded-lg border border-[var(--borda-2)] bg-[var(--papel)] p-3 text-xs"
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {NIVEIS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => escolher(n.id)}
                onMouseEnter={() => setNivel(n.id)}
                onFocus={() => setNivel(n.id)}
                className={`block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                  nivel === n.id
                    ? 'border-[var(--acento)] bg-[var(--acento-tinta)]'
                    : 'border-[var(--borda)] bg-[var(--papel)] hover:border-[var(--acento)]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--tinta)]">
                  Copiar o nível {n.nome}
                  {loadNivelResumo() === n.id && (
                    <span className="text-[10px] font-normal text-[var(--tinta-3)]">
                      última escolha
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--tinta-3)]">{n.desc}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--tinta-3)]">
              <Bola size={9} cor="var(--acento)" /> Prévia do nível{' '}
              {nivel === 'completo' ? 'Completo' : 'Resumido'}
            </p>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--borda)] bg-[var(--papel-2)] p-3 font-sans text-[11px] leading-relaxed text-[var(--tinta-2)]">
              {textoDe(nivel)}
            </pre>
          </div>
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            Só copia texto — nada no evento muda. Os números são os mesmos da tela; *asteriscos*
            viram negrito no WhatsApp.
          </p>
        </>
      )}
    </Modal>
  )
}
