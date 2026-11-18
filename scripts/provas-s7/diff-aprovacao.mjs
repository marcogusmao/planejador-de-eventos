// Mede P8 sem alterar fórmula: o comparador é o mesmo evento sem o lote vazio.
// Rodar antes da aprovação: node scripts/provas-s7/diff-aprovacao.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { eventoSemPreco } from '../provas-s0/cenarios.fixture.js'
import { computeCenarios } from '../../src/lib/calc.js'
const evento = eventoSemPreco()
const antes = computeCenarios(evento)
const comparador = computeCenarios({ ...evento, lotes: evento.lotes.slice(0,2) })
const campos = ['pagos','cortesias','publico','bruta','taxa','cashback','liquida','bar','receitaTotal','custoTotal','lucro','breakEven']
const medir = s => Object.fromEntries(campos.map(k => [k,s[k]]))
const casos = Object.keys(antes).map(cenario => ({ cenario, atual:medir(antes[cenario]), esperado:medir(comparador[cenario]), diferencaLucro:antes[cenario].lucro-comparador[cenario].lucro }))
const zero = computeCenarios({ ...evento, lotes:evento.lotes.map((l,i)=>i===2?{...l,valor:0}:l) })
for(const k of Object.keys(zero))assert.equal(zero[k].cortesias,350)
console.log(JSON.stringify({
  calcSha256:createHash('sha256').update(readFileSync('src/lib/calc.js')).digest('hex'),
  entrada:{lotes:evento.lotes.map(({nome,quantidade,valor})=>({nome,quantidade,valor})),custo:60000,taxa:evento.taxaBilheteria,cashback:evento.cashbackPct,contingencia:evento.contingenciaPct,bar:evento.barTicket,sistemaPct:evento.barTaxaSistemaPct,sistemaFixo:evento.barCustoSistema},
  casos,zeroDeclaradoMantem350Cortesias:true,
  limite:'Evento sintético; não mede dados reais do Marco. Comparador usa a fórmula atual no evento sem o lote sem preço.'
},null,2))
