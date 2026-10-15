//! A local receiver with explicit shutdown and recorded bounded requests.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

#[derive(Debug)]
pub struct Request {
    pub method: String,
    pub target: String,
    pub headers: BTreeMap<String, String>,
    pub body: Vec<u8>,
}

pub struct Response {
    pub status: u16,
    pub declared_length: Option<usize>,
    pub content_type: Option<String>,
    pub body: Vec<u8>,
    pub headers: Vec<(String, String)>,
}

impl Response {
    pub fn json(status: u16, body: Vec<u8>) -> Self {
        Self {
            status,
            declared_length: None,
            content_type: Some("application/json".to_owned()),
            body,
            headers: Vec::new(),
        }
    }
}

pub struct Server {
    pub origin: String,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Server {
    pub fn start(handler: Arc<dyn Fn(Request) -> Response + Send + Sync>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopping = Arc::clone(&stop);
        let thread = thread::spawn(move || {
            loop {
                let (mut stream, _) = listener.accept().unwrap();
                if stopping.load(Ordering::SeqCst) {
                    break;
                }
                stream
                    .set_read_timeout(Some(Duration::from_secs(20)))
                    .unwrap();
                stream
                    .set_write_timeout(Some(Duration::from_secs(20)))
                    .unwrap();
                let request = read(&mut stream);
                let response = handler(request);
                write!(
                    stream,
                    "HTTP/1.1 {} Test\r\nContent-Length: {}\r\nConnection: close\r\n",
                    response.status,
                    response.declared_length.unwrap_or(response.body.len())
                )
                .unwrap();
                if let Some(content_type) = response.content_type {
                    write!(stream, "Content-Type: {content_type}\r\n").unwrap();
                }
                for (name, value) in response.headers {
                    write!(stream, "{name}: {value}\r\n").unwrap();
                }
                stream.write_all(b"\r\n").unwrap();
                let _ = stream.write_all(&response.body);
            }
        });
        Self {
            origin: format!("http://{address}"),
            stop,
            thread: Some(thread),
        }
    }

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
    let length = headers["content-length"].parse::<usize>().unwrap();
    assert!(length <= 100 * 1024 * 1024);
    let mut body = vec![0; length];
    reader.read_exact(&mut body).unwrap();
    Request {
        method,
        target,
        headers,
        body,
    }
}
