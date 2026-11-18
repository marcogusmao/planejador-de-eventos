// Teste homônimo de reguaTicket.js — a régua que produziu o ticket de um
// benchmark, nomeada a partir do que está SALVO e de mais nada.
//
// A afirmação central que este arquivo trava: o módulo nunca afirma mais do
// que os números provam. Ticket que não fecha com nenhuma conta conhecida sai
// como "régua do ticket não registrada"; ele não é reclassificado no chute.
import { describe, it, expect } from 'vitest'
import {
  REGUA_BILHETERIA,
  REGUA_RECEITA,
  REGUA_PAGANTES,
  REGUA_NAO_CONFERE,
  REGUA_NAO_REGISTRADA,
  ETIQUETA_REGUA,
  EXPLICACAO_REGUA,
  TOLERANCIA_DUAS_CASAS,
  bilheteriaBrutaDe,
  temBilheteriaBruta,
  reguaDoTicket,
  etiquetaRegua,
  explicacaoRegua,
  reguasNaLista,
  reguasMisturadas,
} from './reguaTicket.js'
import { FIXED_BENCHMARKS } from './benchmarks.js'

const bm = (campos) => ({ id: 'bm-teste', nome: 'Festa de teste', ...campos })

describe('reguaDoTicket — a régua é lida do que está salvo', () => {
  it('sem ticket não há régua a nomear (devolve null, e a tela não põe etiqueta)', () => {
    expect(reguaDoTicket(bm({ publico: 500, receita: 100000 }))).toBeNull()
    expect(reguaDoTicket(bm({ publico: 500, ticketMedio: null }))).toBeNull()
    expect(etiquetaRegua(bm({ publico: 500 }))).toBeNull()
    expect(explicacaoRegua(bm({ publico: 500 }))).toBeNull()
  })

  it('ticket que fecha com bilheteria bruta ÷ público → régua da bilheteria', () => {
    const b = bm({ publico: 500, bilheteriaBruta: 75000, receita: 100000, ticketMedio: 150 })
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
    expect(etiquetaRegua(b)).toBe('ticket = bilheteria ÷ público')
  })

  it('ticket que fecha com receita ÷ público, sem bilheteria salva → régua antiga', () => {
    const b = bm({ publico: 500, receita: 100000, ticketMedio: 200 })
    expect(reguaDoTicket(b)).toBe(REGUA_RECEITA)
    expect(etiquetaRegua(b)).toBe('ticket = receita ÷ público')
  })

  it('bilheteria salva que NÃO fecha com o ticket vira alarme, não vira régua antiga', () => {
    // Mesmo que o ticket feche com receita ÷ público: quem informou a
    // bilheteria disse qual régua queria, e o desencontro é o que importa.
    const b = bm({ publico: 500, bilheteriaBruta: 75000, receita: 100000, ticketMedio: 200 })
    expect(reguaDoTicket(b)).toBe(REGUA_NAO_CONFERE)
    expect(etiquetaRegua(b)).toBe('ticket não bate com a bilheteria informada')
  })

  it('nada fecha → "não registrada", que é a resposta honesta e não um chute', () => {
    const b = bm({ publico: 500, receita: 100000, ticketMedio: 173.02 })
    expect(reguaDoTicket(b)).toBe(REGUA_NAO_REGISTRADA)
  })

  it('a régua GRAVADA no benchmark manda sobre a aritmética', () => {
    // O importado de planilha divide por ingressos PAGOS, e o número de pagos
    // não é salvo — sem a etiqueta gravada isto seria indeduzível para sempre.
    const b = bm({ publico: 500, receita: 100000, ticketMedio: 250, reguaTicket: REGUA_PAGANTES })
    expect(reguaDoTicket(b)).toBe(REGUA_PAGANTES)
    expect(etiquetaRegua(b)).toBe('ticket = receita ÷ ingressos pagos')
  })

  it('régua gravada que o app não conhece é IGNORADA — texto de arquivo editado não vira etiqueta', () => {
    const b = bm({ publico: 500, receita: 100000, ticketMedio: 200, reguaTicket: 'inventada' })
    expect(reguaDoTicket(b)).toBe(REGUA_RECEITA)
    const c = bm({ publico: 500, receita: 100000, ticketMedio: 200, reguaTicket: REGUA_NAO_CONFERE })
    expect(reguaDoTicket(c)).toBe(REGUA_RECEITA) // conclusão não é campo gravável
  })
})

