//! Publish all payloads from one hub tick in one transaction.

use std::future::Future;
use std::pin::Pin;

use mkc_live_interface::error::{Error, ErrorResultExt, Result};
use mkc_live_interface::relay::TickBatch;
use tokio::sync::mpsc;
use tokio::time::Instant;
use tokio_postgres::{Client, Config, NoTls};

use crate::backoff::Backoff;
use crate::payload::{RELAY_CHANNEL, encode};
use crate::relay::{Failure, PgConnection};

const NOTIFY_BATCH: &str = "
    SELECT pg_catalog.pg_notify($1, payload)
    FROM pg_catalog.unnest($2::text[]) WITH ORDINALITY AS batch(payload, position)
    ORDER BY position
";

type Connector<'a> =
    dyn Fn() -> Pin<Box<dyn Future<Output = Result<Sender>> + Send + 'a>> + Sync + 'a;

pub(super) struct Sender {
    client: Client,
    connection: PgConnection,
}

impl Sender {
    pub(super) async fn connect(config: &Config) -> Result<Self> {
        let (client, connection) = config.connect(NoTls).await.context("connect live sender")?;
        Ok(Self { client, connection })
    }

    pub(super) async fn run(self, config: Config, batches: mpsc::Receiver<TickBatch>) {
        run_sender(Some(self), batches, &|| Box::pin(Self::connect(&config))).await;
    }

    async fn publish(&mut self, payloads: &[String]) -> Result<()> {
        tokio::select! {
            biased;
            result = notify(&mut self.client, payloads) => result,
            result = &mut self.connection => {
                result.context("drive live sender")?;
                Err(Error::internal(Failure::SenderClosed))
            }
        }
    }
}

/// Drain ticks during backoff and reconnect when a tick reaches the deadline.
pub(super) async fn run_sender(
    mut sender: Option<Sender>,
    mut batches: mpsc::Receiver<TickBatch>,
    connect: &Connector<'_>,
) {
    let mut backoff = Backoff::default();
    let mut next_attempt = None;
    let mut dropped_ticks = 0_u64;
    while let Some(batch) = batches.recv().await {
        if next_attempt.is_some_and(|at| Instant::now() < at) {
            dropped_ticks = dropped_ticks.saturating_add(1);
            continue;
        }
        let encoded = match encode(batch) {
            Ok(encoded) => encoded,
            Err(error) => {
                tracing::warn!(%error, "live relay could not encode a tick");
                continue;
            }
        };
        if let Some((project, event_bytes)) = encoded.largest_dropped_event {
            tracing::warn!(%project, event_bytes, "live relay dropped oversized client events from a tick");
        }
        if encoded.payloads.is_empty() {
            continue;
        }
        match send_tick(&mut sender, connect, &encoded.payloads).await {
            Ok(()) => {
                if dropped_ticks != 0 {
                    tracing::info!(dropped_ticks, "live sender reconnected");
                    dropped_ticks = 0;
                }
                next_attempt = None;
                backoff = Backoff::default();
            }
            Err(error) => {
                if dropped_ticks == 0 {
                    tracing::warn!(%error, "live sender lost its connection");
                }
                dropped_ticks = dropped_ticks.saturating_add(1);
                next_attempt = Some(Instant::now() + backoff.next_delay());
            }
        }
    }
}

async fn send_tick(
    sender: &mut Option<Sender>,
    connect: &Connector<'_>,
    payloads: &[String],
) -> Result<()> {
    let mut connection = match sender.take() {
        Some(connection) => connection,
        None => connect().await?,
    };
    connection.publish(payloads).await?;
    *sender = Some(connection);
    Ok(())
}

async fn notify(client: &mut Client, payloads: &[String]) -> Result<()> {
    let transaction = client
        .transaction()
        .await
        .context("begin live relay tick")?;
    transaction
        .execute(NOTIFY_BATCH, &[&RELAY_CHANNEL, &payloads])
        .await
        .context("notify live events")?;
    transaction.commit().await.context("commit live relay tick")
}
