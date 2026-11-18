import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  loadStore,
  saveStore,
  exportBackup,
  montarBackup,
  estadoLeitura,
  exportarQuarentena,
} from './lib/storage.js'
import { loadSnapshots, loadLixeira, snapshotSeguranca } from './lib/protecao.js'
import {
  fecharEvento as fecharEventoLib,
  reabrirEvento as reabrirEventoLib,
  MOTIVO_NAO_FECHA,
  motivoNaoFechar,
} from './lib/fechamentoEvento.js'
import { showToast } from './lib/toast.js'
import {
  conteudoDoBackupAoSair,
  falhaBackupAoSair,
  limparFalhaBackupAoSair,
} from './lib/backupAoSair.js'
import { fmtDataHora } from './lib/financeiro.js'
import { excluirBenchmarkCustom } from './lib/benchmarks.js'
import { Btn, ToastHost } from './components/ui.jsx'
import { AppIcon, Sun, Moon } from './components/AppIcon.jsx'
import {
  estadoInicial,
  reduzirComHistorico,
  podeDesfazer as temDesfazer,
  podeRefazer as temRefazer,
  textoDesfazer,
  textoRefazer,
} from './lib/historico.js'
import { resolverDescritor } from './lib/descritorEdicao.js'
import { interpretarAtalho, doEventoDeTeclado } from './lib/atalhoHistorico.js'
import BotoesHistorico from './components/BotoesHistorico.jsx'
import {
  loadAparencia,
  saveAparencia,
  aplicarAcento,
  aplicarTema,
  vigiarTemaSistema,
  formaAparencia,
  temaEscuroEfetivo,
} from './lib/aparencia.js'
import { agora } from './lib/util.js'
import { vigiarOutrasAbas } from './lib/multiAba.js'
import Home from './components/Home.jsx'
import EventEditor from './components/EventEditor.jsx'
import PresentationMode from './components/PresentationMode.jsx'
import ReportView from './components/ReportView.jsx'
import Ajustes from './components/Ajustes.jsx'
import RedeDeSeguranca from './components/RedeDeSeguranca.jsx'

