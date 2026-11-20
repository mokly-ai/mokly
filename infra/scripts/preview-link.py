#!/usr/bin/env python3
"""Print the newest exact-address sign-in link from one preview's API logs."""

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
import re
import sys
import time
import unicodedata
from urllib.parse import urlsplit

from preview_link_sources import KubectlSource, SourceError

CALLBACK_PATH = "/auth/email/callback"
NO_LINK = "No matching sign-in link found; request a new link and try again."
RFC3339 = re.compile(
    r"(?P<date>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})"
    r"(?P<fraction>[.][0-9]+)?(?P<zone>Z|[+-][0-9]{2}:[0-9]{2})"
)


class LinkError(ValueError):
    """A safe reader diagnostic that never includes log content."""


def normalize_email(value):
    value = value.strip().translate(str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"))
    if "@" not in value:
        raise LinkError("Invalid email address")
    local, domain = value.split("@", 1)
    controls = any(unicodedata.category(character) == "Cc" for character in value)
    if (
        len(value.encode("utf-8")) > 254
        or not local
        or not domain
        or "@" in domain
        or "." not in domain
        or domain.startswith(".")
        or domain.endswith(".")
        or any(character.isspace() for character in value)
        or controls
        or any(character in ',<>;"' for character in value)
    ):
        raise LinkError("Invalid email address")
    return value


def parse_rfc3339(value, description="timestamp"):
    match = RFC3339.fullmatch(value)
    if not match:
        raise LinkError(f"Invalid RFC3339 {description}")
    fraction = match.group("fraction") or ""
    if len(fraction) > 7:
        fraction = fraction[:7]
    zone = "+00:00" if match.group("zone") == "Z" else match.group("zone")
    try:
        return datetime.fromisoformat(match.group("date") + fraction + zone)
    except ValueError as error:
        raise LinkError(f"Invalid RFC3339 {description}") from error


def default_since():
    value = datetime.now(timezone.utc) - timedelta(minutes=15)
    return value.isoformat(timespec="microseconds").replace("+00:00", "Z")


def app_host(environment, variables):
    match = re.fullmatch(r"preview-pr-([1-9][0-9]{0,8})", environment)
    domain = variables.get("MKC_DOMAIN", "")
    if not match:
        raise LinkError("Environment must match preview-pr-N")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*[.][a-z]+", domain):
        raise LinkError("MKC_DOMAIN must be a lowercase DNS domain")
    return f"pr-{match.group(1)}.preview.{domain}", f"mkc-{environment}"


def sign_in_link(value, expected_host):
    """The callback URL of a sign-in email, or None for another product email
    to the same address (an invitation links to `/sign-in`, not to the
    callback). A callback-path link on any other scheme, host or port, or
    without its fragment, is malformed and fails the read."""
    if not isinstance(value, str) or any(unicodedata.category(character) == "Cc" for character in value):
        raise LinkError("Matching sign-in event has an invalid callback URL")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as error:
        raise LinkError("Matching sign-in event has an invalid callback URL") from error
    if parsed.path != CALLBACK_PATH:
        return None
    if (
        parsed.scheme != "https"
        or parsed.hostname != expected_host
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
        or not parsed.fragment
    ):
        raise LinkError("Matching sign-in event has an invalid callback URL")
    return value


def parse_log_line(line, recipient, expected_host):
    timestamp_text, separator, body = line.partition(" ")
    suspicious = "mkc_dev_mail" in line and "development email" in line
    if not separator:
        if suspicious:
            raise LinkError("Matching sign-in event is malformed")
        return None
    try:
        timestamp = parse_rfc3339(timestamp_text, "log timestamp")
        event = json.loads(body)
    except (LinkError, json.JSONDecodeError):
        if suspicious:
            raise LinkError("Matching sign-in event is malformed") from None
        return None
    fields = event.get("fields") if isinstance(event, dict) else None
    target = event.get("target") if isinstance(event, dict) else None
    if target != "mkc_dev_mail" or not isinstance(fields, dict):
        if suspicious:
            raise LinkError("Matching sign-in event is malformed")
        return None
    if fields.get("message") != "development email":
        return None
    if not isinstance(fields.get("recipient"), str) or not isinstance(fields.get("link"), str):
        raise LinkError("Matching sign-in event is malformed")
    if fields["recipient"] != recipient:
        return None
    callback = sign_in_link(fields["link"], expected_host)
    if callback is None:
        return None
    return timestamp, callback


def newest_link(logs, recipient, expected_host):
    candidates = []
    order = 0
    for log in logs:
        for line in log.splitlines():
            candidate = parse_log_line(line, recipient, expected_host)
            if candidate is not None:
                candidates.append((candidate[0], order, candidate[1]))
            order += 1
    return max(candidates)[2] if candidates else None


def timeout_seconds(value):
    if not re.fullmatch(r"[1-9][0-9]*", value) or not 1 <= int(value) <= 120:
        raise argparse.ArgumentTypeError("must be an integer from 1 to 120")
    return int(value)


def arguments(values=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("environment")
    parser.add_argument("--email", required=True)
    parser.add_argument("--since-time")
    parser.add_argument("--timeout-seconds", type=timeout_seconds, default=30)
    return parser.parse_args(values)


def main(values=None, variables=os.environ):
    try:
        settings = arguments(values)
        recipient = normalize_email(settings.email)
        expected_host, namespace = app_host(settings.environment, variables)
        since_time = settings.since_time or default_since()
        parse_rfc3339(since_time, "since-time")
        source = KubectlSource(namespace)
        deadline = time.monotonic() + settings.timeout_seconds
        while True:
            link = newest_link(source.read(since_time), recipient, expected_host)
            if link is not None:
                print(link)
                return 0
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(2, remaining))
        print(NO_LINK, file=sys.stderr)
    except (LinkError, SourceError) as error:
        print(error, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
