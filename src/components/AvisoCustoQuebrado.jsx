// A FAIXA QUE DIZ, NA TELA, QUE A FESTA ESTÁ COM DADO QUEBRADO.
//
// Decisão do Marco, 26/07/2026 (questionário): a tela passa a dizer que a festa
// tem dado quebrado, em vez de imprimir R$ 0 calada. A leitura mora em
// `dadoQuebrado.js` (pura, sem React); aqui só existe o texto e a pintura.
//
// ---------------------------------------------------------------------------
// A FAIXA SÓ AFIRMA O QUE FOI VERIFICADO NAQUELA TELA
// ---------------------------------------------------------------------------
// A primeira versão trazia UMA frase de consequência, cravada no componente:
// "no lugar do valor da festa o app escreve R$ 0". Ela era verdade em quatro
// telas e MENTIRA em duas, medido em 26/07/2026:
//
//   • aba Análise — a tela não escreve R$ 0, escreve o número monstruoso por
//     extenso: "saldo -R$ 100.000.000…000 no primeiro dia negativo", 300 e
//     tantos dígitos numa linha de saldo.
//   • aba Fechamento de uma festa FECHADA cuja FOTOGRAFIA é sã (custo quebrado
//     que entrou DEPOIS do fechamento, por backup estragado) — a tela imprime
//     "Custos considerados − R$ 403.000" e "Resultado parcial − R$ 384.000",
//     números CERTOS, vindos da foto. A faixa dizia que ali estava escrito
//     R$ 0, e mandava "voltar a uma cópia de segurança": conselho DANOSO, que
//     trocaria uma fotografia correta por uma versão anterior da festa.
//
// E há um TERCEIRO caso, achado nesta frente e que atinge as quatro telas
// originais: um item com o campo "realizado" preenchido com TEXTO ("a combinar")
// e o estimado em R$ 5.000. `valorConsiderado` ignora o texto e usa o estimado,
// então os totais imprimem "Total estimado R$ 5.000" — CERTO — enquanto a faixa
// afirmava que ali estava escrito R$ 0. A diferença entre "um custo é ilegível"
// e "a conta da festa quebrou" é exatamente o `somaNaoCabe` que a leitura já
// devolvia e que a faixa não olhava.
//
// Por isso a faixa agora MEDE antes de afirmar: a consequência sai de
// `somaNaoCabe` (a conta da festa quebrou ou não), e a tela só declara COMO ela
// mostra um número quebrado — zerado ou gigante — mais os casos em que ela sabe
// algo que a leitura não sabe (a fotografia do fechamento). Cada tela tem um
// teste que confere a frase contra o texto que ela de fato imprime. Uma frase de
// tela que afirma demais circula mais que código errado — ninguém desconfia
// dela.
//
// PINTURA (convenções datadas da casa): vermelho de ALERTA, com o triângulo do
// sistema Lucide — o mesmo par que as linhas recusadas do orçamento do produtor
// já usam. Azul é só ação e verde só aparece em resultado, então nenhum dos dois
// entra aqui. As bolas pintadas do semáforo são identidade e não têm nada a ver
// com esta faixa.
//
// O relatório imprime em PAPEL (`data-theme="light"`, cores fixas stone/red do
// Tailwind, nunca as variáveis do tema) — por isso a variante `papel`.

import { AppIcon, TriangleAlert } from './AppIcon.jsx'
import { FIXED_BENCHMARKS } from '../lib/benchmarks.js'
import {
  custosQuebrados,
  benchmarksQuebrados,
  benchmarkQuebrado,
  publicoIlegivel,
  referenciasComPublicoIlegivel,
  textoPublicoGuardado,
  fotoQuebrada,
  receitaQuebrada,
  NUMERO_NAO_CALCULA,
  TITULO_VEREDITO_QUEBRADO,
  FRASE_VEREDITO_QUEBRADO,
} from '../lib/dadoQuebrado.js'

export const TITULO_CUSTO_QUEBRADO = 'Esta festa tem um custo que o app não consegue calcular'

export const TITULO_BENCHMARK_QUEBRADO =
  'Uma referência desta comparação está com dado quebrado'

