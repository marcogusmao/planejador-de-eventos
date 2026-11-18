// "Copiar resumo" (Sessão K) — display-only: o texto tem que citar os MESMOS
// números que computeCenarios/veredito calculam, e nunca mexer no evento.
import { describe, it, expect } from 'vitest'
import {
  DATA_DO_EVENTO_ILEGIVEL,
  dataDoEventoIlegivel,
  fraseRitmo,
  linhaRitmoRelatorio,
  resumoCompleto,
  resumoCurto,
  ritmoPorDia,
} from './resumo.js'
import { computeCenarios, veredito, ritmoVendas, custosPorStatus } from './calc.js'
import { fmtBRL, fmtCompact, fmtPct, fmtData } from './format.js'
import { dataISOLocal } from './dataLocal.js'
import { novoEvento, novoLote, novoItem } from './defaults.js'
import { STATUS_CUSTO_IDS } from './statusCusto.js'
import { fecharEvento } from './fechamentoEvento.js'
import { NUMERO_NAO_CALCULA, FRASE_VEREDITO_QUEBRADO } from './dadoQuebrado.js'

function eventoVerde() {
  const ev = novoEvento('Festa Teste')
  ev.data = '2026-09-12'
  ev.local = 'Komplexo Tempo'
  ev.lotes = [novoLote({ nome: 'Lote 1', valor: 100, quantidade: 1000 })]
  ev.categorias = ev.categorias.map((c, i) =>
    i === 0 ? { ...c, itens: [novoItem({ servico: 'Insumos', estimado: 30000 })] } : c
  )
  return ev
}

function eventoVermelho() {
  const ev = eventoVerde()
  ev.categorias = ev.categorias.map((c, i) =>
    i === 0 ? { ...c, itens: [novoItem({ servico: 'Tudo caro', estimado: 90000 })] } : c
  )
  return ev
}

describe('resumoCurto', () => {
  it('abre com o emoji do semáforo + nome/data/local e a frase do veredito', () => {
    const ev = eventoVerde()
    const c = computeCenarios(ev)
    const v = veredito(c, ev)
    expect(v.cor).toBe('verde') // sanidade do cenário do teste
    const txt = resumoCurto(ev)
    expect(txt.startsWith('🟢 *Festa Teste* — 12/09/2026 · Komplexo Tempo')).toBe(true)
    expect(txt).toContain('Evento viável')
    expect(txt).toContain(fmtPct(c.realista.margem))
  })

  it('cita os lucros dos três cenários exatamente como o app formata', () => {
    const ev = eventoVerde()
    const c = computeCenarios(ev)
    const txt = resumoCurto(ev)
    expect(txt).toContain(`pessimista ${fmtCompact(c.pessimista.lucro)}`)
    expect(txt).toContain(`*realista ${fmtCompact(c.realista.lucro)}*`)
    expect(txt).toContain(`otimista ${fmtCompact(c.otimista.lucro)}`)
  })

  it('vermelho usa 🔴 e a frase de inviável', () => {
    const txt = resumoCurto(eventoVermelho())
    expect(txt.startsWith('🔴')).toBe(true)
    expect(txt).toContain('Inviável como está')
  })

  it('inclui o ritmo quando há vendidos até hoje e evento futuro', () => {
    const ev = eventoVerde()
    ev.vendidosAteHoje = 100
    const txt = resumoCurto(ev, { hoje: '2026-07-19' })
    expect(txt).toContain('Vendidos até hoje: 100.')
    // a frase é a MESMA do card (fraseRitmo sobre ritmoVendas)
    const c = computeCenarios(ev)
    const r = ritmoVendas({
      vendidos: 100,
      dataEvento: ev.data,
      breakEven: c.realista.breakEven,
      hoje: '2026-07-19',
    })
    expect(txt).toContain(fraseRitmo(r))
  })

  it('sem vendidos, a linha de ritmo não aparece (nada de número inventado)', () => {
    expect(resumoCurto(eventoVerde())).not.toContain('Vendidos até hoje')
  })

  it('não mexe no evento (display-only)', () => {
    const ev = eventoVerde()
    const antes = JSON.stringify(ev)
    resumoCurto(ev)
    resumoCompleto(ev)
    expect(JSON.stringify(ev)).toBe(antes)
  })
})

