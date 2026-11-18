// Recibo de mutação da régua do centavo: reintroduz cada pedaço do defeito EM
// MEMÓRIA (plugin de transformação do Vite dentro do Vitest — nenhum arquivo do
// app é editado) e exige vermelho. Mesmo corredor de scripts/provas-s7/mutacoes-p8.mjs.
// Uso, na raiz do repositório:
//   ~/bin/fila node scripts/provas-centavos/mutacoes-centavos.mjs [ID ...]   (sem ID = todas)
//   ~/bin/fila node scripts/provas-centavos/mutacoes-centavos.mjs --cego     (controle do instrumento: tem de sair 2)
// Saída: 0 = controle verde e toda mutação derrubou >= 1 teste; 1 = alguma
// sobreviveu; 2 = instrumento cego (trecho não achado exatamente 1 vez,
// arquivo que não carrega, ou controle vermelho).
import { startVitest } from 'vitest/node'

const CENT = 'src/lib/dinheiroEmCentavos.test.js'
const UTIL = 'src/lib/util.test.js'
const GOLDEN = 'src/lib/golden.test.js'
const RETRATO = 'src/lib/marcacaoZerado.evidencia.test.js'
const CARD = 'src/components/colunaDoCardFecha.evidencia.test.jsx'
const COMP = 'src/lib/comparacaoCustos.test.js'
const DRE_TELA = 'src/components/dreQueFecha.evidencia.test.jsx'
const CARTAO = 'src/components/cartaoLucroIgualDRE.evidencia.test.jsx'
const PLANO = 'src/lib/planoFinanceiro.test.js'
const ABSURDO = ['src/components/receitaQuebrada.test.jsx', 'src/components/dadoQuebradoNaoContamina.test.jsx']

