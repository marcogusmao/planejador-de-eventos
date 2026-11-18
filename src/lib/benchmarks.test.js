import { describe, it, expect, vi } from 'vitest'
import {
  lucroNaoFecha,
  consolidarCustosDePlanilha,
  FIXED_BENCHMARKS,
  aplicarOverride,
  benchmarkBase,
  benchmarksDisponiveis,
  benchmarksVisiveis,
  benchmarksOcultosIds,
  benchmarksOcultosLista,
  benchmarksAtivos,
  benchmarksApagadosIds,
  benchmarksApagadosLista,
  benchmarkTemPadraoSalvo,
  ocultarBenchmark,
  mostrarBenchmark,
  excluirBenchmarkCustom,
  apagarBenchmarkEmbutido,
  restaurarBenchmarkApagado,
  salvarBenchmarkComoPadrao,
  restaurarBenchmarkPadrao,
  restaurarBenchmarkFabrica,
  somaCustos,
  porPessoa,
  divPorPessoa,
  pseudoBenchmarkDeCenario,
  CAT_KEYS,
} from './benchmarks.js'
import { computeCenario } from './calc.js'
import { clone } from './util.js'

const cordel = FIXED_BENCHMARKS[0]

describe('edição de benchmarks (overrides)', () => {
  it('sem override, devolve o benchmark original intacto', () => {
    expect(aplicarOverride(cordel, undefined)).toBe(cordel)
  })

  it('editar uma categoria recalcula o custo total e marca como editado', () => {
    const editado = aplicarOverride(cordel, { custos: { aeb: 20000 } })
    expect(editado.custos.aeb).toBe(20000)
    expect(editado.custos.estrutura).toBe(41250) // demais categorias preservadas
    expect(editado.custoTotal).toBe(84650 - 16420 + 20000)
    expect(editado.editado).toBe(true)
    expect(cordel.custos.aeb).toBe(16420) // original não muda
  })

  it('editar campos simples (público, nome) preserva os custos', () => {
    const editado = aplicarOverride(cordel, { publico: 450, nome: 'Cordel (corrigido)' })
    expect(editado.publico).toBe(450)
    expect(editado.nome).toBe('Cordel (corrigido)')
    expect(editado.custoTotal).toBe(84650)
  })

  it('zerar uma categoria (null) tira ela da soma', () => {
    const editado = aplicarOverride(cordel, { custos: { estrutura: null } })
    expect(editado.custoTotal).toBe(84650 - 41250)
  })

  it('benchmarksDisponiveis aplica overrides e inclui os importados', () => {
    const store = {
      benchmarksCustom: [{ id: 'x', nome: 'Importado', custos: {}, custoTotal: 0 }],
      benchmarkOverrides: { 'bm-cordel': { publico: 500 } },
    }
    const todos = benchmarksDisponiveis(store)
    expect(todos).toHaveLength(FIXED_BENCHMARKS.length + 1)
    expect(todos[0].publico).toBe(500)
    expect(todos.at(-1).nome).toBe('Importado')
  })

  it('somaCustos ignora nulls', () => {
    expect(somaCustos({ aeb: 100, locacao: null, extras: 50 })).toBe(150)
  })
})

