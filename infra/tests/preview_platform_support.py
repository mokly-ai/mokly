"""Faithful command doubles for the shared preview-platform shell tests."""

import base64
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess

from support import ROOT


FIXTURES = ROOT / "infra/tests/fixtures/preview-platform"


class PlatformDouble:
    """Install fixture-backed gcloud, Helm and kubectl command doubles."""

    def __init__(self, directory):
        self.directory = Path(directory)
        self.log = self.directory / "calls"
        self.state = self.directory / "state"
        self.state.mkdir()
        self._write_commands()

    def _write(self, name, body):
        path = self.directory / name
        path.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" + body)
        path.chmod(0o755)

    def _write_commands(self):
        self._write(
            "gcloud",
            r'''printf 'gcloud %s\n' "$*" >> "$CALLS"
if [[ "$*" == *"container clusters get-credentials mkc-autopilot"* ]]; then
  : > "$KUBECONFIG"
  cat "$FIXTURES/gcloud-get-credentials.stderr.txt" >&2
  exit "$(<"$FIXTURES/gcloud-get-credentials.exit.txt")"
fi
if [[ "$*" == *"secrets versions access latest"* ]]; then
  secret=''
  output=''
  for argument in "$@"; do
    [[ "$argument" != --secret=* ]] || secret=${argument#--secret=}
    [[ "$argument" != --out-file=* ]] || output=${argument#--out-file=}
  done
  case "$secret" in
    mkc-preview-origin-tls-key) source="$FIXTURES/${TLS_KEY_FIXTURE:-tls-key.pem}" ;;
    mkc-preview-origin-tls-cert) source="$FIXTURES/${TLS_CERT_FIXTURE:-tls-cert.pem}" ;;
    mkc-catalogue-dns-token) source="$FIXTURES/catalogue-dns-token.txt" ;;
    *) exit 91 ;;
  esac
  cp "$source" "$output"
  printf 'temporary-modes %s %s\n' \
    "$(stat -c %a "$(dirname "$output")")" "$(stat -c %a "$output")" >> "$CALLS"
  cat "$FIXTURES/gcloud-secret-access.stdout.txt"
  cat "$FIXTURES/gcloud-secret-access.stderr.txt" >&2
  exit "$(<"$FIXTURES/gcloud-secret-access.exit.txt")"
fi
exit 92
''',
        )
        self._write(
            "helm",
            r'''printf 'helm %s\n' "$*" >> "$CALLS"
if [[ "$1" == template && "$2" == cert-manager ]]; then
  cat "$FIXTURES/helm-cert-manager-cluster-resources.yaml"
  exit "$(<"$FIXTURES/helm-template.exit.txt")"
elif [[ "$1" == template && "$2" == ingress-nginx ]]; then
  cat "$FIXTURES/helm-ingress-nginx-cluster-resources.yaml"
  exit "$(<"$FIXTURES/helm-template.exit.txt")"
elif [[ "$1" == upgrade && "$2" == --install ]]; then
  :
else
  exit 93
fi
''',
        )
        self._write(
            "kubectl",
            r'''printf 'kubectl %s\n' "$*" >> "$CALLS"
arguments=$*
if [[ "$arguments" == *" auth can-i "* ]]; then
  if [[ -n ${DENY_AUTH:-} && "$arguments" == *"$DENY_AUTH"* ]]; then
    exit "$(<"$FIXTURES/kubectl-auth-denied.exit.txt")"
  fi
  exit "$(<"$FIXTURES/kubectl-auth-allowed.exit.txt")"
fi
if [[ "$arguments" == *" create namespace mkc-preview-system "* ]]; then
  cat "$FIXTURES/kubectl-namespace.json"; exit 0
fi
if [[ "$arguments" == *" create secret tls preview-origin-tls "* ]]; then
  cat "$FIXTURES/kubectl-origin-tls-secret.json"; exit 0
fi
if [[ "$arguments" == *" create secret generic catalogue-dns-token "* ]]; then
  cat "$FIXTURES/kubectl-dns-token-secret.json"; exit 0
fi
if [[ "$arguments" == *" apply -f -"* ]]; then cat >/dev/null; exit 0; fi
if [[ "$arguments" == *" apply -f "* ]]; then exit 0; fi
if [[ "$arguments" == *" label namespace mkc-preview-system "* ]]; then exit 0; fi
if [[ "$arguments" == *" rollout status deployment/"* ]]; then
  cat "$FIXTURES/kubectl-rollout-ready.stdout.txt"
  exit "$(<"$FIXTURES/kubectl-rollout-ready.exit.txt")"
fi
if [[ "$arguments" == *" get namespace mkc-preview-system "* ]]; then
  [[ ${MISSING_NAMESPACE:-false} != true ]] || exit 1
  cat "$FIXTURES/kubectl-namespace.json"; exit 0
fi
if [[ "$arguments" == *" get ingressclass mkc-preview "* ]]; then
  cat "$FIXTURES/kubectl-ingress-class.json"; exit 0
fi
if [[ "$arguments" == *" get secret preview-origin-tls "* ]]; then
  cat "${TLS_SECRET_JSON:-$FIXTURES/kubectl-origin-tls-secret.json}"; exit 0
fi
if [[ "$arguments" == *" get secret catalogue-dns-token "* ]]; then
  cat "$FIXTURES/kubectl-dns-token-secret.json"; exit 0
fi
if [[ "$arguments" == *" get clusterissuer mkc-preview-letsencrypt "* ]]; then
  cat "$FIXTURES/kubectl-cluster-issuer-ready.json"; exit 0
fi
if [[ "$arguments" == *" get service ingress-nginx-controller "* ]]; then
  counter="$DOUBLE_STATE/service-count"
  count=0
  [[ ! -f "$counter" ]] || count=$(<"$counter")
  count=$((count + 1))
  printf '%s' "$count" > "$counter"
  case ${SERVICE_MODE:-ready} in
    pending_then_ready)
      if [[ $count -eq 1 ]]; then fixture=kubectl-service-pending.json; else fixture=kubectl-service-ready.json; fi ;;
    wrong) fixture=kubectl-service-wrong-address.json ;;
    ready) fixture=kubectl-service-ready.json ;;
    *) exit 94 ;;
  esac
  cat "$FIXTURES/$fixture"; exit 0
fi
exit 95
''',
        )
        self._write("sleep", "printf 'sleep %s\\n' \"$*\" >> \"$CALLS\"\n")

    def origin_tls_secret(self, certificate="tls-cert.pem", key="tls-key.pem"):
        secret = json.loads((FIXTURES / "kubectl-origin-tls-secret.json").read_text())
        secret["data"] = {
            "tls.crt": base64.b64encode((FIXTURES / certificate).read_bytes()).decode("ascii"),
            "tls.key": base64.b64encode((FIXTURES / key).read_bytes()).decode("ascii"),
        }
        path = self.directory / "origin-tls.json"
        path.write_text(json.dumps(secret))
        return str(path)

    def without_openssl(self):
        for tool in (
            "bash", "cat", "chmod", "cp", "dirname", "mktemp", "python3", "rm", "stat",
        ):
            (self.directory / tool).symlink_to(shutil.which(tool))
        return str(self.directory)

    def observe_tls_files(self):
        openssl = shutil.which("openssl")
        if openssl is None:
            raise RuntimeError("openssl is required by the preview-platform tests")
        self._write(
            "openssl",
            r'''printf 'openssl %s\n' "$*" >> "$CALLS"
input=''
previous=''
for argument in "$@"; do
  [[ "$previous" != -in ]] || input=$argument
  previous=$argument
done
if [[ -n "$input" ]]; then
  printf 'tls-file %s %s %s\n' "$input" \
    "$(stat -c %a "$(dirname "$input")")" "$(stat -c %a "$input")" >> "$CALLS"
fi
''' + f"exec {shlex.quote(openssl)} \"$@\"\n",
        )

    def tls_files(self):
        return [
            line.removeprefix("tls-file ").rsplit(" ", 2)
            for line in self.calls().splitlines()
            if line.startswith("tls-file ")
        ]

    def environment(self, **overrides):
        environment = dict(
            os.environ,
            PATH=str(self.directory) + ":" + os.environ["PATH"],
            CALLS=str(self.log),
            DOUBLE_STATE=str(self.state),
            FIXTURES=str(FIXTURES),
            MKC_REGION="us-central1",
            MKC_PREVIEW_INGRESS_IP="192.0.2.42",
            MKC_PREVIEW_BLOBS_BUCKET="mokly-508518-preview-blobs",
            MKC_DOMAIN="example.com",
            MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
            MKC_CATALOGUE_CLOUDFLARE_ZONE_ID="a" * 32,
        )
        environment.update(overrides)
        return environment

    def run(self, script="preview-platform.sh", arguments=(), **overrides):
        return subprocess.run(
            ["bash", f"infra/scripts/{script}", *arguments],
            cwd=ROOT,
            env=self.environment(**overrides),
            capture_output=True,
            text=True,
            timeout=30,
        )

    def calls(self):
        return self.log.read_text() if self.log.exists() else ""