const MUTACOES = [
  { id: 'C1', arquivo: 'src/lib/receitaLiquida.js', de: 'const taxa = emCentavos((b * num(taxaPct)) / 100)', para: 'const taxa = (b * num(taxaPct)) / 100', testes: [CENT, GOLDEN, CARD] },
  { id: 'C2', arquivo: 'src/lib/receitaLiquida.js', de: 'const cashback = emCentavos((b * num(cashbackPct)) / 100)', para: 'const cashback = (b * num(cashbackPct)) / 100', testes: [CENT, GOLDEN, CARD] },
  { id: 'C3', arquivo: 'src/lib/receitaLiquida.js', de: 'const liquida = taxaCliente ? somaEmCentavos([b, cashback]) : somaEmCentavos([b, -taxa, cashback])', para: 'const liquida = taxaCliente ? b + cashback : b - taxa + cashback', testes: [CENT, GOLDEN] },
  { id: 'C4', arquivo: 'src/lib/calc.js', de: 'const receita = emCentavos(qtd * num(l.valor) * fatorDesconto)', para: 'const receita = qtd * num(l.valor) * fatorDesconto', testes: [CENT, GOLDEN] },
  { id: 'C5', arquivo: 'src/lib/calc.js', de: 'const receitaTotal = somaEmCentavos([bil.liquida, bar, patrocinio])', para: 'const receitaTotal = bil.liquida + bar + patrocinio', testes: [CENT, GOLDEN] },
  { id: 'C6', arquivo: 'src/lib/calc.js', de: 'const lucro = somaEmCentavos([receitaTotal, -imposto, -custoTotal])', para: 'const lucro = receitaTotal - imposto - custoTotal', testes: [CENT, GOLDEN, RETRATO] },
  { id: 'C7', arquivo: 'src/lib/calc.js', de: 'export const contingencia = (base, pct) => emCentavos((num(base) * num(pct)) / 100)', para: 'export const contingencia = (base, pct) => (num(base) * num(pct)) / 100', testes: [CENT, GOLDEN] },
  { id: 'C8', arquivo: 'src/lib/calc.js', de: '? somaEmCentavos([custoBase, emCentavos((custoBase * ajustePct) / 100)])', para: '? emCentavos(custoBase * (1 + ajustePct / 100))', testes: [GOLDEN] },
  { id: 'C9', arquivo: 'src/lib/calc.js', de: 'const taxaSistema = emCentavos((consumo * taxaPct) / 100)', para: 'const taxaSistema = (consumo * taxaPct) / 100', testes: [CENT] },
  { id: 'C10', arquivo: 'src/lib/calc.js', de: 'const fechado = somaEmCentavos(fechados)', para: 'const fechado = fechados.reduce((s, v) => s + v, 0)', testes: [CENT] },
  { id: 'C11', arquivo: 'src/lib/calc.js', de: 'const { bruta, taxa, cashback, liquida } = liquidaDeBruta(bil.pagos * tm, evento.taxaBilheteria, evento.cashbackPct, taxaCliente)', para: 'const bruta = bil.pagos * tm; const taxa = (bruta * num(evento.taxaBilheteria)) / 100; const cashback = (bruta * num(evento.cashbackPct)) / 100; const liquida = taxaCliente ? bruta + cashback : bruta - taxa + cashback', testes: [CENT, GOLDEN] },
  { id: 'C12', arquivo: 'src/lib/imposto.js', de: 'valor: emCentavos((base * aliquota) / 100),', para: 'valor: (base * aliquota) / 100,', testes: [CENT, GOLDEN] },
  { id: 'C13', arquivo: 'src/lib/dre.js', de: 'somaEmCentavos([num(c?.custoTotal), -somaEmCentavos([num(c?.custoItens), num(c?.contingencia)])])', para: 'num(c?.custoTotal) - (num(c?.custoItens) + num(c?.contingencia))', testes: [CENT] },
  { id: 'C14', arquivo: 'src/lib/fechamento.js', de: 'const receita = somaEmCentavos([bil.liquida, bar, pat.fechado, pix])', para: 'const receita = bil.liquida + bar + pat.fechado + pix', testes: [CENT, GOLDEN] },
  { id: 'C15', arquivo: 'src/lib/fechamento.js', de: 'const resultado = somaEmCentavos([receita, -imposto, -custos])', para: 'const resultado = receita - imposto - custos', testes: [CENT, GOLDEN] },
  { id: 'C16', arquivo: 'src/lib/fechamento.js', de: '      ? somaEmCentavos([\n          resultado,', para: '      ? (resultado - cenarioRealista.lucro - (cenarioRealista.custoTotal - custos) + (imposto - impostoEstimado)) + 0 * somaEmCentavos([\n          resultado,', testes: [CENT, GOLDEN] },
  { id: 'U1', arquivo: 'src/lib/util.js', de: '  const r = Math.round(a + (a < 1e9 ? a * 1e-14 : 1e-5))', para: '  const r = Math.round(a)', testes: [UTIL] },
  { id: 'U2', arquivo: 'src/lib/util.js', de: '  const a = centavos < 0 ? -centavos : centavos\n  const r = Math.round(a + (a < 1e9 ? a * 1e-14 : 1e-5))\n  return (centavos < 0 ? -r : r) + 0', para: '  return Math.round(centavos) + 0', testes: [UTIL, GOLDEN] },
  { id: 'U3', arquivo: 'src/lib/util.js', de: "typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < LIMITE_CENTAVO_EXATO", para: "typeof v === 'number'", testes: [UTIL, ...ABSURDO] },
  { id: 'U4', arquivo: 'src/lib/util.js', de: '(valores || []).reduce((s, v) => s + arredondarCentavos(num(v) * 100), 0) / 100', para: '(valores || []).reduce((s, v) => s + Math.round(num(v) * 100), 0) / 100', testes: [UTIL] },
  { id: 'T1', arquivo: 'src/lib/comparacaoCustos.js', de: 'const ajusteExibido = arredondadoComoAMoeda(ajusteValor) + 0', para: 'const ajusteExibido = Math.round(ajusteValor) + 0', testes: [COMP] },
  { id: 'D1', arquivo: 'src/components/ScenariosTab.jsx', de: "get: (c) => fmtBRL2(c.receitaTotal), raw: (c) => c.receitaTotal, strong: true", para: "get: (c) => fmtBRL(c.receitaTotal), raw: (c) => c.receitaTotal, strong: true", testes: [DRE_TELA] },
  { id: 'D2', arquivo: 'src/components/ReportView.jsx', de: "['Receita total', (s) => fmtBRL2(s.receitaTotal), true],", para: "['Receita total', (s) => fmtBRL(s.receitaTotal), true],", testes: [DRE_TELA] },
  { id: 'D3', arquivo: 'src/components/ScenariosTab.jsx', de: "{ label: 'Receita líquida bilheteria', get: (c) => fmtBRL2(c.liquida), raw: (c) => c.liquida },", para: "{ label: 'Receita líquida bilheteria', get: (c) => fmtBRL(c.liquida), raw: (c) => c.liquida },", testes: [DRE_TELA] },
  { id: 'D4', arquivo: 'src/lib/dre.js', de: 'return `${sinal} ${fmtBRL2(Math.abs(v))}${pctTxt}`', para: 'return `${sinal} ${fmtBRL2(Math.round(Math.abs(v)))}${pctTxt}`', testes: [DRE_TELA] },
  { id: 'D5', arquivo: 'src/components/RevenueTab.jsx', de: '            {fmtBRL2(r.receitaTotal)}', para: '            {fmtBRL(r.receitaTotal)}', testes: [DRE_TELA] },
  // P5 (Marco, 07/10/2026): o CSV do plano arredonda com a régua do motor.
  { id: 'E1', arquivo: 'src/lib/planoFinanceiro.js', de: 'String(cabeEmCentavos(n) ? emCentavos(n) : Math.round(n * 100) / 100)', para: 'String(Math.round(n * 100) / 100)', testes: [PLANO] },
  // P6 refeito (Marco, 07/10/2026): o cartão mostra centavos, como o DRE. Cada
  // mutação devolve UMA linha do cartão aos reais inteiros: a do lucro rompe o
  // "cartão = DRE"; as de receita, imposto e custo rompem "o cartão fecha".
  { id: 'F1', arquivo: 'src/components/ScenariosTab.jsx', de: '{fmtBRL2(c.lucro)}', para: '{fmtBRL(c.lucro)}', testes: [CARTAO] },
  { id: 'F2', arquivo: 'src/components/ScenariosTab.jsx', de: "['Receita total', txt(recQ, fmtBRL2(c.receitaTotal))],", para: "['Receita total', txt(recQ, fmtBRL(c.receitaTotal))],", testes: [CARTAO] },
  { id: 'F3', arquivo: 'src/components/ScenariosTab.jsx', de: '[IMPOSTO_LABEL, txt(recQ, `− ${fmtBRL2(impostoValor(c))}`)]', para: '[IMPOSTO_LABEL, txt(recQ, `− ${fmtBRL(impostoValor(c))}`)]', testes: [CARTAO] },
  { id: 'F4', arquivo: 'src/components/ScenariosTab.jsx', de: "['Custo total', fmtBRL2(c.custoTotal)],", para: "['Custo total', fmtBRL(c.custoTotal)],", testes: [CARTAO] },
  { id: 'F5', arquivo: 'src/components/ReportView.jsx', de: '                      {fmtBRL2(s.lucro)}', para: '                      {fmtBRL(s.lucro)}', testes: [CARTAO] },
  { id: 'F6', arquivo: 'src/components/ReportView.jsx', de: "['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.receitaTotal)],", para: "['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL(s.receitaTotal)],", testes: [CARTAO] },
  { id: 'F7', arquivo: 'src/components/ReportView.jsx', de: "['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL2(impostoValor(s))}`]", para: "['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL(impostoValor(s))}`]", testes: [CARTAO] },
  { id: 'F8', arquivo: 'src/components/ReportView.jsx', de: "['Custo', fmtBRL2(s.custoTotal)],", para: "['Custo', fmtBRL(s.custoTotal)],", testes: [CARTAO] },
  { id: 'F9', arquivo: 'src/components/PresentationMode.jsx', de: '                        {fmtBRL2(s.lucro)}', para: '                        {fmtBRL(s.lucro)}', testes: [CARTAO] },
  { id: 'F10', arquivo: 'src/components/PresentationMode.jsx', de: "['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL2(s.receitaTotal)],", para: "['Receita', recQuebrada(s) ? NUMERO_NAO_CALCULA : fmtBRL(s.receitaTotal)],", testes: [CARTAO] },
  { id: 'F11', arquivo: 'src/components/PresentationMode.jsx', de: "['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL2(impostoValor(s))}`]", para: "['Imposto', recQuebrada(s) ? NUMERO_NAO_CALCULA : `− ${fmtBRL(impostoValor(s))}`]", testes: [CARTAO] },
  { id: 'F12', arquivo: 'src/components/PresentationMode.jsx', de: "['Custo', fmtBRL2(s.custoTotal)],", para: "['Custo', fmtBRL(s.custoTotal)],", testes: [CARTAO] },
]