describe('resumoCompleto', () => {
  it('abre os três cenários com receita/custo e traz o % do orçamento', () => {
    const ev = eventoVerde()
    const c = computeCenarios(ev)
    const txt = resumoCompleto(ev)
    expect(txt).toContain('*Cenários*')
    expect(txt).toContain(`Realista: lucro ${fmtCompact(c.realista.lucro)}`)
    expect(txt).toContain(`receita ${fmtCompact(c.realista.receitaTotal)}`)
    expect(txt).toContain('Orçamento:')
    expect(txt).toContain('ainda é estimativa')
  })

  it('o curto NÃO traz orçamento nem seção de cenários (é o nível de 1 tela)', () => {
    const txt = resumoCurto(eventoVerde())
    expect(txt).not.toContain('Orçamento:')
    expect(txt).not.toContain('*Cenários*')
  })

  // Decisão 1 do Marco (22/07/2026): o numerador "fechados ou pagos" passou a
  // incluir PARCIAL (dinheiro comprometido) — antes era só PAGO+FECHADO. Mesma
  // função da barra (contaOrcamentoFechado). No código antigo esta linha saía
  // "R$ 100 de R$ 250 (40%)"; o certo é "R$ 150 de R$ 250 (60%)".
  it('PARCIAL entra no "fechados ou pagos" do resumo (mesma conta da barra)', () => {
    const ev = eventoVerde()
    ev.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          novoItem({ servico: 'A', estimado: 100, status: 'ESTIMADO' }),
          novoItem({ servico: 'B', estimado: 100, status: 'PAGO' }),
          novoItem({ servico: 'C', estimado: 50, status: 'PARCIAL' }),
        ],
      },
    ]
    expect(resumoCompleto(ev)).toContain(
      `${fmtCompact(150)} de ${fmtCompact(250)} (60%) fechados ou pagos`
    )
  })

  it('patrocínio: fechado somado e proposta como potencial, nunca misturados', () => {
    const ev = eventoVerde()
    ev.patrocinios = [
      { id: 'p1', patrocinador: 'Mirante', valor: 8000, estagio: 'confirmado' },
      { id: 'p2', patrocinador: 'Coroado', valor: 5000, estagio: 'proposta' },
    ]
    const txt = resumoCompleto(ev)
    expect(txt).toContain(`Patrocínio fechado (conta na receita): ${fmtBRL(8000)}`)
    expect(txt).toContain(`em proposta (não somado): ${fmtBRL(5000)}`)
  })

  it('premissas citadas: open bar e a regra exata do desconto (sugestão 29)', () => {
    const ev = eventoVerde()
    ev.openBar = true
    ev.descontoMedioPct = 12
    const txt = resumoCompleto(ev)
    // frase-fonte-única de premissaTexto.js — a regra exata, não só o cupom
    expect(txt).toContain('cupom de 12% em todos os ingressos — já aplicado na receita')
    expect(txt).toContain('open bar — sem receita de bar')
    // com fração parcial, a regra citada muda junto
    ev.descontoIngressosModo = 'pct'
    ev.descontoIngressosValor = 40
    expect(resumoCompleto(ev)).toContain('cupom de 12% em 40% dos ingressos — já aplicado na receita')
  })
})

