// Teste GOLDEN das fórmulas (Sessão A / sugestão 13b do MELHORIAS.md).
//
// Um evento fixo de teste com TODOS os resultados de computeCenarios (DRE,
// break-even, contingência, cenários) gravados literalmente abaixo, com a
// precisão exata de ponto flutuante que o código produz hoje.
//
// Se este teste falhar, uma fórmula mudou — por menor que seja o desvio.
// Regra do CLAUDE.md (princípio 1): fórmulas são sagradas. NÃO regrave o
// golden para "fazer o teste passar"; pare e mostre ao Marco a conta certa
// × errada. O golden só é regravado depois de uma mudança de fórmula
// explicitamente aprovada.
//
// O evento não é uma festa real — foi montado para passar por todos os
// caminhos do cálculo: lotes pagos com % de venda (90/70), cortesia inteira
// em todos os cenários, lote só-otimista, override manual de quantidade
// (l3: 371 no realista), ajuste de ticket (−5% no pessimista, que recalcula
// taxa e cashback), custos com realizado > 0 (vence o estimado), realizado 0
// e '' (vale o estimado), centavos, contingência 10% e ajuste de custo
// +10%/−5%.
//
// MUDANÇA DE FÓRMULA — Sessão N, 18/07/2026 (a primeira do plano, sugestão
// 17 do MELHORIAS.md, aprovada pelo Marco palavra por palavra):
//   receita de bilheteria prevista = (lotes × preço) × (1 − desconto médio)
// Campo `descontoMedioPct` vazio/ausente/0 = conta EXATAMENTE igual à
// anterior — por isso a fotografia GOLDEN original abaixo continua valendo
// INALTERADA (nenhum número foi regravado). O caso novo COM desconto de 12%
// ganhou fotografia própria (GOLDEN_DESCONTO_12, no fim do arquivo).
//
// Sessão P, 18→19/07/2026 (sugestão 19 do MELHORIAS.md, extensão simétrica
// aprovada pelo Marco): realista ganhou custoPct (default 0 = conta de
// sempre) e otimista ganhou vendaPct (default 100 = esgota tudo = conta de
// sempre). NENHUM número das fotografias foi regravado — o evento golden não
// tem os campos novos e cai nos defaults; a prova está no describe "grade
// completa" no fim do arquivo + fotografias byte a byte pré/pós da sessão.
//
// ════════════════════════════════════════════════════════════════════════
// REGRAVAÇÃO DO BREAK-EVEN — 27/07/2026
//
// APROVAÇÃO: o Marco viu o diff completo dos valores antigos × novos e
// aprovou em 27/07/2026 (princípio 8 do CLAUDE.md — o portão do golden). Foi
// decisão dele, por questionário, registrada no BACKLOG.md.
//
// A DECISÃO, EM UMA FRASE: break-even é "a quantidade MÍNIMA de ingressos que
// eu preciso vender para não dar prejuízo" — medida arrastando o MESMO slider
// de % de venda que ele arrasta na tela, e não por uma divisão.
//
// O QUE MUDOU DE RÉGUA. A conta antiga era
//     teto((custoTotal − bar − patrocínio) ÷ ticket médio líquido do cenário)
// e ela tem dois defeitos que esta regravação mata:
//   1. CIRCULARIDADE quando o bar é POR PESSOA — ela abatia do custo o bar da
//      casa CHEIA e logo depois perguntava quantos ingressos faltavam para
//      encher a casa. É onde os desvios são brutais (ver "bar em dois modos"
//      no fim do arquivo: 24 ingressos onde a resposta é 478).
//   2. TICKET MÉDIO CONGELADO — ela dividia pelo ticket médio do cenário
//      CHEIO, mas o ticket médio muda conforme o slider anda, porque a MISTURA
//      de lotes muda. No evento golden isso é visível: o override manual de
//      l3 (371 ingressos, fixo) não responde ao slider, então vendendo menos a
//      mistura fica mais CARA e faltam menos ingressos.
// A régua nova recalcula o cenário INTEIRO em cada ponto do slider (mesmo
// desconto, mesma taxa, mesmo cashback, mesmo bar, mesmos overrides) e devolve
// o menor número de ingressos pagos com lucro >= 0.
//
// E A CHAVE NOVA `breakEvenNaoFecha`: quando NEM vendendo 100% de cada lote o
// lucro chega a zero, não existe número de ingressos que sirva de meta. A
// conta antiga imprimia um mesmo assim — 1.037 ingressos numa festa com 1.000
// à venda (ver GOLDEN_DESCONTO_12, pessimista). Agora o cenário devolve
// `breakEven: null` + `breakEvenNaoFecha: true`, e as telas escrevem a frase
// em vez de um número impossível.
//
// COMO CADA VALOR NOVO FOI OBTIDO: nenhum foi copiado do "Received" do vitest.
// Cada um foi recalculado por um oráculo independente — varredura do slider
// pelo caminho PÚBLICO (`computeCenario` com o vendaPct trocado no
// `cenariosConfig`), sem olhar a busca — e os dois bateram. Ao lado de cada
// número regravado está o motivo dele. A prova da DEFINIÇÃO (no break-even o
// lucro é >= 0; um ingresso a menos é prejuízo) mora em breakEven.test.js, em
// cinco eventos; aqui ela aparece nos casos derivados, com os pontos do slider
// medidos e escritos.
// ════════════════════════════════════════════════════════════════════════
//
// Sessão O, 18→19/07/2026 (sugestão 22 do MELHORIAS.md, aprovada pelo Marco:
// só patrocínio FECHADO conta na receita): computeCenario passou a devolver o
// campo DERIVADO novo `patrocinioPotencial` (soma das propostas, fora da
// conta). O evento golden não tem a lista de patrocínios → número solto conta
// inteiro como sempre e o potencial é 0. NENHUM número das fotografias foi
// regravado — a única edição da Sessão O foi acrescentar a linha
// `patrocinioPotencial: 0` em cada cenário (provado no diff do commit; a
// preservação completa está em patrocinio.test.js e nas fotografias byte a
// byte da sessão).
//
// ════════════════════════════════════════════════════════════════════════
// REGRAVAÇÃO DOS CENTAVOS — 07/10/2026
//
// APROVAÇÃO: o Marco viu a tabela de valores antigos × novos em português
// (scripts/provas-centavos/diff-aprovacao.mjs) e aprovou por questionário em
// 07/10/2026 — princípio 8 do CLAUDE.md; registro datado na ficha "S3 —
// Receita total pode diferir em R$ 0,01" do BACKLOG.md.
//
// A RÉGUA: cada parcela em R$ (receita de lote, taxa, cashback, contingência,
// ajuste do cenário, imposto, bar por pessoa) vira centavos inteiros no ponto
// em que nasce, meio centavo para LONGE do zero; todo total é a soma das
// parcelas já arredondadas (util.js). Nenhum valor desta fotografia muda o
// real inteiro que o DRE imprime, nenhum mínimo de ingressos muda, e o que
// muda com centavos é sempre para a coluna FECHAR — exemplo, realista sem
// cupom: R$ 85.243,90 − R$ 8.524,39 + R$ 4.262,20 = R$ 80.981,71, e a
// líquida impressa era R$ 80.981,70.
//
// Onde esta fotografia guardava um resto de ponto flutuante (62084.399999999994,
// 33831.32000000001), hoje ela guarda o centavo exato. As asserções que
// refaziam a conta com `+` e `−` crus passaram a refazê-la com
// `somaEmCentavos`, que é a régua do motor.
// ════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { computeCenarios, veredito } from './calc.js'
import { resultadoRealizado } from './fechamento.js'
import { somaEmCentavos, emCentavos } from './util.js'

const eventoGolden = () => ({
  nome: 'Evento Golden (fixo — não é festa real)',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 40000, patrocinio: 12500.5 },
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 70, quantidade: 250 },
    { id: 'l2', nome: '2º lote', valor: 90, quantidade: 350 },
    { id: 'l3', nome: '3º lote', valor: 110.9, quantidade: 400 },
    { id: 'porta', nome: 'Lote Porta', valor: 130, quantidade: 100, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesias', valor: 0, quantidade: 80 },
  ],
  categorias: [
    {
      id: 'atracoes',
      nome: 'Atrações',
      itens: [
        { nome: 'DJ principal', estimado: 15000, realizado: 14000 },
        { nome: 'DJs locais', estimado: 6000, realizado: 0 },
      ],
    },
    {
      id: 'estrutura',
      nome: 'Estrutura',
      itens: [
        { nome: 'Som e luz', estimado: 18000.75, realizado: '' },
        { nome: 'Palco', estimado: 12000 },
      ],
    },
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { nome: 'Insumos do bar', estimado: 25000 },
        { nome: 'Gelo', estimado: 3000, realizado: 3218.43 },
      ],
    },
    { id: 'equipe', nome: 'Equipe', itens: [{ nome: 'Staff', estimado: 21500 }] },
    {
      id: 'marketing',
      nome: 'Marketing',
      itens: [
        { nome: 'Tráfego pago', estimado: 6000 },
        { nome: 'Design', estimado: 1500, realizado: 1200 },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10, ticketPct: -5 },
    realista: { vendaPct: 90 },
    otimista: { custoPct: -5 },
    overrides: { pessimista: {}, realista: { l3: 371 }, otimista: {} },
  },
})

