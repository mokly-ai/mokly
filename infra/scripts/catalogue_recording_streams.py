"""Compare raw recordings while reading their operation-specific values separately."""

import json
import math
import re


PUBLISH_STDOUT = {f"mokly-publish-{case}.stdout.txt" for case in
                  ("success", "invalid-bundle", "too-large")}
TIMING = "mokly-publish-timings.stderr.txt"
BUILD = re.compile(rb"Mokly publish build: (/[^\r\n]+)/tmp/mokly-publish-[A-Za-z0-9_-]+/site")
CACHE = re.compile(rb"Mokly cache: (/[^\r\n]+)/cache/mokly/[a-f0-9]{64}")
TIMING_VALUE = re.compile(
    rb'"(?P<key>session|pid|elapsedMs)"\s*:\s*'
    rb'(?P<value>"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)'
)


def publish_parts(data):
    """Keep labels, framing and result bytes, and verify both paths share a root."""
    lines = data.split(b"\n", 2)
    if len(lines) != 3:
        raise ValueError("publish output needs its build and cache paths")
    build, cache = BUILD.fullmatch(lines[0]), CACHE.fullmatch(lines[1])
    if build is None or cache is None or build[1] != cache[1]:
        raise ValueError("publish output needs two private paths under the same runtime root")
    return lines[2]


def timing_parts(data):
    """Compare the original JSON bytes outside session, PID and elapsed values."""
    prefix = b"[mokly:timing] "
    if not data.startswith(prefix) or not data.endswith(b"\n"):
        raise ValueError("timing output needs its exact prefix and newline")
    event = json.loads(data[len(prefix):])
    if not isinstance(event, dict):
        raise ValueError("timing output must be an object")
    if not isinstance(event.get("session"), str) or not event["session"]:
        raise ValueError("timing output needs a session")
    if type(event.get("pid")) is not int or event["pid"] <= 0:
        raise ValueError("timing output needs a process ID")
    elapsed = event.get("elapsedMs")
    if type(elapsed) not in (int, float) or not math.isfinite(elapsed):
        raise ValueError("timing output needs an elapsed number")
    fragments, keys, cursor = [], [], 0
    for match in TIMING_VALUE.finditer(data):
        keys.append(match["key"])
        fragments.append(data[cursor:match.start("value")])
        cursor = match.end("value")
    if sorted(keys) != [b"elapsedMs", b"pid", b"session"]:
        raise ValueError("timing output needs each variable field exactly once")
    fragments.append(data[cursor:])
    return fragments


def recording_matches(name, actual, recorded):
    """Only the named runtime paths and timing values vary between real runs."""
    try:
        if name in PUBLISH_STDOUT:
            return publish_parts(actual) == publish_parts(recorded)
        if name == TIMING:
            return timing_parts(actual) == timing_parts(recorded)
    except (KeyError, TypeError, ValueError, OverflowError):
        return False
    return actual == recorded
