# PLAN — Estandarizar Cambalache

> Estado: **aprobado 2026-11-15**. En curso en la rama `chore/estandarizar-repo`.

## 1. Objetivo

Dejar el repo con los archivos base y las convenciones comunes de `dotfiles/AGENTS.md`, sin cambiar cómo funciona el sitio.

## 2. Decisiones

- **Stack:** se mantiene HTML + CSS inline + JS vanilla, sin dependencias ni build.
- **Tema:** selector Sistema / Claro / Oscuro en las 5 páginas con un script compartido (`assets/js/tema.js`), siguiendo la referencia de `search-gangas-app`. El esquema actual pasa a ser el modo oscuro y se agrega uno claro.
- **Licencia:** `UNLICENSED` © dannlebeau.
- **Fuera de alcance:** pagos reales, backend, cambios de flujo o de contenido legal.

## 3. Pasos

### Paso 1 — Archivos base

- `AGENTS.md`, `CLAUDE.md`, `.gitignore` y `.github/` (zizmor, gitleaks, Dependabot, changelog, tag) desde `dotfiles/templates/`.
- **Cómo lo demuestro:** `uvx zizmor .github/` → sin hallazgos.

### Paso 2 — README

- Reordenar según Standard Readme (plantilla de `dotfiles`), conservando el contenido actual como secciones propias.
- **Cómo lo demuestro:** revisión de enlaces internos (`*.html`, `PLAN.md`, `CHANGELOG.md`) → todos existen.

### Paso 3 — Selector de tema

- Script en `<head>` antes de pintar, botón que rota Sistema → Claro → Oscuro, guardado en `localStorage`, tokens en `@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) }` y `:root[data-theme=dark]`.
- **Cómo lo demuestro:** abrir cada página, rotar los 3 modos y recargar → se mantiene el modo elegido.

### Paso 4 — Seguridad menor

- SRI (`integrity` + `crossorigin`) en Font Awesome; `dev-server.js` solo sirve archivos dentro de la carpeta del proyecto.
- **Cómo lo demuestro:** `curl --path-as-is http://localhost:3000/../README.md` → 404; las páginas siguen cargando íconos.

### Paso 5 — Cierre

- `CHANGELOG.md` con `## [0.1.0] - 2026-11-15`, commit, push y PR.
- **Cómo lo demuestro:** PR abierto con la verificación de cada paso.

## 4. Estado

- [x] Paso 1 — zizmor no corre en local (falta `uv`): se verifica en el CI del PR (`security.yaml`).
- [x] Paso 2 — anclas y archivos enlazados del README revisados con un script: sin enlaces rotos.
- [x] Paso 3 — Edge headless: las 5 páginas rotan Sistema → Claro → Oscuro → Sistema, actualizan `aria-label` e ícono, mantienen "Claro" al recargar y un valor inválido en `localStorage` cae en Sistema. Capturas en claro y oscuro revisadas.
- [x] Paso 4 — SRI coincide con el publicado por cdnjs; rutas hacia afuera (`/../`, `%2e%2e%2f`, `%5c`) → 404, `%` mal codificado → 400.
- [ ] Paso 5 — commit y push hechos; falta abrir el PR (ver notas).

## 5. Notas / fallos

- `gh` no está instalado en este equipo: el PR se abre desde el link que da `git push`.
- Durante el paso 3 apareció un bug previo: `.nav-links a` pisaba el `color:#fff` del botón "Mi canasto" (ilegible en claro). Corregido en `index.html` y `canasto.html`.
