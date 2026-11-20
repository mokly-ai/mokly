"""Capture JSON API responses for the Rust validator without changing smoke scripts."""

import http.client
import io
import json
from pathlib import Path
import runpy
import sys
import threading
import urllib.parse


_original_request = http.client.HTTPConnection.putrequest
_original_response = http.client.HTTPConnection.getresponse
_output_lock = threading.Lock()


def request(connection, method, url, *args, **kwargs):
    connection.contract_request = (method, urllib.parse.urlsplit(url).path)
    return _original_request(connection, method, url, *args, **kwargs)


def response(connection, *args, **kwargs):
    result = _original_response(connection, *args, **kwargs)
    method, path = connection.contract_request
    if path.startswith("/v1/"):
        body = result.read()
        buffer = io.BytesIO(body)
        result.read = buffer.read
        result.readinto = buffer.readinto
        if body:
            record = {"method": method, "path": path, "status": result.status,
                      "body": json.loads(body)}
            with _output_lock:
                print("CONTRACT_CAPTURE " + json.dumps(record), flush=True)
    return result


http.client.HTTPConnection.putrequest = request
http.client.HTTPConnection.getresponse = response
script = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(script.parent))
sys.argv = [str(script), *sys.argv[2:]]
runpy.run_path(str(script), run_name="__main__")