const coletar = (tarefas, saida = []) => {
  for (const t of tarefas || []) {
    if (t.type === 'test') saida.push(t)
    if (t.tasks) coletar(t.tasks, saida)
  }
  return saida
}

// Repórter mudo: o resultado sai do estado do Vitest, não do terminal.
const MUDO = { onInit() {} }

async function rodar(testes, m) {
  let aplicacoes = 0
  const alvo = m ? `${process.cwd()}/${m.arquivo}` : null
  const plugin = {
    name: 'mutacao-centavos',
    enforce: 'pre',
    transform(code, id) {
      if (!m || id.split('?')[0] !== alvo) return null
      const n = code.split(m.de).length - 1
      if (n !== 1) throw new Error(`instrumento cego: trecho aparece ${n} vezes em ${m.arquivo}`)
      aplicacoes++
      return { code: code.replace(m.de, () => m.para), map: null }
    },
  }
  const v = await startVitest(
    'test',
    testes,
    { run: true, watch: false, reporters: [MUDO], silent: true },
    { plugins: [plugin] }
  )
  const arquivos = v.state.getFiles()
  const casos = arquivos.flatMap((f) => coletar(f.tasks))
  const errosDeArquivo = arquivos
    .filter((f) => f.result?.state === 'fail' && !coletar(f.tasks).some((t) => t.result?.state === 'fail'))
    .map((f) => f.name)
  const naoCarregados = testes.filter((t) => !arquivos.some((f) => f.filepath?.endsWith(t) || f.name === t))
  await v.close()
  return {
    aplicacoes,
    total: casos.length,
    vermelhos: casos.filter((t) => t.result?.state === 'fail').map((t) => t.name),
    errosDeArquivo: [...errosDeArquivo, ...naoCarregados.map((t) => `${t} (não carregado)`)],
  }
}

