// Planilha do PRODUTOR (feature de 20/07/2026, spec do Marco no handoff):
// o produtor recebe o orçamento do evento em .xlsx, ajusta o ORÇAMENTO — e o
// re-import atualiza CUSTOS ESTIMADOS e PATROCÍNIO, com revisão item a item
// antes de aplicar (princípio 7). Escopo cravado pelo Marco: SÓ custos e
// patrocínio; lotes/ingressos, bar e taxa/cashback/contingência ficam FORA
// dos dois lados. Realizado, status, parcelas e datas NUNCA são tocados pelo
// re-import — produtor mexe em orçamento, não em fato.
//
// Decisões conservadoras desta implementação (registradas):
// - ESTÁGIO de patrocínio sai na planilha só como INFORMATIVO: o re-import
//   IGNORA mudança de estágio (com aviso). Estágio fechado SOMA na receita —
//   promover receita é clique do Marco no app, nunca célula de planilha.
//   Patrocínio novo da planilha nasce 'proposta' (nunca soma sozinho).
// - REMOÇÃO (custo/patrocínio sumido da planilha) vira proposta que nasce
//   DESMARCADA na revisão — sumir linha por acidente não pode apagar item.
// - Categoria desconhecida em linha nova cai em "Extras" com aviso dito na
//   proposta — produtor não cria categoria.
//
// Identidade por linha: id_item/id_patrocinio (os ids REAIS do evento) — a
// reconciliação nunca é por posição nem por nome (padrão referenciaDoCusto
// do plano do Financeiro). Linha nova = id vazio.
//
// Blindagem anti-fórmula (portão C — o arquivo SAI da casa): texto começando
// com = + - @ TAB CR ganha apóstrofo; o re-import tira o MESMO apóstrofo na
// volta (round-trip byte a byte, igual ao par CSV do plano ↔ Financeiro).
// Este módulo trabalha sobre array-of-arrays (AOA), como xlsxImport.js — a
// lógica é testável sem arquivo real; quem fala com a lib é o modal.

import { normalizar, parseMoney } from './xlsxImport.js'
import { novoItem } from './defaults.js'
import { uid } from './util.js'
import { FAIXA_CUSTO, FAIXA_PATROCINIO, avisoDaFaixa } from './campoNumerico.js'

export const MARCADOR_ORCAMENTO = 'PREVISAO-EVENTOS:ORCAMENTO:v1'
const TITULO_CUSTOS = 'CUSTOS'
const TITULO_PATROCINIO = 'PATROCÍNIO'
const CABECALHO_CUSTOS = ['id_item', 'Categoria', 'Serviço / produto', 'Fornecedor', 'Estimado (R$)', 'Observações']
const CABECALHO_PATROCINIO = ['id_patrocinio', 'Patrocinador', 'Valor (R$)', 'Estágio (informativo — o app decide)']
export const INSTRUCOES_PRODUTOR =
  'Como usar: ajuste Estimado, Fornecedor, Serviço e Observações; em patrocínio, Patrocinador e Valor. ' +
  'Custo novo: linha com id_item VAZIO e o nome da Categoria. Para remover, apague a linha. ' +
  'Não mexa na primeira linha, nos títulos nem nos ids — são a identidade das linhas.'

const GATILHOS_FORMULA = ['=', '+', '-', '@', '\t', '\r']
// Simetria blindar↔desblindar (achado do ataque, 20/07/2026): dado LEGÍTIMO
// que já começa com apóstrofo (ex.: "'-20% à vista") também é escapado —
// senão o desblindar da volta comia o apóstrofo do Marco. O par cobre o
// round-trip puro; se o Excel do produtor engolir o apóstrofo de escape
// (quotePrefix) nesse canto raro, o diff aparece VISÍVEL na revisão — nunca
// silencioso.
const escapavel = (ch) => GATILHOS_FORMULA.includes(ch) || ch === "'"
const blindar = (v) => {
  const s = String(v ?? '')
  return s && escapavel(s[0]) ? `'${s}` : s
}
const desblindar = (v) => {
  const s = String(v ?? '')
  return s.startsWith("'") && s.length > 1 && escapavel(s[1]) ? s.slice(1) : s
}
const texto = (v) => desblindar(String(v ?? '').trim())