describe('ocultar benchmark das comparações (sugestão 25 — reversível, Sessão Q)', () => {
  const storeBase = () => ({
    benchmarksCustom: [{ id: 'x', nome: 'Importado', custom: true, custos: {}, custoTotal: 1234 }],
    benchmarkOverrides: {},
    benchmarksOcultos: [],
  })

  it('sem ocultos: visíveis = disponíveis (backup/store antigo sem a chave também)', () => {
    expect(benchmarksVisiveis(storeBase())).toEqual(benchmarksDisponiveis(storeBase()))
    const semChave = { benchmarksCustom: [], benchmarkOverrides: {} }
    expect(benchmarksVisiveis(semChave)).toEqual(benchmarksDisponiveis(semChave))
    expect(benchmarksOcultosIds(semChave)).toEqual([])
  })

  it('ocultar tira o benchmark (embutido OU custom) dos visíveis e o põe na lista de ocultos', () => {
    let s = ocultarBenchmark(storeBase(), 'bm-cordel')
    s = ocultarBenchmark(s, 'x')
    expect(benchmarksVisiveis(s).map((b) => b.id)).not.toContain('bm-cordel')
    expect(benchmarksVisiveis(s).map((b) => b.id)).not.toContain('x')
    expect(benchmarksOcultosLista(s).map((b) => b.id)).toEqual(['bm-cordel', 'x'])
  })

  it('REVERSÍVEL: mostrar de novo devolve tudo como era — nenhum número foi tocado', () => {
    const original = storeBase()
    const congelado = clone(original)
    let s = ocultarBenchmark(original, 'bm-cordel')
    s = mostrarBenchmark(s, 'bm-cordel')
    expect(benchmarksVisiveis(s)).toEqual(benchmarksVisiveis(congelado))
    // números dos embutidos intactos (princípio 3): a fonte nunca muda
    expect(FIXED_BENCHMARKS[0].custoTotal).toBe(84650)
    expect(original.benchmarksCustom).toEqual(congelado.benchmarksCustom)
  })

  it('ocultar NÃO altera nem apaga o benchmark: ele continua íntegro na lista de ocultos', () => {
    const s = ocultarBenchmark(storeBase(), 'bm-cordel')
    const oculto = benchmarksOcultosLista(s)[0]
    expect(oculto.custoTotal).toBe(84650)
    expect(oculto.custos.aeb).toBe(16420)
    expect(s.benchmarkOverrides).toEqual({})
  })

  it('idempotente: ocultar duas vezes não duplica o id; mostrar algo não oculto não quebra', () => {
    let s = ocultarBenchmark(storeBase(), 'bm-cordel')
    s = ocultarBenchmark(s, 'bm-cordel')
    expect(benchmarksOcultosIds(s)).toEqual(['bm-cordel'])
    expect(benchmarksOcultosIds(mostrarBenchmark(storeBase(), 'nunca-oculto'))).toEqual([])
  })

  it('benchmarksAtivos exclui os ocultos SEM tocar em evento.benchmarksAtivos', () => {
    const evento = { benchmarksAtivos: ['bm-cordel', 'x'] }
    const s = ocultarBenchmark(storeBase(), 'bm-cordel')
    expect(benchmarksAtivos(evento, s).map((b) => b.id)).toEqual(['x'])
    expect(evento.benchmarksAtivos).toEqual(['bm-cordel', 'x']) // intocado
    // mostrar de novo: volta a aparecer no evento sem mexer em nada
    expect(benchmarksAtivos(evento, mostrarBenchmark(s, 'bm-cordel')).map((b) => b.id)).toEqual([
      'bm-cordel',
      'x',
    ])
  })

  it('excluirBenchmarkCustom exclui de verdade E limpa o id da lista de ocultos', () => {
    let s = ocultarBenchmark(storeBase(), 'x')
    s = excluirBenchmarkCustom(s, 'x')
    expect(s.benchmarksCustom).toEqual([])
    expect(benchmarksOcultosIds(s)).toEqual([])
  })

  it('lista de ocultos com lixo (não-string, não-array) é saneada — nunca quebra tela', () => {
    expect(benchmarksOcultosIds({ benchmarksOcultos: ['bm-cordel', 7, null, {}] })).toEqual([
      'bm-cordel',
    ])
    expect(benchmarksOcultosIds({ benchmarksOcultos: 'bm-cordel' })).toEqual([])
    expect(benchmarksOcultosIds(null)).toEqual([])
  })

  it('round-trip de backup: antigo (sem a chave) abre com nada oculto; com a chave, reimporta idêntico', async () => {
    const { parseBackup, mesclarBackup } = await import('./storage.js')
    const antigo = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [] })
    )
    expect(antigo.benchmarksOcultos).toBeNull() // ausente no arquivo → não mexe ao mesclar
    const atual = { eventos: [], benchmarksCustom: [], benchmarkOverrides: {}, benchmarksOcultos: ['bm-cordel'] }
    expect(mesclarBackup(atual, antigo).benchmarksOcultos).toEqual(['bm-cordel'])
    // backup novo COM a chave substitui por inteiro
    const novo = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [], benchmarksOcultos: ['x'] })
    )
    expect(mesclarBackup(atual, novo).benchmarksOcultos).toEqual(['x'])
    const vazioExplicito = parseBackup(
      JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [], benchmarksOcultos: [] })
    )
    expect(mesclarBackup(atual, vazioExplicito).benchmarksOcultos).toEqual([])
  })
})

