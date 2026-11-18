#!/usr/bin/env bash
# teste_ponte.sh — prova automática de integração da PONTE entre os dois
# apps da casa (Sessão H3-I, PLANO-HARDENING-3.md do repo previsao-eventos).
#
# ESTE ARQUIVO É ESPELHO. A fonte canônica vive em
# Financeiro/scripts/teste_ponte.sh (aquele repo tem o servidor, o
# dados_teste.db e toda a infra de smoke test que este script reaproveita).
# Esta cópia existe em previsao-eventos/scripts/teste_ponte.sh porque o CI do
# GitHub não faz checkout dos dois repos privados na mesma árvore — o
# workflow de cada repo faz um SEGUNDO checkout do repo irmão (gated por um
# secret; ver comentário no .github/workflows/ci.yml de cada lado) e então
# roda o script local. Enquanto isso não existir, rodar localmente (os dois
# repos lado a lado em ~/Desktop, como o Marco já usa no dia a dia) é o
# caminho real. Mudar este arquivo exige mudar a cópia irmã (canônica) à
# mão — dívida declarada no relatório da sessão H3-I, não escondida.
#
# O QUE ESTE SCRIPT PROVA (contrato da sessão H3-I):
#   a. sobe o Financeiro com dados_teste.db numa porta de teste (nunca
#      8777/4173 — nunca toca o dados.db real, nem por acidente: o servidor
#      roda inteiro dentro de uma pasta descartável, cópia do código + cópia
#      do banco de teste);
#   b. o script Node (teste_ponte_cliente.mjs) chama as 3 rotas com o CÓDIGO
#      REAL do lado cliente da previsão (financeiro.js, curvaVendas.js,
#      backupExterno.js, chavePonte.js, ponteOrigem.js) — não uma
#      reimplementação em curl;
#   c. credencial certa/errada, mutação sem credencial, origem autorizada/
#      não autorizada, e backup grava sem alterar o banco (sha256 do banco
#      de teste antes/depois, contagem de lançamentos antes/depois);
#   d. ORIGEM_PONTE (previsão) == ORIGEM_PREVISAO (Financeiro) — conferido
#      dentro do próprio teste_ponte_cliente.mjs.
#
# Uso local (os dois repos como pastas irmãs, ex.: ambos em ~/Desktop):
#   cd Financeiro && ./scripts/teste_ponte.sh
# Ou de qualquer lugar, apontando os dois caminhos:
#   PONTE_FINANCEIRO_DIR=/caminho/Financeiro \
#   PONTE_PREVISAO_DIR=/caminho/previsao-eventos \
#   ./scripts/teste_ponte.sh
#
# PROVA DE MORDIDA (pedida na sessão H3-I): rodar com
#   PONTE_SABOTAR_TOKEN=1 ./scripts/teste_ponte.sh
# troca o token "correto" que o script usa por um valor errado de propósito
# — a verificação "token certo → sucesso" deve FALHAR (prova que o script
# realmente morde). Sem a variável, roda normal.
set -uo pipefail

aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- localizar os dois repos ------------------------------------------
detectar_financeiro() {
  if [ -n "${PONTE_FINANCEIRO_DIR:-}" ]; then echo "$PONTE_FINANCEIRO_DIR"; return; fi
  if [ -f "$aqui/servidor.py" ]; then echo "$aqui"; return; fi
  for cand in "$aqui/../Financeiro" "$aqui/../../Financeiro"; do
    if [ -f "$cand/servidor.py" ]; then (cd "$cand" && pwd); return; fi
  done
  echo ""
}
detectar_previsao() {
  if [ -n "${PONTE_PREVISAO_DIR:-}" ]; then echo "$PONTE_PREVISAO_DIR"; return; fi
  if [ -f "$aqui/src/lib/financeiro.js" ]; then echo "$aqui"; return; fi
  for cand in "$aqui/../previsao-eventos" "$aqui/../../previsao-eventos"; do
    if [ -f "$cand/src/lib/financeiro.js" ]; then (cd "$cand" && pwd); return; fi
  done
  echo ""
}

FINANCEIRO_DIR="$(detectar_financeiro)"
PREVISAO_DIR="$(detectar_previsao)"

