# Public development tunnel

CubeRanked uses a single public development endpoint for tunnel testing:

```text
Cloudflare Quick Tunnel
  -> Vite frontend on localhost:8000
  -> Vite proxy for /api and /socket.io
  -> Fastify backend on port 4000
```

Do not expose backend port `4000`, PostgreSQL, Redis, Prisma Studio, Docker sockets, or admin tools.

## Install Cloudflare Quick Tunnel on Arch Linux / Omarchy

Check whether it is installed:

```sh
command -v cloudflared
cloudflared --version
```

Install from the configured repositories when available:

```sh
sudo pacman -S cloudflared
cloudflared --version
```

If `pacman` cannot find the package, install an AUR package manually. Do not install an AUR helper automatically just for this workflow.

## Start CubeRanked for public development

From the repository root:

```sh
npm run dev:public
```

In a second terminal:

```sh
npm run tunnel
```

The tunnel script checks that `http://localhost:8000` is responding, then starts:

```sh
cloudflared tunnel --url http://localhost:8000
```

The generated `https://*.trycloudflare.com` URL is public until the tunnel process exits.

## Supabase redirects

CubeRanked uses Supabase PKCE auth and detects the session in the browser URL. Because Quick Tunnel hostnames change every time the tunnel restarts, update Supabase for the current tunnel URL:

```text
Supabase Dashboard
  -> Authentication
  -> URL Configuration
  -> Redirect URLs
```

Add the current temporary URL pattern:

```text
https://RANDOM.trycloudflare.com/**
```

Replace `RANDOM.trycloudflare.com` with the hostname printed by `npm run tunnel`. Do not put Supabase service-role keys in the frontend.

## Ngrok fallback

Ngrok is a fallback, not the default:

```sh
command -v ngrok
ngrok config add-authtoken YOUR_TOKEN
ngrok http 8000
```

Never commit the ngrok auth token. Keep ngrok credentials in user-level config, not in this repository.

## Stop the tunnel

Press `Ctrl+C` in the terminal running `npm run tunnel`.

## Uninstall cloudflared

On Arch Linux / Omarchy:

```sh
sudo pacman -R cloudflared
```
