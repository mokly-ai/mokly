//! A real HTTP listener replaying the recordings until it is dropped.

use std::error;
use std::io;
use std::mem;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use thiserror::Error;
use tiny_http::{Header, Request, Response, Server, StatusCode};

use crate::error::{Error as DoubleError, Result};
use crate::mode::Mode;
use crate::received::Received;
use crate::routes::route;

/// The listener could not be opened or does not have an IP address.
#[derive(Debug, Error)]
enum Listener {
    #[error("[mkc-github-double/server] listener unavailable: {0}")]
    Unavailable(Box<dyn error::Error + Send + Sync>),
    #[error("[mkc-github-double/server] listener has no IP address")]
    NotIp,
}

/// A running GitHub double: one thread, stopped when this value is dropped.
pub struct RecordedGitHub {
    /// Origin to configure as both the API and web GitHub origin.
    pub origin: String,
    /// Scenario state, shared with the thread answering requests.
    pub mode: Arc<Mutex<Mode>>,
    stop: Arc<AtomicBool>,
    server: Arc<Server>,
    thread: Option<JoinHandle<()>>,
}

impl RecordedGitHub {
    /// Listen on `bind` with the default scenario; port `0` picks a free port.
    pub fn start(bind: SocketAddr) -> Result<Self> {
        Self::start_with(bind, Mode::default())
    }

    /// Listen on `bind` with an explicit scenario and expected credentials.
    pub fn start_with(bind: SocketAddr, mode: Mode) -> Result<Self> {
        let server = match Server::http(bind) {
            Ok(server) => Arc::new(server),
            Err(error) => return Err(DoubleError::internal(Listener::Unavailable(error))),
        };
        let address = match server.server_addr().to_ip() {
            Some(address) => address,
            None => return Err(DoubleError::internal(Listener::NotIp)),
        };
        let mode = Arc::new(Mutex::new(mode));
        let stop = Arc::new(AtomicBool::new(false));
        let thread = serve(server.clone(), mode.clone(), stop.clone());
        Ok(Self {
            origin: format!("http://{address}"),
            mode,
            stop,
            server,
            thread: Some(thread),
        })
    }
}

fn serve(server: Arc<Server>, mode: Arc<Mutex<Mode>>, stop: Arc<AtomicBool>) -> JoinHandle<()> {
    thread::spawn(move || {
        while !stop.load(Ordering::SeqCst) {
            match server.recv_timeout(Duration::from_millis(100)) {
                Ok(Some(request)) => answer(request, &mode),
                Ok(None) => (),
                Err(error) => tracing::warn!(%error, "recorded GitHub stopped receiving"),
            }
        }
    })
}

/// Answer one request; a lost answer drops the request without a reply.
fn answer(mut request: Request, mode: &Mutex<Mode>) {
    let received = match read(&mut request) {
        Ok(received) => received,
        Err(error) => {
            tracing::warn!(%error, "recorded GitHub could not read a request");
            return;
        }
    };
    let (answered, lost) = {
        let mut mode = mode.lock().unwrap_or_else(PoisonError::into_inner);
        let answered = route(&received, &mut mode);
        (answered, mem::take(&mut mode.drop_check_response))
    };
    if lost {
        return;
    }
    let (status, body, headers) = match answered {
        Ok(record) => (record.status, record.body.to_string(), record.headers),
        Err(error) => {
            tracing::error!(%error, path = %received.path, "recorded GitHub refused a request");
            (
                error.status(),
                serde_json::json!({ "message": error.to_string() }).to_string(),
                Default::default(),
            )
        }
    };
    let mut response = Response::from_string(body).with_status_code(StatusCode(status));
    for (name, value) in headers {
        match Header::from_bytes(name.as_bytes(), value.as_bytes()) {
            Ok(header) => response.add_header(header),
            Err(()) => tracing::warn!(%name, "recorded GitHub skipped an invalid header"),
        }
    }
    if let Err(error) = request.respond(response) {
        tracing::warn!(%error, "recorded GitHub could not answer");
    }
}

fn read(request: &mut Request) -> io::Result<Received> {
    let header = |name: &'static str| {
        request
            .headers()
            .iter()
            .find(|header| header.field.equiv(name))
            .map(|header| header.value.as_str().to_owned())
    };
    let received = Received {
        method: request.method().as_str().to_owned(),
        path: request.url().to_owned(),
        accept: header("Accept"),
        api_version: header("X-GitHub-Api-Version"),
        user_agent: header("User-Agent"),
        authorization: header("Authorization"),
        body: String::new(),
    };
    let mut body = String::new();
    request.as_reader().read_to_string(&mut body)?;
    Ok(Received { body, ..received })
}

impl Drop for RecordedGitHub {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        self.server.unblock();
        if let Some(thread) = self.thread.take()
            && thread.join().is_err()
        {
            tracing::error!("recorded GitHub thread ended abnormally");
        }
    }
}