if [ -z "$FINANCEIRO_DIR" ] || [ -z "$PREVISAO_DIR" ]; then
  echo "teste_ponte.sh: não encontrei os dois repos." >&2
  echo "  Financeiro: ${FINANCEIRO_DIR:-(não achado)}" >&2
  echo "  previsao-eventos:  ${PREVISAO_DIR:-(não achado)}" >&2
  echo "  Defina PONTE_FINANCEIRO_DIR e/ou PONTE_PREVISAO_DIR, ou rode com os" >&2
  echo "  dois repos como pastas irmãs." >&2
  exit 1
fi
echo "Financeiro: $FINANCEIRO_DIR"
echo "previsao-eventos:  $PREVISAO_DIR"

if ! command -v python3 >/dev/null 2>&1; then echo "python3 não encontrado" >&2; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "node não encontrado" >&2; exit 1; fi
if ! command -v curl >/dev/null 2>&1; then echo "curl não encontrado" >&2; exit 1; fi
if ! command -v shasum >/dev/null 2>&1; then echo "shasum não encontrado" >&2; exit 1; fi

PORTA_PONTE="${PONTE_PORTA:-58779}"
URL_BASE="http://127.0.0.1:$PORTA_PONTE"
FALHAS=0

# ---- pasta descartável: cópia do código + cópia do banco de TESTE ------
tmp="$(mktemp -d)"
SERVER_PID=""
finalizar() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$tmp"
}
trap finalizar EXIT

for item in servidor.py backend static; do
  cp -R "$FINANCEIRO_DIR/$item" "$tmp/$item"
done
if [ ! -f "$FINANCEIRO_DIR/dados_teste.db" ]; then
  echo "dados_teste.db não existe em $FINANCEIRO_DIR — gere com: python3 gerar_banco_teste.py" >&2
  exit 1
fi
cp "$FINANCEIRO_DIR/dados_teste.db" "$tmp/dados.db"

# checkpoint do WAL antes/depois (função abaixo): o SQLite em modo WAL muda os
# BYTES do arquivo principal com atividade normal de conexão (contador interno
# de mudanças, checkpoint automático em momento não determinístico) mesmo sem
# nenhum dado novo — comparar sha256 cru de um banco WAL "ao vivo" sem antes
# forçar os dois lados para o MESMO estado assentado (WAL vazio, tudo
# mesclado no arquivo principal) dá falso alarme. TRUNCATE mescla o WAL no
# arquivo principal e zera o WAL — os dois lados da comparação ficam no
# mesmo tipo de estado, e SÓ ENTÃO o hash significa "o conteúdo é idêntico".
checkpoint_wal() {
  python3 -c "
import sqlite3
c = sqlite3.connect('$tmp/dados.db')
c.execute('PRAGMA wal_checkpoint(TRUNCATE)')
c.close()
"
}

# ---- subir o servidor (HOME isolado = sem tentativa de achar Google Drive) --
# FINANCEIRO_SEM_DRIVE=1 — a ponte NAO toca o Google Drive do Marco, e desde
# 27/07/2026 o servidor do Financeiro RECUSA subir sem essa declaracao (a trava
# nasceu porque testes copiaram bancos de teste por cima dos backups reais dele,
# duas vezes). Sem esta linha o servidor sai com codigo 2 e a ponte quebra —
# medido: o passo "Rodar teste_ponte.sh" da esteira dos DOIS repositorios ficou
# vermelho assim que a trava entrou.
#
# A declaracao aqui e a VERDADE deste teste, nao um contorno: ele sobe um
# servidor descartavel, com HOME de mentira, em pasta temporaria. Copia off-site
# nao faz parte do que ele prova, e nao pode fazer.
PORTA="$PORTA_PONTE" HOME="$tmp" FINANCEIRO_SEM_DRIVE=1 python3 "$tmp/servidor.py" >"$tmp/servidor.out" 2>&1 &
SERVER_PID=$!

pronto=""
for _ in $(seq 1 50); do
  if curl -fsS "$URL_BASE/api/previsao/eventos" -o /dev/null 2>/dev/null; then pronto=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
  sleep 0.2
