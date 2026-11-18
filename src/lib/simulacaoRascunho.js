// Modo "Simular" (sugestão 35 do MELHORIAS.md, Sessão F2-V — pedido do Marco
// em 18/07/2026): rascunho que vive em MEMÓRIA (React state), nunca na chave do
// evento no localStorage. A conta NÃO muda — os cards/DRE/semáforo/curva
// continuam chamando computeCenarios/computeCenario (calc.js intocado, golden
// intocado); o que muda é o ESTADO que alimenta a conta: um evento-visão com o
// rascunho no lugar dos campos salvos.
//
// O QUE O RASCUNHO CARREGA, e por que a lista cresceu (Marco, 05/08/2026 — o
// slider do bar nos cenários). Até aqui o rascunho era só `cenariosConfig`,
// porque só havia slider de cenário. O bar mora em OUTRO lugar do evento:
// `barTicket` (um por cenário) e `outrasReceitas.bar` (o valor fixo). Com o
// slider do bar dentro da mesma grade, manter o rascunho como estava daria uma
// de duas saídas, as duas inaceitáveis:
//
//   - ligado no canal do rascunho, o slider não faria NADA (o funil descartava
//     tudo que não fosse cenariosConfig);
//   - ligado no `update` real, ele GRAVARIA no evento enquanto o card diz
//     "rascunho — nada é salvo" e a barra de baixo diz "Simulando — nada está
//     sendo salvo".
//
// Então o rascunho passou a ter TRÊS compartimentos nomeados:
//
//     { cenariosConfig, barTicket, barFixo }
//
// `barFixo` é o escalar `outrasReceitas.bar`, guardado SOZINHO de propósito: o
// rascunho não pode ter alcance maior que os controles que o alimentam. Os
// sliders da grade mexem no `bar` e em mais nada, então é `bar` que entra —
// `outrasReceitas` é um objeto COMPARTILHADO, e copiá-lo inteiro daria ao
// rascunho poder sobre chaves que nenhum controle dele governa. `visaoDoRascunho`
// recompõe o objeto a partir do evento salvo a cada render, e `aplicarRascunho`
// usa o mesmo mapeamento — existe UM lugar que sabe qual slot vai em qual campo.
//
// A QUARTA PEÇA: a FOTO DE ENTRADA (Marco, 05/08/2026 — decisão (a) do S2 do
// BACKLOG, respondida no mesmo dia em que o S2 nasceu).
//
//     { cenariosConfig, barTicket, barFixo, entrada: {os mesmos três} }
//
// A aba Receita grava de VERDADE durante a simulação (só a aba Cenários é
// rascunho). Enquanto o Aplicar gravava os três slots sempre, um consumo de bar
// digitado lá no meio da simulação era revertido — e a linha que anunciava a
// reversão sumia da tela a partir de 3 mudanças, porque o rodapé mostra no
// máximo dois itens e o resto só existe no hover.
//
// Com a foto, o Aplicar grava SÓ o que o rascunho mudou desde que nasceu, e o
// resumo compara contra a MESMA foto — rodapé e botão contam a mesma história,
// por construção. Campo que o rascunho não tocou nem vira linha nem é gravado.
// O risco que sobra é o declarado na decisão: mexer no MESMO campo nos dois
// lugares faz o rascunho vencer — e aí a linha aparece, e é uma linha só.
//
// A foto NÃO é schema: o rascunho vive em React state e nunca vai ao
// localStorage, então nada de migração — é o próprio ponto do módulo.
//
// Por que o vazamento para o salvo continua ESTRUTURALMENTE impossível:
// 1. `rascunhoDoEvento` devolve CLONE PROFUNDO — o rascunho não compartilha
//    nenhuma referência com o objeto salvo; mutação acidental não alcança o
//    evento.
// 2. `editarRascunho` roteia os MESMOS updaters que a UI já usa (setCampo,
//    resetarSimulacao, setOverride, os sliders de bar) para o rascunho e extrai
//    SÓ os três slots do resultado. A função não recebe `update`, `setStore`
//    nem nada que escreva — não há caminho de código do rascunho até o
//    localStorage. Persistir exige passar por "Aplicar ao evento", que cria
//    snapshot de segurança antes (protecao.js) e só então chama o `update`
//    real (princípio 7 do CLAUDE.md).
// 3. A prova roda em simulacaoRascunho.test.js: entrar no modo, mexer em tudo
//    (cenários E bar) e sair sem aplicar deixa o localStorage BYTE A BYTE
//    intacto.
//
// O resumo de mudanças (`resumoDoRascunho`) compara valores EFETIVOS (o que o
// Marco vê no slider, com os fallbacks de exibição de simulador.js) — o botão
// "Aplicar" diz o efeito em português ("Pessimista: vendas 70% → 60%").

