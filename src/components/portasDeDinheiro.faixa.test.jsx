// @vitest-environment jsdom
//
// FRENTE 18 do MODELO-AUDITORIA — INVENTÁRIO DE PORTAS POR CAMPO DE DINHEIRO.
// A frente 18 é de MÉTODO e nasceu 100% manual ("a cada auditoria: grep por
// MoneyInput/NumInput novos SEM faixa"). Um grep que alguém tem de lembrar de
// rodar é uma trava social; este arquivo transforma o grep em PAREDE.
//
// COMO FUNCIONA, e por que a lista não é copiada à mão: o inventário é GERADO
// do código-fonte a cada execução (lê os .jsx de src/components e recorta cada
// tag de campo numérico com o seu `value` e o seu `faixa`). O que está escrito
// aqui embaixo não é a lista das portas — é a lista das DECISÕES sobre elas.
// Uma lista de portas copiada envelheceria calada; esta, quando o código muda,
// diverge e o teste morde.
//
// O que morde, exatamente:
//   • campo de dinheiro/quantidade NOVO sem `faixa` e sem declaração → vermelho
//     ("porta nova: dê a régua ou declare por que não tem");
//   • porta declarada "sem faixa" que GANHOU faixa → vermelho (tire da lista —
//     é assim que a lista não envelhece);
//   • porta que sumiu ou trocou de régua → vermelho.
//
// E a régua da própria régua: o último bloco prova que MoneyInput/PctInput
// REPASSAM o `faixa` ao NumInput. Sem esse repasse, todas as faixas do app
// viram decoração de uma vez só — e nenhum teste de tela pegaria isso.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MoneyInput, PctInput, NumInput, DICA_CAMPO_DINHEIRO } from './ui.jsx'
import {
  FAIXA_CUSTO,
  FAIXA_PCT,
  FAIXA_QUANTIDADE,
  FAIXA_PRECO,
  FAIXA_PARCELA,
  FAIXA_DIAS,
  FAIXA_CONSUMO,
  TETO_DINHEIRO,
} from '../lib/campoNumerico.js'

afterEach(cleanup)

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const TAGS = ['MoneyInput', 'PctInput', 'NumInput', 'Slider']

/**
 * Varre os componentes e devolve `{ chave → faixa }` de cada porta numérica.
 * `chave` é "Arquivo.jsx · Tag value={expressão}" — identidade estável (não usa
 * número de linha, que muda a cada edição de layout); `faixa` é o texto da prop
 * `faixa={...}` ou `null` quando a porta não tem régua.
 */
function inventarioDePortas() {
  const dir = AQUI
  const arquivos = readdirSync(dir)
    .filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
    .sort()
  const portas = {}
  for (const arquivo of arquivos) {
    const fonte = readFileSync(path.join(dir, arquivo), 'utf8')
    for (const tag of TAGS) {
      const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g')
      let m
      while ((m = re.exec(fonte))) {
        // Recorta até o `>` que fecha a tag de ABERTURA, ignorando os `>` que
        // moram dentro de expressões `{...}` (arrow functions, ternários).
        let prof = 0
        let fim = fonte.length
        for (let k = m.index; k < fonte.length; k++) {
          const ch = fonte[k]
          if (ch === '{') prof++
          else if (ch === '}') prof--
          else if (ch === '>' && prof === 0) {
            fim = k
            break
          }
        }
        const trecho = fonte.slice(m.index, fim + 1)
        const pegar = (prop) => {
          const achado = trecho.match(new RegExp(`${prop}=\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`))
          return achado ? achado[1].replace(/\s+/g, ' ').trim() : null
        }
        const value = pegar('value') ?? '(sem value)'
        portas[`${arquivo} · ${tag} value={${value}}`] = pegar('faixa')
      }
    }
  }
  return portas
}

