#!/bin/sh
set -e

node ./scripts/wait-for-services.mjs
npx prisma db push
npm run dev

