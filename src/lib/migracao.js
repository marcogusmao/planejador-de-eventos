import { inspecionarEventoFinanceiro } from './origensFinanceiro.js'
// Migração de schema dos eventos (Sessão E — sugestão 5 do MELHORIAS.md).
//
// Regra inegociável (decisão do Marco 17/07/2026): campos novos são OPCIONAIS —
// evento sem eles se comporta exatamente como antes. A migração só garante a
// forma dos campos novos quando presentes/ausentes; NUNCA altera valor
// existente e NUNCA toca em fórmula. Idempotente: migrar duas vezes = uma vez.
//
// Histórico de campos novos por versão do app:
// - Sessão D: margemAlvo / margemMinima (opcionais; ausente = padrões em calc.js)
// - Sessão F: vendidosAteHoje (opcional; ausente = leitura de ritmo não aparece)
// - Sessão E: receitaRealizada { bilheteria, bar } (opcional; ausente = visão
//   Fechamento mostra "sem dado", nenhum cálculo muda)
// - Sessão H: financeiro { eventoId, eventoNome, empresa, atualizadoEm,
//   puxado } (opcional; ausente/null = sem vínculo com o Financeiro — a ponte
//   pede o vínculo na primeira busca). Itens de custo criados pela ponte
//   carregam `viaFinanceiro`: legado { categoria, valor, em } ou versão 2
//   {versao, valor, em, origens:[{eventoId,categoriaId,categoria,valor,em}]}.
//   Ambos passam intocados pelo backup. Metadados inválidos também permanecem
//   recuperáveis; o censo avisa e a ponte não os usa como identidade.
// - Sessão N: tipo (opcional; string — '' = "sem categoria"; nenhum cálculo
//   usa — só agrupamento na Home e a curva por festa da Fase 2) e
//   descontoMedioPct (opcional; '' = 0% = conta idêntica à anterior — fórmula
//   da sugestão 17 aprovada pelo Marco em 18/07/2026, ver calc.js).
// - Sessão O: patrocinios [] (sugestão 22 — lista por estágio, vocabulário do
//   Financeiro: proposta/confirmado/recebido). ÚNICA migração que MOVE um
//   valor: o número solto `outrasReceitas.patrocinio` de evento antigo vira um
//   item da lista com estágio 'confirmado' — que CONTA na receita, então o
//   resultado calculado não muda um centavo (condição inegociável do Marco;
//   prova: golden intacto + fotografias byte a byte + patrocinio.test.js).
//   Depois da migração a lista é a fonte única e o campo solto fica '' —
//   nunca existe conta dupla.
// - Sessão Q: openBar (sugestão 27 — booleano opcional; só `true` zera a
//   receita de bar em calc.js; ausente/false/qualquer outra coisa = false =
//   conta idêntica à anterior. Normalizado para booleano estrito: valor
//   "torto" de backup editado à mão NUNCA promove um evento a open bar —
//   zerar receita sem o Marco pedir seria número errado mostrado como certo).
// - Sessão F2-B: curvaModo (opcional; 'forma' | 'datas' — qualquer outra
//   coisa vira '' = padrão "pela forma histórica"; só o gráfico da curva lê)
//   e lote.viradaPrevista (opcional; data ISO AAAA-MM-DD — inválida vira '';
//   só o modo "pelas datas dos lotes" lê). NENHUM cálculo de cenário usa os
//   dois campos — são réguas de exibição da curva de vendas (sugestão 14).
// - Sessão F2-R: descontoIngressosModo (opcional; 'pct' | 'numero' — resto
//   vira '' = modo %) e descontoIngressosValor (opcional; número/string
//   numérica preservados, resto vira ''). Sugestão 29a (conta aprovada pelo
//   Marco em 19/07/2026): desconto efetivo = cupom × fração; ambos vazios =
//   fração 1 = o campo antigo descontoMedioPct age como sempre agiu (cupom em
//   TODOS os ingressos) — evento antigo migra para "cupom = X, modo %, 100%"
//   sem mudar um centavo (fotografias byte a byte da sessão). E taxaPagaPor
//   (opcional; sugestão 29b): SÓ a string exata 'cliente' liga o repasse da
//   taxa; 'nos' é preservado por forma; ausente/valor torto viram '' =
//   "paga por nós" = conta de sempre — mesma filosofia estrita do openBar
//   (backup editado à mão nunca aumenta receita sozinho).
// - Sessão F2-C: item de custo ganha dataPagamento (opcional; data ISO —
//   inválida vira '') e parcelas (opcional; lista { id, valor, data } —
//   entrada torta é descartada, valor preservado como veio quando numérico,
//   data inválida vira ''); e o evento ganha caixaInicial (opcional; número
//   ou string numérica preservados, resto vira '' = R$ 0). NENHUM cálculo de
//   cenário usa os três campos — "parcelamento muda o FLUXO, não o CUSTO"
//   (Marco, 19/07/2026): só a aba Análise e os exports de pagamentos leem
//   (src/lib/parcelas.js e src/lib/analiseCaixa.js).
// - Sessão F2-S: inicioVendas (opcional; data ISO — inválida vira '' = sem
//   início, comportamento de sempre) e vendasAbremDiasAntes (opcional;
//   número/string numérica preservados, resto vira '' — a premissa "vendas
//   abrem N dias antes" herdada NO NASCIMENTO, sugestão 30). NENHUM cálculo
//   de cenário usa os dois campos — só a janela normalizada da curva de
//   vendas, o ritmo semanal e a aba Análise (curvaVendas.js). E curvaRef
//   (opcional; { modo: ''|'grupo'|'festa', itens: [{ id, nome }] }) — a
//   referência escolhível da curva: modo fora do vocabulário vira '' (=
//   média da festa, o padrão de sempre); item sem id é descartado. Só a
//   exibição da curva lê.
// - Sessão F2-W: itensDispensados (sugestão 37 — lista de strings não vazias;
//   ausente/inválido → []). São nomes de itens comuns que o usuário marcou "já
//   incluso" para sumirem do aviso do semáforo SÓ naquele evento. Display-only,
//   NENHUM cálculo lê — o aviso é o único consumidor (defaults.js).
// - Sessão F2-X (Dossiê do custo): parcela ganha paga (sugestão 38 — SÓ o
//   booleano estrito `true` quita: parcela quitada SAI da linha do tempo da
//   Análise e o caixa parece melhor, então backup torto nunca quita parcela
//   sozinho — mesma filosofia estrita do openBar) e dataPaga (data ISO do
//   pagamento efetivo — inválida vira ''). E o item de custo ganha os campos
//   de anotação do dossiê (sugestão 40): observacao, contato e linkOrcamento
//   (strings preservadas como vieram; não-string vira ''). NENHUM cálculo lê
//   os cinco campos — paga/dataPaga só mudam QUAIS saídas a Análise conta
//   (analiseCaixa.js) e como os exports rotulam; os de anotação são
//   display-only no dossiê (DADO, nunca instrução — princípio 9: o link só
//   abre quando é http/https, ver urlAbrivel em dossie.js).
// - Sugestão 42 (bar em dois modos — conta aprovada pelo Marco em
//   19/07/2026): barModo ('porPessoa' | 'fixo' preservados; ausente/torto →
//   '' = modo fixo = conta EXATAMENTE atual — backup editado à mão nunca
//   troca o modo do bar sozinho, mesma filosofia estrita do openBar),
//   barTicket ({ pessimista, realista, otimista } — cada um número/string
//   numérica preservados, resto → ''), barTaxaSistemaPct e barCustoSistema
//   (mesma régua numérica). Evento antigo sem os campos segue no modo fixo
//   com o valor digitado de sempre; "por pessoa é o padrão" vale SÓ para
//   evento NOVO (novoEvento grava barModo: 'porPessoa' explícito).
// - Padrões 80/90/100 (Marco, 27/07/2026 — decisão A): padraoPessimista80
//   ({ de: 70 | null }). É a ÚNICA entrada deste histórico que muda um número
//   de propósito e com o resultado mudando junto — as demais preservam a conta
//   ao centavo. O Marco aprovou a mudança de resultado por questionário, com a
//   lista de impacto evento a evento na frente dele; a linha de aprovação do
//   portão é dele, não desta sessão. Ver `subirPessimistaPara80` abaixo.
// - Imposto sobre a receita (Marco, 27/07/2026): impostoPct (opcional; a régua
//   de percentual da casa, 0..100 — ausente/torto → '' = alíquota nunca
//   preenchida) e impostoSobre ({ bilheteria, bar, patrocinio } — SÓ o booleano
//   exato `true` liga cada base; ausente/torto → as três false). Volta à
//   filosofia estrita do openBar, e aqui ela pesa o dobro: ligar uma base
//   DIMINUI o lucro da festa, então backup editado à mão nunca liga imposto
//   sozinho. Evento antigo cai nos dois neutros e sai do cálculo IDÊNTICO ao
//   centavo — medido nos 8 eventos do backup real de 27/07/2026, campo a campo.

