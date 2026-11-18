// Reordenar itens de uma lista — a peça PURA (sem React, sem DOM).
//
// Pedido do Marco (fila do HANDOFF, item 2): "setas ↑↓ para reordenar itens de
// custo, lotes e patrocínios — mexer pra cima e pra baixo". A lógica mora aqui
// e não dentro do componente por dois motivos:
//
// 1. A ordem dos LOTES tem consequência de leitura (a coluna Acumulada e a
//    curva de vendas são somas corridas NA ORDEM exibida). Uma troca errada de
//    posição não quebra a tela — ela mostra outro número. Isso é exatamente a
//    classe de bug que este app trata como pior que crash, então a regra tem de
//    ser testável sozinha.
// 2. As três telas (custos, lotes, patrocínios) passam a falar a MESMA língua:
//    uma função só, um comportamento só nas bordas.
//
// O que este módulo NÃO faz: nada de schema. Reordenar é permutar os elementos
// de um array que já existe — nenhum campo novo é criado, nenhum é renomeado,
// nenhum é removido. O contrato do localStorage continua o mesmo array de
// sempre, só que noutra ordem, e é essa ordem que já persiste de graça (o
// backup JSON é o próprio array).

/**
 * Move o item da posição `de` para a posição `para`, devolvendo um array NOVO.
 *
 * Regra das bordas, de propósito conservadora: qualquer pedido que não faça
 * sentido (índice fora da faixa, lista vazia, lista de 1, `de === para`, valor
 * que não é inteiro) devolve **a lista original, pela mesma referência**. Quem
 * chama consegue perguntar `resultado === lista` e, sendo igual, não gravar
 * nada — assim um clique impossível não vira um passo de desfazer vazio nem um
 * save inútil. Não inventamos "clamp" (empurrar para a ponta mais próxima):
 * um clamp silencioso transformaria um pedido errado numa mudança real de
 * ordem sem ninguém pedir, e aqui nada acontece por conta própria.
 *
 * @param {Array} lista
 * @param {number} de índice de origem
 * @param {number} para índice de destino
 * @returns {Array} lista nova permutada, ou a MESMA lista quando é no-op
 */
export function moverItem(lista, de, para) {
  if (!Array.isArray(lista)) return lista
  if (!Number.isInteger(de) || !Number.isInteger(para)) return lista
  if (de < 0 || para < 0) return lista
  if (de >= lista.length || para >= lista.length) return lista
  if (de === para) return lista
  const nova = lista.slice()
  const [item] = nova.splice(de, 1)
  nova.splice(para, 0, item)
  return nova
}

/** A primeira linha não sobe. */
export function podeSubir(lista, indice) {
  return Array.isArray(lista) && Number.isInteger(indice) && indice > 0 && indice < lista.length
}

/** A última linha não desce. */
export function podeDescer(lista, indice) {
  return Array.isArray(lista) && Number.isInteger(indice) && indice >= 0 && indice < lista.length - 1
}

/**
 * PLANEJA o movimento de uma posição e devolve, além da lista, o DIAGNÓSTICO:
 * `{ lista, mudou, aviso }`. `aviso` é uma frase em português para a tela
 * mostrar — nunca null quando o clique não fez o que prometia.
 *
 * ————— por que existe (achado S3-E da rodada 2, 20/07/2026) —————
 *
 * A versão anterior fazia `findIndex((x) => x.id === id)` e pronto. Isso
 * assume que todo item TEM id e que o id é ÚNICO — e no dado real do Marco
 * nenhuma das duas coisas é garantida: `migracao.js` gera id para patrocínios
 * e parcelas, mas NÃO para lotes nem para itens de custo. Um backup antigo (ou
 * editado à mão) com dois lotes sem id deixa os dois com `id === undefined`, e
 * aí `findIndex` casa SEMPRE o primeiro: o Marco clica a seta da linha 4 e a
 * linha 1 é que se mexe. Linha errada mexendo em silêncio, num app onde a
 * ordem dos lotes é a régua da coluna Acumulada e da curva de vendas.
 *
 * ————— a decisão, entre os dois comportamentos defensáveis —————
 *
 * Havia duas saídas honestas: (a) recusar todo movimento ambíguo e avisar, ou
 * (b) desempatar pela posição que o usuário estava vendo. Escolhi as DUAS, em
 * ordem, porque elas respondem a perguntas diferentes:
 *
 *  1. id casando com EXATAMENTE UM item → move por id. É o caso normal e
 *     continua imune ao closure stale (o índice do render pode estar velho
 *     quando o updater roda; o id não).
 *  2. id casando com NENHUM item → não move, e avisa. Nada de "clamp", nada
 *     de mexer no primeiro por desencargo.
 *  3. id casando com VÁRIOS itens (o caso do backup sem id) → desempata pelo
 *     `indiceEsperado`, o índice que a linha ocupava no render — que é
 *     literalmente a linha que a mão do Marco mirou. Só vale se aquele índice
 *     for mesmo uma das ocorrências; senão, não move e avisa.
 *     E MESMO DANDO CERTO o aviso vai junto: uma lista com identificadores
 *     repetidos é um defeito do dado que o Marco tem de saber que existe, e o
 *     desempate por posição é um remendo que só funciona enquanto ninguém
 *     reordena duas vezes no mesmo batch. Acertar calado seria esconder isso.
 *
 * O que NÃO foi feito, de propósito: inventar um campo de id novo e sair
 * carimbando os lotes legados. Isso é mudança de schema do localStorage, que
 * é portão do Marco (princípio 2) — e não é preciso para o clique estar certo.
 *
 * @param {Array} lista
 * @param {*} id valor de `item.id`
 * @param {'cima'|'baixo'} direcao
 * @param {number|null} indiceEsperado índice da linha no render (desempate)
 */
