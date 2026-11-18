#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# PORTÃO DO GOLDEN — a trava automática dos princípios 1 e 8 do CLAUDE.md.
# (Marco, via dossiê de auditoria 19/07/2026.)
#
# A regra "calc.js e golden.test.js só mudam com aprovação explícita do Marco"
# existia desde sempre — mas só no texto. A auditoria constatou que `grep golden`
# no CI e no pre-commit não retornava NADA: a regra funcionava porque todo
# agente obedeceu, não porque alguma coisa impedia. Portão social não é portão.
# Este script é a parede.
#
# COMO PASSAR PELO PORTÃO (quando o Marco JÁ aprovou):
# ponha uma linha assim na mensagem do commit —
#
#     APROVADO-PELO-MARCO: 19/07/2026 corrigir o rateio do cashback por lote
#
# Data em dd/mm/aaaa + motivo em pelo menos TRÊS palavras, e a linha tem de
# estar na PRIMEIRA linha do corpo (logo depois do assunto) ou no RODAPÉ, no
# fim da mensagem. A marcação REGISTRA uma aprovação que já aconteceu; ela não
# é a aprovação. Antes de escrevê-la, o diff em português dos valores antigos ×
# novos tem de ter sido mostrado ao Marco.
#
# MODOS
#   portao-golden.sh --commit-msg <arquivo>   arquivos = os staged (hook commit-msg)
#   portao-golden.sh --commit <sha>           um commit já feito
#   portao-golden.sh --intervalo <base> <head>  cada commit do intervalo (CI)
#
# Bypass consciente: `git commit --no-verify` pula o hook local — mas o CI roda
# o mesmo script no push e recusa igual. É de propósito: a máquina do Marco
# pode ser convencida, o portão do repositório não.
#
# ── O QUE MUDOU NA SESSÃO H4-A (25/07/2026) ──────────────────────────────────
# Quatro famílias de passagem, todas medidas em repositório descartável e todas
# saindo com exit 0 — ou seja, o portão dizia "está limpo" sem estar:
#   1. APAGAR arquivo protegido passava — o filtro era --diff-filter=ACMR e o
#      D (apagado) não está nele. Apagar o golden.test.js, que o CLAUDE.md
#      chama de "o último cadeado", era a única operação destrutiva que o
#      portão não enxergava.
#   2. RENOMEAR passava e desprotegia PARA SEMPRE — a listagem devolvia só o
#      caminho NOVO e a lista casa caminho literal. O rename PURO, sem alterar
#      um byte, já bastava; um commit chamado "organiza pastas" passa em
#      qualquer revisão humana.
#   3. "VERDE QUE NÃO PROVA NADA" — base inválida, identificador de commit que
#      não existe e intervalo com o topo atrás da base saíam todos por "nada a
#      barrar", porque uma lista vazia era lida como "não tocou em nada".
#   4. A MARCAÇÃO não correspondia ao que diz — "99/99/9999 x" passava, uma
#      marcação copiada de outro commit passava em qualquer ponto do corpo, e
#      uma marcação LEGÍTIMA indentada com dois espaços era recusada.
# Os consertos estão marcados abaixo com "H4-A". A prova, rodando, está em
# scripts/portao-teste.sh.
#
# ── A SEGUNDA RODADA, DO MESMO DIA (H4-A2, 25/07/2026) ───────────────────────
# A primeira rodada consertou o item 3 com uma saída ERRADA: quando o git não
# informava a base, o portão conferia "tudo desde a última etiqueta" e o
# comentário afirmava que isso confere de mais, nunca de menos. É falso, e foi
# medido: `git describe --tags --abbrev=0` devolve a etiqueta mais próxima
# ALCANÇÁVEL desde o topo, então uma etiqueta criada EM CIMA de um commit não
# aprovado empurra a âncora para frente, o commit ruim fica FORA do intervalo e
# o portão anuncia "nada a barrar" com a fórmula alterada no topo. Pior que o
# problema original: antes ele não conferia; assim ele afirmava ter conferido.
#
# O Marco decidiu (DECISOES-MARCO-H4.md, item 15): O PORTÃO CALCULA A BASE
# SOZINHO a partir do ramo principal. Base inválida → ancestral comum entre o
# topo e `origin/main` (e, se não houver, `main`), via `git merge-base`. Isso
# confere exatamente os commits novos da ramificação, nem mais nem menos, e
# devolve o envio de ramificação nova ao normal. Sem ramo principal no clone,
# RECUSA dizendo o comando exato — nunca finge que conferiu. O caminho da
# etiqueta foi apagado inteiro.
#
# Mais três defeitos da mesma conferência, medidos e consertados aqui (itens
# marcados "H4-A2" no corpo):
#   5. `git commit --amend` que mexe SÓ na mensagem não era conferido — o modo
#      --commit-msg lia `git diff --cached`, que sai VAZIO nesse caso, e o
#      script saía 0 antes de olhar a mensagem. Dava para apagar a marcação de
#      um commit de fórmula com um amend.
#   6. A data aceitava ano absurdo: "25/07/0026" casava o formato, o ano existe
#      no calendário e a comparação numérica não o vê como futuro.
#   7. O RODAPÉ era estreito demais: uma linha `Refs #12`, uma URL ou um item
#      de lista no último parágrafo derrubavam a marcação legítima — e a recusa
#      ainda errava o diagnóstico, dizendo "solta no meio do corpo" quando a
#      linha estava no fim.
#
# ── A LISTA DE ISENÇÕES DE DADOS DEIXOU DE SER TUDO OU NADA (25/07/2026) ─────
# scripts/excecoes-dados.txt entrou na lista protegida de manhã e saiu dela no
# mesmo dia, por decisão do Marco: proteger o arquivo INTEIRO passou a exigir a
# linha de aprovação para REGERAR um mockup que ele já tinha aprovado (mesmo
# caminho, conteúdo novo, hash novo). No lugar da proteção do arquivo inteiro
# entrou uma conferência que separa as duas naturezas — acrescentar CAMINHO
# exige a marcação; atualizar HASH de caminho que já está lá, e tirar caminho da
# lista, passam livres. O porquê inteiro, a conta e o que a escolha deixa de
# fora estão no bloco "A LISTA DE ISENÇÕES DA TRAVA DE DADOS", logo abaixo do
# PADRAO_PORTAO; a prova, rodando, está em scripts/portao-teste.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -u

