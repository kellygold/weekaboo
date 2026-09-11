#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/backend"
mkdir -p ../data
exec uv run --frozen uvicorn weekaboo.main:app --host 127.0.0.1 --port 8080 --no-access-log