// ————————————————————————————————————————————————————————————————————————
// PORTAS COM RÉGUA — o mapa vivo que a frente 18 pede, gerado e conferido.
// ————————————————————————————————————————————————————————————————————————
const COM_FAIXA = {
  'Ajustes.jsx · PctInput value={premissaAtual.cenarios[cen][campo]}': 'FAIXA_GRADE[campo]',
  'Ajustes.jsx · PctInput value={premissaAtual[campo]}': 'FAIXA_CAMPO[campo]',
  'Ajustes.jsx · PctInput value={premissaAtual.descontoIngressosValor}':
    "efetivo.descontoIngressosModo.valor === 'numero' ? undefined : FAIXA_PCT",
  'CostsTab.jsx · MoneyInput value={i.estimado}': 'FAIXA_CUSTO',
  'CostsTab.jsx · MoneyInput value={i.realizado}': 'FAIXA_CUSTO',
  'CostsTab.jsx · PctInput value={evento.contingenciaPct}': 'FAIXA_PCT',
  'DossieCustoModal.jsx · MoneyInput value={item.estimado}': 'FAIXA_CUSTO',
  'DossieCustoModal.jsx · MoneyInput value={item.realizado}': 'FAIXA_CUSTO',
  'FechamentoTab.jsx · MoneyInput value={rr.bilheteria}': 'FAIXA_CUSTO',
  "FechamentoTab.jsx · MoneyInput value={rr.pix ?? ''}": 'FAIXA_CUSTO',
  'RevenueTab.jsx · MoneyInput value={l.valor}': 'FAIXA_PRECO',
  'RevenueTab.jsx · MoneyInput value={p.valor}': 'FAIXA_PATROCINIO',
  'RevenueTab.jsx · PctInput value={evento.taxaBilheteria}': 'FAIXA_PCT',
  'RevenueTab.jsx · PctInput value={evento.cashbackPct}': 'FAIXA_PCT',
  "RevenueTab.jsx · PctInput value={evento.descontoMedioPct ?? ''}": 'FAIXA_PCT',
  "RevenueTab.jsx · PctInput value={evento.descontoIngressosValor ?? ''}": 'FAIXA_PCT',
  "RevenueTab.jsx · PctInput value={evento.barTaxaSistemaPct ?? ''}": 'FAIXA_PCT',
  // Alíquota do imposto sobre a receita (Marco, 27/07/2026). Nasce já em
  // COM_FAIXA, na régua 0..100 dos irmãos percentuais: uma alíquota de 150%
  // herdada de backup editado à mão cobraria mais imposto do que a festa
  // arrecada, e o prejuízo apareceria na tela como certo.
  "RevenueTab.jsx · PctInput value={evento.impostoPct ?? ''}": 'FAIXA_PCT',
  'RevenueTab.jsx · NumInput value={l.quantidade}': 'FAIXA_QUANTIDADE',
  'Simulador.jsx · Slider value={valorEfetivo(cfg, cen, f.campo)}': 'f.faixa',
  "Veredito.jsx · PctInput value={evento.margemAlvo ?? ''}": 'FAIXA_MARGEM',
  "Veredito.jsx · PctInput value={evento.margemMinima ?? ''}": 'FAIXA_MARGEM',
  'ui.jsx · NumInput value={v}': 'faixa', // o campo acoplado do Slider repassa a régua recebida

  // As 13 portas da decisão do Marco, 25/07/2026 ("travar negativo nos 13
  // campos soltos e por teto de R$ 100 milhões") — ganharam faixa NESTA sessão
  // e saem das duas listas SEM régua abaixo. São 14 chaves de código (uma
  // "campo" de negócio, lotesPadrao, tem DUAS portas — valor e quantidade).
  'EventEditor.jsx · NumInput value={evento.publicoEstimado}': 'FAIXA_QUANTIDADE',
  "RitmoVendas.jsx · NumInput value={evento.vendidosAteHoje ?? ''}": 'FAIXA_QUANTIDADE',
  'ImportModal.jsx · NumInput value={rev.publico}': 'FAIXA_QUANTIDADE',
  'ParcelasModal.jsx · NumInput value={n}': 'FAIXA_QUANTIDADE',
  'ParcelasModal.jsx · MoneyInput value={p.valor}': 'FAIXA_PARCELA',
  'Ajustes.jsx · NumInput value={premissaAtual.vendasAbremDiasAntes}': 'FAIXA_DIAS',
  'Ajustes.jsx · MoneyInput value={c.estimado}': 'FAIXA_CUSTO',
  'Ajustes.jsx · MoneyInput value={l.valor}': 'FAIXA_PRECO',
  'Ajustes.jsx · NumInput value={l.quantidade}': 'FAIXA_QUANTIDADE',
  "RevenueTab.jsx · MoneyInput value={evento.barTicket?.[k] ?? ''}": 'FAIXA_CONSUMO',
  "RevenueTab.jsx · MoneyInput value={evento.barCustoSistema ?? ''}": 'FAIXA_CUSTO',
  "RevenueTab.jsx · NumInput value={evento.descontoIngressosValor ?? ''}": 'FAIXA_QUANTIDADE',
  "Simulador.jsx · MoneyInput value={cfg[cen]?.ticketMedio ?? ''}": 'FAIXA_PRECO',
  "ScenariosTab.jsx · NumInput value={ov ?? ''}": 'FAIXA_QUANTIDADE',

  // Slider de bar por pessoa na grade de cenários (Marco, 05/08/2026). É a
  // SEGUNDA porta do mesmo campo de negócio — a primeira é o MoneyInput da aba
  // Receita, logo acima — e por isso leva a MESMA régua: `FAIXA_CONSUMO`. Duas
  // portas do mesmo dado com réguas diferentes seria a divergência que este
  // inventário existe para não deixar nascer. O 0..300 do slider é alcance de
  // ARRASTO, não trava: digitar continua valendo até o teto da faixa.
  'Simulador.jsx · Slider value={num(evento.barTicket?.[cen])}': 'FAIXA_CONSUMO',
}

