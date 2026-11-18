import { describe, it, expect } from 'vitest'
import {
  URL_FINANCEIRO,
  MSG_FINANCEIRO_FECHADO,
  MSG_RESPOSTA_ESTRANHA,
  CATEGORIA_TAXAS,
  normalizarNome,
  categoriaDestino,
  validarEventosFinanceiro,
  buscarEventosFinanceiro,
  salvarVinculo,
  acharItemPonte,
  montarPropostas,
  prepararAplicacaoFinanceiro,
  fmtDataHora,
  carimboCampo,
  carimboItem,
} from './financeiro.js'
import { novoEvento, novoItem } from './defaults.js'
import { migrarEvento } from './migracao.js'
import { computeCenarios } from './calc.js'
import { clone } from './util.js'

const AGORA = '2026-07-18T14:32:00.000Z'

// Resposta da rota EXATAMENTE no formato documentado no item 11a do BACKLOG.md
// do Financeiro (Sessão G).
const respostaRota = () => ({
  eventos: [
    {
      evento_id: 1,
      nome: 'Turnê Exterior #2',
      data: '2026-06-13',
      status: 'realizado',
      empresa_id: 1,
      empresa: 'Marfim Alto',
      ingressos_aprovados: 143,
      receita_ingressos: 34000,
      receita_total: 41000,
      custos_total: 21500,
      custos_por_categoria: [
        { categoria: 'A&B / CMV', grupo: 'custo_evento', total: 3500 },
        { categoria: 'Artístico / DJ', grupo: 'custo_evento', total: 8000 },
        { categoria: 'Taxas de plataforma', grupo: 'custo_evento', total: 2000 },
        { categoria: 'Segurança', grupo: 'custo_evento', total: 3000 },
        { categoria: 'Locação do espaço', grupo: 'custo_evento', total: 5000 },
      ],
    },
    {
      evento_id: 2,
      nome: 'Brisa #3',
      data: '2026-08-22',
      status: 'planejado',
      empresa_id: 2,
      empresa: 'Sobrado',
      ingressos_aprovados: 0,
      receita_ingressos: 0,
      receita_total: 0,
      custos_total: 0,
      custos_por_categoria: [],
    },
  ],
})

const efNYC = () => validarEventosFinanceiro(respostaRota())[0]
const efVazio = () => validarEventosFinanceiro(respostaRota())[1]

// O harness escolhe explicitamente o destino; o motor nunca infere esta ação.
function aplicarSelecionados(e, ef, propostas, selecionados, em) {
  const escolhas = {}; const novosItens = {}
  for (const id of selecionados) {
    const p = propostas.find(p=>p.id===id || (p.grupo==='custos' && `custo:${normalizarNome(p.rotulo)}`===id))
    if (!p) { escolhas[id]={selecionado:true}; continue }
    let destino=p.destinoReconhecido
    if (p.grupo==='custos' && !destino) { destino={tipo:'novo',catId:p.sugestao.id,chaveGrupo:p.id}; novosItens[p.id]=novoItem({servico:`${p.rotulo} (Financeiro)`}) }
    escolhas[p.id]={selecionado:true,destino}
  }
  return prepararAplicacaoFinanceiro(e,ef,escolhas,{em,novosItens})
}

describe('normalizarNome', () => {
  it('ignora acento, caixa e espaços duplicados', () => {
    expect(normalizarNome('Ativaçao')).toBe(normalizarNome('Ativação'))
    expect(normalizarNome('  SEGURANÇA ')).toBe('seguranca')
    expect(normalizarNome('A&B  /  CMV')).toBe('a&b / cmv')
  })
})

