import { useEffect, useRef, useState } from 'react'
import { Btn, Modal, Badge, Field, TextInput, NumInput, Select } from './ui.jsx'
import { FAIXA_QUANTIDADE } from '../lib/campoNumerico.js'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { AppIcon, FileUp, TriangleAlert, ArrowLeft } from './AppIcon.jsx'
import { parseWorkbookData, totalItens } from '../lib/xlsxImport.js'
import {
  parseBackup,
  mesclarBackup,
  eventosReabertosPorBackup,
  censoImportacao,
  textoImportacaoFeita,
  gravacaoBloqueada,
} from '../lib/storage.js'
import { censoNormalizacoes, censoDatasImpossiveis, censoDatasApagadas, avisoDeImport } from '../lib/migracao.js'
import { CATEGORIAS_PADRAO } from '../lib/defaults.js'
import { censoLotesSemPreco, textoCensoLotesSemPreco, PRECO_AUSENTE_TEXTO } from '../lib/loteSemPreco.js'
import { CAT_LABELS } from '../lib/benchmarks.js'
import { fmtBRL2, fmtInt } from '../lib/format.js'
import { num, agora } from '../lib/util.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { montarRevisaoPlanilha, revisarImportPlanilha, montarDadosImportPlanilha, aplicarImportPlanilha, desfazerImportPlanilha } from '../lib/revisaoImportPlanilha.js'

// Preserva a precisão do valor importado: totais subcentavo precisam
// continuar distinguíveis nas opções de escolha, sem arredondar o dado.
const moedaDaPlanilha = v => !Number.isFinite(v) ? 'Valor não reconhecido' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:20}).format(v)
const quantidadeDaPlanilha = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:20}).format(v)

const OPCOES_CAT = CATEGORIAS_PADRAO.map((c) => ({ value: c.key, label: c.nome }))

function ResumoDestinos({resumo,evento,benchmark}) {
  return <div className="space-y-1 text-sm" aria-label="Resumo por destino">
    {evento && <p>Evento: {resumo.evento.custos} {resumo.evento.custos === 1 ? 'custo' : 'custos'} · {resumo.evento.lotes} {resumo.evento.lotes === 1 ? 'lote' : 'lotes'} · {resumo.evento.recusas} recusas · total de custos <b className="tnum">{fmtBRL2(resumo.evento.totalCustos)}</b></p>}
    {benchmark && <p>Referência histórica: {resumo.benchmark.custos} {resumo.benchmark.custos === 1 ? 'custo' : 'custos'} · {resumo.benchmark.lotes} {resumo.benchmark.lotes === 1 ? 'lote' : 'lotes'} · {resumo.benchmark.recusas} recusas · total de custos <b className="tnum">{fmtBRL2(resumo.benchmark.totalCustos)}</b></p>}
  </div>
}