// Fotografia dos resultados, gerada rodando computeCenarios(eventoGolden())
// em 17/07/2026 (Sessão A). Algumas conferências de mão, para leitura humana:
// - custoItens (considerado) = 20.000 + 30.000,75 + 28.218,43 + 21.500 + 7.200
//   = 106.919,18 (realizado vence quando > 0; 0 e '' caem no estimado)
// - contingência 10% = 10.691,918 → 10.691,92 (régua do centavo, 07/10/2026)
//   → custo base 117.611,10
// - realista: cashback 5% de 85.243,90 = 4.262,195 → 4.262,20; líquida
//   85.243,90 − 8.524,39 + 4.262,20 = 80.981,71; receita 80.981,71 + 40.000
//   (bar) + 12.500,50 (patrocínio) = 133.482,21 → lucro 15.871,11
// - otimista: ajuste −5% sobre 117.611,10 = −5.880,555 → −5.880,56 (meio
//   centavo para longe do zero) → custo 111.730,54
// - pessimista: ticket médio automático × 0,95, receita = 700 pagos × ticket,
//   taxa 10% e cashback 5% recalculados; custo × 1,10
// - otimista: todos os lotes esgotados + porta; custo × 0,95
const GOLDEN = {
  pessimista: {
    cenario: 'pessimista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 175, receita: 12250, acumulada: 12250 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 245, receita: 22050, acumulada: 34300 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 280, receita: 31052, acumulada: 65352 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 0, receita: 0, acumulada: 65352 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 65352 },
    ],
    bruta: 62084.4,
    taxa: 6208.44,
    cashback: 3104.22,
    liquida: 58980.18,
    pagos: 700,
    cortesias: 80,
    publico: 780,
    ticketMedio: 88.692,
    ticketMedioLiquido: 84.2574,
    ticketMedioManual: false,
    ticketAjustePct: -5,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 111480.68,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: 10,
    custoTotal: 129372.21,
    lucro: -17891.53,
    margem: -16.048996113048467,
    // 913 — NÃO MUDOU com a régua nova (a antiga também dava 913). O
    // pessimista não tem override de lote: cada lote anda proporcionalmente
    // com o slider, a mistura é a mesma em qualquer ponto e o ticket médio
    // líquido também. Sem circularidade (bar fixo) e sem mistura mudando, as
    // duas réguas coincidem. Ponto do slider: 91,286% → 913 pagos, lucro
    // +R$ 56,04; em 91,125% são 912 pagos e o lucro é −R$ 25,19.
    breakEven: 913,
    breakEvenNaoFecha: false,
    custoPorPessoa: 165.8618076923077,
  },
  realista: {
    cenario: 'realista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 225, receita: 15750, acumulada: 15750 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 315, receita: 28350, acumulada: 44100 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 371, receita: 41143.9, acumulada: 85243.9 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 0, receita: 0, acumulada: 85243.9 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 85243.9 },
    ],
    bruta: 85243.9,
    taxa: 8524.39,
    cashback: 4262.2,
    liquida: 80981.71,
    pagos: 911,
    cortesias: 80,
    publico: 991,
    ticketMedio: 93.57178924259055,
    ticketMedioLiquido: 88.89320526893525,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 133482.21,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: 0,
    custoTotal: 117611.1,
    lucro: 15871.11,
    margem: 11.890056360319477,
    // 733 → 707. REGRAVADO. O bar aqui é FIXO (R$ 40.000), então a
    // circularidade não entra: a diferença é inteirinha da MISTURA DE LOTES.
    // O realista tem override manual em l3 (371 ingressos), e override não
    // responde ao slider — vendendo menos, os 371 ingressos de R$ 110,90
    // pesam mais no bolo e o ticket médio líquido SOBE. A conta antiga
    // dividia pelo ticket do cenário cheio, R$ 88,8932, e pedia 733; no ponto
    // de empate de verdade (55,858% do slider, 707 pagos) o ticket médio
    // líquido é R$ 92,1566 e o lucro fica em +R$ 44,11. Um degrau abaixo
    // (55,8% → 706 pagos) o lucro é −R$ 41,39: 707 é mesmo o mínimo.
    breakEven: 707,
    breakEvenNaoFecha: false,
    custoPorPessoa: 118.67921291624623,
  },
  otimista: {
    cenario: 'otimista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 250, receita: 17500, acumulada: 17500 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 350, receita: 31500, acumulada: 49000 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 400, receita: 44360, acumulada: 93360 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 100, receita: 13000, acumulada: 106360 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 106360 },
    ],
    bruta: 106360,
    taxa: 10636,
    cashback: 5318,
    liquida: 101042,
    pagos: 1100,
    cortesias: 80,
    publico: 1180,
    ticketMedio: 96.69090909090909,
    ticketMedioLiquido: 91.85636363636364,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 153542.5,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: -5,
    custoTotal: 111730.54,
    lucro: 41811.96,
    margem: 27.231522216975755,
    // 645 — NÃO MUDOU, pelo mesmo motivo do pessimista: sem override, a
    // mistura de lotes é proporcional em todo o slider e o ticket médio
    // líquido não anda. Ponto do slider: 58,6% → 645 pagos, lucro +R$ 12,53;
    // em 58,5% são 644 pagos e o lucro é −R$ 53,97.
    breakEven: 645,
    breakEvenNaoFecha: false,
    custoPorPessoa: 94.68689830508474,
  },
}

describe('golden das fórmulas — evento fixo, resultados fotografados', () => {
  it('computeCenarios bate byte a byte com a fotografia (qualquer desvio = fórmula mudou)', () => {
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
  })

  it('o evento golden não é mutado pelo cálculo', () => {
    const ev = eventoGolden()
    computeCenarios(ev)
    expect(ev).toStrictEqual(eventoGolden())
  })
})

