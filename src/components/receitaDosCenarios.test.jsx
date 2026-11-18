// @vitest-environment jsdom
//
// RECEITA DOS CENÁRIOS QUE NÃO É DINHEIRO: LUCRO, MARGEM, VEREDITO E RECEITA
// VIRAM TEXTO, E A FAIXA DIZ QUAL CAMPO.
//
// O que estava quebrado (4ª revisão adversarial do PR #98, 05/10/2026): com um
// patrocínio CONFIRMADO de 1e308 a faixa de receita acendia ("os números que
// dependem dela saem como 'não dá para calcular'"), mas lucro, margem e
// veredito só viravam texto por custo. Medido: Cenários com 29 números
// gigantes ("Lucro R$ 100.000…"); Relatório com 8 e "Viável … margem realista
// 100%"; Apresentação com 21; WhatsApp com a linha ⚠️ seguida de "🟢 *Evento
// viável.*". A varredura deste dia achou a família inteira: lote com valor em
// 1e307 dava receita NaN e "Viável com ressalvas"; lote com quantidade em 1e307
// dava pagantes de centenas de dígitos e "Inviável"; consumo de bar por pessoa
// ecoado na premissa; ticket manual na continha do ticket.
//
// Precondição e caminho: `computeCenario` soma o insumo na receita do cenário;
// a tela imprime lucro e margem (margem = lucro ÷ receita ≈ 100%, que CABE na
// régua e mente). O conserto olha a ORIGEM (lição da 3ª revisão): insumo
// acusado → todos os números de receita e lucro dos cenários viram texto.
//
// Lição do revisor que este arquivo leva a sério: "a cada rodada o conserto
// cobriu exatamente os campos que o teste hostil anterior usava". Por isso ele
// varre TODO insumo da receita dos cenários, nas duas grandezas, em todas as
// superfícies — não os casos citados.
//
// Decisão do Marco, 26/07/2026: a tela DIZ que a festa tem dado quebrado em vez
// de imprimir número derivado de lixo. Só exibição; nenhuma conta muda.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ScenariosTab from './ScenariosTab.jsx'
import ReportView from './ReportView.jsx'
import PresentationMode from './PresentationMode.jsx'
import Home from './Home.jsx'
import { VeredictoPainel } from './Veredito.jsx'
import {
  TITULO_RECEITA_QUEBRADA,
  FRASE_CARTAO_RECEITA_QUEBRADA,
  FRASE_SOMA_RECEITA,
  NUMERO_NAO_CALCULA,
} from './AvisoCustoQuebrado.jsx'
import { resumoCurto, resumoCompleto } from '../lib/resumo.js'
import { receitaQuebrada, VALOR_ILEGIVEL } from '../lib/dadoQuebrado.js'
import { festaAcusada } from '../lib/acuracia.js'
import { novoEvento, novoItem, novoLote } from '../lib/defaults.js'
import { migrarEvento } from '../lib/migracao.js'

afterEach(cleanup)

const mapa = new Map()
globalThis.localStorage = {
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
  clear: () => mapa.clear(),
}

const noop = () => {}
const salva = (e) => migrarEvento(JSON.parse(JSON.stringify(e)))
const n = (s) => s.replace(/\s+/g, ' ')

function festa() {
  const e = novoEvento('Festa')
  e.tipo = 'Brisa'
  e.data = '2026-12-05'
  e.publicoEstimado = 200
  e.contingenciaPct = 10
  e.lotes = [novoLote({ nome: 'Lote único', valor: 100, quantidade: 200 })]
  e.categorias = [{ id: 'aeb', nome: 'A&B', padrao: false, itens: [novoItem({ servico: 'Bebidas', estimado: 3000 })] }]
  return e
}

