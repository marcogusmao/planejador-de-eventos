import { describe, it, expect } from 'vitest'
import {
  temFechamentoInformado,
  acuraciaAgregada,
  acuraciaContexto,
  fraseDesvio,
  festaAcusada,
  fraseForaDaMedia,
} from './acuracia.js'
import { novoEvento, novoItem } from './defaults.js'
import { clone } from './util.js'
import { fechamentoReceita, NOME_BILHETERIA_BRUTA } from './fechamento.js'
import { computeCenario } from './calc.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Evento de teste com fechamento informado: estimados e realizados conhecidos, contas à mão.
const eventoComRealizadoBase = (patch = {}) => {
  const e = novoEvento('Fechado')
  e.tipo = 'Brisa'
  e.lotes = [{ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 1000, somenteOtimista: false }]
  e.cenariosConfig.realista.vendaPct = 100
  e.taxaBilheteria = 0
  e.cashbackPct = 0
  e.categorias = [
    {
      id: 'aeb',
      nome: 'A&B',
      padrao: true,
      itens: [novoItem({ servico: 'Insumos', estimado: 10000, realizado: 11000 })], // +10%
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      padrao: true,
      itens: [novoItem({ servico: 'DJs', estimado: 20000, realizado: 18000 })], // −10%
    },
    {
      id: 'marketing',
      nome: 'Marketing',
      padrao: true,
      itens: [novoItem({ servico: 'Design', estimado: 2000 })], // sem realizado → fora
    },
  ]
  // bilheteria prevista (bruta realista) = 1000 × 100 = 100.000; realizada 90.000 = −10%
  e.receitaRealizada = { bilheteria: 90000, bar: '' }
  return { ...e, ...patch }
}

describe('temFechamentoInformado', () => {
  it('sem nenhum realizado → não é fechado; com custo OU receita realizada → é', () => {
    const aberto = novoEvento('Aberto')
    expect(temFechamentoInformado(aberto)).toBe(false)
    expect(temFechamentoInformado(eventoComRealizadoBase())).toBe(true)
    const soReceita = novoEvento('Só receita')
    soReceita.receitaRealizada = { bilheteria: 5000, bar: '' }
    expect(temFechamentoInformado(soReceita)).toBe(true)
  })
})

