#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# ligar-trava.sh — aponta core.hooksPath para .githooks, sozinho, na instalação.
#
# Quem me chama: o `prepare` do package.json. O npm executa esse passo depois de
# instalar as dependências, tanto no `npm install` quanto no `npm ci` (medido em
# 25/07/2026, npm 11.11.1: os dois rodam este arquivo; `--ignore-scripts` não —
# ver "O QUE ESTE ARQUIVO NÃO ALCANÇA", no fim).
#
# ── O BURACO QUE ISTO FECHA, MEDIDO EM 25/07/2026 ────────────────────────────
# O git não liga hook nenhum ao clonar, por segurança: num clone recém-feito,
# `git config core.hooksPath` volta VAZIO. Até 25/07/2026 a única maneira de
# ligar a trava era um comando à mão, pedido em três documentos:
#
#     git config core.hooksPath .githooks
#
# Documento não é parede. O roteiro rodado num clone de verdade, sem nenhum
# comando especial — sem `--no-verify`, sem `git add -f` —, deu isto:
#
#     preparados: backup-producao.json "or\303\247amento.xlsx.bak"
#     código de saída do commit: 0
#     ENTROU: backup-producao.json
#     ENTROU: "or\303\247amento.xlsx.bak"
#
# Duas bases inteiras do Marco dentro do git, com exit 0 e sem uma palavra de
# aviso, porque o clone simplesmente não tinha porteiro. O `.gitignore` segura
# uma parte (`.csv`, `.numbers`, banco), mas ele casa EXTENSÃO EXATA enquanto a
# guarda casa a família toda — então as bordas escapam justamente por ali:
# `orçamento.xlsx.bak` é uma planilha inteira, byte por byte, e passa pelo
# `*.xlsx` do .gitignore sem encostar. A rede que sobrevivia ao clone era a mais
# fraca das duas.
#
# ── POR QUE MORA EM .githooks/ E NÃO EM scripts/ ─────────────────────────────
# Porque `\.githooks/.+` já está no PADRAO_PORTAO do scripts/portao-golden.sh:
# o arquivo que decide se o portão roda fica, ele mesmo, atrás do portão. Mexer
# aqui exige a linha de aprovação do Marco, como em qualquer hook. O git só
# executa como hook os arquivos cujo NOME é nome de hook (pre-commit,
# commit-msg, pre-push), então este arquivo é inerte para o git: ninguém o
# dispara sem chamar `sh .githooks/ligar-trava.sh`.
#
# ── A TABELA DE DECISÃO (a parte que não podia ser resolvida com fé) ─────────
# O pedido tinha dois lados que se puxam: NÃO quebrar a instalação onde git não
# existe, e NÃO falhar calado onde deveria funcionar. A saída fácil — `|| true`
# no fim da linha, engolindo todo erro — resolve o primeiro lado e destrói o
# segundo: a instalação fica verde, ninguém lê nada, e o clone segue sem
# porteiro exatamente como antes. Fé, não parede. Por isso cada situação tem
# uma resposta escrita, e nenhuma delas é o silêncio:
#
#   situação                                       | resposta      | por quê
#   -----------------------------------------------|---------------|--------------------------
#   não há git nesta máquina                       | avisa, sai 0  | instalar sem git é legítimo
#                                                  |               | (contêiner de construção,
#                                                  |               | pacote baixado); quebrar
#                                                  |               | aqui trocaria um buraco por
#                                                  |               | outro
#   não estamos dentro de um repositório git       | avisa, sai 0  | idem — é código extraído de
#                                                  |               | um zip, não um clone
#   estamos dentro do repositório DE OUTRA PESSOA  | avisa, sai 0  | mexer na configuração do
#   (a raiz do git não é esta pasta)               |               | repositório alheio é pior do
#                                                  |               | que não ligar a trava
#   .githooks/pre-commit não existe                | ERRO, sai 1   | apontar para pasta sem hook é
#                                                  |               | o pior dos mundos: a
#                                                  |               | configuração fica bonita e
#                                                  |               | nenhum hook roda
#   o `git config` recusou, ou não pegou           | ERRO, sai 1   | este É o ambiente onde
#                                                  |               | deveria funcionar
#   deu certo                                      | diz o que     | nem o sucesso é silencioso —
#                                                  | ligou, sai 0  | quem instalou tem de saber
#                                                  |               | que a trava passou a existir
#
# Sair 1 faz a instalação inteira falhar, de propósito: nos dois casos de erro o
# ambiente é um clone deste repositório com algo quebrado, e uma instalação que
# termina verde prometendo uma trava que não existe é a mentira que este arquivo
# nasceu para acabar. Quem precisar mesmo instalar assim tem a porta declarada:
# `npm ci --ignore-scripts`.
#
# ── O QUE ESTE ARQUIVO NÃO ALCANÇA (leia como limite, não como rodapé) ───────
# 1. QUEM COMMITAR ANTES DE INSTALAR SEGUE SEM HOOK. Entre `git clone` e
#    `npm install` existe uma janela em que o clone continua sem porteiro. Quem
#    clonar e commitar a planilha da festa antes de instalar passa igual ao que
#    foi medido acima. Este arquivo encurta a janela de "para sempre" para
#    "até a primeira instalação"; ele não a fecha.
# 2. `npm ci --ignore-scripts` pula este passo, e é assim que tem de ser — é a
#    porta de quem não quer rodar script de terceiro na instalação.
# 3. Só liga o porteiro LOCAL. Um `--no-verify` continua desligando os hooks.
#
# É por isso que a rede que conta não é esta, e sim a esteira: o
# .github/workflows/ci.yml tem um passo que RECUSA o build quando, depois da
# instalação, core.hooksPath não está apontando para .githooks. Sem aquele
# passo, este arquivo é promessa. E a prova de ponta a ponta — clonar, instalar,
# tentar commitar planilha e backup, ser barrado — é um cenário de
# scripts/portao-teste.sh, que roda tudo isto num clone descartável.
# ─────────────────────────────────────────────────────────────────────────────
set -u

