# Dev stage: used by docker-compose.dev.yml (target: dev) — Angular dev server
# with hot reload.
FROM node:24-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npm", "start", "--", "--host", "0.0.0.0"]

# Build stage: compiles the production bundle.
FROM dev AS build

RUN npm run build

# Final stage (default target): nginx serves the SPA and proxies /api to the API.
FROM nginx:1.30-alpine AS prod

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
