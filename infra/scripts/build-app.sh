#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
revision=${MKC_REVISION:-$(git rev-parse HEAD)}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full Git revision' >&2; exit 1; }
: "${EXPO_PUBLIC_MKC_API_ORIGIN:?Supply the API origin baked into this image}"
: "${EXPO_PUBLIC_MKC_APP_ORIGIN:?Supply the app origin baked into this image}"
: "${MKC_CATALOGUE_BASE_DOMAIN:?Supply the catalogue base domain baked into this image}"
mkdir -p .context/images
buildctl build --frontend dockerfile.v0 \
  --local context=. --local dockerfile=infra/docker \
  --opt filename=app.Dockerfile \
  --opt "build-arg:MKC_BUILD_SHA=$revision" \
  --opt "build-arg:EXPO_PUBLIC_MKC_API_ORIGIN=$EXPO_PUBLIC_MKC_API_ORIGIN" \
  --opt "build-arg:EXPO_PUBLIC_MKC_APP_ORIGIN=$EXPO_PUBLIC_MKC_APP_ORIGIN" \
  --opt "build-arg:MKC_CATALOGUE_BASE_DOMAIN=$MKC_CATALOGUE_BASE_DOMAIN" \
  --opt platform=linux/amd64 \
  --output type=docker,dest=.context/images/app.tar
