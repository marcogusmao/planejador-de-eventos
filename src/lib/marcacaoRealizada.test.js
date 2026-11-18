// TRAVA — "a festa já aconteceu" tem de sobreviver ao sair do card.
//
// O módulo ritmoVendas (calc.js — PORTÃO, não tocado) já sabe que a festa
// passou (`eventoPassado`) e o app já tem a frase pronta e testada para o caso
// (fraseRitmo, resumo.js:24). Quatro dos cinco consumidores jogavam a frase
// fora; só o card cheio da aba Cenários a mostrava. Resultado medido: o texto
// do WhatsApp e o PDF de uma festa PASSADA ficavam idênticos aos de uma festa
// FUTURA — sem nenhum vestígio de que a festa já foi.
//
// Este arquivo trava o conserto: nenhum NÚMERO muda, a frase é a que já
// existia, e evento FUTURO não ganha nada.
import { describe, it, expect } from 'vitest'
import { computeCenarios, ritmoVendas } from './calc.js'
import {
  resumoCurto,
  resumoCompleto,
  fraseRitmo,
  linhaRitmoRelatorio,
  MARCACAO_REALIZADA,
} from './resumo.js'
import { linhaRitmoHome } from '../components/RitmoVendas.jsx'
import { novoEvento, novoLote, novoItem } from './defaults.js'

const HOJE = '2026-07-20'
const lote = (nome, valor, quantidade) => novoLote({ nome, valor, quantidade })
const item = (servico, estimado) => novoItem({ servico, estimado, status: 'FECHADO' })
const cats = (mapa) => novoEvento('tmp').categorias.map((c) => ({ ...c, itens: mapa[c.id] || [] }))

// Festa construída para a medição — não são dados do Marco.
const base = {
  ...novoEvento('Brisa 14/03'),
  local: 'Casa Brisa',
  tipo: 'Brisa',
  publicoEstimado: 1000,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  barModo: 'fixo',
  outrasReceitas: { bar: 8000, patrocinio: '' },
  vendidosAteHoje: 420,
  lotes: [lote('Lote 1', 100, 400), lote('Lote 2', 100, 400), lote('Último Lote', 100, 200)],
  categorias: cats({
    artistico: [item('DJs', 15000)],
    estrutura: [item('Som e luz', 13000)],
    equipe: [item('Produção + segurança', 10000)],
  }),
}
const passada = { ...base, data: '2026-03-14' } // 4 meses ANTES de HOJE
const futura = { ...base, data: '2026-12-31' } // depois de HOJE

const beDe = (ev) => computeCenarios(ev).realista.breakEven

describe('a frase de "evento já realizado" existe e é a mesma em todo lugar', () => {
  it('ritmoVendas sabe, e a frase pronta é a de sempre', () => {
    const r = ritmoVendas({
      vendidos: passada.vendidosAteHoje,
      dataEvento: passada.data,
      breakEven: beDe(passada),
      hoje: HOJE,
    })
    expect(r).toEqual({ eventoPassado: true })
    expect(fraseRitmo(r)).toBe(MARCACAO_REALIZADA)
    expect(MARCACAO_REALIZADA).toBe(
      'Evento já realizado — o acompanhamento de vendas não se aplica.'
    )
  })
})

describe('festa PASSADA: as quatro superfícies dizem que a festa já aconteceu', () => {
  it('resumo curto (WhatsApp) carrega a marcação', () => {
    expect(resumoCurto(passada, { hoje: HOJE })).toContain(MARCACAO_REALIZADA)
  })

  it('resumo completo (WhatsApp) carrega a marcação', () => {
    expect(resumoCompleto(passada, { hoje: HOJE })).toContain(MARCACAO_REALIZADA)
  })

  it('relatório/PDF carrega a marcação, sem o prefixo "vendidos até hoje"', () => {
    const txt = linhaRitmoRelatorio(passada, beDe(passada), HOJE)
    expect(txt).toBe(MARCACAO_REALIZADA)
    expect(txt).not.toContain('vendidos até hoje')
  })

  it('card da Home carrega a marcação, em tom neutro (nem verde nem alerta)', () => {
    const l = linhaRitmoHome(passada, beDe(passada), HOJE)
    expect(l).not.toBeNull()
    expect(l.texto).toBe(MARCACAO_REALIZADA)
    expect(l.tom).toBe('neutro')
  })

  it('o texto da festa passada deixou de ser igual ao da festa futura', () => {
    expect(resumoCurto(passada, { hoje: HOJE })).not.toBe(resumoCurto(futura, { hoje: HOJE }))
  })
})

describe('festa FUTURA: nada mudou — a marcação só aparece depois da festa', () => {
  it('nenhuma superfície ganha a marcação', () => {
    expect(resumoCurto(futura, { hoje: HOJE })).not.toContain('já realizado')
    expect(resumoCompleto(futura, { hoje: HOJE })).not.toContain('já realizado')
    expect(linhaRitmoRelatorio(futura, beDe(futura), HOJE)).not.toContain('já realizado')
    expect(linhaRitmoHome(futura, beDe(futura), HOJE).tom).not.toBe('neutro')
  })

  it('a linha de ritmo da festa futura continua idêntica', () => {
    const linhas = resumoCurto(futura, { hoje: HOJE }).split('\n')
    expect(linhas[linhas.length - 1]).toContain('Vendidos até hoje: 420.')
  })
})
