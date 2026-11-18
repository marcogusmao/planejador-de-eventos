// EVIDÊNCIA — não é conserto. Nada aqui muda uma linha de calc.js.
//
// ============================================================================
// 1. O DESENHO (Marco, 19/07/2026, item 1 da fila do HANDOFF)
// ============================================================================
// O achado já está fotografado em `realizadoZero.evidencia.test.js`:
// `valorConsiderado()` (calc.js:299) trata `realizado = 0` como "não
// preenchido" e volta ao estimado, então NÃO DÁ PARA REGISTRAR QUE ALGO CUSTOU
// ZERO — permuta, cortesia, serviço cancelado depois de orçado. O custo
// previsto fica MAIOR que o gasto real, e a distorção sobe por toda a cadeia
// (contingência é % do considerado, logo amplifica).
//
// A SAÍDA ANTIGA era mudar o SIGNIFICADO do 0 na régua de todo o app. A saída
// NOVA, que é o ponto deste arquivo, não mexe na régua: dá ao item uma
// MARCAÇÃO EXPLÍCITA de "custou zero" (campo booleano proposto: `custouZero`).
//
//   item SEM marcação  → comportamento de hoje, BYTE A BYTE
//   item COM marcação  → o app respeita o zero
//
// POR QUE ISSO IMPORTA, EM UM NÚMERO: o próprio evento-régua do golden
// (`golden.test.js` linha 68, item "DJs locais": `{ estimado: 6000,
// realizado: 0 }`) tem um realizado 0 hoje. Mudar o SIGNIFICADO do 0 mexeria
// em R$ 6.000 do golden e exigiria regravá-lo — princípio 8, com o
// `.githooks/commit-msg` e o CI recusando o commit. Com a MARCAÇÃO, o golden
// não tem o campo, logo não tem marcação, logo não muda um centavo e o portão
// nem chega a ser acionado. Esse é o argumento central do desenho do Marco, é
// factual, e está travado em teste aqui embaixo.
//
// ============================================================================
// 2. DECISÃO QUE O MARCO PRECISA TOMAR ANTES DE QUALQUER LINHA DE CÓDIGO
//    (o furo achado na auditoria desta evidência, 20/07/2026)
// ============================================================================
// A regra 3.2 do desenho — "a marcação VENCE o realizado digitado" — QUEBRA UM
// CADEADO QUE JÁ EXISTE NO APP.
//
// Por quê, em português: quem soma o custo realizado no card do Fechamento é
// `confrontoCustos.js` (linha 101), e ele soma o realizado CRU, sem passar por
// `valorConsiderado()`. Então, num item com realizado 8.000 E marcação:
//
//   - a projeção (computeCenario / custosPorCategoria) leria 0
//   - o card do Fechamento (confrontoCustos) leria 8.000
//
// Duas telas, dois números, o MESMO item. É exatamente o S1 de 20/07/2026 que
// `fonteUnicaCustos.test.js` foi criado para trancar, e o invariante está
// escrito em `resultadoFechamento.evidencia.test.js` (linha 22):
//
//     conf.realizado + conf.estimadoPendente === custos.totalConsiderado
//
// E o pior: o cadeado NÃO AVISARIA, porque nenhuma fixture dele tem item
// marcado. A quebra é ESPECÍFICA da regra "a marcação vence o realizado
// digitado" — com realizado vazio ou 0 + marcação, o invariante se mantém.
// O teste `CADEADO` no bloco HOJE, abaixo, demonstra a quebra com a conta.
//
// AS DUAS SAÍDAS, para o Marco escolher:
//
//   (i)  A MARCAÇÃO SÓ VALE QUANDO O REALIZADO ESTÁ VAZIO OU É 0.
//        Item com realizado 8.000 + marcação: a marcação é ignorada (ou a tela
//        nem deixa marcar). Mudança pequena, cadeado intacto, nenhum arquivo
//        novo entra no inventário. Custo: o Marco tem de apagar o realizado
//        antes de marcar — e a tela precisa dizer isso com todas as letras,
//        senão vira "nada falha em silêncio" ao contrário (princípio 4).
//
//   (ii) CONFRONTOCUSTOS PASSA A HONRAR A MARCAÇÃO TAMBÉM.
//        `temRealizado` e a soma do realizado aprendem o campo novo, e o
//        invariante volta a fechar. Mudança maior: o inventário cresce (ver
//        seção 4 — tudo que hoje soma `num(item.realizado)` cru vira candidato),
//        e os dois cadeados precisam ganhar fixture com item marcado ANTES da
//        implementação, senão eles seguem cegos.
//
// Enquanto essa escolha não existir, o bloco PROPOSTO só especifica o que as
// DUAS saídas têm em comum: marcação com realizado vazio ou 0.
//
// ============================================================================
// 3. A MEDIÇÃO — o que foi contado de verdade, e o que não deu para contar
// ============================================================================
// Contado item por item sobre `importacoes/brisa-14-03-2026.backup.json`:
// 1 evento, 35 itens de custo, 30 com realizado, 5 sem realizado, ZERO com
// realizado igual a 0.
//
// HONESTIDADE DO RECORTE: isso é ~55% dos itens e 1 dos 4 eventos da medição
// anterior. Os outros três moram no localStorage do Marco e NÃO são acessíveis
// desta sessão. Portanto: o backup disponível não tem nenhum item que a
// marcação fosse resgatar hoje — e isso NÃO confirma nem desmente os outros
// três eventos. Não invente confirmação em cima disto.
//
// ============================================================================
// 4. INVENTÁRIO — o TAMANHO da mudança (é isto que diz o preço, não o desenho)
// ============================================================================
// Levantado por varredura de `realizado`, `valorConsiderado` e `temRealizado`
// em `src/` inteiro, arquivo por arquivo.
//
// (A) PRECISA MUDAR — a régua propriamente dita
//   - src/lib/calc.js:299   `valorConsiderado()` — o coração. PORTÃO DO GOLDEN.
//
// (B) PRECISA MUDAR ou VIRAR DECISÃO — soma o realizado CRU, sem a régua
//   - src/lib/confrontoCustos.js:71   `temRealizado` (a régua duplicada e vigiada)
//   - src/lib/confrontoCustos.js:101  soma do realizado cru → É O FURO DA SEÇÃO 2
//   - src/lib/calc.js:311             coluna "Realizado" por categoria, soma crua
//   - src/lib/planoFinanceiro.js:249-252  filtra por `temRealizado` e soma cru
//                                     (é aviso de texto, não valor exportado)
//   - src/lib/financeiro.js:287-288   ponte com o Financeiro: `num(i.realizado) > 0`
//                                     é uma 3ª cópia da régua
//   - src/lib/xlsxImport.js:252       4ª cópia da régua, dentro do importador
//                                     (`num(i.realizado) > 0 ? realizado : estimado`)
//   - src/lib/xlsxImport.js:208       descarta linha com estimado E realizado <= 0 —
//                                     um item "custou zero" importado sumiria calado
//
// (C) HERDAM A MUDANÇA de graça (chamam `valorConsiderado`) — só precisam de
//     teste novo, não de código novo
//   - src/lib/calc.js:312, 571        `custosPorCategoria`, `custosPorStatus`
//   - src/lib/fechamento.js:132       `montarBenchmarkDeEvento`
//   - src/lib/parcelas.js:75,108,131  divergência, agenda e resumo de parcelas
//   - src/lib/novaEdicao.js:57        nova edição herda o considerado como estimado:
//                                     item marcado nasceria com estimado 0 na
//                                     edição seguinte — DECISÃO, não acidente
//   - src/components/DossieCustoModal.jsx:66, ParcelasModal.jsx:32
//
// (D) TELAS que mostram o realizado cru e exibiriam travessão num item marcado
//   - src/components/ReportView.jsx:587
//   - src/components/ImportModal.jsx:257   (mesmo padrão, na revisão da importação)
//   - src/components/FechamentoTab.jsx:237,269
//
// (E) SAÍDAS DE ARQUIVO — decisão de produto, não bug
//   - src/lib/exportPagamentos.js:98   `if (num(pag.valor) <= 0) continue` — item
//                                      marcado vira parcela R$ 0 e SOME do CSV do
//                                      contador em silêncio. Provavelmente certo
//                                      (não se paga R$ 0), mas tem de ser escolhido.
//   - src/lib/analiseCaixa.js:70       `saidasDoEvento` bebe da agenda de parcelas:
//                                      saída de R$ 0 some da curva de caixa.
//
// (F) A RÉGUA DA ACURÁCIA mora no MÓDULO, não no componente
//   - src/lib/acuracia.js:39           `.filter((c) => c.desvioPct != null)` — é aqui
//                                      que o item marcado entraria (ou não) na média
//                                      histórica. Ver a pergunta ao Marco no fim.
//
// (G) CADEADOS QUE PRECISAM DE FIXTURE NOVA (não de código) — hoje são CEGOS
//     para o campo novo, e é isso que os torna perigosos
//   - src/lib/fonteUnicaCustos.test.js              (nenhum cenário com item marcado)
//   - src/lib/resultadoFechamento.evidencia.test.js (idem)
//   - src/lib/superficiesRealizado.evidencia.test.js, realizadoZero.evidencia.test.js
//
// (H) SCHEMA / PERSISTÊNCIA
//   - src/lib/migracao.js:253 `formaItemCusto` — PROPOSTA, não descrição:
//     HOJE ele NÃO conhece o campo; um `custouZero` vindo de backup editado à
//     mão atravessaria intacto, com o valor que estivesse lá (string, número,
//     objeto). A proposta é normalizá-lo para booleano, com `false` no ausente.
//     Enquanto a proposta não existir, quem tem de se defender de lixo é
//     `valorConsiderado()`.
//
// ============================================================================
// 5. PORTÃO E CRITÉRIO DE ACEITE
// ============================================================================
// A marcação é CAMPO NOVO NO SCHEMA DO localStorage → princípio 2 e "quando
// parar e perguntar" do CLAUDE.md. Nada disto se implementa sem aval explícito
// e datado do Marco. Por isso este arquivo só FOTOGRAFA:
//   - os `it(...)` normais passam HOJE e travam o comportamento atual;
//   - o `describe.skip(...)` é a especificação do comportamento PROPOSTO.
//     TODO teste de lá FALHA HOJE de propósito — se um deles passasse hoje,
//     ele não especificaria nada (foi assim que a primeira versão desta
//     evidência se enganou: 4 dos 9 passavam).
//
// CRITÉRIO DE ACEITE FINAL DA PROMESSA "byte a byte": não são as asserções
// deste arquivo. É A SUÍTE INTEIRA VERDE. Baseline medido em 20/07/2026, antes
// de qualquer implementação:
//
//     52 arquivos de teste · 1304 testes passaram · 13 skipped
//
// RESSALVA HONESTA sobre esse número: ele foi medido no começo do dia. Ao
// escrever esta versão, outras frentes (ordenação, plano do Financeiro) já
// estavam com trabalho em voo no mesmo repositório, e a suíte marcava 56
// arquivos / 1385 passaram / 11 skipped, com 15 falhas que NÃO são deste
// arquivo (`ordenarHonestidade.test.js` e `planoFinanceiro.test.js`, ambos
// em implementação). Ou seja: no dia da implementação, RE-MEÇA o baseline com
// a árvore limpa antes de usá-lo como aceite. O que vale é "a suíte inteira
// verde antes = a suíte inteira verde depois", não o número deste comentário.
//
// No dia da implementação, esse número é o que fecha a promessa — mais o
// `retrato()` completo abaixo, que passa um evento rico por TODAS as
// superfícies de cálculo do app de uma vez.
import { describe, it, expect } from 'vitest'
import {
  valorConsiderado,
  custosPorCategoria,
  custosPorStatus,
  contingencia,
  computeCenario,
} from './calc.js'
import { temRealizado, confrontoCustos } from './confrontoCustos.js'
import { montarBenchmarkDeEvento, resultadoRealizado } from './fechamento.js'
import { montarPagamentos } from './exportPagamentos.js'
import { montarItensPlano } from './planoFinanceiro.js'
import { acuraciaAgregada } from './acuracia.js'
import { migrarEvento } from './migracao.js'