/** "O custo “Som e luz” (categoria Estrutura) está com um valor que o app não consegue calcular." */
export const frasePorItem = ({ servico, categoria }) =>
  `O custo “${servico}”${categoria ? ` (categoria ${categoria})` : ''} está com um valor que o app não consegue calcular.`

export const FRASE_SOMA = 'A soma dos custos desta festa não cabe numa conta de dinheiro.'

/**
 * O CARTÃO DA TELA INICIAL (05/10/2026). Medido ao vivo no app: a "Brisa
 * quebrada" saía "Pessimista R$ 0 · Realista R$ 0 · Otimista R$ 0" — e a
 * fechada, "Resultado realizado R$ 0" com desvio "−NaN". O cartão não tem
 * espaço para a faixa inteira; ele troca os números por esta frase, e a faixa
 * completa (qual custo, como consertar) mora dentro da festa.
 */
export const FRASE_CARTAO_QUEBRADO =
  'Custo que o app não consegue calcular — abra a festa para ver qual.'

/** O mesmo cartão, quando quem não cabe é a receita realizada (05/10/2026). */
export const FRASE_CARTAO_RECEITA_QUEBRADA =
  'Receita que o app não consegue calcular — abra a festa para ver qual.'

/** A célula de custo de uma referência quebrada na tabela da tela inicial. */
export const FRASE_CELULA_BENCHMARK_QUEBRADO = 'valor que o app não consegue calcular'

// -------------------------------------------------- o que ESTA tela faz com ele
//
// Cada constante é uma afirmação MEDIDA sobre uma tela concreta. Quem acrescenta
// uma tela escolhe uma delas — e o teste daquela tela confere a frase contra o
// texto renderizado. Não existe padrão: a prop é obrigatória de propósito, para
// que ninguém herde por descuido a consequência de outra tela.

/**
 * A conta da festa quebrou E esta tela mostra o CUSTO como zero. Vale para a
 * aba Custos e para o Fechamento em aberto, que imprimem só custo e resultado
 * parcial: medido em 05/10/2026, "Custo total previsto R$ 0", "Total estimado
 * R$ 0" e "Resultado parcial R$ 0".
 *
 * A frase diz "onde um total depende desse valor" de propósito: com o
 * estimado quebrado e o realizado de R$ 5.000 lançado, a aba Custos imprime
 * "Total estimado R$ 0" (quebrado) e "Custo total previsto R$ 8.400" (certo,
 * usa o realizado). Uma frase que dissesse "os números de custo desta tela"
 * acusaria o número certo junto.
 */
export const CONSEQ_ZERA =
  'Onde um total desta tela depende desse valor, o app escreve R$ 0 ou “não dá para calcular” — esse zero não é o custo da festa.'

/**
 * As telas que imprimem LUCRO: Cenários, Relatório e Apresentação.
 *
 * O que elas faziam, medido em 05/10/2026: o custo saía R$ 0 e o LUCRO saía
 * igual à receita, POSITIVO e verde (R$ 38.000 / 42.750 / 47.500 numa festa de
 * 450 pagantes a R$ 100), porque o lucro impresso é refeito a partir dos
 * números arredondados (exibicaoQueFecha.js, desde 07/08/2026) e o custo
 * infinito vira 0 nessa conta. A frase antiga ("o app escreve R$ 0") era
 * falsa nessas telas desde então.
 *
 * O que elas fazem agora: lucro, resultado e margem saem como
 * NUMERO_NAO_CALCULA, e o custo total continua saindo R$ 0. A frase descreve
 * exatamente isso. Nenhuma conta mudou — a troca é na exibição.
 */
export const CONSEQ_LUCRO =
  'Onde o custo total desta tela depende desse valor, ele sai R$ 0 — esse zero não é o custo da festa — e o lucro, o resultado e a margem aparecem como “não dá para calcular”.'

/**
 * A tela que troca TODO número quebrado por texto: hoje a aba Fechamento
 * (card, tabela Estimado × Realizado e o orçamento de custos, desde
 * 05/10/2026). Medido antes, com o estimado em 1e308 e o realizado de R$ 5.000:
 * a faixa dizia que os números "continuam valendo" e a tabela imprimia
 * "Estrutura ESTOURO R$ 0 R$ 5.000 + R$ 5.000 (+0%)" e "Orçamento de custos
 * R$ 0" — a frase olhava só o card.
 */
