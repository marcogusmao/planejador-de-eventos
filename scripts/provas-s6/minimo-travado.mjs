// Prova de publicação do mínimo: componentes reais e PDF A4, com dados sintéticos.
// npm run build; ~/bin/fila node scripts/provas-s6/minimo-travado.mjs --saida .context/s6/pdf
// 0 = aceite; 1 = conteúdo/limites divergentes; 2 = instrumento não concluiu.
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { eventoTravado } from '../provas-s0/cenarios.fixture.js'
import { FIXED_BENCHMARKS } from '../../src/lib/benchmarks.js'
import { computeCenarios } from '../../src/lib/calc.js'
import { fmtInt } from '../../src/lib/format.js'

const args = process.argv.slice(2)
const opcao = k => args.includes(k) ? args[args.indexOf(k)+1] : undefined
if (!opcao('--saida')) throw new Error('Informe --saida para guardar as provas sintéticas.')
const saida = resolve(opcao('--saida')); mkdirSync(saida, { recursive: true })
const aviso = 'quantidade travada à mão neste cenário'
const invalido = 'não dá para calcular'
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const normalizar = t => t.replace(/\s+/g, ' ').trim()
const { chromium } = createRequire(join(homedir(), 'Desktop/Dev/calendario/node_modules/'))('playwright')
const poppler = '/opt/homebrew/bin'
const recibo = { data: new Date().toISOString(), formato: 'A4', escala: 1,
  limite: 'Chromium headless; não é o diálogo de impressão do Mac.',
  fontes: Object.fromEntries(['src/components/ReportView.jsx','src/lib/breakEvenTexto.js','src/lib/resumo.js','src/lib/premissaTexto.js', 'scripts/provas-s6/minimo-travado.mjs'].map(f => [f,hash(f)])), casos: [] }
