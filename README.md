# Poker Planning Backend (NestJS)

Backend API for the Poker Planning project, built with NestJS and TypeScript.

## Prerequisites

- Node.js 22 (recommended, aligned with GitHub Actions CI)
- npm 10+

## Installation

From this directory (`server/`):

```bash
npm ci
```

Local alternative if needed:

```bash
npm install
```

## Configuration

The backend uses one environment variable:

- `PORT` (optional): API HTTP port. Default: `3000`

Example:

```bash
PORT=3000
```

HTTP routes are exposed under the global `/api` prefix.
Swagger documentation is available at `/api/docs`.

## Run

### Development mode (watch)

```bash
npm run start:dev
```

Then open:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### Production mode (build + start)

```bash
npm run build
npm run start
```

## Tests

Run all tests:

```bash
npm test
```

Mode watch:

```bash
npm run test:watch
```

Coverage report:

```bash
npm run test:cov
```

In CI, tests are executed with:

```bash
npm test -- --ci
```

## Useful Commands

```bash
# Install dependencies
npm ci

# Development
npm run start:dev

# Build TypeScript
npm run build

# Start compiled build
npm run start

# Tests
npm test
npm run test:watch
npm run test:cov
```

## API Overview

Local base URL:

```text
http://localhost:3000/api
```

Main REST endpoints:

- `POST /sessions` create a session
- `POST /sessions/:code/join` join a session
- `GET /sessions/:code` get session state
- `POST /sessions/:code/vote` submit a vote
- `POST /sessions/:code/reveal` reveal votes (owner)
- `POST /sessions/:code/reset` reset a round (owner)
- `POST /sessions/:code/leave` leave a session

WebSocket (Socket.IO):

- Incoming event: `session.subscribe` with `{ "sessionCode": "ABC123" }`
- Outgoing event: `session.subscribed`
- Broadcast: `session.updated`
- Broadcast: `session.deleted`

## Docker

A `Dockerfile` is provided in this directory. From the monorepo root, you can also start the full application with:

```bash
docker compose up --build
```