describe('validarEventosFinanceiro', () => {
  it('normaliza a resposta documentada da rota', () => {
    const evs = validarEventosFinanceiro(respostaRota())
    expect(evs).toHaveLength(2)
    expect(evs[0]).toMatchObject({
      id: 1,
      nome: 'Turnê Exterior #2',
      empresa: 'Marfim Alto',
      ingressosAprovados: 143,
      receitaIngressos: 34000,
      custosTotal: 21500,
    })
    expect(evs[0].custosPorCategoria).toHaveLength(5)
    expect(evs[0].custosPorCategoria[0]).toEqual({ categoriaId: null, categoria: 'A&B / CMV', total: 3500 })
  })

  it('formato irreconhecível → null (quem chama avisa, nada é sobrescrito)', () => {
    expect(validarEventosFinanceiro(null)).toBeNull()
    expect(validarEventosFinanceiro({})).toBeNull()
    expect(validarEventosFinanceiro({ eventos: 'lixo' })).toBeNull()
    expect(validarEventosFinanceiro({ eventos: [{ nome: 'sem id' }] })).toBeNull()
  })

  it('linha de custo malformada recusa a resposta inteira com aviso', () => {
    const resp = respostaRota()
    resp.eventos[0].custos_por_categoria.push(null, { total: 99 })
    expect(validarEventosFinanceiro(resp)).toBeNull()
  })
})

describe('buscarEventosFinanceiro (fetch injetado — o real só ao vivo)', () => {
  it('servidor fechado (fetch lança) → mensagem "Abra o Financeiro…"', async () => {
    const f = () => Promise.reject(new TypeError('Failed to fetch'))
    await expect(buscarEventosFinanceiro(f)).rejects.toThrow(MSG_FINANCEIRO_FECHADO)
  })

  it('HTTP de erro → mensagem em português com o status, nada alterado', async () => {
    const f = () => Promise.resolve({ ok: false, status: 500 })
    await expect(buscarEventosFinanceiro(f)).rejects.toThrow('HTTP 500')
  })

  it('corpo que não é JSON → resposta estranha', async () => {
    const f = () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('x')) })
    await expect(buscarEventosFinanceiro(f)).rejects.toThrow(MSG_RESPOSTA_ESTRANHA)
  })

  it('JSON fora do formato → resposta estranha', async () => {
    const f = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ foo: 1 }) })
    await expect(buscarEventosFinanceiro(f)).rejects.toThrow(MSG_RESPOSTA_ESTRANHA)
  })

  it('resposta válida → lista normalizada, consultando a URL única aprovada', async () => {
    let urlChamada = null
    const f = (url) => {
      urlChamada = url
      return Promise.resolve({ ok: true, json: () => Promise.resolve(respostaRota()) })
    }
    const evs = await buscarEventosFinanceiro(f)
    expect(urlChamada).toBe(URL_FINANCEIRO)
    expect(urlChamada.startsWith('http://localhost:8777/')).toBe(true)
    expect(evs).toHaveLength(2)
  })
})

describe('categoriaDestino (mapa Financeiro → categorias da previsão)', () => {
  const cats = () => novoEvento('X').categorias

  it.each([
    ['A&B / CMV', 'aeb'],
    ['Artístico / DJ', 'artistico'],
    ['Ativaçao', 'marketing'],
    ['Documentação / Alvarás', 'locacao'],
    ['Equipe de evento', 'equipe'],
    ['Estrutura / Cenografia', 'estrutura'],
    ['Locação do espaço', 'locacao'],
    ['Outras despesas', 'extras'],
    ['Produção / Outros custos', 'equipe'],
    ['Segurança', 'equipe'],
  ])('%s → %s', (nomeFin, idEsperado) => {
    expect(categoriaDestino(nomeFin, cats()).id).toBe(idEsperado)
  })

  it('categoria homônima criada pelo usuário vence o mapa', () => {
    const lista = [...cats(), { id: 'minha', nome: 'Segurança', padrao: false, itens: [] }]
    expect(categoriaDestino('Segurança', lista).id).toBe('minha')
  })

  it('nome desconhecido cai em extras', () => {
    expect(categoriaDestino('Categoria Nova Qualquer', cats()).id).toBe('extras')
  })

  it('sem extras usa a última categoria; sem nenhuma → null', () => {
    const soDuas = cats().filter((c) => c.id === 'aeb' || c.id === 'equipe')
    expect(categoriaDestino('Categoria Nova Qualquer', soDuas).id).toBe('equipe')
    expect(categoriaDestino('Qualquer', [])).toBeNull()
  })
})

