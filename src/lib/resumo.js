// "Copiar resumo" (Sessão K — pedido do Marco, 18/07): texto pronto para o
// WhatsApp do grupo das sócias, em dois níveis. DISPLAY-ONLY: nenhuma conta
// nova — tudo deriva de computeCenarios/veredito/ritmoVendas/custosPorStatus,
// os MESMOS módulos que pintam a tela. Formato WhatsApp: *negrito*, emoji do
// semáforo (em texto o emoji vive; na tela virou a bola da marca).
import {
  computeCenarios,
  veredito,
  ritmoVendas,
  custosPorStatus,
  patrocinioPorEstagio,
  isOpenBar,
} from './calc.js'
import { fmtBRL, fmtCompact, fmtPct, fmtInt, fmtData, formatadorCompacto } from './format.js'
import { fraseVeredito, EMOJI_SEMAFORO, TITULO_VEREDITO } from './vereditoTexto.js'
import { premissaDesconto, premissaTaxa, premissaBar } from './premissaTexto.js'
import { impostoTexto, impostoValor, temImposto } from './imposto.js'
import {
  BREAK_EVEN_NAO_FECHA,
  BREAK_EVEN_QUANTIDADE_TRAVADA,
  RITMO_NAO_FECHA,
  temQuantidadeTravada,
  avisoBreakEven,
} from './breakEvenTexto.js'
import { contaOrcamentoFechado } from './statusCusto.js'
import { inicioVendasParaRitmo } from './curvaVendas.js'
import { hojeISO, dataLocalDoInstante } from './dataLocal.js'
import { num } from './util.js'
import { textoAvisoLotesSemPreco } from './loteSemPreco.js'
import {
  NUMERO_NAO_CALCULA,
  TITULO_VEREDITO_QUEBRADO,
  cabeComoDinheiro,
  VALOR_ILEGIVEL,
  custosQuebrados,
  receitaQuebrada,
  cenarioQuebrado,
  receitaDoCenarioQuebrada,
  vereditoQuebrado as vereditoQuebradoLib,
  fraseVereditoQuebrado,
  fotoQuebrada,
} from './dadoQuebrado.js'

// ————— DADO QUEBRADO NO WHATSAPP (05/10/2026, 2ª revisão do PR #98) —————
// Para festa com custo que não cabe numa conta de dinheiro, este texto saía
// "*Inviável como está.* … margem realista 0%", "Lucro: pessimista R$ 0 ·
// realista R$ 0 · otimista R$ 0", "Resultado real: R$ 0" na festa fechada e,
// no Completo, "Orçamento: R$ 0 de R$ 100.000…000 mi (0%)". É o canal com
// MENOS contexto: ninguém clica para descobrir que o zero é lixo. Mesma regra
// das telas (decisão do Marco, 26/07/2026): texto curto no lugar do número,
// sem veredito, e uma linha no topo dizendo o que está quebrado.
const cenQuebrado = (evento, s) => cenarioQuebrado(evento, s, computeCenariosCache(evento))
const recQuebrada = (evento, s) => receitaDoCenarioQuebrada(evento, s, computeCenariosCache(evento))
// Os três cenários do evento, calculados uma vez por objeto de evento (o resumo
// pergunta cenário a cenário e não tem o `c` à mão em todas as funções).
const cacheCenarios = new WeakMap()
const computeCenariosCache = (evento) => {
  if (!cacheCenarios.has(evento)) cacheCenarios.set(evento, computeCenarios(evento))
  return cacheCenarios.get(evento)
}
const vereditoQuebrado = (evento, c) => vereditoQuebradoLib(evento, c)
const dinOuTexto = (v, fmt) => (v != null && cabeComoDinheiro(v) ? fmt(v) : NUMERO_NAO_CALCULA)

