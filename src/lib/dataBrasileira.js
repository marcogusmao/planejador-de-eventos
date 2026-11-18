// As contas de DATA do calendário próprio (pedido do Marco: "o calendário do
// navegador é ruim para trocar de ano"). Módulo PURO — sem React, sem DOM.
//
// ————— por que existe um módulo novo, e não mais funções no dataLocal.js —————
//
// `dataLocal.js` é O RELÓGIO: uma responsabilidade só, documentada, e a única
// peça da casa que transforma `Date` em string. Este aqui é O TECLADO E A GRADE:
// interpretar o que se digita, montar o mês, andar com as setas. Todo ISO que
// sai daqui sai por `dataISOLocal`, então continua havendo UM lugar que faz a
// conversão — a regra anti-fuso de 20/07/2026 não ganha uma segunda casa.
//
// ————— o defeito que este módulo existe para NÃO deixar nascer —————
//
// Hoje, quem impede uma data impossível de entrar no app é o widget
// `<input type="date">` do navegador. Trocá-lo por componente próprio REMOVE
// essa rede, e a rede que sobra é fraca:
//
//     /^\d{4}-\d{2}-\d{2}$/.test('2026-02-31')   => true   (migracao.js:324)
//     dataValida('2026-02-31')                    => true   (curvaVendas.js:245)
//     new Date('2026-02-31T12:00:00')             => Tue Mar 03 2026
//
// Ou seja: `2026-02-31` atravessa a migração intacto e a casa INTEIRA o lê como
// 3 de março. Data errada mostrada como certa é o pior defeito do rulebook. Por
// isso a validação aqui é por ROUND-TRIP DE COMPONENTES — monta a data pelo
// construtor de componentes e confere que dia, mês e ano voltam iguais. O que
// rolou para o mês seguinte não volta igual, e é recusado.
//
// ————— o que este módulo NÃO faz —————
//
// Nenhuma conta de negócio, nenhuma leitura de schema. E nenhuma linha chama
// `toISOString` — há teste varrendo o texto-fonte deste arquivo atrás dessa
// palavra, porque foi ela que produziu o S1 do relógio.

import { dataISOLocal } from './dataLocal.js'

export const NOMES_MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// Semana começa no DOMINGO — é o que o calendário nativo que o Marco já usa
// faz, então a grade não muda de lugar debaixo da mão dele.
export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Constrói um Date pelo relógio LOCAL a partir dos componentes. */
const dataLocal = (ano, mes, dia) => new Date(ano, mes - 1, dia, 12, 0, 0, 0)

/**
 * A data (ano, mes, dia) EXISTE no calendário?
 *
 * Round-trip de componentes: 31 de fevereiro vira 3 de março no construtor, e
 * `getDate()` devolve 3 em vez de 31 — a discordância é a recusa. É a única
 * checagem que pega bissexto sem tabela: 29/02/2024 volta igual, 29/02/2026 não.
 */
function existeNoCalendario(ano, mes, dia) {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return false
  // O ANO TEM DE TER QUATRO DÍGITOS (conserto de 05/08/2026, achado pela revisão
  // adversarial). Sem esta linha, `01/01/0999` passava no round-trip de
  // componentes e saía como `"999-01-01"` — que NÃO é ISO: `dataISOLocal`
  // completa com zero o mês e o dia, nunca o ano. A string de 3 caracteres
  // vazava para fora e fazia três estragos de uma vez, todos medidos:
  //
  //   - `dataBR()` do exportPagamentos não reconhece a forma e escreve ela CRUA
  //     no arquivo do contador, que exige DD/MM/AAAA;
  //   - `localeCompare` põe '9…' depois de '2…', e a ordem do arquivo sai errada;
  //   - a migração APAGA a data no carregamento seguinte, em silêncio.
  //
  // Ano de 1 a 99 também sai por aqui, e é o mesmo tipo de coisa: `new Date(50,
  // 0, 1)` é 1950, não o ano 50 — o construtor mapeia 0-99 para 1900+n. Recusar
  // os dois é a única resposta que não inventa nada.
  if (ano < 1000 || ano > 9999) return false
  if (mes < 1 || mes > 12 || dia < 1) return false
  const d = dataLocal(ano, mes, dia)
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
}

