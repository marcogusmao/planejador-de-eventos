// A BATERIA DE MUTAÇÃO SABE O QUE FAZER COM UM MUTANTE QUE TRAVA A SUÍTE?
//
// POR QUE ESTE TESTE EXISTE (05/10/2026). O workflow "Mutação (semanal)" saiu
// vermelho toda segunda desde 30/08/2026 com "A RODADA NÃO MEDIU" (código 1).
// A causa era um ponto só: `comparacaoCustos.js:232`, 1º `>` → `>=`, em
// `while (restante > 0 && …)`, vira laço infinito síncrono; a suíte batia no
// teto de 300 s e `rodarSuite` devolvia ERRO, que dá código 1. O Marco decidiu
// em 12/08/2026, por questionário, que esse caso conta como
// MORTA-POR-TRAVAMENTO — desde que o canário limpo tenha passado na mesma
// rodada. A decisão ficou dois meses sem código.
//
// O QUE ESTE TESTE MORDE:
//   · ERRO com tempo esgotado, canário verde e teto ≥ 2× o canário → MORTA,
//     rótulo MORTA-POR-TRAVAMENTO, e a coluna do teste diz que a suíte travou;
//   · teto < 2× o canário → continua ERRO (pode ser só suíte lenta);
//   · tempo esgotado NO CANÁRIO → a rodada não mede, e nada vira morta;
//   · ERRO sem tempo esgotado (ambiente) → continua ERRO;
//   · e, com processo de verdade, que o teto mata o GRUPO: um neto que trava
//     não sobrevive ao avô (o defeito dos órfãos de 30/08/2026).
//
// O QUE ELE NÃO PROVA: que a régua de 2× é a certa para o runner do GitHub.
// Isso é medição de CI, e a próxima rodada agendada é quem responde.
import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  executarComTeto,
  rodarSuite,
  rodarCanario,
  classificarTravamento,
  medirPonto,
  FATOR_MINIMO_TETO_SOBRE_CANARIO,
} from '../../scripts/mutacao.mjs'

const calado = () => {}

// Resultados no formato que `rodarSuite` devolve, sem rodar suíte nenhuma.
const travou = (tetoS = 300) => ({
  estado: 'ERRO',
  motivo: `a suíte nem chegou a terminar: tempo esgotado (${tetoS}s). Isso é falha de INFRAESTRUTURA — não conta como mutação morta.`,
  primeiroTesteQueFalhou: null,
  totalTestes: null,
  tempoEsgotado: true,
  duracaoMs: tetoS * 1000,
})
const limpo = (duracaoMs) => ({
  estado: 'SOBREVIVEU',
  motivo: null,
  primeiroTesteQueFalhou: null,
  totalTestes: 2916,
  tempoEsgotado: false,
  duracaoMs,
})
const semAmbiente = () => ({
  estado: 'ERRO',
  motivo: 'o comando `npx vitest` não foi encontrado (status 127) — falha de INFRAESTRUTURA.',
  primeiroTesteQueFalhou: null,
  totalTestes: null,
  tempoEsgotado: false,
  duracaoMs: 50,
})

// Um "rodar" falso que devolve a fila de resultados, um por chamada.
const fila = (...resultados) => {
  const pendentes = [...resultados]
  return async () => pendentes.shift()
}

