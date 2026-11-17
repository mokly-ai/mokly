#!/usr/bin/env python3
"""Re-record the real pinned CLI's capture outcomes without changing stream bytes."""

import argparse
from pathlib import Path
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from catalogue_recording_cases import record_cases, record_timing
from catalogue_recording_streams import recording_matches
from publication_smoke_fixture import _prepare_isolated_checkout, require_dependencies


RECORDINGS = ROOT / "infra/tests/fixtures/catalogue-capture"


def captured_files(workspace):
    require_dependencies(ROOT)
    checkout = _prepare_isolated_checkout(ROOT, workspace)
    streams = {}
    for category, result in record_cases(checkout, workspace).items():
        prefix = "mokly-publish-" + category
        streams[prefix + ".exit.txt"] = f"{result.returncode}\n".encode()
        streams[prefix + ".stdout.txt"] = result.stdout
        streams[prefix + ".stderr.txt"] = result.stderr
    streams["mokly-publish-timings.stderr.txt"] = record_timing(checkout, workspace)
    return streams


def main(values=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare raw recordings, reading runtime paths and timing values separately")
    arguments = parser.parse_args(values)
    context = ROOT / ".context"
    context.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="capture-recordings-", dir=context) as temporary:
        streams = captured_files(Path(temporary))
    changed = []
    for name, data in sorted(streams.items()):
        path = RECORDINGS / name
        if arguments.check:
            if not path.is_file() or not recording_matches(name, data, path.read_bytes()):
                changed.append(name)
        else:
            path.write_bytes(data)
    expected = set(streams)
    extra = sorted(path.name for path in RECORDINGS.glob("mokly-publish-*.txt") if path.name not in expected)
    if changed or extra:
        for name in changed:
            print("Capture recording differs: " + name, file=sys.stderr)
        for name in extra:
            print("Unexpected capture recording: " + name, file=sys.stderr)
        return 1
    print(f"Capture recordings {'match' if arguments.check else 'written'}: {len(streams)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
