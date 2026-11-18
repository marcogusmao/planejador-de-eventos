// O calendário próprio da casa (pedido do Marco, reafirmado em 05/08/2026:
// "o calendário do navegador é ruim para trocar de ano").
//
// ————— o atrito que ele reclamou, e o conserto —————
//
// No `<input type="date">` nativo, chegar a 2019 partindo de 2026 é apertar a
// seta do MÊS oitenta e quatro vezes, ou digitar por cima do ano num campo que
// não deixa claro onde se digita. Aqui há três degraus: setas de MÊS, setas de
// ANO separadas, e um clique no ano abre uma grade de 12 anos com setas de
// década. Pular cinco anos são dois cliques.
//
// ————— o que este componente NÃO faz —————
//
// Nenhuma conta: interpretar, validar, montar a grade e andar com as setas
// moram em `src/lib/dataBrasileira.js`, com teste homônimo. Aqui é tela.
//
// ————— três colisões reais, mapeadas antes de escrever —————
//
// 1. A ORDEM NO DOM É LOAD-BEARING. O `<input>` vem ANTES do botão porque
//    `<button>` também é elemento rotulável: com o botão primeiro,
//    `getByLabelText('Data')` (e o clique no rótulo, no navegador de verdade)
//    passa a pegar o BOTÃO em vez do campo. Por isso, também, o aria-label do
//    botão nunca pode ser só "Data".
// 2. ESC DENTRO DE MODAL. O `Modal` de ui.jsx escuta Escape no window. Sem
//    parar a propagação, um Esc para fechar o calendário fecharia o modal
//    inteiro e o Marco perderia o contexto. O painel para a propagação; o
//    segundo Esc fecha o modal, como sempre.
// 3. ENTER NA HOME cria o evento. Com o painel aberto, Enter escolhe o dia e
//    nada mais — `onEnter` só dispara com o painel FECHADO.
//
// O painel vai por PORTAL + position:fixed pelo mesmo motivo escrito no aviso
// do NumInput: metade dos campos de data da casa vive dentro de tabelas com
// `overflow-x-auto`, e um painel absoluto seria cortado pela borda.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  parseDataBR,
  ehDataISO,
  gradeDoMes,
  moverFoco,
  rotuloDoMes,
  AVISO_DATA_INCOMPLETA,
  blocoDeAnos,
  definirAno,
  DIAS_SEMANA,
} from '../lib/dataBrasileira.js'
import { fmtData } from '../lib/format.js'
import { hojeISO } from '../lib/dataLocal.js'
import { AppIcon, CalendarDays, ChevronLeft, ChevronRight } from './AppIcon.jsx'

const campoForma =
  'w-full rounded-lg border py-1.5 pl-2.5 pr-9 text-sm text-[var(--tinta)] outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed'
const campoCores =
  'bg-[var(--papel)] border-[var(--borda-2)] focus:border-[var(--acento)] focus:ring-[var(--acento-tinta)]'
const campoCoresInvalido =
  'bg-[var(--tarja-alerta-fundo)] border-[var(--tarja-alerta-borda)] focus:border-[var(--vermelho-texto)] focus:ring-[var(--tarja-alerta-fundo)]'

const partes = (iso) => (ehDataISO(iso) ? iso.split('-').map(Number) : null)

