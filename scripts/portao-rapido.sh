#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# portao-rapido.sh — o gancho `Stop` do Claude Code. Roda ao FIM DE CADA RODADA,
# então precisa ser instantâneo. Não é a suíte: é a checagem de que as paredes
# continuam de pé.
#
# Sai 0 (deixa a rodada terminar) ou 1 (o Stop bloqueia e o agente lê o motivo).
#
# POR QUE ISTO E NÃO A SUÍTE (ROTINA-CLAUDE.md §6): hook lento em cada rodada
# vira hook desligado. Estas três checagens custam milissegundos e pegam
# exatamente os acidentes que já aconteceram nesta casa.
# ─────────────────────────────────────────────────────────────────────────────
falhas=""

# ── 1. A trava de dados continua ligada? ────────────────────────────────────
# Medido em 01/08/2026: dentro de um workspace do Conductor ela nasce DESLIGADA
# e uma planilha entra em commit com exit 0. Se algo a desligou no meio da
# sessão, a rodada não termina em silêncio.
if [ "$(git config core.hooksPath 2>/dev/null)" != ".githooks" ]; then
  falhas="${falhas}A trava de dados esta DESLIGADA (core.hooksPath != .githooks). Rode: git config core.hooksPath .githooks — e nao commite nada antes disso. "
fi

# ── 2. Tem dado real no stage? ──────────────────────────────────────────────
staged=$(git diff --cached --name-only 2>/dev/null \
         | grep -Ei '\.(db|sqlite|sqlite3|xlsx|xls|csv)$|token|\.secret$' || true)
if [ -n "$staged" ]; then
  falhas="${falhas}Arquivo de DADO ou SEGREDO no stage: $(printf '%s' "$staged" | tr '\n' ' '). Tire do stage antes de encerrar. "
fi

# ── 3. Arquivo de portão modificado? ────────────────────────────────────────
# Não bloqueia por si — regravar golden é decisão do Marco, e pode ser
# legítima. Mas a rodada não termina sem o agente ter dito isso em voz alta.
portao=$(git diff --name-only HEAD 2>/dev/null \
         | grep -E '^(src/lib/(calc|golden\.test|fechamento|planoFinanceiro|dre|comparacaoCustos|receitaLiquida|precoLote|simulador)\.js|package-lock\.json|package\.json|\.githooks/.+)$' || true)
if [ -n "$portao" ]; then
  falhas="${falhas}Arquivo de PORTAO modificado: $(printf '%s' "$portao" | tr '\n' ' '). Antes de encerrar, apresente ao Marco o diff EM PORTUGUES dos valores antigos x novos e obtenha a linha APROVADO-PELO-MARCO. Se ja fez isso, diga em qual mensagem. "
fi

if [ -n "$falhas" ]; then
  printf '{"decision":"block","reason":"PORTAO RAPIDO: %s"}\n' "$falhas"
  exit 0
fi
exit 0