let servidor, browser
try {
  servidor = await createServer({ configFile: resolve('vite.config.js'), server: { middlewareMode:true, hmr:false }, appType:'custom' })
  const { default: ReportView } = await servidor.ssrLoadModule('/src/components/ReportView.jsx')
  const cssNome = readdirSync('dist/assets').find(n => n.endsWith('.css'))
  const css = readFileSync(join('dist/assets',cssNome),'utf8').replace(/url\(\/?assets\/([^)]*?)(?:["'])?\)/g, (_,n) => `url(data:font/ttf;base64,${readFileSync(join('dist/assets',n.replace(/["']/g,''))).toString('base64')})`)
  recibo.css = { arquivo:cssNome,sha256:hash(join('dist/assets',cssNome)) }
  browser = await chromium.launch(); recibo.navegador = browser.version()
  const pagina = await browser.newPage({ viewport:{width:703,height:1123} })
  await pagina.route(/^https?:/,r => r.abort()); await pagina.emulateMedia({media:'print'})
  for (const nome of (opcao('--casos') || 'cheio,parcial,zero,automatico,invalido').split(',')) {
    for (const nivel of ['resumido','completo']) {
      const e = eventoTravado(nome === 'parcial' ? [100,100,20] : nome === 'zero' ? [0,'',''] : nome === 'automatico' ? ['','',''] : [400,600,200])
      e.nome = `S6 — ${nome}`; e.vendidosAteHoje = 100; e.data = '2099-01-01'
      if (nome === 'invalido') e.categorias.find(c => c.id === 'aeb').itens[0].estimado = 1e308
      const original = JSON.stringify(e), c = computeCenarios(e), resultados = JSON.stringify(c)
      const esperado = nome === 'automatico' ? fmtInt(c.realista.breakEven) : nome === 'invalido' ? invalido : aviso
      const store = { eventos:[e], benchmarksCustom:[], benchmarksApagados:FIXED_BENCHMARKS.map(b=>b.id), benchmarkOverrides:{}, ajustes:{} }
      globalThis.localStorage = { getItem:k => k === 'previsao-eventos:relatorio-nivel:v1' ? nivel : null }
      const html = renderToStaticMarkup(React.createElement(ReportView,{evento:e,store,onBack(){}}))
      const prefixo = join(saida,`${nome}-${nivel}`)
      writeFileSync(prefixo+'.html',`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>${css}</style><body>${html}</body></html>`)
      await pagina.goto(pathToFileURL(prefixo+'.html').href); await pagina.evaluate(() => document.fonts.ready)
      const dom = await pagina.evaluate(() => {
        const norm = s => s.replace(/\s+/g,' ').trim(), box = e => { const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height} }
        const celulas = [...document.querySelectorAll('dt')].filter(e=>e.textContent.startsWith('Break-even')).map(e=>({rotulo:norm(e.textContent),texto:norm(e.nextElementSibling.textContent),...box(e.nextElementSibling),scroll:e.nextElementSibling.scrollWidth,client:e.nextElementSibling.clientWidth}))
        const row = [...document.querySelectorAll('tr')].find(e=>e.cells[0]?.textContent==='Break-even (ingressos pagos)')
        const dre = row ? {height:row.getBoundingClientRect().height,celulas:[...row.cells].map(e=>({texto:norm(e.textContent),...box(e),scroll:e.scrollWidth,client:e.clientWidth}))} : null
        const limites = []
        for (const e of [...document.querySelectorAll('dd,td')].filter(e=>e.textContent.includes('quantidade travada'))) {
          const b=e.getBoundingClientRect(),walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let t
          while((t=walk.nextNode())){const range=document.createRange();range.selectNodeContents(t);for(const r of range.getClientRects())if(r.x<b.x-1||r.right>b.right+1)limites.push({texto:norm(e.textContent),x:r.x,right:r.right,celula:box(e)})}
        }
        const rotRitmo = [...document.querySelectorAll('span')].find(e=>e.textContent==='Ritmo de vendas:')
        const ritmo = rotRitmo ? norm(rotRitmo.parentElement.textContent) : null
        return {celulas,dre,limites,ritmo,texto:norm(document.body.textContent)}
      })
      const falhas=[]
      if(dom.celulas[1]?.texto!==esperado)falhas.push(`Cartão realista: ${dom.celulas[1]?.texto}; esperado ${esperado}`)
      if(nivel==='completo'&&dom.dre?.celulas[2]?.texto!==esperado)falhas.push(`DRE realista: ${dom.dre?.celulas[2]?.texto}; esperado ${esperado}`)
      // O termo do glossário é "Break-even (BE)" (premissaTexto.js); a primeira versão
      // procurava "Break-even" e falhava sempre — cega dos dois lados (06/10/2026).
      const glossario=dom.celulas.find(c=>c.rotulo==='Break-even (BE)')
      if(nivel==='completo'&&!glossario)falhas.push('Instrumento não localizou o glossário')
      if(nivel==='completo'&&nome!=='automatico'&&nome!=='invalido'&&glossario?.texto!==aviso)falhas.push(`Glossário: ${glossario?.texto}; esperado ${aviso}`)
      if(nivel==='completo'&&nome==='automatico'&&!glossario?.texto.includes(`Neste evento: ${esperado} ingressos pagos.`))falhas.push(`Glossário sem trava perdeu o número: ${glossario?.texto}`)
      // Linha de ritmo (revisão S6): com trava, o dado digitado fica e a meta some.
      if(nome==='automatico'&&!/\d+ vendidos até hoje\..*\d/.test(dom.ritmo||''))falhas.push(`Ritmo sem trava perdeu a meta: ${dom.ritmo}`)
      if(['cheio','parcial','zero'].includes(nome)&&dom.ritmo!==`Ritmo de vendas: 100 vendidos até hoje. ${aviso}`)falhas.push(`Ritmo com trava: ${dom.ritmo}`)
      falhas.push(...dom.limites.map(l=>'Texto fora da célula: '+l.texto))
      if(original!==JSON.stringify(e)||resultados!==JSON.stringify(computeCenarios(e)))falhas.push('Render alterou evento ou resultado de cálculo')
      await pagina.pdf({path:prefixo+'.pdf',format:'A4',scale:1,printBackground:true,preferCSSPageSize:true})
      execFileSync(join(poppler,'pdftotext'),['-layout',prefixo+'.pdf',prefixo+'.txt'])
      execFileSync(join(poppler,'pdftotext'),['-bbox-layout',prefixo+'.pdf',prefixo+'-bbox.html'])
      const paginas=JSON.parse(execFileSync('python3',['scripts/provas-s5/extrair-pdf.py',prefixo+'-bbox.html']).toString())
      const texto=normalizar(readFileSync(prefixo+'.txt','utf8'))
      if(nome!=='automatico'&&nome!=='invalido'&&!texto.includes(aviso))falhas.push('PDF sem aviso integral')
      const paginasAviso=[]
      paginas.forEach((p,i)=>{
        const ls=p.lines.filter(l=>/quantidade|travada|à mão|neste cenário|Break-even/.test(l.text))
        if(ls.length)paginasAviso.push(i+1)
        for(const l of ls)if(l.xMin<12*72/25.4-1||l.xMax>p.width-12*72/25.4+1)falhas.push(`PDF página ${i+1}: aviso fora da margem`)
      })
      // A coluna realista da DRE é lida pelo limite das células do componente,
      // ancorado no rótulo impresso. Detecta número mantido ao lado de aviso em outro lugar.
      let drePdf=null
      if(dom.dre){
        for(const [i,p] of paginas.entries()){
          const label=p.lines.find(l=>l.text.startsWith('Break-even (ingressos')||l.text==='Break-even (ingressos pagos)')
          if(!label)continue
          const cells=dom.dre.celulas, x0=label.xMin, left=x0+(cells[2].x-cells[0].x)*.75, right=x0+(cells[2].right-cells[0].x)*.75
          const centro=(label.yMin+label.yMax)/2, metade=dom.dre.height*.75/2
          const words=p.lines.flatMap(l=>l.words).filter(w=>(w.xMin+w.xMax)/2>=left-1&&(w.xMin+w.xMax)/2<right-1&&(w.yMin+w.yMax)/2>=centro-metade&&(w.yMin+w.yMax)/2<centro+metade-1)
          drePdf={pagina:i+1,texto:normalizar(words.sort((a,b)=>Math.abs(a.yMin-b.yMin)<1?a.xMin-b.xMin:a.yMin-b.yMin).map(w=>w.text).join(' ')),left,right}
          if(drePdf.texto!==esperado)falhas.push(`PDF DRE realista: ${drePdf.texto}; esperado ${esperado}`)
          break
        }
        if(!drePdf)falhas.push('Instrumento não localizou a linha DRE no PDF')
      }
      execFileSync(join(poppler,'pdftoppm'),['-scale-to','1600','-png',prefixo+'.pdf',prefixo])
      recibo.casos.push({nome,nivel,esperado,dom,paginas:paginas.length,paginasAviso,drePdf,falhas})
      console.log(JSON.stringify({nome,nivel,paginas:paginas.length,falhas}))
    }
  }
  process.exitCode=recibo.casos.some(c=>c.falhas.length)?1:0
}catch(e){recibo.erroInstrumento=e.stack;process.exitCode=2;console.error(e)}
finally{if(browser)await browser.close();if(servidor)await servidor.close();writeFileSync(join(saida,'resultado.json'),JSON.stringify(recibo,null,2))}
