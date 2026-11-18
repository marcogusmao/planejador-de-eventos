// Planilha do produtor (feature de 20/07/2026) — modal de duas telas:
// 1) gerar o .xlsx do orçamento (custos + patrocínio) para o produtor ajustar;
// 2) reimportar o retorno dele com revisão item a item antes de aplicar
// (princípio 7), espelhando o fluxo do FinanceiroModal. Toda a lógica de
// diff/aplicação mora em xlsxOrcamento.js (módulo puro, já testado) — este
// componente só fala com a lib XLSX e desenha a revisão.
//
// Atenção (achado ao implementar): diferente de financeiro.js (ids ESTÁVEIS
// tipo 'vendidos'/`custo:${nome}`), montarPropostasOrcamento gera um uid()
// NOVO por proposta A CADA CHAMADA. Por isso as propostas são calculadas UMA
// VEZ ao importar e guardadas em estado puro — nunca recalculadas via useMemo
// preso ao `evento`, o que trocaria os ids por baixo da seleção do Marco e
// desmarcaria tudo em silêncio.

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { planilhaParaAOA } from '../lib/planilhaCelulas.js'
import { Btn, Modal, Badge } from './ui.jsx'
import { AppIcon, Download, FileUp, TriangleAlert, CircleCheck, ArrowLeft } from './AppIcon.jsx'
import {
  parseAOAOrcamento,
  montarPropostasOrcamento,
  aplicarPropostasOrcamento,
  acharAbaOrcamento,
} from '../lib/xlsxOrcamento.js'
// Export v2 (a planilha com a cara da casa): o writer com exceljs + a
// rasterização do logo (só navegador). A reimportação v2 (motor) já existe em
// xlsxReconciliar.js; a TELA de revisão v2 é o gate 3c — até lá, ehOrcamentoV2
// trava a reimportação pra o parser v1 não mastigar um arquivo v2.
import { gerarXlsx } from '../lib/xlsxOrcamentoV2.js'
import { gerarLogoPng, msgPlanilhaSemLogo } from '../lib/marcaPng.js'
import {
  ehOrcamentoV2,
  parseOrcamentoV2,
  reconciliar,
  aplicarResolucoes,
  aplicarReconciliacao,
} from '../lib/xlsxReconciliar.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { agora, num } from '../lib/util.js'
import { fmtBRL, fmtBRL2, fmtData } from '../lib/format.js'
import { parseMoney } from '../lib/xlsxImport.js'

// Rótulo em português dos campos que aparecem no diff — as chaves em si
// (xlsxOrcamento.js) não levam acento por serem propriedade de objeto JS.
const ROTULO_CAMPO = {
  estimado: 'Estimado',
  servico: 'Serviço',
  fornecedor: 'Fornecedor',
  obs: 'Observações',
  status: 'Status',
  dataPgto: 'Data pgto',
  pagamento: 'Pagamento',
  patrocinador: 'Patrocinador',
  valor: 'Valor',
}
const CAMPOS_DINHEIRO = new Set(['estimado', 'valor'])

// Vazio é "não sei". Um valor antigo ilegível precisa aparecer como texto
// na revisão da limpeza; formatá-lo como moeda o apresentaria como R$ 0.
const fmtCampo = (campo, v) => {
  if (v === '' || v == null) return '—'
  if (!CAMPOS_DINHEIRO.has(campo)) return String(v)
  const valor = parseMoney(v)
  return valor === null ? `“${String(v)}” (valor não reconhecido)` : fmtBRL2(valor)
}

const detalheNovo = (p) => {
  if (p.tipo === 'custo') {
    const partes = [`estimado ${fmtCampo('estimado', p.dados.estimado)}`]
    if (p.dados.fornecedor) partes.push(`fornecedor ${p.dados.fornecedor}`)
    if (p.dados.obs) partes.push(`obs “${p.dados.obs}”`)
    return partes.join(' · ')
  }
  return `valor ${fmtCampo('valor', p.dados.valor)}`
}

const slugArquivo = (nome) =>
  (nome || 'evento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function RecusasV1({ recusadas }) {
  if (!recusadas.length) return null
  return (
    <section className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]" aria-label="Linhas recusadas">
      <h3 className="font-semibold">Linhas recusadas ({recusadas.length})</h3>
      <p className="mt-1">Estas linhas não alteram nem removem itens. Corrija o valor na planilha e reimporte.</p>
      <ul className="mt-2 space-y-1 break-words">
        {recusadas.map((r, i) => <li key={i}>Linha {r.linha} · {r.campo}: <b>{String(r.original)}</b> — {r.motivo}</li>)}
      </ul>
    </section>
  )
}

