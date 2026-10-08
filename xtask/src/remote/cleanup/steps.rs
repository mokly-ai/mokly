//! Each box closes SSH, checks status and retries stop independently.

use std::time::Duration;

use crate::remote::cleanup::guard::CleanupGuard;
use crate::remote::contracts::Disconnection;
use crate::remote::parse::{box_is_completed, run_id_from_status};

impl CleanupGuard<'_> {
    /// Close each tracked box's shared SSH connection once before other calls.
    fn disconnect(&self, id: &str) {
        {
            let mut remaining = self.remaining();
            let Some(state) = remaining.get_mut(id) else {
                return;
            };
            if state.disconnect_attempted {
                return;
            }
            state.disconnect_attempted = true;
        }
        match self.during_unwind(|| self.dependencies.blacksmith.disconnect(id)) {
            Some(Ok(Disconnection::Absent)) => {
                self.report(&format!("information: no shared SSH connection for {id}"))
            }
            Some(Err(error)) => {
                self.warn(&format!("could not close SSH connection for {id}"), &error)
            }
            Some(Ok(Disconnection::Closed)) | None => {}
        }
    }

    /// Read completion proof and recover run IDs only before cancellation starts.
    fn status(&self, id: &str, recorded: Option<u64>) -> (bool, Option<u64>) {
        match self.during_unwind(|| self.dependencies.blacksmith.status(id)) {
            Some(Ok(status)) => {
                if box_is_completed(&status, id) {
                    self.remaining().remove(id);
                    self.report(&format!(
                        "information: box={id} already completed; cleanup skipped"
                    ));
                    (true, None)
                } else {
                    let mut remaining = self.remaining();
                    let run = match remaining.get_mut(id) {
                        Some(state) if state.cancel_attempted => state.run,
                        Some(state) => {
                            state.run = run_id_from_status(&status).or(state.run);
                            state.run
                        }
                        None => recorded,
                    };
                    (false, run)
                }
            }
            Some(Err(error)) => {
                self.warn(&format!("status for {id} failed"), &error);
                (false, recorded)
            }
            None => (false, recorded),
        }
    }

    /// Retry one box within its shared three-attempt limit.
    pub(super) fn stop_one(&self, id: &str, github: bool) {
        self.disconnect(id);
        self.cancel_once(id, github);
        let Some(mut state) = self.remaining().get(id).copied() else {
            return;
        };
        if state.attempts == 3 {
            let (completed, run) = self.status(id, state.run);
            if !completed {
                self.cancel_once(id, github);
                self.warn_missing_run(id, run);
            }
            return;
        }
        let run = loop {
            if state.attempts != 0 {
                let seconds = if state.attempts == 1 { 5 } else { 10 };
                self.during_unwind(|| self.dependencies.clock.wait(Duration::from_secs(seconds)));
            }
            let (completed, run) = self.status(id, state.run);
            if completed {
                return;
            }
            state.run = run;
            self.cancel_once(id, github);
            state.attempts += 1;
            if let Some(record) = self.remaining().get_mut(id) {
                record.attempts = state.attempts;
            }
            match self.during_unwind(|| self.dependencies.blacksmith.stop(id)) {
                Some(Ok(())) => {
                    self.remaining().remove(id);
                    break run;
                }
                Some(Err(error)) => {
                    self.warn(&format!("could not stop {id}"), &error);
                }
                None => {}
            }
            if state.attempts == 3 {
                break run;
            }
        };
        self.warn_missing_run(id, run);
    }
}
