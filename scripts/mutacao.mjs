#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// mutacao.mjs — bateria de mutação dos módulos de cálculo e de DADO SALVO
// (H3-L item 3 → reconstruída na H4-G, PLANO-HARDENING-4.md família F3).
// Node puro, sem dependência nova (não usa Stryker nem nada de npm install) —
// implementa os próprios operadores de mutação com um varredor de texto.
//
// O QUE FAZ: estraga UM número/operador de propósito num módulo (trocar + por
// -, * por /, > por >=, etc.), roda a suíte inteira e pergunta: algum teste
// percebeu? Mutação que nenhum teste pega é um buraco de rede — aquela conta
// pode ficar errada em produção sem ninguém avisar.
//
// ─────────────────── O QUE MUDOU NA H4-G (e por quê) ────────────────────────
//
// 1) RODÍZIO DE VERDADE. Antes, a seleção começava todos os ponteiros em zero
//    e o limite era constante: das 239 mutações candidatas, as MESMAS 40
//    rodavam toda vez, e 83% do calc.js nunca tinha sido medido. Agora a
//    cobertura já exercitada fica PERSISTIDA em MUTACAO-ESTADO.json (arquivo
//    pequeno, versionado) e cada rodada pega pontos AINDA NÃO COBERTOS. Quando
//    o universo inteiro fecha, o ciclo reinicia e a contagem sobe.
//    ONDE A CÓPIA QUE VALE MORA (Marco, 05/10/2026, por questionário: o
//    rodízio guarda o ponto de parada na ramificação `mutacao/estado`; risco
//    aceito: o estado verdadeiro mora fora da main): na esteira semanal, o
//    workflow traz o arquivo de lá ANTES da rodada e grava o novo lá DEPOIS.
//    Este script continua lendo e escrevendo só o arquivo da raiz — quem
//    troca a cópia é o `.github/workflows/mutacao-semanal.yml`. A cópia da
//    `main` só vale para rodada local e para a primeira rodada na esteira. A
//    invalidação por sha (abaixo, em `selecionarMutacoes`) compara com o
//    arquivo do CHECKOUT, então ela vale igual para estado vindo de fora.
//
// 2) ALCANÇA OS ALVOS QUE A AUDITORIA PEDE. Entraram historico.js, protecao.js,
//    storage.js e migracao.js — os quatro que o PLANO-HARDENING-3.md (AUD-1)
//    manda mutar "reusando scripts/mutacao.mjs" e que a ferramenta não
//    alcançava. O varredor foi conferido contra os quatro (têm literais de
//    regex em storage.js e migracao.js) e passou a DECLARAR anomalias em vez
//    de supor que a premissa continua válida — ver "varredor" abaixo.
//
// 3) FALHA DE INFRAESTRUTURA NÃO É MAIS "MORTA". Antes, timeout ou node_modules
//    sem ligação contava como sucesso: um ambiente quebrado devolvia
//    "40 MORTAS, 0 SOBREVIVERAM" — nota máxima, informação zero. Agora existe
//    o estado ERRO, existe um CANÁRIO (a suíte roda LIMPA, sem mutação, antes
//    de começar) e a rodada sai VERMELHA se qualquer ERRO acontecer.
//    UMA exceção, decidida pelo Marco em 12/08/2026 e implementada em
//    05/10/2026: a mutação que TRAVA a suíte (estoura o teto) DEPOIS de o
//    canário ter passado nos dois fusos, com teto ≥ 2× o canário, conta como
//    MORTA-POR-TRAVAMENTO — ver o bloco `classificarTravamento`. Tempo
//    esgotado no próprio canário continua ERRO, sempre.
//
// 4) O JULGAMENTO NÃO MORA MAIS NO ARQUIVO GERADO. Antes, re-rodar sobrescrevia
//    o MUTACAO-RESULTADO.md e apagava o julgamento datado dos sobreviventes,
//    reabrindo achados já fechados. Agora o julgamento vive em
//    MUTACAO-JULGAMENTOS.md — escrito à mão, versionado — e este gerador só LÊ
//    e CRUZA. Sobrevivente sem julgamento é achado ABERTO e derruba a rodada.
//
// 5) DOIS FUSOS, como a regra da casa exige da suíte real. Cada mutação roda em
//    TZ=UTC; quem sobreviver roda DE NOVO em TZ=America/Sao_Paulo. Morta em
//    qualquer um dos dois é morta; SOBREVIVEU significa "sobreviveu nos DOIS".
//    Custo quase zero, porque a esmagadora maioria morre no primeiro fuso.
//
// ───────────────────────── SEGURANÇA (não negociável) ───────────────────────
//
// NUNCA TOCA O WORKING TREE REAL: toda mutação é aplicada dentro de um
// `git worktree` temporário e isolado (checkout separado do MESMO histórico,
// numa pasta fora do repositório). O script nunca escreve em src/lib/*.js do
// repositório onde ele mora — só dentro do worktree, apagado ao final. Isso é
// garantido em código, não por convenção:
//   · toda escrita de mutação usa `caminhoNoWorktree` (derivado de
//     `worktreeDir`, nunca de RAIZ) — RAIZ nunca aparece à esquerda de um
//     writeFileSync que não seja dos três arquivos de relatório/estado;
//   · `criarWorktreeIsolado()` recusa seguir se o caminho gerado for suspeito;
//   · ARMADILHA DE SAÍDA: SIGINT, SIGTERM, SIGHUP, exceção não tratada e o
//     evento `exit` do Node removem o worktree — interromper a bateria no meio
//     não deixa código estragado em lugar nenhum;
//   · CONFERÊNCIA FINAL: a impressão digital de `src/` (git status + sha de
//     cada arquivo-alvo) é tirada ANTES e DEPOIS. Se divergir, a rodada morre
//     com erro alto: a ferramenta teria introduzido no app o defeito que ela
//     só deveria simular, e esse é o pior resultado possível.
//
// ─────────────────────────────── COMO RODAR ─────────────────────────────────
//
//     node scripts/mutacao.mjs             # rodada normal
//     node scripts/mutacao.mjs --simular   # só mostra o que SERIA exercitado
//                                          # (não roda a suíte, não avança o
//                                          #  ponto de parada, não escreve nada)
//
// Variáveis de ambiente:
//     MUTACAO_LIMITE=15   quantas mutações nesta rodada (padrão 40)
//     MUTACAO_TMPDIR=/x   onde nasce o worktree isolado (padrão os.tmpdir())
//     MUTACAO_TEMPO_SUITE_S=300
//                         teto de tempo de UMA rodada da suíte, em segundos
//                         (padrão 300). Estourar aqui é ERRO — exceto na
//                         bateria, depois do canário verde e com teto ≥ 2× o
//                         canário: aí é MORTA-POR-TRAVAMENTO (Marco,
//                         12/08/2026). Era
//                         uma constante enterrada de 180 s, escolhida quando a
//                         suíte custava 73 s no runner; medida em 30/08/2026,
//                         ela custa 124,6 s, e a folga tinha caído de 2,47x
//                         para 1,44x — ver o bloco de conta ao lado da
//                         constante.
//     MUTACAO_ORCAMENTO_MIN=75
//                         ORÇAMENTO DE TEMPO da rodada, em minutos (padrão: sem
//                         orçamento). Antes de cada mutação a bateria olha o
//                         relógio; se o orçamento acabou, ela PARA, escreve o
//                         relatório e o ponto de parada com o que JÁ mediu, e
//                         sai com código 1 dizendo em português que parou por
//                         tempo. Existe porque a alternativa era o teto de
//                         tempo do trabalho na esteira matar a rodada no meio:
//                         o GitHub cancela o trabalho, cancelamento NÃO é
//                         vermelho, e o relatório nunca chega a ser escrito.
//                         Medido em 30/08/2026: as quatro rodadas agendadas de
//                         agosto (03, 10, 17 e 24) morreram exatamente assim —
//                         `cancelled` mudo em 90 min, nada medido, rodízio
//                         parado desde 28/07 em 73 de 444 pontos.
//
// CÓDIGOS DE SAÍDA (a rodada FALHA ALTO, não só escreve uma linha no arquivo):
//     0  tudo medido, e todo sobrevivente já tem julgamento datado
//     1  houve ERRO — a rodada NÃO mediu o que prometeu (ambiente, canário
//        vermelho ou lento, coleta parcial, tempo esgotado SEM canário que
//        sustente MORTA-POR-TRAVAMENTO, orçamento de tempo estourado). Nota
//        máxima nunca sai daqui. Mutante que só trava a suíte NÃO dá mais
//        código 1 — ele é morto (decisão do Marco, 12/08/2026).
//     2  a medição foi válida, mas há sobrevivente SEM julgamento: achado
//        ABERTO, alguém precisa julgar em MUTACAO-JULGAMENTOS.md
// Quando os dois acontecem, sai 1 (não ter medido é pior que ter achado).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, symlinkSync, existsSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const SAIDA = path.join(RAIZ, 'MUTACAO-RESULTADO.md')
const ARQUIVO_JULGAMENTOS = path.join(RAIZ, 'MUTACAO-JULGAMENTOS.md')
const ARQUIVO_ESTADO = path.join(RAIZ, 'MUTACAO-ESTADO.json')

const VERSAO_ESTADO = 1
const MAX_HISTORICO = 20

const LIMITE_PADRAO = 40
const LIMITE_MUTACOES = (() => {
  const bruto = process.env.MUTACAO_LIMITE
  if (bruto === undefined || bruto === '') return LIMITE_PADRAO
  const n = Number(bruto)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `MUTACAO_LIMITE inválido: "${bruto}". Use um inteiro ≥ 1 (ex.: MUTACAO_LIMITE=15).`,
    )
  }
  return n
})()

// A regra da casa exige a suíte verde nos DOIS fusos (scripts/auditoria.sh).
// FUSO_PRIMEIRO é onde toda mutação roda; FUSO_CONFIRMACAO é a segunda opinião
// pedida só a quem sobreviveu no primeiro.
const FUSO_PRIMEIRO = 'UTC'
const FUSO_CONFIRMACAO = 'America/Sao_Paulo'

// TETO DE TEMPO DE **UMA** RODADA DA SUÍTE (não da rodada inteira — esse é o
// MUTACAO_ORCAMENTO_MIN, logo abaixo). Estourar aqui no CANÁRIO é ERRO. Na
// bateria, depois do canário verde e com este teto ≥ 2× a duração do canário,
// é MORTA-POR-TRAVAMENTO (Marco, 12/08/2026); abaixo de 2× volta a ser ERRO, e
// a mutação volta na próxima rodada.
//
// ESTE NÚMERO ENVELHECEU CALADO, e foi medido em 30/08/2026 na primeira rodada
// completa desde 28/07. Ele foi escolhido quando uma rodada da suíte custava
// ~73 s no runner do GitHub — 180 s era **2,47× de folga**. Hoje a suíte custa
// **124,6 s** (média medida entre as 9 mutações que a rodada conseguiu medir;
// o canário, que roda a suíte duas vezes, deu 128,5 s cada). Folga de hoje:
// **1,44×**, ou seja 44%.
//
// O QUE 44% DE FOLGA PRODUZIU, na rodada 33299587429: da mutação 10 em diante,
// **onze seguidas** saíram ERRO, todas com o mesmo "tempo esgotado (180s)", e a
// rodada NUNCA se recuperou — 9 medidas, 11 não. A mutação 10
// (`comparacaoCustos.js:232`) é um travador conhecido, já registrado no
// BACKLOG; ela deixou processos órfãos vivos no runner (seis chegaram ao fim do
// trabalho: dois grupos de `node (vitest)` + `esbuild` + worker), e com dois
// núcleos disputados uma suíte de 125 s passa de 180 s com folga.
//
// Em 27/07/2026 o MESMO travador apareceu e a rodada se recuperou — porque lá a
// suíte custava 73 s e ainda cabia embaixo dos 180 mesmo degradada.
//
// A ESCOLHA: 300 s devolve a folga original (2,41×). O custo é o pior caso
// subir — 20 mutações travadas dariam 104 min —, e quem segura esse pior caso é
// o MUTACAO_ORCAMENTO_MIN: ele para a rodada, escreve o relatório e sai
// vermelho dizendo por quê. Um teto de suíte generoso com um orçamento de
// rodada apertado é a combinação certa; o contrário é o que estava aqui.
//
// O CONSERTO DE RAIZ DOS ÓRFÃOS entrou em 05/10/2026: a suíte nasce num grupo
// de processos próprio e o teto mata o GRUPO inteiro (`executarComTeto`), não
// só o filho direto, como o `spawnSync` fazia. O teste local que prova a
// limpeza roda um processo que trava com um neto que também trava; a prova no
// runner é a próxima rodada agendada (o tempo da suíte DEPOIS do travador deve
// voltar a ficar perto do de antes, em vez dos +45% de 30/08).
const TETO_MAXIMO_DO_RELOGIO_S = Math.floor(2147483647 / 1000)
const TEMPO_LIMITE_SUITE_S = (() => {
  const bruto = process.env.MUTACAO_TEMPO_SUITE_S
  if (bruto === undefined || bruto === '') return 300
  const n = Number(bruto)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `MUTACAO_TEMPO_SUITE_S inválido: "${bruto}". Use segundos, número maior que zero (ex.: MUTACAO_TEMPO_SUITE_S=300).`,
    )
  }
  // O relógio do Node (`setTimeout`) não passa de 2.147.483.647 ms; acima
  // disso ele dispara em 1 ms, e TODA suíte sairia como tempo esgotado.
  // Achado do revisor adversarial no PR #99 (05/10/2026).
  if (n > TETO_MAXIMO_DO_RELOGIO_S) {
    throw new Error(
      `MUTACAO_TEMPO_SUITE_S grande demais: "${bruto}". O máximo é ${TETO_MAXIMO_DO_RELOGIO_S} s (o limite do relógio do Node, ~24,8 dias); acima disso o teto dispararia na hora.`,
    )
  }
  return n
})()
const TEMPO_LIMITE_SUITE_MS = TEMPO_LIMITE_SUITE_S * 1000

