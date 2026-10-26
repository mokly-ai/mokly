//! A minimal HTTP/1.1 client for loopback servers, with an event stream reader.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// The read timeout of one request or one event.
const READ_TIMEOUT: Duration = Duration::from_secs(30);

/// One complete response.
#[derive(Debug)]
pub struct Reply {
    /// The status code.
    pub status: u16,
    /// Header values by lowercase name.
    pub headers: BTreeMap<String, String>,
    /// The decoded body.
    pub body: Vec<u8>,
}

impl Reply {
    /// The body as text.
    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).into_owned()
    }
}

/// Send `GET path` to `origin`, such as `http://127.0.0.1:3000`, and read the reply.
pub fn get(origin: &str, path: &str) -> Reply {
    let mut reader = request(origin, path);
    let (status, headers) = response_head(&mut reader);
    let mut body = Vec::new();
    if headers.get("transfer-encoding").map(String::as_str) == Some("chunked") {
        chunked(&mut reader, &mut body);
    } else {
        reader.read_to_end(&mut body).unwrap();
    }
    Reply {
        status,
        headers,
        body,
    }
}

/// Send `POST path` with `headers` and `body` to `origin`, and read the reply.
pub fn post(origin: &str, path: &str, headers: &[(&str, &str)], body: &[u8]) -> Reply {
    let host = origin.trim_start_matches("http://").trim_end_matches('/');
    let mut stream = TcpStream::connect(host).unwrap();
    stream.set_read_timeout(Some(READ_TIMEOUT)).unwrap();
    let mut head = format!(
        "POST {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nContent-Length: {}\r\n",
        body.len()
    );
    for (name, value) in headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes()).unwrap();
    stream.write_all(body).unwrap();
    let mut reader = BufReader::new(stream);
    let (status, headers) = response_head(&mut reader);
    let mut body = Vec::new();
    if headers.get("transfer-encoding").map(String::as_str) == Some("chunked") {
        chunked(&mut reader, &mut body);
    } else {
        reader.read_to_end(&mut body).unwrap();
    }
    Reply {
        status,
        headers,
        body,
    }
}

/// An open `text/event-stream` response.
pub struct Events {
    reader: BufReader<TcpStream>,
}

impl Events {
    /// Open the event stream at `path` on `origin`.
    pub fn open(origin: &str, path: &str) -> Self {
        let mut reader = request(origin, path);
        let (status, _) = response_head(&mut reader);
        assert_eq!(status, 200, "the event stream opens");
        Self { reader }
    }

    /// Wait for the next line of the stream, or `None` when the stream ends.
    pub fn next_line(&mut self) -> Option<String> {
        let mut line = String::new();
        let read = self.reader.read_line(&mut line).unwrap();
        (read > 0).then(|| line.trim_end().to_owned())
    }
}

fn request(origin: &str, path: &str) -> BufReader<TcpStream> {
    let host = origin.trim_start_matches("http://").trim_end_matches('/');
    let mut stream = TcpStream::connect(host).unwrap();
    stream.set_read_timeout(Some(READ_TIMEOUT)).unwrap();
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    BufReader::new(stream)
}

fn response_head(reader: &mut BufReader<TcpStream>) -> (u16, BTreeMap<String, String>) {
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    let status = line
        .split(' ')
        .nth(1)
        .and_then(|code| code.parse().ok())
        .unwrap_or_else(|| panic!("an HTTP status line, not {line:?}"));
    let mut headers = BTreeMap::new();
    loop {
        line.clear();
        reader.read_line(&mut line).unwrap();
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        let (name, value) = line.split_once(':').unwrap();
        headers.insert(name.to_ascii_lowercase(), value.trim().to_owned());
    }
    (status, headers)
}

fn chunked(reader: &mut BufReader<TcpStream>, body: &mut Vec<u8>) {
    loop {
        let mut size = String::new();
        reader.read_line(&mut size).unwrap();
        let size = usize::from_str_radix(size.trim().split(';').next().unwrap(), 16).unwrap();
        if size == 0 {
            break;
        }
        let start = body.len();
        body.resize(start + size, 0);
        reader.read_exact(&mut body[start..]).unwrap();
        let mut end = [0; 2];
        reader.read_exact(&mut end).unwrap();
    }
}
