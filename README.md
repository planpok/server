# Poker Planning Backend (NestJS)

API backend du projet Poker Planning, construite avec NestJS et TypeScript.

## Prerequis

- Node.js 22 (recommande, aligne avec la CI GitHub Actions)
- npm 10+

## Installation

Depuis ce dossier (`server/`) :

```bash
npm ci
```

Alternative en local si besoin :

```bash
npm install
```

## Configuration

Le backend utilise une variable d'environnement:

- `PORT` (optionnelle): port HTTP de l'API. Defaut: `3000`

Exemple:

```bash
PORT=3000
```

Les routes HTTP sont exposees sous le prefixe global `/api`.
La documentation Swagger est disponible sur `/api/docs`.

## Lancement

### Mode developpement (watch)

```bash
npm run start:dev
```

Puis ouvrir:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### Mode production (build + start)

```bash
npm run build
npm run start
```

## Tests

Lancer tous les tests:

```bash
npm test
```

Mode watch:

```bash
npm run test:watch
```

Rapport de couverture:

```bash
npm run test:cov
```

En CI, les tests sont executes via:

```bash
npm test -- --ci
```

## Commandes utiles

```bash
# Installer les dependances
npm ci

# Developpement
npm run start:dev

# Build TypeScript
npm run build

# Demarrer le build compile
npm run start

# Tests
npm test
npm run test:watch
npm run test:cov
```

## Apercu API

Base URL locale:

```text
http://localhost:3000/api
```

Endpoints REST principaux:

- `POST /sessions` creer une session
- `POST /sessions/:code/join` rejoindre une session
- `GET /sessions/:code` recuperer l'etat d'une session
- `POST /sessions/:code/vote` voter
- `POST /sessions/:code/reveal` reveler les votes (owner)
- `POST /sessions/:code/reset` reset un tour (owner)
- `POST /sessions/:code/leave` quitter une session

WebSocket (Socket.IO):

- Event entrant: `session.subscribe` avec `{ "sessionCode": "ABC123" }`
- Event sortant: `session.subscribed`
- Broadcast: `session.updated`
- Broadcast: `session.deleted`

## Docker

Un `Dockerfile` est fourni dans ce dossier. Depuis la racine du monorepo, vous pouvez aussi lancer l'application complete avec:

```bash
docker compose up --build
```
