"""One isolated npm installation for published CLI builds and captures."""

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess

from publication_smoke_fixture import cli_result, fixture_environment


@dataclass(frozen=True)
class PublishedCli:
    installation: Path
    executable: Path
    version: str


def install_published_cli(workspace):
    installation = workspace / "consumer"
    installation.mkdir(parents=True)
    (installation / "package.json").write_text(json.dumps({"private": True, "type": "module"}) + "\n")
    result = subprocess.run([
        "npm", "install", "--prefix", str(installation), "--workspaces=false",
        "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org",
        "@mokly/mokly@latest", "react@19", "react-dom@19",
    ], cwd=installation, env=fixture_environment(workspace), capture_output=True, text=True, timeout=480)
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
