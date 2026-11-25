//! Connect a live hub to two dedicated Postgres sessions.

use mkc_live_interface::error::{Error, ErrorResultExt, Result};
use mkc_live_interface::relay::{InboundEvent, LiveRelay, TickBatch};
use tokio::sync::{broadcast, mpsc};
use tokio::task::JoinHandle;
use tokio_postgres::tls::NoTlsStream;
use tokio_postgres::{Config, Connection, Socket};

use crate::listener::Listener;
use crate::sender::Sender;

pub(super) type PgConnection = Connection<Socket, NoTlsStream>;

const INBOUND_CAPACITY: usize = 256;
const PENDING_TICKS: usize = 1;

/// Relay project notices and client events over Postgres.
///
/// Dropping the relay stops both workers and releases their connections.
pub struct PostgresRelay {
    inbound: broadcast::Sender<InboundEvent>,
    outbound: mpsc::Sender<TickBatch>,
    listener: JoinHandle<()>,
    sender: JoinHandle<()>,
}

#[derive(Debug, thiserror::Error)]
pub(super) enum Failure {
    #[error("[mkc-live-pg] the listener connection closed")]
    ListenerClosed,
    #[error("[mkc-live-pg] the sender connection closed")]
    SenderClosed,
    #[error("[mkc-live-pg] the send queue is full")]
    QueueFull,
    #[error("[mkc-live-pg] the send worker stopped")]
    SenderStopped,
}

impl PostgresRelay {
    /// Open the two connections and subscribe before returning the relay.
    ///
    /// Call this on the serving Tokio runtime. Use the same database URL as
    /// the API. The connection uses plain TCP through the local database
    /// endpoint or Cloud SQL proxy.
    pub async fn connect(database_url: &str) -> Result<Self> {
        let config: Config = database_url
            .parse()
            .context("parse live relay database URL")?;
        let inbound = broadcast::Sender::new(INBOUND_CAPACITY);
        let listener = Listener::connect(&config, &inbound).await?;
        let sender = Sender::connect(&config).await?;
        let (outbound, batches) = mpsc::channel(PENDING_TICKS);
        let listener = tokio::spawn(listener.run(config.clone(), inbound.clone()));
        let sender = tokio::spawn(sender.run(config, batches));
        Ok(Self {
            inbound,
            outbound,
            listener,
            sender,
        })
    }
}

impl LiveRelay for PostgresRelay {
    fn publish(&self, batch: TickBatch) -> Result<()> {
        if batch.projects.values().all(Vec::is_empty) {
            return Ok(());
        }
        match self.outbound.try_send(batch) {
            Ok(()) => Ok(()),
            Err(mpsc::error::TrySendError::Full(_)) => Err(Error::internal(Failure::QueueFull)),
            Err(mpsc::error::TrySendError::Closed(_)) => {
                Err(Error::internal(Failure::SenderStopped))
            }
        }
    }

    fn subscribe(&self) -> broadcast::Receiver<InboundEvent> {
        self.inbound.subscribe()
    }
}

impl Drop for PostgresRelay {
    fn drop(&mut self) {
        self.listener.abort();
        self.sender.abort();
    }
}

#[cfg(test)]
#[path = "_tests_/relay_tests.rs"]
mod tests;
