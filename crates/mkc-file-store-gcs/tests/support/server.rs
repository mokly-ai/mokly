//! Recorded provider exchanges asserting complete HTTP request targets and bytes.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::thread;
use std::time::Duration;

pub(crate) struct Exchange {
    method: &'static str,
    target: String,
    status: u16,
    pub(crate) request: Vec<u8>,
    request_headers: Vec<(String, String)>,
    response: Vec<u8>,
    response_headers: Vec<(String, String)>,
}

pub(crate) fn exchange(
    method: &'static str,
    target: &str,
    status: u16,
    response: Vec<u8>,
) -> Exchange {
    Exchange {
        method,
        target: target.to_owned(),
        status,
        request: Vec::new(),
        request_headers: Vec::new(),
        response,
        response_headers: Vec::new(),
    }
}

impl Exchange {
    pub(crate) fn expect_header(mut self, name: &str, value: &str) -> Self {
        self.request_headers
            .push((name.to_ascii_lowercase(), value.to_ascii_lowercase()));
        self
    }

    pub(crate) fn response_header(mut self, name: &str, value: &str) -> Self {
        self.response_headers
            .push((name.to_owned(), value.to_owned()));
        self
    }
}

pub(crate) fn server(exchanges: Vec<Exchange>) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        for exchange in exchanges {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(10)))
                .unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut byte = [0];
                socket.read_exact(&mut byte).unwrap();
                bytes.push(byte[0]);
                if bytes.ends_with(b"\r\n\r\n") {
                    break;
                }
                assert!(bytes.len() < 16 * 1024);
            }
            let headers = String::from_utf8(bytes).unwrap();
            assert_eq!(
                headers.lines().next().unwrap(),
                format!("{} {} HTTP/1.1", exchange.method, exchange.target)
            );
            let headers = headers.to_ascii_lowercase();
            assert!(
                headers
                    .lines()
                    .any(|line| line == "authorization: bearer fixture-oauth")
            );
            if exchange.method == "POST" {
                assert!(
                    headers
                        .lines()
                        .any(|line| line == "content-type: application/octet-stream")
                );
            }
            for (name, value) in &exchange.request_headers {
                assert!(
                    headers
                        .lines()
                        .any(|line| line == format!("{name}: {value}")),
                    "missing request header {name}: {value} in {headers}"
                );
            }
            let length = headers
                .lines()
                .find_map(|line| line.strip_prefix("content-length: "))
                .unwrap_or("0")
                .parse()
                .unwrap();
            let mut body = vec![0; length];
            socket.read_exact(&mut body).unwrap();
            assert_eq!(body, exchange.request);
            write!(socket, "HTTP/1.1 {} Result\r\n", exchange.status).unwrap();
            if !exchange
                .response_headers
                .iter()
                .any(|(name, _)| name.eq_ignore_ascii_case("content-length"))
            {
                write!(socket, "Content-Length: {}\r\n", exchange.response.len()).unwrap();
            }
            for (name, value) in exchange.response_headers {
                write!(socket, "{name}: {value}\r\n").unwrap();
            }
            write!(
                socket,
                "Content-Type: application/json\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            socket.write_all(&exchange.response).unwrap();
        }
    });
    (endpoint, handle)
}
