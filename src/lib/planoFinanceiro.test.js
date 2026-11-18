import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BLOCOS_DO_PLANO,
  TOLERANCIA_CONFERENCIA,
  criarEmissorDoPlano,
  categoriaFinanceiroCusto,
  montarItensPlano,
  gerarCSVPlano,
  nomeArquivoPlano,
  CATEGORIA_FIN_INGRESSOS,
  CATEGORIA_FIN_BAR,
  CATEGORIA_FIN_PATROCINIO,
} from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { novaParcela } from './parcelas.js'
import { computeCenario } from './calc.js'
import { clone, num } from './util.js'
import { fmtBRL } from './format.js'

// Evento base: tipo/data preenchidos (mínimo pra exportar), um lote vendendo,
// dois itens de custo com estimado.
function eventoBase() {
  const e = novoEvento('Brisa 15/08')
  e.tipo = 'Brisa'
  e.data = '2026-08-15'
  e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })]
  e.categorias = [
    { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ servico: 'Gelo', estimado: 500 })] },
    {
      id: 'artistico',
      nome: 'Artístico',
      padrao: true,
      itens: [novoItem({ servico: 'DJ', estimado: 8000 })],
    },
  ]
  return e
}

describe('categoriaFinanceiroCusto', () => {
  it('mapeia as categorias padrão para os nomes exatos do Financeiro', () => {
    expect(categoriaFinanceiroCusto('aeb')).toBe('A&B / CMV')
    expect(categoriaFinanceiroCusto('locacao')).toBe('Locação do espaço')
    expect(categoriaFinanceiroCusto('estrutura')).toBe('Estrutura / Cenografia')
    expect(categoriaFinanceiroCusto('equipe')).toBe('Equipe de evento')
    expect(categoriaFinanceiroCusto('artistico')).toBe('Artístico / DJ')
  })

  it('categoria sem par exato (marketing, extras, custom) cai em Outras despesas', () => {
    expect(categoriaFinanceiroCusto('marketing')).toBe('Outras despesas')
    expect(categoriaFinanceiroCusto('extras')).toBe('Outras despesas')
    expect(categoriaFinanceiroCusto('uid-qualquer-custom')).toBe('Outras despesas')
  })
})

describe('montarItensPlano — bloqueios', () => {
  it('bloqueia sem "tipo" (marca obrigatória)', () => {
    const e = eventoBase()
    e.tipo = ''
    const r = montarItensPlano(e)
    expect(r.bloqueios.length).toBeGreaterThan(0)
    expect(r.itens).toEqual([])
  })

  it('bloqueia sem "data" (data_evento obrigatória)', () => {
    const e = eventoBase()
    e.data = ''
    const r = montarItensPlano(e)
    expect(r.bloqueios.length).toBeGreaterThan(0)
    expect(r.itens).toEqual([])
  })

  it('tipo custom (fora das 4 marcas) não bloqueia, mas avisa', () => {
    const e = eventoBase()
    e.tipo = 'Festa Própria Nova'
    const r = montarItensPlano(e)
    expect(r.bloqueios).toEqual([])
    expect(r.avisos.some((a) => a.includes('Festa Própria Nova'))).toBe(true)
  })
})

describe('montarItensPlano — receita', () => {
  // DECISÃO DO MARCO (25/07/2026): a bilheteria não é mais dividida por
  // lote no arquivo — sai sempre UMA linha, "Ingressos (bilheteria)", com o
  // valor de `cen.bruta` (o que a tela mostra) e id ESTÁVEL
  // `${evento.id}:ingressos`. Este teste, reescrito na mesma data, prova as
  // duas coisas: só existe UMA linha de Ingressos, e o id não tem sufixo de
  // lote (o id estável é o que impede a dobra no Financeiro — ver
  // planoFinanceiro.js).
  it('gera uma ÚNICA linha de Ingressos (bilheteria), com o id estável e valor batendo com cen.bruta', () => {
    const e = eventoBase()
    const cen = computeCenario(e, 'realista')
    const r = montarItensPlano(e)
    const linhasIngressos = r.itens.filter((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
    expect(linhasIngressos.length).toBe(1)
    expect(linhasIngressos[0].id).toBe(`${e.id}:ingressos`)
    expect(linhasIngressos[0].valor).toBeCloseTo(cen.bruta, 6)
    expect(linhasIngressos[0].valor).toBeGreaterThan(0)
  })

  it('lote com quantidade 0 no realista não gera linha', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Vazio', valor: 100, quantidade: 0 })]
    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)).toBe(false)
  })

  it('bar e patrocínio viram linhas próprias só quando > 0', () => {
    const e = eventoBase()
    // Sugestão 42: evento novo nasce por pessoa; aqui o teste é do valor FIXO.
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: 3000, patrocinio: '' }
    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_BAR && i.valor === 3000)).toBe(true)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_PATROCINIO)).toBe(false)
  })

  it('open bar (sugestão 27): a linha de Bar sai do plano — cen.bar é 0, fonte única em calc.js', () => {
    const e = eventoBase()
    e.outrasReceitas = { bar: 3000, patrocinio: '' }
    e.openBar = true
    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_BAR)).toBe(false)
    // as demais linhas continuam normais
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)).toBe(true)
  })

  it('receita de ingressos reflete o desconto médio (sugestão 17) sem fórmula nova', () => {
    const semDesconto = eventoBase()
    const comDesconto = clone(semDesconto)
    comDesconto.descontoMedioPct = 12
    const r1 = montarItensPlano(semDesconto)
    const r2 = montarItensPlano(comDesconto)
    const v1 = r1.itens.find((i) => i.categoria === CATEGORIA_FIN_INGRESSOS).valor
    const v2 = r2.itens.find((i) => i.categoria === CATEGORIA_FIN_INGRESSOS).valor
    expect(v2).toBeCloseTo(v1 * 0.88, 6)
  })
})

describe('montarItensPlano — custo', () => {
  it('gera uma linha por item de custo com estimado > 0, categoria mapeada', () => {
    const e = eventoBase()
    const r = montarItensPlano(e)
    const gelo = r.itens.find((i) => i.rotulo === 'Gelo')
    const dj = r.itens.find((i) => i.rotulo === 'DJ')
    expect(gelo).toMatchObject({ categoria: 'A&B / CMV', valor: 500, grupo: 'custo' })
    expect(dj).toMatchObject({ categoria: 'Artístico / DJ', valor: 8000, grupo: 'custo' })
  })

  it('item sem estimado (vazio ou 0) não vira linha', () => {
    const e = eventoBase()
    e.categorias[0].itens.push(novoItem({ servico: 'Sem orçamento', estimado: '' }))
    e.categorias[0].itens.push(novoItem({ servico: 'Zero', estimado: 0 }))
    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.rotulo === 'Sem orçamento')).toBe(false)
    expect(r.itens.some((i) => i.rotulo === 'Zero')).toBe(false)
  })

  it('usa o ESTIMADO, não o realizado/considerado', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].estimado = 500
    e.categorias[0].itens[0].realizado = 9999
    const r = montarItensPlano(e)
    const gelo = r.itens.find((i) => i.rotulo === 'Gelo')
    expect(gelo.valor).toBe(500)
  })

  it('categoria custom cai em "Outras despesas" e gera aviso nomeando a categoria', () => {
    const e = eventoBase()
    e.categorias.push({
      id: 'custom-xyz',
      nome: 'Categoria Inventada',
      padrao: false,
      itens: [novoItem({ servico: 'Item custom', estimado: 100 })],
    })
    const r = montarItensPlano(e)
    const item = r.itens.find((i) => i.rotulo === 'Item custom')
    expect(item.categoria).toBe('Outras despesas')
    expect(r.avisos.some((a) => a.includes('Categoria Inventada'))).toBe(true)
  })

  it('contingência > 0 vira linha própria em Outras despesas', () => {
    const e = eventoBase()
    e.contingenciaPct = 5
    const r = montarItensPlano(e)
    const cen = computeCenario(e, 'realista')
    const linha = r.itens.find((i) => i.rotulo.startsWith('Contingência'))
    expect(linha).toBeTruthy()
    expect(linha.categoria).toBe('Outras despesas')
    expect(linha.valor).toBeCloseTo(cen.contingencia, 6)
  })

  it('contingência 0/ausente não vira linha', () => {
    const e = eventoBase()
    e.contingenciaPct = 0
    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.rotulo.startsWith('Contingência'))).toBe(false)
  })
})

