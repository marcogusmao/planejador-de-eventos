// Helpers puros do relatório/PDF (testáveis fora do React).

// Nome de arquivo sugerido do PDF (sugestão 41): "Brisa #3 — 22-08-2026 —
// plano". O navegador usa o document.title como nome padrão ao "Salvar como
// PDF"; a tela troca o title só na hora de imprimir. Data em DD-MM-AAAA com
// hífen (barra é inválida em nome de arquivo); sem data válida, sai o nome +
// "plano". Remove os caracteres que atrapalham nome de arquivo.
// (A PASTA automática é Fase 3 — aqui é só o nome sugerido.)
export function nomeArquivoPdf(evento) {
  const nome = (evento?.nome || '').trim()
  const d = String(evento?.data || '').slice(0, 10)
  const dataBR = /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`
    : ''
  return [nome, dataBR, 'plano']
    .filter(Boolean)
    .join(' — ')
    .replace(/[/\\:*?"<>|]+/g, '-')
}