import { uid } from './util.js'
import { migrarStatusCusto } from './statusCusto.js'
// Forma estrita das três chaves do imposto — a MESMA função que calc.js e as
// telas usam para ler o evento. Uma régua só: se a migração e o cálculo
// discordassem do que conta como "ligado", o app mostraria um imposto que a
// conta não cobra (ou o contrário).
import { formaImpostoSobre } from './imposto.js'
// Formatadores da casa — SÓ para os rótulos do censo do import (aviso agregado,
// decisão 3a). format.js puxa apenas util.js (nenhuma dep pesada), então
// importar aqui não onera o caminho de loadStore. O censo NÃO roda a cada
// loadStore — só na fronteira do import, chamado pela tela.
import { fmtBRL2, fmtInt, fmtPct, fmtData } from './format.js'
// `ehDataISO` confere FORMA e EXISTÊNCIA (round-trip de componentes) — é a única
// das quatro implementações de "data válida" da casa que recusa 2026-02-31.
import { ehDataISO } from './dataBrasileira.js'

// Forma do registro de carimbo { valor, em }; qualquer coisa fora disso é
// descartada (vira null) — carimbo inválido não pode fingir ser dado.
const formaRegistro = (r) =>
  r && typeof r === 'object' && r.valor != null && typeof r.em === 'string'
    ? { valor: r.valor, em: r.em }
    : null

// Foto do fechamento de EVENTO (Parte 2 — 20/07/2026): { em, foto,
// benchmarkId? }. `em` é o carimbo de quando fechou; `foto` é o objeto de
// números congelados (fechamentoEvento.js). Qualquer coisa fora da forma
// vira null — foto inválida de backup editado à mão não pode fingir ser um
// fechamento. `benchmarkId` só sobrevive como string não vazia.
// A foto exige o MIOLO (`foto.resultado` objeto): a forma frouxa ("qualquer
// objeto é foto") deixou um backup com foto {} passar como fechado e a aba
// Fechamento crashava lendo foto.resultado.resultado (achado adversarial
// 20/07/2026). Foto sem resultado não é foto.
const objetoDeVerdade = (o) => !!o && typeof o === 'object' && !Array.isArray(o)
const formaFechamento = (f) =>
  f &&
  typeof f === 'object' &&
  typeof f.em === 'string' &&
  f.em !== '' &&
  objetoDeVerdade(f.foto) &&
  objetoDeVerdade(f.foto.resultado)
    ? {
        em: f.em,
        foto: f.foto,
        ...(typeof f.benchmarkId === 'string' && f.benchmarkId !== ''
          ? { benchmarkId: f.benchmarkId }
          : {}),
      }
    : null

// ---------------------------------------------------------------- patrocínio

const ESTAGIOS_VALIDOS = ['proposta', 'confirmado', 'recebido']

// número finito ou string numérica (backup editado à mão) preservados como
// vieram; qualquer outra coisa vira '' — mesma regra do formaDesconto.
//
// Edge 0x10 (Marco, 23/07/2026 — lote de travas, item 6): a string só passa se
// for NOTAÇÃO DECIMAL ("10", "4.5", "-5", ".5"), o que um backup editado à mão
// traz. `Number('0x10')` é 16 e `num('0x10')` também é 16 (util.js usa Number),
// então um "0x10" herdado fingia ser 16% na conta — hexadecimal não é formato
// BR. O regex barra hex/binário/octal/notação científica ANTES do Number: fora
// da notação decimal vira '' ("não informado"). Número (typeof number) não passa
// pelo regex — só a classe string, onde mora o vetor.
const DECIMAL_NUMERICO = /^[+-]?(\d+\.?\d*|\.\d+)$/
const valorNumericoOuVazio = (v) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && DECIMAL_NUMERICO.test(v.trim()) && Number.isFinite(Number(v))
      ? v
      : ''

// Percentual na faixa 0..100 (decisão do Marco, 20/07/2026 — trava dos
// percentuais, item 2 da fila): além da régua numérica acima, valor FORA de
// 0..100 também vira '' ("não informado"). Cupom 150% deixava a receita
// NEGATIVA, cupom/taxa negativos INFLAVAM a festa — tudo em silêncio
// (evidência: percentuaisForaDaFaixa.evidencia.test.js). Valor torto nunca
// liga comportamento que muda o resultado; a conta (calc.js) segue intocada.
const pctNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= 0 && Number(s) <= 100) ? s : ''
}

// Trava do NEGATIVO (decisão do Marco, 22/07/2026 — ampliação da trava dos
// percentuais para dinheiro/quantidade e para os ajustes de cenário). Duas
// réguas novas, MESMO comportamento conservador da de cima: valor FORA da
// faixa vira '' ("não informado") na LEITURA, em silêncio — o número absurdo
// nunca liga comportamento que muda o resultado; a conta (calc.js) segue
// intocada. (Régua replicada aqui e não importada de campoNumerico.js de
// propósito: aquele módulo puxa o parseMoney/xlsx, e a migração roda a cada
// loadStore — o mesmo motivo de premissas.js manter a sua cópia da 0..100.)
//
// naoNegativoOuVazio: custo estimado/realizado, preço de lote, quantidade de
// ingressos e patrocínio travam em ≥ 0. NÃO se aplica a derivados (lucro, bar
// líquido, benchmark) nem ao bar digitado — prejuízo é fato (princípio: só a
// ENTRADA que não pode ser negativa é travada).
const naoNegativoOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || Number(s) >= 0 ? s : ''
}

// precoDeLoteOuVazio (P4 — decisão do Marco, 06/10/2026): preço de lote escrito
// como TEXTO de zero ("0", " 0 ", "0,00", "R$ 0", "R$ 0,00") vira o NÚMERO 0 —
// cortesia declarada. Antes, "0,00" e os com "R$" não passavam na régua
// decimal e viravam '' ("não informado"), e desde a S7/P8 '' é preço AUSENTE:
// o lote saía do público e do bar (festa P8: público realista 590 em vez de
// 890). Texto ilegível ("abc", "R$ abc") continua virando '' com o aviso do
// censo; número, '' / null / undefined e qualquer outro texto seguem a régua
// de sempre (naoNegativoOuVazio), sem mudar o formato salvo.
const ZERO_ESCRITO = /^(R\$\s*)?0+([.,]0+)?$/i
export const ehZeroEscrito = (v) => typeof v === 'string' && ZERO_ESCRITO.test(v.trim())
const precoDeLoteOuVazio = (v) => (ehZeroEscrito(v) ? 0 : naoNegativoOuVazio(v))

// cenarioNaFaixaOuVazio: os AJUSTES relativos de cenário (custoPct/ticketPct de
// cenariosConfig) vivem em −50..100 — faixa PRÓPRIA, porque o negativo aqui é
// de propósito (otimista nasce com custoPct −5, que continua valendo). O que a
// trava barra é o absurdo do achado de 20/07 (cenariosConfig.custoPct = −200,
// que produzia custoTotal negativo). Fora de −50..100 vira ''.
const cenarioNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= -50 && Number(s) <= 100) ? s : ''
}

// vendaNaFaixaOuVazio (decisão do Marco, 22/07/2026 — 3b): o vendaPct de cenário
// é percentual ABSOLUTO do lote vendido (Math.round(q * vendaPct / 100) em
// calc.js), então vive em 0..100 — faixa PRÓPRIA, diferente dos IRMÃOS
// custoPct/ticketPct (ajustes relativos, −50..100 acima). Fora de 0..100 vira ''
// — e formaCenariosConfig então REMOVE a chave (delete), para "não informado"
// cair no fallback documentado do calc (o ?? só pega chave AUSENTE; '' PRESENTE
// vira 0 e ZERAVA o cenário — achado de 22/07). Espelha FAIXA_VENDA de
// campoNumerico.js (réguas replicadas de propósito — ver nota de naoNegativoOuVazio).
const vendaNaFaixaOuVazio = (v) => {
  const s = valorNumericoOuVazio(v)
  return s === '' || (Number(s) >= 0 && Number(s) <= 100) ? s : ''
}

// Item de patrocínio: garante id/forma; estágio fora do vocabulário vira
// 'proposta' (conservador: NUNCA promove valor desconhecido a "conta na
// receita" — superestimar receita é o erro pior). Não-objeto é descartado.
const formaPatrocinioItem = (p) => {
  if (!p || typeof p !== 'object') return null
  return {
    id: typeof p.id === 'string' && p.id !== '' ? p.id : uid(),
    patrocinador: typeof p.patrocinador === 'string' ? p.patrocinador : '',
    // Trava do negativo (Marco, 22/07/2026): patrocínio é RECEITA de entrada,
    // não pode ser negativo — valor < 0 de backup à mão vira '' (não conta).
    valor: naoNegativoOuVazio(p.valor),
    estagio: ESTAGIOS_VALIDOS.includes(p.estagio) ? p.estagio : 'proposta',
    // Dados de pagamento do produtor (export v2) — também por patrocínio.
    dataPgto: formaTextoLivre(p.dataPgto),
    pagamento: formaTextoLivre(p.pagamento),
  }
}

/**
 * Migra o patrocínio de um evento para a lista por estágio (Sessão O).
 * Devolve { patrocinios, outrasReceitas } prontos para o evento migrado.
 * - Lista já existe → normaliza itens; o campo solto é zerado ('') para a
 *   lista ser a fonte única (se ambos existirem — backup editado à mão — a
 *   LISTA vence; o solto nunca vira item novo, para a conta nunca dobrar).
 * - Sem lista + solto numérico POSITIVO → vira UM item 'confirmado' (conta na
 *   receita ⇒ número preservado) e o solto é consumido ('').
 * - Sem lista + solto vazio/0/negativo/inválido → lista vazia (0 antes = 0
 *   depois). O NEGATIVO deixou de virar item (Marco, 22/07/2026 — trava do
 *   negativo): patrocínio é receita de entrada e não pode ser negativo, então
 *   um solto negativo de backup antigo é descartado como "não informado", como
 *   faz naoNegativoOuVazio com o valor de um item da lista.
 */
