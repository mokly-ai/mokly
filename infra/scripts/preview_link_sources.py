"""Kubectl pod-log source for the preview link reader."""

import json
import re
import subprocess


SELECTOR = "app.kubernetes.io/name=api"


class SourceError(ValueError):
    """A safe Kubernetes source diagnostic."""


def pod_names(value):
    """Accept the API's PodList and the v1 List kubectl emits for a selector."""
    if (not isinstance(value, dict) or value.get("kind") not in ("PodList", "List")
            or not isinstance(value.get("items"), list)):
        raise SourceError("Kubernetes pod list is malformed")
    names = []
    for item in value["items"]:
        name = item.get("metadata", {}).get("name") if isinstance(item, dict) else None
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", name):
            raise SourceError("Kubernetes pod list is malformed")
        names.append(name)
    return names


def previous_absent(message):
    lowered = message.lower()
    return "previous terminated container" in lowered and "not found" in lowered


class KubectlSource:
    """Read pod logs through the reviewer's current kubectl credentials."""

    def __init__(self, namespace):
        self.namespace = namespace

    def command(self, arguments, previous=False):
        try:
            result = subprocess.run(arguments, capture_output=True, text=True, timeout=12, check=False)
        except subprocess.TimeoutExpired as error:
            raise SourceError("kubectl log request timed out") from error
        except OSError as error:
            raise SourceError("kubectl is unavailable") from error
        if result.returncode:
            if previous and previous_absent(result.stderr):
                return None
            diagnostic = result.stderr.strip() or f"exit {result.returncode}"
            raise SourceError(f"kubectl log request failed: {diagnostic}")
        return result.stdout

    def read(self, since_time):
        output = self.command([
            "kubectl", "--request-timeout=10s", "--namespace", self.namespace,
            "get", "pods", "--selector", SELECTOR, "-o", "json",
        ])
        try:
            names = pod_names(json.loads(output))
        except json.JSONDecodeError as error:
            raise SourceError("Kubernetes pod list is malformed") from error
        logs = []
        for name in names:
            base = [
                "kubectl", "--request-timeout=10s", "--namespace", self.namespace,
                "logs", name, "--timestamps", f"--since-time={since_time}", "-c", "api",
            ]
            previous = self.command(base + ["--previous"], previous=True)
            if previous is not None:
                logs.append(previous)
            logs.append(self.command(base))
        return logs
