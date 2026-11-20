//! Bound API sockets and test server threads with unwind-safe cleanup.

use std::any::Any;
use std::net::{SocketAddr, TcpListener};
use std::panic::resume_unwind;
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use mkc_api::application::Application;
use tokio::net;
use tokio::runtime::Runtime;
use tokio::sync::oneshot;

/// A loopback socket retained until its server runtime accepts ownership.
pub(crate) struct BoundListener {
    listener: TcpListener,
    /// The reserved socket address used in application settings.
    pub(crate) address: SocketAddr,
    /// The HTTP origin used by the application and request client.
    pub(crate) origin: String,
}

impl BoundListener {
    /// Reserve a unique loopback address without releasing its socket.
    pub(crate) fn bind() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        Self {
            listener,
            address,
            origin: format!("http://{address}"),
        }
    }

    /// Convert the same socket inside the runtime that will serve it.
    pub(crate) fn into_tokio(self) -> net::TcpListener {
        net::TcpListener::from_std(self.listener).unwrap()
    }
}

/// Owns a test server until it stops and its thread has been joined.
pub(crate) struct ServerThread {
    name: &'static str,
    stop: Option<Box<dyn FnOnce() + Send + Sync>>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl ServerThread {
    /// Start a server with its transport-specific stop operation.
    pub(crate) fn spawn(
        name: &'static str,
        stop: impl FnOnce() + Send + Sync + 'static,
        run: impl FnOnce() + Send + 'static,
    ) -> Self {
        Self {
            name,
            stop: Some(Box::new(stop)),
            thread: Mutex::new(Some(thread::spawn(run))),
        }
    }

    /// Serve an owned API socket with bounded runtime shutdown.
    pub(crate) fn start_api(app: Arc<dyn Application>, listener: BoundListener) -> Self {
        let (stop, stopped) = oneshot::channel();
        Self::spawn(
            "API",
            move || {
                let _ = stop.send(());
            },
            move || {
                let runtime = Runtime::new().unwrap();
                let result = runtime.block_on(async {
                    let listener = listener.into_tokio();
                    tokio::select! {
                        result = app.serve_on(listener) => result,
                        _ = stopped => Ok(()),
                    }
                });
                runtime.shutdown_timeout(Duration::from_secs(10));
                result.unwrap();
            },
        )
    }

    /// Run the harness's ready request and surface any earlier server failure.
    pub(crate) fn wait_until_ready(&self, ready: &mut dyn FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            self.assert_running();
            if ready() {
                self.assert_running();
                return;
            }
            self.assert_running();
            assert!(Instant::now() < deadline, "{} did not start", self.name);
            thread::sleep(Duration::from_millis(25));
        }
    }

    fn assert_running(&self) {
        if !self
            .thread
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_ref()
            .is_some_and(JoinHandle::is_finished)
        {
            return;
        }
        let thread = self
            .thread
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
            .unwrap();
        if let Err(failure) = thread.join() {
            resume_unwind(failure);
        }
        panic!("{} exited before it was ready", self.name);
    }
}

impl Drop for ServerThread {
    fn drop(&mut self) {
        if let Some(stop) = self.stop.take() {
            stop();
        }
        if let Some(thread) = self
            .thread
            .get_mut()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
            && let Err(failure) = thread.join()
        {
            if thread::panicking() {
                eprintln!(
                    "{} server panicked: {}",
                    self.name,
                    panic_message(&*failure)
                );
            } else {
                resume_unwind(failure);
            }
        }
    }
}

fn panic_message(failure: &(dyn Any + Send)) -> &str {
    if let Some(message) = failure.downcast_ref::<String>() {
        message
    } else if let Some(message) = failure.downcast_ref::<&str>() {
        message
    } else {
        "non-string panic payload"
    }
}