function migrarPatrocinio(evento) {
  const outras =
    evento.outrasReceitas && typeof evento.outrasReceitas === 'object'
      ? evento.outrasReceitas
      : {}
  if (Array.isArray(evento.patrocinios)) {
    return {
      patrocinios: evento.patrocinios.map(formaPatrocinioItem).filter(Boolean),
      outrasReceitas: { ...outras, patrocinio: '' },
    }
  }
  const solto = outras.patrocinio
  const n = Number(solto)
  if (solto !== '' && solto != null && Number.isFinite(n) && n > 0) {
    return {
      // Passa pelo MESMO formaPatrocinioItem (uma normalização só) — senão o
      // patrocínio-solto nasceria sem dataPgto/pagamento e migrar 2× divergiria
      // (não-idempotência pega pelos testes da casa, 21/07/2026).
      patrocinios: [
        formaPatrocinioItem({ id: uid(), patrocinador: 'Patrocínio', valor: solto, estagio: 'confirmado' }),
      ],
      outrasReceitas: { ...outras, patrocinio: '' },
    }
  }
  return { patrocinios: [], outrasReceitas: { ...outras, patrocinio: '' } }
}

/**
 * Garante a forma dos campos opcionais de um evento.
 * - `receitaRealizada`: ausente/inválido → { bilheteria: '', bar: '' } (vazio =
 *   "não informado"); presente → preserva valores (subcampos ausentes viram '').
 * - `financeiro`: ausente/inválido/sem eventoId → null (sem vínculo);
 *   presente → preserva vínculo e carimbos válidos.
 * - `tipo`: ausente/inválido (não-string) → '' ("sem categoria"); string é
 *   preservada como veio.
 * - `descontoMedioPct`: número finito (ou string numérica de backup editado à
 *   mão) é preservado; ausente/inválido → '' (= 0%, conta idêntica à anterior).
 * - `margemAlvo` / `margemMinima` (§9.9 do laudo externo — 20/07/2026):
 *   vazio/ausente fica como está (= padrões 28/20 do veredito); número ou
 *   string numérica preservados; qualquer outra coisa → '' — sem isso,
 *   veredito() coagia 'abc' com num() para 0, e alvo 0 deixava QUALQUER
 *   evento com margem ≥ 0 verde (verde falso — número errado como certo).
 * - `descontoIngressosModo` / `descontoIngressosValor` (sugestão 29a): modo
 *   'pct'/'numero' e valor numérico preservados; resto → '' — os dois vazios
 *   = cupom em todos os ingressos (o comportamento de sempre do campo antigo).
 * - `taxaPagaPor` (sugestão 29b): 'cliente'/'nos' preservados; resto → ''
 *   (= paga por nós, a conta de sempre — repasse nunca liga sozinho).
 * - `patrocinios` / `outrasReceitas.patrocinio`: ver migrarPatrocinio acima —
 *   número solto de evento antigo vira item 'confirmado' (número preservado).
 * - `openBar`: `true` é preservado; ausente/qualquer outra coisa → false
 *   (comportamento de sempre — ver histórico da Sessão Q acima).
 * - `barModo` / `barTicket` / `barTaxaSistemaPct` / `barCustoSistema`
 *   (sugestão 42): 'porPessoa'/'fixo' preservados, resto → '' (= fixo, a
 *   conta de sempre); ticket por cenário e valores do sistema na régua
 *   numérica dos opcionais (número/string numérica ou '').
 * - `curvaModo`: 'forma'/'datas' preservados; resto → '' (padrão forma).
 * - `lotes[].viradaPrevista`: data ISO preservada; resto → ''. Os demais
 *   campos de cada lote passam INTOCADOS (mesmos valores, spread).
 * - `caixaInicial`: número/string numérica preservados; resto → '' (= R$ 0).
 * - `categorias[].itens[]`: cada item ganha forma de `dataPagamento` (data
 *   ISO ou '') e `parcelas` (lista { id, valor, data } normalizada); os
 *   demais campos do item passam INTOCADOS (spread — inclusive viaFinanceiro).
 * Todo o resto do evento passa intocado (mesma referência de campos).
 */
const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const formaViradaPrevista = (v) => (typeof v === 'string' && DATA_ISO_RE.test(v) ? v : '')
const formaDataISO = formaViradaPrevista

// Ticket do bar por cenário (sugestão 42): { pessimista, realista,
// otimista }, cada um na régua dos números opcionais (número/string
// numérica preservados, resto vira ''). Objeto ausente/torto → os três
// vazios (bar por pessoa = R$ 0 até o Marco preencher — nunca inventa valor).
const formaBarTicket = (v) => {
  const t = v && typeof v === 'object' ? v : {}
  return {
    pessimista: valorNumericoOuVazio(t.pessimista),
    realista: valorNumericoOuVazio(t.realista),
    otimista: valorNumericoOuVazio(t.otimista),
  }
}

// Referência da curva (Sessão F2-S — sugestão 30): { modo, itens }.
// Modo fora do vocabulário vira '' (= média da festa); item sem id é
// descartado; nome não-string vira '' (o rótulo mostra "sem nome", nunca
// lixo). O id é preservado como veio (número do Financeiro).
const formaCurvaRef = (v) => {
  if (!v || typeof v !== 'object') return { modo: '', itens: [] }
  return {
    modo: v.modo === 'grupo' || v.modo === 'festa' ? v.modo : '',
    itens: Array.isArray(v.itens)
      ? v.itens
          .filter((x) => x && typeof x === 'object' && x.id != null)
          .map((x) => ({ id: x.id, nome: typeof x.nome === 'string' ? x.nome : '' }))
      : [],
  }
}

// Parcela de custo (Sessão F2-C): { id, valor, data }. Não-objeto é
// descartado (nunca vira parcela fantasma); valor numérico (ou string
// numérica de backup editado à mão) preservado como veio, resto vira '' —
// a soma travada da tela acusa a divergência, nunca silêncio; data fora de
// AAAA-MM-DD vira '' (parcela sem data aparece com aviso, não some).
// paga (sugestão 38): SÓ o booleano estrito `true` quita — quitar tira a
// saída da linha do tempo da Análise (o caixa parece MELHOR), então valor
// torto NUNCA promove parcela a paga. dataPaga fora de AAAA-MM-DD vira ''.
const formaParcela = (p) => {
  if (!p || typeof p !== 'object') return null
  return {
    id: typeof p.id === 'string' && p.id !== '' ? p.id : uid(),
    valor: valorNumericoOuVazio(p.valor),
    data: formaDataISO(p.data),
    paga: p.paga === true,
    dataPaga: formaDataISO(p.dataPaga),
  }
}
const formaParcelas = (v) => (Array.isArray(v) ? v.map(formaParcela).filter(Boolean) : [])

// Item de custo: garante a forma dos campos de agenda de pagamento da F2-C
// e dos campos de anotação do dossiê (sugestão 40 — strings preservadas
// como vieram, até texto que "parece instrução": é DADO do Marco e fica
// guardado; quem protege o clique é urlAbrivel em dossie.js). TODOS os
// demais campos passam intocados (spread — inclusive viaFinanceiro da
// ponte e campos extras de backup).
const formaTextoLivre = (v) => (typeof v === 'string' ? v : '')

// ————————————— identidade das linhas de dado antigo —————————————
//
// (Conserto autorizado pelo Marco em 20/07/2026.)
//
// Lotes e itens de custo criados DENTRO do app sempre tiveram `id` (`uid()`),
// mas esta migração não gerava id para nenhum dos dois. Backup antigo abria
// com essas linhas SEM id, e o estrago era de tela: as listas usam
// `key={l.id}` / `key={i.id}`, então com id `undefined` o React cai no índice,
// a instância do botão de ordem não acompanha a linha e reordenar PELO TECLADO
// mexia na linha ERRADA — com o desfazer nomeando um lote que o Marco não
// clicou. (`ordenar.js` já tinha o remendo de desempate por posição; ele
// continua lá como rede, mas agora deixa de ser acionado no dado do Marco.)
//
// NÃO é campo novo: o schema já define `id` nessas linhas. O que existe é
// valor AUSENTE em dado antigo — a mesma classe de coisa que esta migração já
// normaliza em todo o resto do arquivo. Nenhum número é lido ou escrito aqui.
//
// ————— por que o id é DERIVADO da posição, e não `uid()` —————
//
// `migrarEventos` roda a CADA `loadStore()`, e nem toda abertura do app grava
// de volta (a gravação pode estar bloqueada — ver `gravacaoBloqueada` em
// storage.js). Um `uid()` aleatório daria um id NOVO a cada abertura: o
// desfazer e a seleção da tela apontariam para linhas que deixaram de existir
// entre um render e outro. O id derivado da posição é ESTÁVEL — abrir, fechar
// e reabrir dá exatamente os mesmos ids — e tem teste dizendo isso.
//
// O prefixo `legado-` deixa a origem legível num backup aberto à mão.
const ID_LEGADO_PREFIXO = 'legado'

/** Um id já preenchido e utilizável? (só string não-vazia conta) */
const temId = (x) => x && typeof x === 'object' && typeof x.id === 'string' && x.id !== ''