/** A linha do topo, ou null. Nomeia o primeiro custo/receita culpado. */
export function linhaDadoQuebrado(evento) {
  const custo = custosQuebrados(evento)
  if (custo.ha) {
    const it = custo.itens[0]
    const quem = it ? ` (“${it.servico}”${custo.itens.length > 1 ? ` e mais ${custo.itens.length - 1}` : ''})` : ''
    return `⚠️ Esta festa tem um custo que o app não consegue calcular${quem} — os números que dependem dele saem como “${NUMERO_NAO_CALCULA}”.`
  }
  const rec = receitaQuebrada(evento)
  if (rec.ha)
    return `⚠️ Esta festa tem uma receita que o app não consegue calcular (${
      rec.campos.length ? rec.campos.join(', ') : 'a soma da receita prevista'
    }) — os números que dependem dela saem como “${NUMERO_NAO_CALCULA}”.`
  return null
}

// Frase do ritmo (null = sem frase) — movida VERBATIM de RitmoVendas.jsx na
// Sessão K (o card e o resumo usam o MESMO texto; conteúdo preservado).
/** A marcação de "a festa já aconteceu". Texto ÚNICO da casa: era usado só
 *  pelo card cheio da aba Cenários e descartado pelas outras quatro
 *  superfícies (WhatsApp, PDF, Home, curva). Virou constante exportada para
 *  que nenhuma superfície reescreva o texto por conta própria. */
export const MARCACAO_REALIZADA = 'Evento já realizado — o acompanhamento de vendas não se aplica.'

/** O ritmo necessário em DIAS (Marco, 10/08/2026, por questionário).
 *
 *  A frase dizia "precisa vender 164 por semana" e mostrava a janela em semanas
 *  arredondadas a uma casa. Medido no Brisa #3 (22/08/2026, olhado em
 *  10/08/2026, 84 vendidos, break-even 364): a tela dizia "Faltam 280 ingressos
 *  em 1,7 semana(s) → 164 por semana", e quem refazia a conta com os números
 *  MOSTRADOS achava 164 × 1,7 = 278,8 — MENOS que os 280 que faltavam. O 164
 *  estava certo (a divisão usava 1,714…, e 164 × 1,714 = 281,1), mas o dono do
 *  app desconfiou de um número correto, o que é o custo que este conserto paga.
 *  Em dias não há o que arredondar na janela: 24 × 12 = 288 ≥ 280 fecha no papel.
 *
 *  DERIVADO, não novo: `diasVenda` é a MESMA janela que `ritmoVendas` usou para
 *  achar `semanas` (lá, `semanas = diasVenda / 7`), e o arredondamento PARA CIMA
 *  é o mesmo do `porSemana` — continua nunca subestimando o ritmo necessário.
 *  Mora aqui, e não em `calc.js`, de propósito: nenhuma conta do módulo
 *  protegido muda, e as três telas que mostram ritmo leem desta função só.
 *
 *  A PORTA é só a JANELA REAL (Marco, 10/08/2026, segunda rodada por
 *  questionário): `diasVenda >= 1`. Até aqui ela era herdada do `calc.js`
 *  (`porSemana == null`), e por isso a semana final — a semana em que ele mais
 *  precisa do número — era a única que NÃO mostrava ritmo: faltando 280 em 4
 *  dias a tela dizia "menos de uma semana de venda" e calava. Agora diz 70 por
 *  dia. Não é conta nova: é a MESMA divisão, com a mesma janela e o mesmo
 *  arredondamento PARA CIMA, liberada para a faixa que a porta velha barrava.
 */
