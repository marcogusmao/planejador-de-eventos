import { useEffect, useState } from 'react'
import { computeCenarios, CENARIOS, CENARIO_LABEL, veredito, isOpenBar } from '../lib/calc.js'
import { fmtBRL, fmtBRL2, fmtInt, fmtPct, fmtData, DASH, fonteQueCabe } from '../lib/format.js'
import { GroupedBars, VIZ, CENARIO_TONS } from './Charts.jsx'
import { Bola } from './ui.jsx'
import { AppIcon, FlaskConical } from './AppIcon.jsx'
import { AssinaturaFesta } from './Marca.jsx'
import { VEREDITO_CORES, fraseVeredito } from './Veredito.jsx'
import SimuladorSliders from './Simulador.jsx'
import { corFesta } from '../lib/aparencia.js'
import { textoBreakEven } from '../lib/breakEvenTexto.js'
import { impostoTexto, impostoValor, temImposto } from '../lib/imposto.js'
import {
  rascunhoDoEvento,
  editarRascunho,
  resumoDoRascunho,
  visaoDoRascunho,
  aplicarRascunho,
} from '../lib/simulacaoRascunho.js'
import { snapshotSeguranca } from '../lib/protecao.js'
import { showToast } from '../lib/toast.js'
import {
  premissaDesconto,
  premissaTaxa,
  premissaBar,
  premissasCurva,
  legendasRelatorio,
} from '../lib/premissaTexto.js'
import { num, agora } from '../lib/util.js'
import { dataLocalDoInstante } from '../lib/dataLocal.js'
import { resultadoQueFecha } from '../lib/exibicaoQueFecha.js'
import AvisoCustoQuebrado, {
  AvisoReceitaQuebrada,
  faixaDaFotoSa,
  NUMERO_NAO_CALCULA,
} from './AvisoCustoQuebrado.jsx'
import AvisoLoteSemPreco from './AvisoLoteSemPreco.jsx'
import {
  cenarioQuebrado,
  receitaDoCenarioQuebrada,
  vereditoQuebrado as vereditoQuebradoLib,
  fraseVereditoQuebrado,
  fotoQuebrada,
  cabeComoDinheiro,
  fmtOuIlegivel
} from '../lib/dadoQuebrado.js'

// Identidade dos cenários no escuro (Charts.jsx, validada na superfície
// preta): pessimista âmbar · realista azul · otimista rosa.
const DOT = {
  pessimista: CENARIO_TONS.dark.pessimista.dot,
  realista: CENARIO_TONS.dark.realista.dot,
  otimista: CENARIO_TONS.dark.otimista.dot,
}
// lucro/prejuízo no preto: verde/vermelho vivos (contraste de projetor e de
// vídeo comprimido — share de tela em call é uso de primeira classe)
const LUCRO_DARK = { pos: '#2fbf6b', neg: '#ff5a63' }

