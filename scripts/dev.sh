#!/usr/bin/env bash
# Helper script for development in the container, without VS Code.
# Usage: scripts/dev.sh <command>
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE=(docker compose -f .devcontainer/docker-compose.yml)
SERVICE=app

# Under WSL2, a repo on a Windows drive (/mnt/<x>/...) needs polling watchers.
if [[ "$PWD" == /mnt/[a-z]/* && -z "${VITE_USE_POLLING:-}" ]]; then
  export VITE_USE_POLLING=true
  echo "Note: repo is on a Windows drive, enabling polling (VITE_USE_POLLING=true)."
fi

usage() {
  cat <<'EOF'
Commands:
  up       Build and start the container, install dependencies
  dev      Start the dev server (http://localhost:5173), stop with Ctrl+C
  preview  Create a production build and serve it on http://localhost:4173
  check    Run lint, tests and build (same as CI)
  test     Run tests in watch mode
  shell    Open a shell in the container
  logs     Follow the container logs
  down     Stop the container (the node_modules volume is kept)
  reset    Stop the container and delete the node_modules volume

Environment variables: DEV_PORT (5173), PREVIEW_PORT (4173), VITE_USE_POLLING (false)
EOF
}

run() { "${COMPOSE[@]}" exec "$SERVICE" "$@"; }

ensure_up() {
  "${COMPOSE[@]}" up -d --build
  run sudo chown node:node node_modules
  run npm ci
}

cmd="${1:-}"
case "$cmd" in
  up)
    ensure_up
    echo "Ready. Next step: scripts/dev.sh dev"
    ;;
  dev)
    ensure_up
    run npm run dev
    ;;
  preview)
    ensure_up
    run npm run build
    run npm run preview
    ;;
  check)
    ensure_up
    run npm run lint
    run npm test
    run npm run build
    ;;
  test)
    ensure_up
    run npm run test:watch
    ;;
  shell)
    ensure_up
    run bash
    ;;
  logs)
    "${COMPOSE[@]}" logs -f "$SERVICE"
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  reset)
    "${COMPOSE[@]}" down -v
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
