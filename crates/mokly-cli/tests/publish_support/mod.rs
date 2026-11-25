//! A loopback receiver that rejects every request, so a publish ends at its first upload request.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

/// Start a receiver that answers each request with 404 Not Found and return its plan URL.
///
/// A 404 is not retryable, so the publish fails at once with `upload-failed`.
/// An unreachable port instead spends five attempts and their backoff first.
pub fn rejecting_endpoint() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            thread::spawn(move || reject(stream));
        }
    });
    format!("http://{address}/plan")
}

/// Read one complete request, then answer it without a body.
fn reject(stream: TcpStream) {
    let mut reader = BufReader::new(stream);
    let mut length = 0;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            return;
        }
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':')
            && name.eq_ignore_ascii_case("content-length")
        {
            length = value.trim().parse().unwrap_or(0);
        }
    }
    let mut body = vec![0; length];
    if reader.read_exact(&mut body).is_err() {
        return;
    }
    let _ = reader
        .into_inner()
        .write_all(b"HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\nconnection: close\r\n\r\n");
}
