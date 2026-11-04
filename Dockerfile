FROM node:24.22.2-trixie-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:24.22.2-trixie-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.22.2-trixie-slim AS prod-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:b8cec4b2f2126ff7bd034ec9ac207ffb3272667dfdc48376e3b035d3270549ba AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=nonroot:nonroot package*.json ./
COPY --chown=nonroot:nonroot --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot --from=build /app/dist ./dist

EXPOSE 3000

CMD ["dist/main.js"]
