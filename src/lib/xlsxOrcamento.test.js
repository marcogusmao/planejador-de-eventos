// Planilha do produtor (20/07/2026) — o contrato dos dois lados: o que sai
// volta byte a byte (round-trip com blindagem), o diff diz a verdade em
// português, aplicar é puro e SÓ encosta em orçamento (nunca em realizado,
// status, parcelas, estágio de patrocínio).

import { describe, it, expect } from 'vitest'
import {
  MARCADOR_ORCAMENTO,
  montarAOAOrcamento,
  parseAOAOrcamento,
  montarPropostasOrcamento,
  aplicarPropostasOrcamento,
  acharAbaOrcamento,
} from './xlsxOrcamento.js'
import { novoEvento, novoItem } from './defaults.js'
import { clone } from './util.js'

const eventoBase = () => {
  const e = novoEvento('Brisa 15/08')
  e.categorias = [
    {
      id: 'equipe',
      nome: 'Equipe',
      padrao: true,
      itens: [
        novoItem({ servico: 'Segurança', fornecedor: 'Alfa', estimado: 12000, realizado: 11000, status: 'PAGO' }),
        novoItem({ servico: '=PERIGO() da célula', fornecedor: '-2+3', estimado: 500 }),
      ],
    },
    { id: 'extras', nome: 'Extras & Conting.', padrao: true, itens: [] },
  ]
  e.patrocinios = [
    { id: 'p1', patrocinador: 'Marca X', valor: 5000, estagio: 'confirmado' },
    { id: 'p2', patrocinador: 'Marca Y', valor: 2000, estagio: 'proposta' },
  ]
  return e
}

describe('round-trip montar → parse', () => {
  it('o que sai volta idêntico — inclusive texto blindado contra fórmula', () => {
    const e = eventoBase()
    const lido = parseAOAOrcamento(montarAOAOrcamento(e))
    expect(lido.ok).toBe(true)
    expect(lido.eventoId).toBe(e.id)
    expect(lido.custos.map((c) => c.servico)).toEqual(['Segurança', '=PERIGO() da célula'])
    expect(lido.custos[1].fornecedor).toBe('-2+3')
    expect(lido.patrocinios.map((p) => p.patrocinador)).toEqual(['Marca X', 'Marca Y'])
    // e o AOA gravado carrega a blindagem (a célula crua NÃO começa com =)
    const aoa = montarAOAOrcamento(e)
    const linhaPerigo = aoa.find((l) => String(l[2] ?? '').includes('PERIGO'))
    expect(String(linhaPerigo[2])[0]).toBe("'")
  })

  it('planilha intocada = zero propostas (nada de diff fantasma)', () => {
    const e = eventoBase()
    const { propostas, avisos } = montarPropostasOrcamento(e, parseAOAOrcamento(montarAOAOrcamento(e)))
    expect(propostas).toEqual([])
    expect(avisos).toEqual([])
  })

  it('arquivo sem o marcador é recusado em português', () => {
    const r = parseAOAOrcamento([['qualquer coisa'], ['CUSTOS']])
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/planilha do produtor/i)
  })
})

describe('diff honesto', () => {
  const lidoCom = (e, mexe) => {
    const aoa = montarAOAOrcamento(e)
    mexe(aoa)
    return parseAOAOrcamento(aoa)
  }

  it('estimado alterado (formato BR em string) vira UMA proposta com antes → depois', () => {
    const e = eventoBase()
    const lido = lidoCom(e, (aoa) => {
      const li = aoa.findIndex((l) => l[2] === 'Segurança')
      aoa[li][4] = 'R$ 15.500,00'
    })
    const { propostas } = montarPropostasOrcamento(e, lido)
    expect(propostas).toHaveLength(1)
    expect(propostas[0]).toMatchObject({
      tipo: 'custo',
      acao: 'alterar',
      selecionadaPorPadrao: true,
      mudancas: [{ campo: 'estimado', de: 12000, para: 15500 }],
    })
  })

  it('linha nova sem id vira custo NOVO na categoria certa; categoria desconhecida cai em Extras com o motivo no rótulo', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const fimCustos = aoa.findIndex((l) => l[0] === 'PATROCÍNIO') - 1
    aoa.splice(fimCustos, 0, ['', 'Equipe', 'Brigadista', 'Beta', 3000, ''])
    aoa.splice(fimCustos + 1, 0, ['', 'Categoria Inventada', 'Drone', '', 1000, ''])
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    const novos = propostas.filter((p) => p.acao === 'novo')
    expect(novos).toHaveLength(2)
    expect(novos[0].categoriaId).toBe('equipe')
    expect(novos[1].categoriaId).toBe('extras')
    expect(novos[1].rotulo).toMatch(/não existe — entra em Extras/)
  })

  it('linha sumida vira REMOVER — e nasce DESMARCADA (sumir por acidente não apaga)', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => l[2] === 'Segurança')
    aoa.splice(li, 1)
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toHaveLength(1)
    expect(propostas[0]).toMatchObject({ acao: 'remover', selecionadaPorPadrao: false })
  })

  it('estágio de patrocínio mudado na planilha é IGNORADO com aviso — receita não liga por célula', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => l[1] === 'Marca Y')
    aoa[li][3] = 'recebido' // produtor tentando promover
    const { propostas, avisos } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toEqual([])
    expect(avisos.join(' ')).toMatch(/estágio.*IGNORADA|IGNORADA.*estágio/i)
  })

  it('patrocínio novo nasce como proposta, dito no rótulo', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    aoa.splice(aoa.length - 2, 0, ['', 'Marca Nova', 8000, 'recebido'])
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toHaveLength(1)
    expect(propostas[0].acao).toBe('novo')
    expect(propostas[0].rotulo).toMatch(/nasce como proposta/)
  })
})