describe('divisão por pessoa (sugestão 8)', () => {
  it('divPorPessoa divide pelo público informado', () => {
    expect(divPorPessoa(1000, 200)).toBe(5)
  })
  it('divPorPessoa devolve null sem público ou sem valor', () => {
    expect(divPorPessoa(1000, 0)).toBeNull()
    expect(divPorPessoa(1000, null)).toBeNull()
    expect(divPorPessoa(null, 200)).toBeNull()
  })
  it('porPessoa continua igual (agora via divPorPessoa) — sem regressão', () => {
    expect(porPessoa(cordel, 84650)).toBeCloseTo(84650 / 400)
    expect(porPessoa({ publico: null }, 100)).toBeNull()
  })
})

describe('pseudoBenchmarkDeCenario (sugestão 7, Sessão J — comparar previsões)', () => {
  const eventoOutro = () => ({
    lotes: [
      { id: 'l1', nome: 'Lote 1', valor: 100, quantidade: 200 },
      { id: 'l2', nome: 'Lote 2', valor: 150, quantidade: 100 },
    ],
    taxaBilheteria: 10,
    cashbackPct: 5,
    categorias: [
      { id: 'aeb', nome: 'A&B', itens: [{ estimado: 5000, realizado: '' }] },
      { id: 'locacao', nome: 'Locação & Doc', itens: [{ estimado: 3000, realizado: '' }] },
      { id: 'extra-custom', nome: 'Categoria custom', itens: [{ estimado: 900, realizado: '' }] },
    ],
    contingenciaPct: 5,
    outrasReceitas: { bar: 2000, patrocinio: 0 },
    cenariosConfig: { realista: { vendaPct: 90 } },
  })

  it('reshape básico: nome vem de fora, resto vem do cenário calculado', () => {
    const r = computeCenario(eventoOutro(), 'realista')
    const pseudo = pseudoBenchmarkDeCenario('Outro Espaço', r)
    expect(pseudo.nome).toBe('Outro Espaço')
    expect(pseudo.publico).toBe(r.publico)
    expect(pseudo.custoTotal).toBe(r.custoTotal)
    expect(pseudo.receita).toBe(r.receitaTotal)
    expect(pseudo.ticketMedio).toBe(r.ticketMedio)
    expect(pseudo.lucro).toBe(r.lucro)
  })

  it('custos só inclui as categorias padrão (CAT_KEYS) — categoria custom fica de fora, como nos benchmarks fixos', () => {
    const r = computeCenario(eventoOutro(), 'realista')
    const pseudo = pseudoBenchmarkDeCenario('Outro Espaço', r)
    expect(pseudo.custos.aeb).toBe(5000)
    expect(pseudo.custos.locacao).toBe(3000)
    expect(pseudo.custos['extra-custom']).toBeUndefined()
    expect(Object.keys(pseudo.custos).every((k) => CAT_KEYS.includes(k))).toBe(true)
    // mas o custoTotal do pseudo-benchmark é o de verdade (inclui a custom) —
    // só a quebra por categoria (visual, como os benchmarks fixos) que ignora
    // categorias fora do padrão.
    expect(pseudo.custoTotal).toBe(r.custoTotal)
  })

  it('não muta o cenário original nem tem chave em comum indevida com FIXED_BENCHMARKS', () => {
    const r = computeCenario(eventoOutro(), 'realista')
    const pseudo = pseudoBenchmarkDeCenario('Outro Espaço', r)
    expect(FIXED_BENCHMARKS.some((b) => b.id === pseudo.id)).toBe(false)
    expect(r.custosCategorias).toBeDefined() // objeto original intacto
  })
})

// ————————————————————————————————————————————————————————————————————————
// Gestão de benchmarks pelo Marco (19/07/2026 — princípio 3 ampliado).
// Imutabilidade = contra mudança automática/silenciosa; o dono pode apagar,
// salvar-como-padrão e restaurar, sempre reversível, com a fábrica intacta.
// ————————————————————————————————————————————————————————————————————————

