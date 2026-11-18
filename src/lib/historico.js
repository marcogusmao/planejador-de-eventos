import { prepararDesfazerCarregamento } from './carregarBenchmark.js'

// Desfazer / Refazer da sessão (pedido do Marco, 19/07/2026: "está faltando um
// botão de desfazer e refazer que nem no Financeiro").
//
// O Financeiro tem histórico com ramos no SQLite; a previsão vive no navegador,
// então a peça é outra — e o Marco cravou o desenho:
//
// 1. ESCOPO É A SESSÃO. A pilha vive em MEMÓRIA (este reducer, dentro do
//    React). NADA vai para o localStorage: a cota de lá é dos DADOS do Marco e
//    não pode ser disputada por um histórico de conveniência. Fechou a aba,
//    o histórico acaba — a lixeira, os snapshots e o backup JSON continuam
//    sendo a recuperação grande (protecao.js), e este desfazer não encosta em
//    nenhum deles.
// 2. DESFAZER RESTAURA ESTADO, NÃO RECALCULA NADA. Cada passo guarda a
//    REFERÊNCIA do objeto `store` anterior (o store já é tratado como imutável
//    no app inteiro — todo updater devolve objeto novo). Desfazer é devolver
//    aquele mesmo objeto ao React. calc.js não é chamado, golden não é tocado:
//    a conta que rodar depois é a mesma de sempre, sobre um estado que já
//    existiu de verdade.
// 3. PASSO TEM SIGNIFICADO. O app salva a cada tecla; um passo de desfazer não
//    pode ser uma letra. Edição contínua no MESMO campo vira UM passo
//    (agrupamento por `grupo` + janela de tempo — ver `registrar`).
// 4. A pilha é LIMITADA (LIMITE_PADRAO): o mais antigo cai fora.
// 5. UM PASSO COBRE A TRANSAÇÃO INTEIRA — ou não existe. Ação que também mexe
//    fora do store (a lixeira, no localStorage) não vira passo: entra por
//    'foraDoHistorico' e conta com o desfazer próprio dela. Ver o bloco grande
//    nesse case, lá embaixo. Continua valendo que este reducer NUNCA escreve
//    no localStorage — reconciliar a pilha é operação de memória.
//
// Este módulo é PURO — sem React e sem DOM. O reducer é a fonte da verdade do
// par (store, histórico) e roda inteiro nos testes (historico.test.js).

/** Quantos passos de desfazer guardar. O mais antigo cai fora. */
export const LIMITE_PADRAO = 50

/**
 * Janela de agrupamento da digitação contínua (ms). Duas alterações no MESMO
 * campo dentro dessa janela são UM passo só; a janela é ROLANTE (cada tecla
 * renova), então digitar "1.500" devagar continua sendo um passo. Parou de
 * digitar por mais que isso e voltou = passo novo, de propósito: a pausa é o
 * sinal humano de "terminei esse valor".
 */
export const JANELA_AGRUPAMENTO_MS = 700

/** Rótulo honesto de quando não dá para nomear a ação (regra da casa: rótulo
 *  genérico é melhor que rótulo errado). */
export const ROTULO_GENERICO = 'a última alteração'

export const historicoVazio = () => ({ passado: [], futuro: [] })

// ————— Modo estrito: a fidelidade do passado deixa de ser convenção —————
//
// (Verificação adversarial 19/07/2026, achado S3-E.) `registrar` guarda a
// REFERÊNCIA do store anterior, e isso só é seguro porque o app inteiro trata
// o store como imutável. "Só porque" é convenção — e convenção não verificada
// falha calada: bastaria um updater mutar em vez de copiar para o passado ser
// contaminado sem ninguém ver, e o desfazer passaria a devolver um estado que
// nunca existiu. Num app onde número errado mostrado como certo é o pior bug,
// isso não pode depender de boa vontade.
//
// Escolha, entre as três da mesa, pelo MENOR CUSTO EM RUNTIME:
//  · clonar ao registrar — mata o problema, mas paga uma cópia profunda do
//    store a cada passo e guarda 50 cópias inteiras em memória. Caro sempre,
//    para um risco que é raro.
//  · só um teste — de graça, mas prova pouco: nenhum teste de módulo alcança
//    os updaters que moram inline nos componentes.
//  · CONGELAR ao registrar (escolhido) — Object.freeze profundo, que em módulo
//    ES (sempre 'strict') faz a mutação LANÇAR em vez de passar batido. E é
//    amortizado: objeto já congelado corta a descida na hora, então cada
//    objeto é percorrido uma vez na vida, não uma vez por passo.
//
// Ligado só quando `import.meta.env.DEV` — o desenvolvimento, onde o erro
// nasce e onde queremos o estouro alto. O Marco roda `vite preview`, build de
// produção: para ele o custo é ZERO e nenhuma tela quebra no meio de uma
// reunião por causa de uma trava de desenvolvimento. `definirModoEstrito`
// existe para os testes ligarem e desligarem de propósito.
let modoEstrito = false
try {
  modoEstrito = !!import.meta.env?.DEV
} catch {
  modoEstrito = false
}

