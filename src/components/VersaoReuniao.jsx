// Versão de reunião (Sessão Q — sugestão 24): congelar a previsão com nome e
// data e comparar depois com o estado atual. Toda a mecânica (storage em
// chave própria, comparação pura) mora em src/lib/versaoReuniao.js — este
// componente só exibe. A lista completa (com excluir) fica na Proteção de
// dados; congelar NÃO altera nenhum dado do evento.
import { useState } from 'react'
import { Btn, Card, Select, Bola } from './ui.jsx'
import {
  loadCongeladas,
  congelarVersao,
  congeladasDoEvento,
  resumoComparacao,
} from '../lib/versaoReuniao.js'
import { VEREDITO_CORES } from './Veredito.jsx'
import { fmtBRL, fmtData } from '../lib/format.js'
import { LIMIAR_ZERO, sinalDelta, sinalResultado } from '../lib/confrontoCustos.js'

const quando = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fmtData(iso.slice(0, 10))} ${hh}:${mm}`
}

// ————— o delta desta tela usa o LIMIAR ÚNICO da casa —————
//
// ACHADO (verificação adversarial da reordenação, rodada 2, 20/07/2026): aqui
// morava a ÚLTIMA cópia da decisão de sinal que comparava com ZERO EXATO
// (`v === 0`). Dinheiro tem duas casas, mas as somas do app são ponto
// flutuante e não são associativas: mudar a ORDEM dos lotes com um clique de
// seta produz resíduos da ordem de 1,4 × 10⁻¹¹ (medido). Com `=== 0`, um
// resíduo desses deixa de ser travessão cinza e vira "+ R$ 0" PINTADO DE VERDE
// — numa tela cujo trabalho é ser projetada numa reunião de sócias, ao lado de
// quatro linhas que corretamente mostram travessão. Anunciar mudança onde não
// houve mudança é da família "número certo levando à leitura errada".
//
// `LIMIAR_ZERO` (meio centavo) é o mesmo que Custos e Fechamento já usam via
// `sinalDelta`/`sinalResultado`. Nenhuma conta muda: só a régua de "isto é
// zero", que agora é uma só no app inteiro.
const fmtDelta = (v) =>
  v == null || Math.abs(v) < LIMIAR_ZERO ? '—' : `${v > 0 ? '+' : '−'} ${fmtBRL(Math.abs(v))}`

/**
 * A COR do delta de uma linha. Custo se lê com a régua invertida (gastar mais
 * é ruim), o resto com a régua do resultado (mais é bom) — e as duas réguas
 * vêm de `confrontoCustos.js`, não de um `> 0` escrito aqui. Exportada para o
 * teste poder cobrar as duas coisas de uma vez: neutro abaixo do limiar e cor
 * certa acima dele.
 *
 * IMPOSTO LÊ-SE COM A RÉGUA DO CUSTO (Marco, 27/07/2026): pagar mais imposto é
 * ruim. Sem esta linha, a chegada da linha de imposto a esta tabela pintaria
 * de VERDE um aumento de R$ 35 mil de tributo, na tela que é projetada na
 * reunião das sócias — verde é a cor do resultado bom nesta casa
 * (LINGUAGEM-DE-COR.md), e um imposto que cresce nunca é um resultado bom.
 */
export const classeDelta = (label, delta) => {
  const texto = String(label || '')
  const custo = texto.startsWith('Custo') || texto.startsWith('Imposto')
  const sinal = custo ? sinalDelta(delta) : sinalResultado(delta)
  if (sinal === 'neutro') return 'text-[var(--tinta-3)]'
  return sinal === 'estouro' || sinal === 'prejuizo'
    ? 'text-[var(--vermelho-texto)]'
    : 'text-[var(--verde-texto)]'
}

export { fmtDelta }

export default function VersaoReuniao({ evento }) {
  const [congeladas, setCongeladas] = useState(loadCongeladas)
  const [selecionadaId, setSelecionadaId] = useState('')
  const [erro, setErro] = useState(null)

  const doEvento = congeladasDoEvento(congeladas, evento.id)
  const selecionada = doEvento.find((c) => c.id === selecionadaId) || doEvento[0] || null
  const resumo = selecionada ? resumoComparacao(selecionada.evento, evento) : null

  const congelar = () => {
    const sugestao = `reunião de ${new Date().toLocaleDateString('pt-BR')}`
    const nome = window.prompt(
      'Nome desta versão congelada (ex.: "levada à reunião das sócias"):',
      sugestao
    )
    if (nome == null) return // cancelou
    const r = congelarVersao(evento, nome)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setErro(null)
    setCongeladas(r.lista)
    setSelecionadaId(r.item.id)
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          Versão de reunião
          {/* contexto no card: um print recortado se explica sozinho */}
          <span className="text-[10px] font-normal text-[var(--tinta-3)]">
            {[evento.nome, fmtData(evento.data)].filter(Boolean).join(' · ')}
          </span>
        </h3>
        {doEvento.length > 0 && (
          <div className="w-72">
            <Select
              value={selecionada?.id || ''}
              onChange={(e) => setSelecionadaId(e.target.value)}
              options={doEvento.map((c) => ({
                value: c.id,
                label: `${c.rotulo} — ${quando(c.criadoEm)}`,
              }))}
            />
          </div>
        )}
        <Btn
          className="ml-auto"
          onClick={congelar}
          title="Guarda uma cópia deste evento com nome e data, em espaço separado — nada no evento muda. A lista completa (com excluir) fica na Proteção de dados."
        >
          Congelar esta versão…
        </Btn>
      </div>

      {/* B3 (BACKLOG S4): tarja de alerta tema-aware — bg-red-50/text-red-700
          fixos somem no tema escuro (viram barra clara sobre o papel escuro). */}
      {erro && (
        <p className="mb-3 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-xs text-[var(--vermelho-texto)]">
          {erro}
        </p>
      )}

      {doEvento.length === 0 ? (
        <p className="text-xs text-[var(--tinta-3)]">
          Congele a versão que vai para a reunião: depois, quando os números mudarem, esta seção
          mostra a comparação congelada × atual (lucros por cenário, receita, custo e semáforo).
          Nada no evento muda ao congelar; as versões ficam listadas na Proteção de dados.
        </p>
      ) : (
        resumo && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--borda)] text-left text-xs text-[var(--tinta-2)]">
                    <th className="py-2 pr-3 font-medium">Linha</th>
                    <th className="w-36 py-2 pr-3 text-right font-medium">
                      Congelada ({quando(selecionada.criadoEm)})
                    </th>
                    <th className="w-32 py-2 pr-3 text-right font-medium">Atual</th>
                    <th className="w-32 py-2 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.linhas.map((l) => (
                    <tr key={l.label} className="border-b border-[var(--borda)]">
                      <td className="py-1.5 pr-3 text-[var(--tinta-2)]">{l.label}</td>
                      <td className="py-1.5 pr-3 text-right tnum">{fmtBRL(l.antes)}</td>
                      <td className="py-1.5 pr-3 text-right tnum font-medium">{fmtBRL(l.agora)}</td>
                      <td className={`py-1.5 text-right tnum ${classeDelta(l.label, l.delta)}`}>
                        {fmtDelta(l.delta)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 pr-3 text-[var(--tinta-2)]">Semáforo</td>
                    <td className="py-1.5 pr-3 text-right">
                      <Bola
                        cor={VEREDITO_CORES[resumo.semaforo.antes.cor].bola}
                        size={14}
                        title={`Semáforo congelado: ${resumo.semaforo.antes.cor}`}
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      <Bola
                        cor={VEREDITO_CORES[resumo.semaforo.agora.cor].bola}
                        size={14}
                        title={`Semáforo atual: ${resumo.semaforo.agora.cor}`}
                      />
                    </td>
                    <td className="py-1.5 text-right text-xs text-[var(--tinta-3)]">
                      {resumo.semaforo.antes.cor === resumo.semaforo.agora.cor
                        ? 'sem mudança'
                        : `${resumo.semaforo.antes.cor} → ${resumo.semaforo.agora.cor}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-[var(--tinta-3)]">
              “{selecionada.rotulo}” congelada em {quando(selecionada.criadoEm)} — cópia completa
              daquele momento, em espaço separado; em custos, diferença positiva (vermelho) é
              custo maior que o congelado. Excluir versões: Proteção de dados.
            </p>
          </>
        )
      )}
    </Card>
  )
}
