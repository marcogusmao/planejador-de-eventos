import { camposReceitaRealizadaInvalidos, textoOriginalRealizado } from '../lib/migracao.js'
import { Card, Field, MoneyInput, Btn, corDelta, corResultado } from './ui.jsx'
import { FAIXA_CUSTO } from '../lib/campoNumerico.js'
import { computeCenario, patrocinioPorEstagio, isOpenBar } from '../lib/calc.js'
import { fechamentoCustos, fechamentoReceita, resultadoRealizado, NOME_BILHETERIA_BRUTA } from '../lib/fechamento.js'
import { impostoTexto } from '../lib/imposto.js'
import { eventoFechado, motivoNaoFechar } from '../lib/fechamentoEvento.js'
import { fmtBRL, fmtBRL2, fmtPct, fmtData } from '../lib/format.js'
import { num } from '../lib/util.js'
import { CarimboFinanceiro } from './RitmoVendas.jsx'
import { AcuraciaFechamento } from './Acuracia.jsx'
import { dataLocalDoInstante } from '../lib/dataLocal.js'
import AvisoCustoQuebrado, {
  AvisoReceitaQuebrada,
  CONSEQ_FOTO_INTACTA,
  CONSERTO_NAO_MEXER,
  NUMERO_NAO_CALCULA,
} from './AvisoCustoQuebrado.jsx'
import { cabeComoDinheiro, custosQuebrados, fotoQuebrada, fmtOuIlegivel, camposRealizadosAtivosInvalidos } from '../lib/dadoQuebrado.js'
import AvisoLoteSemPreco from './AvisoLoteSemPreco.jsx'

// Número que deixou de ser dinheiro vira TEXTO nesta aba (05/10/2026, 2ª
// revisão do PR #98). Medido antes, com o estimado em 1e308 e o realizado de
// R$ 5.000: "Estrutura ESTOURO R$ 0 R$ 5.000 + R$ 5.000 (+0%)" e "Orçamento de
// custos (todos os itens) R$ 0"; com o custo quebrado e nada realizado,
// "Resultado parcial R$ 0". `cabeComoDinheiro(null)` é verdadeiro, então o
// "—" e o vazio de sempre não mudam: só o número que não cabe é trocado.
export const campoRealizadoDaLinha = (nome) => ({
  [NOME_BILHETERIA_BRUTA]: 'bilheteria',
  'Bar (lucro líquido)': 'bar',
  'Pix recebido (líquido)': 'pix',
})[nome]

const din = (v, fmt) => (cabeComoDinheiro(v) ? fmt(v) : NUMERO_NAO_CALCULA)
const cabemTodos = (...vs) => vs.every(cabeComoDinheiro)

// Custo e receita leem o desvio com réguas OPOSTAS: em custo, gastar mais é o
// ruim; em receita, vender menos é o ruim. Por isso o custo usa `corDelta`
// (a regra compartilhada com a aba Custos, via confrontoCustos.js) e a receita
// inverte o sinal antes de pedir a mesma cor.
const tomDesvio = (desvio, estouro) =>
  desvio == null ? 'text-[var(--tinta-3)]' : estouro ? 'text-[var(--vermelho-texto)] font-semibold' : 'text-[var(--verde-texto)]'

// A faixa da linha em estouro sai do vermelho da MARCA com alfa, e não do
// `bg-red-50` do Tailwind: aquele é um creme claro FIXO, e no tema escuro
// virava uma barra clara que apagava o número vermelho por cima — justo a
// linha que este conserto veio fazer o Marco ler. Com alfa sobre o papel, ela
// tinge de leve nos dois temas. (O mesmo `bg-red-50` aparece em outras telas
// com o mesmo defeito — fora do escopo desta sessão, anotado no BACKLOG.md.)
const FAIXA_ESTOURO = 'bg-[var(--vermelho)]/[0.07]'

// O que a comparação DEIXOU DE FORA, dito na própria linha. Sem esta frase a
// coluna "Estimado" (que mostra só o estimado dos itens já realizados) pareceria
// um orçamento encolhido; com ela, o leitor sabe o tamanho do que ainda falta.
const pendencia = (c) => {
  if (!c.temRealizado || c.nSemRealizado === 0) return null
  return (
    <div className="text-[10px] font-normal text-[var(--tinta-3)]">
      {c.nComRealizado} de {c.nItens} itens comparados ·{' '}
      {c.nSemRealizado === 1 ? '1 item ainda sem realizado' : `${c.nSemRealizado} itens ainda sem realizado`} (
      {din(c.estimadoPendente, fmtBRL)} de estimado)
    </div>
  )
}