// Orçamento de tempo da RODADA (ver o cabeçalho). Sem a variável, não há
// orçamento e nada muda em relação ao comportamento de sempre.
const ORCAMENTO_RODADA_MIN = (() => {
  const bruto = process.env.MUTACAO_ORCAMENTO_MIN
  if (bruto === undefined || bruto === '') return null
  const n = Number(bruto)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `MUTACAO_ORCAMENTO_MIN inválido: "${bruto}". Use minutos, número maior que zero (ex.: MUTACAO_ORCAMENTO_MIN=75).`,
    )
  }
  return n
})()
const ORCAMENTO_RODADA_MS = ORCAMENTO_RODADA_MIN == null ? null : ORCAMENTO_RODADA_MIN * 60000

// Ordem fixa — decide a distribuição round-robin do rodízio. Os 8 primeiros são
// os módulos de cálculo (herdados da H3-L); os 4 últimos são os módulos de DADO
// SALVO que a AUD-1 manda mutar e que a ferramenta não alcançava.
const ARQUIVOS_DECLARADOS = [
  'calc.js',
  'fechamento.js',
  'planoFinanceiro.js',
  'dre.js',
  'comparacaoCustos.js',
  'receitaLiquida.js',
  'precoLote.js',
  'simulador.js',
  'historico.js',
  'protecao.js',
  'storage.js',
  'migracao.js',
]
const ARQUIVOS_ALVO = ARQUIVOS_DECLARADOS.filter((f) => existsSync(path.join(RAIZ, 'src/lib', f)))
const ARQUIVOS_AUSENTES = ARQUIVOS_DECLARADOS.filter((f) => !ARQUIVOS_ALVO.includes(f))

// ───────────────────────── utilidades de linha ─────────────────────────────

function indiceDeLinhas(texto) {
  const offs = [0]
  for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') offs.push(i + 1)
  return offs
}

function linhaNoOffset(offs, pos) {
  let lo = 0
  let hi = offs.length - 1
  let r = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offs[mid] <= pos) {
      r = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return r + 1
}

function sha(texto) {
  return createHash('sha256').update(texto).digest('hex').slice(0, 16)
}

// ───────────────── varredor de pontos de mutação ───────────────────────────
//
// Não é um parser de JS — é um varredor de texto que sabe pular strings
// ('..',"..",`..`), comentários (// e /* */) e literais de regex (/…/flags)
// para não propor mutação em texto que não é código executável, e que distingue
// identificador/número/`)`/`]` (contexto de DIVISÃO) de pontuação/palavra-chave
// (contexto de INÍCIO DE REGEX).
//
// PREMISSA QUE JÁ EXPIROU UMA VEZ: a versão H3-L dizia "os únicos literais de
// regex vivem em planoFinanceiro.js". Isso era verdade sobre 8 arquivos e
// deixou de ser quando entraram storage.js (`.replace(/[:.]/g, '-')`) e
// migracao.js (DECIMAL_NUMERICO, DATA_ISO_RE). Premissa sobre CONTEÚDO expira
// sem avisar; premissa sobre FORMA, não. A regra de agora é sobre forma:
// um `/` inicia regex quando o último token significativo foi pontuação ou
// palavra-chave, e é divisão quando foi identificador/número/`)`/`]`.
//
// E o varredor DECLARA ANOMALIA quando a leitura não fecha (string sem
// fechamento, comentário de bloco aberto, `/` que abriu regex e a linha acabou
// antes do fechamento). Toda anomalia aparece no relatório — a alternativa é
// o varredor pular um trecho de código de verdade em silêncio, que é o defeito
// que este projeto existe para não ter.
//
// Operadores reconhecidos (mínimos, determinísticos):
//   +  → -        (e -  → +)
//   *  → /
//   >  → >=
//   <  → <=
//   === → !==
//   Math.round → Math.floor
//
// Nunca gera candidato dentro de: strings, comentários, literais de regex.
// Nunca mutila token composto: ++, --, +=, -=, **, *=, /=, >=, <=, >>, <<, =>.

const PALAVRAS_CHAVE_ANTES_DE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'yield', 'await', 'case', 'else', 'do',
])

function lerString(texto, pos) {
  const aspas = texto[pos]
  const n = texto.length
  let j = pos + 1
  while (j < n && texto[j] !== aspas) {
    if (texto[j] === '\\' && j + 1 < n) {
      j += 2
      continue
    }
    j++
  }
  if (j >= n) return { fim: n, anomalia: 'string sem fechamento até o fim do arquivo' }
  return { fim: Math.min(j + 1, n), anomalia: null }
}

function lerRegex(texto, pos) {
  const n = texto.length
  let j = pos + 1
  let dentroDeClasse = false
  let fechou = false
  while (j < n) {
    const c = texto[j]
    if (c === '\\' && j + 1 < n) {
      j += 2
      continue
    }
    if (c === '[') {
      dentroDeClasse = true
      j++
      continue
    }
    if (c === ']') {
      dentroDeClasse = false
      j++
      continue
    }
    if (c === '/' && !dentroDeClasse) {
      j++
      fechou = true
      break
    }
    if (c === '\n') break // regex não atravessa linha — não era regex
    j++
  }
  if (!fechou) {
    return {
      fim: j,
      anomalia:
        'um "/" foi lido como início de literal de regex e a linha acabou sem fechar — o resto da linha NÃO foi varrido em busca de pontos de mutação',
    }
  }
  while (j < n && /[a-z]/i.test(texto[j])) j++
  return { fim: j, anomalia: null }
}

function extrairPontosEAnomalias(texto, nomeArquivo) {
  const pontos = []
  const anomalias = []
  const offs = indiceDeLinhas(texto)
  const n = texto.length
  let i = 0
  let ultimoSignificativo = null // 'ident' | 'kw' | 'punct' | null

  function anotarAnomalia(offset, descricao) {
    anomalias.push({ arquivo: nomeArquivo, linha: linhaNoOffset(offs, offset), descricao })
  }

  function registrar(offsetInicio, offsetFim, original, substituto, operador) {
    pontos.push({
      arquivo: nomeArquivo,
      linha: linhaNoOffset(offs, offsetInicio),
      offsetInicio,
      offsetFim,
      original,
      substituto,
      operador,
    })
  }

  while (i < n) {
    const c = texto[i]

    if (c === "'" || c === '"' || c === '`') {
      const r = lerString(texto, i)
      if (r.anomalia) anotarAnomalia(i, r.anomalia)
      i = r.fim
      ultimoSignificativo = 'ident'
      continue
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < n && texto[i] !== '\n') i++
      continue
    }
    if (c === '/' && texto[i + 1] === '*') {
      const inicio = i
      i += 2
      while (i < n && !(texto[i] === '*' && texto[i + 1] === '/')) i++
      if (i >= n) anotarAnomalia(inicio, 'comentário de bloco /* … */ sem fechamento até o fim do arquivo')
      i += 2
      continue
    }
    if (c === '/' && ultimoSignificativo !== 'ident') {
      const r = lerRegex(texto, i)
      if (r.anomalia) anotarAnomalia(i, r.anomalia)
      i = r.fim
      ultimoSignificativo = 'ident'
      continue
    }

    const idm = /^[A-Za-z_$][\w$]*/.exec(texto.slice(i, i + 60))
    if (idm) {
      const palavra = idm[0]
      if (palavra === 'Math' && texto.slice(i, i + 10) === 'Math.round') {
        const depois = texto[i + 10]
        const limiteOk = depois === undefined || !/[\w$]/.test(depois)
        if (limiteOk) {
          registrar(i, i + 10, 'Math.round', 'Math.floor', 'Math.round → Math.floor')
          i += 10
          ultimoSignificativo = 'ident'
          continue
        }
      }
      ultimoSignificativo = PALAVRAS_CHAVE_ANTES_DE_REGEX.has(palavra) ? 'kw' : 'ident'
      i += palavra.length
      continue
    }

    if (/[0-9]/.test(c)) {
      ultimoSignificativo = 'ident'
      i++
      continue
    }

    if (texto.slice(i, i + 3) === '===') {
      registrar(i, i + 3, '===', '!==', '=== → !==')
      i += 3
      ultimoSignificativo = 'punct'
      continue
    }

    if (c === '+') {
      if (texto[i + 1] === '+' || texto[i + 1] === '=') {
        i += 2
        ultimoSignificativo = 'punct'
        continue
      }
      registrar(i, i + 1, '+', '-', '+ → -')
      i += 1
      ultimoSignificativo = 'punct'
      continue
    }
    if (c === '-') {
      if (texto[i + 1] === '-' || texto[i + 1] === '=') {
        i += 2
        ultimoSignificativo = 'punct'
        continue
      }
      registrar(i, i + 1, '-', '+', '- → +')
      i += 1
      ultimoSignificativo = 'punct'
      continue
    }
    if (c === '*') {
      if (texto[i + 1] === '*' || texto[i + 1] === '=') {
        i += texto[i + 1] === '*' && texto[i + 2] === '=' ? 3 : 2
        ultimoSignificativo = 'punct'
        continue
      }
      registrar(i, i + 1, '*', '/', '* → /')
      i += 1
      ultimoSignificativo = 'punct'
      continue
    }
    if (c === '>') {
      if (texto[i + 1] === '=' || texto[i + 1] === '>' || texto[i - 1] === '=') {
        i += texto[i + 1] === '=' ? 2 : 1
        ultimoSignificativo = 'punct'
        continue
      }
      registrar(i, i + 1, '>', '>=', '> → >=')
      i += 1
      ultimoSignificativo = 'punct'
      continue
    }
    if (c === '<') {
      if (texto[i + 1] === '=' || texto[i + 1] === '<') {
        i += 2
        ultimoSignificativo = 'punct'
        continue
      }
      registrar(i, i + 1, '<', '<=', '< → <=')
      i += 1
      ultimoSignificativo = 'punct'
      continue
    }

    if (c === ')' || c === ']') {
      ultimoSignificativo = 'ident'
      i += 1
      continue
    }
    if (/\s/.test(c)) {
      i += 1
      continue
    }
    ultimoSignificativo = 'punct'
    i += 1
  }

  // Ordinal: desempata dois candidatos do MESMO operador na MESMA linha
  // (acontece de verdade — protecao.js:86 tem dois `===`). É o que dá ao ponto
  // uma identidade estável para o rodízio e para o cruzamento com o julgamento.
  const contagem = new Map()
  for (const p of pontos) {
    const base = `${p.linha}:${p.operador}`
    const idx = contagem.get(base) ?? 0
    contagem.set(base, idx + 1)
    p.ordinal = idx
    p.chave = `${p.linha}:${p.operador}:${idx}`
  }
  // Quantas vezes o MESMO operador aparece na MESMA linha. Sem isso, dois
  // pontos DIFERENTES de uma linha como `bruta + taxa + cashback` (dois `+`)
  // apareciam no relatório com nome idêntico — e uma rodada honesta parecia
  // estar repetindo a rodada anterior.
  for (const p of pontos) p.totalNaLinha = contagem.get(`${p.linha}:${p.operador}`)

  return { pontos, anomalias }
}

/** Nome de um ponto para humano — desambigua operador repetido na mesma linha. */
function rotuloDoPonto(p) {
  const sufixo = p.totalNaLinha > 1 ? ` [${p.ordinal + 1}º de ${p.totalNaLinha} na linha]` : ''
  return `${p.arquivo}:${p.linha} (${p.operador})${sufixo}`
}