export default function CampoData({
  value = '',
  onChange,
  onEnter,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
  title,
}) {
  const [rascunho, setRascunho] = useState(null) // null = campo fora de edição
  const [aviso, setAviso] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [foco, setFoco] = useState(() => (ehDataISO(value) ? value : hojeISO()))
  const [vendoAnos, setVendoAnos] = useState(false)
  const [pos, setPos] = useState(null)
  const campoRef = useRef(null)
  const painelRef = useRef(null)
  const celulaRef = useRef(null)

  // Valor trocado POR FORA com o campo em foco (desfazer/refazer da sessão,
  // importação, ponte com o Financeiro): o rascunho da digitação tem de sair da
  // frente. Sem isto, desfazer trocaria a data salva e o campo continuaria
  // exibindo o texto antigo — a tela mostrando uma data que não é mais o dado.
  // Mesma disciplina do NumInput, e pelo mesmo motivo.
  const [valorVisto, setValorVisto] = useState(value)
  if (!Object.is(value, valorVisto)) {
    setValorVisto(value)
    if (rascunho != null && parseDataBR(rascunho).valor !== value) {
      setRascunho(null)
      setAviso(null)
    }
  }

  // DADO SALVO QUE NÃO É DATA (achado da revisão adversarial, 05/08/2026).
  //
  // A validação nascera só do lado da ESCRITA. Do lado da LEITURA, um valor
  // torto vindo do disco era exibido como se fosse data boa — e é justamente
  // aqui que a troca do widget tirou uma rede sem repor:
  //
  //     salvo          <input type="date"> mostrava   este campo mostrava
  //     "2026-02-31"   (vazio)                        "31/02/2026"
  //     "lixo"         (vazio)                        "lixo"
  //
  // O vazio do widget nativo era feio, mas era o ÚNICO sinal na tela de que
  // havia dado torto ali dentro — e `2026-02-31` é lido pela casa inteira como
  // 3 de março. A migração não saneia `evento.data` (está no BACKLOG), então
  // sem este aviso ninguém descobre. É a opção (b) daquele item, que custa
  // isto aqui: mostrar o que está salvo, do jeito que está, e DIZER.
  const sujo = value != null && value !== '' && !ehDataISO(value)
  const exibido = rascunho ?? (sujo ? String(value) : fmtData(value))
  const avisoNaTela =
    aviso ?? (sujo ? 'Esta data não existe no calendário — escolha outra' : null)

  /**
   * O campo está inerte AGORA? (Marco, 07/08/2026 — o S3 do evento fechado.)
   *
   * As 8 portas de data travam evento fechado pelo `<fieldset disabled>` do
   * EventEditor — nenhuma passa a prop `disabled`. O navegador torna o campo e o
   * botão inertes de verdade (os dois casam `:disabled`), então o caminho de
   * mouse e o de teclado não existem. Mas o PAINEL vive em `document.body`,
   * fora do fieldset, e a célula do dia nunca esteve dentro dele: um painel
   * aberto que sobreviva ao instante em que o evento é fechado ainda grava.
   *
   * Por isso a checagem é feita no MOMENTO DA AÇÃO e olha o `:disabled` efetivo,
   * que cobre tanto a prop quanto o fieldset ancestral — em vez de depender de
   * oito chamadores lembrarem de passar uma prop. Guarda que existe por acidente
   * do navegador é guarda que ninguém declarou.
   */
  const inerte = () => disabled || campoRef.current?.matches(':disabled') === true

  const abrir = () => {
    if (inerte()) return
    setFoco(ehDataISO(value) ? value : hojeISO())
    setVendoAnos(false)
    setAberto(true)
  }
  const fechar = ({ devolverFoco = true } = {}) => {
    setAberto(false)
    setVendoAnos(false)
    if (devolverFoco) campoRef.current?.focus()
  }
  const escolher = (iso) => {
    // A porta que o painel no `body` deixava aberta — ver `inerte()`. Fecha o
    // painel sem gravar: campo travado não muda dado, venha o clique de onde vier.
    if (inerte()) {
      fechar({ devolverFoco: false })
      return
    }
    onChange(iso)
    setRascunho(null)
    setAviso(null)
    fechar()
  }

  // Posiciona o painel: fixed, medido a cada abertura e realinhado em scroll e
  // resize. O aviso do NumInput não precisa disso porque é transitório; este
  // fica aberto enquanto o Marco navega.
  useLayoutEffect(() => {
    if (!aberto) return undefined
    const alinhar = () => {
      const r = campoRef.current?.getBoundingClientRect()
      if (!r) return
      const largura = 268
      const esquerda = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))
      const abaixo = r.bottom + 4
      const cabeAbaixo = abaixo + 300 < window.innerHeight
      setPos({ left: esquerda, top: cabeAbaixo ? abaixo : Math.max(8, r.top - 304) })
    }
    alinhar()
    window.addEventListener('scroll', alinhar, true)
    window.addEventListener('resize', alinhar)
    return () => {
      window.removeEventListener('scroll', alinhar, true)
      window.removeEventListener('resize', alinhar)
    }
  }, [aberto])

  // Foco na célula do dia — nunca cai no body. `pos` entra nas dependências
  // de propósito: o painel só monta DEPOIS que a posição é medida, e sem isso
  // o efeito rodava num render em que ainda não havia célula para focar.
  useEffect(() => {
    if (aberto && pos && !vendoAnos) celulaRef.current?.focus()
  }, [aberto, pos, vendoAnos, foco])

  // Clique fora fecha, sem devolver o foco ao campo (o clique já levou o foco
  // para onde a pessoa quis ir).
  useEffect(() => {
    if (!aberto) return undefined
    const onDown = (e) => {
      if (painelRef.current?.contains(e.target)) return
      if (campoRef.current?.parentElement?.contains(e.target)) return
      fechar({ devolverFoco: false })
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto])

  const digitar = (texto) => {
    // Campo inerte não digita — no navegador este handler nem chega a ser
    // chamado, e é justamente por isso que a guarda mora aqui: a trava não pode
    // depender de o navegador se comportar, nem de oito chamadores lembrarem.
    if (inerte()) return
    setRascunho(texto)
    const r = parseDataBR(texto)
    if (r.valido) {
      setAviso(null)
      onChange(r.valor)
      return
    }
    setAviso(r.incompleto ? null : r.motivo)
  }

  const sairDoCampo = () => {
    setRascunho(null)
    setAviso(null)
  }

  const teclaNoCampo = (e) => {
    if (e.key === 'Enter') {
      if (aberto) {
        e.preventDefault()
        return
      }
      // O ENTER QUER DIZER "TERMINEI" (achado da revisão, 05/08/2026). Enquanto
      // se digita, `incompleto` não avisa e não grava — está certo, quem está no
      // meio do caminho não merece vermelho. Mas no Enter esse mesmo estado vira
      // recusa, senão o rascunho é descartado calado e quem chama segue com o
      // valor ANTIGO. Medido na Home, que cria a previsão no Enter: campo
      // mostrando "12/08/202" (editando 2026 para 2027), nenhum aviso na tela, e
      // o evento nascia com 2026-08-12 — um ano antes do que ele digitava.
      // Aqui o `onBlur` não salva ninguém: Enter não tira o foco do campo.
      if (rascunho != null) {
        const r = parseDataBR(rascunho)
        if (!r.valido) {
          e.preventDefault()
          setAviso(r.motivo || AVISO_DATA_INCOMPLETA)
          return
        }
      }
      onEnter?.(e)
      return
    }
    if (e.key === 'ArrowDown' && !aberto) {
      e.preventDefault()
      abrir()
    }
  }

  const teclaNoPainel = (e) => {
    const mapa = {
      ArrowLeft: 'esquerda',
      ArrowRight: 'direita',
      ArrowUp: 'cima',
      ArrowDown: 'baixo',
      PageUp: e.shiftKey ? 'anoAnterior' : 'mesAnterior',
      PageDown: e.shiftKey ? 'anoSeguinte' : 'mesSeguinte',
      Home: 'inicioDoMes',
      End: 'fimDoMes',
    }
    if (e.key === 'Escape') {
      // Para a propagação: o Modal de ui.jsx escuta Escape no window, e sem
      // isto um Esc fecharia o modal inteiro junto com o calendário.
      e.stopPropagation()
      e.preventDefault()
      fechar()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation()
      e.preventDefault()
      escolher(foco)
      return
    }
    if (mapa[e.key]) {
      e.preventDefault()
      setFoco(moverFoco(foco, mapa[e.key]))
    }
  }

  const [ano, mes] = partes(foco) || partes(hojeISO())
  const celulas = gradeDoMes(ano, mes)
  const hoje = hojeISO()

  const botaoSeta =
    'flex h-6 w-6 items-center justify-center rounded text-[var(--tinta-2)] hover:bg-[var(--papel-2)] hover:text-[var(--tinta)] cursor-pointer'
  const irPara = (dir) => () => setFoco(moverFoco(foco, dir))

  return (
    <span className={`relative block ${className || 'w-full'}`}>
      {/* O input vem ANTES do botão — ver o cabeçalho: <button> é rotulável, e
          invertendo a ordem o rótulo do Field passaria a apontar para ele. */}
      <input
        ref={campoRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className={`${campoForma} ${avisoNaTela ? campoCoresInvalido : campoCores}`}
        value={exibido}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={avisoNaTela ? true : undefined}
        title={title}
        onFocus={() => setRascunho(fmtData(value))}
        onChange={(e) => digitar(e.target.value)}
        onBlur={sairDoCampo}
        onKeyDown={teclaNoCampo}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => (aberto ? fechar() : abrir())}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={ariaLabel ? `Abrir calendário — ${ariaLabel}` : 'Abrir calendário'}
        title="Abrir calendário (também dá para digitar dd/mm/aaaa)"
        className="absolute inset-y-0 right-0 flex w-8 cursor-pointer items-center justify-center text-[var(--tinta-3)] hover:text-[var(--tinta)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <AppIcon icon={CalendarDays} size={15} />
      </button>

      {avisoNaTela &&
        createPortal(
          <span
            style={campoRef.current ? aviseNoCampo(campoRef.current) : undefined}
            className="pointer-events-none fixed z-50 whitespace-nowrap rounded border border-[var(--vermelho-texto)] bg-[var(--papel)] px-2 py-0.5 text-[11px] font-medium text-[var(--vermelho-texto)] shadow-[var(--sombra-2)]"
          >
            {avisoNaTela}
          </span>,
          document.body
        )}

      {aberto &&
        pos &&
        createPortal(
          <div
            ref={painelRef}
            role="dialog"
            aria-label="Calendário"
            style={{ left: pos.left, top: pos.top, width: 268 }}
            className="fixed z-50 rounded-xl border border-[var(--borda)] bg-[var(--papel)] p-3 shadow-[var(--sombra-2)]"
            onKeyDown={teclaNoPainel}
            onBlur={(e) => {
              // O foco saiu do painel para FORA dele (Tab, ou clique noutro
              // campo): fecha. Sem isto, quem usa teclado saía com um Tab e
              // ficava com um diálogo aberto que o Esc não alcançava mais,
              // porque o Esc mora neste onKeyDown. `relatedTarget` nulo é
              // troca de janela — aí não se fecha nada.
              const indo = e.relatedTarget
              if (indo && !e.currentTarget.contains(indo)) fechar({ devolverFoco: false })
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <button type="button" className={botaoSeta} onClick={irPara('mesAnterior')} aria-label="Mês anterior">
                <AppIcon icon={ChevronLeft} size={14} />
              </button>
              <button
                type="button"
                onClick={() => setVendoAnos((v) => !v)}
                className="flex-1 rounded px-2 py-0.5 text-xs font-semibold text-[var(--tinta)] hover:bg-[var(--papel-2)] cursor-pointer"
                title="Escolher o ano numa grade — dois cliques até qualquer ano"
              >
                {rotuloDoMes(ano, mes)}
              </button>
              <button type="button" className={botaoSeta} onClick={irPara('mesSeguinte')} aria-label="Mês seguinte">
                <AppIcon icon={ChevronRight} size={14} />
              </button>
            </div>
            {/* Setas de ANO em fileira própria — é o atrito que ele reclamou. */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" className={botaoSeta} onClick={irPara('anoAnterior')} aria-label="Ano anterior">
                <AppIcon icon={ChevronLeft} size={14} />
              </button>
              <span className="flex-1 text-center text-[11px] text-[var(--tinta-3)]">{ano}</span>
              <button type="button" className={botaoSeta} onClick={irPara('anoSeguinte')} aria-label="Ano seguinte">
                <AppIcon icon={ChevronRight} size={14} />
              </button>
            </div>

            {vendoAnos ? (
              <div className="grid grid-cols-3 gap-1" role="group" aria-label="Escolher o ano">
                {blocoDeAnos(ano).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setFoco(definirAno(foco, y))
                      setVendoAnos(false)
                    }}
                    className={`rounded px-1 py-1.5 text-xs cursor-pointer ${
                      y === ano
                        ? 'bg-[var(--ativo-fundo)] text-[var(--ativo-texto)]'
                        : 'text-[var(--tinta-2)] hover:bg-[var(--papel-2)]'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : (
              <div role="grid" aria-label={rotuloDoMes(ano, mes)}>
                <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-[var(--tinta-3)]">
                  {DIAS_SEMANA.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {celulas.map((c) => {
                    const escolhido = c.iso === value
                    const focado = c.iso === foco
                    return (
                      <button
                        key={c.iso}
                        ref={focado ? celulaRef : null}
                        type="button"
                        role="gridcell"
                        tabIndex={focado ? 0 : -1}
                        aria-selected={escolhido}
                        aria-label={fmtData(c.iso)}
                        onClick={() => escolher(c.iso)}
                        onFocus={() => setFoco(c.iso)}
                        className={`h-7 rounded text-xs cursor-pointer ${
                          escolhido
                            ? 'bg-[var(--ativo-fundo)] font-semibold text-[var(--ativo-texto)]'
                            : c.doMes
                              ? 'text-[var(--tinta)] hover:bg-[var(--papel-2)]'
                              : 'text-[var(--tinta-3)] hover:bg-[var(--papel-2)]'
                        } ${
                          c.iso === hoje && !escolhido
                            ? 'ring-1 ring-inset ring-[var(--tinta-3)]'
                            : ''
                        } ${focado ? 'ring-2 ring-inset ring-[var(--acento)]' : ''}`}
                      >
                        {c.dia}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--borda)] pt-2">
              <button
                type="button"
                onClick={() => escolher(hoje)}
                className="rounded px-2 py-1 text-[11px] text-[var(--acento)] hover:bg-[var(--papel-2)] cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => escolher('')}
                title="Deixa a data em branco"
                className="rounded px-2 py-1 text-[11px] text-[var(--tinta-2)] hover:bg-[var(--papel-2)] cursor-pointer"
              >
                Limpar data
              </button>
            </div>
          </div>,
          document.body
        )}
    </span>
  )
}

// O aviso fica logo abaixo do campo, em coordenadas de viewport (fixed) — o
// mesmo mecanismo do NumInput, pelo mesmo motivo (tabela com overflow corta
// posicionamento absoluto).
function aviseNoCampo(el) {
  const r = el.getBoundingClientRect()
  return { top: r.bottom + 4, left: r.left }
}