// Valor de célula de dinheiro: número da planilha passa direto; string passa
// pela MESMA grade BR do importador (parseMoney). Vazio = '' (não 0 — o
// orçamento em branco é "não sei", nunca "de graça").
const valorCelula = (v) => {
  if (v == null || String(v).trim() === '') return ''
  return parseMoney(v)
}

const valorParaExport = (v) => {
  const valor = valorCelula(v)
  if (valor === null) throw new Error('Valor estimado ou de patrocínio não reconhecido — corrija no app antes de exportar.')
  return valor
}

/**
 * Acha a ABA do orçamento num workbook lido pelo SheetJS: a que tem o
 * MARCADOR em A1 — não a primeira (achado do ataque: o produtor cria uma aba
 * de rascunho que fica na frente e o retorno VÁLIDO era recusado com a
 * mensagem errada). Devolve o nome da aba, ou null (o chamador diz quais
 * abas o arquivo tem). Recebe o objeto workbook cru para a lógica ficar
 * testável fora do modal.
 */
export function acharAbaOrcamento(wb) {
  for (const nome of wb?.SheetNames || []) {
    const a1 = wb.Sheets?.[nome]?.A1
    if (a1 && String(a1.v ?? '').trim() === MARCADOR_ORCAMENTO) return nome
  }
  return null
}

/** Monta o AOA da planilha do produtor a partir do evento (leitura pura). */
export function montarAOAOrcamento(evento) {
  const aoa = []
  // O nome entra no MEIO da string do título ("Orçamento — X") — blindagem
  // ali era inócua e deixava um apóstrofo visível no meio do texto.
  aoa.push([MARCADOR_ORCAMENTO, evento.id, `Orçamento — ${evento.nome || ''}`])
  aoa.push([])
  aoa.push([TITULO_CUSTOS])
  aoa.push([...CABECALHO_CUSTOS])
  for (const c of evento.categorias || [])
    for (const i of c.itens || [])
      aoa.push([
        i.id,
        blindar(c.nome || ''),
        blindar(i.servico || ''),
        blindar(i.fornecedor || ''),
        valorParaExport(i.estimado),
        blindar(i.obs || ''),
      ])
  aoa.push([])
  aoa.push([TITULO_PATROCINIO])
  aoa.push([...CABECALHO_PATROCINIO])
  for (const p of evento.patrocinios || [])
    aoa.push([
      p.id,
      blindar(p.patrocinador || ''),
      valorParaExport(p.valor),
      p.estagio || 'proposta',
    ])
  aoa.push([])
  aoa.push([INSTRUCOES_PRODUTOR])
  return aoa
}

/**
 * Lê o AOA de volta. Devolve { ok:false, erro } quando o arquivo não é a
 * planilha do produtor (sem o marcador) — em português, dito na tela. O
 * eventoId volta para o CHAMADOR conferir contra o evento aberto (planilha
 * de outro evento é recusada lá, com o nome na mensagem).
 */
export function parseAOAOrcamento(aoa) {
  if (!Array.isArray(aoa) || !aoa.length || texto(aoa[0]?.[0]) !== MARCADOR_ORCAMENTO)
    return {
      ok: false,
      erro:
        'Este arquivo não é a planilha do produtor gerada pelo app (o marcador da primeira linha não está lá). Exporte de novo em Planilha do produtor e envie aquele arquivo.',
    }
  const eventoId = String(aoa[0]?.[1] ?? '').trim()
  const custos = []
  const patrocinios = []
  const avisos = []
  let secao = null
  for (let li = 1; li < aoa.length; li++) {
    const linha = aoa[li] || []
    const a = texto(linha[0])
    const N = normalizar(a)
    if (N === normalizar(TITULO_CUSTOS)) {
      secao = 'custos'
      continue
    }
    if (N === normalizar(TITULO_PATROCINIO)) {
      secao = 'patrocinio'
      continue
    }
    if (!secao || linha.every((c) => String(c ?? '').trim() === '')) continue
    if (N === 'ID_ITEM' || N === 'ID_PATROCINIO') continue // cabeçalho
    if (a.startsWith('Como usar:')) continue
    if (secao === 'custos') {
      const [id, cat, serv, forn, est, obs] = linha
      const item = {
        idItem: String(id ?? '').trim() || null,
        categoriaNome: texto(cat),
        servico: texto(serv),
        fornecedor: texto(forn),
        estimado: valorCelula(est),
        originalEstimado: est,
        obs: texto(obs),
        linha: li + 1,
      }
      // Linha sem NADA de identificável (só categoria, digitada por engano)
      // não vira item fantasma — avisa e pula.
      if (!item.idItem && !item.servico && item.estimado === '') {
        if (item.categoriaNome) avisos.push(`Linha ${li + 1} ignorada: sem serviço e sem valor.`)
        continue
      }
      custos.push(item)
    } else {
      const [id, patroc, val, estagio] = linha
      const p = {
        id: String(id ?? '').trim() || null,
        patrocinador: texto(patroc),
        valor: valorCelula(val),
        originalValor: val,
        estagio: texto(estagio),
        linha: li + 1,
      }
      if (!p.id && !p.patrocinador && p.valor === '') {
        // Só o estágio preenchido não identifica patrocínio nenhum — dito,
        // nunca descartado calado (achado do ataque).
        if (p.estagio) avisos.push(`Linha ${li + 1} ignorada: sem patrocinador e sem valor.`)
        continue
      }
      patrocinios.push(p)
    }
  }
  return { ok: true, eventoId, custos, patrocinios, avisos }
}

