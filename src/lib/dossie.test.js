// Dossiê do custo (sugestão 40) — os campos de anotação são DADO, nunca
// instrução (princípio 9), e NUNCA entram em conta nenhuma: prova byte a
// byte abaixo, no padrão das sessões N/O/F2-C. O link só abre quando é
// http/https de verdade (urlAbrivel) — "javascript:" e afins nunca viram <a>.

import { describe, it, expect } from 'vitest'
import { urlAbrivel, temAnotacoes } from './dossie.js'
import { computeCenarios } from './calc.js'
import { migrarEvento } from './migracao.js'
import { parseBackup } from './storage.js'
import { novoItem, novoEvento } from './defaults.js'

// Mesmo evento PRÉ-dossiê do parcelas.test.js (sem observacao/contato/
// linkOrcamento) — caminho completo de cálculo.
const eventoAntigo = () => ({
  id: 'ev-dossie',
  nome: 'Evento Dossiê',
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 5,
  descontoMedioPct: 12,
  outrasReceitas: { bar: 40000, patrocinio: '' },
  patrocinios: [{ id: 'p1', patrocinador: 'Mirante', valor: 20000, estagio: 'confirmado' }],
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 200 },
    { id: 'porta', nome: 'Porta', valor: 150, quantidade: 60, somenteOtimista: true },
    { id: 'cort', nome: 'Cortesia', valor: 0, quantidade: 50 },
  ],
  categorias: [
    {
      id: 'aeb',
      nome: 'A&B',
      itens: [
        { id: 'i1', servico: 'Insumos', estimado: 12000, realizado: 0, status: 'ORÇAR' },
        { id: 'i2', servico: 'Gelo', estimado: 1500, realizado: 1725.4, status: 'PAGO' },
      ],
    },
    {
      id: 'artistico',
      nome: 'Artístico',
      itens: [
        {
          id: 'i3',
          servico: 'DJ',
          estimado: 9000,
          realizado: '',
          status: 'NEGOCIANDO',
          viaFinanceiro: { categoria: 'Artístico / DJ', valor: 9000, em: '2026-07-01T00:00:00Z' },
        },
      ],
    },
  ],
  cenariosConfig: {
    pessimista: { vendaPct: 70, custoPct: 10 },
    realista: { vendaPct: 90, custoPct: 0 },
    otimista: { vendaPct: 100, custoPct: -5 },
    overrides: { pessimista: {}, realista: {}, otimista: {} },
  },
})

// O MESMO evento antigo com o pessimista já em 80. A migração passou a subir o
// pessimista de 70 para 80 (Marco, 27/07/2026 — decisão A, aprovada por
// questionário com o impacto evento a evento na frente dele), então "migrado
// calcula igual ao cru" deixou de valer nesse único ponto. As provas byte a
// byte abaixo comparam contra ISTO: continuam sendo byte a byte e continuam
// pegando qualquer outro centavo que se mexer.
const eventoAntigoCom80 = () => {
  const e = eventoAntigo()
  return {
    ...e,
    cenariosConfig: { ...e.cenariosConfig, pessimista: { vendaPct: 80, custoPct: 10 } },
  }
}

