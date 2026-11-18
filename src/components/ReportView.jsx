// Relatório / PDF — papel BRANCO de propósito (vai para impressora e para o
// WhatsApp das sócias, que abrem NO CELULAR), acento azul da marca e
// assinatura da casa no rodapé ("digno de investidor").
// Sessão K: seletor "Resumido × Completo" NA HORA de exportar (substitui o
// checkbox 'modo compacto' da candidata 8, por decisão do Marco em 18/07):
// - Resumido: 1 página — veredito, cenários e números-chave (o que vai no
//   WhatsApp; tipografia generosa para ler no telefone sem zoom).
// - Completo: tudo — DRE, lotes, custos detalhados e comparações.
// A última escolha fica lembrada (chave própria do localStorage).
import { useState } from 'react'
import { Btn, Segmented, Bola } from './ui.jsx'
import { AppIcon, Printer, ArrowLeft } from './AppIcon.jsx'
import { AssinaturaFesta } from './Marca.jsx'
import { computeCenarios, CENARIOS, CENARIO_LABEL, veredito, custosPorStatus, isCortesia, isPrecoAusente, isOpenBar, isTaxaCliente, isBarPorPessoa, descontoEfetivoPct } from '../lib/calc.js'
import { fmtBRL, fmtBRL2, fmtInt, fmtPct, fmtData, DASH } from '../lib/format.js'
import { ajusteCustoTexto, AJUSTE_CUSTO_LABEL } from '../lib/dre.js'
import { impostoLinhaLabel, impostoTexto, impostoValor, temImposto } from '../lib/imposto.js'
import { dividirReferenciasEmFaixas, REFERENCIAS_POR_FAIXA } from '../lib/faixasMatrizRelatorio.js'
import { colunaCustoPrevisao } from '../lib/comparacaoCustos.js'
import { confrontoDeItens, textoDelta, sinalDelta } from '../lib/confrontoCustos.js'
import { contaOrcamentoFechado } from '../lib/statusCusto.js'
import { fraseVeredito, TITULO_VEREDITO } from '../lib/vereditoTexto.js'
import {
  premissaDesconto,
  premissaBar,
  contaBarPorPessoa,
  premissasCurva,
  TICKET_LIQUIDO_LABEL,
  TICKET_BRUTO_LABEL,
  microTicketBruto,
  microTicketLiquido,
  legendasRelatorio,
} from '../lib/premissaTexto.js'
import { precoEfetivoLote } from '../lib/precoLote.js'
import AvisoLoteSemPreco from './AvisoLoteSemPreco.jsx'
import { ROTULO_LOTE_SEM_PRECO, PRECO_AUSENTE_TEXTO } from '../lib/loteSemPreco.js'
import { linhaRitmoRelatorio } from '../lib/resumo.js'
import { textoBreakEven } from '../lib/breakEvenTexto.js'
import {
  benchmarksAtivos,
  CAT_LABELS,
  temSemReserva,
  ETIQUETA_SEM_RESERVA,
  EXPLICACAO_SEM_RESERVA,
} from '../lib/benchmarks.js'
import { CENARIO_TONS, HBars } from './Charts.jsx'
import { num, somaCentavos } from '../lib/util.js'
import { hojeISO, dataLocalDoInstante } from '../lib/dataLocal.js'
import { resultadoQueFecha } from '../lib/exibicaoQueFecha.js'
import { nomeArquivoPdf } from '../lib/relatorio.js'
import AvisoCustoQuebrado, {
  AvisoReceitaQuebrada,
  faixaDaFotoSa,
  AvisoBenchmarkQuebrado,
  NUMERO_NAO_CALCULA,
  TITULO_VEREDITO_QUEBRADO,
} from './AvisoCustoQuebrado.jsx'
import {
  cenarioQuebrado,
  receitaDoCenarioQuebrada,
  vereditoQuebrado as vereditoQuebradoLib,
  fraseVereditoQuebrado,
  fotoQuebrada,
  cabeComoDinheiro,
  VALOR_ILEGIVEL,
  fmtOuIlegivel,
  publicoIlegivel,
  publicoDaReferencia,
  ESTADO_PUBLICO,
  PUBLICO_ILEGIVEL,
} from '../lib/dadoQuebrado.js'

const DOT = {
  pessimista: CENARIO_TONS.light.pessimista.dot,
  realista: CENARIO_TONS.light.realista.dot,
  otimista: CENARIO_TONS.light.otimista.dot,
}

// cores do veredito em papel (imprimem bem e leem no celular)
const VEREDITO_PAPEL = {
  verde: { bola: '#00782a', texto: '#005c20' },
  amarelo: { bola: '#fecd07', texto: '#6e5500' },
  vermelho: { bola: '#ff000c', texto: '#a30008' },
}

const NIVEL_KEY = 'previsao-eventos:relatorio-nivel:v1'
const loadNivel = () => {
  try {
    return localStorage.getItem(NIVEL_KEY) === 'completo' ? 'completo' : 'resumido'
  } catch {
    return 'resumido'
  }
}

// `compacto`: passo menor de fonte e respiro lateral, usado SÓ na matriz de
// comparação com eventos passados — faixas de até quatro referências,
// com todos os valores e a linha de Custo total visíveis.
// `style` existe porque o Th já traz `text-stone-600` embutido: uma classe de
// cor passada por className empata em especificidade com ela e QUEM VENCE é a
// ordem no CSS gerado, não a ordem no atributo — o azul da previsão morria em
// silêncio. Cor de cabeçalho que precisa vencer vem por style, como o resto do
// arquivo já faz no veredito e nos dots de cenário.
const Th = ({ children, right, compacto, className = '', style, scope }) => (
  <th
    scope={scope}
    style={style}
    className={`border-b border-stone-300 py-1.5 font-semibold text-stone-600 ${
      compacto ? 'pr-1.5 text-[10px] leading-tight' : 'pr-3 text-xs'
    } ${right ? 'text-right' : 'text-left'} ${className}`}
  >
    {children}
  </th>
)
// `rotulo` vira data-rotulo (label que aparece embaixo do valor quando a linha
// REFLUI em tela estreita); `nome` marca a célula-identidade (nome do serviço,
// largura toda no reflow); `trunca` corta com … (Fornecedor cede primeiro).
const Td = ({ children, right, strong, compacto, className = '', rotulo, nome, trunca, colSpan }) => (
  <td
    colSpan={colSpan}
    data-rotulo={rotulo}
    className={`border-b border-stone-100 py-1 ${
      compacto ? 'pr-1.5 text-[11px]' : 'pr-3 text-xs'
    } ${right ? 'text-right tnum' : ''} ${
      strong ? 'font-semibold' : ''
    } ${nome ? 'celula-nome' : ''} ${trunca ? 'trunca-celula' : ''} ${className}`}
  >
    {children}
  </td>
)

const H2 = ({ children }) => (
  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#0045dd]">
    {children}
  </h2>
)

