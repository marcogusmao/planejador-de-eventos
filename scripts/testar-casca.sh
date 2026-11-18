#!/usr/bin/env bash
# Prova RODANDO os caminhos de arranque da casca nativa (appwrap.swift), sem abrir
# janela: compila a MESMA fonte com -D TESTE_CASCA, que roda o mesmo
# decidirArranque() do app e imprime o texto exato que iria para a tela.
# (27/07/2026, junto com o conserto dos avisos de arranque.)
#
#   bash scripts/testar-casca.sh [porta]     porta padrão: 4188
#
# A porta é parâmetro POR SEGURANÇA. As portas dos apps do Marco (4173 Planejador,
# 8777 Financeiro) são recusadas: um servidor de teste sobrando na porta do app faz
# o app dele falhar na próxima abertura, e foi isso que custou horas em 27/07/2026.
set -uo pipefail

PORTA="${1:-4188}"
if [ "$PORTA" = "4173" ] || [ "$PORTA" = "8777" ]; then
  echo "RECUSADO: $PORTA é a porta de um app de verdade do Marco."
  echo "Rode numa porta livre, ex.: bash scripts/testar-casca.sh 4188"
  exit 2
fi

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
FONTE="$AQUI/scripts/appwrap.swift"
OBRAS="$(mktemp -d)"
BIN="$OBRAS/testar-casca"
FALHOU=0

# Rede de segurança: qualquer saída deste script (fim, erro ou Ctrl-C) mata tudo
# que ele subiu na porta de teste e confere que a porta ficou livre.
limpar() {
  pkill -f "vite preview --port $PORTA" 2>/dev/null
  pkill -f "http.server $PORTA" 2>/dev/null
  [ -n "${BOBO_PID:-}" ] && kill "$BOBO_PID" 2>/dev/null
  sleep 1
  if lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "ATENÇÃO: sobrou alguém escutando na porta $PORTA:"
    lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN
  else
    echo "porta $PORTA: livre (nenhum servidor pendurado)"
  fi
  chmod -R u+w "$OBRAS" 2>/dev/null
  rm -rf "$OBRAS"
}
trap limpar EXIT INT TERM

exigir() {  # $1 = rótulo   $2 = texto onde procurar   $3.. = pedaços obrigatórios
  local rotulo="$1" texto="$2"; shift 2
  for pedaco in "$@"; do
    if printf '%s' "$texto" | grep -qF -- "$pedaco"; then
      echo "  ok   diz \"$pedaco\""
    else
      echo "  FALHA  NÃO diz \"$pedaco\""; FALHOU=1
    fi
  done
  echo "  ($rotulo)"
}

recusar() {  # $1 = rótulo   $2 = texto   $3.. = pedaços PROIBIDOS
  local rotulo="$1" texto="$2"; shift 2
  for pedaco in "$@"; do
    if printf '%s' "$texto" | grep -qF -- "$pedaco"; then
      echo "  FALHA  NÃO podia dizer \"$pedaco\""; FALHOU=1
    else
      echo "  ok   não diz \"$pedaco\""
    fi
  done
  echo "  ($rotulo)"
}

echo "compilando a fonte da casca com -D TESTE_CASCA…"
swiftc -D TESTE_CASCA "$FONTE" -o "$BIN" || { echo "não compilou"; exit 1; }
echo "compilando também o binário de produção (sem a marca de teste)…"
swiftc "$FONTE" -o "$OBRAS/producao" || { echo "produção não compilou"; exit 1; }
echo

rodar() {  # roda a casca em modo de prova com a raiz e o comando dados
  APP_TITULO="Planejador" APP_PORTA="$PORTA" APP_CMD="/bin/bash" APP_ARGS="$1" \
  APP_PATH="/opt/homebrew/bin:/usr/local/bin" TESTE_RAIZ="$2" "$BIN"
}

CMD_REAL='-c|if [ ! -d node_modules ]; then npm install; fi; if [ ! -f dist/index.html ]; then npm run build; fi; exec npx vite preview --port '"$PORTA"' --strictPort'

# ————— caso 1: porta livre, node_modules e dist no lugar —————
echo "=== CASO 1 · porta $PORTA livre, node_modules e dist no lugar ==="
S1="$(rodar "$CMD_REAL" "$AQUI")"
echo "$S1"
exigir "abriu, e a tela de Abrindo conta a pasta inteira" "$S1" \
  "DESFECHO: carrega" "servindo a pasta" "$AQUI"
exigir "o título da janela nomeia a pasta" "$S1" \
  "TITULO DA JANELA: Planejador — $(basename "$AQUI")"
recusar "abriu sem reclamar de nada" "$S1" "não abriu" "ocupada"
pkill -f "vite preview --port $PORTA" 2>/dev/null; sleep 1
echo

# ————— caso 1b: o NOSSO servidor já está na porta (caça a falso positivo) —————
# Este é o caso do dia a dia do Marco: o app já aberto, ou um servidor que sobrou
# de uma sessão dele. Tem de carregar NA HORA, sem aviso e sem subir outro.
echo "=== CASO 1b · o nosso próprio servidor já está na porta $PORTA ==="
( cd "$AQUI" && exec npx vite preview --port "$PORTA" --strictPort ) >/dev/null 2>&1 &
for _ in $(seq 1 60); do
  nc -z -w 1 ::1 "$PORTA" >/dev/null 2>&1 && break
  nc -z -w 1 127.0.0.1 "$PORTA" >/dev/null 2>&1 && break
  sleep 0.25
done
S1B="$(rodar "$CMD_REAL" "$AQUI")"
echo "$S1B"
exigir "reconhece o servidor da casa e carrega sem avisar nada" "$S1B" "DESFECHO: carrega"
recusar "não acusou o próprio servidor do app" "$S1B" "ocupada por outro programa" "não abriu"
pkill -f "vite preview --port $PORTA" 2>/dev/null; sleep 1
echo