// TODO insumo que entra na receita dos cenários (calc.js, computeCenarioNucleo
// — só lido): lotes, ticket manual, bar (fixo ou por pessoa), patrocínio que
// conta (confirmado, recebido, ou o número solto antigo sem a lista).
const INSUMOS = {
  'patrocínio confirmado': (e, v) => (e.patrocinios = [{ id: 'p1', patrocinador: 'Marca X', valor: v, estagio: 'confirmado' }]),
  'patrocínio recebido': (e, v) => (e.patrocinios = [{ id: 'p1', patrocinador: 'Marca X', valor: v, estagio: 'recebido' }]),
  'patrocínio no número solto antigo': (e, v) => {
    delete e.patrocinios
    e.outrasReceitas = { ...(e.outrasReceitas || {}), patrocinio: v }
  },
  'valor do lote': (e, v) => (e.lotes[0].valor = v),
  'quantidade do lote': (e, v) => (e.lotes[0].quantidade = v),
  'bar fixo': (e, v) => {
    e.barModo = 'fixo'
    e.outrasReceitas = { ...(e.outrasReceitas || {}), bar: v }
  },
  'bar por pessoa': (e, v) => {
    e.barModo = 'porPessoa'
    e.barTicket = { pessimista: v, realista: v, otimista: v }
  },
  // nos TRÊS cenários: aqui todo cenário quebra. Quebrado em UM só, os outros
  // dois têm de continuar com os números — bloco "insumo de UM cenário", abaixo.
  'ticket médio manual': (e, v) => {
    const cfg = e.cenariosConfig || {}
    e.cenariosConfig = Object.fromEntries(
      ['pessimista', 'realista', 'otimista'].map((k) => [k, { ...(cfg[k] || {}), ticketMedio: v }])
    )
    for (const [k, val] of Object.entries(cfg)) if (!(k in e.cenariosConfig)) e.cenariosConfig[k] = val
  },
}

// O que a faixa tem de dizer, insumo a insumo: "sempre que um número vira
// 'não dá para calcular', a tela diz QUAL campo" (2ª revisão do PR #98).
const NOME_NA_FAIXA = {
  'patrocínio confirmado': 'O valor do patrocínio “Marca X” não cabe',
  'patrocínio recebido': 'O valor do patrocínio “Marca X” não cabe',
  // a migração transforma o número solto numa lista com o nome "Patrocínio"
  'patrocínio no número solto antigo': 'O valor do patrocínio “Patrocínio” não cabe',
  'valor do lote': 'O valor do lote “Lote único” não cabe',
  'quantidade do lote': 'O valor do lote “Lote único” não cabe',
  'bar fixo': 'O valor do bar previsto não cabe',
  'bar por pessoa': 'O valor do consumo de bar por pessoa (pessimista) não cabe',
  'ticket médio manual': 'O valor do ticket médio do cenário realista não cabe',
}

const st = (e) => ({ eventos: [e], benchmarksCustom: [], benchmarkOverrides: {}, ajustes: {} })
const TELAS = {
  Cenários: (e) => <ScenariosTab evento={e} update={noop} store={st(e)} />,
  'Relatório Resumido': (e) => {
    mapa.set('previsao-eventos:relatorio-nivel:v1', 'resumido')
    return <ReportView evento={e} store={st(e)} onBack={noop} />
  },
  'Relatório Completo': (e) => {
    mapa.set('previsao-eventos:relatorio-nivel:v1', 'completo')
    return <ReportView evento={e} store={st(e)} onBack={noop} />
  },
  Apresentação: (e) => <PresentationMode evento={e} store={st(e)} update={noop} aparencia={{}} onClose={noop} />,
}
const texto = (el) => {
  render(el)
  const t = n(document.body.textContent)
  cleanup()
  return t
}

const GIGANTE = /[\d.]{40,}/
// margem com número — fora o exemplo genérico do glossário ("Margem 30% = …")
const MARGEM_COM_NUMERO = /[Mm]argem( realista)?:? ?-?\d+(,\d+)?%(?! =)/
// título do veredito OU a frase dele ("Viável: margem…", na Apresentação)
const VEREDITO = /Evento viável|Viável com ressalvas|Inviável como está|Viável: margem/

