#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# auditoria.sh — o roteiro do auditor de uma vez (H3-L item 3, PLANO-HARDENING-3.md)
#
# Roda, NA ORDEM, os passos que uma sessão de auditoria roda manualmente hoje, e
# PARA no primeiro vermelho — com eco claro de cada passo e do porquê de ter
# parado. Não corrige nada sozinho: só diz o que está verde e o que não está.
#
# Como rodar (da raiz do repo, ou de qualquer lugar — o script se localiza):
#     bash scripts/auditoria.sh
#
# Passos, na ordem (para no primeiro vermelho):
#   (a) suíte completa em TZ=UTC
#   (b) suíte completa em TZ=America/Sao_Paulo
#   (c) build de produção
#   (d) portão do golden — os commits NOVOS desta ramificação respeitam a trava?
#   (e) índice de testes (EVIDENCIA-TESTES.md) — está em dia com os testes?
#   (f) bateria de aceite das travas (scripts/portao-teste.sh) — os hooks ainda
#       recusam o que têm de recusar, e ainda deixam passar o trabalho normal?
#   (g) docs/ESTADO.md — o documento gerado ainda descreve o repositório de hoje?
#   (h) índice do BACKLOG.md — as contagens dentro dele batem com os itens?
#   (i) trava de dados no INTERVALO desta ramificação (o mesmo script do CI)
#   (j) gitleaks — segredo em qualquer commit novo desta ramificação
#   (k) ponte com o Financeiro (integração real, se o repo irmão existir)
#
# ── POR QUE (i), (j) E (k) EXISTEM (30/08/2026) ──────────────────────────────
# Até 30/08/2026 este script cobria (a)-(h) e o `.github/workflows/ci.yml` cobria
# quatro trabalhos — e os conjuntos NÃO eram iguais. Quem rodasse a auditoria
# local e visse verde ainda podia levar vermelho na esteira, porque o gitleaks,
# a trava de dados por intervalo e a ponte só existiam lá.
#
# Isso virou urgente no dia em que os créditos de Actions da conta acabaram: sem
# runner, a esteira não roda, e a única prova possível é a local. Prova local que
# cobre MENOS que a remota é prova que engana — foi por isso que estes três
# passos desceram para cá, e não por conveniência.
#
# O QUE CADA UM PRECISA, e o que acontece quando falta:
#   (i) nada além do próprio repositório. Ausência do script é VERMELHO.
#   (j) o binário `gitleaks` no PATH. O CI fixa a versão 8.30.1 e confere o
#       sha256; aqui a versão instalada é IMPRESSA, para uma divergência ficar
#       visível em vez de silenciosa. SEM o binário é VERMELHO — é a mesma regra
#       de "ausência de trava é vermelho" que os passos (d) e (e) já seguem.
#   (k) o repositório irmão Financeiro em disco. Este é o ÚNICO passo que
#       PULA quando o irmão não está por perto, e o pulo é anunciado alto: um
#       workspace do Conductor legítimo pode não tê-lo. O que ele NUNCA faz é
#       sair verde fingindo que rodou.
#
# ── AUSÊNCIA DE TRAVA É VERMELHO (Sessão H4-C, 25/07/2026) ───────────────────
# Até esta data, os passos (d) e (e) imprimiam um aviso e SEGUIAM VERDE quando o
# script da trava não estava no checkout. Medido: bastava tirar o
# scripts/portao-golden.sh do lugar para a auditoria inteira terminar em
# "✓ AUDITORIA PASSOU — todos os passos verdes", com exit 0. Num app cujo
# produto é a trava, trava ausente não é "nada para checar": é exatamente o
# estado que um commit que apaga a trava produz. Os dois pontos viraram falha.
# Pela mesma regra, o passo (e) agora FALHA quando o EVIDENCIA-TESTES.md não
# está rastreado pelo git — antes, um arquivo fora do índice devolvia verde
# eterno, porque `git diff` de arquivo não rastreado não tem o que mostrar.
#
# ── O QUE ESTE SCRIPT ESCREVE (Sessão H4-C, 25/07/2026 — o cabeçalho mentia) ──
# O cabeçalho antigo dizia que o script "só LÊ e RODA". Não era verdade em dois
# lugares. A verdade, agora garantida: ele NÃO altera a árvore de trabalho —
# nenhum arquivo versionado é criado, reescrito ou apagado por ele. Ele escreve
# em exatamente dois lugares, os dois fora do versionamento:
#   · dist/  — a pasta de construção que o passo (c) produz (`vite build`), já
#     no .gitignore. Um passo que promete "o build passa" não tem como provar
#     isso sem construir de verdade; o que ele não pode é mexer no que é
#     versionado. (Os caches do Vite/Vitest dentro de node_modules/ também são
#     reescritos pelos passos (a)-(c), pelo mesmo motivo e igualmente fora do
#     git.)
#   · um diretório temporário próprio (mktemp), apagado ao sair, onde o passo
#     (e) gera o índice PARA COMPARAR. Antes de 25/07/2026 o passo (e) mandava
#     o gerador reescrever o EVIDENCIA-TESTES.md VERSIONADO e só então comparava
#     com o git — ou seja, a auditoria CONSERTAVA o artefato que ela deveria
#     auditar: quando o passo ficava vermelho, o arquivo já estava corrigido na
#     árvore, e o próximo commit varria a correção junto sem ninguém olhar o
#     diff.
# Continua valendo: não cria worktree, não toca em repositório nenhum "de fora",
# não faz mutação (isso é scripts/mutacao.mjs, script irmão), não instala
# dependência e não fala com a rede.
# ─────────────────────────────────────────────────────────────────────────────
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ" || { echo "✗ não encontrei a raiz do repositório a partir de $0"; exit 1; }

PASSO_ATUAL=""

# Diretório temporário do passo (e). Apagado ao sair por qualquer porta —
# inclusive quando `falhar` interrompe a auditoria no meio.
# `rm -rf` de um diretório com links simbólicos apaga OS LINKS, nunca o que eles
# apontam (POSIX: rm não entra em symlink de diretório) — é por isso que o
# espelho pode ser feito de links para a árvore real sem risco nenhum.
TEMPORARIO_DA_AUDITORIA=""
TEMPORARIO_DO_ESTADO=""
TEMPORARIO_DO_BACKLOG=""
limpar_temporario() {
  if [ -n "$TEMPORARIO_DA_AUDITORIA" ] && [ -d "$TEMPORARIO_DA_AUDITORIA" ]; then
    rm -rf "$TEMPORARIO_DA_AUDITORIA"
  fi
  if [ -n "$TEMPORARIO_DO_ESTADO" ] && [ -d "$TEMPORARIO_DO_ESTADO" ]; then
    rm -rf "$TEMPORARIO_DO_ESTADO"
  fi
  if [ -n "$TEMPORARIO_DO_BACKLOG" ] && [ -d "$TEMPORARIO_DO_BACKLOG" ]; then
    rm -rf "$TEMPORARIO_DO_BACKLOG"
  fi
}
trap limpar_temporario EXIT

