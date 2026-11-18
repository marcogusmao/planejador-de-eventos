// Gate 3 — reconciliação do export v2 (o coração do contrato). Ciclo REAL: gera
// a planilha pelo WRITER (exceljs), simula a produtora editando o AOA (muda
// valor, insere linha, apaga linha, troca status), lê pelo SheetJS e reconcilia
// contra o evento. Testa o que o Marco cravou: ciclo real com estado final
// exato, idempotência, auto-matcher sem col A, ambíguo pra revisão, S2 de id
// duplicado, aviso de planilha-copiada, alvo desconhecido, remoções à parte.
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { gerarXlsx } from './xlsxOrcamentoV2.js'
import { parseOrcamentoV2, reconciliar, aplicarReconciliacao, aplicarResolucoes, ehOrcamentoV2 } from './xlsxReconciliar.js'
import { COL_V2 } from './orcamentoV2Contrato.js'
import { novoEvento, novoItem } from './defaults.js'
import { num } from './util.js'

// Evento-base: A&B com 3 itens de id conhecido; Artístico com 2 "DJ" iguais
// (pro teste de ambiguidade).
function eventoBase() {
  const ev = novoEvento('Brisa 05/12')
  ev.tipo = 'Brisa'
  const cat = Object.fromEntries(ev.categorias.map((c) => [c.nome, c]))
  cat['A&B'].itens = [
    novoItem({ servico: 'Bar', fornecedor: 'MZ', estimado: 15000, status: 'ESTIMADO' }),
    novoItem({ servico: 'Insumos', estimado: 3000, status: 'ESTIMADO' }),
    novoItem({ servico: 'Gelo', estimado: 6000, status: 'ORÇADO' }),
  ]
  cat['Artístico'].itens = [
    novoItem({ servico: 'DJ', estimado: 4000, status: 'ESTIMADO' }),
    novoItem({ servico: 'DJ', estimado: 4000, status: 'ESTIMADO' }),
  ]
  return ev
}
const achaItem = (ev, servico) =>
  ev.categorias.flatMap((c) => c.itens).find((i) => i.servico === servico)

async function aoaDoEvento(ev) {
  const buf = await gerarXlsx(ev, {})
  const wb = XLSX.read(buf, { type: 'buffer' })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
}
const linhaDoServico = (aoa, servico) => aoa.findIndex((row) => String(row[COL_V2.servico] ?? '').trim() === servico)
const novaLinha = (servico, estimado, status, fornecedor = '') => {
  const l = Array(11).fill('')
  l[COL_V2.servico] = servico
  l[COL_V2.fornecedor] = fornecedor
  l[COL_V2.estimado] = estimado
  l[COL_V2.status] = status
  return l
}

describe('roteamento — v1 fica intacto', () => {
  it('ehOrcamentoV2: sentinela na A1 = v2; sem sentinela = v1', async () => {
    const aoa = await aoaDoEvento(eventoBase())
    expect(ehOrcamentoV2(aoa)).toBe(true)
    expect(ehOrcamentoV2([['Macro', 'Serviço', 'Valor']])).toBe(false) // planilha v1 → segue no importador antigo
    expect(ehOrcamentoV2([])).toBe(false)
  })
})

describe('A2 carrega o evento-alvo (round-trip do id)', () => {
  it('parseOrcamentoV2 lê o id do evento na A2', async () => {
    const ev = eventoBase()
    const parsed = parseOrcamentoV2(await aoaDoEvento(ev))
    expect(parsed.eventoId).toBe(ev.id)
    expect(parsed.projeto).toBe('Brisa')
  })
})

