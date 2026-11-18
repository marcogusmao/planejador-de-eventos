// Ponte 1 com o Financeiro (Sessão H — sugestão 11 do MELHORIAS.md).
//
// Este módulo contém a consulta de leitura da ponte — uma das duas exceções
// aprovada pelo Marco no CLAUDE.md: consulta somente-leitura, disparada por
// clique, ao servidor local do Financeiro (http://localhost:8777). Nada
// automático, nenhum outro destino, nenhuma escrita lá.
//
// Regra da ponte (decisão do Marco, 18/07/2026): toda entrada de dados
// externos passa por revisão com seleção item a item + snapshot de segurança
// antes de aplicar + caminho de desfazer explícito. Por isso o fluxo é em
// três passos: buscar (só lê) → revisar/escolher (montarPropostas) → aplicar
// selecionados (aplicarSelecionados). Nada é pré-aplicado.
//
// Tudo além do fetch é puro e testado em financeiro.test.js.

import { num, somaCentavos } from './util.js';
import { valorConsiderado, custosPorCategoria } from './calc.js';
import { normalizarNome, idFinanceiroValido, chaveOrigemFinanceiro, inspecionarEventoFinanceiro, inspecionarOrigensFinanceiro, moedaEmCentavosValida } from './origensFinanceiro.js';
export { normalizarNome } from './origensFinanceiro.js';
import { fmtBRL2 as fmtBRL } from './format.js';
import { origemAtual, origemAutorizada, origemNaNuvem, msgOrigemErrada } from './ponteOrigem.js';
export const URL_FINANCEIRO = 'http://localhost:8777/api/previsao/eventos';
export const MSG_FINANCEIRO_FECHADO = 'Não deu para falar com o Financeiro. Abra o Financeiro (duplo clique em Iniciar Financeiro.command) e tente de novo.';

// Correção S2 (19/07/2026): mesma armadilha do backup, do lado das LEITURAS —
// app fora da origem autorizada é barrado por CORS e o fetch falha igual a
// servidor fechado. Ver src/lib/ponteOrigem.js.
export const msgConsultaOrigemErrada = origem => msgOrigemErrada(origem, 'a consulta ao Financeiro');
export const MSG_RESPOSTA_ESTRANHA = 'O Financeiro respondeu num formato inesperado — nada foi alterado. Confira se os dois apps estão atualizados.';

// Categoria do Financeiro que NÃO vira item de custo aqui: a previsão já
// desconta a taxa de bilheteria por fórmula (% sobre a receita). Criar um item
// de custo com a taxa realizada contaria a taxa DUAS vezes no DRE previsto —
// exatamente o "número errado mostrado como certo" que o rulebook proíbe.
// A exclusão nunca é silenciosa: vira aviso na tela de revisão.
export const CATEGORIA_TAXAS = 'Taxas de plataforma';

// ————— Normalização e mapa de categorias —————

// Compara nomes sem acento, caixa e espaços duplicados ("Ativaçao" ≡ "Ativação").
// Categorias de custo do Financeiro → id da categoria padrão da previsão.
// Fonte: categorias grupo 'custo_evento' do banco do Financeiro em 18/07/2026.
// Nome desconhecido cai em 'extras' (Extras & Contingência), sempre com o
// destino exibido na revisão — nada é escondido.
const MAPA_CATEGORIAS = {
  'a&b / cmv': 'aeb',
  'artistico / dj': 'artistico',
  'ativacao': 'marketing',
  'documentacao / alvaras': 'locacao',
  'equipe de evento': 'equipe',
  'estrutura / cenografia': 'estrutura',
  'locacao do espaco': 'locacao',
  'outras despesas': 'extras',
  'producao / outros custos': 'equipe',
  'seguranca': 'equipe'
};

/**
 * Decide em qual categoria da previsão um custo do Financeiro entra:
 * 1º categoria com o MESMO nome (sem acento/caixa) — quem cria uma categoria
 *    homônima manda nela; 2º mapa fixo acima; 3º 'extras'; se nada existir
 *    (todas as categorias apagadas), null — a proposta vira aviso.
 */