// ————————————————————————————————————————————————————————————————————————
// PORTAS SEM RÉGUA, COM DECISÃO ESCRITA. Cada linha cita ONDE a decisão mora.
// ————————————————————————————————————————————————————————————————————————
const SEM_FAIXA_DECIDIDO = {
  // Regra escrita em campoNumerico.js (bloco da FAIXA_CUSTO) e repetida em
  // migracao.js (naoNegativoOuVazio): "Derivados (lucro, bar líquido,
  // benchmark) NÃO usam faixa — prejuízo é fato", e a trava "não se aplica
  // (…) nem ao bar digitado".
  'RevenueTab.jsx · MoneyInput value={openBar ? \'\' : evento.outrasReceitas?.bar}':
    'bar líquido digitado — prejuízo é fato (campoNumerico.js/FAIXA_CUSTO e migracao.js/naoNegativoOuVazio)',
  // Slider do bar em modo VALOR FIXO na grade de cenários (Marco, 05/08/2026).
  // É a SEGUNDA porta do mesmo campo da linha acima, e por isso herda a mesma
  // decisão: sem faixa. O 0..300.000 do slider é alcance de ARRASTO — digitar
  // um prejuízo de bar continua valendo, como no campo irmão da aba Receita.
  'Simulador.jsx · Slider value={num(evento.outrasReceitas?.bar)}':
    'mesma porta de negócio do bar líquido da aba Receita — prejuízo é fato (campoNumerico.js/FAIXA_CUSTO)',
  'FechamentoTab.jsx · MoneyInput value={rr.bar}':
    'bar realizado aceita prejuízo numérico; abertura preserva o original e avisa; import normaliza tipo inválido com revisão e original',
  "BenchmarksEditor.jsx · MoneyInput value={bm.custos?.[k] ?? ''}":
    'benchmark é DADO de referência histórico, fora da regra de faixa (campoNumerico.js/FAIXA_CUSTO: "derivados… benchmark")',
  "BenchmarksEditor.jsx · MoneyInput value={bm.receita ?? ''}": 'idem benchmark',
  "BenchmarksEditor.jsx · MoneyInput value={bm.ticketMedio ?? ''}": 'idem benchmark',
  // Campo aditivo da decisão 6 do Marco (25/07/2026). Entra SEM faixa pela
  // mesma regra dos irmãos, e a migração também não policia faixa nenhuma nele
  // — se policiasse, a porta aceitaria um número que a leitura seguinte
  // apagaria calada. Bilheteria impossível não some em silêncio: a etiqueta da
  // lista passa a dizer "ticket não bate com a bilheteria informada".
  "BenchmarksEditor.jsx · MoneyInput value={bm.bilheteriaBruta ?? ''}": 'idem benchmark',
  "BenchmarksEditor.jsx · MoneyInput value={bm.lucro ?? ''}": 'idem benchmark, e lucro é derivado',
  // S1 de 07/10/2026: o campo recebe o valor guardado (cru quando ilegível),
  // com o aviso "Valor guardado" embaixo (publicoDeReferencia.test.jsx); a
  // porta continua sem faixa — decisão "idem benchmark" mantida.
  "BenchmarksEditor.jsx · NumInput value={campoPublico(bm).value}": 'idem benchmark',

  // (A lista datada "BACKLOG S4 — Fronteiras que o Bloco B NÃO travou", item 2
  // de 22/07/2026, morava aqui: custosPadrao/lotesPadrao, barTicket,
  // barCustoSistema, ticketMedio manual do Simulador, descontoIngressosValor
  // no modo nº e o override de quantidade por lote. A decisão do Marco de
  // 25/07/2026 — "travar negativo nos 13 campos soltos e por teto de R$ 100
  // milhões" — REVERTEU aquela decisão para estes sete campos: eles saem
  // desta lista e entram em COM_FAIXA, acima. O motivo antigo era só "ninguém
  // perguntou ainda"; agora perguntaram, e a resposta foi travar.)

  // Estrutural: não são portas de dado, são os EMBRULHOS que repassam a régua.
  // O repasse é provado no último describe deste arquivo.
  'ui.jsx · NumInput value={value}':
    'embrulho (MoneyInput/PctInput) — repassa o `faixa` recebido via ...props; não é porta de dado',
}

