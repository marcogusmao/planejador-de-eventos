// Testes de "carregar de benchmark" (Sessão F2-U — sugestão 33). Cobre: uma
// proposta por categoria com valor, escopo por categoria, flag de categoria
// já preenchida, somar × substituir, forma do item (status ESTIMADO, origem),
// função PURA (nem o evento nem o benchmark são mutados), categoria recriada.
//
// Este cabeçalho e o nome do caso da forma do item diziam "status ORÇAR" até
// 27/07/2026, enquanto a asserção logo abaixo já exigia 'ESTIMADO'. ORÇAR foi
// aposentado em 21/07/2026, quando statusCusto.js virou a lista única (a
// migração faz ORÇAR→ESTIMADO). Nada de comportamento mudou nesta correção; o
// que entrou junto foi o ÚLTIMO bloco deste arquivo, que confere por máquina a
// FRASE do módulo que promete o status do item criado — só ela, não a prosa do
// arquivo inteiro (a diferença está explicada lá embaixo, e é o motivo de a
// primeira versão da guarda ter passado verde com o defeito de volta).
//
// Desde 27/07/2026 cobre também o DESFAZER cirúrgico (achado S3 do BACKLOG):
// o que o Marco digitar nos 6 segundos de vida do toast — custo em qualquer
// categoria, lote, patrocínio — tem de sobreviver ao clique em "Desfazer".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  propostasCarregar,
  aplicarCarregar,
  desfazerCarregar,
  prepararDesfazerCarregamento,
  rotuloCarregar,
} from './carregarBenchmark.js'
import { novoEvento, novoItem } from './defaults.js'
import { STATUS_CUSTO_PADRAO } from './statusCusto.js'

const bm = () => ({
  id: 'bm-marfim-0905',
  nome: 'Marfim 09/05',
  custos: { aeb: 58420, locacao: 43150, estrutura: 108760, equipe: 71280, artistico: 21940, marketing: null, extras: 29870 },
})

describe('propostasCarregar', () => {
  it('uma proposta por categoria COM valor (marketing null fica de fora)', () => {
    const props = propostasCarregar(novoEvento(), bm())
    expect(props.map((p) => p.catId)).toEqual(['aeb', 'locacao', 'estrutura', 'equipe', 'artistico', 'extras'])
    expect(props.find((p) => p.catId === 'aeb').valor).toBe(58420)
    expect(props.every((p) => p.existe && !p.jaTemItens)).toBe(true)
  })

  it('escopo por categoria: só a categoria pedida', () => {
    const props = propostasCarregar(novoEvento(), bm(), 'aeb')
    expect(props).toHaveLength(1)
    expect(props[0]).toMatchObject({ catId: 'aeb', valor: 58420, catNome: 'A&B' })
  })

  it('marca categoria que já tem itens (para a UI pedir somar/substituir)', () => {
    const ev = novoEvento()
    ev.categorias.find((c) => c.id === 'aeb').itens.push({ id: 'x', servico: 'Gelo', estimado: 100 })
    const aeb = propostasCarregar(ev, bm(), 'aeb')[0]
    expect(aeb.jaTemItens).toBe(true)
    expect(aeb.qtdItens).toBe(1)
  })

  it('categoria padrão removida do evento entra como proposta (existe:false)', () => {
    const ev = novoEvento()
    ev.categorias = ev.categorias.filter((c) => c.id !== 'extras')
    const extras = propostasCarregar(ev, bm()).find((p) => p.catId === 'extras')
    expect(extras).toMatchObject({ catId: 'extras', existe: false, jaTemItens: false, catNome: 'Extras & Contingência' })
  })
})