export const CONSEQ_TEXTO =
  'Os números desta tela que dependem desse valor aparecem como “não dá para calcular”.'

// NUMERO_NAO_CALCULA (o que a tela escreve NO LUGAR de um número que deixou
// de ser dinheiro) e as duas frases do veredito moram em dadoQuebrado.js
// desde 05/10/2026: o resumo do WhatsApp (src/lib/resumo.js) também as usa, e
// módulo de lib não importa componente. Reexportadas aqui para nenhum chamador
// mudar.
export { NUMERO_NAO_CALCULA, TITULO_VEREDITO_QUEBRADO, FRASE_VEREDITO_QUEBRADO }

/**
 * A conta quebrou e esta tela mostra isso como um número ENORME. Medido na aba
 * Análise: "Não — fura em D-5 · saldo -R$ 100.000.000…000", 300 e tantos
 * dígitos numa linha de saldo, e o mesmo no "Caixa mínimo para iniciar".
 */
export const CONSEQ_NUMERO_GIGANTE =
  'Os saldos e o total desta tela não valem enquanto isso — em vez de um valor em reais eles saem com um número de centenas de dígitos, que não é dinheiro.'

/**
 * A conta da festa NÃO quebrou: o valor ilegível é de um campo que o total não
 * usa. Medido: item com "realizado" preenchido com o texto "a combinar" e
 * estimado R$ 5.000 — o total considerado imprime R$ 5.000, certo.
 */
export const CONSEQ_NAO_USADO =
  'Os números desta tela não usam esse valor e continuam valendo — o problema está guardado no cadastro do custo, e aparece se alguém for usá-lo.'

/** Fechamento de festa fechada cuja fotografia NÃO tem o custo quebrado dentro. */
export const CONSEQ_FOTO_INTACTA =
  'Os números desta tela vêm da fotografia do fechamento e não usam esse custo — eles continuam valendo. O custo quebrado está no cadastro de custos da festa, fora da fotografia.'

/**
 * Cenários, Relatório e Apresentação de festa FECHADA com a fotografia SÃ e o
 * cadastro corrompido depois (05/10/2026, 2ª revisão do PR #98). Elas mostram o
 * resultado real da FOTO (certo: "−R$ 384.000") ao lado de números calculados
 * AGORA, que dependem do custo quebrado e saem como "não dá para calcular". A
 * frase de lucro sozinha deixava entender que o resultado real também não vale;
 * esta separa as duas coisas.
 */
export const CONSEQ_FOTO_E_AGORA =
  'O resultado real, que vem da fotografia do fechamento, não usa esse custo e continua valendo. Os números calculados agora que dependem dele saem como “não dá para calcular”, e o custo total como R$ 0.'

/**
 * Consequência e conselho para a festa fechada com a fotografia SÃ — o MESMO
 * conselho do Fechamento (CONSERTO_NAO_MEXER). Antes, Cenários, Relatório e
 * Apresentação mandavam "volte a uma cópia de segurança", que o próprio
 * CONSERTO_NAO_MEXER descreve como danoso nesse caso: restaurar troca a festa
 * por uma versão anterior, reabrir descarta a fotografia.
 *
 * Devolve `{}` quando não se aplica (festa aberta, ou foto quebrada — aí vale
 * o conselho normal de corrigir), para a tela espalhar nas props da faixa.
 */
export function faixaDaFotoSa(evento, quebrouAqui) {
  const foto = evento?.status === 'fechado' ? evento?.fechamento?.foto?.resultado : null
  if (foto == null || fotoQuebrada(foto)) return {}
  return {
    consequencia: quebrouAqui ? CONSEQ_FOTO_E_AGORA : CONSEQ_NAO_USADO,
    conserto: CONSERTO_NAO_MEXER,
  }
}

// ------------------------------------------------------------ o que fazer
export const CONSERTO_CORRIGIR =
  'Como consertar: corrija o valor desse custo na aba Custos. Se não souber qual era, volte a uma cópia de segurança em Ajustes › Proteção de dados › Versões automáticas.'