// Uma LINHA da conta do resultado. Régua da casa (PADRÃO §3): "se existe um
// passo na conta, ele tem LINHA — com valor em R$; um passo explicado só em
// outra tela NÃO conta como explicado". Coluna de valor semibold e tabular.
function LinhaConta({ sinal, rotulo, nota, valor, total = false, valorClass = '' }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        total ? 'mt-1 border-t border-[var(--borda)] pt-2 font-semibold' : ''
      }`}
    >
      <div className="min-w-0 text-sm">
        <span className="mr-1 inline-block w-3 text-[var(--tinta-3)]">{sinal}</span>
        <span className={total ? '' : 'text-[var(--tinta-2)]'}>{rotulo}</span>
        {nota && <span className="ml-1.5 text-[11px] text-[var(--tinta-3)]">{nota}</span>}
      </div>
      <div className={`tnum shrink-0 font-semibold ${valorClass}`}>{valor}</div>
    </div>
  )
}

// Valor com o sinal explícito na frente, para a coluna somar de olho.
//
// O sinal sai do EFEITO da parcela na conta, NUNCA de um booleano fixo
// (achado da verificação adversarial, 20/07/2026): `bar` pode ser NEGATIVO —
// `barPorPessoa()` devolve prejuízo quando o custo do sistema supera o consumo
// —, e com o sinal travado em "+" a linha imprimia "+ R$ 1.500" para uma
// parcela que SUBTRAI 1.500. A coluna deixava de somar na frente de quem lê,
// que é a única coisa que ela promete (PADRÃO DA CASA §3).
// `subtrai` = a parcela entra descontando (taxa, custos): o efeito é −valor.
const efeitoNaConta = (valor, subtrai = false) => (subtrai ? -num(valor) : num(valor))
const sinalDe = (valor, subtrai = false) => (efeitoNaConta(valor, subtrai) < 0 ? '−' : '+')
// CENTAVOS NA COLUNA DO CARD (decisão do Marco, 12/08/2026, por questionário).
// Até aqui esta função imprimia reais INTEIROS, e por isso a coluna NÃO SOMAVA
// na frente de quem lê em 35,7% dos eventos — medido num fuzz de 25.767, pior
// caso R$ 2. O exemplo canônico: bilheteria 47.850, taxa 12,5%, cashback 5%,
// bar 3.000 imprimia − R$ 5.981 (de 5.981,25) e + R$ 2.393 (de 2.392,50), e as
// quatro linhas somavam 47.262 sob um total escrito 47.261.
//
// `fmtBRL2` mostra os centavos SÓ quando eles existem, então festa de valores
// redondos continua com a tela idêntica à de antes — o que muda é só a festa
// cuja conta tem centavo, que é exatamente onde a coluna mentia.
//
// O RISCO QUE O MARCO ACEITOU, escrito para quem for reabrir esta escolha:
// números mais longos e menos limpos na tela que ele usa em reunião. A
// alternativa — manter inteiros e distribuir o resto para a coluna fechar —
// foi recusada porque faria uma linha exibir valor até R$ 1 distante do cru.
const comSinal = (valor, subtrai = false) => {
  const efeito = efeitoNaConta(valor, subtrai)
  return `${efeito < 0 ? '−' : '+'} ${fmtBRL2(Math.abs(efeito))}`
}

// B2 (BACKLOG S4, 20/07/2026): as linhas de PARCELA acima usam `comSinal`,
// que escreve o menos como U+2212 separado do "R$" ("− R$ 5.981"). As linhas
// de TOTAL ("=") chamavam `fmtBRL` direto, e o `Intl.NumberFormat` de moeda
// devolve o hífen ASCII colado no símbolo para negativo ("-R$ 66.584") — duas
// convenções de menos no mesmo card. Esta função só troca o GLIFO do sinal
// quando o total é negativo; o valor e o formato de moeda continuam vindo de
// `fmtBRL`, então nenhum número muda.
const fmtBRLTotal = (v) => (num(v) < 0 ? `− ${fmtBRL2(Math.abs(num(v)))}` : fmtBRL2(v))

// Meio real, e não o LIMIAR_ZERO de meio centavo: esta coluna é impressa em
// reais INTEIROS, então uma parcela de três centavos rendia a frase "a receita
// deste card está R$ 0 abaixo da prevista" — uma explicação que não explica.
const MEIO_REAL = 0.5

// Meio centavo — o mesmo LIMIAR_ZERO usado nas demais telas de confronto
// (confrontoCustos.js): abaixo disso é ruído de ponto flutuante, não uma
// fórmula que mudou de verdade. Usada só para decidir se a nota "se fosse
// fechado hoje" aparece sob o card de um evento fechado.
const LIMIAR_DIVERGENCIA_FOTO = 0.005

// AS PARCELAS da diferença entre este card e o cenário realista, ditas em
// texto — e só as que existem neste evento. A identidade é exata e fecha
// sempre (ver o comentário da ponte em fechamento.js):
//
//     resultado − lucroDoCenario
//       =  contingência + ajuste + desvioDeReceita − desvioDeImposto
//
// DUAS GERAÇÕES DE DEFEITO MORAM AQUI, e as duas eram a MESMA doença — causa
// errada escrita sobre número certo:
//
// 1ª) a tela afirmava uma causa ÚNICA: "lá é X PORQUE a previsão reserva
//     contingência". Só é verdade quando realizado == previsto, isto é
//     exatamente quando o fechamento ainda não fechou nada. Num evento que
//     vendeu abaixo do previsto o `porque` apontava para o lado errado.
//
// 2ª) a correção da 1ª somava contingência e ajuste numa "reserva" só e tirava
//     o VERBO do sinal dessa soma. Como o ajuste do cenário pode ser NEGATIVO,
//     um ajuste de −10% sobre uma contingência de +5% produzia a frase "a
//     previsão CORTA R$ 5.500 de contingência" — num evento em que a
//     contingência somava R$ 5.000 e quem cortava era o ajuste. Achado
//     adversarial: 9% dos eventos com card.
//
// 3ª) a chegada do imposto (27/07/2026) criou a MESMA doença de novo, e ela foi
//     pega pela revisão cética antes de o Marco ver a tela. `desvioDeReceita`
//     era derivado por subtração supondo que o lucro tinha DOIS termos; com
//     três, o imposto inteiro caía dentro dele. MEDIDO no DOM, num evento cuja
//     receita realizada é EXATAMENTE a prevista: "a receita deste card está
//     R$ 1.300 acima da prevista no cenário" — e os R$ 1.300 eram o imposto.
//     Hoje o imposto tem parcela própria, com o nome dele.
//
// Por isso cada parcela é dita SEPARADA, com o verbo que é dela: contingência
// sempre reserva, o ajuste acrescenta ou corta, a receita e o imposto ficam
// acima ou abaixo do previsto.
function PartesDaDiferenca({ resultado, evento }) {
  const cont = num(resultado.contingenciaDoCenario)
  const ajusteValor = num(resultado.ajusteDoCenarioValor)
  const desvio = num(resultado.desvioDeReceita)
  const desvioImposto = num(resultado.desvioDeImposto)
  const vale = (v) => Math.abs(v) >= MEIO_REAL
  const partes = []

  if (vale(cont)) {
    partes.push(
      <>
        a previsão reserva <strong className="tnum">{fmtBRL2(Math.abs(cont))}</strong> de
        contingência ({fmtPct(num(evento.contingenciaPct))} dos custos) que o fechamento não gasta
      </>
    )
  }
  if (vale(ajusteValor)) {
    partes.push(
      <>
        o cenário {ajusteValor > 0 ? 'acrescenta' : 'corta'}{' '}
        <strong className="tnum">{fmtBRL2(Math.abs(ajusteValor))}</strong> de ajuste de custo (
        {fmtPct(num(resultado.ajusteDoCenario))})
      </>
    )
  }
  if (vale(desvio)) {
    partes.push(
      <>
        a receita deste card está <strong className="tnum">{fmtBRL2(Math.abs(desvio))}</strong>{' '}
        {desvio > 0 ? 'acima' : 'abaixo'} da prevista no cenário
      </>
    )
  }
  // O IMPOSTO, com o nome dele. Vem depois da receita porque é dela que ele
  // sai: quando a festa vende mais do que o previsto, a base cresce e o imposto
  // cresce atrás — e sem esta parcela esse aumento aparecia somado à receita,
  // fazendo a tela prometer mais dinheiro do que entrou.
  if (vale(desvioImposto)) {
    partes.push(
      <>
        o imposto deste card está{' '}
        <strong className="tnum">{fmtBRL2(Math.abs(desvioImposto))}</strong>{' '}
        {desvioImposto > 0 ? 'acima' : 'abaixo'} do previsto no cenário
      </>
    )
  }
  // A pontuação mora AQUI, e não na frase que chama, para não sobrar um
  // dois-pontos órfão quando não houver parcela nenhuma a listar.
  if (partes.length === 0) return <>.</>

  return (
    <>
      :{' '}
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 && (i === partes.length - 1 ? ' e ' : ', ')}
          {parte}
        </span>
      ))}
      .
    </>
  )
}

const fmtDesvio = (desvio, pct) => {
  if (desvio == null) return '—'
  const sinal = desvio > 0 ? '+' : desvio < 0 ? '−' : ''
  const base = `${sinal} ${fmtBRL2(Math.abs(desvio))}`
  return pct == null ? base : `${base} (${desvio > 0 ? '+' : ''}${fmtPct(pct)})`
}

export default function FechamentoTab({
  evento,
  update,
  store,
  onPromoverBenchmark,
  onFecharEvento,
  onReabrirEvento,
}) {
  const fechado = eventoFechado(evento)
  const realista = computeCenario(evento, 'realista')
  const foto = fechado ? evento.fechamento.foto : null
  // Em evento FECHADO, os TRÊS quadros da aba saem da FOTO — não só o card.
  // A faixa promete "os números abaixo são a fotografia do fechamento", e o
  // quadro Estimado × Realizado renderizando ao vivo faria uma mudança de
  // fórmula futura reescrever festa fechada por baixo dessa promessa (achado
  // adversarial 20/07/2026 — foto.custos/foto.receita eram gravados e nunca
  // lidos). O fallback ao vivo cobre foto antiga sem os quadros.
  // Os quadros da foto são OPCIONAIS e só entram se BEM-FORMADOS (o array
  // que o JSX mapeia existe): a migração garante o MIOLO da foto (resultado);
  // custos/receita malformados de backup editado à mão caem no fallback vivo
  // em vez de derrubar a aba com TypeError (síntese adversarial, rodada 2).
  const custos = Array.isArray(foto?.custos?.porCategoria)
    ? foto.custos
    : fechamentoCustos(evento.categorias)
  const receitaDaFoto = Array.isArray(foto?.receita?.linhas)
  const receitaFonte = receitaDaFoto
    ? foto.receita
    : fechamentoReceita(evento, realista)
  // `resultadoVivo` é SEMPRE o cálculo ao vivo (precisa dele mesmo fechado,
  // para o portão do botão e para a nota de divergência do item 3). `resultado`
  // é o que o card efetivamente RENDERIZA: a foto congelada quando o evento
  // está fechado, o vivo quando está aberto — o resto do JSX abaixo não muda,
  // porque a foto tem exatamente a mesma forma da saída de resultadoRealizado.
  // (`?? null` é cinto: a migração já recusa foto sem `resultado`.)
  const resultadoVivo = resultadoRealizado(evento, realista)
  const resultadoFonte = fechado ? (foto.resultado ?? null) : resultadoVivo
  const rrOriginal = evento.receitaRealizada || {}
  const invalidos = new Set(camposReceitaRealizadaInvalidos(evento))
  for (const campo of ['bilheteria', 'bar', 'pix'])
    if (!cabeComoDinheiro(rrOriginal[campo])) invalidos.add(campo)
  const rr = { ...rrOriginal }
  for (const campo of invalidos) rr[campo] = ''
  const avisoCampo = (campo) => invalidos.has(campo) ? (
    <p id={`realizado-${campo}-invalido`} className="mt-1 break-words text-xs text-[var(--tinta-2)]">
      Valor guardado: {textoOriginalRealizado(rrOriginal[campo])}. Não dá para calcular; informe o número correto neste campo. O original fica guardado até você editar.
    </p>
  ) : null
  // Open bar (sugestão 27): sem receita de bar — o fechamento não pede bar
  // realizado (fechamentoReceita já tira a linha da conta).
  const openBar = isOpenBar(evento)

  const origemAtivaInvalida = camposRealizadosAtivosInvalidos(evento).length > 0
  const motivoFechamento = motivoNaoFechar(evento)
  // Cópias só de apresentação: fórmula e valores guardados permanecem intactos.
  const receita = receitaDaFoto ? receitaFonte : {
    ...receitaFonte,
    linhas: receitaFonte.linhas.map((l) => invalidos.has(campoRealizadoDaLinha(l.nome))
      ? { ...l, realizado: NaN, desvio: NaN, desvioPct: NaN } : l),
  }
  const resultado = resultadoFonte && !fechado ? { ...resultadoFonte } : resultadoFonte
  if (resultado && !fechado) {
    if (invalidos.has('bilheteria'))
      for (const chave of ['bilheteriaBruta', 'taxa', 'cashback']) resultado[chave] = NaN
    if (!openBar && invalidos.has('bar')) resultado.bar = NaN
    if (invalidos.has('pix')) resultado.pix = NaN
    if (origemAtivaInvalida) {
      for (const chave of ['receita', 'resultado', 'diferencaParaCenario']) resultado[chave] = NaN
      if (resultado.imposto) resultado.imposto = { ...resultado.imposto, valor: NaN }
    }
  }

  // Item 3 (declarar divergência, padrão carimboCampo): só faz sentido com o
  // evento fechado E com o vivo existindo. Com a trava de gravação, os DADOS
  // de um evento fechado não mudam — se vivo e foto divergirem, o que mudou
  // foi FÓRMULA/premissa do app depois do fechamento, e é isso que a nota
  // declara. (O guard do vivo é só forma: hoje ele existe sempre que a foto
  // existiu, mas ninguém promete isso para sempre.)
  const divergeDoFechamento =
    fechado &&
    resultadoVivo &&
    resultado != null &&
    Math.abs(num(resultadoVivo.resultado) - num(resultado.resultado)) > LIMIAR_DIVERGENCIA_FOTO

  // Os DOIS números que o card imprime grande ("Custos considerados" e
  // "Resultado") são dinheiro de verdade? É a medição que decide o texto da
  // faixa de dado quebrado (ver o comentário longo junto dela, no JSX). Lida do
  // `resultado` que este componente RENDERIZA — foto quando fechado, vivo
  // quando aberto — e não de um recálculo paralelo.
  //
  // A régua é `fotoQuebrada` (custos, resultado e receita, com `null` contando
  // como quebrado — o rastro do infinito depois do JSON), a mesma do Relatório
  // e da Apresentação.
  const cardQuebrado = fotoQuebrada(resultado)
  const cardCabeComoDinheiro = !cardQuebrado
  const fotoIntacta = fechado && cardCabeComoDinheiro
  // No card, um `null` nos campos que a régua acusou também é quebrado (na
  // foto ele é o infinito que o JSON apagou); fora deles vale `din`.
  const dinCard = (v, fmt) => (cardQuebrado && (v == null || !cabeComoDinheiro(v)) ? NUMERO_NAO_CALCULA : din(v, fmt))
  // TODA linha do card passa por aqui (3ª revisão do PR #98, 05/10/2026). A
  // rodada anterior cobriu bilheteria, Pix, receita, custos e resultado e
  // deixou passar os vizinhos: com o bar em 1e308 saía "Bar + R$ 100.000…";
  // com a bilheteria em 1e307, "Taxa da bilheteria − R$ 1.000.000…" — a taxa
  // de 10% (1e306) CABE na régua sozinha, então a linha também olha a ORIGEM
  // dela (`origens`); com a bilheteria em 1e308, "Taxa + R$ 0", sinal trocado.
  // Linha quebrada perde o número E o sinal.
  const linhaQuebrada_ = (v, origens) =>
    !cabemTodos(v, ...origens) || (cardQuebrado && v == null)
  const valorCard = (v, fmt, ...origens) => (linhaQuebrada_(v, origens) ? NUMERO_NAO_CALCULA : fmt(v))
  const sinalCard = (v, subtrai, ...origens) => (linhaQuebrada_(v, origens) ? '' : sinalDe(v, subtrai))
  // A faixa decide pela TELA INTEIRA, não só pelo card: a tabela Estimado ×
  // Realizado e o orçamento de custos também imprimem números que vêm do lixo
  // (o caso do estimado 1e308 com realizado lançado deixa o card certo e a
  // tabela quebrada).
  const tabelaQuebrada = !cabemTodos(
    ...custos.porCategoria.flatMap((c) => [c.estimadoComparavel, c.realizado, c.desvio, c.estimadoPendente]),
    custos.totalEstimadoComparavel,
    custos.totalRealizado,
    custos.desvioTotal,
    custos.totalEstimado,
    ...receita.linhas.flatMap((l) => [l.estimado, l.realizado, l.desvio])
  )
  const linhaQuebrada = (c) => !cabemTodos(c.estimadoComparavel, c.realizado, c.desvio, c.estimadoPendente)

  const setReceitaReal = (p) =>
    update((e) => ({
      ...e,
      receitaRealizada: { bilheteria: '', bar: '', ...(e.receitaRealizada || {}), ...p },
    }))

  // TAREFA A: fechar congela os números de AGORA. O portão de "dá para
  // fechar" é o MESMO do benchmark — bilheteria realizada informada — e mora
  // em fechamentoEvento.js; aqui só se obedece (o botão nunca decide sozinho).
  const confirmarFechar = () => {
    const res = resultadoVivo
    if (motivoFechamento) {
      window.alert(motivoFechamento)
      return
    }
    // MITIGAÇÃO da decisão do Marco, 25/07/2026: bilheteria realizada 0
    // agora É "informada" (temValor aceita zero) e passa a poder fechar —
    // festa de graça existe, e uma festa que vendeu zero ingresso mas teve
    // bar/patrocínio tem resultado real para congelar. O risco que isso abre
    // é o descuido: o Marco esquece de preencher e o campo fica em 0 por
    // omissão, não por fato. Por isso, SÓ quando a bilheteria bruta é
    // EXATAMENTE zero, uma pergunta extra confirma a intenção antes da
    // pergunta de sempre — o mesmo padrão de confirmarReabrir, uma pergunta
    // por vez, em português, dizendo o efeito.
    if (res.bilheteriaBruta === 0) {
      const perguntaZero = `A bilheteria realizada está em R$ 0 — foi isto mesmo (festa gratuita, ou sem venda de ingresso) e não um campo esquecido? A foto do fechamento vai congelar com bilheteria zero.`
      if (!window.confirm(perguntaZero)) return
    }
    const base = `Fechar "${evento.nome}"? A foto dos números de AGORA fica gravada como o resultado deste evento, e os campos travam (dá para reabrir depois, aqui mesmo).`
    // Cada tipo de pendência só entra na frase quando EXISTE — sem isto, um
    // evento pendente só de receita lia "0 item(ns) de custo ainda sem
    // realizado", verdade técnica redigida como alerta de custo (achado
    // adversarial 20/07/2026).
    const partesPendencia = []
    if (res.nSemRealizado > 0)
      partesPendencia.push(
        res.nSemRealizado === 1
          ? '1 item de custo ainda sem realizado'
          : `${res.nSemRealizado} itens de custo ainda sem realizado`
      )
    if (res.linhasPrevistas.length)
      partesPendencia.push(`receita ainda prevista: ${res.linhasPrevistas.join(', ')}`)
    const pendenciaTexto =
      res.completo || partesPendencia.length === 0
        ? ''
        : `\n\nAtenção: ${partesPendencia.join(' e ')} — a foto registra essa pendência, declarada.`
    if (!window.confirm(base + pendenciaTexto)) return
    const r = onFecharEvento()
    if (!r.ok) window.alert(r.motivo)
  }

  // TAREFA B.1: reabrir descarta a foto (fechamentoEvento.reabrirEvento) e,
  // quando há benchmark promovido deste fechamento, o app (EventEditor) também
  // o remove — o aviso avisa os DOIS efeitos antes de perguntar.
  const confirmarReabrir = () => {
    const temBenchmark = !!evento.fechamento?.benchmarkId
    const pergunta = temBenchmark
      ? `Reabrir "${evento.nome}"? O benchmark criado deste fechamento TAMBÉM será removido da lista de comparações (um desfazer devolve os dois).`
      : `Reabrir "${evento.nome}"? A foto do fechamento será descartada — fechar de novo tira outra foto, dos números de então.`
    if (!window.confirm(pergunta)) return
    const r = onReabrirEvento()
    if (!r.ok && r.motivo) window.alert(r.motivo)
  }

  return (
    <div className="space-y-5">
      {/* Dado quebrado (Marco, 26/07/2026): com um custo que não cabe numa conta
          de dinheiro, o card "Resultado do evento" escreve "Custos R$ 0" e
          "Resultado R$ 0" — é o card que decide se a festa valeu. A faixa vem
          antes de tudo nesta aba.

          MAS ESTA ABA É A ÚNICA QUE PODE ESTAR MOSTRANDO OUTRA COISA. Numa festa
          FECHADA os números vêm da FOTOGRAFIA, e a fotografia pode ser SÃ com o
          cadastro de custos já corrompido depois (backup JSON estragado
          importado por cima). Medido em 26/07/2026: a tela imprime "Custos
          considerados − R$ 403.000" e "Resultado parcial − R$ 384.000" — certos
          — enquanto a faixa afirmava que ali estava escrito R$ 0 e mandava
          "voltar a uma cópia de segurança". Esse conselho DESTRÓI a fotografia
          correta. Por isso quem decide aqui é o `resultado` que este JSX
          RENDERIZA, não o cálculo de agora: se os dois números do card são
          dinheiro de verdade, a faixa diz que a foto vale e manda NÃO mexer.
          (Ordem oposta — corromper e só então fechar — dá foto com `custos`
          null, o card imprime R$ 0, e aí a faixa normal é a verdadeira.) */}
      {/* 05/10/2026: com a foto quebrada ou a tabela quebrada, os números que
          vêm do lixo viram "não dá para calcular" (efeito `texto`); com a foto
          sã e a tabela da foto, valem a frase e o conselho da fotografia. */}
      <AvisoCustoQuebrado
        evento={evento}
        efeito="texto"
        numeroQuebrouAqui={cardQuebrado || tabelaQuebrada}
        consequencia={fotoIntacta && !tabelaQuebrada ? CONSEQ_FOTO_INTACTA : undefined}
        conserto={fotoIntacta ? CONSERTO_NAO_MEXER : undefined}
      />
      <AvisoReceitaQuebrada evento={evento} />
      {/* Lote sem preço (P8; revisão adversarial da S7, 06/10/2026). "Fechar"
          CONGELA o público, o lucro e o mínimo do plano — sem a faixa, a festa
          seria fechada sem ninguém ver que um lote ficou de fora. Só com a
          festa ABERTA: fechada, os números desta aba são a fotografia, e uma
          foto tirada antes de 06/10/2026 ainda contava o lote como cortesia —
          a faixa diria "fica fora" de um número que o contou. */}
      {!fechado && <AvisoLoteSemPreco evento={evento} />}
      {/* TAREFA B.1: faixa de estado — só aparece com o evento fechado, e diz
          os DOIS fatos que importam: quando fechou, e que o resto da aba é a
          fotografia daquele instante. */}
      {fechado && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--borda)] bg-[var(--papel-2)] px-4 py-3 text-sm">
          <span className="text-[var(--tinta-2)]">
            <strong className="text-[var(--tinta)]">Fechado</strong> em{' '}
            {fmtData(dataLocalDoInstante(evento.fechamento.em))} — os números abaixo são a fotografia do
            fechamento.
          </span>
          <Btn onClick={confirmarReabrir}>Reabrir evento — volta a editar</Btn>
        </div>
      )}

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Receita realizada</h3>
        <p className="mb-3 text-xs text-[var(--tinta-3)]">
          Preencha depois da festa. Campos opcionais — vazios, nada muda nas previsões. A
          bilheteria realizada é comparada com a receita bruta do cenário realista
          {openBar ? '.' : '; o bar, com o lucro de bar previsto.'}
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <Field label="Bilheteria realizada (bruta)" className="w-52">
            {/* Trava do negativo (Marco, 23/07/2026 — lote de travas, item 3):
                receita BRUTA de bilheteria é dinheiro de ENTRADA, não pode ser
                negativa — faixa ≥ 0, como os custos. */}
            <MoneyInput
              aria-label="Bilheteria realizada (bruta)"
              aria-describedby={invalidos.has('bilheteria') ? 'realizado-bilheteria-invalido' : undefined}
              value={rr.bilheteria}
              onChange={(v) => setReceitaReal({ bilheteria: v })}
              faixa={FAIXA_CUSTO}
              disabled={fechado}
            />
            {avisoCampo('bilheteria')}
            <CarimboFinanceiro
              registro={evento.financeiro?.puxado?.bilheteria}
              valorAtual={rr.bilheteria}
            />
          </Field>
          {!openBar && (
            <Field label="Bar realizado (lucro líquido)" className="w-52">
              {/* SEM faixa DE PROPÓSITO (Marco, 23/07/2026 — lote de travas,
                  item 3): este é o LUCRO LÍQUIDO do bar (consumo − custos), não
                  a receita bruta. Um bar que deu prejuízo é FATO — negativo tem
                  de passar, igual aos derivados (lucro, bar líquido, benchmark)
                  que a régua da casa nunca trava. */}
              <MoneyInput
                aria-label="Bar realizado (lucro líquido)"
                aria-describedby={invalidos.has('bar') ? 'realizado-bar-invalido' : undefined}
                value={rr.bar}
                onChange={(v) => setReceitaReal({ bar: v })}
                disabled={fechado}
              />
              {avisoCampo('bar')}
            </Field>
          )}
          <Field label="Pix recebido (líquido)" className="w-52">
            <MoneyInput
              aria-label="Pix recebido (líquido)"
              value={rr.pix ?? ''}
              onChange={(v) => setReceitaReal({ pix: v })}
              faixa={FAIXA_CUSTO}
              disabled={fechado}
              aria-describedby={invalidos.has('pix') ? 'pix-fechamento-ajuda realizado-pix-invalido' : 'pix-fechamento-ajuda'}
            />
            {avisoCampo('pix')}
          </Field>
        </div>
        <p id="pix-fechamento-ajuda" className="mt-3 text-xs text-[var(--tinta-3)]">
          Pix: informe apenas o valor líquido adicional, ainda não incluído na bilheteria,
          no bar ou no patrocínio. Entra integralmente no fechamento, sem taxa, cashback
          ou imposto automático. Vazio, não soma nada.
        </p>
        {openBar && (
          <p className="mt-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
            <strong>Evento open bar — sem receita de bar:</strong> o fechamento não pede bar
            realizado e a linha de Bar fica fora da conta.
            {num(rr.bar) > 0 && (
              <>
                {' '}Há um bar realizado guardado ({fmtBRL(num(rr.bar))}) que <strong>não está
                sendo somado</strong> — ele volta a contar se você desmarcar “Open bar” na aba
                Receita.
              </>
            )}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
          Estimado × Realizado
          {/* contexto no card: um print recortado se explica sozinho */}
          <span className="text-[10px] font-normal text-[var(--tinta-3)]">
            {[evento.nome, fmtData(evento.data)].filter(Boolean).join(' · ')}
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                <th className="py-2 pr-3 font-medium">Receita</th>
                <th className="w-32 py-2 pr-3 text-right font-medium">Estimado</th>
                <th className="w-32 py-2 pr-3 text-right font-medium">Realizado</th>
                <th className="w-44 py-2 text-right font-medium">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {receita.linhas.map((l) => (
                <tr key={l.nome} className="border-b border-[var(--borda)]">
                  <td className="py-1.5 pr-3">{l.nome}</td>
                  <td className="py-1.5 pr-3 text-right tnum">{din(l.estimado, fmtBRL)}</td>
                  <td className="py-1.5 pr-3 text-right tnum">
                    {l.temRealizado ? din(l.realizado, fmtBRL) : '—'}
                  </td>
                  {/* receita: desvio NEGATIVO (vendeu menos) é o ruim */}
                  {cabemTodos(l.estimado, l.realizado, l.desvio) ? (
                    <td className={`py-1.5 text-right tnum ${tomDesvio(l.desvio, l.desvio != null && l.desvio < 0)}`}>
                      {fmtDesvio(l.desvio, l.desvioPct)}
                    </td>
                  ) : (
                    <td className="py-1.5 text-right">{NUMERO_NAO_CALCULA}</td>
                  )}
                </tr>
              ))}
            </tbody>
            <tbody>
              <tr>
                <td colSpan="4" className="pt-3 pb-1 text-left text-xs font-medium text-[var(--tinta-2)]">
                  Custos por categoria
                </td>
              </tr>
              {custos.porCategoria.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-[var(--borda)] ${c.estouro && !linhaQuebrada(c) ? FAIXA_ESTOURO : ''}`}
                >
                  <td className="py-1.5 pr-3">
                    {c.nome}
                    {/* "ESTOURO" de uma linha com estimado que não é dinheiro
                        era conclusão tirada do lixo (05/10/2026). */}
                    {c.estouro && !linhaQuebrada(c) && (
                      <span className="ml-1.5 text-[10px] font-semibold text-[var(--vermelho-texto)]">ESTOURO</span>
                    )}
                    {pendencia(c)}
                  </td>
                  {/* Coluna "Estimado" = o estimado DOS ITENS JÁ REALIZADOS
                      (fonte única: confrontoCustos.js, via fechamento.js). É o
                      que faz esta linha fechar: estimado − realizado é
                      exatamente o desvio impresso ao lado. Sem nenhum
                      realizado, não há comparação nenhuma e a coluna volta a
                      ser o orçamento da categoria. */}
                  <td className="py-1.5 pr-3 text-right tnum">{din(c.estimadoComparavel, fmtBRL)}</td>
                  <td className="py-1.5 pr-3 text-right tnum">
                    {c.temRealizado ? din(c.realizado, fmtBRL) : '—'}
                  </td>
                  {linhaQuebrada(c) ? (
                    <td className="py-1.5 text-right">{NUMERO_NAO_CALCULA}</td>
                  ) : (
                    <td className={`py-1.5 text-right tnum ${corDelta(c.desvio) || 'text-[var(--tinta-3)]'}`}>
                      {fmtDesvio(c.desvio, c.desvioPct)}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-3">
                  Total de custos
                  {pendencia(custos)}
                </td>
                <td className="py-2 pr-3 text-right tnum">{din(custos.totalEstimadoComparavel, fmtBRL)}</td>
                <td className="py-2 pr-3 text-right tnum">
                  {custos.algumRealizado ? din(custos.totalRealizado, fmtBRL) : '—'}
                </td>
                {cabemTodos(custos.totalEstimadoComparavel, custos.totalRealizado, custos.desvioTotal) ? (
                  <td className={`py-2 text-right tnum ${corDelta(custos.desvioTotal) || 'text-[var(--tinta-3)]'}`}>
                    {fmtDesvio(custos.desvioTotal, custos.desvioTotalPct)}
                  </td>
                ) : (
                  <td className="py-2 text-right">{NUMERO_NAO_CALCULA}</td>
                )}
              </tr>
              {custos.algumRealizado && (
                <tr className="text-[var(--tinta-3)]">
                  <td className="py-1.5 pr-3 text-xs">Orçamento de custos (todos os itens)</td>
                  <td className="py-1.5 pr-3 text-right text-xs tnum">{din(custos.totalEstimado, fmtBRL)}</td>
                  <td className="py-1.5 pr-3 text-right text-xs tnum">—</td>
                  <td className="py-1.5 text-right text-xs tnum">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--tinta-3)]">
          Em custos, <strong>Desvio = realizado − estimado DOS MESMOS itens</strong> — só entra na
          comparação o item que já tem realizado, senão o orçamento de quem ainda não pagou
          apareceria como economia. É a mesma conta e a mesma cor da faixa da aba Custos:
          positivo (vermelho) é estouro. Em receita, desvio = realizado − previsto, e negativo é
          vender menos que o previsto. Categorias sem nenhum realizado ficam com “—” — nenhum
          número é inventado.
        </p>
      </Card>

      {/* TAREFA A: o botão de fechar mora ACIMA do card "Resultado realizado",
          e não DENTRO dele — resultadoVivo pode ser null (nenhuma receita
          realizada informada ainda), caso em que o card abaixo nem existe, mas
          o botão continua tendo de aparecer e recusar com o motivo em
          português. Desabilitado + title é o padrão descobrível (evita o
          clique que só resulta em alerta); o alerta interno em
          confirmarFechar fica como segunda trava, para o dia em que algo
          disparar o clique mesmo assim. */}
      {!fechado && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {motivoFechamento && origemAtivaInvalida && (
            <p className="text-xs text-[var(--tinta-2)]">{motivoFechamento}</p>
          )}
          <Btn
            variant="primary"
            onClick={confirmarFechar}
            disabled={!!motivoFechamento}
            title={motivoFechamento || undefined}
          >
            Fechar evento — congela os números
          </Btn>
        </div>
      )}

      {resultado && (
        <Card className="p-4">
          {/* Título "Resultado realizado" SEMPRE (decisão do Marco 24/07): evento
              fechado é realizado — o mesmo título do card da Home/Cenários, para
              as telas não se contradizerem. O selo "realizado + previsto" abaixo
              continua sinalizando, no DETALHE, quando parte ainda entra pelo
              estimado (isso é detalhe da revisão, não contradição do título). */}
          <h3 className="mb-3 text-sm font-semibold">
            Resultado realizado
            {fechado && (
              <span className="ml-2 text-xs font-normal text-[var(--tinta-3)]">
                · fotografia de {fmtData(dataLocalDoInstante(evento.fechamento.em))}
              </span>
            )}
            {!resultado.completo && (
              <span className="ml-2 rounded bg-[var(--papel-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--tinta-2)]">
                realizado + previsto
              </span>
            )}
          </h3>
          {/* A CONTA SOMANDO NA FRENTE DE QUEM LÊ (PADRÃO DA CASA §3). Cada
              passo que mexe no número tem linha própria, em R$, na ordem em que
              a conta acontece. Passos que não existem neste evento (taxa zero,
              sem patrocínio) somem; passo que mudou o número, nunca. */}
          <div className="max-w-lg">
            <LinhaConta
              rotulo={
                resultado.bilheteriaInformada
                  ? 'Bilheteria realizada (bruta)'
                  : 'Bilheteria prevista (bruta)'
              }
              nota={resultado.bilheteriaInformada ? null : 'ainda sem realizado informado'}
              valor={dinCard(resultado.bilheteriaBruta, fmtBRL2)}
            />
            {!resultado.taxaCliente && resultado.taxa !== 0 && (
              <LinhaConta
                sinal={sinalCard(resultado.taxa, true, resultado.bilheteriaBruta)}
                rotulo={`Taxa da bilheteria (${fmtPct(num(evento.taxaBilheteria))})`}
                valor={valorCard(resultado.taxa, (v) => comSinal(v, true), resultado.bilheteriaBruta)}
                valorClass="text-[var(--tinta-2)]"
              />
            )}
            {resultado.cashback !== 0 && (
              <LinhaConta
                sinal={sinalCard(resultado.cashback, false, resultado.bilheteriaBruta)}
                rotulo={`Cashback (${fmtPct(num(evento.cashbackPct))})`}
                valor={valorCard(resultado.cashback, comSinal, resultado.bilheteriaBruta)}
              />
            )}
            {/* `!== 0` como as demais parcelas: sem ele, evento sem bar (mas
                não open bar) imprimia a linha "+ R$ 0", que é um passo que não
                mexeu no número ocupando uma linha da conta. */}
            {!openBar && resultado.bar !== 0 && (
              <LinhaConta
                sinal={sinalCard(resultado.bar, false)}
                rotulo="Bar (lucro líquido)"
                nota={resultado.barInformado ? null : 'previsto'}
                valor={valorCard(resultado.bar, comSinal)}
                valorClass={resultado.bar < 0 ? 'text-[var(--tinta-2)]' : ''}
              />
            )}
            {resultado.patrocinio !== 0 && (
              <LinhaConta
                sinal={sinalCard(resultado.patrocinio, false)}
                rotulo="Patrocínio fechado"
                nota="confirmado ou recebido"
                valor={valorCard(resultado.patrocinio, comSinal)}
              />
            )}
            {resultado.pix != null && (
              <LinhaConta
                sinal={sinalCard(resultado.pix, false)}
                rotulo="Pix recebido (líquido)"
                nota="adicional, sem descontos automáticos"
                valor={valorCard(resultado.pix, comSinal)}
              />
            )}
            <LinhaConta
              sinal="="
              rotulo="Receita do evento"
              valor={dinCard(resultado.receita, fmtBRLTotal)}
              total
            />
            {/* IMPOSTO — logo DEPOIS da receita total e ANTES dos custos, a
                mesma posição do DRE (decisão 3 do Marco, 27/07/2026: imposto é
                dedução de receita, não custo). A linha só existe quando o
                evento tem imposto configurado, e o rótulo carrega a alíquota e
                as bases: chave desligada e alíquota 0% dão o MESMO R$ 0 e
                contam histórias diferentes. */}
            {resultado.imposto && (
              <LinhaConta
                sinal={sinalCard(resultado.imposto.valor, true, resultado.receita)}
                rotulo="Imposto sobre a receita"
                nota={impostoTexto(resultado.imposto)}
                valor={valorCard(resultado.imposto.valor, (v) => comSinal(v, true), resultado.receita)}
                valorClass="text-[var(--tinta-2)]"
              />
            )}
            <LinhaConta
              sinal="−"
              rotulo="Custos considerados"
              nota={
                resultado.nSemRealizado > 0
                  ? `${din(resultado.custosRealizados, fmtBRL2)} realizado + ${din(resultado.custosPendentes, fmtBRL2)} ainda estimado`
                  : 'tudo realizado'
              }
              valor={dinCard(resultado.custos, (v) => comSinal(v, true))}
              valorClass="text-[var(--tinta-2)]"
            />
            <LinhaConta
              sinal="="
              rotulo={resultado.completo ? 'Resultado realizado' : 'Resultado parcial'}
              valor={dinCard(resultado.resultado, fmtBRLTotal)}
              valorClass={cardQuebrado ? 'text-[var(--tinta-2)]' : corResultado(resultado.resultado)}
              total
            />
          </div>
          {/* A PENDÊNCIA DECLARADA, na mesma voz da tabela acima. O card e a
              linha "Total de custos" contam a MESMA história agora: os custos
              de quem ainda não pagou entram pelo estimado dos dois lados, em vez
              de sumirem da conta e virarem lucro. */}
          {!resultado.completo && (
            <p className="mt-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
              <strong>Ainda não é o resultado final.</strong>{' '}
              {resultado.nSemRealizado > 0 && (
                <>
                  {resultado.nComRealizado} de {resultado.nItens}{' '}
                  {/* B1 (BACKLOG S4, 20/07/2026): o verbo concorda com quem tem
                      o realizado (nComRealizado), não com o total de itens
                      (nItens) — "1 de 4 itens ... já TEM", não "já TÊM". */}
                  {resultado.nComRealizado === 1 ? 'item de custo já tem' : 'itens de custo já têm'}{' '}
                  realizado;{' '}
                  {resultado.nSemRealizado === 1
                    ? '1 item ainda entra pelo estimado'
                    : `${resultado.nSemRealizado} itens ainda entram pelo estimado`}{' '}
                  ({din(resultado.custosPendentes, fmtBRL2)}).{' '}
                </>
              )}
              {(resultado.linhasPrevistas || []).length > 0 && (
                <>
                  Na receita, {resultado.linhasPrevistas.join(' e ')}{' '}
                  {resultado.linhasPrevistas.length === 1 ? 'entra' : 'entram'} pelo previsto do
                  cenário realista — ainda sem realizado informado.{' '}
                </>
              )}
              O que falta pagar <strong>continua na conta pelo orçamento</strong>: se ele saísse,
              o orçamento de quem ainda não recebeu apareceria como lucro.
            </p>
          )}
          {/* A PONTE COM OS CENÁRIOS, COM NÚMERO. Este card é PROPOSITALMENTE
              diferente da Home/Cenários — e por isso a diferença tem de estar
              dita aqui, em reais. Desconfiar de um número certo custa quase o
              mesmo que ver um errado (PADRÃO DA CASA §3). */}
          {/* Com o card quebrado não há diferença a explicar: os dois lados
              seriam número que não é dinheiro (medido 05/10/2026, Pix 1e308:
              "este card está R$ 100.000…000 acima"). */}
          {!cardQuebrado &&
            resultado.diferencaParaCenario != null &&
            Math.abs(resultado.diferencaParaCenario) >= MEIO_REAL && (
              <p className="mt-3 rounded-lg bg-[var(--papel-2)] px-3 py-2 text-xs text-[var(--tinta-2)]">
                <strong>Por que difere dos Cenários:</strong> lá o resultado do realista é{' '}
                <strong className="tnum">{fmtBRL2(resultado.lucroDoCenario)}</strong> — este card
                está{' '}
                <strong className="tnum">
                  {fmtBRL2(Math.abs(resultado.diferencaParaCenario))}
                </strong>{' '}
                {resultado.diferencaParaCenario > 0 ? 'acima' : 'abaixo'}
                <PartesDaDiferenca resultado={resultado} evento={evento} />
                {/* O fecho fala de CONTINGÊNCIA, então só aparece quando há
                    contingência. Antes ele era guardado pela reserva (que
                    inclui o ajuste), e num evento com contingência 0 e ajuste
                    de +10% a tela explicava a diferença dizendo "ninguém emite
                    nota de contingência" — nomeando o que não existia ali. */}
                {Math.abs(num(resultado.contingenciaDoCenario)) >= MEIO_REAL && (
                  <>
                    {' '}Aqui <strong>só entra dinheiro que mudou de mão</strong>: contingência é
                    reserva, não despesa — ninguém emite nota de contingência.
                  </>
                )}
              </p>
            )}
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            Conta: <strong>bilheteria líquida (− taxa + cashback) + bar + patrocínio fechado
            {resultado.pix != null ? ' + Pix líquido' : ''}
            {resultado.imposto ? ' − imposto sobre a receita' : ''} −
            custos considerados</strong>, com realizado onde ele existe e estimado/previsto no
            resto.{' '}
            {/* A BASE DO IMPOSTO É A BRUTA, dita na tela (decisão 2 do Marco) —
                não só neste comentário: sem a palavra "bruta" impressa, ninguém
                que lê a conta tem como saber que o imposto não incide sobre a
                líquida que está na linha de cima. */}
            {resultado.imposto && (
              <>
                O imposto é <strong>{impostoTexto(resultado.imposto)}</strong>, e a base da
                bilheteria é a <strong>bruta</strong> — antes da taxa e do cashback.{' '}
              </>
            )}
            {resultado.taxaCliente
              ? `A taxa da bilheteria (${fmtPct(num(evento.taxaBilheteria))}) é paga pelo cliente neste evento — ela não desconta da nossa receita e por isso não tem linha.`
              : 'A taxa é a retida pela bilheteria; o cashback é o que volta para a produção.'}{' '}
            O bar já é lucro líquido — não passa por taxa nem cashback. Patrocínio entra só
            quando está <strong>confirmado ou recebido</strong>.
            {patrocinioPorEstagio(evento).potencial > 0 && (
              <>
                {' '}Há mais {fmtOuIlegivel(patrocinioPorEstagio(evento).potencial, fmtBRL)} de patrocínio em
                negociação que <strong>não está somado</strong> aqui.
              </>
            )}{' '}
            Contingência e ajuste de cenário ficam de fora — eles vivem nas previsões, não no
            fechamento.
          </p>
        </Card>
      )}

      {/* TAREFA B.3: divergência declarada — só existe quando o evento está
          fechado E o cálculo ao vivo hoje já não bate mais com a foto
          (fórmula ou premissa mudou depois do fechamento). A foto continua
          valendo; esta é só a leitura honesta de que ela não é mais o que sai
          se recalculado agora. */}
      {/* Recalcular hoje não dá dinheiro (05/10/2026): a diferença não é de
          "fórmulas ou premissas", é de um valor do cadastro que não cabe numa
          conta — dizer o contrário mandava o Marco procurar a causa errada. */}
      {divergeDoFechamento && (origemAtivaInvalida || !cabeComoDinheiro(resultadoVivo.resultado)) && (
        <p className="text-xs text-[var(--tinta-3)]">
          Se fosse fechado hoje, não daria para calcular o resultado:{' '}
          {custosQuebrados(evento).ha ? 'um custo' : 'um valor'} do cadastro desta festa não cabe
          numa conta de dinheiro (veja o aviso no topo). Vale a fotografia.
        </p>
      )}
      {divergeDoFechamento && !origemAtivaInvalida && cabeComoDinheiro(resultadoVivo.resultado) && (
        <p className="text-xs text-[var(--tinta-3)]">
          Se fosse fechado hoje, o resultado seria{' '}
          <strong className="tnum">{fmtBRLTotal(resultadoVivo.resultado)}</strong> — fórmulas ou
          premissas mudaram desde o fechamento. Vale a fotografia; reabra e feche de novo se
          quiser atualizá-la.
        </p>
      )}

      {/* Acurácia (sugestão 23): contexto histórico da festa — leitura pura */}
      {store && <AcuraciaFechamento store={store} evento={evento} />}

      {onPromoverBenchmark && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="text-sm font-semibold">Promover a benchmark</h3>
            <p className="text-xs text-[var(--tinta-3)]">
              Cria um benchmark de comparação a partir deste evento (usa o realizado quando
              preenchido, senão o estimado). Os 4 benchmarks históricos embutidos nunca mudam.
            </p>
          </div>
          <Btn onClick={onPromoverBenchmark}>Promover a benchmark</Btn>
        </Card>
      )}
    </div>
  )
}
