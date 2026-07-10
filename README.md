# CubeRanked

Competitive Rubik's Cube platform.

## Architecture

```
cuberanked/
├── frontend/          # React + Vite + Three.js client
│   ├── src/
│   │   ├── api/       # HTTP API client
│   │   ├── components/# Reusable UI components
│   │   ├── features/  # Feature-based modules
│   │   │   ├── auth/
│   │   │   ├── home/
│   │   │   ├── learn/
│   │   │   ├── practice/
│   │   │   ├── private-room/
│   │   │   ├── profile/
│   │   │   └── ranked/
│   │   ├── hooks/     # React hooks
│   │   ├── network/   # Socket.IO client
│   │   ├── state/     # Zustand stores, game state machine
│   │   ├── styles/    # Global CSS
│   │   └── utils/     # Cube engine, scramble, stats, etc.
├── backend/           # Fastify + Socket.IO + Prisma server
│   └── src/
│       ├── app/
│       ├── auth/
│       ├── config/
│       ├── controllers/
│       ├── cube/
│       ├── database/
│       ├── matchmaking/
│       ├── middleware/
│       ├── rating/
│       ├── replay/
│       ├── repositories/
│       ├── routes/
│       ├── services/
│       ├── sockets/
│       ├── types/
│       ├── users/
│       └── utils/
├── shared/            # Shared TypeScript types, DTOs, constants
│   ├── types/
│   └── constants.ts
└── docker-compose.yml
```

## Quick Start

### Docker (recommended)

```bash
docker compose up
```

This starts:
- **Frontend** at `https://localhost:8000`
- **Backend** at `http://localhost:4000`
- **PostgreSQL** at `localhost:5432`
- **Redis** at `localhost:6379`

LAN access: use `http://<your-ip>:8000` from another device on the same network.

### Manual Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (separate terminal)
cd backend
npm install
npm run dev
```

### Testing

```bash
cd frontend
npm test          # Unit tests
npm run verify:e2e  # E2E tests (requires running dev servers)
```

## Deployment

- **Frontend**: Deploy `frontend/` to Vercel
- **Backend**: Deploy `backend/` to Hugging Face Spaces (Docker)
- **Database**: Supabase PostgreSQL
- **Redis**: Upstash or similar