/**
 * Festa fechada com a foto sã. Aqui o conselho da outra faixa seria DANOSO:
 * restaurar troca a festa inteira por uma versão anterior, e reabrir descarta a
 * fotografia (`reabrirEvento` zera `fechamento`) — as duas coisas destroem um
 * número correto por causa de um aviso sobre um número que a tela nem usa.
 */
export const CONSERTO_NAO_MEXER =
  'Não restaure cópia de segurança nem reabra o evento por causa deste aviso: restaurar troca esta festa por uma versão anterior, e reabrir descarta a fotografia do fechamento. O custo quebrado só passa a pesar se o evento for reaberto e fechado de novo — e ele impede promover esta festa a benchmark.'

/**
 * Quantos custos a faixa NOMEIA antes de resumir o resto.
 *
 * MEDIDO em 26/07/2026: uma festa com 60 custos quebrados imprimia 60 linhas e
 * 5.776 caracteres de aviso ANTES do conteúdo, no relatório que sai por PDF ao
 * contador. Cinco nomes bastam para o Marco saber onde procurar; o resto vira
 * uma linha de contagem, e a contagem continua exata.
 */
export const MAX_ITENS_NOMEADOS = 5

export const fraseEMais = (n) =>
  `E mais ${n} ${n === 1 ? 'custo' : 'custos'} com o mesmo problema — a lista inteira está na aba Custos.`

/**
 * O QUE A RÉGUA QUEBRADA FAZ COM O DESENHO DA FESTA SÃ — medido, 26/07/2026.
 *
 * Numa "Marfim de outubro" sem defeito nenhum (custo R$ 29 mil), com o
 * benchmark quebrado ligado, a seção "Comparação com eventos passados" saiu
 * assim (largura lida do estilo de cada barra):
 *
 *   Custo total ....... Marfim de outubro R$ 29 mil → 0%     (sobra o mínimo de 2px)
 *                       Brisa quebrada   R$ 0      → vazia
 *   Estrutura & Ceno .. Previsão          R$ 20 mil → 2e-302% (2px)
 *                       Brisa quebrada   R$ 1000…000 → 100%
 *
 * Ou seja: o NÚMERO da festa sã continua certo na coluna de valores, mas a
 * BARRA dela vira um risco de 2 pixels ao lado de uma barra cheia. A escala do
 * gráfico é a da maior linha, e a maior linha é a quebrada. Dizer "a sua festa
 * não foi afetada" seria a frase generosa que esta frente veio derrubar.
 */
export const FRASE_CONSEQUENCIA_BENCHMARK =
  'Os valores dessa referência aqui não valem: onde o número não cabe numa conta de dinheiro, o app escreve R$ 0 ou um número de centenas de dígitos. O número da SUA festa, na coluna de valores, continua certo — mas a barra dela encolhe para um risco fino, porque o desenho é feito na escala da maior barra, e a maior é a quebrada.'

/**
 * Onde se gerencia benchmark, VERIFICADO no app: o botão "Editar" fica na tela
 * inicial, ao lado do título "Eventos antigos de referência (benchmarks)".
 * Ajustes › Benchmarks só lista os que já estão ocultos ou apagados, com o
 * caminho de volta — mandar o Marco para lá para CORRIGIR um valor era mandá-lo
 * para uma tela onde não existe esse botão.
 */
export const FRASE_CONSERTO_BENCHMARK =
  'Como consertar: na tela inicial, em “Eventos antigos de referência (benchmarks)”, clique em “Editar” — dali dá para corrigir os valores dessa referência, ocultá-la das comparações ou apagá-la.'

/**
 * Até 07/10/2026 a frase acima terminava com "Os quatro benchmarks históricos
 * embutidos não têm este problema." — FALSO quando o override de um embutido
 * chega quebrado pelo backup (medido: custo 1e308 no Cordel; público ilegível
 * no Cordel, revisão adversarial do S1). Agora a tranquilização só sai quando
 * é verificável NESTA lista: há embutido na comparação e nenhum deles está
 * acusado (nem custo, nem público).
 */
