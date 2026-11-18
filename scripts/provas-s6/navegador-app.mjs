// Prova da S6 no app real (dados sintéticos; rede externa recusada).
// Requer o app em http://127.0.0.1:55080 (npm run dev -- --host 127.0.0.1 --port 55080).
// node scripts/provas-s6/navegador-app.mjs depois  → .context/s6/navegador-depois/recibo.json
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { eventoTravado } from '../../scripts/provas-s0/cenarios.fixture.js'
import { FIXED_BENCHMARKS } from '../../src/lib/benchmarks.js'
const { chromium } = createRequire(join(homedir(), 'Desktop/Dev/calendario/node_modules/'))('playwright')
const etapa = process.argv[2] || 'depois'
const dir = `.context/s6/navegador-${etapa}`
mkdirSync(dir, { recursive: true })
const recibo = { etapa, casos: [], erros: [], redeRecusada: [] }
const browser = await chromium.launch()
const aviso = /quantidade travada à mão neste cenário/i
try {
  for (const [nome, quantidades] of [['cheio', [400,600,200]], ['parcial', [100,100,20]], ['zero', [0,'','']], ['automatico', ['','','']]]) {
    const evento = eventoTravado(quantidades)
    evento.id = `s6-${nome}`; evento.nome = `S6 — ${nome}`; evento.vendidosAteHoje = 100
    const store = { eventos: [evento], benchmarksCustom: [], benchmarksApagados: FIXED_BENCHMARKS.map(b => b.id), benchmarkOverrides: {}, ajustes: {} }
    const contexto = await browser.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
    await contexto.route('**/*', r => {
      const u = new URL(r.request().url())
      if (u.origin === 'http://127.0.0.1:55080') return r.continue()
      recibo.redeRecusada.push(u.origin + u.pathname); return r.abort()
    })
    await contexto.addInitScript(store => {
      if (!localStorage.getItem('previsao-eventos:v1')) localStorage.setItem('previsao-eventos:v1', JSON.stringify(store))
    }, store)
    const p = await contexto.newPage(); p.setDefaultTimeout(10000)
    p.on('pageerror', e => recibo.erros.push(e.message))
    await p.goto('http://127.0.0.1:55080/')
    await p.getByRole('button', { name: `Abrir ${evento.nome}`, exact: true }).click()
    await p.getByRole('button', { name: 'Cenários & Resultado', exact: true }).click()
    const antes = await p.evaluate(() => localStorage.getItem('previsao-eventos:v1'))
    const resumo = p.locator('#cen-resumo')
    const dre = p.locator('#cen-dre')
    const caso = { nome, cartoes: aviso.test(await resumo.innerText()), dre: aviso.test(await dre.innerText()) }
    caso.breakEven = await resumo.locator('dt').filter({hasText: /^Break-even$/}).evaluateAll(es => es.map(e => e.nextElementSibling.textContent))
    // Célula a célula (revisão S6): DRE realista, transbordamento dos avisos.
    caso.dreRealista = await dre.locator('tr').filter({hasText: /^Break-even \(ingressos pagos\)/}).first().evaluate(tr => tr.cells[2]?.textContent.trim())
    caso.transborda = await p.evaluate(() => [...document.querySelectorAll('dd,td')].filter(e => e.textContent.includes('quantidade travada')).filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent))
    if (nome === 'cheio') {
      await resumo.screenshot({ path: `${dir}/cartoes-desktop.png` })
      await p.getByRole('button', { name: 'Mudar para o tema escuro', exact: true }).click()
      await resumo.screenshot({ path: `${dir}/cartoes-escuro.png` })
      await p.setViewportSize({ width: 375, height: 844 })
      await resumo.screenshot({ path: `${dir}/cartoes-estreito.png` })
      await p.setViewportSize({ width: 1360, height: 1000 })
      await p.evaluate(() => { document.body.style.zoom = '2' })
      await resumo.screenshot({ path: `${dir}/cartoes-zoom.png` })
      await p.evaluate(() => { document.body.style.zoom = '1' })
    }
    await p.getByRole('button', { name: 'Relatório / PDF', exact: true }).click()
    await p.getByRole('button', { name: 'Completo', exact: true }).click()
    caso.relatorio = aviso.test(await p.locator('body').innerText())
    if (nome === 'cheio') {
      await p.pdf({ path: `${dir}/relatorio.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
      await p.screenshot({ path: `${dir}/relatorio.png`, fullPage: true })
    }
    await p.getByRole('button', { name: 'Voltar', exact: true }).click()
    await p.getByRole('button', { name: 'Apresentação', exact: true }).click()
    caso.apresentacao = aviso.test(await p.locator('body').innerText())
    caso.apresentacaoBE = await p.locator('dt').filter({hasText: /^Break-even$/}).evaluateAll(es => es.map(e => e.nextElementSibling.textContent))
    await p.getByRole('button', { name: 'Como ler este relatório', exact: true }).click()
    caso.legendaApresentacao = await p.locator('dt').filter({hasText: /^Break-even \(BE\)$/}).first().evaluate(e => e.nextElementSibling.textContent)
    if (nome === 'cheio') {
      await p.screenshot({ path: `${dir}/apresentacao.png`, fullPage: true })
      await p.setViewportSize({ width: 390, height: 844 })
      await p.screenshot({ path: `${dir}/apresentacao-390.png`, fullPage: true })
      caso.transbordaApresentacao390 = await p.evaluate(() => [...document.querySelectorAll('dd')].filter(e => e.textContent.includes('quantidade travada')).filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent))
    }
    caso.storePreservado = (await p.evaluate(() => localStorage.getItem('previsao-eventos:v1'))) === antes
    recibo.casos.push(caso)
    if (etapa === 'depois') {
      for (const k of ['cartoes','dre','relatorio','apresentacao']) assert.equal(caso[k], nome !== 'automatico', `${nome}/${k}`)
      assert(caso.storePreservado)
      if (nome !== 'automatico') {
        assert(aviso.test(caso.breakEven[1]), `${nome}/valor do realista`)
        assert(aviso.test(caso.dreRealista), `${nome}/DRE realista: ${caso.dreRealista}`)
        assert(aviso.test(caso.apresentacaoBE[1]), `${nome}/apresentação realista`)
        assert.equal(caso.legendaApresentacao, 'quantidade travada à mão neste cenário', `${nome}/legenda`)
      } else {
        assert.match(caso.dreRealista, /^\d/, 'sem trava: DRE numérica')
        assert.match(caso.legendaApresentacao, /Neste evento: \d/, 'sem trava: legenda com número')
      }
      assert.deepEqual(caso.transborda, [], `${nome}/transbordamento`)
      if (caso.transbordaApresentacao390) assert.deepEqual(caso.transbordaApresentacao390, [], 'apresentação 390 px')
    }
    await contexto.close()
  }
  assert.deepEqual(recibo.erros, [])
} catch (e) { recibo.falha = e.stack; process.exitCode = 1 }
finally { await browser.close(); writeFileSync(`${dir}/recibo.json`, JSON.stringify(recibo,null,2)); console.log(JSON.stringify(recibo,null,2)) }