/** Igual ao anterior, mas para célula de tabela markdown. */
function sufixoOcorrencia(p) {
  return p.totalNaLinha > 1 ? ` (${p.ordinal + 1}º de ${p.totalNaLinha})` : ''
}

// Compatível com a assinatura antiga (só os pontos).
function extrairPontosDeMutacao(texto, nomeArquivo) {
  return extrairPontosEAnomalias(texto, nomeArquivo).pontos
}

// ───────────────── ponto de parada persistido (o rodízio) ──────────────────
//
// O rodízio não é aleatório nem sorteado por semente: ele é uma FILA. O estado
// guarda, por arquivo, o sha do conteúdo e a lista de pontos já exercitados com
// veredito (MORTA ou SOBREVIVEU). Ponto que deu ERRO NÃO entra na lista — uma
// rodada com ambiente quebrado não pode "gastar" cobertura que ela não mediu.
//
// Se o conteúdo de um arquivo mudar, a cobertura acumulada DELE é zerada e o
// relatório diz isso: as linhas se moveram, o que já foi medido não vale mais.

function lerEstado() {
  if (!existsSync(ARQUIVO_ESTADO)) {
    return { versao: VERSAO_ESTADO, ciclo: 1, rodadas: 0, arquivos: {}, historico: [] }
  }
  let bruto
  try {
    bruto = JSON.parse(readFileSync(ARQUIVO_ESTADO, 'utf8'))
  } catch (e) {
    throw new Error(
      `${ARQUIVO_ESTADO} existe mas não é JSON válido (${e.message}). ` +
        'Apague o arquivo para recomeçar a cobertura do zero — mas saiba que isso ' +
        'joga fora o registro de quais pontos já foram exercitados.',
    )
  }
  if (bruto.versao !== VERSAO_ESTADO) {
    throw new Error(
      `${ARQUIVO_ESTADO} está na versão ${bruto.versao}, e este script fala a versão ${VERSAO_ESTADO}. ` +
        'Não vou adivinhar o formato: apague o arquivo (a cobertura acumulada recomeça) ou escreva a migração.',
    )
  }
  return {
    versao: VERSAO_ESTADO,
    ciclo: Number(bruto.ciclo) || 1,
    rodadas: Number(bruto.rodadas) || 0,
    arquivos: bruto.arquivos && typeof bruto.arquivos === 'object' ? bruto.arquivos : {},
    historico: Array.isArray(bruto.historico) ? bruto.historico : [],
  }
}

function gravarEstado(estado) {
  const corpo = {
    versao: VERSAO_ESTADO,
    _leia:
      'Ponto de parada da bateria de mutação (scripts/mutacao.mjs). Diz quais pontos JÁ foram ' +
      'exercitados, para a rodada seguinte pegar pontos DIFERENTES. Gerado por script — não edite à mão. ' +
      'Apagar este arquivo não quebra nada: só recomeça a cobertura do zero.',
    ciclo: estado.ciclo,
    rodadas: estado.rodadas,
    atualizadoEm: estado.atualizadoEm,
    arquivos: estado.arquivos,
    historico: estado.historico.slice(-MAX_HISTORICO),
  }
  writeFileSync(ARQUIVO_ESTADO, JSON.stringify(corpo, null, 2) + '\n', 'utf8')
}

/**
 * Escolhe os pontos desta rodada: round-robin por arquivo, SEMPRE entre os que
 * ainda não foram exercitados. Devolve também os avisos do que mudou.
 */
function selecionarMutacoes(candidatosPorArquivo, estado, shasAtuais, limite = LIMITE_MUTACOES) {
  const avisos = []

  // 1) invalida a cobertura de arquivo que mudou de conteúdo
  const cobertos = {}
  ARQUIVOS_ALVO.forEach((nome) => {
    const salvo = estado.arquivos[nome]
    if (salvo && salvo.sha === shasAtuais[nome] && Array.isArray(salvo.cobertos)) {
      cobertos[nome] = new Set(salvo.cobertos)
    } else {
      if (salvo && Array.isArray(salvo.cobertos) && salvo.cobertos.length > 0) {
        avisos.push(
          `\`src/lib/${nome}\` mudou de conteúdo desde a última rodada — a cobertura acumulada dele (${salvo.cobertos.length} ponto(s)) foi zerada, porque as linhas se moveram e o que já foi medido não vale mais.`,
        )
      }
      cobertos[nome] = new Set()
    }
  })

  // 2) pendentes por arquivo
  let pendentes = ARQUIVOS_ALVO.map((nome, fi) =>
    candidatosPorArquivo[fi].filter((p) => !cobertos[nome].has(p.chave)),
  )

  // 3) universo inteiro coberto ⇒ o ciclo fecha e recomeça
  let ciclo = estado.ciclo
  let cicloReiniciou = false
  if (pendentes.every((lista) => lista.length === 0)) {
    ciclo += 1
    cicloReiniciou = true
    ARQUIVOS_ALVO.forEach((nome) => cobertos[nome].clear())
    pendentes = candidatosPorArquivo.map((lista) => lista.slice())
    avisos.push(
      `Todos os pontos de mutação do universo já tinham sido exercitados: o ciclo ${estado.ciclo} FECHOU e esta rodada abre o ciclo ${ciclo} do zero.`,
    )
  }

  // 4) round-robin sobre os pendentes
  const selecionados = []
  const ponteiros = ARQUIVOS_ALVO.map(() => 0)
  let progrediu = true
  while (selecionados.length < limite && progrediu) {
    progrediu = false
    for (let fi = 0; fi < ARQUIVOS_ALVO.length; fi++) {
      if (selecionados.length >= limite) break
      const lista = pendentes[fi]
      if (ponteiros[fi] < lista.length) {
        selecionados.push(lista[ponteiros[fi]])
        ponteiros[fi]++
        progrediu = true
      }
    }
  }

  // Para o relatório: ordem por arquivo (na ordem de ARQUIVOS_ALVO) e depois
  // por posição — mais fácil de ler do que a ordem de seleção round-robin.
  const indiceArquivo = new Map(ARQUIVOS_ALVO.map((f, idx) => [f, idx]))
  selecionados.sort((a, b) => {
    const da = indiceArquivo.get(a.arquivo) - indiceArquivo.get(b.arquivo)
    if (da !== 0) return da
    return a.offsetInicio - b.offsetInicio
  })

  return { selecionados, cobertos, ciclo, cicloReiniciou, avisos }
}

// ───────────────── explicação factual por tipo de operador ─────────────────

function explicacaoOperador(operador) {
  switch (operador) {
    case '+ → -':
      return 'Uma soma vira subtração nesta conta. O resultado passa a sair errado pelo dobro do termo somado, na direção contrária.'
    case '- → +':
      return 'Uma subtração vira soma nesta conta. O resultado passa a sair errado pelo dobro do termo subtraído, na direção contrária.'
    case '* → /':
      return 'Uma multiplicação vira divisão nesta conta. A escala do resultado muda de forma drástica (de ×N para ÷N).'
    case '> → >=':
      return 'Um limite estrito ("maior que") passa a incluir o valor exatamente igual ao limite. Um caso de borda que antes caía de um lado passa a cair do outro.'
    case '< → <=':
      return 'Um limite estrito ("menor que") passa a incluir o valor exatamente igual ao limite. Um caso de borda que antes caía de um lado passa a cair do outro.'
    case '=== → !==':
      return 'Uma comparação de igualdade vira o oposto exato (diferença). A condição passa a fazer o inverso do que o código diz.'
    case 'Math.round → Math.floor':
      return 'Arredondamento para o mais próximo vira arredondamento para baixo. Valores com fração ≥ 0,5 saem uma unidade a menos.'
    default:
      return '(operador não catalogado)'
  }
}

// ───────────────────────────── worktree isolado ─────────────────────────────
//
// ARMADILHA DE SAÍDA: o worktree em uso fica registrado aqui em cima para que
// qualquer forma de término (Ctrl-C, kill, exceção, fim normal) o remova.

let worktreeEmUso = null
let armadilhaInstalada = false

function limparWorktreeEmUso(motivo) {
  // Primeiro o grupo da suíte em andamento (ver `executarComTeto`): ele nasce
  // fora do grupo do terminal, então o Ctrl-C não o alcança sozinho.
  if (grupoEmUso != null) {
    matarGrupo(grupoEmUso)
    grupoEmUso = null
  }
  if (!worktreeEmUso) return
  const alvo = worktreeEmUso
  worktreeEmUso = null
  try {
    process.stderr.write(`\n[mutacao] limpando o worktree isolado (${motivo}): ${alvo}\n`)
  } catch {
    /* melhor esforço: stderr pode já estar fechado no evento 'exit' */
  }
  removerWorktreeIsolado(alvo)
}

function instalarArmadilhaDeSaida() {
  if (armadilhaInstalada) return
  armadilhaInstalada = true
  process.on('exit', () => limparWorktreeEmUso('fim do processo'))
  // SIGQUIT (Ctrl-\) entrou em 05/10/2026, achado do revisor do PR #99: com o
  // grupo da suíte fora do grupo do terminal, ele deixava 9 workers órfãos.
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']) {
    process.on(sinal, () => {
      limparWorktreeEmUso(`sinal ${sinal}`)
      process.exit(130)
    })
  }
  process.on('uncaughtException', (e) => {
    limparWorktreeEmUso('exceção não tratada')
    console.error('\n✗ mutacao.mjs abortou por exceção não tratada:')
    console.error(e && e.stack ? e.stack : e)
    process.exit(1)
  })
  process.on('unhandledRejection', (e) => {
    limparWorktreeEmUso('promessa rejeitada sem tratamento')
    console.error('\n✗ mutacao.mjs abortou por promessa rejeitada sem tratamento:')
    console.error(e && e.stack ? e.stack : e)
    process.exit(1)
  })
}

function criarWorktreeIsolado() {
  const base = process.env.MUTACAO_TMPDIR || os.tmpdir()
  const worktreeDir = mkdtempSync(path.join(base, 'previsao-mutacao-'))
  // mkdtempSync já cria a pasta; `git worktree add` recusa pasta não-vazia,
  // então removemos e deixamos o git recriar.
  rmSync(worktreeDir, { recursive: true, force: true })
  execFileSync('git', ['worktree', 'add', '--detach', '--quiet', worktreeDir, 'HEAD'], {
    cwd: RAIZ,
    stdio: 'pipe',
  })
  symlinkSync(path.join(RAIZ, 'node_modules'), path.join(worktreeDir, 'node_modules'), 'dir')
  return worktreeDir
}

function removerWorktreeIsolado(worktreeDir) {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd: RAIZ, stdio: 'pipe' })
  } catch {
    // Se o git recusar (ex.: pasta já sumiu), garante a limpeza do disco e
    // deixa o git esquecer a referência.
    try {
      rmSync(worktreeDir, { recursive: true, force: true })
    } catch {
      /* melhor esforço */
    }
    try {
      execFileSync('git', ['worktree', 'prune'], { cwd: RAIZ, stdio: 'pipe' })
    } catch {
      /* melhor esforço */
    }
  }
}

// ─────────────── impressão digital do src/ real (antes × depois) ────────────

function impressaoDigitalDoSrc() {
  let status = ''
  try {
    status = execFileSync('git', ['status', '--porcelain', '--', 'src'], {
      cwd: RAIZ,
      encoding: 'utf8',
    })
  } catch (e) {
    status = `(git status falhou: ${e.message})`
  }
  const shas = {}
  for (const nome of ARQUIVOS_ALVO) {
    const caminho = path.join(RAIZ, 'src/lib', nome)
    shas[nome] = existsSync(caminho) ? sha(readFileSync(caminho, 'utf8')) : '(ausente)'
  }
  return { status, shas }
}

function conferirSrcIntacto(antes, depois) {
  const divergencias = []
  if (antes.status !== depois.status) {
    divergencias.push(
      `o "git status" de src/ mudou durante a rodada.\n  antes:\n${antes.status || '    (limpo)'}\n  depois:\n${depois.status || '    (limpo)'}`,
    )
  }
  for (const nome of ARQUIVOS_ALVO) {
    if (antes.shas[nome] !== depois.shas[nome]) {
      divergencias.push(
        `src/lib/${nome} mudou de conteúdo (sha ${antes.shas[nome]} → ${depois.shas[nome]}).`,
      )
    }
  }
  return divergencias
}

