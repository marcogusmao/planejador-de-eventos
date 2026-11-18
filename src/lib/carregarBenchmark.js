// Carregar de benchmark (Sessão F2-U — sugestão 33): puxar um evento passado
// de referência como PONTO DE PARTIDA editável dos custos, não só comparação
// visual. Dois gestos, ambos no princípio 9 ("ação mora no objeto"):
//   (a) planilha inteira — botão junto dos chips carrega as categorias com os
//       valores da festa escolhida;
//   (b) por categoria — clicar numa referência da categoria puxa só aquela.
//
// IMPORTANTE sobre a forma dos benchmarks: um benchmark guarda o TOTAL de cada
// categoria (custos: { aeb, locacao, … }), não itens linha a linha. Então
// "carregar" cria UM item por categoria (o total daquela categoria), nomeado
// pela festa passada — um lançamento editável para o Marco refinar depois.
//
// Travas da sugestão (princípio 9), todas na UI (CarregarBenchmarkModal):
//   - revisão item a item ANTES (prévia com checkbox);
//   - só preenche categoria VAZIA por padrão; categoria que já tem itens pede
//     "somar" ou "substituir" (default: não mexe);
//   - snapshot de segurança antes de aplicar; desfazer visível (toast);
//   - rótulo diz o efeito ("Adicionar 6 itens da Marfim em A&B").
// Os benchmarks EMBUTIDOS são imutáveis: aqui só se LÊ custos, nunca se altera.
// ZERO fórmula nova — só pré-preenche campos de custo que já existem.

import { novoItem, CATEGORIAS_PADRAO } from './defaults.js'
import { num } from './util.js'

const nomePadraoCategoria = (catId) =>
  CATEGORIAS_PADRAO.find((c) => c.key === catId)?.nome || catId

/**
 * Propostas de carregamento de um benchmark num evento. Uma proposta por
 * categoria em que o benchmark tem valor (custos[catId] != null). Quando
 * `soCategoria` é dado, só aquela categoria. Cada proposta diz se a categoria
 * do evento já tem itens (para a UI oferecer somar/substituir e default
 * seguro "só preenche vazio").
 *
 * As categorias-alvo são as do EVENTO (ids batem com as chaves do benchmark
 * nas 7 categorias padrão). Categoria padrão do benchmark que não existe mais
 * no evento (foi removida) entra como proposta com `existe: false` — a
 * aplicação recria a categoria padrão para o valor não sumir calado.
 */
export function propostasCarregar(evento, bm, soCategoria = null) {
  const cats = evento?.categorias || []
  const porId = new Map(cats.map((c) => [c.id, c]))
  const propostas = []
  const chaves = CATEGORIAS_PADRAO.map((c) => c.key)
  for (const catId of chaves) {
    if (soCategoria && catId !== soCategoria) continue
    const valor = bm?.custos?.[catId]
    if (valor == null) continue
    const cat = porId.get(catId)
    const qtdItens = cat ? (cat.itens || []).length : 0
    propostas.push({
      catId,
      catNome: cat ? cat.nome : nomePadraoCategoria(catId),
      valor: num(valor),
      existe: !!cat,
      jaTemItens: qtdItens > 0,
      qtdItens,
    })
  }
  return propostas
}

