//! Event classification and directory IO run outside the async serving task.

use std::sync::{Arc, Mutex};

use mokly_server::error::ServerError;
use mokly_watch::error::Error;
use mokly_watch::event::{Action, Event, Kind};

use crate::serve_watch::{State, failure};

type Accepted = Vec<(Event, Action)>;
pub(super) fn drain(state: Arc<Mutex<State>>) -> (Accepted, Vec<ServerError>, bool) {
    let (plan, observer, failed, resources) = {
        let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
        let pending = std::mem::take(&mut state.pending);
        let refresh = std::mem::take(&mut state.refresh);
        state.plan.resources(&pending);
        (
            state.plan.clone(),
            state.observer.clone(),
            state.failed,
            !pending.is_empty() || refresh,
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
                    (failed && event.kind == Kind::File && !plan.denied(&event.path, false))
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
    if let Err(error) = update {
        let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
        if !state.attach_reported {
            errors.push(failure(error));
            state.attach_reported = true;
        }
    }
    (accepted, errors, rescan)
}
