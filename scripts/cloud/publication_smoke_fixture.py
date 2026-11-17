"""Source-only revisions and private process state for the live CLI smoke."""

import os
from pathlib import Path
import shutil
import subprocess


PUBLISHED_CLI_FIXTURE = Path("scripts/cloud/fixtures/publication-smoke-v0.19")
FIXTURE_ENTRY = Path("catalogue/src/entries/smoke.mockup.tsx")


def cli_result(result):
    """Keep all CLI evidence in each failure, including an unexpected success."""
    return f"exit {result.returncode}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"


def require_dependencies(root):
    packages = ["@mokly/mokly", "react", "react-dom"]
    if any(not (root / "node_modules" / package / "package.json").is_file() for package in packages):
        raise AssertionError("Missing publication smoke dependencies; run npm ci")


def fixture_environment(workspace):
    """Exclude caller Git, Actions, Node preload and upload settings."""
    environment = {key: os.environ[key] for key in ("PATH", "HOME") if key in os.environ}
    temporary, cache = workspace / "tmp", workspace / "cache"
    for path in (temporary, cache):
        path.mkdir(parents=True, exist_ok=True)
    environment.update(
        TMPDIR=str(temporary), TMP=str(temporary), TEMP=str(temporary),
        XDG_CACHE_HOME=str(cache), CI="1", NO_COLOR="1", FORCE_COLOR="0",
        TZ="UTC", LC_ALL="C", GIT_CONFIG_GLOBAL="/dev/null",
        GIT_CONFIG_SYSTEM="/dev/null", GIT_CONFIG_NOSYSTEM="1",
        GIT_TERMINAL_PROMPT="0", GIT_AUTHOR_DATE="2000-01-01T00:00:00Z",
        GIT_COMMITTER_DATE="2000-01-01T00:00:00Z", npm_config_loglevel="warn",
        npm_config_update_notifier="false",
    )
    return environment


def _git(root, *arguments):
    environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    environment.update(GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null",
                       GIT_CONFIG_NOSYSTEM="1", GIT_AUTHOR_DATE="2000-01-01T00:00:00Z",
                       GIT_COMMITTER_DATE="2000-01-01T00:00:00Z")
    return subprocess.check_output(["git", *arguments], cwd=root, env=environment, stderr=subprocess.PIPE)


def _link_dependencies(root, checkout):
    (checkout / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)


def _change_fixture(checkout):
    entry = checkout / FIXTURE_ENTRY
    content = entry.read_text(encoding="utf8")
    if content.count("Ready to review") != 1:
        raise AssertionError(f"Published CLI fixture must contain one baseline marker: {FIXTURE_ENTRY}")
    entry.write_text(content.replace("Ready to review", "Ready to publish"), encoding="utf8")


def _commit_fixture(checkout, message):
    _git(checkout, "add", "-A")
    _git(checkout, "-c", "user.name=Mokly publication smoke", "-c",
         "user.email=publication-smoke@example.invalid", "-c", "commit.gpgsign=false",
         "commit", "--quiet", "-m", message)


def _build_fixture(checkout, destination=None, base=None):
    """Validate before each commit, or build the expected same-checkout export."""
    destination = destination or checkout / ".context/validation"
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = [str(checkout / "node_modules/.bin/mokly"), "build", "--strict",
               "--config", "mokly.config.json", "--out", str(destination)]
    command.extend(["--base", base] if base else ["--no-changes"])
    result = subprocess.run(command, cwd=checkout, env=fixture_environment(checkout.parent),
                            capture_output=True, text=True, timeout=480)
    if result.returncode:
        raise AssertionError("Published CLI fixture build failed:\n" + cli_result(result))
    return destination


def _require_clean_checkout(checkout):
    if _git(checkout, "status", "--porcelain", "--untracked-files=all").strip():
        raise AssertionError("Published CLI fixture checkout must be clean")


def _prepare_isolated_checkout(root, workspace):
    workspace.mkdir(parents=True, exist_ok=True)
    checkout = workspace / "checkout"
    fixture = root / PUBLISHED_CLI_FIXTURE
    if not fixture.is_dir():
        raise AssertionError(f"Missing published CLI fixture: {PUBLISHED_CLI_FIXTURE}")
    shutil.copytree(fixture, checkout, ignore=shutil.ignore_patterns(
        "mokly-generated", "mokly-static", "node_modules", ".context", ".mokly-export-reservations"))
    _git(checkout, "init", "--quiet", "--initial-branch=fixture")
    remote = _git(root, "remote", "get-url", "origin").decode().strip()
    _git(checkout, "remote", "add", "origin", remote)
    _link_dependencies(root, checkout)
    _build_fixture(checkout)
    _commit_fixture(checkout, "fixture baseline")
    _git(checkout, "update-ref", "refs/remotes/origin/main", "HEAD")
    _change_fixture(checkout)
    _build_fixture(checkout)
    _commit_fixture(checkout, "fixture comparison")
    _require_clean_checkout(checkout)
    return checkout