export const definirModoEstrito = (ligado) => {
  modoEstrito = !!ligado
}
export const modoEstritoLigado = () => modoEstrito

export function congelarProfundo(valor) {
  if (!valor || typeof valor !== 'object') return valor
  if (Object.isFrozen(valor)) return valor // já visitado: não desce de novo
  Object.freeze(valor)
  for (const v of Object.values(valor)) congelarProfundo(v)
  return valor
}

export const podeDesfazer = (hist) => (hist?.passado?.length || 0) > 0
export const podeRefazer = (hist) => (hist?.futuro?.length || 0) > 0

const rotuloDe = (entrada) => entrada?.rotulo || ROTULO_GENERICO

/**
 * Pilha vazia PORQUE uma ação de fora do histórico a zerou (ver
 * 'foraDoHistorico'): em vez de um "Nada para desfazer" sem explicação, o
 * botão conta o que aconteceu e para onde ir. Pilha vazia por ser o começo da
 * sessão continua com o texto curto de sempre.
 */
function textoDaPilhaVazia(hist, verbo) {
  const motivo = hist?.limpoPor
  if (!motivo) return `Nada para ${verbo}`
  return `Nada para ${verbo} — o histórico recomeçou depois de ${motivo}. Essa ação se desfaz na lixeira, em Proteção de dados.`
}

/** Texto do botão/atalho de desfazer. Sem nada na pilha, diz que não há. */
export function textoDesfazer(hist) {
  if (!podeDesfazer(hist)) return textoDaPilhaVazia(hist, 'desfazer')
  return `Desfazer: ${rotuloDe(hist.passado[0])}`
}

/** Texto do botão/atalho de refazer. */
export function textoRefazer(hist) {
  if (!podeRefazer(hist)) return textoDaPilhaVazia(hist, 'refazer')
  return `Refazer: ${rotuloDe(hist.futuro[0])}`
}

/**
 * Empilha um passo novo.
 *
 * @param hist            histórico atual
 * @param estadoAnterior  o store COMO ESTAVA antes da alteração
 * @param descritor       { rotulo, grupo } — `grupo` é uma identidade estável
 *                        do que está sendo editado (no app, o próprio elemento
 *                        do DOM em foco; nos testes, uma string). Comparado por
 *                        identidade (Object.is). `grupo` nulo = ação discreta,
 *                        nunca agrupa.
 * @param em              instante em ms (Date.now no app, número fixo no teste)
 * @param limite          tamanho máximo da pilha
 *
 * REFAZER: qualquer passo novo DESCARTA o ramo de refazer (comportamento
 * clássico — depois de desfazer, uma edição nova fecha o caminho de volta para
 * o futuro que deixou de existir).
 */
