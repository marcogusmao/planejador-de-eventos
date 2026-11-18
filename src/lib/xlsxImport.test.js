import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { montarRevisaoPlanilha, montarDadosImportPlanilha } from './revisaoImportPlanilha.js'
import {
  parseMoney,
  mapStatus,
  detectarSecao,
  parseAOA,
  parseWorkbookData,
  ehLotePorta,
  normalizar,
  limparNaoReconhecidos,
} from './xlsxImport.js'

it('cabeçalho compacto não copia realizado recusado para fornecedor nem para o pacote', () => {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['ESTRUTURA'], ['Serviço', 'Estimado', 'Realizado'], ['Som', 5000, '']])
  ws.C3 = { t: 'e', v: 15 }
  XLSX.utils.book_append_sheet(wb, ws, 'Custos')
  const res = parseWorkbookData(XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'}))
  expect(res.recusasCelulas[0]).toMatchObject({campo: 'realizado', original: '#VALUE!'})
  expect(res.categorias.estrutura[0]).toMatchObject({fornecedor: '', estimado: 5000, realizado: ''})
  const pacote = montarDadosImportPlanilha(montarRevisaoPlanilha(res, 'custos.xlsx'))
  expect(pacote.ok).toBe(true)
  expect(JSON.stringify(pacote.evento)).not.toContain('#VALUE!')
})

it('cabeçalho explícito preserva fornecedor e formato sem cabeçalho mantém posições legadas', () => {
  for (const aoa of [
    [['ESTRUTURA'], ['Serviço', 'Fornecedor', 'Estimado', 'Realizado'], ['Som', 'Fornecedor sintético', 5000, 4200]],
    [['ESTRUTURA'], ['Produção', 'Som', 'Fornecedor sintético', 5000, 'ORÇAR']],
  ]) {
    const res = parseAOA(aoa, {categorias: {}, lotes: [], avisos: []}, 'Custos')
    expect(res.categorias.estrutura[0]).toMatchObject({servico: 'Som', fornecedor: 'Fornecedor sintético', estimado: 5000})
  }
})