export default function OrcamentoProdutorModal({ evento, update, store, onClose }) {
  const [tela, setTela] = useState('inicial') // inicial | revisar | aplicado
  const [baixado, setBaixado] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [erroImport, setErroImport] = useState('')
  const [montagem, setMontagem] = useState(null) // { propostas, avisos } — calculado UMA vez, na importação
  const [sel, setSel] = useState(() => new Set())
  const [aplicando, setAplicando] = useState(false)
  const [erroAplicar, setErroAplicar] = useState('')
  const [resultado, setResultado] = useState(null) // { n } da tela final
  const fileRef = useRef(null)
  // Reimportação v2 (gate 3c): o plano do motor + as escolhas do produtor.
  const [montagemV2, setMontagemV2] = useState(null) // o plano de reconciliar()
  const [resolucoes, setResolucoes] = useState({}) // { [indiceAmbiguo]: {acao, itemId} }
  const [desmarcados, setDesmarcados] = useState(() => new Set()) // chaves 'atu:id'/'rem:id'/'add:i' desmarcadas

  const [erroBaixar, setErroBaixar] = useState('')
  const [avisoLogo, setAvisoLogo] = useState('')
  const baixarPlanilha = async () => {
    setErroBaixar('')
    setAvisoLogo('')
    try {
      // Logo da marca rasterizado no navegador (SVG→PNG). Festa sem elemento
      // no mapa (tipo desconhecido) → null, e o writer usa o nome em texto. Se
      // a marca FALHAR, a planilha sai assim mesmo, mas a tela AVISA (revisão
      // do PR #100, 05/10/2026: o catch mudo deixou a planilha sair sem logo,
      // calada, quando a política da nuvem bloqueou a imagem).
      let logoPng = null
      try {
        logoPng = await gerarLogoPng(evento.tipo)
      } catch (e) {
        logoPng = null
        setAvisoLogo(msgPlanilhaSemLogo(e?.message || 'motivo desconhecido'))
      }
      const buf = await gerarXlsx(evento, { logoPng })
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orcamento-${slugArquivo(evento.nome)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setBaixado(true)
    } catch (e) {
      setErroBaixar(`Não deu para gerar a planilha: ${e.message}`)
    }
  }

  const onFile = async (file) => {
    setErroImport('')
    setLendo(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      // A sentinela escolhe a revisão v2 por identidade; uma planilha v2
      // nunca passa pelo parser v1 de seções antigas.
      const aoaV2 = planilhaParaAOA(wb.Sheets[wb.SheetNames[0]] || {}, { header: 1, defval: '' })
      if (ehOrcamentoV2(aoaV2)) {
        const parsed = parseOrcamentoV2(aoaV2)
        // A2 carimba o evento-alvo. Se não for ESTE evento, não reconcilia às
        // cegas — rede da planilha-copiada (Marco #1/#2): nomeia e para.
        if (parsed.eventoId && parsed.eventoId !== evento.id) {
          const outro = (store.eventos || []).find((e) => e.id === parsed.eventoId)
          setErroImport(
            outro
              ? `Esta planilha é do evento "${outro.nome}" — abra ele e reimporte lá. Nada foi alterado.`
              : `Esta planilha não é deste evento (id ${parsed.eventoId} desconhecido) — confira se é o arquivo certo. Nada foi alterado.`
          )
          return
        }
        setResolucoes({})
        setDesmarcados(new Set())
        setErroAplicar('')
        setMontagemV2(reconciliar(parsed, evento))
        setTela('revisarV2')
        return
      }
      // A aba certa é a que tem o MARCADOR — não a primeira: o produtor pode
      // ter criado uma aba de rascunho na frente (achado adversarial).
      const nomeAba = acharAbaOrcamento(wb)
      if (!nomeAba) {
        setErroImport(
          `Nenhuma aba deste arquivo é a planilha do produtor gerada pelo app (abas encontradas: ${(wb.SheetNames || []).join(', ') || 'nenhuma'}). Exporte de novo em “Baixar planilha do orçamento” e envie aquele arquivo.`
        )
        return
      }
      const ws = wb.Sheets[nomeAba]
      const aoa = planilhaParaAOA(ws, { header: 1, raw: true, defval: '' })
      const r = parseAOAOrcamento(aoa)
      if (!r.ok) {
        setErroImport(r.erro)
        return
      }
      if (r.eventoId !== evento.id) {
        setErroImport(
          `Esta planilha é de OUTRO evento (id ${r.eventoId || 'vazio'}). Abra o evento certo e reimporte lá — nada foi alterado.`
        )
        return
      }
      const { propostas, avisos, recusadas } = montarPropostasOrcamento(evento, r)
      setSel(new Set(propostas.filter((p) => p.selecionadaPorPadrao).map((p) => p.id)))
      setErroAplicar('')
      setMontagem({ propostas, avisos, recusadas })
      setTela('revisar')
    } catch (e) {
      console.error(e)
      setErroImport(`Não foi possível ler o arquivo: ${e.message}`)
    } finally {
      setLendo(false)
    }
  }

  const alternar = (id) =>
    setSel((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const voltar = () => {
    setMontagem(null)
    setSel(new Set())
    setMontagemV2(null)
    setResolucoes({})
    setDesmarcados(new Set())
    setErroAplicar('')
    setTela('inicial')
  }

  // ——— handlers da revisão v2 ———
  const escolherAmbiguo = (i, acao, itemId) =>
    setResolucoes((r) => ({ ...r, [i]: { acao, itemId } }))
  const alternarDesmarcado = (chave) =>
    setDesmarcados((s) => {
      const novo = new Set(s)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })

  const aplicarV2 = () => {
    if (aplicando || !montagemV2) return
    setErroAplicar('')
    const resolvido = aplicarResolucoes(montagemV2, evento, resolucoes)
    if (resolvido.ambiguos.length > 0) {
      setErroAplicar(
        `Ainda há ${resolvido.ambiguos.length} linha(s) ambígua(s) sem escolha — resolva cada uma (casar, novo ou ignorar) antes de aplicar.`
      )
      return
    }
    const sel = {
      atualizacoes: new Set(resolvido.atualizacoes.map((a) => a.id).filter((id) => !desmarcados.has(`atu:${id}`))),
      remocoes: new Set(resolvido.remocoes.map((r) => r.id).filter((id) => !desmarcados.has(`rem:${id}`))),
      adicoes: new Set(resolvido.adicoes.map((_, i) => i).filter((i) => !desmarcados.has(`add:${i}`))),
    }
    const n = sel.atualizacoes.size + sel.adicoes.size + sel.remocoes.size
    if (n === 0) {
      setErroAplicar('Nada selecionado para aplicar.')
      return
    }
    setAplicando(true)
    // Princípio 7: snapshot ANTES de gravar. Sem ele, nada aplica.
    const seg = snapshotSeguranca(store, agora(), 'antes de aplicar a planilha do produtor (v2)')
    if (!seg.ok) {
      setErroAplicar(
        'Não deu para guardar a cópia de segurança antes de aplicar (armazenamento do navegador cheio) — NADA foi alterado. Exporte um backup JSON ou libere espaço em “Proteção de dados” e tente de novo.'
      )
      setAplicando(false)
      return
    }
    const r = update(
      (e) => aplicarReconciliacao(e, resolvido, sel),
      `aplicar ${n} ${n === 1 ? 'mudança' : 'mudanças'} da planilha do produtor`
    )
    if (r && r.ok === false) {
      setErroAplicar('Este evento está fechado — nada foi aplicado. Reabra na aba Fechamento.')
      setAplicando(false)
      return
    }
    setResultado({ n })
    setAplicando(false)
    setTela('aplicado')
  }

  const aplicar = () => {
    if (aplicando || !montagem) return
    setErroAplicar('')
    setAplicando(true)
    // Princípio 7: snapshot de segurança ANTES de gravar. Sem ele, nada aplica.
    const seg = snapshotSeguranca(store, agora(), 'antes de aplicar a planilha do produtor')
    if (!seg.ok) {
      setErroAplicar(
        'Não deu para guardar a cópia de segurança antes de aplicar (armazenamento do navegador cheio) — NADA foi alterado. Exporte um backup JSON ou libere espaço em “Proteção de dados” e tente de novo.'
      )
      setAplicando(false)
      return
    }
    const ids = [...sel]
    const n = ids.length
    const propostas = montagem.propostas
    // Update funcional: aplica sobre o evento mais recente (padrão do FinanceiroModal).
    const r = update(
      (e) => aplicarPropostasOrcamento(e, propostas, ids),
      `aplicar ${n} ${n === 1 ? 'mudança' : 'mudanças'} da planilha do produtor`
    )
    // Evento fechado entre a revisão e o clique: a trava do funil (updateEvento)
    // devolve { ok:false } — sem checar isso, esta tela diria "N mudanças
    // aplicadas" sobre um store intacto (o mesmo achado adversarial que já
    // mordeu a ponte do Financeiro e a simulação de cenários).
    if (r && r.ok === false) {
      setErroAplicar('Este evento está fechado — nada foi aplicado. Reabra na aba Fechamento.')
      setAplicando(false)
      return
    }
    setResultado({ n })
    setAplicando(false)
    setTela('aplicado')
  }

  // ———————————————————————————————————————————————————————— telas

  if (tela === 'aplicado' && resultado)
    return (
      <Modal title="Retorno aplicado" onClose={onClose}>
        <div className="space-y-4">
          <p className="flex items-start gap-1.5 rounded-lg border border-[rgba(0,120,42,0.25)] bg-[rgba(0,120,42,0.07)] px-3 py-2.5 text-sm text-[var(--verde-texto)]">
            <AppIcon icon={CircleCheck} size={16} className="mt-0.5 shrink-0" />
            <span>
              {resultado.n} {resultado.n === 1 ? 'mudança aplicada' : 'mudanças aplicadas'} — cópia
              de segurança de antes ficou em Proteção de dados › Versões automáticas.
            </span>
          </p>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={onClose}>
              Fechar
            </Btn>
          </div>
        </div>
      </Modal>
    )

  if (tela === 'revisarV2' && montagemV2) {
    const p = montagemV2
    const resolvido = aplicarResolucoes(p, evento, resolucoes)
    const itemPorId = (id) => evento.categorias.flatMap((c) => c.itens || []).find((it) => it.id === id)
    const catNome = (id) => (evento.categorias.find((c) => c.id === id) || {}).nome || ''
    const meta = [fmtData(evento.data), evento.local].filter(Boolean).join(' · ')
    const nAtu = resolvido.atualizacoes.filter((a) => !desmarcados.has(`atu:${a.id}`)).length
    const nAdd = resolvido.adicoes.filter((_, i) => !desmarcados.has(`add:${i}`)).length
    const nRem = resolvido.remocoes.filter((r) => !desmarcados.has(`rem:${r.id}`)).length
    const nTotal = nAtu + nAdd + nRem
    const pendente = resolvido.ambiguos.length > 0
    const nada =
      p.ambiguos.length === 0 &&
      (p.recusadas?.length ?? 0) === 0 &&
      resolvido.atualizacoes.length === 0 &&
      resolvido.adicoes.length === 0 &&
      resolvido.remocoes.length === 0

    return (
      <Modal title="Revisar retorno do produtor" onClose={onClose} wide>
        <div className="space-y-4">
          {/* ALVO em destaque (nunca deixar dúvida de onde vai gravar) */}
          <div className="rounded-lg bg-[var(--papel-2)] px-3 py-2 text-sm">
            <span className="text-[var(--tinta-3)]">Aplicando em: </span>
            <b className="text-[var(--tinta)]">{evento.nome}</b>
            {meta && <span className="text-[var(--tinta-2)]"> — {meta}</span>}
          </div>
          <p className="text-xs text-[var(--tinta-2)]">
            Marque o que deve entrar — <b>nada muda até você clicar em “Aplicar”</b>. Antes de aplicar,
            o app guarda uma cópia de segurança para você poder desfazer.
          </p>

          {/* ——— AVISOS EMPILHADOS NO TOPO ——— */}
          {p.avisoProjeto && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2.5 text-sm text-[var(--vermelho-texto)]">
              <AppIcon icon={TriangleAlert} size={15} className="mt-0.5 shrink-0" />
              <span>{p.avisoProjeto} Confira se é a planilha certa antes de aplicar.</span>
            </p>
          )}
          {p.avisosStatus.length > 0 && (
            <div className="space-y-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              {p.avisosStatus.map((a, i) => (
                <p key={i} className="flex items-start gap-1">
                  <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
                  <span>
                    Linha {a.linha} ({a.servico}): status “{a.statusInformado}” não reconhecido —{' '}
                    {a.acao === 'mantido' ? `mantido ${a.statusUsado}` : `usei ${a.statusUsado}`}.
                  </span>
                </p>
              ))}
            </div>
          )}
          {/* Linhas recusadas: estimado negativo ou ilegível. Não
              entram em nenhuma operação — a produtora corrige a planilha e
              reimporta. O item correspondente (quando casa por id) fica
              protegido: não é removido. */}
          {(p.recusadas?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-[var(--vermelho-texto)] bg-[var(--tarja-alerta-fundo)] p-3">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--vermelho-texto)]">
                <AppIcon icon={TriangleAlert} size={15} /> Linhas recusadas ({p.recusadas.length})
              </h3>
              <p className="mb-2 text-xs text-[var(--tinta-2)]">
                O valor estimado foi recusado. Estas linhas <b>não entram</b>; o item
                correspondente fica protegido (não é removido). Corrija o valor na planilha e
                reimporte.
              </p>
              <ul className="space-y-1">
                {p.recusadas.map((r, i) => (
                  <li key={i} className="break-words text-xs text-[var(--tinta)]">
                    Linha {r.linha}: {r.servico || '(sem serviço)'} — {r.original == null ? fmtBRL(r.valor) : String(r.original)} · {r.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.ambiguos.length > 0 && (
            <div className="rounded-lg border border-[var(--vermelho-texto)] bg-[var(--tarja-alerta-fundo)] p-3">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--vermelho-texto)]">
                <AppIcon icon={TriangleAlert} size={15} /> Linhas ambíguas — escolha antes de aplicar
              </h3>
              <p className="mb-2 text-xs text-[var(--tinta-2)]">
                O app não conseguiu casar estas linhas sozinho. Enquanto não resolver, os itens
                correspondentes ficam <b>protegidos</b> (não são removidos).
              </p>
              <ul className="space-y-2">
                {p.ambiguos.map((amb, i) => {
                  const res = resolucoes[i]
                  const est = amb.linha.estimado
                  return (
                    <li key={i} className="rounded-lg bg-[var(--papel)] px-3 py-2 text-sm">
                      <div className="font-medium text-[var(--tinta)]">
                        Linha {amb.linha.linha}: {amb.linha.servico || '(sem serviço)'}
                        {amb.linha.fornecedor ? ` · ${amb.linha.fornecedor}` : ''}
                        {est !== '' && est != null ? ` · ${fmtCampo('estimado', est)}` : ''}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--tinta-3)]">{amb.motivo}</div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {(amb.candidatos || []).map((cid) => {
                          const it = itemPorId(cid)
                          return (
                            <label key={cid} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`amb-${i}`}
                                checked={res?.acao === 'casar' && res?.itemId === cid}
                                onChange={() => escolherAmbiguo(i, 'casar', cid)}
                                className="accent-[var(--acento)]"
                              />
                              <span>
                                É o item já existente: <b>{it?.servico || cid}</b>
                                {it && it.estimado !== '' && it.estimado != null ? ` (${fmtCampo('estimado', it.estimado)})` : ''}
                              </span>
                            </label>
                          )
                        })}
                        {amb.categoriaId && (
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`amb-${i}`}
                              checked={res?.acao === 'novo'}
                              onChange={() => escolherAmbiguo(i, 'novo')}
                              className="accent-[var(--acento)]"
                            />
                            <span>É um item novo (adicionar)</span>
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`amb-${i}`}
                            checked={res?.acao === 'ignorar'}
                            onChange={() => escolherAmbiguo(i, 'ignorar')}
                            className="accent-[var(--acento)]"
                          />
                          <span>Ignorar esta linha</span>
                        </label>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {nada && (
            <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
              Nenhuma diferença entre a planilha e o evento — nada a aplicar.
            </p>
          )}

          {resolvido.atualizacoes.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Alterações ({resolvido.atualizacoes.length})</h3>
              <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
                {resolvido.atualizacoes.map((a) => {
                  const chave = `atu:${a.id}`
                  const marcado = !desmarcados.has(chave)
                  return (
                    <li key={a.id} className={`flex items-start gap-3 px-3 py-2.5 ${marcado ? '' : 'opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarDesmarcado(chave)}
                        className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[var(--acento)]"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-[var(--tinta)]">{a.servico}</span>
                        <ul className="mt-1 space-y-0.5 text-xs text-[var(--tinta-2)]">
                          {Object.entries(a.campos).map(([campo, m]) => (
                            <li key={campo}>
                              {ROTULO_CAMPO[campo] || campo}: {fmtCampo(campo, m.de)} → {fmtCampo(campo, m.para)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {resolvido.adicoes.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Adições ({resolvido.adicoes.length})</h3>
              <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
                {resolvido.adicoes.map((ad, i) => {
                  const chave = `add:${i}`
                  const marcado = !desmarcados.has(chave)
                  return (
                    <li key={i} className={`flex items-start gap-3 px-3 py-2.5 ${marcado ? '' : 'opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarDesmarcado(chave)}
                        className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[var(--acento)]"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-[var(--tinta)]">{ad.dados.servico || '(sem serviço)'}</span>
                        <div className="mt-1 text-xs text-[var(--tinta-2)]">
                          {catNome(ad.categoriaId)} · estimado {fmtCampo('estimado', ad.dados.estimado)}
                          {ad.dados.fornecedor ? ` · ${ad.dados.fornecedor}` : ''}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {resolvido.remocoes.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--vermelho-texto)]">
                <AppIcon icon={TriangleAlert} size={14} /> Remoções ({resolvido.remocoes.length}) — a produtora apagou estas linhas
              </h3>
              <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--vermelho-texto)]">
                {resolvido.remocoes.map((r) => {
                  const chave = `rem:${r.id}`
                  const marcado = !desmarcados.has(chave)
                  return (
                    <li key={r.id} className={`flex items-start gap-3 px-3 py-2.5 ${marcado ? '' : 'opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarDesmarcado(chave)}
                        className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[var(--acento)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--tinta)]">{r.servico}</span>
                          <Badge className="bg-[var(--tarja-alerta-fundo)] text-[var(--vermelho-texto)]">remover</Badge>
                        </div>
                        {r.estimado !== '' && r.estimado != null && (
                          <div className="mt-0.5 text-xs text-[var(--tinta-2)]">estimado {fmtCampo('estimado', r.estimado)}</div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {erroAplicar && (
            <p className="rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2.5 text-sm text-[var(--vermelho-texto)]">
              {erroAplicar}
            </p>
          )}

          {/* Alvo repetido NO PONTO DA DECISÃO (Marco): remoção destrutiva nunca
              com o alvo fora da vista — é o buraco que a rede da planilha-copiada
              existe pra fechar. O banner do topo sai da tela ao rolar; esta linha
              anda junto do botão. */}
          <p className="text-xs text-[var(--tinta-2)]">
            Vai gravar em <b className="text-[var(--tinta)]">{evento.nome}</b>
            {meta ? ` — ${meta}` : ''}.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="ghost" onClick={voltar}>
              <AppIcon icon={ArrowLeft} /> Voltar
            </Btn>
            <Btn variant="primary" disabled={aplicando || pendente || nTotal === 0} onClick={aplicarV2}>
              {pendente
                ? 'Resolva as linhas ambíguas'
                : nTotal === 0
                  ? 'Nada selecionado'
                  : `Aplicar ${nAtu} alt. · ${nAdd} adiç. · ${nRem} remoç.`}
            </Btn>
          </div>
        </div>
      </Modal>
    )
  }

  if (tela === 'revisar') {
    const propostas = montagem?.propostas || []
    const avisos = montagem?.avisos || []
    const recusadas = montagem?.recusadas || []

    if (propostas.length === 0)
      return (
        <Modal title="Revisar retorno do produtor" onClose={onClose}>
          <div className="space-y-4">
            <RecusasV1 recusadas={recusadas} />
            <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
              {recusadas.length ? 'Nenhuma mudança válida para aplicar. Confira as linhas recusadas acima.' : 'Nenhuma diferença entre a planilha e o evento — nada a aplicar.'}
            </p>
            {avisos.length > 0 && (
              <div className="space-y-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
                {avisos.map((a, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <AppIcon icon={TriangleAlert} size={13} className="mt-px" /> <span>{a}</span>
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Btn variant="primary" onClick={onClose}>
                Fechar
              </Btn>
            </div>
          </div>
        </Modal>
      )

    const nSel = [...sel].filter((id) => propostas.some((p) => p.id === id)).length
    const grupos = [
      { id: 'custo', titulo: 'Custos', itens: propostas.filter((p) => p.tipo === 'custo') },
      { id: 'patrocinio', titulo: 'Patrocínio', itens: propostas.filter((p) => p.tipo === 'patrocinio') },
    ].filter((g) => g.itens.length > 0)

    return (
      <Modal title="Revisar retorno do produtor" onClose={onClose} wide>
        <div className="space-y-4">
          <p className="text-xs text-[var(--tinta-2)]">
            Marque o que deve entrar no evento — <b>nada muda até você clicar em “Aplicar”</b>;
            fechar ou voltar não altera nada. Antes de aplicar, o app guarda uma cópia de segurança
            para você poder desfazer.
          </p>

          <RecusasV1 recusadas={recusadas} />
          {avisos.length > 0 && (
            <div className="space-y-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              {avisos.map((a, i) => (
                <p key={i} className="flex items-start gap-1">
                  <AppIcon icon={TriangleAlert} size={13} className="mt-px" /> <span>{a}</span>
                </p>
              ))}
            </div>
          )}

          {grupos.map((g) => (
            <div key={g.id}>
              <h3 className="mb-1.5 text-sm font-semibold">{g.titulo}</h3>
              <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
                {g.itens.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-start gap-3 px-3 py-2.5 ${sel.has(p.id) ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(p.id)}
                      onChange={() => alternar(p.id)}
                      className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[var(--acento)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--tinta)]">{p.rotulo}</span>
                        {p.acao === 'remover' && (
                          <Badge className="bg-[var(--tarja-alerta-fundo)] text-[var(--vermelho-texto)]">
                            remover
                          </Badge>
                        )}
                      </div>
                      {p.acao === 'alterar' && (
                        <ul className="mt-1 space-y-0.5 text-xs text-[var(--tinta-2)]">
                          {p.mudancas.map((m, i) => (
                            <li key={i}>
                              {ROTULO_CAMPO[m.campo] || m.campo}: {fmtCampo(m.campo, m.de)} →{' '}
                              {fmtCampo(m.campo, m.para)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.acao === 'novo' && (
                        <div className="mt-1 text-xs text-[var(--tinta-2)]">{detalheNovo(p)}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {erroAplicar && (
            <p className="rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2.5 text-sm text-[var(--vermelho-texto)]">
              {erroAplicar}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="ghost" onClick={voltar}>
              <AppIcon icon={ArrowLeft} /> Voltar
            </Btn>
            <Btn variant="primary" disabled={nSel === 0 || aplicando} onClick={aplicar}>
              {nSel === 0
                ? 'Nada selecionado para aplicar'
                : `Aplicar ${nSel} ${nSel === 1 ? 'mudança selecionada' : 'mudanças selecionadas'}`}
            </Btn>
          </div>
        </div>
      </Modal>
    )
  }

  // tela === 'inicial'
  return (
    <Modal title="Planilha do produtor" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--tinta-2)]">
          Gere a planilha do orçamento para o produtor ajustar — custos e patrocínio. Lotes, bar e
          taxas ficam de fora; realizado e status nunca são tocados pelo retorno.
        </p>

        <Btn variant="primary" onClick={baixarPlanilha}>
          <AppIcon icon={Download} /> Baixar planilha do orçamento (.xlsx)
        </Btn>
        {baixado && !erroBaixar && (
          <p className="text-xs text-[var(--tinta-3)]">
            Planilha baixada — nada no evento muda ao exportar.
          </p>
        )}
        {baixado && !erroBaixar && avisoLogo && (
          <p className="flex items-start gap-1.5 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
            <span>{avisoLogo}</span>
          </p>
        )}
        {erroBaixar && (
          <p className="flex items-start gap-1.5 text-xs text-[var(--vermelho-texto)]">
            <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
            <span>{erroBaixar}</span>
          </p>
        )}

        <div className="border-t border-[var(--borda)] pt-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--tinta)]">Voltou do produtor?</h3>
          {evento.status === 'fechado' ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
              <span>Evento fechado — reabra na aba Fechamento para aplicar um retorno do produtor.</span>
            </p>
          ) : (
            <>
              <div
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--borda-2)] p-8 text-center hover:border-[var(--tinta-3)]"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) onFile(f)
                }}
              >
                <AppIcon icon={FileUp} size={28} className="text-[var(--tinta-3)]" />
                <p className="text-sm font-medium">
                  {lendo ? 'Lendo planilha…' : 'Arraste a planilha .xlsx aqui ou clique para escolher'}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFile(f)
                  e.target.value = ''
                }}
              />
              {erroImport && (
                <p className="mt-3 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs text-[var(--vermelho-texto)]">
                  {erroImport}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
