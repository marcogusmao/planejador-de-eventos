// Contrato do export v2 — o que o WRITER (exceljs, xlsxOrcamentoV2.js) e o
// IMPORT (SheetJS, xlsxReconciliar.js) combinam entre si. Mora à parte de
// propósito: o import NÃO pode puxar o exceljs do writer só pra ler a sentinela.
//
// A sincronia writer↔import é garantida pelo teste de round-trip cruzado (gera
// pelo exceljs, lê pelo SheetJS); se a posição de uma coluna divergir, o teste
// quebra — este arquivo é a fonte única dessas posições.

export const SENTINELA_V2 = 'PREVISAO-EVENTOS:ORCAMENTO:v2'

// Índices de coluna 0-based, como o AOA do SheetJS entrega (A=0). A coluna A
// (oculta) carrega a identidade: A1 = sentinela, A2 = id do evento-alvo,
// A10+ = id de cada item. O conteúdo do produtor mora em C..K.
export const COL_V2 = {
  id: 0, // A — id do item (oculto)
  servico: 2, // C
  fornecedor: 3, // D
  estimado: 4, // E
  // F (realizado) e H (responsável) são export-only — o app NÃO lê.
  status: 6, // G
  dataPgto: 8, // I
  pagamento: 9, // J
  obs: 10, // K
}

// Rótulos estruturais que o parser usa pra achar as seções e parar nos blocos
// de baixo (o produtor não deve tocá-los — ver COMO USAR na planilha).
export const CABECALHO_COLUNAS = 'SERVIÇO / PRODUTO'
export const ROTULO_TOTAIS = 'TOTAIS'
export const ROTULO_PROJETO = 'PROJETO'
export const FIM_DAS_SECOES = ['TOTAL GERAL — CUSTOS', 'RESUMO POR CATEGORIA', 'COMO USAR']