describe('classificarTravamento — a decisão do Marco de 12/08/2026', () => {
  it('a régua é 2× (o comentário do script explica a conta; mudar o número é mudar a régua)', () => {
    expect(FATOR_MINIMO_TETO_SOBRE_CANARIO).toBe(2)
  })

  it('(a) tempo esgotado DEPOIS de canário verde, teto ≥ 2× canário → MORTA-POR-TRAVAMENTO', async () => {
    const canario = await rodarCanario('/x', fila(limpo(128_000), limpo(126_000)), calado)
    expect(canario.erroGlobal).toBeNull()
    expect(canario.duracaoCanarioMs).toBe(128_000) // o MAIS LENTO dos dois fusos

    const r = await medirPonto('/x', 2916, canario, { rodar: fila(travou(300)), tetoMs: 300_000, escrever: calado })
    expect(r.estado).toBe('MORTA')
    expect(r.rotulo).toBe('MORTA-POR-TRAVAMENTO')
    expect(r.motivo).toBeNull()
    expect(r.primeiroTesteQueFalhou).toContain('não terminou em 300 s')
    expect(r.primeiroTesteQueFalhou).toContain('canário limpo terminou em 128.0 s')
    expect(r.fusoDoVeredito).toBe('UTC')
  })

  it('(a) também quando sobreviveu em UTC e TRAVOU só na confirmação em São Paulo', async () => {
    const canario = { erroGlobal: null, totalTestesBase: 2916, duracaoCanarioMs: 128_000 }
    const r = await medirPonto('/x', 2916, canario, {
      rodar: fila(limpo(130_000), travou(300)),
      tetoMs: 300_000,
      escrever: calado,
    })
    expect(r.rotulo).toBe('MORTA-POR-TRAVAMENTO')
    expect(r.fusoDoVeredito).toBe('America/Sao_Paulo')
  })

  it('(b) mesmo travamento, mas teto < 2× canário → continua ERRO, dizendo por quê', async () => {
    // 300 s de teto contra canário de 151 s = 1,99×: um fio abaixo da régua.
    const canario = { erroGlobal: null, totalTestesBase: 2916, duracaoCanarioMs: 151_000 }
    const r = await medirPonto('/x', 2916, canario, { rodar: fila(travou(300)), tetoMs: 300_000, escrever: calado })
    expect(r.estado).toBe('ERRO')
    expect(r.rotulo).toBeUndefined()
    expect(r.motivo).toContain('Não virou MORTA-POR-TRAVAMENTO')
    expect(r.motivo).toContain('MUTACAO_TEMPO_SUITE_S')
  })

  it('(b) na fronteira exata — teto = 2× canário — a régua aceita', () => {
    const canario = { erroGlobal: null, duracaoCanarioMs: 150_000 }
    expect(classificarTravamento(travou(300), canario, 300_000).estado).toBe('MORTA')
  })

  it('(c) tempo esgotado NO CANÁRIO → a rodada não mede, e nada vira morta', async () => {
    const canario = await rodarCanario('/x', fila(travou(300)), calado)
    expect(canario.erroGlobal).toContain('o CANÁRIO falhou em TZ=UTC')
    expect(canario.erroGlobal).toContain('tempo esgotado (300s)')
    expect(canario.duracaoCanarioMs).toBeNull()
    expect(canario.totalTestesBase).toBeNull()
    // E se alguém entregar esse canário à classificação, ela recusa.
    expect(classificarTravamento(travou(300), canario, 300_000).estado).toBe('ERRO')
    expect(classificarTravamento(travou(300), null, 300_000).estado).toBe('ERRO')
  })

  it('(c) canário que passa em UTC e estoura em São Paulo também não mede', async () => {
    const canario = await rodarCanario('/x', fila(limpo(128_000), travou(300)), calado)
    expect(canario.erroGlobal).toContain('TZ=America/Sao_Paulo')
  })

  it('(d) ERRO SEM tempo esgotado (ambiente) → continua ERRO, intacto', async () => {
    const canario = { erroGlobal: null, totalTestesBase: 2916, duracaoCanarioMs: 128_000 }
    const original = semAmbiente()
    const r = await medirPonto('/x', 2916, canario, { rodar: fila(original), tetoMs: 300_000, escrever: calado })
    expect(r.estado).toBe('ERRO')
    expect(r.rotulo).toBeUndefined()
    expect(r.motivo).toBe(original.motivo)
  })

  it('MORTA e SOBREVIVEU normais passam sem mudança', () => {
    const canario = { erroGlobal: null, duracaoCanarioMs: 128_000 }
    const morta = { estado: 'MORTA', motivo: null, primeiroTesteQueFalhou: 'src/lib/x.test.js > y', tempoEsgotado: false }
    expect(classificarTravamento(morta, canario, 300_000)).toBe(morta)
    const sobreviveu = limpo(130_000)
    expect(classificarTravamento(sobreviveu, canario, 300_000)).toBe(sobreviveu)
  })
})

// ── com processo de verdade: o teto mata o GRUPO, e ninguém fica órfão ──────
//
// O marcador vai na linha de comando dos dois processos (avô e neto) para o
// `pgrep -f` achar só os deste teste. O neto é criado SEM `detached`, então
// herda o grupo do avô — é o desenho do vitest: `npm exec` → worker → esbuild.

