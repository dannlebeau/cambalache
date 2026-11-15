// Configuración de la app Nuxt de Cambalache (ver PLAN.md, paso 1).
// El módulo de Supabase se agrega en el sub-paso 1b (autenticación). Nunca poner aquí la
// service_role key ni otro secreto.
import { scriptTema } from './app/utils/tema'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/tema.css'],
  // 3001 para no chocar con el sitio actual (dev-server.js usa 3000) hasta el sub-paso 1h.
  devServer: { port: 3001 },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Cambalache',
      meta: [
        { name: 'description', content: 'Cambalache: mercado de cartas TCG con subastas en consignación e intercambios.' },
      ],
      // Aplica el tema guardado antes de pintar, para que el HTML del servidor no parpadee.
      script: [{ innerHTML: scriptTema, tagPosition: 'head' }],
    },
  },


  typescript: {
    strict: true,
  },
})
