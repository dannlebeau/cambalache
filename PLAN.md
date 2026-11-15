# PLAN — Mercado de subastas en consignación

> Estado: **aprobado 2026-11-15**. En curso en la rama `feat/mercado-subastas` (parte de `chore/estandarizar-repo`). Siguiente paso: crear el proyecto Supabase, aplicar la migración, completar `assets/js/config.js` y verificar los pasos 2 a 4 de punta a punta.

## 1. Objetivo

Cambalache pasa a ser una casa de subastas en consignación: el vendedor manda su carta, el admin la recibe y aprueba (queda en custodia), se subasta 3 días con pujas en vivo y compra inmediata, el ganador paga, el admin despacha y liquida 10% para Cambalache y 90% para el vendedor. Los intercambios carta por carta se mantienen aparte, como hoy.

## 2. Decisiones

- **Backend:** Supabase en un proyecto propio de Cambalache (Auth, Postgres, Realtime). Toda regla de negocio (pujas, cierres, estados, permisos) vive en Postgres: funciones `security definer` + RLS. El navegador nunca escribe tablas directo, solo llama funciones (RPC).
- **Frontend:** sigue en HTML + JS vanilla sin build. `supabase-js@2.118.0` (UMD) desde jsDelivr con SRI. Configuración pública (URL y publishable key) en `assets/js/config.js`.
- **Cuentas:** Supabase Auth (correo + contraseña) reemplaza a las cuentas en `localStorage` en todo el sitio. Los puntos de intercambio quedan locales por usuario.
- **Reglas de subasta** (editables por admin en `configuracion`):
  - Duración 72 h. Puja mínima: la más alta + 5% (o + $500 si es mayor); la primera, al menos el precio base.
  - Compra inmediata: (puja más alta o precio base) × 1,20, redondeado a $100. Cierra la subasta al instante.
  - Anti-sniping: puja en los últimos 5 min alarga el cierre 5 min.
  - Sin pujas: se republica sola con −10%; si quedaría bajo el precio mínimo del vendedor (opcional), pasa a "por devolver".
  - Ganador sin pagar en 48 h: queda bloqueado y la carta pasa al siguiente mejor postor (por su puja); si no hay, se republica con −10%.
  - Comisión 10% sobre el monto final pagado (recargo incluido); vendedor 90%.
- **Pagos:** simulados (botón "Simular pago"). Nada se cobra de verdad.
- **Cierres automáticos:** `pg_cron` cada minuto llama `procesar_vencimientos()`; además cada lectura de subastas la llama, para no depender solo del cron.
- **Admin:** `admin.html`. El primer admin (master) se crea una vez en el panel de Supabase con contraseña temporal y se marca admin con una línea SQL documentada; en su primer login la app obliga a cambiarla. Desde ahí, los admins se gestionan en la app (dar/quitar admin, bloquear usuarios).
- **Fuera de alcance:** pagos reales, fotos subidas por el vendedor (se usa la imagen del catálogo), envíos/courier, correos de notificación.

## 3. Pasos

### Paso 1 — Esquema y reglas en Postgres

- `supabase/migrations/*.sql`: tablas, estados, funciones RPC, RLS, Realtime y `pg_cron`.
- `supabase/tests/*.sql`: pruebas pgTAP de las reglas.
- **Cómo lo demuestro:** las pruebas pasan en un Postgres 15 desechable local (con un esquema `auth` mínimo) y en CI con `supabase start` + `supabase test db`.

### Paso 2 — Cuentas con Supabase Auth

- `config.js`, cliente compartido, modal de login/registro sobre Supabase, cambio obligatorio de contraseña temporal.
- **Cómo lo demuestro:** registro, login, logout y cambio de contraseña contra el proyecto Supabase real.

### Paso 3 — Páginas del mercado

- `subastas.html` (listado con cuenta regresiva), `subasta.html` (detalle, pujas en vivo, compra inmediata), `publicar.html`, `mi-cuenta.html` (mis publicaciones, mis pujas/compras, pago simulado).
- **Cómo lo demuestro:** dos navegadores con cuentas distintas pujando en la misma subasta; la puja de uno aparece en el otro sin recargar; puja bajo el mínimo y doble envío rechazados.

### Paso 4 — Panel de admin

- Recepción (aprobar/rechazar), ventas (despachar, liquidar), devoluciones, configuración y mantenedor de usuarios.
- **Cómo lo demuestro:** flujo completo publicar → aprobar → pujar → cerrar → pagar → despachar → liquidar con montos 10/90 correctos.

### Paso 5 — Integración y textos

- Catálogo con "Subastar esta carta"; canasto solo con intercambios; nav con Subastas y Mi cuenta; `terminos.html`, `acerca-de.html`, README y AGENTS actualizados.
- **Cómo lo demuestro:** enlaces sin roturas; capturas en claro y oscuro de cada página nueva.

### Paso 6 — Cierre

- `CHANGELOG.md` `## [0.2.0] - 2026-11-15`, commit, push y PR.
- **Cómo lo demuestro:** PR abierto con la verificación de cada paso y CI en verde.

## 4. Estado

- [x] Paso 1 — 48 pruebas pgTAP pasan en un Postgres 15 desechable (esquema `auth` mínimo + subconjunto de pgTAP); una mutación de dos valores esperados hace fallar exactamente esas dos. En CI: `supabase db start` + `supabase test db`.
- [ ] Paso 2 — código listo (`auth.js`); falta probarlo contra el proyecto Supabase real.
- [ ] Paso 3 — código listo; sin Supabase, las 5 páginas cargan sin errores de JS y muestran "no está conectado". Falta la prueba con dos cuentas.
- [ ] Paso 4 — código listo; falta el flujo completo contra Supabase.
- [x] Paso 5 — textos, README y AGENTS actualizados; enlaces internos de README y de los HTML sin roturas. Capturas pendientes junto con la prueba real.
- [ ] Paso 6

## 5. Notas / fallos

- Los pasos 2 a 4 se verifican de punta a punta solo cuando exista el proyecto Supabase (lo crea el dueño y entrega URL + publishable key).
