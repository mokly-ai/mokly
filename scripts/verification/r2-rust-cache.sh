#!/usr/bin/env bash
# Restores and saves the CI Rust build cache in a Cloudflare R2 bucket.
#
#   r2-rust-cache.sh check
#   r2-rust-cache.sh key JOB_KEY LOCK_HASH
#   r2-rust-cache.sh restore KEY RESTORE_PREFIX
#   r2-rust-cache.sh save KEY
#
# `check` writes `enabled=true` to GITHUB_OUTPUT only when the credentials,
# the bucket, and the tools are present. Otherwise it writes `enabled=false`,
# and the job uses the GitHub Actions cache. `key` writes `key` and
# `restore-prefix`. `restore` tries KEY, then the
# newest object under RESTORE_PREFIX, and writes `cache-hit` and `seconds`.
# A failed restore is a cache miss. `save` removes the workspace crate builds,
# as Swatinem/rust-cache does, and uploads the archive when KEY is new.
#
# Environment: R2_CACHE_BUCKET, R2_CACHE_ENDPOINT, AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, and optionally R2_CACHE_PREFIX and CARGO_TARGET_DIR.
set -euo pipefail

export AWS_DEFAULT_REGION=auto AWS_REGION=auto
prefix=${R2_CACHE_PREFIX:-rust}
target=${CARGO_TARGET_DIR:-target}
cargo_home=${CARGO_HOME:-$HOME/.cargo}
# Git Bash on Windows: tar reads `C:\...` as a remote host.
if command -v cygpath > /dev/null; then cargo_home=$(cygpath -u "$cargo_home"); fi
paths=("$target" "$cargo_home/registry/index" "$cargo_home/registry/cache" "$cargo_home/git/db")
output=${GITHUB_OUTPUT:-/dev/null}

now() { date +%s; }
s3() { aws --endpoint-url "$R2_CACHE_ENDPOINT" "$@"; }
object() { printf 's3://%s/%s/%s.tar.zst' "$R2_CACHE_BUCKET" "$prefix" "$1"; }

check() {
  local missing=()
  for name in R2_CACHE_BUCKET R2_CACHE_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
    [ -n "${!name:-}" ] || missing+=("$name")
  done
  for tool in aws zstd tar node; do
    command -v "$tool" > /dev/null || missing+=("$tool")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "R2 cache off, missing: ${missing[*]}. The job uses the GitHub Actions cache."
    echo "enabled=false" >> "$output"
  else
    echo "enabled=true" >> "$output"
  fi
}

# The key covers the same inputs as the Swatinem/rust-cache key: the job key,
# the runner platform, the toolchain, the Cargo environment, and the hash of
# the lockfile and manifests in LOCK_HASH. The restore prefix omits LOCK_HASH,
# so a lockfile change restores the newest older entry.
key() {
  local job_key=$1 lock_hash=$2 env_hash
  env_hash=$({
    rustc -vV
    cargo -V
    env | grep -E '^(CARGO|CC|CFLAGS|CXX|CMAKE|RUST)' | sort
  } | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () =>
      console.log(require("node:crypto").createHash("sha256").update(s).digest("hex").slice(0, 16)));')
  local restore_prefix="r2-rust-$job_key-${RUNNER_OS:-local}-${RUNNER_ARCH:-local}-$env_hash-"
  printf 'key=%s%s\nrestore-prefix=%s\n' "$restore_prefix" "${lock_hash:0:16}" "$restore_prefix" | tee -a "$output"
}

restore() {
  local key=$1 restore_prefix=$2 start found archive
  start=$(now)
  archive="${RUNNER_TEMP:-/tmp}/r2-rust-cache.tar.zst"
  found=$key
  if ! s3 s3api head-object --bucket "$R2_CACHE_BUCKET" --key "$prefix/$key.tar.zst" > /dev/null 2>&1; then
    found=$(s3 s3api list-objects-v2 --bucket "$R2_CACHE_BUCKET" --prefix "$prefix/$restore_prefix" \
      --query 'sort_by(Contents, &LastModified)[-1].Key' --output text 2> /dev/null || true)
    found=${found#"$prefix/"}
    found=${found%.tar.zst}
    if [ -z "$found" ] || [ "$found" = None ]; then
      echo "No R2 cache entry for $key or $restore_prefix."
      printf 'cache-hit=false\nseconds=%s\n' "$(($(now) - start))" >> "$output"
      return 0
    fi
  fi
  local hit=false downloaded
  if s3 s3 cp --only-show-errors "$(object "$found")" "$archive"; then
    downloaded=$(now)
    # Unpack into empty paths, also after a GitHub cache restore of a trial.
    rm -rf "${paths[@]}"
    if zstd -d -q -c "$archive" | tar -xPf -; then
      echo "Restored $found: download $((downloaded - start)) s, unpack $(($(now) - downloaded)) s."
      [ "$found" != "$key" ] || hit=true
    else
      # A partial unpack can leave a truncated build with a valid fingerprint.
      rm -rf "${paths[@]}"
      echo "::warning::R2 cache unpack of $found failed. The build runs cold."
    fi
  else
    echo "::warning::R2 cache download of $found failed. The build runs without it."
  fi
  echo "cache-hit=$hit" >> "$output"
  rm -f "$archive"
  echo "seconds=$(($(now) - start))" >> "$output"
}

# Remove every build of a workspace target, the top-level outputs, and the
# incremental data, so the entry holds dependency builds only.
clean() {
  local names
  names=$(cargo metadata --no-deps --format-version 1 | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const names = new Set();
      for (const p of JSON.parse(s).packages) {
        names.add(p.name.replaceAll("-", "_"));
        for (const t of p.targets) names.add(t.name.replaceAll("-", "_"));
      }
      console.log([...names].join("\n"));
    });')
  # A profile directory holds `deps`. The xtask alias and the native build
  # nest theirs, for example `target/xtask/debug`.
  find "$target" -maxdepth 4 -type d -name deps 2> /dev/null | while read -r deps; do
    profile=$(dirname "$deps")
    find "$profile" -maxdepth 1 -type f -delete
    rm -rf "$profile/incremental" "$profile/examples"
    for entry in "$profile"/deps/* "$profile"/build/* "$profile"/.fingerprint/*; do
      [ -e "$entry" ] || continue
      base=$(basename "$entry")
      base=${base#lib}
      base=${base%%.*}
      base=${base%-*}
      if grep -qxF -- "${base//-/_}" <<< "$names"; then rm -rf "$entry"; fi
    done
  done
}

save() {
  local key=$1 start existing=()
  if s3 s3api head-object --bucket "$R2_CACHE_BUCKET" --key "$prefix/$key.tar.zst" > /dev/null 2>&1; then
    echo "R2 cache entry $key exists. A key never changes after its first save."
    return 0
  fi
  clean
  for path in "${paths[@]}"; do [ -e "$path" ] && existing+=("$path"); done
  start=$(now)
  if tar -cPf - "${existing[@]}" | zstd -T0 -3 -q | s3 s3 cp --only-show-errors - "$(object "$key")"; then
    echo "Saved R2 cache entry $key in $(($(now) - start)) s."
  else
    echo "::warning::R2 cache save of $key failed."
  fi
}

case ${1:-} in
  check) check ;;
  key) key "$2" "$3" ;;
  restore) restore "$2" "$3" ;;
  save) save "$2" ;;
  *)
    echo "usage: $0 check | key JOB_KEY LOCK_HASH | restore KEY RESTORE_PREFIX | save KEY" >&2
    exit 2
    ;;
esac
