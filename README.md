# Cambalache

Explorador de cartas de Yu-Gi-Oh!, Pokémon y Mitos y Leyendas, con cuenta de usuario y un
canasto para armar intercambios o ventas. El sitio ya no tiene un banner de "prototipo" en
cada página (se sacó a pedido), pero **el pago, la liberación de fondos y la confirmación de
la otra parte siguen siendo simulados** — ver "Qué es real y qué es simulado" más abajo. Esa
honestidad puntual se dejó a propósito en los botones donde importa (pagar, confirmar) y en
`acerca-de.html`/`terminos.html`: sacar el banner grande está bien para que el sitio se vea
terminado, pero borrar del todo la señal de "esto es simulado" justo donde alguien podría
mandar una carta real confiando en una protección que no existe todavía, no.

## Por qué esto es un prototipo y no la plataforma "oficial"

La idea original era construir directamente la plataforma "oficial y segura" de intercambio:
cuenta verificada con Clave Única, cada intercambio con un prepago de $500 CLP por cada carta
que cada persona pone en la operación, cada venta con 20% de comisión, y los fondos liberados
recién cuando ambas partes confirman. Esas condiciones están escritas en detalle en
`terminos.html` (borrador), para que estén claras desde ahora y no se inventen después de que
la plataforma ya esté cobrando.

Eso es, en la práctica, operar como intermediario financiero que retiene plata de terceros.
Antes de escribir una sola línea de ese flujo como si funcionara de verdad, valía la pena
decirlo con todas sus letras:

- **Retener fondos hasta liberarlos (escrow)** no es algo que MercadoPago resuelva solo para
  un individuo: su modo Marketplace cobra comisión y liquida al vendedor casi de inmediato, no
  deja la plata "presa" esperando una confirmación mutua. Hacerlo bien y legal normalmente
  implica constituir una empresa, tener términos y condiciones reales, y revisar si aplica
  regulación de la CMF.
- **Clave Única** no es un botón que se agrega al código: solo instituciones con convenio
  formal con el Estado pueden integrarla.

Por eso este proyecto se construyó como **maqueta completa del flujo**, con estados simulados,
en vez de simular menos pero con apariencia de que "ya funciona". Mismo criterio que
`MP_ACCESS_TOKEN` sin configurar en `mercadoeficiente`/`new-essency`/`crosheep`: se ve y se usa
completo, pero no cobra ni retiene nada real hasta que alguien decida dar ese paso con
asesoría legal y de pagos de verdad.

## Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Catálogo de Yu-Gi-Oh! y Pokémon (datos, imágenes, búsqueda, orden por ID) | **Real**, en vivo desde YGOPRODeck y Pokémon TCG API |
| Traducción de la descripción al español | **Real**, en vivo vía MyMemory Translation API |
| Zoom a la imagen de la carta | **Real** |
| Canasto (agregar cartas para intercambiar o vender) | **Real**, guardado en tu navegador |
| Cuenta (crear cuenta / iniciar sesión) | **Real como mecanismo** (contraseña hasheada con SHA-256, nunca en texto plano), pero vive solo en `localStorage`: no es autenticación real entre dispositivos ni verifica que la persona sea quien dice ser |
| Cobro de $500 CLP por carta en intercambio o 20% por venta | **Simulado**: no se procesa ningún pago real |
| Confirmación de "la otra parte" en un intercambio o venta | **Simulado**: no hay una segunda persona real, se simula con un botón |
| Liberación de fondos | **Simulado**: no hay fondos reales que liberar |
| Puntos por intercambio/venta resuelta | **Real como mecánica**, pero solo local (no hay ranking ni cuenta compartida entre usuarios) |

## Qué incluye

- `index.html`: el catálogo. Pestañas por juego, buscador, filtro por tipo, cartas
  **ordenadas por ID**, modal de detalle con **zoom** de imagen y **traducción al español**
  (para Yu-Gi-Oh!/Pokémon, que vienen en inglés), y botón para agregar al canasto.
- `canasto.html`: el corazón del flujo de intercambio/venta. Cuenta (puntos incluidos), tu
  canasto (marcar cada carta como "para intercambiar" o "para vender" con un precio), y el
  estado paso a paso de cada intercambio/venta en curso.
- `acerca-de.html`: de dónde sale cada catálogo, la explicación completa de qué es real y qué
  es simulado, y el aviso legal.
- `terminos.html`: Términos y Condiciones (borrador) — tarifas exactas, cuenta/verificación,
  responsabilidades de cada parte, y qué falta definir antes de operar con dinero real. Hay
  que aceptarlos (checkbox en `canasto.html`) antes de iniciar cualquier intercambio o venta.
- `privacidad.html`: política de privacidad de referencia.
- `assets/js/shared.js`: metadatos de juegos, y todo lo que se guarda en `localStorage`
  (canasto, cuentas/sesión, transacciones). Lo usan `index.html`, `canasto.html` y el modal
  de login/registro.
- `assets/js/auth.js`: el modal de "Iniciar sesión" / "Crear cuenta", compartido por
  `index.html` y `canasto.html`.
- `assets/js/app.js`: lógica de `index.html` (fetch a las APIs, grilla, modal, zoom,
  traducción).
