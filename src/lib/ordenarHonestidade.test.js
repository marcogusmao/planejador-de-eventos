// Os achados da VERIFICAÇÃO ADVERSARIAL da reordenação — rodada 2 (20/07/2026).
//
// `ordenarInvariancia.test.js` (ao lado) prova o que a feature NÃO faz: nenhuma
// conta lê a posição da linha. Este arquivo é o contrário — é o registro do que
// ela FAZ de errado quando ninguém olha, cada caso reproduzido com os módulos
// reais ANTES de existir conserto:
//
//   [A] a Versão de reunião anunciava "+ R$ 0" EM VERDE (zero exato × limiar)
//   [B] a aba Análise jogava fora os avisos do plano (o silêncio do caixa mínimo)
//   [E] `moverPorId` mexia na linha errada com id ausente ou duplicado
//   [F] o clique impossível comia um passo de desfazer vazio
//   [G] o foco caía no `body` ao chegar na ponta
//
// [H] era o achado que NÃO se consertava aqui — a raiz morava em calc.js,
//     portão do Marco. CONSERTADO em 25/07/2026: o Marco aprovou quantizar a
//     centavos antes de somar (ver a descrição do describe [H] abaixo).

import { describe, it, expect } from 'vitest'
import { computeCenarios, custosPorCategoria } from './calc.js'
import { curvaPlanoDatas } from './curvaVendas.js'
import { moverItem, moverPorId, planejarMovimento, moverEmLista } from './ordenar.js'
import { reduzirComHistorico, estadoInicial, textoDesfazer, podeDesfazer } from './historico.js'
import { fmtDelta, classeDelta } from '../components/VersaoReuniao.jsx'
import { mensagensDoPlano } from '../components/AnaliseTab.jsx'
import { focoDepoisDeMover } from '../components/ui.jsx'

// ————————————————————————————————————————————————————————————————
// [A] "+ R$ 0" em VERDE numa reunião
// ————————————————————————————————————————————————————————————————
//
// Os lotes do repro do revisor. UM clique na seta para baixo do "Lote 3"
// (trocar Lote 3 com Lote 4) mudava o lucro do otimista em 1,455 × 10⁻¹¹ — não
// era mudança nenhuma, era o resíduo de somar os mesmos números noutra ordem.
// Com `v === 0` isso deixava de ser travessão cinza e virava "+ R$ 0" verde,
// ao lado de quatro linhas que corretamente mostravam travessão.
//
// Remedido em 25/07/2026 (achado do BACKLOG "a soma de ponto flutuante não é
// associativa" — conta aprovada pelo Marco): com a receita quantizada a
// centavos ANTES de somar, este resíduo específico SOME — o delta agora é
// zero EXATO, não mais um quase-zero. O teste abaixo passou a travar essa
// melhoria (delta === 0); a defesa da tela para um resíduo que ainda
// sobreviva em algum outro caminho (ex.: multiplicação, fora do escopo desta
// mudança) continua coberta pelo segundo teste, com um valor sintético.
const eventoDoRepro = () => ({
  id: 'ev-repro-a',
  nome: 'Repro do achado A',
  data: '2026-09-12',
  publicoEstimado: 811,
  taxaBilheteria: 10,
  cashbackPct: 5,
  contingenciaPct: 10,
  categorias: [],
  outrasReceitas: { bar: 0, patrocinio: 0 },
  lotes: [
    { id: 'l1', nome: 'Lote 1', valor: 87.33, quantidade: 213 },
    { id: 'l2', nome: 'Lote 2', valor: 113.77, quantidade: 331 },
    { id: 'l3', nome: 'Lote 3', valor: 129.99, quantidade: 177 },
    { id: 'l4', nome: 'Lote 4', valor: 150, quantidade: 90 },
  ],
})