/**
 * Preenche o `id` AUSENTE de cada linha de `lista`, derivando-o de `base` +
 * posição. Devolve a lista nova (mesma ordem, mesmos objetos quando já tinham
 * id — nenhum id existente é reescrito).
 *
 * `usados` é o conjunto de ids já em uso no escopo; um candidato que colidir
 * (backup editado à mão que por acaso já use o nome derivado) ganha sufixo até
 * ficar livre. Colisão silenciosa aqui viraria duas linhas com a mesma
 * identidade — o defeito que este conserto existe para tirar.
 */
function preencherIds(lista, base, usados) {
  if (!Array.isArray(lista)) return lista
  return lista.map((linha, i) => {
    if (!linha || typeof linha !== 'object') return linha
    if (temId(linha)) return linha
    let candidato = `${base}-${i}`
    let n = 2
    while (usados.has(candidato)) candidato = `${base}-${i}-${n++}`
    usados.add(candidato)
    return { ...linha, id: candidato }
  })
}

/** Ids já em uso numa lista de linhas (para não colidir ao preencher). */
const idsEmUso = (lista) => {
  const s = new Set()
  if (Array.isArray(lista)) for (const x of lista) if (temId(x)) s.add(x.id)
  return s
}
const formaItemCusto = (i) =>
  i && typeof i === 'object'
    ? {
        ...i,
        // "custou zero" (Marco, 20/07/2026): booleano ESTRITO — `false` quando
        // ausente, e NUNCA `true` a partir de lixo (string 'sim', 1, {}…) vindo
        // de backup editado à mão. Mesma filosofia estrita do openBar. Quem
        // respeita a marca no cálculo é custouZeroEfetivo() (calc.js).
        custouZero: i.custouZero === true,
        // realizadoAuto (Marco, 23/07/2026 — lote de travas, item 4): booleano
        // ESTRITO e ADITIVO — `false` quando ausente (backup antigo), nunca
        // `true` a partir de lixo. Marca que o `realizado` foi GRAVADO
        // automaticamente pela última parcela paga (parcelas.js/
        // alternarParcelaPaga), para distinguir com precisão do realizado
        // DIGITADO à mão — fim da heurística "realizado == soma" que apagava um
        // manual coincidente ao centavo. calc.js NÃO lê a flag
        // (custouZeroEfetivo/valorConsiderado seguem intocados): é só metadado
        // do motor de parcelas. Campo ausente = false prova o round-trip aditivo.
        realizadoAuto: i.realizadoAuto === true,
        // Trava do negativo (Marco, 22/07/2026): custo estimado/realizado é
        // dinheiro de ENTRADA e não pode ser negativo — valor < 0 de backup à
        // mão vira '' ("não informado"), como os percentuais fora da faixa.
        // (Crédito/desconto entra reduzindo o valor do item, não como negativo;
        // ver o aviso do campo em campoNumerico.js/FAIXA_CUSTO.) 0 e '' passam.
        estimado: naoNegativoOuVazio(i.estimado),
        realizado: naoNegativoOuVazio(i.realizado),
        // Status novo garantido (export v2, Marco 21/07/2026): id antigo mapeia
        // (PAGO→PAGO, FECHADO→FECHADO, NEGOCIANDO→NEGOCIAR, ORÇAR→ESTIMADO),
        // ausente/desconhecido → ESTIMADO. Todo item sai COM status válido.
        status: migrarStatusCusto(i.status),
        // Dados de pagamento do produtor (≠ dataPagamento/parcelas da Análise).
        dataPgto: formaTextoLivre(i.dataPgto),
        pagamento: formaTextoLivre(i.pagamento),
        dataPagamento: formaDataISO(i.dataPagamento),
        parcelas: formaParcelas(i.parcelas),
        observacao: formaTextoLivre(i.observacao),
        contato: formaTextoLivre(i.contato),
        linkOrcamento: formaTextoLivre(i.linkOrcamento),
      }
    : i

// Ajustes de cenário (Marco, 22/07/2026 — trava do negativo, achado de 20/07,
// + decisões 3a/3b): a grade de cada cenário trava POR CAMPO — vendaPct em
// 0..100 (ABSOLUTO, faixa própria 3b) e custoPct/ticketPct em −50..100
// (AJUSTES relativos). O resto de cenariosConfig — overrides por lote,
// ticketMedio manual, quaisquer outras chaves — passa INTOCADO. Só os três
// campos da grade PRESENTES são olhados.
//
// Fora da faixa (ou '' pré-existente), a chave é REMOVIDA (delete), NÃO gravada
// como '' (decisão 3b-anexo, 22/07/2026): "não informado" volta a cair no
// fallback DOCUMENTADO do calc — o `??` de loteQtdCenario só pega chave
// AUSENTE; um '' PRESENTE vira num('')=0 e ZERAVA o cenário (achado executado).
// Valor DENTRO da faixa fica no spread (byte a byte), então migrar 2× = migrar
// 1× e conta de dado válido não muda. cenariosConfig ausente/torto passa como
// veio (calc.js já lê `|| {}`).
const CENARIOS_CHAVES = ['pessimista', 'realista', 'otimista']
const CAMPOS_GRADE_CENARIO = ['vendaPct', 'custoPct', 'ticketPct']
const reguaGrade = (campo) => (campo === 'vendaPct' ? vendaNaFaixaOuVazio : cenarioNaFaixaOuVazio)
const formaCenariosConfig = (cfg) => {
  if (!cfg || typeof cfg !== 'object') return cfg
  const out = { ...cfg }
  for (const cen of CENARIOS_CHAVES) {
    const c = cfg[cen]
    if (!c || typeof c !== 'object') continue
    const novo = { ...c }
    for (const campo of CAMPOS_GRADE_CENARIO) {
      if (!(campo in c)) continue
      if (reguaGrade(campo)(c[campo]) === '') delete novo[campo]
    }
    out[cen] = novo
  }
  return out
}

// ————— Subida do padrão do pessimista: 70 → 80 (Marco, 27/07/2026) —————
//
// Decisão A, tomada por questionário com a lista de impacto evento a evento
// na frente dele: o cenário pessimista passou a supor 80% dos lotes vendidos
// em vez de 70%, e a decisão vale TAMBÉM para os eventos JÁ SALVOS em 70.
//
// O fallback novo de `calc.js` (80) só alcança evento com o campo VAZIO —
// quem tem 70 GRAVADO continuaria em 70 para sempre. É o que esta migração
// resolve, e é só isso que ela faz: `cenariosConfig.pessimista.vendaPct` que
// valha exatamente 70 (o número 70, ou a string '70' de backup editado à mão)
// vira 80. Os 47 que o Marco pôs à mão na Cine, o 78 da Casa Norte, o 80 que
// já está lá, o campo vazio e o campo ausente — nenhum é tocado.
//
// Impacto medido no dado real (backup de 27/07/2026, lucro do pessimista):
//   Marfim 09/05/26 ......... −68.410 → −27.530
//   Marfim Casa Norte 05/07/25  −152.870 → −122.960
//   Brisa 05/12/25 ......... não muda (é benchmark, não tem lote)
// (O Salao Sul, de campo vazio, muda pelo fallback do calc, não por aqui.)
//
// ————— por que existe uma MARCA, e por que ela não é opcional —————
//
// `migrarEvento` roda a CADA `loadStore()`, não uma vez na vida do dado. Sem
// marca, isto não seria uma migração: seria uma regra permanente dizendo "70
// é proibido neste app". O Marco arrastaria o slider do pessimista para 70 de
// propósito num evento, salvaria, fecharia — e na abertura seguinte o número
// dele teria voltado para 80 sozinho. Trocar em silêncio um número que o dono
// digitou é o pior defeito possível aqui, pior que o app não abrir.
//
// A marca é a CHAVE `padraoPessimista80`, gravada em TODO evento que passa
// por aqui — inclusive nos que não mudaram nada. Presente = "este evento já
// foi visto pela subida; nunca mais mexa no pessimista dele". O VALOR carrega
// o caminho de volta (princípio 7): `{ de: 70 }` guarda o número anterior no
// próprio evento, e ele viaja no backup JSON; `{ de: null }` quando não houve
// troca. Marca de forma torta (string, número, lista) vira `{ de: null }` e
// SEGUE valendo como marca — perde-se o registro do valor anterior, nunca o
// fato de que o evento já passou, porque tratá-la como ausente reabriria
// exatamente a porta de mexer no número do dono de novo.
//
// Idempotência: rodar 2× = rodar 1×. Na segunda passada a chave já existe, a
// função devolve o `cenariosConfig` INTOCADO (mesma referência) e a marca
// normalizada — nenhum número é lido sequer.
//
// Quem restaura da lixeira ou de um instantâneo VÊ a mudança antes de aplicar:
// `revisaoRestauracao.js` compara o cru com o migrado e lista "o resultado
// desta previsão muda", com o desfazer na própria tela.
const MARCA_PESSIMISTA_80 = 'padraoPessimista80'

const formaMarcaPessimista80 = (m) =>
  objetoDeVerdade(m) ? { de: m.de === undefined ? null : m.de } : { de: null }

/**
 * @param {object} evento evento CRU (é nele que a marca é procurada)
 * @param {*} cfg `cenariosConfig` já passado por `formaCenariosConfig`
 * @returns {{ cenariosConfig: *, padraoPessimista80: { de: * } }}
 */
