//! Socket and hook shutdown order remains correct after a cleanup failure.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::runtime::{ServerRuntime, TokioServer};
use mokly_server::shutdown::Lifecycle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::support;

struct Hooks {
    calls: Arc<Mutex<Vec<&'static str>>>,
}
#[async_trait]
impl Lifecycle for Hooks {
    async fn stop_watcher(&self) -> Result<()> {
        self.calls.lock().unwrap().push("watcher");
        Err(ServerError::Internal(InternalError::Io {
            source: std::io::Error::other("fixture failure"),
        }))
    }
    async fn cancel_renders(&self) -> Result<()> {
        self.calls.lock().unwrap().push("renders");
        Ok(())
    }
    async fn cancel_git(&self) -> Result<()> {
        self.calls.lock().unwrap().push("git");
        Ok(())
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        self.calls.lock().unwrap().push("sidecars");
        Ok(())
    }
    async fn release(&self) -> Result<()> {
        self.calls.lock().unwrap().push("release");
        Ok(())
    }
}

#[tokio::test]
async fn incomplete_requests_close_and_a_failed_hook_does_not_skip_cleanup() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let harness = support::Harness::with_lifecycle(Arc::new(Hooks {
        calls: calls.clone(),
    }))
    .await;
    let address = harness.url.strip_prefix("http://").unwrap().to_owned();
    let mut incomplete = TcpStream::connect(&address).await.unwrap();
    incomplete.write_all(format!("POST /mokly-viewer/components/render HTTP/1.1\r\nHost: {address}\r\nContent-Length: 100\r\n").as_bytes()).await.unwrap();
    assert!(harness.close_result().await.is_err());
    let mut bytes = Vec::new();
    if let Err(error) = incomplete.read_to_end(&mut bytes).await {
        assert_eq!(error.kind(), std::io::ErrorKind::ConnectionReset);
    }
    assert!(bytes.is_empty());
    assert_eq!(
        *calls.lock().unwrap(),
        ["watcher", "renders", "git", "sidecars", "release"]
    );
    assert!(std::net::TcpListener::bind(address).is_ok());
}

#[tokio::test]
async fn occupied_concrete_ports_advance_and_port_zero_is_resolved_once() {
    let occupied = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = occupied.local_addr().unwrap().port();
    let runtime: &dyn ServerRuntime = &TokioServer;
    let ephemeral = runtime.bind(0).await.unwrap();
    assert!(ephemeral.address().ip().is_loopback());
    assert_ne!(ephemeral.address().port(), 0);
    if port < u16::MAX {
        let advanced = runtime.bind(port).await.unwrap();
        assert!(advanced.address().port() > port);
    } else {
        assert!(runtime.bind(port).await.is_err());
    }
}