# Os arquivos que o portão protege. Caminhos a partir da raiz do repositório,
# casados por inteiro. Ampliar esta lista é decisão do Marco.
#
# Ampliado em 20/07/2026 (Tema 2, opção A): além de calc.js e golden.test.js,
# todo módulo que produz número mostrado em reunião, fecha a festa ou atravessa
# para outro sistema — fechamento.js, planoFinanceiro.js, dre.js,
# comparacaoCustos.js, receitaLiquida.js.
#
# Ampliado em 25/07/2026 (Marco, DECISOES-MARCO-H4.md item 3 — respondido em
# 24/07/2026 com 3a + 3b + 3c = SIM e 3d = NÃO):
#   3a  o PRÓPRIO PORTÃO — .github/workflows/ci.yml, .githooks/* e este
#       script. Sem isto, um único commit que removesse o passo do portão da
#       esteira desligava o portão para o próprio push que o removia.
#   3b  package.json e package-lock.json — fecha "dependência nova entra sem
#       ninguém ver".
#   3c  src/lib/precoLote.js e src/lib/simulador.js — fazem conta de dinheiro,
#       já são alvo de mutação e nasceram fora desta lista.
#   3d  os *.test.js dos módulos de cálculo ficam FORA, decisão do Marco: o
#       atrito diário de pedir aprovação a cada ajuste de teste de conta não se
#       paga. Só golden.test.js segue protegido.
#
# scripts/excecoes-dados.txt SAIU desta lista em 25/07/2026, no mesmo dia em que
# entrou, e o que ficou no lugar dele é a conferência de caminho novo logo
# abaixo. O porquê está escrito lá, com a conta que o Marco viu.
PADRAO_PORTAO='^(src/lib/(calc|golden\.test|fechamento|planoFinanceiro|dre|comparacaoCustos|receitaLiquida|precoLote|simulador)\.js|scripts/(portao-golden\.sh|trava-dados\.sh|padroes-dados\.txt)|\.githooks/.+|\.github/workflows/ci\.yml|package\.json|package-lock\.json)$'

# ─── A LISTA DE ISENÇÕES DA TRAVA DE DADOS ───────────────────────────────────
# (Marco, 25/07/2026, com a bateria na frente e a conta medida.)
#
# scripts/excecoes-dados.txt diz quais arquivos de DADOS podem ficar no
# repositório mesmo casando com um padrão de scripts/padroes-dados.txt. Cada
# linha de conteúdo é "<sha1-do-conteúdo> <caminho>": o caminho é o arquivo
# liberado; o hash é o conteúdo exato que alguém conferiu.
#
# O ARQUIVO INTEIRO esteve dentro do PADRAO_PORTAO por algumas horas de
# 25/07/2026. A consequência, que a bateria mostrou e o Marco não quis: REGERAR
# o mockup de documentação — mesmo arquivo, mesmo caminho, conteúdo novo, hash
# novo na lista — passou a exigir a linha de aprovação. Medido: isso aconteceu 3
# vezes na história do repositório, e não é a natureza que o portão guarda.
#
# AS TRÊS NATUREZAS, SEPARADAS (é isto que o código abaixo implementa):
#   ACRESCENTAR UM CAMINHO  é dizer "mais um arquivo de dados pode ficar no
#                           repositório". Portão do Marco: EXIGE a marcação.
#   ATUALIZAR O HASH        de um caminho que já está na lista é dizer "aquele
#                           mesmo arquivo foi regerado". PASSA LIVRE.
#   REMOVER UM CAMINHO      tira uma liberação: a trava passa a barrar mais.
#                           Só aperta, então PASSA LIVRE.
#
# O QUE ESTA SEPARAÇÃO DEIXA DE FORA, dito na cara em vez de escondido: com o
# caminho já na lista, trocar o hash por outro qualquer passa sem aprovação — e
# é assim que a planilha real de uma festa poderia tomar o lugar do mockup,
# desde que fique NAQUELE caminho. É a conta que o Marco fez de propósito: o
# atrito de pedir aprovação a cada regeração não se paga, e a troca continua
# sendo uma linha de diff que qualquer revisor enxerga. Quem estreita isso de
# novo é decisão dele, não manutenção de rotina.
#
# O MERGE, medido em 25/07/2026 para ninguém se assustar depois: um
# `git merge --no-ff` de ramificação que acrescentou caminho novo é RECUSADO
# pelo hook commit-msg local, porque durante o merge o índice traz a mudança e o
# portão julga o índice. Isso não é atrito novo desta conferência — é o mesmo
# que já acontecia, e foi medido acontecendo, ao juntar uma ramificação que
# mexeu em src/lib/calc.js, mesmo com a marcação no commit de origem. Repetir a
# marcação na mensagem do merge resolve; a junção na `main` é do Marco de
# qualquer jeito (CLAUDE.md).
REL_EXCECOES='scripts/excecoes-dados.txt'

# Os caminhos que APARECERAM na lista de isenções, um por linha. Vazio quer
# dizer "nada a exigir": ou a lista não mudou, ou só mudaram hashes de caminho
# que já estava lá, ou algum caminho saiu.
ISENCOES_NOVAS=""

# O campo de CAMINHO de toda linha de conteúdo de excecoes-dados.txt, lido da
# entrada padrão, um por linha e sem repetição.
#
# O recorte é o MESMO de scripts/trava-dados.sh (`analisar_excecoes`): tira o
# branco das duas pontas, pula linha vazia e comentário, e o caminho é tudo o
# que vem depois do PRIMEIRO espaço — é por isso que caminho com espaço no nome
# funciona sem aspas nos dois lados. Divergir daqui seria pior do que não
# conferir: o portão julgaria um conjunto de caminhos e a trava liberaria outro.
#
# UMA DIFERENÇA, DE PROPÓSITO: aqui entra o caminho de TODA linha de conteúdo,
# inclusive as que a trava classificaria como sem motivo escrito ou malformadas.
# Se o portão só olhasse as linhas bem-formadas, bastaria escrever o caminho
# novo SEM o comentário de motivo em cima para o portão não enxergá-lo. (A trava
# recusa essas linhas com código 2, então elas não entram — mas o portão não
# pode depender de outra trava para não ser burlado.)
caminhos_isentos() {
  awk '
    {
      linha = $0
      sub(/^[ \t\r]+/, "", linha)
      sub(/[ \t\r]+$/, "", linha)
      if (linha == "") next
      if (substr(linha, 1, 1) == "#") next
      corte = index(linha, " ")
      if (corte == 0) caminho = linha
      else            caminho = substr(linha, corte + 1)
      if (caminho == "") next
      if (caminho in visto) next
      visto[caminho] = 1
      print caminho
    }
  '
}

# A lista de caminhos isentos numa origem:
#   ""        a lista não existe ali (commit sem o arquivo, ou nenhum commit)
#   ":"       o ÍNDICE — o que está no stage, que é o que o commit vai gravar
#   <commit>  a lista como ela estava naquele commit
caminhos_isentos_em() {
  case "$1" in
    '')  : ;;
    ':') git show ":$REL_EXCECOES" 2>/dev/null | caminhos_isentos ;;
    *)   git show "$1:$REL_EXCECOES" 2>/dev/null | caminhos_isentos ;;
  esac
}