describe('acuraciaAgregada — contas à mão', () => {
  it('um evento: médias = os desvios do próprio evento (+10% A&B, −10% Artístico, bilheteria −10%)', () => {
    const a = acuraciaAgregada([eventoComRealizadoBase(), novoEvento('Aberto — fica fora')])
    expect(a.nFechados).toBe(1)
    const porNome = Object.fromEntries(a.geral.categorias.map((c) => [c.nome, c.mediaPct]))
    expect(porNome['A&B']).toBeCloseTo(10)
    expect(porNome['Artístico']).toBeCloseTo(-10)
    expect(porNome['Marketing']).toBeUndefined() // sem realizado → fora
    // Custo total pela FONTE ÚNICA (confrontoCustos.js, via fechamentoCustos):
    // o realizado de 29.000 é confrontado com o estimado DOS MESMOS itens —
    // 30.000 (A&B 10 mil + Artístico 20 mil) —, e não com os 32.000 do
    // orçamento inteiro. Marketing não tem realizado: seus 2.000 não podem
    // entrar na conta como se fossem economia (S1 de 20/07/2026). −3,33%.
    expect(a.geral.custoTotal.mediaPct).toBeCloseTo(((29000 - 30000) / 30000) * 100)
    expect(a.geral.bilheteria.mediaPct).toBeCloseTo(-10)
  })

  it('dois eventos do mesmo tipo: média SIMPLES por evento ((+10 + +30)/2 = +20)', () => {
    const e1 = eventoComRealizadoBase()
    const e2 = eventoComRealizadoBase()
    e2.id = 'outro'
    e2.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        padrao: true,
        itens: [novoItem({ servico: 'Insumos', estimado: 1000, realizado: 1300 })], // +30%
      },
    ]
    e2.receitaRealizada = { bilheteria: '', bar: '' }
    const a = acuraciaAgregada([e1, e2])
    expect(a.nFechados).toBe(2)
    const aeb = a.geral.categorias.find((c) => c.nome === 'A&B')
    expect(aeb.n).toBe(2)
    expect(aeb.mediaPct).toBeCloseTo(20) // evento pequeno pesa igual ao grande
    // bilheteria: só o e1 informou → n 1, média −10
    expect(a.geral.bilheteria).toEqual({ n: 1, mediaPct: expect.closeTo(-10) })
  })

  it('agrupa por tipo de festa; evento sem tipo vai para o grupo "" ', () => {
    const brisa = eventoComRealizadoBase()
    const semTipo = eventoComRealizadoBase({ tipo: '' })
    semTipo.id = 'sem-tipo'
    const a = acuraciaAgregada([brisa, semTipo])
    expect(a.porTipo.map((t) => t.tipo).sort()).toEqual(['', 'Brisa'])
    expect(a.porTipo.find((t) => t.tipo === 'Brisa').n).toBe(1)
  })

  it('categoria com estimado 0 fica fora da média % (sem % inventado)', () => {
    const e = eventoComRealizadoBase()
    e.categorias = [
      {
        id: 'extras',
        nome: 'Extras',
        padrao: true,
        itens: [novoItem({ servico: 'Surpresa', estimado: '', realizado: 500 })],
      },
    ]
    e.receitaRealizada = { bilheteria: '', bar: '' }
    const a = acuraciaAgregada([e])
    expect(a.nFechados).toBe(1) // é fechado (tem realizado)…
    expect(a.geral.categorias).toEqual([]) // …mas sem estimado não há %
    expect(a.geral.custoTotal).toBeNull()
  })

  it('categorias de eventos diferentes agregam por NOME aparado (ids internos diferentes)', () => {
    const e1 = eventoComRealizadoBase()
    const e2 = eventoComRealizadoBase()
    e2.id = 'x'
    e2.categorias = [
      {
        id: 'uid-qualquer',
        nome: '  A&B ', // nome com espaços — mesmo grupo
        itens: [novoItem({ servico: 'Gelo', estimado: 100, realizado: 110 })],
      },
    ]
    e2.receitaRealizada = { bilheteria: '', bar: '' }
    const a = acuraciaAgregada([e1, e2])
    expect(a.geral.categorias.find((c) => c.nome === 'A&B').n).toBe(2)
  })

  it('zero eventos fechados: estatística vazia explícita (a tela diz, não inventa)', () => {
    const a = acuraciaAgregada([novoEvento('Aberto')])
    expect(a.nFechados).toBe(0)
    expect(a.geral.categorias).toEqual([])
    expect(a.geral.custoTotal).toBeNull()
    expect(a.geral.bilheteria).toBeNull()
    expect(a.porTipo).toEqual([])
  })

  it('não muta nenhum evento (leitura pura)', () => {
    const e = eventoComRealizadoBase()
    const congelado = clone(e)
    acuraciaAgregada([e])
    expect(e).toEqual(congelado)
  })
})

describe('acuraciaContexto (aba Fechamento)', () => {
  it('usa o agregado do MESMO tipo quando existe; senão cai no geral', () => {
    const brisa = eventoComRealizadoBase()
    const outra = eventoComRealizadoBase({ tipo: 'Marfim Alto' })
    outra.id = 'o'
    const ctxBrisa = acuraciaContexto([brisa, outra], { tipo: 'Brisa' })
    expect(ctxBrisa.escopo).toBe('tipo')
    expect(ctxBrisa.n).toBe(1)
    const ctxSemFechamento = acuraciaContexto([brisa, outra], { tipo: 'Sobrado' })
    expect(ctxSemFechamento.escopo).toBe('geral')
    expect(ctxSemFechamento.n).toBe(2)
  })
})