export function registrar(
  hist,
  estadoAnterior,
  descritor = {},
  em = 0,
  limite = LIMITE_PADRAO,
  carregamentosAtivos
) {
  const { rotulo = '', grupo = null } = descritor || {}
  const topo = hist.passado[0]

  // Em desenvolvimento, o estado que entra na pilha vira pedra: qualquer
  // mutação nele depois disso LANÇA, no lugar de corromper o passado calada
  // (achado S3-E). Em produção isto não roda — ver o bloco acima.
  if (modoEstrito) congelarProfundo(estadoAnterior)

  // Guarda de idempotência: o React em modo estrito roda o reducer duas vezes
  // com a MESMA entrada. Se o topo já é exatamente este estado, não empilha de
  // novo — o segundo passe vira no-op em vez de um passo fantasma.
  if (topo && Object.is(topo.estado, estadoAnterior) &&
      Object.is(topo.carregamentosAtivos, carregamentosAtivos)) return hist

  // Digitação contínua no mesmo campo: mantém o passo que já existe (com o
  // estado ANTERIOR ao início da digitação — é para lá que o desfazer volta) e
  // só renova a janela.
  if (
    topo &&
    grupo != null &&
    Object.is(topo.grupo, grupo) &&
    em - topo.tocadoEm <= JANELA_AGRUPAMENTO_MS
  ) {
    const passado = [{ ...topo, tocadoEm: em }, ...hist.passado.slice(1)]
    return { passado, futuro: [] }
  }

  const entrada = { estado: estadoAnterior, rotulo, grupo, tocadoEm: em, ...(carregamentosAtivos ? { carregamentosAtivos } : {}) }
  return { passado: [entrada, ...hist.passado].slice(0, limite), futuro: [] }
}

/**
 * Desfaz um passo. Pilha vazia = no-op seguro (devolve o MESMO histórico e o
 * MESMO estado; nada pisca na tela).
 * @returns { hist, estado, mudou }
 */
export function desfazer(hist, estadoAtual, carregamentosAtivos) {
  if (!podeDesfazer(hist)) return { hist, estado: estadoAtual, mudou: false }
  const [topo, ...resto] = hist.passado
  return {
    hist: {
      passado: resto,
      // O que vai para o futuro é o estado ATUAL, carimbado com o rótulo da
      // ação desfeita — é ela que o "Refazer" vai refazer.
      futuro: [{ estado: estadoAtual, rotulo: topo.rotulo, grupo: null, tocadoEm: topo.tocadoEm, ...(carregamentosAtivos ? { carregamentosAtivos } : {}) }, ...hist.futuro],
    },
    estado: topo.estado,
    carregamentosAtivos: topo.carregamentosAtivos || {},
    mudou: true,
  }
}

/** Refaz um passo. Sem ramo de refazer = no-op seguro. */
export function refazer(hist, estadoAtual, carregamentosAtivos) {
  if (!podeRefazer(hist)) return { hist, estado: estadoAtual, mudou: false }
  const [topo, ...resto] = hist.futuro
  return {
    hist: {
      passado: [
        { estado: estadoAtual, rotulo: topo.rotulo, grupo: null, tocadoEm: topo.tocadoEm, ...(carregamentosAtivos ? { carregamentosAtivos } : {}) },
        ...hist.passado,
      ],
      futuro: resto,
    },
    estado: topo.estado,
    carregamentosAtivos: topo.carregamentosAtivos || {},
    mudou: true,
  }
}

// ————— Reducer do par (store, histórico) —————
//
// Por que reducer e não "setStore que empilha por fora": o React pode chamar o
// updater mais de uma vez (modo estrito, re-render concorrente). Empilhar por
// fora, com o `store` do closure, erra quando duas alterações caem no mesmo
// tique. Reducer PURO sobre { store, hist } é chamado quantas vezes o React
// quiser e sempre dá o mesmo resultado — e roda inteiro no teste, sem React.

export const estadoInicial = (store) => ({ store, hist: historicoVazio() })

/**
 * Ações:
 *  - { tipo:'alterar',  fn, descritor, em }  — fn(store) => storeNovo
 *  - { tipo:'foraDoHistorico', fn }          — ver bloco grande abaixo
 *  - { tipo:'desfazer' } / { tipo:'refazer' }
 *
 * `alterar` com resultado IDÊNTICO (mesma referência) ao atual não empilha
 * nada, salvo desfazer um carregamento encoberto por outro: o store permanece,
 * mas a foto de recuperação do posterior muda e precisa poder ser refeita.
 */
