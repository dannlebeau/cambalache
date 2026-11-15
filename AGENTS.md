# AGENTS.md

Guía para agentes que trabajen en este repositorio. Todo el proyecto (código, comentarios, docs y UI) está en **español**: nombres de variables, funciones, endpoints, tests y mensajes se escriben en español.

## Reglas comunes

Las reglas que valen para todos los repos viven en el repo **`dotfiles`** (`dotfiles/AGENTS.md`). Este archivo solo agrega lo específico del proyecto; si algo choca, manda el de este repo.

## Qué es

Explorador de cartas TCG (Yu-Gi-Oh!, Pokémon, Mitos y Leyendas) con cuenta y canasto de intercambio o venta. Regla de arquitectura: es un sitio **100% estático**, sin backend; todo el estado vive en `localStorage` y los catálogos se consultan directo desde el navegador a APIs públicas. El pago, la confirmación de la otra parte y la liberación de fondos son **simulados** y deben seguir diciéndolo en la UI (botones "Simular…", `acerca-de.html`, `terminos.html`).

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `*.html` | Las 5 páginas, con su CSS inline |
| `assets/js/` | JS vanilla: `shared.js` (estado en `localStorage`), `auth.js`, `app.js`, `canasto.js`, `myl-data.js`, `tema.js` |
| `dev-server.js` | Servidor estático local (Node, sin dependencias) |

## Comandos

```sh
node dev-server.js   # http://localhost:3000
```

No hay dependencias que instalar ni pruebas automatizadas.

## Convenciones de código

- JS vanilla en scripts clásicos (`<script src>`), sin módulos ni build.
- Todo dato que venga de una API o del usuario se escribe con `escapeHtml` o `textContent`, nunca directo en `innerHTML`.
- No introducir frameworks, bundlers, TypeScript ni dependencias de npm sin pedirlo.
- Colores como tokens CSS en `:root`, con su versión oscura (ver selector de tema en `dotfiles/AGENTS.md` → Webs).

## Datos sensibles a cambios

- Las tarifas ($500 CLP por carta en intercambio, 20% en venta) se definen en `assets/js/shared.js` (`COSTO_POR_CARTA_INTERCAMBIO`, `COMISION_VENTA`) y se repiten en textos de `terminos.html`, `acerca-de.html`, `assets/js/canasto.js` y `README.md`: si cambian, cambiarlas en todos a la vez.
- `assets/js/myl-data.js` es un catálogo de ejemplo sin texto copiado de cartas reales; no agregar contenido con derechos.

## Flujo de trabajo

- Lo común (rama antes de tocar, commits, push, PR, CHANGELOG y versión) está en `dotfiles/AGENTS.md`; no lo repitas aquí.
