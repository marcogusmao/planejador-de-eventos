// O aviso das DATAS IMPOSSÍVEIS na fronteira do backup (Marco, 07/08/2026 —
// opção (b) do S3 "`evento.data` não é saneada por camada nenhuma").
//
// A DECISÃO, e por que ela não é a que o BACKLOG recomendava. A opção (a) era a
// migração zerar o que não fosse data. A medição derrubou: a migração roda a
// CADA carregamento, e ali não há tela para avisar nem desfazer — uma data
// sumiria ao abrir o app, sem aviso e sem caminho de volta (princípios 4 e 7 de
// cabeça para baixo). O import é a única fronteira que já tem revisão,
// confirmação antes de aplicar e cópia de segurança. É lá que o aviso mora, e
// nada é apagado em lugar nenhum.
//
// O QUE ESTA SUÍTE PROTEGE, e que nenhum teste de tela alcança: que o aviso
// EXISTE, que ele lista os três campos que a migração deixa passar tortos, e —
// a metade que importa mais — que ele continua sendo só aviso: o dado entra
// exatamente como veio.

import { describe, it, expect } from 'vitest'
import {
  censoDatasImpossiveis,
  censoDatasApagadas,
  textoAvisoDatasImpossiveis,
  textoAvisoDatasApagadas,
  avisoDeImport,
  censoNormalizacoes,
  migrarEvento,
} from './migracao.js'

// As SEIS portas de data de um evento, todas com o mesmo valor — o molde que
// separa os dois censos conforme o valor tenha forma ISO ou não.
const seisPortas = (v) => ({
  id: 'e', nome: 'A', data: v, inicioVendas: v,
  lotes: [{ id: 'l', nome: 'Lote 1', valor: 1, quantidade: 1, viradaPrevista: v }],
  categorias: [{ id: 'c', nome: 'P', itens: [
    { id: 'i', servico: 'DJ', estimado: 1, dataPagamento: v,
      parcelas: [{ id: 'p', valor: 1, data: v, dataPaga: v }] },
  ] }],
})

const eventoTorto = () => ({
  id: 'e1',
  nome: 'Marfim Alto',
  data: '2026-02-31',
  categorias: [
    {
      id: 'c1',
      nome: 'Produção',
      itens: [
        { id: 'i1', servico: 'DJ', estimado: 1000, dataPagamento: '2026-13-01' },
        {
          id: 'i2',
          servico: 'Som',
          estimado: 2000,
          parcelas: [
            { id: 'p1', valor: 1000, data: '2026-02-31' },
            { id: 'p2', valor: 1000, data: '2026-09-20' },
          ],
        },
      ],
    },
  ],
})

describe('censoDatasImpossiveis — as datas que sobrevivem sem ser data', () => {
  it('acha a data da festa, a do pagamento e a da parcela, com o nome do evento', () => {
    const censo = censoDatasImpossiveis([eventoTorto()])
    expect(censo.map((c) => c.campo)).toEqual(['data', 'dataPagamento', 'parcelaData'])
    expect(censo.every((c) => c.evento === 'Marfim Alto')).toBe(true)
    expect(censo[0].rotulo).toBe("data da festa '2026-02-31'")
    expect(censo[1].rotulo).toBe("custo 'DJ', pagamento '2026-13-01'")
    expect(censo[2].rotulo).toBe("custo 'Som', parcela 1, data '2026-02-31'")
  })

  // A régua é a EXISTÊNCIA, não a forma: `2026-02-31` passa em qualquer regex de
  // AAAA-MM-DD, e é lido pela casa inteira como 3 de março.
  it('bissexto de verdade: 29/02/2024 é data, 29/02/2026 não é', () => {
    expect(censoDatasImpossiveis([{ nome: 'A', data: '2024-02-29' }])).toEqual([])
    expect(censoDatasImpossiveis([{ nome: 'A', data: '2026-02-29' }])).toHaveLength(1)
  })

  // A régua é "SOBREVIVE e não é data". O que a migração apaga é outra classe, e
  // listá-lo aqui faria a frase mentir ("entra como está" sobre algo que some).
  // `evento.data` não é saneada por camada nenhuma e passa qualquer string; o
  // pagamento e a parcela passam pelo `formaDataISO`, que confere FORMA e não
  // existência — por isso os dois se comportam diferente com o MESMO valor.
  it('o que a migração APAGA não entra: o mesmo 31/04/2026 conta no evento e não no pagamento', () => {
    const censo = censoDatasImpossiveis([
      {
        id: 'e',
        nome: 'A',
        data: '31/04/2026',
        categorias: [{ id: 'c', nome: 'P', itens: [{ id: 'i', servico: 'DJ', estimado: 1, dataPagamento: '31/04/2026' }] }],
      },
    ])
    expect(censo.map((c) => c.campo)).toEqual(['data'])
  })

  it('vazio e ausente NÃO entram — são "não informado" de propósito', () => {
    expect(censoDatasImpossiveis([{ nome: 'A', data: '' }, { nome: 'B' }, { nome: 'C', data: '  ' }])).toEqual([])
  })

  it('arquivo limpo, entrada inválida e lixo não explodem', () => {
    expect(censoDatasImpossiveis([{ nome: 'A', data: '2026-08-05' }])).toEqual([])
    expect(censoDatasImpossiveis(null)).toEqual([])
    expect(censoDatasImpossiveis([null, 'texto', [], { nome: 'A', categorias: 'x' }])).toEqual([])
  })
})