export function categoriaDestino(nomeFinanceiro, categorias) {
  const lista = Array.isArray(categorias) ? categorias : [];
  if (lista.length === 0) return null;
  const alvo = normalizarNome(nomeFinanceiro);
  const porNome = lista.find(c => normalizarNome(c.nome) === alvo);
  if (porNome) return {
    id: porNome.id,
    nome: porNome.nome
  };
  const idMapa = MAPA_CATEGORIAS[alvo];
  const porMapa = idMapa && lista.find(c => c.id === idMapa);
  if (porMapa) return {
    id: porMapa.id,
    nome: porMapa.nome
  };
  const extras = lista.find(c => c.id === 'extras');
  const destino = extras || lista[lista.length - 1];
  return {
    id: destino.id,
    nome: destino.nome
  };
}

// ————— Validação da resposta da rota —————

/**
 * Valida e normaliza a resposta de GET /api/previsao/eventos (formato
 * documentado no item 11a do BACKLOG.md do Financeiro). Retorna a lista
 * normalizada ou null se o formato for irreconhecível — quem chama avisa e
 * NÃO sobrescreve nada.
 */
export function validarEventosFinanceiro(dados, problemas = []) {
  const recusar = mensagem => {
    problemas.push(mensagem);
    return null;
  };
  if (!dados || !Array.isArray(dados.eventos)) return recusar('A lista de eventos está ausente ou inválida.');
  const ids = new Set();
  const eventos = [];
  const finito = v => typeof v === 'number' && Number.isFinite(v);
  for (const ev of dados.eventos) {
    if (!ev || !idFinanceiroValido(ev.evento_id) || ids.has(ev.evento_id) || typeof ev.nome !== 'string' || !ev.nome.trim() || !Number.isSafeInteger(ev.ingressos_aprovados) || ev.ingressos_aprovados < 0 || !finito(ev.receita_ingressos) || !finito(ev.custos_total) || !Array.isArray(ev.custos_por_categoria)) return recusar(`Evento ${eventos.length + 1}: identificador repetido ou inválido, nome, contagem, receita, custos ou lista de categorias inválidos.`);
    if (!moedaEmCentavosValida(ev.receita_ingressos) || !moedaEmCentavosValida(ev.custos_total)) return recusar(`Evento “${ev.nome}”: receita ou custos contém fração de centavo ou valor fora da faixa segura.`);
    ids.add(ev.evento_id);
    let planoRealizado = null;
    if (Object.hasOwn(ev, 'plano_realizado')) {
      const plano = ev.plano_realizado;
      if (!plano || !finito(plano.receita) || !finito(plano.custos)) return recusar(`Evento “${ev.nome}”: plano_realizado deve informar receita e custos numéricos finitos.`);
      planoRealizado = {
        receita: plano.receita,
        custos: plano.custos
      };
    }
    const chaves = new Set();
    const custosPorCategoria = [];
    for (const c of ev.custos_por_categoria) {
      if (!c || typeof c.categoria !== 'string' || !c.categoria.trim() || !finito(c.total) || !(c.categoria_id == null || idFinanceiroValido(c.categoria_id))) return recusar(`Evento “${ev.nome}”, categoria ${custosPorCategoria.length + 1}: nome, categoria_id ou total inválido.`);
      if (!moedaEmCentavosValida(c.total)) return recusar(`Evento “${ev.nome}”, categoria “${c.categoria}”: total contém fração de centavo ou valor fora da faixa segura.`);
      const categoriaId = c.categoria_id ?? null;
      const chave = chaveOrigemFinanceiro({
        eventoId: ev.evento_id,
        categoriaId,
        categoria: c.categoria
      });
      if (chaves.has(chave)) return recusar(`Evento “${ev.nome}”: categoria “${c.categoria}” repetida ou ambígua.`);
      chaves.add(chave);
      custosPorCategoria.push({
        categoriaId,
        categoria: c.categoria,
        total: c.total
      });
    }
    eventos.push({
      id: ev.evento_id,
      nome: ev.nome,
      data: typeof ev.data === 'string' ? ev.data : '',
      status: typeof ev.status === 'string' ? ev.status : '',
      empresa: typeof ev.empresa === 'string' ? ev.empresa : '',
      ingressosAprovados: ev.ingressos_aprovados,
      receitaIngressos: ev.receita_ingressos,
      custosTotal: ev.custos_total,
      custosPorCategoria,
      planoRealizado
    });
  }
  return eventos;
}