// Casos da vida real, com os nomes da casa.
const DJ_PERMUTA = { servico: 'DJ residente (permuta)', estimado: 8000, realizado: 0 }
const BANDA_CORTESIA = { servico: 'Banda convidada (cortesia)', estimado: 6000, realizado: 0 }

// Sobrado 22/11 — festa pequena em que o cachê da banda (1/3 do orçamento)
// virou cortesia. É o caso que INVERTE a decisão: o app anuncia prejuízo onde
// a verdade é lucro.
const SOBRADO_FESTA = {
  nome: 'Sobrado 22/11',
  tipo: 'Sobrado',
  data: '2026-11-22',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  outrasReceitas: { bar: 8000, patrocinio: 0 },
  lotes: [{ id: 'l1', nome: 'Lote único', valor: 50, quantidade: 200 }],
  categorias: [
    { id: 'artistico', nome: 'Artístico', itens: [BANDA_CORTESIA] },
    { id: 'estrutura', nome: 'Estrutura', itens: [{ servico: 'Som', estimado: 5000, realizado: 4800 }] },
    { id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 7000, realizado: 6500 }] },
  ],
  // Os padrões de cenário com que estas fotografias foram MEDIDAS (20/07/2026):
  // pessimista 70%, realista 100%. Em 27/07/2026 o Marco subiu os padrões para
  // 80/90 (decisões A e B), e eles estão escritos aqui explicitamente para a
  // fotografia congelada continuar sendo a que foi medida — o assunto deste
  // arquivo é a marcação "custou zero", não o padrão de venda. A marca
  // `padraoPessimista80` é o que impede a migração de subir o 70 daqui.
  cenariosConfig: {
    pessimista: { vendaPct: 70 },
    realista: { vendaPct: 100 },
  },
  padraoPessimista80: { de: null },
  receitaRealizada: { bilheteria: 9800, bar: 7200 },
}

