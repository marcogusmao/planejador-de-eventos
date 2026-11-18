// Exportar pagamentos — destinos Contador e Para mim (Sessão F2-C, pedido do
// Marco em 19/07/2026). O terceiro destino (→ Financeiro) é o export do plano
// da Sessão M (planoFinanceiro.js), inalterado — os três moram no mesmo menu.
//
// ——— CONTADOR: formato EXATO do item 13 do BACKLOG do Financeiro (contrato
// v1, Sessão F2-D de lá — "os dois apps falam igual com o contador"): CSV
// UTF-8 com BOM, separador ";", fim de linha CRLF, UMA linha de cabeçalho,
// datas DD/MM/AAAA, valores em magnitude positiva com decimal BR de 2 casas
// SEM milhar ("8800,00"), escape RFC 4180 (aspas quando o campo tem ";",
// aspas ou quebra; aspas internas dobradas) e BLINDAGEM DE FÓRMULA: célula
// começando com "=", "+", "@", TAB ou CR ganha apóstrofo à frente (o "-"
// fica de fora — valores negativos legítimos). Colunas (9, nesta ordem):
//   Data ; Descrição ; Categoria ; Grupo ; Marca ; Evento ; Valor ; Tipo ;
//   Método de pagamento
//
// MAPEAMENTO previsão → colunas do contador (documentado aqui, "na medida do
// que a previsão tem"):
//   Data      = data de pagamento do custo/parcela; SEM data → data do evento
//               (avisado na tela de revisão — o contador precisa de uma data)
//   Descrição = serviço do item (+ " · parcela k/N" quando parcelado);
//               fornecedor entra entre parênteses quando preenchido
//   Categoria = a MESMA tradução de categoria que o export do plano usa
//               (categoriaFinanceiroCusto de planoFinanceiro.js — os dois
//               arquivos falam a mesma língua)
//   Grupo     = "Custo de evento" (tudo aqui é custo de evento da previsão)
//   Marca     = a "Festa" do evento (tipo — grafia das marcas do Financeiro)
//   Evento    = nome do evento
//   Valor     = valor da parcela/custo (magnitude positiva, "1234,56")
//   Tipo      = "Despesa" (a previsão não manda receita ao contador)
//   Método de pagamento = vazio (a previsão não guarda método)
//
// ——— PARA MIM: planilha simples (uso próprio). A descrição É blindada contra
// fórmula desde 21/07/2026 (Marco, via H3-AUDIT — antes saía crua "por ser a
// minha planilha", mas abrir um arquivo que executa fórmula não valia o risco).
// O escape CSV continua. Mesma base (UTF-8+BOM, ";", CRLF, DD/MM/AAAA, valores
// BR), colunas:
//   Vencimento ; Fornecedor / descrição ; Valor ; Status ; Parcela
// ordenado por vencimento (sem data no fim), com linha final TOTAL.
//
// Export NUNCA altera dados: tudo aqui é leitura pura sobre o evento; o
// download é o único efeito (mesmo padrão de planoFinanceiro.js).

import { num } from './util.js'
import { STATUS_CUSTO_PADRAO } from './statusCusto.js'
import { hojeISO } from './dataLocal.js'
import { custouZeroEfetivo } from './calc.js'
import { agendaDoItem, divergenciaParcelas } from './parcelas.js'
import { categoriaFinanceiroCusto } from './planoFinanceiro.js'

export const BOM = '\uFEFF'

// ————— blocos do formato (idênticos ao contrato do item 13) —————

