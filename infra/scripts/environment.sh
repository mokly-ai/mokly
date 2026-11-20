#!/usr/bin/env bash
# Shared input validation; sourcing this file performs no provider calls.
set -euo pipefail
environment=${1:?Supply production or main-preview}
[[ "$environment" =~ ^(production|main-preview)$ ]] || { echo 'This command accepts only production or main-preview; PR previews require the preview lifecycle scripts' >&2; exit 1; }
namespace="mkc-$environment"
export TF_VAR_project=mokly-508518
export TF_VAR_environment="$environment"
export TF_VAR_region=${MKC_REGION:?Set MKC_REGION}
export TF_VAR_domain=${MKC_DOMAIN:?Set MKC_DOMAIN}
export TF_VAR_zone_id=${MKC_CLOUDFLARE_ZONE_ID:?Set MKC_CLOUDFLARE_ZONE_ID}
export TF_VAR_catalogue_base_domain=${MKC_CATALOGUE_BASE_DOMAIN:?Set MKC_CATALOGUE_BASE_DOMAIN}
export TF_VAR_catalogue_zone_id=${MKC_CATALOGUE_CLOUDFLARE_ZONE_ID:?Set MKC_CATALOGUE_CLOUDFLARE_ZONE_ID}
export TF_VAR_notification_channels=${MKC_NOTIFICATION_CHANNELS:?Set MKC_NOTIFICATION_CHANNELS to a JSON array of existing channel names}
export TF_VAR_network_id=projects/mokly-508518/global/networks/mkc
[[ "$MKC_DOMAIN" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]+$ ]] || { echo 'Invalid domain' >&2; exit 1; }
[[ "$MKC_REGION" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo 'Invalid region' >&2; exit 1; }
layout_output=$(python3 infra/scripts/render-values.py --domain-layout "$environment" "$MKC_DOMAIN")
mapfile -t layout <<< "$layout_output"
MKC_API_ORIGIN=${layout[0]}
MKC_APP_ORIGIN=${layout[1]}
MKC_INTERNAL_APP_HOST=${layout[2]}
MKC_API_HOST=${MKC_API_ORIGIN#https://}
export MKC_APP_ORIGIN MKC_API_HOST MKC_API_ORIGIN MKC_INTERNAL_APP_HOST
