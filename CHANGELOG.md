# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

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

[0.2.1]: https://github.com/dannlebeau/cambalache/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/dannlebeau/cambalache/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dannlebeau/cambalache/releases/tag/v0.1.0
