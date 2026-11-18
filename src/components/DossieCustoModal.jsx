// Dossiê do custo (sugestão 40 — pedido do Marco em 19/07/2026): o centro de
// controle de UM item de custo, aberto pelo ícone de caderno na linha da
// tabela. Escolha de forma: MODAL largo (não accordion) — a tabela de custos
// vive dentro de um overflow-x-auto horizontal, onde uma linha expandida
// rolaria junto e ficaria clipada; o modal segue o precedente do "Parcelar…"
// e do restante do design system.
//
// Três andares:
// 1. Os números e a identidade (o que já existia, organizado): estimado ×
//    realizado × "vale hoje", status, fornecedor, responsável, obs. curta —
//    editam o MESMO item do estado (salvo automático, como na tabela).
// 2. Pagamento: a agenda inteira mora aqui — data única OU o editor de
//    parcelas (ParcelasEditor, o mesmo do modal "Parcelar…"), com o marcar
//    parcela paga da sugestão 38. Ação no objeto (princípio 9).
// 3. Anotações (os campos NOVOS da sugestão 40): observação, contato do
//    fornecedor, link do orçamento. DADO, nunca instrução: nada disso entra
//    em conta nenhuma (prova byte a byte em dossie.test.js) e o link só abre
//    quando é http/https (urlAbrivel), em nova aba com rel=noopener.

import { Btn, Modal, MoneyInput, TextInput, Select, Field, Stat, CampoData } from './ui.jsx'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { AppIcon, ArrowUpRight, TriangleAlert } from './AppIcon.jsx'
import { ParcelasEditor } from './ParcelasModal.jsx'
import { valorConsiderado, custouZeroEfetivo } from '../lib/calc.js'
import { num } from '../lib/util.js'
import { FAIXA_CUSTO } from '../lib/campoNumerico.js'
import { temParcelas, progressoParcelasPagas, realizadoVazio } from '../lib/parcelas.js'
import { urlAbrivel } from '../lib/dossie.js'
import { carimboItem } from '../lib/financeiro.js'
import { fmtBRL, fmtBRL2 } from '../lib/format.js'
import { STATUS } from '../lib/defaults.js'

const textareaBase =
  'w-full rounded-lg border border-[var(--borda-2)] bg-[var(--papel)] px-2.5 py-1.5 text-sm text-[var(--tinta)] outline-none focus:border-[var(--acento)] focus:ring-2 focus:ring-[var(--acento-tinta)]'