describe('caso Brisa 14/03 (números reais do benchmark, conferidos à mão)', () => {
  // O Brisa 14/03 fechado como evento: custo estimado 110.000 × realizado
  // 112.959 (o custoTotal do benchmark embutido) → +2,69%; bilheteria
  // prevista 180.000 × realizada 186.420 → +3,5666…%.
  it('desvios batem com a conta à mão', () => {
    const e = novoEvento('Brisa 14/03 fechado')
    e.tipo = 'Brisa'
    e.lotes = [{ id: 'l1', nome: 'Geral', valor: 90, quantidade: 2000, somenteOtimista: false }]
    e.cenariosConfig.realista.vendaPct = 100
    e.categorias = [
      {
        id: 'equipe',
        nome: 'Equipe',
        padrao: true,
        itens: [novoItem({ servico: 'Staff', estimado: 110000, realizado: 112959 })],
      },
    ]
    e.receitaRealizada = { bilheteria: 186420, bar: '' }
    const a = acuraciaAgregada([e])
    // custo: (112959 − 110000) / 110000 = +2,69%
    expect(a.geral.custoTotal.mediaPct).toBeCloseTo(2.69, 5)
    // bilheteria prevista = 2000 × 90 = 180.000 → (186420 − 180000)/180000 = +3,566667…%
    expect(a.geral.bilheteria.mediaPct).toBeCloseTo(3.566667, 5)
    expect(fraseDesvio('Equipe', 2.69)).toBe('Equipe estoura em média +3%')
  })
})

