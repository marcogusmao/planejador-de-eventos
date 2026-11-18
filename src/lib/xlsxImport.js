// Parser das planilhas antigas (.xlsx) — seções por categoria em caixa alta,
// colunas [Macro | Serviço/produto | Fornecedor | Valor (ou Estimado/Realizado) | Status],
// linhas TOTAL por seção e, opcionalmente, tabela de lotes de ingresso.
//
// A leitura do arquivo usa SheetJS; a lógica de parsing trabalha sobre
// array-of-arrays (parseAOA) para poder ser testada sem arquivos reais.

import * as XLSX from 'xlsx'
import { planilhaParaAOA } from './planilhaCelulas.js'
import { num } from './util.js'
import { migrarStatusCusto } from './statusCusto.js'

export const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()

// Parser único de dinheiro em formato brasileiro (e os formatos reais que
// chegam colados/importados). Grade testada em campoNumerico.test.js e
// xlsxImport.test.js. A compatibilidade com outro app precisa ser medida
// separadamente; estes testes provam a interpretação desta porta.
//
// Parêntese = negativo contábil (decisão do Marco, 20/07/2026): "(500)" → −500,
// "R$ (2.500)" → −2500. É a convenção que o Financeiro já usava; a previsão
// perdia o sinal (e ainda multiplicava por 1000 em "(1.234,56)").
//
// AS DUAS REGRAS DA VÍRGULA, e o Marco escolheu as duas juntas em 30/08/2026:
//   · COM ponto de milhar antes dela, a vírgula é SEMPRE decimal, com quantas
//     casas vierem — "1.234,500" é mil duzentos e trinta e quatro reais e
//     cinquenta centavos, nunca 1,2345.
//   · SEM ponto nenhum, a vírgula de 3 casas continua sendo MILHAR — "1,500"
//     segue valendo mil e quinhentos, como sempre valeu nesta casa.
// Ele foi perguntado com as duas leituras na frente e ficou com as duas
// convivendo; o campo de dinheiro passou a dizer isso em uma linha (ui.jsx).
// Retorna null para entrada ilegível; vazios legados continuam 0. O chamador
// deve tratar a recusa antes de arredondar, comparar ou montar itens.
export function parseMoney(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v == null) return 0
  // Menos tipográfico (U+2212) colado de PDF/Excel vira menos ASCII antes de
  // tudo — sem isto "−500" grava +500 em silêncio (achado A3 da verificação
  // hostil). Mesmo tratamento nos dois apps.
  if (typeof v !== 'string') return null
  let s = v.replace(/−/g, '-').trim()
  if (!s || s === '—') return 0
  s = s.replace(/^R\$\s*/i, '').trim()
  if (!s) return 0
  // Sinal, resolvido ANTES de decidir o formato: parêntese contábil OU menos =
  // negativo. NUNCA alterna — "(-500)" é −500 (o parêntese ganha), igual ao
  // parse_valor do Financeiro; alternar dava +500 e furava a trava de %
  // (achado A2 da verificação hostil).
  let negativo = false
  const paren = /^\((.*)\)$/.exec(s)
  if (paren) {
    negativo = true
    s = paren[1].trim()
  }
  s = s.replace(/^R\$\s*/i, '').trim()
  if (s.startsWith('-')) {
    negativo = true
    s = s.slice(1).trim()
  }
  if (s.startsWith('+')) s = s.slice(1).trim()
  s = s.replace(/^R\$\s*/i, '').trim()
  if (s.endsWith('-')) {
    negativo = true
    s = s.slice(0, -1).trim()
  }
  // Valida o conteúdo inteiro antes de tratar os separadores. Nenhuma
  // anotação pode perder suas letras e virar um número plausível.
  if (!/^[\d.,\s]+$/.test(s) || !/\d/.test(s)) return null
  s = s.replace(/\s/g, '')
  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  if (temVirgula && /,\d{1,2}$/.test(s)) {
    // pt-BR "1.234,56" → o ponto é milhar, a vírgula é decimal.
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula && temPonto && s.lastIndexOf('.') > s.lastIndexOf(',')) {
    // americano "1,234.56" → a vírgula é milhar, o ponto é decimal.
    s = s.replace(/,/g, '')
  } else if (temVirgula && temPonto && s.lastIndexOf('.') < s.lastIndexOf(',')) {
    // pt-BR com 3 OU MAIS casas decimais (decisão do Marco, 30/08/2026, por
    // questionário). MESMA leitura do ramo de cima ("1.234,56"), liberada para
    // qualquer número de casas: se a string tem ponto E vírgula e o ÚLTIMO
    // ponto vem ANTES da última vírgula, o ponto só pode ser milhar e a vírgula
    // só pode ser decimal. É a leitura brasileira inequívoca — nenhuma outra
    // convenção escreve "1.234,500" querendo dizer outra coisa.
    //
    // O QUE ISTO CONSERTA, medido em 30/08/2026 antes de mudar uma linha:
    // sobre 77 strings da forma ^\d{1,3}(\.\d{3})+,\d+$, o parser divergia da
    // leitura brasileira em 42 delas (54,5%) — e sempre por 1000× para BAIXO:
    //
    //   "1.234,500"     → 1,2345      (certo 1.234,50)
    //   "1.000,000"     → 1           (certo 1.000,00)
    //   "12.500,750"    → 12,50075    (certo 12.500,75)
    //   "1.234.567,890" → 1,234       (certo 1.234.567,89)
    //   "25.000,000"    → 25          (certo 25.000,00)
    //
    // A rota: o ramo de cima exige 1-2 casas e não casava; o ramo americano
    // exige o ponto DEPOIS da vírgula e não casava; sobrava o ramo de baixo
    // ("vírgula é milhar"), que tirava a vírgula e deixava "1.234500" — com o
    // ponto sobrevivendo como DECIMAL. O resultado não era defensável por
    // convenção nenhuma: nem 1.234,50 nem 1.234.500.
    //
    // Efeito na mesa do Marco: um custo colado como "25.000,000" gravava R$ 25
    // e sumia com R$ 24.975 — a festa aparecia lucrativa. Vale para DIGITAR E
    // COLAR também, não só para planilha: `parseCampoNumerico`
    // (campoNumerico.js) chama este mesmo parser.
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula) {
    // vírgula sem casas decimais claras ("1,234"): tratada como milhar,
    // como sempre (dinheiro de verdade tem 2 casas — não é decimal de 3).
    s = s.replace(/,/g, '')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "8.000", "1.234.567" → ponto é milhar.
    s = s.replace(/\./g, '')
  }
  // senão: ponto é decimal ("1234.56") ou inteiro puro — fica como está.
  const n = parseFloat(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? (negativo ? -n : n) : null
}

