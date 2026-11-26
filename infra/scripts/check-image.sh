#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Each argument selects one image. No argument selects all three, in order.
images=("$@")
(( ${#images[@]} )) || images=(api catalogue app)
for image in "${images[@]}"; do
  case $image in
    api | catalogue | app) ;;
    *) echo "Unknown workload image: $image; expected api, catalogue, or app" >&2; exit 2 ;;
  esac
done

for tool in buildctl crane; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "SKIP workload image builds: $tool is missing; run bash infra/scripts/install-build-tools.sh then bash infra/scripts/start-buildkit.sh"
    exit 0
  fi
done
if ! buildctl debug workers >/dev/null; then
  echo 'BuildKit is installed but unavailable; run bash infra/scripts/start-buildkit.sh' >&2
  exit 1
fi

capacity() {
  bash infra/scripts/report-buildkit-capacity.sh "$1"
}

build_image() {
  local name=$1
  shift
  if "$@"; then
    capacity "$name image complete"
    return 0
  else
    local status=$?
  fi
  capacity "$name image failure" || true
  return "$status"
}

build_selected() {
  case $1 in
    api) build_image API bash infra/scripts/build-api.sh ;;
    catalogue) build_image catalogue bash infra/scripts/build-catalogue.sh ;;
    app)
      build_image app env \
        EXPO_PUBLIC_MKC_API_ORIGIN=https://api.build.invalid \
        EXPO_PUBLIC_MKC_APP_ORIGIN=https://build.invalid \
        MKC_CATALOGUE_BASE_DOMAIN=catalogues.build.invalid \
        bash infra/scripts/build-app.sh
      ;;
  esac
}

capacity 'image gate entry'
for image in "${images[@]}"; do
  build_selected "$image"
done
