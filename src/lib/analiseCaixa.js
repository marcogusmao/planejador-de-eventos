// Aba Análise — fluxo de caixa do evento (Sessão F2-C, sugestão 15 do
// MELHORIAS.md).
//
// CONTA APROVADA PELO MARCO em 19/07/2026 (palavra por palavra — princípio 1
// do rulebook, fórmula nova só com aval dele):
//
//   Saldo do dia = caixa inicial do evento (campo opcional, padrão R$ 0)
//                + entradas previstas até o dia (curva de vendas, líquida)
//                − saídas com vencimento até o dia (custos com data de
//                  pagamento).
//   Caixa mínimo para iniciar = o menor saldo da linha do tempo.
//   Custos sem data ficam FORA da linha do tempo com aviso de quantos são.
//
// Decisões de implementação registradas para revisão do Marco (anotadas
// também no MELHORIAS.md, sugestão 15):
// - "Curva de vendas, líquida" = a curva do PLANO da F2-B no modo selecionado
//   do evento (forma histórica ou datas dos lotes), que já é líquida de
//   desconto efetivo — a MESMA régua do realizado da Tiqueteira (curvaVendas.js).
//   Taxa de bilheteria e cashback NÃO são descontados da entrada (a curva
//   compara vendas, não DRE); mudar isso é mudança de fórmula = portão do
//   Marco. O rodapé da aba diz exatamente o que entra.
// - Patrocínio FECHADO (confirmado/recebido) entra como entrada NA DATA DO
//   EVENTO (dia 0) — decisão do prompt da sessão ("mantenha simples"), com
//   microtexto na aba.
// - Receita de bar NÃO entra na linha do tempo (chega na festa; a análise
//   responde "vamos ter caixa ATÉ a festa?").
// - Contingência não tem vencimento → fora da linha do tempo (dita no rodapé).
// - Custo com vencimento DEPOIS da festa fica fora da conta pré-festa e é
//   listado à parte com aviso (é pago com o resultado, não com o caixa
//   pré-festa).
// - Parcela conta cada uma no seu dia; parcela sem data conta como custo sem
//   data (aviso, nunca silêncio).
// - Parcela PAGA (sugestão 38 — Interpretação A, aprovada pelo Marco em
//   18/07/2026): fluxo QUITADO — o dinheiro já saiu, então a parcela SAI da
//   linha do tempo "a vencer" (nem saída futura, nem aviso de sem-data) e o
//   caixa fica exato. Ela é listada à parte (`pagas`) para a agenda mostrar
//   "quitada" — nunca some em silêncio. NADA MAIS muda: a fórmula do saldo é
//   a mesma; só QUAIS saídas entram. O `realizado` do custo não é tocado
//   (é do fechamento). Reversível: desmarcar devolve a parcela à linha.
//
// A linha do tempo é em DIAS RELATIVOS à data do evento (negativo = antes,
// 0 = dia da festa), a mesma régua da curva da F2-B.
//
// Tudo aqui é puro e 100% testado em analiseCaixa.test.js — inclusive uma
// CONFERÊNCIA À MÃO de um exemplo completo, documentada no teste.

import { num } from './util.js'
import { STATUS_CUSTO_PADRAO } from './statusCusto.js'
import { patrocinioPorEstagio } from './calc.js'
import { agendaDoItem, divergenciaParcelas, temParcelas } from './parcelas.js'
import { diaRelativoHoje, DIA_INICIO_PADRAO, consolidarPontosDoPlano } from './curvaVendas.js'

// ————— Saídas do evento (leitura pura sobre os custos) —————