describe('parseMoney', () => {
  it('números diretos', () => {
    expect(parseMoney(1500)).toBe(1500)
    expect(parseMoney(1234.56)).toBe(1234.56)
  })
  it('formato pt-BR com R$', () => {
    expect(parseMoney('R$ 2.000,00')).toBe(2000)
    expect(parseMoney('R$ 1.234,56')).toBe(1234.56)
    expect(parseMoney('1.234,5')).toBe(1234.5)
  })
  it('ponto como separador de milhar sem centavos', () => {
    expect(parseMoney('8.000')).toBe(8000)
    expect(parseMoney('1.234.567')).toBe(1234567)
  })
  it('parêntese contábil = negativo (decisão do Marco 20/07/2026)', () => {
    expect(parseMoney('(500)')).toBe(-500)
    expect(parseMoney('(1.234,56)')).toBe(-1234.56)
    expect(parseMoney('R$ (2.500)')).toBe(-2500)
    expect(parseMoney('-500')).toBe(-500)
  })
  it('sinal não alterna e menos unicode conta (achados A2/A3 da verificação hostil)', () => {
    // "(-500)": parêntese E menos, mas o resultado é −500 (não +500) — igual ao py
    expect(parseMoney('(-500)')).toBe(-500)
    expect(parseMoney('(8.000)')).toBe(-8000)
    // menos tipográfico U+2212 (colado de PDF/Excel) conta como negativo
    expect(parseMoney('−500')).toBe(-500)
    expect(parseMoney('−1.234,56')).toBe(-1234.56)
  })
  it('formato americano (vírgula milhar, ponto decimal): "1,234.56"', () => {
    expect(parseMoney('1,234.56')).toBe(1234.56)
  })
  it('vazios e lixo viram 0', () => {
    expect(parseMoney('')).toBe(0)
    expect(parseMoney(null)).toBe(0)
    expect(parseMoney('—')).toBe(0)
  })

  // ── A DECISÃO DO MARCO DE 30/08/2026 (por questionário) ────────────────────
  //
  // "25.000,000" vale R$ 25.000,00. Ponto é milhar, vírgula é decimal, com
  // quantas casas vierem. Até esta data o parser devolvia 25 — mil vezes menos
  // — e o mesmo defeito valia para DIGITAR/COLAR, porque parseCampoNumerico
  // chama este parser.
  //
  // A tabela abaixo é a MEDIÇÃO feita antes de mexer numa linha, não exemplo
  // inventado: sobre 77 strings da forma ^\d{1,3}(\.\d{3})+,\d+$ o parser
  // divergia da leitura brasileira em 42 (54,5%), e sempre por 1000× para baixo.
  it('pt-BR com 3 OU MAIS casas decimais: o ponto é milhar (Marco, 30/08/2026)', () => {
    expect(parseMoney('25.000,000')).toBe(25000) // o caso que o Marco cola
    expect(parseMoney('1.234,500')).toBe(1234.5)
    expect(parseMoney('1.000,000')).toBe(1000)
    expect(parseMoney('12.500,750')).toBe(12500.75)
    expect(parseMoney('1.234.567,890')).toBe(1234567.89)
    // e com tudo o que costuma vir grudado no número
    expect(parseMoney('R$ 25.000,000')).toBe(25000)
    expect(parseMoney('(1.234,500)')).toBe(-1234.5)
    expect(parseMoney('−1.234,500')).toBe(-1234.5)
  })

  it('a OUTRA regra da vírgula não mudou: "1,500" sem ponto segue valendo mil e quinhentos', () => {
    // O Marco foi perguntado com as duas leituras na frente e ficou com as duas
    // convivendo. Sem ponto de milhar não há como saber se a vírgula é decimal
    // ou milhar, e dinheiro de verdade tem 2 casas — a leitura de milhar fica.
    expect(parseMoney('1,500')).toBe(1500)
    expect(parseMoney('1,234')).toBe(1234)
    // O que separa uma regra da outra é o PONTO: com ele, decimal; sem ele, milhar.
    expect(parseMoney('1.500,500')).toBe(1500.5)
  })

  it('o AMERICANO de 3 casas continua americano — a régua nova não o captura', () => {
    // A guarda que uma "simplificação" futura mataria primeiro. O ramo novo só
    // vale quando o ÚLTIMO ponto vem ANTES da última vírgula; aqui vem depois,
    // então "1,234,567.891" segue sendo um milhão e duzentos mil, com 891
    // milésimos — e não 1,234567891. Medido antes e depois do conserto: igual.
    expect(parseMoney('1,234,567.891')).toBe(1234567.891)
    expect(parseMoney('1,234.567')).toBe(1234.567)
    // e os dois com separadores embaralhados também não mudaram de leitura
    expect(parseMoney('12,34.56,78')).toBe(12.345678)
    expect(parseMoney('1.234,56,78')).toBe(1234.5678)
  })

  it('grupo de milhar MAL FORMADO: a leitura pt-BR vale mesmo assim, e é de propósito', () => {
    // A régua não exige grupos de exatamente 3 dígitos, e a escolha tem custo
    // declarado. O ganho: "1234.567,89" (grupo de 4 na frente, que alguns
    // sistemas emitem) é lido como um milhão duzentos e trinta e quatro mil —
    // a leitura certa. O custo: "1.5,000", que não é formato de convenção
    // NENHUMA, passou a valer 15 onde antes valia 1,5. Nenhuma das duas
    // respostas é defensável para essa entrada; é lixo dos dois lados, e ele
    // continua registrado na metade A4 da ficha do BACKLOG.
    expect(parseMoney('1234.567,89')).toBe(1234567.89)
    expect(parseMoney('1.5,000')).toBe(15)
  })

  it('o que NÃO pode mudar: a grade herdada segue inteira', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(parseMoney('1.234,5')).toBe(1234.5)
    expect(parseMoney('8.000')).toBe(8000)
    expect(parseMoney('1.234.567')).toBe(1234567)
    expect(parseMoney('1,234.56')).toBe(1234.56)
    expect(parseMoney('1,234,567.89')).toBe(1234567.89)
    expect(parseMoney('(500)')).toBe(-500)
    expect(parseMoney('−500')).toBe(-500)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('1234.56')).toBe(1234.56)
    expect(parseMoney('9,5')).toBe(9.5)
  })

  // A varredura dos 54,5%, virada em teste. Não é amostra: é TODA string da
  // forma inequívoca que este gerador produz. Se um dia o parser voltar a ler
  // "1.234,500" como 1,2345, este teste diz qual entrada quebrou.
  it('PROPRIEDADE — toda string pt-BR inequívoca bate com a leitura de referência', () => {
    const referencia = (t) => parseFloat(t.replace(/\./g, '').replace(',', '.'))
    const inteiros = ['1.000', '8.000', '12.500', '25.000', '999.999', '1.234.567', '10.000.000']
    const decimais = ['5', '50', '56', '05', '25', '500', '750', '890', '999', '123', '007']
    const divergentes = []
    for (const i of inteiros) {
      for (const d of decimais) {
        const entrada = `${i},${d}`
        // a forma é a que o comentário promete — afirmada, não suposta
        expect(entrada).toMatch(/^\d{1,3}(\.\d{3})+,\d+$/)
        const obtido = parseMoney(entrada)
        const esperado = referencia(entrada)
        if (Math.abs(obtido - esperado) > 1e-9) divergentes.push({ entrada, obtido, esperado })
      }
    }
    expect(inteiros.length * decimais.length).toBe(77)
    expect(divergentes).toEqual([])
  })
})

describe('mapStatus', () => {
  it('normaliza para os status do app', () => {
    // v1 → lista nova via migrarStatusCusto (Marco 21/07): FECHADO→FECHADO,
    // NEGOCIANDO→NEGOCIAR, ORÇAR/ausente→ESTIMADO. PAGO segue PAGO.
    expect(mapStatus('PAGO')).toBe('PAGO')
    expect(mapStatus('pago ✓')).toBe('PAGO')
    expect(mapStatus('Fechado')).toBe('FECHADO')
    expect(mapStatus('negociando')).toBe('NEGOCIAR')
    expect(mapStatus('orçar')).toBe('ESTIMADO')
    expect(mapStatus('')).toBe('ESTIMADO')
    expect(mapStatus(null)).toBe('ESTIMADO')
  })
  it('status das planilhas reais: FINALIZADO → PAGO, FORMALIZAR → NEGOCIAR', () => {
    expect(mapStatus('FINALIZADO')).toBe('PAGO')
    expect(mapStatus('FORMALIZAR ')).toBe('NEGOCIAR')
  })
})

describe('detectarSecao', () => {
  it('reconhece os títulos das planilhas antigas', () => {
    expect(detectarSecao('A&B')).toBe('aeb')
    expect(detectarSecao('LOCAÇÃO E DOCUMENTAÇÃO')).toBe('locacao')
    expect(detectarSecao('ESTRUTURA + CENOGRAFIA')).toBe('estrutura')
    expect(detectarSecao('EQUIPE')).toBe('equipe')
    expect(detectarSecao('ARTISTICO')).toBe('artistico')
    expect(detectarSecao('ARTÍSTICO')).toBe('artistico')
    expect(detectarSecao('MARKETING')).toBe('marketing')
    expect(detectarSecao('EXTRAS')).toBe('extras')
    expect(detectarSecao('qualquer coisa')).toBeNull()
  })
  it('títulos das planilhas reais da Brisa', () => {
    expect(detectarSecao('LOCAÇÃO + STAFF + CMV')).toBe('locacao')
    expect(detectarSecao('A & B')).toBe('aeb')
    expect(detectarSecao('EQUIPE e LOGISTICA')).toBe('equipe')
    expect(detectarSecao('PATROCINIOS')).toBe('marketing')
  })
})