falhar() {
  echo ""
  echo "───────────────────────────────────────────────────────────────"
  echo "✗ AUDITORIA PAROU — passo $PASSO_ATUAL"
  echo "───────────────────────────────────────────────────────────────"
  echo ""
  echo "$1"
  echo ""
  exit 1
}

ok() {
  echo "✓ passo $PASSO_ATUAL — verde"
  echo ""
}

echo "═══════════════════════════════════════════════════════════════"
echo " AUDITORIA — roteiro do auditor de uma vez"
echo " repositório: $RAIZ"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── (a) suíte completa em TZ=UTC ─────────────────────────────────────────────
PASSO_ATUAL="(a) suíte completa em TZ=UTC"
echo "── $PASSO_ATUAL ──"
TZ=UTC npx vitest run
if [ $? -ne 0 ]; then
  falhar "npx vitest run falhou com TZ=UTC. A regra da casa (CLAUDE.md) exige a
suíte verde nos dois fusos — veja a saída do vitest acima para o teste que
quebrou."
fi
ok

# ── (b) suíte completa em TZ=America/Sao_Paulo ───────────────────────────────
PASSO_ATUAL="(b) suíte completa em TZ=America/Sao_Paulo"
echo "── $PASSO_ATUAL ──"
TZ=America/Sao_Paulo npx vitest run
if [ $? -ne 0 ]; then
  falhar "npx vitest run falhou com TZ=America/Sao_Paulo (mas passou em UTC — ou
não teria chegado aqui). Isso É um achado: comportamento sensível a fuso que só
aparece num dos dois. Veja a saída do vitest acima."
fi
ok

# ── (c) build de produção ─────────────────────────────────────────────────────
PASSO_ATUAL="(c) build de produção (npm run build)"
echo "── $PASSO_ATUAL ──"
npm run build
if [ $? -ne 0 ]; then
  falhar "npm run build falhou. Veja a saída do Vite acima."
fi
ok

# ── (d) portão do golden — os commits novos desta ramificação ────────────────
#
# POR QUE --intervalo E NÃO --commit HEAD (Sessão H4-C, 25/07/2026).
# O modo --commit confere UM commit lendo `git show --name-status <sha>`. Num
# commit de MERGE o git devolve o diff COMBINADO, e num merge limpo (nada
# resolvido à mão) esse diff é VAZIO — o portão lê "não tocou em arquivo
# protegido" e sai verde. MEDIDO em repositório descartável: um ramo alterou
# src/lib/calc.js sem marcação de aprovação, o principal andou noutro arquivo,
# `git merge --no-ff` juntou os dois; `portao-golden.sh --commit HEAD` saiu 0
# ("nada a barrar") nas DUAS versões do portão — a que está neste checkout e a
# que a sessão H4-A está escrevendo. O mesmo repositório, com
# `--intervalo <base> HEAD`, barra o commit escondido: o rev-list percorre os
# DOIS pais do merge e confere commit a commit.
#
# A BASE. É a mesma regra que o portão usa quando calcula a base sozinho
# (decisão do Marco, item 15 do ciclo H4): o ancestral comum entre HEAD e o ramo
# principal — `origin/main`, e `main` se não houver remoto. Isso confere
# exatamente os commits NOVOS desta ramificação: nem de menos (nenhum commit
# novo escapa, tenha merge ou etiqueta em cima) nem de mais (não rejulga o que
# já entrou no principal, que passou por este mesmo portão no push).
#
# A base é calculada AQUI, e não deixada em branco para o portão descobrir, DE
# PROPÓSITO: assim o passo funciona igual com a versão do portão que está neste
# checkout e com a que está chegando — as duas aceitam base explícita e válida,
# e só a nova sabe descobrir sozinha. Quando a nova estiver em toda parte, este
# cálculo pode ser trocado por uma base vazia sem mudar o resultado.
#
# Sem ramo principal no clone, o passo FALHA dizendo o comando que traz o ramo.
# AUDITORIA_BASE_PORTAO=<sha> força uma base à mão (clone raso, histórico sem
# parentesco): é a saída que funciona em qualquer caso, e não afrouxa nada — o
# portão confere o intervalo inteiro que for indicado.
PASSO_ATUAL="(d) portão do golden — commits novos desta ramificação"
echo "── $PASSO_ATUAL ──"
if [ ! -f scripts/portao-golden.sh ]; then
  falhar "scripts/portao-golden.sh NÃO EXISTE neste checkout — a auditoria não
tem como conferir se algum commit mexeu em fórmula, no golden ou na própria
trava sem a aprovação datada do Marco.

Até 25/07/2026 este passo imprimia um aviso e seguia VERDE. Isso é o contrário
do que a auditoria serve: um checkout sem o portão é exatamente o estado que um
commit que APAGA o portão produz, e a auditoria dizia 'todos os passos verdes'.

O que fazer agora:
  · se o arquivo sumiu por engano, traga-o de volta e rode outra vez:
        git restore scripts/portao-golden.sh
  · se ele foi apagado de propósito, isso é mudança na trava dos princípios 1 e
    8 do CLAUDE.md — decisão do Marco, não de uma sessão de IA. Pare e leve a
    ele."
fi

BASE_PORTAO="${AUDITORIA_BASE_PORTAO:-}"
ORIGEM_DA_BASE=""
RAMO_DA_BASE=""
if [ -n "$BASE_PORTAO" ]; then
  if ! git cat-file -e "$BASE_PORTAO^{commit}" 2>/dev/null; then
    falhar "AUDITORIA_BASE_PORTAO='$BASE_PORTAO' não é um commit deste clone —
nada foi conferido.

O que fazer agora: confira o identificador (git log --oneline mostra os que
existem aqui) ou apague a variável para a auditoria descobrir a base sozinha,
no ancestral comum com o ramo principal."
  fi
  ORIGEM_DA_BASE="informada na mão (AUDITORIA_BASE_PORTAO)"
else
  for ramo in origin/main main; do
    git rev-parse --verify --quiet "$ramo^{commit}" >/dev/null 2>&1 || continue
    candidata=$(git merge-base "$ramo" HEAD 2>/dev/null || true)
    if [ -n "$candidata" ]; then
      BASE_PORTAO="$candidata"
      RAMO_DA_BASE="$ramo"
      ORIGEM_DA_BASE="ancestral comum entre HEAD e '$ramo'"
      break
    fi
  done
  if [ -z "$BASE_PORTAO" ]; then
    falhar "não consegui descobrir a base para conferir o portão: este clone não