// ------------------------------------------------------------- sugestão 17
// Fotografia do MESMO evento golden com descontoMedioPct: 12, gerada rodando
// computeCenarios em 18/07/2026 (Sessão N), após a aprovação da fórmula pelo
// Marco. Conferências de mão:
// - otimista: bruta 106.360 (tabela) × 0,88 = 93.596,80 — exato
// - realista: l3 = 371 × 110,9 × 0,88 = 36.206,632 → 36.206,63; bruta
//   75.014,63; taxa 10% = 7.501,463 → 7.501,46; cashback 5% = 3.750,7315 →
//   3.750,73; líquida 71.263,90; lucro 123.764,40 − 117.611,10 = 6.153,30
//   (régua do centavo, 07/10/2026 — os números de 18/07 e 25/07 ficam no
//   histórico do git)
// - pessimista: ticket 88,692 × 0,88 = 78,04896 (ajuste −5% já embutido)
// - custos NÃO mudam com o desconto: custoItens/contingência/custoTotal
//   idênticos aos do GOLDEN original
// - break-even realista sobe 707 → 822 por causa do cupom (ticket líquido
//   menor exige mais ingressos). Os dois números são da régua de 27/07/2026;
//   a frase que estava aqui dizia "733 → 833", que eram os valores da conta
//   antiga (ver o bloco da regravação no topo do arquivo).
//
// REGRAVADA em 25/07/2026 (achado do BACKLOG "a soma de ponto flutuante não
// é associativa"; conta aprovada pelo Marco com a tabela antigo × novo na
// mesa — ver APROVADO-PELO-MARCO no commit): `bilheteria()` passou a
// quantizar cada receita de lote a centavos ANTES de acumular `bruta`/
// `acumulada` (soma de inteiros, associativa e exata — reordenar lotes deixa
// de mudar o último dígito). Só o cenário REALISTA muda de valor visível: a
// soma direta 13.860 + 24.948 + 36.206,632 caía em 75.014,632 (bruta antiga,
// com o resíduo de ponto flutuante citado acima); quantizada a centavos vira
// 75.014,63 exato — 0,002 menor. Daí em cascata: taxa 7.501,463 (−0,0002),
// cashback 3.750,7315 (−0,0001), líquida 71.263,8985 (−0,0019), receitaTotal
// 123.764,3985 (−0,0019), lucro 6.153,3005 (−0,0019), ticketMedio
// 82,343172… e ticketMedioLiquido 78,226014… (variam no 6º decimal) — 9
// valores, nenhum muda o real inteiro exibido na tela. Otimista (lotes já em
// centavos exatos) e pessimista (visível) ficam byte a byte iguais; o
// pessimista só troca o resíduo de ponto flutuante da casa do 1e-11 por
// outro resíduo da mesma ordem (a soma em centavos ainda passa por uma
// divisão de ponto flutuante no fim). custos e break-even continuam
// idênticos.
const GOLDEN_DESCONTO_12 = {
  pessimista: {
    cenario: 'pessimista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 175, receita: 10780, acumulada: 10780 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 245, receita: 19404, acumulada: 30184 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 280, receita: 27325.76, acumulada: 57509.76 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 0, receita: 0, acumulada: 57509.76 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 57509.76 },
    ],
    bruta: 54634.27,
    taxa: 5463.43,
    cashback: 2731.71,
    liquida: 51902.55,
    pagos: 700,
    cortesias: 80,
    publico: 780,
    ticketMedio: 78.04896,
    ticketMedioLiquido: 74.1465,
    ticketMedioManual: false,
    ticketAjustePct: -5,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 104403.05,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: 10,
    custoTotal: 129372.21,
    lucro: -24969.16,
    margem: -23.91612122442783,
    // 1.037 → null, com o aviso ligado. REGRAVADO, e este é O caso que a
    // mudança existe para matar: no pessimista há 1.000 ingressos à venda
    // (250 + 350 + 400; o Lote Porta só existe no otimista), e mesmo
    // arrastando o slider até 100% o lucro para em −R$ 2.725,20. Não existe
    // número de ingressos que empate esta festa — e a conta antiga imprimia
    // "1.037 ingressos pagos", 37 a mais do que existem, com cara de meta.
    breakEven: null,
    breakEvenNaoFecha: true,
    custoPorPessoa: 165.8618076923077,
  },
  realista: {
    cenario: 'realista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 225, receita: 13860, acumulada: 13860 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 315, receita: 24948, acumulada: 38808 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 371, receita: 36206.63, acumulada: 75014.63 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 0, receita: 0, acumulada: 75014.63 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 75014.63 },
    ],
    bruta: 75014.63,
    taxa: 7501.46,
    cashback: 3750.73,
    liquida: 71263.9,
    pagos: 911,
    cortesias: 80,
    publico: 991,
    ticketMedio: 82.34317233809001,
    ticketMedioLiquido: 78.22601536772777,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 123764.4,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: 0,
    custoTotal: 117611.1,
    lucro: 6153.3,
    margem: 4.971785101370023,
    // 833 → 822. REGRAVADO pelo MESMO motivo do realista sem cupom: o
    // override de l3 (371 fixos) não anda com o slider, então no ponto de
    // empate (75% → 822 pagos, lucro +R$ 75,58) a mistura é mais cara que a
    // do cenário cheio, de onde saía o ticket de R$ 78,2260 da conta antiga.
    // Em 74,715% são 820 pagos e o lucro é −R$ 58,18 (o degrau daqui pula de
    // dois em dois ingressos — l1 e l2 viram juntos).
    breakEven: 822,
    breakEvenNaoFecha: false,
    custoPorPessoa: 118.67921291624623,
  },
  otimista: {
    cenario: 'otimista',
    porLote: [
      { id: 'l1', nome: '1º lote', valor: 70, qtd: 250, receita: 15400, acumulada: 15400 },
      { id: 'l2', nome: '2º lote', valor: 90, qtd: 350, receita: 27720, acumulada: 43120 },
      { id: 'l3', nome: '3º lote', valor: 110.9, qtd: 400, receita: 39036.8, acumulada: 82156.8 },
      { id: 'porta', nome: 'Lote Porta', valor: 130, qtd: 100, receita: 11440, acumulada: 93596.8 },
      { id: 'cort', nome: 'Cortesias', valor: 0, qtd: 80, receita: 0, acumulada: 93596.8 },
    ],
    bruta: 93596.8,
    taxa: 9359.68,
    cashback: 4679.84,
    liquida: 88916.96,
    pagos: 1100,
    cortesias: 80,
    publico: 1180,
    ticketMedio: 85.08800000000001,
    ticketMedioLiquido: 80.8336,
    bar: 40000,
    patrocinio: 12500.5,
    patrocinioPotencial: 0,
    receitaTotal: 141417.46,
    custosCategorias: [
      { id: 'atracoes', nome: 'Atrações', estimado: 21000, realizado: 14000, considerado: 20000 },
      { id: 'estrutura', nome: 'Estrutura', estimado: 30000.75, realizado: 0, considerado: 30000.75 },
      { id: 'aeb', nome: 'A&B', estimado: 28000, realizado: 3218.43, considerado: 28218.43 },
      { id: 'equipe', nome: 'Equipe', estimado: 21500, realizado: 0, considerado: 21500 },
      { id: 'marketing', nome: 'Marketing', estimado: 7500, realizado: 1200, considerado: 7200 },
    ],
    custoItens: 106919.18,
    contingencia: 10691.92,
    ajustePct: -5,
    custoTotal: 111730.54,
    lucro: 29686.92,
    margem: 20.992400796903013,
    // 733 — NÃO MUDOU (a régua antiga também dava 733 aqui; é coincidência de
    // valor com o realista SEM cupom da fotografia original, não a mesma
    // conta). Sem override no otimista, a mistura é proporcional em todo o
    // slider: 66,6% → 733 pagos, lucro +R$ 16,77; 66,5% → 732, −R$ 41,75.
    breakEven: 733,
    breakEvenNaoFecha: false,
    custoPorPessoa: 94.68689830508474,
  },
}

describe('golden com desconto médio (sugestão 17 — fórmula aprovada em 18/07/2026)', () => {
  it('evento golden SEM o campo (e com "" ou 0) bate byte a byte com a fotografia ORIGINAL', () => {
    // A prova de que a mudança de fórmula não moveu um centavo de nenhum
    // evento existente: os três caminhos "sem desconto" caem na fotografia
    // antiga, inalterada.
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), descontoMedioPct: '' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), descontoMedioPct: 0 })).toStrictEqual(GOLDEN)
  })

  it('com 12% de desconto, bate byte a byte com a fotografia GOLDEN_DESCONTO_12', () => {
    expect(computeCenarios({ ...eventoGolden(), descontoMedioPct: 12 })).toStrictEqual(
      GOLDEN_DESCONTO_12
    )
  })
})

// ------------------------------------------------------------- sugestão 19
// Grade completa dos 3 cenários (Sessão P, 18→19/07/2026 — extensão simétrica
// aprovada pelo Marco): realista.custoPct (default 0) e otimista.vendaPct
// (default 100). A prova de preservação usa a PRÓPRIA fotografia original:
// os defaults e os neutros explícitos caem byte a byte no GOLDEN, e a
// simetria é conferida contra o cenário vizinho que sempre teve o campo.
describe('grade completa dos cenários (sugestão 19 — extensão simétrica aprovada em 18/07/2026)', () => {
  const comCfg = (patch) => {
    const ev = eventoGolden()
    ev.cenariosConfig = {
      ...ev.cenariosConfig,
      realista: { ...ev.cenariosConfig.realista, ...(patch.realista || {}) },
      otimista: { ...ev.cenariosConfig.otimista, ...(patch.otimista || {}) },
    }
    return ev
  }

  it('campos novos ausentes — e neutros explícitos (custoPct 0/"", vendaPct 100) — batem byte a byte com a fotografia ORIGINAL', () => {
    expect(
      computeCenarios(comCfg({ realista: { custoPct: 0 }, otimista: { vendaPct: 100 } }))
    ).toStrictEqual(GOLDEN)
    expect(computeCenarios(comCfg({ realista: { custoPct: '' } }))).toStrictEqual(GOLDEN)
  })

  it('simetria: realista com custoPct 10 tem o MESMO custoTotal da fotografia do pessimista (que sempre usou 10)', () => {
    const r = computeCenarios(comCfg({ realista: { custoPct: 10 } })).realista
    expect(r.ajustePct).toBe(10)
    expect(r.custoTotal).toBe(GOLDEN.pessimista.custoTotal) // 129.372,2078
    expect(r.receitaTotal).toBe(GOLDEN.realista.receitaTotal) // receita não muda com ajuste de custos
  })

  it('simetria: otimista com vendaPct 70 aplica a conta do pessimista lote a lote — incluindo o Lote Porta; cortesia inteira', () => {
    const o = computeCenarios(comCfg({ otimista: { vendaPct: 70 } })).otimista
    expect(o.porLote.map((l) => [l.id, l.qtd])).toEqual([
      ['l1', 175], // como na fotografia do pessimista (70%)
      ['l2', 245],
      ['l3', 280],
      ['porta', 70], // o porta só existe aqui: round(100 × 70%)
      ['cort', 80], // cortesia inteira em todos os cenários
    ])
  })
})