describe('vazio NÃO é zero — em toda a leitura', () => {
  it('bilheteria bruta ZERO é um valor: existe, e nomeia a régua', () => {
    expect(bilheteriaBrutaDe(bm({ bilheteriaBruta: 0 }))).toBe(0)
    expect(temBilheteriaBruta(bm({ bilheteriaBruta: 0 }))).toBe(true)
    // Festa de graça: bilheteria 0, público 500, ticket 0 — fecha.
    const b = bm({ publico: 500, bilheteriaBruta: 0, receita: 20000, ticketMedio: 0 })
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
  })

  it('bilheteria bruta AUSENTE é vazio: não existe, e não nomeia régua nenhuma', () => {
    expect(bilheteriaBrutaDe(bm({}))).toBeNull()
    expect(temBilheteriaBruta(bm({}))).toBe(false)
    expect(temBilheteriaBruta(bm({ bilheteriaBruta: null }))).toBe(false)
    expect(temBilheteriaBruta(bm({ bilheteriaBruta: '' }))).toBe(false)
  })

  it('PÚBLICO zero não vira divisão por zero nem régua inventada', () => {
    const b = bm({ publico: 0, bilheteriaBruta: 75000, receita: 100000, ticketMedio: 150 })
    expect(reguaDoTicket(b)).toBe(REGUA_NAO_REGISTRADA)
    expect(Number.isFinite(150)).toBe(true) // e nenhum Infinity escapou para a tela
  })
})

describe('"fechar" é ser o mesmo número com duas casas — e isso é uma escolha', () => {
  it('o ruído do ponto flutuante fecha: 244.999,99 ÷ 1.633 é o mesmo ticket', () => {
    // Divisão feia de propósito — o resultado não é representável em binário.
    const bruta = 244999.99
    const publico = 1633
    const b = bm({ publico, bilheteriaBruta: bruta, ticketMedio: bruta / publico })
    expect(reguaDoTicket(b)).toBe(REGUA_BILHETERIA)
  })

  it('UM CENTAVO de diferença NÃO fecha — é outro número, e a tela mostraria outro número', () => {
    const base = { publico: 1000, bilheteriaBruta: 100000 } // 100,00 por cabeça
    expect(reguaDoTicket(bm({ ...base, ticketMedio: 100 }))).toBe(REGUA_BILHETERIA)
    expect(reguaDoTicket(bm({ ...base, ticketMedio: 100.01 }))).toBe(REGUA_NAO_CONFERE)
    expect(TOLERANCIA_DUAS_CASAS).toBeLessThan(0.01)
  })

  it('ticket ARREDONDADO à mão fica de fora — 297 não é 296,85', () => {
    // É o caso do embutido "Festa do Cordel". Chamar de "receita ÷ público" um
    // número que não é receita ÷ público seria exatamente a aproximação que
    // esta casa não faz com dinheiro.
    const b = bm({ publico: 400, receita: 118740, ticketMedio: 297 })
    expect(118740 / 400).toBeCloseTo(296.85, 2)
    expect(reguaDoTicket(b)).toBe(REGUA_NAO_REGISTRADA)
  })
})

describe('os 4 benchmarks EMBUTIDOS, medidos e não alterados', () => {
  it('nenhum deles ganha régua no chute — dois sem ticket, dois com ticket arredondado', () => {
    const porId = Object.fromEntries(FIXED_BENCHMARKS.map((b) => [b.id, reguaDoTicket(b)]))
    expect(porId['bm-brisa-1205']).toBeNull() // ticketMedio null
    expect(porId['bm-brisa-1403']).toBeNull() // ticketMedio null
    expect(porId['bm-cordel']).toBe(REGUA_NAO_REGISTRADA)
    expect(porId['bm-marfim-0905']).toBe(REGUA_NAO_REGISTRADA)
  })

  it('ler a régua não encosta nos valores de fábrica', () => {
    const congelado = structuredClone(FIXED_BENCHMARKS)
    FIXED_BENCHMARKS.forEach(reguaDoTicket)
    reguasNaLista(FIXED_BENCHMARKS)
    expect(FIXED_BENCHMARKS).toEqual(congelado)
  })
})

