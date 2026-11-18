#!/usr/bin/env bash
# Compila a casca nativa (scripts/appwrap.swift) para os DOIS apps e reassina
# ad-hoc. Rode depois de mexer em appwrap.swift. (Marco 24/07/2026)
#
# A MESMA fonte serve os dois apps (parametrizada por LSEnvironment no Info.plist
# de cada .app). O appwrap.swift canônico mora AQUI (previsao-eventos/scripts/);
# o Financeiro.app só recebe um binário compilado dele.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"          # raiz do previsao-eventos
FONTE="$AQUI/scripts/appwrap.swift"
PLAN="$AQUI/Planejador.app"
FIN="$AQUI/../Financeiro/Financeiro.app"

compilar() {  # $1 = caminho do .app   $2 = nome do executável
  local app="$1" exe="$2"
  # Caminho ABSOLUTO e sem ".." no meio: quando existe mais de uma cópia do app
  # na máquina, saber em QUAL delas este comando mexeu é metade do problema.
  local pasta; pasta="$(cd "$(dirname "$app")" && pwd)"
  app="$pasta/$(basename "$app")"
  echo "→ compilando $exe em $app"
  swiftc "$FONTE" -o "$app/Contents/MacOS/$exe"
  codesign --force --sign - "$app"                # ad-hoc (como já eram)
  codesign --verify --deep --strict "$app" && echo "  ✔ assinatura ad-hoc OK"
}

compilar "$PLAN" "Planejador"
if [ -d "$FIN" ]; then
  compilar "$FIN" "Financeiro"
else
  echo "(Financeiro.app não encontrado em $FIN — pulei)"
fi

# Aviso de cópia repetida. Todas as cópias declaram o MESMO identificador de
# pacote, então para o macOS elas são o MESMO app: clicar no Dock abre a que ele
# resolveu por último, que pode ser uma sem node_modules. Foi assim que o
# Planejador parou de abrir em 27/07/2026. Isto só AVISA — não apaga nada.
OUTRAS="$(find "$HOME/Desktop" -maxdepth 3 -name "Planejador.app" 2>/dev/null | grep -vFx "$PLAN" || true)"
if [ -n "$OUTRAS" ]; then
  echo
  echo "ATENÇÃO: há outra(s) cópia(s) do Planejador.app na máquina:"
  echo "$OUTRAS" | sed 's/^/  /'
  echo "  O macOS trata todas como o mesmo app. Enquanto elas existirem, o clique"
  echo "  no Dock pode abrir qualquer uma. Guarde só a que você usa."
fi

echo
echo "Pronto. Feche e reabra os apps para valer a nova casca."
echo "Confira qual cópia abriu: o título da janela agora termina com o nome da pasta."