export default function App() {
  // Store + histórico de desfazer/refazer num reducer só (historico.js). O
  // histórico é da SESSÃO e vive em memória: nada dele encosta no localStorage
  // — a cota de lá é dos dados do Marco. Fechou a aba, o histórico acaba; a
  // recuperação grande continua sendo lixeira, snapshots e backup JSON.
  const [{ store, hist }, dispatch] = useReducer(reduzirComHistorico, null, () =>
    estadoInicial(loadStore())
  )
  const [route, setRoute] = useState({ view: 'home' })

  /**
   * A ÚNICA porta de escrita do store. Mesma assinatura de sempre —
   * `setStore(fn)` — mais um segundo argumento OPCIONAL que nomeia a ação para
   * o botão de desfazer: `setStore(fn, 'apagar item de custo')` ou
   * `setStore(fn, { rotulo, grupo })`.
   *
   * Sem esse argumento, o rótulo é lido do CAMPO EM FOCO (descritorEdicao.js):
   * digitar no campo "Margem alvo" vira "Desfazer: mudar Margem alvo", e as
   * teclas seguidas no mesmo campo viram UM passo só. Nem rótulo do foco nem
   * rótulo explícito? Cai no genérico ("a última alteração") — rótulo genérico
   * é melhor que rótulo errado.
   *
   * `setStore(fn, { foraDoHistorico: true, rotulo })` é a porta das ações que
   * também mexem FORA do store (a lixeira): elas não viram passo de desfazer e
   * zeram a pilha, que passaria a discordar do lado de fora. O `rotulo` vira a
   * explicação que os botões dão. Ver o bloco grande em historico.js.
   */
  const setStore = useCallback((fn, descritor) => {
    if (typeof descritor === 'object' && descritor?.foraDoHistorico) {
      dispatch({ tipo: 'foraDoHistorico', fn, motivo: descritor.rotulo })
      return
    }
    dispatch({
      tipo: 'alterar',
      fn,
      // O foco só é lido quando ninguém nomeou a ação — clique de botão que
      // já se nomeia não precisa (e não deve) herdar o nome de um campo.
      // A regra mora em descritorEdicao.js, com teste (achado S2-D).
      descritor: resolverDescritor(descritor),
      em: Date.now(),
    })
  }, [])

  // ————— Modo Simular (rascunho que não salva) —————
  // O rascunho de cenários vive em React state dentro do EventEditor e NUNCA
  // toca o store. Como esta pilha é do STORE, desfazer ali seria uma armadilha:
  // o Marco arrasta um slider do rascunho, aperta Cmd+Z e desfaria uma edição
  // SALVA de cinco minutos atrás. Decisão: enquanto o rascunho está aberto,
  // desfazer/refazer ficam DESABILITADOS e dizem por quê. O rascunho tem a
  // própria saída inteira ("Descartar" / Esc), e "Aplicar simulação" entra na
  // pilha como UM passo — depois de aplicar, Cmd+Z desfaz a aplicação.
  // Assim nada vaza do rascunho para o salvo nem do salvo para o rascunho.
  const [simulandoRascunho, setSimulandoRascunho] = useState(false)

  // Onde os botões ↶ ↷ aparecem: nas páginas de TRABALHO. O modo apresentação
  // e o relatório não têm chrome (são peças de reunião e de PDF).
  const chrome = route.view !== 'apresentacao' && route.view !== 'relatorio'

  // (Achado S3-F.) O atalho vale exatamente onde o botão vale. Antes, o
  // listener de Cmd+Z continuava ativo na apresentação e no relatório, com os
  // botões escondidos: no meio de uma reunião, um Cmd+Z desavisado desfazia
  // uma alteração real sem nada na tela dizendo o que tinha acontecido nem
  // oferecendo o caminho de volta. Atalho que age sem botão que explique é
  // ação em silêncio — e aqui nada age em silêncio.
  const historicoAtivo = !simulandoRascunho && chrome

  const podeDesfazer = historicoAtivo && temDesfazer(hist)
  const podeRefazer = historicoAtivo && temRefazer(hist)
  const desfazer = useCallback(() => dispatch({ tipo: 'desfazer' }), [])
  const refazer = useCallback(() => dispatch({ tipo: 'refazer' }), [])

  const AVISO_SIMULANDO =
    'Sem desfazer no modo Simular — o rascunho não é salvo. Use Descartar (ou Esc) para largar a simulação inteira.'
  const rotuloDesfazer = simulandoRascunho ? AVISO_SIMULANDO : textoDesfazer(hist)
  const rotuloRefazer = simulandoRascunho ? AVISO_SIMULANDO : textoRefazer(hist)

  // Atalhos: Cmd+Z / Cmd+Shift+Z. Dentro de um campo de texto o atalho NÃO é
  // sequestrado — ali vale o desfazer nativo do input (ver atalhoHistorico.js).
  useEffect(() => {
    if (!historicoAtivo) return undefined
    const onKey = (e) => {
      const acao = interpretarAtalho(doEventoDeTeclado(e))
      if (!acao) return
      e.preventDefault()
      dispatch({ tipo: acao })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historicoAtivo])

  // Aparência (sugestão 26): chave própria do localStorage, fora do store e
  // do backup — só cores de exibição; o semáforo não passa por aqui.
  const [aparencia, setAparenciaState] = useState(loadAparencia)
  useEffect(() => {
    aplicarAcento(aparencia)
    aplicarTema(aparencia)
    // no modo automático, seguir o sistema quando ele trocar claro↔escuro
    return vigiarTemaSistema(aparencia, () => aplicarTema(aparencia))
  }, [aparencia])
  const setAparencia = (nova) => {
    const forma = formaAparencia(nova)
    const r = saveAparencia(forma)
    if (!r.ok) window.alert(r.erro)
    setAparenciaState(forma)
  }

  // Salva automaticamente a cada alteração. Se a gravação falhar (quota do
  // navegador cheia — hardening 4.1), NADA é silencioso: a faixa vermelha
  // fica em toda tela até uma gravação voltar a funcionar. O dado segue em
  // memória e o export JSON funciona sem localStorage.
  // Guarda o RESULTADO inteiro, não só a mensagem: `bloqueado` distingue as
  // duas faixas (quota cheia × leitura falhou), que pedem textos e saídas
  // diferentes. E como o efeito reroda a cada store, a faixa da leitura some
  // sozinha assim que uma gravação volta a funcionar — restaurar um snapshot
  // libera a trava e o próximo save limpa o aviso, sem plumbing nenhum.
  const [saveEstado, setSaveEstado] = useState(null)
  useEffect(() => {
    const r = saveStore(store)
    setSaveEstado(r.ok ? null : r)
  }, [store])

  // Fotografia da falha de leitura tirada na MONTAGEM (loadStore já rodou no
  // init do reducer). Fica congelada de propósito: depois que a trava é
  // liberada, `estadoLeitura()` volta a ser null, mas o texto da faixa ainda
  // precisa dos detalhes — quem decide se a faixa aparece é `saveEstado`.
  const [leituraFalhou] = useState(() => estadoLeitura())

  // Contados uma vez, na montagem: são as saídas que a faixa oferece. Lixeira e
  // snapshots vivem em CHAVES SEPARADAS do store — a corrupção de uma não
  // encosta nas outras, e quase sempre estão inteiras.
  const [socorro] = useState(() =>
    estadoLeitura() ? { snapshots: loadSnapshots().length, lixeira: loadLixeira().length } : null
  )

  // Segunda aba aberta = risco de sobrescrita (hardening 4.2): as duas
  // gravam no mesmo localStorage e a última vence. Mitigação decidida no
  // prompt: só o aviso persistente — nada de lock, nada de bloquear.
  const [outraAba, setOutraAba] = useState(false)
  useEffect(() => vigiarOutrasAbas(setOutraAba), [])

  // Backup ao SAIR (Marco 24/07/2026): a casca nativa (WKWebView) chama esta
  // função no "Sair"/Cmd+Q para gravar um arquivo de backup LOCAL com o estado
  // atual. Os dados vivem no navegador; o servidor do Planejador (vite preview)
  // não os tem, então quem entrega o conteúdo é o web. O salvamento normal já é
  // síncrono a cada mudança — isto só acrescenta a CÓPIA em arquivo, na saída.
  // Fora do app nativo é inofensiva (ninguém chama). Mantida com o store atual.
  //
  // E QUANDO ELE NÃO ACONTECE (conserto de 30/08/2026, achado S3): o `catch`
  // aqui era `catch { return '' }`, mudo. O Swift guarda com `!json.isEmpty`,
  // então nada era sobrescrito — mas nenhum arquivo aparecia e ninguém ficava
  // sabendo. Agora a falha é registrada no disco (`backupAoSair.js`) e vira a
  // faixa da abertura seguinte: no instante do "Sair" não há tela para avisar,
  // então o aviso espera pela próxima vez em que ele possa fazer algo.
  useEffect(() => {
    window.__backupAoSair = () => conteudoDoBackupAoSair(store, montarBackup)
    return () => {
      if (window.__backupAoSair) delete window.__backupAoSair
    }
  }, [store])

  // Fotografia tirada na MONTAGEM, como a da falha de leitura: a marca é do
  // "Sair" ANTERIOR, e limpá-la é ato do usuário (o botão da faixa), não efeito
  // colateral de abrir o app.
  const [falhaAoSair, setFalhaAoSair] = useState(() => falhaBackupAoSair())
  const esconderFalhaAoSair = () => {
    limparFalhaBackupAoSair()
    setFalhaAoSair(null)
  }

  // ÂMBAR e não vermelha: nenhum dado se perdeu nem foi corrompido — o que
  // faltou foi a CÓPIA em arquivo da última saída. O texto diz a data, o motivo
  // que o navegador deu, e oferece a saída (exportar agora). Os dois botões
  // dizem o efeito, como manda a casa: um exporta E some com o aviso, o outro
  // só some com o aviso.
  const faixaBackupAoSair = falhaAoSair ? (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(180,145,0,0.4)] bg-[rgba(254,205,7,0.14)] px-4 py-2.5 text-sm text-[var(--ambar-texto)]">
      <span>
        <strong>O backup automático da última saída não foi gravado.</strong> Seus dados
        continuam salvos neste navegador e nada foi sobrescrito — o que faltou foi a{' '}
        <strong>cópia em arquivo</strong>
        {/* a data só entra se ela FORMATAR: `fmtDataHora` devolve '' para
            instante ilegível, e sem esta guarda a frase saía " da saída de ."
            — outra data inválida virando texto quebrado na tela. */}
        {fmtDataHora(falhaAoSair.em) ? ` da saída de ${fmtDataHora(falhaAoSair.em)}` : ''}. Motivo que o
        navegador deu: <em>{falhaAoSair.motivo}</em>.
      </span>
      <span className="flex flex-wrap gap-2">
        <Btn
          onClick={() => {
            // O aviso só some se o backup REALMENTE saiu. Esconder um problema
            // que não foi resolvido é exatamente o defeito que esta faixa veio
            // consertar — e o rótulo promete as duas coisas, não uma.
            try {
              exportBackup(store)
            } catch (e) {
              window.alert(`Não deu para exportar o backup: ${e?.message || e}`)
              return
            }
            esconderFalhaAoSair()
          }}
        >
          Exportar backup agora e esconder o aviso
        </Btn>
        <Btn onClick={esconderFalhaAoSair}>Esconder o aviso</Btn>
      </span>
    </div>
  ) : null

  const faixaOutraAba = outraAba ? (
    <div className="border-b border-[rgba(180,145,0,0.4)] bg-[rgba(254,205,7,0.14)] px-4 py-2 text-sm text-[var(--ambar-texto)]">
      O app está aberto em <strong>outra aba ou janela</strong>. Edite em uma só: as
      duas gravam no mesmo lugar e a última que salvar sobrescreve a outra.
    </div>
  ) : null

  // Duas faixas vermelhas diferentes, porque são dois problemas diferentes:
  //
  // LEITURA FALHOU (a mais grave): a lista na tela está vazia e NÃO é a lista
  // do Marco. O pior que ele pode fazer aqui é trabalhar por cima — por isso a
  // faixa diz o que NÃO fazer antes de dizer o que fazer, e a gravação já está
  // travada lá no storage.js, independentemente de ele ler o aviso.
  //
  // QUOTA CHEIA: os dados estão certos em memória, só não couberam. Aqui o
  // conselho é o oposto — mexer pode, fechar a aba não.
  const faixaLeitura =
    saveEstado?.bloqueado && leituraFalhou ? (
      <div className="border-b-2 border-[var(--vermelho)] bg-[var(--tarja-alerta-fundo)] px-4 py-3 text-sm text-[var(--vermelho-texto)]">
        <p className="font-semibold">
          Não foi possível LER os dados salvos neste navegador.
        </p>
        <p className="mt-1.5">
          A lista que aparece na tela está <strong>vazia — e essa não é a sua lista</strong>:
          é o app sem conseguir abrir o que estava gravado. Por isso a gravação está{' '}
          <strong>bloqueada de propósito</strong>: nada é salvo por cima do que sobrou.{' '}
          <strong>Não crie nem edite eventos agora</strong> — e não esvazie a lixeira.
        </p>
        <p className="mt-1.5">
          Seu conteúdo original continua gravado no navegador, intacto.{' '}
          {leituraFalhou.quarentenaOk ? (
            <>
              Uma cópia dele também foi posta em quarentena (
              <code className="rounded border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-1 text-xs">
                {leituraFalhou.chaveQuarentena}
              </code>
              , {leituraFalhou.bytes.toLocaleString('pt-BR')} caracteres).
            </>
          ) : (
            <>Não deu para tirar uma cópia de segurança dele, mas o original não foi tocado.</>
          )}
        </p>
        <p className="mt-1.5">
          <strong>Caminho de volta:</strong> as cópias automáticas e a lixeira ficam em
          outros lugares do navegador e não foram afetadas —{' '}
          <strong>
            {socorro?.snapshots || 0} versão(ões) guardada(s) e {socorro?.lixeira || 0} item(ns)
            na lixeira
          </strong>
          . Abra <strong>Ajustes › Proteção de dados</strong> e restaure a versão mais
          recente: isso substitui a lista vazia pelos seus dados e libera a gravação.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              const r = exportarQuarentena(leituraFalhou.chaveQuarentena)
              if (!r.ok) window.alert(`Não deu para exportar o dado bruto: ${r.erro}`)
            }}
          >
            Baixar o dado bruto ilegível
          </Btn>
        </div>
      </div>
    ) : null

  const faixaSalvar =
    saveEstado && !saveEstado.bloqueado ? (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-4 py-2.5 text-sm text-[var(--vermelho-texto)]">
        <span>
          <strong>Não deu para salvar suas alterações no navegador</strong> (armazenamento
          cheio). Nada se perdeu ainda: os dados estão em memória — <strong>não feche esta
          aba</strong>. Exporte um backup JSON agora e libere espaço em Proteção de dados
          (esvaziar lixeira ou excluir versões antigas).
        </span>
        <Btn onClick={() => exportBackup(store)}>Exportar backup agora</Btn>
      </div>
    ) : null

  const evento = useMemo(
    () => store.eventos.find((e) => e.id === route.id) || null,
    [store, route]
  )

  // `update` das telas de evento. Aceita o mesmo descritor opcional do
  // setStore: `update(fn, 'apagar item de custo')` nomeia o passo; sem ele, o
  // rótulo vem do campo em foco.
  //
  // Trava DUPLA contra gravar em cima de evento fechado (a foto do
  // fechamento é fato histórico — ver fechamentoEvento.js):
  // (a) checagem EXTERNA, antes do setStore — avisa o Marco e nem entra na
  //     fila do reducer; e
  // (b) guarda INTERNA e PURA dentro do updater — se por qualquer motivo o
  //     evento no estado `s` já estiver fechado (ex.: outra aba fechou entre
  //     o clique e o dispatch), devolve a MESMA referência de `s`: sem
  //     efeito colateral aqui dentro, StrictMode roda isto 2× em dev.
  // Devolve { ok } para o CHAMADOR poder ser honesto: as telas que aplicam
  // dado (ponte, benchmark-base, simulação) checam o retorno antes de afirmar
  // sucesso — foi o falso "N valores aplicados" do achado adversarial de
  // 20/07/2026. Chamador que ignora o retorno (digitação de campo) segue
  // funcionando como sempre.
  const updateEvento = (id, fn, descritor) => {
    const atual = store.eventos.find((e) => e.id === id)
    if (atual?.status === 'fechado') {
      showToast(
        'Este evento está fechado — os campos estão travados. Reabra na aba Fechamento para editar.'
      )
      return { ok: false, motivo: 'evento fechado' }
    }
    setStore(
      (s, contextoCarregamento) => {
        const alvo = s.eventos.find((e) => e.id === id)
        if (!alvo || alvo.status === 'fechado') return s
        // O contexto transitório acompanha a versão ATUAL das fotos de desfazer.
        const proximo = fn(alvo, contextoCarregamento)
        if (proximo === alvo) return s
        return {
          ...s,
          eventos: s.eventos.map((e) => (e.id === id ? { ...proximo, atualizadoEm: agora() } : e)),
        }
      },
      descritor
    )
    return { ok: true }
  }

  // ————— Fechamento de evento (Parte 2 da obra, 20/07/2026) —————
  // As duas ações moram aqui (não em fechamentoEvento.js) porque precisam de
  // setStore e do snapshot de segurança — o módulo puro só monta a foto e
  // devolve o evento novo; quem grava e quem tira a cópia de segurança é o
  // App, como em toda outra ação de dado (princípio 7).
  const fecharEventoAcao = (id) => {
    const alvo = store.eventos.find((e) => e.id === id)
    if (!alvo || alvo.status === 'fechado') return { ok: false, motivo: 'Este evento já está fechado.' }
    const motivo = motivoNaoFechar(alvo)
    if (motivo) return { ok: false, motivo }
    const fechado = fecharEventoLib(alvo, agora()) // UMA vez, FORA do updater
    if (!fechado) return { ok: false, motivo: MOTIVO_NAO_FECHA }
    const seg = snapshotSeguranca(store, agora(), `antes de fechar "${alvo.nome}"`)
    if (!seg.ok)
      return {
        ok: false,
        motivo:
          'Não deu para guardar a cópia de segurança antes de fechar (armazenamento do navegador cheio) — NADA foi alterado. Libere espaço em Proteção de dados e tente de novo.',
      }
    setStore(
      (s) => {
        // Guarda interna PURA, igual à do updateEvento: se outra aba fechou
        // este evento entre o clique e o dispatch, o fechamento dela é fato
        // histórico — este NÃO sobrescreve (achado adversarial 20/07/2026).
        const atual = s.eventos.find((e) => e.id === id)
        if (atual?.status === 'fechado') return s
        return { ...s, eventos: s.eventos.map((e) => (e.id === id ? fechado : e)) }
      },
      `fechar o evento "${alvo.nome}"`
    )
    return { ok: true }
  }

  const reabrirEventoAcao = (id) => {
    const alvo = store.eventos.find((e) => e.id === id)
    if (!alvo || alvo.status !== 'fechado') return { ok: false, motivo: 'Este evento não está fechado.' }
    const bmId = alvo.fechamento?.benchmarkId
    const reaberto = reabrirEventoLib(alvo)
    setStore(
      (s) => {
        const base = { ...s, eventos: s.eventos.map((e) => (e.id === id ? reaberto : e)) }
        // Reabrir com benchmark promovido remove o benchmark na MESMA ação
        // desfazível: a foto virou régua, reaberta a festa a régua sai
        // junto — um Cmd+Z devolve os dois. A remoção usa a função canônica
        // (excluirBenchmarkCustom), que limpa também benchmarksOcultos — sem
        // ela sobrava id órfão no store (achado adversarial 20/07/2026).
        return bmId ? excluirBenchmarkCustom(base, bmId) : base
      },
      `reabrir o evento "${alvo.nome}"`
    )
    return { ok: true, removeuBenchmark: !!bmId }
  }

  // A vista da rota atual; as faixas de aviso do App (salvar falhou) vêm
  // ANTES dela em toda tela — inclusive apresentação: perder dado em
  // silêncio é pior que uma faixa numa reunião.
  const vista = (() => {
    if (route.view === 'apresentacao' && evento) {
      return (
        <PresentationMode
          evento={evento}
          store={store}
          aparencia={aparencia}
          update={(fn) => updateEvento(evento.id, fn)}
          onClose={() => setRoute({ view: 'evento', id: evento.id })}
        />
      )
    }
    if (route.view === 'relatorio' && evento) {
      return (
        <ReportView
          evento={evento}
          store={store}
          onBack={() => setRoute({ view: 'evento', id: evento.id })}
        />
      )
    }
    if (route.view === 'ajustes') {
      return (
        <Ajustes
          store={store}
          setStore={setStore}
          aparencia={aparencia}
          setAparencia={setAparencia}
          onBack={() => setRoute({ view: 'home' })}
        />
      )
    }
    if (route.view === 'evento' && evento) {
      return (
        <EventEditor
          evento={evento}
          store={store}
          setStore={setStore}
          aparencia={aparencia}
          update={(fn, descritor) => updateEvento(evento.id, fn, descritor)}
          onBack={() => setRoute({ view: 'home' })}
          onApresentar={() => setRoute({ view: 'apresentacao', id: evento.id })}
          onRelatorio={() => setRoute({ view: 'relatorio', id: evento.id })}
          onModoRascunho={setSimulandoRascunho}
          onFecharEvento={() => fecharEventoAcao(evento.id)}
          onReabrirEvento={() => reabrirEventoAcao(evento.id)}
        />
      )
    }
    return (
      <Home
        store={store}
        setStore={setStore}
        aparencia={aparencia}
        abrir={(id) => setRoute({ view: 'evento', id })}
        abrirAjustes={() => setRoute({ view: 'ajustes' })}
      />
    )
  })()

  // Toggle de tema GLOBAL (Sessão F2-U — item 5): 1 clique claro↔escuro, fixo
  // no topo-direito de TODAS as páginas de trabalho (chrome do layout raiz, uma
  // instância só — não por-tela). SOME no modo apresentação e no relatório/PDF
  // (peças que saem sempre claras). O modo Automático continua nos Ajustes; o
  // toggle reusa o MESMO estado de tema (aparencia.tema). Reserva-se um espaço
  // à direita (pr) nas páginas de trabalho para o botão nunca sobrepor o
  // "salvo automaticamente" do editor nem os botões da Home.
  // (`chrome` é calculado lá em cima, junto do atalho — os dois seguem a mesma
  // regra de propósito: onde não há botão, não há atalho. Ver S3-F.)
  const escuro = temaEscuroEfetivo(aparencia)
  const alternarTema = () =>
    setAparencia({ ...aparencia, tema: escuro ? 'claro' : 'escuro' })

  return (
    <>
      {/* A reserva à direita tem de caber o cluster INTEIRO (↶ ↷ | ☀ = 131px +
          12px da margem right-3 = 143px ≈ 9rem). Menos que isso e o título da
          previsão passa por baixo dos botões no celular. */}
      <div className={chrome ? 'pr-36' : undefined}>
        {faixaLeitura}
        {faixaSalvar}
        {faixaBackupAoSair}
        {faixaOutraAba}
        {/* A REDE (RedeDeSeguranca.jsx) — última linha contra a TELA BRANCA.
            Fica DENTRO da div das faixas de propósito: mesmo com a tela
            substituída pelo painel, os avisos de "não deu para salvar" e
            "outra aba" continuam por cima, e o cluster de tema/desfazer segue
            lá fora. `chave` é a rota (string estável): quando o Marco clica
            "Abrir Ajustes" no painel, a rota muda, a rede se desarma e a tela
            nova monta. A Home ainda tem a rede POR FESTA (uma festa ruim não
            derruba as outras) — esta aqui pega o que escapar dela. */}
        <RedeDeSeguranca
          variante="tela"
          chave={`${route.view}:${route.id ?? ''}`}
          onAjustes={() => setRoute({ view: 'ajustes' })}
        >
          {vista}
        </RedeDeSeguranca>
      </div>
      {chrome && (
        // Cluster fixo do topo-direito: ↶ ↷ e o tema. Uma instância só para o
        // app inteiro — o histórico é do app, não da tela.
        <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 print:hidden">
          <BotoesHistorico
            textoDesfazer={rotuloDesfazer}
            textoRefazer={rotuloRefazer}
            podeDesfazer={podeDesfazer}
            podeRefazer={podeRefazer}
            onDesfazer={desfazer}
            onRefazer={refazer}
          />
          <span className="mx-0.5 h-5 w-px bg-[var(--borda-2)]" aria-hidden="true" />
          <button
            type="button"
            onClick={alternarTema}
            title={
              escuro
                ? 'Tema escuro ativo — clique para o claro (Automático fica em Ajustes › Aparência)'
                : 'Tema claro ativo — clique para o escuro (Automático fica em Ajustes › Aparência)'
            }
            aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-2)] shadow-sm transition-colors hover:text-[var(--tinta)]"
          >
            <AppIcon icon={escuro ? Sun : Moon} size={18} />
          </button>
        </div>
      )}
      <ToastHost />
    </>
  )
}
