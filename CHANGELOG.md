# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [0.7.0] - 2026-11-15

### Added

- `/mi-cuenta` en la app Nuxt: Mis compras (con "Pagar (simulado)", plazo y cuenta regresiva), Mis pujas (agrupadas por subasta, "Vas ganando" o "Te superaron"), Mis cartas publicadas (estado, código de envío, lo que recibe el vendedor y "Cancelar publicación") y cambio de contraseña. Las anclas `#compras`, `#pujas`, `#publicaciones` y `#seguridad` bajan a su sección.
- `/publicar` en la app Nuxt: formulario con las mismas validaciones que el sitio actual, cálculo en vivo de comisión, lo que recibe el vendedor y "comprar ya" según `configuracion`, y pantalla de éxito con el código de envío. Desde el catálogo llegan juego, carta e imagen (solo `https://`).
- Botón "Subastar esta carta" en el detalle del catálogo, link "Publicar una carta" en `/subastas` y "Mi cuenta" en la barra con sesión.
- Pagar y cancelar piden confirmación dentro de la página (sin `confirm()`); doble clic no duplica el pago ni la publicación.
- `/mi-cuenta` y `/publicar` se arman solo en el navegador (`routeRules`) y, sin sesión, mandan a `/entrar?volver=…`.
- `useRpc()` para llamar funciones de Postgres con argumentos y lanzar su error.
- Pruebas de Vitest: cálculo y validación de la publicación, carta desde la URL (imágenes que no son `https` descartadas), `urlPublicar`, agrupación de pujas, resumen de publicaciones y rutas que piden sesión.

### Changed

- `PLAN.md` (sección 4.5), `AGENTS.md` y `README.md` describen Mi cuenta y publicar en la app Nuxt.

## [0.6.0] - 2026-11-15

### Added

- Subastas en la app Nuxt: `/subastas` (grilla con reloj, filtro por juego y búsqueda sin tildes) y `/subasta/<id>` (detalle, cifras, historial anónimo, pujar y "Comprar ya"). Se arman en el servidor (SSR), así que el HTML ya trae nombres, precios e historial; título y descripción por subasta para buscadores.
- Pujas en vivo con Supabase Realtime: el listado y el detalle se recargan solos (agrupando los eventos seguidos) cuando alguien puja, compra o una subasta cierra y vuelve en ronda 2. El canal se cierra al salir de la página.
- "Comprar ya" pide confirmación dentro de la página (sin `confirm()`). Pujar y comprar no se duplican con doble clic; los errores de la base (puja bajo la mínima, subasta cerrada, propia carta) se muestran y la página toma los datos nuevos.
- Una subasta que no existe o un id inválido responde 404, con página de error en español (`app/error.vue`).
- `/entrar?volver=<ruta>` vuelve a la subasta tras iniciar sesión; solo acepta rutas internas.
- Links Catálogo y Subastas en la barra.
- Pruebas de Vitest: formatos (CLP, fecha en hora de Chile, tiempo restante), validación del monto, filtro, id de la ruta, `rutaVolver` y la escucha de Realtime con un cliente simulado.

### Changed

- `PLAN.md` (sección 4.4), `AGENTS.md` y `README.md` describen las subastas de la app Nuxt.

## [0.5.0] - 2026-11-15

### Added

- Catálogo en la portada de la app Nuxt (`/`): pestañas Yu-Gi-Oh! / Pokémon / Mitos y Leyendas, búsqueda con espera de 350 ms, filtro por tipo, "Cargar más" de a 24 cartas ordenadas por ID, y detalle en `<dialog>` con zoom (Escape cierra solo el zoom) y traducción al español con MyMemory. Las cartas se cargan en el navegador.
- Mensajes para búsqueda sin resultados, API caída (con "Reintentar") y error al cargar más sin perder lo ya cargado.
- Pruebas de Vitest del catálogo con `fetch` simulado: normalización, URL, 400 de YGOPRODeck como "sin resultados", errores de red, fin de la lista, espera de la búsqueda, doble "Cargar más" y respuestas viejas descartadas.

### Changed

- A diferencia del sitio actual, cambiar de pestaña, filtro o búsqueda mientras carga ya no se pierde: gana la última consulta.
- `PLAN.md` (sección 4.3), `AGENTS.md` y `README.md` describen el catálogo de la app Nuxt.

## [0.4.0] - 2026-11-15

### Added

- Cuentas en la app Nuxt con `@nuxtjs/supabase` (sesión en cookies, así que el SSR ya trae el nombre en el nav): `/registro`, `/entrar`, salir y `/cambiar-password` para la contraseña temporal del primer login.
- Middleware global de cuenta: una cuenta bloqueada se queda sin sesión y ve el aviso en `/entrar`; con contraseña temporal solo puede ir a cambiarla; con sesión, `/entrar` y `/registro` vuelven al inicio.
- Barra de navegación con el nombre, la etiqueta "Admin" y el botón Salir. Formularios con validación en español y sin doble envío (`useEnvio`).
- Supabase CLI 2.122.0 (la misma versión que CI) como dependencia de desarrollo, para levantar Supabase local con `npx supabase start`.
- `compose.supabase-local.yaml` para probar la imagen contra el Supabase local.
- Pruebas de Vitest de validación de formularios y traducción de errores.
- Token de color `--error` (claro y oscuro) en `tema.css`.

### Changed

- La app Nuxt necesita `.env` con la URL y la publishable key de Supabase; `.env.example` trae la URL del Supabase local. `npm run web:dev` lee el `.env` de la raíz.
- `AGENTS.md`, `README.md` y `PLAN.md` describen las cuentas, el Supabase local y el avance de 1b. `.gitignore` excluye el estado local del CLI de Supabase.

