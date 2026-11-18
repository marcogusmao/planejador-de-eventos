// Prova P4 (06/10/2026): o backup SEM zero escrito importa igual ao de ANTES
// do conserto. Copia src/ e scripts/ para uma pasta temporária, DESFAZ o P4
// na cópia (o preço do lote volta à régua naoNegativoOuVazio), roda o mesmo
// export → import nas duas árvores e imprime o sha256 dos eventos importados.
// Nenhum arquivo do repositório é editado. Uso, na raiz:
//   node scripts/provas-s7/p4-antes.mjs
//   node scripts/provas-s7/p4-antes.mjs --controle   (controle positivo: a festa
//     P8 com "0,00" no preço TEM de sair DIFERENTE — se sair igual, o
//     instrumento não enxerga o P4)
// Saída 0 = os dois sha256 iguais; 1 = diferentes; 2 = instrumento cego (o
// trecho a desfazer não foi achado exatamente como esperado).
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const raiz = resolve('.')
const copia = mkdtempSync(join(tmpdir(), 's7-p4-antes-'))
cpSync(join(raiz, 'src'), join(copia, 'src'), { recursive: true })
cpSync(join(raiz, 'scripts'), join(copia, 'scripts'), { recursive: true })

const alvo = join(copia, 'src/lib/migracao.js')
let s = readFileSync(alvo, 'utf8')
const trocas = [
  ['valor: precoDeLoteOuVazio(l.valor),', 'valor: naoNegativoOuVazio(l.valor),'],
  ['precisaAvisoNumerico(l.valor, precoDeLoteOuVazio)', 'precisaAvisoNumerico(l.valor, naoNegativoOuVazio)'],
]
for (const [de, para] of trocas) {
  const n = s.split(de).length - 1
  if (n !== 1) {
    console.log(`CEGO: "${de}" aparece ${n} vezes`)
    process.exit(2)
  }
  s = s.replace(de, para)
}
writeFileSync(alvo, s)

const controle = process.argv.includes('--controle')
async function festas(arvore) {
  if (!controle)
    return (await import(join(arvore, 'scripts/provas-s7/p4-festas-realistas.fixture.js'))).FESTAS_REALISTAS
  const { eventoSemPreco } = await import(join(arvore, 'scripts/provas-s0/cenarios.fixture.js'))
  const e = eventoSemPreco()
  e.id = 'p8'
  e.lotes = e.lotes.map((l) => (l.id === 'l4' ? { ...l, valor: '0,00' } : l))
  return [e]
}
// As festas são montadas UMA vez e passam iguais às duas árvores: o molde da
// festa P8 sorteia ids (novoEvento), e ids diferentes dariam "DIFERENTES" à toa.
const FESTAS = JSON.stringify(await festas(raiz))
async function medir(arvore) {
  const FESTAS_REALISTAS = JSON.parse(FESTAS)
  const { montarBackup, parseBackup } = await import(join(arvore, 'src/lib/storage.js'))
  const texto = JSON.stringify(montarBackup({ eventos: FESTAS_REALISTAS, benchmarksCustom: [] }), null, 2)
  return createHash('sha256').update(JSON.stringify(parseBackup(texto).eventos)).digest('hex')
}
const antes = await medir(copia)
const depois = await medir(raiz)
rmSync(copia, { recursive: true, force: true })
console.log(`ANTES do P4 (cópia desfeita): ${antes}`)
console.log(`DEPOIS do P4 (esta árvore):   ${depois}`)
console.log(antes === depois ? 'IGUAIS' : 'DIFERENTES')
if (controle) process.exit(antes === depois ? 1 : 0)
process.exit(antes === depois ? 0 : 1)
