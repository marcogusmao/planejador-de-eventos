// A tela que DIZ o que a restauração corrigiu — a metade "mostrar" da decisão
// 18 do Marco (25/07/2026: "corrigir E mostrar").
//
// Ela aparece no lugar do conteúdo do modal de Proteção de dados quando um
// instantâneo guardado traz valores que o app hoje recusa. Não é um aviso
// genérico: lista quais campos, em quais previsões, de que valor para qual, e
// quanto dinheiro isso move — o mesmo desenho que o princípio 7 já exige para
// dado que vem de fora (revisão item a item, cópia de segurança antes,
// desfazer visível na própria tela, botão que diz a ação E o efeito).
//
// Componente PURO de exibição: nenhuma conta acontece aqui. Tudo já vem pronto
// de src/lib/revisaoRestauracao.js — este arquivo só escolhe entre R$ e %,
// conforme o `formato` que cada linha declara.

import { Btn } from './ui.jsx'
import { fmtBRL, fmtPct } from '../lib/format.js'

const valorTexto = (v, formato) => (formato === 'percentual' ? fmtPct(v) : fmtBRL(v))

function ListaDeCorrecoes({ correcoes, titulo }) {
  if (correcoes.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-[var(--tinta-2)]">
        {titulo} ({correcoes.length})
      </h4>
      <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
        {correcoes.map((c, i) => (
          <li key={`${c.evento}-${c.campo}-${i}`} className="px-3 py-2.5">
            <div className="text-sm text-[var(--tinta)]">
              <span className="font-medium">{c.evento}</span>
              <span className="text-[var(--tinta-3)]"> — </span>
              {c.oQueMudou}
              <span className="text-[var(--tinta-3)]"> → </span>
              <span className="font-medium">{c.para}</span>
            </div>
            {/* O microtexto ao lado do número, como a casa faz: "não informado"
                sem explicação é lido como "virou zero", e os dois casos da
                migração terminam diferente na conta. */}
            <div className="mt-0.5 text-xs text-[var(--tinta-3)]">{c.explicacao}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ListaDeEfeitos({ efeitos, titulo, mostrarDepois = true }) {
  if (efeitos.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-[var(--tinta-2)]">{titulo}</h4>
      <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)]">
        {efeitos.map((ef, i) => (
          <li key={`${ef.evento}-${i}`} className="px-3 py-2.5">
            <div className="text-sm font-medium text-[var(--tinta)]">{ef.evento}</div>
            {ef.erro ? (
              <div className="mt-1 text-xs text-[var(--ambar-texto)]">{ef.erro}</div>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {ef.linhas.map((l) => (
                  <li key={l.label} className="text-sm text-[var(--tinta-2)]">
                    {l.label}:{' '}
                    {/* O riscado significa "este valor foi substituído". Na
                        leitura do que foi salvo NÃO há substituição nenhuma —
                        aquele número é o assunto da tela, e riscá-lo diria uma
                        coisa que não aconteceu. Lá quem avisa é a tarja. */}
                    <span
                      className={
                        mostrarDepois
                          ? 'text-[var(--tinta-3)] line-through'
                          : 'font-medium text-[var(--tinta)]'
                      }
                    >
                      {valorTexto(l.antes, l.formato)}
                    </span>
                    {mostrarDepois && (
                      <>
                        <span className="text-[var(--tinta-3)]"> → </span>
                        <span className="font-medium text-[var(--tinta)]">
                          {valorTexto(l.depois, l.formato)}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * @param revisao   o retorno de revisarRestauracao (lib) — já pronto
 * @param quando    texto da data da versão ("21/07 10:00")
 * @param onAplicar aplica as correções e restaura
 * @param onCancelar não restaura nada
 */
export default function RevisaoRestauracao({ revisao, quando, onAplicar, onCancelar, verCru, onVerCru }) {
  const n = revisao.correcoes.length
  const rotuloAplicar =
    n === 0
      ? 'Corrigir os números e restaurar'
      : n === 1
        ? 'Aplicar 1 correção e restaurar'
        : `Aplicar ${n} correções e restaurar`

  if (verCru) {
    return (
      <div>
        {/* Tarja de alerta: aqui o Marco está olhando números que já foram
            mostrados como certos e não eram. Dizer isso é o ponto da tela. */}
        <div className="mb-4 rounded-lg border border-[var(--tarja-alerta-borda)] bg-[var(--tarja-alerta-fundo)] px-3 py-2 text-sm text-[var(--vermelho-texto)]">
          Estes são os números <strong>como foram salvos</strong>, sem correção. A conta daquela
          época estava errada: o app aceitava valores que hoje ele recusa. Não decida uma festa por
          esta tela.
        </div>

        <h3 className="text-sm font-semibold text-[var(--tinta)]">
          A versão de {quando}, exatamente como foi salva
        </h3>

        {/* Aqui nada foi corrigido — o título diz o que estas linhas são nesta
            tela: os valores que o app de hoje recusa, ainda em pé. */}
        <ListaDeCorrecoes correcoes={revisao.correcoes} titulo="O que o app hoje recusa" />
        <ListaDeEfeitos
          efeitos={revisao.efeitos}
          titulo="Os números como estavam guardados"
          mostrarDepois={false}
        />

        <p className="mt-4 text-xs text-[var(--tinta-2)]">
          Esta tela é uma <strong>leitura</strong>: os números de como foi salvo não entram no app.
          Se entrassem, a próxima abertura os corrigiria sozinha e o número mudaria na sua frente,
          sem nada explicar — que é exatamente o defeito que esta tela existe para tirar.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--borda)] pt-4">
          <Btn variant="ghost" onClick={() => onVerCru(false)}>
            Voltar à revisão
          </Btn>
          <Btn variant="primary" onClick={onAplicar}>
            {rotuloAplicar}
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--tinta)]">
        A versão de {quando} foi salva antes de uma correção do app
      </h3>
      <p className="mt-1 text-sm text-[var(--tinta-2)]">
        Ela guarda valores que o app hoje recusa. Restaurando com as correções, os números ficam
        certos. Abaixo está tudo o que muda — nada é aplicado até você clicar.
      </p>

      <ListaDeCorrecoes correcoes={revisao.correcoes} titulo="O que será corrigido" />
      <ListaDeEfeitos efeitos={revisao.efeitos} titulo="O efeito nos números" />

      <p className="mt-4 text-xs text-[var(--tinta-2)]">
        A versão continua guardada na lista <strong>exatamente como foi salva</strong> — corrigir
        aqui não a altera, e dá para restaurá-la de novo quando quiser. O estado de agora já foi
        guardado como cópia de segurança em Versões automáticas, então também dá para voltar.
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--borda)] pt-4">
        <Btn variant="ghost" onClick={onCancelar}>
          Cancelar — não restaurar nada
        </Btn>
        <Btn onClick={() => onVerCru(true)}>Ver como foi salvo, sem corrigir</Btn>
        <Btn variant="primary" onClick={onAplicar}>
          {rotuloAplicar}
        </Btn>
      </div>
    </div>
  )
}
