// CSV do plano com quebra de linha dentro de um campo (S2, Marco aprovou em
// 07/10/2026). Um \r solto vindo de célula de planilha saía sem aspas, e o
// leitor do Financeiro (csv.reader do Python) recusava o plano INTEIRO com
// "new-line character seen in unquoted field". Este teste lê o arquivo pela
// regra RFC 4180 — a mesma do csv.reader — e exige que nenhum campo quebre.
import { describe, it, expect } from 'vitest'
import { montarItensPlano, gerarCSVPlano } from './planoFinanceiro.js'
import { novoEvento, novoLote, novoItem, TIPOS_PADRAO } from './defaults.js'

function festa(servicos) {
  const e = novoEvento('Festa CSV')
  e.tipo = TIPOS_PADRAO[0]
  e.data = '2027-01-01'
  e.lotes = [novoLote({ id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 100 })]
  e.categorias = e.categorias.map((c) => ({
    ...c,
    itens: c.id === 'aeb' ? servicos.map((s, i) => novoItem({ id: `i${i}`, estimado: 100 + i, servico: s })) : [],
  }))
  return e
}

const csvDe = (e) => gerarCSVPlano(montarItensPlano(e).itens, e)

// Leitor RFC 4180 estrito, como o csv.reader: quebra de linha fora de aspas que
// não seja o fim de registro \r\n é ERRO (o Python lança "new-line character
// seen in unquoted field").
function lerCSV(texto) {
  const linhas = []
  let campo = ''
  let linha = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"' && campo === '') aspas = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\r' && texto[i + 1] === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; i++ }
    else if (c === '\r' || c === '\n') throw new Error(`quebra de linha fora de aspas na posição ${i}`)
    else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

describe('CSV do plano com quebra de linha num campo', () => {
  it('\\r solto e \\r\\n dentro da descrição: o arquivo inteiro abre, 8 colunas por linha, texto preservado', () => {
    const linhas = lerCSV(csvDe(festa(['Buffet\rsegunda linha', 'Gelo\r\nduas', 'Copo\nnovo'])))
    expect(linhas.every((l) => l.length === 8)).toBe(true)
    const descricoes = linhas.slice(1).map((l) => l[5])
    expect(descricoes).toEqual(expect.arrayContaining(['Buffet\rsegunda linha', 'Gelo\r\nduas', 'Copo\nnovo']))
  })

  it('sem quebra de linha, o campo continua sem aspas (arquivo igual ao de antes)', () => {
    const csv = csvDe(festa(['Bar', 'A, B']))
    expect(csv).toContain(',Bar,')
    expect(csv).toContain(',"A, B",')
    expect(lerCSV(csv).every((l) => l.length === 8)).toBe(true)
  })

  it('controle do leitor: um \\r fora de aspas é acusado (o instrumento enxerga o defeito)', () => {
    expect(() => lerCSV('a,b\r\nc\rd,e\r\n')).toThrow(/fora de aspas/)
  })
})
