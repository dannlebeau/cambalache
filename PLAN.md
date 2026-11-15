# PLAN — Frontend en Nuxt y, después, backend propio (pagos reales, correos y fotos)

> Estado: **decisiones técnicas tomadas (2026-11-15). Foco actual: solo el frontend (paso 1). Avance: 1a hecho (rama `feat/nuxt-esqueleto`); siguiente, 1b (el módulo `@nuxtjs/supabase` se agrega ahí, porque sin un proyecto Supabase configurado responde 500 en todas las páginas). El backend (pasos 2 a 6) queda planificado pero no se empieza hasta cerrar el paso 1.** Quedan pendientes los temas legales/tributarios antes de cobrar de verdad. Reemplaza al plan del mercado de subastas (ya mezclado en `main`, ver `CHANGELOG.md` 0.2.0).

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
