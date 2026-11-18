#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# trava-dados.sh — a trava de dados, num lugar só (Sessão H4-D, 25/07/2026).
#
# Antes disto a MESMA regra vivia em duas cópias mantidas à mão: o grep dentro de
# .githooks/pre-commit e outro grep, igualzinho, dentro do passo de shell de
# .github/workflows/ci.yml. O comentário do próprio ci.yml admitia o problema com
# todas as letras: "se um dia mudar lá, muda aqui também (não é um regex novo)".
# Duas cópias mantidas à mão divergem — é questão de tempo, e a esteira é
# justamente a rede que deveria segurar o que o hook local não segurou.
#
# COMO FICOU
#   scripts/padroes-dados.txt   → a lista de padrões (a única), com rótulo e isenção
#   scripts/excecoes-dados.txt  → os arquivos liberados, com motivo e hash
#   scripts/trava-dados.sh      → este arquivo: lê os dois e decide
#   .githooks/pre-commit        → chama este script com --index
#   .githooks/pre-push          → chama este script com --intervalo, por ref
#   .github/workflows/ci.yml    → chama este script com --intervalo
#
#   Por que um .sh compartilhado em vez de repetir só a lista nos dois lados: o
#   passo do CI é shell dentro de YAML, então ele consegue chamar um script
#   igualzinho ao hook — foi o jeito mais simples que funciona nos dois. E assim
#   não é só a LISTA que passa a ter dono único; a lógica de casar, de conferir
#   exceção e de escrever a recusa também. Sobrou zero regra duplicada.
#
# MODOS
#   trava-dados.sh --index                    o que está staged (hook pre-commit)
#   trava-dados.sh --commit <sha>             um commit já feito (aceita HEAD)
#   trava-dados.sh --intervalo <base> <head>  um range de push (esteira, pre-push)
#
# Sai 0 quando não há nada a barrar, 1 quando há (com a lista e o porquê), e 2
# quando a própria trava está quebrada (arquivo de padrões sumido, padrão sem
# rótulo, exceção sem motivo). Quebrada nunca é "passou": barrar é o padrão seguro.
# ─────────────────────────────────────────────────────────────────────────────
set -u

RAIZ=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "✗ trava de dados: não consegui achar a raiz do repositório (git rev-parse)."
  exit 2
}

REL_EXCECOES="scripts/excecoes-dados.txt"
ARQ_PADROES="$RAIZ/scripts/padroes-dados.txt"
ARQ_EXCECOES="$RAIZ/$REL_EXCECOES"
TAB=$(printf '\t')

for obrigatorio in "$ARQ_PADROES" "$ARQ_EXCECOES"; do
  if [ ! -f "$obrigatorio" ]; then
    echo "✗ trava de dados QUEBRADA: não encontrei $obrigatorio"
    echo "  Sem a lista de padrões esta trava não sabe o que barrar, e deixar"
    echo "  passar em silêncio seria pior do que recusar. Recupere o arquivo"
    echo "  (ele é versionado) e rode de novo."
    exit 2
  fi
done

# ── modo ─────────────────────────────────────────────────────────────────────
MODO=""
SHA=""
BASE=""
CABECA=""
REVISOES=""
case "${1:-}" in
  --index)
    MODO="index"
    ;;
  --commit)
    MODO="commit"
    SHA="${2:-HEAD}"
    ;;
  --intervalo)
    MODO="intervalo"
    BASE="${2:-}"
    CABECA="${3:-HEAD}"
    ;;
  *)
    echo "uso: trava-dados.sh --index | --commit <sha> | --intervalo <base> <head>"
    exit 2
    ;;
esac

# ── o que foi pedido existe mesmo? ───────────────────────────────────────────
# Sem isto, um argumento que não resolve fazia o git falhar, a lista de arquivos
# sair vazia e a trava anunciar "nada a barrar" com exit 0 (medido em 25/07/2026,
# ao testar o degrau 3 da escada abaixo). Trava que não sabe o que conferir recusa;
# nunca finge que conferiu.
confere_revisao() {  # $1 = o que veio na linha de comando   $2 = como chamar isso na mensagem
  if ! git rev-parse --quiet --verify "$1^{commit}" >/dev/null 2>&1; then
    echo "✗ trava de dados QUEBRADA: $2 '$1' não é um commit deste repositório."
    echo "  Sem saber o que conferir, a trava não confere nada — e dizer 'nada a"
    echo "  barrar' aqui seria a pior mentira possível. Confira o argumento e"
    echo "  rode de novo."
    exit 2
  fi
}

