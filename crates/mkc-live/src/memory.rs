//! A shared in-memory relay for live channel tests.

use mkc_live_interface::error::Result;
use mkc_live_interface::relay::{InboundEvent, LiveRelay, ProjectNotice, RelayMessage, TickBatch};
use tokio::sync::broadcast;

/// Connects any number of hubs in the same process.
pub struct MemoryRelay {
    events: broadcast::Sender<InboundEvent>,
}

impl Default for MemoryRelay {
    fn default() -> Self {
        Self {
            events: broadcast::Sender::new(256),
        }
    }
}

impl MemoryRelay {
    /// Deliver a notice as a committed database trigger would.
    pub fn inject_notice(&self, notice: ProjectNotice) {
        self.send(InboundEvent::Notice(notice));
    }

    /// Report a subscription gap to all listening replicas.
    pub fn inject_gap(&self) {
        self.send(InboundEvent::Gap);
    }

    fn send(&self, event: InboundEvent) {
        let _ = self.events.send(event);
    }
}

impl LiveRelay for MemoryRelay {
    fn publish(&self, batch: TickBatch) -> Result<()> {
        for (project, events) in batch.projects {
            self.send(InboundEvent::Relay(RelayMessage {
                replica: batch.replica,
                project,
                events,
            }));
        }
        Ok(())
    }

    fn subscribe(&self) -> broadcast::Receiver<InboundEvent> {
        self.events.subscribe()
    }
}
