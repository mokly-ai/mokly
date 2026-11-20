#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${MKC_DOMAIN:?Supply the application domain}"
: "${MKC_CATALOGUE_BASE_DOMAIN:?Supply the catalogue base domain}"
[[ $# -gt 0 ]] || { echo 'Supply at least one environment' >&2; exit 1; }
for environment in "$@"; do
  [[ "$environment" =~ ^(production|main-preview|preview-pr-[1-9][0-9]{0,8})$ ]] || { echo 'Invalid environment' >&2; exit 1; }
done
bash infra/scripts/build-api.sh
bash infra/scripts/build-catalogue.sh
for environment in "$@"; do
  layout_output=$(python3 infra/scripts/render-values.py --domain-layout "$environment" "$MKC_DOMAIN")
  mapfile -t layout <<< "$layout_output"
  api_origin=${layout[0]}
  app_origin=${layout[1]}
  EXPO_PUBLIC_MKC_API_ORIGIN="$api_origin" \
  EXPO_PUBLIC_MKC_APP_ORIGIN="$app_origin" \
  MKC_CATALOGUE_BASE_DOMAIN="$MKC_CATALOGUE_BASE_DOMAIN" \
    bash infra/scripts/build-app.sh
  mv .context/images/app.tar ".context/images/app-$environment.tar"
done
