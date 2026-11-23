# MUTAÇÃO — resultado da última rodada (gerado)

> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/mutacao.mjs` e
> reescrito por inteiro a cada rodada. O que precisa SOBREVIVER a uma re-rodada — o
> julgamento datado de cada sobrevivente — mora em **`MUTACAO-JULGAMENTOS.md`**, que é
> escrito à mão e versionado; este gerador só o LÊ e cruza. O ponto de parada do
> rodízio mora em `MUTACAO-ESTADO.json` — e, na esteira semanal, a cópia que vale é a da
> ramificação `mutacao/estado`, não a da `main` (Marco, 05/10/2026).
>
> **O que a bateria faz:** aplica mutações mínimas e determinísticas (trocar `+` por
> `-`, `*` por `/`, `>` por `>=`, `<` por `<=`, `===` por `!==`, `Math.round` por
> `Math.floor`) nos módulos de cálculo e de dado salvo, UMA de cada vez, e roda a
> suíte inteira para ver se algum teste morre.
>
> **Como rodar de novo:**
>
>     node scripts/mutacao.mjs             # rodada normal
>     node scripts/mutacao.mjs --simular   # só mostra o que SERIA exercitado
>
> **Rodízio:** cada rodada exercita pontos que ainda NÃO foram exercitados. O que já
> rodou fica em `MUTACAO-ESTADO.json`; quando o universo inteiro fecha, o ciclo
> reinicia. Duas rodadas seguidas nunca medem o mesmo conjunto.
>
> **Três estados, nunca dois.** `MORTA` = algum teste gritou. `SOBREVIVEU` = a suíte
> rodou inteira e passou (buraco de rede). **`ERRO`** = a suíte não chegou a medir
> (ambiente, tempo esgotado no canário, coleta parcial) — e ERRO **nunca** conta como
> morta. **`MORTA-POR-TRAVAMENTO`** é a única ponte (Marco, 12/08/2026): a suíte TRAVOU
> só com a mutação, o canário limpo dos dois fusos passou na mesma rodada e o teto é
> pelo menos 2× a duração dele — app congelado é comportamento observável. Uma
> rodada com qualquer ERRO sai VERMELHA: código de saída 1. Sobrevivente sem
> julgamento sai com código 2. Verde só quando tudo foi medido e todo sobrevivente
> tem julgamento datado.
>
> **Dois fusos.** Toda mutação roda em `TZ=UTC`; quem sobrevive roda DE NOVO em
> `TZ=America/Sao_Paulo`. Morta em qualquer um dos dois é morta; `SOBREVIVEU` significa
> "sobreviveu nos DOIS". A confirmação custa quase nada porque quase tudo morre no
> primeiro fuso — e fecha a exigência da casa de não medir num fuso só.
>
> **Canário.** Antes de mutar qualquer coisa, a suíte roda LIMPA nos dois fusos. Se ela
> não passa, a rodada morre ali e diz que não mediu nada, em vez de devolver nota
> máxima com o ambiente quebrado.
>
> **Nunca toca o working tree real.** Toda mutação acontece dentro de um `git worktree`
> temporário e isolado (checkout separado do mesmo histórico, numa pasta fora do
> repositório — por padrão `os.tmpdir()`, ajustável com `MUTACAO_TMPDIR`). Uma
> armadilha de saída (SIGINT/SIGTERM/SIGHUP/SIGQUIT/exceção/fim) remove o worktree mesmo se a
> bateria for interrompida no meio, e a impressão digital de `src/` é conferida antes
> e depois: se divergir, a rodada morre com erro alto.
>
> **A bateria enxerga o HEAD COMMITADO, não o working tree:** o worktree destacado nasce
> de `HEAD`, então teste novo ainda não commitado NÃO conta para matar mutação — commite
> o teste e re-rode. (Pegadinha vivida em 21/07/2026: dois testes-de-matar recém-escritos
> "não mataram nada" até serem commitados.)
>
> **Sobrevivente não é para consertar aqui.** Fórmula é portão do Marco (princípios 1 e 8
> do CLAUDE.md) — este relatório LISTA buracos de rede; a decisão do que fazer com cada
> um é de quem lê, e o registro dessa decisão vai para `MUTACAO-JULGAMENTOS.md`.

Rodada **nº 1** · ciclo **1** · commit `22b312f` · 2026-11-23 21:49:24 (UTC) · tempo: **49min 1s**.

## Cobertura — o rodízio

Universo de pontos de mutação: **452**. Já exercitados antes desta rodada (ciclo 1): **0**. Exercitados com veredito agora: **20**. Faltam **432** para fechar o ciclo — cerca de **22** rodada(s) no ritmo de 20 por rodada.

| Arquivo | Candidatos | Cobertos antes | Nesta rodada | Cobertos depois |
|---|---:|---:|---:|---:|
| src/lib/calc.js | 101 | 0 | 2 | 2 |
| src/lib/fechamento.js | 27 | 0 | 2 | 2 |
| src/lib/planoFinanceiro.js | 71 | 0 | 2 | 2 |
| src/lib/dre.js | 4 | 0 | 2 | 2 |
| src/lib/comparacaoCustos.js | 39 | 0 | 2 | 2 |
| src/lib/receitaLiquida.js | 4 | 0 | 2 | 2 |
| src/lib/precoLote.js | 5 | 0 | 2 | 2 |
| src/lib/simulador.js | 4 | 0 | 2 | 2 |
| src/lib/historico.js | 7 | 0 | 1 | 1 |
| src/lib/protecao.js | 30 | 0 | 1 | 1 |
| src/lib/storage.js | 67 | 0 | 1 | 1 |
| src/lib/migracao.js | 93 | 0 | 1 | 1 |
| **Total** | **452** | **0** | **20** | **20** |

## Resultado

**19 MORTAS** (algum teste gritou) · **1 SOBREVIVEU** (nenhum teste gritou) · **0 ERROS** (não chegou a medir).

Linha de base do canário: **4274 testes** coletados na suíte limpa. Toda rodada abaixo que "passou" com menos testes que isso foi classificada como ERRO, não como sobrevivência.

## SOBREVIVENTES

1 mutação(ões) não fizeram nenhum teste falhar, em nenhum dos dois fusos. Cada uma é um buraco de rede: uma dessas contas pode ficar errada em produção sem nenhum teste avisar.

### ⚠ ACHADOS ABERTOS — 1 sobrevivente(s) SEM julgamento

Estes não têm decisão registrada em `MUTACAO-JULGAMENTOS.md`. Enquanto estiverem assim, a bateria sai com código 2. Julgar é escrever no arquivo à mão: EQUIVALENTE (a mutação não muda comportamento observável), QUASE-EQUIVALENTE (só diverge numa fronteira de medida zero), TESTE-FALTANDO (é buraco real — escreva o teste) ou ACEITO-COM-RISCO (decisão datada de quem pode decidir).

#### `dre.js:56` — < → <=

```js
if (Math.abs(v) < 0.005) return DASH
```

O que muda: Um limite estrito ("menor que") passa a incluir o valor exatamente igual ao limite. Um caso de borda que antes caía de um lado passa a cair do outro.

## Tabela completa desta rodada

| Arquivo | Linha | Mutação | Resultado | Fuso do veredito | Teste que matou (1º que falhou) |
|---|---:|---|---|---|---|
| calc.js | 20 (1º de 3) | `=== → !==` | MORTA | UTC | src/components/App.fio.test.jsx > App — o fio até o CÁLCULO (o número da tela é o do módulo puro) > o card da Home mostra o lucro realista que computeCenarios devolve |
| calc.js | 20 (2º de 3) | `=== → !==` | MORTA | UTC | src/components/App.fio.test.jsx > App — o fio até o CÁLCULO (o número da tela é o do módulo puro) > o card da Home mostra o lucro realista que computeCenarios devolve |
| fechamento.js | 144 | `- → +` | MORTA | UTC | src/lib/barPorPessoa.test.js > fechamento (integração): bar realizado segue pedido igual; previsto acompanha o modo > modo por pessoa: bar previsto = o bar calculado do realista (o número da DRE) |
| fechamento.js | 145 | `> → >=` | MORTA | UTC | src/lib/fechamento.test.js > fechamentoReceita — estimado zero não divide > bilheteria estimada R$ 0 com realizado informado: desvio absoluto existe, desvioPct é null (nunca Infinity) |
| planoFinanceiro.js | 118 | `+ → -` | MORTA | UTC | src/lib/avisoExportVerdade.test.js > o aviso do export diz a verdade — SEM contingência > toda linha de custo leva o ESTIMADO, nenhuma leva o realizado |
| planoFinanceiro.js | 120 | `- → +` | MORTA | UTC | src/lib/avisoExportVerdade.test.js > o aviso do export diz a verdade — SEM contingência > toda linha de custo leva o ESTIMADO, nenhuma leva o realizado |
| dre.js | 41 | `- → +` | MORTA | UTC | src/components/dreQueFecha.evidencia.test.jsx > o DRE soma na frente de quem lê > aba Cenários: as quatro contas da coluna fecham nos três cenários |
| dre.js | 56 | `< → <=` | SOBREVIVEU | UTC e America/Sao_Paulo | — |
| comparacaoCustos.js | 182 | `Math.round → Math.floor` | MORTA | UTC | src/lib/comparacaoCustos.test.js > achado 1 — resíduo de ponto flutuante não vira linha na tela > evento sem outras categorias: "Outras categorias" não aparece com R$ −1 |
| comparacaoCustos.js | 182 | `* → /` | MORTA | UTC | src/lib/comparacaoCustos.test.js > coluna da previsão fecha no custo total exibido > fecha com valores redondos (o caso fácil, que já fechava) |
| receitaLiquida.js | 42 | `=== → !==` | MORTA | UTC | src/components/quantidadeTravada.s6.test.jsx > S6 × #98 — dado inválido vence a trava, em todas as telas > soma que não cabe em OUTRO cenário (lote de R$ 1e306, realista travado em 1): cartão, DRE, legenda da apresentação e Home dizem "não dá para calcular" |
| receitaLiquida.js | 43 | `* → /` | MORTA | UTC | src/components/App.fio.test.jsx > App — o fio até o CÁLCULO (o número da tela é o do módulo puro) > o card da Home mostra o lucro realista que computeCenarios devolve |
| precoLote.js | 13 | `+ → -` | MORTA | UTC | src/lib/precoLote.test.js > paridade com as expressões antigas do JSX > caso 0 da grade |
| precoLote.js | 20 | `* → /` | MORTA | UTC | src/components/ReportView.bilheteriaDoCenario.test.jsx > ReportView — a coluna Receita cala quando não pode provar o que promete (26/07/2026) > sumindo a de receita, entra a capacidade COM DESCONTO — e ela bate com efetivo × qtd |
| simulador.js | 29 | `- → +` | MORTA | UTC | src/lib/simulador.test.js > valorEfetivo > campo ausente devolve o fallback de exibição |
| simulador.js | 35 | `- → +` | MORTA | UTC | src/lib/simulador.test.js > simulacaoAtiva > valores explícitos iguais ao alvo (80/90/100) não contam como ativa |
| historico.js | 98 | `> → >=` | MORTA | UTC | src/components/App.financeiroNoop.test.jsx > funil real do App preserva no-op da ponte > mesma referência não cria carimbo, save ou histórico |
| protecao.js | 77 | `< → <=` | MORTA | UTC | src/lib/lixeiraNadaEmSilencio.test.js > proximoDescarteDaLixeira — o aviso que vem ANTES > lixeira cheia: diz quem vai ser expulso na próxima exclusão |
| storage.js | 98 | `=== → !==` | MORTA | UTC | src/lib/leituraCorrompida.test.js > leitura corrompida — (a) o bruto é preservado > copia a string ilegível para uma chave de quarentena |
| migracao.js | 130 (1º de 2) | `=== → !==` | MORTA | UTC | src/lib/migracao.test.js > migrarEvento (Sessão H — campo opcional financeiro) > vínculo válido é preservado por inteiro (carimbos incluídos) |

## Avisos da ferramenta (nada falha em silêncio)

**Problemas em `MUTACAO-JULGAMENTOS.md`:**

- `MUTACAO-JULGAMENTOS.md` não existe na raiz do repositório. Sem ele, qualquer sobrevivente conta como achado aberto (o que está correto, mas provavelmente não é o que você queria).

## Histórico das rodadas (acumulado, de `MUTACAO-ESTADO.json`)

| Rodada | Quando | Commit | Ciclo | Exercitadas | Mortas | Sobreviveram | Erros |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | 2026-11-23 21:49:24 (UTC) | `22b312f` | 1 | 20 | 19 | 1 | 0 |

## Onde esta bateria roda sozinha

O Marco decidiu em **25/07/2026** (item 13 do `DECISOES-MARCO-H4.md`) que esta bateria roda
em **agendamento semanal**, não a cada envio. O passo existe desde 27/07/2026:
`.github/workflows/mutacao-semanal.yml`, toda segunda às 09:00 UTC, mais o botão de rodar
agora. **Quem manda no comportamento é aquele arquivo** — o cabeçalho dele explica o que cada
código de saída faz com o trabalho (1 fica vermelho; 2 fica verde com aviso). Este texto não
repete o passo a passo de propósito: a versão anterior descrevia um workflow "que ainda falta
criar" dois meses depois de ele existir.

**O ponto de parada não depende do pull request** (Marco, 05/10/2026, por questionário: o
rodízio guarda o ponto de parada na ramificação `mutacao/estado`; risco aceito: o estado
verdadeiro mora fora da main). O workflow lê o `MUTACAO-ESTADO.json` de lá antes da rodada e
grava o novo lá depois. O pull request semanal é só a página do relatório.