describe('parseAOA — planilha sintética no formato antigo', () => {
  const aoa = [
    ['A&B'],
    ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
    ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'],
    ['Bar', 'Copos', 'Copão', 'R$ 2.000,00', 'orçar'],
    ['TOTAL', '', '', 3500, ''],
    [],
    ['ESTRUTURA + CENOGRAFIA'],
    ['', 'Som', 'SomCia', 8000, 'FECHADO'],
    ['TOTAL', '', '', 8000],
    [],
    ['Lote', 'Valor Unitário', 'Qte no Lote', 'Receita'],
    ['Lote 1', 80, 100, 8000],
    ['Lote Porta', 120, 50, 6000],
    ['Cortesia', 0, 30, 0],
    ['TOTAL', '', 180, 14000],
  ]

  const res = parseAOA(aoa, { categorias: {}, lotes: [], avisos: [] })

  it('detecta as seções e mapeia para as categorias padrão', () => {
    expect(Object.keys(res.categorias).sort()).toEqual(['aeb', 'estrutura'])
    expect(res.categorias.aeb).toHaveLength(2)
    expect(res.categorias.estrutura).toHaveLength(1)
  })
  it('lê fornecedor, valor (número e texto pt-BR) e status', () => {
    const [gelo, copos] = res.categorias.aeb
    expect(gelo).toMatchObject({ servico: 'Gelo', fornecedor: 'Gelo SP', estimado: 1500, status: 'PAGO' })
    expect(copos).toMatchObject({ servico: 'Copos', estimado: 2000, status: 'ESTIMADO' })
  })
  it('ignora linhas TOTAL', () => {
    expect(res.categorias.aeb.some((i) => /total/i.test(i.servico))).toBe(false)
  })
  it('importa a tabela de lotes', () => {
    expect(res.lotes).toHaveLength(3)
    expect(res.lotes[0]).toMatchObject({ nome: 'Lote 1', valor: 80, quantidade: 100 })
    expect(res.lotes[2]).toMatchObject({ nome: 'Cortesia', valor: 0, quantidade: 30 })
  })
  it('identifica lote porta pelo nome', () => {
    expect(ehLotePorta(res.lotes[1].nome)).toBe(true)
    expect(ehLotePorta('Lote 1')).toBe(false)
  })

  it('seção desconhecida em caixa alta vira aviso e agrupa itens', () => {
    const r2 = parseAOA(
      [['SEGURANÇA PATRIMONIAL'], [null, 'Vigias', 'X', 900, '']],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r2.avisos).toHaveLength(1)
    expect(r2.categorias['?SEGURANÇA PATRIMONIAL']).toHaveLength(1)
  })

  it('seções de logística (cronograma, sem valores) são descartadas na limpeza', () => {
    const r = parseAOA(
      [
        ['MONTAGEM PRÉ'],
        [46092, '15h - 18h', 'Receber Copos', 'Pixpel', true],
        [46094, '09h - 18h', 'Receber Celulares', 'Tiqueteira', true],
      ],
      { categorias: {}, lotes: [], avisos: [] }
    )
    limparNaoReconhecidos(r)
    expect(Object.keys(r.categorias)).toHaveLength(0)
    expect(r.avisos).toHaveLength(0)
  })

  it('título de seção com letra minúscula no meio ("EQUIPE e LOGISTICA")', () => {
    const r = parseAOA(
      [
        ['ARTISTICO'],
        ['Artistas', 'DJ', 'Zullu', 20000, 'FINALIZADO'],
        ['EQUIPE e LOGISTICA'],
        ['Produção', 'Chefe de Produção', 'Isabella', 3500, 'FINALIZADO'],
      ],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r.categorias.artistico).toHaveLength(1)
    expect(r.categorias.equipe).toHaveLength(1)
  })

  it('linha de item com macro parecendo cabeçalho ("Produtos") não vira cabeçalho', () => {
    const r = parseAOA(
      [
        ['A&B'],
        ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
        ['Produtos', 'Licor 43 e Tequila', 'Licor 43', 0, 'FINALIZADO'],
        [null, 'Cerveja', 'Patrocinador B', 8462.4, 'FINALIZADO'],
        ['Impressão', 'Copos', 'Claudio', 2600, 'FINALIZADO'],
      ],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r.categorias.aeb.map((i) => i.servico)).toEqual([
      'Licor 43 e Tequila',
      'Cerveja',
      'Copos',
    ])
    expect(r.categorias.aeb[1].estimado).toBe(8462.4)
  })

  it('colunas Estimado/Realizado separadas', () => {
    const r3 = parseAOA(
      [
        ['EQUIPE'],
        ['Serviço', 'Fornecedor', 'Estimado', 'Realizado', 'Status'],
        ['Segurança', 'SegBr', 5000, 5500, 'PAGO'],
      ],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r3.categorias.equipe[0]).toMatchObject({ estimado: 5000, realizado: 5500 })
  })
})