export const FRASE_EMBUTIDOS_SAOS = 'As referências embutidas desta comparação não têm este problema.'
const IDS_EMBUTIDOS = new Set(FIXED_BENCHMARKS.map((b) => b.id))

/**
 * PÚBLICO ILEGÍVEL numa referência (S1, 07/10/2026). O público não entra em
 * nenhum valor em reais da referência; ele só divide. Por isso a consequência
 * é outra, e a frase do custo ("o app escreve R$ 0 ou um número de centenas de
 * dígitos") seria falsa aqui. Conferido nas três telas que mostram esta faixa:
 * o cabeçalho do relatório escreve PUBLICO_ILEGIVEL, Cenários "Por pessoa" e
 * Custos › Referências escrevem NUMERO_NAO_CALCULA — por isso a frase diz
 * "avisa que não consegue calcular", que vale para as duas formas.
 */
export const frasePublicoIlegivel = ({ nome, original }) =>
  `A referência “${nome}” está com um público que o app não consegue calcular (valor guardado: ${textoPublicoGuardado(original)}).`
export const FRASE_CONSEQUENCIA_PUBLICO =
  'No lugar do público dessa referência, e de cada valor dela por pessoa, o app avisa que não consegue calcular. Os valores em reais dela não dependem do público.'
/** O conserto do público: o caminho do "Editar" e o que o campo mostra. */
export const FRASE_CONSERTO_PUBLICO =
  'Como consertar: na tela inicial, em “Eventos antigos de referência (benchmarks)”, clique em “Editar” e informe o público dessa referência — o valor guardado aparece embaixo do campo até você digitar outro.'

function Faixa({ papel, titulo, children, className = '' }) {
  // No papel o corpo é vermelho ESCURO, não cinza: cinza sobre fundo colorido
  // sai lavado na impressão, e este é o texto que explica por que o número ao
  // lado não vale. Na tela, o par fundo/tinta é o MESMO das linhas recusadas do
  // orçamento do produtor — seguir o componente que já existe.
  const caixa = papel
    ? 'rounded-lg border border-red-600 bg-red-50 p-3'
    : 'rounded-lg border border-[var(--vermelho-texto)] bg-[var(--tarja-alerta-fundo)] p-3'
  const corTitulo = papel ? 'text-red-700' : 'text-[var(--vermelho-texto)]'
  return (
    <div role="alert" className={`${caixa} break-inside-avoid ${className}`}>
      <h3 className={`mb-1 flex items-start gap-1.5 text-sm font-semibold ${corTitulo}`}>
        <AppIcon icon={TriangleAlert} size={15} className="mt-0.5" />
        {titulo}
      </h3>
      {children}
    </div>
  )
}

/**
 * @param efeito            COMO esta tela mostra um número que quebrou:
 *                          'zera' (escreve R$ 0), 'texto' (todo número quebrado
 *                          vira "não dá para calcular"), 'lucro' (custo R$ 0 e lucro,
 *                          resultado e margem como "não dá para calcular") ou
 *                          'gigante' (escreve o número de centenas de dígitos).
 *                          Só é usado quando a conta da festa de fato quebrou.
 * @param numeroQuebrouAqui Sobrescreve a medição, para a tela que sabe algo que
 *                          a leitura da festa não sabe — hoje só o Fechamento,
 *                          que mostra a FOTOGRAFIA e não o cálculo de agora,
 *                          e as telas de cenário, que usam o custo CONSIDERADO
 *                          (com o realizado lançado, o estimado quebrado não
 *                          entra na conta delas). Sem isto, vale `somaNaoCabe`.
 * @param consequencia      Sobrescreve a frase; use só quando a tela tem uma
 *                          verdade a mais a contar (a fotografia).
 */
