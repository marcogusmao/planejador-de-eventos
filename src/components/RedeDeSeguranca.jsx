// A REDE — limite de erro do React, a metade B da decisão do Marco de
// 26/07/2026 ("as duas coisas — recusar na porta E rede na tela").
//
// POR QUE ELA EXISTE. A porta nova em `storage.js` recusa o backup cujo
// `lotes`/`categorias`/`patrocinios` veio como conjunto no lugar de lista. Ela
// não faz NADA por quem já tem o dado ruim salvo — e essa era a situação: o
// Ajustes grava o store ANTES de renderizar, então o evento envenenado que
// passou pela porta antiga ficava no localStorage e a Home morria a cada
// abertura. Medido em 26/07/2026, antes desta rede: `grep -rn
// 'componentDidCatch\|getDerivedStateFromError' src/` voltava VAZIO, e o
// render do App estourava com
//
//     TypeError: object is not iterable (cannot read property
//     Symbol(Symbol.iterator))
//
// deixando a tela BRANCA. A cópia de segurança do princípio 7 não salvava
// ninguém, porque ela só se alcança DENTRO do app — e o app não abria.
//
// DUAS CAMADAS, de propósito:
//   • por FESTA (variante "card", na Home): a festa que não monta vira um card
//     que diz isso, e as outras seguem mostrando os números. É a camada que
//     preserva o cabeçalho da Home — logo os botões "Ajustes" e "Proteção de
//     dados" continuam onde estão.
//   • por TELA (variante "tela", no App): a última linha. Se a falha for fora
//     de um card, a tela inteira vira o painel — que traz os SEUS próprios
//     botões, porque nesse caso o cabeçalho da Home morreu junto.
//
// COMO A REDE SE DESARMA (o falso positivo que ela não pode causar): um limite
// de erro do React fica preso no estado de erro até alguém zerá-lo. Sem
// desarmar, a festa consertada continuaria mostrando "não consegui ler" para
// sempre. Daí a prop `chave`: quando ela MUDA, o painel sai e o conteúdo é
// tentado de novo. Na Home a chave é o próprio OBJETO do evento (o store é
// substituído por cópia a cada alteração, então restaurar um backup troca a
// referência); no App é a rota. A `chave` tem de ser ESTÁVEL entre renders —
// uma chave nova a cada render viraria laço infinito (zera → estoura → zera).
import { Component } from 'react'
import { Btn } from './ui.jsx'
import { AppIcon, TriangleAlert, Settings, ShieldCheck, RefreshCw } from './AppIcon.jsx'

// Frase que o Marco lê. Não afirma a CAUSA (a rede não sabe qual campo está
// fora de forma — ela só sabe que a montagem falhou) e não nega nada que não
// tenha sido verificado. O que ela afirma é o mecanismo: a falha aconteceu ao
// MONTAR a tela, não ao gravar; logo o que estava salvo continua salvo.
const O_QUE_ESTA_SALVO =
  'O que está salvo continua salvo: a falha aconteceu ao montar a tela, não ao gravar.'

function DetalheTecnico({ erro }) {
  const texto = (erro && (erro.message || String(erro))) || 'sem detalhe'
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-[var(--tinta-3)] hover:text-[var(--tinta-2)]">
        Ver o detalhe técnico (para colar num pedido de ajuda)
      </summary>
      <p className="mt-1 break-words font-mono text-[11px] leading-snug text-[var(--tinta-3)]">
        {texto}
      </p>
    </details>
  )
}

// Painel no LUGAR DO CARD de uma festa. Fica do tamanho de um card para a
// grade não se desmanchar, e nomeia a festa — sem o nome o Marco não sabe qual
// das quatro precisa de conserto.
function PainelDaFesta({ nome, erro, onProtecao, onAjustes }) {
  const nomeSeguro = typeof nome === 'string' && nome.trim() ? nome.trim() : '(festa sem nome)'
  return (
    <div className="flex flex-col rounded-xl border border-[rgba(180,145,0,0.45)] bg-[var(--tarja-alerta-fundo)] p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ambar-texto)]">
        <AppIcon icon={TriangleAlert} size={18} />
        Não consegui ler esta festa
      </h3>
      <p className="mt-1.5 text-sm font-medium text-[var(--tinta)]">{nomeSeguro}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--tinta-2)]">
        Os números desta festa não montaram na tela. As outras festas da lista continuam
        funcionando normalmente. {O_QUE_ESTA_SALVO}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--tinta-2)]">
        Para voltar a uma versão que abria: restaure uma cópia de segurança em{' '}
        <strong>Proteção de dados</strong>, ou importe um backup JSON em{' '}
        <strong>Ajustes › Backup</strong>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onProtecao && (
          <Btn onClick={onProtecao} className="text-xs">
            <AppIcon icon={ShieldCheck} /> Restaurar uma versão em Proteção de dados
          </Btn>
        )}
        {onAjustes && (
          <Btn onClick={onAjustes} className="text-xs">
            <AppIcon icon={Settings} /> Importar um backup em Ajustes
          </Btn>
        )}
      </div>
      <DetalheTecnico erro={erro} />
    </div>
  )
}