describe('parseWorkbookData — .xlsx REAL gerado em memória (H3-L item 2, §7.7 do dossiê)', () => {
  // Até aqui todo teste deste arquivo alimenta parseAOA direto com um
  // array-of-arrays já pronto — o SheetJS nunca abre um arquivo de verdade.
  // Este describe gera um .xlsx binário de verdade com a própria lib
  // (aoa_to_sheet + write) e manda pelo caminho REAL: ArrayBuffer/Uint8Array
  // → XLSX.read (dentro de parseWorkbookData) → parseAOA. Cobre a
  // (des)serialização real do formato .xlsx (zip + XML + tabela de strings
  // compartilhadas) que o caminho parseAOA-direto não exercita.
  const aoaReal = [
    ['A&B'],
    ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
    ['Bar', 'Gelo', 'Gelo SP', 'R$ 1.234,56', 'PAGO'],
    ['Bar', 'Copos', 'Copão', 1500, 'orçar'],
    ['TOTAL', '', '', 2734.56, ''],
    [],
    ['EQUIPE'],
    ['', 'Segurança', 'SegBr', 5000, 'FECHADO'],
    ['TOTAL', '', '', 5000, ''],
    [],
    ['Lote', 'Valor Unitário', 'Qte no Lote', 'Receita'],
    ['Lote 1', 80, 100, 8000],
    ['Lote Porta', 120, 50, 6000],
    ['TOTAL', '', 150, 14000],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaReal)
  XLSX.utils.book_append_sheet(wb, ws, 'Plan1')
  // type:'array' → o mesmo formato binário que sai de um <input type="file">
  // lido com FileReader.readAsArrayBuffer, que é o que o app usa ao vivo.
  const binario = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const res = parseWorkbookData(binario)

  it('abre o binário .xlsx de verdade e reconhece a aba', () => {
    expect(res.planilhas).toEqual(['Plan1'])
  })

  it('itens certos, com valor BR ("R$ 1.234,56") e valor numérico ambos parseados', () => {
    expect(res.categorias.aeb).toHaveLength(2)
    expect(res.categorias.aeb[0]).toMatchObject({
      servico: 'Gelo', fornecedor: 'Gelo SP', estimado: 1234.56, status: 'PAGO',
    })
    expect(res.categorias.aeb[1]).toMatchObject({
      servico: 'Copos', fornecedor: 'Copão', estimado: 1500, status: 'ESTIMADO',
    })
    expect(res.categorias.equipe).toHaveLength(1)
    expect(res.categorias.equipe[0]).toMatchObject({
      servico: 'Segurança', fornecedor: 'SegBr', estimado: 5000, status: 'FECHADO',
    })
  })

  it('lotes certos, inclusive a identificação de lote porta', () => {
    expect(res.lotes).toHaveLength(2)
    expect(res.lotes[0]).toMatchObject({ nome: 'Lote 1', valor: 80, quantidade: 100 })
    expect(res.lotes[1]).toMatchObject({ nome: 'Lote Porta', valor: 120, quantidade: 50 })
    expect(ehLotePorta(res.lotes[1].nome)).toBe(true)
  })

  it('as 3 linhas TOTAL (A&B, EQUIPE, lotes) são descartadas com o motivo certo, nunca viram item', () => {
    const totais = res.descartes.filter((d) => d.motivo === 'linha de TOTAL da seção')
    expect(totais).toHaveLength(3)
    expect(res.categorias.aeb.some((i) => /total/i.test(i.servico))).toBe(false)
    expect(res.categorias.equipe.some((i) => /total/i.test(i.servico))).toBe(false)
  })
})

