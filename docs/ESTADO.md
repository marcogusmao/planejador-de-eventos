# ESTADO DO REPOSITÓRIO — cada número com um endereço só (gerado)

> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/gerar-estado.mjs`,
> que LÊ cada número do arquivo onde esse número já mora. Nada aqui é digitado:
> editar à mão só cria mais uma cópia do número que este documento existe para
> eliminar — e cópia mantida à mão é como as quatro contagens diferentes de
> "quantos testes existem" nasceram.
>
> **Como regenerar:**
>
>     node scripts/gerar-estado.mjs
>
> **Como conferir sem escrever na árvore de trabalho** (é assim que a esteira deve
> conferir — ver a última seção):
>
>     node scripts/gerar-estado.mjs --saida "$TMP" && diff -u docs/ESTADO.md "$TMP"
>
> A saída é **determinística**: sem data, sem hora, sem sha de commit — duas rodadas
> seguidas dão byte por byte o mesmo arquivo, para que `diff` seja prova.
>
> Se um arquivo-fonte mudar de forma e o gerador não achar o que procura, ele **para
> com erro dizendo o quê e onde** e não escreve nada — nunca um valor vazio, nunca um
> palpite.

## De onde vem cada número

| Seção | Arquivo-fonte lido na hora | O que é extraído de lá |
|---|---|---|
| Testes | `scripts/gerar-indice-testes.mjs` + `EVIDENCIA-TESTES.md` | o próprio contador do índice de testes, reaproveitado (não é uma segunda contagem); o índice commitado serve de conferência |
| Portão do golden | `scripts/portao-golden.sh` | a variável `PADRAO_PORTAO` |
| Dependências | `package.json` | `dependencies` e `devDependencies` |
| Node | `.github/workflows/ci.yml` + `package.json` | `node-version` do passo `actions/setup-node` e `engines.node` |
| Esteira | `.github/workflows/ci.yml` | os trabalhos de `jobs:` e os passos de cada um |

## Testes

**193 arquivos de teste · 843 blocos `describe` · 3.130 verificações (`it`/`test`)**, das quais **18 em `skip`**.

| Diretório | Arquivos | `describe` | Verificações (`it`/`test`) | das quais `skip` |
|---|---:|---:|---:|---:|
| `src/lib` | 129 | 647 | 2.451 | 18 |
| `src/components` | 64 | 196 | 679 | 0 |
| **Total** | **193** | **843** | **3.130** | **18** |

Contado pelo mesmo código que gera o `EVIDENCIA-TESTES.md`: o gerador deste documento importa o trecho de contagem de `scripts/gerar-indice-testes.mjs` em vez de varrer os testes por conta própria, e **para com erro** se a tabela "Resumo" do índice commitado discordar do que ele mede agora. Os dois documentos não têm como divergir sem que alguém fique sabendo.

**Cuidado ao comparar com a saída do `npm test`:** este é o número de verificações **escritas no código-fonte**, contadas sem executar nada. Um `it.each` aparece 1× aqui e roda 1× por linha da sua tabela de casos, então o total que o `vitest` imprime no fim da suíte é maior — e os dois estão certos, cada um medindo uma coisa. O número de **arquivos** é o mesmo nos dois. A lista caso a caso está em `EVIDENCIA-TESTES.md`.

## Portão do golden — arquivos protegidos

**19 arquivos** estão sob o portão do golden. Mudar qualquer um exige, na mensagem do commit, a linha `APROVADO-PELO-MARCO: dd/mm/aaaa motivo em uma linha` — o mesmo `scripts/portao-golden.sh` recusa no hook `commit-msg` e na esteira.

| # | Arquivo protegido | Existe no repositório? |
|---:|---|---|
| 1 | `src/lib/calc.js` | sim |
| 2 | `src/lib/golden.test.js` | sim |
| 3 | `src/lib/fechamento.js` | sim |
| 4 | `src/lib/planoFinanceiro.js` | sim |
| 5 | `src/lib/dre.js` | sim |
| 6 | `src/lib/comparacaoCustos.js` | sim |
| 7 | `src/lib/receitaLiquida.js` | sim |
| 8 | `src/lib/precoLote.js` | sim |
| 9 | `src/lib/simulador.js` | sim |
| 10 | `scripts/portao-golden.sh` | sim |
| 11 | `scripts/trava-dados.sh` | sim |
| 12 | `scripts/padroes-dados.txt` | sim |
| 13 | `.githooks/commit-msg` | sim |
| 14 | `.githooks/ligar-trava.sh` | sim |
| 15 | `.githooks/pre-commit` | sim |
| 16 | `.githooks/pre-push` | sim |
| 17 | `.github/workflows/ci.yml` | sim |
| 18 | `package.json` | sim |
| 19 | `package-lock.json` | sim |

Lista lida da variável `PADRAO_PORTAO` de `scripts/portao-golden.sh`, na ordem em que está escrita lá. Ampliar essa lista é decisão do Marco; este documento só relata o que está no ar.

## Dependências declaradas

**13 pacotes** declarados: 5 de produção, 8 de desenvolvimento.

| Pacote | Versão declarada | Onde |
|---|---|---|
| `@tailwindcss/vite` | `^4.1.11` | desenvolvimento |
| `@testing-library/dom` | `10.4.1` | desenvolvimento |
| `@testing-library/react` | `16.3.2` | desenvolvimento |
| `@vitejs/plugin-react` | `^4.6.0` | desenvolvimento |
| `exceljs` | `4.4.0` | produção |
| `jsdom` | `29.1.1` | desenvolvimento |
| `lucide-react` | `^1.25.0` | produção |
| `react` | `^19.1.0` | produção |
| `react-dom` | `^19.1.0` | produção |
| `tailwindcss` | `^4.1.11` | desenvolvimento |
| `vite` | `^6.3.5` | desenvolvimento |
| `vitest` | `^3.2.4` | desenvolvimento |
| `xlsx` | `file:vendor/xlsx-0.20.3.tgz` | produção |

Lido de `package.json` (blocos `dependencies` e `devDependencies`). Esta é a lista do que **está instalado**; a lista do que é **aprovado** — e a justificativa de cada aprovação — mora no `CLAUDE.md`. Se as duas discordarem, quem manda é o `CLAUDE.md` e a diferença é um achado.

## Node — o que a esteira usa × o que o app aceita

| Onde | O que está escrito lá |
|---|---|
| Esteira · trabalho `testes-e-build` · passo "Preparar Node 20" | `20` |
| `package.json` · `engines.node` | `^20.0.0 \|\| >=22.0.0` |

- Node `20` (esteira) **é compatível** com a faixa aceita: satisfaz a cláusula `^20.0.0`.

## Esteira (CI) — trabalhos e passos

**3 trabalhos · 17 passos** em `.github/workflows/ci.yml`.

### 1. `seguranca` — Segurança do pipeline (gitleaks + trava de dados, H3-M)

roda em `ubuntu-latest` · 4 passos

| # | Passo | Como roda | Só quando |
|---:|---|---|---|
| 1 | Baixar o código | `actions/checkout@v4` | sempre |
| 2 | Trava de dados no CI (o mesmo script de .githooks/pre-commit) | script (`run:`) no próprio arquivo | sempre |
| 3 | Baixar gitleaks 8.30.1 (binário oficial, pinado por sha256) | script (`run:`) no próprio arquivo | sempre |
| 4 | Gitleaks — varrer segredos em TODO commit que este push traz | script (`run:`) no próprio arquivo | sempre |

### 2. `testes-e-build` — Testes (Vitest, TZ=${{ matrix.tz }}) + build de produção

roda em `ubuntu-latest` · 8 passos

| # | Passo | Como roda | Só quando |
|---:|---|---|---|
| 1 | Baixar o código | `actions/checkout@v4` | sempre |
| 2 | Portão do golden (fórmula e golden só mudam com aprovação do Marco) | script (`run:`) no próprio arquivo | sempre |
| 3 | Preparar Node 20 | `actions/setup-node@v4` | sempre |
| 4 | Índice de testes (EVIDENCIA-TESTES.md) atualizado | script (`run:`) no próprio arquivo | `matrix.tz == 'UTC'` |
| 5 | Instalar dependências (limpo, a partir do package-lock) | script (`run:`) no próprio arquivo | sempre |
| 6 | A instalação ligou a trava de dados (core.hooksPath = .githooks) | script (`run:`) no próprio arquivo | sempre |
| 7 | Testes (Vitest, TZ=${{ matrix.tz }}) | script (`run:`) no próprio arquivo | sempre |
| 8 | Build de produção | script (`run:`) no próprio arquivo | `matrix.tz == 'UTC'` |

### 3. `teste-ponte` — Ponte com o Financeiro (integração real, H3-I)

roda em `ubuntu-latest` · 5 passos

| # | Passo | Como roda | Só quando |
|---:|---|---|---|
| 1 | Baixar previsao-eventos | `actions/checkout@v4` | sempre |
| 2 | Baixar Financeiro (repo irmão da ponte) | `actions/checkout@v4` | sempre |
| 3 | Preparar Python 3 | `actions/setup-python@v5` | `steps.sibling.outcome == 'success'` |
| 4 | Rodar teste_ponte.sh (cliente real da previsão × servidor real do Financeiro) | script (`run:`) no próprio arquivo | `steps.sibling.outcome == 'success'` |
| 5 | Aviso quando o job foi pulado por falta do secret | script (`run:`) no próprio arquivo | `steps.sibling.outcome != 'success'` |

## Este documento na esteira

**PENDENTE — nenhum passo de `.github/workflows/ci.yml` menciona `scripts/gerar-estado.mjs`.** Hoje este documento pode envelhecer no repositório sem que nada acuse: exatamente a doença que ele existe para curar, só que um andar acima. Detectado por leitura do arquivo da esteira; esta seção some sozinha quando o passo existir.

O passo que falta (**proposta**, não implementado aqui — o arquivo da esteira é território de outra frente). Mesmo desenho do passo que já confere o índice de testes, com uma diferença que é o ponto:

```yaml
      # Colocar no trabalho que já roda o índice de testes, logo depois dele,
      # ANTES do npm ci: é checagem estática e barata, e um passo que só roda
      # depois da suíte fica inalcançável enquanto a suíte estiver vermelha.
      # Não precisa de dependência instalada — o gerador só usa node:fs/path/url.
      - name: Estado do repositório (docs/ESTADO.md) atualizado
        if: matrix.tz == 'UTC'
        run: |
          ESPERADO="$(mktemp)"
          node scripts/gerar-estado.mjs --saida "$ESPERADO"
          if ! diff -u docs/ESTADO.md "$ESPERADO"; then
            echo ""
            echo "docs/ESTADO.md está DESATUALIZADO — o diff acima é a diferença"
            echo "entre o documento commitado e o estado real do repositório."
            echo "Rode 'node scripts/gerar-estado.mjs', confira o diff e commite"
            echo "docs/ESTADO.md junto da mudança que alterou o estado."
            exit 1
          fi
```

**A armadilha evitada, e por que o `--saida` existe:** o passo do índice de testes regenera por cima da árvore de trabalho e só depois roda `git diff --exit-code`. Funciona na esteira, mas o mesmo desenho rodando na máquina de alguém (via `scripts/auditoria.sh`) **conserta o artefato em silêncio** — o conferidor reescreve justamente o que deveria auditar, e a divergência desaparece antes de virar notícia. Aqui a geração vai para um arquivo temporário e a comparação é `diff -u` contra o commitado: o arquivo versionado nunca é tocado, e a única saída possível é passar ou falhar dizendo qual linha mudou.

**Critério de aceite do passo:** (1) com a árvore limpa, o passo passa; (2) alterando uma linha de `docs/ESTADO.md` à mão, o passo falha e o log mostra a linha; (3) depois de o passo rodar, `git status --porcelain docs/ESTADO.md` volta vazio — prova de que o conferidor não escreveu no arquivo versionado.
