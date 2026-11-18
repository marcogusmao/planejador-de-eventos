# EVIDÊNCIA DE TESTES — índice regra → teste (gerado)

> **Não edite este arquivo à mão.** Ele é gerado por `node scripts/gerar-indice-testes.mjs`,
> que varre `src/lib/*.test.js` e `src/components/*.test.jsx` (se houver) e extrai os
> nomes de `describe`/`it`/`test` do texto-fonte dos testes — sem executar nada.
>
> **Como regenerar** (depois de mudar testes):
>
>     node scripts/gerar-indice-testes.mjs
>
> Regenere e commite o resultado junto da mudança. `scripts/auditoria.sh` roda essa
> checagem (`git diff --exit-code EVIDENCIA-TESTES.md`) e falha se o arquivo commitado
> ficar desatualizado — por isso esta saída nunca leva data/hora de geração, só o que
> dá para derivar do texto-fonte dos testes.
>
> **`(SKIP)`** marca `describe.skip`/`it.skip`: especificação PROPOSTA, aguardando aval
> datado do Marco (princípios 1 e 8 do CLAUDE.md) — não conta como cobertura ativa, mas
> aparece listada (nada fica de fora em silêncio, princípio 4). **`(ONLY)`** marcaria
> `it.only`/`describe.only` esquecido — se aparecer aqui, é bug de CI (só esse teste
> rodaria). **`(EACH)`** roda 1× por linha da tabela de casos em tempo de execução; o
> índice mostra a ocorrência única no código-fonte, não a multiplicação em runtime.

## Resumo

| Diretório | Arquivos | describe | it/test | dos quais SKIP |
|---|---:|---:|---:|---:|
| src/lib | 129 | 647 | 2451 | 18 |
| src/components | 64 | 196 | 679 | 0 |
| **Total** | **193** | **843** | **3130** | **18** |

## Índice por arquivo

- **[src/lib](#srclib)**
  - [acuracia.test.js](#acuraciatestjs) — 8 describe · 22 it/test
  - [analiseCaixa.test.js](#analisecaixatestjs) — 9 describe · 35 it/test
  - [aparencia.test.js](#aparenciatestjs) — 6 describe · 16 it/test
  - [atalhoHistorico.test.js](#atalhohistoricotestjs) — 3 describe · 7 it/test
  - [avisoBar.test.js](#avisobartestjs) — 1 describe · 13 it/test
  - [avisoExportVerdade.test.js](#avisoexportverdadetestjs) — 3 describe · 8 it/test
  - [backupAoSair.test.js](#backupaosairtestjs) — 4 describe · 11 it/test
  - [backupEnvenenado.test.js](#backupenvenenadotestjs) — 6 describe · 12 it/test
  - [backupExterno.test.js](#backupexternotestjs) — 6 describe · 30 it/test
  - [backupIdentidade.test.js](#backupidentidadetestjs) — 1 describe · 8 it/test
  - [backupIdsDuplicados.test.js](#backupidsduplicadostestjs) — 1 describe · 4 it/test
  - [backupSemIdentificacao.test.js](#backupsemidentificacaotestjs) — 7 describe · 25 it/test
  - [barPorPessoa.test.js](#barporpessoatestjs) — 6 describe · 21 it/test
  - [benchmarks.test.js](#benchmarkstestjs) — 9 describe · 48 it/test
  - [bilheteriaBrutaBenchmark.evidencia.test.js](#bilheteriabrutabenchmarkevidenciatestjs) — 7 describe · 30 it/test
  - [bilheteriaBrutaNoPromovido.evidencia.test.js](#bilheteriabrutanopromovidoevidenciatestjs) — 2 describe · 7 it/test
  - [breakEven.test.js](#breakeventestjs) — 8 describe · 26 it/test
  - [breakEvenTexto.test.js](#breakeventextotestjs) — 9 describe · 37 it/test
  - [calc.p8.test.js](#calcp8testjs) — 5 describe · 10 it/test
  - [calc.test.js](#calctestjs) — 15 describe · 98 it/test
  - [campoNumerico.test.js](#camponumericotestjs) — 7 describe · 28 it/test
  - [carregarBenchmark.test.js](#carregarbenchmarktestjs) — 7 describe · 28 it/test
  - [censoDatasImpossiveis.test.js](#censodatasimpossiveistestjs) — 5 describe · 20 it/test
  - [censoImportAtaque.test.js](#censoimportataquetestjs) — 4 describe · 20 it/test · 2 skip
  - [chavePonte.test.js](#chavepontetestjs) — 3 describe · 8 it/test
  - [colunaSempreTermina.test.js](#colunasempreterminatestjs) — 1 describe · 2 it/test
  - [comparacaoCustos.test.js](#comparacaocustostestjs) — 7 describe · 27 it/test
  - [confrontoCustos.test.js](#confrontocustostestjs) — 3 describe · 10 it/test
  - [consertosNaoRegressao.test.js](#consertosnaoregressaotestjs) — 3 describe · 12 it/test
  - [containerEstragado.evidencia.test.js](#containerestragadoevidenciatestjs) — 2 describe · 8 it/test
  - [contrasteDoAcento.evidencia.test.js](#contrastedoacentoevidenciatestjs) — 1 describe · 4 it/test
  - [curvaVendas.test.js](#curvavendastestjs) — 24 describe · 97 it/test
  - [dadoQuebrado.test.js](#dadoquebradotestjs) — 3 describe · 14 it/test
  - [dataBrasileira.test.js](#databrasileiratestjs) — 10 describe · 38 it/test
  - [dataLocal.test.js](#datalocaltestjs) — 3 describe · 14 it/test
  - [defaults.test.js](#defaultstestjs) — 4 describe · 9 it/test
  - [descritorEdicao.test.js](#descritoredicaotestjs) — 4 describe · 16 it/test
  - [desfazerDoRascunho.test.js](#desfazerdorascunhotestjs) — 4 describe · 12 it/test
  - [dinheiroEmCentavos.test.js](#dinheiroemcentavostestjs) — 3 describe · 5 it/test
  - [dossie.test.js](#dossietestjs) — 5 describe · 12 it/test
  - [dre.test.js](#dretestjs) — 1 describe · 8 it/test
  - [duasAbasSalvando.test.js](#duasabassalvandotestjs) — 2 describe · 4 it/test
  - [esteiraLocalCobreOCI.test.js](#esteiralocalcobreocitestjs) — 2 describe · 4 it/test
  - [estimadoEhOOrcamento.evidencia.test.js](#estimadoehoorcamentoevidenciatestjs) — 8 describe · 15 it/test
  - [exibicaoQueFecha.test.js](#exibicaoquefechatestjs) — 3 describe · 10 it/test
  - [exportPagamentos.test.js](#exportpagamentostestjs) — 7 describe · 21 it/test
  - [faixasMatrizRelatorio.test.js](#faixasmatrizrelatoriotestjs) — 1 describe · 1 it/test
  - [fechamento.test.js](#fechamentotestjs) — 8 describe · 41 it/test
  - [fechamentoAbsurdo.test.js](#fechamentoabsurdotestjs) — 1 describe · 4 it/test
  - [fechamentoEvento.test.js](#fechamentoeventotestjs) — 4 describe · 16 it/test
  - [financeiro.carimboInvalido.test.js](#financeirocarimboinvalidotestjs) — 1 describe · 1 it/test
  - [financeiro.mantidas.test.js](#financeiromantidastestjs) — 1 describe · 1 it/test
  - [financeiro.s1.test.js](#financeiros1testjs) — 2 describe · 20 it/test
  - [financeiro.test.js](#financeirotestjs) — 9 describe · 37 it/test
  - [fonteUnicaCustos.test.js](#fonteunicacustostestjs) — 2 describe · 9 it/test
  - [format.test.js](#formattestjs) — 8 describe · 25 it/test
  - [golden.test.js](#goldentestjs) — 11 describe · 42 it/test
  - [historico.test.js](#historicotestjs) — 12 describe · 51 it/test
  - [imposto.test.js](#impostotestjs) — 9 describe · 34 it/test
  - [leituraCorrompida.test.js](#leituracorrompidatestjs) — 6 describe · 12 it/test
  - [lixeiraNadaEmSilencio.test.js](#lixeiranadaemsilenciotestjs) — 6 describe · 16 it/test
  - [lixeiraTransacao.test.js](#lixeiratransacaotestjs) — 4 describe · 14 it/test
  - [loteSemPreco.test.js](#lotesemprecotestjs) — 8 describe · 18 it/test
  - [loteTravas.evidencia.test.js](#lotetravasevidenciatestjs) — 3 describe · 11 it/test
  - [marcacaoRealizada.test.js](#marcacaorealizadatestjs) — 3 describe · 8 it/test
  - [marcacaoRealizadaCampoVazio.test.js](#marcacaorealizadacampovaziotestjs) — 4 describe · 14 it/test
  - [marcacaoZerado.evidencia.test.js](#marcacaozeradoevidenciatestjs) — 2 describe · 19 it/test
  - [migracao.p4.test.js](#migracaop4testjs) — 3 describe · 6 it/test
  - [migracao.test.js](#migracaotestjs) — 15 describe · 71 it/test
  - [migracaoIdLegado.test.js](#migracaoidlegadotestjs) — 3 describe · 12 it/test
  - [multiAba.test.js](#multiabatestjs) — 1 describe · 4 it/test
  - [mutacaoEstadoNaRamificacao.test.js](#mutacaoestadonaramificacaotestjs) — 2 describe · 8 it/test
  - [mutacaoTravamento.test.js](#mutacaotravamentotestjs) — 2 describe · 16 it/test
  - [negativoTravado.evidencia.test.js](#negativotravadoevidenciatestjs) — 7 describe · 16 it/test
  - [novaEdicao.test.js](#novaedicaotestjs) — 3 describe · 22 it/test
  - [ordenar.test.js](#ordenartestjs) — 4 describe · 22 it/test
  - [ordenarHonestidade.test.js](#ordenarhonestidadetestjs) — 6 describe · 18 it/test
  - [ordenarInvariancia.test.js](#ordenarinvarianciatestjs) — 3 describe · 16 it/test
  - [origensFinanceiro.test.js](#origensfinanceirotestjs) — 1 describe · 5 it/test
  - [padroes80e90.test.js](#padroes80e90testjs) — 3 describe · 21 it/test
  - [parcelas.test.js](#parcelastestjs) — 10 describe · 42 it/test
  - [patrocinio.test.js](#patrociniotestjs) — 7 describe · 19 it/test
  - [percentuaisForaDaFaixa.evidencia.test.js](#percentuaisforadafaixaevidenciatestjs) — 2 describe · 14 it/test
  - [pixFechamento.test.js](#pixfechamentotestjs) — 1 describe · 8 it/test
  - [planilhaCelulas.test.js](#planilhacelulastestjs) — 1 describe · 3 it/test
  - [planoFinanceiro.csvQuebra.test.js](#planofinanceirocsvquebratestjs) — 1 describe · 3 it/test
  - [planoFinanceiro.custouZero.test.js](#planofinanceirocustouzerotestjs) — 1 describe · 4 it/test
  - [planoFinanceiro.foto.test.js](#planofinanceirofototestjs) — 2 describe · 4 it/test
  - [planoFinanceiro.semPreco.test.js](#planofinanceirosemprecotestjs) — 1 describe · 4 it/test
  - [planoFinanceiro.test.js](#planofinanceirotestjs) — 30 describe · 121 it/test
  - [ponteOrigem.test.js](#ponteorigemtestjs) — 7 describe · 20 it/test
  - [precoLote.test.js](#precolotetestjs) — 2 describe · 4 it/test
  - [premissas.test.js](#premissastestjs) — 9 describe · 36 it/test
  - [premissaTexto.test.js](#premissatextotestjs) — 5 describe · 20 it/test
  - [promoverBenchmark.evidencia.test.js](#promoverbenchmarkevidenciatestjs) — 4 describe · 22 it/test
  - [promoverBenchmarkNaoRegressao.test.js](#promoverbenchmarknaoregressaotestjs) — 3 describe · 11 it/test
  - [protecao.test.js](#protecaotestjs) — 7 describe · 24 it/test
  - [quantidadeTravada.s6.test.js](#quantidadetravadas6testjs) — 9 describe · 35 it/test
  - [quarentenaCopiaUnica.test.js](#quarentenacopiaunicatestjs) — 2 describe · 4 it/test
  - [quatroSuperficiesCusto.test.js](#quatrosuperficiescustotestjs) — 3 describe · 11 it/test
  - [realizadoZero.evidencia.test.js](#realizadozeroevidenciatestjs) — 2 describe · 8 it/test
  - [receitaLiquida.test.js](#receitaliquidatestjs) — 2 describe · 5 it/test
  - [receitaRealizada.s4.test.js](#receitarealizadas4testjs) — 1 describe · 8 it/test
  - [reguaBackup.evidencia.test.js](#reguabackupevidenciatestjs) — 6 describe · 19 it/test
  - [reguaTicket.test.js](#reguatickettestjs) — 7 describe · 25 it/test
  - [relatorio.test.js](#relatoriotestjs) — 1 describe · 4 it/test
  - [restaurarSnapshot.test.js](#restaurarsnapshottestjs) — 1 describe · 4 it/test
  - [resultadoFechamento.evidencia.test.js](#resultadofechamentoevidenciatestjs) — 9 describe · 22 it/test
  - [resumo.test.js](#resumotestjs) — 7 describe · 32 it/test
  - [revisaoImportPlanilha.test.js](#revisaoimportplanilhatestjs) — 3 describe · 12 it/test
  - [revisaoRestauracao.test.js](#revisaorestauracaotestjs) — 5 describe · 21 it/test
  - [ritmoPorDia.test.js](#ritmopordiatestjs) — 6 describe · 14 it/test
  - [rotulosGrafico.test.js](#rotulosgraficotestjs) — 1 describe · 8 it/test
  - [simulacaoRascunho.test.js](#simulacaorascunhotestjs) — 7 describe · 33 it/test
  - [simulador.test.js](#simuladortestjs) — 4 describe · 19 it/test
  - [statusCusto.test.js](#statuscustotestjs) — 7 describe · 19 it/test
  - [storageQuota.test.js](#storagequotatestjs) — 1 describe · 3 it/test
  - [superficiesDeReuniao.evidencia.test.js](#superficiesdereuniaoevidenciatestjs) — 7 describe · 25 it/test · 16 skip
  - [superficiesRealizado.evidencia.test.js](#superficiesrealizadoevidenciatestjs) — 7 describe · 19 it/test
  - [testeNaoDependeDoCalendario.test.js](#testenaodependedocalendariotestjs) — 1 describe · 1 it/test
  - [toast.test.js](#toasttestjs) — 2 describe · 7 it/test
  - [util.test.js](#utiltestjs) — 6 describe · 27 it/test
  - [vendaPctEcensoImport.evidencia.test.js](#vendapctecensoimportevidenciatestjs) — 4 describe · 17 it/test
  - [vereditoTexto.test.js](#vereditotextotestjs) — 3 describe · 8 it/test
  - [versaoReuniao.test.js](#versaoreuniaotestjs) — 4 describe · 10 it/test
  - [xlsxImport.test.js](#xlsximporttestjs) — 12 describe · 65 it/test
  - [xlsxOrcamento.test.js](#xlsxorcamentotestjs) — 7 describe · 27 it/test
  - [xlsxOrcamentoV2.test.js](#xlsxorcamentov2testjs) — 3 describe · 13 it/test
  - [xlsxReconciliar.test.js](#xlsxreconciliartestjs) — 14 describe · 22 it/test
- **[src/components](#srccomponents)**
  - [App.financeiroNoop.test.jsx](#appfinanceironooptestjsx) — 1 describe · 2 it/test
  - [App.fio.test.jsx](#appfiotestjsx) — 5 describe · 18 it/test
  - [avisoBarNoCenario.fio.test.jsx](#avisobarnocenariofiotestjsx) — 1 describe · 10 it/test
  - [avisoCustoQuebrado.test.jsx](#avisocustoquebradotestjsx) — 4 describe · 9 it/test
  - [avisoLucroBenchmark.fio.test.jsx](#avisolucrobenchmarkfiotestjsx) — 1 describe · 2 it/test
  - [barAplicarSimulacao.fio.test.jsx](#baraplicarsimulacaofiotestjsx) — 4 describe · 17 it/test
  - [barNoSimulador.fio.test.jsx](#barnosimuladorfiotestjsx) — 6 describe · 25 it/test
  - [BarraOrcamentoFechado.test.jsx](#barraorcamentofechadotestjsx) — 2 describe · 5 it/test
  - [BenchmarksEditor.regua.evidencia.test.jsx](#benchmarkseditorreguaevidenciatestjsx) — 2 describe · 7 it/test
  - [breakEvenNaoFechaNasTelas.evidencia.test.jsx](#breakevennaofechanastelasevidenciatestjsx) — 5 describe · 13 it/test
  - [CampoData.test.jsx](#campodatatestjsx) — 12 describe · 44 it/test
  - [carregarBenchmark.s4.test.jsx](#carregarbenchmarks4testjsx) — 1 describe · 8 it/test
  - [CarregarBenchmarkModal.test.jsx](#carregarbenchmarkmodaltestjsx) — 4 describe · 13 it/test
  - [cartaoLucroIgualDRE.evidencia.test.jsx](#cartaolucroigualdreevidenciatestjsx) — 1 describe · 3 it/test
  - [colunaDoCardFecha.evidencia.test.jsx](#colunadocardfechaevidenciatestjsx) — 1 describe · 9 it/test
  - [curvaEstorno.s3.test.jsx](#curvaestornos3testjsx) — 2 describe · 9 it/test
  - [dadoQuebradoNaHome.test.jsx](#dadoquebradonahometestjsx) — 3 describe · 8 it/test
  - [dadoQuebradoNaoContamina.test.jsx](#dadoquebradonaocontaminatestjsx) — 9 describe · 33 it/test
  - [dataChegaNoDadoSalvo.fio.test.jsx](#datacheganodadosalvofiotestjsx) — 6 describe · 21 it/test
  - [DossieCustoModal.faixa.test.jsx](#dossiecustomodalfaixatestjsx) — 1 describe · 3 it/test
  - [dreQueFecha.evidencia.test.jsx](#drequefechaevidenciatestjsx) — 1 describe · 3 it/test
  - [estimadoNoCartao.fio.test.jsx](#estimadonocartaofiotestjsx) — 4 describe · 11 it/test
  - [EventEditor.evidencia.test.jsx](#eventeditorevidenciatestjsx) — 4 describe · 11 it/test
  - [fechamentoEAnaliseDeFestaQuebrada.test.jsx](#fechamentoeanalisedefestaquebradatestjsx) — 6 describe · 12 it/test
  - [fechamentoOrigemInvalida.s4.test.jsx](#fechamentoorigeminvalidas4testjsx) — 1 describe · 5 it/test
  - [FinanceiroModal.alias.test.jsx](#financeiromodalaliastestjsx) — 1 describe · 2 it/test
  - [FinanceiroModal.s1.test.jsx](#financeiromodals1testjsx) — 1 describe · 15 it/test
  - [Home.evidencia.test.jsx](#homeevidenciatestjsx) — 2 describe · 8 it/test
  - [importBenchmarkNegativo.fio.test.jsx](#importbenchmarknegativofiotestjsx) — 2 describe · 4 it/test
  - [ImportModal.p6independente.test.jsx](#importmodalp6independentetestjsx) — 1 describe · 3 it/test
  - [ImportModal.s2.test.jsx](#importmodals2testjsx) — 1 describe · 17 it/test
  - [importSemIdentificacao.fio.test.jsx](#importsemidentificacaofiotestjsx) — 2 describe · 7 it/test
  - [impostoNaTela.evidencia.test.jsx](#impostonatelaevidenciatestjsx) — 4 describe · 22 it/test
  - [impostoNoRealizado.evidencia.test.jsx](#impostonorealizadoevidenciatestjsx) — 7 describe · 31 it/test
  - [loteSemPreco.revisao.s7.test.jsx](#lotesemprecorevisaos7testjsx) — 8 describe · 14 it/test
  - [loteSemPreco.s7.test.jsx](#lotesemprecos7testjsx) — 5 describe · 15 it/test
  - [loteTravas.faixa.test.jsx](#lotetravasfaixatestjsx) — 3 describe · 9 it/test
  - [lucroDeFestaQuebrada.test.jsx](#lucrodefestaquebradatestjsx) — 7 describe · 21 it/test
  - [OrcamentoProdutorModal.s2.test.jsx](#orcamentoprodutormodals2testjsx) — 1 describe · 4 it/test
  - [OrcamentoProdutorModal.test.jsx](#orcamentoprodutormodaltestjsx) — 1 describe · 2 it/test
  - [PixFechamento.test.jsx](#pixfechamentotestjsx) — 1 describe · 3 it/test
  - [planilhaSemLogo.evidencia.test.jsx](#planilhasemlogoevidenciatestjsx) — 1 describe · 2 it/test
  - [planilhaSemPreco.s7.test.jsx](#planilhasemprecos7testjsx) — 4 describe · 8 it/test
  - [PlanoExportModal.semPreco.test.jsx](#planoexportmodalsemprecotestjsx) — 1 describe · 2 it/test
  - [pontePelaNuvem.evidencia.test.jsx](#pontepelanuvemevidenciatestjsx) — 1 describe · 8 it/test
  - [pontePeloMac.evidencia.test.jsx](#pontepelomacevidenciatestjsx) — 1 describe · 4 it/test
  - [pontePeloMac127.evidencia.test.jsx](#pontepelomac127evidenciatestjsx) — 1 describe · 4 it/test
  - [portaDeImportarBloqueada.evidencia.test.jsx](#portadeimportarbloqueadaevidenciatestjsx) — 2 describe · 5 it/test
  - [portasDeDinheiro.faixa.test.jsx](#portasdedinheirofaixatestjsx) — 4 describe · 17 it/test
  - [PresentationMode.test.jsx](#presentationmodetestjsx) — 1 describe · 1 it/test
  - [ProtecaoModal.revisao.test.jsx](#protecaomodalrevisaotestjsx) — 2 describe · 7 it/test
  - [publicoDeReferencia.test.jsx](#publicodereferenciatestjsx) — 8 describe · 17 it/test
  - [quantidadeTravada.s6.test.jsx](#quantidadetravadas6testjsx) — 10 describe · 44 it/test
  - [receitaDosCenarios.test.jsx](#receitadoscenariostestjsx) — 4 describe · 10 it/test
  - [receitaQuebrada.test.jsx](#receitaquebradatestjsx) — 6 describe · 10 it/test
  - [receitaRealizada.s4.test.jsx](#receitarealizadas4testjsx) — 1 describe · 6 it/test
  - [redeDeSeguranca.evidencia.test.jsx](#rededesegurancaevidenciatestjsx) — 3 describe · 8 it/test
  - [ReportView.bilheteriaDoCenario.test.jsx](#reportviewbilheteriadocenariotestjsx) — 4 describe · 14 it/test
  - [ReportView.evidencia.test.jsx](#reportviewevidenciatestjsx) — 1 describe · 4 it/test
  - [ReportView.matriz.test.jsx](#reportviewmatriztestjsx) — 1 describe · 5 it/test
  - [ritmoNaSemanaFinal.test.jsx](#ritmonasemanafinaltestjsx) — 2 describe · 6 it/test
  - [Simulador.faixa.test.jsx](#simuladorfaixatestjsx) — 1 describe · 4 it/test
  - [ui.slider.moeda.test.jsx](#uislidermoedatestjsx) — 2 describe · 10 it/test
  - [vinculoEdicaoRitmo.fio.test.jsx](#vinculoedicaoritmofiotestjsx) — 1 describe · 5 it/test

## src/lib

### acuracia.test.js

*8 describe · 22 it/test*

- **temFechamentoInformado** — linha 50
  - sem nenhum realizado → não é fechado; com custo OU receita realizada → é — linha 51
- **acuraciaAgregada — contas à mão** — linha 61
  - um evento: médias = os desvios do próprio evento (+10% A&B, −10% Artístico, bilheteria −10%) — linha 62
  - dois eventos do mesmo tipo: média SIMPLES por evento ((+10 + +30)/2 = +20) — linha 78
  - agrupa por tipo de festa; evento sem tipo vai para o grupo ""  — linha 100
  - categoria com estimado 0 fica fora da média % (sem % inventado) — linha 109
  - categorias de eventos diferentes agregam por NOME aparado (ids internos diferentes) — linha 126
  - zero eventos fechados: estatística vazia explícita (a tela diz, não inventa) — linha 142
  - não muta nenhum evento (leitura pura) — linha 151
- **acuraciaContexto (aba Fechamento)** — linha 159
  - usa o agregado do MESMO tipo quando existe; senão cai no geral — linha 160
- **caso Brisa 14/03 (números reais do benchmark, conferidos à mão)** — linha 173
  - desvios batem com a conta à mão — linha 177
- **fraseDesvio** — linha 200
  - estouro, economia e zero em português — linha 201
- **o nome da linha da bilheteria tem UMA fonte, e a acurácia lê dela** — linha 222
  - a linha que o fechamento escreve é exatamente a que a acurácia procura — linha 223
  - a busca é POR NOME: uma linha com outro rótulo não é confundida com a bilheteria — linha 230
  - nenhum dos dois módulos volta a escrever o rótulo à mão — linha 240
- **acurácia: festa com dado quebrado fica fora da média, e a tela sabe disso** — linha 261
  - a média antiga, refeita à mão: com a quebrada dentro, A&B daria −45% (não +10%) — linha 275
  - a festa sã continua com +10% em A&B, e a quebrada vai para `fora` — linha 283
  - o contexto da aba Fechamento traz a lista de fora do mesmo tipo — linha 292
  - receita quebrada também acusa; festa sã não — linha 302
  - sem festa acusada, `fora` é vazio e não há frase — nada muda na tela — linha 307
- **fraseForaDaMedia concorda em número** — linha 316
  - singular: um evento, "para ele voltar" — linha 319
  - plural: "eventos ficaram", "por terem", "nas festas para eles voltarem" — linha 324
  - mais de três: nomeia três e conta o resto — linha 331

### analiseCaixa.test.js

*9 describe · 35 it/test*

- **saidasDoEvento** — linha 83
  - separa com data × sem data; parcela vira uma saída cada; valor 0 não é saída — linha 84
  - parcelas divergentes do custo aparecem em divergencias (aviso, nunca silêncio) — linha 98
  - o valor da saída sem parcelas é o valorConsiderado (realizado vence) — linha 107
- **entradaAteODia — interpolação linear entre os pontos do plano** — linha 115
  - nos marcos devolve o marco; entre marcos, a reta; fora, 0 ou o último — linha 116
- **analisarCaixa — o exemplo completo, conferido à mão** — linha 131
  - roda (ok) e a linha vai de D-60 a D-0 — linha 134
  - D-45: saldo = 2.000 + 5.000 − 0 = 7.000 (conferido à mão) — linha 143
  - D-30: saldo = 2.000 + 10.000 − 8.000 = 4.000 (sinal do espaço no dia) — linha 146
  - D-29: saldo = 2.000 + 10.333,33 − 8.000 = 4.333,33 (reta entre marcos) — linha 149
  - D-15: saldo = 2.000 + 15.000 − 11.000 = 6.000 (parcela 1 do DJ em D-15) — linha 152
  - D-0: saldo = 2.000 + 20.000 + 3.000 (patrocínio fechado no dia da festa) − 11.000 = 14.000 — linha 155
  - caixa mínimo para iniciar = menor saldo da linha = R$ 2.000 em D-60 — linha 159
  - nunca fica negativo neste exemplo — linha 163
  - proposta NÃO entra: só o patrocínio fechado (3.000) — linha 166
  - parcela pós-festa (DJ 2/2 em D+7) fica fora da linha, listada à parte — linha 169
  - custo sem data fica fora, com aviso de quantos são — linha 173
  - agenda ordenada por dia, cada vencimento com o saldo do próprio dia — linha 176
  - totais: entrada final 23.000 (curva 20.000 + patrocínio 3.000), saída 11.000 — linha 185
- **analisarCaixa — casos de borda** — linha 191
  - fica negativo quando a saída vence antes da venda: primeiroNegativo aponta o dia — linha 192
  - caixaInicial vazio = R$ 0 (padrão da conta aprovada); string numérica vale — linha 207
  - saída antes de D-60 estica a linha do tempo (nada some) — linha 215
  - sem data do evento → { ok:false, motivo } — linha 224
  - sem curva do plano → { ok:false, motivo } (a conta precisa da entrada) — linha 230
  - data de pagamento ilegível vira "sem data" (nunca some em silêncio) — linha 235
  - divergência de parcelas do evento aparece no resultado — linha 243
- **temAgendaDePagamento** — linha 252
  - true com data única ou parcelas; false sem nada — linha 253
- **início de vendas (Sessão F2-S — antes do início só há saídas)** — linha 265
  - saída antes do início derruba o saldo SEM entrada — o "caixa mínimo para iniciar" fica verdadeiro — linha 266
- **parcela PAGA — sugestão 38, Interpretação A (fluxo quitado sai da linha do tempo)** — linha 299
  - saidasDoEvento: a parcela paga sai de `saidas` e entra em `pagas` (nunca some) — linha 319
  - a linha do tempo fica exata: D-15 sobe a 9.000, festa a 17.000, saídas 8.000 (conta à mão) — linha 335
  - parcela paga SEM data de vencimento é quitada, não "sem data" (quitada não deve data) — linha 351
  - REVERSÍVEL: desmarcar (paga false + dataPaga \'\') devolve a análise byte a byte — linha 359
  - o realizado do custo permanece INTOCADO — pagar parcela não fecha custo — linha 368
- **P2 S3 — cachê acima da receita nunca fica coberto por estorno** — linha 378
  - %s: pico e final 200 mil; caixa/agenda -20 mil em D-11 *(each)* — linha 379
- **S3 adendo — consumidor une marcos antigos antes da interpolação** — linha 393
  - dia %s: entrada %s *(each)* — linha 395
  - antes e no primeiro marco duplicado D%s *(each)* — linha 399
  - cachê de 30 mil deixa mínimo, agenda e final em menos 5 mil — linha 403

### aparencia.test.js

*6 describe · 16 it/test*

- **formaAparencia** — linha 21
  - qualquer entrada torta vira o padrão (nada inválido entra calado) — linha 22
  - aceita acento e festas válidos, normalizando para minúsculas — linha 28
  - descarta cor de festa inválida e tipo vazio, preservando as válidas — linha 33
- **corFesta — cadeia escolhida → padrão da marca → rosa livre** — linha 41
  - sem preferência, as 4 marcas usam o NOVO mapa da casa (F2-Y) — linha 42
  - festa custom sem preferência nasce no rosa (a cor livre da paleta) — linha 50
  - preferência dos Ajustes vence o padrão; inválida cai no padrão — linha 54
  - sem categoria ("" ou null) = neutro, nunca cor de marca — linha 60
- **corAcento** — linha 66
  - padrão = azul da marca; escolhido vence; inválido volta ao padrão — linha 67
- **derivações de cor** — linha 74
  - hexParaRgb decompõe e rejeita formato inválido — linha 75
  - escurecer produz hex válido mais escuro (hover do acento) — linha 81
  - comAlpha vira rgba com o alpha pedido (tinta do acento) — linha 87
- **constantes da marca** — linha 92
  - os swatches são a paleta oficial + quase-preto, todos válidos — linha 93
  - padrões por festa batem com o NOVO CORES_MARCA da casa (F2-Y) — linha 105
- **tema (sugestão 31 / tema G)** — linha 115
  - formaAparencia aceita tema válido e cai no claro quando inválido/ausente — linha 116
  - TEMAS lista os três modos — linha 123
  - temaEscuroEfetivo: escuro=sim, claro=não (independe do sistema) — linha 126

### atalhoHistorico.test.js

*3 describe · 7 it/test*

- **atalhos fora de campo de texto** — linha 7
  - Cmd+Z desfaz e Cmd+Shift+Z refaz — linha 8
  - Ctrl serve igual (teclado de PC), e Ctrl+Y também refaz — linha 15
  - maiúscula (Shift muda o key para Z) continua valendo — linha 23
  - sem foco nenhum (corpo da página) o atalho vale — linha 29
- **o atalho NÃO é sequestrado dentro de um campo de texto** — linha 34
  - digitando num campo, Cmd+Z é o desfazer nativo do input — linha 35
  - mas um checkbox ou um select não são digitação — ali o atalho vale — linha 44
- **o que NÃO é atalho de histórico** — linha 52
  - Z sem modificador, outras teclas com modificador, e Alt junto — linha 53

### avisoBar.test.js

*1 describe · 13 it/test*

- **aviso de bar não informado (Marco, 27/07/2026)** — linha 23
  - avisa exatamente nos cenários vazios, e não no que está preenchido — linha 24
  - o aviso é sobre um R$ 0 que ninguém digitou — provado contra o cálculo real — linha 32
  - bar FIXO nunca avisa — lá o valor é um só para os três — linha 47
  - OPEN BAR nunca avisa — o R$ 0 ali é a resposta certa e declarada — linha 52
  - com os três preenchidos não há aviso nenhum — linha 57
  - zero digitado À MÃO não avisa mais — é resposta, não esquecimento — linha 68
  - mas o campo VAZIO continua avisando — a metade que a regra de 27/07 protege — linha 74
  - e a CONTA não muda: zero explícito segue contando R$ 0 de bar — linha 80
  - o valor oferecido para copiar é o do realista quando ele existe — linha 90
  - sem realista, cai no otimista; sem nenhum, não há o que copiar — linha 94
  - o texto do aviso diz o valor do outro cenário, para o número não virar mistério — linha 101
  - sem nenhum ticket preenchido, o aviso não inventa valor nenhum — linha 108
  - evento sem nada não quebra — linha 114

### avisoExportVerdade.test.js

*3 describe · 8 it/test*

- **o aviso do export diz a verdade — SEM contingência** — linha 51
  - não há linha de contingência no arquivo — linha 55
  - toda linha de custo leva o ESTIMADO, nenhuma leva o realizado — linha 59
  - o aviso aparece e NÃO fala em exceção — porque aqui não existe nenhuma — linha 65
- **o aviso do export diz a verdade — COM contingência (o caso comum)** — linha 74
  - a linha de contingência exportada É derivada do realizado — o fato que o aviso tem de contar — linha 79
  - o aviso DECLARA a exceção, com o valor e a base — nada de promessa categórica falsa — linha 90
  - mesmo com contingência, as LINHAS DE ITEM seguem pelo estimado (o número não mudou) — linha 107
  - a contingência é o ÚNICO valor do arquivo derivado do realizado — o aviso não mente por omissão — linha 112
- **sem nenhum realizado, o aviso nem aparece** — linha 123
  - evento só com estimado não ganha o aviso — linha 124

### backupAoSair.test.js

*4 describe · 11 it/test*

- **o caminho normal do "Sair" não mudou** — linha 44
  - devolve o JSON do backup e não deixa marca de falha nenhuma — linha 45
- **a falha continua devolvendo "" — e agora deixa rastro** — linha 53
  - o contrato com o Swift NÃO muda: string vazia quer dizer "não grave nada" — linha 54
  - a marca guarda motivo e hora, e mora no DISCO — é o que atravessa o "Sair" — linha 65
  - a estrutura circular de verdade (a causa mais provável) é pega — linha 78
  - erro sem mensagem não vira marca vazia — o aviso sempre diz alguma coisa — linha 86
  - motivo enorme é cortado — a faixa é uma linha, não um despejo de pilha — linha 106
  - a hora é injetável, então a marca não depende do relógio de quem roda — linha 113
- **garantias de ambiente: nunca lança, nem sem localStorage, nem com ele quebrado** — linha 120
  - sem localStorage nenhum, o "Sair" ainda devolve "" e não derruba o app — linha 121
  - armazenamento CHEIO — que é uma das causas plausíveis do problema — não vira segunda falha — linha 136
- **a marca é lida com desconfiança e some quando o usuário manda** — linha 156
  - lixo gravado na chave devolve null em vez de quebrar a abertura do app — linha 157
  - limpar apaga a marca — linha 167

### backupEnvenenado.test.js

*6 describe · 12 it/test*

- **backup envenenado — OBJETO onde se espera número (preço do lote)** — linha 62
  - o preço vira "não informado" na migração e o lote passa a valer R$ 0 na conta — linha 63
  - parseBackup ACEITA o arquivo (o envenenamento não é recusado na porta) — linha 81
- **backup envenenado — DINHEIRO EM TEXTO BRASILEIRO onde se espera número** — linha 90
  - custo estimado "1.234,56" vira "não informado" — o item some do orçamento — linha 91
  - a mesma quantia em notação decimal ("1234.56") ATRAVESSA byte a byte — o outro lado da moeda — linha 105
- **backup envenenado — o censo do import passa a contar o tipo trocado (Marco, 25/07/2026, caso 2)** — linha 117
  - objeto, texto brasileiro fora da notação decimal e Infinity agora GERAM item de censo, um por campo — linha 125
  - o censo continua contando o que ele já contava: número presente e fora da faixa — linha 140
  - o censo NÃO lista campo vazio/ausente — "não informado" de propósito não é corrupção — linha 150
- **backup envenenado — null no meio da LISTA DE CUSTOS (Marco, 25/07/2026, caso 1 — recusa o que quebra)** — linha 161
  - parseBackup RECUSA o arquivo, nomeando o evento e a categoria — nada foi importado — linha 176
  - EVIDÊNCIA (o defeito que a recusa acima existe para evitar, medido por baixo do parseBackup): com o null no lugar, a conta de custos LANÇA — linha 189
- **backup envenenado — `versao` do envelope AUSENTE (Marco, 25/07/2026, caso 3 — entra, com aviso)** — linha 201
  - arquivo com `app` desta casa e SEM `versao` agora É SINALIZADO (reusa `formatoAntigo`) antes de aplicar — linha 202
  - `versao` como texto não-numérico ("abc") tem o mesmo desfecho — sinalizado, não recusado — linha 214
- **backup LIMPO continua entrando — o outro lado de toda régua deste arquivo** — linha 220
  - export sintético → parseBackup → mesmos números, sem censo e sem marca de formato antigo — linha 221

### backupExterno.test.js

*6 describe · 30 it/test*

- **deveEnviarHoje (guard de 1×/dia)** — linha 66
  - nunca enviou → deve enviar — linha 77
  - já enviou hoje → não envia de novo — linha 81
  - enviou ontem → envia — linha 84
  - marcador ilegível → envia (nunca trava o backup) — linha 87
- **enviarBackupExterno** — linha 92
  - sucesso: POST no destino único, com o MESMO payload do export manual e o token no cabeçalho — linha 93
  - sem token configurado → { ok:false, motivo:sem-token }, rede intocada (H2-B) — linha 118
  - Financeiro recusa o token (403) → { ok:false, motivo:token } (H2-B) — linha 127
  - Financeiro fechado (fetch lança) → { ok:false, motivo:fechado }, sem exceção — linha 136
  - resposta HTTP de erro → { ok:false, motivo:erro, status } — linha 146
  - corpo ilegível ou sem ok:true → { ok:false, motivo:erro } — linha 155
- **enviarBackupExterno — guarda de store vazio (§9.11 nº 5)** — linha 182
  - store vazio: NEM TOCA a rede e diz o motivo — linha 183
  - store nulo (o que sobra de uma leitura que falhou) também é recusado — linha 196
  - só um benchmark próprio já é dado de verdade — esse vai — linha 205
  - store com previsões continua enviando normalmente (a guarda não atrapalha) — linha 216
- **talvezEnviarBackupDiario (abertura do app)** — linha 224
  - store sem dados → não tenta nem toca a rede — linha 240
  - com dados e sem envio hoje → tenta; sucesso devolve tentou+ok — linha 256
  - Financeiro fechado → tentou e ok:false (vira aviso discreto, nunca erro) — linha 276
  - sem token configurado → tentou e motivo sem-token, rede intocada (H2-B) — linha 294
- **round-trip do arquivo enviado (prova b do hardening 1.1)** — linha 305
  - o JSON enviado reimporta via parseBackup e produz números IDÊNTICOS — linha 306
- **backup na cópia da nuvem — sem rede, sem token, um aviso só** — linha 354
  - envio manual na nuvem: motivo "origem" na hora, rede intocada, e a frase NÃO pede token — linha 359
  - envio manual na nuvem com o app VAZIO: a frase da nuvem, e não a de "apagaria o arquivo bom" — linha 375
  - envio manual na 4173 com o app vazio: a guarda de sempre ("sem-dados"), intacta — linha 384
  - envio manual na 4173 sem token: o mesmo "sem-token" de antes, com a mesma frase — linha 392
  - abertura na nuvem: não tenta, não pede token; o aviso calmo sai na PRIMEIRA vez e não na segunda — linha 400
  - o aviso da nuvem diz onde o backup diário funciona e o que fazer — e não fala de token — linha 412
  - na nuvem com app vazio (a sócia abrindo pela primeira vez): nem aviso — não há o que guardar — linha 419
  - na nuvem sem armazenamento usável: o aviso volta a cada abertura, sem erro no console — linha 426
  - abertura na 4173 sem token: o mesmo de antes — tentou, "sem-token", e a faixa pede o token — linha 437
  - abertura na 4173 com sucesso: sem aviso, como antes — linha 446
  - Ajustes › Backup: na nuvem diz que não há envio automático; na 4173, a frase de antes — linha 451

### backupIdentidade.test.js

*1 describe · 8 it/test*

- **backup: identidade + versão conferidas no import (E2 — plano 22/07/2026)** — linha 45
  - (b) backup de versão FUTURA (999) é RECUSADO nomeando a versão — nada importa — linha 48
  - (b2) versão futura como STRING "999" (backup editado à mão) também é recusada — linha 61
  - (b3) versão IGUAL à atual passa (não é futura) e não é marcada como antiga — linha 66
  - (c) arquivo de OUTRO app é RECUSADO, nomeando o app do arquivo — nada importa — linha 75
  - (d) backup ANTIGO (sem app/versao) IMPORTA, marcado formatoAntigo=true — aviso, nunca silêncio — linha 89
  - (d2) fixture de backup ANTIGO REAL (formato pré-17/07: sem app, sem versao) importa ao vivo — linha 103
  - (a) backup NOVO exporta com app+versao e REIMPORTA limpo (round-trip byte-fiel nos dados) — linha 135
  - (a2) backup NOVO com app certo e versao 1 não é confundido com formato antigo — linha 152

### backupIdsDuplicados.test.js

*1 describe · 4 it/test*

- **backup com ids duplicados no arquivo — recusa nomeando (H3-AUDIT S2)** — linha 20
  - (a) dois eventos com o MESMO id no arquivo → parseBackup RECUSA, nomeando id e eventos — linha 21
  - (b) id do backup que TAMBÉM existe no store NÃO é recusado: re-import atualiza como hoje — linha 36
  - (c) backup normal (ids únicos) → importa sem reclamar — linha 45
  - (a2) três eventos, um par repetido no meio → recusa e nomeia SÓ o par — linha 51

### backupSemIdentificacao.test.js

*7 describe · 25 it/test*

- **backup sem identificação — caso 1: a chave `id` NÃO existe no arquivo** — linha 68
  - as 3 festas entram — nenhuma some no índice por id — linha 71
  - os R$ 149.400 de bilheteria bruta chegam inteiros (antes chegavam R$ 32.400) — linha 81
  - cada festa fica com identificação PRÓPRIA, em texto, e as três diferentes — linha 86
  - o parse DIZ quais festas ganharam identificação, pelo nome — linha 96
- **backup sem identificação — caso 2: `id: null` explícito** — linha 106
  - as duas festas com id nulo entram, com identificação nova e diferente — linha 107
- **backup sem identificação — caso 3: `id` que não identifica ninguém (objeto, lista, texto vazio)** — linha 117
  - `id: {}` nas duas festas: as duas entram, com identificação em texto — linha 121
  - `id: []` e `id: ""` também recebem identificação — nenhuma festa se sobrepõe à outra — linha 130
- **backup sem identificação — caso 4: MISTURA (uma festa com id, duas sem)** — linha 139
  - as 3 entram, e o id que o arquivo trazia é PRESERVADO — linha 143
  - só as duas SEM identificação são listadas como tendo ganhado uma — linha 150
  - a festa com id que JÁ existe no store continua ATUALIZANDO, não duplica — linha 157
- **o número anunciado é o que ENTROU, contado no resultado do merge** — linha 168
  - 3 festas sem id no arquivo → "3 festas entraram", 3 novas, 0 atualizadas — linha 169
  - festa do arquivo que já existe no store conta como ATUALIZADA, não como nova — linha 179
  - o texto do aviso diz quantas entraram, quantas ganharam identificação, e que reimportar repete — linha 188
  - arquivo com TODAS as festas identificadas: o aviso NÃO fala de identificação nova — linha 200
  - uma festa só: o aviso fala no singular — linha 210
  - uma festa só, e ela sem identificação: concordância no singular, sem "1 dela" — linha 216
  - duas festas, só uma sem identificação: "1 delas não tinha", no singular — linha 224
  - o aviso menciona benchmark e Ajustes SÓ quando o arquivo os trouxe — linha 231
  - festa que NÃO aterrissou é denunciada pelo nome — o aviso nunca infla o número — linha 242
- **nada de falso positivo: backup normal segue igual (princípio 2 — contrato)** — linha 262
  - festa com id de TEXTO não é tocada, e o censo não acusa nada — linha 263
  - festa com id NUMÉRICO legado (id: 7) não é tocada — id legado é identificação válida — linha 269
  - ids repetidos DENTRO do arquivo continuam recusados, nomeando o repetido — linha 275
  - re-importar o MESMO arquivo de festas identificadas continua atualizando, sem duplicar — linha 281
- **O RISCO QUE O MARCO ACEITOU, medido: reimportar o mesmo arquivo DUPLICA as festas** — linha 290
  - mesmo arquivo 2× → 6 festas na lista e R$ 149.400 duplicados (R$ 298.800 no total) — linha 296
  - o aviso da 1ª importação JÁ diz que reimportar o arquivo traz as festas outra vez — linha 306

### barPorPessoa.test.js

*6 describe · 21 it/test*

- **isBarPorPessoa — checagem estrita (filosofia do openBar)** — linha 63
  - só a string exata 'porPessoa' liga o modo novo — linha 64
- **preservação: evento fixo é byte a byte o de sempre** — linha 72
  - campo ausente, "", "fixo" e valores tortos: computeCenarios profundo-idêntico ao evento cru — linha 73
  - campos por-pessoa preenchidos NÃO vazam no modo fixo (ticket guardado, fora da conta) — linha 79
  - evento antigo migrado fica no modo fixo e calcula profundo-idêntico ao cru (com o pessimista já subido) — linha 90
- **a conta por pessoa (aprovada em 19/07/2026)** — linha 103
  - cortesia conta como pessoa: consumo = ticket × (pagos + cortesias) — linha 106
  - taxa do sistema aplicada UMA vez sobre o consumo e custo do sistema descontado UMA vez — linha 115
  - 3 tickets distintos geram 3 bares distintos (ticket é POR CENÁRIO) — linha 124
  - o bar por pessoa mexe SÓ no bar — bilheteria e custos idênticos; receita/lucro se movem pelo bar — linha 137
  - open bar MANDA em tudo: bar = 0 nos DOIS modos — linha 150
  - barPorPessoa expõe as parcelas da continha (consumo, sistema, líquido) — linha 163
  - campos vazios valem 0: evento por pessoa sem ticket tem bar R$ 0 (sem NaN) — linha 176
- **evento novo × evento antigo (o portão do padrão)** — linha 182
  - evento NOVO nasce com barModo 'porPessoa' EXPLÍCITO e campos vazios (bar R$ 0, como sempre nasceu) — linha 183
  - migração NUNCA retroage o padrão: evento salvo sem o campo segue fixo; modos válidos são preservados — linha 193
  - migração preserva ticket/taxa/custo válidos (número e string numérica) e normaliza torto para "" — linha 202
  - round-trip de backup ANTIGO (sem os campos): importa em modo fixo com números idênticos e reimporta estável — linha 217
  - computeCenarios não muta o evento (nos dois modos) — linha 239
- **fechamento (integração): bar realizado segue pedido igual; previsto acompanha o modo** — linha 249
  - modo por pessoa: bar previsto = o bar calculado do realista (o número da DRE) — linha 250
  - modo fixo: bar previsto continua o valor digitado (comportamento de sempre) — linha 260
  - open bar: a linha de Bar segue fora da conta nos dois modos — linha 268
- **frases fonte-única (premissa e continha)** — linha 276
  - premissaBar: só no modo por pessoa; tickets iguais viram um valor só, distintos viram os três — linha 281
  - contaBarPorPessoa: a continha com os números reais do cenário — linha 297

### benchmarks.test.js

*9 describe · 48 it/test*

- **edição de benchmarks (overrides)** — linha 35
  - sem override, devolve o benchmark original intacto — linha 36
  - editar uma categoria recalcula o custo total e marca como editado — linha 40
  - editar campos simples (público, nome) preserva os custos — linha 49
  - zerar uma categoria (null) tira ela da soma — linha 56
  - benchmarksDisponiveis aplica overrides e inclui os importados — linha 61
  - somaCustos ignora nulls — linha 72
- **ocultar benchmark das comparações (sugestão 25 — reversível, Sessão Q)** — linha 77
  - sem ocultos: visíveis = disponíveis (backup/store antigo sem a chave também) — linha 84
  - ocultar tira o benchmark (embutido OU custom) dos visíveis e o põe na lista de ocultos — linha 91
  - REVERSÍVEL: mostrar de novo devolve tudo como era — nenhum número foi tocado — linha 99
  - ocultar NÃO altera nem apaga o benchmark: ele continua íntegro na lista de ocultos — linha 110
  - idempotente: ocultar duas vezes não duplica o id; mostrar algo não oculto não quebra — linha 118
  - benchmarksAtivos exclui os ocultos SEM tocar em evento.benchmarksAtivos — linha 125
  - excluirBenchmarkCustom exclui de verdade E limpa o id da lista de ocultos — linha 137
  - lista de ocultos com lixo (não-string, não-array) é saneada — nunca quebra tela — linha 144
  - round-trip de backup: antigo (sem a chave) abre com nada oculto; com a chave, reimporta idêntico — linha 152
- **divisão por pessoa (sugestão 8)** — linha 172
  - divPorPessoa divide pelo público informado — linha 173
  - divPorPessoa devolve null sem público ou sem valor — linha 176
  - porPessoa continua igual (agora via divPorPessoa) — sem regressão — linha 181
- **pseudoBenchmarkDeCenario (sugestão 7, Sessão J — comparar previsões)** — linha 187
  - reshape básico: nome vem de fora, resto vem do cenário calculado — linha 205
  - custos só inclui as categorias padrão (CAT_KEYS) — categoria custom fica de fora, como nos benchmarks fixos — linha 216
  - não muta o cenário original nem tem chave em comum indevida com FIXED_BENCHMARKS — linha 229
- **apagar benchmark embutido (Sessão de Gestão de Benchmarks, 19/07/2026)** — linha 243
  - apagar tira o embutido de disponíveis, visíveis e ativos — mas some da lista principal e vai para a de apagados — linha 250
  - REVERSÍVEL: restaurar traz de volta exatamente como era — linha 262
  - idempotente e lista saneada (não-string/não-array não quebra) — linha 269
  - apagar PRESERVA as edições: restaurar devolve o benchmark com o override que tinha — linha 280
- **salvar como padrão / restaurar de fábrica (Sessão de Gestão de Benchmarks)** — linha 293
  - antes de salvar: a base atual mostra "editado" com os valores do Marco — linha 301
  - salvar como padrão: override some, "editado" some com verdade, e os valores viram a BASE — linha 309
  - depois de salvar, "Restaurar padrão" volta para a base SALVA (não a de fábrica) — linha 323
  - "Restaurar valores de fábrica" descarta padrão salvo E edições — volta ao ORIGINAL — linha 333
  - benchmarkBase: sem padrão salvo é a fábrica (mesma referência); com padrão salvo é a base salva, nunca "editado" — linha 346
  - salvar-como-padrão de id que não é embutido é no-op — linha 354
- **round-trip e reload de apagados/padrão (schema é contrato — princípio 2)** — linha 360
  - backup antigo SEM as chaves: apagados = null (não desapaga ao mesclar); padrão = {} (não mexe) — linha 361
  - backup COM as chaves: apagados substitui por inteiro; padrão mescla por id — linha 379
  - reload (saveStore → loadStore): apagados e padrão persistem — não voltam sozinhos — linha 406
- **consolidarCustosDePlanilha — a foto importada não pode esconder dinheiro (Marco, 27/07/2026)** — linha 432
  - categoria NEGATIVA continua na foto, com o sinal — e o total fecha com o que se vê — linha 441
  - a régua ANTIGA teria escondido R$ 3.000 — este é o número que o teste protege — linha 449
  - categoria ZERADA some da foto (é ruído, não informação) sem tirar nada do total — linha 463
  - zero ATÉ O CENTAVO some, nos dois sinais — linha 470
  - meio centavo EXATO: fica no positivo, some no negativo — assimetria herdada, documentada — linha 476
  - não arredonda o valor de quem tem dinheiro de verdade — linha 498
  - categoria ausente na planilha vira null, e as sete chaves sempre existem — linha 503
  - entrada vazia ou nula não quebra e não inventa número — linha 510
  - todas negativas: o total é negativo e nenhuma categoria desaparece — linha 518
- **lucroNaoFecha — o editor para de fingir que os três números concordam (Marco, 27/07/2026)** — linha 527
  - fecha: não avisa — linha 530
  - o caso REAL da Marfim 09/05: as categorias dizem lucro, o campo diz prejuízo — linha 534
  - resíduo abaixo de meio centavo não avisa; um centavo avisa — linha 540
  - sem receita ou sem lucro não há o que conferir — e não se inventa aviso — linha 549
  - lucro NEGATIVO que fecha continua sem aviso — prejuízo não é erro — linha 555

### bilheteriaBrutaBenchmark.evidencia.test.js

*7 describe · 30 it/test*

- **1. um backup JSON ANTIGO importa sem perder nada e sem ganhar nada** — linha 123
  - importa sem erro e traz os dois benchmarks do arquivo — linha 126
  - cada benchmark volta CAMPO POR CAMPO como estava no arquivo — linha 135
  - e nenhum deles ganhou uma chave nova — nem bilheteriaBruta, nem reguaTicket — linha 140
  - round-trip completo — importar e exportar de novo devolve o MESMO JSON de benchmarks — linha 149
  - pelo localStorage é a mesma história: gravar o antigo e ler devolve tudo igual — linha 159
  - a régua de cada um é LIDA, não gravada: nada é escrito no dado do Marco — linha 169
- **2. a migração devolve o MESMO OBJETO quando não há o que fazer** — linha 186
  - migrarBenchmark devolve a mesma referência, não uma cópia — linha 189
  - migrarBenchmarks devolve a MESMA LISTA quando nenhum item mudou — linha 193
  - benchmark COM o campo novo e já certo também passa por referência — linha 198
  - as telas de leitura seguem devolvendo o objeto salvo, por identidade — linha 203
  - migrar DUAS vezes é igual a migrar uma — e a segunda não inventa nada — linha 209
- **3. um backup gravado DEPOIS da mudança abre numa versão antiga do app** — linha 220
  - o ENVELOPE não mudou de versão — o app antigo não recusa o arquivo — linha 241
  - o app antigo lê o arquivo inteiro sem quebrar e sem perder campo conhecido — linha 256
  - e o campo que ele não conhece ATRAVESSA — reexportar pelo app antigo não o destrói — linha 268
  - ida e volta pelo app ATUAL preserva o campo e a régua que ele nomeia — linha 276
- **4. vazio e zero atravessam o round-trip como coisas diferentes** — linha 288
  - ZERO sobrevive como zero, e não vira "não anotado" — linha 296
  - AUSENTE sobrevive como ausente, e não vira zero — linha 304
  - LIMPAR o campo no editor (null) é lido como ausente, nunca como zero — linha 311
- **5. arquivo editado à mão não vira número inventado** — linha 322
  - bilheteria como TEXTO numérico vira número — o valor anotado não é ignorado — linha 333
  - bilheteria como texto SEM número é lida como ausente, e nada explode — linha 339
  - a normalização vale também pelo localStorage, não só pelo arquivo importado — linha 345
  - bilheteria NEGATIVA não é apagada em silêncio — ela aparece, e a tela a denuncia — linha 364
- **6. o benchmark que NASCE de uma planilha diz qual régua o mediu** — linha 374
  - o ticket é receita ÷ ingressos PAGOS — 150, e não os 120 de receita ÷ público — linha 386
  - e ele GRAVA a régua, porque o número de pagos não vai para o store — linha 392
  - sem a régua gravada, este mesmo benchmark seria indeduzível — a prova do porquê — linha 399
  - a régua sobrevive ao round-trip do backup — linha 405
  - planilha sem receita não inventa ticket nem lucro — linha 411
- **7. os embutidos do Marco seguem intocados, e a fábrica recuperável** — linha 420
  - a migração não encosta nos 4 valores de fábrica — linha 421
  - bilheteria digitada num EMBUTIDO vira override, e "restaurar de fábrica" a remove — linha 427
  - aplicarOverride não inventa o campo em quem não o tem — linha 441

### bilheteriaBrutaNoPromovido.evidencia.test.js

*2 describe · 7 it/test*

- **o benchmark promovido guarda a bilheteria bruta e a régua do ticket** — linha 47
  - grava a bilheteria BRUTA, e é a mesma que o card do Fechamento imprime — linha 48
  - grava a RÉGUA, e ela é a que o módulo da régua reconhece — linha 56
  - com os dois campos, o ticket VOLTA a ser recalculável — que é o ponto da decisão — linha 62
  - a observação diz qual conta produziu o ticket, com a frase que a TELA também usa — linha 68
- **e o dado JÁ SALVO do Marco não é tocado (princípio 2)** — linha 76
  - a migração devolve o benchmark antigo IDÊNTICO — nem preenche, nem inventa — linha 93
  - sem os campos novos, a régua dele NÃO é a nova — e a tela não finge que é — linha 102
  - a bilheteria bruta vinda como TEXTO de um backup editado à mão vira número — linha 109

### breakEven.test.js

*8 describe · 26 it/test*

- **a definição do Marco: o MÍNIMO de ingressos para não dar prejuízo** — linha 238
  - ${nome} · ${k}: no break-even o lucro é >= 0, e um degrau abaixo é < 0 — linha 245
  - vale também com override por lote, ticket manual e ajuste de custos ligados ao mesmo tempo — linha 251
  - vale com desconto de cupom no modo nº, em que a fração muda conforme o público — linha 266
  - vale com a taxa da bilheteria repassada ao cliente — linha 276
- **a escada INTEIRA de um evento pequeno: nenhum degrau escapa** — linha 304
  - ${k}: o break-even é o MENOR degrau da escada que fecha, e o de baixo dá prejuízo — linha 306
  - os três números da Festinha, fotografados — linha 326
- **quando não existe meta: "não fecha nem vendendo tudo"** — linha 334
  - devolve null e liga a marcação — nos três cenários — linha 344
  - a escada inteira do slider é de prejuízo — nenhum ponto fecha — linha 355
  - A META IMPOSSÍVEL: a conta antiga imprimia mais ingressos do que a festa tem para vender — linha 359
  - sobre LIXO não se afirma: quantidade estourada de backup editado à mão vira traço, não "não fecha" — linha 371
  - e o contrário: quando todos os pontos dão um lucro de VERDADE e nenhum fecha, aí sim afirma — linha 396
  - um evento sem lote nenhum: se o custo não está coberto, não fecha — linha 411
- **quando o custo já está coberto sem vender ingresso: zero** — linha 428
  - bar e patrocínio maiores que o custo → 0, e não é "não fecha" — linha 429
  - empate exato no zero conta como coberto — lucro zero não é prejuízo — linha 440
- **bar FIXO e OPEN BAR: sem circularidade, o número praticamente não muda** — linha 460
  - Brisa (bar fixo): a conta nova fica a no máximo 5 ingressos da antiga, nos três cenários — linha 461
  - Marfim (open bar): idêntico à conta antiga nos três cenários — linha 468
  - e continuam coerentes: cada um desses números passa nas duas asserções da régua — linha 477
- **bar POR PESSOA: a circularidade que derrubou a conta antiga** — linha 487
  - o Sobrado realista: a conta antiga pedia 227 ingressos; o mínimo verdadeiro é 851 — linha 488
  - o otimista era pior: a conta antiga dizia ZERO — "nem precisa vender ingresso" — linha 499
  - POR QUE errava: a conta antiga abatia do custo o bar da casa CHEIA — linha 510
- **o break-even e o slider contam a MESMA história** — linha 529
  - arrastar o cenário até o break-even zera o lucro — é a definição, verificada na tela — linha 530
  - a régua de vender menos é a do app — X% de CADA lote, nunca "enche o mais barato primeiro" — linha 544
- **a busca não morde o próprio rabo** — linha 563
  - computeCenario devolve número em vez de estourar a pilha — linha 564
  - nenhum outro número do cenário mudou de valor por causa da busca — linha 572
  - CONSEQUÊNCIA A DECIDIR: festa passada que não fecha perde a marcação "evento já realizado" — linha 604
  - o evento não é mutado pela busca — linha 639

### breakEvenTexto.test.js

*9 describe · 37 it/test*

- **o valor do break-even na tela** — linha 22
  - com meta, imprime o número com o sufixo que a tela pediu — linha 23
  - sem meta, diz que não fecha — e o sufixo não entra no meio da frase — linha 29
  - zero é um número de verdade e é impresso como tal — não é "sem informação" — linha 36
  - o traço fica só para o que realmente não dá para calcular — linha 40
- **a frase de posição embaixo do cartão do cenário** — linha 47
  - coberto: diz quantos contra quantos, com tom de ok — linha 48
  - faltando: diz quantos ingressos faltam, com tom de alerta — linha 55
  - sem meta: a frase é sobre o prejuízo, não sobre quantos faltam — linha 62
  - sem ingresso pago e sem aviso: não há frase nenhuma — linha 70
- **as pontas que o Marco lê, com um evento que não fecha** — linha 95
  - o cenário realmente não fecha — é a premissa das asserções abaixo — linha 96
  - "Copiar resumo" do WhatsApp diz que não fecha, em vez de mandar um traço — linha 104
  - a legenda "Como ler este relatório" explica em vez de prometer uma meta — linha 110
- **S6 — o texto da trava é o aprovado, palavra por palavra** — linha 150
  - a constante exportada é a frase do Marco — linha 151
- **S6 — detector temQuantidadeTravada: uma linha por situação, três cenários cada** — linha 156
  - %s *(each)* — linha 223
  - evento ausente, sem lotes e cenário desconhecido nunca acusam trava (e não estouram) — linha 230
  - o detector é só presença: vale mesmo quando o ajuste repete a quantidade automática — linha 240
- **S6 — a referência medida: o detector e o cálculo concordam sobre o que está travado** — linha 254
  - sem trava o mínimo realista é 568; só l1=0 → 523; cortesia extra com ajuste c=10 → 564; trava só no pessimista → realista 568 — linha 255
- **S6 — texto exato nas três funções, caso a caso** — linha 267
  - %s: o sufixo some e a frase do cartão é o aviso, com tom de alerta *(each)* — linha 280
  - cheio: o cálculo dá 1.200 pagos e mínimo 1.200 — e nenhum dos dois é impresso como meta — linha 295
  - 100/100/20: o cálculo diz "não fecha" (mínimo nulo) e a tela NÃO diz isso — diz a trava — linha 303
  - só l1=0: o mínimo calculado (523) não aparece em nenhuma das três funções — linha 314
  - cortesia com ajuste manual (c=10): trava; cortesia automática: continua numérico — linha 320
  - sem trava (vazio, null, ausente, órfã): texto numérico IDÊNTICO ao de antes — linha 328
  - trava só no pessimista: a coluna realista continua numérica, a pessimista diz a frase — linha 342
  - o cartão olha o cenário que recebe, não o realista: cada coluna tem a sua trava — linha 354
- **S6 — precedência: dado inválido (#98) > trava > não fecha > número/traço** — linha 363
  - 1. custo estimado 1e308 + trava: as guardas acusam ANTES, e a notícia é "não dá para calcular" — linha 366
  - 1b. ticket de bar realista 1e308 + trava: a RECEITA acusa e a notícia é a mesma — linha 380
  - 1c. ticket de bar do OTIMISTA 1e308 + realista travado: cada cenário diz o seu, ninguém contamina ninguém — linha 390
  - 1d. a soma que não cabe em OUTRO cenário (lote de R$ 1e306): só a visão dos três enxerga, e a notícia é "não dá para calcular" — linha 401
  - 2. trava > "não fecha": o cenário que não fecha COM ajuste não promete nem nega meta — linha 414
  - 3. sem trava, "não fecha" segue valendo — mesmo passando o evento e os cenários — linha 425
  - 4. sem trava e sem meta: número, e o traço só quando não há como calcular — linha 443
  - cenário ausente: aviso nulo, texto traço, sem estourar — linha 451
  - sem evento (chamada antiga): a trava nunca é lida, qualquer que seja o cenário — linha 459
  - cenarios omitido com evento presente: a trava vale e as guardas rodam sem a visão dos três — linha 467
- **S6 — leitura pura: nada do evento nem dos cenários muda** — linha 476
  - evento e cenários congelados em profundidade atravessam as três funções e o detector — linha 477
  - a leitura não deixa chave de apresentação no evento nem nos cenários — linha 498
  - (dinâmico: `k` — variável, valor muda por caso; ver código-fonte, linha 509) — linha 509

### calc.p8.test.js

*5 describe · 10 it/test*

- **API nova — isPrecoAusente e isCortesia (P8)** — linha 52
  - 1. isPrecoAusente: vazio, null, undefined e campo ausente são ausentes; 0, texto e espaços não — linha 53
  - 2. isCortesia: ausente NÃO é cortesia; 0 e "0" declarados são; 100 não é — linha 63
- **loteQtdCenario — o lote sem preço vale 0 ANTES do override e do "só otimista" (P8)** — linha 72
  - 3. 0 para preço vazio/null/undefined × qualquer ajuste × só-otimista × três cenários — linha 73
  - 4. controle: preço 0 declarado entra inteiro (300) e obedece o ajuste; preço 100 obedece o % — linha 85
- **bilheteria — quantidade passada para lote sem preço não vira pagante nem cortesia (P8)** — linha 96
  - 5. bilheteria(lotes, {l1: 540, c: 50, l4: 125}) → 540 pagos, 50 cortesias, 590 público, R$ 54.000 — linha 97
- **computeCenarios — com o lote sem preço é EXATAMENTE a festa sem ele (P8)** — linha 108
  - 6. %s *(each)* — linha 123
  - 7. lote sem preço de 100.000.000 ingressos: a conta leva menos de 1 s e o mínimo realista é 293 — linha 128
  - 8. texto ilegível no preço continua dado quebrado, não "sem preço" — linha 141
  - 9. consumidores: ingressos previstos 590 (= público realista) e o plano dos lotes sem o lote — linha 146
- **persistência — o lote sem preço e o ajuste ficam salvos como estavam (P8)** — linha 156
  - 10. censo vazio; export → import devolve valor "" e quantidade 300 com o ajuste 125; mesmos números — linha 178

### calc.test.js

*15 describe · 98 it/test*

- **receita por lote e taxa da bilheteria** — linha 53
  - calcula receita por lote, acumulada, total e ticket médio — linha 54
  - cashback Tiqueteira de 5% é recebido sobre a receita de ingressos — linha 70
  - sem cashback informado, desconto é só a taxa (compatível com eventos antigos) — linha 79
  - cortesia (valor 0) entra no público mas não na receita — linha 85
- **desconto médio nos ingressos (sugestão 17 — fórmula aprovada 18/07/2026)** — linha 96
  - vazio, ausente e 0% = conta EXATAMENTE igual à anterior — linha 97
  - 12%: realista à mão — bruta 25.000 × 0,88 = 22.000; taxa e cashback POR CIMA da descontada — linha 105
  - 12%: cenários agem por cima — pessimista 70% dos lotes E o desconto — linha 119
  - 100%: tudo de graça — receita zero, sem quebrar (break-even vira null) — linha 125
  - break-even fica coerente: com desconto, precisa de MAIS ingressos — linha 137
  - ticket médio MANUAL é preço de tabela: recebe o mesmo × (1 − desconto) — linha 145
  - ajuste % do ticket age por cima do desconto — nunca aplica desconto 2× — linha 159
  - o REALIZADO não muda: computeCenarios nem lê receitaRealizada — linha 168
  - custos e contingência não são tocados pelo desconto — linha 174
- **desconto parcial em dois modos (sugestão 29a — conta aprovada 19/07/2026)** — linha 188
  - descontoEfetivoPct: sem cupom = 0, qualquer que seja a fração — linha 189
  - descontoEfetivoPct: campos da fração vazios/ausentes = cupom em todos (campo antigo age como sempre) — linha 195
  - descontoEfetivoPct modo %: cupom 10 em 40% = 4%; 100% = cupom exato; 0% = 0 — linha 213
  - descontoEfetivoPct modo nº: fração = min(1, nº ÷ vendidos); negativo vale 0; sem vendidos = 0 — linha 220
  - descontoEfetivoPct: cupom de 1% NÃO é zerado (borda cupom === 1) — linha 231
  - neutralidade byte a byte: campos novos ausentes, vazios ou "modo %, 100%" = conta EXATAMENTE atual — linha 243
  - modo % à mão: cupom 10 em 40% → efetivo 4% — realista bruta 25.000 × 0,96 = 24.000 — linha 263
  - modo nº à mão: 70 ingressos com cupom 10 — a fração muda POR CENÁRIO — linha 273
  - modo nº: o denominador são os VENDIDOS (pagos) — cortesias ficam fora da conta — linha 288
  - modo nº: lote "só otimista" entra nos vendidos SÓ do otimista — linha 301
  - equivalência exata entre os modos quando a fração coincide: nº 100 no realista = 50% (o break-even é a ÚNICA exceção, e por um motivo) — linha 314
  - ticket médio MANUAL recebe o desconto EFETIVO 1× (regra da Sessão N, agora com fração) — linha 338
  - custos, contingência e realizado seguem intocados pela fração — linha 350
- **taxa paga pelo cliente (sugestão 29b — conta aprovada 19/07/2026)** — linha 366
  - isTaxaCliente é ESTRITO: só a string exata "cliente" liga o repasse — linha 367
  - padrão e valores tortos: conta EXATAMENTE atual, byte a byte — linha 377
  - repasse à mão: a taxa não desconta — realista líquida 25.000 (vs 22.500), break-even cai 148 → 134 — linha 385
  - cashback INALTERADO nos dois modos (regra explícita da sugestão) — linha 402
  - ticket médio MANUAL respeita o modo: repasse não desconta a taxa da líquida — linha 412
  - desconto (29a) e repasse (29b) compõem: líquida = bruta descontada + cashback — linha 422
  - custos e contingência não mudam com o modo da taxa — linha 433
- **quantidades por cenário** — linha 441
  - realista usa o que foi digitado, sem os lotes só-otimista — linha 443
  - pessimista aplica vendaPct nos pagos e mantém cortesias — linha 448
  - otimista esgota todos os lotes, incluindo o lote porta — linha 453
  - realista com % de venda ajustável (sobre o tamanho do lote) — linha 456
  - sem realista.vendaPct configurado, realista usa 90% (padrão desde 27/07/2026) — linha 464
  - sem pessimista.vendaPct configurado, pessimista usa 80% (padrão desde 27/07/2026) — linha 475
  - override manual vence a regra automática — linha 479
  - arredonda o percentual pessimista — linha 483
  - otimista com % de venda ajustável — conta dos vizinhos, incluindo o lote só-otimista — linha 489
  - otimista sem vendaPct (evento antigo) e com 100 explícito: esgota tudo, conta de sempre — linha 498
  - override manual vence a regra também no otimista com vendaPct — linha 511
- **custos, valor considerado e contingência** — linha 517
  - usa o realizado quando preenchido e maior que zero, senão o estimado — linha 518
  - subtotais por categoria e totais gerais — linha 524
  - contingência percentual sobre a base — linha 532
- **break-even** — linha 545
  - ingressos pagos necessários para o cenário parar de dar prejuízo — linha 546
  - zero quando bar e patrocínio já cobrem o custo sem vender ingresso — linha 552
  - zero também quando as outras receitas cobrem o custo EXATAMENTE (empate no fio) — linha 560
  - null + "não fecha" quando nem vendendo tudo o cenário sai do prejuízo — linha 570
- **cenários completos** — linha 581
  - realista — linha 582
  - pessimista: 70% dos ingressos e custos +10% — linha 594
  - otimista: lotes esgotados + porta e custos −5% — linha 602
  - realista com ajuste de custos: mesma conta dos vizinhos; 0 e "" = conta de sempre — linha 611
  - otimista com % de venda no cenário completo: receita cai, ajuste de custos próprio se mantém — linha 627
  - realista com cashback Tiqueteira de 5% sobre ingressos — linha 640
  - realista com 90% de venda dos lotes — linha 647
  - ticket médio manual: receita vira pagos × ticket, com taxa recalculada — linha 657
  - ticket médio em branco ou zero mantém o automático — linha 669
  - ajuste percentual do ticket médio sobre o automático — linha 676
  - ajuste percentual do ticket sobre o valor manual — linha 686
  - computeCenarios devolve os três — linha 694
- **veredito (semáforo) — regra do Marco 18/07/2026: realista dá a cor, pessimista rebaixa** — linha 701
  - verde: realista ≥ margem alvo e pessimista sem prejuízo — linha 708
  - amarelo por faixa: realista entre a mínima e o alvo — linha 713
  - amarelo por rebaixamento: realista ≥ alvo mas pessimista com prejuízo — linha 718
  - vermelho: realista abaixo da mínima (inclui prejuízo) — linha 723
  - vermelho quando margem do realista é null (sem receita) — linha 727
  - limites exatos: realista = mínima é amarelo; = alvo (sem prejuízo) é verde — linha 730
  - epsilon de ruído (Marco 20/07/2026): empate exato no fio da navalha NÃO é rebaixado por erro de float — linha 734
  - campos ausentes/vazios usam os padrões 28/20 — linha 748
  - campos preenchidos substituem os padrões (0 explícito vale 0) — linha 754
  - no evento de teste: realista tem margem ~20,9% → amarelo (abaixo do alvo 28) — linha 760
- **custosPorStatus** — linha 768
  - soma valorConsiderado por status, ORÇAR quando ausente — linha 769
  - categorias/itens vazios não quebram — linha 788
- **ritmoVendas (sugestão 10-P) — regra de três contra o break-even** — linha 795
  - exemplo da validação: faltam 300 e a janela de venda é de 42 dias — linha 804
  - os campos velhos SAÍRAM — ninguém os lia fora deste módulo — linha 813
  - vendidos ≥ break-even → cobriu, sem número de ritmo — linha 818
  - break-even 0 (outras receitas cobrem tudo) → cobriu com 0 vendidos — linha 823
  - evento no passado → eventoPassado, nunca número absurdo — linha 826
  - festa hoje → janela de venda ZERO; a menos de uma semana ela é só curta — linha 830
  - sem dado (campo vazio, sem data, sem break-even) → null, leitura não aparece — linha 837
  - vendidos 0 é dado válido (diferente de vazio) — linha 844
  - vendidos negativo é tratado como 0 — linha 849
- **ritmoVendas com início de vendas (Sessão F2-S — janela restante real)** — linha 854
  - vendas ainda fechadas: a janela conta do INÍCIO à festa (42 − 28 = 14 dias) — linha 858
  - sem o campo (ou vazio) → byte a byte a conta de sempre, SEM a chave nova — linha 867
  - início já passado (vendas abertas) → conta idêntica à de sempre — linha 873
  - início a menos de uma semana da festa → janela curta, e ela é declarada — linha 879
  - cobriu não muda com o início (já vendeu o que precisava) — linha 885
- **decomposicaoTicket (F2-Y — item 4): reparte o ticket, sem conta nova** — linha 891
  - as identidades fecham no bruto e no líquido exibidos (com cupom, paga por nós) — linha 892
  - sem cupom: tabela = bruto e cupom = 0 — linha 904
  - taxa paga pelo cliente: a parcela da taxa por ingresso zera — linha 912
  - sem ingresso pago → null (não há "por ingresso") — linha 919
- **loteQtdCenario — fronteira do arredondamento no pessimista e no realista** — linha 947
  - realista no PADRÃO (90%): 25 → 22,5 arredonda para CIMA, 23 (floor daria 22) — linha 950
  - pessimista com vendaPct explícito: 25×70% = 17,5 → 18, e 10×25% = 2,5 → 3 — linha 955
  - realista com vendaPct explícito também: 25×90% = 22,5 → 23 — linha 960
  - a fronteira vale dinheiro: 23 × R$ 80 = R$ 1.840, não R$ 1.760 — linha 967
- **loteQtdCenario — fronteira do arredondamento no otimista** — linha 973
  - meio ingresso arredonda para CIMA (Math.round, não floor): 25×90% = 22,5 → 23 — linha 974

### campoNumerico.test.js

*7 describe · 28 it/test*

- **parseCampoNumerico — formatos brasileiros aceitos** — linha 19
  - moeda completa: "R$ 1.234,56" — linha 20
  - ponto de milhar sem centavos: "8.000" vale oito mil (o bug S2 salvava 8) — linha 25
  - vírgula decimal: "1.234,56", "1,5" — linha 29
  - formato americano colado de fora: "1234.56" — linha 34
  - parênteses contábeis: "(500)" = −500 (decisão do Marco 20/07/2026), unificado com o importador — linha 37
  - formato americano colado de fora: "1,234.56" → 1234.56 — linha 42
  - sinal não alterna e menos unicode conta (achados A2/A3): "(-500)" e "−500" → −500 — linha 45
  - vazio (e só prefixo/espaço) vira campo vazio, nunca 0 forçado — linha 49
  - espaços em volta não atrapalham: " 500 " — linha 55
  - inteiros e negativos simples: "90", "-500", "-1.234,56" — linha 59
  - sufixo % é tolerado no campo de percentual: "9,5%" — linha 64
  - colar "25.000,000" num campo grava R$ 25.000,00, não R$ 25 (Marco, 30/08/2026) — linha 75
  - e a outra regra fica: "1,500" digitado sem ponto segue valendo mil e quinhentos — linha 84
- **parseCampoNumerico — digitação incompleta (não salva, não avisa)** — linha 90
  - "%s" é meio caminho de digitação *(each)* — linha 91
- **parseCampoNumerico — entrada inválida (não salva e AVISA)** — linha 98
  - "%s" nunca vira número em silêncio *(each)* — linha 99
- **formatarParaEdicao — exibição com vírgula, como manda o rulebook** — linha 109
  - formata em pt-BR — linha 110
  - vazio continua vazio — linha 117
  - round-trip: o que o campo mostra volta a ser o mesmo número salvo — linha 122
- **deveLargarRascunho — o campo não pode mentir depois de um desfazer** — linha 132
  - sem rascunho (campo fora de edição) não há o que largar — linha 133
  - digitando: o valor que chega É o do rascunho — o rascunho fica — linha 137
  - desfazer: o valor volta ao anterior e o rascunho SAI da frente — linha 143
  - rascunho a meio caminho ("1.234,") também sai quando o valor muda por fora — linha 149
  - rascunho inválido ("8 mil") sai quando o valor muda por fora — linha 155
- **foraDaFaixa — a trava 0..100 dos campos de percentual** — linha 162
  - dentro da faixa (0, 100 e o meio) não dispara — linha 163
  - fora da faixa dispara nos dois lados (150 e -20) — linha 169
  - vazio é "não informado" e não dispara; sem faixa nunca dispara — linha 174
  - o aviso da faixa fala português e diz a regra — linha 180
- **P3 — campo conserva recusa do parser** — linha 186
  - não salva %s *(each)* — linha 187

### carregarBenchmark.test.js

*7 describe · 28 it/test*

- **propostasCarregar** — linha 38
  - uma proposta por categoria COM valor (marketing null fica de fora) — linha 39
  - escopo por categoria: só a categoria pedida — linha 46
  - marca categoria que já tem itens (para a UI pedir somar/substituir) — linha 52
  - categoria padrão removida do evento entra como proposta (existe:false) — linha 60
- **aplicarCarregar** — linha 68
  - cria UM item por categoria escolhida: total como estimado, status ESTIMADO, origem na obs, id próprio — linha 69
  - somar anexa; substituir troca os itens da categoria pelo do benchmark — linha 80
  - PURA: nem o evento nem o benchmark são mutados — linha 89
  - categoria padrão removida é recriada com o item — linha 99
  - categoria sem valor no benchmark é ignorada (marketing null) — linha 109
- **desfazerCarregar — tira o que a ação criou e NADA mais** — linha 121
  - categoria vazia: some a linha carregada e a categoria volta a ficar vazia — linha 130
  - custo digitado DEPOIS, na MESMA categoria que a ação tocou, sobrevive ao Desfazer — linha 137
  - lote e patrocínio digitados na janela do toast NÃO voltam atrás (o desfazer só mexe em categorias) — linha 152
  - modo substituir: os itens trocados voltam, e o que veio depois continua lá — linha 167
  - edição feita DEPOIS num item antigo da categoria tocada é preservada (não volta ao valor velho) — linha 189
  - categoria recriada pela ação some no desfazer; mas se o Marco lançou algo nela, ela FICA com o dele — linha 207
  - categoria apagada entre a ação e o clique não é ressuscitada — linha 226
  - PURA: não muta o evento de agora nem a foto de antes — linha 233
- **aplicarCarregar com itemId — o id vem de fora para o Desfazer saber o que tirar** — linha 244
  - o item criado nasce com o id que a tela sorteou; sem itemId, o id é o do novoItem — linha 245
- **rotuloCarregar — o botão diz o efeito (princípio 9)** — linha 255
  - planilha inteira e por categoria; singular/plural — linha 256
- **carregarBenchmark.js — a frase que promete o status do item criado** — linha 349
  - a frase existe e é única no bloco de aplicarCarregar (sem isto, o resto passaria sem olhar nada) — linha 350
  - a frase nomeia a constante STATUS_CUSTO_PADRAO (e não um status escrito à mão) — linha 359
  - o status citado POR ESCRITO na frase é o que o item criado nasce tendo — linha 365
  - e esse status é mesmo o default da casa (a frase não pode citar outro status válido) — linha 382
- **S4 inversão global por ID** — linha 388
  - histórico já restaurou 12000: toast é no-op por referência e não duplica 24000 — linha 391
  - original editado e movido vence foto antiga, carregado movido sai — linha 392
  - replay não dobra 17000 em duas categorias — linha 393
  - rebase de fotos fica só no evento da ação e preserva as fotos recebidas — linha 397
  - preparar desfazer distingue ausência de sucessor, foto intacta e foto alterada — linha 416

### censoDatasImpossiveis.test.js

*5 describe · 20 it/test*

- **censoDatasImpossiveis — as datas que sobrevivem sem ser data** — linha 63
  - acha a data da festa, a do pagamento e a da parcela, com o nome do evento — linha 64
  - bissexto de verdade: 29/02/2024 é data, 29/02/2026 não é — linha 75
  - o que a migração APAGA não entra: o mesmo 31/04/2026 conta no evento e não no pagamento — linha 85
  - vazio e ausente NÃO entram — são "não informado" de propósito — linha 97
  - arquivo limpo, entrada inválida e lixo não explodem — linha 101
- **o texto do aviso diz a verdade: nada é apagado** — linha 108
  - a frase promete que a data entra COMO ESTÁ — linha 109
  - singular e plural, como o resto dos avisos da casa — linha 117
- **avisoDeImport — dois censos, um diálogo, cada um com a sua frase** — linha 124
  - só números: a frase de sempre, sem falar de data — linha 125
  - só datas: a frase de datas, sem prometer que algo vira "não informado" — linha 132
  - os dois juntos: as duas frases, e o "Continuar?" uma vez só — linha 139
  - arquivo limpo devolve vazio — a tela usa isso para não perguntar nada — linha 149
- **o aviso não apaga nada — a decisão (b) do Marco, provada** — linha 157
  - depois de migrar, as três datas tortas continuam exatamente como vieram — linha 158
  - o censo é leitura pura: rodar não muda o objeto que foi passado — linha 167
- **os dois censos dividem as SEIS portas de data, sem sobra nem repetição** — linha 184
  - forma ISO impossível (2026-13-99): as seis SOBREVIVEM, nenhuma é apagada — linha 185
  - forma brasileira (31/04/2026): cinco são APAGADAS e só a data da festa sobrevive — linha 193
  - data de verdade não entra em balde nenhum — linha 201
  - cada campo cai em UM balde só — nunca nos dois — linha 207
  - o balde das apagadas promete a MESMA coisa que o censo numérico — linha 217
  - e a promessa é VERDADE: depois de migrar, os cinco estão vazios — linha 225
  - o aviso do import junta os TRÊS blocos, com um "Continuar?" só — linha 235

### censoImportAtaque.test.js

*4 describe · 20 it/test · 2 skip*

- **ataque por porta — número GRANDE DEMAIS na fronteira do backup** — linha 76
  - 310 noves como número do JSON já chegam como infinito ao app — o JSON.parse não avisa nada — linha 80
  - o infinito vira "não informado" na migração — o custo de R$ 20.000 do arquivo some — linha 86
  - CONSERTO (Marco, 25/07/2026, caso 2 — régua do backup mexido à mão): o censo do import agora CONTA o infinito — linha 96
  - EVIDÊNCIA (achado em aberto): 309 dígitos (1e308) são FINITOS — atravessam inteiros e a conta devolve um absurdo — linha 112
  - EVIDÊNCIA (achado em aberto): o mesmo 1e308 escrito como TEXTO no arquivo também atravessa — linha 138
  - o mesmo 310 noves como TEXTO é barrado pela régua de string (Number(…) não é finito) — linha 152
  - PROPOSTA (aguarda decisão do Marco): valor de dinheiro grande demais para o app somar é recusado ou anunciado **(SKIP)** — linha 163
- **ataque por porta — a normalização que o IMPORT anuncia, a ABERTURA faz calada** — linha 177
  - no import, o percentual fora da faixa é ANUNCIADO (o caminho honesto, guarda de não-regressão) — linha 178
  - EVIDÊNCIA (achado em aberto): o MESMO valor lido do localStorage na abertura vira "" sem nenhum sinal — linha 184
  - PROPOSTA (aguarda decisão do Marco): a abertura também conta o que normalizou **(SKIP)** — linha 201
- **instantâneo restaurado — CORRIGIR E MOSTRAR (decisão 18 do Marco, 25/07/2026)** — linha 213
  - CONSERTO (era S1): o instantâneo restaurado devolve R$ 10.150 de lucro, não os R$ 54.250 crus — linha 259
  - CONSERTO: o número PARA de mudar sozinho — restaurar, salvar e recarregar dão o mesmo lucro — linha 278
  - CONSERTO (princípio 7): o instantâneo CRU continua guardado, intacto, depois de restaurar — linha 294
  - CONSERTO (princípio 4): a revisão diz item a item o que mudou, em qual evento, de que valor para qual — linha 308
  - instantâneo com dados SÃOS não pede revisão nenhuma e volta idêntico — linha 328
  - restaurar DUAS VEZES seguidas não corrige duas vezes — a conta é a mesma — linha 342
- **a MESMA porta na lixeira — quem sai de lá também passa pela migração** — linha 353
  - CONSERTO: o evento restaurado da lixeira volta com R$ 10.150 de lucro, não com os R$ 54.250 crus — linha 386
  - CONSERTO: e a lixeira também DIZ o que corrigiu, item a item — linha 399
  - CONSERTO: restaurar da lixeira COMO CÓPIA corrige igual — a terceira porta não ficou de fora — linha 412
  - evento SÃO volta da lixeira sem revisão nenhuma — restaurar continua um clique só — linha 427

### chavePonte.test.js

*3 describe · 8 it/test*

- **normalizarChave** — linha 33
  - tira espaços e quebras de linha das pontas (colar o arquivo inteiro) — linha 34
  - vazio, null e undefined viram string vazia — linha 38
- **saveChavePonte / loadChavePonte** — linha 46
  - salvar → ler devolve a chave normalizada — linha 47
  - salvar vazio remove a chave (jeito explícito de esquecer) — linha 53
  - sem localStorage nenhum → devolve vazio, nunca lança e NÃO polui o console — linha 69
  - localStorage meio-inicializado (global existe, getItem não é função) → mesmo resultado — linha 79
  - localStorage que lança (quota/perfil corrompido) → nunca lança — linha 90
- **contrato do cabeçalho** — linha 109
  - o nome do cabeçalho é o mesmo que o Financeiro exige — linha 110

### colunaSempreTermina.test.js

*1 describe · 2 it/test*

- **a coluna da comparação sempre TERMINA de fechar (mutação 28/07/2026, comparacaoCustos.js:232)** — linha 70
  - fila de elegíveis VAZIA com resto positivo: termina e fecha pelo absorvedor — dois pontos de dentro da região que travava o mutante — linha 71
  - ramo SOBRA com itens de verdade (oito linhas de R$ 0,99, resíduo maior que a fila): termina e fecha — linha 96

### comparacaoCustos.test.js

*7 describe · 27 it/test*

- **coluna da previsão fecha no custo total exibido** — linha 110
  - fecha com valores redondos (o caso fácil, que já fechava) — linha 111
  - fecha com centavos em todas as categorias — linha 117
  - fecha com o pior caso do arredondamento: tudo terminando em ,50 — linha 132
  - fecha com rateio de terços (,66 / ,67) — o caso do custo dividido em 3 — linha 149
  - fecha com categoria criada pelo Marco (fora das 7 do histórico) — linha 161
  - fecha com ajuste de cenário POSITIVO — linha 175
  - fecha com ajuste de cenário NEGATIVO — linha 187
  - fecha sem contingência e sem ajuste (evento cru) — linha 199
  - não inventa linha "Outras categorias" em evento que não tem outras — linha 208
  - linha escondida contribui zero — esconder nunca desequilibra a coluna — linha 227
  - contingência e ajuste exibem o MESMO inteiro que o DRE do mesmo relatório — linha 234
- **fuzzing: a coluna fecha em qualquer combinação de centavos** — linha 250
  - 2000 eventos aleatórios: soma das linhas === total exibido, e nenhuma linha erra mais de R$ 1 — linha 258
- **achado 1 — resíduo de ponto flutuante não vira linha na tela** — linha 316
  - evento sem outras categorias: "Outras categorias" não aparece com R$ −1 — linha 317
  - categoria zerada nunca recebe R$ 1 só para a conta fechar — linha 342
- **achado 2 — o limite por linha é o DECLARADO, e a coluna segue fechando** — linha 351
  - REPRO A — a linha em piso+3 (R$ 2,10) some: Marketing volta para perto da verdade — linha 361
  - REPRO B — o caso onde R$ 1,00 é PROVADAMENTE impossível, e o módulo não mente — linha 375
  - REPRO C — o desvio sai da linha errada e cai onde custa R$ 1,00 exato — linha 402
  - varredura determinística: 13 mil eventos, 260+ deles no caso difícil, nenhum acima do limite — linha 427
  - fuzzing com centavos hostis: coluna fecha, nada acima do limite, nenhuma linha fantasma — linha 465
- **achado 3 — dinheiro tem duas casas: a quantização a centavos** — linha 504
  - PROPRIEDADE — 100 mil eventos com dinheiro de duas casas: teto respeitado, zero linha fantasma, coluna sempre fecha — linha 523
  - os valores sub-centavo do revisor não produzem mais linha fantasma nem desvio fora do teto — linha 599
  - sete categorias a −R$ 0,002: nenhuma vira linha na tela, e a coluna fecha — linha 614
  - a quantização é só de EXIBIÇÃO: contingência e ajuste seguem iguais aos do DRE — linha 634
- **empate de centavos: o real do arredondamento cai onde ele pesa menos** — linha 681
  - SOBRA — A&B e Extras fecham as duas em ,98 e sobra um real: ele vai para Extras — linha 684
  - FALTA — A&B R$ 900,00 e Extras R$ 18.500,00: quem exibe um real a MENOS é Extras — linha 717
  - varredura determinística: 20 mil eventos com empate EXATO de centavo, e o real nunca cai na linha pequena — linha 744
- **as linhas travadas (contingência, ajuste, total) seguem o arredondamento do DRE** — linha 842
  - ajuste de −R$ 50,50 (−0,5% sobre R$ 10.100): o DRE escreve − R$ 50,50 e a comparação, em reais, −51 — linha 843

### confrontoCustos.test.js

*3 describe · 10 it/test*

- **temRealizado — a mesma régua de valorConsiderado (calc.js)** — linha 14
  - temRealizado(i) é verdadeiro exatamente quando valorConsiderado(i) usa o realizado — linha 31
- **confrontoCustos** — linha 43
  - evento sem nenhum realizado: nada a confrontar — linha 44
  - confronta o realizado com o estimado DOS MESMOS itens, não com o total — linha 52
  - os números reais do Marco: o par antigo dizia "abaixo", a verdade é +3.147 ACIMA — linha 66
  - aceita categorias vazias, nulas e itens ausentes sem quebrar — linha 87
  - campo vazio ou lixo não vira NaN — vale a régua de num() do resto do app — linha 93
- **limiar ÚNICO de sinal — uma regra só, um limiar só** — linha 110
  - dinheiro de duas casas não deixa resíduo — e resíduo, se vier de fora, não vira ESTOURO — linha 123
  - `estouro` e `sinalDelta` nunca discordam — varredura em torno do limiar — linha 154
  - sem nenhum realizado não existe estouro (delta é null) — linha 169
  - sinalResultado usa o MESMO limiar, com a régua invertida (positivo é bom) — linha 176

### consertosNaoRegressao.test.js

*3 describe · 12 it/test*

- **FUZZ — o que muda e o que não muda ao preencher o id** — linha 140
  - evento cujos lotes JÁ TÊM id: 300 casos, nenhum número se move — linha 145
  - id de ITEM DE CUSTO é numericamente inerte (300 casos) — linha 159
  - ⚠️ id de LOTE MUDA o número em dado legado — porque conserta um erro real — linha 177
  - e o id preenchido é a ÚNICA diferença estrutural entre os dois — linha 200
  - os cenários não dependem do relógio: 00h01, 21h30 e 23h59 dão os MESMOS números — linha 213
- **ROUND-TRIP — backup antigo entra e sai inteiro** — linha 234
  - importa → exporta: nenhum evento, lote, item ou valor se perde — linha 251
  - segunda volta pelo round-trip não muda mais nada (estável e idempotente) — linha 296
  - os números dos eventos sobrevivem ao round-trip byte a byte (mesma migração dos dois lados) — linha 303
  - backup com eventos que JÁ TÊM id: nenhum id existente muda — linha 314
- **GUARDA — o relógio não volta a se duplicar nem a virar UTC** — linha 327
  - nenhum arquivo do app calcula "hoje" com toISOString fora de dataLocal.js — linha 328
  - (dinâmico: `nome` — variável, valor muda por caso; ver código-fonte, linha 335) — linha 335
  - (dinâmico: `semComentario` — variável, valor muda por caso; ver código-fonte, linha 345) — linha 345

### containerEstragado.evidencia.test.js

*2 describe · 8 it/test*

- **container de tipo errado no lugar da lista → RECUSA na porta, nomeando festa e campo** — linha 83
  - "${campo}" como ${rotulo} é recusado com mensagem em português — linha 86
  - "categorias[].itens" como conjunto é recusado nomeando a categoria — linha 104
  - a recusa acontece ANTES de qualquer conta — os R$ 15.000 que sumiam não são mais mostrados a menos — linha 121
- **NADA DE FALSO POSITIVO — o que já funcionava continua entrando** — linha 132
  - backup legítimo desta casa importa e mantém o lucro de R$ 26.850 — linha 133
  - backup ANTIGO (sem as três listas e sem identidade) continua entrando, com a marca de formato antigo — linha 139
  - as três listas VAZIAS entram (é o estado de uma festa nova) — linha 149
  - `null` e ausente nos quatro lugares continuam entrando — o app já os trata como lista vazia — linha 156
  - round-trip montarBackup → parseBackup do store real continua passando — linha 172

### contrasteDoAcento.evidencia.test.js

*1 describe · 4 it/test*

- **contraste do botão principal — texto branco sobre o acento** — linha 65
  - o tema ESCURO fecha a régua de 4,5:1 — linha 66
  - o tema CLARO fecha a régua de 4,5:1 — linha 71
  - os dois blocos são mesmo blocos diferentes — a contraprova do bug acima — linha 78
  - a conta é a da régua, conferida contra três valores conhecidos — linha 86

### curvaVendas.test.js

*24 describe · 97 it/test*

- **validarCurvaFinanceiro** — linha 69
  - normaliza a resposta válida do contrato — linha 70
  - ordena dias fora de ordem (defesa barata; o contrato promete ordenado) — linha 90
  - rejeita formato irreconhecível (%s) devolvendo null *(each)* — linha 100
- **buscarCurvaFinanceiro (fetch injetável — mesmo regime da ponte)** — linha 119
  - busca na URL da rota irmã e devolve a curva normalizada — linha 120
  - Financeiro fechado (fetch lança) → mensagem em português da ponte — linha 132
  - HTTP 404 (Financeiro aberto numa versão antiga) → mensagem que explica o reabrir — linha 139
  - HTTP 500 → mensagem de erro com o status — linha 144
  - JSON inválido ou formato estranho → MSG_RESPOSTA_ESTRANHA (nunca dado torto na tela) — linha 149
- **acumularDias / acumuladoAteODia** — linha 162
  - acumula pagamentos e valor na ordem dos dias — linha 169
  - lista vazia acumula vazio (evento sem venda não desenha curva) — linha 177
  - acumuladoAteODia soma só até o dia (inclusive), mesmo sem venda no dia exato — linha 182
- **diaRelativoHoje** — linha 190
  - negativo antes da festa, 0 no dia, positivo depois — linha 191
  - sem data → null (a leitura simplesmente não aparece) — linha 196
- **mediaHistorica (bloco 2 — média por tipo de festa)** — linha 203
  - média do tipo: só Brisas passadas com venda, frações conferidas à mão — linha 262
  - sem festas passadas do tipo → média geral, dita pela base — linha 280
  - sem tipo, usa a empresa do vínculo; sem nada, média geral — linha 286
  - exclui o próprio evento vinculado (não se compara consigo mesmo) — linha 294
  - venda antes de D-60 estica a régua para trás — linha 300
  - nenhuma festa passada → null (a tela explica em vez de inventar) — linha 319
- **totalPlanoLotes** — linha 328
  - Σ qtd × preço, sem cortesias nem lotes vazios (conferido à mão) — linha 336
  - desconto médio entra na régua (realizado da Tiqueteira é líquido de cupom) — linha 340
  - sem lotes → 0 — linha 343
  - 29a — campos novos vazios/neutros: régua idêntica à legada (cupom em todos) — linha 349
  - 29a — modo %: cupom 10 em 40% → efetivo 4% → 24.200 × 0,96 = 23.232 — linha 357
  - 29a — modo nº usa os vendidos do PLANO completo: 185 de 370 → fração 50% → efetivo 5% → 22.990 — linha 362
- **eventoCurvaVinculado** — linha 377
  - acha o evento da curva pelo vínculo da Sessão H — linha 379
  - sem vínculo (ou vínculo sem par na curva) → null — linha 383
- **lotesDoPlano** — linha 413
  - ordem da tabela, acumulada certa, cortesia fora — linha 414
- **curvaPlanoForma (modo 1 — pela forma histórica)** — linha 421
  - escala a forma ao total do plano e termina EXATAMENTE no total — linha 422
  - deriva a virada de cada lote pelo ritmo histórico — linha 430
  - média que não chega a 100% no dia é normalizada (o plano vende tudo até a festa) — linha 440
  - sem média ou sem lotes → null (a tela explica; nada inventado) — linha 447
- **curvaPlanoDatas (modo 2 — pelas datas dos lotes)** — linha 453
  - marcos nos dias das viradas, fechando o total no dia da festa — linha 461
  - lote sem data NO MEIO entra na reta até a virada seguinte, com aviso nomeando — linha 474
  - virada depois da festa é encostada no dia da festa, com aviso — linha 491
  - viradas fora de ordem são encostadas na anterior, com aviso — linha 500
  - sem data do evento → erro nomeado; sem nenhuma virada → erro nomeado — linha 511
- **PROVA: nenhum número difere entre os modos no TOTAL (mesmo plano, duas réguas)** — linha 517
  - modo forma e modo datas terminam no MESMO total (= totalPlanoLotes) — linha 518
  - com desconto médio a igualdade se mantém (mesma régua nos dois modos) — linha 534
- **migração leve dos campos novos (curvaModo + viradaPrevista)** — linha 544
  - backup antigo (sem os campos) ganha forma padrão e NADA mais muda — linha 545
  - valores válidos são preservados; tortos viram vazio (nunca dado inventado) — linha 560
  - round-trip: migrar duas vezes = uma vez (idempotente) — linha 577
- **inicioVendasEfetivo (F2-S — o campo vence; premissa deriva data − N)** — linha 589
  - campo preenchido vence tudo, com dia relativo e dias antes — linha 592
  - campo vazio + premissa N + data do evento → derivado data − N (12/09 − 45 = 29/07) — linha 597
  - sem campo e sem premissa (ou sem data do evento) → null = comportamento de sempre — linha 602
  - N torto, zero ou negativo NÃO liga a premissa (régua nunca nasce de dado quebrado) — linha 608
  - início DEPOIS da festa é sinalizado (a tela avisa; a curva ignora) — linha 614
  - campo com evento SEM data ainda vale (dia null — vira régua quando a data chegar) — linha 620
  - premissa em string numérica (backup à mão) funciona ("45" → 45 dias) — linha 625
- **janelaHistoricaDias (F2-S — primeiro pagamento → festa)** — linha 686
  - janelas 40, 60 e 0 (só vendeu no dia) — e null sem venda — linha 687
- **mediaHistoricaNormalizada + fracaoNormalizada (F2-S — a forma pura)** — linha 696
  - usa só festas com janela; nomeia as sem janela; janela média = 50 (conferida à mão) — linha 699
  - forma normalizada conferida à mão em 4 pontos: 0,1625 · 0,5 · 0,8875 · 1,0 — linha 708
  - nenhuma festa com janela → null (a tela explica; nada inventado) — linha 719
- **curvaPlanoJanela (F2-S — plano(dia) = total × forma(u), plano 0 antes do início)** — linha 734
  - janela de 30 dias: pontos conferidos à mão (3.737,50 · 11.500 · 20.412,50 · 23.000) — linha 737
  - plano = 0 EXATO antes do início (a régua abre em D-60 zerada) — linha 749
  - viradas derivadas pela forma: Lote 1 (8.000 de 23.000) vira em D-15; o último no dia da festa — linha 756
  - mesmo TOTAL do plano em qualquer janela (mesma régua do totalPlanoLotes) — linha 761
  - início no dia da festa (janela 0): tudo no D-0, zero antes — linha 769
  - sem média normalizada, sem lotes ou início depois da festa → null (a tela explica) — linha 776
- **avisoJanelaCurta (F2-S — "ritmo exigido N,N× o normal")** — linha 784
  - exemplo da spec: janela 30 contra histórica 52 → 1,7× — linha 785
  - sem aperto (janela ≥ média) ou sem dado → null — linha 793
  - média fracionária aparece arredondada no texto — linha 800
- **curvaPlanoDatas com início como piso (F2-S — fallback "sem histórico")** — linha 806
  - virada ANTES do início é encostada nele, com aviso nomeando o lote — linha 815
  - o plano fica em 0 até a véspera do início (piso da spec) — linha 822
  - sem inicioDia (ou null) = comportamento de sempre, byte a byte — linha 829
- **referência escolhível (F2-S — média da festa · grupo · uma festa)** — linha 843
  - referenciaCurva/refIdsDaCurva: forma segura; modo festa vale SÓ a primeira — linha 844
  - mediaHistorica com refIds: só as escolhidas, base "ref" — e sem refIds NADA muda (byte a byte) — linha 855
  - mediaHistoricaNormalizada com refIds: janela média = a da festa escolhida (60) — linha 870
  - escolhida que não veio na busca é NOMEADA; nenhuma veio → cai na média da festa, dito — linha 879
  - festasPassadasDisponiveis: a lista do modal (passadas com venda, sem o próprio evento) — linha 890
  - rotuloReferencia diz sempre a referência EM USO — linha 895
  - a referência alimenta a FORMA do plano (coerência: as três linhas, a mesma história) — linha 911
- **addDiasISO — a peça que quase repetiu o S1 do relógio** — linha 937
  - somar zero devolve exatamente a mesma data — linha 938
  - soma e subtrai atravessando mês, ano e fevereiro bissexto — linha 944
  - ir e voltar o mesmo número de dias fecha, em 400 saltos seguidos — linha 952
  - PAREDE: curvaVendas.js não chama toISOString — a saída é do relógio local — linha 959
- **P2 S3 — fração por festa, cronológica e sem persistência** — linha 976
  - teto 1 em ambas médias; bruto mantém 100 mil → 80 mil — linha 977
  - 50/-20/70 não recua em consultas repetidas, invertidas e intercaladas — linha 989
  - abertura negativa tem piso zero, sem inventar forma pré-festa — linha 1001
  - cache desordenado e rede dão mesma média, janela e avisos sem ordenar o original — linha 1011
  - agrupa registros do dia antes de avaliar máximo: %j *(each)* — linha 1023
  - zero/negativo não entram nem reduzem peso; sem janela é nomeada e estorno pós-festa avisa — linha 1035
  - seleção mantém avisos só de usadas: tipo, geral, referência, vínculo, futuro — linha 1052
  - objetos completos saudáveis e planos preservados sem chave ajustes — linha 1068
- **S3 adendo — precisão decimal com estornos** — linha 1096
  - resíduo: variação %s centavo não vira receita inventada *(each)* — linha 1113
  - máximo conserva positivo legítimo antes de voltar a zero — linha 1116
  - grupo diário exato %j *(each)* — linha 1117
  - subcentavo legítimo: incremento %s de R$ 0,00001 *(each)* — linha 1120
  - notação exponencial: incremento %s de 1e-7 *(each)* — linha 1123
  - escala grande evita overflow intermediário e preserva fração legítima — linha 1126
- **S3 adendo — marcos acumulados empatados** — linha 1129
  - une pelo maior acumulado e conserva as duas viradas — linha 1134
  - empate com zero inicial em D%s *(each)* — linha 1137
  - fora de ordem preserva aviso e viradas individuais — linha 1140
  - piso %s une pontos após encostar as viradas *(each)* — linha 1146
  - fecha lote sem data no mesmo D0 do primeiro marco — linha 1152
- **S3 adendo — consolidação sem mutação** — linha 1160
  - preserva identidade da lista saudável e propriedades do primeiro ponto empatado — linha 1161
  - datas sem empate preservam objeto completo — linha 1171

### dadoQuebrado.test.js

*3 describe · 14 it/test*

- **cabeComoDinheiro — a régua é o double, não o negócio** — linha 49
  - recusa o 1 seguido de 308 zeros, que estoura ao virar centavos — linha 50
  - recusa também o que nem número é — texto, infinito e nada — linha 57
  - aceita todo dinheiro que uma festa de verdade tem — linha 64
  - aceita valor negativo — quem recusa negativo é a porta do campo, não este aviso — linha 72
- **custosQuebrados — diz QUAL custo está quebrado** — linha 84
  - nomeia o item e a categoria da festa medida — linha 85
  - pega o valor quebrado no REALIZADO também, não só no estimado — linha 97
  - custo sem nome ainda assim é nomeado, com o rótulo do app — linha 108
  - avisa quando a SOMA não cabe, mesmo com todo item cabendo sozinho — linha 117
- **festa legítima nunca é acusada de dado quebrado** — linha 134
  - a festa de R$ 500.000 — grande de verdade — passa limpa — linha 140
  - custo zero, custo vazio, custo negativo e festa sem custo nenhum passam limpos — linha 151
  - a festa dos quatro itens de centavo (o caso das quatro superfícies) passa limpa — linha 163
  - nem um valor de 10^300 dispara o aviso — a régua não é de negócio — linha 178
  - 20.000 festas de dinheiro plausível: nenhuma acusada — linha 186
  - contraprova: um único item corrompido no meio da varredura é pego — linha 217

### dataBrasileira.test.js

*10 describe · 38 it/test*

- **parseDataBR — o que se digita** — linha 39
  - 05/08/2026 vira 2026-08-05 — linha 40
  - um dígito vale: 5/8/2026 é o mesmo dia — linha 44
  - colado, sem barra: 05082026 — linha 48
  - vazio é "não informado" — NUNCA vira hoje — linha 52
  - digitação a meio caminho não avisa nem grava — linha 58
  - ano de DOIS dígitos é recusado — adivinhar século é inventar dado — linha 64
- **parseDataBR — a recusa que substitui a rede do navegador** — linha 71
  - 31/02/2026 é RECUSADO, e o retorno não contém 3 de março — linha 72
  - bissexto de verdade: 29/02/2024 vale, 29/02/2026 não — linha 81
  - 31 de abril, junho, setembro e novembro são recusados — linha 86
  - dia 32, dia 00, mês 13 e mês 00 são recusados com aviso — linha 94
  - letra nunca vira NaN silencioso — linha 103
  - barras a mais é recusado, não interpretado pela metade — linha 111
- **ehDataISO — forma E existência** — linha 117
  - recusa 2026-02-31, que a regex da migração aprova — linha 118
  - 2026-02-31 — linha 119
  - aceita data que existe e recusa forma torta — linha 123
- **round-trip com o formatador da casa** — linha 132
  - todos os dias de 2024 (bissexto) e 2026 voltam iguais por fmtData → parseDataBR — linha 133
- **gradeDoMes** — linha 146
  - 42 células, sem repetição, começando no domingo — linha 147
  - agosto de 2026 tem 31 células do mês; fevereiro de 2024 tem 29 e o de 2026, 28 — linha 156
  - nenhuma célula discorda do relógio local, em 12 meses seguidos — linha 162
- **moverFoco** — linha 174
  - dia e semana atravessam mês e ano — linha 175
  - mês CLAMPA o dia: 31/03 um mês atrás é 28/02, nunca 03/03 — linha 182
  - ano CLAMPA o dia: 29/02 de ano bissexto vira 28/02 no ano anterior — linha 188
  - início e fim do mês — linha 194
  - entrada torta não vira data nova — devolve o que recebeu — linha 201
  - doze meses para a frente e doze para trás voltam ao mesmo dia — linha 207
- **rótulos em português e a grade de anos** — linha 216
  - rotuloDoMes fala como gente — linha 217
  - doze meses e sete dias, sem buraco — linha 222
  - blocoDeAnos dá 12 anos e contém o ano pedido — o atalho do "trocar de ano" — linha 228
  - definirAno clampa o dia: 29/02 de bissexto num ano comum é 28/02, nunca 01/03 — linha 237
  - o bloco é o MESMO para qualquer ano dentro dele, e o vizinho não se sobrepõe — linha 244
- **fuso: o resultado não pode depender do relógio da máquina** — linha 251
  - às 21h30 (o horário que quebrou o relógio da casa em fuso negativo) — linha 260
  - às 00h30 (o horário que quebraria em fuso positivo) — linha 265
  - na virada do ano, 23h59 — linha 270
- **a parede: nenhuma linha deste módulo chama toISOString** — linha 276
  - o texto-fonte não contém a palavra que produziu o S1 do relógio — linha 277
- **invariante: tudo que sai como válido É ISO que o módulo reconhece** — linha 296
  - vale para os anos que quebravam e para os das pontas — linha 297
  - ano de menos de 4 dígitos é RECUSADO, com a mensagem que leva ao conserto — linha 309
  - 1000 e 9999 continuam valendo — a régua é o número de dígitos, não o gosto — linha 319
  - varredura: 3 mil textos de data, nenhum "válido" que não seja ISO — linha 324

### dataLocal.test.js

*3 describe · 14 it/test*

- **hojeISO() — o relógio da casa é o LOCAL, nunca o UTC** — linha 34
  - 21h30 da noite da festa ainda é o DIA DA FESTA (falha em fuso negativo com UTC) — linha 35
  - 00h30 ainda é o dia que começou (falha em fuso positivo com UTC) — linha 41
  - sai sempre em AAAA-MM-DD com zero à esquerda — linha 47
  - a virada do ano às 23h59 de 31/12 ainda é 31/12 — linha 53
  - varre o ano inteiro em horários de borda e nunca discorda do relógio local — linha 58
- **durante a festa, o app NÃO pode dizer "já realizado"** — linha 95
  - 21h30 do dia da festa: o resumo do WhatsApp segue mostrando o ritmo — linha 96
  - 21h30 do dia da festa: o relatório/PDF segue mostrando o ritmo — linha 103
  - e no dia SEGUINTE a marcação volta a aparecer (o conserto não apaga a regra) — linha 110
- **dataLocalDoInstante — o dia em que o Marco fechou, não o dia em Greenwich** — linha 125
  - 21h30 de São Paulo: o carimbo já é do dia seguinte em UTC, e o dia local não — linha 126
  - meia-noite e meia local: em fuso POSITIVO o UTC ainda é ontem, e o dia local não — linha 133
  - vazio e ausente devolvem vazio — `fmtData` já trata isso como não informado — linha 138
  - DATA PURA não é instante: 2026-08-05 continua 5 de agosto, não 4 — linha 149
  - texto que não é data sai CRU, nunca como NaN — linha 158
  - em qualquer hora do dia, concorda com a data local montada à mão — linha 166

### defaults.test.js

*4 describe · 9 it/test*

- **itensCriticosFaltando (carona da sugestão 2)** — linha 9
  - evento novo (sem itens) acusa todos os críticos como faltando — linha 10
  - itens cadastrados (mesmo nome, outra caixa) somem da lista de faltantes — linha 15
  - evento sem categorias não quebra — linha 30
- **itensCriticosFaltando — casa por palavra-chave** — linha 42
  - "%s" cobre o crítico "%s" (some do aviso) *(each)* — linha 43
- **itensCriticosFaltando — NÃO casa (aviso legítimo continua)** — linha 62
  - "%s" NÃO cobre "%s" (o aviso permanece) *(each)* — linha 63
  - item vazio/lixo não cobre nada — todos os críticos continuam faltando — linha 75
- **itensDispensados — "já incluso" (sugestão 37, F2-W)** — linha 82
  - dispensar um crítico o tira do aviso, sem tocar os demais — linha 83
  - itensDispensadosDoEvento devolve só nomes críticos válidos (ignora lixo) — linha 92
  - evento novo nasce sem dispensados (aviso completo) — linha 99

### descritorEdicao.test.js

*4 describe · 16 it/test*

- **o que conta como campo de digitação** — linha 9
  - input de texto, número e afins contam — linha 10
  - clique não é digitação: checkbox, radio, botão, arquivo e range ficam de fora — linha 18
- **rótulo do passo a partir do campo em foco** — linha 29
  - usa o rótulo que o Marco está vendo na tela — linha 32
  - tira a unidade entre parênteses e o espaço não-quebrável do Field — linha 38
  - rótulo inútil (vazio, curto demais ou comprido demais) vira genérico, nunca errado — linha 48
  - fora de um campo de digitação: sem rótulo e SEM grupo (ação discreta) — linha 54
  - sem elemento (ambiente sem DOM) o grupo é nulo — não agrupa às cegas — linha 59
  - campos diferentes com o MESMO rótulo têm grupos diferentes — linha 65
- **controle contínuo (slider)** — linha 76
  - input[type=range] é controle contínuo — linha 77
  - mas NÃO é campo de texto — o Cmd+Z ali é do app, não do navegador — linha 81
  - o range vira descritor COM grupo — é o que faz o arrasto ser 1 passo — linha 86
  - checkbox e botão seguem sendo ação discreta (grupo nulo) — linha 93
- **resolverDescritor — quem nomeou a ação ganha (S2-D)** — linha 109
  - sem descritor, o rótulo vem mesmo do campo em foco (o comportamento antigo) — linha 113
  - com descritor explícito, o foco NÃO é nem consultado — linha 117
  - descritor em string vira { rotulo } — a forma curta das ações discretas — linha 128
  - descritor em objeto passa inteiro (rótulo + grupo do agrupamento) — linha 134

### desfazerDoRascunho.test.js

*4 describe · 12 it/test*

- **destinoDoDesfazer — a ação escreveu no RASCUNHO** — linha 18
  - rascunho ainda aberto: desfaz no próprio rascunho, nada é salvo — linha 19
  - rascunho APLICADO: desfaz no evento — é lá que a mudança passou a morar — linha 25
  - rascunho DESCARTADO: lugar nenhum — o que ia ser desfeito nunca foi salvo — linha 39
  - outro rascunho já aberto no lugar: lugar nenhum — a hipótese daquela ação morreu — linha 49
  - aplicado e JÁ dentro de uma simulação nova: também lugar nenhum — linha 55
  - sem saber como terminou, não escreve — a dúvida não vira gravação — linha 65
- **destinoDoDesfazer — a ação escreveu no EVENTO** — linha 72
  - fora da simulação: desfaz no evento — linha 73
  - já dentro de uma simulação aberta depois: continua indo para o evento — linha 82
- **destinoDoDesfazer — sem carimbo** — linha 89
  - marca ausente é o comportamento de sempre: grava no evento — linha 93
  - marca com alvo desconhecido também cai no evento, nunca num rascunho — linha 98
  - sem o segundo argumento não explode — devolve o evento — linha 104
- **a frase da tela** — linha 109
  - diz que nada estava salvo, em português e sem jargão — linha 110

### dinheiroEmCentavos.test.js

*3 describe · 5 it/test*

- **1. todo valor em R$ que o motor publica é um número de centavos** — linha 131
  - cenários: receita, custos, lucro, imposto, bar por pessoa, patrocínio e ajuste do DRE — linha 132
  - card do Fechamento: cada linha e cada ponte com o cenário — linha 162
- **2. as parcelas impressas com centavos somam EXATAMENTE o total impresso** — linha 184
  - DRE: bruta − taxa + cashback = líquida; líquida + bar + patrocínio = receita total; itens + contingência + ajuste = custo total; receita − imposto − custo = lucro — linha 185
  - card do Fechamento: as linhas até "Receita do evento" e até o "Resultado" fecham — linha 206
- **3. o caso da ficha: um lote de R$ 0,01** — linha 222
  - cashback 2.700,135 vira 2.700,14 e a líquida fecha em 51.302,57 — a receita total já era 140.672,57 — linha 249

### dossie.test.js

*5 describe · 12 it/test*

- **urlAbrivel — o link é dado; só http/https vira clicável** — linha 75
  - http/https abrem, com ou sem esquema (link colado de WhatsApp) — linha 76
  - esquema perigoso NUNCA abre: javascript:, data:, file:, ftp: — linha 86
  - texto comum não vira link: vazio, com espaço, sem ponto no host — linha 93
- **temAnotacoes — o caderno da linha sinaliza** — linha 101
  - false sem nada (ou só espaço); true com qualquer um dos três — linha 102
- **migração leve dos campos de anotação (sugestão 40)** — linha 113
  - item antigo ganha os três campos vazios; strings passam como vieram — linha 114
  - valor torto (não-string) vira \'\'; string é preservada — até a que "parece instrução" (é dado) — linha 123
  - é idempotente e o evento novo já nasce com a forma completa — linha 137
  - viaFinanceiro e campos extras seguem intocados — linha 145
- **FÓRMULAS INTOCADAS — anotação não entra em conta nenhuma (prova byte a byte)** — linha 155
  - evento PRÉ-dossiê: cenários idênticos byte a byte antes × depois da migração — linha 156
  - preencher observação, contato e link NÃO muda um centavo de nenhum cenário — linha 161
- **round-trip de backup** — linha 172
  - backup ANTIGO (sem os campos) importa, calcula idêntico e re-exporta estável — linha 173
  - backup NOVO (com anotações) faz round-trip sem perder uma letra — linha 193

### dre.test.js

*1 describe · 8 it/test*

- **linha do ajuste de custos no DRE** — linha 23
  - reproduz os números do print do Marco (base 137.862) — linha 26
  - mostra o valor do ajuste em R$ por cenário — linha 36
  - a soma das linhas exibidas fecha com o Custo total nos três cenários — linha 45
  - texto da célula: sinal, valor e % de origem — linha 56
  - ajuste zero vira travessão (coerente com o resto do DRE) — linha 61
  - ajuste NEGATIVO aparece como dedução e ainda fecha a coluna — linha 65
  - a diferença é exatamente o ajuste (confere com a conta independente) — linha 78
  - evento sem cenariosConfig usa os defaults e continua fechando — linha 86

### duasAbasSalvando.test.js

*2 describe · 4 it/test*

- **duas abas salvando — a perda é REAL (é isso que faz o aviso ser carga)** — linha 85
  - a aba B, com estado velho em memória, apaga o evento que a aba A acabou de salvar — linha 86
  - a aba A continua mostrando na tela um evento que já não existe no armazenamento — linha 110
- **duas abas salvando — o AVISO estava aceso na hora exata da perda** — linha 133
  - as duas abas se enxergam, a sobrescrita acontece, e nenhuma das duas estava sem aviso — linha 134
  - aba sozinha NÃO acende aviso — sobrescrever a si mesma é só salvar — linha 162

### esteiraLocalCobreOCI.test.js

*2 describe · 4 it/test*

- **(fora de qualquer describe)** — linha 52
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 52) — linha 52
  - (dinâmico: `semComentarios` — variável, valor muda por caso; ver código-fonte, linha 86) — linha 86
- **a esteira LOCAL cobre o que a esteira REMOTA cobre** — linha 126
  - $assunto — chamado no ci.yml E no auditoria.sh *(each)* — linha 134
  - o gitleaks está no ci.yml e no auditoria.sh, e a VERSÃO fixada é citada — linha 142

### estimadoEhOOrcamento.evidencia.test.js

*8 describe · 15 it/test*

- **O caso do Marco: 4 de 5 itens com realizado lançado** — linha 79
  - a coluna Estimado soma os R$ 306.540 que ele DIGITOU — não os R$ 376.360 que ele pagou — linha 80
  - o lucro estimado vai de R$ 175.180 para R$ 245.000 — a mudança que o Marco aprovou — linha 95
  - a margem estimada acompanha, pela MESMA guarda de calc.js — linha 105
  - POR QUE ERA ERRADO: o cenário realista, a fonte antiga da coluna, é o realizado ao centavo — linha 114
- **A MESMA RÉGUA DA ABA FECHAMENTO (a prova de que não nasceu uma segunda conta)** — linha 130
  - no evento do Marco, o desvio do card É o desvio da aba Fechamento — linha 146
  - varredura: 1.500 eventos de centavos hostis — a identidade fecha em todos — linha 155
- **Evento com POUCOS realizados: a coluna também conta a verdade** — linha 183
  - 1 de 5 pagos: estimado = o orçamento inteiro, desvio = só o estouro do item pago — linha 196
  - NENHUM item de custo pago: estimado = realizado = orçamento, desvio zero — e isso é a verdade — linha 207
- **Contingência e ajuste de cenário ficam de FORA do estimado — dos dois lados** — linha 219
  - contingência 10% e ajuste de custo +10% NÃO entram na coluna Estimado — linha 224
- **O item marcado "custou zero" entra no orçamento pelo valor DIGITADO** — linha 244
  - R$ 8.000 orçados que custaram zero viram R$ 8.000 de economia, não R$ 0 de orçamento — linha 245
- **Sem cenário: nada é inventado** — linha 258
  - receita, lucro e margem estimados vêm null; o orçamento, que não depende do cenário, vem — linha 259
  - receita zerada não vira margem 0% — vem null, como em calc.js — linha 268
- **O lado REALIZADO ficou intacto (fotografia literal)** — linha 282
  - cada número do realizado do evento-régua, ao real — linha 283
- **A PREVISÃO VIVA do evento ABERTO não foi tocada** — linha 310
  - o cenário realista continua somando valorConsiderado (realizado onde há) — linha 315
  - o orçamento não vaza para o cenário: trocar o estimado de um item já PAGO não move o cenário — linha 330

### exibicaoQueFecha.test.js

*3 describe · 10 it/test*

- **arredondadoComoAMoeda — a MESMA régua do formatador** — linha 19
  - imprime igual ao valor original, em 4.000 valores com meio real exato — linha 22
  - meio para LONGE do zero, nos dois sinais (Math.round erraria o negativo) — linha 31
  - lixo e ausente não explodem — viram zero, como em toda porta da casa — linha 39
- **lucroQueFecha — o número impresso bate com a subtração impressa** — linha 46
  - o exemplo que o Marco viu: R$ 100.003 − R$ 40.001 fecha em R$ 60.002 — linha 47
  - VARREDURA: em 2.000 cenários, o impresso sempre fecha com a subtração impressa — linha 56
  - sem imposto o termo simplesmente não pesa — linha 75
  - o imposto sai de `impostoValor`, nunca de `cenario.imposto` lido como número — linha 83
  - prejuízo fecha igual — o sinal não é caso especial — linha 89
  - entrada vazia não explode — linha 96
- **resultadoQueFecha — o card do evento FECHADO** — linha 102
  - receita real menos custos considerados fecha com o resultado impresso — linha 103

### exportPagamentos.test.js

*7 describe · 21 it/test*

- **blocos do formato (contrato do item 13)** — linha 57
  - valorBR: magnitude positiva, 2 casas, vírgula, SEM milhar — linha 58
  - dataBR: AAAA-MM-DD → DD/MM/AAAA — linha 64
  - blindagem: =, +, @, -, TAB e CR ganham apóstrofo; texto normal NÃO — linha 68
  - escape RFC 4180 com ";": aspas quando tem ; " ou quebra; aspas dobradas — linha 80
- **montarPagamentos** — linha 88
  - uma linha por custo, UMA POR PARCELA, ordenado por vencimento (sem data no fim) — linha 89
  - categoria traduzida na MESMA língua do export do plano — linha 100
  - parcelas divergentes geram aviso (o arquivo leva as parcelas — nunca silêncio) — linha 105
  - valor 0 e custo vazio não viram linha — linha 112
- **gerarCSVContador — byte a byte no contrato do item 13** — linha 119
  - arquivo completo: BOM, cabeçalho de 9 colunas, ";", CRLF, DD/MM/AAAA, valores BR — linha 120
  - blindagem no arquivo: descrição começando com "=" sai com apóstrofo — linha 133
  - campo com ";" é envolto em aspas (escape convive com a blindagem) — linha 142
  - os dois exports são blindados — exportar não altera nenhum dado do evento — linha 149
- **gerarCSVParaMim — blindado, ordenado, com TOTAL** — linha 158
  - arquivo completo byte a byte: 5 colunas, parcela k/N, total no fim, descrição blindada — linha 159
  - blindagem na descrição: =, +, @, - ganham apóstrofo (mesma régua do contador) — linha 174
- **parcela paga nos exports (sugestão 38)** — linha 185
  - montarPagamentos carrega paga/dataPaga (a revisão mostra a quitada) — linha 198
  - parcela paga SEM vencimento não conta no aviso de sem-data (quitada não deve data) — linha 205
  - o CSV do CONTADOR não muda um byte com a parcela paga (contrato do item 13 intocado) — linha 211
  - o CSV "Para mim" rotula a quitada na coluna Parcela: "1/2 · paga em 28/07/2026" — linha 217
  - exportar com parcela paga continua sem alterar nenhum dado do evento — linha 224
- **nomes de arquivo** — linha 233
  - slug do evento + data — linha 234
- **BOM** — linha 240
  - é o U+FEFF de verdade (Excel pt-BR abre acentos certos) — linha 241

### faixasMatrizRelatorio.test.js

*1 describe · 1 it/test*

- **faixas da matriz preservam referências literalmente** — linha 3
  - divide %i referências sem omitir, duplicar ou alterar *(each)* — linha 4

### fechamento.test.js

*8 describe · 41 it/test*

- **fechamentoCustos** — linha 31
  - desvio é contra o estimado DOS MESMOS itens, não contra o orçamento da categoria — linha 32
  - marca estouro quando o realizado passa do estimado — linha 63
  - categoria sem nenhum realizado não ganha desvio (sem número inventado) — linha 71
  - totais e desvio total — linha 76
  - sem realizado nenhum: totais existem, desvios nulos — linha 89
  - vazio não quebra — linha 98
- **fechamentoReceita** — linha 119
  - compara bilheteria real com a bruta do realista e bar real com o bar previsto — linha 120
  - campo vazio/ausente → linha sem desvio, sem número inventado — linha 130
  - evento antigo sem receitaRealizada funciona (comportamento atual) — linha 138
  - open bar: a linha de Bar sai da conta — só bilheteria; bar realizado salvo NÃO soma — linha 146
  - openBar false/ausente/"torto": a linha de Bar continua na conta (comportamento atual) — linha 160
- **montarBenchmarkDeEvento (promover a benchmark)** — linha 170
  - usa valorConsiderado (realizado > estimado) e agrupa categoria custom em extras — linha 189
  - receita = a MESMA do card do Fechamento (líquida + bar + patrocínio fechado) — linha 201
  - ticketMedio é bilheteria BRUTA ÷ público — a régua dos embutidos, não receita ÷ público — linha 220
  - sem bilheteria realizada informada, RECUSA — não inventa receita da capacidade dos lotes — linha 241
  - bar realizado sozinho NÃO basta: sem a bilheteria lançada a promoção segue recusando — linha 250
  - evento sem receita nenhuma → recusa — linha 260
  - NÃO toca nos benchmarks embutidos e gera id próprio — linha 267
  - não muta o evento de origem — linha 274
  - categoria com soma NEGATIVA aparece no detalhe com o valor real; categoria ZERO continua oculta — linha 287
- **obs distingue realizado de previsto** — linha 323
  - tudo realizado (bar informado + custos todos com realizado): texto de sempre, sem mudança — linha 343
  - bar sem realizado lançado (entra pelo previsto): a obs nomeia "bar pelo previsto" — linha 350
  - custo sem realizado lançado (entra pelo previsto): a obs nomeia os custos — linha 357
  - open bar: a linha de bar nem entra na conta — nunca é "pelo previsto" — linha 364
- **resultadoRealizado** — linha 375
  - tudo realizado dos dois lados: bilheteria líquida + bar − custos, e `completo` — linha 381
  - sem receita realizada → null (nada aparece) — linha 401
  - bar realizado NEGATIVO (−R$ 2.000, previsto R$ 8.000) conta o prejuízo: resultado +250, nunca +10.250 — linha 417
- **S1 — card e tabela do Fechamento contam a MESMA história** — linha 467
  - o repro do revisor: o card dizia +19.000 em VERDE; agora diz −1.000 de PREJUÍZO — linha 468
  - a tabela logo acima do card segue dizendo ESTOURO — e agora os dois concordam — linha 499
  - o custo do card é sempre valorConsiderado de TODOS os itens — nunca base parcial — linha 518
  - nenhum realizado de custo: o card cobra o orçamento INTEIRO, não zero — linha 545
  - economia real vira lucro real (o conserto não pinta tudo de vermelho) — linha 559
  - receita com linha ainda sem realizado entra pelo PREVISTO — nunca como zero — linha 571
- **fechamentoReceita — estimado zero não divide** — linha 590
  - bilheteria estimada R$ 0 com realizado informado: desvio absoluto existe, desvioPct é null (nunca Infinity) — linha 591
- **montarBenchmarkDeEvento — "zero" é zero até o centavo (Marco, 26/07/2026)** — linha 609
  - categoria que soma zero SÓ por resíduo de ponto flutuante continua oculta — linha 626
  - categoria com UM centavo de verdade continua aparecendo — a guarda não engole dinheiro — linha 636
  - categoria NEGATIVA de verdade continua aparecendo (a regra da manhã segue de pé) — linha 642
  - categoria realmente vazia continua oculta — linha 647
  - meio centavo LARGO continua aparecendo: o custoTotal cobra R$ 0,01 e a categoria tem de explicá-lo — linha 666
  - resíduo de ponto flutuante NEGATIVO também continua oculto — sem linha fantasma de R$ -0,00 — linha 682
  - a régua GÊMEA do importador responde igual aos dois casos (benchmarks.js, 27/07/2026) — linha 699

### fechamentoAbsurdo.test.js

*1 describe · 4 it/test*

- **card do Fechamento com custo corrompido (26/07/2026)** — linha 36
  - o custo NÃO vira R$ 0 — o absurdo continua no número — linha 37
  - o card NÃO anuncia lucro numa festa cujo custo estourou — linha 44
  - com bar lançado, mesma coisa — o bar não "salva" o número — linha 50
  - festa NORMAL segue somando pela régua de centavos (a guarda não atrapalha) — linha 58

### fechamentoEvento.test.js

*4 describe · 16 it/test*

- **fecharEvento — a foto congela os números do momento** — linha 43
  - fecha: status, carimbo e foto com a MESMA conta do card "Resultado realizado" — linha 44
  - é pura: não muta o evento original — linha 59
  - CONGELAMENTO: mudar o evento depois NÃO muda a foto (fato histórico) — linha 66
  - recusa sem bilheteria realizada — mesmo com bar realizado informado — linha 78
  - bilheteria realizada 0 PASSA a fechar — não é mais "não preenchido" — linha 94
  - evento já fechado não fecha de novo (null — a foto de antes fica) — linha 104
- **reabrirEvento — a foto é descartada, o invariante fica de pé** — linha 110
  - reabre: status aberto e fechamento null — linha 111
  - reabrir e fechar de novo tira OUTRA foto, dos números de agora — linha 119
  - evento aberto reabre como está (mesma referência, nada muda) — linha 129
- **carimbarBenchmark — o vínculo do selo** — linha 135
  - grava o id no fechamento de um evento fechado — linha 136
  - em evento aberto ou com id inválido, devolve o evento como está — linha 143
- **S4 origem realizada antes de fotografar** — linha 152
  - bar ilegível ${JSON.stringify(bar)} não cria foto -800 — linha 154
  - bar válido ${bar} fotografa ${total} — linha 155
  - open bar não libera ${campo} ilegível — linha 156
  - open bar exclui bar bruto inválido e preserva original — linha 157
  - S4 JSON literal 1e999 em bar cru não cria fotografia — linha 160

### financeiro.carimboInvalido.test.js

*1 describe · 1 it/test*

- **carimbo de origem inválida continua legível após importar** — linha 6
  - preserva o bruto e mostra aviso, sem formatar metadado inválido: %j *(each)* — linha 7

### financeiro.mantidas.test.js

*1 describe · 1 it/test*

- **(fora de qualquer describe)** — linha 4
  - reconhecer retorno sem ID tira o aviso de ausente e não chama contribuição atualizada de mantida — linha 4

### financeiro.s1.test.js

*2 describe · 20 it/test*

- **S1 composição de contribuições confirmadas** — linha 51
  - agrupa7400 preservando8000 e atualiza subconjunto7600 — linha 52
  - preserva ausente e zero, renomeia porID sem criar item — linha 67
  - ordem inversa mantém resultado e dinheiro em centavos — linha 76
  - não aplica vendido injetado, fechado, seleção duplicada e revisão vencida — linha 85
  - legado começa vazio e exige destino explícito sem conservar escalar antigo — linha 111
  - centavos e total inseguros não são gravados — linha 131
  - bruto inválido preservado, censo informa, migração idempotente — linha 134
  - recusa valor textual IDs tortos/repetidos e plano malformado; plano assinado é informativo — linha 148
  - IDs diferentes de mesmo nome e festa diferente não casam — linha 177
  - move item entre categorias sem perder vínculo estável — linha 187
  - adota identidade antes legada sem duplicar e preserva ID se retorno o perde — linha 213
  - confirmação prende previsto atual manual e composição completa — linha 266
  - recusa IDs repetidos entre destinos e item removido, confirmações não ficam válidas após seleção mudar — linha 296
  - load/export/import preservam carimbo antigo, uma/múltiplas origens e bruto inválido com censo próprio — linha 330
- **revisão independente: contribuição efetiva e frações de centavo** — linha 422
  - recusa ID conhecido e alias que disputam a mesma contribuição (ordem inversa=%s) *(each)* — linha 423
  - duas adoções não reivindicam a mesma origem antiga (ordem inversa=%s) *(each)* — linha 431
  - recusa fração de centavo %s no custo e bilheteria, sem aplicar parcela válida *(each)* — linha 438
  - centavos reais e ruído float de soma permanecem utilizáveis — linha 446
  - metadado antigo com fração permanece intacto e aparece no censo — linha 449
  - S0 P4: previsto23567.96 é substituído pelo realizado, sem duplicar47135.92 — linha 457

### financeiro.test.js

*9 describe · 37 it/test*

- **normalizarNome** — linha 81
  - ignora acento, caixa e espaços duplicados — linha 82
- **validarEventosFinanceiro** — linha 89
  - normaliza a resposta documentada da rota — linha 90
  - formato irreconhecível → null (quem chama avisa, nada é sobrescrito) — linha 105
  - linha de custo malformada recusa a resposta inteira com aviso — linha 112
- **buscarEventosFinanceiro (fetch injetado — o real só ao vivo)** — linha 119
  - servidor fechado (fetch lança) → mensagem "Abra o Financeiro…" — linha 120
  - HTTP de erro → mensagem em português com o status, nada alterado — linha 125
  - corpo que não é JSON → resposta estranha — linha 130
  - JSON fora do formato → resposta estranha — linha 135
  - resposta válida → lista normalizada, consultando a URL única aprovada — linha 140
- **categoriaDestino (mapa Financeiro → categorias da previsão)** — linha 153
  - %s → %s *(each)* — linha 156
  - categoria homônima criada pelo usuário vence o mapa — linha 171
  - nome desconhecido cai em extras — linha 176
  - sem extras usa a última categoria; sem nenhuma → null — linha 180
- **salvarVinculo** — linha 187
  - primeira escolha grava o vínculo sem carimbos — linha 188
  - reescolher o MESMO evento preserva carimbos; trocar de evento zera — linha 199
- **montarPropostas (tela de revisão — nada é aplicado aqui)** — linha 217
  - monta bilheteria e custos e mantém pagamentos somente informativos — linha 218
  - Taxas de plataforma NUNCA vira item de custo — vira aviso explícito — linha 231
  - valor atual preenchido aparece na comparação; igual → mudou: false — linha 237
  - evento do Financeiro sem lançamentos → só avisos, nenhuma proposta — linha 243
  - realizado digitado à mão aparece como candidato explícito, sem escolha automática — linha 249
  - item-ponte existente → proposta atualiza (não cria) e mostra o valor atual dele — linha 260
- **aplicarSelecionados (só o que foi escolhido, com carimbo, sem mutar)** — linha 268
  - aplica SOMENTE os selecionados — linha 275
  - bilheteria entra em receitaRealizada preservando o bar — linha 285
  - custo cria item-ponte na categoria mapeada, com carimbo e status PAGO — linha 292
  - aplicar DUAS vezes não duplica nada — atualiza os mesmos itens — linha 306
  - valor novo do Financeiro atualiza o item-ponte existente (não cria outro) — linha 317
  - lote de travas (item 4): aplicar valor do Financeiro num item-ponte LIMPA realizadoAuto — linha 333
  - o evento original NÃO muta — linha 359
  - grava vínculo + atualizadoEm + carimbos puxados — linha 367
  - bilheteria NÃO muda nenhum número de cenário (fórmulas intocadas) — linha 381
  - funciona em evento de backup ANTIGO (migrado, sem os campos novos de fábrica) — linha 390
- **acharItemPonte** — linha 403
  - acha o item pela chave da origem, em qualquer categoria da previsão — linha 404
- **carimbos de origem e hora** — linha 415
  - fmtDataHora → "18/07 HH:MM" (fuso local); inválida → vazio — linha 416
  - campo igual ao puxado → "via Financeiro em …" — linha 421
  - campo editado depois → deixa claro que a mão venceu — linha 427
  - nunca puxado → sem carimbo — linha 433
  - carimboItem lê viaFinanceiro do item — linha 438

### fonteUnicaCustos.test.js

*2 describe · 9 it/test*

- **fonte única: aba Custos e aba Fechamento não podem discordar** — linha 81
- **(dinâmico: `nome` — variável, valor muda por caso; ver código-fonte, linha 83)** — linha 83
  - o TOTAL é o mesmo número, com o mesmo sinal — linha 87
  - a COR e a FRASE do total são as mesmas nas duas telas — linha 96
  - cada CATEGORIA do Fechamento bate com o confronto da mesma categoria — linha 103
  - a soma das categorias fecha com o total (a tela não promete soma que não entrega) — linha 116
  - a linha exibida fecha: estimado − realizado é o desvio impresso ao lado — linha 123
  - nenhum número vira NaN — linha 136
  - o caso do Marco: as duas telas agora dizem ESTOURO, e não uma cada coisa — linha 144
  - sem nenhum realizado, NENHUMA das duas telas inventa desvio — linha 159
  - realizado ZERO não vira comparação (a régua de valorConsiderado, em toda tela) — linha 168

### format.test.js

*8 describe · 25 it/test*

- **fmtCompact — não engana abaixo de R$ 10 mil (tema D, F2-P)** — linha 8
  - valores redondos não ganham casa pendurada — linha 9
  - abaixo de 10 mil, valor não-redondo ganha 1 casa (fim do empate "R$ 2 mil") — linha 13
  - de 10 mil pra cima segue sem casas (limpo) — linha 18
  - milhões usam 1 casa por padrão — linha 22
  - abaixo de mil cai no formato cheio — linha 26
  - dec forçado sobe a precisão — linha 29
  - negativos preservam o sinal (dentro do prefixo, como antes) — linha 32
- **formatadorCompacto — sobe precisão até desempatar o conjunto** — linha 37
  - conjunto redondo usa 0 casas (mais compacto) — linha 38
  - par que empataria em 0 casas ganha 1 casa em TODO o conjunto — linha 43
  - sobe até 2 casas quando 1 ainda empata — linha 50
  - buckets diferentes nunca colidem (sufixo distingue) — linha 54
- **fmtBRL / fmtBRL2 — o dinheiro escrito** — linha 77
  - inteiro por padrão; `dec` manda quando vem — linha 78
  - fmtBRL2 mostra centavos SÓ quando existem — a régua é 0,004 — linha 86
  - lixo e vazio viram R$ 0 (é o `num()` que decide, e ele não inventa número) — linha 95
- **fmtInt — a contagem escrita (ingressos, público, dias)** — linha 106
  - arredonda e agrupa milhar — linha 107
  - lixo e vazio viram 0 — nunca "NaN" na tela — linha 113
- **fmtPct — o percentual escrito** — linha 118
  - 1 casa por padrão, e `dec` manda quando vem — linha 119
  - null e undefined viram travessão — "sem percentual" NÃO é "zero por cento" — linha 126
- **fmtData — a data escrita** — linha 137
  - vira dd/mm/aaaa a partir da ISO, e vazio some — linha 138
  - FEIURA 3, fotografada: texto que não é data ISO sai como estiver — linha 145
- **as duas feiuras do arredondamento, fotografadas (BACKLOG, 30/08/2026)** — linha 154
  - FEIURA 1 — o meio NEGATIVO arredonda para lados DIFERENTES em fmtInt e fmtBRL — linha 155
  - FEIURA 2 — o zero NEGATIVO chega à tela com sinal — linha 175
  - FEIURA 4 — no fmtCompact o sinal de menos cai DEPOIS do "R$" — linha 186
- **fonteQueCabe — o número grande do cartão cabe na largura (07/10/2026)** — linha 203
  - tamanho cheio como teto e largura do contêiner dividida pelo comprimento do texto — linha 204
  - texto vazio ou ausente não divide por zero — linha 208

### golden.test.js

*11 describe · 42 it/test*

- **golden das fórmulas — evento fixo, resultados fotografados** — linha 329
  - computeCenarios bate byte a byte com a fotografia (qualquer desvio = fórmula mudou) — linha 330
  - o evento golden não é mutado pelo cálculo — linha 334
- **golden com desconto médio (sugestão 17 — fórmula aprovada em 18/07/2026)** — linha 515
  - evento golden SEM o campo (e com "" ou 0) bate byte a byte com a fotografia ORIGINAL — linha 516
  - com 12% de desconto, bate byte a byte com a fotografia GOLDEN_DESCONTO_12 — linha 525
- **grade completa dos cenários (sugestão 19 — extensão simétrica aprovada em 18/07/2026)** — linha 538
  - campos novos ausentes — e neutros explícitos (custoPct 0/"", vendaPct 100) — batem byte a byte com a fotografia ORIGINAL — linha 549
  - simetria: realista com custoPct 10 tem o MESMO custoTotal da fotografia do pessimista (que sempre usou 10) — linha 556
  - simetria: otimista com vendaPct 70 aplica a conta do pessimista lote a lote — incluindo o Lote Porta; cortesia inteira — linha 563
- **open bar (sugestão 27 — regra do Marco, 18/07/2026)** — linha 600
  - campo ausente/false/valor "torto" (nunca === true) batem byte a byte com a fotografia ORIGINAL — linha 601
  - openBar: true zera SÓ o bar — bilheteria e custos intocados; receita e lucro se movem exatamente pelo bar — linha 610
  - openBar: true e o break-even — sem a receita do bar, DOIS dos três cenários deixam de fechar — linha 633
- **desconto parcial em dois modos (sugestão 29a — conta aprovada em 19/07/2026)** — linha 673
  - campos novos ausentes, vazios ou neutros (modo %, 100%) batem byte a byte com a fotografia ORIGINAL — linha 674
  - desconto legado (cupom 12) com campos novos vazios, "modo %, 100%" ou modo nº sem valor = GOLDEN_DESCONTO_12 byte a byte — linha 688
  - modo nº com nº ≥ vendidos de TODOS os cenários: min(1, …) trava a fração em 1 — byte a byte igual a cupom em todos — linha 703
  - equivalência exata entre os modos: no otimista (1100 vendidos), nº 440 é a MESMA fração de 40% — byte a byte, MENOS o break-even — linha 714
  - modo % à mão: cupom 10 em 40% → efetivo 4% — otimista bruta 106.360 × 0,96 = 102.105,60; custos intocados — linha 763
  - modo nº à mão: 180 ingressos com cupom 10 — no pessimista os mesmos ingressos pesam mais — linha 780
- **taxa paga pelo cliente (sugestão 29b — conta aprovada em 19/07/2026)** — linha 823
  - campo ausente, "nos", vazio ou valor "torto" (nunca === "cliente") batem byte a byte com a fotografia ORIGINAL — linha 824
  - repasse mexe SÓ na líquida (e no que deriva dela): bruta, taxa, cashback e custos idênticos à fotografia — linha 833
  - repasse à mão no realista: líquida 85.243,90 + 4.262,20 = 89.506,10; break-even cai 707 → 627 — linha 850
- **bar em dois modos (sugestão 42 — conta aprovada em 19/07/2026)** — linha 879
  - campo ausente, "", "fixo" e valores tortos (nunca === "porPessoa") batem byte a byte com a fotografia ORIGINAL — linha 880
  - por pessoa mexe SÓ no bar — bilheteria e custos intocados; conta à mão sobre o público da fotografia — linha 899
  - por pessoa e o break-even: a régua do slider recalcula o bar em cada ponto — fim da conta circular — linha 938
  - open bar MANDA em tudo: com barModo porPessoa e campos preenchidos, bar = 0 — idêntico ao open bar fixo — linha 976
- **imposto sobre a receita (as 4 decisões do Marco, 27/07/2026)** — linha 1063
  - evento golden SEM imposto bate byte a byte com a fotografia ORIGINAL — linha 1064
  - alíquota SEM chave ligada: o campo APARECE valendo R$ 0, e é de propósito — linha 1071
  - o caminho oposto — chave ligada e alíquota VAZIA — se declara `vazia: true` — linha 1104
  - 6% sobre bilheteria BRUTA + bar: a fotografia dos três cenários — linha 1118
  - a BASE é a bilheteria BRUTA + o bar — decisão 2, conferida à mão — linha 1130
  - o imposto é DEDUÇÃO DE RECEITA e fica FORA da contingência — decisões 3 e 4 — linha 1147
  - com 6%, o PESSIMISTA deixa de fechar — de 913 ingressos para "não fecha" — linha 1162
- **resultado realizado do Fechamento (a foto da festa que já aconteceu)** — linha 1215
  - bilheteria bruta 95.000 e bar 38.000 lançados: a fotografia inteira — linha 1221
  - a conta que o Marco refaz: 140.750,50 − 106.919,18 = 33.831,32 — linha 1226
  - o "estimado" é o ORÇAMENTO, não o realizado disfarçado (Marco, 27/07/2026) — linha 1234
  - com imposto de 6%, o resultado real cai de 33.831,32 para 25.851,32 — linha 1244
- **veredito — a cor que ele olha antes de dizer "essa festa acontece"** — linha 1259
  - com o alvo/mínima padrão do app, os dois são VERMELHOS — linha 1263
  - DUAS ROTAS DIFERENTES até o mesmo amarelo — e é isto que a foto prende — linha 1278
- **lote sem preço fica fora de público e bar (P8 — aprovado pelo Marco em 06/10/2026)** — linha 1361
  - a fotografia aprovada: público 530/590/650, bar 54.885/61.155/67.425, lucro 31.185/49.455/64.575, mínimo 324/293/277 — linha 1362
  - vazio, null e undefined dão a MESMA fotografia — linha 1365
  - mesmo com ajuste manual no lote sem preço (125, 450, 0), a fotografia não muda — linha 1368
  - é exatamente a festa SEM o lote — o comparador da tabela aprovada — linha 1371
  - preço 0 DECLARADO continua cortesia: as 300 entram no público e no bar (coluna "antes" da tabela) — linha 1375
  - o evento P8 não é mutado pelo cálculo, e o lote sem preço continua salvo como estava — linha 1383

### historico.test.js

*12 describe · 51 it/test*

- **pilha de desfazer — o básico** — linha 55
  - histórico novo não tem o que desfazer nem refazer — linha 56
  - desfazer com pilha vazia é no-op seguro (mesmo estado, mesmo histórico) — linha 64
  - refazer com ramo vazio é no-op seguro — linha 73
  - reducer: desfazer/refazer no vazio devolvem o MESMO objeto de estado — linha 82
- **desfazer restaura o estado anterior EXATAMENTE** — linha 89
  - um passo: o store volta profundamente igual ao de antes — linha 90
  - vários passos voltam um a um, na ordem inversa — linha 105
  - desfazer não toca em nada aninhado que não mudou (mesma referência dos ramos intactos) — linha 126
- **refazer volta ao estado posterior EXATAMENTE** — linha 135
  - desfazer → refazer devolve o store de depois, profundamente igual — linha 136
  - desfazer tudo e refazer tudo fecha o ciclo nos dois sentidos — linha 152
- **edição nova depois de desfazer descarta o ramo de refazer** — linha 170
  - comportamento clássico: o futuro que deixou de existir some — linha 171
- **digitação contínua no mesmo campo vira UM passo** — linha 188
  - quatro teclas dentro da janela = um passo só, e ele volta ao valor original — linha 191
  - a janela é ROLANTE: digitar devagar (mas sem parar) continua um passo — linha 208
  - pausa maior que a janela abre um passo novo — linha 218
  - campos DIFERENTES nunca se misturam, mesmo com o mesmo rótulo e no mesmo instante — linha 230
  - ação discreta (grupo nulo) nunca agrupa, nem em rajada — linha 238
  - agrupou, mas o rótulo continua o do passo (o botão fala do campo certo) — linha 245
- **a pilha respeita o limite** — linha 253
  - passando do limite, o passo MAIS ANTIGO cai fora — linha 254
  - o limite padrão é 50 — linha 281
- **o que o botão diz** — linha 291
  - nomeia a ação que vai desfazer — linha 292
  - sem rótulo honesto, cai no genérico — nunca num rótulo errado — linha 298
  - o refazer herda o rótulo da ação desfeita — linha 304
- **robustez do reducer** — linha 313
  - updater que não muda nada não vira passo — linha 314
  - reducer é puro: rodar a mesma ação duas vezes sobre o mesmo estado dá o mesmo resultado — linha 326
  - ação desconhecida não mexe em nada — linha 346
  - registrar aceita descritor ausente sem explodir — linha 351
- **arrasto contínuo de slider (S2-C)** — linha 365
  - arrastar de ponta a ponta (0 → 100) gera 1 passo, não 101 — linha 391
  - e esse 1 passo volta ao valor de ANTES do arrasto (não ao penúltimo tique) — linha 401
  - o arrasto NÃO engole a pilha: o que veio antes continua alcançável — linha 409
  - dois arrastos separados por uma pausa humana são DOIS passos — linha 421
  - sliders DIFERENTES nunca caem no mesmo passo, mesmo em sequência rápida — linha 430
- **modo estrito — mutação acidental não contamina o passado (S3-E)** — linha 446
  - o updater IMUTÁVEL de sempre continua passando (nada quebra no caminho certo) — linha 449
  - mutar em profundidade um estado já guardado LANÇA em vez de corromper — linha 458
  - pega o updater que muta um pedaço COMPARTILHADO com o passado — linha 478
  - em produção o custo é ZERO: desligado, nada é congelado — linha 499
  - congelar é amortizado: objeto já congelado não é percorrido de novo — linha 507
- **S4 identidade transitória de carregamento** — linha 517
  - desfazer e editar/apagar original tornam toast inativo sem chamar updater ou perder futuro — linha 518
  - refazer reativa e toast efetivo desativa; mapa nunca entra no store — linha 522
  - S4 ↶ de edição posterior mantém operação; foraDoHistorico limpa mapa — linha 525
  - S4 chamada legado e entrada sem mapa equivalem a mapa vazio — linha 528
- **carregamentos dependentes em memória** — linha 568
  - ${a}/${b}/${c}, desfazer %s preserva só ações restantes *(each)* — linha 570
  - categorias parciais: desfazer A recupera equipe, A&B segue B, e custo posterior permanece — linha 588
  - original editado e movido depois de somar não é substituído pela foto velha — linha 602
  - carregado movido e editado sai pelo ID; custo alheio editado permanece — linha 612
  - remoção manual de B não desativa a operação nem faz A ressuscitar cedo — linha 623
  - categoria removida depois dos carregamentos não ressuscita — linha 633
  - ↶ e refazer restauram dependências mesmo quando desfazer A não mudou store — linha 642
  - ↶ B, desfazer A, nova operação C e refazer indisponível não perdem o original — linha 659
  - reducer repetido é puro: fotos e escolhas congeladas, mesmo resultado sem mutação — linha 670
  - evento fechado na fila impede também o rebase transitório — linha 680
  - categoria recriada A→B, custo posterior=%s: desfazer remove só o que carregou *(each)* — linha 688
  - toast sem custo nem foto a ajustar preserva futuro; sucessor não afetado=%s *(each)* — linha 701

### imposto.test.js

*9 describe · 34 it/test*

- **evento sem imposto configurado — nada muda, nem o formato** — linha 62
  - sem os campos, o cenário sai SEM a chave `imposto` (o objeto é o de sempre) — linha 63
  - sem os campos, o lucro é exatamente receita − custo (nenhum zero somado no meio) — linha 70
  - alíquota vazia E as três chaves desligadas continuam sendo "não configurado" — linha 80
  - o evento que passou pela MIGRAÇÃO (campos neutros gravados) também não muda — linha 90
- **os 8 eventos do backup real — resultado idêntico ao centavo** — linha 109
- **base da bilheteria: BRUTA, antes da comissão e do cashback** — linha 152
  - a 10% sobre a bilheteria, o imposto é 10% da BRUTA — não da líquida — linha 153
  - NO MODO REPASSE (taxa paga pelo cliente) a líquida é MAIOR que a bruta — e a base continua a bruta — linha 161
  - a bilheteria BRUTA acompanha o ticket médio manual (a base não congela) — linha 175
- **imposto FORA da base da contingência (decisão 4 do Marco)** — linha 194
  - ligar o imposto não mexe em custoItens, contingência nem custoTotal — linha 195
  - a contingência continua sendo 10% dos CUSTOS, com imposto de R$ 2.600 na conta — linha 203
  - o imposto sai do LUCRO, não do custo: receita − imposto − custo — linha 214
  - a margem usa o lucro DEPOIS do imposto (a tela não pode ter duas margens) — linha 221
- **as três chaves, uma a uma e juntas** — linha 232
  - só "${base}": base R$ ${valorBase}, imposto R$ ${imposto} a 10% — linha 239
  - as três juntas somam as três bases, e a ordem é a do DRE — linha 248
  - duas chaves = a soma exata das duas sozinhas (nada de dupla contagem) — linha 255
  - só o patrocínio FECHADO entra na base — proposta fica de fora — linha 262
  - open bar zera a receita de bar E a base do bar junto (não sobra imposto órfão) — linha 276
  - cada cenário tem o próprio imposto — base menor no pessimista — linha 283
- **R$ 0 com história: chave desligada × alíquota zero** — linha 302
  - alíquota 10% com NENHUMA base marcada: R$ 0, e o texto diz que é por falta de base — linha 303
  - alíquota 0% com a bilheteria marcada: R$ 0, e o texto diz que a alíquota é ZERO — linha 310
  - alíquota EM BRANCO com base marcada: R$ 0, e o texto separa "vazia" de "zero" — linha 316
  - os três R$ 0 dão o mesmo número e TRÊS textos diferentes — que é o ponto — linha 323
  - a lista das bases sai em português, sem vírgula antes do "e" — linha 332
- **forma estrita das chaves (a filosofia do openBar, aqui valendo dobrado)** — linha 349
  - valor torto ${JSON.stringify(t)} NÃO liga a base — linha 352
  - objeto ausente/torto vira as três desligadas — linha 359
  - SÓ o booleano exato `true` liga — linha 365
  - a migração trava a alíquota em 0..100 — 150% herdado vira "não preenchida" — linha 373
  - migrar duas vezes = migrar uma (idempotência, com imposto ligado) — linha 390
- **impostoDoCenario, chamado direto** — linha 400
  - devolve null quando o evento não tem imposto configurado — linha 401
  - valores ausentes contam como zero, sem NaN — linha 405
  - impostoTexto("") e temImposto(undefined) não explodem — linha 412
- **base NEGATIVA não gera imposto (Marco, 28/07/2026)** — linha 419
  - bar negativo contribui ZERO, não um crédito — linha 430
  - o caso REAL: bar negativo não pode melhorar o lucro do pessimista — linha 436
  - a trava é POR BASE: um bar negativo NÃO abate da bilheteria — linha 443
  - base positiva continua exatamente como era — linha 455

### leituraCorrompida.test.js

*6 describe · 12 it/test*

- **leitura corrompida — (a) o bruto é preservado** — linha 55
  - copia a string ilegível para uma chave de quarentena — linha 56
  - recarregar a página não multiplica cópias do mesmo conteúdo — linha 70
- **leitura corrompida — (b) a gravação fica BLOQUEADA** — linha 85
  - o auto-save NÃO grava o store vazio por cima do dado corrompido — linha 86
  - mesmo um store COM eventos é recusado enquanto a trava está de pé — linha 104
- **leitura corrompida — (c) o app tem o que dizer na tela** — linha 117
  - estadoLeitura descreve a falha, o tamanho e onde o bruto ficou — linha 118
  - quarentena que falha não desliga a trava — o original é o que importa — linha 133
- **leitura corrompida — (d) há saída, e ela devolve a gravação** — linha 154
  - liberarGravacao destrava e o store restaurado finalmente persiste — linha 155
- **primeira vez no app NÃO é falha de leitura** — linha 173
  - localStorage sem a chave: store vazio, nenhuma trava, nenhum aviso — linha 174
  - store legitimamente vazio e JÁ salvo também passa limpo — linha 188
- **corrupção que PARSEIA — formato inválido é corrupção, não "comece do zero"** — linha 212
  - ${nome}: quarentena + trava de gravação + aviso, e o original fica onde está — linha 224
  - store de VERDADE com previsões continua abrindo normalmente — linha 250
  - lista vazia salva de propósito NÃO é corrupção (o outro lado do teste) — linha 267

### lixeiraNadaEmSilencio.test.js

*6 describe · 16 it/test*

- **rotacionarComDescarte devolve o que jogou fora** — linha 63
  - lista cheia: diz qual item saiu — linha 64
  - lista com espaço: nada descartado — linha 70
  - `rotacionar` continua com o comportamento de sempre — linha 75
- **a 51ª exclusão devolve o item descartado** — linha 83
  - moverParaLixeira com a lixeira cheia entrega `descartado` — linha 84
  - com espaço na lixeira, `descartado` é null (nada de alarme falso) — linha 96
  - a transação da Home propaga `descartado` até quem mostra o toast — linha 103
- **proximoDescarteDaLixeira — o aviso que vem ANTES** — linha 114
  - lixeira cheia: diz quem vai ser expulso na próxima exclusão — linha 115
  - lixeira com espaço: null — o confirm não inventa aviso — linha 120
- **mensagemPoda** — linha 128
  - sem poda, sem mensagem — linha 129
  - uma versão descartada: singular, e manda exportar backup — linha 134
  - várias: plural com o número — linha 140
- **estadoItemLixeira — o item diz a verdade sobre si** — linha 147
  - sem gêmea viva: restaurável — linha 150
  - gêmea viva no store: NÃO restaurável, com motivo e caminho — linha 157
  - item sem evento guardado não quebra — linha 167
- **restaurarComoCopiaDaLixeira — a saída do zumbi** — linha 172
  - devolve a previsão com id novo, sai da lixeira e não toca na gêmea viva — linha 173
  - item que sumiu da lixeira: recusa com motivo, sem tocar no store — linha 204

### lixeiraTransacao.test.js

*4 describe · 14 it/test*

- **S1-A — restaurar da lixeira e desfazer não pode perder a previsão** — linha 90
  - o ciclo inteiro: excluir → restaurar → Cmd+Z → a previsão CONTINUA existindo — linha 91
  - restaurar não cria passo de desfazer (a ação não promete o que não cumpre) — linha 112
  - depois da ida e volta pela lixeira, a pilha não guarda passo que mente — linha 123
- **S1-B — excluir não pode deixar duas verdades** — linha 143
  - excluir → Cmd+Z: a previsão NÃO volta à lista com a cópia ainda na lixeira — linha 144
  - excluir não cria passo de desfazer — quem desfaz é a lixeira — linha 157
  - desfazer e refazer em sequência não duplicam nem somem com a previsão — linha 163
  - id colidente: AVISA na tela e NÃO consome a cópia da lixeira — linha 173
  - o Restaurar do toast lê o store de AGORA, não o de quando o toast nasceu — linha 194
  - item que não está mais na lixeira avisa em português, sem quebrar — linha 212
  - lixeira cheia (quota): NADA é excluído e o motivo volta escrito — linha 219
- **updaters guardados (usados também na reconciliação da pilha)** — linha 244
  - semOEvento devolve o MESMO store quando a previsão não está lá — linha 245
  - comOEvento devolve o MESMO store quando a previsão já está lá — linha 250
- **Parte 2 do fechamento — evento FECHADO na lixeira (achado adversarial 20/07/2026)** — linha 256
  - restaurar NORMAL preserva o fechamento — é o mesmo evento voltando — linha 267
  - restaurar COMO CÓPIA nasce ABERTA e sem foto — senão a cópia carrega a trava e o benchmarkId clonado, e reabrir a cópia apagaria o benchmark do ORIGINAL — linha 278

### loteSemPreco.test.js

*8 describe · 18 it/test*

- **(a) loteFicaDeFora — quem avisa** — linha 58
  - preço vazio com 300 → sim; quantidade vazia + ajuste 125 → sim; quantidade 0 sem ajuste → não — linha 59
  - preço 0 declarado não é "sem preço"; null e [] não são lote — linha 67
- **(b) os textos exatos** — linha 75
  - 1 lote, na Receita e fora dela — linha 76
  - 2 lotes — linha 81
  - 4 lotes: os três primeiros e "e mais 1"; milhar com ponto — linha 91
  - só ajuste manual e nome em branco — linha 102
  - evento novo (seis lotes em branco) não avisa — linha 109
- **(c) entrada congelada** — linha 117
  - não quebra nem muda — linha 118
- **(d) censo do import** — linha 127
  - 1 festa — linha 128
  - 2 festas com 1 lote cada — linha 133
  - nada a avisar → texto vazio; lixo na lista é ignorado — linha 140
- **(e) WhatsApp — festa aberta** — linha 146
  - curto e completo: a linha 1 é o aviso, uma vez só; mínimo 293 e público 590 — linha 148
  - controle: preço 0 declarado não avisa e conta as 300 cortesias — linha 156
- **(f) WhatsApp — festa fechada** — linha 166
  - o Completo traz o aviso uma vez, antes do plano pré-evento; o Curto não — linha 167
- **(g) aviso depois do import JSON** — linha 180
  - o texto vira parágrafo próprio, antes de "Uma cópia de segurança" — linha 182
  - sem lote sem preço, não menciona — linha 190
- **P1 (A) — Marco, 06/10/2026: ajuste manual em lote sem preço não trava o mínimo** — linha 195
  - sem preço → não travado; com preço 50 → travado — linha 196
  - o WhatsApp mostra o mínimo verdadeiro (293) junto com o aviso do lote sem preço — linha 202

### loteTravas.evidencia.test.js

*3 describe · 11 it/test*

- **item 1 — taxa do sistema do bar (0..100): a conta, a migração e o censo** — linha 20
  - calc.js intocado: taxa 150% torna o bar líquido NEGATIVO (por isso a porta recusa) — linha 25
  - migração: 150 e −30 herdados de backup viram "" (não informado) — linha 34
  - migração: valores 0..100 (e string numérica) passam byte a byte — linha 39
  - censo do import: a taxa do bar fora da faixa entra no aviso agregado, com rótulo próprio — linha 46
- **item 2 — margens do semáforo (0..100): prejuízo não pode pintar não-vermelho** — linha 60
  - o bug, fotografado: margemMinima −20 CRUA pinta AMARELO um prejuízo de −5% — linha 66
  - migração: margemMinima −20 vira "" → padrão 20 → o mesmo prejuízo pinta VERMELHO — linha 72
  - migração: margem alvo 150 (acima de 100) também vira ""; valores 0..100 passam — linha 78
- **item 6 — "0x10" (hexadecimal) recusado na régua da migração, sem tocar decimais BR** — linha 92
  - confirma o vetor: num("0x10") coage para 16 (por isso a régua precisa barrar) — linha 97
  - cashback "0x10" via backup → "" (não 16); "16" e "4.5" decimais passam — linha 101
  - o hex é barrado nas OUTRAS réguas também (dinheiro): custo estimado "0x10" → "" — linha 107
  - número real (typeof number) não passa pelo regex e segue intocado — linha 116

### marcacaoRealizada.test.js

*3 describe · 8 it/test*

- **a frase de "evento já realizado" existe e é a mesma em todo lugar** — linha 53
  - ritmoVendas sabe, e a frase pronta é a de sempre — linha 54
- **festa PASSADA: as quatro superfícies dizem que a festa já aconteceu** — linha 69
  - resumo curto (WhatsApp) carrega a marcação — linha 70
  - resumo completo (WhatsApp) carrega a marcação — linha 74
  - relatório/PDF carrega a marcação, sem o prefixo "vendidos até hoje" — linha 78
  - card da Home carrega a marcação, em tom neutro (nem verde nem alerta) — linha 84
  - o texto da festa passada deixou de ser igual ao da festa futura — linha 91
- **festa FUTURA: nada mudou — a marcação só aparece depois da festa** — linha 96
  - nenhuma superfície ganha a marcação — linha 97
  - a linha de ritmo da festa futura continua idêntica — linha 104

### marcacaoRealizadaCampoVazio.test.js

*4 describe · 14 it/test*

- **festa PASSADA com o campo vazio: as quatro superfícies falam** — linha 57
  - ritmoVendas devolve a marcação, e só ela — linha 58
  - card da Home — linha 70
  - texto do WhatsApp — curto e completo — linha 77
  - relatório/PDF — linha 85
- **as outras três combinações não mudaram** — linha 90
  - festa PASSADA com o campo preenchido: igual ao que já era — linha 91
  - festa FUTURA com o campo vazio: segue sem ritmo e SEM a marcação — linha 101
  - festa FUTURA com o campo preenchido: o ritmo continua sendo calculado — linha 116
- **sem data ou sem break-even continua devolvendo null** — linha 129
  - sem data não dá para dizer que passou — linha 130
  - sem break-even também não — linha 135
- **as duas fronteiras: o dia da festa e a data ilegível** — linha 161
  - festa HOJE não está realizada — nem com o campo de vendidos vazio — linha 162
  - festa HOJE com o campo preenchido também não está realizada — ela é o caso "faltam N" — linha 179
  - festa ONTEM está realizada — a fronteira é exatamente aqui — linha 191
  - data ILEGÍVEL não vira festa realizada — em nenhuma das quatro superfícies — linha 203
  - data ilegível COM o campo preenchido também não vira realizada — linha 220

### marcacaoZerado.evidencia.test.js

*2 describe · 19 it/test*

- **REGRA DO ZERO — sem marcação, o zero segue lido como "não preenchido"** — linha 562
  - o zero SEM marcação segue valendo o estimado: a régua do 0 NÃO mudou — linha 563
  - a régua ignora o zero em QUALQUER formato que o Marco consiga digitar — linha 572
  - `temRealizado` (a régua da TELA) concorda com a régua do CÁLCULO no zero — linha 578
  - o item de graça fica FORA do confronto, dos dois lados — linha 586
  - o Sobrado 22/11 é anunciado com PREJUÍZO onde a verdade é lucro — linha 594
  - o card do Fechamento erra pelo valor cheio do item de graça — linha 612
  - o benchmark PROMOVIDO carrega a distorção para o histórico, para sempre — linha 618
  - o evento-régua do GOLDEN já tem um realizado 0 — mudar o significado do 0 o quebraria — linha 624
  - CADEADO — o invariante das duas telas, e a conta exata que a regra 3.2 quebraria — linha 637
  - a fotografia congelada de EVENTO_RICO é a de hoje — a linha de base da promessa — linha 663
  - o gêmeo MARCADO passou a se distinguir do original — a marcação faz efeito — linha 667
  - round-trip export→import não inventa nem perde nada (com ou sem o campo) — linha 675
- **IMPLEMENTADO — marcação explícita "custou zero" (aval datado do Marco: 20/07/2026, campo novo no schema, princípio 2)** — linha 685
  - A PROMESSA CENTRAL: o evento SEM marcação não muda um centavo, em NENHUMA superfície — linha 694
  - item COM marcação vale zero, e o estimado fica guardado como memória do orçamento — linha 712
  - marcação só vale se for booleano `true` — lixo de backup editado à mão não marca nada — linha 718
  - BACKUP ANTIGO abre igual, e a migração normaliza o campo — de verdade, chamando migracao.js — linha 727
  - o Sobrado 22/11 marcado passa a dizer a verdade — nos três cenários — linha 749
  - o item marcado passa a CONTAR no confronto, e o invariante das duas telas fecha — linha 771
  - o benchmark promovido do evento marcado não leva dinheiro que nunca saiu — linha 788

### migracao.p4.test.js

*3 describe · 6 it/test*

- **P4 (1) — a tabela: preço do lote → valor migrado → público realista da festa P8** — linha 26
  - %s: entrada %j → valor %j, público realista %i *(each)* — linha 27
- **P4 (2) — backup sem zero escrito importa igual ao de antes** — linha 54
  - duas festas com a forma de hoje: export → import byte-idêntico ao do código de ANTES do P4 — linha 58
  - a segunda volta também não muda nada (o que entrou é o que sai) — linha 73
  - festa P8 com "0,00" no Camarote: entra como cortesia (0), público 890; a volta seguinte é idêntica — linha 79
- **P4 (3) — o aviso de import não chama zero escrito de "não informado"** — linha 87
  - o censo lista só os dois ilegíveis — linha 100
  - o texto da confirmação não cita nenhum lote de zero escrito e continua citando os ilegíveis — linha 108

### migracao.test.js

*15 describe · 71 it/test*

- **migrarEvento (Sessão E — campo opcional receitaRealizada)** — linha 26
  - adiciona receitaRealizada vazia a evento antigo — linha 27
  - NÃO altera nenhum outro campo do evento — linha 32
  - todos os números calculados ficam idênticos após a migração — linha 53
  - é idempotente — linha 58
  - preserva valores já preenchidos — linha 63
  - completa subcampo ausente sem tocar no presente — linha 68
  - receitaRealizada inválida (não-objeto) vira vazia — linha 73
  - round-trip: backup JSON antigo importa, exporta e reimporta com números idênticos — linha 78
  - migrarEventos cobre listas e entradas inválidas — linha 100
- **migrarEvento (Sessão H — campo opcional financeiro)** — linha 108
  - evento antigo (sem o campo) ganha financeiro: null — sem vínculo — linha 120
  - vínculo válido é preservado por inteiro (carimbos incluídos) — linha 124
  - financeiro inválido (lixo ou sem eventoId) vira null — linha 129
  - carimbo malformado é descartado sem derrubar o vínculo — linha 134
  - nenhum número calculado muda com o vínculo presente — linha 141
  - round-trip: backup COM vínculo exporta e reimporta idêntico — linha 147
- **migrarEvento (Sessão N — campo opcional tipo de festa)** — linha 158
  - evento antigo (sem o campo) ganha tipo: "" — sem categoria — linha 159
  - tipo preenchido é preservado como veio (inclusive tipo custom) — linha 163
  - tipo inválido (não-string) vira "" — sem categoria — linha 168
  - nenhum número calculado muda com o tipo presente — linha 174
  - round-trip: backup antigo importa com tipo "" e backup COM tipo reimporta idêntico — linha 180
- **migrarEvento (Sessão N — campo opcional descontoMedioPct, sugestão 17)** — linha 192
  - evento antigo (sem o campo) ganha descontoMedioPct: "" — 0%, conta idêntica — linha 193
  - desconto preenchido é preservado como veio (número; inclui 0 e 100) — linha 197
  - desconto inválido (lixo, NaN, objeto) vira "" — nunca finge ser dado — linha 205
  - a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico — linha 212
- **migrarEvento (§9.9 — margens do semáforo com forma imposta, 20/07/2026)** — linha 218
  - evento antigo (sem os campos) NÃO ganha chave nova — segue caindo nos padrões 28/20 — linha 219
  - número, string numérica, 0 e vazio são preservados como vieram — linha 225
  - valor torto ('abc', NaN, objeto) vira '' — não informado, nunca dado — linha 233
  - ponta a ponta: o backup hostil que pintava VERDE FALSO passa a cair nos padrões — linha 240
  - round-trip: backup antigo → "" e backup COM desconto reimporta idêntico — linha 258
- **migrarEvento (Sessão F2-R — desconto parcial em dois modos, sugestão 29a)** — linha 272
  - evento antigo ganha modo "" e valor "" — o campo antigo migra para "cupom = X, modo %, 100%" — linha 273
  - modo e valor válidos são preservados como vieram — linha 282
  - modo fora do vocabulário e valor inválido viram "" — backup editado à mão nunca muda conta sozinho — linha 295
  - é idempotente e não muda nenhum número calculado — linha 306
  - round-trip: backup antigo → campos "" e backup COM os campos reimporta idêntico — linha 313
- **migrarEvento (Sessão F2-R — taxa paga pelo cliente, sugestão 29b)** — linha 339
  - evento antigo ganha taxaPagaPor: "" — paga por nós, conta idêntica — linha 340
  - "cliente" e "nos" são preservados; qualquer valor torto vira "" (repasse NUNCA liga sozinho) — linha 347
  - round-trip: backup antigo → "" e backup COM "cliente" reimporta idêntico (números incluídos) — linha 356
- **migrarEvento (Sessão Q — campo opcional openBar, sugestão 27)** — linha 376
  - evento antigo (sem o campo) ganha openBar: false — conta idêntica — linha 377
  - openBar: true é preservado — linha 381
  - valor "torto" (string, 1, objeto, null) vira false — NUNCA promove evento a open bar sozinho — linha 385
  - a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico — linha 393
  - idempotente: migrar duas vezes = uma vez (com e sem openBar: true) — linha 398
  - round-trip: backup antigo → false; backup COM openBar reimporta idêntico e mantém bar zerado na conta — linha 405
- **migrarEvento (Sessão F2-S — início de vendas, sugestão 30)** — linha 421
  - evento antigo (sem os campos) ganha inicioVendas: "" e vendasAbremDiasAntes: "" — nada mais muda — linha 422
  - valores válidos são preservados; tortos viram "" (data quebrada nunca vira régua da curva) — linha 428
  - a MIGRAÇÃO não muda nenhum número: evento antigo migrado calcula idêntico — linha 442
  - idempotente: migrar duas vezes = uma vez (com e sem os campos novos) — linha 447
  - round-trip: backup antigo → "" nos dois; backup COM os campos reimporta idêntico — linha 454
- **migrarEvento (Sessão F2-S — referência da curva, campo curvaRef)** — linha 469
  - evento antigo (sem o campo) ganha { modo: "", itens: [] } — média da festa, como sempre — linha 470
  - modo e itens válidos preservados; modo torto vira ""; item sem id é descartado — linha 474
  - idempotente e round-trip de backup com e sem o campo — linha 488
- **migrarEvento (Sessão F2-W — campo opcional itensDispensados, sugestão 37)** — linha 499
  - evento sem o campo → itensDispensados: [] — linha 508
  - preserva a lista válida e descarta lixo (não-string / vazio) — linha 512
  - campo inválido (não-array) → [] — linha 517
  - display-only: os números calculados ficam IDÊNTICOS com o campo cheio — linha 522
  - é idempotente — linha 530
  - round-trip: backup COM dispensados exporta e reimporta idêntico; backup SEM o campo abre com [] — linha 535
- **migrarEvento (Parte 2 do fechamento — status/fechamento, 20/07/2026)** — linha 549
  - evento antigo (sem os campos) nasce aberto e sem foto — backfill — linha 555
  - fechado VÁLIDO é preservado inteiro, e a migração é idempotente — linha 564
  - benchmarkId string sobrevive; benchmarkId torto é descartado sem derrubar a foto — linha 574
  - ESTRITO: status torto nunca fecha — fechar trava edição, não liga por acidente — linha 590
  - ESTRITO: foto inválida derruba o par — status fechado sem foto vira aberto — linha 598
  - foto órfã (sem status fechado) é descartada — o par viaja junto ou não viaja — linha 618
  - round-trip: backup com evento FECHADO exporta e reimporta idêntico — linha 624
- **migrarEvento — foto do fechamento sem `resultado` é INVÁLIDA (achado adversarial 20/07/2026)** — linha 638
  - fechamento com %s vira aberto + null *(each)* — linha 642
- **eventosReabertosPorBackup — o aviso do import que reabre festa fechada (20/07/2026)** — linha 658
  - detecta o evento fechado que o backup (sem status) reabriria — linha 659
  - backup que TAMBÉM traz o evento fechado não dispara o aviso — linha 670
  - backup sem o id (mescla não toca o evento) e lixo não-objeto não disparam — linha 677
- **parseBackup estrito — evento-lixo é recusado em português, nunca derruba a tela (H3-B resto, 20/07/2026)** — linha 685
  - eventos com %s recusa citando a posição *(each)* — linha 688
  - a posição citada é a do PRIMEIRO torto (1-based), com eventos bons antes — linha 698
  - backup 100% válido continua passando igual — linha 705

### migracaoIdLegado.test.js

*3 describe · 12 it/test*

- **backup antigo: toda linha precisa de identidade própria** — linha 70
  - todo lote sai da migração com id não-vazio e ÚNICO — linha 71
  - todo item de custo sai da migração com id não-vazio e ÚNICO no evento inteiro — linha 78
  - o id é ESTÁVEL: abrir, fechar e reabrir o app dá os MESMOS ids — linha 85
  - migrar duas vezes = migrar uma vez (idempotente, inclusive nos ids) — linha 92
- **o clique do Marco passa a mexer na linha certa** — linha 99
  - mover o Lote D para cima move O LOTE D — e sem aviso de "sem identificador" — linha 100
  - o mesmo vale para os itens de custo — linha 118
- **o que NÃO pode mudar** — linha 129
  - id que JÁ EXISTE não é tocado — nem em lote, nem em item — linha 130
  - a ORDEM das linhas é preservada exatamente — linha 144
  - NENHUM número muda: os 3 cenários saem idênticos antes e depois do id — linha 151
  - todos os demais campos da linha passam intocados — linha 160
  - lote/item que não é objeto continua sendo descartado ou preservado como era — linha 173
  - migrarEventos aplica a mesma regra na lista inteira — linha 179

### multiAba.test.js

*1 describe · 4 it/test*

- **vigiarOutrasAbas (hardening 4.2)** — linha 23
  - duas abas se detectam; saída LIMPA some com o aviso na hora — linha 24
  - aba que MORRE sem se despedir: o aviso expira sozinho pelo batimento — linha 40
  - três abas: fechar UMA não faz as outras acharem que estão sozinhas — linha 55
  - canal indisponível → degrada sem lançar e sem alarme falso — linha 72

### mutacaoEstadoNaRamificacao.test.js

*2 describe · 8 it/test*

- **(fora de qualquer describe)** — linha 39
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 39) — linha 39
- **mutacao-semanal.yml — o ponto de parada mora na ramificação mutacao/estado** — linha 57
  - os passos foram achados (se isto falhar, o leitor do yml quebrou, não o workflow) — linha 58
  - a leitura da mutacao/estado vem ANTES de "Rodar a bateria" — linha 64
  - a leitura busca a mutacao/estado e copia o MUTACAO-ESTADO.json de lá para a raiz — linha 68
  - a gravação vem DEPOIS da bateria, roda mesmo com ela vermelha, e empurra com lease — linha 78
  - só uma rodada da main grava; em outra ramificação o log diz que não gravou — linha 95
  - o texto sobre o ponto de parada depende de a gravação ter dado certo — linha 115
  - o relatório só vai para a mutacao/estado se a bateria o reescreveu nesta rodada — linha 125

### mutacaoTravamento.test.js

*2 describe · 16 it/test*

- **classificarTravamento — a decisão do Marco de 12/08/2026** — linha 70
  - a régua é 2× (o comentário do script explica a conta; mudar o número é mudar a régua) — linha 71
  - (a) tempo esgotado DEPOIS de canário verde, teto ≥ 2× canário → MORTA-POR-TRAVAMENTO — linha 75
  - (a) também quando sobreviveu em UTC e TRAVOU só na confirmação em São Paulo — linha 89
  - (b) mesmo travamento, mas teto < 2× canário → continua ERRO, dizendo por quê — linha 100
  - (b) na fronteira exata — teto = 2× canário — a régua aceita — linha 110
  - (c) tempo esgotado NO CANÁRIO → a rodada não mede, e nada vira morta — linha 115
  - (c) canário que passa em UTC e estoura em São Paulo também não mede — linha 126
  - (d) ERRO SEM tempo esgotado (ambiente) → continua ERRO, intacto — linha 131
  - MORTA e SOBREVIVEU normais passam sem mudança — linha 140
- **executarComTeto — o teto mata o grupo inteiro (órfãos de 30/08/2026)** — linha 179
  - um avô que trava com um neto que trava: volta com tempoEsgotado e não sobra ninguém — linha 180
  - rodarSuite com um comando que trava: ERRO + tempoEsgotado (a bateria é quem reclassifica) — linha 208
  - líder sai VERDE na hora e um neto segura o stdout: SOBREVIVEU, sem tempo esgotado, e o neto morre — linha 225
  - o mesmo caso com o teto disparando ANTES da folga de 2 s: continua SOBREVIVEU, sem tempo esgotado — linha 254
  - líder sai verde e um processo FORA do grupo segura o stdout por 30 s (muito além da rede): a função VOLTA em ~7 s (teto ${tetoMs / 1000} s) — linha 287
  - MUTACAO_TEMPO_SUITE_S acima do limite do relógio do Node é recusado antes de começar — linha 316
  - comando que termina sozinho: sem tempoEsgotado, com a saída e o status — linha 331

### negativoTravado.evidencia.test.js

*7 describe · 16 it/test*

- **calc.js intocado — a conta computa o que recebe (a trava é na porta)** — linha 55
  - RED: um item de custo −1.000 INFLA o lucro em R$ 1.000 (por isso a porta recusa) — linha 56
- **o cadeado da migração — dinheiro/quantidade < 0 vira "não informado"** — linha 64
  - GREEN: estimado −1.000 vira "" na migração → o lucro volta ao certo — linha 65
  - custo estimado e realizado negativos herdados viram "" — linha 75
  - quantidade de ingressos −10 e preço de lote negativo viram "" — linha 85
  - patrocínio negativo (na lista e no campo solto antigo) vira "" / não vira item — linha 95
  - valores VÁLIDOS passam byte a byte — 0 (cortesia/permuta), "" e positivos — linha 106
- **o cadeado da migração — ajuste de cenário fora da faixa REMOVE a chave** — linha 122
  - cenariosConfig.custoPct −200 (achado de 20/07) → chave REMOVIDA; o −5 do otimista FICA — linha 127
  - overrides por lote e ticketMedio de cenariosConfig passam INTOCADOS — linha 142
- **premissas (ajustes gerais) — grade de cenário fora de −50..100 vira ""** — linha 156
  - custoPct −200 na premissa vira "" (= herda); custoPct −5 e vendaPct 90 ficam — linha 157
- **a planilha do produtor — custo negativo na reimportação é RECUSADO** — linha 173
  - célula "(500)" (contábil = −500) → linha RECUSADA com motivo, e NÃO vira atualização — linha 196
  - o item casado por id fica PROTEGIDO — a linha recusada não o remove — linha 204
  - estimado POSITIVO na mesma porta segue normal (vira atualização, sem recusa) — linha 210
- **a trava é na PORTA — o parser contábil segue intocado** — linha 217
  - "(500)" continua devolvendo −500 no parser; a faixa é que recusa — linha 218
  - cada faixa recusa o negativo indevido e aceita o legítimo — linha 225
  - os avisos das faixas falam português e ENSINAM — linha 243
- **round-trip — backup antigo (schema velho, sem as chaves novas) ainda importa** — linha 250
  - migra sem erro, preserva os números válidos e é idempotente — linha 251

### novaEdicao.test.js

*3 describe · 22 it/test*

- **duplicarNovaEdicao (sugestão 4)** — linha 27
  - NÃO muta o evento original — linha 28
  - nasce limpa: realizado vazio, status ORÇAR, receita realizada e vendidos zerados, sem data — linha 36
  - lote de travas (item 4): a nova edição NÃO herda realizadoAuto (nasce com realizado vazio) — linha 50
  - sem a opção: estimados e bar previsto ficam como estavam — linha 66
  - com a opção: realizado vira o novo estimado (fallback: estimado antigo) — linha 73
  - com a opção mas sem bar realizado: bar previsto mantém o antigo — linha 84
  - lotes, cenários, margens e benchmarks ativos são mantidos — linha 91
  - herda o tipo de festa (sugestão 16 — a próxima edição é da mesma festa) — linha 99
  - herda o marcador open bar (sugestão 27 — a próxima edição da festa segue open bar até o Marco desmarcar) — linha 107
  - open bar + usar realizado: a nova edição continua open bar e o bar segue R$ 0 na conta — linha 112
  - evento antigo sem os campos opcionais não quebra — linha 121
- **Parte 2 do fechamento (20/07/2026) — cópia e nova edição nascem ABERTAS** — linha 131
  - nova edição de evento fechado nasce aberta e sem foto (o spread carregaria a trava) — linha 138
  - duplicarCopia: cópia idêntica, mas aberta e sem foto — e não muta o original — linha 144
- **o bar realizado vai para o campo QUE O EVENTO LÊ (Marco, 27/07/2026)** — linha 160
  - modo POR PESSOA: converte para ticket por pessoa nos TRÊS cenários — linha 179
  - modo POR PESSOA: os R$ 180.000 NÃO ficam no campo que o cálculo ignora — linha 185
  - os TRÊS cenários passam a ter receita de bar — antes só o realista tinha — linha 190
  - o lucro volta a crescer do pessimista para o otimista (era o que estava invertido) — linha 197
  - modo FIXO continua EXATAMENTE como era: o realizado vai para outrasReceitas.bar — linha 206
  - SEM público não há conversão, e o valor é PRESERVADO no campo fixo — linha 215
  - OPEN BAR não carrega nada — a receita de bar é 0 em qualquer modo — linha 228
  - sem "usar os realizados", nada muda em nenhum modo — linha 236
  - o evento ORIGINAL não é mutado (a promessa da função pura) — linha 242

### ordenar.test.js

*4 describe · 22 it/test*

- **moverItem — o movimento em si** — linha 12
  - desce uma posição — linha 13
  - sobe uma posição — linha 17
  - move várias posições de uma vez (do fim para o começo) — linha 21
  - não muda o comprimento nem perde nenhum item — linha 25
  - não muta a lista original (o histórico guarda a referência antiga) — linha 32
  - preserva os OBJETOS por referência — reordenar não recria item nenhum — linha 39
- **moverItem — bordas: pedido impossível não muda nada (mesma referência)** — linha 47
  - lista vazia — linha 48
  - lista de 1 item — linha 53
  - primeira linha tentando subir — linha 60
  - última linha tentando descer — linha 65
  - índice de origem fora da faixa — linha 70
  - de === para — linha 76
  - índice não inteiro ou ausente — linha 81
  - lista que não é array volta como veio — linha 88
- **podeSubir / podeDescer — quem fica desabilitado** — linha 94
  - a primeira não sobe, a última não desce — linha 95
  - item único não sobe nem desce — linha 103
  - lista vazia e índices absurdos são falsos, nunca explodem — linha 109
- **moverPorId — a porta que as telas usam** — linha 119
  - sobe e desce pelo id — linha 120
  - id que não existe mais na lista é no-op (mesma referência) — linha 135
  - bordas pelo id: primeiro para cima e último para baixo não mexem — linha 140
  - itens nulos na lista não quebram a busca — linha 146
  - subir e descer de volta devolve exatamente a ordem original — linha 151

### ordenarHonestidade.test.js

*6 describe · 18 it/test*

- **[A] o delta da Versão de reunião usa o limiar da casa, não zero exato** — linha 62
  - UM clique de seta agora dá delta ZERO EXATO (era resíduo de ~1e-11) — e a tela continua dizendo "nada mudou" — linha 63
  - acima de meio centavo o sinal e a cor continuam os de sempre — linha 79
- **[B] a aba Análise mostra os avisos do plano** — linha 119
  - dois cliques na seta do Lote 3 geram avisos — e eles chegam à tela — linha 120
  - os avisos de pré-requisito que já existiam continuam iguais — linha 150
  - não repete um aviso que já esteja na lista — linha 163
- **[E] id ausente ou duplicado nunca move a linha errada calado** — linha 183
  - lista inteira sem id: sem saber qual linha, NÃO move — e diz por quê — linha 191
  - lista inteira sem id, mas sabendo a POSIÇÃO clicada: move a certa e avisa — linha 200
  - id duplicado: o clique não some em silêncio — ou desempata, ou avisa — linha 212
  - id que não existe na lista: no-op com explicação, nunca "mexe no primeiro" — linha 231
  - o caso normal (id único) segue imune ao índice velho do render — linha 239
- **[F] clique que não move nada não vira passo de desfazer** — linha 252
  - moverEmLista devolve o MESMO objeto quando o movimento é impossível — linha 261
  - o reducer real não empilha nada com o clique impossível — linha 268
  - o mesmo vale para itens de custo (o patch nulo do setCat) — linha 295
- **[G] chegar na ponta não larga o foco no body** — linha 306
  - o foco atravessa para o botão irmão quando o clicado desabilita — linha 307
  - no meio da lista o foco fica onde estava — a sequência de cliques não quebra — linha 314
  - lista de UMA linha: os dois botões nascem desabilitados e a regra não escolhe o morto — linha 321
- **[H] a soma quantizada a centavos NÃO muda mais com a ordem dos lotes** — linha 339
  - UM clique de seta no mesmo empate de antes já NÃO muda mais "Receita bruta bilheteria" (era R$ 169.963 → R$ 169.964) — linha 348
  - reordenar itens de custo também não muda mais o total (mesmo mecanismo, custosPorCategoria) — linha 391

### ordenarInvariancia.test.js

*3 describe · 16 it/test*

- **permutar linhas NÃO muda número nenhum** — linha 330
  - %s — nenhum campo de computeCenarios sai do limiar *(each)* — linha 333
  - %s — cada lote mantém sua quantidade e sua receita *(each)* — linha 344
  - %s — os totais de custo não se mexem *(each)* — linha 351
  - %s — toda troca de vizinhos nos lotes fica dentro do limiar *(each)* — linha 369
  - %s — toda troca de vizinhos nos itens de custo fica dentro do limiar *(each)* — linha 378
  - %s — toda troca de vizinhos nos patrocínios fica dentro do limiar *(each)* — linha 395
  - a igualdade EXATA de reordenar LOTES é garantia do código desde 25/07/2026 (era acidente do fixture) — linha 414
  - as 720 ordens possíveis dos lotes não movem nenhum número nem meio centavo — linha 463
  - permutar os itens de custo não muda o custo total (100 embaralhadas) — linha 494
- **o que muda por definição: a Acumulada e a curva seguem a ordem exibida** — linha 524
  - a acumulada é a soma corrida da NOVA ordem, linha a linha — linha 537
  - a acumulada da última linha (o total) é a MESMA em qualquer ordem — linha 547
  - a acumulada do lote que mudou de lugar muda — é isso que a coluna significa — linha 556
  - o plano da curva usa a nova ordem e fecha no MESMO total — linha 568
  - a curva desenhada com a ordem nova continua terminando em 100% do plano — linha 585
- **round-trip: a ordem sobrevive ao backup JSON** — linha 599
  - reordenar → exportar → importar devolve a ordem nova — linha 612
  - e os números do evento reimportado são os mesmos do original — linha 630

### origensFinanceiro.test.js

*1 describe · 5 it/test*

- **origens financeiras recuperáveis** — linha 3
  - separa eventos e IDs mesmo com nomes iguais — linha 4
  - preserva bruto inválido sem atribuir identidade — linha 13
  - recusa origem repetida e aceita carimbo antigo sem inventar evento — linha 22
  - centavos toleram só ruído float e recusam frações reais — linha 49
  - origem v2 com fração é preservada e não indexada — linha 53

### padroes80e90.test.js

*3 describe · 21 it/test*

- **DECISÃO A — o pessimista supõe 80% dos lotes, não mais 70%** — linha 38
  - campo VAZIO: o cálculo usa 80% (era 70%) — 800 ingressos de um lote de 1.000 — linha 39
  - o valor GRAVADO continua mandando: 47% na Cine vende 470, o padrão não atropela — linha 43
  - evento NOVO nasce com pessimista 80 gravado — linha 47
  - "Voltar ao padrão" leva o pessimista a 80, e o slider mostra 80 no campo vazio — linha 51
  - a premissa herdada por festa também nasce em 80 (espelha o evento novo) — linha 58
  - o otimista NÃO foi arrastado junto: segue esgotando o lote (100%) — linha 62
- **DECISÃO B — o realista para de discordar de si mesmo: 90 no cálculo e na tela** — linha 67
  - campo VAZIO: o cálculo usa 90% (era 100%) — 900 de um lote de 1.000 — linha 68
  - quem tem 100 GRAVADO continua em 100 — o padrão novo não reescreve escolha salva — linha 72
  - o slider deixou de mostrar um número diferente do que a conta usa: 90 dos dois lados — linha 76
  - o evento novo já dizia 90 e continua dizendo 90 — linha 84
- **MIGRAÇÃO padraoPessimista80 — o 70 salvo vira 80, uma vez só** — linha 108
  - evento com 70 SALVO vira 80, e a marca guarda o valor anterior — linha 109
  - '70' vindo de backup editado à mão também sobe (mesma régua do resto da grade) — linha 117
  - o 47 que o Marco pôs à mão na Cine NÃO muda — só o 70 exato é alcançado — linha 123
  - 78, 80 e o campo vazio também passam intocados — linha 129
  - rodar duas vezes dá exatamente o mesmo — inclusive o custoPct que viaja junto — linha 135
  - roda UMA VEZ: um 70 digitado DE PROPÓSITO depois da subida é respeitado — linha 142
  - evento NOVO já nasce marcado — a janela entre criar e reabrir não existe — linha 157
  - marca de forma torta segue valendo como marca (nunca reabre a porta do 70) — linha 170
  - migrarEventos aplica a subida na lista inteira, e nada mais — linha 178
  - a subida não encosta no realista nem no otimista do mesmo evento — linha 183
  - cenariosConfig ausente: nada quebra, e o evento sai marcado — linha 190

### parcelas.test.js

*10 describe · 42 it/test*

- **dividirIgual — divisão igual, sobra de centavos na última** — linha 92
  - R$ 100 em 3× → 33,33 + 33,33 + 33,34 (soma exata) — linha 93
  - divisão exata não inventa sobra — linha 96
  - 1 parcela = o valor inteiro; n inválido = nada — linha 99
  - centavos extremos: R$ 0,01 em 3× → 0 + 0 + 0,01 — linha 105
  - a soma SEMPRE bate com o total (propriedade, casos com dízima) — linha 108
- **criarParcelasIguais** — linha 122
  - gera N parcelas com id único e data vazia (o Marco preenche) — linha 123
  - toda parcela nasce PREVISTA (sugestão 38): paga false, sem data efetiva — linha 130
- **soma travada — divergenciaParcelas (a fonte do aviso vermelho)** — linha 136
  - sem parcelas: não há o que divergir — linha 137
  - soma batendo com o estimado: null (sem aviso) — linha 141
  - parcela editada para fora da soma → divergência com a diferença exata — linha 146
  - a régua é o valorConsiderado: realizado preenchido muda o valor travado — linha 154
  - meio centavo de float não vira falso alarme — linha 163
- **agendaDoItem — a leitura única da Análise e dos exports** — linha 173
  - com parcelas: uma entrada por parcela, com k/N na ordem da lista — linha 174
  - sem parcelas: uma entrada com o valorConsiderado e a dataPagamento — linha 188
  - parcela paga sai com paga: true e a dataPaga dela (sugestão 38) — linha 197
- **resumoQuitacao — "R$ 1.200 pagos de R$ 4.000 · 1 em aberto" (sugestão 38)** — linha 218
  - null sem parcelas ou sem nenhuma paga (nada a dizer) — linha 219
  - a leitura do exemplo da spec: R$ 1.200 pagos de R$ 4.000 · 1 em aberto — linha 223
  - todas pagas: emAberto 0; e o "de R$ X" segue o valorConsiderado (realizado vence) — linha 239
  - marcar paga NÃO mexe na soma travada: divergência aparece igual — linha 255
- **resumoParcelas — célula da tabela de custos** — linha 265
  - resume quantidade e intervalo de datas — linha 266
- **FÓRMULAS INTOCADAS — parcelas são fluxo, não custo (prova byte a byte)** — linha 281
  - evento PRÉ-F2-C: cenários idênticos byte a byte antes × depois da migração — linha 282
  - parcelar um custo NÃO muda um centavo de nenhum cenário — linha 287
  - até parcelas DIVERGENTES não tocam os cenários (o aviso é da tela, a conta é do Marco) — linha 295
  - marcar parcela PAGA não muda um centavo de cenário — e o realizado fica INTOCADO (sugestão 38) — linha 301
- **parcela paga → Realizado (Decisão 22/07/2026): progresso auto + grava no fim** — linha 321
  - realizadoVazio: só "" / null / ausente; um 0 é valor do dono e NÃO é vazio — linha 336
  - progressoParcelasPagas: soma das pagas + contagem (display-only); null sem parcelas — linha 344
  - RED→GREEN: pagar 1ª NÃO grava e o custo previsto NÃO cai; a 3ª grava; desmarcar volta — linha 352
  - manual VENCE: realizado 40000 digitado + parcelas → pagar todas NÃO sobrescreve; desmarcar NÃO limpa — linha 394
  - RED→GREEN (lote de travas, Marco 23/07/2026): manual que COINCIDE com a soma NUNCA é apagado — linha 416
  - aditivo: item ANTIGO (sem realizadoAuto) trata flag ausente como false — não limpa por engano — linha 438
  - marcar paga guarda a dataPaga (padrão hoje); desmarcar zera paga e dataPaga — linha 456
- **migração leve — forma dos campos novos** — linha 469
  - evento sem os campos ganha dataPagamento \'\', parcelas [] e caixaInicial \'\' — linha 470
  - campos extras do item (viaFinanceiro) passam intocados — linha 479
  - realizadoAuto é ADITIVO (lote de travas, item 4): ausente → false; true preservado; estrito — linha 487
  - normaliza tortos: parcela lixo é descartada, data inválida vira \'\', valor não-numérico vira \'\' — linha 504
  - migração de paga é ESTRITA (sugestão 38): só o booleano true quita; dataPaga ISO ou \'\' — linha 526
  - valores válidos passam como vieram (número e string numérica) — linha 538
  - é idempotente: migrar duas vezes = migrar uma vez — linha 548
  - evento novo já nasce com a forma completa — linha 555
- **round-trip de backup antigo (formato pré-F2-C)** — linha 562
  - importa, preserva os números e sobrevive a export→import de novo — linha 563
  - backup NOVO (com parcelas, uma PAGA) faz round-trip sem perder uma parcela nem a quitação — linha 584
  - realizadoAuto (lote de travas, item 4): export carrega o campo; backup SEM ele importa como false — linha 596

### patrocinio.test.js

*7 describe · 19 it/test*

- **patrocinioPorEstagio — a regra de contagem** — linha 56
  - sem a lista (evento antigo): número solto conta inteiro como fechado — linha 57
  - proposta é potencial; confirmado e recebido são fechado — linha 62
  - estágio desconhecido NUNCA conta como fechado (vai para potencial) — linha 73
  - lista vazia = zero; valor string numérica e vazio funcionam — linha 80
- **computeCenario — só o fechado entra na receita e no break-even** — linha 92
  - proposta fica fora da receita; confirmar o MESMO valor muda a receita — linha 93
  - recebido conta igual a confirmado nos três cenários — linha 124
- **semáforo — patrocínio em proposta não muda o veredito** — linha 135
  - proposta grande mantém vermelho; confirmada, o mesmo valor muda a cor — linha 148
- **migração — números preservados (condição inegociável)** — linha 162
  - número solto vira UM item confirmado e o campo antigo é consumido — linha 163
  - cenários ANTES e DEPOIS da migração são idênticos byte a byte — linha 176
  - preserva zero, vazio, inválido e POSITIVO byte a byte (o negativo é recusado à parte) — linha 182
  - zero/vazio/inválido/NEGATIVO não viram item; só o positivo vira (Marco 22/07/2026) — linha 197
  - é idempotente: migrar duas vezes = migrar uma vez — linha 210
  - lista existente vence: solto preenchido junto NÃO vira item (conta nunca dobra) — linha 215
  - normaliza itens: estágio inválido vira proposta (não conta), id ausente ganha id — linha 225
- **round-trip de backup antigo (formato pré-Sessão O)** — linha 242
  - importa, preserva os números e sobrevive a export→import de novo — linha 243
- **export do plano para o Financeiro — publica só o fechado** — linha 261
  - linha Patrocínio sai com a soma do fechado; proposta fica fora — linha 268
  - só propostas → nenhuma linha de Patrocínio no plano — linha 281
- **nova edição — patrocínios viram leads (proposta)** — linha 289
  - mantém patrocinador e valor, estágio volta a proposta; original não muta — linha 290
  - evento não migrado (número solto) passa intocado — comportamento antigo — linha 308

### percentuaisForaDaFaixa.evidencia.test.js

*2 describe · 14 it/test*

- **calc.js intocado — a conta computa o que recebe (a trava é na porta)** — linha 28
  - sanidade: taxa 10 + cashback 5 sem cupom → líquida R$ 95.000 — linha 29
  - cupom 150% direto na conta → bruta R$ -50.000 (por isso a porta recusa) — linha 34
  - cupom -20% direto na conta → líquida inflada R$ 114.000 — linha 40
  - taxa -20% direto na conta → líquida R$ 125.000 (+R$ 30.000 sobre a sã) — linha 46
  - taxa 150% direto na conta → líquida R$ -45.000 — linha 52
  - cashback 150% direto na conta → líquida R$ 240.000 (2,4× a bruta) — linha 57
  - cashback -50% direto na conta → líquida R$ 40.000 — linha 62
  - contingência negativa direta na conta → -R$ 2.000 (por isso a porta recusa) — linha 67
  - fração 150 no modo % direta na conta → efetivo 15% (por isso a porta recusa) — linha 71
- **o cadeado da migração — fora da faixa vira "não informado", nunca conta** — linha 77
  - cupom 150 e taxa -20 herdados de backup viram "" na migração — linha 78
  - taxa 'abc' (o S2 do BACKLOG) vira '' — deixa de fingir que é um número guardado — linha 84
  - cashback 150 e contingência -10 herdados viram "" — linha 92
  - valores VÁLIDOS passam byte a byte — número e string numérica, 0 e 100 inclusos — linha 98
  - fração do cupom: 150 no modo % vira ""; 150 no modo nº FICA (é contagem de ingressos) — linha 113

### pixFechamento.test.js

*1 describe · 8 it/test*

- **Pix líquido adicional no fechamento — Marco, 28/09/2026** — linha 21
  - soma integralmente sem taxa, cashback ou imposto automático, inclusive em open bar — linha 22
  - vazio ou ausente preserva o resultado antigo; zero informado tem linha própria — linha 35
  - Pix sozinho não esconde a bilheteria prevista nem permite fechar sem informá-la — linha 43
  - congela Pix na foto e o inclui no benchmark sem alterar ticket de bilheteria — linha 51
  - exporta/importa o Pix e importa backup antigo sem inventar recebimento — linha 62
  - recusa Pix negativo herdado com a mesma normalização da bilheteria — linha 71
  - importar uma foto antiga não adiciona Pix nem recalcula o fechamento — linha 75
  - cópia preserva Pix sem mutar original; nova edição limpa o realizado — linha 85

### planilhaCelulas.test.js

*1 describe · 3 it/test*

- **planilhaParaAOA — erro nativo sem perder números ou coordenadas** — linha 5
  - conserva o texto do erro Excel de código %s em bytes XLSX *(each)* — linha 6
  - mantém defval %s, linha vazia, zero e número válido sem conversão a texto *(each)* — linha 18
  - opções de faixa e formatação conservam endereço e não gravam cache no original — linha 26

### planoFinanceiro.csvQuebra.test.js

*1 describe · 3 it/test*

- **CSV do plano com quebra de linha num campo** — linha 48
  - \\r solto e \\r\\n dentro da descrição: o arquivo inteiro abre, 8 colunas por linha, texto preservado — linha 49
  - sem quebra de linha, o campo continua sem aspas (arquivo igual ao de antes) — linha 56
  - controle do leitor: um \\r fora de aspas é acusado (o instrumento enxerga o defeito) — linha 63

### planoFinanceiro.custouZero.test.js

*1 describe · 4 it/test*

- **custo "custou zero" no arquivo do plano** — linha 29
  - a linha não vai, e o custo aparece em "Fora deste arquivo" com R$ 0 e o estimado — linha 30
  - o aviso de "realizado preenchido" não conta a permuta como realizado de R$ 0 — linha 49
  - SEM a marcação, o mesmo custo de R$ 8.000 vai no arquivo e não ganha texto novo (falso positivo) — linha 53
  - marcado mas com realizado > 0: a marcação não vale (P1 de 20/07) — a linha vai pelo previsto, como antes — linha 60

### planoFinanceiro.foto.test.js

*2 describe · 4 it/test*

- **planoFinanceiro — fotografias byte a byte do CSV (prova de não-regressão)** — linha 360
- **(dinâmico: `nome` — variável, valor muda por caso; ver código-fonte, linha 362)** — linha 362
  - gera o MESMO arquivo, byte a byte — linha 363
  - mantém a ORDEM das linhas — linha 369
  - mantém avisos, alertas e bloqueios palavra por palavra — linha 375
  - o evento rico e saudável sai LIMPO: sem aviso, sem alerta, sem bloqueio — linha 384

### planoFinanceiro.semPreco.test.js

*1 describe · 4 it/test*

- **export do plano com lote sem preço** — linha 34
  - a revisão diz que o lote ficou de fora — e os números são os mesmos de sem o lote — linha 35
  - preço 0 declarado é cortesia: nenhum aviso de lote sem preço — linha 49
  - lote em branco de evento novo (quantidade vazia, sem ajuste) não avisa — linha 55
  - evento bloqueado (sem Festa) continua só com o bloqueio — o aviso não passa à frente — linha 61

### planoFinanceiro.test.js

*30 describe · 121 it/test*

- **categoriaFinanceiroCusto** — linha 40
  - mapeia as categorias padrão para os nomes exatos do Financeiro — linha 41
  - categoria sem par exato (marketing, extras, custom) cai em Outras despesas — linha 49
- **montarItensPlano — bloqueios** — linha 56
  - bloqueia sem "tipo" (marca obrigatória) — linha 57
  - bloqueia sem "data" (data_evento obrigatória) — linha 65
  - tipo custom (fora das 4 marcas) não bloqueia, mas avisa — linha 73
- **montarItensPlano — receita** — linha 82
  - gera uma ÚNICA linha de Ingressos (bilheteria), com o id estável e valor batendo com cen.bruta — linha 90
  - lote com quantidade 0 no realista não gera linha — linha 101
  - bar e patrocínio viram linhas próprias só quando > 0 — linha 108
  - open bar (sugestão 27): a linha de Bar sai do plano — cen.bar é 0, fonte única em calc.js — linha 118
  - receita de ingressos reflete o desconto médio (sugestão 17) sem fórmula nova — linha 128
- **montarItensPlano — custo** — linha 140
  - gera uma linha por item de custo com estimado > 0, categoria mapeada — linha 141
  - item sem estimado (vazio ou 0) não vira linha — linha 150
  - usa o ESTIMADO, não o realizado/considerado — linha 159
  - categoria custom cai em "Outras despesas" e gera aviso nomeando a categoria — linha 168
  - contingência > 0 vira linha própria em Outras despesas — linha 182
  - contingência 0/ausente não vira linha — linha 193
- **montarItensPlano — id_linha estável** — linha 201
  - o mesmo evento gera exatamente os mesmos ids em duas montagens (idempotência de reimportação) — linha 202
  - reordenar itens de custo não muda o id de cada linha (chave é o uid do item, não o índice) — linha 209
  - todos os ids são únicos dentro de um mesmo evento — linha 221
- **gerarCSVPlano** — linha 231
  - gera cabeçalho exato do contrato (BACKLOG.md do Financeiro, item 11b) — linha 232
  - valor sai como número puro — nunca milhar com ponto isolado — linha 240
  - valor quebrado sai com ponto decimal (nunca vírgula BR solta) — linha 248
  - meio centavo no arquivo vai para longe do zero, como na tela: 1,005 → 1.01; −0,005 → -0.01; 2.700,135 → 2700.14 — linha 259
  - marca e evento vêm do evento em toda linha; descrição com vírgula é escapada entre aspas — linha 274
  - reexportar o mesmo evento (sem mudanças) gera CSV byte-a-byte igual, exceto se algo mudou — linha 285
  - blindagem anti-fórmula (portão C, Marco 20/07): descrição/categoria começando com gatilho ganha apóstrofo — linha 294
  - (dinâmico: `desc` — variável, valor muda por caso; ver código-fonte, linha 302) — linha 302
- **nomeArquivoPlano** — linha 312
  - inclui a data do evento e um slug do nome, termina em .csv — linha 313
- **montarItensPlano — parcelas (F2-C)** — linha 322
  - custo SEM parcelas: saída idêntica à de antes (formato v1 inalterado) — linha 332
  - custo parcelado vira UMA linha por parcela, id estável por parcela, valor e data da parcela — linha 344
  - a data da parcela sai na coluna data_lancamento do CSV (formato v1) — linha 361
  - custo com data única de pagamento preenche data_lancamento — linha 370
  - parcelas somando diferente do estimado geram aviso (o arquivo leva as parcelas) — linha 380
  - parcela de valor 0/vazio não vira linha; parcela sem data sai com data_lancamento vazia — linha 388
- **montarItensPlano — ticket médio manual: a bilheteria agora SEMPRE exporta (decisão do Marco, 25/07/2026)** — linha 427
  - a divergência existe na fórmula (o fato que motivou a trava original) — linha 435
  - a linha de Ingressos (bilheteria) É exportada, com o valor da TELA (cen.bruta), não a soma dos lotes — linha 442
  - nada bloqueia mais: r.alertas fica vazio, e um AVISO informativo nomeia o ticket manual e o valor — linha 449
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 452) — linha 452
  - vale igual para o ajuste de ticket em % sem ticket manual (mesma porta de entrada): exporta, sem alerta — linha 457
  - o resto do plano continua exportável, junto com a bilheteria (que agora sai sempre) — linha 468
  - não inventa o aviso de "nenhum lote tem receita" — há receita, só não é a soma ingênua dos lotes — linha 479
  - EXPORT NORMAL (sem ticket manual nem ajuste) segue idêntico: nada de alerta, nada de aviso extra — linha 484
- **DECISÃO DO MARCO (25/07/2026) — bilheteria em UMA LINHA SÓ, sempre** — linha 505
  - (a) com ticket manual, exporta e o valor do arquivo é IGUAL ao da tela (cen.bruta) — linha 506
  - (b) o id da linha é o MESMO com e sem ticket manual — nunca muda de id_linha — linha 517
  - (c) os avisos de ticket manual, ajuste de ticket e lote negativo continuam aparecendo — como informativos — linha 531
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 535) — linha 535
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 548) — linha 548
- **avisosInformativosIngressos — causas combinadas (achado do provador adversarial, 26/07/2026)** — linha 564
  - (a) ticket manual + ajuste %: as DUAS causas aparecem no texto, cada uma com o valor exportado — linha 565
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 575) — linha 575
  - (b) ticket manual + lote negativo: o aviso do lote negativo diz a verdade do caminho MANUAL (o lote não entrou na conta) — linha 584
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 599) — linha 599
  - (c) ajuste % + lote negativo, SEM ticket manual: o aviso do lote negativo mantém a frase do caminho automático — linha 606
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 616) — linha 616
  - (d) as três causas juntas (ticket manual + ajuste % + lote negativo): nenhuma causa some — linha 623
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 633) — linha 633
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 635) — linha 635
- **emitirIngressos — bruta zerada: a causa nomeada no aviso é a real (26/07/2026)** — linha 655
  - (a) venda 0 de verdade (preço R$ 0): mantém a frase antiga, byte a byte — linha 656
  - (b) ajuste de ticket em -100% com lote vendendo de verdade: nomeia o ajuste, NÃO diz "venda 0" — linha 673
  - (c) dois lotes que se cancelam exatamente: nomeia o lote NEGATIVO mesmo com bruta zerada — linha 691
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 705) — linha 705
  - (d) mais de uma causa ativa ao mesmo tempo (ajuste + lote negativo): nenhuma causa some — linha 711
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 724) — linha 724
- **causasBrutaZero — a negativa "venda 0" só pode ser dita depois de checar cen.pagos (26/07/2026)** — linha 741
  - (i) venda real 0, NENHUMA flag ativa: mantém a frase antiga, byte a byte (cen.pagos = 0) — linha 742
  - (ii) venda real > 0, flag ativa (ticket manual): nomeia a flag como causa, e a negativa "NÃO é venda 0" é verificada (cen.pagos > 0) — linha 760
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 769) — linha 769
  - (iii) venda real 0, flag ativa (ticket manual OU ajuste): diz que a venda é zero — a flag some como causa e vira observação (cen.pagos = 0) — linha 775
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 786) — linha 786
  - (iv) lote negativo cancelando positivos: mantido — venda real > 0 (cen.pagos > 0), a negativa "NÃO é venda 0" continua legítima — linha 807
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 819) — linha 819
- **montarItensPlano — evento que já tem realizado avisa ANTES de gerar** — linha 833
  - sem nenhum realizado, o aviso não aparece (nada a explicar) — linha 834
  - com realizado preenchido, avisa que o arquivo leva o PREVISTO e por quê — linha 839
  - conta os itens no plural e soma o realizado de todos — linha 854
  - realizado vazio ou 0 não dispara o aviso — mesma régua de valorConsiderado — linha 864
- **montarItensPlano — o arquivo nunca diverge da tela em silêncio (20/07/2026)** — linha 888
  - LOTE NEGATIVO: a linha de Ingressos leva o líquido certo (cen.bruta), com aviso informativo nomeando o lote negativo — linha 901
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 916) — linha 916
  - LOTE NEGATIVO + TICKET MANUAL: os dois avisos aparecem juntos, e a linha leva o valor certo (cen.bruta) — linha 921
  - CUSTO NEGATIVO: desconto negociado some do arquivo em silêncio — linha 944
  - PARCELA NEGATIVA: a soma confere contra o estimado e o arquivo leva outra coisa — linha 973
- **montarItensPlano — o caminho normal não mudou nem um byte (exceto a forma da linha de Ingressos, 25/07/2026)** — linha 1015
  - gera exatamente o mesmo CSV de hoje, e sem alerta nenhum — linha 1025
- **DECISÃO 1 do Marco (20/07/2026) — custo com parcelas TODAS em branco** — linha 1072
  - o arquivo leva o ESTIMADO do custo, numa linha só (hoje leva só a contingência) — linha 1093
  - avisa que a agenda não existe e que a DATA que foi para o arquivo é provisória — linha 1110
  - (dinâmico: `aviso` — variável, valor muda por caso; ver código-fonte, linha 1116) — linha 1116
  - com dataPagamento preenchida, o aviso cita a data e ela sai na coluna — linha 1121
  - parcelas ZERADAS à mão contam como agenda em branco (a régua ampla) — linha 1129
  - a régua é o valor DEFAULT de novaParcela(), não o literal "" — linha 1135
  - CASO VIZINHO (não decidido, não muda): parcelas PARCIALMENTE preenchidas — linha 1141
- **DECISÃO 2 do Marco (20/07/2026) — ajuste de custo do cenário realista** — linha 1152
  - +10%: o arquivo publica o CRU (8.400) e avisa que não carrega o ajuste — linha 1168
  - −20%: mesmo arquivo cru, e o aviso diz que ele manda MAIS dinheiro que a tela — linha 1180
  - 0%: nenhum aviso de ajuste (o default não tem nada a dizer) — linha 1196
- **PONTO 5 — bar com receita <= 0 sumia do arquivo sem uma palavra** — linha 1203
  - bar POR PESSOA líquido negativo: nenhuma linha, mas agora COM alerta — linha 1214
  - (dinâmico: `alerta` — variável, valor muda por caso; ver código-fonte, linha 1228) — linha 1228
  - bar FIXO negativo: mesmo alerta, sem a frase do modo por pessoa — linha 1231
  - (dinâmico: `alerta` — variável, valor muda por caso; ver código-fonte, linha 1239) — linha 1239
  - bar = 0 (open bar ou campo vazio): zero alerta, zero aviso — silêncio total — linha 1242
- **PONTO 7 — contingência NEGATIVA sumia do arquivo** — linha 1251
  - contingência de −10% sobre custo 500: nenhuma linha, mas agora com alerta — linha 1252
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 1271) — linha 1271
- **PONTO 8 — patrocínio fechado NEGATIVO sumia do arquivo** — linha 1278
  - dois confirmados, 5.000 e −6.000: nenhuma linha, mas agora com alerta — linha 1279
  - (dinâmico: `a` — variável, valor muda por caso; ver código-fonte, linha 1290) — linha 1290
  - CONTROLE: total POSITIVO com um item negativo dentro sai correto e calado — linha 1295
- **O EMISSOR contra si mesmo — a invariante que impede o NONO furo** — linha 1308
  - toda montagem devolve a trilha de conferências, com os 5 blocos presentes — linha 1309
  - bloco que NÃO foi conferido vira alerta de erro interno (nada sai calado) — linha 1316
  - nenhuma linha chega ao arquivo por fora do emissor (leitura do próprio módulo) — linha 1326
- **[S1] o aviso do ajuste de custo só pode afirmar o que FOI EMITIDO** — linha 1363
  - realizado: o aviso não pode afirmar o CONSIDERADO (que o arquivo não leva) — linha 1364
  - parcelas: a DIREÇÃO do efeito não pode sair invertida — linha 1391
  - bloco REJEITADO: o aviso não pode subestimar o que ficou de fora — linha 1412
  - controle: evento limpo continua com o aviso EXATO — linha 1437
- **[S4] o aviso do ajuste não dispara com efeito prático de R$ 0** — linha 1450
  - custoPct 0,0001 não produz um aviso que afirma "R$ 0" — linha 1451
  - mas um ajuste com efeito de verdade continua avisando — linha 1461
- **[S2-a] taxa e cashback não podem sumir sem nome nem valor** — linha 1470
  - declara taxa e cashback como fora do arquivo, com o valor em R$ — linha 1471
  - sem taxa e sem cashback, nada é declarado à toa — linha 1488
  - a tela não promete completude sem mostrar o que ficou de fora — linha 1495
- **[S2-b] custo que só tem realizado não pode passar como ok e em silêncio** — linha 1503
  - alerta e a conferência do bloco NÃO aprova a própria omissão — linha 1504
  - item com estimado E realizado segue exportando o estimado, sem alerta — linha 1519
- **[S3-a] a coluna da tabela não pode se chamar "Na tela"** — linha 1529
  - o rótulo diz que a coluna é a REFERÊNCIA conferida, não o que a tela mostra — linha 1530
- **[S3-b] o aviso da agenda em branco não pode negar o que o Marco preencheu** — linha 1537
  - parcelas em branco COM datas: as datas são citadas, não negadas — linha 1538
  - parcelas com 0 DIGITADO: o texto diz que o app lê 0 como vazio e a ação acerta o alvo — linha 1549
  - parcelas 100% em branco e SEM data: o texto de sempre continua válido — linha 1560
- **[S3-c] o alerta de ingressos não garante blocos que não inspecionou** — linha 1577
  - não afirma que bar, patrocínio e custos estão corretos — linha 1578
- **conferência do emissor — meio centavo CRAVADO já é divergência** — linha 1616
  - meio centavo A MAIS do que a tela: vira alerta e a linha NÃO entra no arquivo — linha 1619
  - meio centavo A MENOS do que a tela: vira alerta mesmo sem nenhuma linha para segurar — linha 1644
  - resíduo de ponto flutuante continua conferindo — a régua não virou "zero exato" — linha 1668

### ponteOrigem.test.js

*7 describe · 20 it/test*

- **ponteOrigem — a constante é o espelho do config.py do Financeiro** — linha 33
  - a origem autorizada é a porta do "Iniciar Previsão.command" (4173) — linha 34
  - origem igual à autorizada passa; origem de desenvolvimento não passa — linha 40
  - sem navegador (origem vazia) conta como autorizada — não há CORS para barrar — linha 45
  - a mensagem carrega a origem REAL — o dono precisa ver onde ele está — linha 50
- **backup (POST) — origem errada não vira mais "Financeiro fechado"** — linha 61
  - origem errada + falha → motivo "origem" com a origem real — linha 62
  - origem certa + falha → "fechado" (agora a mensagem é verdadeira) — linha 69
  - origem certa + sucesso → ok, com o arquivo gravado — linha 74
  - origem errada NÃO bloqueia a chamada: se a ponte aceitar, o envio vale — linha 84
- **leituras (GET) — mesmo diagnóstico dos dois lados da ponte** — linha 96
  - eventos: origem errada + falha → mensagem de origem, não "Abra o Financeiro" — linha 97
  - eventos: origem certa + falha → "Abra o Financeiro…" — linha 104
  - curva: origem errada + falha → mensagem de origem com a origem real — linha 110
  - curva: origem certa + falha → "Abra o Financeiro…" — linha 114
  - curva: origem certa + sucesso → devolve a curva validada — linha 120
- **mensagemFalhaBackup — o mapeamento mora em um lugar só** — linha 150
  - cada motivo tem sua mensagem, e só "fechado" fala em Financeiro fechado — linha 151
- **cópia da nuvem — quem é nuvem** — linha 179
  - https fora do próprio computador é nuvem — linha 180
  - a 4173 do Mac, o modo dev, http de rede local, https em localhost e origem vazia NÃO são nuvem — linha 185
- **cópia da nuvem — a frase diz a verdade** — linha 202
  - na nuvem: "cópia da nuvem", "só no app do Mac", sem "modo desenvolvimento" e sem .command — linha 203
  - na 4173 e no modo dev: a frase de ANTES, palavra por palavra — linha 219
- **cópia da nuvem — as leituras nem chamam localhost** — linha 227
  - eventos, curva e curva-edições: rejeitam com a frase da nuvem e o fetch NÃO é chamado — linha 232
  - na 4173 as três continuam CHAMANDO a rede, e falha continua sendo "Abra o Financeiro" — linha 240

### precoLote.test.js

*2 describe · 4 it/test*

- **paridade com as expressões antigas do JSX** — linha 38
  - caso %i da grade *(each)* — linha 39
  - números conferidos à mão (o print do Marco): tabela 275 com efetivo 8% → 253; ao cliente ×1,12 → 283,36 — linha 55
- **receitaEfetivaLote — a coluna Receita da tabela (decisão do Marco, 20/07/2026)** — linha 66
  - lote comum: efetivo × quantidade; cortesia vale 0; só-otimista vale 0 — linha 67
  - sem cupom, efetiva = tabela (nada muda para quem não usa desconto) — linha 78

### premissas.test.js

*9 describe · 36 it/test*

- **formaAjustes — forma do campo aditivo do store** — linha 48
  - ausente/inválido vira o vazio "herda tudo" — linha 49
  - preserva números e strings numéricas; lixo em campo vira "" (= herda) — linha 55
  - tipo com nome vazio é descartado; idempotente (forma da forma = forma) — linha 66
- **resolverPremissas — herança tipo → Padrão geral → padrões do app** — linha 74
  - sem nada configurado, tudo resolve nos padrões do app (origem "app") — linha 75
  - campo do tipo vence o geral; campo só no geral herda do geral; resto do app — linha 85
  - tipo sem premissa própria e evento SEM tipo herdam do Padrão geral (decisão registrada) — linha 96
- **temPremissas** — linha 105
  - vazio não tem; qualquer campo preenchido (evento ou grade) tem — linha 106
- **novoEventoDoTipo — premissa age SÓ no nascimento** — linha 119
  - sem premissa nenhuma configurada, nasce EXATAMENTE como novoEvento() + tipo — linha 129
  - campo resolvido no nível "app" não é regravado: sem premissa de margem, o evento nem ganha a chave — linha 137
  - nasce com as premissas do tipo (e herdadas do geral), tudo numérico — linha 143
  - string numérica de premissa vira número no evento — linha 155
  - só CRIA: os ajustes passados não são mutados — linha 159
- **custos padrão por festa (sugestão 21) — lista do Marco, nunca derivada de evento** — linha 168
  - forma: categoria desconhecida vira "extras" (valor visível, nunca some calado); lixo é descartado; id gerado — linha 184
  - herança por LISTA INTEIRA: tipo com lista usa a sua; sem lista, a do Padrão geral; sem nada, nenhuma — linha 201
  - evento novo do tipo nasce com os custos lançados: categoria certa, status ORÇAR, id NOVO por evento — linha 214
  - tipo sem lista própria nasce com os custos do Padrão geral; sem nada configurado, sem custos (como sempre) — linha 228
  - só CRIA — não retroage: os ajustes não são mutados e nenhum evento é lido — linha 239
  - temPremissas conta a lista de custos (chip ● e legenda do modal) — linha 246
- **lotes padrão por festa (sugestão 32) — gabarito de nascimento, zero fórmula** — linha 253
  - forma: valor/quantidade seguem a régua numérica; marcações booleanas; lixo descartado; id gerado — linha 269
  - herança por LISTA INTEIRA: tipo com lista usa a sua; sem lista, a do Padrão geral; sem nada, nenhuma — linha 287
  - evento novo do tipo nasce com o gabarito: nomes/valores certos, cortesia = valor 0, id NOVO por evento — linha 298
  - tipo sem gabarito próprio nasce com o do Padrão geral; sem nada, os lotes padrão de sempre — linha 312
  - só CRIA — não retroage: os ajustes não são mutados — linha 323
  - temPremissas conta a lista de lotes (chip ● e legenda do modal) — linha 330
- **round-trip de backup com o campo aditivo `ajustes`** — linha 336
  - backup ANTIGO (sem a chave) abre e NÃO zera os Ajustes atuais — linha 344
  - backup NOVO com a chave substitui os Ajustes por inteiro (regra documentada) — linha 350
  - round-trip: ajustes exportados voltam idênticos pelo parse — linha 357
- **premissas da sugestão 29 (desconto parcial + taxa paga por) — F2-R** — linha 368
  - forma: modo/taxa fora do vocabulário viram "" (= herda) — premissa torta nunca liga nada sozinha — linha 386
  - herança campo a campo: tipo vence o geral; campo só no geral herda; resto cai no app — linha 400
  - nascimento: evento do tipo nasce com os 3 campos — e a conta usa exatamente eles — linha 411
  - sem premissa dos campos novos, o evento nasce como novoEvento() ("" nos 3 — conta de sempre) — linha 419
  - temPremissas conta os campos de escolha (chip ● dos Ajustes) — linha 426
- **premissa da sugestão 30 (vendas abrem N dias antes) — F2-S** — linha 433
  - herança campo a campo: tipo vence o geral; sem nada, "" (sem premissa) — linha 439
  - nascimento: o N herdado NASCE com o evento (a data em si não existe ainda — o evento nasce sem data) — linha 445
  - sem premissa, o evento nasce como novoEvento(): "" no campo (curva como sempre) — linha 452
  - forma: valor torto vira "" e temPremissas conta o campo (chip ● dos Ajustes) — linha 456

### premissaTexto.test.js

*5 describe · 20 it/test*

- **premissaDesconto (sugestão 29a)** — linha 22
  - sem cupom (vazio, 0, ausente) → "" — nenhuma premissa a citar — linha 23
  - campo antigo (só cupom) → "em todos os ingressos" — linha 29
  - modo % → "em X% dos ingressos" (100% continua "todos") — linha 33
  - modo nº → "em até N ingressos (fração por cenário)"; sem nº → "todos" — linha 42
  - números em português: vírgula decimal ("7,5%") — linha 51
- **premissaTaxa (sugestão 29b)** — linha 58
  - só cita no modo repasse — o padrão "por nós" não vira premissa — linha 59
- **premissasBilheteria (lista para o rodapé)** — linha 69
  - sem premissa → lista vazia; com desconto → a frase exata — linha 70
  - desconto + taxa repassada = as duas frases, na ordem do mapa da sugestão — linha 77
- **régua ticket (Sessão F2-Y — item 4): frase de gente + continha real** — linha 93
  - rótulos e frases base — linha 94
  - continha do bruto: tabela − cupom = bruto (desfaz o desconto efetivo) — linha 103
  - continha do bruto sem cupom = o próprio preço de tabela — linha 111
  - continha do líquido (paga por nós): bruto − taxa + cashback = líquido — linha 118
  - continha do líquido no modo cliente: a parcela da taxa some — linha 128
  - sem ingresso pago: continha vazia e micro cai só na frase — linha 137
  - legendasRelatorio: com o realista põe "Neste evento"; sem ele, genérico; sem bar/patrocínio — linha 143
- **premissas da curva (Sessão F2-S — sugestão 30)** — linha 168
  - pela premissa da festa: "vendas abrem 45 dias antes da festa (29/07/2026)" — linha 169
  - data preenchida à mão: "início de vendas em 13/08/2026 (30 dias antes)" — o campo vence — linha 174
  - sem início (ou depois da festa) → "" — o rodapé não cita premissa ignorada — linha 179
  - referência escolhida é citada como guardada; padrão cita a média da festa — linha 184
  - premissasCurva: com início vem o par; sem início só referência ESCOLHIDA vira frase — linha 195

### promoverBenchmark.evidencia.test.js

*4 describe · 22 it/test*

- **ANTES (até 20/07/2026) — a receita do benchmark era bilheteria BRUTA e nada mais** — linha 191
  - (a) O Galeao: taxa (R$ 19.360), cashback (R$ 1.760), bar (R$ 14.200) e patrocínio (R$ 30.000) ficavam TODOS de fora — linha 192
  - (b) Marfim sem bar e sem patrocínio: só a taxa de 10% já inverte o sinal — linha 220
  - (c) SEM bilheteria realizada: a receita vira a soma dos lotes CHEIOS, ingressos que nunca venderam — linha 235
  - (d) ticket médio manual (R$ 140) NÃO chega ao benchmark: nem à receita, nem ao ticketMedio — linha 249
  - (e) prejuízo de verdade: o benchmark acerta o sinal por sorte, e ainda erra o valor — linha 268
  - o público gravado é sempre `publicoEstimado`, nunca o público do cenário — linha 283
  - os custos por categoria são `valorConsiderado`, e o custoTotal fecha com a soma deles — linha 292
- **PROPOSTO (aprovado pelo Marco em 20/07/2026 — princípio 1)** — linha 309
  - (a) O Galeao: o benchmark passa a gravar +R$ 24.100, o mesmo do card — linha 320
  - (b) Marfim: passa a gravar −R$ 6.200, o prejuízo que a festa deu — linha 328
  - (d) Sobrado: +R$ 28.350, com bar e cashback dentro — linha 334
  - (e) Brisa: −R$ 5.900, e não mais −R$ 6.000 — linha 340
  - a regra geral: promovido e card NUNCA divergem em festa com realizado lançado — linha 344
  - (c) sem bilheteria realizada, a promoção NÃO inventa R$ 56.000 de lucro — linha 354
- **RESTRIÇÃO DURA — benchmark já promovido e salvo NÃO muda** — linha 368
  - o benchmark salvo carrega os números ANTIGOS, e é isso que tem de sobreviver — linha 383
  - benchmarksDisponiveis devolve o objeto SALVO, sem recalcular nada — nem por igualdade, nem por identidade — linha 389
  - as três telas de leitura passam o custom adiante intacto (visíveis, ativos, disponíveis) — linha 401
  - override e "salvar como padrão" só alcançam os EMBUTIDOS — um override com o id do custom é ignorado — linha 409
  - o round-trip do backup JSON devolve o benchmark antigo byte a byte — linha 418
  - promover a MESMA festa de novo cria um benchmark NOVO, com id próprio — não reescreve o antigo — linha 426
  - VARREDURA — os únicos escritores de benchmarksCustom são criação, edição do Marco, exclusão e merge de backup — linha 436
- **A RÉGUA — a mesma festa nova é aprovada ou reprovada conforme a régua** — linha 462
  - a régua ANTIGA aprova a festa nova; a PROPOSTA reprova a MESMA festa — linha 481
  - a régua antiga é uma festa que "perdeu dinheiro" — e O Galeao ganhou R$ 24.100 — linha 504

### promoverBenchmarkNaoRegressao.test.js

*3 describe · 11 it/test*

- **os 4 benchmarks EMBUTIDOS não mudaram um centavo** — linha 88
  - a tabela de fábrica está byte a byte onde estava — linha 89
  - nenhum deles ganhou a etiqueta "sem reserva" — eles CARREGAM a reserva por dentro — linha 93
  - promover uma festa não encosta na tabela de fábrica — linha 104
- **benchmark JÁ PROMOVIDO e salvo não muda — nem lido, nem exportado, nem reimportado** — linha 163
  - sai da leitura exatamente como entrou, com os números ANTIGOS — linha 164
  - não ganha `semReserva` retroativamente — ninguém sabe o que havia dentro dele — linha 172
  - round-trip de BACKUP JSON: exporta, reimporta e continua idêntico — linha 179
  - promover uma festa NOVA acrescenta — não reescreve o antigo — linha 194
- **a comparação segue funcionando com embutido, promovido antigo e promovido novo juntos** — linha 213
  - os três tipos aparecem na mesma lista, na ordem esperada (embutidos primeiro) — linha 220
  - o /pax das barras (porPessoa) responde para os três, sem quebrar em nenhum — linha 228
  - só o promovido NOVO carrega a etiqueta — é ela que explica a diferença de régua — linha 242
  - o detalhe por categoria do promovido fecha com o custo total exibido — linha 248

### protecao.test.js

*7 describe · 24 it/test*

- **rotacionar** — linha 13
  - coloca o novo item no topo — linha 14
  - mantém no máximo `max` itens, descartando os mais antigos — linha 22
  - não muta a lista original — linha 29
  - respeita o limite da lixeira — linha 35
- **diaLocal** — linha 46
  - extrai AAAA-MM-DD de um ISO — linha 47
  - retorna vazio para data inválida — linha 50
  - a virada do Réveillon é 1º de janeiro, e o mês dela é 01 — linha 71
  - a Brisa de 05/12 cai em dezembro — 12, e nunca no mês de outra festa — linha 75
  - cada mês do calendário sai com o próprio número, de 01 a 12 — linha 79
- **jaTemSnapshotHoje** — linha 87
  - true quando já existe snapshot AUTO do mesmo dia — linha 89
  - false quando o snapshot do dia é só de segurança — linha 93
  - false quando o único auto é de outro dia — linha 97
  - false para lista vazia — linha 101
- **storeTemDados** — linha 106
  - true com pelo menos um evento — linha 107
  - true com pelo menos um benchmark custom — linha 110
  - false com store vazio ou nulo — linha 113
- **diasEntre** — linha 119
  - conta dias inteiros — linha 120
  - null para data ausente ou inválida — linha 123
- **statusBackup** — linha 129
  - nunca exportou → vencido — linha 131
  - export recente (menos que o limite) → não vencido — linha 134
  - no limite exato → vencido — linha 139
  - bem antigo → vencido com contagem de dias — linha 144
- **snapshotSeguranca (rótulo customizável — Sessão H)** — linha 151
  - grava tipo seguranca com o rótulo passado (ponte do Financeiro) — linha 172
  - sem rótulo explícito mantém o padrão "antes de restaurar" — linha 188

### quantidadeTravada.s6.test.js

*9 describe · 35 it/test*

- **S6 WhatsApp: linha-chave e ritmo trocam o mínimo pela notícia da trava** — linha 75
- **%s** — linha 76
  - %s *(each)* — linha 80
  - o resto do texto continua com os números que sempre teve (lucro, público, orçamento) — linha 102
  - SEM trava continua exatamente como era: mínimo 568 e a meta de ritmo numérica — linha 113
  - vazio, null, undefined, ausente e chave órfã NÃO travam: texto idêntico ao de mapa vazio — linha 120
  - trava só no PESSIMISTA: linha-chave e ritmo realistas continuam numéricos — linha 128
  - trava só no OTIMISTA também não toca o realista — linha 136
  - "não fecha" SEM trava segue dizendo "não fecha" (a trava não apagou o caso antigo) — linha 143
  - o relógio padrão (sem `hoje`) também decide: com a trava, a notícia; sem ela, a meta — linha 154
- **S6 ritmo puro (relatório, Home e função comum): a mesma notícia, sem meta** — linha 162
  - %s *(each)* — linha 163
  - o prefixo usa o separador de milhar da casa (1.234, não 1234) no WhatsApp e no relatório — linha 176
  - vendidos = 0 (preenchido, não vazio) também imprime o prefixo: zero vendido é dado, não ausência — linha 183
  - sem trava as três leituras seguem numéricas e idênticas às de antes — linha 189
  - a função comum calcula os cenários sozinha quando não os recebe, e só quando há trava — linha 203
  - trava só no pessimista: o ritmo realista não muda — linha 210
- **S6 glossário "Como ler este relatório"** — linha 219
  - %s: a definição é a própria notícia, sem "Neste evento: N" *(each)* — linha 222
  - sem trava: a definição com o número do evento, como antes — linha 230
  - sem o cenário realista (o ReportView passa null quando há dado quebrado): definição genérica, sem número — linha 240
  - só o verbete do break-even muda: os demais termos e a ordem são os mesmos de sem trava — linha 246
  - trava só no pessimista: o realista continua com o número — linha 257
- **S6 sobreposição com dado inválido (#98): "não dá para calcular" vence a trava** — linha 264
- **%s** — linha 270
  - controle: as guardas existentes ACUSAM o defeito antes das asserções de texto — linha 273
  - %s: a linha-chave diz NUMERO_NAO_CALCULA e o aviso de trava não aparece em lugar nenhum *(each)* — linha 279
  - ritmo (WhatsApp, relatório, Home) diz "não dá para calcular", sem meta e sem aviso de trava — linha 288
  - glossário: o verbete do break-even diz "não dá para calcular", não a trava — linha 299
  - ticket de bar do OTIMISTA = 1e308 com o realista travado: o realista recebe a trava, o otimista o dado inválido — linha 308
- **S6 × #98 — a soma que não cabe em OUTRO cenário (insumo compartilhado) também vence a trava** — linha 325
  - controle: sozinho o realista cabe; com a visão dos três, as guardas acusam — linha 333
  - aviso, glossário, ritmo e WhatsApp dizem "não dá para calcular" — e a trava não aparece — linha 341
- **S6 × #98 × tempo — dado inválido vence também a marcação de realizado e a data ilegível** — linha 357
  - %s + custo 1e308 + trava: o ritmo diz "não dá para calcular" *(each)* — linha 360
- **S6 estados temporais (relógio fixo em 01/12/2026)** — linha 374
  - festa JÁ REALIZADA, travada: a marcação de realizado nas leituras de ritmo; a chave segue com o aviso — linha 375
  - festa passada travada com o campo de vendidos VAZIO também recebe a marcação — linha 392
  - festa passada SEM trava segue como era (a marcação já existia) — linha 398
  - o DIA da festa (hoje) ainda é futuro: a trava publica o aviso — linha 404
  - data ilegível (%s) com vendidos preenchidos: "data inválida", nunca "0/dia" nem "0 por dia" *(each)* — linha 410
  - data ilegível + campo de vendidos vazio + trava: o aviso da trava (não há meta, não há "0/dia") — linha 425
  - festa FUTURA travada com vendidos vazio (%s): o aviso — não some a linha *(each)* — linha 432
  - o mesmo evento, SEM trava e com vendidos vazio, não ganha o aviso (a Home segue calada, como antes) — linha 445

### quarentenaCopiaUnica.test.js

*2 describe · 4 it/test*

- **quarentena — o MESMO conteúdo ilegível guarda UMA cópia só** — linha 88
  - fechar o app à noite e reabrir de manhã não faz uma segunda cópia do mesmo bruto — linha 89
  - três reaberturas em três dias ocupam o espaço de UM bruto, não de três — linha 112
- **quarentena — um conteúdo ilegível DIFERENTE ganha a cópia dele** — linha 133
  - a corrupção nova é guardada; a cópia velha não é reaproveitada no lugar dela — linha 134
  - o que a faixa de socorro oferece baixar é o estrago de AGORA, não o de outro dia — linha 158

### quatroSuperficiesCusto.test.js

*3 describe · 11 it/test*

- **as quatro superfícies de custo devolvem o MESMO total** — linha 121
  - a festa dos quatro itens: 15.312,50 até o centavo nas três que guardam centavos — linha 125
  - e as quatro escrevem a MESMA coisa na tela — R$ 15.313 nas quatro — linha 138
  - nenhum par das quatro discorda, em nenhuma das festas de prova — linha 153
  - com DUAS categorias as quatro continuam idênticas — linha 189
  - com parte dos itens já pagos, o card continua batendo com a aba Custos — linha 202
  - a coluna Estimado do Fechamento é OUTRA grandeza — e a relação dela fecha ao centavo — linha 232
- **reordenar os itens de uma categoria não muda nenhuma das quatro** — linha 287
  - as 6 ordens dos três itens de três casas dão o MESMO número nas quatro — linha 297
  - e as 6 ordens escrevem a MESMA linha na tela — linha 314
  - o caso escolhido é sensível: a régua recusada (somar cru) dá DOIS valores — linha 336
- **festa sem categoria fora do mapa não ganha linha "Outras categorias"** — linha 353
  - ${nome}: a linha nem aparece, e vale zero — linha 394
  - quando a rubrica fora do mapa EXISTE de verdade, a linha aparece com o valor dela — linha 404

### realizadoZero.evidencia.test.js

*2 describe · 8 it/test*

- **HOJE — realizado 0 é lido como "não preenchido"** — linha 9
  - valorConsiderado volta ao estimado quando o realizado é 0 — linha 10
  - 0 digitado como texto ("0") também é ignorado — linha 14
  - zero não confirmado mantém orçamento de 23392 — linha 18
  - zero sem marca continua no estimado; marca explícita permite custou zero — linha 38
- **Contrato vigente com marca custouZero** — linha 45
  - 0 preenchido significa "custou zero" — linha 46
  - vazio, null e undefined seguem sendo "não preenchido" (usa o estimado) — linha 51
  - o Custo total previsto passa a bater com o gasto real — linha 57
  - evento SEM nenhum realizado zerado não muda um centavo (o golden tem de continuar intacto) — linha 73

### receitaLiquida.test.js

*2 describe · 5 it/test*

- **liquidaDeBruta espelha bilheteria() de calc.js** — linha 30
  - (dinâmico: `nome` — variável, valor muda por caso; ver código-fonte, linha 38) — linha 38
- **as duas regras, ditas com número** — linha 53
  - taxa paga por nós: 35.000 com taxa 10% e cashback 5% → 33.250 — linha 54
  - REPASSE: a mesma bilheteria vira 36.750 — a taxa existe e não desconta — linha 63
  - sem taxa nem cashback a líquida é a própria bruta, nos dois modos — linha 72
  - entrada vazia/ausente não vira NaN — linha 77

### receitaRealizada.s4.test.js

*1 describe · 8 it/test*

- **S4 receita realizada: fronteira de import e leitura preservada** — linha 8
  - import ${antigo?'antigo':'atual'} recusa bar ${JSON.stringify(bar)} com original — linha 9
  - bar válido ${bar} conserva significado — linha 17
  - load, edição de nome e reload preservam bar bruto — linha 18
  - bilheteria/Pix corrigidos são listados, bar preservado no restauro — linha 19
  - Pix ausente permanece ausente — linha 20
  - censo nomeia bilheteria/bar/Pix, destino vazio e original por campo — linha 22
  - Pix inválido ${JSON.stringify(pix)} normaliza e censo informa original — linha 26
  - Pix válido ${pix} preserva — linha 27

### reguaBackup.evidencia.test.js

*6 describe · 19 it/test*

- **régua do backup mexido à mão — caso 1: item de custo nulo → RECUSA nomeando evento e categoria** — linha 56
  - parseBackup LANÇA — nada foi importado — linha 71
  - a mensagem nomeia o EVENTO e a CATEGORIA, em português, e diz que nada foi importado — linha 75
  - categoria SEM a chave `itens` (undefined) não aciona a régua — só lista presente é varrida — linha 81
- **régua do backup mexido à mão — extensão de 25/07/2026: lotes[], patrocinios[] e categorias[] (a categoria em si)** — linha 94
  - lote nulo no MEIO da lista de lotes → RECUSA, nomeando o evento e o nº do lote — linha 95
  - lote bom (nenhum nulo) continua passando — caso feliz do vetor — linha 104
  - patrocínio nulo no MEIO da lista de patrocínios → RECUSA, nomeando o evento e o nº do patrocínio — linha 111
  - patrocínio bom (nenhum nulo) continua passando — caso feliz do vetor — linha 123
  - categoria nula no MEIO da lista de categorias (a categoria em si, não um item dela) → RECUSA, nomeando o evento e o nº da categoria — linha 130
  - categoria boa (nenhuma nula) continua passando — caso feliz do vetor — linha 142
- **régua do backup mexido à mão — caso 2: tipo errado ou infinito → ENTRA, com AVISO na lista existente** — linha 152
  - venda de cenário como texto "oitenta por cento" — parseBackup aceita, e o aviso aparece no censo — linha 153
  - custo estimado como Infinity — parseBackup aceita, e o aviso aparece no censo — linha 164
  - o aviso do caso 2 é a MESMA superfície que o fora-de-faixa já usa — textoAvisoNormalizacoes lê os dois juntos — linha 190
  - objeto onde se espera número (preço do lote) também soa o aviso — linha 206
- **régua do backup mexido à mão — caso 3: `versao` ausente → ENTRA, com AVISO (reusa formatoAntigo)** — linha 215
  - `versao` AUSENTE num arquivo com identidade desta casa: entra, e formatoAntigo fica true — linha 216
  - `versao` como texto ilegível ("nao-sei"): mesmo tratamento — entra, formatoAntigo true — linha 222
  - `versao` presente e válida (o caminho normal) continua com formatoAntigo false — linha 227
- **régua do backup mexido à mão — o caso feliz: backup BOM continua entrando sem nenhum aviso** — linha 233
  - export sintético → parseBackup → mesmos números, sem censo e sem marca de formato antigo — linha 234
- **régua do backup mexido à mão — princípio 2: um backup ANTIGO válido continua importando** — linha 244
  - backup sem `app` e sem `versao` (formato pré-17/07) IMPORTA, com formatoAntigo=true e os números intactos — linha 250
  - backup antigo com MÚLTIPLOS eventos e sem identidade nenhuma segue importando todos, byte a byte — linha 259

### reguaTicket.test.js

*7 describe · 25 it/test*

- **reguaDoTicket — a régua é lida do que está salvo** — linha 29
  - sem ticket não há régua a nomear (devolve null, e a tela não põe etiqueta) — linha 30
  - ticket que fecha com bilheteria bruta ÷ público → régua da bilheteria — linha 37
  - ticket que fecha com receita ÷ público, sem bilheteria salva → régua antiga — linha 43
  - bilheteria salva que NÃO fecha com o ticket vira alarme, não vira régua antiga — linha 49
  - nada fecha → "não registrada", que é a resposta honesta e não um chute — linha 57
  - a régua GRAVADA no benchmark manda sobre a aritmética — linha 62
  - régua gravada que o app não conhece é IGNORADA — texto de arquivo editado não vira etiqueta — linha 70
- **vazio NÃO é zero — em toda a leitura** — linha 78
  - bilheteria bruta ZERO é um valor: existe, e nomeia a régua — linha 79
  - bilheteria bruta AUSENTE é vazio: não existe, e não nomeia régua nenhuma — linha 87
  - PÚBLICO zero não vira divisão por zero nem régua inventada — linha 94
- **"fechar" é ser o mesmo número com duas casas — e isso é uma escolha** — linha 101
  - o ruído do ponto flutuante fecha: 244.999,99 ÷ 1.633 é o mesmo ticket — linha 102
  - UM CENTAVO de diferença NÃO fecha — é outro número, e a tela mostraria outro número — linha 110
  - ticket ARREDONDADO à mão fica de fora — 297 não é 296,85 — linha 117
- **os 4 benchmarks EMBUTIDOS, medidos e não alterados** — linha 127
  - nenhum deles ganha régua no chute — dois sem ticket, dois com ticket arredondado — linha 128
  - ler a régua não encosta nos valores de fábrica — linha 136
- **mistura de réguas na mesma tela** — linha 144
  - uma régua só não é mistura — linha 149
  - duas réguas são mistura, e a lista devolve as duas na ordem em que aparecem — linha 155
  - benchmark SEM ticket não conta como régua — não entra em comparação de ticket — linha 160
  - "não registrada" CONTA como régua distinta — é a comparação que mais engana — linha 165
  - lista vazia, nula ou de lixo não vira aviso — linha 170
- **microtexto — toda régua tem etiqueta e explicação, em português** — linha 177
  - nenhum código fica sem texto (etiqueta órfã viraria "undefined" na tela) — linha 178
  - a etiqueta é a CONTA escrita, não um rótulo opaco — linha 193
- **entrada torta não derruba nem inventa** — linha 200
  - null, texto e número solto atravessam sem exceção — linha 201
  - ticket como TEXTO não vira régua (o campo não é numérico, então não há conta) — linha 208
  - bilheteria bruta Infinity/NaN é lida como ausente, nunca como valor — linha 212

### relatorio.test.js

*1 describe · 4 it/test*

- **nomeArquivoPdf (sugestão 41): nome sugerido do PDF** — linha 4
  - nome + data (DD-MM-AAAA com hífen) + "plano" — linha 5
  - sem data válida, sai só o nome + "plano" — linha 11
  - nome vazio/ausente vira "plano" — linha 17
  - tira caracteres inválidos de nome de arquivo (barra, dois-pontos etc.) — linha 23

### restaurarSnapshot.test.js

*1 describe · 4 it/test*

- **restaurarSnapshot — sem rede de volta, não aplica** — linha 35
  - caminho feliz: restaura e guarda a cópia de segurança do atual — linha 36
  - cópia de segurança FALHOU (quota): recusa com semSeguranca e erro em português — nada aplicado — linha 44
  - com o SIM explícito (forcarSemSeguranca), aplica e declara segurancaOk: false — linha 69
  - snapshot inexistente segue recusando como antes — linha 88

### resultadoFechamento.evidencia.test.js

*9 describe · 22 it/test*

- **a base de CUSTO nunca foi o problema — e continua intocada** — linha 112
  - custo do card === totalConsiderado do resto do app, exato — linha 115
- **item "custou zero" conta como realizado 0, e a base de custo continua fechando** — linha 129
  - a Banda marcada vale 0, sai da coluna de pendentes, e o invariante das duas telas fecha — linha 141
  - o card do Fechamento usa a MESMA base de custo — 20.000, não os 31.000 orçados — linha 155
- **SAÍDA (B) — evento 100% fechado, sem taxa nem patrocínio** — linha 166
  - 35.000 − 31.000 = +4.000, e o card pode se chamar "Resultado realizado" — linha 169
  - a contingência NÃO entra — e a ponte diz na tela por que a Home difere — linha 183
  - com tudo pago e tudo recebido, a contingência é ficção — foi o critério da escolha — linha 198
- **SAÍDA (B) — taxa, cashback e patrocínio: os dois erros consertados** — linha 206
  - 33.250 (líquida) + 5.000 (patrocínio) − 31.000 (custos) = +7.250 — linha 215
  - cada passo da conta tem seu número, para a tela poder somar na frente do leitor — linha 229
  - patrocínio em NEGOCIAÇÃO não entra — só confirmado ou recebido — linha 237
- **SAÍDA (B) — modo REPASSE: a taxa existe e NÃO desconta** — linha 252
  - 35.000 + 1.750 de cashback = 36.750 de líquida → +5.750 (e não +2.250) — linha 263
  - o card espelha `bilheteria()` de calc.js no mesmo evento — linha 273
- **SAÍDA (B) — evento PARCIAL: a base cheia dos dois lados sobrevive** — linha 283
  - os 11.000 ainda não pagos continuam na conta, pelo estimado — linha 286
  - bar ainda sem realizado entra pelo PREVISTO, nunca como zero — linha 296
  - o bar NÃO passa por taxa nem cashback — já é lucro líquido — linha 312
- **SAÍDA (B) — o resultado ainda sabe ser prejuízo** — linha 329
  - bilheteria realizada baixa contra custo cheio: vermelho, sem maquiagem — linha 330
  - sem nenhuma receita realizada informada, o card não existe — linha 343
- **a ponte com os Cenários decompõe a diferença — e sempre fecha** — linha 362
  - ${IDENTIDADE}, no evento em que a causa única mentia — linha 365
  - a reserva é contingência MAIS ajuste de custo, não só contingência — linha 391
  - com contingência 0 e ajuste 0 a diferença NÃO é zero — e a ponte ainda tem o que dizer — linha 410
  - a identidade fecha em 3.000 eventos aleatórios (o leitor soma com o dedo) — linha 428
- **a ponte nomeia cada parcela com o VERBO dela (2ª geração do defeito)** — linha 483
  - ajuste NEGATIVO maior que a contingência: elas têm sinais opostos e não podem ser fundidas — linha 484
  - a identidade de TRÊS parcelas fecha em 3.000 eventos aleatórios — linha 514

### resumo.test.js

*7 describe · 32 it/test*

- **resumoCurto** — linha 40
  - abre com o emoji do semáforo + nome/data/local e a frase do veredito — linha 41
  - cita os lucros dos três cenários exatamente como o app formata — linha 52
  - vermelho usa 🔴 e a frase de inviável — linha 61
  - inclui o ritmo quando há vendidos até hoje e evento futuro — linha 67
  - sem vendidos, a linha de ritmo não aparece (nada de número inventado) — linha 83
  - não mexe no evento (display-only) — linha 87
- **resumoCompleto** — linha 96
  - abre os três cenários com receita/custo e traz o % do orçamento — linha 97
  - o curto NÃO traz orçamento nem seção de cenários (é o nível de 1 tela) — linha 108
  - PARCIAL entra no "fechados ou pagos" do resumo (mesma conta da barra) — linha 118
  - patrocínio: fechado somado e proposta como potencial, nunca misturados — linha 136
  - premissas citadas: open bar e a regra exata do desconto (sugestão 29) — linha 147
- **festa FECHADA fala com o RESULTADO REAL (decisão do Marco, 20/07/2026)** — linha 162
  - curto: lidera com o resultado real da FOTO e não repete a projeção — linha 175
  - curto: fechado às 21h30 de São Paulo diz o dia LOCAL, não o de Greenwich — linha 192
  - curto: resultado real positivo abre com 🟢 — linha 205
  - curto: pendência declarada aparece quando a foto não é completa — linha 211
  - completo: resultado real na frente e o plano pré-evento segue como comparação — linha 216
  - festa ABERTA (mesmo com data passada) segue mostrando a projeção — fechar é o que oficializa — linha 223
- **PROPRIEDADE — o total do resumo é invariante ao status (item 1, export v2)** — linha 238
  - VERMELHO-ANTES/VERDE-DEPOIS: itens em status NOVO contam no total (a linha do Orçamento aparece) — linha 255
  - trocar o status de qualquer item NÃO move um centavo do total — linha 262
- **o resumo do WhatsApp e a festa que não fecha (regressão achada em 27/07/2026)** — linha 276
  - festa JÁ REALIZADA que não fecha continua dizendo que já aconteceu — linha 295
  - festa FUTURA que não fecha diz que não há ritmo — em vez de sumir com a linha — linha 300
  - o resumo não se contradiz: se os números-chave dizem que não fecha, o ritmo não cala — linha 305
  - (dinâmico: `t` — variável, valor muda por caso; ver código-fonte, linha 309) — linha 309
- **a data da festa que não é uma data (achado S1, 30/08/2026)** — linha 335
  - as quatro datas medidas: só a ISO produz ritmo, e nenhuma outra produz número — linha 342
  - as cinco superfícies dizem o problema em vez de mostrar "0" — linha 357
  - o "coberto" também não inventa "a 0 dia(s) da festa" — linha 372
  - a festa que JÁ ACONTECEU continua com a marcação dela, não com a da data — linha 381
  - a data BOA não mudou em nada — o conserto não encostou no caminho normal — linha 390
- **resumo de festa com custo que não cabe numa conta de dinheiro** — linha 405
  - curto: linha no topo, sem veredito, e nenhum lucro ou margem em número — linha 421
  - completo: cenários e orçamento sem número de lixo, nem o de centenas de dígitos — linha 432
  - festa FECHADA com a foto quebrada: "Resultado real: não dá para calcular", sem 🟢 — linha 440
  - CONTRAPROVA: a festa sã sai com o veredito e os números de sempre, sem a linha de aviso — linha 448

### revisaoImportPlanilha.test.js

*3 describe · 12 it/test*

- **P6 — contratos separados por destino** — linha 9
  - evento recusa negativo, referência conserva, lote inválido não entra em nenhum — linha 10
  - IDs transitórios permanecem e res deep-freeze não muda — linha 17
  - %s respeita matriz de faixa e vazio *(each)* — linha 21
  - quantidade negativa antes de round e acima do teto não escapam — linha 33
  - seleção forçada não passa valores recusados; benchmark negativo isolado continua -5000 — linha 38
- **P6 — aplicar e desfazer pontual** — linha 44
  - aplica pacote uma vez, protege IDs repetidos e não muda argumento — linha 45
  - desfazer conserva outra festa editada, recusa importado editado e ausente é no-op — linha 51
- **P5 — decisão de divergência pertence à revisão** — linha 61
  - sem escolha bloqueia pacote; seleção forçada não resolve — linha 63
  - %s muda ambos destinos sem gravar metadados *(each)* — linha 67
  - desmarcar conflito dispensa escolha; voltar escolha nula bloqueia novamente — linha 72
  - só tolerância de máquina:0.1×3≈0.3,5000vs4999.999 ainda divergem — linha 76
  - P5 — produto não finito recusa nos dois destinos sem aproveitar total informado — linha 82

### revisaoRestauracao.test.js

*5 describe · 21 it/test*

- **correcoesDaMigracao — quais campos, em qual evento, de que valor para qual** — linha 49
  - grade de cenário fora da faixa: diz o campo, o valor salvo e que o cenário volta ao padrão — linha 50
  - campo comum fora da faixa: o microtexto é o OUTRO — o campo fica vazio e pede o número — linha 64
  - a frase de cada linha é a MESMA que o aviso do import já usa (fonte única) — linha 75
  - dado são, lista vazia e entrada torta não inventam correção nenhuma — linha 84
- **efeitoNoResultado — quanto dinheiro a correção move** — linha 91
  - o caso do achado: R$ 54.250 de lucro viram R$ 10.150, e 163% de margem viram 31% — linha 92
  - só lista o que se MOVEU — realista e otimista não entram, porque o veneno era só do pessimista — linha 107
  - cada linha diz o próprio formato — a tela não adivinha R$ ou % pelo texto do rótulo — linha 116
  - dado são: nenhum número se move, então não há efeito nenhum (null) — linha 123
  - evento que quebra a conta vira aviso em português, não uma tela morta — linha 128
- **revisarRestauracao — o instantâneo inteiro** — linha 146
  - o store CRU sai daqui intocado, e o corrigido é o que se aplica — linha 147
  - instantâneo são não pede revisão: restaurar continua sendo um clique só — linha 161
  - store sem eventos, vazio ou nulo não quebra — linha 168
  - revisar o JÁ corrigido não acha nada — corrigir duas vezes é corrigir uma — linha 175
  - O BURACO QUE A LISTA DE CAMPOS SOZINHA DEIXARIA: dinheiro que se move sem correção nomeada aparece assim mesmo — linha 182
- **revisarEventoRestaurado — o evento que volta da lixeira** — linha 207
  - devolve o evento corrigido, o cru ao lado e o que mudou — linha 208
  - evento são volta sem revisão — restaurar da lixeira segue instantâneo — linha 217
- **resumoRevisao — a frase de cabeçalho** — linha 225
  - conta os valores corrigidos e quantas previsões mudam de resultado — linha 226
  - plural certo com mais de um — linha 231
  - dinheiro que se move sem correção nomeada tem frase própria, nunca vazia — linha 241
  - sem revisão, sem frase — linha 248
  - S4 bar textual restaurado fica bruto sem promessa de correção; bilheteria e Pix listados — linha 254

### ritmoPorDia.test.js

*6 describe · 14 it/test*

- **o ritmo em dias — o caso que o Marco derrubou olhando a tela** — linha 17
  - a janela é de 12 dias e o ritmo é 24 por dia — linha 20
  - a frase diz dias, não semanas — e não traz mais janela arredondada — linha 26
  - A CONTA FECHA quando o Marco a refaz com os números MOSTRADOS na tela — linha 38
- **a propriedade que faltava: o ritmo mostrado nunca subestima o necessário** — linha 46
  - varredura de 406 janelas × 40 quantidades: porDia × diasVenda >= faltam, sempre — linha 51
- **a semana final mostra o ritmo, em vez de calar** — linha 82
  - ${c.dias} dia(s) até a festa → ${c.porDia} por dia — linha 92
- **o dia da festa tem texto próprio, no presente** — linha 108
  - não é evento passado, e a janela é zero — linha 113
  - a frase diz que a festa é hoje e quanto falta — sem falar em semana — linha 119
- **as superfícies não divergem de unidade na semana final** — linha 132
  - a 4 dias da festa, card, Home e relatório falam do MESMO ritmo por dia — linha 136
  - no dia da festa, as três dizem que a festa é hoje — nenhuma diz "última semana" — linha 149
- **as portas de sempre continuam onde estavam** — linha 160
  - venda que nem chega a abrir (início na data da festa): sem ritmo, e a nota explica — linha 161
  - break-even coberto: a frase do coberto, sem ritmo — linha 173
  - festa já realizada: a marcação, sem ritmo — linha 179
  - vendas que ainda não abriram: a janela é a de venda REAL, e a nota fica — linha 185
  - sem resultado de ritmo (campo vazio, sem data): nada explode — linha 195

### rotulosGrafico.test.js

*1 describe · 8 it/test*

- **linhasParaRotulosProximos — empilha rótulos próximos sem sobrepor** — linha 4
  - sem rótulos → sem linhas — linha 5
  - rótulo único fica na linha 0 — linha 9
  - dois rótulos LONGE (>= gap) ficam os dois na linha 0 — caso comum, desenho de antes — linha 13
  - dois rótulos PRÓXIMOS (< gap) empilham: o segundo desce para a linha 1 (o bug do "hoje" × "início de vendas") — linha 18
  - exatamente no limite do gap não é colisão (distância == gap fica na mesma linha) — linha 23
  - três rótulos: dois próximos empilham e o terceiro, longe do primeiro, volta para a linha 0 — linha 28
  - três rótulos todos apertados ocupam três linhas distintas — linha 34
  - a comparação é contra o ÚLTIMO da linha, não o primeiro — cadeia larga não empilha à toa — linha 40

### simulacaoRascunho.test.js

*7 describe · 33 it/test*

- **rascunhoDoEvento** — linha 100
  - é um clone profundo — mexer no rascunho não alcança o salvo — linha 101
  - carrega os três compartimentos MAIS a foto de onde saiu — linha 116
  - a foto é clone PRÓPRIO — editar o rascunho não reescreve o passado — linha 132
  - evento vazio/ausente não explode — slots vazios — linha 143
- **visaoDoRascunho — o evento como a tela o enxerga** — linha 150
  - o bar do rascunho aparece na visão, e as outras chaves de outrasReceitas continuam lá — linha 151
  - chave de outrasReceitas escrita DEPOIS de abrir o rascunho aparece na visão na hora — linha 166
  - sem rascunho, a visão é o próprio evento — linha 175
- **aplicarRascunho — o que vai para o store** — linha 181
  - grava os três slots e NÃO compartilha referência com o rascunho vivo — linha 182
- **editarRascunho** — linha 202
  - aplica os updaters reais da UI ao rascunho — cenários E bar — linha 203
  - mexer no bar NÃO mexe nos cenários, e vice-versa — linha 218
  - extrai SÓ os três slots — mudança em outro campo do evento é descartada — linha 228
  - updater que devolve lixo deixa o rascunho como está — linha 246
  - a foto de entrada atravessa a edição intacta — linha 258
- **resumoDoRascunho — o texto que o botão Aplicar promete** — linha 270
  - nada mudou → lista vazia — linha 281
  - campo ausente gravado com o próprio valor de exibição NÃO vira mudança (efetivo igual) — linha 287
  - vendas, custos e ajuste do ticket com valores efetivos e sinal — linha 293
  - decimal digitado no campo sai com vírgula (pt-BR), nunca com ponto — linha 306
  - ticket médio manual: automático → valor, valor → valor, valor → automático — linha 312
  - overrides por lote com o NOME do lote: fixar, mudar e voltar ao automático — linha 326
  - bar por pessoa: uma linha por cenário, em reais, com o rótulo do cenário — linha 339
  - cenário SEM bar diz "não informado" — a mesma palavra do aviso do cartão — linha 351
  - vazio → zero NÃO vira linha: a conta enxerga R$ 0 nos dois, nada mudou — linha 357
  - bar fixo (lucro líquido) tem linha própria, sem rótulo de cenário — linha 361
  - o bar é comparado sem olhar o modo do bar — se o slot mudou, o Aplicar grava — linha 367
  - TODO slot do rascunho produz linha no resumo (falha sozinho quando nascer um slot novo) — linha 382
- **aplicarRascunho grava SÓ o que o rascunho mudou** — linha 422
  - consumo de bar digitado na aba Receita durante a simulação SOBREVIVE ao Aplicar — linha 425
  - bar em VALOR FIXO digitado na Receita sobrevive quando o rascunho não o tocou — linha 443
  - cenariosConfig que o rascunho não tocou nem é gravado — linha 451
  - o MESMO campo nos dois lugares: o rascunho vence — e a linha aparece no rodapé — linha 463
  - vazio → zero deixou de pegar carona: o `` não vira 0 no dado salvo — linha 474
  - lista vazia → o Aplicar não muda NADA no evento — linha 486
- **PROVA BYTE A BYTE — mexer em tudo e sair sem aplicar não toca o salvo** — linha 500
  - localStorage idêntico (===) após entrar, mexer em todos os campos e descartar; update nunca chamado — linha 501
  - aplicar é o ÚNICO caminho que persiste — e persiste exatamente o rascunho, bar incluído — linha 563

### simulador.test.js

*4 describe · 19 it/test*

- **valorEfetivo** — linha 15
  - campo ausente devolve o fallback de exibição — linha 16
  - campo preenchido devolve o valor gravado — linha 23
  - campo vazio ("") devolve o fallback, não NaN — linha 26
- **simulacaoAtiva** — linha 31
  - cenariosConfig vazio não está ativa — linha 32
  - valores explícitos iguais ao alvo (80/90/100) não contam como ativa — linha 36
  - um slider fora do alvo já ativa — linha 45
  - campo ausente (evento antigo sem realista.vendaPct) não dispara alarme falso — linha 50
  - ticketMedio manual e overrides não interferem (não são campo de slider) — linha 57
- **resetarSimulacao** — linha 67
  - grava exatamente 80/90/100 (venda) e 10/-5 (custo) e 0 (ticket) em todos os cenários — linha 68
  - a partir de cenariosConfig vazio também grava o alvo explícito (não deixa ausente) — linha 79
  - preserva ticketMedio manual e overrides por lote intactos — linha 83
  - não muta o objeto original (imutável) — linha 91
- **regressão: FALLBACK_DISPLAY/ALVO_RESET batem com o que calc.js realmente calcula** — linha 98
  - pessimista: fallback de exibição = alvo do reset = o que calc.js usa sem cenariosConfig — linha 99
  - otimista: fallback de exibição = alvo do reset = o que calc.js usa sem cenariosConfig — linha 109
  - realista: sem cenariosConfig, calc.js usa 90% — e é o mesmo 90 do fallback E do alvo — linha 122
  - realista.custoPct: fallback de exibição (0) = alvo do reset = o que calc.js usa sem o campo — linha 134
  - otimista.vendaPct: fallback de exibição (100) = alvo do reset = o que calc.js usa sem o campo — linha 144
  - sliders novos ativam o selo e o reset os traz de volta ao alvo — linha 155
  - realista: 90 (o padrão) e 100 (escolha salva) dão resultados diferentes — o padrão nunca reescreve escolha salva — linha 163

### statusCusto.test.js

*7 describe · 19 it/test*

- **statusCusto — a lista canônica (uma fonte só)** — linha 22
  - 11 status na ordem do ciclo, cada um com id/rótulo/bg/texto — linha 23
  - defaults.js STATUS é a MESMA lista (não há segunda lista) — linha 33
  - padrão é ESTIMADO; statusCustoValido e isPago — linha 36
- **migrarStatusCusto — preservar, não achatar (as 4 do Marco)** — linha 45
  - PAGO→PAGO · FECHADO→FECHADO · NEGOCIANDO→NEGOCIAR · ORÇAR→ESTIMADO — linha 46
  - id novo já válido passa direto; ausente/desconhecido → ESTIMADO — linha 52
- **migração no evento — status garantido + campos novos** — linha 60
  - as 4 migrações valem no evento real — linha 80
  - NENHUM item sai da migração sem status válido (condição a do Marco) — linha 86
  - data_pgto/pagamento nascem "" no item E no patrocínio — linha 92
  - item novo nasce ESTIMADO e com os campos novos vazios — linha 101
  - input LEGADO → migração → custosPorStatus agrupa nas keys NOVAS — linha 113
- **estiloStatusCusto — fonte ÚNICA de cor (gate 4, igual à planilha)** — linha 134
  - os 11 status têm estilo com as cores canônicas exatas; desconhecido → undefined — linha 135
- **fechadoSemDadosPgto — o derivado (item 4)** — linha 146
  - FECHADO + pagamento vazio → true; com dados → false; outro status → false — linha 147
- **contaOrcamentoFechado — conta "fechados ou pagos", fonte ÚNICA (Marco, 22/07/2026)** — linha 155
  - subtotal negativo no total NÃO deixa a barra passar de 100% — linha 159
  - e não deixa a barra ficar NEGATIVA quando o numerador é que é negativo — linha 164
  - denominador = TODOS os status; numerador = PAGO+FECHADO+PARCIAL (o caso real do Marco: 43%) — linha 168
  - PARCIAL conta no numerador — dinheiro comprometido (decisão do Marco) — linha 175
  - status novos fora do numerador (ORÇADO/NEGOCIAR) contam no total, não no fechado — linha 181
  - total <= 0 → pct 0, sem divisão por zero — linha 185
- **round-trip de backup preserva o schema novo** — linha 191
  - status + data_pgto + pagamento sobrevivem a montarBackup→parseBackup — linha 192

### storageQuota.test.js

*1 describe · 3 it/test*

- **saveStore nunca falha em silêncio (hardening 4.1)** — linha 17
  - quota estourada → { ok:false, erro } SEM lançar (a UI mostra a faixa) — linha 18
  - gravação normal → { ok:true } e o round-trip com loadStore funciona — linha 30
  - ambiente sem localStorage → { ok:false } com motivo (nunca exceção) — linha 47

### superficiesDeReuniao.evidencia.test.js

*7 describe · 25 it/test · 16 skip*

- **A MEDIÇÃO SOBREVIVE — refeita com os módulos reais** — linha 92
  - a Brisa perdeu R$ 5.900 e o WhatsApp anuncia lucro de R$ 47 mil, com o sinal invertido — linha 93
  - o veredito fala no PRESENTE sobre uma festa de quatro meses atrás — linha 122
  - o módulo que SABE que a festa passou tem a frase pronta — e o texto voltou a mostrá-la — linha 127
- **O GATILHO DA "VERDADE" É FRACO — qualquer receita realizada liga o card** — linha 145
  - só o BAR lançado (R$ 2.000) já produz um "resultado" de +R$ 43.500 — linha 146
  - bilheteria lançada e NENHUM custo lançado NÃO vira "lucro de R$ 36.100" — vira +R$ 100 — linha 170
  - "o bar não vendeu nada" agora é dizível: realizado 0 conta como zero, não como o previsto — linha 192
  - custos TODOS lançados e receita nenhuma: não existe verdade, e a previsão segue sozinha — linha 207
  - o parcial também erra para o lado pessimista: 2 de 4 custos estourando dá −R$ 20.900 — linha 217
- **O CASO SILENCIOSO segue sendo o pior, e nenhum desenho o resolve** — linha 241
  - sem nada lançado o card não existe e a previsão responde sozinha — mas o benchmark já não inventa — linha 247
- **DESENHO A — "a verdade vence" (aguardando escolha do Marco)** **(SKIP)** — linha 269
  - a verdade só substitui a previsão quando o fechamento está COMPLETO — linha 273
  - fechamento INCOMPLETO nunca vira "Resultado real" — nem em texto, nem em número grande — linha 279
  - a previsão nunca some: ela desce para a segunda linha, nomeada — linha 288
  - festa passada sem NADA lançado perde a bola do semáforo e ganha a palavra previsão duas vezes — linha 293
- **DESENHO B — "o selo" (aguardando escolha do Marco)** **(SKIP)** — linha 299
  - a faixa aparece em toda festa passada, com ou sem realizado lançado — linha 302
  - a faixa só cita uma cifra de resultado quando o fechamento está COMPLETO — linha 308
  - sem realizado nenhum, a faixa diz o que falta e oferece o caminho — linha 315
  - a linha do WhatsApp deixa de se chamar "Lucro" e passa a se chamar "Lucro (previsto)" — linha 321
  - se o selo falhar por qualquer motivo, a tela fica exatamente como hoje — linha 326
- **DESENHO C — "previsto × realizado, lado a lado" (aguardando escolha do Marco)** **(SKIP)** — linha 331
  - a coluna Realizado só traz cifra com fechamento COMPLETO; senão traz "—" e o motivo — linha 332
  - no WhatsApp a ordem inverte: o realizado vem primeiro, o previsto vira contexto — linha 338
  - a diferença publicada é sempre previsto − realizado, com o sinal escrito por extenso — linha 343
  - festa futura sai exatamente como sai hoje — C não toca em nada antes da festa — linha 348
- **COMUM AOS TRÊS — o que nenhum deles resolve, e precisa de decisão separada** **(SKIP)** — linha 354
  - o benchmark promovido continua gravando outra conta, com o sinal invertido — linha 355
  - computeCenarios continua misturando custo realizado com receita prevista — isso é FÓRMULA — linha 362
  - realizado 0 continua indizível na receita e no custo — linha 366

### superficiesRealizado.evidencia.test.js

*7 describe · 19 it/test*

- **A verdade em dinheiro de cada festa (card do Fechamento)** — linha 152
  - (a) Brisa vendeu abaixo: a festa deu PREJUÍZO de R$ 5.900 — linha 153
  - (b) Marfim vendeu acima: LUCRO real de R$ 52.100 — linha 163
  - (c) Sobrado estourou custos: PREJUÍZO real de R$ 1.575 — linha 167
  - (d) O Galeao: taxa de 22% come R$ 19.360 entre a bruta e a líquida — linha 173
  - (e) O CASO SILENCIOSO: sem realizado lançado, o card NÃO EXISTE — linha 183
- **SINAL INVERTIDO — a superfície diz lucro e a verdade é prejuízo** — linha 192
  - (a) o WhatsApp anuncia 🟢 "Evento viável · realista R$ 47 mil" numa festa que perdeu R$ 5.900 — linha 193
  - (a) TODAS as 11 superfícies de computeCenarios invertem o sinal, juntas — linha 213
  - (a) o veredito diz "Evento viável" no PRESENTE sobre uma festa de 4 meses atrás — linha 225
  - (b) o pessimista publica PREJUÍZO de R$ 2.854 numa festa que lucrou R$ 52.100 — linha 233
  - (c) o otimista publica LUCRO de R$ 3.718 numa festa que perdeu R$ 1.575 — linha 242
- **AGRAVANTE 1 — o único marcador de "a festa aconteceu" é suprimido** — linha 250
  - ritmoVendas SABE que o evento passou, e tem frase própria em português — linha 251
  - mas o texto do WhatsApp descarta a frase (resumo.js:70) e some com o vestígio — linha 261
- **AGRAVANTE 2 — computeCenarios já mistura as bases dentro da previsão** — linha 296
  - (c) custo 100% REALIZADO contra receita 100% PREVISTA, com contingência sobre dinheiro já gasto — linha 297
- **AGRAVANTE 3 (CONSERTADO) — o benchmark grava o MESMO lucro do card** — linha 329
  - (d) montarBenchmarkDeEvento passa pela taxa, pelo cashback, pelo bar e pelo patrocínio — linha 330
  - (a) o mesmo evento não vira mais DOIS "lucros realizados" diferentes — linha 343
  - (e) no caso silencioso a promoção RECUSA em vez de inventar R$ 56.000 — linha 349
- **A ponte existe, mas só num sentido** — linha 357
  - o card sabe explicar por que difere da Home — a Home não sabe que o card existe — linha 358
  - a versão de reunião compara PREVISÃO com PREVISÃO mesmo depois da festa — linha 370
- **planoFinanceiro.js é o padrão de referência do app** — linha 389
  - não muda o número, mas DECLARA em português que está publicando o previsto — linha 390

### testeNaoDependeDoCalendario.test.js

*1 describe · 1 it/test*

- **(fora de qualquer describe)** — linha 41
  - (dinâmico: `f` — variável, valor muda por caso; ver código-fonte, linha 41) — linha 41

### toast.test.js

*2 describe · 7 it/test*

- **showToast entrega a mensagem a quem está ouvindo** — linha 36
  - entrega mensagem, ação e duração sem alterar nada — linha 37
  - entrega a TODOS os ouvintes, não só ao primeiro — linha 54
  - cada toast tem id próprio e crescente — o host usa o id como chave e para descartar — linha 64
  - o cancelador remove SÓ o ouvinte dele — linha 71
  - cancelar duas vezes não derruba nem remove o ouvinte de outro — linha 82
- **SEM ouvinte, showToast perde a mensagem em silêncio — e isso está apoiado de propósito** — linha 93
  - não lança, devolve um id, e ninguém recebe nada — linha 108
  - um ouvinte que se inscreve depois só recebe o que vier a partir dali — linha 121

### util.test.js

*6 describe · 27 it/test*

- **num — coerção numérica segura (nunca deixa NaN escapar pro app)** — linha 9
  - número e string numérica passam direto — linha 10
  - lixo/ausente vira 0, nunca NaN — linha 16
  - Infinity/-Infinity (não-finito) vira 0 — linha 25
  - normaliza -0 para 0 (o comentário do código: "-0" não pode aparecer em tela) — linha 30
  - NÃO é parser de formato brasileiro — vírgula decimal vira 0 (isso é papel do campoNumerico/parseMoney) — linha 36
- **uid — identificador único de item/lote/categoria** — linha 41
  - gera string não-vazia — linha 42
  - 1000 gerações seguidas, zero colisão — linha 48
  - usa crypto.randomUUID quando disponível (formato UUID padrão) — linha 54
  - cai no fallback (Math.random + timestamp) quando crypto.randomUUID não existe, e continua único — linha 59
- **clone — cópia profunda (nunca compartilha referência com o original)** — linha 72
  - objeto clonado é igual em valor mas é outra referência (inclusive aninhada) — linha 73
  - mutar a cópia NÃO muta o original — a razão de existir da função — linha 81
  - preserva arrays, primitivos e null aninhados — linha 90
- **agora — timestamp ISO 8601 do relógio do sistema** — linha 98
  - formato ISO 8601 com milissegundos e Z (UTC) — linha 101
  - acompanha o relógio (não é um valor congelado no import do módulo) — linha 105
  - é parseável de volta (round-trip Date → string → Date) — linha 113
- **armazenamentoUsavel — o localStorage deste ambiente serve para guardar?** — linha 119
  - localStorage completo (o do navegador) → usável — linha 129
  - sem localStorage nenhum → NÃO usável — linha 138
  - localStorage nulo → NÃO usável (null passa por typeof "object") — linha 143
  - meio-inicializado: objeto vazio (o que o Node 22+ entrega) → NÃO usável — linha 148
  - cada função que falta sozinha já torna inusável (as três são cobradas) — linha 153
  - função trocada por valor que não é função → NÃO usável — linha 163
- **arredondarCentavos / emCentavos / somaEmCentavos — a régua do centavo** — linha 173
  - meio centavo vai para LONGE do zero, dos dois lados (a régua do formatador) — linha 174
  - meio centavo que o double guardou um fio abaixo continua sendo meio centavo — linha 181
  - o que não é meio centavo não sobe: 0,004999 é zero, 123,4549 é 123,45 — linha 189
  - fora da faixa do centavo exato (R$ 10 trilhões) e não-número voltam como estão — o absurdo continua gritando — linha 195
  - somaEmCentavos soma centavos inteiros: 0,10 + 0,20 é 0,30, não 0,30000000000000004 — linha 202
  - somaCentavos (a régua dos custos, 25/07/2026) segue a MESMA régua do meio centavo — linha 208

### vendaPctEcensoImport.evidencia.test.js

*4 describe · 17 it/test*

- **3b — vendaPct ganha faixa PRÓPRIA 0..100 (os irmãos seguem em −50..100)** — linha 29
  - a régua nova RECUSA vendaPct −50 e 150; ACEITA 0 e 100 (as pontas) — linha 30
  - RED-evidência: a régua dos IRMÃOS (−50..100) aceitava vendaPct −50 — a lacuna que a faixa própria fecha — linha 37
  - o aviso da faixa própria fala português e ENSINA o range — linha 46
- **3b-anexo — a migração REMOVE a chave da grade fora da faixa (não grava "")** — linha 52
  - mecanismo (fato do calc): vendaPct "" PRESENTE ZERA o cenário; chave AUSENTE cai no fallback — linha 55
  - vendaPct 150 e −50 fora da faixa → chave REMOVIDA → loteQtdCenario cai no fallback — linha 64
  - custoPct −200 (irmão, achado de 20/07) → chave REMOVIDA (default do calc) — linha 81
  - '' pré-existente na grade → chave REMOVIDA (não informado = padrão) — linha 90
  - valores DENTRO da faixa passam byte a byte (0 e 100 nas pontas do vendaPct) — linha 100
  - overrides e ticketMedio de cenariosConfig passam INTOCADOS pelo delete — linha 115
- **3a — censo do que a migração normaliza em silêncio (aviso agregado)** — linha 130
  - exemplo aprovado (estimado −1.000 + custoPct −200) → exatamente 2 itens com os rótulos — linha 131
  - arquivo LIMPO (tudo dentro da faixa) → 0 itens — linha 151
  - cobre monetários (preço, quantidade, patrocínio), vendaPct 0..100 e os percentuais 0..100 — linha 157
  - NÃO reporta 0, "" nem valor DENTRO da faixa (só número fora da faixa) — linha 178
  - patrocínio SOLTO negativo (evento antigo sem lista) entra no censo — linha 195
  - o texto do aviso segue o padrão aprovado (singular) — linha 204
  - lista longa: até 10 itens + "…e mais N" — linha 220
- **round-trip de backup LIMPO — inalterado** — linha 238
  - evento novo: migração não muda cenariosConfig válido e o censo é vazio — linha 239

### vereditoTexto.test.js

*3 describe · 8 it/test*

- **TITULO_VEREDITO — vocabulário técnico (trocado a pedido do Marco, 20/07/2026)** — linha 14
  - as 3 cores têm o texto exato — não o coloquial antigo ("Esse evento sai") — linha 15
  - nenhum título carrega emoji (a cor mora na bola, nunca no texto — PADRÃO §3) — linha 21
- **EMOJI_SEMAFORO — só existe no texto copiado (WhatsApp), nunca na tela** — linha 28
  - mapeia as 3 cores para o emoji certo — linha 29
- **fraseVeredito — as 4 cores/casos** — linha 42
  - verde: cita margem realista, os dois alvos e o lucro do pessimista — linha 43
  - amarelo SEM rebaixamento: margem × alvo, não menciona o pessimista — linha 53
  - amarelo REBAIXADO pelo pessimista: bate o alvo, mas avisa do prejuízo no pessimista — linha 63
  - vermelho: margem abaixo da mínima, não menciona o pessimista — linha 73
  - sem receita ainda (margem null): frase própria — não vira "abaixo da mínima" com número quebrado — linha 82

### versaoReuniao.test.js

*4 describe · 10 it/test*

- **novaVersaoCongelada (sugestão 24)** — linha 30
  - guarda cópia COMPLETA e independente: mudar o evento depois não muda a congelada — linha 31
  - rótulo vazio/em branco ganha o padrão "versão de reunião" — linha 43
  - congelar NÃO muta o evento original — linha 49
- **congeladasDoEvento** — linha 57
  - filtra pelo eventoId; lista vazia/ausente não quebra — linha 58
- **resumoComparacao — leitura pura sobre computeCenarios/veredito (nenhuma fórmula nova)** — linha 67
  - sem mudanças: deltas 0 e números idênticos aos de computeCenarios — linha 68
  - custo novo aparece como delta exato, e o semáforo dos dois lados vem do veredito real — linha 86
  - respeita campos do evento no veredito (margens custom) e no cálculo (open bar) — linha 101
  - congelada salva ANTES da trava de 22/07 é comparada com a MESMA régua do lado atual — linha 118
- **camada localStorage (ambiente sem armazenamento: nunca lança, retorna { ok:false })** — linha 138
  - ${nome} → loadCongeladas/congelarVersao/excluirCongelada degradam com clareza — linha 151
  - MAX_CONGELADAS é um limite explícito (sem rotação silenciosa) — linha 170

### xlsxImport.test.js

*12 describe · 65 it/test*

- **(fora de qualquer describe)** — linha 15
  - cabeçalho compacto não copia realizado recusado para fornecedor nem para o pacote — linha 15
  - cabeçalho explícito preserva fornecedor e formato sem cabeçalho mantém posições legadas — linha 28
- **parseMoney** — linha 38
  - números diretos — linha 39
  - formato pt-BR com R$ — linha 43
  - ponto como separador de milhar sem centavos — linha 48
  - parêntese contábil = negativo (decisão do Marco 20/07/2026) — linha 52
  - sinal não alterna e menos unicode conta (achados A2/A3 da verificação hostil) — linha 58
  - formato americano (vírgula milhar, ponto decimal): "1,234.56" — linha 66
  - vazios e lixo viram 0 — linha 69
  - pt-BR com 3 OU MAIS casas decimais: o ponto é milhar (Marco, 30/08/2026) — linha 85
  - a OUTRA regra da vírgula não mudou: "1,500" sem ponto segue valendo mil e quinhentos — linha 97
  - o AMERICANO de 3 casas continua americano — a régua nova não o captura — linha 107
  - grupo de milhar MAL FORMADO: a leitura pt-BR vale mesmo assim, e é de propósito — linha 119
  - o que NÃO pode mudar: a grade herdada segue inteira — linha 131
  - PROPRIEDADE — toda string pt-BR inequívoca bate com a leitura de referência — linha 148
- **mapStatus** — linha 168
  - normaliza para os status do app — linha 169
  - status das planilhas reais: FINALIZADO → PAGO, FORMALIZAR → NEGOCIAR — linha 180
- **detectarSecao** — linha 186
  - reconhece os títulos das planilhas antigas — linha 187
  - títulos das planilhas reais da Brisa — linha 198
- **parseAOA — planilha sintética no formato antigo** — linha 206
  - detecta as seções e mapeia para as categorias padrão — linha 227
  - lê fornecedor, valor (número e texto pt-BR) e status — linha 232
  - ignora linhas TOTAL — linha 237
  - (dinâmico: `i` — variável, valor muda por caso; ver código-fonte, linha 238) — linha 238
  - importa a tabela de lotes — linha 240
  - identifica lote porta pelo nome — linha 245
  - seção desconhecida em caixa alta vira aviso e agrupa itens — linha 250
  - seções de logística (cronograma, sem valores) são descartadas na limpeza — linha 259
  - título de seção com letra minúscula no meio ("EQUIPE e LOGISTICA") — linha 273
  - linha de item com macro parecendo cabeçalho ("Produtos") não vira cabeçalho — linha 287
  - colunas Estimado/Realizado separadas — linha 306
- **parseWorkbookData — .xlsx REAL gerado em memória (H3-L item 2, §7.7 do dossiê)** — linha 319
  - abre o binário .xlsx de verdade e reconhece a aba — linha 352
  - itens certos, com valor BR ("R$ 1.234,56") e valor numérico ambos parseados — linha 356
  - lotes certos, inclusive a identificação de lote porta — linha 370
  - as 3 linhas TOTAL (A&B, EQUIPE, lotes) são descartadas com o motivo certo, nunca viram item — linha 377
  - (dinâmico: `i` — variável, valor muda por caso; ver código-fonte, linha 380) — linha 380
  - (dinâmico: `i` — variável, valor muda por caso; ver código-fonte, linha 381) — linha 381
- **parseAOA — descartes (H3-D §9.11.4): linhas que ficam de fora, com motivo** — linha 385
  - linha TOTAL, linha sem serviço e linha de lixo fora de seção viram descarte com linha e motivo certos — linha 386
  - item em seção não reconhecida sem valor numérico vira descarte "sem valor numérico" — linha 408
  - planilha limpa (nada descartado) devolve descartes: [] — linha 417
  - linha 100% vazia NÃO vira descarte (vazio não é dado perdido) — linha 425
- **parseAOA — tabela de lotes NO MEIO da planilha e a seção de custos aberta** — linha 440
  - a tabela de lotes terminada por LINHA EM BRANCO devolve a seção: o custo de R$ 15.000 seguinte entra em ESTRUTURA — linha 461
  - a tabela de lotes terminada por linha TOTAL devolve a seção, e a TOTAL segue descartada como TOTAL — linha 475
  - duas tabelas de lotes COLADAS (pista e camarote, sem linha em branco entre elas) devolvem a seção aberta antes da PRIMEIRA — linha 488
  - sem seção aberta antes dos lotes, o que vem depois segue "fora de qualquer seção reconhecida" (nada é inventado) — linha 530
  - linha em branco no meio de uma seção SEM tabela de lotes não fecha a seção: os 2 itens continuam em A&B — linha 550
  - planilha com os lotes NO FIM (o caso normal de hoje) sai byte a byte igual ao que já saía — linha 568
  - EFEITO COLATERAL MEDIDO: resumo de RECEITA colado depois da tabela de lotes vira CUSTO — R$ 232.500 (espera decisão do Marco, BACKLOG 27/07/2026) — linha 615
- **normalizar** — linha 679
  - remove acentos e caixa — linha 680
- **P3 — recusa lexical sem aproveitar dígitos** — linha 687
  - recusa %s *(each)* — linha 688
  - menos terminal %s *(each)* — linha 689
  - conserva interpretações históricas permissivas — linha 690
  - estimados anotados recusam linhas; realizado anotado preserva estimado e fica vazio — linha 693
  - lote com preço ou quantidade anotada não entra — linha 701
  - P3 — envelope histórico %s *(each)* — linha 708
- **P5 — serviço com quantidade é custo** — linha 711
  - 20×250+8×300 são dois custos7400, sem lotes — linha 714
  - três seções mantêm cinco custos70400 e mapas independentes — linha 717
  - lote explícito continua100×200; aviso de classificação vem separado dos avisos históricos — linha 721
  - anotação em unitário, quantidade ou total recusa uma linha inteira cada — linha 725
  - total cabeçalho não some como linha TOTAL; zero informado diverge sem fallback — linha 730
  - quantidade fracionária de serviço não arredonda e metadados acumulam em abas — linha 734
  - P5 — seção nova após lote sem separador não herda mapa da seção anterior — linha 741
- **erros nativos Excel — bytes XLSX antes da validação P3/P5** — linha 747
  - P5 recusa %s, conserva aba/linha/campo e a linha saudável *(each)* — linha 758
  - P3 recusa estimado ilegível sem alterar outro custo — linha 766
  - P3 realizado ilegível fica vazio e preserva estimado válido — linha 772
  - P3 lote com erro em %s fica fora, lote saudável permanece *(each)* — linha 778

### xlsxOrcamento.test.js

*7 describe · 27 it/test*

- **round-trip montar → parse** — linha 39
  - o que sai volta idêntico — inclusive texto blindado contra fórmula — linha 40
  - planilha intocada = zero propostas (nada de diff fantasma) — linha 54
  - arquivo sem o marcador é recusado em português — linha 61
- **diff honesto** — linha 68
  - estimado alterado (formato BR em string) vira UMA proposta com antes → depois — linha 75
  - linha nova sem id vira custo NOVO na categoria certa; categoria desconhecida cai em Extras com o motivo no rótulo — linha 91
  - linha sumida vira REMOVER — e nasce DESMARCADA (sumir por acidente não apaga) — linha 105
  - estágio de patrocínio mudado na planilha é IGNORADO com aviso — receita não liga por célula — linha 115
  - patrocínio novo nasce como proposta, dito no rótulo — linha 125
- **aplicar — puro e cirúrgico** — linha 136
  - não muta o evento original — linha 143
  - alterar estimado NÃO encosta em realizado/status/parcelas — linha 153
  - proposta NÃO selecionada não aplica nada — linha 165
  - remover selecionado remove; novo cria com id próprio; patrocínio novo nasce proposta — linha 174
- **bordas hostis do retorno (achados pré-ataque, 20/07/2026)** — linha 196
  - categoria MUDADA num id existente é ignorada COM AVISO — mover de categoria é no app — linha 197
  - id_item DUPLICADO: a primeira linha vale, as seguintes são ignoradas com aviso — linha 207
  - evento SEM a categoria extras: custo novo de categoria desconhecida cai na PRIMEIRA categoria, dito no rótulo — nunca some — linha 219
- **achados do ataque pela lib real (20/07/2026)** — linha 234
  - espaço/quebra na PONTA do texto salvo não vira proposta fantasma — linha 235
  - mudança REAL de texto continua detectada mesmo com espaço na ponta — linha 245
  - apóstrofo LEGÍTIMO no começo do dado sobrevive ao round-trip — linha 256
  - id DESCONHECIDO duplicado vira UM custo novo só — a segunda linha é ignorada com aviso — linha 265
  - linha de patrocínio só com estágio preenchido é ignorada COM aviso — linha 276
- **acharAbaOrcamento — a aba certa pelo MARCADOR, nunca "a primeira"** — linha 286
  - aba de rascunho do produtor na frente não recusa o retorno válido — linha 288
  - arquivo sem nenhuma aba com o marcador devolve null (o modal lista as abas) — linha 299
- **P3 — orçamento v1 conserva linhas presentes recusadas** — linha 307
  - recusa custos e patrocínios existentes e novos sem alterar nem remover — linha 308
  - export de valor salvo ilegível avisa em vez de escrever zero — linha 321
  - P3 — recusa mantém original enquanto outra linha válida muda e metadados nunca são salvos — linha 327
  - P6 — v1 custo e patrocínio fora da faixa %s não atualizam/removem *(each)* — linha 334
  - P3 revisão — salvo ilegível e retorno vazio propõem limpeza de custo e patrocínio — linha 339

### xlsxOrcamentoV2.test.js

*3 describe · 13 it/test*

- **(fora de qualquer describe)** — linha 76
  - (dinâmico: `f` — variável, valor muda por caso; ver código-fonte, linha 76) — linha 76
- **writer v2 — travessia cruzada exceljs → SheetJS** — linha 82
  - aba ORÇAMENTO + sentinela v2 na A1 + id do evento na A2 — linha 83
  - cabeçalho: PROJETO/LOCAL/PÚBLICO e DATA "SÁB 05/12/2026" (sem off-by-one de fuso) — linha 91
  - EXIGÊNCIA 1 — NENHUMA fórmula do arquivo mente (seção, TOTAL GERAL, RESUMO) — linha 102
  - TOTAL GERAL bate com a soma de TODOS os itens estimados — linha 110
  - (dinâmico: `ws` — variável, valor muda por caso; ver código-fonte, linha 113) — linha 113
  - ids dos itens na coluna A: VALOR atravessa (SheetJS); OCULTAÇÃO é de escrita (exceljs) — linha 118
  - dropdown de STATUS = lista canônica (11), não os 4 do mockup — linha 129
  - COMO USAR presente e com a linha de STATUS CORRIGIDA (gate 1: o app LÊ status) — linha 142
  - sem logoPng → fallback de texto (não quebra) — linha 152
  - PATROCÍNIO NÃO aparece na planilha, mesmo com o evento tendo patrocínios (Marco 21/07) — linha 157
  - bordas nas células de conteúdo (cabeçalho + tabela), grade geral desligada — linha 167
- **interop de data serial exceljs → SheetJS (sonda)** — linha 188
  - célula-data de verdade atravessa com o mesmo dia (sem escorregar 1) — linha 189

### xlsxReconciliar.test.js

*14 describe · 22 it/test*

- **roteamento — v1 fica intacto** — linha 50
  - ehOrcamentoV2: sentinela na A1 = v2; sem sentinela = v1 — linha 51
- **A2 carrega o evento-alvo (round-trip do id)** — linha 59
  - parseOrcamentoV2 lê o id do evento na A2 — linha 60
- **idempotência — reimportar o arquivo NÃO editado não move nada** — linha 68
  - 2× o mesmo export = zero mudança — linha 69
- **CICLO REAL — edita valor + insere + apaga + troca status → estado final EXATO** — linha 83
  - as 4 operações do ciclo, nada a mais nem a menos — linha 84
  - reaplicar o resultado (2ª volta) é idempotente — linha 116
- **identidade camada 2 — auto-matcher quando a coluna A sumiu** — linha 129
  - linha sem id casa por seção+serviço+fornecedor → é ATUALIZAÇÃO, não remove+adiciona — linha 130
- **ambíguo NUNCA aplica sozinho — vai pra revisão** — linha 145
  - dois itens iguais na seção, ambos sem id → ambíguo — linha 146
- **S2 espelhado — id duplicado DENTRO da planilha, nomeando** — linha 161
  - dois com o mesmo id → dupIds nomeia e manda pra revisão, não colapsa — linha 162
- **planilha-copiada e alvo desconhecido (redes do Marco #1 e #2)** — linha 173
  - ​#1 — PROJETO da planilha não bate com o tipo do alvo → aviso explícito — linha 174
  - ​#2 — alvo desconhecido (evento apagado): não adivinha, devolve alvoDesconhecido — linha 184
- **não casa item de OUTRO evento** — linha 193
  - reconciliar contra um evento sem esses itens → tudo remoção do alvo (nada some por engano) — linha 194
- **status inválido colado — mantém o antigo, mas AVISA (Princípio 4, Marco)** — linha 206
  - status fora dos 11 → avisosStatus nomeia; o status do item NÃO muda (nem calado, nem sobrescrito) — linha 207
  - item NOVO com status inválido → usa o padrão, também avisando — linha 225
- **TRAVA NO MOTOR — ambiguidade não resolvida NUNCA termina em exclusão (Marco)** — linha 237
  - remoção do candidato de ambíguo LIGADA na seleção → o motor BARRA (invariante, não ordem de UI) — linha 238
  - sem ambíguo, a remoção selecionada aplica normal — a trava só morde o candidato de ambíguo — linha 255
- **aplicarResolucoes — a escolha da produtora tira o ambíguo (revisão com escolha)** — linha 266
  - casar → vira update/mantido, sai da remoção, e a trava libera — linha 267
  - 'ignorar' mantém o ambíguo e a proteção — o item não é removido mesmo com a remoção ligada — linha 288
- **linha RECUSADA sem id não vira remoção fantasma (lente adversarial 22/07)** — linha 305
  - negativo em planilha copiada: recusada, e o item que casaria por nome fica FORA de Remoções — linha 306
- **P3 — v2 recusa anotação antes de casar ou resolver** — linha 325
  - id presente=%s protege original; novo inválido não entra *(each)* — linha 326
  - duplicata inválida é recusada e resolução direta casar/novo também recusa — linha 336
  - P3 — novo com ID desconhecido também recusa e linha válida ainda casa com candidato protegido — linha 349
  - P6 — v2 faixa %s protege item, novo e resoluções *(each)* — linha 357

## src/components

### App.financeiroNoop.test.jsx

*1 describe · 2 it/test*

- **funil real do App preserva no-op da ponte** — linha 77
  - mesma referência não cria carimbo, save ou histórico — linha 78
  - fechamento enfileirado antes do updater recusa a segunda escrita — linha 93

### App.fio.test.jsx

*5 describe · 18 it/test*

- **App — o fio da MUDANÇA até o auto-save** — linha 124
  - duplicar um evento manda o store NOVO (2 eventos) para o saveStore — linha 125
  - o auto-save grava a CADA mudança, não só na primeira — linha 138
- **App — o fio até o backup ao SAIR (o padrão exato do canário 2)** — linha 146
  - window.__backupAoSair devolve o store de AGORA, não o da montagem — linha 147
  - quando o store não serializa, o "Sair" devolve "" e deixa a marca no disco — linha 165
- **App — o fio do atalho de desfazer (achado S3-F)** — linha 184
  - Cmd+Z na página de trabalho desfaz a duplicação e o auto-save grava o desfeito — linha 185
  - Cmd+Shift+Z refaz — e o caminho de ida e volta é 2 → 1 → 2 — linha 199
- **App — o fio das FAIXAS de aviso (nada falha em silêncio)** — linha 212
  - gravação que falha vira faixa vermelha em português, com a saída de exportar — linha 213
  - leitura que falhou vira a OUTRA faixa — a que manda não editar nada — linha 223
  - gravação em ordem NÃO mostra faixa nenhuma (o outro lado — sem alarme falso) — linha 239
  - segunda aba aberta acende a faixa âmbar que explica a sobrescrita — linha 246
  - a marca do "Sair" anterior vira faixa na abertura, com o motivo em português — linha 265
  - marca com instante ilegível não vira " da saída de ." na frente do Marco — linha 274
  - sem marca, faixa nenhuma — o aviso não é paisagem — linha 290
  - "Esconder o aviso" some com a faixa E apaga a marca (não volta na próxima abertura) — linha 295
  - o botão que EXPORTA também apaga a marca — o rótulo dele promete as duas coisas — linha 303
  - se a exportação ESTOURA, o aviso FICA — esconder o que não foi resolvido é o defeito — linha 320
- **App — o fio até o CÁLCULO (o número da tela é o do módulo puro)** — linha 336
  - o card da Home mostra o lucro realista que computeCenarios devolve — linha 352
  - o evento duplicado aparece com o SEU próprio número, calculado de novo — linha 359

### avisoBarNoCenario.fio.test.jsx

*1 describe · 10 it/test*

- **o fio na tela: o cartão avisa quando o bar não foi informado** — linha 49
  - aparece nos DOIS cenários sem ticket de bar, e não no que tem — linha 50
  - o aviso diz o valor do outro cenário, para o número não virar mistério — linha 57
  - com os três preenchidos a tela não avisa nada — linha 62
  - bar FIXO não avisa — lá o valor é um só para os três — linha 67
  - o botão de copiar aparece com o valor certo e some quando não há o que copiar — linha 72
  - clicar copia o valor para os TRÊS e oferece Desfazer — linha 91
  - o botão escreve pelo CANAL ROTEADO, nunca pelo update real — linha 115
  - o Desfazer do toast passa pelo desfazer ROTEADO, levando o carimbo da ação — linha 143
  - sem rascunho nenhum (aba montada fora do editor), o desfazer é o update de sempre — linha 189
  - OPEN BAR não avisa — o R$ 0 ali é a resposta certa e declarada — linha 213

### avisoCustoQuebrado.test.jsx

*4 describe · 9 it/test*

- **a festa com custo que não cabe é NOMEADA nas quatro telas** — linha 140
  - ${nome}: mostra a faixa, com o custo e a categoria por extenso — linha 142
  - a faixa diz por que o número não vale e o que fazer — linha 154
  - e o número que ela acompanha continua sendo o R$ 0 que a tela imprime — linha 161
- **a soma que estoura sem item culpado também é dita** — linha 173
  - dois custos de 10^306: cada um cabe, a soma não — e a faixa explica isso — linha 174
- **festa normal NÃO ganha aviso — em nenhuma das quatro telas** — linha 191
  - ${caso} · ${tela}: nenhuma faixa de dado quebrado — linha 215
  - e a festa de meio milhão continua mostrando o seu custo de verdade — linha 225
- **a faixa em si** — linha 237
  - não renderiza nada quando a festa está sã — linha 238
  - no papel do relatório o texto é o MESMO da tela — linha 243
  - custo sem nome ainda é nomeado, com o rótulo do app — linha 251

### avisoLucroBenchmark.fio.test.jsx

*1 describe · 2 it/test*

- **o fio na tela: o editor avisa quando o lucro não fecha** — linha 28
  - avisa no benchmark cujo lucro contradiz receita − custo, com o valor esperado — linha 29
  - NÃO avisa no benchmark que fecha — o Cordel bate certo — linha 41

### barAplicarSimulacao.fio.test.jsx

*4 describe · 17 it/test*

- **editor — mexer só no bar durante o Simular** — linha 66
  - o rodapé conta a mudança do bar: "Aplicar 1 mudança ao evento" — linha 67
  - o rodapé DIZ o que mudou, em reais e em português — linha 74
  - enquanto simula, o update REAL não é chamado nenhuma vez — linha 81
  - DESCARTAR joga o rascunho fora sem gravar nada — linha 89
  - APLICAR grava o bar do rascunho — e não encosta nas outras chaves de outrasReceitas — linha 104
  - bar E cenário juntos: as duas mudanças são contadas e as duas são gravadas — linha 116
- **o Desfazer do toast continua desfazendo depois que a simulação acaba** — linha 140
  - APLICAR e então Desfazer: cai no update REAL, não no rascunho encerrado — linha 147
  - DESCARTAR e então Desfazer: NÃO grava nada — nem o número que só existiu no rascunho — linha 192
  - (dinâmico: `t` — variável, valor muda por caso; ver código-fonte, linha 214) — linha 214
  - copiar FORA da simulação e desfazer DENTRO dela: o desfazer vai para o evento — linha 221
  - DESCARTAR, entrar de novo, e então Desfazer: continua sem gravar nada — linha 242
  - DENTRO da simulação, o Desfazer continua indo para o rascunho (nada é gravado) — linha 262
- **apresentação — o mesmo bar, na tela da reunião** — linha 299
  - mexer no bar habilita o Aplicar e a contagem aparece — linha 300
  - APLICAR na reunião grava o bar — não só os cenários — linha 306
  - antes de aplicar, nada é gravado — linha 317
- **aplicar roda sobre o evento FRESCO do store, não sobre a foto do render** — linha 336
  - EDITOR: a mudança salva por fora sobrevive ao Aplicar — linha 345
  - APRESENTAÇÃO: idem — as duas telas passam pela MESMA função e pelo mesmo envelope — linha 358

### barNoSimulador.fio.test.jsx

*6 describe · 25 it/test*

- **bar por pessoa — três sliders, um por cenário** — linha 38
  - existem exatamente 3 sliders de "Bar por pessoa (R$)", com o valor de cada cenário — linha 39
  - arrastar o do PESSIMISTA grava barTicket.pessimista — e não encosta nos outros dois — linha 46
  - digitar no campo acoplado do OTIMISTA entende o formato brasileiro — linha 53
  - o slider do bar não mexe em cenariosConfig — são compartimentos diferentes — linha 59
  - o arrasto manda o ELEMENTO no descritor — um arrasto vira UM passo de desfazer — linha 67
  - cenário SEM bar preenchido mostra o slider em zero e o primeiro toque grava — linha 76
  - o alcance do arrasto é R$ 0 a R$ 300, e o title diz isso em reais — linha 85
  - digitar acima do arrasto continua valendo (a régua do campo é a FAIXA_CONSUMO) — linha 93
  - digitar NEGATIVO é recusado — consumo de bar não é negativo — linha 99
- **bar por pessoa — na tela da reunião (props do modo apresentação)** — linha 106
  - os 3 sliders aparecem e respondem no escuro, sem o campo Ticket médio — linha 107
- **modo VALOR FIXO — um slider só, acima das três colunas** — linha 118
  - não há slider por coluna, e há exatamente UM "Bar — lucro líquido" — linha 126
  - arrastar grava outrasReceitas.bar e NÃO apaga o patrocínio (que mora no mesmo objeto) — linha 133
  - o arrasto vai de R$ 0 a R$ 300.000, de mil em mil, e o title diz em reais — linha 142
  - digitar NEGATIVO é aceito — prejuízo de bar é fato, e é a regra escrita da casa — linha 151
  - a tela diz que este valor vale para os três cenários, e onde trocar de modo — linha 157
  - na apresentação (escuro) o slider único também aparece e responde — linha 163
- **OPEN BAR — nenhum controle, e a razão escrita** — linha 172
  - nenhum slider de bar de espécie alguma — linha 179
  - a frase explica por que não há o que arrastar — linha 185
  - open bar manda também sobre o modo VALOR FIXO — linha 190
  - sem open bar, a frase não aparece — linha 199
- **os três sliders de cenário não regridem** — linha 205
  - "Ingressos vendidos" continua sendo o primeiro controle da coluna — linha 206
  - o botão de voltar ao padrão avisa que NÃO mexe no bar — linha 212
- **o Ticket médio acompanha o Ajuste do ticket** — linha 225
  - sem ajuste e com +10% o placeholder é DIFERENTE, e na proporção — linha 235
  - ajuste negativo desce o número — linha 245
  - com ticket digitado, a tela DIZ qual é o efetivo do ajuste — linha 251

### BarraOrcamentoFechado.test.jsx

*2 describe · 5 it/test*

- **BarraOrcamentoFechado — trava na fonte ÚNICA contaOrcamentoFechado** — linha 27
  - a barra mostra EXATAMENTE o que a função devolve (denominador cheio, 43%) — linha 28
  - um segmento por status presente, na cor da FONTE ÚNICA — PARCIAL e ESTIMADO inclusos — linha 40
  - total 0 → não renderiza nada (null) — linha 50
  - RESUMO e BARRA usam a MESMA função: a linha "Orçamento" do resumo casa com a conta — linha 55
- **BarraOrcamentoFechado — total que não cabe numa conta de dinheiro** — linha 82
  - troca a barra por texto, sem número — linha 83

### BenchmarksEditor.regua.evidencia.test.jsx

*2 describe · 7 it/test*

- **o achado — mesma bilheteria, mesmo público, tickets diferentes** — linha 115
  - as duas festas são idênticas em dinheiro e público; só a régua do ticket difere — linha 116
  - e mesmo assim os tickets diferem em R$ 50,00 por cabeça — 25% de diferença — linha 123
- **a lista de benchmarks nomeia a régua de cada ticket** — linha 135
  - o benchmark da régua antiga diz que o ticket é receita ÷ público — linha 136
  - o benchmark da régua nova diz que o ticket é bilheteria ÷ público — linha 141
  - com os dois na mesma tela, as DUAS etiquetas aparecem — nenhuma engole a outra — linha 146
  - com réguas MISTURADAS na mesma tela, a lista avisa que os tickets não se comparam — linha 152
  - com uma régua só, o aviso de mistura NÃO aparece — nada de alarme falso — linha 157

### breakEvenNaoFechaNasTelas.evidencia.test.jsx

*5 describe · 13 it/test*

- **a premissa das quatro telas** — linha 115
  - a festa de teste realmente não fecha — break-even null e o aviso ligado — linha 116
  - a festa de contraste fecha — tem break-even de verdade — linha 123
- **TELA 1 — card da Home** — linha 132
  - diz que não fecha, em vez de sumir com a linha do ritmo — linha 144
  - CONTRASTE — na festa que fecha, o card volta a falar de ritmo (e não repete o aviso) — linha 151
  - festa que JÁ ACONTECEU: a marcação de realizada vence — não se fala de ritmo futuro — linha 157
- **TELA 2 — relatório (o papel que vai para a reunião)** — linha 166
  - a linha "Ritmo de vendas" existe e diz que não fecha — linha 170
  - CONTRASTE — na festa que fecha, a mesma linha traz o ritmo em ingressos — linha 176
- **TELAS 3 e 4 — aba Cenários: card "Estamos vendendo no ritmo?" e curva de vendas** — linha 230
  - as DUAS superfícies dizem que não fecha — a MESMA frase, duas vezes na página — linha 231
  - o card diz mesmo com o campo "vendidos até hoje" VAZIO — não manda preencher o que não muda nada — linha 236
  - com o campo preenchido, o card continua dizendo que não fecha — linha 245
  - CONTRASTE — festa que fecha: as duas voltam a falar de ritmo em ingressos — linha 250
  - festa que JÁ ACONTECEU: a marcação de realizada vence nas duas — não se fala de futuro — linha 257
- **a frase é UMA e vem de breakEvenTexto.js** — linha 268
  - as quatro superfícies imprimem exatamente a mesma cadeia de caracteres — linha 269

### CampoData.test.jsx

*12 describe · 44 it/test*

- **digitar no campo** — linha 44
  - 05/08/2026 chega no onChange como ISO — linha 45
  - data impossível NÃO grava, avisa em português e o campo volta ao salvo — linha 51
  - digitação a meio caminho não avisa — linha 61
  - mostra sempre no formato do Brasil — nunca o ISO — linha 68
  - apagar tudo grava vazio — "não informado" nunca vira hoje — linha 74
  - valor trocado POR FORA com o campo em foco larga o rascunho — linha 81
- **o painel** — linha 92
  - abre pelo botão, marca aria-expanded e foca o dia do valor — linha 93
  - clicar num dia grava a data e fecha — linha 102
  - vive no document.body, fora do contêiner do campo — não é cortado por tabela — linha 111
  - desabilitado não abre — linha 122
- **o atrito que ele reclamou: trocar de ano** — linha 130
  - a seta de ANO existe e anda um ano por clique, sem gravar nada — linha 131
  - de 2026 a 2019 em DOIS cliques pela grade de anos (no nativo seriam 84 setas de mês) — linha 142
  - a seta de MÊS anda um mês e atravessa o ano — linha 153
- **teclado** — linha 162
  - seta para baixo anda uma semana e atravessa o mês — linha 163
  - Enter escolhe o dia focado, fecha e devolve o foco ao campo — linha 170
  - Esc fecha SEM gravar e devolve o foco — linha 180
  - PageUp/PageDown andam de mês; com Shift, de ano — linha 190
  - Home e End vão ao primeiro e ao último dia do mês — linha 199
  - seta para baixo NO CAMPO abre o painel — linha 208
- **Hoje e Limpar** — linha 215
  - Hoje grava o dia LOCAL às 21h30 — nunca o de amanhã em UTC — linha 216
  - Limpar data grava vazio, e o botão diz o efeito — linha 224
- **as três colisões com o resto do app** — linha 234
  - dentro de <Field label="Data">, getByLabelText devolve o INPUT (a ordem do DOM) — linha 235
  - o aria-label do botão nunca é só "Data" — senão ele roubaria o rótulo — linha 246
  - Esc dentro de Modal fecha SÓ o calendário; o segundo Esc fecha o modal — linha 252
  - Enter com a digitação pela metade não submete, e passa a avisar — linha 272
  - Enter com data IMPOSSÍVEL no campo também não submete — linha 284
  - Enter com o campo em ordem submete normalmente — inclusive vazio, que é opcional — linha 294
  - Enter com o painel ABERTO não dispara o onEnter da tela (a Home cria evento com Enter) — linha 308
- **a linguagem de cor da casa** — linha 320
  - o calendário não usa verde, vermelho nem âmbar — essas cores são de RESULTADO — linha 321
- **dado salvo que NÃO é data: a tela DIZ, em vez de fingir** — linha 336
  - mostra o que está salvo, marca inválido e avisa em português — linha 339
  - data BOA não avisa nada — o aviso não vira ruído de fundo — linha 349
  - escolher uma data boa apaga o aviso do valor sujo — linha 355
- **ano de 3 dígitos não sai do campo (o que vazava até o arquivo do contador)** — linha 371
  - digitar 01/01/0999 NÃO grava e explica o que corrigir — linha 372
  - pelo caminho dos 8 dígitos colados, idem — linha 379
- **o foco não fica preso num painel órfão** — linha 386
  - Tab para FORA fecha o painel — senão sobra um diálogo que o Esc não alcança — linha 387
  - foco que anda DENTRO do painel não fecha nada — linha 401
  - trocar de janela (relatedTarget nulo) não fecha o painel — linha 408
- **a largura que as telas pedem passa a valer** — linha 416
  - com className de largura, o embrulho NÃO força w-full por cima — linha 417
  - sem className, o padrão continua sendo w-full — linha 426
- **o campo de data e o desfazer da sessão** — linha 447
  - o campo é um <input type="text"> — e como tal, campo de digitação do app — linha 454
  - o passo de desfazer nasce COM rótulo e COM grupo — a edição agrupa por elemento — linha 463
  - dois campos de data diferentes NÃO agrupam no mesmo passo — linha 471
  - Cmd+Z dentro do campo é DEVOLVIDO ao navegador, não rouba o desfazer da sessão — linha 488
  - fora do campo, o MESMO Cmd+Z continua desfazendo a sessão (a regra não sumiu) — linha 498

### carregarBenchmark.s4.test.jsx

*1 describe · 8 it/test*

- **(fora de qualquer describe)** — linha 35
  - App/modal/reducer/ToastHost: Cmd+Z depois toast mantém 12000, refazer e carimbo — linha 35
  - refazer carregamento reativa toast efetivo — linha 41
  - ↶ e apagar original: toast não ressuscita 12000 — linha 42
  - apagar carregado sem ↶: toast recupera original; callback antigo não repete — linha 43
  - callback antigo após fechamento é recusado internamente sem carimbo ou sucesso novo — linha 45
  - carregamentos sobrepostos: %s devolve só 12000 *(each)* — linha 55
  - três carregamentos e ↶/refazer do toast antigo mantêm carimbo e dados externos sem metadados — linha 66
  - somar, apagar linha, editar nome e ↶: toast sem efeito preserva refazer nome e carimbo — linha 87

### CarregarBenchmarkModal.test.jsx

*4 describe · 13 it/test*

- **O botão e o modal dizem que vem o TOTAL por categoria, não as linhas da planilha** — linha 110
  - o botão da faixa de benchmarks anuncia "1 linha por categoria" — no rótulo e no tooltip — linha 111
  - o modal explica que benchmark é RESUMO e manda quem quer as linhas para "Nova edição", na tela inicial — linha 118
  - a nota NÃO promete a festa inteira — cópia idêntica é o OUTRO botão do card ("Duplicar") — linha 140
  - no gesto POR CATEGORIA o mesmo texto fala em uma linha só, nomeando a categoria — linha 154
- **Evento fechado: a trava VIVA é o fieldset do EventEditor; a recusa do modal é o segundo cinto** — linha 169
  - trava viva — com o evento fechado o botão nasce dentro de um <fieldset disabled> (o modal nem abre) — linha 170
  - evento ABERTO: o mesmo botão NÃO nasce travado (a trava é condicional, não sempre-on) — linha 177
  - segundo cinto — chamado direto com evento fechado, o modal recusa em português e NADA é gravado — linha 182
- **O "Desfazer" do toast tira só o que o gesto criou (achado S3 — antes rebobinava o evento inteiro)** — linha 193
  - aplica: grava, guarda cópia de segurança nomeando a festa e oferece Desfazer — linha 206
  - custo, lote e patrocínio digitados na janela do toast sobrevivem ao Desfazer; a linha carregada some — linha 217
  - S4 callback acionado uma vez não reaplica depois de edição posterior — linha 248
  - o passo do histórico é nomeado nos dois sentidos (o botão ↶ não cai no rótulo do campo em foco) — linha 256
- **Referência com dado quebrado: o modal recusa e NADA é carregado** — linha 269
  - recusa em português, nomeando a referência, sem gravar nem tirar snapshot — linha 281
  - CONTRAPROVA: a mesma referência com valores de dinheiro carrega — linha 291

### cartaoLucroIgualDRE.evidencia.test.jsx

*1 describe · 3 it/test*

- **o cartão de lucro fecha com as próprias linhas e com o DRE** — linha 103
  - aba Cenários (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE — linha 105
  - relatório Completo (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE — linha 118
  - modo apresentação (${caso.e.id}): por cartão, lucro = receita − imposto − custo e = Lucro do DRE da aba Cenários — linha 132

### colunaDoCardFecha.evidencia.test.jsx

*1 describe · 9 it/test*

- **a coluna do card de fechamento soma na frente de quem lê** — linha 117
  - o exemplo canônico da ficha: as parcelas somam EXATAMENTE a "Receita do evento" escrita — linha 118
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 122) — linha 122
  - e os centavos que a coluna escondia aparecem: 5.981,25 e 2.392,50, não 5.981 e 2.393 — linha 134
  - do total até o resultado a conta também fecha: receita, imposto e custos — linha 145
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 149) — linha 149
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 150) — linha 150
  - festa de números redondos continua SEM centavos — o risco que o Marco aceitou não cobra quem não deve — linha 163
  - meio centavo na taxa e no cashback (bilheteria R$ 47.850,05, taxa 10%, cashback 5%): as parcelas escritas somam a "Receita do evento" escrita — linha 174
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 180) — linha 180

### curvaEstorno.s3.test.jsx

*2 describe · 9 it/test*

- **P2 S3 — aviso nas telas com cache legado** — linha 35
  - %s: remonta nome/valor, sem rede/update/escrita *(each)* — linha 36
  - dois estornos inclusive pós-festa mantêm todos os centavos em %s *(each)* — linha 56
  - trocar referência sã retira aviso e voltar o recupera em %s *(each)* — linha 60
  - modo datas avisa histórico na Curva; Análise preserva conta por datas sem atribuir ajuste — linha 69
  - início válido sem janela utilizável não atribui média por dia ao caixa — linha 81
  - cache desordenado permanece intacto; backup não adquire ajuste/cache derivado — linha 88
  - mensagem pura não altera média e identifica nome vazio/estorno somado — linha 103
- **S3 adendo — realizado e caixa nas telas reais** — linha 113
  - Até hoje conserva dois pagamentos, 80 mil e 40%; ritmo usa os pagamentos brutos — linha 114
  - datas empatadas mostram menos 5 mil no card e na agenda, com as duas viradas — linha 130

### dadoQuebradoNaHome.test.jsx

*3 describe · 8 it/test*

- **o cartão da Home não imprime número de festa com dado quebrado** — linha 79
  - festa ABERTA quebrada: no lugar dos três R$ 0, a frase em português — linha 80
  - a festa SÃ ao lado continua com os números dela — linha 90
  - o selo não afirma "margem 0%" — a bola da festa quebrada diz a mesma frase — linha 99
  - festa FECHADA quebrada: nem "R$ 0" nem "NaN" no resultado realizado — linha 105
  - FALSO POSITIVO: realizado em texto que a conta ignora não esconde número certo — linha 117
- **a tabela de benchmarks da Home não imprime R$ 0 para referência quebrada** — linha 127
  - a linha da referência quebrada mostra a frase, não R$ 0 — linha 141
  - os embutidos continuam com o custo deles — linha 149
- **a precisão das previsões da Home não mistura festa quebrada** — linha 160
  - diz que a festa quebrada ficou fora da média, nomeando-a — linha 161

### dadoQuebradoNaoContamina.test.jsx

*9 describe · 33 it/test*

- **a promoção a benchmark recusa a festa com dado quebrado** — linha 148
  - CONTRAPROVA do defeito: sem a porta, o benchmark nasce com Infinity dentro — linha 149
  - a porta recusa, e a recusa NOMEIA o custo e diz por que — linha 161
  - a festa SÃ continua promovendo — a porta não fecha na cara de quem está bem — linha 178
  - no APP, o clique em "Promover a benchmark" não escreve nada no store, e a recusa aparece NA TELA — linha 184
  - e o clique na festa SÃ continua gravando o benchmark — linha 233
- **a promoção recusa também o benchmark que sairia quebrado pela receita** — linha 277
  - ${caso}: os custos passam, o benchmark montado não — linha 291
  - ${caso}: no APP, o clique não grava e a recusa aparece NA TELA — linha 305
  - CONTRAPROVA: o benchmark da festa sã passa pela segunda pergunta — linha 342
- **a régua quebrada é NOMEADA nas duas telas de comparação** — linha 412
  - ${tela}: a faixa nomeia a referência e o campo — linha 414
  - ${tela}: a festa SÃ não ganha a faixa DELA por causa da régua — linha 429
  - FALSO POSITIVO: os 4 benchmarks embutidos nunca são acusados — linha 439
  - FALSO POSITIVO: promovido de festa sã e importado de planilha, limpos — linha 446
  - FALSO POSITIVO: comparação sem régua quebrada não mostra faixa nenhuma — linha 462
  - categoria ausente (null) NÃO é dado quebrado — os embutidos usam null de propósito — linha 473
- **festa FECHADA com fotografia SÃ, corrompida depois** — linha 489
  - a tela imprime os números CERTOS da fotografia — é isto que a faixa tem de respeitar — linha 507
  - a faixa aparece, mas NÃO diz que a tela escreve R$ 0 — linha 514
  - e NÃO manda restaurar cópia de segurança — o conselho que destruiria a foto — linha 522
  - o conselho é verdade: reabrir DESCARTA a fotografia — linha 531
  - ORDEM OPOSTA (corromper e SÓ ENTÃO fechar): o card diz que não dá para calcular, e a faixa diz isso — linha 540
- **a aba Análise — a tela que não zera, explode** — linha 557
  - a faixa aparece — ela não aparecia — linha 575
  - e a frase descreve ESTA tela: número gigante, não R$ 0 — linha 583
  - CONTRAPROVA: a tela imprime mesmo o número de centenas de dígitos — linha 591
  - FALSO POSITIVO: a mesma festa com R$ 400.000 no Som e luz não ganha faixa — linha 601
- **valor ilegível que os TOTAIS não usam** — linha 608
  - a aba Custos imprime o total CERTO (R$ 5.000), e a faixa não diz R$ 0 — linha 619
  - e o custo continua NOMEADO — não avisar seria o defeito oposto — linha 631
- **a faixa tem teto de linhas e resume o resto** — linha 643
  - 60 custos quebrados: 5 nomeados + 1 linha de resumo, no lugar de 60 linhas — linha 658
  - e o relatório encolhe de 5.776 para menos de 1.000 caracteres de aviso — linha 666
  - a contagem continua EXATA — o teto esconde nome, nunca custo — linha 676
  - até 5 custos, todos continuam nomeados um a um — linha 695
- **toda tela que mostra a faixa mostra uma consequência DECLARADA** — linha 708
  - ${tela}: a frase de consequência é uma das declaradas — linha 749
- **20.000 referências de dinheiro de verdade: nenhuma acusada** — linha 765
  - valores até R$ 900 mil, com centavos, nulos e créditos negativos — linha 770
  - CONTRAPROVA: a mesma varredura com 1e308 injetado acusa TODAS — linha 801
  - e a festa mais cara que a casa já teve (Marfim 09/05, R$ 360 mil) passa limpa — linha 816

### dataChegaNoDadoSalvo.fio.test.jsx

*6 describe · 21 it/test*

- **editor — a data da festa chega no evento** — linha 76
  - escolher no calendário grava o ISO no objeto que o store receberia — linha 77
  - VOLTAR UM ANO e escolher — o atrito que ele reclamou, chegando no dado — linha 88
  - digitar 05/08/2026 grava ISO, não o texto brasileiro — linha 98
  - DATA IMPOSSÍVEL não chega ao store — a rede que o widget do navegador dava — linha 107
  - a data escolhida atravessa a migração INALTERADA — e nada mais a saneia — linha 123
  - evento FECHADO: o campo é inerte de verdade, não só marcado — linha 156
  - evento FECHADO: com o painel aberto, escolher um dia NÃO grava — a célula mora no body — linha 166
  - evento FECHADO: digitar no campo também não grava — linha 177
- **home — a data no passo de criar a previsão** — linha 215
  - escolher no calendário e criar: o evento nasce com o ISO escolhido — linha 216
  - ENTER com o calendário ABERTO escolhe o dia e NÃO cria a previsão — linha 226
  - ENTER no meio da edição do ano NÃO cria a previsão com a data antiga — linha 242
  - sem data escolhida, o evento nasce sem data — vazio nunca vira hoje — linha 258
- **dossiê do custo — a data de pagamento chega no item** — linha 271
  - escolher no calendário grava dataPagamento em ISO — linha 272
  - data impossível digitada não chega ao item — linha 282
- **parcelas — a data escolhida sai na ordem certa para o Financeiro** — linha 298
  - escolher a data da parcela 2 grava ISO — e o arquivo do contador sai ORDENADO — linha 310
- **as quatro portas que faltavam: da tela até o objeto salvo** — linha 344
  - CUSTOS — a data de pagamento na tabela grava ISO no item — linha 356
  - CUSTOS — data impossível digitada na tabela não chega ao item — linha 368
  - PARCELAS — a data em que a parcela foi PAGA grava ISO — linha 382
  - RECEITA — o início de vendas grava ISO, e nenhum cenário muda — linha 402
  - CURVA — a virada prevista do lote grava ISO no lote certo — linha 417
- **a data do evento não tem mais porta pelo calendário do navegador** — linha 446
  - NENHUM componente do app volta a abrir uma porta pelo calendário do navegador — linha 447

### DossieCustoModal.faixa.test.jsx

*1 describe · 3 it/test*

- **Dossiê do Custo — segunda porta do estimado tem a MESMA faixa do CostsTab** — linha 29
  - digitar −500 no Estimado: avisa em português e NÃO grava — linha 30
  - parêntese contábil (500) também é recusado nesta porta — linha 38
  - valor válido continua gravando — a faixa não quebrou o campo — linha 46

### dreQueFecha.evidencia.test.jsx

*1 describe · 3 it/test*

- **o DRE soma na frente de quem lê** — linha 104
  - aba Cenários: as quatro contas da coluna fecham nos três cenários — linha 105
  - relatório Completo: as mesmas quatro contas fecham — linha 117
  - aba Receita: a faixa do realista (bruta − taxa + cashback = líquida; líquida + bar + patrocínio = total) fecha — linha 130

### estimadoNoCartao.fio.test.jsx

*4 describe · 11 it/test*

- **A coluna "Estimado" impressa na Home de um evento fechado** — linha 94
  - a linha CUSTO mostra o orçamento (R$ 307 mil), não o realizado (R$ 376 mil) — linha 95
  - o desvio de custo aparece: +70 (mil) — antes era +0 — linha 105
  - a linha LUCRO mostra R$ 245 mil de estimado, e não os R$ 175 mil de antes — linha 111
  - a RECEITA não mudou de régua: estimado e realizado seguem iguais aqui — linha 119
  - a MARGEM estimada acompanha o lucro novo: 44,4% contra 31,8% realizada — linha 127
  - o herói diz "vs. estimado R$ 245 mil" e declara o quanto ficou abaixo — linha 135
  - a tela DIZ a régua, em português, embaixo da tabela — linha 146
  - o cabeçalho da tabela continua Estimado · Realizado · Desvio, nessa ordem — linha 154
- **A MESMA coluna na aba Cenários do editor** — linha 167
  - o card da aba Cenários imprime o orçamento, igual à Home — linha 168
- **Evento ABERTO: a Home não mostra o card — a previsão viva segue intacta** — linha 188
  - sem status fechado, aparecem os três cenários e nenhuma coluna Estimado × Realizado — linha 189
- **Card sem o bloco estimado (foto antiga): a coluna sai "—", nunca R$ 0** — linha 211
  - as quatro linhas mostram traço no estimado e no desvio — linha 212

### EventEditor.evidencia.test.jsx

*4 describe · 11 it/test*

- **Evento fechado: a EDIÇÃO DE CAMPO trava (fieldset + disabled individual)** — linha 47
  - nome do evento fica desabilitado (disabled individual, linha 279) — linha 48
  - campo "Data" dos metadados vive dentro de um fieldset com o atributo disabled (1º fieldset) — linha 63
  - campo "Taxa bilheteria (%)" da aba Receita vive dentro de um fieldset com o atributo disabled (3º fieldset) — linha 70
  - botão "Buscar dados do Financeiro" fica desabilitado (disabled individual) — linha 77
- **Evento ABERTO: os mesmos campos NÃO travam (a trava é condicional, não sempre-on)** — linha 83
  - nome do evento fica habilitado — linha 84
  - campo "Data" dos metadados: o fieldset que o envolve NÃO carrega disabled — linha 91
  - campo "Taxa bilheteria (%)" da aba Receita: o fieldset que o envolve NÃO carrega disabled — linha 98
  - botão "Buscar dados do Financeiro" fica habilitado — linha 105
- **Evento fechado: REABRIR continua permitido — é o caminho de volta, não pode ficar preso atrás da própria trava** — linha 111
  - botão "Reabrir evento" da nav sticky aparece sem disabled e, confirmado, chama onReabrirEvento — linha 112
  - cancelando a confirmação, onReabrirEvento NÃO é chamado (o clique sozinho não basta) — linha 123
- **Evento fechado: a aba Fechamento fica FORA da trava — é onde se reabre e se vê a foto** — linha 132
  - o botão de trocar para a aba "Fechamento" não está desabilitado e a troca funciona — linha 133

### fechamentoEAnaliseDeFestaQuebrada.test.jsx

*6 describe · 12 it/test*

- **Fechamento: estimado 1e308 com realizado de R$ 5.000** — linha 97
  - a linha Estrutura não imprime R$ 0 nem ESTOURO: o estimado vira texto — linha 100
  - "Orçamento de custos (todos os itens)" diz que não dá para calcular — linha 110
  - a faixa não diz mais que os números "continuam valendo" — linha 117
  - o card continua com o resultado certo (usa o realizado) — linha 123
- **Fechamento: custo quebrado sem realizado** — linha 129
  - festa ABERTA: "Resultado parcial" e "Custos considerados" viram texto, sem R$ 0 — linha 130
  - corrompida e DEPOIS fechada (foto com null): o card não imprime R$ 0 nem verde — linha 139
- **Fechamento: festa fechada SÃ e corrompida depois (fotografia boa)** — linha 147
  - o card mostra a fotografia, e a faixa manda NÃO mexer — linha 154
  - a nota de recálculo culpa o custo, não "fórmulas ou premissas", e não imprime R$ 0 — linha 162
- **Fechamento: CONTRAPROVA com festa sã** — linha 171
  - nenhum "não dá para calcular", e o ESTOURO de verdade continua — linha 172
- **Análise: a frase da faixa sai do que a aba imprime** — linha 180
  - estimado 1e308 + realizado: os saldos são dinheiro, e a faixa diz que valem — linha 192
  - CONTRAPROVA: sem o realizado, os saldos explodem e a faixa diz isso — linha 199
- **Fechamento da festa SÃ: a acurácia não mistura a festa quebrada** — linha 208
  - continua +10% em Estrutura, e diz que uma festa ficou de fora — linha 216

### fechamentoOrigemInvalida.s4.test.jsx

*1 describe · 5 it/test*

- **(fora de qualquer describe)** — linha 19
  - App recusa origem antes de snapshot/carimbo/histórico mesmo chamado diretamente — linha 19
  - FechamentoTab mostra recusa junto à ação, não chama fechamento — linha 22
  - EventEditor real recusa promoção de ${campo} ilegível antes de confirmar/gravar — linha 23
  - promoção open bar aceita bar ilegível excluído da conta — linha 26
  - bilheteria zero válida mantém confirmação extra e chama uma vez; correção explícita libera fechamento — linha 28

### FinanceiroModal.alias.test.jsx

*1 describe · 2 it/test*

- **(fora de qualquer describe)** — linha 9
  - expõe disputa da contribuição na revisão, sem snapshot nem aplicação — linha 9
  - reconhecimento tira o aviso da origem substituída; desmarcar recupera o aviso anterior — linha 24

### FinanceiroModal.s1.test.jsx

*1 describe · 15 it/test*

- **S1 — revisão real da ponte** — linha 132
  - retorno legado começa sem valores marcados e explica a procedência desconhecida — linha 133
  - pagamento fica informativo, sem destino vendido, e plano excluído vem do payload — linha 143
  - primeiro vínculo exige destino e confirmação; duas origens atualizam um item previsto — linha 153
  - reconsulta parcial mantém Segurança desmarcada e prévia inclui as duas contribuições — linha 177
  - origem ausente permanece com aviso e aparece no total final de 7.700 — linha 193
  - aplicar, salvar, recarregar e importar backup preserva destino por ID após renomeação — linha 208
  - snapshot real restaura item, previsto e vínculo que existiam antes da aplicação — linha 231
  - desfazer imediato restaura uma vez e repetição não duplica item nem aplicação — linha 245
  - desfazer depois de edição manual não perde o valor posterior e explica recuperação — linha 259
  - desfazer depois de fechar evento preserva os números congelados — linha 270
  - update recusado mostra motivo sem anunciar aplicação — linha 280
  - seleção vazia preserva valores e não cria snapshot; vínculo pertence à etapa de escolha — linha 291
  - snapshot recusado impede valores e sucesso, com mensagem visível — linha 306
  - despacho aguarda props efetivadas e duplo clique não repete aplicação ou snapshot — linha 324
  - evento %s antes do updater não recebe valores nem mostra sucesso *(each)* — linha 340

### Home.evidencia.test.jsx

*2 describe · 8 it/test*

- **Evento FECHADO: os três botões do card (Duplicar, Nova edição, Mover para a lixeira) continuam permitidos** — linha 65
  - o botão "Duplicar (cópia idêntica)" existe e NÃO está desabilitado — linha 66
  - o botão "Nova edição" existe e NÃO está desabilitado — linha 72
  - o botão "Mover para a lixeira" existe e NÃO está desabilitado — linha 78
  - clicar em "Duplicar" realmente produz um evento novo no store (efeito, não só o botão existir) — linha 84
  - duplicar NÃO muta o evento original (o objeto original continua "Evento Fechado", fechado) — linha 99
  - clicar em "Mover para a lixeira" (confirmado) realmente tira o evento do store — linha 114
  - cancelando a confirmação de exclusão, o store NÃO é tocado (o clique sozinho não basta) — linha 130
- **CONTRASTE — evento ABERTO: os mesmos três botões também ficam habilitados (a regra é "sempre permitido", não "permitido só quando fechado")** — linha 142
  - Duplicar, Nova edição e Mover para a lixeira estão todos habilitados num evento aberto — linha 143

### importBenchmarkNegativo.fio.test.jsx

*2 describe · 4 it/test*

- **(fora de qualquer describe)** — linha 105
  - (dinâmico: `c` — variável, valor muda por caso; ver código-fonte, linha 105) — linha 105
- **o fio na tela: planilha com estorno vira benchmark que não esconde dinheiro** — linha 116
  - a categoria negativa FICA na foto e o custoTotal fecha com o que se vê — linha 117
  - o EVENTO recusa estorno, enquanto o benchmark conserva os três valores históricos — linha 136
  - (dinâmico: `i` — variável, valor muda por caso; ver código-fonte, linha 142) — linha 142

### ImportModal.p6independente.test.jsx

*1 describe · 3 it/test*

- **P6 — conferência independente do ciclo de importação** — linha 65
  - R$ 15.000 aceitos permanecem iguais no store, reload, backup reimportado e restauração real — linha 66
  - falha no snapshot mantém a revisão e não cria evento nem navega — linha 90
  - desfazer pela tela remove só a importação e preserva uma edição posterior em outra festa — linha 101

### ImportModal.s2.test.jsx

*1 describe · 17 it/test*

- **(fora de qualquer describe)** — linha 32
  - P3 — texto completo recusado, Gerador e realizado não informado no store — linha 32
  - P3 — integralmente recusado mantém revisão e não aplica — linha 39
  - P3 — NumInput conserva %s sem salvar *(each)* — linha 43
  - P6 — destinos separados, snapshot, resultado, reload e backup real preservam números — linha 44
  - P6 — benchmark negativo isolado permite trocar destino sem perder original — linha 59
  - P6 — desfazer pontual preserva anteriores e edição de outra festa após importar — linha 65
  - P6 — objeto importado editado impede desfazer, histórico que removeu antes não recria — linha 73
  - P6 — restauração usa snapshot realmente criado e aplica store restaurado — linha 79
  - P6 — snapshot falhando mantém revisão sem dispatch, abrir ou fechar — linha 85
  - P6 — gravação já bloqueada recusa antes de snapshot e cancelar não muda store — linha 89
  - P6 — snapshot existe antes do primeiro dispatch, que não abre nem fecha — linha 95
  - P5 — escolha %s visível sem pré-seleção, ambos destinos persistem %s *(each)* — linha 100
  - P5 — subcentavo aparece com precisão e conflito desmarcado não bloqueia restante — linha 110
  - P5 — limpar escolha e trocar arquivo retornam decisão para pendente — linha 116
  - P5 — três seções70400 não criam bilheteria; lote explícito100×200 continua receita — linha 122
  - P5 — escolher informado subcentavo conserva4999.999 no evento e no backup após reload — linha 127
  - P5 — conflito pendente com unitário %s pode ser desmarcado sem escolher valor *(each)* — linha 136

### importSemIdentificacao.fio.test.jsx

*2 describe · 7 it/test*

- **o fio na tela: backup com festas SEM identificação** — linha 102
  - as 3 festas entram no store e o aviso diz "3 festas entraram" (antes dizia 3 e entrava 1) — linha 103
  - o aviso nomeia as 3 que ganharam identificação e avisa que reimportar repete — linha 113
  - mistura (1 com id + 2 sem): entram 3, e o aviso fala só das 2 que ganharam — linha 125
  - o número do aviso é o que ENTROU, contado com o store de ANTES: 1 nova + 1 atualizada — linha 137
- **o outro lado — sem alarme falso** — linha 150
  - backup normal (todas identificadas) não fala de identificação nova nem de reimportar — linha 151
  - AJUSTES › Backup: a MESMA verdade na outra tela de import (são duas) — linha 163
  - a caixa de erro continua aparecendo para backup de OUTRO app — nada entra — linha 198

### impostoNaTela.evidencia.test.jsx

*4 describe · 22 it/test*

- **a linha do imposto no DRE da aba Cenários** — linha 81
  - a linha EXISTE e diz sobre o que o imposto incidiu — linha 82
  - a linha mostra o VALOR, com sinal de dedução, nos três cenários — linha 88
  - a coluna FECHA na tela: receita − imposto − custo = o lucro impresso — linha 98
  - SEM imposto configurado a linha NÃO existe — a tela de hoje continua a de hoje — linha 120
  - alíquota 10% com NENHUMA base marcada: a linha aparece e conta a história — linha 125
  - alíquota 0% sobre a bilheteria conta uma história DIFERENTE do caso acima — linha 133
  - bar de fora aparece escrito: a linha nomeia só bilheteria e patrocínio — linha 139
- **o card de cada cenário** — linha 153
  - mostra a linha de imposto entre a receita e o custo — linha 154
  - o gráfico Receita × Custo × Lucro avisa que o lucro já é pós-imposto — linha 161
  - sem imposto o gráfico não ganha nota nenhuma — linha 168
  - sem imposto o card é o de sempre (receita, custo, break-even…) — linha 173
- **o relatório impresso** — linha 184
  - o DRE do relatório tem a linha, com alíquota e bases — linha 185
  - os três cards do resumo mostram "Imposto" junto de receita e custo — linha 192
  - a nota de premissas explica a base BRUTA e a contingência de fora — linha 197
  - sem imposto, o relatório não ganha linha nem premissa nova — linha 204
- **o card de edição na aba Receita** — linha 214
  - tem a alíquota e as três chaves, com os nomes que o Marco usa — linha 215
  - as três chaves nascem DESLIGADAS num evento que nunca viu esta tela — linha 223
  - a chave marcada aparece marcada (a tela lê o mesmo que a conta lê) — linha 229
  - valor TORTO no dado salvo não marca a caixinha (a conta também o ignora) — linha 240
  - mostra a continha do realista: base × alíquota = imposto — linha 245
  - alíquota digitada sem nenhuma base marcada AVISA em vez de ficar muda — linha 251
  - base marcada sem alíquota AVISA que o imposto fica em R$ 0 — linha 261

### impostoNoRealizado.evidencia.test.jsx

*7 describe · 31 it/test*

- **S1 — a ponte do Fechamento não culpa mais a receita pelo imposto** — linha 181
  - NA TELA: a frase "a receita deste card está R$ 1.300 acima" NÃO aparece — linha 182
  - o desvio de receita é ZERO quando a receita realizada é a prevista — linha 194
  - a identidade fecha com TRÊS parcelas — reserva + receita − imposto — linha 202
  - NA TELA: quem vendeu mais vê as DUAS parcelas, cada uma com o nome dela — linha 213
  - quem vendeu MENOS: as duas parcelas ficam ABAIXO, e a identidade fecha — linha 221
  - FOTO ANTIGA (cenário sem a chave `imposto`) não estoura nem inventa número — linha 239
  - SEM cenário nenhum: o card existe, com imposto e sem parcelas de ponte — linha 252
  - evento SEM imposto: nem a chave nem a frase existem (a tela de sempre) — linha 260
- **S1 — o card "Resultado realizado" desconta o mesmo imposto do DRE** — linha 274
  - a diferença entre o card e o cenário é SÓ a reserva — como era antes do imposto — linha 275
  - a coluna "Estimado" também é pós-imposto — senão o "vs. estimado" mentia — linha 286
  - NA ABA CENÁRIOS: o card imprime R$ 8,2 mil, e NÃO os R$ 9,5 mil de antes — linha 294
  - NA ABA CENÁRIOS: a tabela ganha a linha Imposto, nas duas colunas — linha 302
  - NA ABA CENÁRIOS: o rodapé DIZ que o imposto sai das duas colunas — linha 321
  - NA HOME: o mesmo card, o mesmo número — as duas telas não se contradizem — linha 328
  - evento SEM imposto: a tabela segue com QUATRO linhas, sem "R$ 0" de enfeite — linha 335
- **a aba Fechamento mostra o imposto como passo da conta** — linha 349
  - a linha existe entre a receita e os custos, com valor e bases — linha 350
  - a coluna FECHA na tela: 12.500 − 1.300 − 3.000 = 8.200 — linha 358
  - o rodapé escreve o imposto na fórmula e diz que a base é a BRUTA — linha 371
  - alíquota digitada sem base marcada: R$ 0 que EXPLICA por que é zero — linha 379
- **a foto do fechamento congela UM lucro, não dois** — linha 392
  - a foto guarda o descritor do imposto nos DOIS blocos e eles conciliam — linha 393
  - foto de evento SEM imposto não ganha campo novo (contrato do salvo) — linha 406
- **as três telas que publicam a foto fecham a conta** — linha 424
  - o texto do WhatsApp nomeia o imposto, e a linha FECHA — linha 427
  - festa fechada SEM imposto: a frase do WhatsApp é a de sempre — linha 439
  - NO RELATÓRIO impresso: a linha do resultado real cita o imposto — linha 447
  - NO MODO APRESENTAÇÃO: a faixa da reunião cita o imposto — linha 457
- **benchmark promovido de festa com imposto** — linha 471
  - o lucro gravado é pós-imposto e a obs EXPLICA a diferença que o editor acusa — linha 472
  - festa SEM imposto: a obs é a de sempre, sem uma palavra a mais — linha 485
- **a comparação de versão explica o lucro que mudou** — linha 505
  - mudando SÓ a alíquota, a linha de imposto aparece e as outras ficam zeradas — linha 506
  - sem imposto em nenhum dos dois lados, a tabela segue com cinco linhas — linha 522
  - (dinâmico: `l` — variável, valor muda por caso; ver código-fonte, linha 525) — linha 525
  - imposto que SOBE é vermelho — a régua do custo, não a do resultado — linha 528

### loteSemPreco.revisao.s7.test.jsx

*8 describe · 14 it/test*

- **1a — painel do veredito (topo de todas as abas)** — linha 88
  - a linha curta aparece uma vez no painel; controle preço 0: não aparece — linha 89
- **1b — aba Fechamento** — linha 99
  - festa aberta: a faixa completa, logo antes do cartão de receita realizada — linha 100
  - festa fechada: sem a faixa (os números são a fotografia); controle preço 0 aberta: sem faixa — linha 108
- **1c — cartão da Home** — linha 123
  - festa com o Camarote sem preço: a linha curta no cartão dela, não no da festa vizinha — linha 135
- **1d — aba Custos, R$/pessoa** — linha 145
  - em R$/pessoa a nota diz o divisor e o lote de fora; em Absoluto, não — linha 146
  - controle preço 0: em R$/pessoa, nenhuma nota — linha 153
- **1e — card de ritmo e curva de vendas** — linha 162
  - "Estamos vendendo no ritmo?": a meta é 293 e a linha curta diz por quê; controle preço 0: sem linha — linha 179
  - curva com o realizado do Financeiro: a linha "Pela curva, faltam" vem com a linha curta — linha 187
- **3 — P1 caso misto: Camarote sem preço 125 + Lote 1 com preço 540 no realista** — linha 203
  - a trava continua: o Lote 1 tem preço e foi fixado à mão — linha 205
  - cartão Realista e WhatsApp: "quantidade travada à mão neste cenário" — linha 210
- **5 — resumo do rascunho** — linha 226
  - ajuste no Camarote sem preço diz que não conta; o do Lote 1 sai como sempre — linha 227
  - mudar e soltar o ajuste do Camarote também diz que não conta; com preço 50, não diz — linha 235
- **6 — Apresentação: o aviso lê o RASCUNHO (eventoView), não o evento salvo** — linha 253
  - rascunho COM o ajuste, evento salvo SEM: a faixa aparece — linha 265
  - rascunho SEM o ajuste, evento salvo COM: a faixa não aparece — linha 271

### loteSemPreco.s7.test.jsx

*5 describe · 15 it/test*

- **aba Receita** — linha 94
  - R1 — a faixa com o texto da Receita existe uma vez e vem ANTES da tabela — linha 95
  - R2 — a linha do Camarote: selo "sem preço" (title com o rótulo inteiro), sem "cortesia", Receita e Acumulada em travessão; Efetivo e Ao cliente também — linha 104
  - R3 — total dos lotes sem o Camarote (650) e a linha Realista com 590; controle preço 0: 950 e 350 cortesias — linha 124
  - R4 — digitar 0 vira cortesia e a faixa some; apagar volta a faixa; a quantidade salva continua 300 — linha 141
  - R5 — evento novo (seis lotes em branco): nenhuma faixa, nenhum selo — linha 163
- **aba Cenários** — linha 196
  - C1 — os três cartões trazem a linha curta, o público sem o Camarote e o mínimo verdadeiro — linha 197
  - C2 — controle preço 0: sem a linha curta; 830/890/950 e 167/135/120 — linha 209
  - C3 — "Ajuste manual por lote": o Camarote diz que o ajuste não conta e sugere 0; Lote 1 sugere 480/540/600 — linha 221
  - T1 — P1 (A), Marco 06/10/2026: ajuste 125 no Camarote sem preço mostra o mínimo 293; com preço 50, o aviso de trava — linha 234
- **Relatório** — linha 257
  - P1 — ${nivel}: a faixa com o texto completo e o cabeçalho "590 pessoas" — linha 259
  - P2 — Completo, Bilheteria: Camarote marcado, "sem preço" no valor, travessão na receita e no preço cheio — linha 268
  - P3 — ajuste 0 no Realista para o Camarote sem preço: nada de "zerado no Realista"; Receita em travessão — linha 281
  - P4 — com cupom e ticket manual (aparece "Com desconto × capacidade"): Efetivo e essa coluna em travessão — linha 288
- **Apresentação** — linha 299
  - A1 — a faixa existe uma vez e o público do realista é 590 — linha 300
- **Import JSON — o aviso depois de importar** — linha 312
  - ${porta === 'ImportModal' ? 'I1' : 'I2'} — ${porta}: o alerta nomeia a festa e o lote sem preço — linha 314

### loteTravas.faixa.test.jsx

*3 describe · 9 it/test*

- **item 1 — Taxa do sistema (%) do bar recusa fora de 0..100 na porta** — linha 18
  - digitar 150 (o repro do auditor): avisa 0..100 e NÃO grava — linha 25
  - digitar −30 idem: recusado — linha 32
  - valor 0..100 (60) continua gravando — a faixa não quebrou o campo — linha 39
- **item 2 — Margem mínima/alvo recusam fora de 0..100 na porta** — linha 50
  - margem mínima −20 (prejuízo com semáforo não-vermelho): avisa e NÃO grava — linha 57
  - margem alvo 150 idem: recusado — linha 64
  - margem 20 válida continua gravando — linha 71
- **item 3 — Fechamento: bilheteria bruta ≥ 0; bar líquido aceita negativo** — linha 81
  - bilheteria realizada −500 (receita bruta não pode ser negativa): avisa e NÃO grava — linha 88
  - bar realizado −3000 (LUCRO LÍQUIDO — prejuízo é fato) PASSA: sem aviso, grava — linha 95
  - bilheteria válida (8000) continua gravando — linha 104

### lucroDeFestaQuebrada.test.jsx

*7 describe · 21 it/test*

- **aba Cenários: lucro e margem de festa quebrada** — linha 111
  - o card de cada cenário diz "não dá para calcular" no lugar do lucro, sem verde — linha 112
  - a DRE escreve o texto nas linhas Lucro e Margem dos três cenários — linha 125
  - a faixa diz o que ESTA aba faz agora (custo R$ 0, lucro como texto) — linha 138
  - CONTRAPROVA: a festa sã continua com lucro em reais, na cor do resultado — linha 143
  - estimado quebrado com realizado lançado: os números estão certos, e a faixa NÃO diz que zeram — linha 154
- **Relatório: lucro, margem e resultado real de festa quebrada** — linha 164
  - ${nivel}: o card de cada cenário não imprime lucro em reais — linha 166
  - ${nivel}: festa FECHADA — o resultado real não sai em reais nem em verde — linha 186
  - completo: a DRE escreve o texto em Lucro e Margem — linha 198
  - CONTRAPROVA: festa sã fechada mostra o resultado real em reais, verde — linha 208
- **Apresentação: lucro e resultado real de festa quebrada** — linha 218
  - a faixa aparece, e nenhum card projeta lucro em reais — linha 219
  - festa FECHADA: o resultado real não sai em reais — linha 232
  - CONTRAPROVA: festa sã projeta o lucro em reais e sem faixa — linha 240
- **veredito de festa quebrada: sem margem inventada** — linha 250
  - o painel do editor diz "Sem veredito" e não cita margem — linha 253
  - o selo leva a mesma frase, não a margem — linha 260
  - CONTRAPROVA: festa sã continua com o veredito de sempre — linha 266
- **festa fechada sã e corrompida depois: o mesmo conselho do Fechamento** — linha 279
  - ${tela}: manda NÃO mexer, e diz que o resultado real da foto vale — linha 293
  - Relatório: o resultado real continua sendo o da foto, em reais — linha 301
  - Cenários: o card do realizado aponta para a fotografia na aba Fechamento — linha 309
  - CONTRAPROVA: corrompida e DEPOIS fechada (foto quebrada) — aí o conselho é corrigir — linha 314
- **lucro finito mas fora da régua: dois custos de 1e306** — linha 328
  - Cenários: o card não imprime o lucro de centenas de dígitos — linha 329
- **Relatório: orçamento fechado de festa quebrada** — linha 346
  - diz que não dá para calcular, sem número de centenas de dígitos — linha 347

### OrcamentoProdutorModal.s2.test.jsx

*1 describe · 4 it/test*

- **(fora de qualquer describe)** — linha 14
  - P3 — modal %s expõe original e recusa sem dizer nenhuma diferença *(each)* — linha 14
  - P3 — a proposta de limpar texto salvo ilegível mostra o original, sem apresentá-lo como R$ 0 — linha 26
  - a revisão mostra a diferença de um centavo no custo e no patrocínio — linha 44
  - erro nativo Excel no produtor %s é recusado com original, e a linha saudável segue na proposta *(each)* — linha 59

### OrcamentoProdutorModal.test.jsx

*1 describe · 2 it/test*

- **OrcamentoProdutorModal — fio da reimportação v2 (tela 3c)** — linha 49
  - sobe v2 editado → revisão com alvo em destaque, alteração e remoção; aplicar chama update — linha 52
  - planilha de OUTRO evento → recusa nomeando, sem entrar na revisão nem chamar update — linha 73

### PixFechamento.test.jsx

*1 describe · 3 it/test*

- **(fora de qualquer describe)** — linha 23
  - digitar valor brasileiro mostra linha do Pix; apagar retira a linha da conta — linha 23
  - evento fechado mantém o valor na foto e impede edição do Pix — linha 37
  - PDF, apresentação e resumo levam a receita da foto já acrescida do Pix — linha 46

### planilhaSemLogo.evidencia.test.jsx

*1 describe · 2 it/test*

- **planilha do produtor: logo que falha é AVISADO, não engolido** — linha 49
  - o logo falha → a planilha baixa assim mesmo, e a tela diz que saiu sem logo e por quê — linha 50
  - o logo sai → nenhum aviso — linha 60

### planilhaSemPreco.s7.test.jsx

*4 describe · 8 it/test*

- **parseAOA — a célula de preço do lote** — linha 53
  - %s → lote SEM PREÇO (valor "") *(each)* — linha 54
  - %s → continua cortesia (valor 0) *(each)* — linha 61
- **P3 — a tabela completa da célula de preço** — linha 73
  - %s → %s *(each)* — linha 75
- **montarDadosImportPlanilha — evento e referência histórica** — linha 100
  - o evento leva o Camarote com valor "" e censo vazio; fica fora do público — linha 106
  - a referência histórica da mesma planilha não muda: receita e pagos iguais aos do "0" — linha 115
- **ImportModal — revisão da planilha** — linha 123
  - célula vazia: "sem preço" no valor e a observação da decisão; aplicado, o lote fica salvo sem preço — linha 147
  - item 4 da revisão: observações de um lote porta sem preço saem separadas por " · " — linha 163
  - controle: "—" escrito continua cortesia na revisão — linha 174

### PlanoExportModal.semPreco.test.jsx

*1 describe · 2 it/test*

- **PlanoExportModal com lote sem preço** — linha 31
  - a faixa de avisos traz o lote que ficou de fora, em âmbar — linha 32
  - com preço 0 declarado (cortesia), o aviso não aparece — linha 39

### pontePelaNuvem.evidencia.test.jsx

*1 describe · 8 it/test*

- **na cópia da nuvem, a tela diz a verdade sobre a ponte** — linha 64
  - o jsdom deste arquivo está mesmo na origem da nuvem — linha 65
  - Home: o aviso calmo da nuvem aparece, sem pedir token, e a rede não é chamada — linha 69
  - Home: o aviso aparece UMA vez — na segunda abertura neste navegador, não — linha 76
  - Ajustes › Backup: diz que não há envio automático; NÃO mostra campo nem botão do token, só onde a ponte funciona — linha 86
  - Ajustes: "Enviar ao Financeiro" desligado, com o motivo no title — linha 103
  - Home: o atalho "Enviar ao Financeiro" da barra do topo desligado, com o motivo no title — linha 110
  - os SEIS botões da ponte desligados, todos com o motivo no title — linha 119
  - Evento: "Buscar dados do Financeiro" desligado, com o motivo no title — linha 128

### pontePeloMac.evidencia.test.jsx

*1 describe · 4 it/test*

- **no app do Mac (http://localhost:4173), a ponte se comporta como antes** — linha 14
  - o jsdom deste arquivo está mesmo nessa origem — linha 15
  - Home sem token: a faixa pede o token, como sempre — e nada do aviso da nuvem — linha 19
  - Ajustes › Backup: a frase do envio diário, o campo e o botão do token, como antes — linha 23
  - os SEIS botões da ponte continuam LIGADOS, com os títulos de antes — linha 27

### pontePeloMac127.evidencia.test.jsx

*1 describe · 4 it/test*

- **no app do Mac (http://127.0.0.1:4173), a ponte se comporta como antes** — linha 13
  - o jsdom deste arquivo está mesmo nessa origem — linha 14
  - Home sem token: a faixa pede o token, como sempre — e nada do aviso da nuvem — linha 18
  - Ajustes › Backup: a frase do envio diário, o campo e o botão do token, como antes — linha 22
  - os SEIS botões da ponte continuam LIGADOS, com os títulos de antes — linha 26

### portaDeImportarBloqueada.evidencia.test.jsx

*2 describe · 5 it/test*

- **Home — gravação bloqueada por falha de leitura** — linha 88
  - o botão "Importar evento antigo" do cabeçalho está DESABILITADO — linha 100
  - o motivo está no title, em português de leigo, e diz o que fazer — linha 105
  - clicar nele NÃO abre o fluxo de importação (o trabalho não chega a começar) — linha 112
- **Home — leitura em ordem (o outro lado: a trava não pode estorvar)** — linha 119
  - o botão continua clicável e com o title de sempre — linha 127
  - e clicar nele ABRE o fluxo de importação — linha 134

### portasDeDinheiro.faixa.test.jsx

*4 describe · 17 it/test*

- **frente 18 — inventário de portas de dinheiro gerado do código** — linha 216
  - o inventário gerado tem portas de verdade (a varredura não voltou vazia) — linha 219
  - TODA porta ou tem régua, ou está declarada — nenhuma porta órfã — linha 225
  - nenhuma linha das listas descreve uma porta que já não existe — linha 238
  - cada porta com régua usa exatamente a régua declarada (ninguém troca a faixa em silêncio) — linha 250
  - as portas declaradas SEM régua continuam sem régua (quem ganhar faixa sai da lista) — linha 257
  - a lista de portas SEM decisão escrita é exatamente a de 25/07/2026 (2ª medição — só o caixa inicial sobra) — linha 265
- **frente 18 — os 13 campos da decisão de 25/07/2026: negativo recusa, teto recusa, normal grava** — linha 287
- **(dinâmico: `c` — variável, valor muda por caso; ver código-fonte, linha 420)** — linha 420
  - recusa negativo, avisa em português e NÃO grava — linha 421
  - recusa acima do teto (R$/nº ${TETO_DINHEIRO.toLocaleString('pt-BR')}), avisa com mensagem PRÓPRIA do teto e NÃO grava — linha 431
  - aceita um valor normal e grava o número certo — linha 441
  - o teto aceita o valor exatamente NO limite (não é off-by-one) — linha 450
- **frente 18 — a régua da régua: MoneyInput e PctInput REPASSAM o faixa** — linha 464
  - MoneyInput com FAIXA_CUSTO recusa −500, avisa em português e NÃO grava — linha 469
  - MoneyInput sem faixa continua aceitando o negativo (o embrulho não inventa régua) — linha 477
  - PctInput com FAIXA_PCT recusa 150, avisa em português e NÃO grava — linha 484
  - valor DENTRO da faixa continua gravando — a régua não quebrou o campo — linha 492
  - colar "25.000,000" num campo de custo grava 25000 e NÃO avisa nada — linha 504
  - e "1,500" na mesma porta segue gravando 1500 — as duas regras convivem — linha 511
  - o campo de dinheiro CARREGA a dica das duas regras, e um title próprio ganha dela — linha 518

### PresentationMode.test.jsx

*1 describe · 1 it/test*

- **PresentationMode — canário 2: "Aplicar ao evento" não pode ser silencioso** — linha 44
  - mexer num slider e clicar Aplicar CHAMA update (o handler lê o rascunho FRESCO) — linha 45

### ProtecaoModal.revisao.test.jsx

*2 describe · 7 it/test*

- **restaurar um instantâneo com número fora de faixa — a revisão vem ANTES** — linha 95
  - nada é aplicado até o clique: a revisão aparece e o store do app não foi tocado — linha 96
  - a revisão diz o campo, o valor salvo, para onde vai e o efeito em R$ — item a item — linha 102
  - o botão diz a AÇÃO e o EFEITO, e é ele que aplica — com o store CORRIGIDO — linha 115
  - o caminho de NÃO APLICAR existe: dá para ver como foi salvo, com o aviso de que a conta estava errada — linha 126
  - cancelar não aplica nada e diz isso — linha 141
  - o instantâneo guardado NÃO é reescrito pela restauração — dá para restaurar de novo — linha 148
- **restaurar um instantâneo SÃO — o risco aceito só é cobrado quando há o que explicar** — linha 155
  - sem correção nenhuma, restaura direto: nenhuma tela no meio — linha 156

### publicoDeReferencia.test.jsx

*8 describe · 17 it/test*

- **publicoDaReferencia — os quatro estados** — linha 165
  - público %s → %s *(each)* — linha 166
  - não muda o objeto lido (o original segue no store e no backup) — linha 195
  - o override de embutido com público ilegível chega à lista com o ORIGINAL, sem normalizar — linha 202
- **benchmark %s — público ilegível** — linha 212
- **%s** — linha 213
  - Relatório › cabeçalho da comparação: diz que não consegue calcular, nunca “N pessoas” — linha 214
  - Cenários › “Por pessoa”: a barra da referência some e o valor diz “não dá para calcular” — linha 229
  - Cenários › “Absoluto”: o público não entra, o custo total sai como antes — linha 236
  - Custos › Referências: “por pessoa: não dá para calcular”, nunca “R$ 0/pessoa” — linha 244
  - tela inicial › coluna Público: o texto de valor ilegível, com o original no title — linha 251
  - Editar benchmarks › campo Público: o valor guardado cru, com o aviso embaixo, e nada gravado — linha 263
- **benchmark %s — público gravado como o texto "0"** — linha 287
  - relatório, Cenários “Por pessoa”, Custos e tela inicial escrevem como o zero numérico — nada de dividir por zero — linha 288
- **benchmark %s — zero, ausência e válido saem como antes** — linha 316
- **%s** — linha 317
  - Relatório: a expressão antiga (`b.publico ? N pessoas : —`), sem faixa — linha 318
  - Cenários “Por pessoa”: a conta antiga (porPessoa → fmtBRL2 ou —) — linha 325
  - Custos › Referências: a expressão antiga — linha 332
  - tela inicial: a expressão antiga (`b.publico ? fmtInt : —`) — linha 340
  - Editar: o campo mostra o que mostrava, sem frase embaixo — linha 349
- **benchmark %s — digitar "-", "-5", "-50" num público de 400** — linha 374
  - o valor guardado nunca vira 0, termina em −50, e o campo mostra o que foi digitado — linha 375
- **AvisoBenchmarkQuebrado — só o verdadeiro, em cada combinação** — linha 401
  - %s *(each)* — linha 417

### quantidadeTravada.s6.test.jsx

*10 describe · 44 it/test*

- **(fora de qualquer describe)** — linha 104
  - (dinâmico: `String` — variável, valor muda por caso; ver código-fonte, linha 104) — linha 104
- **S6 aba Cenários — cartões e DRE** — linha 112
  - %s: o cartão e a DRE (Absoluto e R$/pax) trocam SÓ a coluna realista *(each)* — linha 115
  - o cartão realista não traz "coberto" nem "faltam" do mínimo; a frase de posição é o aviso — linha 147
  - cor da frase de posição: a trava sai em ÂMBAR (aviso de leitura), nunca em vermelho; "faltam" segue vermelho e "coberto" verde — linha 159
  - (dinâmico: `p` — variável, valor muda por caso; ver código-fonte, linha 160) — linha 160
  - (dinâmico: `p` — variável, valor muda por caso; ver código-fonte, linha 176) — linha 176
  - (dinâmico: `p` — variável, valor muda por caso; ver código-fonte, linha 177) — linha 177
  - "nem vendendo todos os ingressos este cenário sai do prejuízo" SEM trava segue vermelho (a trava não pegou a cor do caso antigo) — linha 192
  - (dinâmico: `x` — variável, valor muda por caso; ver código-fonte, linha 197) — linha 197
  - 100/100/20: o cartão não diz "não fecha nem vendendo tudo" — diz a trava — linha 203
  - trava só no pessimista: a coluna realista segue numérica (cartão e DRE) e a pessimista cede — linha 212
  - o card de ritmo e a curva, dentro da aba, trocam a meta pelo aviso e mantêm o editor — linha 224
- **S6 aba Cenários — soltar o ajuste manual, passo a passo (estado real)** — linha 239
  - o aviso fica enquanto resta um lote ajustado; sai quando o último é limpo; 0 volta a travar — linha 265
  - cada cenário é independente: ajustar o pessimista não trava o realista já solto — linha 295
  - o ajuste igual ao automático (360) também trava; apagar a chave destrava — linha 311
- **S6 Relatório (ReportView) — resumo e completo, cada um no seu nível** — linha 322
  - Resumido: o cartão por cenário e a linha de ritmo; sem DRE e sem glossário — linha 329
  - Completo: cartão, DRE por cenário, ritmo e glossário — cada um com a notícia, sem a promessa de 1.200 — linha 344
  - trocar o nível na própria tela mantém a notícia nos dois — linha 369
  - trava só no pessimista: realista numérico em cartão, DRE, ritmo e glossário — linha 382
- **S6 Apresentação (PresentationMode) — decide pela visão do rascunho** — linha 394
  - cartões por cenário e legenda aberta — linha 399
  - 100/100/20 e zero: o mesmo aviso, nunca "não fecha" — linha 414
  - o rascunho manda: a trava que existe SÓ no rascunho vale, mesmo com o evento salvo já sem ela — linha 423
  - o inverso: o salvo ganha um ajuste depois, mas o rascunho (sem ajuste) segue numérico — linha 440
  - trava só no pessimista: realista e otimista numéricos — linha 452
- **S6 Home — o card de cada festa pela meta de ritmo** — linha 463
  - festa futura travada: o card dela diz o aviso; o card da vizinha sem trava segue com a meta numérica — linha 468
  - festa JÁ REALIZADA e travada: o card mostra a marcação de realizado, não o aviso nem meta — linha 481
  - data ilegível e travada: o card diz que a data é inválida, nunca "0/dia" — linha 490
  - trava só no pessimista: o card segue com a meta numérica do realista — linha 498
- **S6 card de ritmo e curva de vendas** — linha 506
  - RitmoVendasCard: a frase vira o aviso, o campo de vendidos continua e nada é gravado ao montar — linha 507
  - RitmoVendasCard SEM trava (e sem a prop nova): igual ao de antes — linha 517
  - festa passada e travada: o card dá a marcação, não o aviso — linha 525
  - CurvaVendas com cache: conserva realizado e gráfico, troca só a meta pelo aviso — linha 533
  - controle positivo da regex da curva: o MESMO render com o evento SEM trava (overrides realistas vazios) casa com ela — linha 549
  - CurvaVendas SEM cache: não inventa linha de ritmo e não chama a rede — linha 563
- **S6 × #98 — dado inválido vence a trava, em todas as telas** — linha 577
- **%s** — linha 582
  - controle: as guardas existentes acusam o cenário realista — linha 585
  - aba Cenários: cartão, DRE e card de ritmo dizem "não dá para calcular"; a faixa do campo quebrado permanece — linha 591
  - card de ritmo: "não dá para calcular", sem meta e sem aviso de trava — linha 604
  - relatório completo: cartão, DRE, ritmo e glossário; a faixa permanece — linha 612
  - relatório e apresentação dizem a MESMA definição do break-even com o dado quebrado — linha 629
  - apresentação: cartão e legenda; a faixa permanece — linha 642
  - soma que não cabe em OUTRO cenário (lote de R$ 1e306, realista travado em 1): cartão, DRE, legenda da apresentação e Home dizem "não dá para calcular" — linha 655
  - ticket de bar do OTIMISTA = 1e308 com realista travado: o realista diz a trava, o otimista o dado inválido — linha 683
- **S6 aviso do React sobre o `fill` da Bola** — linha 703
  - controle positivo: uma Bola com cor `false` faria o React reclamar (o espião enxerga) — linha 704
  - (dinâmico: `String` — variável, valor muda por caso; ver código-fonte, linha 707) — linha 707

### receitaDosCenarios.test.jsx

*4 describe · 10 it/test*

- **insumo da receita dos cenários que não cabe: nenhuma superfície mente** — linha 144
  - ${insumo} em ${valor} · ${tela}: sem número gigante, sem margem, sem veredito, com a faixa — linha 154
  - ${insumo} em ${valor} · Home e painel do veredito — linha 165
  - ${insumo} em ${valor} · WhatsApp — linha 175
  - soma sem culpado (lote de R$ 1e304 × 200): a faixa diz que a SOMA não cabe, e ninguém dá margem nem veredito — linha 187
- **S4: patrocínio em PROPOSTA de 1e308 não entra em conta, então não acende nada** — linha 203
  - nem faixa, nem exclusão da acurácia, e os números da festa continuam — linha 210
  - WhatsApp: o veredito continua, e a proposta sai como frase que se explica — linha 220
- **CONTRAPROVA: festa sã** — linha 228
  - ${tela}: veredito, margem em número e nenhuma faixa de receita — linha 230
- **insumo de UM cenário quebrado: só aquele cenário vira texto** — linha 250
  - ${insumo} quebrado só no ${k}: os outros dois cenários mostram o lucro em reais — linha 280
  - ${insumo} quebrado só no ${k}: o veredito ${vereditoSome ? 'some, e aponta a aba ' + aba : 'continua'} — linha 291
  - CONTRAPROVA do compartilhado: o lote quebrado continua escondendo os três — linha 307

### receitaQuebrada.test.jsx

*6 describe · 10 it/test*

- **a régua da receita e da foto** — linha 105
  - receitaQuebrada nomeia o campo; festa sã passa limpa — linha 106
  - fotoQuebrada acusa o 1e308 FINITO do Pix, e não a foto sã — linha 113
- **fotografia antiga já guardada com ${caso}** — linha 121
  - ${tela}: nenhum número gigante, e todo "não dá para calcular" vem com a faixa da receita — linha 123
  - Relatório: o resultado real diz que não dá para calcular, e a faixa nomeia o campo — linha 132
- **Home: o cartão da festa com receita quebrada** — linha 141
  - diz que a RECEITA não dá para calcular, sem número gigante — linha 142
- **festa fechada SÃ e receita corrompida depois** — linha 152
  - Relatório: o resultado real continua em reais, e o conselho é NÃO mexer — linha 159
- **CONTRAPROVA: festa sã** — linha 168
  - ${tela}: nem faixa de receita, nem "não dá para calcular" — linha 170
- **card do Fechamento: nenhuma linha imprime número derivado de receita quebrada** — linha 187
  - ${campo} em ${valor}: toda linha é dinheiro ou "não dá para calcular" sem "+", e a faixa nomeia o campo — linha 213
  - bilheteria em 1e308: a taxa não sai "+ R$ 0" com o sinal trocado — linha 232
  - CONTRAPROVA: a mesma festa sã tem toda linha em reais — linha 238

### receitaRealizada.s4.test.jsx

*1 describe · 6 it/test*

- **(fora de qualquer describe)** — linha 23
  - bar bruto 14.200,00 mascara linha e card em vez de publicar -800/zero — linha 23
  - abrir focar sair conserva bruto e correção segue funil normal — linha 24
  - bar válido ${bar} mantém resultado — linha 25
  - open bar exclui origem inválida do resultado e da tabela — linha 26
  - fotografia válida ${quadro?'com quadro':'com fallback vivo'} mantém card — linha 27
  - ${porta} JSON ${antigo?'antigo':'atual'} ${acao}: aviso original e snapshot antes — linha 29

### redeDeSeguranca.evidencia.test.jsx

*3 describe · 8 it/test*

- **rede na tela — o app abre mesmo com festa envenenada já salva** — linha 102
  - ABRE, nomeia a festa que não deu para ler e mantém o número da festa saudável — linha 103
  - o painel da festa quebrada aponta o caminho das cópias de segurança — linha 132
  - dá para chegar em Ajustes com a Home envenenada, e a tela de Ajustes monta — linha 142
- **NADA DE FALSO POSITIVO — com dado saudável a rede é invisível** — linha 157
  - duas festas boas: nenhuma frase de falha na tela — linha 158
  - app sem nenhum evento continua com a tela de boas-vindas, não com a rede — linha 173
- **A REDE SE DESARMA — o falso positivo que ela mesma poderia causar** — linha 180
  - trocar a `chave` (dado consertado) tira o painel e mostra o conteúdo de novo — linha 192
  - a MESMA chave com o dado ainda ruim não entra em laço — o painel fica de pé — linha 210
  - sem falha nenhuma, a rede é transparente: só o conteúdo aparece — linha 224

### ReportView.bilheteriaDoCenario.test.jsx

*4 describe · 14 it/test*

- **ReportView — tabela Bilheteria mostra a Receita do cenário Realista (Marco, 26/07/2026)** — linha 103
  - SEM cupom: a soma da coluna Receita bate com a Receita bruta bilheteria do DRE — linha 104
  - COM cupom: os dois fatores (vendaPct do cenário + desconto do cupom) entram juntos, e a soma ainda bate com o DRE — linha 136
  - lote "só otimista" continua travessão nas duas colunas novas; cortesia continua R$ 0,00 (não quebrou o que já era legível) — linha 153
- **ReportView — a coluna Receita cala quando não pode provar o que promete (26/07/2026)** — linha 180
  - com ticket médio manual no Realista: nenhum lote imprime valor, e o microtexto diz o motivo — linha 181
  - com ajuste de % no ticket do Realista: mesma regra, mesmo travessão — linha 208
  - sumindo a de receita, entra a capacidade COM DESCONTO — e ela bate com efetivo × qtd — linha 229
  - sem ticket manual: a promessa volta, e a soma continua batendo com o DRE — linha 268
- **ReportView — centavos e rótulos da tabela Bilheteria (Marco, 26/07/2026)** — linha 285
  - a coluna Receita mostra os centavos, não o real arredondado — linha 286
  - o cabeçalho diz de que soma se trata, e não fala mais em "100%" — linha 310
  - lote comum zerado à mão no Realista ganha marca; cortesia continua só "(cortesia)" — linha 320
- **ReportView — a guarda da tabela olha o que a TELA imprime (26/07/2026)** — linha 356
  - lote "só otimista" com override no Realista aparece com a receita dele, e a soma segue fechando — linha 357
  - grade padrão com preços de centavo e cupom NÃO faz a coluna desaparecer (o falso positivo medido) — linha 380
  - divergência PEQUENA (R$ 5,94) já cala a coluna — a tolerância não é frouxa — linha 412
  - lote zerado à mão continua imprimindo R$ 0,00 com a marca — travessão é para quem NÃO vende — linha 438

### ReportView.evidencia.test.jsx

*1 describe · 4 it/test*

- **ReportView — cards do "Resumo por cenário" continuam com Ticket bruto/líquido** — linha 61
  - renderiza sem lançar exceção com o fixture mínimo — linha 62
  - existem exatamente 3 cards de cenário, um por CENARIO_LABEL — linha 70
  - CADA card mostra "Ticket bruto"/"Ticket líquido" com o valor do PRÓPRIO cenário — linha 81
  - escopo por card: o ticket do pessimista NÃO aparece no card do otimista (nem vice-versa) — linha 108

### ReportView.matriz.test.jsx

*1 describe · 5 it/test*

- **matriz completa por referência e linha** — linha 60
  - %i referências preservam ordem, células e previsão em faixas de quatro *(each)* — linha 61
  - preserva outras categorias, contingência e ajuste %i do realista *(each)* — linha 69
  - usa padrões, overrides, ocultos, apagados e seleção do resolvedor — linha 75
  - mantém aviso e observação da referência final quebrada — linha 86
  - alternar nível mantém preferência e Voltar chama onBack — linha 95

### ritmoNaSemanaFinal.test.jsx

*2 describe · 6 it/test*

- **o card "Estamos vendendo no ritmo?" na semana final** — linha 39
  - a 4 dias da festa mostra 70 por dia — onde antes calava — linha 40
  - a 1 dia da festa mostra 280 por dia — a véspera não é exceção — linha 48
  - no DIA da festa fala no presente, com o quanto falta — linha 53
  - a janela longa continua igual ao que o PR #85 entregou (12 dias, 24 por dia) — linha 64
- **o mesmo card com a data ilegível: diz o problema, nunca um número** — linha 85
  - data %s → o card avisa e não mostra "0 por dia" *(each)* — linha 88
  - a linha da Home também para de dizer "0/dia" — linha 99

### Simulador.faixa.test.jsx

*1 describe · 4 it/test*

- **Simulador — faixa POR CAMPO (3b): vendaPct 0..100, irmãos −50..100** — linha 25
  - vendaPct: digitar −5 avisa (0% a 100% do lote) e NÃO grava — linha 26
  - vendaPct: digitar 150 também recusa (não vende mais que o lote) — linha 33
  - custoPct (IRMÃO): digitar −5 é ACEITO, sem aviso — o negativo é de propósito — linha 40
  - vendaPct: um valor válido (75) grava — a faixa não quebrou o campo — linha 50

### ui.slider.moeda.test.jsx

*2 describe · 10 it/test*

- **Slider — modo moeda** — linha 21
  - as pontas do trilho saem em reais, nunca "0R$" — linha 22
  - milhar sai com ponto: o slider do bar em valor fixo diz "de R$ 0 a R$ 300.000" — linha 32
  - o "R$" aparece ANTES do campo, e o sufixo "%" some — linha 48
  - o campo acoplado continua entendendo o formato brasileiro: "1.234,56" vira 1234.56 — linha 60
  - o campo é mais largo no modo moeda — "180.000" não sai cortado — linha 69
  - arrastar continua devolvendo o ELEMENTO como 2º argumento (agrupamento do desfazer) — linha 76
- **Slider — os percentuais de sempre NÃO regridem** — linha 84
  - sem `moeda`, o title continua "de 0% a 100%" — linha 85
  - sem `moeda`, o "%" continua DEPOIS do campo e não aparece "R$" — linha 92
  - sem `moeda`, a largura do campo é a de sempre (w-14) — linha 102
  - o risco do zero continua aparecendo quando a faixa cruza o zero — linha 108

### vinculoEdicaoRitmo.fio.test.jsx

*1 describe · 5 it/test*

- **vínculo "Edição desta festa": o clique GRAVA em vez de estourar** — linha 82
  - escolher a edição chama update com uma FUNÇÃO, e ela devolve o evento vinculado — linha 83
  - rodando o update DE VERDADE (fn(e)), como o App.jsx faz, nada estoura — linha 101
  - defeito 2, isolado: a forma ANTIGA da chamada quebra o mesmo update — linha 114
  - defeito 1, isolado: o argumento do onChange é o EVENTO, não o valor — linha 123
  - escolher a opção vazia não grava nada (não existe edição de id "") — linha 156

