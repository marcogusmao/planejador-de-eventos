// Sessão F2-C — Exportar pagamentos: destinos Contador (contrato EXATO do
// item 13 do BACKLOG do Financeiro, byte a byte) e Para mim (blindada, com total).
// O destino Financeiro é o export do plano (planoFinanceiro.test.js).

import { describe, it, expect } from 'vitest'
import {
  BOM,
  escaparCSV,
  blindarCelula,
  valorBR,
  dataBR,
  montarPagamentos,
  gerarCSVContador,
  gerarCSVParaMim,
  nomeArquivoContador,
  nomeArquivoParaMim,
} from './exportPagamentos.js'
import { novoEvento, novoItem } from './defaults.js'

function eventoBase() {
  const e = novoEvento('Brisa 15/08')
  e.tipo = 'Brisa'
  e.data = '2026-08-15'
  e.categorias = [
    {
      id: 'locacao',
      nome: 'Locação & Documentação',
      itens: [
        novoItem({ id: 'sinal', servico: 'Sinal do espaço', fornecedor: 'Komplexo', estimado: 8800, dataPagamento: '2026-07-20' }),
      ],
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      itens: [
        novoItem({
          id: 'dj',
          servico: 'DJ',
          estimado: 6000,
          status: 'FECHADO',
          parcelas: [
            { id: 'p1', valor: 3000, data: '2026-08-01' },
            { id: 'p2', valor: 3000, data: '2026-09-01' },
          ],
        }),
      ],
    },
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [novoItem({ id: 'gelo', servico: 'Gelo', estimado: 1000 })], // sem data
    },
  ]
  return e
}

describe('blocos do formato (contrato do item 13)', () => {
  it('valorBR: magnitude positiva, 2 casas, vírgula, SEM milhar', () => {
    expect(valorBR(8800)).toBe('8800,00')
    expect(valorBR(1234.5)).toBe('1234,50')
    expect(valorBR(-500)).toBe('500,00')
    expect(valorBR(25000)).toBe('25000,00') // nunca "25.000"
  })
  it('dataBR: AAAA-MM-DD → DD/MM/AAAA', () => {
    expect(dataBR('2026-08-15')).toBe('15/08/2026')
    expect(dataBR('')).toBe('')
  })
  it('blindagem: =, +, @, -, TAB e CR ganham apóstrofo; texto normal NÃO', () => {
    expect(blindarCelula('=1+1')).toBe("'=1+1")
    expect(blindarCelula('+55 11 99999')).toBe("'+55 11 99999")
    expect(blindarCelula('@financeiro')).toBe("'@financeiro")
    expect(blindarCelula('\tcmd')).toBe("'\tcmd")
    expect(blindarCelula('\rcmd')).toBe("'\rcmd")
    // "-" passou a ser blindado (Marco 20/07/2026): alinha aos 6 gatilhos do
    // backend. Seguro porque a coluna Valor é sempre positiva (Math.abs), então
    // "-" no início só aparece em DESCRIÇÃO, nunca num número legítimo.
    expect(blindarCelula('-1+1')).toBe("'-1+1")
    expect(blindarCelula('DJ normal')).toBe('DJ normal')
  })
  it('escape RFC 4180 com ";": aspas quando tem ; " ou quebra; aspas dobradas', () => {
    expect(escaparCSV('DJ; convidado')).toBe('"DJ; convidado"')
    expect(escaparCSV('Palco "B"')).toBe('"Palco ""B"""')
    expect(escaparCSV('linha\nquebrada')).toBe('"linha\nquebrada"')
    expect(escaparCSV('normal')).toBe('normal')
  })
})