// ————— Consulta de leitura da ponte —————

/**
 * Busca os eventos no Financeiro local. Só LÊ — nenhum dado sai daqui para lá.
 * Lança Error com mensagem em português pronta para a tela:
 * servidor fechado → MSG_FINANCEIRO_FECHADO · app aberto fora da origem
 * autorizada da ponte → msgConsultaOrigemErrada (bloqueio de CORS, não é o
 * Financeiro que está fechado) · resposta fora do formato →
 * MSG_RESPOSTA_ESTRANHA. `fetchFn` e `origem` são injetáveis para teste.
 */
export async function buscarEventosFinanceiro(fetchFn, origem = origemAtual()) {
  // Cópia da nuvem (Marco, 05/10/2026): a ponte não funciona de lá, e a
  // chamada nem é tentada — ver ponteOrigem.js.
  if (origemNaNuvem(origem)) throw new Error(msgConsultaOrigemErrada(origem));
  const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error(MSG_FINANCEIRO_FECHADO);
  let res;
  try {
    res = await f(URL_FINANCEIRO, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
  } catch {
    if (!origemAutorizada(origem)) throw new Error(msgConsultaOrigemErrada(origem));
    throw new Error(MSG_FINANCEIRO_FECHADO);
  }
  if (!res.ok) throw new Error(`O Financeiro respondeu com erro (HTTP ${res.status}) — nada foi alterado. Tente de novo; se continuar, reabra o Financeiro.`);
  let dados;
  try {
    dados = await res.json();
  } catch {
    throw new Error(MSG_RESPOSTA_ESTRANHA);
  }
  const problemas = [];
  const eventos = validarEventosFinanceiro(dados, problemas);
  if (!eventos) throw new Error(`${MSG_RESPOSTA_ESTRANHA} ${problemas.join(' ')}`);
  return eventos;
}

// ————— Vínculo evento↔evento —————

/**
 * Guarda o vínculo com um evento do Financeiro (escolhido na primeira vez e
 * lembrado — campo opcional `financeiro`). Trocar para OUTRO evento zera os
 * carimbos antigos (eram do vínculo anterior); reescolher o mesmo, preserva.
 */
export function salvarVinculo(evento, ef) {
  const anterior = evento.financeiro;
  const mesmo = anterior && anterior.eventoId === ef.id;
  return {
    ...evento,
    financeiro: {
      eventoId: ef.id,
      eventoNome: ef.nome,
      empresa: ef.empresa || '',
      atualizadoEm: mesmo ? anterior.atualizadoEm || null : null,
      puxado: mesmo && anterior.puxado && typeof anterior.puxado === 'object' ? anterior.puxado : {}
    }
  };
}

// ————— Identidades, propostas e aplicação pura —————
export const assinaturaFinanceiro = evento => {
  const ordenar = v => Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenar(v[k])])) : v;
  const {
    atualizadoEm,
    ...persistido
  } = evento;
  return JSON.stringify(ordenar(persistido));
};
export function acharItemPonte(evento, origem) {
  if (!origem || typeof origem !== 'object') return null;
  const chave = chaveOrigemFinanceiro(origem);
  return inspecionarEventoFinanceiro(evento).itens.find(i => i.tipo === 'v2' && i.origens.some(o => chaveOrigemFinanceiro(o) === chave)) || null;
}
export function montarPropostas(evento, ef) {
  const propostas = [];
  const avisos = [];
  const inspecao = inspecionarEventoFinanceiro(evento);
  for (const p of inspecao.problemas) avisos.push(`Item “${p.servico}”: ${p.motivos.join('; ')}. Vínculo preservado, não utilizável; confira em Proteção de dados.`);
  if (!ef.planoRealizado) avisos.push('Esta resposta não permite separar plano de realizado. Confira os valores antes de selecionar.');
  if (ef.receitaIngressos > 0) {
    const atual = evento.receitaRealizada?.bilheteria ?? null;
    propostas.push({
      id: 'bilheteria',
      grupo: 'vendas',
      rotulo: 'Bilheteria realizada (bruta)',
      atual,
      novo: ef.receitaIngressos,
      mudou: atual !== ef.receitaIngressos,
      selecionadaInicialmente: !!ef.planoRealizado && atual !== ef.receitaIngressos,
      formato: 'brl'
    });
  } else avisos.push('Bilheteria não positiva: nada será aplicado no campo de receita.');
  const recebidas = new Set();
  for (const c of ef.custosPorCategoria || []) {
    const origem = {
      eventoId: ef.id,
      categoriaId: c.categoriaId ?? null,
      categoria: c.categoria
    };
    const chave = chaveOrigemFinanceiro(origem);
    recebidas.add(chave);
    if (normalizarNome(c.categoria) === normalizarNome(CATEGORIA_TAXAS)) {
      avisos.push(`“${c.categoria}” (${fmtBRL(c.total)}) ficou de fora: a taxa de bilheteria já é descontada pela fórmula.`);
      continue;
    }
    if (!(typeof c.total === 'number' && Number.isFinite(c.total) && c.total > 0)) {
      avisos.push(`“${c.categoria}”: valor não positivo ou inválido; contribuição anterior mantida.`);
      continue;
    }
    const ponte = acharItemPonte(evento, origem);
    const anterior = ponte?.origens.find(o => chaveOrigemFinanceiro(o) === chave);
    const sugestao = categoriaDestino(c.categoria, evento.categorias);
    if (!sugestao) avisos.push(`“${c.categoria}”: o evento não tem nenhuma categoria de custo para recebê-la.`);
    const mudou = !anterior || anterior.valor !== c.total || anterior.categoria !== c.categoria || ponte.item.realizado !== ponte.item.viaFinanceiro.valor;
    propostas.push({
      id: `custo:${chave}`,
      chave,
      origem,
      grupo: 'custos',
      rotulo: c.categoria,
      categoriaFin: c.categoria,
      novo: c.total,
      atual: anterior?.valor ?? null,
      mudou,
      formato: 'brl',
      selecionadaInicialmente: !!ef.planoRealizado && !!ponte && mudou,
      destinoReconhecido: ponte ? {
        tipo: 'existente',
        catId: ponte.catId,
        itemId: ponte.item.id
      } : null,
      sugestao,
      candidatos: inspecao.itens.filter(i => i.tipo !== 'invalido'),
      origensAnteriores: inspecao.itens.filter(i => i.tipo === 'v2').flatMap(i => i.origens.filter(o => o.eventoId === ef.id).map(o => ({
        ...o,
        chave: chaveOrigemFinanceiro(o),
        itemId: i.item.id,
        catId: i.catId
      }))),
      reconhecida: !!ponte
    });
  }
  const avisosAusentes = [];
  for (const i of inspecao.itens) for (const o of i.origens) if (o.eventoId === ef.id && !recebidas.has(chaveOrigemFinanceiro(o))) avisosAusentes.push({
    chave: chaveOrigemFinanceiro(o),
    texto: `${fmtBRL(o.valor)} mantidos em “${i.item.servico}”; origem “${o.categoria}” não veio nesta consulta.`
  });
  return {
    propostas,
    avisosGerais: avisos,
    avisosAusentes,
    avisos: [...avisos, ...avisosAusentes.map(a => a.texto)]
  };
}
export function prepararAplicacaoFinanceiro(evento, ef, escolhas, contexto = {}) {
  const erros = [];
  const montagem = montarPropostas(evento, ef);
  const avisos = [...montagem.avisosGerais];
  const origensAtualizadas = new Set();
  const inspecao = inspecionarEventoFinanceiro(evento);
  const gruposMapa = new Map();
  const aplicados = [];
  if (evento.status === 'fechado') erros.push('Este evento está fechado — nada foi aplicado.');
  if (contexto.assinatura && contexto.assinatura !== assinaturaFinanceiro(evento)) erros.push('A revisão venceu: o evento mudou. Revise os valores novamente.');
  const entradas = Array.isArray(escolhas) ? escolhas : Object.entries(escolhas || {}).map(([propostaId, e]) => ({
    propostaId,
    ...e
  }));
  const vistos = new Set();
  let e = evento;
  const em = contexto.em;
  const chavesResposta = new Set();
  if (!idFinanceiroValido(ef.id)) erros.push('Identificador do evento do Financeiro inválido.');
  for (const c of ef.custosPorCategoria || []) {
    const o = {
      eventoId: ef.id,
      categoriaId: c.categoriaId ?? null,
      categoria: c.categoria
    };
    const chave = chaveOrigemFinanceiro(o);
    if (!(c.categoriaId == null || idFinanceiroValido(c.categoriaId)) || typeof c.categoria !== 'string' || !c.categoria.trim() || typeof c.total !== 'number' || !Number.isFinite(c.total) || chavesResposta.has(chave)) erros.push('Resposta com categoria, identificador ou valor inválido ou repetido.');
    if (!moedaEmCentavosValida(c.total)) erros.push(`“${c.categoria}”: valor contém fração de centavo ou está fora da faixa segura.`);
    chavesResposta.add(chave);
  }
  if (ef.custosTotal !== undefined && !moedaEmCentavosValida(ef.custosTotal)) erros.push('Total de custos contém fração de centavo ou valor inválido ou fora da faixa segura.');
  if (!moedaEmCentavosValida(ef.receitaIngressos)) erros.push('Bilheteria contém fração de centavo ou valor inválido ou fora da faixa segura.');

  // Reservar identidades na base intacta antes de substituir qualquer contribuição.
  // Adoção e retorno sem ID também reivindicam a identidade que será substituída.
  const reivindicadas = new Map();
  for (const escolha of entradas.filter(x => x.selecionado)) {
    const proposta = montagem.propostas.find(p => p.id === escolha.propostaId);
    if (!proposta || proposta.grupo !== 'custos') continue;
    const chaves = new Set([proposta.chave]);
    if (escolha.substituiOrigemLegada) chaves.add(escolha.substituiOrigemLegada);
    for (const chave of chaves) {
      if (reivindicadas.has(chave)) erros.push(`“${reivindicadas.get(chave)}” e “${proposta.rotulo}” selecionam a mesma contribuição de origem. Escolha somente um desses valores; nada foi aplicado.`);
      else reivindicadas.set(chave, proposta.rotulo);
    }
  }
  if (erros.length) return {
    ok: false, erros, avisos: montagem.avisos, grupos: [],
    previa: { antes: custosPorCategoria(evento.categorias), depois: custosPorCategoria(evento.categorias) },
    evento, aplicados: [],
  };
  for (const escolha of entradas.filter(x => x.selecionado)) {
    const id = escolha.propostaId;
    if (vistos.has(id)) {
      erros.push('Valor selecionado repetido.');
      continue;
    }
    vistos.add(id);
    const p = montagem.propostas.find(p => p.id === id);
    if (!p) {
      erros.push('Valor selecionado não existe nesta resposta.');
      continue;
    }
    if (id === 'bilheteria') {
      if (!Number.isSafeInteger(Math.round(p.novo * 100))) {
        erros.push('Bilheteria fora da faixa segura de centavos.');
        continue;
      }
      e = {
        ...e,
        receitaRealizada: {
          ...e.receitaRealizada,
          bilheteria: p.novo
        }
      };
      aplicados.push(p);
      continue;
    }
    const destino = escolha.destino;
    if (!destino) {
      erros.push(`Escolha o item a atualizar para “${p.rotulo}”.`);
      continue;
    }
    const alvo = destino.tipo === 'existente' ? inspecao.itens.filter(i => i.item.id === destino.itemId && i.catId === destino.catId) : [];
    if (destino.tipo === 'existente' && (alvo.length !== 1 || alvo[0].tipo === 'invalido')) {
      erros.push(`Destino inválido ou vínculo não utilizável para “${p.rotulo}”.`);
      continue;
    }
    if (!evento.categorias.some(c => c.id === destino.catId)) {
      erros.push('Categoria de destino removida.');
      continue;
    }
    if (p.destinoReconhecido && (destino.tipo !== 'existente' || p.destinoReconhecido.itemId !== destino.itemId)) {
      erros.push('Origem já vinculada a outro item.');
      continue;
    }
    const chave = JSON.stringify([destino.tipo, destino.catId, destino.tipo === 'existente' ? destino.itemId : destino.chaveGrupo]);
    let g = gruposMapa.get(chave);
    if (!g) {
      const item = alvo[0]?.item || contexto.novosItens?.[destino.chaveGrupo];
      if (!item) {
        erros.push('Novo item ainda não preparado.');
        continue;
      }
      g = {
        chave,
        destino,
        item,
        origens: [...(alvo[0]?.origens || [])],
        propostas: [],
        chavesAplicadas: new Set(),
        mantidas: [],
        antes: valorConsiderado(item),
        previsto: num(item.estimado)
      };
      gruposMapa.set(chave, g);
    }
    if (escolha.substituiOrigemLegada) {
      const antiga = g.origens.find(o => chaveOrigemFinanceiro(o) === escolha.substituiOrigemLegada);
      if (!antiga || antiga.eventoId !== ef.id || antiga.categoriaId !== null && p.origem.categoriaId !== null) {
        erros.push('Origem anterior não encontrada ou reconhecimento de dois identificadores diferentes recusado.');
        continue;
      }
      g.origens = g.origens.filter(o => chaveOrigemFinanceiro(o) !== escolha.substituiOrigemLegada);
    }
    g.origens = g.origens.filter(o => chaveOrigemFinanceiro(o) !== p.chave);
    const antigaReconhecida = escolha.substituiOrigemLegada && (alvo[0]?.origens || []).find(o => chaveOrigemFinanceiro(o) === escolha.substituiOrigemLegada);
    const origemAplicada = antigaReconhecida?.categoriaId != null && p.origem.categoriaId == null ? {
      ...p.origem,
      categoriaId: antigaReconhecida.categoriaId
    } : p.origem;
    g.origens.push({
      ...origemAplicada,
      valor: p.novo,
      em
    });
    g.chavesAplicadas.add(chaveOrigemFinanceiro(origemAplicada));
    origensAtualizadas.add(p.chave);
    if (escolha.substituiOrigemLegada) origensAtualizadas.add(escolha.substituiOrigemLegada);
    g.propostas.push(p);
    aplicados.push(p);
  }
  const grupos = [...gruposMapa.values()];
  for (const g of grupos) {
    g.origens.sort((a, b) => chaveOrigemFinanceiro(a).localeCompare(chaveOrigemFinanceiro(b)));
    const centavos = g.origens.map(o => Math.round(o.valor * 100));
    const soma = centavos.reduce((a, b) => a + b, 0);
    if (!centavos.every(Number.isSafeInteger) || !Number.isSafeInteger(soma)) erros.push('Total de contribuições fora da faixa segura de centavos.');
    g.total = somaCentavos(g.origens.map(o => o.valor));
    g.mantidas = g.origens.filter(o => !g.chavesAplicadas.has(chaveOrigemFinanceiro(o)));
    g.assinatura = assinaturaFinanceiro({
      destino: g.destino,
      item: g.item,
      origens: g.origens.map(({
        em,
        ...o
      }) => o),
      total: g.total
    });
    g.exigeConfirmacao = g.propostas.some(p => !p.reconhecida) || g.item.viaFinanceiro && g.item.realizado !== g.item.viaFinanceiro.valor;
    if (contexto.exigirConfirmacao && g.exigeConfirmacao && contexto.confirmacoes?.[g.chave] !== g.assinatura) erros.push(`Confirme o total de “${g.item.servico}” antes de aplicar.`);
    const item = {
      ...g.item,
      realizado: g.total,
      realizadoAuto: false,
      custouZero: false,
      status: 'PAGO',
      viaFinanceiro: {
        versao: 2,
        valor: g.total,
        em,
        origens: g.origens
      }
    };
    e = {
      ...e,
      categorias: e.categorias.map(c => c.id !== g.destino.catId ? c : {
        ...c,
        itens: g.destino.tipo === 'novo' ? [...c.itens, item] : c.itens.map(i => i.id === item.id ? item : i)
      })
    };
  }
  if (inspecionarEventoFinanceiro(e).problemas.some(p => !inspecao.problemas.some(a => a.itemId === p.itemId))) erros.push('Resultado contém origens ou destinos repetidos ou metadados inválidos.');
  if (!aplicados.length) erros.push('Nada selecionado para aplicar.');
  avisos.push(...montagem.avisosAusentes.filter(a => !origensAtualizadas.has(a.chave)).map(a => a.texto));
  if (!em || !Number.isFinite(Date.parse(em))) erros.push('Data da aplicação inválida.');
  if (!erros.length) {
    e = salvarVinculo(e, ef);
    const puxado = {
      ...e.financeiro.puxado
    };
    if (aplicados.some(p => p.id === 'bilheteria')) puxado.bilheteria = {
      valor: ef.receitaIngressos,
      em
    };
    e = {
      ...e,
      financeiro: {
        ...e.financeiro,
        atualizadoEm: em,
        puxado
      }
    };
  }
  return {
    ok: !erros.length,
    erros,
    avisos,
    grupos,
    previa: {
      antes: custosPorCategoria(evento.categorias),
      depois: custosPorCategoria(e.categorias)
    },
    evento: erros.length ? evento : e,
    aplicados
  };
}
// Compatibilidade de assinatura: propostas externas não são comandos confiáveis.
export function aplicarSelecionados(evento, ef, propostas, selecionados, em) {
  const escolhas = Object.fromEntries(selecionados.map(id => {
    const p = montarPropostas(evento, ef).propostas.find(x => x.id === id);
    return [id, {
      selecionado: true,
      destino: p?.destinoReconhecido
    }];
  }));
  return prepararAplicacaoFinanceiro(evento, ef, escolhas, {
    em
  });
}