import { clone, num } from './util.js'
import { valorEfetivo } from './simulador.js'
import { fmtBRL2 } from './format.js'
import { isPrecoAusente } from './calc.js'
import { ROTULO_AJUSTE_SEM_PRECO } from './loteSemPreco.js'

/**
 * Entra no modo: cópia profunda dos campos que o rascunho carrega.
 *
 * Recebe o EVENTO inteiro (e não mais só o `cenariosConfig`) de propósito: a
 * troca de assinatura quebra no import qualquer chamada antiga em vez de
 * devolver um rascunho vazio em silêncio — o defeito que esta casa mede toda
 * semana é justamente o que continua compilando depois de mudar de forma.
 */
export function rascunhoDoEvento(evento) {
  const slots = {
    cenariosConfig: clone(evento?.cenariosConfig || {}),
    barTicket: clone(evento?.barTicket || {}),
    barFixo: evento?.outrasReceitas?.bar ?? '',
  }
  // A FOTO DE ENTRADA (Marco, 05/08/2026 — decisão (a) do S2 do BACKLOG). O
  // rascunho passa a lembrar de onde saiu, e é essa foto — não o evento salvo
  // de agora — que o Aplicar e o resumo comparam. Ver o cabeçalho do arquivo.
  // Clone próprio de propósito: editar o rascunho não pode mexer na foto.
  return { ...slots, entrada: clone(slots) }
}

/** Dois valores de dinheiro são o mesmo AOS OLHOS E NA CONTA? (num('') === 0) */
const mesmoDinheiro = (a, b) => num(a) === num(b)

/**
 * O rascunho mexeu no `cenariosConfig` desde que nasceu?
 *
 * Comparação por TEXTO (JSON), e ela erra para o lado seguro de propósito: duas
 * cópias com o mesmo conteúdo em ordem de chave diferente seriam lidas como
 * "mexeu". O pior caso desse erro é gravar um `cenariosConfig` de conteúdo
 * idêntico — exatamente o que o Aplicar fazia SEMPRE antes deste portão. Ou
 * seja, o portão só reduz gravação; nunca grava algo que antes não gravava.
 *
 * O objeto inteiro (e não chave a chave, como o `barTicket`) porque durante o
 * rascunho ninguém mais escreve nele: os dois únicos escritores — os campos de
 * Simulador.jsx e o override de lote em ScenariosTab.jsx — já passam pelo canal
 * roteado. O `barTicket` é diferente: a aba Receita escreve nele chave a chave,
 * de verdade, no meio da simulação.
 */
const cfgMexido = (a, b) => JSON.stringify(a ?? {}) !== JSON.stringify(b ?? {})

/**
 * A VISÃO: o evento como a tela deve enxergá-lo enquanto o rascunho existe.
 *
 * `outrasReceitas` é RECOMPOSTO a partir do salvo, com só a chave `bar` vindo
 * do rascunho — ver o cabeçalho deste arquivo. Sem clone: isto roda a cada
 * render e é leitura; quem grava é `aplicarRascunho`.
 */
export function visaoDoRascunho(evento, rascunho) {
  if (!rascunho) return evento
  return {
    ...evento,
    cenariosConfig: rascunho.cenariosConfig,
    barTicket: rascunho.barTicket,
    outrasReceitas: { ...evento?.outrasReceitas, bar: rascunho.barFixo },
  }
}

/**
 * A GRAVAÇÃO: o evento novo a ser salvo quando o Marco clica em "Aplicar".
 *
 * Grava SÓ O QUE O RASCUNHO MUDOU desde que nasceu (Marco, 05/08/2026 — decisão
 * (a) do S2 do BACKLOG). Campo que o rascunho não tocou fica como está no
 * evento FRESCO, e é isso que impede o Aplicar de reverter um consumo de bar
 * digitado na aba Receita durante a simulação — a aba Receita grava de verdade,
 * e antes o Aplicar passava por cima dela sem que a linha aparecesse no rodapé
 * (que mostra no máximo dois itens).
 *
 * A granularidade acompanha quem escreve: `barTicket` é comparado CENÁRIO A
 * CENÁRIO, porque a aba Receita escreve chave a chave (`{...ev.barTicket,
 * [k]: v}`) e um portão do objeto inteiro derrubaria os cenários vizinhos.
 *
 * Se o Marco mexer no MESMO campo nos dois lugares, o rascunho vence — e aí a
 * linha APARECE no rodapé, que é o risco declarado da decisão (a).
 *
 * Existe para que os DOIS lugares que aplicam (editor e apresentação) não
 * possam divergir: um esquecimento num deles daria suíte verde e mentira na
 * tela (o slider funcionando na reunião e o Aplicar gravando só os cenários).
 */
