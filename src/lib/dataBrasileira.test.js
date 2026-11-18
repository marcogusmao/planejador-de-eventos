// As contas de data do calendário próprio (pedido do Marco, reafirmado em
// 05/08/2026: "o calendário do navegador é ruim para trocar de ano").
//
// A peça central desta suíte NÃO é o parse feliz — é a RECUSA de data
// impossível. Hoje quem impede `31/02/2026` de entrar no app é o widget
// `<input type="date">`; o componente próprio remove essa rede, e o que sobra
// aceita: `/^\d{4}-\d{2}-\d{2}$/` casa com '2026-02-31', `dataValida` do
// curvaVendas.js aprova, e `new Date('2026-02-31T12:00:00')` devolve 3 de
// março. Data errada mostrada como certa é o pior defeito do rulebook — por
// isso o caso 31/02 tem asserção dupla aqui: recusa E não devolve março.
//
// Tudo é repetido com o relógio em 21h30 e 00h30 porque a suíte roda em dois
// fusos (TZ=UTC e TZ=America/Sao_Paulo) e um erro de UTC passa despercebido em
// um deles — foi assim que nasceu o dataLocal.js em 20/07/2026.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseDataBR,
  ehDataISO,
  gradeDoMes,
  moverFoco,
  rotuloDoMes,
  blocoDeAnos,
  definirAno,
  NOMES_MES,
  DIAS_SEMANA,
} from './dataBrasileira.js'
import { fmtData } from './format.js'
import { dataISOLocal } from './dataLocal.js'

afterEach(() => vi.useRealTimers())

const fixarRelogioLocal = (ano, mes, dia, hora, minuto) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(ano, mes - 1, dia, hora, minuto, 0, 0))
}

describe('parseDataBR — o que se digita', () => {
  it('05/08/2026 vira 2026-08-05', () => {
    expect(parseDataBR('05/08/2026')).toEqual({ valido: true, valor: '2026-08-05' })
  })

  it('um dígito vale: 5/8/2026 é o mesmo dia', () => {
    expect(parseDataBR('5/8/2026').valor).toBe('2026-08-05')
  })

  it('colado, sem barra: 05082026', () => {
    expect(parseDataBR('05082026').valor).toBe('2026-08-05')
  })

  it('vazio é "não informado" — NUNCA vira hoje', () => {
    fixarRelogioLocal(2026, 8, 5, 14, 0)
    expect(parseDataBR('')).toEqual({ valido: true, valor: '' })
    expect(parseDataBR('   ')).toEqual({ valido: true, valor: '' })
  })

  it('digitação a meio caminho não avisa nem grava', () => {
    for (const meio of ['0', '05', '05/', '05/0', '05/08', '05/08/', '05/08/20', '0508', '0508202']) {
      expect(parseDataBR(meio), meio).toEqual({ valido: false, incompleto: true })
    }
  })

  it('ano de DOIS dígitos é recusado — adivinhar século é inventar dado', () => {
    // 05/08/26 completa três partes, mas o ano tem 2 dígitos: fica incompleto,
    // então o campo não avisa enquanto ele digita o resto.
    expect(parseDataBR('05/08/26')).toEqual({ valido: false, incompleto: true })
  })
})