# Preenche ISENCOES_NOVAS com a diferença de CONJUNTO entre duas origens.
#   $1 = antes    $2 = depois
#
# COMPARAÇÃO BYTE A BYTE, SEM NORMALIZAR NADA — e isso é o ponto, não descuido.
# A trava de dados casa o caminho do git com o texto da linha por igualdade
# exata, então "docs/x.xlsx", "./docs/x.xlsx", "DOCS/X.xlsx" e "docs/x.xlsx "
# são entradas DIFERENTES para ela: só a primeira isenta alguma coisa, as outras
# são entradas mortas. Normalizar aqui faria o portão ler "já estava lá" quando
# alguém trocasse uma entrada morta por uma viva — que é exatamente a passagem
# que esta conferência existe para fechar. Trocar um caminho por outro na mesma
# linha também não escapa: é diferença de conjunto, não contagem de linhas.
#
# O ARQUIVO QUE NASCE NO COMMIT — a escolha, escrita para não se perder: quando
# não existe versão anterior da lista (o commit que CRIA o arquivo, ou o
# primeiro commit de um repositório), TODOS os caminhos de dentro dela contam
# como novos, e a marcação é exigida.
#
#   POR QUE não "arquivo novo passa livre": porque isso abriria um desvio de
#   dois commits. Apagar a lista num commit passa (tirar isenção só aperta), e
#   recriá-la no commit seguinte com quantos caminhos se quiser passaria também,
#   já que cada commit é julgado contra o PAI dele e "não existia antes". Os
#   dois passariam e a lista terminaria com caminhos que ninguém aprovou. Há
#   cenário na bateria fixando isto.
#
#   O CUSTO é uma vez só e já está pago: o commit que cria a lista mexe também
#   em scripts/trava-dados.sh e scripts/padroes-dados.txt, que são protegidos —
#   ele já precisava da linha do Marco de qualquer jeito.
#
#   CLONE RECÉM-FEITO não cai aqui: o modo --intervalo confere os commits NOVOS
#   da ramificação (base no ancestral comum com o ramo principal), e o commit
#   que criou a lista está no ramo principal desde sempre, fora do recorte.
isencoes_acrescentadas() {
  antes_tmp="${TMPDIR:-/tmp}/portao-isencoes-antes.$$"
  depois_tmp="${TMPDIR:-/tmp}/portao-isencoes-depois.$$"
  caminhos_isentos_em "$1" | LC_ALL=C sort -u > "$antes_tmp"
  caminhos_isentos_em "$2" | LC_ALL=C sort -u > "$depois_tmp"
  ISENCOES_NOVAS=$(LC_ALL=C comm -13 "$antes_tmp" "$depois_tmp")
  rm -f "$antes_tmp" "$depois_tmp"
}

# Hoje em aaaammdd — para recusar data de aprovação no futuro.
HOJE=$(date +%Y%m%d)

# Ano mínimo plausível de uma aprovação do Marco (H4-A2, item 6). O portão do
# golden nasceu em 19/07/2026 e o repositório começou em 2026; 2024 dá folga de
# sobra para qualquer aprovação antiga que alguém precise registrar depois, e
# ainda assim recusa o dedo errado que escreve "25/07/0026" ou "25/07/1026" —
# que hoje passavam, porque o formato casa, o ano existe e a comparação
# numérica não vê ano pequeno como futuro.
ANO_MINIMO=2024

# ─── AS DUAS PORTAS DE RECUSA ────────────────────────────────────────────────

# Quando a lista de arquivos NÃO veio do stage, esta variável diz de onde veio —
# senão a recusa nomeia arquivos que a pessoa não acabou de tocar e ela pensa
# que o portão enlouqueceu (H4-A2, item 5).
ORIGEM_ARQUIVOS=""

cabecalho_recusa() {
  arqs="$1"
  onde="$2"
  echo ""
  echo "✗ PORTÃO DO GOLDEN — recusado ($onde)."
  echo ""
  if [ -n "$arqs" ]; then
    echo "  Estes arquivos são portão do Marco (CLAUDE.md, princípios 1 e 8):"
    printf '      %s\n' $arqs
    echo ""
  fi
  if [ -n "$ISENCOES_NOVAS" ]; then
    echo "  A lista de isenções da trava de dados ($REL_EXCECOES)"
    echo "  ganhou caminho que não estava nela:"
    echo ""
    # `while read`, e não `printf '%s\n' $ISENCOES_NOVAS`: caminho de planilha
    # de festa tem espaço no nome quase sempre, e o printf sem aspas partiria
    # "docs/festa da brisa.xlsx" em quatro linhas — quatro arquivos que não
    # existem, e quem lesse iria procurar o errado.
    printf '%s\n' "$ISENCOES_NOVAS" | while IFS= read -r caminho_novo; do
      [ -n "$caminho_novo" ] && printf '      %s\n' "$caminho_novo"
    done
    echo ""
    echo "  Acrescentar um caminho ali é dizer \"este arquivo de dados pode ficar"
    echo "  no repositório\" — e isso é decisão do Marco, não manutenção de rotina."
    echo ""
    echo "  O que NÃO precisa de aprovação e continua passando livre:"
    echo "    · ATUALIZAR O HASH de um caminho que JÁ está na lista — o arquivo foi"
    echo "      regerado, o caminho é o mesmo (git hash-object <arquivo> dá o hash);"
    echo "    · TIRAR um caminho da lista — isenção a menos só aperta a trava."
    echo ""
  fi
  if [ -n "$ORIGEM_ARQUIVOS" ]; then
    echo "  $ORIGEM_ARQUIVOS"
    echo ""
  fi
}

rodape_formato() {
  echo "  Formato aceito da marcação:"
  echo ""
  echo "      APROVADO-PELO-MARCO: dd/mm/aaaa motivo em pelo menos três palavras"
  echo ""
  echo "  Ela vale na PRIMEIRA linha do corpo (logo abaixo do assunto e da linha"
  echo "  em branco) ou no RODAPÉ — o último parágrafo, separado por linha em"
  echo "  branco e sem texto corrido junto. A data tem de existir no calendário,"
  echo "  ser de $ANO_MINIMO para cá e não estar no futuro."
  echo ""
  echo "  Antes de pedir essa aprovação: mostre ao Marco o diff em português dos"
  echo "  valores antigos × novos. Sem isso não há aprovação a registrar."
  echo ""
}

# ONDE ESTAMOS na linha do tempo do commit — decide qual conserto ENSINAR
# (H4-A2, item C do Marco). Valores:
#   antes-do-commit    hook commit-msg: o commit AINDA NÃO EXISTE
#   amend-de-mensagem  hook commit-msg num `git commit --amend` sem nada no
#                      stage: o commit existe e é ELE que está sendo reescrito
#   commit-existente   modos --commit e --intervalo: o commit já está no histórico
CONTEXTO_RECUSA=commit-existente