describe('festa FECHADA fala com o RESULTADO REAL (decisão do Marco, 20/07/2026)', () => {
  const eventoFechadoReal = (extras = {}) => {
    const ev = eventoVerde()
    ev.status = 'fechado'
    ev.fechamento = {
      em: '2026-07-20T21:00:00.000Z',
      foto: {
        resultado: { resultado: -2000, receita: 38000, custos: 40000, completo: true, ...extras },
      },
    }
    return ev
  }

  it('curto: lidera com o resultado real da FOTO e não repete a projeção', () => {
    const t = resumoCurto(eventoFechadoReal())
    expect(t).toContain('Resultado real')
    expect(t).toContain(fmtBRL(-2000))
    expect(t).toContain('fechado em 20/07/2026')
    expect(t).toContain(fmtBRL(38000))
    expect(t).toContain(fmtBRL(40000))
    expect(t).not.toContain('Lucro: pessimista') // a projeção sai do curto
    expect(t).toContain('🔴') // sinal do resultado REAL, não do semáforo projetado
  })

  // ————— Marco, 07/08/2026: o S2 do relógio das 21h —————
  // `fechamento.em` é carimbo de INSTANTE em UTC, e está certo assim no dado. O
  // errado era exibi-lo com `.slice(0, 10)`, que lê a data em UTC: fechando uma
  // festa às 21h30 de São Paulo, o WhatsApp que vai para as sócias anunciava o
  // dia SEGUINTE. A asserção é contra a data local CALCULADA, não contra um
  // literal, para valer nos dois fusos que a esteira roda.
  it('curto: fechado às 21h30 de São Paulo diz o dia LOCAL, não o de Greenwich', () => {
    const ev = eventoFechadoReal()
    ev.fechamento.em = '2026-08-06T00:30:00.000Z' // 05/08/2026 21h30 em São Paulo
    const diaLocal = fmtData(dataISOLocal(new Date(ev.fechamento.em)))
    const t = resumoCurto(ev)
    expect(t).toContain(`fechado em ${diaLocal}`)
    // e em fuso ATRÁS de UTC — o do Marco — o dia local é o ANTERIOR ao do carimbo
    if (new Date('2026-08-06T00:30:00.000Z').getTimezoneOffset() > 0) {
      expect(t).toContain('fechado em 05/08/2026')
      expect(t).not.toContain('06/08/2026')
    }
  })

  it('curto: resultado real positivo abre com 🟢', () => {
    const t = resumoCurto(eventoFechadoReal({ resultado: 24100, receita: 64100 }))
    expect(t).toContain('🟢')
    expect(t).toContain(fmtBRL(24100))
  })

  it('curto: pendência declarada aparece quando a foto não é completa', () => {
    const t = resumoCurto(eventoFechadoReal({ completo: false }))
    expect(t).toContain('pendência declarada')
  })

  it('completo: resultado real na frente e o plano pré-evento segue como comparação', () => {
    const t = resumoCompleto(eventoFechadoReal())
    expect(t).toContain('Resultado real')
    expect(t).toContain('plano pré-evento')
    expect(t).toContain('*Cenários*') // as seções do plano continuam
  })

  it('festa ABERTA (mesmo com data passada) segue mostrando a projeção — fechar é o que oficializa', () => {
    const ev = eventoVerde()
    ev.data = '2026-01-10'
    const t = resumoCurto(ev)
    expect(t).not.toContain('Resultado real')
    expect(t).toContain('Lucro: pessimista')
  })
})

// Item 1 do export v2 (Marco, 21/07/2026): o conserto agnóstico do total do
// resumo. O código antigo somava `custosPorStatus` sobre a lista CRAVADA
// ['PAGO','FECHADO','NEGOCIANDO','ORÇAR'] — que POR ACASO era exaustiva, um
// acoplamento que violava latentemente "status nunca mexe em dinheiro". Com a
// lista nova, item ESTIMADO/NEGOCIAR cairia FORA e o total subcontaria. O
// conserto faz o princípio valer de verdade: o total é INVARIANTE ao status.
describe('PROPRIEDADE — o total do resumo é invariante ao status (item 1, export v2)', () => {
  const eventoCom = (status) => {
    const ev = novoEvento('Prop')
    ev.categorias = [
      {
        id: 'aeb',
        nome: 'A&B',
        itens: [
          novoItem({ servico: 'X', estimado: 15000, status }),
          novoItem({ servico: 'Y', estimado: 9000, status }),
          novoItem({ servico: 'Z', estimado: 6000, status }),
        ],
      },
    ]
    return ev
  }

  it('VERMELHO-ANTES/VERDE-DEPOIS: itens em status NOVO contam no total (a linha do Orçamento aparece)', () => {
    // No código antigo, itens ESTIMADO caíam fora da lista cravada → total 0 →
    // `if (total > 0)` falso → a linha "Orçamento:" sumia. No conserto agnóstico,
    // total = 30.000 → a linha aparece. Este expect FALHA no código antigo.
    expect(resumoCompleto(eventoCom('ESTIMADO'))).toContain('Orçamento:')
  })

  it('trocar o status de qualquer item NÃO move um centavo do total', () => {
    const totalDe = (ev) => Object.values(custosPorStatus(ev.categorias)).reduce((s, v) => s + v, 0)
    const base = totalDe(eventoCom('ESTIMADO'))
    expect(base).toBe(30000)
    for (const st of STATUS_CUSTO_IDS) expect(totalDe(eventoCom(st))).toBe(base)
    // status MISTO (cada item um diferente) — idem invariante
    const misto = eventoCom('ESTIMADO')
    misto.categorias[0].itens[0].status = 'PAGO'
    misto.categorias[0].itens[1].status = 'NEGOCIAR'
    misto.categorias[0].itens[2].status = 'TBI'
    expect(totalDe(misto)).toBe(base)
  })
})

