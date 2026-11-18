// Revisão transitória da planilha antiga: o evento e a referência histórica
// têm contratos próprios. Nenhuma recusa ou metadado entra no dado persistido.
import { uid, num } from './util.js'
import { novoEvento, novoItem, novoLote } from './defaults.js'
import { somaItens, ehLotePorta } from './xlsxImport.js'
import { FAIXA_CUSTO, FAIXA_PRECO, FAIXA_QUANTIDADE, avisoDaFaixa } from './campoNumerico.js'
import { CAT_KEYS, consolidarCustosDePlanilha, montarBenchmarkDePlanilha } from './benchmarks.js'
import { censoNormalizacoes } from './migracao.js'

export function montarRevisaoPlanilha(res, nomeArquivo) {
  const itens = Object.entries(res.categorias).flatMap(([key, arr]) => arr.map((item, indice) => ({
    ...item, id:uid(), incluir:true, incluirEvento:true, incluirBenchmark:true,
    cat:key.startsWith('?') ? 'extras' : key, origem:key.startsWith('?') ? key.slice(1) : null,
    fonte:res.metadados?.[`custo:${key}:${indice}`] || {},
    conflito:res.metadados?.[`custo:${key}:${indice}`]?.conflito ? {...res.metadados[`custo:${key}:${indice}`].conflito,escolha:null} : null,
  })))
  const lotes = res.lotes.map((lote, indice) => ({
    ...lote, id:uid(), incluir:true, incluirEvento:true, incluirBenchmark:true,
    somenteOtimista:ehLotePorta(lote.nome), fonte:res.metadados?.[`lote:${indice}`] || {},
  }))
  return {itens,lotes,avisos:[...(res.avisos||[]),...(res.avisosClassificacao||[])],descartes:[...(res.descartes||[])],recusasCelulas:[...(res.recusasCelulas||[])],planilhas:[...(res.planilhas||[])],nome:nomeArquivo.replace(/\.[^.]+$/,''),publico:'',salvarEvento:true,salvarBenchmark:false}
}
const motivoValor = (v, faixa) => {
  if (v === '') return null
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'Valor não reconhecido — informe só o número, sem anotações.'
  return faixa ? avisoDaFaixa(v, faixa) : null
}
const recusa = (linha, campo, motivo) => ({id:linha.id,aba:linha.fonte?.planilha || '',linha:linha.fonte?.linha,campo,original:linha.fonte?.originais?.[campo] ?? linha[campo],motivo})
const selecionado = (linha, destino) => linha.incluir && linha[`incluir${destino === 'evento' ? 'Evento' : 'Benchmark'}`] !== false
export function revisarImportPlanilha(rev) {
  const destinos = {}
  const conflitosPendentes = []
  for (const item of rev.itens) {
    if (item.conflito && !['calculado','declarado'].includes(item.conflito.escolha) &&
        ((rev.salvarEvento && selecionado(item,'evento')) || (rev.salvarBenchmark && selecionado(item,'benchmark')))) conflitosPendentes.push({id:item.id,servico:item.servico,aba:item.fonte?.planilha,linha:item.fonte?.linha,...item.conflito})
  }
  for (const destino of ['evento','benchmark']) {
    const itens=[], lotes=[], recusas=[]
    // Recusas lexicais do parser são comuns aos destinos, inclusive a célula
    // de realizado que fica vazia sem impedir o estimado válido.
    for (const d of rev.descartes || []) for (const c of d.celulas || []) recusas.push({aba:d.planilha,linha:d.linha,...c})
    for (const c of rev.recusasCelulas || []) recusas.push({aba:c.planilha,...c})
    for (const original of rev.itens) {
      if (!selecionado(original,destino)) continue
      if (original.conflito && !['calculado','declarado'].includes(original.conflito.escolha)) continue
      const item = original.conflito ? {...original,estimado:original.conflito[original.conflito.escolha]} : original
      const motivoEst = motivoValor(item.estimado,destino === 'evento' ? FAIXA_CUSTO : null)
      if (motivoEst) {recusas.push(recusa(item,'estimado',motivoEst));continue}
      const motivoReal = motivoValor(item.realizado,destino === 'evento' ? FAIXA_CUSTO : null)
      if (motivoReal) recusas.push(recusa(item,'realizado',`${motivoReal} O realizado ficou não informado.`))
      itens.push(motivoReal ? {...item,realizado:''} : item)
    }
    for (const lote of rev.lotes) {
      if (!selecionado(lote,destino)) continue
      const motivoPreco = motivoValor(lote.valor,FAIXA_PRECO)
      // O parser legado arredonda contagem; a origem pré-arredondamento é
      // indispensável para recusar -0,1 e o teto antes de Math.round.
      const quantidade = lote.fonte?.quantidadeOriginal ?? lote.quantidade
      const motivoQtd = motivoValor(quantidade,FAIXA_QUANTIDADE)
      if (motivoPreco) recusas.push(recusa(lote,'valor',motivoPreco))
      if (motivoQtd) recusas.push(recusa(lote,'quantidade',motivoQtd))
      if (!motivoPreco && !motivoQtd) lotes.push(lote)
    }
    const motivoPublico = motivoValor(rev.publico,FAIXA_QUANTIDADE)
    if (motivoPublico) recusas.push({campo:'publico',original:rev.publico,motivo:motivoPublico})
    destinos[destino]={itens,lotes,recusas,totalCustos:somaItens(itens),publicoValido:!motivoPublico}
  }
  const resumo = Object.fromEntries(Object.entries(destinos).map(([destino,d])=>[destino,{custos:d.itens.length,lotes:d.lotes.length,recusas:d.recusas.length,totalCustos:d.totalCustos}]))
  const podeAplicar = conflitosPendentes.length === 0 && (rev.salvarEvento || rev.salvarBenchmark) &&
    (!rev.salvarEvento || (destinos.evento.publicoValido && (destinos.evento.itens.length+destinos.evento.lotes.length)>0)) &&
    (!rev.salvarBenchmark || (destinos.benchmark.publicoValido && (destinos.benchmark.itens.length+destinos.benchmark.lotes.length)>0))
  return {...destinos,conflitosPendentes,podeAplicar,resumo}
}
export function montarDadosImportPlanilha(rev) {
  const previa = revisarImportPlanilha(rev)
  if (!previa.podeAplicar) return {ok:false,motivo:previa.conflitosPendentes.length ? 'Escolha o total calculado ou informado de cada linha divergente antes de importar.' : 'Escolha um destino com linhas válidas e confira o público antes de importar.',censo:[]}
  let evento=null,benchmark=null
  if (rev.salvarEvento) {
    const d=previa.evento
    evento=novoEvento(rev.nome || 'Evento importado');evento.publicoEstimado=rev.publico === '' ? '' : rev.publico
    if(d.lotes.length) evento.lotes=d.lotes.map(l=>novoLote({nome:l.nome,valor:l.valor,quantidade:l.quantidade,somenteOtimista:!!l.somenteOtimista}))
    evento.categorias=evento.categorias.map(c=>({...c,itens:d.itens.filter(i=>i.cat===c.id).map(i=>novoItem({servico:i.servico,fornecedor:i.fornecedor,estimado:i.estimado,realizado:i.realizado,status:i.status,responsavel:i.responsavel,obs:i.obs}))}))
    const censo=censoNormalizacoes([evento])
    if(censo.length) return {ok:false,motivo:'O evento ainda contém valores que mudariam ao reabrir — confira os campos abaixo.',censo}
  }
  if(rev.salvarBenchmark) {
    const d=previa.benchmark;const somas={}
    for(const key of CAT_KEYS) somas[key]=somaItens(d.itens.filter(i=>i.cat===key))
    const {custos,custoTotal}=consolidarCustosDePlanilha(somas)
    const receita=d.lotes.reduce((s,l)=>s+num(l.valor)*num(l.quantidade),0)
    const pagos=d.lotes.filter(l=>num(l.valor)>0).reduce((s,l)=>s+num(l.quantidade),0)
    benchmark=montarBenchmarkDePlanilha({nome:rev.nome,publico:num(rev.publico),custos,custoTotal,receita,pagos})
  }
  return {ok:true,evento,benchmark,resumo:previa.resumo,censo:[]}
}
const copia = obj => JSON.parse(JSON.stringify(obj))
const igual = (a,b) => JSON.stringify(a) === JSON.stringify(b)
export function aplicarImportPlanilha(store,pacote) {
  if(!pacote?.ok || (!pacote.evento && !pacote.benchmark)) return {ok:false,store,motivo:'Pacote de importação inválido.'}
  if ((pacote.evento && (!Array.isArray(pacote.evento.categorias) || !Array.isArray(pacote.evento.lotes) || censoNormalizacoes([pacote.evento]).length)) ||
      (pacote.benchmark && (!Number.isFinite(pacote.benchmark.custoTotal) || !pacote.benchmark.custos || Object.values(pacote.benchmark.custos).some(v => v !== null && !Number.isFinite(v))))) return {ok:false,store,motivo:'O pacote contém valores não reconhecidos — revise a planilha antes de importar.'}
  if ((pacote.evento && (!pacote.evento.id || store.eventos?.some(e=>e.id===pacote.evento.id))) || (pacote.benchmark && (!pacote.benchmark.id || store.benchmarksCustom?.some(b=>b.id===pacote.benchmark.id)))) return {ok:false,store,motivo:'Esta importação já está no app — não foi duplicada.'}
  const novo={...store,eventos:pacote.evento?[...(store.eventos||[]),pacote.evento]:store.eventos,benchmarksCustom:pacote.benchmark?[...(store.benchmarksCustom||[]),pacote.benchmark]:store.benchmarksCustom}
  return {ok:true,store:novo,recibo:{evento:pacote.evento?copia(pacote.evento):null,benchmark:pacote.benchmark?copia(pacote.benchmark):null,resumo:pacote.resumo}}
}
export function desfazerImportPlanilha(store,recibo) {
  if(!recibo || (!recibo.evento && !recibo.benchmark)) return {ok:false,store,motivo:'Recibo de importação ausente — use Proteção de dados.'}
  const evento=recibo.evento && store.eventos?.find(e=>e.id===recibo.evento.id)
  const benchmark=recibo.benchmark && store.benchmarksCustom?.find(b=>b.id===recibo.benchmark.id)
  if ((evento && !igual(evento,recibo.evento)) || (benchmark && !igual(benchmark,recibo.benchmark))) return {ok:false,store,motivo:'O evento ou a referência importada foi editado depois. Nada foi desfeito; confira Proteção de dados para recuperar a cópia de segurança.'}
  if(!evento && !benchmark) return {ok:true,store,jaDesfeito:true}
  return {ok:true,store:{...store,eventos:store.eventos?.filter(e=>e.id!==recibo.evento?.id),benchmarksCustom:store.benchmarksCustom?.filter(b=>b.id!==recibo.benchmark?.id)}}
}
