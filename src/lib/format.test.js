import { describe, it, expect } from 'vitest'
import { fmtCompact, formatadorCompacto, fmtBRL, fmtBRL2, fmtInt, fmtPct, fmtData, DASH, fonteQueCabe } from './format.js'

// O Intl currency (caminho < R$ 1.000) usa espaço não-quebrável entre "R$" e o
// número — invisível na tela. Normaliza para comparar sem depender do char.
const n = (s) => s.replace(/\u00A0/g, ' ')

describe('fmtCompact — não engana abaixo de R$ 10 mil (tema D, F2-P)', () => {
  it('valores redondos não ganham casa pendurada', () => {
    expect(fmtCompact(2000)).toBe('R$ 2 mil')
    expect(fmtCompact(42000)).toBe('R$ 42 mil')
  })
  it('abaixo de 10 mil, valor não-redondo ganha 1 casa (fim do empate "R$ 2 mil")', () => {
    expect(fmtCompact(2400)).toBe('R$ 2,4 mil')
    expect(fmtCompact(1900)).toBe('R$ 1,9 mil')
    expect(fmtCompact(2400)).not.toBe(fmtCompact(1900))
  })
  it('de 10 mil pra cima segue sem casas (limpo)', () => {
    expect(fmtCompact(42400)).toBe('R$ 42 mil')
    expect(fmtCompact(55000)).toBe('R$ 55 mil')
  })
  it('milhões usam 1 casa por padrão', () => {
    expect(fmtCompact(2500000)).toBe('R$ 2,5 mi')
    expect(fmtCompact(2000000)).toBe('R$ 2 mi')
  })
  it('abaixo de mil cai no formato cheio', () => {
    expect(n(fmtCompact(500))).toBe('R$ 500')
  })
  it('dec forçado sobe a precisão', () => {
    expect(fmtCompact(42420, 2)).toBe('R$ 42,42 mil')
  })
  it('negativos preservam o sinal (dentro do prefixo, como antes)', () => {
    expect(fmtCompact(-2400)).toBe('R$ -2,4 mil')
  })
})

