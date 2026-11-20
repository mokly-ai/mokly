#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "${MKC_REVISION:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid revision' >&2; exit 1; }
[[ "${MKC_REGION:-}" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo 'Invalid region' >&2; exit 1; }
[[ $# -gt 0 ]] || { echo 'Supply at least one environment' >&2; exit 1; }
for environment in "$@"; do
  [[ "$environment" =~ ^(production|main-preview|preview-pr-[1-9][0-9]{0,8})$ ]] || { echo 'Invalid environment' >&2; exit 1; }
done
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
export DOCKER_CONFIG="$temporary"
registry="$MKC_REGION-docker.pkg.dev"
gcloud auth print-access-token | crane auth login "$registry" -u oauth2accesstoken --password-stdin
tag="release-$MKC_REVISION"
[[ "$1" != preview-pr-* ]] || tag="preview-$MKC_REVISION"
for workload in mkc-api mkc-catalogue-server; do
  name=api
  [[ "$workload" != mkc-catalogue-server ]] || name=catalogue
  crane push ".context/images/$workload.tar" "$registry/mokly-508518/mokly/$workload:$tag" \
    --image-refs ".context/$name-image-ref.txt"
done
for environment in "$@"; do
  crane push ".context/images/app-$environment.tar" "$registry/mokly-508518/mokly/app:$tag-$environment" \
    --image-refs ".context/app-$environment-image-ref.txt"
done