describe('idempotência — reimportar o arquivo NÃO editado não move nada', () => {
  it('2× o mesmo export = zero mudança', async () => {
    const ev = eventoBase()
    const plano = reconciliar(parseOrcamentoV2(await aoaDoEvento(ev)), ev)
    expect(plano.atualizacoes).toEqual([])
    expect(plano.adicoes).toEqual([])
    expect(plano.remocoes).toEqual([])
    expect(plano.ambiguos).toEqual([])
    expect(plano.avisoProjeto).toBeNull()
    // e aplicar não muda o evento
    const depois = aplicarReconciliacao(ev, plano)
    expect(depois.categorias.flatMap((c) => c.itens).length).toBe(ev.categorias.flatMap((c) => c.itens).length)
  })
})

describe('CICLO REAL — edita valor + insere + apaga + troca status → estado final EXATO', () => {
  it('as 4 operações do ciclo, nada a mais nem a menos', async () => {
    const ev = eventoBase()
    const idBar = achaItem(ev, 'Bar').id
    const idInsumos = achaItem(ev, 'Insumos').id
    const idGelo = achaItem(ev, 'Gelo').id
    const aoa = await aoaDoEvento(ev)

    aoa[linhaDoServico(aoa, 'Bar')][COL_V2.estimado] = 18000 // edita valor
    aoa[linhaDoServico(aoa, 'Insumos')][COL_V2.status] = 'FECHADO' // troca status
    aoa.splice(linhaDoServico(aoa, 'Gelo'), 1) // apaga linha
    aoa.splice(linhaDoServico(aoa, 'Insumos') + 1, 0, novaLinha('Cerveja', 4000, 'ESTIMADO')) // insere linha

    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.atualizacoes.map((a) => a.id).sort()).toEqual([idBar, idInsumos].sort())
    expect(plano.atualizacoes.find((a) => a.id === idBar).campos.estimado.para).toBe(18000)
    expect(plano.atualizacoes.find((a) => a.id === idInsumos).campos.status.para).toBe('FECHADO')
    expect(plano.remocoes.map((r) => r.id)).toEqual([idGelo]) // só o Gelo, na seção própria
    expect(plano.adicoes.map((a) => a.dados.servico)).toEqual(['Cerveja'])
    expect(plano.ambiguos).toEqual([])

    const depois = aplicarReconciliacao(ev, plano)
    const aeb = depois.categorias.find((c) => c.nome === 'A&B').itens
    const porServico = Object.fromEntries(aeb.map((i) => [i.servico, i]))
    expect(Object.keys(porServico).sort()).toEqual(['Bar', 'Cerveja', 'Insumos']) // Gelo saiu
    expect(num(porServico.Bar.estimado)).toBe(18000)
    expect(porServico.Insumos.status).toBe('FECHADO')
    expect(num(porServico.Cerveja.estimado)).toBe(4000)
    expect(porServico.Cerveja.id).toBeTruthy() // item novo ganhou id próprio
    // o original NÃO foi mutado (imutável)
    expect(ev.categorias.find((c) => c.nome === 'A&B').itens.some((i) => i.servico === 'Gelo')).toBe(true)
  })

  it('reaplicar o resultado (2ª volta) é idempotente', async () => {
    const ev = eventoBase()
    const aoa = await aoaDoEvento(ev)
    aoa[linhaDoServico(aoa, 'Bar')][COL_V2.estimado] = 18000
    const depois = aplicarReconciliacao(ev, reconciliar(parseOrcamentoV2(aoa), ev))
    // exporta o resultado e reimporta SEM editar → nada muda
    const plano2 = reconciliar(parseOrcamentoV2(await aoaDoEvento(depois)), depois)
    expect(plano2.atualizacoes).toEqual([])
    expect(plano2.remocoes).toEqual([])
    expect(plano2.adicoes).toEqual([])
  })
})

