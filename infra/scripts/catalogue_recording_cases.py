"""Real publish cases for the byte-exact catalogue-capture recordings."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess
import threading

from catalogue_capture_endpoint import CaptureEndpoint
from publication_smoke_fixture import cli_result, fixture_environment


TOKEN = "capture-recording-placeholder"


@contextmanager
def refusing_endpoint(status):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_arguments):
            pass

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            requests.append((self.path, self.headers.get("Authorization"), bool(body)))
            self.send_response(status)
            self.send_header("Content-Length", "0")
            self.end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/", requests
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)


def run_publish(checkout, cli, endpoint, *extra):
    command = [str(cli.executable), "publish", "--strict",
               "--config", "mokly.config.json", "--repository", "github.com/mokly-ai/mokly-cloud",
               "--base", "origin/main", "--endpoint", endpoint, *extra]
    environment = dict(fixture_environment(checkout.parent), MOKLY_TOKEN=TOKEN)
    return subprocess.run(command, cwd=checkout, env=environment, capture_output=True, timeout=480)


def require_exit(result, expected):
    if result.returncode != expected:
        decoded = subprocess.CompletedProcess([], result.returncode,
            result.stdout.decode("utf8", errors="replace"), result.stderr.decode("utf8", errors="replace"))
        raise AssertionError("Recording case failed: " + cli_result(decoded))


def record_cases(checkout, workspace, cli):
    results = {}
    (workspace / "success").mkdir()
    receiver = CaptureEndpoint(workspace / "success", TOKEN)
    with receiver as endpoint:
        result = run_publish(checkout, cli, endpoint)
        require_exit(result, 0)
        results["success"] = result
    receiver.require_exchange()
    for category, status in [("invalid-bundle", 400), ("too-large", 413)]:
        with refusing_endpoint(status) as (endpoint, requests):
            result = run_publish(checkout, cli, endpoint)
        require_exit(result, 1)
        if requests != [("/", "Bearer " + TOKEN, True)]:
            raise AssertionError(f"{category}: expected exactly one authenticated Plan, got {requests}")
        results[category] = result
    with refusing_endpoint(400) as (endpoint, requests):
        result = run_publish(checkout, cli, endpoint, "--unknown-option")
        require_exit(result, 1)
        results["failure"] = result
        untracked = checkout / "untracked.txt"
        untracked.write_text("untracked\n", encoding="utf8")
        try:
            result = run_publish(checkout, cli, endpoint)
            require_exit(result, 1)
            results["git-uncommitted"] = result
        finally:
            untracked.unlink()
    if requests:
        raise AssertionError("Pre-build refusals must create no receiver request")
    return results


def record_timing(checkout, workspace, cli):
    (workspace / "timed").mkdir()
    endpoint = CaptureEndpoint(workspace / "timed", TOKEN)
    with endpoint as url:
        result = run_publish(checkout, cli, url, "--debug-timings")
        require_exit(result, 0)
    endpoint.require_exchange()
    lines = result.stderr.splitlines(keepends=True)
    return next(line for line in lines if line.startswith(b"[mokly:timing] "))
