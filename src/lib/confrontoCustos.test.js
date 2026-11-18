import { describe, it, expect } from 'vitest'
import {
  confrontoCustos,
  temRealizado,
  sinalDelta,
  sinalResultado,
  textoDelta,
  LIMIAR_ZERO,
} from './confrontoCustos.js'
import { valorConsiderado, custosPorCategoria } from './calc.js'

const cat = (itens) => [{ id: 'c1', nome: 'Categoria', itens }]

describe('temRealizado — a mesma régua de valorConsiderado (calc.js)', () => {
  // Se a régua daqui divergir da de calc.js, a tela chama de "realizado" um
  // item que a projeção trata como não preenchido (ou o contrário). Este teste
  // é o cadeado dessa duplicação deliberada.
  const casos = [
    { realizado: undefined },
    { realizado: null },
    { realizado: '' },
    { realizado: 0 },
    { realizado: '0' },
    { realizado: 0.004 },
    { realizado: 1 },
    { realizado: 1234.56 },
    { realizado: '1234.56' },
    { realizado: -50 },
    { realizado: 'abacaxi' },
  ]
  it('temRealizado(i) é verdadeiro exatamente quando valorConsiderado(i) usa o realizado', () => {
    // Sentinela no estimado: um valor que nunca se confunde com o realizado
    // dos casos. Se valorConsiderado devolve a sentinela, ele caiu no estimado
    // — ou seja, tratou o item como NÃO preenchido.
    const SENTINELA = -987654
    for (const c of casos) {
      const item = { ...c, estimado: SENTINELA }
      expect(temRealizado(item), JSON.stringify(c)).toBe(valorConsiderado(item) !== SENTINELA)
    }
  })
})

