"""Real early HTTP responses remain readable when the upload body is refused."""

import errno
import http.client
import http.server
import json
from pathlib import Path
import socket
import socketserver
import sys
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication_exchange
import publication_smoke_limits


class EarlyResponse(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.dumps({"error": {"reason": "upload-too-large"}}).encode()
        self.send_response(self.server.refusal_status)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Request-ID", "test-request")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()
        self.connection.shutdown(socket.SHUT_WR)

    def log_message(self, *args):
        pass


class CloseWithoutResponse(EarlyResponse):
    def do_POST(self):
        self.connection.shutdown(socket.SHUT_WR)


class SmallSendBuffer(http.client.HTTPConnection):
    def connect(self):
        super().connect()
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1024)


class EarlyResponseTests(unittest.TestCase):
    def run_server(self, status, request, handler=EarlyResponse):
        with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
            server.refusal_status = status
            server.timeout = 3
            thread = threading.Thread(target=server.handle_request)
            thread.start()
            try:
                return request("http://127.0.0.1:" + str(server.server_address[1]))
            finally:
                thread.join(timeout=5)
                self.assertFalse(thread.is_alive())

    def test_early_response_is_read_for_fixed_and_chunked_uploads(self):
        for chunked in [False, True]:
            with self.subTest(chunked=chunked):
                def request(url):
                    with patch("publication_exchange.http.client.HTTPConnection", SmallSendBuffer):
                        return publication_exchange.send(SimpleNamespace(url=url), "POST", "/plan", "test", b"x" * (2 * 1024 * 1024), chunked=chunked)
                status, value = self.run_server(413, request)
                self.assertEqual(status, 413)
                self.assertEqual(value["error"]["reason"], "upload-too-large")

    def raw_revoked_request(self, url):
        create_connection = socket.create_connection

        def small_socket(*args, **kwargs):
            connection = create_connection(*args, **kwargs)
            connection.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1024)
            return connection

        api = Mock()
        api.url = url
        api.call.return_value = ({"secret": "test", "token": {"id": "token"}}, {})
        api.sql.side_effect = lambda query: "1" if "state='uploading'" in query else "0"
        with patch("publication_smoke_limits.socket.create_connection", side_effect=small_socket), patch("publication_smoke_limits.plan_archive", return_value=b"x" * (2 * 1024 * 1024)):
            publication_smoke_limits.revoked_in_flight(api, {}, {"id": "project"}, {})

    def test_raw_revoked_upload_reads_the_early_response_after_body_send_fails(self):
        self.run_server(401, self.raw_revoked_request)

    def test_raw_closed_server_retains_the_body_send_error_as_the_cause(self):
        with self.assertRaises((http.client.RemoteDisconnected, ConnectionResetError)) as failure:
            self.run_server(0, self.raw_revoked_request, CloseWithoutResponse)
        self.assertIsInstance(failure.exception.__cause__, (BrokenPipeError, ConnectionResetError))

    def test_raw_early_success_reports_the_truncated_body(self):
        with self.assertRaisesRegex(AssertionError, "truncated body") as failure:
            self.run_server(200, self.raw_revoked_request)
        self.assertIsInstance(failure.exception.__cause__, (BrokenPipeError, ConnectionResetError))

    def test_send_errors_still_read_responses_but_response_errors_propagate(self):
        for error in [BrokenPipeError, ConnectionResetError]:
            connection = Mock()
            connection.request.side_effect = error()
            response = connection.getresponse.return_value
            response.status = 413
            response.read.return_value = b'{}'
            response.getheader.return_value = "no-store"
            with patch("publication_exchange.http.client.HTTPConnection", return_value=connection):
                self.assertEqual(publication_exchange.send(SimpleNamespace(url="http://local"), "POST", "/", "", b"body"), (413, {}))
                connection.getresponse.side_effect = http.client.RemoteDisconnected("no response")
                with self.assertRaises(http.client.RemoteDisconnected):
                    publication_exchange.send(SimpleNamespace(url="http://local"), "POST", "/", "", b"body")
            self.assertTrue(connection.close.called)

    def test_an_early_success_after_a_send_error_rejects_the_truncated_body(self):
        def request(url):
            with patch("publication_exchange.http.client.HTTPConnection", SmallSendBuffer):
                return publication_exchange.send(SimpleNamespace(url=url), "POST", "/plan", "test", b"x" * (2 * 1024 * 1024))
        with self.assertRaisesRegex(AssertionError, "truncated body"):
            self.run_server(200, request)

    def test_a_closed_server_retains_the_body_send_error_as_the_cause(self):
        def request(url):
            with patch("publication_exchange.http.client.HTTPConnection", SmallSendBuffer):
                return publication_exchange.send(SimpleNamespace(url=url), "POST", "/plan", "test", b"x" * (2 * 1024 * 1024))
        with self.assertRaises((http.client.RemoteDisconnected, ConnectionResetError)) as failure:
            self.run_server(0, request, CloseWithoutResponse)
        self.assertIsInstance(failure.exception.__cause__, (BrokenPipeError, ConnectionResetError))

    def test_any_status_below_400_is_invalid_after_a_body_send_error(self):
        for status in [200, 204, 302]:
            for error in [BrokenPipeError(), ConnectionResetError()]:
                with self.subTest(status=status, error=type(error)):
                    connection = Mock()
                    connection.request.side_effect = error
                    response = connection.getresponse.return_value
                    response.status = status
                    response.read.return_value = b'{}'
                    response.getheader.return_value = "no-store"
                    with patch("publication_exchange.http.client.HTTPConnection", return_value=connection):
                        with self.assertRaisesRegex(AssertionError, "truncated body"):
                            publication_exchange.send(SimpleNamespace(url="http://local"), "POST", "/", "", b"body")

    def test_an_incomplete_http_response_body_retains_the_send_error(self):
        for send_error in [BrokenPipeError(), ConnectionResetError()]:
            connection = Mock()
            connection.request.side_effect = send_error
            connection.getresponse.return_value.status = 413
            connection.getresponse.return_value.read.side_effect = http.client.IncompleteRead(b"short")
            with patch("publication_exchange.http.client.HTTPConnection", return_value=connection):
                with self.assertRaises(http.client.IncompleteRead) as failure:
                    publication_exchange.send(SimpleNamespace(url="http://local"), "POST", "/", "", b"body")
            self.assertIs(failure.exception.__cause__, send_error)

    def test_macos_prototype_errors_read_refusals_and_keep_the_cause(self):
        for raw in [False, True]:
            with self.subTest(raw=raw):
                connection = Mock()
                send_error = OSError(errno.EPROTOTYPE, "Protocol wrong type for socket")
                connection.request.side_effect = send_error
                connection.sendall.side_effect = [None, send_error]
                response = Mock(status=401 if raw else 413)
                response.read.return_value = b'{}'
                response.getheader.return_value = "no-store"
                connection.getresponse.return_value = response
                api = Mock(url="http://localhost")
                api.call.return_value = ({"secret": "test", "token": {"id": "token"}}, {})
                api.sql.side_effect = lambda query: "1" if "state='uploading'" in query else "0"

                def request():
                    if raw:
                        return publication_smoke_limits.revoked_in_flight(api, {}, {"id": "project"}, {})
                    return publication_exchange.send(api, "POST", "/", "", b"body")

                with patch("publication_exchange.http.client.HTTPConnection", return_value=connection), patch("publication_smoke_limits.socket.create_connection", return_value=connection), patch("publication_smoke_limits.http.client.HTTPResponse", return_value=response), patch("publication_smoke_limits.plan_archive", return_value=b"body"):
                    request()
                    response.read.assert_called_once_with()
                    connection.request.side_effect = send_error
                    connection.sendall.side_effect = [None, send_error]
                    response.read.side_effect = http.client.IncompleteRead(b"short")
                    with self.assertRaises(http.client.IncompleteRead) as failure:
                        request()
                    self.assertIs(failure.exception.__cause__, send_error)
                connection.close.assert_called()

    def test_other_socket_errors_are_not_treated_as_early_refusals(self):
        connection = Mock()
        response = connection.getresponse.return_value
        response.status = 413
        response.read.return_value = b'{}'
        response.getheader.return_value = "no-store"
        send_error = OSError(errno.EIO, "unrelated error")
        connection.request.side_effect = send_error
        with patch("publication_exchange.http.client.HTTPConnection", return_value=connection):
            with self.assertRaises(OSError) as failure:
                publication_exchange.send(SimpleNamespace(url="http://local"), "POST", "/", "", b"body")
        self.assertIs(failure.exception, send_error)
        connection.getresponse.assert_not_called()


if __name__ == "__main__":
    unittest.main()
