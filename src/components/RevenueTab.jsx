import { Btn, Card, Stat, Badge, Bola, Field, TextInput, MoneyInput, PctInput, NumInput, Select, Segmented, BotoesOrdem, CampoData } from './ui.jsx'
import { AppIcon, X, TriangleAlert } from './AppIcon.jsx'
import { computeCenario, isCortesia, isPrecoAusente, patrocinioPorEstagio, isOpenBar, descontoEfetivoPct, isTaxaCliente, isBarPorPessoa, CENARIOS, CENARIO_LABEL } from '../lib/calc.js'
import { fmtBRL, fmtBRL2, fmtData, fmtInt, fmtPct } from '../lib/format.js'
import { novoLote, novoPatrocinio, ESTAGIOS_PATROCINIO, ESTAGIO_PATROCINIO_LABEL } from '../lib/defaults.js'
import { inicioVendasEfetivo } from '../lib/curvaVendas.js'
import { premissaDesconto, contaBarPorPessoa } from '../lib/premissaTexto.js'
import {
  IMPOSTO_BASES,
  IMPOSTO_BASE_LABEL,
  impostoSobreDoEvento,
  temImposto,
} from '../lib/imposto.js'
import { precoEfetivoLote, precoAoCliente, receitaEfetivaLote } from '../lib/precoLote.js'
import { num } from '../lib/util.js'
import {
  FAIXA_PCT,
  FAIXA_PRECO,
  FAIXA_QUANTIDADE,
  FAIXA_PATROCINIO,
  FAIXA_CUSTO,
  FAIXA_CONSUMO,
  foraDaFaixa,
} from '../lib/campoNumerico.js'
import { moverEmLista, planejarMovimento } from '../lib/ordenar.js'
import { showToast } from '../lib/toast.js'
import { origemNaNuvem, TITULO_PONTE_NA_NUVEM } from '../lib/ponteOrigem.js'
import { useState } from 'react'
import { fmtOuIlegivel } from '../lib/dadoQuebrado.js'
import AvisoLoteSemPreco from './AvisoLoteSemPreco.jsx'
import { loteFicaDeFora, ROTULO_LOTE_SEM_PRECO, PRECO_AUSENTE_TEXTO } from '../lib/loteSemPreco.js'
import {
  buscarCurvaEdicoes, salvarEdicaoRitmo, resumoRitmo, pctDoPrevisto,
  ingressosPrevistosRealista,
} from '../lib/financeiro.js'

