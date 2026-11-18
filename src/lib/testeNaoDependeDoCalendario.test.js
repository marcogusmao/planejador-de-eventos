// NENHUM TESTE PODE DEPENDER DO DIA EM QUE ALGUÉM O RODA.
//
// O QUE ACONTECEU, em 01/09/2026. A esteira voltou a rodar (os créditos de
// Actions haviam zerado no dia anterior) e caiu vermelha em dois testes:
//
//   CampoData.test.jsx        > escolher uma data boa apaga o aviso do valor sujo
//   dataChegaNoDadoSalvo...   > a data escolhida atravessa a migração INALTERADA
//   → Unable to find an accessible element with the role "gridcell" and name "12/08/2026"
//
// Os dois clicam na célula `12/08/2026` de um calendário. O valor montado é
// SUJO ou VAZIO, então o componente não consegue deduzir um mês dele e abre no
// mês de HOJE. Durante agosto inteiro a célula estava na grade; em 1º de
// setembro, não está mais.
//
// O DEFEITO NÃO É O CALENDÁRIO — é o teste amarrado ao relógio de quem o roda.
// E o mais caro: dez testes irmãos DOS MESMOS DOIS ARQUIVOS já congelavam o
// relógio com `fixarRelogioLocal(2026, 8, 5)`. Dois esqueceram, e o esquecimento
// ficou invisível por um mês — porque só quebra na virada do mês. Um teste que
// passa 30 dias e falha no 31º não é flaky: é uma bomba com data marcada.
//
// O QUE ESTA GUARDA MORDE: um bloco `it(...)` que clica numa célula de
// calendário com data escrita à mão e NÃO congela o relógio — nem no próprio
// bloco, nem num `beforeEach` do arquivo.
//
// O QUE ELA NÃO PEGA, dito para ninguém confiar demais: dependência de relógio
// que não passe por `gridcell` (um `new Date()` solto numa asserção, por
// exemplo). Ela fecha a porta por onde a casa JÁ caiu, não todas as portas.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Todo arquivo de teste do app, de src/lib e src/components. */
function arquivosDeTeste() {
  const out = []
  for (const dir of ['lib', 'components']) {
    const d = path.join(RAIZ, dir)
    for (const f of readdirSync(d)) {
      if (/\.test\.[jt]sx?$/.test(f)) out.push({ nome: `src/${dir}/${f}`, texto: readFileSync(path.join(d, f), 'utf8') })
    }
  }
  return out
}

// Uma data escrita à mão no formato que o calendário rotula as células.
const DATA_NA_CELULA = /\d{2}\/\d{2}\/\d{4}/
// Como a casa congela o relógio (as três formas em uso).
const CONGELA = /setSystemTime|fixarRelogioLocal|congelarRelogio/

/**
 * COMO SE CLICA NUMA CÉLULA DE CALENDÁRIO NESTE REPOSITÓRIO, e por que isto
 * precisou de uma segunda versão.
 *
 * A primeira versão desta guarda exigia a palavra `gridcell` DENTRO do bloco do
 * teste. Provei a mordida desfazendo os dois consertos de 01/09/2026, e ela
 * mordeu um e deixou o outro passar — porque a casa embrulha a busca num
 * ajudante:
 *
 *     const dia = (texto) => screen.getByRole('gridcell', { name: texto })
 *
 * Um bloco que chama `dia('12/08/2026')` não contém `gridcell` em lugar nenhum.
 * Pior: o que mordeu, mordeu por SORTE do recorte grosseiro de blocos, não por
 * desenho — e guarda que acerta por sorte é a que vai falhar quando importa.
 *
 * A régua nova acha os ajudantes NO PRÓPRIO ARQUIVO — qualquer `const X = ... =>
 * ... getByRole('gridcell'...` — e passa a procurar `X(` nos blocos, além do
 * `gridcell` cru. Isso também distingue CLICAR numa célula (depende do mês na
 * tela) de DIGITAR uma data num campo (não depende de nada), que é o outro
 * caminho comum nestes mesmos arquivos e não é defeito.
 */
function ajudantesDeCelula(texto) {
  const nomes = [...texto.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>[^\n]*gridcell/g)].map((m) => m[1])
  return nomes
}

/**
 * Fatia o arquivo em blocos `it(...)` / `test(...)`, de forma grosseira mas
 * suficiente: cada bloco vai do `it(` até o próximo. Não é um parser de JS — é
 * um recorte, e um recorte que erra para o lado SEGURO (bloco maior do que o
 * real só torna a guarda mais permissiva, nunca mais severa do que deveria).
 */
function blocosDeTeste(texto) {
  const marcas = [...texto.matchAll(/\b(?:it|test)(?:\.each\([^)]*\))?\s*\(/g)].map((m) => m.index)
  return marcas.map((ini, i) => texto.slice(ini, marcas[i + 1] ?? texto.length))
}

