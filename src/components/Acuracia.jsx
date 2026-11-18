// Acurácia das previsões (Sessão Q — sugestão 23): exibição das leituras
// puras de src/lib/acuracia.js. Duas caras:
// - AcuraciaFechamento: contexto histórico na aba Fechamento ("nos N eventos
//   fechados desta festa, A&B estoura em média +12%").
// - AcuraciaResumo: resumo na Home, por festa.
// Com poucos eventos fechados a tela DIZ isso em vez de fingir estatística
// (regra da sugestão); com zero, mensagem no lugar de números.
import { Card } from './ui.jsx'
import { AppIcon, TriangleAlert } from './AppIcon.jsx'
import { acuraciaAgregada, acuraciaContexto, fraseDesvio, fraseForaDaMedia } from '../lib/acuracia.js'

// Festa com dado quebrado fora da média (05/10/2026): a tela diz quantas e
// quais, em vez de deixá-las sumir caladas (princípio 4 do CLAUDE.md).
function AvisoFora({ fora }) {
  const frase = fraseForaDaMedia(fora)
  if (!frase) return null
  return (
    <p className="mt-2 flex items-start gap-1 text-[11px] text-[var(--ambar-texto)]">
      <AppIcon icon={TriangleAlert} size={13} className="mt-px" />
      <span>{frase}</span>
    </p>
  )
}

const pctTexto = (v) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })}%`

const tom = (v) => (v > 0 ? 'text-[var(--vermelho-texto)]' : v < 0 ? 'text-[var(--verde-texto)]' : 'text-[var(--tinta-2)]')
// bilheteria: vender MENOS que o previsto (negativo) é o ruim
const tomReceita = (v) => (v < 0 ? 'text-[var(--vermelho-texto)]' : v > 0 ? 'text-[var(--verde-texto)]' : 'text-[var(--tinta-2)]')

function AvisoPoucos({ n }) {
  if (n >= 3) return null
  return (
    <p className="mt-2 flex items-start gap-1 text-[11px] text-[var(--ambar-texto)]">
      <AppIcon icon={TriangleAlert} size={13} className="mt-px" />
      <span>
        Média baseada em {n === 1 ? 'um único evento fechado' : `só ${n} eventos fechados`} —
        leia como indício, não como padrão.
      </span>
    </p>
  )
}

function LinhasAgregado({ agregado }) {
  return (
    <ul className="space-y-1 text-sm">
      {agregado.custoTotal && (
        <li className="flex justify-between gap-3">
          <span className="text-[var(--tinta-2)]">Custo total</span>
          <span className={`tnum font-medium ${tom(agregado.custoTotal.mediaPct)}`}>
            {pctTexto(agregado.custoTotal.mediaPct)}
          </span>
        </li>
      )}
      {agregado.categorias.map((c) => (
        <li key={c.nome} className="flex justify-between gap-3">
          <span className="text-[var(--tinta-2)]">
            {c.nome} <span className="text-[10px] text-[var(--tinta-3)]">({c.n} ev.)</span>
          </span>
          <span className={`tnum font-medium ${tom(c.mediaPct)}`}>{pctTexto(c.mediaPct)}</span>
        </li>
      ))}
      {agregado.bilheteria && (
        <li className="flex justify-between gap-3 border-t border-[var(--borda)] pt-1">
          <span className="text-[var(--tinta-2)]">Bilheteria (realizada × prevista)</span>
          <span className={`tnum font-medium ${tomReceita(agregado.bilheteria.mediaPct)}`}>
            {pctTexto(agregado.bilheteria.mediaPct)}
          </span>
        </li>
      )}
    </ul>
  )
}

/** Card de contexto na aba Fechamento. */
export function AcuraciaFechamento({ store, evento }) {
  const ctx = acuraciaContexto(store.eventos, evento)
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Precisão histórica das previsões</h3>
      {ctx.nFechados === 0 ? (
        <p className="text-xs text-[var(--tinta-3)]">
          Ainda não há eventos fechados (com valores realizados preenchidos) — depois do primeiro
          fechamento, esta seção mostra quanto suas previsões costumam errar por categoria, para
          calibrar as próximas.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-[var(--tinta-3)]">
            Desvio médio (realizado × estimado) {ctx.escopo === 'tipo' ? (
              <>
                nos <strong>{ctx.n}</strong> evento(s) fechado(s) de <strong>{ctx.tipo}</strong>
              </>
            ) : (
              <>
                nos <strong>{ctx.n}</strong> evento(s) fechado(s) (todas as festas
                {(evento.tipo || '').trim() ? ` — ainda não há outro fechamento de ${evento.tipo}` : ''})
              </>
            )}{' '}
            — positivo em custo = estouro. Use para calibrar o estimado da próxima edição.
          </p>
          <LinhasAgregado agregado={ctx} />
          <AvisoPoucos n={ctx.n} />
        </>
      )}
      <AvisoFora fora={ctx.fora} />
    </Card>
  )
}

/** Resumo na Home, por festa. */
export function AcuraciaResumo({ store }) {
  const a = acuraciaAgregada(store.eventos)
  if (store.eventos.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-sm font-semibold text-[var(--tinta-2)]">
        Precisão das previsões (estimado × realizado)
      </h2>
      {a.nFechados === 0 ? (
        <p className="text-xs text-[var(--tinta-3)]">
          Ainda não há eventos fechados — preencha os valores realizados na aba Fechamento de um
          evento que já aconteceu e aqui aparece quanto as previsões costumam errar, por festa e
          por categoria.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.porTipo.map((t) => (
              <Card key={t.tipo || '(sem)'} className="p-4">
                <h3 className="mb-2 text-sm font-semibold">
                  {t.tipo || 'Sem categoria'}{' '}
                  <span className="text-xs font-normal text-[var(--tinta-3)]">
                    {t.n} fechado{t.n === 1 ? '' : 's'}
                  </span>
                </h3>
                {t.categorias.length === 0 && !t.custoTotal && !t.bilheteria ? (
                  <p className="text-xs text-[var(--tinta-3)]">
                    Evento fechado sem estimados para comparar.
                  </p>
                ) : (
                  <>
                    {t.categorias.length > 0 && (
                      <p className="mb-2 text-[11px] text-[var(--tinta-3)]">
                        {fraseDesvio(t.categorias[0].nome, t.categorias[0].mediaPct)}.
                      </p>
                    )}
                    <LinhasAgregado agregado={t} />
                    <AvisoPoucos n={t.n} />
                  </>
                )}
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--tinta-3)]">
            Leitura derivada dos fechamentos (nada é gravado): média simples do desvio % por
            evento fechado; categoria só entra quando tem realizado e estimado. O desvio é
            sempre contra o <strong>estimado dos mesmos itens</strong> que já têm realizado — a
            mesma conta das abas Custos e Fechamento. Detalhe por evento: aba Fechamento.
          </p>
        </>
      )}
      <AvisoFora fora={a.fora} />
    </section>
  )
}