describe('aplicarCarregar', () => {
  it('cria UM item por categoria escolhida: total como estimado, status ESTIMADO, origem na obs, id próprio', () => {
    const ev = novoEvento()
    const escolhas = [{ catId: 'aeb', modo: 'somar' }]
    const novo = aplicarCarregar(ev, bm(), escolhas)
    const itens = novo.categorias.find((c) => c.id === 'aeb').itens
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({ servico: 'Marfim 09/05', estimado: 58420, status: 'ESTIMADO' })
    expect(itens[0].obs).toContain('Referência: Marfim 09/05')
    expect(itens[0].id).toBeTruthy()
  })

  it('somar anexa; substituir troca os itens da categoria pelo do benchmark', () => {
    const ev = novoEvento()
    ev.categorias.find((c) => c.id === 'aeb').itens.push({ id: 'x', servico: 'Gelo', estimado: 100, status: 'ORÇAR' })
    const somado = aplicarCarregar(ev, bm(), [{ catId: 'aeb', modo: 'somar' }])
    expect(somado.categorias.find((c) => c.id === 'aeb').itens.map((i) => i.servico)).toEqual(['Gelo', 'Marfim 09/05'])
    const subst = aplicarCarregar(ev, bm(), [{ catId: 'aeb', modo: 'substituir' }])
    expect(subst.categorias.find((c) => c.id === 'aeb').itens.map((i) => i.servico)).toEqual(['Marfim 09/05'])
  })

  it('PURA: nem o evento nem o benchmark são mutados', () => {
    const ev = novoEvento()
    const evAntes = JSON.stringify(ev)
    const b = bm()
    const bAntes = JSON.stringify(b)
    aplicarCarregar(ev, b, [{ catId: 'aeb', modo: 'somar' }, { catId: 'extras', modo: 'somar' }])
    expect(JSON.stringify(ev)).toBe(evAntes)
    expect(JSON.stringify(b)).toBe(bAntes) // embutido imutável: só se lê
  })

  it('categoria padrão removida é recriada com o item', () => {
    const ev = novoEvento()
    ev.categorias = ev.categorias.filter((c) => c.id !== 'extras')
    const novo = aplicarCarregar(ev, bm(), [{ catId: 'extras', modo: 'somar' }])
    const extras = novo.categorias.find((c) => c.id === 'extras')
    expect(extras).toBeTruthy()
    expect(extras.itens[0]).toMatchObject({ servico: 'Marfim 09/05', estimado: 29870 })
    expect(extras.padrao).toBe(true)
  })

  it('categoria sem valor no benchmark é ignorada (marketing null)', () => {
    const ev = novoEvento()
    const novo = aplicarCarregar(ev, bm(), [{ catId: 'marketing', modo: 'somar' }])
    expect(novo.categorias.find((c) => c.id === 'marketing').itens).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// desfazerCarregar — o "Desfazer" do toast não pode levar junto o que o Marco
// digitou nos 6 segundos em que o toast fica na tela (achado S3 do BACKLOG,
// 27/07/2026). Cada teste abaixo AFIRMA uma coisa que ele NÃO pode perder.
// ─────────────────────────────────────────────────────────────────────────────
describe('desfazerCarregar — tira o que a ação criou e NADA mais', () => {
  // Aplica de verdade (com itemId fixo, como a tela faz) e devolve os dois
  // estados + as escolhas, que é o que o desfazer recebe.
  const carregar = (ev, escolhas) => {
    const antes = JSON.parse(JSON.stringify(ev))
    return { antes, depois: aplicarCarregar(ev, bm(), escolhas), escolhas }
  }
  const itensDe = (ev, catId) => ev.categorias.find((c) => c.id === catId).itens

  it('categoria vazia: some a linha carregada e a categoria volta a ficar vazia', () => {
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(novoEvento(), escolhas)
    expect(itensDe(depois, 'aeb')).toHaveLength(1)
    expect(itensDe(desfazerCarregar(depois, antes, escolhas), 'aeb')).toHaveLength(0)
  })

  it('custo digitado DEPOIS, na MESMA categoria que a ação tocou, sobrevive ao Desfazer', () => {
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(novoEvento(), escolhas)
    // o Marco digita um custo dentro dos 6 segundos do toast
    const digitando = {
      ...depois,
      categorias: depois.categorias.map((c) =>
        c.id === 'aeb' ? { ...c, itens: [...c.itens, novoItem({ servico: 'Gelo', estimado: 800 })] } : c
      ),
    }
    const desfeito = desfazerCarregar(digitando, antes, escolhas)
    expect(itensDe(desfeito, 'aeb').map((i) => i.servico)).toEqual(['Gelo'])
    expect(itensDe(desfeito, 'aeb')[0].estimado).toBe(800)
  })

  it('lote e patrocínio digitados na janela do toast NÃO voltam atrás (o desfazer só mexe em categorias)', () => {
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(novoEvento(), escolhas)
    const digitando = {
      ...depois,
      lotes: [{ id: 'l1', nome: 'Lote 1', preco: 120, quantidade: 300 }],
      patrocinios: [{ id: 'p1', patrocinador: 'Cerveja X', valor: 15000, estagio: 'proposta' }],
      vendidosAteHoje: 42,
    }
    const desfeito = desfazerCarregar(digitando, antes, escolhas)
    expect(desfeito.lotes).toEqual(digitando.lotes)
    expect(desfeito.patrocinios).toEqual(digitando.patrocinios)
    expect(desfeito.vendidosAteHoje).toBe(42)
  })

  it('modo substituir: os itens trocados voltam, e o que veio depois continua lá', () => {
    const ev = novoEvento()
    ev.categorias.find((c) => c.id === 'aeb').itens = [
      novoItem({ servico: 'Gelo', estimado: 800 }),
      novoItem({ servico: 'Copos', estimado: 400 }),
    ]
    const escolhas = [{ catId: 'aeb', modo: 'substituir', itemId: 'it-1' }]
    const { antes, depois } = carregar(ev, escolhas)
    expect(itensDe(depois, 'aeb').map((i) => i.servico)).toEqual(['Marfim 09/05'])
    const digitando = {
      ...depois,
      categorias: depois.categorias.map((c) =>
        c.id === 'aeb' ? { ...c, itens: [...c.itens, novoItem({ servico: 'Taça', estimado: 90 })] } : c
      ),
    }
    expect(itensDe(desfazerCarregar(digitando, antes, escolhas), 'aeb').map((i) => i.servico)).toEqual([
      'Gelo',
      'Copos',
      'Taça',
    ])
  })

  it('edição feita DEPOIS num item antigo da categoria tocada é preservada (não volta ao valor velho)', () => {
    const ev = novoEvento()
    ev.categorias.find((c) => c.id === 'aeb').itens = [novoItem({ id: 'gelo', servico: 'Gelo', estimado: 800 })]
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(ev, escolhas)
    const digitando = {
      ...depois,
      categorias: depois.categorias.map((c) =>
        c.id === 'aeb'
          ? { ...c, itens: c.itens.map((i) => (i.id === 'gelo' ? { ...i, estimado: 950 } : i)) }
          : c
      ),
    }
    const aebDesfeito = itensDe(desfazerCarregar(digitando, antes, escolhas), 'aeb')
    expect(aebDesfeito).toHaveLength(1)
    expect(aebDesfeito[0].estimado).toBe(950) // o 800 velho NÃO ressuscita
  })

  it('categoria recriada pela ação some no desfazer; mas se o Marco lançou algo nela, ela FICA com o dele', () => {
    const ev = novoEvento()
    ev.categorias = ev.categorias.filter((c) => c.id !== 'extras')
    const escolhas = [{ catId: 'extras', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(ev, escolhas)
    expect(depois.categorias.some((c) => c.id === 'extras')).toBe(true)
    // (a) nada digitado: a categoria recriada some, como antes da ação
    expect(desfazerCarregar(depois, antes, escolhas).categorias.some((c) => c.id === 'extras')).toBe(false)
    // (b) o Marco lançou um custo nela: a categoria fica, com o item dele
    const digitando = {
      ...depois,
      categorias: depois.categorias.map((c) =>
        c.id === 'extras' ? { ...c, itens: [...c.itens, novoItem({ servico: 'Táxi', estimado: 300 })] } : c
      ),
    }
    const desfeito = desfazerCarregar(digitando, antes, escolhas)
    expect(itensDe(desfeito, 'extras').map((i) => i.servico)).toEqual(['Táxi'])
  })

  it('categoria apagada entre a ação e o clique não é ressuscitada', () => {
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(novoEvento(), escolhas)
    const semAeb = { ...depois, categorias: depois.categorias.filter((c) => c.id !== 'aeb') }
    expect(desfazerCarregar(semAeb, antes, escolhas).categorias.some((c) => c.id === 'aeb')).toBe(false)
  })

  it('PURA: não muta o evento de agora nem a foto de antes', () => {
    const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'it-1' }]
    const { antes, depois } = carregar(novoEvento(), escolhas)
    const depoisJson = JSON.stringify(depois)
    const antesJson = JSON.stringify(antes)
    desfazerCarregar(depois, antes, escolhas)
    expect(JSON.stringify(depois)).toBe(depoisJson)
    expect(JSON.stringify(antes)).toBe(antesJson)
  })
})

describe('aplicarCarregar com itemId — o id vem de fora para o Desfazer saber o que tirar', () => {
  it('o item criado nasce com o id que a tela sorteou; sem itemId, o id é o do novoItem', () => {
    const comId = aplicarCarregar(novoEvento(), bm(), [{ catId: 'aeb', modo: 'somar', itemId: 'it-fixo' }])
    expect(comId.categorias.find((c) => c.id === 'aeb').itens[0].id).toBe('it-fixo')
    const semId = aplicarCarregar(novoEvento(), bm(), [{ catId: 'aeb', modo: 'somar' }])
    const item = semId.categorias.find((c) => c.id === 'aeb').itens[0]
    expect(item.id).toBeTruthy()
    expect(item.id).not.toBe('it-fixo')
  })
})

describe('rotuloCarregar — o botão diz o efeito (princípio 9)', () => {
  it('planilha inteira e por categoria; singular/plural', () => {
    expect(rotuloCarregar('Marfim 09/05', 6)).toBe('Adicionar 6 itens da Marfim 09/05')
    expect(rotuloCarregar('Marfim 09/05', 1, 'A&B')).toBe('Adicionar 1 item da Marfim 09/05 em A&B')
  })
})

// ————————————————————————————————————————————————————————————————————————
// A FRASE DA PROMESSA, CONFERIDA POR MÁQUINA.
//
// O defeito consertado em 27/07/2026 foi este: por seis dias o comentário de
// aplicarCarregar prometeu um status que o código não cria mais, e nada ficou
// vermelho — quem lesse só o comentário planejaria em cima de informação falsa.
//
// A PRIMEIRA versão desta guarda procurava o default nos comentários do arquivo
// INTEIRO, e não servia: a nota histórica (que precisa citar ORÇAR e ESTIMADO
// para explicar o erro) satisfazia a busca sozinha. Um revisor devolveu SÓ a
// frase errada, deixando a nota de pé, e a suíte inteira ficou verde com o
// defeito de volta — guarda que mente dizendo que há rede. Por isso agora a
// mira é UMA FRASE, não o arquivo:
//
//   escopo    = o bloco /** … */ colado em `export function aplicarCarregar`
//               (a nota histórica foi movida para FORA dele, no módulo);
//   a frase   = dentro desse bloco, a única que traz a palavra solta "status"
//               (STATUS_CUSTO_PADRAO e statusCusto.js NÃO contam — o \b exige
//               não-palavra depois de "status", e "_" e "C" são palavra);
//   afirma-se = essa frase nomeia a constante E cita entre aspas o status de
//               hoje, e o status citado por escrito é EXATAMENTE o que o item
//               criado nasce tendo.
//
// A última asserção é a que fecha o buraco do valor: ela não compara a frase
// com a constante importada (isso passaria verde para qualquer valor), compara
// a frase com o status REAL do item que aplicarCarregar acabou de criar. Trocar
// o valor de STATUS_CUSTO_PADRAO em statusCusto.js muda o item e não muda a
// frase — vermelho.
//
// O que NÃO se afirma, de propósito: que a palavra 'ORÇAR' não possa aparecer
// no arquivo. A nota histórica precisa nomear o status antigo; proibir isso
// apagaria a explicação junto com o erro. O preço, declarado: história sobre
// status escrita DENTRO do bloco de documentação faz esta guarda acusar
// ambiguidade (duas frases com "status") — e o conserto é mover a história para
// a nota, que é onde ela mora.
// ————————————————————————————————————————————————————————————————————————
const FONTE_MODULO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'carregarBenchmark.js')

/** O bloco /** … *\/ imediatamente colado em `export function aplicarCarregar`,
 *  sem os prefixos de comentário. O "não contém fim-de-bloco" garante que é o
 *  bloco COLADO na função, e não um bloco anterior esticado até ela. */
function blocoDeAplicarCarregar() {
  const fonte = readFileSync(FONTE_MODULO, 'utf8')
  const m = fonte.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export function aplicarCarregar\b/)
  if (!m) return null
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** As frases do bloco que falam do "status" do item (palavra solta). */
function frasesSobreStatus(bloco) {
  return (bloco || '')
    .split(/(?<=\.)\s+/) // ponto seguido de espaço; "statusCusto.js" fica inteiro
    // `.match(…) !== null` e não `/…/.test(f)` de propósito: o gerador do
    // EVIDENCIA-TESTES.md lê `.test(` como declaração de caso e inventaria uma
    // linha de teste que não existe. Não "simplifique" de volta sem olhar o
    // índice depois.
    .filter((f) => f.match(/\bstatus\b/i) !== null)
}

/** A frase da promessa — ou erro em português dizendo o que consertar (nada
 *  falha em silêncio: sem o bloco, os casos abaixo não podem virar TypeError
 *  ilegível, têm de dizer ao próximo o que aconteceu). */
function fraseDaPromessa() {
  const bloco = blocoDeAplicarCarregar()
  if (!bloco) {
    throw new Error(
      'carregarBenchmark.js: não achei o bloco /** */ colado em `export function ' +
        'aplicarCarregar`. Se a função mudou de nome, atualize esta guarda junto.',
    )
  }
  const frases = frasesSobreStatus(bloco)
  if (frases.length !== 1) {
    throw new Error(
      `carregarBenchmark.js: o bloco de aplicarCarregar precisa de UMA frase sobre o ` +
        `status do item criado; achei ${frases.length}. Se você escreveu história sobre ` +
        `status aí dentro, mova para a NOTA HISTÓRICA acima da função — é lá que ela mora, ` +
        `justamente para não servir de esconderijo para a frase errada.`,
    )
  }
  return frases[0]
}

describe('carregarBenchmark.js — a frase que promete o status do item criado', () => {
  it('a frase existe e é única no bloco de aplicarCarregar (sem isto, o resto passaria sem olhar nada)', () => {
    const bloco = blocoDeAplicarCarregar()
    // Vermelho aqui = o bloco sumiu/foi renomeado, ou o texto sobre status
    // ficou ambíguo (duas frases). Conserto: uma frase só sobre o status no
    // bloco; história vai para a nota histórica acima da função, no módulo.
    expect(bloco, 'bloco /** */ de aplicarCarregar não encontrado').toBeTruthy()
    expect(frasesSobreStatus(bloco)).toHaveLength(1)
  })

  it('a frase nomeia a constante STATUS_CUSTO_PADRAO (e não um status escrito à mão)', () => {
    // Vermelho aqui = alguém voltou a cravar um status na frase ("status ORÇAR
    // de novoItem") em vez de apontar para a fonte da verdade.
    expect(fraseDaPromessa()).toContain('STATUS_CUSTO_PADRAO')
  })

  it('o status citado POR ESCRITO na frase é o que o item criado nasce tendo', () => {
    const frase = fraseDaPromessa()
    // Só literais em CAIXA ALTA entre aspas: é a forma dos ids de status
    // ('ESTIMADO'), e deixa de fora 'somar'/'substituir' do resto do bloco.
    const citados = (frase.match(/'([A-ZÁÂÃÇÉÊÍÓÔÕÚ][A-ZÁÂÃÇÉÊÍÓÔÕÚ ]*)'/g) || []).map((s) =>
      s.slice(1, -1),
    )
    expect(citados, 'a frase precisa citar entre aspas o status de hoje').toHaveLength(1)

    const novo = aplicarCarregar(novoEvento(), bm(), [{ catId: 'aeb', modo: 'somar' }])
    const real = novo.categorias.find((c) => c.id === 'aeb').itens[0].status
    // Vermelho aqui = o valor do default mudou em statusCusto.js e a frase não
    // acompanhou. A comparação é frase × item REAL de propósito: comparar a
    // frase com a constante importada ficaria verde para qualquer valor novo.
    expect(real).toBe(citados[0])
  })

  it('e esse status é mesmo o default da casa (a frase não pode citar outro status válido)', () => {
    expect(fraseDaPromessa()).toContain(`'${STATUS_CUSTO_PADRAO}'`)
  })
})


describe('S4 inversão global por ID',()=>{
 const antes=()=>({...novoEvento(),categorias:[{id:'aeb',itens:[{id:'original',estimado:12000}]},{id:'extras',itens:[]}]});
 const escolhas=[{catId:'aeb',modo:'substituir',itemId:'carregado'}];
 it('histórico já restaurou 12000: toast é no-op por referência e não duplica 24000',()=>{const e=antes();expect(desfazerCarregar(e,e,escolhas)).toBe(e)});
 it('original editado e movido vence foto antiga, carregado movido sai',()=>{const e=antes();const atual={...e,categorias:[{id:'aeb',itens:[]},{id:'extras',itens:[{id:'original',estimado:13000},{id:'carregado',estimado:16420},{id:'usuario',estimado:50}]}]};const r=desfazerCarregar(atual,e,escolhas);expect(r.categorias[0].itens).toEqual([]);expect(r.categorias[1].itens).toEqual([{id:'original',estimado:13000},{id:'usuario',estimado:50}])});
 it('replay não dobra 17000 em duas categorias',()=>{const e=antes(); e.categorias[1].itens=[{id:'o2',estimado:5000}];const esc=[...escolhas,{catId:'extras',modo:'substituir',itemId:'c2'}];const aplicado=aplicarCarregar(e,{nome:'S4',custos:{aeb:16420,extras:100}},esc);const r=desfazerCarregar({...aplicado,categorias:aplicado.categorias.map(c=>({...c,itens:[]}))},e,esc);expect(r.categorias.flatMap(c=>c.itens).reduce((s,i)=>s+i.estimado,0)).toBe(17000);expect(desfazerCarregar(r,e,esc)).toBe(r)});
})


it('rebase de fotos fica só no evento da ação e preserva as fotos recebidas', () => {
  const original = { id: 'festa-1', categorias: [{ id: 'aeb', itens: [{ id: 'original', estimado: 12000 }] }] }
  const escolhas = [{ catId: 'aeb', modo: 'substituir', itemId: 'A' }]
  const depoisA = aplicarCarregar(original, { custos: { aeb: 16420 } }, escolhas)
  const outroEvento = { ...depoisA, id: 'festa-2' }
  const ativos = {
    A: { eventoAntes: original, escolhas },
    B: { eventoAntes: outroEvento, escolhas: [{ catId: 'aeb', modo: 'substituir', itemId: 'B' }] },
    C: { eventoAntes: depoisA, escolhas: [{ catId: 'aeb', modo: 'somar', itemId: 'C' }] },
  }
  const antes = JSON.stringify(ativos)
  const contexto = prepararDesfazerCarregamento(ativos, 'A')
  expect(contexto.mapa.B).toBe(ativos.B)
  expect(contexto.categoriasSubstituidasDepois.size).toBe(0)
  expect(contexto.mapa.C.eventoAntes.categorias[0].itens).toEqual([{ id: 'original', estimado: 12000 }])
  expect(JSON.stringify(ativos)).toBe(antes)
})


it('preparar desfazer distingue ausência de sucessor, foto intacta e foto alterada', () => {
  const original = { id: 'festa', categorias: [{ id: 'aeb', itens: [{ id: 'original', estimado: 12000 }] }] }
  const escolhas = [{ catId: 'aeb', modo: 'somar', itemId: 'A' }]
  const A = { eventoAntes: original, escolhas }
  const B = { eventoAntes: original, escolhas: [{ catId: 'aeb', modo: 'somar', itemId: 'B' }] }
  expect(prepararDesfazerCarregamento({ A }, 'A').recuperacaoAlterada).toBe(false)
  const intacto = prepararDesfazerCarregamento({ A, B }, 'A')
  expect(intacto.recuperacaoAlterada).toBe(false)
  expect(intacto.mapa.B).toBe(B)
  const fotoComA = aplicarCarregar(original, { custos: { aeb: 16420 } }, escolhas)
  const alterado = prepararDesfazerCarregamento({ A, B: { ...B, eventoAntes: fotoComA } }, 'A')
  expect(alterado.recuperacaoAlterada).toBe(true)
  expect(alterado.mapa.B.eventoAntes.categorias[0].itens).toEqual([{ id: 'original', estimado: 12000 }])
})