// --------------------------------------------------------- régua do slider
//
// Desde 27/07/2026 o break-even NÃO é uma divisão que se possa repetir numa
// linha de teste. Onde este arquivo antes reimplementava a fórmula — e a
// cópia envelheceu junto com a original —, agora há isto: UM PONTO DO SLIDER,
// recalculado pelo caminho PÚBLICO (`computeCenarios` com o `vendaPct` do
// cenário trocado, exatamente o que a tela faz quando o Marco arrasta).
//
// Os percentuais que aparecem nos testes abaixo foram MEDIDOS e estão escritos
// como o que são: ENTRADA. O que cada teste afirma são os ingressos pagos e o
// sinal do lucro que saem deles — nenhuma conta de negócio é refeita aqui.
const noSlider = (evento, cenario, pct) =>
  computeCenarios({
    ...evento,
    cenariosConfig: {
      ...(evento.cenariosConfig || {}),
      [cenario]: { ...(evento.cenariosConfig?.[cenario] || {}), vendaPct: pct },
    },
  })[cenario]

// ------------------------------------------------------------- sugestão 27
// Open bar (Sessão Q, 18→19/07/2026 — regra do Marco: marcado → receita de
// bar = 0; fechamento não cobra bar realizado). A checagem é ESTRITA
// (openBar === true): campo ausente, false ou qualquer outro valor cai byte a
// byte na fotografia original — nenhum evento existente muda.
describe('open bar (sugestão 27 — regra do Marco, 18/07/2026)', () => {
  it('campo ausente/false/valor "torto" (nunca === true) batem byte a byte com a fotografia ORIGINAL', () => {
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), openBar: false })).toStrictEqual(GOLDEN)
    // valores "tortos" de backup editado à mão NUNCA zeram receita sozinhos
    expect(computeCenarios({ ...eventoGolden(), openBar: 'true' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), openBar: 1 })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), openBar: null })).toStrictEqual(GOLDEN)
  })

  it('openBar: true zera SÓ o bar — bilheteria e custos intocados; receita e lucro se movem exatamente pelo bar', () => {
    const c = computeCenarios({ ...eventoGolden(), openBar: true })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const g = GOLDEN[k]
      expect(c[k].bar).toBe(0)
      // bilheteria e patrocínio não mudam
      expect(c[k].bruta).toBe(g.bruta)
      expect(c[k].liquida).toBe(g.liquida)
      expect(c[k].patrocinio).toBe(g.patrocinio)
      // custo NÃO muda sozinho (regra do Marco: custo de bar é dos Custos)
      expect(c[k].custoItens).toBe(g.custoItens)
      expect(c[k].custoTotal).toBe(g.custoTotal)
      // receita/lucro: a MESMA ordem de operações de computeCenario, com bar 0
      expect(c[k].receitaTotal).toBe(somaEmCentavos([g.liquida, 0, g.patrocinio]))
      expect(c[k].lucro).toBe(somaEmCentavos([g.liquida, 0, g.patrocinio, -g.custoTotal]))
    }
  })

  // O break-even do open bar saiu do teste acima e ganhou este, porque a
  // asserção antiga era a FÓRMULA VELHA reescrita à mão
  // (ceil((custoTotal − patrocínio) ÷ ticket médio líquido)) e ela envelheceu
  // junto com a de calc.js: dava 1.388 · 1.183 · 1.081, e os dois primeiros
  // são metas que o slider não alcança em cenário nenhum.
  it('openBar: true e o break-even — sem a receita do bar, DOIS dos três cenários deixam de fechar', () => {
    const ev = { ...eventoGolden(), openBar: true }
    const c = computeCenarios(ev)

    // pessimista e realista: nem arrastando o slider até o fim. E "o fim" é
    // menos ingresso do que parece — o pessimista tem 1.000 à venda (o Lote
    // Porta só existe no otimista) e o realista 971, porque o override trava
    // l3 em 371. A conta antiga pedia 1.388 e 1.183: metas impossíveis
    // impressas com cara de meta, que é o defeito que a régua nova mata.
    for (const k of ['pessimista', 'realista']) {
      expect(c[k].breakEven).toBeNull()
      expect(c[k].breakEvenNaoFecha).toBe(true)
      expect(noSlider(ev, k, 100).lucro).toBeLessThan(0)
    }
    expect(noSlider(ev, 'pessimista', 100).pagos).toBe(1000)
    expect(noSlider(ev, 'realista', 100).pagos).toBe(971)

    // otimista: fecha, e em 1.081 — o MESMO número da conta antiga, porque
    // sem bar não há circularidade e sem override a mistura de lotes não muda
    // com o slider. Coincidir aqui é o resultado esperado, não sorte.
    expect(c.otimista.breakEven).toBe(1081)
    expect(c.otimista.breakEvenNaoFecha).toBe(false)
    const empate = noSlider(ev, 'otimista', 98.2)
    expect(empate.pagos).toBe(1081)
    expect(empate.lucro).toBeGreaterThanOrEqual(0)
    const umAMenos = noSlider(ev, 'otimista', 98.143)
    expect(umAMenos.pagos).toBe(1080)
    expect(umAMenos.lucro).toBeLessThan(0)
  })
})

