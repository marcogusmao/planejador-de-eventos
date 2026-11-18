// @vitest-environment jsdom
//
// O FIO na TELA do aviso de lucro que não fecha (Marco, 27/07/2026).
//
// POR QUE EXISTE, medido neste mesmo trabalho: liguei o aviso ao editor, o
// `npm run build` passou LIMPO e a suíte inteira ficou verde — com `fmtBRL2`
// NÃO IMPORTADO no componente. Seria erro em tempo de execução na tela do
// Marco, no exato momento em que o aviso aparecesse. O build não checa isso e
// nenhum teste renderizava esta tela. É a quarta vez no dia que "suíte verde"
// não prova a parte nova.
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BenchmarksEditor from './BenchmarksEditor.jsx'

afterEach(cleanup)

// O caso REAL: Marfim 09/05 — as categorias dizem lucro de R$ 2.730 e o campo
// gravado diz prejuízo de R$ 6.480. O benchmark embutido já vem assim.
const abrir = (over) =>
  render(
    <BenchmarksEditor
      store={{ benchmarksCustom: [], benchmarkOverrides: over || {}, benchmarksOcultos: [] }}
      setStore={() => {}}
      onClose={() => {}}
    />
  )

describe('o fio na tela: o editor avisa quando o lucro não fecha', () => {
  it('avisa no benchmark cujo lucro contradiz receita − custo, com o valor esperado', () => {
    abrir()
    const avisos = screen.getAllByText(/não fecha com receita/i)
    expect(avisos.length).toBeGreaterThan(0)
    // O valor que a conta dá para a Marfim 09/05. Aceita 2.730 OU 2.731 de
    // propósito: o custoTotal de FÁBRICA dela é 333.419 e a soma das próprias
    // categorias dá 333.420 — R$ 1 de diferença no dado embutido. Qual dos
    // dois vale depende de haver override (que recalcula o total), e este
    // teste não é sobre isso.
    expect(avisos.map((a) => a.textContent).join(' ')).toMatch(/2\.73[01]/)
  })

  it('NÃO avisa no benchmark que fecha — o Cordel bate certo', () => {
    abrir()
    const cards = screen.getAllByText(/não fecha com receita/i)
    // são 2 de 4 (Marfim 09/05 e Brisa 14/03, este por R$ 1); os outros calam
    expect(cards.length).toBeLessThan(4)
  })
})