describe('aplicar — puro e cirúrgico', () => {
  const propostasDe = (e, mexeAoa) => {
    const aoa = montarAOAOrcamento(e)
    mexeAoa(aoa)
    return montarPropostasOrcamento(e, parseAOAOrcamento(aoa)).propostas
  }

  it('não muta o evento original', () => {
    const e = eventoBase()
    const congelado = clone(e)
    const props = propostasDe(e, (aoa) => {
      aoa[aoa.findIndex((l) => l[2] === 'Segurança')][4] = 20000
    })
    aplicarPropostasOrcamento(e, props, props.map((p) => p.id))
    expect(e).toEqual(congelado)
  })

  it('alterar estimado NÃO encosta em realizado/status/parcelas', () => {
    const e = eventoBase()
    const props = propostasDe(e, (aoa) => {
      aoa[aoa.findIndex((l) => l[2] === 'Segurança')][4] = 20000
    })
    const novo = aplicarPropostasOrcamento(e, props, props.map((p) => p.id))
    const seg = novo.categorias[0].itens[0]
    expect(seg.estimado).toBe(20000)
    expect(seg.realizado).toBe(11000)
    expect(seg.status).toBe('PAGO')
  })

  it('proposta NÃO selecionada não aplica nada', () => {
    const e = eventoBase()
    const props = propostasDe(e, (aoa) => {
      aoa[aoa.findIndex((l) => l[2] === 'Segurança')][4] = 20000
    })
    const novo = aplicarPropostasOrcamento(e, props, [])
    expect(novo.categorias[0].itens[0].estimado).toBe(12000)
  })

  it('remover selecionado remove; novo cria com id próprio; patrocínio novo nasce proposta', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => l[2] === 'Segurança')
    aoa.splice(li, 1) // remove Segurança
    const fimCustos = aoa.findIndex((l) => l[0] === 'PATROCÍNIO') - 1
    aoa.splice(fimCustos, 0, ['', 'Equipe', 'Brigadista', '', 3000, '']) // novo custo
    aoa.splice(aoa.length - 2, 0, ['', 'Marca Nova', 8000, 'recebido']) // novo patrocínio
    const props = montarPropostasOrcamento(e, parseAOAOrcamento(aoa)).propostas
    const novo = aplicarPropostasOrcamento(e, props, props.map((p) => p.id))
    const equipe = novo.categorias.find((c) => c.id === 'equipe')
    expect(equipe.itens.some((i) => i.servico === 'Segurança')).toBe(false)
    const brig = equipe.itens.find((i) => i.servico === 'Brigadista')
    expect(brig).toBeTruthy()
    expect(brig.id).toBeTruthy()
    expect(brig.estimado).toBe(3000)
    const marcaNova = novo.patrocinios.find((p) => p.patrocinador === 'Marca Nova')
    expect(marcaNova.estagio).toBe('proposta')
    expect(marcaNova.valor).toBe(8000)
  })
})