describe('salvarVinculo', () => {
  it('primeira escolha grava o vínculo sem carimbos', () => {
    const e = salvarVinculo(migrarEvento(novoEvento('X')), efNYC())
    expect(e.financeiro).toEqual({
      eventoId: 1,
      eventoNome: 'Turnê Exterior #2',
      empresa: 'Marfim Alto',
      atualizadoEm: null,
      puxado: {},
    })
  })

  it('reescolher o MESMO evento preserva carimbos; trocar de evento zera', () => {
    let e = salvarVinculo(migrarEvento(novoEvento('X')), efNYC())
    e = {
      ...e,
      financeiro: {
        ...e.financeiro,
        atualizadoEm: AGORA,
        puxado: { vendidosAteHoje: { valor: 143, em: AGORA } },
      },
    }
    const mesmo = salvarVinculo(e, efNYC())
    expect(mesmo.financeiro.puxado.vendidosAteHoje.valor).toBe(143)
    expect(mesmo.financeiro.atualizadoEm).toBe(AGORA)
    const outro = salvarVinculo(e, efVazio())
    expect(outro.financeiro).toMatchObject({ eventoId: 2, atualizadoEm: null, puxado: {} })
  })
})

describe('montarPropostas (tela de revisão — nada é aplicado aqui)', () => {
  it('monta bilheteria e custos e mantém pagamentos somente informativos', () => {
    const e = migrarEvento(novoEvento('X'))
    const { propostas } = montarPropostas(e, efNYC())
    const ids = propostas.map((p) => p.id)
    expect(ids).not.toContain('vendidos')
    expect(ids).toContain('bilheteria')
    // 5 categorias de custo − taxas excluída = 4
    expect(propostas.filter((p) => p.grupo === 'custos')).toHaveLength(4)
    expect(propostas.every(p=>!p.selecionadaInicialmente)).toBe(true)
    const seg = propostas.find((p) => p.rotulo === 'Segurança')
    expect(seg).toMatchObject({ sugestao: {nome:'Equipe'}, reconhecida: false, novo: 3000 })
  })

  it('Taxas de plataforma NUNCA vira item de custo — vira aviso explícito', () => {
    const { propostas, avisos } = montarPropostas(migrarEvento(novoEvento('X')), efNYC())
    expect(propostas.some((p) => p.rotulo === CATEGORIA_TAXAS)).toBe(false)
    expect(avisos.some((a) => a.includes('Taxas de plataforma'))).toBe(true)
  })

  it('valor atual preenchido aparece na comparação; igual → mudou: false', () => {
    const e = { ...migrarEvento(novoEvento('X')), receitaRealizada:{bilheteria:34000} }
    const vend = montarPropostas(e, efNYC()).propostas.find((p) => p.id === 'bilheteria')
    expect(vend).toMatchObject({ atual:34000, novo:34000, mudou:false })
  })

  it('evento do Financeiro sem lançamentos → só avisos, nenhuma proposta', () => {
    const { propostas, avisos } = montarPropostas(migrarEvento(novoEvento('X')), efVazio())
    expect(propostas).toHaveLength(0)
    expect(avisos.length).toBeGreaterThan(0)
  })

  it('realizado digitado à mão aparece como candidato explícito, sem escolha automática', () => {
    const e = migrarEvento(novoEvento('X'))
    e.categorias = e.categorias.map((c) =>
      c.id === 'aeb' ? { ...c, itens: [novoItem({ servico: 'Gelo', realizado: 900 })] } : c
    )
    const { propostas } = montarPropostas(e, efNYC())
    const p=propostas.find(p=>p.rotulo==='A&B / CMV')
    expect(p.destinoReconhecido).toBeNull()
    expect(p.candidatos.some(c=>c.item.servico==='Gelo' && c.item.realizado===900)).toBe(true)
  })

  it('item-ponte existente → proposta atualiza (não cria) e mostra o valor atual dele', () => {
    const e = migrarEvento(novoEvento('X'))
    const aplicado = aplicarSelecionados(e, efNYC(), montarPropostas(e, efNYC()).propostas, ['custo:a&b / cmv'], AGORA).evento
    const p = montarPropostas(aplicado, efNYC()).propostas.find((x) => x.rotulo === 'A&B / CMV')
    expect(p).toMatchObject({ reconhecida: true, atual: 3500, novo: 3500, mudou: false })
  })
})

