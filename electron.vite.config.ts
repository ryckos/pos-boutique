import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/** Alias communs : @shared (types et contrats partagés), @renderer (interface). */
const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer/src')
}

export default defineConfig({
  // xlsx est intégrée au code du principal : l'installateur n'embarque que `out/`.
  main: { plugins: [externalizeDepsPlugin({ exclude: ['xlsx'] })], resolve: { alias } },
  preload: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  renderer: {
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          client: resolve(__dirname, 'src/renderer/client.html')
        }
      }
    }
  }
})
