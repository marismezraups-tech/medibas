#!/usr/bin/env bash
# Ātrā pārbaude no datora: palaiž serveri un izveido drošu (https) saiti telefonam.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Vajag Node.js: https://nodejs.org (LTS versija)"; exit 1; }
PORT=${PORT:-8080}
PORT=$PORT node server.js & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
if command -v cloudflared >/dev/null; then
  echo; echo ">>> Atver telefonā adresi, kas beidzas ar .trycloudflare.com (parādīsies zemāk)"; echo
  cloudflared tunnel --url http://localhost:$PORT
else
  echo
  echo "Serveris darbojas: http://localhost:$PORT"
  echo "Lai atvērtu telefonā, vajag https saiti. Uzinstalē cloudflared:"
  echo "  macOS:  brew install cloudflared"
  echo "  Linux:  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  echo "un palaid šo skriptu vēlreiz."
  wait $SRV
fi
