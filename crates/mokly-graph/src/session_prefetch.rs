//! Early base renders start as soon as prepared document keys identify misses.

use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use crate::error::{GraphError, InternalError, Result};
use crate::prefetch::{Prefetch, PrefetchGuard};
use crate::prefetch_state::{Flight, Flights};
use crate::session::Session;
use crate::types::RenderGeneration;
use crate::worker_context::WorkerContext;
use crate::workers::ComparisonTask;

struct Jobs {
    session: Session,
    flights: Arc<Flights>,
}

impl ComparisonTask for Jobs {
    fn run(&self, index: usize) {
        let route = &self.flights.routes[index];
        let Some(flight) = self.flights.claim(route) else {
            return;
        };
        let _completion = Completion(flight.clone());
        let result = self
            .session
            .check_cancelled()
            .and_then(|()| self.session.raw(route));
        if let Ok(artifact) = &result {
            self.session.state.cache.insert(
                self.session.state.plans[route].key.clone(),
                artifact.clone(),
            );
        }
        flight.complete(result);
    }
}

struct Completion(Arc<Flight>);

impl Drop for Completion {
    fn drop(&mut self) {
        self.0.failed();
    }
}

struct Work {
    session: Session,
    flights: Arc<Flights>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl Prefetch for Work {
    fn cancel_and_join(&self) {
        self.flights.stop();
        let thread = self
            .thread
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(thread) = thread
            && thread.join().is_err()
        {
            tracing::error!("early comparison render worker panicked");
        }
        let mut flights = self
            .session
            .state
            .prefetch
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if flights
            .as_ref()
            .is_some_and(|flights| Arc::ptr_eq(flights, &self.flights))
        {
            flights.take();
        }
    }
}

pub(crate) fn start(session: &Session) -> Result<Option<PrefetchGuard>> {
    let routes = session.uncached_documents();
    if routes.is_empty() {
        return Ok(None);
    }
    let flights = Arc::new(Flights::new(routes));
    *session
        .state
        .prefetch
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(flights.clone());
    let jobs = Jobs {
        session: session.clone(),
        flights: flights.clone(),
    };
    let context = WorkerContext::current();
    let thread = match thread::Builder::new()
        .name("mokly-base-prefetch".into())
        .spawn(move || {
            context.in_scope(|| {
                jobs.session
                    .state
                    .workers
                    .prefetch_tasks(jobs.flights.routes.len(), &jobs)
            });
        }) {
        Ok(thread) => thread,
        Err(source) => {
            return Err(GraphError::Internal(InternalError::Provider {
                source: Box::new(source),
            }));
        }
    };
    Ok(Some(PrefetchGuard::new(Arc::new(Work {
        session: session.clone(),
        flights,
        thread: Mutex::new(Some(thread)),
    }))))
}
