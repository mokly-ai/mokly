//! A loopback HTTP server with explicit shutdown and recorded bounded requests.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

/// The largest request body that the server reads.
const MAX_BODY: usize = 100 * 1024 * 1024;

/// One request with lowercase header names and its complete body.
#[derive(Debug)]
pub struct Request {
    /// The request method, such as `POST`.
    pub method: String,
    /// The request target: the path and the query.
    pub target: String,
    /// Header values by lowercase name.
    pub headers: BTreeMap<String, String>,
    /// The body bytes that `Content-Length` declared.
    pub body: Vec<u8>,
}

/// One response that a handler returns for a request.
pub struct Response {
    /// The status code.
    pub status: u16,
    /// A `Content-Length` that differs from the body length, when a test needs one.
    pub declared_length: Option<usize>,
    /// The `Content-Type` header, when present.
    pub content_type: Option<String>,
    /// The body bytes.
    pub body: Vec<u8>,
    /// Extra headers in their written order.
    pub headers: Vec<(String, String)>,
}

impl Response {
    /// A JSON response with `status` and `body`.
    pub fn json(status: u16, body: Vec<u8>) -> Self {
        Self {
            status,
            declared_length: None,
            content_type: Some("application/json".to_owned()),
            body,
            headers: Vec::new(),
        }
    }

    /// An empty response with `status` and extra `headers`.
    pub fn empty(status: u16, headers: &[(&str, &str)]) -> Self {
        Self {
            status,
            declared_length: None,
            content_type: None,
            body: Vec::new(),
            headers: headers
                .iter()
                .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
                .collect(),
        }
    }
}

/// The function that answers each request.
pub type Handler = Arc<dyn Fn(Request) -> Response + Send + Sync>;

/// A loopback server that answers each connection with one response.
pub struct Server {
    /// The `http://127.0.0.1:{port}` origin.
    pub origin: String,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Server {
    /// Start a server that answers one connection at a time.
    pub fn start(handler: Handler) -> Self {
        Self::listen(handler, false)
    }

    /// Start a server that answers each connection on its own thread.
    pub fn concurrent(handler: Handler) -> Self {
        Self::listen(handler, true)
    }

    fn listen(handler: Handler, concurrent: bool) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopping = Arc::clone(&stop);
        let thread = thread::spawn(move || {
            let mut workers = Vec::new();
            loop {
                let (stream, _) = listener.accept().unwrap();
                if stopping.load(Ordering::SeqCst) {
                    break;
                }
                if concurrent {
                    let handler = Arc::clone(&handler);
                    workers.push(thread::spawn(move || answer(stream, handler.as_ref())));
                } else {
                    answer(stream, handler.as_ref());
                }
            }
            for worker in workers {
                let _ = worker.join();
            }
        });
        Self {
            origin: format!("http://{address}"),
            stop,
            thread: Some(thread),
        }
    }

    /// Stop accepting connections and wait for the server thread.
    pub async fn finish(mut self) {
        self.shutdown();
        let thread = self.thread.take().unwrap();
        tokio::task::spawn_blocking(move || thread.join().unwrap())
            .await
            .unwrap();
    }

    fn shutdown(&self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(self.origin.trim_start_matches("http://"));
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.shutdown();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn answer(mut stream: TcpStream, handler: &(dyn Fn(Request) -> Response + Send + Sync)) {
    stream
        .set_read_timeout(Some(Duration::from_secs(20)))
        .unwrap();
    stream
        .set_write_timeout(Some(Duration::from_secs(20)))
        .unwrap();
    let request = read(&mut stream);
    let response = handler(request);
    let mut head = format!(
        "HTTP/1.1 {} Test\r\nContent-Length: {}\r\nConnection: close\r\n",
        response.status,
        response.declared_length.unwrap_or(response.body.len())
    );
    if let Some(content_type) = response.content_type {
        head.push_str(&format!("Content-Type: {content_type}\r\n"));
    }
    for (name, value) in response.headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    head.push_str("\r\n");
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(&response.body);
}

fn read(stream: &mut TcpStream) -> Request {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    let parts: Vec<_> = line.trim_end().split(' ').collect();
    assert_eq!(parts.len(), 3);
    let method = parts[0].to_owned();
    let target = parts[1].to_owned();
    let mut headers = BTreeMap::new();
    loop {
        line.clear();
        reader.read_line(&mut line).unwrap();
        if line == "\r\n" {
            break;
        }
        let (name, value) = line.trim_end().split_once(':').unwrap();
        headers.insert(name.to_ascii_lowercase(), value.trim().to_owned());
    }
    let length = headers
        .get("content-length")
        .map_or(0, |length| length.parse::<usize>().unwrap());
    assert!(length <= MAX_BODY);
    let mut body = vec![0; length];
    reader.read_exact(&mut body).unwrap();
    Request {
        method,
        target,
        headers,
        body,
    }
}
