// Versão de reunião (Sessão Q — sugestão 24 do MELHORIAS.md): "congelar esta
// versão" com nome e data, para comparar depois com o estado atual (lucros
// por cenário, custo total, receita, semáforo).
//
// Reusa o MECANISMO da rede de proteção (Sessão C, protecao.js): chave própria
// do localStorage, helpers puros separados da camada que toca storage, retorno
// { ok, erro } — nada falha em silêncio. Diferença DELIBERADA dos snapshots:
// versão congelada NÃO rotaciona — um registro de reunião não pode evaporar
// sozinho; quando o limite enche, a gravação RECUSA com mensagem clara e o
// Marco escolhe o que excluir (lista na Proteção de dados).
//
// Nada muda em dados existentes: o store principal não é tocado — congelar só
// LÊ o evento e guarda uma cópia em chave separada.

import { uid, clone, agora, armazenamentoUsavel, num } from './util.js'
import { computeCenarios, veredito, CENARIO_LABEL } from './calc.js'
import { migrarEvento } from './migracao.js'

const CONGELADAS_KEY = 'previsao-eventos:congeladas:v1'

// Limite duro de versões guardadas (todas as previsões somadas). Sem rotação:
// ao encher, congelar recusa e pede para excluir alguma — nunca descarta.
export const MAX_CONGELADAS = 20

// ————— Helpers puros —————

/** Monta o item congelado (cópia completa do evento + rótulo + data). */
export function novaVersaoCongelada(evento, rotulo, agoraIso = agora()) {
  return {
    id: uid(),
    eventoId: evento.id,
    nomeEvento: evento.nome || 'Sem nome',
    rotulo: (rotulo || '').trim() || 'versão de reunião',
    criadoEm: agoraIso,
    evento: clone(evento),
  }
}

/** Versões congeladas de UM evento (mais recentes primeiro). */
export const congeladasDoEvento = (lista, eventoId) =>
  (lista || []).filter((c) => c.eventoId === eventoId)

/**
 * Comparação resumida congelada × atual — LEITURA pura sobre computeCenarios
 * e veredito (nenhuma fórmula nova; delta é subtração, a mesma aritmética do
 * fechamento). Linhas: lucro dos 3 cenários + receita total e custo total do
 * realista. Semáforo dos dois lados para a tela mostrar a mudança de cor.
 *
 * A CONGELADA PASSA PELA MIGRAÇÃO (25/07/2026 — varredura da decisão 18 do
 * Marco, "corrigir E mostrar"). O lado "agora" vem do store, que `loadStore` já
 * migra; o lado "antes" vinha CRU, e as duas colunas desta tabela eram
 * calculadas com réguas diferentes. Uma versão congelada antes da trava de
 * 22/07 exibia o lucro com o sinal do custo invertido — e o delta ao lado
 * anunciava uma diferença que nunca aconteceu, numa tela feita para ser
 * projetada em reunião. Congeladas não rotacionam: as de antes dessa data
 * ficam guardadas até o Marco excluir.
 *
 * Nada é reescrito: a cópia guardada continua exatamente como foi congelada —
 * a migração acontece só na LEITURA, para a comparação ser entre iguais.
 */
