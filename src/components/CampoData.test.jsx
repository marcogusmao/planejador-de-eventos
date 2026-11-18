// @vitest-environment jsdom
//
// O calendário próprio na TELA (pedido do Marco, 05/08/2026).
//
// Duas coisas que esta suíte protege e que nenhum teste de lib alcança:
//
// 1. O ATRITO QUE ELE RELATOU virado asserção. "Trocar de ano é ruim" tem um
//    número: no widget nativo, ir de 2026 a 2019 é apertar a seta do mês 84
//    vezes. Aqui há um caso medindo os cliques.
// 2. AS TRÊS COLISÕES com o resto do app: a ordem no DOM (que decide para quem
//    o rótulo aponta), o Esc dentro de Modal (que fechava o modal inteiro) e o
//    Enter da Home (que cria o evento).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import CampoData from './CampoData.jsx'
import { Field, Modal } from './ui.jsx'
import { lerFocoAtual, ehCampoDeTexto } from '../lib/descritorEdicao.js'
import { interpretarAtalho, doEventoDeTeclado } from '../lib/atalhoHistorico.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const fixarRelogioLocal = (ano, mes, dia, hora = 12, minuto = 0) => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(ano, mes - 1, dia, hora, minuto, 0, 0))
}

function montar(props = {}) {
  const onChange = vi.fn()
  render(<CampoData value="" onChange={onChange} aria-label="Data" {...props} />)
  return { onChange }
}

const campo = () => screen.getByLabelText('Data')
const botaoCalendario = () => screen.getByRole('button', { name: /Abrir calendário/ })
const abrirPainel = () => fireEvent.click(botaoCalendario())
const painel = () => screen.getByRole('dialog', { name: 'Calendário' })
const dia = (texto) => screen.getByRole('gridcell', { name: texto })

