// Revisão do que a migração muda num dado que VOLTA (decisão 18 do Marco,
// 25/07/2026 — "corrigir E mostrar").
//
// Fixtures 100% sintéticos. A festa de teste é sempre a mesma: 500 ingressos a
// R$ 100 e um custo de R$ 20.000 — números redondos para a conta certa × errada
// caber num comentário.
import { describe, it, expect } from 'vitest'
import {
  correcoesDaMigracao,
  efeitoNoResultado,
  revisarRestauracao,
  revisarEventoRestaurado,
  resumoRevisao,
  PARA_NAO_INFORMADO,
} from './revisaoRestauracao.js'
import { censoNormalizacoes, migrarEvento } from './migracao.js'
import { computeCenarios } from './calc.js'
import { novoEvento } from './defaults.js'

const festa = (patch = {}) => ({
  ...novoEvento('Marfim de Teste'),
  id: 'e1',
  lotes: [{ id: 'l1', nome: '1º lote', valor: 100, quantidade: 500 }],
  categorias: [
    { nome: 'Produção', itens: [{ id: 'c1', servico: 'Som', estimado: 20000, status: 'ESTIMADO' }] },
  ],
  ...patch,
})

// O veneno do achado de 20/07: ajuste de cenário de −200%, que INVERTE o sinal
// do custo. Salvo antes da trava de 22/07, ainda mora nos dados do Marco.
//
// O pessimista vem com vendaPct 70 e a marca `padraoPessimista80` de propósito
// (27/07/2026): os R$ de lucro afirmados abaixo são os números MEDIDOS naquele
// achado, num evento que vendia 70% no pessimista. A subida do padrão para 80
// (decisão A do Marco) é outro assunto — segurá-la aqui é o que mantém este
// teste falando de UMA correção só, a do custoPct −200. A marca é exatamente o
// que o app grava num evento cujo dono escolheu 70 depois da subida.
const comCustoPctVenenoso = () =>
  festa({
    cenariosConfig: {
      pessimista: { vendaPct: 70, custoPct: -200 },
      realista: {},
      otimista: {},
    },
    padraoPessimista80: { de: null },
  })

describe('correcoesDaMigracao — quais campos, em qual evento, de que valor para qual', () => {
  it('grade de cenário fora da faixa: diz o campo, o valor salvo e que o cenário volta ao padrão', () => {
    const c = correcoesDaMigracao([comCustoPctVenenoso()])
    expect(c).toHaveLength(1)
    expect(c[0].evento).toBe('Marfim de Teste')
    expect(c[0].campo).toBe('pessimista.custoPct')
    expect(c[0].oQueMudou).toContain('cenário pessimista, ajuste de custos')
    expect(c[0].oQueMudou).toContain('200')
    expect(c[0].para).toBe(PARA_NAO_INFORMADO)
    // A grade é o caso em que a migração REMOVE a chave: o cálculo cai no
    // fallback documentado do calc, não num zero. O microtexto tem de dizer
    // isso, senão o Marco lê "não informado" e entende "virou 0".
    expect(c[0].explicacao).toContain('padrão')
  })

  it('campo comum fora da faixa: o microtexto é o OUTRO — o campo fica vazio e pede o número', () => {
    const c = correcoesDaMigracao([
      festa({ categorias: [{ nome: 'P', itens: [{ id: 'c1', servico: 'DJ', estimado: -1000 }] }] }),
    ])
    expect(c).toHaveLength(1)
    expect(c[0].campo).toBe('estimado')
    expect(c[0].oQueMudou).toContain("custo 'DJ', estimado")
    expect(c[0].explicacao).toContain('vazio')
    expect(c[0].explicacao).not.toContain('padrão')
  })

  it('a frase de cada linha é a MESMA que o aviso do import já usa (fonte única)', () => {
    // Duas telas que falam do mesmo campo não podem descrever o campo com
    // palavras diferentes. O rótulo sai verbatim do censo da decisão 3a.
    const evs = [comCustoPctVenenoso()]
    expect(correcoesDaMigracao(evs).map((c) => c.oQueMudou)).toEqual(
      censoNormalizacoes(evs).map((c) => c.rotulo)
    )
  })

  it('dado são, lista vazia e entrada torta não inventam correção nenhuma', () => {
    expect(correcoesDaMigracao([festa()])).toEqual([])
    expect(correcoesDaMigracao([])).toEqual([])
    expect(correcoesDaMigracao(null)).toEqual([])
  })
})

