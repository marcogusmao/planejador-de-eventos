import { useState } from 'react'
import { Modal, Btn } from './ui.jsx'
import { fmtData } from '../lib/format.js'
import {
  loadLixeira,
  excluirDaLixeira,
  esvaziarLixeira,
  loadSnapshots,
  restaurarSnapshot,
  estadoItemLixeira,
} from '../lib/protecao.js'
import { loadCongeladas, excluirCongelada } from '../lib/versaoReuniao.js'
import { liberarGravacao } from '../lib/storage.js'
import RevisaoRestauracao, { ListaDeEfeitos } from './RevisaoRestauracao.jsx'
import { resumoRevisao } from '../lib/revisaoRestauracao.js'

// Data + hora curtas para os itens da lixeira ("18/07 14:32").
function quando(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fmtData(iso.slice(0, 10))} ${hh}:${mm}`
}

// Modal de proteção de dados: lixeira de eventos (restaurar / excluir de vez).
// Snapshots automáticos entram aqui na etapa seguinte da Sessão C.
// Resumo curto do conteúdo de um snapshot para o Marco reconhecer a versão.
function resumoStore(store) {
  const ev = store?.eventos?.length || 0
  const bm = store?.benchmarksCustom?.length || 0
  const partes = [`${ev} evento${ev === 1 ? '' : 's'}`]
  if (bm) partes.push(`${bm} benchmark${bm === 1 ? '' : 's'}`)
  return partes.join(' · ')
}

export default function ProtecaoModal({
  store,
  onClose,
  onRestaurarEvento,
  onRestaurarEventoComoCopia,
  onRestaurarStore,
}) {
  const [lixeira, setLixeira] = useState(loadLixeira)
  const [snapshots, setSnapshots] = useState(loadSnapshots)
  const [congeladas, setCongeladas] = useState(loadCongeladas)
  const [erro, setErro] = useState(null)
  // Correções que ACONTECERAM (lixeira): a transação já rodou, então o texto é
  // no passado. Nada muda em silêncio, nem quando a mudança foi para melhor.
  const [aviso, setAviso] = useState(null)
  // Revisão PENDENTE de um instantâneo (decisão 18): { snap, resultado, verCru }.
  // Enquanto ela existe, NADA foi aplicado — ela toma o corpo do modal inteiro,
  // de propósito: uma revisão que divide espaço com três listas é uma revisão
  // que se pula sem querer.
  const [revisaoPendente, setRevisaoPendente] = useState(null)

  // Versões de reunião (sugestão 24): excluir é a única ação daqui — a
  // comparação congelada × atual mora na aba Cenários da própria previsão.
  const excluirVersaoCongelada = (item) => {
    if (
      !window.confirm(
        `Excluir a versão congelada "${item.rotulo}" de "${item.nomeEvento}"? Isso não pode ser desfeito (o evento em si não muda).`
      )
    )
      return
    const r = excluirCongelada(item.id)
    if (!r.ok) {
      setErro('Não foi possível excluir essa versão congelada agora.')
      return
    }
    setErro(null)
    setCongeladas(r.lista)
  }

  // A transação inteira (tirar da lixeira + devolver à lista) mora no pai, que
  // tem o store — aqui só chega o resultado. Falhou, o motivo aparece na tela
  // em português e a lixeira continua como está: nunca um item consumido em
  // silêncio (achado S1-B).
  // A lixeira tinha a MESMA porta do instantâneo: um evento excluído antes da
  // trava de 22/07 voltava cru, com a conta errada. Agora ele volta corrigido —
  // e a tela conta o que foi corrigido, item a item (princípio 4).
  const contarCorrecoes = (r, oQueVoltou) => {
    if (!r?.revisao?.precisaRevisao) {
      setAviso(null)
      return
    }
    setAviso({
      titulo: `${oQueVoltou} foi salvo antes de uma correção do app — ${resumoRevisao(r.revisao)}.`,
      revisao: r.revisao,
    })
  }

  const restaurar = (item) => {
    const r = onRestaurarEvento(item.id)
    if (r?.lista) setLixeira(r.lista)
    if (!r?.ok) {
      setErro(r?.erro || 'Não foi possível restaurar esse evento agora.')
      return
    }
    setErro(null)
    contarCorrecoes(r, `“${item.nome || 'O evento restaurado'}”`)
  }

  // Saída do zumbi: a previsão volta à lista com identificador e nome novos,
  // ao lado da gêmea viva — sem colisão, sem sobrescrever nada. A transação
  // mora no pai, como a restauração normal.
  const restaurarCopia = (item) => {
    if (
      !window.confirm(
        `Restaurar “${item.nome}” como uma CÓPIA?\n\nO evento que já está na lista com este identificador não é tocado. A cópia entra com nome “${item.nome} (cópia da lixeira)” e sai da lixeira.`
      )
    )
      return
    const r = onRestaurarEventoComoCopia(item.id)
    if (r?.lista) setLixeira(r.lista)
    if (!r?.ok) {
      setErro(r?.erro || 'Não foi possível restaurar esse evento como cópia agora.')
      return
    }
    setErro(null)
    contarCorrecoes(r, `A cópia de “${item.nome || 'o evento'}”`)
  }

  const excluir = (item) => {
    if (!window.confirm(`Excluir de vez o evento "${item.nome}"? Isso não pode ser desfeito.`)) return
    const r = excluirDaLixeira(item.id)
    if (!r.ok) {
      setErro('Não foi possível excluir da lixeira agora.')
      return
    }
    setErro(null)
    setLixeira(r.lista)
  }

  const esvaziar = () => {
    if (lixeira.length === 0) return
    if (!window.confirm(`Esvaziar a lixeira? Os ${lixeira.length} evento(s) guardados serão apagados de vez e não poderão ser recuperados.`)) return
    const r = esvaziarLixeira()
    if (!r.ok) {
      setErro('Não foi possível esvaziar a lixeira agora.')
      return
    }
    setErro(null)
    setLixeira(r.lista)
  }

  const restaurarVersao = (snap) => {
    if (
      !window.confirm(
        `Restaurar a versão de ${quando(snap.criadoEm)}? Ela vai substituir todos os eventos e benchmarks atuais. O estado de agora será guardado automaticamente como cópia de segurança, caso você queira voltar.`
      )
    )
      return
    let r = restaurarSnapshot(snap.id, store)
    // Política única do princípio 7 (§9.11.3): sem a cópia de segurança, só
    // com um SIM explícito — o segundo confirm diz o risco com todas as
    // letras (é também o caminho do modo-socorro, quando o armazenamento
    // cheio é justamente o problema).
    if (!r.ok && r.semSeguranca) {
      if (
        !window.confirm(
          'Não deu para guardar a cópia de segurança do estado ATUAL (armazenamento do navegador cheio).\n\nRestaurar MESMO ASSIM, sem esse caminho de volta automático? Se puder, exporte um backup JSON antes.'
        )
      ) {
        setErro('Nada foi restaurado — o estado atual continua como estava.')
        return
      }
      r = restaurarSnapshot(snap.id, store, { forcarSemSeguranca: true })
    }
    if (!r.ok) {
      setErro(r.erro ? `Não foi possível restaurar essa versão: ${r.erro}.` : 'Não foi possível restaurar essa versão.')
      return
    }
    setErro(null)
    if (!r.segurancaOk) {
      setErro(
        'Versão restaurada SEM a cópia de segurança do estado anterior (você confirmou). Ainda dá para voltar restaurando outra versão da lista.'
      )
    }
    setSnapshots(loadSnapshots())

    // CORRIGIR E MOSTRAR (decisão 18 do Marco, 25/07/2026). O instantâneo já
    // veio corrigido de protecao.js; o que falta é a metade "mostrar". Versão
    // que não precisa de correção nenhuma segue direto — restaurar continua
    // sendo um clique só no caso normal, e o risco aceito (a tela no meio) só
    // é cobrado quando há de fato um número errado para explicar.
    if (r.revisao?.precisaRevisao) {
      setRevisaoPendente({ snap, resultado: r, verCru: false })
      return
    }
    aplicarRestauracao(r)
  }

  // A gravação do store restaurado, num lugar só — o botão da revisão e o
  // caminho direto entram exatamente pela mesma porta.
  const aplicarRestauracao = (r) => {
    setRevisaoPendente(null)
    // Este é o caminho de volta da falha de LEITURA (storage.js): se a gravação
    // estava travada porque o store não abria, aqui o Marco está substituindo o
    // store inteiro de propósito — que é exatamente a hora em que voltar a
    // gravar é o certo. Liberar ANTES do setStore para o auto-save do App já
    // pegar a trava aberta e persistir a versão restaurada.
    liberarGravacao()
    // `r.store` é o CORRIGIDO (protecao.js). O cru vive em `r.storeCru` e nunca
    // entra no app: gravá-lo faria a próxima abertura corrigi-lo sozinha e o
    // número mudaria na frente do Marco — o defeito que esta sessão veio tirar.
    onRestaurarStore(r.store)
  }

  // Revisão pendente: ela é o corpo INTEIRO do modal, não uma faixa acima das
  // listas. Uma tela que decide se uma festa acontece não pode ser rolada por
  // engano. Fechar o modal (Esc / clicar fora) cancela — a cópia de segurança
  // já foi tirada e nada do instantâneo foi aplicado.
  if (revisaoPendente) {
    return (
      <Modal title="Restaurar uma versão — revisão" onClose={onClose} wide>
        <RevisaoRestauracao
          revisao={revisaoPendente.resultado.revisao}
          quando={quando(revisaoPendente.snap.criadoEm)}
          verCru={revisaoPendente.verCru}
          onVerCru={(v) => setRevisaoPendente((p) => (p ? { ...p, verCru: v } : p))}
          onAplicar={() => aplicarRestauracao(revisaoPendente.resultado)}
          onCancelar={() => {
            setRevisaoPendente(null)
            setErro('Nada foi restaurado — o estado atual continua como estava.')
          }}
        />
      </Modal>
    )
  }

  return (
    <Modal title="Proteção de dados" onClose={onClose} wide>
      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — achado extra (fora da lista
          conhecida) no mesmo grep; bg-red-50/text-red-700 fixos somem no escuro. */}
      {erro && (
        <div className="mb-4 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-sm text-[var(--vermelho-texto)]">
          {erro}
        </div>
      )}

      {/* A restauração da LIXEIRA já aconteceu quando esta faixa aparece: ela
          conta o que foi corrigido, não pede permissão. O evento voltou com a
          conta certa — o que não pode é isso acontecer calado. */}
      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--borda-2)] px-3 py-2">
          <div className="text-sm text-[var(--ambar-texto)]">{aviso.titulo}</div>
          <ul className="mt-1 space-y-0.5">
            {aviso.revisao.correcoes.map((c, i) => (
              <li key={`${c.campo}-${i}`} className="text-xs text-[var(--tinta-2)]">
                {c.oQueMudou} → {c.para} — {c.explicacao}
              </li>
            ))}
          </ul>
          {/* O efeito em R$ com o MESMO componente da revisão do instantâneo:
              dizer "os números mudaram" sem dizer de quanto para quanto é meio
              aviso — e meio aviso, num app de dinheiro, é o mesmo silêncio. */}
          <ListaDeEfeitos efeitos={aviso.revisao.efeitos} titulo="O efeito nos números" />
          <div className="mt-2">
            <Btn variant="ghost" onClick={() => setAviso(null)}>
              Entendi
            </Btn>
          </div>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--tinta-2)]">
            Lixeira {lixeira.length > 0 && <span className="text-[var(--tinta-3)]">({lixeira.length})</span>}
          </h3>
          {lixeira.length > 0 && (
            <Btn variant="ghost" onClick={esvaziar}>
              Esvaziar lixeira
            </Btn>
          )}
        </div>
        <p className="mb-3 text-xs text-[var(--tinta-2)]">
          Eventos excluídos ficam aqui e podem ser restaurados. A lixeira guarda as últimas{' '}
          {50} exclusões — para segurança de longo prazo, exporte um backup JSON.
        </p>
        {lixeira.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
            A lixeira está vazia.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
            {lixeira.map((item) => {
              // O item diz a verdade sobre o próprio estado. Zumbi (gêmea viva
              // no store) não mostra um "Restaurar" que vai falhar sempre —
              // mostra o motivo e o caminho que FUNCIONA.
              const est = estadoItemLixeira(item, store)
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--tinta)]">{item.nome || 'Sem nome'}</div>
                    <div className="text-xs text-[var(--tinta-3)]">excluído em {quando(item.excluidoEm)}</div>
                    {!est.restauravel && (
                      <div className="mt-1 text-xs text-[var(--ambar-texto)]">{est.motivo}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {est.restauravel ? (
                      <Btn onClick={() => restaurar(item)}>
                        Restaurar
                      </Btn>
                    ) : (
                      <Btn onClick={() => restaurarCopia(item)}>
                        Restaurar como cópia
                      </Btn>
                    )}
                    <Btn variant="danger" onClick={() => excluir(item)}>
                      Excluir de vez
                    </Btn>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 border-t border-[var(--borda)] pt-5">
        <h3 className="mb-2 text-sm font-semibold text-[var(--tinta-2)]">
          Versões automáticas{' '}
          {snapshots.length > 0 && <span className="text-[var(--tinta-3)]">({snapshots.length})</span>}
        </h3>
        <p className="mb-3 text-xs text-[var(--tinta-2)]">
          O app guarda uma cópia dos seus dados por dia de uso (as últimas 15). Restaurar uma
          versão substitui tudo pelo estado daquele dia — o estado atual é guardado antes, para
          você poder voltar.
        </p>
        {snapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
            Ainda não há versões guardadas. A primeira é criada automaticamente ao abrir o app com
            algum evento salvo.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
            {snapshots.map((snap) => (
              <li key={snap.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--tinta)]">
                    {quando(snap.criadoEm)}
                    {snap.tipo === 'seguranca' && (
                      <span className="ml-2 text-xs font-normal text-[var(--ambar-texto)]">
                        {snap.rotulo || 'segurança'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--tinta-3)]">{resumoStore(snap.store)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn onClick={() => restaurarVersao(snap)}>Restaurar</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border-t border-[var(--borda)] pt-5">
        <h3 className="mb-2 text-sm font-semibold text-[var(--tinta-2)]">
          Versões de reunião (congeladas){' '}
          {congeladas.length > 0 && <span className="text-[var(--tinta-3)]">({congeladas.length})</span>}
        </h3>
        <p className="mb-3 text-xs text-[var(--tinta-2)]">
          Versões que você congelou com nome pelo botão “Congelar esta versão” (aba Cenários
          &amp; Resultado). Elas não somem sozinhas — ficam até você excluir. A comparação
          congelada × atual aparece no próprio evento.
        </p>
        {congeladas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-6 text-center text-sm text-[var(--tinta-3)]">
            Nenhuma versão congelada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
            {congeladas.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--tinta)]">
                    {item.nomeEvento}
                    <span className="ml-2 text-xs font-normal text-[var(--tinta-2)]">{item.rotulo}</span>
                  </div>
                  <div className="text-xs text-[var(--tinta-3)]">congelada em {quando(item.criadoEm)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn variant="danger" onClick={() => excluirVersaoCongelada(item)}>
                    Excluir de vez
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  )
}