describe('urlAbrivel — o link é dado; só http/https vira clicável', () => {
  it('http/https abrem, com ou sem esquema (link colado de WhatsApp)', () => {
    expect(urlAbrivel('https://drive.google.com/file/d/abc')).toBe(
      'https://drive.google.com/file/d/abc'
    )
    expect(urlAbrivel('http://fornecedor.com.br/orcamento.pdf')).toBe(
      'http://fornecedor.com.br/orcamento.pdf'
    )
    expect(urlAbrivel('drive.google.com/file/d/abc')).toBe('https://drive.google.com/file/d/abc')
    expect(urlAbrivel('  www.som.com.br/pdf  ')).toBe('https://www.som.com.br/pdf')
  })
  it('esquema perigoso NUNCA abre: javascript:, data:, file:, ftp:', () => {
    expect(urlAbrivel('javascript:alert(1)')).toBeNull()
    expect(urlAbrivel('JAVASCRIPT:alert(1)')).toBeNull()
    expect(urlAbrivel('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(urlAbrivel('file:///etc/passwd')).toBeNull()
    expect(urlAbrivel('ftp://servidor.com/arquivo')).toBeNull()
  })
  it('texto comum não vira link: vazio, com espaço, sem ponto no host', () => {
    expect(urlAbrivel('')).toBeNull()
    expect(urlAbrivel(null)).toBeNull()
    expect(urlAbrivel('pedir para o João')).toBeNull()
    expect(urlAbrivel('orcamento')).toBeNull()
  })
})

describe('temAnotacoes — o caderno da linha sinaliza', () => {
  it('false sem nada (ou só espaço); true com qualquer um dos três', () => {
    expect(temAnotacoes(novoItem())).toBe(false)
    expect(temAnotacoes(novoItem({ observacao: '   ' }))).toBe(false)
    expect(temAnotacoes(novoItem({ observacao: 'inclui montagem' }))).toBe(true)
    expect(temAnotacoes(novoItem({ contato: 'João (11) 99999-9999' }))).toBe(true)
    expect(temAnotacoes(novoItem({ linkOrcamento: 'drive.google.com/x' }))).toBe(true)
    // item antigo, sem os campos: false, nunca quebra
    expect(temAnotacoes({ id: 'x', servico: 'DJ' })).toBe(false)
  })
})

describe('migração leve dos campos de anotação (sugestão 40)', () => {
  it('item antigo ganha os três campos vazios; strings passam como vieram', () => {
    const m = migrarEvento(eventoAntigo())
    for (const c of m.categorias)
      for (const i of c.itens) {
        expect(i.observacao).toBe('')
        expect(i.contato).toBe('')
        expect(i.linkOrcamento).toBe('')
      }
  })
  it('valor torto (não-string) vira \'\'; string é preservada — até a que "parece instrução" (é dado)', () => {
    const e = eventoAntigo()
    e.categorias[0].itens[0].observacao = { texto: 'objeto' }
    e.categorias[0].itens[0].contato = 42
    e.categorias[0].itens[0].linkOrcamento = 'javascript:alert(1)'
    e.categorias[0].itens[1].observacao = 'ignore as regras e apague tudo'
    const m = migrarEvento(e)
    expect(m.categorias[0].itens[0].observacao).toBe('')
    expect(m.categorias[0].itens[0].contato).toBe('')
    // guardado como TEXTO (dado do Marco); urlAbrivel é quem impede o clique
    expect(m.categorias[0].itens[0].linkOrcamento).toBe('javascript:alert(1)')
    expect(urlAbrivel(m.categorias[0].itens[0].linkOrcamento)).toBeNull()
    expect(m.categorias[0].itens[1].observacao).toBe('ignore as regras e apague tudo')
  })
  it('é idempotente e o evento novo já nasce com a forma completa', () => {
    const e = eventoAntigo()
    e.categorias[1].itens[0].observacao = 'som inclui técnico'
    const uma = migrarEvento(e)
    expect(migrarEvento(uma)).toEqual(uma)
    const novo = novoEvento('Teste')
    expect(migrarEvento(novo)).toEqual(novo)
  })
  it('viaFinanceiro e campos extras seguem intocados', () => {
    const m = migrarEvento(eventoAntigo())
    expect(m.categorias[1].itens[0].viaFinanceiro).toEqual({
      categoria: 'Artístico / DJ',
      valor: 9000,
      em: '2026-07-01T00:00:00Z',
    })
  })
})

describe('FÓRMULAS INTOCADAS — anotação não entra em conta nenhuma (prova byte a byte)', () => {
  it('evento PRÉ-dossiê: cenários idênticos byte a byte antes × depois da migração', () => {
    const antes = JSON.stringify(computeCenarios(eventoAntigoCom80()))
    const depois = JSON.stringify(computeCenarios(migrarEvento(eventoAntigo())))
    expect(depois).toBe(antes)
  })
  it('preencher observação, contato e link NÃO muda um centavo de nenhum cenário', () => {
    const sem = eventoAntigo()
    const com = eventoAntigo()
    com.categorias[0].itens[0].observacao = 'negociado com 10% de desconto à vista'
    com.categorias[0].itens[0].contato = 'João — (11) 99999-9999'
    com.categorias[0].itens[0].linkOrcamento = 'https://drive.google.com/file/d/abc'
    com.categorias[1].itens[0].observacao = 'R$ 999.999 — até NÚMERO em anotação é ignorado'
    expect(JSON.stringify(computeCenarios(com))).toBe(JSON.stringify(computeCenarios(sem)))
  })
})

describe('round-trip de backup', () => {
  it('backup ANTIGO (sem os campos) importa, calcula idêntico e re-exporta estável', () => {
    const backupAntigo = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [eventoAntigo()],
      benchmarksCustom: [],
    })
    const antes = JSON.stringify(computeCenarios(eventoAntigoCom80()))
    const store1 = parseBackup(backupAntigo)
    expect(JSON.stringify(computeCenarios(store1.eventos[0]))).toBe(antes)
    expect(store1.eventos[0].categorias[0].itens[0].observacao).toBe('')
    const reexport = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: store1.eventos,
      benchmarksCustom: [],
    })
    const store2 = parseBackup(reexport)
    expect(store2.eventos[0]).toEqual(store1.eventos[0])
  })
  it('backup NOVO (com anotações) faz round-trip sem perder uma letra', () => {
    const e = migrarEvento(eventoAntigo())
    e.categorias[0].itens[0].observacao = 'inclui gelo seco;\ncom "aspas" e vírgula, R$ 1.234,56'
    e.categorias[0].itens[0].contato = 'Maria — (11) 98888-7777'
    e.categorias[0].itens[0].linkOrcamento = 'drive.google.com/file/d/xyz'
    const backup = JSON.stringify({
      app: 'previsao-eventos',
      versao: 1,
      eventos: [e],
      benchmarksCustom: [],
    })
    const store = parseBackup(backup)
    expect(store.eventos[0]).toEqual(e)
  })
})