// Painel no LUGAR DE UM BLOCO da tela (um resumo, uma tabela) — mais quieto
// que os outros dois, porque o resto da tela em volta continua inteiro e
// vale mais que o aviso. Nomeia o bloco: "não montou" sem dizer O QUÊ manda o
// Marco procurar. Foi medido que este painel é necessário: com uma festa de
// `lotes` fora de forma, o resumo "Acurácia das previsões" percorre TODAS as
// festas (acuracia.js → computeCenario) e derrubava a Home inteira mesmo com
// cada card já protegido.
function PainelDoBloco({ nome, erro }) {
  const nomeSeguro = typeof nome === 'string' && nome.trim() ? nome.trim() : 'esta parte da tela'
  return (
    <div className="rounded-lg border border-[rgba(180,145,0,0.4)] bg-[var(--tarja-alerta-fundo)] px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--ambar-texto)]">
        <AppIcon icon={TriangleAlert} />
        Não consegui montar “{nomeSeguro}”
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--tinta-2)]">
        O resto desta tela continua funcionando. {O_QUE_ESTA_SALVO} Para voltar a uma versão que
        abria: <strong>Proteção de dados</strong> ou <strong>Ajustes › Backup</strong>.
      </p>
      <DetalheTecnico erro={erro} />
    </div>
  )
}

// Painel no LUGAR DA TELA INTEIRA — a última linha. Traz os próprios botões
// porque, quando ele aparece, o cabeçalho que teria os botões morreu junto.
function PainelDaTela({ erro, onAjustes, tentarDeNovo }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <AppIcon icon={TriangleAlert} size={40} className="text-[var(--ambar-texto)]" />
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Não consegui abrir esta tela</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--tinta-2)]">
          Alguma coisa no que está salvo impediu esta tela de montar. {O_QUE_ESTA_SALVO} Para voltar
          a uma versão que abria, importe um backup JSON em <strong>Ajustes › Backup</strong> — a
          lixeira e as versões automáticas ficam em <strong>Proteção de dados</strong>, na tela
          inicial.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onAjustes && (
          <Btn variant="primary" onClick={onAjustes}>
            <AppIcon icon={Settings} /> Abrir Ajustes para importar um backup
          </Btn>
        )}
        <Btn onClick={tentarDeNovo}>
          <AppIcon icon={RefreshCw} /> Tentar montar esta tela de novo
        </Btn>
      </div>
      <DetalheTecnico erro={erro} />
    </div>
  )
}

export default class RedeDeSeguranca extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
    this.tentarDeNovo = () => this.setState({ erro: null })
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  // Nada de rede, nada de arquivo: o app é offline por design e o detalhe do
  // erro já vai para a tela (e para o console do navegador, que o React
  // escreve por conta própria). Este gancho existe só para o React tratar a
  // falha como TRATADA, em vez de propagar para o topo.
  componentDidCatch() {}

  componentDidUpdate(prevProps) {
    if (this.state.erro != null && prevProps.chave !== this.props.chave) {
      this.setState({ erro: null })
    }
  }

  render() {
    const { erro } = this.state
    if (erro == null) return this.props.children
    if (this.props.variante === 'card') {
      return (
        <PainelDaFesta
          nome={this.props.nome}
          erro={erro}
          onProtecao={this.props.onProtecao}
          onAjustes={this.props.onAjustes}
        />
      )
    }
    if (this.props.variante === 'bloco') {
      return <PainelDoBloco nome={this.props.nome} erro={erro} />
    }
    return (
      <PainelDaTela erro={erro} onAjustes={this.props.onAjustes} tentarDeNovo={this.tentarDeNovo} />
    )
  }
}
