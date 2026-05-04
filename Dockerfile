FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=nonroot:nonroot package*.json ./
COPY --chown=nonroot:nonroot --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot --from=build /app/dist ./dist

EXPOSE 3000

CMD ["dist/main.js"]
