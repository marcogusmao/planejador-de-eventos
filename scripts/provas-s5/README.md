# Provas da matriz do relatório

Dados exclusivamente sintéticos. Nenhuma conexão com o Financeiro. Usam o
Playwright já disponível no projeto Calendário e Poppler local; `PLAYWRIGHT_DE`
e `POPPLER_DE` permitem indicar outras instalações existentes. Não instalam pacotes.

```sh
npm run build
~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/pdf
node --test scripts/provas-s5/fragmentacao.test.mjs
~/bin/fila node scripts/provas-s5/fragmentacao.mjs --html .context/s5/pdf/matriz-4.html --saida .context/s5/fragmentacao
```

`pdf-matriz.mjs` produz HTML, PDF A4 escala 1, texto, palavras com coordenadas,
PNG de todas as páginas e recibo JSON com hashes/fontes reais. Os casos padrão
são 0/1/4/5/6/7/9 referências e 9 com nomes/cifras longos. `--casos 4,7`
restringe a rodada. Código 0 confirma as verificações; 1 acusa conteúdo/limite;
2 informa erro de instrumento/ambiente. Abrir todas as imagens da matriz também
faz parte do aceite. Chromium headless não representa o diálogo do Mac.

Repetir o MESMO instrumento contra a base que cortava: quatro referências
precisam passar; cinco/seis/sete precisam falhar por conteúdo/limite. Não
substituir isso por teste que falhou na importação ou na montagem do ambiente.

Controles que alteram somente o documento sintético, nunca o fonte do app:

```sh
~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/largura --casos 4,7 --mutacao largura
~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/nowrap --casos 4,9l --mutacao nowrap
~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/troca --casos 1,7 --mutacao troca
~/bin/fila node scripts/provas-s5/pdf-matriz.mjs --saida .context/s5/deslocamento --casos 4 --mutacao deslocar-linha
~/bin/fila node scripts/provas-s5/fragmentacao.mjs --html .context/s5/pdf/matriz-4.html --saida .context/s5/sem-cabecalho --sem-cabecalho
```

Cada comando de controle deve sair 1. Largura conserva o controle 4; troca
conserva o controle 1. `nowrap` também corta nomes do caso 4 e deve acusá-lo.
Fragmentação repete 72 linhas apenas no HTML para forçar continuação, verifica
todo o cabeçalho capturado do DOM, cada linha uma vez e total somente no fim.
Os oito testes puros guardam as recusas de cabeçalho incompleto/linha omitida.