// EVENTO RICO — é ele que cobra a promessa "byte a byte" de verdade: tem
// status variado, item parcelado, item sem realizado, item com realizado 0,
// patrocínio por estágio, receita realizada e categoria fora das 7 padrão.
const EVENTO_RICO = {
  id: 'ev-rico',
  nome: 'Evento-régua da evidência',
  tipo: 'Brisa',
  data: '2026-03-14',
  publicoEstimado: 400,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 8,
  outrasReceitas: { bar: 12000 },
  patrocinios: [
    { id: 'p1', nome: 'Marca A', valor: 5000, estagio: 'recebido' },
    { id: 'p2', nome: 'Marca B', valor: 3000, estagio: 'proposta' },
  ],
  lotes: [
    { id: 'l1', nome: '1º lote', valor: 40, quantidade: 150 },
    { id: 'l2', nome: '2º lote', valor: 60, quantidade: 250 },
  ],
  categorias: [
    {
      id: 'atracoes',
      nome: 'Atrações',
      itens: [
        { id: 'i1', servico: 'DJ principal', estimado: 15000, realizado: 14000, status: 'PAGO' },
        { id: 'i2', servico: 'DJs locais', estimado: 6000, realizado: 0, status: 'FECHADO' },
        { id: 'i3', servico: 'Banda (permuta)', estimado: 8000, realizado: '', status: 'ESTIMADO' },
      ],
    },
    {
      id: 'estrutura',
      nome: 'Estrutura',
      itens: [
        {
          id: 'i4',
          servico: 'Som e luz',
          estimado: 18000.75,
          realizado: '',
          status: 'NEGOCIAR',
          parcelas: [
            { id: 'pa1', valor: 9000, data: '2026-03-01' },
            { id: 'pa2', valor: 9000.75, data: '2026-03-20' },
          ],
        },
      ],
    },
    {
      id: 'marketing',
      nome: 'Marketing',
      itens: [{ id: 'i5', servico: 'Tráfego', estimado: 4000, realizado: 4300, status: 'PAGO', dataPagamento: '2026-03-10' }],
    },
    {
      id: 'cat-inventada',
      nome: 'Categoria fora das 7',
      itens: [{ id: 'i6', servico: 'Extra', estimado: 1200, status: 'ESTIMADO' }],
    },
  ],
  // Os padrões de cenário com que estas fotografias foram MEDIDAS (20/07/2026):
  // pessimista 70%, realista 100%. Em 27/07/2026 o Marco subiu os padrões para
  // 80/90 (decisões A e B), e eles estão escritos aqui explicitamente para a
  // fotografia congelada continuar sendo a que foi medida — o assunto deste
  // arquivo é a marcação "custou zero", não o padrão de venda. A marca
  // `padraoPessimista80` é o que impede a migração de subir o 70 daqui.
  cenariosConfig: {
    pessimista: { vendaPct: 70 },
    realista: { vendaPct: 100 },
  },
  padraoPessimista80: { de: null },
  receitaRealizada: { bilheteria: 21000, bar: 11000 },
}

