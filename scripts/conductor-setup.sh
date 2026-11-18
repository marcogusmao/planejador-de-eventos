#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# conductor-setup.sh — o que o Conductor roda em CADA workspace novo.
#
# POR QUE EXISTE (medido em 01/08/2026 no repositório irmão, com isca real):
# workspace do Conductor é `git worktree` de um CLONE, e clone nasce com
# `core.hooksPath` vazio. Sem este script, a parede inteira de .githooks/ fica
# desligada dentro do workspace: pre-commit (dados), commit-msg (portão do
# golden) e pre-push. Uma planilha entrou num commit com exit 0 e sem aviso.
#
# Aqui o `prepare` do package.json (ligar-trava.sh) já faria isso — MAS só
# roda no `npm ci`/`npm install`, e só se ninguém passar --ignore-scripts.
# Este script liga antes, liga sozinho e PROVA com isca. Cinto e suspensório.
# ─────────────────────────────────────────────────────────────────────────────
set -e

erro() { printf '\n✗ %s\n' "$1" >&2; exit 1; }
ok()   { printf '✓ %s\n' "$1"; }

printf '\n── Preparando workspace da Previsão de Eventos ─────────────────────\n'

# ── 1. TRAVA DE DADOS (obrigatória, antes de qualquer outra coisa) ──────────
git config core.hooksPath .githooks
[ "$(git config core.hooksPath)" = ".githooks" ] \
  || erro "core.hooksPath não ficou em .githooks. Workspace SEM trava — não use."
ok "core.hooksPath = .githooks"

# ── 2. PROVA que a trava morde ──────────────────────────────────────────────
printf 'sintetico\n' > .conductor-isca.xlsx
git add -f .conductor-isca.xlsx >/dev/null 2>&1 || true
if sh .githooks/pre-commit >/dev/null 2>&1; then
  git reset -q HEAD .conductor-isca.xlsx >/dev/null 2>&1 || true
  rm -f .conductor-isca.xlsx
  erro "A trava NÃO mordeu a isca (.xlsx passou pelo pre-commit). Não commite nada aqui."
fi
git reset -q HEAD .conductor-isca.xlsx >/dev/null 2>&1 || true
rm -f .conductor-isca.xlsx
ok "trava provada com isca real (planilha recusada pelo pre-commit)"

# ── 3. Dependências ─────────────────────────────────────────────────────────
# `npm ci`, NÃO `npm install`. Motivo desta casa, não preferência de estilo:
# package-lock.json está dentro do PADRAO_PORTAO do scripts/portao-golden.sh.
# `npm install` reescreve o lock quando bem entende — e aí o workspace nasce
# com um arquivo protegido modificado, o portão barra o commit e você perde
# meia hora entendendo por quê. `npm ci` nunca escreve no lock.
[ -f package-lock.json ] || erro "package-lock.json ausente — não dá para instalar de forma reprodutível."

# `--include=dev` NÃO é redundante. Medido em 01/08/2026 nesta máquina:
# NODE_ENV=production está setado no ambiente, e nesse caso o npm assume
# `omit=dev` — instala 103 pacotes em vez de 259 e deixa de fora vite, vitest,
# tailwind e testing-library, que são TODAS devDependencies deste projeto.
# O sintoma é enganoso: o `npm ci` diz "added 103 packages" com exit 0, e só na
# hora de rodar o teste aparece "Cannot find package 'vite'". Um workspace
# assim nasce sem conseguir rodar um teste sequer, sem nada avisar.
npm ci --include=dev --no-audit --no-fund >/tmp/conductor-npm.log 2>&1 \
  || erro "npm ci falhou. Log: /tmp/conductor-npm.log"
[ -d node_modules/vitest ] \
  || erro "vitest não foi instalado — sem ele nada aqui se prova. Confira NODE_ENV e o log em /tmp/conductor-npm.log"
ok "npm ci concluído ($(ls node_modules | wc -l | tr -d ' ') pacotes, vitest presente)"

# ── 4. O lock continua intocado? (prova, não confiança) ────────────────────
if ! git diff --quiet -- package-lock.json 2>/dev/null; then
  erro "package-lock.json foi modificado pela instalação. Arquivo de portão sujo — pare e investigue."
fi
ok "package-lock.json intocado (portão limpo)"

# ── 5. Portão rápido ────────────────────────────────────────────────────────
if npx vitest run --silent >/tmp/conductor-vitest.log 2>&1; then
  ok "suíte de testes: verde"
else
  printf '⚠ a suíte NÃO passou neste checkout (log: /tmp/conductor-vitest.log).\n'
  printf '  Informação, não bloqueio: pode ser justamente o que este ramo vai consertar.\n'
fi

printf '\n── Workspace pronto ────────────────────────────────────────────────\n'
printf 'Porta deste workspace: %s (o Run já usa; a ponte com o Financeiro NÃO\n' "${CONDUCTOR_PORT:-5173}"
printf 'funciona fora da 4173 — ver o prompt do repositório).\n\n'