export function ritmoPorDia(r) {
  if (!r || r.diasVenda == null || r.faltam == null) return null
  // `diasVenda` vem PRONTO do `ritmoVendas` desde 30/08/2026 (aprovação do
  // Marco de 10/08). Aqui havia `Math.round(r.semanas * 7)` — o ida-e-volta que
  // existia só para recuperar, em dias, um inteiro que o calc.js já tinha e
  // quebrava ao dividir por 7 (`12 / 7 * 7` = 12.000000000000002).
  const { diasVenda } = r
  // `!Number.isFinite` ANTES do `< 1`, e a ordem é o conserto (30/08/2026).
  // A porta era só `diasVenda < 1` — e `NaN < 1` é **false**, então o `null`
  // nunca acontecia para uma data de festa ilegível. O que saía era
  // `{ diasVenda: NaN, porDia: NaN }`, e `fmtInt(NaN)` passa por `num()`, que
  // devolve 0: a Home dizia "Faltam 613 p/ break-even · 0/dia" e o card dizia
  // "em 0 dia(s) de venda → precisa vender 0 por dia". Zero ingressos por dia
  // quando faltam 613 é um número errado mostrado como certo, que é o pior bug
  // desta casa. Medido em 30/08/2026 com `data = "abacaxi"` e com
  // `data = "05/12/2026"` (o formato brasileiro de tela, plausível num backup
  // editado à mão): as duas produziam o mesmo "0/dia".
  if (!Number.isFinite(diasVenda) || diasVenda < 1) return null
  return { diasVenda, porDia: Math.ceil(r.faltam / diasVenda) }
}

/** O texto ÚNICO de "a data desta festa não é uma data" (Marco/auditoria,
 *  30/08/2026). Mora aqui, ao lado das outras frases de ritmo, para as cinco
 *  superfícies nunca escreverem versões diferentes da mesma notícia. */
export const DATA_DO_EVENTO_ILEGIVEL =
  'A data desta festa não é uma data válida — corrija a data para ver o ritmo de vendas.'

/**
 * A data do evento é ilegível PARA A CONTA DE RITMO?
 *
 * `ritmoVendas` (em calc.js, arquivo de portão) aceita qualquer texto em
 * `dataEvento` e devolve `dias`/`semanas` = NaN quando o texto não é uma data —
 * porque `new Date('abacaxiT12:00:00')` é Invalid Date. Este módulo é a camada
 * de EXIBIÇÃO, e a regra dele é simples: nenhuma tela imprime um número que
 * nasceu de NaN.
 *
 * `eventoPassado` sai primeiro de propósito: naquele ramo `ritmoVendas` devolve
 * um objeto de UMA chave, sem `dias`, e ele já tem texto próprio.
 *
 * TRAVAR NA ORIGEM — fazer `ritmoVendas` devolver `null` em vez de NaN — seria
 * melhor, e não é feito aqui: `calc.js` está no PADRAO_PORTAO e a mudança
 * precisa da linha de aprovação do Marco. Está registrado no BACKLOG.
 */
export function dataDoEventoIlegivel(r) {
  return Boolean(r) && !r.eventoPassado && !Number.isFinite(r.dias)
}

export function fraseRitmo(r) {
  if (!r) return null
  if (r.eventoPassado) return MARCACAO_REALIZADA
  // ANTES do `cobriu`: naquele ramo a frase imprime `${fmtInt(r.dias)} dia(s)
  // da festa`, e com a data ilegível isso vira "a 0 dia(s) da festa" — outro
  // número inventado. Aqui a tela diz o problema em vez de inventar o número.
  if (dataDoEventoIlegivel(r)) return DATA_DO_EVENTO_ILEGIVEL
  if (r.cobriu)
    return `✓ Break-even coberto: ${fmtInt(r.vendidos)} vendidos ≥ ${fmtInt(r.breakEven)} necessários, a ${fmtInt(r.dias)} dia(s) da festa.`
  // F2-S (sugestão 30): quando as vendas ainda não abriram, os dias já
  // são os da janela restante real — a frase diz o porquê.
  const notaInicio = r.vendasAbremEm ? ` (vendas abrem em ${fmtInt(r.vendasAbremEm)} dia(s))` : ''
  const d = ritmoPorDia(r)
  if (!d) {
    // A FESTA É HOJE (Marco, 10/08/2026). Antes caía no texto da janela curta,
    // que era verdade e não servia para nada ("menos de uma semana de venda").
    // No PRESENTE de propósito: o dia não acabou, ainda entra venda na porta —
    // quem já passou é `eventoPassado`, tratado lá em cima.
    if (r.dias === 0)
      return `A festa é hoje — faltam ${fmtInt(r.faltam)} ingressos para o break-even (${fmtInt(r.breakEven)}).`
    // Sobrou uma janela só: a de venda ZERO com festa no futuro, que acontece
    // quando o início das vendas cai na data da festa (ou depois). A nota de
    // início explica o porquê, e é a única coisa que salva a frase de ser um
    // enigma.
    return `Faltam ${fmtInt(r.faltam)} ingressos para o break-even (${fmtInt(r.breakEven)}) e menos de um dia de venda${notaInicio}.`
  }
  return `Faltam ${fmtInt(r.faltam)} ingressos em ${fmtInt(d.diasVenda)} dia(s) de venda${notaInicio} → precisa vender ${fmtInt(d.porDia)} por dia para cobrir o break-even (${fmtInt(r.breakEven)}).`
}