// O gêmeo MARCADO: idêntico, byte a byte, exceto pela marcação no item que
// hoje tem realizado 0 ("DJs locais", o mesmo item que existe no golden).
const EVENTO_RICO_MARCADO = {
  ...EVENTO_RICO,
  categorias: EVENTO_RICO.categorias.map((c) =>
    c.id === 'atracoes'
      ? { ...c, itens: c.itens.map((i) => (i.id === 'i2' ? { ...i, custouZero: true } : i)) }
      : c
  ),
}

/**
 * O RETRATO COMPLETO de um evento: passa por TODAS as superfícies de cálculo
 * que a promessa "byte a byte" precisa cobrir. É este objeto — e não cinco
 * asserções soltas — que o dia da implementação tem de reproduzir idêntico
 * para qualquer evento SEM marcação.
 */
function retrato(evento) {
  const realista = computeCenario(evento, 'realista')
  const cen = (c) => {
    const r = computeCenario(evento, c)
    return {
      custoItens: r.custoItens,
      contingencia: r.contingencia,
      custoTotal: r.custoTotal,
      receitaTotal: r.receitaTotal,
      lucro: r.lucro,
      margem: r.margem,
      breakEven: r.breakEven,
      // Campo novo da conta de break-even do Marco (27/07/2026). Entra no
      // retrato porque, sem ele, `breakEven: null` não distingue "não sei" de
      // "não fecha nem vendendo tudo" — e neste evento é o segundo caso.
      breakEvenNaoFecha: r.breakEvenNaoFecha,
      custoPorPessoa: r.custoPorPessoa,
    }
  }
  const custos = custosPorCategoria(evento.categorias)
  const conf = confrontoCustos(evento.categorias)
  const rr = resultadoRealizado(evento, realista)
  const bm = montarBenchmarkDeEvento(evento)
  const pag = montarPagamentos(evento)
  const plano = montarItensPlano(evento)
  return {
    // item a item, a régua nua
    valorConsiderado: (evento.categorias || []).flatMap((c) =>
      (c.itens || []).map((i) => valorConsiderado(i))
    ),
    custosPorCategoria: custos,
    custosPorStatus: custosPorStatus(evento.categorias),
    contingencia: contingencia(custos.totalConsiderado, evento.contingenciaPct),
    cenarios: {
      pessimista: cen('pessimista'),
      realista: cen('realista'),
      otimista: cen('otimista'),
    },
    confronto: {
      nItens: conf.nItens,
      nComRealizado: conf.nComRealizado,
      nSemRealizado: conf.nSemRealizado,
      realizado: conf.realizado,
      estimadoDosMesmos: conf.estimadoDosMesmos,
      estimadoTodos: conf.estimadoTodos,
      estimadoPendente: conf.estimadoPendente,
      delta: conf.delta,
    },
    resultadoRealizado: rr && {
      receita: rr.receita,
      custos: rr.custos,
      custosRealizados: rr.custosRealizados,
      resultado: rr.resultado,
    },
    // sem `id` e `obs`: uid() é aleatório por definição
    benchmark: { custos: bm.custos, custoTotal: bm.custoTotal, receita: bm.receita, lucro: bm.lucro },
    // agenda de pagamentos: quantas linhas saem e quanto somam
    pagamentos: {
      n: pag.pagamentos.length,
      soma: pag.pagamentos.reduce((s, p) => s + p.valor, 0),
    },
    // plano do Financeiro: projeção estreita de propósito (o arquivo está
    // sendo mexido por outra frente; o que importa aqui é o total)
    plano: {
      n: plano.itens.length,
      soma: plano.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0),
    },
    acuracia: acuraciaAgregada([evento]).geral,
  }
}