describe('digitar no campo', () => {
  it('05/08/2026 chega no onChange como ISO', () => {
    const { onChange } = montar()
    fireEvent.change(campo(), { target: { value: '05/08/2026' } })
    expect(onChange).toHaveBeenCalledWith('2026-08-05')
  })

  it('data impossível NÃO grava, avisa em português e o campo volta ao salvo', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    fireEvent.change(campo(), { target: { value: '31/02/2026' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Fevereiro de 2026 não tem 31 dias')).toBeTruthy()
    expect(campo().getAttribute('aria-invalid')).toBe('true')
    fireEvent.blur(campo())
    expect(campo().value).toBe('05/08/2026')
  })

  it('digitação a meio caminho não avisa', () => {
    montar()
    fireEvent.change(campo(), { target: { value: '05/0' } })
    expect(screen.queryByText(/Data inválida/)).toBeNull()
    expect(campo().getAttribute('aria-invalid')).toBeNull()
  })

  it('mostra sempre no formato do Brasil — nunca o ISO', () => {
    montar({ value: '2026-08-05' })
    expect(campo().value).toBe('05/08/2026')
    expect(campo().value).not.toContain('2026-08')
  })

  it('apagar tudo grava vazio — "não informado" nunca vira hoje', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { onChange } = montar({ value: '2026-08-05' })
    fireEvent.change(campo(), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('valor trocado POR FORA com o campo em foco larga o rascunho', () => {
    // desfazer da sessão, importação, ponte: a tela não pode continuar
    // exibindo uma data que já não é o dado
    const { rerender } = render(<CampoData value="2026-08-05" onChange={vi.fn()} aria-label="Data" />)
    fireEvent.focus(campo())
    fireEvent.change(campo(), { target: { value: '10/09/2026' } })
    rerender(<CampoData value="2026-12-25" onChange={vi.fn()} aria-label="Data" />)
    expect(campo().value).toBe('25/12/2026')
  })
})

describe('o painel', () => {
  it('abre pelo botão, marca aria-expanded e foca o dia do valor', () => {
    montar({ value: '2026-08-05' })
    expect(botaoCalendario().getAttribute('aria-expanded')).toBe('false')
    abrirPainel()
    expect(painel()).toBeTruthy()
    expect(botaoCalendario().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement.getAttribute('aria-label')).toBe('05/08/2026')
  })

  it('clicar num dia grava a data e fecha', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.click(dia('12/08/2026'))
    expect(onChange).toHaveBeenCalledWith('2026-08-12')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('vive no document.body, fora do contêiner do campo — não é cortado por tabela', () => {
    const { container } = render(
      <div style={{ overflowX: 'auto' }}>
        <CampoData value="2026-08-05" onChange={vi.fn()} aria-label="Data" />
      </div>
    )
    abrirPainel()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
  })

  it('desabilitado não abre', () => {
    montar({ value: '2026-08-05', disabled: true })
    expect(campo().disabled).toBe(true)
    abrirPainel()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('o atrito que ele reclamou: trocar de ano', () => {
  it('a seta de ANO existe e anda um ano por clique, sem gravar nada', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.click(screen.getByRole('button', { name: 'Ano anterior' }))
    expect(screen.getByRole('grid', { name: 'agosto de 2025' })).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(dia('05/08/2025'))
    expect(onChange).toHaveBeenCalledWith('2025-08-05')
  })

  it('de 2026 a 2019 em DOIS cliques pela grade de anos (no nativo seriam 84 setas de mês)', () => {
    fixarRelogioLocal(2026, 8, 5)
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.click(screen.getByRole('button', { name: 'agosto de 2026' })) // clique 1
    fireEvent.click(screen.getByRole('button', { name: '2019' })) // clique 2
    expect(screen.getByRole('grid', { name: 'agosto de 2019' })).toBeTruthy()
    fireEvent.click(dia('05/08/2019'))
    expect(onChange).toHaveBeenCalledWith('2019-08-05')
  })

  it('a seta de MÊS anda um mês e atravessa o ano', () => {
    montar({ value: '2026-11-10' })
    abrirPainel()
    fireEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }))
    expect(screen.getByRole('grid', { name: 'janeiro de 2027' })).toBeTruthy()
  })
})

describe('teclado', () => {
  it('seta para baixo anda uma semana e atravessa o mês', () => {
    montar({ value: '2026-08-31' })
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'ArrowDown' })
    expect(document.activeElement.getAttribute('aria-label')).toBe('07/09/2026')
  })

  it('Enter escolhe o dia focado, fecha e devolve o foco ao campo', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'ArrowRight' })
    fireEvent.keyDown(painel(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2026-08-06')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(campo())
  })

  it('Esc fecha SEM gravar e devolve o foco', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'ArrowRight' })
    fireEvent.keyDown(painel(), { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(campo())
  })

  it('PageUp/PageDown andam de mês; com Shift, de ano', () => {
    montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'PageDown' })
    expect(document.activeElement.getAttribute('aria-label')).toBe('05/09/2026')
    fireEvent.keyDown(painel(), { key: 'PageUp', shiftKey: true })
    expect(document.activeElement.getAttribute('aria-label')).toBe('05/09/2025')
  })

  it('Home e End vão ao primeiro e ao último dia do mês', () => {
    montar({ value: '2026-02-10' })
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'End' })
    expect(document.activeElement.getAttribute('aria-label')).toBe('28/02/2026')
    fireEvent.keyDown(painel(), { key: 'Home' })
    expect(document.activeElement.getAttribute('aria-label')).toBe('01/02/2026')
  })

  it('seta para baixo NO CAMPO abre o painel', () => {
    montar({ value: '2026-08-05' })
    fireEvent.keyDown(campo(), { key: 'ArrowDown' })
    expect(screen.queryByRole('dialog')).toBeTruthy()
  })
})

