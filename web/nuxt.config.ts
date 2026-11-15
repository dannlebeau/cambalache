// Configuración de la app Nuxt de Cambalache (ver PLAN.md, paso 1).
// Nunca poner aquí la service_role key ni otro secreto: la URL y la publishable key llegan
// por NUXT_PUBLIC_SUPABASE_URL y NUXT_PUBLIC_SUPABASE_KEY (ver .env.example).
import { scriptTema } from './app/utils/tema'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxtjs/supabase'],
  css: ['~/assets/css/tema.css', '~/assets/css/base.css'],

  // Sesión en cookies para que el servidor sepa quién es en el SSR. Sin redirección
  // automática: el acceso lo decide app/middleware/cuenta.global.ts. Sin tipos generados de
  // la base por ahora (types: false).
  supabase: {
    redirect: false,
    types: false,
  },
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