// ————————————————————————————————————————————————————————————————————————
// PORTAS SEM RÉGUA, COM A RESPOSTA DO MARCO (25/07/2026): "travar negativo nos
// 13 campos soltos e por teto de R$ 100 milhões". As outras seis desta lista
// (público estimado, vendidos até hoje, público importado, valor/número de
// parcela, dias de antecedência) ganharam faixa nesta sessão e migraram para
// COM_FAIXA. UMA ficou de fora, de propósito — a sessão a ISOLOU em vez de
// travar por conta própria, porque o negativo dela é um FATO de negócio, não
// um erro de digitação (mesma régua do bar líquido/realizado, que já não usa
// faixa por este motivo):
// ————————————————————————————————————————————————————————————————————————
const SEM_FAIXA_SEM_DECISAO = {
  'AnaliseTab.jsx · MoneyInput value={evento.caixaInicial}':
    'caixa inicial — começar a festa no vermelho é uma situação real (mesma régua do bar líquido/realizado); travar em 0 apagaria essa informação. Fora dos "13 campos soltos" da decisão de 25/07/2026 de propósito — segue sem resposta datada sobre o teto.',
}

describe('frente 18 — inventário de portas de dinheiro gerado do código', () => {
  const portas = inventarioDePortas()

  it('o inventário gerado tem portas de verdade (a varredura não voltou vazia)', () => {
    // Guarda da própria varredura: um regex quebrado devolveria {} e todos os
    // testes abaixo passariam sem olhar nada — o pior tipo de teste verde.
    expect(Object.keys(portas).length).toBeGreaterThan(30)
  })

  it('TODA porta ou tem régua, ou está declarada — nenhuma porta órfã', () => {
    const declaradas = new Set([
      ...Object.keys(COM_FAIXA),
      ...Object.keys(SEM_FAIXA_DECIDIDO),
      ...Object.keys(SEM_FAIXA_SEM_DECISAO),
    ])
    const orfas = Object.keys(portas).filter((k) => !declaradas.has(k))
    // Se este teste ficar vermelho: um campo numérico novo entrou na UI. Dê a
    // ele a faixa do domínio (campoNumerico.js) ou declare-o numa das listas
    // acima, com o motivo — porta esquecida é trava de teatro.
    expect(orfas).toEqual([])
  })

  it('nenhuma linha das listas descreve uma porta que já não existe', () => {
    const existentes = new Set(Object.keys(portas))
    const fantasmas = [
      ...Object.keys(COM_FAIXA),
      ...Object.keys(SEM_FAIXA_DECIDIDO),
      ...Object.keys(SEM_FAIXA_SEM_DECISAO),
    ].filter((k) => !existentes.has(k))
    // Vermelho aqui = a lista envelheceu: a porta mudou de nome, de `value` ou
    // saiu do app. É o defeito que este arquivo existe para não ter.
    expect(fantasmas).toEqual([])
  })

  it('cada porta com régua usa exatamente a régua declarada (ninguém troca a faixa em silêncio)', () => {
    const divergentes = Object.entries(COM_FAIXA)
      .filter(([chave, faixa]) => portas[chave] !== faixa)
      .map(([chave, faixa]) => `${chave}: esperado ${faixa}, encontrado ${portas[chave]}`)
    expect(divergentes).toEqual([])
  })

  it('as portas declaradas SEM régua continuam sem régua (quem ganhar faixa sai da lista)', () => {
    const semRegua = [...Object.keys(SEM_FAIXA_DECIDIDO), ...Object.keys(SEM_FAIXA_SEM_DECISAO)]
    const ganharamFaixa = semRegua.filter((k) => portas[k] != null)
    // Vermelho aqui é BOA notícia (uma porta ganhou trava) — mas a lista tem de
    // ser atualizada junto, senão ela passa a mentir.
    expect(ganharamFaixa).toEqual([])
  })

  it('a lista de portas SEM decisão escrita é exatamente a de 25/07/2026 (2ª medição — só o caixa inicial sobra)', () => {
    // A 1ª medição de 25/07/2026 tinha sete portas aqui. A resposta do Marco
    // ("travar negativo nos 13 campos soltos e por teto de R$ 100 milhões")
    // travou seis delas nesta MESMA sessão — só o caixa inicial ficou de fora,
    // porque o negativo dele é fato de negócio, não erro de digitação. Esta
    // lista não pode encolher (campo travado sem contar) nem crescer (campo
    // novo sem régua) sem alguém editar este arquivo de propósito.
    expect(Object.keys(SEM_FAIXA_SEM_DECISAO).sort()).toEqual([
      'AnaliseTab.jsx · MoneyInput value={evento.caixaInicial}',
    ])
  })
})

