#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# PORTÃO — BATERIA DE ACEITE (Sessão H4, 24/07/2026).
#
# Prova, rodando, que as travas de .githooks/ recusam o que têm de recusar e
# deixam passar o que têm de deixar. Nasceu do defeito medido em 24/07/2026: a
# trava de dados lia a lista do stage com `git diff --cached --name-only`, o git
# devolvia "or\303\247amento.xlsx" com aspas nas pontas, as âncoras ^ e $ dos
# padrões não casavam mais e a planilha entrava no commit com exit 0 e nenhum
# aviso. Neste app quase todo nome é em português — o caso raro é o SEM acento.
#
# COMO RODAR
#     sh scripts/portao-teste.sh
#
# POR QUE COMEÇA COM SHEBANG E MESMO ASSIM SE RODA COM `sh`: o shebang existe
# para quem chamar ./scripts/portao-teste.sh direto, mas nenhum cenário depende
# do bit de execução deste arquivo — num clone recém-baixado, num zip ou num
# checkout em sistema de arquivo que não guarda permissão, `sh scripts/...`
# continua funcionando. É /bin/sh (POSIX) de propósito: sem `read -d` (bash) e
# sem `grep -z`/`grep -o` (GNU), para valer no macOS do Marco e no Ubuntu do CI.
#
# CADA CENÁRIO cria um repositório DESCARTÁVEL em mktemp -d, aponta
# core.hooksPath para os hooks DESTE repositório, põe um arquivo SINTÉTICO no
# stage e tenta um commit de verdade. Nenhum arquivo de dado real é usado:
# todo conteúdo é a palavra "sintetico". As pastas temporárias são apagadas no
# fim (e também se o script for interrompido).
#
# A BATERIA FIXA O AMBIENTE DE GIT que ela mesma precisa (ver "AMBIENTE FIXO" e
# `preparar_repo`). Isso foi acrescentado depois de um segundo defeito medido,
# em 25/07/2026: os cenários de acento só exercitam a condição que prometem
# quando `core.quotepath` está ligado, que é o padrão de fábrica do git. Numa
# máquina com `quotepath = false` no ~/.gitconfig — justamente o ajuste que
# quem trabalha com nome em português tende a ligar — a bateria devolvia 7 de 7
# verde e exit 0 COM O DEFEITO INTEIRO DE VOLTA. Uma bateria que fica verde por
# causa da configuração de quem a roda é pior que bateria nenhuma.
#
# O QUE ESTA BATERIA NÃO COBRE (confira à mão ao mexer nisso): o ci.yml como
# YAML — se o arquivo ficar inválido, o passo mudar de nome ou passar a usar
# uma expressão ${{ }} nova, o cenário da esteira vira AVISO e não erro, e aí
# alguém precisa abrir um PR de teste com um arquivo de dados para ver a
# esteira barrar. Da GUARDA DE DADOS da esteira só é exercitado o caminho de
# PUSH com base válida — os ramos de pull_request e de "sem base válida" seguem
# sem prova ali (a decisão do recorte mora em scripts/trava-dados.sh, que os
# cenários acima exercitam direto). Da VARREDURA DE SEGREDO da esteira são
# exercitados, desde 26/07/2026, o push com base válida, o push SEM base
# (ramificação nova), o clone sem nenhuma outra ref, o clone raso e o topo que
# não existe — falta o ramo de pull_request. Continuam sem prova aqui os outros
# passos do ci.yml: portão do golden na esteira, npm test e build.
#
# A sessão H4-A estende esta bateria: para acrescentar um cenário, chame
# `cenario_recusa` ou `cenario_passa` com o nome do arquivo — nada mais.
#
# ── O QUE A SESSÃO H4-A ACRESCENTOU (25/07/2026) ─────────────────────────────
# O bloco "PORTÃO DO GOLDEN — as passagens medidas" no fim deste arquivo. Cada
# cenário de lá afirma UMA das passagens que o portão deixava abertas (apagar,
# renomear, marcação que não corresponde, verde que não prova nada) ou o
# caminho feliz correspondente. Dois auxiliares novos fazem todo o trabalho:
#   cenario_golden_generico  monta o cenário, tenta um commit DE VERDADE com a
#                            mensagem que você passar, e afirma recusa ou passe
#   cenario_portao_direto    chama scripts/portao-golden.sh na mão, para os
#                            modos --commit e --intervalo, que não passam por
#                            hook nenhum
#
# ── O QUE A SESSÃO H4-A2 ACRESCENTOU (25/07/2026, mesmo dia) ─────────────────
# Onze cenários, e a razão de cada um está no comentário em cima dele. Os que
# guardam conserto medido no mesmo dia:
#   · ramificação nova não apanha pelo passado, e etiqueta criada em cima de
#     commit sem marcação não empurra mais a âncora (o furo do `git describe`);
#   · sem 'origin/main' nem 'main', o portão recusa dizendo o comando;
#   · `git commit --amend` só-de-mensagem passou a ser conferido;
#   · ano de quatro dígitos absurdo (25/07/0026) passou a ser recusado;
#   · marcação no rodapé com um "Refs #12" ao lado passou a ser aceita;
#   · cada porta de recusa ensina a saída DA SUA situação.
# O repositório de cenário passou a nascer em 'main' de propósito — o portão
# agora descobre a base pelo ramo principal, e o padrão de fábrica do git é
# 'master'. Ver `preparar_repo`.
#
# ── O QUE A JUNÇÃO PORTÃO+GUARDA ACRESCENTOU (25/07/2026) ────────────────────
# As duas frentes ficaram prontas em separado e chegaram brigando NESTE arquivo:
# a guarda de dados tirou a regra de dentro do .githooks/pre-commit e a pôs em
# scripts/ (padrões, exceções e o motor que decide), e a `preparar_repo` daqui
# só emprestava .githooks/ para o repositório descartável de cada cenário.
# Resultado medido: 29 dos 39 cenários vermelhos, todos com a mesma frase, "não
# encontrei .../scripts/trava-dados.sh". O conserto está em `preparar_repo`, com
# o porquê escrito lá.
#
# E a bateria passou a cobrir os dois lados: aos cenários do portão juntaram-se
# os da trava de dados (o bloco "Trava de dados — o que a guarda de 25/07/2026
# fechou"), incluindo os que só existem quando a regra é chamada direto, fora de
# hook — o código de saída 2 da trava quebrada, o intervalo do primeiro envio de
# ramificação nova e a isenção por conteúdo ao longo de vários commits.
#
# ACHADO DA JUNÇÃO, e a razão de a bateria ter crescido do lado do portão
# também: ao provar a mordida (desfazer um conserto de propósito e exigir que a
# bateria fique vermelha no cenário certo), o filtro `--diff-filter=ACMR` foi
# recolocado em `protegidos_do_commit` — o defeito exato que a H4-A tinha
# consertado — e a bateria continuou INTEIRA VERDE. Apagar arquivo protegido só
# estava provado pela porta do hook; pelos modos --commit e --intervalo, que são
# os que a esteira e o .githooks/pre-push rodam, não estava. Três cenários novos
# fecham isso, e com eles a mesma mutação fica vermelha.
#
# ── A LISTA DE ISENÇÕES DEIXOU DE SER TUDO OU NADA (25/07/2026, fim do dia) ──
# Foi ESTA bateria que mostrou a consequência de proteger scripts/excecoes-dados.txt
# inteiro: regerar um mockup que o Marco já tinha aprovado — mesmo caminho,
# conteúdo novo, hash novo na lista — passou a exigir a linha APROVADO-PELO-MARCO.
# Medido: aconteceu 3 vezes na história do repositório. O Marco olhou a conta e
# separou as naturezas; o arquivo saiu do PADRAO_PORTAO e no lugar entrou, no
# scripts/portao-golden.sh, a comparação do CONJUNTO DE CAMINHOS isentos antes ×
# depois. Acrescentar caminho exige a marcação; atualizar hash de caminho que já
# está lá, e remover caminho, passam.
#
# Dezenove cenários novos fixam isso, no bloco "A lista de isenções de dados" e
# no bloco de ataques logo abaixo dele. Os três modos do portão são exercitados
# separadamente de propósito — o hook lê o ÍNDICE, o --commit lê um commit
# pronto, o --intervalo percorre commit por commit — porque foi assim que se
# mediu, apagando cada metade da conferência, que uma delas pode ficar
# meio-verde sem a outra reclamar. Um auxiliar novo, `lista_de_isencoes`,
# reescreve a lista do zero: trocar só a semente do hash é "o arquivo foi
# regerado"; acrescentar um caminho é "mais um arquivo de dados pode ficar aqui".
#
# ── O QUE 26/07/2026 ACRESCENTOU: QUE COMMITS A VARREDURA DE SEGREDO OLHA ─────
# Seis cenários no fim deste arquivo, no bloco "Esteira — que commits a
# varredura de segredo olha". Eles nasceram de um buraco medido no mesmo dia: o
# passo de varredura de segredo do ci.yml, sem a base no evento, olhava UM
# commit — e "sem base no evento" é justamente o primeiro push de toda
# ramificação nova (o GitHub manda before=0000000). Medido neste repositório: a
# ramificação 'liga-a-bateria-de-aceite-na-auditoria' trouxe 12 commits, e o
# passo teria olhado 1. É o mesmo buraco que a guarda de dados fechou em
# 25/07/2026, no passo de cima do mesmo arquivo.
#
# Três coisas que estes cenários ensinam, e que só apareceram porque foram
# rodados:
#   · o gitleaks NÃO reclama de recorte inválido — com uma revisão que não
#     existe, ou com um pedaço vazio no meio (um espaço sobrando basta), ele
#     imprime "0 commits scanned / no leaks found" e sai com CÓDIGO 0. Por isso
#     o ci.yml passou a conferir o recorte pelo git ANTES de varrer, e um
#     cenário afirma isso;
#   · `git clone --depth 1` de um caminho comum sai INTEIRO ("--depth is ignored
#     in local clones") — o cenário do clone raso só é raso com file://, e ele
#     confere que o clone nasceu raso antes de afirmar qualquer coisa;
#   · a cadeia de segredo dos cenários é montada em pedaços de propósito:
#     escrita inteira neste arquivo, a varredura deste próprio repositório
#     acusaria a bateria.
#
# ── O QUE CONTINUA ABERTO (não morre aqui: está no relatório da junção) ───────
# ESTA BATERIA AINDA NÃO ESTÁ LIGADA NA ESTEIRA. Falta, no
# .github/workflows/ci.yml, um passo que a rode — algo como:
#
#     - name: Bateria do portão
#       run: sh scripts/portao-teste.sh
#
# depois do checkout e ANTES do passo "Portão do golden" (assim, quando a trava
# quebrar, a esteira diz "a bateria caiu" em vez de deixar o portão passar
# calado). Não precisa de node_modules nem de rede. Enquanto esse passo não
# existir, a bateria só vale quando alguém a roda à mão. Não foi acrescentado
# aqui de propósito: desde 25/07/2026 o ci.yml é arquivo protegido pelo portão
# (item 3a do Marco), então mexer nele é decisão dele, não da sessão.
#
# (O segundo item que a H4-A deixou anotado — o comentário desatualizado do
# .githooks/pre-push, que ensinava "base inexistente → confere só o topo" — foi
# corrigido nesta junção, porque o arquivo é dos dois lados. Ver lá.)
# ─────────────────────────────────────────────────────────────────────────────
set -u

# ─── AMBIENTE FIXO ───────────────────────────────────────────────────────────
# Estas variáveis o git trata como se fossem `git -c ...` na linha de comando,
# ou seja, mandam MAIS que a configuração do repositório descartável: o
# `git config` de `preparar_repo` não as vence (medido). A única defesa é
# tirá-las do ambiente antes de qualquer git rodar.
unset GIT_CONFIG_COUNT      # garante que ninguém desligue core.quotepath por variável de ambiente
unset GIT_DIR               # garante que o git ache o repositório descartável, e não outro
unset GIT_WORK_TREE         # garante que a árvore de trabalho seja a do repositório descartável
unset GIT_INDEX_FILE        # garante que o stage do cenário seja o do repositório descartável
unset GIT_COMMON_DIR        # garante que refs e config não venham de um repositório de fora
unset GIT_OBJECT_DIRECTORY  # garante que os objetos do commit fiquem no repositório descartável
# GIT_CONFIG_GLOBAL e GIT_CONFIG_SYSTEM ficam DE PROPÓSITO como estiverem: a
# configuração do repositório descartável vence as duas, e é exatamente isso
# que os cenários abaixo têm de provar continuar valendo.

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
HOOKS="$RAIZ/.githooks"
CI_YML="$RAIZ/.github/workflows/ci.yml"
PASSO_CI="Trava de dados no CI"
# O passo da varredura de segredo da esteira (cenários de 26/07/2026, no fim
# deste arquivo). É um PEDAÇO do nome, não o nome inteiro, de propósito: assim
# reescrever o final do título no ci.yml não derruba a extração — e se o começo
# mudar, o cenário vira AVISO com o motivo, nunca um verde silencioso.
PASSO_CI_GITLEAKS="Gitleaks —"

if [ ! -f "$HOOKS/pre-commit" ]; then
  echo "✗ Não achei $HOOKS/pre-commit — rode a bateria de dentro do repositório."
  exit 1
fi

# Os arquivos de regra que `preparar_repo` copia para dentro de cada cenário.
# Conferidos AQUI, uma vez, e não lá dentro: sem isto, um checkout incompleto
# devolveria 39 cenários vermelhos com a mesma frase, e quem lesse gastaria a
# manhã procurando um defeito na trava em vez de um arquivo que não veio.
faltando=""
for regra in portao-golden.sh trava-dados.sh padroes-dados.txt excecoes-dados.txt; do
  [ -f "$RAIZ/scripts/$regra" ] || faltando="$faltando  scripts/$regra
"
done
if [ -n "$faltando" ]; then
  echo "✗ Não achei os arquivos de regra que cada cenário precisa ter dentro dele:"
  printf '%s' "$faltando"
  echo "  Eles são versionados. Recupere-os e rode de novo — a bateria não roda"
  echo "  pela metade, porque bateria incompleta que sai verde é pior que nenhuma."
  exit 1
fi

# Rascunho de trabalho. Fica FORA do repositório para nunca sujar o git status.
RASCUNHO=$(mktemp -d "${TMPDIR:-/tmp}/portao-teste.XXXXXX") || exit 1
limpar() { rm -rf "$RASCUNHO"; }
trap limpar EXIT HUP INT TERM

TOTAL=0
FALHAS=0
AVISOS=0
motivo_ci=""

