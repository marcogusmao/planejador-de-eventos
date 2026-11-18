// Recibo de mutação da S7/P8: reintroduz cada pedaço do defeito EM MEMÓRIA e
// exige vermelho. Nenhum arquivo do app é editado: a troca acontece num plugin
// de transformação do Vite dentro do Vitest, então não há o que restaurar e o
// trabalho não commitado fica intacto. Uso (na raiz do repositório):
//   ~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs [ID ...]       (sem ID = todas)
//   ~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs --cego          (controle do instrumento: tem de sair 2)
//   ~/bin/fila node scripts/provas-s7/mutacoes-p8.mjs --so-golden M1 M2 M3 M4  (informativo: tem de sair 1)
// Saída: 0 = controle verde e toda mutação derrubou >= 1 teste; 1 = alguma
// sobreviveu; 2 = instrumento cego (trecho não achado exatamente 1 vez, módulo
// não carregado, arquivo que não carrega, ou controle vermelho).
import { startVitest } from 'vitest/node'

const GOLDEN = 'src/lib/golden.test.js'
const CALC_P8 = 'src/lib/calc.p8.test.js'
const S7_JSX = 'src/components/loteSemPreco.s7.test.jsx'
const LSP = 'src/lib/loteSemPreco.test.js'
const PLANILHA = 'src/components/planilhaSemPreco.s7.test.jsx'
// Revisão adversarial da S7 (06/10/2026): superfícies sem aviso, P3, caso misto
// da trava, separador das observações, resumo do rascunho e Apresentação.
const REV = 'src/components/loteSemPreco.revisao.s7.test.jsx'
// P4 (Marco, 06/10/2026): zero escrito como texto no backup vira 0, não ''.
const P4 = 'src/lib/migracao.p4.test.js'

const DE_M0 = "lote.valor === '' || lote.valor === null || lote.valor === undefined"
const DE_U15 = 'lotesSemPreco: textoCensoLotesSemPreco(censoLotesSemPreco(backup.eventos))'

