# PLAN — Frontend en Nuxt y, después, backend propio (pagos reales, correos y fotos)

> Estado: **decisiones técnicas tomadas (2026-11-15). Foco actual: solo el frontend (paso 1). Avance: 1a hecho (PR #6); 1b hecho (PR #9, pasos en la sección 4.2); 1c hecho (PR #10, pasos en la sección 4.3); 1d hecho (PR #11, pasos en la sección 4.4); 1e hecho (rama `feat/nuxt-cuenta-publicar`, pasos en la sección 4.5); siguiente, 1f (panel de admin). El backend (pasos 2 a 6) queda planificado pero no se empieza hasta cerrar el paso 1.** Quedan pendientes los temas legales/tributarios antes de cobrar de verdad. Reemplaza al plan del mercado de subastas (ya mezclado en `main`, ver `CHANGELOG.md` 0.2.0).

## 1. Objetivo

1. **Ahora:** reescribir el frontend en **Nuxt (Vue 3 + TypeScript)**, con las páginas públicas de subastas renderizadas en el servidor (SEO) y el panel de admin, la cuenta, las pujas en vivo y los formularios en el navegador.
2. **Después:** pasar de pagos simulados a reales, con correos transaccionales y fotos reales subidas por el vendedor, sin perder las garantías actuales (reglas atómicas en la base, pruebas, RLS).

## 2. Stack actual de JS (diagnóstico)

| Aspecto | Hoy |
|---|---|
| Lenguaje | JS vanilla ES2020+ (`async/await`, `?.`, `??`, `catch {}` sin variable, arrow functions). Sin TypeScript |
| Módulos | Ninguno: scripts clásicos con globales (`<script src>`); el orden de carga en cada HTML es una dependencia implícita |
| Build / paquetes | Ninguno: no hay `package.json`, lockfile, linter, formateador ni tipos |
| Dependencias | `supabase-js@2.118.0` por CDN con SRI; Font Awesome por CDN |
| Node | Solo `dev-server.js` (CommonJS, sin dependencias). Sin versión fijada; en local corre v26.13.1 |

Decisión: no se modernizan los scripts clásicos (ES modules, JSDoc) porque se reescribirían dos veces. El frontend se migra directamente a **Nuxt**. El backend nuevo también va en **TypeScript**. `package.json` y la regla de npm en `AGENTS.md` ya se resolvieron en el PR #5.

## 3. Decisión de base de datos (decidida: Postgres en Supabase)

**Recomendación: quedarse en Postgres. No migrar a MongoDB Atlas.**

- El dominio es transaccional y relacional: pujas, saldos, comisión, estados y liquidaciones. Necesita transacciones multi-fila, `FOR UPDATE` en pujas simultáneas, restricciones e integridad referencial. Postgres lo da de fábrica; Mongo soporta transacciones, pero con más costo y sin restricciones declarativas.
- Se perdería lo ya construido y probado: ~800 líneas de reglas en SQL, RLS, `pg_cron`, Realtime y 202 líneas de pruebas pgTAP. Habría que reescribirlo todo en código de aplicación y volver a probarlo.
- Supabase **no se queda corto** por tener pagos o correos: eso va en el backend propio. Supabase sigue siendo Postgres + Auth + Storage + Realtime. Si algún día pesa, Postgres es portable (Neon, RDS, un VPS) sin reescribir el modelo.
- Mongo sería razonable solo para datos sin esquema fijo (catálogo de cartas cacheado, logs de eventos). Hoy eso no es un problema.

Opciones a elegir:

1. **Postgres en Supabase + backend propio al lado** (recomendada): el navegador sigue llamando RPC para lo ya hecho; el backend maneja pagos, correos y fotos, y usa la `service_role` solo en el servidor.
2. Postgres propio (Neon/RDS) y se quita Supabase: más trabajo (Auth, Realtime y Storage a mano) sin beneficio claro hoy.
3. MongoDB Atlas: **no recomendada**; implica reescribir todo el modelo y las pruebas.

## 4. Pasos (suponiendo la opción 1)

Cada paso termina en su propia rama + PR, con CHANGELOG y verificación en CI.

### 4.1 Repos

El repo aparte para la API **no es técnicamente obligatorio** (un monorepo también serviría), pero se decide separarlo por:
- **Secretos aislados:** la `service_role`, las claves de Flow y de Resend viven solo en el repo de la API; el repo del frontend nunca los ve.
- **Ciclos de despliegue y CI distintos:** un cambio de UI no despliega el servicio que mueve dinero, y viceversa.
- **Permisos y revisión más estrictos** para el código de pagos.

Costo: hay que mantener el contrato entre ambos. La API publica un **OpenAPI** generado desde sus esquemas de Fastify y el frontend genera sus tipos a partir de él.

| Repo | Contenido |
|---|---|
| `cambalache` (este) | Frontend Nuxt, `supabase/` (migraciones y pruebas pgTAP) y documentación |
| `cambalache-api` (nuevo, privado, se crea en el paso 2) | Backend Fastify + TypeScript, imagen en GHCR |

Las migraciones y pruebas pgTAP se quedan en `cambalache` mientras el backend no exista; al llegar el paso 3 se decide si se mueven o se mantienen aquí.

### Paso 0 — Decisiones del usuario
- **Decididas:**
  - Base de datos: Postgres en **Supabase gestionado** (no MongoDB, no self-hosted por ahora; revisar self-hosted solo si el costo de Supabase se vuelve el problema, con respaldos externos y restauración ensayada).
  - Pagos: **Flow** (cotizar comisiones y requisitos de alta antes de integrar).
  - Correo: **Resend** (cambiable a Amazon SES después, porque la cola es propia).
  - Backend: **TypeScript sobre Node LTS con Fastify**, en un **VPS Hostinger KVM2** con Docker Compose, Caddy y Cloudflare delante; imagen en GHCR desplegada por SHA. Solo corre la API: la base no va en el VPS.
  - Frontend: **Nuxt (Vue 3 + TypeScript) con SSR** en el mismo VPS (proceso de Node tras Caddy), no en Cloudflare Pages estático. Rutas públicas de subastas con SSR; admin, cuenta y publicar solo en el navegador (`routeRules`).
  - Repos: el **backend vive en un repo aparte** (ver sección 4.1).
- **Pendientes del usuario:** los temas legales de abajo.
- Aspectos legales y tributarios en Chile: cobrar por cuenta de terceros (consignación), boleta/factura electrónica en el SII, retención del 90% al vendedor, términos y privacidad. **Consultar a un contador/abogado antes de cobrar de verdad.** Este plan no los resuelve.
- Demostración: decisiones anotadas en este archivo.

### Paso 1 — Frontend en Nuxt (Vue 3 + TypeScript)

Foco actual. La app nueva vive en `web/` y **el sitio estático actual sigue funcionando en la raíz** hasta el último sub-paso, así que el sitio nunca queda roto entre PR. Cada sub-paso es su propia rama + PR. Reglas que valen para todos:
- Vue escapa por defecto: **prohibido `v-html`** con datos de la API, de la base o del usuario.
- Los avisos de pago simulado ("Pagar (simulado)", "Pagos en modo prueba") se conservan donde se paga.
- Selector de tema Sistema / Claro / Oscuro desde el inicio (script en `<head>` antes de pintar, sin parpadeo con SSR).
- Configuración pública (URL y publishable key de Supabase) por variables de entorno (`runtimeConfig`) con `.env.example`; nunca la `service_role`.
- Todo se prueba en local con `Dockerfile` y `compose` versionados (regla común de pruebas locales), con datos de prueba.
- CI: instalar con el lockfile congelado, lint (ESLint), `vue-tsc`, pruebas unitarias (Vitest) y las pruebas pgTAP existentes; Actions fijadas por SHA.

| Sub-paso | Qué | Demostración |
|---|---|---|
| 1a | Esqueleto: Nuxt + TS en `web/`, ESLint, `vue-tsc`, Vitest, `Dockerfile`, `compose`, CI y tema claro/oscuro. Módulo de Supabase y página de inicio vacía | `docker compose up` sirve la app; CI en verde; el tema persiste al recargar |
| 1b | Layout, navegación y **autenticación** (registro, login, cambio obligatorio de contraseña del primer login) | Registrar, entrar y salir; cuenta bloqueada no entra |
| 1c | **Catálogo** (YGO, Pokémon, MyL) | Búsqueda y paginación igual que hoy; entrada vacía y error de la API externa manejados |
| 1d | **Subastas públicas con SSR** (`/subastas`, `/subasta/[id]`) y **pujas en vivo** con Realtime | La página trae el HTML con datos al ver el código fuente; dos pestañas ven la puja al instante; doble envío no duplica |
| 1e | **Mi cuenta** y **publicar carta** | Publicar una carta aprobada por admin aparece en subastas |
| 1f | **Panel de admin** (recepción, ventas, devoluciones, reglas, usuarios) | Un usuario no admin no accede a las rutas ni a las funciones |
| 1g | **Canasto e intercambios** y textos legales (términos, privacidad, acerca de) | Intercambio simulado completo; textos con las reglas vigentes |
| 1h | Retirar el sitio estático antiguo y `dev-server.js`; actualizar `AGENTS.md`, `README.md` y la tabla de estructura | Sin enlaces rotos; el README explica cómo levantar todo con `compose` |

#### 4.2 Pasos del sub-paso 1b (rama `feat/nuxt-auth`)

| # | Paso | Cómo se demuestra |
|---|---|---|
| 1 | Supabase local con el CLI como `devDependency` (misma versión que CI) | `npx supabase start` aplica la migración |
| 2 | Módulo `@nuxtjs/supabase` con sesión en cookies (SSR); sin `.env` la app no arranca bien, así que `.env.example` trae los datos del Supabase local | La página de inicio responde 200 con el `.env` local |
| 3 | `useCuenta` (perfil de `perfiles`), middleware global y barra de navegación | La barra muestra el nombre ya en el HTML del servidor |
| 4 | Páginas `/entrar`, `/registro`, `/cambiar-password`, y salir | Registrar, entrar y salir en el navegador; doble clic no duplica; campos vacíos dan error |
| 5 | Cuenta bloqueada y contraseña temporal | Usuario con `bloqueado` no queda con sesión; con `debe_cambiar_password` solo puede ir a cambiarla |
| 6 | Pruebas unitarias (validación y mensajes), lint, tipos, build, imagen con `compose` | Todo en verde en local |

#### 4.3 Pasos del sub-paso 1c (rama `feat/nuxt-catalogo`)

Decisiones: el catálogo reemplaza la portada provisoria en `/`. Las cartas se cargan **en el navegador**: el servidor manda las pestañas y la búsqueda, y así no espera a la API de Pokémon, que es lenta o se cae. "Agregar al canasto" y "Subastar esta carta" quedan para 1g y 1e. La búsqueda no queda en la URL, igual que hoy.

| # | Paso | Cómo se demuestra |
|---|---|---|
| 1 | `utils/catalogo.ts`: tipos, normalización de YGO/Pokémon/MyL, URL de cada API y regla de "hay más"; cartas de ejemplo de MyL en `utils/myl.ts` | Pruebas de Vitest con respuestas de ejemplo |
| 2 | `utils/catalogo.ts`: `cargarPagina` con `fetch` inyectable (400 de YGO = sin resultados, otro error = falla) y `traducir` (MyMemory) | Pruebas con `fetch` simulado: vacío, 400, 500, red caída, última página |
| 3 | `composables/useCatalogo.ts`: estado, espera de 350 ms en la búsqueda, reinicio al cambiar de pestaña o filtro, sin doble carga, y descarte de respuestas viejas | Pruebas: doble "Cargar más" hace un solo pedido; la respuesta de una búsqueda vieja no pisa la nueva |
| 4 | `pages/index.vue` + componentes `TarjetaCarta` y `DetalleCarta` (modal con zoom, traducción y Escape) | En el navegador: pestañas, búsqueda, filtro, "Cargar más", modal, zoom, traducción; búsqueda sin resultados y API bloqueada muestran su mensaje |
| 5 | Lint, tipos, pruebas, build y la imagen con `compose` | Todo en verde en local; `/` responde 200 desde el contenedor |

#### 4.4 Pasos del sub-paso 1d (rama `feat/nuxt-subastas`)

Decisiones: `/subastas` y `/subasta/[id]` se renderizan en el servidor con `useAsyncData` (vista `subastas_publicas` e `historial_pujas`, llamando antes a `procesar_vencimientos` como hoy). Una subasta que no existe o un id inválido responde **404**. El filtro por juego y la búsqueda del listado se aplican en el navegador y no quedan en la URL, igual que hoy. La cuenta regresiva depende de la hora, así que el servidor manda la fecha de cierre fija (zona `America/Santiago`) y el navegador la cambia por el reloj, sin errores de hidratación. Realtime solo en el navegador, sobre la tabla `subastas`, con recarga agrupada (300-400 ms) y canal cerrado al salir de la página. "Comprar ya" pide confirmación dentro de la página (no `confirm()`). Sin sesión, pujar o comprar llevan a `/entrar?volver=…`, que vuelve a la subasta tras entrar. "Publicar una carta" y el link a "Mi cuenta" quedan para 1e. La barra suma los links Catálogo y Subastas. Los datos de prueba (usuarios, carta aprobada, subasta) se crean en el Supabase local con un script fuera del repo; no se agrega `seed.sql` para no tocar las pruebas pgTAP.

| # | Paso | Cómo se demuestra |
|---|---|---|
| 1 | `utils/subastas.ts`: tipos, `formatCLP`, `tiempoRestante(fin, ahora)`, fecha fija, textos de resultado, validación del monto y filtro del listado | Pruebas de Vitest |
| 2 | `/entrar` acepta `volver` (solo rutas internas: `/…` y no `//…`) | Prueba de la validación; en el navegador vuelve a la subasta |
| 3 | `composables/useSubastasEnVivo.ts` (canal Realtime + recarga agrupada) y componente `RelojSubasta` | Pruebas: varios eventos seguidos hacen una sola recarga; al desmontar se cierra el canal |
| 4 | `pages/subastas.vue` (grilla, filtro, búsqueda, vacío, error) | `curl` del HTML trae los nombres y precios; filtro y búsqueda en el navegador |
| 5 | `pages/subasta/[id].vue` (detalle, cifras, historial, pujar, comprar ya con confirmación, avisos de pago simulado, `useHead` con título y descripción) | `curl` trae el HTML con datos; id inexistente da 404; dos pestañas ven la puja al instante; doble clic en "Pujar" hace una sola puja; monto bajo, vacío o propia carta muestran el error de la base |
| 6 | Lint, tipos, pruebas, build e imagen con `compose` contra el Supabase local | Todo en verde en local; `/subastas` responde 200 desde el contenedor |

#### 4.5 Pasos del sub-paso 1e (rama `feat/nuxt-cuenta-publicar`)

Decisiones: `/mi-cuenta` y `/publicar` se arman solo en el navegador (`routeRules` con `ssr: false`) y piden sesión: sin ella, el middleware manda a `/entrar?volver=…`. Mi cuenta tiene las secciones de hoy (compras con "Pagar (simulado)", pujas agrupadas por subasta, cartas publicadas con "Cancelar publicación" y cambio de contraseña), con anclas `#compras`, `#pujas`, `#publicaciones` y `#seguridad`. Pagar y cancelar piden confirmación dentro de la página (no `confirm()`). Publicar se abre desde el catálogo con `?juego=&ref=&nombre=&imagen=` (solo imágenes `https://`) o se llena a mano; muestra lo que recibe el vendedor según `configuracion`. Los puntos de intercambio (en `localStorage`) quedan para 1g. Las reglas las valida Postgres (`publicar_carta`, `cancelar_publicacion`, `simular_pago`, RLS); la UI solo da mensajes antes.

| # | Paso | Cómo se demuestra |
|---|---|---|
| 1 | `utils/mercado.ts`: tipos de `ventas`, `publicaciones` y `configuracion`, textos de estado, `agruparPujas`, `validarPublicacion`, `calcularPublicacion`, `paramsPublicar` (desde la URL) y `urlPublicar` (desde una carta) | Pruebas de Vitest |
| 2 | Middleware: rutas que piden sesión mandan a `/entrar?volver=…`; `routeRules` sin SSR para `/mi-cuenta` y `/publicar` | Prueba de la lista de rutas; en el navegador, sin sesión vuelve a la página tras entrar |
| 3 | `pages/publicar.vue` (formulario, cálculo en vivo, éxito con código de envío) y botón "Subastar esta carta" en `DetalleCarta`; link "Publicar una carta" en `/subastas` | En el navegador: campos vacíos o mínimo sobre la base dan error; doble clic publica una sola vez; desde el catálogo llegan nombre e imagen |
| 4 | `pages/mi-cuenta.vue` con las cuatro secciones, confirmaciones y el aviso de pago simulado; link "Mi cuenta" en la barra | En el navegador: pagar (simulado), cancelar, cambiar contraseña; recarga con `#publicaciones` baja a la sección |
| 5 | Datos de prueba en el Supabase local: publicar, aprobar como admin (SQL, el admin llega en 1f) y ver la carta en `/subastas` | La carta publicada aparece en `/subastas` |
| 6 | Lint, tipos, pruebas, build e imagen con `compose` | Todo en verde en local; `/mi-cuenta` responde 200 desde el contenedor |

Despliegue en el VPS (Caddy + Cloudflare, imagen en GHCR por SHA) se prepara al final del paso 1 o al empezar el backend, lo que ocurra primero.

### Paso 2 — Esqueleto del backend (TypeScript)
- Se crea el repo privado `cambalache-api` (ver 4.1) con Node LTS y TypeScript, un framework mínimo (Fastify), validación con `zod` y config por variables de entorno. Verifica el JWT de Supabase en cada petición. Publica su OpenAPI. Imagen de contenedor privada en GHCR, desplegada por SHA. **No se empieza hasta cerrar el paso 1.**
- Demostración: endpoint `/salud` y un endpoint autenticado probados en CI con pruebas automáticas.

### Paso 3 — Pagos reales
- El backend crea la orden de pago al ganar la subasta y recibe el **webhook** del proveedor (firma verificada e idempotencia por id de evento). Solo el webhook marca "pagado", llamando a una función de Postgres; se elimina `simular_pago` del alcance del navegador.
- Reembolsos y pagos fallidos o vencidos pasan por la misma máquina de estados. Liquidación 90% al vendedor registrada como asiento, no como un campo suelto.
- Demostración: pruebas contra el sandbox del proveedor, webhook repetido sin doble efecto, y pruebas pgTAP del nuevo flujo.

### Paso 4 — Correos transaccionales
- Cola en Postgres (tabla `correos_pendientes`) procesada por el backend con reintentos. Plantillas: superada en una puja, subasta ganada, pago recibido, pago por vencer (48 h), carta aprobada/rechazada, liquidación.
- SPF, DKIM y DMARC configurados en el dominio.
- Demostración: correo real a una casilla de prueba por cada plantilla; un fallo del proveedor reintenta y no duplica.

### Paso 5 — Fotos reales de las cartas
- Subida directa del navegador a Supabase Storage (o S3/R2) con URL prefirmada que emite el backend; límite de tamaño y de tipo (JPEG/PNG/WebP), comprobación del contenido real del archivo, y nombre aleatorio.
- El admin ve las fotos al aprobar la carta. Bucket privado con URLs firmadas para lo no aprobado.
- Demostración: subir un archivo disfrazado (por ejemplo `.exe` renombrado a `.jpg`) y que sea rechazado.

### Paso 6 — Endurecer y cerrar
- Límite de tasa, registro de eventos de pago, copia de seguridad de la base y plan de restauración probado, revisión de seguridad (secretos, `service_role` solo en el servidor) y checklist antes de abrir al público.
- Intercambios y puntos (hoy en `localStorage`) a Postgres antes de que los puntos tengan valor.

## 5. Riesgos

- **Dinero real:** un bug en pagos o liquidación pierde plata de terceros. Por eso el webhook es la única fuente de verdad y todo movimiento queda como asiento auditable.
- **Cumplimiento:** sin resolver lo tributario y legal (paso 0), no se debe cobrar.
- **Dos fuentes de verdad:** el backend nunca duplica reglas que ya viven en Postgres; solo llama a las funciones.

## 6. Fuera de alcance

Courier y seguimiento de envíos, app móvil, notificaciones push, y reemplazar Supabase Auth.
