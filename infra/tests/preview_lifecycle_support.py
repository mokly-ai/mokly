"""Stateful command doubles for preview deploy/destroy shell control flow."""

import base64
import json
import os
from pathlib import Path
import subprocess
import sys

from support import ROOT


FIXTURES = ROOT / "infra/tests/fixtures"
LIFECYCLE_FIXTURES = FIXTURES / "preview-lifecycle"
VERIFIER = (FIXTURES / "preview-verifier.txt").read_bytes().splitlines()[1]


class LifecycleDouble:
    """Install stateful fixture-backed lifecycle command doubles."""

    def __init__(self, directory):
        self.directory = Path(directory)
        self.log = self.directory / "calls"
        self.state = self.directory / "state"
        self.state.mkdir()
        self.runner_temp = self.directory / "runner-temp"
        self.runner_temp.mkdir()
        self.tmpdir = self.directory / "tmp"
        self.tmpdir.mkdir()
        self.checkout = self.directory / "checkout"
        self.checkout.mkdir()
        (self.checkout / "infra").symlink_to(ROOT / "infra", target_is_directory=True)
        self._commands()

    def _write(self, name, body):
        path = self.directory / name
        path.write_text("#!/bin/bash\nset -euo pipefail\n" + body)
        path.chmod(0o755)

    def _commands(self):
        self._write(
            "bash",
            r'''if [[ "${1:-}" == infra/scripts/preview-platform-ready.sh ]]; then
  printf 'platform-ready\n' >> "$CALLS"
  exit "${PLATFORM_READY_STATUS:-0}"
fi
exec /bin/bash "$@"
''',
        )
        self._write(
            "gcloud",
            r'''printf 'gcloud %s\n' "$*" >> "$CALLS"
if [[ "$*" == *"container clusters get-credentials mkc-autopilot"* ]]; then
  : > "$KUBECONFIG"
  cat "$PLATFORM_FIXTURES/gcloud-get-credentials.stderr.txt" >&2
  exit 0
fi
if [[ "$*" == *"secrets versions access latest"* ]]; then
  output=''
  for argument in "$@"; do
    [[ "$argument" != --out-file=* ]] || output=${argument#--out-file=}
  done
  if [[ "$*" == *"--secret=mkc-preview-sign-in-password"* ]]; then
    printf 'verifier file mode=%s\n' "$(stat -c %a "$output" 2>/dev/null || printf missing)" >> "$CALLS"
    case "${VERIFIER_STORE_RESULT:-success}" in
      success) cat "$DOUBLE_STATE/store-verifier" > "$output"; exit 0 ;;
      no-versions)
        cat "$LIFECYCLE_FIXTURES/gcloud-verifier-no-versions.stderr.txt" >&2
        exit "$(<"$LIFECYCLE_FIXTURES/gcloud-verifier-no-versions.exit.txt")"
        ;;
      no-versions-ci)
        cat "$LIFECYCLE_FIXTURES/gcloud-verifier-no-versions-ci.stderr.txt" >&2
        exit "$(<"$LIFECYCLE_FIXTURES/gcloud-verifier-no-versions.exit.txt")"
        ;;
      nonstandard-exit)
        cat "$LIFECYCLE_FIXTURES/gcloud-verifier-no-versions.stderr.txt" >&2
        exit 2
        ;;
      permission)
        printf 'ERROR: (gcloud.secrets.versions.access) PERMISSION_DENIED: Permission secretmanager.versions.access denied.\n' >&2
        exit 1
        ;;
      transport)
        printf 'ERROR: (gcloud.secrets.versions.access) UNAVAILABLE: Connection reset.\n' >&2
        exit 1
        ;;
      other-not-found)
        printf 'ERROR: (gcloud.secrets.versions.access) NOT_FOUND: Secret Version not found.\n' >&2
        exit 1
        ;;
    esac
    exit 91
  fi
  [[ ${DNS_TOKEN_STATUS:-0} == 0 ]] || exit "$DNS_TOKEN_STATUS"
  cp "$PLATFORM_FIXTURES/catalogue-dns-token.txt" "$output"
  exit 0
fi
if [[ ${SEED_JOB_DOUBLE:-false} == true ]]; then
  exec "$REAL_PYTHON" "$SEED_JOB_COMMAND" gcloud "$@"
fi
exit 91
''',
        )
        self._write(
            "python3",
            r'''if [[ "${1:-}" == infra/scripts/smoke.py ]]; then
  printf 'smoke timeout=%s desktop=%s\n' "$MKC_SMOKE_TIMEOUT_SECONDS" "$MKC_DESKTOP_CLIENT" >> "$CALLS"
  exit "${SMOKE_STATUS:-0}"
fi
if [[ "${1:-}" == infra/scripts/preview-lifecycle.py ]]; then
  command=${2:-}
  case "$command" in
    dns-upsert|dns-delete|iam-upsert|iam-remove|objects-delete)
      printf 'lifecycle %s\n' "$command" >> "$CALLS"
      variable="FAIL_${command//-/_}"
      variable=${variable^^}
      status=${!variable:-0}
      [[ "$status" == 0 ]] || exit "$status"
      case "$command" in
        dns-upsert) : > "$DOUBLE_STATE/dns" ;;
        dns-delete) rm -f "$DOUBLE_STATE/dns" ;;
        iam-upsert) : > "$DOUBLE_STATE/iam" ;;
        iam-remove) rm -f "$DOUBLE_STATE/iam" ;;
        objects-delete) rm -f "$DOUBLE_STATE/objects" ;;
      esac
      exit 0
      ;;
  esac
fi
exec "$REAL_PYTHON" "$@"
''',
        )
        self._write(
            "helm",
            r'''printf 'helm %s\n' "$*" >> "$CALLS"
case "${1:-}" in
  list)
    if [[ -f "$DOUBLE_STATE/release" ]]; then
      cat "$LIFECYCLE_FIXTURES/helm-list-deployed.json"
    else
      cat "$LIFECYCLE_FIXTURES/helm-list-empty.json"
    fi
    ;;
  upgrade)
    [[ ${HELM_UPGRADE_STATUS:-0} == 0 ]] || exit "$HELM_UPGRADE_STATUS"
    : > "$DOUBLE_STATE/release"
    : > "$DOUBLE_STATE/pvc"
    cat "$LIFECYCLE_FIXTURES/helm-upgrade.stdout.txt"
    ;;
  rollback)
    [[ ${HELM_ROLLBACK_STATUS:-0} == 0 ]] || exit "$HELM_ROLLBACK_STATUS"
    cat "$LIFECYCLE_FIXTURES/helm-rollback.stdout.txt"
    ;;
  uninstall)
    [[ ${HELM_UNINSTALL_STATUS:-0} == 0 ]] || exit "$HELM_UNINSTALL_STATUS"
    rm -f "$DOUBLE_STATE/release"
    cat "$LIFECYCLE_FIXTURES/helm-uninstall.stdout.txt"
    ;;
  *) exit 92 ;;
esac
''',
        )
        self._write(
            "kubectl",
            r'''printf 'kubectl %s\n' "$*" >> "$CALLS"
arguments=$*
if [[ ${SEED_JOB_DOUBLE:-false} == true ]]; then
  exec "$REAL_PYTHON" "$SEED_JOB_COMMAND" kubectl "$@"
fi
if [[ "$arguments" == *" create namespace mkc-preview-pr-42 "* ]]; then
  cat "$LIFECYCLE_FIXTURES/kubectl-namespace.json"; exit 0
fi
if [[ "$arguments" == *" apply -f -"* ]]; then
  cat >/dev/null
  : > "$DOUBLE_STATE/namespace"
  exit 0
fi
if [[ "$arguments" == *" get pvc data-postgres-0 "* ]]; then
  [[ ! -f "$DOUBLE_STATE/pvc" ]] || printf 'persistentvolumeclaim/data-postgres-0\n'
  exit 0
fi
if [[ "$arguments" == *" get secret postgres-credentials "* ]]; then
  if [[ -f "$DOUBLE_STATE/postgres-secret" ]]; then
    cat "$LIFECYCLE_FIXTURES/kubectl-postgres-secret.json"; exit 0
  fi
  [[ "$arguments" == *"--ignore-not-found"* ]] && exit 0
  exit 1
fi
if [[ "$arguments" == *" get secret catalogue-signing-key "* ]]; then
  if [[ -f "$DOUBLE_STATE/signing-secret" ]]; then
    cat "$LIFECYCLE_FIXTURES/kubectl-signing-secret.json"; exit 0
  fi
  [[ "$arguments" == *"--ignore-not-found"* ]] && exit 0
  exit 1
fi
if [[ "$arguments" == *" get secret preview-sign-in "* ]]; then
  if [[ -f "$DOUBLE_STATE/preview-secret" ]]; then
    cat "$DOUBLE_STATE/preview-secret"; exit 0
  fi
  [[ "$arguments" == *"--ignore-not-found"* ]] && exit 0
  exit 1
fi
if [[ "$arguments" == *" create -f "* || "$arguments" == *" replace -f "* ]]; then
  file=${!#}
  [[ "$file" == */preview-sign-in.json ]] || exit 93
  cp "$file" "$DOUBLE_STATE/preview-secret"
  exit 0
fi
if [[ "$arguments" == *" create secret generic "* ]]; then
  if [[ "$arguments" == *"postgres-credentials"* ]]; then
    name=postgres-credentials; state=postgres-secret
  else
    name=catalogue-signing-key; state=signing-secret
  fi
  if [[ -f "$DOUBLE_STATE/$state" ]]; then
    sed "s/postgres-credentials/$name/g" "$LIFECYCLE_FIXTURES/kubectl-secret-already-exists.stderr.txt" >&2
    exit 1
  fi
  : > "$DOUBLE_STATE/$state"
  if [[ ${SECRET_CONFLICT:-} == "$name" ]]; then
    sed "s/postgres-credentials/$name/g" "$LIFECYCLE_FIXTURES/kubectl-secret-already-exists.stderr.txt" >&2
    exit 1
  fi
  printf 'secret/%s created\n' "$name"
  exit 0
fi
if [[ "$arguments" == *" wait --for=condition=Ready certificate/catalogue-tls "* ]]; then
  [[ ${CERTIFICATE_STATUS:-0} == 0 ]] || exit "$CERTIFICATE_STATUS"
  cat "$LIFECYCLE_FIXTURES/kubectl-certificate-ready.stdout.txt"
  exit 0
fi
if [[ "$arguments" == *" delete namespace mkc-preview-pr-42 "* ]]; then
  [[ ${NAMESPACE_DELETE_STATUS:-0} == 0 ]] || exit "$NAMESPACE_DELETE_STATUS"
  rm -f "$DOUBLE_STATE/namespace" "$DOUBLE_STATE/pvc" \
    "$DOUBLE_STATE/postgres-secret" "$DOUBLE_STATE/signing-secret" \
    "$DOUBLE_STATE/preview-secret"
  cat "$LIFECYCLE_FIXTURES/kubectl-namespace-delete.stdout.txt"
  exit 0
fi
exit 93
''',
        )

    def environment(self, deploy=True, **overrides):
        image = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64
        environment = dict(
            os.environ,
            PATH=str(self.directory) + ":" + os.environ["PATH"],
            RUNNER_TEMP=str(self.runner_temp),
            TMPDIR=str(self.tmpdir),
            CALLS=str(self.log),
            DOUBLE_STATE=str(self.state),
            LIFECYCLE_FIXTURES=str(LIFECYCLE_FIXTURES),
            PLATFORM_FIXTURES=str(FIXTURES / "preview-platform"),
            REAL_PYTHON=sys.executable,
            MKC_REGION="us-central1",
            MKC_DOMAIN="example.com",
            MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
            MKC_CATALOGUE_CLOUDFLARE_ZONE_ID="a" * 32,
            MKC_PREVIEW_INGRESS_IP="192.0.2.42",
            MKC_PREVIEW_BLOBS_BUCKET="mokly-508518-preview-blobs",
        )
        if deploy:
            environment.update(
                MKC_REVISION="a" * 40,
                MKC_API_IMAGE=image,
                MKC_APP_IMAGE=image,
                MKC_CATALOGUE_IMAGE=image,
            )
        environment.pop("MKC_RELEASE_VALUES", None)
        environment.update(overrides)
        return environment

    def run(self, script, deploy=True, verifier=VERIFIER, **overrides):
        (self.state / "store-verifier").write_bytes(verifier)
        return subprocess.run(
            ["/bin/bash", f"infra/scripts/{script}", "preview-pr-42"],
            cwd=self.checkout,
            env=self.environment(deploy, **overrides),
            capture_output=True,
            text=True,
            timeout=30,
        )

    def prime(self, *names):
        for name in names:
            (self.state / name).touch()
        if "preview-secret" in names:
            (self.state / "preview-secret").write_bytes(
                (LIFECYCLE_FIXTURES / "kubectl-preview-secret.json").read_bytes()
            )

    def stored_verifier(self):
        path = self.state / "preview-secret"
        data = json.loads(path.read_bytes()).get("data", {}) if path.exists() else {}
        encoded = data.get("preview-sign-in")
        return base64.b64decode(encoded) if encoded is not None else None

    def calls(self):
        return self.log.read_text() if self.log.exists() else ""

    def helm_rollout_markers(self):
        key = "preview.signInRolloutMarker="
        return [
            argument.removeprefix(key)
            for line in self.calls().splitlines()
            if line.startswith("helm upgrade --install ")
            for argument in line.split()
            if argument.startswith(key)
        ]