// ------------------------------------------------------------- sugestão 29a
// Desconto parcial em dois modos (Sessão F2-R, 19/07/2026 — conta aprovada
// pelo Marco palavra por palavra: desconto efetivo = cupom × fração com
// desconto; modo % = fração fixa · modo nº = min(1, nº ÷ vendidos do
// cenário), POR CENÁRIO). NENHUM número das fotografias acima foi regravado:
// os casos neutros abaixo provam que a extensão cai byte a byte nas
// fotografias originais — o campo antigo "desconto médio" equivale a
// cupom = X, modo %, 100%. Pagos do evento golden por cenário (das próprias
// fotografias): pessimista 700 · realista 911 · otimista 1100.
describe('desconto parcial em dois modos (sugestão 29a — conta aprovada em 19/07/2026)', () => {
  it('campos novos ausentes, vazios ou neutros (modo %, 100%) batem byte a byte com a fotografia ORIGINAL', () => {
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(
      computeCenarios({ ...eventoGolden(), descontoIngressosModo: '', descontoIngressosValor: '' })
    ).toStrictEqual(GOLDEN)
    expect(
      computeCenarios({
        ...eventoGolden(),
        descontoIngressosModo: 'pct',
        descontoIngressosValor: 100,
      })
    ).toStrictEqual(GOLDEN)
  })

  it('desconto legado (cupom 12) com campos novos vazios, "modo %, 100%" ou modo nº sem valor = GOLDEN_DESCONTO_12 byte a byte', () => {
    const legado = (extra) =>
      computeCenarios({ ...eventoGolden(), descontoMedioPct: 12, ...extra })
    expect(legado({ descontoIngressosModo: '', descontoIngressosValor: '' })).toStrictEqual(
      GOLDEN_DESCONTO_12
    )
    expect(legado({ descontoIngressosModo: 'pct', descontoIngressosValor: 100 })).toStrictEqual(
      GOLDEN_DESCONTO_12
    )
    // modo nº sem número informado: cupom em todos (a tela avisa) — conta de sempre
    expect(legado({ descontoIngressosModo: 'numero', descontoIngressosValor: '' })).toStrictEqual(
      GOLDEN_DESCONTO_12
    )
  })

  it('modo nº com nº ≥ vendidos de TODOS os cenários: min(1, …) trava a fração em 1 — byte a byte igual a cupom em todos', () => {
    expect(
      computeCenarios({
        ...eventoGolden(),
        descontoMedioPct: 12,
        descontoIngressosModo: 'numero',
        descontoIngressosValor: 99999,
      })
    ).toStrictEqual(GOLDEN_DESCONTO_12)
  })

  it('equivalência exata entre os modos: no otimista (1100 vendidos), nº 440 é a MESMA fração de 40% — byte a byte, MENOS o break-even', () => {
    const eventoPct = {
      ...eventoGolden(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'pct',
      descontoIngressosValor: 40,
    }
    const eventoNumero = {
      ...eventoGolden(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 440,
    }
    const porPct = computeCenarios(eventoPct)
    const porNumero = computeCenarios(eventoNumero)

    // Tudo o que descreve o cenário CHEIO continua byte a byte igual — é ali,
    // com 1.100 vendidos, que 440 ingressos SÃO 40%.
    const { breakEven: bePct, ...restoPct } = porPct.otimista
    const { breakEven: beNumero, ...restoNumero } = porNumero.otimista
    expect(restoNumero).toStrictEqual(restoPct)

    // O BREAK-EVEN É A EXCEÇÃO, e ela é uma consequência honesta da régua de
    // 27/07/2026 — não um desvio. A equivalência entre os dois modos é
    // PONTUAL: vale no ponto de 1.100 vendidos. O break-even anda com o
    // slider, e fora daquele ponto os 440 ingressos com cupom deixam de ser
    // 40%: no empate do modo nº são 440 de 689 vendidos, 63,9% da casa, um
    // desconto efetivo bem maior. Por isso o modo nº precisa de MAIS
    // ingressos para empatar.
    expect(bePct).toBe(672)
    expect(beNumero).toBe(689)

    // A prova de que 672 não serve no modo nº: nesse ponto do slider (61%) as
    // duas contas veem os MESMOS 672 pagos, e o lucro é positivo num modo e
    // R$ 1.559,07 negativo no outro.
    const em61pct = noSlider(eventoPct, 'otimista', 61)
    const em61numero = noSlider(eventoNumero, 'otimista', 61)
    expect(em61pct.pagos).toBe(672)
    expect(em61numero.pagos).toBe(672)
    expect(em61pct.lucro).toBeGreaterThanOrEqual(0)
    expect(em61numero.lucro).toBeLessThan(0)

    // e cada um é mínimo no seu modo: um degrau abaixo, prejuízo nos dois
    expect(noSlider(eventoPct, 'otimista', 60.9).pagos).toBeLessThan(672)
    expect(noSlider(eventoPct, 'otimista', 60.9).lucro).toBeLessThan(0)
    expect(noSlider(eventoNumero, 'otimista', 62.55).pagos).toBe(688)
    expect(noSlider(eventoNumero, 'otimista', 62.55).lucro).toBeLessThan(0)
  })

  it('modo % à mão: cupom 10 em 40% → efetivo 4% — otimista bruta 106.360 × 0,96 = 102.105,60; custos intocados', () => {
    const c = computeCenarios({
      ...eventoGolden(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'pct',
      descontoIngressosValor: 40,
    })
    expect(c.otimista.bruta).toBeCloseTo(102105.6, 8)
    expect(c.otimista.taxa).toBeCloseTo(10210.56, 8)
    expect(c.otimista.cashback).toBeCloseTo(5105.28, 8)
    // custos NUNCA mudam com desconto — mesmos valores da fotografia original
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(c[k].custoItens).toBe(GOLDEN[k].custoItens)
      expect(c[k].custoTotal).toBe(GOLDEN[k].custoTotal)
    }
  })

  it('modo nº à mão: 180 ingressos com cupom 10 — no pessimista os mesmos ingressos pesam mais', () => {
    const ev = {
      ...eventoGolden(),
      descontoMedioPct: 10,
      descontoIngressosModo: 'numero',
      descontoIngressosValor: 180,
    }
    const c = computeCenarios(ev)
    // fração por cenário: 180/700 ≈ 25,7% · 180/911 ≈ 19,8% · 180/1100 ≈ 16,4%
    // conferência à mão pela receita do realista (sem ticket manual):
    // bruta = 85.243,90 × (1 − 0,10 × 180/911) = 85.243,90 × 0,980241… ≈ 83.559,58
    // O LIMITE É DECLARADO E COBRADO, não afrouxado (25/07/2026, achado do
    // BACKLOG "a soma de ponto flutuante não é associativa" — conta aprovada
    // pelo Marco). A conta à mão multiplica o total direto; o código soma lote
    // a lote QUANTIZADO a centavos — associativo e exato, mas não byte a byte
    // igual à multiplicação direta. Diferença MEDIDA: R$ 0,0022 no realista e
    // R$ 0,0064 no otimista (4 lotes × até meio centavo de arredondamento).
    //
    // Por que NÃO `toBeCloseTo(..., 1)`: aquela régua tolera R$ 0,05 — oito
    // vezes a diferença real — e deixaria passar calado um erro de cinco
    // centavos na bilheteria bruta. Medido: com 2 centavos de erro injetados em
    // calc.js, a régua de 1 centavo acusa 15 falhas e a de 5 centavos acusa 14.
    // A régua da casa é declarar o limite verdadeiro e COBRÁ-LO (mesma lição do
    // teto de R$ 1,54 em comparacaoCustos.js): aqui o limite é UM CENTAVO, o
    // dígito que a tela mostra, e é isso que estas duas linhas exigem.
    expect(Math.abs(c.realista.bruta - 85243.9 * (1 - 0.1 * (180 / 911)))).toBeLessThan(0.01)
    expect(Math.abs(c.otimista.bruta - 106360 * (1 - 0.1 * (180 / 1100)))).toBeLessThan(0.01)
    // no pessimista o efetivo é MAIOR (mesmos 180 sobre menos vendidos):
    // a razão bruta/fotografia-sem-desconto é menor lá do que no otimista
    const quedaPess = c.pessimista.bruta / GOLDEN.pessimista.bruta
    const quedaOtim = c.otimista.bruta / GOLDEN.otimista.bruta
    expect(quedaPess).toBeLessThan(quedaOtim)
    expect(quedaPess).toBeCloseTo(1 - 0.1 * (180 / 700), 6)
  })
})

// ------------------------------------------------------------- sugestão 29b
// Taxa da bilheteria paga pelo CLIENTE (Sessão F2-R, 19/07/2026 — conta
// aprovada pelo Marco: no repasse a taxa NÃO desconta da receita; cashback
// INALTERADO; preço final ao cliente = pós-desconto × (1 + taxa)). NENHUM
// número das fotografias foi regravado — o padrão "paga por nós" e qualquer
// valor torto caem byte a byte nas fotografias originais (checagem estrita,
// mesma filosofia do openBar).
describe('taxa paga pelo cliente (sugestão 29b — conta aprovada em 19/07/2026)', () => {
  it('campo ausente, "nos", vazio ou valor "torto" (nunca === "cliente") batem byte a byte com a fotografia ORIGINAL', () => {
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), taxaPagaPor: '' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), taxaPagaPor: 'nos' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), taxaPagaPor: 'CLIENTE' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), taxaPagaPor: true })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), taxaPagaPor: null })).toStrictEqual(GOLDEN)
  })

  it('repasse mexe SÓ na líquida (e no que deriva dela): bruta, taxa, cashback e custos idênticos à fotografia', () => {
    const c = computeCenarios({ ...eventoGolden(), taxaPagaPor: 'cliente' })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const g = GOLDEN[k]
      // bruta/taxa/cashback: as MESMAS contas de sempre (taxa continua
      // calculada — é o que o cliente paga por fora)
      expect(c[k].bruta).toBe(g.bruta)
      expect(c[k].taxa).toBe(g.taxa)
      expect(c[k].cashback).toBe(g.cashback) // cashback INALTERADO
      expect(c[k].custoItens).toBe(g.custoItens)
      expect(c[k].custoTotal).toBe(g.custoTotal)
      // líquida = bruta + cashback (a taxa fica fora — regra do repasse)
      expect(c[k].liquida).toBe(somaEmCentavos([g.bruta, g.cashback]))
      expect(c[k].receitaTotal).toBe(somaEmCentavos([g.bruta, g.cashback, g.bar, g.patrocinio]))
    }
  })

  it('repasse à mão no realista: líquida 85.243,90 + 4.262,20 = 89.506,10; break-even cai 707 → 627', () => {
    const ev = { ...eventoGolden(), taxaPagaPor: 'cliente' }
    const c = computeCenarios(ev)
    expect(c.realista.liquida).toBe(89506.1)
    // Sem a taxa descontada, cada ingresso rende mais e faltam menos: 707 →
    // 627. Os DOIS números são da régua do slider — a frase antiga aqui dizia
    // "733 → 663" e reimplementava a divisão (65.110,598 ÷ 98,2504) para
    // chegar lá. Ponto de empate medido: 42,6% do slider.
    expect(c.realista.breakEven).toBe(627)
    const empate = noSlider(ev, 'realista', 42.6)
    expect(empate.pagos).toBe(627)
    expect(empate.lucro).toBeGreaterThanOrEqual(0)
    const umAMenos = noSlider(ev, 'realista', 42.429)
    expect(umAMenos.pagos).toBe(626)
    expect(umAMenos.lucro).toBeLessThan(0)
    // e a fotografia sem repasse continua sendo a referência da comparação
    expect(GOLDEN.realista.breakEven).toBe(707)
  })
})

