#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m pip install -r backend/requirements.txt -c backend/constraints-lock.txt
cd frontend
npm ci --no-audit --no-fund
VITE_API_BASE_URL=/api VITE_HOSTED=true npm run build -- --base=/