# Monta um repositório descartável com os hooks desta árvore ativos.
preparar_repo() {
  # mktemp em vez de um contador: `preparar_repo` roda dentro de $( ), que é
  # subshell, então qualquer contador incrementado aqui se perderia e dois
  # cenários acabariam no mesmo diretório.
  repo=$(mktemp -d "$RASCUNHO/repo.XXXXXX") || return 1
  (
    cd "$repo" || exit 1
    git init -q .
    # O NOME DO RAMO É FIXADO AQUI (Sessão H4-A2, 25/07/2026), e não deixado no
    # padrão: desde 25/07 o portão descobre a base pelo ramo principal
    # ('origin/main', depois 'main'), então um repositório de cenário que
    # nascesse em 'master' — o padrão de fábrica do git — mediria outra coisa
    # na máquina de quem não tem init.defaultBranch=main no ~/.gitconfig. Com
    # `symbolic-ref` antes do primeiro commit funciona em qualquer versão do
    # git (o `git init -b` só existe do 2.28 em diante). O repositório
    # descartável NÃO tem remoto, então 'origin/main' nunca existe nele e os
    # cenários exercitam o segundo degrau da busca, o 'main' local.
    git symbolic-ref HEAD refs/heads/main
    git config user.email "bateria@exemplo.invalido"
    git config user.name "Bateria do portão"
    git config core.hooksPath "$HOOKS"
    git config commit.gpgsign false
    # ─── as duas linhas que fazem o cenário ser o cenário ───
    # Garante que o git escape nome não-ASCII entre aspas e em octal
    # ("or\303\247amento.xlsx"), que é o padrão de fábrica e a ÚNICA condição
    # em que os cenários de acento têm o que pegar — sem isto a bateria fica
    # verde na máquina de quem pôs `quotepath = false` no ~/.gitconfig.
    git config core.quotepath true
    # Garante que o git reporte o nome em NFC (o "ç" como um caractere só), a
    # mesma forma em que os nomes estão escritos neste arquivo — sem isto, num
    # volume HFS+ ou com `precomposeunicode = false` herdado do ~/.gitconfig,
    # o git devolveria NFD e a conferência do nome falharia à toa.
    git config core.precomposeunicode true
    # ─── OS ARQUIVOS DE REGRA QUE OS HOOKS PROCURAM DENTRO DO REPOSITÓRIO ───
    # Os dois hooks resolvem a regra pela RAIZ DO REPOSITÓRIO onde o commit está
    # acontecendo — e essa raiz, aqui, é o repositório descartável, não esta
    # árvore. O `core.hooksPath` acima empresta os hooks; ele não empresta o que
    # os hooks leem. Sem as cópias abaixo, TODO commit da bateria morre em
    # "não encontrei ..." e até o caminho feliz parece bloqueado.
    #
    # POR QUE SÃO QUATRO ARQUIVOS E NÃO UM (Sessão H4 — junção portão+guarda,
    # 25/07/2026): até 25/07 a trava de dados morava DENTRO do .githooks/pre-commit,
    # então copiar o portão do golden bastava. A guarda de dados tirou a regra do
    # hook e a pôs em scripts/ — padrões, exceções e o motor que decide — para o
    # hook e a esteira passarem a chamar o MESMO arquivo. Ótimo para a regra, e
    # exatamente o que quebrou esta função: o pre-commit passou a exigir
    # scripts/trava-dados.sh na raiz do repositório de cada cenário, que só tinha
    # o portão do golden. Medido na junção: 29 dos 39 cenários vermelhos, todos
    # com a mesma frase ("não encontrei .../scripts/trava-dados.sh").
    #
    # São os arquivos DE VERDADE, nunca um dublê: um dublê envelhece calado e a
    # bateria passaria a jurar sobre um texto que nem o hook nem a esteira usam.
    mkdir -p scripts
    for regra in portao-golden.sh trava-dados.sh padroes-dados.txt excecoes-dados.txt; do
      # Falhar aqui derruba o subshell, `preparar_repo` devolve erro e o cenário
      # relata "não consegui montar o repositório descartável" — nunca um verde.
      cp "$RAIZ/scripts/$regra" "scripts/$regra" || exit 1
    done
    chmod +x scripts/portao-golden.sh scripts/trava-dados.sh
    # Um commit inicial limpo, para o cenário testar só o arquivo dele.
    echo "repositório descartável da bateria do portão" > LEIAME.md
    git add LEIAME.md
    git commit -qm "base sintética" --no-verify
  ) || return 1
  echo "$repo"
}

# Tenta commitar UM arquivo e devolve, na saída, o código de saída do git
# commit na primeira linha e a mensagem da trava no resto.
tentar_commit() {
  repo="$1"
  arquivo="$2"
  (
    cd "$repo" || exit 1
    caminho_pai=$(dirname "$arquivo")
    [ "$caminho_pai" = "." ] || mkdir -p "$caminho_pai"
    # Conteúdo SINTÉTICO — nenhum dado real entra em teste.
    printf 'sintetico\n' > "$arquivo"
    git add -f -- "$arquivo" >/dev/null 2>&1
    saida=$(git commit -m "cenario sintetico" 2>&1)
    codigo=$?
    printf '%s\n' "$codigo"
    printf '%s\n' "$saida"
  )
}

relatar() {
  afirmacao="$1"
  bateu="$2"
  detalhe="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$bateu" = "sim" ]; then
    printf '  ✓ %s\n' "$afirmacao"
  else
    FALHAS=$((FALHAS + 1))
    printf '  ✗ %s\n' "$afirmacao"
    printf '      %s\n' "$detalhe"
  fi
}

# NÃO CONFERIDO: o cenário não pôde ser montado por uma razão que não é um
# defeito da trava (o ci.yml mudou de forma). Aparece na tela e no resumo —
# nada falha em silêncio — mas não reprova a bateria, porque reprovar por isso
# ensinaria a ignorar o vermelho.
avisar() {
  AVISOS=$((AVISOS + 1))
  printf '  ⚠ %s — NÃO CONFERIDO\n' "$1"
  printf '      %s\n' "$2"
}

# Cenário "é recusado": o commit tem de falhar (exit ≠ 0) E a mensagem tem de
# citar o nome do arquivo — a trava que barra sem dizer qual arquivo é uma
# trava que falha em silêncio pela metade (princípio 4 do CLAUDE.md).
cenario_recusa() {
  arquivo="$1"
  repo=$(preparar_repo) || { relatar "$arquivo é recusado" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "$arquivo")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  mensagem=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$codigo" = "0" ]; then
    relatar "$arquivo é recusado (exit ≠ 0 e a mensagem cita o arquivo)" nao \
      "ENTROU NO COMMIT: git commit devolveu 0 e a trava não disse nada."
    return
  fi
  if ! printf '%s\n' "$mensagem" | grep -qF -- "$arquivo"; then
    relatar "$arquivo é recusado (exit ≠ 0 e a mensagem cita o arquivo)" nao \
      "recusou (exit $codigo), mas a mensagem não cita o nome do arquivo: $mensagem"
    return
  fi
  relatar "$arquivo é recusado (exit ≠ 0 e a mensagem cita o arquivo)" sim ""
}

# Cenário do NOME COM ESPAÇO — guarda a SEGUNDA correção do pre-commit, a linha
# que imprime a lista de recusados. O `printf '%s\n' $bloqueados` sem aspas que
# estava lá partia "orçamento da festa.xlsx" em três linhas: a mensagem passava
# a nomear "orçamento", "da" e "festa.xlsx", três arquivos que NÃO EXISTEM, e
# quem lesse iria procurar o arquivo errado. Planilha de festa tem espaço no
# nome quase sempre, então este não é um caso de laboratório.
cenario_recusa_nome_com_espaco() {
  arquivo="$1"
  afirmacao="$arquivo é recusado e a mensagem traz o nome INTEIRO numa linha só"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "$arquivo")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  mensagem=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$codigo" = "0" ]; then
    relatar "$afirmacao" nao \
      "ENTROU NO COMMIT: git commit devolveu 0 e a trava não disse nada."
    return
  fi

  # Tira o recuo de cada linha, para poder comparar a LINHA INTEIRA com o nome.
  linhas=$(printf '%s\n' "$mensagem" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  # A expansão de $arquivo SEM aspas logo abaixo é de propósito: ela parte o
  # nome nos espaços exatamente como o printf sem aspas partia dentro da trava.
  # Se um desses pedaços aparecer sozinho como uma linha da mensagem, a trava
  # está nomeando arquivo que não existe. `set -f` evita que um nome com * ou ?
  # vire glob no caminho.
  set -f
  for pedaco in $arquivo; do
    if printf '%s\n' "$linhas" | grep -qxF -- "$pedaco"; then
      set +f
      relatar "$afirmacao" nao \
        "recusou (exit $codigo), mas partiu o nome e apontou um arquivo que não existe: '$pedaco'"
      return
    fi
  done
  set +f

  if ! printf '%s\n' "$linhas" | grep -qxF -- "$arquivo"; then
    relatar "$afirmacao" nao \
      "recusou (exit $codigo), mas nenhuma linha traz o nome inteiro: $mensagem"
    return
  fi
  relatar "$afirmacao" sim ""
}

# Cenário "passa": o caminho feliz. Prova que a trava barra arquivo de DADOS e
# não virou um bloqueio geral que impede trabalhar.
cenario_passa() {
  arquivo="$1"
  repo=$(preparar_repo) || { relatar "$arquivo passa" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "$arquivo")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  mensagem=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$codigo" = "0" ]; then
    relatar "$arquivo passa (exit 0)" sim ""
  else
    relatar "$arquivo passa (exit 0)" nao \
      "BLOQUEOU um arquivo comum (exit $codigo): $mensagem"
  fi
}

# Cenário do PORTÃO DO GOLDEN: garante que mexer na leitura da trava de dados
# não afrouxou o outro portão. src/lib/calc.js sem a marcação de aprovação do
# Marco na mensagem tem de continuar recusado.
cenario_golden_recusa() {
  arquivo="src/lib/calc.js"
  repo=$(preparar_repo) || { relatar "$arquivo sem aprovação do Marco é recusado" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "$arquivo")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  mensagem=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$codigo" = "0" ]; then
    relatar "$arquivo sem aprovação do Marco é recusado" nao \
      "ENTROU NO COMMIT: o portão do golden deixou passar."
    return
  fi
  if ! printf '%s\n' "$mensagem" | grep -qF "APROVADO-PELO-MARCO"; then
    relatar "$arquivo sem aprovação do Marco é recusado" nao \
      "recusou (exit $codigo), mas a mensagem não explica o portão: $mensagem"
    return
  fi
  relatar "$arquivo sem aprovação do Marco é recusado" sim ""
}

# ─── PORTÃO DO GOLDEN — AUXILIARES DOS CENÁRIOS NOVOS (Sessão H4-A) ──────────
#
# Os cenários acima commitam sempre UM arquivo com uma mensagem fixa. As
# passagens do portão do golden precisam de mais: apagar um arquivo que já
# existia, renomear, e escolher a mensagem do commit palavra por palavra. Os
# dois auxiliares abaixo dão isso sem repetir o repositório descartável em cada
# cenário.

# Preparo usado por quase todos: um commit-base que põe o arquivo de fórmula no
# repositório descartável, para o cenário seguinte poder APAGAR ou RENOMEAR.
# --no-verify aqui é de propósito: quem está em teste é o commit SEGUINTE.
PREPARO_FORMULA='mkdir -p src/lib && printf "// sintetico\n" > src/lib/calc.js && git add src/lib/calc.js && git commit -qm "base sintetica com o arquivo de formula" --no-verify'

# Roda um `git commit` com a mensagem dada, no repositório já preparado por
# quem chamou. Devolve o código de saída na primeira linha e a saída no resto.
#
# O terceiro argumento leva bandeiras extras para o `git commit` — hoje só
# `--amend`, para o cenário do amend só-de-mensagem (H4-A2). Ele vai SEM aspas
# de propósito, para virar mais de uma palavra quando precisar; por isso só
# entra aqui texto escrito neste arquivo, nunca nome de arquivo de cenário.
commitar_com_mensagem() {
  repo="$1"
  mensagem="$2"
  extras="${3:-}"
  (
    cd "$repo" || exit 1
    # shellcheck disable=SC2086
    saida=$(git commit $extras -m "$mensagem" 2>&1)
    codigo=$?
    printf '%s\n' "$codigo"
    printf '%s\n' "$saida"
  )
}

# Cenário de portão do golden com preparo e mensagem livres.
#   $1 afirmação (em português, dizendo o que ela afirma)
#   $2 esperado: "recusa" ou "passa"
#   $3 comandos de preparo, rodados DENTRO do repositório descartável
#   $4 mensagem do commit que está sendo julgado
#   $5 bandeiras extras do `git commit` (opcional; hoje só "--amend")
#   $6 trecho que a recusa tem de conter (opcional; só no caso "recusa") — é
#      com ele que um cenário afirma QUE CAMINHO a recusa nomeou, e não apenas
#      que houve recusa
#
# Em "recusa" não basta o exit ≠ 0: a mensagem tem de citar a marcação
# APROVADO-PELO-MARCO, senão o commit foi barrado por outro motivo qualquer e o
# cenário estaria verde por acidente.
cenario_golden_generico() {
  afirmacao="$1"
  esperado="$2"
  preparo="$3"
  mensagem="$4"
  extras="${5:-}"
  trecho="${6:-}"

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if [ -n "$preparo" ]; then
    if ! ( cd "$repo" && eval "$preparo" ) >/dev/null 2>&1; then
      relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou): $preparo"
      return
    fi
  fi

  resultado=$(commitar_com_mensagem "$repo" "$mensagem" "$extras")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  saida=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$esperado" = "recusa" ]; then
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" nao "ENTROU NO COMMIT: git commit devolveu 0 e o portão não disse nada."
      return
    fi
    if ! printf '%s\n' "$saida" | grep -qF "APROVADO-PELO-MARCO"; then
      relatar "$afirmacao" nao "recusou (exit $codigo), mas a mensagem não é a do portão do golden: $saida"
      return
    fi
    # `grep -F` casa DENTRO de uma linha: se a recusa partisse um caminho com
    # espaço em vários pedaços, esta afirmação cairia — que é o ponto dela.
    if [ -n "$trecho" ] && ! printf '%s\n' "$saida" | grep -qF -- "$trecho"; then
      relatar "$afirmacao" nao "recusou (exit $codigo), mas a saída não diz \"$trecho\": $saida"
      return
    fi
    relatar "$afirmacao" sim ""
  else
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" sim ""
    else
      relatar "$afirmacao" nao "BLOQUEOU o que devia passar (exit $codigo): $saida"
    fi
  fi
}

# Escreve scripts/excecoes-dados.txt DO ZERO com os caminhos que receber, cada
# um com o comentário de motivo que a trava de dados exige na linha de cima e um
# hash sintético de 40 dígitos.
#
# O hash não aponta para arquivo nenhum de propósito: quem julga nestes cenários
# é o PORTÃO, e ele só olha o conjunto de CAMINHOS. Quem confere hash é a trava
# de dados, que tem cenários próprios (`preparo_mockup_rastreado` e os de baixo).
# Um segundo argumento repetido serve para variar o hash sem mexer no caminho —
# é o caso que o Marco quer fácil, o mockup regerado.
lista_de_isencoes() {  # $1 = semente do hash   $2.. = caminhos
  semente="$1"
  shift
  : > scripts/excecoes-dados.txt
  numero=0
  for caminho_isento in "$@"; do
    numero=$((numero + 1))
    printf '# motivo sintetico da bateria (entrada %s)\n' "$numero" >> scripts/excecoes-dados.txt
    printf '%039d%s %s\n' "$numero" "$semente" "$caminho_isento" >> scripts/excecoes-dados.txt
  done
}

# Cenário que chama o scripts/portao-golden.sh NA MÃO. Existe porque os modos
# --commit e --intervalo não passam por hook nenhum: são o roteiro do auditor
# (scripts/auditoria.sh) e a esteira, e as passagens do "verde que não prova
# nada" moram justamente ali.
#   $1 afirmação
#   $2 comandos de preparo (pode ser vazio)
#   $3 argumentos passados ao portão
#   $4 esperado: "recusa" ou "passa"
#   $5 trecho que a saída tem de conter (só no caso "recusa")
cenario_portao_direto() {
  afirmacao="$1"
  preparo="$2"
  argumentos="$3"
  esperado="$4"
  trecho="${5:-}"

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if [ -n "$preparo" ]; then
    if ! ( cd "$repo" && eval "$preparo" ) >/dev/null 2>&1; then
      relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou): $preparo"
      return
    fi
  fi

  saida=$(cd "$repo" && eval "sh scripts/portao-golden.sh $argumentos" 2>&1)
  codigo=$?

  if [ "$esperado" = "recusa" ]; then
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" nao "O PORTÃO APROVOU: devolveu exit 0 — saída: $saida"
      return
    fi
    if [ -n "$trecho" ] && ! printf '%s\n' "$saida" | grep -qF -- "$trecho"; then
      relatar "$afirmacao" nao "recusou (exit $codigo), mas a saída não diz \"$trecho\": $saida"
      return
    fi
    relatar "$afirmacao" sim ""
  else
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" sim ""
    else
      relatar "$afirmacao" nao "RECUSOU o que devia passar (exit $codigo): $saida"
    fi
  fi
}