// (o relógio local mora em dataLocal.js — ver import no topo)

// Lote sem preço (P8, 06/10/2026): o canal com MENOS contexto diz que o
// público e o bar já não contam esse lote — ninguém clica no WhatsApp.
const linhaLoteSemPreco = (evento) => {
  const t = textoAvisoLotesSemPreco(evento)
  return t ? `⚠️ ${t}` : null
}

function cabecalho(evento, c, v) {
  const meta = [fmtData(evento.data), evento.local].filter(Boolean).join(' · ')
  if (vereditoQuebrado(evento, c)) {
    // Sem semáforo: a cor seria tirada de uma margem que não existe.
    return [
      `⚠️ *${evento.nome}*${meta ? ` — ${meta}` : ''}`,
      linhaDadoQuebrado(evento),
      linhaLoteSemPreco(evento),
      `*${TITULO_VEREDITO_QUEBRADO}.* ${fraseVereditoQuebrado(evento)}`,
    ].filter(Boolean)
  }
  const aviso = linhaDadoQuebrado(evento)
  const semPreco = linhaLoteSemPreco(evento)
  return [
    `${EMOJI_SEMAFORO[v.cor]} *${evento.nome}*${meta ? ` — ${meta}` : ''}`,
    ...(aviso ? [aviso] : []),
    ...(semPreco ? [semPreco] : []),
    `*${TITULO_VEREDITO[v.cor]}.* ${fraseVeredito(c, v)}`,
  ]
}

function linhaLucros(c, evento) {
  // rótulos dos 3 lucros calibrados juntos (tema D, F2-P): no WhatsApp, dois
  // cenários com lucros diferentes nunca aparecem ambos como "R$ 2 mil".
  const f = formatadorCompacto([c.pessimista.lucro, c.realista.lucro, c.otimista.lucro])
  const l = (k) => (evento && cenQuebrado(evento, c[k]) ? NUMERO_NAO_CALCULA : f(c[k].lucro))
  return `Lucro: pessimista ${l('pessimista')} · *realista ${l('realista')}* · otimista ${l('otimista')}`
}

function linhaChave(c, evento) {
  // "não fecha nem vendendo tudo" em vez do traço (Marco, 27/07/2026): no
  // WhatsApp o traço era lido como "faltou preencher", quando o que ele quer
  // dizer é que o cenário não sai do prejuízo de jeito nenhum.
  const be = temQuantidadeTravada(evento, 'realista')
    ? `break-even: ${avisoBreakEven(evento, c.realista, c)}`
    : c.realista.breakEvenNaoFecha
    ? `break-even: ${BREAK_EVEN_NAO_FECHA}`
    : c.realista.breakEven == null
      ? 'break-even —'
      : `break-even ${fmtInt(c.realista.breakEven)} pagos`
  const margem =
    evento && cenQuebrado(evento, c.realista) ? `: ${NUMERO_NAO_CALCULA}` : ` ${fmtPct(c.realista.margem)}`
  // receita do realista quebrada: break-even e público vêm dela (05/10/2026)
  if (evento && (recQuebrada(evento, c.realista) || cenQuebrado(evento, c.realista)))
    return `Margem realista${margem} · break-even: ${NUMERO_NAO_CALCULA} · público ${
      recQuebrada(evento, c.realista) ? NUMERO_NAO_CALCULA : fmtInt(c.realista.publico)
    }`
  return `Margem realista${margem} · ${be} · público ${fmtInt(c.realista.publico)}`
}