// ————— Carimbos ("via Financeiro em 18/07 14:32") —————

export function fmtDataHora(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

/**
 * Texto do carimbo de um campo puxado. `registro` = { valor, em } guardado em
 * evento.financeiro.puxado; `valorAtual` = o que está no campo agora.
 * - campo igual ao puxado → "via Financeiro em 18/07 14:32"
 * - campo editado depois  → deixa claro que a mão venceu a ponte
 * - nunca puxado → null (sem carimbo)
 */
export function carimboCampo(registro, valorAtual) {
  if (!registro || registro.em == null) return null
  const igual = num(valorAtual) === num(registro.valor)
  return igual
    ? { texto: `via Financeiro em ${fmtDataHora(registro.em)}`, manual: false }
    : { texto: `editado à mão (via Financeiro em ${fmtDataHora(registro.em)})`, manual: true }
}

/** Carimbo de um item de custo criado pela ponte (item.viaFinanceiro). */
export function carimboItem(item) {
  if (!item || item.viaFinanceiro == null) return null
  // O bruto inválido é recuperável no backup, mas não deve chegar ao formatador.
  if (inspecionarOrigensFinanceiro(item.viaFinanceiro).tipo === 'invalido')
    return { texto: 'Vínculo do Financeiro inválido; preservado no backup. Confira em Proteção de dados.', manual: true }
  return carimboCampo(item.viaFinanceiro, item.realizado)
}

// ————— Ponte de RITMO (SPEC-PONTE-RITMO, aprovada pelo Marco 23/07/2026) ————
// Curva real das EDIÇÕES da Tiqueteira (rota nova /api/previsao/curva-edicoes do
// Financeiro), para o bloco "Ritmo real" da aba Receita. Mesmo regime da
// ponte: leitura por clique, nada gravado lá, nada automático. Comparação em
// INGRESSOS (P2=a): quando a edição não tem itens em toda venda, cai para
// PAGAMENTOS com o rótulo do limite (ingressos_completos=false). O vínculo é
// escolhido UMA vez pelo Marco (P3=a) e fica no evento (ritmoTiqueteira).

import { loteQtdCenario } from './calc.js'

export const URL_CURVA_EDICOES = 'http://localhost:8777/api/previsao/curva-edicoes'

export function validarCurvaEdicoes(dados) {
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.edicoes)) return null
  const ok = dados.edicoes.every(
    (e) =>
      e && typeof e === 'object' && e.evento_id != null &&
      typeof e.nome === 'string' && Array.isArray(e.dias)
  )
  return ok ? dados.edicoes : null
}

