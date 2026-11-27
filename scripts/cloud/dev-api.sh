#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/cloud/dev-publication-env.sh
export MKC_DESKTOP_CLIENT="${MKC_DESKTOP_CLIENT:-true}"
umask 077
mkc_preview_file="$PWD/.context/preview-password"
if [[ ! -e "$mkc_preview_file" ]]; then
  mkc_preview_temp=$(mktemp "$mkc_preview_file.XXXXXX")
  python3 -c 'import secrets; print(secrets.token_urlsafe(24), end="")' > "$mkc_preview_temp"
  chmod 600 "$mkc_preview_temp"
  ln "$mkc_preview_temp" "$mkc_preview_file" 2>/dev/null || test -f "$mkc_preview_file"
  rm "$mkc_preview_temp"
fi
python3 - "$mkc_preview_file" <<'PY'
from pathlib import Path
import stat
import sys

path = Path(sys.argv[1])
metadata = path.lstat()
if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
    raise SystemExit(".context/preview-password must be a regular mode-0600 file")
PY
MKC_PREVIEW_SIGN_IN_VERIFIER=$(python3 infra/scripts/preview-lifecycle.py preview-verifier < "$mkc_preview_file")
export MKC_PREVIEW_SIGN_IN_VERIFIER
export MKC_PREVIEW_SIGN_IN_EMAIL=preview@mokly.ai
export MKC_PREVIEW_SIGN_IN_PLAN=team
export MKC_BIND="${MKC_BIND:-127.0.0.1:8080}"
export MKC_API_ORIGIN="${MKC_API_ORIGIN:-http://localhost:8080}"
export MKC_MAILER="${MKC_MAILER:-log}"
if [[ $# -eq 0 ]]; then
  set -- serve
fi
if [[ "$1" == preview-seed ]]; then
  mkc_seed_directory="$MKC_FILE_STORE_ROOT/seed/local"
  rm -rf -- "$mkc_seed_directory"
  mkdir -p "$mkc_seed_directory"
  for mkc_seed_input in plan.tar.gz blobs; do
    if [[ -e ".context/seed/catalogue/$mkc_seed_input" ]]; then
      mkdir -p "$mkc_seed_directory/catalogue"
      cp -R ".context/seed/catalogue/$mkc_seed_input" "$mkc_seed_directory/catalogue/"
    fi
  done
  python3 - "$mkc_seed_directory/request.json" "$(git rev-parse HEAD)" <<'PY'
import json
from pathlib import Path
import sys

request = {
    "schemaVersion": 1,
    "environment": "local",
    "revision": sys.argv[2],
    "pullRequest": None,
}
Path(sys.argv[1]).write_text(json.dumps(request) + "\n", encoding="utf-8")
PY
  set -- preview-seed --run local "${@:2}"
fi
exec cargo run --locked -p mkc-api -- "$@"
