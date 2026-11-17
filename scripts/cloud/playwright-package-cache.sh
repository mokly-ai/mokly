#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

cache_directory="$RUNNER_TEMP/playwright-apt-archives"
archive_directory=/var/cache/apt/archives

case "$1" in
  prepare)
    mkdir -p "$cache_directory"
    # Image cleanup hooks would otherwise remove archives before cache save.
    sudo rm -f /etc/apt/apt.conf.d/docker-clean
    printf '%s\n' \
      'APT::Keep-Downloaded-Packages "true";' \
      'Binary::apt-get::APT::Keep-Downloaded-Packages "true";' |
      sudo tee /etc/apt/apt.conf.d/99-mkc-download-cache >/dev/null
    sudo apt-get update

    playwright_version=$(node -p "require('./ts/package-lock.json').packages['node_modules/playwright-core'].version")
    # A refreshed index or runner image must not reuse an immutable old key.
    apt_state=$(
      {
        printf '%s\0' /var/lib/dpkg/status
        find /var/lib/apt/lists -maxdepth 1 -type f -name '*_Packages*' -print0
      } | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1
    )
    source /etc/os-release
    printf 'playwright=%s\nubuntu=%s\nstate=%s\n' \
      "$playwright_version" "$VERSION_ID" "$apt_state" >>"$GITHUB_OUTPUT"
    ;;
  restore)
    find "$cache_directory" -maxdepth 1 -type f -name '*.deb' \
      -exec sudo cp -t "$archive_directory" -- {} +
    ;;
  stage)
    find "$archive_directory" -maxdepth 1 -type f -name '*.deb' \
      -exec cp -t "$cache_directory" -- {} +
    ;;
  *)
    printf 'Usage: %s prepare|restore|stage\n' "$0" >&2
    exit 2
    ;;
esac
