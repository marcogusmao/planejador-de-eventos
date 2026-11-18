// Reconciliação do export v2 (camada 2) — o coração do contrato. A produtora
// edita a planilha exportada (muda valor, insere linha, apaga linha, troca
// status) e reimporta; aqui a gente CASA cada linha com o item do evento e monta
// o PLANO de mudanças pra revisão. Princípio 7: revisão item a item, snapshot
// antes de aplicar, desfazer visível (a UI cuida disso; aqui é a lógica pura).
//
// LÊ com SheetJS (o import segue no SheetJS; o writer é quem usa exceljs). Módulo
// PURO: recebe o AOA já lido e o evento-alvo, devolve dados. Sem React, sem
// exceljs, sem tocar o store.
//
// Identidade em DUAS camadas (Marco): (1) id_item na coluna A oculta; (2) col A
// sumiu / linha nova → auto-matcher por seção+serviço+fornecedor com estimado de
// desempate. Ambíguo NUNCA aplica sozinho — vai pra revisão.
import { num } from './util.js'
import { normalizar, parseMoney } from './xlsxImport.js'
import { statusCustoValido, STATUS_CUSTO_PADRAO } from './statusCusto.js'
import { novoItem } from './defaults.js'
import { FAIXA_CUSTO, avisoDaFaixa } from './campoNumerico.js'
import {
  SENTINELA_V2,
  COL_V2,
  CABECALHO_COLUNAS,
  ROTULO_TOTAIS,
  ROTULO_PROJETO,
  FIM_DAS_SECOES,
} from './orcamentoV2Contrato.js'

const cel = (aoa, r, c) => (aoa[r] && aoa[r][c] != null ? aoa[r][c] : '')
const txt = (v) => String(v ?? '').trim()

/** É uma planilha do export v2? (A1 = sentinela.) O que não for segue pro v1 —
 *  o roteamento mantém o importador antigo INTACTO. */
export function ehOrcamentoV2(aoa) {
  return txt(cel(aoa, 0, COL_V2.id)) === SENTINELA_V2
}

/** Lê o AOA (SheetJS header:1) e extrai estrutura: sentinela, id do evento-alvo
 *  (A2), nome do projeto (cabeçalho) e as seções com seus itens. Não reconcilia
 *  — não precisa do evento. */
export function parseOrcamentoV2(aoa) {
  const sentinela = txt(cel(aoa, 0, COL_V2.id))
  const eventoId = txt(cel(aoa, 1, COL_V2.id)) // A2
  const fim = FIM_DAS_SECOES.map(normalizar)

  let projeto = ''
  for (let r = 1; r < Math.min(aoa.length, 8); r++) {
    if (normalizar(cel(aoa, r, COL_V2.servico)) === normalizar(ROTULO_PROJETO)) {
      projeto = txt(cel(aoa, r, COL_V2.fornecedor)) // valor em D (mesclado D:E)
      break
    }
  }

  const secoes = []
  for (let r = 0; r < aoa.length; r++) {
    const c = normalizar(cel(aoa, r, COL_V2.servico))
    if (fim.includes(c)) break // TOTAL GERAL / RESUMO / COMO USAR — acabaram as seções
    if (c !== normalizar(CABECALHO_COLUNAS)) continue
    // Cabeçalho de colunas achado: o título é a linha de cima; itens até TOTAIS.
    const titulo = txt(cel(aoa, r - 1, COL_V2.servico))
    const itens = []
    let rr = r + 1
    for (; rr < aoa.length; rr++) {
      const servico = txt(cel(aoa, rr, COL_V2.servico))
      const nsvc = normalizar(servico)
      if (nsvc === normalizar(ROTULO_TOTAIS) || fim.includes(nsvc)) break // fim da seção
      if (!servico) continue // linha em branco (corpo de seção vazia)
      itens.push({
        id: txt(cel(aoa, rr, COL_V2.id)),
        servico,
        fornecedor: txt(cel(aoa, rr, COL_V2.fornecedor)),
        estimado: cel(aoa, rr, COL_V2.estimado),
        status: txt(cel(aoa, rr, COL_V2.status)),
        dataPgto: txt(cel(aoa, rr, COL_V2.dataPgto)),
        pagamento: txt(cel(aoa, rr, COL_V2.pagamento)),
        obs: txt(cel(aoa, rr, COL_V2.obs)),
        linha: rr + 1, // 1-indexado pra mensagens ao usuário
      })
    }
    secoes.push({ titulo, itens })
    r = rr // pula pro TOTAIS; o for++ segue na linha de baixo
  }
  return { sentinela, eventoId, projeto, secoes }
}