tem 'origin/main' nem 'main', ou o HEAD não tem ancestral comum com eles.
NADA foi conferido — e isto não é 'está limpo', é 'não olhei'.

O que fazer agora:
  · traga o ramo principal e rode outra vez:
        git fetch origin main:refs/remotes/origin/main
  · se o clone for raso, complete o histórico antes (git fetch --unshallow); na
    esteira, use actions/checkout com fetch-depth: 0
  · ou diga a base na mão, e o portão confere o intervalo inteiro:
        AUDITORIA_BASE_PORTAO=<commit-base> bash scripts/auditoria.sh"
  fi
fi

QUANTOS_COMMITS=$(git rev-list --count "$BASE_PORTAO"..HEAD 2>/dev/null || echo "?")
echo "  base: $(git log -1 --format='%h %s' "$BASE_PORTAO")"
echo "  de onde veio a base: $ORIGEM_DA_BASE"
echo "  commits a conferir (base..HEAD): $QUANTOS_COMMITS"

# INTERVALO VAZIO — os dois significados. "Nenhum commit novo" só é uma boa
# notícia quando os commits que estão aqui já passaram pelo portão em algum
# lugar. Eles passaram quando a âncora é o ramo REMOTO: tudo o que está dentro
# de origin/main entrou lá por um push, e o push roda este mesmo portão na
# esteira. Se o clone só tem 'main' local, nada aqui foi publicado nunca — e aí
# "nenhum commit novo" quer dizer que NINGUÉM conferiu isto, nem agora nem
# antes. Um verde nesse caso seria o pior tipo: o que promete conferência e não
# confere nada.
if [ "$QUANTOS_COMMITS" = "0" ] && [ "$RAMO_DA_BASE" = "main" ]; then
  falhar "não há commit novo entre a base e o HEAD, e este clone não tem ramo
remoto ('origin/main' não existe aqui): nada deste histórico passou pelo portão
alguma vez — nem agora, nem num push anterior. NADA foi conferido.

O que fazer agora — confira o histórico inteiro de uma vez, dizendo o primeiro
commit como base:
    AUDITORIA_BASE_PORTAO=\$(git rev-list --max-parents=0 HEAD) bash scripts/auditoria.sh

(Se este clone deveria ter o ramo remoto, traga-o antes:
    git fetch origin main:refs/remotes/origin/main
e rode de novo — aí a auditoria confere só os commits novos da ramificação.)"
fi