# Cenário do CHERRY-PICK (H4-A2, 25/07/2026). Está separado dos outros porque
# ele não afirma que o portão barra: ele REGISTRA um limite medido.
#
# O QUE FOI MEDIDO em 25/07/2026, em repositório descartável: `git cherry-pick`
# NÃO dispara o hook commit-msg. Ou seja, trazer para cá um commit que mexe em
# fórmula e não tem marcação é uma porta que o portão LOCAL não cobre — e não
# adianta pedir para ele cobrir, porque quem decide rodar hook no cherry-pick é
# o git, não este script.
#
# O que a bateria CONSEGUE afirmar, e afirma abaixo:
#   1. o commit trazido pelo cherry-pick entra na árvore sem o hook reclamar
#      (a linha impressa diz o que foi medido, para o dia em que o git mudar);
#   2. o mesmo commit é BARRADO pelo modo --intervalo — o que roda no
#      .githooks/pre-push e na esteira. Ou seja: escapa do porteiro da porta,
#      não escapa do porteiro do prédio.
cenario_cherry_pick() {
  afirmacao="commit de fórmula trazido por cherry-pick é barrado no --intervalo (o hook não pega)"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }

  if ! ( cd "$repo" &&
    git checkout -qb lateral &&
    mkdir -p src/lib &&
    printf '// sintetico\n' > src/lib/calc.js &&
    git add src/lib/calc.js &&
    git commit -qm "mexe na conta sem aprovacao" --no-verify &&
    git checkout -q main ) >/dev/null 2>&1; then
    relatar "$afirmacao" nao "não consegui montar o ramo lateral do cenário"
    return
  fi

  base=$(cd "$repo" && git rev-parse HEAD) || { relatar "$afirmacao" nao "não consegui ler o commit base"; return; }
  saida_pick=$(cd "$repo" && git cherry-pick lateral 2>&1)
  codigo_pick=$?

  if [ "$codigo_pick" != "0" ]; then
    if printf '%s\n' "$saida_pick" | grep -qF "APROVADO-PELO-MARCO"; then
      printf '      medido: o cherry-pick FOI barrado pelo hook — o limite descrito acima deixou de valer nesta versão do git.\n'
    else
      relatar "$afirmacao" nao "o cherry-pick falhou por outro motivo, e o cenário não chegou a medir nada: $saida_pick"
      return
    fi
  else
    printf '      medido: o cherry-pick entrou sem o hook commit-msg disparar (limite conhecido do portão local).\n'
  fi

  saida=$(cd "$repo" && sh scripts/portao-golden.sh --intervalo "$base" HEAD 2>&1)
  codigo=$?

  if [ "$codigo" = "0" ]; then
    relatar "$afirmacao" nao "O PORTÃO APROVOU no --intervalo: exit 0 — saída: $saida"
    return
  fi
  if ! printf '%s\n' "$saida" | grep -qF -- "src/lib/calc.js"; then
    relatar "$afirmacao" nao "recusou (exit $codigo), mas a saída não nomeia src/lib/calc.js: $saida"
    return
  fi
  relatar "$afirmacao" sim ""
}

# Cenário do CONSELHO QUE A RECUSA DÁ (H4-A2, item C do Marco). Uma recusa que
# ensina o comando errado é pior que uma recusa muda: até 25/07/2026 as três
# portas mandavam `git commit --amend`, inclusive a do hook commit-msg — onde o
# commit AINDA NÃO EXISTE e o amend cai no commit ANTERIOR, engolindo o assunto
# dele. Este cenário afirma que cada porta ensina a saída da SUA situação.
cenario_conselho() {
  # ── 1. hook commit-msg num commit novo: não pode mandar fazer amend ──
  afirmacao="a recusa do hook (commit novo) ensina a REFAZER o commit e avisa contra o amend"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "src/lib/calc.js")
  saida=$(printf '%s\n' "$resultado" | tail -n +2)
  if printf '%s\n' "$saida" | grep -qF "AINDA NÃO EXISTE" &&
     printf '%s\n' "$saida" | grep -qF "engoliria o assunto"; then
    relatar "$afirmacao" sim ""
  else
    relatar "$afirmacao" nao "a recusa não avisa que o commit ainda não existe: $saida"
  fi

  # ── 2. hook commit-msg num amend: aí o amend É o conselho certo ──
  afirmacao="a recusa do amend só-de-mensagem ensina a repetir o amend, não a refazer o commit"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if ! ( cd "$repo" && eval "$PREPARO_FORMULA" ) >/dev/null 2>&1; then
    relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou)"
    return
  fi
  resultado=$(commitar_com_mensagem "$repo" "reescreve so a mensagem" "--amend")
  saida=$(printf '%s\n' "$resultado" | tail -n +2)
  if printf '%s\n' "$saida" | grep -qF "git commit --amend -m" &&
     printf '%s\n' "$saida" | grep -qF "Não há nada no stage"; then
    relatar "$afirmacao" sim ""
  else
    relatar "$afirmacao" nao "a recusa não explica de onde vieram os arquivos nem ensina o amend: $saida"
  fi

  # ── 3. commit que JÁ EXISTE: amend se for o último, rebase reword se não for ──
  afirmacao="a recusa de um commit já feito ensina amend ou rebase --interactive"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if ! ( cd "$repo" && eval "$PREPARO_FORMULA" ) >/dev/null 2>&1; then
    relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou)"
    return
  fi
  saida=$(cd "$repo" && sh scripts/portao-golden.sh --commit HEAD 2>&1)
  codigo=$?
  if [ "$codigo" = "0" ]; then
    relatar "$afirmacao" nao "O PORTÃO APROVOU um commit de fórmula sem marcação: $saida"
    return
  fi
  if printf '%s\n' "$saida" | grep -qF "git rebase --interactive" &&
     printf '%s\n' "$saida" | grep -qF "git commit --amend"; then
    relatar "$afirmacao" sim ""
  else
    relatar "$afirmacao" nao "a recusa não ensina como reescrever a mensagem de um commit já feito: $saida"
  fi

  # ── 4. a porta do "não consegui conferir" oferece a saída que funciona ──
  afirmacao="a recusa por cegueira oferece a base explícita, que resolve em uma linha"
  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  saida=$(cd "$repo" && sh scripts/portao-golden.sh --commit 0123456789abcdef0123456789abcdef01234567 2>&1)
  if printf '%s\n' "$saida" | grep -qF -- "--intervalo <commit-base>"; then
    relatar "$afirmacao" sim ""
  else
    relatar "$afirmacao" nao "a porta de cegueira não oferece a conferência com base explícita: $saida"
  fi
}

# ─── TRAVA DE DADOS — AUXILIARES DOS CENÁRIOS NOVOS (junção portão+guarda) ────
#
# Os cenários de dados que já existiam commitam UM arquivo e olham se o hook
# barrou. Isso cobre o nome do arquivo e nada mais. O que a guarda de dados
# entregou em 25/07/2026 precisa de três coisas que aqueles não dão:
#   · escolher o CONTEÚDO do arquivo (a isenção é por conteúdo, não por caminho);
#   · montar mais de um commit (o buraco do primeiro envio de ramificação nova);
#   · chamar scripts/trava-dados.sh direto, para conferir o CÓDIGO DE SAÍDA —
#     0 nada a barrar, 1 recusa, 2 a própria trava quebrada. Distinguir 1 de 2
#     é o ponto: uma trava quebrada que devolvesse 1 seria lida como "barrou
#     alguma coisa", e uma que devolvesse 0 seria lida como "está limpo".

# Escreve scripts/excecoes-dados.txt DO ZERO aprovando o conteúdo que
# docs/mockup.xlsx tem AGORA na árvore de trabalho. Do zero de propósito: o
# cenário fica com uma lista que ele controla inteira, em vez de depender do
# que a lista de verdade tiver no dia. O comentário na linha de cima não é
# enfeite — a trava recusa a lista inteira se o motivo não estiver escrito.
aprovar_mockup_atual() {
  printf '# mockup sintetico da bateria — nao tem numero de festa real nenhum\n' > scripts/excecoes-dados.txt
  printf '%s docs/mockup.xlsx\n' "$(git hash-object docs/mockup.xlsx)" >> scripts/excecoes-dados.txt
}

# Base dos cenários de isenção: um mockup .xlsx JÁ RASTREADO e já isento. É o
# retrato de docs/mockup-export-v2.xlsx no repositório de verdade, que é o
# arquivo por causa do qual a lista de exceções existe.
preparo_mockup_rastreado() {
  mkdir -p docs || return 1
  printf 'mockup versao 1\n' > docs/mockup.xlsx || return 1
  aprovar_mockup_atual || return 1
  git add -f docs/mockup.xlsx scripts/excecoes-dados.txt || return 1
  git commit -qm "mockup sintetico rastreado e isento" --no-verify || return 1
}

# Cenário de trava de dados com preparo e mensagem livres, passando por um
# `git commit` DE VERDADE (ou seja, pelo .githooks/pre-commit).
#   $1 afirmação   $2 "recusa" ou "passa"   $3 preparo   $4 trecho esperado na
#   saída (só no caso "recusa"; o padrão é o cabeçalho da recusa da trava)
cenario_dados_generico() {
  afirmacao="$1"
  esperado="$2"
  preparo="$3"
  trecho="${4:-Trava de dados}"

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if [ -n "$preparo" ]; then
    if ! ( cd "$repo" && eval "$preparo" ) >/dev/null 2>&1; then
      relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou): $preparo"
      return
    fi
  fi

  resultado=$(commitar_com_mensagem "$repo" "cenario sintetico da trava de dados")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  saida=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$esperado" = "recusa" ]; then
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" nao "ENTROU NO COMMIT: git commit devolveu 0 e a trava não disse nada."
      return
    fi
    if ! printf '%s\n' "$saida" | grep -qF -- "$trecho"; then
      relatar "$afirmacao" nao "recusou (exit $codigo), mas a saída não diz \"$trecho\": $saida"
      return
    fi
    relatar "$afirmacao" sim ""
  else
    if [ "$codigo" = "0" ]; then
      relatar "$afirmacao" sim ""
    else
      relatar "$afirmacao" nao "BLOQUEOU o que devia passar (exit $codigo): $saida"
    fi
  fi
}

# Cenário que chama scripts/trava-dados.sh NA MÃO, e afirma o CÓDIGO DE SAÍDA
# EXATO. Existe pelos mesmos motivos do `cenario_portao_direto`: os modos
# --commit e --intervalo são o que a esteira e o .githooks/pre-push rodam, e
# não passam por hook nenhum.
#   $1 afirmação   $2 preparo   $3 argumentos da trava
#   $4 código de saída esperado (0 | 1 | 2)   $5 trecho esperado (opcional)
cenario_trava_direta() {
  afirmacao="$1"
  preparo="$2"
  argumentos="$3"
  esperado="$4"
  trecho="${5:-}"

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  if [ -n "$preparo" ]; then
    if ! ( cd "$repo" && eval "$preparo" ) >/dev/null 2>&1; then
      relatar "$afirmacao" nao "não consegui montar o cenário (o preparo falhou): $preparo"
      return
    fi
  fi

  saida=$(cd "$repo" && eval "sh scripts/trava-dados.sh $argumentos" 2>&1)
  codigo=$?

  if [ "$codigo" != "$esperado" ]; then
    case "$esperado" in
      0) esperava="passar (0)" ;;
      1) esperava="recusar o arquivo (1)" ;;
      2) esperava="dizer que a própria trava está quebrada (2)" ;;
      *) esperava="sair $esperado" ;;
    esac
    relatar "$afirmacao" nao "esperava $esperava e saiu $codigo — saída: $saida"
    return
  fi
  if [ -n "$trecho" ] && ! printf '%s\n' "$saida" | grep -qF -- "$trecho"; then
    relatar "$afirmacao" nao "saiu $codigo, certo, mas a saída não diz \"$trecho\": $saida"
    return
  fi
  relatar "$afirmacao" sim ""
}

# Cenário do RÓTULO EM PORTUGUÊS. A recusa da trava tem duas partes de
# propósito: em cima, para quem levou o "não", o rótulo do padrão ("planilha de
# evento…"); no fim, sob "Referência", a expressão regular crua, para quem for
# MEXER em scripts/padroes-dados.txt. Este cenário afirma a separação — que o
# rótulo aparece e que a expressão NÃO vaza para a parte de cima. Sem ele, um
# refactor bem-intencionado da mensagem devolve o
# '\.(xlsx|xls|xlsm|xlsb|numbers|ods)[^/]*$' para a cara do Marco e ninguém vê.
cenario_rotulo_em_portugues() {
  arquivo="$1"
  rotulo="$2"
  cru="$3"
  afirmacao="a recusa de $arquivo mostra o rótulo em português, e a expressão crua só na Referência"

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  resultado=$(tentar_commit "$repo" "$arquivo")
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  saida=$(printf '%s\n' "$resultado" | tail -n +2)

  if [ "$codigo" = "0" ]; then
    relatar "$afirmacao" nao "ENTROU NO COMMIT: git commit devolveu 0 e a trava não disse nada."
    return
  fi
  # Tudo que vem ANTES da linha que abre a seção "Referência" — é o que a
  # pessoa lê primeiro e, muitas vezes, o único trecho que ela lê.
  acima=$(printf '%s\n' "$saida" | sed -n '1,/Referência, para quem for mexer/p')
  if ! printf '%s\n' "$acima" | grep -qF -- "$rotulo"; then
    relatar "$afirmacao" nao "a recusa não diz o que o padrão protege (\"$rotulo\"): $saida"
    return
  fi
  if printf '%s\n' "$acima" | grep -qF -- "$cru"; then
    relatar "$afirmacao" nao "a expressão regular crua ($cru) apareceu antes da seção Referência: $saida"
    return
  fi
  if ! printf '%s\n' "$saida" | grep -qF -- "$cru"; then
    relatar "$afirmacao" nao "a seção Referência não traz a expressão que casou ($cru): $saida"
    return
  fi
  relatar "$afirmacao" sim ""
}

# ─── A METADE DO CONSERTO QUE VIVE NA ESTEIRA ────────────────────────────────
# O mesmo defeito de leitura existia em duas cópias: no .githooks/pre-commit e
# no bloco de shell da guarda de dados do .github/workflows/ci.yml. A cópia do
# hook os cenários acima cobrem; a da esteira não era exercitada por nada — o
# ci.yml só roda no GitHub, e lá ninguém desfaz a correção de propósito para
# ver se a esteira reclama. Aqui o bloco de shell é EXTRAÍDO do YAML e rodado
# num repositório descartável com dois commits.
#
# Rodamos o bloco DE VERDADE, tirado do arquivo, e não uma cópia colada aqui:
# cópia colada envelhece calada e passaria a testar um texto que a esteira já
# não usa. Se a extração não der certo, o cenário vira AVISO com o motivo — a
# bateria não fica vermelha por causa de uma edição legítima do YAML.