describe('montarPagamentos', () => {
  it('uma linha por custo, UMA POR PARCELA, ordenado por vencimento (sem data no fim)', () => {
    const r = montarPagamentos(eventoBase())
    expect(r.pagamentos.map((p) => [p.rotulo, p.data, p.parcela?.k ?? null])).toEqual([
      ['Sinal do espaço', '2026-07-20', null],
      ['DJ', '2026-08-01', 1],
      ['DJ', '2026-09-01', 2],
      ['Gelo', '', null],
    ])
    expect(r.semData).toBe(1)
    expect(r.avisos).toEqual([])
  })
  it('categoria traduzida na MESMA língua do export do plano', () => {
    const r = montarPagamentos(eventoBase())
    expect(r.pagamentos[0].categoriaFin).toBe('Locação do espaço')
    expect(r.pagamentos[1].categoriaFin).toBe('Artístico / DJ')
  })
  it('parcelas divergentes geram aviso (o arquivo leva as parcelas — nunca silêncio)', () => {
    const e = eventoBase()
    e.categorias[1].itens[0].parcelas[1].valor = 3500
    const r = montarPagamentos(e)
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0]).toContain('DJ')
  })
  it('valor 0 e custo vazio não viram linha', () => {
    const e = eventoBase()
    e.categorias[2].itens[0].estimado = 0
    expect(montarPagamentos(e).pagamentos).toHaveLength(3)
  })
})

describe('gerarCSVContador — byte a byte no contrato do item 13', () => {
  it('arquivo completo: BOM, cabeçalho de 9 colunas, ";", CRLF, DD/MM/AAAA, valores BR', () => {
    const { pagamentos } = montarPagamentos(eventoBase())
    const csv = gerarCSVContador(pagamentos, eventoBase())
    expect(csv).toBe(
      '﻿' +
        'Data;Descrição;Categoria;Grupo;Marca;Evento;Valor;Tipo;Método de pagamento\r\n' +
        '20/07/2026;Sinal do espaço (Komplexo);Locação do espaço;Custo de evento;Brisa;Brisa 15/08;8800,00;Despesa;\r\n' +
        '01/08/2026;DJ · parcela 1/2;Artístico / DJ;Custo de evento;Brisa;Brisa 15/08;3000,00;Despesa;\r\n' +
        '01/09/2026;DJ · parcela 2/2;Artístico / DJ;Custo de evento;Brisa;Brisa 15/08;3000,00;Despesa;\r\n' +
        // Gelo sem data → data do evento (15/08/2026), documentado
        '15/08/2026;Gelo;A&B / CMV;Custo de evento;Brisa;Brisa 15/08;1000,00;Despesa;\r\n'
    )
  })
  it('blindagem no arquivo: descrição começando com "=" sai com apóstrofo', () => {
    const e = eventoBase()
    e.categorias[2].itens[0].servico = '=SOMA(A1:A9)'
    const { pagamentos } = montarPagamentos(e)
    const csv = gerarCSVContador(pagamentos, e)
    expect(csv).toContain(";'=SOMA(A1:A9);A&B / CMV;")
    // e o resto do arquivo continua sem apóstrofo
    expect(csv).not.toContain("'Sinal")
  })
  it('campo com ";" é envolto em aspas (escape convive com a blindagem)', () => {
    const e = eventoBase()
    e.categorias[2].itens[0].servico = '=Gelo; extra'
    const { pagamentos } = montarPagamentos(e)
    const csv = gerarCSVContador(pagamentos, e)
    expect(csv).toContain('"\'=Gelo; extra"')
  })
  it('os dois exports são blindados — exportar não altera nenhum dado do evento', () => {
    const e = eventoBase()
    const congelado = JSON.stringify(e)
    gerarCSVContador(montarPagamentos(e).pagamentos, e)
    gerarCSVParaMim(montarPagamentos(e).pagamentos)
    expect(JSON.stringify(e)).toBe(congelado)
  })
})