describe('formatadorCompacto — sobe precisão até desempatar o conjunto', () => {
  it('conjunto redondo usa 0 casas (mais compacto)', () => {
    const f = formatadorCompacto([16000, 42000, 55000])
    expect(f(16000)).toBe('R$ 16 mil')
    expect(f(42000)).toBe('R$ 42 mil')
  })
  it('par que empataria em 0 casas ganha 1 casa em TODO o conjunto', () => {
    const f = formatadorCompacto([2400, 1900, 42000])
    expect(f(2400)).toBe('R$ 2,4 mil')
    expect(f(1900)).toBe('R$ 1,9 mil')
    expect(f(2400)).not.toBe(f(1900))
    expect(f(42000)).toBe('R$ 42 mil')
  })
  it('sobe até 2 casas quando 1 ainda empata', () => {
    const f = formatadorCompacto([42410, 42440])
    expect(f(42410)).not.toBe(f(42440))
  })
  it('buckets diferentes nunca colidem (sufixo distingue)', () => {
    const f = formatadorCompacto([900, 2000000])
    expect(n(f(900))).toBe('R$ 900')
    expect(f(2000000)).toBe('R$ 2 mi')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FOTOGRAFIA do que os outros formatadores fazem HOJE (30/08/2026).
//
// Até esta data `format.test.js` importava só `fmtCompact` e
// `formatadorCompacto`: `fmtBRL`, `fmtBRL2`, `fmtInt`, `fmtPct` e `fmtData` —
// que são o que escreve TODO número em R$ da tela, do PDF e do WhatsApp — não
// tinham teste direto nenhum. Este bloco NÃO muda exibição: ele fotografa o
// comportamento atual, inclusive onde ele é feio, para que qualquer mudança
// futura precise passar por aqui em vez de acontecer sem ninguém ver.
//
// As três feiuras estão fotografadas de propósito e registradas no BACKLOG:
//   1. meio negativo arredonda para lados DIFERENTES em fmtInt e fmtBRL;
//   2. −0 chega à tela como "-0" e "-R$ 0";
//   3. fmtData devolve o texto de entrada quando ele não é uma data ISO.
// Fotografar não é aprovar — é impedir que mudem sozinhas.
// ─────────────────────────────────────────────────────────────────────────────
describe('fmtBRL / fmtBRL2 — o dinheiro escrito', () => {
  it('inteiro por padrão; `dec` manda quando vem', () => {
    expect(n(fmtBRL(1234.56))).toBe('R$ 1.235')
    expect(n(fmtBRL(1234.567, 2))).toBe('R$ 1.234,57')
    expect(n(fmtBRL(1234.567, 1))).toBe('R$ 1.234,6')
    expect(n(fmtBRL(0))).toBe('R$ 0')
    expect(n(fmtBRL(-1234.56))).toBe('-R$ 1.235')
  })

  it('fmtBRL2 mostra centavos SÓ quando existem — a régua é 0,004', () => {
    expect(n(fmtBRL2(1234.56))).toBe('R$ 1.234,56')
    expect(n(fmtBRL2(2000))).toBe('R$ 2.000')
    // a fronteira exata do `Math.abs(n % 1) > 0.004`, dos dois lados
    expect(n(fmtBRL2(0.004))).toBe('R$ 0')
    expect(n(fmtBRL2(0.005))).toBe('R$ 0,01')
    expect(n(fmtBRL2(-0.005))).toBe('-R$ 0,01')
  })

  it('lixo e vazio viram R$ 0 (é o `num()` que decide, e ele não inventa número)', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity, -Infinity]) {
      expect(n(fmtBRL(v))).toBe('R$ 0')
      expect(n(fmtBRL2(v))).toBe('R$ 0')
    }
    // "1.234,56" é TEXTO aqui, não número: quem interpreta formato brasileiro é
    // o parseMoney, na ENTRADA. Na saída, texto não vira dinheiro.
    expect(n(fmtBRL('1.234,56'))).toBe('R$ 0')
  })
})

describe('fmtInt — a contagem escrita (ingressos, público, dias)', () => {
  it('arredonda e agrupa milhar', () => {
    expect(fmtInt(1234.56)).toBe('1.235')
    expect(fmtInt(1000000)).toBe('1.000.000')
    expect(fmtInt(0)).toBe('0')
  })

  it('lixo e vazio viram 0 — nunca "NaN" na tela', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity]) expect(fmtInt(v)).toBe('0')
  })
})

describe('fmtPct — o percentual escrito', () => {
  it('1 casa por padrão, e `dec` manda quando vem', () => {
    expect(fmtPct(9.55)).toBe('9,6%')
    expect(fmtPct(9.55, 0)).toBe('10%')
    expect(fmtPct(9.55, 3)).toBe('9,55%')
    expect(fmtPct(0)).toBe('0%')
  })

  it('null e undefined viram travessão — "sem percentual" NÃO é "zero por cento"', () => {
    // Esta é a diferença que mais importa neste módulo: 0% é um resultado;
    // travessão é a ausência dele. fmtBRL e fmtInt não fazem essa distinção.
    expect(fmtPct(null)).toBe(DASH)
    expect(fmtPct(undefined)).toBe(DASH)
    expect(fmtPct(0)).not.toBe(DASH)
    // e o que NÃO é null passa pelo num(), inclusive lixo
    expect(fmtPct('abc')).toBe('0%')
  })
})

describe('fmtData — a data escrita', () => {
  it('vira dd/mm/aaaa a partir da ISO, e vazio some', () => {
    expect(fmtData('2026-12-05')).toBe('05/12/2026')
    expect(fmtData('')).toBe('')
    expect(fmtData(null)).toBe('')
    expect(fmtData(undefined)).toBe('')
  })

  it('FEIURA 3, fotografada: texto que não é data ISO sai como estiver', () => {
    // `iso.split('-').reverse().join('/')` não confere nada. Registrado no
    // BACKLOG em 30/08/2026; NÃO consertado aqui, porque mudar isto muda o que
    // aparece na tela e isso é decisão do Marco, não de uma sessão de cobertura.
    expect(fmtData('abacaxi')).toBe('abacaxi')
    expect(fmtData('2026-12-05T10:00:00')).toBe('05T10:00:00/12/2026')
  })
})

