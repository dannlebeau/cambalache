# PLAN — Backend propio: pagos reales, correos y fotos

> Estado: **decisiones técnicas tomadas (2026-11-15); pendiente de aprobar el uso de npm en el frontend y los temas legales/tributarios**. Reemplaza al plan del mercado de subastas (ya mezclado en `main`, ver `CHANGELOG.md` 0.2.0). Nada de este plan se implementa hasta que se apruebe el paso 0.

## 1. Objetivo

Pasar de pagos simulados a reales, con correos transaccionales y fotos reales subidas por el vendedor, sin perder las garantías actuales (reglas atómicas en la base, pruebas, RLS).

## 2. Stack actual de JS (diagnóstico)

| Aspecto | Hoy |
|---|---|
| Lenguaje | JS vanilla ES2020+ (`async/await`, `?.`, `??`, `catch {}` sin variable, arrow functions). Sin TypeScript |
| Módulos | Ninguno: scripts clásicos con globales (`<script src>`); el orden de carga en cada HTML es una dependencia implícita |
| Build / paquetes | Ninguno: no hay `package.json`, lockfile, linter, formateador ni tipos |
| Dependencias | `supabase-js@2.118.0` por CDN con SRI; Font Awesome por CDN |
| Node | Solo `dev-server.js` (CommonJS, sin dependencias). Sin versión fijada; en local corre v26.13.1 |

Lo que sí vale la pena mejorar (barato, sin build y sin cambiar de lenguaje): ES modules nativos (`<script type="module">`), `package.json` con `engines` y lockfile, ESLint y chequeo de tipos con JSDoc + `tsc --checkJs` (sin compilar nada). El backend nuevo sí va en **TypeScript**.

## 3. Decisión de base de datos (paso 0, la define el usuario)

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

### Paso 0 — Decisiones del usuario
- **Decididas:**
  - Base de datos: Postgres en **Supabase gestionado** (no MongoDB, no self-hosted por ahora; revisar self-hosted solo si el costo de Supabase se vuelve el problema, con respaldos externos y restauración ensayada).
  - Pagos: **Flow** (cotizar comisiones y requisitos de alta antes de integrar).
  - Correo: **Resend** (cambiable a Amazon SES después, porque la cola es propia).
  - Backend: **TypeScript sobre Node LTS con Fastify**, en un **VPS Hostinger KVM2** con Docker Compose, Caddy y Cloudflare delante; imagen en GHCR desplegada por SHA. Solo corre la API: la base no va en el VPS.
  - Web estática: Cloudflare Pages.
- **Pendientes del usuario:** aprobar agregar `package.json`/npm al frontend (paso 1, choca con `AGENTS.md`) y los temas legales de abajo.
- Aspectos legales y tributarios en Chile: cobrar por cuenta de terceros (consignación), boleta/factura electrónica en el SII, retención del 90% al vendedor, términos y privacidad. **Consultar a un contador/abogado antes de cobrar de verdad.** Este plan no los resuelve.
- Demostración: decisiones anotadas en este archivo.

### Paso 1 — Modernizar el JS del frontend (sin cambiar de lenguaje)
- `package.json` con `engines`, lockfile, ESLint y `tsc --checkJs`; CI con `--frozen-lockfile`. (Rompe hoy la regla "sin npm" del `AGENTS.md`: actualizarla en el mismo PR, previa aprobación.)
- Migrar los scripts clásicos a ES modules, una página a la vez.
- Demostración: CI en verde (lint + tipos + pgTAP) y cada página abierta en el navegador sin errores de consola.

### Paso 2 — Esqueleto del backend (TypeScript)
- Carpeta `backend/` con Node LTS y TypeScript, un framework mínimo (Fastify), validación con `zod` y config por variables de entorno. Verifica el JWT de Supabase en cada petición. Imagen de contenedor privada en GHCR, desplegada por SHA.
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
