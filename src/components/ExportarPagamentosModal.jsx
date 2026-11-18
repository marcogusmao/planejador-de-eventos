// Exportar pagamentos — 3 destinos (Sessão F2-C, pedido do Marco 19/07/2026):
// → Financeiro (o export do plano da Sessão M, inalterado — vira opção deste
//   menu) · → Contador (CSV blindado no contrato do item 13 do BACKLOG do
//   Financeiro) · → Para mim (agenda simples, sem blindagem).
// Princípio 7 em todos: revisão com seleção item a item antes de gerar, botão
// dizendo quantos itens. Export NUNCA altera dados — leitura + arquivo, só.

import { useMemo, useState } from 'react'
import { Btn, Modal, Badge } from './ui.jsx'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { AppIcon, CircleCheck, TriangleAlert, ArrowLeft } from './AppIcon.jsx'
import PlanoExportModal from './PlanoExportModal.jsx'
import {
  montarPagamentos,
  gerarCSVContador,
  gerarCSVParaMim,
  nomeArquivoContador,
  nomeArquivoParaMim,
  baixarCSV,
} from '../lib/exportPagamentos.js'
import { fmtBRL2, fmtData } from '../lib/format.js'

const DESTINOS = [
  {
    id: 'financeiro',
    titulo: '→ Financeiro',
    desc: 'O plano do evento (receitas e custos previstos) num arquivo que o Financeiro importa com revisão e desfazer. Com parcelas, sai uma linha por parcela.',
  },
  {
    id: 'contador',
    titulo: '→ Contador',
    desc: 'Os pagamentos do evento no MESMO formato CSV que o Financeiro manda ao contador (blindado contra fórmula — os dois apps falam igual com ele).',
  },
  {
    id: 'mim',
    titulo: '→ Para mim',
    desc: 'Agenda simples de pagamentos (vencimento · fornecedor/descrição · valor · status · parcela), ordenada por data, com total. Para conferir e pagar.',
  },
]

export default function ExportarPagamentosModal({ evento, onClose }) {
  const [destino, setDestino] = useState(null)

  if (destino === 'financeiro') {
    // O export do plano da Sessão M, INALTERADO — só mora neste menu agora.
    return <PlanoExportModal evento={evento} onClose={onClose} />
  }
  if (destino === 'contador' || destino === 'mim') {
    return (
      <RevisaoPagamentos
        evento={evento}
        destino={destino}
        onVoltar={() => setDestino(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Exportar pagamentos" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[var(--tinta-2)]">
          Escolha o destino. Nos três, você revisa e marca item a item antes de gerar o arquivo —
          e <b>exportar nunca altera nenhum dado do evento</b>.
        </p>
        {DESTINOS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDestino(d.id)}
            className="block w-full cursor-pointer rounded-xl border border-[var(--borda-2)] bg-[var(--papel)] px-4 py-3 text-left transition-colors hover:border-[var(--acento)]"
          >
            <span className="block text-sm font-semibold text-[var(--tinta)]">{d.titulo}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--tinta-2)]">{d.desc}</span>
          </button>
        ))}
        <div className="flex justify-end pt-1">
          <Btn onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Modal>
  )
}

const TITULO = {
  contador: 'Exportar pagamentos → Contador',
  mim: 'Exportar pagamentos → Para mim',
}