describe('insumo da receita dos cenários que não cabe: nenhuma superfície mente', () => {
  for (const [insumo, aplicar] of Object.entries(INSUMOS)) {
    for (const valor of [1e307, 1e308]) {
      const quebrada = () => {
        const e = festa()
        aplicar(e, valor)
        return salva(e)
      }

      for (const [tela, montar] of Object.entries(TELAS)) {
        it(`${insumo} em ${valor} · ${tela}: sem número gigante, sem margem, sem veredito, com a faixa`, () => {
          const t = texto(montar(quebrada()))
          expect(t).not.toMatch(GIGANTE)
          expect(t).not.toMatch(MARGEM_COM_NUMERO)
          expect(t).not.toMatch(VEREDITO)
          expect(t).toContain(TITULO_RECEITA_QUEBRADA)
          expect(t).toContain(NOME_NA_FAIXA[insumo])
          expect(t).toContain(NUMERO_NAO_CALCULA)
        })
      }

      it(`${insumo} em ${valor} · Home e painel do veredito`, () => {
        const h = texto(<Home store={st(quebrada())} setStore={vi.fn()} aparencia={{}} abrir={vi.fn()} abrirAjustes={vi.fn()} />)
        expect(h).toContain(FRASE_CARTAO_RECEITA_QUEBRADA)
        expect(h).not.toMatch(GIGANTE)
        expect(h).not.toMatch(VEREDITO)
        const v = texto(<VeredictoPainel evento={quebrada()} update={noop} />)
        expect(v).toContain('Sem veredito')
        expect(v).toContain('Uma receita desta festa não cabe numa conta de dinheiro')
      })

      it(`${insumo} em ${valor} · WhatsApp`, () => {
        for (const w of [resumoCurto(quebrada()), resumoCompleto(quebrada())]) {
          expect(w).toContain('⚠️ Esta festa tem uma receita que o app não consegue calcular')
          expect(w).not.toMatch(GIGANTE)
          expect(w).not.toMatch(MARGEM_COM_NUMERO)
          expect(w).not.toMatch(VEREDITO)
          expect(w).not.toMatch(/[🟢🟡🔴]/u)
        }
      })
    }
  }

  it('soma sem culpado (lote de R$ 1e304 × 200): a faixa diz que a SOMA não cabe, e ninguém dá margem nem veredito', () => {
    // O pessimista calcula ~1,5e306 (cabe) e realista/otimista estouram: a
    // origem dos três é a mesma. Nenhum insumo sozinho é acusado.
    const e = festa()
    e.lotes[0].valor = 1e304
    const q = salva(e)
    expect(receitaQuebrada(q)).toMatchObject({ campos: [], somaNaoCabe: true, ha: true })
    for (const montar of Object.values(TELAS)) {
      const t = texto(montar(q))
      expect(t).toContain(FRASE_SOMA_RECEITA)
      expect(t).not.toMatch(MARGEM_COM_NUMERO)
      expect(t).not.toMatch(VEREDITO)
    }
  })
})

describe('S4: patrocínio em PROPOSTA de 1e308 não entra em conta, então não acende nada', () => {
  const proposta = () => {
    const e = festa()
    e.patrocinios = [{ id: 'p1', patrocinador: 'Marca X', valor: 1e308, estagio: 'proposta' }]
    return salva(e)
  }

  it('nem faixa, nem exclusão da acurácia, e os números da festa continuam', () => {
    expect(receitaQuebrada(proposta()).ha).toBe(false)
    expect(festaAcusada(proposta())).toBe(false)
    for (const montar of Object.values(TELAS)) {
      const t = texto(montar(proposta()))
      expect(t).not.toContain(TITULO_RECEITA_QUEBRADA)
      expect(t).not.toMatch(GIGANTE) // o valor cru da proposta sai como frase
    }
  })

  it('WhatsApp: o veredito continua, e a proposta sai como frase que se explica', () => {
    const w = resumoCompleto(proposta())
    expect(w).toMatch(VEREDITO)
    expect(w).toContain(`em proposta (não somado): ${VALOR_ILEGIVEL}`)
    expect(w).not.toMatch(GIGANTE)
  })
})

describe('CONTRAPROVA: festa sã', () => {
  for (const [tela, montar] of Object.entries(TELAS)) {
    it(`${tela}: veredito, margem em número e nenhuma faixa de receita`, () => {
      const t = texto(montar(salva(festa())))
      // a aba Cenários não tem painel de veredito (ele mora no topo do editor)
      if (tela !== 'Cenários') expect(t).toMatch(VEREDITO)
      expect(t).toMatch(MARGEM_COM_NUMERO)
      expect(t).not.toContain(TITULO_RECEITA_QUEBRADA)
      expect(t).not.toContain(NUMERO_NAO_CALCULA)
    })
  }
})

