// A QUARENTENA guarda o dado ilegível do Marco — e a regra dela é uma só:
// UMA cópia por CONTEÚDO. Nem menos, nem mais.
//
// Quando o conteúdo salvo do Planejador não abre, `loadStore` copia o bruto
// para uma chave `previsao-eventos:quarentena:<carimbo>` antes de qualquer
// outra coisa. Essa cópia é o que sobra: é dela que sai o "leve o dado embora"
// da faixa de socorro (`exportarQuarentena`), e é ela que permite periciar
// depois o que estava salvo. A busca das linhas 99–102 do `storage.js` é quem
// decide se o bruto que chega agora JÁ está guardado.
//
// Os dois lados dessa decisão erram para lados opostos, e os dois custam dado:
//
//   • achar de menos → cada reabertura do app faz mais uma cópia INTEIRA do
//     mesmo conteúdo. O armazenamento do navegador tem teto (~5 MB) e o store
//     do Marco é o arquivo grande dessa gaveta — encher o teto com cópias
//     iguais consome exatamente o espaço de que o resgate precisa, e é o mesmo
//     espaço que os instantâneos automáticos (protecao.js) disputam.
//
//   • achar de mais → um conteúdo NOVO é dado como "já guardado" e nunca chega
//     a ser gravado. A faixa aponta para a cópia velha, o Marco baixa o arquivo
//     achando que leva o estrago de hoje, e leva o de outro dia.
//
// Por que estes dois testes existem, medido em 27/07/2026: o
// `leituraCorrompida.test.js` já cobrava "recarregar a página não multiplica
// cópias", mas as três leituras dele acontecem no MESMO milissegundo — o
// carimbo do nome da chave sai igual nas três, a terceira grava por cima da
// primeira, e a conta fecha em 1 cópia mesmo com a busca desligada. Os testes
// daqui separam as leituras no calendário, que é como o Marco de fato reabre o
// app: fecha à noite, abre de manhã.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadStore, estadoLeitura, liberarGravacao, listarQuarentena } from './storage.js'

const KEY = 'previsao-eventos:v1'

// O conteúdo salvo da Brisa 05/12 cortado no meio (o navegador encerrou a
// gravação pela metade). É JSON que não fecha: `JSON.parse` lança e o caminho
// da quarentena arma. Os números são os da festa — 600 ingressos a R$ 80.
const BRISA_CORTADA =
  '{"eventos":[{"id":"brisa-05-12","nome":"Brisa 05/12","data":"2026-12-05",' +
  '"lotes":[{"id":"l1","nome":"1º lote","preco":80,"qtd":600}],' +
  '"categorias":[{"nome":"Estrutura","itens":[{"desc":"Som e luz","estimado":9800'

// Dias depois o Marco cadastrou a Marfim Alto 09/05 e o conteúdo salvo
// estragou OUTRA vez — agora com as duas festas dentro. É um conteúdo
// DIFERENTE do de cima, e é o mais recente: perder este é perder o trabalho
// dos dias entre uma corrupção e a outra.
const BRISA_E_MARFIM_CORTADAS =
  '{"eventos":[{"id":"brisa-05-12","nome":"Brisa 05/12","data":"2026-12-05",' +
  '"lotes":[{"id":"l1","nome":"1º lote","preco":80,"qtd":600}],' +
  '"categorias":[{"nome":"Estrutura","itens":[{"desc":"Som e luz","estimado":9800}]}]},' +
  '{"id":"marfim-09-05","nome":"Marfim Alto 09/05","data":"2027-05-09",' +
  '"lotes":[{"id":"l1","nome":"1º lote","preco":90,"qtd":600'

