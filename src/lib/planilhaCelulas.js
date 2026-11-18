import * as XLSX from 'xlsx'

// sheet_to_json trata erros nativos do Excel como vazios. Conserva o texto
// visível do erro para que os parsers recusem a célula e mostrem o original.
// A cópia também protege a planilha de caches de formatação do SheetJS.
export function planilhaParaAOA(planilha, opcoes) {
  const copia = { ...planilha }
  for (const [endereco, celula] of Object.entries(planilha)) {
    if (!celula || typeof celula !== 'object' || !celula.t) continue
    copia[endereco] = { ...celula }
    if (celula.t === 'e') {
      const texto = XLSX.utils.format_cell({ ...celula }) || `#ERRO! (${celula.v})`
      copia[endereco] = { ...celula, t: 's', v: texto }
      delete copia[endereco].w
    }
  }
  return XLSX.utils.sheet_to_json(copia, opcoes)
}