describe('montarItensPlano — id_linha estável', () => {
  it('o mesmo evento gera exatamente os mesmos ids em duas montagens (idempotência de reimportação)', () => {
    const e = eventoBase()
    const r1 = montarItensPlano(e)
    const r2 = montarItensPlano(clone(e))
    expect(r2.itens.map((i) => i.id)).toEqual(r1.itens.map((i) => i.id))
  })

  it('reordenar itens de custo não muda o id de cada linha (chave é o uid do item, não o índice)', () => {
    const e = eventoBase()
    const r1 = montarItensPlano(e)
    const eReordenado = clone(e)
    eReordenado.categorias[0].itens.reverse()
    eReordenado.categorias[1].itens.push(novoItem({ servico: 'Novo no meio', estimado: 200 }))
    const r2 = montarItensPlano(eReordenado)
    const idGeloAntes = r1.itens.find((i) => i.rotulo === 'Gelo').id
    const idGeloDepois = r2.itens.find((i) => i.rotulo === 'Gelo').id
    expect(idGeloDepois).toBe(idGeloAntes)
  })

  it('todos os ids são únicos dentro de um mesmo evento', () => {
    const e = eventoBase()
    e.outrasReceitas = { bar: 1000, patrocinio: 2000 }
    e.contingenciaPct = 5
    const r = montarItensPlano(e)
    const ids = r.itens.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('gerarCSVPlano', () => {
  it('gera cabeçalho exato do contrato (BACKLOG.md do Financeiro, item 11b)', () => {
    const e = eventoBase()
    const csv = gerarCSVPlano([], e)
    expect(csv.split('\r\n')[0]).toBe(
      'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento'
    )
  })

  it('valor sai como número puro — nunca milhar com ponto isolado', () => {
    const e = eventoBase()
    const csv = gerarCSVPlano([{ id: 'x:1', categoria: 'Ingressos', descricao: 'Lote 1', valor: 25000 }], e)
    const linha = csv.split('\r\n')[1]
    expect(linha).toContain(',25000,')
    expect(linha).not.toContain('25.000')
  })

  it('valor quebrado sai com ponto decimal (nunca vírgula BR solta)', () => {
    const e = eventoBase()
    const csv = gerarCSVPlano([{ id: 'x:1', categoria: 'Ingressos', descricao: 'Lote 1', valor: 1234.5 }], e)
    expect(csv.split('\r\n')[1]).toContain(',1234.5,')
  })

  // A RÉGUA DO CENTAVO NO ARQUIVO (Marco, 07/10/2026, por questionário — P5 do
  // plano dos centavos): o CSV arredonda com a MESMA régua do motor e da tela
  // (`emCentavos`, meio centavo para longe do zero, decidido pelo valor de
  // papel). Antes era `Math.round(v × 100) / 100`: custo de R$ 1,005 aparecia
  // R$ 1,01 na tela e saía "1" no arquivo, e −R$ 0,005 saía "0".
  it('meio centavo no arquivo vai para longe do zero, como na tela: 1,005 → 1.01; −0,005 → -0.01; 2.700,135 → 2700.14', () => {
    const e = eventoBase()
    const valores = [1.005, -0.005, 2700.135, 1.015, 51302.565]
    const csv = gerarCSVPlano(
      valores.map((valor, i) => ({ id: `x:${i}`, categoria: 'Extras', descricao: `Item ${i}`, valor })),
      e
    )
    const saida = csv.split('\r\n').slice(1, -1).map((l) => l.split(',')[6])
    expect(saida).toEqual(['1.01', '-0.01', '2700.14', '1.02', '51302.57'])
    // e o que o arquivo grava é byte a byte o que a tela escreve com centavos
    for (let i = 0; i < valores.length; i++) {
      expect(fmtBRL(Number(saida[i]), 2)).toBe(fmtBRL(valores[i], 2))
    }
  })

  it('marca e evento vêm do evento em toda linha; descrição com vírgula é escapada entre aspas', () => {
    const e = eventoBase()
    const csv = gerarCSVPlano(
      [{ id: 'x:1', categoria: 'A&B / CMV', descricao: 'Gelo, cerveja e copos', valor: 500 }],
      e
    )
    const linha = csv.split('\r\n')[1]
    expect(linha.startsWith('x:1,Brisa,Brisa 15/08,2026-08-15,')).toBe(true)
    expect(linha).toContain('"Gelo, cerveja e copos"')
  })

  it('reexportar o mesmo evento (sem mudanças) gera CSV byte-a-byte igual, exceto se algo mudou', () => {
    const e = eventoBase()
    const r1 = montarItensPlano(e)
    const csv1 = gerarCSVPlano(r1.itens, e)
    const r2 = montarItensPlano(clone(e))
    const csv2 = gerarCSVPlano(r2.itens, clone(e))
    expect(csv2).toBe(csv1)
  })

  it('blindagem anti-fórmula (portão C, Marco 20/07): descrição/categoria começando com gatilho ganha apóstrofo', () => {
    const e = eventoBase()
    // desblindar do lado do Financeiro (plano_previsao.py _desblindar) — o inverso
    const desblindar = (s) =>
      s.length >= 2 && s[0] === "'" && '=+@-\t\r'.includes(s[1]) ? s.slice(1) : s
    for (const desc of ['=SUM(1+1)', '+1+1', '@cmd', '-1+1', 'DJ normal', "'aspas"]) {
      const csv = gerarCSVPlano([{ id: 'x:1', categoria: 'Ingressos', descricao: desc, valor: 500 }], e)
      const linha = csv.split('\r\n')[1]
      const blindada = /^[=+@\t\r-]/.test(desc)
      // a célula descrição sai blindada (com apóstrofo) quando começa com gatilho
      expect(linha).toContain(blindada ? `'${desc}` : desc)
      // e o round-trip do importador recupera EXATAMENTE o original
      const celula = blindada ? `'${desc}` : desc
      expect(desblindar(celula)).toBe(desc)
    }
  })
})

describe('nomeArquivoPlano', () => {
  it('inclui a data do evento e um slug do nome, termina em .csv', () => {
    const e = eventoBase()
    const nome = nomeArquivoPlano(e)
    expect(nome).toMatch(/^plano-brisa-15-08-2026-08-15\.csv$/)
  })
})

// ————— Sessão F2-C: parcelas no export do plano (uma linha POR PARCELA) —————

describe('montarItensPlano — parcelas (F2-C)', () => {
  const comParcelas = () => {
    const e = eventoBase()
    e.categorias[1].itens[0].parcelas = [
      { id: 'pa', valor: 4000, data: '2026-08-01' },
      { id: 'pb', valor: 4000, data: '2026-09-01' },
    ]
    return e
  }

  it('custo SEM parcelas: saída idêntica à de antes (formato v1 inalterado)', () => {
    // A prova de que a F2-C não mudou o export de quem não parcela:
    // mesmo id de sempre (evento:categoria:item), data_lancamento vazia.
    const e = eventoBase()
    const r = montarItensPlano(e)
    const dj = r.itens.find((i) => i.rotulo === 'DJ')
    expect(dj.id).toBe(`${e.id}:artistico:${e.categorias[1].itens[0].id}`)
    expect(dj.dataLancamento).toBe('')
    const csv = gerarCSVPlano([dj], e)
    expect(csv.split('\r\n')[1].endsWith(',8000,')).toBe(true) // data_lancamento vazia no fim
  })

  it('custo parcelado vira UMA linha por parcela, id estável por parcela, valor e data da parcela', () => {
    const e = comParcelas()
    const r = montarItensPlano(e)
    const linhas = r.itens.filter((i) => i.rotulo.startsWith('DJ'))
    expect(linhas).toHaveLength(2)
    expect(linhas.map((l) => l.valor)).toEqual([4000, 4000])
    expect(linhas.map((l) => l.dataLancamento)).toEqual(['2026-08-01', '2026-09-01'])
    expect(linhas.map((l) => l.descricao)).toEqual(['DJ · parcela 1/2', 'DJ · parcela 2/2'])
    const itemId = e.categorias[1].itens[0].id
    expect(linhas.map((l) => l.id)).toEqual([
      `${e.id}:artistico:${itemId}:pa`,
      `${e.id}:artistico:${itemId}:pb`,
    ])
    // ids continuam únicos no evento inteiro
    expect(new Set(r.itens.map((i) => i.id)).size).toBe(r.itens.length)
  })

  it('a data da parcela sai na coluna data_lancamento do CSV (formato v1)', () => {
    const e = comParcelas()
    const r = montarItensPlano(e)
    const csv = gerarCSVPlano(r.itens.filter((i) => i.rotulo.startsWith('DJ')), e)
    const linhas = csv.split('\r\n')
    expect(linhas[1].endsWith(',4000,2026-08-01')).toBe(true)
    expect(linhas[2].endsWith(',4000,2026-09-01')).toBe(true)
  })

  it('custo com data única de pagamento preenche data_lancamento', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].dataPagamento = '2026-07-15'
    const r = montarItensPlano(e)
    const gelo = r.itens.find((i) => i.rotulo === 'Gelo')
    expect(gelo.dataLancamento).toBe('2026-07-15')
    const csv = gerarCSVPlano([gelo], e)
    expect(csv.split('\r\n')[1].endsWith(',500,2026-07-15')).toBe(true)
  })

  it('parcelas somando diferente do estimado geram aviso (o arquivo leva as parcelas)', () => {
    const e = comParcelas()
    e.categorias[1].itens[0].parcelas[1].valor = 5000 // 9.000 ≠ estimado 8.000
    const r = montarItensPlano(e)
    expect(r.avisos.some((a) => a.includes('parcelas de "DJ"'))).toBe(true)
    expect(r.itens.filter((i) => i.rotulo.startsWith('DJ')).map((i) => i.valor)).toEqual([4000, 5000])
  })

  it('parcela de valor 0/vazio não vira linha; parcela sem data sai com data_lancamento vazia', () => {
    const e = comParcelas()
    e.categorias[1].itens[0].parcelas = [
      { id: 'pa', valor: 8000, data: '' },
      { id: 'pb', valor: '', data: '2026-09-01' },
    ]
    const r = montarItensPlano(e)
    const linhas = r.itens.filter((i) => i.rotulo.startsWith('DJ'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0].dataLancamento).toBe('')
    expect(linhas[0].descricao).toBe('DJ · parcela 1/2') // a posição real na lista
  })
})

// ————— §9.1 da auditoria externa (19–20/07/2026) — S1: o export mentia —————
//
// O que a auditoria reproduziu no HEAD 212b239: com ticket médio MANUAL no
// cenário realista, a TELA mostra uma bilheteria e o arquivo exportado leva
// outra, sem um aviso sequer.
//
//   1 lote de 100 × R$ 100, realista vendaPct 100, ticketMedio manual 200
//   bruta exibida no app/DRE ........... R$ 20.000,00
//   Σ receita por lote (o que exportava)  R$ 10.000,00   ← divergência de 2×
//   avisos do export ................... nenhum
//
// Entre 20/07/2026 e 25/07/2026 a correção foi uma TRAVA: se a soma dos
// lotes não batesse com a bruta, nenhuma linha de ingresso saía, e o Marco
// tinha de lançar a bilheteria à mão no Financeiro. O ticket manual e o
// ajuste em % SEMPRE caem nesse caso (a divisão por lote nunca acompanha o
// ticket recalculado), então TODA festa com ticket manual ficava sem
// exportar a própria bilheteria.
//
// DECISÃO DO MARCO (25/07/2026, reconfirmada no mesmo dia): em vez de travar,
// o arquivo passou a levar sempre UMA linha só — "Ingressos (bilheteria)",
// valor = `cen.bruta`, o mesmo número da tela, id ESTÁVEL (sem sufixo de
// lote). A divergência descrita acima deixa de poder existir (a linha É a
// referência), e os testes abaixo — reescritos nesta data — provam isso:
// a bilheteria agora SAI, com o valor certo, e o motivo (ticket manual,
// ajuste, lote negativo) vira aviso informativo, não mais alerta bloqueante.
describe('montarItensPlano — ticket médio manual: a bilheteria agora SEMPRE exporta (decisão do Marco, 25/07/2026)', () => {
  function comTicketManual() {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200 }
    return e
  }

  it('a divergência existe na fórmula (o fato que motivou a trava original)', () => {
    const cen = computeCenario(comTicketManual(), 'realista')
    const somaPorLote = cen.porLote.reduce((s, l) => s + l.receita, 0)
    expect(cen.bruta).toBeCloseTo(20000, 6)
    expect(somaPorLote).toBeCloseTo(10000, 6)
  })

  it('a linha de Ingressos (bilheteria) É exportada, com o valor da TELA (cen.bruta), não a soma dos lotes', () => {
    const r = montarItensPlano(comTicketManual())
    const linhas = r.itens.filter((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
    expect(linhas.length).toBe(1)
    expect(linhas[0].valor).toBeCloseTo(20000, 6) // a tela — nunca mais 10.000 (a soma dos lotes)
  })

  it('nada bloqueia mais: r.alertas fica vazio, e um AVISO informativo nomeia o ticket manual e o valor', () => {
    const r = montarItensPlano(comTicketManual())
    expect(r.alertas).toEqual([])
    const aviso = r.avisos.find((a) => /ticket médio/i.test(a))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('20.000')
  })

  it('vale igual para o ajuste de ticket em % sem ticket manual (mesma porta de entrada): exporta, sem alerta', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketPct: 30 }
    const r = montarItensPlano(e)
    const linhas = r.itens.filter((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
    expect(linhas.length).toBe(1)
    expect(r.alertas).toEqual([])
    expect(r.avisos.some((a) => a.includes('ajuste de ticket'))).toBe(true)
  })

  it('o resto do plano continua exportável, junto com a bilheteria (que agora sai sempre)', () => {
    const e = comTicketManual()
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: 3000, patrocinio: '' }
    const r = montarItensPlano(e)
    expect(r.bloqueios).toEqual([])
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS && i.valor === 20000)).toBe(true)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_BAR && i.valor === 3000)).toBe(true)
    expect(r.itens.find((i) => i.rotulo === 'DJ').valor).toBe(8000)
  })

  it('não inventa o aviso de "nenhum lote tem receita" — há receita, só não é a soma ingênua dos lotes', () => {
    const r = montarItensPlano(comTicketManual())
    expect(r.avisos.some((a) => a.includes('Nenhum lote tem receita'))).toBe(false)
  })

  it('EXPORT NORMAL (sem ticket manual nem ajuste) segue idêntico: nada de alerta, nada de aviso extra', () => {
    const e = eventoBase()
    const cen = computeCenario(e, 'realista')
    const r = montarItensPlano(e)
    expect(r.alertas).toEqual([])
    const somaIngressos = r.itens
      .filter((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
      .reduce((s, i) => s + i.valor, 0)
    expect(somaIngressos).toBeCloseTo(cen.bruta, 6)
    expect(somaIngressos).toBeGreaterThan(0)
  })
})