describe('Hoje e Limpar', () => {
  it('Hoje grava o dia LOCAL às 21h30 — nunca o de amanhã em UTC', () => {
    fixarRelogioLocal(2026, 8, 5, 21, 30)
    const { onChange } = montar({ value: '2026-01-01' })
    abrirPainel()
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(onChange).toHaveBeenCalledWith('2026-08-05')
  })

  it('Limpar data grava vazio, e o botão diz o efeito', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    abrirPainel()
    const b = screen.getByRole('button', { name: 'Limpar data' })
    expect(b.getAttribute('title')).toContain('em branco')
    fireEvent.click(b)
    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('as três colisões com o resto do app', () => {
  it('dentro de <Field label="Data">, getByLabelText devolve o INPUT (a ordem do DOM)', () => {
    render(
      <Field label="Data">
        <CampoData value="2026-08-05" onChange={vi.fn()} />
      </Field>
    )
    const alvo = screen.getByLabelText('Data')
    expect(alvo.tagName).toBe('INPUT')
    expect(alvo.type).toBe('text')
  })

  it('o aria-label do botão nunca é só "Data" — senão ele roubaria o rótulo', () => {
    montar({ value: '2026-08-05' })
    expect(botaoCalendario().getAttribute('aria-label')).not.toBe('Data')
    expect(botaoCalendario().getAttribute('aria-label')).toContain('Abrir calendário')
  })

  it('Esc dentro de Modal fecha SÓ o calendário; o segundo Esc fecha o modal', () => {
    const fecharModal = vi.fn()
    render(
      <Modal aberto titulo="Parcelas" onClose={fecharModal}>
        <CampoData value="2026-08-05" onChange={vi.fn()} aria-label="Data" />
      </Modal>
    )
    abrirPainel()
    fireEvent.keyDown(painel(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).toBeNull()
    expect(fecharModal).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(fecharModal).toHaveBeenCalled()
  })

  // ————— Marco, 05/08/2026, revisão do calendário —————
  // Digitação a meio caminho não avisa ENQUANTO se digita, e isso está certo.
  // Mas o Enter quer dizer "terminei": sem checar o rascunho antes de repassar,
  // a Home criava a previsão com a data ANTIGA enquanto a tela mostrava outra —
  // e no caso incompleto não havia aviso NENHUM para o Marco perceber.
  it('Enter com a digitação pela metade não submete, e passa a avisar', () => {
    const onEnter = vi.fn()
    montar({ value: '2026-08-12', onEnter })
    fireEvent.focus(campo())
    fireEvent.change(campo(), { target: { value: '12/08/202' } }) // editando o ano
    expect(screen.queryByText(/incompleta/i)).toBeNull() // enquanto digita, nada
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onEnter).not.toHaveBeenCalled()
    expect(screen.getByText('Data incompleta — use dd/mm/aaaa (ex.: 05/08/2026)')).toBeTruthy()
    expect(campo().getAttribute('aria-invalid')).toBe('true')
  })

  it('Enter com data IMPOSSÍVEL no campo também não submete', () => {
    const onEnter = vi.fn()
    montar({ value: '2026-08-12', onEnter })
    fireEvent.focus(campo())
    fireEvent.change(campo(), { target: { value: '31/02/2026' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onEnter).not.toHaveBeenCalled()
    expect(screen.getByText('Fevereiro de 2026 não tem 31 dias')).toBeTruthy()
  })

  it('Enter com o campo em ordem submete normalmente — inclusive vazio, que é opcional', () => {
    const onEnter = vi.fn()
    const { onChange } = montar({ value: '2026-08-12', onEnter })
    fireEvent.focus(campo())
    fireEvent.change(campo(), { target: { value: '05/08/2026' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('2026-08-05')
    expect(onEnter).toHaveBeenCalledTimes(1)

    fireEvent.change(campo(), { target: { value: '' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledTimes(2)
  })

  it('Enter com o painel ABERTO não dispara o onEnter da tela (a Home cria evento com Enter)', () => {
    const onEnter = vi.fn()
    montar({ value: '2026-08-05', onEnter })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledTimes(1) // fechado: dispara

    abrirPainel()
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledTimes(1) // aberto: NÃO dispara de novo
  })
})

describe('a linguagem de cor da casa', () => {
  it('o calendário não usa verde, vermelho nem âmbar — essas cores são de RESULTADO', () => {
    const fonte = readFileSync(path.join(process.cwd(), 'src/components/CampoData.jsx'), 'utf8')
    expect(fonte).not.toContain('--verde-texto')
    expect(fonte).not.toContain('--ambar-texto')
    // o vermelho aparece SÓ no aviso de data inválida, que é a tarja de erro
    // já padronizada da casa — em nenhum lugar da grade
    const grade = fonte.slice(fonte.indexOf('role="grid"'))
    expect(grade).not.toContain('--vermelho-texto')
  })
})

// ————————————————————————————————————————————————————————————————
// OS ACHADOS DA REVISÃO ADVERSARIAL (05/08/2026)
// ————————————————————————————————————————————————————————————————

describe('dado salvo que NÃO é data: a tela DIZ, em vez de fingir', () => {
  const casos = ['2026-02-31', 'lixo', '12/08/2026', '2026-13-01', '999-01-01']

  it('mostra o que está salvo, marca inválido e avisa em português', () => {
    for (const sujo of casos) {
      cleanup()
      montar({ value: sujo })
      expect(campo().value, sujo).toBe(sujo)
      expect(campo().getAttribute('aria-invalid'), sujo).toBe('true')
      expect(screen.getByText('Esta data não existe no calendário — escolha outra')).toBeTruthy()
    }
  })

  it('data BOA não avisa nada — o aviso não vira ruído de fundo', () => {
    montar({ value: '2026-08-05' })
    expect(campo().getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText(/não existe no calendário/)).toBeNull()
  })

  it('escolher uma data boa apaga o aviso do valor sujo', () => {
    // O RELÓGIO PRECISA ESTAR CONGELADO AQUI, e a falta disso quebrou a esteira
    // em 01/09/2026 — descoberta no primeiro dia do mês seguinte, não antes.
    // O valor montado é SUJO ('2026-02-31'), então o calendário não consegue
    // deduzir um mês dele e abre no mês de HOJE. Em agosto, 12/08/2026 estava na
    // grade; em setembro, não está mais, e o `getByRole('gridcell')` não acha
    // nada. Dez testes irmãos deste arquivo já congelavam; este e outro não.
    fixarRelogioLocal(2026, 8, 5)
    const { onChange } = montar({ value: '2026-02-31' })
    expect(screen.getByText(/não existe no calendário/)).toBeTruthy()
    abrirPainel()
    fireEvent.click(dia('12/08/2026'))
    expect(onChange).toHaveBeenCalledWith('2026-08-12')
  })
})

describe('ano de 3 dígitos não sai do campo (o que vazava até o arquivo do contador)', () => {
  it('digitar 01/01/0999 NÃO grava e explica o que corrigir', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    fireEvent.change(campo(), { target: { value: '01/01/0999' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('O ano precisa ter 4 dígitos (ex.: 2026)')).toBeTruthy()
  })

  it('pelo caminho dos 8 dígitos colados, idem', () => {
    const { onChange } = montar({ value: '2026-08-05' })
    fireEvent.change(campo(), { target: { value: '01010999' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('o foco não fica preso num painel órfão', () => {
  it('Tab para FORA fecha o painel — senão sobra um diálogo que o Esc não alcança', () => {
    render(
      <>
        <CampoData value="2026-08-05" onChange={vi.fn()} aria-label="Data" />
        <button type="button">outro campo</button>
      </>
    )
    abrirPainel()
    expect(screen.getByRole('dialog', { name: 'Calendário' })).toBeTruthy()
    const fora = screen.getByRole('button', { name: 'outro campo' })
    fireEvent.blur(painel(), { relatedTarget: fora })
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).toBeNull()
  })

  it('foco que anda DENTRO do painel não fecha nada', () => {
    montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.blur(painel(), { relatedTarget: screen.getByRole('button', { name: 'Mês seguinte' }) })
    expect(screen.getByRole('dialog', { name: 'Calendário' })).toBeTruthy()
  })

  it('trocar de janela (relatedTarget nulo) não fecha o painel', () => {
    montar({ value: '2026-08-05' })
    abrirPainel()
    fireEvent.blur(painel(), { relatedTarget: null })
    expect(screen.getByRole('dialog', { name: 'Calendário' })).toBeTruthy()
  })
})

describe('a largura que as telas pedem passa a valer', () => {
  it('com className de largura, o embrulho NÃO força w-full por cima', () => {
    const { container } = render(
      <CampoData value="2026-08-05" onChange={vi.fn()} aria-label="Data" className="w-36" />
    )
    const embrulho = container.firstChild
    expect(embrulho.className).toContain('w-36')
    expect(embrulho.className).not.toContain('w-full')
  })

  it('sem className, o padrão continua sendo w-full', () => {
    const { container } = render(<CampoData value="" onChange={vi.fn()} aria-label="Data" />)
    expect(container.firstChild.className).toContain('w-full')
  })
})

// ————————————————————————————————————————————————————————————————
// O QUE A TROCA DO CAMPO MUDOU NO Cmd+Z — declarado e fixado
//
// Marco, 07/08/2026. A troca do `<input type="date">` por este componente
// mudou DUAS coisas no desfazer, e nenhum dos commits da entrega declarou:
//
//   antes (type="date")  Cmd+Z desfazia o passo da SESSÃO | passo sem grupo
//   agora (type="text")  Cmd+Z é devolvido ao NAVEGADOR   | passo agrupa por elemento
//
// As duas são defensáveis: o campo passou a se comportar como todo campo de
// texto do app, que é mais coerente do que era. O defeito era serem acidente.
// Estes casos fixam o comportamento novo lendo o DOM DE VERDADE — se alguém
// devolver o campo ao widget nativo, ou mexer em `TIPOS_DE_TEXTO`, eles falam.
// ————————————————————————————————————————————————————————————————

describe('o campo de data e o desfazer da sessão', () => {
  const comRotulo = (label, value = '2026-08-05') => (
    <Field label={label}>
      <CampoData value={value} onChange={vi.fn()} />
    </Field>
  )

  it('o campo é um <input type="text"> — e como tal, campo de digitação do app', () => {
    render(comRotulo('Data'))
    const el = campo()
    expect(el.getAttribute('type')).toBe('text')
    expect(ehCampoDeTexto({ tag: el.tagName, tipo: el.getAttribute('type'), editavel: false })).toBe(
      true
    )
  })

  it('o passo de desfazer nasce COM rótulo e COM grupo — a edição agrupa por elemento', () => {
    render(comRotulo('Data'))
    campo().focus()
    const passo = lerFocoAtual(document)
    expect(passo.rotulo).toBe('mudar Data')
    expect(passo.grupo).toBe(campo())
  })

  it('dois campos de data diferentes NÃO agrupam no mesmo passo', () => {
    render(
      <>
        {comRotulo('Data da festa', '2026-08-05')}
        {comRotulo('Início de vendas', '2026-08-01')}
      </>
    )
    const [a, b] = screen.getAllByRole('textbox')
    a.focus()
    const passoA = lerFocoAtual(document)
    b.focus()
    const passoB = lerFocoAtual(document)
    expect(passoA.rotulo).toBe('mudar Data da festa')
    expect(passoB.rotulo).toBe('mudar Início de vendas')
    expect(passoA.grupo).not.toBe(passoB.grupo)
  })

  it('Cmd+Z dentro do campo é DEVOLVIDO ao navegador, não rouba o desfazer da sessão', () => {
    render(comRotulo('Data'))
    const el = campo()
    el.focus()
    // o evento REAL, passando pela mesma casca que o App usa
    const ev = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })
    Object.defineProperty(ev, 'target', { value: el })
    expect(interpretarAtalho(doEventoDeTeclado(ev))).toBeNull()
  })

  it('fora do campo, o MESMO Cmd+Z continua desfazendo a sessão (a regra não sumiu)', () => {
    render(comRotulo('Data'))
    const botao = screen.getByRole('button', { name: /Abrir calendário/ })
    const ev = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })
    Object.defineProperty(ev, 'target', { value: botao })
    expect(interpretarAtalho(doEventoDeTeclado(ev))).toBe('desfazer')
  })
})