# Copia para "$1" o corpo do `run: |` do passo cujo `name:` contém "$2" (por
# padrão, $PASSO_CI — a guarda de dados; a varredura de segredo passa o dela).
extrair_bloco_ci() {
  destino="$1"
  passo_alvo="${2:-$PASSO_CI}"
  if [ ! -f "$CI_YML" ]; then
    motivo_ci="não achei $CI_YML"
    return 1
  fi
  awk -v alvo="$passo_alvo" '
    index($0, "- name:") && index($0, alvo) { achou = 1; next }
    achou && !dentro && $0 ~ /^[[:space:]]*run:[[:space:]]*\|[[:space:]]*$/ {
      match($0, /^[[:space:]]*/); recuo = RLENGTH; dentro = 1; next
    }
    dentro {
      if ($0 ~ /^[[:space:]]*$/) { print ""; next }
      match($0, /^[[:space:]]*/)
      if (RLENGTH <= recuo) exit
      # O recuo do corpo é MEDIDO na primeira linha em vez de assumido em
      # "recuo + 2": assim reindentar o YAML não quebra a extração.
      if (corpo == 0) corpo = RLENGTH
      print substr($0, corpo + 1)
    }
  ' "$CI_YML" > "$destino"
  if [ ! -s "$destino" ]; then
    motivo_ci="não achei o corpo de \`run: |\` do passo \"$passo_alvo\" em $CI_YML"
    return 1
  fi
  return 0
}

# Troca as expressões ${{ }} do GitHub pelos valores de um evento de push.
preencher_bloco_ci() {
  origem="$1"; destino="$2"; base="$3"; topo="$4"
  sed -e 's|\${{ *github\.event_name *}}|push|g' \
      -e 's|\${{ *github\.event\.pull_request\.base\.sha *}}||g' \
      -e "s|\${{ *github\.event\.before *}}|$base|g" \
      -e "s|\${{ *github\.sha *}}|$topo|g" "$origem" > "$destino"
  # Sobrou expressão que esta bateria não sabe preencher? Então o cenário
  # rodaria um shell diferente do que a esteira roda — melhor avisar do que
  # afirmar uma cobertura que não existe.
  if grep -q '\${{' "$destino"; then
    sobrou=$(grep -n '\${{' "$destino" | head -n 3 | tr '\n' ' ')
    motivo_ci="o ci.yml passou a usar expressão \${{ }} que esta bateria não preenche: $sobrou"
    return 1
  fi
  if ! sh -n "$destino" 2>/dev/null; then
    motivo_ci="o bloco extraído do ci.yml não é shell válido depois de preenchido"
    return 1
  fi
  return 0
}

cenario_ci_guarda_dados() {
  arquivo="orçamento.xlsx"
  afirmacao="a guarda de dados do ci.yml acha $arquivo no intervalo do push"
  motivo_ci=""

  bloco="$RASCUNHO/bloco-ci.sh"
  extrair_bloco_ci "$bloco" || { avisar "$afirmacao" "$motivo_ci"; return; }

  repo=$(preparar_repo) || { relatar "$afirmacao" nao "não consegui montar o repositório descartável"; return; }
  base=$(cd "$repo" && git rev-parse HEAD) || { relatar "$afirmacao" nao "não consegui ler o commit base"; return; }

  # Segundo commit, com --no-verify DE PROPÓSITO: quem está em teste aqui é a
  # esteira, que existe justamente para pegar o que passou por fora do hook.
  if ! (
    cd "$repo" || exit 1
    printf 'sintetico\n' > "$arquivo"
    git add -f -- "$arquivo" >/dev/null 2>&1
    git commit -qm "dados sinteticos" --no-verify
  ); then
    relatar "$afirmacao" nao "não consegui criar o commit com o arquivo de dados"
    return
  fi
  topo=$(cd "$repo" && git rev-parse HEAD) || { relatar "$afirmacao" nao "não consegui ler o commit do topo"; return; }

  pronto="$RASCUNHO/bloco-ci-preenchido.sh"
  preencher_bloco_ci "$bloco" "$pronto" "$base" "$topo" || { avisar "$afirmacao" "$motivo_ci"; return; }

  saida=$(cd "$repo" && sh "$pronto" 2>&1)
  codigo=$?

  if [ "$codigo" = "0" ]; then
    relatar "$afirmacao" nao \
      "A ESTEIRA APROVOU: o bloco do ci.yml devolveu 0 e não barrou nada."
    return
  fi
  if ! printf '%s\n' "$saida" | grep -qF -- "$arquivo"; then
    relatar "$afirmacao" nao \
      "barrou (exit $codigo), mas a mensagem não cita o arquivo: $saida"
    return
  fi
  relatar "$afirmacao" sim ""
}

# ─── QUE RECORTE A VARREDURA DE SEGREDO DA ESTEIRA OLHA (26/07/2026) ──────────
# O DEFEITO QUE ESTES CENÁRIOS MEDEM, e que a bateria não enxergava: o passo da
# varredura de segredo do ci.yml, quando a base do push não vinha no evento,
# caía para `--log-opts="-1"` e olhava UM commit — justamente no push em que o
# intervalo é o MAIOR. E é o caso mais comum de todos: no primeiro push de uma
# ramificação nova o GitHub manda github.event.before = 0000000, porque a ref
# não existia. Medido neste repositório em 26/07/2026: a ramificação
# 'liga-a-bateria-de-aceite-na-auditoria' trouxe 12 commits, e o passo olharia 1.
# O nome do passo ("varrer segredos no range deste push") e o comentário em cima
# dele ("Nenhuma exceção viva") faziam isso parecer cobertura inteira.
#
# É o MESMO buraco que a guarda de dados fechou em 25/07/2026, no mesmo arquivo,
# no passo de cima — e a escada de recortes daqui é de propósito a mesma de
# scripts/trava-dados.sh, com UMA diferença declarada: quando não há como saber
# o intervalo (clone raso e nenhuma outra ref), aqui se FALHA. Verde que não
# executou a verificação é a classe de defeito que este repositório combate.
#
# CADA CENÁRIO monta um par "repositório de origem + clone da esteira" em
# mktemp -d, com uma ramificação de três commits, e roda o bloco de shell DE
# VERDADE extraído do ci.yml — nunca uma cópia colada aqui, que envelheceria
# calada. O segredo é uma cadeia SINTÉTICA (regra github-pat do gitleaks), e a
# contraprova de ramificação limpa existe justamente para que "ficou vermelho"
# não possa ser confundido com "recusa tudo".

# A pasta que faz o papel do RUNNER_TEMP da esteira, com o gitleaks dentro.
RUNNER_TEMP_BATERIA=""

# Escreve em "$1" uma cadeia sintética que o gitleaks reconhece.
#
# MONTADA EM PEDAÇOS DE PROPÓSITO: escrita inteira aqui dentro, a varredura de
# segredo DESTE repositório acusaria este próprio arquivo — o primeiro
# falso-positivo da casa seria a bateria que existe para evitá-los. O corpo é
# uma sequência óbvia (0123456789…), nunca um segredo real, nem truncado.
escrever_segredo_sintetico() {
  prefixo=$(printf 'g%sp_' 'h')
  corpo='0123456789abcdefghijABCDEFGHIJ012345'
  printf 'token_do_teste = %s%s\n' "$prefixo" "$corpo" > "$1"
}

# Empresta o gitleaks desta máquina para o papel de RUNNER_TEMP/gitleaks.
# Sem gitleaks instalado o cenário vira AVISO (não conferido): a esteira baixa o
# 8.30.1 pinado por sha256, e aqui não se baixa nada da rede.
preparar_gitleaks_da_bateria() {
  [ -n "$RUNNER_TEMP_BATERIA" ] && return 0
  binario=$(command -v gitleaks 2>/dev/null || true)
  if [ -z "$binario" ]; then
    motivo_ci="gitleaks não está instalado nesta máquina — a esteira baixa o 8.30.1 pinado por sha256, e esta bateria não baixa nada da rede. Instale-o (brew install gitleaks) e rode de novo: sem ele, NINGUÉM mede o recorte da varredura."
    return 1
  fi
  RUNNER_TEMP_BATERIA=$(mktemp -d "$RASCUNHO/runner-temp.XXXXXX") || {
    motivo_ci="não consegui criar a pasta que faz o papel de RUNNER_TEMP"
    RUNNER_TEMP_BATERIA=""
    return 1
  }
  ln -s "$binario" "$RUNNER_TEMP_BATERIA/gitleaks" 2>/dev/null ||
    cp "$binario" "$RUNNER_TEMP_BATERIA/gitleaks" || {
      motivo_ci="não consegui pôr o gitleaks em $RUNNER_TEMP_BATERIA"
      RUNNER_TEMP_BATERIA=""
      return 1
    }
  return 0
}

ajustar_git_do_cenario() {
  git config user.email "bateria@exemplo.invalido" || return 1
  git config user.name "Bateria do portão" || return 1
  git config commit.gpgsign false || return 1
  return 0
}

# Monta origem + ramificação de três commits (o do meio é o que carrega o
# segredo, quando pedido) e devolve, na saída, o caminho do clone que faz o
# papel do checkout da esteira.
#   $1 = sim|nao  (o commit do meio carrega a cadeia sintética?)
#   $2 = inteiro  → clone com TODAS as refs, como actions/checkout fetch-depth: 0
#        raso     → clone --depth 1 --single-branch, sem nenhuma outra ref
preparar_repo_esteira() {
  com_segredo="$1"
  formato="$2"
  casa=$(mktemp -d "$RASCUNHO/esteira.XXXXXX") || return 1
  (
    cd "$casa" || exit 1
    git init -q --bare origem.git || exit 1
    # O HEAD da origem é fixado em main como no GitHub — sem isto ele nasceria
    # em 'master' na máquina de quem não tem init.defaultBranch=main, e o clone
    # do cenário mediria outra coisa.
    git -C origem.git symbolic-ref HEAD refs/heads/main || exit 1
    git init -q trabalho || exit 1
    cd trabalho || exit 1
    git symbolic-ref HEAD refs/heads/main || exit 1
    ajustar_git_do_cenario || exit 1
    # O .gitleaks.toml DESTE repositório vai junto: é o arquivo que a esteira lê
    # (ele só estende as regras padrão), e o cenário tem de ler o mesmo.
    [ -f "$RAIZ/.gitleaks.toml" ] && cp "$RAIZ/.gitleaks.toml" .
    printf 'base sintética\n' > LEIAME.md
    git add -A >/dev/null 2>&1 || exit 1
    git commit -qm "base sintética" --no-verify || exit 1
    git remote add origin "$casa/origem.git" || exit 1
    git push -q origin main || exit 1
    git checkout -q -b ramificacao-nova || exit 1
    printf 'primeiro\n' > antes.txt
    git add antes.txt && git commit -qm "c1 — limpo" --no-verify || exit 1
    if [ "$com_segredo" = "sim" ]; then
      escrever_segredo_sintetico credenciais.txt
    else
      printf 'nenhum segredo aqui\n' > credenciais.txt
    fi
    git add credenciais.txt && git commit -qm "c2 — o do meio" --no-verify || exit 1
    printf 'terceiro\n' > depois.txt
    git add depois.txt && git commit -qm "c3 — limpo" --no-verify || exit 1
    git push -q origin ramificacao-nova || exit 1
  ) || return 1

  if [ "$formato" = "raso" ]; then
    (
      cd "$casa" || exit 1
      # file:// DE PROPÓSITO: com caminho comum o git responde "--depth is
      # ignored in local clones" e o clone sai INTEIRO — o cenário mediria outro
      # caso e ficaria verde sem nunca ter existido um clone raso (medido em
      # 26/07/2026, na primeira versão deste cenário).
      git clone -q --depth 1 --single-branch --branch ramificacao-nova \
        "file://$casa/origem.git" esteira || exit 1
      cd esteira || exit 1
      ajustar_git_do_cenario || exit 1
      # A premissa do cenário é o clone ser raso. Se um dia o git deixar de
      # cortar o histórico aqui, é melhor o cenário morrer do que passar a medir
      # outra coisa em silêncio.
      [ -f "$(git rev-parse --git-dir)/shallow" ] || exit 1
    ) || return 1
  else
    (
      cd "$casa" || exit 1
      git clone -q --no-single-branch origem.git esteira || exit 1
      cd esteira || exit 1
      ajustar_git_do_cenario || exit 1
      git checkout -q ramificacao-nova || exit 1
    ) || return 1
  fi
  echo "$casa/esteira"
}

# O caso "nem uma outra ref existe": um repositório SEM remoto, com os três
# commits no próprio ramo principal. Aqui não há de onde tirar um intervalo, e o
# clone NÃO é raso — então tudo o que existe está entrando agora.
preparar_repo_esteira_solto() {
  com_segredo="$1"
  casa=$(mktemp -d "$RASCUNHO/esteira-solta.XXXXXX") || return 1
  (
    cd "$casa" || exit 1
    git init -q repo || exit 1
    cd repo || exit 1
    git symbolic-ref HEAD refs/heads/main || exit 1
    ajustar_git_do_cenario || exit 1
    [ -f "$RAIZ/.gitleaks.toml" ] && cp "$RAIZ/.gitleaks.toml" .
    printf 'base sintética\n' > LEIAME.md
    git add -A >/dev/null 2>&1 || exit 1
    git commit -qm "c1 — base" --no-verify || exit 1
    if [ "$com_segredo" = "sim" ]; then
      escrever_segredo_sintetico credenciais.txt
    else
      printf 'nenhum segredo aqui\n' > credenciais.txt
    fi
    git add credenciais.txt && git commit -qm "c2 — o do meio" --no-verify || exit 1
    printf 'terceiro\n' > depois.txt
    git add depois.txt && git commit -qm "c3 — limpo" --no-verify || exit 1
  ) || return 1
  echo "$casa/repo"
}

# PREMISSA: este gitleaks, nesta máquina, acha a cadeia sintética quando varre o
# histórico INTEIRO. Conferir isso é o que separa "o recorte está errado" (o que
# a bateria quer medir) de "este gitleaks não reconhece a cadeia" — que daria
# vermelho pela razão errada, e ensinaria a ignorar o vermelho.
gitleaks_acha_no_historico() {
  ( cd "$1" && "$RUNNER_TEMP_BATERIA/gitleaks" git --no-banner --redact -v . ) \
    >/dev/null 2>&1
  codigo_premissa=$?
  [ "$codigo_premissa" != "0" ]
}

# Roda, dentro de "$1", o bloco de shell do passo da varredura de segredo do
# ci.yml, com um evento de push preenchido (base "$2", topo "$3"). Devolve o
# código de saída na primeira linha e a saída no resto.
rodar_varredura_da_esteira() {
  onde="$1"
  base_evento="$2"
  topo_evento="$3"
  bloco="$RASCUNHO/bloco-gitleaks.sh"
  pronto="$RASCUNHO/bloco-gitleaks-preenchido.sh"
  extrair_bloco_ci "$bloco" "$PASSO_CI_GITLEAKS" || return 1
  preencher_bloco_ci "$bloco" "$pronto" "$base_evento" "$topo_evento" || return 1
  (
    cd "$onde" || exit 1
    export RUNNER_TEMP="$RUNNER_TEMP_BATERIA"
    # COM `bash -e`, PORQUE É O QUE O GITHUB USA: todo bloco `run:` de workflow
    # roda em `bash -e {0}`. Rodar aqui com `sh` sem -e mediria um shell mais
    # tolerante que o da esteira — uma linha que morre com -e passaria verde na
    # bateria e derrubaria a esteira no primeiro push. Sem bash na máquina, cai
    # para sh e o cenário continua valendo para o resto.
    if command -v bash >/dev/null 2>&1; then
      saida_bloco=$(bash -e "$pronto" 2>&1)
    else
      saida_bloco=$(sh "$pronto" 2>&1)
    fi
    codigo_bloco=$?
    printf '%s\n' "$codigo_bloco"
    printf '%s\n' "$saida_bloco"
  )
}