describe('identidade camada 2 — auto-matcher quando a coluna A sumiu', () => {
  it('linha sem id casa por seção+serviço+fornecedor → é ATUALIZAÇÃO, não remove+adiciona', async () => {
    const ev = eventoBase()
    const idBar = achaItem(ev, 'Bar').id
    const aoa = await aoaDoEvento(ev)
    const rBar = linhaDoServico(aoa, 'Bar')
    aoa[rBar][COL_V2.id] = '' // produtora apagou a coluna oculta
    aoa[rBar][COL_V2.estimado] = 20000 // e mudou o valor
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.atualizacoes.map((a) => a.id)).toEqual([idBar]) // casou pelo conteúdo
    expect(plano.atualizacoes[0].campos.estimado.para).toBe(20000)
    expect(plano.remocoes).toEqual([]) // NÃO virou remoção + adição
    expect(plano.adicoes).toEqual([])
  })
})

describe('ambíguo NUNCA aplica sozinho — vai pra revisão', () => {
  it('dois itens iguais na seção, ambos sem id → ambíguo', async () => {
    const ev = eventoBase() // Artístico tem dois "DJ" iguais (4000)
    const aoa = await aoaDoEvento(ev)
    // apaga a col A das duas linhas de DJ
    aoa.forEach((row) => {
      if (String(row[COL_V2.servico] ?? '').trim() === 'DJ') row[COL_V2.id] = ''
    })
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.ambiguos.length).toBeGreaterThan(0)
    expect(plano.ambiguos[0].motivo).toMatch(/parecidos/)
    // nada de DJ entrou como adição silenciosa
    expect(plano.adicoes.map((a) => a.dados.servico)).not.toContain('DJ')
  })
})

describe('S2 espelhado — id duplicado DENTRO da planilha, nomeando', () => {
  it('dois com o mesmo id → dupIds nomeia e manda pra revisão, não colapsa', async () => {
    const ev = eventoBase()
    const idBar = achaItem(ev, 'Bar').id
    const aoa = await aoaDoEvento(ev)
    aoa[linhaDoServico(aoa, 'Insumos')][COL_V2.id] = idBar // produtora copiou a linha do Bar
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.dupIds).toContain(idBar)
    expect(plano.ambiguos.some((a) => a.motivo.includes(idBar))).toBe(true)
  })
})

describe('planilha-copiada e alvo desconhecido (redes do Marco #1 e #2)', () => {
  it('#1 — PROJETO da planilha não bate com o tipo do alvo → aviso explícito', async () => {
    const evBrisa = eventoBase() // tipo Brisa
    const evMarfim = novoEvento('Marfim 09/05')
    evMarfim.tipo = 'Marfim Alto'
    const plano = reconciliar(parseOrcamentoV2(await aoaDoEvento(evBrisa)), evMarfim)
    expect(plano.avisoProjeto).toBeTruthy()
    expect(plano.avisoProjeto).toContain('Brisa')
    expect(plano.avisoProjeto).toContain('Marfim Alto')
  })

  it('#2 — alvo desconhecido (evento apagado): não adivinha, devolve alvoDesconhecido', async () => {
    const parsed = parseOrcamentoV2(await aoaDoEvento(eventoBase()))
    const plano = reconciliar(parsed, null) // a UI resolve A2→evento; não achou → null
    expect(plano.alvoDesconhecido).toBe(true)
    expect(plano.alvo).toBeNull()
    expect(plano.eventoId).toBeTruthy() // mas ainda sabe QUAL id procurava
  })
})

describe('não casa item de OUTRO evento', () => {
  it('reconciliar contra um evento sem esses itens → tudo remoção do alvo (nada some por engano)', async () => {
    const evA = eventoBase()
    const evB = eventoBase() // itens com ids DIFERENTES (novoItem gera ids novos)
    const plano = reconciliar(parseOrcamentoV2(await aoaDoEvento(evA)), evB)
    // os itens do evA (por id) não existem no evB → viram adições; os do evB não
    // casam por id, mas casam por conteúdo (mesmos serviços) — o auto-matcher
    // evita apagar o gêmeo. O que importa: nenhum id do evA aparece atualizado.
    const idsA = new Set(evA.categorias.flatMap((c) => c.itens).map((i) => i.id))
    expect(plano.atualizacoes.every((a) => !idsA.has(a.id))).toBe(true)
  })
})