describe('aplicarSelecionados (só o que foi escolhido, com carimbo, sem mutar)', () => {
  const base = () => migrarEvento(novoEvento('X'))
  const tudo = (e, ef) => {
    const { propostas } = montarPropostas(e, ef)
    return { propostas, ids: propostas.map((p) => p.id) }
  }

  it('aplica SOMENTE os selecionados', () => {
    const e = base()
    const { propostas } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ['bilheteria'], AGORA)
    expect(r.evento.vendidosAteHoje).toBe(e.vendidosAteHoje)
    expect(r.evento.receitaRealizada.bilheteria).toBe(34000) // único selecionado
    expect(r.evento.categorias.every((c) => (c.itens || []).length === 0)).toBe(true)
    expect(r.aplicados).toHaveLength(1)
  })

  it('bilheteria entra em receitaRealizada preservando o bar', () => {
    const e = { ...base(), receitaRealizada: { bilheteria: '', bar: 7000 } }
    const { propostas } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ['bilheteria'], AGORA)
    expect(r.evento.receitaRealizada).toEqual({ bilheteria: 34000, bar: 7000 })
  })

  it('custo cria item-ponte na categoria mapeada, com carimbo e status PAGO', () => {
    const e = base()
    const { propostas } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ['custo:a&b / cmv'], AGORA)
    const aeb = r.evento.categorias.find((c) => c.id === 'aeb')
    expect(aeb.itens).toHaveLength(1)
    expect(aeb.itens[0]).toMatchObject({
      servico: 'A&B / CMV (Financeiro)',
      realizado: 3500,
      status: 'PAGO',
      viaFinanceiro: { versao:2, valor:3500, em:AGORA,origens:[{eventoId:1,categoriaId:null,categoria:'A&B / CMV',valor:3500,em:AGORA}] },
    })
  })

  it('aplicar DUAS vezes não duplica nada — atualiza os mesmos itens', () => {
    const e = base()
    const { propostas, ids } = tudo(e, efNYC())
    const uma = aplicarSelecionados(e, efNYC(), propostas, ids, AGORA).evento
    const m2 = montarPropostas(uma, efNYC())
    const duas = aplicarSelecionados(uma, efNYC(), m2.propostas, m2.propostas.map((p) => p.id), AGORA).evento
    expect(duas).toEqual(uma)
    const totalItens = (ev) => ev.categorias.reduce((s, c) => s + (c.itens || []).length, 0)
    expect(totalItens(duas)).toBe(4)
  })

  it('valor novo do Financeiro atualiza o item-ponte existente (não cria outro)', () => {
    const e = base()
    const { propostas } = tudo(e, efNYC())
    const uma = aplicarSelecionados(e, efNYC(), propostas, ['custo:a&b / cmv'], AGORA).evento
    const efNovo = efNYC()
    efNovo.custosPorCategoria = efNovo.custosPorCategoria.map((c) =>
      c.categoria === 'A&B / CMV' ? { ...c, total: 4200 } : c
    )
    const m2 = montarPropostas(uma, efNovo)
    const duas = aplicarSelecionados(uma, efNovo, m2.propostas, ['custo:a&b / cmv'], '2026-07-19T10:00:00.000Z').evento
    const aeb = duas.categorias.find((c) => c.id === 'aeb')
    expect(aeb.itens).toHaveLength(1)
    expect(aeb.itens[0].realizado).toBe(4200)
    expect(aeb.itens[0].viaFinanceiro.em).toBe('2026-07-19T10:00:00.000Z')
  })

  it('lote de travas (item 4): aplicar valor do Financeiro num item-ponte LIMPA realizadoAuto', () => {
    // sem isto, o item 4 REGREDIRIA: um realizado gravado por parcelas
    // (realizadoAuto=true) sobrescrito pelo Financeiro ficaria com a flag stale,
    // e um desmarcar posterior apagaria o valor do Financeiro. A gravação
    // externa não é a da última parcela → a flag tem de zerar.
    const e = base()
    const { propostas } = tudo(e, efNYC())
    let uma = aplicarSelecionados(e, efNYC(), propostas, ['custo:a&b / cmv'], AGORA).evento
    uma = {
      ...uma,
      categorias: uma.categorias.map((c) =>
        c.id === 'aeb' ? { ...c, itens: c.itens.map((i) => ({ ...i, realizadoAuto: true })) } : c
      ),
    }
    expect(uma.categorias.find((c) => c.id === 'aeb').itens[0].realizadoAuto).toBe(true)
    const efNovo = efNYC()
    efNovo.custosPorCategoria = efNovo.custosPorCategoria.map((c) =>
      c.categoria === 'A&B / CMV' ? { ...c, total: 4200 } : c
    )
    const m2 = montarPropostas(uma, efNovo)
    const duas = aplicarSelecionados(uma, efNovo, m2.propostas, ['custo:a&b / cmv'], AGORA).evento
    const item = duas.categorias.find((c) => c.id === 'aeb').itens[0]
    expect(item.realizado).toBe(4200)
    expect(item.realizadoAuto).toBe(false) // flag zerada — o 4200 não será apagado por um desmarcar
  })

  it('o evento original NÃO muta', () => {
    const e = base()
    const congelado = clone(e)
    const { propostas, ids } = tudo(e, efNYC())
    aplicarSelecionados(e, efNYC(), propostas, ids, AGORA)
    expect(e).toEqual(congelado)
  })

  it('grava vínculo + atualizadoEm + carimbos puxados', () => {
    const e = base()
    const { propostas } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ['bilheteria'], AGORA)
    expect(r.evento.financeiro).toMatchObject({
      eventoId: 1,
      eventoNome: 'Turnê Exterior #2',
      atualizadoEm: AGORA,
      puxado: {
        bilheteria: { valor: 34000, em: AGORA },
      },
    })
  })

  it('bilheteria NÃO muda nenhum número de cenário (fórmulas intocadas)', () => {
    const e = base()
    e.lotes = e.lotes.map((l, i) => ({ ...l, valor: l.valor === 0 ? 0 : 80 + i * 10, quantidade: 100 }))
    const antes = computeCenarios(e)
    const { propostas } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ['bilheteria'], AGORA)
    expect(computeCenarios(r.evento)).toEqual(antes)
  })

  it('funciona em evento de backup ANTIGO (migrado, sem os campos novos de fábrica)', () => {
    const antigo = novoEvento('Antigo')
    delete antigo.receitaRealizada
    delete antigo.financeiro
    const e = migrarEvento(antigo)
    const { propostas, ids } = tudo(e, efNYC())
    const r = aplicarSelecionados(e, efNYC(), propostas, ids, AGORA)
    expect(r.evento.vendidosAteHoje).toBe(e.vendidosAteHoje)
    expect(r.evento.receitaRealizada.bilheteria).toBe(34000)
    expect(r.aplicados).toHaveLength(ids.length)
  })
})

