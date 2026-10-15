//! Injectable socket acceptance and cancellable resource-error backoff.

use std::io;
use std::time::Duration;

use async_trait::async_trait;
use tokio::net::{TcpListener, TcpStream};

#[cfg_attr(test, unimock::unimock(api = AcceptorMock))]
#[async_trait]
pub(crate) trait Acceptor: Send + Sync {
    async fn accept(&self) -> io::Result<TcpStream>;
}

pub(crate) struct TcpAcceptor(pub(crate) TcpListener);
#[async_trait]
impl Acceptor for TcpAcceptor {
    async fn accept(&self) -> io::Result<TcpStream> {
        let (stream, _) = self.0.accept().await?;
        Ok(stream)
    }
}

#[cfg_attr(test, unimock::unimock(api = BackoffMock))]
#[async_trait]
pub(crate) trait Backoff: Send + Sync {
    async fn wait(&self);
}

pub(crate) struct AcceptBackoff;
#[async_trait]
impl Backoff for AcceptBackoff {
    async fn wait(&self) {
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

pub(crate) fn connection_error(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::Interrupted
            | io::ErrorKind::ConnectionAborted
            | io::ErrorKind::ConnectionReset
    )
}