describe('[A] o delta da Versão de reunião usa o limiar da casa, não zero exato', () => {
  it('UM clique de seta agora dá delta ZERO EXATO (era resíduo de ~1e-11) — e a tela continua dizendo "nada mudou"', () => {
    const antes = computeCenarios(eventoDoRepro())
    const lotes = moverPorId(eventoDoRepro().lotes, 'l3', 'baixo')
    const depois = computeCenarios({ ...eventoDoRepro(), lotes })

    const delta = depois.otimista.lucro - antes.otimista.lucro
    // a melhoria do achado H: aqui o resíduo já era só de ponto flutuante da
    // acumulação de receita — quantizada a centavos, ele desaparece de vez
    expect(delta).toBe(0)

    // ...e a tela continua dizendo "nada mudou" (agora por zero exato, não
    // só por estar abaixo do limiar)
    expect(fmtDelta(delta)).toBe('—')
    expect(classeDelta('Lucro (otimista)', delta)).toBe('text-[var(--tinta-3)]')
  })

  it('acima de meio centavo o sinal e a cor continuam os de sempre', () => {
    // resultado: positivo é bom (verde), negativo é ruim (vermelho)
    // (o Intl usa espaço fino não-quebrável depois do "R$" — normalizamos)
    const semNbsp = (t) => t.replace(/\u00a0|\u202f/g, ' ')
    expect(semNbsp(fmtDelta(1200))).toBe('+ R$ 1.200')
    expect(classeDelta('Lucro (realista)', 1200)).toBe('text-[var(--verde-texto)]')
    expect(classeDelta('Lucro (realista)', -1200)).toBe('text-[var(--vermelho-texto)]')
    // custo: a régua é INVERTIDA — gastar mais é vermelho
    expect(classeDelta('Custo total', 1200)).toBe('text-[var(--vermelho-texto)]')
    expect(classeDelta('Custo total', -1200)).toBe('text-[var(--verde-texto)]')
    // e o limiar é o mesmo dos dois lados
    expect(classeDelta('Custo total', 0.004)).toBe('text-[var(--tinta-3)]')
    expect(fmtDelta(0.004)).toBe('—')
    expect(fmtDelta(null)).toBe('—')
  })
})

// ————————————————————————————————————————————————————————————————
// [B] reordenar lotes muda o "Caixa mínimo para iniciar" e a tela não avisa
// ————————————————————————————————————————————————————————————————
//
// `curvaPlanoDatas` percorre os lotes NA ORDEM DO ARRAY e encosta na virada
// anterior toda virada que "vem antes" — e GERA o aviso dizendo isso. A aba
// Análise consumia só `plano.pontos` e descartava `plano.avisos`.
const eventoDaCurva = () => ({
  id: 'ev-repro-b',
  nome: 'Repro do achado B',
  data: '2026-09-12',
  publicoEstimado: 270,
  taxaBilheteria: 10,
  categorias: [],
  outrasReceitas: { bar: 0, patrocinio: 0 },
  curvaModo: 'datas',
  lotes: [
    { id: 'L1', nome: 'Lote 1', valor: 300, quantidade: 60, viradaPrevista: '2026-08-03' },
    { id: 'L2', nome: 'Lote 2', valor: 300, quantidade: 90, viradaPrevista: '2026-08-23' },
    { id: 'L3', nome: 'Lote 3', valor: 300, quantidade: 120, viradaPrevista: '2026-09-02' },
  ],
})

describe('[B] a aba Análise mostra os avisos do plano', () => {
  it('dois cliques na seta do Lote 3 geram avisos — e eles chegam à tela', () => {
    const ev = eventoDaCurva()
    const planoAntes = curvaPlanoDatas(ev, { inicioDia: null })
    expect(planoAntes.avisos).toEqual([]) // ordem original: nada a avisar

    // dois cliques na seta para CIMA do "Lote 3": L3, L1, L2
    let lotes = moverPorId(ev.lotes, 'L3', 'cima')
    lotes = moverPorId(lotes, 'L3', 'cima')
    expect(lotes.map((l) => l.id)).toEqual(['L3', 'L1', 'L2'])

    const evDepois = { ...ev, lotes }
    const planoDepois = curvaPlanoDatas(evDepois, { inicioDia: null })

    // o plano MUDOU e o motivo está escrito nos avisos
    expect(planoDepois.avisos.length).toBe(2)
    expect(planoDepois.avisos.join(' ')).toContain('vem ANTES da virada do lote anterior')
    expect(planoDepois.pontos).not.toEqual(planoAntes.pontos)

    // ————— o achado: a aba Análise tem de FALAR isso —————
    const msgs = mensagensDoPlano({
      evento: evDepois,
      modo: 'datas',
      plano: planoDepois,
      planoOk: true,
      totalPlano: 81000,
      cache: null,
    })
    for (const aviso of planoDepois.avisos) expect(msgs).toContain(aviso)
  })

  it('os avisos de pré-requisito que já existiam continuam iguais', () => {
    const semData = mensagensDoPlano({
      evento: { data: '' },
      modo: 'datas',
      plano: null,
      planoOk: false,
      totalPlano: 0,
      cache: null,
    })
    expect(semData[0]).toContain('Defina a data do evento')
    expect(semData[1]).toContain('Preencha os lotes')
  })

  it('não repete um aviso que já esteja na lista', () => {
    const plano = { avisos: ['aviso repetido', 'aviso repetido'], pontos: [] }
    const msgs = mensagensDoPlano({
      evento: { data: '2026-09-12' },
      modo: 'datas',
      plano,
      planoOk: true,
      totalPlano: 10,
      cache: null,
    })
    expect(msgs.filter((m) => m === 'aviso repetido')).toHaveLength(1)
  })
})

