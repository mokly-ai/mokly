//! Drive one authorized project socket until it closes.

use std::error::Error;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use futures_util::StreamExt;
use futures_util::stream::SplitStream;
use mkc_live::connection::Connection;
use mkc_live::limits::MESSAGE_TOO_LARGE_CLOSE_CODE;
use mkc_live::outbound::{Outbound, SHUTDOWN_CLOSE_CODE};
use mkc_live_interface::error;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use tungstenite::error::CapacityError;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::live_clock::LiveClock;

use super::access::{LiveSession, SocketAccess};
use super::writer::Writer;

const PING_INTERVAL: Duration = Duration::from_secs(25);
const PONG_TIMEOUT: Duration = Duration::from_secs(60);
const ACCESS_INTERVAL: Duration = Duration::from_secs(30);
const ACCESS_LOST: u16 = 4403;
const PONG_MISSING: u16 = 4408;

pub(super) struct Socket {
    pub(super) session: Arc<LiveSession>,
    pub(super) access: Arc<dyn SocketAccess>,
    pub(super) clock: Arc<dyn LiveClock>,
    pub(super) stopping: CancellationToken,
}

enum End {
    Close(u16),
    PeerClose,
    Disconnected,
}

impl Socket {
    pub(super) async fn serve(self, stream: WebSocket, connection: Connection) {
        let (sink, mut receive) = stream.split();
        let mut writer = Writer::new(sink);
        let end = {
            let mut connection = connection;
            self.run(&mut receive, &mut writer, &mut connection).await
        };
        match end {
            End::Close(code) => writer.finish(Some(code)).await,
            End::PeerClose => writer.finish(None).await,
            End::Disconnected => {}
        }
    }

    async fn run(
        &self,
        receive: &mut SplitStream<WebSocket>,
        writer: &mut Writer,
        connection: &mut Connection,
    ) -> End {
        let opened = self.clock.now();
        let mut ping_at = opened + PING_INTERVAL;
        let mut pong_at = opened + PONG_TIMEOUT;
        let mut access_at = opened + ACCESS_INTERVAL;
        let mut checking = JoinSet::<Result<()>>::new();
        let mut ping_pending = false;
        loop {
            if self.stopping.is_cancelled() {
                return End::Close(SHUTDOWN_CLOSE_CODE);
            }
            let mut next = ping_at.min(pong_at);
            if checking.is_empty() {
                next = next.min(access_at);
            }
            let writing = writer.busy();
            tokio::select! {
                () = self.stopping.cancelled() => return End::Close(SHUTDOWN_CLOSE_CODE),
                () = self.clock.wait_until(next) => {
                    let now = self.clock.now();
                    if now >= pong_at {
                        return End::Close(PONG_MISSING);
                    }
                    if now >= access_at && checking.is_empty() {
                        access_at = now + ACCESS_INTERVAL;
                        let access = self.access.clone();
                        let session = self.session.clone();
                        checking.spawn_blocking(move || access.recheck(&session));
                    }
                    if now >= ping_at {
                        ping_at = now + PING_INTERVAL;
                        if writing {
                            ping_pending = true;
                        } else {
                            writer.stage(Message::Ping(Default::default()));
                        }
                    }
                }
                Some(result) = checking.join_next() => {
                    match result.context("join live access check").and_then(|result| result) {
                        Ok(()) => {}
                        Err(ApiError::Unauthenticated | ApiError::SessionExpired | ApiError::NotFound) => {
                            return End::Close(ACCESS_LOST);
                        }
                        Err(error) => tracing::warn!(?error, "could not recheck live access"),
                    }
                }
                incoming = receive.next() => {
                    let result = match incoming {
                        Some(Ok(Message::Text(text))) => connection.submit_text(&text),
                        Some(Ok(Message::Binary(bytes))) => connection.submit_binary(bytes.len()),
                        Some(Ok(Message::Pong(_))) => {
                            pong_at = self.clock.now() + PONG_TIMEOUT;
                            Ok(())
                        }
                        Some(Ok(Message::Ping(_))) => Ok(()),
                        Some(Ok(Message::Close(_))) => return End::PeerClose,
                        Some(Err(error)) if oversized(&error) => {
                            return End::Close(MESSAGE_TOO_LARGE_CLOSE_CODE);
                        }
                        Some(Err(_)) | None => return End::Disconnected,
                    };
                    match result {
                        Ok(()) => {}
                        Err(error::Error::FrameTooLarge { .. }) => return End::Close(MESSAGE_TOO_LARGE_CLOSE_CODE),
                        Err(error::Error::HubStopped) => return End::Close(SHUTDOWN_CLOSE_CODE),
                        Err(error) => {
                            tracing::warn!(%error, "could not accept a live message");
                            return End::Disconnected;
                        }
                    }
                }
                outbound = connection.recv(), if !writing => {
                    match outbound {
                        Some(Outbound::Message(message)) => match serde_json::to_string(message.as_ref()) {
                            Ok(text) => writer.stage(Message::Text(text.into())),
                            Err(error) => tracing::error!(%error, "could not serialize a live message"),
                        },
                        Some(Outbound::Close(code)) => return End::Close(code),
                        None => return End::Disconnected,
                    }
                }
                result = writer.flush(), if writing => {
                    if result.is_err() {
                        return End::Disconnected;
                    }
                    if ping_pending {
                        ping_pending = false;
                        writer.stage(Message::Ping(Default::default()));
                    }
                }
            }
        }
    }
}

fn oversized(error: &axum::Error) -> bool {
    matches!(
        error
            .source()
            .and_then(|error| error.downcast_ref::<tungstenite::Error>()),
        Some(tungstenite::Error::Capacity(
            CapacityError::MessageTooLong { .. }
        ))
    )
}
