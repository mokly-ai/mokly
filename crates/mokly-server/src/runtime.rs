//! Loopback HTTP transport with explicit client-connection shutdown.

use std::io;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;

use async_trait::async_trait;
use hyper::server::conn::http1;
use hyper_util::rt::TokioIo;
use hyper_util::service::TowerToHyperService;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::accept::{
    AcceptBackoff, AcceptPeriod, Acceptor, Backoff, TcpAcceptor, connection_error,
};
use crate::application::HttpApplication;
use crate::error::{InternalError, Result, ServerError};
use crate::shutdown::Lifecycle;

/// Socket reservation boundary.
#[async_trait]
pub trait ServerRuntime: Send + Sync {
    /// Reserve a loopback port, advancing occupied concrete ports.
    async fn bind(&self, starting_port: u16) -> Result<Box<dyn BoundServer>>;
}

/// Reserved listener, reported only after the catalogue passed validation.
#[async_trait]
pub trait BoundServer: Send + Sync {
    /// Stable listening address for this process.
    fn address(&self) -> SocketAddr;
    /// Serve until one stop request, close clients, then run every cleanup hook.
    async fn run(
        self: Box<Self>,
        app: Arc<dyn HttpApplication>,
        stop: watch::Receiver<bool>,
        lifecycle: Arc<dyn Lifecycle>,
    ) -> Result<()>;
}

/// Tokio socket composition root.
pub struct TokioServer;
struct Listener {
    socket: Arc<dyn Acceptor>,
    backoff: Arc<dyn Backoff>,
    address: SocketAddr,
}

#[async_trait]
impl ServerRuntime for TokioServer {
    async fn bind(&self, starting_port: u16) -> Result<Box<dyn BoundServer>> {
        let mut port = starting_port;
        loop {
            match TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await {
                Ok(socket) => {
                    let address = match socket.local_addr() {
                        Ok(address) => address,
                        Err(source) => return Err(InternalError::Io { source }.into()),
                    };
                    return Ok(Box::new(Listener {
                        socket: Arc::new(TcpAcceptor(socket)),
                        backoff: Arc::new(AcceptBackoff),
                        address,
                    }));
                }
                Err(source)
                    if source.kind() == io::ErrorKind::AddrInUse
                        && port != 0
                        && port < u16::MAX =>
                {
                    port += 1;
                }
                Err(source) => {
                    return Err(ServerError::Bind {
                        port: starting_port,
                        source,
                    });
                }
            }
        }
    }
}

#[async_trait]
impl BoundServer for Listener {
    fn address(&self) -> SocketAddr {
        self.address
    }
    async fn run(
        self: Box<Self>,
        app: Arc<dyn HttpApplication>,
        mut stop: watch::Receiver<bool>,
        lifecycle: Arc<dyn Lifecycle>,
    ) -> Result<()> {
        let router = app.clone().router(stop.clone());
        let mut clients = JoinSet::new();
        let mut failure = None;
        let mut period = AcceptPeriod::default();
        loop {
            if *stop.borrow() {
                break;
            }
            tokio::select! {
                _ = stop.changed() => break,
                client = self.socket.accept() => {
                    match client {
                        Ok(stream) => {
                            if period.recovered() { app.accept_recovered(); }
                            let service = TowerToHyperService::new(router.clone());
                            clients.spawn(async move {
                                if let Err(error) = http1::Builder::new().serve_connection(TokioIo::new(stream), service).await { tracing::debug!(%error, "client closed"); }
                            });
                        },
                        Err(source) if connection_error(&source) => { tracing::debug!(%source, "connection could not be accepted"); },
                        Err(source) => {
                            if period.failed() { app.accept_failed(&source); }
                            tokio::select! { _ = stop.changed() => break, _ = self.backoff.wait() => {} }
                        },
                    }
                },
                _ = clients.join_next(), if !clients.is_empty() => {},
            }
        }
        clients.abort_all();
        while clients.join_next().await.is_some() {}
        if let Err(error) = lifecycle.stop_watcher().await {
            failure.get_or_insert(error);
        }
        if let Err(error) = lifecycle.cancel_renders().await {
            failure.get_or_insert(error);
        }
        app.stop_renders().await;
        if let Err(error) = lifecycle.cancel_git().await {
            failure.get_or_insert(error);
        }
        if let Err(error) = lifecycle.shutdown_sidecars().await {
            failure.get_or_insert(error);
        }
        if let Err(error) = lifecycle.release().await {
            failure.get_or_insert(error);
        }
        failure.map_or(Ok(()), Err)
    }
}

#[cfg(test)]
#[path = "_tests_/runtime_tests.rs"]
mod runtime_tests;