export default function DossieCustoModal({ item, categoriaNome, onChange, onClose }) {
  const carimbo = carimboItem(item)
  const href = urlAbrivel(item.linkOrcamento)
  // "custou zero" (Marco, 20/07/2026). P1: a marca só vale com o Realizado
  // vazio ou 0 — se houver realizado > 0, o app IGNORA a marca; a tela avisa
  // com todas as letras (princípio 4 ao contrário: nada de marca inerte muda).
  // Qualquer realizado diferente de zero (positivo OU negativo) faz a marca
  // "custou zero" ficar ignorada (P1) — o checkbox trava e a tela avisa.
  const realizadoPreenchido =
    item.realizado != null && item.realizado !== '' && num(item.realizado) !== 0
  const marcadoEfetivo = custouZeroEfetivo(item)

  return (
    <Modal title={`Dossiê — ${item.servico || 'custo sem nome'}`} onClose={onClose} wide>
      <div className="space-y-5">
        <p className="text-xs text-[var(--tinta-2)]">
          Categoria <b>{categoriaNome}</b> · tudo aqui edita o mesmo item da tabela (salvo
          automático).{carimbo ? <> · {carimbo.texto}</> : null}
        </p>

        {/* ————— 1. os números e a identidade ————— */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Serviço / produto" className="min-w-48 flex-1">
            <TextInput
              value={item.servico}
              onChange={(e) => onChange({ servico: e.target.value })}
              placeholder="Serviço"
            />
          </Field>
          {/* faixa nas DUAS portas do mesmo campo (lente adversarial 22/07):
              sem ela aqui, um custo −500 digitado no Dossiê inflava o lucro
              mesmo com a tabela do CostsTab travada. */}
          <Field label="Estimado" className="w-36">
            <MoneyInput
              value={item.estimado}
              onChange={(v) => onChange({ estimado: v })}
              faixa={FAIXA_CUSTO}
            />
          </Field>
          <Field label="Realizado" className="w-36">
            {/* Decisão do Marco (22/07/2026): com parcelas e o Realizado ainda
                vazio, a célula mostra o PROGRESSO derivado das parcelas (nada
                gravado; o custo previsto não cai). Marcar a última parcela como
                paga grava aqui a soma. Realizado digitado à mão vence e volta a
                ser campo editável. */}
            {temParcelas(item) && realizadoVazio(item) ? (
              (() => {
                const prog = progressoParcelasPagas(item)
                return (
                  <div
                    className="tnum inline-flex items-center rounded-lg border border-dashed border-[var(--borda-2)] bg-[var(--papel-2)] px-2.5 py-1.5 text-sm text-[var(--tinta-2)]"
                    title="Derivado das parcelas — edite as parcelas. Ao marcar a última como paga, o Realizado é gravado aqui."
                  >
                    {fmtBRL(prog.valorPago)} · {prog.qtdPagas}/{prog.n} pagas
                  </div>
                )
              })()
            ) : (
              <MoneyInput
                value={item.realizado}
                onChange={(v) => onChange({ realizado: v, realizadoAuto: false })}
                faixa={FAIXA_CUSTO}
                title="Realizado do custo. Com parcelas, marcar a última parcela como paga grava aqui a soma das parcelas; até lá a célula mostra o progresso. Sem parcelas, preencha à mão no fechamento."
              />
            )}
          </Field>
          <Stat
            label="Vale hoje"
            value={fmtBRL2(valorConsiderado(item))}
            sub={
              marcadoEfetivo
                ? 'marcado “custou zero” — vale R$ 0'
                : 'realizado quando preenchido, senão estimado'
            }
          />
          <Field label="Status" className="w-40">
            <Select
              value={item.status}
              onChange={(e) => onChange({ status: e.target.value })}
              options={STATUS}
              className="font-medium"
              style={estiloStatusCusto(item.status)}
            />
          </Field>
        </div>

        {/* ————— "custou zero" (Marco, 20/07/2026) ————— */}
        <div className="space-y-1.5">
          <label
            className={`flex w-fit items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
              realizadoPreenchido
                ? 'cursor-not-allowed border-[var(--borda)] opacity-60'
                : 'cursor-pointer border-[var(--borda)] hover:border-[var(--acento)]'
            }`}
            title="Permuta, cortesia ou serviço cancelado depois de orçado: o item custou R$ 0 de verdade. O estimado fica guardado como memória do orçamento."
          >
            <input
              type="checkbox"
              checked={marcadoEfetivo}
              disabled={realizadoPreenchido}
              onChange={(e) => onChange({ custouZero: e.target.checked })}
              className="size-4 cursor-pointer accent-[var(--acento)] disabled:cursor-not-allowed"
              aria-label={`Marcar “custou zero” em ${item.servico || 'custo'}`}
            />
            <span className="min-w-0">
              <span className="block font-medium text-[var(--tinta)]">Custou zero (permuta/cortesia)</span>
              <span className="block text-[11px] text-[var(--tinta-3)]">
                marca este item como R$ 0 no lugar do orçamento — o estimado fica guardado
              </span>
            </span>
          </label>
          {realizadoPreenchido && (
            <p className="flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
              <span>
                Apague o Realizado antes de marcar — enquanto houver um valor realizado, a marca
                “custou zero” fica ignorada (o realizado digitado vence).
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Fornecedor" className="w-48">
            <TextInput
              value={item.fornecedor}
              onChange={(e) => onChange({ fornecedor: e.target.value })}
              placeholder="—"
            />
          </Field>
          <Field label="Responsável" className="w-40">
            <TextInput
              value={item.responsavel}
              onChange={(e) => onChange({ responsavel: e.target.value })}
              placeholder="—"
            />
          </Field>
          <Field label="Obs. curta (coluna da tabela)" className="min-w-52 flex-1">
            <TextInput
              value={item.obs}
              onChange={(e) => onChange({ obs: e.target.value })}
              placeholder="—"
            />
          </Field>
        </div>

        {/* ————— 2. pagamento (a agenda mora aqui — sugestões 38 e 40) ————— */}
        <div className="space-y-3 border-t border-[var(--borda)] pt-4">
          <h3 className="text-sm font-semibold">Pagamento</h3>
          {!temParcelas(item) && (
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <Field label="Data de pagamento (única)" className="w-44">
                <CampoData
                  value={item.dataPagamento || ''}
                  onChange={(iso) => onChange({ dataPagamento: iso })}
                  aria-label={`Data de pagamento de ${item.servico || 'custo'}`}
                  title="Data de pagamento/vencimento (opcional) — alimenta a aba Análise e o Exportar pagamentos. Nenhum cenário muda."
                />
              </Field>
              <p className="pb-1 text-[11px] text-[var(--tinta-3)]">
                …ou divida em parcelas abaixo — aí cada parcela tem a própria data (e pode ser
                marcada como paga).
              </p>
            </div>
          )}
          <ParcelasEditor item={item} onChange={onChange} />
        </div>

        {/* ————— 3. anotações (campos novos da sugestão 40) ————— */}
        <div className="space-y-3 border-t border-[var(--borda)] pt-4">
          <h3 className="text-sm font-semibold">Anotações</h3>
          <p className="text-[11px] text-[var(--tinta-3)]">
            Só suas: nada daqui entra em conta, cenário, relatório ou export — é o bloco de
            notas do custo.
          </p>
          <Field label="Observação (texto livre)">
            <textarea
              rows={3}
              value={item.observacao || ''}
              onChange={(e) => onChange({ observacao: e.target.value })}
              placeholder="Condições combinadas, o que está incluso, histórico da negociação…"
              className={textareaBase}
              aria-label={`Observação de ${item.servico || 'custo'}`}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="Contato do fornecedor (nome/telefone)" className="min-w-64 flex-1">
              <TextInput
                value={item.contato || ''}
                onChange={(e) => onChange({ contato: e.target.value })}
                placeholder="ex.: João — (11) 99999-9999"
              />
            </Field>
            <Field label="Link do orçamento (URL)" className="min-w-64 flex-1">
              <span className="flex items-center gap-2">
                <TextInput
                  value={item.linkOrcamento || ''}
                  onChange={(e) => onChange({ linkOrcamento: e.target.value })}
                  placeholder="ex.: drive.google.com/…"
                />
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[var(--azul-texto)] underline underline-offset-2 hover:opacity-80"
                    title="Abrir o link do orçamento em nova aba"
                  >
                    abrir <AppIcon icon={ArrowUpRight} size={13} />
                  </a>
                )}
              </span>
            </Field>
          </div>
          {item.linkOrcamento && item.linkOrcamento.trim() !== '' && !href && (
            <p className="flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
              <span>
                Isso não parece um endereço http(s) — fica guardado como texto, mas o app não
                abre (só links http/https abrem, por segurança).
              </span>
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--borda)] pt-3">
          <Btn variant="primary" onClick={onClose}>
            Concluir
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