const achaCategoriaPorNome = (evento, nome) => {
  const N = normalizar(nome)
  return (evento.categorias || []).find((c) => normalizar(c.nome) === N) || null
}
const achaItem = (evento, id) => {
  for (const c of evento.categorias || [])
    for (const i of c.itens || []) if (i.id === id) return { c, i }
  return null
}

// Texto compara TRIMADO dos dois lados (achado do ataque: 141/320 do fuzz):
// o parse trima o que vem da planilha, mas o dado salvo pode ter espaço/
// quebra na ponta (autocomplete de celular grava "Segurança ") — comparar o
// cru contra o trimado criava proposta fantasma invisível a olho nu, que
// vinha PRÉ-MARCADA e reescrevia o texto em silêncio. Diferença só de
// espaço nas pontas não é mudança; o dado salvo fica exatamente como está.
const mudouTexto = (a, b) => String(a ?? '').trim() !== String(b ?? '').trim()
// null é valor salvo ilegível; '' é uma limpeza legítima recebida.
const mudouValor = (a, b) => (a === null) !== (b === null) || String(a ?? '') !== String(b ?? '')

/**
 * O DIFF para a revisão: cada proposta diz ação, alvo e o antes → depois em
 * português. `selecionadaPorPadrao` implementa a regra conservadora: alterar
 * e novo nascem marcadas; REMOVER nasce desmarcada.
 */