function RevisaoPagamentos({ evento, destino, onVoltar, onClose }) {
  const montagem = useMemo(() => montarPagamentos(evento), [evento])
  const { pagamentos, avisos, semData } = montagem
  const [sel, setSel] = useState(() => new Set(pagamentos.map((p) => p.id)))
  const [baixado, setBaixado] = useState(null)

  const alternar = (id) =>
    setSel((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  const todosMarcados = pagamentos.length > 0 && sel.size === pagamentos.length
  const alternarTodos = () =>
    setSel(todosMarcados ? new Set() : new Set(pagamentos.map((p) => p.id)))

  const exportar = () => {
    const escolhidos = pagamentos.filter((p) => sel.has(p.id))
    if (escolhidos.length === 0) return
    const csv =
      destino === 'contador' ? gerarCSVContador(escolhidos, evento) : gerarCSVParaMim(escolhidos)
    const nomeArquivo =
      destino === 'contador' ? nomeArquivoContador(evento) : nomeArquivoParaMim(evento)
    baixarCSV(csv, nomeArquivo)
    setBaixado({ nomeArquivo, n: escolhidos.length })
  }

  if (baixado)
    return (
      <Modal title="Arquivo exportado" onClose={onClose}>
        <div className="space-y-4">
          <p className="flex items-start gap-1.5 rounded-lg border border-[rgba(0,120,42,0.25)] bg-[rgba(0,120,42,0.07)] px-3 py-2.5 text-sm text-[var(--verde-texto)]">
            <AppIcon icon={CircleCheck} size={16} className="mt-0.5 shrink-0" />
            <span>Arquivo <b>{baixado.nomeArquivo}</b> baixado com {baixado.n}{' '}
            {baixado.n === 1 ? 'pagamento' : 'pagamentos'}.</span>
          </p>
          <p className="rounded-lg bg-[var(--papel-2)] px-3 py-2.5 text-xs text-[var(--tinta-2)]">
            {destino === 'contador'
              ? 'CSV no formato combinado com o contador (mesmo arquivo que o Financeiro gera): UTF-8, separador ";", datas DD/MM/AAAA, valores com vírgula, protegido contra célula-fórmula. Nada no evento mudou.'
              : 'Planilha simples para o seu uso — abre direto no Excel/Números/Sheets. Nada no evento mudou.'}
          </p>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={onClose}>
              Fechar
            </Btn>
          </div>
        </div>
      </Modal>
    )

  return (
    <Modal title={TITULO[destino]} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-[var(--tinta-2)]">
          Marque o que entra no arquivo — cada parcela é uma linha própria.{' '}
          {destino === 'contador' ? (
            <>
              Formato <b>idêntico ao que o Financeiro manda ao contador</b> (item 13): pagamento{' '}
              <b>sem data</b> sai com a data do evento{evento.data ? ` (${fmtData(evento.data)})` : ''}.
            </>
          ) : (
            <>Ordenado por vencimento, com total no fim; sem data fica no fim com vencimento vazio.</>
          )}
        </p>

        {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
            fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
        {avisos.map((a) => (
          <p key={a} className="flex items-start gap-1 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
            <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>{a}</span>
          </p>
        ))}
        {semData > 0 && (
          <p className="flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>{semData} {semData === 1 ? 'pagamento está' : 'pagamentos estão'} sem data —{' '}
            {destino === 'contador'
              ? 'sairão com a data do evento; se não for isso, preencha a data na aba Custos antes.'
              : 'sairão no fim da lista com o vencimento vazio.'}</span>
          </p>
        )}

        {pagamentos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
            Nenhum custo com valor neste evento ainda — preencha os custos na aba Custos.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={alternarTodos}>
                {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
              </Btn>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                  <tr>
                    <th className="w-8 p-2" />
                    <th className="p-2 font-medium">Vencimento</th>
                    <th className="p-2 font-medium">Item</th>
                    {destino === 'contador' && <th className="p-2 font-medium">Categoria no arquivo</th>}
                    <th className="p-2 font-medium">Status</th>
                    <th className="w-28 p-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => (
                    <tr key={p.id} className={`border-t border-[var(--borda)] ${sel.has(p.id) ? '' : 'opacity-50'}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={sel.has(p.id)}
                          onChange={() => alternar(p.id)}
                          className="size-3.5 cursor-pointer accent-[var(--acento)]"
                        />
                      </td>
                      <td className="p-2 tnum whitespace-nowrap">
                        {p.data ? fmtData(p.data) : <span className="text-[var(--ambar-texto)]">sem data</span>}
                      </td>
                      <td className="p-2 font-medium text-[var(--tinta)]">
                        {p.rotulo}
                        {p.fornecedor && <span className="font-normal text-[var(--tinta-3)]"> ({p.fornecedor})</span>}
                        {p.parcela && (
                          <span className="ml-1 font-normal text-[var(--tinta-3)]">
                            · parcela {p.parcela.k}/{p.parcela.n}
                          </span>
                        )}
                      </td>
                      {destino === 'contador' && <td className="p-2 text-[var(--tinta-2)]">{p.categoriaFin}</td>}
                      <td className="p-2">
                        <Badge style={estiloStatusCusto(p.status)}>{p.status}</Badge>
                        {/* Parcela quitada (sugestão 38): rotulada aqui e no
                            CSV "Para mim"; o formato do contador não muda. */}
                        {p.paga && (
                          <Badge className="ml-1" style={estiloStatusCusto('PAGO')}>
                            paga{p.dataPaga ? ` em ${fmtData(p.dataPaga)}` : ''}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-right tnum font-semibold">{fmtBRL2(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Btn variant="ghost" onClick={onVoltar}>
            <AppIcon icon={ArrowLeft} /> Outro destino
          </Btn>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" disabled={sel.size === 0} onClick={exportar}>
              {sel.size === 0
                ? 'Nada selecionado'
                : `Baixar CSV ${destino === 'contador' ? 'para o contador' : 'para mim'} — ${sel.size} ${sel.size === 1 ? 'pagamento' : 'pagamentos'}`}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}