describe('efeitoNoResultado — quanto dinheiro a correção move', () => {
  it('o caso do achado: R$ 54.250 de lucro viram R$ 10.150, e 163% de margem viram 31%', () => {
    // A receita pessimista é R$ 33.250 nos dois lados (o veneno não toca
    // receita). O custo de R$ 20.000 vira R$ 21.000 com a contingência de 5%:
    //   • salvo:  21.000 × (1 − 200/100) = − R$ 21.000 → lucro R$ 54.250 (163%)
    //   • certo:  21.000 × (1 + 10/100)  = + R$ 23.100 → lucro R$ 10.150 (31%)
    const cru = comCustoPctVenenoso()
    const ef = efeitoNoResultado(cru, migrarEvento(cru))
    const linha = (l) => ef.linhas.find((x) => x.label === l)
    expect(linha('Lucro (pessimista)').antes).toBe(54250)
    expect(Math.round(linha('Lucro (pessimista)').depois)).toBe(10150)
    expect(Math.round(linha('Margem (pessimista)').antes)).toBe(163)
    expect(Math.round(linha('Margem (pessimista)').depois)).toBe(31)
    expect(ef.erro).toBeNull()
  })

  it('só lista o que se MOVEU — realista e otimista não entram, porque o veneno era só do pessimista', () => {
    const cru = comCustoPctVenenoso()
    const ef = efeitoNoResultado(cru, migrarEvento(cru))
    expect(ef.linhas.map((l) => l.label)).toEqual([
      'Lucro (pessimista)',
      'Margem (pessimista)',
    ])
  })

  it('cada linha diz o próprio formato — a tela não adivinha R$ ou % pelo texto do rótulo', () => {
    const cru = comCustoPctVenenoso()
    const ef = efeitoNoResultado(cru, migrarEvento(cru))
    expect(ef.linhas.find((l) => l.label === 'Lucro (pessimista)').formato).toBe('moeda')
    expect(ef.linhas.find((l) => l.label === 'Margem (pessimista)').formato).toBe('percentual')
  })

  it('dado são: nenhum número se move, então não há efeito nenhum (null)', () => {
    const ev = festa()
    expect(efeitoNoResultado(ev, migrarEvento(ev))).toBeNull()
  })

  it('evento que quebra a conta vira aviso em português, não uma tela morta', () => {
    // A revisão lê dado GUARDADO, que pode ser qualquer coisa (backup editado
    // à mão, chave mexida no navegador). Morrer aqui derrubaria justamente a
    // tela que existe para explicar o problema.
    const explosivo = {}
    Object.defineProperty(explosivo, 'lotes', {
      get() {
        throw new Error('dado guardado fora de forma')
      },
      enumerable: true,
    })
    const ef = efeitoNoResultado(explosivo, festa())
    expect(ef.linhas).toEqual([])
    expect(ef.erro).toMatch(/não foi possível calcular/i)
    expect(ef.erro).toMatch(/como ela foi salva/i)
  })
})

describe('revisarRestauracao — o instantâneo inteiro', () => {
  it('o store CRU sai daqui intocado, e o corrigido é o que se aplica', () => {
    const storeCru = { eventos: [comCustoPctVenenoso()], benchmarksCustom: [] }
    const r = revisarRestauracao(storeCru)

    // Princípio 7: o caminho de volta continua tendo o que foi guardado.
    expect(r.storeCru).toBe(storeCru)
    expect(r.storeCru.eventos[0].cenariosConfig.pessimista.custoPct).toBe(-200)
    // Princípio 1: o que se aplica tem a conta certa.
    expect(r.storeCorrigido.eventos[0].cenariosConfig.pessimista.custoPct).toBeUndefined()
    expect(Math.round(computeCenarios(r.storeCorrigido.eventos[0]).pessimista.lucro)).toBe(10150)
    // e o resto do store (benchmarks, ajustes, o que houver) atravessa igual
    expect(r.storeCorrigido.benchmarksCustom).toBe(storeCru.benchmarksCustom)
  })

  it('instantâneo são não pede revisão: restaurar continua sendo um clique só', () => {
    const r = revisarRestauracao({ eventos: [festa()], benchmarksCustom: [] })
    expect(r.precisaRevisao).toBe(false)
    expect(r.correcoes).toEqual([])
    expect(r.efeitos).toEqual([])
  })

  it('store sem eventos, vazio ou nulo não quebra', () => {
    expect(revisarRestauracao({ eventos: [] }).precisaRevisao).toBe(false)
    expect(revisarRestauracao({}).precisaRevisao).toBe(false)
    expect(revisarRestauracao(null).precisaRevisao).toBe(false)
    expect(revisarRestauracao(null).storeCorrigido.eventos).toEqual([])
  })

  it('revisar o JÁ corrigido não acha nada — corrigir duas vezes é corrigir uma', () => {
    const r = revisarRestauracao({ eventos: [comCustoPctVenenoso()] })
    const denovo = revisarRestauracao(r.storeCorrigido)
    expect(denovo.precisaRevisao).toBe(false)
    expect(denovo.storeCorrigido.eventos[0]).toEqual(r.storeCorrigido.eventos[0])
  })

  it('O BURACO QUE A LISTA DE CAMPOS SOZINHA DEIXARIA: dinheiro que se move sem correção nomeada aparece assim mesmo', () => {
    // `barCustoSistema: '0x2710'` é o vetor do hexadecimal (edge 0x10, travado
    // pela casa em 23/07). A migração recusa a string — não é notação decimal
    // brasileira — e o campo vira ''. Mas `num()` do calc usa `Number()`, que
    // LÊ hexadecimal: como estava salvo, esses R$ 10.000 de custo do sistema
    // do bar entravam na conta.
    //
    // O censo NÃO reporta o caso: ele só conta número PRESENTE e FORA da
    // faixa, e '0x2710' não é número presente para a régua dele. Se a revisão
    // fosse só a lista de campos, a tela diria "nada mudou" enquanto o lucro
    // realista saltava R$ 10.000. É por isso que o efeito no resultado é
    // medido pelos números, e não deduzido da lista.
    const cru = festa({ barModo: 'porPessoa', barCustoSistema: '0x2710' })
    const r = revisarRestauracao({ eventos: [cru] })

    expect(censoNormalizacoes([cru])).toEqual([])
    expect(r.correcoes).toEqual([])
    expect(r.precisaRevisao).toBe(true)

    const linha = r.efeitos[0].linhas.find((l) => l.label === 'Lucro (realista)')
    expect(linha.antes).toBe(11750)
    expect(linha.depois).toBe(21750)
  })
})

