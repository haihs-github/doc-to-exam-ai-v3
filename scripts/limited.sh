#!/usr/bin/env bash
# Created by Haihs on 11/11/2026
# Runs a command under 2 CPU / 3GB RAM / no swap limits via systemd-run.
if ! command -v systemd-run >/dev/null 2>&1; then
  echo "limited.sh: systemd-run not found; refusing to run without limits" >&2
  exit 2
fi
exec systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 -p CPUQuota=200% \
  --setenv=NODE_OPTIONS=--max-old-space-size=2048 -- "$@"
