import test from 'node:test'
import assert from 'node:assert/strict'
import { conferirFragmentacao } from './conferirFragmentacao.mjs'

const cabecalho = 'Referências 1–4 de 4 Categoria S5 relatório (previsão) 900 pessoas ' +
  [1, 2, 3, 4].map(i => `Referência sintética ${i} — sem reserva`).join(' ')
const linhas = (de, ate) => Array.from({ length: ate - de + 1 }, (_, i) =>
  `Linha L${String(de + i).padStart(3, '0')} R$ 5.000 R$ 10.000`).join('\n')
const paginas = () => [cabecalho + '\n' + linhas(1, 37), cabecalho + '\n' + linhas(38, 72) + '\nCusto total R$ 39.462']

test('controle: cabeçalho completo nas duas páginas, 72 linhas e total único', () => {
  assert.deepEqual(conferirFragmentacao(paginas(), cabecalho).falhas, [])
})
for (const [nome, tirar] of [
  ['público', '900 pessoas'], ['etiqueta de uma referência', 'sem reserva'],
  ['nome da primeira referência', 'Referência sintética 1'],
  ['nome da referência intermediária', 'Referência sintética 3'],
  ['previsão', '(previsão)'], ['Categoria', 'Categoria'],
]) test(`recusa continuação sem ${nome}`, () => {
  const p = paginas(); p[1] = p[1].replace(tirar, '')
  assert(conferirFragmentacao(p, cabecalho).falhas.some(f => f.startsWith('Página 2:')))
})
test('recusa linha omitida e total repetido', () => {
  const p = paginas(); p[1] = p[1].replace('Linha L040', 'Linha removida'); p[0] += '\nCusto total R$ 39.462'
  const { falhas } = conferirFragmentacao(p, cabecalho)
  assert(falhas.some(f => f.includes('L040'))); assert(falhas.some(f => f.includes('Total repetido')))
})