export function planejarMovimento(lista, id, direcao, indiceEsperado = null) {
  if (!Array.isArray(lista)) return { lista, mudou: false, aviso: null }

  const ocorrencias = []
  for (let i = 0; i < lista.length; i++) if (lista[i] && lista[i].id === id) ocorrencias.push(i)

  let de
  let aviso = null
  if (ocorrencias.length === 1) {
    de = ocorrencias[0]
  } else if (ocorrencias.length === 0) {
    return {
      lista,
      mudou: false,
      aviso:
        'Não consegui achar esta linha na lista para movê-la — ela pode ter sido apagada em outra aba. Nada foi movido; recarregue a página e tente de novo.',
    }
  } else if (Number.isInteger(indiceEsperado) && ocorrencias.includes(indiceEsperado)) {
    de = indiceEsperado
    aviso =
      'Esta lista tem linhas sem identificador próprio (dado antigo). Movi a linha que você clicou, pela posição dela — mas confira a ordem antes de usar os números.'
  } else {
    return {
      lista,
      mudou: false,
      aviso:
        'Esta lista tem linhas sem identificador próprio (dado antigo) e não deu para saber qual delas você clicou. Nada foi movido, para não mexer na linha errada.',
    }
  }

  const nova = moverItem(lista, de, direcao === 'cima' ? de - 1 : de + 1)
  // `moverItem` devolve a MESMA referência quando o movimento é impossível
  // (já é o primeiro / já é o último). Isso é o que faz o no-op não virar
  // passo de desfazer vazio — ver `moverEmLista`.
  return nova === lista ? { lista, mudou: false, aviso } : { lista: nova, mudou: true, aviso }
}

/**
 * Move UMA posição, achando o item pelo `id` na hora. Açúcar sobre
 * `planejarMovimento` para quem só quer a lista (testes antigos e chamadas que
 * não têm onde mostrar aviso).
 */
export function moverPorId(lista, id, direcao, indiceEsperado = null) {
  return planejarMovimento(lista, id, direcao, indiceEsperado).lista
}

/**
 * A porta que as TELAS usam: move `obj[chave]` e devolve `{ obj, mudou, aviso }`.
 *
 * A garantia que importa aqui é a IDENTIDADE: quando nada mudou, `obj` volta
 * pela MESMA referência. É isso que impede o achado S3-F (o no-op comendo um
 * passo de desfazer vazio) — os componentes montavam `{ ...evento, lotes }`
 * incondicionalmente, então mesmo o clique impossível produzia um store novo,
 * `reduzirComHistorico` via um objeto diferente e empilhava um passo. O Marco
 * clicava "Desfazer: mover Lote 3 para cima" e a tela não se mexia.
 */
export function moverEmLista(obj, chave, id, direcao, indiceEsperado = null) {
  const p = planejarMovimento(obj?.[chave], id, direcao, indiceEsperado)
  return {
    obj: p.mudou ? { ...obj, [chave]: p.lista } : obj,
    mudou: p.mudou,
    aviso: p.aviso,
  }
}
