# Cambalache

Mercado de cartas TCG (Yu-Gi-Oh!, Pokémon, Mitos y Leyendas): subastas en consignación de 3 días e intercambios.

Quien vende envía su carta, Cambalache la revisa y la custodia, y se subasta 3 días con pujas en vivo y compra inmediata. Cambalache se queda con el 10% del monto final y el vendedor con el 90%. **Los pagos todavía son simulados** (ver [Qué es real y qué es simulado](#qué-es-real-y-qué-es-simulado)). El plan y el estado de cada paso están en [`PLAN.md`](PLAN.md); los cambios, en [`CHANGELOG.md`](CHANGELOG.md).

## Índice

- [Instalación](#instalación)
- [Uso](#uso)
- [Estructura](#estructura)
- [Cómo funciona el mercado](#cómo-funciona-el-mercado)
- [Qué es real y qué es simulado](#qué-es-real-y-qué-es-simulado)
- [Administración](#administración)
- [Pruebas](#pruebas)
- [De dónde salen los datos](#de-dónde-salen-los-datos)
- [Pendiente para operar con dinero real](#pendiente-para-operar-con-dinero-real)
- [Aviso legal](#aviso-legal)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Instalación

### Dependencias

- Node.js 24+ (servidor local del sitio actual y app Nuxt nueva en `web/`)
- Docker con `compose`, para probar la app Nuxt como en producción
- Un proyecto de [Supabase](https://supabase.com) para cuentas y subastas (el plan gratis alcanza)
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) y Docker, para correr las pruebas de la base en local

```sh
git clone https://github.com/dannlebeau/cambalache.git
cd cambalache
```

### Base de datos (una vez por proyecto Supabase)

1. Crea el proyecto en Supabase y, en **SQL Editor**, ejecuta [`supabase/migrations/20261115000000_mercado_subastas.sql`](supabase/migrations/20261115000000_mercado_subastas.sql). Crea las tablas, las reglas de la subasta, la RLS, Realtime y el cierre automático con `pg_cron`. Si `pg_cron` no está habilitado, habilítalo en **Database → Extensions** y vuelve a ejecutar el último bloque del archivo.
2. En **Authentication → URL Configuration**, pon la URL del sitio como *Site URL* (para el link de confirmación de correo).
3. Copia la *Project URL* y la *publishable key* (**Project Settings → API**) en [`assets/js/config.js`](assets/js/config.js). Ambas son públicas por diseño; nunca pongas ahí la `service_role` key.

Sin estos pasos, el catálogo y los intercambios funcionan igual, pero las cuentas y el mercado muestran "no está conectado".

## Uso

```sh
npm run dev
```

Abre `http://localhost:3000` (el puerto se cambia con la variable `PORT`). También funciona con cualquier otro servidor estático (`npx serve .`); lo único que no anda bien es abrir los `.html` directo como `file://`.

### App nueva (Nuxt, en construcción)

El frontend se está migrando a Nuxt en `web/` (ver [`PLAN.md`](PLAN.md)). Mientras tanto convive con el sitio actual:

```sh
npm ci                       # dependencias con el lockfile
npm run web:dev              # desarrollo en http://localhost:3001
docker compose up --build    # como en producción, en http://localhost:3001
```

Para la configuración, copia `.env.example` a `.env` (todavía no la usa ninguna página).

Cada página tiene en el nav un selector de tema que rota Sistema → Claro → Oscuro y recuerda la elección en el navegador.

## Estructura

| Archivo | Qué hay |
|---|---|
| `index.html` | Catálogo en vivo (YGOPRODeck, Pokémon TCG API) con zoom, traducción, "Agregar al canasto" y "Subastar esta carta" |
| `subastas.html` | Subastas activas con cuenta regresiva; se actualiza sola cuando alguien puja |
| `subasta.html` | Detalle de una subasta: pujas en vivo, historial anónimo y compra inmediata |
| `publicar.html` | Formulario para publicar una carta (queda pendiente de envío) |
| `mi-cuenta.html` | Compras (con pago simulado), pujas, cartas publicadas y cambio de contraseña |
| `admin.html` | Recepción, subastas, ventas, devoluciones, reglas y usuarios |
| `canasto.html` | Intercambios carta por carta (simulados y locales) |
| `acerca-de.html`, `terminos.html`, `privacidad.html` | Textos del sitio |
| `assets/js/auth.js` | Cliente de Supabase, cuentas (login, registro, cambio de contraseña) y nav |
| `assets/js/mercado.js` | Ayudas comunes de las páginas del mercado |
| `assets/js/shared.js` | Metadatos de juegos, formatos, canasto e intercambios en `localStorage` |
| `assets/js/config.js` | URL y publishable key del proyecto Supabase |
| `assets/js/<página>.js` | Lógica de cada página |
| `assets/css/base.css`, `assets/css/tema.css` | Estilos de las páginas del mercado y tokens de color (claro/oscuro) |
| `supabase/migrations/` | Esquema, reglas de negocio (funciones), RLS, Realtime y `pg_cron` |
| `supabase/tests/` | Pruebas pgTAP de las reglas |
| `dev-server.js` | Servidor estático mínimo para `localhost` |

## Cómo funciona el mercado

1. **Publicar:** desde el catálogo ("Subastar esta carta") o el canasto, quien vende indica el estado, un precio base y, si quiere, un precio mínimo. Queda *pendiente de envío*.
2. **Custodia:** envía la carta con su código (`#id`). El admin la recibe, la revisa y la aprueba (sale a subasta) o la rechaza (*por devolver*).
3. **Subasta de 3 días:** la primera puja parte del precio base; cada siguiente debe superar la actual en 5% o $500 (lo que sea mayor). Una puja en los últimos 5 minutos alarga el cierre 5 minutos.
4. **Compra inmediata:** (puja actual o precio base) + 20%, redondeado a $100. Cierra la subasta al instante.
5. **Cierre:** gana la puja más alta. Sin pujas, la carta se republica sola con −10%; si quedaría bajo el mínimo del vendedor, pasa a *por devolver*.
6. **Pago:** el ganador tiene 48 horas. Si no paga, queda bloqueado y la carta pasa al siguiente mejor postor por su puja (o se republica si no hay).
7. **Despacho y liquidación:** el admin marca la venta despachada y, al transferir, liquidada: 10% Cambalache, 90% vendedor.

Todas las reglas viven en funciones de Postgres (`supabase/migrations`), no en el navegador: aunque alguien edite el JavaScript, no puede pujar bajo el mínimo, pujar su propia carta ni cerrar una subasta. Los porcentajes y plazos se editan en **Admin → Reglas**.

## Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Catálogo de Yu-Gi-Oh! y Pokémon, zoom y traducción | **Real**, en vivo desde APIs públicas |
| Cuentas (registro con confirmación de correo, login, cambio de contraseña) | **Real** (Supabase Auth). No verifica identidad |
| Publicar, aprobar, pujar en vivo, compra inmediata, cierres y republicación | **Real**, compartido entre todos los usuarios |
| Pago del ganador | **Simulado**: el botón "Pagar (simulado)" no cobra nada |
| Despacho y transferencia al vendedor | **Manual**: el admin los hace fuera del sitio y los marca en el panel |
| Intercambios carta por carta, canasto y puntos | **Simulado y local** (`localStorage`) |

## Administración

El primer admin (master) se crea una sola vez:

1. En Supabase, **Authentication → Users → Add user**, con el correo del admin y una contraseña temporal.
2. En **SQL Editor**:

   ```sql
   update public.perfiles
      set es_admin = true, debe_cambiar_password = true
    where id = (select id from auth.users where email = 'correo-del-admin@ejemplo.cl');
   ```

3. Al iniciar sesión en el sitio, la app le obliga a cambiar la contraseña temporal.

Desde ahí, los admins se gestionan en **Admin → Usuarios**: la persona crea su cuenta en el sitio y un admin le marca "Admin". Ahí también se bloquea o desbloquea a un usuario.

## Pruebas

```sh
supabase db start   # Postgres local con las migraciones aplicadas (requiere Docker)
supabase test db    # pruebas pgTAP de supabase/tests
```

```sh
npm run web:lint && npm run web:typecheck && npm run web:test   # app Nuxt
```

El workflow `CI` corre todo esto en cada PR, además del build de la app y de la imagen Docker.

## De dónde salen los datos

- **Yu-Gi-Oh!**: [YGOPRODeck API](https://ygoprodeck.com/api-guide/), pública y gratuita, ordenada por ID.
- **Pokémon**: [Pokémon TCG API](https://pokemontcg.io/), pública y gratuita, ordenada por ID.
- **Traducción**: [MyMemory Translation API](https://mymemory.translated.net/), pública y gratuita, sin API key.
- **Mitos y Leyendas**: no hay una API pública equivalente. `assets/js/myl-data.js` tiene solo 6 nombres de ejemplo (figuras mitológicas de dominio público), sin imágenes. Una carta de MyL se publica escribiendo su nombre a mano.

## Pendiente para operar con dinero real

- **Constituir Cambalache SpA** y revisar `terminos.html` y `privacidad.html` con un abogado; definir con un contador cómo se boletea la comisión y se declara el dinero de terceros.
- **Pagos reales**: integrar un proveedor (por ejemplo, MercadoPago) en lugar de `simular_pago`, idealmente con su webhook marcando la venta como pagada.
- **Envíos**: dirección de custodia, costos de envío y seguimiento.
- **Fotos reales** de cada carta al recibirla (hoy se usa la imagen del catálogo).
- **Disputas**: proceso de reclamos y reembolsos, y qué pasa si una carta se daña o pierde en custodia o en tránsito.
- **Notificaciones por correo**: cuando te superan una puja, ganas o te toca pagar.

## Aviso legal

Cambalache es un proyecto independiente, sin afiliación con Konami (Yu-Gi-Oh!), The Pokémon Company, Nintendo, Game Freak (Pokémon), ni Onirica Studios/Toro Studios (Mitos y Leyendas). Todos los nombres, imágenes y textos de las cartas son propiedad de sus respectivos dueños; los de Yu-Gi-Oh! y Pokémon se muestran vía sus APIs públicas pensadas para este tipo de uso.

## Contribuir

Los cambios se proponen con una rama y un PR, que revisa y mezcla un humano. Las dudas van en los [issues del repo](https://github.com/dannlebeau/cambalache/issues).

## Licencia

`UNLICENSED` © dannlebeau