# ── que revisões olhar, no modo intervalo ────────────────────────────────────
# O BURACO QUE ISTO FECHA (conferência de 25/07/2026, o mais grave dos quatro):
# no PRIMEIRO push de uma branch nova o GitHub manda `before` = 0000000, porque
# a ref não existia. A versão anterior deste script, nesse caso, conferia SÓ O
# COMMIT DO TOPO. Junte com o fato de que um clone recém-feito nasce sem os hooks
# ativos (o git não versiona hooks; é preciso `git config core.hooksPath
# .githooks`) e a cadeia inteira some: clone novo → sem pre-commit → 5 commits,
# o segundo com a planilha real da festa → push da branch nova → a esteira olha
# só o topo, que está limpo → entrou, sem `git add -f` e sem `--no-verify`.
#
# A ESCADA, do mais preciso ao mais amplo — sempre dizendo em voz alta qual
# degrau usou, porque um recorte silencioso é o que criou o buraco:
#   1) base informada e existente neste clone  → base..topo (o caso normal).
#   2) sem base: TUDO que o topo tem e que nenhuma OUTRA ref do repositório já
#      tem (git rev-list topo --not <demais refs>). Numa branch nova isso é
#      exatamente a lista de commits novos, venham eles de main ou não — e não
#      depende de adivinhar qual é a branch principal.
#   3) nem isso (repositório sem nenhuma outra ref — o primeiro push de todos):
#      o histórico inteiro do topo. Aqui um achado PODE ser antigo e não deste
#      push; a mensagem avisa, e mesmo assim recusa: nesse cenário não existe
#      "já estava lá antes", tudo está entrando agora.
if [ "$MODO" = "commit" ]; then
  confere_revisao "$SHA" "o commit"
fi

if [ "$MODO" = "intervalo" ]; then
  ZERO=0000000000000000000000000000000000000000
  confere_revisao "$CABECA" "o topo"
  if [ -n "$BASE" ] && [ "$BASE" != "$ZERO" ] && git cat-file -e "$BASE^{commit}" 2>/dev/null; then
    REVISOES="$BASE..$CABECA"
  else
    SHA_CABECA=$(git rev-parse "$CABECA" 2>/dev/null || echo "")
    OUTRAS=$(git rev-parse --all 2>/dev/null | grep -v -x "$SHA_CABECA" || true)
    if [ -n "$OUTRAS" ]; then
      echo "  (sem base válida — conferindo todo commit do topo que ainda não está"
      echo "   em nenhuma outra ref deste clone; é o primeiro push de uma branch nova)"
      # Sem aspas de propósito: são vários SHAs, um por argumento do rev-list.
      REVISOES="$CABECA --not $(printf '%s' "$OUTRAS" | tr '\n' ' ')"
    else
      echo "  (sem base e sem nenhuma outra ref — conferindo o HISTÓRICO INTEIRO do"
      echo "   topo. Neste cenário tudo está entrando agora, então não existe"
      echo "   'isso já estava lá antes'.)"
      REVISOES="$CABECA"
    fi
  fi
fi

# ── que arquivos olhar ───────────────────────────────────────────────────────
# --diff-filter=ACMR: Adicionado, Copiado, MODIFICADO e Renomeado.
#
# O M entrou na Sessão H4-D. Sem ele a trava só olhava arquivo NOVO, e
# docs/mockup-export-v2.xlsx já está rastreado: dava para sobrescrever aquele
# mockup com a planilha real de uma festa, mesmo nome, e passar calado pelas duas
# redes — foi medido. Quem paga o preço do M é o commit que encosta num arquivo
# de dado legítimo já rastreado; para esse existe scripts/excecoes-dados.txt.
#
# LEITURA À PROVA DE ACENTO (Sessão H4, 24/07/2026 — defeito medido e reproduzido,
# preservada aqui inteira): o git, com core.quotepath ligado (o padrão), imprime
# caminho com caractere não-ASCII entre aspas e em escapes octais —
# "or\303\247amento.xlsx" no lugar de orçamento.xlsx. As aspas ficam nas PONTAS, as
# âncoras ^ e $ dos padrões deixam de casar, e a trava dizia exit 0 sem UMA palavra.
# `-c core.quotepath=false` resolveria o acento, mas o git continuaria escapando
# nome com aspas ou barra invertida. Com -z o git não escapa NADA: a lista sai
# separada por NUL, byte a byte igual ao nome. O `tr` devolve uma linha por arquivo
# porque os greps abaixo são de linha; a dupla funciona no sh do macOS e no do
# Ubuntu, sem depender de `grep -z` (extensão GNU) nem de `read -d` (é bash).
case "$MODO" in
  index)
    ARQUIVOS=$(git diff --cached --name-only --diff-filter=ACMR -z | tr '\0' '\n')
    ;;
  commit)
    ARQUIVOS=$(git show --name-only --diff-filter=ACMR --pretty=format: -z "$SHA" | tr '\0' '\n')
    ;;
  intervalo)
    # $REVISOES sem aspas de propósito (vira vários argumentos do git log).
    ARQUIVOS=$(git log --name-only --diff-filter=ACMR --pretty=format: -z $REVISOES | tr '\0' '\n')
    ;;