## [0.3.0] - 2026-11-15

### Added

- App Nuxt 4 (Vue 3 + TypeScript estricto) en `web/`, como npm workspace, con página de inicio provisoria y selector de tema Sistema / Claro / Oscuro que se aplica en `<head>` antes de pintar (sin parpadeo con SSR). Convive con el sitio actual, que sigue en la raíz.
- ESLint (`@nuxt/eslint`), chequeo de tipos (`vue-tsc`) y pruebas con Vitest.
- `Dockerfile` (node:24-alpine fijado por digest, usuario sin privilegios), `compose.yaml` para probar en local en `http://localhost:3001` y `.env.example`.
- Jobs `web` (lint, tipos, pruebas y build con `npm ci`) e `imagen` (build de Docker) en el workflow `CI`.
- Dependabot para npm y para la imagen base de Docker.

### Changed

- `package.json` usa npm workspaces y `allowScripts` (se niega el `postinstall` de esbuild, que no hace falta).
- `AGENTS.md`, `README.md` y `PLAN.md` describen la app nueva, sus comandos y el avance del paso 1.

### Fixed

- Enlace de la versión 0.2.2 al pie de este archivo.

### Security

- Nuxt 4.6.4, que corrige GHSA-r99w-jh2x-3mg9 y GHSA-mjrq-cffv-q4qc. Quedan avisos bajos y moderados en dependencias transitivas de herramientas de build y desarrollo (glob, minimatch, deepmerge) sin versión corregida compatible; ninguna queda en `.output` (lo que corre en producción).

## [0.2.2] - 2026-11-15

### Added

- `package.json` con `engines` (Node 24+) y el script `npm run dev`.

### Changed

- `AGENTS.md` y `README.md`: el proyecto pasa a ser JavaScript con npm; se permiten dependencias y herramientas de desarrollo, no frameworks de UI ni bundlers sin pedirlo.
## [0.2.1] - 2026-11-15

### Changed

- `PLAN.md` pasa a describir la migración del frontend a Nuxt (Vue 3 + TypeScript, con SSR) y, después, el backend propio en un repo aparte (pagos reales, correos y fotos), con el diagnóstico del stack y las decisiones de stack (Postgres en Supabase gestionado, Flow, Resend, VPS). Solo documentación.

## [0.2.0] - 2026-11-15

### Added

- Mercado de subastas en consignación sobre Supabase: publicar una carta, recepción y aprobación por el admin, subasta de 3 días con pujas en vivo (Realtime), compra inmediata con recargo de 20%, anti-sniping, republicación automática con −10% (hasta el precio mínimo del vendedor), plazo de pago de 48 h con traspaso al siguiente postor, y liquidación 10% Cambalache / 90% vendedor.
- Páginas `subastas.html`, `subasta.html`, `publicar.html`, `mi-cuenta.html` y `admin.html` (recepción, ventas, devoluciones, reglas editables y mantenedor de usuarios).
- Esquema, reglas de negocio, RLS, Realtime y cierre automático con `pg_cron` en `supabase/migrations`, con pruebas pgTAP en `supabase/tests` y workflow `CI` que las corre.
- Admin master con contraseña temporal que se cambia obligatoriamente en el primer login.
- Botón "Subastar esta carta" en el catálogo y "Subastar" en el canasto.

### Changed

- Las cuentas pasan de `localStorage` a Supabase Auth (con confirmación de correo y contraseña de al menos 8 caracteres). Las cuentas locales anteriores dejan de usarse.
- El canasto queda solo para intercambios; las ventas se hacen por subasta.
- Términos, privacidad, "Acerca de", README y AGENTS describen el nuevo modelo; el aviso legal ya no dice "sin fines de lucro".

### Removed

- Venta directa con 20% de comisión desde el canasto.

## [0.1.0] - 2026-11-15

### Added

- Versión inicial: explorador de cartas de Yu-Gi-Oh!, Pokémon y Mitos y Leyendas con cuenta local y canasto de intercambio/venta (pagos y confirmación de la otra parte simulados).
- Selector de tema Sistema / Claro / Oscuro en todas las páginas (`assets/js/tema.js`, `assets/css/tema.css`), con un tema claro nuevo; el esquema anterior pasa a ser el oscuro.
- Archivos base del repo: `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `CHANGELOG.md` y `.gitignore`.
- CI: revisión de workflows (zizmor), búsqueda de secretos (gitleaks), Dependabot para las Actions, check de `CHANGELOG.md` en cada PR y etiqueta `vX.Y.Z` automática.

### Changed

- README reorganizado según Standard Readme (índice, `Instalación`, `Uso`, `Contribuir`, `Licencia`), con el mismo contenido.

### Fixed

- El texto del botón "Mi canasto" del nav ahora es blanco; la regla `.nav-links a` lo dejaba casi ilegible sobre el fondo morado.

### Security

- Font Awesome desde cdnjs con SRI (`integrity` + `crossorigin`).
- `dev-server.js` solo sirve archivos dentro de la carpeta del proyecto y responde 400 a rutas mal codificadas.

[0.7.0]: https://github.com/dannlebeau/cambalache/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/dannlebeau/cambalache/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/dannlebeau/cambalache/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/dannlebeau/cambalache/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/dannlebeau/cambalache/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/dannlebeau/cambalache/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/dannlebeau/cambalache/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/dannlebeau/cambalache/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dannlebeau/cambalache/releases/tag/v0.1.0