export default function ReportView({ evento, store, onBack }) {
  const [nivel, setNivelState] = useState(loadNivel)
  const setNivel = (n) => {
    setNivelState(n)
    try {
      localStorage.setItem(NIVEL_KEY, n)
    } catch {
      // preferência cosmética — sem quota, só não lembra
    }
  }
  const completo = nivel === 'completo'

  // Salvar PDF (sugestão 41): o nome do arquivo sugerido sai do nome+data do
  // evento. O navegador usa o document.title como nome padrão — trocamos só
  // durante a impressão e devolvemos o original ao fechar o diálogo.
  const salvarPdf = () => {
    const original = document.title
    document.title = nomeArquivoPdf(evento)
    const restaurar = () => {
      document.title = original
      window.removeEventListener('afterprint', restaurar)
    }
    window.addEventListener('afterprint', restaurar)
    window.print()
    // rede de segurança caso afterprint não dispare (o nome já foi capturado
    // na abertura do diálogo, então restaurar depois não muda o sugerido)
    setTimeout(restaurar, 1500)
  }

  const c = computeCenarios(evento)
  const v = veredito(c, evento)
  const corV = VEREDITO_PAPEL[v.cor]
  // Dado quebrado (Marco, 26/07/2026; lucro e resultado em 05/10/2026): o
  // papel imprimia o lucro IGUAL À RECEITA, positivo e verde, e o resultado
  // real da festa fechada em verde com `null >= 0`. Lucro, resultado, margem
  // e veredito saem como texto quando o número deixou de ser dinheiro por
  // causa de um custo acusado. Nenhuma conta muda.
  const cenQuebrado = (s) => cenarioQuebrado(evento, s, c)
  const recQuebrada = (s) => receitaDoCenarioQuebrada(evento, s, c)
  const recR = recQuebrada(c.realista)
  // Linhas da DRE que vêm da receita: tudo menos custo, lucro e margem (que
  // já têm a sua regra). O imposto entra — é dedução de receita.
  const LINHAS_DE_CUSTO = ['Custos (itens)', 'Custo total do cenário', AJUSTE_CUSTO_LABEL, 'Lucro', 'Margem']
  const dreDependeDaReceita = (label) =>
    !LINHAS_DE_CUSTO.includes(label) && !label.startsWith('Contingência') && !label.startsWith('Patrocínio em proposta')
  const algumCenarioQuebrado = CENARIOS.some((k) => cenQuebrado(c[k]) || recQuebrada(c[k]))
  const vereditoQuebrado = vereditoQuebradoLib(evento, c)
  const fotoRes = evento.status === 'fechado' ? evento.fechamento?.foto?.resultado : null
  const resultadoRealQuebrado = fotoQuebrada(fotoRes)
  const bms = benchmarksAtivos(evento, store)
  const faixasMatriz = dividirReferenciasEmFaixas(bms)
  const publicoPrev = c.realista.publico || num(evento.publicoEstimado)
  // Lookup de EXIBIÇÃO da matriz de comparação (nenhuma conta nova: só acha,
  // na lista que computeCenarios já devolveu, o custo considerado da
  // categoria). Virou função porque a tabela passou a ter categorias nas
  // LINHAS — o mesmo valor de antes, buscado por linha em vez de por coluna.
  const custoPrevisaoCat = (k) =>
    c.realista.custosCategorias.find((x) => x.id === k)?.considerado || 0
  // Coluna da previsão da tabela de comparação, já com os INTEIROS que a tela
  // imprime — montados para a coluna sempre fechar no "Custo total" exibido
  // (decisão do Marco, 19/07/2026). A régua e o negrito da linha de total
  // CONVIDAM a soma; a tabela mostra R$ sem centavos; e ~10 linhas arredondadas
  // por conta própria erram alguns reais no conjunto (medido num evento real:
  // 74.021 na soma × 74.016 exibido). Nenhum número estava errado, mas a tela
  // prometia uma soma que não entregava. A regra de arredondamento mora em
  // src/lib/comparacaoCustos.js, com teste de fuzzing; calc.js não foi tocado.
  const colunaPrevisao = colunaCustoPrevisao(c.realista, custoPrevisaoCat)
  // Desconto efetivo no realista (F2-W, adendo do Marco): quando há cupom, a
  // tabela de lotes do relatório ganha o preço EFETIVO (pós-desconto), como a
  // coluna "Efetivo" da tela de edição — feature não é ilha. A coluna Receita
  // da tabela segue sobre o preço de TABELA (o efetivo é adicional, nunca a
  // substitui). Correção da Sessão de Clareza do DRE (19/07/2026): a "Receita
  // bruta bilheteria" do DRE NÃO é preço de tabela — calc.js aplica o desconto
  // lote a lote ((lotes × preço) × (1 − desconto)), então ela já vem
  // descontada. O comentário antigo e o microtexto da seção diziam o
  // contrário e explicavam a diferença ao contrário.
  const cupom = num(evento.descontoMedioPct)
  const efetivoR = descontoEfetivoPct(evento, c.realista.pagos)

  // O lote foi ZERADO À MÃO no cenário Realista? (Marco, 26/07/2026.) É o
  // override de cenário posto em 0 — uma decisão de não vender aquele lote —,
  // e não a mesma coisa que um lote de cortesia, que também imprime "R$ 0".
  // Lê a mesma configuração que `loteQtdCenario` lê em calc.js; nada é
  // recalculado aqui.
  const zeradoNoRealista = (lote) => {
    if (isPrecoAusente(lote) || isCortesia(lote) || lote.somenteOtimista) return false
    const ov = evento.cenariosConfig?.overrides?.realista?.[lote.id]
    return ov !== undefined && ov !== null && ov !== '' && num(ov) === 0
  }

  // ─── AS LINHAS DA TABELA BILHETERIA, MONTADAS UMA VEZ ─────────────────────
  //
  // FONTE ÚNICA, DE PROPÓSITO (26/07/2026, depois de dois achados da
  // verificação adversarial). A versão anterior tinha DUAS listas: a conferência
  // somava `c.realista.porLote` inteiro, e o JSX decidia célula a célula quem
  // imprimia número. As duas discordavam, e discordar era o defeito:
  //
  // · S1 medido — um lote "só otimista" com override de cenário no Realista
  //   VENDE (loteQtdCenario lê o override antes de olhar a marca, calc.js:24
  //   contra :36). O DRE somava R$ 69.400, a coluna imprimia R$ 59.400 porque a
  //   célula escondia todo lote marcado como "só otimista", e o microtexto
  //   continuava afirmando que a soma batia. R$ 10.000 sumindo com uma promessa
  //   por escrito em cima.
  //
  // · A regra do travessão passa a ser a QUANTIDADE do cenário, não a marca:
  //   lote que não vende neste cenário (`qtd` 0) não tem receita a mostrar;
  //   lote zerado à mão vende zero de propósito e imprime "R$ 0,00" com a marca
  //   no nome. Assim o override é respeitado nos dois sentidos.
  //
  // Como a conferência agora soma EXATAMENTE as linhas que imprimem número, ela
  // não tem como voltar a divergir do que está na tela.
  const linhasBilheteria = (evento.lotes || [])
    .filter((l) => num(l.quantidade) > 0 || num(l.valor) > 0)
    .map((l) => {
      const porLote = c.realista.porLote.find((pl) => pl.id === l.id)
      const imprimeReceita = num(porLote?.qtd) > 0 || zeradoNoRealista(l)
      return { lote: l, porLote, imprimeReceita }
    })

  // A soma das linhas que imprimem número fecha com a "Receita bruta
  // bilheteria" que o DRE imprime no mesmo relatório?
  //
  // A COMPARAÇÃO É ENTRE IGUAIS (26/07/2026, segundo achado). A `bruta` da casa
  // é quantizada a centavo lote a lote desde 25/07 — `bilheteria()` acumula
  // `Math.round(receita × 100)` (calc.js:99-104). Somar as receitas CRUAS e
  // comparar com ela deixa até meio centavo de resíduo POR LOTE: numa grade de
  // 8 lotes o resíduo legítimo chega a R$ 0,04, oito vezes a tolerância de meio
  // centavo que estava escrita aqui. Medido: na grade padrão do app, com preços
  // de centavo (39,90 / 49,90 / …), 17 de 40 valores de cupom faziam a coluna
  // inteira desaparecer e o microtexto acusar ticket manual que não existia.
  // Quantizar os dois lados com a MESMA régua faz a diferença ser exatamente
  // zero no caso normal, e mantém a guarda apertada onde ela importa.
  //
  // O MEIO CENTAVO É CINTO DE SEGURANÇA, NÃO É CARREGADO — e isto está escrito
  // porque um comentário que promete mais do que entrega é o defeito que esta
  // seção passou o dia consertando. Com os dois lados quantizados a diferença
  // hoje é exatamente 0, então trocar `0.005` por `0` não muda resultado nenhum
  // e nenhum teste acusaria — medido. Ele fica para o dia em que a `bruta` da
  // casa deixar de ser construída com `Math.round` lote a lote: nesse dia o
  // resíduo volta e a guarda não vira alarme falso. O que OS TESTES cobram é o
  // outro lado, que é o que protege o Marco: uma divergência de R$ 5,94 (0,01%
  // de ajuste no ticket) já cala a coluna, então trocar a tolerância por R$ 10,
  // R$ 100 ou R$ 1.000 fica vermelho.
  const somaExibidaRealista = somaCentavos(
    linhasBilheteria.filter((r) => r.imprimeReceita).map((r) => num(r.porLote?.receita))
  )
  const receitaPorLoteFechaComDRE =
    Math.abs(somaExibidaRealista - num(c.realista.bruta)) <= 0.005

  // O PDF descartava a frase quando a festa já tinha acontecido — o relatório
  // impresso de uma festa passada ficava idêntico ao de uma futura. A leitura
  // (frase + prefixo "N vendidos até hoje") mora agora em resumo.js, a MESMA
  // do WhatsApp, e é testada lá.
  // O 4º argumento é o aviso de "não fecha nem vendendo tudo" (Marco,
  // 27/07/2026): sem ele o relatório de uma festa que não sai do prejuízo saía
  // SEM a linha "Ritmo de vendas" — igual ao de uma festa saudável, e é este o
  // papel que vai impresso para a reunião.
  const ritmoTxt = linhaRitmoRelatorio(
    evento,
    c.realista.breakEven,
    hojeISO(),
    c.realista.breakEvenNaoFecha,
    c
  )

  // Mesma conta da barra e do resumo — fonte ÚNICA contaOrcamentoFechado
  // (statusCusto.js). O código antigo cravava aqui ['PAGO','FECHADO',
  // 'NEGOCIANDO','ORÇAR'] no denominador (subcontava os status novos) e só
  // PAGO+FECHADO no numerador — no PDF isso virava "100%" onde eram "43%"
  // (Marco, 22/07/2026: denominador cheio, e PARCIAL conta).
  const { fechado: orcFechado, total: orcTotal, pct: orcPct } = contaOrcamentoFechado(
    custosPorStatus(evento.categorias)
  )

  return (
    // data-theme="light": o relatório sai SEMPRE claro (papel), mesmo com o app
    // no tema escuro — é o que vai por PDF/WhatsApp e ao contador (tema G).
    <div data-theme="light" className="min-h-screen bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-4 py-2">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1.5">
          <Btn variant="ghost" onClick={onBack}>
            <AppIcon icon={ArrowLeft} /> Voltar
          </Btn>
          <span className="text-sm text-stone-500">Relatório</span>
          <Segmented
            value={nivel}
            onChange={setNivel}
            options={[
              ['resumido', 'Resumido'],
              ['completo', 'Completo'],
            ]}
          />
          <Btn variant="primary" className="ml-auto" onClick={salvarPdf}>
            <AppIcon icon={Printer} /> Salvar PDF
          </Btn>
          <p className="w-full text-[11px] text-stone-400">
            {completo
              ? 'Completo: tudo — DRE por cenário, lotes, custos detalhados e comparações com eventos passados.'
              : 'Resumido: 1 página — veredito, cenários e números-chave; tipografia de celular, é o que vai no WhatsApp.'}{' '}
            A escolha fica lembrada para a próxima exportação.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6 border-b-2 border-[#0045dd] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
                Plano financeiro
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{evento.nome}</h1>
              <p className="mt-1 text-sm text-stone-600">
                {[fmtData(evento.data), evento.local, publicoPrev ? `${fmtInt(publicoPrev)} pessoas` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {/* Assinatura POR FESTA no cabeçalho (tema C): Brisa script ·
                Sobrado wordmark · Marfim/sem tipo ostra · O Galeao bola+nome. */}
            <AssinaturaFesta tipo={evento.tipo} height={32} className="mt-1 shrink-0" />
          </div>
        </header>

        {/* Dado quebrado (Marco, 26/07/2026): com um custo que não cabe numa
            conta de dinheiro, este papel imprime "Custo total R$ 0" e a linha
            "Custos (itens) R$ 0" do DRE — medido. A faixa entra logo abaixo do
            cabeçalho, nos dois níveis (Resumido e Completo), porque este é o
            arquivo que sai por PDF/WhatsApp e vai ao contador: um relatório que
            circula com o custo zerado é pior que um relatório com uma faixa
            vermelha. Cores de PAPEL (variante `papel`), como o resto daqui. */}
        <AvisoCustoQuebrado
          evento={evento}
          efeito="lucro"
          numeroQuebrouAqui={algumCenarioQuebrado || resultadoRealQuebrado}
          {...faixaDaFotoSa(evento, algumCenarioQuebrado || resultadoRealQuebrado)}
          papel
          className="mb-6"
        />
        {/* Receita realizada quebrada (05/10/2026): o resultado real vira "não
            dá para calcular", e esta faixa diz qual campo. */}
        <AvisoReceitaQuebrada evento={evento} papel className="mb-6" />
        <AvisoLoteSemPreco evento={evento} variante="papel" className="mb-6" />

        {/* Festa FECHADA abre o papel com o RESULTADO REAL (decisão do
            Marco, 20/07/2026): a fonte é a FOTO do fechamento — congelada,
            imune a fórmula futura. O plano pré-evento (cenários) continua
            abaixo, nomeado como comparação. Cores fixas de papel, como o
            resto do relatório (peça de impressão, não tela tema-aware). */}
        {evento.status === 'fechado' &&
          evento.fechamento?.foto?.resultado &&
          (() => {
            const f = evento.fechamento.foto.resultado
            return (
              <section className="mb-6 break-inside-avoid">
                <div className="rounded-lg border border-stone-300 bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Resultado real do evento · fechado em{' '}
                    {fmtData(dataLocalDoInstante(evento.fechamento.em))}
                  </div>
                  {resultadoRealQuebrado ? (
                    // Sem cor de resultado: verde aqui era `null >= 0`.
                    <div className="mt-1 text-xl font-semibold text-stone-700">{NUMERO_NAO_CALCULA}</div>
                  ) : (
                    <div
                      className={`tnum mt-1 text-2xl font-semibold ${
                        f.resultado >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {fmtBRL(resultadoQueFecha({ receita: f.receita, imposto: f.imposto?.valor, custos: f.custos }))}
                    </div>
                  )}
                  {/* O IMPOSTO ENTRA NESTA LINHA (Marco, 27/07/2026) porque sem
                      ele ela NÃO FECHA com o número grande logo acima: medido,
                      "Resultado real R$ 8.200" ao lado de "receita R$ 12.500 ·
                      custos R$ 3.000" deixava R$ 1.300 sem explicação — numa
                      peça IMPRESSA, que ninguém pode clicar para investigar. */}
                  <p className="mt-0.5 text-sm text-stone-600">
                    {/* Foto quebrada: cada número da linha passa pela régua. */}
                    Receita real {cabeComoDinheiro(f.receita) && f.receita != null ? fmtBRL(f.receita) : NUMERO_NAO_CALCULA}
                    {f.imposto ? ` · imposto ${fmtBRL(f.imposto.valor)}` : ''} · custos considerados{' '}
                    {cabeComoDinheiro(f.custos) && f.custos != null ? fmtBRL(f.custos) : NUMERO_NAO_CALCULA}
                    {f.completo ? '' : ' · com pendência declarada (parte ainda entra pelo previsto)'}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    As seções seguintes mostram o plano pré-evento (cenários), mantidas para
                    comparação.
                  </p>
                </div>
              </section>
            )
          })()}

        {/* Veredito — a resposta da reunião abre o papel */}
        <section className="mb-6 break-inside-avoid">
          {/* O semáforo mora na BOLA, não no texto (PADRÃO §3 — Marco,
              19/07, reforçado em 20/07 ao ver o relatório): título e frase
              em tinta normal; só a bola carrega a cor do estado. */}
          <div className="flex items-start gap-3 rounded-lg border border-stone-200 p-4">
            <Bola
              cor={vereditoQuebrado ? '#a8a29e' : corV.bola}
              size={26}
              className="mt-0.5"
              title={vereditoQuebrado ? TITULO_VEREDITO_QUEBRADO : `Semáforo: ${v.cor}`}
            />
            <div>
              <div className={`${completo ? 'text-base' : 'text-lg'} font-semibold text-stone-800`}>
                {vereditoQuebrado ? TITULO_VEREDITO_QUEBRADO : TITULO_VEREDITO[v.cor]}
              </div>
              <p className={`mt-0.5 ${completo ? 'text-sm' : 'text-base'} text-stone-600`}>
                {vereditoQuebrado ? fraseVereditoQuebrado(evento) : fraseVeredito(c, v)}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 break-inside-avoid">
          <H2>Resumo por cenário</H2>
          {/* no celular empilha; no papel (A4 ≥ sm) são 3 colunas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CENARIOS.map((k) => {
              const s = c[k]
              // Lucro é REI (número grande, cor do resultado); as demais viram
              // linhas escaneáveis rótulo→valor.
              //
              // "Break-even (pagos)" e "Ingressos pagos" ficam ADJACENTES: as
              // duas linhas juntas respondem "o cenário se paga?" de bate-olho
              // (break-even 408 × pagos 474 = folga de 66). Ambos saem SEM
              // sufixo e em tnum de propósito, para os dígitos se alinharem um
              // sobre o outro — a folga se lê na régua, sem número novo
              // inventado (componente não faz conta).
              //
              // TICKETS DE VOLTA (decisão do Marco, 19/07/2026). Eles tinham
              // saído daqui pela regra "cada número tem um endereço", com o
              // endereço passando a ser a seção Números-chave. A verificação
              // adversarial mostrou o custo disso: Números-chave é do cenário
              // REALISTA, então os tickets do pessimista e do otimista sumiram
              // do relatório INTEIRO — informação perdida sem aviso, que é o
              // tipo de silêncio que este app não aceita. O Marco decidiu
              // devolvê-los ao card, onde cada cenário tem o seu.
              // A duplicação do ticket realista (card × Números-chave) é
              // CONSCIENTE e aceita por ele: quando a alternativa é um cenário
              // perder dado, completude vence não-duplicação.
              const linhas = [
                // Receita do cenário que não é dinheiro (4ª revisão do PR #98,
                // 05/10/2026): todo número de receita vira texto.
                // Com centavos, como o DRE (Marco, 07/10/2026, P6 refeito):
                // receita − imposto − custo escritos = lucro escrito acima.
                ['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.receitaTotal)],
                // Sem esta linha o card do relatório mostraria receita e custo
                // que não chegam no lucro impresso logo acima deles — a
                // segunda verdade na mesma folha, agora impressa em papel.
                ...(temImposto(s)
                  ? [['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL2(impostoValor(s))}`]]
                  : []),
                ['Custo', fmtBRL2(s.custoTotal)],
                ['Margem', cenQuebrado(s) ? NUMERO_NAO_CALCULA : fmtPct(s.margem)],
                ['Ticket bruto', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.ticketMedio)],
                ['Ticket líquido', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.ticketMedioLiquido)],
                ['Break-even (pagos)', cenQuebrado(s) || recQuebrada(s) ? NUMERO_NAO_CALCULA : textoBreakEven(s, '', evento, c)],
                ['Ingressos pagos', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtInt(s.pagos)],
              ]
              return (
                <div
                  key={k}
                  className="rounded-lg border border-stone-200 p-3"
                  style={{ borderTop: `3px solid ${DOT[k]}` }}
                >
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: DOT[k] }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: DOT[k] }}
                    />
                    {CENARIO_LABEL[k]}
                  </div>
                  {cenQuebrado(s) ? (
                    <div className="mt-1.5 text-base font-semibold leading-none text-stone-700">
                      {NUMERO_NAO_CALCULA}
                    </div>
                  ) : (
                    <div
                      className="tnum mt-1.5 text-2xl font-semibold leading-none"
                      style={{ color: s.lucro >= 0 ? '#00782a' : '#c9000a' }}
                    >
                      {/* com centavos: o mesmo lucro do DRE e a subtração
                          das linhas do card — Marco, 07/10/2026, P6 refeito */}
                      {fmtBRL2(s.lucro)}
                    </div>
                  )}
                  <div className="text-[10px] uppercase tracking-wide text-stone-400">lucro</div>
                  <dl className="mt-2 space-y-1 border-t border-stone-100 pt-2">
                    {linhas.map(([l, val]) => (
                      <div key={l} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <dt className="text-stone-500">{l}</dt>
                        {/* valor semibold + tabular: regra da casa para coluna
                            de valor em tabela financeira (PADRAO, 19/07/2026) */}
                        <dd className="tnum font-semibold text-stone-800">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>
        </section>

        {/* Números-chave — o que a sócia procura primeiro, legível no telefone */}
        <section className="mb-6 break-inside-avoid">
          <H2>Números-chave (cenário realista)</H2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {[
              // RECEITA / por ingresso — o que entra. Patrocínio e Bar viram
              // card só quando > 0 (F2-Y, adendos do Marco): patrocínio FECHADO
              // é receita real; bar mostra o lucro esperado do REALISTA (fixo =
              // igual nos 3; por pessoa, sugestão 42 = varia por cenário e a
              // continha aparece abaixo; open bar/vazio = sem card).
              ['Ticket médio (bruto)', recR ? NUMERO_NAO_CALCULA : fmtBRL2(c.realista.ticketMedio)],
              [TICKET_LIQUIDO_LABEL, recR ? NUMERO_NAO_CALCULA : fmtBRL2(c.realista.ticketMedioLiquido)],
              ...(c.realista.patrocinio > 0 || (recR && !cabeComoDinheiro(c.realista.patrocinio))
                ? [['Patrocínio (fechado)', recR ? NUMERO_NAO_CALCULA : fmtBRL(c.realista.patrocinio)]]
                : []),
              ...(c.realista.bar > 0 || (recR && !cabeComoDinheiro(c.realista.bar))
                ? [['Bar — lucro esperado', recR ? NUMERO_NAO_CALCULA : fmtBRL(c.realista.bar)]]
                : []),
              // CUSTO — o que sai
              [
                'Custo por pessoa',
                recR
                  ? NUMERO_NAO_CALCULA
                  : c.realista.custoPorPessoa == null
                    ? DASH
                    : fmtBRL2(c.realista.custoPorPessoa),
              ],
              [
                'Orçamento fechado ou pago',
                // custo que não cabe (05/10/2026): era "0% (R$ 0 de R$ 100.000…000)"
                !cabeComoDinheiro(orcTotal) || !cabeComoDinheiro(orcFechado)
                  ? NUMERO_NAO_CALCULA
                  : orcTotal > 0
                    ? `${fmtPct(orcPct, 0)} (${fmtBRL(orcFechado)} de ${fmtBRL(orcTotal)})`
                    : DASH,
              ],
              // RESULTADO — o que sobra.
              // Sessão de Coerência das Tabelas (19/07/2026, pedido do Marco):
              // o Break-even saiu daqui. Ele mora nos cards do Resumo por
              // cenário, ao lado dos "Ingressos pagos" do MESMO cenário — que é
              // onde a comparação faz sentido (regra "cada número tem um
              // endereço"). Aqui ele aparecia só no realista e repetia o card.
              [
                'Margem realista',
                cenQuebrado(c.realista) ? NUMERO_NAO_CALCULA : fmtPct(c.realista.margem),
              ],
            ].map(([l, val]) => (
              <div key={l}>
                <div className={`${completo ? 'text-[11px]' : 'text-xs'} text-stone-500`}>{l}</div>
                <div className={`tnum font-semibold text-stone-900 ${completo ? '' : 'text-lg'}`}>
                  {val}
                </div>
              </div>
            ))}
          </div>
          {/* Régua "frase de gente + continha" (item 4, F2-Y): os dois tickets
              explicados com os R$ reais do realista; sem citar bar/patrocínio. */}
          <p className="mt-2 text-[11px] text-stone-400">
            <span className="font-semibold">{TICKET_BRUTO_LABEL}:</span>{' '}
            {microTicketBruto(evento, c.realista)}
          </p>
          <p className="mt-1 text-[11px] text-stone-400">
            <span className="font-semibold">{TICKET_LIQUIDO_LABEL}:</span>{' '}
            {microTicketLiquido(evento, c.realista)}
          </p>
          {isBarPorPessoa(evento) && !isOpenBar(evento) && c.realista.bar !== 0 && (
            <p className="mt-1 text-[11px] text-stone-400">
              <span className="font-semibold">Bar — lucro esperado:</span> consumo por pessoa ×
              público, menos o sistema. Neste evento (realista):{' '}
              {contaBarPorPessoa(evento, c.realista)}
            </p>
          )}
          {ritmoTxt && (
            <p className="mt-2 text-xs text-stone-600">
              <span className="font-semibold">Ritmo de vendas:</span> {ritmoTxt}
            </p>
          )}
          {c.realista.patrocinioPotencial > 0 && (
            <p className="mt-1 text-xs text-stone-600">
              <span className="font-semibold">Patrocínio em proposta (não somado):</span>{' '}
              {fmtOuIlegivel(c.realista.patrocinioPotencial, fmtBRL)} — só entra na receita quando confirmar.
            </p>
          )}
        </section>

        {completo && (
          <section className="mb-6">
            <H2>DRE por cenário</H2>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Linha</Th>
                  {CENARIOS.map((k) => (
                    <Th key={k} right>
                      {CENARIO_LABEL[k]}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Ingressos pagos', (s) => fmtInt(s.pagos)],
                  ['Cortesias', (s) => fmtInt(s.cortesias)],
                  // Rótulo limpo (decisão do Marco, 19/07/2026): o parêntese
                  // com a premissa do cupom saiu daqui — ela segue visível no
                  // microtexto da seção Bilheteria, que explica a coluna
                  // "Efetivo" e a relação com esta linha.
                  ['Receita bruta bilheteria', (s) => fmtBRL2(s.bruta)],
                  // Modo "paga pelo cliente" (F2-Y, adendo do Marco): a taxa
                  // tem efeito ZERO no resultado — a linha some do DRE (era só
                  // ruído num painel de decisão). Só entra quando paga por nós,
                  // aí ela deduz de verdade. O preço final ao cliente segue na
                  // Bilheteria/rodapé (info de preço, não de resultado).
                  ...(isTaxaCliente(evento)
                    ? []
                    : [[`Taxa da bilheteria (${num(evento.taxaBilheteria)}%)`, (s) => `− ${fmtBRL2(s.taxa)}`]]),
                  [`Cashback Tiqueteira (${num(evento.cashbackPct)}%)`, (s) => `+ ${fmtBRL2(s.cashback)}`],
                  ['Receita líquida bilheteria', (s) => fmtBRL2(s.liquida)],
                  [
                    isOpenBar(evento) ? 'Bar (open bar — sem receita)' : 'Bar (lucro líquido)',
                    (s) => fmtBRL2(s.bar),
                  ],
                  ['Patrocínio (fechado)', (s) => fmtBRL2(s.patrocinio)],
                  ...(c.realista.patrocinioPotencial > 0
                    ? [
                        [
                          'Patrocínio em proposta (potencial — não somado)',
                          // proposta não entra em conta: sem faixa, frase que se explica
                          (s) => (cabeComoDinheiro(s.patrocinioPotencial) ? fmtBRL(s.patrocinioPotencial) : VALOR_ILEGIVEL),
                        ],
                      ]
                    : []),
                  ['Receita total', (s) => fmtBRL2(s.receitaTotal), true],
                  // Imposto (Marco, 27/07/2026): dedução de RECEITA — vem
                  // depois do total e antes dos custos, e o rótulo diz sobre o
                  // que incidiu (alíquota + bases marcadas). Sem imposto
                  // configurado a linha não existe e o relatório é o de sempre.
                  ...(temImposto(c.realista)
                    ? [[impostoLinhaLabel(c.realista.imposto), (s) => `− ${fmtBRL2(impostoValor(s))}`]]
                    : []),
                  ['Custos (itens)', (s) => fmtBRL2(s.custoItens)],
                  [`Contingência (${num(evento.contingenciaPct)}%)`, (s) => fmtBRL2(s.contingencia)],
                  // Sessão de Clareza do DRE (19/07/2026): o ajuste de custos
                  // por cenário agia por cima do (itens + contingência) sem ter
                  // linha — quem somava a coluna não fechava com o "Custo
                  // total". Agora o passo aparece. Ver src/lib/dre.js.
                  [AJUSTE_CUSTO_LABEL, (s) => ajusteCustoTexto(s)],
                  ['Custo total do cenário', (s) => fmtBRL2(s.custoTotal), true],
                  ['Lucro', (s) => (cenQuebrado(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.lucro)), true],
                  ['Margem', (s) => (cenQuebrado(s) ? NUMERO_NAO_CALCULA : fmtPct(s.margem))],
                  ['Break-even (ingressos pagos)', (s) => textoBreakEven(s, '', evento, c)],
                  ['Custo por pessoa', (s) => (s.custoPorPessoa == null ? DASH : fmtBRL2(s.custoPorPessoa))],
                ].map(([label, get, strong]) => (
                  <tr key={label}>
                    <Td strong={strong}>{label}</Td>
                    {CENARIOS.map((k) => (
                      <Td key={k} right strong={strong}>
                        {/* receita do cenário que não é dinheiro: as linhas
                            de receita (e o break-even e o custo por pessoa,
                            que dependem do público) viram texto */}
                        {((label === 'Break-even (ingressos pagos)' && cenQuebrado(c[k])) || (dreDependeDaReceita(label) && recQuebrada(c[k]))) ? NUMERO_NAO_CALCULA : get(c[k])}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {completo && (
          <section className="mb-6">
            <H2>Bilheteria</H2>
            {/* A COLUNA SÓ FALA QUANDO PODE PROVAR O QUE DIZ (26/07/2026).
                A coluna "Receita (Realista)" promete, no microtexto logo
                abaixo, que a soma dela é a mesma "Receita bruta bilheteria" do
                DRE. Existe um modo em que essa promessa é FALSA e o número sai
                errado: quando o cenário usa ticket médio manual (ou o ajuste
                de %), computeCenario troca a `bruta` por `pagos × ticket` e
                NÃO recalcula o `porLote` — a invariante `bruta = Σ porLote`,
                declarada em calc.js, deixa de valer nesse modo.

                Medido em 26/07/2026, num evento com ticket manual: a coluna
                somava R$ 36.000 enquanto o DRE, duas seções acima no MESMO
                relatório, mostrava R$ 50.000. R$ 14.000 de diferença — MAIOR
                que os R$ 6.600 que esta coluna veio fechar.

                A conferência abaixo não pergunta "está no modo manual?": ela
                compara a soma com o total e só deixa a coluna falar quando os
                dois batem. Assim qualquer outro caminho que venha a quebrar a
                invariante no futuro cai na mesma rede, sem precisar ser
                previsto aqui. Quando não batem, a coluna diz travessão e o
                microtexto explica o motivo — em vez de imprimir um número que
                a própria tela contradiz. */}
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Lote</Th>
                  <Th right>Valor unit.</Th>
                  {cupom !== 0 && <Th right>Efetivo</Th>}
                  <Th right>Qtd</Th>
                  {/* A coluna de receita por lote SOME quando ela apagaria inteira
                      (Marco, 27/07/2026). Antes ficava com travessão em toda linha e um
                      parágrafo embaixo explicando — e ele leu isso como conta errada, no
                      relatório que mostra para sócia. Coluna vazia em papel impresso não
                      comunica "não se aplica"; comunica "quebrou". */}
                  {receitaPorLoteFechaComDRE && <Th right>Receita (Realista)</Th>}
                  {/* No lugar dela, quando há cupom, entra a capacidade JÁ COM O
                      DESCONTO: senão a única coluna de dinheiro por lote que sobraria
                      seria o preço CHEIO, e o relatório passaria a ignorar o cupom
                      (pedido literal do Marco no mesmo dia). */}
                  {!receitaPorLoteFechaComDRE && cupom !== 0 && (
                    <Th right>Com desconto × capacidade</Th>
                  )}
                  <Th right>Preço cheio × capacidade</Th>
                </tr>
              </thead>
              <tbody>
                {linhasBilheteria
                  .map(({ lote: l, porLote: porLoteRealista, imprimeReceita }) => {
                    // Decisão do Marco (26/07/2026), com o número medido na
                    // mesa: no MESMO relatório a tabela somava R$ 66.000 e o
                    // DRE mostrava R$ 59.400 (evento "Brisa #3 — teste
                    // F2-W", 19/07/2026) — a tabela usava o preço CHEIO do
                    // lote, o DRE aplicava o % de venda do cenário. A partir
                    // de agora "Receita" traz o valor do CENÁRIO REALISTA —
                    // MESMA fonte que o DRE (porLote de computeCenarios em
                    // calc.js; nada é recalculado aqui) — e o preço cheio
                    // (o potencial do lote, útil para decidir preço) ganhou
                    // coluna própria, para não desaparecer.
                    //
                    // Quem imprime número e quem imprime travessão já foi
                    // decidido em `linhasBilheteria`, acima — a MESMA lista que
                    // a conferência soma. Decidir de novo aqui era o defeito.
                    return (
                      <tr key={l.id}>
                        {/* MARCA DO LOTE ZERADO À MÃO (Marco, 26/07/2026).
                            Um lote comum com override de cenário em 0 imprimia
                            "R$ 0" na Receita — indistinguível do "R$ 0" de um
                            lote de CORTESIA, que é outra coisa: cortesia é
                            ingresso de graça que entra no público, lote zerado
                            é uma decisão de não vender aquele lote neste
                            cenário. A marca vai no nome, junto das outras duas
                            que a coluna já carrega, em vez de virar uma sétima
                            coluna. */}
                        <Td>
                          {l.nome}
                          {isCortesia(l) ? ' (cortesia)' : ''}
                          {isPrecoAusente(l) ? ` (${ROTULO_LOTE_SEM_PRECO})` : ''}
                          {l.somenteOtimista ? ' — só otimista' : ''}
                          {zeradoNoRealista(l) ? ' — zerado no Realista' : ''}
                        </Td>
                        <Td right>{isPrecoAusente(l) ? PRECO_AUSENTE_TEXTO : cabeComoDinheiro(l.valor) ? fmtBRL2(l.valor) : NUMERO_NAO_CALCULA}</Td>
                        {/* Preço efetivo pós-desconto (realista) — igual à coluna
                            "Efetivo" da tela de edição; cortesia não desconta. */}
                        {cupom !== 0 && (
                          <Td right>{isCortesia(l) || isPrecoAusente(l) ? DASH : fmtBRL2(precoEfetivoLote(l.valor, efetivoR))}</Td>
                        )}
                        <Td right>{cabeComoDinheiro(l.quantidade) ? fmtInt(l.quantidade) : NUMERO_NAO_CALCULA}</Td>
                        {/* Travessão quando o lote NÃO VENDE neste cenário
                            (`qtd` 0) — o caso normal do "só otimista" —, e
                            "R$ 0,00" quando ele vende zero de propósito (lote
                            zerado à mão, que leva a marca no nome). A regra é a
                            quantidade do cenário, não a marca do lote: um "só
                            otimista" com override no Realista VENDE, e esconder
                            a receita dele era o S1 de R$ 10.000. */}
                        {receitaPorLoteFechaComDRE && (
                          <Td right>
                            {!imprimeReceita
                              ? DASH
                              : recR || !cabeComoDinheiro(porLoteRealista?.receita)
                                ? NUMERO_NAO_CALCULA
                                : fmtBRL2(num(porLoteRealista?.receita))}
                          </Td>
                        )}
                        {!receitaPorLoteFechaComDRE && cupom !== 0 && (
                          <Td right>
                            {l.somenteOtimista || isCortesia(l) || isPrecoAusente(l)
                              ? DASH
                              : cabeComoDinheiro(precoEfetivoLote(l.valor, efetivoR) * num(l.quantidade))
                                ? fmtBRL2(precoEfetivoLote(l.valor, efetivoR) * num(l.quantidade))
                                : NUMERO_NAO_CALCULA}
                          </Td>
                        )}
                        <Td right>
                          {l.somenteOtimista || isPrecoAusente(l)
                            ? DASH
                            : cabeComoDinheiro(num(l.valor) * num(l.quantidade))
                              ? fmtBRL2(num(l.valor) * num(l.quantidade))
                              : NUMERO_NAO_CALCULA}
                        </Td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            <p className="mt-1.5 text-[10px] text-stone-400">
              {receitaPorLoteFechaComDRE ? (
                <>
                  “Receita (Realista)” é o previsto pelo cenário Realista — já com o % de venda
                  {cupom !== 0 ? ' e o desconto do cupom aplicados' : ' aplicado'} — e é a MESMA
                  conta da “Receita bruta bilheteria” do DRE acima: a soma desta coluna bate com
                  aquela linha. Aqui a coluna vem <strong>com os centavos</strong> (decisão do
                  Marco, 26/07/2026) e a linha do DRE aparece arredondada ao real — por isso a
                  soma daqui pode terminar até R$ 0,49 abaixo ou acima do número impresso lá.
                </>
              ) : (
                <>
                  “Receita (Realista)” está em travessão em todos os lotes:{' '}
                  <strong>este cenário não divide a receita por lote</strong>. O ticket médio do
                  Realista foi definido à mão (ou ajustado por %), e nesse modo a receita de
                  ingressos é <em>público pagante × ticket</em>, não a soma dos lotes — o preço de
                  cada lote deixa de ser o que manda. O número que vale é a “Receita bruta
                  bilheteria” do DRE acima. A coluna fica em branco de propósito: um valor por
                  lote aqui somaria diferente daquela linha, no mesmo relatório.
                </>
              )}{' '}
              “Preço cheio × capacidade” é exatamente isso: o preço de tabela vezes a
              capacidade do lote, sem desconto — útil para decidir preço, não é o número que
              entra no resultado. <strong>Não é o cenário Otimista</strong>: o rótulo antigo
              dizia “(100%)” e convidava a essa leitura, mas os dois somam coisas diferentes —
              um lote “só otimista” entra inteiro no Otimista e fica de fora desta coluna.
              {cupom !== 0 && (
                <>
                  {' '}
                  “Valor unit.” é o preço de tabela; “Efetivo” é o preço médio pós-desconto no
                  cenário realista ({premissaDesconto(evento)} — desconto efetivo{' '}
                  {fmtPct(efetivoR, 2)}).
                </>
              )}
            </p>
          </section>
        )}

        {completo && (
          <section className="mb-6">
            <H2>Custos por categoria</H2>
            {evento.categorias
              .filter((cat) => (cat.itens || []).length > 0)
              .map((cat) => {
                const itens = cat.itens || []
                // Mesma fonte única das abas Custos e Fechamento
                // (confrontoCustos.js). O par que ficava aqui era
                // "estimado de TODOS os itens · realizado de quem já tem" —
                // incomparável, e a terceira tela a repetir o defeito do S1 de
                // 20/07/2026. Agora o relatório fala a mesma língua: orçamento
                // de um lado, e o confronto honesto (realizado × estimado
                // DESSES itens) do outro.
                const cf = confrontoDeItens(itens)
                return (
                  <div key={cat.id} className="mb-4 break-inside-avoid">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xs font-bold uppercase">{cat.nome}</h3>
                      <span className="text-[11px] text-stone-500 tnum">
                        orçamento {fmtBRL(cf.estimadoTodos)}
                        {cf.algum && (
                          <>
                            {' · '}realizado {fmtBRL(cf.realizado)} em {cf.nComRealizado} de{' '}
                            {cf.nItens} {cf.nItens === 1 ? 'item' : 'itens'} (estimado desses{' '}
                            {fmtBRL(cf.estimadoDosMesmos)} ·{' '}
                            <span className={sinalDelta(cf.delta) === 'estouro' ? 'font-bold' : ''}>
                              {textoDelta(cf.delta, fmtBRL)}
                            </span>
                            )
                          </>
                        )}
                      </span>
                    </div>
                    {/* Grade ÚNICA (table-fixed + colgroup igual em TODA categoria):
                        colunas não dançam entre categorias. Serviço protegido;
                        Fornecedor trunca; reflui no celular (classe tabela-reflui). */}
                    <table className="tabela-relatorio tabela-reflui mt-1 text-xs">
                      <colgroup>
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <Th>Serviço</Th>
                          <Th>Fornecedor</Th>
                          <Th right>Estimado</Th>
                          <Th right>Realizado</Th>
                          {/* Status à direita para a última coluna encostar na
                              mesma borda da Receita da Bilheteria (Marco,
                              19/07/2026) — as tabelas do relatório compartilham
                              a borda direita em vez de ficarem tortas entre as
                              seções. Só alinhamento: nenhum valor muda. */}
                          <Th right>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((i) => (
                          <tr key={i.id}>
                            <Td nome>{i.servico || DASH}</Td>
                            <Td trunca rotulo="Fornecedor">{i.fornecedor || DASH}</Td>
                            <Td right rotulo="Estimado">{fmtBRL2(i.estimado)}</Td>
                            <Td right rotulo="Realizado">
                              {num(i.realizado) ? fmtBRL2(i.realizado) : DASH}
                            </Td>
                            <Td right rotulo="Status">{i.status}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            {/* CONTINGÊNCIA — LINHA PRÓPRIA, FORA DE QUALQUER CATEGORIA
                (verificação adversarial de 19/07/2026: três achados S2 de uma
                vez, todos resolvidos por tirá-la de dentro da seção "Extras &
                Contingência").

                (a) ELA VIRAVA "TOTAL DA SEÇÃO". Como última linha numérica da
                    tabela de Extras, com régua acima e valor em negrito, ela
                    reproduzia exatamente a assinatura visual de LINHA DE TOTAL
                    da casa. As três defesas de antes (régua, estilo distinto,
                    microtexto "não entra no estimado desta seção") eram
                    TEXTUAIS; em tela estreita (≤640px, o PDF que vai para o
                    WhatsApp) a tabela reflui, o microtexto se afasta do número e
                    sobra o layout — que afirmava o contrário do texto. Um número
                    que o leitor soma achando que é subtotal é número errado
                    mostrado como certo.
                (b) EVENTO SEM EXTRAS PERDIA A LINHA. A condição era
                    `cat.id === 'extras'` DENTRO do map das categorias com item:
                    quem não lançou nada em Extras não via a contingência em
                    lugar nenhum desta seção. A reserva existe em todo evento que
                    tem custo — não pode depender de uma categoria ter item.
                (c) O VALOR MORAVA NA COLUNA "ESTIMADO", MAS A BASE É O
                    CONSIDERADO. calc.js calcula a reserva sobre
                    `custos.totalConsiderado` — que usa o REALIZADO quando
                    preenchido, e só cai no estimado quando não há. Exibi-la sob
                    "Estimado" era rotular a base errada, e as duas divergem no
                    instante em que o Marco lança o primeiro realizado.

                O CONSERTO: a contingência é conceitualmente uma reserva sobre
                TODOS os custos do evento, não item de uma categoria — então ela
                ganha o lugar que já era o dela, um bloco próprio depois de todas
                as categorias. Fora da tabela, ela não tem coluna "Estimado" para
                rotular errado nem coluna "Status" embaixo da qual cair o
                dinheiro, e não pode ser lida como subtotal de coisa nenhuma. O
                rótulo diz as duas coisas que faltavam: que é sobre TODOS os
                custos e qual é a BASE.

                Por que aqui e não "logo antes do total geral dos custos": esta
                seção não TEM total geral — o custo total do evento mora no DRE,
                algumas seções acima. Criar um total aqui só para dar âncora à
                reserva duplicaria o número do DRE e quebraria a regra "cada
                número tem um endereço"; o bloco próprio resolve os três achados
                sem inventar linha nova.

                Em tela estreita o bloco empilha (flex-wrap) e o valor continua à
                direita — testado ao vivo a 375px. */}
            {c.realista.contingencia > 0 && (
              <div className="mt-5 break-inside-avoid rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-xs font-bold uppercase">
                    Contingência ({num(evento.contingenciaPct)}%)
                  </h3>
                  <span className="tnum ml-auto text-sm font-semibold text-stone-900">
                    {fmtBRL(c.realista.contingencia)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-stone-500">
                  Reserva sobre <span className="font-semibold">todos</span> os custos do evento —
                  não pertence a nenhuma categoria acima e não entra em nenhum subtotal desta
                  seção. Base de cálculo: o custo considerado do cenário realista (o valor
                  realizado de cada item quando preenchido; senão, o estimado).
                </p>
              </div>
            )}
          </section>
        )}

        {completo && bms.length > 0 && (
          <section className="comparacao-relatorio mb-6">
            <H2>Comparação com eventos passados</H2>
            {/* O CONTÁGIO no PAPEL (26/07/2026). Esta seção é a que sai por PDF
                ao contador, e ela desenha as mesmas barras da aba Cenários:
                com uma referência quebrada ligada, a linha dela imprime R$ 0 no
                total e 367 caracteres de número na categoria, e a barra da
                festa do relatório encolhe para um risco. Um papel que circula
                com isso e sem faixa é pior que um papel com faixa vermelha —
                a mesma razão da faixa da festa, algumas seções acima. */}
            <AvisoBenchmarkQuebrado benchmarks={bms} papel className="mb-4" />
            {/* O "R$" VOLTOU ÀS CÉLULAS (Marco, 19/07/2026). Ele tinha saído
                por falta de espaço no layout antigo, de ~10 colunas, onde 40
                células com prefixo empurravam a "Custo total" para fora. Com a
                tabela VIRADA (categorias nas linhas, poucas colunas de evento)
                sobra largura, e a unidade em cada célula é o padrão: quem lê na
                reunião não precisa subir até a legenda para saber que aquilo é
                dinheiro. A legenda guarda só o que a célula NÃO diz — que os
                valores estão arredondados ao real, e que o número sob o nome da
                coluna é público, não R$. */}
            <p className="mb-1.5 text-[11px] text-stone-500">
              Valores arredondados ao real (sem centavos) · o público de cada evento vai sob o
              nome da coluna, em pessoas.
            </p>
            {/* MATRIZ VIRADA — categorias nas LINHAS, eventos nas COLUNAS
                (Sessão de Coerência das Tabelas, 19/07/2026, pedido do Marco).
                Antes: eventos nas linhas e ~10 colunas, cada uma com a largura
                ditada por um cabeçalho longo ("Estrutura & Ceno", "Extras &
                Conting.") — buracos desiguais entre os números e a "Custo total"
                parecendo só mais uma coluna. Virando:
                • os rótulos longos descem para a coluna de TEXTO à esquerda,
                  que é onde texto se lê naturalmente;
                • sobram poucas colunas numéricas de largura IDÊNTICA (colgroup
                  calculado), então os números se comparam por casa decimal;
                • o cabeçalho de coluna numérica é alinhado à DIREITA, igual ao
                  dado — sem o "visual wobble" de cabeçalho à esquerda sobre
                  número à direita (NN/g, Pencil&Paper);
                • "Custo total" vira LINHA DE TOTAL no rodapé, com régua acima e
                  negrito: a conclusão que ele é, não mais uma coluna;
                • e passa a falar a MESMA língua do DRE logo acima no mesmo
                  relatório (itens descem, cenários/eventos atravessam).
                O público sai do corpo e vira legenda do cabeçalho de propósito:
                em pessoas, ele não soma na coluna — e a regra da casa é que toda
                coluna soma na frente de quem lê. No corpo só há R$.
                Só réguas horizontais; nada de grade vertical. */}
            {faixasMatriz.map((referencias, indiceFaixa) => {
              const colsEvento = 1 + referencias.length
              const inicio = indiceFaixa * REFERENCIAS_POR_FAIXA + 1
              return (
                <div key={inicio} className="faixa-matriz-relatorio">
                  <div className="rolagem-matriz-relatorio">
                    <table
                      className="matriz-relatorio w-full table-fixed"
                      style={{ '--largura-minima-matriz': `${140 + colsEvento * 102}px` }}
                    >
                      <colgroup>
                        <col style={{ width: 140 }} />
                        {Array.from({ length: colsEvento }, (_, i) => <col key={i} />)}
                      </colgroup>
                      <thead>
                        <tr>
                          <th colSpan={2 + referencias.length} className="pb-1.5 text-left text-[10px] font-semibold text-stone-600">
                            Referências {inicio}–{inicio + referencias.length - 1} de {bms.length}
                          </th>
                        </tr>
                        <tr>
                          <Th scope="col" compacto>Categoria</Th>
                          {/* coluna da PREVISÃO destacada: é o sujeito da
                              comparação. O destaque é tipográfico (azul da marca +
                              semibold) porque texto é o sinal mais robusto; o
                              fundo levíssimo das células reforça e SAI no PDF —
                              o print CSS do app força `print-color-adjust: exact`
                              em tudo (item 2 do QA de PDF do Marco, F2-Y). */}
                          <Th scope="col" compacto right style={{ color: '#0045dd' }}>
                            <span className="block">{evento.nome} (previsão)</span>
                            <span className="block text-[9px] font-normal text-stone-500">
                              {publicoPrev ? `${fmtInt(publicoPrev)} pessoas` : DASH}
                            </span>
                          </Th>
                          {referencias.map((b) => (
                            <Th key={b.id} scope="col" compacto right>
                              <span className="block">{b.nome}</span>
                              <span className="block text-[9px] font-normal text-stone-500">
                                {/* Público ilegível (S1, 07/10/2026): escrevia
                                    "0 pessoas". Zero e ausência seguem "—". */}
                                {publicoIlegivel(b)
                                  ? PUBLICO_ILEGIVEL
                                  : publicoDaReferencia(b).estado === ESTADO_PUBLICO.VALIDO
                                    ? `${fmtInt(b.publico)} pessoas`
                                    : DASH}
                                {/* Etiqueta "sem reserva" (decisão 3 do Marco):
                                    a coluna do promovido não carrega reserva de
                                    contingência e as dos históricos carregam,
                                    dentro de "Extras & Conting.". Sem isto a
                                    tabela impressa compara duas réguas como se
                                    fossem uma. O motivo vai na nota de rodapé. */}
                                {temSemReserva(b) && (
                                  <span className="block italic">{ETIQUETA_SEM_RESERVA}</span>
                                )}
                              </span>
                            </Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {colunaPrevisao.categorias.map(({ id: k, exibido }) => (
                          <tr key={k}>
                            <Td compacto>{CAT_LABELS[k]}</Td>
                            <Td compacto right strong className="bg-[#f4f7ff]">
                              {exibido ? fmtBRL(exibido) : DASH}
                            </Td>
                            {referencias.map((b) => (
                              <Td key={b.id} compacto right>
                                {b.custos?.[k] != null ? fmtBRL(b.custos[k]) : DASH}
                              </Td>
                            ))}
                          </tr>
                        ))}
                        {/* Categoria criada pelo Marco (fora das 7 do histórico):
                            entra por diferença para a coluna fechar. Travessão
                            nos passados — o benchmark só tem as 7 chaves. */}
                        {colunaPrevisao.outras.mostrar && (
                          <tr>
                            <Td compacto>Outras categorias</Td>
                            <Td compacto right strong className="bg-[#f4f7ff]">
                              {fmtBRL(colunaPrevisao.outras.exibido)}
                            </Td>
                            {referencias.map((b) => (
                              <Td key={b.id} compacto right className="text-stone-400">
                                {DASH}
                              </Td>
                            ))}
                          </tr>
                        )}
                        {/* OS PASSOS QUE FALTAVAM PARA A COLUNA FECHAR.
                            Achado desta sessão, ao virar a tabela: com o "Custo
                            total" virando LINHA DE TOTAL no pé da coluna, o leitor
                            passa a somar a coluna — e a da PREVISÃO não fechava.
                            As 7 categorias somam os "Custos (itens)" (aqui:
                            88.500), mas o custo total do cenário (92.925) ainda
                            leva a contingência e o ajuste do cenário por cima.
                            No layout antigo (eventos nas linhas) o total era só
                            mais uma coluna e ninguém somava; agora ele é uma
                            conclusão, e conclusão tem que fechar.
                            É a regra da casa "toda coluna de DRE soma na frente de
                            quem lê" (PADRAO, 19/07/2026) aplicada aqui: se existe
                            um passo na conta, ele tem LINHA. Mesmos valores que o
                            DRE já mostra — nenhum número novo, nada calculado no
                            componente (contingência vem de computeCenarios; o
                            ajuste vem de ajusteCustoValor, por diferença; o
                            arredondamento que faz a coluna fechar ao real vem de
                            comparacaoCustos.js).
                            Nos eventos PASSADOS estas linhas são travessão: a
                            reserva deles já está embutida nas categorias (o
                            rótulo "Extras & Conting." diz isso) e não há cenário
                            para ajustar — por isso as colunas deles fecham direto
                            nas categorias. A nota abaixo da tabela explica. */}
                        <tr className="border-t border-stone-200">
                          <Td compacto className="pt-1.5 text-stone-600">
                            Contingência ({num(evento.contingenciaPct)}%)
                          </Td>
                          <Td compacto right strong className="bg-[#f4f7ff] pt-1.5">
                            {fmtBRL(colunaPrevisao.contingencia.exibido)}
                          </Td>
                          {referencias.map((b) => (
                            <Td key={b.id} compacto right className="pt-1.5 text-stone-400">
                              {DASH}
                            </Td>
                          ))}
                        </tr>
                        {colunaPrevisao.ajuste.mostrar && (
                          <tr>
                            <Td compacto className="text-stone-600">
                              {AJUSTE_CUSTO_LABEL}
                            </Td>
                            <Td compacto right strong className="bg-[#f4f7ff]">
                              {colunaPrevisao.ajuste.exibido > 0 ? '+ ' : '− '}
                              {fmtBRL(Math.abs(colunaPrevisao.ajuste.exibido))}
                            </Td>
                            {referencias.map((b) => (
                              <Td key={b.id} compacto right className="text-stone-400">
                                {DASH}
                              </Td>
                            ))}
                          </tr>
                        )}
                        {/* LINHA DE TOTAL — régua acima e peso MAIOR que o das
                            células de valor acima (font-bold contra o semibold do
                            corpo): a regra da casa pede que o total se distinga
                            por peso E por borda, não só pela cor (PADRAO,
                            19/07/2026). Fica como último <tr> do tbody (e não em
                            <tfoot>) de propósito: tfoot é `table-footer-group` e
                            REPETIRIA o total em toda página se a tabela quebrasse
                            na impressão. */}
                        <tr className="border-t-2 border-stone-400">
                          <Td compacto className="pt-1.5 font-bold">
                            Custo total
                          </Td>
                          <Td compacto right className="bg-[#f4f7ff] pt-1.5 font-bold">
                            {fmtBRL(colunaPrevisao.total)}
                          </Td>
                          {referencias.map((b) => (
                            <Td key={b.id} compacto right className="pt-1.5 font-bold">
                              {fmtBRL(b.custoTotal)}
                            </Td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            {/* Duas coisas que o leitor precisa saber ao SOMAR a coluna — agora
                que o "Custo total" é linha de total e convida a soma:
                (a) por que reserva/ajuste são travessão nos eventos passados;
                (b) que o total DELES é o valor registrado à época, que nem
                    sempre bate ao real com a soma das categorias.
                Sobre (b): 3 dos 4 benchmarks embutidos têm custoTotal 1 real
                distante da soma das suas categorias (arredondamento de quando o
                Marco registrou o histórico). NÃO é bug desta tela e NÃO se
                conserta aqui: benchmark é dado do dono (princípio 3 — imutável
                contra mudança automática). Registrado no BACKLOG para decisão
                do Marco; enquanto isso a tela conta a verdade em vez de
                prometer uma soma que não fecha. */}
            <p className="mt-1.5 text-[10px] text-stone-400">
              {colunaPrevisao.outras.mostrar && (
                <>
                  “Outras categorias” reúne o que foi criado fora das sete categorias que os
                  eventos passados registram — por isso não há com o que comparar.{' '}
                </>
              )}
              Contingência e ajuste do cenário só existem na previsão — nos eventos passados a
              reserva já está dentro das categorias (por isso o travessão), e não há cenário a
              ajustar. O custo total de um evento passado é o valor registrado à época: quando o
              histórico veio arredondado, ele pode não bater exatamente com a soma das categorias.
            </p>
            {/* Barras horizontais do custo total junto da tabela (tema C):
                previsão em destaque × eventos passados, no padrão editorial —
                rótulos calibrados (tema D). Testado no PDF de celular. */}
            <div className="mt-4 break-inside-avoid">
              <p className="mb-1.5 text-[11px] font-medium text-stone-500">
                Custo total — previsão × eventos passados
              </p>
              <HBars
                rows={[
                  {
                    label: `${evento.nome} (previsão)`,
                    value: c.realista.custoTotal,
                    highlight: true,
                  },
                  ...bms.map((b) => ({
                    label: temSemReserva(b) ? `${b.nome} · ${ETIQUETA_SEM_RESERVA}` : b.nome,
                    value: b.custoTotal,
                  })),
                ]}
              />
            </div>
            {bms.some(temSemReserva) && (
              <p className="mt-1.5 text-[10px] text-stone-400">
                * {ETIQUETA_SEM_RESERVA}: {EXPLICACAO_SEM_RESERVA}
              </p>
            )}
            {bms
              .filter((b) => b.obs)
              .map((b) => (
                <p key={b.id} className="mt-1.5 text-[10px] text-stone-400">
                  * {b.nome}: {b.obs}
                </p>
              ))}
          </section>
        )}

        {/* Como ler este relatório — legendas em português de gente (tema C):
            só no Completo (o Resumido fica limpo). Critério: a sócia entende
            sem perguntar. O mesmo glossário serve à apresentação (toggle lá). */}
        {completo && (
          <section className="mb-6 break-inside-avoid">
            <H2>Como ler este relatório</H2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              {/* receita quebrada: o glossário cai nas frases genéricas, sem
                  "continha" com número que não é dinheiro */}
              {legendasRelatorio(evento, recR || cenQuebrado(c.realista) ? null : c.realista, c).map(([termo, def]) => (
                <div key={termo}>
                  <dt className="font-semibold text-stone-700">{termo}</dt>
                  <dd className="text-stone-500">{def}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <footer className="border-t border-stone-200 pt-3 text-[10px] text-stone-400">
          Cenários: pessimista = {num(evento.cenariosConfig?.pessimista?.vendaPct ?? 80)}% dos
          lotes e custos {num(evento.cenariosConfig?.pessimista?.custoPct ?? 10) >= 0 ? '+' : ''}
          {num(evento.cenariosConfig?.pessimista?.custoPct ?? 10)}% · realista ={' '}
          {num(evento.cenariosConfig?.realista?.vendaPct ?? 90)}% dos lotes · otimista = lotes esgotados
          (incl. porta) e custos {num(evento.cenariosConfig?.otimista?.custoPct ?? -5)}%. Custos
          usam o valor realizado quando preenchido; caso contrário, o estimado. Contingência de{' '}
          {num(evento.contingenciaPct)}% sobre os custos.{' '}
          {isTaxaCliente(evento) ? (
            <>
              Taxa de bilheteria de {num(evento.taxaBilheteria)}% <strong>paga pelo
              cliente</strong> — não descontada da receita (preço final ao cliente =
              pós-desconto × (1 + taxa)) — e cashback Tiqueteira de {num(evento.cashbackPct)}%
              recebido sobre a receita de ingressos (inalterado).
            </>
          ) : (
            <>
              Taxa de bilheteria de {num(evento.taxaBilheteria)}% descontada e cashback Tiqueteira
              de {num(evento.cashbackPct)}% recebido sobre a receita de ingressos.
            </>
          )}
          {num(evento.descontoMedioPct) !== 0 && (
            <>
              {' '}
              Desconto nos ingressos: {premissaDesconto(evento)} — desconto efetivo = cupom ×
              fração de ingressos com desconto; receita = lotes × preço × (1 − efetivo), com
              cenários, taxa e cashback por cima
              {evento.descontoIngressosModo === 'numero' &&
                evento.descontoIngressosValor !== '' &&
                evento.descontoIngressosValor != null && (
                  <> (no modo nº, a fração é recalculada por cenário)</>
                )}
              . Valores realizados não usam o desconto — a Tiqueteira já os manda líquidos de cupom.
            </>
          )}
          {isOpenBar(evento) && (
            <>
              {' '}
              Evento open bar: sem receita de bar — a linha de Bar vale R$ 0 nos três cenários;
              os custos de bar seguem lançados normalmente nos custos.
            </>
          )}
          {premissaBar(evento) && (
            <>
              {' '}
              Bar: {premissaBar(evento)} — o bar de cada cenário = consumo × público do cenário
              (pagos + cortesias) − sistema.
            </>
          )}
          {temImposto(c.realista) && (
            <>
              {' '}
              Imposto sobre a receita: {impostoTexto(c.realista.imposto)}. A base da bilheteria é
              a BRUTA — antes da comissão da Tiqueteira e antes do cashback. O imposto é deduzido
              da receita (não é custo), e por isso NÃO entra na base da contingência.
            </>
          )}
          {premissasCurva(evento).length > 0 && (
            <>
              {' '}
              Curva de vendas: {premissasCurva(evento).join(' · ')} — só a curva e a aba
              Análise usam; nenhum cenário muda por isso.
            </>
          )}
          {c.realista.patrocinio + c.realista.patrocinioPotencial > 0 && (
            <>
              {' '}
              Patrocínio: só o fechado (confirmado ou recebido) soma na receita
              {c.realista.patrocinioPotencial > 0 && (
                <>
                  ; {fmtOuIlegivel(c.realista.patrocinioPotencial, fmtBRL)} em proposta fica fora da conta, como
                  potencial
                </>
              )}
              .
            </>
          )}
          {!completo && (
            <>
              {' '}
              Este é o nível Resumido — o Completo (DRE por cenário, lotes, custos detalhados e
              comparações) sai pelo mesmo botão Relatório / PDF.
            </>
          )}
          {/* Assinatura POR FESTA no rodapé (tema C, F2-P): a marca da festa
              assina a peça; a linha da casa vem em texto ao lado. */}
          <span className="mt-3 flex items-center gap-2.5 text-stone-500">
            <AssinaturaFesta tipo={evento.tipo} height={20} className="shrink-0" />
            <span>
              Gerado em {new Date().toLocaleDateString('pt-BR')} pelo Planejamento de Eventos ·
              Marfim Alto · Brisa · Sobrado · O Galeao.
            </span>
          </span>
        </footer>
      </div>
    </div>
  )
}
