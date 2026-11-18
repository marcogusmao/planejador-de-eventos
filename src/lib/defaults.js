import { uid, agora } from './util.js'
import { STATUS_CUSTO_IDS, STATUS_CUSTO_PADRAO } from './statusCusto.js'

// UMA lista só (statusCusto.js é a fonte canônica — app/export/import). O
// export const STATUS segue existindo pelo nome que os seletores já importam.
export const STATUS = STATUS_CUSTO_IDS

// Estágios de patrocínio (Sessão O — sugestão 22): MESMO vocabulário do módulo
// de Patrocínios do Financeiro, de propósito — são os valores exatos do
// CHECK da tabela `patrocinios` de lá (status IN ('proposta','confirmado',
// 'recebido')), e os rótulos/emoji são os mesmos da tela de Patrocínios de lá.
// A futura ponte de patrocínios (Fase 2) casa os dois lados sem tradução.
// Regra aprovada pelo Marco (18/07/2026): só 'confirmado' e 'recebido'
// ("fechado") contam na receita dos cenários e no semáforo; 'proposta' é
// potencial visível, nunca somado (ver patrocinioPorEstagio em calc.js).
export const ESTAGIOS_PATROCINIO = ['proposta', 'confirmado', 'recebido']
export const ESTAGIO_PATROCINIO_LABEL = {
  proposta: '📝 Proposta',
  confirmado: '🤝 Confirmado',
  recebido: '✅ Recebido',
}

export function novoPatrocinio(patch = {}) {
  // Nasce em 'proposta' — mesmo default do banco do Financeiro. Não conta na
  // receita até o Marco marcar como confirmado/recebido.
  // dataPgto/pagamento: mesmos campos do produtor (export v2) — por patrocínio.
  return { id: uid(), patrocinador: '', valor: '', estagio: 'proposta', dataPgto: '', pagamento: '', ...patch }
}

// Tipos de festa (Sessão N — sugestão 16 do MELHORIAS.md): MESMOS nomes das
// marcas do Financeiro, de propósito — o vínculo da ponte e a curva
// histórica (sugestão 14, Fase 2) casam sozinhos. Grafia conferida no banco
// real do Financeiro em 18/07/2026 (tabela empresas): é "Brisa", com dois T
// maiúsculos — não "Brisa". Ordem = ordem das empresas no Financeiro.
// A lista NÃO é fechada: o seletor oferece "+ criar tipo novo" e qualquer
// string vale como tipo (evento sem tipo = "sem categoria").
export const TIPOS_PADRAO = ['Marfim Alto', 'Brisa', 'Sobrado', 'O Galeao']

export const CATEGORIAS_PADRAO = [
  {
    key: 'aeb',
    nome: 'A&B',
    sugestoes: ['Equipe de bar', 'Insumos', 'Gelo', 'Consignados', 'Copos', 'Cardápios'],
  },
  {
    key: 'locacao',
    nome: 'Locação & Documentação',
    sugestoes: ['Aluguel do espaço', 'Alvará', 'ECAD', 'Seguro', 'Engenharia / AVCB', 'CET'],
  },
  {
    key: 'estrutura',
    nome: 'Estrutura & Cenografia',
    sugestoes: [
      'Som',
      'Luz',
      'Palco',
      'Gerador',
      'Elétrica',
      'Banheiros',
      'Gradil',
      'Mobiliário',
      'Cenografia',
      'Ambulância',
      'Rádios',
      'Limpeza / Lixo',
    ],
  },
  {
    key: 'equipe',
    nome: 'Equipe',
    sugestoes: [
      'Produção executiva',
      'Produção técnica',
      'Produção criativa',
      'Segurança',
      'Brigadista',
      'Credenciamento',
      'Transporte de equipe',
      'Alimentação de equipe',
    ],
  },
  { key: 'artistico', nome: 'Artístico', sugestoes: ['DJs', 'Atrações', 'Backline'] },
  { key: 'marketing', nome: 'Marketing', sugestoes: ['Design', 'Tráfego', 'Conteúdo', 'Assessoria'] },
  { key: 'extras', nome: 'Extras & Contingência', sugestoes: ['Imprevistos'] },
]