// ————— DECISÃO DO MARCO, 25/07/2026 — testes que travam a decisão em si —————
//
// (a) a festa com ticket manual agora EXPORTA bilheteria, com o valor da tela;
// (b) o id da linha é o MESMO com e sem ticket manual — a garantia contra a
//     dobra no Financeiro (ele deduplica por id e nunca apaga linha antiga:
//     backend/services/plano_previsao.py:371 do Financeiro);
// (c) os avisos de ticket manual, ajuste e lote negativo continuam
//     aparecendo — agora como informativos.
describe('DECISÃO DO MARCO (25/07/2026) — bilheteria em UMA LINHA SÓ, sempre', () => {
  it('(a) com ticket manual, exporta e o valor do arquivo é IGUAL ao da tela (cen.bruta)', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200 }
    const cen = computeCenario(e, 'realista')
    const r = montarItensPlano(e)
    const linha = r.itens.find((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
    expect(linha).toBeTruthy()
    expect(linha.valor).toBeCloseTo(cen.bruta, 6)
  })

  it('(b) o id da linha é o MESMO com e sem ticket manual — nunca muda de id_linha', () => {
    const semManual = eventoBase()
    semManual.id = 'evt-x'
    const comManual = clone(semManual)
    comManual.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    comManual.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200 }

    const idSemManual = montarItensPlano(semManual).itens.find((i) => i.categoria === CATEGORIA_FIN_INGRESSOS).id
    const idComManual = montarItensPlano(comManual).itens.find((i) => i.categoria === CATEGORIA_FIN_INGRESSOS).id
    expect(idSemManual).toBe('evt-x:ingressos')
    expect(idComManual).toBe('evt-x:ingressos')
    expect(idSemManual).toBe(idComManual)
  })

  it('(c) os avisos de ticket manual, ajuste de ticket e lote negativo continuam aparecendo — como informativos', () => {
    const comTicketManual = eventoBase()
    comTicketManual.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    comTicketManual.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200 }
    expect(montarItensPlano(comTicketManual).avisos.some((a) => /ticket médio MANUAL/.test(a))).toBe(true)

    const comAjuste = eventoBase()
    comAjuste.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 })]
    comAjuste.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketPct: 30 }
    expect(montarItensPlano(comAjuste).avisos.some((a) => a.includes('ajuste de ticket'))).toBe(true)

    const comLoteNegativo = eventoBase()
    comLoteNegativo.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Cortesia negativa', valor: -25, quantidade: 200 }),
    ]
    comLoteNegativo.cenariosConfig.realista = { vendaPct: 100, custoPct: 0 }
    expect(montarItensPlano(comLoteNegativo).avisos.some((a) => /NEGATIVA/.test(a))).toBe(true)
  })
})

// ————— Achado do provador adversarial (26/07/2026) — causas COMBINADAS —————
//
// Até aqui os avisos de ticket manual, ajuste % e lote negativo só tinham
// teste ISOLADO (cada causa sozinha). O provador mediu duas mentiras que só
// aparecem quando duas causas estão ativas ao mesmo tempo:
//
// (1) ticket manual e ajuste % não são excludentes (calc.js linha ~396: "o
//     ajuste % do cenário age por cima nos dois casos") — mas o código velho
//     usava if/else if, e com as duas causas ativas o ajuste ficava mudo.
// (2) o aviso de lote negativo sempre descrevia o caminho AUTOMÁTICO (soma
//     dos lotes), mesmo com ticket manual ligado — caminho em que o cálculo
//     IGNORA os lotes (pagos × ticket digitado).
describe('avisosInformativosIngressos — causas combinadas (achado do provador adversarial, 26/07/2026)', () => {
  it('(a) ticket manual + ajuste %: as DUAS causas aparecem no texto, cada uma com o valor exportado', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200, ticketPct: 15 }
    const cen = computeCenario(e, 'realista')
    // o ajuste está DENTRO do número exportado (o defeito original: a tela
    // dizia só "usa o ticket MANUAL", nunca mencionando os 15%).
    expect(cen.bruta).toBeCloseTo(250 * 200 * 1.15, 6)

    const r = montarItensPlano(e)
    const avisoManual = r.avisos.find((a) => /ticket médio MANUAL/.test(a))
    const avisoAjuste = r.avisos.find((a) => a.includes('ajuste de ticket'))
    expect(avisoManual).toBeTruthy()
    expect(avisoAjuste).toBeTruthy()
    expect(avisoManual).toContain(fmtBRL(cen.bruta))
    expect(avisoAjuste).toContain(fmtBRL(cen.bruta))
    expect(avisoAjuste).toContain('15%')
  })

  it('(b) ticket manual + lote negativo: o aviso do lote negativo diz a verdade do caminho MANUAL (o lote não entrou na conta)', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Cortesia negativa', valor: -25, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200 }
    const cen = computeCenario(e, 'realista')
    const somaPorLote = cen.porLote.reduce((s, l) => s + l.receita, 0)
    // o valor exportado É o do ticket manual, bem diferente da soma dos lotes
    // (a medição do provador: Σ porLote = 26.750, cen.bruta = 55.000)
    expect(cen.bruta).toBeCloseTo(400 * 200, 6)
    expect(somaPorLote).not.toBeCloseTo(cen.bruta, 1)

    const r = montarItensPlano(e)
    const avisoLoteNegativo = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(avisoLoteNegativo).toBeTruthy()
    expect(avisoLoteNegativo).toContain(fmtBRL(cen.bruta))
    expect(avisoLoteNegativo).toContain('NÃO entrou nesta conta')
    expect(avisoLoteNegativo).not.toContain('já soma esse valor negativo')
  })

  it('(c) ajuste % + lote negativo, SEM ticket manual: o aviso do lote negativo mantém a frase do caminho automático', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Cortesia negativa', valor: -25, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketPct: 20 }
    const cen = computeCenario(e, 'realista')

    const r = montarItensPlano(e)
    const avisoLoteNegativo = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(avisoLoteNegativo).toBeTruthy()
    expect(avisoLoteNegativo).toContain(fmtBRL(cen.bruta))
    expect(avisoLoteNegativo).toContain('já soma esse valor negativo')
    expect(avisoLoteNegativo).not.toContain('NÃO entrou nesta conta')
  })

  it('(d) as três causas juntas (ticket manual + ajuste % + lote negativo): nenhuma causa some', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Cortesia negativa', valor: -25, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 200, ticketPct: 10 }
    const cen = computeCenario(e, 'realista')

    const r = montarItensPlano(e)
    const avisoManual = r.avisos.find((a) => /ticket médio MANUAL/.test(a))
    const avisoAjuste = r.avisos.find((a) => a.includes('ajuste de ticket'))
    const avisoLoteNegativo = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(avisoManual).toBeTruthy()
    expect(avisoAjuste).toBeTruthy()
    expect(avisoLoteNegativo).toBeTruthy()
    // com ticket manual ativo, o lote negativo NÃO entrou na conta — mesma
    // regra do caso (b), agora com o ajuste % também ligado.
    expect(avisoLoteNegativo).toContain('NÃO entrou nesta conta')
    expect(avisoManual).toContain(fmtBRL(cen.bruta))
    expect(avisoAjuste).toContain(fmtBRL(cen.bruta))
    expect(avisoLoteNegativo).toContain(fmtBRL(cen.bruta))
  })
})