# O bloco "como consertar a mensagem". Ele existia com UM texto só — e o texto
# mandava `git commit --amend` sempre. No hook commit-msg isso é um conselho
# DESTRUTIVO: o commit que está sendo recusado ainda não existe, então o amend
# cai no commit ANTERIOR, engole o assunto dele e apaga do histórico um trabalho
# que não tinha nada com isto. Medido em 25/07/2026.
como_reescrever() {
  if [ "$CONTEXTO_RECUSA" = "amend-de-mensagem" ]; then
    echo "      Você está reescrevendo a mensagem de um commit que JÁ EXISTE (é o"
    echo "      que o \`--amend\` faz). Leve o diff ao Marco e repita o amend com a"
    echo "      marcação na mensagem:"
    echo ""
    echo "          git commit --amend -m \"assunto do commit"
    echo ""
    echo "          APROVADO-PELO-MARCO: dd/mm/aaaa motivo em três palavras\""
    echo ""
    echo "      Se preferir desistir do amend, nada se perdeu: o commit original"
    echo "      continua exatamente como estava."
  elif [ "$CONTEXTO_RECUSA" = "antes-do-commit" ]; then
    echo "      Este commit AINDA NÃO EXISTE — ele foi barrado antes de nascer."
    echo "      Leve o diff ao Marco e, com a aprovação dele, REFAÇA ESTE MESMO"
    echo "      commit com a marcação na mensagem:"
    echo ""
    echo "          git commit -m \"assunto do commit"
    echo ""
    echo "          APROVADO-PELO-MARCO: dd/mm/aaaa motivo em três palavras\""
    echo ""
    echo "      A mensagem que você acabou de escrever não se perdeu: ela está em"
    echo "      .git/COMMIT_EDITMSG e pode ser reaproveitada com"
    echo "      git commit -e -F \"\$(git rev-parse --git-dir)/COMMIT_EDITMSG\""
    echo ""
    echo "      NÃO use \`git commit --amend\` agora: como este commit não existe,"
    echo "      o amend cairia no commit ANTERIOR e engoliria o assunto dele."
  else
    echo "      Leve o diff ao Marco e, com a aprovação dele, reescreva a mensagem"
    echo "      DO COMMIT QUE FOI BARRADO (o identificador dele está acima):"
    echo ""
    echo "          se ele for o último commit  →  git commit --amend"
    echo "          se estiver mais atrás       →  git rebase --interactive <commit-anterior>"
    echo "                                          e troque 'pick' por 'reword' na linha dele"
    echo ""
    echo "      Reescrever a mensagem troca o identificador do commit; em ramo já"
    echo "      publicado isso exige push forçado — combine antes com quem estiver"
    echo "      trabalhando no mesmo ramo."
  fi
}

# Porta 1 — tocou arquivo protegido (ou acrescentou isenção de dados) e não há
# marcação nenhuma.
recusar() {
  arqs_recusa="$1"
  cabecalho_recusa "$1" "$2"
  if [ -n "$arqs_recusa" ]; then
    echo "  Fórmula, golden e as travas do próprio portão só mudam com aprovação"
    echo "  explícita e datada do Marco, registrada na mensagem do commit."
    echo ""
  fi
  echo "  O que fazer agora:"
  echo ""
  como_reescrever
  echo ""
  rodape_formato
  exit 1
}

# Porta 1b — há marcação, mas ela não corresponde ao que diz (H4-A, item 4).
recusar_marcacao() {
  arqs="$1"
  onde="$2"
  explicacao="$3"
  acao="$4"
  cabecalho_recusa "$arqs" "$onde"
  echo "  A mensagem TRAZ uma marcação, mas ela não corresponde ao que diz:"
  echo ""
  echo "      $explicacao"
  echo ""
  echo "  O que fazer agora:"
  echo ""
  echo "      $acao"
  echo ""
  echo "  E, para pôr a mensagem corrigida no lugar:"
  echo ""
  como_reescrever
  echo ""
  rodape_formato
  exit 1
}

# Porta 2 — o portão NÃO CONSEGUIU OLHAR (H4-A, itens 2 e 3). Sai por uma
# porta diferente da de "conferi e está limpo", de propósito: um portão que
# devolve verde quando não enxergou nada ensina a confiar no verde errado.
#
# A "saída que sempre funciona" (H4-A2, item C do Marco): toda recusa por
# cegueira termina oferecendo a conferência com base explícita. Antes, duas das
# quatro portas mandavam apenas "confira o identificador" ou "crie uma
# etiqueta" — conselho que não resolve quando quem está travado é a esteira,
# que não tem como criar etiqueta nem adivinhar identificador. Com a base
# explícita qualquer pessoa destrava em uma linha, sem afrouxar nada: o portão
# confere o intervalo inteiro que ela indicar.
recusar_cego() {
  onde="$1"
  explicacao="$2"
  acao="$3"
  topo_sugerido="${4:-HEAD}"
  echo ""
  echo "✗ PORTÃO DO GOLDEN — recusado: NÃO CONSEGUI CONFERIR ($onde)."
  echo ""
  echo "      $explicacao"
  echo ""
  echo "  Isto não é 'está limpo', é 'não olhei'. As duas coisas saíam pela"
  echo "  mesma porta até 25/07/2026; agora não saem mais."
  echo ""
  echo "  O que fazer agora:"
  echo ""
  echo "      $acao"
  echo ""
  echo "  A saída que funciona em qualquer caso — diga a base na mão, e o portão"
  echo "  confere o intervalo inteiro:"
  echo ""
  echo "      ./scripts/portao-golden.sh --intervalo <commit-base> $topo_sugerido"
  echo ""
  echo "  (<commit-base> é o último ponto já conferido; para conferir um commit"
  echo "  só, ./scripts/portao-golden.sh --commit <sha>.)"
  echo ""
  exit 1
}

# ─── LISTAGEM DOS ARQUIVOS TOCADOS ───────────────────────────────────────────

# Lê da entrada padrão a saída -z de `--name-status` e imprime, uma por linha,
# TODAS as faces de caminho que a mudança tocou (H4-A, item 1):
#   M/A/D/T/U…  o caminho, seja ele modificado, criado ou APAGADO
#   R…/C…       OS DOIS lados: o caminho VELHO e o NOVO
# É isso que faz `git rm src/lib/calc.js` e `git mv src/lib/calc.js outro.js`
# passarem a ser barrados — o caminho velho continua na lista mesmo quando some
# da árvore. Se a detecção de rename estiver desligada, o git reporta D+A e o
# lado D barra do mesmo jeito: os dois caminhos levam ao mesmo lugar.
#
# -z (Sessão H4, 24/07/2026) porque sem ele o git escapa caminho com acento
# ("or\303\247amento.xlsx", com aspas nas pontas), as âncoras ^ e $ do
# PADRAO_PORTAO param de casar e a trava aprova calada. Hoje todo caminho
# protegido é ASCII puro, então aqui é PREVENÇÃO — fica igual à leitura do
# .githooks/pre-commit para as duas travas não divergirem no dia em que a lista
# ganhar um nome com acento.
#
# LIMITE CONHECIDO E DECLARADO: caminho com \n literal no nome desanda a
# leitura (o `tr` transforma o separador em \n). Nenhum caminho protegido tem
# um, e criar um seria um ato deliberado que o revisor humano enxerga.
faces_de_caminho() {
  tr '\0' '\n' | {
    esperando=estado
    while IFS= read -r campo; do
      [ -n "$campo" ] || continue
      case "$esperando" in
        estado)
          # R100 / C075 vêm seguidos de DOIS caminhos; todo o resto, de um só.
          case "$campo" in
            R*|C*) esperando=origem ;;
            *)     esperando=destino ;;
          esac
          ;;
        origem)
          printf '%s\n' "$campo"
          esperando=destino
          ;;
        destino)
          printf '%s\n' "$campo"
          esperando=estado
          ;;
      esac
    done
  }
}

# TODOS os caminhos tocados por um commit já feito. Sem --diff-filter: o filtro
# ACMR de antes deixava o D (apagado) de fora.
#
# LIMITE DECLARADO, medido em 25/07/2026: num commit de MERGE esta listagem sai
# VAZIA — `git show --name-status` só mostra arquivo de merge com -c/--cc. Ou
# seja, o portão não enxerga merge, e nunca enxergou. A conferência de isenções
# abaixo é ligada por ESTA MESMA listagem de propósito, para não passar a
# recusar merge que traz uma isenção já aprovada no commit de origem — o que
# seria atrito novo, não trava nova. Quem pega o commit de origem é o
# --intervalo, que o julga um a um quando ele entra no push.
faces_do_commit() {
  git show --name-status -M --format= -z "$1" 2>/dev/null | faces_de_caminho
}

