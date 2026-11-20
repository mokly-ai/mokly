#!/usr/bin/env bash
set -euo pipefail

phase=${1:-current}
root=${MKC_BUILDKIT_ROOT:-/var/lib/buildkit}
privilege=${MKC_BUILDKIT_SUDO:-sudo}
probe_timeout=${MKC_BUILDKIT_DIAGNOSTIC_TIMEOUT:-10}

if [[ $root != /* ]]; then
  echo 'MKC_BUILDKIT_ROOT must be an absolute path' >&2
  exit 2
fi
if [[ ! $probe_timeout =~ ^([1-9][0-9]*([.][0-9]+)?|0[.][0-9]*[1-9][0-9]*)$ ]]; then
  echo 'MKC_BUILDKIT_DIAGNOSTIC_TIMEOUT must be a positive number' >&2
  exit 2
fi

filesystem_path=$root
if ! "$privilege" -n test -e "$root"; then
  filesystem_path=$(dirname "$root")
  echo "BuildKit root is not present yet: $root" >&2
fi

echo "BuildKit capacity ($phase):"
echo 'Filesystem blocks:'
if ! "$privilege" -n df -hP "$filesystem_path"; then
  echo "BuildKit filesystem block usage is unavailable for $filesystem_path" >&2
fi
echo 'Filesystem inodes:'
if ! "$privilege" -n df -iP "$filesystem_path"; then
  echo "BuildKit filesystem inode usage is unavailable for $filesystem_path" >&2
fi

if ! "$privilege" -n test -d "$root"; then
  echo "BuildKit root usage is unavailable because $root is not a directory" >&2
  exit 0
fi
echo 'BuildKit root block sum (shared extents may be counted more than once):'
if timeout "$probe_timeout" "$privilege" -n du -sh "$root"; then
  exit 0
else
  status=$?
fi
if [[ $status -eq 124 ]]; then
  echo "BuildKit root usage probe exceeded $probe_timeout seconds; continuing" >&2
else
  echo "BuildKit root usage probe failed with status $status; continuing" >&2
fi