// ------------------------------------------------------------- sugestão 42
// Bar em dois modos (conta cravada e aprovada pelo Marco em 19/07/2026):
// modo FIXO (padrão de todo evento existente) = o valor digitado, igual nos
// três cenários — a conta de sempre; modo POR PESSOA ('porPessoa', checagem
// ESTRITA) = consumo (ticket do cenário × pessoas do cenário, pessoas =
// pagos + cortesias) − taxa_sistema% × consumo − custo_sistema, POR CENÁRIO.
// NENHUM número das fotografias acima foi regravado: o evento golden não tem
// barModo → modo fixo → byte a byte a fotografia ORIGINAL. "Por pessoa é o
// padrão" vale SÓ para evento NOVO (novoEvento grava o modo explícito).
describe('bar em dois modos (sugestão 42 — conta aprovada em 19/07/2026)', () => {
  it('campo ausente, "", "fixo" e valores tortos (nunca === "porPessoa") batem byte a byte com a fotografia ORIGINAL', () => {
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), barModo: '' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), barModo: 'fixo' })).toStrictEqual(GOLDEN)
    // valores "tortos" de backup editado à mão NUNCA trocam o modo sozinhos
    expect(computeCenarios({ ...eventoGolden(), barModo: 'PORPESSOA' })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), barModo: true })).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), barModo: null })).toStrictEqual(GOLDEN)
    // campos por-pessoa preenchidos SEM o modo ligado ficam fora da conta
    expect(
      computeCenarios({
        ...eventoGolden(),
        barTicket: { pessimista: 90, realista: 110, otimista: 130 },
        barTaxaSistemaPct: 5,
        barCustoSistema: 500,
      })
    ).toStrictEqual(GOLDEN)
  })

  it('por pessoa mexe SÓ no bar — bilheteria e custos intocados; conta à mão sobre o público da fotografia', () => {
    const ev = {
      ...eventoGolden(),
      barModo: 'porPessoa',
      barTicket: { pessimista: 110, realista: 110, otimista: 110 },
      barTaxaSistemaPct: 5,
      barCustoSistema: 500,
    }
    const c = computeCenarios(ev)
    // públicos fotografados: 780 · 991 · 1180 (pagos + cortesias — a
    // cortesia consome no bar). À mão, ticket R$ 110, sistema 5% + R$ 500:
    // pess.: 110×780 = 85.800 − 4.290 − 500 = 81.010
    // real.: 110×991 = 109.010 − 5.450,50 − 500 = 103.059,50
    // otim.: 110×1180 = 129.800 − 6.490 − 500 = 122.810
    const esperado = { pessimista: 81010, realista: 103059.5, otimista: 122810 }
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const g = GOLDEN[k]
      expect(c[k].bar).toBe(esperado[k])
      // bilheteria, patrocínio e custos não mudam
      expect(c[k].bruta).toBe(g.bruta)
      expect(c[k].liquida).toBe(g.liquida)
      expect(c[k].patrocinio).toBe(g.patrocinio)
      expect(c[k].custoItens).toBe(g.custoItens)
      expect(c[k].custoTotal).toBe(g.custoTotal)
      // receita/lucro: a MESMA ordem de operações de computeCenario
      expect(c[k].receitaTotal).toBe(somaEmCentavos([g.liquida, esperado[k], g.patrocinio]))
      expect(c[k].lucro).toBe(somaEmCentavos([g.liquida, esperado[k], g.patrocinio, -g.custoTotal]))
    }
  })

  // O break-even do bar por pessoa saiu do teste acima e ganhou este, porque a
  // asserção antiga era a FÓRMULA VELHA reescrita à mão — e é AQUI que ela
  // errava mais feio. Ela abatia do custo o bar da CASA CHEIA (R$ 103.059,50
  // no realista, que só existe se 991 pessoas entrarem) e, em seguida,
  // perguntava quantos ingressos faltavam para chegar lá. Respondia
  // 426 · 24 · 0 — sendo que 24 é MENOS que os 371 ingressos que o override de
  // l3 põe na festa mesmo com o slider no zero, e 0 afirmava que a festa se
  // paga sem vender ingresso nenhum. A régua de hoje recalcula o bar em cada
  // ponto do slider: menos gente, menos bar.
  it('por pessoa e o break-even: a régua do slider recalcula o bar em cada ponto — fim da conta circular', () => {
    const ev = {
      ...eventoGolden(),
      barModo: 'porPessoa',
      barTicket: { pessimista: 110, realista: 110, otimista: 110 },
      barTaxaSistemaPct: 5,
      barCustoSistema: 500,
    }
    const c = computeCenarios(ev)

    const beNovo = { pessimista: 578, realista: 478, otimista: 466 }
    const beVelho = { pessimista: 426, realista: 24, otimista: 0 }
    const barDaCasaCheia = { pessimista: 81010, realista: 103059.5, otimista: 122810 }
    // pontos do slider MEDIDOS (entrada; o que se afirma é o que sai deles)
    const pctEmpate = { pessimista: 57.8, realista: 17.8, otimista: 42.375 }
    const pctUmAMenos = { pessimista: 57.625, realista: 17.572, otimista: 42.2 }

    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(c[k].breakEven).toBe(beNovo[k])
      expect(c[k].breakEvenNaoFecha).toBe(false)
      expect(c[k].breakEven).toBeGreaterThan(beVelho[k]) // nos três, a velha subestimava

      // no break-even, o lucro é >= 0 …
      const empate = noSlider(ev, k, pctEmpate[k])
      expect(empate.pagos).toBe(beNovo[k])
      expect(empate.lucro).toBeGreaterThanOrEqual(0)
      // … e o bar contado ali é MENOR que o da casa cheia: é esta linha que
      // prova que a circularidade morreu (menos ingresso, menos gente, menos
      // consumo — a receita de bar deixou de ser gasta antecipadamente)
      expect(empate.bar).toBeLessThan(barDaCasaCheia[k])

      // um ingresso a menos, e é prejuízo — a outra metade da definição
      const umAMenos = noSlider(ev, k, pctUmAMenos[k])
      expect(umAMenos.pagos).toBe(beNovo[k] - 1)
      expect(umAMenos.lucro).toBeLessThan(0)
    }
  })

  it('open bar MANDA em tudo: com barModo porPessoa e campos preenchidos, bar = 0 — idêntico ao open bar fixo', () => {
    const ppOpen = computeCenarios({
      ...eventoGolden(),
      openBar: true,
      barModo: 'porPessoa',
      barTicket: { pessimista: 110, realista: 110, otimista: 110 },
      barTaxaSistemaPct: 5,
      barCustoSistema: 500,
    })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(ppOpen[k].bar).toBe(0)
      expect(ppOpen[k].receitaTotal).toBe(GOLDEN[k].liquida + 0 + GOLDEN[k].patrocinio)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════
// AMPLIAÇÃO DO GOLDEN — 30/08/2026
//
// APROVAÇÃO: o Marco viu a tabela de valores em português
// (DIFF-PARA-O-MARCO-golden-2026-08-30.md) e aprovou por questionário em
// 30/08/2026, com o diff na frente — princípio 8 do CLAUDE.md.
//
// É ADIÇÃO, NÃO REGRAVAÇÃO: nenhuma fotografia acima muda. O evento golden não
// tem os campos de imposto, e sem eles `imposto.js` devolve `null` — `calc.js`
// nem soma zero, não acrescenta campo nenhum ao objeto do cenário.
//
// O BURACO QUE ISTO FECHA. Três contas que decidem dinheiro na tela do Marco não
// tinham fotografia nenhuma: o IMPOSTO (existe desde 27/07/2026 e tira R$ 7.514,63
// do lucro do realista neste evento), o RESULTADO REALIZADO do Fechamento
// (20/07/2026 — o número do card da festa fechada) e o SEMÁFORO (a cor que ele
// olha antes de dizer "essa festa acontece"). Sem foto, as três podiam mudar de
// comportamento sem nada gritar.
// ════════════════════════════════════════════════════════════════════════

const IMPOSTO_6 = {
  impostoPct: 6,
  impostoSobre: { bilheteria: true, bar: true, patrocinio: false },
}

// 6% com bilheteria e bar LIGADOS e patrocínio DESLIGADO: exercita as duas bases
// juntas e prova que a terceira fica de fora.
const GOLDEN_IMPOSTO_6 = {
  pessimista: {
    imposto: {
      aliquota: 6,
      vazia: false,
      sobre: { bilheteria: true, bar: true, patrocinio: false },
      bases: ['bilheteria', 'bar'],
      base: 102084.4,
      valor: 6125.06,
    },
    lucro: -24016.59,
    margem: -21.543275480558606,
    breakEven: null,
    breakEvenNaoFecha: true,
  },
  realista: {
    imposto: {
      aliquota: 6,
      vazia: false,
      sobre: { bilheteria: true, bar: true, patrocinio: false },
      bases: ['bilheteria', 'bar'],
      base: 125243.9,
      valor: 7514.63,
    },
    lucro: 8356.48,
    margem: 6.260369827559792,
    breakEven: 798,
    breakEvenNaoFecha: false,
  },
  otimista: {
    imposto: {
      aliquota: 6,
      vazia: false,
      sobre: { bilheteria: true, bar: true, patrocinio: false },
      bases: ['bilheteria', 'bar'],
      base: 146360,
      valor: 8781.6,
    },
    lucro: 33030.36,
    margem: 21.512193692300176,
    breakEven: 717,
    breakEvenNaoFecha: false,
  },
}

describe('imposto sobre a receita (as 4 decisões do Marco, 27/07/2026)', () => {
  it('evento golden SEM imposto bate byte a byte com a fotografia ORIGINAL', () => {
    // A alíquota nasce vazia e as três chaves nascem desligadas: nenhum evento
    // que já existe muda de número. É o princípio 2 — o formato salvo é contrato.
    expect(computeCenarios(eventoGolden())).toStrictEqual(GOLDEN)
    expect(computeCenarios({ ...eventoGolden(), impostoPct: '' })).toStrictEqual(GOLDEN)
  })

  it('alíquota SEM chave ligada: o campo APARECE valendo R$ 0, e é de propósito', () => {
    // ISTO EU ERREI ao escrever a fotografia, e o teste pegou. Eu tinha afirmado
    // que `impostoPct: 6` sozinho seria idêntico ao GOLDEN. Não é: o campo
    // `imposto` aparece, com `bases: []` e `valor: 0`.
    //
    // E o código está CERTO. O cabeçalho de `imposto.js` diz por quê: "chave
    // desligada e alíquota 0% dão o MESMO R$ 0 e contam histórias DIFERENTES.
    // Sem dizer qual é qual, em três meses ninguém sabe se o bar ficou de fora
    // de propósito ou porque alguém esqueceu de marcar" — foi assim que o bar
    // sumiu dos cenários em 27/07/2026. O descritor carrega a história.
    //
    // Esta fotografia existe para impedir a "simplificação" que devolveria
    // `null` sempre que o valor fosse zero: ela apagaria justamente a distinção
    // de que a decisão do Marco depende.
    const c = computeCenarios({ ...eventoGolden(), impostoPct: 6 })
    expect(c.realista.imposto).toStrictEqual({
      aliquota: 6,
      vazia: false,
      sobre: { bilheteria: false, bar: false, patrocinio: false },
      bases: [],
      base: 0,
      valor: 0,
    })
    // R$ 0 de imposto não move dinheiro nenhum: fora o campo novo, tudo igual
    for (const k of ['pessimista', 'realista', 'otimista']) {
      expect(c[k].lucro).toBe(GOLDEN[k].lucro)
      expect(c[k].margem).toBe(GOLDEN[k].margem)
      expect(c[k].receitaTotal).toBe(GOLDEN[k].receitaTotal)
      expect(c[k].custoTotal).toBe(GOLDEN[k].custoTotal)
      expect(c[k].breakEven).toBe(GOLDEN[k].breakEven)
    }
  })

  it('o caminho oposto — chave ligada e alíquota VAZIA — se declara `vazia: true`', () => {
    // A outra metade da mesma história, e ela tem marca própria no descritor.
    const c = computeCenarios({
      ...eventoGolden(),
      impostoSobre: { bilheteria: true, bar: false, patrocinio: false },
    })
    expect(c.realista.imposto.vazia).toBe(true)
    expect(c.realista.imposto.aliquota).toBe(0)
    expect(c.realista.imposto.bases).toEqual(['bilheteria'])
    expect(c.realista.imposto.valor).toBe(0)
    // e, de novo, nenhum dinheiro se move
    expect(c.realista.lucro).toBe(GOLDEN.realista.lucro)
  })

  it('6% sobre bilheteria BRUTA + bar: a fotografia dos três cenários', () => {
    const c = computeCenarios({ ...eventoGolden(), ...IMPOSTO_6 })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      const g = GOLDEN_IMPOSTO_6[k]
      expect(c[k].imposto).toStrictEqual(g.imposto)
      expect(c[k].lucro).toBe(g.lucro)
      expect(c[k].margem).toBe(g.margem)
      expect(c[k].breakEven).toBe(g.breakEven)
      expect(c[k].breakEvenNaoFecha).toBe(g.breakEvenNaoFecha)
    }
  })

  it('a BASE é a bilheteria BRUTA + o bar — decisão 2, conferida à mão', () => {
    const c = computeCenarios({ ...eventoGolden(), ...IMPOSTO_6 })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      // BRUTA, não líquida: no modo repasse a líquida é MAIOR que a bruta, e
      // tributá-la cobraria imposto sobre o cashback que volta para a produção.
      expect(c[k].imposto.base).toBe(GOLDEN[k].bruta + GOLDEN[k].bar)
      expect(c[k].imposto.base).not.toBe(GOLDEN[k].liquida + GOLDEN[k].bar)
      // o patrocínio fica FORA, porque a chave dele está desligada
      expect(c[k].imposto.bases).toEqual(['bilheteria', 'bar'])
      expect(c[k].imposto.valor).toBe(emCentavos((c[k].imposto.base * 6) / 100))
    }
    // a conta que o Marco refaz no papel, no realista:
    // 85.243,90 + 40.000,00 = 125.243,90 × 6% = 7.514,63
    expect(c.realista.imposto.base).toBe(125243.9)
    expect(c.realista.imposto.valor).toBe(7514.63)
  })

  it('o imposto é DEDUÇÃO DE RECEITA e fica FORA da contingência — decisões 3 e 4', () => {
    const sem = computeCenarios(eventoGolden())
    const c = computeCenarios({ ...eventoGolden(), ...IMPOSTO_6 })
    for (const k of ['pessimista', 'realista', 'otimista']) {
      // a receita NÃO muda: imposto é dedução, não some da receita
      expect(c[k].receitaTotal).toBe(sem[k].receitaTotal)
      // o CUSTO não muda: se o imposto virasse custo, a contingência passaria a
      // reservar SOBRE imposto — dinheiro de reserva que ninguém pediu
      expect(c[k].custoTotal).toBe(sem[k].custoTotal)
      expect(c[k].contingencia).toBe(sem[k].contingencia)
      // e o lucro cai EXATAMENTE o valor do imposto
      expect(c[k].lucro).toBeCloseTo(sem[k].lucro - c[k].imposto.valor, 8)
    }
  })

  it('com 6%, o PESSIMISTA deixa de fechar — de 913 ingressos para "não fecha"', () => {
    // Mudança de COMPORTAMENTO, não só de número, e é a razão desta fotografia
    // existir: sem ela, alguém poderia inverter isto sem nada gritar.
    expect(computeCenarios(eventoGolden()).pessimista.breakEven).toBe(913)
    const c = computeCenarios({ ...eventoGolden(), ...IMPOSTO_6 })
    expect(c.pessimista.breakEven).toBeNull()
    expect(c.pessimista.breakEvenNaoFecha).toBe(true)
    // os outros dois continuam fechando, mais caro
    expect(c.realista.breakEven).toBe(798) // era 707
    expect(c.otimista.breakEven).toBe(717) // era 645
  })
})

