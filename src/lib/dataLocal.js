// O relógio da casa — data de HOJE no fuso LOCAL (conserto autorizado pelo
// Marco em 20/07/2026).
//
// ————— por que este módulo existe —————
//
// Até aqui `hojeISO()` era `new Date().toISOString().slice(0, 10)`, e estava
// DUPLICADO com a mesma implementação errada em dois lugares
// (`components/RitmoVendas.jsx` e `lib/resumo.js`). `toISOString()` devolve a
// data em UTC. São Paulo é UTC−3, então das 21h à meia-noite o UTC já virou o
// dia seguinte: NA NOITE DA FESTA, com a festa acontecendo, o app considerava
// o evento passado e anunciava "Evento já realizado" no WhatsApp, no PDF, na
// Home e na curva de vendas — exatamente quando as sócias mais olham a venda.
//
// A duplicação é o que espalhou o defeito, então o conserto não é só a conta:
// é a conta em UM lugar só, com todos os consumidores importando daqui.
//
// ————— a regra —————
//
// A data sai do relógio LOCAL (getFullYear/getMonth/getDate), sem nunca passar
// por UTC. Isso vale nos dois sentidos, e os dois têm teste: em fuso NEGATIVO
// (São Paulo) o erro aparecia à noite; em fuso POSITIVO (Tóquio) apareceria de
// madrugada, empurrando "hoje" para ontem. A suíte roda em TZ=UTC e
// TZ=America/Sao_Paulo — e em UTC as duas implementações concordam, por isso o
// teste também é exercitado em fusos deslocados, para nenhum fuso aprovar por
// acaso.
//
// O que este módulo NÃO faz: nenhuma conta de negócio. `calc.js` continua
// recebendo `hoje` PRONTO por parâmetro, como sempre recebeu — nenhuma fórmula
// é tocada e nenhum número muda por causa deste arquivo.

/** Data local de um `Date` em AAAA-MM-DD (zero à esquerda garantido). */
export function dataISOLocal(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Hoje, no fuso do computador do Marco, em AAAA-MM-DD. */
export const hojeISO = () => dataISOLocal(new Date())

/**
 * O DIA LOCAL de um instante carimbado (Marco, 07/08/2026 — o S2 das 21h).
 *
 * Carimbo de instante (`fechamento.em`, e os carimbos da ponte) é ISO COMPLETO
 * em UTC, e está certo assim no dado: instante é instante, e guardar em UTC é o
 * que permite comparar dois. O errado era EXIBIR fatiando os 10 primeiros
 * caracteres — isso lê a data em UTC, e São Paulo é UTC−3:
 *
 *     relógio do Marco     : Wed Aug 05 2026 21:30:00
 *     fechamento.em gravado: 2026-08-06T00:30:00.000Z
 *     .slice(0, 10) mostrava: 06/08/2026      ← o dia SEGUINTE
 *     o dia local É        : 05/08/2026
 *
 * É a mesma família do S1 de 20/07/2026 que fez este módulo nascer, viva em
 * seis telas de exibição — inclusive o PDF e o resumo do WhatsApp que vão para
 * as sócias. E a janela não é borda rara: depois das 21h é o horário em que se
 * fecha uma festa.
 *
 * Nada do que está salvo muda: esta função só LÊ o carimbo. Vazio devolve vazio,
 * porque `fmtData` já trata '' como "não informado".
 *
 * ————— os dois casos que NÃO são instante, e por que cada um sai assim —————
 *
 * Achados atacando esta própria função em 07/08/2026, no mesmo dia em que ela
 * nasceu — e o primeiro é a MESMA classe de defeito que ela existe para
 * consertar, que eu tinha acabado de introduzir:
 *
 *     valor          sem o tratamento    com o tratamento
 *     2026-08-05     04/08/2026          05/08/2026
 *     lixo           NaN/NaN/NaN         lixo
 *
 * 1. DATA PURA (sem hora) não é instante: `new Date('2026-08-05')` é meia-noite
 *    em UTC, que em São Paulo é 21h do dia ANTERIOR — a data voltava um dia.
 *    Data pura já ESTÁ no calendário local; devolver como veio é a única
 *    resposta que não inventa fuso onde não há.
 * 2. TEXTO QUE NÃO É DATA (backup mexido à mão) devolvia `NaN/NaN/NaN` na tela.
 *    Volta a sair CRU, que é o que as seis telas mostravam antes desta função
 *    existir: ver o lixo salvo é feio e é informação; ver "NaN" é feio e não é.
 */
export const dataLocalDoInstante = (iso) => {
  if (typeof iso !== 'string' || !iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dataISOLocal(d)
}
