#!/usr/bin/env bash
set -euo pipefail

TUNNEL_TARGET="http://localhost:8000"

if ! command -v cloudflared >/dev/null 2>&1; then
  cat >&2 <<'EOF'
cloudflared is not installed.

Install it on Arch Linux / Omarchy with:
  sudo pacman -S cloudflared

If your configured repositories do not provide cloudflared, install an AUR package manually.
Do not expose backend, database, Prisma Studio, Docker sockets, or admin tools through a tunnel.
EOF
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to verify ${TUNNEL_TARGET} before opening a tunnel." >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 3 "${TUNNEL_TARGET}" >/dev/null; then
  cat >&2 <<EOF
CubeRanked is not responding at ${TUNNEL_TARGET}.

Start the development stack first, for example:
  npm run dev:public

Then run:
  npm run tunnel
EOF
  exit 1
fi

cat <<EOF
PUBLIC DEVELOPMENT TUNNEL

Target:
  ${TUNNEL_TARGET}

Only the frontend development port is being exposed. API and Socket.IO traffic should go
through the Vite proxy to the backend on port 4000.

When Cloudflare prints the https://*.trycloudflare.com URL, add it to Supabase:
  Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs

Recommended temporary redirect pattern:
  https://RANDOM.trycloudflare.com/**

Press Ctrl+C to stop the tunnel.

EOF

printed_url=""
cloudflared tunnel --url "${TUNNEL_TARGET}" 2>&1 | while IFS= read -r line; do
  echo "${line}"
  if [[ "${line}" =~ https://[A-Za-z0-9.-]+\.trycloudflare\.com ]]; then
    public_url="${BASH_REMATCH[0]}"
    if [[ "${printed_url}" != "${public_url}" ]]; then
      printed_url="${public_url}"
      cat <<EOF

PUBLIC DEVELOPMENT TUNNEL URL
  ${public_url}

Supabase Redirect URL to add for this temporary tunnel:
  ${public_url}/**

EOF
    fi
  fi
done
