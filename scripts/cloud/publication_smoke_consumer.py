"""One isolated npm installation for published CLI builds and captures."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess

from publication_smoke_fixture import cli_result, fixture_environment


@dataclass(frozen=True)
class PublishedCli:
    installation: Path
    executable: Path
    version: str


REGISTRY = "--registry=https://registry.npmjs.org"
LOOKUP = ["npm", "view", REGISTRY, "--json", "@mokly/mokly@latest", "version", "time"]
# A release of several packages, such as Babel's, publishes them one after
# another over minutes. A dependency that is younger than this can belong to a
# release that npm has not finished publishing.
SETTLED = timedelta(hours=1)


def _latest_release(installation, environment):
    """The version that npm `latest` names now, and the time npm published it."""
    result = subprocess.run(
        LOOKUP, cwd=installation, env=environment, capture_output=True, text=True, timeout=120,
    )
    if result.returncode:
        raise AssertionError("Published CLI lookup failed:\n" + cli_result(result))
    try:
        metadata = json.loads(result.stdout)
        version = metadata["version"]
        return version, datetime.fromisoformat(metadata["time"][version])
    except (ValueError, KeyError, TypeError) as error:
        raise AssertionError("Published CLI lookup returned no publish time:\n" + cli_result(result)) from error


def _cutoff(published, now):
    """The newest publish time that the install admits, in npm's UTC form."""
    cutoff = max(published, now - SETTLED).astimezone(timezone.utc)
    return cutoff.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def install_published_cli(workspace, now=None):
    installation = workspace / "consumer"
    installation.mkdir(parents=True)
    (installation / "package.json").write_text(json.dumps({"private": True, "type": "module"}) + "\n")
    environment = fixture_environment(workspace)
    version, published = _latest_release(installation, environment)
    # The install admits only packages published an hour ago or earlier, so a
    # third-party release that npm finishes within that hour cannot be half
    # present. The CLI publishes last in its own release, so the cutoff never
    # falls before any package of that release.
    cutoff = _cutoff(published, now or datetime.now(timezone.utc))
    result = subprocess.run([
        "npm", "install", "--prefix", str(installation), "--workspaces=false",
        "--ignore-scripts", "--no-audit", "--no-fund", REGISTRY, "--before=" + cutoff,
        "@mokly/mokly@" + version, "react@19", "react-dom@19",
    ], cwd=installation, env=environment, capture_output=True, text=True, timeout=480)
    if result.returncode:
        raise AssertionError("Published CLI installation failed:\n" + cli_result(result))
    package = installation / "node_modules/@mokly/mokly"
    boundary = installation.resolve()
    message = "Published CLI is linked or outside its isolated installation"
    if package.is_symlink() or not package.resolve().is_relative_to(boundary):
        raise AssertionError(message)
    metadata = json.loads((package / "package.json").read_bytes())
    executable = package / metadata["bin"]["mokly"]
    if executable.is_symlink() or not executable.resolve().is_relative_to(boundary):
        raise AssertionError(message)
    if not executable.is_file():
        raise AssertionError("Published CLI executable is missing from its isolated installation")
    print("Published CLI installed: @mokly/mokly@" + metadata["version"])
    return PublishedCli(installation, executable, metadata["version"])