- `assets/js/canasto.js`: lógica de `canasto.html` (canasto, transacciones, resumen).
- `assets/js/myl-data.js`: catálogo de ejemplo de Mitos y Leyendas.
- `dev-server.js`: servidor estático mínimo para probar en `localhost`.

Sitio 100% estático (HTML + CSS inline + JS vanilla), sin backend ni base de datos propia:
todo el estado (cuentas, canasto, transacciones) vive en `localStorage` del navegador, así
que las cuentas creadas en un navegador no existen en otro dispositivo.

## De dónde salen los datos

- **Yu-Gi-Oh!**: [YGOPRODeck API](https://ygoprodeck.com/api-guide/), pública y gratuita.
  Catálogo completo (más de 14.000 cartas), con imágenes, ordenado por ID (`sort=id`).
- **Pokémon**: [Pokémon TCG API](https://pokemontcg.io/), pública y gratuita. Catálogo
  completo (más de 20.000 cartas), con imágenes, ordenado por ID (`orderBy=id`).
- **Traducción**: [MyMemory Translation API](https://mymemory.translated.net/), pública y
  gratuita, sin API key. Traduce la descripción de la carta de inglés a español al apretar
  "Traducir al español" en el modal de detalle. Tiene un límite de uso diario razonable para
  este volumen de uso; si se necesita más, hay que sacar una cuenta con key propia.
- **Mitos y Leyendas**: no hay una API pública equivalente. `assets/js/myl-data.js` tiene
  solo 6 nombres de ejemplo (figuras mitológicas de dominio público, sin texto de carta
  copiado de ningún lado), sin imágenes reales de cartas.

Las tres APIs (YGOPRODeck, Pokémon TCG API, MyMemory) permiten llamadas directas desde el
navegador (CORS abierto), así que no hace falta ningún proxy ni backend propio.

## Cómo funciona el canasto y el flujo simulado

1. Desde `index.html`, "Agregar al canasto" guarda la carta en tu canasto (`localStorage`),
   por defecto como "para intercambiar".
2. En `canasto.html`, cada carta se puede pasar a "Vender" (con un precio en CLP) o dejar
   como "Intercambiar".
3. Para iniciar cualquier intercambio o venta, primero hay que aceptar los `terminos.html`
   (checkbox en `canasto.html`) y tener una cuenta iniciada (crear cuenta o iniciar sesión,
   botón arriba a la derecha en cualquier página).
4. **Intercambio**: agrupa todas las cartas marcadas como "Intercambiar" en una transacción de
   $500 CLP **por cada carta** (tu parte; si son 3 cartas, $1.500 CLP). "Pagar mi parte" avanza
   el estado; como no hay una segunda persona real, el siguiente paso es un botón explícito
   "Simular: la otra parte pagó y confirmó", que resuelve la transacción y suma puntos.
5. **Venta**: cada carta con precio se publica como una transacción independiente (comisión
   20%, vendedor recibe 80%). Los pasos siguientes también son botones "Simular…" hasta
   llegar a "Resuelto".

Nada de esto llama a MercadoPago ni a ningún procesador de pagos: es una máquina de estados
en `localStorage`, pensada para poder mostrar y probar el flujo completo antes de decidir
construir la parte de pagos real.

## Ver el sitio localmente

```bash
node dev-server.js
```

Abre `http://localhost:3000`. También funciona con cualquier otro servidor estático
(`npx serve .`); lo único que no anda bien es abrir los `.html` directo como `file://`, porque
algunos navegadores son más estrictos con `fetch()` a otros dominios desde ahí.

## Aviso legal

Cambalache es un proyecto de fans, sin fines de lucro, sin afiliación con Konami (Yu-Gi-Oh!),
The Pokémon Company, Nintendo, Game Freak (Pokémon), ni Onirica Studios/Toro Studios (Mitos y
Leyendas). Todos los nombres, imágenes y textos de las cartas son propiedad de sus
respectivos dueños; los de Yu-Gi-Oh! y Pokémon se muestran vía sus APIs públicas pensadas
para este tipo de uso.

## Pendiente para que esto sea real

- **Constituir Cambalache SpA**: `terminos.html` ya describe el modelo (tarifas, verificación,
  responsabilidades), pero falta que un abogado lo revise una vez que la sociedad exista, y
  resolver si el modelo de "retener y liberar fondos" necesita autorización regulatoria (CMF)
  antes de cobrar un peso real.
- **Pagos reales con retención**: evaluar si el modo Marketplace de MercadoPago (u otro
  proveedor) puede aproximar el "prepago + liberación al confirmar", o si hace falta un
  proveedor de escrow dedicado.
- **Verificación de identidad real**: evaluar Clave Única (requiere convenio institucional
  con el Estado) u otra alternativa; hoy crear una cuenta no confirma que la persona sea quien
  dice ser.
- **Backend + base de datos real**: para que las cuentas existan más allá de un navegador, y
  para que dos personas distintas puedan verse mutuamente en un intercambio o compra/venta en
  vivo, en vez de simular "la otra parte" con un botón.
- Catálogo real de Mitos y Leyendas, si aparece una fuente con permiso.
- API keys propias de YGOPRODeck / Pokémon TCG API / MyMemory si el tráfico crece.
- Dominio propio (hoy sin definir).
