// A FESTA COM CUSTO QUE NÃO CABE NUMA CONTA DE DINHEIRO.
//
// ---------------------------------------------------------------------------
// O DEFEITO, MEDIDO (26/07/2026)
// ---------------------------------------------------------------------------
// Uma festa com dois custos — Bebidas R$ 3.000 e "Som e luz" com 1 seguido de
// 308 zeros, valor que a porta do backup ainda deixa entrar — foi montada e as
// quatro telas de custo foram RODADAS. O que cada uma devolveu por dentro, e o
// que cada uma escreveu:
//
//   aba Custos ............ total Infinity   → a tela escreve "R$ 0"
//   aba Cenários .......... custo  Infinity  → a tela escreve "R$ 0"
//   aba Fechamento (card) . custo  Infinity  → a tela escreve "R$ 0"
//   relatório ............. custo  Infinity  → o papel escreve "R$ 0"
//
// A guarda que entrou em 26/07 (calc.js e fechamento.js) mantém o número
// INTERNO gritando — é ela que impede o card do Fechamento de anunciar lucro
// falso. Mas `fmtBRL` passa todo valor por `num()`, que devolve 0 para tudo que
// não é número finito: a TELA imprime R$ 0 antes e depois, e o Marco não tem
// como saber, olhando o app, que aquela festa está com dado quebrado.
//
// ---------------------------------------------------------------------------
// A RÉGUA DESTE MÓDULO — "não cabe", nunca "é grande"
// ---------------------------------------------------------------------------
// A pergunta que este módulo responde NÃO é "esse custo é alto demais?" — é
// "esse número sobrevive à régua de centavos da casa?". `somaCentavos()`
// multiplica por 100 antes de arredondar, então o limite é do DOUBLE, não do
// negócio: só valor acima de ~1,8 × 10^306 estoura. Uma festa de R$ 500.000 —
// ou de R$ 500 bilhões — está 10^297 vezes longe disso.
//
// É de propósito que não existe teto de negócio aqui: teto de negócio erra em
// festa legítima grande, e um aviso que aparece em festa boa ensina o dono a
// ignorar aviso. Os testes de FALSO POSITIVO abaixo valem tanto quanto os do
// caso quebrado.
import { describe, it, expect } from 'vitest'
import { custosQuebrados, cabeComoDinheiro } from './dadoQuebrado.js'
import { custosPorCategoria } from './calc.js'
import { novoEvento, novoItem } from './defaults.js'

const ABSURDO = 1e308 // 1 seguido de 308 zeros

const festa = (categorias) => ({ ...novoEvento('Festa'), categorias })

const cat = (id, nome, itens) => ({ id, nome, padrao: false, itens })