done
if [ -z "$pronto" ]; then
  echo "servidor de teste não respondeu a tempo. Saída dele:" >&2
  cat "$tmp/servidor.out" >&2
  exit 1
fi
echo "servidor de teste no ar em $URL_BASE (pid $SERVER_PID)"

if [ ! -f "$tmp/token_ponte.txt" ]; then
  echo "token_ponte.txt não foi gerado pelo boot do servidor de teste" >&2
  exit 1
fi
TOKEN_REAL="$(cat "$tmp/token_ponte.txt")"

TOKEN_PARA_O_TESTE="$TOKEN_REAL"
if [ "${PONTE_SABOTAR_TOKEN:-}" = "1" ]; then
  echo "!! PONTE_SABOTAR_TOKEN=1 — usando de propósito um token ERRADO como 'correto' (prova de mordida)"
  TOKEN_PARA_O_TESTE="sabotado-de-proposito-nao-e-o-token-real"
fi

# /api/lancamentos entrou em ROTAS_LEITURA_SENSIVEL (20/07/2026) e passou a exigir
# o token. Esta instrumentação (contar antes/depois, invariante do banco) SEMPRE
# manda o token REAL — mesmo sob PONTE_SABOTAR_TOKEN=1, onde só o passo do CLIENTE
# deve falhar. Sem o cabeçalho, o 403 virava "erro" e reprovava o teste com a
# ponte funcionando (H3-AUDIT 21/07/2026 — alarme viciado em vermelho).
contar_lancamentos() {
  curl -fsS -H "X-Ponte-Token: $TOKEN_REAL" "$URL_BASE/api/lancamentos?limit=5000" 2>/dev/null \
    | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo "erro"
}
lanc_antes="$(contar_lancamentos)"
checkpoint_wal
sha_antes="$(shasum -a 256 "$tmp/dados.db" | awk '{print $1}')"

# ---- lado cliente: roda o código REAL da previsão contra o servidor ----
echo
echo "=== teste_ponte_cliente.mjs (lado cliente, código real da previsão) ==="
PONTE_PREVISAO_DIR="$PREVISAO_DIR" \
PONTE_FINANCEIRO_DIR="$FINANCEIRO_DIR" \
PONTE_URL_BASE="$URL_BASE" \
PONTE_TOKEN="$TOKEN_PARA_O_TESTE" \
node "$aqui/scripts/teste_ponte_cliente.mjs"
codigo_node=$?
if [ "$codigo_node" -ne 0 ]; then FALHAS=$((FALHAS + 1)); fi

# ---- prova de que o backup NÃO tocou o banco ---------------------------
echo
echo "=== conferindo que o backup não alterou o banco de teste ==="
checkpoint_wal
sha_depois="$(shasum -a 256 "$tmp/dados.db" | awk '{print $1}')"
lanc_depois="$(contar_lancamentos)"

marcar() { echo "  [$([ "$1" = "1" ] && echo ok || echo FALHOU)] $2"; }

if [ "$sha_antes" = "$sha_depois" ]; then marcar 1 "sha256 do dados_teste.db idêntico antes/depois ($sha_antes)"
else marcar 0 "sha256 do dados_teste.db MUDOU (antes=$sha_antes depois=$sha_depois)"; FALHAS=$((FALHAS + 1)); fi

if [ "$lanc_antes" = "$lanc_depois" ] && [ "$lanc_antes" != "erro" ]; then
  marcar 1 "contagem de lançamentos idêntica antes/depois ($lanc_antes)"
else
  marcar 0 "contagem de lançamentos mudou ou não pôde ser lida (antes=$lanc_antes depois=$lanc_depois)"
  FALHAS=$((FALHAS + 1))
fi

if ls "$tmp"/backups/previsao-eventos-*.json >/dev/null 2>&1; then
  marcar 1 "arquivo previsao-eventos-*.json apareceu em backups/"
else
  marcar 0 "nenhum arquivo previsao-eventos-*.json em backups/"
  FALHAS=$((FALHAS + 1))
fi

echo
if [ "$FALHAS" -gt 0 ]; then
  echo "✗ teste_ponte.sh: $FALHAS grupo(s) de verificação falharam."
  exit 1
fi
echo "✓ teste_ponte.sh: ponte entre os dois apps provada de ponta a ponta."
