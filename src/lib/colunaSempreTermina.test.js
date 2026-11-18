// A COLUNA SEMPRE TERMINA — terminação é comportamento, e aqui ela é cobrada
// com relógio.
//
// De onde este teste nasceu: rodada 6 da bateria de mutação (28/07/2026). A
// troca de UM caractere em `comparacaoCustos.js:232` — `porFracaoDesc.length
// > 0` virando `>= 0` — faz o `while` do ramo SOBRA nunca terminar quando a
// fila de elegíveis está VAZIA com resto positivo, e a suíte inteira passava
// verde: nenhum teste chegava nesse estado. O estado entra pela função
// EXPORTADA (`colunaCustoPrevisao`) com dinheiro limpo de duas casas — R$ 0,70
// de total com R$ 0,30 de contingência e itens zerados já bastam — e a região
// divergente é um retângulo contínuo (12,47% da grade 0..R$ 3,00 medida em
// milésimos), não um gume de ponto flutuante. Pela cadeia de produção
// (`computeCenarios`) o estado é inalcançável hoje (provado por três agentes
// independentes: `somaCentavos` força `custoItens` a múltiplo exato de
// centavo, e daí alvo = 0 com fila vazia) — mas o comentário da rede de
// segurança do próprio módulo (linhas 260-264) manda cobrar assim mesmo: a
// coluna fechar "não pode depender de 'na prática isto não acontece'".
//
// POR QUE PROCESSO FILHO COM RELÓGIO: um laço infinito síncrono não respeita
// timeout de teste (nunca devolve o event loop). Rodando a chamada num filho
// e matando-o pelo relógio, uma regressão vira UM teste vermelho em segundos
// — a suíte termina e a bateria de mutação registra MORTA, nunca ERRO de
// tempo esgotado.
//
// RÉGUA DO RELÓGIO (lição da casa sobre teste que falha por CARGA): a chamada
// real custa < 1 ms e o filho inteiro ~70-200 ms; o relógio de 15 s é ~100×
// isso, e o timeout declarado de 120 s segue o padrão das varreduras pesadas
// deste módulo. Não encolha o relógio para caber no cronômetro.

import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'

const MODULO_URL = new URL('./comparacaoCustos.js', import.meta.url).href
const RELOGIO_MS = 15_000

/**
 * Roda `colunaCustoPrevisao` sobre os casos num processo filho e devolve como
 * ele morreu. `signal === 'SIGKILL'` quer dizer: o relógio estourou — a coluna
 * NÃO terminou.
 */
function rodarNoFilho(casos) {
  const codigo = `
    const m = await import(${JSON.stringify(MODULO_URL)})
    const casos = ${JSON.stringify(casos)}
    for (const c of casos) {
      const col = m.colunaCustoPrevisao(c.cenario, () => c.valorPorCategoria)
      const soma = m.somaColunaExibida(col)
      if (soma !== col.total) {
        console.error('coluna nao fechou em "' + c.nome + '": soma ' + soma + ' != total ' + col.total)
        process.exit(2)
      }
    }
    process.exit(0)
  `
  return new Promise((resolve) => {
    const t0 = Date.now()
    const filho = spawn(process.execPath, ['--input-type=module', '-e', codigo], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    filho.stderr.on('data', (d) => (stderr += d))
    const relogio = setTimeout(() => filho.kill('SIGKILL'), RELOGIO_MS)
    filho.on('exit', (code, signal) => {
      clearTimeout(relogio)
      resolve({ code, signal, stderr, ms: Date.now() - t0 })
    })
  })
}

describe('a coluna da comparação sempre TERMINA de fechar (mutação 28/07/2026, comparacaoCustos.js:232)', () => {
  it(
    'fila de elegíveis VAZIA com resto positivo: termina e fecha pelo absorvedor — dois pontos de dentro da região que travava o mutante',
    async () => {
      const r = await rodarNoFilho([
        {
          nome: 'R$ 0,70 total · R$ 0,30 contingência · itens zerados',
          cenario: { custoItens: 0, contingencia: 0.3, custoTotal: 0.7 },
          valorPorCategoria: 0,
        },
        {
          nome: 'R$ 1,50 total · R$ 1,20 contingência · itens zerados',
          cenario: { custoItens: 0, contingencia: 1.2, custoTotal: 1.5 },
          valorPorCategoria: 0,
        },
      ])
      expect(
        r.signal,
        `colunaCustoPrevisao NÃO terminou em ${RELOGIO_MS / 1000}s com a fila de elegíveis vazia — ` +
          'a coluna trava em vez de fechar pela rede de segurança do absorvedor'
      ).toBeNull()
      expect(r.code, r.stderr).toBe(0)
    },
    120_000
  )

  it(
    'ramo SOBRA com itens de verdade (oito linhas de R$ 0,99, resíduo maior que a fila): termina e fecha',
    async () => {
      const r = await rodarNoFilho([
        {
          nome: 'oito linhas de R$ 0,99 — a cabeça da fila recebe piso+2',
          cenario: { custoItens: 7.92, contingencia: 0.49, custoTotal: 8.899 },
          valorPorCategoria: 0.99,
        },
      ])
      expect(
        r.signal,
        `colunaCustoPrevisao NÃO terminou em ${RELOGIO_MS / 1000}s no ramo SOBRA — ` +
          'a volta completa da fila deixou de andar'
      ).toBeNull()
      expect(r.code, r.stderr).toBe(0)
    },
    120_000
  )
})
