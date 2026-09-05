#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pixi-env.sh"
resolve_pixi
cd "$ROOT"
mkdir -p "$ROOT/.temp/verification-runs"
VERIFY_ROOT="$(mktemp -d "$ROOT/.temp/verification-runs/run-XXXXXXXX")"
echo "Verification artifacts: $VERIFY_ROOT"

generated_manifest() {
  find packages/engine/out/mojo packages/cli/out/mojo packages/tests/out/mojo \
    -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum
}

echo "=== locked dependencies ==="
"$PIXI_BIN" install --manifest-path "$ROOT/pixi.toml" --locked
git diff --exit-code -- package-lock.json pixi.lock

echo "=== architecture contract ==="
node --test test/architecture-contract.test.mjs 2>&1 | tee "$VERIFY_ROOT/architecture.log"

echo "=== Tsonic generation pass 1 ==="
TSONIC_PHASE_TIMINGS=1 \
TSUMO_TSONIC_WORKERS=1 \
TSUMO_BUILD_LOG_DIR="$VERIFY_ROOT/tsonic-pass-1" \
bash scripts/build-tsonic.sh
generated_manifest >"$VERIFY_ROOT/generated-pass-1.sha256"

echo "=== Tsonic generation pass 2 ==="
TSONIC_PHASE_TIMINGS=1 \
TSUMO_TSONIC_WORKERS=1 \
TSUMO_BUILD_LOG_DIR="$VERIFY_ROOT/tsonic-pass-2" \
bash scripts/build-tsonic.sh
generated_manifest >"$VERIFY_ROOT/generated-pass-2.sha256"
diff -u "$VERIFY_ROOT/generated-pass-1.sha256" "$VERIFY_ROOT/generated-pass-2.sha256" \
  | tee "$VERIFY_ROOT/generated-determinism.diff"

echo "=== Mojo formatting ==="
authored_before="$(find "$ROOT/mojo" -type f -name '*.mojo' -print0 | sort -z | xargs -0 sha256sum | sha256sum)"
"$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" mojo format -l 100 "$ROOT/mojo" \
  2>&1 | tee "$VERIFY_ROOT/platform-format.log"
authored_after="$(find "$ROOT/mojo" -type f -name '*.mojo' -print0 | sort -z | xargs -0 sha256sum | sha256sum)"
test "$authored_before" = "$authored_after"
for project in engine cli tests; do
  generated_root="$ROOT/packages/$project/out/mojo"
  format_root="$VERIFY_ROOT/generated-$project-format"
  mapfile -d '' generated_sources < <(find "$generated_root" -type f -name '*.mojo' -print0 | sort -z)
  test "${#generated_sources[@]}" -gt 0
  format_sources=()
  for source in "${generated_sources[@]}"; do
    destination="$format_root/${source#"$generated_root/"}"
    mkdir -p "$(dirname "$destination")"
    cp "$source" "$destination"
    format_sources+=("$destination")
  done
  "$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" mojo format --quiet "${format_sources[@]}" \
    2>&1 | tee "$VERIFY_ROOT/generated-$project-format.log"
  for source in "${generated_sources[@]}"; do
    diff -u "$source" "$format_root/${source#"$generated_root/"}"
  done
  echo "Formatter checked ${#generated_sources[@]} generated modules: $project"
done

echo "=== Mojo products ==="
TSUMO_MOJO_LOG_DIR="$VERIFY_ROOT/mojo" bash scripts/build-mojo.sh

echo "=== native platform contract ==="
"$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" \
  mojo run -I "$ROOT/mojo" "$ROOT/mojo/tests/platform_test.mojo" \
  2>&1 | tee "$VERIFY_ROOT/platform-test.log"

echo "=== compiled Tsonic tests ==="
TSUMO_TEST_ROOT="$VERIFY_ROOT/compiled-test-runs" \
  "$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" "$ROOT/build/tsumo-tests" \
  2>&1 | tee "$VERIFY_ROOT/compiled-tests.log"

echo "=== end-to-end application tests ==="
"$PIXI_BIN" run --manifest-path "$ROOT/pixi.toml" \
  node --test "test/**/*.test.mjs" 2>&1 | tee "$VERIFY_ROOT/e2e.log"

echo "=== tracked dependency immutability ==="
git diff --exit-code -- package-lock.json pixi.lock
echo "ALL VERIFICATIONS PASSED"
