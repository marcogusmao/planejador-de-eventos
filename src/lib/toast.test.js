// TRAVA — o módulo que entrega o botão "Desfazer" passa a ter teste próprio.
//
// POR QUE ESTE ARQUIVO EXISTE (medido em 26/07/2026). O rulebook da casa
// (CLAUDE.md) justificava a ausência de teste aqui com uma cobertura que não
// existe: "toast.js é exercitado por 2 suítes". As duas únicas menções a
// `toast.js` em teste são
//     vi.mock('../lib/toast.js', () => ({ showToast: vi.fn() }))
// em OrcamentoProdutorModal.test.jsx e PresentationMode.test.jsx — e trocar o
// módulo por um dublê é o OPOSTO de exercitá-lo: essas duas suítes garantem
// justamente que o toast.js real NÃO roda. Cobertura real, medida por grep:
// ZERO suítes.
//
// Não é detalhe de cobertura. Este módulo é o transporte do "Desfazer", que é o
// mecanismo VISÍVEL do princípio 7 do CLAUDE.md ("dados do Marco só mudam com
// revisão e caminho de volta; o desfazer fica visível na própria tela"). E é
// por ele que passa o aviso de poda da rede de proteção
// (protecao.js:440) — a mensagem que conta ao Marco que snapshots dele foram
// apagados por falta de espaço.
import { describe, it, expect, beforeEach } from 'vitest'
import { showToast, subscribeToast } from './toast.js'

// O módulo guarda os ouvintes em variável de módulo. Cada teste limpa os seus
// no fim (o retorno de subscribeToast é o cancelador), para um teste não deixar
// ouvinte para o próximo.
let canceladores = []
const inscrever = (fn) => {
  const cancelar = subscribeToast(fn)
  canceladores.push(cancelar)
  return cancelar
}
beforeEach(() => {
  canceladores.forEach((c) => c())
  canceladores = []
})

describe('showToast entrega a mensagem a quem está ouvindo', () => {
  it('entrega mensagem, ação e duração sem alterar nada', () => {
    const recebidos = []
    inscrever((t) => recebidos.push(t))
    const onAcao = () => {}
    const id = showToast('3 valores aplicados', {
      acaoLabel: 'Desfazer',
      onAcao,
      duracao: 12000,
    })
    expect(recebidos).toHaveLength(1)
    expect(recebidos[0].mensagem).toBe('3 valores aplicados')
    expect(recebidos[0].acaoLabel).toBe('Desfazer')
    expect(recebidos[0].onAcao).toBe(onAcao)
    expect(recebidos[0].duracao).toBe(12000)
    expect(recebidos[0].id).toBe(id)
  })

  it('entrega a TODOS os ouvintes, não só ao primeiro', () => {
    const a = []
    const b = []
    inscrever((t) => a.push(t))
    inscrever((t) => b.push(t))
    showToast('aviso')
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
  })

  it('cada toast tem id próprio e crescente — o host usa o id como chave e para descartar', () => {
    inscrever(() => {})
    const primeiro = showToast('um')
    const segundo = showToast('dois')
    expect(segundo).toBeGreaterThan(primeiro)
  })

  it('o cancelador remove SÓ o ouvinte dele', () => {
    const a = []
    const b = []
    const cancelarA = inscrever((t) => a.push(t))
    inscrever((t) => b.push(t))
    cancelarA()
    showToast('depois do cancelamento')
    expect(a).toHaveLength(0)
    expect(b).toHaveLength(1)
  })

  it('cancelar duas vezes não derruba nem remove o ouvinte de outro', () => {
    const b = []
    const cancelarA = inscrever(() => {})
    inscrever((t) => b.push(t))
    cancelarA()
    expect(() => cancelarA()).not.toThrow()
    showToast('ainda chega')
    expect(b).toHaveLength(1)
  })
})

describe('SEM ouvinte, showToast perde a mensagem em silêncio — e isso está apoiado de propósito', () => {
  // Este é o comportamento que protecao.js:438-439 declara e usa: "toast.js é
  // um módulo folha sem React nem dependências, e sem ouvintes o showToast é um
  // no-op, então isto não atrapalha os testes."
  //
  // O teste fixa isso como CONTRATO, não como acidente — porque tem um preço
  // que precisa ficar escrito: se um aviso for disparado antes de o ToastHost
  // se inscrever (ele se inscreve num useEffect, ou seja, depois da primeira
  // renderização), a mensagem é perdida e NADA acusa. O caso concreto que
  // importa é o aviso de poda da rede de proteção: o Marco não fica sabendo que
  // snapshots dele foram apagados.
  //
  // Se um dia a casa quiser que isso deixe de ser silencioso (guardar avisos
  // disparados antes do primeiro ouvinte e entregá-los na inscrição), a mudança
  // começa por quebrar este teste de propósito — que é como deve ser.
  it('não lança, devolve um id, e ninguém recebe nada', () => {
    let id
    expect(() => {
      id = showToast('aviso que ninguém vai ler')
    }).not.toThrow()
    expect(typeof id).toBe('number')

    // A prova de que a mensagem se perdeu: quem se inscreve DEPOIS não a recebe.
    const depois = []
    inscrever((t) => depois.push(t))
    expect(depois).toHaveLength(0)
  })

  it('um ouvinte que se inscreve depois só recebe o que vier a partir dali', () => {
    showToast('antes')
    const recebidos = []
    inscrever((t) => recebidos.push(t))
    showToast('depois')
    expect(recebidos.map((t) => t.mensagem)).toEqual(['depois'])
  })
})
