# O PLANEJADOR no Railway (Marco, 05/10/2026, por questionário).
#
# Uma cópia da TELA servida atrás da entrada da casa (a portaria do Calendário).
# O servidor não guarda dado: os eventos continuam no navegador de cada pessoa.
# Modelo: o Dockerfile do Calendário (calendario, c38fb0b).
#
# Duas etapas: a primeira constrói o `dist/` com o Vite; a segunda leva só o que
# roda — o `dist/` e o `servidor/` (Node puro, zero dependência). Sem
# `node_modules` na imagem final: não há o que instalar.

FROM node:22-alpine AS construtor
WORKDIR /app
# O `xlsx` vem de `file:vendor/xlsx-0.20.3.tgz` (package-lock.json): sem a pasta
# `vendor/` presente ANTES do `npm ci`, a instalação quebra.
COPY package.json package-lock.json ./
COPY vendor ./vendor
# O `prepare` do package.json roda `sh .githooks/ligar-trava.sh`. Sem o arquivo,
# o `npm ci` morre com "not found". Com ele, o script sai 0 e explica por quê:
# esta imagem não tem git (passo 1 do script) e não é um repositório (passo 2).
COPY .githooks/ligar-trava.sh ./.githooks/ligar-trava.sh
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Na nuvem o servidor escuta para fora. Qualquer HOST diferente de 127.0.0.1 é
# "modo nuvem": sem as cinco variáveis abaixo, tudo responde 503 — nunca abre.
ENV HOST=0.0.0.0
# O Railway passa a porta em `PORT` e ela vence esta linha; o valor daqui só vale
# num `docker run` local, e é o mesmo do EXPOSE.
ENV PORT=8080
# Carimbo de log no fuso da casa. O app não calcula nada no servidor.
ENV TZ=America/Sao_Paulo
# ————— A ENTRADA (as cinco variáveis da portaria) —————
#
# Os NOMES ficam aqui, para quem abre o painel do Railway saber o que criar. Os
# VALORES nunca — segredo em imagem é segredo publicado. As cinco são
# obrigatórias juntas: com parte delas o servidor responde 503 dizendo qual
# falta, e nunca serve o app sem porta.
#
#   PORTARIA_EMISSOR          https://entrar.casa.example/api/auth
#   PORTARIA_CLIENTE_ID       o client_id do Planejador na portaria
#   PORTARIA_CLIENTE_SEGREDO  o client_secret (só no painel)
#   CHAVE_DO_COOKIE           32 bytes: 64 caracteres em hexadecimal
#                             node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
#   ORIGEM_PUBLICA            https://planejador.casa.example
COPY --from=construtor /app/dist ./dist
COPY servidor ./servidor
# O processo roda como o usuário `node` da imagem, não como root: ele só LÊ
# arquivos. A troca vem ANTES da conferência de imports de propósito — um
# arquivo de `servidor/` sem permissão de leitura (terminal com umask 077, a
# armadilha medida no Propostas em 17/09/2026) quebra AQUI, no build, e não na
# primeira visita.
USER node
# Confere os imports na imagem final, onde não há node_modules.
RUN node --input-type=module -e "await import('./servidor/servidor.mjs')"
EXPOSE 8080
CMD ["node", "servidor/servidor.mjs"]