describe('parseDataBR — a recusa que substitui a rede do navegador', () => {
  it('31/02/2026 é RECUSADO, e o retorno não contém 3 de março', () => {
    const r = parseDataBR('31/02/2026')
    expect(r.valido).toBe(false)
    expect(r.incompleto).toBe(false)
    expect(JSON.stringify(r)).not.toContain('2026-03-03')
    expect(JSON.stringify(r)).not.toContain('03-03')
    expect(r.motivo).toBe('Fevereiro de 2026 não tem 31 dias')
  })

  it('bissexto de verdade: 29/02/2024 vale, 29/02/2026 não', () => {
    expect(parseDataBR('29/02/2024').valor).toBe('2024-02-29')
    expect(parseDataBR('29/02/2026').valido).toBe(false)
  })

  it('31 de abril, junho, setembro e novembro são recusados', () => {
    for (const mes of [4, 6, 9, 11]) {
      const r = parseDataBR(`31/${String(mes).padStart(2, '0')}/2026`)
      expect(r.valido, `31/${mes}`).toBe(false)
      expect(r.motivo).toContain('não tem 31 dias')
    }
  })

  it('dia 32, dia 00, mês 13 e mês 00 são recusados com aviso', () => {
    for (const ruim of ['32/01/2026', '00/01/2026', '05/13/2026', '05/00/2026']) {
      const r = parseDataBR(ruim)
      expect(r.valido, ruim).toBe(false)
      expect(r.incompleto, ruim).toBe(false)
      expect(r.motivo, ruim).toBeTruthy()
    }
  })

  it('letra nunca vira NaN silencioso', () => {
    for (const ruim of ['cinco de agosto', '05/ago/2026', 'hoje']) {
      const r = parseDataBR(ruim)
      expect(r.valido, ruim).toBe(false)
      expect(r.incompleto, ruim).toBe(false)
    }
  })

  it('barras a mais é recusado, não interpretado pela metade', () => {
    expect(parseDataBR('05/08/2026/1').valido).toBe(false)
    expect(parseDataBR('05/08/2026/1').incompleto).toBe(false)
  })
})

describe('ehDataISO — forma E existência', () => {
  it('recusa 2026-02-31, que a regex da migração aprova', () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test('2026-02-31')).toBe(true) // a rede fraca de hoje
    expect(ehDataISO('2026-02-31')).toBe(false) // a rede nova
  })

  it('aceita data que existe e recusa forma torta', () => {
    expect(ehDataISO('2026-08-05')).toBe(true)
    expect(ehDataISO('2024-02-29')).toBe(true)
    for (const ruim of ['05/08/2026', '2026-8-5', '', null, undefined, 42, '2026-13-01']) {
      expect(ehDataISO(ruim), String(ruim)).toBe(false)
    }
  })
})

describe('round-trip com o formatador da casa', () => {
  it('todos os dias de 2024 (bissexto) e 2026 voltam iguais por fmtData → parseDataBR', () => {
    for (const ano of [2024, 2026]) {
      for (let mes = 1; mes <= 12; mes += 1) {
        const dias = new Date(ano, mes, 0).getDate()
        for (let dia = 1; dia <= dias; dia += 1) {
          const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          expect(parseDataBR(fmtData(iso)).valor, iso).toBe(iso)
        }
      }
    }
  })
})

describe('gradeDoMes', () => {
  it('42 células, sem repetição, começando no domingo', () => {
    const g = gradeDoMes(2026, 8)
    expect(g.length).toBe(42)
    expect(new Set(g.map((c) => c.iso)).size).toBe(42)
    // 01/08/2026 é sábado → a grade abre em 26/07 (domingo)
    expect(g[0].iso).toBe('2026-07-26')
    expect(g[0].doMes).toBe(false)
  })

  it('agosto de 2026 tem 31 células do mês; fevereiro de 2024 tem 29 e o de 2026, 28', () => {
    expect(gradeDoMes(2026, 8).filter((c) => c.doMes).length).toBe(31)
    expect(gradeDoMes(2024, 2).filter((c) => c.doMes).length).toBe(29)
    expect(gradeDoMes(2026, 2).filter((c) => c.doMes).length).toBe(28)
  })

  it('nenhuma célula discorda do relógio local, em 12 meses seguidos', () => {
    for (let mes = 1; mes <= 12; mes += 1) {
      for (const c of gradeDoMes(2026, mes)) {
        expect(ehDataISO(c.iso), `${mes} ${c.iso}`).toBe(true)
        const [a, m, d] = c.iso.split('-').map(Number)
        expect(c.iso).toBe(dataISOLocal(new Date(a, m - 1, d, 12)))
        expect(c.dia).toBe(d)
      }
    }
  })
})