describe('status inválido colado — mantém o antigo, mas AVISA (Princípio 4, Marco)', () => {
  it('status fora dos 11 → avisosStatus nomeia; o status do item NÃO muda (nem calado, nem sobrescrito)', async () => {
    const ev = eventoBase()
    const idBar = achaItem(ev, 'Bar').id
    const aoa = await aoaDoEvento(ev)
    aoa[linhaDoServico(aoa, 'Bar')][COL_V2.status] = 'FEITO' // status que não existe na lista canônica
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.avisosStatus.length).toBe(1)
    const av = plano.avisosStatus[0]
    expect(av.statusInformado).toBe('FEITO')
    expect(av.statusUsado).toBe('ESTIMADO') // o Bar estava ESTIMADO — mantido
    expect(av.acao).toBe('mantido')
    // NÃO entrou como atualização (nada de sobrescrever com lixo)
    expect(plano.atualizacoes.find((a) => a.id === idBar)?.campos?.status).toBeUndefined()
    // aplicar mantém o status do Bar
    const depois = aplicarReconciliacao(ev, plano)
    expect(depois.categorias.flatMap((c) => c.itens).find((i) => i.id === idBar).status).toBe('ESTIMADO')
  })

  it('item NOVO com status inválido → usa o padrão, também avisando', async () => {
    const ev = eventoBase()
    const aoa = await aoaDoEvento(ev)
    aoa.splice(linhaDoServico(aoa, 'Bar') + 1, 0, novaLinha('Cerveja', 4000, 'FEITO'))
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    const av = plano.avisosStatus.find((a) => a.statusInformado === 'FEITO')
    expect(av.acao).toBe('padrão')
    expect(av.statusUsado).toBe('ESTIMADO')
    expect(plano.adicoes.find((a) => a.dados.servico === 'Cerveja').dados.status).toBe('ESTIMADO')
  })
})

describe('TRAVA NO MOTOR — ambiguidade não resolvida NUNCA termina em exclusão (Marco)', () => {
  it('remoção do candidato de ambíguo LIGADA na seleção → o motor BARRA (invariante, não ordem de UI)', async () => {
    const ev = eventoBase() // dois "DJ" iguais no Artístico
    const [dj1, dj2] = ev.categorias.find((c) => c.nome === 'Artístico').itens
    const aoa = await aoaDoEvento(ev)
    aoa.forEach((row) => {
      if (String(row[COL_V2.servico] ?? '').trim() === 'DJ') row[COL_V2.id] = '' // vira ambíguo
    })
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.ambiguos.length).toBeGreaterThan(0)
    expect(plano.remocoes.map((r) => r.id).sort()).toEqual([dj1.id, dj2.id].sort()) // ambos ficaram sem casar
    // a UI, por erro/ordem, manda remover os dois
    const depois = aplicarReconciliacao(ev, plano, { remocoes: new Set([dj1.id, dj2.id]) })
    const idsDepois = depois.categorias.flatMap((c) => c.itens).map((i) => i.id)
    expect(idsDepois).toContain(dj1.id) // o motor barrou: sobrevivem
    expect(idsDepois).toContain(dj2.id)
  })

  it('sem ambíguo, a remoção selecionada aplica normal — a trava só morde o candidato de ambíguo', async () => {
    const ev = eventoBase()
    const idGelo = achaItem(ev, 'Gelo').id
    const aoa = await aoaDoEvento(ev)
    aoa.splice(linhaDoServico(aoa, 'Gelo'), 1) // apaga o Gelo, sem ambiguidade
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    const depois = aplicarReconciliacao(ev, plano, { remocoes: new Set([idGelo]) })
    expect(depois.categorias.flatMap((c) => c.itens).some((i) => i.id === idGelo)).toBe(false)
  })
})

