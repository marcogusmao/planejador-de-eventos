// Provas diagnósticas da S0. Fora da suíte normal: ainda esperam os consertos.
// Cada asserção pede o comportamento correto; vermelho documenta a reprodução.
// Uso: npx vitest run --config scripts/provas-s0/vitest.config.mjs [arquivo]
import configuracao from '../../vite.config.js'

export default {
  ...configuracao,
  test: {
    ...configuracao.test,
    include: ['scripts/provas-s0/*.test.{js,jsx}'],
    maxWorkers: 2,
    minWorkers: 1,
  },
}