# UM cenário da varredura de segredo da esteira.
#   $1 afirmação (o que se afirma, em português)
#   $2 sim|nao        — o commit do meio carrega a cadeia sintética
#   $3 inteiro|raso|solto — que clone a esteira recebeu
#   $4 zero|origem    — a base que o evento manda (0000000 ou o sha do ramo principal)
#   $5 acha|passa|falha — o que se espera do bloco
#   $6 trecho que a mensagem tem de citar (obrigatório em "falha": é o motivo)
#   $7 segundo trecho (opcional) — usado para afirmar QUANTOS commits o recorte
#      alcançou. Sem isto, "3 commits" e "1 commit" dariam o mesmo verde no
#      cenário do segredo, e era justamente o número que estava errado.
cenario_varredura_esteira() {
  afirmacao="$1"
  com_segredo="$2"
  formato="$3"
  qual_base="$4"
  espera="$5"
  # ${6:-} e ${7:-} porque a bateria roda com `set -u` (linha 135): um cenário
  # chamado sem o argumento opcional derrubaria o script inteiro em vez de
  # rodar — foi o que aconteceu na primeira versão destes cenários.
  trecho="${6:-}"
  trecho2="${7:-}"
  # $8: um topo FORÇADO no evento, para o caso em que o github.sha não existe
  # neste clone. É a família do cenário que a trava de dados já tem
  # ("--intervalo com um topo que NÃO EXISTE sai 2"), aqui pela porta da
  # varredura de segredo.
  topo_forcado="${8:-}"
  motivo_ci=""

  preparar_gitleaks_da_bateria || { avisar "$afirmacao" "$motivo_ci"; return; }

  if [ "$formato" = "solto" ]; then
    repo=$(preparar_repo_esteira_solto "$com_segredo")
  else
    repo=$(preparar_repo_esteira "$com_segredo" "$formato")
  fi
  if [ -z "$repo" ] || [ ! -d "$repo" ]; then
    relatar "$afirmacao" nao "não consegui montar o repositório descartável da esteira"
    return
  fi

  if [ "$com_segredo" = "sim" ] && ! gitleaks_acha_no_historico "$repo"; then
    avisar "$afirmacao" \
      "este gitleaks ($(gitleaks version 2>/dev/null || echo 'versão desconhecida')) não acha a cadeia sintética nem varrendo o histórico inteiro — a bateria não sabe medir o recorte com ele, e um vermelho aqui não seria sobre o recorte."
    return
  fi

  topo=$(cd "$repo" && git rev-parse HEAD 2>/dev/null)
  if [ -z "$topo" ]; then
    relatar "$afirmacao" nao "não consegui ler o commit do topo do repositório do cenário"
    return
  fi
  [ -n "$topo_forcado" ] && topo="$topo_forcado"
  if [ "$qual_base" = "origem" ]; then
    base=$(cd "$repo" && git rev-parse origin/main 2>/dev/null)
    if [ -z "$base" ]; then
      relatar "$afirmacao" nao "não achei origin/main no clone do cenário"
      return
    fi
  else
    base=0000000000000000000000000000000000000000
  fi

  resultado=$(rodar_varredura_da_esteira "$repo" "$base" "$topo")
  if [ -z "$resultado" ]; then
    avisar "$afirmacao" "$motivo_ci"
    return
  fi
  codigo=$(printf '%s\n' "$resultado" | head -n 1)
  mensagem=$(printf '%s\n' "$resultado" | tail -n +2)

  case "$espera" in
    acha)
      if [ "$codigo" = "0" ]; then
        relatar "$afirmacao" nao \
          "A ESTEIRA APROVOU: o bloco devolveu 0 com a cadeia sintética dentro da ramificação. Saída: $mensagem"
        return
      fi
      if ! printf '%s\n' "$mensagem" | grep -qF -- "credenciais.txt"; then
        relatar "$afirmacao" nao \
          "barrou (exit $codigo), mas a mensagem não diz em que arquivo: $mensagem"
        return
      fi
      ;;
    passa)
      if [ "$codigo" != "0" ]; then
        relatar "$afirmacao" nao \
          "FALSO POSITIVO: ramificação limpa e o bloco devolveu $codigo. Saída: $mensagem"
        return
      fi
      ;;
    falha)
      if [ "$codigo" = "0" ]; then
        relatar "$afirmacao" nao \
          "VERDE QUE NÃO CONFERIU NADA: o bloco devolveu 0 sem ter como saber que commits olhar. Saída: $mensagem"
        return
      fi
      if ! printf '%s\n' "$mensagem" | grep -qiF -- "$trecho"; then
        relatar "$afirmacao" nao \
          "falhou (exit $codigo), mas a mensagem não explica o motivo (não cita \"$trecho\"): $mensagem"
        return
      fi
      ;;
  esac

  if [ -n "$trecho" ] && [ "$espera" != "falha" ]; then
    if ! printf '%s\n' "$mensagem" | grep -qiF -- "$trecho"; then
      relatar "$afirmacao" nao \
        "o resultado bateu, mas a saída não diz qual recorte usou (não cita \"$trecho\"): $mensagem"
      return
    fi
  fi
  if [ -n "$trecho2" ]; then
    if ! printf '%s\n' "$mensagem" | grep -qiF -- "$trecho2"; then
      relatar "$afirmacao" nao \
        "o resultado bateu, mas o recorte não alcançou o que se esperava (não cita \"$trecho2\"): $mensagem"
      return
    fi
  fi
  relatar "$afirmacao" sim ""
}

# ─────────────────────────────────────────────────────────────────────────────
# CLONE NOVO → INSTALAÇÃO → TRAVA LIGADA (25/07/2026).
#
# Este é o único cenário que NÃO usa `preparar_repo`. Todos os outros emprestam
# os hooks desta árvore para um repositório descartável, ou seja, JÁ NASCEM com
# a trava ligada — e por isso nenhum deles enxergava o buraco medido em
# 25/07/2026: o git não liga hook nenhum ao clonar, `git config core.hooksPath`
# volta vazio num clone recém-feito, e commitar backup-producao.json e
# "orçamento.xlsx.bak" saía com CÓDIGO 0, sem `--no-verify` e sem `git add -f`.
# A bateria inteira ficava verde enquanto a máquina nova de qualquer pessoa
# continuava sem porteiro.
#
# Aqui o clone é DE VERDADE (raso, do próprio repositório) e a trava só pode
# aparecer se a instalação a ligar — que é o que o `prepare` do package.json
# faz, chamando .githooks/ligar-trava.sh.
#
# POR QUE O CLONE RECEBE UM TRANSPLANTE ANTES DE INSTALAR: `git clone` traz o
# que já foi COMMITADO, e o que precisa ser medido é o que está PRESTES a ser
# commitado. Sem o transplante, acrescentar o `prepare` deixaria este cenário
# vermelho até o commit existir, e apagar o `prepare` deixaria a bateria VERDE
# até o estrago ser empurrado — o pior dos dois mundos, nos dois sentidos. Então
# o cenário copia, por cima do clone, os arquivos DESTA árvore de trabalho que
# decidem o resultado: package.json (quem declara o `prepare`), .githooks/ (o
# porteiro e quem o liga) e os quatro arquivos de regra de scripts/ — os mesmos
# que `preparar_repo` copia, e pelo mesmo motivo: são os arquivos de verdade,
# nunca um dublê.
#
# AS QUATRO AFIRMAÇÕES, e por que são quatro e não uma. A armadilha que mordeu
# duas vezes em 25/07/2026 foi ler "não entrou" como "a trava barrou", quando o
# commit tinha morrido por outro motivo (o arquivo nem tinha sido preparado,
# porque o .gitignore o pegou antes). Então:
#   1. ANTES de instalar, o clone tem de nascer SEM core.hooksPath. Se já
#      nascesse com, os passos seguintes não estariam medindo a instalação.
#   2. `npm ci --ignore-scripts` tem de deixar o clone AINDA sem core.hooksPath.
#      É o limite declarado em .githooks/ligar-trava.sh e no ci.yml — quem pede
#      para não rodar script na instalação não ganha trava — e limite declarado
#      que ninguém mede é só uma frase bonita. Ver também "AS DUAS INSTALAÇÕES".
#   3. DEPOIS da instalação completa, core.hooksPath tem de alcançar o .githooks
#      do clone.
#   4. O commit dos dois arquivos de dado tem de FALHAR (código ≠ 0) E a
#      mensagem tem de nomear OS DOIS — e, antes disso, o cenário confere que
#      eles foram mesmo PREPARADOS (`git diff --cached --name-only` não vazio),
#      senão estaria medindo o .gitignore e não a trava.
#   5. CONTRAPROVA: no MESMO clone, um arquivo comum tem de passar (código 0).
#      Sem ela, um repositório quebrado a ponto de recusar tudo daria "barrado"
#      e pareceria uma vitória.
#
# AS DUAS INSTALAÇÕES, e o defeito que elas consertam. A primeira versão deste
# cenário rodava um `npm ci` só, e tratava QUALQUER falha de instalação como
# "NÃO CONFERIDO". Medido em 25/07/2026, quebrando o conserto de quatro jeitos:
# apagar o `prepare` do package.json e fazer o ligar-trava.sh sair 0 sem ligar
# nada davam VERMELHO (certo), mas renomear o ligar-trava.sh e apontá-lo para
# uma pasta errada davam AVISO — porque nesses dois a instalação MORRE, e o
# cenário engolia o motivo. Quebrar a fiação da trava virava "não medi".
#
# A separação: primeiro `npm ci --ignore-scripts`, que instala as dependências
# SEM rodar gancho nenhum. Se essa falhar, a máquina é que não consegue instalar
# (cache frio e sem rede) — aí sim AVISO, porque não é defeito da trava. Se ela
# passar e a instalação COMPLETA falhar, a diferença entre as duas é exatamente
# o `prepare`: VERMELHO, com o fim da saída do npm junto. De brisa, a primeira
# instalação é o que torna a afirmação 2 possível.
#
# A configuração global e a de sistema são neutralizadas (GIT_CONFIG_GLOBAL e
# GIT_CONFIG_SYSTEM apontando para /dev/null) só DENTRO deste cenário: se a
# máquina de quem roda já tivesse um core.hooksPath global, a afirmação 1
# passaria a medir o ~/.gitconfig da pessoa em vez do clone. Os outros cenários
# continuam com a configuração como está, de propósito (ver "AMBIENTE FIXO").
AF_ANTES="clone recém-feito nasce SEM core.hooksPath (o buraco de 25/07/2026)"
AF_IGNORE="instalar com --ignore-scripts NÃO liga a trava (o limite declarado)"
AF_DEPOIS="a instalação liga a trava: core.hooksPath alcança o .githooks do clone"
AF_RECUSA="nesse clone, commitar planilha e backup é RECUSADO nomeando os dois"
AF_CONTRA="e o mesmo clone deixa passar nota-comum.md (não virou 'tudo barrado')"

avisar_clone_inteiro() {
  avisar "$AF_ANTES" "$1"
  avisar "$AF_IGNORE" "$1"
  avisar "$AF_DEPOIS" "$1"
  avisar "$AF_RECUSA" "$1"
  avisar "$AF_CONTRA" "$1"
}

# Instala no clone: tenta sem rede primeiro, cai para a instalação normal se o
# cache do npm estiver frio. Devolve a saída do npm; o código de saída é o do
# `return`. Os "$@" extras vão para o npm (é assim que entra --ignore-scripts).
instalar_no_clone() {
  clone_alvo="$1"
  shift
  saida_npm_tentativa=$( cd "$clone_alvo" \
    && export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    && npm ci --offline --no-audit --no-fund "$@" 2>&1 )
  if [ $? = 0 ]; then
    printf '%s\n' "$saida_npm_tentativa"
    return 0
  fi
  saida_npm_tentativa=$( cd "$clone_alvo" \
    && export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    && npm ci --no-audit --no-fund "$@" 2>&1 )
  codigo_npm_tentativa=$?
  printf '%s\n' "$saida_npm_tentativa"
  return $codigo_npm_tentativa
}