// ─────────────────────── rodar a suíte e interpretar o JSON ────────────────
//
// Três estados possíveis, NUNCA dois:
//   MORTA      — algum teste falhou por causa da mutação (a rede pegou). Inclui
//                a MORTA-POR-TRAVAMENTO: a suíte travou só com a mutação, depois
//                de o canário limpo ter passado (Marco, 12/08/2026). Quem decide
//                isso NÃO é `rodarSuite` — lá dentro tempo esgotado é sempre
//                ERRO, porque o canário usa a mesma função —, e sim
//                `classificarTravamento`, chamado só pela bateria.
//   SOBREVIVEU — a suíte rodou INTEIRA e passou (a rede não pegou: buraco)
//   ERRO       — a suíte não chegou a medir (ambiente, timeout no canário ou com
//                teto curto demais, coleta parcial)
//
// A versão antiga contava ERRO como MORTA. Isso fazia um ambiente quebrado
// devolver "40 MORTAS, 0 SOBREVIVERAM": nota máxima, informação zero.

const MARCADORES_DE_INFRA = [
  /Cannot find package/i,
  /Cannot find module/i,
  /ERR_MODULE_NOT_FOUND/,
  /MODULE_NOT_FOUND/,
  /command not found/i,
  /could not determine executable to run/i,
  /npm ERR!/,
  /ENOENT/,
  /EACCES/,
  /ENOSPC/,
  /EMFILE/,
  /JavaScript heap out of memory/i,
]

function cheiroDeInfra(texto) {
  for (const re of MARCADORES_DE_INFRA) {
    const m = re.exec(texto)
    if (m) return m[0]
  }
  return null
}

// ─────────── executar a suíte com teto de tempo, matando o GRUPO ───────────
//
// POR QUE NÃO É MAIS `spawnSync` (05/10/2026). Com `timeout`, o `spawnSync`
// mata SÓ o filho direto (`npm exec vitest`); o worker do vitest e o esbuild
// ficam órfãos, vivos, comendo núcleo. Medido na rodada 33302026294
// (30/08/2026): depois do travador `comparacaoCustos.js:232`, a suíte (cada
// rodada com a mutação seguinte aplicada) passou de 128 s para 184 s em média
// pelo resto da rodada — e com teto de 180 s, a
// rodada 33299587429 nunca se recuperou (11 ERROS seguidos). BACKLOG.md,
// seção dos processos órfãos.
//
// O CONSERTO: o filho nasce LÍDER de um grupo de processos próprio
// (`detached: true`), e todo descendente herda o grupo. No teto, a morte vai
// para o GRUPO inteiro (`process.kill(-pid, 'SIGKILL')`, o sinal negativo é
// "o grupo cujo número é pid"). E mesmo quando a suíte termina normal o grupo
// é varrido, para nenhum resto passar de uma mutação para a seguinte.
//
// Consequência de `detached`: o Ctrl-C do terminal deixa de chegar ao grupo,
// porque ele não é mais o grupo do terminal. Por isso o grupo em uso fica
// registrado aqui e a ARMADILHA DE SAÍDA o mata junto com o worktree.

let grupoEmUso = null

// Folga entre o líder sair e o grupo ser varrido, para a saída que ainda está
// no cano chegar inteira. Ver o 'exit' em `executarComTeto`.
const GRACA_DEPOIS_DO_LIDER_MS = 2000

function matarGrupo(pid) {
  try {
    process.kill(-pid, 'SIGKILL')
    return true
  } catch {
    // ESRCH: o grupo já não tem ninguém vivo. É o caso normal depois de uma
    // suíte que terminou sozinha.
    return false
  }
}

/**
 * Roda `comando args` num grupo de processos próprio, com teto de tempo.
 * Nunca rejeita: todo desfecho volta como dado.
 *
 * @returns {Promise<{status:number|null, signal:string|null, stdout:string,
 *            stderr:string, error:{code:string,message:string}|null,
 *            tempoEsgotado:boolean, duracaoMs:number, pid:number|null}>}
 */
function executarComTeto(comando, args, { cwd, env, tetoMs, maxBuffer = 100 * 1024 * 1024 }) {
  return new Promise((resolver) => {
    const inicio = Date.now()
    let stdout = ''
    let stderr = ''
    let tamanho = 0
    let tempoEsgotado = false
    let erro = null
    let terminou = false
    let relogio = null
    let reserva = null
    let graca = null
    // Como o LÍDER (o processo que este spawn criou) saiu, quando saiu. O
    // 'close' só chega quando o cano de saída fecha, e um descendente que
    // herdou o stdout segura o cano depois de o líder sair — por isso a saída
    // do líder é guardada à parte, no 'exit'.
    let saidaDoLider = null

    let filho
    try {
      filho = spawn(comando, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      resolver({
        status: null, signal: null, stdout: '', stderr: '', tempoEsgotado: false, pid: null,
        error: { code: e.code || 'ESPAWN', message: e.message }, duracaoMs: Date.now() - inicio,
      })
      return
    }
    const pid = filho.pid
    if (pid != null) grupoEmUso = pid

    const fechar = (status, signal) => {
      if (terminou) return
      terminou = true
      clearTimeout(relogio)
      clearTimeout(reserva)
      clearTimeout(graca)
      // Vale o que o LÍDER disse ao sair; o 'close' de um cano que um
      // descendente segurou não traz informação melhor.
      if (saidaDoLider) ({ status, signal } = saidaDoLider)
      // Varredura final do grupo: pega descendente que sobrou mesmo quando o
      // líder saiu sozinho.
      if (pid != null) matarGrupo(pid)
      if (grupoEmUso === pid) grupoEmUso = null
      // Quando volta pela rede de 5 s, o cano ainda está aberto do lado de um
      // processo que escapou do grupo: fecha a ponta de cá, para este processo
      // não ficar preso a ele.
      filho.stdout.destroy()
      filho.stderr.destroy()
      resolver({ status, signal, stdout, stderr, error: erro, tempoEsgotado, duracaoMs: Date.now() - inicio, pid })
    }

    // A rede de 5 s: se o 'close' não vier (cano segurado por quem escapou do
    // grupo), volta assim mesmo. Armada uma vez só.
    const armarReserva = () => {
      if (reserva == null) reserva = setTimeout(() => fechar(null, null), 5000)
    }

    const acumular = (qual) => (pedaco) => {
      tamanho += pedaco.length
      if (tamanho > maxBuffer) {
        if (!erro) erro = { code: 'ENOBUFS', message: `saída passou de ${maxBuffer} bytes` }
        if (pid != null) matarGrupo(pid)
        return
      }
      if (qual === 'out') stdout += pedaco
      else stderr += pedaco
    }
    filho.stdout.setEncoding('utf8')
    filho.stderr.setEncoding('utf8')
    filho.stdout.on('data', acumular('out'))
    filho.stderr.on('data', acumular('err'))

    filho.on('error', (e) => {
      if (!erro) erro = { code: e.code || 'ESPAWN', message: e.message }
      // Sem processo não há 'close' garantido.
      if (pid == null) fechar(null, null)
    })
    filho.on('exit', (status, signal) => {
      saidaDoLider = { status, signal }
      // O líder saiu. Se o cano não fechar logo, é um descendente segurando:
      // dois segundos de folga para a saída escoar e o grupo vai embora.
      // E se nem assim o cano fechar (descendente FORA do grupo), a rede de
      // 5 s devolve o que o líder disse — sem esperar o teto inteiro.
      graca = setTimeout(() => {
        matarGrupo(pid)
        armarReserva()
      }, GRACA_DEPOIS_DO_LIDER_MS)
    })
    filho.on('close', (status, signal) => fechar(status, signal))

    relogio = setTimeout(() => {
      // Só é TEMPO ESGOTADO se o líder ainda estava vivo quando o teto
      // disparou. Achado do revisor adversarial no PR #99 (05/10/2026): sem
      // esta pergunta, uma suíte VERDE que saiu com 0 em 0,1 s, mas deixou um
      // neto segurando o stdout, voltava `tempoEsgotado` e virava
      // MORTA-POR-TRAVAMENTO — a suíte não travou, quem travou foi o resto.
      if (saidaDoLider) {
        matarGrupo(pid)
        // A MESMA rede de 5 s do ramo de baixo. Achado da reconferência do PR
        // #99 (05/10/2026): sem ela, um descendente que SAIU do grupo (setsid)
        // e segura o stdout fazia esta promessa nunca terminar — no runner,
        // o cancelamento mudo em 90 min de volta. Volta com o status com que o
        // líder saiu (`fechar` usa `saidaDoLider`), sem tempo esgotado.
        armarReserva()
        return
      }
      tempoEsgotado = true
      if (!erro) erro = { code: 'ETIMEDOUT', message: `tempo esgotado (${tetoMs / 1000}s)` }
      matarGrupo(pid)
      // Se algum descendente tiver escapado do grupo segurando o cano de
      // saída, o 'close' nunca viria. Cinco segundos depois, volta assim mesmo.
      reserva = setTimeout(() => fechar(null, 'SIGKILL'), 5000)
    }, tetoMs)
  })
}

/**
 * @returns {Promise<{estado:'MORTA'|'SOBREVIVEU'|'ERRO', motivo:string|null,
 *            primeiroTesteQueFalhou:string|null, totalTestes:number|null,
 *            tempoEsgotado:boolean, duracaoMs:number}>}
 *
 * `tempoEsgotado: true` quer dizer: a suíte foi morta pelo TETO. Aqui dentro o
 * estado continua ERRO, sem exceção — o CANÁRIO usa esta mesma função, e
 * canário que estoura o teto é ambiente quebrado. Quem pode reclassificar é
 * só a bateria, depois do canário verde (`classificarTravamento`).
 *
 * `opcoes.comando` e `opcoes.tetoMs` existem para o teste poder rodar um
 * comando que trava de propósito com teto curto; a bateria usa o padrão.
 */
async function rodarSuite(worktreeDir, tz, totalTestesEsperado, opcoes = {}) {
  const [comando, args] = opcoes.comando || ['npx', ['vitest', 'run', '--reporter=json']]
  const tetoMs = opcoes.tetoMs ?? TEMPO_LIMITE_SUITE_MS
  const r = await executarComTeto(comando, args, {
    cwd: worktreeDir,
    env: { ...process.env, TZ: tz },
    tetoMs,
  })
  const resultado = await interpretarSuite(r, worktreeDir, totalTestesEsperado, tetoMs)
  return { ...resultado, tempoEsgotado: r.tempoEsgotado === true, duracaoMs: r.duracaoMs }
}

async function interpretarSuite(r, worktreeDir, totalTestesEsperado, tetoMs) {
  const saidaBruta = `${r.stdout || ''}\n${r.stderr || ''}`

  if (r.error) {
    const causa = r.error.code === 'ETIMEDOUT' ? `tempo esgotado (${tetoMs / 1000}s)` : r.error.code || r.error.message
    return {
      estado: 'ERRO',
      motivo: `a suíte nem chegou a terminar: ${causa}. Isso é falha de INFRAESTRUTURA — não conta como mutação morta.`,
      primeiroTesteQueFalhou: null,
      totalTestes: null,
    }
  }
  if (r.signal) {
    return {
      estado: 'ERRO',
      motivo: `a suíte foi morta pelo sinal ${r.signal} (provável tempo esgotado ou falta de memória) — falha de INFRAESTRUTURA, não mutação morta.`,
      primeiroTesteQueFalhou: null,
      totalTestes: null,
    }
  }
  if (r.status === 127) {
    return {
      estado: 'ERRO',
      motivo: 'o comando `npx vitest` não foi encontrado (status 127) — falha de INFRAESTRUTURA.',
      primeiroTesteQueFalhou: null,
      totalTestes: null,
    }
  }

  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }

  if (!json) {
    const marcador = cheiroDeInfra(saidaBruta)
    if (marcador) {
      return {
        estado: 'ERRO',
        motivo: `a suíte não produziu relatório e a saída traz marca de problema de AMBIENTE ("${marcador}") — não é a mutação sendo pega, é a máquina não conseguindo rodar. Confira o node_modules do worktree.`,
        primeiroTesteQueFalhou: null,
        totalTestes: null,
      }
    }
    if (r.status !== 0) {
      return {
        estado: 'MORTA',
        motivo:
          'a suíte não chegou a produzir relatório JSON e saiu com status ≠ 0, sem nenhuma marca de problema de ambiente — o padrão de uma mutação que quebrou a carga do módulo. Conta como MORTA, só sem um teste nomeado.',
        primeiroTesteQueFalhou: null,
        totalTestes: null,
      }
    }
    return {
      estado: 'ERRO',
      motivo:
        'a suíte saiu com status 0 mas o relatório JSON não pôde ser lido. Não dá para afirmar que a mutação sobreviveu sem ter lido o relatório — isso é ERRO, não sobrevivência.',
      primeiroTesteQueFalhou: null,
      totalTestes: null,
    }
  }

  const totalTestes = Number(json.numTotalTests ?? 0)
  const falhados = Number(json.numFailedTests ?? 0)

  if (json.success === false || falhados > 0) {
    let primeiro = null
    for (const arquivo of json.testResults || []) {
      // Âncora em `src/` em vez de path.relative: no macOS os.tmpdir() diz
      // `/var/...` e o vitest reporta `/private/var/...` (symlink) — o
      // relative entre os dois vira uma escada de `../` ilegível no relatório.
      const bruto = arquivo.name || ''
      const idxSrc = bruto.lastIndexOf('src/')
      const nomeCurto = idxSrc >= 0 ? bruto.slice(idxSrc) : path.relative(worktreeDir, bruto)
      for (const teste of arquivo.assertionResults || []) {
        if (teste.status === 'failed') {
          const caminho = [...(teste.ancestorTitles || []), teste.title].join(' > ')
          primeiro = `${nomeCurto} > ${caminho}`
          break
        }
      }
      if (primeiro) break
    }
    return {
      estado: 'MORTA',
      motivo: null,
      primeiroTesteQueFalhou: primeiro || '(suíte falhou, mas não achei o teste específico no relatório)',
      totalTestes,
    }
  }

  // Passou. Antes de chamar de SOBREVIVEU, confere que a suíte rodou INTEIRA —
  // suíte que coletou menos testes que o normal e "passou" é verde falso.
  if (totalTestes === 0) {
    return {
      estado: 'ERRO',
      motivo: 'a suíte relatou sucesso com ZERO testes coletados — não mediu nada. ERRO, nunca sobrevivência.',
      primeiroTesteQueFalhou: null,
      totalTestes,
    }
  }
  if (totalTestesEsperado != null && totalTestes < totalTestesEsperado) {
    return {
      estado: 'ERRO',
      motivo: `a suíte passou, mas coletou ${totalTestes} testes contra os ${totalTestesEsperado} da linha de base (rodada limpa) — ${totalTestesEsperado - totalTestes} teste(s) não rodaram. Verde com menos teste do que o normal não é sobrevivência: é ERRO.`,
      primeiroTesteQueFalhou: null,
      totalTestes,
    }
  }

  return { estado: 'SOBREVIVEU', motivo: null, primeiroTesteQueFalhou: null, totalTestes }
}

