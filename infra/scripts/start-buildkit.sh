#!/usr/bin/env bash
set -euo pipefail

address=${BUILDKIT_HOST:-unix:///run/buildkit/buildkitd.sock}
log=${MKC_BUILDKIT_LOG:-/tmp/mkc-buildkit.log}
root=${MKC_BUILDKIT_ROOT:-/var/lib/buildkit}
attempts=${MKC_BUILDKIT_ATTEMPTS:-30}
interval=${MKC_BUILDKIT_INTERVAL:-1}
privilege=${MKC_BUILDKIT_SUDO:-sudo}
require_layered=${MKC_BUILDKIT_REQUIRE_LAYERED:-true}
script_dir=$(cd "$(dirname "$0")" && pwd)

if [[ $address != unix:///* ]]; then
  echo 'BuildKit startup requires a unix:// BUILDKIT_HOST' >&2
  exit 2
fi
if [[ $root != /* ]]; then
  echo 'MKC_BUILDKIT_ROOT must be an absolute path' >&2
  exit 2
fi
if [[ ! $attempts =~ ^[1-9][0-9]*$ ]] || [[ ! $interval =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo 'BuildKit readiness attempts and interval are invalid' >&2
  exit 2
fi
if [[ $require_layered != true && $require_layered != false ]]; then
  echo 'MKC_BUILDKIT_REQUIRE_LAYERED must be true or false' >&2
  exit 2
fi

socket=${address#unix://}
daemon=$(command -v buildkitd) || {
  echo 'buildkitd is missing; run bash infra/scripts/install-build-tools.sh' >&2
  exit 1
}
client=$(command -v buildctl) || {
  echo 'buildctl is missing; run bash infra/scripts/install-build-tools.sh' >&2
  exit 1
}
runtime=$(command -v buildkit-runc) || {
  echo 'buildkit-runc is missing; run bash infra/scripts/install-build-tools.sh' >&2
  exit 1
}

readiness_log=$(mktemp)
pid_file=
daemon_pid=
worker_snapshotter=

cleanup() {
  rm -f "$readiness_log"
  if [[ -n $pid_file ]]; then
    "$privilege" -n rm -f "$pid_file" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! pid_file=$("$privilege" -n mktemp); then
  echo 'BuildKit could not create privileged process metadata' >&2
  exit 1
fi

print_diagnostics() {
  if [[ -s $readiness_log ]]; then
    echo 'BuildKit worker probe output:' >&2
    sed 's/^/  /' "$readiness_log" >&2
  fi
  echo "BuildKit daemon log ($log):" >&2
  if [[ -s $log ]]; then
    sed 's/^/  /' "$log" >&2
  else
    echo '  <empty>' >&2
  fi
  MKC_BUILDKIT_ROOT=$root MKC_BUILDKIT_SUDO=$privilege \
    bash "$script_dir/report-buildkit-capacity.sh" 'startup failure' >&2 || true
}

accept_ready_worker() {
  local count
  count=$(awk '$1 == "org.mobyproject.buildkit.worker.snapshotter:" {count++} END {print count + 0}' "$readiness_log")
  if [[ $count -ne 1 ]]; then
    echo 'BuildKit worker probe must report exactly one snapshotter label' >&2
    return 1
  fi
  worker_snapshotter=$(awk '$1 == "org.mobyproject.buildkit.worker.snapshotter:" {print $2}' "$readiness_log")
  case $worker_snapshotter in
    overlayfs | fuse-overlayfs)
      ;;
    native)
      if [[ $require_layered == true ]]; then
        echo 'BuildKit requires overlayfs or fuse-overlayfs, but auto selected native' >&2
        return 1
      fi
      echo 'BuildKit auto selected native; parent snapshots require full copies' >&2
      ;;
    *)
      echo "BuildKit worker reported unsupported snapshotter: $worker_snapshotter" >&2
      return 1
      ;;
  esac
  cat "$readiness_log"
  echo "BuildKit worker snapshotter: $worker_snapshotter"
  MKC_BUILDKIT_ROOT=$root MKC_BUILDKIT_SUDO=$privilege \
    bash "$script_dir/report-buildkit-capacity.sh" 'daemon ready'
}

stop_daemon() {
  if [[ -n $daemon_pid ]] && "$privilege" -n kill -0 "$daemon_pid" 2>/dev/null; then
    "$privilege" -n kill "$daemon_pid" 2>/dev/null || true
  fi
}

if [[ -S $socket ]]; then
  "$privilege" -n chown "$(id -u):$(id -g)" "$socket"
  if "$client" --addr "$address" debug workers --verbose >"$readiness_log" 2>&1; then
    if accept_ready_worker; then
      exit 0
    fi
    print_diagnostics
    exit 1
  fi
  "$privilege" -n rm -f "$socket"
fi

# The privileged shell creates, and keeps ownership of, every file the daemon
# writes: the log and the pid file. With fs.protected_regular on a sticky
# directory such as /tmp, a privileged process may not open a file that
# another user created there.
"$privilege" -n mkdir -p "$(dirname "$socket")"
"$privilege" -n mkdir -p "$(dirname "$log")"
"$privilege" -n rm -f "$log"
"$privilege" -n touch "$log"
"$privilege" -n chmod 0644 "$log"
if ! "$privilege" -n sh -c '
  log=$1
  pid_file=$2
  shift 2
  unset RUNNER_TRACKING_ID
  nohup "$@" >"$log" 2>&1 &
  printf "%s\n" "$!" >"$pid_file"
' sh "$log" "$pid_file" "$daemon" \
    --root "$root" \
    --addr "$address" \
    --containerd-worker=false \
    --debug \
    --oci-worker=true \
    --oci-worker-binary "$runtime" \
    --oci-worker-snapshotter=auto; then
  echo 'BuildKit daemon launch command failed' >&2
  print_diagnostics
  exit 1
fi
if [[ ! -s $pid_file ]]; then
  echo 'BuildKit daemon launch returned no process ID' >&2
  print_diagnostics
  exit 1
fi
daemon_pid=$("$privilege" -n cat "$pid_file")

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if ! "$privilege" -n kill -0 "$daemon_pid" 2>/dev/null; then
    echo 'BuildKit daemon exited before readiness' >&2
    print_diagnostics
    exit 1
  fi
  if [[ -S $socket ]]; then
    "$privilege" -n chown "$(id -u):$(id -g)" "$socket"
    if "$client" --addr "$address" debug workers --verbose >"$readiness_log" 2>&1; then
      if accept_ready_worker; then
        exit 0
      fi
      stop_daemon
      print_diagnostics
      exit 1
    fi
  fi
  sleep "$interval"
done

echo "BuildKit worker did not become ready after $attempts probes" >&2
stop_daemon
print_diagnostics
exit 1
