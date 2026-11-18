// Aba Análise — "vamos ter caixa?" (Sessão F2-C, sugestão 15 do MELHORIAS.md).
//
// A CONTA APROVADA pelo Marco (19/07/2026) mora em src/lib/analiseCaixa.js e
// aparece POR ESCRITO no rodapé desta aba. Esta tela é 100% LEITURA sobre o
// evento + a curva do plano da F2-B (modo selecionado na aba Cenários): o
// único campo editável aqui é o "caixa inicial do evento" (campo do evento,
// opcional, padrão R$ 0). Semáforo e DRE NÃO leem nada daqui.

import { useState } from 'react'
import { Btn, Card, Stat, Field, MoneyInput } from './ui.jsx'
import { AppIcon, RefreshCw, TriangleAlert, CircleCheck } from './AppIcon.jsx'
import { LinhasCurva, VIZ } from './Charts.jsx'
import {
  buscarCurvaFinanceiro,
  loadCurvaCache,
  saveCurvaCache,
  diaRelativoHoje,
  mediaHistorica,
  mensagensAjustesCurva,
  mediaHistoricaNormalizada,
  inicioVendasEfetivo,
  curvaPlanoJanela,
  refIdsDaCurva,
  totalPlanoLotes,
  curvaPlanoForma,
  curvaPlanoDatas,
  modoCurva,
} from '../lib/curvaVendas.js'
import { analisarCaixa, temAgendaDePagamento } from '../lib/analiseCaixa.js'
import { fmtDataHora } from '../lib/financeiro.js'
import { fmtBRL, fmtBRL2, fmtCompact, fmtData } from '../lib/format.js'
import { hojeISO } from './RitmoVendas.jsx'
import { Badge } from './ui.jsx'
import { estiloStatusCusto } from '../lib/statusCusto.js'
import { agora, num } from '../lib/util.js'
import { origemNaNuvem, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import AvisoCustoQuebrado from './AvisoCustoQuebrado.jsx'
import { cabeComoDinheiro, fmtOuIlegivel } from '../lib/dadoQuebrado.js'

const rotuloDia = (dia) => (dia === 0 ? 'dia da festa' : `D${dia}`)

/**
 * TODOS os avisos que esta aba tem de mostrar, numa função pura e testável.
 *
 * Mora fora do componente porque a lista deixou de ser só "pré-requisito que
 * falta": ela agora carrega também os AVISOS DO PRÓPRIO PLANO — as frases que
 * `curvaPlanoDatas` gera quando encosta a virada de um lote na virada anterior,
 * no dia da festa ou no início de vendas.
 *
 * ACHADO QUE ISTO CONSERTA (verificação adversarial da reordenação, rodada 2,
 * 20/07/2026). Esses avisos SEMPRE existiram e SEMPRE foram gerados, mas só a
 * seção da curva (CurvaVendas.jsx) os exibia. Esta aba consumia apenas
 * `plano.pontos` e jogava `plano.avisos` fora — e a conta que ela mostra
 * (“Caixa mínimo para iniciar”) depende justamente do encosto que o aviso
 * explica. Medido: mover “Lote 3” duas posições para cima leva o caixa mínimo
 * de D-38 / −R$ 9.300 para D-18 / −R$ 24.760, gerando 2 avisos — e a tela
 * mostrava ZERO. Número diferente, sem uma palavra: princípio 4.
 *
 * O silêncio é anterior às setas ↑↓ (bastava digitar as datas fora de ordem);
 * a feature só o deixou a dois cliques de distância.
 */
export function mensagensDoPlano({ evento, modo, plano, planoOk, totalPlano, cache, media }) {
  const msgs = []
  if (!evento?.data)
    msgs.push('Defina a data do evento (no topo da tela) — sem ela não existe "dias até a festa".')
  if (totalPlano <= 0)
    msgs.push('Preencha os lotes (preço e quantidade) na aba Receita — a curva do plano é a linha de entrada da conta.')
  if (totalPlano > 0 && modo === 'forma' && !planoOk)
    msgs.push(
      cache
        ? 'O plano "pela forma histórica" precisa de festas passadas com vendas no Financeiro. Sem histórico, troque para o modo "pelas datas dos lotes" na aba Cenários & Resultado.'
        : 'O plano "pela forma histórica" precisa da média histórica — clique em "Buscar curva no Financeiro" (com o Financeiro aberto) ou troque para o modo "pelas datas dos lotes" na aba Cenários & Resultado.'
    )
  if (totalPlano > 0 && modo === 'datas' && plano?.erro === 'sem-nenhuma-virada')
    msgs.push('Nenhum lote tem virada prevista — preencha as datas na aba Cenários & Resultado (seção da curva de vendas), ou use o modo "pela forma histórica".')
  // Os avisos do próprio plano — as mesmas frases que a seção da curva mostra.
  // Vêm por último porque os de cima são "falta preencher" e estes são "a
  // conta que você está vendo foi ajustada, e aqui está por quê".
  if (modo === 'datas' && planoOk)
    for (const a of plano?.avisos || []) if (!msgs.includes(a)) msgs.push(a)
  if (modo === 'forma') msgs.push(...mensagensAjustesCurva(media))
  return msgs
}

export default function AnaliseTab({ evento, update }) {
  const [cache, setCache] = useState(loadCurvaCache)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState(null)

  const buscar = async () => {
    setBuscando(true)
    setErro(null)
    try {
      const curva = await buscarCurvaFinanceiro()
      const em = agora()
      saveCurvaCache(curva, em) // falha de cache não derruba: o dado está em memória
      setCache({ em, curva })
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  const hoje = hojeISO()
  const diaHoje = diaRelativoHoje(evento.data, hoje)
  const totalPlano = totalPlanoLotes(evento)
  const opcoesRef = {
    tipo: evento.tipo,
    empresaVinculo: evento.financeiro?.empresa,
    hoje,
    excluirEventoId: evento.financeiro?.eventoId,
    // a MESMA referência escolhida na curva (bloco 3 da F2-S) — as duas
    // abas contam a mesma história
    refIds: refIdsDaCurva(evento),
  }
  const media = cache ? mediaHistorica(cache.curva, opcoesRef) : null
  // Início de vendas (Sessão F2-S — sugestão 30): antes dele o plano não
  // gera entrada NENHUMA — as saídas continuam, e o "caixa mínimo para
  // iniciar" fica mais verdadeiro. Mesma seleção de plano da aba Cenários.
  const ini = inicioVendasEfetivo(evento)
  const iniValido = ini && !ini.depoisDaFesta && ini.dia != null && ini.dia <= 0 ? ini : null
  const mediaNorm = cache && iniValido ? mediaHistoricaNormalizada(cache.curva, opcoesRef) : null
  const modo = modoCurva(evento)
  const plano =
    totalPlano > 0
      ? modo === 'datas'
        ? curvaPlanoDatas(evento, { inicioDia: iniValido ? iniValido.dia : null })
        : iniValido
          ? curvaPlanoJanela(evento, mediaNorm, iniValido.dia)
          : curvaPlanoForma(evento, media)
      : null
  const planoOk = plano && !plano.erro && Array.isArray(plano.pontos)
  const analise = planoOk ? analisarCaixa(evento, plano.pontos) : null

  // ————— avisos (nada some em silêncio) — a lista mora em `mensagensDoPlano`,
  // fora do componente, para poder ser testada sozinha. Inclui os avisos do
  // PRÓPRIO plano, que esta aba jogava fora (ver o bloco lá em cima).
  const pendencias = mensagensDoPlano({
    evento, modo, plano, planoOk, totalPlano, cache,
    media: iniValido ? mediaNorm : media,
  })

  // Os números que esta aba IMPRIME são dinheiro? É o que escolhe a frase da
  // faixa (05/10/2026, 2ª revisão do PR #98). Antes ela decidia por
  // `somaNaoCabe` e dizia "centenas de dígitos" numa tela que imprimia "Vamos
  // ter caixa? Sim" e "Caixa mínimo R$ 0 em D-60" — números certos, porque com
  // o realizado lançado a linha do tempo usa o realizado. Sem análise na tela
  // (falta curva ou data) não há número nenhum, e a frase é a de "não usado".
  const numerosDaAnalise = analise?.ok
    ? [
        analise.caixaMinimo?.saldo,
        analise.primeiroNegativo?.saldo,
        analise.saldoFesta,
        analise.totalEntradas,
        analise.totalSaidas,
        analise.caixaInicial,
        ...(analise.dias || []).map((d) => d.saldo),
        ...(analise.agenda || []).flatMap((x) => [x.valor, x.saldoNoDia]),
        ...(analise.semData || []).map((x) => x.valor),
        ...(analise.posFesta || []).map((x) => x.valor),
        ...(analise.divergencias || []).flatMap((d) => [d.soma, d.valor]),
      ]
    : []
  const analiseQuebrada = !numerosDaAnalise.every(cabeComoDinheiro)

  const saldoCor = (v) =>
    v < 0 ? 'text-[var(--vermelho-texto)]' : 'text-[var(--verde-texto)]'

  return (
    <div className="space-y-5">
      {/* Dado quebrado (Marco, 26/07/2026). Esta aba ficou de fora da primeira
          rodada, e ela é a que MAIS grita: com um custo que não cabe numa conta
          de dinheiro, ela não escreve R$ 0 — escreve o número por extenso.
          Medido em 26/07/2026, festa com "Som e luz" em 1 seguido de 308 zeros:
            "Vamos ter caixa? Não — fura em D-5 · saldo -R$ 100.000.000…000"
            "Caixa mínimo para iniciar -R$ 100.000.000…000 em D-5"
          300 e tantos dígitos em cada linha, e nenhum aviso. Por isso o efeito
          declarado aqui é `gigante`, e não o `zera` das outras telas: a faixa
          tem de descrever a tela em que ela está. */}
      <AvisoCustoQuebrado evento={evento} efeito="gigante" numeroQuebrouAqui={analiseQuebrada} />
      {/* ————— controles ————— */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field label="Caixa inicial do evento" className="w-44">
            <MoneyInput
              value={evento.caixaInicial}
              onChange={(v) => update((e) => ({ ...e, caixaInicial: v }))}
              placeholder="0"
              title="Quanto a produção já tem em caixa para esta festa antes de vender (opcional — vazio vale R$ 0, o padrão da conta aprovada)."
            />
          </Field>
          <div className="pb-1 text-[11px] leading-relaxed text-[var(--tinta-3)]">
            <p>
              Entrada = plano{' '}
              <strong>{modo === 'datas' ? 'pelas datas dos lotes' : 'pela forma histórica'}</strong>{' '}
              (escolha lembrada na aba Cenários) · total do plano:{' '}
              <span className="tnum">{fmtOuIlegivel(totalPlano, fmtCompact)}</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 pb-1">
            {cache && (
              <span className="text-[10px] text-[var(--tinta-3)]">
                via Financeiro em {fmtDataHora(cache.em)}
              </span>
            )}
            <Btn
              onClick={buscar}
              // Na cópia da nuvem (05/10/2026) a ponte não existe: desligado,
              // e o title diz por quê — como os outros botões da ponte.
              disabled={buscando || origemNaNuvem()}
              title={
                origemNaNuvem()
                  ? TITULO_PONTE_NA_NUVEM
                  : 'Consulta somente-leitura ao Financeiro local: alimenta a média histórica do plano. Nenhum dado do evento muda.'
              }
            >
              {buscando ? 'Buscando…' : <><AppIcon icon={RefreshCw} /> Buscar curva no Financeiro</>}
            </Btn>
          </div>
        </div>
      </Card>

      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
      {erro && (
        <p className="rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">{erro}</p>
      )}
      {pendencias.map((p) => (
        <p key={p} className="rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
          {p}
        </p>
      ))}

      {analise?.ok && (
        <>
          {/* ————— divergência de parcelas: vermelho, nunca silêncio —————
              B3 (BACKLOG S4): tokens tema-aware — a tarja fixa sumia no escuro. */}
          {analise.divergencias.map((d) => (
            <p
              key={d.rotulo}
              className="flex items-start gap-1 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]"
            >
              <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" />
              <span>As parcelas de “{d.rotulo}” somam {fmtBRL2(d.soma)}, mas o custo é{' '}
              {fmtBRL2(d.valor)} — a linha do tempo usa as parcelas. Ajuste na aba Custos
              (botão da coluna Pagamento).</span>
            </p>
          ))}

          {/* ————— as três respostas ————— */}
          <Card className="p-4">
            {/* faixa de resumo na escala de espaçamento da casa (item 6, F2-W):
                gap 8; cada resposta tabular; a cor por SINAL (verde/vermelho) é
                o destaque semântico — caixa negativo É um alerta legítimo. */}
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              <Stat
                label="Vamos ter caixa?"
                value={
                  analise.primeiroNegativo
                    ? `Não — fura em ${rotuloDia(analise.primeiroNegativo.dia)}`
                    : 'Sim'
                }
                sub={
                  analise.primeiroNegativo
                    ? `saldo ${fmtBRL(analise.primeiroNegativo.saldo)} no primeiro dia negativo`
                    : 'o saldo nunca fica negativo na linha do tempo'
                }
                valueClass={analise.primeiroNegativo ? 'text-[var(--vermelho-texto)]' : 'text-[var(--verde-texto)]'}
              />
              <Stat
                label="Caixa mínimo para iniciar"
                value={`${fmtBRL(analise.caixaMinimo.saldo)} em ${rotuloDia(analise.caixaMinimo.dia)}`}
                sub={
                  analise.caixaMinimo.saldo < 0
                    ? `é o fundo do poço: faltam ${fmtBRL(-analise.caixaMinimo.saldo)} além do caixa inicial para atravessar`
                    : 'menor saldo da linha do tempo — o plano se banca com o caixa inicial'
                }
                valueClass={saldoCor(analise.caixaMinimo.saldo)}
              />
              <Stat
                label="Saldo no dia da festa"
                value={fmtBRL(analise.saldoFesta)}
                sub={`entradas ${fmtCompact(analise.totalEntradas)} − saídas ${fmtCompact(analise.totalSaidas)} + caixa inicial ${fmtCompact(analise.caixaInicial)}`}
                valueClass={saldoCor(analise.saldoFesta)}
              />
            </div>
          </Card>

          {/* ————— gráfico do saldo ————— */}
          <Card className="p-4">
            <h3 className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
              Saldo dia a dia
              <span className="text-[10px] font-normal text-[var(--tinta-3)]">
                {[evento.nome, evento.data ? fmtData(evento.data) : null].filter(Boolean).join(' · ')}
              </span>
            </h3>
            <p className="mb-3 text-xs text-[var(--tinta-3)]">
              Caixa inicial {fmtBRL(analise.caixaInicial)} + o que o plano prevê vender (líquido de
              desconto) − o que vence até cada dia.{' '}
              {analise.patrocinioFechado > 0 && (
                <>Patrocínio fechado ({fmtCompact(analise.patrocinioFechado)}) entra no dia da festa. </>
              )}
              {iniValido && (
                <>
                  Antes do <strong>início de vendas</strong> ({fmtData(iniValido.data)}) o plano
                  não prevê entrada nenhuma — só as saídas contam, e o caixa mínimo para iniciar
                  fica verdadeiro.{' '}
                </>
              )}
              Abaixo de zero = falta caixa.
            </p>
            <LinhasCurva
              series={[
                {
                  label: 'Saldo do dia (caixa da festa)',
                  color: VIZ.light.receita,
                  width: 2.5,
                  pontos: analise.dias.map((d) => ({ x: d.dia, y: d.saldo })),
                  marcadores: analise.agenda.map((s) => ({
                    x: s.dia,
                    y: s.saldoNoDia,
                    titulo: `${s.rotulo}${s.parcela ? ` · parcela ${s.parcela.k}/${s.parcela.n}` : ''}: ${fmtBRL2(s.valor)} em ${fmtData(s.data)} — saldo do dia ${fmtBRL(s.saldoNoDia)}`,
                  })),
                },
              ]}
              hojeX={diaHoje != null && diaHoje < 0 ? diaHoje : null}
              marcosX={iniValido ? [{ x: iniValido.dia, rotulo: 'início de vendas' }] : []}
              yFmt={fmtCompact}
            />
          </Card>

          {/* ————— agenda de pagamentos ————— */}
          <Card className="p-4">
            <h3 className="mb-1 text-sm font-semibold">Agenda de pagamentos</h3>
            <p className="mb-3 text-xs text-[var(--tinta-3)]">
              Cada vencimento cruzado com o saldo previsto do próprio dia — parcela conta no dia
              dela. Para pôr um custo aqui: aba Custos, coluna <strong>Pagamento</strong>.
            </p>

            {analise.agenda.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--borda)] px-3 py-5 text-center text-sm text-[var(--tinta-3)]">
                {temAgendaDePagamento(evento)
                  ? 'Nenhum pagamento com data até a festa.'
                  : 'Nenhum custo tem data de pagamento ainda — preencha na aba Custos (coluna Pagamento) ou use o “Parcelar…” para dividir um custo em datas.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--borda)]">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-[var(--papel-2)] text-left text-[var(--tinta-2)]">
                    <tr>
                      <th className="p-2 font-medium">Vencimento</th>
                      <th className="p-2 font-medium">Item</th>
                      <th className="p-2 font-medium">Categoria</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 text-right font-medium">Valor</th>
                      <th className="p-2 text-right font-medium">Saldo no dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.agenda.map((s, i) => (
                      <tr key={`${s.itemId}-${i}`} className="border-t border-[var(--borda)]">
                        <td className="p-2 tnum whitespace-nowrap">
                          {fmtData(s.data)}{' '}
                          <span className="text-[var(--tinta-3)]">({rotuloDia(s.dia)})</span>
                        </td>
                        <td className="p-2 font-medium text-[var(--tinta)]">
                          {s.rotulo}
                          {s.parcela && (
                            <span className="ml-1 font-normal text-[var(--tinta-3)]">
                              · parcela {s.parcela.k}/{s.parcela.n}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-[var(--tinta-2)]">{s.categoria}</td>
                        <td className="p-2">
                          <Badge style={estiloStatusCusto(s.status)}>{s.status}</Badge>
                        </td>
                        <td className="p-2 text-right tnum font-semibold">{fmtBRL2(s.valor)}</td>
                        <td className={`p-2 text-right tnum font-semibold ${saldoCor(s.saldoNoDia)}`}>
                          {fmtBRL(s.saldoNoDia)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--borda)] bg-[var(--papel-2)]">
                      <td className="p-2 font-semibold" colSpan={4}>
                        Total até a festa
                      </td>
                      <td className="p-2 text-right tnum font-semibold">
                        {fmtBRL2(analise.agenda.reduce((s, x) => s + x.valor, 0))}
                      </td>
                      <td className="p-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* — parcelas quitadas (sugestão 38): fora da linha do tempo por
                estarem PAGAS — a agenda mostra, nunca some em silêncio — */}
            {analise.pagas.length > 0 && (
              <p className="mt-3 flex items-start gap-1 rounded-lg bg-[rgba(0,120,42,0.07)] px-3 py-2 text-xs text-[var(--verde-texto)]">
                <AppIcon icon={CircleCheck} size={13} className="mt-px shrink-0" />
                <span>
                  <strong>{analise.pagas.length}</strong>{' '}
                  {analise.pagas.length === 1 ? 'parcela já foi paga' : 'parcelas já foram pagas'} (
                  {fmtCompact(analise.pagas.reduce((s, x) => s + x.valor, 0))}) e{' '}
                  {analise.pagas.length === 1 ? 'saiu' : 'saíram'} da linha do tempo — fluxo
                  quitado, o dinheiro já não está no caixa:{' '}
                  {analise.pagas
                    .map(
                      (s) =>
                        `${s.rotulo}${s.parcela ? ` ${s.parcela.k}/${s.parcela.n}` : ''}${s.dataPaga ? ` em ${fmtData(s.dataPaga)}` : ''}`
                    )
                    .join(', ')}
                  . Para reverter, desmarque a parcela na aba Custos.
                </span>
              </p>
            )}

            {/* — custos fora da linha do tempo: sempre ditos, nunca somem — */}
            {analise.semData.length > 0 && (
              <p className="mt-3 flex items-start gap-1 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
                <AppIcon icon={TriangleAlert} size={13} className="mt-px shrink-0" /> <span><strong>{analise.semData.length}</strong>{' '}
                {analise.semData.length === 1 ? 'custo está' : 'custos estão'} <strong>sem data de
                pagamento</strong> e{' '}
                {analise.semData.length === 1 ? 'ficou fora' : 'ficaram fora'} da linha do tempo (
                {fmtCompact(analise.semData.reduce((s, x) => s + x.valor, 0))}):{' '}
                {analise.semData.map((s) => `${s.rotulo}${s.parcela ? ` (parcela ${s.parcela.k}/${s.parcela.n})` : ''}`).join(', ')}.</span>
              </p>
            )}
            {analise.posFesta.length > 0 && (
              <p className="mt-2 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
                {analise.posFesta.length}{' '}
                {analise.posFesta.length === 1 ? 'pagamento vence' : 'pagamentos vencem'}{' '}
                <strong>depois da festa</strong> (
                {fmtCompact(analise.posFesta.reduce((s, x) => s + x.valor, 0))}):{' '}
                {analise.posFesta
                  .map((s) => `${s.rotulo}${s.parcela ? ` ${s.parcela.k}/${s.parcela.n}` : ''} em ${fmtData(s.data)}`)
                  .join(', ')}{' '}
                — fora desta conta (são pagos com o resultado, não com o caixa pré-festa).
              </p>
            )}
            {/* Contingência é reserva SEM vencimento (tema C): não tem data, então
                não entra na linha do tempo — é colchão de caixa, não pagamento. */}
            {num(evento.contingenciaPct) > 0 && (
              <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
                A contingência ({num(evento.contingenciaPct)}%) é uma reserva sem vencimento — não
                aparece nesta linha do tempo por não ter data de pagamento. Trate-a como colchão de
                caixa, não como conta a vencer.
              </p>
            )}
          </Card>

          {/* ————— a conta, por escrito (exigência da spec aprovada) ————— */}
          <p className="rounded-lg border border-[var(--borda)] bg-[var(--papel)] px-4 py-3 text-[11px] leading-relaxed text-[var(--tinta-3)]">
            <strong className="text-[var(--tinta-2)]">A conta desta aba</strong> (aprovada pelo
            Marco em 19/07/2026): <strong>saldo do dia</strong> = caixa inicial do evento (padrão
            R$ 0) + entradas previstas até o dia (curva de vendas do plano, líquida do desconto
            efetivo — no modo escolhido na aba Cenários) − saídas com vencimento até o dia (cada
            parcela no seu dia). <strong>Caixa mínimo para iniciar</strong> = o menor saldo da
            linha do tempo.{' '}
            {iniValido && (
              <>
                Antes do início de vendas ({fmtData(iniValido.data)}) o plano não gera entrada —
                sugestão 30.{' '}
              </>
            )}
            Custos sem data ficam fora da linha do tempo, com aviso.{' '}
            <strong>Parcela marcada como paga</strong> (sugestão 38, decisão do Marco) é fluxo
            quitado: o dinheiro já saiu, então ela não conta como saída a vencer — a fórmula do
            saldo é a mesma, muda só quais saídas entram. Patrocínio
            fechado entra como entrada no dia da festa; receita de bar e contingência não entram
            (o bar chega na festa; a contingência não tem vencimento). Taxa de bilheteria e
            cashback não são descontados da entrada — a curva compara vendas na régua da Tiqueteira,
            como na aba Cenários. Esta aba é leitura: semáforo, cenários e DRE não mudam por nada
            daqui.
          </p>
        </>
      )}
    </div>
  )
}
