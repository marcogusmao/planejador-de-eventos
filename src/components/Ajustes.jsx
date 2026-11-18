// Tela "Ajustes" (Sessão P): HUB de configurações do app, por decisão do
// Marco em 18/07/2026 — nasce organizada em seções extensíveis:
//   1. Premissas por festa (sugestão 20 — aqui, completa)
//   2. Custos padrão por festa (sugestão 21 — aqui, completa)
//   3. Proteção de dados (atalho para o modal da Sessão C — não reimplementa)
//   4. Backup (exportar/importar JSON existentes + data do último export)
//   5. Aparência (espaço reservado — Sessão K / sugestão 26)
//   6. Benchmarks — lista dos ocultos das comparações, com "mostrar de novo"
//      (Sessão Q / sugestão 25 — aqui, completa)
import { useRef, useState } from 'react'
import { Btn, Card, Field, PctInput, NumInput, Badge, TextInput, MoneyInput, Select, Segmented, Bola, EtiquetaSemReserva } from './ui.jsx'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { AppIcon, Settings, ShieldCheck, ArrowLeft, RefreshCw, Eye, X } from './AppIcon.jsx'
import {
  SWATCHES_MARCA,
  CORES_FESTA_PADRAO,
  COR_FESTA_LIVRE,
  ACENTO_PADRAO,
  corFesta,
  corAcento,
} from '../lib/aparencia.js'
import { CENARIOS, CENARIO_LABEL, MARGEM_ALVO_PADRAO, MARGEM_MINIMA_PADRAO } from '../lib/calc.js'
import { TIPOS_PADRAO, CATEGORIAS_PADRAO } from '../lib/defaults.js'
import {
  formaAjustes,
  premissaVazia,
  resolverPremissas,
  temPremissas,
  CAMPOS_GRADE,
  novoCustoPadrao,
  novoLotePadrao,
} from '../lib/premissas.js'
import {
  exportBackup,
  parseBackup,
  mesclarBackup,
  eventosReabertosPorBackup,
  censoImportacao,
  textoImportacaoFeita,
} from '../lib/storage.js'
import { censoNormalizacoes, censoDatasImpossiveis, censoDatasApagadas, avisoDeImport } from '../lib/migracao.js'
import {
  benchmarksOcultosLista,
  mostrarBenchmark,
  benchmarksApagadosLista,
  restaurarBenchmarkApagado,
  apagarBenchmarkEmbutido,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import { showToast } from '../lib/toast.js'
import { CENARIO_TONS } from './Charts.jsx'
import { fmtCompact } from '../lib/format.js'
import {
  loadUltimoExport,
  marcarExportAgora,
  statusBackup,
  restaurarEventoDaLixeira,
  restaurarComoCopiaDaLixeira,
  snapshotSeguranca,
} from '../lib/protecao.js'
import {
  enviarBackupExterno,
  marcarEnvioAgora,
  MSG_BACKUP_SEM_DADOS,
  MSG_BACKUP_SEM_TOKEN,
  MSG_BACKUP_TOKEN_RECUSADO,
  msgBackupOrigemErrada,
  textoBackupAutomatico,
} from '../lib/backupExterno.js'
import { loadChavePonte, saveChavePonte } from '../lib/chavePonte.js'
import { origemNaNuvem, FRASE_PONTE_SO_NO_MAC, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import { fmtData } from '../lib/format.js'
import {
  FAIXA_PCT,
  FAIXA_CENARIO,
  FAIXA_VENDA,
  FAIXA_DIAS,
  FAIXA_CUSTO,
  FAIXA_PRECO,
  FAIXA_QUANTIDADE,
} from '../lib/campoNumerico.js'
import { agora } from '../lib/util.js'
import ProtecaoModal from './ProtecaoModal.jsx'
import { censoLotesSemPreco, textoCensoLotesSemPreco } from '../lib/loteSemPreco.js'

const GRADE_LABEL = {
  vendaPct: 'Ingressos vendidos (%)',
  custoPct: 'Ajuste de custos (%)',
  ticketPct: 'Ajuste do ticket (%)',
}

// Trava da grade de cenário POR CAMPO (decisão do Marco, 22/07/2026 — 3b):
// vendaPct é ABSOLUTO (% do lote vendido) → 0..100 (FAIXA_VENDA); custoPct/
// ticketPct são AJUSTES relativos → −50..100 (FAIXA_CENARIO, negativo de
// propósito).
const FAIXA_GRADE = {
  vendaPct: FAIXA_VENDA,
  custoPct: FAIXA_CENARIO,
  ticketPct: FAIXA_CENARIO,
}

const CAMPOS_EVENTO_UI = [
  ['taxaBilheteria', 'Taxa da bilheteria (%)'],
  ['cashbackPct', 'Cashback Tiqueteira (%)'],
  ['contingenciaPct', 'Contingência (%)'],
  ['descontoMedioPct', 'Desconto do cupom (%)'],
  ['margemAlvo', 'Margem alvo (%)'],
  ['margemMinima', 'Margem mínima (%)'],
]

// Trava dos percentuais (decisão do Marco, 20/07/2026): os quatro campos de
// conta vivem em 0..100 — o campo recusa fora disso, com aviso. As margens do
// semáforo ficam FORA da trava de propósito (não são conta, só régua de cor;
// nenhuma decisão as cobriu).
const FAIXA_CAMPO = {
  taxaBilheteria: FAIXA_PCT,
  cashbackPct: FAIXA_PCT,
  contingenciaPct: FAIXA_PCT,
  descontoMedioPct: FAIXA_PCT,
}

// Rótulos dos campos de escolha da sugestão 29c ('' = herda, como os demais).
const MODO_DESCONTO_LABEL = { '': 'herda', pct: '% dos ingressos', numero: 'nº de ingressos' }
const TAXA_PAGA_LABEL = { '': 'herda', nos: 'por nós', cliente: 'pelo cliente' }

// Identidade dos cenários — mesma dos gráficos (Charts.jsx), que não fala a
// língua do semáforo: pessimista âmbar · realista azul · otimista rosa.
const TONE = {
  pessimista: CENARIO_TONS.light.pessimista.dot,
  realista: CENARIO_TONS.light.realista.dot,
  otimista: CENARIO_TONS.light.otimista.dot,
}

// Placeholder do campo em branco: o valor EFETIVO herdado. Margens e desconto
// têm padrão '' no app — o efeito real é 28/20 (veredito) e 0% (desconto).
function placeholderDe(res, campo) {
  const v = res.valor
  if (v !== '' && v != null) return String(v)
  if (campo === 'margemAlvo') return String(MARGEM_ALVO_PADRAO)
  if (campo === 'margemMinima') return String(MARGEM_MINIMA_PADRAO)
  // fração vazia = cupom em todos os ingressos (sugestão 29a)
  if (campo === 'descontoIngressosValor') return 'todos'
  // sem premissa de início de vendas (sugestão 30) — nada muda na curva
  if (campo === 'vendasAbremDiasAntes') return 'sem'
  return '0'
}

const ORIGEM_LABEL = { tipo: 'desta festa', geral: 'herdado do Padrão geral', app: 'padrão do app' }

// Uma linha da seção Aparência (sugestão 26): bola de amostra, swatches da
// paleta oficial, cor livre e "voltar ao padrão da marca". Botões dizem a
// ação e o efeito (princípio 7).
function LinhaCor({ rotulo, cor, padrao, escolhida, onEscolher, onPadrao }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--borda)] py-2.5 last:border-0">
      <Bola cor={cor} size={18} title={`Cor atual: ${cor}`} />
      <span className="w-44 text-sm font-medium text-[var(--tinta)]">{rotulo}</span>
      <div className="flex items-center gap-1.5">
        {SWATCHES_MARCA.map((s) => (
          <button
            key={s.cor}
            type="button"
            onClick={() => onEscolher(s.cor)}
            title={`${s.nome} da marca (${s.cor})`}
            aria-label={`Usar ${s.nome} para ${rotulo}`}
            className={`h-6 w-6 cursor-pointer rounded-full border border-[var(--borda-2)] transition-transform hover:scale-110 ${
              cor === s.cor ? 'ring-2 ring-[var(--tinta)] ring-offset-1' : ''
            }`}
            style={{ background: s.cor }}
          />
        ))}
        <label
          className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--tinta-2)]"
          title="Escolher uma cor livre, fora da paleta da marca"
        >
          <input
            type="color"
            value={cor}
            onChange={(e) => onEscolher(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-[var(--borda-2)] bg-transparent p-0"
          />
          cor livre
        </label>
      </div>
      {escolhida && (
        <Btn variant="ghost" onClick={onPadrao} title={`Volta para ${padrao}`}>
          <AppIcon icon={RefreshCw} /> Voltar ao padrão da marca
        </Btn>
      )}
    </div>
  )
}

