#!/usr/bin/env bash
# Shared local settings sourced by the API and catalogue launchers.
set -euo pipefail
export MKC_ENV="${MKC_ENV:-development}"
export MKC_DATABASE_URL="${MKC_DATABASE_URL:-postgres://postgres:postgres@localhost/mkc_test}"
export MKC_APP_ORIGIN="${MKC_APP_ORIGIN:-http://localhost:8081}"
export MKC_CATALOGUE_ORIGIN="${MKC_CATALOGUE_ORIGIN:-http://localhost:8082}"
export MKC_CATALOGUE_BIND="${MKC_CATALOGUE_BIND:-127.0.0.1:8082}"
export MKC_FILE_STORE="${MKC_FILE_STORE:-local}"
export MKC_FILE_STORE_ROOT="${MKC_FILE_STORE_ROOT:-$PWD/.context/blobs}"
mkdir -p .context
chmod 700 .context
if [[ -z "${MKC_CATALOGUE_SIGNING_KEY:-}" ]]; then
  mkc_key_file="$PWD/.context/catalogue-signing-key"
  if [[ ! -f "$mkc_key_file" ]]; then
    mkc_key_temp=$(mktemp "$PWD/.context/catalogue-key.XXXXXX")
    python3 -c 'import secrets; print(secrets.token_hex(32))' > "$mkc_key_temp"
    chmod 600 "$mkc_key_temp"
    ln "$mkc_key_temp" "$mkc_key_file" 2>/dev/null || test -f "$mkc_key_file"
    rm "$mkc_key_temp"
  fi
  export MKC_CATALOGUE_SIGNING_KEY
  MKC_CATALOGUE_SIGNING_KEY=$(cat "$mkc_key_file")
fi
export RUSTC_WRAPPER="${RUSTC_WRAPPER:-}"