// ————— INSUMO DE UM CENÁRIO SÓ NÃO ESCONDE OS OUTROS (5ª revisão, 05/10/2026) —————
// Com o ticket médio manual em 1e307 SÓ no otimista, pessimista (receita
// R$ 15.200, lucro R$ 11.570) e realista (R$ 17.100, R$ 13.800) estavam certos
// e saíam "não dá para calcular", com "Sem veredito". Causa: a checagem entre
// cenários tratava todo insumo como compartilhado. Ticket manual e consumo de
// bar por pessoa são de UM cenário; o veredito depende do realista (margem) e
// do pessimista (lucro), não do otimista (calc.js, `veredito`).
// E a frase do veredito mandava corrigir o ticket "na aba Receita" — ele mora
// em Cenários.
describe('insumo de UM cenário quebrado: só aquele cenário vira texto', () => {
  const ORDEM = ['pessimista', 'realista', 'otimista']
  const POR_CENARIO = {
    'ticket médio manual': {
      aplicar: (e, k) => (e.cenariosConfig = { ...e.cenariosConfig, [k]: { ...(e.cenariosConfig?.[k] || {}), ticketMedio: 1e307 } }),
      aba: 'Cenários',
    },
    'consumo de bar por pessoa': {
      aplicar: (e, k) => {
        e.barModo = 'porPessoa'
        e.barTicket = { pessimista: 20, realista: 20, otimista: 20, [k]: 1e307 }
      },
      aba: 'Receita',
    },
  }
  const lucrosDosCards = (c) =>
    Array.from(c.querySelectorAll('div'))
      .filter((d) => d.children.length === 0 && d.textContent.trim() === 'Lucro')
      .map((d) => d.nextElementSibling?.textContent.trim())
      .filter(Boolean)

  for (const [insumo, { aplicar, aba }] of Object.entries(POR_CENARIO)) {
    for (const k of ORDEM) {
      const quebrada = () => {
        const e = festa()
        aplicar(e, k)
        return salva(e)
      }
      const vereditoSome = k !== 'otimista'

      it(`${insumo} quebrado só no ${k}: os outros dois cenários mostram o lucro em reais`, () => {
        render(<ScenariosTab evento={quebrada()} update={noop} store={st(quebrada())} />)
        const lucros = lucrosDosCards(document.body)
        cleanup()
        expect(lucros.length).toBe(3)
        ORDEM.forEach((outro, i) => {
          if (outro === k) expect(lucros[i], outro).toBe(NUMERO_NAO_CALCULA)
          else expect(lucros[i], outro).toMatch(/^R\$\s?[\d.]{1,12}$/)
        })
      })

      it(`${insumo} quebrado só no ${k}: o veredito ${vereditoSome ? 'some, e aponta a aba ' + aba : 'continua'}`, () => {
        const v = texto(<VeredictoPainel evento={quebrada()} update={noop} />)
        if (vereditoSome) {
          expect(v).toContain('Sem veredito')
          expect(v).toContain(`Corrija o valor na aba ${aba}.`)
        } else {
          expect(v).not.toContain('Sem veredito')
          expect(v).toMatch(VEREDITO)
        }
        const w = resumoCurto(quebrada())
        if (vereditoSome) expect(w).toContain('*Sem veredito.*')
        else expect(w).toMatch(VEREDITO)
      })
    }
  }

  it('CONTRAPROVA do compartilhado: o lote quebrado continua escondendo os três', () => {
    const e = festa()
    e.lotes[0].valor = 1e307
    render(<ScenariosTab evento={salva(e)} update={noop} store={st(salva(e))} />)
    const lucros = lucrosDosCards(document.body)
    cleanup()
    expect(lucros).toEqual([NUMERO_NAO_CALCULA, NUMERO_NAO_CALCULA, NUMERO_NAO_CALCULA])
  })
})