describe('o texto do aviso diz a verdade: nada é apagado', () => {
  it('a frase promete que a data entra COMO ESTÁ', () => {
    const t = textoAvisoDatasImpossiveis(censoDatasImpossiveis([eventoTorto()]))
    expect(t).toContain('3 datas que não existem no calendário')
    expect(t).toContain('COMO ESTÃO')
    expect(t).toContain('nada é apagado')
    expect(t).toContain("data da festa '2026-02-31'")
  })

  it('singular e plural, como o resto dos avisos da casa', () => {
    const um = textoAvisoDatasImpossiveis(censoDatasImpossiveis([{ nome: 'A', data: '2026-02-31' }]))
    expect(um).toContain('1 data que não existe')
    expect(um).toContain('COMO ESTÁ')
  })
})

describe('avisoDeImport — dois censos, um diálogo, cada um com a sua frase', () => {
  it('só números: a frase de sempre, sem falar de data', () => {
    const t = avisoDeImport(censoNormalizacoes([{ nome: 'A', lotes: [{ nome: 'L', valor: -5 }] }]), [])
    expect(t).toContain("'não informado'")
    expect(t).not.toContain('calendário')
    expect(t).toContain('Continuar?')
  })

  it('só datas: a frase de datas, sem prometer que algo vira "não informado"', () => {
    const t = avisoDeImport([], censoDatasImpossiveis([eventoTorto()]))
    expect(t).toContain('calendário')
    expect(t).not.toContain("entrarão como 'não informado'")
    expect(t).toContain('Continuar?')
  })

  it('os dois juntos: as duas frases, e o "Continuar?" uma vez só', () => {
    const t = avisoDeImport(
      censoNormalizacoes([{ nome: 'A', lotes: [{ nome: 'L', valor: -5 }] }]),
      censoDatasImpossiveis([eventoTorto()])
    )
    expect(t).toContain("'não informado'")
    expect(t).toContain('calendário')
    expect(t.match(/Continuar\?/g)).toHaveLength(1)
  })

  it('arquivo limpo devolve vazio — a tela usa isso para não perguntar nada', () => {
    expect(avisoDeImport([], [])).toBe('')
    expect(avisoDeImport()).toBe('')
  })
})

// ————— a metade que importa mais: continua sendo SÓ AVISO —————

describe('o aviso não apaga nada — a decisão (b) do Marco, provada', () => {
  it('depois de migrar, as três datas tortas continuam exatamente como vieram', () => {
    const m = migrarEvento(eventoTorto())
    expect(m.data).toBe('2026-02-31')
    expect(m.categorias[0].itens[0].dataPagamento).toBe('2026-13-01')
    expect(m.categorias[0].itens[1].parcelas[0].data).toBe('2026-02-31')
    // e a boa do lado não foi tocada
    expect(m.categorias[0].itens[1].parcelas[1].data).toBe('2026-09-20')
  })

  it('o censo é leitura pura: rodar não muda o objeto que foi passado', () => {
    const antes = eventoTorto()
    const foto = JSON.stringify(antes)
    censoDatasImpossiveis([antes])
    expect(JSON.stringify(antes)).toBe(foto)
  })
})

