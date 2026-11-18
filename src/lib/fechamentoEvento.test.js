// Fechamento de EVENTO (Parte 2 — 20/07/2026): fechar CONGELA os números já
// computados (padrão do benchmark), reabrir descarta a foto, e o portão de
// fechar é o mesmo do benchmark (bilheteria realizada informada). Estes testes
// travam as decisões do Marco — a foto NUNCA é recalculada na leitura.

import { describe, it, expect } from 'vitest'
import {
  eventoFechado,
  montarFotoFechamento,
  fecharEvento,
  reabrirEvento,
  carimbarBenchmark,
  MOTIVO_NAO_FECHA,
} from './fechamentoEvento.js'
import { resultadoRealizado } from './fechamento.js'
import { computeCenarios } from './calc.js'
import { novoEvento, novoItem } from './defaults.js'
import { clone } from './util.js'

const eventoComRealizado = () => {
  const e = novoEvento('Brisa 14/03')
  e.data = '2026-03-14'
  e.publicoEstimado = 1000
  e.receitaRealizada = { bilheteria: 186420, bar: 22500 }
  e.outrasReceitas = { bar: 20000, patrocinio: '' }
  e.patrocinios = [{ id: 'p1', patrocinador: 'Marca X', valor: 5000, estagio: 'confirmado' }]
  e.categorias = [
    {
      id: 'aeb',
      nome: 'A&B',
      padrao: true,
      itens: [
        novoItem({ servico: 'Gelo', estimado: 1000, realizado: 1300, status: 'PAGO' }),
        novoItem({ servico: 'Copos', estimado: 500, realizado: '', status: 'FECHADO' }),
      ],
    },
  ]
  return e
}

const QUANDO = '2026-07-20T21:00:00.000Z'

describe('fecharEvento — a foto congela os números do momento', () => {
  it('fecha: status, carimbo e foto com a MESMA conta do card "Resultado realizado"', () => {
    const e = eventoComRealizado()
    const cardAntes = resultadoRealizado(e, computeCenarios(e).realista)
    const fechado = fecharEvento(e, QUANDO)
    expect(fechado).not.toBeNull()
    expect(fechado.status).toBe('fechado')
    expect(eventoFechado(fechado)).toBe(true)
    expect(fechado.fechamento.em).toBe(QUANDO)
    // A foto é a saída do portão (fechamento.js), byte a byte — nenhuma conta
    // paralela: mesma fonte única de toda superfície de realizado.
    expect(fechado.fechamento.foto.resultado).toEqual(cardAntes)
    expect(fechado.fechamento.foto.resultado.completo).toBe(false) // 1 item pendente
    expect(fechado.fechamento.foto.resultado.nSemRealizado).toBe(1)
  })

  it('é pura: não muta o evento original', () => {
    const e = eventoComRealizado()
    const congelado = clone(e)
    fecharEvento(e, QUANDO)
    expect(e).toEqual(congelado)
  })

  it('CONGELAMENTO: mudar o evento depois NÃO muda a foto (fato histórico)', () => {
    const e = eventoComRealizado()
    const fechado = fecharEvento(e, QUANDO)
    const fotoAntes = clone(fechado.fechamento.foto)
    // a edição ativa muda (ponte re-puxada, digitação em aba antiga…)
    fechado.categorias[0].itens[1].realizado = 9999
    fechado.receitaRealizada.bilheteria = 1
    expect(fechado.fechamento.foto).toEqual(fotoAntes)
    // e a foto sobrevive ao round-trip JSON do backup sem perder nada
    expect(JSON.parse(JSON.stringify(fotoAntes))).toEqual(fotoAntes)
  })

  it('recusa sem bilheteria realizada — mesmo com bar realizado informado', () => {
    const e = eventoComRealizado()
    e.receitaRealizada = { bilheteria: '', bar: 22500 }
    expect(montarFotoFechamento(e)).toBeNull()
    expect(fecharEvento(e, QUANDO)).toBeNull()
    expect(MOTIVO_NAO_FECHA).toMatch(/bilheteria realizada/i)
  })

  // REGRA NOVA (Marco, 25/07/2026, aprovada e datada — `temValor` em
  // fechamento.js deixou de exigir `> 0`): bilheteria realizada EXATAMENTE 0
  // agora É "informada" e fecha o evento — festa de graça existe, e uma
  // festa que vendeu zero ingresso mas teve bar/patrocínio tem resultado
  // real para congelar. Antes desta data, 0 caía na MESMA recusa do teste
  // acima (a régua tratava 0 como "não preenchido"); a tela ganhou uma
  // confirmação extra (FechamentoTab.jsx/confirmarFechar) para esse caso
  // específico, exatamente porque o portão aqui deixou de barrar.
  it('bilheteria realizada 0 PASSA a fechar — não é mais "não preenchido"', () => {
    const e = eventoComRealizado()
    e.receitaRealizada = { bilheteria: 0, bar: 22500 }
    const fechado = fecharEvento(e, QUANDO)
    expect(fechado).not.toBeNull()
    expect(fechado.status).toBe('fechado')
    expect(fechado.fechamento.foto.resultado.bilheteriaInformada).toBe(true)
    expect(fechado.fechamento.foto.resultado.bilheteriaBruta).toBe(0)
  })

  it('evento já fechado não fecha de novo (null — a foto de antes fica)', () => {
    const fechado = fecharEvento(eventoComRealizado(), QUANDO)
    expect(fecharEvento(fechado, '2026-07-21T10:00:00.000Z')).toBeNull()
  })
})