// ————— Achado do provador adversarial (26/07/2026) — bruta ZERADA por —————
// causa que NÃO é venda 0 nem preço R$ 0.
//
// Até aqui, com `bruta === 0`, o texto sempre dizia "venda 0 ou preço R$ 0",
// mesmo quando o zero veio de um ajuste de ticket ou de dois lotes que se
// cancelam — e nesse segundo caso o lote negativo ficava mudo, porque
// `avisosInformativosIngressos` só era chamada com `bruta > 0`.
describe('emitirIngressos — bruta zerada: a causa nomeada no aviso é a real (26/07/2026)', () => {
  it('(a) venda 0 de verdade (preço R$ 0): mantém a frase antiga, byte a byte', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 0, quantidade: 250 })]
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBe(0)

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)).toBe(false)
    expect(
      r.avisos.some(
        (a) =>
          a === 'Nenhum lote tem receita prevista no cenário realista (venda 0 ou preço R$ 0) — nada de "Ingressos" para exportar.'
      )
    ).toBe(true)
    expect(r.avisos.some((a) => a.includes('NÃO é venda 0'))).toBe(false)
  })

  it('(b) ajuste de ticket em -100% com lote vendendo de verdade: nomeia o ajuste, NÃO diz "venda 0"', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })] // R$ 25.000 de venda real
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketPct: -100 }
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBe(0)
    const somaPorLote = cen.porLote.reduce((s, l) => s + l.receita, 0)
    expect(somaPorLote).toBeCloseTo(25000, 6) // a venda real que o ajuste zerou

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)).toBe(false)
    expect(r.avisos.some((a) => a.includes('Nenhum lote tem receita prevista no cenário realista'))).toBe(false)
    const aviso = r.avisos.find((a) => a.includes('ajuste de ticket'))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('-100%')
    expect(aviso).toContain('NÃO é venda 0')
  })

  it('(c) dois lotes que se cancelam exatamente: nomeia o lote NEGATIVO mesmo com bruta zerada', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Estorno', valor: -100, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0 }
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBe(0)
    expect(cen.porLote.some((l) => l.receita < 0)).toBe(true) // o lote negativo existe

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.categoria === CATEGORIA_FIN_INGRESSOS)).toBe(false)
    expect(r.avisos.some((a) => a.includes('Nenhum lote tem receita prevista no cenário realista'))).toBe(false)
    const aviso = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(aviso).toBeTruthy() // antes desta correção, o lote negativo ficava mudo com bruta 0
    expect(aviso).toContain('NÃO é venda 0')
    expect(aviso).toContain(fmtBRL(-20000))
  })

  it('(d) mais de uma causa ativa ao mesmo tempo (ajuste + lote negativo): nenhuma causa some', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Estorno', valor: -50, quantidade: 200 }),
    ]
    // Σ porLote = 200×100 − 200×50 = 10.000, e o ajuste de -100% zera por cima.
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketPct: -100 }
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBe(0)

    const r = montarItensPlano(e)
    const avisoAjuste = r.avisos.find((a) => a.includes('ajuste de ticket'))
    const avisoLoteNegativo = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(avisoAjuste).toBeTruthy()
    expect(avisoLoteNegativo).toBeTruthy()
    expect(avisoAjuste).toContain('NÃO é venda 0')
    expect(avisoLoteNegativo).toContain('NÃO é venda 0')
    expect(r.avisos.some((a) => a.includes('Nenhum lote tem receita prevista no cenário realista'))).toBe(false)
  })
})

// ————— Achado do provador adversarial (26/07/2026) — TERCEIRA porta do —————
// mesmo defeito: o texto de cada causa acima AFIRMAVA UMA NEGATIVA — "a
// causa NÃO é venda 0 nem preço R$ 0" — sem checar se a venda É zero.
// `grep pagos` nos quatro testes da entrega anterior (bloco acima) não
// devolvia nada: os quatro cenários lá SEMPRE tinham venda real (`pagos >
// 0`), então a negativa era verdadeira por acidente, nunca por verificação.
// Os quatro testes abaixo exercitam `cen.pagos` explicitamente — um por
// quadrante — para não reabrir esta porta.
describe('causasBrutaZero — a negativa "venda 0" só pode ser dita depois de checar cen.pagos (26/07/2026)', () => {
  it('(i) venda real 0, NENHUMA flag ativa: mantém a frase antiga, byte a byte (cen.pagos = 0)', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 0, quantidade: 250 })] // preço R$ 0 = cortesia, não paga
    const cen = computeCenario(e, 'realista')
    expect(cen.pagos).toBe(0)
    expect(cen.bruta).toBe(0)

    const r = montarItensPlano(e)
    expect(
      r.avisos.some(
        (a) =>
          a === 'Nenhum lote tem receita prevista no cenário realista (venda 0 ou preço R$ 0) — nada de "Ingressos" para exportar.'
      )
    ).toBe(true)
    expect(r.avisos.some((a) => a.includes('venda é zero'))).toBe(false)
    expect(r.avisos.some((a) => a.includes('NÃO é venda 0'))).toBe(false)
  })

  it('(ii) venda real > 0, flag ativa (ticket manual): nomeia a flag como causa, e a negativa "NÃO é venda 0" é verificada (cen.pagos > 0)', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })] // R$ 150 manual, mas há venda real
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 150, ticketPct: -100 } // ajuste zera por cima
    const cen = computeCenario(e, 'realista')
    expect(cen.pagos).toBe(250) // venda real: 250 ingressos pagos
    expect(cen.bruta).toBe(0)

    const r = montarItensPlano(e)
    const aviso = r.avisos.find((a) => /ticket médio MANUAL/.test(a))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('NÃO é venda 0')
    expect(aviso).not.toContain('a causa é venda 0')
  })

  it('(iii) venda real 0, flag ativa (ticket manual OU ajuste): diz que a venda é zero — a flag some como causa e vira observação (cen.pagos = 0)', () => {
    // Ticket manual de R$ 150 com TODOS os lotes em quantidade 0 (vendaPct
    // 0% no cenário realista) — o caso exato medido pelo provador.
    const eManual = eventoBase()
    eManual.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })]
    eManual.cenariosConfig.realista = { vendaPct: 0, custoPct: 0, ticketMedio: 150 }
    const cenManual = computeCenario(eManual, 'realista')
    expect(cenManual.pagos).toBe(0) // venda real é zero, mesmo com ticket manual configurado
    expect(cenManual.bruta).toBe(0)

    const rManual = montarItensPlano(eManual)
    const avisoManual = rManual.avisos.find((a) => /ticket médio MANUAL/.test(a))
    expect(avisoManual).toBeTruthy()
    expect(avisoManual).toContain('a causa é venda 0')
    expect(avisoManual).not.toContain('NÃO é venda 0')

    // Ajuste de -50% com TODOS os lotes em quantidade 0 — mesmo erro, mesma
    // frase falsa antes da correção.
    const eAjuste = eventoBase()
    eAjuste.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 250 })]
    eAjuste.cenariosConfig.realista = { vendaPct: 0, custoPct: 0, ticketPct: -50 }
    const cenAjuste = computeCenario(eAjuste, 'realista')
    expect(cenAjuste.pagos).toBe(0)
    expect(cenAjuste.bruta).toBe(0)

    const rAjuste = montarItensPlano(eAjuste)
    const avisoAjuste = rAjuste.avisos.find((a) => a.includes('ajuste de ticket'))
    expect(avisoAjuste).toBeTruthy()
    expect(avisoAjuste).toContain('a causa é venda 0')
    expect(avisoAjuste).not.toContain('NÃO é venda 0')
  })

  it('(iv) lote negativo cancelando positivos: mantido — venda real > 0 (cen.pagos > 0), a negativa "NÃO é venda 0" continua legítima', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Estorno', valor: -100, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0 }
    const cen = computeCenario(e, 'realista')
    expect(cen.pagos).toBe(400) // 200 + 200: os dois lotes têm ingresso pago de verdade
    expect(cen.bruta).toBe(0)

    const r = montarItensPlano(e)
    const aviso = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('NÃO é venda 0')
    expect(aviso).not.toContain('a causa é venda 0')
  })
})

// Sessão de clareza (20/07/2026) — o Marco exportou o plano de um evento JÁ
// FECHADO (Marfim 09/05, 99% pago) e estranhou o arquivo levar número
// diferente da tela: Bebidas mostrava R$ 14.872 de realizado e o CSV dizia
// 28.050. Está CERTO por desenho (o plano publica previstos; o realizado já
// entra no Financeiro pelos lançamentos de lá — levar os dois contaria a mesma
// despesa em dobro). O que estava errado era o SILÊNCIO: ele só descobriu
// abrindo o arquivo. O comportamento não muda; o aviso passa a existir.
describe('montarItensPlano — evento que já tem realizado avisa ANTES de gerar', () => {
  it('sem nenhum realizado, o aviso não aparece (nada a explicar)', () => {
    const r = montarItensPlano(eventoBase())
    expect(r.avisos.some((a) => a.includes('realizado preenchido'))).toBe(false)
  })

  it('com realizado preenchido, avisa que o arquivo leva o PREVISTO e por quê', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].estimado = 28050 // "Bebidas" do caso real
    e.categorias[0].itens[0].realizado = 14872
    const r = montarItensPlano(e)
    const aviso = r.avisos.find((a) => a.includes('realizado preenchido'))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('1 item de custo já tem')
    expect(aviso).toContain('PREVISTO')
    expect(aviso).toContain('contaria em dobro')
    // e o arquivo continua levando o previsto — o aviso não muda a saída
    expect(r.itens.find((i) => i.rotulo === 'Gelo').valor).toBe(28050)
    expect(r.bloqueios).toEqual([])
  })

  it('conta os itens no plural e soma o realizado de todos', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].realizado = 1000
    e.categorias[1].itens[0].realizado = 2500
    const r = montarItensPlano(e)
    const aviso = r.avisos.find((a) => a.includes('realizado preenchido'))
    expect(aviso).toContain('2 itens de custo já têm')
    expect(aviso).toContain('3.500')
  })

  it('realizado vazio ou 0 não dispara o aviso — mesma régua de valorConsiderado', () => {
    const e = eventoBase()
    e.categorias[0].itens[0].realizado = ''
    e.categorias[1].itens[0].realizado = 0
    const r = montarItensPlano(e)
    expect(r.avisos.some((a) => a.includes('realizado preenchido'))).toBe(false)
  })
})