if [ "$QUANTOS_COMMITS" = "0" ]; then
  case "$RAMO_DA_BASE" in
    origin/*)
      echo "  (nenhum commit novo nesta ramificação: tudo o que está aqui já entrou"
      echo "   em '$RAMO_DA_BASE' por um push, e o push roda este mesmo portão na esteira)"
      ;;
    *)
      echo "  (nenhum commit novo no intervalo pedido — a base informada é o próprio"
      echo "   topo; se quis conferir mais que isso, indique uma base mais atrás)"
      ;;
  esac
fi

bash scripts/portao-golden.sh --intervalo "$BASE_PORTAO" HEAD
if [ $? -ne 0 ]; then
  falhar "o portão do golden recusou algum commit novo desta ramificação — veja
a saída acima, que nomeia o commit e o arquivo. Normalmente significa que um
commit já feito tocou calc.js/golden.test.js (ou outro arquivo da lista
PADRAO_PORTAO) sem a linha 'APROVADO-PELO-MARCO: dd/mm/aaaa motivo' na
mensagem. Isso é PORTÃO DO MARCO (princípios 1 e 8 do CLAUDE.md) — não se
corrige reescrevendo a mensagem sem aval; leve ao Marco.

A recusa também pode ser 'NÃO CONSEGUI CONFERIR': aí o portão não olhou nada, e
o texto dele diz o comando que resolve."
fi
ok

# ── (e) índice de testes em dia ───────────────────────────────────────────────
#
# COMO ESTE PASSO CONFERE, sem tocar na árvore (Sessão H4-C, 25/07/2026).
# Monta um ESPELHO do repositório num diretório temporário: cada entrada da raiz
# vira um link simbólico para a de verdade, e o gerador roda lá dentro. Assim o
# índice novo nasce no temporário, o EVIDENCIA-TESTES.md versionado fica
# exatamente como estava, e a comparação é entre dois arquivos — o versionado e
# o que os testes de HOJE geram.
#
# O gerador é CÓPIA, nunca link. MEDIDO em 25/07/2026: o Node resolve o caminho
# real do módulo de entrada, então um gerar-indice-testes.mjs LINKADO enxerga
# `import.meta.url` na pasta real, calcula a raiz real e escreve o
# EVIDENCIA-TESTES.md REAL — o mesmo estrago que este passo veio impedir, só que
# escondido dentro do temporário. A cópia tem caminho real próprio e escreve no
# espelho.
#
# Pelo mesmo motivo, o EVIDENCIA-TESTES.md NÃO entra no espelho: um link com
# esse nome faria o writeFileSync do gerador escrever ATRAVÉS dele, no arquivo
# versionado.
#
# LIMITE CONHECIDO E DECLARADO: o espelho protege a SAÍDA do gerador, não a
# árvore inteira. As demais entradas são links, então um gerador que um dia
# passasse a escrever em outro caminho (src/, por exemplo) escreveria através do
# link, na árvore de verdade. A garantia aí é a do próprio
# scripts/gerar-indice-testes.mjs, que declara no cabeçalho que só lê e relata,
# e é o arquivo que este passo copia — se essa promessa mudar, este comentário
# muda junto.
PASSO_ATUAL="(e) índice de testes (EVIDENCIA-TESTES.md) em dia"
echo "── $PASSO_ATUAL ──"

if [ ! -f scripts/gerar-indice-testes.mjs ]; then
  falhar "scripts/gerar-indice-testes.mjs NÃO EXISTE neste checkout — sem ele a
auditoria não tem como saber se o índice de testes versionado ainda descreve os
testes que existem de verdade.

Até 25/07/2026 este passo imprimia um aviso e seguia VERDE, o que fazia da
ausência do gerador a maneira mais silenciosa de desligar a checagem.

O que fazer agora:
  · se o arquivo sumiu por engano, traga-o de volta e rode outra vez:
        git restore scripts/gerar-indice-testes.mjs
  · se ele foi removido de propósito, o passo (e) desta auditoria e o passo
    'Índice de testes' do .github/workflows/ci.yml perdem o sentido juntos —
    isso é decisão do Marco, não de uma sessão."
fi

if ! git ls-files --error-unmatch -- EVIDENCIA-TESTES.md >/dev/null 2>&1; then
  falhar "EVIDENCIA-TESTES.md NÃO ESTÁ RASTREADO pelo git neste checkout.

Este passo compara o índice que os testes de hoje geram com o índice
VERSIONADO. Sem arquivo versionado não há com o que comparar — e até 25/07/2026
essa situação devolvia verde PARA SEMPRE, porque o 'git diff' de um arquivo
fora do índice do git não tem o que mostrar. Ou seja: um
'git rm --cached EVIDENCIA-TESTES.md' desligava a checagem em silêncio, e a
auditoria continuava anunciando todos os passos verdes.

O que fazer agora:
  · se o arquivo está na pasta mas saiu do índice, ponha-o de volta:
        git add EVIDENCIA-TESTES.md
  · se ele não existe mais, gere e versione:
        node scripts/gerar-indice-testes.mjs
        git add EVIDENCIA-TESTES.md"
fi

if [ ! -f EVIDENCIA-TESTES.md ]; then
  falhar "EVIDENCIA-TESTES.md está rastreado pelo git, mas NÃO EXISTE na pasta —
foi apagado da árvore de trabalho. Não há índice versionado para comparar com os
testes de hoje.

O que fazer agora:
  · traga o arquivo de volta e rode outra vez:
        git restore EVIDENCIA-TESTES.md
  · se a remoção foi de propósito, ela precisa ser commitada como remoção — e aí
    o passo cai na falha de 'arquivo não rastreado', que diz o que fazer."
fi

ESPELHO=$(mktemp -d "${TMPDIR:-/tmp}/auditoria-indice.XXXXXX") || \
  falhar "não consegui criar o diretório temporário para gerar o índice
(mktemp falhou). Sem ele, a única forma de gerar seria reescrevendo o
EVIDENCIA-TESTES.md versionado — e a auditoria não conserta o que audita.

O que fazer agora: confira espaço em disco e permissão de escrita em
'${TMPDIR:-/tmp}', ou aponte TMPDIR para uma pasta onde você possa escrever."
TEMPORARIO_DA_AUDITORIA="$ESPELHO"

mkdir -p "$ESPELHO/scripts" || falhar "não consegui montar o espelho em $ESPELHO."

# A raiz inteira vira link — MENOS o que não pode entrar:
#   .git                 não é insumo do gerador e confundiria comando git algum
#                        que rodasse lá dentro
#   node_modules         não é insumo e é caríssimo de percorrer
#   dist                 artefato de construção
#   scripts              montado à parte logo abaixo (o gerador tem de ser cópia)
#   EVIDENCIA-TESTES.md  é a SAÍDA do gerador; link aqui escreveria através dele
for entrada in "$RAIZ"/* "$RAIZ"/.[!.]* "$RAIZ"/..?*; do
  [ -e "$entrada" ] || continue
  nome=$(basename "$entrada")
  case "$nome" in
    .git|node_modules|dist|scripts|EVIDENCIA-TESTES.md) continue ;;
  esac
  ln -s "$entrada" "$ESPELHO/$nome" || falhar "não consegui espelhar '$nome' em $ESPELHO."
done

for entrada in "$RAIZ"/scripts/*; do
  [ -e "$entrada" ] || continue
  nome=$(basename "$entrada")
  if [ "$nome" = "gerar-indice-testes.mjs" ]; then continue; fi
  ln -s "$entrada" "$ESPELHO/scripts/$nome" || falhar "não consegui espelhar 'scripts/$nome'."
done

cp "$RAIZ/scripts/gerar-indice-testes.mjs" "$ESPELHO/scripts/gerar-indice-testes.mjs" || \
  falhar "não consegui copiar o gerador para o espelho em $ESPELHO."

node "$ESPELHO/scripts/gerar-indice-testes.mjs"
if [ $? -ne 0 ]; then
  falhar "node scripts/gerar-indice-testes.mjs falhou ao rodar (num espelho
temporário do repositório, em $ESPELHO). Veja a saída acima.

Enquanto o gerador não roda, ninguém sabe se o índice versionado está em dia —
por isso isto é vermelho, e não um aviso."
fi
echo "  (o índice acima foi gerado num espelho temporário do repositório; o"
echo "   EVIDENCIA-TESTES.md versionado NÃO foi tocado)"

if [ ! -f "$ESPELHO/EVIDENCIA-TESTES.md" ]; then
  falhar "o gerador rodou e saiu sem erro, mas não deixou nenhum
EVIDENCIA-TESTES.md no espelho ($ESPELHO) — não há índice novo para comparar
com o versionado, e a auditoria não tem como afirmar que ele está em dia.

O que fazer agora: confira para onde scripts/gerar-indice-testes.mjs escreve
hoje. Se ele passou a escrever em outro caminho, este passo precisa ser
ajustado junto — um passo que não compara nada não pode sair verde."
fi

if ! cmp -s "$ESPELHO/EVIDENCIA-TESTES.md" EVIDENCIA-TESTES.md; then
  echo ""
  LINHAS_DO_DIFF=$(diff -u \
    -L "EVIDENCIA-TESTES.md (versionado)" \
    -L "EVIDENCIA-TESTES.md (o que os testes de hoje geram)" \
    EVIDENCIA-TESTES.md "$ESPELHO/EVIDENCIA-TESTES.md" | wc -l | tr -d ' ')
  diff -u \
    -L "EVIDENCIA-TESTES.md (versionado)" \
    -L "EVIDENCIA-TESTES.md (o que os testes de hoje geram)" \
    EVIDENCIA-TESTES.md "$ESPELHO/EVIDENCIA-TESTES.md" | head -n 60
  if [ "$LINHAS_DO_DIFF" -gt 60 ] 2>/dev/null; then
    echo "  (…diff cortado: $LINHAS_DO_DIFF linhas no total. Para ver inteiro, rode"
    echo "   'node scripts/gerar-indice-testes.mjs' e olhe o 'git diff'.)"
  fi
  falhar "EVIDENCIA-TESTES.md está DESATUALIZADO — o diff acima é a diferença
entre o índice versionado e o que o texto-fonte dos testes gera agora (algum
teste mudou de nome, foi adicionado ou removido desde a última geração).

A auditoria NÃO regenerou o arquivo por você — de propósito, desde 25/07/2026:
quem conserta o artefato não pode ser quem o audita, senão a correção entra no
commit seguinte sem ninguém olhar o diff.

O que fazer agora:
    node scripts/gerar-indice-testes.mjs
    git diff EVIDENCIA-TESTES.md        # confira se a mudança faz sentido
e commite EVIDENCIA-TESTES.md junto da mudança que alterou os testes."
fi

if ! git diff --quiet -- EVIDENCIA-TESTES.md || ! git diff --cached --quiet -- EVIDENCIA-TESTES.md; then
  echo "  nota: o índice bate com os testes desta árvore, mas o"
  echo "  EVIDENCIA-TESTES.md ainda não está commitado como está aqui — commite-o"
  echo "  junto da mudança que alterou os testes, senão o índice que fica no"
  echo "  repositório continua velho."
fi
ok

# ─────────────────────────────────────────────────────────────────────────────
# (f) BATERIA DE ACEITE DAS TRAVAS (Sessão de 26/07/2026).
#
# O scripts/portao-teste.sh existe desde 24/07/2026, tem 102 cenários e prova,
# rodando, que os hooks recusam o que têm de recusar E deixam passar o que têm
# de deixar. Até hoje NINGUÉM o executava: um `grep -rn "portao-teste"` no
# ci.yml, neste arquivo e no package.json devolvia só um comentário. Rede
# desligada da tomada — e este app é um app cujo produto é a trava.
#
# Ele leva ~45s e é seguro por construção: cada cenário cria um repositório
# DESCARTÁVEL em mktemp -d, com conteúdo sintético, e apaga tudo no fim. Não
# toca a árvore de trabalho (o que este script promete não fazer no cabeçalho).
#
# Ausência é VERMELHO, pela mesma regra dos passos (d) e (e): um commit que
# apaga a bateria é exatamente o estado que este passo tem de acusar.
# ─────────────────────────────────────────────────────────────────────────────
PASSO_ATUAL="(f) bateria de aceite das travas (scripts/portao-teste.sh)"
echo "── $PASSO_ATUAL ──"

if [ ! -f scripts/portao-teste.sh ]; then
  falhar "scripts/portao-teste.sh não está neste checkout.

Essa é a bateria que prova, rodando, que os hooks de .githooks/ recusam
planilha, backup e dado de festa — e que NÃO barram trabalho legítimo.

Isto é vermelho, e não um aviso, pelo mesmo motivo dos passos (d) e (e): num
app cujo produto é a trava, trava ausente não é 'nada para checar' — é o
estado que um commit que apaga a trava produz.

O que fazer agora: recupere o arquivo (git checkout main -- scripts/portao-teste.sh)
ou, se ele foi removido de propósito, este passo tem de ser removido no MESMO
commit, com o motivo escrito."
fi

sh scripts/portao-teste.sh
if [ $? -ne 0 ]; then
  falhar "a bateria de aceite das travas FALHOU — a saída acima diz qual cenário
não bateu com o esperado.

Cada cenário é um commit de verdade num repositório descartável. Um cenário
vermelho significa uma de duas coisas, e as duas são graves:

  · a trava deixou de recusar algo que ela recusava (um arquivo de dado real
    passa a entrar no histórico do git calado); ou
  · a trava passou a recusar trabalho legítimo — o que é pior a médio prazo,
    porque é isso que ensina a dar --no-verify por hábito.

Não commite mudança em .githooks/, scripts/trava-dados.sh ou
scripts/padroes-dados.txt enquanto este passo estiver vermelho."
fi
ok

# ─────────────────────────────────────────────────────────────────────────────
# (g) docs/ESTADO.md EM DIA (Sessão de 26/07/2026).
#
# Por que este passo nasceu, medido: o docs/ESTADO.md ficou CONGELADO de 25/07 a
# 26/07/2026 e ninguém soube. Quando o portão do golden foi ampliado, o
# scripts/gerar-estado.mjs deixou de conseguir ler o PADRAO_PORTAO e passou a
# PARAR COM ERRO em vez de escrever — comportamento correto e declarado no
# cabeçalho dele ("um documento gerado que mente é pior que um desatualizado").
# Só que ninguém rodava o gerador. O documento velho continuou no repositório
# afirmando "7 arquivos protegidos" quando eram 19, e esse 7 errado atravessou
# uma sessão inteira sendo citado como fato.
#
# A lição que este passo trava: um gerador que PARA não protege ninguém se nada
# o executa. Por isso as duas coisas são vermelhas aqui — o gerador falhar, e o
# documento versionado divergir do que o gerador produz agora.
#
# Como no passo (e), a comparação é feita num ESPELHO temporário: o
# docs/ESTADO.md versionado NÃO é tocado. Quem conserta o artefato não pode ser
# quem o audita, senão a correção entra no commit seguinte sem ninguém olhar.
# ─────────────────────────────────────────────────────────────────────────────
PASSO_ATUAL="(g) docs/ESTADO.md em dia"
echo "── $PASSO_ATUAL ──"

if [ ! -f scripts/gerar-estado.mjs ]; then
  falhar "scripts/gerar-estado.mjs NÃO EXISTE neste checkout — sem ele a auditoria
não tem como saber se o docs/ESTADO.md ainda descreve o repositório de verdade.

Pela mesma regra dos passos (d), (e) e (f): ausência de trava é vermelho, não
'nada para checar'."
fi

if ! git ls-files --error-unmatch -- docs/ESTADO.md >/dev/null 2>&1; then
  falhar "docs/ESTADO.md NÃO ESTÁ RASTREADO pelo git neste checkout.

Este passo compara o documento VERSIONADO com o que o gerador produz agora. Sem
arquivo versionado não há com o que comparar, e o passo devolveria verde para
sempre — que é como o congelamento de 25/07 passou despercebido.

O que fazer agora:
    node scripts/gerar-estado.mjs
    git add docs/ESTADO.md"
fi

ESPELHO_ESTADO=$(mktemp -d "${TMPDIR:-/tmp}/auditoria-estado.XXXXXX") || \
  falhar "não consegui criar o diretório temporário para gerar o ESTADO.md
(mktemp falhou). Sem ele, a única forma de gerar seria reescrevendo o
docs/ESTADO.md versionado — e a auditoria não conserta o que audita."
TEMPORARIO_DO_ESTADO="$ESPELHO_ESTADO"

mkdir -p "$ESPELHO_ESTADO/scripts" "$ESPELHO_ESTADO/docs" || \
  falhar "não consegui montar o espelho em $ESPELHO_ESTADO."

# Mesma técnica do passo (e): a raiz vira link, menos o que não pode entrar.
# 'docs' e 'scripts' são montados à parte — docs porque a SAÍDA do gerador mora
# lá (um link escreveria através dele, no arquivo versionado), scripts porque o
# gerador tem de ser cópia e não link, pelo mesmo motivo.
for entrada in "$RAIZ"/* "$RAIZ"/.[!.]* "$RAIZ"/..?*; do
  [ -e "$entrada" ] || continue
  nome=$(basename "$entrada")
  case "$nome" in
    .git|node_modules|dist|scripts|docs) continue ;;
  esac
  ln -s "$entrada" "$ESPELHO_ESTADO/$nome" || \
    falhar "não consegui espelhar '$nome' em $ESPELHO_ESTADO."
done

for entrada in "$RAIZ"/scripts/*; do
  [ -e "$entrada" ] || continue
  nome=$(basename "$entrada")
  if [ "$nome" = "gerar-estado.mjs" ]; then continue; fi
  ln -s "$entrada" "$ESPELHO_ESTADO/scripts/$nome" || \
    falhar "não consegui espelhar 'scripts/$nome'."
done
cp "$RAIZ/scripts/gerar-estado.mjs" "$ESPELHO_ESTADO/scripts/gerar-estado.mjs" || \
  falhar "não consegui copiar o gerador para o espelho em $ESPELHO_ESTADO."

for entrada in "$RAIZ"/docs/*; do
  [ -e "$entrada" ] || continue
  nome=$(basename "$entrada")
  if [ "$nome" = "ESTADO.md" ]; then continue; fi
  ln -s "$entrada" "$ESPELHO_ESTADO/docs/$nome" || \
    falhar "não consegui espelhar 'docs/$nome'."
done

node "$ESPELHO_ESTADO/scripts/gerar-estado.mjs"
if [ $? -ne 0 ]; then
  falhar "node scripts/gerar-estado.mjs falhou ao rodar (num espelho temporário do
repositório, em $ESPELHO_ESTADO). A saída acima diz qual número ele não conseguiu
ler e onde esse número mora.

Este é EXATAMENTE o estado em que o repositório ficou de 25/07 a 26/07/2026: o
gerador parava (certo dele), ninguém o rodava, e o docs/ESTADO.md versionado
seguia afirmando números que tinham deixado de ser verdade. Por isso é vermelho,
e não aviso.

O que fazer agora: ensine o gerador a ler a fonte que mudou — nunca escreva o
número à mão dentro dele, porque a cópia é o problema que este documento existe
para matar."
fi
echo "  (o ESTADO.md acima foi gerado num espelho temporário do repositório; o"
echo "   docs/ESTADO.md versionado NÃO foi tocado)"

if [ ! -f "$ESPELHO_ESTADO/docs/ESTADO.md" ]; then
  falhar "o gerador rodou e saiu sem erro, mas não deixou nenhum docs/ESTADO.md no
espelho ($ESPELHO_ESTADO) — não há documento novo para comparar com o versionado.

O que fazer agora: confira para onde scripts/gerar-estado.mjs escreve hoje. Um
passo que não compara nada não pode sair verde."
fi

if ! cmp -s "$ESPELHO_ESTADO/docs/ESTADO.md" docs/ESTADO.md; then
  echo ""
  LINHAS_DO_DIFF=$(diff -u \
    -L "docs/ESTADO.md (versionado)" \
    -L "docs/ESTADO.md (o que o repositório de hoje gera)" \
    docs/ESTADO.md "$ESPELHO_ESTADO/docs/ESTADO.md" | wc -l | tr -d ' ')
  diff -u \
    -L "docs/ESTADO.md (versionado)" \
    -L "docs/ESTADO.md (o que o repositório de hoje gera)" \
    docs/ESTADO.md "$ESPELHO_ESTADO/docs/ESTADO.md" | head -n 60
  if [ "$LINHAS_DO_DIFF" -gt 60 ] 2>/dev/null; then
    echo "  (…diff cortado: $LINHAS_DO_DIFF linhas no total. Para ver inteiro, rode"
    echo "   'node scripts/gerar-estado.mjs' e olhe o 'git diff'.)"
  fi
  falhar "docs/ESTADO.md está DESATUALIZADO — o diff acima é a diferença entre o
documento versionado e o que o repositório de hoje gera.

Cada linha desse diff é uma frase que o documento afirma e que deixou de ser
verdade. Foi assim que o '7 arquivos protegidos' (eram 19) sobreviveu um dia
inteiro sendo citado como fato.

A auditoria NÃO regenerou o arquivo por você — de propósito, pela mesma regra do
passo (e): quem conserta o artefato não pode ser quem o audita.

O que fazer agora:
    node scripts/gerar-estado.mjs
    git diff docs/ESTADO.md        # confira se a mudança faz sentido
e commite docs/ESTADO.md junto da mudança que alterou o repositório."
fi
ok

# ── (h) índice do BACKLOG em dia ─────────────────────────────────────────────
#
# POR QUE ESTE PASSO NASCEU (27/07/2026). O repositório tem TRÊS arquivos cujo
# conteúdo é gerado por script e citado como verdade: o EVIDENCIA-TESTES.md
# (passo e), o docs/ESTADO.md (passo g) e o índice dentro do próprio BACKLOG.md.
# Os dois primeiros tinham guarda; o terceiro não tinha nenhuma.
#
# E a falta foi MEDIDA, não imaginada: na mesma manhã em que esta auditoria
# ganhou os passos (f) e (g), quem escreve isto acrescentou um item ao BACKLOG e
# não rodou o gerador. O índice seguiu afirmando "149 itens" com 150 no arquivo,
# a auditoria inteira saiu verde, e o erro só apareceu porque alguém foi contar
# à mão por outro motivo. Ou seja: o único dos três geradores sem passo era
# exatamente o que envelheceu — e envelheceu em silêncio, dentro do arquivo que
# a casa usa para não esquecer trabalho adiado.
#
# A FORMA é a dos passos (e) e (g), e pelo mesmo motivo: gerar num espelho
# temporário e COMPARAR. O gerador reescreve o BACKLOG.md no lugar; se a
# auditoria o rodasse na árvore de verdade, ela consertaria o artefato que
# deveria auditar, e o próximo commit varreria a correção junto sem ninguém
# olhar o diff. O espelho aqui é minúsculo porque o gerador só precisa de duas
# coisas: ele mesmo e o BACKLOG.md — os dois entram como CÓPIA, nunca como
# link, senão a escrita atravessaria o link e chegaria no arquivo versionado.
PASSO_ATUAL="(h) índice do BACKLOG.md em dia"
echo "── $PASSO_ATUAL ──"

if [ ! -f scripts/gerar-indice-backlog.mjs ]; then
  falhar "scripts/gerar-indice-backlog.mjs NÃO EXISTE neste checkout — sem ele a
auditoria não tem como saber se o índice dentro do BACKLOG.md ainda bate com os
itens que o arquivo tem.

Pela mesma regra dos passos (d), (e), (f) e (g): ausência de trava é vermelho,
não 'nada para checar'."
fi

if ! git ls-files --error-unmatch -- BACKLOG.md >/dev/null 2>&1; then
  falhar "BACKLOG.md NÃO ESTÁ RASTREADO pelo git neste checkout.

Este passo compara o arquivo VERSIONADO com o que o gerador produz agora. Sem
arquivo versionado não há com o que comparar, e o passo devolveria verde para
sempre."
fi

ESPELHO_BACKLOG=$(mktemp -d "${TMPDIR:-/tmp}/auditoria-backlog.XXXXXX") || \
  falhar "não consegui criar o diretório temporário para gerar o índice do BACKLOG
(mktemp falhou). Sem ele, a única forma de gerar seria reescrevendo o BACKLOG.md
versionado — e a auditoria não conserta o que audita."
TEMPORARIO_DO_BACKLOG="$ESPELHO_BACKLOG"

mkdir -p "$ESPELHO_BACKLOG/scripts" || \
  falhar "não consegui montar o espelho em $ESPELHO_BACKLOG."
cp "$RAIZ/scripts/gerar-indice-backlog.mjs" "$ESPELHO_BACKLOG/scripts/" || \
  falhar "não consegui copiar o gerador do índice para $ESPELHO_BACKLOG."
cp "$RAIZ/BACKLOG.md" "$ESPELHO_BACKLOG/BACKLOG.md" || \
  falhar "não consegui copiar o BACKLOG.md para $ESPELHO_BACKLOG."

node "$ESPELHO_BACKLOG/scripts/gerar-indice-backlog.mjs"
if [ $? -ne 0 ]; then
  falhar "node scripts/gerar-indice-backlog.mjs falhou ao rodar (num espelho
temporário, em $ESPELHO_BACKLOG). A saída acima diz o motivo — o mais comum é o
BACKLOG.md ter perdido as duas marcas de comentário que delimitam o índice."
fi
echo "  (o índice acima foi gerado numa cópia temporária; o BACKLOG.md versionado"
echo "   NÃO foi tocado)"

if ! cmp -s "$ESPELHO_BACKLOG/BACKLOG.md" BACKLOG.md; then
  echo ""
  diff -u \
    -L "BACKLOG.md (versionado)" \
    -L "BACKLOG.md (o que o gerador produz hoje)" \
    BACKLOG.md "$ESPELHO_BACKLOG/BACKLOG.md" | head -n 40
  falhar "o índice do BACKLOG.md está DESATUALIZADO — o diff acima mostra a
diferença entre o que o arquivo afirma e o que os itens dele dizem de verdade.

Cada linha desse diff é uma contagem que alguém pode citar numa reunião. Foi
assim que o '149 itens' sobreviveu a um arquivo de 150.

A auditoria NÃO regenerou o arquivo por você — de propósito, pela mesma regra
dos passos (e) e (g): quem conserta o artefato não pode ser quem o audita.

O que fazer agora:
    node scripts/gerar-indice-backlog.mjs
    git diff BACKLOG.md            # confira se a mudança faz sentido
e commite o BACKLOG.md junto do item que você acrescentou ou fechou."
fi
ok

# ─────────────────────────────────────────────────────────────────────────────
# NOTA (não é passo, e de propósito não reprova) — o grafo de conhecimento está
# velho? (Marco, 26/07/2026: "eu atualizo quando você mesclar".)
#
# O grafo em graphify-out/ NÃO é parte do app: é uma ferramenta de leitura, fica
# fora do versionamento, e num clone novo ele nem existe. Por isso isto é NOTA e
# não passo — reprovar a auditoria por causa dele seria barrar trabalho legítimo,
# que é o que ensina a desligar a auditoria inteira.
#
# Mas ele envelhece CALADO, e é justamente o risco da forma como o Marco decidiu
# mantê-lo: se ele mesclar sem chamar a sessão, o grafo passa a descrever um app
# que não existe mais — e aí vale menos que não ter, porque parece atual. Medido
# em 26/07/2026: o arquivo de controle dele jurava ter lido 33 arquivos que não
# tinham um nó sequer no grafo, e por isso a atualização respondia "nada mudou"
# com a linha principal 41 commits à frente.
#
# Esta nota faz a defasagem aparecer no momento em que alguém está conferindo o
# repositório, que é quando ela importa.
# ─────────────────────────────────────────────────────────────────────────────
# Ela conta ARQUIVOS que o grafo lê, não commits (corrigido em 27/07/2026). Contar
# commits fazia a nota gritar lobo: naquele dia ela acusou "4 commits à frente" e os
# quatro mexiam só no BACKLOG.md e no binário compilado do app — e o binário o grafo
# nem indexa. Alarme falso em conferência é pior que nota nenhuma, porque manda o
# auditor caçar o que não existe e ensina a ignorar o aviso da próxima vez.
#
# E a lista de "o que o grafo lê" é PERGUNTADA AO GRAFO, nunca escrita aqui à mão:
# lista copiada envelhece calada, defeito que este repositório mediu doze vezes em
# 26-27/07/2026. Se amanhã o grafo passar a indexar .ts, esta nota acompanha sozinha.
if [ -f graphify-out/graph.json ]; then
  COMMIT_GRAFO=$(node -e "
    try {
      const g = require('./graphify-out/graph.json')
      process.stdout.write(g.built_at_commit || '')
    } catch (e) { process.stdout.write('') }
  " 2>/dev/null)
  if [ -n "$COMMIT_GRAFO" ] && git cat-file -e "${COMMIT_GRAFO}^{commit}" 2>/dev/null; then
    ATRAS=$(git rev-list --count "$COMMIT_GRAFO..HEAD" 2>/dev/null || echo "?")
    if [ "$ATRAS" != "0" ] && [ "$ATRAS" != "?" ]; then
      LISTA_MUDOU=$(mktemp)
      git diff --name-only "$COMMIT_GRAFO..HEAD" > "$LISTA_MUDOU" 2>/dev/null || :
      ATRASADOS=$(node -e "
        const fs = require('fs')
        let g
        try { g = require('./graphify-out/graph.json') } catch (e) { process.exit(0) }
        const indexados = new Set(), extensoes = new Set()
        for (const n of g.nodes || []) {
          const f = n.source_file
          if (!f) continue
          indexados.add(f)
          const p = f.lastIndexOf('.')
          if (p > 0) extensoes.add(f.slice(p).toLowerCase())
        }
        const ext = (f) => { const p = f.lastIndexOf('.'); return p > 0 ? f.slice(p).toLowerCase() : '' }
        const mudou = fs.readFileSync(process.argv[1], 'utf8').split('\n').filter(Boolean)
        // Relevante = arquivo que o grafo já conhece, OU arquivo novo de um tipo que
        // ele indexa (senão um módulo recém-criado passaria despercebido).
        process.stdout.write(
          mudou.filter((f) => indexados.has(f) || extensoes.has(ext(f))).join('\n')
        )
      " "$LISTA_MUDOU" 2>/dev/null)
      rm -f "$LISTA_MUDOU"
      QUANTOS=$(printf '%s' "$ATRASADOS" | grep -c . || true)
      if [ "${QUANTOS:-0}" -gt 0 ]; then
        echo "nota: o grafo de conhecimento (graphify-out/) descreve o commit"
        echo "  $(git log -1 --format='%h %s' "$COMMIT_GRAFO" 2>/dev/null | cut -c1-64)"
        echo "  e desde então mudaram $QUANTOS arquivo(s) que ele LÊ — ele está velho:"
        printf '%s\n' "$ATRASADOS" | head -8 | sed 's/^/    /'
        [ "$QUANTOS" -gt 8 ] && echo "    … e mais $((QUANTOS - 8))"
        echo "  Para pôr em dia:  /graphify --update ."
        echo ""
      else
        echo "nota: o grafo de conhecimento está $ATRAS commit(s) atrás na marca, mas"
        echo "  nenhum arquivo que ele lê mudou nesse intervalo — o conteúdo está em dia."
        echo ""
      fi
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# O RECORTE dos passos (i) e (j): os commits que esta ramificação ACRESCENTA.
# É o mesmo recorte que o CI usa (`base..head` do pull request). Calculado por
# `git merge-base` contra o ramo principal, exatamente como o passo (d) faz —
# um recorte maior varreria o histórico inteiro a cada rodada, e um menor
# deixaria commit novo sem varrer.
# ─────────────────────────────────────────────────────────────────────────────
BASE_VARREDURA=""
for ref in origin/main main origin/master master; do
  if git rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
    BASE_VARREDURA="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
    [ -n "$BASE_VARREDURA" ] && break
  fi
done

# ── (i) trava de dados no intervalo ──────────────────────────────────────────
PASSO_ATUAL="(i) trava de dados no intervalo desta ramificação"
echo "── $PASSO_ATUAL ──"
if [ ! -f scripts/trava-dados.sh ]; then
  falhar "scripts/trava-dados.sh NÃO ESTÁ neste checkout.

Ausência de trava é vermelho, pela mesma regra dos passos (d) e (e): é
exatamente o estado que um commit que apaga a trava produz."
fi
if [ -z "$BASE_VARREDURA" ]; then
  falhar "não consegui achar o ramo principal para recortar o intervalo.

Sem base não há recorte, e varrer 'nada' e sair verde seria anunciar uma
varredura que não aconteceu. Traga o ramo principal:
    git fetch origin main"
fi
echo "  recorte: ${BASE_VARREDURA:0:7}..$(git rev-parse --short HEAD) ($(git rev-list --count "$BASE_VARREDURA"..HEAD) commit(s))"
bash scripts/trava-dados.sh --intervalo "$BASE_VARREDURA" "$(git rev-parse HEAD)"
if [ $? -ne 0 ]; then
  falhar "a trava de dados barrou alguma coisa no intervalo — leia a mensagem dela acima.

É o MESMO script que o .githooks/pre-commit e o ci.yml rodam."
fi
ok

# ── (j) gitleaks ─────────────────────────────────────────────────────────────
PASSO_ATUAL="(j) gitleaks — segredo em commit novo desta ramificação"
echo "── $PASSO_ATUAL ──"
if ! command -v gitleaks >/dev/null 2>&1; then
  falhar "o binário 'gitleaks' NÃO está no PATH.

O ci.yml varre segredo em todo commit que o envio traz, com a versão 8.30.1
fixada e conferida por sha256. Sem ele aqui, esta auditoria cobriria MENOS que
a esteira — e prova local que cobre menos que a remota é prova que engana.

Para instalar:  brew install gitleaks"
fi
echo "  versão local: $(gitleaks version 2>/dev/null || echo '?')   (o ci.yml fixa 8.30.1)"
gitleaks detect --source . --log-opts "$BASE_VARREDURA..HEAD" --redact --no-banner
if [ $? -ne 0 ]; then
  falhar "o gitleaks encontrou segredo em algum commit desta ramificação.

Apagar o arquivo no commit seguinte NÃO resolve: o segredo continua no
histórico. O conserto é revogar a credencial onde ela foi criada e gerar outra
— é a regra escrita no fim do ACOES-DO-MARCO.md."
fi
ok

# ── (k) ponte com o Financeiro ────────────────────────────────────────
PASSO_ATUAL="(k) ponte com o Financeiro (integração real)"
echo "── $PASSO_ATUAL ──"
FINANCEIRO_DIR="${PONTE_FINANCEIRO_DIR:-}"
if [ -z "$FINANCEIRO_DIR" ]; then
  for cand in "$RAIZ/../Financeiro" "$HOME/conductor/repos/Financeiro" \
              "$HOME/Desktop/Dev/Financeiro" "$HOME/Desktop/Financeiro"; do
    if [ -d "$cand" ]; then FINANCEIRO_DIR="$(cd "$cand" && pwd)"; break; fi
  done
fi
if [ -z "$FINANCEIRO_DIR" ]; then
  # O ÚNICO passo que pula — e o pulo é anunciado alto, nunca vestido de verde.
  echo "⊘ passo $PASSO_ATUAL — PULADO"
  echo ""
  echo "  Não achei o repositório Financeiro em disco. Este passo prova que"
  echo "  a leitura da ponte NÃO escreve no banco do Financeiro (sha256 antes/depois)"
  echo "  e que as duas pontas concordam sobre a origem autorizada."
  echo ""
  echo "  ISTO NÃO É UM VERDE. A auditoria segue, e o que ela não mediu está dito."
  echo "  Para rodar:  PONTE_FINANCEIRO_DIR=/caminho/Financeiro bash scripts/auditoria.sh"
  echo ""
else
  echo "  Financeiro: $FINANCEIRO_DIR"
  PONTE_FINANCEIRO_DIR="$FINANCEIRO_DIR" PONTE_PREVISAO_DIR="$RAIZ" bash scripts/teste_ponte.sh
  if [ $? -ne 0 ]; then
    falhar "a ponte com o Financeiro falhou — leia as verificações acima.

O servidor de teste sobe numa porta descartável e NUNCA toca o dados.db real,
então uma falha aqui é contrato entre os dois apps, não dado corrompido."
  fi
  ok
fi

echo "═══════════════════════════════════════════════════════════════"
echo "✓ AUDITORIA PASSOU — todos os passos verdes"
echo "═══════════════════════════════════════════════════════════════"
exit 0
