// Semáforo de decisão (sugestão 2) — veredito único de "esse evento sai?",
// no padrão de linguagem da Visão Sócias do Financeiro (frase em
// linguagem simples, sempre citando os números).
// Regra do Marco (18/07/2026): o realista dá a cor, o pessimista rebaixa.
// Só LEITURA de computeCenarios — cálculo em veredito() (calc.js), testado.
// Sessão K: a cor vira a BOLA PINTADA da marca (pedido do Marco — "as bolas
// do Sobrado podem virar o semáforo"); o emoji do resumo de WhatsApp é
// hardcoded em resumo.js (🟢/🔴), não sai daqui.
import { computeCenarios, veredito } from '../lib/calc.js'
import { itensCriticosFaltando } from '../lib/defaults.js'
import { fmtPct, fmtData } from '../lib/format.js'
import { fraseVeredito, TITULO_VEREDITO } from '../lib/vereditoTexto.js'
import { Bola, Card, Field, PctInput } from './ui.jsx'
import { vereditoQuebrado as vereditoQuebradoLib, fraseVereditoQuebrado } from '../lib/dadoQuebrado.js'
import { TITULO_VEREDITO_QUEBRADO } from './AvisoCustoQuebrado.jsx'
import { NotaLoteSemPreco } from './AvisoLoteSemPreco.jsx'

// Dado quebrado (Marco, 26/07/2026; aplicado ao veredito em 05/10/2026): com
// um custo infinito a frase dizia "Inviável como está: margem realista 0%" —
// uma margem derivada de lixo, e uma cor também. Sem veredito, bola neutra.
// (05/10/2026, 4ª revisão: também quando a causa é a receita — um patrocínio
// de 1e308 dava "Viável … margem realista 100%".)
const vereditoQuebrado = vereditoQuebradoLib
import { FAIXA_MARGEM } from '../lib/campoNumerico.js'
import { AppIcon, TriangleAlert, FlaskConical } from './AppIcon.jsx'

// Só a `bola` é lida — o painel tinge a bola pintada da marca. Os campos
// bg/border/texto do card foram aposentados (nada os lia; o card fica em tinta
// neutra) e o emoji do WhatsApp é hardcoded em resumo.js, não sai daqui.
const CORES = {
  verde: { bola: 'var(--sem-verde)' },
  amarelo: { bola: 'var(--sem-amarelo)' },
  vermelho: { bola: 'var(--sem-vermelho)' },
}

// Título e frase moram em src/lib/vereditoTexto.js (Sessão K) — o "Copiar
// resumo" usa os MESMOS textos; re-export mantém os consumidores antigos.
const TITULO = TITULO_VEREDITO
export { fraseVeredito }

/** Painel completo — usado no editor (campos de margem alvo/mínima editáveis).
 *  Autoexplicativo num print recortado: nome, data e local do evento moram
 *  DENTRO do card (regra do compartilhamento em call/WhatsApp, Sessão K).
 *  `simulando` (sugestão 35, F2-V): o painel está lendo o RASCUNHO da
 *  simulação — o selo avisa que esta cor/frase não é a salva (princípio 1:
 *  número de rascunho não pode se passar por número salvo). */