describe('bordas hostis do retorno (achados pré-ataque, 20/07/2026)', () => {
  it('categoria MUDADA num id existente é ignorada COM AVISO — mover de categoria é no app', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => l[2] === 'Segurança')
    aoa[li][1] = 'Extras & Conting.' // produtor "moveu" a linha
    const { propostas, avisos } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toEqual([]) // nada além da categoria mudou
    expect(avisos.join(' ')).toMatch(/movid.*categoria.*IGNORADA/i)
  })

  it('id_item DUPLICADO: a primeira linha vale, as seguintes são ignoradas com aviso', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => l[2] === 'Segurança')
    const copia = [...aoa[li]]
    copia[4] = 99999 // linha copiada com valor diferente
    aoa.splice(li + 1, 0, copia)
    const { propostas, avisos } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toEqual([]) // a primeira linha (intocada) vale; a cópia não vira proposta
    expect(avisos.join(' ')).toMatch(/duplicad/i)
  })

  it('evento SEM a categoria extras: custo novo de categoria desconhecida cai na PRIMEIRA categoria, dito no rótulo — nunca some', () => {
    const e = eventoBase()
    e.categorias = e.categorias.filter((c) => c.id !== 'extras') // só "Equipe"
    const aoa = montarAOAOrcamento(e)
    const fimCustos = aoa.findIndex((l) => l[0] === 'PATROCÍNIO') - 1
    aoa.splice(fimCustos, 0, ['', 'Categoria Inventada', 'Drone', '', 1000, ''])
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    const novo = propostas.find((p) => p.acao === 'novo')
    expect(novo.categoriaId).toBe('equipe')
    expect(novo.rotulo).toMatch(/entra em Equipe/)
    const aplicado = aplicarPropostasOrcamento(e, propostas, propostas.map((p) => p.id))
    expect(aplicado.categorias[0].itens.some((i) => i.servico === 'Drone')).toBe(true)
  })
})

describe('achados do ataque pela lib real (20/07/2026)', () => {
  it('espaço/quebra na PONTA do texto salvo não vira proposta fantasma', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].servico = 'Segurança '   // espaço final de celular
    e.categorias[0].itens[0].fornecedor = '\tAlfa'
    e.categorias[0].itens[0].obs = 'fim\n'
    e.patrocinios[0].patrocinador = ' Marca X '
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(montarAOAOrcamento(e)))
    expect(propostas).toEqual([])
  })

  it('mudança REAL de texto continua detectada mesmo com espaço na ponta', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].servico = 'Segurança '
    const aoa = montarAOAOrcamento(e)
    const li = aoa.findIndex((l) => String(l[2]).includes('Segurança'))
    aoa[li][2] = 'Segurança noturna'
    const { propostas } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas).toHaveLength(1)
    expect(propostas[0].mudancas[0].para).toBe('Segurança noturna')
  })

  it('apóstrofo LEGÍTIMO no começo do dado sobrevive ao round-trip', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].obs = "'-20% à vista"
    const lido = parseAOAOrcamento(montarAOAOrcamento(e))
    expect(lido.custos[0].obs).toBe("'-20% à vista")
    const { propostas } = montarPropostasOrcamento(e, lido)
    expect(propostas).toEqual([])
  })

  it('id DESCONHECIDO duplicado vira UM custo novo só — a segunda linha é ignorada com aviso', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    const fimCustos = aoa.findIndex((l) => l[0] === 'PATROCÍNIO') - 1
    aoa.splice(fimCustos, 0, ['id-fantasma', 'Equipe', 'Drone', '', 1000, ''])
    aoa.splice(fimCustos + 1, 0, ['id-fantasma', 'Equipe', 'Drone', '', 1000, ''])
    const { propostas, avisos } = montarPropostasOrcamento(e, parseAOAOrcamento(aoa))
    expect(propostas.filter((p) => p.acao === 'novo')).toHaveLength(1)
    expect(avisos.join(' ')).toMatch(/duplicad/i)
  })

  it('linha de patrocínio só com estágio preenchido é ignorada COM aviso', () => {
    const e = eventoBase()
    const aoa = montarAOAOrcamento(e)
    aoa.splice(aoa.length - 2, 0, ['', '', '', 'recebido'])
    const lido = parseAOAOrcamento(aoa)
    expect(lido.patrocinios).toHaveLength(2) // só os originais
    expect(lido.avisos.join(' ')).toMatch(/sem patrocinador e sem valor/i)
  })
})

describe('acharAbaOrcamento — a aba certa pelo MARCADOR, nunca "a primeira"', async () => {
  const XLSX = await import('xlsx')
  it('aba de rascunho do produtor na frente não recusa o retorno válido', () => {
    const e = eventoBase()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['rabisco do produtor']]), 'Aba do produtor')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(montarAOAOrcamento(e)), 'Orçamento')
    // round-trip binário real, como o modal lê
    const relido = XLSX.read(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
    expect(acharAbaOrcamento(relido)).toBe('Orçamento')
    const aoa = XLSX.utils.sheet_to_json(relido.Sheets['Orçamento'], { header: 1, raw: true, defval: '' })
    expect(parseAOAOrcamento(aoa).ok).toBe(true)
  })
  it('arquivo sem nenhuma aba com o marcador devolve null (o modal lista as abas)', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['qualquer']]), 'Planilha1')
    expect(acharAbaOrcamento(wb)).toBeNull()
  })
})


