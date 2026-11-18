// Parcelamento de um custo (Sessão F2-C — pedido do Marco, 19/07/2026):
// "parcelamento muda o FLUXO, não o CUSTO". O custo segue UM item na tabela
// de custos e nas fórmulas; aqui só se edita a AGENDA de pagamento dele
// (N parcelas { valor, data }). Soma travada ao valor do custo: divergiu =
// aviso vermelho na hora, nunca silêncio — e o aviso persiste na célula da
// tabela até o Marco acertar. Edição direta no evento (salvo automático),
// como qualquer campo do app.

import { useState } from 'react'
import { Btn, Modal, MoneyInput, NumInput, Field, CampoData } from './ui.jsx'
import { FAIXA_QUANTIDADE, FAIXA_PARCELA } from '../lib/campoNumerico.js'
import { AppIcon, X, TriangleAlert, CircleCheck } from './AppIcon.jsx'
import { valorConsiderado } from '../lib/calc.js'
import {
  criarParcelasIguais,
  novaParcela,
  dividirIgual,
  somaParcelas,
  divergenciaParcelas,
  temParcelas,
  resumoQuitacao,
  alternarParcelaPaga,
} from '../lib/parcelas.js'
import { fmtBRL, fmtBRL2 } from '../lib/format.js'
import { showToast } from '../lib/toast.js'
import { hojeISO } from './RitmoVendas.jsx'
import { num } from '../lib/util.js'