describe('revisarEventoRestaurado — o evento que volta da lixeira', () => {
  it('devolve o evento corrigido, o cru ao lado e o que mudou', () => {
    const cru = comCustoPctVenenoso()
    const r = revisarEventoRestaurado(cru)
    expect(r.eventoCru).toBe(cru)
    expect(Math.round(computeCenarios(r.eventoCorrigido).pessimista.lucro)).toBe(10150)
    expect(r.correcoes).toHaveLength(1)
    expect(r.precisaRevisao).toBe(true)
  })

  it('evento são volta sem revisão — restaurar da lixeira segue instantâneo', () => {
    const r = revisarEventoRestaurado(festa())
    expect(r.precisaRevisao).toBe(false)
    expect(r.correcoes).toEqual([])
    expect(r.efeitos).toEqual([])
  })
})

describe('resumoRevisao — a frase de cabeçalho', () => {
  it('conta os valores corrigidos e quantas previsões mudam de resultado', () => {
    const r = revisarRestauracao({ eventos: [comCustoPctVenenoso()] })
    expect(resumoRevisao(r)).toBe('1 valor corrigido — o resultado de 1 previsão muda')
  })

  it('plural certo com mais de um', () => {
    const r = revisarRestauracao({
      eventos: [
        { ...comCustoPctVenenoso(), id: 'a', nome: 'Festa A' },
        { ...comCustoPctVenenoso(), id: 'b', nome: 'Festa B' },
      ],
    })
    expect(resumoRevisao(r)).toBe('2 valores corrigidos — o resultado de 2 previsões muda')
  })

  it('dinheiro que se move sem correção nomeada tem frase própria, nunca vazia', () => {
    const r = revisarRestauracao({
      eventos: [festa({ barModo: 'porPessoa', barCustoSistema: '0x2710' })],
    })
    expect(resumoRevisao(r)).toBe('o resultado de 1 previsão muda')
  })

  it('sem revisão, sem frase', () => {
    expect(resumoRevisao(revisarRestauracao({ eventos: [festa()] }))).toBe('')
    expect(resumoRevisao(null)).toBe('')
  })
})

it('S4 bar textual restaurado fica bruto sem promessa de correção; bilheteria e Pix listados',()=>{
 const e={...novoEvento('S4 sintético'),receitaRealizada:{bilheteria:-5,bar:'14.200,00',pix:'14.200,00'}}
 const r=revisarEventoRestaurado(e)
 expect(r.eventoCru).toBe(e)
 expect(r.eventoCorrigido.receitaRealizada).toEqual({bilheteria:'',bar:'14.200,00',pix:''})
 expect(r.correcoes.map(c=>c.campo)).toEqual(['receitaRealizada.bilheteria','receitaRealizada.pix'])
 expect(r.correcoes.every(c=>!c.explicacao.includes('cenário'))).toBe(true)
})