export default function AvisoCustoQuebrado({
  evento,
  efeito = 'zera',
  numeroQuebrouAqui,
  consequencia,
  conserto = CONSERTO_CORRIGIR,
  papel = false,
  className = '',
}) {
  const { itens, somaNaoCabe, ha } = custosQuebrados(evento)
  if (!ha) return null

  const quebrou = numeroQuebrouAqui === undefined ? somaNaoCabe : numeroQuebrouAqui
  const frase =
    consequencia ??
    (!quebrou
      ? CONSEQ_NAO_USADO
      : efeito === 'gigante'
        ? CONSEQ_NUMERO_GIGANTE
        : efeito === 'lucro'
          ? CONSEQ_LUCRO
          : efeito === 'texto'
            ? CONSEQ_TEXTO
            : CONSEQ_ZERA)

  const corpo = papel ? 'text-red-900' : 'text-[var(--tinta-2)]'
  const nomeados = itens.slice(0, MAX_ITENS_NOMEADOS)
  const restantes = itens.length - nomeados.length

  return (
    <Faixa papel={papel} titulo={TITULO_CUSTO_QUEBRADO} className={className}>
      <ul className={`mb-2 space-y-0.5 text-xs ${corpo}`}>
        {nomeados.map((it, i) => (
          <li key={i}>{frasePorItem(it)}</li>
        ))}
        {restantes > 0 && <li>{fraseEMais(restantes)}</li>}
        {itens.length === 0 && somaNaoCabe && <li>{FRASE_SOMA}</li>}
      </ul>
      <p className={`mb-1 text-xs ${corpo}`}>{frase}</p>
      <p className={`text-xs ${corpo}`}>{conserto}</p>
    </Faixa>
  )
}

/**
 * A FAIXA DA COMPARAÇÃO — quando a régua, e não a festa, é que está quebrada.
 *
 * Vale para benchmark que JÁ está salvo: a porta nova (`motivoNaoPromover`)
 * impede que um novo entre por promoção, mas não limpa o que está lá, e não é a
 * única entrada — o importador de planilha e o backup JSON também criam
 * benchmark, e nenhum dos dois tem teto para dinheiro.
 *
 * A faixa NÃO tira o benchmark da comparação e não muda nenhum número: as
 * barras continuam exatamente como estavam. Ela diz qual referência não pode
 * ser lida. Esconder ou apagar a referência é decisão do Marco, com as opções
 * no DIFF-PARA-O-MARCO desta frente.
 */
export function AvisoBenchmarkQuebrado({ benchmarks, papel = false, className = '' }) {
  const quebrados = benchmarksQuebrados(benchmarks)
  const publicos = referenciasComPublicoIlegivel(benchmarks)
  if (quebrados.length === 0 && publicos.length === 0) return null
  const corpo = papel ? 'text-red-900' : 'text-[var(--tinta-2)]'
  const nomeados = quebrados.slice(0, MAX_ITENS_NOMEADOS)
  const restantes = quebrados.length - nomeados.length
  const publicosNomeados = publicos.slice(0, MAX_ITENS_NOMEADOS)
  const publicosRestantes = publicos.length - publicosNomeados.length
  // Combinações (custo/público × próprio/embutido), revisão adversarial de
  // 07/10/2026: cada conserto sai quando o problema dele existe — antes, com
  // custo quebrado E público ilegível, o do público sumia —, e a frase dos
  // embutidos só quando é verdade nesta lista.
  const lista = Array.isArray(benchmarks) ? benchmarks : []
  const embutidos = lista.filter((b) => IDS_EMBUTIDOS.has(b?.id))
  const embutidosSaos =
    embutidos.length > 0 && !embutidos.some((b) => benchmarkQuebrado(b).ha || publicoIlegivel(b))
  return (
    <Faixa papel={papel} titulo={TITULO_BENCHMARK_QUEBRADO} className={className}>
      <ul className={`mb-2 space-y-0.5 text-xs ${corpo}`}>
        {nomeados.map((b, i) => (
          <li key={i}>
            A referência “{b.nome}” está com {b.campos.length === 1 ? 'um valor' : 'valores'} que o
            app não consegue calcular
            {b.campos.length > 0 ? ` (${b.campos.join(', ')})` : ''}.
          </li>
        ))}
        {restantes > 0 && (
          <li>E mais {restantes} {restantes === 1 ? 'referência' : 'referências'} no mesmo estado.</li>
        )}
        {publicosNomeados.map((b, i) => (
          <li key={`publico-${i}`}>{frasePublicoIlegivel(b)}</li>
        ))}
        {publicosRestantes > 0 && (
          <li>
            E mais {publicosRestantes} {publicosRestantes === 1 ? 'referência' : 'referências'} com o público
            no mesmo estado.
          </li>
        )}
      </ul>
      {quebrados.length > 0 && (
        <p className={`mb-1 text-xs ${corpo}`}>
          {FRASE_CONSEQUENCIA_BENCHMARK}
        </p>
      )}
      {publicos.length > 0 && <p className={`mb-1 text-xs ${corpo}`}>{FRASE_CONSEQUENCIA_PUBLICO}</p>}
      {quebrados.length > 0 && <p className={`text-xs ${corpo}`}>{FRASE_CONSERTO_BENCHMARK}</p>}
      {publicos.length > 0 && <p className={`text-xs ${corpo}`}>{FRASE_CONSERTO_PUBLICO}</p>}
      {embutidosSaos && <p className={`text-xs ${corpo}`}>{FRASE_EMBUTIDOS_SAOS}</p>}
    </Faixa>
  )
}

