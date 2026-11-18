import { useMemo, useState } from 'react'
import { Btn, Modal, Select } from './ui.jsx'
import { AppIcon, TriangleAlert } from './AppIcon.jsx'
import { benchmarksVisiveis, temSemReserva, ETIQUETA_SEM_RESERVA } from '../lib/benchmarks.js'
import {
  propostasCarregar,
  aplicarCarregar,
  desfazerCarregar,
  rotuloCarregar,
} from '../lib/carregarBenchmark.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { benchmarkQuebrado } from '../lib/dadoQuebrado.js'
import { showToast } from '../lib/toast.js'
import { fmtCompact } from '../lib/format.js'
import { clone, agora, uid } from '../lib/util.js'

// Modal de "carregar de benchmark" (Sessão F2-U — sugestão 33). Serve os dois
// gestos: planilha inteira (bm nulo → escolhe no seletor) e por categoria
// (bm + soCategoria fixos). Princípio 9: revisão item a item ANTES (checkbox),
// só preenche vazio por padrão (categoria com itens pede somar/substituir),
// snapshot de segurança antes de aplicar e desfazer visível (toast). Embutido
// imutável: só LÊ custos.
export default function CarregarBenchmarkModal({ evento, update, store, bm, soCategoria, onClose }) {
  // Candidatos ao seletor (modo planilha inteira): benchmarks visíveis que têm
  // ao menos um total de categoria — nada de opção que não carrega nada.
  const candidatos = useMemo(
    () =>
      benchmarksVisiveis(store).filter((b) =>
        Object.values(b.custos || {}).some((v) => v != null)
      ),
    [store]
  )
  const bmFixo = bm || null
  const [bmId, setBmId] = useState(bmFixo?.id || candidatos[0]?.id || '')
  const bmAtual = bmFixo || candidatos.find((b) => b.id === bmId) || null

  const propostas = useMemo(
    () => (bmAtual ? propostasCarregar(evento, bmAtual, soCategoria || null) : []),
    [evento, bmAtual, soCategoria]
  )

  // escolhas por categoria: default seguro — só a categoria VAZIA já vem
  // marcada (modo somar); categoria que já tem itens vem desmarcada e, ao
  // marcar, escolhe somar/substituir (a "pergunta" da sugestão).
  const escolhasIniciais = useMemo(() => {
    const m = {}
    for (const p of propostas) m[p.catId] = { incluir: !p.jaTemItens, modo: 'somar' }
    return m
  }, [propostas])
  const [escolhas, setEscolhas] = useState(escolhasIniciais)
  // quando troca o benchmark selecionado, recomeça as escolhas do zero
  const [ultimoBm, setUltimoBm] = useState(bmAtual?.id)
  if (bmAtual?.id !== ultimoBm) {
    setUltimoBm(bmAtual?.id)
    setEscolhas(escolhasIniciais)
  }

  const setEsc = (catId, patch) =>
    setEscolhas((e) => ({ ...e, [catId]: { ...(e[catId] || { modo: 'somar' }), ...patch } }))

  const selecionadas = propostas.filter((p) => escolhas[p.catId]?.incluir)
  const n = selecionadas.length
  const catUnica = soCategoria ? propostas[0]?.catNome : null

  const [erro, setErro] = useState('')

  const aplicar = () => {
    if (n === 0 || !bmAtual) return
    // Evento fechado: sem este portão, a trava do funil bloqueava a gravação
    // e o toast "— pronto" (com um Desfazer que também seria bloqueado) saía
    // mesmo assim — dois avisos contraditórios na mesma ação (achado
    // adversarial 20/07/2026). Nada de snapshot nem toast: só a verdade.
    //
    // QUEM SEGURA HOJE, e por que este cinto continua aqui (achado S3 do
    // BACKLOG, 27/07/2026): pela TELA quem barra é o `<fieldset disabled>` do
    // EventEditor.jsx, que embrulha o CostsTab inteiro — com o evento fechado
    // o botão "Usar um benchmark como base" já nasce desabilitado e este modal
    // nem abre. Este portão é redundância deliberada de segundo nível, para
    // quem chamar o modal por outro caminho amanhã. Os dois estão travados por
    // teste em CarregarBenchmarkModal.test.jsx — o fieldset (a trava viva) e
    // esta recusa (o cinto), cada um com o seu.
    if (evento?.status === 'fechado') {
      setErro(
        'Este evento está fechado — os números do fechamento estão congelados e NADA foi carregado. Reabra na aba Fechamento para usar um benchmark como base.'
      )
      return
    }
    // REFERÊNCIA QUEBRADA (revisão adversarial do PR #98, 05/10/2026). Sem
    // isto, `aplicarCarregar` copiava o 1e308 da referência para um custo da
    // festa SÃ — o contágio que a decisão do Marco de 26/07/2026 mandou
    // parar, entrando por uma porta que a faixa da comparação não vigiava.
    // Recusa a referência inteira, com a régua da faixa (`benchmarkQuebrado`),
    // e diz onde consertar. Nada é gravado, nem snapshot.
    const quebrada = benchmarkQuebrado(bmAtual)
    if (quebrada.ha) {
      setErro(
        `A referência “${quebrada.nome}” tem valores que o app não consegue calcular — NADA foi carregado. Corrija ou apague essa referência na tela inicial, em “Eventos antigos de referência (benchmarks)” › Editar.`
      )
      return
    }
    // Snapshot de segurança ANTES (princípio 9). Sem snapshot não há caminho
    // de volta — então sem snapshot, nada é aplicado.
    const seg = snapshotSeguranca(store, agora(), `antes de carregar ${bmAtual.nome}`)
    if (!seg.ok) {
      setErro(
        'Não deu para guardar a cópia de segurança antes de carregar (armazenamento do navegador cheio) — NADA foi alterado. Exporte um backup JSON ou libere espaço em “Proteção de dados” e tente de novo.'
      )
      return
    }
    // Estado do evento ANTES — hoje serve só para o "Desfazer" devolver os
    // itens que o modo "substituir" trocou (ver desfazerCarregar). Até
    // 27/07/2026 esta foto era o desfazer INTEIRO: `update(() => eventoAntes)`
    // rebobinava o evento todo, e o que o Marco digitasse nos 6 segundos de
    // vida do toast — um custo, um lote, um patrocínio — ia junto, sem aviso.
    const eventoAntes = clone(evento)
    // O id de cada item criado nasce AQUI, fora do updater: o updater do App
    // roda 2× no StrictMode e tem de ser puro, então não dá para colher o id
    // lá dentro — e é ele que deixa o Desfazer tirar exatamente a linha que
    // este gesto criou, sem encostar no resto.
    const carregamentoId = uid()
    const escolhasAplicar = selecionadas.map((p) => ({
      catId: p.catId,
      modo: escolhas[p.catId].modo,
      itemId: uid(),
    }))
    // Descritor EXPLÍCITO (achado S2-D): esta é uma ação do princípio 7 — ela
    // SUBSTITUI custos do Marco. Sem nome próprio, o botão ↶ caía no rótulo do
    // foco: no melhor caso o genérico "a última alteração", no pior o nome do
    // campo de texto que estivesse em foco (Safari e Firefox no macOS não
    // focam <button> ao clicar). O botão mentindo justamente na ação mais
    // perigosa é o que não pode.
    const rotuloAcao = rotuloCarregar(bmAtual.nome, n, catUnica)
    const aplicado = update((e) => aplicarCarregar(e, bmAtual, escolhasAplicar), {
      rotulo: rotuloAcao.toLowerCase(), carregamentoId,
      carregamento: { eventoAntes, escolhas: escolhasAplicar },
    })
    if (aplicado?.ok === false) return
    let acionado = false
    showToast(`${rotuloAcao} — pronto`, {
      acaoLabel: 'Desfazer',
      onAcao: () => {
        if (acionado) return
        const resposta = update(
          (e, contexto) => desfazerCarregar(
            e, contexto?.carregamento.eventoAntes || eventoAntes, escolhasAplicar,
            contexto?.categoriasSubstituidasDepois
          ),
          { rotulo: `desfazer ${rotuloAcao.toLowerCase()}`, desfazerCarregamentoId: carregamentoId }
        )
        if (resposta?.ok !== false) acionado = true
        return resposta
      },
    })
    onClose()
  }

  const titulo = soCategoria
    ? `Usar ${bmFixo?.nome || 'benchmark'} como base em ${catUnica || 'uma categoria'}`
    : 'Usar um benchmark como base'

  return (
    <Modal title={titulo} onClose={onClose} wide={!soCategoria}>
      <div className="space-y-4">
        {/* O que este texto conserta (achado S4 do BACKLOG, 27/07/2026): o
            Marco importou uma planilha com 81 linhas, clicou aqui esperando as
            81 e veio UMA linha por categoria com o nome da festa. Não é
            defeito — um benchmark guarda sete números, um por categoria — mas
            até aqui só o gesto POR CATEGORIA avisava (title do chip no
            CostsTab). Agora o modal diz a forma do dado E o caminho de quem
            quer as linhas. */}
        <p className="text-xs text-[var(--tinta-3)]">
          Um benchmark é o <strong>resumo</strong> de uma festa passada: um total por categoria, não
          a lista de custos dela.{' '}
          {soCategoria ? (
            <>
              Por isso este gesto traz <strong>uma linha só</strong> — o total de{' '}
              {catUnica || 'uma categoria'} naquela festa —, como ponto de partida editável: você
              refina depois.
            </>
          ) : (
            <>
              Por isso este gesto traz <strong>uma linha por categoria</strong> (A&amp;B, Locação,
              Equipe…) com o total daquela festa, como ponto de partida editável: você refina
              depois.
            </>
          )}
        </p>
        {/* O caminho alternativo vira NOTA, não mais um parágrafo de corpo: quem
            já sabe o que quer pula com o olho, e quem esperava as 81 linhas
            encontra a saída sem ler o resto.

            CADA AFIRMAÇÃO DESTA NOTA FOI LIDA NO CÓDIGO (27/07/2026). A versão
            anterior dizia "ele copia a festa inteira, com todos os itens de
            custo, já sem os valores realizados" — e prometia MAIS do que o app
            entrega: "a festa inteira" é o botão do LADO ("Duplicar" →
            duplicarCopia); a Nova edição nasce limpa de propósito. O que
            duplicarNovaEdicao (src/lib/novaEdicao.js) faz de fato:
              · mapeia TODAS as categorias com TODOS os itens  → "todas as
                categorias e todos os itens de custo";
              · `realizado: ''` em cada item                    → "realizado em
                branco";
              · `status: STATUS_CUSTO_PADRAO`, que em
                src/lib/statusCusto.js vale 'ESTIMADO'          → "status de
                volta a ESTIMADO" (ATENÇÃO: o tooltip e o confirm da Home.jsx,
                e o cabeçalho do próprio novaEdicao.js, dizem "ORÇAR" — que NÃO
                está na lista canônica STATUS_CUSTO. É texto velho DE LÁ, fora
                do escopo desta correção e reportado à parte; não é para copiar
                para cá);
              · `data: ''`                                      → "a data nasce
                vazia";
              · Home.jsx chama window.confirm ANTES, perguntando se os
                realizados da edição passada viram o novo estimado → "pergunta
                antes…".
            Nada além disso é afirmado — em especial nada sobre bar, ticket ou
            receita, que é justamente onde novaEdicao.js está mudando. */}
        <p className="rounded-lg border border-[var(--borda)] bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-3)]">
          Quer as linhas de custo uma a uma? Elas não estão no benchmark. Se a festa passada ainda
          estiver salva como evento, o caminho é o botão <strong>“Nova edição”</strong> no card dela,
          na tela inicial (aparece ao passar o mouse pelo card): ele cria uma edição nova com todas
          as categorias e todos os itens de custo, cada item com o realizado em branco e o status de
          volta a ESTIMADO. Não é uma cópia idêntica: a data nasce vazia, e o app pergunta antes se
          os valores realizados da edição passada devem servir de estimativa na nova.
        </p>
        <p className="text-xs text-[var(--tinta-3)]">
          Só preenche categorias vazias por padrão; onde já há itens, escolha somar ou substituir.
          Antes de aplicar, uma cópia de segurança é guardada em “Proteção de dados”, e o “Desfazer”
          da barrinha tira exatamente as linhas que este gesto criou — o que você digitar depois
          fica. Os benchmarks não mudam — só são lidos.
        </p>

        {!soCategoria && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--tinta-2)]">Benchmark:</span>
            {candidatos.length > 0 ? (
              <Select
                value={bmId}
                onChange={(e) => setBmId(e.target.value)}
                options={candidatos.map((b) => ({
                  value: b.id,
                  label: `${b.nome}${b.custom ? ' (importado)' : ''}${
                    temSemReserva(b) ? ` — ${ETIQUETA_SEM_RESERVA}` : ''
                  }`,
                }))}
                className="min-w-56"
              />
            ) : (
              <span className="text-sm text-[var(--tinta-3)]">nenhum benchmark com custos para carregar</span>
            )}
          </div>
        )}

        {bmAtual && propostas.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--borda)] bg-[var(--papel-2)] text-left text-xs text-[var(--tinta-2)]">
                  <th className="w-10 py-2 pl-3 font-medium" aria-label="Incluir" />
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="w-32 py-2 pr-3 text-right font-medium">Total a lançar</th>
                  <th className="w-48 py-2 pr-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => {
                  const esc = escolhas[p.catId] || { incluir: false, modo: 'somar' }
                  return (
                    <tr key={p.catId} className="border-b border-[var(--borda)] last:border-0">
                      <td className="py-2 pl-3">
                        <input
                          type="checkbox"
                          checked={!!esc.incluir}
                          onChange={(e) => setEsc(p.catId, { incluir: e.target.checked })}
                          className="cursor-pointer accent-[var(--acento)]"
                          aria-label={`Incluir ${p.catNome}`}
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium text-[var(--tinta)]">{p.catNome}</td>
                      <td className="py-2 pr-3 text-right tnum text-[var(--tinta)]">{fmtCompact(p.valor)}</td>
                      <td className="py-2 pr-3">
                        {!p.jaTemItens ? (
                          <span className="text-xs text-[var(--tinta-3)]">
                            {p.existe ? 'vazia — será preenchida' : 'categoria recriada'}
                          </span>
                        ) : esc.incluir ? (
                          <Select
                            value={esc.modo}
                            onChange={(e) => setEsc(p.catId, { modo: e.target.value })}
                            options={[
                              { value: 'somar', label: `somar ao(s) ${p.qtdItens} atual(is)` },
                              { value: 'substituir', label: `substituir o(s) ${p.qtdItens}` },
                            ]}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--ambar-texto)]">
                            <AppIcon icon={TriangleAlert} size={13} /> já tem {p.qtdItens} item(ns)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          bmAtual && (
            <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-4 text-center text-sm text-[var(--tinta-3)]">
              {soCategoria
                ? 'Este benchmark não tem valor para esta categoria.'
                : 'Este benchmark não tem custos por categoria para carregar.'}
            </p>
          )
        )}

        {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
            fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
        {erro && <p className="rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-sm text-[var(--vermelho-texto)]">{erro}</p>}

        <div className="flex items-center justify-end gap-2">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={aplicar} disabled={n === 0}>
            {rotuloCarregar(bmAtual?.nome || 'benchmark', n, catUnica)}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
