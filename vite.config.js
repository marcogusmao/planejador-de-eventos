import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // .jsx entrou p/ os testes de render de componente (frente 17 do H3-AUDIT);
    // o environment global segue 'node' — cada teste de render declara jsdom no
    // topo (// @vitest-environment jsdom), sem tocar os ~1600 testes de lib.
    // servidor/ (Marco, 05/10/2026): o servidor do Railway que só serve o app a
    // quem entrou pela conta da casa. Os testes dele sobem um servidor de verdade
    // numa porta livre, como o Calendário faz.
    include: ['src/**/*.test.{js,jsx}', 'servidor/**/*.test.mjs'],
  },
})