describe('as duas feiuras do arredondamento, fotografadas (BACKLOG, 30/08/2026)', () => {
  it('FEIURA 1 — o meio NEGATIVO arredonda para lados DIFERENTES em fmtInt e fmtBRL', () => {
    // fmtInt usa Math.round, que em JS arredonda para +∞: Math.round(-0.5) = -0
    // e Math.round(-1.5) = -1. fmtBRL usa Intl, que arredonda para LONGE do
    // zero: -0,5 → -1 e -1,5 → -2. Mesmo número, duas telas, dois resultados.
    expect(fmtInt(-0.5)).toBe('-0')
    expect(n(fmtBRL(-0.5))).toBe('-R$ 1')

    expect(fmtInt(-1.5)).toBe('-1')
    expect(n(fmtBRL(-1.5))).toBe('-R$ 2')

    expect(fmtInt(-2.5)).toBe('-2')
    expect(n(fmtBRL(-2.5))).toBe('-R$ 3')

    // no POSITIVO os dois concordam — é só o lado negativo que diverge
    expect(fmtInt(0.5)).toBe('1')
    expect(n(fmtBRL(0.5))).toBe('R$ 1')
    expect(fmtInt(1.5)).toBe('2')
    expect(n(fmtBRL(1.5))).toBe('R$ 2')
  })

  it('FEIURA 2 — o zero NEGATIVO chega à tela com sinal', () => {
    // Um centavo negativo que arredonda a zero vira "-R$ 0" e "-0". Ninguém
    // deve R$ 0 negativos; é ruído de arredondamento vazando para a tela.
    expect(fmtInt(-0.004)).toBe('-0')
    expect(n(fmtBRL(-0.004))).toBe('-R$ 0')
    expect(n(fmtBRL2(-0.004))).toBe('-R$ 0')
    // o positivo equivalente sai limpo
    expect(fmtInt(0.004)).toBe('0')
    expect(n(fmtBRL(0.004))).toBe('R$ 0')
  })

  it('FEIURA 4 — no fmtCompact o sinal de menos cai DEPOIS do "R$"', () => {
    // Achada medindo, não prevista: abaixo de mil o fmtCompact desce para o
    // fmtBRL e o sinal sai na frente ("-R$ 0"); de mil para cima ele monta o
    // texto à mão com um template, e o menos fica DENTRO ("R$ -1,5 mil"). O
    // mesmo prejuízo aparece escrito de dois jeitos na mesma tela, e é o
    // fmtCompact que rotula as BARRAS dos gráficos e a tríade de cenários.
    expect(n(fmtCompact(-1500))).toBe('R$ -1,5 mil')
    expect(n(fmtCompact(-2500000))).toBe('R$ -2,5 mi')
    // contra o formato longo do mesmo número, na mesma tela
    expect(n(fmtBRL(-1500))).toBe('-R$ 1.500')
    // e abaixo de mil ele volta a concordar com o fmtBRL, o que é justamente
    // o que faz a inconsistência ser difícil de ver de olho
    expect(n(fmtCompact(-500))).toBe('-R$ 500')
    expect(n(fmtCompact(-0.004))).toBe('-R$ 0') // herda a feiura 2
  })
})

describe('fonteQueCabe — o número grande do cartão cabe na largura (07/10/2026)', () => {
  it('tamanho cheio como teto e largura do contêiner dividida pelo comprimento do texto', () => {
    expect(fonteQueCabe('R$ 30.423,84', 1.875)).toBe('min(1.875rem, calc(100cqw / 7.44))')
    expect(fonteQueCabe('-R$ 1.234.567,89', 3)).toBe('min(3rem, calc(100cqw / 9.92))')
  })
  it('texto vazio ou ausente não divide por zero', () => {
    expect(fonteQueCabe('', 2)).toBe('min(2rem, calc(100cqw / 0.62))')
    expect(fonteQueCabe(undefined, 2)).toBe('min(2rem, calc(100cqw / 0.62))')
  })
})