// ————————————————————————————————————————————————————————————————————————
// Verificação adversarial de 20/07/2026 (S2 confirmado) — A CONFERÊNCIA TEM
// DE SER FEITA SOBRE O QUE VAI SER EMITIDO NO ARQUIVO, NUNCA SOBRE O QUE FOI
// LIDO DA FONTE.
//
// A trava do §9.1 conferia a soma de `cen.porLote` contra `cen.bruta` e SÓ
// DEPOIS descartava os lotes com receita <= 0 na hora de emitir. Conferia um
// conjunto e escrevia outro: um lote de preço NEGATIVO passava na conferência
// e sumia do arquivo, e o total emitido divergia da tela em silêncio (alertas
// vazios, avisos vazios). A mesma doença existia no custo com valor negativo
// e na parcela negativa.
//
// Valor negativo é digitável de verdade: MoneyInput/NumInput não impõe `min`
// e parseCampoNumerico('-25') devolve { valido: true, valor: -25 }.
// ————————————————————————————————————————————————————————————————————————
describe('montarItensPlano — o arquivo nunca diverge da tela em silêncio (20/07/2026)', () => {
  const somaDe = (r, filtro) => r.itens.filter(filtro).reduce((s, i) => s + i.valor, 0)
  const somaIngressos = (r) => somaDe(r, (i) => i.categoria === CATEGORIA_FIN_INGRESSOS)
  const somaCustos = (r) => somaDe(r, (i) => i.grupo === 'custo' && !i.rotulo.startsWith('Contingência'))

  // REESCRITO em 25/07/2026 (decisão do Marco, ver planoFinanceiro.js): entre
  // 20/07 e 25/07 este teste travava a exportação inteira da bilheteria
  // quando havia lote negativo (nenhuma linha saía, só um alerta). Isso
  // resolvia o S1 original mas trocava "número errado calado" por "bilheteria
  // nenhuma exportada" — o Marco decidiu que `cen.bruta` (a bruta que a
  // fórmula em calc.js já calcula somando TODOS os lotes, negativos
  // inclusive — ver bilheteria() em calc.js) é a verdade, e o arquivo deve
  // levá-la sempre, numa linha só. O que era ALERTA vira AVISO informativo.
  it('LOTE NEGATIVO: a linha de Ingressos leva o líquido certo (cen.bruta), com aviso informativo nomeando o lote negativo', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 200 }),
      novoLote({ nome: 'Cortesia negativa', valor: -25, quantidade: 200 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0 }
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBeCloseTo(15000, 6) // a TELA diz 15.000 (20.000 do Lote 1 − 5.000 da cortesia negativa)

    const r = montarItensPlano(e)
    // A linha única leva a verdade — cen.bruta JÁ soma o lote negativo — e
    // não há mais alerta bloqueando a exportação.
    expect(somaIngressos(r)).toBeCloseTo(15000, 6)
    expect(r.alertas).toEqual([])
    const aviso = r.avisos.find((a) => /NEGATIVA/.test(a))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('15.000')
  })

  it('LOTE NEGATIVO + TICKET MANUAL: os dois avisos aparecem juntos, e a linha leva o valor certo (cen.bruta)', () => {
    const e = eventoBase()
    e.lotes = [
      novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 }),
      novoLote({ nome: 'Cortesia negativa', valor: -50, quantidade: 100 }),
    ]
    e.cenariosConfig.realista = { vendaPct: 100, custoPct: 0, ticketMedio: 25 }
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBeCloseTo(5000, 6) // a TELA diz 5.000 (200 pagos × ticket manual 25)

    const r = montarItensPlano(e)
    // Antes (20–25/07/2026): a mesma divergência do §9.1 original travava a
    // bilheteria inteira. Agora a linha É cen.bruta — não há mais soma de
    // lotes a conferir — e os dois avisos (ticket manual + lote negativo)
    // aparecem juntos, sem bloquear nada.
    expect(somaIngressos(r)).toBeCloseTo(5000, 6)
    expect(r.alertas).toEqual([])
    const texto = r.avisos.join(' ')
    expect(texto).toMatch(/ticket médio/i)
    expect(texto).toMatch(/NEGATIVA/)
    expect(texto).toContain('5.000')
  })

  it('CUSTO NEGATIVO: desconto negociado some do arquivo em silêncio', () => {
    const e = eventoBase()
    e.contingenciaPct = 0
    e.categorias = [
      {
        id: 'artistico',
        nome: 'Artístico',
        padrao: true,
        itens: [
          novoItem({ servico: 'DJ', estimado: 8000 }),
          novoItem({ servico: 'Desconto negociado', estimado: -3000 }),
        ],
      },
    ]
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(5000, 6) // a TELA diz 5.000

    const r = montarItensPlano(e)
    // ANTES: arquivo 8.000 contra tela 5.000, alertas 0.
    // DEPOIS: o DJ (que confere sozinho) sai normal; o item negativo não vira
    // linha nenhuma e o alerta o nomeia, com o valor que ficou de fora.
    expect(r.itens.find((i) => i.rotulo === 'DJ').valor).toBe(8000)
    expect(r.itens.some((i) => i.rotulo === 'Desconto negociado')).toBe(false)
    expect(r.alertas.length).toBe(1)
    expect(r.alertas[0]).toContain('Desconto negociado')
    expect(r.alertas[0]).toContain('3.000')
    expect(r.alertas[0]).toMatch(/NEGATIVO/)
  })

  it('PARCELA NEGATIVA: a soma confere contra o estimado e o arquivo leva outra coisa', () => {
    const e = eventoBase()
    e.contingenciaPct = 0
    e.categorias = [
      {
        id: 'artistico',
        nome: 'Artístico',
        padrao: true,
        itens: [
          novoItem({
            servico: 'DJ',
            estimado: 8000,
            parcelas: [novaParcela({ valor: 10000, data: '2026-08-01' }), novaParcela({ valor: -2000, data: '2026-08-10' })],
          }),
        ],
      },
    ]
    const r = montarItensPlano(e)
    // ANTES: Σ parcelas = 8.000 = estimado → a conferência APROVAVA, a parcela
    // negativa era descartada e o arquivo levava 10.000, calado.
    // DEPOIS: nenhuma parcela sai e o alerta diz 8.000 esperado × 10.000 emitido.
    expect(somaCustos(r)).toBe(0)
    expect(r.alertas.length).toBe(1)
    expect(r.alertas[0]).toContain('DJ')
    expect(r.alertas[0]).toContain('8.000')
    expect(r.alertas[0]).toContain('10.000')
  })
})

