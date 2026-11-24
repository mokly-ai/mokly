//! Start one live hub on each API replica and register its sockets.

use std::num::NonZeroUsize;
use std::sync::Arc;

use mkc_domain::ids::{ProjectId, UserId};
use mkc_live_interface::error::{Error, Result};
use mkc_live_interface::relay::{InboundEvent, LiveRelay, ReplicaId};
use parking_lot::Mutex;
use tokio::runtime::Handle;
use tokio::sync::broadcast;
use tokio::task::JoinHandle;
use tokio::time::{Instant, Interval, MissedTickBehavior, interval_at};

use crate::connection::{ClientEventKind, Connection};
use crate::state::State;
use crate::tick::TICK_INTERVAL;

/// The live channel service used by the API route.
pub trait LiveHub: Send + Sync {
    /// Register a socket after the route authorizes its account and project.
    fn register(&self, project: ProjectId, user: UserId) -> Result<Connection>;

    /// Stop admitting sockets and signal close code 1001 to every socket.
    fn shutdown(&self);
}

/// A running live hub for one replica.
pub struct ReplicaHub {
    state: Arc<Mutex<State>>,
    task: JoinHandle<()>,
    event_kinds: &'static [ClientEventKind],
    outbound_capacity: NonZeroUsize,
}

impl ReplicaHub {
    /// Subscribe to the relay and start the tick task.
    ///
    /// Call this on a Tokio runtime with time enabled. Each running replica
    /// uses a distinct ID. The capacity sets the message limit of each outbound queue.
    pub fn start(
        replica: ReplicaId,
        relay: Arc<dyn LiveRelay + Send + Sync>,
        event_kinds: &'static [ClientEventKind],
        outbound_capacity: NonZeroUsize,
    ) -> Result<Self> {
        let runtime = match Handle::try_current() {
            Ok(runtime) => runtime,
            Err(error) => return Err(Error::internal(error)),
        };
        let incoming = relay.subscribe();
        let mut ticks = interval_at(Instant::now() + TICK_INTERVAL, TICK_INTERVAL);
        ticks.set_missed_tick_behavior(MissedTickBehavior::Skip);
        let state = Arc::new(Mutex::new(State::default()));
        let task = runtime.spawn(run(Arc::clone(&state), replica, relay, incoming, ticks));
        Ok(Self {
            state,
            task,
            event_kinds,
            outbound_capacity,
        })
    }
}

impl LiveHub for ReplicaHub {
    fn register(&self, project: ProjectId, user: UserId) -> Result<Connection> {
        let (id, outbound) = self
            .state
            .lock()
            .register(project, self.outbound_capacity)?;
        Ok(Connection::new(
            id,
            project,
            user,
            Arc::clone(&self.state),
            outbound,
            self.event_kinds,
        ))
    }

    fn shutdown(&self) {
        self.state.lock().shutdown();
        self.task.abort();
    }
}

impl Drop for ReplicaHub {
    fn drop(&mut self) {
        self.shutdown();
    }
}

async fn run(
    state: Arc<Mutex<State>>,
    replica: ReplicaId,
    relay: Arc<dyn LiveRelay + Send + Sync>,
    mut incoming: broadcast::Receiver<InboundEvent>,
    mut ticks: Interval,
) {
    let mut subscribed = true;
    loop {
        tokio::select! {
            _ = ticks.tick() => {
                let Some(batch) = state.lock().finish_tick(replica) else {
                    break;
                };
                if let Err(error) = relay.publish(batch) {
                    tracing::warn!(?replica, %error, "live relay could not publish a tick");
                }
            }
            event = incoming.recv(), if subscribed => {
                let event = match event {
                    Ok(event) => event,
                    Err(broadcast::error::RecvError::Lagged(_)) => InboundEvent::Gap,
                    Err(broadcast::error::RecvError::Closed) => {
                        subscribed = false;
                        tracing::warn!(?replica, "live relay subscription closed");
                        InboundEvent::Gap
                    }
                };
                state.lock().deliver(replica, event);
            }
        }
    }
}
