// Detecção de segunda aba (hardening 4.2 — Marco, via auditoria externa
// 18/07/2026). Duas abas da previsão gravam no MESMO localStorage e podem se
// sobrescrever (a última que salvar vence). Mitigação mínima decidida no
// prompt: detectar e AVISAR — nada de lock, nada de bloquear.
//
// Protocolo (BroadcastChannel 'previsao-eventos:abas:v1'), robusto a aba
// que morre SEM se despedir (crash, aba morta pelo navegador):
//   - ao abrir, a aba grita { tipo:'oi' }; quem ouve responde
//     { tipo:'estou-aqui' } — detecção imediata nos dois lados;
//   - a cada `msBatida` a aba grita { tipo:'batida' } (batimento cardíaco);
//   - cada aba lembra QUANDO ouviu cada vizinha pela última vez; vizinha
//     sem sinal por `msSumico` é dada como fechada — o aviso some sozinho;
//   - fechar limpo ainda grita { tipo:'tchau' } para o aviso sumir na hora.
// Tudo local (BroadcastChannel não sai da máquina — zero rede). Navegador
// sem BroadcastChannel: nenhum aviso (nunca um alarme falso).

import { uid } from './util.js'

export const CANAL_ABAS = 'previsao-eventos:abas:v1'

/**
 * Começa a vigiar outras abas. `aoMudar(true|false)` é chamado quando muda a
 * resposta de "existe outra aba?". Retorna a função de limpeza (despede-se e
 * fecha o canal). `criarCanal`, `msBatida` e `msSumico` são injetáveis para
 * teste.
 */
export function vigiarOutrasAbas(
  aoMudar,
  { criarCanal, msBatida = 3000, msSumico = 8000 } = {}
) {
  const fabrica =
    criarCanal ||
    (typeof BroadcastChannel !== 'undefined' ? (nome) => new BroadcastChannel(nome) : null)
  if (!fabrica) return () => {}

  let canal
  try {
    canal = fabrica(CANAL_ABAS)
  } catch (e) {
    console.error('Erro ao abrir o canal entre abas', e)
    return () => {}
  }

  const id = uid()
  const vistas = new Map() // id da vizinha → última vez que deu sinal
  let avisando = false

  const reavaliar = () => {
    const corte = Date.now() - msSumico
    for (const [outra, quando] of vistas) if (quando < corte) vistas.delete(outra)
    const ha = vistas.size > 0
    if (ha !== avisando) {
      avisando = ha
      aoMudar(ha)
    }
  }

  canal.onmessage = (ev) => {
    const m = ev && ev.data ? ev.data : {}
    if (!m.tipo || !m.id || m.id === id) return
    if (m.tipo === 'tchau') {
      vistas.delete(m.id)
    } else {
      vistas.set(m.id, Date.now())
      if (m.tipo === 'oi') canal.postMessage({ tipo: 'estou-aqui', id })
    }
    reavaliar()
  }

  const batida = setInterval(() => {
    try {
      canal.postMessage({ tipo: 'batida', id })
    } catch {
      /* canal fechado */
    }
    reavaliar()
  }, msBatida)

  const despedir = () => {
    try {
      canal.postMessage({ tipo: 'tchau', id })
    } catch {
      /* canal já fechado — nada a fazer */
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', despedir)

  canal.postMessage({ tipo: 'oi', id })

  return () => {
    clearInterval(batida)
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', despedir)
    despedir()
    canal.close()
  }
}