export function mapStatus(v) {
  // Reconhece o texto do arquivo v1 e devolve o status na lista ANTIGA; a
  // conversão para a lista NOVA é UMA só, via migrarStatusCusto (Marco,
  // 21/07/2026): FECHADO→FECHADO, NEGOCIANDO→NEGOCIAR, sem cair num ESTIMADO
  // genérico e sem mapeamento literal espalhado.
  const n = normalizar(v)
  let antigo = 'ORÇAR'
  if (n) {
    if (n.includes('PAG') || n.includes('FINALIZ')) antigo = 'PAGO'
    else if (n.includes('FECH')) antigo = 'FECHADO'
    else if (n.includes('NEGOC') || n.includes('FORMALIZ')) antigo = 'NEGOCIANDO'
  }
  return migrarStatusCusto(antigo)
}

const SECOES = [
  { cat: 'aeb', re: /^A\s*&\s*B|^A ?E ?B\b|ALIMENTOS|BEBIDAS/ },
  { cat: 'locacao', re: /LOCACAO|DOCUMENTACAO/ },
  { cat: 'estrutura', re: /ESTRUTURA|CENOGRAFIA/ },
  { cat: 'equipe', re: /^EQUIPE|^STAFF/ },
  { cat: 'artistico', re: /ARTISTICO|LINE ?UP|ATRACOES/ },
  { cat: 'marketing', re: /MARKETING|COMUNICACAO|DIVULGACAO|PATROCIN/ },
  { cat: 'extras', re: /^EXTRA|CONTINGENCIA|^OUTROS/ },
]

export function detectarSecao(texto) {
  const n = normalizar(texto)
  if (!n) return null
  for (const s of SECOES) if (s.re.test(n)) return s.cat
  return null
}

const str = (v) => (v == null ? '' : String(v).trim())

const linhaVazia = (row) => !row || row.every((c) => c == null || String(c).trim() === '')

