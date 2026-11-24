//! Outbound messages, overflow recovery and the shutdown close signal.

use std::collections::VecDeque;
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::task::Poll;

use mkc_live_interface::messages::{ServerMessage, ServerSignal};
use parking_lot::Mutex;
use tokio::sync::Notify;

/// The WebSocket close code for replica shutdown.
pub const SHUTDOWN_CLOSE_CODE: u16 = 1001;

/// The next item for the route to send to a project socket.
#[derive(Debug, PartialEq, Eq)]
pub enum Outbound {
    /// Serialize this message as a text frame.
    Message(Arc<ServerMessage>),
    /// Send a close frame with this code.
    Close(u16),
}

pub(super) struct OutboundQueue {
    capacity: NonZeroUsize,
    ready: Notify,
    state: Mutex<QueueState>,
}

#[derive(Default)]
struct QueueState {
    messages: VecDeque<Arc<ServerMessage>>,
    needs_resync: bool,
    close: CloseState,
}

#[derive(Default)]
enum CloseState {
    #[default]
    Open,
    Pending,
    Sent,
}

impl OutboundQueue {
    pub(super) fn new(capacity: NonZeroUsize) -> Self {
        Self {
            capacity,
            ready: Notify::new(),
            state: Mutex::default(),
        }
    }

    /// A resync at the tail already covers losses before the socket reads it.
    pub(super) fn send(&self, message: Arc<ServerMessage>) {
        {
            let mut state = self.state.lock();
            if state.messages.len() == self.capacity.get() {
                state.needs_resync = !matches!(
                    state.messages.back().map(Arc::as_ref),
                    Some(ServerMessage::Signal(ServerSignal::Resync))
                );
                return;
            }
            state.messages.push_back(message);
        }
        self.ready.notify_one();
    }

    pub(super) fn close(&self) {
        {
            let mut state = self.state.lock();
            state.close = CloseState::Pending;
            state.messages.clear();
        }
        self.ready.notify_one();
    }

    pub(super) async fn recv(&self) -> Option<Outbound> {
        loop {
            if let Poll::Ready(item) = self.take() {
                return item;
            }
            self.ready.notified().await;
        }
    }

    /// Append resync in the same lock as the pop that makes room for it.
    fn take(&self) -> Poll<Option<Outbound>> {
        let mut state = self.state.lock();
        match state.close {
            CloseState::Pending => {
                state.close = CloseState::Sent;
                return Poll::Ready(Some(Outbound::Close(SHUTDOWN_CLOSE_CODE)));
            }
            CloseState::Sent => return Poll::Ready(None),
            CloseState::Open => {}
        }
        let Some(message) = state.messages.pop_front() else {
            return Poll::Pending;
        };
        if state.needs_resync {
            state.needs_resync = false;
            state
                .messages
                .push_back(Arc::new(ServerMessage::Signal(ServerSignal::Resync)));
        }
        Poll::Ready(Some(Outbound::Message(message)))
    }
}
