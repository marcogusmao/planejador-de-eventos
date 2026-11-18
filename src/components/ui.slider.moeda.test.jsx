// @vitest-environment jsdom
//
// Prova RODANDO do modo MOEDA do Slider (Marco, 05/08/2026 — o slider do bar).
//
// O componente nasceu só para percentual: o `suffix` tinha default '%', era
// renderizado DEPOIS do campo, e o mesmo `suffix` era concatenado cru no title
// do trilho. Passar moeda pelo caminho antigo escreveria "de 0R$ a 300R$" — um
// rótulo que mente sem ficar vermelho em lugar nenhum.
//
// Os dois lados desta suíte importam igual: o que o modo moeda FAZ, e o que ele
// NÃO faz com os sliders de percentual que já existiam.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Slider } from './ui.jsx'

afterEach(cleanup)

const trilho = () => screen.getByRole('slider')
const campo = (label) => screen.getByLabelText(`${label} (digite o valor)`)

describe('Slider — modo moeda', () => {
  it('as pontas do trilho saem em reais, nunca "0R$"', () => {
    render(
      <Slider label="Bar por pessoa (R$)" value={110} onChange={vi.fn()} min={0} max={300} moeda />
    )
    const t = trilho().closest('div').getAttribute('title')
    expect(t).toBe('Bar por pessoa (R$): de R$ 0 a R$ 300')
    expect(t).not.toContain('0R$')
    expect(t).not.toContain('%')
  })

  it('milhar sai com ponto: o slider do bar em valor fixo diz "de R$ 0 a R$ 300.000"', () => {
    render(
      <Slider
        label="Bar — lucro líquido (R$)"
        value={180000}
        onChange={vi.fn()}
        min={0}
        max={300000}
        moeda
      />
    )
    expect(trilho().closest('div').getAttribute('title')).toBe(
      'Bar — lucro líquido (R$): de R$ 0 a R$ 300.000'
    )
  })

  it('o "R$" aparece ANTES do campo, e o sufixo "%" some', () => {
    const { container } = render(
      <Slider label="Bar por pessoa (R$)" value={110} onChange={vi.fn()} min={0} max={300} moeda />
    )
    expect(container.textContent).toContain('R$')
    expect(container.textContent).not.toContain('%')
    // ordem no DOM: o R$ vem antes do input do campo acoplado
    const marca = screen.getByText('R$')
    const entrada = campo('Bar por pessoa (R$)')
    expect(marca.compareDocumentPosition(entrada) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o campo acoplado continua entendendo o formato brasileiro: "1.234,56" vira 1234.56', () => {
    const onChange = vi.fn()
    render(
      <Slider label="Bar por pessoa (R$)" value={110} onChange={onChange} min={0} max={300} moeda />
    )
    fireEvent.change(campo('Bar por pessoa (R$)'), { target: { value: '1.234,56' } })
    expect(onChange).toHaveBeenCalledWith(1234.56)
  })

  it('o campo é mais largo no modo moeda — "180.000" não sai cortado', () => {
    render(
      <Slider label="Bar (R$)" value={180000} onChange={vi.fn()} min={0} max={300000} moeda />
    )
    expect(campo('Bar (R$)').className).toContain('w-20')
  })

  it('arrastar continua devolvendo o ELEMENTO como 2º argumento (agrupamento do desfazer)', () => {
    const onChange = vi.fn()
    render(<Slider label="Bar (R$)" value={110} onChange={onChange} min={0} max={300} moeda />)
    fireEvent.change(trilho(), { target: { value: '130' } })
    expect(onChange).toHaveBeenCalledWith(130, expect.any(HTMLElement))
  })
})

describe('Slider — os percentuais de sempre NÃO regridem', () => {
  it('sem `moeda`, o title continua "de 0% a 100%"', () => {
    render(<Slider label="Ingressos vendidos" value={80} onChange={vi.fn()} min={0} max={100} />)
    expect(trilho().closest('div').getAttribute('title')).toBe(
      'Ingressos vendidos: de 0% a 100%'
    )
  })

  it('sem `moeda`, o "%" continua DEPOIS do campo e não aparece "R$"', () => {
    const { container } = render(
      <Slider label="Ajuste de custos" value={0} onChange={vi.fn()} min={-50} max={50} />
    )
    expect(container.textContent).not.toContain('R$')
    const marca = screen.getByText('%')
    const entrada = campo('Ajuste de custos')
    expect(marca.compareDocumentPosition(entrada) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('sem `moeda`, a largura do campo é a de sempre (w-14)', () => {
    render(<Slider label="Ajuste do ticket" value={0} onChange={vi.fn()} min={-30} max={30} />)
    expect(campo('Ajuste do ticket').className).toContain('w-14')
    expect(campo('Ajuste do ticket').className).not.toContain('w-20')
  })

  it('o risco do zero continua aparecendo quando a faixa cruza o zero', () => {
    const { container } = render(
      <Slider label="Ajuste de custos" value={0} onChange={vi.fn()} min={-50} max={50} />
    )
    expect(container.querySelector('[aria-hidden]')).toBeTruthy()
  })
})