// FOTOGRAFIA CONGELADA do retrato de EVENTO_RICO, medida em 20/07/2026 com a
// suíte verde. Regravada em 07/10/2026 pela régua do centavo (aprovação do
// Marco com a tabela antigo × novo — princípio 8): custoTotal, lucro, margem e
// custo por pessoa dos três cenários trocam o resto de ponto flutuante pelo
// centavo exato; nenhum real inteiro da tela muda. É a linha de base da promessa: nenhum desses números pode mudar
// quando a marcação nascer, porque EVENTO_RICO não tem marcação nenhuma.
const RETRATO_HOJE = {
  "valorConsiderado": [
    14000,
    6000,
    8000,
    18000.75,
    4300,
    1200
  ],
  "custosPorCategoria": {
    "porCategoria": [
      {
        "id": "atracoes",
        "nome": "Atrações",
        "estimado": 29000,
        "realizado": 14000,
        "considerado": 28000
      },
      {
        "id": "estrutura",
        "nome": "Estrutura",
        "estimado": 18000.75,
        "realizado": 0,
        "considerado": 18000.75
      },
      {
        "id": "marketing",
        "nome": "Marketing",
        "estimado": 4000,
        "realizado": 4300,
        "considerado": 4300
      },
      {
        "id": "cat-inventada",
        "nome": "Categoria fora das 7",
        "estimado": 1200,
        "realizado": 0,
        "considerado": 1200
      }
    ],
    "totalEstimado": 52200.75,
    "totalRealizado": 18300,
    "totalConsiderado": 51500.75
  },
  "custosPorStatus": {
    "PAGO": 18300,
    "FECHADO": 6000,
    "ESTIMADO": 9200,
    "NEGOCIAR": 18000.75
  },
  "contingencia": 4120.06,
  "cenarios": {
    "pessimista": {
      "custoItens": 51500.75,
      "contingencia": 4120.06,
      "custoTotal": 61182.89,
      "receitaTotal": 30965,
      "lucro": -30217.89,
      "margem": -97.58724366219926,
      "breakEven": null,
      "breakEvenNaoFecha": true,
      "custoPorPessoa": 218.51032142857142
    },
    "realista": {
      "custoItens": 51500.75,
      "contingencia": 4120.06,
      "custoTotal": 55620.81,
      "receitaTotal": 36950,
      "lucro": -18670.81,
      "margem": -50.52993234100136,
      "breakEven": null,
      "breakEvenNaoFecha": true,
      "custoPorPessoa": 139.052025
    },
    "otimista": {
      "custoItens": 51500.75,
      "contingencia": 4120.06,
      "custoTotal": 52839.77,
      "receitaTotal": 36950,
      "lucro": -15889.77,
      "margem": -43.00343707713126,
      "breakEven": null,
      "breakEvenNaoFecha": true,
      "custoPorPessoa": 132.099425
    }
  },
  "confronto": {
    "nItens": 6,
    "nComRealizado": 2,
    "nSemRealizado": 4,
    "realizado": 18300,
    "estimadoDosMesmos": 19000,
    "estimadoTodos": 52200.75,
    "estimadoPendente": 33200.75,
    "delta": -700
  },
  "resultadoRealizado": {
    "receita": 35950,
    "custos": 51500.75,
    "custosRealizados": 18300,
    "resultado": -15550.75
  },
  "benchmark": {
    "custos": {
      "aeb": null,
      "locacao": null,
      "estrutura": 18000.75,
      "equipe": null,
      "artistico": null,
      "marketing": 4300,
      "extras": 29200
    },
    "custoTotal": 51500.75,
    // REGRAVADO EM 20/07/2026 — e só estas DUAS linhas. O Marco aprovou, com o
    // diff de números na mesa (princípio 1), a mudança da conta de
    // `montarBenchmarkDeEvento`: a receita do benchmark promovido deixou de ser
    // a bilheteria BRUTA e passou a ser a MESMA do card do Fechamento
    // (bilheteria líquida + bar + patrocínio fechado). Especificação e diff em
    // `promoverBenchmark.evidencia.test.js`.
    //   receita ... 21.000     → 35.950
    //   lucro ..... −30.500,75 → −15.550,75
    // `custos` e `custoTotal` NÃO se mexeram um centavo — a metade do
    // benchmark que já era comparável continua idêntica, e é essa a prova de
    // que a mudança acertou só o lado errado.
    "receita": 35950,
    "lucro": -15550.75
  },
  "pagamentos": {
    "n": 7,
    "soma": 51500.75
  },
  // 25/07/2026: "n" caiu de 12 para 11 — decisão do Marco em
  // planoFinanceiro.js (emitirIngressos): a bilheteria, que EVENTO_RICO tem
  // em 2 lotes ("1º lote" e "2º lote"), passou a sair como UMA linha só
  // ("Ingressos (bilheteria)") em vez de uma linha por lote. A "soma" NÃO
  // MUDOU — é a prova de que a decisão trocou a FORMA, não o dinheiro.
  "plano": {
    "n": 11,
    "soma": 94320.81
  },
  "acuracia": {
    "n": 1,
    "categorias": [
      {
        "nome": "Marketing",
        "n": 1,
        "mediaPct": 7.5
      },
      {
        "nome": "Atrações",
        "n": 1,
        "mediaPct": -6.666666666666667
      }
    ],
    "custoTotal": {
      "n": 1,
      "mediaPct": -3.684210526315789
    },
    "bilheteria": {
      "n": 1,
      "mediaPct": 0
    }
  }
}