describe('parseAOA — descartes (H3-D §9.11.4): linhas que ficam de fora, com motivo', () => {
  it('linha TOTAL, linha sem serviço e linha de lixo fora de seção viram descarte com linha e motivo certos', () => {
    const aoa = [
      ['Anotação solta', 'nada a ver', 123], // linha 1: fora de qualquer seção (nenhuma seção aberta ainda)
      ['A&B'], // linha 2: título de seção — não é descarte
      ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'], // linha 3: item válido — não é descarte
      ['Bar', '', 'SemNome', 200, 'PAGO'], // linha 4: sem serviço/produto
      ['TOTAL', '', '', 1500, ''], // linha 5: linha de TOTAL
    ]
    const r = parseAOA(aoa, { categorias: {}, lotes: [], avisos: [] })
    expect(r.descartes).toHaveLength(3)
    expect(r.descartes[0]).toMatchObject({ linha: 1, motivo: 'fora de qualquer seção reconhecida' })
    expect(r.descartes[1]).toMatchObject({ linha: 4, motivo: 'sem serviço/produto' })
    expect(r.descartes[2]).toMatchObject({ linha: 5, motivo: 'linha de TOTAL da seção' })
    // amostra existe e ajuda o Marco a reconhecer a linha, sem exigir formatação exata
    for (const d of r.descartes) {
      expect(typeof d.amostra).toBe('string')
      expect(d.amostra.length).toBeGreaterThan(0)
    }
    // a linha válida (item real) segue entrando normalmente — descarte não vaza pro lado certo
    expect(r.categorias.aeb).toHaveLength(1)
  })

  it('item em seção não reconhecida sem valor numérico vira descarte "sem valor numérico"', () => {
    const r = parseAOA(
      [['MONTAGEM PRÉ'], [46092, '15h - 18h', 'Receber Copos', 'Pixpel', true]],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r.descartes).toHaveLength(1)
    expect(r.descartes[0]).toMatchObject({ linha: 2, motivo: 'sem valor numérico' })
  })

  it('planilha limpa (nada descartado) devolve descartes: []', () => {
    const r = parseAOA(
      [['A&B'], ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO']],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r.descartes).toEqual([])
  })

  it('linha 100% vazia NÃO vira descarte (vazio não é dado perdido)', () => {
    const r = parseAOA(
      [
        ['A&B'],
        ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'],
        [],
        [null, null, null],
        ['   ', null],
      ],
      { categorias: {}, lotes: [], avisos: [] }
    )
    expect(r.descartes).toEqual([])
  })
})

describe('parseAOA — tabela de lotes NO MEIO da planilha e a seção de custos aberta', () => {
  // Medido em 27/07/2026, ANTES do conserto, com este mesmo array-of-arrays:
  // a linha "Iluminação · Ciclano · R$ 15.000 · PAGO" NÃO virava item —
  // saía em res.descartes com o motivo "fora de qualquer seção reconhecida",
  // e res.categorias.estrutura ficava com 1 item (só o som de R$ 20.000).
  // O motivo era enganoso: na planilha a linha está visivelmente DENTRO de
  // "ESTRUTURA + CENOGRAFIA". Quem fechava a seção era o parser (ao reconhecer
  // o cabeçalho da tabela de lotes ele zerava a seção aberta), não a planilha —
  // e o Marco via R$ 15.000 de custo real sumirem com uma explicação que não
  // apontava a causa.
  const planilhaComLotesNoMeio = (fimDaTabelaDeLotes) => [
    ['ESTRUTURA + CENOGRAFIA'],
    ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status'],
    ['Som', 'Sistema de som', 'Fulano', 20000, 'PAGO'],
    [],
    ['Lote', 'Valor unit.', 'Qte'],
    ['1º lote', 100, 500],
    fimDaTabelaDeLotes,
    ['Luz', 'Iluminação', 'Ciclano', 15000, 'PAGO'],
  ]

  it('a tabela de lotes terminada por LINHA EM BRANCO devolve a seção: o custo de R$ 15.000 seguinte entra em ESTRUTURA', () => {
    const r = parseAOA(planilhaComLotesNoMeio([]), {
      categorias: {}, lotes: [], avisos: [], descartes: [],
    })
    expect(r.categorias.estrutura).toHaveLength(2)
    expect(r.categorias.estrutura[1]).toMatchObject({
      servico: 'Iluminação', fornecedor: 'Ciclano', estimado: 15000, status: 'PAGO',
    })
    // e não sobra descarte nenhum: a linha não some nem "com motivo melhor"
    expect(r.descartes).toEqual([])
    // a tabela de lotes continua sendo lida como lote (1 lote, não 2)
    expect(r.lotes).toEqual([{ nome: '1º lote', valor: 100, quantidade: 500 }])
  })

  it('a tabela de lotes terminada por linha TOTAL devolve a seção, e a TOTAL segue descartada como TOTAL', () => {
    const r = parseAOA(planilhaComLotesNoMeio(['TOTAL', '', 500]), {
      categorias: {}, lotes: [], avisos: [], descartes: [],
    })
    expect(r.categorias.estrutura).toHaveLength(2)
    expect(r.categorias.estrutura[1]).toMatchObject({ servico: 'Iluminação', estimado: 15000 })
    expect(r.lotes).toEqual([{ nome: '1º lote', valor: 100, quantidade: 500 }])
    // o único descarte é a linha TOTAL da tabela de lotes, com o motivo de sempre
    expect(r.descartes).toEqual([
      { linha: 7, motivo: 'linha de TOTAL da seção', amostra: 'TOTAL, 500' },
    ])
  })

  it('duas tabelas de lotes COLADAS (pista e camarote, sem linha em branco entre elas) devolvem a seção aberta antes da PRIMEIRA', () => {
    // O segundo cabeçalho de lotes chega com a primeira tabela ainda aberta.
    // O que este teste guarda: a seção "ESTRUTURA + CENOGRAFIA" sobrevive às
    // DUAS tabelas e os R$ 15.000 de iluminação depois delas entram como item.
    //
    // Cores medidas em 27/07/2026, cada mutante montado numa CÓPIA da fonte e
    // este arquivo INTEIRO rodado contra a cópia (a fonte real ficou intocada):
    //  · o defeito original (`secaoAtual = null` ao reconhecer o cabeçalho de
    //    lotes): VERMELHO aqui e nos testes LINHA EM BRANCO, TOTAL e EFEITO
    //    COLATERAL deste bloco; todo o resto do arquivo verde.
    //  · numa variante que guarda a seção numa variável para devolvê-la ao fim
    //    da tabela, tirar o guarda da ENTRADA (`if (!colsLotes)`) faz o
    //    segundo cabeçalho sobrescrever com "nenhuma seção" o que o primeiro
    //    guardou: VERMELHO só aqui, no arquivo inteiro —
    //    r.categorias.estrutura volta a 1 item e os R$ 15.000 somem de novo.
    // Por que o código de hoje NÃO guarda seção nenhuma (ele só a deixa
    // aberta) está escrito na própria fonte, no comentário do bloco
    // "tabela de lotes?" do xlsxImport.js.
    const r = parseAOA(
      [
        ['ESTRUTURA + CENOGRAFIA'],
        ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor Previsto', 'Status'],
        ['Som', 'Sistema de som', 'Fulano', 20000, 'PAGO'],
        [],
        ['Lote', 'Valor unit.', 'Qte'],
        ['1º lote pista', 100, 500],
        ['Tipo', 'Valor unit.', 'Qtd'],
        ['Camarote', 300, 80],
        [],
        ['Luz', 'Iluminação', 'Ciclano', 15000, 'PAGO'],
      ],
      { categorias: {}, lotes: [], avisos: [], descartes: [] }
    )
    expect(r.categorias.estrutura).toHaveLength(2)
    expect(r.categorias.estrutura[1]).toMatchObject({ servico: 'Iluminação', estimado: 15000 })
    expect(r.lotes).toEqual([
      { nome: '1º lote pista', valor: 100, quantidade: 500 },
      { nome: 'Camarote', valor: 300, quantidade: 80 },
    ])
    expect(r.descartes).toEqual([])
  })

  it('sem seção aberta antes dos lotes, o que vem depois segue "fora de qualquer seção reconhecida" (nada é inventado)', () => {
    // Congelado da medição de 27/07/2026 ANTES do conserto: quando não havia
    // seção alguma para guardar, devolver "a seção de antes" não pode inventar
    // uma — o descarte continua igual.
    const r = parseAOA(
      [
        ['Lote', 'Valor unit.', 'Qte'],
        ['1º lote', 100, 500],
        [],
        ['Anotação solta', 'nada a ver', 123],
      ],
      { categorias: {}, lotes: [], avisos: [], descartes: [] }
    )
    expect(r.categorias).toEqual({})
    expect(r.lotes).toEqual([{ nome: '1º lote', valor: 100, quantidade: 500 }])
    expect(r.descartes).toEqual([
      { linha: 4, motivo: 'fora de qualquer seção reconhecida', amostra: 'Anotação solta, nada a ver, 123' },
    ])
  })

  it('linha em branco no meio de uma seção SEM tabela de lotes não fecha a seção: os 2 itens continuam em A&B', () => {
    // Guarda contra o erro oposto: devolver a seção em TODA linha em branco
    // apagaria a seção aberta de qualquer planilha. Congelado da medição de
    // 27/07/2026 ANTES do conserto.
    const r = parseAOA(
      [
        ['A&B'],
        ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
        ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'],
        [],
        ['Bar', 'Copos', 'Copão', 2000, 'PAGO'],
      ],
      { categorias: {}, lotes: [], avisos: [], descartes: [] }
    )
    expect(r.categorias.aeb.map((i) => i.servico)).toEqual(['Gelo', 'Copos'])
    expect(r.descartes).toEqual([])
  })

  it('planilha com os lotes NO FIM (o caso normal de hoje) sai byte a byte igual ao que já saía', () => {
    // Fotografia INTEIRA — categorias, lotes, descartes e avisos — da planilha
    // sintética canônica deste arquivo, medida em 27/07/2026 ANTES do conserto.
    // É a prova de que devolver a seção depois da tabela de lotes não mexe em
    // nenhuma planilha que já funcionava.
    const r = parseAOA(
      [
        ['A&B'],
        ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
        ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'],
        ['Bar', 'Copos', 'Copão', 'R$ 2.000,00', 'orçar'],
        ['TOTAL', '', '', 3500, ''],
        [],
        ['ESTRUTURA + CENOGRAFIA'],
        ['', 'Som', 'SomCia', 8000, 'FECHADO'],
        ['TOTAL', '', '', 8000],
        [],
        ['Lote', 'Valor Unitário', 'Qte no Lote', 'Receita'],
        ['Lote 1', 80, 100, 8000],
        ['Lote Porta', 120, 50, 6000],
        ['Cortesia', 0, 30, 0],
        ['TOTAL', '', 180, 14000],
      ],
      { categorias: {}, lotes: [], avisos: [], descartes: [] }
    )
    expect(r.categorias).toEqual({
      aeb: [
        { servico: 'Gelo', fornecedor: 'Gelo SP', estimado: 1500, realizado: '', status: 'PAGO', responsavel: '', obs: '' },
        { servico: 'Copos', fornecedor: 'Copão', estimado: 2000, realizado: '', status: 'ESTIMADO', responsavel: '', obs: '' },
      ],
      estrutura: [
        { servico: 'Som', fornecedor: 'SomCia', estimado: 8000, realizado: '', status: 'FECHADO', responsavel: '', obs: '' },
      ],
    })
    expect(r.lotes).toEqual([
      { nome: 'Lote 1', valor: 80, quantidade: 100 },
      { nome: 'Lote Porta', valor: 120, quantidade: 50 },
      { nome: 'Cortesia', valor: 0, quantidade: 30 },
    ])
    expect(r.descartes).toEqual([
      { linha: 5, motivo: 'linha de TOTAL da seção', amostra: 'TOTAL, 3500' },
      { linha: 9, motivo: 'linha de TOTAL da seção', amostra: 'TOTAL, 8000' },
      { linha: 15, motivo: 'linha de TOTAL da seção', amostra: 'TOTAL, 180, 14000' },
    ])
    expect(r.avisos).toEqual([])
  })

  it('EFEITO COLATERAL MEDIDO: resumo de RECEITA colado depois da tabela de lotes vira CUSTO — R$ 232.500 (espera decisão do Marco, BACKLOG 27/07/2026)', () => {
    // Este teste não celebra o resultado: ele o NOMEIA, para a conta ser
    // conhecida em vez de descoberta no meio de um fechamento.
    //
    // Como a tabela de lotes não fecha mais a seção, TODA linha entre o fim da
    // tabela e o próximo título em caixa alta passa a ser item da seção que
    // estava aberta. Quando o que vem depois da bilheteria é um resumo de
    // RECEITA, isso vira custo que não existe. Medido em 27/07/2026 nesta
    // planilha: 4 linhas mudam de destino (descarte → item) e o custo do
    // evento sai de R$ 21.500 para R$ 254.000 — 11,8× mais.
    //
    // Não é uma classe NOVA de defeito: a MESMA planilha SEM a tabela de lotes
    // no meio já produzia esses R$ 232.500 de custo falso antes do conserto —
    // medido no mesmo dia, com o parser antigo. A tabela de lotes era uma
    // barreira por acidente, e o conserto a tirou. O que mudou é o ALCANCE.
    // Mitigação que existe hoje: a tela de revisão do import lista item a item
    // antes de aplicar (ImportModal.jsx), com a caixa marcada por padrão.
    const r = parseAOA(
      [
        ['A&B'],
        ['Macro', 'Serviço/produto', 'Fornecedor', 'Valor', 'Status'],
        ['Bar', 'Gelo', 'Gelo SP', 1500, 'PAGO'],
        ['TOTAL', '', '', 1500, ''],
        [],
        ['ESTRUTURA + CENOGRAFIA'],
        ['Som', 'Sistema de som', 'Fulano', 20000, 'PAGO'],
        [],
        ['Lote', 'Valor Unitário', 'Qte no Lote', 'Receita'],
        ['1º lote', 80, 500, 40000],
        ['Lote Porta', 120, 200, 24000],
        ['TOTAL', '', 700, 64000],
        [],
        ['Receita', 'Bilheteria', 'Tiqueteira', 64000, ''],
        ['Receita', 'Bar (consumo)', 'Interno', 38000, ''],
        ['Receita', 'Patrocínio', 'Marca X', 25000, ''],
        ['Resultado', 'Sobra prevista', '', 105500, ''],
      ],
      { categorias: {}, lotes: [], avisos: [], descartes: [] }
    )
    // as 4 linhas de receita entram como CUSTO em ESTRUTURA, atrás do som real
    expect(r.categorias.estrutura.map((i) => [i.servico, i.estimado])).toEqual([
      ['Sistema de som', 20000],
      ['Bilheteria', 64000],
      ['Bar (consumo)', 38000],
      ['Patrocínio', 25000],
      ['Sobra prevista', 105500],
    ])
    const custoTotal = Object.values(r.categorias)
      .flat()
      .reduce((s, i) => s + i.estimado, 0)
    // ANTES do conserto este mesmo AOA dava R$ 21.500 de custo (só o gelo e o
    // som) — a diferença de R$ 232.500 é o efeito colateral inteiro. Aqui vai
    // só o valor de HOJE: subtrair 21.500 de 254.000 dentro do expect seria
    // uma conta que passa sozinha, não uma medição.
    expect(custoTotal).toBe(254000)
    // e os 4 descartes "fora de qualquer seção reconhecida" viraram 2 TOTAL:
    // as linhas deixaram de ser sinalizadas como "ficaram de fora"
    expect(r.descartes.map((d) => d.motivo)).toEqual([
      'linha de TOTAL da seção',
      'linha de TOTAL da seção',
    ])
  })
})

describe('normalizar', () => {
  it('remove acentos e caixa', () => {
    expect(normalizar('locação')).toBe('LOCACAO')
    expect(normalizar('  Artístico ')).toBe('ARTISTICO')
  })
})


describe('P3 — recusa lexical sem aproveitar dígitos', () => {
  it.each(['R$ 8.000 (2 dias)', 'R$ 2.000/dia', 'R$ 15.000 - 3 diárias', 'R$ 8 mil', '1e3', '1/2', '12-34', '5%', true, {}, Infinity, NaN])('recusa %s', (v) => expect(parseMoney(v)).toBeNull())
  it.each([['1.234,56-', -1234.56], ['2.500-', -2500]])('menos terminal %s', (v, esperado) => expect(parseMoney(v)).toBe(esperado))
  it('conserva interpretações históricas permissivas', () => {
    for (const [v, n] of [['1,500',1500],['1.234,500',1234.5],['1,234.56',1234.56],['1234.567,89',1234567.89],['1.5,000',15],['12,34.56,78',12.345678],['1.234,56,78',1234.5678]]) expect(parseMoney(v)).toBe(n)
  })
  it('estimados anotados recusam linhas; realizado anotado preserva estimado e fica vazio', () => {
    const res = parseAOA([['ESTRUTURA'], ['Macro','Serviço','Fornecedor','Estimado','Realizado'], ['', 'Palco','', 'R$ 8.000 (2 dias)'], ['', 'PA','', 'R$ 2.000/dia'], ['', 'Iluminação','', 'R$ 15.000 - 3 diárias'], ['', 'Gerador','',12000,'R$ 8 mil']], {categorias:{},lotes:[],avisos:[]}, 'Custos')
    expect(res.categorias.estrutura).toHaveLength(1)
    expect(res.categorias.estrutura[0]).toMatchObject({servico:'Gerador',estimado:12000,realizado:''})
    expect(res.descartes).toHaveLength(3)
    expect(res.descartes[0]).toMatchObject({tipo:'valor-invalido',planilha:'Custos',linha:3,celulas:[{campo:'estimado',original:'R$ 8.000 (2 dias)'}]})
    expect(res.recusasCelulas).toMatchObject([{planilha:'Custos',linha:6,campo:'realizado',original:'R$ 8 mil'}])
  })
  it('lote com preço ou quantidade anotada não entra', () => {
    const r = parseAOA([['Lote','Valor unitário','Quantidade'],['Antecipado','R$ 8 mil',20],['Porta',40,'20 pessoas']], {categorias:{},lotes:[],avisos:[]})
    expect(r.lotes).toHaveLength(0)
    expect(r.descartes).toHaveLength(2)
  })
})

  it.each([['-R$ 500',-500],['(R$ 500)',-500],['R$ -500',-500],['+500',500]])('P3 — envelope histórico %s', (texto,n) => expect(parseMoney(texto)).toBe(n))


describe('P5 — serviço com quantidade é custo',()=>{
 const equipe=[['EQUIPE'],['Serviço / produto','Fornecedor','Qtd','Valor unitário','Status'],['Garçom','Sintético',20,250,'ORÇAR'],['Segurança','Sintético',8,300,'ORÇAR']]
 const ler=aoa=>parseAOA(aoa,{categorias:{},lotes:[],avisos:[]},'Custos')
 it('20×250+8×300 são dois custos7400, sem lotes',()=>{
   const r=ler(equipe);expect(r.lotes).toEqual([]);expect(r.categorias.equipe.map(i=>i.estimado)).toEqual([5000,2400]);expect(r.metadados['custo:equipe:0']).toMatchObject({quantidade:20,unitario:250,totalCalculado:5000,planilha:'Custos',linha:3})
 })
 it('três seções mantêm cinco custos70400 e mapas independentes',()=>{
   const r=ler([['ESTRUTURA'],['Macro','Serviço','Fornecedor','Valor','Status'],['','Som','',15000],['','Luz','',18000],[],...equipe,[],['ARTISTICO'],['Macro','Serviço','Fornecedor','Valor','Status'],['','DJ','',30000]])
   expect(r.lotes).toEqual([]);const itens=Object.values(r.categorias).flat();expect(itens).toHaveLength(5);expect(itens.reduce((s,i)=>s+i.estimado,0)).toBe(70400)
 })
 it('lote explícito continua100×200; aviso de classificação vem separado dos avisos históricos',()=>{
   const r=ler([['Lote','Valor unitário','Qtd'],['Lote 1',100,200]])
   expect(r.lotes).toEqual([{nome:'Lote 1',valor:100,quantidade:200}]);expect(r.avisosClassificacao[0]).toMatch(/lotes de ingresso.*Custos.*linha 1/)
 })
 it('anotação em unitário, quantidade ou total recusa uma linha inteira cada',()=>{
   const r=ler([['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['A',20,'R$ 8 mil'],['B','20 pessoas',250],['C',20,250,'R$ 2.000/dia']])
   expect(r.lotes).toEqual([]);expect(r.categorias.equipe||[]).toEqual([]);expect(r.descartes).toHaveLength(3)
   expect(r.descartes.flatMap(d=>d.celulas.map(c=>c.original))).toEqual(['R$ 8 mil','20 pessoas','R$ 2.000/dia'])
 })
 it('total cabeçalho não some como linha TOTAL; zero informado diverge sem fallback',()=>{
   const r=ler([['EQUIPE'],['Serviço','Qtd','Valor unitário','Total'],['Garçom',20,250,0]])
   expect(r.descartes).toEqual([]);expect(r.metadados['custo:equipe:0'].conflito).toEqual({calculado:5000,declarado:0})
 })
 it('quantidade fracionária de serviço não arredonda e metadados acumulam em abas',()=>{
   const r=ler([['EQUIPE'],['Serviço','Qtd','Valor unit.'],['A',1.5,250]])
   parseAOA([['EQUIPE'],['Serviço','Quantidade','Valor unitário'],['B',0.5,300]],r,'Outra')
   expect(r.categorias.equipe.map(i=>i.estimado)).toEqual([375,150]);expect(r.metadados['custo:equipe:1'].planilha).toBe('Outra')
 })
})

 it('P5 — seção nova após lote sem separador não herda mapa da seção anterior',()=>{
  const r=parseAOA([['ESTRUTURA'],['Macro','Serviço','Fornecedor','Valor','Status'],['','Som','',15000],['Lote','Valor unitário','Qtd'],['Lote1',100,200],['EQUIPE'],['Serviço','Qtd','Valor unitário'],['Garçom',20,250]],{categorias:{},lotes:[],avisos:[]},'Custos')
  expect(r.lotes).toEqual([{nome:'Lote1',valor:100,quantidade:200}]);expect(r.categorias.equipe[0]).toMatchObject({servico:'Garçom',fornecedor:'',estimado:5000,status:'ESTIMADO'})
 })


describe('erros nativos Excel — bytes XLSX antes da validação P3/P5', () => {
  const lerErro = (aoa, endereco) => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws[endereco] = { t: 'e', v: 15 }
    XLSX.utils.book_append_sheet(wb, ws, 'Custos sintéticos')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    expect(XLSX.read(bytes, { type: 'array' }).Sheets['Custos sintéticos'][endereco].t).toBe('e')
    return parseWorkbookData(bytes)
  }

  it.each([['B3', 'quantidade'], ['C3', 'unitário'], ['D3', 'estimado']])('P5 recusa %s, conserva aba/linha/campo e a linha saudável', (endereco, campo) => {
    const r = lerErro([['EQUIPE'], ['Serviço', 'Qtd', 'Valor unitário', 'Total'], ['Garçom', 20, 250, ''], ['Segurança', 8, 300, '']], endereco)
    expect(r.categorias.equipe.map(i => i.servico)).toEqual(['Segurança'])
    expect(r.categorias.equipe[0].estimado).toBe(2400)
    expect(r.lotes).toEqual([])
    expect(r.descartes).toMatchObject([{ tipo: 'valor-invalido', planilha: 'Custos sintéticos', linha: 3, celulas: [{ campo, original: '#VALUE!' }] }])
  })

  it('P3 recusa estimado ilegível sem alterar outro custo', () => {
    const r = lerErro([['ESTRUTURA'], ['Macro', 'Serviço', 'Fornecedor', 'Estimado'], ['', 'Som', '', 12000], ['', 'Luz', '', 15000]], 'D3')
    expect(r.categorias.estrutura.map(i => i.servico)).toEqual(['Luz'])
    expect(r.descartes).toMatchObject([{ planilha: 'Custos sintéticos', linha: 3, celulas: [{ campo: 'estimado', original: '#VALUE!' }] }])
  })

  it('P3 realizado ilegível fica vazio e preserva estimado válido', () => {
    const r = lerErro([['ESTRUTURA'], ['Macro', 'Serviço', 'Fornecedor', 'Estimado', 'Realizado'], ['', 'Som', '', 12000, 8000]], 'E3')
    expect(r.categorias.estrutura[0]).toMatchObject({ servico: 'Som', estimado: 12000, realizado: '' })
    expect(r.recusasCelulas).toMatchObject([{ planilha: 'Custos sintéticos', linha: 3, campo: 'realizado', original: '#VALUE!' }])
  })

  it.each([['B2', 'preço'], ['C2', 'quantidade']])('P3 lote com erro em %s fica fora, lote saudável permanece', (endereco, campo) => {
    const r = lerErro([['Lote', 'Valor unitário', 'Quantidade'], ['Antecipado', 100, 200], ['Porta', 150, 50]], endereco)
    expect(r.lotes).toEqual([{ nome: 'Porta', valor: 150, quantidade: 50 }])
    expect(r.descartes).toMatchObject([{ planilha: 'Custos sintéticos', linha: 2, celulas: [{ campo, original: '#VALUE!' }] }])
  })
})