/**
 * O que as superfícies de RITMO dizem quando não existe break-even porque o
 * cenário realista não fecha nem vendendo tudo (Marco, 27/07/2026).
 *
 * Devolve `{ tom, texto }` — a mesma forma que `linhaRitmoHome` já devolvia —
 * e é a fonte ÚNICA das quatro telas: card "Estamos vendendo no ritmo?", Home,
 * relatório/PDF e curva de vendas. Sem ela, cada tela escreveria a sua versão
 * da notícia, que é como as três primeiras acabaram sem versão nenhuma.
 *
 * FESTA QUE JÁ ACONTECEU tem precedência, e é a mesma precedência das outras
 * frases deste módulo: "não há ritmo que alcance" fala de um futuro que não
 * existe mais. Quem decide "já passou" continua sendo `ritmoVendas` — a MESMA
 * régua das outras superfícies, com o mesmo relógio local. O `breakEven: 0`
 * passado aqui é só a chave que abre a porta do módulo (sem break-even ele
 * devolve `null` antes de olhar a data); nenhum número dele é lido, só o
 * `eventoPassado`, que não depende de quantos ingressos faltam.
 */
export function fraseRitmoNaoFecha(evento, hoje = hojeISO()) {
  const r = ritmoVendas({
    vendidos: evento?.vendidosAteHoje,
    dataEvento: evento?.data,
    breakEven: 0,
    hoje,
  })
  if (r?.eventoPassado) return { tom: 'neutro', texto: MARCACAO_REALIZADA }
  return { tom: 'alerta', texto: RITMO_NAO_FECHA }
}

const temVendidos = (evento) => evento?.vendidosAteHoje !== '' && evento?.vendidosAteHoje != null

/** A meta deixa de acompanhar as vendas quando um lote está travado. */
export function avisoRitmoQuantidadeTravada(evento, hoje = hojeISO(), cenarios = null) {
  if (!temQuantidadeTravada(evento, 'realista')) return null
  const c = cenarios ?? computeCenarios(evento)
  const texto = avisoBreakEven(evento, c.realista, c)
  if (texto === NUMERO_NAO_CALCULA) return { tom: 'alerta', texto }
  const r = ritmoVendas({ vendidos: evento?.vendidosAteHoje, dataEvento: evento?.data, breakEven: 0, hoje })
  if (r?.eventoPassado) return { tom: 'neutro', texto: MARCACAO_REALIZADA }
  if (dataDoEventoIlegivel(r)) return { tom: 'alerta', texto: DATA_DO_EVENTO_ILEGIVEL }
  return { tom: 'alerta', texto }
}

function ritmoDoEvento(evento, breakEven, hoje) {
  return ritmoVendas({
    vendidos: evento.vendidosAteHoje,
    dataEvento: evento.data,
    breakEven,
    hoje,
    // F2-S (sugestão 30): a mesma janela restante real do card de ritmo
    inicioVendas: inicioVendasParaRitmo(evento),
  })
}