// NOTA HISTÓRICA (27/07/2026) — mora AQUI FORA, e não dentro do bloco de
// documentação logo abaixo, por um motivo medido. O bloco abaixo dizia "status
// ORÇAR" e estava errado desde 21/07/2026: ORÇAR era o default ANTIGO e virou
// status aposentado quando statusCusto.js passou a ser a lista única (a
// migração faz ORÇAR→ESTIMADO). O CÓDIGO nunca mentiu — novoItem sempre leu a
// constante; quem envelheceu calado foi o comentário, enquanto o teste ao lado
// já afirmava 'ESTIMADO'.
//
// A primeira tentativa de guarda varria os comentários do arquivo INTEIRO
// procurando o default, e esta nota — que precisa citar ORÇAR e ESTIMADO para
// explicar o erro — servia de esconderijo: devolvendo a frase errada ao bloco
// abaixo, a suíte continuava verde. Por isso a divisão passou a ser física: a
// explicação fica nesta nota, e o bloco abaixo carrega SÓ a promessa, uma
// frase, que carregarBenchmark.test.js confere sozinha. Quem escrever história
// nova sobre status escreve aqui; quem mudar a promessa mexe lá.
/**
 * Aplica as escolhas de carregamento sobre o evento (PURA — devolve novo
 * evento, não muta). `escolhas` = lista de { catId, modo, itemId? } das
 * categorias SELECIONADAS; modo ∈ 'somar' | 'substituir' ('somar' = anexa;
 * 'substituir' = troca os itens da categoria pelo item do benchmark). Cada
 * categoria vira UM item novo (id próprio, status = STATUS_CUSTO_PADRAO
   * de novoItem, hoje 'ESTIMADO') com o
 * total como estimado e a origem na observação. Categoria padrão ausente é
 * recriada.
 *
 * `itemId` (opcional) fixa o id do item criado em vez de deixar o `novoItem`
 * sortear um. Quem chama pela tela SEMPRE passa: o id precisa existir ANTES
 * da gravação para o "Desfazer" saber exatamente qual linha tirar depois (ver
 * `desfazerCarregar`) — e não dá para descobri-lo durante a gravação, porque
 * o updater do App roda 2× no StrictMode e é obrigado a ser puro.
 */
export function aplicarCarregar(evento, bm, escolhas) {
  const nome = (bm?.nome || 'benchmark').trim() || 'benchmark'
  let categorias = [...(evento?.categorias || [])]
  for (const esc of escolhas) {
    const valor = bm?.custos?.[esc.catId]
    if (valor == null) continue
    const base = novoItem({
      servico: nome,
      estimado: num(valor),
      obs: `Referência: ${nome} (total da categoria)`,
    })
    const item = esc.itemId ? { ...base, id: esc.itemId } : base
    const idx = categorias.findIndex((c) => c.id === esc.catId)
    if (idx === -1) {
      // categoria padrão removida do evento — recria para o valor aparecer
      categorias = [
        ...categorias,
        { id: esc.catId, nome: nomePadraoCategoria(esc.catId), padrao: true, itens: [item] },
      ]
    } else {
      const cat = categorias[idx]
      const itens = esc.modo === 'substituir' ? [item] : [...(cat.itens || []), item]
      categorias = categorias.map((c, i) => (i === idx ? { ...c, itens } : c))
    }
  }
  return { ...evento, categorias }
}

/**
 * Desfaz UM carregamento (PURA — devolve novo evento, não muta). Recebe o
 * evento COMO ESTÁ AGORA, a foto de antes do carregamento e as mesmas
 * `escolhas` que foram aplicadas (com o `itemId` de cada uma). Categorias
 * substituídas por ações posteriores ainda ativas não recebem os originais
 * agora; suas fotos de recuperação são ajustadas por prepararDesfazerCarregamento.
 *
 * Por que não basta devolver a foto de antes (achado S3 do BACKLOG,
 * 27/07/2026): o toast do "Desfazer" vive 6 segundos e fica clicável
 * (`ui.jsx` — duração padrão 6000, portal em document.body). Trocar o evento
 * inteiro pela foto joga fora TUDO que o Marco digitou nesses 6 segundos —
 * um custo em outra categoria, um lote, um patrocínio — sem avisar. O botão
 * promete desfazer uma ação e desfazia a janela inteira.
 *
 * Aqui o desfazer é cirúrgico: mexe só nas categorias que a ação tocou e,
 * dentro delas, só no que a ação criou ou removeu.
 *   - tira o item que a ação criou, pelo id (o resto da categoria fica —
 *     inclusive item novo do Marco e edição dele em item antigo);
 *   - modo 'substituir': devolve os itens que a ação tinha trocado, na
 *     frente, e preserva o que veio depois;
 *   - categoria que a ação RECRIOU só some se ficar vazia — se o Marco
 *     lançou algo nela, a categoria fica com o que é dele;
 *   - categoria que já não existe (ele apagou) é pulada, nunca ressuscitada.
 * Nada fora de `categorias` é tocado: lote, patrocínio e receita digitados na
 * janela do toast sobrevivem. ZERO conta nova — só move itens de lugar.
 */