// FOTOGRAFIA BYTE A BYTE do arquivo de um evento NORMAL (sem nenhum valor
// negativo), capturada rodando o código ANTES da correção de 20/07/2026 e
// colada aqui verbatim. É a prova da exigência "não mude nenhum número que
// hoje sai certo": a conferência passou a ser feita sobre as linhas emitidas,
// e o arquivo do caminho normal — bar, custo simples, custo parcelado e
// contingência — continua idêntico, caractere por caractere.
//
// A LINHA DE INGRESSOS FOI ATUALIZADA EM 25/07/2026 (decisão do Marco — ver
// planoFinanceiro.js): passou de `EVT:ingressos:L1` / descrição "Lote 1" para
// `EVT:ingressos` / descrição "Ingressos (bilheteria)". O VALOR não mudou
// (este evento tem um lote só, então a soma por lote e a bilheteria da tela
// sempre foram o mesmo número, R$ 22.500) — só a FORMA da linha, coerente
// com todo o resto do módulo.
describe('montarItensPlano — o caminho normal não mudou nem um byte (exceto a forma da linha de Ingressos, 25/07/2026)', () => {
  const CSV_ATUAL =
    'id_linha,marca,evento,data_evento,categoria,descricao,valor_previsto,data_lancamento\r\n' +
    'EVT:ingressos,Brisa,Brisa 15/08,2026-08-15,Ingressos,Ingressos (bilheteria),22500,\r\n' +
    'EVT:bar:1,Brisa,Brisa 15/08,2026-08-15,Bar / Consumo,Receita de bar (estimada),3000,\r\n' +
    'EVT:aeb:I1,Brisa,Brisa 15/08,2026-08-15,A&B / CMV,Gelo,500,\r\n' +
    'EVT:artistico:I2:P1,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ · parcela 1/2,5000,2026-07-01\r\n' +
    'EVT:artistico:I2:P2,Brisa,Brisa 15/08,2026-08-15,Artístico / DJ,DJ · parcela 2/2,3000,2026-08-01\r\n' +
    'EVT:contingencia:1,Brisa,Brisa 15/08,2026-08-15,Outras despesas,Contingência (5%),425,\r\n'

  it('gera exatamente o mesmo CSV de hoje, e sem alerta nenhum', () => {
    const e = eventoBase()
    e.id = 'EVT'
    e.contingenciaPct = 5
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: 3000, patrocinio: 2000 }
    e.lotes[0].id = 'L1'
    e.categorias[0].itens[0].id = 'I1'
    e.categorias[1].itens[0].id = 'I2'
    e.categorias[1].itens[0].parcelas = [
      novaParcela({ id: 'P1', valor: 5000, data: '2026-07-01' }),
      novaParcela({ id: 'P2', valor: 3000, data: '2026-08-01' }),
    ]
    const r = montarItensPlano(e)
    expect(r.alertas).toEqual([])
    expect(r.avisos).toEqual([])
    expect(r.bloqueios).toEqual([])
    expect(gerarCSVPlano(r.itens, e)).toBe(CSV_ATUAL)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EVIDÊNCIA PRIMEIRO (20/07/2026) — os CINCO pontos que sobraram do diagnóstico
// arquitetural do BACKLOG: "confere um conjunto e emite outro".
//
// Estes testes foram escritos ANTES da correção e FALHAM no código de hoje. Em
// todos, o padrão é o mesmo e é o pior possível: o arquivo sai discordando da
// tela com `alertas: []` e `avisos: []` — o S1 do §9.1 do laudo externo
// reaparecendo por outra porta.
// ═══════════════════════════════════════════════════════════════════════════

/** Evento mínimo e exportável: um lote vendendo (para o aviso de "nenhum lote
 *  tem receita" não poluir a leitura), sem bar, sem patrocínio, sem custo. */
function eventoMagro() {
  const e = novoEvento('Evidência')
  e.id = 'evt'
  e.tipo = 'Brisa'
  e.data = '2026-08-15'
  e.lotes = [{ ...novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 }), id: 'l1' }]
  e.categorias = []
  e.contingenciaPct = 0
  return e
}

/** Soma só as linhas de CUSTO do arquivo (a Decisão 2 é sobre custo). */
const somaCustos = (r) => r.itens.filter((i) => i.grupo === 'custo').reduce((s, i) => s + i.valor, 0)

describe('DECISÃO 1 do Marco (20/07/2026) — custo com parcelas TODAS em branco', () => {
  function eventoDjParcelasEmBranco(patchParcela = {}) {
    const e = eventoMagro()
    e.contingenciaPct = 5
    e.categorias = [
      {
        id: 'artistico',
        nome: 'Artístico',
        padrao: true,
        itens: [
          {
            ...novoItem({ servico: 'DJ', estimado: 8000 }),
            id: 'dj',
            parcelas: [novaParcela({ id: 'pa', ...patchParcela }), novaParcela({ id: 'pb', ...patchParcela })],
          },
        ],
      },
    ]
    return e
  }

  it('o arquivo leva o ESTIMADO do custo, numa linha só (hoje leva só a contingência)', () => {
    const e = eventoDjParcelasEmBranco()
    const cen = computeCenario(e, 'realista')
    // A tela: custo considerado 8.000 + contingência 400 = 8.400.
    expect(cen.custoItens).toBe(8000)
    expect(cen.contingencia).toBe(400)
    expect(cen.custoTotal).toBe(8400)

    const r = montarItensPlano(e)
    expect(r.itens.filter((i) => i.grupo === 'custo').length).toBe(2)
    const dj = r.itens.find((i) => i.id === 'evt:artistico:dj')
    expect(dj).toBeDefined()
    expect(dj.valor).toBe(8000)
    expect(dj.dataLancamento).toBe('')
    expect(r.itens.find((i) => i.id === 'evt:contingencia:1').valor).toBe(400)
  })

  it('avisa que a agenda não existe e que a DATA que foi para o arquivo é provisória', () => {
    const r = montarItensPlano(eventoDjParcelasEmBranco())
    const aviso = r.avisos.find((a) => a.includes('DJ'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('R$ 8.000')
    expect(aviso).toContain('parcela')
    expect(/provisóri|chute/i.test(aviso)).toBe(true)
    // Canal AMARELO: nada ficou de fora do arquivo — o que é provisório é a data.
    expect(r.alertas).toEqual([])
  })

  it('com dataPagamento preenchida, o aviso cita a data e ela sai na coluna', () => {
    const e = eventoDjParcelasEmBranco()
    e.categorias[0].itens[0].dataPagamento = '2026-07-31'
    const r = montarItensPlano(e)
    expect(r.itens.find((i) => i.id === 'evt:artistico:dj').dataLancamento).toBe('2026-07-31')
    expect(r.avisos.find((a) => a.includes('DJ'))).toContain('31/07/2026')
  })

  it('parcelas ZERADAS à mão contam como agenda em branco (a régua ampla)', () => {
    const r = montarItensPlano(eventoDjParcelasEmBranco({ valor: 0 }))
    expect(r.itens.find((i) => i.id === 'evt:artistico:dj').valor).toBe(8000)
    expect(r.avisos.some((a) => a.includes('DJ'))).toBe(true)
  })

  it('a régua é o valor DEFAULT de novaParcela(), não o literal ""', () => {
    // Se um dia a parcela nascer com outro default, este teste acusa antes de
    // a Decisão 1 apodrecer em silêncio.
    expect(num(novaParcela().valor)).toBe(0)
  })

  it('CASO VIZINHO (não decidido, não muda): parcelas PARCIALMENTE preenchidas', () => {
    const e = eventoDjParcelasEmBranco()
    e.categorias[0].itens[0].parcelas[0] = novaParcela({ id: 'pa', valor: 10000, data: '2026-07-10' })
    const r = montarItensPlano(e)
    const linhas = r.itens.filter((i) => i.id.startsWith('evt:artistico:dj'))
    expect(linhas.length).toBe(1)
    expect(linhas[0].valor).toBe(10000)
    expect(r.avisos.some((a) => a.includes('somam') && a.includes('diferente do estimado'))).toBe(true)
  })
})

describe('DECISÃO 2 do Marco (20/07/2026) — ajuste de custo do cenário realista', () => {
  function eventoComAjuste(pct) {
    const e = eventoMagro()
    e.contingenciaPct = 5
    e.categorias = [
      {
        id: 'artistico',
        nome: 'Artístico',
        padrao: true,
        itens: [{ ...novoItem({ servico: 'DJ', estimado: 8000 }), id: 'dj' }],
      },
    ]
    e.cenariosConfig.realista = { ...e.cenariosConfig.realista, custoPct: pct }
    return e
  }

  it('+10%: o arquivo publica o CRU (8.400) e avisa que não carrega o ajuste', () => {
    const e = eventoComAjuste(10)
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(9240, 6) // a TELA
    const r = montarItensPlano(e)
    expect(somaCustos(r)).toBe(8400) // o ARQUIVO — cru, de propósito
    const aviso = r.avisos.find((a) => a.includes('%') && a.includes('não carrega'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('+10%')
    expect(r.alertas).toEqual([])
  })

  it('−20%: mesmo arquivo cru, e o aviso diz que ele manda MAIS dinheiro que a tela', () => {
    const e = eventoComAjuste(-20)
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(6720, 6) // a TELA
    const r = montarItensPlano(e)
    expect(somaCustos(r)).toBe(8400) // o ARQUIVO
    const aviso = r.avisos.find((a) => a.includes('não carrega'))
    expect(aviso).toContain('−20%')
    expect(aviso).toContain('R$ 6.720') // a tela
    expect(aviso).toContain('R$ 8.400') // o arquivo
    // 20/07/2026: o texto passou a dizer a diferença REAL (o que foi emitido
    // menos o que a tela mostra), com a direção vinda do sinal dela.
    expect(aviso).toContain('a MAIS do que a tela mostra')
    expect(aviso).toContain('R$ 1.680')
  })

  it('0%: nenhum aviso de ajuste (o default não tem nada a dizer)', () => {
    const r = montarItensPlano(eventoComAjuste(0))
    expect(r.avisos.some((a) => a.includes('não carrega'))).toBe(false)
    expect(r.avisos).toEqual([])
  })
})

describe('PONTO 5 — bar com receita <= 0 sumia do arquivo sem uma palavra', () => {
  function eventoBarPorPessoaNegativo() {
    const e = eventoMagro()
    e.lotes = [{ ...novoLote({ nome: 'Lote 1', valor: 100, quantidade: 100 }), id: 'l1' }]
    e.cenariosConfig.realista = { ...e.cenariosConfig.realista, vendaPct: 100 }
    e.barModo = 'porPessoa'
    e.barTicket = { pessimista: '', realista: 40, otimista: '' }
    e.barCustoSistema = 8000
    return e
  }

  it('bar POR PESSOA líquido negativo: nenhuma linha, mas agora COM alerta', () => {
    const e = eventoBarPorPessoaNegativo()
    const cen = computeCenario(e, 'realista')
    // Não é preciso digitar número negativo nenhum: 40 × 100 − 8.000 = −4.000.
    expect(cen.bar).toBe(-4000)
    // O estado ANTIGO, que este teste vem matar: a tela mostra 5.500 de receita
    // total e o arquivo levava 10.000 de bilheteria, com 0 alerta e 0 aviso.
    expect(cen.receitaTotal).toBe(5500)

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.id === 'evt:bar:1')).toBe(false)
    const alerta = r.alertas.find((a) => a.includes('bar') || a.includes('Bar') || a.includes('BAR'))
    expect(alerta).toBeDefined()
    expect(alerta).toContain('-R$ 4.000')
    expect(/por pessoa/i.test(alerta)).toBe(true)
  })

  it('bar FIXO negativo: mesmo alerta, sem a frase do modo por pessoa', () => {
    const e = eventoMagro()
    e.barModo = 'fixo'
    e.outrasReceitas = { bar: -2000, patrocinio: '' }
    const r = montarItensPlano(e)
    const alerta = r.alertas.find((a) => a.includes('BAR') || a.includes('Bar') || a.includes('bar'))
    expect(alerta).toBeDefined()
    expect(alerta).toContain('-R$ 2.000')
    expect(/por pessoa/i.test(alerta)).toBe(false)
  })

  it('bar = 0 (open bar ou campo vazio): zero alerta, zero aviso — silêncio total', () => {
    const e = eventoMagro()
    e.openBar = true
    const r = montarItensPlano(e)
    expect(r.alertas).toEqual([])
    expect(r.avisos).toEqual([])
  })
})

describe('PONTO 7 — contingência NEGATIVA sumia do arquivo', () => {
  it('contingência de −10% sobre custo 500: nenhuma linha, mas agora com alerta', () => {
    const e = eventoMagro()
    e.contingenciaPct = -10
    e.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        padrao: true,
        itens: [{ ...novoItem({ servico: 'Gelo', estimado: 500 }), id: 'gelo' }],
      },
    ]
    const cen = computeCenario(e, 'realista')
    expect(cen.contingencia).toBe(-50)
    expect(cen.custoTotal).toBe(450) // a TELA

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.id === 'evt:contingencia:1')).toBe(false)
    // O custo de 500 continua saindo — só a contingência é que fica de fora.
    expect(r.itens.find((i) => i.id === 'evt:aeb:gelo').valor).toBe(500)
    const alerta = r.alertas.find((a) => /conting/i.test(a))
    expect(alerta).toBeDefined()
    expect(alerta).toContain('−10%')
    expect(alerta).toContain('-R$ 50')
  })
})

describe('PONTO 8 — patrocínio fechado NEGATIVO sumia do arquivo', () => {
  it('dois confirmados, 5.000 e −6.000: nenhuma linha, mas agora com alerta', () => {
    const e = eventoMagro()
    e.patrocinios = [
      { id: 'p1', nome: 'Cerveja X', valor: 5000, estagio: 'confirmado' },
      { id: 'p2', nome: 'Abatimento', valor: -6000, estagio: 'confirmado' },
    ]
    const cen = computeCenario(e, 'realista')
    expect(cen.patrocinio).toBe(-1000)

    const r = montarItensPlano(e)
    expect(r.itens.some((i) => i.id === 'evt:patrocinio:1')).toBe(false)
    const alerta = r.alertas.find((a) => /patroc/i.test(a))
    expect(alerta).toBeDefined()
    expect(alerta).toContain('-R$ 1.000')
  })

  it('CONTROLE: total POSITIVO com um item negativo dentro sai correto e calado', () => {
    const e = eventoMagro()
    e.patrocinios = [
      { id: 'p1', nome: 'Cerveja X', valor: 15000, estagio: 'confirmado' },
      { id: 'p2', nome: 'Abatimento', valor: -5000, estagio: 'confirmado' },
    ]
    const r = montarItensPlano(e)
    expect(r.itens.find((i) => i.id === 'evt:patrocinio:1').valor).toBe(10000)
    expect(r.alertas).toEqual([])
    expect(r.avisos).toEqual([])
  })
})