/**
 * Todas as saídas previstas do evento, item a item (parcela a parcela quando
 * houver — cada uma no seu dia). Devolve:
 * - saidas: [{ itemId, rotulo, categoria, valor, data, parcela, status }]
 *   (só quem tem DATA e NÃO está pago; valor = parcela ou valorConsiderado)
 * - semData: idem, para quem NÃO tem data (ficam fora da linha do tempo,
 *   com aviso de quantos são — conta aprovada)
 * - pagas: idem + { dataPaga }, para PARCELAS PAGAS (sugestão 38): fluxo
 *   quitado — fora da linha do tempo E fora do aviso de sem-data (quitada
 *   não "deve" data), listadas para a agenda mostrar, nunca silêncio
 * - divergencias: [{ rotulo, soma, valor, diferenca }] — custos cuja soma de
 *   parcelas não bate com o valor (o aviso vermelho também aparece aqui:
 *   a agenda usa os valores das parcelas, e o Marco precisa saber; parcela
 *   paga CONTINUA somando na trava — pagar não muda o combinado)
 * Saída de valor 0 não existe (nem custo zerado nem parcela zerada).
 */
export function saidasDoEvento(evento) {
  const saidas = []
  const semData = []
  const pagas = []
  const divergencias = []
  for (const cat of evento?.categorias || []) {
    for (const item of cat.itens || []) {
      const d = divergenciaParcelas(item)
      if (d) divergencias.push({ rotulo: item.servico || cat.nome, ...d })
      for (const pag of agendaDoItem(item)) {
        if (num(pag.valor) <= 0) continue
        const saida = {
          itemId: item.id,
          rotulo: item.servico || cat.nome,
          categoria: cat.nome,
          valor: num(pag.valor),
          data: pag.data,
          parcela: pag.parcela,
          status: item.status || STATUS_CUSTO_PADRAO,
        }
        if (pag.paga) pagas.push({ ...saida, dataPaga: pag.dataPaga })
        else if (pag.data) saidas.push(saida)
        else semData.push(saida)
      }
    }
  }
  return { saidas, semData, pagas, divergencias }
}

// ————— Entradas: acumulado da curva do plano até um dia —————

/**
 * Valor acumulado da curva do plano até um dia relativo (inclusive), com
 * interpolação LINEAR entre pontos (o modo "pelas datas" tem pontos
 * esparsos; a reta entre marcos é a leitura do próprio gráfico da F2-B).
 * Antes do primeiro ponto = 0 (nada previsto vendido ainda); depois do
 * último = o último valor (a curva do plano termina no dia da festa).
 */
export function entradaAteODia(pontos, dia) {
  if (!Array.isArray(pontos) || pontos.length === 0) return 0
  pontos = consolidarPontosDoPlano(pontos)
  if (dia < pontos[0].dia) return 0
  for (let i = 0; i < pontos.length; i++) {
    if (pontos[i].dia === dia) return num(pontos[i].valor)
    if (pontos[i].dia > dia) {
      const a = pontos[i - 1]
      const b = pontos[i]
      const frac = (dia - a.dia) / (b.dia - a.dia)
      return num(a.valor) + (num(b.valor) - num(a.valor)) * frac
    }
  }
  return num(pontos[pontos.length - 1].valor)
}

// ————— A linha do tempo (a conta aprovada, dia a dia) —————

/**
 * Monta a análise completa do caixa do evento.
 *
 * @param evento       o evento (data, caixaInicial, patrocinios, custos)
 * @param pontosPlano  curva do plano da F2-B [{ dia, valor }] (acumulada,
 *                     líquida) — obrigatória: sem ela não há entrada prevista
 * @returns { ok:false, motivo } quando falta o essencial, senão
 * { ok:true, dias, caixaMinimo, primeiroNegativo, saldoFesta, agenda,
 *   posFesta, semData, pagas, divergencias, caixaInicial, patrocinioFechado,
 *   totalEntradas, totalSaidas }
 */
