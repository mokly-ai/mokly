#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${RESET_RELEASE:-}" in
  ''|false) reset=false ;;
  true) reset=true ;;
  *) echo 'RESET_RELEASE must be true, false or unset' >&2; exit 1 ;;
esac
source infra/scripts/environment.sh "${1:?Supply environment}"
[[ "${MKC_REVISION:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Set MKC_REVISION to the built Git SHA' >&2; exit 1; }
temporary=$(mktemp -d)
chmod 700 "$temporary"
trap 'rm -rf "$temporary"' EXIT
if [[ -n "${MKC_RELEASE_VALUES:-}" ]]; then
  cp "$MKC_RELEASE_VALUES" "$temporary/values.json"
else
  python3 infra/scripts/render-values.py "$environment" > "$temporary/values.json"
fi
python3 infra/scripts/render-values.py --origins "$temporary/values.json" "$environment" "$MKC_REVISION" > "$temporary/origins"
mapfile -t origins < "$temporary/origins"
[[ "${origins[0]}" == "$MKC_API_ORIGIN" && "${origins[1]}" == "$MKC_APP_ORIGIN" && "${origins[4]}" == "$MKC_INTERNAL_APP_HOST" ]] || {
  echo 'Reviewed release hosts do not match the environment naming contract' >&2
  exit 1
}
export MKC_CATALOGUE_DOMAIN="${origins[2]}" MKC_REGION="${origins[3]}"
export MKC_DESKTOP_CLIENT="${origins[5]}"
chart=infra/helm/mokly-cloud
options=(--namespace "$namespace" -f "$chart/environments/$environment.yaml" -f "$temporary/values.json")
[[ "$reset" != true ]] || options+=(--set resetDatabase=true)
helm lint "$chart" --strict "${options[@]}"
gcloud container clusters get-credentials mkc-autopilot --region="$MKC_REGION" --project=mokly-508518 --dns-endpoint
kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
for purpose in key cert; do
  gcloud secrets versions access latest --project=mokly-508518 \
    --secret="mkc-$environment-origin-tls-$purpose" --out-file="$temporary/tls.$purpose"
done
openssl x509 -in "$temporary/tls.cert" -checkend 86400 -noout
for host in "$MKC_INTERNAL_APP_HOST" "$MKC_API_HOST" "probe.$MKC_CATALOGUE_DOMAIN"; do
  openssl x509 -in "$temporary/tls.cert" -checkhost "$host" -noout
done
kubectl -n "$namespace" create secret tls origin-tls --key="$temporary/tls.key" --cert="$temporary/tls.cert" \
  --dry-run=client -o json | kubectl apply -f -
previous=$(helm list --namespace "$namespace" --deployed --filter '^mokly-cloud$' -o json | \
  python3 -c 'import json,sys; rows=json.load(sys.stdin); print(rows[0]["revision"] if rows else "")')
restore_release() {
  [[ -n "$previous" ]] || return 0
  helm rollback mokly-cloud "$previous" --namespace "$namespace" --wait --wait-for-jobs --timeout 15m
}
quiesce_release() {
  kubectl --namespace "$namespace" delete cronjob auth-prune publication-check-status \
    billing-delivery-status github-prune publication-maintenance \
    --ignore-not-found --cascade=foreground --wait=true --timeout=10m || return 1
  kubectl --namespace "$namespace" delete job mokly-cloud-migrate mokly-cloud-reset-database \
    mokly-cloud-grant-database --ignore-not-found --cascade=foreground --wait=true \
    --timeout=10m || return 1
  kubectl --namespace "$namespace" delete horizontalpodautoscaler api app catalogue \
    --ignore-not-found --wait=true --timeout=10m || return 1
  kubectl --namespace "$namespace" delete poddisruptionbudget api app catalogue \
    --ignore-not-found --wait=true --timeout=10m || return 1
  kubectl --namespace "$namespace" delete deployment api app catalogue \
    --ignore-not-found --cascade=foreground --wait=true --timeout=10m || return 1
}
reset_database() {
  local instance="mkc-$environment"
  local reset_identity="mkc-$environment-reset@mokly-508518.iam.gserviceaccount.com"
  local existing
  existing=$(gcloud sql databases list --project=mokly-508518 --instance="$instance" \
    --filter='name=mokly' --format='value(name)' \
    --impersonate-service-account="$reset_identity") || return 1
  [[ -z "$existing" || "$existing" == mokly ]] || {
    echo 'Database reset lookup returned an unexpected database' >&2
    return 1
  }
  if [[ "$existing" == mokly ]]; then
    gcloud sql databases delete mokly --project=mokly-508518 --instance="$instance" --quiet \
      --impersonate-service-account="$reset_identity" || return 1
  fi
  gcloud sql databases create mokly --project=mokly-508518 --instance="$instance" \
    --impersonate-service-account="$reset_identity"
}
if [[ "$reset" == true ]] && ! quiesce_release; then
  restore_release
  echo 'Database reset preparation failed; inspect the workload and maintenance resources' >&2
  exit 1
fi
if [[ "$reset" == true ]] && ! reset_database; then
  echo 'Database reset failed; workloads remain stopped and the same reset can be retried' >&2
  exit 1
fi
helm_options=(--wait --wait-for-jobs --timeout 15m)
[[ "$reset" == true ]] || helm_options+=(--rollback-on-failure)
if ! helm upgrade --install mokly-cloud "$chart" "${options[@]}" "${helm_options[@]}"; then
  if [[ "$reset" == true ]]; then
    if quiesce_release; then
      echo 'Helm rollout failed after database reset; workloads remain stopped' >&2
    else
      echo 'Helm rollout failed after database reset and some workloads could not be stopped' >&2
    fi
  else
    echo 'Helm rollout failed; inspect the release and migration logs' >&2
  fi
  exit 1
fi
export MKC_SMOKE_TIMEOUT_SECONDS=60
[[ -n "$previous" ]] || export MKC_SMOKE_TIMEOUT_SECONDS=900
if ! python3 infra/scripts/smoke.py; then
  if [[ "$reset" == true ]]; then
    quiesce_release || echo 'Reset smoke failed and some workloads could not be stopped' >&2
  else
    restore_release
  fi
  echo 'Rollout smoke failed; inspect the report and migration logs' >&2
  exit 1
fi