describe('confrontoCustos', () => {
  it('evento sem nenhum realizado: nada a confrontar', () => {
    const c = confrontoCustos(cat([{ estimado: 100 }, { estimado: 200, realizado: '' }]))
    expect(c.algum).toBe(false)
    expect(c.nComRealizado).toBe(0)
    expect(c.nSemRealizado).toBe(2)
    expect(c.estimadoPendente).toBe(300)
  })

  it('confronta o realizado com o estimado DOS MESMOS itens, não com o total', () => {
    const categorias = cat([
      { estimado: 1000, realizado: 1200 }, // estourou 200
      { estimado: 500, realizado: 400 }, // economizou 100
      { estimado: 900 }, // ainda sem realizado
    ])
    const c = confrontoCustos(categorias)
    expect(c.realizado).toBe(1600)
    expect(c.estimadoDosMesmos).toBe(1500)
    expect(c.delta).toBe(100) // +100 ACIMA — e não os −800 que o par antigo sugeria
    expect(c.nSemRealizado).toBe(1)
    expect(c.estimadoPendente).toBe(900)
  })

  it('os números reais do Marco: o par antigo dizia "abaixo", a verdade é +3.147 ACIMA', () => {
    // Reprodução do caso que motivou o conserto (Marfim 09/05, 99% fechado):
    // 331.240 estimados para os itens já realizados, que custaram 334.387;
    // mais 3.880 de estimado ainda sem realizado → total estimado 335.120.
    const categorias = cat([
      { estimado: 331240, realizado: 334387 },
      { estimado: 3880 },
    ])
    const totais = custosPorCategoria(categorias)
    // O par que a tela mostrava lado a lado — e a leitura errada que ele convida:
    expect(totais.totalEstimado).toBe(335120)
    expect(totais.totalRealizado).toBe(334387)
    expect(totais.totalRealizado - totais.totalEstimado).toBe(-733) // "gastamos menos" (falso)

    const c = confrontoCustos(categorias)
    expect(c.estimadoDosMesmos).toBe(331240)
    expect(c.delta).toBe(3147) // a verdade: estourou 3.147 no que já fechou
    expect(c.nSemRealizado).toBe(1)
    expect(c.estimadoPendente).toBe(3880)
  })

  it('aceita categorias vazias, nulas e itens ausentes sem quebrar', () => {
    expect(confrontoCustos(undefined).algum).toBe(false)
    expect(confrontoCustos([]).algum).toBe(false)
    expect(confrontoCustos([{ id: 'x', nome: 'X' }]).nSemRealizado).toBe(0)
  })

  it('campo vazio ou lixo não vira NaN — vale a régua de num() do resto do app', () => {
    const c = confrontoCustos(cat([{ estimado: '1000', realizado: '1234.56' }, { estimado: undefined }]))
    expect(c.realizado).toBeCloseTo(1234.56, 2)
    expect(c.estimadoDosMesmos).toBe(1000)
    expect(c.delta).toBeCloseTo(234.56, 2)
    expect(c.estimadoPendente).toBe(0)
    expect(Number.isNaN(c.estimadoPendente)).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// S2 de 21/07/2026 — `estouro` era a 4ª cópia da regra de sinal, e a única SEM
// o limiar. Um delta de fração de centavo acendia a tarja vermelha e o selo
// ESTOURO na linha do Fechamento enquanto a célula de desvio DA MESMA LINHA
// saía neutra e as abas Custos e Relatório diziam "em linha com o estimado".
// A linha se contradizia sozinha.
// ───────────────────────────────────────────────────────────────────────────
describe('limiar ÚNICO de sinal — uma regra só, um limiar só', () => {
  // ATUALIZADO EM 26/07/2026, e a mudança é de FATO, não de exigência. Este
  // caso nasceu com o resíduo dentro dele: (0,40 + 0,40) − (0,70 + 0,10) somado
  // em ponto flutuante deixava 1,11e−16 de sobra, e o teste cobrava que esse
  // cisco não acendesse a tarja vermelha. Desde que as somas de custo passaram
  // a arredondar CADA parcela a centavos (`somaCentavos`), o cisco não nasce
  // mais: as duas somas dão 0,80 exatos e o desvio é ZERO, não "quase zero".
  //
  // O teste continua cobrando as mesmas duas coisas, agora com a verdade nova:
  // (1) nesta fixture o resíduo ACABOU — e se alguém trocar a régua de volta
  //     para "somar cru e arredondar o total", ele volta e este teste cai;
  // (2) o limiar segue de pé para os deltas que não vêm daqui, cobrado
  //     diretamente sobre as funções de sinal, que é onde ele mora.
  it('dinheiro de duas casas não deixa resíduo — e resíduo, se vier de fora, não vira ESTOURO', () => {
    const c = confrontoCustos(
      cat([
        { estimado: 0.7, realizado: 0.4 },
        { estimado: 0.1, realizado: 0.4 },
      ])
    )
    // (1) as duas somas fecham no centavo, e o desvio é exatamente zero
    expect(c.realizado).toBe(0.8)
    expect(c.estimadoDosMesmos).toBe(0.8)
    expect(c.delta).toBe(0)
    // a régua recusada ("somar cru") deixaria 1,11e−16 aqui; a por parcela, não
    expect(0.4 + 0.4 - (0.7 + 0.1)).not.toBe(0)

    // e as quatro superfícies dizem a mesma coisa sobre ele:
    expect(c.estouro).toBe(false) // tarja + selo do Fechamento
    expect(sinalDelta(c.delta)).toBe('neutro')
    expect(textoDelta(c.delta, () => 'x')).toBe('em linha com o estimado') // Relatório

    // (2) O LIMIAR CONTINUA SENDO COBRADO. Ele não é sobre custo somado: vale
    // para todo delta que chega às funções de sinal — inclusive de resultado
    // (receita − custo), que não passa por `somaCentavos`. Um resíduo de fração
    // de centavo segue neutro nas três leituras, e um centavo inteiro não.
    const residuo = 1.11e-16
    expect(Math.abs(residuo)).toBeLessThan(LIMIAR_ZERO)
    expect(sinalDelta(residuo)).toBe('neutro')
    expect(sinalDelta(-residuo)).toBe('neutro')
    expect(textoDelta(residuo, () => 'x')).toBe('em linha com o estimado')
    expect(sinalDelta(0.01)).toBe('estouro') // um centavo de verdade, sim
  })

  it('`estouro` e `sinalDelta` nunca discordam — varredura em torno do limiar', () => {
    const deltas = [
      -1000, -1, -0.01, -0.005, -0.0049, -0.0001, 0, 1e-15,
      0.0001, 0.0049, 0.005, 0.0051, 0.01, 1, 1000,
    ]
    for (const d of deltas) {
      // monta um confronto cujo delta é exatamente `d`
      const c = confrontoCustos(cat([{ estimado: 1000, realizado: 1000 + d }]))
      expect(c.estouro).toBe(sinalDelta(c.delta) === 'estouro')
      // e o selo só aparece quando o texto também acusa "acima"
      if (c.estouro) expect(textoDelta(c.delta, (v) => `R$ ${v}`)).toContain('acima')
      else expect(textoDelta(c.delta, (v) => `R$ ${v}`)).not.toContain('acima')
    }
  })

  it('sem nenhum realizado não existe estouro (delta é null)', () => {
    const c = confrontoCustos(cat([{ estimado: 1000 }]))
    expect(c.delta).toBeNull()
    expect(c.estouro).toBe(false)
    expect(sinalDelta(c.delta)).toBe('neutro')
  })

  it('sinalResultado usa o MESMO limiar, com a régua invertida (positivo é bom)', () => {
    expect(sinalResultado(null)).toBe('neutro')
    expect(sinalResultado(0)).toBe('neutro')
    expect(sinalResultado(0.004)).toBe('neutro') // meio centavo não é lucro
    expect(sinalResultado(-0.004)).toBe('neutro') // nem prejuízo
    expect(sinalResultado(0.006)).toBe('lucro')
    expect(sinalResultado(-0.006)).toBe('prejuizo')
    expect(sinalResultado(-1000)).toBe('prejuizo')
    // o limiar é literalmente o mesmo objeto de regra
    expect(LIMIAR_ZERO).toBe(0.005)
  })
})
