#!/usr/bin/dumb-init /bin/bash
# shellcheck shell=bash
set -euo pipefail

deno run --cached-only --unstable -A /app/app.js start "$@"