describe('apagar benchmark embutido (Sessão de Gestão de Benchmarks, 19/07/2026)', () => {
  const store = () => ({
    benchmarksCustom: [{ id: 'x', nome: 'Importado', custom: true, custos: {}, custoTotal: 0 }],
    benchmarkOverrides: {},
    benchmarksApagados: [],
  })

  it('apagar tira o embutido de disponíveis, visíveis e ativos — mas some da lista principal e vai para a de apagados', () => {
    const s = apagarBenchmarkEmbutido(store(), 'bm-cordel')
    expect(benchmarksDisponiveis(s).map((b) => b.id)).not.toContain('bm-cordel')
    expect(benchmarksVisiveis(s).map((b) => b.id)).not.toContain('bm-cordel')
    expect(benchmarksAtivos({}, s).map((b) => b.id)).not.toContain('bm-cordel')
    // na lista de apagados, na forma completa (para a UI mostrar nome/custo)
    expect(benchmarksApagadosLista(s).map((b) => b.id)).toEqual(['bm-cordel'])
    expect(benchmarksApagadosLista(s)[0].custoTotal).toBe(84650)
    // FÁBRICA intacta (o dado embutido nunca sai do código — princípio 3)
    expect(FIXED_BENCHMARKS[0].custoTotal).toBe(84650)
  })

  it('REVERSÍVEL: restaurar traz de volta exatamente como era', () => {
    let s = apagarBenchmarkEmbutido(store(), 'bm-cordel')
    s = restaurarBenchmarkApagado(s, 'bm-cordel')
    expect(benchmarksDisponiveis(s)).toEqual(benchmarksDisponiveis(store()))
    expect(benchmarksApagadosLista(s)).toEqual([])
  })

  it('idempotente e lista saneada (não-string/não-array não quebra)', () => {
    let s = apagarBenchmarkEmbutido(store(), 'bm-cordel')
    s = apagarBenchmarkEmbutido(s, 'bm-cordel')
    expect(benchmarksApagadosIds(s)).toEqual(['bm-cordel'])
    expect(benchmarksApagadosIds({ benchmarksApagados: ['bm-cordel', 7, null, {}] })).toEqual([
      'bm-cordel',
    ])
    expect(benchmarksApagadosIds({ benchmarksApagados: 'bm-cordel' })).toEqual([])
    expect(benchmarksApagadosIds(null)).toEqual([])
  })

  it('apagar PRESERVA as edições: restaurar devolve o benchmark com o override que tinha', () => {
    let s = {
      benchmarksCustom: [],
      benchmarkOverrides: { 'bm-cordel': { publico: 500 } },
      benchmarksApagados: [],
    }
    s = apagarBenchmarkEmbutido(s, 'bm-cordel')
    expect(benchmarksApagadosLista(s)[0].publico).toBe(500)
    s = restaurarBenchmarkApagado(s, 'bm-cordel')
    expect(benchmarksDisponiveis(s)[0].publico).toBe(500)
  })
})

