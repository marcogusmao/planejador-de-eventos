import { describe, it, expect } from 'vitest';
import { prepararAplicacaoFinanceiro, montarPropostas, validarEventosFinanceiro, assinaturaFinanceiro } from './financeiro.js';
import { migrarEvento, censoNormalizacoes } from './migracao.js';
const em = '2026-10-05T12:00:00.000Z';
const evento = () => ({
  id: 'festa',
  nome: 'Brisa',
  status: 'rascunho',
  categorias: [{
    id: 'equipe',
    nome: 'Equipe',
    itens: [{
      id: 'item',
      servico: 'Equipe geral',
      estimado: 8000,
      realizado: '',
      custouZero: false
    }]
  }]
});
const ef = (equipe = 5000, seguranca = 2400) => ({
  id: 71,
  nome: 'Brisa',
  ingressosAprovados: 1,
  receitaIngressos: 400,
  custosPorCategoria: [{
    categoriaId: 10,
    categoria: 'Equipe de evento',
    total: equipe
  }, ...(seguranca == null ? [] : [{
    categoriaId: 20,
    categoria: 'Segurança',
    total: seguranca
  }])],
  planoRealizado: {
    receita: 1,
    custos: 2
  }
});
const escolhas = (e, f, n = Infinity) => Object.fromEntries(montarPropostas(e, f).propostas.filter(p => p.grupo === 'custos').slice(0, n).map(p => [p.id, {
  selecionado: true,
  destino: {
    tipo: 'existente',
    catId: 'equipe',
    itemId: 'item'
  }
}]));
const aplicar = (e, f, n = Infinity) => prepararAplicacaoFinanceiro(e, f, escolhas(e, f, n), {
  em
});
describe('S1 composição de contribuições confirmadas', () => {
  it('agrupa7400 preservando8000 e atualiza subconjunto7600', () => {
    const e = evento();
    const r = aplicar(e, ef());
    expect(r.ok).toBe(true);
    expect(r.evento.categorias[0].itens[0]).toMatchObject({
      id: 'item',
      estimado: 8000,
      realizado: 7400
    });
    expect(r.grupos[0].total).toBe(7400);
    expect(aplicar(r.evento, ef()).evento.categorias[0].itens).toHaveLength(1);
    const s = aplicar(r.evento, ef(5200), 1);
    expect(s.grupos[0].mantidas[0].valor).toBe(2400);
    expect(s.evento.categorias[0].itens[0].realizado).toBe(7600);
  });
  it('preserva ausente e zero, renomeia porID sem criar item', () => {
    const e = aplicar(evento(), ef()).evento;
    const f = ef(5300, null);
    f.custosPorCategoria[0].categoria = 'Equipe renomeada';
    const r = aplicar(e, f);
    expect(r.evento.categorias[0].itens[0].realizado).toBe(7700);
    expect(r.avisos.join()).toMatch(/não veio/);
    expect(aplicar(r.evento, ef(5300, 0)).evento.categorias[0].itens[0].realizado).toBe(7700);
  });
  it('ordem inversa mantém resultado e dinheiro em centavos', () => {
    const e = evento(),
      f = ef(.1, .2);
    const a = aplicar(e, f);
    f.custosPorCategoria.reverse();
    const b = aplicar(e, f);
    expect(a.evento).toEqual(b.evento);
    expect(a.grupos[0].total).toBe(.3);
  });
  it('não aplica vendido injetado, fechado, seleção duplicada e revisão vencida', () => {
    const e = evento(),
      f = ef();
    expect(prepararAplicacaoFinanceiro(e, f, {
      vendidos: {
        selecionado: true
      }
    }, {
      em
    }).ok).toBe(false);
    expect(aplicar({
      ...e,
      status: 'fechado'
    }, f).evento.status).toBe('fechado');
    const x = Object.entries(escolhas(e, f)).map(([propostaId, o]) => ({
      propostaId,
      ...o
    }));
    expect(prepararAplicacaoFinanceiro(e, f, [x[0], x[0]], {
      em
    }).ok).toBe(false);
    expect(prepararAplicacaoFinanceiro(e, f, escolhas(e, f), {
      em,
      assinatura: 'outra'
    }).ok).toBe(false);
  });
  it('legado começa vazio e exige destino explícito sem conservar escalar antigo', () => {
    const e = evento();
    e.categorias[0].itens[0].viaFinanceiro = {
      categoria: 'Equipe de evento',
      valor: 9000,
      em
    };
    const f = ef();
    delete f.planoRealizado;
    expect(montarPropostas(e, f).propostas.every(p => !p.selecionadaInicialmente)).toBe(true);
    const r = aplicar(e, f);
    expect(r.grupos[0].total).toBe(7400);
    expect(prepararAplicacaoFinanceiro(e, f, {
      [montarPropostas(e, f).propostas[1].id]: {
        selecionado: true
      }
    }, {
      em
    }).ok).toBe(false);
  });
  it('centavos e total inseguros não são gravados', () => {
    expect(aplicar(evento(), ef(Number.MAX_SAFE_INTEGER, 1)).ok).toBe(false);
  });
  it('bruto inválido preservado, censo informa, migração idempotente', () => {
    const e = evento();
    const bruto = {
      versao: 9,
      origens: [{}],
      valor: 5
    };
    e.categorias[0].itens[0].viaFinanceiro = bruto;
    const m = migrarEvento(e);
    expect(m.categorias[0].itens[0].viaFinanceiro).toEqual(bruto);
    expect(censoNormalizacoes([e]).some(c => c.campo === 'viaFinanceiro' && c.para.includes('preservado'))).toBe(true);
    expect(migrarEvento(m)).toEqual(m);
    expect(aplicar(e, ef()).ok).toBe(false);
  });
  it('recusa valor textual IDs tortos/repetidos e plano malformado; plano assinado é informativo', () => {
    const bruto = {
      eventos: [{
        evento_id: 71,
        nome: 'Festa',
        ingressos_aprovados: 1,
        receita_ingressos: 400,
        custos_total: 7400,
        custos_por_categoria: [{
          categoria_id: 10,
          categoria: 'Equipe',
          total: 5000
        }],
        plano_realizado: {
          receita: -1,
          custos: 2
        }
      }]
    };
    expect(validarEventosFinanceiro(bruto)[0].planoRealizado.receita).toBe(-1);
    expect(validarEventosFinanceiro(bruto)[0].custosPorCategoria[0].categoriaId).toBe(10);
    bruto.eventos[0].custos_por_categoria.push({
      ...bruto.eventos[0].custos_por_categoria[0]
    });
    expect(validarEventosFinanceiro(bruto)).toBe(null);
    bruto.eventos[0].custos_por_categoria.pop();
    bruto.eventos[0].receita_ingressos = 'ruim';
    expect(validarEventosFinanceiro(bruto)).toBe(null);
  });
  it('IDs diferentes de mesmo nome e festa diferente não casam', () => {
    const e = aplicar(evento(), ef()).evento;
    const f = ef();
    f.id = 72;
    expect(montarPropostas(e, f).propostas.filter(p => p.grupo === 'custos').every(p => !p.reconhecida)).toBe(true);
    const g = ef();
    g.custosPorCategoria[1].categoria = 'Equipe de evento';
    expect(new Set(montarPropostas(evento(), g).propostas.map(p => p.id)).size).toBe(3);
    expect(aplicar(evento(), g).ok).toBe(true);
  });
  it('move item entre categorias sem perder vínculo estável', () => {
    const e = aplicar(evento(), ef()).evento;
    const item = e.categorias[0].itens[0];
    e.categorias = [{
      id: 'equipe',
      nome: 'Equipe',
      itens: []
    }, {
      id: 'outra',
      nome: 'Outra',
      itens: [item]
    }];
    const f = ef(5200);
    const propostas = montarPropostas(e, f).propostas.filter(p => p.grupo === 'custos');
    const r = prepararAplicacaoFinanceiro(e, f, Object.fromEntries(propostas.map(p => [p.id, {
      selecionado: true,
      destino: p.destinoReconhecido
    }])), {
      em
    });
    expect(r.evento.categorias[1].itens[0]).toMatchObject({
      id: 'item',
      estimado: 8000,
      realizado: 7600
    });
  });
  it('adota identidade antes legada sem duplicar e preserva ID se retorno o perde', () => {
    const f = ef();
    f.custosPorCategoria = [{
      categoriaId: null,
      categoria: 'Equipe de evento',
      total: 5000
    }];
    const e = aplicar(evento(), f).evento;
    const g = ef(5200, null);
    const p = montarPropostas(e, g).propostas.find(p => p.grupo === 'custos');
    const origem = e.categorias[0].itens[0].viaFinanceiro.origens[0];
    const r = prepararAplicacaoFinanceiro(e, g, {
      [p.id]: {
        selecionado: true,
        destino: {
          tipo: 'existente',
          catId: 'equipe',
          itemId: 'item'
        },
        substituiOrigemLegada: JSON.stringify(['legado', 71, 'equipe de evento'])
      }
    }, {
      em
    });
    expect(r.ok).toBe(true);
    expect(r.grupos[0].total).toBe(5200);
    expect(r.grupos[0].origens).toHaveLength(1);
    const h = {
      ...g,
      custosPorCategoria: [{
        categoriaId: null,
        categoria: 'Nome novo sem ID',
        total: 5300
      }]
    };
    const hp = montarPropostas(r.evento, h).propostas.find(p => p.grupo === 'custos');
    const rr = prepararAplicacaoFinanceiro(r.evento, h, {
      [hp.id]: {
        selecionado: true,
        destino: {
          tipo: 'existente',
          catId: 'equipe',
          itemId: 'item'
        },
        substituiOrigemLegada: JSON.stringify(['id', 71, 10])
      }
    }, {
      em
    });
    expect(rr.ok).toBe(true);
    expect(rr.grupos[0].origens).toHaveLength(1);
    expect(rr.grupos[0].origens[0].categoriaId).toBe(10);
  });
  it('confirmação prende previsto atual manual e composição completa', () => {
    const e = aplicar(evento(), ef()).evento;
    e.categorias[0].itens[0].realizado = 7900;
    const f = ef(5200);
    const x = escolhas(e, f, 1);
    const r = prepararAplicacaoFinanceiro(e, f, x, {
      em,
      exigirConfirmacao: true
    });
    expect(r.ok).toBe(false);
    expect(r.grupos[0]).toMatchObject({
      antes: 7900,
      total: 7600,
      exigeConfirmacao: true
    });
    const confirmacoes = {
      [r.grupos[0].chave]: r.grupos[0].assinatura
    };
    expect(prepararAplicacaoFinanceiro(e, f, x, {
      em,
      exigirConfirmacao: true,
      confirmacoes
    }).ok).toBe(true);
    e.categorias[0].itens[0].estimado = 9000;
    expect(prepararAplicacaoFinanceiro(e, f, x, {
      em,
      exigirConfirmacao: true,
      confirmacoes
    }).ok).toBe(false);
  });
  it('recusa IDs repetidos entre destinos e item removido, confirmações não ficam válidas após seleção mudar', () => {
    const e = evento(),
      f = ef();
    const x = escolhas(e, f);
    const r = prepararAplicacaoFinanceiro(e, f, x, {
      em
    });
    const confirmacoes = {
      [r.grupos[0].chave]: r.grupos[0].assinatura
    };
    delete x[Object.keys(x)[1]];
    expect(prepararAplicacaoFinanceiro(e, f, x, {
      em,
      exigirConfirmacao: true,
      confirmacoes
    }).ok).toBe(false);
    e.categorias[0].itens = [];
    expect(prepararAplicacaoFinanceiro(e, f, x, {
      em
    }).ok).toBe(false);
    const a = aplicar(evento(), f).evento;
    a.categorias[0].itens.push({
      ...a.categorias[0].itens[0],
      id: 'outro'
    });
    expect(montarPropostas(a, f).avisos.join()).toMatch(/repetido/);
    expect(aplicar(a, f).ok).toBe(false);
  });
});