DIR_HOOKS=".githooks"
HOOK_TESTEMUNHA="$DIR_HOOKS/pre-commit"

# ── 1. git existe? ───────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  echo "· trava de dados NÃO ligada: não existe git nesta máquina."
  echo "  A instalação SEGUE — instalar sem git é legítimo (contêiner de"
  echo "  construção, código baixado como pacote). Quando este código estiver"
  echo "  num clone de verdade, rode 'npm install' outra vez, ou à mão:"
  echo "      git config core.hooksPath $DIR_HOOKS"
  exit 0
fi

# ── 2. estamos dentro de uma árvore de trabalho do git? ──────────────────────
if [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]; then
  echo "· trava de dados NÃO ligada: esta pasta não é um repositório git."
  echo "  A instalação SEGUE — é o caso de quem extraiu o código de um zip."
  echo "  Num clone de verdade, 'npm install' liga a trava sozinho."
  exit 0
fi

# ── 3. o repositório que nos cerca é ESTE, ou é o de outra pessoa? ───────────
# Sem esta pergunta, extrair o código dentro de uma pasta que por acaso já é um
# repositório (~/projetos, por exemplo) faria a instalação reconfigurar o
# repositório do vizinho para usar hooks que não são dele. Comparação por
# caminho FÍSICO (pwd -P) porque no macOS /tmp é atalho para /private/tmp e os
# dois nomes apontam para a mesma pasta.
raiz_git=$(git rev-parse --show-toplevel 2>/dev/null) || raiz_git=""
aqui=$(pwd -P)
la=""
[ -n "$raiz_git" ] && la=$(cd "$raiz_git" 2>/dev/null && pwd -P)
if [ -z "$la" ] || [ "$aqui" != "$la" ]; then
  echo "· trava de dados NÃO ligada: esta pasta não é a raiz do repositório git"
  echo "  que a contém."
  echo "      raiz do repositório: ${la:-(não consegui ler)}"
  echo "      esta pasta:          $aqui"
  echo "  A instalação SEGUE, e de propósito: mexer na configuração de um"
  echo "  repositório que não é este seria pior do que deixar a trava desligada."
  exit 0
