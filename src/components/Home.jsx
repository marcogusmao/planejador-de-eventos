import { useEffect, useRef, useState } from 'react'
import { Btn, Card, Modal, Bola, Field, TextInput, CampoData } from './ui.jsx'
import {
  AppIcon,
  Settings,
  ShieldCheck,
  Download,
  FileUp,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Pencil,
  ArrowUpRight,
  X,
  TriangleAlert,
} from './AppIcon.jsx'
import { corFesta, temaEscuroEfetivo } from '../lib/aparencia.js'
import { LogoOstra, MarcaFesta } from './Marca.jsx'
import { computeCenarios, CENARIOS, CENARIO_LABEL } from '../lib/calc.js'
import { resultadoRealizado } from '../lib/fechamento.js'
import { ResumoRealizado } from './ResumoRealizado.jsx'
import { fmtCompact, fmtData, fmtInt, formatadorCompacto } from '../lib/format.js'
import { TIPOS_PADRAO } from '../lib/defaults.js'
import { novoEventoDoTipo, temPremissas, formaAjustes } from '../lib/premissas.js'
import { num } from '../lib/util.js'
import { exportBackup, gravacaoBloqueada } from '../lib/storage.js'
import {
  excluirEventoParaLixeira,
  restaurarEventoDaLixeira,
  restaurarComoCopiaDaLixeira,
  loadLixeira,
  proximoDescarteDaLixeira,
  talvezSnapshotDiario,
  loadUltimoExport,
  marcarExportAgora,
  statusBackup,
} from '../lib/protecao.js'
import { showToast } from '../lib/toast.js'
import { resumoRevisao } from '../lib/revisaoRestauracao.js'
import {
  talvezEnviarBackupDiario,
  enviarBackupExterno,
  marcarEnvioAgora,
  mensagemFalhaBackup,
  avisoDoBackupDiario,
} from '../lib/backupExterno.js'
import { origemNaNuvem, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import {
  benchmarksVisiveis,
  benchmarksOcultosIds,
  excluirBenchmarkCustom,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import { duplicarCopia, duplicarNovaEdicao } from '../lib/novaEdicao.js'
import ImportModal from './ImportModal.jsx'
import BenchmarksEditor from './BenchmarksEditor.jsx'
import ProtecaoModal from './ProtecaoModal.jsx'
import { VeredictoSelo } from './Veredito.jsx'
import { linhaRitmoHome } from './RitmoVendas.jsx'
import { AcuraciaResumo } from './Acuracia.jsx'
import RedeDeSeguranca from './RedeDeSeguranca.jsx'
import { NotaLoteSemPreco } from './AvisoLoteSemPreco.jsx'
import {
  benchmarkQuebrado,
  publicoDaReferencia,
  ESTADO_PUBLICO,
  VALOR_ILEGIVEL,
  textoPublicoGuardado,
  numeroQuebradoPorCusto,
  numeroQuebradoPorReceita,
  cenarioQuebrado,
  receitaDoCenarioQuebrada,
  custosQuebrados,
} from '../lib/dadoQuebrado.js'
import {
  FRASE_CARTAO_QUEBRADO,
  FRASE_CARTAO_RECEITA_QUEBRADA,
  FRASE_CELULA_BENCHMARK_QUEBRADO,
} from './AvisoCustoQuebrado.jsx'

const lucroTone = (v) => (v >= 0 ? 'text-[var(--verde-texto)]' : 'text-[var(--vermelho-texto)]')

function EventoCard({ evento, abrir, duplicar, novaEdicao, excluir, ehBenchmark }) {
  const c = computeCenarios(evento)
  const publico = c.realista.publico || num(evento.publicoEstimado)
  const fechado = evento.status === 'fechado'
  // Evento fechado troca os 3 cenários projetados pelo Estimado × Realizado — o
  // que de fato aconteceu (Marco 24/07). Mesma conta da aba Fechamento
  // (resultadoRealizado); null = evento não fechado ou sem realizado lançado.
  const real = fechado ? resultadoRealizado(evento, c.realista) : null
  // DADO QUEBRADO NO CARTÃO (Marco, 26/07/2026 — a tela DIZ, não imprime
  // número derivado de lixo; trazido à Home em 05/10/2026). Medido ao vivo: com
  // "Som e luz" em 1 seguido de 308 zeros o cartão escrevia "Pessimista R$ 0 ·
  // Realista R$ 0 · Otimista R$ 0", e o fechado "Resultado realizado R$ 0" com
  // desvio "−NaN". O selo dizia "margem realista 0%".
  //
  // Decide pelo que ESTE cartão imprimiria, como a aba Fechamento faz: o custo
  // tem de estar acusado E algum número do cartão tem de ter deixado de ser
  // dinheiro. Um texto no "realizado" que a conta ignora acusa o custo, mas o
  // cartão continua certo — esconder um número certo seria o defeito oposto.
  const numerosDoCartao = real
    ? [real.receita, real.custos, real.resultado, real.estimado?.lucro]
    : CENARIOS.map((k) => c[k].lucro)
  // Régua da casa (`cabeComoDinheiro`, via numeroQuebrado…) desde 05/10/2026:
  // um Pix de 1e308 é finito e saía no cartão com centenas de dígitos. A causa
  // pode ser o custo ou a receita realizada, e a frase diz qual.
  // Festa aberta: os três lucros saem dos cenários, então a pergunta é a dos
  // cenários, que olha a ORIGEM (4ª revisão do PR #98, 05/10/2026 — com um
  // patrocínio de 1e308 a receita dos cenários não era dinheiro).
  const quebrado = real
    ? numeroQuebradoPorCusto(evento, ...numerosDoCartao) ||
      numeroQuebradoPorReceita(evento, ...numerosDoCartao)
    : CENARIOS.some((k) => cenarioQuebrado(evento, c[k], c) || receitaDoCenarioQuebrada(evento, c[k], c))
  const fraseQuebrado = custosQuebrados(evento).ha ? FRASE_CARTAO_QUEBRADO : FRASE_CARTAO_RECEITA_QUEBRADA
  return (
    // O card inteiro abre no clique (Marco, 24/07): um botão esticado por baixo
    // do conteúdo (semânticas separadas — sem botão dentro de botão). O "Abrir"
    // azul redundante saiu: o azul volta a ser só do "Novo evento". As ações
    // (duplicar / nova edição / excluir) só aparecem no hover ou no foco de
    // teclado — padrão "ação mora no objeto" da casa; card mais limpo.
    <Card className="group relative flex flex-col p-4 transition-shadow hover:shadow-[var(--sombra-2)]">
      <button
        type="button"
        onClick={abrir}
        aria-label={`Abrir ${evento.nome}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]"
      />
      {/* pointer-events-none deixa o clique atravessar para o botão esticado;
          os selos abaixo religam o ponteiro (pointer-events-auto) só para o
          tooltip que explica "Fechado"/"Benchmark" continuar aparecendo. */}
      <div className="pointer-events-none relative z-[1]">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--tinta)] group-hover:underline">
          {quebrado ? (
            <Bola size={15} cor="var(--tinta-3)" title={fraseQuebrado} />
          ) : (
            <VeredictoSelo evento={evento} size={15} />
          )}
          <span className="min-w-0 truncate" title={evento.nome}>{evento.nome}</span>
          {/* Selos de fechamento (Parte 2 — 20/07/2026): "Fechado" avisa que os
              números estão congelados; "Benchmark" só quando o fechamento
              promoveu este evento a referência E o benchmark ainda existe (não
              foi apagado depois). shrink-0 nos dois — quem cede espaço é o
              nome (truncate), nunca o selo. */}
          {fechado && !ehBenchmark && (
            <span
              title="Este evento está fechado — os números foram congelados no fechamento."
              className="pointer-events-auto shrink-0 rounded-full border border-[rgba(0,120,42,0.3)] bg-[rgba(0,120,42,0.08)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--verde-texto)]"
            >
              Realizado
            </span>
          )}
          {ehBenchmark && (
            <>
              <span
                title="Este evento está fechado — os números foram congelados no fechamento."
                className="pointer-events-auto shrink-0 rounded-full border border-[var(--borda)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tinta-2)]"
              >
                Fechado
              </span>
              <span
                title="Este fechamento deu origem a um benchmark salvo — gerencie na lista de benchmarks (ele pode estar oculto das comparações)."
                className="pointer-events-auto shrink-0 rounded-full border border-[var(--borda)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tinta-2)]"
              >
                Benchmark
              </span>
            </>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--tinta-3)]">
          {[fmtData(evento.data), evento.local, publico ? `${fmtInt(publico)} pessoas` : null]
            .filter(Boolean)
            .join(' · ') || 'sem data definida'}
        </p>
      {/* o realista domina — é o número da decisão; vizinhos recuam. Rótulos
          dos 3 lucros calibrados juntos (tema D): dois cenários com lucros
          diferentes nunca mostram o mesmo "R$ 2 mil". */}
      {quebrado ? (
        <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--borda)] pt-3 text-xs font-medium text-[var(--vermelho-texto)]">
          <AppIcon icon={TriangleAlert} size={14} className="mt-0.5" />
          {fraseQuebrado}
        </p>
      ) : real ? (
        // Realizado: o que de fato aconteceu × o estimado (componente
        // ResumoRealizado, mesmo corpo da aba Cenários). Título sempre "Resultado
        // realizado" — evento fechado é realizado (decisão do Marco 24/07); o
        // detalhe do que ainda entra pelo estimado mora na aba Fechamento.
        //
        // AS DUAS COLUNAS VIAJAM DENTRO DE `real` (Marco, 27/07/2026): o card
        // não recebe mais o cenário realista à parte. Era de lá que vinha a
        // coluna "Estimado", e o cenário soma o REALIZADO onde ele já existe —
        // num evento fechado isso comparava o realizado contra ele mesmo e
        // imprimia desvio zero. Voltar a passar o cenário para cá reabre
        // exatamente esse defeito.
        <div className="mt-3 border-t border-[var(--borda)] pt-3">
          <ResumoRealizado real={real} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 items-end gap-2 border-t border-[var(--borda)] pt-3">
          {(() => {
            const fmtLucro = formatadorCompacto(CENARIOS.map((k) => c[k].lucro))
            return CENARIOS.map((k) => {
              const central = k === 'realista'
              return (
                <div key={k}>
                  <div className="text-[11px] text-[var(--tinta-3)]">{CENARIO_LABEL[k]}</div>
                  <div
                    className={`tnum font-semibold ${central ? 'text-lg' : 'text-sm opacity-80'} ${lucroTone(c[k].lucro)}`}
                  >
                    {fmtLucro(c[k].lucro)}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
      {!real && !quebrado && (() => {
        // o 4º argumento é o aviso de "não fecha nem vendendo tudo": sem ele o
        // card da Home some com a linha inteira (Marco, 27/07/2026). O relógio
        // segue sendo o padrão da função — por isso o `undefined` no meio.
        const ritmo = linhaRitmoHome(
          evento,
          c.realista.breakEven,
          undefined,
          c.realista.breakEvenNaoFecha,
          c
        )
        return ritmo ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--tinta)]">
            {/* saúde na bola, texto neutro (Marco 24/07) */}
            <Bola
              size={8}
              cor={
                ritmo.tom === 'ok'
                  ? 'var(--verde-texto)'
                  : ritmo.tom === 'neutro'
                    ? 'var(--tinta-3)'
                    : 'var(--ambar-texto)'
              }
            />
            {ritmo.texto}
          </p>
        ) : null
      })()}
      {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): os três
          lucros e "N pessoas" acima já não contam o lote. Mesmo lugar e mesma
          condição da linha de ritmo — só quando o cartão mostra os cenários
          vivos; com o realizado, os números são a fotografia do fechamento,
          e com dado quebrado a frase de cima já ocupa o lugar dos números. */}
      {!real && !quebrado && <NotaLoteSemPreco evento={evento} className="mt-2" />}
      </div>
      {/* Ações reveladas no hover / foco de teclado (relative z-[1], acima do
          botão esticado). O espaço da fileira fica reservado (opacity, não
          display) para o card não pular de altura ao passar o mouse; o
          pointer-events religa junto com a opacidade para não haver botão
          invisível clicável. */}
      <div className="relative z-[1] mt-3 flex gap-2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
        <Btn onClick={duplicar} title="Duplicar (cópia idêntica)" aria-label="Duplicar (cópia idêntica)">
          <AppIcon icon={Copy} />
        </Btn>
        <Btn
          onClick={novaEdicao}
          title="Duplicar para próxima edição: zera realizados, status volta a ORÇAR"
        >
          <AppIcon icon={RefreshCw} /> Nova edição
        </Btn>
        {/* remover fica NEUTRO e só vira vermelho no hover — igual aos outros
            removedores de ícone do app (§5: nada de vermelho permanente). */}
        <button
          type="button"
          onClick={excluir}
          className="cursor-pointer rounded p-1.5 text-[var(--tinta-3)] transition-colors hover:text-[var(--vermelho-texto)]"
          title="Mover para a lixeira (restaurável em Proteção de dados)"
          aria-label="Mover para a lixeira"
        >
          <AppIcon icon={Trash2} />
        </button>
      </div>
    </Card>
  )
}

// Nome sugerido da próxima edição (Sessão F2-U — item 6): conta quantas
// previsões daquele tipo já existem → "Brisa #3". Sem categoria vira
// "Previsão #N" (conta as sem tipo). Nunca nasce sem nome: vazio cai aqui.
function contarDoTipo(store, tipo) {
  const t = (tipo || '').trim()
  return store.eventos.filter((e) => (e.tipo || '').trim() === t).length
}
function nomeSugerido(store, tipo) {
  const n = contarDoTipo(store, tipo) + 1
  return (tipo || '').trim() ? `${tipo} #${n}` : `Evento #${n}`
}

// Passo 2 do "+ Nova previsão" (item 6): já com a festa escolhida, o nome
// (pré-preenchido com a próxima edição sugerida, editável) e a data (opcional).
// Enter cria; o botão diz o efeito ("Criar Brisa #3").
function PassoNomeData({ store, aparencia, tipo, criar, voltar, onClose }) {
  const sugestao = nomeSugerido(store, tipo)
  const [nome, setNome] = useState(sugestao)
  const [data, setData] = useState('')
  // Campo vazio cai na sugestão — nunca nasce sem nome (regra do item 6).
  const nomeFinal = nome.trim() || sugestao
  const criarAgora = () => criar(tipo, nomeFinal, data)
  return (
    <Modal title="Novo evento — nome e data" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--papel-2)] px-3 py-2">
          {(tipo || '').trim() ? (
            <Bola size={14} cor={corFesta(tipo, aparencia, temaEscuroEfetivo(aparencia))} />
          ) : (
            <Bola size={14} cor="var(--tinta-3)" />
          )}
          <span className="text-sm font-medium text-[var(--tinta)]">{(tipo || '').trim() || 'Sem categoria'}</span>
          <button
            type="button"
            onClick={voltar}
            className="ml-auto cursor-pointer text-xs text-[var(--tinta-3)] hover:text-[var(--tinta)]"
          >
            Trocar festa
          </button>
        </div>
        <Field label="Nome do evento">
          <TextInput
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                criarAgora()
              }
            }}
            placeholder={sugestao}
          />
        </Field>
        <Field label="Data da festa (opcional — dá para definir depois)">
          {/* Calendário próprio (Marco, 05/08/2026). `onEnter` em vez de
              onKeyDown: com o calendário ABERTO, Enter escolhe o dia e não
              cria o evento — senão escolher uma data no teclado criaria a
              previsão no meio do caminho. */}
          <CampoData
            value={data}
            onChange={setData}
            onEnter={criarAgora}
            aria-label="Data da festa (opcional)"
          />
        </Field>
        <div className="flex items-center justify-end gap-2">
          <Btn onClick={voltar}>Voltar</Btn>
          <Btn variant="primary" onClick={criarAgora}>
            <AppIcon icon={Plus} /> Criar {nomeFinal}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

// Modal do "+ Nova previsão" (sugestão 20 + item 6 da F2-U): passo 1 escolhe a
// FESTA — é no nascimento, e só aí, que as premissas dos Ajustes agem; a
// legenda de cada opção diz de onde vêm os valores. Passo 2 (PassoNomeData)
// pede nome + data no MESMO fluxo.
function NovaPrevisaoModal({ store, aparencia, criar, onClose }) {
  // null = passo da festa; string (inclui '') = festa escolhida → passo nome+data
  const [escolhida, setEscolhida] = useState(null)
  const ajustes = formaAjustes(store.ajustes)
  const tiposCustom = [
    ...new Set([
      ...Object.keys(ajustes.porTipo),
      ...store.eventos.map((e) => e.tipo).filter((t) => t && t.trim()),
    ]),
  ]
    .filter((t) => !TIPOS_PADRAO.includes(t))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const geralTem = temPremissas(ajustes.geral)
  const legenda = (tipo) =>
    temPremissas(ajustes.porTipo[tipo])
      ? `nasce com as premissas de ${tipo} (Ajustes)`
      : geralTem
        ? 'nasce com as premissas do Padrão geral (Ajustes)'
        : 'nasce com os padrões do app'
  const outra = () => {
    const nome = window.prompt('Nome da festa nova:')?.trim()
    if (nome) setEscolhida(nome)
  }
  const opcao = (t, rotulo, sub) => (
    <button
      key={rotulo}
      type="button"
      onClick={() => setEscolhida(t)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[var(--borda)] bg-[var(--papel)] px-3 py-2 text-left transition-colors hover:border-[var(--acento)] hover:bg-[var(--acento-tinta)]"
    >
      <Bola size={14} cor={corFesta(t, aparencia, temaEscuroEfetivo(aparencia))} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--tinta)]">{rotulo}</span>
        <span className="mt-0.5 block text-[11px] text-[var(--tinta-3)]">{sub}</span>
      </span>
    </button>
  )

  if (escolhida !== null) {
    return (
      <PassoNomeData
        store={store}
        aparencia={aparencia}
        tipo={escolhida}
        criar={criar}
        voltar={() => setEscolhida(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Novo evento — de qual festa?" onClose={onClose}>
      <div className="space-y-2">
        {[...TIPOS_PADRAO, ...tiposCustom].map((t) => opcao(t, t, legenda(t)))}
        {opcao(
          '',
          'Sem categoria',
          geralTem ? 'nasce com as premissas do Padrão geral (Ajustes)' : 'nasce com os padrões do app'
        )}
        <button
          type="button"
          onClick={outra}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-[var(--borda-2)] bg-[var(--papel)] px-3 py-2 text-left text-sm font-medium text-[var(--tinta-2)] transition-colors hover:border-[var(--acento)] hover:text-[var(--tinta)]"
        >
          + Outra festa…
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[var(--tinta-3)]">
        Premissas e custos padrão por festa ficam em Ajustes. Depois de escolher a festa, você dá o
        nome e a data (os dois opcionais — o nome já vem sugerido). Trocar a festa depois não
        reaplica premissas — elas valem só no nascimento.
      </p>
    </Modal>
  )
}

export default function Home({ store, setStore, aparencia, abrir, abrirAjustes }) {
  const [importando, setImportando] = useState(false)
  const [editandoBms, setEditandoBms] = useState(false)
  const [protecao, setProtecao] = useState(false)
  const [criando, setCriando] = useState(false)
  const [avisoSnapshot, setAvisoSnapshot] = useState(null)
  const [avisoBackupExterno, setAvisoBackupExterno] = useState(null)
  const [ultimoExport, setUltimoExport] = useState(loadUltimoExport)

  const bkStatus = statusBackup(ultimoExport)

  const exportar = () => {
    exportBackup(store)
    marcarExportAgora()
    setUltimoExport(loadUltimoExport())
  }

  // Atalho da barra do topo (F2-Y, adendo do Marco): "Enviar ao Financeiro" —
  // mesma ação do botão de Ajustes › Backup, agora junto dos irmãos de backup.
  // Financeiro fechado (ou sem token) = o aviso honesto de sempre, no banner
  // discreto abaixo — nunca erro bloqueante. O controle detalhado (token etc.)
  // segue em Ajustes.
  const enviarAoFinanceiro = async () => {
    setAvisoBackupExterno('Enviando o backup ao Financeiro…')
    const r = await enviarBackupExterno(store)
    if (r.ok) {
      marcarEnvioAgora()
      setAvisoBackupExterno(
        `Backup gravado na pasta de backups do Financeiro: ${r.arquivo}${
          r.googleDrive ? ' (espelhado no Google Drive)' : ''
        }.`
      )
    } else {
      // Diagnóstico certo, inclusive "app aberto na origem errada" (correção
      // S2): nunca acusar o Financeiro de fechado quando quem barrou foi o CORS.
      setAvisoBackupExterno(mensagemFalhaBackup(r))
    }
  }

  // Espelho sempre atual do store. Serve ao snapshot diário (abaixo) e aos
  // callbacks que sobrevivem ao render — o "Restaurar" do toast da lixeira
  // precisa do store de AGORA, não do que existia quando o toast nasceu.
  const storeRef = useRef(store)
  storeRef.current = store

  // Snapshot automático 1×/dia de uso: fotografa o estado do início do dia na
  // primeira abertura do app. O guard (jaTemSnapshotHoje) evita repetir; roda só
  // uma vez por montagem. Se a quota estourar, avisa — nunca falha calado.
  useEffect(() => {
    const r = talvezSnapshotDiario(storeRef.current)
    if (r.criado === false && r.erro) {
      setAvisoSnapshot(
        'Não foi possível guardar a cópia de segurança automática de hoje (armazenamento do navegador cheio). Exporte um backup JSON e esvazie a lixeira em “Proteção de dados”.'
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Backup externo automático (hardening 1.1, Marco 18/07/2026): 1×/dia, na
  // abertura, e SÓ quando o Financeiro local está aberto. Financeiro fechado
  // vira o aviso discreto abaixo — nunca erro bloqueante; os dados seguem
  // salvos no navegador. Este é o único POST do app (limites no
  // backupExterno.js e no CLAUDE.md).
  useEffect(() => {
    let ativo = true
    talvezEnviarBackupDiario(storeRef.current).then((r) => {
      // Aviso discreto com a causa certa (H2-B): sem token configurado ou
      // token recusado, a mensagem diz onde pegar/colar o token; app aberto
      // fora da origem da ponte (S2) diz que foi o navegador que barrou;
      // Financeiro realmente fechado segue com a mensagem de sempre. Na cópia
      // da nuvem (Marco, 05/10/2026: lá a ponte não funciona) não há envio nem
      // pedido de token; o aviso calmo, só na primeira abertura neste
      // navegador, é escolha de implementação, não decisão do Marco.
      const aviso = avisoDoBackupDiario(r)
      if (ativo && aviso) setAvisoBackupExterno(aviso)
    })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sugestão 20: a premissa por festa age SÓ no nascimento — por isso a festa
  // é escolhida AO CRIAR (modal). O evento nasce com as premissas herdadas
  // (tipo → Padrão geral → padrões do app); sem nada configurado, nasce
  // exatamente como sempre nasceu.
  // Item 6 da F2-U: nome + data escolhidos no mesmo fluxo do modal. O nome já
  // vem pré-preenchido com a próxima edição sugerida (nunca nasce sem nome); a
  // data é opcional. Fluxo de criação — nenhuma conta muda.
  const criar = (tipo, nome, data = '') => {
    const ev = novoEventoDoTipo(tipo, store.ajustes, nome)
    if (data) ev.data = data
    setStore((s) => ({ ...s, eventos: [...s.eventos, ev] }), `criar o evento "${ev.nome}"`)
    setCriando(false)
    abrir(ev.id)
  }

  const duplicar = (evento) => {
    const copia = duplicarCopia(evento)
    setStore((s) => ({ ...s, eventos: [...s.eventos, copia] }), `duplicar "${evento.nome}"`)
  }

  // Sugestão 4: a próxima edição nasce limpa (realizado zerado, status ORÇAR).
  // O confirm decide só a OPÇÃO — a nova edição é criada nos dois caminhos.
  const novaEdicao = (evento) => {
    const usarRealizado = window.confirm(
      `Criar a próxima edição de "${evento.nome}" usando os valores REALIZADOS da edição anterior como novo estimado (a melhor previsão que existe)?\n\nOK = usar os realizados · Cancelar = manter os estimados como estão.\n\nNos dois casos a nova edição nasce limpa: realizados zerados e status de volta a ORÇAR. O evento original não muda.`
    )
    const nova = duplicarNovaEdicao(evento, { usarRealizadoComoEstimado: usarRealizado })
    setStore((s) => ({ ...s, eventos: [...s.eventos, nova] }), `criar a próxima edição de "${evento.nome}"`)
    abrir(nova.id)
  }

  // Escritor do store das ações que também mexem na LIXEIRA. Elas não criam
  // passo de desfazer — o caminho de volta delas é a própria lixeira, que dura
  // mais que a sessão e aparece na tela. Ver historico.js, 'foraDoHistorico'.
  const aplicarForaDoHistorico = (fn, motivo) =>
    setStore(fn, { foraDoHistorico: true, rotulo: motivo })

  const excluir = (evento) => {
    // Aviso ANTES (achado da verificação adversarial): a lixeira guarda 50, e
    // na 51ª exclusão a cópia mais antiga saía de vez — logo depois de este
    // mesmo confirm ter prometido "você poderá restaurá-la depois". Avisar
    // antes de perder é melhor que contar depois; o confirm passa a dizer o
    // preço REAL desta exclusão.
    const expulso = proximoDescarteDaLixeira(loadLixeira())
    const aviso = expulso
      ? `\n\nATENÇÃO: a lixeira está cheia (50 eventos). Esta exclusão vai empurrar para fora “${expulso.nome}”, que não poderá mais ser restaurado. Exporte um backup antes se quiser guardá-lo.`
      : ''
    if (
      !window.confirm(
        `Mover o evento "${evento.nome}" para a lixeira? Você poderá restaurá-lo depois em “Proteção de dados”.${aviso}`
      )
    )
      return
    const r = excluirEventoParaLixeira(evento, aplicarForaDoHistorico)
    if (!r.ok) {
      window.alert(r.erro)
      return
    }
    // E conta DEPOIS o que de fato saiu — o aviso de antes é uma previsão, este
    // é o fato. Toast próprio e longo: é perda de dado, não merece dividir
    // espaço com a confirmação da exclusão que o Marco quis fazer.
    if (r.descartado) {
      showToast(
        `A lixeira encheu: “${r.descartado.nome || 'o evento mais antigo'}” saiu dela e não pode mais ser restaurado. Exporte um backup JSON se quiser guardar exclusões antigas.`,
        { duracao: 12000 }
      )
    }
    // O desfazer desta ação é ESTE — visível, na hora, e ele desfaz a
    // transação inteira (tira da lixeira e devolve à lista). Passado o toast,
    // o mesmo caminho continua em Proteção de dados › Lixeira.
    showToast(`“${evento.nome}” foi para a lixeira.`, {
      acaoLabel: 'Restaurar',
      onAcao: () => {
        const volta = restaurarEvento(r.item.id)
        if (!volta.ok) {
          window.alert(volta.erro)
          return
        }
        // Rede de honestidade do caminho curto (25/07/2026, decisão 18). Aqui a
        // previsão acabou de sair do store desta sessão — que já veio migrado —,
        // então a correção deveria ser impossível. "Deveria" não conta: se ela
        // acontecer, o Marco fica sabendo na hora, com o que mudou escrito. A
        // lista item a item continua em Proteção de dados › Lixeira.
        if (volta.revisao?.precisaRevisao)
          showToast(
            `“${evento.nome}” foi salvo antes de uma correção do app e voltou já corrigido — ${resumoRevisao(volta.revisao)}. O detalhe está em Proteção de dados.`,
            { duracao: 12000 }
          )
      },
    })
  }

  // Restaura da lixeira em UMA transação (checa colisão, tira de lá, põe na
  // lista) e devolve { ok, erro } — quem chama mostra o erro na tela.
  //
  // O store vai como LEITOR, não como valor: o "Restaurar" do toast é clicado
  // depois, e o `store` deste render é o de ANTES da exclusão — a checagem de
  // colisão veria a previsão ainda na lista e recusaria a restauração que o
  // botão acabou de prometer.
  const restaurarEvento = (itemId) =>
    restaurarEventoDaLixeira(itemId, () => storeRef.current, aplicarForaDoHistorico)

  // Saída do item zumbi (gêmea viva no store): volta como cópia, id novo.
  const restaurarEventoComoCopia = (itemId) =>
    restaurarComoCopiaDaLixeira(itemId, aplicarForaDoHistorico)

  // Substitui o store inteiro pela versão de um snapshot (App salva no efeito).
  const restaurarStore = (novoStore) => setStore(() => novoStore, 'restaurar um snapshot')

  const excluirBenchmark = (bm) => {
    if (!window.confirm(`Remover o benchmark importado "${bm.nome}"?`)) return
    // Limpa também o id da lista de ocultos (sugestão 25) — sem id órfão.
    setStore((s) => excluirBenchmarkCustom(s, bm.id), `remover o benchmark "${bm.nome}"`)
  }

  // Selo "Benchmark" do card (Parte 2 do fechamento — 20/07/2026): só quando
  // o fechamento promoveu este evento a benchmark E esse benchmark ainda
  // existe na lista (o Marco pode apagar um benchmark depois — o selo não
  // pode continuar afirmando algo que já não é verdade).
  const ehEventoBenchmark = (evento) =>
    !!(
      evento.fechamento?.benchmarkId &&
      (store.benchmarksCustom || []).some((b) => b.id === evento.fechamento.benchmarkId)
    )

  // Cada card dentro da REDE (RedeDeSeguranca.jsx, decisão do Marco de
  // 26/07/2026). Medido antes dela: uma festa com `lotes` gravado como conjunto
  // no lugar de lista derrubava a Home INTEIRA — "object is not iterable" — e a
  // tela ficava branca a cada abertura, sem caminho para as cópias de
  // segurança (que só se alcançam dentro do app). Com a rede POR CARD, a festa
  // que não monta vira um aviso nomeado no lugar dela, as outras seguem
  // mostrando os números, e o cabeçalho com "Ajustes" e "Proteção de dados"
  // continua clicável — que é o caminho de volta.
  //
  // `chave={ev}` é a identidade do OBJETO do evento: o store é substituído por
  // cópia a cada alteração, então restaurar um backup troca a referência e a
  // rede se desarma sozinha (sem isso, a festa consertada continuaria com o
  // aviso para sempre — falso positivo). A referência é estável entre renders
  // quando nada muda, o que é o que impede o laço zera→estoura→zera.
  const cardComRede = (ev) => (
    <RedeDeSeguranca
      key={ev.id}
      variante="card"
      chave={ev}
      nome={ev.nome}
      onProtecao={() => setProtecao(true)}
      onAjustes={abrirAjustes}
    >
      <EventoCard
        evento={ev}
        abrir={() => abrir(ev.id)}
        duplicar={() => duplicar(ev)}
        novaEdicao={() => novaEdicao(ev)}
        excluir={() => excluir(ev)}
        ehBenchmark={ehEventoBenchmark(ev)}
      />
    </RedeDeSeguranca>
  )

  // Home agrupada por festa (sugestão 16): só quando existe pelo menos um
  // evento com tipo — sem tipos, a grade continua exatamente como era.
  // Ordem: marcas do Financeiro primeiro, depois tipos custom (alfabético),
  // "Sem categoria" por último.
  const grupos = (() => {
    if (!store.eventos.some((e) => e.tipo && e.tipo.trim())) return null
    const por = new Map()
    for (const ev of store.eventos) {
      const t = ev.tipo && ev.tipo.trim() ? ev.tipo : ''
      if (!por.has(t)) por.set(t, [])
      por.get(t).push(ev)
    }
    const customs = [...por.keys()]
      .filter((t) => t && !TIPOS_PADRAO.includes(t))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    const ordem = [
      ...TIPOS_PADRAO.filter((t) => por.has(t)),
      ...customs,
      ...(por.has('') ? [''] : []),
    ]
    return ordem.map((t) => ({ tipo: t, eventos: por.get(t) }))
  })()

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* a ostra da casa — mesma assinatura do topo do Financeiro */}
          <LogoOstra size={26} className="shrink-0 text-[var(--acento)]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Planejador</h1>
            <p className="mt-0.5 text-sm text-[var(--tinta-2)]">
              Marfim Alto · Brisa · Sobrado · O Galeao
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={abrirAjustes}
            title="Premissas e custos padrão por festa, proteção de dados, backup (exportar e importar), aparência, benchmarks"
          >
            <AppIcon icon={Settings} /> Ajustes
          </Btn>
          <Btn onClick={() => setProtecao(true)} title="Lixeira, versões automáticas e versões de reunião">
            <AppIcon icon={ShieldCheck} /> Proteção de dados
          </Btn>
          {/* Backup é uma família só (F2-Y, adendo do Marco): os dois destinos
              de backup ficam JUNTOS num grupo emoldurado, separados das demais
              ações — em vez de 6 botões soltos de mesmo peso (guia Linear).
              "Exportar backup" (o JSON que baixa) é o principal; "Enviar ao
              Financeiro" é o atalho da ação que já morava em Ajustes › Backup.
              PESO VISUAL (Marco, via orquestrador — Sessão Polimento Visual):
              o grupo tem o MESMO peso dos irmãos secundários (fundo papel, texto
              tinta) — antes era `ghost` (texto apagado) e destoava. A moldura
              dá a borda única; cada botão perde a sua (border-0) para não
              duplicar linha, e o separador vertical mantém a leitura de família. */}
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--borda-2)]">
            <Btn
              variant="secondary"
              onClick={exportar}
              className="rounded-none border-0 hover:bg-[var(--papel-2)]"
              title="Baixa o backup JSON — a única cópia dos dados fora deste navegador. Importar backup: Ajustes › Backup."
            >
              <AppIcon icon={Download} /> Exportar backup
            </Btn>
            <span className="h-5 w-px shrink-0 bg-[var(--borda-2)]" aria-hidden="true" />
            <Btn
              variant="secondary"
              onClick={enviarAoFinanceiro}
              className="rounded-none border-0 hover:bg-[var(--papel-2)]"
              // Na cópia da nuvem (05/10/2026) a ponte não existe: desligado,
              // e o title diz por quê.
              disabled={origemNaNuvem()}
              title={
                origemNaNuvem()
                  ? TITULO_PONTE_NA_NUVEM
                  : 'Grava o backup JSON de agora na pasta de backups do Financeiro local. Financeiro fechado = aviso discreto, nada quebra. Controle do token: Ajustes › Backup.'
              }
            >
              <AppIcon icon={ArrowUpRight} /> Enviar ao Financeiro
            </Btn>
          </div>
          {/* Leitura falhou = porta de escrita FECHADA, igual à ponte com o
              Financeiro (EventEditor.jsx, `disabled={eventoFechado(evento)}`
              com o motivo no title). Medido em 27/07/2026: com a gravação
              bloqueada, a tela vazia logo abaixo tira TODAS as portas de
              escrita e diz "Não crie nada aqui agora" — mas este botão do
              cabeçalho continuava clicável. Não é perda de dado (saveStore
              recusa e a faixa vermelha aparece); é TRABALHO PERDIDO: o Marco
              escolhe o arquivo, revisa item a item, clica salvar e só então
              descobre. */}
          <Btn
            onClick={() => setImportando(true)}
            disabled={gravacaoBloqueada()}
            title={
              gravacaoBloqueada()
                ? 'Indisponível agora: o app não conseguiu ler seus dados salvos e está sem gravar nada — o evento importado se perderia. Restaure uma versão em “Proteção de dados” e importe depois.'
                : 'Importa a planilha .xlsx de um evento passado, com revisão antes de salvar'
            }
          >
            <AppIcon icon={FileUp} /> Importar evento antigo
          </Btn>
          <Btn variant="primary" onClick={() => setCriando(true)}>
            <AppIcon icon={Plus} /> Novo evento
          </Btn>
        </div>
      </header>

      {bkStatus.vencido && store.eventos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(180,145,0,0.4)] bg-[rgba(254,205,7,0.12)] px-3 py-2 text-sm text-[var(--ambar-texto)]">
          <span>
            {bkStatus.nunca
              ? 'Você ainda não exportou nenhum backup JSON. É a única cópia dos seus dados fora deste navegador.'
              : `Seu último backup JSON foi há ${bkStatus.dias} dias. Vale exportar um novo para não perder trabalho.`}
          </span>
          <Btn onClick={exportar}>Exportar backup agora</Btn>
        </div>
      )}

      {avisoSnapshot && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[rgba(180,145,0,0.4)] bg-[rgba(254,205,7,0.12)] px-3 py-2 text-sm text-[var(--ambar-texto)]">
          <span>{avisoSnapshot}</span>
          <button
            type="button"
            onClick={() => setAvisoSnapshot(null)}
            className="shrink-0 cursor-pointer text-[var(--ambar-texto)] opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dispensar aviso"
          >
            <AppIcon icon={X} />
          </button>
        </div>
      )}

      {/* aviso DISCRETO (nunca erro): o backup externo do dia não aconteceu */}
      {avisoBackupExterno && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--borda)] bg-[var(--papel)] px-3 py-2 text-xs text-[var(--tinta-3)]">
          <span>{avisoBackupExterno}</span>
          <button
            type="button"
            onClick={() => setAvisoBackupExterno(null)}
            className="shrink-0 cursor-pointer hover:text-[var(--tinta)]"
            aria-label="Dispensar aviso"
          >
            <AppIcon icon={X} />
          </button>
        </div>
      )}

      {store.eventos.length === 0 && gravacaoBloqueada() ? (
        // Lista vazia por FALHA DE LEITURA não é a lista vazia de quem está
        // começando. Pego ao vivo: a faixa vermelha dizia "não crie nem edite
        // previsões agora" e logo abaixo esta mesma tela convidava a criar uma
        // — o convite era exatamente a ação que podia custar o dado. Aqui a
        // tela vazia repete o recado da faixa e não oferece nenhuma porta de
        // escrita; o caminho é o de cima, restaurar em Proteção de dados.
        <div className="flex min-h-[44vh] flex-col items-center justify-center gap-4 text-center">
          <Bola size={40} cor="var(--vermelho-texto)" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Esta lista está vazia porque não deu para ler seus dados</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--tinta-2)]">
              Não é que não exista nada salvo — é que o app não conseguiu abrir o que está
              gravado. Não crie nada aqui agora: siga o aviso vermelho no topo da tela e
              restaure uma versão em <strong>Proteção de dados</strong>.
            </p>
          </div>
        </div>
      ) : store.eventos.length === 0 ? (
        // -mr-36 (só ≥xl) reclama a reserva à direita do App (pr-36) para este
        // bloco centralizar na TELA, não no espaço menos os 9rem — o "não está
        // centralizado" do Marco em tela cheia.
        <div className="flex min-h-[44vh] flex-col items-center justify-center gap-4 text-center xl:-mr-36">
          {/* a bola azul da marca como elemento da tela vazia (direção) */}
          <Bola size={40} cor="var(--acento)" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Nenhum evento ainda</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--tinta-2)]">
              Crie um evento do zero ou importe uma planilha (.xlsx). Tudo fica salvo
              automaticamente neste navegador.
            </p>
          </div>
          <div className="mt-1 flex gap-2">
            <Btn onClick={() => setImportando(true)}>
              <AppIcon icon={FileUp} /> Importar planilha
            </Btn>
            <Btn variant="primary" onClick={() => setCriando(true)}>
              <AppIcon icon={Plus} /> Novo evento
            </Btn>
          </div>
        </div>
      ) : grupos ? (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.tipo || '(sem categoria)'}>
              {/* Cabeçalho de grupo como UMA unidade alinhada (Sessão F2-P, print
                  do Marco): bola de cor da festa · assinatura da festa · contagem,
                  na mesma linha-base (items-center + leading-none) e no eixo
                  esquerdo dos cards. A assinatura vem do MarcaFesta (cursivo da
                  Brisa recortado — sem o lockup ruidoso; wordmark da Sobrado;
                  nome em texto para Marfim/O Galeao/sem tipo), com altura única
                  para todas as festas. */}
              <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold leading-none text-[var(--tinta)]">
                {g.tipo && <Bola size={11} cor={corFesta(g.tipo, aparencia, temaEscuroEfetivo(aparencia))} />}
                <MarcaFesta tipo={g.tipo} height={15} />
                <span className="text-xs font-normal leading-none text-[var(--tinta-3)]">
                  {g.eventos.length} {g.eventos.length === 1 ? 'evento' : 'eventos'}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.eventos.map((ev) => cardComRede(ev))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.eventos.map((ev) => cardComRede(ev))}
        </div>
      )}

      {/* Acurácia das previsões (sugestão 23) — leitura pura dos fechamentos.
          Dentro da rede porque ele percorre TODAS as festas (acuracia.js chama
          computeCenario por evento): medido em 26/07/2026, com UMA festa de
          `lotes` fora de forma este resumo derrubava a Home inteira mesmo com
          cada card já protegido. `chave={store.eventos}` desarma a rede quando
          a lista muda (restaurar um backup troca o array). */}
      <RedeDeSeguranca variante="bloco" nome="Acurácia das previsões" chave={store.eventos}>
        <AcuraciaResumo store={store} />
      </RedeDeSeguranca>

      <section className="mt-10">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--tinta-2)]">
            Eventos antigos de referência (benchmarks)
          </h2>
          <Btn variant="ghost" onClick={() => setEditandoBms(true)}>
            <AppIcon icon={Pencil} /> Editar
          </Btn>
        </div>
        {/* Tabela densa em vez das pílulas de texto corrido (régua Puzzle —
            handoff UX 23/07): custo e público como COLUNAS alinhadas à direita
            e tabulares, comparáveis de relance, em vez de valores enterrados no
            meio da frase. É só apresentação — os benchmarks seguem sendo dado
            de referência (nenhuma conta, nenhum golden). Tudo que os chips
            diziam continua: importados em azul + X de remover; "sem reserva"
            como etiqueta na linha; o tooltip por linha. Largura contida
            (max-w-2xl) para a tabela ficar densa, não esticada na tela toda. */}
        <div className="max-w-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-[var(--tinta-2)]">
                <th className="border-b border-[var(--borda-2)] py-1.5 pr-3 text-left font-medium">
                  Referência
                </th>
                <th className="border-b border-[var(--borda-2)] px-3 py-1.5 text-right font-medium">
                  Custo
                </th>
                <th className="border-b border-[var(--borda-2)] py-1.5 pl-3 text-right font-medium">
                  Público
                </th>
                <th className="w-0 border-b border-[var(--borda-2)]" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {benchmarksVisiveis(store).map((b) => (
                <tr
                  key={b.id}
                  title={temSemReserva(b) ? EXPLICACAO_SEM_RESERVA : b.obs || undefined}
                  className="border-b border-[var(--borda)] last:border-b-0"
                >
                  {/* Sem "· editado" aqui (Marco, 19/07/2026). Neste RESUMO a
                      linha responde "qual é a referência e quanto ela vale"; a
                      etiqueta não muda nenhum desses números. Ela CONTINUA no
                      editor de benchmarks, ao lado de "Restaurar/Salvar como
                      padrão", onde tem função. O estado "importado" também mora
                      no editor — aqui o nome fica neutro (azul = só ação, Marco
                      24/07). */}
                  <td className="py-1.5 pr-3">
                    <span className="text-[var(--tinta)]">{b.nome}</span>
                    {/* "sem reserva" (decisão 3 do Marco, 20/07/2026): etiqueta
                        discreta na própria linha — o custo ao lado é o número
                        que a reserva faz divergir. */}
                    {temSemReserva(b) && (
                      <span className="ml-2 rounded-full border border-[var(--borda)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tinta-3)]">
                        {ETIQUETA_SEM_RESERVA}
                      </span>
                    )}
                  </td>
                  <td className="tnum px-3 py-1.5 text-right font-medium text-[var(--tinta)]">
                    {/* Referência quebrada (05/10/2026): a célula escrevia "R$ 0"
                        para uma régua com 1 seguido de 308 zeros dentro. */}
                    {benchmarkQuebrado(b).ha ? (
                      <span className="text-xs font-normal text-[var(--vermelho-texto)]">
                        {FRASE_CELULA_BENCHMARK_QUEBRADO}
                      </span>
                    ) : (
                      fmtCompact(b.custoTotal)
                    )}
                  </td>
                  <td className="tnum py-1.5 pl-3 text-right text-[var(--tinta-2)]">
                    {/* Público ilegível (S1, 07/10/2026): escrevia "0" (ou
                        309 dígitos, ou "-5"). O original vai no title e no
                        campo do "Editar". Zero e ausência seguem "—". */}
                    {publicoDaReferencia(b).estado === ESTADO_PUBLICO.ILEGIVEL ? (
                      <span
                        className="text-xs text-[var(--vermelho-texto)]"
                        title={`Valor guardado: ${textoPublicoGuardado(b.publico)}`}
                      >
                        {VALOR_ILEGIVEL}
                      </span>
                    ) : publicoDaReferencia(b).estado === ESTADO_PUBLICO.VALIDO ? (
                      fmtInt(b.publico)
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    {b.custom && (
                      <button
                        type="button"
                        className="cursor-pointer text-[var(--azul-texto)] hover:text-[var(--tinta)]"
                        onClick={() => excluirBenchmark(b)}
                        title="Remover benchmark importado"
                        aria-label={`Remover benchmark ${b.nome}`}
                      >
                        <AppIcon icon={X} size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {benchmarksOcultosIds(store).length > 0 && (
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            {benchmarksOcultosIds(store).length} benchmark(s) oculto(s) das comparações — nada foi
            apagado; gerencie em Ajustes › Benchmarks ou em “Editar”.
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--tinta-3)]">
          Os benchmarks aparecem ao lado das categorias de custo e na comparação de cenários. Use
          “Editar” para corrigir ou reagrupar valores — os embutidos podem ser restaurados ao
          padrão. Dados salvos localmente neste navegador — exporte um backup JSON para garantir.
        </p>
      </section>

      {criando && (
        <NovaPrevisaoModal
          store={store}
          aparencia={aparencia}
          criar={criar}
          onClose={() => setCriando(false)}
        />
      )}
      {importando && (
        <ImportModal
          store={store}
          setStore={setStore}
          abrir={abrir}
          onClose={() => setImportando(false)}
        />
      )}
      {editandoBms && (
        <BenchmarksEditor store={store} setStore={setStore} onClose={() => setEditandoBms(false)} />
      )}
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