// ————————————————————————————————————————————————————————————————————————
// Decisão do Marco, 25/07/2026: "travar negativo nos 13 campos soltos e por
// teto de R$ 100 milhões". Cada porta abaixo prova as TRÊS pontas por campo —
// recusa negativo com aviso, recusa acima do teto com aviso PRÓPRIO (diferente
// do aviso do negativo — são erros diferentes), e aceita um valor normal —
// exatamente como o Marco pediu. `aria-label` identifica o campo na tela;
// nenhum destes tem `aria-label` na UI real (usam `Field`/rótulo visual),
// então cada `render` aqui empresta um só para o teste enxergar o input.
// ————————————————————————————————————————————————————————————————————————
describe('frente 18 — os 13 campos da decisão de 25/07/2026: negativo recusa, teto recusa, normal grava', () => {
  const acimaDoTeto = String(TETO_DINHEIRO + 1)

  const casos = [
    {
      nome: 'público estimado (EventEditor)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '200',
      normalEsperado: 200,
    },
    {
      nome: 'vendidos até hoje (RitmoVendas)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '150',
      normalEsperado: 150,
    },
    {
      nome: 'público importado (ImportModal)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '300',
      normalEsperado: 300,
    },
    {
      nome: 'número de parcelas (ParcelasModal)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '3',
      normalEsperado: 3,
    },
    {
      nome: 'valor da parcela (ParcelasModal)',
      Componente: MoneyInput,
      faixa: FAIXA_PARCELA,
      avisoNeg: /Valor da parcela não pode ser negativo/,
      avisoMax: /Valor da parcela acima do máximo/,
      normal: '1.500,00',
      normalEsperado: 1500,
    },
    {
      nome: 'dias de antecedência (Ajustes)',
      Componente: NumInput,
      faixa: FAIXA_DIAS,
      avisoNeg: /Dias de antecedência não pode ser negativo/,
      avisoMax: /acima do máximo/,
      normal: '30',
      normalEsperado: 30,
    },
    {
      nome: 'custo padrão por festa (Ajustes)',
      Componente: MoneyInput,
      faixa: FAIXA_CUSTO,
      avisoNeg: /Custo não pode ser negativo/,
      avisoMax: /Custo acima do máximo/,
      normal: '2.000,00',
      normalEsperado: 2000,
    },
    {
      nome: 'valor do lote padrão (Ajustes)',
      Componente: MoneyInput,
      faixa: FAIXA_PRECO,
      avisoNeg: /Preço não pode ser negativo/,
      avisoMax: /Preço acima do máximo/,
      normal: '120,00',
      normalEsperado: 120,
    },
    {
      nome: 'quantidade do lote padrão (Ajustes)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '100',
      normalEsperado: 100,
    },
    {
      nome: 'consumo por pessoa do bar (RevenueTab)',
      Componente: MoneyInput,
      faixa: FAIXA_CONSUMO,
      avisoNeg: /Consumo por pessoa não pode ser negativo/,
      avisoMax: /Consumo por pessoa acima do máximo/,
      normal: '110,00',
      normalEsperado: 110,
    },
    {
      nome: 'custo do sistema do bar (RevenueTab)',
      Componente: MoneyInput,
      faixa: FAIXA_CUSTO,
      avisoNeg: /Custo não pode ser negativo/,
      avisoMax: /Custo acima do máximo/,
      normal: '50,00',
      normalEsperado: 50,
    },
    {
      nome: 'desconto de ingressos no modo nº (RevenueTab)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '50',
      normalEsperado: 50,
    },
    {
      nome: 'ticket médio manual do Simulador',
      Componente: MoneyInput,
      faixa: FAIXA_PRECO,
      avisoNeg: /Preço não pode ser negativo/,
      avisoMax: /Preço acima do máximo/,
      normal: '90,00',
      normalEsperado: 90,
    },
    {
      nome: 'override de quantidade por lote (ScenariosTab)',
      Componente: NumInput,
      faixa: FAIXA_QUANTIDADE,
      avisoNeg: /Quantidade não pode ser negativa/,
      avisoMax: /Quantidade acima do máximo/,
      normal: '80',
      normalEsperado: 80,
    },
  ]

  for (const c of casos) {
    describe(c.nome, () => {
      it('recusa negativo, avisa em português e NÃO grava', () => {
        const onChange = vi.fn()
        render(
          <c.Componente value={1000} onChange={onChange} faixa={c.faixa} aria-label={c.nome} />
        )
        fireEvent.change(screen.getByLabelText(c.nome), { target: { value: '-1' } })
        expect(screen.getByText(c.avisoNeg)).toBeTruthy()
        expect(onChange).not.toHaveBeenCalled()
      })

      it(`recusa acima do teto (R$/nº ${TETO_DINHEIRO.toLocaleString('pt-BR')}), avisa com mensagem PRÓPRIA do teto e NÃO grava`, () => {
        const onChange = vi.fn()
        render(
          <c.Componente value={1000} onChange={onChange} faixa={c.faixa} aria-label={c.nome} />
        )
        fireEvent.change(screen.getByLabelText(c.nome), { target: { value: acimaDoTeto } })
        expect(screen.getByText(c.avisoMax)).toBeTruthy()
        expect(onChange).not.toHaveBeenCalled()
      })

      it('aceita um valor normal e grava o número certo', () => {
        const onChange = vi.fn()
        render(
          <c.Componente value={1000} onChange={onChange} faixa={c.faixa} aria-label={c.nome} />
        )
        fireEvent.change(screen.getByLabelText(c.nome), { target: { value: c.normal } })
        expect(onChange).toHaveBeenCalledWith(c.normalEsperado)
      })

      it('o teto aceita o valor exatamente NO limite (não é off-by-one)', () => {
        const onChange = vi.fn()
        render(
          <c.Componente value={1000} onChange={onChange} faixa={c.faixa} aria-label={c.nome} />
        )
        fireEvent.change(screen.getByLabelText(c.nome), {
          target: { value: String(TETO_DINHEIRO) },
        })
        expect(onChange).toHaveBeenCalledWith(TETO_DINHEIRO)
      })
    })
  }
})