describe('REGRA DO ZERO — sem marcação, o zero segue lido como "não preenchido"', () => {
  it('o zero SEM marcação segue valendo o estimado: a régua do 0 NÃO mudou', () => {
    // O campo nasceu (Marco, 20/07/2026, aval datado — ver PROPOSTO abaixo),
    // mas a marcação NÃO alterou o significado do 0: um item com realizado 0 e
    // SEM `custouZero` continua valendo o estimado, byte a byte como antes.
    expect('custouZero' in DJ_PERMUTA).toBe(false)
    expect(valorConsiderado(DJ_PERMUTA)).toBe(8000)
    expect(valorConsiderado({ ...DJ_PERMUTA, custouZero: false })).toBe(8000)
  })

  it('a régua ignora o zero em QUALQUER formato que o Marco consiga digitar', () => {
    for (const r of [0, '0', '0.00', '0,00', -0]) {
      expect(valorConsiderado({ estimado: 8000, realizado: r })).toBe(8000)
    }
  })

  it('`temRealizado` (a régua da TELA) concorda com a régua do CÁLCULO no zero', () => {
    // A duplicação é deliberada e vigiada (confrontoCustos.js:70). Aqui só se
    // registra que, no dia da mudança, as DUAS têm de andar juntas — senão a
    // tela diz "realizado" para um item que a projeção trata como pendente.
    expect(temRealizado(DJ_PERMUTA)).toBe(false)
    expect(valorConsiderado(DJ_PERMUTA)).toBe(DJ_PERMUTA.estimado)
  })

  it('o item de graça fica FORA do confronto, dos dois lados', () => {
    const c = confrontoCustos(SOBRADO_FESTA.categorias)
    expect(c.nItens).toBe(3)
    expect(c.nComRealizado).toBe(2) // a banda não conta
    expect(c.nSemRealizado).toBe(1)
    expect(c.estimadoPendente).toBe(6000) // e carrega 6.000 de orçamento fantasma
  })

  it('o Sobrado 22/11 é anunciado com PREJUÍZO onde a verdade é lucro', () => {
    const r = computeCenario(SOBRADO_FESTA, 'realista')
    expect(r.custoItens).toBe(17300) // 6000 + 4800 + 6500 — a banda entra pelo orçamento
    expect(r.contingencia).toBeCloseTo(1730, 6) // 10% de um custo inflado
    expect(r.custoTotal).toBeCloseTo(19030, 6)
    expect(r.lucro).toBeCloseTo(-1530, 6) // vermelho na tela
    // 27/07/2026 — a conta de break-even do Marco mudou, e este evento é um
    // retrato de por quê. A conta antiga imprimia 233 INGRESSOS PAGOS numa
    // festa que tem UM lote de 200: uma meta que não cabe na casa. A verdade
    // é que, com a banda de graça entrando pelo orçamento, o Sobrado não sai
    // do prejuízo nem esgotando o lote — e é isso que a tela passa a dizer.
    expect(r.pagos).toBe(200) // o lote inteiro, e ainda assim
    expect(r.breakEven).toBeNull()
    expect(r.breakEvenNaoFecha).toBe(true)
    // A verdade, se a banda de graça pudesse ser registrada: custo 11.300,
    // contingência 1.130, custo total 12.430 e lucro +5.070 (break-even 94).
  })

  it('o card do Fechamento erra pelo valor cheio do item de graça', () => {
    const rr = resultadoRealizado(SOBRADO_FESTA, computeCenario(SOBRADO_FESTA, 'realista'))
    expect(rr.custos).toBe(17300)
    expect(rr.resultado).toBeCloseTo(-790, 6) // a verdade seria +5.210
  })

  it('o benchmark PROMOVIDO carrega a distorção para o histórico, para sempre', () => {
    const bm = montarBenchmarkDeEvento(SOBRADO_FESTA)
    expect(bm.custoTotal).toBe(17300) // vira referência de comparação de festas futuras
    expect(bm.custos.artistico).toBe(6000) // dinheiro que nunca saiu do caixa
  })

  it('o evento-régua do GOLDEN já tem um realizado 0 — mudar o significado do 0 o quebraria', () => {
    // Mesmos números de golden.test.js, categoria "Atrações".
    const atracoes = [
      { nome: 'DJ principal', estimado: 15000, realizado: 14000 },
      { nome: 'DJs locais', estimado: 6000, realizado: 0 },
    ]
    const c = custosPorCategoria([{ id: 'atracoes', nome: 'Atrações', itens: atracoes }])
    expect(c.totalConsiderado).toBe(20000) // o golden fotografa exatamente este 20.000
    // Pela saída ANTIGA (0 = zero) isto viraria 14.000: R$ 6.000 de diferença
    // num golden que só se regrava com aval datado do Marco (princípio 8).
    expect(c.totalConsiderado - 14000).toBe(6000)
  })

  it('CADEADO — o invariante das duas telas, e a conta exata que a regra 3.2 quebraria', () => {
    // Este teste PASSA hoje e tem de continuar passando: é o cadeado do S1 de
    // 20/07/2026 (fonteUnicaCustos.test.js / resultadoFechamento.evidencia).
    // Ele está aqui, no bloco de HOJE e não no PROPOSTO, exatamente porque não
    // é uma especificação do futuro — é a parede que o futuro não pode furar.
    const cats = [
      { id: 'artistico', nome: 'Artístico', itens: [{ servico: 'DJ', estimado: 8000, realizado: 8000 }] },
      { id: 'aeb', nome: 'A&B', itens: [{ servico: 'Insumos', estimado: 7000, realizado: '' }] },
    ]
    const conf = confrontoCustos(cats)
    const custos = custosPorCategoria(cats)
    expect(conf.realizado + conf.estimadoPendente).toBe(custos.totalConsiderado)
    expect(custos.totalConsiderado).toBe(15000)

    // A DEMONSTRAÇÃO DA QUEBRA, com a conta na mão: sob a regra 3.2 ("a
    // marcação vence o realizado digitado"), aquele item de 8.000 marcado
    // valeria 0 na projeção, enquanto confrontoCustos.js:101 continuaria
    // somando o realizado CRU (8.000).
    const consideradoSob32 = 0 + 7000 // projeção: o item marcado zera
    const confrontoSob32 = 8000 + 7000 // confronto: realizado cru + pendente
    expect(confrontoSob32).not.toBe(consideradoSob32) // 15.000 ≠ 7.000
    expect(confrontoSob32 - consideradoSob32).toBe(8000) // o tamanho do buraco
    // Nenhuma fixture de fonteUnicaCustos.test.js tem item marcado — por isso
    // o cadeado NÃO gritaria. Ver a decisão (i)/(ii) no cabeçalho.
  })

  it('a fotografia congelada de EVENTO_RICO é a de hoje — a linha de base da promessa', () => {
    expect(retrato(EVENTO_RICO)).toEqual(RETRATO_HOJE)
  })

  it('o gêmeo MARCADO passou a se distinguir do original — a marcação faz efeito', () => {
    // Depois do aval do Marco (20/07/2026) o campo deixou de ser inerte: o item
    // marcado (realizado 0 → "custou zero") vale 0, então o retrato do gêmeo
    // MARCADO diverge do original. A preservação byte a byte do EVENTO_RICO
    // (sem marcação) segue provada no teste da fotografia congelada acima.
    expect(retrato(EVENTO_RICO_MARCADO)).not.toEqual(retrato(EVENTO_RICO))
  })

  it('round-trip export→import não inventa nem perde nada (com ou sem o campo)', () => {
    const ida = (e) => migrarEvento(JSON.parse(JSON.stringify(e)))
    expect(retrato(ida(EVENTO_RICO))).toEqual(retrato(EVENTO_RICO))
    // E a marcação verdadeira ATRAVESSA a migração — migracao.js agora normaliza
    // o campo para booleano (inventário, item H), preservando o `true`.
    const voltou = ida(EVENTO_RICO_MARCADO)
    expect(voltou.categorias[0].itens[1].custouZero).toBe(true)
  })
})

