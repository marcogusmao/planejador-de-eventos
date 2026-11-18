import { describe, it, expect } from 'vitest'
import {
  destinoDoDesfazer,
  NO_EVENTO,
  NO_RASCUNHO,
  EM_LUGAR_NENHUM,
  FIM_APLICADO,
  FIM_DESCARTADO,
  AVISO_SEM_DESFAZER,
} from './desfazerDoRascunho.js'

// Os quatro caminhos do "Desfazer" que sobrevive ao fim da simulação. O
// caminho que motivou o módulo é o terceiro: até 05/08/2026 ele gravava no
// evento o valor que o descarte tinha jogado fora.
const carimboDoRascunho = (geracao = 1) => ({ alvo: NO_RASCUNHO, geracao })
const carimboDoEvento = (geracao = 1) => ({ alvo: NO_EVENTO, geracao })

describe('destinoDoDesfazer — a ação escreveu no RASCUNHO', () => {
  it('rascunho ainda aberto: desfaz no próprio rascunho, nada é salvo', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), { simulando: true, geracao: 1, fim: null })
    ).toBe(NO_RASCUNHO)
  })

  it('rascunho APLICADO: desfaz no evento — é lá que a mudança passou a morar', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), {
        simulando: false,
        geracao: 1,
        fim: FIM_APLICADO,
      })
    ).toBe(NO_EVENTO)
  })

  // O achado S1 de 05/08/2026, na forma da regra: bar salvo R$ 110/pessoa,
  // arrastado para R$ 250 só no rascunho, copiado nos três, DESCARTADO. Se este
  // caso devolvesse NO_EVENTO, os R$ 250 descartados virariam o bar da festa —
  // R$ 213.728,20 de receita a mais na Marfim, exibidos como certos.
  it('rascunho DESCARTADO: lugar nenhum — o que ia ser desfeito nunca foi salvo', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), {
        simulando: false,
        geracao: 1,
        fim: FIM_DESCARTADO,
      })
    ).toBe(EM_LUGAR_NENHUM)
  })

  it('outro rascunho já aberto no lugar: lugar nenhum — a hipótese daquela ação morreu', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), { simulando: true, geracao: 2, fim: null })
    ).toBe(EM_LUGAR_NENHUM)
  })

  it('aplicado e JÁ dentro de uma simulação nova: também lugar nenhum', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), {
        simulando: true,
        geracao: 2,
        fim: FIM_APLICADO,
      })
    ).toBe(EM_LUGAR_NENHUM)
  })

  it('sem saber como terminou, não escreve — a dúvida não vira gravação', () => {
    expect(
      destinoDoDesfazer(carimboDoRascunho(1), { simulando: false, geracao: 1, fim: null })
    ).toBe(EM_LUGAR_NENHUM)
  })
})

describe('destinoDoDesfazer — a ação escreveu no EVENTO', () => {
  it('fora da simulação: desfaz no evento', () => {
    expect(
      destinoDoDesfazer(carimboDoEvento(0), { simulando: false, geracao: 0, fim: null })
    ).toBe(NO_EVENTO)
  })

  // O espelho do achado: copiar o bar nos três FORA da simulação e clicar
  // Desfazer depois de entrar nela. O desfazer vai para o evento salvo, que é
  // onde a cópia está — nunca para o rascunho, que não foi quem a recebeu.
  it('já dentro de uma simulação aberta depois: continua indo para o evento', () => {
    expect(
      destinoDoDesfazer(carimboDoEvento(0), { simulando: true, geracao: 1, fim: null })
    ).toBe(NO_EVENTO)
  })
})

describe('destinoDoDesfazer — sem carimbo', () => {
  // A aba Cenários montada fora do editor (relatório, testes de outras telas)
  // recebe `update` direto e não tem canal roteado. O comportamento de sempre
  // — gravar — continua sendo o certo ali.
  it('marca ausente é o comportamento de sempre: grava no evento', () => {
    expect(destinoDoDesfazer(undefined, { simulando: false, geracao: 0 })).toBe(NO_EVENTO)
    expect(destinoDoDesfazer(null, {})).toBe(NO_EVENTO)
  })

  it('marca com alvo desconhecido também cai no evento, nunca num rascunho', () => {
    expect(destinoDoDesfazer({ alvo: 'outra-coisa', geracao: 1 }, { simulando: true, geracao: 1 })).toBe(
      NO_EVENTO
    )
  })

  it('sem o segundo argumento não explode — devolve o evento', () => {
    expect(destinoDoDesfazer(carimboDoEvento(0))).toBe(NO_EVENTO)
  })
})

describe('a frase da tela', () => {
  it('diz que nada estava salvo, em português e sem jargão', () => {
    expect(AVISO_SEM_DESFAZER).toMatch(/descartada/)
    expect(AVISO_SEM_DESFAZER).toMatch(/desfazer/)
    expect(AVISO_SEM_DESFAZER).not.toMatch(/rascunho|canal|update/i)
  })
})
