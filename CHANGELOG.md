# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

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

[0.1.0]: https://github.com/dannlebeau/cambalache/releases/tag/v0.1.0