# Só os caminhos que a lista protegida casa.
protegidos_do_commit() {
  faces_do_commit "$1" | grep -E "$PADRAO_PORTAO" || true
}

# A lista de faces tocadas nomeia scripts/excecoes-dados.txt? `grep -qxF` casa a
# LINHA INTEIRA: um arquivo chamado "docs/scripts/excecoes-dados.txt" não conta.
tocou_excecoes() {
  printf '%s\n' "$1" | grep -qxF -- "$REL_EXCECOES"
}

# Arquivos protegidos no stage (hook commit-msg). MESMA leitura do modo
# --commit: os dois modos tinham o mesmo defeito e agora têm o mesmo conserto.
#
# H4-A2, item 5 — O AMEND SÓ-DE-MENSAGEM. `git commit --amend` que mexe apenas
# na mensagem não põe nada no stage: `git diff --cached` sai VAZIO, o modo
# --commit-msg lia essa lista vazia como "não tocou em arquivo protegido" e
# saía 0 sem nem abrir a mensagem. Ou seja: dava para APAGAR a marcação de um
# commit de fórmula já feito, com um amend, e o portão aplaudia. Medido em
# 25/07/2026 em repositório descartável.
#
# O conserto é estrutural, e por isso vale em qualquer git e em qualquer
# sistema: quando o stage está VAZIO, quem manda no conteúdo do commit é o
# HEAD — é ele que o amend vai reescrever. Então é o HEAD que o portão confere.
#
# POR QUE NÃO "detectar o --amend": medimos em 25/07/2026 que o git NÃO dá
# sinal nenhum de amend ao hook commit-msg — nem variável de ambiente, nem
# arquivo em .git/. Sobrava farejar a linha de comando do processo pai (ps),
# que quebra quando o hook deixa de usar `exec`, quando o commit vem de uma
# interface gráfica ou num sistema sem `ps` — e que ainda erraria o diagnóstico
# num commit cuja mensagem apenas CITE "--amend". Preferimos a regra estrutural.
#
# EFEITOS DECLARADOS desta escolha:
#   · `git commit --allow-empty` logo depois de um commit de fórmula passa a
#     pedir a marcação. É atrito raro e o texto da recusa diz de onde vieram os
#     arquivos, então ninguém fica sem entender.
#   · um amend que TAMBÉM leva mudança nova no stage continua conferido só pelo
#     stage. Quem pega esse caso é o modo --intervalo do pre-push e da esteira:
#     o commit reescrito é um SHA novo e entra no rev-list do push.
# Devolve o resultado em ARQS_STAGE (e não pela saída padrão) DE PROPÓSITO:
# ela também precisa avisar de ONDE veio a lista, e uma variável escrita dentro
# de `$( )` morreria no subshell antes de chegar na mensagem de recusa.
ARQS_STAGE=""
protegidos_no_stage() {
  ARQS_STAGE=""
  ISENCOES_NOVAS=""
  do_stage=$(git diff --cached --name-status -M -z | faces_de_caminho)

  if [ -n "$do_stage" ]; then
    ARQS_STAGE=$(printf '%s\n' "$do_stage" | grep -E "$PADRAO_PORTAO" || true)
    # A lista de isenções ANTES é a do HEAD (vazia se ainda não há commit
    # nenhum); DEPOIS é a do ÍNDICE, que é o que este commit vai gravar.
    if tocou_excecoes "$do_stage"; then
      cabeca=$(git rev-parse --quiet --verify HEAD 2>/dev/null || true)
      isencoes_acrescentadas "$cabeca" ":"
    fi
    return 0
  fi

  git rev-parse --verify --quiet HEAD >/dev/null 2>&1 || return 0
  faces_head=$(faces_do_commit HEAD)
  do_head=$(printf '%s\n' "$faces_head" | grep -E "$PADRAO_PORTAO" || true)
  # No amend só-de-mensagem quem está sendo julgado é o próprio HEAD, então a
  # comparação de isenções é HEAD^ × HEAD — senão um amend poderia apagar a
  # marcação do commit que acrescentou o caminho novo, que é o mesmo buraco do
  # item 5 do H4-A2 com outra roupa.
  if tocou_excecoes "$faces_head"; then
    pai_head=$(git rev-parse --quiet --verify 'HEAD^' 2>/dev/null || true)
    isencoes_acrescentadas "$pai_head" HEAD
  fi
  [ -n "$do_head" ] || [ -n "$ISENCOES_NOVAS" ] || return 0
  ARQS_STAGE="$do_head"
  CONTEXTO_RECUSA=amend-de-mensagem
  ORIGEM_ARQUIVOS="Não há nada no stage: esta mensagem reescreve o commit já feito
  $(git log -1 --format='%h %s' HEAD)
  e é o conteúdo DELE que está julgado acima. Um \`git commit --amend\` que
  mexe só na mensagem pode apagar a marcação de aprovação — por isso ele passa
  pelo mesmo portão."
}

# ─── A MARCAÇÃO ──────────────────────────────────────────────────────────────

# Tira zeros à esquerda sem cair na armadilha do octal do shell ("08" e "09"
# são aritmética inválida em /bin/sh).
sem_zero() {
  v="$1"
  while [ "${v#0}" != "$v" ] && [ ${#v} -gt 1 ]; do v="${v#0}"; done
  printf '%s' "$v"
}

bissexto() {
  a=$(sem_zero "$1")
  if [ $((a % 4)) -ne 0 ]; then return 1; fi
  if [ $((a % 100)) -ne 0 ]; then return 0; fi
  [ $((a % 400)) -eq 0 ]
}

# O dia/mês/ano existe mesmo no calendário? (31/02 não existe; ano bissexto conta)
data_existe() {
  d=$(sem_zero "$1"); m=$(sem_zero "$2"); a=$(sem_zero "$3")
  [ "$m" -ge 1 ] && [ "$m" -le 12 ] || return 1
  [ "$d" -ge 1 ] || return 1
  case "$m" in
    1|3|5|7|8|10|12) max=31 ;;
    4|6|9|11)        max=30 ;;
    2)               if bissexto "$a"; then max=29; else max=28; fi ;;
    *)               return 1 ;;
  esac
  [ "$d" -le "$max" ]
}

# Lê a mensagem do commit da entrada padrão e devolve o veredicto de POSIÇÃO:
#   AUSENTE                 nenhuma linha de marcação
#   POSICAO <linha> <caso>  existe, mas fora das posições que valem
#   OK                      existe e está em posição válida; a 2ª linha da saída
#                           traz o conteúdo que vem depois do rótulo
#
# AS DUAS POSIÇÕES QUE VALEM (H4-A, item 4): a PRIMEIRA linha não vazia do
# corpo, ou uma linha do RODAPÉ — o último parágrafo, quando ele vem depois de
# uma linha em branco. É a segunda condição que recusa a marcação copiada de
# outro commit e colada no meio de um parágrafo de texto corrido: aquele
# parágrafo não é rodapé.
#
# O QUE CONTA COMO RODAPÉ (afrouxado em 25/07/2026 — H4-A2, item 7). A regra
# antiga exigia que TODAS as linhas do último parágrafo fossem `Chave: valor`,
# a convenção de trailer do git. Medido: isso recusa marcação legítima por
# causa de vizinhança inocente — um `Refs #12`, uma URL solta, um item de lista
# no mesmo bloco derrubavam o commit inteiro. Agora o bloco é rodapé quando
# NENHUMA de suas linhas é TEXTO CORRIDO, e texto corrido é uma linha com
# quatro palavras ou mais que não seja trailer, nem item de lista, nem citação.
#   rodapé  →  "Refs #12", "https://exemplo.invalido/x", "- ver ticket",
#              "Co-authored-by: Fulano <f@x>"
#   corpo   →  "Move arquivos de lugar sem mudar comportamento nenhum."
# Continua recusada, de propósito, a marcação ensanduichada em prosa — que é o
# desenho de quem copia a linha de outro commit e esconde no meio do texto.
#
# O CASO, na saída, existe porque a recusa antiga ERRAVA O DIAGNÓSTICO: dizia
# "solta no meio do corpo" mesmo quando a linha era a ÚLTIMA da mensagem, e
# então mandava a pessoa fazer exatamente o que ela já tinha feito.
#   FIM_SEM_RODAPE   é a última linha da mensagem, mas grudada num parágrafo de
#                    texto corrido (falta a linha em branco que abre o rodapé)
#   DENTRO_PARAGRAFO está no último parágrafo, com texto corrido em volta
#   MEIO_DO_CORPO    está num parágrafo do meio da mensagem
#
# RECUO: até 3 espaços/tabulações são tolerados DE PROPÓSITO. Uma marcação
# legítima indentada com dois espaços era recusada (medido em 25/07/2026),
# enquanto uma solta e inventada era aceita — ninguém deve apanhar por causa de
# espaço em branco.
#
# Sem intervalo `{n,m}` nas expressões: nem todo awk de esteira o suporta.
analisar_posicao() {
  awk '
    function recuo(s,   t) { t = s; sub(/[^ \t].*$/, "", t); return length(t) }
    function e_marcacao(s) { return (s ~ /^[ \t]*APROVADO-PELO-MARCO:/) && recuo(s) <= 3 }
    function e_trailer(s)  { return (s ~ /^[ \t]*[A-Za-z][A-Za-z0-9_-]*:[ \t]/) && recuo(s) <= 3 }
    function e_lista(s)    { return s ~ /^[ \t]*[-*+>|]/ }
    function palavras(s,   t, arr) {
      t = s
      gsub(/^[ \t]+/, "", t); gsub(/[ \t]+$/, "", t)
      if (t == "") return 0
      return split(t, arr, /[ \t]+/)
    }
    function e_texto_corrido(s) {
      if (e_trailer(s) || e_marcacao(s) || e_lista(s)) return 0
      return palavras(s) >= 4
    }
    # O git limpa linhas de comentário antes de gravar a mensagem; no arquivo
    # que o hook commit-msg recebe elas ainda estão lá.
    /^#/ { linhas[NR] = ""; next }
    { linhas[NR] = $0 }
    END {
      ultima = 0
      for (i = 1; i <= NR; i++) if (linhas[i] ~ /[^ \t]/) ultima = i
      if (ultima == 0) { print "AUSENTE"; exit }

      primeira_corpo = 0
      for (i = 2; i <= ultima; i++)
        if (linhas[i] ~ /[^ \t]/) { primeira_corpo = i; break }

      inicio_bloco = 1
      for (i = 1; i <= ultima; i++)
        if (linhas[i] !~ /[^ \t]/) inicio_bloco = i + 1

      # Só é RODAPÉ se veio depois de uma linha em branco E nenhuma linha do
      # bloco é texto corrido. Parágrafo de prosa no fim da mensagem não é
      # rodapé — nem quando termina com a marcação.
      rodape_ok = (inicio_bloco > 1)
      for (i = inicio_bloco; i <= ultima; i++)
        if (e_texto_corrido(linhas[i])) rodape_ok = 0

      achou = 0
      for (i = 1; i <= ultima; i++) {
        if (!e_marcacao(linhas[i])) continue
        if (i == primeira_corpo || (rodape_ok && i >= inicio_bloco)) {
          conteudo = linhas[i]
          sub(/^[ \t]*APROVADO-PELO-MARCO:/, "", conteudo)
          print "OK"
          print conteudo
          exit
        }
        if (achou == 0) achou = i
      }
      if (achou > 0) {
        # A ordem importa: o ASSUNTO é a linha 1 e tem de ser reconhecido antes
        # de tudo, senão uma mensagem de uma linha só (o `git commit -m` com a
        # marcação no lugar do assunto) seria diagnosticada como "última linha
        # colada na prosa" — outro diagnóstico errado, do mesmo tipo do que
        # esta sessão veio consertar.
        if (achou == 1)                 caso = "ASSUNTO"
        else if (achou == ultima)       caso = "FIM_SEM_RODAPE"
        else if (achou >= inicio_bloco) caso = "DENTRO_PARAGRAFO"
        else                            caso = "MEIO_DO_CORPO"
        print "POSICAO " achou " " caso
        exit
      }
      print "AUSENTE"
    }
  '
}

# Confere a mensagem inteira. Devolve:
#   0  marcação válida
#   1  não há marcação nenhuma (chame `recusar`)
#   2  há marcação, mas ela não corresponde — MOTIVO_MARCACAO e ACAO_MARCACAO
#      trazem, em português, o que houve e o que fazer em seguida
MOTIVO_MARCACAO=""
ACAO_MARCACAO=""
conferir_marcacao() {
  arquivo_msg="$1"
  MOTIVO_MARCACAO=""
  ACAO_MARCACAO=""

  analise=$(analisar_posicao < "$arquivo_msg")
  veredicto=$(printf '%s\n' "$analise" | head -n 1)

  case "$veredicto" in
    AUSENTE)
      return 1
      ;;
    POSICAO\ *)
      resto=${veredicto#POSICAO }
      linha=${resto%% *}
      caso=${resto##* }
      case "$caso" in
        ASSUNTO)
          MOTIVO_MARCACAO="a marcação está no ASSUNTO do commit (linha 1) — o assunto é o que aparece na lista de commits, e ali a marcação nem se lê inteira."
          ACAO_MARCACAO="escreva um assunto que diga o que mudou e ponha a marcação abaixo, separada por uma linha em branco (a PRIMEIRA linha do corpo)."
          ;;
        FIM_SEM_RODAPE)
          MOTIVO_MARCACAO="a marcação está na linha $linha, que é a ÚLTIMA da mensagem — mas colada num parágrafo de texto corrido, e ali ela não faz rodapé."
          ACAO_MARCACAO="deixe uma linha EM BRANCO antes dela, para a marcação ficar num rodapé só dela no fim da mensagem."
          ;;
        DENTRO_PARAGRAFO)
          MOTIVO_MARCACAO="a marcação está na linha $linha, dentro do último parágrafo e com texto corrido acima e abaixo dela — ali ela é indistinguível de uma linha copiada de outro commit."
          ACAO_MARCACAO="separe-a do parágrafo: uma linha em branco antes, e a marcação sozinha no fim da mensagem (ou na PRIMEIRA linha do corpo)."
          ;;
        *)
          MOTIVO_MARCACAO="a marcação está na linha $linha, solta no meio do corpo — ali ela é indistinguível de uma linha copiada de outro commit."
          ACAO_MARCACAO="mova a marcação para a PRIMEIRA linha do corpo (logo abaixo do assunto e da linha em branco) ou para o rodapé, no fim da mensagem."
          ;;
      esac
      return 2
      ;;
  esac

  conteudo=$(printf '%s\n' "$analise" | tail -n +2)
  data=$(printf '%s\n' "$conteudo" | awk '{print $1}')
  palavras=$(printf '%s\n' "$conteudo" | awk '{print NF - 1}')

  if ! printf '%s\n' "$data" | grep -Eq '^[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]$'; then
    MOTIVO_MARCACAO="a data escrita ('$data') não está em dd/mm/aaaa."
    ACAO_MARCACAO="escreva a data da aprovação em dd/mm/aaaa, com dois dígitos no dia e no mês (ex.: 09/07/2026)."
    return 2
  fi

  dia=$(printf '%s' "$data" | cut -c1-2)
  mes=$(printf '%s' "$data" | cut -c4-5)
  ano=$(printf '%s' "$data" | cut -c7-10)

  if ! data_existe "$dia" "$mes" "$ano"; then
    MOTIVO_MARCACAO="a data $data não existe no calendário."
    ACAO_MARCACAO="corrija para o dia em que o Marco viu o diff e aprovou — a marcação registra uma aprovação que aconteceu, não uma data qualquer."
    return 2
  fi

  # H4-A2, item 6 — ANO ABSURDO. "25/07/0026" casava o formato, o ano existe no
  # calendário e a comparação numérica de futuro não o pegava (00260725 é menor
  # que hoje). O portão aceitava, como aprovação do Marco, uma data do século
  # III. Agora o ano tem de ser plausível.
  if [ "$(sem_zero "$ano")" -lt "$ANO_MINIMO" ]; then
    MOTIVO_MARCACAO="o ano de $data é anterior a $ANO_MINIMO — não é uma data plausível de aprovação (o portão do golden nasceu em 19/07/2026)."
    ACAO_MARCACAO="confira os quatro dígitos do ano e escreva o dia em que o Marco aprovou de verdade (ex.: 25/07/2026)."
    return 2
  fi

  if [ "$ano$mes$dia" -gt "$HOJE" ]; then
    hoje_legivel="$(printf '%s' "$HOJE" | cut -c7-8)/$(printf '%s' "$HOJE" | cut -c5-6)/$(printf '%s' "$HOJE" | cut -c1-4)"
    MOTIVO_MARCACAO="a data $data está no futuro (hoje é $hoje_legivel)."
    ACAO_MARCACAO="use a data em que o Marco aprovou de verdade; aprovação que ainda não aconteceu não se registra."
    return 2
  fi

  if [ "$palavras" -lt 3 ]; then
    MOTIVO_MARCACAO="o motivo tem $palavras palavra(s) — menos que as três mínimas."
    ACAO_MARCACAO="escreva o motivo em pelo menos três palavras, dizendo o que muda no número (ex.: 'corrigir o rateio do cashback por lote')."
    return 2
  fi

  return 0
}

