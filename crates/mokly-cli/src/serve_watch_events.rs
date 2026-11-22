//! Event classification and directory IO run outside the async serving task.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use mokly_server::error::ServerError;
use mokly_watch::error::Error;
use mokly_watch::event::{Action, Event, Kind};

use crate::serve_watch::{State, failure};
use crate::serve_watch_plan::PlanRecords;

type Accepted = Vec<(Event, Action)>;
pub(super) fn drain(state: Arc<Mutex<State>>) -> (Accepted, Vec<ServerError>, bool) {
    let (plan, observer, failed, resources, pending, records) = {
        let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
        let pending = std::mem::take(&mut state.pending);
        let refresh = std::mem::take(&mut state.refresh);
        state.plan.resources(&pending);
        (
            state.plan.clone(),
            state.observer.clone(),
            state.failed,
            !pending.is_empty() || refresh,
            pending,
            state.records.clone(),
        )
    };
    let mut directories = false;
    let mut errors = Vec::new();
    let mut accepted = Vec::new();
    let mut rescan = false;
    for event in observer.take() {
        match event {
            Ok(event) => {
                directories |= event.kind == Kind::Directory
                    || plan.ancestors.contains_key(&event.path)
                    || plan.roots.contains(&event.path);
                let action = plan.classify(&event).or_else(|| {
                    (failed
                        && matches!(event.kind, Kind::File | Kind::Membership)
                        && !plan.denied(&event.path, false))
                    .then_some(Action::Rebuild)
                });
                if let Some(action) = action {
                    accepted.push((event, action));
                }
            }
            Err(Error::Rescan) => rescan = true,
            Err(error) => errors.push(failure(error)),
        }
    }
    let update = if directories {
        observer.rescan(&plan)
    } else if resources {
        observer.replace(&plan)
    } else {
        Ok(())
    };
    match update {
        Ok(()) => keep_observed(&state, records, &pending),
        Err(error) => {
            let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
            if !state.attach_reported {
                errors.push(failure(error));
                state.attach_reported = true;
            }
        }
    }
    (accepted, errors, rescan)
}

/// After the observer attached `pending`, give the records that the drain read a copy of
/// their newest record that also holds them. The copy builds outside the lock. It replaces
/// nothing when an adoption or another drain replaced those records in the meantime.
fn keep_observed(
    state: &Mutex<State>,
    records: Option<Arc<PlanRecords>>,
    pending: &BTreeSet<String>,
) {
    let Some(read) = records else {
        return;
    };
    let Some(next) = read.with_resources(pending) else {
        return;
    };
    let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
    if state
        .records
        .as_ref()
        .is_some_and(|current| Arc::ptr_eq(current, &read))
    {
        state.records = Some(next);
    }
}