// ————————————————————————————————————————————————————————————————
// O BALDE IRMÃO: as datas que a migração APAGA (Marco, 07/08/2026)
//
// O censo numérico fechou "a fronteira do backup era muda" para NÚMERO fora de
// faixa em 22/07. Ficou muda para DATA. As duas listas saem da MESMA varredura
// dos seis campos, e é isso que impede uma de esquecer o que a outra vê — foi
// exatamente o que aconteceu na primeira versão, que olhava três.
// ————————————————————————————————————————————————————————————————

describe('os dois censos dividem as SEIS portas de data, sem sobra nem repetição', () => {
  it('forma ISO impossível (2026-13-99): as seis SOBREVIVEM, nenhuma é apagada', () => {
    const ev = seisPortas('2026-13-99')
    expect(censoDatasImpossiveis([ev]).map((c) => c.campo)).toEqual([
      'data', 'inicioVendas', 'viradaPrevista', 'dataPagamento', 'parcelaData', 'parcelaDataPaga',
    ])
    expect(censoDatasApagadas([ev])).toEqual([])
  })

  it('forma brasileira (31/04/2026): cinco são APAGADAS e só a data da festa sobrevive', () => {
    const ev = seisPortas('31/04/2026')
    expect(censoDatasApagadas([ev]).map((c) => c.campo)).toEqual([
      'inicioVendas', 'viradaPrevista', 'dataPagamento', 'parcelaData', 'parcelaDataPaga',
    ])
    expect(censoDatasImpossiveis([ev]).map((c) => c.campo)).toEqual(['data'])
  })

  it('data de verdade não entra em balde nenhum', () => {
    const ev = seisPortas('2026-08-05')
    expect(censoDatasImpossiveis([ev])).toEqual([])
    expect(censoDatasApagadas([ev])).toEqual([])
  })

  it('cada campo cai em UM balde só — nunca nos dois', () => {
    for (const v of ['2026-13-99', '31/04/2026', 'lixo', '2026-02-31']) {
      const ev = seisPortas(v)
      const a = censoDatasImpossiveis([ev]).map((c) => c.campo)
      const b = censoDatasApagadas([ev]).map((c) => c.campo)
      expect(a.filter((c) => b.includes(c))).toEqual([])
      expect(a.length + b.length).toBe(6)
    }
  })

  it('o balde das apagadas promete a MESMA coisa que o censo numérico', () => {
    const t = textoAvisoDatasApagadas(censoDatasApagadas([seisPortas('31/04/2026')]))
    expect(t).toContain('5 datas em formato que o app não reconhece')
    expect(t).toContain("entrarão como 'não informado'")
    expect(t).toContain("lote 'Lote 1', virada prevista '31/04/2026'")
    expect(t).toContain("custo 'DJ', parcela 1, paga em '31/04/2026'")
  })

  it('e a promessa é VERDADE: depois de migrar, os cinco estão vazios', () => {
    const m = migrarEvento(seisPortas('31/04/2026'))
    expect(m.inicioVendas).toBe('')
    expect(m.lotes[0].viradaPrevista).toBe('')
    expect(m.categorias[0].itens[0].dataPagamento).toBe('')
    expect(m.categorias[0].itens[0].parcelas[0].data).toBe('')
    expect(m.categorias[0].itens[0].parcelas[0].dataPaga).toBe('')
    expect(m.data).toBe('31/04/2026') // a única que sobrevive
  })

  it('o aviso do import junta os TRÊS blocos, com um "Continuar?" só', () => {
    const ev = seisPortas('31/04/2026')
    const t = avisoDeImport(
      censoNormalizacoes([{ nome: 'A', lotes: [{ nome: 'L', valor: -5 }] }]),
      censoDatasImpossiveis([ev]),
      censoDatasApagadas([ev])
    )
    expect(t).toContain("fora das faixas do app")
    expect(t).toContain('não reconhece')
    expect(t).toContain('calendário')
    expect(t.match(/Continuar\?/g)).toHaveLength(1)
  })
})
