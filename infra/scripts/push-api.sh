#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "${MKC_REVISION:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid revision' >&2; exit 1; }
[[ "${MKC_REGION:-}" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo 'Invalid region' >&2; exit 1; }
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
export DOCKER_CONFIG="$temporary"
registry="$MKC_REGION-docker.pkg.dev"
gcloud auth print-access-token | crane auth login "$registry" -u oauth2accesstoken --password-stdin
tag="release-$MKC_REVISION"
[[ "${ENVIRONMENT:-}" != preview-pr-* ]] || tag="preview-$MKC_REVISION"
crane push .context/images/mkc-api.tar "$registry/mokly-508518/mokly/mkc-api:$tag" \
  --image-refs .context/api-image-ref.txt