export default function RevenueTab({ evento, update }) {
  const r = computeCenario(evento, 'realista')
  const openBar = isOpenBar(evento)
  // As três chaves do imposto, já na forma estrita — a MESMA leitura que
  // calc.js faz. Ler `evento.impostoSobre` cru aqui deixaria a caixinha
  // marcada por um valor torto de backup que a conta ignora.
  const sobre = impostoSobreDoEvento(evento)

  // Desconto parcial (Sessão F2-R — sugestão 29a): a conta mora em calc.js
  // (descontoEfetivoPct); aqui é só exibição do efetivo por cenário.
  const cupom = num(evento.descontoMedioPct)
  const modoNum = evento.descontoIngressosModo === 'numero'
  const fracaoVazia =
    evento.descontoIngressosValor === '' || evento.descontoIngressosValor == null
  const efetivoR = descontoEfetivoPct(evento, r.pagos)
  // No modo nº a fração muda por cenário — mostramos os três para ninguém
  // ler o efetivo do realista como se fosse o único.
  const efetivoOutros =
    cupom !== 0 && modoNum && !fracaoVazia
      ? {
          pessimista: descontoEfetivoPct(evento, computeCenario(evento, 'pessimista').pagos),
          otimista: descontoEfetivoPct(evento, computeCenario(evento, 'otimista').pagos),
        }
      : null

  // Taxa paga pelo cliente (sugestão 29b): no repasse a taxa não desconta da
  // receita e a tabela mostra o preço final ao cliente = pós-desconto ×
  // (1 + taxa). As continhas por linha moram em precoLote.js (H3-E — antes
  // eram cópias soltas neste JSX, fora do Vitest).
  const taxaCliente = isTaxaCliente(evento)

  // Bar em dois modos (sugestão 42): a conta mora em calc.js (barPorPessoa,
  // via computeCenario); aqui é só exibição dos três valores e da continha.
  const barPP = isBarPorPessoa(evento)
  const barCenarios = barPP
    ? {
        pessimista: computeCenario(evento, 'pessimista').bar,
        realista: r.bar,
        otimista: computeCenario(evento, 'otimista').bar,
      }
    : null
  const contaBarR = barPP && !openBar ? contaBarPorPessoa(evento, r) : ''

  // Rótulo do total: cita só o que DE FATO entrou na conta (pedido do Marco).
  // Antes era texto fixo com as três parcelas mesmo quando uma valia zero.
  const composicaoReceitaTotal =
    ['líquida', ...(r.bar > 0 ? ['bar'] : []), ...(r.patrocinio > 0 ? ['patrocínio fechado'] : [])].join(
      ' + '
    ) + (openBar ? ' · open bar: sem receita de bar' : '')

  const setLote = (id, p) =>
    update((e) => ({ ...e, lotes: e.lotes.map((l) => (l.id === id ? { ...l, ...p } : l)) }))
  const addLote = () =>
    update(
      (e) => ({ ...e, lotes: [...e.lotes, novoLote({ nome: `Lote ${e.lotes.length + 1}` })] }),
      'adicionar um lote'
    )
  const rmLote = (id) =>
    update((e) => ({ ...e, lotes: e.lotes.filter((l) => l.id !== id) }), 'apagar um lote')
  // Reordenar lotes (setas ↑↓). Aqui a ordem tem CONSEQUÊNCIA DE LEITURA: a
  // coluna Acumulada e a curva de vendas são somas corridas na ordem exibida —
  // é justamente por isso que o Marco quer poder arrumá-la. Nenhuma conta LÊ a
  // posição da linha (provado em ordenarInvariancia.test.js); o que pode mudar
  // é o último dígito de um arredondamento, quando o total cai exatamente em
  // cima de um empate — ver o achado do arredondamento no BACKLOG.md.
  //
  // Mesmo caminho de escrita das outras edições → desfazer/refazer de graça.
  // `moverEmLista` devolve o MESMO evento quando nada mudou: o reducer vê a
  // referência igual e NÃO empilha passo (achado S3-F). E devolve `aviso`
  // quando a lista tem linhas sem identificador — aí o clique fala (S3-E).
  //
  // DUAS LEITURAS, de propósito, e a diferença importa:
  //
  //  · o MOVIMENTO roda dentro do updater, sobre o estado FRESCO — é o que
  //    protege do closure stale (dois cliques no mesmo batch do React).
  //  · o AVISO sai da lista do render. Tem de ser assim: `update` é um
  //    dispatch de reducer, então o updater NÃO roda durante esta chamada —
  //    roda depois, no render. Colher o aviso lá dentro e lê-lo aqui embaixo
  //    lia sempre `null`, e o toast nunca aparecia (bug pego na verificação ao
  //    vivo desta rodada). O diagnóstico "esta lista não tem identificadores"
  //    é propriedade da lista que o Marco está OLHANDO, não do próximo tique —
  //    ler do render é correto, e não só conveniente.
  const avisoDoMovimento = (lista, id, direcao, indice) =>
    planejarMovimento(lista, id, direcao, indice).aviso

  const moverLote = (lote, direcao, indice) => {
    const aviso = avisoDoMovimento(evento.lotes, lote.id, direcao, indice)
    update(
      (e) => moverEmLista(e, 'lotes', lote.id, direcao, indice).obj,
      `mover ${lote.nome?.trim() ? `“${lote.nome.trim()}”` : 'um lote'} para ${direcao}`
    )
    if (aviso) showToast(aviso)
  }
  const setOutras = (p) =>
    update((e) => ({ ...e, outrasReceitas: { ...e.outrasReceitas, ...p } }))
  // Patrocínios por estágio (Sessão O — sugestão 22): updates funcionais,
  // padrão da Sessão B (cliques rápidos não engolem item).
  const setPatrocinio = (id, p) =>
    update((e) => ({
      ...e,
      patrocinios: (e.patrocinios || []).map((x) => (x.id === id ? { ...x, ...p } : x)),
    }))
  const addPatrocinio = () =>
    update(
      (e) => ({ ...e, patrocinios: [...(e.patrocinios || []), novoPatrocinio()] }),
      'adicionar um patrocínio'
    )
  const rmPatrocinio = (id) =>
    update(
      (e) => ({ ...e, patrocinios: (e.patrocinios || []).filter((x) => x.id !== id) }),
      'apagar um patrocínio'
    )
  // Reordenar patrocínios: aqui a ordem é PURA APRESENTAÇÃO (a soma por
  // estágio não olha posição) — serve para o Marco pôr os fechados em cima na
  // hora da reunião. Mesmas garantias do moverLote acima.
  const moverPatrocinio = (p, direcao, indice) => {
    const aviso = avisoDoMovimento(evento.patrocinios || [], p.id, direcao, indice)
    update(
      (e) => moverEmLista(e, 'patrocinios', p.id, direcao, indice).obj,
      `mover ${p.patrocinador?.trim() ? `“${p.patrocinador.trim()}”` : 'um patrocínio'} para ${direcao}`
    )
    if (aviso) showToast(aviso)
  }
  const pat = patrocinioPorEstagio(evento)

  // Receita/Acumulada por linha usam o preço EFETIVO (pós-desconto) — decisão
  // do Marco, 20/07/2026 ("não quero a receita sem desconto, quero a
  // efetiva"). Sem cupom, efetiva = tabela e nada muda. A conta mora em
  // precoLote.js; "só otimista" e cortesia seguem valendo 0 na coluna.
  let acumulada = 0
  const linhas = evento.lotes.map((l) => {
    const fora = l.somenteOtimista
    // P8 (06/10/2026): lote sem preço não entra na previsão — sem receita a
    // mostrar e fora do total; a quantidade continua salva no campo.
    const semPreco = isPrecoAusente(l)
    const receita = receitaEfetivaLote(l, efetivoR)
    acumulada += receita
    return { ...l, receita, acumulada, fora, semPreco, avisaSemPreco: loteFicaDeFora(evento, l) }
  })

  return (
    <div className="space-y-5">
      {/* Faixa de receita (pedido do Marco, 19/07): os cards COMPONENTES fluem
          à esquerda e o TOTAL é herói à direita, num bloco próprio. Antes eram
          todos numa grade de 6: quando bar e patrocínio entravam viravam 7 e o
          total — que é a conclusão — caía órfão numa segunda fileira. Mesmo
          arranjo da faixa de Custos, para as duas abas lerem igual. */}
      <Card className="flex flex-wrap items-start gap-x-6 gap-y-4 p-4">
        {/* auto-fit: os cards preenchem a fileira por igual — 5 componentes
            viram 5 colunas, 6 viram 6; acabou o órfão numa segunda linha com
            buraco do lado (print do Marco, 20/07). */}
        <div className="grid min-w-0 flex-1 gap-4 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
        <Stat
          label="Receita bruta bilheteria"
          value={fmtBRL2(r.bruta)}
          sub={`realista · ${num(evento.cenariosConfig?.realista?.vendaPct ?? 90)}% dos lotes${
            efetivoR > 0 ? ` · desconto efetivo ${fmtPct(efetivoR, 2)}` : ''
          }${
            // TODO fator na etiqueta (achado do Marco, 21/07/2026): a bruta
            // também carrega o ajuste do ticket e o ticket manual do cenário —
            // omiti-los fazia dois números certos parecerem incoerentes na
            // mesma tela (190.900 esgotado × 190.592 realista).
            r.ticketAjustePct
              ? ` · ajuste do ticket ${r.ticketAjustePct > 0 ? '+' : ''}${num(r.ticketAjustePct)}%`
              : ''
          }${r.ticketMedioManual ? ' · ticket manual' : ''}`}
        />
        {/* Taxa paga pelo cliente (sug. 29b) não desconta da produção: efeito
            zero no resultado → some do resumo (ruído num painel de decisão).
            Só aparece quando a taxa é paga por nós, aí é relevante. */}
        {!taxaCliente && (
          <Stat
            label={`Taxa bilheteria (${num(evento.taxaBilheteria)}%)`}
            value={`− ${fmtBRL2(r.taxa)}`}
            valueClass="text-[var(--tinta-2)]"
          />
        )}
        <Stat
          label={`Cashback Tiqueteira (${num(evento.cashbackPct)}%)`}
          value={`+ ${fmtBRL2(r.cashback)}`}
        />
        <Stat label="Receita líquida bilheteria" value={fmtBRL2(r.liquida)} />
        <Stat
          label="Ticket médio (pago)"
          value={fmtBRL2(r.ticketMedio)}
          sub={`líquido ${fmtBRL2(r.ticketMedioLiquido)}`}
        />
        {/* Bar e patrocínio: receita real, aparecem como card quando há valor
            (> 0) — igual à grade de números-chave do relatório. */}
        {r.bar > 0 && (
          <Stat
            label="Bar (lucro esperado)"
            value={fmtBRL2(r.bar)}
          />
        )}
        {r.patrocinio > 0 && (
          <Stat
            label="Patrocínio (fechado)"
            value={fmtBRL2(r.patrocinio)}
          />
        )}
        </div>

        {/* divisória: separa componentes da conclusão (some no celular) */}
        <div
          className="hidden self-stretch border-l border-[var(--borda-2)] lg:block"
          aria-hidden="true"
        />

        {/* HERÓI — a conclusão da faixa. Nunca órfão: tem bloco próprio,
            independente de quantos componentes existem. O rótulo de baixo diz
            só o que DE FATO entrou (sem bar, não fala bar). */}
        <div className="w-full rounded-xl border border-[var(--borda)] bg-[var(--papel-2)] px-4 py-2.5 lg:w-auto lg:min-w-56">
          <div className="text-xs text-[var(--tinta-2)]">Receita total (realista)</div>
          <div className="tnum text-3xl font-semibold">
            {fmtBRL2(r.receitaTotal)}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--tinta-3)]">
            {composicaoReceitaTotal}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lotes de ingresso</h3>
          <Btn onClick={addLote}>+ Adicionar lote</Btn>
        </div>
        {/* Início de vendas (Sessão F2-S — sugestão 30): campo único da
            janela de vendas. Opcional; só curva/Análise/ritmo leem — nenhum
            cálculo de cenário muda (inicioVendasEfetivo em curvaVendas.js). */}
        <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg bg-[var(--papel-2)] px-3 py-2">
          <Field label="Início de vendas" className="w-40">
            <CampoData
              value={evento.inicioVendas || ''}
              onChange={(iso) => update((ev) => ({ ...ev, inicioVendas: iso }))}
              aria-label="Início de vendas"
              title="Data em que as vendas abrem. Opcional — usada pela curva de vendas, pelo ritmo semanal e pela aba Análise; nenhum cenário ou DRE muda."
            />
          </Field>
          <p className="pb-1 text-[11px] leading-relaxed text-[var(--tinta-3)]">
            {(() => {
              const ini = inicioVendasEfetivo(evento)
              if (ini?.depoisDaFesta)
                return (
                  // B3 (BACKLOG S4): texto de alerta com text-red-700 fixo —
                  // achado extra (sem bg junto) no mesmo grep do bg-red-50;
                  // --vermelho-texto já é tema-aware.
                  <span className="font-medium text-[var(--vermelho-texto)]">
                    O início de vendas ({fmtData(ini.data)}) está DEPOIS da festa — a curva vai
                    ignorá-lo até a data fazer sentido. Confira.
                  </span>
                )
              if (ini?.origem === 'campo')
                return (
                  <>
                    Vendas abrem em <strong>{fmtData(ini.data)}</strong>
                    {ini.diasAntes != null && (
                      <> ({fmtInt(ini.diasAntes)} dias antes da festa)</>
                    )}{' '}
                    — antes disso o plano da curva não prevê venda. Só curva, ritmo e Análise
                    usam esta data.
                  </>
                )
              if (ini?.origem === 'premissa')
                return (
                  <>
                    Pela premissa desta festa, vendas abrem <strong>{fmtInt(ini.diasAntes)} dias
                    antes</strong> → <strong>{fmtData(ini.data)}</strong>. Preencha o campo para
                    fixar outra data (o campo sempre vence a premissa).
                  </>
                )
              return (
                <>
                  Opcional — a data em que as vendas abrem. Com ela, a curva ganha a régua da
                  janela deste evento e a Análise só prevê entrada depois do início. Vazio =
                  tudo como sempre.
                </>
              )
            })()}
          </p>
        </div>
        <AvisoLoteSemPreco evento={evento} naReceita className="mb-3" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[776px] text-sm">
            <thead>
              <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                {/* Ordem (setas ↑↓): a ordem dos lotes É a régua da coluna
                    Acumulada e da curva de vendas — por isso ela se arruma
                    aqui, na própria linha. Nenhum total muda. */}
                <th
                  className="w-14 py-2 pr-1 font-medium"
                  title="Ordem dos lotes — as setas sobem e descem uma linha. A coluna Acumulada e a curva de vendas seguem esta ordem. Nenhuma conta lê a posição da linha; só o arredondamento do último dígito pode oscilar quando o total cai em cima de um empate."
                >
                  Ordem
                </th>
                <th className="py-2 pr-3 font-medium">Lote</th>
                <th className="w-32 py-2 pr-3 font-medium">Valor unit.</th>
                {cupom !== 0 && (
                  <th
                    className="w-28 py-2 pr-3 text-right font-medium"
                    title="Preço médio pós-desconto no cenário realista: valor × (1 − desconto efetivo)"
                  >
                    Efetivo
                  </th>
                )}
                {taxaCliente && (
                  <th
                    className="w-28 py-2 pr-3 text-right font-medium"
                    title="Preço final ao cliente com a taxa repassada: pós-desconto × (1 + taxa)"
                  >
                    Ao cliente
                  </th>
                )}
                <th className="w-24 py-2 pr-3 font-medium">Qtd</th>
                <th className="w-28 py-2 pr-3 text-right font-medium">Receita</th>
                <th className="w-28 py-2 pr-3 text-right font-medium">Acumulada</th>
                <th className="w-28 py-2 pr-3 text-center font-medium" title="Entra apenas no cenário otimista (ex.: Lote Porta)">
                  Só otimista
                </th>
                {/* Ação da linha SEMPRE VISÍVEL (Frente A, BACKLOG): mesmo
                    conserto do editor de custos — `sticky right-0` gruda o
                    Remover na borda direita da caixa de rolagem da tabela
                    (não da página), com o fundo do Card por baixo. */}
                <th className="sticky right-0 z-10 w-10 border-l border-[var(--borda)] bg-[var(--papel)] py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, indice) => (
                <tr key={l.id} className={`border-b border-[var(--borda)] ${l.fora ? 'opacity-70' : ''}`}>
                  <td className="py-1.5 pr-1">
                    <BotoesOrdem
                      nome={l.nome}
                      tipo="lote"
                      indice={indice}
                      total={linhas.length}
                      onSubir={() => moverLote(l, 'cima', indice)}
                      onDescer={() => moverLote(l, 'baixo', indice)}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <TextInput
                        value={l.nome}
                        onChange={(e) => setLote(l.id, { nome: e.target.value })}
                        placeholder="Nome do lote"
                      />
                      {l.valor !== '' && l.valor != null && isCortesia(l) && (
                        <Badge className="shrink-0 bg-[var(--papel-2)] text-[var(--tinta-2)]">cortesia</Badge>
                      )}
                      {/* Selo CURTO (regra do selo largo do plano S7): o rótulo
                          inteiro espremia a caixa do nome para 22 px abaixo de
                          1.440 px de largura (medido em 06/10/2026); o texto
                          completo fica no title e na faixa acima da tabela. */}
                      {l.avisaSemPreco && (
                        <span className="shrink-0" title={ROTULO_LOTE_SEM_PRECO}>
                          <Badge className="bg-[var(--papel-2)] text-[var(--ambar-texto,var(--tinta-2))]">{PRECO_AUSENTE_TEXTO}</Badge>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <MoneyInput value={l.valor} onChange={(v) => setLote(l.id, { valor: v })} faixa={FAIXA_PRECO} />
                  </td>
                  {cupom !== 0 && (
                    <td className="py-1.5 pr-3 text-right tnum text-[var(--tinta-2)]">
                      {isCortesia(l) || l.semPreco ? '—' : fmtBRL2(precoEfetivoLote(l.valor, efetivoR))}
                    </td>
                  )}
                  {taxaCliente && (
                    <td className="py-1.5 pr-3 text-right tnum text-[var(--tinta-2)]">
                      {isCortesia(l) || l.semPreco ? '—' : fmtBRL2(precoAoCliente(l.valor, efetivoR, evento))}
                    </td>
                  )}
                  <td className="py-1.5 pr-3">
                    <NumInput
                      value={l.quantidade}
                      onChange={(v) => setLote(l.id, { quantidade: v })}
                      faixa={FAIXA_QUANTIDADE}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right tnum">{l.fora || l.semPreco ? '—' : fmtBRL(l.receita)}</td>
                  <td className="py-1.5 pr-3 text-right tnum text-[var(--tinta-2)]">
                    {l.fora || l.semPreco ? '—' : fmtBRL(l.acumulada)}
                  </td>
                  <td className="py-1.5 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!l.somenteOtimista}
                      onChange={(e) => setLote(l.id, { somenteOtimista: e.target.checked })}
                      className="size-4 cursor-pointer accent-[var(--acento)]"
                    />
                  </td>
                  <td className="sticky right-0 z-10 border-l border-[var(--borda)] bg-[var(--papel)] py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => rmLote(l.id)}
                      className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--vermelho-texto)]"
                      title="Remover lote"
                      aria-label="Remover lote"
                    >
                      <AppIcon icon={X} size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-sm font-semibold">
                <td aria-hidden />
                <td className="py-2 pr-3">Total dos lotes (esgotado)</td>
                <td />
                {cupom !== 0 && <td />}
                {taxaCliente && <td />}
                <td className="py-2 pr-3 text-right tnum">
                  {fmtInt(linhas.filter((l) => !l.fora && !l.semPreco).reduce((s, l) => s + num(l.quantidade), 0))}
                </td>
                <td className="py-2 pr-3 text-right tnum">
                  {fmtBRL(linhas.reduce((s, l) => s + l.receita, 0))}
                </td>
                <td colSpan="3" />
              </tr>
              <tr className="text-xs text-[var(--tinta-2)]">
                <td aria-hidden />
                <td className="pb-1 pr-3">
                  Realista ({num(evento.cenariosConfig?.realista?.vendaPct ?? 90)}%) ·{' '}
                  {fmtInt(r.pagos)} pagos + {fmtInt(r.cortesias)} cortesias
                </td>
                <td />
                {cupom !== 0 && <td />}
                {taxaCliente && <td />}
                <td className="pb-1 pr-3 text-right tnum">{fmtInt(r.publico)}</td>
                <td className="pb-1 pr-3 text-right tnum">{fmtBRL(r.bruta)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--tinta-3)]">
          A quantidade é o <strong>tamanho do lote</strong> (esgotado). As colunas{' '}
          <strong>Receita</strong>, <strong>Acumulada</strong> e o total usam o{' '}
          <strong>preço efetivo</strong> (pós-desconto — sem cupom, é o próprio preço de
          tabela); o preço de tabela segue na coluna “Valor unit.”. Cada cenário aplica seu %
          de venda — ajustável em Cenários &amp; Resultado. Lotes com valor R$ 0 contam como
          cortesia (entram inteiros no público, não na receita). Lote com o preço em branco fica fora da
          previsão — fora do público, das cortesias e do bar — até ter preço. Lotes marcados “só otimista”
          (ex.: Lote Porta) só entram no cenário otimista.
          {!!r.ticketAjustePct && (
            <>
              {' '}
              A linha “Realista” aplica também o <strong>ajuste do ticket do cenário</strong> (
              {r.ticketAjustePct > 0 ? '+' : ''}
              {num(r.ticketAjustePct)}%) — por isso ela pode não ser exatamente o total efetivo ×
              % de venda.
            </>
          )}
          {cupom !== 0 && (
            <>
              {' '}
              “Valor unit.” é o <strong>preço de tabela</strong>; a coluna “Efetivo” é o preço
              médio pós-desconto ({premissaDesconto(evento)}) no cenário realista — a linha
              “Realista” e os cenários já usam essa conta.
              {modoNum && !fracaoVazia && (
                <> No modo nº a fração (e o efetivo) muda por cenário.</>
              )}
            </>
          )}
          {taxaCliente && (
            <>
              {' '}
              A coluna “Ao cliente” é o preço final com a taxa repassada: pós-desconto ×
              (1 + {num(evento.taxaBilheteria)}%).
            </>
          )}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Taxa, cashback e desconto da bilheteria</h3>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Taxa bilheteria (%)" className="w-32">
              <PctInput
                value={evento.taxaBilheteria}
                onChange={(v) => update((e) => ({ ...e, taxaBilheteria: v }))}
                faixa={FAIXA_PCT}
              />
            </Field>
            <Field label="Taxa paga por" className="w-fit">
              <Segmented
                value={taxaCliente ? 'cliente' : 'nos'}
                onChange={(m) => update((e) => ({ ...e, taxaPagaPor: m }))}
                options={[
                  ['nos', 'por nós'],
                  ['cliente', 'pelo cliente'],
                ]}
              />
            </Field>
            {/* w-36: o rótulo mede 133px — estourava o w-32 (128px); regra da
                casa F2-V: o campo tem a largura do seu rótulo, com folga. */}
            <Field label="Cashback Tiqueteira (%)" className="w-36">
              <PctInput
                value={evento.cashbackPct}
                onChange={(v) => update((e) => ({ ...e, cashbackPct: v }))}
                faixa={FAIXA_PCT}
              />
            </Field>
            <Field label="Desconto do cupom (%)" className="w-36">
              <PctInput
                value={evento.descontoMedioPct ?? ''}
                onChange={(v) => update((e) => ({ ...e, descontoMedioPct: v }))}
                placeholder="0"
                faixa={FAIXA_PCT}
              />
            </Field>
            <Field label="Ingressos com desconto" className="w-56">
              <div className="flex items-center gap-2">
                {modoNum ? (
                  <NumInput
                    value={evento.descontoIngressosValor ?? ''}
                    onChange={(v) => update((e) => ({ ...e, descontoIngressosValor: v }))}
                    placeholder="todos"
                    min="0"
                    step="1"
                    className="w-24"
                    faixa={FAIXA_QUANTIDADE}
                  />
                ) : (
                  <PctInput
                    value={evento.descontoIngressosValor ?? ''}
                    onChange={(v) => update((e) => ({ ...e, descontoIngressosValor: v }))}
                    placeholder="100"
                    faixa={FAIXA_PCT}
                    className="w-24"
                  />
                )}
                <Segmented
                  value={modoNum ? 'numero' : 'pct'}
                  onChange={(m) => {
                    // Trocar nº→% com contagem > 100 no campo: em % o valor não
                    // vale (faixa 0..100) e a migração o apagaria em SILÊNCIO na
                    // próxima carga (achado A3 da verificação hostil de 20/07).
                    // Limpamos JUNTO com a troca — visível no toast e reversível
                    // pelo desfazer, nunca perda calada num reload futuro.
                    const v = evento.descontoIngressosValor
                    const limpa = m !== 'numero' && foraDaFaixa(v, FAIXA_PCT)
                    update(
                      (e) => ({
                        ...e,
                        descontoIngressosModo: m,
                        ...(limpa ? { descontoIngressosValor: '' } : {}),
                      }),
                      'trocar o modo do desconto'
                    )
                    if (limpa)
                      showToast(
                        `Em modo %, ${v} não vale (a faixa é 0–100): o campo foi limpo — Desfazer restaura.`
                      )
                  }}
                  options={[
                    ['pct', '%'],
                    ['numero', 'nº'],
                  ]}
                />
              </div>
            </Field>
            <p className="pb-2 text-xs text-[var(--tinta-2)]">
              {taxaCliente ? (
                <>
                  <strong>Taxa paga pelo cliente:</strong> a taxa NÃO desconta da receita (o
                  cliente paga o preço final = pós-desconto × (1 + taxa)); o cashback da
                  Tiqueteira segue recebido sobre a receita de ingressos, como sempre. Efeito
                  líquido no realista: <span className="tnum">+ {fmtBRL(r.cashback)}</span>
                </>
              ) : (
                <>
                  <strong>Taxa paga por nós:</strong> a taxa é descontada e o cashback da
                  Tiqueteira é recebido, ambos sobre a receita de ingressos. Efeito líquido no
                  realista:{' '}
                  <span className="tnum">
                    {r.cashback - r.taxa >= 0 ? '+' : '−'} {fmtBRL(Math.abs(r.cashback - r.taxa))}
                  </span>
                </>
              )}
            </p>
          </div>
          {/* B3 (BACKLOG S4): as três tarjas de alerta abaixo (cupom/ingressos fora
              de 0–100%, nº negativo) usam tokens tema-aware — bg-red-50/text-red-700
              fixos somem (viram barra clara) no tema escuro. */}
          {(cupom < 0 || cupom > 100) && (
            <p className="mt-2 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
              Desconto do cupom de {cupom}% está fora de 0–100% — a conta perde o sentido.
              Confira o valor.
            </p>
          )}
          {!modoNum &&
            !fracaoVazia &&
            (num(evento.descontoIngressosValor) < 0 ||
              num(evento.descontoIngressosValor) > 100) && (
              <p className="mt-2 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
                {num(evento.descontoIngressosValor)}% dos ingressos com desconto está fora de
                0–100% — a conta perde o sentido. Confira o valor.
              </p>
            )}
          {modoNum && !fracaoVazia && num(evento.descontoIngressosValor) < 0 && (
            <p className="mt-2 rounded-lg bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs font-medium text-[var(--vermelho-texto)]">
              Número de ingressos com desconto negativo não existe — está valendo 0 (sem
              desconto). Confira o valor.
            </p>
          )}
          {cupom !== 0 && modoNum && fracaoVazia && (
            <p className="mt-2 rounded-lg bg-[rgba(254,205,7,0.12)] px-3 py-2 text-xs text-[var(--ambar-texto)]">
              Modo nº sem número informado: o cupom vale para <strong>todos</strong> os
              ingressos até você preencher quantos têm desconto.
            </p>
          )}
          {cupom !== 0 && (
            <p className="mt-2 text-xs font-medium text-[var(--tinta-2)]">
              Desconto efetivo no realista: <span className="tnum">{fmtPct(efetivoR, 2)}</span>
              {efetivoOutros && (
                <>
                  {' '}
                  · pessimista <span className="tnum">{fmtPct(efetivoOutros.pessimista, 2)}</span>{' '}
                  · otimista <span className="tnum">{fmtPct(efetivoOutros.otimista, 2)}</span> —
                  no modo nº os mesmos ingressos com cupom pesam mais quando se vende menos
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            <strong>Desconto do cupom:</strong> cupons e promoções fazem o valor realmente pago
            ficar abaixo do preço de tabela. <strong>Desconto efetivo = cupom × fração de
            ingressos com desconto</strong> (sugestão 29, conta aprovada em 19/07/2026); receita
            = lotes × preço × (1 − efetivo), com cenários, taxa e cashback por cima. No modo %, a
            fração é fixa (vazio = 100%, o cupom em todos — conta de sempre); no modo nº, fração
            = min(1, nº ÷ vendidos do cenário), recalculada por cenário. Cortesias ficam fora
            (não são vendidos). O <em>realizado</em> não usa estes campos — a Tiqueteira já manda
            valores líquidos de cupom.
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Outras receitas</h3>
          {/* Open bar (sugestão 27, regra do Marco 18/07/2026): marcado →
              receita de bar = 0 nos cenários e no fechamento (calc.js). */}
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--tinta-2)]">
            <input
              type="checkbox"
              checked={evento.openBar === true}
              onChange={(e) => update((ev) => ({ ...ev, openBar: e.target.checked }))}
              className="size-4 cursor-pointer accent-[var(--acento)]"
            />
            Open bar (sem receita de bar)
          </label>
          {/* Bar em dois modos (sugestão 42 — conta aprovada pelo Marco em
              19/07/2026): FIXO = o lucro digitado, igual nos 3 cenários (a
              conta de sempre); POR PESSOA = ticket do cenário × público do
              cenário − sistema (calc.js/barPorPessoa). Evento novo nasce por
              pessoa; evento salvo só muda de modo por este seletor. */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <Field label="Receita do bar" className="w-fit">
              <Segmented
                value={barPP ? 'porPessoa' : 'fixo'}
                onChange={(m) => update((ev) => ({ ...ev, barModo: m }))}
                options={[
                  ['fixo', 'valor fixo'],
                  ['porPessoa', 'por pessoa'],
                ]}
              />
            </Field>
            {!barPP && (
              <Field label="Bar — lucro líquido esperado" className="w-44">
                <MoneyInput
                  value={openBar ? '' : evento.outrasReceitas?.bar}
                  onChange={(v) => setOutras({ bar: v })}
                  disabled={openBar}
                  placeholder={openBar ? 'open bar' : undefined}
                  className={openBar ? 'opacity-60' : ''}
                />
              </Field>
            )}
          </div>
          {barPP && !openBar && (
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              {CENARIOS.map((k) => (
                <Field key={k} label={`Consumo/pessoa — ${CENARIO_LABEL[k].toLowerCase()}`} className="w-44">
                  <MoneyInput
                    value={evento.barTicket?.[k] ?? ''}
                    onChange={(v) =>
                      update((ev) => ({ ...ev, barTicket: { ...ev.barTicket, [k]: v } }))
                    }
                    placeholder="110"
                    faixa={FAIXA_CONSUMO}
                  />
                </Field>
              ))}
              <Field label="Taxa do sistema (%)" className="w-36">
                {/* Trava do percentual (Marco, 23/07/2026 — lote de travas,
                    item 1): 0..100 na porta, como cupom/taxa/cashback. Os
                    min/max antigos eram INERTES (o NumInput é type=text) — davam
                    falsa proteção; a régua real é `faixa`. */}
                <PctInput
                  value={evento.barTaxaSistemaPct ?? ''}
                  onChange={(v) => update((ev) => ({ ...ev, barTaxaSistemaPct: v }))}
                  placeholder="0"
                  faixa={FAIXA_PCT}
                />
              </Field>
              <Field label="Custo do sistema (R$)" className="w-40">
                <MoneyInput
                  value={evento.barCustoSistema ?? ''}
                  onChange={(v) => update((ev) => ({ ...ev, barCustoSistema: v }))}
                  placeholder="0"
                  faixa={FAIXA_CUSTO}
                />
              </Field>
            </div>
          )}
          {openBar ? (
            <p className="mt-2 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
              <strong>Evento open bar — sem receita de bar:</strong> o bar entra como R$ 0 nos
              três cenários (em qualquer modo) e o Fechamento não pede bar realizado. O{' '}
              <strong>custo</strong> do bar não muda sozinho — continua sob seu controle na aba
              Custos (A&amp;B).
              {!barPP && num(evento.outrasReceitas?.bar) > 0 && (
                <>
                  {' '}O valor digitado ({fmtBRL(num(evento.outrasReceitas?.bar))}) fica
                  guardado e volta a contar se você desmarcar.
                </>
              )}
            </p>
          ) : barPP ? (
            <>
              <p className="mt-2 text-xs font-medium text-[var(--tinta-2)]">
                Bar por cenário: pess. <span className="tnum">{fmtBRL(barCenarios.pessimista)}</span>{' '}
                · real. <span className="tnum">{fmtBRL(barCenarios.realista)}</span> · otim.{' '}
                <span className="tnum">{fmtBRL(barCenarios.otimista)}</span>
                {contaBarR && (
                  <>
                    {' '}— no realista: <span className="tnum">{contaBarR}</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-[var(--tinta-3)]">
                <strong>Consumo por pessoa</strong> (não é lucro) × público do cenário (pagos +
                cortesias — cortesia consome) − taxa do sistema (% sobre o consumo) − custo do
                sistema (R$ fixo do evento). Cada cenário usa o próprio ticket e o próprio
                público.
                {num(evento.outrasReceitas?.bar) > 0 && (
                  <>
                    {' '}O valor fixo digitado antes ({fmtBRL(num(evento.outrasReceitas?.bar))})
                    fica guardado e volta se você trocar para “valor fixo”.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-[var(--tinta-3)]">
              Valor fixo, somado igualmente aos três cenários.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[var(--borda)] pt-3">
            <h3 className="text-sm font-semibold">Patrocínios</h3>
            <Btn onClick={addPatrocinio}>+ Adicionar patrocínio</Btn>
          </div>
          {(evento.patrocinios || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {(evento.patrocinios || []).map((p, indice) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2">
                  {/* Setas ↑↓ na frente da linha, como nas outras duas telas —
                      a ordem aqui é só de leitura (a soma por estágio não olha
                      posição), mas o gesto é o mesmo em todo o app. */}
                  <BotoesOrdem
                    nome={p.patrocinador}
                    tipo="patrocínio"
                    indice={indice}
                    total={(evento.patrocinios || []).length}
                    onSubir={() => moverPatrocinio(p, 'cima', indice)}
                    onDescer={() => moverPatrocinio(p, 'baixo', indice)}
                  />
                  <TextInput
                    value={p.patrocinador}
                    onChange={(e) => setPatrocinio(p.id, { patrocinador: e.target.value })}
                    placeholder="Patrocinador (cervejaria, energético…)"
                    className="min-w-36 flex-1"
                  />
                  <MoneyInput
                    value={p.valor}
                    onChange={(v) => setPatrocinio(p.id, { valor: v })}
                    faixa={FAIXA_PATROCINIO}
                    className="w-28"
                  />
                  {/* estágio: o estado mora na bola (proposta neutra · confirmado
                      âmbar · recebido verde), o Select fica em tinta normal — a
                      cor de estado não vaza para o texto do controle (decisão do
                      Marco 24/07). */}
                  <Bola
                    cor={
                      p.estagio === 'recebido'
                        ? 'var(--verde-texto)'
                        : p.estagio === 'confirmado'
                          ? 'var(--ambar-texto)'
                          : 'var(--tinta-3)'
                    }
                    size={8}
                    title={`Estágio: ${ESTAGIO_PATROCINIO_LABEL[p.estagio]}`}
                  />
                  <Select
                    value={p.estagio}
                    onChange={(e) => setPatrocinio(p.id, { estagio: e.target.value })}
                    options={ESTAGIOS_PATROCINIO.map((est) => ({
                      value: est,
                      label: ESTAGIO_PATROCINIO_LABEL[est],
                    }))}
                    className="w-36 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => rmPatrocinio(p.id)}
                    className="cursor-pointer text-[var(--tinta-3)] hover:text-[var(--vermelho-texto)]"
                    title="Remover patrocínio"
                    aria-label="Remover patrocínio"
                  >
                    <AppIcon icon={X} size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {pat.total !== 0 && (
            <p className="mt-2 text-xs font-medium text-[var(--tinta-2)]">
              🤝 Fechado (conta na receita): <span className="tnum">{fmtBRL(pat.fechado)}</span>
              {pat.potencial > 0 && (
                <>
                  {' '}· 📝 Em proposta (potencial, não somado):{' '}
                  <span className="tnum">{fmtOuIlegivel(pat.potencial, fmtBRL)}</span>
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            Estágios no vocabulário do Financeiro: 📝 Proposta → 🤝 Confirmado → ✅ Recebido.
            Só patrocínio <strong>confirmado ou recebido</strong> soma na receita dos cenários e
            no semáforo; proposta aparece como potencial, nunca somada (sugestão 22, regra
            aprovada em 18/07/2026).
          </p>
        </Card>

        {/* ── IMPOSTO SOBRE A RECEITA (Marco, 27/07/2026) ──────────────────
            POR QUE ESTE CARD MORA AQUI, e não na aba Custos: as TRÊS bases
            que ele liga — bilheteria, bar e patrocínio — são digitadas nesta
            mesma aba, logo acima; cada chave fica embaixo do número que ela
            tributa, e dá para conferir na hora. A aba Custos seria o lugar
            errado por outro motivo, mais grave: o imposto é dedução de
            RECEITA, não custo, e colocá-lo ao lado da contingência convidaria
            exatamente a confusão que o Marco descartou (contingência é reserva
            para custo estourar; imposto não estoura). Ver src/lib/imposto.js. */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Imposto sobre a receita</h3>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <Field label="Alíquota (%)" className="w-32">
              <PctInput
                value={evento.impostoPct ?? ''}
                onChange={(v) => update((ev) => ({ ...ev, impostoPct: v }))}
                placeholder="0"
                faixa={FAIXA_PCT}
              />
            </Field>
            <fieldset className="min-w-0">
              <legend className="mb-1 text-xs text-[var(--tinta-2)]">Incide sobre</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {IMPOSTO_BASES.map((b) => (
                  <label
                    key={b}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[var(--tinta-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={sobre[b]}
                      onChange={(e) =>
                        update((ev) => ({
                          ...ev,
                          impostoSobre: { ...impostoSobreDoEvento(ev), [b]: e.target.checked },
                        }))
                      }
                      className="size-4 cursor-pointer accent-[var(--acento)]"
                    />
                    {IMPOSTO_BASE_LABEL[b]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {/* Alíquota digitada e nenhuma base marcada = imposto R$ 0. Não é
              erro (pode ser de propósito), mas é o estado em que o Marco
              digitou algo e não viu efeito nenhum — então a tela fala. */}
          {temImposto(r) && r.imposto.bases.length === 0 && !r.imposto.vazia && (
            <p className="mt-2 flex items-start gap-1 text-xs text-[var(--ambar-texto,var(--tinta-2))]">
              <AppIcon icon={TriangleAlert} size={13} />
              <span>
                Alíquota de {r.imposto.aliquota}% sem nenhuma base marcada — o imposto fica em
                R$ 0. Marque bilheteria, bar ou patrocínio para ele entrar na conta.
              </span>
            </p>
          )}
          {temImposto(r) && r.imposto.vazia && r.imposto.bases.length > 0 && (
            <p className="mt-2 flex items-start gap-1 text-xs text-[var(--ambar-texto,var(--tinta-2))]">
              <AppIcon icon={TriangleAlert} size={13} />
              <span>
                Base marcada sem alíquota preenchida — o imposto fica em R$ 0 até você digitar
                o percentual.
              </span>
            </p>
          )}
          {temImposto(r) && r.imposto.valor !== 0 && (
            <p className="mt-2 text-xs font-medium text-[var(--tinta-2)]">
              No realista: <span className="tnum">{fmtBRL(r.imposto.base)}</span> de base ×{' '}
              {r.imposto.aliquota}% = <span className="tnum">{fmtBRL(r.imposto.valor)}</span> de
              imposto.
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            <strong>Uma alíquota, três chaves</strong> — nem toda categoria é tributada em todo
            evento. A base da bilheteria é a <strong>BRUTA</strong>: antes da comissão da Tiqueteira
            e antes do cashback (decisão de 27/07/2026 — no modo repasse a líquida fica MAIOR
            que a bruta, e tributá-la cobraria imposto sobre o cashback que volta para a
            produção). Bar e patrocínio entram pelo valor deles; do patrocínio, só o fechado.
            O imposto é <strong>deduzido da receita</strong>, aparece no DRE entre a receita
            total e o lucro, e <strong>não entra na base da contingência</strong> — contingência
            é reserva para custo estourar, e imposto não estoura.
          </p>
        </Card>

        {/* ── Ritmo real (Tiqueteira) — SPEC-PONTE-RITMO, Marco 23/07/2026 ──
            Vista informativa: NENHUM número daqui entra em cálculo, cenário
            ou semáforo (calc.js intocado). Leitura por clique (exceção de
            rede da casa); o vínculo com a edição fica no evento; a curva
            nunca é persistida.
            col-span-2 (handoff UX 23/07): a curva de ritmo é uma vista larga —
            espremida em meia coluna ficava apertada. Ocupa a largura cheia da
            grade; layout apenas. */}
        <div className="sm:col-span-2">
          <RitmoTiqueteira evento={evento} update={update} />
        </div>
      </div>
    </div>
  )
}

// Exportado para poder ser RENDERIZADO num teste (30/08/2026). O defeito que
// este componente carregava — o `update` recebendo objeto onde se espera função
// — só aparece no clique, e só existe teste de clique se houver o que montar.
export function RitmoTiqueteira({ evento, update }) {
  const [edicoes, setEdicoes] = useState(null) // null = ainda não buscou
  const [erro, setErro] = useState('')
  const [buscando, setBuscando] = useState(false)

  const vinculo = evento.ritmoTiqueteira
  const edicaoLigada =
    vinculo && edicoes ? edicoes.find((e) => String(e.evento_id) === String(vinculo.edicaoId)) : null
  const resumo = resumoRitmo(edicaoLigada)
  const previstos = ingressosPrevistosRealista(evento)
  const pct = resumo ? pctDoPrevisto(resumo.vendidos, previstos) : null

  async function buscar() {
    setBuscando(true)
    setErro('')
    try {
      setEdicoes(await buscarCurvaEdicoes())
    } catch (e) {
      setErro(e.message)
      setEdicoes(null)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Ritmo real (Tiqueteira){' '}
          <span className="text-xs font-normal text-[var(--tinta-3)]">
            — vendas de verdade, do Financeiro, só leitura
          </span>
        </h3>
        {/* Na cópia da nuvem (05/10/2026) a ponte não existe: desligado, e o
            title diz por quê — como os outros botões da ponte. No Mac o botão
            segue exatamente como era (sem title). */}
        <Btn
          onClick={buscar}
          disabled={buscando || origemNaNuvem()}
          title={origemNaNuvem() ? TITULO_PONTE_NA_NUVEM : undefined}
        >
          {buscando ? 'Buscando…' : edicoes ? 'Buscar de novo' : 'Buscar ritmo no Financeiro'}
        </Btn>
      </div>

      {erro && <p className="mt-2 text-xs text-[var(--tinta-2)]">{erro}</p>}

      {!erro && !edicoes && (
        <p className="mt-2 text-xs text-[var(--tinta-3)]">
          Com o Financeiro aberto, clique em buscar. Nenhum número daqui entra nos cenários —
          é o retrato real ao lado do plano.
        </p>
      )}

      {edicoes && edicoes.length === 0 && (
        <p className="mt-2 text-xs text-[var(--tinta-2)]">
          O Financeiro ainda não tem edições datadas com venda — separe as edições e complete as
          datas na aba Vendas › Operações de lá, e busque de novo.
        </p>
      )}

      {edicoes && edicoes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--tinta-2)]">Edição desta festa:</span>
          <Select
            value={vinculo ? String(vinculo.edicaoId) : ''}
            // DOIS DEFEITOS INDEPENDENTES NA MESMA LINHA, os dois consertados
            // em 30/08/2026, e cada um sozinho já impedia o vínculo de salvar:
            //
            // 1. O ARGUMENTO ERA LIDO COMO VALOR. `Select` (ui.jsx) é um
            //    `<select>` nativo com `{...props}`, então o React entrega o
            //    EVENTO. As outras 13 chamadas de `<Select>` do app leem
            //    `e.target.value`; só esta lia o argumento direto. `String(v)`
            //    dava "[object Object]", o `find` devolvia `undefined` e o
            //    `if (ed)` engolia o clique — sem erro, sem aviso, sem nada.
            //
            // 2. `update` RECEBIA OBJETO ONDE ESPERA FUNÇÃO. `update` é o
            //    `atualizarEvento` do App.jsx, que faz `fn(e)` sobre o evento
            //    FRESCO do store; as outras ~20 chamadas deste arquivo passam
            //    arrow function. Esta passava o objeto que `salvarEdicaoRitmo`
            //    devolve, e a chamada estourava com "fn is not a function",
            //    caindo na RedeDeSegurança.
            //
            // O vínculo "Edição desta festa" nunca salvou uma vez desde que foi
            // escrito. Prova de tela em `vinculoEdicaoRitmo.fio.test.jsx`.
            onChange={(e) => {
              const escolhido = e.target.value
              const ed = edicoes.find((x) => String(x.evento_id) === String(escolhido))
              if (ed) update((ev) => salvarEdicaoRitmo(ev, ed))
            }}
            options={[
              { value: '', label: vinculo ? vinculo.edicaoNome : '— escolha a edição —' },
              ...edicoes.map((e) => ({
                value: String(e.evento_id),
                label: `${e.nome}${e.data ? ` · ${fmtData(e.data)}` : ''} (${e.empresa || ''})`,
              })),
            ]}
          />
        </div>
      )}

      {resumo && (
        <div className="mt-3 rounded-lg border border-[var(--borda)] p-3">
          <p className="text-sm">
            <strong className="tnum">{fmtInt(resumo.vendidos)}</strong>{' '}
            {resumo.base === 'ingresso' ? 'ingressos vendidos' : 'pagamentos aprovados'} ·{' '}
            <strong className="tnum">{fmtBRL(resumo.valor)}</strong>
            {pct != null && previstos > 0 && (
              <>
                {' '}— <strong className="tnum">{String(pct).replace('.', ',')}%</strong> dos{' '}
                <span className="tnum">{fmtInt(previstos)}</span> previstos no realista
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--tinta-3)]">{resumo.rotulo}</p>
          {pct == null && (
            <p className="mt-1 text-xs text-[var(--tinta-3)]">
              Sem quantidades nos lotes ainda — preencha os lotes para ver o % do previsto.
            </p>
          )}
        </div>
      )}

      {edicoes && vinculo && !edicaoLigada && (
        <p className="mt-2 text-xs text-[var(--tinta-2)]">
          A edição ligada ({vinculo.edicaoNome}) não veio na busca — confira no Financeiro se ela
          ainda existe, ou escolha outra acima.
        </p>
      )}
    </Card>
  )
}