/** Escape CSV RFC 4180 para separador ";". */
export function escaparCSV(v) {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Blindagem de fórmula (contador E "para mim" desde 21/07/2026): =, +, @, -, TAB, CR.
 *  O "-" entrou em 20/07/2026 (Marco) para alinhar aos 6 gatilhos do backend
 *  do Financeiro (mesmo conjunto nos dois apps). É seguro porque a coluna Valor
 *  é sempre magnitude positiva (valorBR usa Math.abs), então "-" no início só
 *  aparece em DESCRIÇÃO — nunca num número legítimo. */
export function blindarCelula(v) {
  const s = String(v ?? '')
  return /^[=+@\t\r-]/.test(s) ? `'${s}` : s
}

/** Valor BR do contrato: magnitude positiva, 2 casas, vírgula, SEM milhar. */
export function valorBR(v) {
  return Math.abs(num(v)).toFixed(2).replace('.', ',')
}

/** AAAA-MM-DD → DD/MM/AAAA (contrato); outra coisa passa como veio. */
export function dataBR(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.split('-').reverse().join('/')
    : String(iso ?? '')
}

// ————— pagamentos exportáveis (leitura pura sobre o evento) —————

/**
 * Todos os pagamentos do evento (uma linha por custo; uma POR PARCELA quando
 * houver), para a revisão item a item. Cada um:
 * { id, rotulo, fornecedor, categoriaPrevisao, categoriaFin, valor, data,
 *   parcela, status, paga, dataPaga } — data '' = sem vencimento (a tela
 * avisa o destino); paga/dataPaga (sugestão 38) marcam parcela QUITADA — ela
 * continua exportável (o contador precisa do registro do gasto), rotulada.
 * Avisos: divergências de parcelas (a agenda usa as parcelas) e contagem de
 * sem-data (parcela paga não conta — quitada não "deve" data). Valor 0 não
 * vira linha.
 */
export function montarPagamentos(evento) {
  const pagamentos = []
  const avisos = []
  let semData = 0
  for (const cat of evento?.categorias || []) {
    for (const item of cat.itens || []) {
      const d = divergenciaParcelas(item)
      if (d)
        avisos.push(
          `As parcelas de “${item.servico || cat.nome}” somam R$ ${valorBR(d.soma)}, mas o custo é R$ ${valorBR(d.valor)} — o arquivo leva as parcelas. Ajuste na aba Custos se não for isso.`
        )
      // P3 (Marco, 20/07/2026): um item marcado "custou zero" SAI LISTADO com
      // R$ 0 no arquivo do contador (registro do custo que virou permuta/
      // cortesia) — não some em silêncio. Os demais R$ 0 (custo vazio) seguem
      // fora, como sempre ("não se paga R$ 0").
      const marcadoZero = custouZeroEfetivo(item)
      for (const pag of agendaDoItem(item)) {
        if (num(pag.valor) <= 0 && !marcadoZero) continue
        if (!pag.data && !pag.paga) semData++
        pagamentos.push({
          id: `${item.id}${pag.parcela ? `:${pag.parcela.k}` : ''}`,
          rotulo: item.servico || cat.nome,
          fornecedor: item.fornecedor || '',
          categoriaPrevisao: cat.nome,
          categoriaFin: categoriaFinanceiroCusto(cat.id),
          valor: num(pag.valor),
          data: pag.data,
          parcela: pag.parcela,
          status: item.status || STATUS_CUSTO_PADRAO,
          paga: pag.paga,
          dataPaga: pag.dataPaga,
        })
      }
    }
  }
  // ordenado por vencimento; sem data no fim (nunca some — vai avisado)
  pagamentos.sort((a, b) => {
    if (!a.data && !b.data) return a.rotulo.localeCompare(b.rotulo, 'pt-BR')
    if (!a.data) return 1
    if (!b.data) return -1
    return a.data.localeCompare(b.data) || a.rotulo.localeCompare(b.rotulo, 'pt-BR')
  })
  return { pagamentos, avisos, semData }
}

const descricaoPagamento = (p) =>
  `${p.rotulo}${p.fornecedor ? ` (${p.fornecedor})` : ''}${p.parcela ? ` · parcela ${p.parcela.k}/${p.parcela.n}` : ''}`

// ————— CONTADOR (blindado, contrato do item 13) —————

const CABECALHO_CONTADOR = [
  'Data',
  'Descrição',
  'Categoria',
  'Grupo',
  'Marca',
  'Evento',
  'Valor',
  'Tipo',
  'Método de pagamento',
]

/**
 * Gera o CSV do contador a partir dos pagamentos SELECIONADOS na revisão.
 * Campo a campo: blindagem primeiro, escape depois (mesma ordem do
 * Financeiro — a aspa protege o apóstrofo, nunca o contrário).
 * Pagamento sem data usa a DATA DO EVENTO (documentado no topo; a tela avisa).
 */
export function gerarCSVContador(pagamentosSelecionados, evento) {
  const celula = (v) => escaparCSV(blindarCelula(v))
  const linhas = [CABECALHO_CONTADOR.map(celula).join(';')]
  for (const p of pagamentosSelecionados) {
    linhas.push(
      [
        celula(dataBR(p.data || evento.data)),
        celula(descricaoPagamento(p)),
        celula(p.categoriaFin),
        celula('Custo de evento'),
        celula(evento.tipo || ''),
        celula(evento.nome || ''),
        celula(valorBR(p.valor)),
        celula('Despesa'),
        celula(''),
      ].join(';')
    )
  }
  return BOM + linhas.join('\r\n') + '\r\n'
}

// ————— PARA MIM (descrição blindada desde 21/07/2026; o escape continua) —————

const CABECALHO_MIM = ['Vencimento', 'Fornecedor / descrição', 'Valor', 'Status', 'Parcela']

export function gerarCSVParaMim(pagamentosSelecionados) {
  const linhas = [CABECALHO_MIM.map(escaparCSV).join(';')]
  let total = 0
  for (const p of pagamentosSelecionados) {
    total += num(p.valor)
    linhas.push(
      [
        escaparCSV(dataBR(p.data)),
        // Descrição blindada (Marco 21/07/2026, via H3-AUDIT): mesma régua do
        // contador — se o texto começa com =, +, @, - o Excel poderia lê-lo como
        // fórmula; o apóstrofo à frente neutraliza. Só a descrição é texto livre.
        escaparCSV(blindarCelula(`${p.rotulo}${p.fornecedor ? ` (${p.fornecedor})` : ''}`)),
        escaparCSV(valorBR(p.valor)),
        escaparCSV(p.status),
        // Parcela quitada sai rotulada (sugestão 38) — a coluna do contador
        // NÃO muda (contrato do item 13); esta planilha é nossa.
        escaparCSV(
          p.parcela
            ? `${p.parcela.k}/${p.parcela.n}${p.paga ? ` · paga${p.dataPaga ? ` em ${dataBR(p.dataPaga)}` : ''}` : ''}`
            : ''
        ),
      ].join(';')
    )
  }
  linhas.push(['', 'TOTAL', valorBR(total), '', ''].map(escaparCSV).join(';'))
  return BOM + linhas.join('\r\n') + '\r\n'
}

// ————— nomes de arquivo e download —————

const slugArquivo = (s) =>
  String(s || 'evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'evento'

export function nomeArquivoContador(evento) {
  const data = evento.data || hojeISO()
  return `contador-${slugArquivo(evento.nome)}-${data}.csv`
}

export function nomeArquivoParaMim(evento) {
  const data = evento.data || hojeISO()
  return `pagamentos-${slugArquivo(evento.nome)}-${data}.csv`
}

/** Efeito colateral (download) — mesmo padrão de planoFinanceiro.js. */
export function baixarCSV(csv, nomeArquivo) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(a.href)
}
