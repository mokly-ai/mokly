#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 1 ]] || { echo 'preview-deploy.sh requires exactly one preview-pr-N environment' >&2; exit 1; }
source infra/scripts/preview-common.sh
preview_initialize "$1"
python3 infra/scripts/render-values.py "$environment" > /dev/null
preview_create_temporary
trap 'rm -rf "$preview_temporary"' EXIT

bash infra/scripts/preview-platform-ready.sh
preview_select_cluster
preview_kubectl create namespace "$namespace" --dry-run=client -o json | preview_kubectl apply -f - >/dev/null
pvc_present=false
if [[ -n $(preview_kubectl --namespace "$namespace" get pvc data-postgres-0 --ignore-not-found -o name) ]]; then
  pvc_present=true
fi
preview_ensure_secret postgres-credentials "$pvc_present"
preview_ensure_secret catalogue-signing-key "$pvc_present"

preview_fetch_dns_token
python3 infra/scripts/preview-lifecycle.py dns-upsert "$environment" "$preview_dns_token"
python3 infra/scripts/preview-lifecycle.py iam-upsert "$environment"

mkdir -p .context
python3 infra/scripts/render-values.py "$environment" > "$preview_temporary/release-values.json"
mv "$preview_temporary/release-values.json" .context/release-values.json
python3 infra/scripts/render-values.py --origins .context/release-values.json \
  "$environment" "$MKC_REVISION" > "$preview_temporary/origins"
mapfile -t origins < "$preview_temporary/origins"
export MKC_API_ORIGIN=${origins[0]}
export MKC_APP_ORIGIN=${origins[1]}
export MKC_CATALOGUE_DOMAIN=${origins[2]}
export MKC_DESKTOP_CLIENT=${origins[5]}

previous=$(
  helm list --namespace "$namespace" --deployed --filter '^mokly-cloud$' -o json | \
    python3 infra/scripts/preview-lifecycle.py helm-revision
)

preview_rollback() {
  local failure=$1
  local status=$2
  if [[ -n "$previous" ]]; then
    if helm rollback "$preview_release" "$previous" --namespace "$namespace" \
      --wait --timeout 15m; then
      echo "$failure Restored Helm revision $previous; database and Secrets were preserved." >&2
    else
      local rollback_status=$?
      echo "$failure Helm rollback to revision $previous also failed with status $rollback_status." >&2
    fi
  else
    echo "$failure First-install resources were retained for diagnosis." >&2
  fi
  exit "$status"
}

preview_sync_verifier
chart=infra/helm/mokly-cloud
if helm upgrade --install "$preview_release" "$chart" --namespace "$namespace" \
  -f "$chart/environments/preview-pr.yaml" -f .context/release-values.json \
  --set-string "preview.signInRolloutMarker=$preview_sign_in_rollout_marker" \
  --wait --timeout 15m; then
  :
else
  preview_rollback 'Preview Helm deployment failed.' "$?"
fi
if preview_kubectl --namespace "$namespace" wait --for=condition=Ready \
  certificate/catalogue-tls --timeout=900s; then
  :
else
  preview_rollback 'Preview catalogue certificate did not become ready.' "$?"
fi

export MKC_SMOKE_TIMEOUT_SECONDS=60
[[ -n "$previous" ]] || export MKC_SMOKE_TIMEOUT_SECONDS=900
if python3 infra/scripts/smoke.py; then
  :
else
  preview_rollback 'Preview smoke checks failed.' "$?"
fi
echo "Preview $environment deployed."