describe('reabrirEvento — a foto é descartada, o invariante fica de pé', () => {
  it('reabre: status aberto e fechamento null', () => {
    const fechado = fecharEvento(eventoComRealizado(), QUANDO)
    const reaberto = reabrirEvento(fechado)
    expect(reaberto.status).toBe('aberto')
    expect(reaberto.fechamento).toBeNull()
    expect(eventoFechado(reaberto)).toBe(false)
  })

  it('reabrir e fechar de novo tira OUTRA foto, dos números de agora', () => {
    const e = eventoComRealizado()
    const f1 = fecharEvento(e, QUANDO)
    const reaberto = reabrirEvento(f1)
    reaberto.receitaRealizada = { ...reaberto.receitaRealizada, bilheteria: 150000 }
    const f2 = fecharEvento(reaberto, '2026-07-22T10:00:00.000Z')
    expect(f2.fechamento.foto.resultado.bilheteriaBruta).toBe(150000)
    expect(f1.fechamento.foto.resultado.bilheteriaBruta).toBe(186420)
  })

  it('evento aberto reabre como está (mesma referência, nada muda)', () => {
    const e = eventoComRealizado()
    expect(reabrirEvento(e)).toBe(e)
  })
})

describe('carimbarBenchmark — o vínculo do selo', () => {
  it('grava o id no fechamento de um evento fechado', () => {
    const fechado = fecharEvento(eventoComRealizado(), QUANDO)
    const carimbado = carimbarBenchmark(fechado, 'bm-1')
    expect(carimbado.fechamento.benchmarkId).toBe('bm-1')
    expect(carimbado.fechamento.foto).toEqual(fechado.fechamento.foto)
  })

  it('em evento aberto ou com id inválido, devolve o evento como está', () => {
    const aberto = eventoComRealizado()
    expect(carimbarBenchmark(aberto, 'bm-1')).toBe(aberto)
    const fechado = fecharEvento(eventoComRealizado(), QUANDO)
    expect(carimbarBenchmark(fechado, '')).toBe(fechado)
    expect(carimbarBenchmark(fechado, 42)).toBe(fechado)
  })
})

describe('S4 origem realizada antes de fotografar',()=>{
 const e=bar=>({...novoEvento('S4 sintético'),barModo:'fixo',outrasReceitas:{bar:0},taxaBilheteria:0,cashbackPct:0,receitaRealizada:{bilheteria:20000,bar},categorias:[{id:'aeb',itens:[{id:'c',estimado:20800,realizado:20800}]}]})
 for(const bar of ['14.200,00',{},[],true,Infinity])it(`bar ilegível ${JSON.stringify(bar)} não cria foto -800`,()=>{expect(montarFotoFechamento(e(bar))).toBeNull();expect(fecharEvento(e(bar),'2026-10-06T10:00:00Z')).toBeNull()})
 for(const [bar,total] of [[-2000,-2800],[14200,13400],[0,-800],['',-800],['14200',13400]])it(`bar válido ${bar} fotografa ${total}`,()=>{const f=montarFotoFechamento(e(bar));expect(f.resultado.resultado).toBe(total);expect(f.resultado).toEqual(JSON.parse(JSON.stringify(resultadoRealizado(e(bar),computeCenarios(e(bar)).realista))))})
 for(const campo of ['bilheteria','pix'])it(`open bar não libera ${campo} ilegível`,()=>{const ev={...e('14.200,00'),openBar:true};ev.receitaRealizada[campo]='14.200,00';expect(montarFotoFechamento(ev)).toBeNull()})
 it('open bar exclui bar bruto inválido e preserva original',()=>{const ev={...e('14.200,00'),openBar:true};const f=fecharEvento(ev,'2026-10-06T10:00:00Z');expect(f.receitaRealizada.bar).toBe('14.200,00');expect(f.fechamento.foto.resultado.resultado).toBe(-800);expect(f.fechamento.foto.receita.linhas.some(l=>l.nome==='Bar (lucro líquido)')).toBe(false)})
})

it('S4 JSON literal 1e999 em bar cru não cria fotografia',()=>{const e=eventoComRealizado();e.receitaRealizada.bar=JSON.parse('{"bar":1e999}').bar;expect(montarFotoFechamento(e)).toBeNull()})