// Só os campos que o app LÊ de volta (realizado/responsável são da produtora,
// o app não os altera nem os lê — ver COMO USAR na planilha).
function diffCampos(item, linha) {
  const campos = {}
  const difTexto = (a, b) => txt(a) !== txt(b)
  if (difTexto(item.servico, linha.servico)) campos.servico = { de: item.servico ?? '', para: linha.servico }
  if (difTexto(item.fornecedor, linha.fornecedor)) campos.fornecedor = { de: item.fornecedor ?? '', para: linha.fornecedor }
  const estAntes = num(item.estimado)
  const estDepois = parseMoney(linha.estimado)
  if (estAntes !== estDepois) campos.estimado = { de: item.estimado ?? '', para: estDepois }
  // Status só entra se VÁLIDO: o dropdown restringe; paste inválido não
  // sobrescreve com lixo — fica o que estava (e a revisão não mostra mudança).
  if (statusCustoValido(linha.status) && linha.status !== item.status)
    campos.status = { de: item.status ?? '', para: linha.status }
  if (difTexto(item.dataPgto, linha.dataPgto)) campos.dataPgto = { de: item.dataPgto ?? '', para: linha.dataPgto }
  if (difTexto(item.pagamento, linha.pagamento)) campos.pagamento = { de: item.pagamento ?? '', para: linha.pagamento }
  if (difTexto(item.obs, linha.obs)) campos.obs = { de: item.obs ?? '', para: linha.obs }
  return campos
}

function dadosItemNovo(linha) {
  return {
    servico: linha.servico,
    fornecedor: linha.fornecedor,
    estimado: parseMoney(linha.estimado),
    status: statusCustoValido(linha.status) ? linha.status : STATUS_CUSTO_PADRAO,
    dataPgto: linha.dataPgto,
    pagamento: linha.pagamento,
    obs: linha.obs,
  }
}

/** Reconcilia a planilha PARSEADA contra o evento-alvo. Devolve o PLANO: alvo,
 *  aviso de projeto divergente (planilha-copiada), e as 4 operações do ciclo
 *  SEPARADAS — atualizações, adições, REMOÇÕES (seção própria), ambíguos/dup. */