// O card da festa FECHADA — o número que ele olha DEPOIS da festa.
const GOLDEN_FECHAMENTO = {
  bilheteriaBruta: 95000,
  bilheteriaInformada: true,
  barInformado: true,
  taxa: 9500,
  cashback: 4750,
  bilheteriaLiquida: 90250,
  bar: 38000,
  patrocinio: 12500.5,
  patrocinioPotencial: 0,
  receita: 140750.5,
  custos: 106919.18,
  custosRealizados: 18418.43,
  custosPendentes: 88500.75,
  resultado: 33831.32,
  estimado: {
    receita: 133482.21,
    custos: 108000.75,
    lucro: 25481.46,
    margem: 19.089779829087338,
  },
  nItens: 9,
  nComRealizado: 3,
  nSemRealizado: 6,
  receitaPrevista: 0,
  receitaInformada: 140750.5,
  linhasPrevistas: [],
  completo: false,
  sinal: 'lucro',
  taxaCliente: false,
  contingenciaDoCenario: 10691.92,
  ajusteDoCenario: 0,
  lucroDoCenario: 15871.11,
  reservaDoCenario: 10691.92,
  ajusteDoCenarioValor: 0,
  diferencaParaCenario: 17960.21,
  desvioDeReceita: 7268.29,
}

describe('resultado realizado do Fechamento (a foto da festa que já aconteceu)', () => {
  const eventoFechado = () => ({
    ...eventoGolden(),
    receitaRealizada: { bilheteria: 95000, bar: 38000 },
  })

  it('bilheteria bruta 95.000 e bar 38.000 lançados: a fotografia inteira', () => {
    const ev = eventoFechado()
    expect(resultadoRealizado(ev, computeCenarios(ev).realista)).toStrictEqual(GOLDEN_FECHAMENTO)
  })

  it('a conta que o Marco refaz: 140.750,50 − 106.919,18 = 33.831,32', () => {
    const ev = eventoFechado()
    const r = resultadoRealizado(ev, computeCenarios(ev).realista)
    expect(r.receita).toBeCloseTo(r.bilheteriaLiquida + r.bar + r.patrocinio, 8)
    expect(r.resultado).toBeCloseTo(r.receita - r.custos, 8)
    expect(r.custos).toBeCloseTo(r.custosRealizados + r.custosPendentes, 8)
  })

  it('o "estimado" é o ORÇAMENTO, não o realizado disfarçado (Marco, 27/07/2026)', () => {
    // O defeito que isto guarda: a coluna vinha do cenário realista, que soma o
    // REALIZADO quando ele existe — e num evento fechado o "estimado" virava o
    // realizado, com o card comparando o realizado contra ele mesmo.
    const ev = eventoFechado()
    const r = resultadoRealizado(ev, computeCenarios(ev).realista)
    expect(r.estimado.custos).toBe(108000.75)
    expect(r.estimado.custos).not.toBe(r.custos) // 108.000,75 ≠ 106.919,18
  })

  it('com imposto de 6%, o resultado real cai de 33.831,32 para 25.851,32', () => {
    const ev = { ...eventoFechado(), ...IMPOSTO_6 }
    const r = resultadoRealizado(ev, computeCenarios(ev).realista)
    // a base do REALIZADO é a bilheteria bruta realizada + o bar realizado, e é
    // DIFERENTE da base do cenário — é isso que o desvioDeImposto mede
    expect(r.imposto.base).toBe(133000)
    expect(r.imposto.valor).toBe(7980)
    expect(r.estimado.imposto.base).toBe(125243.9)
    expect(r.resultado).toBe(25851.32)
    expect(r.desvioDeImposto).toBe(465.37)
    expect(r.estimado.lucro).toBe(17966.83)
    expect(r.estimado.margem).toBe(13.460093296327654)
  })
})

