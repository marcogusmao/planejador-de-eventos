// Simulação ao vivo (sugestão 6, Sessão I): sliders para responder "e se
// vender só 60%? e se o ticket cair R$ 10?" na reunião. Editam os MESMOS
// campos de `cenariosConfig` que o painel de cenários já usa (vendaPct/
// custoPct/ticketPct) — uma fonte de verdade só, o motor (calc.js) não muda.
// Mudança salva na hora, como o resto do evento (mesmo `update`); o botão
// "voltar ao padrão" só aparece quando algo foi mexido e restaura exatamente
// 80/90/100 — nada fica torto em silêncio (princípio 4/7 do rulebook).
import { CENARIOS, CENARIO_LABEL, computeCenario, isBarPorPessoa, isOpenBar } from '../lib/calc.js'
import { valorEfetivo, simulacaoAtiva, resetarSimulacao } from '../lib/simulador.js'
import { num } from '../lib/util.js'
import { fmtBRL2 } from '../lib/format.js'
import { Card, Btn, Slider, Bola, Field, MoneyInput } from './ui.jsx'
import { FAIXA_CENARIO, FAIXA_VENDA, FAIXA_PRECO, FAIXA_CONSUMO } from '../lib/campoNumerico.js'
import { AppIcon, RefreshCw, FlaskConical } from './AppIcon.jsx'
import { CENARIO_TONS } from './Charts.jsx'

// Espelha os campos que já existem no painel de cenários — nenhum campo novo.
// Sessão P (sugestão 19): grade completa — os 3 sliders nos 3 cenários.
// Sessão K: cada slider ganhou campo numérico acoplado (pedido do Marco) —
// o campo mora no próprio Slider (ui.jsx), mesmo valor, mesmo update.
// `faixa` = trava do campo ACOPLADO (o que se digita), independente do min/max
// do arrasto. Decisão do Marco (22/07/2026 — 3b): vendaPct é ABSOLUTO (0..100,
// FAIXA_VENDA); custoPct/ticketPct são AJUSTES relativos (−50..100, FAIXA_CENARIO,
// negativo de propósito).
const TRIO = [
  { campo: 'vendaPct', label: 'Ingressos vendidos', min: 0, max: 100, faixa: FAIXA_VENDA },
  // Faixas SIMÉTRICAS por decisão do Marco (21/07/2026): todo slider que
  // cruza o zero tem o zero NO CENTRO, na mesma posição em todos — custos
  // era −30..+50 e o zero caía em 37,5%, parecendo thumb dessincronizado ao
  // lado do ticket. O teto +50 dos custos ficou; o piso desceu a −50 para a
  // simetria. Só alcance de controle — nenhuma conta muda.
  { campo: 'custoPct', label: 'Ajuste de custos', min: -50, max: 50, faixa: FAIXA_CENARIO },
  { campo: 'ticketPct', label: 'Ajuste do ticket', min: -30, max: 30, faixa: FAIXA_CENARIO },
]
const CAMPOS = { pessimista: TRIO, realista: TRIO, otimista: TRIO }

// Alcance do ARRASTO do bar por pessoa (Marco, 05/08/2026, por questionário):
// R$ 0 a R$ 300. A âncora real é o consumo das festas dele — a Marfim 09/05 tem
// 100 / 110 / 120 e o placeholder da aba Receita é 110, então 300 dá espaço de
// sobra sem tornar o arrasto grosso demais. Digitar continua aceitando qualquer
// valor dentro da FAIXA_CONSUMO (a MESMA régua do campo irmão da aba Receita —
// fonte única de régua, não um segundo limite que envelhece sozinho).
const BAR_ARRASTO_MAX = 300

// Alcance do ARRASTO do bar em modo VALOR FIXO — que é um total do evento, não
// um consumo por cabeça: R$ 0 a R$ 300.000, de mil em mil. A referência medida
// é a Marfim que fechou com R$ 180.000 de bar. Sem trava no que se DIGITA, de
// propósito: a regra escrita da casa é que bar líquido aceita negativo
// ("prejuízo é fato" — campoNumerico.js/FAIXA_CUSTO), e o campo irmão da aba
// Receita também não tem faixa.
const BAR_FIXO_ARRASTO_MAX = 300_000