describe('frente 18 — a régua da régua: MoneyInput e PctInput REPASSAM o faixa', () => {
  // Se o `...props` sumir de um destes dois embrulhos, TODAS as faixas de
  // dinheiro e de percentual do app viram decoração de uma vez — o campo
  // continua na tela, o aviso nunca aparece e o valor absurdo grava. Nenhum
  // teste de tela específico pegaria isso; este pega.
  it('MoneyInput com FAIXA_CUSTO recusa −500, avisa em português e NÃO grava', () => {
    const onChange = vi.fn()
    render(<MoneyInput value={1000} onChange={onChange} faixa={FAIXA_CUSTO} aria-label="Custo de teste" />)
    fireEvent.change(screen.getByLabelText('Custo de teste'), { target: { value: '-500' } })
    expect(screen.getByText(/Custo não pode ser negativo/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('MoneyInput sem faixa continua aceitando o negativo (o embrulho não inventa régua)', () => {
    const onChange = vi.fn()
    render(<MoneyInput value={1000} onChange={onChange} aria-label="Bar líquido de teste" />)
    fireEvent.change(screen.getByLabelText('Bar líquido de teste'), { target: { value: '-500' } })
    expect(onChange).toHaveBeenCalledWith(-500)
  })

  it('PctInput com FAIXA_PCT recusa 150, avisa em português e NÃO grava', () => {
    const onChange = vi.fn()
    render(<PctInput value={10} onChange={onChange} faixa={FAIXA_PCT} aria-label="Taxa de teste" />)
    fireEvent.change(screen.getByLabelText('Taxa de teste'), { target: { value: '150' } })
    expect(screen.getByText(/Percentual entre 0 e 100/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('valor DENTRO da faixa continua gravando — a régua não quebrou o campo', () => {
    const onChange = vi.fn()
    render(<MoneyInput value={1000} onChange={onChange} faixa={FAIXA_CUSTO} aria-label="Custo de teste" />)
    fireEvent.change(screen.getByLabelText('Custo de teste'), { target: { value: '1.234,56' } })
    expect(onChange).toHaveBeenCalledWith(1234.56)
  })

  // ── A DECISÃO DE 30/08/2026 CHEGANDO NA PORTA ─────────────────────────────
  //
  // Colar "25.000,000" num campo de dinheiro gravava R$ 25 — mil vezes menos,
  // sem aviso nenhum, porque a guarda do campo só recusa LETRA. Estes dois
  // testes provam o conserto ONDE ELE IMPORTA (a porta), não só no parser.
  it('colar "25.000,000" num campo de custo grava 25000 e NÃO avisa nada', () => {
    const onChange = vi.fn()
    render(<MoneyInput value={0} onChange={onChange} faixa={FAIXA_CUSTO} aria-label="Custo de teste" />)
    fireEvent.change(screen.getByLabelText('Custo de teste'), { target: { value: '25.000,000' } })
    expect(onChange).toHaveBeenCalledWith(25000)
  })

  it('e "1,500" na mesma porta segue gravando 1500 — as duas regras convivem', () => {
    const onChange = vi.fn()
    render(<MoneyInput value={0} onChange={onChange} faixa={FAIXA_CUSTO} aria-label="Custo de teste" />)
    fireEvent.change(screen.getByLabelText('Custo de teste'), { target: { value: '1,500' } })
    expect(onChange).toHaveBeenCalledWith(1500)
  })

  it('o campo de dinheiro CARREGA a dica das duas regras, e um title próprio ganha dela', () => {
    // Marco, 30/08/2026: as duas leituras da mesma vírgula têm de estar
    // escritas no campo — ninguém adivinha qual vale sem a regra na frente.
    const { unmount } = render(<MoneyInput value={0} onChange={() => {}} aria-label="Custo de teste" />)
    const campo = screen.getByLabelText('Custo de teste')
    expect(campo.getAttribute('title')).toBe(DICA_CAMPO_DINHEIRO)
    expect(campo.getAttribute('title')).toMatch(/1\.234,500/)
    expect(campo.getAttribute('title')).toMatch(/1,500/)
    unmount()

    // Um campo que já explica algo mais específico continua mandando.
    render(
      <MoneyInput value={0} onChange={() => {}} title="Realizado do custo." aria-label="Realizado de teste" />
    )
    expect(screen.getByLabelText('Realizado de teste').getAttribute('title')).toBe('Realizado do custo.')
  })
})