export default function Ajustes({ store, setStore, aparencia, setAparencia, onBack }) {
  const ajustes = formaAjustes(store.ajustes)
  // null = "Padrão geral"; string = tipo de festa
  const [festa, setFesta] = useState(null)
  const [protecao, setProtecao] = useState(false)
  const [ultimoExport, setUltimoExport] = useState(loadUltimoExport)
  const backupRef = useRef(null)

  const tiposCustom = [
    ...new Set([
      ...Object.keys(ajustes.porTipo),
      ...store.eventos.map((e) => e.tipo).filter((t) => t && t.trim()),
    ]),
  ]
    .filter((t) => !TIPOS_PADRAO.includes(t))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const premissaAtual = festa == null ? ajustes.geral : ajustes.porTipo[festa] || premissaVazia()
  // Placeholder do que um campo em branco herdaria: para um TIPO é a cadeia
  // geral → app (resolver com tipo ''); para o Padrão geral, os padrões do
  // app (resolver com ajustes sem geral).
  const herdado =
    festa == null ? resolverPremissas(null, '') : resolverPremissas(ajustes, '')
  const efetivo = resolverPremissas(ajustes, festa ?? '')

  // 2º argumento = rótulo do passo de desfazer (opcional — ver App.jsx). Sem
  // ele, o rótulo vem do campo em foco: "Desfazer: mudar Margem alvo".
  const setAjustes = (fn, descritor) =>
    setStore((s) => ({ ...s, ajustes: fn(formaAjustes(s.ajustes)) }), descritor)

  const setCampoPremissa = (patchFn) =>
    setAjustes((a) =>
      festa == null
        ? { ...a, geral: patchFn(a.geral) }
        : {
            ...a,
            porTipo: { ...a.porTipo, [festa]: patchFn(a.porTipo[festa] || premissaVazia()) },
          }
    )

  const setCampoEvento = (campo, v) => setCampoPremissa((p) => ({ ...p, [campo]: v }))
  const setCampoGrade = (cen, campo, v) =>
    setCampoPremissa((p) => ({
      ...p,
      cenarios: { ...p.cenarios, [cen]: { ...p.cenarios[cen], [campo]: v } },
    }))

  // Custos padrão (sugestão 21) — sempre updates FUNCIONAIS de ponta a ponta
  // (lição do achado S3 do BACKLOG: nada de array capturado no render).
  const addCustoPadrao = () =>
    setCampoPremissa((p) => ({ ...p, custosPadrao: [...p.custosPadrao, novoCustoPadrao()] }))
  const setCustoPadrao = (id, patch) =>
    setCampoPremissa((p) => ({
      ...p,
      custosPadrao: p.custosPadrao.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  const rmCustoPadrao = (id) =>
    setCampoPremissa((p) => ({
      ...p,
      custosPadrao: p.custosPadrao.filter((c) => c.id !== id),
    }))

  // Lotes padrão (sugestão 32) — irmãos dos custos padrão, mesmos updates
  // funcionais de ponta a ponta (lição do achado S3 do BACKLOG).
  const addLotePadrao = () =>
    setCampoPremissa((p) => ({ ...p, lotesPadrao: [...p.lotesPadrao, novoLotePadrao()] }))
  const setLotePadrao = (id, patch) =>
    setCampoPremissa((p) => ({
      ...p,
      lotesPadrao: p.lotesPadrao.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  const rmLotePadrao = (id) =>
    setCampoPremissa((p) => ({
      ...p,
      lotesPadrao: p.lotesPadrao.filter((l) => l.id !== id),
    }))

  const novaFesta = () => {
    const nome = window
      .prompt('Nome da festa nova (ela ganha premissas próprias e aparece ao criar evento):')
      ?.trim()
    if (!nome) return
    setFesta(nome)
    setAjustes((a) =>
      a.porTipo[nome] ? a : { ...a, porTipo: { ...a.porTipo, [nome]: premissaVazia() } }
    )
  }

  const exportar = () => {
    exportBackup(store)
    marcarExportAgora()
    setUltimoExport(loadUltimoExport())
  }

  // Backup externo manual (hardening 1.1): mesmo payload do export, enviado
  // ao Financeiro local. Reenvio no mesmo dia sobrescreve o arquivo do dia —
  // nunca duplica. Resultado (bom ou ruim) sempre aparece na linha de status.
  const [backupExterno, setBackupExterno] = useState(null)

  // Token da ponte (H2-B): o Financeiro exige o token local em toda gravação
  // — o Marco cola aqui o conteúdo de token_ponte.txt (pasta do Financeiro),
  // uma vez; fica neste navegador (localStorage), fora do backup JSON.
  const [chavePonte, setChavePonte] = useState(loadChavePonte())
  const [chaveStatus, setChaveStatus] = useState(null)
  const salvarChavePonte = () => {
    const salva = saveChavePonte(chavePonte)
    setChavePonte(salva)
    setChaveStatus(
      salva
        ? 'Token salvo neste navegador. O backup (diário e o botão manual) passa a enviá-lo ao Financeiro.'
        : 'Token removido. Sem ele o Financeiro recusa o backup externo — cole o conteúdo de token_ponte.txt para reativar.'
    )
  }

  const enviarAgora = async () => {
    setBackupExterno({ tom: 'info', texto: 'Enviando o backup ao Financeiro…' })
    const r = await enviarBackupExterno(store)
    if (r.ok) {
      marcarEnvioAgora()
      setBackupExterno({
        tom: 'ok',
        texto: `Backup gravado na pasta de backups do Financeiro: ${r.arquivo}${
          r.googleDrive ? ' (espelhado no Google Drive)' : ''
        }. Enviar de novo hoje sobrescreve esse mesmo arquivo.`,
      })
    } else if (r.motivo === 'sem-dados') {
      // §9.11 nº 5: nada foi para a rede — o arquivo do dia lá continua o bom.
      setBackupExterno({ tom: 'erro', texto: MSG_BACKUP_SEM_DADOS })
    } else if (r.motivo === 'sem-token') {
      setBackupExterno({ tom: 'erro', texto: MSG_BACKUP_SEM_TOKEN })
    } else if (r.motivo === 'token') {
      setBackupExterno({ tom: 'erro', texto: MSG_BACKUP_TOKEN_RECUSADO })
    } else if (r.motivo === 'origem') {
      // Correção S2: o navegador barrou por CORS (app fora da 4173). Culpar o
      // Financeiro aqui era a mentira que fazia o Marco reabrir o que já estava
      // aberto — a mensagem traz a origem real em que o app está.
      setBackupExterno({ tom: 'erro', texto: msgBackupOrigemErrada(r.origem) })
    } else if (r.motivo === 'fechado') {
      setBackupExterno({
        tom: 'erro',
        texto:
          'O Financeiro está fechado — nada foi enviado. Abra o “Iniciar Financeiro.command” e tente de novo. Seus dados continuam salvos neste navegador.',
      })
    } else {
      setBackupExterno({
        tom: 'erro',
        texto:
          'O Financeiro respondeu com erro e o backup NÃO foi gravado lá. Tente de novo; se continuar, confira se os dois apps estão atualizados.',
      })
    }
  }

  const importarBackup = async (file) => {
    try {
      const backup = parseBackup(await file.text())
      // Backup de FORMATO ANTIGO (sem identidade app/versão — gravado antes do
      // carimbo de 17/07): entra, mas com aviso ANTES de aplicar (item E2,
      // 22/07/2026; princípio 4 — nada em silêncio). Mesma régua do aviso de
      // reabrir evento fechado logo abaixo.
      if (
        backup.formatoAntigo &&
        !window.confirm(
          'Este backup é de um formato ANTIGO — não traz a identificação de app/versão que os backups atuais gravam. Ele tem a forma de um backup do Planejamento de Eventos e será importado assim mesmo; confira os eventos depois de importar.\n\nContinuar? (Uma cópia de segurança é criada antes; dá para voltar em Proteção de dados.)'
        )
      )
        return
      // Import que REABRE festa fechada avisa antes (decisão delegada,
      // 20/07/2026): o backup vence por id, e um arquivo antigo derrubaria a
      // foto do fechamento em silêncio.
      const reabertos = eventosReabertosPorBackup(store.eventos, backup)
      if (
        reabertos.length > 0 &&
        !window.confirm(
          `Atenção: este arquivo vai REABRIR ${
            reabertos.length === 1 ? 'o evento fechado' : `${reabertos.length} eventos fechados`
          } ${reabertos.map((e) => `“${e.nome}”`).join(', ')} — a foto do fechamento será substituída pelo que está no backup.\n\nContinuar? (Uma cópia de segurança é criada antes; dá para voltar em Proteção de dados.)`
        )
      )
        return
      // Aviso AGREGADO (decisão do Marco, 22/07/2026 — 3a): lista o que a
      // migração vai virar em "não informado" (número fora das faixas do app),
      // ANTES de aplicar. Cancelar = nada importado. Arquivo limpo = sem aviso.
      const aviso = avisoDeImport(
        censoNormalizacoes(backup.eventosCrus),
        censoDatasImpossiveis(backup.eventosCrus),
        censoDatasApagadas(backup.eventosCrus)
      )
      if (aviso && !window.confirm(aviso)) return
      // Princípio 7 (rede de segurança ANTES de qualquer entrada externa
      // substituir dado do Marco): mesmo padrão do FinanceiroModal.aplicar —
      // sem cópia de segurança, nada é importado.
      const seg = snapshotSeguranca(store, agora(), 'antes de importar o backup JSON')
      if (!seg.ok) {
        window.alert(
          'Não deu para guardar a cópia de segurança antes de importar (armazenamento do navegador cheio) — NADA foi importado. Exporte um backup JSON ou libere espaço em Proteção de dados e tente de novo.'
        )
        return
      }
      // O aviso conta o que ENTROU, não o tamanho do arquivo (Marco,
      // 26/07/2026): o censo sai do próprio mesclarBackup, e a festa que
      // chegou sem identificação recebeu uma — o texto diz quantas foram e
      // que reimportar este mesmo arquivo as traz outra vez.
      const censoDoImport = censoImportacao(store, backup)
      setStore((s) => mesclarBackup(s, backup), 'importar o backup JSON')
      window.alert(
        textoImportacaoFeita(censoDoImport, {
          benchmarks: backup.benchmarksCustom.length,
          ajustes: !!backup.ajustes,
          lotesSemPreco: textoCensoLotesSemPreco(censoLotesSemPreco(backup.eventos)),
        })
      )
    } catch (e) {
      window.alert(`Não foi possível importar o backup: ${e.message}`)
    }
  }

  // Mesma transação inteira da Home (store + lixeira num passo só, sem passo
  // de desfazer pela metade): a lixeira é o caminho de volta desta ação.
  const restaurarEvento = (itemId) =>
    restaurarEventoDaLixeira(itemId, store, (fn, motivo) =>
      setStore(fn, { foraDoHistorico: true, rotulo: motivo })
    )
  // Saída do item zumbi (gêmea viva no store): volta como cópia, id novo.
  const restaurarEventoComoCopia = (itemId) =>
    restaurarComoCopiaDaLixeira(itemId, (fn, motivo) =>
      setStore(fn, { foraDoHistorico: true, rotulo: motivo })
    )
  const restaurarStore = (novoStore) => setStore(() => novoStore, 'restaurar um snapshot')

  const bkStatus = statusBackup(ultimoExport)

  const chipFesta = (valor, rotulo) => {
    const ativa = festa === valor
    const tem = valor == null ? temPremissas(ajustes.geral) : temPremissas(ajustes.porTipo[valor])
    return (
      <button
        key={rotulo}
        type="button"
        onClick={() => setFesta(valor)}
        className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          ativa
            ? 'border-[var(--ativo-fundo)] bg-[var(--ativo-fundo)] text-[var(--ativo-texto)]'
            : 'border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-2)] hover:border-[var(--tinta-3)]'
        }`}
      >
        {rotulo}
        {tem && <Bola size={8} cor="var(--ambar-texto)" className="ml-1.5" />}
      </button>
    )
  }

  const secoes = [
    ['premissas', 'Premissas por festa'],
    ['custos-padrao', 'Custos padrão'],
    ['lotes-padrao', 'Lotes padrão'],
    ['protecao', 'Proteção de dados'],
    ['backup', 'Backup'],
    ['aparencia', 'Aparência'],
    ['benchmarks', 'Benchmarks'],
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={onBack}>
          <AppIcon icon={ArrowLeft} /> Início
        </Btn>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <AppIcon icon={Settings} size={20} /> Ajustes
        </h1>
        <span className="ml-auto text-xs text-[var(--tinta-3)]">Salvo automaticamente</span>
      </div>
      <p className="mb-4 px-2 text-sm text-[var(--tinta-2)]">
        Configurações do app, em um lugar só. Premissas e custos padrão valem para eventos{' '}
        <strong>novos</strong> — nenhum evento existente muda por aqui.
      </p>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-[var(--borda)] pb-2">
        {secoes.map(([id, label]) => (
          <a
            key={id}
            href={`#ajustes-${id}`}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--tinta-2)] hover:bg-[var(--papel)] hover:text-[var(--tinta)]"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-5">
        <Card className="p-4" id="ajustes-premissas">
          <h2 className="text-sm font-semibold">Premissas por festa</h2>
          <p className="mb-3 mt-0.5 max-w-3xl text-xs text-[var(--tinta-3)]">
            Valores com que todo evento <strong>novo</strong> da festa nasce: grade dos cenários,
            margens do semáforo, desconto do cupom e ingressos com desconto, contingência, taxa
            (e quem a paga) e cashback. Campo em branco ={' '}
            herda (festa → Padrão geral → padrões do app). Vale só no nascimento — evento
            existente nunca muda, e tudo continua editável dentro do evento.{' '}
            <Bola size={8} cor="var(--ambar-texto)" className="inline-block align-middle" /> = tem
            premissa própria.
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {chipFesta(null, 'Padrão geral')}
            {TIPOS_PADRAO.map((t) => chipFesta(t, t))}
            {tiposCustom.map((t) => chipFesta(t, t))}
            <button
              type="button"
              onClick={novaFesta}
              className="cursor-pointer rounded-full border border-dashed border-[var(--borda-2)] px-3 py-1.5 text-xs font-medium text-[var(--tinta-2)] hover:border-[var(--tinta-3)] hover:text-[var(--tinta)]"
            >
              + Outra festa…
            </button>
          </div>

          <h3 className="mb-2 text-xs font-semibold text-[var(--tinta-2)]">
            Grade dos cenários {festa == null ? 'do Padrão geral' : `de ${festa}`}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CENARIOS.map((cen) => (
              <div key={cen}>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <Bola size={10} cor={TONE[cen]} />
                  {CENARIO_LABEL[cen]}
                </div>
                <div className="space-y-2">
                  {CAMPOS_GRADE.map((campo) => (
                    <Field key={campo} label={GRADE_LABEL[campo]}>
                      <PctInput
                        value={premissaAtual.cenarios[cen][campo]}
                        onChange={(v) => setCampoGrade(cen, campo, v)}
                        placeholder={placeholderDe(herdado.cenarios[cen][campo], campo)}
                        faixa={FAIXA_GRADE[campo]}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-5 text-xs font-semibold text-[var(--tinta-2)]">
            Premissas do evento {festa == null ? 'no Padrão geral' : `de ${festa}`}
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {CAMPOS_EVENTO_UI.map(([campo, label]) => (
              <Field key={campo} label={label}>
                <PctInput
                  value={premissaAtual[campo]}
                  onChange={(v) => setCampoEvento(campo, v)}
                  placeholder={placeholderDe(herdado[campo], campo)}
                  faixa={FAIXA_CAMPO[campo]}
                />
              </Field>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-xs font-semibold text-[var(--tinta-2)]">
            Bilheteria — desconto parcial e taxa (sugestão 29)
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field label="Ingressos c/ desconto — modo">
              <Select
                value={premissaAtual.descontoIngressosModo}
                onChange={(e) => setCampoEvento('descontoIngressosModo', e.target.value)}
                options={['', 'pct', 'numero'].map((v) => ({
                  value: v,
                  label: MODO_DESCONTO_LABEL[v],
                }))}
              />
            </Field>
            <Field label="Ingressos c/ desconto — valor">
              {/* No modo nº o valor é CONTAGEM de ingressos, não percentual —
                  a faixa 0..100 só vale no modo % (decisão de 20/07/2026). */}
              <PctInput
                value={premissaAtual.descontoIngressosValor}
                onChange={(v) => setCampoEvento('descontoIngressosValor', v)}
                placeholder={placeholderDe(herdado.descontoIngressosValor, 'descontoIngressosValor')}
                faixa={
                  efetivo.descontoIngressosModo.valor === 'numero' ? undefined : FAIXA_PCT
                }
              />
            </Field>
            <Field label="Taxa paga por">
              <Select
                value={premissaAtual.taxaPagaPor}
                onChange={(e) => setCampoEvento('taxaPagaPor', e.target.value)}
                options={['', 'nos', 'cliente'].map((v) => ({
                  value: v,
                  label: TAXA_PAGA_LABEL[v],
                }))}
              />
            </Field>
            {/* Sugestão 30 (Sessão F2-S): a previsão nova nasce com este N e
                o início de vendas efetivo vira "data da festa − N dias"
                enquanto o campo de data (aba Receita) estiver vazio. */}
            <Field label="Vendas abrem (dias antes)">
              <NumInput
                value={premissaAtual.vendasAbremDiasAntes}
                onChange={(v) => setCampoEvento('vendasAbremDiasAntes', v)}
                placeholder={placeholderDe(herdado.vendasAbremDiasAntes, 'vendasAbremDiasAntes')}
                min="0"
                step="1"
                faixa={FAIXA_DIAS}
              />
            </Field>
          </div>
          <p className="mt-3 text-[11px] text-[var(--tinta-3)]">
            Nascendo hoje, um evento {festa == null ? 'sem categoria' : `de ${festa}`} usa:{' '}
            {CAMPOS_EVENTO_UI.map(([campo, label]) => {
              const r = efetivo[campo]
              return `${label.replace(' (%)', '')} ${placeholderDe(r, campo)}% (${ORIGEM_LABEL[r.origem]})`
            }).join(' · ')}
            {' · '}Ingressos com desconto:{' '}
            {efetivo.descontoIngressosModo.valor === 'numero'
              ? `${placeholderDe(efetivo.descontoIngressosValor, 'descontoIngressosValor')} nº`
              : efetivo.descontoIngressosValor.valor === ''
                ? 'todos'
                : `${efetivo.descontoIngressosValor.valor}%`}{' '}
            ({ORIGEM_LABEL[efetivo.descontoIngressosValor.origem]}) · Taxa paga{' '}
            {TAXA_PAGA_LABEL[efetivo.taxaPagaPor.valor] === 'herda'
              ? 'por nós'
              : TAXA_PAGA_LABEL[efetivo.taxaPagaPor.valor]}{' '}
            ({ORIGEM_LABEL[efetivo.taxaPagaPor.origem]}) · Vendas abrem{' '}
            {efetivo.vendasAbremDiasAntes.valor === ''
              ? 'sem premissa (início de vendas fica em branco)'
              : `${efetivo.vendasAbremDiasAntes.valor} dias antes da festa (${ORIGEM_LABEL[efetivo.vendasAbremDiasAntes.origem]})`}
            . Trocar a festa de um evento já criado não reaplica premissas — elas agem só no
            nascimento.
          </p>
        </Card>

        <Card className="p-4" id="ajustes-custos-padrao">
          <h2 className="text-sm font-semibold">
            Custos padrão {festa == null ? 'do Padrão geral' : `de ${festa}`}
          </h2>
          <p className="mb-3 mt-0.5 max-w-3xl text-xs text-[var(--tinta-3)]">
            Custos com que todo evento <strong>novo</strong> da festa nasce (status ORÇAR),
            definidos por você — nada é copiado de evento nenhum, e eventos existentes não
            mudam. A festa é a selecionada na seção Premissas, acima. Festa sem lista própria usa
            a lista do Padrão geral; com lista própria, usa só a dela.
          </p>
          {premissaAtual.custosPadrao.length === 0 && (
            <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
              {festa != null && ajustes.geral.custosPadrao.length > 0
                ? `Sem lista própria — um evento novo de ${festa} nasce com os ${ajustes.geral.custosPadrao.length} custo(s) padrão do Padrão geral.`
                : 'Nenhum custo padrão ainda — eventos novos nascem sem custos lançados, como sempre.'}
            </p>
          )}
          {premissaAtual.custosPadrao.length > 0 && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                    <th className="w-52 py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="w-36 py-2 pr-3 font-medium">Valor estimado</th>
                    <th className="w-24 py-2 pr-3 font-medium">Status</th>
                    <th className="w-10 py-2 font-medium" aria-label="Remover" />
                  </tr>
                </thead>
                <tbody>
                  {premissaAtual.custosPadrao.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--borda)]">
                      <td className="py-1.5 pr-3">
                        <Select
                          value={c.categoria}
                          onChange={(e) => setCustoPadrao(c.id, { categoria: e.target.value })}
                          options={CATEGORIAS_PADRAO.map((cat) => ({ value: cat.key, label: cat.nome }))}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <TextInput
                          value={c.servico}
                          onChange={(e) => setCustoPadrao(c.id, { servico: e.target.value })}
                          placeholder="ex.: Alvará"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <MoneyInput
                          value={c.estimado}
                          onChange={(v) => setCustoPadrao(c.id, { estimado: v })}
                          placeholder="a orçar"
                          faixa={FAIXA_CUSTO}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge style={estiloStatusCusto('ESTIMADO')}>ESTIMADO</Badge>
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => rmCustoPadrao(c.id)}
                          // B3 (BACKLOG S4): hover:bg-red-50/hover:text-red-700
                          // fixos viravam um clarão rosa sobre o papel escuro
                          // no hover — mesmos tokens tema-aware da tarja de alerta.
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[var(--tinta-3)] hover:bg-[var(--tarja-alerta-fundo)] hover:text-[var(--vermelho-texto)]"
                          title="Remover este custo padrão (não mexe em evento nenhum)"
                          aria-label="Remover custo padrão"
                        >
                          <AppIcon icon={X} size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Btn onClick={addCustoPadrao}>
            + Adicionar custo padrão {festa == null ? 'ao Padrão geral' : `a ${festa}`}
          </Btn>
        </Card>

        <Card className="p-4" id="ajustes-lotes-padrao">
          <h2 className="text-sm font-semibold">
            Lotes padrão {festa == null ? 'do Padrão geral' : `de ${festa}`}
          </h2>
          <p className="mb-3 mt-0.5 max-w-3xl text-xs text-[var(--tinta-3)]">
            O gabarito de lotes com que todo evento <strong>novo</strong> da festa nasce — nome,
            valor unitário, quantidade e as marcações. A festa é a selecionada na seção Premissas,
            acima. Herança por lista inteira: festa sem gabarito próprio usa o do Padrão geral; sem
            nenhum gabarito, o evento nasce com os lotes padrão de sempre. Vale só no nascimento —
            tudo continua editável dentro do evento, e nenhuma fórmula muda (só pré-preenche os
            campos de lote).
          </p>
          {premissaAtual.lotesPadrao.length === 0 && (
            <p className="mb-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
              {festa != null && ajustes.geral.lotesPadrao.length > 0
                ? `Sem gabarito próprio — um evento novo de ${festa} nasce com os ${ajustes.geral.lotesPadrao.length} lote(s) padrão do Padrão geral.`
                : 'Nenhum lote padrão ainda — eventos novos nascem com os lotes padrão de sempre (Lote Promocional, Lote 1…4, Último Lote, Lote Porta, Cortesia).'}
            </p>
          )}
          {premissaAtual.lotesPadrao.length > 0 && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                    <th className="py-2 pr-3 font-medium">Nome do lote</th>
                    <th className="w-32 py-2 pr-3 font-medium">Valor unitário</th>
                    <th className="w-24 py-2 pr-3 font-medium">Quantidade</th>
                    <th className="w-28 py-2 pr-3 font-medium" title="O lote só é vendido no cenário otimista (ex.: Lote Porta)">
                      Só otimista
                    </th>
                    <th className="w-24 py-2 pr-3 font-medium" title="Ingresso gratuito (valor R$ 0) — entra no público, não na receita">
                      Cortesia
                    </th>
                    <th className="w-10 py-2 font-medium" aria-label="Remover" />
                  </tr>
                </thead>
                <tbody>
                  {premissaAtual.lotesPadrao.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--borda)]">
                      <td className="py-1.5 pr-3">
                        <TextInput
                          value={l.nome}
                          onChange={(e) => setLotePadrao(l.id, { nome: e.target.value })}
                          placeholder="ex.: Lote 1"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        {l.cortesia ? (
                          <span className="text-xs text-[var(--tinta-3)]">R$ 0 (cortesia)</span>
                        ) : (
                          <MoneyInput
                            value={l.valor}
                            onChange={(v) => setLotePadrao(l.id, { valor: v })}
                            placeholder="a definir"
                            faixa={FAIXA_PRECO}
                          />
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        <NumInput
                          value={l.quantidade}
                          onChange={(v) => setLotePadrao(l.id, { quantidade: v })}
                          placeholder="—"
                          min="0"
                          step="1"
                          faixa={FAIXA_QUANTIDADE}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--tinta-2)]">
                          <input
                            type="checkbox"
                            checked={l.somenteOtimista}
                            onChange={(e) => setLotePadrao(l.id, { somenteOtimista: e.target.checked })}
                            className="cursor-pointer accent-[var(--acento)]"
                          />
                          só otimista
                        </label>
                      </td>
                      <td className="py-1.5 pr-3">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--tinta-2)]">
                          <input
                            type="checkbox"
                            checked={l.cortesia}
                            onChange={(e) => setLotePadrao(l.id, { cortesia: e.target.checked })}
                            className="cursor-pointer accent-[var(--acento)]"
                          />
                          cortesia
                        </label>
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => rmLotePadrao(l.id)}
                          // B3 (BACKLOG S4): hover:bg-red-50/hover:text-red-700
                          // fixos viravam um clarão rosa sobre o papel escuro
                          // no hover — mesmos tokens tema-aware da tarja de alerta.
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[var(--tinta-3)] hover:bg-[var(--tarja-alerta-fundo)] hover:text-[var(--vermelho-texto)]"
                          title="Remover este lote padrão (não mexe em evento nenhum)"
                          aria-label="Remover lote padrão"
                        >
                          <AppIcon icon={X} size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Btn onClick={addLotePadrao}>
            + Adicionar lote padrão {festa == null ? 'ao Padrão geral' : `a ${festa}`}
          </Btn>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 p-4" id="ajustes-protecao">
          <div>
            <h2 className="text-sm font-semibold">Proteção de dados</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-[var(--tinta-3)]">
              Lixeira de eventos excluídos e versões automáticas (1 por dia de uso) para
              restaurar — o mesmo painel do botão Proteção de dados da tela inicial.
            </p>
          </div>
          <Btn onClick={() => setProtecao(true)}>
            <AppIcon icon={ShieldCheck} /> Abrir lixeira e versões
          </Btn>
        </Card>

        <Card className="p-4" id="ajustes-backup">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Backup</h2>
              <p className="mt-0.5 max-w-2xl text-xs text-[var(--tinta-3)]">
                O backup JSON inclui eventos, benchmarks e estes Ajustes.{' '}
                {bkStatus.nunca
                  ? 'Você ainda não exportou nenhum.'
                  : `Último export: ${fmtData(ultimoExport?.slice(0, 10))} (${
                      bkStatus.dias === 0 ? 'hoje' : `há ${bkStatus.dias} dia(s)`
                    }).`}{' '}
                {/* Na cópia da nuvem (Marco, 05/10/2026) o envio automático não
                    existe, e a frase diz isso — ver backupExterno.js. */}
                {textoBackupAutomatico()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => backupRef.current?.click()}>Importar backup JSON</Btn>
              <Btn
                onClick={enviarAgora}
                // Na cópia da nuvem (05/10/2026) a ponte não existe: o botão
                // fica desligado e o title diz por quê.
                disabled={origemNaNuvem()}
                title={
                  origemNaNuvem()
                    ? TITULO_PONTE_NA_NUVEM
                    : 'Grava o backup JSON de agora na pasta de backups do Financeiro local (previsao-eventos-AAAA-MM-DD.json). Reenviar no mesmo dia sobrescreve o mesmo arquivo. Atalho na barra do topo: Enviar ao Financeiro.'
                }
              >
                Enviar ao Financeiro
              </Btn>
              <Btn variant="primary" onClick={exportar}>
                Exportar backup JSON
              </Btn>
            </div>
          </div>
          {backupExterno && (
            <p
              className={`mt-2 text-xs ${
                backupExterno.tom === 'ok'
                  ? 'text-[var(--verde-texto)]'
                  : backupExterno.tom === 'erro'
                    ? 'text-[var(--vermelho-texto)]'
                    : 'text-[var(--tinta-3)]'
              }`}
            >
              {backupExterno.texto}
            </p>
          )}
          {/* Token da ponte (H2-B): sem ele o Financeiro recusa a gravação
              do backup — proteção contra outros programas do computador.
              Na cópia da nuvem (05/10/2026) não há ponte: nem campo nem
              botão do token, só a frase de onde a ponte funciona. */}
          {origemNaNuvem() ? (
            <p className="mt-3 max-w-2xl border-t border-[var(--borda)] pt-3 text-xs text-[var(--tinta-3)]">
              {FRASE_PONTE_SO_NO_MAC}
            </p>
          ) : (
          <div className="mt-3 border-t border-[var(--borda)] pt-3">
            <h3 className="text-xs font-semibold text-[var(--tinta)]">
              Token da ponte com o Financeiro
              {loadChavePonte() ? (
                <span className="ml-2 font-normal text-[var(--verde-texto)]">configurado</span>
              ) : (
                <span className="ml-2 font-normal text-[var(--vermelho-texto)]">
                  ainda não configurado
                </span>
              )}
            </h3>
            <p className="mt-0.5 max-w-2xl text-xs text-[var(--tinta-3)]">
              O Financeiro só aceita gravações — como este backup — acompanhadas do token local
              dele, uma proteção contra outros programas do computador. Abra a pasta do
              Financeiro, copie o conteúdo do arquivo <strong>token_ponte.txt</strong> e
              cole aqui (uma vez só; fica neste navegador, fora do backup JSON). Se o token de lá
              for trocado — apagar o arquivo e reabrir o Financeiro gera outro — cole o novo
              aqui. As leituras da ponte (buscar eventos e curva) não precisam de token.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TextInput
                type="password"
                value={chavePonte}
                onChange={(e) => setChavePonte(e.target.value)}
                placeholder="cole aqui o conteúdo de token_ponte.txt"
                autoComplete="off"
                className="w-80 max-w-full"
                aria-label="Token da ponte com o Financeiro"
              />
              <Btn onClick={salvarChavePonte}>Salvar token da ponte</Btn>
            </div>
            {chaveStatus && <p className="mt-1.5 text-xs text-[var(--tinta-3)]">{chaveStatus}</p>}
          </div>
          )}
          <input
            ref={backupRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importarBackup(f)
              e.target.value = ''
            }}
          />
        </Card>

        <Card className="p-4" id="ajustes-aparencia">
          <h2 className="text-sm font-semibold">Aparência</h2>
          <p className="mb-2 mt-0.5 max-w-3xl text-xs text-[var(--tinta-3)]">
            Cores de exibição do app: a cor de <strong>destaque</strong> (botões principais e
            barras de comparação) e a cor de <strong>cada festa</strong> (bolinha nos cards e no
            editor). Escolha um swatch da paleta oficial da marca ou uma cor livre — cada linha
            tem “voltar ao padrão da marca”. Só muda a aparência: <strong>nenhum número é
            afetado</strong>, e as cores do <strong>semáforo</strong> (verde/amarelo/vermelho do
            veredito) não se editam — são significado, não decoração. Preferências ficam neste
            navegador, fora do backup JSON.
          </p>
          {/* Tema claro/escuro/automático (sugestão 31 / tema G). Lembrado neste
              navegador; o relatório e a impressão saem sempre claros (papel). */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-[var(--tinta-2)]">Tema</span>
            <Segmented
              value={aparencia.tema || 'claro'}
              onChange={(t) => setAparencia({ ...aparencia, tema: t })}
              options={[
                ['claro', 'Claro'],
                ['escuro', 'Escuro'],
                ['auto', 'Automático'],
              ]}
            />
            <span className="text-[11px] text-[var(--tinta-3)]">
              Automático segue o sistema. Relatório e impressão saem sempre claros (papel não
              gasta tinta e é o que vai pro contador). O semáforo mantém o significado nos dois.
            </span>
          </div>
          <LinhaCor
            rotulo="Cor de destaque do app"
            cor={corAcento(aparencia)}
            padrao={ACENTO_PADRAO}
            escolhida={aparencia.acento != null}
            onEscolher={(c) => setAparencia({ ...aparencia, acento: c })}
            onPadrao={() => setAparencia({ ...aparencia, acento: null })}
          />
          <h3 className="mb-1 mt-4 text-xs font-semibold text-[var(--tinta-2)]">
            Cor de cada festa
          </h3>
          {[...TIPOS_PADRAO, ...tiposCustom].map((t) => (
            <LinhaCor
              key={t}
              rotulo={t}
              cor={corFesta(t, aparencia)}
              padrao={CORES_FESTA_PADRAO[t] || `${COR_FESTA_LIVRE} (rosa, a cor livre da paleta)`}
              escolhida={aparencia.festas[t] != null}
              onEscolher={(c) => setAparencia({ ...aparencia, festas: { ...aparencia.festas, [t]: c } })}
              onPadrao={() => {
                const festas = { ...aparencia.festas }
                delete festas[t]
                setAparencia({ ...aparencia, festas })
              }}
            />
          ))}
          <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
            Padrões da casa (os mesmos do Financeiro): Marfim Alto azul · Brisa
            vermelho · Sobrado verde · O Galeao laranja. Festa nova nasce no rosa — a cor livre da
            paleta.
          </p>
        </Card>

        <Card className="p-4" id="ajustes-benchmarks">
          <h2 className="text-sm font-semibold">Benchmarks</h2>
          <p className="mb-3 mt-0.5 max-w-3xl text-xs text-[var(--tinta-3)]">
            Os caminhos de volta da gestão de benchmarks. Para ocultar, apagar, editar ou salvar
            como padrão, use “Editar” nos benchmarks da tela inicial — ali fica a gestão. Aqui ficam
            os que estão fora do ar, com o botão para trazê-los de volta.
          </p>
          <h3 className="mb-1 text-xs font-semibold text-[var(--tinta-2)]">
            Ocultos das comparações
          </h3>
          <p className="mb-2 max-w-3xl text-xs text-[var(--tinta-3)]">
            Benchmark oculto some das telas de comparação e referência (chips, custos por categoria,
            R$/pessoa, relatório) — mas <strong>nada é apagado nem alterado</strong>: os números
            continuam intactos e “mostrar de novo” devolve tudo como era.
          </p>
          {benchmarksOcultosLista(store).length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-4 text-center text-sm text-[var(--tinta-3)]">
              Nenhum benchmark oculto — todos aparecem nas comparações.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
              {benchmarksOcultosLista(store).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="truncate text-sm font-medium text-[var(--tinta)]">{b.nome}</span>
                    <span className="ml-2 text-xs text-[var(--tinta-3)]">
                      custo {fmtCompact(b.custoTotal)}
                    </span>
                    <Badge
                      className={
                        b.custom
                          ? 'ml-2 border border-[rgba(0,69,221,0.25)] bg-[var(--azul-tinta)] text-[var(--azul-texto)]'
                          : 'ml-2 border border-[var(--borda)] bg-[var(--papel-2)] text-[var(--tinta-2)]'
                      }
                    >
                      {b.custom ? 'importado' : 'embutido'}
                    </Badge>
                    {temSemReserva(b) && (
                      <EtiquetaSemReserva
                        texto={ETIQUETA_SEM_RESERVA}
                        explicacao={EXPLICACAO_SEM_RESERVA}
                        className="ml-2 align-middle"
                      />
                    )}
                  </div>
                  <Btn onClick={() => setStore((s) => mostrarBenchmark(s, b.id), `mostrar "${b.nome}" nas comparações`)}>
                    <AppIcon icon={Eye} /> Mostrar de novo
                  </Btn>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-1 mt-4 text-xs font-semibold text-[var(--tinta-2)]">Apagados</h3>
          <p className="mb-2 max-w-3xl text-xs text-[var(--tinta-3)]">
            Embutidos apagados de todas as telas e da lista. O caminho de volta é permanente:
            “Restaurar” traz o benchmark de volta com os valores que ele tinha, e os valores de
            fábrica nunca se perdem.
          </p>
          {benchmarksApagadosLista(store).length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-4 text-center text-sm text-[var(--tinta-3)]">
              Nenhum benchmark apagado.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
              {benchmarksApagadosLista(store).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="truncate text-sm font-medium text-[var(--tinta)]">{b.nome}</span>
                    <span className="ml-2 text-xs text-[var(--tinta-3)]">
                      custo {fmtCompact(b.custoTotal)}
                    </span>
                    <Badge className="ml-2 border border-[var(--borda)] bg-[var(--papel-2)] text-[var(--tinta-2)]">
                      embutido
                    </Badge>
                  </div>
                  <Btn
                    onClick={() => {
                      setStore(
                        (s) => restaurarBenchmarkApagado(s, b.id),
                        `restaurar o benchmark "${b.nome}"`
                      )
                      showToast(`“${b.nome}” restaurado aos benchmarks`, {
                        acaoLabel: 'Desfazer',
                        onAcao: () =>
                          setStore(
                            (s) => apagarBenchmarkEmbutido(s, b.id),
                            `apagar o benchmark "${b.nome}"`
                          ),
                      })
                    }}
                    title="Traz este benchmark de volta a todas as telas e à lista"
                  >
                    <AppIcon icon={RefreshCw} /> Restaurar
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {protecao && (
        <ProtecaoModal
          store={store}
          onClose={() => setProtecao(false)}
          onRestaurarEvento={restaurarEvento}
          onRestaurarEventoComoCopia={restaurarEventoComoCopia}
          onRestaurarStore={restaurarStore}
        />
      )}
    </div>
  )
}