// ─────────────── CANÁRIO e MORTA-POR-TRAVAMENTO (decisão de 12/08) ──────────
//
// DECISÃO DO MARCO, 12/08/2026, por questionário (BACKLOG.md, ficha "Mutante
// que TRAVA a suíte nunca ganha veredito"), saída (a): quando a suíte trava SÓ
// com a mutação aplicada e o canário limpo terminou normal na MESMA rodada, o
// ponto conta como MORTO — app congelado é comportamento observável, pior que
// número errado. O risco que ele aceitou: afrouxa "ERRO = não mediu". A trava
// da decisão, e é ela que este bloco implementa: a reclassificação DEPENDE do
// canário. Sem canário verde nesta rodada, tempo esgotado continua ERRO.
//
// Quem expôs o problema: `comparacaoCustos.js:232`, 1º `>` → `>=`, em
// `while (restante > 0 && …)`. Com o resto em zero o `while` reavalia `0 >= 0`
// para sempre — laço infinito síncrono. Antes daqui, ele saía ERRO toda
// semana, a rodada saía com código 1 ("A RODADA NÃO MEDIU") desde 30/08/2026,
// e o ponto nunca era dado por exercitado.
//
// A GUARDA CONTRA SUÍTE SÓ LENTA: o teto tem de ser pelo menos o DOBRO da
// duração do canário (a mais lenta das duas rodadas limpas). Um tempo esgotado
// com teto apertado pode ser só a suíte lenta naquele minuto — runner
// disputado, processo vizinho —, e isso é ambiente, não a mutação. A conta que
// escolheu o 2: a pior degradação por AMBIENTE já medida foi de 45% (128 s →
// 184 s de média, rodada 33302026294, 30/08/2026, com processos órfãos comendo
// núcleo). Não eram rodadas limpas: eram as mutações seguintes ao travador,
// que terminaram normalmente — mas a lentidão vinha dos órfãos, não delas.
// Exigir 2× põe a régua bem acima disso: uma suíte que passou de duas vezes o
// tempo da versão limpa não está lenta, está parada. Com o teto de 300 s e o
// canário de ~128 s do runner, a folga é 2,3× e a régua vale; se a suíte crescer
// até o teto ficar abaixo de 2×, o tempo esgotado volta a ser ERRO — vermelho
// falando, em vez de morte contada sem prova.
const FATOR_MINIMO_TETO_SOBRE_CANARIO = 2

/**
 * Roda o canário (suíte LIMPA nos dois fusos). Tempo esgotado AQUI é sempre
 * ambiente quebrado: nenhuma reclassificação se aplica.
 *
 * @returns {Promise<{erroGlobal:string|null, totalTestesBase:number|null,
 *            duracaoCanarioMs:number|null}>}
 */
async function rodarCanario(worktreeDir, rodar = rodarSuite, escrever = (t) => process.stdout.write(t)) {
  let totalTestesBase = null
  let duracaoCanarioMs = 0
  for (const tz of [FUSO_PRIMEIRO, FUSO_CONFIRMACAO]) {
    escrever(`  TZ=${tz} ... `)
    const r = await rodar(worktreeDir, tz, null)
    escrever(`${r.estado}${r.totalTestes != null ? ` (${r.totalTestes} testes)` : ''}\n`)
    if (r.estado !== 'SOBREVIVEU') {
      return {
        erroGlobal:
          `o CANÁRIO falhou em TZ=${tz}: a suíte LIMPA, sem nenhuma mutação aplicada, não passou. ` +
          `Nada foi medido nesta rodada — nenhum número abaixo vale. ` +
          (r.motivo || 'A suíte tem teste vermelho no HEAD, ou o ambiente não roda a suíte.') +
          ' (Lembre que a bateria enxerga o HEAD COMMITADO, não o working tree.)',
        totalTestesBase: null,
        duracaoCanarioMs: null,
      }
    }
    if (totalTestesBase == null || r.totalTestes < totalTestesBase) totalTestesBase = r.totalTestes
    duracaoCanarioMs = Math.max(duracaoCanarioMs, r.duracaoMs ?? 0)
  }
  return { erroGlobal: null, totalTestesBase, duracaoCanarioMs }
}

/**
 * Reclassifica UM resultado da bateria. Só mexe em ERRO com `tempoEsgotado`, e
 * só quando o canário passou nesta rodada e o teto é ≥ 2× a duração dele.
 * Qualquer outra coisa volta intacta.
 *
 * @param {object} r resultado de `rodarSuite` com a mutação aplicada
 * @param {{erroGlobal:string|null, duracaoCanarioMs:number|null}|null} canario
 *        o retorno de `rodarCanario`; null ou com erroGlobal = canário não passou
 * @param {number} tetoMs teto de UMA rodada da suíte
 */
function classificarTravamento(r, canario, tetoMs) {
  if (r.estado !== 'ERRO' || r.tempoEsgotado !== true) return r
  if (!canario || canario.erroGlobal || !(canario.duracaoCanarioMs > 0)) return r
  const tetoS = tetoMs / 1000
  const canarioS = canario.duracaoCanarioMs / 1000
  if (tetoMs < FATOR_MINIMO_TETO_SOBRE_CANARIO * canario.duracaoCanarioMs) {
    return {
      ...r,
      motivo:
        `${r.motivo} Não virou MORTA-POR-TRAVAMENTO porque o teto (${tetoS.toFixed(0)} s) é menos que ` +
        `${FATOR_MINIMO_TETO_SOBRE_CANARIO}× o canário limpo (${canarioS.toFixed(1)} s): com folga tão curta, ` +
        'tempo esgotado pode ser só a suíte lenta. Suba MUTACAO_TEMPO_SUITE_S.',
    }
  }
  return {
    ...r,
    estado: 'MORTA',
    rotulo: 'MORTA-POR-TRAVAMENTO',
    motivo: null,
    primeiroTesteQueFalhou:
      `(nenhum teste: a suíte TRAVOU — não terminou em ${tetoS.toFixed(0)} s com a mutação, ` +
      `enquanto o canário limpo terminou em ${canarioS.toFixed(1)} s. App congelado conta como morta, ` +
      'decisão do Marco de 12/08/2026)',
  }
}

/**
 * Mede UM ponto já aplicado no worktree: primeiro fuso, confirmação no segundo
 * para quem sobreviveu, e a reclassificação de travamento no veredito final.
 */
async function medirPonto(
  worktreeDir,
  totalTestesBase,
  canario,
  { rodar = rodarSuite, tetoMs = TEMPO_LIMITE_SUITE_MS, escrever = (t) => process.stdout.write(t) } = {},
) {
  let r = await rodar(worktreeDir, FUSO_PRIMEIRO, totalTestesBase)
  let fusoDoVeredito = FUSO_PRIMEIRO
  // Dois fusos: quem sobreviveu no primeiro leva a segunda opinião. Morta em
  // qualquer um dos dois é morta; SOBREVIVEU = sobreviveu nos DOIS.
  if (r.estado === 'SOBREVIVEU') {
    escrever(`sobreviveu em ${FUSO_PRIMEIRO}, conferindo em ${FUSO_CONFIRMACAO} ... `)
    const r2 = await rodar(worktreeDir, FUSO_CONFIRMACAO, totalTestesBase)
    if (r2.estado !== 'SOBREVIVEU') {
      r = r2
      fusoDoVeredito = FUSO_CONFIRMACAO
    } else {
      fusoDoVeredito = `${FUSO_PRIMEIRO} e ${FUSO_CONFIRMACAO}`
    }
  }
  return { ...classificarTravamento(r, canario, tetoMs), fusoDoVeredito }
}

// ─────────────────── julgamentos escritos à mão (leitura) ───────────────────
//
// Formato esperado em MUTACAO-JULGAMENTOS.md (uma seção por ponto julgado):
//
//     ### `dre.js:55` — `> → >=`
//
//     - **Veredito:** EQUIVALENTE
//     - **Data:** 21/07/2026
//     - **Quem:** orquestrador (modelo forte), rodada de 21/07/2026
//     - **Trecho:** `const sinal = v > 0 ? '+' : '−'`
//     - **Motivo:** …
//
// O `Trecho` é o que salva o julgamento quando a linha se move: o cruzamento
// tenta primeiro arquivo+linha+operador e, se não achar, arquivo+operador com
// o mesmo trecho de código — avisando que a linha mudou.

const VEREDITOS_VALIDOS = new Set(['EQUIVALENTE', 'QUASE-EQUIVALENTE', 'TESTE-FALTANDO', 'ACEITO-COM-RISCO'])

