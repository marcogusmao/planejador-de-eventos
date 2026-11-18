// Revisão explícita; o recibo vem do evento observado nas props.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Btn, Modal } from './ui.jsx';
import { buscarEventosFinanceiro, montarPropostas, prepararAplicacaoFinanceiro, assinaturaFinanceiro, salvarVinculo, fmtDataHora } from '../lib/financeiro.js';
import { snapshotSeguranca } from '../lib/protecao.js';
import { agora } from '../lib/util.js';
import { novoItem } from '../lib/defaults.js';
import { fmtBRL2 as fmtBRL } from '../lib/format.js';
export default function FinanceiroModal({
  evento,
  store,
  update,
  onClose
}) {
  const [tela, setTela] = useState('buscando'),
    [erro, setErro] = useState(''),
    [lista, setLista] = useState([]),
    [ef, setEf] = useState(null);
  const [escolhas, setEscolhas] = useState({}),
    [confirmacoes, setConfirmacoes] = useState({}),
    [novosItens, setNovosItens] = useState({}),
    [pendente, setPendente] = useState(null),
    [resultado, setResultado] = useState(null);
  const buscou = useRef(false),
    trava = useRef(false);
  const assinatura = assinaturaFinanceiro(evento);
  const montagem = useMemo(() => ef ? montarPropostas(evento, ef) : {
    propostas: [],
    avisos: []
  }, [evento, ef]);
  const previa = useMemo(() => ef ? prepararAplicacaoFinanceiro(evento, ef, escolhas, {
    em: '2000-01-01T00:00:00Z',
    novosItens
  }) : null, [evento, ef, escolhas, novosItens]);
  const avisos = previa?.avisos || montagem.avisos;
  const iniciar = f => {
    setEf(f);
    setErro('');
    setConfirmacoes({});
    setNovosItens({});
    setEscolhas(Object.fromEntries(montarPropostas(evento, f).propostas.map(p => [p.id, {
      selecionado: p.selecionadaInicialmente,
      destino: p.destinoReconhecido
    }])));
    const recibo = update(e => salvarVinculo(e, f), `vincular ao evento “${f.nome}” do Financeiro`);
    if (recibo?.ok === false) setErro(recibo.motivo || 'Não foi possível salvar o vínculo.');
    setTela('revisar');
  };
  const buscar = async () => {
    setTela('buscando');
    setErro('');
    try {
      const dados = await buscarEventosFinanceiro();
      setLista(dados);
      const ligado = dados.find(f => f.id === evento.financeiro?.eventoId);
      if (ligado) iniciar(ligado);else {
        if (evento.financeiro?.eventoId) setErro('O evento vinculado não está mais no Financeiro — escolha o vínculo de novo.');
        setTela('escolher');
      }
    } catch (e) {
      setErro(e.message);
      setTela('erro');
    }
  };
  useEffect(() => {
    if (!buscou.current) {
      buscou.current = true;
      buscar();
    }
  }, []);
  useEffect(() => {
    if (!pendente) return;
    if (!store.eventos?.some(e => e.id === evento.id)) {
      trava.current = false;
      setPendente(null);
      setErro('Este evento foi removido durante a aplicação — nada foi confirmado.');
      setConfirmacoes({});
      return;
    }
    if (assinatura === pendente.esperada) {
      trava.current = false;
      setPendente(null);
      if (pendente.desfazer) {
        setResultado(null);
        setTela('revisar');
        setErro('Valores aplicados desfeitos.');
        setConfirmacoes({});
      } else {
        setResultado(pendente);
        setTela('aplicado');
      }
    } else if (assinatura !== pendente.base) {
      trava.current = false;
      setPendente(null);
      setErro('O evento mudou durante a aplicação — confira os valores e revise novamente.');
      setConfirmacoes({});
    }
  }, [assinatura, pendente, store.eventos, evento.id]);
  const alterar = (id, patch) => {
    setEscolhas(s => ({
      ...s,
      [id]: {
        ...s[id],
        ...patch
      }
    }));
    setConfirmacoes({});
    setErro('');
  };
  const escolherDestino = (p, valor) => {
    if (!valor) {
      alterar(p.id, {
        destino: null
      });
      return;
    }
    const destino = JSON.parse(valor);
    if (destino.tipo === 'novo' && !novosItens[destino.chaveGrupo]) {
      // Identidade preparada uma vez no handler; o updater só incorpora o valor.
      const item = novoItem({ servico: `${p.rotulo} (Financeiro)` });
      setNovosItens(s => s[destino.chaveGrupo] ? s : {
        ...s,
        [destino.chaveGrupo]: item
      });
    }
    alterar(p.id, {
      destino
    });
  };
  const aplicar = () => {
    if (trava.current || !ef) return;
    if (!store.eventos?.some(e => e.id === evento.id)) {
      setErro('Este evento foi removido — nada foi aplicado.');
      return;
    }
    const em = agora(),
      base = assinaturaFinanceiro(evento);
    const preparado = prepararAplicacaoFinanceiro(evento, ef, escolhas, {
      em,
      novosItens,
      exigirConfirmacao: true,
      confirmacoes
    });
    if (!preparado.ok) {
      setErro(preparado.erros.join(' '));
      return;
    }
    const seg = snapshotSeguranca(store, em, 'antes de aplicar dados do Financeiro');
    if (!seg.ok) {
      setErro('Não deu para guardar a cópia de segurança — NADA foi alterado. Exporte um backup JSON ou libere espaço em Proteção de dados e tente de novo.');
      return;
    }
    trava.current = true;
    const tentativa = {
      base,
      esperada: assinaturaFinanceiro(preparado.evento),
      anterior: evento,
      evento: preparado.evento,
      itens: preparado.aplicados,
      em
    };
    setPendente(tentativa);
    const recibo = update(e => e.status === 'fechado' || assinaturaFinanceiro(e) !== base ? e : preparado.evento, `aplicar ${preparado.aplicados.length} valores do Financeiro`);
    if (recibo?.ok === false) {
      trava.current = false;
      setPendente(null);
      setErro(recibo.motivo || 'A aplicação foi recusada — nada foi aplicado.');
    }
  };
  const desfazer = () => {
    if (trava.current || !resultado) return;
    const base = assinaturaFinanceiro(evento);
    if (base !== resultado.esperada || evento.status === 'fechado') {
      setErro('O evento foi editado ou fechado depois da aplicação. Use a versão anterior em Proteção de dados para recuperar sem sobrescrever esta edição.');
      return;
    }
    trava.current = true;
    setPendente({
      base,
      esperada: assinaturaFinanceiro(resultado.anterior),
      desfazer: true
    });
    const recibo = update(e => e.status === 'fechado' || assinaturaFinanceiro(e) !== base ? e : resultado.anterior, 'desfazer valores aplicados do Financeiro');
    if (recibo?.ok === false) {
      trava.current = false;
      setPendente(null);
      setErro(recibo.motivo || 'Não foi possível desfazer. Use Proteção de dados.');
    }
  };
  if (tela === 'buscando') return <Modal title="Buscar dados do Financeiro" onClose={onClose}><p role="status">Consultando o Financeiro local (localhost:8777)… Esta etapa só lê — nada é alterado.</p></Modal>;
  if (tela === 'erro') return <Modal title="Buscar dados do Financeiro" onClose={onClose}><p role="alert">{erro}</p><div className="mt-4 flex flex-wrap justify-end gap-2"><Btn onClick={onClose}>Fechar sem buscar</Btn><Btn variant="primary" onClick={buscar}>Tentar buscar de novo</Btn></div></Modal>;
  if (tela === 'escolher') return <Modal title="Vincular ao evento do Financeiro" onClose={onClose} wide><div className="space-y-4">{erro && <p role="alert">{erro}</p>}<p>Escolha qual evento do Financeiro corresponde a “{evento.nome}”. O vínculo fica guardado para as próximas buscas; os valores serão revisados depois.</p>{lista.length === 0 && <p>O Financeiro está aberto, mas não tem nenhum evento cadastrado.</p>}<ul className="divide-y divide-[var(--borda)]">{lista.map(f => <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{f.nome} · {f.empresa} · {fmtBRL(f.receitaIngressos)} de ingressos · {fmtBRL(f.custosTotal)} de custos</span><Btn onClick={() => iniciar(f)}>Vincular e revisar valores</Btn></li>)}</ul><Btn onClick={onClose}>Cancelar — não altera valores</Btn></div></Modal>;
  if (tela === 'aplicado' && resultado) return <Modal title="Valores aplicados" onClose={onClose}><div className="space-y-4"><p role="status">{resultado.itens.length} {resultado.itens.length === 1 ? 'valor aplicado' : 'valores aplicados'} em “{evento.nome}”, via Financeiro em {fmtDataHora(resultado.em)}.</p><ul>{resultado.itens.map(p => <li key={p.id}>{p.rotulo}: <span className="tnum">{fmtBRL(p.novo)}</span></li>)}</ul><p>Para recuperar a cópia de segurança: Início → Proteção de dados → Versões automáticas → “antes de aplicar dados do Financeiro”. Os campos continuam editáveis à mão.</p>{erro && <p role="alert">{erro}</p>}<div className="flex flex-wrap justify-end gap-2"><Btn disabled={!!pendente} onClick={desfazer}>Desfazer valores aplicados</Btn><Btn variant="primary" onClick={onClose}>Fechar</Btn></div></div></Modal>;
  const selecionadas = Object.values(escolhas).filter(e => e.selecionado).length;
  const grupos = previa?.grupos || [];
  const bilheteriaSelecionada = !!escolhas.bilheteria?.selecionado;
  const efeitoSelecionado = grupos.length
    ? ` em ${grupos.length} ${grupos.length === 1 ? 'item de custo' : 'itens de custo'}${bilheteriaSelecionada ? ' e na bilheteria' : ''}`
    : ' (bilheteria)';
  const confirmado = grupos.every(g => !g.exigeConfirmacao || confirmacoes[g.chave] === g.assinatura);
  return <Modal title="Revisar dados do Financeiro" onClose={onClose} wide><div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><span>Vinculado a: <b>{ef?.nome}</b> · {ef?.empresa}</span><Btn variant="ghost" onClick={() => setTela('escolher')}>Trocar vínculo</Btn></div>
    <p className="text-sm">Vínculo salvo; cancelar não altera os valores. Marque o que deve entrar, escolha o destino e confirme o efeito. Antes de aplicar, o app guarda uma cópia de segurança.</p>
    <p className="text-sm">{ef?.ingressosAprovados} {ef?.ingressosAprovados === 1 ? 'pagamento aprovado' : 'pagamentos aprovados'}; este número não informa quantos ingressos foram vendidos.</p>
    {ef?.planoRealizado && <p className="text-sm">Plano já excluído nesta resposta: receita {fmtBRL(ef.planoRealizado.receita)}; custos {fmtBRL(ef.planoRealizado.custos)}. Estes valores não serão descontados novamente.</p>}
    {avisos.length > 0 && <div className="space-y-1 rounded-lg bg-[var(--papel-2)] p-3 text-sm">{avisos.map((a, i) => <p key={i}>{a}</p>)}</div>}
    <ul className="divide-y divide-[var(--borda)]">{montagem.propostas.map(p => <li key={p.id} className="space-y-2 py-3">
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`Selecionar ${p.rotulo}`} checked={!!escolhas[p.id]?.selecionado} onChange={e => alterar(p.id, {
              selecionado: e.target.checked
            })} /><span className="font-medium">{p.rotulo}</span></label>
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Contribuição anterior: <span className="tnum">{p.atual == null ? '—' : fmtBRL(p.atual)}</span></span><span>Do Financeiro: <b className="tnum">{fmtBRL(p.novo)}</b></span></div>
      {p.grupo === 'custos' && <label className="block text-sm">Destino de {p.rotulo}<select className="mt-1 min-h-11 w-full max-w-full rounded border border-[var(--borda)] bg-[var(--papel)] p-2 text-base" aria-label={`Destino de ${p.rotulo}`} value={escolhas[p.id]?.destino ? JSON.stringify(escolhas[p.id].destino) : ''} onChange={e => escolherDestino(p, e.target.value)}><option value="">Escolha o item a atualizar</option>{p.candidatos.map(c => <option key={JSON.stringify([c.catId, c.item.id])} value={JSON.stringify({
                tipo: 'existente',
                catId: c.catId,
                itemId: c.item.id
              })}>{c.item.servico || '(sem nome)'} · {c.catNome} · previsto {fmtBRL(c.item.estimado || 0)}</option>)}{(evento.categorias || []).map(c => <option key={`novo:${c.id}`} value={JSON.stringify({
                tipo: 'novo',
                catId: c.id,
                chaveGrupo: p.id
              })}>Criar novo item em {c.nome}</option>)}{Object.entries(escolhas).filter(([id, e]) => id !== p.id && e.destino?.tipo === 'novo').map(([id, e]) => <option key={`grupo:${id}`} value={JSON.stringify(e.destino)}>Criar junto com {montagem.propostas.find(x => x.id === id)?.rotulo} no mesmo item novo</option>)}</select></label>}
      {p.grupo === 'custos' && !p.reconhecida && p.origensAnteriores.length > 0 && <label className="block text-sm">Reconhecer origem anterior de {p.rotulo}<select className="mt-1 min-h-11 w-full rounded border border-[var(--borda)] bg-[var(--papel)] p-2 text-base" aria-label={`Reconhecer origem anterior de ${p.rotulo}`} value={escolhas[p.id]?.substituiOrigemLegada || ''} onChange={e => {
              const o = p.origensAnteriores.find(o => o.chave === e.target.value);
              alterar(p.id, {
                substituiOrigemLegada: o?.chave || null,
                ...(o ? {
                  destino: {
                    tipo: 'existente',
                    catId: o.catId,
                    itemId: o.itemId
                  }
                } : {})
              });
            }}><option value="">É uma nova origem — não substituir contribuição anterior</option>{p.origensAnteriores.filter(o => o.categoriaId === null || p.origem.categoriaId === null).map(o => <option key={o.chave} value={o.chave}>Reconhecer como a origem antes {o.categoriaId === null ? 'sem identificador' : `com identificador ${o.categoriaId}`}: {o.categoria} · {fmtBRL(o.valor)}</option>)}</select></label>}
    </li>)}</ul>
    {!montagem.propostas.length && <p>Nada para aplicar — não há valores utilizáveis; confira os avisos acima.</p>}
    {grupos.map(g => <section key={g.chave} className="space-y-2 border-t border-[var(--borda)] pt-3"><h3 className="font-semibold">Efeito em {g.item.servico}</h3><p className="text-sm">{g.propostas.map(p => `${p.rotulo} ${fmtBRL(p.novo)}`).join(' + ')} atualizarão este item para <b className="tnum">{fmtBRL(g.total)}</b>; previsto <span className="tnum">{fmtBRL(g.previsto)}</span> será mantido. Valor considerado atual: <span className="tnum">{fmtBRL(g.antes)}</span>.</p>{g.mantidas.map(o => <p key={JSON.stringify(o)} className="text-sm">{o.categoria}: <span className="tnum">{fmtBRL(o.valor)}</span> mantidos.</p>)}{g.exigeConfirmacao && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`Confirmar total de ${g.item.servico}`} checked={confirmacoes[g.chave] === g.assinatura} onChange={e => setConfirmacoes(s => ({
            ...s,
            [g.chave]: e.target.checked ? g.assinatura : null
          }))} /><span>Confirmar total de {g.item.servico}: {fmtBRL(g.total)}</span></label>}</section>)}
    {previa?.erros.filter(motivo => motivo !== 'Nada selecionado para aplicar.').map((motivo, indice) => <p key={indice} role="status" className="rounded-lg bg-[var(--papel-2)] p-3 text-sm">{motivo}</p>)}
    {erro && <p role="alert" className="rounded-lg bg-[var(--tarja-alerta-fundo)] p-3 text-sm text-[var(--vermelho-texto)]">{erro}</p>}{pendente && <p role="status">Aguardando confirmação dos valores no evento…</p>}
    <div className="flex flex-wrap justify-end gap-2"><Btn onClick={onClose}>Cancelar — não altera valores</Btn><Btn variant="primary" disabled={!selecionadas || !previa?.ok || !confirmado || !!pendente} onClick={aplicar}>{selecionadas ? `Aplicar ${selecionadas} ${selecionadas === 1 ? 'valor selecionado' : 'valores selecionados'}${efeitoSelecionado}` : 'Nada selecionado para aplicar'}</Btn></div>
  </div></Modal>;
}