// `comTicket` (Sessão F2-P, tema E): mostra também o campo "Ticket médio (R$)"
// por cenário — assim a grade de cenários e os sliders viram UM painel só
// (o antigo "Simulação ao vivo" separado morre). cenariosConfig segue fonte
// única; calc.js intocado.
//
// Modo "Simular" (sugestão 35, Sessão F2-V): quando `simulando`, o `update`
// recebido aqui é o roteador de RASCUNHO (editarRascunho — nada persiste; ver
// simulacaoRascunho.js) e o card ganha cara própria (borda tracejada + fundo
// tingido + selo "rascunho"). `onSimular` é a ENTRADA do modo — o dono do
// estado (EventEditor) passa o callback; a apresentação já nasce simulando e
// não passa (sem botão de entrada lá).
export default function SimuladorSliders({
  evento,
  update,
  dark = false,
  comTicket = false,
  simulando = false,
  onSimular,
}) {
  const cfg = evento.cenariosConfig || {}
  const tons = dark ? CENARIO_TONS.dark : CENARIO_TONS.light
  const ativa = simulacaoAtiva(cfg)
  // Placeholder do ticket automático (mistura de lotes do cenário), calculado
  // com o ticket manual/ajuste zerados — o mesmo que a grade antiga mostrava.
  // O "Ticket médio (R$)" mostra o que o CENÁRIO USA (Marco, 10/08/2026): antes o
  // placeholder era calculado com `ticketPct: 0`, então arrastar "Ajuste do
  // ticket" não mexia no número logo abaixo — a tela mostrava o automático CRU e
  // a conta usava o automático AJUSTADO. Agora só o `ticketMedio` manual sai da
  // conta do placeholder; o ajuste fica, e o número acompanha o slider.
  const cfgSemTm = comTicket
    ? {
        ...cfg,
        pessimista: { ...cfg.pessimista, ticketMedio: null },
        realista: { ...cfg.realista, ticketMedio: null },
        otimista: { ...cfg.otimista, ticketMedio: null },
      }
    : null
  const tmAuto = (cen) =>
    cfgSemTm ? computeCenario({ ...evento, cenariosConfig: cfgSemTm }, cen).ticketMedio : 0
  // Com ticket DIGITADO, o campo guarda a base e o ajuste age por cima dela —
  // então o número do campo não é o que o cenário usa. Esta linha diz qual é,
  // e some quando não há ajuste (aí base e efetivo são a mesma coisa).
  const tmEfetivoManual = (cen) => {
    const manual = num(cfg[cen]?.ticketMedio)
    const pct = num(cfg[cen]?.ticketPct ?? 0)
    if (!(manual > 0) || pct === 0) return null
    return computeCenario(evento, cen).ticketMedio
  }
  // Campo numérico acoplado no escuro: cores por style (vence classe sempre —
  // mesma lição do bug de Tailwind da Sessão I).
  const campoEscuro = dark
    ? { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }
    : undefined
  // O bar por pessoa só é um valor POR CENÁRIO no modo "por pessoa" e fora do
  // open bar — nos outros casos o bar não varia entre as três colunas, e um
  // slider por coluna prometeria um controle que não existe.
  const barPorCenario = isBarPorPessoa(evento) && !isOpenBar(evento)
  const barFixoNaGrade = !isBarPorPessoa(evento) && !isOpenBar(evento)
  // Filete que separa o bar dos três de cima: eles falam de INGRESSO, o bar é
  // outra linha de receita. A divisão diz isso sem gastar uma palavra.
  const filete = dark ? 'border-white/10' : 'border-[var(--borda)]'

  // `descritor` nomeia e AGRUPA o passo de desfazer. O arrasto do slider manda
  // o próprio elemento como grupo (achado S2-C: sem isso, cada tique do
  // arrasto virava um passo e um arrasto só engolia a pilha inteira). O campo
  // numérico acoplado não manda nada e cai no agrupamento por foco de sempre.
  const setCampo = (cen, campo, v, descritor) =>
    update(
      (e) => ({
        ...e,
        cenariosConfig: { ...e.cenariosConfig, [cen]: { ...e.cenariosConfig?.[cen], [campo]: v } },
      }),
      descritor
    )

  // O bar NÃO mora em cenariosConfig — mora na raiz do evento (`barTicket`, um
  // valor por cenário). Por isso ele tem updater próprio, e por isso o rascunho
  // do modo Simular precisou aprender a carregá-lo (simulacaoRascunho.js): sem
  // aquilo, este slider ou não faria nada no rascunho, ou gravaria no evento
  // enquanto a tela diz que nada está sendo salvo.
  const setBar = (cen, v, descritor) =>
    update((e) => ({ ...e, barTicket: { ...e.barTicket, [cen]: v } }), descritor)

  // Bar em modo VALOR FIXO: um número do evento inteiro, em outrasReceitas.bar.
  // O spread preserva o patrocínio, que mora no mesmo objeto.
  const setBarFixo = (v, descritor) =>
    update((e) => ({ ...e, outrasReceitas: { ...e.outrasReceitas, bar: v } }), descritor)

  const handleReset = () =>
    update(
      (e) => ({ ...e, cenariosConfig: resetarSimulacao(e.cenariosConfig) }),
      'voltar os cenários ao padrão (80/90/100)'
    )

  // Card/Btn têm fundo claro na base — em Tailwind, classe de utilitário
  // depois no className NÃO garante vitória sobre a base (ordem no CSS
  // gerado, não na string). Fundo/borda escuros vão por `style` (sempre
  // vence classe, não depende da ordem de geração do Tailwind).
  const cardEscuro = dark ? { background: '#1a1a19', borderColor: 'rgba(255,255,255,0.1)' } : undefined
  const btnEscuro = dark
    ? { background: 'transparent', borderColor: 'rgba(255,255,255,0.15)', color: '#c3c2b7' }
    : undefined
  // Clima visual do modo Simular: borda tracejada + fundo levemente azulado
  // (azul da casa) nos DOIS temas — por `style` para vencer a base do Card.
  const cardSimulando = simulando
    ? dark
      ? { background: '#1b2030', borderColor: 'rgba(120,150,255,0.4)', borderStyle: 'dashed' }
      : { background: 'rgba(0,69,221,0.05)', borderColor: 'rgba(0,69,221,0.4)', borderStyle: 'dashed' }
    : undefined

  return (
    <Card className={dark ? 'p-6' : 'p-4'} style={{ ...cardEscuro, ...cardSimulando }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className={`flex items-center gap-2 text-sm font-semibold ${dark ? 'text-white' : 'text-[var(--tinta)]'}`}
          >
            Cenários — arraste ou digite
            {simulando && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[10px] font-medium ${
                  dark
                    ? 'border-[rgba(120,150,255,0.5)] text-[#aebfff]'
                    : 'border-[rgba(0,69,221,0.45)] text-[var(--acento)]'
                }`}
              >
                <AppIcon icon={FlaskConical} size={12} /> rascunho — nada é salvo
              </span>
            )}
          </h3>
          <p className={`mt-0.5 max-w-md text-xs ${dark ? 'text-[#898781]' : 'text-[var(--tinta-3)]'}`}>
            {simulando
              ? 'Mexa à vontade: cards, DRE, semáforo e curva respondem na hora, mas nada grava no evento — só “Aplicar ao evento” grava (com snapshot antes).'
              : 'Um controle por valor: arraste o slider ou digite no campo — cards, DRE e semáforo respondem na hora. São os mesmos números do cenário (fonte única).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Selo "simulação ativa — fora do padrão" removido (tema E: confundia).
              O botão de voltar ao padrão já sinaliza que algo saiu do 80/90/100. */}
          {ativa && (
            <Btn
              variant="secondary"
              className={dark ? 'hover:bg-white/10' : ''}
              style={btnEscuro}
              onClick={handleReset}
              // Com o bar dentro do mesmo card (05/08/2026), "voltar ao padrão"
              // podia ser lido como "reseta tudo". Ele volta SÓ os três
              // percentuais: os reais de bar são número de negócio digitado
              // pelo Marco, e um botão não os apaga de passagem.
              title="Volta só os três percentuais dos cenários (ingressos, custos, ticket) — não mexe no bar"
            >
              <AppIcon icon={RefreshCw} /> Voltar ao padrão (80/90/100)
            </Btn>
          )}
          {/* Entrada do modo Simular (sugestão 35) — cara própria: tracejado +
              azul da casa, não se confunde com as ações que salvam. */}
          {onSimular && !simulando && (
            <Btn
              variant="secondary"
              className="border-dashed border-[var(--acento)] text-[var(--acento)] hover:bg-[rgba(0,69,221,0.06)]"
              onClick={onSimular}
              title="Abre o modo Simular: mexa nos cenários sem gravar nada — o evento só muda se você aplicar (e um snapshot é criado antes)"
            >
              <AppIcon icon={FlaskConical} /> Simular sem salvar
            </Btn>
          )}
        </div>
      </div>
      {/* MODO VALOR FIXO (Marco, 05/08/2026, por questionário): o bar é UM
          número do evento inteiro, não um por cenário — então ele mora acima
          das três colunas, em faixa contida para não esticar 1400px. O trilho
          é NEUTRO de propósito: não pertence a cenário nenhum, e pintá-lo com
          a cor de um deles mentiria sobre o alcance do controle. */}
      {barFixoNaGrade && (
        <div className={`mb-5 border-b pb-4 md:max-w-sm ${filete}`}>
          <Slider
            label="Bar — lucro líquido (R$)"
            moeda
            value={num(evento.outrasReceitas?.bar)}
            onChange={(v, el) =>
              setBarFixo(v, el ? { rotulo: 'mudar Bar — lucro líquido', grupo: el } : undefined)
            }
            min={0}
            max={BAR_FIXO_ARRASTO_MAX}
            step={1000}
            accentColor={dark ? '#c3c2b7' : 'var(--tinta-3)'}
            textClassName={dark ? 'text-[#898781]' : 'text-[var(--tinta-2)]'}
            inputStyle={campoEscuro}
          />
          <p className={`mt-1 text-[11px] ${dark ? 'text-[#898781]' : 'text-[var(--tinta-3)]'}`}>
            Vale para os três cenários — o bar deste evento está em modo “valor fixo”. Para um
            valor por cenário, troque para “por pessoa” na aba Receita.
          </p>
        </div>
      )}
      {/* OPEN BAR: nenhum controle, e a razão escrita. Um slider desabilitado
          convidaria a mexer no que não existe; a frase diz por que não há o que
          arrastar, no mesmo lugar onde o controle estaria. */}
      {isOpenBar(evento) && (
        <p
          className={`mb-5 border-b pb-4 text-xs md:max-w-sm ${filete} ${
            dark ? 'text-[#898781]' : 'text-[var(--tinta-3)]'
          }`}
        >
          Open bar — sem receita de bar. Nada a arrastar aqui; a bebida entra pelos custos.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {CENARIOS.map((cen) => (
          <div key={cen}>
            <div
              className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${
                dark ? 'text-[#e8e7e0]' : 'text-[var(--tinta)]'
              }`}
            >
              <Bola size={10} cor={tons[cen].dot} />
              {CENARIO_LABEL[cen]}
            </div>
            <div className="space-y-3">
              {CAMPOS[cen].map((f) => (
                <Slider
                  key={f.campo}
                  label={f.label}
                  value={valorEfetivo(cfg, cen, f.campo)}
                  onChange={(v, el) =>
                    setCampo(
                      cen,
                      f.campo,
                      v,
                      el ? { rotulo: `mudar ${f.label} (${CENARIO_LABEL[cen]})`, grupo: el } : undefined
                    )
                  }
                  min={f.min}
                  max={f.max}
                  faixa={f.faixa}
                  accentColor={tons[cen].dot}
                  textClassName={dark ? 'text-[#898781]' : 'text-[var(--tinta-2)]'}
                  inputStyle={campoEscuro}
                />
              ))}
              {comTicket && (
                <Field
                  label="Ticket médio (R$)"
                  className={dark ? '[&_span]:text-[#898781]' : ''}
                >
                  <MoneyInput
                    value={cfg[cen]?.ticketMedio ?? ''}
                    onChange={(v) => setCampo(cen, 'ticketMedio', v)}
                    placeholder={tmAuto(cen) ? tmAuto(cen).toFixed(0) : '—'}
                    style={campoEscuro}
                    faixa={FAIXA_PRECO}
                  />
                  {tmEfetivoManual(cen) != null && (
                    <p
                      className={`mt-1 text-[11px] ${dark ? 'text-[#898781]' : 'text-[var(--tinta-3)]'}`}
                    >
                      com o ajuste de {num(cfg[cen]?.ticketPct) > 0 ? '+' : ''}
                      {num(cfg[cen]?.ticketPct)}%: {fmtBRL2(tmEfetivoManual(cen))}
                    </p>
                  )}
                </Field>
              )}
              {/* O bar fica SEMPRE por último na coluna, então a ordem é a
                  mesma no editor (que mostra o Ticket médio) e na
                  apresentação (que não mostra). */}
              {barPorCenario && (
                <div className={`border-t pt-3 ${filete}`}>
                  <Slider
                    label="Bar por pessoa (R$)"
                    moeda
                    value={num(evento.barTicket?.[cen])}
                    onChange={(v, el) =>
                      setBar(
                        cen,
                        v,
                        el
                          ? { rotulo: `mudar Bar por pessoa (${CENARIO_LABEL[cen]})`, grupo: el }
                          : undefined
                      )
                    }
                    min={0}
                    max={BAR_ARRASTO_MAX}
                    faixa={FAIXA_CONSUMO}
                    accentColor={tons[cen].dot}
                    textClassName={dark ? 'text-[#898781]' : 'text-[var(--tinta-2)]'}
                    inputStyle={campoEscuro}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