function normalizarTrecho(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function lerJulgamentos() {
  if (!existsSync(ARQUIVO_JULGAMENTOS)) {
    return {
      julgamentos: [],
      avisos: [
        `\`MUTACAO-JULGAMENTOS.md\` não existe na raiz do repositório. Sem ele, qualquer sobrevivente conta como achado aberto (o que está correto, mas provavelmente não é o que você queria).`,
      ],
    }
  }
  const texto = readFileSync(ARQUIVO_JULGAMENTOS, 'utf8')
  const linhas = texto.split('\n')
  const julgamentos = []
  const avisos = []
  let atual = null

  // O `#N` é opcional e serve para desambiguar quando o MESMO operador aparece
  // mais de uma vez na mesma linha (`storage.js:93#2`). Sem ele, o julgamento
  // vale para TODAS as ocorrências daquele operador naquela linha — e o
  // relatório avisa, para ninguém fechar dois achados sem querer.
  const reTitulo = /^###\s+`([^`:]+):(\d+)(?:#(\d+))?`\s*[—–-]\s*`?([^`\n]+?)`?\s*$/
  const reCampo = /^\s*-\s*\*\*([^:*]+):?\*\*:?\s*(.*)$/

  const fechar = () => {
    if (!atual) return
    if (!atual.veredito) {
      avisos.push(
        `julgamento de \`${atual.arquivo}:${atual.linha}\` (${atual.operador}) sem o campo **Veredito** — ignorado (o sobrevivente vai continuar contando como achado aberto).`,
      )
    } else if (!VEREDITOS_VALIDOS.has(atual.veredito)) {
      avisos.push(
        `julgamento de \`${atual.arquivo}:${atual.linha}\` (${atual.operador}) tem veredito "${atual.veredito}", que não é um dos aceitos (${[...VEREDITOS_VALIDOS].join(', ')}) — ignorado.`,
      )
    } else if (!atual.data) {
      avisos.push(
        `julgamento de \`${atual.arquivo}:${atual.linha}\` (${atual.operador}) sem o campo **Data** — ignorado. Julgamento sem data não fecha achado (regra da casa: decisão é datada).`,
      )
    } else {
      julgamentos.push(atual)
    }
    atual = null
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const mt = reTitulo.exec(linha)
    if (mt) {
      fechar()
      atual = {
        arquivo: mt[1].trim(),
        linha: Number(mt[2]),
        ocorrencia: mt[3] ? Number(mt[3]) : null,
        operador: mt[4].trim(),
        veredito: null,
        data: null,
        quem: null,
        trecho: null,
        motivo: null,
        usado: false,
      }
      continue
    }
    if (/^##\s/.test(linha) || /^#\s/.test(linha)) {
      fechar()
      continue
    }
    if (!atual) continue
    const mc = reCampo.exec(linha)
    if (!mc) continue
    const campo = mc[1].trim().toLowerCase()
    const valor = mc[2].trim()
    if (campo === 'veredito') atual.veredito = valor.replace(/[`*]/g, '').trim().toUpperCase()
    else if (campo === 'data') atual.data = valor
    else if (campo === 'quem') atual.quem = valor
    else if (campo === 'trecho') atual.trecho = normalizarTrecho(valor.replace(/^`|`$/g, ''))
    else if (campo === 'motivo') atual.motivo = valor
  }
  fechar()

  return { julgamentos, avisos }
}

function casarJulgamento(sobrevivente, julgamentos) {
  const mesmaOcorrencia = (j) => j.ocorrencia == null || j.ocorrencia === sobrevivente.ordinal + 1
  const exato = julgamentos.find(
    (j) =>
      j.arquivo === sobrevivente.arquivo &&
      j.linha === sobrevivente.linha &&
      j.operador === sobrevivente.operador &&
      mesmaOcorrencia(j),
  )
  if (exato) {
    exato.usado = true
    const ambiguo = exato.ocorrencia == null && sobrevivente.totalNaLinha > 1
    return {
      julgamento: exato,
      notaDeCasamento: ambiguo
        ? `o operador \`${sobrevivente.operador}\` aparece ${sobrevivente.totalNaLinha}× nesta linha e o julgamento não diz QUAL — está valendo para todas. Se a intenção era julgar só uma, escreva o título como \`${sobrevivente.arquivo}:${sobrevivente.linha}#${sobrevivente.ordinal + 1}\`.`
        : null,
    }
  }
  const trechoAtual = normalizarTrecho(sobrevivente.trechoLinha)
  const porTrecho = julgamentos.find(
    (j) =>
      j.arquivo === sobrevivente.arquivo &&
      j.operador === sobrevivente.operador &&
      mesmaOcorrencia(j) &&
      j.trecho &&
      j.trecho === trechoAtual,
  )
  if (porTrecho) {
    porTrecho.usado = true
    return {
      julgamento: porTrecho,
      notaDeCasamento: `casado pelo TRECHO de código, não pela linha: o julgamento fala de \`${porTrecho.arquivo}:${porTrecho.linha}\` e o ponto agora está na linha ${sobrevivente.linha}. Atualize o número da linha em MUTACAO-JULGAMENTOS.md.`,
    }
  }
  return { julgamento: null, notaDeCasamento: null }
}

// ───────────────────────────────── main ─────────────────────────────────────

function formatarDuracao(ms) {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const min = Math.floor(s / 60)
  const resto = (s - min * 60).toFixed(0)
  return `${min}min ${resto}s`
}

function commitDoTopo() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim()
  } catch {
    return '(HEAD desconhecido)'
  }
}

async function principal({ simular = false } = {}) {
  const simulacao = simular
  console.log('mutacao.mjs — bateria de mutação (H4-G, PLANO-HARDENING-4.md)')
  console.log(`arquivos-alvo (${ARQUIVOS_ALVO.length}): ${ARQUIVOS_ALVO.join(', ')}`)
  if (ARQUIVOS_AUSENTES.length > 0) {
    console.log(`AVISO: alvos declarados que não existem neste checkout: ${ARQUIVOS_AUSENTES.join(', ')}`)
  }
  console.log('')

  // 1) extrai candidatos de cada arquivo-alvo, a partir do REPOSITÓRIO REAL
  //    (leitura, nunca escrita)
  const candidatosPorArquivo = []
  const totalPorArquivo = []
  const shasAtuais = {}
  const anomaliasDoVarredor = []
  for (const nome of ARQUIVOS_ALVO) {
    const caminho = path.join(RAIZ, 'src/lib', nome)
    const texto = readFileSync(caminho, 'utf8')
    shasAtuais[nome] = sha(texto)
    const { pontos, anomalias } = extrairPontosEAnomalias(texto, nome)
    candidatosPorArquivo.push(pontos)
    totalPorArquivo.push(pontos.length)
    anomaliasDoVarredor.push(...anomalias)
  }
  const totalCandidatos = totalPorArquivo.reduce((a, b) => a + b, 0)

  const estado = lerEstado()
  const { selecionados, cobertos, ciclo, cicloReiniciou, avisos } = selecionarMutacoes(
    candidatosPorArquivo,
    estado,
    shasAtuais,
  )

  const cobertosAntesPorArquivo = {}
  ARQUIVOS_ALVO.forEach((nome) => {
    cobertosAntesPorArquivo[nome] = cobertos[nome].size
  })

  console.log(`pontos de mutação no universo: ${totalCandidatos}`)
  console.log(`já exercitados em rodadas anteriores (ciclo ${ciclo}): ${Object.values(cobertosAntesPorArquivo).reduce((a, b) => a + b, 0)}`)
  console.log(`selecionados para esta rodada (limite ${LIMITE_MUTACOES}, round-robin entre os NÃO cobertos): ${selecionados.length}`)
  ARQUIVOS_ALVO.forEach((nome, idx) => {
    const usados = selecionados.filter((s) => s.arquivo === nome).length
    console.log(
      `  ${nome}: ${totalPorArquivo[idx]} candidatos · ${cobertosAntesPorArquivo[nome]} já cobertos · ${usados} nesta rodada`,
    )
  })
  for (const a of avisos) console.log(`  AVISO: ${a}`)
  for (const a of anomaliasDoVarredor) console.log(`  ANOMALIA DO VARREDOR: ${a.arquivo}:${a.linha} — ${a.descricao}`)
  console.log('')

  if (simulacao) {
    console.log('── SIMULAÇÃO (--simular): a suíte NÃO vai rodar e nada será escrito ──')
    for (const s of selecionados) {
      console.log(`  ${rotuloDoPonto(s)} [chave ${s.chave}]`)
    }
    return { simulacao: true, selecionados }
  }

  const base = {
    totalCandidatos,
    totalPorArquivo,
    cobertosAntesPorArquivo,
    ciclo,
    cicloReiniciou,
    avisos,
    anomaliasDoVarredor,
    commit: commitDoTopo(),
    rodadaNumero: estado.rodadas + 1,
    resultados: [],
    tempoMs: 0,
    erroGlobal: null,
    totalTestesBase: null,
    orcamentoMin: ORCAMENTO_RODADA_MIN,
    orcamentoEstourado: null,
  }

  if (selecionados.length === 0) {
    base.erroGlobal =
      'nenhum ponto de mutação foi selecionado — nada foi medido nesta rodada. Isso não é uma rodada com nota máxima, é uma rodada vazia.'
    return { base, estado, cobertos, shasAtuais }
  }

  // 2) prepara o worktree isolado
  instalarArmadilhaDeSaida()
  const digitalAntes = impressaoDigitalDoSrc()
  console.log('criando worktree isolado (git worktree + symlink de node_modules)...')
  const worktreeDir = criarWorktreeIsolado()
  worktreeEmUso = worktreeDir
  console.log(`worktree: ${worktreeDir}`)
  // Cinto e suspensório: nunca deixar este script escrever na RAIZ real.
  if (worktreeDir === RAIZ || !path.isAbsolute(worktreeDir) || worktreeDir.length < 5) {
    throw new Error(`worktree isolado com caminho suspeito — abortando sem mutar nada: ${worktreeDir}`)
  }
  console.log('')

  const inicio = Date.now()

  try {
    // 3) CANÁRIO: a suíte LIMPA (sem mutação) roda nos dois fusos. Se ela não
    //    passa, a máquina não está medindo nada — e uma rodada que não mede não
    //    pode devolver nota máxima.
    console.log('canário — suíte LIMPA (sem mutação), para provar que o ambiente mede:')
    const canario = await rodarCanario(worktreeDir)
    if (canario.erroGlobal) {
      base.erroGlobal = canario.erroGlobal
      console.log('')
      console.log(`✗ ${base.erroGlobal}`)
      base.tempoMs = Date.now() - inicio
      return { base, estado, cobertos, shasAtuais, digitalAntes, worktreeDir }
    }
    const { totalTestesBase } = canario
    base.totalTestesBase = totalTestesBase
    console.log(`  linha de base: ${totalTestesBase} testes coletados. Rodada abaixo exige esse mesmo total.`)
    const fator = TEMPO_LIMITE_SUITE_MS / canario.duracaoCanarioMs
    console.log(
      `  canário levou ${formatarDuracao(canario.duracaoCanarioMs)} (o mais lento dos dois fusos); teto ${TEMPO_LIMITE_SUITE_S} s = ${fator.toFixed(2)}×. ` +
        (fator >= FATOR_MINIMO_TETO_SOBRE_CANARIO
          ? 'Mutação que estourar o teto conta como MORTA-POR-TRAVAMENTO.'
          : `Abaixo de ${FATOR_MINIMO_TETO_SOBRE_CANARIO}×: tempo esgotado continua ERRO nesta rodada.`),
    )
    console.log('')

    // 4) a bateria
    let contador = 0
    for (const ponto of selecionados) {
      // ORÇAMENTO DE TEMPO: olhado ANTES de começar mais uma, nunca no meio de
      // uma. Parar entre duas mutações deixa o worktree no estado do HEAD e o
      // relatório íntegro; ser morto no meio de uma não deixa nem uma coisa nem
      // outra — foi o que aconteceu nas quatro rodadas agendadas de agosto.
      if (ORCAMENTO_RODADA_MS != null && Date.now() - inicio >= ORCAMENTO_RODADA_MS) {
        base.orcamentoEstourado = {
          orcamentoMin: ORCAMENTO_RODADA_MIN,
          medidas: contador,
          prometidas: selecionados.length,
          decorridoMs: Date.now() - inicio,
        }
        console.log('')
        console.log(
          `⏱ ORÇAMENTO DE TEMPO ESGOTADO (${ORCAMENTO_RODADA_MIN} min): parando com ${contador} de ${selecionados.length} pontos exercitados.`,
        )
        console.log(
          '  O relatório e o ponto de parada do rodízio vão ser escritos com o que ESTA rodada mediu —',
        )
        console.log(
          '  os pontos que sobraram continuam marcados como NÃO exercitados e voltam na próxima rodada.',
        )
        break
      }
      contador++
      const caminhoNoWorktree = path.join(worktreeDir, 'src/lib', ponto.arquivo)
      const caminhoRelativoGit = path.posix.join('src/lib', ponto.arquivo)

      const original = readFileSync(caminhoNoWorktree, 'utf8')
      const mutado = original.slice(0, ponto.offsetInicio) + ponto.substituto + original.slice(ponto.offsetFim)
      writeFileSync(caminhoNoWorktree, mutado, 'utf8')

      process.stdout.write(
        `[${contador}/${selecionados.length}] ${rotuloDoPonto(ponto)} ... `,
      )

      const { fusoDoVeredito, ...r } = await medirPonto(worktreeDir, totalTestesBase, canario)
      console.log(r.rotulo || r.estado)
      if (r.estado === 'ERRO') console.log(`      ↳ ${r.motivo}`)
      if (r.rotulo === 'MORTA-POR-TRAVAMENTO') console.log(`      ↳ ${r.primeiroTesteQueFalhou}`)

      // Sempre volta ao estado do HEAD antes da próxima mutação — nunca
      // acumula mutações. Fonte da verdade é o git, não a string em memória.
      execFileSync('git', ['checkout', '--quiet', '--', caminhoRelativoGit], { cwd: worktreeDir })

      // linha de código original (pro relatório e pro cruzamento com julgamento)
      const linhasOriginal = original.split('\n')
      const trechoLinha = (linhasOriginal[ponto.linha - 1] ?? '').trim()

      base.resultados.push({ ...ponto, ...r, fusoDoVeredito, trechoLinha })
    }
  } finally {
    console.log('')
    console.log('removendo worktree isolado...')
    limparWorktreeEmUso('fim da bateria')
  }

  base.tempoMs = Date.now() - inicio
  return { base, estado, cobertos, shasAtuais, digitalAntes }
}

// ─────────────────────────── relatório em markdown ──────────────────────────