export function reconciliar(parsed, evento) {
  const plano = {
    sentinelaOk: parsed.sentinela === SENTINELA_V2,
    eventoId: parsed.eventoId,
    projetoPlanilha: parsed.projeto,
    alvo: evento || null,
    alvoDesconhecido: !evento,
    avisoProjeto: null,
    atualizacoes: [],
    adicoes: [],
    remocoes: [],
    ambiguos: [],
    dupIds: [],
    avisosStatus: [], // status inválido colado → o motor mantém, mas AVISA (Princípio 4)
    recusadas: [], // estimado negativo ou ilegível → linha recusada, original e motivo
  }
  if (!evento) return plano // alvo desconhecido — a UI oferece escolher/criar (Marco #2)

  // Aviso de planilha-copiada (Marco #1): o PROJETO escrito × o tipo do alvo. O
  // writer carimba PROJETO = evento.tipo ("Brisa"), então a comparação é contra
  // o TIPO — o nome tem a data e divergiria sempre. O id do evento (A2) já é a
  // âncora primária do alvo; isto é a rede pra planilha copiada de outra festa.
  const tipoAlvo = txt(evento.tipo) || txt(evento.nome)
  if (parsed.projeto && tipoAlvo && normalizar(parsed.projeto) !== normalizar(tipoAlvo))
    plano.avisoProjeto = `A planilha diz "${parsed.projeto}", mas o alvo é "${tipoAlvo}".`

  // Índice dos itens do evento (por id e por categoria).
  const itensEvento = []
  for (const cat of evento.categorias || [])
    for (const it of cat.itens || []) itensEvento.push({ item: it, categoria: cat })
  const porId = new Map(itensEvento.filter((x) => x.item.id).map((x) => [x.item.id, x]))

  // Ids duplicados DENTRO da planilha (S2 espelhado): nomeia e manda pra revisão.
  const idsPlan = parsed.secoes.flatMap((s) => s.itens.map((i) => i.id).filter(Boolean))
  const vistos = new Set()
  const dup = new Set()
  for (const id of idsPlan) {
    if (vistos.has(id)) dup.add(id)
    vistos.add(id)
  }
  plano.dupIds = [...dup]

  const casados = new Set() // ids de itens do EVENTO já casados (nunca casar 2×)
  // Itens protegidos da REMOÇÃO por uma linha RECUSADA sem id (lente
  // adversarial 22/07): conjunto PRÓPRIO, e não `casados`, para os candidatos
  // continuarem livres para casar com outra linha legítima da planilha.
  const protegidosRecusa = new Set()

  for (const secao of parsed.secoes) {
    const categoria =
      (evento.categorias || []).find((c) => normalizar(c.nome) === normalizar(secao.titulo)) || null
    for (const linha of secao.itens) {
      // Estimado ilegível ou negativo (Marco, 22/07/2026 e 05/09/2026): linha
      // RECUSADA, nunca aplicada — crédito/desconto entra reduzindo o valor do
      // item, não como negativo. Se a linha casa por id com um item do evento,
      // ele fica PROTEGIDO da remoção (a produtora não apagou a linha, só pôs um
      // valor inválido — corrige e reimporta). Motivo em português na revisão,
      // nunca stack trace (Princípio 7). `(500)` continua sendo −500 no parser;
      // a recusa é aqui, na camada onde o negativo não faz sentido.
      const estimado = parseMoney(linha.estimado)
      if (estimado === null || avisoDaFaixa(estimado, FAIXA_CUSTO)) {
        const casado = linha.id ? porId.get(linha.id) : null
        if (casado) protegidosRecusa.add(casado.item.id)
        // Sem id (planilha copiada): o item que ELA casaria por nome+fornecedor
        // fica protegido da remoção — a produtora não apagou a linha, só pôs
        // valor inválido. Sem isto, o item caía em "Remoções — a produtora
        // apagou estas linhas", que aqui seria mentira (lente adversarial
        // 22/07: pré-B o item era mantido; a recusa não pode piorar isso).
        else if (categoria)
          for (const x of itensEvento)
            if (
              x.categoria === categoria &&
              normalizar(x.item.servico || '') === normalizar(linha.servico) &&
              normalizar(x.item.fornecedor || '') === normalizar(linha.fornecedor)
            )
              protegidosRecusa.add(x.item.id)
        plano.recusadas.push({
          linha: linha.linha,
          servico: linha.servico,
          valor: estimado,
          original: linha.estimado,
          motivo: estimado === null
            ? 'Valor não reconhecido — informe só o número, sem anotações.'
            : avisoDaFaixa(estimado, FAIXA_CUSTO),
        })
        continue
      }
      if (linha.id && dup.has(linha.id)) {
        // candidato = o item do evento com esse id (se existir): assim a trava de
        // aplicarReconciliacao PROTEGE-o da exclusão enquanto o dup não é resolvido.
        plano.ambiguos.push({ linha, motivo: `id repetido na planilha (${linha.id})`, candidatos: porId.has(linha.id) ? [linha.id] : [], categoriaId: categoria?.id ?? null })
        continue
      }
      // Camada 1: id_item.
      let alvo = linha.id ? porId.get(linha.id) || null : null
      // Camada 2: auto-matcher (col A sumiu / id de outra planilha).
      if (!alvo && categoria) {
        const cands = itensEvento.filter(
          (x) =>
            x.categoria === categoria &&
            !casados.has(x.item.id) &&
            normalizar(x.item.servico || '') === normalizar(linha.servico) &&
            normalizar(x.item.fornecedor || '') === normalizar(linha.fornecedor)
        )
        if (cands.length === 1) alvo = cands[0]
        else if (cands.length > 1) {
          const est = parseMoney(linha.estimado)
          const exatos = cands.filter((x) => num(x.item.estimado) === est)
          if (exatos.length === 1) alvo = exatos[0]
          else {
            plano.ambiguos.push({ linha, motivo: 'vários itens parecidos na seção', candidatos: cands.map((x) => x.item.id), categoriaId: categoria?.id ?? null })
            continue
          }
        }
      }
      if (alvo) {
        casados.add(alvo.item.id)
        // Princípio 4: status inválido colado → o motor MANTÉM o que estava (a
        // regra do Marco), mas NUNCA calado — vira aviso na revisão.
        if (linha.status && !statusCustoValido(linha.status))
          plano.avisosStatus.push({ linha: linha.linha, servico: alvo.item.servico, statusInformado: linha.status, statusUsado: alvo.item.status, acao: 'mantido' })
        const campos = diffCampos(alvo.item, linha)
        if (Object.keys(campos).length)
          plano.atualizacoes.push({ id: alvo.item.id, categoriaId: alvo.categoria.id, servico: alvo.item.servico, campos })
      } else if (categoria) {
        // Item novo com status inválido → usa o padrão, também com aviso.
        if (linha.status && !statusCustoValido(linha.status))
          plano.avisosStatus.push({ linha: linha.linha, servico: linha.servico, statusInformado: linha.status, statusUsado: STATUS_CUSTO_PADRAO, acao: 'padrão' })
        plano.adicoes.push({ categoriaId: categoria.id, categoriaNome: categoria.nome, dados: dadosItemNovo(linha), linha: linha.linha })
      } else {
        plano.ambiguos.push({ linha, motivo: `seção "${secao.titulo}" não bate com nenhuma categoria do evento`, candidatos: [], categoriaId: null })
      }
    }
  }

  // Remoções (a única operação destrutiva): itens do evento que NENHUMA linha
  // casou — a produtora apagou a linha na planilha. Seção própria (Marco #3).
  for (const x of itensEvento)
    if (x.item.id && !casados.has(x.item.id) && !protegidosRecusa.has(x.item.id))
      plano.remocoes.push({ id: x.item.id, categoriaId: x.categoria.id, servico: x.item.servico, estimado: x.item.estimado })

  return plano
}

