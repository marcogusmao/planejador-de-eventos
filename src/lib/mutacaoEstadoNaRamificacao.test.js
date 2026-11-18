// O RODÍZIO DA MUTAÇÃO LÊ E GRAVA O PONTO DE PARADA NA `mutacao/estado`?
//
// POR QUE ESTE TESTE EXISTE (05/10/2026). De 30/08 a 05/10/2026 toda rodada
// semanal mediu os MESMOS 20 pontos. O MUTACAO-ESTADO.json só voltava para o
// repositório pelo pull request do robô, e esse pull request nunca abriu (o
// repositório não deixa o GitHub Actions criar pull request). A `main` ficou
// na rodada 6, de 28/07, e toda segunda partia dela.
//
// Marco, 05/10/2026, por questionário: o rodízio guarda o ponto de parada na
// ramificação `mutacao/estado`; risco aceito: o estado verdadeiro mora fora da
// main.
//
// O QUE ESTE TESTE MORDE, no texto do `.github/workflows/mutacao-semanal.yml`
// (o workflow não roda localmente; a simulação dos passos contra um remoto
// descartável foi feita à mão no commit que criou isto):
//   · o passo que LÊ a `mutacao/estado` existe e vem ANTES de "Rodar a
//     bateria" — lido depois, a bateria já teria partido do estado velho;
//   · ele copia o MUTACAO-ESTADO.json de lá para a raiz;
//   · o passo que GRAVA existe, vem DEPOIS da bateria, roda mesmo com a
//     bateria vermelha, e empurra para `refs/heads/mutacao/estado` com
//     `--force-with-lease`;
//   · o aviso de pull request não aberto diz que o rodízio NÃO depende dele.
//
// O QUE ELE NÃO PROVA: que o GitHub aceita o push. Isso só a próxima rodada
// agendada responde.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const YML = readFileSync(path.join(RAIZ, '.github/workflows/mutacao-semanal.yml'), 'utf8')

// Mesma lição do esteiraLocalCobreOCI.test.js (30/08/2026): procurar o comando
// no texto inteiro aceita um comentário que só FALA dele. Comentário fora.
const semComentarios = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

/** Os passos do trabalho, na ordem, cada um com o nome e o texto dele. */
const passos = (() => {
  const linhas = semComentarios(YML).split('\n')
  const lista = []
  for (const linha of linhas) {
    const m = /^ {6}- name: (.+)$/.exec(linha)
    if (m) lista.push({ nome: m[1].trim(), texto: '' })
    else if (lista.length > 0) lista[lista.length - 1].texto += linha + '\n'
  }
  return lista
})()

const indice = (prefixo) => passos.findIndex((p) => p.nome.startsWith(prefixo))
const passo = (prefixo) => passos[indice(prefixo)]