const TEXTO_AGENDAMENTO = [
  '## Onde esta bateria roda sozinha',
  '',
  'O Marco decidiu em **25/07/2026** (item 13 do `DECISOES-MARCO-H4.md`) que esta bateria roda',
  'em **agendamento semanal**, não a cada envio. O passo existe desde 27/07/2026:',
  '`.github/workflows/mutacao-semanal.yml`, toda segunda às 09:00 UTC, mais o botão de rodar',
  'agora. **Quem manda no comportamento é aquele arquivo** — o cabeçalho dele explica o que cada',
  'código de saída faz com o trabalho (1 fica vermelho; 2 fica verde com aviso). Este texto não',
  'repete o passo a passo de propósito: a versão anterior descrevia um workflow "que ainda falta',
  'criar" dois meses depois de ele existir.',
  '',
  '**O ponto de parada não depende do pull request** (Marco, 05/10/2026, por questionário: o',
  'rodízio guarda o ponto de parada na ramificação `mutacao/estado`; risco aceito: o estado',
  'verdadeiro mora fora da main). O workflow lê o `MUTACAO-ESTADO.json` de lá antes da rodada e',
  'grava o novo lá depois. O pull request semanal é só a página do relatório.',
  '',
]

function renderizarMarkdown(ctx) {
  const {
    totalCandidatos,
    totalPorArquivo,
    cobertosAntesPorArquivo,
    ciclo,
    avisos,
    anomaliasDoVarredor,
    commit,
    rodadaNumero,
    resultados,
    tempoMs,
    erroGlobal,
    totalTestesBase,
    orcamentoEstourado,
    julgamentos,
    avisosJulgamento,
    historico,
    fimEm,
  } = ctx

  const linhas = []
  const mortas = resultados.filter((r) => r.estado === 'MORTA')
  const sobreviventes = resultados.filter((r) => r.estado === 'SOBREVIVEU')
  const erros = resultados.filter((r) => r.estado === 'ERRO')

  const semJulgamento = sobreviventes.filter((s) => !s.julgamento)
  const comJulgamento = sobreviventes.filter((s) => s.julgamento)

  linhas.push('# MUTAÇÃO — resultado da última rodada (gerado)')
  linhas.push('')
  linhas.push('> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/mutacao.mjs` e')
  linhas.push('> reescrito por inteiro a cada rodada. O que precisa SOBREVIVER a uma re-rodada — o')
  linhas.push('> julgamento datado de cada sobrevivente — mora em **`MUTACAO-JULGAMENTOS.md`**, que é')
  linhas.push('> escrito à mão e versionado; este gerador só o LÊ e cruza. O ponto de parada do')
  linhas.push('> rodízio mora em `MUTACAO-ESTADO.json` — e, na esteira semanal, a cópia que vale é a da')
  linhas.push('> ramificação `mutacao/estado`, não a da `main` (Marco, 05/10/2026).')
  linhas.push('>')
  linhas.push('> **O que a bateria faz:** aplica mutações mínimas e determinísticas (trocar `+` por')
  linhas.push('> `-`, `*` por `/`, `>` por `>=`, `<` por `<=`, `===` por `!==`, `Math.round` por')
  linhas.push('> `Math.floor`) nos módulos de cálculo e de dado salvo, UMA de cada vez, e roda a')
  linhas.push('> suíte inteira para ver se algum teste morre.')
  linhas.push('>')
  linhas.push('> **Como rodar de novo:**')
  linhas.push('>')
  linhas.push('>     node scripts/mutacao.mjs             # rodada normal')
  linhas.push('>     node scripts/mutacao.mjs --simular   # só mostra o que SERIA exercitado')
  linhas.push('>')
  linhas.push('> **Rodízio:** cada rodada exercita pontos que ainda NÃO foram exercitados. O que já')
  linhas.push('> rodou fica em `MUTACAO-ESTADO.json`; quando o universo inteiro fecha, o ciclo')
  linhas.push('> reinicia. Duas rodadas seguidas nunca medem o mesmo conjunto.')
  linhas.push('>')
  linhas.push('> **Três estados, nunca dois.** `MORTA` = algum teste gritou. `SOBREVIVEU` = a suíte')
  linhas.push('> rodou inteira e passou (buraco de rede). **`ERRO`** = a suíte não chegou a medir')
  linhas.push('> (ambiente, tempo esgotado no canário, coleta parcial) — e ERRO **nunca** conta como')
  linhas.push('> morta. **`MORTA-POR-TRAVAMENTO`** é a única ponte (Marco, 12/08/2026): a suíte TRAVOU')
  linhas.push('> só com a mutação, o canário limpo dos dois fusos passou na mesma rodada e o teto é')
  linhas.push(`> pelo menos ${FATOR_MINIMO_TETO_SOBRE_CANARIO}× a duração dele — app congelado é comportamento observável. Uma`)
  linhas.push('> rodada com qualquer ERRO sai VERMELHA: código de saída 1. Sobrevivente sem')
  linhas.push('> julgamento sai com código 2. Verde só quando tudo foi medido e todo sobrevivente')
  linhas.push('> tem julgamento datado.')
  linhas.push('>')
  linhas.push(`> **Dois fusos.** Toda mutação roda em \`TZ=${FUSO_PRIMEIRO}\`; quem sobrevive roda DE NOVO em`)
  linhas.push(`> \`TZ=${FUSO_CONFIRMACAO}\`. Morta em qualquer um dos dois é morta; \`SOBREVIVEU\` significa`)
  linhas.push('> "sobreviveu nos DOIS". A confirmação custa quase nada porque quase tudo morre no')
  linhas.push('> primeiro fuso — e fecha a exigência da casa de não medir num fuso só.')
  linhas.push('>')
  linhas.push('> **Canário.** Antes de mutar qualquer coisa, a suíte roda LIMPA nos dois fusos. Se ela')
  linhas.push('> não passa, a rodada morre ali e diz que não mediu nada, em vez de devolver nota')
  linhas.push('> máxima com o ambiente quebrado.')
  linhas.push('>')
  linhas.push('> **Nunca toca o working tree real.** Toda mutação acontece dentro de um `git worktree`')
  linhas.push('> temporário e isolado (checkout separado do mesmo histórico, numa pasta fora do')
  linhas.push('> repositório — por padrão `os.tmpdir()`, ajustável com `MUTACAO_TMPDIR`). Uma')
  linhas.push('> armadilha de saída (SIGINT/SIGTERM/SIGHUP/SIGQUIT/exceção/fim) remove o worktree mesmo se a')
  linhas.push('> bateria for interrompida no meio, e a impressão digital de `src/` é conferida antes')
  linhas.push('> e depois: se divergir, a rodada morre com erro alto.')
  linhas.push('>')
  linhas.push('> **A bateria enxerga o HEAD COMMITADO, não o working tree:** o worktree destacado nasce')
  linhas.push('> de `HEAD`, então teste novo ainda não commitado NÃO conta para matar mutação — commite')
  linhas.push('> o teste e re-rode. (Pegadinha vivida em 21/07/2026: dois testes-de-matar recém-escritos')
  linhas.push('> "não mataram nada" até serem commitados.)')
  linhas.push('>')
  linhas.push('> **Sobrevivente não é para consertar aqui.** Fórmula é portão do Marco (princípios 1 e 8')
  linhas.push('> do CLAUDE.md) — este relatório LISTA buracos de rede; a decisão do que fazer com cada')
  linhas.push('> um é de quem lê, e o registro dessa decisão vai para `MUTACAO-JULGAMENTOS.md`.')
  linhas.push('')

  linhas.push(
    `Rodada **nº ${rodadaNumero}** · ciclo **${ciclo}** · commit \`${commit}\` · ${fimEm} · tempo: **${formatarDuracao(tempoMs)}**.`,
  )
  linhas.push('')

  if (erroGlobal) {
    linhas.push('## ✗ ESTA RODADA NÃO MEDIU NADA')
    linhas.push('')
    linhas.push(erroGlobal)
    linhas.push('')
    linhas.push(
      '**Não leia nenhum número abaixo como resultado.** Uma rodada que não mediu não pode parecer uma rodada com nota máxima — foi exatamente esse o defeito consertado na H4-G.',
    )
    linhas.push('')
  }

  if (orcamentoEstourado) {
    const { orcamentoMin, medidas, prometidas, decorridoMs } = orcamentoEstourado
    linhas.push('## ⏱ ESTA RODADA PAROU NO ORÇAMENTO DE TEMPO — ela é PARCIAL')
    linhas.push('')
    linhas.push(
      `A rodada tinha ${prometidas} ponto(s) selecionado(s) e exercitou **${medidas}**. O orçamento de **${orcamentoMin} min** acabou (${formatarDuracao(decorridoMs)} decorridos) e a bateria parou entre duas mutações, de propósito.`,
    )
    linhas.push('')
    linhas.push(
      `**Os números abaixo valem para os ${medidas} pontos exercitados, e para mais nenhum.** Não leia o placar como nota da rodada inteira: os ${prometidas - medidas} que sobraram continuam marcados como NÃO exercitados e voltam na próxima rodada.`,
    )
    linhas.push('')
    linhas.push(
      'Isto sai **vermelho** (código 1) de propósito: a rodada não mediu o que prometeu. O que ela NÃO faz mais é morrer calada — até 30/08/2026 quem estourava o tempo era o teto do trabalho na esteira, o GitHub marcava a rodada como `cancelled`, cancelamento não é vermelho, e o relatório nunca chegava a ser escrito. As quatro rodadas agendadas de agosto (03, 10, 17 e 24) morreram assim.',
    )
    linhas.push('')
    linhas.push(
      `**O que fazer:** se o tempo por mutação subiu porque a suíte cresceu, baixe \`MUTACAO_LIMITE\` em \`.github/workflows/mutacao-semanal.yml\` com a medição nova ao lado — nunca por chute. Se subiu por outro motivo, é ele que precisa aparecer aqui.`,
    )
    linhas.push('')
  }

  if (ARQUIVOS_AUSENTES.length > 0) {
    linhas.push(
      `> **Aviso:** alvos declarados que não existem neste checkout e ficaram de fora: ${ARQUIVOS_AUSENTES.map((f) => `\`${f}\``).join(', ')}.`,
    )
    linhas.push('')
  }

  const jaCobertos = Object.values(cobertosAntesPorArquivo).reduce((a, b) => a + b, 0)
  const medidosAgora = resultados.filter((r) => r.estado !== 'ERRO').length
  const rodadasQueFaltam = Math.ceil(Math.max(0, totalCandidatos - jaCobertos - medidosAgora) / LIMITE_MUTACOES)

  linhas.push('## Cobertura — o rodízio')
  linhas.push('')
  linhas.push(
    `Universo de pontos de mutação: **${totalCandidatos}**. Já exercitados antes desta rodada (ciclo ${ciclo}): **${jaCobertos}**. Exercitados com veredito agora: **${medidosAgora}**. Faltam **${totalCandidatos - jaCobertos - medidosAgora}** para fechar o ciclo — cerca de **${rodadasQueFaltam}** rodada(s) no ritmo de ${LIMITE_MUTACOES} por rodada.`,
  )
  linhas.push('')
  linhas.push('| Arquivo | Candidatos | Cobertos antes | Nesta rodada | Cobertos depois |')
  linhas.push('|---|---:|---:|---:|---:|')
  ARQUIVOS_ALVO.forEach((nome, idx) => {
    const nesta = resultados.filter((r) => r.arquivo === nome).length
    const medidosNesta = resultados.filter((r) => r.arquivo === nome && r.estado !== 'ERRO').length
    linhas.push(
      `| src/lib/${nome} | ${totalPorArquivo[idx]} | ${cobertosAntesPorArquivo[nome]} | ${nesta} | ${cobertosAntesPorArquivo[nome] + medidosNesta} |`,
    )
  })
  linhas.push(
    `| **Total** | **${totalCandidatos}** | **${jaCobertos}** | **${resultados.length}** | **${jaCobertos + medidosAgora}** |`,
  )
  linhas.push('')

  for (const a of avisos) {
    linhas.push(`> ${a}`)
    linhas.push('')
  }

  linhas.push('## Resultado')
  linhas.push('')
  linhas.push(
    `**${mortas.length} MORTA${mortas.length === 1 ? '' : 'S'}** (algum teste gritou) · **${sobreviventes.length} ${sobreviventes.length === 1 ? 'SOBREVIVEU' : 'SOBREVIVERAM'}** (nenhum teste gritou) · **${erros.length} ERRO${erros.length === 1 ? '' : 'S'}** (não chegou a medir).`,
  )
  if (totalTestesBase != null) {
    linhas.push('')
    linhas.push(
      `Linha de base do canário: **${totalTestesBase} testes** coletados na suíte limpa. Toda rodada abaixo que "passou" com menos testes que isso foi classificada como ERRO, não como sobrevivência.`,
    )
  }
  linhas.push('')

  if (erros.length > 0) {
    linhas.push('## ✗ ERROS — o que esta rodada NÃO conseguiu medir')
    linhas.push('')
    linhas.push(
      `${erros.length} mutação(ões) não produziram veredito: a suíte não rodou, rodou pela metade ou não pôde ser lida. **Isto não é sucesso e não conta como morta.** Estes pontos continuam marcados como NÃO exercitados — a próxima rodada tenta de novo.`,
    )
    linhas.push('')
    for (const e of erros) {
      linhas.push(`- \`${e.arquivo}:${e.linha}\`${sufixoOcorrencia(e)} — ${e.operador} — ${e.motivo}`)
    }
    linhas.push('')
  }

  linhas.push('## SOBREVIVENTES')
  linhas.push('')
  if (sobreviventes.length === 0) {
    linhas.push('Nenhum. Toda mutação exercitada nesta rodada foi pega por algum teste, nos dois fusos.')
    linhas.push('')
  } else {
    linhas.push(
      `${sobreviventes.length} mutação(ões) não fizeram nenhum teste falhar, em nenhum dos dois fusos. Cada uma é um buraco de rede: uma dessas contas pode ficar errada em produção sem nenhum teste avisar.`,
    )
    linhas.push('')

    if (semJulgamento.length > 0) {
      linhas.push(`### ⚠ ACHADOS ABERTOS — ${semJulgamento.length} sobrevivente(s) SEM julgamento`)
      linhas.push('')
      linhas.push(
        'Estes não têm decisão registrada em `MUTACAO-JULGAMENTOS.md`. Enquanto estiverem assim, a bateria sai com código 2. Julgar é escrever no arquivo à mão: EQUIVALENTE (a mutação não muda comportamento observável), QUASE-EQUIVALENTE (só diverge numa fronteira de medida zero), TESTE-FALTANDO (é buraco real — escreva o teste) ou ACEITO-COM-RISCO (decisão datada de quem pode decidir).',
      )
      linhas.push('')
      for (const s of semJulgamento) {
        linhas.push(`#### \`${s.arquivo}:${s.linha}\`${sufixoOcorrencia(s)} — ${s.operador}`)
        linhas.push('')
        linhas.push('```js')
        linhas.push(s.trechoLinha || '(linha vazia ou não capturada)')
        linhas.push('```')
        linhas.push('')
        linhas.push(`O que muda: ${explicacaoOperador(s.operador)}`)
        linhas.push('')
      }
    }

    if (comJulgamento.length > 0) {
      linhas.push(`### Sobreviventes JÁ julgados — ${comJulgamento.length}`)
      linhas.push('')
      linhas.push('Rede conhecida: alguém olhou, decidiu e datou. O texto completo está em `MUTACAO-JULGAMENTOS.md`.')
      linhas.push('')
      linhas.push('| Ponto | Mutação | Veredito | Data | Quem |')
      linhas.push('|---|---|---|---|---|')
      for (const s of comJulgamento) {
        linhas.push(
          `| \`${s.arquivo}:${s.linha}\`${sufixoOcorrencia(s)} | \`${s.operador}\` | ${s.julgamento.veredito} | ${s.julgamento.data} | ${(s.julgamento.quem || '—').replace(/\|/g, '\\|')} |`,
        )
      }
      linhas.push('')
      for (const s of comJulgamento) {
        if (s.notaDeCasamento) {
          linhas.push(`> **\`${s.arquivo}:${s.linha}\`${sufixoOcorrencia(s)}:** ${s.notaDeCasamento}`)
          linhas.push('')
        }
      }
    }
  }

  linhas.push('## Tabela completa desta rodada')
  linhas.push('')
  linhas.push('| Arquivo | Linha | Mutação | Resultado | Fuso do veredito | Teste que matou (1º que falhou) |')
  linhas.push('|---|---:|---|---|---|---|')
  for (const r of resultados) {
    const testeTxt =
      r.estado === 'MORTA' ? (r.primeiroTesteQueFalhou || '—').replace(/\|/g, '\\|') : r.estado === 'ERRO' ? '(não mediu)' : '—'
    linhas.push(
      `| ${r.arquivo} | ${r.linha}${r.totalNaLinha > 1 ? ` (${r.ordinal + 1}º de ${r.totalNaLinha})` : ''} | \`${r.operador}\` | ${r.rotulo || r.estado} | ${r.fusoDoVeredito || '—'} | ${testeTxt} |`,
    )
  }
  linhas.push('')

  const julgamentosNaoUsados = julgamentos.filter((j) => !j.usado)
  if (anomaliasDoVarredor.length > 0 || avisosJulgamento.length > 0 || julgamentosNaoUsados.length > 0) {
    linhas.push('## Avisos da ferramenta (nada falha em silêncio)')
    linhas.push('')
    if (anomaliasDoVarredor.length > 0) {
      linhas.push('**Anomalias do varredor de texto** — trechos que o varredor não conseguiu ler com')
      linhas.push('confiança e por isso podem ter ficado FORA da lista de candidatos:')
      linhas.push('')
      for (const a of anomaliasDoVarredor) linhas.push(`- \`${a.arquivo}:${a.linha}\` — ${a.descricao}`)
      linhas.push('')
    }
    if (avisosJulgamento.length > 0) {
      linhas.push('**Problemas em `MUTACAO-JULGAMENTOS.md`:**')
      linhas.push('')
      for (const a of avisosJulgamento) linhas.push(`- ${a}`)
      linhas.push('')
    }
    if (julgamentosNaoUsados.length > 0) {
      linhas.push(
        '**Julgamentos que não casaram com nenhum sobrevivente desta rodada** — o normal, já que o rodízio mede pontos diferentes a cada vez; só vira problema se o ponto tiver deixado de existir:',
      )
      linhas.push('')
      for (const j of julgamentosNaoUsados) {
        linhas.push(`- \`${j.arquivo}:${j.linha}${j.ocorrencia ? '#' + j.ocorrencia : ''}\` — \`${j.operador}\` — ${j.veredito} (${j.data})`)
      }
      linhas.push('')
    }
  }

  if (historico && historico.length > 0) {
    linhas.push('## Histórico das rodadas (acumulado, de `MUTACAO-ESTADO.json`)')
    linhas.push('')
    linhas.push('| Rodada | Quando | Commit | Ciclo | Exercitadas | Mortas | Sobreviveram | Erros |')
    linhas.push('|---:|---|---|---:|---:|---:|---:|---:|')
    for (const h of historico) {
      linhas.push(
        `| ${h.rodada} | ${h.em} | \`${h.commit}\` | ${h.ciclo} | ${h.exercitadas} | ${h.mortas} | ${h.sobreviveram} | ${h.erros} |`,
      )
    }
    linhas.push('')
  }

  linhas.push(...TEXTO_AGENDAMENTO)

  return linhas.join('\n') + '\n'
}