export function montarPropostasOrcamento(evento, lido) {
  const propostas = []
  const recusadas = []
  const recusar = (l, tipo, campo, original, id, motivo) => recusadas.push({
    linha:l.linha, tipo, campo, original, id,
    motivo: motivo || 'Valor não reconhecido — informe só o número, sem anotações. Esta linha não altera o evento.',
  })
  const avisos = [...(lido.avisos || [])]
  const idsNaPlanilha = new Set()

  for (const l of lido.custos) {
    if (l.estimado === null || (l.estimado !== '' && !Number.isFinite(l.estimado)) || avisoDaFaixa(l.estimado, FAIXA_CUSTO)) {
      if (l.idItem) idsNaPlanilha.add(l.idItem)
      recusar(l, 'custo', 'estimado', l.originalEstimado, l.idItem, avisoDaFaixa(l.estimado, FAIXA_CUSTO))
      continue
    }
    if (l.idItem) {
      // id DUPLICADO na planilha (produtor copiou a linha inteira): a
      // primeira ocorrência vale; as seguintes seriam propostas
      // CONFLITANTES sobre o mesmo item — ignoradas com aviso.
      if (idsNaPlanilha.has(l.idItem)) {
        avisos.push(
          `Linha ${l.linha}: id_item duplicado na planilha — só a primeira ocorrência vale; esta foi ignorada.`
        )
        continue
      }
      // Marca o id como visto AQUI — inclusive os desconhecidos: duas linhas
      // com o mesmo id fantasma viravam DOIS custos novos (achado do ataque).
      idsNaPlanilha.add(l.idItem)
      const achado = achaItem(evento, l.idItem)
      if (!achado) {
        avisos.push(
          `Linha ${l.linha}: o id_item não existe mais neste evento — tratada como custo NOVO.`
        )
      } else {
        const { c, i } = achado
        // Categoria mudada na planilha: mover item de categoria é ação do
        // app (arrasta a estrutura do orçamento) — IGNORADA, com aviso.
        if (l.categoriaNome && normalizar(l.categoriaNome) !== normalizar(c.nome))
          avisos.push(
            `“${i.servico || 'Custo sem nome'}” foi movida de categoria na planilha (${c.nome} → ${l.categoriaNome}) — mudança de categoria é feita no app e foi IGNORADA.`
          )
        const mudancas = []
        if (mudouValor(valorCelula(i.estimado), l.estimado))
          mudancas.push({ campo: 'estimado', de: i.estimado, para: l.estimado })
        if (mudouTexto(i.servico, l.servico)) mudancas.push({ campo: 'servico', de: i.servico, para: l.servico })
        if (mudouTexto(i.fornecedor, l.fornecedor))
          mudancas.push({ campo: 'fornecedor', de: i.fornecedor, para: l.fornecedor })
        if (mudouTexto(i.obs, l.obs)) mudancas.push({ campo: 'obs', de: i.obs, para: l.obs })
        if (mudancas.length)
          propostas.push({
            id: uid(),
            tipo: 'custo',
            acao: 'alterar',
            alvoId: l.idItem,
            rotulo: `${i.servico || 'Custo sem nome'} (${c.nome})`,
            mudancas,
            selecionadaPorPadrao: true,
          })
        continue
      }
    }
    // novo (sem id, ou id que não existe mais). Categoria desconhecida cai
    // numa categoria QUE EXISTE — extras quando houver, senão a primeira —
    // dito no rótulo; custo aprovado na revisão nunca pode sumir no aplicar.
    const cat = achaCategoriaPorNome(evento, l.categoriaNome)
    const fallback =
      (evento.categorias || []).find((c) => c.id === 'extras') || (evento.categorias || [])[0] || null
    propostas.push({
      id: uid(),
      tipo: 'custo',
      acao: 'novo',
      categoriaId: cat ? cat.id : fallback ? fallback.id : 'extras',
      rotulo: `${l.servico || 'Custo sem nome'} (${
        cat
          ? cat.nome
          : `categoria “${l.categoriaNome}” não existe — entra em ${fallback ? fallback.nome : 'Extras & Conting.'}`
      })`,
      dados: { servico: l.servico, fornecedor: l.fornecedor, estimado: l.estimado, obs: l.obs },
      selecionadaPorPadrao: true,
    })
  }

  for (const c of evento.categorias || [])
    for (const i of c.itens || [])
      if (!idsNaPlanilha.has(i.id))
        propostas.push({
          id: uid(),
          tipo: 'custo',
          acao: 'remover',
          alvoId: i.id,
          rotulo: `${i.servico || 'Custo sem nome'} (${c.nome}) — sumiu da planilha`,
          selecionadaPorPadrao: false,
        })

  const idsPatNaPlanilha = new Set()
  for (const l of lido.patrocinios) {
    if (l.valor === null || (l.valor !== '' && !Number.isFinite(l.valor)) || avisoDaFaixa(l.valor, FAIXA_PATROCINIO)) {
      if (l.id) idsPatNaPlanilha.add(l.id)
      recusar(l, 'patrocinio', 'valor', l.originalValor, l.id, avisoDaFaixa(l.valor, FAIXA_PATROCINIO))
      continue
    }
    if (l.id && idsPatNaPlanilha.has(l.id)) {
      avisos.push(
        `Linha ${l.linha}: id_patrocinio duplicado na planilha — só a primeira ocorrência vale; esta foi ignorada.`
      )
      continue
    }
    const atual = l.id ? (evento.patrocinios || []).find((p) => p.id === l.id) : null
    if (atual) {
      idsPatNaPlanilha.add(atual.id)
      if (l.estagio && normalizar(l.estagio) !== normalizar(atual.estagio || 'proposta'))
        avisos.push(
          `Patrocínio “${atual.patrocinador || 'sem nome'}”: mudança de estágio na planilha foi IGNORADA — estágio só muda no app (é ele que decide o que soma na receita).`
        )
      const mudancas = []
      if (mudouTexto(atual.patrocinador, l.patrocinador))
        mudancas.push({ campo: 'patrocinador', de: atual.patrocinador, para: l.patrocinador })
      if (mudouValor(valorCelula(atual.valor), l.valor))
        mudancas.push({ campo: 'valor', de: atual.valor, para: l.valor })
      if (mudancas.length)
        propostas.push({
          id: uid(),
          tipo: 'patrocinio',
          acao: 'alterar',
          alvoId: atual.id,
          rotulo: `Patrocínio ${atual.patrocinador || 'sem nome'}`,
          mudancas,
          selecionadaPorPadrao: true,
        })
    } else {
      if (l.id)
        avisos.push(`Linha ${l.linha}: id_patrocinio não existe mais — tratado como patrocínio NOVO.`)
      propostas.push({
        id: uid(),
        tipo: 'patrocinio',
        acao: 'novo',
        rotulo: `Patrocínio ${l.patrocinador || 'sem nome'} (nasce como proposta — não soma na receita até o app promover)`,
        dados: { patrocinador: l.patrocinador, valor: l.valor },
        selecionadaPorPadrao: true,
      })
    }
  }
  for (const p of evento.patrocinios || [])
    if (!idsPatNaPlanilha.has(p.id))
      propostas.push({
        id: uid(),
        tipo: 'patrocinio',
        acao: 'remover',
        alvoId: p.id,
        rotulo: `Patrocínio ${p.patrocinador || 'sem nome'} — sumiu da planilha`,
        selecionadaPorPadrao: false,
      })

  return { propostas, avisos, recusadas }
}