// Amostra curta da linha p/ o Marco reconhecer qual é na lista de descartes
// da tela de revisão (H3-D §9.11.4) — os 2-3 primeiros valores preenchidos,
// sem rótulo de coluna (a planilha antiga não tem cabeçalho fixo por linha).
const amostraDaLinha = (row) => {
  const vals = (row || [])
    .filter((c) => c != null && String(c).trim() !== '')
    .slice(0, 3)
    .map((c) => String(c).trim())
  const s = vals.join(', ')
  return s.length > 60 ? `${s.slice(0, 59)}…` : s
}

const temNumero = (row) =>
  row.some(
    (c) =>
      (typeof c === 'number' && c !== 0) ||
      (typeof c === 'string' && /R\$|\d+[.,]\d{2}\b/.test(c))
  )

// Títulos de seção são "em caixa alta", mas na prática aparecem coisas como
// "EQUIPE e LOGISTICA" — aceita quando ≥ 80% das letras são maiúsculas.
const ehCaixaAlta = (s) => {
  const letras = String(s).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
  if (!letras) return false
  const maiusculas = letras.replace(/[^A-ZÀ-ÖØ-Þ]/g, '')
  return maiusculas.length / letras.length >= 0.8
}

const primeiraCelulaTexto = (row) => {
  for (const c of row) {
    if (c != null && String(c).trim() !== '') return String(c).trim()
  }
  return null
}

const COLS_PADRAO = { macro: 0, servico: 1, fornecedor: 2, estimado: 3, status: 4 }

function mapearColunas(row) {
  const map = {}
  row.forEach((c, i) => {
    const n = normalizar(c)
    if (!n) return
    if (/SERVICO|PRODUTO|DESCRICAO|^ITEM/.test(n) && map.servico == null) map.servico = i
    else if (/FORNECEDOR/.test(n) && map.fornecedor == null) map.fornecedor = i
    else if (/^MACRO/.test(n) && map.macro == null) map.macro = i
    else if (/REALIZADO/.test(n) && map.realizado == null) map.realizado = i
    else if (/VALOR\s*UNIT/.test(n) && map.unitario == null) map.unitario = i
    else if (/\bQTE\b|\bQTD\b|QUANTIDADE/.test(n) && map.quantidade == null) map.quantidade = i
    else if (/^TOTAL(?:\s|$)|VALOR\s*TOTAL|ESTIMADO|PREVISTO|ORCAMENTO|^VALOR/.test(n) && map.estimado == null) map.estimado = i
    else if (/STATUS|SITUACAO/.test(n) && map.status == null) map.status = i
    else if (/RESPONSAVEL/.test(n) && map.responsavel == null) map.responsavel = i
    else if (/^OBS/.test(n) && map.obs == null) map.obs = i
  })
  // exige pelo menos 2 colunas reconhecidas — uma só ("Produtos" numa célula
  // Macro, por exemplo) é linha de item, não cabeçalho
  const reconhecidas = Object.keys(map).length
  return reconhecidas >= 2 && (map.servico != null || map.estimado != null) ? map : null
}

function mapearColunasLotes(row) {
  let valor = null
  let qtd = null
  let nome = null
  row.forEach((c, i) => {
    const n = normalizar(c)
    if (!n) return
    if (/VALOR\s*UNIT/.test(n)) valor = i
    else if (/\bQTE\b|\bQTD\b|QUANTIDADE/.test(n) && qtd == null) qtd = i
    else if (/LOTE|NOME|INGRESSO|TIPO/.test(n) && nome == null) nome = i
  })
  if (valor != null && qtd != null) return { valor, qtd, nome: nome ?? 0 }
  return null
}

/**
 * Faz o parse de uma planilha (array of arrays) acumulando em `res`:
 * { categorias: {catKey|"?TÍTULO": itens[]}, lotes: [], avisos: [], descartes: [] }
 * `descartes` (H3-D §9.11.4): toda linha não-vazia que não virou item, lote
 * nem estrutura reconhecida (cabeçalho/título de seção) — motivo por classe,
 * sem mudar NENHUM critério de descarte já existente, só registrando.
 */