describe('aplicarResolucoes — a escolha da produtora tira o ambíguo (revisão com escolha)', () => {
  it("casar → vira update/mantido, sai da remoção, e a trava libera", async () => {
    const ev = eventoBase()
    const [dj1, dj2] = ev.categorias.find((c) => c.nome === 'Artístico').itens
    const aoa = await aoaDoEvento(ev)
    const linhasDJ = []
    aoa.forEach((row, i) => {
      if (String(row[COL_V2.servico] ?? '').trim() === 'DJ') { row[COL_V2.id] = ''; linhasDJ.push(i) }
    })
    aoa[linhasDJ[0]][COL_V2.estimado] = 5000 // muda o 1º DJ
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.ambiguos.length).toBe(2)
    const resolvido = aplicarResolucoes(plano, ev, { 0: { acao: 'casar', itemId: dj1.id }, 1: { acao: 'casar', itemId: dj2.id } })
    expect(resolvido.ambiguos).toEqual([]) // resolvidos
    expect(resolvido.remocoes).toEqual([]) // ninguém a remover
    expect(resolvido.atualizacoes.some((a) => a.id === dj1.id && a.campos.estimado.para === 5000)).toBe(true)
    const depois = aplicarReconciliacao(ev, resolvido)
    const djs = depois.categorias.find((c) => c.nome === 'Artístico').itens
    expect(djs.length).toBe(2)
    expect(num(djs.find((i) => i.id === dj1.id).estimado)).toBe(5000)
  })

  it("'ignorar' mantém o ambíguo e a proteção — o item não é removido mesmo com a remoção ligada", async () => {
    const ev = eventoBase()
    const [dj1, dj2] = ev.categorias.find((c) => c.nome === 'Artístico').itens
    const aoa = await aoaDoEvento(ev)
    aoa.forEach((row) => {
      if (String(row[COL_V2.servico] ?? '').trim() === 'DJ') row[COL_V2.id] = ''
    })
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    const resolvido = aplicarResolucoes(plano, ev, { 0: { acao: 'ignorar' }, 1: { acao: 'ignorar' } })
    expect(resolvido.ambiguos.length).toBe(2) // seguem ambíguos
    const depois = aplicarReconciliacao(ev, resolvido, { remocoes: new Set([dj1.id, dj2.id]) })
    const ids = depois.categorias.flatMap((c) => c.itens).map((i) => i.id)
    expect(ids).toContain(dj1.id)
    expect(ids).toContain(dj2.id)
  })
})

describe('linha RECUSADA sem id não vira remoção fantasma (lente adversarial 22/07)', () => {
  it('negativo em planilha copiada: recusada, e o item que casaria por nome fica FORA de Remoções', async () => {
    const ev = eventoBase()
    const idBar = achaItem(ev, 'Bar').id
    const aoa = await aoaDoEvento(ev)
    const rBar = linhaDoServico(aoa, 'Bar')
    aoa[rBar][COL_V2.id] = '' // planilha copiada — a coluna A sumiu
    aoa[rBar][COL_V2.estimado] = '(500)' // negativo contábil digitado pela produtora
    const plano = reconciliar(parseOrcamentoV2(aoa), ev)
    expect(plano.recusadas).toHaveLength(1)
    expect(plano.recusadas[0].valor).toBe(-500)
    // O Bar NÃO pode aparecer em "Remoções — a produtora apagou estas linhas":
    // ela não apagou, pôs valor inválido. Antes do conserto, caía lá.
    expect(plano.remocoes.map((r) => r.id)).not.toContain(idBar)
    // E nada aplica o negativo por outra via.
    expect(plano.atualizacoes.map((a) => a.id)).not.toContain(idBar)
  })
})