function linhaRitmo(evento, c, hoje) {
  const aviso = avisoRitmoQuantidadeTravada(evento, hoje, c)
  // Trava (S6): some a META, não o dado. "Vendidos até hoje" é o que a
  // bilheteria informou e continua impresso; só o "faltam N/por dia" cede.
  if (aviso) return aviso.texto === BREAK_EVEN_QUANTIDADE_TRAVADA && temVendidos(evento)
    ? `Vendidos até hoje: ${fmtInt(evento.vendidosAteHoje)}. ${aviso.texto}`
    : aviso.texto
  const r = ritmoDoEvento(evento, c.realista.breakEven, hoje)
  const frase = fraseRitmo(r)
  // QUINTA superfície de ritmo, e a que quase ficou de fora (achado do revisor,
  // 27/07/2026). As outras quatro — card, Home, relatório e curva — ganharam a
  // chave `breakEvenNaoFecha`; esta não, e o efeito foi uma REGRESSÃO que este
  // próprio trabalho causou: numa festa que JÁ ACONTECEU e não fecha, o resumo
  // do WhatsApp perdia a marcação "Evento já realizado". Antes o break-even era
  // um número, `ritmoVendas` devolvia { eventoPassado: true } e a frase saía;
  // com o break-even nulo o `if (!frase) return null` engolia a linha inteira.
  // Numa festa FUTURA que não fecha, sumia também o "Vendidos até hoje: N" —
  // enquanto os números-chave do MESMO resumo diziam "não fecha nem vendendo
  // tudo". Duas verdades no mesmo texto colado no WhatsApp.
  if (!frase) {
    return c.realista.breakEvenNaoFecha ? fraseRitmoNaoFecha(evento, hoje).texto : null
  }
  // Festa já realizada: a frase vai SOZINHA. O prefixo "Vendidos até hoje: N"
  // não existe aqui por dois motivos — ritmoVendas devolve só
  // `{ eventoPassado: true }` (não há `r.vendidos` para imprimir, era o motivo
  // legítimo do descarte antigo) e "até hoje" não quer dizer nada depois da
  // festa. Conteúdo idêntico ao do card; muda só a forma.
  if (r.eventoPassado) return frase
  return `Vendidos até hoje: ${fmtInt(r.vendidos)}. ${frase}`
}

/** Mesma leitura para o relatório/PDF (ReportView). Texto puro, testável, com
 *  a MESMA regra do WhatsApp: festa realizada → a marcação sozinha.
 *
 *  `breakEvenNaoFecha` entra por ÚLTIMO de propósito: `hoje` já era o terceiro
 *  parâmetro posicional em todos os chamadores e testes, e mover o relógio de
 *  lugar para acomodar uma chave nova é como se troca a data de uma conta sem
 *  ninguém perceber. Sem a chave (o padrão), o comportamento é o de antes. */
export function linhaRitmoRelatorio(evento, breakEven, hoje = hojeISO(), breakEvenNaoFecha = false, cenarios = null) {
  const aviso = avisoRitmoQuantidadeTravada(evento, hoje, cenarios)
  if (aviso) return aviso.texto === BREAK_EVEN_QUANTIDADE_TRAVADA && temVendidos(evento)
    ? `${fmtInt(evento.vendidosAteHoje)} vendidos até hoje. ${aviso.texto}`
    : aviso.texto
  const r = ritmoDoEvento(evento, breakEven, hoje)
  const frase = fraseRitmo(r)
  // Sem break-even PORQUE não fecha: o PDF dizia nada — some a linha inteira e
  // o relatório impresso fica igual ao de uma festa saudável (Marco,
  // 27/07/2026). Agora diz, com a MESMA frase das outras três telas.
  if (!frase) return breakEvenNaoFecha ? fraseRitmoNaoFecha(evento, hoje).texto : null
  if (r.eventoPassado) return frase
  return `${temVendidos(evento) ? `${fmtInt(evento.vendidosAteHoje)} vendidos até hoje. ` : ''}${frase}`
}

