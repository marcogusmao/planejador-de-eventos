// Acompanhamento de vendas — versão P da sugestão 10 (única aprovada):
// um campo "vendidos até hoje" + regra de três contra o break-even do
// realista que computeCenario já calcula. A curva completa NÃO está aprovada.
import { ritmoVendas } from '../lib/calc.js'
import { inicioVendasParaRitmo } from '../lib/curvaVendas.js'
import { hojeISO } from '../lib/dataLocal.js'
import { carimboCampo } from '../lib/financeiro.js'
import { fmtInt } from '../lib/format.js'
import {
  avisoRitmoQuantidadeTravada,
  DATA_DO_EVENTO_ILEGIVEL,
  dataDoEventoIlegivel,
  fraseRitmo,
  fraseRitmoNaoFecha,
  MARCACAO_REALIZADA,
  ritmoPorDia,
} from '../lib/resumo.js'
import { Card, Field, NumInput, Bola } from './ui.jsx'
import { FAIXA_QUANTIDADE } from '../lib/campoNumerico.js'
import { NotaLoteSemPreco } from './AvisoLoteSemPreco.jsx'

// O relógio mora em src/lib/dataLocal.js desde o conserto de 20/07/2026 (era
// duplicado aqui e em resumo.js, os dois em UTC — na noite da festa o app
// dava a festa por realizada). Re-export mantém os consumidores existentes.
export { hojeISO }

/** Carimbo de origem+hora de um valor puxado da ponte (Sessão H): "via
 *  Financeiro em 18/07 14:32". Some quando o campo nunca foi puxado; avisa
 *  quando a mão editou por cima — a fonte de verdade é o campo. */
export function CarimboFinanceiro({ registro, valorAtual }) {
  const c = carimboCampo(registro, valorAtual)
  if (!c) return null
  return (
    <p className={`mt-1 text-[10px] ${c.manual ? 'text-[var(--tinta-3)]' : 'text-[var(--azul-texto)]'}`}>{c.texto}</p>
  )
}

// A frase da leitura mora em src/lib/resumo.js desde a Sessão K (o card e o
// "Copiar resumo" usam o MESMO texto); re-export mantém consumidores antigos.
export { fraseRitmo }

/** Card na aba Cenários: campo editável + leitura derivada. */
export function RitmoVendasCard({ evento, update, breakEvenRealista, breakEvenNaoFecha, cenarios = null }) {
  const r = ritmoVendas({
    vendidos: evento.vendidosAteHoje,
    dataEvento: evento.data,
    breakEven: breakEvenRealista,
    hoje: hojeISO(),
    // F2-S (sugestão 30): vendas ainda fechadas → semanas da janela restante
    inicioVendas: inicioVendasParaRitmo(evento),
  })
  const aviso = avisoRitmoQuantidadeTravada(evento, hojeISO(), cenarios)
  const frase = aviso?.texto ?? fraseRitmo(r)
  const semDado = evento.vendidosAteHoje === '' || evento.vendidosAteHoje == null
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            Estamos vendendo no ritmo?
            {/* contexto no card: um print recortado se explica sozinho */}
            <span className="text-[10px] font-normal text-[var(--tinta-3)]">
              {[evento.nome, evento.data ? evento.data.split('-').reverse().join('/') : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-[var(--tinta-3)]">
            Cole o total vendido da bilheteria (ex.: Tiqueteira) 1× por semana — ou traga pela ponte
            “Buscar dados do Financeiro”.
          </p>
        </div>
        <Field label="Vendidos até hoje" className="w-36">
          <NumInput
            value={evento.vendidosAteHoje ?? ''}
            onChange={(v) => update((e) => ({ ...e, vendidosAteHoje: v }))}
            placeholder="—"
            min="0"
            step="1"
            faixa={FAIXA_QUANTIDADE}
          />
          <CarimboFinanceiro
            registro={evento.financeiro?.puxado?.vendidosAteHoje}
            valorAtual={evento.vendidosAteHoje}
          />
        </Field>
        {frase ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--tinta)]">
            {/* saúde do ritmo mora na BOLA (verde vai bem · âmbar corre atrás ·
                neutro festa passada); o texto fica neutro (Marco 24/07). */}
            <Bola
              size={8}
              cor={
                // Data ilegível fica NEUTRA junto com a festa passada: verde
                // ("vai bem") e âmbar ("corre atrás") são os dois errados para
                // uma frase que não fala de venda nenhuma, e o `cobriu` pode
                // estar ligado ao mesmo tempo (faltam ≤ 0 não depende da data).
                // Quantidade travada (S6): a frase não fala de venda — âmbar
                // como aviso, ou neutra quando a festa já passou.
                aviso
                  ? aviso.tom === 'neutro'
                    ? 'var(--tinta-3)'
                    : 'var(--ambar-texto)'
                  : r.eventoPassado || dataDoEventoIlegivel(r)
                    ? 'var(--tinta-3)'
                    : r.cobriu
                      ? 'var(--verde-texto)'
                      : 'var(--ambar-texto)'
              }
            />
            {frase}
          </p>
        ) : (
          <p className="text-xs text-[var(--tinta-3)]">
            {/* Marco, 27/07/2026. O aviso de "não fecha" vem PRIMEIRO, antes de
                "preencha o campo" e de "defina a data": ele é a verdade sobre o
                cenário, e as outras duas mandam consertar algo que não muda o
                resultado — preencher os vendidos até hoje não faz aparecer um
                ritmo que não existe. O texto é o MESMO das outras três telas
                (fraseRitmoNaoFecha, em resumo.js); festa que já aconteceu ganha
                lá a marcação de realizada, em vez de falar de futuro. */}
            {breakEvenNaoFecha
              ? fraseRitmoNaoFecha(evento).texto
              : semDado
                ? 'Preencha o campo para ver o ritmo necessário até a festa.'
                : !evento.data
                  ? 'Defina a data do evento para calcular o ritmo.'
                  : 'Sem break-even calculável (preencha lotes com valor).'}
          </p>
        )}
      </div>
      {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026): o
          "faltam N" acima mede contra o break-even do realista, que já não
          conta o lote — a linha curta diz por quê. */}
      <NotaLoteSemPreco evento={evento} className="mt-2" />
    </Card>
  )
}