// ————————————————————————————————————————————————————————————————
// [E] id ausente ou duplicado: mexer na linha errada, em silêncio
// ————————————————————————————————————————————————————————————————
//
// `migracao.js` NÃO gera id para lotes nem para itens de custo — um backup
// antigo, ou editado à mão, chega aqui com `id === undefined` em vários lotes.
describe('[E] id ausente ou duplicado nunca move a linha errada calado', () => {
  const semId = () => [
    { nome: 'Lote A' },
    { nome: 'Lote B' },
    { nome: 'Lote C' },
    { nome: 'Lote D' },
  ]

  it('lista inteira sem id: sem saber qual linha, NÃO move — e diz por quê', () => {
    const lista = semId()
    const r = planejarMovimento(lista, undefined, 'cima', null)
    expect(r.mudou).toBe(false)
    expect(r.lista).toBe(lista) // mesma referência: nada foi tocado
    expect(r.aviso).toMatch(/sem identificador próprio/)
    expect(r.aviso).toMatch(/Nada foi movido/)
  })

  it('lista inteira sem id, mas sabendo a POSIÇÃO clicada: move a certa e avisa', () => {
    const lista = semId()
    // o Marco clicou a seta para cima da 4ª linha ("Lote D")
    const r = planejarMovimento(lista, undefined, 'cima', 3)
    expect(r.mudou).toBe(true)
    expect(r.lista.map((x) => x.nome)).toEqual(['Lote A', 'Lote B', 'Lote D', 'Lote C'])
    // e NÃO a primeira, que é o que o findIndex antigo fazia:
    expect(r.lista.map((x) => x.nome)).not.toEqual(['Lote A', 'Lote B', 'Lote C', 'Lote D'])
    expect(r.aviso).toMatch(/sem identificador próprio/)
    expect(r.aviso).toMatch(/Movi a linha que você clicou/)
  })

  it('id duplicado: o clique não some em silêncio — ou desempata, ou avisa', () => {
    const lista = [
      { id: 'x', nome: 'primeira' },
      { id: 'y', nome: 'meio' },
      { id: 'x', nome: 'segunda' },
    ]
    // com a posição: mexe na que foi clicada (a de baixo)
    const comPos = planejarMovimento(lista, 'x', 'cima', 2)
    expect(comPos.mudou).toBe(true)
    expect(comPos.lista.map((x) => x.nome)).toEqual(['primeira', 'segunda', 'meio'])
    expect(comPos.aviso).toBeTruthy()

    // sem a posição (ou com uma posição que não bate): nada se move, e fala
    const semPos = planejarMovimento(lista, 'x', 'cima', 1)
    expect(semPos.mudou).toBe(false)
    expect(semPos.lista).toBe(lista)
    expect(semPos.aviso).toMatch(/não deu para saber qual delas/)
  })

  it('id que não existe na lista: no-op com explicação, nunca "mexe no primeiro"', () => {
    const lista = [{ id: 'a' }, { id: 'b' }]
    const r = planejarMovimento(lista, 'fantasma', 'baixo', 0)
    expect(r.mudou).toBe(false)
    expect(r.lista).toBe(lista)
    expect(r.aviso).toMatch(/Não consegui achar esta linha/)
  })

  it('o caso normal (id único) segue imune ao índice velho do render', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    // indiceEsperado MENTINDO (o render estava velho): o id manda
    const r = planejarMovimento(lista, 'c', 'cima', 0)
    expect(r.mudou).toBe(true)
    expect(r.aviso).toBe(null)
    expect(r.lista.map((x) => x.id)).toEqual(['a', 'c', 'b'])
  })
})