describe('salvar como padrão / restaurar de fábrica (Sessão de Gestão de Benchmarks)', () => {
  const comOverride = () => ({
    benchmarksCustom: [],
    benchmarkOverrides: { 'bm-cordel': { publico: 450, custos: { aeb: 20000 } } },
    benchmarksPadrao: {},
  })
  const NOVO_TOTAL = 84650 - 16420 + 20000

  it('antes de salvar: a base atual mostra "editado" com os valores do Marco', () => {
    const bm = benchmarksDisponiveis(comOverride())[0]
    expect(bm.editado).toBe(true)
    expect(bm.publico).toBe(450)
    expect(bm.custos.aeb).toBe(20000)
    expect(bm.custoTotal).toBe(NOVO_TOTAL)
  })

  it('salvar como padrão: override some, "editado" some com verdade, e os valores viram a BASE', () => {
    const s = salvarBenchmarkComoPadrao(comOverride(), 'bm-cordel')
    expect(s.benchmarkOverrides['bm-cordel']).toBeUndefined()
    expect(benchmarkTemPadraoSalvo(s, 'bm-cordel')).toBe(true)
    const bm = benchmarksDisponiveis(s)[0]
    expect(bm.editado).toBeFalsy()
    expect(bm.publico).toBe(450)
    expect(bm.custos.aeb).toBe(20000)
    expect(bm.custoTotal).toBe(NOVO_TOTAL)
    // âncora de FÁBRICA intacta no código
    expect(FIXED_BENCHMARKS[0].publico).toBe(400)
    expect(FIXED_BENCHMARKS[0].custos.aeb).toBe(16420)
  })

  it('depois de salvar, "Restaurar padrão" volta para a base SALVA (não a de fábrica)', () => {
    let s = salvarBenchmarkComoPadrao(comOverride(), 'bm-cordel')
    s = { ...s, benchmarkOverrides: { 'bm-cordel': { publico: 999 } } } // nova edição por cima
    expect(benchmarksDisponiveis(s)[0].publico).toBe(999)
    s = restaurarBenchmarkPadrao(s, 'bm-cordel')
    const bm = benchmarksDisponiveis(s)[0]
    expect(bm.publico).toBe(450) // base salva, não os 400 de fábrica
    expect(bm.editado).toBeFalsy()
  })

  it('"Restaurar valores de fábrica" descarta padrão salvo E edições — volta ao ORIGINAL', () => {
    let s = salvarBenchmarkComoPadrao(comOverride(), 'bm-cordel')
    s = { ...s, benchmarkOverrides: { 'bm-cordel': { publico: 999 } } }
    s = restaurarBenchmarkFabrica(s, 'bm-cordel')
    expect(benchmarkTemPadraoSalvo(s, 'bm-cordel')).toBe(false)
    expect(s.benchmarkOverrides['bm-cordel']).toBeUndefined()
    const bm = benchmarksDisponiveis(s)[0]
    expect(bm.publico).toBe(400)
    expect(bm.custos.aeb).toBe(16420)
    expect(bm.custoTotal).toBe(84650)
    expect(bm.editado).toBeFalsy()
  })

  it('benchmarkBase: sem padrão salvo é a fábrica (mesma referência); com padrão salvo é a base salva, nunca "editado"', () => {
    expect(benchmarkBase(FIXED_BENCHMARKS[0], {})).toBe(FIXED_BENCHMARKS[0])
    const s = salvarBenchmarkComoPadrao(comOverride(), 'bm-cordel')
    const base = benchmarkBase(FIXED_BENCHMARKS[0], s)
    expect(base.publico).toBe(450)
    expect(base.editado).toBeUndefined()
  })

  it('salvar-como-padrão de id que não é embutido é no-op', () => {
    const s0 = { benchmarksCustom: [], benchmarkOverrides: {}, benchmarksPadrao: {} }
    expect(salvarBenchmarkComoPadrao(s0, 'nao-existe')).toBe(s0)
  })
})

describe('round-trip e reload de apagados/padrão (schema é contrato — princípio 2)', () => {
  it('backup antigo SEM as chaves: apagados = null (não desapaga ao mesclar); padrão = {} (não mexe)', async () => {
    const { parseBackup, mesclarBackup } = await import('./storage.js')
    const antigo = parseBackup(JSON.stringify({ app: 'previsao-eventos', versao: 1, eventos: [] }))
    expect(antigo.benchmarksApagados).toBeNull()
    expect(antigo.benchmarksPadrao).toEqual({})
    const atual = {
      eventos: [],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksPadrao: { 'bm-cordel': { publico: 1 } },
      benchmarksOcultos: [],
      benchmarksApagados: ['bm-brisa-1205'],
    }
    const m = mesclarBackup(atual, antigo)
    expect(m.benchmarksApagados).toEqual(['bm-brisa-1205']) // preservado
    expect(m.benchmarksPadrao).toEqual({ 'bm-cordel': { publico: 1 } }) // preservado
  })

  it('backup COM as chaves: apagados substitui por inteiro; padrão mescla por id', async () => {
    const { parseBackup, mesclarBackup } = await import('./storage.js')
    const novo = parseBackup(
      JSON.stringify({
        app: 'previsao-eventos',
        versao: 1,
        eventos: [],
        benchmarksApagados: ['bm-cordel'],
        benchmarksPadrao: { 'bm-marfim-0905': { publico: 2 } },
      })
    )
    const atual = {
      eventos: [],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksPadrao: { 'bm-cordel': { publico: 1 } },
      benchmarksOcultos: [],
      benchmarksApagados: ['bm-brisa-1205'],
    }
    const m = mesclarBackup(atual, novo)
    expect(m.benchmarksApagados).toEqual(['bm-cordel'])
    expect(m.benchmarksPadrao).toEqual({
      'bm-cordel': { publico: 1 },
      'bm-marfim-0905': { publico: 2 },
    })
  })

  it('reload (saveStore → loadStore): apagados e padrão persistem — não voltam sozinhos', async () => {
    const { saveStore, loadStore } = await import('./storage.js')
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      setItem: (k, v) => mem.set(k, v),
      getItem: (k) => mem.get(k) ?? null,
    })
    const r = saveStore({
      eventos: [],
      benchmarksCustom: [],
      benchmarkOverrides: {},
      benchmarksPadrao: { 'bm-cordel': { publico: 450 } },
      benchmarksOcultos: [],
      benchmarksApagados: ['bm-brisa-1205'],
      ajustes: null,
    })
    expect(r).toEqual({ ok: true })
    const carregado = loadStore()
    expect(carregado.benchmarksApagados).toEqual(['bm-brisa-1205'])
    expect(carregado.benchmarksPadrao).toEqual({ 'bm-cordel': { publico: 450 } })
    // o embutido apagado continua fora da lista após o reload
    expect(benchmarksDisponiveis(carregado).map((b) => b.id)).not.toContain('bm-brisa-1205')
    vi.unstubAllGlobals()
  })
})