// O corpo do editor de parcelas, SEM o Modal em volta — para morar em dois
// lugares (sugestão 40): no modal "Parcelar…" da coluna Pagamento (abaixo) e
// dentro do Dossiê do custo (DossieCustoModal.jsx). Um código só: a coluna
// "Paga" da sugestão 38 existe uma vez, igual nos dois.
export function ParcelasEditor({ item, onChange }) {
  const [n, setN] = useState(2)
  const valorCusto = valorConsiderado(item)
  const parcelado = temParcelas(item)
  const divergencia = divergenciaParcelas(item)
  const quitacao = resumoQuitacao(item)

  const setParcela = (id, patch) =>
    onChange({ parcelas: item.parcelas.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const rmParcela = (id) => onChange({ parcelas: item.parcelas.filter((p) => p.id !== id) })
  const addParcela = () => onChange({ parcelas: [...item.parcelas, novaParcela()] })
  const dividir = () => onChange({ parcelas: criarParcelasIguais(valorCusto, n) })
  // Marcar paga (sugestão 38 + Decisão do Marco 22/07/2026): fluxo quitado, com
  // a data efetiva (padrão hoje, editável). Desmarcar REVERTE por inteiro
  // (paga false + dataPaga '') — a parcela volta a "prevista", idêntica.
  // O motor mora em alternarParcelaPaga (puro): marcar a ÚLTIMA parcela grava o
  // `realizado` do custo (soma das parcelas), no MESMO patch das parcelas (um
  // desfazer só); desmarcar essa gravação automática limpa o realizado de volta.
  // Um realizado digitado à mão vence e não é tocado. O toast SUGERE o status
  // PAGO — não muda sozinho (status é metadado do dono).
  const marcarPaga = (p, paga) => {
    const { patch, efeito } = alternarParcelaPaga(item, p.id, paga, hojeISO())
    onChange(patch)
    if (efeito?.tipo === 'gravou')
      showToast(
        `Todas as ${efeito.n} parcelas pagas — Realizado ${fmtBRL(efeito.valor)} gravado. Se quiser, marque o status como PAGO.`
      )
  }
  const redividir = () =>
    onChange({
      parcelas: dividirIgual(valorCusto, item.parcelas.length).map((valor, i) => ({
        ...item.parcelas[i],
        valor,
      })),
    })
  const removerParcelamento = () => {
    if (!window.confirm('Remover o parcelamento deste custo? As parcelas e as datas delas somem; o valor do custo não muda.')) return
    onChange({ parcelas: [] })
  }

  return (
    <div className="space-y-4">
        <p className="text-xs text-[var(--tinta-2)]">
          Parcelas mudam só o <b>fluxo de pagamento</b> — o custo continua um item único de{' '}
          <b className="tnum">{fmtBRL2(valorCusto)}</b> nas telas de custos, nos cenários e no
          semáforo. A agenda daqui aparece na aba <b>Análise</b> (cada parcela no seu dia) e no{' '}
          <b>Exportar pagamentos</b>. Parcela marcada <b>paga</b> é fluxo quitado: sai da linha
          “a vencer” da Análise. Ao marcar a <b>última</b> parcela, o <b>realizado</b> do custo é
          gravado (a soma das parcelas); até lá, o Realizado mostra só o progresso. Um realizado
          digitado à mão vence.
        </p>

        {!parcelado ? (
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <Field label="Número de parcelas" className="w-36">
                <NumInput
                  value={n}
                  onChange={(v) => setN(v)}
                  aria-label="Número de parcelas"
                  faixa={FAIXA_QUANTIDADE}
                />
              </Field>
              <Btn
                variant="primary"
                disabled={num(n) < 1 || valorCusto <= 0}
                onClick={dividir}
                title="Divisão igual, com a sobra de centavos na última parcela. Você edita valores e datas em seguida."
              >
                Dividir {fmtBRL2(valorCusto)} em {Math.max(1, Math.floor(num(n)))}{' '}
                {Math.floor(num(n)) === 1 ? 'parcela' : 'parcelas iguais'}
              </Btn>
            </div>
            {valorCusto <= 0 && (
              <p className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
                Este custo ainda não tem valor (estimado vazio ou R$ 0) — preencha o estimado na
                tabela antes de parcelar.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--tinta-2)]">
                  <th className="w-16 py-1 pr-2 font-medium">Parcela</th>
                  <th className="w-36 py-1 pr-2 font-medium">Valor</th>
                  <th className="py-1 pr-2 font-medium">Vencimento</th>
                  <th
                    className="w-44 py-1 pr-2 font-medium"
                    title="Parcela paga = fluxo quitado: sai da linha do tempo “a vencer” da aba Análise. Reversível — desmarcar volta a prevista. Marcar a última parcela grava o realizado do custo (a soma das parcelas); um realizado digitado à mão vence."
                  >
                    Paga?
                  </th>
                  <th className="w-8 py-1" />
                </tr>
              </thead>
              <tbody>
                {item.parcelas.map((p, i) => (
                  <tr key={p.id} className="border-t border-[var(--borda)]">
                    <td className="py-1.5 pr-2 text-xs text-[var(--tinta-2)]">
                      {i + 1}/{item.parcelas.length}
                    </td>
                    <td className="py-1.5 pr-2">
                      <MoneyInput
                        value={p.valor}
                        onChange={(v) => setParcela(p.id, { valor: v })}
                        faixa={FAIXA_PARCELA}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CampoData
                        className="w-36"
                        value={p.data || ''}
                        onChange={(iso) => setParcela(p.id, { data: iso })}
                        aria-label={`Data da parcela ${i + 1}`}
                      />
                      {!p.data && !p.paga && (
                        <span className="ml-2 text-[10px] text-[var(--ambar-texto)]">
                          sem data — fica fora da linha do tempo da Análise
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      {/* Sugestão 38 — ação no objeto (princípio 9): o quitar
                          mora na própria parcela. Marcada, pede a data EFETIVA
                          (padrão hoje, editável). */}
                      <span className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={p.paga === true}
                          onChange={(e) => marcarPaga(p, e.target.checked)}
                          className="size-3.5 cursor-pointer accent-[var(--acento)]"
                          aria-label={`Parcela ${i + 1} paga`}
                          title={
                            p.paga
                              ? 'Desmarcar — a parcela volta a “prevista” e reentra na linha do tempo da Análise'
                              : 'Marcar como paga — fluxo quitado, sai da linha do tempo da Análise'
                          }
                        />
                        {p.paga ? (
                          <CampoData
                            className="w-32"
                            value={p.dataPaga || ''}
                            onChange={(iso) => setParcela(p.id, { dataPaga: iso })}
                            aria-label={`Data em que a parcela ${i + 1} foi paga`}
                            title="Data em que a parcela foi de fato paga"
                          />
                        ) : (
                          <span className="text-[10px] text-[var(--tinta-3)]">prevista</span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => rmParcela(p.id)}
                        className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--vermelho-texto)]"
                        title="Remover parcela"
                        aria-label="Remover parcela"
                      >
                        <AppIcon icon={X} size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Leitura da quitação (sugestão 38): quanto já foi pago */}
            {quitacao && (
              <p className="flex items-start gap-1 rounded-lg bg-[rgba(0,120,42,0.07)] px-3 py-2 text-xs text-[var(--verde-texto)]">
                <AppIcon icon={CircleCheck} size={13} className="mt-px shrink-0" />
                <span>
                  <b className="tnum">{fmtBRL2(quitacao.valorPago)}</b> pagos de{' '}
                  <b className="tnum">{fmtBRL2(quitacao.valorCusto)}</b>
                  {' · '}
                  {quitacao.emAberto === 0
                    ? 'todas as parcelas pagas'
                    : `${quitacao.emAberto} em aberto`}
                  . Parcela paga não conta mais como saída a vencer na Análise.
                </span>
              </p>
            )}

            {/* Soma travada — o aviso vermelho da regra do Marco.
                B3 (BACKLOG S4): tokens tema-aware — a tarja fixa sumia no escuro. */}
            {divergencia ? (
              <p className="flex items-start gap-1 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
                <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>As parcelas somam <span className="tnum">{fmtBRL2(divergencia.soma)}</span>, mas o
                custo é <span className="tnum">{fmtBRL2(divergencia.valor)}</span> — diferença de{' '}
                <span className="tnum">{fmtBRL2(Math.abs(divergencia.diferenca))}</span>{' '}
                {divergencia.diferenca > 0 ? 'a mais' : 'a menos'}. Ajuste as parcelas (ou use
                “Redividir igualmente”); nada é corrigido sozinho.</span>
              </p>
            ) : (
              <p className="flex items-start gap-1 rounded-lg bg-[rgba(0,120,42,0.07)] px-3 py-2 text-xs text-[var(--verde-texto)]">
                <AppIcon icon={CircleCheck} size={13} className="mt-px shrink-0" /> <span>As parcelas somam <span className="tnum">{fmtBRL2(somaParcelas(item))}</span> —
                batendo com o valor do custo.</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" onClick={addParcela}>
                + Adicionar parcela
              </Btn>
              <Btn
                variant="ghost"
                onClick={redividir}
                title="Recalcula a divisão igual pelo valor atual do custo, mantendo as datas já preenchidas."
              >
                Redividir igualmente
              </Btn>
              <Btn variant="danger" className="ml-auto" onClick={removerParcelamento}>
                Remover parcelamento
              </Btn>
            </div>
          </>
        )}
    </div>
  )
}

// O modal "Parcelar…" da coluna Pagamento — a casca de sempre em volta do
// editor (comportamento idêntico ao anterior; o editor também mora no
// Dossiê do custo, sugestão 40).
export default function ParcelasModal({ item, onChange, onClose }) {
  return (
    <Modal title={`Parcelar — ${item.servico || 'custo sem nome'}`} onClose={onClose}>
      <div className="space-y-4">
        <ParcelasEditor item={item} onChange={onChange} />
        <div className="flex justify-end border-t border-[var(--borda)] pt-3">
          <Btn onClick={onClose}>Concluir</Btn>
        </div>
      </div>
    </Modal>
  )
}