function subirPessimistaPara80(evento, cfg) {
  if (MARCA_PESSIMISTA_80 in evento)
    return {
      cenariosConfig: cfg,
      padraoPessimista80: formaMarcaPessimista80(evento[MARCA_PESSIMISTA_80]),
    }
  const pes = objetoDeVerdade(cfg) && objetoDeVerdade(cfg.pessimista) ? cfg.pessimista : null
  // Mesma régua do resto da grade (vendaNaFaixaOuVazio): número finito ou
  // string em notação decimal, dentro de 0..100. '70' de backup à mão conta;
  // '0x46' e 'setenta' não — e nem precisam, já viraram '' antes daqui.
  const atual = pes ? vendaNaFaixaOuVazio(pes.vendaPct) : ''
  if (atual === '' || Number(atual) !== 70)
    return { cenariosConfig: cfg, padraoPessimista80: { de: null } }
  return {
    cenariosConfig: { ...cfg, pessimista: { ...pes, vendaPct: 80 } },
    // `de` guarda o valor exatamente como estava (70 ou '70').
    padraoPessimista80: { de: atual },
  }
}

export function migrarEvento(evento) {
  if (!evento || typeof evento !== 'object') return evento
  const rr = evento.receitaRealizada
  const forma =
    rr && typeof rr === 'object'
      // bilheteria BRUTA não pode ser negativa — mesma régua da porta
      // (FAIXA_CUSTO) e simetria com custo realizado/barTaxa/margens, que a
      // migração já normaliza (OBS-1 da lente, aprovada pelo Marco 23/07/2026).
      // Negativo herdado de backup antigo vira '' (vazio pede o número de
      // novo — nunca um número errado mostrado como certo). O bar LÍQUIDO ao
      // lado continua aceitando negativo de propósito (pode dar prejuízo).
      ? {
          bilheteria: naoNegativoOuVazio(rr.bilheteria),
          bar: rr.bar ?? '',
          // Campo opcional aprovado por Marco, 28/09/2026. Backups antigos
          // continuam sem Pix; zero explícito e vazio conservam seus sentidos.
          ...(Object.hasOwn(rr, 'pix') ? { pix: naoNegativoOuVazio(rr.pix) } : {}),
        }
      : { bilheteria: '', bar: '' }
  const f = evento.financeiro
  const formaFinanceiro =
    f && typeof f === 'object' && f.eventoId != null
      ? {
          eventoId: f.eventoId,
          eventoNome: typeof f.eventoNome === 'string' ? f.eventoNome : '',
          empresa: typeof f.empresa === 'string' ? f.empresa : '',
          atualizadoEm: typeof f.atualizadoEm === 'string' ? f.atualizadoEm : null,
          puxado:
            f.puxado && typeof f.puxado === 'object'
              ? {
                  ...(formaRegistro(f.puxado.vendidosAteHoje)
                    ? { vendidosAteHoje: formaRegistro(f.puxado.vendidosAteHoje) }
                    : {}),
                  ...(formaRegistro(f.puxado.bilheteria)
                    ? { bilheteria: formaRegistro(f.puxado.bilheteria) }
                    : {}),
                }
              : {},
        }
      : null
  // vínculo do ritmo Tiqueteira (SPEC-PONTE-RITMO, 23/07/2026): aditivo e
  // opcional — backup antigo (sem o campo) vira null; forma torta vira null
  // (o vínculo se refaz com um clique, nunca vale um vínculo meio-quebrado).
  const rg = evento.ritmoTiqueteira
  const formaRitmoTiqueteira =
    rg && typeof rg === 'object' && rg.edicaoId != null
      ? {
          edicaoId: rg.edicaoId,
          edicaoNome: typeof rg.edicaoNome === 'string' ? rg.edicaoNome : '',
        }
      : null
  const formaTipo = typeof evento.tipo === 'string' ? evento.tipo : ''
  // Margens do semáforo (§9.9 — conserto de 20/07/2026): valor torto vira ''
  // ("não informado" → padrões 28/20 do veredito), NUNCA passa cru — em
  // veredito() num('abc') vira 0 e alvo 0 pinta verde qualquer margem ≥ 0.
  // Valor torto nunca liga comportamento que melhora o resultado. Vazio/
  // ausente permanece como está (o comportamento de sempre).
  // Margens em 0..100 (Marco, 23/07/2026 — lote de travas, item 2): além da
  // forma numérica, valor FORA de 0..100 vira '' ("não informado" → padrões
  // 28/20). Uma mínima −20 herdada aceitava prejuízo com semáforo não-vermelho
  // (mesmo VERDE FALSO do §9.9, agora pela porta de baixo). Vazio/ausente
  // permanece como está (o comportamento de sempre).
  const formaMargemSemaforo = (v) => {
    if (v === '' || v == null) return v
    const s = valorNumericoOuVazio(v)
    return s === '' || (Number(s) >= 0 && Number(s) <= 100) ? s : ''
  }
  // Trava dos percentuais (Marco, 20/07/2026): cupom, taxa, cashback e
  // contingência na faixa 0..100 — a régua antiga do formaDesconto (número
  // ou string numérica) ganhou o teto/piso e passou a valer para os quatro.
  const formaDesconto = pctNaFaixaOuVazio(evento.descontoMedioPct)
  const modoDesconto =
    evento.descontoIngressosModo === 'pct' || evento.descontoIngressosModo === 'numero'
      ? evento.descontoIngressosModo
      : ''
  const pat = migrarPatrocinio(evento)
  // Subida do pessimista 70 → 80 (Marco, 27/07/2026 — decisão A). Roda DEPOIS
  // da forma da grade, sobre o cfg já normalizado, e devolve junto a marca que
  // impede a subida de acontecer duas vezes na vida do mesmo evento.
  const sub80 = subirPessimistaPara80(evento, formaCenariosConfig(evento.cenariosConfig))
  // Fechamento de evento (Parte 2 — 20/07/2026): backfill ESTRITO no padrão
  // do openBar. Fechar TRAVA edição — é comportamento que não pode ligar
  // sozinho por acidente: só a string exata 'fechado' E uma foto de forma
  // válida fecham; qualquer outra combinação (status torto, foto inválida,
  // foto órfã sem status) vira 'aberto' + null. O par viaja JUNTO ou não
  // viaja: é o invariante `status === 'fechado' ⟺ fechamento != null`.
  const fech = formaFechamento(evento.fechamento)
  const fechado = evento.status === 'fechado' && fech != null
  return {
    ...evento,
    status: fechado ? 'fechado' : 'aberto',
    fechamento: fechado ? fech : null,
    receitaRealizada: forma,
    financeiro: formaFinanceiro,
    ritmoTiqueteira: formaRitmoTiqueteira,
    tipo: formaTipo,
    descontoMedioPct: formaDesconto,
    taxaBilheteria: pctNaFaixaOuVazio(evento.taxaBilheteria),
    cashbackPct: pctNaFaixaOuVazio(evento.cashbackPct),
    contingenciaPct: pctNaFaixaOuVazio(evento.contingenciaPct),
    // Margens do semáforo (§9.9 — 20/07/2026): forma imposta acima; entrada
    // inválida vira "não informado" (padrão 28/20), nunca verde falso.
    margemAlvo: formaMargemSemaforo(evento.margemAlvo),
    margemMinima: formaMargemSemaforo(evento.margemMinima),
    // Desconto parcial (F2-R — sugestão 29a): modo fora do vocabulário vira
    // '' (= modo %); valor não numérico vira '' (= fração cheia). Ambos ''
    // = o cupom age em todos os ingressos, como sempre agiu.
    descontoIngressosModo: modoDesconto,
    // Fração do cupom: no modo % é percentual (faixa 0..100, trava de
    // 20/07/2026); no modo nº é CONTAGEM de ingressos — lá vale só a régua
    // numérica (negativo já conta como 0 na conta, ver descontoEfetivoPct).
    descontoIngressosValor:
      modoDesconto === 'numero'
        ? valorNumericoOuVazio(evento.descontoIngressosValor)
        : pctNaFaixaOuVazio(evento.descontoIngressosValor),
    // Taxa paga pelo cliente (F2-R — sugestão 29b): só 'cliente' liga o
    // repasse (checagem estrita em calc.js); 'nos' preservado; resto vira ''.
    taxaPagaPor:
      evento.taxaPagaPor === 'cliente' || evento.taxaPagaPor === 'nos' ? evento.taxaPagaPor : '',
    // Imposto sobre a receita (Marco, 27/07/2026). A alíquota entra na MESMA
    // régua 0..100 do cupom/taxa/cashback/contingência (trava de 20/07/2026):
    // 150% herdado de um backup à mão viraria um imposto maior que a receita,
    // com o prejuízo mostrado como certo. As três chaves vão pela forma
    // estrita — só `true` liga (ver formaImpostoSobre em imposto.js).
    // Evento sem os campos: alíquota '' e as três desligadas = calc.js nem
    // acrescenta a chave `imposto` ao cenário = conta idêntica à de sempre.
    impostoPct: pctNaFaixaOuVazio(evento.impostoPct),
    impostoSobre: formaImpostoSobre(evento.impostoSobre),
    patrocinios: pat.patrocinios,
    outrasReceitas: pat.outrasReceitas,
    // Itens dispensados "já incluso" (F2-W — sugestão 37): lista de strings
    // não vazias; ausente/inválido → [] (aviso completo, comportamento de
    // sempre). Display-only, nenhum cálculo lê — só o aviso do semáforo.
    itensDispensados: Array.isArray(evento.itensDispensados)
      ? evento.itensDispensados.filter((s) => typeof s === 'string' && s.trim() !== '')
      : [],
    openBar: evento.openBar === true,
    // Bar em dois modos (sugestão 42): só 'porPessoa' liga o modo novo
    // (checagem estrita em calc.js); 'fixo' preservado por forma; ausente/
    // torto vira '' = modo fixo = conta de sempre — evento antigo NUNCA
    // muda de modo na migração.
    barModo:
      evento.barModo === 'porPessoa' || evento.barModo === 'fixo' ? evento.barModo : '',
    barTicket: formaBarTicket(evento.barTicket),
    // Taxa do sistema do bar em 0..100 (Marco, 23/07/2026 — lote de travas,
    // item 1): é % do consumo (calc.js: taxaSistema = consumo * taxaPct / 100),
    // o ÚNICO percentual de conta que faltava travar. 150% herdado derrubava a
    // Receita realista (bar líquido negativo) mostrada como certa; ganhou a
    // MESMA régua dos irmãos (cupom/taxa/cashback). barCustoSistema é DINHEIRO
    // (R$ do sistema), segue na régua numérica. calc.js intocado.
    barTaxaSistemaPct: pctNaFaixaOuVazio(evento.barTaxaSistemaPct),
    barCustoSistema: valorNumericoOuVazio(evento.barCustoSistema),
    // Ajustes de cenário (Marco, 22/07/2026): vendaPct/custoPct/ticketPct em
    // −50..100 (achado do −200 de 20/07). overrides/ticketMedio/etc. intocados.
    cenariosConfig: sub80.cenariosConfig,
    padraoPessimista80: sub80.padraoPessimista80,
    curvaModo: evento.curvaModo === 'forma' || evento.curvaModo === 'datas' ? evento.curvaModo : '',
    // Caixa inicial do evento (F2-C — aba Análise): '' = R$ 0, o padrão da
    // conta aprovada pelo Marco em 19/07/2026.
    caixaInicial: valorNumericoOuVazio(evento.caixaInicial),
    // Início de vendas (F2-S — sugestão 30): data ISO ou '' (= sem início =
    // comportamento de sempre); a premissa N nascida com o evento segue a
    // régua numérica dos demais campos opcionais.
    inicioVendas: formaDataISO(evento.inicioVendas),
    vendasAbremDiasAntes: valorNumericoOuVazio(evento.vendasAbremDiasAntes),
    // Referência da curva (F2-S): modo fora do vocabulário vira '' — média
    // da festa, o padrão de sempre; referência torta nunca muda o gráfico
    // sozinha.
    curvaRef: formaCurvaRef(evento.curvaRef),
    // Lotes: forma da viradaPrevista + id preenchido quando falta (dado
    // antigo) + trava do negativo no preço e na quantidade (Marco, 22/07/2026):
    // preço de lote e quantidade de ingressos ≥ 0 — negativo de backup à mão
    // vira '' ("não informado"); 0 (cortesia) e '' (não preenchido) passam.
    // Preço escrito como texto de zero ("0,00", "R$ 0") vira o número 0 —
    // cortesia, não ausente (P4, Marco 06/10/2026; ver precoDeLoteOuVazio). Os
    // demais campos passam INTOCADOS, e id existente nunca muda.
    lotes: Array.isArray(evento.lotes)
      ? preencherIds(
          evento.lotes.map((l) =>
            l && typeof l === 'object'
              ? {
                  ...l,
                  viradaPrevista: formaViradaPrevista(l.viradaPrevista),
                  valor: precoDeLoteOuVazio(l.valor),
                  quantidade: naoNegativoOuVazio(l.quantidade),
                }
              : l
          ),
          `${ID_LEGADO_PREFIXO}-lote`,
          idsEmUso(evento.lotes)
        )
      : evento.lotes,
    // Itens de custo: mesma regra. O escopo de unicidade é o EVENTO INTEIRO
    // (não só a categoria) — o id de item viaja para o dossiê, as parcelas e
    // os exports de pagamento, então dois itens de categorias diferentes com
    // a mesma identidade seriam um problema esperando acontecer.
    categorias: Array.isArray(evento.categorias)
      ? (() => {
          const usados = new Set()
          for (const c of evento.categorias)
            if (c && typeof c === 'object' && Array.isArray(c.itens))
              for (const id of idsEmUso(c.itens)) usados.add(id)
          return evento.categorias.map((c, ci) =>
            c && typeof c === 'object' && Array.isArray(c.itens)
              ? {
                  ...c,
                  itens: preencherIds(
                    c.itens.map(formaItemCusto),
                    `${ID_LEGADO_PREFIXO}-custo-${ci}`,
                    usados
                  ),
                }
              : c
          )
        })()
      : evento.categorias,
  }
}