/** Uma string é uma data ISO que EXISTE de verdade? (forma E calendário) */
export function ehDataISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [a, m, d] = s.split('-').map(Number)
  return existeNoCalendario(a, m, d)
}

// Digitação a meio caminho: só dígitos e barras, ainda sem os 8 dígitos. Não
// avisa nem grava — a pessoa está no meio do caminho.
const SO_SEPARADOR = /^[\s/]*$/

/**
 * O que dizer quando alguém DECLARA ter terminado (Enter) com a digitação pela
 * metade — o único momento em que "incompleto" deixa de ser paciência e vira
 * recusa. Mora aqui, junto dos outros motivos, para não nascer uma segunda
 * família de mensagens de data espalhada pelos componentes.
 */
export const AVISO_DATA_INCOMPLETA = 'Data incompleta — use dd/mm/aaaa (ex.: 05/08/2026)'

/**
 * Interpreta o texto de um campo de data brasileiro.
 *
 * A forma de retorno é a MESMA de `parseCampoNumerico` (campoNumerico.js), de
 * propósito: o componente reusa a máquina de estados de rascunho/aviso que o
 * `NumInput` já tem provada, em vez de inventar uma segunda.
 *
 * - { valido: true, valor: 'AAAA-MM-DD' }  → data que existe
 * - { valido: true, valor: '' }            → vazio = "não informado" (nunca vira hoje)
 * - { valido: false, incompleto: true }    → digitação a meio caminho; não avisar
 * - { valido: false, incompleto: false, motivo } → recusar e AVISAR em português
 *
 * Aceita `05/08/2026`, `5/8/2026` e `05082026`. Ano de DOIS dígitos é recusado
 * de propósito: "26" é ambíguo (1926? 2026?) e adivinhar é inventar dado do
 * Marco. Quem quer 1998 usa a grade de anos, que resolve em dois cliques.
 */
export function parseDataBR(texto) {
  const bruto = String(texto ?? '').trim()
  if (!bruto) return { valido: true, valor: '' }
  if (SO_SEPARADOR.test(bruto)) return { valido: false, incompleto: true }
  if (/[^\d/]/.test(bruto)) {
    return { valido: false, incompleto: false, motivo: 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)' }
  }

  const digitos = bruto.replace(/\//g, '')
  let a
  let m
  let d
  if (bruto.includes('/')) {
    const partes = bruto.split('/')
    if (partes.length > 3) {
      return { valido: false, incompleto: false, motivo: 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)' }
    }
    if (partes.length < 3 || partes.some((p) => p === '')) {
      return { valido: false, incompleto: true }
    }
    const [pd, pm, pa] = partes
    if (pd.length > 2 || pm.length > 2 || pa.length > 4) {
      return { valido: false, incompleto: false, motivo: 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)' }
    }
    if (pa.length < 4) return { valido: false, incompleto: true }
    d = Number(pd)
    m = Number(pm)
    a = Number(pa)
  } else {
    if (digitos.length < 8) return { valido: false, incompleto: true }
    if (digitos.length > 8) {
      return { valido: false, incompleto: false, motivo: 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)' }
    }
    d = Number(digitos.slice(0, 2))
    m = Number(digitos.slice(2, 4))
    a = Number(digitos.slice(4, 8))
  }

  if (!existeNoCalendario(a, m, d)) {
    // A mensagem diz o que está errado, não "inválido": ano fora de quatro
    // dígitos, mês fora da conta e dia que não existe naquele mês são erros
    // diferentes e se corrigem diferente. (A mensagem do dia dizia "Janeiro de
    // 50 não tem 1 dias" para `01/01/0050` — a recusa estava certa e a
    // explicação não levava ao conserto; o teste do ano vem antes por isso.)
    const motivo =
      a < 1000 || a > 9999
        ? 'O ano precisa ter 4 dígitos (ex.: 2026)'
        : m >= 1 && m <= 12 && d >= 1 && d <= 31
          ? `${NOMES_MES[m - 1][0].toUpperCase()}${NOMES_MES[m - 1].slice(1)} de ${a} não tem ${d} dias`
          : 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)'
    return { valido: false, incompleto: false, motivo }
  }
  const iso = dataISOLocal(dataLocal(a, m, d))
  // O CONTRATO, conferido em código e não só em teste: nada sai daqui como
  // válido sem ser ISO que o próprio módulo reconhece. É a invariante que o
  // ano de 3 dígitos furou — e o furo só apareceu porque alguém foi procurar.
  return ehDataISO(iso)
    ? { valido: true, valor: iso }
    : { valido: false, incompleto: false, motivo: 'Data inválida — use dd/mm/aaaa (ex.: 05/08/2026)' }
}

