#!/usr/bin/env bash
set -euo pipefail
provider=${GCP_WORKLOAD_IDENTITY_PROVIDER:-}
service_account=${GCP_SERVICE_ACCOUNT:-}
preview_configuration=false
if [[ -v MKC_PREVIEW_INGRESS_IP || -v MKC_PREVIEW_BLOBS_BUCKET ]]; then
  preview_configuration=true
fi
if { [[ -n "$provider" ]] && [[ -z "$service_account" ]]; } || \
  { [[ -z "$provider" ]] && [[ -n "$service_account" ]]; }; then
  echo 'Cloud identity is partially configured; set both workload-identity provider and service account' >&2
  exit 1
fi
if [[ "$preview_configuration" == true ]]; then
  preview_address=${MKC_PREVIEW_INGRESS_IP:-}
  preview_bucket=${MKC_PREVIEW_BLOBS_BUCKET:-}
  configured=0
  [[ -z "$provider" ]] || configured=$((configured + 1))
  [[ -z "$preview_address" ]] || configured=$((configured + 1))
  [[ -z "$preview_bucket" ]] || configured=$((configured + 1))
  if [[ $configured -ne 0 && $configured -ne 3 ]]; then
    echo 'Cloud deployment is partially configured; set identity, MKC_PREVIEW_INGRESS_IP and MKC_PREVIEW_BLOBS_BUCKET together' >&2
    exit 1
  fi
fi
if [[ -z "$provider" ]]; then
  echo 'SKIP cloud stage: workload-identity provider/service-account secrets are not configured'
  echo 'enabled=false' >> "${GITHUB_OUTPUT:?}"
else
  echo 'enabled=true' >> "${GITHUB_OUTPUT:?}"
fi