describe('acharItemPonte', () => {
  it('acha o item pela chave da origem, em qualquer categoria da previsão', () => {
    const e = migrarEvento(novoEvento('X'))
    const { propostas } = montarPropostas(e, efNYC())
    const com = aplicarSelecionados(e, efNYC(), propostas, ['custo:seguranca'], AGORA).evento
    const ponte = acharItemPonte(com, {eventoId:1,categoriaId:null,categoria:'Segurança'})
    expect(ponte.catId).toBe('equipe')
    expect(ponte.item.realizado).toBe(3000)
    expect(acharItemPonte(com, {eventoId:1,categoriaId:null,categoria:'A&B / CMV'})).toBeNull()
  })
})

describe('carimbos de origem e hora', () => {
  it('fmtDataHora → "18/07 HH:MM" (fuso local); inválida → vazio', () => {
    expect(fmtDataHora('2026-07-18T14:32:00')).toBe('18/07 14:32')
    expect(fmtDataHora('lixo')).toBe('')
  })

  it('campo igual ao puxado → "via Financeiro em …"', () => {
    const c = carimboCampo({ valor: 143, em: '2026-07-18T14:32:00' }, 143)
    expect(c.manual).toBe(false)
    expect(c.texto).toBe('via Financeiro em 18/07 14:32')
  })

  it('campo editado depois → deixa claro que a mão venceu', () => {
    const c = carimboCampo({ valor: 143, em: '2026-07-18T14:32:00' }, 150)
    expect(c.manual).toBe(true)
    expect(c.texto).toContain('editado à mão')
  })

  it('nunca puxado → sem carimbo', () => {
    expect(carimboCampo(null, 10)).toBeNull()
    expect(carimboItem(novoItem({ realizado: 10 }))).toBeNull()
  })

  it('carimboItem lê viaFinanceiro do item', () => {
    const item = novoItem({ realizado: 3500, viaFinanceiro: { categoria: 'A&B / CMV', valor: 3500, em: '2026-07-18T14:32:00' } })
    expect(carimboItem(item).manual).toBe(false)
  })
})


