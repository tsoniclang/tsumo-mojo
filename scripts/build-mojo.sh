#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pixi-env.sh"
resolve_pixi
mkdir -p "$ROOT/build" "$ROOT/.temp/build-runs"
LOG_ROOT="${TSUMO_MOJO_LOG_DIR:-$(mktemp -d "$ROOT/.temp/build-runs/mojo-XXXXXXXX")}"
mkdir -p "$LOG_ROOT"

build_project() {
  local project="$1"
  local artifact="$2"
  local output="$ROOT/packages/$project/out/mojo"
  /usr/bin/time -v timeout "${TSUMO_MOJO_TIMEOUT:-15m}" \
    prlimit --as="${TSUMO_MOJO_MEMORY_LIMIT:-12884901888}" -- \
    "$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" \
    node "$ROOT/scripts/build-generated-project.mjs" "$output" "$ROOT/build/$artifact" "$ROOT/mojo"
}

failed=0
for project in engine cli tests; do
  case "$project" in
    engine) artifact="tsumo_engine.mojoc" ;;
    cli) artifact="tsumo" ;;
    tests) artifact="tsumo-tests" ;;
  esac
  if build_project "$project" "$artifact" >"$LOG_ROOT/$project.log" 2>&1; then
    status="PASS"
  else
    status="FAIL"
    failed=1
  fi
  echo "=== Mojo $project: $status ==="
  cat "$LOG_ROOT/$project.log"
done
echo "Mojo build logs: $LOG_ROOT"
test "$failed" -eq 0