/** Linha compacta para o card da Home (só leitura; null quando não se aplica).
 *
 *  `breakEvenNaoFecha` é o QUARTO parâmetro pelo mesmo motivo de
 *  `linhaRitmoRelatorio`: `hoje` já era o terceiro em todos os chamadores e
 *  testes, e relógio não se muda de lugar de carona numa chave nova. */
export function linhaRitmoHome(evento, breakEvenRealista, hoje = hojeISO(), breakEvenNaoFecha = false, cenarios = null) {
  const aviso = avisoRitmoQuantidadeTravada(evento, hoje, cenarios)
  if (aviso) return aviso
  const r = ritmoVendas({
    vendidos: evento.vendidosAteHoje,
    dataEvento: evento.data,
    breakEven: breakEvenRealista,
    hoje,
    inicioVendas: inicioVendasParaRitmo(evento),
  })
  // Sem break-even PORQUE o realista não fecha nem vendendo tudo: o card da
  // Home ficava sem linha nenhuma — indistinguível de uma festa que ainda não
  // tem dado (Marco, 27/07/2026). A frase é a MESMA das outras três telas.
  if (!r) return breakEvenNaoFecha ? fraseRitmoNaoFecha(evento, hoje) : null
  // Festa já realizada: o card da Home mostrava EXATAMENTE o mesmo que o de
  // uma festa futura. Agora carrega a marcação — em tom neutro, porque verde
  // ("vai bem") e âmbar ("corre atrás") são os dois errados para uma festa
  // que já aconteceu. Mesmo texto do card cheio, sem encurtar.
  if (r.eventoPassado) return { tom: 'neutro', texto: MARCACAO_REALIZADA }
  // A DATA DA FESTA NÃO É UMA DATA (30/08/2026). Vem antes do `cobriu` e antes
  // do ritmo: era aqui que a Home imprimia "Faltam 613 p/ break-even · 0/dia"
  // — o zero nasce de NaN e é a tela afirmando que não falta vender nada por
  // dia. Agora a linha diz o problema, e a única coisa que ela não faz é
  // mostrar um número.
  if (dataDoEventoIlegivel(r)) return { tom: 'alerta', texto: DATA_DO_EVENTO_ILEGIVEL }
  if (r.cobriu) return { tom: 'ok', texto: `Break-even coberto (${fmtInt(r.vendidos)} vendidos)` }
  // O ritmo é em DIAS (Marco, 10/08/2026) — a mesma fonte única da frase longa,
  // para a Home e o card cheio nunca mostrarem unidades diferentes.
  const d = ritmoPorDia(r)
  // A semana final agora TEM ritmo (Marco, 10/08/2026), então o que sobra aqui
  // são os dois casos sem janela: a festa é hoje, ou as vendas nem chegam a
  // abrir antes dela. A unidade acompanha a frase longa de propósito — as
  // quatro telas nunca divergem de unidade.
  if (!d)
    return {
      tom: 'alerta',
      texto: `Faltam ${fmtInt(r.faltam)} p/ break-even · ${r.dias === 0 ? 'a festa é hoje' : 'menos de um dia de venda'}`,
    }
  return {
    tom: 'alerta',
    texto: `Faltam ${fmtInt(r.faltam)} p/ break-even · ${fmtInt(d.porDia)}/dia`,
  }
}
