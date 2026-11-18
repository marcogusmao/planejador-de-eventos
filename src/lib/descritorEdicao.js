// De onde sai o RÓTULO e o AGRUPAMENTO de um passo de desfazer.
//
// Regra da casa (PADRAO-DA-CASA, "ação anuncia o efeito"): o botão diz o que
// vai desfazer — "Desfazer: mudar Margem alvo", "Desfazer: apagar item de
// custo". A regra irmã: se não der para nomear com honestidade, é melhor o
// rótulo genérico ("Desfazer a última alteração") do que um rótulo errado.
//
// Duas fontes, nessa ordem:
//
// 1. DESCRITOR EXPLÍCITO. Ações discretas (apagar item, duplicar previsão,
//    aplicar simulação, importar backup) passam `{ rotulo }` na chamada do
//    setStore/update. É o caminho preferido — o código que faz a ação é quem
//    melhor sabe nomeá-la.
// 2. CAMPO EM FOCO. Para a edição de campo — que é a maioria absoluta das
//    escritas e passaria por 44 pontos de chamada — o rótulo vem do que o
//    Marco está VENDO: o <label> do próprio campo (todo campo do app nasce
//    dentro de um <label> via `Field` em ui.jsx). Rótulo derivado da tela é
//    honesto por construção: é literalmente a palavra que está lá.
//
// O agrupamento da digitação contínua usa o PRÓPRIO ELEMENTO em foco como
// identidade do grupo (comparação por Object.is em historico.js). Dois lotes
// diferentes com um campo "Preço" cada são elementos diferentes — nunca se
// misturam num passo só, mesmo tendo o mesmo rótulo.
//
// A parte pura (`descritorDeCampo`) é testada em node com objetos simples; a
// leitura do DOM (`lerFocoAtual`) é a casca fina por cima.

/** Tipos de <input> em que digitar é digitar (o resto é clique: checkbox,
 *  radio, botão, arquivo — ação discreta, nunca agrupa). */
const TIPOS_DE_TEXTO = new Set(['text', 'number', 'search', 'tel', 'url', 'email', 'password', ''])

/**
 * Controles em que UMA ação humana vira MUITAS escritas — hoje o
 * `<input type="range">` dos sliders de cenário.
 *
 * (Verificação adversarial 19/07/2026, achado S2-C.) Um arrasto de ponta a
 * ponta dispara dezenas de eventos, e cada um virava um passo de desfazer: o
 * arrasto sozinho engolia os 50 passos da pilha e o Cmd+Z deixava de alcançar
 * qualquer coisa que o Marco tivesse feito antes na sessão.
 *
 * Não são campos de TEXTO (isso importa: em campo de texto o Cmd+Z é devolvido
 * ao navegador — ver atalhoHistorico.js — e um slider não tem desfazer nativo
 * para devolver). São campos AGRUPÁVEIS, que é outra coisa: valem a mesma
 * disciplina da digitação contínua — mesmo elemento, dentro da janela de
 * agrupamento, é UM passo.
 */
const TIPOS_CONTINUOS = new Set(['range'])

export function ehControleContinuo(info) {
  if (!info) return false
  if (String(info.tag || '').toLowerCase() !== 'input') return false
  return TIPOS_CONTINUOS.has(String(info.tipo ?? '').toLowerCase())
}

/**
 * O elemento em foco é um campo onde se DIGITA?
 * @param info { tag, tipo, editavel }
 */
export function ehCampoDeTexto(info) {
  if (!info) return false
  const tag = String(info.tag || '').toLowerCase()
  if (info.editavel) return true
  if (tag === 'textarea') return true
  if (tag !== 'input') return false
  return TIPOS_DE_TEXTO.has(String(info.tipo ?? '').toLowerCase())
}