// TODO processo que estes testes disparam tem PRAZO DE VIDA PRÓPRIO, e não
// depende de ninguém matá-lo. Achado do revisor adversarial do PR #99
// (05/10/2026): com `for(;;){}`, se a suíte de teste morre DE FORA — o teto da
// própria bateria matando o grupo do vitest, Ctrl-C, a fila encerrando — o
// `finally` não roda e o laço gira a 100% de CPU para sempre. Havia 6 deles na
// máquina, de 20 a 80 min de idade. A bateria roda este arquivo dezenas de
// vezes por rodada; cada resto comeria um núcleo do runner.
// 30 s: bem acima de qualquer coisa que o teste espera de um processo vivo
// (o maior caso volta em ~7 s) e bem abaixo de minutos.
const PRAZO_DE_VIDA_MS = 30000
// Gira (CPU de verdade, como um laço infinito síncrono) até o prazo, e sai.
const LACO_COM_PRAZO = `const f=Date.now()+${PRAZO_DE_VIDA_MS};while(Date.now()<f){}`
// Fica parado (sem CPU) até o prazo, e sai.
const ESPERA_COM_PRAZO = `setTimeout(()=>{},${PRAZO_DE_VIDA_MS})`

const vivosCom = (marcador) => {
  try {
    return execFileSync('pgrep', ['-f', marcador], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return [] // pgrep sai 1 quando não acha ninguém
  }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

describe('executarComTeto — o teto mata o grupo inteiro (órfãos de 30/08/2026)', () => {
  it('um avô que trava com um neto que trava: volta com tempoEsgotado e não sobra ninguém', async () => {
    const marcador = `mutacao-travamento-${process.pid}-${Date.now()}`
    const neto = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(LACO_COM_PRAZO)}, '${marcador}-neto'], { stdio: 'ignore' }); ${LACO_COM_PRAZO}`
    const r = await executarComTeto(process.execPath, ['-e', neto, marcador], {
      cwd: process.cwd(),
      env: process.env,
      tetoMs: 2000,
    })
    try {
      expect(r.tempoEsgotado).toBe(true)
      expect(r.error.code).toBe('ETIMEDOUT')
      expect(r.duracaoMs).toBeGreaterThanOrEqual(2000)
      expect(r.duracaoMs).toBeLessThan(14000) // folga para máquina carregada; travar de verdade daria o timeout do teste
      await esperar(300) // dá tempo ao kernel de recolher o que recebeu SIGKILL
      expect(vivosCom(marcador)).toEqual([])
    } finally {
      // Faxina caso a afirmação acima tenha falhado: o teste não pode ser a
      // causa de órfão que ele denuncia.
      for (const pid of vivosCom(marcador)) {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          /* já morreu */
        }
      }
    }
  }, 25000)

  it('rodarSuite com um comando que trava: ERRO + tempoEsgotado (a bateria é quem reclassifica)', async () => {
    const marcador = `mutacao-rodarsuite-${process.pid}-${Date.now()}`
    const r = await rodarSuite(process.cwd(), 'UTC', null, {
      comando: [process.execPath, ['-e', LACO_COM_PRAZO, marcador]],
      tetoMs: 2000,
    })
    expect(r.estado).toBe('ERRO')
    expect(r.tempoEsgotado).toBe(true)
    expect(r.motivo).toContain('tempo esgotado (2s)')
    await esperar(300)
    expect(vivosCom(marcador)).toEqual([])
  }, 15000)

  // Achado do revisor adversarial no PR #99 (05/10/2026): o tempo esgotado era
  // marcado quando o relógio disparava, sem perguntar se o líder já tinha
  // saído. Um neto que herda o stdout segura o cano, o 'close' não vem, e uma
  // suíte VERDE que saiu com 0 em 0,1 s virava MORTA-POR-TRAVAMENTO.
  it('líder sai VERDE na hora e um neto segura o stdout: SOBREVIVEU, sem tempo esgotado, e o neto morre', async () => {
    const marcador = `mutacao-neto-segura-cano-${process.pid}-${Date.now()}`
    const relatorio = JSON.stringify({ success: true, numTotalTests: 10, numFailedTests: 0, testResults: [] })
    const lider = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(ESPERA_COM_PRAZO)}, '${marcador}'], { stdio: 'inherit' }); process.stdout.write(${JSON.stringify(relatorio)}); process.exit(0)`
    try {
      const r = await rodarSuite(process.cwd(), 'UTC', 10, {
        comando: [process.execPath, ['-e', lider]],
        tetoMs: 20000,
      })
      expect(r.tempoEsgotado).toBe(false)
      expect(r.estado).toBe('SOBREVIVEU')
      expect(r.totalTestes).toBe(10)
      // Volta pela folga de 2 s depois da saída do líder, não pelo teto de 20 s (limite de 12 s: folga para carga, e ainda longe do teto).
      expect(r.duracaoMs).toBeLessThan(12000)
      const canario = { erroGlobal: null, duracaoCanarioMs: 500 }
      expect(classificarTravamento(r, canario, 20000).rotulo).toBeUndefined()
      await esperar(300)
      expect(vivosCom(marcador)).toEqual([])
    } finally {
      for (const pid of vivosCom(marcador)) {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          /* já morreu */
        }
      }
    }
  }, 35000)

  it('o mesmo caso com o teto disparando ANTES da folga de 2 s: continua SOBREVIVEU, sem tempo esgotado', async () => {
    // Aqui quem decide é a pergunta "o líder já tinha saído quando o teto
    // disparou?", não a folga — o caso exato do revisor.
    const marcador = `mutacao-neto-teto-curto-${process.pid}-${Date.now()}`
    const relatorio = JSON.stringify({ success: true, numTotalTests: 10, numFailedTests: 0, testResults: [] })
    const lider = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(ESPERA_COM_PRAZO)}, '${marcador}'], { stdio: 'inherit' }); process.stdout.write(${JSON.stringify(relatorio)}); process.exit(0)`
    try {
      const r = await rodarSuite(process.cwd(), 'UTC', 10, {
        comando: [process.execPath, ['-e', lider]],
        tetoMs: 1000,
      })
      expect(r.tempoEsgotado).toBe(false)
      expect(r.estado).toBe('SOBREVIVEU')
      await esperar(300)
      expect(vivosCom(marcador)).toEqual([])
    } finally {
      for (const pid of vivosCom(marcador)) {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          /* já morreu */
        }
      }
    }
  }, 20000)

  // Achado da reconferência do PR #99 (05/10/2026), defeito do conserto
  // anterior: com o líder já fora, o teto só matava o grupo e voltava SEM a
  // rede de 5 s. Um descendente que SAIU do grupo (setsid) e segura o stdout
  // deixava a promessa pendurada para sempre — no runner, cancelamento mudo.
  // Os dois tetos cobrem os dois caminhos que armam a rede: teto antes da
  // folga de 2 s, e folga antes de um teto longo.
  for (const tetoMs of [1000, 60000]) {
    it(`líder sai verde e um processo FORA do grupo segura o stdout por 30 s (muito além da rede): a função VOLTA em ~7 s (teto ${tetoMs / 1000} s)`, async () => {
      const marcador = `mutacao-escapou-do-grupo-${tetoMs}-${process.pid}-${Date.now()}`
      const relatorio = JSON.stringify({ success: true, numTotalTests: 10, numFailedTests: 0, testResults: [] })
      const lider = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(LACO_COM_PRAZO)}, '${marcador}'], { stdio: 'inherit', detached: true }).unref(); process.stdout.write(${JSON.stringify(relatorio)}); process.exit(0)`
      try {
        const r = await executarComTeto(process.execPath, ['-e', lider], {
          cwd: process.cwd(),
          env: process.env,
          tetoMs,
        })
        expect(r.tempoEsgotado).toBe(false)
        expect(r.status).toBe(0)
        expect(r.stdout).toBe(relatorio)
        // Folga de 2 s + rede de 5 s, com sobra — nunca o teto inteiro.
        expect(r.duracaoMs).toBeLessThan(18000)
      } finally {
        // Este processo saiu do grupo de propósito: a função não o mata, e o
        // teste não pode deixá-lo para trás.
        for (const pid of vivosCom(marcador)) {
          try {
            process.kill(Number(pid), 'SIGKILL')
          } catch {
            /* já morreu */
          }
        }
      }
    }, 28000)
  }

  it('MUTACAO_TEMPO_SUITE_S acima do limite do relógio do Node é recusado antes de começar', () => {
    // Acima de 2.147.483 s o setTimeout dispara em 1 ms e toda suíte sairia
    // como tempo esgotado (achado do revisor do PR #99, 05/10/2026).
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/mutacao.mjs')
    const carregar = (valor) =>
      spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script)})`], {
        env: { ...process.env, MUTACAO_TEMPO_SUITE_S: valor },
        encoding: 'utf8',
      })
    const grande = carregar('2147484')
    expect(grande.status).not.toBe(0)
    expect(grande.stderr).toContain('MUTACAO_TEMPO_SUITE_S grande demais')
    expect(carregar('2147483').status).toBe(0)
  }, 20000)

  it('comando que termina sozinho: sem tempoEsgotado, com a saída e o status', async () => {
    const r = await executarComTeto(process.execPath, ['-e', 'process.stdout.write("ok"); process.exit(3)'], {
      cwd: process.cwd(),
      env: process.env,
      tetoMs: 5000,
    })
    expect(r.tempoEsgotado).toBe(false)
    expect(r.error).toBeNull()
    expect(r.status).toBe(3)
    expect(r.stdout).toBe('ok')
  }, 15000)
})