// ---------------------------------------------------------------------------
// 1. O VALOR QUE NÃO CABE
// ---------------------------------------------------------------------------
describe('cabeComoDinheiro — a régua é o double, não o negócio', () => {
  it('recusa o 1 seguido de 308 zeros, que estoura ao virar centavos', () => {
    expect(cabeComoDinheiro(ABSURDO)).toBe(false)
    // e a prova de que a causa é a multiplicação por 100 da régua de centavos
    expect(Number.isFinite(ABSURDO)).toBe(true)
    expect(Number.isFinite(ABSURDO * 100)).toBe(false)
  })

  it('recusa também o que nem número é — texto, infinito e nada', () => {
    expect(cabeComoDinheiro('oito mil')).toBe(false)
    expect(cabeComoDinheiro(Infinity)).toBe(false)
    expect(cabeComoDinheiro(-Infinity)).toBe(false)
    expect(cabeComoDinheiro(NaN)).toBe(false)
  })

  it('aceita todo dinheiro que uma festa de verdade tem', () => {
    // A maior festa da casa (Marfim 09/05) custou R$ 360 mil. Estes valores
    // sobem muito além disso e nenhum deles é recusado.
    for (const v of [0, '', null, undefined, 0.01, 350, 15312.5, 500000, 1e9, 1e12, 1e300]) {
      expect(cabeComoDinheiro(v)).toBe(true)
    }
  })

  it('aceita valor negativo — quem recusa negativo é a porta do campo, não este aviso', () => {
    // A trava do negativo (Marco, 22/07/2026) vive em FAIXA_CUSTO, na entrada.
    // Um −500 que já esteja salvo é um número que CABE: a conta o soma sem
    // estourar, então ele não é "dado quebrado" e não pode ganhar este aviso.
    expect(cabeComoDinheiro(-500)).toBe(true)
    expect(cabeComoDinheiro(-1e12)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. A FESTA QUEBRADA É NOMEADA — qual custo, em qual categoria
// ---------------------------------------------------------------------------
describe('custosQuebrados — diz QUAL custo está quebrado', () => {
  it('nomeia o item e a categoria da festa medida', () => {
    const evento = festa([
      cat('aeb', 'A&B', [novoItem({ servico: 'Bebidas', estimado: 3000 })]),
      cat('estrutura', 'Estrutura', [novoItem({ servico: 'Som e luz', estimado: ABSURDO })]),
    ])
    const q = custosQuebrados(evento)
    expect(q.ha).toBe(true)
    expect(q.itens).toEqual([{ categoria: 'Estrutura', servico: 'Som e luz', campos: ['estimado'] }])
    // e a medição que motivou tudo: por dentro o total não é número
    expect(Number.isFinite(custosPorCategoria(evento.categorias).totalConsiderado)).toBe(false)
  })

  it('pega o valor quebrado no REALIZADO também, não só no estimado', () => {
    const evento = festa([
      cat('equipe', 'Equipe', [
        novoItem({ servico: 'Garçons', estimado: 4000, realizado: ABSURDO }),
      ]),
    ])
    expect(custosQuebrados(evento).itens).toEqual([
      { categoria: 'Equipe', servico: 'Garçons', campos: ['realizado'] },
    ])
  })

  it('custo sem nome ainda assim é nomeado, com o rótulo do app', () => {
    const evento = festa([cat('aeb', 'A&B', [novoItem({ servico: '', estimado: ABSURDO })])])
    expect(custosQuebrados(evento).itens[0].servico).toBe('(custo sem nome)')
  })

  // A soma pode estourar sem que item nenhum estoure sozinho: dois itens de
  // 1 × 10^306 cabem cada um (1 × 10^308 em centavos), e a soma dos dois não.
  // Sem esta metade o aviso ficaria calado justamente na festa em que nenhum
  // item parece culpado.
  it('avisa quando a SOMA não cabe, mesmo com todo item cabendo sozinho', () => {
    const evento = festa([
      cat('aeb', 'A&B', [
        novoItem({ servico: 'Item A', estimado: 1e306 }),
        novoItem({ servico: 'Item B', estimado: 1e306 }),
      ]),
    ])
    const q = custosQuebrados(evento)
    expect(q.itens).toEqual([])
    expect(q.somaNaoCabe).toBe(true)
    expect(q.ha).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. FALSO POSITIVO — festa normal NÃO ganha aviso
// ---------------------------------------------------------------------------
describe('festa legítima nunca é acusada de dado quebrado', () => {
  const semAviso = (evento, quem) => {
    const q = custosQuebrados(evento)
    expect(`${quem}: ${q.ha} ${JSON.stringify(q.itens)}`).toBe(`${quem}: false []`)
  }

  it('a festa de R$ 500.000 — grande de verdade — passa limpa', () => {
    semAviso(
      festa([
        cat('aeb', 'A&B', [novoItem({ servico: 'Open bar', estimado: 180000 })]),
        cat('estrutura', 'Estrutura', [novoItem({ servico: 'Palco', estimado: 220000 })]),
        cat('equipe', 'Equipe', [novoItem({ servico: 'Produção', estimado: 100000 })]),
      ]),
      'festa de meio milhão'
    )
  })

  it('custo zero, custo vazio, custo negativo e festa sem custo nenhum passam limpos', () => {
    semAviso(festa([cat('aeb', 'A&B', [novoItem({ servico: 'Permuta', estimado: 0 })])]), 'zero')
    semAviso(festa([cat('aeb', 'A&B', [novoItem({ servico: 'A definir' })])]), 'vazio')
    semAviso(
      festa([cat('aeb', 'A&B', [novoItem({ servico: 'Crédito', estimado: -500 })])]),
      'negativo'
    )
    semAviso(festa([cat('aeb', 'A&B', [])]), 'categoria sem item')
    semAviso(festa([]), 'festa sem categoria')
    semAviso({ ...novoEvento('Sem nada'), categorias: undefined }, 'festa sem o campo categorias')
  })

  it('a festa dos quatro itens de centavo (o caso das quatro superfícies) passa limpa', () => {
    semAviso(
      festa([
        cat('aeb', 'A&B', [1215.82, 6571.21, 6605.32, 920.15].map((v, i) =>
          novoItem({ servico: `Item ${i + 1}`, estimado: v })
        )),
      ]),
      'quatro itens de centavo'
    )
  })

  // A prova de que a distância é absurda: um item de R$ 1 × 10^300 — cem
  // ordens de grandeza acima de qualquer festa concebível — ainda cabe. Este
  // teste existe para que ninguém troque a régua por um teto de negócio sem
  // ver vermelho.
  it('nem um valor de 10^300 dispara o aviso — a régua não é de negócio', () => {
    semAviso(festa([cat('aeb', 'A&B', [novoItem({ servico: 'Absurdo, mas cabe', estimado: 1e300 })])]), '10^300')
  })

  // VARREDURA, com semente fixa — o caso a caso acima escolhe os casos que eu
  // pensei; esta escolhe 20.000 que eu não pensei. Dinheiro plausível: até
  // R$ 900 mil por item, com as três casas decimais que a planilha do produtor
  // produz, mais vazios, zeros e créditos negativos misturados.
  it('20.000 festas de dinheiro plausível: nenhuma acusada', () => {
    let semente = 987654321
    const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648)
    const acusadas = []
    for (let k = 0; k < 20000; k++) {
      const categorias = []
      for (let c = 0; c < 1 + Math.floor(rnd() * 5); c++) {
        const itens = []
        for (let i = 0; i < Math.floor(rnd() * 12); i++) {
          const sorte = rnd()
          const estimado =
            sorte < 0.08
              ? ''
              : sorte < 0.12
                ? 0
                : sorte < 0.14
                  ? -Math.round(rnd() * 5000 * 100) / 100
                  : Math.round(rnd() * 900000 * 1000) / 1000
          const realizado = rnd() < 0.4 ? Math.round(rnd() * 900000 * 100) / 100 : ''
          itens.push(novoItem({ servico: `Item ${i}`, estimado, realizado }))
        }
        categorias.push(cat(`c${c}`, `Categoria ${c}`, itens))
      }
      if (custosQuebrados(festa(categorias)).ha) acusadas.push(k)
    }
    expect(acusadas).toEqual([])
  })

  // Contraprova da varredura: ela precisa ser capaz de acusar. Sem esta linha,
  // uma varredura que nunca chegasse a rodar (fixture vazio, laço com zero
  // voltas) passaria verde afirmando o contrário do que mede.
  it('contraprova: um único item corrompido no meio da varredura é pego', () => {
    const evento = festa([
      cat('aeb', 'A&B', [
        novoItem({ servico: 'Bebidas', estimado: 3000 }),
        novoItem({ servico: 'Som e luz', estimado: ABSURDO }),
        novoItem({ servico: 'Gelo', estimado: 400 }),
      ]),
    ])
    expect(custosQuebrados(evento).itens.map((i) => i.servico)).toEqual(['Som e luz'])
  })
})