// Limpa o texto do <label>: a unidade entre parênteses ("Preço (R$)") e o
// espaço não-quebrável que o Field injeta viram ruído no tooltip.
function limparRotulo(txt) {
  if (typeof txt !== 'string') return ''
  return txt
    .replace(/ /g, ' ')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rótulo curto demais ou comprido demais não ajuda ninguém — vira genérico. */
const rotuloUtil = (r) => r.length >= 2 && r.length <= 60

/**
 * Traduz o campo em foco num descritor de passo.
 * @param info { tag, tipo, editavel, elemento, rotulo }
 * @returns { rotulo, grupo } — grupo null = ação discreta (não agrupa).
 */
export function descritorDeCampo(info) {
  if (!ehCampoDeTexto(info) && !ehControleContinuo(info)) return { rotulo: '', grupo: null }
  const limpo = limparRotulo(info.rotulo)
  return {
    rotulo: rotuloUtil(limpo) ? `mudar ${limpo}` : '',
    // Sem elemento (ambiente sem DOM), o grupo cai para null: sem identidade
    // confiável, cada alteração vira seu próprio passo. Passo demais é chato;
    // passo que agrupa coisas diferentes é errado — e errado é pior.
    grupo: info.elemento ?? null,
  }
}

// ————— Casca de DOM —————

// Campo dentro de tabela (lotes, itens de custo, patrocínios, fechamento) não
// mora num <label> — quem o nomeia é o cabeçalho da COLUNA. Uma regra só cobre
// todas as tabelas do app. Colspan/rowspan tornam a conta de índice duvidosa:
// aí devolve vazio e o passo cai no rótulo genérico — nunca num rótulo errado.
function rotuloDaColuna(el) {
  const td = el.closest && el.closest('td')
  if (!td) return ''
  const linha = td.parentElement
  const tabela = td.closest('table')
  if (!linha || !tabela) return ''
  const celulas = Array.from(linha.children)
  if (celulas.some((c) => c.colSpan > 1)) return ''
  const i = celulas.indexOf(td)
  const cabecalho = tabela.querySelector('thead tr')
  if (!cabecalho) return ''
  const ths = Array.from(cabecalho.children)
  if (ths.length !== celulas.length || ths.some((c) => c.colSpan > 1)) return ''
  return ths[i]?.textContent || ''
}

function textoDoRotulo(el) {
  const aria = el.getAttribute && el.getAttribute('aria-label')
  if (aria) return aria
  const label = el.closest && el.closest('label')
  if (label) {
    // `Field` põe o texto do rótulo num <span> irmão; pegar o texto do <label>
    // inteiro traria junto o valor digitado em alguns navegadores.
    const span = label.querySelector('span')
    if (span && span.textContent) return span.textContent
  }
  const coluna = rotuloDaColuna(el)
  if (coluna) return coluna
  return el.getAttribute ? el.getAttribute('placeholder') || '' : ''
}

/**
 * A REGRA das duas fontes, num lugar só (era inline no App.jsx e por isso não
 * tinha teste — achado S2-D da verificação adversarial 19/07/2026).
 *
 * Quem nomeou a ação ganha. O foco só é consultado quando ninguém nomeou.
 * Isso não é preferência de estilo: `document.activeElement` no clique de um
 * botão é traiçoeiro — Safari e Firefox no macOS não focam <button> ao clicar,
 * então o foco continua no último campo de texto e o passo herdaria o nome
 * dele. Uma ação que substitui os custos do Marco anunciada como "mudar Margem
 * alvo" é um botão mentindo na hora mais perigosa.
 *
 * @param descritor  string (vira rótulo), objeto { rotulo, grupo } ou ausente
 * @param lerFoco    função que devolve o descritor do campo em foco
 */
export function resolverDescritor(descritor, lerFoco = lerFocoAtual) {
  const d = typeof descritor === 'string' ? { rotulo: descritor } : descritor
  return d || lerFoco()
}

/**
 * Lê o campo em foco AGORA e devolve o descritor do passo. Chamada no
 * manipulador de evento (nunca durante o render).
 */
export function lerFocoAtual(doc = typeof document !== 'undefined' ? document : null) {
  const el = doc && doc.activeElement
  if (!el || !el.tagName) return { rotulo: '', grupo: null }
  return descritorDeCampo({
    tag: el.tagName,
    tipo: el.getAttribute ? el.getAttribute('type') : null,
    editavel: !!el.isContentEditable,
    elemento: el,
    rotulo: textoDoRotulo(el),
  })
}