export default function ImportModal({ store, setStore, abrir, onClose }) {
  const [erro, setErro] = useState('')
  const [lendo, setLendo] = useState(false)
  const [rev, setRev] = useState(null) // estado da tela de revisão
  const fileRef = useRef(null)
  const trava = useRef(false)
  const [pendente, setPendente] = useState(null)
  const [resultado, setResultado] = useState(null)
  const assinatura = JSON.stringify(store)
  useEffect(() => {
    if (!pendente) return
    const presentes = (!pendente.recibo.evento || store.eventos?.some(e => JSON.stringify(e) === JSON.stringify(pendente.recibo.evento))) &&
      (!pendente.recibo.benchmark || store.benchmarksCustom?.some(b => JSON.stringify(b) === JSON.stringify(pendente.recibo.benchmark)))
    const ausentes = (!pendente.recibo.evento || !store.eventos?.some(e => e.id === pendente.recibo.evento.id)) &&
      (!pendente.recibo.benchmark || !store.benchmarksCustom?.some(b => b.id === pendente.recibo.benchmark.id))
    if (pendente.desfazer ? ausentes : presentes) {
      setResultado({...pendente,desfeito:!!pendente.desfazer})
      setPendente(null); trava.current = false
    } else if (assinatura !== pendente.base) {
      setErro('O estado mudou durante a operação. Confira os dados e tente novamente; nada foi confirmado.')
      setPendente(null); trava.current = false
    }
  }, [assinatura, pendente, store])

  const onFile = async (file) => {
    setErro('')
    setLendo(true)
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const backup = parseBackup(await file.text())
        // Backup de FORMATO ANTIGO (sem identidade app/versão — gravado antes
        // do carimbo de 17/07): entra, mas com aviso ANTES de aplicar (item E2,
        // 22/07/2026; princípio 4 — nada em silêncio). Mesma régua do aviso de
        // reabrir evento fechado logo abaixo.
        if (
          backup.formatoAntigo &&
          !window.confirm(
            'Este backup é de um formato ANTIGO — não traz a identificação de app/versão que os backups atuais gravam. Ele tem a forma de um backup do Planejamento de Eventos e será importado assim mesmo; confira os eventos depois de importar.\n\nContinuar? (Uma cópia de segurança é criada antes; dá para voltar em Proteção de dados.)'
          )
        ) {
          setLendo(false)
          return
        }
        // Import que REABRE festa fechada avisa antes (decisão delegada,
        // 20/07/2026): o backup vence por id, e um arquivo antigo derrubaria
        // a foto do fechamento em silêncio.
        const reabertos = eventosReabertosPorBackup(store.eventos, backup)
        if (
          reabertos.length > 0 &&
          !window.confirm(
            `Atenção: este arquivo vai REABRIR ${
              reabertos.length === 1 ? 'o evento fechado' : `${reabertos.length} eventos fechados`
            } ${reabertos.map((e) => `“${e.nome}”`).join(', ')} — a foto do fechamento será substituída pelo que está no backup.\n\nContinuar? (Uma cópia de segurança é criada antes; dá para voltar em Proteção de dados.)`
          )
        ) {
          setLendo(false)
          return
        }
        // Aviso AGREGADO (decisão do Marco, 22/07/2026 — 3a): lista o que a
        // migração vai virar em "não informado" (número fora das faixas do app),
        // ANTES de aplicar. Cancelar = nada importado. Arquivo limpo = sem aviso.
        // Dois censos, um diálogo (Marco, 07/08/2026): números fora das faixas,
        // que a migração vira em "não informado", E datas que não existem no
        // calendário, que entram COMO ESTÃO. Cada um com a sua frase — misturar
        // faria o aviso mentir sobre metade da lista.
        const aviso = avisoDeImport(
          censoNormalizacoes(backup.eventosCrus),
          censoDatasImpossiveis(backup.eventosCrus),
          censoDatasApagadas(backup.eventosCrus)
        )
        if (aviso && !window.confirm(aviso)) {
          setLendo(false)
          return
        }
        // Princípio 7 (rede de segurança ANTES de qualquer entrada externa
        // substituir dado do Marco): mesmo padrão do FinanceiroModal.aplicar —
        // sem cópia de segurança, nada é importado.
        const seg = snapshotSeguranca(store, agora(), 'antes de importar o backup JSON')
        if (!seg.ok) {
          setErro(
            'Não deu para guardar a cópia de segurança antes de importar (armazenamento do navegador cheio) — NADA foi importado. Exporte um backup JSON ou libere espaço em Proteção de dados e tente de novo.'
          )
          return
        }
        // Mesmo aviso honesto do Ajustes (Marco, 26/07/2026): o número é o que
        // ENTROU (contado no mesclarBackup), e a festa que chegou sem
        // identificação recebeu uma — com o alerta de que reimportar este mesmo
        // arquivo a traz outra vez.
        const censoDoImport = censoImportacao(store, backup)
        setStore((s) => mesclarBackup(s, backup), 'importar o backup JSON')
        window.alert(
          textoImportacaoFeita(censoDoImport, {
            lotesSemPreco: textoCensoLotesSemPreco(censoLotesSemPreco(backup.eventos)),
          })
        )
        onClose()
        return
      }
      const res = parseWorkbookData(await file.arrayBuffer())
      if (totalItens(res) === 0 && res.lotes.length === 0 && !res.descartes?.some(d => d.tipo === 'valor-invalido')) {
        setErro(
          'Nenhuma seção reconhecida na planilha. Confira se os títulos das categorias estão em caixa alta (A&B, LOCAÇÃO E DOCUMENTAÇÃO, ESTRUTURA + CENOGRAFIA, EQUIPE, ARTISTICO...).'
        )
        return
      }
      setRev(montarRevisaoPlanilha(res, file.name))
    } catch (e) {
      console.error(e)
      setErro(`Não foi possível ler o arquivo: ${e.message}`)
    } finally {
      setLendo(false)
    }
  }

  const setItem = (id, p) =>
    setRev((r) => ({ ...r, itens: r.itens.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const setLote = (id, p) =>
    setRev((r) => ({ ...r, lotes: r.lotes.map((l) => (l.id === id ? { ...l, ...p } : l)) }))

  const confirmar = () => {
    if (trava.current) return
    setErro('')
    if (gravacaoBloqueada()) {
      setErro('A gravação está bloqueada. Recupere os dados em Proteção de dados antes de importar; nada foi alterado.')
      return
    }
    const pacote = montarDadosImportPlanilha(rev)
    if (!pacote.ok) {
      setErro(`${pacote.motivo} ${(pacote.censo || []).map(c => `${c.evento} · ${c.campo}: ${c.rotulo}`).join('; ')}`)
      return
    }
    const aplicado = aplicarImportPlanilha(store, pacote)
    if (!aplicado.ok) {setErro(aplicado.motivo);return}
    const seg = snapshotSeguranca(store, agora(), 'antes de importar a planilha XLSX')
    if (!seg.ok) {
      setErro('Não deu para guardar a cópia de segurança antes de importar a planilha — nada foi importado. Libere espaço em Proteção de dados e tente novamente.')
      return
    }
    trava.current = true
    setPendente({recibo:aplicado.recibo,resumo:pacote.resumo,base:assinatura})
    setStore(s => aplicarImportPlanilha(s, pacote).store, 'importar a planilha XLSX')
  }
  const desfazer = () => {
    if (trava.current || resultado?.desfeito) return
    setErro('')
    if (gravacaoBloqueada()) {setErro('A gravação está bloqueada. Confira Proteção de dados antes de desfazer.');return}
    const r = desfazerImportPlanilha(store, resultado.recibo)
    if (!r.ok) {setErro(r.motivo);return}
    if (r.jaDesfeito) {setResultado({...resultado,desfeito:true});return}
    trava.current = true
    setPendente({...resultado,desfazer:true,base:assinatura})
    setStore(s => desfazerImportPlanilha(s, resultado.recibo).store, 'desfazer importação da planilha')
  }
  if (resultado) return (
    <Modal title={resultado.desfeito ? 'Importação desfeita' : 'Planilha importada'} onClose={onClose}>
      <div className="space-y-4">
        <p role="status">{resultado.desfeito ? 'A importação foi desfeita. As outras festas e referências foram preservadas.' : 'Importação aplicada. Confira os custos e lotes abaixo.'}</p>
        {!resultado.desfeito && <ResumoDestinos resumo={resultado.resumo} evento={!!resultado.recibo.evento} benchmark={!!resultado.recibo.benchmark} />}
        <p className="text-sm text-[var(--tinta-2)]">A cópia anterior continua em Proteção de dados → Versões automáticas → antes de importar a planilha XLSX.</p>
        {erro && <p role="alert">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Btn disabled={!!pendente || resultado.desfeito} onClick={desfazer}>Desfazer importação da planilha</Btn>
          {resultado.recibo.evento && !resultado.desfeito && <Btn disabled={!!pendente} onClick={() => {abrir(resultado.recibo.evento.id);onClose()}}>Abrir evento importado</Btn>}
          <Btn onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </Modal>
  )

  // ---------------------------------------------------------------- telas

  if (!rev) {
    return (
      <Modal title="Importar evento antigo" onClose={onClose}>
        <button
          type="button"
          disabled={lendo}
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--borda-2)] p-10 text-center hover:border-[var(--tinta-3)]"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) onFile(f)
          }}
        >
          <AppIcon icon={FileUp} size={32} className="text-[var(--tinta-3)]" />
          <span className="text-sm font-medium">
            {lendo ? 'Lendo planilha…' : 'Arraste a planilha .xlsx aqui ou clique para escolher'}
          </span>
          <span className="max-w-sm text-xs text-[var(--tinta-3)]">
            Formato das planilhas antigas: seções por categoria em caixa alta (A&B, LOCAÇÃO E
            DOCUMENTAÇÃO, ESTRUTURA + CENOGRAFIA, EQUIPE, ARTISTICO…), colunas Macro | Serviço |
            Fornecedor | Valor | Status, e aba de receita com lotes. Também aceita backup .json.
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
            fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
        {erro && <p className="mt-3 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs text-[var(--vermelho-texto)]">{erro}</p>}
      </Modal>
    )
  }

  const porCategoria = CATEGORIAS_PADRAO.map((c) => ({
    ...c,
    itens: rev.itens.filter((i) => i.cat === c.key),
  })).filter((c) => c.itens.length > 0)
  const previa = revisarImportPlanilha(rev)
  // Elegibilidade permite selecionar/desmarcar uma linha ainda pendente;
  // a prévia e o pacote acima continuam exigindo a escolha REAL do estado.
  const elegiveis = revisarImportPlanilha({...rev,itens:rev.itens.map(i => ({...i,incluir:true,incluirEvento:true,incluirBenchmark:true,conflito:i.conflito ? {...i.conflito,escolha:i.conflito.escolha || 'calculado'} : null})),lotes:rev.lotes.map(l => ({...l,incluir:true,incluirEvento:true,incluirBenchmark:true}))})

  return (
    <Modal title="Revisar importação" onClose={onClose} wide>
      <div className="space-y-5">
        {rev.avisos.length > 0 && (
          <div className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            {rev.avisos.map((a, i) => (
              <p key={i} className="flex items-start gap-1">
                <AppIcon icon={TriangleAlert} size={13} className="mt-px" /> <span>{a}</span>
              </p>
            ))}
          </div>
        )}

        {(rev.descartes.some(d => d.tipo === 'valor-invalido') || rev.recusasCelulas.length > 0) && (
          <section className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]" aria-label="Valores recusados">
            <h3 className="font-semibold">Linhas recusadas e valores não informados</h3>
            <p className="mt-1">Corrija os valores na planilha e escolha o arquivo novamente. As linhas recusadas não entram na importação.</p>
            <ul className="mt-2 space-y-1 break-words">
              {rev.descartes.filter(d => d.tipo === 'valor-invalido').flatMap((d, i) => d.celulas.map((c, j) => (
                <li key={`linha-${i}-${j}`}>Aba {d.planilha || '(sem nome)'} · linha {d.linha} · {c.campo}: <b>{String(c.original)}</b> — {c.motivo}</li>
              )))}
              {rev.recusasCelulas.map((c, i) => (
                <li key={`celula-${i}`}>Aba {c.planilha || '(sem nome)'} · linha {c.linha} · {c.campo}: <b>{String(c.original)}</b> — {c.motivo}</li>
              ))}
            </ul>
          </section>
        )}

        {/* H3-D §9.11.4: a planilha também descarta LINHA a linha (TOTAL, sem
            serviço, sem valor, fora de qualquer seção) — antes só as SEÇÕES
            desconhecidas avisavam. Discreta e colapsada (não é tão grave
            quanto uma seção inteira sumindo), mas nada some sem o Marco poder
            conferir. */}
        {rev.descartes.some(d => d.tipo !== 'valor-invalido') && (
          <details className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
            <summary className="flex cursor-pointer select-none items-center gap-1 font-medium">
              <AppIcon icon={TriangleAlert} size={13} className="shrink-0" />
              {rev.descartes.filter(d => d.tipo !== 'valor-invalido').length === 1
                ? '1 linha da planilha ficou de fora — confira'
                : `${rev.descartes.filter(d => d.tipo !== 'valor-invalido').length} linhas da planilha ficaram de fora — confira`}
            </summary>
            <ul className="mt-2 space-y-0.5 pl-1">
              {rev.descartes.filter(d => d.tipo !== 'valor-invalido').map((d, i) => (
                <li key={i}>
                  linha {d.linha} · {d.motivo}
                  {d.amostra ? ` — ${d.amostra}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-xs text-[var(--tinta-2)]">
          Abas lidas: {rev.planilhas.join(', ')} · {rev.itens.length} {rev.itens.length === 1 ? 'item' : 'itens'} de custo ·{' '}
          {rev.lotes.length} lotes lidos.
        </p>

        {previa.conflitosPendentes.length > 0 && <p role="status" className="text-sm">Escolha o total de {previa.conflitosPendentes.length} {previa.conflitosPendentes.length === 1 ? 'linha divergente' : 'linhas divergentes'}. Os totais abaixo incluem apenas as linhas já resolvidas.</p>}
        <ResumoDestinos resumo={previa.resumo} evento={rev.salvarEvento} benchmark={rev.salvarBenchmark} />
        {['evento','benchmark'].filter(d => d === 'evento' ? rev.salvarEvento : rev.salvarBenchmark).map(destino => (
          previa[destino].recusas.filter(r => r.id || r.campo === 'publico').length > 0 && <section key={destino} className="space-y-1 text-sm" aria-label={`Recusas para ${destino}`}>
            <h3 className="font-semibold">Valores recusados para {destino === 'evento' ? 'o evento' : 'a referência histórica'}</h3>
            {previa[destino].recusas.filter(r => r.id || r.campo === 'publico').map((r,i) => <p key={i} className="break-words">Aba {r.aba || '(sem nome)'} · linha {r.linha || '—'} · {r.campo}: {String(r.original)} — {r.motivo}</p>)}
          </section>
        ))}

        {porCategoria.map((c) => (
          <div key={c.key}>
            <h3 className="mb-1.5 text-sm font-semibold">
              {c.nome} <span className="font-normal text-[var(--tinta-3)]">({c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'})</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                  <tr>
                    <th className="w-8 p-2" />
                    <th className="p-2 font-medium">Serviço</th>
                    <th className="p-2 font-medium">Fornecedor</th>
                    <th className="p-2 text-right font-medium">Estimado</th>
                    <th className="p-2 text-right font-medium">Realizado</th>
                    <th className="w-28 p-2 font-medium">Status</th>
                    <th className="w-44 p-2 font-medium">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {c.itens.map((i) => (
                    <tr key={i.id} className={`border-t border-[var(--borda)] ${i.incluir ? '' : 'opacity-40'}`}>
                      <td className="p-2">
                        {['evento','benchmark'].filter(d => d === 'evento' ? rev.salvarEvento : rev.salvarBenchmark).map(d => (i.conflito && !i.conflito.escolha) || elegiveis[d].itens.some(it => it.id === i.id)
                          ? <label key={d} className="flex min-h-6 items-center gap-1 py-1"><input type="checkbox" aria-label={`Incluir ${i.servico} como ${d}`} checked={i.incluir && i[d === 'evento' ? 'incluirEvento' : 'incluirBenchmark'] !== false} onChange={e => setItem(i.id,{[d === 'evento' ? 'incluirEvento' : 'incluirBenchmark']:e.target.checked})} className="accent-[var(--acento)]" />{d === 'evento' ? 'Evento' : 'Referência'}</label>
                          : <span key={d}>Recusado para {d}</span>)}
                      </td>
                      <td className="p-2">
                        {i.servico}
                        {i.fonte?.totalCalculado != null && <p className="mt-1 text-[var(--tinta-2)]">{quantidadeDaPlanilha(i.fonte.quantidade)} × {moedaDaPlanilha(i.fonte.unitario)} = {moedaDaPlanilha(i.fonte.totalCalculado)}</p>}
                        {i.conflito && <fieldset className="mt-2 min-w-56 space-y-1 text-left">
                          <legend className="text-xs font-semibold">Total de {i.servico} · aba {i.fonte.planilha || '(sem nome)'} · linha {i.fonte.linha}</legend>
                          <label className="flex min-h-6 items-start gap-1.5 py-1"><input type="radio" name={`total-${i.id}`} aria-label={`Usar total calculado de ${i.servico}`} checked={i.conflito.escolha === 'calculado'} onChange={() => setItem(i.id,{conflito:{...i.conflito,escolha:'calculado'}})} className="mt-0.5 accent-[var(--acento)]" />Usar total calculado: {moedaDaPlanilha(i.conflito.calculado)}</label>
                          <label className="flex min-h-6 items-start gap-1.5 py-1"><input type="radio" name={`total-${i.id}`} aria-label={`Usar total informado de ${i.servico}`} checked={i.conflito.escolha === 'declarado'} onChange={() => setItem(i.id,{conflito:{...i.conflito,escolha:'declarado'}})} className="mt-0.5 accent-[var(--acento)]" />Usar total informado: {moedaDaPlanilha(i.conflito.declarado)}</label>
                          {i.conflito.escolha && <button type="button" className="min-h-6 py-1 underline" onClick={() => setItem(i.id,{conflito:{...i.conflito,escolha:null}})}>Limpar escolha de {i.servico}</button>}
                          {!elegiveis.evento.itens.some(it => it.id === i.id) && !elegiveis.benchmark.itens.some(it => it.id === i.id) && <button type="button" className="min-h-6 py-1 underline" onClick={() => setItem(i.id,{incluir:false})}>Não importar {i.servico}</button>}
                        </fieldset>}
                        {!elegiveis.evento.itens.some(it => it.id === i.id) && elegiveis.benchmark.itens.some(it => it.id === i.id) && <p className="mt-1 text-[var(--tinta-2)]">Este custo entra apenas na referência histórica.</p>}
                        {i.origem && (
                          <span className="ml-1 text-[10px] text-[var(--ambar-texto)]" title={`Seção original: ${i.origem}`}>
                            ({i.origem})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-[var(--tinta-2)]">{i.fornecedor || '—'}</td>
                      <td className="p-2 text-right tnum">{i.conflito ? (i.conflito.escolha ? moedaDaPlanilha(i.conflito[i.conflito.escolha]) : 'A escolher') : (i.estimado === '' ? '—' : Number.isFinite(i.estimado) ? fmtBRL2(i.estimado) : 'Valor não reconhecido')}</td>
                      <td className="p-2 text-right tnum">{num(i.realizado) ? fmtBRL2(i.realizado) : '—'}</td>
                      <td className="p-2">
                        <Badge style={estiloStatusCusto(i.status)}>{i.status}</Badge>
                      </td>
                      <td className="p-2">
                        <Select
                          value={i.cat}
                          onChange={(e) => setItem(i.id, { cat: e.target.value })}
                          options={OPCOES_CAT}
                          className="!py-1 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {rev.lotes.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">Lotes de ingresso</h3>
            <div className="overflow-hidden rounded-lg border border-[var(--borda)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                  <tr>
                    <th className="w-8 p-2" />
                    <th className="p-2 font-medium">Lote</th>
                    <th className="p-2 text-right font-medium">Valor unit.</th>
                    <th className="p-2 text-right font-medium">Qtd</th>
                    <th className="p-2 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {rev.lotes.map((l) => (
                    <tr key={l.id} className={`border-t border-[var(--borda)] ${l.incluir ? '' : 'opacity-40'}`}>
                      <td className="p-2">
                        {['evento','benchmark'].filter(d => d === 'evento' ? rev.salvarEvento : rev.salvarBenchmark).map(d => elegiveis[d].lotes.some(it => it.id === l.id)
                          ? <label key={d} className="flex min-h-6 items-center gap-1 py-1"><input type="checkbox" aria-label={`Incluir lote ${l.nome} como ${d}`} checked={l.incluir && l[d === 'evento' ? 'incluirEvento' : 'incluirBenchmark'] !== false} onChange={e => setLote(l.id,{[d === 'evento' ? 'incluirEvento' : 'incluirBenchmark']:e.target.checked})} className="accent-[var(--acento)]" />{d === 'evento' ? 'Evento' : 'Referência'}</label>
                          : <span key={d} className="block">Recusado para {d === 'evento' ? 'evento' : 'referência'}</span>)}
                      </td>
                      <td className="p-2">{l.nome}</td>
                      <td className="p-2 text-right tnum">{l.valor === '' ? PRECO_AUSENTE_TEXTO : fmtBRL2(l.valor)}</td>
                      <td className="p-2 text-right tnum">{fmtInt(l.quantidade)}</td>
                      <td className="p-2 text-[var(--tinta-3)]">
                        {/* P2 da S7 (Marco, 06/10/2026): célula de preço vazia
                            importa como lote sem preço, fora da conta. As
                            observações saem separadas por " · " (revisão
                            adversarial da S7): coladas, um lote porta sem preço
                            lia "…até ter preçolote porta → só otimista". */}
                        {[
                          l.valor === '' ? 'sem preço na planilha — fica fora do público e do bar até ter preço' : '',
                          l.valor === 0 ? 'cortesia' : '',
                          l.somenteOtimista ? 'lote porta → só otimista' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--borda)] bg-[var(--papel-2)] p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Nome do evento" className="min-w-52 flex-1">
              <TextInput value={rev.nome} onChange={(e) => setRev((r) => ({ ...r, nome: e.target.value }))} />
            </Field>
            <Field label="Público (p/ custo por pessoa)" className="w-44">
              <NumInput
                value={rev.publico}
                onChange={(v) => setRev((r) => ({ ...r, publico: v }))}
                min="0"
                step="1"
                placeholder="opcional"
                faixa={FAIXA_QUANTIDADE}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rev.salvarEvento}
                onChange={(e) => setRev((r) => ({ ...r, salvarEvento: e.target.checked }))}
                className="size-4 accent-[var(--acento)]"
              />
              Salvar como evento (editável)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rev.salvarBenchmark}
                onChange={(e) => setRev((r) => ({ ...r, salvarBenchmark: e.target.checked }))}
                className="size-4 accent-[var(--acento)]"
              />
              Adicionar aos benchmarks de comparação
            </label>
          </div>
        </div>

        {erro && <p role="alert" className="break-words text-sm">{erro}</p>}
        {pendente && <p role="status">Aguardando confirmação dos dados no app…</p>}
        <div className="flex justify-end gap-2">
          <Btn disabled={!!pendente} onClick={() => {setRev(null);setErro('')}}><AppIcon icon={ArrowLeft} /> Escolher outro arquivo</Btn>
          <Btn
            variant="primary"
            disabled={!!pendente || !previa.podeAplicar}
            onClick={confirmar}
          >
            {previa.podeAplicar ? `Importar ${rev.salvarEvento ? `${previa.evento.itens.length} ${previa.evento.itens.length === 1 ? 'custo' : 'custos'} e ${previa.evento.lotes.length} ${previa.evento.lotes.length === 1 ? 'lote' : 'lotes'} como evento` : ''}${rev.salvarEvento && rev.salvarBenchmark ? ' e ' : ''}${rev.salvarBenchmark ? 'referência histórica' : ''}` : previa.conflitosPendentes.length ? 'Escolha o total das linhas divergentes' : 'Nenhuma linha válida para importar'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