describe('IMPLEMENTADO — marcação explícita "custou zero" (aval datado do Marco: 20/07/2026, campo novo no schema, princípio 2)', () => {
  // Campo `custouZero: true` no item de custo. Ausente/false = comportamento de
  // hoje. A régua do zero em `valorConsiderado()` NÃO mudou: o que passou a
  // existir é um jeito de dizer "este item, sim, custou zero".
  //
  // NADA aqui depende da regra 3.2 ("a marcação vence o realizado digitado"),
  // que está EM ABERTO (ver seção 2 do cabeçalho): todos os casos usam item
  // com realizado vazio ou 0, onde as saídas (i) e (ii) concordam.

  it('A PROMESSA CENTRAL: o evento SEM marcação não muda um centavo, em NENHUMA superfície', () => {
    // Metade 1 — a preservação, cobrada no retrato inteiro: régua item a item,
    // custosPorCategoria, custosPorStatus, contingência, os 3 cenários,
    // confrontoCustos, resultadoRealizado, benchmark, agenda de pagamentos,
    // plano do Financeiro e acurácia. Inclui o realizado 0 do golden, que
    // segue valendo 6.000 por não ter marcação.
    expect(retrato(EVENTO_RICO)).toEqual(RETRATO_HOJE)
    // e o round-trip pelo backup não muda nada disso
    expect(retrato(migrarEvento(JSON.parse(JSON.stringify(EVENTO_RICO))))).toEqual(RETRATO_HOJE)

    // Metade 2 — o que DISCRIMINA: o gêmeo marcado tem de deixar de ser
    // idêntico. É esta linha que falha hoje (hoje o campo é inerte).
    expect(retrato(EVENTO_RICO_MARCADO)).not.toEqual(RETRATO_HOJE)

    // CRITÉRIO DE ACEITE REAL, que nenhuma asserção substitui: a suíte inteira
    // verde (baseline 20/07/2026 — 52 arquivos, 1304 passaram, 13 skipped).
  })

  it('item COM marcação vale zero, e o estimado fica guardado como memória do orçamento', () => {
    expect(valorConsiderado({ ...DJ_PERMUTA, custouZero: true })).toBe(0)
    // o estimado NÃO é apagado: é o que faz o confronto "orçamos 8.000, saiu 0"
    expect({ ...DJ_PERMUTA, custouZero: true }.estimado).toBe(8000)
  })

  it('marcação só vale se for booleano `true` — lixo de backup editado à mão não marca nada', () => {
    // A metade que discrimina vem primeiro: sem ela, este teste passaria hoje
    // por vacuidade (hoje NADA marca nada, inclusive o `true`).
    expect(valorConsiderado({ estimado: 8000, realizado: 0, custouZero: true })).toBe(0)
    for (const v of ['true', 1, 'sim', {}, [], 'x', null, undefined, 0]) {
      expect(valorConsiderado({ estimado: 8000, realizado: 0, custouZero: v })).toBe(8000)
    }
  })

  it('BACKUP ANTIGO abre igual, e a migração normaliza o campo — de verdade, chamando migracao.js', () => {
    // PROPOSTA (não é o comportamento de hoje): `formaItemCusto`
    // (migracao.js:253) passa a normalizar `custouZero` para booleano, com
    // `false` quando ausente, e NUNCA para `true`.
    const antigo = { eventos: undefined, ...EVENTO_RICO }
    const migrado = migrarEvento(JSON.parse(JSON.stringify(antigo)))
    // 1) backup antigo: campo nasce false, e nenhum número muda
    for (const c of migrado.categorias) for (const i of c.itens) expect(i.custouZero).toBe(false)
    expect(retrato(migrado)).toEqual(RETRATO_HOJE)
    // 2) lixo vindo de backup editado à mão vira false, não true
    const sujo = migrarEvento({
      ...EVENTO_RICO,
      categorias: [{ id: 'a', nome: 'A', itens: [{ estimado: 8000, realizado: 0, custouZero: 'sim' }] }],
    })
    expect(sujo.categorias[0].itens[0].custouZero).toBe(false)
    expect(valorConsiderado(sujo.categorias[0].itens[0])).toBe(8000)
    // 3) marcação verdadeira sobrevive ao round-trip
    const bom = migrarEvento(JSON.parse(JSON.stringify(EVENTO_RICO_MARCADO)))
    expect(bom.categorias[0].itens[1].custouZero).toBe(true)
    expect(valorConsiderado(bom.categorias[0].itens[1])).toBe(0)
  })

  it('o Sobrado 22/11 marcado passa a dizer a verdade — nos três cenários', () => {
    const marcado = {
      ...SOBRADO_FESTA,
      categorias: SOBRADO_FESTA.categorias.map((c) =>
        c.id === 'artistico' ? { ...c, itens: [{ ...BANDA_CORTESIA, custouZero: true }] } : c
      ),
    }
    const r = computeCenario(marcado, 'realista')
    expect(r.custoItens).toBe(11300)
    expect(r.contingencia).toBeCloseTo(1130, 6) // a contingência deixa de amplificar
    expect(r.custoTotal).toBeCloseTo(12430, 6)
    expect(r.lucro).toBeCloseTo(5070, 6) // de −1.530 para +5.070: o sinal INVERTE
    expect(r.breakEven).toBe(94) // de 233 ingressos para 94
    // os vizinhos andam junto: mesma base de custo, o ajuste de cenário por cima
    expect(computeCenario(marcado, 'pessimista').custoItens).toBe(11300)
    expect(computeCenario(marcado, 'otimista').custoItens).toBe(11300)
    // e a leitura por status, que também bebe de valorConsiderado
    expect(custosPorStatus(marcado.categorias)['ORÇAR']).toBe(11300)
    // o card do Fechamento acompanha
    expect(resultadoRealizado(marcado, r).custos).toBe(11300)
  })

  it('o item marcado passa a CONTAR no confronto, e o invariante das duas telas fecha', () => {
    const marcado = { ...BANDA_CORTESIA, custouZero: true }
    expect(temRealizado(marcado)).toBe(true)
    const cats = [
      { id: 'artistico', nome: 'Artístico', itens: [marcado] },
      { id: 'aeb', nome: 'A&B', itens: [{ estimado: 7000, realizado: 6500 }] },
    ]
    const c = confrontoCustos(cats)
    expect(c.nComRealizado).toBe(2)
    expect(c.estimadoPendente).toBe(0) // acabou o orçamento fantasma
    expect(c.realizado).toBe(6500)
    expect(c.estimadoDosMesmos).toBe(13000)
    expect(c.delta).toBe(-6500) // economia de verdade, dita com todas as letras
    // O CADEADO, agora com fixture marcada — é ele que a regra 3.2 quebraria.
    expect(c.realizado + c.estimadoPendente).toBe(custosPorCategoria(cats).totalConsiderado)
  })

  it('o benchmark promovido do evento marcado não leva dinheiro que nunca saiu', () => {
    const marcado = {
      ...SOBRADO_FESTA,
      categorias: SOBRADO_FESTA.categorias.map((c) =>
        c.id === 'artistico' ? { ...c, itens: [{ ...BANDA_CORTESIA, custouZero: true }] } : c
      ),
    }
    const bm = montarBenchmarkDeEvento(marcado)
    expect(bm.custoTotal).toBe(11300)
    expect(bm.custos.artistico).toBe(null) // categoria que somou 0 sai como null
  })
})