/** Inspeção estrita da origem; vazio é ausência, bar negativo é prejuízo válido. */
export function camposReceitaRealizadaInvalidos(evento) {
  const rr = evento?.receitaRealizada || {}
  return ['bilheteria', 'bar', 'pix'].filter((campo) =>
    precisaAvisoNumerico(rr[campo], campo === 'bar' ? valorNumericoOuVazio : naoNegativoOuVazio)
  )
}

/** Só a importação revisada limpa bar; abertura e restauração preservam o bruto. */
export function normalizarReceitaRealizadaDoImport(evento) {
  const rr = evento?.receitaRealizada
  if (!rr || !camposReceitaRealizadaInvalidos(evento).includes('bar')) return evento
  return { ...evento, receitaRealizada: { ...rr, bar: valorNumericoOuVazio(rr.bar) } }
}

export const textoOriginalRealizado = (valor) =>
  typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor)

/** Migra todos os eventos de um store/backup ({ eventos: [...] }). */
export function migrarEventos(eventos) {
  return Array.isArray(eventos) ? eventos.map(migrarEvento) : []
}

// ——————————————— benchmarks: bilheteria bruta e régua do ticket ———————————————
//
// Campos ADITIVOS e OPCIONAIS num benchmark (decisão 6 do Marco,
// DECISOES-MARCO-H4.md, 25/07/2026 — "SIM, com migração que preenche vazio e
// não inventa valor"):
//
//   • `bilheteriaBruta` — o que entrou de ingresso, antes da taxa. É o dado que
//     faltava para calcular o preço médio pago (bilheteria bruta ÷ público) num
//     benchmark já gravado.
//   • `reguaTicket` — qual conta produziu o `ticketMedio` (ver reguaTicket.js).
//
// O QUE ESTA MIGRAÇÃO NÃO FAZ, e é o coração da decisão: ela NUNCA cria esses
// campos. Onde o dado não existe, ele continua não existindo — a bilheteria
// bruta de um benchmark antigo é irrecuperável (BACKLOG: nem ela nem os
// componentes que a derivariam foram salvos), e um número derivado ali pareceria
// medição sem ser. "Preenche vazio" quer dizer literalmente vazio: campo
// ausente, que a tela lê como "não registrado" e diz na cara.
//
// E ela devolve O MESMO OBJETO quando não há nada a sanear. Isso não é
// economia de memória: é a restrição datada do Marco de 20/07/2026 ("NÃO MUDE
// BENCHMARKS ANTIGOS JÁ LANÇADOS"), cujo teste exige IDENTIDADE de objeto
// depois do round-trip de backup (promoverBenchmark.evidencia.test.js, bloco
// "RESTRIÇÃO DURA"). Um `{ ...bm, bilheteriaBruta: null }` inocente derrubaria
// aquela garantia — e derrubaria calado, porque os números continuariam certos.
//
// E ela NÃO POLICIA FAIXA, de propósito. Todo campo de benchmark está fora da
// regra de faixa por decisão datada — a lista de portas de dinheiro registra
// "benchmark é DADO de referência histórico, fora da regra de faixa", e nem
// `receita` nem `lucro` nem `publico` são conferidos por régua na leitura.
// Policiar só o campo novo faria a porta aceitar um número que a leitura
// seguinte apagaria calada, que é o oposto do princípio 4. Bilheteria
// impossível não some: a etiqueta da tela diz "ticket não bate com a
// bilheteria informada" (reguaTicket.js), na cara de quem for comparar.
//
// O ÚNICO trabalho dela é de TIPO: um `"75000"` vindo de arquivo editado à mão
// vira o número 75000, para que a tela não trate como "não anotado" uma
// bilheteria que está anotada. Nada mais é tocado, nada é apagado.

/**
 * Migra UM benchmark. Devolve o próprio objeto recebido quando não há nada a
 * fazer — inclusive quando ele não é um objeto (benchmark torto não é assunto
 * desta migração; quem recusa forma é o parseBackup/conferirFormato).
 */
export function migrarBenchmark(bm) {
  if (!bm || typeof bm !== 'object' || Array.isArray(bm)) return bm
  const bruta = bm.bilheteriaBruta
  if (typeof bruta !== 'string') return bm
  const s = valorNumericoOuVazio(bruta)
  return s === '' ? bm : { ...bm, bilheteriaBruta: Number(s) }
}

/**
 * Migra a lista de benchmarks de um store/backup. Devolve a MESMA lista quando
 * nenhum item precisou de saneamento (ver a nota de identidade acima).
 * Idempotente: migrar duas vezes é igual a migrar uma.
 */
export function migrarBenchmarks(lista) {
  if (!Array.isArray(lista)) return []
  const migrados = lista.map(migrarBenchmark)
  return migrados.every((b, i) => b === lista[i]) ? lista : migrados
}