// ————————————————————————————————————————————————————————————————
// [F] o clique impossível comendo um passo de desfazer VAZIO
// ————————————————————————————————————————————————————————————————
describe('[F] clique que não move nada não vira passo de desfazer', () => {
  const evento = () => ({
    id: 'ev',
    lotes: [
      { id: 'l1', nome: 'Lote 1' },
      { id: 'l2', nome: 'Lote 2' },
    ],
  })

  it('moverEmLista devolve o MESMO objeto quando o movimento é impossível', () => {
    const e = evento()
    const r = moverEmLista(e, 'lotes', 'l1', 'cima', 0) // já é o primeiro
    expect(r.mudou).toBe(false)
    expect(r.obj).toBe(e) // identidade: é isto que o reducer olha
  })

  it('o reducer real não empilha nada com o clique impossível', () => {
    // Este é o updater EXATO que RevenueTab manda para o update do App.
    const mover = (id, direcao, indice) => (e) =>
      moverEmLista(e, 'lotes', id, direcao, indice).obj

    let st2 = estadoInicial(evento())
    const alterar2 = (fn, rotulo) =>
      (st2 = reduzirComHistorico(st2, { tipo: 'alterar', fn, descritor: { rotulo }, em: 0 }))

    alterar2(mover('l1', 'cima', 0), 'mover “Lote 1” para cima')
    expect(podeDesfazer(st2.hist)).toBe(false)
    expect(textoDesfazer(st2.hist)).toBe('Nada para desfazer')

    alterar2(mover('l2', 'baixo', 1), 'mover “Lote 2” para baixo') // já é o último
    expect(podeDesfazer(st2.hist)).toBe(false)

    // e o movimento POSSÍVEL continua virando um passo, com rótulo certo
    alterar2(mover('l2', 'cima', 1), 'mover “Lote 2” para cima')
    expect(podeDesfazer(st2.hist)).toBe(true)
    expect(textoDesfazer(st2.hist)).toBe('Desfazer: mover “Lote 2” para cima')
    expect(st2.store.lotes.map((l) => l.id)).toEqual(['l2', 'l1'])

    // desfazer volta a ordem de verdade
    st2 = reduzirComHistorico(st2, { tipo: 'desfazer' })
    expect(st2.store.lotes.map((l) => l.id)).toEqual(['l1', 'l2'])
  })

  it('o mesmo vale para itens de custo (o patch nulo do setCat)', () => {
    const cat = { id: 'c1', itens: [{ id: 'i1' }, { id: 'i2' }] }
    const r = moverEmLista(cat, 'itens', 'i2', 'baixo', 1) // já é o último
    expect(r.mudou).toBe(false)
    expect(r.obj).toBe(cat)
  })
})

// ————————————————————————————————————————————————————————————————
// [G] o foco na ponta
// ————————————————————————————————————————————————————————————————
describe('[G] chegar na ponta não larga o foco no body', () => {
  it('o foco atravessa para o botão irmão quando o clicado desabilita', () => {
    // subiu até virar o primeiro: a seta de cima desabilita → foco vai à de baixo
    expect(focoDepoisDeMover(0, 5, 'cima')).toBe('baixo')
    // desceu até virar o último: a de baixo desabilita → foco vai à de cima
    expect(focoDepoisDeMover(4, 5, 'baixo')).toBe('cima')
  })

  it('no meio da lista o foco fica onde estava — a sequência de cliques não quebra', () => {
    expect(focoDepoisDeMover(2, 5, 'cima')).toBe('cima')
    expect(focoDepoisDeMover(2, 5, 'baixo')).toBe('baixo')
    expect(focoDepoisDeMover(1, 5, 'cima')).toBe('cima')
    expect(focoDepoisDeMover(3, 5, 'baixo')).toBe('baixo')
  })

  it('lista de UMA linha: os dois botões nascem desabilitados e a regra não escolhe o morto', () => {
    // com total 1 o índice 0 é primeiro E último; a regra devolve o irmão nos
    // dois casos, e o efeito só foca se o alvo estiver clicável (nunca está).
    expect(focoDepoisDeMover(0, 1, 'cima')).toBe('baixo')
    expect(focoDepoisDeMover(0, 1, 'baixo')).toBe('cima')
  })
})

