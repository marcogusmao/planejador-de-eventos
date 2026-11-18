// O que a imagem do Railway precisa ver para o build rodar (05/10/2026).
//
// Por que existe: o PR #96 fez o `npm run build` passar por
// `scripts/com-fila.sh`, e o PR #100 trouxe um `.dockerignore` que é LISTA DE
// ENTRADA (tudo fora, só volta o que está listado). Cada PR passou sozinho na
// esteira; juntos, o build no Docker do Railway quebrou com
// "sh: can't open 'scripts/com-fila.sh'". A esteira não roda `docker build`,
// então quem guarda essa costura é este teste.
//
// O QUE ELE GUARDA, e só isso (revisor do PR #101): os scripts do `package.json`
// que o Dockerfile roda — `prepare` (via `npm ci`), cada `npm run X` do
// Dockerfile, e os ganchos `preX`/`postX` deles — citando um arquivo de
// `scripts/`, `.githooks/` etc. (com ou sem `./`, com ou sem aspas, .sh/.mjs/
// .js/.cjs/.py). Cada arquivo citado tem de existir e estar liberado por uma
// linha `!` do `.dockerignore`. O QUE ELE NÃO GUARDA: arquivo citado sem pasta
// (`node gerar.mjs`), `RUN node …` escrito direto no Dockerfile, import de
// `vite.config.js`, e um padrão POSTERIOR do `.dockerignore` que tire o arquivo
// de novo (o teste só lê as linhas `!`, não aplica a regra "a última vence").
// A prova completa continua sendo o build do Railway.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const ler = (f) => readFileSync(join(raiz, f), 'utf8')

// Linhas `!caminho` do .dockerignore: o que volta para dentro da imagem.
function liberados(dockerignore) {
  return dockerignore
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'))
    .map((l) => l.slice(1).replace(/\/$/, ''))
}

// Liberado se a linha libera o próprio arquivo ou uma pasta que o contém.
function estaLiberado(caminho, lista) {
  return lista.some((l) => caminho === l || caminho.startsWith(l + '/'))
}

// Os comandos do package.json que o Dockerfile roda (`npm ci` dispara o
// `prepare`; `npm run build` dispara o `build`).
function scriptsQueODockerfileRoda(pkg, dockerfile) {
  const base = []
  if (/\bnpm ci\b/.test(dockerfile)) base.push('prepare')
  for (const m of dockerfile.matchAll(/\bnpm run ([\w:-]+)/g)) base.push(m[1])
  // O npm roda preX e postX junto com X; e um script pode chamar outro com
  // `npm run Y` — segue a corrente.
  const nomes = new Set()
  const fila = [...base]
  while (fila.length) {
    const n = fila.shift()
    for (const k of [`pre${n}`, n, `post${n}`]) {
      if (!pkg.scripts?.[k] || nomes.has(k)) continue
      nomes.add(k)
      for (const m of pkg.scripts[k].matchAll(/\bnpm run ([\w:-]+)/g)) fila.push(m[1])
    }
  }
  return [...nomes]
}

// Caminhos relativos de arquivo do repositório citados num comando.
function arquivosCitados(comando) {
  return [...comando.matchAll(/(?:^|[\s"'=])(?:\.\/)?((?:\.?[\w-]+\/)+[\w.-]+\.(?:sh|mjs|js|cjs|py))\b/g)].map((m) => m[1])
}

describe('a imagem do Railway enxerga o que o build chama', () => {
  const pkg = JSON.parse(ler('package.json'))
  const dockerfile = ler('Dockerfile')
  const lista = liberados(ler('.dockerignore'))
  const scripts = scriptsQueODockerfileRoda(pkg, dockerfile)

  it('o Dockerfile roda npm ci e npm run build (senão este teste não guarda nada)', () => {
    expect(scripts).toContain('build')
    expect(scripts).toContain('prepare')
  })

  for (const nome of scripts) {
    it(`todo arquivo que o script "${nome}" chama existe e está liberado no .dockerignore`, () => {
      const citados = arquivosCitados(pkg.scripts[nome])
      for (const caminho of citados) {
        expect(existsSync(join(raiz, caminho)), `${caminho} não existe`).toBe(true)
        expect(estaLiberado(caminho, lista), `${caminho} fica FORA da imagem (.dockerignore)`).toBe(true)
      }
    })
  }

  it('o detector de arquivos citados enxerga os casos reais (controle do próprio teste)', () => {
    expect(arquivosCitados('sh scripts/com-fila.sh vite build')).toEqual(['scripts/com-fila.sh'])
    expect(arquivosCitados('sh .githooks/ligar-trava.sh')).toEqual(['.githooks/ligar-trava.sh'])
    expect(arquivosCitados('sh ./scripts/com-fila.sh vite build')).toEqual(['scripts/com-fila.sh'])
    expect(arquivosCitados('sh "scripts/com-fila.sh" x')).toEqual(['scripts/com-fila.sh'])
    expect(arquivosCitados('node scripts/gerar-estado.mjs && vite build')).toEqual(['scripts/gerar-estado.mjs'])
    expect(scriptsQueODockerfileRoda({ scripts: { prebuild: 'node scripts/a.mjs', build: 'npm run b', b: 'x', prepare: 'y' } }, 'RUN npm ci\nRUN npm run build')).toEqual(['prepare', 'prebuild', 'build', 'b'])
    expect(estaLiberado('scripts/com-fila.sh', ['scripts'])).toBe(true)
    expect(estaLiberado('scripts/com-fila.sh', ['src', 'servidor'])).toBe(false)
  })
})
