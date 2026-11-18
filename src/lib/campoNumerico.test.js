// Testes da entrada numérica brasileira dos campos da UI (sugestão 1 / S2).
// Regra do CLAUDE.md: cada formato aceito tem teste.

import { describe, it, expect } from 'vitest'
import {
  parseCampoNumerico,
  formatarParaEdicao,
  deveLargarRascunho,
  foraDaFaixa,
  FAIXA_PCT,
} from './campoNumerico.js'

const valorDe = (t) => {
  const r = parseCampoNumerico(t)
  expect(r.valido).toBe(true)
  return r.valor
}

describe('parseCampoNumerico — formatos brasileiros aceitos', () => {
  it('moeda completa: "R$ 1.234,56"', () => {
    expect(valorDe('R$ 1.234,56')).toBe(1234.56)
    expect(valorDe('R$ 2.000,00')).toBe(2000)
    expect(valorDe('R$ 500')).toBe(500)
  })
  it('ponto de milhar sem centavos: "8.000" vale oito mil (o bug S2 salvava 8)', () => {
    expect(valorDe('8.000')).toBe(8000)
    expect(valorDe('1.234.567')).toBe(1234567)
  })
  it('vírgula decimal: "1.234,56", "1,5"', () => {
    expect(valorDe('1.234,56')).toBe(1234.56)
    expect(valorDe('1.234,5')).toBe(1234.5)
    expect(valorDe('1,5')).toBe(1.5)
  })
  it('formato americano colado de fora: "1234.56"', () => {
    expect(valorDe('1234.56')).toBe(1234.56)
  })
  it('parênteses contábeis: "(500)" = −500 (decisão do Marco 20/07/2026), unificado com o importador', () => {
    expect(valorDe('(500)')).toBe(-500)
    expect(valorDe('(1.234,56)')).toBe(-1234.56)
    expect(valorDe('R$ (2.500)')).toBe(-2500)
  })
  it('formato americano colado de fora: "1,234.56" → 1234.56', () => {
    expect(valorDe('1,234.56')).toBe(1234.56)
  })
  it('sinal não alterna e menos unicode conta (achados A2/A3): "(-500)" e "−500" → −500', () => {
    expect(valorDe('(-500)')).toBe(-500)
    expect(valorDe('−500')).toBe(-500)
  })
  it('vazio (e só prefixo/espaço) vira campo vazio, nunca 0 forçado', () => {
    expect(valorDe('')).toBe('')
    expect(valorDe('   ')).toBe('')
    expect(valorDe('R$ ')).toBe('')
    expect(parseCampoNumerico(null).valor).toBe('')
  })
  it('espaços em volta não atrapalham: " 500 "', () => {
    expect(valorDe(' 500 ')).toBe(500)
    expect(valorDe(' R$ 1.234,56 ')).toBe(1234.56)
  })
  it('inteiros e negativos simples: "90", "-500", "-1.234,56"', () => {
    expect(valorDe('90')).toBe(90)
    expect(valorDe('-500')).toBe(-500)
    expect(valorDe('-1.234,56')).toBe(-1234.56)
  })
  it('sufixo % é tolerado no campo de percentual: "9,5%"', () => {
    expect(valorDe('9,5%')).toBe(9.5)
  })

  // ── O CAMPO É A OUTRA METADE DO MESMO DEFEITO (Marco, 30/08/2026) ──────────
  //
  // parseCampoNumerico chama o parseMoney do importador, então a leitura errada
  // de "25.000,000" não chegava só por planilha: chegava por COLAR num campo.
  // Medido antes do conserto: o campo aceitava a entrada (a guarda só recusa
  // LETRA) e gravava R$ 25 — sumindo com R$ 24.975 e deixando a festa com cara
  // de lucrativa. É por isso que este teste mora aqui e não só no importador.
  it('colar "25.000,000" num campo grava R$ 25.000,00, não R$ 25 (Marco, 30/08/2026)', () => {
    expect(valorDe('25.000,000')).toBe(25000)
    expect(valorDe('R$ 25.000,000')).toBe(25000)
    expect(valorDe('1.234,500')).toBe(1234.5)
    expect(valorDe('12.500,750')).toBe(12500.75)
    expect(valorDe('1.234.567,890')).toBe(1234567.89)
    expect(valorDe('(1.234,500)')).toBe(-1234.5)
  })

  it('e a outra regra fica: "1,500" digitado sem ponto segue valendo mil e quinhentos', () => {
    expect(valorDe('1,500')).toBe(1500)
    expect(valorDe('1,234')).toBe(1234)
  })
})

describe('parseCampoNumerico — digitação incompleta (não salva, não avisa)', () => {
  it.each(['-', ',', '.', '(', '-,'])('"%s" é meio caminho de digitação', (t) => {
    const r = parseCampoNumerico(t)
    expect(r.valido).toBe(false)
    expect(r.incompleto).toBe(true)
  })
})

