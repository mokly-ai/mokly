//! Registered sockets and the events waiting for the next tick.

use std::collections::{BTreeMap, HashMap};
use std::num::NonZeroUsize;
use std::sync::Arc;

use mkc_domain::ids::ProjectId;
use mkc_live_interface::error::{Error, Result};
use mkc_live_interface::messages::{ServerMessage, ServerSignal};
use mkc_live_interface::relay::{InboundEvent, ReplicaId, TickBatch};

use crate::outbound::OutboundQueue;
use crate::tick::{PendingEvent, PendingEvents};

type ProjectSockets = HashMap<u64, Arc<OutboundQueue>>;

#[derive(Default)]
pub(super) struct State {
    projects: HashMap<ProjectId, ProjectSockets>,
    pending: PendingEvents,
    last_id: u64,
    stopped: bool,
}

impl State {
    pub(super) fn register(
        &mut self,
        project: ProjectId,
        capacity: NonZeroUsize,
    ) -> Result<(u64, Arc<OutboundQueue>)> {
        if self.stopped {
            return Err(Error::HubStopped);
        }
        let id = self
            .last_id
            .checked_add(1)
            .ok_or(Error::ConnectionIdsExhausted)?;
        self.last_id = id;
        let outbound = Arc::new(OutboundQueue::new(capacity));
        self.projects
            .entry(project)
            .or_default()
            .insert(id, Arc::clone(&outbound));
        Ok((id, outbound))
    }

    pub(super) fn remove(&mut self, project: ProjectId, id: u64) {
        if let Some(sockets) = self.projects.get_mut(&project) {
            sockets.remove(&id);
            if sockets.is_empty() {
                self.projects.remove(&project);
            }
        }
    }

    pub(super) fn queue(&mut self, pending: PendingEvent, key: Option<&'static str>) -> Result<()> {
        if self.stopped {
            return Err(Error::HubStopped);
        }
        self.pending.push(pending, key);
        Ok(())
    }

    pub(super) fn finish_tick(&mut self, replica: ReplicaId) -> Option<TickBatch> {
        if self.stopped {
            return None;
        }
        let mut projects = BTreeMap::<_, Vec<_>>::new();
        for pending in self.pending.drain() {
            if let Some(sockets) = self.projects.get(&pending.project) {
                send(
                    sockets,
                    Some(pending.connection),
                    ServerMessage::ClientEvent(pending.event.clone()),
                );
            }
            projects
                .entry(pending.project)
                .or_default()
                .push(pending.event);
        }
        Some(TickBatch { replica, projects })
    }

    pub(super) fn deliver(&self, replica: ReplicaId, event: InboundEvent) {
        match event {
            InboundEvent::Notice(notice) => {
                if let Some(sockets) = self.projects.get(&notice.project) {
                    send(
                        sockets,
                        None,
                        ServerMessage::Signal(ServerSignal::Notice(notice.notice)),
                    );
                }
            }
            InboundEvent::Relay(message) => {
                if message.replica != replica
                    && let Some(sockets) = self.projects.get(&message.project)
                {
                    for event in message.events {
                        send(sockets, None, ServerMessage::ClientEvent(event));
                    }
                }
            }
            InboundEvent::Gap => {
                let resync = Arc::new(ServerMessage::Signal(ServerSignal::Resync));
                for sockets in self.projects.values() {
                    for socket in sockets.values() {
                        socket.send(Arc::clone(&resync));
                    }
                }
            }
        }
    }

    pub(super) fn shutdown(&mut self) {
        self.stopped = true;
        self.pending = PendingEvents::default();
        for sockets in self.projects.drain().map(|(_, sockets)| sockets) {
            for socket in sockets.values() {
                socket.close();
            }
        }
    }
}

fn send(sockets: &ProjectSockets, except: Option<u64>, message: ServerMessage) {
    let message = Arc::new(message);
    for (&id, socket) in sockets {
        if Some(id) != except {
            socket.send(Arc::clone(&message));
        }
    }
}