export function aplicarRascunho(evento, rascunho) {
  if (!rascunho) return evento
  const ent = rascunho.entrada || {}
  const novo = { ...evento }
  if (cfgMexido(rascunho.cenariosConfig, ent.cenariosConfig)) {
    novo.cenariosConfig = clone(rascunho.cenariosConfig)
  }
  const chaves = new Set([
    ...Object.keys(ent.barTicket || {}),
    ...Object.keys(rascunho.barTicket || {}),
  ])
  let bt = null
  for (const k of chaves) {
    if (mesmoDinheiro(rascunho.barTicket?.[k], ent.barTicket?.[k])) continue
    bt = bt || { ...(evento?.barTicket || {}) }
    bt[k] = rascunho.barTicket?.[k]
  }
  if (bt) novo.barTicket = bt
  if (!mesmoDinheiro(rascunho.barFixo, ent.barFixo)) {
    novo.outrasReceitas = { ...evento?.outrasReceitas, bar: rascunho.barFixo }
  }
  return novo
}

/**
 * Aplica ao RASCUNHO um updater da UI (a mesma forma `(evento) => eventoNovo`
 * que o `update` real recebe). Monta a visão, roda o updater e devolve os TRÊS
 * slots do resultado — qualquer outra mudança que o updater faça no evento é
 * descartada de propósito: no modo Simular só cenários e bar são rascunho; o
 * resto do evento continua salvando normal, pelo `update` real, a partir do
 * evento SALVO (nunca da visão).
 */
export function editarRascunho(rascunho, evento, fn) {
  const resultado = fn(visaoDoRascunho(evento, rascunho))
  if (!resultado || typeof resultado !== 'object') return rascunho
  const cfg = resultado.cenariosConfig
  const bt = resultado.barTicket
  return {
    cenariosConfig: cfg && typeof cfg === 'object' ? cfg : rascunho.cenariosConfig,
    barTicket: bt && typeof bt === 'object' ? bt : rascunho.barTicket,
    barFixo: resultado.outrasReceitas ? (resultado.outrasReceitas.bar ?? '') : rascunho.barFixo,
    // A foto de entrada ATRAVESSA a edição intacta: ela é de onde o rascunho
    // saiu, e nenhum updater da UI tem como alcançá-la (ela não está na visão).
    entrada: rascunho.entrada,
  }
}

const CENARIOS_RASCUNHO = ['pessimista', 'realista', 'otimista']
const ROTULO = { pessimista: 'Pessimista', realista: 'Realista', otimista: 'Otimista' }

// ticketMedio: '' e null significam a mesma coisa — automático.
const tmNorm = (v) => (v === '' || v == null ? null : Number(v))
const tmTexto = (v) => (v == null ? 'automático' : fmtBRL2(v))
// número em pt-BR (decimal com vírgula — regra da casa); sinal explícito no
// positivo para custos/ticket, como o DRE já mostra.
const numBR = (n) => String(n).replace('.', ',')
const pct = (n) => `${numBR(n)}%`
const pctSinal = (n) => `${n > 0 ? '+' : ''}${numBR(n)}%`
// overrides: ausente = automático; comparação numérica (NumInput grava número).
const ovIgual = (a, b) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b))
// Bar: a comparação é pelo NÚMERO que a conta enxerga (num('') === 0), então
// tocar num campo vazio e deixá-lo em zero não vira linha — nada mudou aos
// olhos nem na conta, e o que não vira linha não é aplicado. O TEXTO, sim,
// distingue vazio de zero: "não informado" é o que o aviso do cartão já diz.
const barTexto = (v) => (v === '' || v == null ? 'não informado' : fmtBRL2(num(v)))