export function desfazerCarregar(eventoAtual, eventoAntes, escolhas, categoriasSubstituidasDepois = new Set()) {
  const originais = new Map((eventoAntes?.categorias || []).map((c) => [c.id, c]))
  const criados = new Set((escolhas || []).map((e) => e.itemId).filter(Boolean))
  const atuais = eventoAtual?.categorias || []
  let categorias = atuais.map((cat) => {
    const itens = (cat.itens || []).filter((i) => !criados.has(i.id))
    return itens.length === (cat.itens || []).length ? cat : { ...cat, itens }
  })
  const ids = new Set(categorias.flatMap((c) => (c.itens || []).map((i) => i.id)))
  for (const esc of escolhas || []) {
    const idx = categorias.findIndex((c) => c.id === esc.catId)
    if (idx === -1) continue
    const cat = categorias[idx]
    const antes = originais.get(esc.catId)
    if (categoriasSubstituidasDepois.has(esc.catId)) continue
    if (!antes) {
      if (cat.itens.length === 0) categorias = categorias.filter((_, i) => i !== idx)
      continue
    }
    if (esc.modo !== 'substituir') continue
    const faltantes = (antes.itens || []).filter((i) => !ids.has(i.id))
    if (!faltantes.length) continue
    for (const i of faltantes) ids.add(i.id)
    categorias[idx] = { ...cat, itens: [...faltantes, ...(cat.itens || [])] }
  }
  if (categorias.length === atuais.length && categorias.every((c, i) => c === atuais[i])) return eventoAtual
  return { ...eventoAtual, categorias }
}

/** Rótulo que diz o efeito (princípio 9). N itens da {festa}[ em {categoria}]. */
export function rotuloCarregar(nomeBenchmark, n, catNome = null) {
  const nome = (nomeBenchmark || 'benchmark').trim() || 'benchmark'
  const itens = `${n} ${n === 1 ? 'item' : 'itens'}`
  return catNome ? `Adicionar ${itens} da ${nome} em ${catNome}` : `Adicionar ${itens} da ${nome}`
}

/**
 * Rebaseia as fotos dos carregamentos ainda ativos ao desfazer um anterior.
 * O mapa usa IDs UUID (ordem de inserção = ordem das operações), fotografados
 * junto do histórico. Só vive no reducer, nunca no evento/backup. Uma substituição posterior mantém
 * a categoria ocupada mesmo que sua linha tenha sido apagada manualmente.
 * Ao chegar à foto de C, só B (entre A e C) pode impedir A de devolver originais;
 * C ainda não aconteceu naquela foto. Assim a dependência funciona em cadeia.
 */
export function prepararDesfazerCarregamento(ativos, id) {
  const carregamento = ativos[id]
  if (!carregamento?.eventoAntes) return null
  const categoriasSubstituidasDepois = new Set()
  const mapa = { ...ativos }
  let encontrou = false
  let recuperacaoAlterada = false
  for (const [outroId, outro] of Object.entries(ativos)) {
    if (outroId === id) { encontrou = true; continue }
    if (!encontrou || outro?.eventoAntes?.id !== carregamento.eventoAntes.id) continue
    const eventoAntes = desfazerCarregar(
      outro.eventoAntes, carregamento.eventoAntes, carregamento.escolhas, categoriasSubstituidasDepois
    )
    if (eventoAntes !== outro.eventoAntes) {
      mapa[outroId] = { ...outro, eventoAntes }
      recuperacaoAlterada = true
    }
    for (const escolha of outro.escolhas) {
      if (escolha.modo === 'substituir') categoriasSubstituidasDepois.add(escolha.catId)
    }
  }
  delete mapa[id]
  return { carregamento, categoriasSubstituidasDepois, mapa, recuperacaoAlterada }
}