describe('consolidarCustosDePlanilha — a foto importada não pode esconder dinheiro (Marco, 27/07/2026)', () => {
  // O defeito que estes testes fecham, medido em 27/07/2026: a régua antiga
  // (`soma > 0 ? soma : null`, dentro do ImportModal) apagava a categoria de
  // saldo NEGATIVO da lista e deixava o dinheiro dela dentro do custoTotal. A
  // foto passava a afirmar um custo que as próprias categorias não explicam.
  // A régua nova é a MESMA do fechamento.js (aprovada pelo Marco em 26/07/2026).
  const somaVisivel = (custos) =>
    CAT_KEYS.reduce((s, k) => s + (typeof custos[k] === 'number' ? custos[k] : 0), 0)

  it('categoria NEGATIVA continua na foto, com o sinal — e o total fecha com o que se vê', () => {
    const { custos, custoTotal } = consolidarCustosDePlanilha({ aeb: 10000, marketing: -3000 })
    expect(custos.marketing).toBe(-3000)
    expect(custoTotal).toBe(7000)
    // a asserção que importa: o total não pode divergir da soma do que aparece
    expect(somaVisivel(custos)).toBe(custoTotal)
  })

  it('a régua ANTIGA teria escondido R$ 3.000 — este é o número que o teste protege', () => {
    const somas = { aeb: 10000, marketing: -3000 }
    const antiga = {}
    let totalAntigo = 0
    for (const k of CAT_KEYS) {
      const s = somas[k] || 0
      antiga[k] = s > 0 ? s : null
      totalAntigo += s
    }
    expect(somaVisivel(antiga) - totalAntigo).toBe(3000) // o buraco de antes
    const { custos, custoTotal } = consolidarCustosDePlanilha(somas)
    expect(somaVisivel(custos) - custoTotal).toBe(0) // fechado agora
  })

  it('categoria ZERADA some da foto (é ruído, não informação) sem tirar nada do total', () => {
    const { custos, custoTotal } = consolidarCustosDePlanilha({ aeb: 5000, extras: 0 })
    expect(custos.extras).toBeNull()
    expect(custoTotal).toBe(5000)
    expect(somaVisivel(custos)).toBe(custoTotal)
  })

  it('zero ATÉ O CENTAVO some, nos dois sinais', () => {
    // a mesma pergunta do fechamento.js: "sobra algum centavo?", não "é > 0?"
    expect(consolidarCustosDePlanilha({ extras: 0.004 }).custos.extras).toBeNull()
    expect(consolidarCustosDePlanilha({ extras: -0.004 }).custos.extras).toBeNull()
  })

  it('meio centavo EXATO: fica no positivo, some no negativo — assimetria herdada, documentada', () => {
    // Achado ao escrever este teste (27/07/2026). O JavaScript arredonda o meio
    // SEMPRE para +Infinito: Math.round(0.5) é 1, mas Math.round(-0.5) é -0, e
    // -0 === 0. Então uma categoria de exatamente -R$ 0,005 some da foto
    // enquanto +R$ 0,005 fica.
    //
    // NÃO se conserta aqui, de propósito. Esta é a régua que o Marco aprovou em
    // 26/07/2026 para o fechamento (fechamento.js:256), e a decisão dele de
    // 27/07 foi "usar a mesma régua" — mudá-la de um lado só recriaria as duas
    // réguas que este trabalho existe para acabar. O teste existe para a
    // assimetria ser CONHECIDA em vez de descoberta por alguém no meio de um
    // fechamento; registrada no BACKLOG como S4.
    //
    // Nenhum dinheiro se esconde nos dois casos: o custoTotal guarda o valor,
    // some ou não some a linha — o que muda é só a categoria aparecer.
    expect(consolidarCustosDePlanilha({ extras: 0.005 }).custos.extras).toBe(0.005)
    expect(consolidarCustosDePlanilha({ extras: -0.005 }).custos.extras).toBeNull()
    expect(consolidarCustosDePlanilha({ extras: -0.005 }).custoTotal).toBe(-0.005)
    // uma frouxa a mais de meio centavo e o negativo já fica
    expect(consolidarCustosDePlanilha({ extras: -0.006 }).custos.extras).toBe(-0.006)
  })

  it('não arredonda o valor de quem tem dinheiro de verdade', () => {
    const { custos } = consolidarCustosDePlanilha({ aeb: 1234.567 })
    expect(custos.aeb).toBe(1234.567)
  })

  it('categoria ausente na planilha vira null, e as sete chaves sempre existem', () => {
    const { custos, custoTotal } = consolidarCustosDePlanilha({ aeb: 100 })
    expect(Object.keys(custos).sort()).toEqual([...CAT_KEYS].sort())
    for (const k of CAT_KEYS) if (k !== 'aeb') expect(custos[k]).toBeNull()
    expect(custoTotal).toBe(100)
  })

  it('entrada vazia ou nula não quebra e não inventa número', () => {
    for (const entrada of [undefined, null, {}]) {
      const { custos, custoTotal } = consolidarCustosDePlanilha(entrada)
      expect(custoTotal).toBe(0)
      for (const k of CAT_KEYS) expect(custos[k]).toBeNull()
    }
  })

  it('todas negativas: o total é negativo e nenhuma categoria desaparece', () => {
    const { custos, custoTotal } = consolidarCustosDePlanilha({ aeb: -100, extras: -50 })
    expect(custos.aeb).toBe(-100)
    expect(custos.extras).toBe(-50)
    expect(custoTotal).toBe(-150)
    expect(somaVisivel(custos)).toBe(custoTotal)
  })
})

