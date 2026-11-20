#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/cloud/dev-publication-env.sh
export MKC_DESKTOP_CLIENT="${MKC_DESKTOP_CLIENT:-true}"
exec cargo run --locked -p mkc-catalogue-server -- serve