export function analisarCaixa(evento, pontosPlano) {
  if (!evento?.data) return { ok: false, motivo: 'sem-data-evento' }
  if (!Array.isArray(pontosPlano) || pontosPlano.length === 0)
    return { ok: false, motivo: 'sem-plano' }

  const caixaInicial = num(evento.caixaInicial)
  const patrocinioFechado = patrocinioPorEstagio(evento).fechado
  const { saidas, semData, pagas, divergencias } = saidasDoEvento(evento)

  // Data → dia relativo à festa; data ilegível não derruba a análise: o item
  // vai para "sem data" (nunca some em silêncio).
  const comDia = []
  const semDataTotal = [...semData]
  for (const s of saidas) {
    const dia = diaRelativoHoje(evento.data, s.data)
    if (dia == null) semDataTotal.push(s)
    else comDia.push({ ...s, dia })
  }

  const posFesta = comDia.filter((s) => s.dia > 0)
  const noPrazo = comDia.filter((s) => s.dia <= 0)

  const diaInicio = Math.min(
    DIA_INICIO_PADRAO,
    pontosPlano[0].dia,
    ...noPrazo.map((s) => s.dia)
  )

  // Saídas acumuladas por dia (soma direta — sem interpolação: boleto conta
  // no dia do boleto).
  const saidaNoDia = new Map()
  for (const s of noPrazo) saidaNoDia.set(s.dia, (saidaNoDia.get(s.dia) || 0) + s.valor)

  const dias = []
  let saidaAcum = 0
  for (let dia = diaInicio; dia <= 0; dia++) {
    saidaAcum += saidaNoDia.get(dia) || 0
    // A CONTA APROVADA: caixa inicial + entradas até o dia − saídas até o dia.
    // Patrocínio fechado entra na data do evento (dia 0).
    const entrada = entradaAteODia(pontosPlano, dia) + (dia >= 0 ? patrocinioFechado : 0)
    dias.push({ dia, entrada, saida: saidaAcum, saldo: caixaInicial + entrada - saidaAcum })
  }

  // Caixa mínimo para iniciar = o menor saldo da linha do tempo (conta
  // aprovada). Empate fica no PRIMEIRO dia (o aperto mais cedo).
  let caixaMinimo = dias[0]
  for (const d of dias) if (d.saldo < caixaMinimo.saldo) caixaMinimo = d
  const primeiroNegativo = dias.find((d) => d.saldo < 0) || null
  const saldoFesta = dias[dias.length - 1].saldo

  // Agenda de pagamentos: cada vencimento com o saldo do dia dele.
  const porDia = new Map(dias.map((d) => [d.dia, d]))
  const agenda = [...noPrazo]
    .sort((a, b) => a.dia - b.dia || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
    .map((s) => ({ ...s, saldoNoDia: porDia.get(s.dia)?.saldo ?? null }))

  return {
    ok: true,
    dias,
    caixaMinimo: { dia: caixaMinimo.dia, saldo: caixaMinimo.saldo },
    primeiroNegativo: primeiroNegativo
      ? { dia: primeiroNegativo.dia, saldo: primeiroNegativo.saldo }
      : null,
    saldoFesta,
    agenda,
    posFesta: [...posFesta].sort((a, b) => a.dia - b.dia),
    semData: semDataTotal,
    // Quitadas (sugestão 38): fora da linha do tempo, mostradas à parte —
    // ordenadas pela data efetiva de pagamento (sem data efetiva, no fim).
    pagas: [...pagas].sort(
      (a, b) =>
        (a.dataPaga || '9999').localeCompare(b.dataPaga || '9999') ||
        a.rotulo.localeCompare(b.rotulo, 'pt-BR')
    ),
    divergencias,
    caixaInicial,
    patrocinioFechado,
    totalEntradas: dias[dias.length - 1].entrada,
    totalSaidas: dias[dias.length - 1].saida,
  }
}

/** true quando algum custo do evento já tem agenda (data ou parcelas) — para a
 *  tela vazia da aba ensinar o próximo passo certo. */
export function temAgendaDePagamento(evento) {
  return (evento?.categorias || []).some((c) =>
    (c.itens || []).some((i) => i.dataPagamento || temParcelas(i))
  )
}