fi

# ── 4. a pasta de hooks existe DE VERDADE? ───────────────────────────────────
# Apontar core.hooksPath para uma pasta sem hook é a falha em silêncio perfeita:
# a configuração fica com cara de certa e nenhum porteiro roda.
if [ ! -f "$HOOK_TESTEMUNHA" ]; then
  echo "✗ INSTALAÇÃO INTERROMPIDA: não achei $HOOK_TESTEMUNHA" >&2
  echo "  Este é um clone deste repositório, então esse arquivo deveria estar" >&2
  echo "  aqui — ele é versionado. Apontar core.hooksPath para uma pasta sem" >&2
  echo "  hook deixaria a configuração bonita e nenhuma trava rodando, que é" >&2
  echo "  exatamente a falha em silêncio que este passo existe para evitar." >&2
  echo "  Recupere o arquivo (git checkout -- $DIR_HOOKS) e instale de novo." >&2
  echo "  Se for MESMO para instalar sem trava: npm ci --ignore-scripts" >&2
  exit 1
fi

# ── 5. ligar ─────────────────────────────────────────────────────────────────
# Caminho RELATIVO de propósito: o git resolve core.hooksPath a partir da raiz
# da árvore de trabalho, então '.githooks' continua certo depois de mover ou
# renomear a pasta do projeto, e vale igual em cada árvore de trabalho
# (`git worktree`) que compartilhe esta configuração.
if ! git config core.hooksPath "$DIR_HOOKS" 2>/dev/null; then
  echo "✗ INSTALAÇÃO INTERROMPIDA: o 'git config core.hooksPath $DIR_HOOKS'" >&2
  echo "  foi recusado neste repositório." >&2
  echo "  Este É o ambiente onde a trava deveria ligar, então terminar verde" >&2
  echo "  aqui seria prometer um porteiro que não existe. Causa comum:" >&2
  echo "  .git/config sem permissão de escrita." >&2
  echo "  Se for MESMO para instalar sem trava: npm ci --ignore-scripts" >&2
  exit 1
fi

# ── 6. conferir que PEGOU, em vez de confiar no código de saída ──────────────
# O passo 5 devolver 0 diz que o git aceitou o comando; não diz que a leitura
# seguinte vai devolver o valor. Uma variável de ambiente GIT_CONFIG_* ou uma
# configuração de sistema podem vencer o que acabou de ser escrito — e a
# diferença entre "escrevi" e "está valendo" é a diferença entre fé e parede.
valendo=$(git config core.hooksPath 2>/dev/null) || valendo=""
if [ "$valendo" != "$DIR_HOOKS" ]; then
  echo "✗ INSTALAÇÃO INTERROMPIDA: escrevi core.hooksPath = $DIR_HOOKS, mas" >&2
  echo "  quem está valendo é: [${valendo:-vazio}]" >&2
  echo "  Alguma coisa vence a configuração deste repositório — uma variável" >&2
  echo "  GIT_CONFIG_* no ambiente, ou core.hooksPath na configuração global." >&2
  echo "  Confira com: git config --show-origin --get-all core.hooksPath" >&2
  exit 1
fi

echo "· trava de dados ligada: core.hooksPath = $DIR_HOOKS"
echo "  (planilha, backup e CSV de festa passam a ser recusados no commit."
echo "   Limite declarado: commit feito ANTES desta instalação não passou por"
echo "   trava nenhuma — quem confere isso é a esteira, no ci.yml.)"
exit 0
