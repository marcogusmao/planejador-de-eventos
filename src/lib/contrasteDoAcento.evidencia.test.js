// O BOTÃO PRINCIPAL TEM DE SER LEGÍVEL NOS DOIS TEMAS.
//
// Este arquivo lê o `src/index.css` de verdade e REFAZ a conta de contraste do
// texto branco sobre o acento, nos dois temas. Não existe mock: o que é medido
// é o valor que vai para o navegador.
//
// POR QUE ELE NASCEU (Marco, 12/08/2026, por questionário): o acento do tema
// ESCURO estava em #4d7dff, que dá 3,69:1 com branco — abaixo do 4,5:1 que a
// régua pede para texto normal. Ele decidiu escurecer. A ficha do BACKLOG e a
// própria pergunta levada a ele sugeriam #3a6bff "que dá ~4,5:1"; refeita a
// conta, #3a6bff dá 4,44:1 e TAMBÉM não fecha. Ficou #456fe3 (4,53:1), o azul
// mais claro que ainda passa.
//
// A LIÇÃO QUE ESTE ARQUIVO EXISTE PARA TRAVAR: o número do contraste tinha
// sido ESTIMADO, não medido, e sobreviveu assim em dois documentos. Cor se
// confere com a conta, e a conta agora roda a cada `npm test`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// SEM OS COMENTÁRIOS, e isto não é zelo: a segunda armadilha deste arquivo foi
// o comentário que documenta a decisão DENTRO do bloco escuro citar, em texto,
// `--acento: #0045dd` (o valor do tema claro, que não é tocado). O parser casou
// com a citação em vez da declaração e voltou a medir a cor errada — de novo
// verde pelo motivo errado. Comentário é prosa; a régua olha só a declaração.
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
)

// Luminância relativa e contraste, da definição da régua — escritos aqui em
// vez de importados de propósito: um teste que usasse a mesma função do app
// concordaria com ela até quando ela estivesse errada.
const linear = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminancia = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const contrasteComBranco = (hex) => 1.05 / (luminancia(rgb(hex)) + 0.05)

// O `--acento` de cada bloco.
//
// ARMADILHA MEDIDA AO ESCREVER ESTE ARQUIVO, e é por isso que a busca é por
// REGEX ancorada em início de linha e não por `indexOf` do seletor: a string
// `:root[data-theme='dark']` aparece ANTES, dentro de um comentário do próprio
// index.css. Com `indexOf`, o bloco começava no comentário e o primeiro
// `--acento` encontrado depois dele era o do tema CLARO — o teste media a cor
// errada e passava VERDE com o escuro em 3,69:1. Teste que passa pelo motivo
// errado é pior que teste nenhum; a contraprova do fim deste arquivo existe
// para pegar exatamente isso.
function acentoDoBloco(rotulo, abertura) {
  const m = abertura.exec(css)
  expect(m, `bloco ${rotulo} não existe mais em index.css`).toBeTruthy()
  const inicio = m.index + m[0].length
  const bloco = css.slice(inicio, css.indexOf('}', inicio))
  const achado = bloco.match(/--acento:\s*(#[0-9a-fA-F]{6})/)
  expect(achado, `--acento não encontrado dentro de ${rotulo}`).toBeTruthy()
  return achado[1].toLowerCase()
}

const ABERTURA_ESCURO = /^:root\[data-theme='dark'\]\s*\{/m
const ABERTURA_CLARO = /^:root,\s*\n\[data-theme='light'\]\s*\{/m

describe('contraste do botão principal — texto branco sobre o acento', () => {
  it('o tema ESCURO fecha a régua de 4,5:1', () => {
    const acento = acentoDoBloco('tema escuro', ABERTURA_ESCURO)
    expect(contrasteComBranco(acento)).toBeGreaterThanOrEqual(4.5)
  })

  it('o tema CLARO fecha a régua de 4,5:1', () => {
    // O claro nunca esteve em dúvida — está aqui para o dia em que alguém
    // clarear ESTE em vez daquele.
    const acento = acentoDoBloco('tema claro', ABERTURA_CLARO)
    expect(contrasteComBranco(acento)).toBeGreaterThanOrEqual(4.5)
  })

  it('os dois blocos são mesmo blocos diferentes — a contraprova do bug acima', () => {
    // Se a busca voltar a casar com o comentário, os dois lados devolvem a
    // MESMA cor e este teste cai antes de os outros dois passarem à toa.
    expect(acentoDoBloco('tema escuro', ABERTURA_ESCURO)).not.toBe(
      acentoDoBloco('tema claro', ABERTURA_CLARO)
    )
  })

  it('a conta é a da régua, conferida contra três valores conhecidos', () => {
    // Sem esta verificação, um erro na fórmula acima faria os dois testes
    // anteriores passarem por acidente.
    expect(contrasteComBranco('#4d7dff')).toBeCloseTo(3.69, 1) // o que estava lá
    expect(contrasteComBranco('#3a6bff')).toBeCloseTo(4.44, 1) // o exemplo que NÃO fechava
    expect(contrasteComBranco('#ffffff')).toBeCloseTo(1.0, 2) // branco sobre branco
  })
})
