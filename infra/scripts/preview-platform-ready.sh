#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ $# -eq 0 ]] || { echo 'preview-platform-ready.sh takes no arguments' >&2; exit 1; }
source infra/scripts/preview-platform-common.sh
preview_validate_inputs
preview_load_local_configuration
if ! command -v openssl >/dev/null 2>&1; then
  echo 'openssl is required to check preview platform readiness' >&2
  exit 1
fi
umask 077
preview_temporary=$(mktemp -d)
chmod 700 "$preview_temporary"
trap 'rm -rf "$preview_temporary"' EXIT
if ! preview_select_cluster >/dev/null 2>&1; then
  preview_not_ready "Cluster/$preview_cluster"
fi
if ! preview_wait_for_readiness 60; then
  preview_not_ready "$preview_failed_resource"
fi
echo "Preview platform ready at $MKC_PREVIEW_INGRESS_IP."