export async function buscarCurvaEdicoes(fetchFn, origem = origemAtual()) {
  // Cópia da nuvem (Marco, 05/10/2026): a ponte não funciona de lá, e a
  // chamada nem é tentada — ver ponteOrigem.js.
  if (origemNaNuvem(origem)) throw new Error(msgConsultaOrigemErrada(origem))
  const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) throw new Error(MSG_FINANCEIRO_FECHADO)
  let res
  try {
    res = await f(URL_CURVA_EDICOES, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    })
  } catch {
    if (!origemAutorizada(origem)) throw new Error(msgConsultaOrigemErrada(origem))
    throw new Error(MSG_FINANCEIRO_FECHADO)
  }
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? 'O Financeiro aberto ainda não tem a ponte de ritmo — feche e abra o Financeiro (o código novo entra ao reabrir) e busque de novo.'
        : `O Financeiro respondeu com erro (HTTP ${res.status}) — nada foi alterado. Tente de novo; se continuar, reabra o Financeiro.`
    )
  let dados
  try {
    dados = await res.json()
  } catch {
    throw new Error(MSG_RESPOSTA_ESTRANHA)
  }
  const edicoes = validarCurvaEdicoes(dados)
  if (!edicoes) throw new Error(MSG_RESPOSTA_ESTRANHA)
  return edicoes
}

