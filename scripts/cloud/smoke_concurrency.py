"""Burst regressions for shared-session reads, touches and independent writes."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
from threading import Barrier


def burst(api, label, requests):
    gate = Barrier(16)
    def run(request):
        gate.wait(timeout=10)
        return request()
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(run, requests))
    errors = [row["error"] for row in results if isinstance(row, dict) and "error" in row]
    failures = sum(e["code"] in ("internal", "unavailable") for e in errors)
    print(f"CONCURRENCY {label}: requests=16 5xx={failures}", flush=True)
    assert not errors, errors


def concurrency(api, session):
    def read():
        return api.call("GET", "/v1/session", session=session, expected=(200, 500, 503))[0]
    burst(api, "fresh session reads", [read] * 16)
    digest = hashlib.sha256(session["cookie"].split("=")[1].encode()).hexdigest()
    api.sql("UPDATE sessions SET last_seen_at=now()-interval '6 minutes' WHERE token_hash='" + digest + "'")
    burst(api, "stale session touches", [read] * 16)
    workspaces = [api.call("POST", "/v1/workspaces", {"name": "Burst " + str(i), "slug": "burst-" + str(i)}, session, 201)[0] for i in range(16)]
    def write(workspace):
        return lambda: api.call("PATCH", "/v1/workspaces/" + workspace["id"], {"name": workspace["name"], "slug": workspace["slug"], "version": 1}, session, (200, 500, 503))[0]
    burst(api, "distinct workspace writes", [write(workspace) for workspace in workspaces])
    for workspace in workspaces:
        api.call("DELETE", "/v1/workspaces/" + workspace["id"], {"confirmationName": workspace["name"], "version": 2}, session, 204)