export function reduzirComHistorico(estado, acao) {
  switch (acao.tipo) {
    case 'alterar': {
      const { fn, descritor, em = 0, limite = LIMITE_PADRAO } = acao
      const ativos = estado.carregamentosAtivos || {}
      const desfazerId = descritor?.desfazerCarregamentoId
      if (desfazerId && !ativos[desfazerId]) return estado
      const contexto = desfazerId ? prepararDesfazerCarregamento(ativos, desfazerId) : null
      const novo = typeof fn === 'function' ? fn(estado.store, contexto) : fn
      // Mesmo sem mudança visível (B ainda substitui A), desfazer A muda a
      // recuperação de B. Essa transição é um passo de memória, sem save/carimbo.
      // Sem custo retirado/devolvido NEM foto posterior alterada, o toast é
      // no-op: desativar só o ID não justifica apagar o futuro de refazer.
      // A guarda de evento fechado/ausente continua soberana, inclusive na fila.
      const alvo = contexto && estado.store.eventos?.find(e => e.id === contexto.carregamento.eventoAntes.id)
      if (Object.is(novo, estado.store) && (!contexto?.recuperacaoAlterada || !alvo || alvo.status === 'fechado')) return estado
      const mapa = contexto?.mapa || { ...ativos }
      if (descritor?.carregamentoId) mapa[descritor.carregamentoId] = descritor.carregamento || true
      if (desfazerId) delete mapa[desfazerId]
      return {
        store: novo,
        carregamentosAtivos: mapa,
        hist: registrar(estado.hist, estado.store, descritor, em, limite, ativos),
      }
    }

    // AÇÃO COM EFEITO FORA DO HISTÓRICO (verificação adversarial 19/07/2026,
    // achados S1-A e S1-B). Regra da casa a partir daqui: um passo de desfazer
    // cobre a TRANSAÇÃO INTEIRA ou não existe.
    //
    // Mover uma previsão para a lixeira (e restaurá-la de lá) mexe em DOIS
    // lugares: o store, que este reducer controla, e a chave
    // 'previsao-eventos:lixeira:v1' do localStorage, que ele não controla. Um
    // passo comum só sabe voltar o store — e voltar SÓ o store é o pior dos
    // mundos: restaurar da lixeira + Cmd+Z sumia com a previsão dos dois lados
    // (o item já tinha saído da lixeira), e excluir + Cmd+Z devolvia a previsão
    // à lista deixando a cópia na lixeira (duas verdades para o mesmo dado).
    //
    // Caminho escolhido: essas ações NÃO criam passo. Elas já têm o próprio
    // desfazer, melhor que este — a lixeira é durável, sobrevive a fechar a
    // aba e aparece na tela (toast na hora + Proteção de dados depois),
    // enquanto esta pilha é só da sessão e mora em memória.
    //
    // E a pilha ANTIGA é ZERADA junto. Não empilhar não bastava: os estados já
    // guardados contêm (ou não) a previsão, e um Cmd+Z numa edição anterior
    // viajaria para um passado que discorda da lixeira — ressuscitando a
    // previsão excluída, ou apagando a que acabou de ser restaurada.
    //
    // Tentamos, antes de zerar, RECONCILIAR os estados guardados (aplicar a
    // mesma transformação em cada um). Funciona para a existência, mas mente
    // no conteúdo: editar o nome da previsão, mandá-la para a lixeira e
    // trazê-la de volta faz o passo "mudar Nome" continuar na pilha prometendo
    // um nome que a cópia da lixeira já não tem — botão que promete e não
    // cumpre, que é exatamente a doença que esta sessão veio matar. Entre
    // "pilha grande com um passo que mente" e "pilha curta que diz a verdade",
    // a casa fica com a segunda (princípio 4).
    //
    // `motivo` não é enfeite: é o que os botões contam ao Marco no lugar de um
    // "Nada para desfazer" sem explicação. Ver textoDesfazer/textoRefazer.
    case 'foraDoHistorico': {
      const { fn, motivo = '' } = acao
      const novo = typeof fn === 'function' ? fn(estado.store) : fn
      if (Object.is(novo, estado.store) && !podeDesfazer(estado.hist) && !podeRefazer(estado.hist) && !Object.keys(estado.carregamentosAtivos || {}).length)
        return estado
      return { store: novo, hist: { passado: [], futuro: [], limpoPor: motivo }, carregamentosAtivos: {} }
    }
    case 'desfazer': {
      const r = desfazer(estado.hist, estado.store, estado.carregamentosAtivos || {})
      return r.mudou ? { store: r.estado, hist: r.hist, carregamentosAtivos: r.carregamentosAtivos } : estado
    }
    case 'refazer': {
      const r = refazer(estado.hist, estado.store, estado.carregamentosAtivos || {})
      return r.mudou ? { store: r.estado, hist: r.hist, carregamentosAtivos: r.carregamentosAtivos } : estado
    }
    default:
      return estado
  }
}