// Festa FECHADA fala com o RESULTADO REAL (decisão do Marco, 20/07/2026): a
// fonte é a FOTO do fechamento — números congelados, imunes a fórmula futura
// (fechamentoEvento.js). Festa passada mas ainda ABERTA continua mostrando a
// projeção: FECHAR é o ato que oficializa o resultado — foto parcial sai com
// a pendência declarada, projeção nunca sai vestida de realizado. O emoji é o
// sinal do resultado REAL (verde lucro, vermelho prejuízo — semáforo é
// significado), não o semáforo projetado.
function blocoResultadoReal(evento) {
  if (evento?.status !== 'fechado') return null
  const foto = evento.fechamento?.foto?.resultado
  if (!foto) return null
  // Foto quebrada (custos/resultado null depois do JSON, ou 1e308 do Pix): o
  // emoji saía 🟢 com `num(null) >= 0` e o resultado "R$ 0".
  const quebrada = fotoQuebrada(foto)
  const emoji = quebrada ? '⚠️' : num(foto.resultado) >= 0 ? '🟢' : '🔴'
  const meta = [fmtData(evento.data), evento.local].filter(Boolean).join(' · ')
  const aviso = quebrada ? linhaDadoQuebrado(evento) : null
  const linhas = [
    `${emoji} *${evento.nome}*${meta ? ` — ${meta}` : ''}`,
    ...(aviso ? [aviso] : []),
    `*Festa realizada — Resultado real: ${quebrada ? NUMERO_NAO_CALCULA : fmtBRL(foto.resultado)}* (fechado em ${fmtData(dataLocalDoInstante(evento.fechamento.em))})`,
    // O IMPOSTO ENTRA NA FRASE (Marco, 27/07/2026) porque sem ele esta linha
    // NÃO FECHA com o resultado da linha de cima. MEDIDO: "Resultado real
    // R$ 8.200" ao lado de "Receita real R$ 12.500 · custos considerados
    // R$ 3.000" — 12.500 − 3.000 = 9.500, e os R$ 1.300 que faltavam eram o
    // imposto, invisíveis no canal com MENOS contexto e MENOS chance de
    // conferência. Só aparece quando existe: festa fechada sem imposto (todas
    // as de hoje) sai com a frase idêntica à de sempre.
    `Receita real ${quebrada ? dinOuTexto(foto.receita, fmtBRL) : fmtBRL(foto.receita)}${
      foto.imposto ? ` · imposto ${fmtBRL(foto.imposto.valor)}` : ''
    } · custos considerados ${quebrada ? dinOuTexto(foto.custos, fmtBRL) : fmtBRL(foto.custos)}`,
  ]
  if (!foto.completo)
    linhas.push(
      '⚠️ Fechamento com pendência declarada (parte ainda entra pelo previsto) — detalhe na aba Fechamento.'
    )
  return linhas
}

/** Resumido: veredito + números-chave — o que vai no grupo sem rolagem. */
export function resumoCurto(evento, { hoje = hojeISO() } = {}) {
  const real = blocoResultadoReal(evento)
  if (real) return real.join('\n')
  const c = computeCenarios(evento)
  const v = veredito(c, evento)
  const linhas = [...cabecalho(evento, c, v), '', linhaLucros(c, evento), linhaChave(c, evento)]
  const ritmo = linhaRitmo(evento, c, hoje)
  if (ritmo) linhas.push(ritmo)
  return linhas.join('\n')
}

/** Completo: tudo em texto — cenários abertos, orçamento, patrocínio,
 *  premissas. Continua display-only. */
