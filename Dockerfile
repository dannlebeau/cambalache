# App Nuxt de Cambalache (web/). Construye con el lockfile congelado y corre el servidor
# de Nitro como usuario sin privilegios. La configuración pública (Supabase) llega en
# tiempo de ejecución por NUXT_PUBLIC_SUPABASE_URL y NUXT_PUBLIC_SUPABASE_KEY.

# node:24-alpine fijado por digest; Dependabot lo mantiene al día.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app

# Dependencias primero (capa cacheable). Sin scripts de instalación: el postinstall de
# web (nuxt prepare) necesita el código, y "nuxt build" lo hace de todos modos.
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci --ignore-scripts

COPY web/ web/
RUN npm run build --workspace web

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# .output trae el servidor y sus dependencias; no hace falta node_modules.
COPY --from=build --chown=node:node /app/web/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
