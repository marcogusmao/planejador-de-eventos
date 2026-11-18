// A ESTEIRA LOCAL COBRE O QUE A ESTEIRA REMOTA COBRE?
//
// POR QUE ESTE TESTE EXISTE (30/08/2026). Em 30/08 os créditos de GitHub Actions
// da conta acabaram no meio do dia: os quatro trabalhos passaram a morrer em três
// segundos, com ZERO passos executados, e a mensagem do GitHub era de cobrança —
// "recent account payments have failed or your spending limit needs to be
// increased". Com a `main` protegida exigindo quatro verificadores que nunca vão
// rodar, ela ficou selada, e a única prova possível virou a LOCAL.
//
// O problema é que os dois conjuntos NÃO eram iguais. O `scripts/auditoria.sh`
// cobria (a)-(h) e o `ci.yml` cobria quatro trabalhos, e três coisas só existiam
// no remoto: o gitleaks, a trava de dados por intervalo e a ponte. Quem rodasse a
// auditoria e visse verde ainda podia levar vermelho na esteira.
//
// PROVA LOCAL QUE COBRE MENOS QUE A REMOTA É PROVA QUE ENGANA — e é pior agora,
// porque não existe mais a remota para pegar o que passou.
//
// O QUE ESTE TESTE MORDE, exatamente: um comando de carga que entra no `ci.yml` e
// não entra no `auditoria.sh`. Não é elegante e não tenta ser: é uma lista de
// comandos que importam, conferida nos dois arquivos. A alternativa — comparar
// os arquivos "de verdade" — pediria interpretar YAML e shell, e um comparador
// que erra é pior que uma lista que alguém mantém sabendo que mantém.
//
// O QUE ELE NÃO PROVA, dito para ninguém confundir: que os dois RODAM a mesma
// coisa. `npx vitest run` aparece nos dois, mas só a esteira roda nos dois fusos
// por matriz — quem garante isso aqui é o passo (b) do próprio auditoria.sh.
// Este teste guarda a FRONTEIRA (nada some do local), não a equivalência.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ler = (p) => readFileSync(path.join(RAIZ, p), 'utf8')

/**
 * O arquivo SEM as linhas de comentário.
 *
 * ESTE HELPER NASCEU DE UMA FALHA DESTE PRÓPRIO TESTE, em 30/08/2026. A primeira
 * versão procurava o comando no texto inteiro. Provei a mordida sabotando o
 * `auditoria.sh` — troquei `bash scripts/trava-dados.sh` por um caminho que não
 * existe — e o teste passou verde: a string continuava aparecendo três vezes, nos
 * COMENTÁRIOS que explicam o passo.
 *
 * Ou seja: a guarda aceitava um script que só FALAVA do comando como se ele o
 * rodasse. É a mesma família do defeito que ela existe para pegar, e só apareceu
 * porque a mordida foi testada em vez de suposta.
 */
const semComentarios = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

/**
 * O comando é CHAMADO neste texto — não apenas mencionado.
 *
 * TERCEIRA VERSÃO DESTA GUARDA, e as duas primeiras furaram (30/08/2026):
 *   1ª — procurava a string no texto inteiro. Furou: a menção em COMENTÁRIO
 *        bastava, e sabotar a chamada da trava de dados passou verde.
 *   2ª — ignorava comentários. Furou de novo, duas vezes: a linha
 *        `if [ ! -f scripts/trava-dados.sh ]`, que só confere se o arquivo
 *        existe, e o rótulo `PASSO_ATUAL="(c) build de produção (npm run build)"`,
 *        que é só texto na tela. Nos dois casos a string está numa linha
 *        executável e nenhuma delas EXECUTA nada.
 *
 * A régua que sobrou: o comando tem de aparecer em POSIÇÃO DE COMANDO — começo de
 * linha, ou depois de `&&`, `||`, `;` ou `|` —, tolerando as atribuições de
 * ambiente que o precedem (`TZ=UTC npx vitest run`, `PONTE_FINANCEIRO_DIR=… bash
 * scripts/teste_ponte.sh`). Dentro de aspas, num `[ -f ]` ou num rótulo, não conta.
 *
 * As três versões estão escritas porque a lição é a que importa: cada furo só
 * apareceu porque a mordida foi TESTADA sabotando o script de verdade, e não
 * suposta. Guarda cuja mordida ninguém provou é decoração.
 */
const chamaDeVerdade = (texto, cmd) => {
  const escapado = cmd.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  // POSIÇÃO DE COMANDO, nas duas gramáticas:
  //   shell — começo de linha, ou depois de `&&`, `||`, `;`, `|`
  //   YAML  — depois de `run:` (uma linha) ou `run: |` (bloco; a linha seguinte
  //           começa a linha, então o `^` do modo multilinha já a pega)
  // ...tolerando as atribuições de ambiente que precedem o comando, inclusive as
  // que têm ASPAS COM ESPAÇO DENTRO: `TZ="${{ matrix.tz }}" npx vitest run`.
  const AMBIENTE = '(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|\'[^\']*\'|\\S*)[ \\t]+)*'
  const INICIO = '(^|&&|\\|\\||;|\\||run:[ \\t]*\\|?[ \\t]*)'
  return new RegExp(`${INICIO}[ \\t]*${AMBIENTE}${escapado}`, 'm').test(semComentarios(texto))
}

