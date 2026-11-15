import { defineConfig } from 'vitest/config'

// Pruebas unitarias de funciones puras (sin levantar Nuxt). Cuando haya componentes que
// probar se agrega el entorno "nuxt" de @nuxt/test-utils.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