/** Vínculo do RITMO (P3=a): escolhido uma vez, lembrado no evento. Trocar de
 *  edição substitui; a curva em si NUNCA é persistida (leitura ao vivo). */
export function salvarEdicaoRitmo(evento, ed) {
  return {
    ...evento,
    ritmoTiqueteira: { edicaoId: ed.evento_id, edicaoNome: ed.nome || '' },
  }
}

/** Ingressos PREVISTOS do cenário realista: soma das quantidades resolvidas
 *  dos lotes pela MESMA régua do app — calc.loteQtdCenario COM o
 *  cenariosConfig do evento (vendaPct do realista, ex. 90% em evento novo, e
 *  overrides), exatamente como computeCenario passa (calc.js:367). Sem o cfg
 *  a conta saía a 100% (esgotado) e contradizia o realista da própria aba —
 *  achado 3 da lente adversarial nº 2, 23/07/2026. calc segue SÓ CHAMADO. */
export function ingressosPrevistosRealista(evento) {
  const lotes = (evento && evento.lotes) || []
  const cfg = (evento && evento.cenariosConfig) || {}
  return lotes.reduce((s, l) => s + loteQtdCenario(l, 'realista', cfg), 0)
}

/** Resumo do ritmo da edição ligada: base honesta (ingresso × pagamento),
 *  vendidos acumulados, valor, e o rótulo do limite quando for por pagamento. */
export function resumoRitmo(edicao) {
  if (!edicao) return null
  const porIngresso = !!edicao.ingressos_completos
  return {
    base: porIngresso ? 'ingresso' : 'pagamento',
    vendidos: porIngresso ? edicao.total_ingressos || 0 : edicao.total_pagamentos || 0,
    pagamentos: edicao.total_pagamentos || 0,
    valor: edicao.total_valor || 0,
    rotulo: porIngresso
      ? 'ingressos de verdade (toda venda desta edição traz os itens)'
      : 'contando PAGAMENTOS — nem toda venda desta edição traz o nº de ingressos (1 pagamento pode ser 2+ ingressos; o real pode estar um pouco acima)',
  }
}

/** % do previsto, arredondado a 1 casa; previsto 0 → null (sem % inventado). */
export function pctDoPrevisto(vendidos, previstos) {
  const p = num(previstos)
  if (!p || p <= 0) return null
  return Math.round((num(vendidos) / p) * 1000) / 10
}
