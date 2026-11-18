// Diagnóstico de paginação: repete linhas SINTÉTICAS somente no HTML de prova.
// --html aponta para matriz-4.html produzido por pdf-matriz.mjs.
// --sem-cabecalho reintroduz o defeito e precisa sair 1 por cabeçalho ausente.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { conferirFragmentacao } from './conferirFragmentacao.mjs'

const args = process.argv.slice(2)
const opcao = nome => args[args.indexOf(nome) + 1]
if (!args.includes('--html') || !args.includes('--saida')) throw new Error('Informe --html e --saida.')
const saida = resolve(opcao('--saida')); mkdirSync(saida, { recursive: true })
const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DE || join(homedir(), 'Desktop/Dev/calendario'), 'node_modules/'))('playwright')
const browser = await chromium.launch()
const recibo = { diagnostico: '72 linhas sintéticas no HTML de prova; não altera produto/dados.', semCabecalho: args.includes('--sem-cabecalho'), falhas: [] }
try {
  const pagina = await browser.newPage()
  await pagina.route(/^https?:/, r => r.abort())
  await pagina.goto(pathToFileURL(resolve(opcao('--html'))).href)
  await pagina.emulateMedia({ media: 'print' })
  await pagina.evaluate(() => document.fonts.ready)
  recibo.cabecalhoEsperado = await pagina.locator('.matriz-relatorio thead').innerText()
  await pagina.evaluate(() => {
    const corpo = document.querySelector('.matriz-relatorio tbody')
    const modelo = corpo.rows[0].cloneNode(true), total = [...corpo.rows].at(-1).cloneNode(true)
    corpo.replaceChildren()
    for (let i = 1; i <= 72; i++) {
      const linha = modelo.cloneNode(true)
      linha.cells[0].textContent = `Linha L${String(i).padStart(3, '0')}`
      corpo.append(linha)
    }
    corpo.append(total)
  })
  if (recibo.semCabecalho) await pagina.addStyleTag({ content: '@media print { .matriz-relatorio thead { display: table-row-group !important; } }' })
  const pdf = join(saida, 'fragmentacao.pdf')
  await pagina.pdf({ path: pdf, format: 'A4', scale: 1, printBackground: true, preferCSSPageSize: true })
  const poppler = process.env.POPPLER_DE || '/opt/homebrew/bin'
  execFileSync(join(poppler, 'pdftotext'), ['-layout', pdf, join(saida, 'fragmentacao.txt')])
  execFileSync(join(poppler, 'pdftoppm'), ['-scale-to', '1600', '-png', pdf, join(saida, 'fragmentacao')])
  const paginas = readFileSync(join(saida, 'fragmentacao.txt'), 'utf8').split('\f')
  Object.assign(recibo, conferirFragmentacao(paginas, recibo.cabecalhoEsperado))
  process.exitCode = recibo.falhas.length ? 1 : 0
} finally {
  await browser.close(); writeFileSync(join(saida, 'resultado.json'), JSON.stringify(recibo, null, 2)); console.log(JSON.stringify(recibo))
}
