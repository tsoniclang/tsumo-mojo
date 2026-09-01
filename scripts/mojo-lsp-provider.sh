#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pixi-env.sh"
resolve_pixi
exec "$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" mojo-lsp-server "$@"