export function resumoComparacao(eventoCongelado, eventoAtual) {
  const congeladoNaReguaDeHoje = migrarEvento(eventoCongelado)
  const antes = computeCenarios(congeladoNaReguaDeHoje)
  const agora_ = computeCenarios(eventoAtual)
  const linhas = [
    ...['pessimista', 'realista', 'otimista'].map((k) => ({
      label: `Lucro (${CENARIO_LABEL[k].toLowerCase()})`,
      antes: antes[k].lucro,
      agora: agora_[k].lucro,
      delta: agora_[k].lucro - antes[k].lucro,
    })),
    {
      label: 'Receita total (realista)',
      antes: antes.realista.receitaTotal,
      agora: agora_.realista.receitaTotal,
      delta: agora_.realista.receitaTotal - antes.realista.receitaTotal,
    },
    // IMPOSTO SOBRE A RECEITA (Marco, 27/07/2026) — a linha que faltava para
    // esta tabela EXPLICAR o que ela mostra.
    //
    // O DEFEITO QUE ISTO FECHA (achado da revisão cética, antes de o Marco ver
    // a tela). Mudando SÓ a alíquota de imposto em Marfim Alto Salao Sul, a
    // tabela projetada na reunião dizia:
    //
    //     Lucro (realista) ........ antes −31.256,25  agora −66.729,76  Δ −35.473,51
    //     Receita total (realista) . antes 364.546,73  agora 364.546,73  Δ 0,00
    //     Custo total (realista) ... antes 395.802,98  agora 395.802,98  Δ 0,00
    //
    // R$ 35.473,51 sumindo do lucro e as DUAS linhas que existem para explicar
    // zeradas. Uma tela de reunião que mostra o efeito e esconde a causa faz o
    // Marco desconfiar de um número certo — que nesta casa custa quase o mesmo
    // que ver um errado.
    //
    // A linha é CONDICIONAL: só aparece quando algum dos dois lados tem imposto
    // configurado. Sem isso, toda comparação de todo evento ganharia uma linha
    // "R$ 0 → R$ 0 · —" que não conta história nenhuma.
    ...(antes.realista.imposto || agora_.realista.imposto
      ? [
          {
            label: 'Imposto sobre a receita (realista)',
            antes: num(antes.realista.imposto?.valor),
            agora: num(agora_.realista.imposto?.valor),
            delta: num(agora_.realista.imposto?.valor) - num(antes.realista.imposto?.valor),
          },
        ]
      : []),
    {
      label: 'Custo total (realista)',
      antes: antes.realista.custoTotal,
      agora: agora_.realista.custoTotal,
      delta: agora_.realista.custoTotal - antes.realista.custoTotal,
    },
  ]
  return {
    linhas,
    semaforo: {
      // O veredito lê margemAlvo/margemMinima do evento, e a migração também
      // normaliza esses dois (fora de 0..100 → padrões 28/20). Uma mínima −20
      // herdada pintava um prejuízo de não-vermelho — o mesmo verde falso, pela
      // porta do semáforo. O lado "antes" usa a MESMA cópia migrada.
      antes: veredito(antes, congeladoNaReguaDeHoje),
      agora: veredito(agora_, eventoAtual),
    },
  }
}

// ————— Camada localStorage (validada ao vivo, nunca lança) —————

export function loadCongeladas() {
  try {
    if (!armazenamentoUsavel()) return []
    const raw = localStorage.getItem(CONGELADAS_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : []
  } catch (e) {
    console.error('Erro ao carregar as versões congeladas', e)
    return []
  }
}

function saveCongeladas(lista) {
  try {
    if (!armazenamentoUsavel()) return { ok: false, erro: 'sem armazenamento' }
    localStorage.setItem(CONGELADAS_KEY, JSON.stringify(lista))
    return { ok: true }
  } catch (e) {
    console.error('Erro ao salvar a versão congelada', e)
    return { ok: false, erro: e?.message || 'quota do navegador esgotada' }
  }
}

/**
 * Congela uma versão do evento. Recusa (com mensagem) quando o limite enche —
 * versão de reunião não rotaciona nem some sozinha.
 */
export function congelarVersao(evento, rotulo, agoraIso = agora()) {
  const lista = loadCongeladas()
  if (lista.length >= MAX_CONGELADAS)
    return {
      ok: false,
      erro: `Já existem ${lista.length} versões congeladas (limite ${MAX_CONGELADAS}). Exclua alguma na Proteção de dados antes de congelar outra.`,
      lista,
    }
  const item = novaVersaoCongelada(evento, rotulo, agoraIso)
  const nova = [item, ...lista]
  const r = saveCongeladas(nova)
  return { ...r, lista: r.ok ? nova : lista, item: r.ok ? item : null }
}

/** Exclui uma versão congelada (ação do Marco na Proteção de dados). */
export function excluirCongelada(itemId) {
  const lista = loadCongeladas()
  const restante = lista.filter((c) => c.id !== itemId)
  const r = saveCongeladas(restante)
  return { ...r, lista: r.ok ? restante : lista }
}
