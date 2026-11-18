// Ponte 2 com o Financeiro (Sessão M — sugestão 12): exporta o plano do
// evento (receitas e custos previstos) num arquivo que o Financeiro importa
// pelo tradutor próprio (Sessão L). Mesmo desenho da Ponte 1 (FinanceiroModal
// — regra do Marco, 18/07/2026): revisão com checkbox por item, nada
// pré-marcado por padrão além do que já é "verdade" hoje, e o botão diz
// quantos itens vai exportar. Esta tela é SÓ LEITURA sobre o evento — nenhum
// clique aqui altera um valor da previsão; o arquivo gerado é o único efeito.
import { useMemo, useState } from 'react'
import { Btn, Modal } from './ui.jsx'
import { AppIcon, TriangleAlert, CircleCheck } from './AppIcon.jsx'
import {
  montarItensPlano,
  gerarCSVPlano,
  nomeArquivoPlano,
  baixarArquivoPlano,
  fmtValorPlano,
} from '../lib/planoFinanceiro.js'

const TITULO_GRUPO = { receita: 'Receitas previstas', custo: 'Custos previstos' }

export default function PlanoExportModal({ evento, onClose }) {
  const montagem = useMemo(() => montarItensPlano(evento), [evento])
  const { itens, avisos, alertas = [], bloqueios, conferencias = [], foraDoArquivo = [] } = montagem
  const [sel, setSel] = useState(() => new Set(itens.map((i) => i.id)))
  const [baixado, setBaixado] = useState(null) // { nomeArquivo, n } depois do clique

  const alternar = (id) =>
    setSel((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const todosMarcados = itens.length > 0 && sel.size === itens.length
  const alternarTodos = () => setSel(todosMarcados ? new Set() : new Set(itens.map((i) => i.id)))

  const exportar = () => {
    const escolhidos = itens.filter((i) => sel.has(i.id))
    if (escolhidos.length === 0) return
    const csv = gerarCSVPlano(escolhidos, evento)
    const nomeArquivo = nomeArquivoPlano(evento)
    baixarArquivoPlano(csv, nomeArquivo)
    setBaixado({ nomeArquivo, n: escolhidos.length })
  }

  if (bloqueios.length > 0)
    return (
      <Modal title="Exportar plano para o Financeiro" onClose={onClose}>
        <div className="space-y-4">
          {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
              fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
          <div className="space-y-1.5 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2.5 text-sm text-[var(--vermelho-texto)]">
            {bloqueios.map((b, i) => (
              <p key={i} className="flex items-start gap-1">
                <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>{b}</span>
              </p>
            ))}
          </div>
          <p className="text-xs text-[var(--tinta-3)]">
            Nada foi gerado — esta tela só lê o evento, nunca altera nada.
          </p>
          <div className="flex justify-end">
            <Btn onClick={onClose}>Fechar</Btn>
          </div>
        </div>
      </Modal>
    )

  if (baixado)
    return (
      <Modal title="Arquivo exportado" onClose={onClose}>
        <div className="space-y-4">
          <p className="flex items-start gap-1.5 rounded-lg border border-[rgba(0,120,42,0.25)] bg-[rgba(0,120,42,0.07)] px-3 py-2.5 text-sm text-[var(--verde-texto)]">
            <AppIcon icon={CircleCheck} size={16} className="mt-0.5 shrink-0" />
            <span>Arquivo <b>{baixado.nomeArquivo}</b> baixado com {baixado.n}{' '}
            {baixado.n === 1 ? 'item' : 'itens'}.</span>
          </p>
          <div className="rounded-lg bg-[var(--papel-2)] px-3 py-2.5 text-xs text-[var(--tinta-2)]">
            <p>
              <b>Próximo passo:</b> no Financeiro, abra a aba <b>Importar → Plano da Previsão</b> e
              selecione este arquivo. Ele entra por preview → confirmação → lote desfazível, como
              qualquer importação de lá — nada é gravado sem essa confirmação.
            </p>
            <p className="mt-1 text-[var(--tinta-3)]">
              Exportar de novo depois de mudar o plano gera um arquivo novo; reimportar não duplica
              os itens que já foram importados antes (o Financeiro reconhece a mesma linha).
            </p>
          </div>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={onClose}>
              Fechar
            </Btn>
          </div>
        </div>
      </Modal>
    )

  // Um evento com 20 custos não vira tabela de 22 linhas: só entra o bloco que
  // tem valor ou que não fechou.
  const conferenciasVisiveis = conferencias.filter((c) => c.referencia !== 0 || !c.confere)
  const desmarcado = itens.filter((i) => !sel.has(i.id)).reduce((s, i) => s + i.valor, 0)

  const grupos = ['receita', 'custo']
    .map((g) => ({ id: g, titulo: TITULO_GRUPO[g], itens: itens.filter((i) => i.grupo === g) }))
    .filter((g) => g.itens.length > 0)

  return (
    <Modal title="Exportar plano para o Financeiro" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-[var(--tinta-2)]">
          Marque o que deve entrar no arquivo. <b>Exportar não altera nenhum dado do evento</b> —
          é só leitura do que já está nas abas Receita e Custos, virando um arquivo para você
          importar no Financeiro. Os valores são os do cenário <b>realista</b> (bilheteria) e os{' '}
          <b>estimados</b> de cada item de custo.
        </p>

        {/* Alerta grave: alguma coisa que aparece na tela NÃO entrou no
            arquivo. Vermelho e no topo de propósito — é o oposto do silêncio
            que a auditoria externa encontrou no export com ticket manual.
            B3 (BACKLOG S4): achado extra no mesmo grep — tokens tema-aware. */}
        {alertas.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2.5 text-sm text-[var(--vermelho-texto)]">
            {alertas.map((a, i) => (
              <p key={i} className="flex items-start gap-1.5">
                <AppIcon icon={TriangleAlert} size={14} className="mt-0.5 shrink-0" />{' '}
                <span>{a}</span>
              </p>
            ))}
          </div>
        )}

        {avisos.length > 0 && (
          <div className="space-y-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            {avisos.map((a, i) => (
              <p key={i} className="flex items-start gap-1">
                <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span>{a}</span>
              </p>
            ))}
          </div>
        )}

        {/* "O que a tela diz × o que este arquivo leva" — a trilha de
            conferências do emissor (planoFinanceiro.js, 20/07/2026). O emissor
            já calcula os dois números por bloco para decidir se emite; jogá-los
            fora seria desperdício. Aqui eles viram a única tabela do app onde o
            Marco confere, antes de exportar, se o arquivo concorda com a tela.

            É POR BLOCO, sem total-pai de propósito: um total de receita
            reconciliado contra a tela nunca fecharia sem reescrever a relação
            taxa/cashback (o arquivo publica a bilheteria BRUTA, a tela mostra a
            líquida), e um guarda que grita à toa ensina a ignorar o grito.

            A linha das linhas DESMARCADAS existe porque, sem ela, a própria
            tabela mentiria: desmarcar um item aqui quebra a correspondência com
            a tela, e até hoje isso acontecia sem uma palavra. */}
        {(conferenciasVisiveis.length > 0 || foraDoArquivo.length > 0) && (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">
              Confira antes de exportar: bloco a bloco, o que foi para este arquivo
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                  <tr>
                    <th className="p-2 font-medium">Bloco</th>
                    {/* S3-a (20/07/2026): esta coluna JÁ SE CHAMOU "Na tela", e
                        mentia. Num custo com estimado 8.000 e realizado 20.000
                        ela mostrava 8.000 — a aba Custos mostra 20.000. O
                        número está certo (é a referência contra a qual o bloco
                        foi conferido, e o arquivo leva o PREVISTO); errado
                        estava o rótulo. */}
                    <th className="w-32 p-2 text-right font-medium">Conferido contra</th>
                    <th className="w-32 p-2 text-right font-medium">Neste arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {conferenciasVisiveis.map((c) => (
                    <tr key={c.bloco} className="border-t border-[var(--borda)]">
                      <td className="p-2 font-medium text-[var(--tinta)]">
                        {c.rotulo}
                        {!c.confere && (
                          <span className="ml-1.5 font-normal text-[var(--vermelho-texto)]">
                            não fecha — fora do arquivo
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right tnum">{fmtValorPlano(c.referencia)}</td>
                      <td
                        className={`p-2 text-right tnum ${c.confere ? '' : 'text-[var(--vermelho-texto)]'}`}
                      >
                        {fmtValorPlano(c.confere ? c.somaEmitida : 0)}
                      </td>
                    </tr>
                  ))}
                  {desmarcado > 0 && (
                    <tr className="border-t border-[var(--borda)] text-[var(--tinta-2)]">
                      <td className="p-2 pl-5">linhas que você desmarcou nesta tela</td>
                      <td className="p-2" />
                      <td className="p-2 text-right tnum">−{fmtValorPlano(desmarcado)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-[var(--tinta-3)]">
              <b>Conferido contra</b> é o valor que este arquivo se propõe a levar naquele bloco —
              nos custos, o <b>estimado</b> (ou as parcelas), nunca o realizado. Pode ser diferente
              do que a aba Custos mostra, e é de propósito: o arquivo é o orçamento.
            </p>

            {/* S2-a (20/07/2026) — O NONO FURO, nomeado. Taxa e cashback nunca
                foram blocos, então o emissor não os via: os cinco blocos
                conferiam, e o rodapé jurava completude enquanto R$ 1.935
                líquidos ficavam de fora. O que o arquivo leva NÃO mudou (é
                decisão do Marco); o que mudou é que essas duas grandezas agora
                têm nome e valor aqui. */}
            {foraDoArquivo.length > 0 && (
              <div className="mt-2 rounded-lg border border-dashed border-[var(--borda)] px-3 py-2">
                <p className="text-xs font-semibold text-[var(--tinta)]">
                  Fora deste arquivo, de propósito
                </p>
                <ul className="mt-1 space-y-1.5">
                  {foraDoArquivo.map((f) => (
                    <li key={f.id} className="text-xs text-[var(--tinta-2)]">
                      <span className="font-medium text-[var(--tinta)]">{f.rotulo}</span>
                      <span className="tnum ml-1.5 font-semibold">
                        {f.valor < 0 ? '−' : '+'}
                        {fmtValorPlano(Math.abs(f.valor))}
                      </span>
                      <span className="block text-[var(--tinta-3)]">{f.explicacao}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-1.5 text-xs text-[var(--tinta-3)]">
              {conferenciasVisiveis.every((c) => c.confere)
                ? foraDoArquivo.length === 0
                  ? 'Cada real que a tela mostra está neste arquivo, ou está explicado acima.'
                  : 'Todo bloco fecha. O que a tela conta e este arquivo não leva está nomeado logo acima, com o valor.'
                : 'Uma linha não fecha — o motivo está no alerta vermelho, e o valor não vai no arquivo.'}
            </p>
          </div>
        )}

        {itens.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
            {alertas.length > 0
              ? 'Não sobrou nada para exportar: o que havia ficou de fora pelo(s) motivo(s) acima, e o resto do evento não tem receita nem custo com valor preenchido.'
              : 'Nada para exportar ainda — sem receita prevista (venda ou preço R$ 0) nem itens de custo com estimado preenchido.'}
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={alternarTodos}>
                {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
              </Btn>
            </div>
            {grupos.map((g) => (
              <div key={g.id}>
                <h3 className="mb-1.5 text-sm font-semibold">{g.titulo}</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                      <tr>
                        <th className="w-8 p-2" />
                        <th className="p-2 font-medium">Item</th>
                        <th className="p-2 font-medium">Categoria no Financeiro</th>
                        <th className="w-32 p-2 text-right font-medium">Valor previsto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.itens.map((it) => (
                        <tr
                          key={it.id}
                          className={`border-t border-[var(--borda)] ${sel.has(it.id) ? '' : 'opacity-50'}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={sel.has(it.id)}
                              onChange={() => alternar(it.id)}
                              className="size-3.5 cursor-pointer accent-[var(--acento)]"
                            />
                          </td>
                          <td className="p-2 font-medium text-[var(--tinta)]">{it.rotulo}</td>
                          <td className="p-2 text-[var(--tinta-2)]">{it.categoria}</td>
                          <td className="p-2 text-right tnum font-semibold">
                            {fmtValorPlano(it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={sel.size === 0} onClick={exportar}>
            {sel.size === 0 ? 'Nada selecionado para exportar' : `Exportar ${sel.size} ${sel.size === 1 ? 'item' : 'itens'} para o Financeiro`}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
