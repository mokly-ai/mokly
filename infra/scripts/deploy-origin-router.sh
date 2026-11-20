#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 0 ]] || { echo 'deploy-origin-router.sh takes no arguments' >&2; exit 1; }
temporary=$(mktemp -d)
chmod 700 "$temporary"
trap 'rm -rf "$temporary"' EXIT
token_file="$temporary/cloudflare-worker-token"
gcloud secrets versions access latest --project=mokly-508518 \
  --secret=mkc-cloudflare-worker-token --out-file="$token_file"
[[ -f "$token_file" ]] || { echo 'Worker credential is empty' >&2; exit 1; }
chmod 600 "$token_file"
[[ -s "$token_file" ]] || { echo 'Worker credential is empty' >&2; exit 1; }
CLOUDFLARE_API_TOKEN=$(<"$token_file")
export CLOUDFLARE_API_TOKEN
npm exec --workspace @mokly-cloud/worker -- wrangler deploy