export function parseAOA(aoa, res, planilha = '') {
  let secaoAtual = null
  let cols = null
  let colsLotes = null
  if (!res.descartes) res.descartes = []
  if (!res.recusasCelulas) res.recusasCelulas = []
  if (!res.metadados) res.metadados = {}
  if (!res.avisosClassificacao) res.avisosClassificacao = []
  const motivoValor = 'Valor não reconhecido — informe só o número, sem anotações.'
  const recusarLinha = (row, linha, celulas) => res.descartes.push({
    tipo: 'valor-invalido', planilha, linha, amostra: amostraDaLinha(row),
    motivo: motivoValor, celulas,
  })

  for (let idx = 0; idx < aoa.length; idx++) {
    const rowRaw = aoa[idx]
    const linha = idx + 1
    const row = rowRaw || []

    if (linhaVazia(row)) {
      colsLotes = null
      continue
    }

    // Uma seção conhecida escrita sozinha encerra o contexto de lotes, para
    // o novo cabeçalho definir seu próprio mapa sem fabricar um lote zero.
    if (colsLotes && row.filter(c => c != null && str(c) !== '').length === 1 &&
        ehCaixaAlta(primeiraCelulaTexto(row)) && detectarSecao(primeiraCelulaTexto(row))) colsLotes = null

    // tabela de lotes? (uma tabela de lotes NÃO fecha a seção de custos aberta:
    // é um bloco de bilheteria DENTRO da folha de custos, e quem manda na seção
    // é o título da planilha, não a bilheteria.)
    //
    // Aqui havia um `secaoAtual = null`. Medido em 27/07/2026 numa planilha com
    // a tabela de lotes no MEIO: a primeira linha de custo depois da tabela
    // ("Iluminação · Ciclano · R$ 15.000 · PAGO", dentro de "ESTRUTURA +
    // CENOGRAFIA") não virava item — saía em descartes com o motivo "fora de
    // qualquer seção reconhecida". O motivo era enganoso: quem tinha fechado a
    // seção era esta linha, não a planilha, e o Marco via um custo real sumir
    // com uma explicação que não apontava a causa.
    //
    // Guardar a seção e devolvê-la ao fim da tabela dá exatamente o mesmo
    // resultado que simplesmente não fechá-la — 200.000 planilhas sintéticas
    // comparadas linha a linha entre as duas versões, ZERO divergências —, e
    // custa uma variável de estado a mais. Fica a versão sem estado.
    //
    // O PREÇO disto está medido e registrado no BACKLOG.md (27/07/2026, item
    // "Sem a tabela de lotes fechando a seção…"), porque é maior do que a linha
    // de iluminação que ele recupera: a tabela de lotes deixa de ser barreira, e
    // TODA linha entre o fim dela e o próximo título em caixa alta passa a ser
    // item da seção aberta. O MESMO corpus de 200.000 planilhas sintéticas,
    // agora comparado com o comportamento ANTIGO (a comparação que faltava),
    // dá 6.766 planilhas com resultado diferente (3,4%) e 9.875 linhas mudando
    // de destino — 7.762 delas saindo de descarte e virando ITEM de custo.
    // Quando o que vem depois da bilheteria é um resumo de RECEITA, isso vira
    // custo falso: R$ 232.500 na planilha do teste "EFEITO COLATERAL MEDIDO".
    // Não é classe nova de defeito — a mesma planilha SEM tabela de lotes já
    // fazia isso antes —, é alcance maior; dar ao parser um fim de seção
    // explícito é decisão do Marco, não conserto de rotina.
    const ml = mapearColunasLotes(row)
    const mc = mapearColunas(row)
    const custoComQuantidade = secaoAtual && mc?.servico != null && mc.quantidade != null && mc.unitario != null &&
      !row.some(c => /LOTE|INGRESSO/.test(normalizar(c)))
    if (mc && !temNumero(row) && (!ml || custoComQuantidade)) {
      // Cabeçalho reconhecido define todas as posições disponíveis. Completar
      // com o mapa legado copiaria Realizado para Fornecedor em tabela compacta.
      // O mapa legado continua valendo somente quando não há cabeçalho.
      cols = mc
      colsLotes = null
      continue
    }
    if (ml) {
      colsLotes = ml
      // Aviso próprio permite preservar o inventário estrutural histórico,
      // que já tem fotografias comparadas integralmente nos testes.
      res.avisosClassificacao.push(`Tabela interpretada como lotes de ingresso (aba ${planilha || '(sem nome)'}, linha ${linha}) — confira os preços e as quantidades.`)
      continue
    }
    if (colsLotes) {
      const nome = row[colsLotes.nome]
      if (!nome || /TOTAL/.test(normalizar(nome))) {
        colsLotes = null
      } else {
        // Célula de preço VAZIA = lote SEM PREÇO (P2 da S7 — Marco, 06/10/2026,
        // por questionário): fica fora do público e do bar até ter preço, a
        // mesma regra de calc.js (isPrecoAusente). "0" ou "—" ESCRITOS seguem
        // cortesia (R$ 0) — parseMoney cuida deles como sempre.
        // Célula com SÓ o símbolo da moeda ("R$", "R$ ", "r$" com espaço
        // fixo) também é vazia: não há número nenhum escrito nela (decisão P3
        // do Marco, 06/10/2026). Antes ela passava por parseMoney, que tira o
        // "R$" e devolve 0 — cortesia. "R$ 0,00" tem número e segue cortesia;
        // "-" e "–" seguem recusados, como antes.
        const celulaPreco = row[colsLotes.valor]
        const precoVazio =
          celulaPreco == null ||
          (typeof celulaPreco === 'string' && celulaPreco.trim().replace(/^R\$/i, '').trim() === '')
        const valor = precoVazio ? '' : parseMoney(celulaPreco)
        const quantidade = parseMoney(row[colsLotes.qtd])
        const celulas = []
        if (valor === null) celulas.push({campo:'preço', original:row[colsLotes.valor], motivo:motivoValor})
        if (quantidade === null) celulas.push({campo:'quantidade', original:row[colsLotes.qtd], motivo:motivoValor})
        if (celulas.length) recusarLinha(row, linha, celulas)
        else {
          res.metadados[`lote:${res.lotes.length}`] = {planilha,linha,quantidadeOriginal:quantidade,originais:{valor:row[colsLotes.valor],quantidade:row[colsLotes.qtd]}}
          res.lotes.push({nome:str(nome), valor, quantidade:Math.round(quantidade)})
        }
        continue
      }
    }

    // linha TOTAL?
    if (row.slice(0, 3).some((c) => /^TOTAL/.test(normalizar(c)))) {
      res.descartes.push({ linha, motivo: 'linha de TOTAL da seção', amostra: amostraDaLinha(row) })
      continue
    }

    // título de seção? (caixa alta, sem valores)
    const primeira = primeiraCelulaTexto(row)
    const celulasPreenchidas = row.filter((c) => c != null && String(c).trim() !== '').length
    if (primeira && ehCaixaAlta(primeira) && !temNumero(row)) {
      const cat = detectarSecao(primeira)
      if (cat) {
        secaoAtual = { cat, titulo: primeira }
        cols = null
        continue
      }
      if (celulasPreenchidas === 1 && primeira.length > 3) {
        secaoAtual = { cat: null, titulo: primeira }
        cols = null
        res.avisos.push(
          `Seção não reconhecida: "${primeira}"${planilha ? ` (aba ${planilha})` : ''} — revise a categoria dos itens.`
        )
        continue
      }
    }

    // linha de item dentro de uma seção
    if (secaoAtual) {
      const c = cols || COLS_PADRAO
      const servico = row[c.servico]
      if (servico == null || String(servico).trim() === '') {
        res.descartes.push({ linha, motivo: 'sem serviço/produto', amostra: amostraDaLinha(row) })
        continue
      }
      const comQuantidade = c.quantidade != null && c.unitario != null
      const totalPreenchido = c.estimado != null && row[c.estimado] != null && str(row[c.estimado]) !== ''
      const totalDeclarado = totalPreenchido ? parseMoney(row[c.estimado]) : null
      const quantidade = comQuantidade ? parseMoney(row[c.quantidade]) : null
      const unitario = comQuantidade ? parseMoney(row[c.unitario]) : null
      const celulas = []
      if (comQuantidade && quantidade === null) celulas.push({campo:'quantidade',original:row[c.quantidade],motivo:motivoValor})
      if (comQuantidade && unitario === null) celulas.push({campo:'unitário',original:row[c.unitario],motivo:motivoValor})
      if (totalPreenchido && totalDeclarado === null) celulas.push({campo:'estimado',original:row[c.estimado],motivo:motivoValor})
      if (celulas.length) {
        recusarLinha(row, linha, celulas)
        if (!secaoAtual.cat) res.descartes[res.descartes.length - 1].motivo = 'sem valor numérico'
        continue
      }
      const totalCalculado = comQuantidade ? quantidade * unitario : null
      // Conflito é transitório: nenhuma opção ganha antes da escolha na revisão.
      // A tolerância abaixo só remove diferença de representação da máquina.
      const divergente = comQuantidade && Number.isFinite(totalCalculado) && totalPreenchido &&
        Math.abs(totalCalculado - totalDeclarado) > Number.EPSILON * Math.max(1, Math.abs(totalCalculado), Math.abs(totalDeclarado)) * 4
      const conflito = divergente ? {calculado:totalCalculado,declarado:totalDeclarado} : null
      const estimado = comQuantidade
        ? (Number.isFinite(totalCalculado) && totalPreenchido && !divergente ? totalDeclarado : totalCalculado)
        : (c.estimado != null ? parseMoney(row[c.estimado]) : 0)
      const realizado = c.realizado != null ? parseMoney(row[c.realizado]) : ''
      if (estimado === null) {
        recusarLinha(row, linha, [{campo:'estimado', original:row[c.estimado], motivo:motivoValor}])
        if (!secaoAtual.cat) res.descartes[res.descartes.length - 1].motivo = 'sem valor numérico'
        continue
      }
      if (realizado === null) res.recusasCelulas.push({
        planilha, linha, campo:'realizado', original:row[c.realizado],
        motivo: `${motivoValor} O realizado ficou não informado.`,
      })
      const item = {
        servico: str(servico),
        fornecedor: c.fornecedor != null ? str(row[c.fornecedor]) : '',
        estimado,
        realizado: realizado === null ? '' : realizado,
        status: c.status != null ? mapStatus(row[c.status]) : mapStatus(''),
        responsavel: c.responsavel != null ? str(row[c.responsavel]) : '',
        obs: c.obs != null ? str(row[c.obs]) : '',
      }
      // em seções não reconhecidas, itens sem valor são quase sempre lixo
      // (cronogramas, listas de tarefas) — descarta
      if (!secaoAtual.cat && num(item.estimado) <= 0 && num(item.realizado) <= 0) {
        res.descartes.push({ linha, motivo: 'sem valor numérico', amostra: amostraDaLinha(row) })
        continue
      }
      const key = secaoAtual.cat || `?${secaoAtual.titulo}`
      if (!res.categorias[key]) res.categorias[key] = []
      res.metadados[`custo:${key}:${res.categorias[key].length}`] = {
        planilha,linha,
        ...(comQuantidade ? {quantidade,unitario,totalCalculado,totalDeclarado,conflito} : {}),
        originais:{estimado:row[c.estimado],realizado:row[c.realizado],...(comQuantidade ? {quantidade:row[c.quantidade],unitario:row[c.unitario]} : {})},
      }
      res.categorias[key].push(item)
    } else {
      // não é vazia, cabeçalho, título de seção, lote nem linha TOTAL — e não
      // há seção aberta pra recebê-la como item: hoje ela já não ia pra lugar
      // nenhum, só ficava muda. Agora fica registrada.
      res.descartes.push({ linha, motivo: 'fora de qualquer seção reconhecida', amostra: amostraDaLinha(row) })
    }
  }
  return res
}

