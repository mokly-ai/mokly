//! The hub registration and message interface for a single socket.

use std::sync::Arc;

use mkc_domain::ids::{ProjectId, UserId};
use mkc_live_interface::error::Result;
use mkc_live_interface::messages::ClientEvent;
use parking_lot::Mutex;
use tokio::time::Instant;

use crate::limits::{RateLimit, check_frame_size};
use crate::outbound::{Outbound, OutboundQueue};
use crate::state::State;
use crate::tick::PendingEvent;

/// A kind that the hub accepts from a client socket.
#[derive(Clone, Copy, Debug)]
pub struct ClientEventKind {
    /// The value of the event's `type` field.
    pub name: &'static str,
    /// A key whose last event from each connection is kept in a tick.
    pub coalesce_key: Option<&'static str>,
}

/// A project socket registered for an authenticated account.
///
/// Dropping the handle removes the socket from the hub.
pub struct Connection {
    id: u64,
    project_id: ProjectId,
    user_id: UserId,
    state: Arc<Mutex<State>>,
    outbound: Arc<OutboundQueue>,
    event_kinds: &'static [ClientEventKind],
    rate_limit: RateLimit,
    warned_unknown: bool,
    warned_rate: bool,
}

impl Connection {
    pub(super) fn new(
        id: u64,
        project_id: ProjectId,
        user_id: UserId,
        state: Arc<Mutex<State>>,
        outbound: Arc<OutboundQueue>,
        event_kinds: &'static [ClientEventKind],
    ) -> Self {
        Self {
            id,
            project_id,
            user_id,
            state,
            outbound,
            event_kinds,
            rate_limit: RateLimit::default(),
            warned_unknown: false,
            warned_rate: false,
        }
    }

    /// The project whose messages this socket receives.
    pub fn project_id(&self) -> ProjectId {
        self.project_id
    }

    /// The account that the route authorized for this socket.
    pub fn user_id(&self) -> UserId {
        self.user_id
    }

    /// Accept text from the client, subject to the frame and rate limits.
    ///
    /// Unknown, malformed and excess messages are ignored. Oversize frames
    /// return an error that the route can use to close the socket.
    pub fn submit_text(&mut self, text: &str) -> Result<()> {
        check_frame_size(text.len())?;
        self.submit(Some(text))
    }

    /// Count a binary message and apply the warning for invalid messages.
    pub fn submit_binary(&mut self, bytes: usize) -> Result<()> {
        check_frame_size(bytes)?;
        self.submit(None)
    }

    fn submit(&mut self, text: Option<&str>) -> Result<()> {
        if !self.rate_limit.admit(Instant::now()) {
            if !self.warned_rate {
                self.warned_rate = true;
                tracing::warn!(connection = self.id, project = %self.project_id, user = %self.user_id, "live client exceeded the message rate limit");
            }
            return Ok(());
        }
        if let Some(event) = text.and_then(|text| serde_json::from_str::<ClientEvent>(text).ok())
            && let Some(kind) = self
                .event_kinds
                .iter()
                .find(|kind| kind.name == event.kind())
        {
            return self.state.lock().queue(
                PendingEvent {
                    connection: self.id,
                    project: self.project_id,
                    event,
                },
                kind.coalesce_key,
            );
        }
        if !self.warned_unknown {
            self.warned_unknown = true;
            tracing::warn!(connection = self.id, project = %self.project_id, user = %self.user_id, "live client sent an unknown or malformed message");
        }
        Ok(())
    }

    /// Receive the next message or a shutdown close code.
    ///
    /// This operation is cancellation-safe. It returns `None` after close.
    pub async fn recv(&mut self) -> Option<Outbound> {
        self.outbound.recv().await
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        self.state.lock().remove(self.project_id, self.id);
    }
}