// ————————————————————————————————————————————————————————————————
// [H] CONSERTADO em 25/07/2026 — quantização a centavos, aprovada pelo Marco
// ————————————————————————————————————————————————————————————————
//
// Este teste CRAVOU a evidência (a mesma seta que "não mexe em número
// nenhum" mudava o dígito exibido) até 25/07/2026, quando o Marco decidiu
// (com a tabela de valores antigos × novos na mesa — ver APROVADO-PELO-MARCO
// no commit) quantizar a centavos ANTES de somar a receita bruta em
// bilheteria(). A soma de inteiros é associativa: agora este é o teste que
// TRAVA a rede — reordenar os MESMOS lotes não muda mais o total exibido.
describe('[H] a soma quantizada a centavos NÃO muda mais com a ordem dos lotes', () => {
  const fmtBRL0 = (v) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v)

  it('UM clique de seta no mesmo empate de antes já NÃO muda mais "Receita bruta bilheteria" (era R$ 169.963 → R$ 169.964)', () => {
    const base = {
      id: 'ev-h',
      nome: 'Evento do empate de arredondamento',
      data: '2026-09-12',
      publicoEstimado: 1059,
      taxaBilheteria: 10,
      cashbackPct: 5,
      contingenciaPct: 10,
      categorias: [],
      outrasReceitas: { bar: 0, patrocinio: 0 },
      // O empate de arredondamento deste teste foi MEDIDO com o realista
      // vendendo o lote inteiro. Isso vinha do fallback antigo do calc (100);
      // desde 27/07/2026 o padrão é 90 (decisão B do Marco), e com 90 as
      // quantidades mudam e o empate simplesmente deixa de existir — o teste
      // pararia de testar o que se propôs. O 100 passa a ser dito aqui.
      cenariosConfig: { realista: { vendaPct: 100 } },
      lotes: [
        { id: 'l1', nome: 'Lote 1', valor: 142.51, quantidade: 431 },
        { id: 'l2', nome: 'Lote 2', valor: 151.43, quantidade: 59 },
        { id: 'l3', nome: 'Lote 3', valor: 179.28, quantidade: 391 },
        { id: 'l4', nome: 'Lote 4', valor: 165.78, quantidade: 178 },
      ],
    }
    const antes = computeCenarios(base).realista.bruta
    // UM clique: a seta para cima do "Lote 4" (transposição de vizinhos)
    const lotes = moverItem(base.lotes, 3, 2)
    expect(lotes.map((l) => l.id)).toEqual(['l1', 'l2', 'l4', 'l3'])
    const depois = computeCenarios({ ...base, lotes }).realista.bruta

    // igualdade EXATA — soma de centavos inteiros é associativa
    expect(depois).toBe(antes)
    expect(antes).toBe(169963.5)
    expect(depois).toBe(169963.5)

    // ...e o número EXIBIDO tampouco muda: o mesmo empate de arredondamento
    // que antes caía para lados opostos agora cai sempre para o mesmo lado.
    const semNbsp = (t) => t.replace(/\u00a0|\u202f/g, ' ')
    expect(semNbsp(fmtBRL0(antes))).toBe('R$ 169.964')
    expect(semNbsp(fmtBRL0(depois))).toBe('R$ 169.964')
    expect(fmtBRL0(antes)).toBe(fmtBRL0(depois))
  })

  it('reordenar itens de custo também não muda mais o total (mesmo mecanismo, custosPorCategoria)', () => {
    // Fixture com o mesmo tipo de empate na soma de custos: 4 itens cujo
    // total, somado na ordem original, caía do lado errado do
    // arredondamento do centavo. somaCentavos() quantiza cada item ANTES de
    // somar — reordenar os itens (setas ↑/↓ do CostsTab) não muda mais nada.
    const categorias = (itens) => [{ id: 'cat', nome: 'Categoria', itens }]
    const itens = [
      { estimado: 142.505 },
      { estimado: 151.435 },
      { estimado: 179.285 },
      { estimado: 165.775 },
    ]
    const antes = custosPorCategoria(categorias(itens)).totalEstimado
    const invertido = custosPorCategoria(categorias([...itens].reverse())).totalEstimado
    const embaralhado = custosPorCategoria(
      categorias([itens[2], itens[0], itens[3], itens[1]])
    ).totalEstimado

    expect(invertido).toBe(antes)
    expect(embaralhado).toBe(antes)
  })
})
