#!/usr/bin/env bash
set -euo pipefail

code_quality() {
  echo "Checking formatting..."
  deno fmt --unstable --check ./src ./test
  echo "Linting..."
  deno lint --unstable ./src ./test
}

update_lock() {
  deno cache ./src/deps.ts  --lock ./lock.json --lock-write
}

"$@"