describe('o resumo do WhatsApp e a festa que não fecha (regressão achada em 27/07/2026)', () => {
  // ESTE BLOCO EXISTE POR CAUSA DE UM DEFEITO QUE O PRÓPRIO TRABALHO DO
  // BREAK-EVEN CAUSOU, e que NENHUM teste pegou — quem pegou foi um revisor
  // cético, medindo lado a lado. O ritmo de vendas aparece em CINCO lugares;
  // quatro receberam a chave `breakEvenNaoFecha` e o quinto (este, o texto
  // colado no WhatsApp) ficou de fora. Com o break-even virando null, o
  // `if (!frase) return null` engolia a linha inteira.
  const festaQueNaoFecha = (data) => ({
    ...novoEvento('Festa que não fecha'),
    data,
    publicoEstimado: 200,
    vendidosAteHoje: 30,
    lotes: [{ id: 'l1', nome: 'Único', valor: 50, quantidade: 200 }],
    outrasReceitas: { bar: 8000 },
    categorias: [
      { id: 'aeb', nome: 'A&B', padrao: true, itens: [novoItem({ servico: 'Bar', estimado: 17300 })] },
    ],
  })

  it('festa JÁ REALIZADA que não fecha continua dizendo que já aconteceu', () => {
    const t = resumoCompleto(festaQueNaoFecha('2026-01-10'), { hoje: '2026-07-27' })
    expect(t).toMatch(/já realizado/i)
  })

  it('festa FUTURA que não fecha diz que não há ritmo — em vez de sumir com a linha', () => {
    const t = resumoCompleto(festaQueNaoFecha('2026-12-31'), { hoje: '2026-07-27' })
    expect(t).toMatch(/não sai do prejuízo nem vendendo tudo/i)
  })

  it('o resumo não se contradiz: se os números-chave dizem que não fecha, o ritmo não cala', () => {
    // Era a contradição medida: os números-chave diziam "não fecha nem vendendo
    // tudo" e a linha do ritmo simplesmente não existia, no MESMO texto colado.
    const t = resumoCompleto(festaQueNaoFecha('2026-12-31'), { hoje: '2026-07-27' })
    if (/não fecha nem vendendo tudo/i.test(t)) {
      expect(t).toMatch(/não sai do prejuízo nem vendendo tudo|já realizado/i)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A DATA QUE NÃO É UMA DATA — o "0/dia" com 613 ingressos faltando
//
// Medido em 30/08/2026, antes de mexer numa linha. `evento.data` é a única data
// do app que não passa por camada nenhuma (`migracao.js`: `sobrevive` devolve
// sempre `true` para o campo 'data'), então um backup editado à mão pode trazer
// '05/12/2026' — o formato brasileiro que a própria tela imprime — ou qualquer
// texto. `ritmoVendas` faz `new Date('05/12/2026T12:00:00')`, que é Invalid
// Date, e devolve dias/semanas = NaN.
//
// O que as telas diziam, com 613 ingressos faltando para o break-even:
//
//   data = "abacaxi"     → Home "Faltam 613 p/ break-even · 0/dia"
//   data = "05/12/2026"  → Home "Faltam 613 p/ break-even · 0/dia"
//   data = "2026-12-05"  → Home "Faltam 613 p/ break-even · 7/dia"   (certo)
//
// O vazamento era a porta `if (diasVenda < 1) return null` de `ritmoPorDia`:
// `NaN < 1` é **false**, então o `null` nunca acontecia, e `fmtInt(NaN)` vira
// "0". Zero ingressos por dia é a tela afirmando que não falta vender nada.
// ─────────────────────────────────────────────────────────────────────────────
describe('a data da festa que não é uma data (achado S1, 30/08/2026)', () => {
  const HOJE = '2026-08-30'
  const BREAK_EVEN = 700
  const VENDIDOS = 87 // faltam 613
  const ritmoDe = (data) =>
    ritmoVendas({ vendidos: VENDIDOS, dataEvento: data, breakEven: BREAK_EVEN, hoje: HOJE })

  it('as quatro datas medidas: só a ISO produz ritmo, e nenhuma outra produz número', () => {
    // 'abacaxi' e '05/12/2026' viram NaN lá no calc — a premissa deste teste,
    // afirmada e não suposta: se um dia calc.js travar na origem, este
    // expect cai e alguém vem aqui apagar a camada de exibição.
    expect(Number.isFinite(ritmoDe('abacaxi').dias)).toBe(false)
    expect(Number.isFinite(ritmoDe('05/12/2026').dias)).toBe(false)

    expect(ritmoPorDia(ritmoDe('abacaxi'))).toBeNull()
    expect(ritmoPorDia(ritmoDe('05/12/2026'))).toBeNull()
    // a data boa segue exatamente como estava: 613 em 97 dias = 7 por dia
    expect(ritmoPorDia(ritmoDe('2026-12-05'))).toEqual({ diasVenda: 97, porDia: 7 })
    // data vazia nunca chegou aqui — `ritmoVendas` já devolve null antes
    expect(ritmoDe('')).toBeNull()
  })

  it('as cinco superfícies dizem o problema em vez de mostrar "0"', () => {
    for (const data of ['abacaxi', '05/12/2026', '31/02/2026', '2026-13-45']) {
      const r = ritmoDe(data)
      const evento = { nome: 'Brisa', data, vendidosAteHoje: VENDIDOS }
      expect(dataDoEventoIlegivel(r)).toBe(true)
      // card / WhatsApp
      expect(fraseRitmo(r)).toBe(DATA_DO_EVENTO_ILEGIVEL)
      // relatório / PDF
      expect(linhaRitmoRelatorio(evento, BREAK_EVEN, HOJE)).toContain(DATA_DO_EVENTO_ILEGIVEL)
      // e nenhuma delas imprime número de ritmo nenhum
      expect(fraseRitmo(r)).not.toMatch(/por dia/)
      expect(fraseRitmo(r)).not.toMatch(/\bdia\(s\) de venda\b/)
    }
  })

  it('o "coberto" também não inventa "a 0 dia(s) da festa"', () => {
    // faltam ≤ 0 não depende da data, então `cobriu` liga mesmo com data
    // ilegível — e a frase de lá imprime `${fmtInt(r.dias)} dia(s) da festa`.
    const r = ritmoVendas({ vendidos: 900, dataEvento: 'abacaxi', breakEven: BREAK_EVEN, hoje: HOJE })
    expect(r.cobriu).toBe(true)
    expect(fraseRitmo(r)).toBe(DATA_DO_EVENTO_ILEGIVEL)
    expect(fraseRitmo(r)).not.toMatch(/0 dia/)
  })

  it('a festa que JÁ ACONTECEU continua com a marcação dela, não com a da data', () => {
    // `ritmoVendas` devolve { eventoPassado: true } — objeto de uma chave, sem
    // `dias`. Sem a ordem certa, a marcação de realizada viraria "data inválida".
    const r = ritmoVendas({ vendidos: VENDIDOS, dataEvento: '2026-01-10', breakEven: BREAK_EVEN, hoje: HOJE })
    expect(r).toEqual({ eventoPassado: true })
    expect(dataDoEventoIlegivel(r)).toBe(false)
    expect(fraseRitmo(r)).not.toBe(DATA_DO_EVENTO_ILEGIVEL)
  })

  it('a data BOA não mudou em nada — o conserto não encostou no caminho normal', () => {
    const r = ritmoDe('2026-12-05')
    expect(dataDoEventoIlegivel(r)).toBe(false)
    expect(fraseRitmo(r)).toBe(
      'Faltam 613 ingressos em 97 dia(s) de venda → precisa vender 7 por dia para cobrir o break-even (700).'
    )
  })
})

// ————— DADO QUEBRADO NO WHATSAPP (2ª revisão do PR #98, 05/10/2026) —————
// Antes: "*Inviável como está.* … margem realista 0%", "Lucro: pessimista R$ 0
// · realista R$ 0 · otimista R$ 0", "Resultado real: R$ 0" na festa fechada e
// "Orçamento: R$ 0 de R$ 100.000…000 mi (0%)". Precondição: um custo em 1e308;
// `fmtCompact`/`fmtBRL` passam por `num()`, que devolve 0 para o infinito.
// Decisão do Marco, 26/07/2026: a tela DIZ, não imprime número derivado de lixo.
describe('resumo de festa com custo que não cabe numa conta de dinheiro', () => {
  const quebrada = () => {
    const e = novoEvento('Brisa quebrada')
    e.data = '2026-12-05'
    e.lotes = [novoLote({ nome: 'L', valor: 100, quantidade: 200 })]
    e.categorias = [
      { id: 'estrutura', nome: 'Estrutura', padrao: false, itens: [novoItem({ servico: 'Som e luz', estimado: 1e308 })] },
    ]
    e.receitaRealizada = { bilheteria: 20000, bar: '' }
    return e
  }
  // o número colado ao rótulo (a receita que vem depois do travessão é dinheiro
  // de verdade e fica)
  const SEM_NUMERO_DE_LIXO =
    /(lucro:? (pessimista |\*?realista |otimista )?R\$|margem( realista)? -?\d|Resultado real: R\$|Orçamento: R\$|\b(pessimista|realista|otimista)\*? R\$)/i

  it('curto: linha no topo, sem veredito, e nenhum lucro ou margem em número', () => {
    const t = resumoCurto(quebrada())
    const linhas = t.split('\n')
    expect(linhas[1]).toContain('Esta festa tem um custo que o app não consegue calcular (“Som e luz”)')
    expect(t).toContain(FRASE_VEREDITO_QUEBRADO)
    expect(t).not.toContain('Inviável')
    expect(t).not.toMatch(/[🟢🟡🔴]/u)
    expect(t).not.toMatch(SEM_NUMERO_DE_LIXO)
    expect(t).toContain(`*realista ${NUMERO_NAO_CALCULA}*`)
  })

  it('completo: cenários e orçamento sem número de lixo, nem o de centenas de dígitos', () => {
    const t = resumoCompleto(quebrada())
    expect(t).not.toMatch(SEM_NUMERO_DE_LIXO)
    expect(t).not.toMatch(/R\$ ?[\d.]{40,}/)
    expect(t).toContain(`Orçamento: % fechado ${NUMERO_NAO_CALCULA}`)
    expect(t).toContain(`Realista: lucro ${NUMERO_NAO_CALCULA}`)
  })

  it('festa FECHADA com a foto quebrada: "Resultado real: não dá para calcular", sem 🟢', () => {
    const f = JSON.parse(JSON.stringify(fecharEvento(quebrada(), '2026-10-05T12:00:00.000Z')))
    const t = resumoCurto(f)
    expect(t).toContain(`Resultado real: ${NUMERO_NAO_CALCULA}`)
    expect(t).not.toContain('🟢')
    expect(t).not.toMatch(/Resultado real: R\$/)
  })

  it('CONTRAPROVA: a festa sã sai com o veredito e os números de sempre, sem a linha de aviso', () => {
    const e = quebrada()
    e.categorias[0].itens[0].estimado = 12000
    const t = resumoCurto(e)
    expect(t).not.toContain('não consegue calcular')
    expect(t).not.toContain(NUMERO_NAO_CALCULA)
    expect(t).toMatch(/Lucro: pessimista R\$/)
  })
})
