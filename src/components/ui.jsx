// Primitivas de UI compartilhadas — vestidas com os tokens da casa
// (src/index.css): papel/tinta/borda quentes, acento da marca, bola pintada.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  parseCampoNumerico,
  formatarParaEdicao,
  deveLargarRascunho,
  foraDaFaixa,
  avisoDaFaixa,
} from '../lib/campoNumerico.js'
import { fmtInt } from '../lib/format.js'
import { subscribeToast } from '../lib/toast.js'
import { sinalDelta, sinalResultado } from '../lib/confrontoCustos.js'
import { STATUS_CUSTO, contaOrcamentoFechado } from '../lib/statusCusto.js'
import { cabeComoDinheiro, NUMERO_NAO_CALCULA } from '../lib/dadoQuebrado.js'
import { AppIcon, X, ChevronUp, ChevronDown } from './AppIcon.jsx'

// A cor do desvio de CUSTO, num lugar só. O julgamento ('estouro'/'economia')
// vem de confrontoCustos.js; aqui só se pinta. Custos e Fechamento importam
// daqui — foi a duplicação desta regra que deixou as duas telas pintando o
// mesmo evento de vermelho numa e de verde na outra (achado de 20/07/2026).
export const corDelta = (delta) => {
  const sinal = sinalDelta(delta)
  if (sinal === 'neutro') return ''
  return sinal === 'estouro'
    ? 'text-[var(--vermelho-texto)] font-semibold'
    : 'text-[var(--verde-texto)]'
}

// A cor de um RESULTADO (receita − custo), régua OPOSTA à do desvio de custo:
// aqui positivo é bom. O julgamento vem de `sinalResultado` (mesmo limiar de
// meio centavo de `sinalDelta`); aqui só se pinta. Resultado de fração de
// centavo fica NEUTRO — não é lucro nem prejuízo, e verde num evento que
// empatou é a mesma mentira em miniatura.
export const corResultado = (resultado) => {
  const sinal = sinalResultado(resultado)
  if (sinal === 'neutro') return 'text-[var(--tinta-2)]'
  return sinal === 'prejuizo'
    ? 'text-[var(--vermelho-texto)] font-semibold'
    : 'text-[var(--verde-texto)]'
}

// Bola pintada da marca (contorno orgânico do branding book — MESMO path do
// Financeiro, de propósito: os dois apps falam a mesma língua visual).
// É a linguagem oficial do semáforo e dos acentos; emoji 🟢🟡🔴 morre na
// tela — segue vivo apenas em TEXTO (ex.: resumo copiado para o WhatsApp).
export const BOLA_PATH =
  'M50 6.5C63 4.5 78 9 87 21 95 32 97 50 92 64 87 78 74 91 58 94 42 97 24 92 13 79 3 67 2 47 9 33 16 19 30 8 44 6.8 46 6.6 48 6.6 50 6.5Z'

export function Bola({ cor = 'currentColor', size = 14, className = '', title, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block shrink-0 ${className}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={BOLA_PATH} fill={cor} />
    </svg>
  )
}

