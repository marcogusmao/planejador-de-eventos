# vendor/ — bibliotecas de terceiro guardadas dentro do repositório

Aqui mora o arquivo `.tgz` da biblioteca que o `package.json` instala por caminho local,
em vez de baixar de um site. É a aplicação literal da regra da casa **"biblioteca
vendorizada, nunca CDN"** — a regra sempre foi essa; o que estava errado era o código.

## O que tem aqui

| Arquivo | Versão | Origem oficial | Licença |
| --- | --- | --- | --- |
| `xlsx-0.20.3.tgz` | 0.20.3 | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | Apache-2.0 |

**Impressão digital do arquivo (sha512, o mesmo formato do `integrity` no
`package-lock.json`):**

    sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==

Tamanho: 2.409.319 bytes. Guardado em 25/07/2026 (decisão 7 do Marco,
`DECISOES-MARCO-H4.md`), a partir do cache local do npm — byte a byte o mesmo arquivo que
o `package-lock.json` já registrava desde 20/07/2026, conferido antes de entrar aqui.

## Por que este arquivo existe

1. **Montar o app não depende de um site externo estar no ar.** Antes, `npm ci` numa
   máquina nova buscava `cdn.sheetjs.com`. Se o site estivesse fora, ninguém conseguia
   montar o app — e "o app funciona sem internet" não valia para quem estava instalando.
2. **A versão fica na corrigida.** A última versão publicada no repositório público de
   pacotes (0.18.5) carrega duas falhas conhecidas e sem correção (CVE-2023-30533 e
   CVE-2024-22363), e é justamente esta biblioteca que abre a planilha que vem de
   terceiro. Voltar para lá trocaria um problema de procedência por um problema de código
   sem conserto.

**Custo aceito pelo Marco:** o repositório engorda ~2,3 MB e atualizar a biblioteca vira
um passo manual — de propósito, porque atualização automática de quem lê planilha de
terceiro é justamente o que não se quer silencioso.

## Como trocar a versão (passo manual, e é decisão do Marco)

Trocar a versão de quem lê planilha de terceiro **não** é tarefa de manutenção de rotina:
é decisão do Marco, porque muda o código que abre arquivo que vem de fora. Quando ele
aprovar:

1. Baixe o `.tgz` da versão nova da origem oficial.
2. Confira a impressão digital antes de qualquer outra coisa:
   `shasum -a 512 <arquivo>` — e compare com o que a origem publica. Se não bater, pare.
3. Coloque o arquivo aqui com o nome `xlsx-<versão>.tgz`, apague o antigo, aponte o
   `package.json` para o caminho novo e rode `npm install` para regravar o
   `package-lock.json`.
4. Atualize a tabela e a impressão digital deste arquivo.
5. Prove que funciona: `npm ci`, `npm test`, `npm run build` — e um teste ao vivo de
   importar planilha, porque é isso que a biblioteca faz.

## Critério de aceite desta pasta

Rodar `grep -c "cdn.sheetjs.com" package-lock.json` tem de devolver **0**: nenhuma linha
do lock manda o npm consultar aquele site. É essa a prova de que montar o app ficou
offline de verdade.
