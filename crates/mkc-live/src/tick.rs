//! Collect client events and keep their receive order within a tick.

use std::collections::HashMap;
use std::time::Duration;

use mkc_domain::ids::ProjectId;
use mkc_live_interface::messages::ClientEvent;

pub(super) const TICK_INTERVAL: Duration = Duration::from_millis(50);

pub(super) struct PendingEvent {
    pub(super) connection: u64,
    pub(super) project: ProjectId,
    pub(super) event: ClientEvent,
}

#[derive(Default)]
pub(super) struct PendingEvents {
    events: Vec<Option<PendingEvent>>,
    positions: HashMap<(u64, &'static str), usize>,
}

impl PendingEvents {
    /// Clear the previous slot so the kept event stays at its new position.
    pub(super) fn push(&mut self, event: PendingEvent, key: Option<&'static str>) {
        if let Some(key) = key
            && let Some(previous) = self
                .positions
                .insert((event.connection, key), self.events.len())
        {
            self.events[previous] = None;
        }
        self.events.push(Some(event));
    }

    pub(super) fn drain(&mut self) -> impl Iterator<Item = PendingEvent> + '_ {
        self.positions.clear();
        self.events.drain(..).flatten()
    }
}
