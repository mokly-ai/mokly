//! Publish all payloads from one hub tick in one transaction.

use mkc_live_interface::error::{Error, ErrorResultExt, Result};
use mkc_live_interface::relay::TickBatch;
use tokio::sync::mpsc;
use tokio_postgres::{Client, Config, NoTls};

use crate::payload::{RELAY_CHANNEL, encode};
use crate::relay::{Failure, PgConnection};

const NOTIFY_BATCH: &str = "
    SELECT pg_catalog.pg_notify($1, payload)
    FROM pg_catalog.unnest($2::text[]) WITH ORDINALITY AS batch(payload, position)
    ORDER BY position
";

pub(super) struct Sender {
    client: Client,
    connection: PgConnection,
}

impl Sender {
    pub(super) async fn connect(config: &Config) -> Result<Self> {
        let (client, connection) = config.connect(NoTls).await.context("connect live sender")?;
        Ok(Self { client, connection })
    }

    pub(super) async fn run(self, config: Config, mut batches: mpsc::Receiver<TickBatch>) {
        let mut sender = Some(self);
        while let Some(batch) = batches.recv().await {
            if let Err(error) = send_tick(&mut sender, &config, batch).await {
                tracing::warn!(%error, "live relay dropped a tick");
            }
        }
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

async fn send_tick(sender: &mut Option<Sender>, config: &Config, batch: TickBatch) -> Result<()> {
    let encoded = encode(batch)?;
    if let Some((project, event_bytes)) = encoded.largest_dropped_event {
        tracing::warn!(%project, event_bytes, "live relay dropped oversized client events from a tick");
    }
    if encoded.payloads.is_empty() {
        return Ok(());
    }
    let mut connection = match sender.take() {
        Some(connection) => connection,
        None => Sender::connect(config).await?,
    };
    connection.publish(&encoded.payloads).await?;
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