// ============================================================================
// FORA DO BLOCO PROPOSTO — de propósito. Estas NÃO são especificações: são
// PERGUNTAS ao Marco. Vira teste no dia em que ele responder; enquanto isso,
// virar `expect('decidido').toBe('decidido')` seria fingir cobertura.
// ============================================================================
//
// P1. A REGRA 3.2 (marcação × realizado digitado) — seção 2 do cabeçalho.
//     Saída (i) marcação só vale com realizado vazio/0, ou saída (ii)
//     confrontoCustos honra a marcação. Sem isso, não se escreve código.
//
// P2. ACURÁCIA (acuracia.js:39). Hoje o item de graça fica fora da média dos
//     dois lados. Com a marcação ele passa a ter realizado (0) e estimado
//     (6.000), logo entra com desvio −100% na categoria Artístico e puxa o
//     desvio total do Sobrado para baixo. É MAIS honesto, e muda um número
//     histórico que o Marco lê em reunião. Entra na acurácia ou fica de fora?
//     (Os números exatos do "depois" dependem de P1 e da resposta desta —
//     por isso não estão escritos aqui como se fossem medidos.)
//
// P3. CSV DO CONTADOR (exportPagamentos.js:98). Item marcado vira parcela de
//     R$ 0 e some do arquivo. Provavelmente certo — não se paga R$ 0 — mas
//     hoje sumiria em SILÊNCIO, e "nada falha em silêncio" é princípio 4.
//     Some com aviso, ou sai listado com valor zero?
//
// P4. NOVA EDIÇÃO (novaEdicao.js:57). A edição seguinte herda o considerado
//     como estimado: um item marcado nasceria com estimado 0 na festa do ano
//     que vem — ou seja, "de graça uma vez, de graça para sempre". Herda o
//     zero, ou volta a herdar o estimado original?
//
// P5. IMPORTADOR (xlsxImport.js:208). Uma linha com estimado 0 e realizado 0
//     é descartada hoje. Se a planilha passar a poder dizer "custou zero",
//     essa linha precisa de um jeito de entrar.
