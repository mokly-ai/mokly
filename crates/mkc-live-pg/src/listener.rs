//! Subscribe to both live channels and report a gap after reconnecting.

use std::future::poll_fn;
use std::time::Duration;

use mkc_live_interface::error::{Error, ErrorResultExt, Result};
use mkc_live_interface::relay::InboundEvent;
use tokio::sync::broadcast;
use tokio::time::sleep;
use tokio_postgres::{AsyncMessage, Client, Config, NoTls};

use crate::payload::decode;
use crate::relay::{Failure, PgConnection};

const SUBSCRIBE: &str = "LISTEN mkc_live_notice; LISTEN mkc_live_relay";
const FIRST_BACKOFF: Duration = Duration::from_millis(500);
const MAX_BACKOFF: Duration = Duration::from_secs(15);

pub(super) struct Listener {
    /// Keep the client alive while polling the driver for notifications.
    _client: Client,
    connection: PgConnection,
}

impl Listener {
    pub(super) async fn connect(
        config: &Config,
        inbound: &broadcast::Sender<InboundEvent>,
    ) -> Result<Self> {
        let (client, mut connection) = config
            .connect(NoTls)
            .await
            .context("connect live listener")?;
        {
            let subscription = client.batch_execute(SUBSCRIBE);
            tokio::pin!(subscription);
            loop {
                tokio::select! {
                    biased;
                    result = &mut subscription => {
                        result.context("subscribe to live channels")?;
                        break;
                    }
                    message = receive(&mut connection) => forward(inbound, message?),
                }
            }
        }
        Ok(Self {
            _client: client,
            connection,
        })
    }

    pub(super) async fn run(mut self, config: Config, inbound: broadcast::Sender<InboundEvent>) {
        loop {
            let error = self.listen(&inbound).await;
            tracing::warn!(%error, "live listener lost its connection");
            self = reconnect(&config, &inbound).await;
            let _ = inbound.send(InboundEvent::Gap);
        }
    }

    async fn listen(mut self, inbound: &broadcast::Sender<InboundEvent>) -> Error {
        loop {
            match receive(&mut self.connection).await {
                Ok(message) => forward(inbound, message),
                Err(error) => return error,
            }
        }
    }
}

async fn reconnect(config: &Config, inbound: &broadcast::Sender<InboundEvent>) -> Listener {
    let mut backoff = FIRST_BACKOFF;
    loop {
        sleep(backoff).await;
        match Listener::connect(config, inbound).await {
            Ok(listener) => return listener,
            Err(error) => tracing::warn!(%error, "live listener could not reconnect"),
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

async fn receive(connection: &mut PgConnection) -> Result<AsyncMessage> {
    match poll_fn(|cx| connection.poll_message(cx)).await {
        Some(message) => message.context("read live notification"),
        None => Err(Error::internal(Failure::ListenerClosed)),
    }
}

fn forward(inbound: &broadcast::Sender<InboundEvent>, message: AsyncMessage) {
    if let AsyncMessage::Notification(notification) = message {
        let channel = notification.channel();
        match decode(channel, notification.payload()) {
            Ok(Some(event)) => {
                let _ = inbound.send(event);
            }
            Ok(None) => {}
            Err(error) => {
                tracing::warn!(channel, category = ?error.classify(), "invalid live notification")
            }
        }
    }
}