describe('veredito — a cor que ele olha antes de dizer "essa festa acontece"', () => {
  const sem = () => computeCenarios(eventoGolden())
  const com = () => computeCenarios({ ...eventoGolden(), ...IMPOSTO_6 })

  it('com o alvo/mínima padrão do app, os dois são VERMELHOS', () => {
    expect(veredito(sem(), {})).toStrictEqual({
      cor: 'vermelho',
      rebaixadoPeloPessimista: false,
      margemAlvo: 28,
      margemMinima: 20,
    })
    expect(veredito(com(), {})).toStrictEqual({
      cor: 'vermelho',
      rebaixadoPeloPessimista: false,
      margemAlvo: 28,
      margemMinima: 20,
    })
  })

  it('DUAS ROTAS DIFERENTES até o mesmo amarelo — e é isto que a foto prende', () => {
    const faixa = { margemAlvo: 8, margemMinima: 5 }
    // SEM imposto: a margem realista (11,89%) BATE o alvo de 8% — quem rebaixa a
    // cor é o PESSIMISTA, que está no prejuízo.
    expect(veredito(sem(), faixa)).toStrictEqual({
      cor: 'amarelo',
      rebaixadoPeloPessimista: true,
      margemAlvo: 8,
      margemMinima: 5,
    })
    // COM imposto: a margem cai para 6,26%, fica ABAIXO do alvo, e o amarelo
    // passa a vir do próprio alvo — o rebaixamento pelo pessimista some.
    expect(veredito(com(), faixa)).toStrictEqual({
      cor: 'amarelo',
      rebaixadoPeloPessimista: false,
      margemAlvo: 8,
      margemMinima: 5,
    })
    // as margens que produzem as duas rotas, afirmadas e não supostas
    expect(sem().realista.margem).toBeCloseTo(11.890056, 6)
    expect(com().realista.margem).toBeCloseTo(6.26037, 6)
  })
})

// ════════════════════════════════════════════════════════════════════════
// AMPLIAÇÃO DO GOLDEN — P8, LOTE SEM PREÇO — 06/10/2026
//
// APROVAÇÃO: o Marco viu a tabela de valores antigos × novos e aprovou por
// questionário em 06/10/2026 — princípio 8 do CLAUDE.md; registro datado na
// ficha "S1 — P8" do BACKLOG.md. A tabela saiu de
// scripts/provas-s7/diff-aprovacao.mjs rodado sobre calc.js de sha256
// 59b0b1a1…08a4cfc, com o comparador "mesmo evento sem o lote".
//
// É ADIÇÃO, NÃO REGRAVAÇÃO: GOLDEN, GOLDEN_DESCONTO_12, GOLDEN_IMPOSTO_6 e
// GOLDEN_FECHAMENTO não mudam um byte — o evento golden não tem lote sem preço.
//
// A REGRA: lote com preço AUSENTE ('', null, undefined) fica fora do público,
// das cortesias e do bar em todo cenário, mesmo com ajuste manual. Preço 0
// DECLARADO continua cortesia. Antes, o vazio virava R$ 0 e as 300 pessoas do
// lote entravam como cortesia: 300 × R$ 110 × 95% = R$ 31.350 de bar e de
// lucro a mais em cada cenário, e o mínimo do realista caía de 293 para 135.
// ════════════════════════════════════════════════════════════════════════

const eventoP8 = () => ({
  nome: 'Evento P8 (fixo — não é festa real): lote sem preço',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  outrasReceitas: { bar: '', patrocinio: '' },
  barModo: 'porPessoa',
  barTicket: { pessimista: 110, realista: 110, otimista: 110 },
  barTaxaSistemaPct: 5,
  barCustoSistema: 500,
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 600 },
    { id: 'c', nome: 'Cortesias declaradas', valor: 0, quantidade: 50 },
    { id: 'l4', nome: 'Lote sem preço', valor: '', quantidade: 300 },
  ],
  categorias: [{ id: 'aeb', nome: 'A&B', itens: [{ nome: 'Custo sintético', estimado: 60000 }] }],
  cenariosConfig: {
    pessimista: { vendaPct: 80, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

// Os doze campos da tabela que o Marco aprovou, na ordem dela.
const CAMPOS_P8 = ['pagos', 'cortesias', 'publico', 'bruta', 'taxa', 'cashback', 'liquida', 'bar', 'receitaTotal', 'custoTotal', 'lucro', 'breakEven']
const fotoP8 = (c) =>
  Object.fromEntries(
    ['pessimista', 'realista', 'otimista'].map((k) => [k, Object.fromEntries(CAMPOS_P8.map((f) => [f, c[k][f]]))])
  )

const GOLDEN_P8 = {
  pessimista: { pagos: 480, cortesias: 50, publico: 530, bruta: 48000, taxa: 4800, cashback: 2400, liquida: 45600, bar: 54885, receitaTotal: 100485, custoTotal: 69300, lucro: 31185, breakEven: 324 },
  realista: { pagos: 540, cortesias: 50, publico: 590, bruta: 54000, taxa: 5400, cashback: 2700, liquida: 51300, bar: 61155, receitaTotal: 112455, custoTotal: 63000, lucro: 49455, breakEven: 293 },
  otimista: { pagos: 600, cortesias: 50, publico: 650, bruta: 60000, taxa: 6000, cashback: 3000, liquida: 57000, bar: 67425, receitaTotal: 124425, custoTotal: 59850, lucro: 64575, breakEven: 277 },
}

const comAjusteP8 = (e, v) => ({ ...e, cenariosConfig: { ...e.cenariosConfig, overrides: { pessimista: { l4: v }, realista: { l4: v }, otimista: { l4: v } } } })
const comPrecoP8 = (e, v) => ({ ...e, lotes: e.lotes.map((l) => (l.id === 'l4' ? { ...l, valor: v } : l)) })

describe('lote sem preço fica fora de público e bar (P8 — aprovado pelo Marco em 06/10/2026)', () => {
  it('a fotografia aprovada: público 530/590/650, bar 54.885/61.155/67.425, lucro 31.185/49.455/64.575, mínimo 324/293/277', () => {
    expect(fotoP8(computeCenarios(eventoP8()))).toStrictEqual(GOLDEN_P8)
  })
  it('vazio, null e undefined dão a MESMA fotografia', () => {
    for (const v of ['', null, undefined]) expect(fotoP8(computeCenarios(comPrecoP8(eventoP8(), v)))).toStrictEqual(GOLDEN_P8)
  })
  it('mesmo com ajuste manual no lote sem preço (125, 450, 0), a fotografia não muda', () => {
    for (const v of [125, 450, 0]) expect(fotoP8(computeCenarios(comAjusteP8(eventoP8(), v)))).toStrictEqual(GOLDEN_P8)
  })
  it('é exatamente a festa SEM o lote — o comparador da tabela aprovada', () => {
    const e = eventoP8()
    expect(fotoP8(computeCenarios({ ...e, lotes: e.lotes.slice(0, 2) }))).toStrictEqual(GOLDEN_P8)
  })
  it('preço 0 DECLARADO continua cortesia: as 300 entram no público e no bar (coluna "antes" da tabela)', () => {
    const c = computeCenarios(comPrecoP8(eventoP8(), 0))
    expect(['pessimista', 'realista', 'otimista'].map((k) => [c[k].cortesias, c[k].publico, c[k].bar, c[k].lucro, c[k].breakEven])).toStrictEqual([
      [350, 830, 86235, 62535, 167],
      [350, 890, 92505, 80805, 135],
      [350, 950, 98775, 95925, 120],
    ])
  })
  it('o evento P8 não é mutado pelo cálculo, e o lote sem preço continua salvo como estava', () => {
    const ev = eventoP8()
    computeCenarios(ev)
    expect(ev).toStrictEqual(eventoP8())
    expect(ev.lotes[2]).toStrictEqual({ id: 'l4', nome: 'Lote sem preço', valor: '', quantidade: 300 })
  })
})
