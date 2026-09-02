#!/usr/bin/env bash

resolve_pixi() {
  if [[ -n "${PIXI_BIN:-}" ]]; then
    return
  fi
  PIXI_BIN="$(command -v pixi || true)"
  if [[ -z "$PIXI_BIN" && -x "$HOME/.pixi/bin/pixi" ]]; then
    PIXI_BIN="$HOME/.pixi/bin/pixi"
  fi
  if [[ -z "$PIXI_BIN" ]]; then
    echo "Pixi was not found; set PIXI_BIN or install pixi on PATH." >&2
    return 1
  fi
  export PIXI_BIN
}