// Itens comuns de segurança/documentação que aparecem como chips de sugestão
// (ver CATEGORIAS_PADRAO acima) e cuja ausência vale um aviso antes de
// apresentar (carona aprovada na sugestão 2 do MELHORIAS.md). Lista curada —
// não é "toda sugestão", só as que têm risco de esquecimento sério.
export const ITENS_CRITICOS = ['Alvará', 'ECAD', 'Seguro', 'Engenharia / AVCB', 'CET', 'Gerador', 'Ambulância', 'Brigadista']

// Palavras-chave por item crítico (item 4, F2-W — correção de LÓGICA).
// O aviso "itens comuns não cadastrados" comparava por NOME EXATO — "Seguro"
// não reconhecia "Seguro civil" já lançado e avisava como faltando algo que
// existe (falso alerta, print do Marco). Agora casa por PALAVRA-CHAVE
// normalizada (sem acento/caixa), com cuidado para NÃO afrouxar demais:
// matching frouxo ESCONDERIA um aviso legítimo (o perigo oposto, pior). Regra:
// casa por TOKEN inteiro ou por PREFIXO de token (só chaves com ≥4 letras),
// NUNCA por substring solta. Assim "Seguro civil" cobre "Seguro", mas
// "Segurança" (equipe) NÃO cobre; "CET" (3 letras) só casa o token exato "cet",
// nunca "cenografia"/"buffet"; "Brigada de incêndio" cobre "Brigadista".
const ITENS_CRITICOS_CHAVES = {
  'Alvará': ['alvara'],
  'ECAD': ['ecad'],
  'Seguro': ['seguro'],
  'Engenharia / AVCB': ['avcb', 'engenharia'],
  'CET': ['cet'],
  'Gerador': ['gerador'],
  'Ambulância': ['ambulancia'],
  'Brigadista': ['brigadista', 'brigada'],
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// tokens alfanuméricos, minúsculos, sem acento: "Seguro civil" → ['seguro','civil']
const tokensDeServico = (s) => semAcento(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
// token cobre a chave se é IGUAL a ela, ou COMEÇA com ela (só chaves ≥4 letras,
// para "cet" não pegar "cetim" e afins). Prefixo pega plural/flexão
// ("seguros", "ambulancias") sem virar substring frouxa.
const tokenCobreChave = (token, chave) =>
  token === chave || (chave.length >= 4 && token.startsWith(chave))

/** Nomes de ITENS_CRITICOS que nenhum item do evento cobre (matching por
 *  palavra-chave — ver ITENS_CRITICOS_CHAVES) E que o usuário não dispensou
 *  como "já incluso" neste evento (sugestão 37 — `itensDispensados`). */
export function itensCriticosFaltando(evento) {
  const tokens = (evento?.categorias || []).flatMap((c) =>
    (c.itens || []).flatMap((i) => tokensDeServico(i.servico))
  )
  const dispensados = new Set(evento?.itensDispensados || [])
  const cobre = (chaves) =>
    tokens.some((token) => chaves.some((chave) => tokenCobreChave(token, chave)))
  return ITENS_CRITICOS.filter(
    (nome) => !dispensados.has(nome) && !cobre(ITENS_CRITICOS_CHAVES[nome] || [nome.toLowerCase()])
  )
}

/** Itens críticos que o usuário marcou "já incluso" NESTE evento (sugestão 37):
 *  só os que são de fato críticos (lixo de backup editado à mão fica de fora). */
export function itensDispensadosDoEvento(evento) {
  return (evento?.itensDispensados || []).filter((n) => ITENS_CRITICOS.includes(n))
}

export function novoItem(patch = {}) {
  return {
    id: uid(),
    servico: '',
    fornecedor: '',
    estimado: '',
    realizado: '',
    status: STATUS_CUSTO_PADRAO,
    responsavel: '',
    obs: '',
    // Dados de pagamento do PRODUTOR (export v2, Marco 21/07/2026): quando foi
    // pago (dataPgto, texto do produtor) e como (pagamento — Pix/boleto/dados).
    // NÃO confundir com `dataPagamento`/`parcelas` abaixo, que são a AGENDA de
    // pagamento (fluxo de caixa da Análise). Nenhum cálculo de cenário lê estes.
    dataPgto: '',
    pagamento: '',
    // "custou zero" (Marco, 20/07/2026): marcação EXPLÍCITA de item que saiu de
    // graça (permuta/cortesia). Booleano estrito — nasce false; só vale com o
    // Realizado vazio ou 0 (P1). Quem respeita no cálculo é custouZeroEfetivo()
    // (calc.js); a migração normaliza para booleano.
    custouZero: false,
    // realizadoAuto (Marco, 23/07/2026 — lote de travas, item 4): flag ESTRITA
    // que marca o `realizado` gravado AUTOMATICAMENTE pela última parcela paga
    // (parcelas.js). Nasce false; edição manual do realizado a zera; desmarcar a
    // gravação automática a limpa. Nenhum cálculo lê (metadado do motor de
    // parcelas). Fica no item para casar com a forma que a migração impõe.
    realizadoAuto: false,
    // Agenda de pagamento (Sessão F2-C — "parcelamento muda o FLUXO, não o
    // CUSTO"): data única opcional OU lista de parcelas { id, valor, data }.
    // NENHUM cálculo de cenário lê os dois campos — só a aba Análise e os
    // exports de pagamentos (ver src/lib/parcelas.js).
    dataPagamento: '',
    parcelas: [],
    // Anotações do Dossiê do custo (sugestão 40 — Marco, 19/07/2026):
    // observação livre, contato do fornecedor e link do orçamento. DADO,
    // nunca instrução (princípio 9): nenhum cálculo/export lê; só o painel
    // do dossiê mostra, e o link só abre quando é http/https (dossie.js).
    observacao: '',
    contato: '',
    linkOrcamento: '',
    ...patch,
  }
}

export function novoLote(patch = {}) {
  // viradaPrevista (Sessão F2-B, sugestão 14): data em que o lote deve
  // esgotar — OPCIONAL, só o modo "pelas datas dos lotes" da curva lê.
  return { id: uid(), nome: '', valor: '', quantidade: '', somenteOtimista: false, viradaPrevista: '', ...patch }
}

const LOTES_PADRAO = [
  'Lote Promocional',
  'Lote 1',
  'Lote 2',
  'Lote 3',
  'Lote 4',
  'Último Lote',
]

export function novoEvento(nome = 'Novo evento') {
  const ts = agora()
  return {
    id: uid(),
    nome,
    data: '',
    local: '',
    publicoEstimado: '',
    criadoEm: ts,
    atualizadoEm: ts,
    taxaBilheteria: 10,
    cashbackPct: 5,
    contingenciaPct: 5,
    // `patrocinio` (número solto) é o formato ANTIGO, mantido '' por forma —
    // desde a Sessão O a fonte é a lista `patrocinios` abaixo (migracao.js
    // converte o solto de eventos/backups antigos preservando os números).
    outrasReceitas: { bar: '', patrocinio: '' },
    // Open bar (Sessão Q, sugestão 27): marcado → receita de bar = 0 nos
    // cenários e no fechamento (calc.js/isOpenBar). Padrão false = conta de
    // sempre. O custo de bar não muda sozinho.
    openBar: false,
    // Bar em dois modos (sugestão 42 — conta aprovada pelo Marco em
    // 19/07/2026): evento NOVO nasce no modo POR PESSOA, EXPLÍCITO (decisão
    // do Marco: o padrão novo vale só para evento novo — evento salvo sem o
    // campo segue no modo fixo, checagem estrita em calc.js/isBarPorPessoa).
    // Campos vazios = bar R$ 0, exatamente como o evento novo sempre nasceu.
    barModo: 'porPessoa',
    // Ticket do bar POR CENÁRIO (consumo por pessoa, não lucro). Âncora real
    // do Marco: R$ 110 — fica como placeholder na tela, nunca travado aqui.
    barTicket: { pessimista: '', realista: '', otimista: '' },
    // Taxa do sistema do bar (% sobre o consumo, a mesma nos 3 cenários) e
    // custo do sistema (R$ fixo por evento, igual nos 3).
    barTaxaSistemaPct: '',
    barCustoSistema: '',
    // Patrocínios por estágio (Sessão O — sugestão 22): lista no vocabulário
    // do Financeiro; só confirmado/recebido conta na receita (calc.js).
    patrocinios: [],
    // Itens comuns dispensados "já incluso — não preciso lançar" (Sessão F2-W,
    // sugestão 37): nomes de ITENS_CRITICOS que somem do aviso SÓ neste evento
    // (não vira premissa da festa). Display-only — NENHUM cálculo lê; não cria
    // linha de custo. Reversível (lista de dispensados com desfazer no aviso).
    itensDispensados: [],
    // Fechamento (Sessão E, sugestão 5): receita realizada — opcional, vazio =
    // não informado; nenhum cálculo de cenário usa estes campos.
    receitaRealizada: { bilheteria: '', bar: '' },
    // Ciclo de vida do EVENTO (Parte 2 do fechamento — 20/07/2026): evento
    // novo nasce ABERTO, explícito (padrão barModo: explícito no novo,
    // backfill estrito no antigo via migracao.js). 'fechado' trava edição e
    // anda SEMPRE junto com a foto em `fechamento` — invariante vigiado na
    // migração. Não confundir com o `status` do ITEM de custo ('ORÇAR'…).
    status: 'aberto',
    // Foto do fechamento: null = nunca fechado. Quando fechado:
    // { em, foto, benchmarkId? } — números CONGELADOS na hora de fechar
    // (fechamentoEvento.js); nenhum caminho de leitura recalcula.
    fechamento: null,
    // Ponte com o Financeiro (Sessão H, sugestão 11): vínculo opcional com um
    // evento do Financeiro — null = sem vínculo; nenhum cálculo usa.
    financeiro: null,
    // vínculo do RITMO (SPEC-PONTE-RITMO, Marco 23/07/2026): edição da
    // Tiqueteira escolhida UMA vez para o bloco "Ritmo real" da aba Receita.
    // {edicaoId, edicaoNome} ou null; a curva nunca é persistida (leitura viva).
    ritmoTiqueteira: null,
    // Tipo de festa (Sessão N, sugestão 16): opcional — '' = "sem categoria".
    // Nenhum cálculo usa; só agrupamento na Home e, na Fase 2, a curva por festa.
    tipo: '',
    // Desconto do cupom em % (Sessão N, sugestão 17 — MUDA FÓRMULA, aprovada
    // pelo Marco em 18/07/2026): '' = 0% = conta idêntica à anterior.
    // Ver a fórmula na doc de bilheteria() em calc.js.
    descontoMedioPct: '',
    // Ingressos com desconto (Sessão F2-R, sugestão 29a — conta aprovada pelo
    // Marco em 19/07/2026): desconto efetivo = cupom × fração. Modo '' = %
    // e valor '' = 100% (cupom em todos) = comportamento de sempre; modo
    // 'numero' = fração min(1, nº ÷ vendidos do cenário), POR CENÁRIO.
    // Ver descontoEfetivoPct() em calc.js.
    descontoIngressosModo: '',
    descontoIngressosValor: '',
    // Taxa paga por quem (Sessão F2-R, sugestão 29b — conta aprovada pelo
    // Marco em 19/07/2026): '' = "paga por nós" (padrão, taxa desconta da
    // receita = conta de sempre); 'cliente' = repasse, taxa NÃO desconta e o
    // preço final ao cliente = pós-desconto × (1 + taxa). Cashback igual nos
    // dois modos. Ver isTaxaCliente() em calc.js.
    taxaPagaPor: '',
    // Imposto sobre a receita (Marco, 27/07/2026 — desenho aprovado por
    // questionário). UMA alíquota por evento e TRÊS chaves de liga-desliga,
    // porque "nem sempre vai ter imposto sobre cada categoria" (palavras
    // dele). Nasce VAZIA e com as três chaves DESLIGADAS — inclusive no
    // evento novo: o app nunca inventa uma alíquota de imposto, do mesmo jeito
    // que nunca inventa um ticket de bar. Nesse estado calc.js nem acrescenta
    // a chave `imposto` ao cenário: o resultado é o de sempre, ao centavo.
    // A base da bilheteria é a BRUTA (antes da comissão e do cashback) — a
    // regra e a conta que a sustenta estão em src/lib/imposto.js.
    impostoPct: '',
    impostoSobre: { bilheteria: false, bar: false, patrocinio: false },
    // Modo da curva do plano (Sessão F2-B, sugestão 14 — decisão do Marco:
    // DOIS modos com seletor): '' = padrão "pela forma histórica";
    // 'datas' = pelas viradas previstas dos lotes. Nenhum cálculo usa.
    curvaModo: '',
    // Referência da curva (Sessão F2-S — sugestão 30): quem alimenta a linha
    // histórica E a forma do plano. modo '' = média da festa (padrão de
    // sempre) · 'grupo' = festas escolhidas por checkbox · 'festa' = uma
    // específica; itens = [{ id, nome }] das festas do Financeiro (nome
    // guardado para o rótulo sobreviver a cache limpo). Nenhum cálculo usa.
    curvaRef: { modo: '', itens: [] },
    // Caixa inicial do evento (Sessão F2-C — aba Análise, conta aprovada pelo
    // Marco em 19/07/2026): opcional, '' = R$ 0. Nenhum cálculo de cenário usa
    // — só o saldo dia a dia da Análise.
    caixaInicial: '',
    // Início de vendas (Sessão F2-S — sugestão 30, fórmula construída com o
    // Marco em 19/07/2026): data em que as vendas ABREM. Opcional ('' = sem
    // início = curva/Análise/ritmo como sempre). NENHUM cálculo de cenário lê
    // — só a janela normalizada da curva (curvaVendas.js).
    inicioVendas: '',
    // Premissa "vendas abrem N dias antes" NASCIDA com o evento (herança só
    // no nascimento — premissas.js): quando o campo acima está vazio e o
    // evento tem data, o início efetivo = data − N dias (inicioVendasEfetivo
    // em curvaVendas.js). '' = sem premissa. O campo de data sempre vence.
    vendasAbremDiasAntes: '',
    lotes: [
      ...LOTES_PADRAO.map((nome) => novoLote({ nome })),
      novoLote({ nome: 'Lote Porta', somenteOtimista: true }),
      novoLote({ nome: 'Cortesia', valor: 0 }),
    ],
    categorias: CATEGORIAS_PADRAO.map((c) => ({ id: c.key, nome: c.nome, padrao: true, itens: [] })),
    // Grade COMPLETA dos 3 cenários (sugestão 19): todo cenário tem vendaPct
    // e custoPct explícitos. realista.custoPct 0 e otimista.vendaPct 100 são
    // os valores que calc.js já usava de fallback — evento novo calcula
    // idêntico ao de antes; evento antigo sem os campos cai no fallback.
    cenariosConfig: {
      pessimista: { vendaPct: 80, custoPct: 10 },
      realista: { vendaPct: 90, custoPct: 0 },
      otimista: { vendaPct: 100, custoPct: -5 },
      overrides: { pessimista: {}, realista: {}, otimista: {} },
    },
    // Marca da subida do pessimista 70 → 80 (Marco, 27/07/2026). O evento
    // NOVO já nasce marcado, e isso não é enfeite: a migração roda a cada
    // abertura do app, e sem a marca um 70 digitado DE PROPÓSITO num evento
    // recém-criado voltaria sozinho para 80 na próxima abertura. Ver
    // `subirPessimistaPara80` em migracao.js.
    padraoPessimista80: { de: null },
    benchmarksAtivos: ['bm-cordel', 'bm-brisa-1205', 'bm-marfim-0905', 'bm-brisa-1403'],
  }
}