// O armazenamento e o envelope são reais; só o localStorage recebe mapa em memória.
import { vi } from 'vitest';
import { saveStore, loadStore, montarBackup, parseBackup } from './storage.js';
import { correcoesDaMigracao } from './revisaoRestauracao.js';
it('load/export/import preservam carimbo antigo, uma/múltiplas origens e bruto inválido com censo próprio', () => {
  const mapa = new Map();
  vi.stubGlobal('localStorage', {
    getItem: k => mapa.get(k) ?? null,
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: k => mapa.delete(k),
    key: i => [...mapa.keys()][i],
    get length() {
      return mapa.size;
    }
  });
  try {
    const base = migrarEvento(evento());
    const origem = {
      eventoId: 71,
      categoriaId: 10,
      categoria: 'Equipe',
      valor: 5000,
      em
    };
    const carimbos = [{
      categoria: 'Equipe',
      valor: 5000,
      em
    }, {
      versao: 2,
      valor: 5000,
      em,
      origens: [origem]
    }, {
      versao: 2,
      valor: 7400,
      em,
      origens: [origem, {
        ...origem,
        categoriaId: 20,
        categoria: 'Segurança',
        valor: 2400
      }]
    }, {
      versao: 2,
      valor: 5000,
      em,
      origens: [{
        ...origem,
        categoriaId: '10'
      }]
    }, {
      versao: 99,
      valor: 5000,
      em,
      origens: [origem]
    }, {
      versao: 2,
      valor: 10000,
      em,
      origens: [origem, origem]
    }];
    for (const [indice, viaFinanceiro] of carimbos.entries()) {
      const e = {
        ...base,
        categorias: base.categorias.map(c => ({
          ...c,
          itens: c.itens.map(i => ({
            ...i,
            realizado: viaFinanceiro.valor,
            viaFinanceiro
          }))
        }))
      };
      const store = {
        eventos: [e],
        benchmarksCustom: [],
        ajustes: {}
      };
      expect(saveStore(store).ok).toBe(true);
      const lido = loadStore();
      expect(lido.eventos[0].categorias[0].itens[0].viaFinanceiro).toEqual(viaFinanceiro);
      const backup = parseBackup(JSON.stringify(montarBackup(lido)));
      expect(backup.eventos[0].categorias[0].itens[0].viaFinanceiro).toEqual(viaFinanceiro);
      expect(migrarEvento(backup.eventos[0])).toEqual(backup.eventos[0]);
      if (indice >= 3) {
        const censos = correcoesDaMigracao(backup.eventos);
        expect(censos.some(c => c.campo === 'viaFinanceiro' && c.para === 'preservado, vínculo não utilizável' && c.explicacao.includes('permanece'))).toBe(true);
        expect(montarPropostas(backup.eventos[0], ef()).avisos.join()).toMatch(/preservado, não utilizável/);
      }
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

describe('revisão independente: contribuição efetiva e frações de centavo', () => {
  it.each([false,true])('recusa ID conhecido e alias que disputam a mesma contribuição (ordem inversa=%s)', inversa => {
    const f=ef(5000,null), e=aplicar(evento(),f).evento
    const recebido={...f,custosPorCategoria:[{categoriaId:10,categoria:'Equipe',total:5200},{categoriaId:null,categoria:'Segurança',total:2400}]}
    const propostas=montarPropostas(e,recebido).propostas.filter(p=>p.grupo==='custos')
    const x=propostas.map(p=>({propostaId:p.id,selecionado:true,destino:{tipo:'existente',catId:'equipe',itemId:'item'},...(p.origem.categoriaId===null?{substituiOrigemLegada:JSON.stringify(['id',71,10])}:{})}))
    const r=prepararAplicacaoFinanceiro(e,recebido,inversa?x.reverse():x,{em})
    expect(r.ok).toBe(false);expect(r.evento).toBe(e);expect(r.erros.join(' ')).toMatch(/mesma contribuição/)
  })
  it.each([false,true])('duas adoções não reivindicam a mesma origem antiga (ordem inversa=%s)',inversa=>{
    const f={...ef(),custosPorCategoria:[{categoriaId:null,categoria:'Antiga',total:5000}]},e=aplicar(evento(),f).evento
    const recebido=ef(),propostas=montarPropostas(e,recebido).propostas.filter(p=>p.grupo==='custos')
    const x=propostas.map(p=>({propostaId:p.id,selecionado:true,destino:{tipo:'existente',catId:'equipe',itemId:'item'},substituiOrigemLegada:JSON.stringify(['legado',71,'antiga'])}))
    const r=prepararAplicacaoFinanceiro(e,recebido,inversa?x.reverse():x,{em})
    expect(r.ok).toBe(false);expect(r.evento).toBe(e);expect(r.erros.join(' ')).toMatch(/mesma contribuição/)
  })
  it.each([1.005,1.015,1.025,0.001])('recusa fração de centavo %s no custo e bilheteria, sem aplicar parcela válida',valor=>{
    const e=evento(),f=ef(valor);const r=prepararAplicacaoFinanceiro(e,f,{...escolhas(e,f),bilheteria:{selecionado:true}},{em})
    expect(r.ok).toBe(false);expect(r.evento).toBe(e);expect(r.erros.join()).toMatch(/fração de centavo/)
    const g={...ef(),receitaIngressos:valor};const rr=prepararAplicacaoFinanceiro(e,g,{...escolhas(e,g),bilheteria:{selecionado:true}},{em})
    expect(rr.ok).toBe(false);expect(rr.evento).toBe(e)
    const bruto={eventos:[{evento_id:71,nome:'Festa',ingressos_aprovados:1,receita_ingressos:400,custos_total:7400,custos_por_categoria:[{categoria_id:10,categoria:'Equipe',total:valor}]}]}
    expect(validarEventosFinanceiro(bruto)).toBeNull()
  })
  it('centavos reais e ruído float de soma permanecem utilizáveis',()=>{
    for(const valor of [23567.96,0.1+0.2,Array.from({length:1000},()=>0.01).reduce((s,v)=>s+v,0)])expect(aplicar(evento(),ef(valor,null)).ok).toBe(true)
  })
  it('metadado antigo com fração permanece intacto e aparece no censo',()=>{
    const e=evento();const bruto={categoria:'Equipe',valor:1.005,em};e.categorias[0].itens[0].viaFinanceiro=bruto
    expect(migrarEvento(e).categorias[0].itens[0].viaFinanceiro).toEqual(bruto)
    expect(censoNormalizacoes([e]).some(c=>c.campo==='viaFinanceiro')).toBe(true)
  })
})

import { valorConsiderado, custosPorCategoria } from './calc.js'
it('S0 P4: previsto23567.96 é substituído pelo realizado, sem duplicar47135.92',()=>{
  const e=evento();e.categorias[0].itens[0].estimado=23567.96
  const f=ef(23567.96,null)
  const uma=aplicar(e,f)
  expect(uma.ok).toBe(true);expect(uma.evento.categorias[0].itens[0].estimado).toBe(23567.96)
  expect(valorConsiderado(uma.evento.categorias[0].itens[0])).toBe(23567.96)
  expect(custosPorCategoria(uma.evento.categorias).totalConsiderado).toBe(23567.96)
  const duas=aplicar(uma.evento,f);f.custosPorCategoria[0].categoria='Equipe renomeada'
  const renomeada=aplicar(duas.evento,f)
  expect(renomeada.evento.categorias[0].itens).toHaveLength(1)
  expect(renomeada.evento.categorias[0].itens[0].id).toBe('item')
  expect(custosPorCategoria(renomeada.evento.categorias).totalConsiderado).toBe(23567.96)
  expect(custosPorCategoria(renomeada.evento.categorias).totalConsiderado).not.toBe(47135.92)
})