# ————— caso 2: porta ocupada por um estranho (IPv4) —————
echo "=== CASO 2 · porta $PORTA ocupada por um servidor estranho (IPv4) ==="
mkdir -p "$OBRAS/estranho"
printf 'nada a ver com o Planejador\n' > "$OBRAS/estranho/index.html"
( cd "$OBRAS/estranho" && exec python3 -m http.server "$PORTA" --bind 127.0.0.1 ) >/dev/null 2>&1 &
BOBO_PID=$!
for _ in $(seq 1 40); do nc -z -w 1 127.0.0.1 "$PORTA" >/dev/null 2>&1 && break; sleep 0.25; done
S2="$(rodar "$CMD_REAL" "$AQUI")"
echo "$S2"
exigir "acusa a porta pelo número, sem esperar 40s" "$S2" \
  "porta $PORTA está ocupada por outro programa" "Estou servindo a pasta"
recusar "não manda olhar log nenhum neste caso" "$S2" "servidor.log"
kill "$BOBO_PID" 2>/dev/null; unset BOBO_PID; sleep 1
echo

# ————— caso 2b: o mesmo estranho, mas escutando em IPv6 —————
echo "=== CASO 2b · porta $PORTA ocupada por um servidor estranho (IPv6) ==="
( cd "$OBRAS/estranho" && exec python3 -m http.server "$PORTA" --bind ::1 ) >/dev/null 2>&1 &
BOBO_PID=$!
for _ in $(seq 1 40); do nc -z -w 1 ::1 "$PORTA" >/dev/null 2>&1 && break; sleep 0.25; done
S2B="$(rodar "$CMD_REAL" "$AQUI")"
echo "$S2B"
exigir "acha o estranho também em IPv6" "$S2B" "porta $PORTA está ocupada por outro programa"
kill "$BOBO_PID" 2>/dev/null; unset BOBO_PID; sleep 1
echo

# ————— caso 3: pasta sem node_modules —————
echo "=== CASO 3 · pasta sem node_modules ==="
mkdir -p "$OBRAS/sem-modulos"
S3="$(rodar '-c|sleep 120' "$OBRAS/sem-modulos")"
echo "$S3"
exigir "diz a pasta e explica o node_modules" "$S3" \
  "$OBRAS/sem-modulos" "não tem a pasta node_modules"
echo

# ————— caso 4: comando de subida inválido —————
echo "=== CASO 4 · comando de subida inválido ==="
mkdir -p "$OBRAS/comando-torto/node_modules" "$OBRAS/comando-torto/dist"
touch "$OBRAS/comando-torto/dist/index.html"
S4="$(rodar '-c|exec comando-que-nao-existe-mesmo' "$OBRAS/comando-torto")"
echo "$S4"
exigir "o motivo real chega à tela" "$S4" "comando-que-nao-existe-mesmo" "servidor.log"
if [ -s "$OBRAS/comando-torto/servidor.log" ]; then
  echo "  ok   o servidor.log existe e não está vazio:"
  sed 's/^/       | /' "$OBRAS/comando-torto/servidor.log"
else
  echo "  FALHA  servidor.log vazio ou inexistente"; FALHOU=1
fi
echo

# ————— caso 5: o executável nem existe (o run() estoura) —————
echo "=== CASO 5 · executável inexistente (o run() estoura) ==="
mkdir -p "$OBRAS/sem-exe/node_modules" "$OBRAS/sem-exe/dist"
touch "$OBRAS/sem-exe/dist/index.html"
S5="$(APP_TITULO="Planejador" APP_PORTA="$PORTA" APP_CMD="/bin/nao-existe-este-binario" \
      APP_ARGS="-c|true" TESTE_RAIZ="$OBRAS/sem-exe" "$BIN")"
echo "$S5"
exigir "o motivo que ia só para o log do sistema agora está na tela" "$S5" \
  "não consegui executar /bin/nao-existe-este-binario"
if [ -s "$OBRAS/sem-exe/servidor.log" ]; then
  echo "  ok   e o mesmo motivo está no servidor.log:"
  sed 's/^/       | /' "$OBRAS/sem-exe/servidor.log"
else
  echo "  FALHA  servidor.log vazio ou inexistente"; FALHOU=1
fi
echo

# ————— caso 6: não dá para criar o servidor.log (pasta sem permissão) —————
# Aqui o arquivo REALMENTE não existe. A mensagem não pode mandar olhar ele.
echo "=== CASO 6 · a pasta não deixa criar o servidor.log ==="
mkdir -p "$OBRAS/sem-log/node_modules" "$OBRAS/sem-log/dist"
touch "$OBRAS/sem-log/dist/index.html"
chmod 555 "$OBRAS/sem-log"
S6="$(rodar '-c|exit 3' "$OBRAS/sem-log")"
echo "$S6"
exigir "conta que o arquivo não existe, em vez de mandar procurar" "$S6" \
  "Não existe servidor.log nessa pasta"
recusar "não manda olhar o que não existe" "$S6" "Últimas linhas do servidor.log"
if [ -e "$OBRAS/sem-log/servidor.log" ]; then
  echo "  FALHA  o teste não valeu: o servidor.log foi criado mesmo assim"; FALHOU=1
else
  echo "  ok   confirmado: não há servidor.log nessa pasta"
fi
chmod 755 "$OBRAS/sem-log"
echo

echo "=================================================="
if [ "$FALHOU" = "0" ]; then echo "TODOS OS CASOS PASSARAM"; else echo "ALGUM CASO FALHOU"; fi
exit "$FALHOU"