describe('moverFoco', () => {
  it('dia e semana atravessam mês e ano', () => {
    expect(moverFoco('2026-08-31', 'baixo')).toBe('2026-09-07')
    expect(moverFoco('2026-12-31', 'direita')).toBe('2027-01-01')
    expect(moverFoco('2026-01-01', 'esquerda')).toBe('2025-12-31')
    expect(moverFoco('2026-01-03', 'cima')).toBe('2025-12-27')
  })

  it('mês CLAMPA o dia: 31/03 um mês atrás é 28/02, nunca 03/03', () => {
    expect(moverFoco('2026-03-31', 'mesAnterior')).toBe('2026-02-28')
    expect(moverFoco('2024-03-31', 'mesAnterior')).toBe('2024-02-29') // bissexto
    expect(moverFoco('2026-01-31', 'mesSeguinte')).toBe('2026-02-28')
  })

  it('ano CLAMPA o dia: 29/02 de ano bissexto vira 28/02 no ano anterior', () => {
    expect(moverFoco('2024-02-29', 'anoAnterior')).toBe('2023-02-28')
    expect(moverFoco('2024-02-29', 'anoSeguinte')).toBe('2025-02-28')
    expect(moverFoco('2026-08-05', 'anoAnterior')).toBe('2025-08-05')
  })

  it('início e fim do mês', () => {
    expect(moverFoco('2026-08-19', 'inicioDoMes')).toBe('2026-08-01')
    expect(moverFoco('2026-08-19', 'fimDoMes')).toBe('2026-08-31')
    expect(moverFoco('2026-02-10', 'fimDoMes')).toBe('2026-02-28')
    expect(moverFoco('2024-02-10', 'fimDoMes')).toBe('2024-02-29')
  })

  it('entrada torta não vira data nova — devolve o que recebeu', () => {
    expect(moverFoco('2026-02-31', 'direita')).toBe('2026-02-31')
    expect(moverFoco('', 'direita')).toBe('')
    expect(moverFoco('2026-08-05', 'inventada')).toBe('2026-08-05')
  })

  it('doze meses para a frente e doze para trás voltam ao mesmo dia', () => {
    let iso = '2026-08-05'
    for (let i = 0; i < 12; i += 1) iso = moverFoco(iso, 'mesSeguinte')
    expect(iso).toBe('2027-08-05')
    for (let i = 0; i < 12; i += 1) iso = moverFoco(iso, 'mesAnterior')
    expect(iso).toBe('2026-08-05')
  })
})

describe('rótulos em português e a grade de anos', () => {
  it('rotuloDoMes fala como gente', () => {
    expect(rotuloDoMes(2026, 8)).toBe('agosto de 2026')
    expect(rotuloDoMes(2026, 3)).toBe('março de 2026')
  })

  it('doze meses e sete dias, sem buraco', () => {
    expect(NOMES_MES.length).toBe(12)
    expect(DIAS_SEMANA.length).toBe(7)
    expect(DIAS_SEMANA[0]).toBe('dom')
  })

  it('blocoDeAnos dá 12 anos e contém o ano pedido — o atalho do "trocar de ano"', () => {
    const b = blocoDeAnos(2026)
    expect(b.length).toBe(12)
    expect(b).toContain(2026)
    expect(b[0] % 12).toBe(0) // blocos fixos, não centrados: a grade não desliza sob a mão
    expect(b[0]).toBe(2016)
    expect(b[11]).toBe(2027)
  })

  it('definirAno clampa o dia: 29/02 de bissexto num ano comum é 28/02, nunca 01/03', () => {
    expect(definirAno('2024-02-29', 2026)).toBe('2026-02-28')
    expect(definirAno('2026-08-05', 2019)).toBe('2019-08-05')
    expect(definirAno('2024-02-29', 2028)).toBe('2028-02-29') // bissexto continua 29
    expect(definirAno('2026-02-31', 2020)).toBe('2026-02-31') // entrada torta volta igual
  })

  it('o bloco é o MESMO para qualquer ano dentro dele, e o vizinho não se sobrepõe', () => {
    expect(blocoDeAnos(2020)).toEqual(blocoDeAnos(2026))
    expect(blocoDeAnos(2028)[0]).toBe(2028)
    expect(blocoDeAnos(2028)).not.toContain(2027)
  })
})