const args = process.argv.slice(2)
const cego = args.includes('--cego')
const ids = args.filter((a) => !a.startsWith('--'))

let escolhidas
if (cego) {
  escolhidas = [{ id: 'CEGO', arquivo: 'src/lib/calc.js', de: 'trecho que nao existe', para: 'x', testes: [CENT] }]
} else {
  const desconhecidos = ids.filter((id) => !MUTACOES.some((m) => m.id === id))
  if (desconhecidos.length) {
    console.error(`mutação desconhecida: ${desconhecidos.join(', ')}`)
    process.exit(2)
  }
  escolhidas = ids.length ? MUTACOES.filter((m) => ids.includes(m.id)) : MUTACOES
}

let saida = 0
const uniao = [...new Set(escolhidas.flatMap((m) => m.testes))]
const ctl = await rodar(uniao, null)
console.log(`CONTROLE  ${ctl.total} testes, ${ctl.vermelhos.length} vermelhos, ${ctl.errosDeArquivo.length} arquivos com erro (${uniao.join(', ')})`)
if (ctl.total === 0 || ctl.vermelhos.length > 0 || ctl.errosDeArquivo.length > 0) {
  console.log(`  controle não está verde: ${[...ctl.vermelhos, ...ctl.errosDeArquivo].slice(0, 5).join(' | ')}`)
  process.exitCode = 2
} else {
  for (const m of escolhidas) {
    let r
    try {
      r = await rodar(m.testes, m)
    } catch (err) {
      r = { aplicacoes: 0, total: 0, vermelhos: [], errosDeArquivo: [String(err?.message || err)] }
    }
    let estado
    if (r.aplicacoes === 0 || r.errosDeArquivo.length > 0) {
      estado = 'ERRO'
      saida = 2
    } else if (r.vermelhos.length === 0) {
      estado = 'SOBREVIVEU'
      if (saida === 0) saida = 1
    } else estado = 'MORTA'
    const detalhe =
      estado === 'ERRO'
        ? `aplicada ${r.aplicacoes}x; ${r.errosDeArquivo.slice(0, 2).join(' | ')}`
        : r.vermelhos.slice(0, 3).join(' | ')
    console.log(`${m.id.padEnd(4)} ${estado.padEnd(10)} ${String(r.vermelhos.length).padStart(3)} de ${r.total}  ${m.arquivo}  ${detalhe}`)
  }
  process.exitCode = saida
}