// ===========================================================================
// RECEITA QUEBRADA (05/10/2026, 2ª revisão do PR #98)
// ===========================================================================
// Sempre que um número vira "não dá para calcular", a tela tem de dizer QUAL
// campo está quebrado. Com a bilheteria realizada em 1e308 (a migração aceita),
// o Relatório e a Apresentação escreviam "não dá para calcular" no resultado
// real sem faixa nenhuma — a faixa de custo não aparece, porque nenhum custo
// está quebrado.
export const TITULO_RECEITA_QUEBRADA = 'Esta festa tem uma receita que o app não consegue calcular'
export const fraseReceita = (campo) =>
  `O valor d${campo.startsWith('a ') ? 'a' : 'o'} ${campo.slice(2)} não cabe numa conta de dinheiro.`
export const CONSEQ_RECEITA = CONSEQ_TEXTO
export const CONSERTO_RECEITA =
  'Como consertar: corrija esse valor — bilheteria, bar e Pix realizados na aba Fechamento; lotes, bar previsto e patrocínio na aba Receita; ticket médio na aba Cenários. Com o evento fechado é preciso reabrir antes — e reabrir descarta a fotografia, que com esse valor dentro também não vale.'
/** Receita prevista que estoura sem um campo culpado (soma de lotes, 05/10/2026). */
export const FRASE_SOMA_RECEITA = 'A soma da receita prevista desta festa não cabe numa conta de dinheiro.'
/** Festa fechada com a foto SÃ e a receita corrompida depois: não mexer. */
export const CONSEQ_RECEITA_FOTO_SA =
  'O resultado real, que vem da fotografia do fechamento, não usa esse valor e continua valendo.'
export const CONSERTO_RECEITA_FOTO_SA =
  'Não restaure cópia de segurança nem reabra o evento por causa deste aviso: restaurar troca esta festa por uma versão anterior, e reabrir descarta a fotografia do fechamento.'

export function AvisoReceitaQuebrada({ evento, papel = false, className = '' }) {
  const { campos, somaNaoCabe, ha } = receitaQuebrada(evento)
  if (!ha) return null
  const foto = evento?.status === 'fechado' ? evento?.fechamento?.foto?.resultado : null
  const fotoSa = foto != null && !fotoQuebrada(foto)
  const corpo = papel ? 'text-red-900' : 'text-[var(--tinta-2)]'
  return (
    <Faixa papel={papel} titulo={TITULO_RECEITA_QUEBRADA} className={className}>
      <ul className={`mb-2 space-y-0.5 text-xs ${corpo}`}>
        {campos.map((c) => (
          <li key={c}>{fraseReceita(c)}</li>
        ))}
        {campos.length === 0 && somaNaoCabe && <li>{FRASE_SOMA_RECEITA}</li>}
      </ul>
      <p className={`mb-1 text-xs ${corpo}`}>{fotoSa ? CONSEQ_RECEITA_FOTO_SA : CONSEQ_RECEITA}</p>
      <p className={`text-xs ${corpo}`}>{fotoSa ? CONSERTO_RECEITA_FOTO_SA : CONSERTO_RECEITA}</p>
    </Faixa>
  )
}