# ─── CONFERÊNCIA DE UM COMMIT ────────────────────────────────────────────────

# Um commit passa se não toca arquivo protegido OU se traz a marcação válida.
conferir_commit() {
  sha="$1"

  # H4-A, item 3: identificador que não existe devolvia "nada a barrar" com
  # exit 0 — a saída vazia do `git show` era lida como "não tocou em arquivo
  # protegido".
  if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    recusar_cego "commit $sha" \
      "O commit '$sha' não existe neste clone — nada foi conferido." \
      "confira o identificador (git log --oneline mostra os que existem aqui); se o clone for raso, complete o histórico com git fetch --unshallow — na esteira, actions/checkout com fetch-depth: 0 — e rode de novo." \
      "HEAD"
  fi

  faces=$(faces_do_commit "$sha")
  arqs=$(printf '%s\n' "$faces" | grep -E "$PADRAO_PORTAO" || true)

  # A conferência de isenções de dados, no recorte deste commit: o que a lista
  # tinha no PAI dele × o que ela tem nele. Sem pai (commit raiz), o antes é
  # vazio e todo caminho conta como novo — a escolha está escrita em
  # `isencoes_acrescentadas`.
  ISENCOES_NOVAS=""
  if tocou_excecoes "$faces"; then
    pai=$(git rev-parse --quiet --verify "$sha^" 2>/dev/null || true)
    isencoes_acrescentadas "$pai" "$sha"
  fi

  [ -n "$arqs" ] || [ -n "$ISENCOES_NOVAS" ] || return 0

  msg_tmp="${TMPDIR:-/tmp}/portao-golden-msg.$$"
  git log -1 --format=%B "$sha" > "$msg_tmp"
  conferir_marcacao "$msg_tmp"
  resultado=$?
  rm -f "$msg_tmp"

  onde="commit $(git log -1 --format=%h "$sha")"
  case "$resultado" in
    0)
      echo "  ✓ $(git log -1 --format='%h %s' "$sha") — aprovação do Marco registrada"
      return 0
      ;;
    2)
      echo "  commit: $(git log -1 --format='%h %s' "$sha")"
      recusar_marcacao "$arqs" "$onde" "$MOTIVO_MARCACAO" "$ACAO_MARCACAO"
      ;;
    *)
      echo "  commit: $(git log -1 --format='%h %s' "$sha")"
      recusar "$arqs" "$onde"
      ;;
  esac
}