/**
 * Aplica as propostas SELECIONADAS. Pura: devolve evento novo, nunca muta.
 * Só encosta em estimado/servico/fornecedor/obs dos custos e em
 * patrocinador/valor dos patrocínios — realizado, status, parcelas, datas e
 * estágio ficam como estavam, por contrato.
 */
export function aplicarPropostasOrcamento(evento, propostas, idsSelecionados) {
  const sel = new Set(idsSelecionados)
  const ativas = propostas.filter((p) => sel.has(p.id))
  let categorias = (evento.categorias || []).map((c) => ({ ...c, itens: [...(c.itens || [])] }))
  let patrocinios = [...(evento.patrocinios || [])]

  for (const p of ativas) {
    if (p.tipo === 'custo' && p.acao === 'alterar')
      categorias = categorias.map((c) => ({
        ...c,
        itens: c.itens.map((i) =>
          i.id === p.alvoId
            ? { ...i, ...Object.fromEntries(p.mudancas.map((m) => [m.campo, m.para])) }
            : i
        ),
      }))
    if (p.tipo === 'custo' && p.acao === 'remover')
      categorias = categorias.map((c) => ({ ...c, itens: c.itens.filter((i) => i.id !== p.alvoId) }))
    if (p.tipo === 'custo' && p.acao === 'novo') {
      // Rede final: se a categoria destino não existir (evento sem
      // categoria nenhuma), ela é CRIADA — custo aprovado na revisão nunca
      // é descartado em silêncio.
      if (!categorias.some((c) => c.id === p.categoriaId))
        categorias = [...categorias, { id: p.categoriaId, nome: 'Extras & Conting.', padrao: true, itens: [] }]
      categorias = categorias.map((c) =>
        c.id === p.categoriaId ? { ...c, itens: [...c.itens, novoItem({ ...p.dados })] } : c
      )
    }
    if (p.tipo === 'patrocinio' && p.acao === 'alterar')
      patrocinios = patrocinios.map((x) =>
        x.id === p.alvoId
          ? { ...x, ...Object.fromEntries(p.mudancas.map((m) => [m.campo, m.para])) }
          : x
      )
    if (p.tipo === 'patrocinio' && p.acao === 'remover')
      patrocinios = patrocinios.filter((x) => x.id !== p.alvoId)
    if (p.tipo === 'patrocinio' && p.acao === 'novo')
      patrocinios = [
        ...patrocinios,
        { id: uid(), patrocinador: p.dados.patrocinador, valor: p.dados.valor, estagio: 'proposta' },
      ]
  }
  return { ...evento, categorias, patrocinios }
}
