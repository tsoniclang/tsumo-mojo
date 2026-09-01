#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pixi-env.sh"
resolve_pixi
mkdir -p "$ROOT/build" "$ROOT/.temp/build-runs"
LOG_ROOT="${TSUMO_MOJO_LOG_DIR:-$(mktemp -d "$ROOT/.temp/build-runs/mojo-XXXXXXXX")}"
mkdir -p "$LOG_ROOT"

mojo_command() {
  local project="$1"
  shift
  local output="$ROOT/packages/$project/out/mojo"
  /usr/bin/time -v timeout "${TSUMO_MOJO_TIMEOUT:-15m}" \
    "$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" \
    mojo "$@" -I "$output/src" -I "$output/packages" -I "$ROOT/mojo"
}

mojo_command engine precompile \
  "$ROOT/packages/engine/out/mojo/src/tsumo_engine" \
  -o "$ROOT/build/tsumo_engine.mojoc" \
  >"$LOG_ROOT/engine.log" 2>&1

mojo_command cli build \
  "$ROOT/packages/cli/out/mojo/src/main.mojo" \
  -o "$ROOT/build/tsumo" \
  >"$LOG_ROOT/cli.log" 2>&1

mojo_command tests build \
  "$ROOT/packages/tests/out/mojo/src/main.mojo" \
  -o "$ROOT/build/tsumo-tests" \
  >"$LOG_ROOT/tests.log" 2>&1

for project in engine cli tests; do
  echo "=== Mojo $project: PASS ==="
  cat "$LOG_ROOT/$project.log"
done
echo "Mojo build logs: $LOG_ROOT"
