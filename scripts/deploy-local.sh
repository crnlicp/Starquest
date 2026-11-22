#!/usr/bin/env bash
# Deploys all canisters to the project-local network. Never uses prod-identity.
set -euo pipefail

cd "$(dirname "$0")/.."
identity="${ICP_IDENTITY:-anonymous}"
if [[ "$identity" == "prod-identity" ]]; then
  echo "Refusing to deploy locally with prod-identity" >&2
  exit 1
fi

if ! icp network status >/dev/null 2>&1; then
  icp network start -d
fi
icp deploy --identity "$identity" "$@"