// ————— Ponte de RITMO (SPEC-PONTE-RITMO, 23/07/2026) —————
import { describe as _dR, it as _iR, expect as _eR } from 'vitest'
import {
  validarCurvaEdicoes as _valR, buscarCurvaEdicoes as _busR,
  salvarEdicaoRitmo as _salR, resumoRitmo as _resR,
  pctDoPrevisto as _pctR, ingressosPrevistosRealista as _prevR,
} from './financeiro.js'

const _ED = { evento_id: 9, nome: 'Brisa 14/03', data: '2026-03-14', dias: [],
  total_pagamentos: 735, total_ingressos: 900, total_valor: 170408,
  ingressos_completos: true }

_dR('ponte de ritmo', () => {
  _iR('validar aceita o formato real e recusa os tortos', () => {
    _eR(_valR({ edicoes: [_ED] })).toEqual([_ED])
    _eR(_valR({ edicoes: [{ nome: 1 }] })).toBe(null)
    _eR(_valR({})).toBe(null)
  })
  _iR('buscar: 404 explica que o Financeiro aberto é antigo', async () => {
    const f = async () => ({ ok: false, status: 404 })
    await _eR(_busR(f, 'http://localhost:4173')).rejects.toThrow(/feche e abra o Financeiro/)
  })
  _iR('buscar: resposta boa devolve as edições', async () => {
    const f = async () => ({ ok: true, json: async () => ({ edicoes: [_ED] }) })
    _eR(await _busR(f, 'http://localhost:4173')).toEqual([_ED])
  })
  _iR('salvarEdicaoRitmo grava id+nome e não toca o resto', () => {
    const ev = _salR({ nome: 'Brisa', lotes: [] }, _ED)
    _eR(ev.ritmoTiqueteira).toEqual({ edicaoId: 9, edicaoNome: 'Brisa 14/03' })
    _eR(ev.nome).toBe('Brisa')
  })
  _iR('resumoRitmo: base honesta por cobertura de itens', () => {
    _eR(_resR(_ED).base).toBe('ingresso')
    _eR(_resR(_ED).vendidos).toBe(900)
    const semItens = { ..._ED, ingressos_completos: false }
    _eR(_resR(semItens).base).toBe('pagamento')
    _eR(_resR(semItens).vendidos).toBe(735)
    _eR(_resR(semItens).rotulo).toMatch(/PAGAMENTOS/)
  })
  _iR('pctDoPrevisto: conta exata e zero vira null (sem % inventado)', () => {
    _eR(_pctR(210, 800)).toBe(26.3)
    _eR(_pctR(5, 0)).toBe(null)
  })
  _iR('ingressosPrevistosRealista usa o cenariosConfig do evento (achado 3 da lente 2)', () => {
    // com o vendaPct do realista em 90% (evento novo), 100+50 → 90+45=135 —
    // o MESMO número que computeCenario mostra na aba; sem cfg, cai no
    // fallback do calc, que desde 27/07/2026 também é 90% (decisão B do
    // Marco; era 100%), idêntico ao comportamento do computeCenario
    // lotes COM preço (lote sem valor é cortesia para o calc — e cortesia
    // vende 100% sempre, em qualquer cenário; o 1º fixture esqueceu isso)
    const ev = {
      lotes: [{ id: 'a', quantidade: 100, valor: 80 }, { id: 'b', quantidade: 50, valor: 100 }],
      cenariosConfig: { realista: { vendaPct: 90 } },
    }
    _eR(_prevR(ev)).toBe(135)
    _eR(_prevR({ lotes: ev.lotes })).toBe(135)
    // 100 GRAVADO continua esgotando — o padrão não reescreve escolha salva.
    _eR(_prevR({ lotes: ev.lotes, cenariosConfig: { realista: { vendaPct: 100 } } })).toBe(150)
    // override do realista para um lote vale também (mesma régua, sempre)
    const ov = { ...ev, cenariosConfig: { ...ev.cenariosConfig, overrides: { realista: { a: 10 } } } }
    _eR(_prevR(ov)).toBe(55)
  })
})