// localStorage de mentira com a MESMA superfície do navegador de verdade —
// inclusive o contrato do `key(i)`: fora da faixa devolve null (é o que o
// jsdom e o WebKit da casca nativa fazem). Os dados REAIS do Marco nunca
// entram aqui.
function memoriaFalsa(inicial = {}) {
  const mem = new Map(Object.entries(inicial))
  return {
    mem,
    api: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      get length() {
        return mem.size
      },
      key: (i) => [...mem.keys()][i] ?? null,
    },
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // `falhaLeitura` é estado de MÓDULO: sem destravar aqui, um teste que a liga
  // contamina os seguintes.
  liberarGravacao()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('quarentena — o MESMO conteúdo ilegível guarda UMA cópia só', () => {
  it('fechar o app à noite e reabrir de manhã não faz uma segunda cópia do mesmo bruto', () => {
    const { mem, api } = memoriaFalsa({ [KEY]: BRISA_CORTADA })
    vi.stubGlobal('localStorage', api)
    vi.useFakeTimers()

    // Noite da Brisa: o Marco abre o app e o conteúdo salvo não abre.
    vi.setSystemTime(new Date('2026-12-05T21:40:00'))
    loadStore()
    const primeiraCopia = estadoLeitura().chaveQuarentena
    expect(listarQuarentena()).toEqual([primeiraCopia])
    expect(mem.get(primeiraCopia)).toBe(BRISA_CORTADA)
    liberarGravacao()

    // Manhã seguinte: mesmo conteúdo estragado, carimbo de hora NOVO. É aqui
    // que a busca tem de reconhecer o que já está guardado — sem ela, o nome
    // da chave é outro e o navegador aceita a cópia repetida sem reclamar.
    vi.setSystemTime(new Date('2026-12-06T09:15:00'))
    loadStore()

    expect(estadoLeitura().chaveQuarentena).toBe(primeiraCopia)
    expect(listarQuarentena()).toEqual([primeiraCopia])
  })

  it('três reaberturas em três dias ocupam o espaço de UM bruto, não de três', () => {
    const { mem, api } = memoriaFalsa({ [KEY]: BRISA_CORTADA })
    vi.stubGlobal('localStorage', api)
    vi.useFakeTimers()

    for (const quando of ['2026-12-05T21:40:00', '2026-12-06T09:15:00', '2026-12-07T18:02:00']) {
      vi.setSystemTime(new Date(quando))
      loadStore()
      liberarGravacao()
    }

    const chaves = listarQuarentena()
    expect(chaves).toHaveLength(1)
    // A conta que interessa ao teto do navegador: o bruto ocupa o tamanho dele
    // uma vez, não três. Guardar de novo o que já está guardado só tira espaço
    // dos instantâneos automáticos e do próprio resgate.
    const bytesGuardados = chaves.reduce((soma, k) => soma + mem.get(k).length, 0)
    expect(bytesGuardados).toBe(BRISA_CORTADA.length)
  })
})

describe('quarentena — um conteúdo ilegível DIFERENTE ganha a cópia dele', () => {
  it('a corrupção nova é guardada; a cópia velha não é reaproveitada no lugar dela', () => {
    const { mem, api } = memoriaFalsa({ [KEY]: BRISA_CORTADA })
    vi.stubGlobal('localStorage', api)
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-12-05T21:40:00'))
    loadStore()
    const copiaDaBrisa = estadoLeitura().chaveQuarentena
    liberarGravacao()

    // Entre uma corrupção e a outra o Marco cadastrou a Marfim Alto. O que
    // está salvo agora é OUTRO conteúdo — e é o mais recente que ele tem.
    mem.set(KEY, BRISA_E_MARFIM_CORTADAS)
    vi.setSystemTime(new Date('2026-12-09T08:20:00'))
    loadStore()
    const copiaDasDuas = estadoLeitura().chaveQuarentena

    expect(copiaDasDuas).not.toBe(copiaDaBrisa)
    expect(listarQuarentena()).toHaveLength(2)
    // Cada cópia guarda o conteúdo dela, inteiro.
    expect(mem.get(copiaDaBrisa)).toBe(BRISA_CORTADA)
    expect(mem.get(copiaDasDuas)).toBe(BRISA_E_MARFIM_CORTADAS)
  })

  it('o que a faixa de socorro oferece baixar é o estrago de AGORA, não o de outro dia', () => {
    const { mem, api } = memoriaFalsa({ [KEY]: BRISA_CORTADA })
    vi.stubGlobal('localStorage', api)
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-12-05T21:40:00'))
    loadStore()
    liberarGravacao()

    mem.set(KEY, BRISA_E_MARFIM_CORTADAS)
    vi.setSystemTime(new Date('2026-12-09T08:20:00'))
    loadStore()

    // `chaveQuarentena` é o que a faixa entrega ao `exportarQuarentena`. Se ela
    // apontasse para a cópia de 05/12, o Marco baixaria um arquivo sem a Marfim
    // Raiz achando que leva tudo — e a festa que ele acabou de cadastrar
    // sumiria sem ninguém contar.
    const bruto = mem.get(estadoLeitura().chaveQuarentena)
    expect(bruto).toBe(BRISA_E_MARFIM_CORTADAS)
    expect(bruto).toContain('Marfim Alto 09/05')
  })
})