describe('mutacao-semanal.yml — o ponto de parada mora na ramificação mutacao/estado', () => {
  it('os passos foram achados (se isto falhar, o leitor do yml quebrou, não o workflow)', () => {
    expect(indice('Rodar a bateria')).toBeGreaterThan(0)
    expect(indice('Ler o ponto de parada')).toBeGreaterThan(0)
    expect(indice('Guardar o ponto de parada')).toBeGreaterThan(0)
  })

  it('a leitura da mutacao/estado vem ANTES de "Rodar a bateria"', () => {
    expect(indice('Ler o ponto de parada')).toBeLessThan(indice('Rodar a bateria'))
  })

  it('a leitura busca a mutacao/estado e copia o MUTACAO-ESTADO.json de lá para a raiz', () => {
    const { texto } = passo('Ler o ponto de parada')
    expect(texto).toMatch(/git fetch[^\n]*origin refs\/heads\/mutacao\/estado/)
    expect(texto).toMatch(/git show FETCH_HEAD:MUTACAO-ESTADO\.json/)
    expect(texto).toMatch(/cp [^\n]*MUTACAO-ESTADO\.json\n/)
    // Diz de onde o estado veio, nos dois casos.
    expect(texto).toContain('origem=main')
    expect(texto).toContain('origem=mutacao/estado')
  })

  it('a gravação vem DEPOIS da bateria, roda mesmo com ela vermelha, e empurra com lease', () => {
    expect(indice('Guardar o ponto de parada')).toBeGreaterThan(indice('Rodar a bateria'))
    const { texto } = passo('Guardar o ponto de parada')
    expect(texto).toMatch(/if: always\(\) && steps\.bateria\.outputs\.codigo != ''/)
    expect(texto).toMatch(/git push --force-with-lease="\$LEASE" origin "HEAD:refs\/heads\/mutacao\/estado"/)
    // Só os dois arquivos do rodízio, e o relatório só quando reescrito.
    expect(texto).toMatch(/ARQUIVOS="MUTACAO-ESTADO\.json"\n/)
    expect(texto).toMatch(/ARQUIVOS="\$ARQUIVOS MUTACAO-RESULTADO\.md"\n/)
    expect(texto).toMatch(/git add -- \$ARQUIVOS\n/)
    // A ponta esperada pelo lease é a que a leitura viu.
    expect(texto).toContain('PAI: ${{ steps.estado.outputs.pai }}')
    expect(passo('Ler o ponto de parada').texto).toMatch(/id: estado\n/)
  })

  // Achado do revisor adversarial no PR #99 (05/10/2026): o botão "rodar agora"
  // deixa escolher qualquer ramificação, e sem filtro um ramo com `calc.js`
  // mexido gravava o estado e zerava a cobertura da `main`.
  it('só uma rodada da main grava; em outra ramificação o log diz que não gravou', () => {
    const { texto } = passo('Guardar o ponto de parada')
    expect(texto).toMatch(/if: [^\n]*github\.ref == 'refs\/heads\/main'/)
    const aviso = passo('Avisar que esta ramificação não grava')
    expect(aviso).toBeDefined()
    expect(aviso.texto).toMatch(/if: always\(\) && github\.ref != 'refs\/heads\/main'/)
    expect(aviso.texto).toMatch(/echo "::notice[^\n]*não foi alterado/)
  })

  // Reconferência do PR #99 (05/10/2026): um disparo em outra ramificação
  // empurrava a `mutacao/semanal-<data>` com `--force-with-lease`, apagando o
  // relatório da main daquele dia e deixando ali o commit da outra frente.
  it('a ramificação semanal e o pull request também são só da main', () => {
    const { texto } = passo('Guardar o resultado numa branch')
    expect(texto).toMatch(/if: [^\n]*github\.ref == 'refs\/heads\/main'/)
    expect(passo('Avisar que esta ramificação não grava').texto).toMatch(
      /echo "::notice[^\n]*a ramificação semanal mutacao\/semanal-<data> não foi empurrada/,
    )
  })

  it('o texto sobre o ponto de parada depende de a gravação ter dado certo', () => {
    expect(passo('Guardar o ponto de parada').texto).toMatch(/id: gravacao\n/)
    const { texto } = passo('Guardar o resultado numa branch')
    expect(texto).toContain('GRAVACAO: ${{ steps.gravacao.outcome }}')
    expect(texto.match(/if \[ "\$GRAVACAO" = "success" \]; then/g)).toHaveLength(2)
    expect(texto).not.toContain("o ponto de parada já foi guardado na ramificação 'mutacao/estado'")
  })

  // S4 do mesmo revisor: com a bateria saindo sem reescrever o relatório, o
  // passo copiava o MUTACAO-RESULTADO.md velho da main por cima.
  it('o relatório só vai para a mutacao/estado se a bateria o reescreveu nesta rodada', () => {
    expect(passo('Ler o ponto de parada').texto).toMatch(
      /echo "resultado_antes=\$\(git hash-object MUTACAO-RESULTADO\.md[^\n]*>> "\$GITHUB_OUTPUT"/,
    )
    const { texto } = passo('Guardar o ponto de parada')
    expect(texto).toContain('RESULTADO_ANTES: ${{ steps.estado.outputs.resultado_antes }}')
    expect(texto).toMatch(/\[ "\$\(git hash-object MUTACAO-RESULTADO\.md\)" != "\$RESULTADO_ANTES" \]/)
  })

  it('a gravação vem antes do passo do pull request, que agora é só relatório', () => {
    expect(indice('Guardar o ponto de parada')).toBeLessThan(indice('Guardar o resultado numa branch'))
    const { texto } = passo('Guardar o resultado numa branch')
    expect(texto).toContain('O rodízio NÃO depende deste pull request')
    expect(texto).not.toContain('O ponto de parada do rodízio está salvo — abra o pull request à mão')
  })
})