export default function PresentationMode({ evento, store, update, aparencia, onClose }) {
  // Modo apresentação nasce JÁ SIMULANDO (sugestão 35, F2-V): a reunião é
  // protegida por padrão — mexer nos sliders edita um RASCUNHO em memória
  // (cards e semáforo desta tela reagem ao vivo), e NADA grava no evento sem
  // "Aplicar". Sair (Esc) descarta o rascunho — ele morre com esta tela.
  const [rascunho, setRascunho] = useState(() => rascunhoDoEvento(evento))
  const eventoView = visaoDoRascunho(evento, rascunho)
  const updateCenarios = (fn) => setRascunho((r) => editarRascunho(r, evento, fn))
  const mudancas = resumoDoRascunho(rascunho, evento.lotes)
  const aplicarSimulacao = () => {
    if (mudancas.length === 0) return
    // Evento fechado: mesmo portão do editor — a trava do funil bloquearia a
    // gravação em silêncio e o toast afirmaria "aplicada" (achado adversarial
    // 20/07/2026). Apresentar/simular pode; gravar não.
    if (evento?.status === 'fechado') {
      showToast(
        'Este evento está fechado — a simulação NÃO foi aplicada. Reabra na aba Fechamento para editar.'
      )
      return
    }
    const seg = snapshotSeguranca(store, agora(), `antes de aplicar simulação — ${evento.nome}`)
    if (!seg.ok) {
      window.alert(
        `Não deu para criar o snapshot de segurança antes de aplicar (${seg.erro || 'armazenamento cheio'}). ` +
          'Nada foi aplicado — o rascunho continua na tela.'
      )
      return
    }
    const n = mudancas.length
    // MESMA função do editor (simulacaoRascunho.js): é ela que sabe qual slot
    // vai em qual campo do evento — cenários, bar por pessoa e bar fixo.
    //
    // E updater FUNCIONAL, como o editor: `aplicarRascunho` roda sobre o `e`
    // que o store entrega, nunca sobre a cópia do closure. Escrito assim
    // depois de a revisão adversarial de 05/08/2026 medir que as duas telas
    // tinham divergido justamente no envelope da função que existe para elas
    // não divergirem — com a suíte verde. Gravar a foto do closure descarta
    // qualquer mudança salva entre o último render e o clique.
    update((e) => aplicarRascunho(e, rascunho), 'aplicar a simulação aos cenários')
    // Continua simulando (reunião segue protegida): o rascunho recomeça
    // idêntico ao que acabou de ser aplicado — `eventoView` JÁ é o evento com
    // os valores do rascunho, então isto é uma cópia profunda deles.
    setRascunho(rascunhoDoEvento(eventoView))
    showToast(`${n} ${n === 1 ? 'mudança aplicada' : 'mudanças aplicadas'} ao evento — snapshot criado antes.`)
  }
  const descartarSimulacao = () => {
    setRascunho(rascunhoDoEvento(evento))
    showToast('Rascunho descartado — os cenários voltaram ao que está salvo.')
  }

  const c = computeCenarios(eventoView)
  const v = veredito(c, eventoView)
  const corV = VEREDITO_CORES[v.cor]
  // Dado quebrado (Marco, 26/07/2026; aplicado à Apresentação em 05/10/2026).
  // Medido: esta tela projetava na reunião "Lucro R$ 42.750" — igual à
  // receita — para uma festa com um custo infinito, e o resultado real da
  // festa fechada em verde. Lucro, resultado, margem e veredito viram texto;
  // a faixa vem antes de tudo. Nenhuma conta muda.
  const cenQuebrado = (s) => cenarioQuebrado(eventoView, s, c)
  const recQuebrada = (s) => receitaDoCenarioQuebrada(eventoView, s, c)
  const algumCenarioQuebrado = CENARIOS.some((k) => cenQuebrado(c[k]) || recQuebrada(c[k]))
  const vereditoQuebrado = vereditoQuebradoLib(eventoView, c)
  const resultadoRealQuebrado = fotoQuebrada(
    evento.status === 'fechado' ? evento.fechamento?.foto?.resultado : null
  )
  // "Como ler" mostrar/esconder na apresentação (tema C) — começa escondido
  // para a tela abrir limpa; abre com um clique quando a sócia pergunta.
  const [mostrarLegenda, setMostrarLegenda] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-[#898781]">
              Plano financeiro
            </p>
            <h1 className="mt-1 flex items-center gap-3 text-4xl font-semibold tracking-tight">
              {(evento.tipo || '').trim() && (
                <Bola size={22} cor={corFesta(evento.tipo, aparencia, true)} title={evento.tipo} />
              )}
              {evento.nome}
            </h1>
            <p className="mt-1 text-lg text-[#c3c2b7]">
              {[fmtData(evento.data), evento.local].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#c3c2b7] hover:bg-white/10"
          >
            Sair (Esc)
          </button>
        </div>

        {/* A faixa de dado quebrado — a mesma das abas, com o texto do que
            ESTA tela faz. Ela tem fundo próprio, então se lê sobre o preto. */}
        <AvisoCustoQuebrado
          evento={eventoView}
          efeito="lucro"
          numeroQuebrouAqui={algumCenarioQuebrado || resultadoRealQuebrado}
          {...faixaDaFotoSa(eventoView, algumCenarioQuebrado || resultadoRealQuebrado)}
          className="mb-6"
        />
        <AvisoReceitaQuebrada evento={eventoView} className="mb-6" />
        {/* Lote sem preço (P8, Marco 06/10/2026): lê o RASCUNHO, como as outras faixas. */}
        <AvisoLoteSemPreco evento={eventoView} variante="apresentacao" className="mb-6" />

        {/* Festa FECHADA: a faixa da reunião mostra o RESULTADO REAL da foto
            (decisão do Marco, 20/07/2026), não a projeção — a bola é o sinal
            do resultado (verde lucro, vermelho prejuízo). Festa aberta segue
            com o veredito projetado de sempre. */}
        {evento.status === 'fechado' && evento.fechamento?.foto?.resultado ? (
          (() => {
            const f = evento.fechamento.foto.resultado
            // `null >= 0` é verdadeiro: sem a guarda, foto quebrada saía verde.
            const corReal = resultadoRealQuebrado
              ? { bola: '#5a5952' }
              : f.resultado >= 0
                ? VEREDITO_CORES.verde
                : VEREDITO_CORES.vermelho
            return (
              <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1a1a19] px-6 py-4">
                <Bola cor={corReal.bola} size={40} title="Resultado real do fechamento" />
                <div>
                  <p className="text-xl leading-snug text-[#f0ebe7]">
                    Festa realizada — resultado real{' '}
                    <strong className="tnum">
                      {resultadoRealQuebrado
                        ? NUMERO_NAO_CALCULA
                        : fmtBRL(resultadoQueFecha({ receita: f.receita, imposto: f.imposto?.valor, custos: f.custos }))}
                    </strong>
                  </p>
                  {/* O IMPOSTO ENTRA NESTA LINHA (Marco, 27/07/2026) porque sem
                      ele ela NÃO FECHA com o resultado da linha de cima — e
                      esta é a tela PROJETADA na reunião das sócias, onde a
                      pergunta "por que não soma?" custa a confiança no número
                      inteiro. Só aparece quando o evento tem imposto. */}
                  <p className="mt-0.5 text-sm text-[#c3c2b7]">
                    fechado em {fmtData(dataLocalDoInstante(evento.fechamento.em))} · receita real{' '}
                    {cabeComoDinheiro(f.receita) && f.receita != null ? fmtBRL(f.receita) : NUMERO_NAO_CALCULA}
                    {f.imposto ? ` · imposto ${fmtBRL(f.imposto.valor)}` : ''} · custos{' '}
                    {cabeComoDinheiro(f.custos) && f.custos != null ? fmtBRL(f.custos) : NUMERO_NAO_CALCULA}
                    {f.completo ? '' : ' · com pendência declarada'}
                  </p>
                </div>
              </div>
            )
          })()
        ) : (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1a1a19] px-6 py-4">
            <Bola
              cor={vereditoQuebrado ? '#5a5952' : corV.bola}
              size={40}
              title={vereditoQuebrado ? 'Sem veredito' : `Semáforo: ${v.cor}`}
            />
            <p className="text-xl leading-snug text-[#f0ebe7]">
              {vereditoQuebrado ? fraseVereditoQuebrado(eventoView) : fraseVeredito(c, v)}
            </p>
          </div>
        )}

        {update && (
          <div className="mb-6">
            {/* Faixa do rascunho (F2-V): a reunião mexe sem medo — o botão diz
                o efeito e a contagem; o title lista o diff completo. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed border-[rgba(120,150,255,0.4)] bg-[#1b2030] px-5 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#aebfff]">
                <AppIcon icon={FlaskConical} /> Simulando — nada está sendo salvo
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-[#898781]" title={mudancas.join('\n')}>
                {mudancas.length === 0
                  ? 'Mexa nos sliders abaixo: os cards e o semáforo desta tela respondem na hora.'
                  : mudancas.length <= 2
                    ? mudancas.join(' · ')
                    : `${mudancas.slice(0, 2).join(' · ')} · +${mudancas.length - 2} ${mudancas.length - 2 === 1 ? 'outra' : 'outras'}`}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={aplicarSimulacao}
                  disabled={mudancas.length === 0}
                  title={
                    mudancas.length === 0
                      ? 'Nada mudou ainda — não há o que aplicar'
                      : `Cria um snapshot de segurança e grava no evento:\n${mudancas.join('\n')}`
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    mudancas.length === 0
                      ? 'cursor-not-allowed border-white/10 text-[#5a5952]'
                      : 'cursor-pointer border-[rgba(120,150,255,0.5)] text-[#aebfff] hover:bg-white/10'
                  }`}
                >
                  {mudancas.length === 0
                    ? 'Aplicar ao evento'
                    : `Aplicar ${mudancas.length} ${mudancas.length === 1 ? 'mudança' : 'mudanças'} ao evento`}
                </button>
                <button
                  type="button"
                  onClick={descartarSimulacao}
                  disabled={mudancas.length === 0}
                  title="Joga o rascunho fora — os cenários desta tela voltam ao que está salvo no evento"
                  className={`rounded-lg border border-white/15 px-3 py-1.5 text-sm ${
                    mudancas.length === 0 ? 'cursor-not-allowed text-[#5a5952]' : 'cursor-pointer text-[#c3c2b7] hover:bg-white/10'
                  }`}
                >
                  Descartar
                </button>
              </span>
            </div>
            <SimuladorSliders evento={eventoView} update={updateCenarios} dark simulando />
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CENARIOS.map((k) => {
            const s = c[k]
            return (
              <div
                key={k}
                className="rounded-2xl border border-white/10 bg-[#1a1a19] p-6"
                style={{ borderTop: `3px solid ${DOT[k]}` }}
              >
                <div className="flex items-center gap-2">
                  <Bola size={13} cor={DOT[k]} />
                  <h2 className="text-lg font-semibold">{CENARIO_LABEL[k]}</h2>
                </div>
                <div className="mt-5" style={{ containerType: 'inline-size' }}>
                  <div className="text-sm text-[#898781]">Lucro</div>
                  {cenQuebrado(s) ? (
                    <div className="text-2xl font-semibold text-[#c3c2b7]">{NUMERO_NAO_CALCULA}</div>
                  ) : (
                    <>
                      <div
                        className="tnum whitespace-nowrap font-semibold tracking-tight"
                        style={{
                          color: s.lucro >= 0 ? LUCRO_DARK.pos : LUCRO_DARK.neg,
                          // text-5xl como teto; encolhe para caber com centavos
                          fontSize: fonteQueCabe(fmtBRL2(s.lucro), 3),
                          lineHeight: 1,
                        }}
                      >
                        {/* com centavos: o mesmo lucro que o DRE da aba
                            Cenários escreve, e a subtração da Receita, do
                            Imposto e do Custo logo abaixo — Marco,
                            07/10/2026, P6 refeito */}
                        {fmtBRL2(s.lucro)}
                      </div>
                      <div className="mt-1 text-sm text-[#898781]">margem {fmtPct(s.margem)}</div>
                    </>
                  )}
                </div>
                <dl className="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-base">
                  {[
                    // receita do cenário que não é dinheiro (05/10/2026)
                    ['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.receitaTotal)],
                    // Modo apresentação é a tela da REUNIÃO — é onde a sócia
                    // soma receita menos custo em voz alta. Sem esta linha o
                    // lucro gigante em cima não fecha com os dois números
                    // logo abaixo dele, na frente de todo mundo.
                    ...(temImposto(s)
                      ? [['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL2(impostoValor(s))}`]]
                      : []),
                    ['Custo', fmtBRL2(s.custoTotal)],
                    ['Público', recQuebrada(s) ? NUMERO_NAO_CALCULA : `${fmtInt(s.publico)}`],
                    ['Break-even', cenQuebrado(s) || recQuebrada(s) ? NUMERO_NAO_CALCULA : textoBreakEven(s, ' pagos', eventoView, c)],
                    [
                      'Custo/pessoa',
                      recQuebrada(s) ? NUMERO_NAO_CALCULA : s.custoPorPessoa == null ? DASH : fmtBRL2(s.custoPorPessoa),
                    ],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between gap-3">
                      <dt className="text-[#898781]">{l}</dt>
                      <dd className="tnum font-medium text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#1a1a19] p-6">
          {algumCenarioQuebrado ? (
            <p className="text-base text-[#c3c2b7]">Gráfico sem dados: lucro {NUMERO_NAO_CALCULA}.</p>
          ) : (
          <GroupedBars
            dark
            groups={CENARIOS.map((k) => ({
              label: CENARIO_LABEL[k],
              values: [c[k].receitaTotal, c[k].custoTotal, c[k].lucro],
            }))}
            series={[
              { label: 'Receita', color: VIZ.dark.receita },
              { label: 'Custo', color: VIZ.dark.custoNeutro },
              {
                label: 'Lucro',
                color: VIZ.dark.lucro,
                colorFn: (val) => (val < 0 ? VIZ.dark.prejuizo : VIZ.dark.lucro),
              },
            ]}
            labelSeries="all"
          />
          )}
        </div>

        {num(evento.descontoMedioPct) !== 0 && (
          <p className="mt-6 text-center text-sm text-[#898781]">
            Premissa: {premissaDesconto(evento)} — já aplicado na receita de bilheteria prevista.
          </p>
        )}
        {premissaTaxa(evento) && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Premissa: {premissaTaxa(evento)} — o cliente paga o preço final com a taxa.
          </p>
        )}
        {temImposto(c.realista) && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Premissa: imposto de {impostoTexto(c.realista.imposto)} — bilheteria pela BRUTA
            (antes da comissão e do cashback); deduzido da receita, fora da base da contingência.
          </p>
        )}
        {premissasCurva(evento).length > 0 && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Premissa: {premissasCurva(evento).join(' · ')}.
          </p>
        )}
        {isOpenBar(evento) && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Evento open bar — sem receita de bar nesta conta (custos de bar lançados normalmente).
          </p>
        )}
        {premissaBar(evento) && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Premissa: {premissaBar(evento)} — o bar de cada cenário usa o próprio público.
          </p>
        )}
        {c.realista.patrocinioPotencial > 0 && (
          <p className="mt-3 text-center text-sm text-[#898781]">
            Fora desta conta: {fmtOuIlegivel(c.realista.patrocinioPotencial, fmtBRL)} de patrocínio em proposta —
            potencial, só entra na receita quando confirmar.
          </p>
        )}
        {/* Rodapé: assinatura POR FESTA (dark-aware) + legendas mostrar/esconder
            (tema C). Assinatura na cor da marca legível no preto verdadeiro. */}
        <div className="mt-8 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <AssinaturaFesta tipo={evento.tipo} height={26} dark className="shrink-0" />
            <button
              type="button"
              onClick={() => setMostrarLegenda((m) => !m)}
              className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#c3c2b7] hover:bg-white/10"
            >
              {mostrarLegenda ? 'Esconder legendas' : 'Como ler este relatório'}
            </button>
          </div>
          {mostrarLegenda && (
            <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              {legendasRelatorio(eventoView, cenQuebrado(c.realista) || recQuebrada(c.realista) ? null : c.realista, c).map(([termo, def]) => (
                <div key={termo}>
                  <dt className="font-semibold text-[#f0ebe7]">{termo}</dt>
                  <dd className="text-[#898781]">{def}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-5 text-center text-xs text-[#898781]">
            Modo apresentação · a simulação acima é rascunho — nada é salvo sem “Aplicar” ·
            pressione Esc para voltar (o rascunho é descartado)
          </p>
        </div>
      </div>
    </div>
  )
}