// Os comandos que CARREGAM a prova. Um comando aqui é uma coisa que, se sumir,
// deixa de ser verificada — não é decoração de script.
//
// A EXIGÊNCIA É A CHAMADA, NÃO A MENÇÃO, e isso também nasceu de uma falha desta
// guarda em 30/08/2026. Depois de fazê-la ignorar comentários, sabotei o
// `auditoria.sh` de novo — troquei `bash scripts/trava-dados.sh` por um caminho
// inexistente — e ela AINDA passou verde: a linha `if [ ! -f
// scripts/trava-dados.sh ]`, que só CONFERE se o arquivo existe, é executável e
// contém o caminho. Presença não é chamada. Agora cada comando traz o verbo que
// o executa (`bash`, `node`, `npx`, `npm`), e sabotar a chamada morde.
const COMANDOS_DE_CARGA = [
  { assunto: 'a suíte', ci: 'npx vitest run', local: 'npx vitest run' },
  { assunto: 'o build de produção', ci: 'npm run build', local: 'npm run build' },
  {
    assunto: 'banco/planilha/backup não entram no repositório',
    ci: 'bash scripts/trava-dados.sh',
    local: 'bash scripts/trava-dados.sh',
  },
  {
    assunto: 'a ponte não escreve no banco do Financeiro',
    ci: 'bash scripts/teste_ponte.sh',
    local: 'bash scripts/teste_ponte.sh',
  },
  {
    assunto: 'EVIDENCIA-TESTES.md em dia',
    ci: 'node scripts/gerar-indice-testes.mjs',
    local: 'node scripts/gerar-indice-testes.mjs',
  },
  {
    // o ci.yml chama `./scripts/…` e o auditoria chama `bash scripts/…`;
    // o que importa é que os dois EXECUTEM, não com qual verbo
    assunto: 'a linha de aprovação do Marco',
    ci: './scripts/portao-golden.sh',
    local: 'bash scripts/portao-golden.sh',
  },
]

describe('a esteira LOCAL cobre o que a esteira REMOTA cobre', () => {
  // Comentário não roda nada: a conferência olha só as linhas executáveis.
  const ci = semComentarios(ler('.github/workflows/ci.yml'))
  const local = semComentarios(ler('scripts/auditoria.sh'))
  // ...menos onde o que se afirma é justamente o TEXTO (as mensagens ao usuário).
  const localBruto = ler('scripts/auditoria.sh')
  const ciBruto = ler('.github/workflows/ci.yml')

  it.each(COMANDOS_DE_CARGA)('$assunto — chamado no ci.yml E no auditoria.sh', (cmd) => {
    // A premissa: o comando é de carga porque a esteira remota o EXECUTA. Se ele
    // sair do ci.yml, esta linha cai primeiro e alguém decide de propósito.
    expect(chamaDeVerdade(ciBruto, cmd.ci)).toBe(true)
    // E a guarda de verdade: o local não pode ficar para trás.
    expect(chamaDeVerdade(localBruto, cmd.local)).toBe(true)
  })

  it('o gitleaks está no ci.yml e no auditoria.sh, e a VERSÃO fixada é citada', () => {
    // O ci.yml baixa um binário pinado por sha256; a máquina usa o que estiver
    // instalado. Não dá para exigir a mesma versão de dentro de um teste — o que
    // dá é exigir que o auditoria.sh IMPRIMA a versão fixada ao lado da local,
    // para uma divergência aparecer na tela em vez de passar batida.
    expect(ci).toMatch(/GITLEAKS_VERSION/)
    expect(local).toMatch(/gitleaks detect/)
    const fixada = /GITLEAKS_VERSION:\s*'?([\d.]+)/.exec(ci)?.[1]
    expect(fixada).toBeTruthy()
    // a versão fixada é citada no TEXTO que o script imprime ao operador
    expect(localBruto).toContain(fixada)
  })

  it('todo trabalho do ci.yml tem passo correspondente declarado no auditoria.sh', () => {
    // Guarda de FRONTEIRA: um trabalho novo no ci.yml sem eco aqui é justamente o
    // buraco que este teste veio fechar. A conferência é pelo assunto do trabalho,
    // não pelo nome exato — nomes carregam versão de sessão (H3-I, H3-M).
    const assuntos = [
      { job: /Testes \(Vitest/, local: /suíte completa em TZ=/ },
      { job: /build de produção/, local: /build de produção/ },
      { job: /gitleaks/, local: /gitleaks/ },
      { job: /bash scripts\/trava-dados\.sh/, local: /bash scripts\/trava-dados\.sh/ },
      { job: /bash scripts\/teste_ponte\.sh/, local: /bash scripts\/teste_ponte\.sh/ },
    ]
    for (const { job, local: eco } of assuntos) {
      expect(job.test(ci)).toBe(true)
      expect(eco.test(local)).toBe(true)
    }
    // e os dois que a guarda de posição já cobre, ditos aqui pelo nome do passo
    expect(localBruto).toMatch(/\(i\) trava de dados/)
    expect(localBruto).toMatch(/\(j\) gitleaks/)
    expect(localBruto).toMatch(/\(k\) ponte com o Financeiro/)
  })

  it('a auditoria PARA no primeiro vermelho — verde parcial não existe', () => {
    // Sem isto, um passo vermelho no meio ainda deixaria os seguintes rodarem e o
    // resumo final poderia sair verde. A regra do script é parar; ela vale porque
    // `falhar` sai com código 1 e é chamada em todo passo.
    expect(local).toMatch(/exit 1/)
    expect(localBruto).toMatch(/✗ AUDITORIA PAROU/)
    // e o único passo que pode PULAR anuncia o pulo em vez de sair verde
    expect(local).toMatch(/PULADO/)
    expect(local).toMatch(/ISTO NÃO É UM VERDE/)
  })
})