/** O nome do teste, para a mensagem de falha dizer QUAL bloco quebrou. */
const nomeDoBloco = (b) => (/^[^(]*\(\s*['"`](.+?)['"`]/s.exec(b)?.[1] ?? '(sem nome)').slice(0, 70)

describe('nenhum teste depende do dia em que alguém o roda', () => {
  it('todo bloco que clica numa célula de calendário com data à mão congela o relógio', () => {
    const infratores = []
    for (const { nome, texto } of arquivosDeTeste()) {
      if (nome.endsWith('testeNaoDependeDoCalendario.test.js')) continue // este aqui
      if (!/gridcell/.test(texto)) continue
      // um congelamento em beforeEach/beforeAll vale para o arquivo inteiro
      const congelaNoArquivo = /before(?:Each|All)\s*\([^)]*\)?[\s\S]{0,400}?(?:setSystemTime|fixarRelogioLocal|congelarRelogio)/.test(texto)
      if (congelaNoArquivo) continue
      const ajudantes = ajudantesDeCelula(texto)
      const buscaCelula = new RegExp(
        ['gridcell', ...ajudantes.map((a) => `\\b${a}\\s*\\(`)].join('|')
      )
      for (const bloco of blocosDeTeste(texto)) {
        const clicaEmCelulaComData = buscaCelula.test(bloco) && DATA_NA_CELULA.test(bloco)
        if (clicaEmCelulaComData && !CONGELA.test(bloco)) {
          infratores.push(`${nome} → ${nomeDoBloco(bloco)}`)
        }
      }
    }
    // A mensagem carrega a lista: quem quebrar isto lê o que fazer, não um `false`.
    expect(infratores, `\nBlocos que clicam numa célula de calendário com data escrita à mão\ne NÃO congelam o relógio — eles passam hoje e quebram na virada do mês:\n  ${infratores.join('\n  ')}\n\nConserto: chame fixarRelogioLocal(2026, 8, 5) no começo do bloco, como os\nirmãos dele já fazem.\n`).toEqual([])
  })

  it('a guarda enxerga o AJUDANTE, não só a palavra `gridcell` crua', () => {
    // A regressão que a versão 1 desta guarda tinha: um bloco que chama
    // `dia('12/08/2026')` não contém `gridcell`, e passava batido.
    const fonte = `
      const dia = (texto) => screen.getByRole('gridcell', { name: texto })
      it('sem congelar', () => {
        fireEvent.click(dia('12/08/2026'))
      })`
    expect(ajudantesDeCelula(fonte)).toContain('dia')
    const busca = new RegExp(['gridcell', ...ajudantesDeCelula(fonte).map((a) => `\\b${a}\\s*\\(`)].join('|'))
    const bloco = blocosDeTeste(fonte)[0]
    expect(busca.test(bloco)).toBe(true)
    expect(CONGELA.test(bloco)).toBe(false) // logo: seria acusado
  })

  it('DIGITAR uma data não é acusado — só CLICAR numa célula depende do mês', () => {
    // `fireEvent.change(campo, { value: '12/08/2026' })` não abre calendário
    // nenhum e não depende de hoje. Acusar isso encheria a lista de ruído, e
    // guarda que grita à toa é guarda que alguém desliga.
    const fonte = `
      const dia = (texto) => screen.getByRole('gridcell', { name: texto })
      it('digita a data', () => {
        fireEvent.change(screen.getByLabelText('Data'), { target: { value: '12/08/2026' } })
      })`
    const busca = new RegExp(['gridcell', ...ajudantesDeCelula(fonte).map((a) => `\\b${a}\\s*\\(`)].join('|'))
    expect(busca.test(blocosDeTeste(fonte)[0])).toBe(false)
  })

  it('a guarda sabe reconhecer os dois casos — o que congela e o que não', () => {
    // Sem isto, um erro na fatia (ou no regex) deixaria a lista sempre vazia e a
    // guarda sairia verde para sempre, que é o pior estado possível.
    const comCongelamento = `
      it('escolhe uma data', () => {
        fixarRelogioLocal(2026, 8, 5)
        fireEvent.click(screen.getByRole('gridcell', { name: '12/08/2026' }))
      })`
    const semCongelamento = `
      it('escolhe uma data', () => {
        fireEvent.click(screen.getByRole('gridcell', { name: '12/08/2026' }))
      })`
    const avalia = (t) => {
      const b = blocosDeTeste(t)[0]
      return /gridcell/.test(b) && DATA_NA_CELULA.test(b) && !CONGELA.test(b)
    }
    expect(avalia(semCongelamento)).toBe(true) // seria acusado
    expect(avalia(comCongelamento)).toBe(false) // passaria
  })

  it('a fatia acha os blocos de verdade nos arquivos que a guarda varre', () => {
    // A premissa da guarda inteira: `blocosDeTeste` recorta alguma coisa. Se o
    // estilo dos testes mudar e o recorte devolver zero, a varredura acima fica
    // vazia e verde sem ter olhado nada.
    const comGridcell = arquivosDeTeste().filter((a) => /gridcell/.test(a.texto))
    expect(comGridcell.length).toBeGreaterThan(0)
    for (const { nome, texto } of comGridcell) {
      expect(blocosDeTeste(texto).length, nome).toBeGreaterThan(0)
    }
  })
})
