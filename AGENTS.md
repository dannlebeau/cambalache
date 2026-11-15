# AGENTS.md

Guía para agentes que trabajen en este repositorio. Todo el proyecto (código, comentarios, docs y UI) está en **español**: nombres de variables, funciones, endpoints, tests y mensajes se escriben en español.

## Reglas comunes

Las reglas que valen para todos los repos viven en el repo **`dotfiles`** (`dotfiles/AGENTS.md`). Este archivo solo agrega lo específico del proyecto; si algo choca, manda el de este repo.

## Qué es

Mercado de cartas TCG (Yu-Gi-Oh!, Pokémon, Mitos y Leyendas) con subastas en consignación de 3 días (10% Cambalache, 90% vendedor) e intercambios carta por carta aparte.

Reglas de arquitectura:

- Frontend en migración (ver `PLAN.md`, paso 1): el sitio actual es estático (HTML + JS vanilla, sin build) en la raíz; la app nueva es **Nuxt (Vue 3 + TypeScript, SSR)** en `web/`, y reemplaza al sitio página por página. Backend en **Supabase** (Auth, Postgres, Realtime, `pg_cron`).
- **Toda regla de negocio vive en Postgres** (`supabase/migrations`): funciones `security definer` con `set search_path = ''` y nombres calificados, más RLS de solo lectura. El navegador nunca escribe tablas directo, solo llama funciones (RPC). Una regla nueva va en una migración nueva con su prueba pgTAP, no en JS.
- El **pago es simulado** (`simular_pago`) y la UI debe decirlo donde se paga ("Pagar (simulado)", avisos "Pagos en modo prueba", `terminos.html`, `acerca-de.html`).
- El canasto, los intercambios y sus puntos siguen en `localStorage`, simulados.

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `*.html` | Páginas. Las originales (`index`, `canasto`, textos) tienen CSS inline; las del mercado usan `assets/css/base.css` |
| `assets/js/` | `auth.js` (cliente Supabase y cuentas), `mercado.js` (ayudas del mercado), `shared.js` (formatos, canasto), `config.js` (URL y publishable key) y un archivo por página |
| `assets/css/` | `tema.css` (tokens claro/oscuro), `base.css` (páginas del mercado) |
| `supabase/migrations/` | Esquema, funciones, RLS, Realtime y `pg_cron` |
| `supabase/tests/` | Pruebas pgTAP |
| `dev-server.js` | Servidor estático local del sitio actual (Node, sin dependencias) |
| `web/` | App Nuxt nueva: `app/` (páginas, componentes, composables, utils, CSS) y `test/` (Vitest) |
| `Dockerfile`, `compose.yaml`, `.env.example` | Imagen de la app Nuxt y prueba local en contenedor |

## Comandos

```sh
node dev-server.js   # sitio actual: http://localhost:3000
npm ci               # dependencias (lockfile congelado)
npm run web:dev      # app Nuxt en desarrollo: http://localhost:3001
npm run web:lint && npm run web:typecheck && npm run web:test
docker compose up --build   # app Nuxt como en producción: http://localhost:3001
docker compose -f compose.yaml -f compose.supabase-local.yaml up --build   # igual, contra el Supabase local
npx supabase start   # Supabase local (Auth + Postgres) con migraciones (Docker); CLI en devDependencies, misma versión que CI
npx supabase test db # pruebas pgTAP
```

## Convenciones de código

- **Sitio actual (raíz):** JS vanilla en scripts clásicos (`<script src>`), sin módulos ni build. `supabase-js` viene de jsDelivr con versión exacta y SRI.
- Todo dato que venga de una API, de la base o del usuario se escribe con `escapeHtml` o `textContent`, nunca directo en `innerHTML`.
- Los errores de las funciones de la base se escriben en español con `raise exception`; la UI los muestra tal cual vía `mensajeError` (`auth.js`).
- Botones que envían algo usan `conBoton` (`mercado.js`) para evitar el doble envío.
- El proyecto es JavaScript con `package.json` y npm workspaces (`web`). Versiones exactas en `package.json` y lockfile versionado; `allowScripts` en la raíz decide qué paquetes corren scripts de instalación. No agregar otros frameworks de UI sin pedirlo.
- **App Nuxt (`web/`):** TypeScript estricto; prohibido `v-html` con datos de la API, de la base o del usuario; configuración pública por `NUXT_PUBLIC_*` (ver `.env.example`); la cuenta se lee con `useCuenta()` y el acceso por rol o estado se decide en `app/middleware/cuenta.global.ts`; formularios que envían usan `useEnvio()` (evita el doble envío y traduce el error con `mensajeError`); el catálogo de la portada usa `useCatalogo()` (en el navegador, descarta respuestas de consultas viejas) sobre `app/utils/catalogo.ts`, con `fetch` inyectable para probarlo sin red; las subastas se leen en el servidor con `useAsyncData` (vista `subastas_publicas`, `historial_pujas`) y en el navegador se recargan con `useSubastasEnVivo()` (Realtime agrupado, canal cerrado al salir), con la lógica pura en `app/utils/subastas.ts`; lo que depende de la hora se pinta con zona `America/Santiago` en el servidor y el reloj (`RelojSubasta`) solo en el navegador, para no romper la hidratación; `?volver=` de `/entrar` solo acepta rutas internas (`rutaVolver`); las páginas privadas (`/mi-cuenta`, `/publicar`) van sin SSR en `routeRules` y en `RUTAS_CON_SESION` (el middleware manda a `/entrar?volver=`), llaman funciones de Postgres con `useRpc()` y su lógica pura vive en `app/utils/mercado.ts`; las confirmaciones van dentro de la página, nunca `confirm()`; todo cambio pasa lint, `typecheck`, Vitest y se prueba con `docker compose up --build`.
- Colores como tokens CSS en `assets/css/tema.css` (y su copia en `web/app/assets/css/tema.css` mientras convivan), con su versión oscura (ver selector de tema en `dotfiles/AGENTS.md` → Webs).

## Datos sensibles a cambios

- Las reglas de la subasta (10% comisión, 20% recargo, −10% al republicar, 72 h, 48 h de pago, incrementos, anti-sniping) son los valores por defecto de `configuracion` en la migración y se editan en Admin → Reglas. Los textos de `terminos.html`, `acerca-de.html` y `README.md` los repiten: si cambian los valores por defecto, actualizar esos textos en el mismo cambio.
- La tarifa de intercambio ($500 CLP por carta) está en `assets/js/shared.js` (`COSTO_POR_CARTA_INTERCAMBIO`) y en los mismos textos.
- Nunca poner la `service_role` key ni otro secreto en `assets/js/config.js` ni en el repo.
- `assets/js/myl-data.js` (y su copia `web/app/utils/myl.ts`) es un catálogo de ejemplo sin texto copiado de cartas reales; no agregar contenido con derechos.

## Flujo de trabajo

- Lo común (rama antes de tocar, commits, push, PR, CHANGELOG y versión) está en `dotfiles/AGENTS.md`; no lo repitas aquí.