export function Btn({ children, variant = 'secondary', className = '', ...props }) {
  const styles = {
    // Azul (acento) SÓ para a ação primária — regra da direção de marca.
    primary:
      'bg-[var(--acento)] text-white hover:bg-[var(--acento-hover)] border border-transparent shadow-[var(--sombra-1)]',
    secondary:
      'bg-[var(--papel)] text-[var(--tinta)] border border-[var(--borda-2)] hover:border-[var(--tinta-3)]',
    ghost: 'text-[var(--tinta-2)] hover:text-[var(--tinta)] border border-transparent',
    // B3 (BACKLOG S4): hover:bg-red-50 fixo virava um clarão rosa sobre o
    // papel escuro; o tema-aware já é o mesmo alfa da tarja de alerta.
    danger: 'text-[var(--vermelho-texto)] border border-transparent hover:bg-[var(--tarja-alerta-fundo)]',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '', style, ...props }) {
  return (
    <div
      className={`rounded-xl border border-[var(--borda)] bg-[var(--papel)] ${className}`}
      style={{ boxShadow: 'var(--sombra-1)', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

// Campo com RÓTULO DE ALTURA RESERVADA e input ANCORADO PELA BASE (Sessão
// F2-P, a partir do print do Marco: um rótulo de 2 linhas desalinhava a
// fileira inteira de premissas). A raiz do problema: o rótulo era `block` sem
// altura fixa, então um rótulo que quebra em 2 linhas empurra o próprio input
// para baixo e ele fica mais baixo que os vizinhos de rótulo curto.
// Solução que torna o desalinhamento IMPOSSÍVEL: o rótulo reserva sempre a
// altura de 2 linhas (min-h-[2.5em] = 2×leading-tight no text-xs) e seu texto
// ancora na BASE (items-end) — assim rótulo de 1 linha e de 2 linhas terminam
// na MESMA altura, e o input (mt-auto, colado na base) começa no mesmo Y em
// toda a fileira, independentemente do comprimento do rótulo.
//
// REGRA DA CASA (Marco, 19/07/2026 — Sessão F2-V, a partir do print de
// "Margem mínima (%)" em 2 linhas): RÓTULO DE CAMPO NUNCA QUEBRA DE LINHA —
// whitespace-nowrap aqui; a LARGURA do campo é que acomoda o rótulo inteiro
// (ajuste o w-/min-w- de quem chama). Um rótulo maior que a caixa passa a
// ESTOURAR visivelmente em vez de quebrar em silêncio — de propósito: estouro
// se vê e se corrige na hora; quebra desalinha e engana. A altura reservada
// continua (mantém o ritmo vertical das fileiras já validadas).
export function Field({ label, children, className = '' }) {
  // A unidade entre parênteses no fim do rótulo — "(%)", "(R$)" — cola no
  // texto anterior com espaço não-quebrável (print do Marco, F2-P). Com o
  // nowrap acima virou redundância inofensiva; fica pela clareza da intenção.
  const rotulo =
    typeof label === 'string' ? label.replace(/\s+(\([^)]*\))\s*$/, '\u00A0$1') : label
  return (
    <label className={`flex min-w-0 flex-col ${className}`}>
      {label != null && label !== '' && (
        <span className="mb-1 flex min-h-[2.5em] items-end whitespace-nowrap text-xs font-medium leading-tight text-[var(--tinta-2)]">
          {rotulo}
        </span>
      )}
      <span className="mt-auto block">{children}</span>
    </label>
  )
}

// Forma e cores separadas para o NumInput poder trocar o conjunto inteiro de
// cores no estado inválido — classes concorrentes (border padrão × border-red)
// no mesmo elemento deixariam a ordem do CSS decidir quem ganha.
const inputForma =
  'w-full rounded-lg border px-2.5 py-1.5 text-sm text-[var(--tinta)] outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed'
const inputCores =
  'bg-[var(--papel)] border-[var(--borda-2)] focus:border-[var(--acento)] focus:ring-[var(--acento-tinta)]'
// B3 (BACKLOG S4): tokens tema-aware — bg-red-50/border-red-400 fixos viravam
// uma faixa clara sobre o papel escuro. `--vermelho-texto` no foco já é o
// mesmo vermelho de texto tema-aware usado no resto do app.
const inputCoresInvalido =
  'bg-[var(--tarja-alerta-fundo)] border-[var(--tarja-alerta-borda)] focus:border-[var(--vermelho-texto)] focus:ring-[var(--tarja-alerta-fundo)]'
const inputBase = `${inputForma} ${inputCores}`

export function TextInput({ className = '', ...props }) {
  return <input type="text" className={`${inputBase} ${className}`} {...props} />
}

// Campo numérico em texto com parser brasileiro (sugestão 1 / achado S2):
// "8.000" vale oito mil, "1.234,56" mantém a vírgula, roda do mouse não altera
// valor e entrada inválida avisa em vez de salvar em silêncio. min/max/step
// eram do type="number" antigo — são descartados de propósito.
// `faixa` (decisão do Marco, 20/07/2026 — trava dos percentuais): quando
// presente ({min, max, aviso}), número interpretado FORA da faixa é tratado
// como entrada inválida — avisa em português e NÃO grava. É prop própria, não
// os min/max antigos, de propósito: o campo acoplado ao Slider documenta que
// valor fora do arrasto continua valendo — reativar min/max ligaria a trava
// onde ela não foi pedida.
// `forma` permite variantes compactas (ex.: campo acoplado ao slider) sem
// depender de ordem de classes do Tailwind para "vencer" a base.
// `textoGuardado` (S1, 07/10/2026): quando o valor guardado não é um número
// que o campo saiba escrever ("ilegível", NaN, 1e+308), é ESTE texto que o
// campo mostra fora da digitação, em vez do "0" de `formatarParaEdicao`. A
// regra do rascunho continua olhando `value`, como em todo campo.
export function NumInput({ value, onChange, className = '', forma, faixa, min, max, step, textoGuardado, ...props }) {
  const [rascunho, setRascunho] = useState(null) // null = campo não está em edição
  const [aviso, setAviso] = useState(null) // {top, left, texto} do aviso quando inválido
  // Valor trocado POR FORA com o campo em foco (desfazer/refazer da sessão,
  // importação, ponte com o Financeiro): o rascunho da digitação tem de sair
  // da frente. Sem isto, desfazer trocava o número salvo e o campo continuava
  // exibindo o texto antigo — a tela mostrando um número que não é mais o
  // dado. Número errado exibido como certo é o pior bug da casa; o rascunho
  // é só a conveniência de digitar, e perde para a verdade.
  // Digitar NÃO cai aqui: durante a digitação o `value` que chega é exatamente
  // o que o rascunho representa, então o rascunho é preservado (a vírgula em
  // "1.234," e o zero à esquerda continuam sobrevivendo enquanto se digita).
  const [valorVisto, setValorVisto] = useState(value)
  if (!Object.is(value, valorVisto)) {
    setValorVisto(value)
    if (deveLargarRascunho(rascunho, value)) {
      setRascunho(null)
      setAviso(null)
    }
  }
  const exibicaoFora = textoGuardado ?? formatarParaEdicao(value)
  const exibido = rascunho ?? exibicaoFora
  return (
    <span className="relative block w-full">
      <input
        type="text"
        inputMode="decimal"
        className={`${forma || inputForma} ${aviso ? inputCoresInvalido : inputCores} tnum text-right ${className}`}
        value={exibido}
        onFocus={() => setRascunho(exibicaoFora)}
        onChange={(e) => {
          const texto = e.target.value
          setRascunho(texto)
          const r = parseCampoNumerico(texto)
          const fora = r.valido && foraDaFaixa(r.valor, faixa)
          if ((!r.valido && !r.incompleto) || fora) {
            const rect = e.target.getBoundingClientRect()
            setAviso({
              top: rect.bottom + 4,
              left: rect.left,
              texto: fora ? avisoDaFaixa(r.valor, faixa) : null,
            })
          } else {
            setAviso(null)
          }
          if (r.valido && !fora) onChange(r.valor)
        }}
        onBlur={() => {
          setRascunho(null)
          setAviso(null)
        }}
        aria-invalid={aviso ? true : undefined}
        {...props}
      />
      {aviso &&
        createPortal(
          // Portal + position fixed: dentro da tabela de custos (overflow-x-auto)
          // um aviso absoluto ficaria clipado e ninguém veria.
          <span
            style={{ top: aviso.top, left: aviso.left }}
            className="pointer-events-none fixed z-50 whitespace-nowrap rounded border border-[var(--vermelho-texto)] bg-[var(--papel)] px-2 py-0.5 text-[11px] font-medium text-[var(--vermelho-texto)] shadow-[var(--sombra-2)]"
          >
            {aviso.texto || 'Valor inválido — use números, ex.: 1.234,56'}
          </span>,
          document.body
        )}
    </span>
  )
}

// AS DUAS REGRAS DA VÍRGULA, ditas no próprio campo (Marco, 30/08/2026, por
// questionário). Ele escolheu manter as duas convivendo, e pediu que o campo
// explicasse — porque a mesma vírgula é lida de dois jeitos e ninguém adivinha
// qual sem a regra na frente:
//   · COM ponto de milhar antes dela, a vírgula é decimal, com quantas casas
//     vierem — "1.234,500" é R$ 1.234,50.
//   · SEM ponto nenhum, a vírgula de 3 casas é milhar — "1.500" e "1,500" são,
//     os dois, mil e quinhentos reais.
// Até 30/08/2026 a primeira regra não existia e "25.000,000" gravava R$ 25 —
// mil vezes menos, em silêncio. Um caller que já passa `title` próprio continua
// mandando: o dele é mais específico que este.
export const DICA_CAMPO_DINHEIRO =
  'Vírgula com ponto de milhar antes é decimal: "1.234,500" vale R$ 1.234,50. Vírgula sozinha é milhar: "1,500" vale R$ 1.500,00.'

export function MoneyInput({ value, onChange, className = '', title, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-[var(--tinta-3)]">
        R$
      </span>
      <NumInput
        value={value}
        onChange={onChange}
        className="pl-8"
        title={title ?? DICA_CAMPO_DINHEIRO}
        {...props}
      />
    </div>
  )
}

export function PctInput({ value, onChange, className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <NumInput value={value} onChange={onChange} className="pr-7" step="any" {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-[var(--tinta-3)]">
        %
      </span>
    </div>
  )
}

// Slider de simulação (sugestão 6, Sessão I) com campo numérico ACOPLADO
// (pedido do Marco na Sessão K): arrastar ou digitar mexem no MESMO valor —
// digite "63" quando o dedo não acerta o 63 no arrasto. O campo usa o parser
// brasileiro do NumInput; valor fora de min/max do arrasto continua valendo
// (o slider apenas encosta na ponta, como os campos da grade já permitem).
//
// A LARGURA do campo acoplado depende do que ele carrega (Marco, 05/08/2026 —
// slider do bar): 56px (w-14) comportam "100" e "−50", os percentuais de
// sempre; um valor em reais chega a "180.000" e sairia cortado. Por isso a
// forma nasce partida em base + largura, em vez de ter a largura colada na
// string: quem não pede moeda recebe className byte-idêntico ao de antes.
const sliderCampoBase = 'rounded-md border px-1.5 py-0.5 text-xs outline-none focus:ring-2'
const sliderCampoForma = (moeda) => `${moeda ? 'w-20' : 'w-14'} ${sliderCampoBase}`

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '%',
  // `moeda` (Marco, 05/08/2026): um interruptor só, que move as TRÊS coisas
  // juntas — "R$" ANTES do campo (moeda brasileira não é sufixo), campo mais
  // largo, e as pontas do trilho escritas em reais no title. Prop de string
  // (prefixo="R$") foi recusada de propósito: não conserta a largura, não
  // conserta o title, e admite a combinação sem sentido prefixo+suffix.
  moeda = false,
  accentColor,
  textClassName = 'text-[var(--tinta-2)]',
  inputStyle,
  // `faixa` (opcional): trava do campo ACOPLADO, independente do min/max do
  // arrasto. O arrasto tem seu alcance visual (min/max), mas digitar aceita
  // qualquer valor DENTRO da faixa — e RECUSA fora dela (ex.: ajuste de
  // cenário −50..100). Ausente = campo sem trava (comportamento de sempre dos
  // outros sliders). Ver NumInput/foraDaFaixa.
  faixa,
}) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0
  // As pontas do trilho, escritas do jeito que se lê: "de R$ 0 a R$ 300" ou
  // "de 0% a 100%". Concatenar o `suffix` cru (como era) produziria "de 0R$ a
  // 300R$" no instante em que alguém passasse moeda — o title mentiria em
  // silêncio, que é o defeito que esta casa mede toda semana.
  const ponta = (n) => (moeda ? `R$ ${fmtInt(n)}` : `${n}${suffix}`)
  return (
    <div>
      <span
        className={`mb-1 flex items-center justify-between gap-2 text-xs font-medium ${textClassName}`}
      >
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {/* O "R$" vai ANTES do número, e é decoração: quem lê por leitor de
              tela já ouve o rótulo do campo, que traz "(R$)". Não se reusa o
              MoneyInput aqui de propósito — ele injeta `relative` + `pl-8`,
              que estoura a linha compacta do slider. */}
          {moeda && <span aria-hidden>R$</span>}
          <NumInput
            value={v}
            onChange={onChange}
            forma={sliderCampoForma(moeda)}
            faixa={faixa}
            style={inputStyle}
            aria-label={`${label} (digite o valor)`}
          />
          {!moeda && <span>{suffix}</span>}
        </span>
      </span>
      {/* O trilho vive num wrapper relativo por causa do RISCO DO ZERO
          (achado do Marco, 21/07/2026): sliders vizinhos têm FAIXAS
          diferentes de propósito (custos −30..+50, ticket −30..+30), então o
          mesmo valor 0 cai em pontos diferentes do trilho — e sem referência
          isso parecia thumb dessincronizado. O risco marca onde o zero mora
          em toda faixa que cruza zero; o title diz a faixa por extenso. */}
      <div className="relative" title={`${label}: de ${ponta(min)} a ${ponta(max)}`}>
        {min < 0 && max > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--tinta-3)] opacity-60"
            style={{ left: `${((0 - min) / (max - min)) * 100}%` }}
          />
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(v, min), max)}
          // O 2º argumento é o próprio elemento: é ele que dá identidade ao
          // AGRUPAMENTO do arrasto (um arrasto = um passo de desfazer, achado
          // S2-C). Vai explícito em vez de sair do document.activeElement porque
          // "quem tem o foco durante um arrasto" varia com o navegador — e o
          // agrupamento não pode depender disso. Quem ignora o argumento (a
          // maioria dos usos) continua funcionando igual.
          onChange={(e) => onChange(Number(e.target.value), e.target)}
          style={accentColor ? { accentColor } : undefined}
          className="w-full cursor-pointer"
          aria-label={label}
        />
      </div>
    </div>
  )
}