/**
 * Remove seções não reconhecidas que ficaram vazias (só tinham lixo) e os
 * avisos correspondentes.
 */
export function limparNaoReconhecidos(res) {
  for (const key of Object.keys(res.categorias)) {
    if (key.startsWith('?') && res.categorias[key].length === 0) delete res.categorias[key]
  }
  const validos = new Set(
    Object.keys(res.categorias)
      .filter((k) => k.startsWith('?'))
      .map((k) => k.slice(1))
  )
  res.avisos = res.avisos.filter((a) => {
    const m = a.match(/Seção não reconhecida: "([^"]+)"/)
    return !m || validos.has(m[1])
  })
  return res
}

/** Lê um ArrayBuffer .xlsx e devolve o resultado consolidado de todas as abas. */
export function parseWorkbookData(data) {
  const wb = XLSX.read(data, { type: 'array' })
  const res = { categorias: {}, lotes: [], avisos: [], descartes: [], planilhas: wb.SheetNames }
  for (const nome of wb.SheetNames) {
    const aoa = planilhaParaAOA(wb.Sheets[nome], { header: 1, raw: true, defval: null })
    parseAOA(aoa, res, nome)
  }
  return limparNaoReconhecidos(res)
}

export const ehLotePorta = (nome) => /PORTA/.test(normalizar(nome))
export const totalItens = (res) =>
  Object.values(res.categorias).reduce((s, itens) => s + itens.length, 0)
export const somaItens = (itens) =>
  (itens || []).reduce((s, i) => s + (num(i.realizado) > 0 ? num(i.realizado) : num(i.estimado)), 0)
