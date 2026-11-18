import { describe, it, expect } from 'vitest'
import {
  ITENS_CRITICOS,
  itensCriticosFaltando,
  itensDispensadosDoEvento,
  novoEvento,
} from './defaults.js'

describe('itensCriticosFaltando (carona da sugestão 2)', () => {
  it('evento novo (sem itens) acusa todos os críticos como faltando', () => {
    const ev = novoEvento()
    expect(itensCriticosFaltando(ev)).toEqual(ITENS_CRITICOS)
  })

  it('itens cadastrados (mesmo nome, outra caixa) somem da lista de faltantes', () => {
    const ev = {
      categorias: [
        { id: 'locacao', itens: [{ servico: 'alvará' }, { servico: 'Seguro ' }] },
        { id: 'estrutura', itens: [{ servico: 'AMBULÂNCIA' }] },
      ],
    }
    const faltando = itensCriticosFaltando(ev)
    expect(faltando).not.toContain('Alvará')
    expect(faltando).not.toContain('Seguro')
    expect(faltando).not.toContain('Ambulância')
    expect(faltando).toContain('ECAD')
    expect(faltando).toContain('Brigadista')
  })

  it('evento sem categorias não quebra', () => {
    expect(itensCriticosFaltando({})).toEqual(ITENS_CRITICOS)
    expect(itensCriticosFaltando(undefined)).toEqual(ITENS_CRITICOS)
  })
})

// Matching por palavra-chave (item 4, F2-W): "Seguro civil" cobre "Seguro" etc.
// SEM afrouxar a ponto de esconder aviso legítimo (o perigo oposto). Cada linha
// é um par: o nome cadastrado e o crítico que ele deve (ou NÃO deve) cobrir.
const faltaPara = (servico) =>
  itensCriticosFaltando({ categorias: [{ id: 'x', itens: [{ servico }] }] })

describe('itensCriticosFaltando — casa por palavra-chave', () => {
  it.each([
    ['Seguro civil', 'Seguro'],
    ['Seguros', 'Seguro'],
    ['Laudo AVCB', 'Engenharia / AVCB'],
    ['Engenharia de segurança', 'Engenharia / AVCB'],
    ['Brigada de incêndio', 'Brigadista'],
    ['Brigadista de plantão', 'Brigadista'],
    ['Alvará de funcionamento', 'Alvará'],
    ['CET - fechamento de via', 'CET'],
    ['Taxa CET', 'CET'],
    ['Ambulância UTI', 'Ambulância'],
    ['Ambulâncias (2)', 'Ambulância'],
    ['Gerador de energia', 'Gerador'],
    ['ECAD (direitos autorais)', 'ECAD'],
  ])('"%s" cobre o crítico "%s" (some do aviso)', (servico, critico) => {
    expect(faltaPara(servico)).not.toContain(critico)
  })
})

describe('itensCriticosFaltando — NÃO casa (aviso legítimo continua)', () => {
  it.each([
    ['Segurança', 'Seguro'], // equipe de segurança ≠ seguro civil
    ['Segurança patrimonial', 'Seguro'],
    ['Cenografia', 'CET'], // substring "ce" não pode casar CET
    ['Buffet', 'CET'],
    ['Gerência', 'Gerador'], // prefixo "ger" não basta
    ['DJ Fulano', 'Gerador'],
    ['Assessoria', 'ECAD'],
  ])('"%s" NÃO cobre "%s" (o aviso permanece)', (servico, critico) => {
    expect(faltaPara(servico)).toContain(critico)
  })

  it('item vazio/lixo não cobre nada — todos os críticos continuam faltando', () => {
    expect(faltaPara('')).toEqual(ITENS_CRITICOS)
    expect(faltaPara('   ')).toEqual(ITENS_CRITICOS)
    expect(faltaPara('!!!')).toEqual(ITENS_CRITICOS)
  })
})

describe('itensDispensados — "já incluso" (sugestão 37, F2-W)', () => {
  it('dispensar um crítico o tira do aviso, sem tocar os demais', () => {
    const ev = { categorias: [], itensDispensados: ['Alvará', 'CET'] }
    const faltando = itensCriticosFaltando(ev)
    expect(faltando).not.toContain('Alvará')
    expect(faltando).not.toContain('CET')
    expect(faltando).toContain('ECAD')
    expect(faltando).toContain('Gerador')
  })

  it('itensDispensadosDoEvento devolve só nomes críticos válidos (ignora lixo)', () => {
    const ev = { itensDispensados: ['Alvará', 'lixo qualquer', 'CET'] }
    expect(itensDispensadosDoEvento(ev)).toEqual(['Alvará', 'CET'])
    expect(itensDispensadosDoEvento({})).toEqual([])
    expect(itensDispensadosDoEvento(undefined)).toEqual([])
  })

  it('evento novo nasce sem dispensados (aviso completo)', () => {
    const ev = novoEvento()
    expect(ev.itensDispensados).toEqual([])
    expect(itensDispensadosDoEvento(ev)).toEqual([])
  })
})