describe('fuso: o resultado não pode depender do relógio da máquina', () => {
  const casos = [
    ['2026-08-31 baixo', () => moverFoco('2026-08-31', 'baixo'), '2026-09-07'],
    ['2026-03-31 mês atrás', () => moverFoco('2026-03-31', 'mesAnterior'), '2026-02-28'],
    ['parse 05/08/2026', () => parseDataBR('05/08/2026').valor, '2026-08-05'],
    ['grade abre em', () => gradeDoMes(2026, 8)[0].iso, '2026-07-26'],
    ['fim de fevereiro', () => moverFoco('2024-02-10', 'fimDoMes'), '2024-02-29'],
  ]

  it('às 21h30 (o horário que quebrou o relógio da casa em fuso negativo)', () => {
    fixarRelogioLocal(2026, 8, 5, 21, 30)
    for (const [nome, fn, esperado] of casos) expect(fn(), nome).toBe(esperado)
  })

  it('às 00h30 (o horário que quebraria em fuso positivo)', () => {
    fixarRelogioLocal(2026, 8, 5, 0, 30)
    for (const [nome, fn, esperado] of casos) expect(fn(), nome).toBe(esperado)
  })

  it('na virada do ano, 23h59', () => {
    fixarRelogioLocal(2026, 12, 31, 23, 59)
    for (const [nome, fn, esperado] of casos) expect(fn(), nome).toBe(esperado)
  })
})

describe('a parede: nenhuma linha deste módulo chama toISOString', () => {
  it('o texto-fonte não contém a palavra que produziu o S1 do relógio', () => {
    const fonte = readFileSync(new URL('./dataBrasileira.js', import.meta.url), 'utf8')
    // o cabeçalho CITA o nome ao explicar a regra; a proibição é sobre CHAMADA
    expect(fonte).not.toMatch(/\.toISOString\s*\(/)
    expect(fonte).toContain('dataISOLocal')
  })
})

// ————————————————————————————————————————————————————————————————
// A INVARIANTE QUE FALTAVA (achado da revisão adversarial, 05/08/2026)
//
// O round-trip acima varria só 2024 e 2026 — e por isso não viu que
// `01/01/0999` saía como `"999-01-01"`, declarado VÁLIDO por esta mesma
// função e recusado pelo `ehDataISO` dela. Uma string de 3 caracteres que
// vazava até o arquivo do contador, quebrava a ordenação da ponte e era
// apagada em silêncio pela migração no carregamento seguinte.
//
// A regra agora é uma frase só, e vale para QUALQUER entrada.
// ————————————————————————————————————————————————————————————————
describe('invariante: tudo que sai como válido É ISO que o módulo reconhece', () => {
  it('vale para os anos que quebravam e para os das pontas', () => {
    for (const ano of ['0001', '0050', '0099', '0100', '0999', '1000', '2026', '9999']) {
      for (const texto of [`01/01/${ano}`, `0101${ano}`]) {
        const r = parseDataBR(texto)
        if (r.valido && r.valor !== '') {
          expect(ehDataISO(r.valor), `${texto} => ${r.valor}`).toBe(true)
          expect(r.valor.length, `${texto} => ${r.valor}`).toBe(10)
        }
      }
    }
  })

  it('ano de menos de 4 dígitos é RECUSADO, com a mensagem que leva ao conserto', () => {
    for (const texto of ['01/01/0999', '01/01/0050', '01/01/0001', '010109 99'.replace(' ', '')]) {
      const r = parseDataBR(texto)
      expect(r.valido, texto).toBe(false)
      if (r.incompleto === false) expect(r.motivo, texto).toBe('O ano precisa ter 4 dígitos (ex.: 2026)')
    }
    // e a antiga mensagem enganosa não aparece mais para esse caso
    expect(parseDataBR('01/01/0050').motivo).not.toContain('não tem 1 dias')
  })

  it('1000 e 9999 continuam valendo — a régua é o número de dígitos, não o gosto', () => {
    expect(parseDataBR('01/01/1000').valor).toBe('1000-01-01')
    expect(parseDataBR('31/12/9999').valor).toBe('9999-12-31')
  })

  it('varredura: 3 mil textos de data, nenhum "válido" que não seja ISO', () => {
    let validos = 0
    for (let ano = 1; ano <= 3000; ano += 1) {
      const r = parseDataBR(`15/06/${String(ano).padStart(4, '0')}`)
      if (r.valido && r.valor !== '') {
        validos += 1
        expect(ehDataISO(r.valor), String(ano)).toBe(true)
      }
    }
    // de 1 a 3000, só de 1000 para cima passa: 2001 anos
    expect(validos).toBe(2001)
  })
})