# Lê core.hooksPath do clone e devolve a PASTA que aquele valor alcança (vazio
# quando não alcança nenhuma). Comparar pasta, e não texto, aceita o relativo
# '.githooks' que o ligar-trava.sh escreve e também um absoluto para a mesma
# pasta, mas recusa um absoluto para OUTRA pasta.
hooks_alcancados() {
  clone_lido="$1"
  valor=$(cd "$clone_lido" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
            git config core.hooksPath 2>/dev/null)
  [ -n "$valor" ] || return 0
  case "$valor" in
    /*) caminho="$valor" ;;
    *)  caminho="$clone_lido/$valor" ;;
  esac
  (cd "$caminho" 2>/dev/null && pwd -P)
}

cenario_clone_liga_trava() {
  dado_planilha="orçamento.xlsx.bak"
  dado_backup="backup-producao.json"

  if ! command -v npm >/dev/null 2>&1; then
    avisar_clone_inteiro "não há npm nesta máquina — sem instalação não há o que medir"
    return
  fi

  clone="$RASCUNHO/clone-novo"
  rm -rf "$clone"
  if ! git clone --quiet --depth 1 "file://$RAIZ" "$clone" 2>"$RASCUNHO/erro-clone.txt"; then
    avisar_clone_inteiro "não consegui clonar $RAIZ: $(tr '\n' ' ' < "$RASCUNHO/erro-clone.txt")"
    return
  fi

  # ── afirmação 1: o clone nasce sem porteiro ──
  antes=$(cd "$clone" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
            git config core.hooksPath 2>/dev/null)
  if [ -n "$antes" ]; then
    relatar "$AF_ANTES" nao \
      "o clone já nasceu com core.hooksPath = [$antes] — a medição de baixo não isolaria a instalação"
  else
    relatar "$AF_ANTES" sim ""
  fi

  # ── transplante da árvore de trabalho + identidade do repositório ──
  if ! (
    cd "$clone" || exit 1
    export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
    git config user.email "bateria@exemplo.invalido"
    git config user.name "Bateria do portão"
    git config commit.gpgsign false
    # Os mesmos dois ajustes de `preparar_repo`, e pelo mesmo motivo: o nome com
    # acento só é escapado em octal quando core.quotepath está ligado, e a
    # conferência do nome só bate quando o git reporta em NFC.
    git config core.quotepath true
    git config core.precomposeunicode true
    cp "$RAIZ/package.json" package.json || exit 1
    mkdir -p .githooks scripts
    cp "$RAIZ"/.githooks/* .githooks/ || exit 1
    for regra in portao-golden.sh trava-dados.sh padroes-dados.txt excecoes-dados.txt; do
      cp "$RAIZ/scripts/$regra" "scripts/$regra" || exit 1
    done
    chmod +x .githooks/pre-commit .githooks/commit-msg .githooks/pre-push \
             scripts/portao-golden.sh scripts/trava-dados.sh
    git add -- package.json .githooks scripts >/dev/null 2>&1
    # --no-verify por garantia: neste ponto o clone ainda não tem porteiro
    # nenhum ligado (é justamente o que a afirmação 1 acabou de medir).
    git commit -qm "transplante da árvore de trabalho" --no-verify >/dev/null 2>&1 || true
  ); then
    avisar_clone_inteiro "não consegui transplantar a árvore de trabalho para dentro do clone"
    return
  fi

  # ── primeira instalação: SEM rodar gancho nenhum ──
  # Serve a dois propósitos de uma vez: mede a afirmação 2 (o limite declarado) e
  # separa "esta máquina não consegue instalar" de "a fiação da trava quebrou".
  # Só ESTA falha vira AVISO — daqui para baixo, falhar é vermelho.
  saida_npm=$(instalar_no_clone "$clone" --ignore-scripts)
  if [ $? != 0 ]; then
    avisar_clone_inteiro "esta máquina não instala nem com --ignore-scripts (cache frio e sem rede?): $(printf '%s' "$saida_npm" | tail -n 3 | tr '\n' ' ')"
    return
  fi

  # ── afirmação 2: --ignore-scripts não liga a trava ──
  onde_deveria=$(cd "$clone/.githooks" 2>/dev/null && pwd -P)
  apos_ignore=$(hooks_alcancados "$clone")
  if [ -n "$apos_ignore" ]; then
    relatar "$AF_IGNORE" nao \
      "depois de 'npm ci --ignore-scripts' o clone já está com core.hooksPath alcançando [$apos_ignore] — ou o limite mudou, ou alguma outra coisa está ligando a trava, e aí as afirmações de baixo não medem o 'prepare'"
  else
    relatar "$AF_IGNORE" sim ""
  fi

  # ── segunda instalação: a completa, com o `prepare` ──
  saida_npm=$(instalar_no_clone "$clone")
  if [ $? != 0 ]; then
    # A instalação sem gancho passou dois passos acima; a única diferença é o
    # `prepare`. Então isto é defeito da fiação da trava, e é vermelho.
    relatar "$AF_DEPOIS" nao \
      "a instalação COMPLETA falhou, e a mesma instalação com --ignore-scripts tinha passado — a diferença entre as duas é o 'prepare' do package.json. Fim da saída do npm: $(printf '%s' "$saida_npm" | tail -n 4 | tr '\n' ' ')"
    avisar "$AF_RECUSA" "a instalação completa falhou (ver a linha vermelha acima)"
    avisar "$AF_CONTRA" "a instalação completa falhou (ver a linha vermelha acima)"
    return
  fi

  # ── afirmação 3: a instalação ligou a trava ──
  onde_aponta=$(hooks_alcancados "$clone")
  if [ -z "$onde_deveria" ] || [ "$onde_aponta" != "$onde_deveria" ]; then
    relatar "$AF_DEPOIS" nao \
      "depois da instalação, core.hooksPath alcança [${onde_aponta:-nenhuma pasta}] em vez de [$onde_deveria]. Fim da saída do npm: $(printf '%s' "$saida_npm" | tail -n 3 | tr '\n' ' ')"
    # Sem a trava ligada, as duas afirmações seguintes não medem a trava.
    avisar "$AF_RECUSA" "a trava não ficou ligada (ver a linha vermelha acima)"
    avisar "$AF_CONTRA" "a trava não ficou ligada (ver a linha vermelha acima)"
    return
  fi
  relatar "$AF_DEPOIS" sim ""

  # ── afirmação 4: o commit dos dados é recusado, nomeando os dois arquivos ──
  preparados=$( cd "$clone" || exit 1
    export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
    printf 'sintetico\n' > "$dado_planilha"
    printf 'sintetico\n' > "$dado_backup"
    # `git add` SEM -f de propósito: é o que uma pessoa digita. Se o .gitignore
    # pegar um deles antes, ele não aparece aqui e a conferência abaixo acusa —
    # em vez de deixar o cenário concluir sobre a trava medindo o .gitignore.
    git add -- "$dado_planilha" "$dado_backup" >/dev/null 2>&1
    # core.quotepath=false para a lista sair com o nome LEGÍVEL. Sem isso o git
    # devolve "or\303\247amento.xlsx.bak" escapado em octal, a comparação com o
    # nome literal não bate, e a conferência de baixo anuncia que o arquivo não
    # foi preparado quando ele foi. Medido em 25/07/2026, no roteiro ao vivo.
    git -c core.quotepath=false -c core.precomposeunicode=true \
        diff --cached --name-only )
  # Cada arquivo é conferido pelo NOME, não pela lista estar não-vazia: se o
  # .gitignore pegar só um dos dois, a bateria tem de dizer QUAL — senão a
  # afirmação de baixo daria vermelho por "a mensagem não cita o arquivo" e
  # mandaria procurar defeito na trava, quando o arquivo nem chegou até ela.
  nao_preparados=""
  for nome in "$dado_planilha" "$dado_backup"; do
    printf '%s\n' "$preparados" | grep -qxF -- "$nome" || nao_preparados="$nao_preparados $nome"
  done
  if [ -n "$nao_preparados" ]; then
    relatar "$AF_RECUSA" nao \
      "o .gitignore pegou antes da trava, então este cenário não mediria a trava para:$nao_preparados (preparados de fato: $(printf '%s' "$preparados" | tr '\n' ' '))"
    avisar "$AF_CONTRA" "o cenário anterior não chegou a exercitar a trava"
    return
  fi

  saida_commit=$( cd "$clone" \
    && export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    && git commit -m "planilha e backup da festa" 2>&1 )
  codigo_commit=$?

  if [ "$codigo_commit" = "0" ]; then
    relatar "$AF_RECUSA" nao \
      "ENTROU NO COMMIT: git commit devolveu 0 num clone com a trava supostamente ligada. Preparados eram: $(printf '%s' "$preparados" | tr '\n' ' ')"
  else
    faltou=""
    for nome in "$dado_planilha" "$dado_backup"; do
      printf '%s\n' "$saida_commit" | grep -qF -- "$nome" || faltou="$faltou $nome"
    done
    if [ -n "$faltou" ]; then
      relatar "$AF_RECUSA" nao \
        "recusou (código $codigo_commit), mas a mensagem não cita:$faltou — saída: $(printf '%s' "$saida_commit" | tr '\n' ' ')"
    else
      relatar "$AF_RECUSA" sim ""
    fi
  fi

  # ── afirmação 5: a contraprova, no MESMO clone ──
  saida_contra=$( cd "$clone" \
    && export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    && git reset -q \
    && printf 'sintetico\n' > nota-comum.md \
    && git add -- nota-comum.md \
    && git commit -m "uma nota comum de projeto" 2>&1 )
  codigo_contra=$?
  if [ "$codigo_contra" = "0" ]; then
    relatar "$AF_CONTRA" sim ""
  else
    relatar "$AF_CONTRA" nao \
      "BLOQUEOU um arquivo comum (código $codigo_contra) — a recusa de cima não prova nada sobre dado: $(printf '%s' "$saida_contra" | tr '\n' ' ')"
  fi

  # node_modules do clone é grande; sai agora em vez de esperar o trap.
  rm -rf "$clone"
}

echo ""
echo "PORTÃO — bateria de aceite"
echo "hooks conferidos: $HOOKS"
echo ""
echo "Clone novo de máquina nova (o buraco de 25/07/2026: o git não liga hook ao clonar):"
cenario_clone_liga_trava
echo ""
echo "Arquivo de DADOS com nome em português (o defeito de 24/07/2026):"
cenario_recusa "orçamento.xlsx"
cenario_recusa "planilha-café.xlsx"
cenario_recusa "backups/relatório-completo.json"
cenario_recusa "importacoes/importação.xlsx"
echo ""
echo "Nome com espaço (a mensagem tem de apontar o arquivo certo):"
cenario_recusa_nome_com_espaco "orçamento da festa.xlsx"
echo ""
echo "Caminho feliz (a trava não pode virar bloqueio geral):"
# ATENÇÃO: aqui havia `cenario_passa "package.json"`. O package.json ENTROU na
# lista protegida do portão do golden em 25/07/2026 (decisão do Marco, item 3b
# do DECISOES-MARCO-H4.md), então ele passou a exigir a marcação e deixou de
# ser um "arquivo comum". Trocado por um arquivo que continua comum — o que
# este cenário sempre quis afirmar é que a trava de DADOS não virou bloqueio
# geral, e isso segue afirmado.
cenario_passa "vite.config.js"
cenario_passa "docs/nota-comum.md"
echo ""
echo "Portão do golden (continua de pé):"
cenario_golden_recusa
echo ""

echo "Portão do golden — as passagens medidas (Sessão H4-A, 25/07/2026):"
echo ""
echo "  Apagar e renomear (antes passavam com exit 0):"
cenario_golden_generico \
  "apagar src/lib/calc.js sem aprovação do Marco é recusado" \
  recusa \
  "$PREPARO_FORMULA && git rm -q src/lib/calc.js" \
  "remove arquivo antigo"
cenario_golden_generico \
  "renomear src/lib/calc.js SEM alterar um byte é recusado" \
  recusa \
  "$PREPARO_FORMULA && git mv src/lib/calc.js src/lib/calculo.js" \
  "organiza as pastas do projeto"
cenario_golden_generico \
  "renomear src/lib/calc.js JUNTO com a mudança do número é recusado" \
  recusa \
  "$PREPARO_FORMULA && git mv src/lib/calc.js src/lib/calculo.js && printf '// sintetico com numero novo\n' > src/lib/calculo.js && git add src/lib/calculo.js" \
  "organiza as pastas do projeto"

# ── OS MESMOS DOIS, PELA PORTA DA ESTEIRA (buraco de cobertura achado na junção
#    portão+guarda, 25/07/2026) ────────────────────────────────────────────────
# Os três cenários acima passam pelo hook commit-msg, que lê o STAGE. Os modos
# --commit e --intervalo leem o COMMIT, por outro caminho no código
# (`protegidos_do_commit`), e são justamente o que o .githooks/pre-push e a
# esteira rodam — a rede que existe para pegar o que o hook não pegou, porque um
# clone recém-feito nasce sem hook nenhum.
#
# COMO ISTO FOI ACHADO, e por que não é cenário de laboratório: ao provar a
# mordida da bateria, o filtro `--diff-filter=ACMR` foi recolocado de propósito
# em `protegidos_do_commit` — o defeito exato que a Sessão H4-A tinha
# consertado — e a bateria continuou 75 de 75 VERDE. Medido no mesmo repositório
# descartável: com o filtro de volta, apagar src/lib/calc.js sem marcação saía
# exit 0 no --commit E no --intervalo. Ou seja, dava para desfazer o conserto do
# apagado na metade que a esteira usa e nenhum cenário reclamava.
cenario_portao_direto \
  "apagar src/lib/calc.js é recusado também no --commit (a porta da esteira)" \
  "$PREPARO_FORMULA && git rm -q src/lib/calc.js && git commit -qm 'remove arquivo antigo' --no-verify" \
  "--commit HEAD" \
  recusa \
  "src/lib/calc.js"
cenario_portao_direto \
  "apagar src/lib/calc.js é recusado também no --intervalo (o que o pre-push roda)" \
  "$PREPARO_FORMULA && git rm -q src/lib/calc.js && git commit -qm 'remove arquivo antigo' --no-verify" \
  "--intervalo HEAD~1 HEAD" \
  recusa \
  "src/lib/calc.js"
cenario_portao_direto \
  "renomear src/lib/calc.js é recusado no --intervalo, e a recusa nomeia o caminho ANTIGO" \
  "$PREPARO_FORMULA && git mv src/lib/calc.js src/lib/calculo.js && git commit -qm 'organiza as pastas' --no-verify" \
  "--intervalo HEAD~1 HEAD" \
  recusa \
  "src/lib/calc.js"

echo ""
echo "  Caminho feliz do portão (ele não pode virar bloqueio geral):"
cenario_golden_generico \
  "commit que não toca arquivo protegido passa sem marcação nenhuma" \
  passa \
  "mkdir -p src/componentes && printf 'sintetico\n' > src/componentes/Tela.jsx && git add src/componentes/Tela.jsx" \
  "mexe numa tela, sem tocar em conta"
cenario_golden_generico \
  "marcação válida (data real, no passado, motivo com três palavras) passa" \
  passa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote"
# O CONSERTO do detalhe cruel medido em 25/07/2026: uma marcação LEGÍTIMA
# indentada com dois espaços era recusada, enquanto uma solta e inventada era
# aceita. Recuo pequeno agora é tolerado — ninguém apanha por espaço em branco.
cenario_golden_generico \
  "marcação legítima com DOIS ESPAÇOS de recuo passa (o conserto do recuo)" \
  passa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

  APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote"

echo ""
echo "  Marcação que não corresponde ao que diz (antes todas passavam):"
cenario_golden_generico \
  "marcação com data que NÃO EXISTE no calendário (31/02) é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 31/02/2026 corrigir o rateio do cashback por lote"
cenario_golden_generico \
  "marcação com data NO FUTURO é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 31/12/2099 corrigir o rateio do cashback por lote"
cenario_golden_generico \
  "marcação com motivo de UMA PALAVRA é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 19/07/2026 corrigir"
cenario_golden_generico \
  "marcação solta no MEIO do corpo (copiada de outro commit) é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "organiza as pastas do projeto

Move arquivos de lugar sem mudar comportamento nenhum.
APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote
E segue sem alterar um byte de conta."

echo ""
echo "  Verde que não prova nada (o portão tem de dizer \"não olhei\"):"
cenario_portao_direto \
  "--commit com identificador que NÃO EXISTE é recusado" \
  "" \
  "--commit 0123456789abcdef0123456789abcdef01234567" \
  recusa \
  "NÃO CONSEGUI CONFERIR"
cenario_portao_direto \
  "--intervalo com o TOPO ATRÁS DA BASE é recusado" \
  "printf 'sintetico\n' > outro.txt && git add outro.txt && git commit -qm 'segundo commit sintetico' --no-verify" \
  "--intervalo HEAD HEAD~1" \
  recusa \
  "NÃO CONSEGUI CONFERIR"

echo ""
echo "  Base zerada — o portão calcula a base pelo ramo principal (item 15 do Marco, 25/07/2026):"
# O critério de aceite número 1: ramificação nova NÃO pode apanhar pelo passado.
# O commit que mexe no calc.js sem marcação fica em MAIN, antes de a
# ramificação nascer; os commits novos são inocentes. Se o portão conferisse
# "tudo desde a última etiqueta" ou "tudo desde o começo", ele barraria um
# trabalho que não tem nada com fórmula — e portão que barra à toa é portão que
# alguém desliga.
cenario_portao_direto \
  "ramificação nova confere só os commits DELA, sem recusar retroativamente o que já estava em main" \
  "$PREPARO_FORMULA && git checkout -qb ramo/nova && printf 'sintetico\n' > nota-da-ramificacao.md && git add nota-da-ramificacao.md && git commit -qm 'nota comum na ramificacao' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  passa
# O critério de aceite número 2: o caminho MEDIDO COMO FURADO em 25/07/2026.
# Com a saída antiga (`git describe --tags --abbrev=0`), a etiqueta criada EM
# CIMA do commit sem marcação virava a âncora, o commit ruim ficava FORA do
# intervalo e o portão dizia "nada a barrar" com a fórmula alterada. A etiqueta
# continua aqui, no mesmo lugar, de propósito: ela não pode mais mudar nada.
cenario_portao_direto \
  "etiqueta criada EM CIMA do commit sem marcação não empurra mais a âncora — o portão RECUSA" \
  "git checkout -qb ramo/com-etiqueta && mkdir -p src/lib && printf '// sintetico\n' > src/lib/calc.js && git add src/lib/calc.js && git commit -qm 'mexe na conta sem aprovacao' --no-verify && git tag etiqueta-em-cima && printf 'sintetico\n' > nota-de-cima.md && git add nota-de-cima.md && git commit -qm 'nota comum por cima' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  recusa \
  "src/lib/calc.js"
# O critério de aceite número 3: sem ramo principal, o portão não inventa base.
# A afirmação exige o COMANDO na saída, não só a recusa — recusa que não diz o
# próximo passo é recusa que ensina a desligar a trava (princípio 4).
cenario_portao_direto \
  "sem 'origin/main' nem 'main' no clone, a base não é inventada: recusa dizendo o comando exato" \
  "git branch -m main trabalho && printf 'sintetico\n' > nota-comum.md && git add nota-comum.md && git commit -qm 'nota comum sintetica' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  recusa \
  "git fetch origin main"
# Os dois lados da escolha conservadora do dia (anotada no relatório): quando o
# topo já está inteiro dentro do ramo principal, nenhum commit é conferido — e
# o portão decide pelo único sinal que tem, a âncora ser remota ou não.
# SEM ramo remoto: nada aqui foi publicado, pode ser o primeiro envio de um
# repositório novo, cujo histórico jamais passou por portão. Recusa.
cenario_portao_direto \
  "topo idêntico ao 'main' local, sem ramo remoto: nada foi conferido, então recusa" \
  "" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  recusa \
  "NÃO CONSEGUI CONFERIR"
# COM ramo remoto: os commits já entraram no principal por um push, que passou
# por este mesmo portão. Passa — e este é o caso do `git push --tags`, medido
# em 25/07/2026: o pre-push recebe a etiqueta com remote_sha zerado, igual a
# uma ramificação nova. Recusar aqui ensinaria `--no-verify`.
# O `--no-verify` no push do preparo é de propósito: o preparo monta o cenário,
# não é o que está sendo julgado.
cenario_portao_direto \
  "topo idêntico ao 'origin/main' passa (é o caso de empurrar etiqueta)" \
  "git init -q --bare remoto-sintetico.git && git remote add origin remoto-sintetico.git && git push -q --no-verify origin main && git tag etiqueta-de-versao" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  passa

echo ""
echo "  O amend só-de-mensagem (H4-A2: ele apagava a marcação e o portão aplaudia):"
cenario_golden_generico \
  "amend que reescreve SÓ a mensagem de um commit de fórmula é recusado" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js && git commit -qm 'mexe na conta sem aprovacao' --no-verify" \
  "reescreve so a mensagem, e a marcacao some" \
  "--amend"
cenario_golden_generico \
  "amend só-de-mensagem COM marcação válida passa (o conserto não virou bloqueio geral)" \
  passa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js && git commit -qm 'mexe na conta sem aprovacao' --no-verify" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote" \
  "--amend"
cenario_golden_generico \
  "amend só-de-mensagem num commit que NÃO toca arquivo protegido passa" \
  passa \
  "mkdir -p src/componentes && printf 'sintetico\n' > src/componentes/Tela.jsx && git add src/componentes/Tela.jsx && git commit -qm 'mexe numa tela' --no-verify" \
  "mexe numa tela (mensagem reescrita)" \
  "--amend"

echo ""
echo "  Cherry-pick (registro de limite medido, não promessa):"
cenario_cherry_pick

echo ""
echo "  Ano absurdo e rodapé com vizinho (H4-A2, itens 6 e 7):"
cenario_golden_generico \
  "marcação com ano de quatro dígitos absurdo (25/07/0026) é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

APROVADO-PELO-MARCO: 25/07/0026 corrigir o rateio do cashback por lote"
# Este é o afrouxamento: a marcação está no RODAPÉ, junto de um "Refs #12" que
# não tem a forma `Chave: valor`. A regra antiga exigia o bloco inteiro em
# forma de trailer e recusava a marcação legítima por causa do vizinho.
cenario_golden_generico \
  "marcação no rodapé junto de uma linha \"Refs #12\" PASSA" \
  passa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "ajusta o rateio do cashback

Muda o rateio para bater com a planilha que o Marco conferiu.

Refs #12
APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote"

# A marcação escrita NO LUGAR do assunto: recusada, e com o diagnóstico certo
# (o assunto é o que aparece na lista de commits). Sem este caso, a mensagem de
# uma linha só cairia no diagnóstico de "última linha colada na prosa".
cenario_golden_generico \
  "marcação escrita no ASSUNTO do commit é recusada" \
  recusa \
  "$PREPARO_FORMULA && printf '// sintetico com numero novo\n' > src/lib/calc.js && git add src/lib/calc.js" \
  "APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote"

echo ""
echo "  O conselho que cada recusa dá (item C: recusa que ensina o comando errado é armadilha):"
cenario_conselho

echo ""
echo "  O portão protegendo a si mesmo (item 3a do Marco, 25/07/2026):"
cenario_golden_generico \
  "remover o passo do portão do .github/workflows/ci.yml é recusado" \
  recusa \
  "mkdir -p .github/workflows && printf 'passos:\n  - name: Portao do golden\n  - name: Testes\n' > .github/workflows/ci.yml && git add .github/workflows/ci.yml && git commit -qm 'base com a esteira sintetica' --no-verify && printf 'passos:\n  - name: Testes\n' > .github/workflows/ci.yml && git add .github/workflows/ci.yml" \
  "simplifica a esteira"
cenario_golden_generico \
  "mexer no próprio scripts/portao-golden.sh é recusado" \
  recusa \
  "printf '# sintetico\n' >> scripts/portao-golden.sh && git add -f scripts/portao-golden.sh" \
  "ajusta o portao"

echo ""
echo "  A lista de isenções de dados — CAMINHO NOVO é portão, HASH NOVO não é (Marco, 25/07/2026):"
# scripts/excecoes-dados.txt esteve dentro do PADRAO_PORTAO por algumas horas de
# 25/07/2026 e saiu de lá no mesmo dia: proteger o arquivo INTEIRO fazia regerar
# um mockup já aprovado (mesmo caminho, hash novo) pedir a linha do Marco, e não
# é essa a natureza que o portão guarda. No lugar entrou a conferência que separa
# as três operações. Os cenários abaixo fixam cada uma delas, nos TRÊS modos do
# script — o hook lê o índice, o --commit lê um commit pronto, o --intervalo
# percorre commit por commit, e os três precisam concordar.
#
# `lista_de_isencoes <semente> <caminho>...` reescreve a lista do zero. Trocar só
# a semente é "o arquivo foi regerado"; acrescentar um caminho é "mais um arquivo
# de dados pode ficar no repositório".

# ── 1. o caso que o Marco quer fácil: hash novo, caminho igual ──
cenario_golden_generico \
  "atualizar o HASH de um caminho que já está isento passa (hook commit-msg)" \
  passa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 9 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "regera o mockup da documentacao"

# ── 2. o caso que é portão: caminho que não estava lá ──
cenario_golden_generico \
  "acrescentar um CAMINHO NOVO à lista de isenções é recusado, e a recusa nomeia o caminho" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/planilha-nova.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "libera mais uma planilha" \
  "" \
  "docs/planilha-nova.xlsx"

# ── 3. o mesmo, COM a linha do Marco: passa ──
cenario_golden_generico \
  "acrescentar um caminho novo COM a linha de aprovação passa" \
  passa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/planilha-nova.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "libera mais uma planilha na lista de isencoes

APROVADO-PELO-MARCO: 25/07/2026 libera a planilha nova de documentacao"

# ── 4. tirar isenção só aperta a trava: passa ──
cenario_golden_generico \
  "REMOVER um caminho da lista de isenções passa (isenção a menos só aperta)" \
  passa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/segundo.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'duas isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "tira a isencao do segundo arquivo"

# ── 5. a lista que NASCE no commit: todos os caminhos contam como novos ──
# A escolha está escrita em `isencoes_acrescentadas`, e o cenário de baixo (o
# desvio de dois commits) é o motivo dela. Aqui só o caso simples: no repositório
# descartável a lista é arquivo NÃO RASTREADO, então este commit a cria.
cenario_golden_generico \
  "a lista de isenções que NASCE no commit exige a marcação (não existe versão anterior)" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "cria a lista de isencoes" \
  "" \
  "docs/mockup.xlsx"

# ── 6. o desvio de dois commits que a escolha acima fecha ──
# Apagar a lista passa (tirar isenção só aperta). Se recriá-la passasse por
# "não existia antes", os dois commits juntos poriam na lista quantos caminhos
# quisessem sem ninguém aprovar. O --intervalo julga cada commit contra o pai
# dele, então é aqui que o desvio apareceria.
cenario_portao_direto \
  "apagar a lista num commit e recriá-la com caminho novo no seguinte NÃO escapa" \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && git rm -q --cached scripts/excecoes-dados.txt && rm -f scripts/excecoes-dados.txt && git commit -qm 'apaga a lista de isencoes' --no-verify \
     && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/contrabando.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'recria a lista de isencoes' --no-verify" \
  "--intervalo HEAD~2 HEAD" \
  recusa \
  "docs/contrabando.xlsx"

# ── 7. os outros dois modos veem o mesmo caminho novo ──
# Os três modos leem o commit de jeitos diferentes (índice, commit pronto,
# rev-list), e é por aí que uma trava fica meio-verde sem ninguém notar.
cenario_portao_direto \
  "--commit vê o caminho novo na lista de isenções" \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/planilha-nova.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'acrescenta isencao' --no-verify" \
  "--commit HEAD" \
  recusa \
  "docs/planilha-nova.xlsx"
cenario_portao_direto \
  "--intervalo de ramificação nova (base zerada) vê o caminho novo na lista de isenções" \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && git checkout -qb ramo/isencao \
     && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/planilha-nova.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'acrescenta isencao' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  recusa \
  "docs/planilha-nova.xlsx"
cenario_portao_direto \
  "--commit não reclama quando só o hash mudou (o conserto não virou bloqueio geral)" \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && lista_de_isencoes 9 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'regera o mockup' --no-verify" \
  "--commit HEAD" \
  passa

# ── 8. o amend só-de-mensagem, aplicado à isenção ──
# Mesmo buraco do item 5 do H4-A2 com outra roupa: o commit que acrescentou o
# caminho novo levou a marcação; um `git commit --amend` só-de-mensagem poderia
# apagá-la depois. Sem stage, quem manda no conteúdo é o HEAD — e é ele que o
# portão confere.
cenario_golden_generico \
  "amend que apaga a marcação de um commit que acrescentou isenção é recusado" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/planilha-nova.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'acrescenta isencao com aprovacao' --no-verify" \
  "acrescenta isencao (marcacao apagada)" \
  "--amend" \
  "docs/planilha-nova.xlsx"

echo ""
echo "  Ataques à distinção caminho × hash (cada um foi tentado antes de virar cenário):"
# O disfarce mais óbvio: trocar um caminho por outro na MESMA linha, mantendo o
# número de linhas e a cara do arquivo. É diferença de CONJUNTO, não contagem.
cenario_golden_generico \
  "trocar um caminho por outro na mesma linha é recusado (a conferência é de conjunto)" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/outro.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "troca o arquivo isento" \
  "" \
  "docs/outro.xlsx"
# Caminho com ESPAÇO no nome — planilha de festa tem espaço quase sempre. Além de
# recusar, a mensagem precisa trazer o nome INTEIRO: um `printf` sem aspas o
# partiria em quatro linhas, quatro arquivos que não existem.
cenario_golden_generico \
  "acrescentar caminho com ESPAÇO no nome é recusado, e a recusa traz o nome inteiro" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/festa da brisa.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "libera a planilha da brisa" \
  "" \
  "docs/festa da brisa.xlsx"
# Maiúscula diferente e './' na frente: para a trava de dados são entradas
# DIFERENTES (ela compara o caminho do git com o texto da linha, exato), então
# tratá-las como "já estava lá" deixaria trocar entrada morta por entrada viva.
cenario_golden_generico \
  "acrescentar o mesmo caminho com MAIÚSCULA diferente é caminho novo, e é recusado" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' 'DOCS/Mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "muda a caixa do caminho isento" \
  "" \
  "DOCS/Mockup.xlsx"
cenario_golden_generico \
  "acrescentar o mesmo caminho com './' na frente é caminho novo, e é recusado" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' './docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "escreve o caminho com ponto-barra" \
  "" \
  "./docs/mockup.xlsx"
# Omitir o comentário de motivo esconderia o caminho de um portão que só olhasse
# as linhas bem-formadas. Aqui é pelo modo --commit de propósito: pelo hook a
# trava de dados sai 2 antes (exceção sem motivo derruba a lista inteira) e o
# portão nem chegaria a ser chamado — o cenário mediria a outra trava.
cenario_portao_direto \
  "caminho novo escrito SEM o comentário de motivo também é visto pelo portão" \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && printf '%040d docs/escondida.xlsx\n' 7 >> scripts/excecoes-dados.txt \
     && git add -f scripts/excecoes-dados.txt && git commit -qm 'acrescenta isencao sem motivo' --no-verify" \
  "--commit HEAD" \
  recusa \
  "docs/escondida.xlsx"
# O outro lado do mesmo cuidado: um caminho que aparece DUAS VEZES com hashes
# diferentes (dois conteúdos aprovados para o mesmo arquivo) não é caminho novo.
# É o que o cabeçalho de scripts/excecoes-dados.txt já prometia e continua valendo.
cenario_golden_generico \
  "o mesmo caminho com DOIS hashes aprovados não é caminho novo — passa" \
  passa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt" \
  "aprova o segundo conteudo do mesmo mockup"
# Trocar a lista inteira por um ATALHO (symlink) para um arquivo de fora do
# repositório. Medido em 25/07/2026: scripts/trava-dados.sh lê o arquivo pela
# ÁRVORE DE TRABALHO, então o atalho a faria ler o alvo e liberar o que
# estivesse escrito lá; o portão lê o CONTEÚDO GRAVADO NO GIT (`git show
# <revisão>:caminho`), que num atalho é o texto do destino. Por isso o destino
# aparece como caminho novo e a marcação é exigida — o commit não entra calado.
cenario_golden_generico \
  "trocar a lista de isenções por um ATALHO para fora do repositório é recusado" \
  recusa \
  "lista_de_isencoes 1 'docs/mockup.xlsx' && git add -f scripts/excecoes-dados.txt && git commit -qm 'lista inicial de isencoes' --no-verify \
     && lista_de_isencoes 1 'docs/mockup.xlsx' 'docs/contrabando.xlsx' && mv scripts/excecoes-dados.txt fora-do-repo.txt \
     && ln -s ../fora-do-repo.txt scripts/excecoes-dados.txt && git add -f scripts/excecoes-dados.txt" \
  "aponta a lista para outro arquivo" \
  "" \
  "../fora-do-repo.txt"

echo ""
echo "  E o que NÃO afrouxou junto (os outros três arquivos da guarda continuam portão):"
cenario_golden_generico \
  "mexer em scripts/padroes-dados.txt continua exigindo a linha do Marco" \
  recusa \
  "printf '# sintetico\n' >> scripts/padroes-dados.txt && git add -f scripts/padroes-dados.txt" \
  "ajusta os padroes de dados" \
  "" \
  "scripts/padroes-dados.txt"
cenario_golden_generico \
  "mexer em scripts/trava-dados.sh continua exigindo a linha do Marco" \
  recusa \
  "printf '# sintetico\n' >> scripts/trava-dados.sh && git add -f scripts/trava-dados.sh" \
  "ajusta o motor da trava de dados" \
  "" \
  "scripts/trava-dados.sh"

echo ""
echo "Trava de dados — o que a guarda de 25/07/2026 fechou (junção portão+guarda):"
echo ""
echo "  O que o app BAIXA e ninguém tinha coberto:"
# As três famílias de CSV que o próprio app gera com dinheiro de festa dentro:
# contador-*.csv e pagamentos-*.csv (src/lib/exportPagamentos.js) e plano-*.csv
# (src/lib/planoFinanceiro.js). Até 25/07/2026 nem a trava nem o .gitignore
# cobriam CSV nenhum — era o achado mais grave da conferência.
cenario_recusa "contador-brisa-2026-07-25.csv"
cenario_recusa "pagamentos-marfim-2026-05-09.csv"
cenario_recusa "plano-a-varanda-2026-07-25.csv"
# O despejo da quarentena (src/lib/storage.js:139). O nome NÃO tem a palavra
# "backup", e era por isso que ele escapava da rede antiga 'backup.*\.json$' —
# medido entrando num commit com exit 0 e sem uma palavra de aviso. É a cópia
# crua do armazenamento do navegador do Marco: a base inteira.
cenario_recusa "previsao-eventos-BRUTO-ILEGIVEL-2026-07-25T01-30-00.json"

echo ""
echo "  O backup que a casca nativa grava ao sair — e o arquivo de projeto que só tem o nome parecido:"
# scripts/appwrap.swift:266 grava planejador-<AAAA-MM-DD>-<HHMMSS>.json dentro de
# backups/. Só a pasta o protegia: MOVIDO para restaurar, ou copiado para docs/,
# ele entrava sem uma palavra. Por isso o cenário o põe fora de backups/ — dentro
# da pasta o padrão da pasta pegaria, e o cenário não provaria nada sobre o nome.
cenario_recusa "docs/planejador-2026-07-25-013000.json"
# O outro lado da mesma decisão: exigir o carimbo AAAA-MM-DD no nome devolveu o
# nome do app para arquivo de PROJETO legítimo. 'previsao-eventos-*.json' puro
# barraria este aqui, que não tem dado nenhum dentro.
cenario_passa "previsao-eventos-icones.json"

echo ""
echo "  Os formatos de planilha que faltavam (o SheetJS lê os quatro igual a .xlsx):"
# O accept=".xlsx,.xls,.json" do <input> não protege nada: o arrastar-e-soltar
# (ImportModal.jsx:213) ignora o accept. Uma planilha real salva como .xlsm entra
# pelo mesmo caminho de uma .xlsx. .numbers é o formato nativo do Mac do Marco.
cenario_recusa "festa-brisa.xlsm"
cenario_recusa "festa-brisa.xlsb"
cenario_recusa "festa-brisa.numbers"
cenario_recusa "festa-brisa.ods"

echo ""
echo "  A cauda do nome — ponto e ponto duplo no fim (irmãos exatos do espaço, que já tinha sido corrigido):"
cenario_recusa "orçamento.xlsx."
cenario_recusa "orçamento.xlsx.."

echo ""
echo "  Os sufixos residuais que a lista fechada deixava passar — e a extensão composta que TEM de passar:"
# A correção anterior tolerava uma LISTA FECHADA de sufixos (bak|old|orig|tmp…).
# Ela deixava passar tudo o que não estivesse escrito nela, e toda vez que alguém
# inventasse um sufixo novo a lista ficava para trás. A cauda virou [^/]* — barra
# por padrão, inclusive o sufixo que ainda não foi inventado.
cenario_recusa "orçamento.xlsx.zip"
cenario_recusa "orçamento.xlsx.gz"
cenario_recusa "orçamento.xlsx.rascunho"
cenario_recusa "orçamento.xlsx.txt"
cenario_recusa "orçamento.xlsx-final"
cenario_recusa "orçamento.xlsx~"
# E o motivo pelo qual a lista era fechada: não barrar a documentação que FALA de
# uma planilha. Isso agora é resolvido pelo outro lado, com a isenção por extensão
# de DOCUMENTO. Sem este cenário, apertar a cauda vira bloqueio geral e ninguém vê.
cenario_passa "docs/exemplo.xlsx.md"

echo ""
echo "  Arquivo já rastreado que foi SOBRESCRITO (o --diff-filter passou a incluir M):"
# O buraco: docs/mockup-export-v2.xlsx está rastreado, e a trava só olhava
# Adicionado/Copiado/Renomeado. Dava para sobrescrever o mockup com a planilha
# real da festa, mesmo nome, e passar calado pelas duas redes.
cenario_dados_generico \
  "sobrescrever um mockup .xlsx já rastreado com outro conteúdo é recusado" \
  recusa \
  "preparo_mockup_rastreado && printf 'a planilha real da festa\n' > docs/mockup.xlsx && git add -f docs/mockup.xlsx" \
  "mas com outro"
# E o outro lado: REGERAR o mockup — mesmo caminho, conteúdo novo, hash novo na
# lista — atravessa as DUAS travas e entra no commit.
#
# ESTE CENÁRIO JÁ AFIRMOU O CONTRÁRIO, por algumas horas de 25/07/2026, e a
# história importa porque ela é a razão de o portão ter a conferência que tem.
# Naquela manhã scripts/excecoes-dados.txt inteiro entrou no PADRAO_PORTAO, e a
# consequência foi esta: regerar um mockup que o Marco já tinha aprovado passou a
# exigir a linha APROVADO-PELO-MARCO. Medido: aconteceu 3 vezes na história do
# repositório. O Marco olhou a conta e separou as duas naturezas —
#   ACRESCENTAR CAMINHO à lista de isenções  → decisão dele, exige a marcação;
#   ATUALIZAR HASH de caminho que já está lá  → o arquivo foi regerado, passa;
#   REMOVER caminho                           → isenção a menos, só aperta, passa.
# O arquivo saiu da lista protegida e no lugar dele entrou a conferência de
# caminho novo, cujos cenários estão logo abaixo.
#
# O cenário afirma as DUAS metades do caminho feliz: a trava de dados liberou
# (a isenção por conteúdo funciona com o hash atualizado) e o portão não se
# meteu (o caminho é o mesmo de antes).
cenario_dados_generico \
  "regerar o mockup atualizando o hash passa nas duas travas (é o caso que o Marco quer fácil)" \
  passa \
  "preparo_mockup_rastreado && printf 'mockup versao 2\n' > docs/mockup.xlsx && aprovar_mockup_atual && git add -f docs/mockup.xlsx scripts/excecoes-dados.txt"
# A isenção vale para o CONTEÚDO, nunca para o caminho: com o hash apontando
# para o conteúdo antigo, o conteúdo novo é barrado mesmo com o caminho na lista.
cenario_dados_generico \
  "com o caminho na lista mas o conteúdo fora dela, a recusa diz que é o conteúdo" \
  recusa \
  "preparo_mockup_rastreado && printf 'a planilha real da festa\n' > docs/mockup.xlsx && git add -f docs/mockup.xlsx" \
  "A exceção vale para o conteúdo aprovado, não para o"

echo ""
echo "  Dois commits do mesmo envio mexendo no arquivo isento, cada um atualizando o hash no SEU:"
# O atrito medido em 25/07/2026: a recusa ensina "atualize o hash no MESMO
# commit". Esse caminho funcionava no hook e FALHAVA na esteira — o hook aprovava
# cada commit contra a sua própria lista, e a esteira só conhecia a lista do
# TOPO, que já tinha o hash do segundo. Hook verde, esteira vermelha, seguindo à
# risca o que a mensagem ensina. Agora vale a união: lista do topo OU lista do
# commit que introduziu o conteúdo.
cenario_trava_direta \
  "dois commits regerando o mockup, cada um com o hash no seu, passam no intervalo inteiro" \
  "preparo_mockup_rastreado \
     && printf 'mockup versao 2\n' > docs/mockup.xlsx && aprovar_mockup_atual \
     && git add -f docs/mockup.xlsx scripts/excecoes-dados.txt \
     && git commit -qm 'regera o mockup (versao 2)' --no-verify \
     && printf 'mockup versao 3\n' > docs/mockup.xlsx && aprovar_mockup_atual \
     && git add -f docs/mockup.xlsx scripts/excecoes-dados.txt \
     && git commit -qm 'regera o mockup (versao 3)' --no-verify" \
  "--intervalo HEAD~2 HEAD" \
  0
# E a prova de que a união NÃO abriu buraco: commit sujo (planilha real, sem
# tocar na lista) seguido de um commit que "conserta" o arquivo continua barrado,
# porque aquele conteúdo não está aprovado em lista nenhuma.
cenario_trava_direta \
  "commit sujo seguido de um commit que \"conserta\" o arquivo continua barrado" \
  "preparo_mockup_rastreado \
     && printf 'a planilha real da festa\n' > docs/mockup.xlsx \
     && git add -f docs/mockup.xlsx && git commit -qm 'sobrescreve o mockup' --no-verify \
     && printf 'mockup versao 1\n' > docs/mockup.xlsx \
     && git add -f docs/mockup.xlsx && git commit -qm 'conserta o mockup' --no-verify" \
  "--intervalo HEAD~2 HEAD" \
  1 \
  "docs/mockup.xlsx"

echo ""
echo "  Primeiro envio de ramificação nova (o GitHub manda before=0000000):"
# O mais grave dos quatro achados de 25/07/2026. A versão anterior, sem base
# válida, conferia SÓ O COMMIT DO TOPO. Junte com o fato de que um clone novo
# nasce sem hooks (o git não versiona hooks ativos) e a cadeia some: clone novo →
# sem pre-commit → cinco commits, o do MEIO com a planilha real → push da
# ramificação nova → a esteira olha só o topo, que está limpo → entrou.
cenario_trava_direta \
  "ramificação nova com a planilha num commit do MEIO é barrada (não só o topo é conferido)" \
  "git checkout -qb ramo/nova \
     && printf 'sintetico\n' > nota-um.md && git add nota-um.md && git commit -qm 'primeira nota' --no-verify \
     && printf 'sintetico\n' > 'orçamento.xlsx' && git add -f -- 'orçamento.xlsx' && git commit -qm 'commit do meio' --no-verify \
     && printf 'sintetico\n' > nota-tres.md && git add nota-tres.md && git commit -qm 'terceira nota' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  1 \
  "orçamento.xlsx"
# O caminho feliz do mesmo recorte: ramificação nova SEM dado nenhum passa. Sem
# isto, "confere mais" poderia virar "barra tudo" e ninguém perceberia.
cenario_trava_direta \
  "ramificação nova sem arquivo de dado passa (conferir mais não virou barrar tudo)" \
  "git checkout -qb ramo/limpa \
     && printf 'sintetico\n' > nota-um.md && git add nota-um.md && git commit -qm 'primeira nota' --no-verify \
     && printf 'sintetico\n' > nota-dois.md && git add nota-dois.md && git commit -qm 'segunda nota' --no-verify" \
  "--intervalo 0000000000000000000000000000000000000000 HEAD" \
  0

echo ""
echo "  A recusa em português (o rótulo do padrão, não a expressão regular):"
cenario_rotulo_em_portugues \
  "orçamento.xlsx" \
  "planilha de evento (custo, fornecedor e valor de patrocínio)" \
  'xlsm|xlsb'
cenario_rotulo_em_portugues \
  "contador-brisa-2026-07-25.csv" \
  "CSV de pagamento que o app baixa para o contador" \
  '\.csv[^/]*$'

echo ""
echo "  Trava QUEBRADA sai com código próprio (2), nunca com 0:"
# O princípio 4 do CLAUDE.md levado ao extremo: uma trava que não consegue
# conferir não pode devolver 0. Devolver 0 seria a pior mentira possível — a
# esteira ficaria verde anunciando uma conferência que não aconteceu. E o código
# é 2, distinto do 1 da recusa normal, para quem lê o log saber a diferença
# entre "barrei um arquivo" e "eu é que estou quebrada".
cenario_trava_direta \
  "sem scripts/padroes-dados.txt a trava sai 2 e diz que está quebrada" \
  "rm -f scripts/padroes-dados.txt" \
  "--index" \
  2 \
  "trava de dados QUEBRADA"
cenario_trava_direta \
  "padrão sem rótulo (#:) na linha de cima derruba a lista inteira com 2" \
  "printf '\\\\.zzz[^/]*\$\n' >> scripts/padroes-dados.txt" \
  "--index" \
  2 \
  "padrão sem rótulo"
cenario_trava_direta \
  "lista de padrões só com comentário (nenhum padrão válido) sai 2" \
  "printf '# so comentario, nenhum padrao\n' > scripts/padroes-dados.txt" \
  "--index" \
  2 \
  "não tem nenhum padrão válido"
cenario_trava_direta \
  "exceção sem motivo escrito na linha de cima derruba a lista inteira com 2" \
  "printf '%s docs/qualquer.xlsx\n' 0000000000000000000000000000000000000000 >> scripts/excecoes-dados.txt" \
  "--index" \
  2 \
  "exceção SEM MOTIVO escrito"
cenario_trava_direta \
  "exceção malformada (só o hash, sem caminho) sai 2" \
  "printf '# motivo sintetico da bateria\n0000000000000000000000000000000000000000\n' >> scripts/excecoes-dados.txt" \
  "--index" \
  2 \
  "formato inválido"
# A mesma família, do outro lado: pedir para conferir um commit que não existe.
# Sem esta guarda, o git falhava, a lista de arquivos saía vazia e a trava
# anunciava "nada a barrar" com exit 0 — medido em 25/07/2026.
cenario_trava_direta \
  "--commit com identificador que NÃO EXISTE sai 2, em vez de \"nada a barrar\"" \
  "" \
  "--commit 0123456789abcdef0123456789abcdef01234567" \
  2 \
  "não é um commit deste repositório"
cenario_trava_direta \
  "--intervalo com um topo que NÃO EXISTE sai 2" \
  "" \
  "--intervalo HEAD 0123456789abcdef0123456789abcdef01234567" \
  2 \
  "não é um commit deste repositório"
# E a porta do próprio hook: sumindo o motor, o commit é RECUSADO (1), nunca
# aprovado. É o degrau anterior — antes de a trava poder dizer que está
# quebrada, ela precisa existir.
cenario_dados_generico \
  "sem scripts/trava-dados.sh o hook recusa o commit e diz qual arquivo falta" \
  recusa \
  "rm -f scripts/trava-dados.sh && printf 'sintetico\n' > nota.md && git add nota.md" \
  "scripts/trava-dados.sh"

echo ""
echo "Esteira (o mesmo conserto, na cópia que vive no ci.yml):"
cenario_ci_guarda_dados
echo ""

echo "Esteira — que commits a varredura de segredo olha (26/07/2026):"
# O caso mais comum de todos, e o que estava aberto: primeiro push de uma
# ramificação nova (o GitHub manda base 0000000) com o segredo no commit do
# MEIO. Se a varredura olhar só o topo, ela passa verde por cima dele.
cenario_varredura_esteira \
  "sem base no evento, acha o segredo no commit do MEIO dos três que a ramificação traz" \
  sim inteiro zero acha "nenhuma outra ref deste clone" "(3 commit(s) neste recorte)"
# CONTRAPROVA, no mesmo recorte: ramificação limpa continua passando. Sem ela,
# "ficou vermelho" poderia ser só "recusa tudo", e isso não é varredura.
cenario_varredura_esteira \
  "sem base no evento, ramificação LIMPA continua passando (nada de falso positivo)" \
  nao inteiro zero passa "nenhuma outra ref deste clone" "(3 commit(s) neste recorte)"
# O caminho que já funcionava não pode ter piorado: base válida no evento.
cenario_varredura_esteira \
  "com base válida no evento, o recorte continua sendo base..topo e o segredo é achado" \
  sim inteiro origem acha "a base veio no evento" "(3 commit(s) neste recorte)"
# Clone sem NENHUMA outra ref (nem ramo principal) e não raso: tudo que existe
# está entrando agora, então o recorte é o histórico do topo — nunca um commit.
cenario_varredura_esteira \
  "sem base e sem nenhuma outra ref, varre o histórico do topo e acha o segredo" \
  sim solto zero acha "sem base e sem nenhuma outra ref" "(3 commit(s) neste recorte)"
# E o caso em que NÃO HÁ COMO saber o intervalo: clone raso, nenhuma outra ref.
# Aqui varrer o que está à mão seria um verde que não conferiu nada.
cenario_varredura_esteira \
  "clone raso sem base e sem outra ref: FALHA dizendo o motivo, em vez de sair verde" \
  sim raso zero falha "fetch-depth"
# E o recorte que o git não entende. Isto não é hipótese: medido em 26/07/2026,
# o gitleaks com uma revisão que não existe imprime "0 commits scanned / no
# leaks found" e sai com CÓDIGO 0 — verde sem ter varrido nada. Aqui a base é
# válida e o topo do evento não existe neste clone, que é como isso chegaria.
cenario_varredura_esteira \
  "topo do evento que NÃO EXISTE no clone: FALHA, em vez do verde de 0 commits do gitleaks" \
  sim inteiro origem falha "git respondeu" "" \
  0123456789abcdef0123456789abcdef01234567
echo ""

echo "─────────────────────────────────────────────"
if [ "$AVISOS" -gt 0 ]; then
  echo "Avisos: $AVISOS cenário(s) NÃO CONFERIDO(S) — leia o motivo acima e confira à mão."
fi
if [ "$FALHAS" -eq 0 ]; then
  echo "Resumo: $TOTAL cenários, todos bateram com o esperado."
  echo "─────────────────────────────────────────────"
  exit 0
fi
echo "Resumo: $TOTAL cenários, $FALHAS divergiram do esperado."
echo "─────────────────────────────────────────────"
exit 1