export function VeredictoPainel({ evento, update, simulando = false }) {
  const c = computeCenarios(evento)
  const v = veredito(c, evento)
  const quebrado = vereditoQuebrado(evento, c)
  const cor = quebrado ? { bola: 'var(--tinta-3)' } : CORES[v.cor]
  const faltando = itensCriticosFaltando(evento)
  // "Já incluso" (sugestão 37, princípio 9 — ação no próprio item): dispensar
  // some do aviso SÓ neste evento (não vira premissa da festa), sem criar linha
  // de custo. Display-only. O DESFAZER de um dispensado mora na aba Custos
  // (Sessão Polimento Visual — item 1): saiu daqui para não poluir o semáforo,
  // mas segue reversível e visível lá (CostsTab.jsx, faixa de resumo).
  const dispensar = (nome) =>
    update(
      (e) => ({
        ...e,
        itensDispensados: [...new Set([...(e.itensDispensados || []), nome])],
      }),
      `dispensar o aviso de “${nome}”`
    )
  // Validação: mínima maior que o alvo é configuração sem sentido — avisa em
  // português na hora (nada falha em silêncio). Usa os valores EFETIVOS
  // (preenchido ou padrão), então pega também mínima 30 com alvo vazio (28).
  const configInvalida = v.margemMinima > v.margemAlvo
  const contexto = [evento.nome, fmtData(evento.data), evento.local].filter(Boolean).join(' · ')

  return (
    // Só a BOLA carrega a cor do estado (Marco, Sessão Polimento Visual — item
    // 2): o card, o título e o texto ficam em TINTA NORMAL (legível nos dois
    // temas). Antes o card inteiro era tingido pela cor do estado (bg/border/
    // texto) — o vermelho-sobre-escuro chegou a ficar ilegível; neutralizar o
    // texto elimina essa classe de bug. A bola (30px) é a portadora do
    // significado; o emoji do resumo de WhatsApp é hardcoded em resumo.js.
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Momento tipográfico (movimento anti-slop 03, Marco 24/07): o
              veredito é A decisão da tela — "esse evento sai?". Ganha escala de
              display (text-2xl, bola 36) para saltar de relance, a mesma
              ambição do modo apresentação. Só a bola carrega a cor; título em
              tinta normal (regra do semáforo). Nenhum número muda. */}
          <Bola
            cor={cor.bola}
            size={36}
            className="mt-1"
            title={quebrado ? TITULO_VEREDITO_QUEBRADO : `Semáforo: ${v.cor}`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight tracking-tight text-[var(--tinta)]">
              {quebrado ? TITULO_VEREDITO_QUEBRADO : TITULO[v.cor]}
              {simulando && (
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgba(0,69,221,0.45)] px-2 py-0.5 text-[10px] font-medium text-[var(--acento)]">
                  <AppIcon icon={FlaskConical} size={12} /> rascunho da simulação — nada salvo
                </span>
              )}
            </div>
            <p className="mt-1 max-w-xl text-sm text-[var(--tinta-2)]">
              {quebrado ? fraseVereditoQuebrado(evento) : fraseVeredito(c, v)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--tinta-3)]">{contexto}</p>
          </div>
        </div>
        {/* w-32: "Margem mínima (%)" mede 112px de texto — em w-28 (112px)
            vivia no limite do pixel e quebrava (print do Marco, F2-V). Regra
            da casa: o campo tem a largura do seu rótulo, com folga. */}
        <div className="flex shrink-0 gap-3">
          {/* Trava das margens (Marco, 23/07/2026 — lote de travas, item 2):
              0..100 na porta. Uma mínima −20 aceitava prejuízo com semáforo
              não-vermelho; o min="0" antigo era INERTE (NumInput type=text) —
              a régua real é `faixa`. */}
          <Field label="Margem alvo (%)" className="w-32">
            <PctInput
              value={evento.margemAlvo ?? ''}
              onChange={(val) => update((e) => ({ ...e, margemAlvo: val }))}
              placeholder="28"
              faixa={FAIXA_MARGEM}
            />
          </Field>
          <Field label="Margem mínima (%)" className="w-32">
            <PctInput
              value={evento.margemMinima ?? ''}
              onChange={(val) => update((e) => ({ ...e, margemMinima: val }))}
              placeholder="20"
              faixa={FAIXA_MARGEM}
            />
          </Field>
        </div>
      </div>
      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro).
          Não é o semáforo (verde/amarelo/vermelho do veredito) — aquele fica. */}
      {configInvalida && (
        <p className="mt-3 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
          A margem mínima ({fmtPct(v.margemMinima)}) está maior que a margem alvo ({fmtPct(v.margemAlvo)}) —
          corrija os campos: a mínima é o piso, o alvo é o que almejamos bater. O semáforo pode enganar
          enquanto isso não for corrigido.
        </p>
      )}
      {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): este
          painel fica no topo de TODAS as abas e a frase acima cita lucro e
          público que já não contam o lote. A linha curta diz por quê, em
          âmbar (regra 5 da LINGUAGEM-DE-COR: vermelho é de resultado). Lê o
          mesmo `evento` do painel — na simulação, o rascunho. */}
      <NotaLoteSemPreco evento={evento} className="mt-3" />
      {/* Só o alerta do que FALTA — em tom NEUTRO (borda/fundo da casa, texto
          tinta), independente da cor do estado. O triângulo em âmbar é o único
          acento e sinaliza "atenção" por si (não é o semáforo). O recap de
          dispensados saiu daqui (item 1); o DESFAZER mora na aba Custos. */}
      {faltando.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--borda-2)] bg-[var(--papel-2)] px-3 py-2 text-[11px] text-[var(--tinta-2)]">
          <div className="flex gap-1.5">
            <AppIcon icon={TriangleAlert} size={14} className="mt-px shrink-0 text-[var(--ambar-texto)]" />
            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
              <strong className="font-semibold text-[var(--tinta)]">Itens comuns ainda não cadastrados:</strong>
              {/* cada item traz a ação NELE (princípio 9): "já incluso" tira do
                  aviso só neste evento, sem criar linha de custo R$ 0. */}
              {faltando.map((nome) => (
                <span
                  key={nome}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--borda-2)] px-1.5 py-0.5"
                >
                  {nome}
                  <button
                    type="button"
                    onClick={() => dispensar(nome)}
                    title={`Marcar "${nome}" como já incluso — some do aviso só neste evento, sem lançar custo (reversível na aba Custos)`}
                    className="cursor-pointer rounded px-1 text-[10px] font-medium text-[var(--tinta-3)] underline decoration-dotted underline-offset-2 hover:text-[var(--tinta)]"
                  >
                    já incluso
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Explicação da regra colapsável — estava jogada como parágrafo solto no
          rodapé do painel (print do Marco, F2-P). Conteúdo preservado, só some
          da primeira leitura; quem quiser entender a cor abre. */}
      <details className="mt-2 text-[11px] text-[var(--tinta-2)]">
        <summary className="cursor-pointer select-none opacity-70 hover:opacity-100">
          Como o semáforo decide a cor
        </summary>
        <p className="mt-1 opacity-70">
          Margem alvo = o que almejamos todo evento bater (padrão 28%) · margem mínima = piso abaixo
          do qual o evento não sai (padrão 20%). O realista dá a cor; o pessimista com prejuízo
          rebaixa o verde para amarelo.
        </p>
      </details>
    </Card>
  )
}

/** Selo compacto — usado no card da Home (só leitura, tooltip com a frase). */
export function VeredictoSelo({ evento, size = 16 }) {
  const c = computeCenarios(evento)
  const v = veredito(c, evento)
  if (vereditoQuebrado(evento, c))
    return <Bola cor="var(--tinta-3)" size={size} title={fraseVereditoQuebrado(evento)} />
  return <Bola cor={CORES[v.cor].bola} size={size} title={fraseVeredito(c, v)} />
}

export { CORES as VEREDITO_CORES }