describe('O EMISSOR contra si mesmo — a invariante que impede o NONO furo', () => {
  it('toda montagem devolve a trilha de conferências, com os 5 blocos presentes', () => {
    const r = montarItensPlano(eventoBase())
    expect(Array.isArray(r.conferencias)).toBe(true)
    const blocos = new Set(r.conferencias.map((c) => String(c.bloco).split(':')[0]))
    for (const b of BLOCOS_DO_PLANO) expect(blocos.has(b)).toBe(true)
  })

  it('bloco que NÃO foi conferido vira alerta de erro interno (nada sai calado)', () => {
    const E = criarEmissorDoPlano()
    E.emitir({ bloco: 'ingressos', linhas: [], referencia: 0, aoDivergir: () => '' })
    const r = E.selar()
    const erro = r.alertas.find((a) => a.includes('Erro interno'))
    expect(erro).toBeDefined()
    expect(erro).toContain('bar')
    expect(erro).toContain('Nenhum dado do evento foi alterado')
  })

  it('nenhuma linha chega ao arquivo por fora do emissor (leitura do próprio módulo)', () => {
    const fonte = readFileSync(new URL('./planoFinanceiro.js', import.meta.url), 'utf8')
    const corpo = fonte.slice(fonte.indexOf('export function montarItensPlano'))
    // A porta é uma só: emitir(). `itens.push` fora do closure do emissor é
    // exatamente o defeito reincidente deste módulo — oito vezes em dois dias.
    expect(corpo.includes('itens.push(')).toBe(false)
    // E referência nunca pode ser a soma do próprio conjunto emitido: era assim
    // que a conferência aprovava a própria omissão (o buraco das parcelas).
    expect(corpo.includes('referencia: linhas')).toBe(false)
  })
})

// ————————————————————————————————————————————————————————————————————————
// VERIFICAÇÃO ADVERSARIAL DE 20/07/2026 — a doença do emissor reapareceu
// DENTRO DOS TEXTOS. O princípio que estes testes cobram, em uma linha:
// NENHUM TEXTO PODE AFIRMAR UM NÚMERO QUE NÃO VEIO DO QUE FOI REALMENTE
// EMITIDO. Um aviso que confere um conjunto e afirma outro é o mesmo S1 do
// §9.1 do laudo, só que escrito em português.
// ————————————————————————————————————————————————————————————————————————

/** Evento nu: sem lote, sem bar, sem patrocínio — só os custos que o caso pede. */
function eventoSoCustos(itensPorCategoria, { contingenciaPct = 5, custoPct = 0 } = {}) {
  const e = novoEvento('Brisa 15/08')
  e.tipo = 'Brisa'
  e.data = '2026-08-15'
  e.lotes = []
  e.contingenciaPct = contingenciaPct
  e.cenariosConfig.realista = { ...e.cenariosConfig.realista, custoPct }
  e.categorias = itensPorCategoria
  return e
}

const somaDeCustosEmitidos = (r) =>
  r.itens.filter((i) => i.grupo === 'custo').reduce((s, i) => s + num(i.valor), 0)

const avisoDoAjuste = (r) => r.avisos.find((a) => a.includes('ajuste nos custos'))

describe('[S1] o aviso do ajuste de custo só pode afirmar o que FOI EMITIDO', () => {
  it('realizado: o aviso não pode afirmar o CONSIDERADO (que o arquivo não leva)', () => {
    const e = eventoSoCustos(
      [
        { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ servico: 'Gelo', estimado: 500 })] },
        {
          id: 'artistico',
          nome: 'Artístico',
          padrao: true,
          itens: [novoItem({ servico: 'DJ', estimado: 8000, realizado: 20000 })],
        },
      ],
      { custoPct: 10 }
    )
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(23677.5, 2) // a TELA
    const r = montarItensPlano(e)
    expect(somaDeCustosEmitidos(r)).toBeCloseTo(9525, 2) // o ARQUIVO
    const aviso = avisoDoAjuste(r)
    expect(aviso).toBeTruthy()
    // O número que o aviso afirma tem de ser o EMITIDO, nunca o considerado.
    expect(aviso).not.toContain('21.525')
    expect(aviso).toContain('9.525')
    // E a diferença tem de ser a real (23.677,50 − 9.525), não 2.152,50.
    expect(aviso).toContain('14.153')
    expect(aviso).not.toContain('2.153')
  })

  it('parcelas: a DIREÇÃO do efeito não pode sair invertida', () => {
    const dj = novoItem({ servico: 'DJ', estimado: 8000 })
    dj.parcelas = [novaParcela({ valor: 3000 }), novaParcela({ valor: 3000 })]
    const e = eventoSoCustos(
      [
        { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ servico: 'Gelo', estimado: 500 })] },
        { id: 'artistico', nome: 'Artístico', padrao: true, itens: [dj] },
      ],
      { custoPct: -20 }
    )
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(7140, 2)
    const r = montarItensPlano(e)
    expect(somaDeCustosEmitidos(r)).toBeCloseTo(6925, 2)
    const aviso = avisoDoAjuste(r)
    // O arquivo manda MENOS (6.925 < 7.140). O texto antigo dizia "MAIS 1.785".
    expect(aviso).toContain('a MENOS')
    expect(aviso).toContain('215')
    expect(aviso).not.toContain('1.785')
  })

  it('bloco REJEITADO: o aviso não pode subestimar o que ficou de fora', () => {
    const e = eventoSoCustos(
      [
        {
          id: 'artistico',
          nome: 'Artístico',
          padrao: true,
          itens: [
            novoItem({ servico: 'DJ', estimado: 8000 }),
            novoItem({ servico: 'Permuta', estimado: -3000 }),
          ],
        },
      ],
      { custoPct: -20 }
    )
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(4200, 2)
    const r = montarItensPlano(e)
    expect(somaDeCustosEmitidos(r)).toBeCloseTo(8250, 2) // permuta rejeitada
    const aviso = avisoDoAjuste(r)
    expect(aviso).toContain('a MAIS')
    expect(aviso).toContain('4.050')
    expect(aviso).not.toContain('1.050')
  })

  it('controle: evento limpo continua com o aviso EXATO', () => {
    const e = eventoSoCustos(
      [{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [novoItem({ servico: 'DJ', estimado: 8000 })] }],
      { custoPct: 10 }
    )
    const r = montarItensPlano(e)
    const aviso = avisoDoAjuste(r)
    expect(aviso).toContain('R$ 9.240') // tela
    expect(aviso).toContain('R$ 8.400') // arquivo
    expect(aviso).toContain('R$ 840 a MENOS')
  })
})

describe('[S4] o aviso do ajuste não dispara com efeito prático de R$ 0', () => {
  it('custoPct 0,0001 não produz um aviso que afirma "R$ 0"', () => {
    const e = eventoSoCustos(
      [{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [novoItem({ servico: 'DJ', estimado: 8000 })] }],
      { custoPct: 0.0001 }
    )
    const r = montarItensPlano(e)
    expect(avisoDoAjuste(r)).toBeUndefined()
    expect(r.avisos.join(' ')).not.toContain('R$ 0 a MENOS')
  })

  it('mas um ajuste com efeito de verdade continua avisando', () => {
    const e = eventoSoCustos(
      [{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [novoItem({ servico: 'DJ', estimado: 8000 })] }],
      { custoPct: 1 }
    )
    expect(avisoDoAjuste(montarItensPlano(e))).toBeTruthy()
  })
})

describe('[S2-a] taxa e cashback não podem sumir sem nome nem valor', () => {
  it('declara taxa e cashback como fora do arquivo, com o valor em R$', () => {
    const e = eventoBase() // defaults: taxa 10%, cashback 5%
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBeCloseTo(22500, 2)
    expect(cen.taxa).toBeCloseTo(2250, 2)
    expect(cen.cashback).toBeCloseTo(1125, 2)
    expect(cen.receitaTotal).toBeCloseTo(21375, 2)
    const r = montarItensPlano(e)
    expect(r.foraDoArquivo).toBeTruthy()
    const rotulos = r.foraDoArquivo.map((f) => f.rotulo).join(' | ')
    expect(rotulos).toContain('Taxa')
    expect(rotulos).toContain('Cashback')
    const soma = r.foraDoArquivo.reduce((s, f) => s + f.valor, 0)
    // O que a tela conta a mais/menos que o arquivo, na receita: fecha exato.
    expect(cen.bruta + soma).toBeCloseTo(cen.receitaTotal - cen.bar - cen.patrocinio, 2)
  })

  it('sem taxa e sem cashback, nada é declarado à toa', () => {
    const e = eventoBase()
    e.taxaBilheteria = 0
    e.cashbackPct = 0
    expect(montarItensPlano(e).foraDoArquivo).toEqual([])
  })

  it('a tela não promete completude sem mostrar o que ficou de fora', () => {
    const fonte = readFileSync(new URL('../components/PlanoExportModal.jsx', import.meta.url), 'utf8')
    expect(fonte).toContain('foraDoArquivo')
    const promessa = 'Cada real que a tela mostra está neste arquivo, ou está explicado acima.'
    if (fonte.includes(promessa)) expect(fonte).toContain('foraDoArquivo.length === 0')
  })
})

describe('[S2-b] custo que só tem realizado não pode passar como ok e em silêncio', () => {
  it('alerta e a conferência do bloco NÃO aprova a própria omissão', () => {
    const gelo = novoItem({ servico: 'Gelo', estimado: '' })
    gelo.realizado = 5000
    const e = eventoSoCustos([{ id: 'aeb', nome: 'A&B', padrao: true, itens: [gelo] }])
    const cen = computeCenario(e, 'realista')
    expect(cen.custoTotal).toBeCloseTo(5250, 2)
    const r = montarItensPlano(e)
    expect(somaDeCustosEmitidos(r)).toBeCloseTo(250, 2)
    expect(r.alertas.length).toBeGreaterThan(0)
    expect(r.alertas.join(' ')).toContain('Gelo')
    const conf = r.conferencias.find((c) => c.rotulo === 'Gelo')
    expect(conf.confere).toBe(false)
    expect(conf.referencia).toBeCloseTo(5000, 2)
  })

  it('item com estimado E realizado segue exportando o estimado, sem alerta', () => {
    const gelo = novoItem({ servico: 'Gelo', estimado: 500 })
    gelo.realizado = 5000
    const e = eventoSoCustos([{ id: 'aeb', nome: 'A&B', padrao: true, itens: [gelo] }])
    const r = montarItensPlano(e)
    expect(r.alertas).toEqual([])
    expect(r.itens.find((i) => i.rotulo === 'Gelo').valor).toBe(500)
  })
})