describe('mistura de réguas na mesma tela', () => {
  const antiga = bm({ id: 'a', publico: 500, receita: 100000, ticketMedio: 200 })
  const nova = bm({ id: 'b', publico: 500, bilheteriaBruta: 75000, receita: 100000, ticketMedio: 150 })
  const semTicket = bm({ id: 'c', publico: 500, receita: 100000 })

  it('uma régua só não é mistura', () => {
    expect(reguasMisturadas([nova])).toBe(false)
    expect(reguasMisturadas([nova, { ...nova, id: 'b2' }])).toBe(false)
    expect(reguasNaLista([nova])).toEqual([REGUA_BILHETERIA])
  })

  it('duas réguas são mistura, e a lista devolve as duas na ordem em que aparecem', () => {
    expect(reguasMisturadas([antiga, nova])).toBe(true)
    expect(reguasNaLista([antiga, nova])).toEqual([REGUA_RECEITA, REGUA_BILHETERIA])
  })

  it('benchmark SEM ticket não conta como régua — não entra em comparação de ticket', () => {
    expect(reguasMisturadas([nova, semTicket])).toBe(false)
    expect(reguasNaLista([nova, semTicket])).toEqual([REGUA_BILHETERIA])
  })

  it('"não registrada" CONTA como régua distinta — é a comparação que mais engana', () => {
    const opaca = bm({ id: 'd', publico: 500, receita: 100000, ticketMedio: 173.02 })
    expect(reguasMisturadas([nova, opaca])).toBe(true)
  })

  it('lista vazia, nula ou de lixo não vira aviso', () => {
    expect(reguasMisturadas([])).toBe(false)
    expect(reguasMisturadas(null)).toBe(false)
    expect(reguasMisturadas([null, 'texto', 7])).toBe(false)
  })
})

describe('microtexto — toda régua tem etiqueta e explicação, em português', () => {
  it('nenhum código fica sem texto (etiqueta órfã viraria "undefined" na tela)', () => {
    for (const codigo of [
      REGUA_BILHETERIA,
      REGUA_RECEITA,
      REGUA_PAGANTES,
      REGUA_NAO_CONFERE,
      REGUA_NAO_REGISTRADA,
    ]) {
      expect(typeof ETIQUETA_REGUA[codigo]).toBe('string')
      expect(ETIQUETA_REGUA[codigo].length).toBeGreaterThan(0)
      expect(typeof EXPLICACAO_REGUA[codigo]).toBe('string')
      expect(EXPLICACAO_REGUA[codigo].length).toBeGreaterThan(40)
    }
  })

  it('a etiqueta é a CONTA escrita, não um rótulo opaco', () => {
    expect(ETIQUETA_REGUA[REGUA_BILHETERIA]).toContain('÷')
    expect(ETIQUETA_REGUA[REGUA_RECEITA]).toContain('÷')
    expect(ETIQUETA_REGUA[REGUA_PAGANTES]).toContain('÷')
  })
})

describe('entrada torta não derruba nem inventa', () => {
  it('null, texto e número solto atravessam sem exceção', () => {
    for (const lixo of [null, undefined, 'texto', 7, [], NaN]) {
      expect(() => reguaDoTicket(lixo)).not.toThrow()
      expect(reguaDoTicket(lixo)).toBeNull()
    }
  })

  it('ticket como TEXTO não vira régua (o campo não é numérico, então não há conta)', () => {
    expect(reguaDoTicket(bm({ publico: 500, receita: 100000, ticketMedio: '200' }))).toBeNull()
  })

  it('bilheteria bruta Infinity/NaN é lida como ausente, nunca como valor', () => {
    expect(bilheteriaBrutaDe(bm({ bilheteriaBruta: Infinity }))).toBeNull()
    expect(bilheteriaBrutaDe(bm({ bilheteriaBruta: NaN }))).toBeNull()
    // e o ticket, sem bilheteria utilizável, cai na conta da receita
    expect(reguaDoTicket(bm({ publico: 500, receita: 100000, ticketMedio: 200, bilheteriaBruta: NaN }))).toBe(
      REGUA_RECEITA
    )
  })
})