// ————————————————— censo das normalizações silenciosas (import) —————————————
//
// Aviso AGREGADO na importação de backup (decisão do Marco, 22/07/2026 — 3a, via
// orquestrador; fecha o S3 "Migração normaliza valor fora da faixa em SILÊNCIO"
// do BACKLOG). As portas AO VIVO (campo da tela, planilha do produtor) recusam o
// número fora da faixa com aviso; só a fronteira do backup era muda. O censo
// percorre os eventos CRUS (antes de migrar) e lista o que a migração vai virar
// em "não informado"; a tela mostra um confirm antes de aplicar (ImportModal e
// Ajustes › Backup) e cancelar não importa nada.
//
// FONTE ÚNICA: usa AS MESMAS réguas da migração (naoNegativoOuVazio,
// vendaNaFaixaOuVazio, cenarioNaFaixaOuVazio, pctNaFaixaOuVazio) — nenhum limite
// duplicado. Reporta só NÚMERO presente e FORA da faixa; '' e texto não-numérico
// não entram (já eram "não informado"/lixo antes das travas — o aviso é sobre
// número fora da faixa, não sobre outra classe de corrupção).

// Rótulos legíveis (português) do cenário e da grade — display, não limite.
const CENARIO_NOME_CENSO = { pessimista: 'pessimista', realista: 'realista', otimista: 'otimista' }
const GRADE_NOME_CENSO = {
  vendaPct: 'ingressos vendidos',
  custoPct: 'ajuste de custos',
  ticketPct: 'ajuste do ticket',
}

// Um valor PRESENTE que a MESMA régua da migração vai apagar em silêncio —
// seja porque é um número válido fora da faixa (o caso original), seja porque
// não chega a ser um número legível: objeto/array/boolean, texto fora da
// notação decimal ("oitenta por cento", "1.234,56") ou Infinity/-Infinity/NaN
// (régua do backup mexido à mão, Marco 25/07/2026, caso 2 — "entra, com
// aviso"). Medido: `censoNormalizacoes` devolvia ZERO avisos nos dois casos
// (backupEnvenenado.test.js) — o dado virava "não informado" calado. Os dois
// merecem o MESMO aviso: a migração muda o número da tela do mesmo jeito nos
// dois casos, e o Marco só quer saber que o arquivo vai entrar diferente.
// ('' e `null`/`undefined` NÃO entram — são "não informado" de propósito, não
// corrupção; por isso a checagem exige valorPresente(v) antes.)
const valorPresente = (v) => v !== null && v !== undefined && v !== ''
const precisaAvisoNumerico = (v, regua) => valorPresente(v) && regua(v) === ''

const nomeParaCenso = (s) => (typeof s === 'string' && s.trim() ? s.trim() : 'sem nome')

/**
 * Censo das normalizações silenciosas de um lote de eventos CRUS (decisão 3a).
 * Devolve [{ evento, campo, rotulo, valor }] — um item por valor numérico que a
 * migração vai virar em "não informado" (fora da faixa). Arquivo limpo → [].
 * Ordem: custos → lotes → patrocínio → percentuais do evento → grade de cenário.
 */
export function censoNormalizacoes(eventosCrus, { normalizarBarRealizado = true } = {}) {
  const out = []
  if (!Array.isArray(eventosCrus)) return out
  for (const e of eventosCrus) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const nome = typeof e.nome === 'string' && e.nome.trim() ? e.nome.trim() : '(sem nome)'
    const add = (campo, rotulo, valor) => out.push({ evento: nome, campo, rotulo, valor })
    for (const p of inspecionarEventoFinanceiro(e).problemas)
      out.push({
        evento: nome,
        campo: 'viaFinanceiro',
        rotulo: `vínculo do custo '${p.servico}': ${p.motivos.join('; ')}`,
        para: 'preservado, vínculo não utilizável',
        explicacao: 'O metadado original permanece no backup; não será associado automaticamente a uma origem.',
      })

    for (const campo of camposReceitaRealizadaInvalidos(e)) {
      if (campo === 'bar' && !normalizarBarRealizado) continue
      const valor = e.receitaRealizada[campo]
      out.push({
        evento: nome, campo: `receitaRealizada.${campo}`, valor,
        rotulo: `receita realizada, ${campo}: ${textoOriginalRealizado(valor)}`,
        para: 'não informado',
        explicacao: 'valor inválido — o campo fica vazio e pede o número de novo',
      })
    }

    // Custos ≥ 0 (estimado/realizado)
    if (Array.isArray(e.categorias))
      for (const c of e.categorias)
        if (c && typeof c === 'object' && Array.isArray(c.itens))
          for (const i of c.itens) {
            if (!i || typeof i !== 'object') continue
            if (precisaAvisoNumerico(i.estimado, naoNegativoOuVazio))
              add('estimado', `custo '${nomeParaCenso(i.servico)}', estimado ${fmtBRL2(i.estimado)}`, i.estimado)
            if (precisaAvisoNumerico(i.realizado, naoNegativoOuVazio))
              add('realizado', `custo '${nomeParaCenso(i.servico)}', realizado ${fmtBRL2(i.realizado)}`, i.realizado)
          }

    // Lotes: preço e quantidade ≥ 0
    if (Array.isArray(e.lotes))
      for (const l of e.lotes) {
        if (!l || typeof l !== 'object') continue
        if (precisaAvisoNumerico(l.valor, precoDeLoteOuVazio))
          add('valor', `lote '${nomeParaCenso(l.nome)}', preço ${fmtBRL2(l.valor)}`, l.valor)
        if (precisaAvisoNumerico(l.quantidade, naoNegativoOuVazio))
          add('quantidade', `lote '${nomeParaCenso(l.nome)}', quantidade ${fmtInt(l.quantidade)}`, l.quantidade)
      }

    // Patrocínio ≥ 0 — a lista e o campo solto antigo. O solto só entra quando
    // NÃO há lista: com lista, o solto é consumido para '' de qualquer jeito
    // (a lista é a fonte única) — não é surpresa que mereça aviso.
    if (Array.isArray(e.patrocinios)) {
      for (const p of e.patrocinios) {
        if (!p || typeof p !== 'object') continue
        if (precisaAvisoNumerico(p.valor, naoNegativoOuVazio))
          add('patrocinio', `patrocínio '${nomeParaCenso(p.patrocinador)}', valor ${fmtBRL2(p.valor)}`, p.valor)
      }
    } else if (e.outrasReceitas && typeof e.outrasReceitas === 'object') {
      const solto = e.outrasReceitas.patrocinio
      if (precisaAvisoNumerico(solto, naoNegativoOuVazio))
        add('patrocinio', `patrocínio ${fmtBRL2(solto)}`, solto)
    }

    // Percentuais 0..100 do evento (trava de 20/07): cupom, taxa, cashback,
    // contingência — e a fração do cupom no modo % (a migração usa
    // pctNaFaixaOuVazio quando o modo NÃO é 'numero'; no modo nº é contagem).
    const pctFields = [
      ['descontoMedioPct', 'desconto do cupom'],
      ['taxaBilheteria', 'taxa da bilheteria'],
      ['cashbackPct', 'cashback'],
      ['contingenciaPct', 'contingência'],
      // Lote de travas, item 1 (Marco, 23/07/2026): a taxa do sistema do bar
      // entrou na régua 0..100 dos irmãos — o censo do import passa a listá-la.
      ['barTaxaSistemaPct', 'taxa do sistema do bar'],
      // Imposto sobre a receita (Marco, 27/07/2026): mesma régua dos irmãos, e
      // o censo o lista pelo mesmo motivo dos outros — uma alíquota descartada
      // em silêncio na importação é imposto que some do DRE sem ninguém saber
      // (princípio 4: nada falha em silêncio).
      ['impostoPct', 'alíquota de imposto'],
    ]
    for (const [campo, nomeCampo] of pctFields)
      if (precisaAvisoNumerico(e[campo], pctNaFaixaOuVazio))
        add(campo, `${nomeCampo} ${fmtPct(e[campo])}`, e[campo])
    if (
      e.descontoIngressosModo !== 'numero' &&
      precisaAvisoNumerico(e.descontoIngressosValor, pctNaFaixaOuVazio)
    )
      add(
        'descontoIngressosValor',
        `ingressos com desconto ${fmtPct(e.descontoIngressosValor)}`,
        e.descontoIngressosValor
      )

    // Grade de cenário POR CAMPO: vendaPct 0..100 (faixa própria, 3b), custoPct/
    // ticketPct −50..100. Só os três campos da grade; overrides/ticketMedio não.
    const cfg = e.cenariosConfig
    if (cfg && typeof cfg === 'object')
      for (const cen of CENARIOS_CHAVES) {
        const c = cfg[cen]
        if (!c || typeof c !== 'object') continue
        for (const campo of CAMPOS_GRADE_CENARIO) {
          const regua = campo === 'vendaPct' ? vendaNaFaixaOuVazio : cenarioNaFaixaOuVazio
          if (precisaAvisoNumerico(c[campo], regua))
            add(
              `${cen}.${campo}`,
              `cenário ${CENARIO_NOME_CENSO[cen]}, ${GRADE_NOME_CENSO[campo]} ${fmtPct(c[campo])}`,
              c[campo]
            )
        }
      }
  }
  return out
}

const LIMITE_LISTA_CENSO = 10

/**
 * Texto do confirm do aviso agregado (decisão 3a) — padrão aprovado pelo Marco.
 * Até 10 itens + "…e mais N". Uma linha por item: "• <evento> — <rótulo>".
 * Cancelar o confirm = nada importado (a fiação está nas duas telas de import).
 */