/** "agosto de 2026" — o cabeçalho do painel, em português. */
export function rotuloDoMes(ano, mes) {
  return `${NOMES_MES[mes - 1]} de ${ano}`
}

/**
 * As 42 células da grade de um mês (6 semanas × 7 dias), começando no domingo.
 * Cada célula: { iso, dia, doMes }. `doMes: false` são as bordas (fim do mês
 * anterior e começo do seguinte), que a tela pinta apagadas mas continuam
 * clicáveis — é assim que se chega a 31/07 estando em agosto.
 */
export function gradeDoMes(ano, mes) {
  const primeiro = dataLocal(ano, mes, 1)
  const inicio = new Date(primeiro)
  inicio.setDate(1 - primeiro.getDay()) // recua até o domingo
  const celulas = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    celulas.push({
      iso: dataISOLocal(d),
      dia: d.getDate(),
      doMes: d.getMonth() === mes - 1 && d.getFullYear() === ano,
    })
  }
  return celulas
}

// Quantos dias tem o mês — pelo truque do dia 0 do mês seguinte, que o
// construtor de componentes resolve sozinho (inclusive bissexto).
const diasNoMes = (ano, mes) => new Date(ano, mes, 0).getDate()

/**
 * Move o foco do calendário a partir de uma data ISO.
 *
 * Dia e semana atravessam mês e ano naturalmente. Mês e ano CLAMPAM o dia:
 * 31 de março, um mês atrás, é 28 de fevereiro — nunca 3 de março. Sem o
 * clamp, apertar "mês anterior" partindo de um dia 31 pularia o mês inteiro,
 * que é exatamente o tipo de surpresa que faz alguém desistir do teclado.
 */
export function moverFoco(iso, direcao) {
  if (!ehDataISO(iso)) return iso
  const [a, m, d] = iso.split('-').map(Number)
  const porDias = (n) => {
    const base = dataLocal(a, m, d)
    base.setDate(base.getDate() + n)
    return dataISOLocal(base)
  }
  const porMeses = (n) => {
    const total = (a * 12 + (m - 1)) + n
    const ano = Math.floor(total / 12)
    const mes = (total % 12) + 1
    return dataISOLocal(dataLocal(ano, mes, Math.min(d, diasNoMes(ano, mes))))
  }
  switch (direcao) {
    case 'esquerda':
      return porDias(-1)
    case 'direita':
      return porDias(1)
    case 'cima':
      return porDias(-7)
    case 'baixo':
      return porDias(7)
    case 'mesAnterior':
      return porMeses(-1)
    case 'mesSeguinte':
      return porMeses(1)
    case 'anoAnterior':
      return porMeses(-12)
    case 'anoSeguinte':
      return porMeses(12)
    case 'inicioDoMes':
      return dataISOLocal(dataLocal(a, m, 1))
    case 'fimDoMes':
      return dataISOLocal(dataLocal(a, m, diasNoMes(a, m)))
    default:
      return iso
  }
}

/** O bloco de 12 anos a que um ano pertence (a grade de anos do painel). */
export function blocoDeAnos(ano) {
  const inicio = Math.floor(ano / 12) * 12
  return Array.from({ length: 12 }, (_, i) => inicio + i)
}

/**
 * Troca o ANO de uma data ISO, clampando o dia — 29/02 de ano bissexto vira
 * 28/02 num ano comum, nunca 01/03. É o que a grade de 12 anos usa quando o
 * Marco escolhe o ano direto.
 */
export function definirAno(iso, ano) {
  if (!ehDataISO(iso) || !Number.isInteger(ano)) return iso
  const [, m, d] = iso.split('-').map(Number)
  return dataISOLocal(dataLocal(ano, m, Math.min(d, diasNoMes(ano, m))))
}