describe('parseCampoNumerico — entrada inválida (não salva e AVISA)', () => {
  it.each(['abc', '8 mil', '12abc', 'dez', '—', 'R$ abc'])(
    '"%s" nunca vira número em silêncio',
    (t) => {
      const r = parseCampoNumerico(t)
      expect(r.valido).toBe(false)
      expect(r.incompleto).toBe(false)
    }
  )
})

describe('formatarParaEdicao — exibição com vírgula, como manda o rulebook', () => {
  it('formata em pt-BR', () => {
    expect(formatarParaEdicao(1234.56)).toBe('1.234,56')
    expect(formatarParaEdicao(1000)).toBe('1.000')
    expect(formatarParaEdicao(9.5)).toBe('9,5')
    expect(formatarParaEdicao(0)).toBe('0')
    expect(formatarParaEdicao(-500)).toBe('-500')
  })
  it('vazio continua vazio', () => {
    expect(formatarParaEdicao('')).toBe('')
    expect(formatarParaEdicao(null)).toBe('')
    expect(formatarParaEdicao(undefined)).toBe('')
  })
  it('round-trip: o que o campo mostra volta a ser o mesmo número salvo', () => {
    for (const v of [0, 8, 90, 500, 1234.56, 8000, 1234567, 0.5, 9.5, -500, 110.9]) {
      expect(parseCampoNumerico(formatarParaEdicao(v)).valor).toBe(v)
    }
  })
})

// Valor trocado POR FORA com o campo em foco (desfazer/refazer da sessão,
// importação, ponte). Sem esta regra, o desfazer trocava o número SALVO e o
// campo continuava mostrando o texto velho — número errado exibido como certo.
describe('deveLargarRascunho — o campo não pode mentir depois de um desfazer', () => {
  it('sem rascunho (campo fora de edição) não há o que largar', () => {
    expect(deveLargarRascunho(null, 8000)).toBe(false)
  })

  it('digitando: o valor que chega É o do rascunho — o rascunho fica', () => {
    expect(deveLargarRascunho('8.000', 8000)).toBe(false)
    expect(deveLargarRascunho('1.234,56', 1234.56)).toBe(false)
    expect(deveLargarRascunho('', '')).toBe(false)
  })

  it('desfazer: o valor volta ao anterior e o rascunho SAI da frente', () => {
    expect(deveLargarRascunho('8.000120', 8000)).toBe(true)
    expect(deveLargarRascunho('1.234,56', 80)).toBe(true)
    expect(deveLargarRascunho('120', '')).toBe(true)
  })

  it('rascunho a meio caminho ("1.234,") também sai quando o valor muda por fora', () => {
    // "1.234," ainda não é número — não pode ser tratado como se representasse
    // o valor novo; se o valor mudou, quem mandou foi outra pessoa.
    expect(deveLargarRascunho('1.234,', 80)).toBe(true)
  })

  it('rascunho inválido ("8 mil") sai quando o valor muda por fora', () => {
    expect(deveLargarRascunho('8 mil', 8000)).toBe(true)
  })
})

// Trava dos percentuais (decisão do Marco, 20/07/2026 — item 2 da fila):
// campos de % vivem em 0..100; fora disso o NumInput avisa e NÃO grava.
describe('foraDaFaixa — a trava 0..100 dos campos de percentual', () => {
  it('dentro da faixa (0, 100 e o meio) não dispara', () => {
    expect(foraDaFaixa(0, FAIXA_PCT)).toBe(false)
    expect(foraDaFaixa(100, FAIXA_PCT)).toBe(false)
    expect(foraDaFaixa(9.5, FAIXA_PCT)).toBe(false)
  })

  it('fora da faixa dispara nos dois lados (150 e -20)', () => {
    expect(foraDaFaixa(150, FAIXA_PCT)).toBe(true)
    expect(foraDaFaixa(-20, FAIXA_PCT)).toBe(true)
  })

  it('vazio é "não informado" e não dispara; sem faixa nunca dispara', () => {
    expect(foraDaFaixa('', FAIXA_PCT)).toBe(false)
    expect(foraDaFaixa(null, FAIXA_PCT)).toBe(false)
    expect(foraDaFaixa(150, undefined)).toBe(false)
  })

  it('o aviso da faixa fala português e diz a regra', () => {
    expect(FAIXA_PCT.aviso).toBe('Percentual entre 0 e 100')
  })
})


describe('P3 — campo conserva recusa do parser', () => {
  it.each(['1/2','12-34','1e3','R$ 8.000 (2 dias)'])('não salva %s', (v) => expect(parseCampoNumerico(v)).toEqual({valido:false,incompleto:false}))
})