/** Aplica o plano num evento — IMUTÁVEL (devolve novo evento, não muta). `sel`
 *  restringe o que aplicar (revisão item a item); ausente = aplica tudo. */
export function aplicarReconciliacao(evento, plano, sel = {}) {
  const okAtu = (id) => !sel.atualizacoes || sel.atualizacoes.has(id)
  const okRem = (id) => !sel.remocoes || sel.remocoes.has(id)
  const okAdd = (i) => !sel.adicoes || sel.adicoes.has(i)

  // TRAVA NO MOTOR (Marco): ambiguidade não resolvida NUNCA termina em exclusão.
  // Todo id que é candidato de um ambíguo pendente fica PROTEGIDO da remoção —
  // mesmo que a seleção mande removê-lo. É invariante do motor, não ordem de UI
  // (ordem de UI não é invariante). Resolver o ambíguo na tela reescreve o plano
  // e tira o item da lista de candidatos; só então ele pode sair.
  const protegidos = new Set((plano.ambiguos || []).flatMap((a) => a.candidatos || []))
  const remover = new Set(
    plano.remocoes.filter((r) => okRem(r.id) && !protegidos.has(r.id)).map((r) => r.id)
  )
  const atualizar = new Map(plano.atualizacoes.filter((a) => okAtu(a.id)).map((a) => [a.id, a.campos]))

  const categorias = (evento.categorias || []).map((cat) => {
    let itens = (cat.itens || [])
      .filter((it) => !remover.has(it.id))
      .map((it) => {
        const campos = atualizar.get(it.id)
        if (!campos) return it
        const novo = { ...it }
        for (const [campo, alt] of Object.entries(campos)) novo[campo] = alt.para
        return novo
      })
    plano.adicoes.forEach((add, i) => {
      if (add.categoriaId === cat.id && okAdd(i)) itens = [...itens, novoItem({ ...add.dados })]
    })
    return { ...cat, itens }
  })
  return { ...evento, categorias }
}

/** Resolve os ambíguos com as escolhas da produtora ANTES de aplicar: 'casar'
 *  vira atualização (e tira o item da remoção), 'novo' vira adição, 'ignorar'
 *  mantém o ambíguo (o item segue protegido pela trava de exclusão). Devolve um
 *  NOVO plano; não muta. `resolucoes` é { [indiceDoAmbiguo]: {acao, itemId} }. */
export function aplicarResolucoes(plano, evento, resolucoes = {}) {
  const itensEvento = (evento.categorias || []).flatMap((c) => (c.itens || []).map((it) => ({ item: it, categoria: c })))
  const porId = new Map(itensEvento.filter((x) => x.item.id).map((x) => [x.item.id, x]))
  const atualizacoes = [...plano.atualizacoes]
  const adicoes = [...plano.adicoes]
  const casados = new Set()
  const ambiguosRestantes = []
  plano.ambiguos.forEach((amb, i) => {
    const res = resolucoes[i]
    const estimado = parseMoney(amb.linha.estimado)
    if (estimado === null || avisoDaFaixa(estimado, FAIXA_CUSTO)) {
      ambiguosRestantes.push(amb) // recusa também planos montados diretamente
      return
    }
    if (!res || res.acao === 'ignorar') {
      ambiguosRestantes.push(amb) // segue ambíguo → item protegido da exclusão
      return
    }
    if (res.acao === 'novo' && amb.categoriaId) {
      adicoes.push({ categoriaId: amb.categoriaId, dados: dadosItemNovo(amb.linha), linha: amb.linha.linha })
    } else if (res.acao === 'casar' && porId.has(res.itemId)) {
      casados.add(res.itemId)
      const alvo = porId.get(res.itemId)
      const campos = diffCampos(alvo.item, amb.linha)
      if (Object.keys(campos).length)
        atualizacoes.push({ id: res.itemId, categoriaId: alvo.categoria.id, servico: alvo.item.servico, campos })
    } else {
      ambiguosRestantes.push(amb) // escolha inválida → não inventa, segue ambíguo
    }
  })
  const remocoes = plano.remocoes.filter((r) => !casados.has(r.id)) // casado por resolução sai da remoção
  return { ...plano, atualizacoes, adicoes, remocoes, ambiguos: ambiguosRestantes }
}
