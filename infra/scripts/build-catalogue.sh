#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
revision=${MKC_REVISION:-$(git rev-parse HEAD)}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full Git revision' >&2; exit 1; }
rust_version=$(sed -n 's/^channel = "\([^"]*\)"/\1/p' rust-toolchain.toml)
mkdir -p .context/images
buildctl build --frontend dockerfile.v0 \
  --local context=. --local dockerfile=infra/docker \
  --opt filename=mkc-catalogue-server.Dockerfile \
  --opt "build-arg:RUST_VERSION=$rust_version" \
  --opt "build-arg:MKC_BUILD_SHA=$revision" \
  --opt platform=linux/amd64 \
  --output type=docker,dest=.context/images/mkc-catalogue-server.tar
