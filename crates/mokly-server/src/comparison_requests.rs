//! Selected capture queue, absolute deadlines, and replacement fences.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::watch;
use tokio::time::{Instant, sleep_until, timeout_at};

use crate::assets::File;
use crate::changes::{Accepted, ChangeCancellation, ChangeToken, Commit};
use crate::comparison_store::{
    self, Bundle, MemoryComparisons, Outcome, Pending, PendingCapture, Selection,
};
use crate::error::{InternalError, Result, ServerError};

impl MemoryComparisons {
    pub(crate) fn begin(
        &self,
        accepted: Arc<Accepted>,
        path: String,
        historical: bool,
        refresh: bool,
    ) -> std::result::Result<Pending, Arc<ServerError>> {
        let epoch = Arc::as_ptr(&accepted) as usize;
        let key = (epoch, path.clone(), historical);
        let current = self.publications.current();
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        comparison_store::collect(
            &mut state,
            self.clock.milliseconds(),
            current.changes.as_ref(),
        );
        if state.closed
            || !historical
                && !current
                    .changes
                    .as_ref()
                    .is_some_and(|current| Arc::ptr_eq(current, &accepted))
        {
            return Err(Arc::new(ServerError::ChangesReplaced));
        }
        if let Some(pending) = state.pending.get(&key) {
            return Ok(pending.receiver.clone());
        }
        if !historical
            && !refresh
            && let Some(selection) = state.selections.get(&(epoch, path.clone()))
        {
            return Ok(watch::channel(Some(Ok(selection.generation.clone()))).1);
        }
        if state.pending.len() >= 32 {
            return Err(Arc::new(ServerError::ComparisonCapacity));
        }
        let (sender, receiver) = watch::channel(None);
        let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        state.pending.insert(
            key.clone(),
            PendingCapture {
                receiver: receiver.clone(),
                cancel: cancel.clone(),
                source: accepted.cancel.clone(),
            },
        );
        let store = self.clone();
        let deadline = Instant::now() + Duration::from_secs(10);
        state.tasks.push(tokio::spawn(async move {
            store
                .run(accepted, path, historical, cancel, deadline, sender)
                .await;
            store
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .pending
                .remove(&key);
        }));
        Ok(receiver)
    }

    async fn run(
        &self,
        accepted: Arc<Accepted>,
        path: String,
        historical: bool,
        cancel: Arc<dyn ChangeCancellation>,
        deadline: Instant,
        sender: watch::Sender<Option<Outcome>>,
    ) {
        let permit = match timeout_at(deadline, self.serial.acquire()).await {
            Ok(Ok(permit)) => permit,
            _ => {
                sender.send_replace(Some(Err(Arc::new(ServerError::Deadline))));
                return;
            }
        };
        if cancel.cancelled() {
            sender.send_replace(Some(Err(Arc::new(ServerError::ChangesReplaced))));
            return;
        }
        let capture = self.capture.clone();
        let input = accepted.clone();
        let entry = path.clone();
        let token = cancel.clone();
        let mut work =
            tokio::task::spawn_blocking(move || capture.capture(&input, &entry, historical, token));
        let mut updates = self.publications.subscribe().updates;
        let outcome = loop {
            if cancel.cancelled()
                || !historical
                    && !self
                        .publications
                        .current()
                        .changes
                        .as_ref()
                        .is_some_and(|current| Arc::ptr_eq(current, &accepted))
            {
                break Err(ServerError::ChangesReplaced);
            }
            tokio::select! {
                biased;
                _ = sleep_until(deadline) => break Err(ServerError::Deadline),
                result = &mut work => {
                    let files = match result {
                        Ok(result) => result,
                        Err(source) => Err(InternalError::Task { source }.into()),
                    };
                    let outcome = files.and_then(|files| self.commit(&accepted, &path, historical, files));
                    if let Err(error) = &outcome && !cancel.cancelled() && !matches!(error, ServerError::ChangesReplaced) { self.diagnostics.failed(error); }
                    sender.send_replace(Some(shared(outcome)));
                    return;
                },
                _ = updates.recv() => {},
            }
        };
        cancel.cancel();
        sender.send_replace(Some(shared(outcome)));
        let _ = work.await;
        let _permit = permit;
    }

    fn commit(
        &self,
        accepted: &Arc<Accepted>,
        path: &str,
        historical: bool,
        files: BTreeMap<String, File>,
    ) -> Result<String> {
        if historical {
            return self.retain(accepted, path, historical, files);
        }
        let files = RefCell::new(Some(files));
        let outcome = RefCell::new(Err(ServerError::ChangesReplaced));
        self.publications.with_changes(
            accepted,
            &Commit(&|| {
                if let Some(files) = files.borrow_mut().take() {
                    *outcome.borrow_mut() = self.retain(accepted, path, false, files);
                }
                true
            }),
        );
        outcome.into_inner()
    }

    fn retain(
        &self,
        accepted: &Arc<Accepted>,
        path: &str,
        historical: bool,
        files: BTreeMap<String, File>,
    ) -> Result<String> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.closed {
            return Err(ServerError::ChangesReplaced);
        }
        let id = if historical {
            accepted.id.clone()
        } else {
            selected_id(&self.entropy.secret())
        };
        if !historical && state.bundles.contains_key(&id) {
            return Err(ServerError::ComparisonCapacity);
        }
        if historical && !state.bundles.contains_key(&id) {
            return Err(ServerError::ChangesReplaced);
        }
        comparison_store::admit(&state, &id, &files)?;
        if historical {
            if let Some(bundle) = state.bundles.get_mut(&id) {
                for (path, file) in files {
                    bundle.files.entry(path).or_insert(file);
                }
                bundle.touched = self.clock.milliseconds();
            }
        } else {
            state.bundles.insert(
                id.clone(),
                Bundle {
                    files,
                    accepted: None,
                    touched: self.clock.milliseconds(),
                },
            );
            state.selections.insert(
                (Arc::as_ptr(accepted) as usize, path.into()),
                Selection {
                    owner: Arc::downgrade(accepted),
                    generation: id.clone(),
                },
            );
        }
        Ok(id)
    }
}

pub(crate) async fn receive(mut pending: Pending) -> Outcome {
    loop {
        if let Some(outcome) = pending.borrow().clone() {
            return outcome;
        }
        if pending.changed().await.is_err() {
            return Err(Arc::new(ServerError::ChangesReplaced));
        }
    }
}

fn selected_id(secret: &str) -> String {
    let value: String = secret.chars().take(32).collect();
    if value.len() != 32 {
        return format!("selected-{value}");
    }
    format!(
        "selected-{}-{}-4{}-a{}-{}",
        &value[..8],
        &value[8..12],
        &value[13..16],
        &value[17..20],
        &value[20..32]
    )
}

fn shared(result: Result<String>) -> Outcome {
    match result {
        Ok(id) => Ok(id),
        Err(error) => Err(Arc::new(error)),
    }
}