// O calendário próprio mora em arquivo próprio (ui.jsx já tem 700+ linhas), mas
// é re-exportado daqui para que as telas importem campo de data como importam
// qualquer outro campo. Mesmo padrão do re-export de hojeISO em RitmoVendas.
export { default as CampoData } from './CampoData.jsx'

export function Select({ options, className = '', ...props }) {
  return (
    <select className={`${inputBase} cursor-pointer ${className}`} {...props}>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

// ————— Setas de ordem: ↑↓ que sobem e descem UMA linha —————
//
// Desenho do Marco (fila do HANDOFF, item 2): "mexer pra cima e pra baixo".
// As setas são o controle principal — não há arrastar, de propósito: arrastar
// exigiria dependência nova ou um punhado de handlers de ponteiro para um
// gesto que o Marco não usa. Duas setas fazem o trabalho inteiro, funcionam no
// teclado, funcionam no toque e dizem em português o que vão fazer.
//
// Regras da casa aplicadas aqui:
// - AÇÃO MORA NO OBJETO (princípio 9): as setas ficam na PRÓPRIA linha.
// - O RÓTULO DIZ O EFEITO: "Mover 'DJs' para cima (posição 2 de 5)". Sem nome
//   preenchido, o tipo entra no lugar ("Mover o 3º lote para cima").
// - A seta da ponta NUNCA SOME — fica desabilitada e explica por quê. Se ela
//   sumisse, a linha inteira mudaria de largura ao chegar na ponta e as outras
//   setas dançariam para o lado no meio do gesto.
// - Cores só por variável da casa (funciona nos dois temas).
//
// ————— FOCO NA PONTA (achado S3-G da rodada 2, 20/07/2026) —————
//
// Quem navega no teclado sobe uma linha por vez com a mesma seta. Ao chegar na
// PONTA, o botão que acabou de ser apertado desabilita — e o navegador joga o
// foco no `body`. O Tab seguinte recomeça do topo da página: a pessoa se perde
// justamente na última tecla de uma sequência que estava funcionando.
//
// A regra abaixo é pura, e por isso testável: depois de mover, o foco fica no
// MESMO botão sempre que ele continuar clicável; se ele virou a ponta, o foco
// atravessa para o botão irmão — que é exatamente o botão que desfaz o
// movimento, o próximo passo mais provável. Nunca cai no body.
export const focoDepoisDeMover = (indiceNovo, total, direcao) =>
  direcao === 'cima'
    ? indiceNovo <= 0
      ? 'baixo'
      : 'cima'
    : indiceNovo >= total - 1
      ? 'cima'
      : 'baixo'

export function BotoesOrdem({ nome, tipo = 'item', indice, total, onSubir, onDescer }) {
  const refCima = useRef(null)
  const refBaixo = useRef(null)
  // Direção do último clique DESTA linha, e só quando o clique veio do teclado
  // ou deixou o foco aqui. Mouse que clica e o botão continua clicável não
  // precisa de nada: o foco já está onde deve.
  const pendente = useRef(null)

  // Roda DEPOIS que o React aplicou a nova posição (o `key` das listas é o id,
  // então esta instância sobrevive ao movimento e só recebe outro `indice`).
  useLayoutEffect(() => {
    const dir = pendente.current
    if (!dir) return
    pendente.current = null
    const alvo = focoDepoisDeMover(indice, total, dir) === 'cima' ? refCima : refBaixo
    if (alvo.current && !alvo.current.disabled) alvo.current.focus()
  }, [indice, total])

  const clicar = (direcao, acao) => () => {
    // só assume o foco de volta se ele estava aqui — clique de mouse em quem
    // não usa teclado não deve roubar foco de nenhum campo de texto.
    const daqui =
      typeof document !== 'undefined' &&
      (document.activeElement === refCima.current || document.activeElement === refBaixo.current)
    pendente.current = daqui ? direcao : null
    acao?.()
  }

  const ordinal = `${indice + 1}º ${tipo}`
  const alvo = nome && String(nome).trim() ? `“${String(nome).trim()}”` : `o ${ordinal}`
  const posicao = `posição ${indice + 1} de ${total}`
  const primeiro = indice <= 0
  const ultimo = indice >= total - 1
  const base =
    'flex h-5 w-5 items-center justify-center rounded text-[var(--tinta-3)] transition-colors hover:bg-[var(--papel-2)] hover:text-[var(--tinta)] disabled:pointer-events-none disabled:opacity-25 cursor-pointer disabled:cursor-default'
  return (
    <span className="inline-flex items-center gap-0.5 print:hidden">
      <button
        ref={refCima}
        type="button"
        onClick={clicar('cima', onSubir)}
        disabled={primeiro}
        className={base}
        title={primeiro ? `${alvo} já é o primeiro` : `Mover ${alvo} para cima (${posicao})`}
        aria-label={primeiro ? `${alvo} já é o primeiro` : `Mover ${alvo} para cima`}
      >
        <AppIcon icon={ChevronUp} size={14} />
      </button>
      <button
        ref={refBaixo}
        type="button"
        onClick={clicar('baixo', onDescer)}
        disabled={ultimo}
        className={base}
        title={ultimo ? `${alvo} já é o último` : `Mover ${alvo} para baixo (${posicao})`}
        aria-label={ultimo ? `${alvo} já é o último` : `Mover ${alvo} para baixo`}
      >
        <AppIcon icon={ChevronDown} size={14} />
      </button>
    </span>
  )
}

// Toggle segmentado (Absoluto × R$/pax etc.) — um componente só para as
// quatro cópias que existiam espalhadas; ativo em tinta (o azul fica
// reservado à ação primária).
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-[var(--borda-2)] text-xs ${className}`}
    >
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          aria-pressed={value === val}
          onClick={() => onChange(val)}
          className={`cursor-pointer px-2.5 py-1 font-medium transition-colors ${
            value === val
              ? 'bg-[var(--ativo-fundo)] text-[var(--ativo-texto)]'
              : 'bg-[var(--papel)] text-[var(--tinta-2)] hover:text-[var(--tinta)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// (O antigo mapa de cores de status morreu aqui — a cor de status agora vem SÓ
// de estiloStatusCusto, no statusCusto.js: fonte única, igual à planilha
// exportada. Duas fontes de cor era a doença. Marco, 21/07/2026.)

// Fileira de ÂNCORAS sticky para abas longas (sugestão 39, item 8 F2-W).
// Fase 1: navegação + indicador "você está aqui". Cuidados embutidos:
//  - some em impressão (`no-print`);
//  - as SEÇÕES-alvo levam scroll-margin (scroll-mt) para não aterrissarem
//    atrás da fileira — quem chama garante o id + o scroll-mt;
//  - z abaixo de modais/toasts, acima do conteúdo; fundo opaco cobre o que
//    rola por baixo; rola no lugar em tela estreita (overflow-x-auto).
// O ativo é a última seção cujo topo passou a linha da fileira (~64px). Fase 2
// (subtotal/status no chip) foi ao BACKLOG.
export function AncoraNav({ itens }) {
  const [ativo, setAtivo] = useState(itens[0]?.id)
  const chave = itens.map((i) => i.id).join('|')
  useEffect(() => {
    const onScroll = () => {
      // ativo = a última seção (em ordem) cujo topo já passou a LINHA logo
      // abaixo da fileira. 80px fica um tanto ABAIXO do scroll-mt-16 (64px) das
      // seções, para a seção recém-navegada (que aterrissa em 64) contar como
      // ativa mesmo com fração de pixel.
      let cur = itens[0]?.id
      for (const { id } of itens) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 80) cur = id
      }
      setAtivo((a) => (a === cur ? a : cur))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  if (itens.length < 2) return null
  return (
    <div className="no-print sticky top-0 z-20 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--borda)] bg-[var(--fundo)] py-2">
      <span className="shrink-0 pr-0.5 text-[11px] font-medium text-[var(--tinta-3)]">Ir para:</span>
      {itens.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          aria-current={ativo === id ? 'true' : undefined}
          className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            ativo === id
              ? 'bg-[var(--ativo-fundo)] text-[var(--ativo-texto)]'
              : 'border border-[var(--borda-2)] bg-[var(--papel)] text-[var(--tinta-2)] hover:text-[var(--tinta)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, className = '', style }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
      style={style}
    >
      {children}
    </span>
  )
}

/**
 * Etiqueta "sem reserva" de um benchmark PROMOVIDO de um fechamento (decisão 3
 * do Marco, 20/07/2026). Ela existe para responder, na própria comparação, à
 * pergunta que o número levanta: "por que este benchmark é mais barato que os
 * históricos?" — porque ele não carrega reserva de contingência, e os 4
 * embutidos carregam, dentro da categoria "Extras & Conting.".
 *
 * Discreta de propósito: é uma RESSALVA de leitura, não um veredito. Sem cor
 * de julgamento (nada de verde/vermelho, que aqui significam lucro/prejuízo) e
 * só com variáveis CSS da casa, para não sumir no tema escuro. O texto inteiro
 * mora no `title` — a etiqueta cabe em rótulo de barra, o motivo não.
 */
export function EtiquetaSemReserva({ texto, explicacao, className = '' }) {
  return (
    <span
      title={explicacao}
      className={`inline-flex shrink-0 items-center rounded-full border border-[var(--borda-2)] bg-[var(--papel-2)] px-1.5 py-px text-[10px] font-medium whitespace-nowrap text-[var(--tinta-3)] ${className}`}
    >
      {texto}
    </span>
  )
}

// `valueSize` permite o DESTAQUE de uma faixa (item 6, F2-W): um número maior
// por faixa, sem depender de ordem de classes (text-xl × text-2xl no mesmo
// elemento) — passa-se a classe de tamanho inteira. Padrão = text-xl (todos os
// usos anteriores seguem idênticos).
export function Stat({ label, value, sub, className = '', valueClass = '', valueSize = 'text-xl' }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-[var(--tinta-2)]">{label}</div>
      <div className={`tnum mt-0.5 ${valueSize} font-semibold text-[var(--tinta)] ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs text-[var(--tinta-3)]">
          {/* Microtexto em SEGMENTOS inquebráveis (print do Marco, 20/07):
              "desconto efetivo 8%" quebrava no meio da frase. Cada trecho
              separado por " · " vira unidade — a quebra só acontece ENTRE
              qualificadores, nunca por dentro. Sub que não é string (JSX)
              passa reto. */}
          {typeof sub === 'string'
            ? sub.split(' · ').map((seg, i) => (
                <span key={i} className="inline-block whitespace-nowrap">
                  {i > 0 && <span className="mx-1">·</span>}
                  {seg}
                </span>
              ))
            : sub}
        </div>
      )}
    </div>
  )
}

// Barra "% do orçamento fechado" (sugestão 3). A CONTA mora numa função só —
// contaOrcamentoFechado (statusCusto.js), a MESMA que o resumo e o relatório
// consomem: denominador = TODOS os status, numerador = PAGO+FECHADO+PARCIAL
// (Marco, 22/07/2026 — antes a lista cravada de 4 subcontava e mostrava "100%"
// onde eram "43%"). As CORES dos segmentos vêm da fonte ÚNICA STATUS_CUSTO[].bg
// (duas fontes de cor é a doença que statusCusto.js cura), na ordem do ciclo de
// vida, só para os status presentes.
export function BarraOrcamentoFechado({ totais, fmt }) {
  const { fechado, total, pct } = contaOrcamentoFechado(totais)
  // Custo que não cabe numa conta de dinheiro (05/10/2026, 2ª revisão do PR
  // #98): a barra imprimia "R$ 0 de R$ 100.000.000…000 (0%)" e o número
  // estourava a largura da tela. Texto curto no lugar, sem barra — a faixa de
  // dado quebrado no topo da aba diz qual custo.
  if (!cabeComoDinheiro(total) || !cabeComoDinheiro(fechado)) {
    return (
      <p className="text-xs text-[var(--tinta-2)]">
        % do orçamento fechado: {NUMERO_NAO_CALCULA} — um custo desta festa não cabe numa conta de
        dinheiro.
      </p>
    )
  }
  if (total <= 0) return null
  const segmentos = STATUS_CUSTO.filter((s) => (totais?.[s.id] || 0) > 0)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="tnum text-[var(--tinta-2)]">
          {fmt(fechado)} de {fmt(total)} ({pct}%) fechados ou pagos
        </span>
        <span className="tnum text-[var(--tinta-3)]">{100 - pct}% ainda é estimativa</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--papel-2)]">
        {segmentos.map((s) => {
          const v = totais[s.id] || 0
          return (
            <div
              key={s.id}
              style={{ width: `${(v / total) * 100}%`, background: s.bg }}
              title={`${s.rotulo}: ${fmt(v)}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// Host dos toasts (tema F): montado UMA vez no App; escuta showToast e
// empilha no rodapé central. Cada toast some sozinho (padrão 6s) ou ao clicar
// na ação ("Desfazer"). z alto para ficar acima de modais e apresentação.
export function ToastHost() {
  const [toasts, setToasts] = useState([])
  useEffect(
    () =>
      subscribeToast((t) => {
        setToasts((cur) => [...cur, t])
        const ms = t.duracao || 6000
        setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), ms)
      }),
    []
  )
  const fechar = (id) => setToasts((cur) => cur.filter((x) => x.id !== id))
  if (toasts.length === 0) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-[#211f1c] px-4 py-2.5 text-sm text-white shadow-[var(--sombra-2)]"
        >
          <span>{t.mensagem}</span>
          {t.acaoLabel && (
            <button
              type="button"
              onClick={() => {
                t.onAcao?.()
                fechar(t.id)
              }}
              className="shrink-0 cursor-pointer font-semibold text-[var(--amarelo)] underline underline-offset-2 hover:opacity-80"
            >
              {t.acaoLabel}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body
  )
}

export function Modal({ title, children, onClose, wide = false }) {
  // Esc fecha — respeito básico ao usuário rápido (nível Linear). O listener
  // vive no modal: montou, vale; desmontou, morre.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(33,31,28,0.45)] p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl bg-[var(--papel)]`}
        style={{ boxShadow: 'var(--sombra-2)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--borda)] px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {/* Fechar com tooltip PRÓPRIO, aberto PARA DENTRO do modal (item 9,
              F2-W): o title nativo aparecia cortado pela borda do modal no canto
              (print do Marco, modal de parcelar). Este abre ancorado à direita
              (right-0) e abaixo (top-full) do X — fica dentro da caixa, nunca
              estoura a borda; some no hover/blur. bg tinta × texto papel viram
              com o tema (legível no claro e no escuro). aria-label mantém a
              acessibilidade; sem title nativo para não duplicar/cortar. */}
          <span className="group relative inline-flex">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg px-2 py-1 text-[var(--tinta-3)] hover:bg-[var(--papel-2)] hover:text-[var(--tinta)]"
              aria-label="Fechar (Esc)"
            >
              <AppIcon icon={X} />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[var(--tinta)] px-2 py-1 text-[11px] font-medium text-[var(--papel)] opacity-0 shadow-[var(--sombra-2)] transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Fechar (Esc)
            </span>
          </span>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
