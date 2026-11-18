// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://localhost:4173/"}
//
// O APP DO MAC CONTINUA IGUAL (tela no Railway, decisão do Marco de 05/10/2026).
// Irmão de pontePelaNuvem.evidencia.test.jsx: aquele roda o jsdom na origem da
// nuvem; este roda na origem que o "Iniciar Previsão.command" abre
// (ORIGEM_PONTE). As conferências moram em ponteNaTela.casos.jsx e valem também em
// http://127.0.0.1:4173 (pontePeloMac127.evidencia.test.jsx).
import { describe, it, expect } from 'vitest'
import { prepararAmbiente, conferirHomePedeToken, conferirAjustesComToken, conferirSeisBotoesLigados } from './ponteNaTela.casos.jsx'

const ambiente = prepararAmbiente()

describe('no app do Mac (http://localhost:4173), a ponte se comporta como antes', () => {
  it('o jsdom deste arquivo está mesmo nessa origem', () => {
    expect(window.location.origin).toBe('http://localhost:4173')
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