export function textoAvisoNormalizacoes(censo) {
  const n = censo.length
  const cabecalho = censo.some((c) => c.campo === 'viaFinanceiro')
    ? 'Este backup requer conferência; vínculos inválidos serão preservados sem uso automático e os valores fora das faixas entrarão como não informados:'
    : n === 1
      ? "Este backup traz 1 valor fora das faixas do app, que entrará como 'não informado':"
      : `Este backup traz ${n} valores fora das faixas do app, que entrarão como 'não informado':`
  const linhas = censo.slice(0, LIMITE_LISTA_CENSO).map((c) => `• ${c.evento} — ${c.rotulo}`)
  if (n > LIMITE_LISTA_CENSO) linhas.push(`• …e mais ${n - LIMITE_LISTA_CENSO}`)
  return (
    `${cabecalho}\n${linhas.join('\n')}\n\n` +
    'Continuar? (Uma cópia de segurança de antes do import fica em Proteção de dados; o arquivo original não é alterado.)'
  )
}

// ————————————————— datas que NÃO existem no calendário (import) —————————————
//
// Marco, 07/08/2026 — opção (b) do S3 "`evento.data` não é saneada por camada
// nenhuma": AVISAR, e nunca apagar. A opção (a) (a migração zerar o que não for
// data) foi recusada por um custo que a medição mostrou: a migração roda a CADA
// carregamento, e ali não existe tela para avisar nem desfazer — uma data some
// ao abrir o app. O import é a única fronteira que já tem revisão, confirmação
// antes de aplicar e cópia de segurança. É lá que o aviso mora.
//
// POR QUE ESTE CENSO É SEPARADO DO OUTRO: o de cima lista valores que a migração
// vai VIRAR em "não informado". Estes não são apagados — entram exatamente como
// vieram, e é justamente esse o problema. Misturar os dois faria o texto do aviso
// mentir sobre metade da lista.
//
// A RÉGUA É "SOBREVIVE E NÃO É DATA" — e a varredura que a aplica é UMA só, logo
// abaixo, compartilhada com o censo das que somem. Foi assim que este censo
// deixou de ver três campos e passou a ver os seis: enquanto cada lista tinha a
// sua varredura, uma esquecia o que a outra via.
//
// Medido em 07/08/2026, passando `2026-13-99` (forma ISO, mês e dia que não
// existem) pelos seis campos de data do evento:
//
//     evento.data  inicioVendas  viradaPrevista  dataPagamento  parcela.data  dataPaga
//     SOBREVIVE    SOBREVIVE     SOBREVIVE       SOBREVIVE      SOBREVIVE     SOBREVIVE
//
// `evento.data` não passa por camada nenhuma e guarda QUALQUER string; os outros
// cinco passam pelo `formaDataISO`, que confere a FORMA e não a EXISTÊNCIA — daí
// `2026-13-99` atravessar a regex. Trocando por `31/04/2026`, que não tem forma
// ISO, os cinco APAGAM e só a data da festa sobrevive.
//
// Os campos alimentam conta: a data do evento decide passado × futuro, o ritmo e
// a curva; o início de vendas e a virada desenham a curva; pagamento e parcela
// saem no arquivo do contador, que ordena por eles.
// `new Date('2026-02-31T12:00:00')` é 3 de março.

// AS SEIS PORTAS DE DATA, num lugar só. As duas listas do import saem desta
// mesma varredura, e é isso que impede uma de esquecer um campo que a outra vê:
// cada data presente cai num balde ou no outro, conforme a migração a apague ou
// não. (Medido em 07/08/2026: a primeira versão do censo das que SOBREVIVEM
// olhava três campos e deixava `inicioVendas`, `viradaPrevista` e `dataPaga` de
// fora — as três aceitam `2026-13-99` e o guardam.)
function percorrerDatas(e, visitar) {
  const texto = (v) => (typeof v === 'string' ? v : JSON.stringify(v))
  // Presença para DATA é mais estrita que a do censo numérico: string só de
  // espaço é "não informado" do mesmo jeito que vazio — quem digitou nada não
  // merece uma linha dizendo que a data dele não existe.
  const presente = (v) => valorPresente(v) && !(typeof v === 'string' && v.trim() === '')
  const v = (campo, rotulo, valor) => {
    if (presente(valor)) visitar({ campo, rotulo: `${rotulo} '${texto(valor)}'`, valor })
  }
  v('data', 'data da festa', e.data)
  v('inicioVendas', 'início de vendas', e.inicioVendas)
  for (const l of Array.isArray(e.lotes) ? e.lotes : [])
    if (l && typeof l === 'object')
      v('viradaPrevista', `lote '${nomeParaCenso(l.nome)}', virada prevista`, l.viradaPrevista)
  for (const c of Array.isArray(e.categorias) ? e.categorias : [])
    for (const i of Array.isArray(c?.itens) ? c.itens : []) {
      if (!i || typeof i !== 'object') continue
      const cust = `custo '${nomeParaCenso(i.servico)}'`
      v('dataPagamento', `${cust}, pagamento`, i.dataPagamento)
      ;(Array.isArray(i.parcelas) ? i.parcelas : []).forEach((pa, k) => {
        if (!pa || typeof pa !== 'object') return
        v('parcelaData', `${cust}, parcela ${k + 1}, data`, pa.data)
        v('parcelaDataPaga', `${cust}, parcela ${k + 1}, paga em`, pa.dataPaga)
      })
    }
}

/** Esta data SOBREVIVE à migração? (`evento.data` sobrevive sempre.) */
const sobrevive = (campo, valor) => campo === 'data' || formaDataISO(valor) !== ''

function censoDeDatas(eventosCrus, querSobreviventes) {
  const out = []
  if (!Array.isArray(eventosCrus)) return out
  for (const e of eventosCrus) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const nome = typeof e.nome === 'string' && e.nome.trim() ? e.nome.trim() : '(sem nome)'
    percorrerDatas(e, ({ campo, rotulo, valor }) => {
      const viva = sobrevive(campo, valor)
      if (viva !== querSobreviventes) return
      // sobrevivente só interessa se NÃO for data de verdade; apagada sempre
      if (viva && ehDataISO(valor)) return
      out.push({ evento: nome, campo, rotulo, valor })
    })
  }
  return out
}

/**
 * Datas que a migração APAGA, num lote de eventos CRUS. Devolve
 * [{ evento, campo, rotulo, valor }]. Arquivo limpo → [].
 */
export const censoDatasApagadas = (eventosCrus) => censoDeDatas(eventosCrus, false)

/**
 * Datas que SOBREVIVEM à migração sem ser data de verdade. Vazio e ausente não
 * entram — são "não informado" de propósito. Arquivo limpo → [].
 */
export const censoDatasImpossiveis = (eventosCrus) => censoDeDatas(eventosCrus, true)

/** O texto do aviso das datas que somem — a MESMA promessa do censo numérico. */
export function textoAvisoDatasApagadas(censo) {
  const n = censo.length
  const cabecalho =
    n === 1
      ? "Este backup traz 1 data em formato que o app não reconhece, que entrará como 'não informado':"
      : `Este backup traz ${n} datas em formato que o app não reconhece, que entrarão como 'não informado':`
  const linhas = censo.slice(0, LIMITE_LISTA_CENSO).map((c) => `• ${c.evento} — ${c.rotulo}`)
  if (n > LIMITE_LISTA_CENSO) linhas.push(`• …e mais ${n - LIMITE_LISTA_CENSO}`)
  return `${cabecalho}\n${linhas.join('\n')}`
}

/**
 * O texto do aviso das datas impossíveis. Separado do outro de propósito: aqui
 * nada é apagado, e a frase tem de dizer isso.
 */
export function textoAvisoDatasImpossiveis(censo) {
  const n = censo.length
  const cabecalho =
    n === 1
      ? 'Este backup traz 1 data que não existe no calendário. Ela entra COMO ESTÁ (nada é apagado), e o app vai lê-la como outro dia:'
      : `Este backup traz ${n} datas que não existem no calendário. Elas entram COMO ESTÃO (nada é apagado), e o app vai lê-las como outro dia:`
  const linhas = censo.slice(0, LIMITE_LISTA_CENSO).map((c) => `• ${c.evento} — ${c.rotulo}`)
  if (n > LIMITE_LISTA_CENSO) linhas.push(`• …e mais ${n - LIMITE_LISTA_CENSO}`)
  return `${cabecalho}\n${linhas.join('\n')}`
}

/**
 * O aviso ÚNICO do import: junta os dois censos num diálogo só, cada um com a
 * sua frase verdadeira. Devolve '' quando não há nada a avisar — a tela usa isso
 * para decidir se pergunta.
 */
export function avisoDeImport(censo = [], censoDatas = [], censoApagadas = []) {
  const partes = []
  if (censo.length > 0) partes.push(textoAvisoNormalizacoes(censo).split('\n\nContinuar?')[0])
  if (censoApagadas.length > 0) partes.push(textoAvisoDatasApagadas(censoApagadas))
  if (censoDatas.length > 0) partes.push(textoAvisoDatasImpossiveis(censoDatas))
  if (partes.length === 0) return ''
  return (
    `${partes.join('\n\n')}\n\n` +
    'Continuar? (Uma cópia de segurança de antes do import fica em Proteção de dados; o arquivo original não é alterado.)'
  )
}