describe('P3 — v2 recusa anotação antes de casar ou resolver', () => {
  it.each([true,false])('id presente=%s protege original; novo inválido não entra', async (comId) => {
    const ev=eventoBase(); const aoa=await aoaDoEvento(ev); const r=linhaDoServico(aoa,'Bar')
    if(!comId) aoa[r][COL_V2.id]=''
    aoa[r][COL_V2.estimado]='R$ 8.000 (2 dias)'
    aoa.splice(r+1,0,novaLinha('Novo','1e3','ESTIMADO'))
    const p=reconciliar(parseOrcamentoV2(aoa),ev)
    expect(p.recusadas).toHaveLength(2); expect(p.recusadas[0].original).toBe('R$ 8.000 (2 dias)')
    expect(p.atualizacoes).toHaveLength(0); expect(p.adicoes).toHaveLength(0); expect(p.remocoes).toHaveLength(0)
    expect(aplicarReconciliacao(ev,p)).toEqual(ev)
  })
  it('duplicata inválida é recusada e resolução direta casar/novo também recusa', async () => {
    const ev=eventoBase(); const aoa=await aoaDoEvento(ev); const r=linhaDoServico(aoa,'Bar'); const copia=[...aoa[r]]; copia[COL_V2.estimado]='R$ 8 mil'; aoa.splice(r+1,0,copia)
    const p=reconciliar(parseOrcamentoV2(aoa),ev)
    expect(p.recusadas).toHaveLength(1)
    const linha={id:achaItem(ev,'Bar').id,servico:'Bar',fornecedor:'MZ',estimado:'R$ 8 mil',linha:10}
    for(const acao of ['casar','novo']) {
      const direto={...p,atualizacoes:[],adicoes:[],ambiguos:[{linha,candidatos:[linha.id],categoriaId:ev.categorias.find(c=>c.nome==='A&B').id}]}
      const resolvido=aplicarResolucoes(direto,ev,{0:{acao,itemId:linha.id}})
      expect(resolvido.atualizacoes).toHaveLength(0); expect(resolvido.adicoes).toHaveLength(0)
    }
  })
})

  it('P3 — novo com ID desconhecido também recusa e linha válida ainda casa com candidato protegido', async () => {
    const ev=eventoBase();const aoa=await aoaDoEvento(ev);const r=linhaDoServico(aoa,'Bar');const invalida=[...aoa[r]];invalida[COL_V2.id]='';invalida[COL_V2.estimado]='R$ 8 mil';aoa[r][COL_V2.id]='';aoa[r][COL_V2.estimado]=17000;aoa.splice(r,0,invalida)
    const novo=novaLinha('Novo','R$ 2.000/dia','ESTIMADO');novo[COL_V2.id]='id-desconhecido';aoa.splice(r,0,novo)
    const p=reconciliar(parseOrcamentoV2(aoa),ev)
    expect(p.recusadas).toHaveLength(2);expect(p.adicoes).toHaveLength(0);expect(p.remocoes).toHaveLength(0)
    expect(p.atualizacoes).toHaveLength(1);expect(achaItem(aplicarReconciliacao(ev,p),'Bar').estimado).toBe(17000)
  })

 it.each([-0.1,100000000.01,Infinity,NaN])('P6 — v2 faixa %s protege item, novo e resoluções', async v=>{
   const ev=eventoBase();const aoa=await aoaDoEvento(ev);const r=linhaDoServico(aoa,'Bar');aoa[r][COL_V2.estimado]=v;aoa.splice(r+1,0,novaLinha('Novo',v,'ESTIMADO'))
   const p=reconciliar(parseOrcamentoV2(aoa),ev);expect(p.recusadas).toHaveLength(2);expect(p.atualizacoes).toHaveLength(0);expect(p.adicoes).toHaveLength(0);expect(p.remocoes).toHaveLength(0)
   const id=achaItem(ev,'Bar').id;const direto={...p,ambiguos:[{linha:{id,servico:'Bar',estimado:v,linha:10},candidatos:[id],categoriaId:ev.categorias[0].id}]}
   for(const acao of ['casar','novo']){const r=aplicarResolucoes(direto,ev,{0:{acao,itemId:id}});expect(r.atualizacoes).toHaveLength(0);expect(r.adicoes).toHaveLength(0)}
 })
