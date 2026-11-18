// A tabela antigo × novo da régua do centavo, para o Marco aprovar ANTES do
// commit (princípio 8). Compara as fotografias de golden.test.js da base
// (por padrão `git show origin/main:src/lib/golden.test.js` — NUNCA a `main`
// local, que num workspace do Conductor pode estar semanas atrás) com o motor da árvore
// de trabalho. Uso, na raiz do repositório:
//   node scripts/provas-centavos/diff-aprovacao.mjs            (base = origin/main)
//   node scripts/provas-centavos/diff-aprovacao.mjs <arquivo>  (golden antigo num arquivo)
// Saída: tabela em Markdown, uma linha por número que muda; no fim, a contagem.
// Sai 2 se não conseguir ler a fotografia antiga.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computeCenarios } from '../../src/lib/calc.js'
import { resultadoRealizado } from '../../src/lib/fechamento.js'
import { fmtBRL, fmtPct } from '../../src/lib/format.js'

let fonte
try {
  fonte = process.argv[2]
    ? readFileSync(process.argv[2], 'utf8')
    : execSync('git show origin/main:src/lib/golden.test.js', { encoding: 'utf8', maxBuffer: 1 << 24 })
} catch (e) {
  console.error('não consegui ler a fotografia antiga:', e.message)
  process.exit(2)
}
const ctx = { describe() {}, it() {}, expect() {} }
vm.runInNewContext(
  fonte.replace(/^import .*$/gm, '') +
    ';this.d={eventoGolden,GOLDEN,GOLDEN_DESCONTO_12,IMPOSTO_6,GOLDEN_IMPOSTO_6,GOLDEN_FECHAMENTO,eventoP8,GOLDEN_P8,CAMPOS_P8};',
  ctx
)
const d = ctx.d
const NOME = {
  bruta: 'Receita bruta bilheteria', taxa: 'Taxa da bilheteria', cashback: 'Cashback Tiqueteira',
  liquida: 'Receita líquida bilheteria', receitaTotal: 'Receita total', contingencia: 'Contingência',
  custoTotal: 'Custo total', lucro: 'Lucro', margem: 'Margem', custoPorPessoa: 'Custo por pessoa',
  ticketMedioLiquido: 'Ticket médio líquido', ticketMedio: 'Ticket médio', valor: 'Imposto (R$)',
  resultado: 'Resultado do fechamento', receita: 'Receita (estimada)', lucroDoCenario: 'Lucro do cenário (ponte)',
  contingenciaDoCenario: 'Contingência do cenário (ponte)', reservaDoCenario: 'Reserva do cenário (ponte)',
  diferencaParaCenario: 'Diferença para o cenário (ponte)', desvioDeReceita: 'Desvio de receita (ponte)',
}
const POR_UNIDADE = new Set(['margem', 'custoPorPessoa', 'ticketMedioLiquido', 'ticketMedio'])
const reais = (v) => fmtBRL(v).replace(/\s/g, ' ')
const cent = (v) => fmtBRL(v, 2).replace(/\s/g, ' ')
const linhas = []
function diff(novo, velho, foto, caminho = '') {
  if (Object.is(novo, velho)) return
  if (novo && velho && typeof novo === 'object' && typeof velho === 'object') {
    for (const k of new Set([...Object.keys(novo), ...Object.keys(velho)])) diff(novo[k], velho[k], foto, caminho ? `${caminho}.${k}` : k)
    return
  }
  const campo = caminho.split('.').pop()
  const pct = campo === 'margem'
  const fmtR = (v) => (typeof v !== 'number' ? String(v) : pct ? fmtPct(v) : POR_UNIDADE.has(campo) ? cent(v) : reais(v))
  const fmtC = (v) => (typeof v !== 'number' ? String(v) : pct ? fmtPct(v, 4) : cent(v))
  linhas.push([
    foto,
    caminho,
    NOME[campo] || campo,
    velho,
    novo,
    typeof novo === 'number' && typeof velho === 'number' ? (novo - velho).toFixed(4).replace('.', ',') : '',
    fmtR(velho) === fmtR(novo) ? 'igual' : `${fmtR(velho)} → ${fmtR(novo)}`,
    fmtC(velho) === fmtC(novo) ? 'igual' : `${fmtC(velho)} → ${fmtC(novo)}`,
  ])
}
diff(computeCenarios(d.eventoGolden()), d.GOLDEN, 'GOLDEN')
diff(computeCenarios({ ...d.eventoGolden(), descontoMedioPct: 12 }), d.GOLDEN_DESCONTO_12, 'GOLDEN_DESCONTO_12')
{
  const c = computeCenarios({ ...d.eventoGolden(), ...d.IMPOSTO_6 })
  for (const k of ['pessimista', 'realista', 'otimista'])
    diff(Object.fromEntries(Object.keys(d.GOLDEN_IMPOSTO_6[k]).map((f) => [f, c[k][f]])), d.GOLDEN_IMPOSTO_6[k], 'GOLDEN_IMPOSTO_6', k)
}
const fechado = { ...d.eventoGolden(), receitaRealizada: { bilheteria: 95000, bar: 38000 } }
diff(resultadoRealizado(fechado, computeCenarios(fechado).realista), d.GOLDEN_FECHAMENTO, 'GOLDEN_FECHAMENTO')
{
  const c = computeCenarios(d.eventoP8())
  diff(
    Object.fromEntries(['pessimista', 'realista', 'otimista'].map((k) => [k, Object.fromEntries(d.CAMPOS_P8.map((f) => [f, c[k][f]]))])),
    d.GOLDEN_P8,
    'GOLDEN_P8'
  )
}
console.log('| Fotografia | Onde | Linha | Antes (cru) | Depois | Diferença (R$) | Tela em reais | Tela com centavos |')
console.log('|---|---|---|---|---|---|---|---|')
for (const l of linhas) console.log(`| ${l.join(' | ')} |`)
const mudaReais = linhas.filter((l) => l[6] !== 'igual').length
const mudaCent = linhas.filter((l) => l[7] !== 'igual').length
const minimo = linhas.filter((l) => /breakEven/.test(l[1])).length
console.log(`\n${linhas.length} números mudam; ${mudaReais} mudam o que a tela imprime em reais; ${mudaCent} mudam o que sai com centavos; ${minimo} mínimos de ingressos mudam.`)
