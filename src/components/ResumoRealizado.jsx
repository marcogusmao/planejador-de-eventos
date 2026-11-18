// Corpo do card de evento REALIZADO (mockup aprovado pelo Marco, 24/07/2026):
// Resultado realizado (herói) + tabela Estimado × Realizado × Desvio
// (Receita · Custo · Lucro · Margem). SEM cabeçalho e SEM wrapper de card — cada
// superfície (card da Home, aba Cenários do editor) põe o seu próprio header em
// volta, e este corpo fica idêntico nos dois.
//
// NENHUM número é calculado aqui: as DUAS colunas vêm prontas de
// `resultadoRealizado()` (src/lib/fechamento.js) — `real.*` é o realizado e
// `real.estimado.*` é o estimado. Os desvios são só a diferença de exibição
// (realizado − estimado). Componente não faz conta; chama o módulo.
//
// A COLUNA "ESTIMADO" É O ORÇAMENTO (Marco, 27/07/2026). Antes ela vinha do
// cenário realista, que soma o REALIZADO onde ele já existe — então num evento
// fechado, com quase tudo lançado, o card comparava o realizado contra ele
// mesmo e imprimia desvio zero. No evento do Marco isso escondia +R$ 69.820
// (+25,1%) de estouro. A régua de hoje é a MESMA da aba Fechamento: o estimado
// é a soma do que ele digitou, e o realizado não entra nessa coluna. O porquê,
// com os números medidos, está em `resultadoRealizado()`; a evidência
// executável em `estimadoEhOOrcamento.evidencia.test.js`.
//
// TÍTULO SEMPRE "Resultado realizado" (decisão do Marco 24/07): evento fechado é
// realizado — o mesmo título das três telas (Home, Cenários, aba Fechamento), pra
// não se contradizerem. `real.completo` NÃO é lido aqui de propósito; a distinção
// "quanto ainda entra pelo estimado" mora no DETALHE da aba Fechamento (selo
// "realizado + previsto"), não neste card compacto.
//
// O IMPOSTO NESTE CARD (Marco, 27/07/2026 — o mesmo desenho do DRE).
//
// Sem esta linha o app mostrava DOIS lucros para a mesma festa, um ao lado do
// outro na MESMA rolagem da aba Cenários: o card do cenário realista dizia
// R$ 7.900, com "Imposto − R$ 1.300" impresso logo acima, e este card dizia
// R$ 9,5 mil com "+R$ 0 acima do estimado". Achado da revisão cética antes de
// o Marco ver a tela. Os números vêm PRONTOS de `resultadoRealizado()`:
// `real.imposto` é o descritor do realizado e `real.estimado.imposto` o do
// cenário — componente não faz conta.
import { impostoTexto } from '../lib/imposto.js'
import { fmtCompact, fmtPct } from '../lib/format.js'

const lucroTone = (v) => (v >= 0 ? 'text-[var(--verde-texto)]' : 'text-[var(--vermelho-texto)]')

// Dinheiro que pode não existir: sem número, "—". NUNCA cair em zero — um
// traço diz "não sei", um R$ 0 é uma afirmação, e afirmar 0 sem dado é o
// número errado exibido como certo (princípio 4: nada falha em silêncio).
const fmtOuTraco = (v) => (v == null ? '—' : fmtCompact(v))