describe('gerarCSVParaMim — blindado, ordenado, com TOTAL', () => {
  it('arquivo completo byte a byte: 5 colunas, parcela k/N, total no fim, descrição blindada', () => {
    const e = eventoBase()
    e.categorias[2].itens[0].servico = '=Gelo' // descrição-fórmula: agora blindada
    const { pagamentos } = montarPagamentos(e)
    const csv = gerarCSVParaMim(pagamentos)
    expect(csv).toBe(
      '﻿' +
        'Vencimento;Fornecedor / descrição;Valor;Status;Parcela\r\n' +
        '20/07/2026;Sinal do espaço (Komplexo);8800,00;ESTIMADO;\r\n' +
        '01/08/2026;DJ;3000,00;FECHADO;1/2\r\n' +
        '01/09/2026;DJ;3000,00;FECHADO;2/2\r\n' +
        ";'=Gelo;1000,00;ESTIMADO;\r\n" + // blindado (Marco 21/07/2026); status default agora ESTIMADO
        ';TOTAL;15800,00;;\r\n'
    )
  })
  it('blindagem na descrição: =, +, @, - ganham apóstrofo (mesma régua do contador)', () => {
    const pagamentos = [
      { data: '2026-05-01', rotulo: '=SOMA(A1)', fornecedor: '@cmd', valor: -1234.56, status: 'previsto' },
    ]
    const csv = gerarCSVParaMim(pagamentos)
    // a descrição começa com "=" → apóstrofo à frente; o Excel não executa
    expect(csv).toContain(";'=SOMA(A1) (@cmd);1234,56;previsto;")
    expect(csv).not.toContain(';=SOMA(A1)')
  })
})

describe('parcela paga nos exports (sugestão 38)', () => {
  const eventoComPaga = () => {
    const e = eventoBase()
    e.categorias[1].itens[0].parcelas[0] = {
      id: 'p1',
      valor: 3000,
      data: '2026-08-01',
      paga: true,
      dataPaga: '2026-07-28',
    }
    return e
  }

  it('montarPagamentos carrega paga/dataPaga (a revisão mostra a quitada)', () => {
    const r = montarPagamentos(eventoComPaga())
    const dj1 = r.pagamentos.find((p) => p.id === 'dj:1')
    expect(dj1).toMatchObject({ paga: true, dataPaga: '2026-07-28' })
    expect(r.pagamentos.filter((p) => p.paga)).toHaveLength(1)
  })

  it('parcela paga SEM vencimento não conta no aviso de sem-data (quitada não deve data)', () => {
    const e = eventoComPaga()
    e.categorias[1].itens[0].parcelas[0].data = ''
    expect(montarPagamentos(e).semData).toBe(1) // só o Gelo, como antes
  })

  it('o CSV do CONTADOR não muda um byte com a parcela paga (contrato do item 13 intocado)', () => {
    const antes = gerarCSVContador(montarPagamentos(eventoBase()).pagamentos, eventoBase())
    const depois = gerarCSVContador(montarPagamentos(eventoComPaga()).pagamentos, eventoComPaga())
    expect(depois).toBe(antes)
  })

  it('o CSV "Para mim" rotula a quitada na coluna Parcela: "1/2 · paga em 28/07/2026"', () => {
    const { pagamentos } = montarPagamentos(eventoComPaga())
    const csv = gerarCSVParaMim(pagamentos)
    expect(csv).toContain('01/08/2026;DJ;3000,00;FECHADO;1/2 · paga em 28/07/2026\r\n')
    expect(csv).toContain('01/09/2026;DJ;3000,00;FECHADO;2/2\r\n') // a prevista segue crua
  })

  it('exportar com parcela paga continua sem alterar nenhum dado do evento', () => {
    const e = eventoComPaga()
    const congelado = JSON.stringify(e)
    gerarCSVContador(montarPagamentos(e).pagamentos, e)
    gerarCSVParaMim(montarPagamentos(e).pagamentos)
    expect(JSON.stringify(e)).toBe(congelado)
  })
})

describe('nomes de arquivo', () => {
  it('slug do evento + data', () => {
    expect(nomeArquivoContador(eventoBase())).toBe('contador-brisa-15-08-2026-08-15.csv')
    expect(nomeArquivoParaMim(eventoBase())).toBe('pagamentos-brisa-15-08-2026-08-15.csv')
  })
})

describe('BOM', () => {
  it('é o U+FEFF de verdade (Excel pt-BR abre acentos certos)', () => {
    expect(BOM).toBe('﻿')
    expect(BOM.charCodeAt(0)).toBe(0xfeff)
  })
})