/**
 * Diff legível em português entre a FOTO DE ENTRADA do rascunho e o rascunho de
 * agora — uma linha por mudança visível. Compara valores EFETIVOS (com os
 * fallbacks de exibição): campo ausente que o rascunho grava com o próprio valor
 * de exibição (ex.: arrastar o slider e voltar) não vira linha — nada mudou aos
 * olhos nem na conta. Lista vazia = nada a aplicar (o botão Aplicar desabilita e
 * nada persiste).
 *
 * O "antes" é a FOTO, não o evento salvo de agora (Marco, 05/08/2026 — decisão
 * (a) do S2 do BACKLOG), e tem de ser o MESMO "antes" que o `aplicarRascunho`
 * usa: o rodapé promete o que o botão vai fazer. Se o Marco digitar um consumo
 * de bar na aba Receita no meio da simulação, aquele campo não vira linha e não
 * é gravado — antes virava uma linha de REVERSÃO que, a partir de 3 mudanças,
 * saía da tela (o rodapé mostra no máximo dois itens) e só existia no hover.
 *
 * O 1º argumento é o RASCUNHO inteiro: ele carrega os três compartimentos E a
 * foto de onde saiu. Cada slot que `editarRascunho` extrai TEM de produzir linha
 * aqui quando o valor MUDA aos olhos e na conta — slot capaz de mudar número sem
 * produzir linha é mudança que o Aplicar grava sem anunciar, e há teste varrendo
 * isso.
 *
 * A exceção é declarada, não esquecida (medida em 05/08/2026): vazio → zero no
 * bar não vira linha, porque `num('') === num(0)` e a conta enxerga R$ 0 nos
 * dois. Desde a decisão (a) ela também não é GRAVADA — o portão do Aplicar usa
 * exatamente esta comparação, então o `''` não vira mais `0` de carona.
 *
 * Os campos de bar são comparados SEMPRE, sem olhar `barModo`/`openBar`: se o
 * Marco trocar o modo do bar na aba Receita no meio da simulação, um slot que
 * ficou obsoleto ainda assim pode ser gravado pelo Aplicar — e tem de aparecer
 * no diff antes de acontecer.
 */
export function resumoDoRascunho(rascunho, lotes = []) {
  const entrada = rascunho?.entrada || {}
  const a = entrada.cenariosConfig || {}
  const b = rascunho?.cenariosConfig || {}
  const barA = entrada.barTicket || {}
  const barB = rascunho?.barTicket || {}
  const itens = []
  for (const cen of CENARIOS_RASCUNHO) {
    const rot = ROTULO[cen]
    const vA = valorEfetivo(a, cen, 'vendaPct')
    const vB = valorEfetivo(b, cen, 'vendaPct')
    if (vA !== vB) itens.push(`${rot}: vendas ${pct(vA)} → ${pct(vB)}`)
    const cA = valorEfetivo(a, cen, 'custoPct')
    const cB = valorEfetivo(b, cen, 'custoPct')
    if (cA !== cB) itens.push(`${rot}: custos ${pctSinal(cA)} → ${pctSinal(cB)}`)
    const tA = valorEfetivo(a, cen, 'ticketPct')
    const tB = valorEfetivo(b, cen, 'ticketPct')
    if (tA !== tB) itens.push(`${rot}: ajuste do ticket ${pctSinal(tA)} → ${pctSinal(tB)}`)
    const mA = tmNorm(a[cen]?.ticketMedio)
    const mB = tmNorm(b[cen]?.ticketMedio)
    if (mA !== mB) itens.push(`${rot}: ticket médio ${tmTexto(mA)} → ${tmTexto(mB)}`)
    if (num(barA[cen]) !== num(barB[cen]))
      itens.push(`${rot}: bar por pessoa ${barTexto(barA[cen])} → ${barTexto(barB[cen])}`)
    const oA = a.overrides?.[cen] || {}
    const oB = b.overrides?.[cen] || {}
    for (const id of new Set([...Object.keys(oA), ...Object.keys(oB)])) {
      if (ovIgual(oA[id], oB[id])) continue
      const lote = lotes.find((l) => l.id === id)
      const nome = lote?.nome || 'lote'
      // Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): o ajuste
      // dele é GRAVADO pelo Aplicar, mas não muda conta nenhuma — o rodapé
      // dizia "Camarote fixado em 125 ingressos" como se mudasse. A linha
      // continua (o Aplicar grava; o rodapé promete o que o botão faz) e
      // diz, com a frase da tabela de ajuste, que o ajuste não conta.
      const naoConta = lote && isPrecoAusente(lote) ? ` (${ROTULO_AJUSTE_SEM_PRECO})` : ''
      if (oB[id] == null) itens.push(`${rot}: ${nome} volta ao automático${naoConta}`)
      else if (oA[id] == null) itens.push(`${rot}: ${nome} fixado em ${Number(oB[id])} ingressos${naoConta}`)
      else itens.push(`${rot}: ${nome} ${Number(oA[id])} → ${Number(oB[id])} ingressos${naoConta}`)
    }
  }
  const fixoA = entrada.barFixo
  const fixoB = rascunho?.barFixo
  if (num(fixoA) !== num(fixoB))
    itens.push(`Bar (lucro líquido): ${barTexto(fixoA)} → ${barTexto(fixoB)}`)
  return itens
}
