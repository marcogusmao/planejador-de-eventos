// Inspeção sem efeitos: metadados recusados permanecem recuperáveis no backup.
export const normalizarNome = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const idFinanceiroValido = id => Number.isSafeInteger(id) && id > 0;
export const chaveOrigemFinanceiro = o => JSON.stringify(o.categoriaId == null ? ['legado', o.eventoId, normalizarNome(o.categoria)] : ['id', o.eventoId, o.categoriaId]);
const objeto = o => o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
// Aceita centavos inteiros e somente o ruído binário de somas existentes.
export function moedaEmCentavosValida(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  const centavos = v * 100;
  const arredondado = Math.round(centavos);
  return Number.isSafeInteger(arredondado) &&
    Math.abs(centavos - arredondado) <= Math.max(1e-6, Math.abs(centavos) * Number.EPSILON * 4);
}
const dinheiro = v => moedaEmCentavosValida(v) && v > 0;
const data = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v.slice(0, 10);
export function inspecionarOrigensFinanceiro(cru) {
  if (cru == null) return {
    tipo: 'ausente',
    origens: [],
    problemas: []
  };
  const problemas = [];
  if (objeto(cru) && typeof cru.valor === 'number' && Number.isFinite(cru.valor) && !moedaEmCentavosValida(cru.valor)) problemas.push('valor do carimbo contém fração de centavo ou está fora da faixa segura');
  if (!objeto(cru)) problemas.push('carimbo não é um objeto');else if (cru.versao == null && typeof cru.categoria === 'string' && cru.categoria.trim() && dinheiro(cru.valor) && data(cru.em)) return {
    tipo: 'legado',
    origens: [],
    problemas: []
  };else if (cru.versao !== 2) problemas.push('versão do vínculo desconhecida ou carimbo antigo inválido');else {
    if (!dinheiro(cru.valor) || !data(cru.em)) problemas.push('valor ou data do carimbo inválido');
    if (!Array.isArray(cru.origens) || !cru.origens.length) problemas.push('lista de origens vazia ou inválida');else {
      const chaves = new Set();
      let total = 0;
      for (const o of cru.origens) {
        if (!objeto(o) || !idFinanceiroValido(o.eventoId) || !(o.categoriaId === null || idFinanceiroValido(o.categoriaId)) || typeof o.categoria !== 'string' || !o.categoria.trim() || !dinheiro(o.valor) || !data(o.em)) {
          problemas.push('origem com identificador, nome, valor ou data inválido');
          continue;
        }
        const chave = chaveOrigemFinanceiro(o);
        if (chaves.has(chave)) problemas.push('origem repetida no item');
        chaves.add(chave);
        total += Math.round(o.valor * 100);
      }
      if (!Number.isSafeInteger(total) || total !== Math.round(cru.valor * 100)) problemas.push('total do carimbo diferente da soma das origens ou inseguro');
    }
  }
  return problemas.length ? {
    tipo: 'invalido',
    origens: [],
    problemas
  } : {
    tipo: 'v2',
    origens: cru.origens,
    problemas: []
  };
}
export function inspecionarEventoFinanceiro(evento) {
  const itens = [];
  const chaves = new Map();
  const ids = new Map();
  for (const c of Array.isArray(evento?.categorias) ? evento.categorias : []) for (const item of Array.isArray(c?.itens) ? c.itens : []) {
    if (!item || typeof item !== 'object') continue;
    const inspecao = inspecionarOrigensFinanceiro(item.viaFinanceiro);
    const entrada = {
      catId: c.id,
      catNome: c.nome,
      item,
      ...inspecao
    };
    itens.push(entrada);
    ids.set(item.id, [...(ids.get(item.id) || []), entrada]);
    for (const o of inspecao.origens) {
      const chave = chaveOrigemFinanceiro(o);
      chaves.set(chave, [...(chaves.get(chave) || []), entrada]);
    }
  }
  for (const entradas of [...ids.values(), ...chaves.values()]) if (entradas.length > 1) for (const entrada of entradas) {
    entrada.tipo = 'invalido';
    entrada.problemas = [...entrada.problemas, 'identificador de item ou origem repetido entre itens'];
    entrada.origens = [];
  }
  return {
    itens,
    problemas: itens.filter(i => i.problemas.length).map(i => ({
      itemId: i.item.id,
      servico: i.item.servico,
      motivos: i.problemas
    }))
  };
}
