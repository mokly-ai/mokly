#!/usr/bin/env bash
set -euo pipefail

environment=${1:?usage: sync-postmark-environment.sh main-preview|production}
case "$environment" in
  main-preview|production) ;;
  *) echo 'Environment must be main-preview or production' >&2; exit 1 ;;
esac

token=$(gcloud secrets versions access latest \
  --project=mokly-508518 \
  --secret="mkc-${environment}-postmark-token")
if [[ -z "$token" ]]; then
  echo "Postmark token for $environment is empty" >&2
  exit 1
fi
echo "::add-mask::$token"
POSTMARK_SERVER_TOKEN="$token" node infra/scripts/sync-postmark-templates.mjs "$environment"
