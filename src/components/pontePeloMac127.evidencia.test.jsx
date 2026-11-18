// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://127.0.0.1:4173/"}
//
// O APP DO MAC CONTINUA IGUAL também por 127.0.0.1 (revisão do PR #100,
// 05/10/2026): `origemNaNuvem` só vale para `https://` fora do próprio
// computador, então http://127.0.0.1:4173 tem de se comportar exatamente como
// http://localhost:4173. As conferências são as mesmas (ponteNaTela.casos.jsx).
import { describe, it, expect } from 'vitest'
import { prepararAmbiente, conferirHomePedeToken, conferirAjustesComToken, conferirSeisBotoesLigados } from './ponteNaTela.casos.jsx'

const ambiente = prepararAmbiente()

describe('no app do Mac (http://127.0.0.1:4173), a ponte se comporta como antes', () => {
  it('o jsdom deste arquivo está mesmo nessa origem', () => {
    expect(window.location.origin).toBe('http://127.0.0.1:4173')
  })

  it('Home sem token: a faixa pede o token, como sempre — e nada do aviso da nuvem', async () => {
    await conferirHomePedeToken(ambiente.rede)
  })

  it('Ajustes › Backup: a frase do envio diário, o campo e o botão do token, como antes', () => {
    conferirAjustesComToken()
  })

  it('os SEIS botões da ponte continuam LIGADOS, com os títulos de antes', () => {
    conferirSeisBotoesLigados()
  })
})
