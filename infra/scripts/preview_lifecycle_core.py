"""Shared validated names and bounded provider command execution."""

import re
import subprocess
import sys


PROJECT = "mokly-508518"
BUCKET = "mokly-508518-preview-blobs"


class CommandFailure(RuntimeError):
    """A provider CLI failure with streams retained for conflict handling."""

    def __init__(self, command, returncode, stdout, stderr):
        self.command = command
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        detail = stderr.strip() or stdout.strip() or f"exit {returncode}"
        super().__init__(f"{' '.join(command[:4])} failed: {detail}")


class PreviewInputError(ValueError):
    """A malformed preview input safe for one-line script diagnostics."""


def run_command(arguments, stdin=None):
    """Run one provider command without a shell or unbounded wait."""
    try:
        result = subprocess.run(
            arguments,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise ValueError(f"{arguments[0]} timed out") from error
    if result.returncode:
        raise CommandFailure(arguments, result.returncode, result.stdout, result.stderr)
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    return result.stdout


def preview_parts(environment):
    match = re.fullmatch(r"preview-pr-([1-9][0-9]{0,8})", environment)
    if not match:
        raise PreviewInputError("environment must match preview-pr-N")
    number = match.group(1)
    return number, f"mkc-{environment}", f"pr-{number}"