modo="${1:---ajuda}"

case "$modo" in
  --commit-msg)
    msg="${2:-}"
    [ -n "$msg" ] || { echo "uso: $0 --commit-msg <arquivo-da-mensagem>"; exit 2; }
    # Aqui o commit AINDA NÃO EXISTE: quem recusar tem de ensinar a refazer o
    # commit, nunca `git commit --amend` (que cairia no commit anterior).
    CONTEXTO_RECUSA=antes-do-commit
    protegidos_no_stage
    arqs="$ARQS_STAGE"
    [ -n "$arqs" ] || [ -n "$ISENCOES_NOVAS" ] || exit 0
    conferir_marcacao "$msg"
    resultado=$?
    case "$resultado" in
      0) exit 0 ;;
      2) recusar_marcacao "$arqs" "hook commit-msg" "$MOTIVO_MARCACAO" "$ACAO_MARCACAO" ;;
      *) recusar "$arqs" "hook commit-msg" ;;
    esac
    ;;

  --commit)
    sha="${2:-}"
    [ -n "$sha" ] || { echo "uso: $0 --commit <sha>"; exit 2; }
    conferir_commit "$sha"
    ;;

  --intervalo)
    base="${2:-}"; head="${3:-HEAD}"

    if ! git cat-file -e "$head^{commit}" 2>/dev/null; then
      recusar_cego "intervalo" \
        "O topo '$head' não existe neste clone — nada foi conferido." \
        "confira o identificador do topo e rode de novo; na esteira, garanta que o checkout traz o commit do push (fetch-depth: 0)."
    fi

    # ── O PORTÃO CALCULA A BASE SOZINHO (H4-A2, 25/07/2026) ─────────────────
    # Decisão do Marco (DECISOES-MARCO-H4.md, item 15). Base inválida acontece
    # por motivo legítimo quase toda semana — ramificação nova, primeiro push,
    # força-push — e o git manda quarenta zeros nesses casos. Antes daqui, a
    # tentativa foi ancorar na última ETIQUETA; foi MEDIDO que ela mente: uma
    # etiqueta criada EM CIMA de um commit não aprovado vira a âncora, o commit
    # ruim fica fora do intervalo e o portão anuncia "nada a barrar". O
    # caminho da etiqueta foi apagado inteiro.
    #
    # A âncora certa é o RAMO PRINCIPAL, que é de onde toda ramificação sai: o
    # ancestral comum entre o topo e `origin/main` (ou `main`, nessa ordem) é
    # exatamente o ponto em que a ramificação nasceu. `base..topo` passa a ser
    # a lista dos commits NOVOS dela — nem mais (não julga retroativamente os
    # 115 commits que já estavam em main sob a lista protegida de hoje), nem
    # menos (nenhum commit novo escapa, tenha etiqueta em cima ou não).
    #
    # Sem ramo principal no clone — clone raso, repositório recém-criado — o
    # portão RECUSA por uma porta própria dizendo o comando exato. Nunca finge
    # que conferiu.
    #
    # O caminho de base VÁLIDA não muda: percorre a lista inteira, como sempre.
    base_descoberta=nao
    ramo_principal=""
    case "$base" in
      ''|0000000000000000000000000000000000000000)
        base_invalida=sim
        ;;
      *)
        if git cat-file -e "$base^{commit}" 2>/dev/null; then
          base_invalida=nao
        else
          base_invalida=sim
        fi
        ;;
    esac

    if [ "$base_invalida" = "sim" ]; then
      achou_ramo=nao
      ancestral=""
      for ramo in origin/main main; do
        git rev-parse --verify --quiet "$ramo^{commit}" >/dev/null 2>&1 || continue
        achou_ramo=sim
        ancestral=$(git merge-base "$ramo" "$head" 2>/dev/null || true)
        if [ -n "$ancestral" ]; then
          ramo_principal="$ramo"
          break
        fi
      done

      if [ -z "$ramo_principal" ]; then
        if [ "$achou_ramo" = "nao" ]; then
          recusar_cego "intervalo sem base válida" \
            "A base '$base' não serve (vazia, zerada ou ausente deste clone) e este clone não tem o ramo principal: nem 'origin/main', nem 'main'. Sem ele não há de onde tirar a base, e NADA foi conferido." \
            "traga o ramo principal e rode de novo:
          git fetch origin main:refs/remotes/origin/main
      Se o clone for raso, primeiro complete o histórico (git fetch --unshallow);
      na esteira, use actions/checkout com fetch-depth: 0 e busque o main antes
      do passo do portão." \
            "$head"
        fi
        recusar_cego "intervalo sem base válida" \
          "A base '$base' não serve e o topo '$head' não tem ancestral comum com o ramo principal encontrado — históricos sem parentesco, ou clone raso demais para achar o ponto onde a ramificação nasceu. NADA foi conferido." \
          "complete o histórico e rode de novo:
          git fetch --unshallow   (ou git fetch --deepen=200)
      Se os históricos forem mesmo separados, diga a base na mão." \
          "$head"
      fi

      base="$ancestral"
      base_descoberta=sim
      echo "  (sem base válida: base descoberta no ancestral comum entre o topo e '$ramo_principal' — $(git log -1 --format='%h %s' "$ancestral"))"
      echo "  (conferindo só os commits novos da ramificação, nem mais nem menos)"
    fi

    lista=$(git rev-list "$base".."$head")

    if [ -z "$lista" ]; then
      # H4-A, item 3: lista vazia tinha DOIS significados colados num exit 0 —
      # "não há commit novo" (legítimo) e "o topo está atrás da base", que é
      # não ter olhado nada. Agora só o primeiro passa.
      if [ "$base_descoberta" = "sim" ]; then
        # O topo já está inteiro dentro do ramo principal: não há commit NOVO.
        # A pergunta é se isso significa "já foi conferido quando entrou lá" ou
        # "ninguém nunca conferiu isto". O portão distingue os dois pelo ÚNICO
        # sinal que ele tem de verdade — a âncora ser o ramo REMOTO ou não:
        #
        #   origin/main  o repositório é publicado e todo commit desta lista já
        #                entrou no principal por um push, que passou por este
        #                mesmo portão. Não há o que conferir, e dizê-lo é a
        #                verdade. É AQUI que cai `git push --tags`: medido em
        #                25/07/2026 que o pre-push recebe a etiqueta com
        #                remote_sha zerado, exatamente como uma ramificação
        #                nova. Recusar isso ensinaria `--no-verify` — e portão
        #                que ensina o desvio é pior que portão nenhum.
        #
        #   só 'main'    não há ramo remoto: nada aqui foi publicado nunca, e
        #                este pode ser o primeiro envio de um repositório novo,
        #                cujo histórico inteiro jamais passou por portão. Aí
        #                "não há commit novo" NÃO é "está limpo", e o portão
        #                recusa dizendo o comando que confere de verdade.
        case "$ramo_principal" in
          origin/*)
            echo "  (o topo já está inteiro dentro de '$ramo_principal': nenhum commit novo"
            echo "   para conferir — cada um deles foi conferido quando entrou no ramo"
            echo "   principal. É o caso de empurrar etiqueta ou ramificação idêntica.)"
            ;;
          *)
            recusar_cego "intervalo sem base válida" \
              "O topo '$head' já está inteiro dentro de '$ramo_principal', e este clone não tem ramo remoto: nada aqui foi publicado ainda, então NADA foi conferido — nem agora, nem antes. Se este for o primeiro envio do repositório, o histórico inteiro está sem conferência." \
              "confira o histórico inteiro de uma vez, dizendo o primeiro commit como base:
          ./scripts/portao-golden.sh --intervalo \$(git rev-list --max-parents=0 $head) $head" \
              "$head"
            ;;
        esac
      elif [ "$(git rev-parse "$base^{commit}")" = "$(git rev-parse "$head^{commit}")" ]; then
        echo "  (o topo é a própria base — nenhum commit novo para conferir)"
      else
        recusar_cego "intervalo" \
          "O intervalo '$base..$head' está vazio porque o topo está ATRÁS da base — nenhum commit foi conferido." \
          "inverta os argumentos: a base vem primeiro e o topo depois (--intervalo <base> <topo>)." \
          "$head"
      fi
    else
      for sha in $lista; do
        conferir_commit "$sha"
      done
    fi
    ;;

  *)
    echo "Portão do golden — uso:"
    echo "  $0 --commit-msg <arquivo>       (hook commit-msg)"
    echo "  $0 --commit <sha>"
    echo "  $0 --intervalo <base> <head>    (CI)"
    exit 2
    ;;
esac

echo "✓ Portão do golden: nada a barrar."
exit 0