describe('lucroNaoFecha — o editor para de fingir que os três números concordam (Marco, 27/07/2026)', () => {
  const bm = (x) => ({ nome: 'x', custos: {}, custoTotal: 100, receita: 150, lucro: 50, ...x })

  it('fecha: não avisa', () => {
    expect(lucroNaoFecha(bm())).toBeNull()
  })

  it('o caso REAL da Marfim 09/05: as categorias dizem lucro, o campo diz prejuízo', () => {
    const r = lucroNaoFecha(bm({ receita: 336150, custoTotal: 333420, lucro: -6480 }))
    expect(r.esperado).toBe(2730)
    expect(r.diferenca).toBe(-9210)
  })

  it('resíduo abaixo de meio centavo não avisa; um centavo avisa', () => {
    // A fronteira EXATA de meio centavo é fuzzy em ponto flutuante
    // (50,005 − 50 dá 0,005000000000002558), e não vale asserção: o que
    // importa é que resíduo de arredondamento cale e diferença de dinheiro
    // de verdade fale. É a mesma tolerância das outras conferências da casa.
    expect(lucroNaoFecha(bm({ lucro: 50.004 }))).toBeNull()
    expect(lucroNaoFecha(bm({ lucro: 50.01 }))).not.toBeNull()
  })

  it('sem receita ou sem lucro não há o que conferir — e não se inventa aviso', () => {
    expect(lucroNaoFecha(bm({ receita: null }))).toBeNull()
    expect(lucroNaoFecha(bm({ lucro: null }))).toBeNull()
    expect(lucroNaoFecha(null)).toBeNull()
  })

  it('lucro NEGATIVO que fecha continua sem aviso — prejuízo não é erro', () => {
    expect(lucroNaoFecha(bm({ receita: 80, custoTotal: 100, lucro: -20 }))).toBeNull()
  })
})