describe('[S3-a] a coluna da tabela não pode se chamar "Na tela"', () => {
  it('o rótulo diz que a coluna é a REFERÊNCIA conferida, não o que a tela mostra', () => {
    const fonte = readFileSync(new URL('../components/PlanoExportModal.jsx', import.meta.url), 'utf8')
    expect(fonte).not.toContain('>Na tela<')
    expect(fonte).toContain('Conferido contra')
  })
})

describe('[S3-b] o aviso da agenda em branco não pode negar o que o Marco preencheu', () => {
  it('parcelas em branco COM datas: as datas são citadas, não negadas', () => {
    const dj = novoItem({ servico: 'DJ', estimado: 8000 })
    dj.parcelas = [novaParcela({ data: '2026-07-10' }), novaParcela({ data: '2026-08-10' })]
    const e = eventoSoCustos([{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [dj] }])
    const aviso = montarItensPlano(e).avisos.find((a) => a.includes('DJ'))
    expect(aviso).toBeTruthy()
    expect(aviso).toContain('10/07/2026')
    expect(aviso).toContain('10/08/2026')
    expect(aviso).not.toContain('saiu vazia')
  })

  it('parcelas com 0 DIGITADO: o texto diz que o app lê 0 como vazio e a ação acerta o alvo', () => {
    const dj = novoItem({ servico: 'DJ', estimado: 8000 })
    dj.parcelas = [novaParcela({ valor: 0 }), novaParcela({ valor: 0 })]
    const e = eventoSoCustos([{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [dj] }])
    const aviso = montarItensPlano(e).avisos.find((a) => a.includes('DJ'))
    expect(aviso).toContain('0')
    expect(aviso).toContain('ainda não sei')
    expect(aviso).toContain('APAGUE')
    expect(aviso).not.toContain('nenhuma com valor preenchido')
  })

  it('parcelas 100% em branco e SEM data: o texto de sempre continua válido', () => {
    const dj = novoItem({ servico: 'DJ', estimado: 8000 })
    dj.parcelas = [novaParcela({}), novaParcela({})]
    const e = eventoSoCustos([{ id: 'artistico', nome: 'Artístico', padrao: true, itens: [dj] }])
    const aviso = montarItensPlano(e).avisos.find((a) => a.includes('DJ'))
    expect(aviso).toContain('nenhuma com valor preenchido')
    expect(aviso).toContain('saiu vazia')
  })
})

// REESCRITO em 25/07/2026: o cenário original usava ticket médio manual para
// provocar o alerta de ingressos — mas, pela decisão do Marco daquela data,
// ticket manual deixou de bloquear a exportação (vira aviso informativo, ver
// planoFinanceiro.js). O alerta de ingressos só existe hoje quando a
// bilheteria do cenário realista fecha NEGATIVA no total; o cenário abaixo
// usa isso para continuar cobrando a mesma garantia: o alerta fala só dos
// ingressos, sem prometer nada sobre os blocos que não inspecionou.
describe('[S3-c] o alerta de ingressos não garante blocos que não inspecionou', () => {
  it('não afirma que bar, patrocínio e custos estão corretos', () => {
    const e = eventoBase()
    e.lotes = [novoLote({ nome: 'Lote negativo', valor: -50, quantidade: 100 })]
    e.cenariosConfig.realista = { ...e.cenariosConfig.realista, vendaPct: 100 }
    e.categorias[1].itens.push(novoItem({ servico: 'Permuta', estimado: -3000 }))
    const cen = computeCenario(e, 'realista')
    expect(cen.bruta).toBeLessThan(0) // a bilheteria líquida fechou negativa
    const r = montarItensPlano(e)
    const texto = r.alertas.join(' ')
    expect(texto).toContain('INGRESSOS')
    expect(texto).not.toContain('bar, patrocínio e custos abaixo estão corretos')
  })
})

// ————————————————————————————————————————————————————————————————————————
// A TOLERÂNCIA DA CONFERÊNCIA É UMA FRONTEIRA, NÃO UM EMPATE (27/07/2026).
//
// `TOLERANCIA_CONFERENCIA` vale meio centavo, e o módulo escreve a régua em
// uma linha: diferença de meio centavo PARA CIMA é divergência de verdade,
// abaixo disso é ruído de ponto flutuante. Todo teste de conferência daqui de
// cima bate longe da fronteira — centenas de reais de um lado, resíduo de
// 1e−12 do outro. Resultado medido em 27/07/2026: trocar o `<` por `<=` em
// planoFinanceiro.js:119, que é o código passar a dizer o CONTRÁRIO da régua
// que ele documenta, mantinha os 2.279 testes da casa verdes.
//
// Meio centavo cravado é caso raro, e é justamente o que se espera de uma
// fronteira. O que ele não é: inofensivo. Com o `<=`, a divergência de meio
// centavo entra no arquivo sem uma palavra E a tabela "o que a tela diz × o
// que este arquivo leva" carimba o bloco como CONFERIDO — a mentira exata que
// o emissor foi escrito para não contar.
//
// POR QUE OS VALORES DESTE BLOCO SÃO PEQUENOS: a fronteira precisa cair em
// cima da régua, e em ponto flutuante 1.000,005 − 1.000 dá 0,0049999999999954
// (medido) — nem meio centavo. Só diferenças calculadas a partir do zero
// fecham EXATO em 0,005, e é por isso que os casos abaixo têm um dos lados
// zerado. A asserção `toBe(TOLERANCIA_CONFERENCIA)` está dentro de cada teste
// para que nenhum deles possa passar por acidente, longe da fronteira.
// ————————————————————————————————————————————————————————————————————————
describe('conferência do emissor — meio centavo CRAVADO já é divergência', () => {
  const MEIO_CENTAVO = 0.005

  it('meio centavo A MAIS do que a tela: vira alerta e a linha NÃO entra no arquivo', () => {
    // O patrocínio da Brisa 15/08 ficou inteiro com a outra festa, então a
    // tela do plano mostra R$ 0,00 nesse bloco. A montagem, mesmo assim,
    // produziu uma linha de meio centavo — sobra do rateio do acordo entre as
    // duas festas. Se ela entrar, o arquivo que vai para o Financeiro leva
    // dinheiro que a tela não mostra, e o rodapé promete o contrário.
    expect(Math.abs(MEIO_CENTAVO - 0)).toBe(TOLERANCIA_CONFERENCIA) // em cima da régua

    const E = criarEmissorDoPlano()
    const confere = E.emitir({
      bloco: 'patrocinio',
      rotulo: 'Patrocínio',
      linhas: [{ id_linha: 'patrocinio-rateio', grupo: 'receita', valor: MEIO_CENTAVO }],
      referencia: 0,
      aoDivergir: ({ referencia, somaEmitida }) =>
        `Patrocínio: a tela diz ${fmtBRL(referencia)} e as linhas somam ${fmtBRL(somaEmitida)}.`,
    })
    const r = E.selar({ parcial: true })

    expect(confere).toBe(false)
    expect(r.itens).toHaveLength(0) // nenhuma linha do bloco sai
    expect(r.alertas).toHaveLength(1)
    expect(r.conferencias[0].confere).toBe(false) // e a tabela da tela diz a verdade
  })

  it('meio centavo A MENOS do que a tela: vira alerta mesmo sem nenhuma linha para segurar', () => {
    // O inverso, e o mais traiçoeiro: a tela conta meio centavo no bloco do bar
    // — sobra do rateio do open bar — e nenhuma linha se montou, então o
    // arquivo levaria R$ 0,00. Não há linha para segurar; o que se segura é o
    // carimbo de "conferido". Sem o alerta, a diferença some entre a tela e o
    // Financeiro sem ninguém ter visto.
    expect(Math.abs(0 - MEIO_CENTAVO)).toBe(TOLERANCIA_CONFERENCIA) // em cima da régua

    const E = criarEmissorDoPlano()
    const confere = E.emitir({
      bloco: 'bar',
      rotulo: 'Bar',
      linhas: [],
      referencia: MEIO_CENTAVO,
      aoDivergir: ({ referencia, somaEmitida }) =>
        `Bar: a tela diz ${fmtBRL(referencia)} e o arquivo levaria ${fmtBRL(somaEmitida)}.`,
    })
    const r = E.selar({ parcial: true })

    expect(confere).toBe(false)
    expect(r.alertas).toHaveLength(1)
    expect(r.conferencias[0].confere).toBe(false)
  })

  it('resíduo de ponto flutuante continua conferindo — a régua não virou "zero exato"', () => {
    // O outro lado da mesma linha, para os dois testes acima não serem lidos
    // como "qualquer diferença é divergência". Três lançamentos de custo que se
    // anulam — R$ 10.000,10 + R$ 20.000,20 − R$ 30.000,30 — dão zero na
    // matemática e 3,6e−12 no computador. Isso é ruído: os três entram no
    // arquivo, sem alerta nenhum.
    const residuo = 0 + 10000.1 + 20000.2 - 30000.3
    expect(residuo).not.toBe(0)
    expect(Math.abs(residuo)).toBeLessThan(TOLERANCIA_CONFERENCIA)

    const E = criarEmissorDoPlano()
    const confere = E.emitir({
      bloco: 'custos',
      rotulo: 'Custos',
      linhas: [
        { id_linha: 'c1', grupo: 'custo', valor: 10000.1 },
        { id_linha: 'c2', grupo: 'custo', valor: 20000.2 },
        { id_linha: 'c3', grupo: 'custo', valor: -30000.3 },
      ],
      referencia: 0,
      aoDivergir: () => 'ruído de float não pode virar alerta',
    })
    const r = E.selar({ parcial: true })

    expect(confere).toBe(true)
    expect(r.itens).toHaveLength(3)
    expect(r.alertas).toHaveLength(0)
  })
})
