#!/bin/sh
# com-fila.sh — manda o comando pesado pela fila quando ela existe.
#
# POR QUE (medido em 04/09/2026, MacBook Air M4, 16 GB, 10 núcleos):
#   Um `vitest run` sozinho já toma 9 dos 10 núcleos (maxForks = núcleos-1).
#   Do 2º job simultâneo em diante a vazão NÃO sobe e só a memória cresce:
#       2 suítes juntas ->  6,99s / 3,70 GB
#       4 suítes juntas -> 13,21s / 7,13 GB
#       6 suítes juntas -> 21,46s / 9,42 GB
#   Com a fila (2 vagas), as mesmas 6 suítes: 17,44s / 5,37 GB.
#   Ou seja: 19% MAIS RÁPIDO e 43% menos memória. A fila não é cota, é ganho.
#
#   Em 03/09/2026 sete processos node de 3,2-4,5 GB subiram no mesmo instante,
#   o compressor de memória estourou e o jetsam matou MTLCompilerService e
#   com.apple.appkit.xpc.openAndSave — por isso o sintoma era "não abre app nem
#   aba nova". O WindowServer caiu às 16:28:42.
#
# NO CI a fila não existe: aqui a gente detecta e roda direto, e no CI este
# script nunca é motivo de build vermelho. NA MÁQUINA DO MARCO pode ser: se as
# vagas ficarem ocupadas além de FILA_ESPERA_MAX (30 min), a fila desiste com
# código 75 e avisa como liberar ('fila --estado' / 'fila --limpar').
#
# Chama a fila PELO CAMINHO, não pelo PATH (revisor do PR #96, 05/10/2026): o
# npm põe na frente do PATH o node_modules/.bin de cada pasta acima do
# repositório, e um outro programa chamado `fila` ali seria executado no lugar
# dela — se ele saísse 0 sem rodar nada, `npm test` ficaria verde sem testar.
#
# Só comando FINITO passa por aqui (test, build). `dev`, `preview` e
# `test:watch` são servidores que não terminam: pôr na fila prenderia a vaga
# para sempre e travaria os outros.
FILA="${HOME:-/nonexistent}/bin/fila"
if [ -x "$FILA" ]; then
  exec "$FILA" "$@"
fi
exec "$@"
