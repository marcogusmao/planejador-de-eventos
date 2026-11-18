# Provas da S7/P8 — lote sem preço

Dados exclusivamente sintéticos (a "Festa P8": 600 ingressos de R$ 100, 50
cortesias declaradas e um "Camarote" de 300 com o preço em branco). Nenhuma
conexão com o Financeiro. Não instalam pacotes: usam o Playwright do projeto
Calendário e o Poppler local (`PLAYWRIGHT_DE` e `POPPLER_DE` apontam outras
instalações já existentes).

| Script | O que prova | Saída |
| --- | --- | --- |
| `diff-aprovacao.mjs` | a tabela antigo × novo que o Marco aprovou em 06/10/2026 (comparador = mesma festa sem o lote) | JSON; depois do conserto, `atual` = `esperado` e `diferencaLucro` 0 |
| `mutacoes-p8.mjs` | cada guarda do conserto tem um teste que fica vermelho sem ela | 0 = toda mutação derrubou teste; 1 = alguma sobreviveu; 2 = instrumento cego |
| `fluxo-lote-sem-preco.mjs` | o app real no navegador: import pelo Ajustes, Receita, Cenários, Relatório + PDF A4, Apresentação, Copiar resumo, Exportar backup, recarga | 0 = tudo conferido; 1 = falhas listadas; 2 = ambiente |

```sh
node scripts/provas-s7/diff-aprovacao.mjs
~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs                 # todas
~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs --cego          # controle do instrumento: tem de sair 2
~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs --so-golden M1 M2 M3 M4   # informativo: sai 1
npm run dev -- --host 127.0.0.1 --port <PORTA> --strictPort        # em outro terminal
~/bin/fila node scripts/provas-s7/fluxo-lote-sem-preco.mjs --porta <PORTA> --saida .context/s7/navegador
```

O corredor de mutação troca o trecho EM MEMÓRIA (plugin de transformação do
Vite dentro do Vitest): nenhum arquivo do app é editado e não há o que
restaurar. Se uma âncora mudar de texto, ele sai 2 ("trecho aparece 0 vezes") —
ajuste a tabela do script, nunca o teste.

**O que não pega, de propósito escrito aqui:** rodadas só contra o golden
(`--so-golden M1 M2 M3 M4`), as quatro guardas de `calc.js` SOBREVIVEM — a
fotografia de ponta a ponta fica verde com qualquer uma delas desfeita. Quem as
guarda é `src/lib/calc.p8.test.js`, um teste por guarda.

O instrumento de navegador tem de acusar a base: com as telas de antes da S7
(e `calc.js` já consertado) ele sai 1, listando faixa, selo, linha do cartão,
aviso do import e do WhatsApp ausentes. PDF de Chromium headless não é o
diálogo de impressão do Mac.
