#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 1 ]] || { echo 'preview-destroy.sh requires exactly one preview-pr-N environment' >&2; exit 1; }
source infra/scripts/preview-common.sh
preview_initialize "$1"
preview_create_temporary
trap 'rm -rf "$preview_temporary"' EXIT
preview_select_cluster

failed=0
if ! helm uninstall "$preview_release" --namespace "$namespace" \
  --ignore-not-found --wait --timeout 15m; then
  echo "Helm uninstall failed for $environment; namespace deletion will still run." >&2
  failed=1
fi
if ! preview_kubectl delete namespace "$namespace" --ignore-not-found \
  --wait=true --timeout=900s; then
  echo "Namespace/$namespace was not deleted; external preview cleanup was not started." >&2
  exit 1
fi

if ! python3 infra/scripts/preview-lifecycle.py iam-remove "$environment"; then
  failed=1
fi
if ! python3 infra/scripts/preview-lifecycle.py objects-delete "$environment"; then
  failed=1
fi
if preview_fetch_dns_token; then
  if ! python3 infra/scripts/preview-lifecycle.py dns-delete "$environment" "$preview_dns_token"; then
    failed=1
  fi
else
  failed=1
fi
if (( failed != 0 )); then
  echo "Preview cleanup for $environment completed with errors; rerun the same command." >&2
  exit 1
fi
echo "Preview $environment removed."