// Desvio em "mil" (a coluna já diz que é dinheiro): +14 = +R$ 14 mil.
const desvMil = (v) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) / 1000)}`
// Desvio de dinheiro entre duas pontas que podem faltar — some junto com elas.
const desvMilDe = (a, b) => (a == null || b == null ? '—' : desvMil(a - b))
const desvPt = (a, b) => {
  if (a == null || b == null) return '—'
  const d = Math.round(a) - Math.round(b)
  return `${d >= 0 ? '+' : '−'}${Math.abs(d)}pt`
}

export function ResumoRealizado({ real }) {
  // `?? {}` é cinto para uma FOTO de fechamento antiga (gravada antes de
  // 27/07/2026) chegar aqui um dia: sem o bloco, a coluna inteira sai "—" em vez
  // de derrubar a tela — e, principalmente, em vez de voltar calada ao número
  // velho. Hoje as duas telas que montam este card (Home, aba Cenários) sempre
  // passam o cálculo AO VIVO, então o bloco existe sempre.
  const est = real.estimado ?? {}
  const desvio = est.lucro == null ? null : real.resultado - est.lucro
  const margemReal = real.receita > 0 ? (real.resultado / real.receita) * 100 : null

  // A LINHA DE IMPOSTO só existe quando o evento tem imposto configurado — em
  // algum dos dois lados. Evento sem imposto (e foto gravada antes de
  // 27/07/2026) mostra a tabela de quatro linhas de sempre, sem um "R$ 0" que
  // não conta história nenhuma.
  const impReal = real.imposto ?? null
  const impEst = est.imposto ?? null
  const temImpostoNaTabela = impReal != null || impEst != null
  // Cenário SEM descritor mas COM lucro estimado = cenário cujo imposto é
  // realmente zero → "R$ 0". Sem cenário nenhum (est.lucro null) → "—", nunca
  // um zero afirmado sem dado.
  const impostoEstimado = impEst ? impEst.valor : est.lucro == null ? null : 0

  const linhas = [
    { l: 'Receita', e: fmtOuTraco(est.receita), r: fmtCompact(real.receita), d: desvMilDe(real.receita, est.receita) },
    ...(temImpostoNaTabela
      ? [
          {
            l: 'Imposto',
            e: fmtOuTraco(impostoEstimado),
            r: fmtCompact(impReal ? impReal.valor : 0),
            d: desvMilDe(impReal ? impReal.valor : 0, impostoEstimado),
          },
        ]
      : []),
    { l: 'Custo', e: fmtOuTraco(est.custos), r: fmtCompact(real.custos), d: desvMilDe(real.custos, est.custos) },
    { l: 'Lucro', e: fmtOuTraco(est.lucro), r: fmtCompact(real.resultado), d: desvio == null ? '—' : desvMil(desvio), hero: true },
    { l: 'Margem', e: fmtPct(est.margem), r: fmtPct(margemReal), d: desvPt(margemReal, est.margem) },
  ]
  return (
    <>
      {/* herói: o resultado realizado, com o estimado e o desvio ao lado */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          {/* o card só aparece para evento FECHADO, que é realizado por
              definição — o resultado é o número congelado do fechamento. A
              distinção "parcial/até agora" é da aba Fechamento (evento aberto
              sendo preenchido), não aqui. */}
          <div className="text-xs text-[var(--tinta-2)]">Resultado realizado</div>
          <div className={`tnum text-2xl font-semibold ${lucroTone(real.resultado)}`}>
            {fmtCompact(real.resultado)}
          </div>
        </div>
        <div className="text-right text-[var(--tinta-3)]">
          <div className="text-[11px]">vs. estimado {fmtOuTraco(est.lucro)}</div>
          {desvio != null && (
            <div className="text-xs font-medium text-[var(--tinta-2)]">
              {desvio >= 0 ? '+' : '−'}
              {fmtCompact(Math.abs(desvio))} {desvio >= 0 ? 'acima' : 'abaixo'}
            </div>
          )}
        </div>
      </div>

      {/* tabela Estimado × Realizado × Desvio */}
      <div className="mt-3 overflow-hidden rounded-lg border border-[var(--borda)]">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-5 bg-[var(--papel-2)] px-3 py-1.5 text-[11px] text-[var(--tinta-3)]">
          <span />
          <span className="text-right">Estimado</span>
          <span className="text-right">Realizado</span>
          <span className="text-right">Desvio</span>
        </div>
        {linhas.map((row, i) => (
          <div
            key={row.l}
            className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-5 px-3 py-2 text-sm ${
              i > 0 ? 'border-t border-[var(--borda)]' : ''
            } ${row.hero ? 'bg-[var(--papel-2)]' : ''}`}
          >
            <span className={row.hero ? 'font-medium text-[var(--tinta)]' : 'text-[var(--tinta-2)]'}>
              {row.l}
            </span>
            <span className="tnum text-right text-[var(--tinta-2)]">{row.e}</span>
            <span className="tnum text-right font-medium text-[var(--tinta)]">{row.r}</span>
            <span className="tnum text-right text-[11px] text-[var(--tinta-3)]">{row.d}</span>
          </div>
        ))}
      </div>

      {/* A RÉGUA DITA NA TELA. Sem esta frase o leitor não tem como saber que a
          coluna Estimado ignora o realizado — e é justamente a leitura que o
          card errava antes. Mesma linguagem da aba Fechamento, de propósito. */}
      <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
        <strong>Estimado</strong> = o orçamento digitado (a soma dos valores estimados de todos os
        itens de custo) e a receita do cenário realista — o realizado lançado <strong>não entra</strong>{' '}
        nesta coluna. É a mesma régua da aba Fechamento. Contingência e ajuste de cenário ficam de
        fora dos dois lados: reserva é previsão, não despesa.
        {/* O IMPOSTO DITO NA TELA, com a alíquota e as bases. Este rodapé existe
            justamente para nomear o que entra e o que fica de fora de cada
            coluna; um imposto descontado em silêncio seria a linha que faltava
            na frase que promete não deixar nada de fora. */}
        {temImpostoNaTabela && (
          <>
            {' '}O <strong>imposto</strong> é descontado nas duas colunas, como no DRE
            {impReal ? <> ({impostoTexto(impReal)})</> : null} — no realizado ele incide sobre a
            receita realizada, no estimado sobre a prevista do cenário.
          </>
        )}
      </p>
    </>
  )
}
