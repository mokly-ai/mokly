"""Reuse the preview shell's isolated kubeconfig and fixed cluster context."""

from contextlib import contextmanager
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

from preview_seed_types import SeedError


COMMON = "source infra/scripts/preview-common.sh\n"


def print_job_logs(stdout, stderr):
    """Keep both captured streams inside one flushed workflow-command guard."""
    token = secrets.token_hex(32)
    print(f"::stop-commands::{token}", flush=True)
    try:
        for value in (stdout, stderr):
            if isinstance(value, bytes):
                value = value.decode("utf-8", errors="replace")
            if value:
                print(value, end="", flush=True)
    finally:
        print(f"\n::{token}::", flush=True)


def shell(body, arguments, variables, stdin=None, timeout=120, job_logs=False):
    """Pass values as positional arguments, never as shell source."""
    try:
        result = subprocess.run(
            ["bash", "-c", COMMON + body, "preview-seed-job", *arguments],
            env=variables, input=stdin, capture_output=True, text=True,
            timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired as error:
        if job_logs:
            print_job_logs(error.stdout, error.stderr)
            raise SeedError("seed Job log read timed out") from error
        raise SeedError("provider command timed out") from error
    if job_logs:
        print_job_logs(result.stdout, result.stderr)
        if result.returncode:
            raise SeedError(f"seed Job log read failed with exit {result.returncode}")
        return ""
    if result.returncode:
        raise SeedError(result.stderr.strip() or f"provider command exited {result.returncode}")
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    return result.stdout


class Cluster:
    """Invoke kubectl only through preview_kubectl with its selected context."""

    def __init__(self, variables, namespace):
        self.variables = variables
        self.namespace = namespace

    def kubectl(self, arguments, stdin=None, timeout=120, job_logs=False):
        return shell(
            'preview_kube_context=$MKC_PREVIEW_KUBE_CONTEXT\npreview_kubectl "$@"',
            ["--namespace", self.namespace, *arguments],
            self.variables, stdin, timeout, job_logs,
        )


@contextmanager
def selected_cluster(environment, variables):
    """Validate common inputs before credentials, then remove private storage."""
    output = shell(
        'preview_initialize "$1"\npreview_create_temporary\n'
        'printf "%s\\n%s\\n" "$preview_temporary" "$preview_kube_context"',
        [environment], variables,
    )
    temporary, context = output.splitlines()
    try:
        selected = dict(
            variables,
            KUBECONFIG=str(Path(temporary) / "kubeconfig"),
            MKC_PREVIEW_KUBE_CONTEXT=context,
        )
        shell("preview_select_cluster", [], selected)
        yield Cluster(selected, f"mkc-{environment}")
    finally:
        shutil.rmtree(temporary)