const MUTACOES = [
  { id: 'M0', arquivo: 'src/lib/calc.js', de: DE_M0, para: 'false', testes: [GOLDEN, CALC_P8] },
  {
    id: 'M1',
    arquivo: 'src/lib/calc.js',
    de: 'export const isCortesia = (lote) => !isPrecoAusente(lote) && num(lote.valor) === 0',
    para: 'export const isCortesia = (lote) => num(lote.valor) === 0',
    testes: [CALC_P8],
  },
  { id: 'M2', arquivo: 'src/lib/calc.js', de: '  if (isPrecoAusente(lote)) return 0\n', para: '', testes: [CALC_P8] },
  {
    id: 'M3',
    arquivo: 'src/lib/calc.js',
    de: 'const qtd = isPrecoAusente(l) ? 0 : num(qtds[l.id])',
    para: 'const qtd = num(qtds[l.id])',
    testes: [CALC_P8],
  },
  { id: 'M4', arquivo: 'src/lib/calc.js', de: '    if (isPrecoAusente(l)) continue\n', para: '', testes: [CALC_P8] },
  { id: 'M5', arquivo: 'src/lib/calc.js', de: DE_M0, para: "lote.valor === '' || lote.valor === undefined", testes: [GOLDEN, CALC_P8] },
  { id: 'M6', arquivo: 'src/lib/calc.js', de: DE_M0, para: "lote.valor === '' || lote.valor === null", testes: [GOLDEN, CALC_P8] },
  { id: 'M7', arquivo: 'src/lib/calc.js', de: DE_M0, para: DE_M0 + ' || num(lote.valor) === 0', testes: [GOLDEN, CALC_P8] },
  { id: 'U1', arquivo: 'src/components/RevenueTab.jsx', de: '{l.avisaSemPreco && (', para: '{false && (', testes: [S7_JSX] },
  {
    id: 'U2',
    arquivo: 'src/components/RevenueTab.jsx',
    de: 'linhas.filter((l) => !l.fora && !l.semPreco)',
    para: 'linhas.filter((l) => !l.fora)',
    testes: [S7_JSX],
  },
  {
    id: 'U3',
    arquivo: 'src/components/RevenueTab.jsx',
    de: "{isCortesia(l) || l.semPreco ? '—' : fmtBRL2(precoEfetivoLote(l.valor, efetivoR))}",
    para: "{isCortesia(l) ? '—' : fmtBRL2(precoEfetivoLote(l.valor, efetivoR))}",
    testes: [S7_JSX],
  },
  {
    id: 'U4',
    arquivo: 'src/components/RevenueTab.jsx',
    de: '<AvisoLoteSemPreco evento={evento} naReceita className="mb-3" />',
    para: '',
    testes: [S7_JSX],
  },
  {
    id: 'U5',
    arquivo: 'src/components/RevenueTab.jsx',
    de: "{l.fora || l.semPreco ? '—' : fmtBRL(l.receita)}",
    para: "{l.fora ? '—' : fmtBRL(l.receita)}",
    testes: [S7_JSX],
  },
  {
    id: 'U6',
    arquivo: 'src/components/ScenariosTab.jsx',
    de: 'const avisoSemPreco = textoCurtoLotesSemPreco(evento)',
    para: 'const avisoSemPreco = null',
    testes: [S7_JSX],
  },
  { id: 'U7', arquivo: 'src/components/ScenariosTab.jsx', de: '>{ROTULO_AJUSTE_SEM_PRECO}</span>', para: '></span>', testes: [S7_JSX] },
  {
    id: 'U8',
    arquivo: 'src/components/ReportView.jsx',
    de: '<AvisoLoteSemPreco evento={evento} variante="papel" className="mb-6" />',
    para: '',
    testes: [S7_JSX],
  },
  { id: 'U9', arquivo: 'src/components/ReportView.jsx', de: 'isPrecoAusente(l) ? PRECO_AUSENTE_TEXTO : ', para: '', testes: [S7_JSX] },
  {
    id: 'U10',
    arquivo: 'src/components/ReportView.jsx',
    de: 'if (isPrecoAusente(lote) || isCortesia(lote) || lote.somenteOtimista) return false',
    para: 'if (isCortesia(lote) || lote.somenteOtimista) return false',
    testes: [S7_JSX],
  },
  { id: 'U11', arquivo: 'src/components/ReportView.jsx', de: '{l.somenteOtimista || isPrecoAusente(l)', para: '{l.somenteOtimista', testes: [S7_JSX] },
  {
    id: 'U12',
    arquivo: 'src/components/PresentationMode.jsx',
    de: '<AvisoLoteSemPreco evento={eventoView} variante="apresentacao" className="mb-6" />',
    para: '',
    testes: [S7_JSX],
  },
  { id: 'U13', arquivo: 'src/lib/resumo.js', de: 'return t ? `⚠️ ${t}` : null', para: 'return null', testes: [LSP] },
  {
    id: 'U14',
    arquivo: 'src/lib/storage.js',
    de: 'if (extras.lotesSemPreco) partes.push(extras.lotesSemPreco)',
    para: '',
    testes: [LSP, S7_JSX],
  },
  { id: 'U15', arquivo: 'src/components/ImportModal.jsx', de: DE_U15, para: "lotesSemPreco: ''", testes: [S7_JSX] },
  { id: 'U16', arquivo: 'src/components/Ajustes.jsx', de: DE_U15, para: "lotesSemPreco: ''", testes: [S7_JSX] },
  // P2 = (A) (Marco, 06/10/2026): célula de preço vazia na planilha = lote sem preço.
  {
    id: 'P2A',
    arquivo: 'src/lib/xlsxImport.js',
    de: "const valor = precoVazio ? '' : parseMoney(celulaPreco)",
    para: 'const valor = parseMoney(celulaPreco)',
    testes: [PLANILHA],
  },
  {
    id: 'P2B',
    arquivo: 'src/components/ImportModal.jsx',
    // depois da revisão adversarial as observações viraram uma lista unida por " · "
    de: "l.valor === '' ? 'sem preço na planilha — fica fora do público e do bar até ter preço' : '',",
    para: "'',",
    testes: [PLANILHA],
  },
  {
    id: 'P2C',
    arquivo: 'src/components/ImportModal.jsx',
    de: "{l.valor === '' ? PRECO_AUSENTE_TEXTO : fmtBRL2(l.valor)}",
    para: '{fmtBRL2(l.valor)}',
    testes: [PLANILHA],
  },
  {
    id: 'Q1A',
    arquivo: 'src/lib/breakEvenTexto.js',
    de: '    if (isPrecoAusente(lote)) return false\n',
    para: '',
    testes: [S7_JSX, LSP],
  },
  // ——— revisão adversarial (06/10/2026): cada conserto desfeito sozinho
  { id: 'R1a', arquivo: 'src/components/Veredito.jsx', de: '<NotaLoteSemPreco evento={evento} className="mt-3" />', para: '', testes: [REV] },
  { id: 'R1b', arquivo: 'src/components/FechamentoTab.jsx', de: '{!fechado && <AvisoLoteSemPreco evento={evento} />}', para: '', testes: [REV] },
  {
    id: 'R1b2',
    arquivo: 'src/components/FechamentoTab.jsx',
    de: '{!fechado && <AvisoLoteSemPreco evento={evento} />}',
    para: '<AvisoLoteSemPreco evento={evento} />',
    testes: [REV],
  },
  {
    id: 'R1c',
    arquivo: 'src/components/Home.jsx',
    de: '{!real && !quebrado && <NotaLoteSemPreco evento={evento} className="mt-2" />}',
    para: '',
    testes: [REV],
  },
  { id: 'R1d', arquivo: 'src/components/CostsTab.jsx', de: '{pp && publicoPrev > 0 && (', para: '{false && (', testes: [REV] },
  { id: 'R1d2', arquivo: 'src/components/CostsTab.jsx', de: '{pp && publicoPrev > 0 && (', para: '{publicoPrev > 0 && (', testes: [REV] },
  { id: 'R1e', arquivo: 'src/components/RitmoVendas.jsx', de: '<NotaLoteSemPreco evento={evento} className="mt-2" />', para: '', testes: [REV] },
  { id: 'R1f', arquivo: 'src/components/CurvaVendas.jsx', de: '<NotaLoteSemPreco evento={evento} className="mt-1" />', para: '', testes: [REV] },
  {
    id: 'R2',
    arquivo: 'src/lib/xlsxImport.js',
    de: "celulaPreco.trim().replace(/^R\\$/i, '').trim() === ''",
    para: "celulaPreco.trim() === ''",
    testes: [PLANILHA],
  },
  {
    // a mutação que o item 3 pede: desligar a trava sempre que houver lote
    // sem preço ajustado, mesmo com outro lote (com preço) fixado à mão
    id: 'R3',
    arquivo: 'src/lib/breakEvenTexto.js',
    de: 'export function temQuantidadeTravada(evento, cenario) {\n',
    para:
      'export function temQuantidadeTravada(evento, cenario) {\n' +
      "  if ((evento?.lotes || []).some(l => isPrecoAusente(l) && evento.cenariosConfig?.overrides?.[cenario]?.[l.id] != null)) return false\n",
    testes: [REV],
  },
  { id: 'R4', arquivo: 'src/components/ImportModal.jsx', de: ".join(' · ')}", para: ".join('')}", testes: [PLANILHA] },
  {
    id: 'R5',
    arquivo: 'src/lib/simulacaoRascunho.js',
    de: 'const naoConta = lote && isPrecoAusente(lote) ? ` (${ROTULO_AJUSTE_SEM_PRECO})` : \'\'',
    para: "const naoConta = ''",
    testes: [REV],
  },
  {
    id: 'R6',
    arquivo: 'src/components/PresentationMode.jsx',
    de: '<AvisoLoteSemPreco evento={eventoView} variante="apresentacao"',
    para: '<AvisoLoteSemPreco evento={evento} variante="apresentacao"',
    testes: [REV],
  },
  // ——— P4 (06/10/2026): zero escrito no backup
  {
    id: 'P4A',
    arquivo: 'src/lib/migracao.js',
    de: 'valor: precoDeLoteOuVazio(l.valor),',
    para: 'valor: naoNegativoOuVazio(l.valor),',
    testes: [P4],
  },
  {
    id: 'P4B',
    arquivo: 'src/lib/migracao.js',
    de: 'precisaAvisoNumerico(l.valor, precoDeLoteOuVazio)',
    para: 'precisaAvisoNumerico(l.valor, naoNegativoOuVazio)',
    testes: [P4],
  },
  {
    // o atalho oposto: todo texto vira cortesia, inclusive o ilegível
    id: 'P4C',
    arquivo: 'src/lib/migracao.js',
    de: "typeof v === 'string' && ZERO_ESCRITO.test(v.trim())",
    para: "typeof v === 'string' && v.trim() !== '' && !/^\\d/.test(v.trim())",
    testes: [P4],
  },
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
    name: 'mutacao-p8',
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
const soGolden = args.includes('--so-golden')
const ids = args.filter((a) => !a.startsWith('--'))

let escolhidas
if (cego) {
  escolhidas = [{ id: 'CEGO', arquivo: 'src/lib/calc.js', de: 'trecho que nao existe', para: 'x', testes: [GOLDEN] }]
} else {
  const desconhecidos = ids.filter((id) => !MUTACOES.some((m) => m.id === id))
  if (desconhecidos.length) {
    console.error(`mutação desconhecida: ${desconhecidos.join(', ')}`)
    process.exit(2)
  }
  escolhidas = ids.length ? MUTACOES.filter((m) => ids.includes(m.id)) : MUTACOES
  if (soGolden) escolhidas = escolhidas.map((m) => ({ ...m, testes: [GOLDEN] }))
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
