// Prova da política de conteúdo do servidor da nuvem (revisão de segurança do
// PR #100, 05/10/2026). Abre o app SERVIDO PELO servidor/servidor.mjs num
// Chromium sem janela, percorre Home → nova festa → abas Custos, Cenários e
// Análise → Planilha do produtor (baixa o .xlsx e exige o logo dentro, em
// xl/media) → custos de um benchmark → Exportar pagamentos → Para mim (baixa o
// CSV por link `blob:`) → Home → Ajustes, e falha (saída 1) se o navegador
// acusar QUALQUER violação de política (`securitypolicyviolation`), erro de
// página, planilha sem imagem ou download que não aconteceu.
//
// Por que a planilha entrou (reconferência do PR #100): o logo da planilha do
// produtor era carregado por `blob:`, a política bloqueava, e um catch mudo
// deixava o .xlsx sair sem logo — nenhum erro na tela. Uma prova que só abre
// telas não vê isso; esta baixa o arquivo e olha dentro.
//
// Uso, com o servidor de pé no modo aberto (ver CLAUDE.md, seção Railway):
//
//     npm run build && HOST=127.0.0.1 PORT=4180 node servidor/servidor.mjs   # num terminal
//     node scripts/prova-csp-nuvem.mjs http://127.0.0.1:4180/                # noutro
//
// O Playwright NÃO é dependência deste repositório (package.json é do portão):
// o script usa o do Calendário. Outro lugar: PLAYWRIGHT_DE=<pasta com
// node_modules/playwright>. Controle positivo, antes de confiar num "zero":
// troque `font-src 'self'` por `font-src 'none'` em POLITICA_DO_APP, reinicie o
// servidor e confira que este script acusa a fonte Jost bloqueada. O controle
// do passo da planilha: com o marcaPng.js antigo (o SVG por `blob:`), o mesmo
// roteiro tem de acusar `img-src` e "0 imagens em xl/media".
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const endereco = process.argv[2] || 'http://127.0.0.1:4180/'
const pasta = process.env.PLAYWRIGHT_DE || join(homedir(), 'Desktop/Dev/calendario')
const { chromium } = createRequire(join(pasta, 'node_modules/'))('playwright')

const navegador = await chromium.launch({ headless: true })
const pagina = await (await navegador.newContext({ acceptDownloads: true })).newPage()
const pastaDosDownloads = mkdtempSync(join(tmpdir(), 'prova-csp-'))
const erros = []
pagina.on('pageerror', (e) => erros.push(`erro de página: ${e.message}`))
pagina.on('console', (m) => {
  if (m.type() === 'error') erros.push(`console: ${m.text()}`)
})
await pagina.addInitScript(() => {
  window.__violacoes = []
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__violacoes.push(`${e.violatedDirective} bloqueou ${e.blockedURI || '(embutido)'}`),
  )
})
const passos = []
const passo = async (nome) => {
  await pagina.waitForTimeout(300)
  passos.push(nome)
}
try {
  await pagina.goto(endereco, { waitUntil: 'networkidle' })
  await passo('Home')
  await pagina.getByRole('button', { name: 'Novo evento' }).first().click()
  await pagina.getByText('Marfim Alto', { exact: true }).last().click()
  await pagina.getByRole('button', { name: /^Criar / }).click()
  await passo('festa aberta')
  for (const aba of ['Custos', 'Cenários & Resultado', 'Análise']) {
    await pagina.getByRole('button', { name: aba, exact: true }).click()
    await passo(`aba ${aba}`)
  }

  // Planilha do produtor: o .xlsx tem de sair COM o logo da festa.
  await pagina.getByRole('button', { name: /Planilha do produtor/ }).click()
  const [planilha] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 15000 }),
    pagina.getByRole('button', { name: /Baixar planilha do orçamento/ }).click(),
  ])
  const arquivoXlsx = join(pastaDosDownloads, 'orcamento.xlsx')
  await planilha.saveAs(arquivoXlsx)
  const imagens = execFileSync('unzip', ['-Z1', arquivoXlsx]).toString().split('\n')
    .filter((n) => n.startsWith('xl/media/') && !n.endsWith('/'))
  if (imagens.length === 0) erros.push('a planilha do produtor saiu SEM imagem em xl/media (o logo não entrou)')
  await passo(`Planilha do produtor (${imagens.length} imagem(ns) em xl/media)`)
  await pagina.keyboard.press('Escape')

  // Exportar pagamentos → Para mim: download do CSV por link `blob:`.
  await pagina.getByRole('button', { name: 'Custos', exact: true }).click()
  await pagina.getByRole('button', { name: /Usar um benchmark como base/ }).click()
  await pagina.getByRole('button', { name: /^Adicionar \d+ itens d/ }).click()
  await pagina.getByRole('button', { name: /Exportar…/ }).click()
  await pagina.getByRole('button', { name: /Para mim/ }).click()
  const [csv] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 15000 }),
    pagina.getByRole('button', { name: /^Baixar CSV para mim/ }).click(),
  ])
  const arquivoCsv = join(pastaDosDownloads, 'pagamentos.csv')
  await csv.saveAs(arquivoCsv)
  const bytesCsv = statSync(arquivoCsv).size
  if (bytesCsv === 0) erros.push('o CSV de pagamentos "Para mim" saiu vazio')
  await passo(`Exportar pagamentos → Para mim (${bytesCsv} bytes)`)
  await pagina.keyboard.press('Escape')
  await pagina.getByRole('button', { name: 'Início', exact: true }).click()
  await passo('volta à Home')
  await pagina.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await passo('Ajustes')
} catch (e) {
  erros.push(`o roteiro parou: ${e.message.split('\n')[0]}`)
}
const violacoes = await pagina.evaluate(() => window.__violacoes).catch(() => ['(não consegui ler)'])
await navegador.close()
rmSync(pastaDosDownloads, { recursive: true, force: true })

console.log(`passos: ${passos.join(' → ')}`)
console.log(`violações de política: ${violacoes.length}`)
for (const v of violacoes) console.log(`  · ${v}`)
console.log(`erros: ${erros.length}`)
for (const e of erros) console.log(`  · ${e}`)
process.exit(violacoes.length || erros.length ? 1 : 0)