// ───────────────────────────── execução direta ──────────────────────────────

// Só roda a bateria completa quando chamado diretamente
// (`node scripts/mutacao.mjs`) — permite importar as funções de um teste sem
// disparar a rodada inteira como efeito colateral.
const ehExecucaoDireta =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (ehExecucaoDireta) {
  const simular = process.argv.includes('--simular')
  const saida = await principal({ simular })

  if (saida.simulacao) {
    console.log('')
    console.log('(simulação: nada foi rodado, nada foi escrito, o ponto de parada não avançou)')
  } else {
    const { base, estado, cobertos, shasAtuais, digitalAntes } = saida

    // Confere que o src/ REAL saiu igual ao que entrou. Se a ferramenta tivesse
    // deixado uma mutação para trás, ela teria acabado de introduzir no app o
    // defeito que só deveria simular — o pior resultado possível.
    if (digitalAntes) {
      const divergencias = conferirSrcIntacto(digitalAntes, impressaoDigitalDoSrc())
      if (divergencias.length > 0) {
        console.error('')
        console.error('═══════════════════════════════════════════════════════════════')
        console.error('✗ PARE: o src/ do repositório REAL mudou durante a rodada.')
        console.error('  A ferramenta só pode estragar código dentro do worktree isolado.')
        console.error('═══════════════════════════════════════════════════════════════')
        for (const d of divergencias) console.error(`  · ${d}`)
        console.error('')
        console.error('  Nada foi escrito em MUTACAO-RESULTADO.md nem em MUTACAO-ESTADO.json.')
        process.exit(1)
      }
    }

    const { julgamentos, avisos: avisosJulgamento } = lerJulgamentos()

    // cruza sobreviventes × julgamentos
    for (const r of base.resultados) {
      if (r.estado !== 'SOBREVIVEU') continue
      const { julgamento, notaDeCasamento } = casarJulgamento(r, julgamentos)
      r.julgamento = julgamento
      r.notaDeCasamento = notaDeCasamento
    }

    const mortas = base.resultados.filter((r) => r.estado === 'MORTA').length
    const sobreviveram = base.resultados.filter((r) => r.estado === 'SOBREVIVEU').length
    const erros = base.resultados.filter((r) => r.estado === 'ERRO').length
    const semJulgamento = base.resultados.filter((r) => r.estado === 'SOBREVIVEU' && !r.julgamento).length

    // avança o ponto de parada SÓ com o que teve veredito de verdade
    for (const r of base.resultados) {
      if (r.estado === 'ERRO') continue
      cobertos[r.arquivo].add(r.chave)
    }
    const fimEm = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' (UTC)'
    const historico = [
      ...estado.historico,
      {
        rodada: base.rodadaNumero,
        em: fimEm,
        commit: base.commit,
        ciclo: base.ciclo,
        exercitadas: base.resultados.length,
        mortas,
        sobreviveram,
        erros: erros + (base.erroGlobal ? 1 : 0),
      },
    ].slice(-MAX_HISTORICO)

    const md = renderizarMarkdown({
      ...base,
      julgamentos,
      avisosJulgamento,
      historico,
      fimEm,
    })
    writeFileSync(SAIDA, md, 'utf8')

    const novoEstado = {
      versao: VERSAO_ESTADO,
      ciclo: base.ciclo,
      rodadas: base.rodadaNumero,
      atualizadoEm: fimEm,
      arquivos: Object.fromEntries(
        ARQUIVOS_ALVO.map((nome) => [
          nome,
          { sha: shasAtuais[nome], cobertos: [...cobertos[nome]].sort() },
        ]),
      ),
      historico,
    }
    gravarEstado(novoEstado)

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    if (base.erroGlobal) {
      console.log('MUTAÇÃO — A RODADA NÃO MEDIU NADA')
      console.log(base.erroGlobal)
    } else {
      console.log(
        `MUTAÇÃO — ${base.resultados.length} exercitadas · ${mortas} MORTAS · ${sobreviveram} SOBREVIVERAM · ${erros} ERROS`,
      )
      console.log(`tempo total: ${formatarDuracao(base.tempoMs)}`)
    }
    console.log('resultado escrito em MUTACAO-RESULTADO.md · ponto de parada em MUTACAO-ESTADO.json')
    console.log('═══════════════════════════════════════════════════════════════')

    if (base.orcamentoEstourado) {
      const { orcamentoMin, medidas, prometidas } = base.orcamentoEstourado
      console.error('')
      console.error(
        `✗ VERMELHO: a rodada PAROU NO ORÇAMENTO DE TEMPO (${orcamentoMin} min) com ${medidas} de ${prometidas} pontos exercitados.`,
      )
      console.error(
        `  Os ${medidas} medidos estão no relatório e o rodízio avançou por eles; os ${prometidas - medidas} que sobraram voltam na próxima rodada.`,
      )
      console.error(
        '  Isto é vermelho porque a rodada não mediu o que prometeu — e é vermelho FALANDO, em vez do cancelamento mudo de antes.',
      )
      process.exit(1)
    }
    if (erros > 0 || base.erroGlobal) {
      console.error('')
      console.error(
        `✗ VERMELHO: ${erros + (base.erroGlobal ? 1 : 0)} ponto(s) desta rodada não chegaram a ser medidos. Uma rodada que não mediu não vale como rodada verde.`,
      )
      process.exit(1)
    }
    if (semJulgamento > 0) {
      console.error('')
      console.error(
        `✗ VERMELHO: ${semJulgamento} sobrevivente(s) sem julgamento — achado ABERTO. Julgue em MUTACAO-JULGAMENTOS.md (EQUIVALENTE / QUASE-EQUIVALENTE / TESTE-FALTANDO / ACEITO-COM-RISCO, com data) ou escreva o teste que mata.`,
      )
      process.exit(2)
    }
  }
}

export {
  executarComTeto,
  rodarSuite,
  rodarCanario,
  classificarTravamento,
  medirPonto,
  FATOR_MINIMO_TETO_SOBRE_CANARIO,
  extrairPontosDeMutacao,
  extrairPontosEAnomalias,
  ARQUIVOS_ALVO,
  ARQUIVOS_DECLARADOS,
  selecionarMutacoes,
  lerJulgamentos,
  casarJulgamento,
  principal,
}