describe('P3 — orçamento v1 conserva linhas presentes recusadas', () => {
  it('recusa custos e patrocínios existentes e novos sem alterar nem remover', () => {
    const ev = eventoBase(); const aoa = montarAOAOrcamento(ev)
    const custo = aoa.find(r => r[0] === ev.categorias[0].itens[0].id)
    custo[2] = 'Nome modificado'; custo[4] = 'R$ 8.000 (2 dias)'
    aoa.splice(aoa.indexOf(custo)+1,0,['','Equipe','Novo','','R$ 8 mil',''])
    const pat = aoa.find(r => r[0] === 'p1'); pat[2] = 'R$ 2.000/dia'
    aoa.splice(aoa.indexOf(pat)+1,0,['','Novo','1e3','proposta'])
    const m = montarPropostasOrcamento(ev,parseAOAOrcamento(aoa))
    expect(m.recusadas).toHaveLength(4)
    expect(m.recusadas.map(r=>r.original)).toEqual(['R$ 8.000 (2 dias)','R$ 8 mil','R$ 2.000/dia','1e3'])
    expect(m.propostas).toHaveLength(0)
    expect(aplicarPropostasOrcamento(ev,m.propostas,m.propostas.map(p=>p.id))).toEqual(ev)
  })
  it('export de valor salvo ilegível avisa em vez de escrever zero', () => {
    const ev=eventoBase(); ev.categorias[0].itens[0].estimado='R$ 8 mil'
    expect(()=>montarAOAOrcamento(ev)).toThrow(/valor|estimado/i)
  })
})

  it('P3 — recusa mantém original enquanto outra linha válida muda e metadados nunca são salvos', () => {
    const ev=eventoBase();const aoa=montarAOAOrcamento(ev);aoa.find(r=>r[0]===ev.categorias[0].itens[0].id)[4]='R$ 8 mil';aoa.find(r=>r[0]===ev.categorias[0].itens[1].id)[4]=700
    const m=montarPropostasOrcamento(ev,parseAOAOrcamento(aoa));const depois=aplicarPropostasOrcamento(ev,m.propostas,m.propostas.map(p=>p.id))
    expect(m.recusadas).toHaveLength(1);expect(depois.categorias[0].itens[0]).toEqual(ev.categorias[0].itens[0]);expect(depois.categorias[0].itens[1].estimado).toBe(700)
    expect(JSON.stringify(depois)).not.toMatch(/originalEstimado|originalValor/)
  })

 it.each([-0.1,100000000.01,Infinity,NaN])('P6 — v1 custo e patrocínio fora da faixa %s não atualizam/removem',v=>{
   const ev=eventoBase();const aoa=montarAOAOrcamento(ev);aoa.find(r=>r[0]===ev.categorias[0].itens[0].id)[4]=v;aoa.find(r=>r[0]==='p1')[2]=v
   const m=montarPropostasOrcamento(ev,parseAOAOrcamento(aoa));expect(m.recusadas).toHaveLength(2);expect(m.propostas).toHaveLength(0)
   expect(aplicarPropostasOrcamento(ev,m.propostas,m.propostas.map(p=>p.id))).toEqual(ev)
 })
 it('P3 revisão — salvo ilegível e retorno vazio propõem limpeza de custo e patrocínio',()=>{
   const ev={id:'e',categorias:[{id:'c',nome:'Estrutura',itens:[{id:'i',servico:'Gerador',estimado:'R$ 8 mil'}]}],patrocinios:[{id:'p',patrocinador:'Marca',valor:'R$ 9 mil',estagio:'proposta'}]}
   const lido=parseAOAOrcamento([[MARCADOR_ORCAMENTO,'e'],['CUSTOS'],['i','Estrutura','Gerador','',''],['PATROCÍNIO'],['p','Marca','','proposta']])
   const m=montarPropostasOrcamento(ev,lido)
   expect(m.propostas).toHaveLength(2);expect(m.propostas.flatMap(p=>p.mudancas).map(m=>[m.de,m.para])).toEqual([['R$ 8 mil',''],['R$ 9 mil','']])
   const depois=aplicarPropostasOrcamento(ev,m.propostas,m.propostas.map(p=>p.id));expect(depois.categorias[0].itens[0]).toMatchObject({id:'i',estimado:''});expect(depois.patrocinios[0]).toMatchObject({id:'p',valor:''})
 })
