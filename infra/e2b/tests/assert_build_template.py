#!/usr/bin/env python3
"""Verify a fresh candidate through the workload streaming-process boundary."""

import argparse
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import tempfile


TEMPLATE_HOME = "/home/user"
PROBE_KEY = "MKC_TEMPLATE_PROBE"
PROBE_VALUE = "stream-process-added-env"
SECRET_KEYS = {
    "E2B_API_KEY", "MKC_E2B_API_KEY", "MOKLY_TOKEN", "GITHUB_TOKEN", "GH_TOKEN",
    "GIT_ASKPASS", "SSH_ASKPASS", "GOOGLE_APPLICATION_CREDENTIALS",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
    "POSTMARK_SERVER_TOKEN", "MKC_DATABASE_URL", "MKC_STRIPE_SECRET_KEY",
    "MKC_STRIPE_WEBHOOK_SECRET", "MKC_GITHUB_CLIENT_SECRET",
    "MKC_GITHUB_PRIVATE_KEY", "MKC_GITHUB_WEBHOOK_SECRET",
    "MKC_CATALOGUE_SIGNING_KEY", "MKC_PREVIEW_SIGN_IN_VERIFIER",
}
CREDENTIAL_FILES = (
    ".mokly-git-credentials", ".git-credentials", ".netrc", ".npmrc",
    ".aws/credentials", ".aws/config", ".docker/config.json",
    ".config/gcloud/application_default_credentials.json",
    ".config/gcloud/credentials.db", ".config/gcloud/access_tokens.db",
    ".ssh/id_rsa", ".ssh/id_ed25519", ".ssh/id_ecdsa", ".ssh/id_dsa",
)
NPM_PROBE_NAME = "mokly-template-probe"
NPM_PROBE_FILES = {
    "package.json": {"name": NPM_PROBE_NAME, "private": True},
    "package-lock.json": {"name": NPM_PROBE_NAME, "lockfileVersion": 3, "requires": True,
                          "packages": {"": {"name": NPM_PROBE_NAME}}},
}
NPM_CLEAN_INSTALL = ["npm", "ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
                     "--no-update-notifier"]
# Mokly reads a comparison base through NUL-terminated `cat-file` batches, which Git 2.42 added.
# Git 2.43.0 is the oldest release with a recorded working comparison.
GIT_MINIMUM = (2, 43)
GIT_NUL_BATCH = ["git", "cat-file", "--batch", "--filters", "-Z"]


class TemplateAssertionError(RuntimeError):
    """A candidate does not meet the cloud build template contract."""


def require(condition, message):
    if not condition:
        raise TemplateAssertionError(message)


def command(argv, cwd=None):
    """Run a bounded probe on empty stdin without a shell or environment replacement."""
    try:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=10, cwd=cwd,
                                stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise TemplateAssertionError(f"{argv[0]} could not run") from error
    require(result.returncode == 0, f"{argv[0]} exited nonzero")
    return result.stdout.strip()


def verify_npm_clean_install(workspace):
    """Install an empty project offline; npm with files of two releases fails here."""
    try:
        with tempfile.TemporaryDirectory(dir=workspace) as project:
            for name, content in NPM_PROBE_FILES.items():
                Path(project, name).write_text(json.dumps(content) + "\n")
            command(NPM_CLEAN_INSTALL, cwd=project)
    except (OSError, TemplateAssertionError) as error:
        raise TemplateAssertionError("npm ci of an empty project failed") from error


def verify_git_base_reads(workspace):
    """Require the Git release and the batch form that Mokly's base reader uses."""
    version = re.match(r"git version (\d+)\.(\d+)", command(["git", "--version"]))
    require(version is not None and tuple(map(int, version.groups())) >= GIT_MINIMUM,
            "Mokly base reads require Git 2.43 or newer")
    try:
        with tempfile.TemporaryDirectory(dir=workspace) as repository:
            command(["git", "init", "--quiet", repository])
            command(GIT_NUL_BATCH, cwd=repository)
    except (OSError, TemplateAssertionError) as error:
        raise TemplateAssertionError("git cat-file --batch --filters -Z failed") from error


def verify(node_version):
    require(os.environ.get(PROBE_KEY) == PROBE_VALUE, "added environment entry is missing")
    require(os.environ.get("HOME") == TEMPLATE_HOME, "template HOME changed")
    try:
        library = os.confstr("CS_GNU_LIBC_VERSION") or ""
    except (OSError, ValueError):
        library = ""
    version = re.fullmatch(r"glibc (\d+)\.(\d+)(?:\.\d+)?", library)
    require(version is not None and tuple(map(int, version.groups())) >= (2, 28),
            "native Mokly requires glibc 2.28 or newer")
    account = pwd.getpwuid(os.getuid())
    require(account.pw_name == "user" and os.getuid() != 0, "workload account must be user")
    require(os.geteuid() == os.getuid(), "workload effective user changed")
    require(account.pw_dir == TEMPLATE_HOME, "user account home changed")
    require(Path(TEMPLATE_HOME).is_dir(), "user home is missing")
    workspace = Path("/workspace")
    require(workspace.is_dir(), "/workspace is missing")
    require(workspace.stat().st_uid == os.getuid(), "/workspace must belong to user")
    try:
        with tempfile.TemporaryFile(dir=workspace) as probe:
            probe.write(b"workspace-write-probe")
    except OSError as error:
        raise TemplateAssertionError("/workspace is not writable") from error
    for executable in ("node", "npm", "corepack", "git", "curl", "sha256sum", "python3"):
        require(shutil.which(executable) is not None, f"{executable} is missing from PATH")
    require(command(["node", "--version"]) == "v" + node_version, "Node release differs from .nvmrc")
    for executable in ("npm", "corepack", "curl", "sha256sum", "python3"):
        command([executable, "--version"])
    verify_git_base_reads(workspace)
    verify_npm_clean_install(workspace)
    require(Path("/bin/sh").is_file() and os.access("/bin/sh", os.X_OK), "/bin/sh is missing")
    require(command(["/bin/sh", "-c", "printf shell-ok"]) == "shell-ok", "/bin/sh failed")
    require(not SECRET_KEYS.intersection(os.environ), "credential environment entry exists")
    for home in (Path(TEMPLATE_HOME), Path("/root")):
        for relative in CREDENTIAL_FILES:
            path = home / relative
            try:
                require(not path.exists() and not path.is_symlink(), "credential file exists")
            except PermissionError:
                require(home == Path("/root"), "credential file cannot be inspected")
    require(not Path("/var/run/mokly-secrets").exists(), "cloud secret mount exists")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node-version", required=True)
    arguments = parser.parse_args()
    try:
        verify(arguments.node_version)
    except TemplateAssertionError as error:
        parser.exit(1, f"FAIL build template: {error}\n")
    print("PASS build template: tools, user, workspace, credentials, HOME, PATH tools and added entry")


if __name__ == "__main__":
    main()