export function resumoCompleto(evento, { hoje = hojeISO() } = {}) {
  const c = computeCenarios(evento)
  const v = veredito(c, evento)
  const real = blocoResultadoReal(evento)
  // Fechado: o resultado real lidera; o plano pré-evento continua abaixo,
  // nomeado como comparação — completo é o nível de quem quer ver os dois.
  // Festa fechada com a foto SÃ e o cadastro quebrado: o resultado real vale,
  // mas o plano abaixo sai com "não dá para calcular" — a linha do topo diz
  // por quê (o bloco real só a traz quando a própria foto está quebrada).
  const avisoPlano =
    real && !real.some((l) => l.startsWith('⚠️ Esta festa')) ? linhaDadoQuebrado(evento) : null
  // Lote sem preço (P8): o plano abaixo já não conta o lote; o resultado real
  // de cima não muda. A linha fica entre os dois, como o aviso do plano.
  const semPrecoPlano = real ? linhaLoteSemPreco(evento) : null
  const linhas = real
    ? [
        ...real,
        ...(avisoPlano ? [avisoPlano] : []),
        ...(semPrecoPlano ? [semPrecoPlano] : []),
        '',
        '_O plano pré-evento (cenários), para comparação:_',
        '',
      ]
    : [...cabecalho(evento, c, v), '']

  linhas.push('*Cenários*')
  for (const k of ['pessimista', 'realista', 'otimista']) {
    const s = c[k]
    const nome = k === 'pessimista' ? 'Pessimista' : k === 'realista' ? 'Realista' : 'Otimista'
    // Imposto no meio da linha, entre receita e custo — a MESMA ordem do DRE.
    // Sem ele, a sócia que conferisse "receita menos custo" no WhatsApp
    // acharia um lucro diferente do que está escrito ao lado, e o texto do
    // WhatsApp é justamente onde ninguém pode clicar para entender a
    // diferença (Marco, 27/07/2026).
    const imp = temImposto(s) ? ` · imposto ${fmtCompact(impostoValor(s))}` : ''
    if (cenQuebrado(evento, s)) {
      linhas.push(
        `${nome}: lucro ${NUMERO_NAO_CALCULA} — receita ${recQuebrada(evento, s) ? NUMERO_NAO_CALCULA : fmtCompact(s.receitaTotal)}${recQuebrada(evento, s) ? '' : imp} · custo ${dinOuTexto(s.custoTotal, fmtCompact)}`
      )
      continue
    }
    linhas.push(
      `${nome}: lucro ${fmtCompact(s.lucro)} (margem ${fmtPct(s.margem)}) — receita ${fmtCompact(s.receitaTotal)}${imp} · custo ${fmtCompact(s.custoTotal)}`
    )
  }
  linhas.push(linhaChave(c, evento))

  const ritmo = linhaRitmo(evento, c, hoje)
  if (ritmo) linhas.push('', ritmo)

  // % do orçamento fechado (sugestão 3) — a MESMA função da barra e do relatório
  // (contaOrcamentoFechado, statusCusto.js): denominador = TODOS os status,
  // numerador = PAGO+FECHADO+PARCIAL (Marco, 22/07/2026 — PARCIAL conta, é
  // dinheiro comprometido; e o total é agnóstico ao status, "status nunca mexe
  // em dinheiro"). Uma conta só nas três telas: não podem divergir.
  const { fechado, total, pct } = contaOrcamentoFechado(custosPorStatus(evento.categorias))
  if (!cabeComoDinheiro(total) || !cabeComoDinheiro(fechado)) {
    // "R$ 0 de R$ 100.000…000 mi (0%)" — medido em 05/10/2026.
    linhas.push('', `Orçamento: % fechado ${NUMERO_NAO_CALCULA} — um custo desta festa não cabe numa conta de dinheiro.`)
  } else if (total > 0) {
    linhas.push(
      '',
      `Orçamento: ${fmtCompact(fechado)} de ${fmtCompact(total)} (${pct}%) fechados ou pagos — ${100 - pct}% ainda é estimativa.`
    )
  }

  const pat = patrocinioPorEstagio(evento)
  if (pat.total !== 0) {
    // patrocínio que não cabe (05/10/2026): texto no lugar do número
    let p = `Patrocínio fechado (conta na receita): ${dinOuTexto(pat.fechado, fmtBRL)}`
    if (pat.potencial > 0)
      p += ` · em proposta (não somado): ${cabeComoDinheiro(pat.potencial) ? fmtBRL(pat.potencial) : VALOR_ILEGIVEL}`
    linhas.push(p)
  }

  const premissas = []
  const desconto = premissaDesconto(evento)
  if (desconto) premissas.push(`${desconto} — já aplicado na receita`)
  const taxaTxt = premissaTaxa(evento)
  if (taxaTxt) premissas.push(taxaTxt)
  if (isOpenBar(evento)) premissas.push('evento open bar — sem receita de bar')
  // Bar por pessoa (sugestão 42): a premissa cita ticket e sistema — o
  // resultado (o bar de cada cenário) já está nos números acima.
  const barTxt = premissaBar(evento)
  if (barTxt) premissas.push(barTxt)
  // A premissa do imposto diz sobre O QUE ele incidiu — a linha de números
  // acima mostra só quanto foi. Ver impostoTexto() em imposto.js.
  if (temImposto(c.realista)) premissas.push(`imposto ${impostoTexto(c.realista.imposto)}`)
  if (premissas.length) linhas.push(`Premissas: ${premissas.join(' · ')}.`)

  return linhas.join('\n')
}