describe('fraseDesvio', () => {
  it('estouro, economia e zero em português', () => {
    expect(fraseDesvio('A&B', 12.4)).toBe('A&B estoura em média +12%')
    expect(fraseDesvio('Artístico', -8)).toBe('Artístico fica em média −8% abaixo do previsto')
    expect(fraseDesvio('Equipe', 0)).toBe('Equipe sai em média como o previsto')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// O ACOPLAMENTO POR STRING ENTRE ACURÁCIA E FECHAMENTO — fechado em
// 30/08/2026, com aprovação do Marco para abrir o portão do golden.
//
// `fechamento.js` ESCREVE o nome da linha da bilheteria; `acuracia.js` a
// PROCURA por esse nome. Enquanto o texto morava duplicado nos dois arquivos,
// renomear a linha num deles quebrava o outro EM SILÊNCIO — o `find` devolvia
// `undefined`, a bilheteria sumia da estatística, e nenhum teste acusava,
// porque cada módulo continuava correto sozinho.
//
// Os dois casos abaixo são o par que fecha o buraco: o primeiro prova que a
// busca acha o que o fechamento escreve; o segundo prova que ela acha PELO
// NOME (e não por posição na lista, o que a faria passar por acidente).
// ─────────────────────────────────────────────────────────────────────────
describe('o nome da linha da bilheteria tem UMA fonte, e a acurácia lê dela', () => {
  it('a linha que o fechamento escreve é exatamente a que a acurácia procura', () => {
    const evento = eventoComRealizadoBase()
    const rec = fechamentoReceita(evento, computeCenario(evento, 'realista'))
    const daFonte = rec.linhas.find((l) => l.nome === NOME_BILHETERIA_BRUTA)
    expect(daFonte, 'o fechamento deixou de escrever a linha com o nome da constante').toBeTruthy()
  })

  it('a busca é POR NOME: uma linha com outro rótulo não é confundida com a bilheteria', () => {
    // Sem isto, uma busca que pegasse "a primeira linha" passaria verde e o
    // acoplamento continuaria de pé sem ninguém ver.
    const linhas = [
      { nome: 'Bar (lucro líquido)', estimado: 1, realizado: 1 },
      { nome: NOME_BILHETERIA_BRUTA, estimado: 2, realizado: 2 },
    ]
    expect(linhas.find((l) => l.nome === NOME_BILHETERIA_BRUTA).estimado).toBe(2)
  })

  it('nenhum dos dois módulos volta a escrever o rótulo à mão', () => {
    // A GUARDA ESTRUTURAL, e é ela que impede a regressão de verdade: os dois
    // casos acima continuariam verdes se alguém recolasse o literal em
    // `acuracia.js`, porque o texto seria o mesmo. Este lê o FONTE.
    const fonteAcuracia = readFileSync(fileURLToPath(new URL('./acuracia.js', import.meta.url)), 'utf8')
    expect(fonteAcuracia).not.toContain("'Bilheteria (bruta)'")

    // Em `fechamento.js` o literal pode aparecer UMA vez — a declaração da
    // própria constante — mais a frase em prosa que pede ao Marco preencher o
    // campo, que é texto de tela e não chave de busca.
    const fonteFechamento = readFileSync(fileURLToPath(new URL('./fechamento.js', import.meta.url)), 'utf8')
    const comAspasSimples = fonteFechamento.split("'Bilheteria (bruta)'").length - 1
    expect(comAspasSimples).toBe(1)
  })
})

// ————— FESTA ACUSADA FICA FORA DA MÉDIA (2ª revisão do PR #98, 05/10/2026) —————
// Medido pelo revisor: com uma festa "estimado 1e308 + realizado R$ 5.000"
// fechada ao lado, a Brisa sã passava de "A&B +10%" para a média com o −100%
// da quebrada (5.000 / 1e308 − 1), sem aviso. Decisão do Marco, 26/07/2026: o
// dado quebrado para de contaminar festa sã.
describe('acurácia: festa com dado quebrado fica fora da média, e a tela sabe disso', () => {
  const quebrada = () =>
    eventoComRealizadoBase({
      nome: 'Brisa quebrada',
      categorias: [
        {
          id: 'aeb',
          nome: 'A&B',
          padrao: true,
          itens: [novoItem({ servico: 'Insumos', estimado: 1e308, realizado: 5000 })],
        },
      ],
    })

  it('a média antiga, refeita à mão: com a quebrada dentro, A&B daria −45% (não +10%)', () => {
    // Só a conta, para quem ler saber o tamanho do estrago. O controle positivo
    // de verdade foi rodado contra a main (06669eb) no dia: +5% sem aviso.
    // A média que a tela mostrava, refeita à mão com os desvios das duas:
    // sã +10%, quebrada 5.000/1e308 − 1 = −100% → (10 − 100) / 2 = −45.
    expect((10 + (5000 / 1e308 - 1) * 100) / 2).toBeCloseTo(-45)
  })

  it('a festa sã continua com +10% em A&B, e a quebrada vai para `fora`', () => {
    const a = acuraciaAgregada([eventoComRealizadoBase(), quebrada()])
    expect(a.nFechados).toBe(1)
    const aeb = a.geral.categorias.find((c) => c.nome === 'A&B')
    expect(aeb.n).toBe(1)
    expect(aeb.mediaPct).toBeCloseTo(10)
    expect(a.fora).toEqual([{ nome: 'Brisa quebrada', tipo: 'Brisa' }])
  })

  it('o contexto da aba Fechamento traz a lista de fora do mesmo tipo', () => {
    const sa = eventoComRealizadoBase()
    const ctx = acuraciaContexto([sa, quebrada()], sa)
    expect(ctx.escopo).toBe('tipo')
    expect(ctx.fora.map((f) => f.nome)).toEqual(['Brisa quebrada'])
    expect(fraseForaDaMedia(ctx.fora)).toBe(
      '1 evento ficou fora desta média por ter um valor que o app não consegue calcular (“Brisa quebrada”) — corrija na festa para ele voltar a contar.'
    )
  })

  it('receita quebrada também acusa; festa sã não', () => {
    expect(festaAcusada(eventoComRealizadoBase())).toBe(false)
    expect(festaAcusada(eventoComRealizadoBase({ receitaRealizada: { bilheteria: 1e308, bar: '' } }))).toBe(true)
  })

  it('sem festa acusada, `fora` é vazio e não há frase — nada muda na tela', () => {
    const a = acuraciaAgregada([eventoComRealizadoBase()])
    expect(a.fora).toEqual([])
    expect(fraseForaDaMedia(a.fora)).toBe(null)
  })
})

// Concordância no plural (3ª revisão do PR #98, 05/10/2026): a frase dizia
// "3 eventos ficaram fora … corrija na festa para ele voltar a contar".
describe('fraseForaDaMedia concorda em número', () => {
  const fora = (n) => Array.from({ length: n }, (_, i) => ({ nome: `Festa ${i + 1}`, tipo: '' }))

  it('singular: um evento, "para ele voltar"', () => {
    expect(fraseForaDaMedia(fora(1))).toContain('1 evento ficou fora desta média por ter um valor')
    expect(fraseForaDaMedia(fora(1))).toContain('corrija na festa para ele voltar a contar')
  })

  it('plural: "eventos ficaram", "por terem", "nas festas para eles voltarem"', () => {
    const f = fraseForaDaMedia(fora(3))
    expect(f).toContain('3 eventos ficaram fora desta média por terem um valor')
    expect(f).toContain('corrija nas festas para eles voltarem a contar')
    expect(f).not.toContain('para ele voltar')
  })

  it('mais de três: nomeia três e conta o resto', () => {
    expect(fraseForaDaMedia(fora(5))).toContain('(“Festa 1”, “Festa 2”, “Festa 3” e mais 2)')
  })
})