esac

# ── ler os padrões, os rótulos e as isenções ─────────────────────────────────
# Uma passada de awk devolve tudo em linhas marcadas, separadas por TAB:
#   P <n> <linha-do-arquivo> <expressão do padrão>
#   R <n> <linha-do-arquivo> <rótulo em português do padrão n>
#   I <n> <linha-do-arquivo> <isenção do padrão n>
#   E <n> <linha-do-arquivo> <erro de formato — a trava recusa e não confere nada>
#
# O rótulo é OBRIGATÓRIO porque é ele que aparece na recusa: antes de 25/07/2026 a
# recusa imprimia a expressão regular crua, e quem levava o "não" tinha de ler
# '\.(xlsx|xls|xlsm|xlsb|numbers|ods)[^/]*$' para entender que o problema era uma
# planilha. Padrão sem rótulo não é estilo: é uma recusa que ninguém entende.
ANALISE=$(awk '
  {
    linha = $0
    sub(/[[:space:]]*$/, "", linha)
    if (linha ~ /^[[:space:]]*$/) next
    if (linha ~ /^[[:space:]]*#:/) {
      r = linha
      sub(/^[[:space:]]*#:[[:space:]]*/, "", r)
      if (r == "") { printf "E\t0\t%d\trótulo (#:) vazio\n", NR; next }
      rotulo = r; rotulo_linha = NR; next
    }
    if (linha ~ /^[[:space:]]*#/) next
    if (linha ~ /^[[:space:]]*!/) {
      i = linha
      sub(/^[[:space:]]*!/, "", i)
      if (n == 0) { printf "E\t0\t%d\tisenção (!) sem nenhum padrão acima dela\n", NR; next }
      if (tem_isencao[n]) { printf "E\t0\t%d\tsegunda isenção (!) para o mesmo padrão\n", NR; next }
      tem_isencao[n] = 1
      printf "I\t%d\t%d\t%s\n", n, NR, i
      next
    }
    n++
    printf "P\t%d\t%d\t%s\n", n, NR, linha
    if (rotulo == "") printf "E\t%d\t%d\tpadrão sem rótulo (#:) na linha de cima\n", n, NR
    else printf "R\t%d\t%d\t%s\n", n, rotulo_linha, rotulo
    rotulo = ""
  }
' "$ARQ_PADROES")

ERROS_PADROES=$(printf '%s\n' "$ANALISE" | awk -F'\t' '$1 == "E" { printf "    linha %s — %s\n", $3, $4 }')
if [ -n "$ERROS_PADROES" ]; then
  echo "✗ trava de dados QUEBRADA: scripts/padroes-dados.txt tem linha inválida."
  printf '%s\n' "$ERROS_PADROES"
  echo "  O formato está escrito no cabeçalho daquele arquivo: '#: rótulo' na linha"
  echo "  de cima de cada padrão (obrigatório, é o texto que a recusa mostra) e"
  echo "  '!expressão' logo abaixo quando o padrão precisa de isenção."
  exit 2
fi

QUANTOS_PADROES=$(printf '%s\n' "$ANALISE" | awk -F'\t' '$1 == "P"' | grep -c . || true)
if [ "$QUANTOS_PADROES" -eq 0 ] 2>/dev/null || [ -z "$QUANTOS_PADROES" ]; then
  echo "✗ trava de dados QUEBRADA: $ARQ_PADROES não tem nenhum padrão válido"
  echo "  (só comentário e linha em branco). Uma trava sem padrão não barra nada;"
  echo "  recusando em vez de fingir que conferiu."
  exit 2
fi

# Campo de um padrão pelo número dele. O achado guarda o NÚMERO, não o texto:
# guardar o texto exigiria costurar a expressão dentro de um sed/awk, e todo
# padrão daqui tem '|', '\' e '.' — qualquer delimitador escolhido apareceria
# dentro de alguma expressão e a quebraria em silêncio. Número é só dígito.
campo_do_padrao() {  # $1 = P | R | I    $2 = número do padrão
  printf '%s\n' "$ANALISE" | awk -F'\t' -v t="$1" -v n="$2" '$1 == t && $2 == n { print $4; exit }'
}

# ── ler as exceções ──────────────────────────────────────────────────────────
# Emite uma linha por entrada, com o veredito na frente:
#   OK<TAB>hash<TAB>caminho          entrada válida
#   SEMMOTIVO<TAB>linha<TAB>caminho  não tem comentário na linha imediatamente acima
#   MALFORMADA<TAB>linha<TAB>texto   não é "<hash> <caminho>"
analisar_excecoes() {
  anterior_comentario=0
  numero=0
  while IFS= read -r linha; do
    numero=$((numero + 1))
    limpa=$(printf '%s' "$linha" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [ -z "$limpa" ]; then
      anterior_comentario=0
      continue
    fi
    case "$limpa" in
      \#*)
        anterior_comentario=1
        continue
        ;;
    esac
    hash_lido=${limpa%% *}
    caminho_lido=${limpa#* }
    if [ "$hash_lido" = "$limpa" ] || [ -z "$caminho_lido" ]; then
      printf 'MALFORMADA\t%s\t%s\n' "$numero" "$limpa"
    elif [ "$anterior_comentario" -eq 1 ]; then
      printf 'OK\t%s\t%s\n' "$hash_lido" "$caminho_lido"
    else
      printf 'SEMMOTIVO\t%s\t%s\n' "$numero" "$caminho_lido"
    fi
    anterior_comentario=0
  done
}

EXCECOES=$(analisar_excecoes < "$ARQ_EXCECOES")

PROBLEMAS=$(printf '%s\n' "$EXCECOES" | grep -E "^(SEMMOTIVO|MALFORMADA)$TAB" || true)
if [ -n "$PROBLEMAS" ]; then
  echo "✗ trava de dados QUEBRADA: scripts/excecoes-dados.txt tem entrada inválida."
  printf '%s\n' "$PROBLEMAS" | while IFS="$TAB" read -r tipo onde texto; do
    if [ "$tipo" = "SEMMOTIVO" ]; then
      echo "    linha $onde — exceção SEM MOTIVO escrito: $texto"
      echo "      A linha imediatamente acima da entrada tem de ser um comentário"
      echo "      dizendo por que este arquivo é legítimo. Exceção sem motivo não entra."
    else
      echo "    linha $onde — formato inválido: $texto"
      echo "      O formato é: <sha1-do-conteúdo> <caminho/dentro/do/repo>"
    fi
  done
  exit 2
fi

# Hashes aprovados pela lista COMO ELA ESTÁ AGORA (working tree no hook, topo no CI).
hashes_aprovados_de() {
  printf '%s\n' "$EXCECOES" | awk -F'\t' -v alvo="$1" '$1 == "OK" && $3 == alvo { print $2 }'
}

# Hashes aprovados pela lista COMO ELA ESTAVA NAQUELE COMMIT.
#
# POR QUE ISTO EXISTE (relatório de atrito, 25/07/2026): a recusa ensina "atualize
# o hash nesta lista, no MESMO commit". Esse caminho funcionava no hook e FALHAVA
# na esteira — quando dois commits do mesmo push mexiam no arquivo isento, cada um
# atualizando o hash junto, o hook aprovava os dois (cada um contra a sua própria
# lista) e a esteira reprovava o primeiro (porque só conhecia a lista do topo, que
# já tinha o hash do segundo). Hook verde, esteira vermelha, e o caminho de escape
# que a mensagem ensina não levava a lugar nenhum.
#
# Agora um conteúdo é aprovado se estiver na lista do TOPO **ou** na lista do
# commit que o introduziu. A união conserta o caminho ensinado sem abrir buraco:
# o cenário que o M veio fechar — commit sujo com a planilha real, seguido de um
# commit que "conserta" o arquivo — continua barrado, porque o conteúdo sujo não
# está aprovado nem no commit dele nem no topo.
hashes_aprovados_no_commit() {  # $1 = commit   $2 = caminho
  [ -z "$1" ] && return 0
  git show "$1:$REL_EXCECOES" 2>/dev/null | analisar_excecoes \
    | awk -F'\t' -v alvo="$2" '$1 == "OK" && $3 == alvo { print $2 }'
}

# Todos os conteúdos que ESTE arquivo teve no recorte que estamos julgando, um por
# linha, no formato "<blob><TAB><commit>". No hook é um só (o que está staged, sem
# commit). Num range podem ser vários, um por commit que tocou o arquivo — e todos
# precisam estar aprovados, senão um commit sujo seguido de um commit que
# "conserta" passaria batido.
blobs_de() {
  caminho_blob=$1
  case "$MODO" in
    index)
      b=$(git rev-parse --quiet --verify ":$caminho_blob" 2>/dev/null) \
        && [ -n "$b" ] && printf '%s\t\n' "$b"
      ;;
    commit)
      b=$(git rev-parse --quiet --verify "$SHA:$caminho_blob" 2>/dev/null) \
        && [ -n "$b" ] && printf '%s\t%s\n' "$b" "$SHA"
      ;;
    intervalo)
      # $REVISOES sem aspas de propósito (vira vários argumentos do rev-list).
      for commit_tocou in $(git rev-list $REVISOES -- "$caminho_blob"); do
        b=$(git rev-parse --quiet --verify "$commit_tocou:$caminho_blob" 2>/dev/null) || continue
        [ -n "$b" ] && printf '%s\t%s\n' "$b" "$commit_tocou"
      done
      ;;
  esac
}

# Os conteúdos que NÃO estão aprovados — vazio significa "pode passar".
blobs_nao_aprovados() {  # $1 = caminho
  caminho_bna=$1
  aprovados_topo=$(hashes_aprovados_de "$caminho_bna")
  blobs_de "$caminho_bna" | while IFS="$TAB" read -r blob commit_do_blob; do
    [ -z "$blob" ] && continue
    printf '%s\n' "$aprovados_topo" | grep -qx "$blob" && continue
    if [ -n "$commit_do_blob" ]; then
      hashes_aprovados_no_commit "$commit_do_blob" "$caminho_bna" | grep -qx "$blob" && continue
    fi
    printf '%s\t%s\n' "$blob" "$commit_do_blob"
  done
}

# ── casar ────────────────────────────────────────────────────────────────────
# Padrões por fora, arquivos por dentro: são poucos greps (um por padrão), e não
# um grep por arquivo × padrão, que ficaria caro num commit grande.
ACHADOS=""
while IFS="$TAB" read -r tipo indice linha_no padrao; do
  [ "${tipo:-}" = "P" ] || continue
  casaram=$(printf '%s\n' "$ARQUIVOS" | grep -Ei -e "$padrao" || true)
  [ -z "$casaram" ] && continue
  isencao=$(campo_do_padrao I "$indice")
  if [ -n "$isencao" ]; then
    casaram=$(printf '%s\n' "$casaram" | grep -Eiv -e "$isencao" || true)
    [ -z "$casaram" ] && continue
  fi
  ACHADOS="$ACHADOS$(printf '%s\n' "$casaram" | awk -v n="$indice" '{ print $0 "\t" n }')
"
done <<FIM_DA_ANALISE
$ANALISE
FIM_DA_ANALISE

# Um arquivo pode casar com mais de um padrão; a recusa mostra o primeiro, que já
# basta para a pessoa entender por que foi barrado.
ACHADOS=$(printf '%s' "$ACHADOS" | grep -v '^[[:space:]]*$' | awk -F'\t' '!visto[$1]++' || true)

if [ -z "$ACHADOS" ]; then
  echo "✓ Trava de dados: nada a barrar."
  exit 0
fi

# ── separar o que é exceção aprovada do que é recusa ─────────────────────────
BLOQUEADOS=""
LIBERADOS=""
# IFS só com TAB de propósito: o nome pode ter espaço no começo ou no fim (é
# exatamente um dos casos que esta sessão veio fechar — "orçamento.xlsx " com
# espaço sobrando), e um IFS padrão comeria esse espaço antes da comparação.
while IFS="$TAB" read -r arquivo n_padrao; do
  [ -z "$arquivo" ] && continue
  conteudos=$(blobs_de "$arquivo")
  pendentes=$(blobs_nao_aprovados "$arquivo")
  if [ -n "$conteudos" ] && [ -z "$pendentes" ]; then
    LIBERADOS="$LIBERADOS  $arquivo
"
    continue
  fi
  BLOQUEADOS="$BLOQUEADOS$arquivo$TAB$n_padrao
"
done <<FIM_DOS_ACHADOS
$ACHADOS
FIM_DOS_ACHADOS

if [ -n "$LIBERADOS" ]; then
  echo "  Trava de dados: liberado por scripts/excecoes-dados.txt (conteúdo confere):"
  printf '%s' "$LIBERADOS"
fi

if [ -z "$BLOQUEADOS" ]; then
  echo "✓ Trava de dados: nada a barrar."
  exit 0
fi

# ── a recusa ─────────────────────────────────────────────────────────────────
# Em português e sem expressão regular na cara de quem levou o "não": o que sai
# aqui é o RÓTULO do padrão ("planilha de evento"), que diz o que aquela regra
# protege. A expressão crua continua no relatório, mas no fim, sob "Referência",
# para quem for MEXER em scripts/padroes-dados.txt.
echo "✗ Trava de dados: arquivo de DADOS não entra no git."
echo ""
printf '%s' "$BLOQUEADOS" | while IFS="$TAB" read -r arquivo n_padrao; do
  [ -z "$arquivo" ] && continue
  printf '    %s\n' "$arquivo"
  printf '        o que este padrão protege:  %s\n' "$(campo_do_padrao R "$n_padrao")"
  aprovados=$(hashes_aprovados_de "$arquivo")
  if [ -n "$aprovados" ]; then
    echo "        este caminho ESTÁ em scripts/excecoes-dados.txt, mas com outro"
    echo "        conteúdo. A exceção vale para o conteúdo aprovado, não para o"
    echo "        nome — foi assim que a gente fechou o buraco de sobrescrever um"
    echo "        mockup com a planilha real da festa. Conteúdo não aprovado:"
    blobs_nao_aprovados "$arquivo" | while IFS="$TAB" read -r blob commit_do_blob; do
      [ -z "$blob" ] && continue
      if [ -n "$commit_do_blob" ]; then
        printf '            %s  (commit %s)\n' "$blob" "$(git rev-parse --short "$commit_do_blob" 2>/dev/null)"
      else
        printf '            %s\n' "$blob"
      fi
    done
  fi
done
echo ""
echo "  Regra do CLAUDE.md: banco, planilha de evento, CSV de pagamento e backup"
echo "  JSON de dados reais nunca são commitados. A lista de padrões, com o motivo"
echo "  de cada um, está em scripts/padroes-dados.txt."
echo ""
echo "  CAMINHO DE ESCAPE LEGÍTIMO — se este arquivo é exceção de verdade (mockup"
echo "  de documentação, fixture sintética, exemplo sem dado real), acrescente-o a"
echo "  scripts/excecoes-dados.txt com o motivo escrito na linha de cima e o hash"
echo "  do conteúdo aprovado:"
echo ""
echo "      git hash-object <o arquivo>"
echo ""
echo "  ONDE ESCREVER O HASH — os dois lugares funcionam, no hook E na esteira:"
echo "    · no MESMO commit que mexe no arquivo: a esteira relê a lista de exceções"
echo "      como ela estava EM CADA COMMIT do push, então dois commits seguidos"
echo "      mexendo no mesmo arquivo isento passam nos dois lados (antes de"
echo "      25/07/2026 esse caso deixava o hook verde e a esteira vermelha);"
echo "    · ou no topo do que vai ser empurrado: a lista do topo aprova todos os"
echo "      conteúdos do intervalo de uma vez."
echo "    O que não funciona é não escrever em lugar nenhum."
echo ""
echo "  Exceção sem motivo escrito não entra — a trava recusa a lista inteira."
echo "  Prefira isso a --no-verify: a exceção fica no repositório, com autor, data"
echo "  e motivo, e o --no-verify não deixa rastro nenhum (e não passa na esteira,"
echo "  que roda esta mesma trava)."
echo ""
echo "  Referência, para quem for mexer em scripts/padroes-dados.txt — a expressão"
echo "  que casou com cada arquivo:"
printf '%s' "$BLOQUEADOS" | while IFS="$TAB" read -r arquivo n_padrao; do
  [ -z "$arquivo" ] && continue
  printf '      %s  ←  %s\n' "$arquivo" "$(campo_do_padrao P "$n_padrao")"
done
exit 1
