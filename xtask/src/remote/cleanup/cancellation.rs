//! Optional GitHub cancellation and typed ended-run diagnostics.

use crate::remote::cleanup::guard::CleanupGuard;
use crate::remote::contracts::GithubRunState;

impl CleanupGuard<'_> {
    /// Claim a known run once before printing its line and attempting cancellation.
    pub(super) fn cancel_once(&self, id: &str, github: bool) {
        if !github {
            return;
        }
        let run = {
            let mut remaining = self.remaining();
            let Some(state) = remaining.get_mut(id) else {
                return;
            };
            if state.cancel_attempted {
                return;
            }
            let Some(run) = state.run else {
                return;
            };
            state.cancel_attempted = true;
            run
        };
        self.report(&format!("information: cleanup box={id} GitHub run={run}"));
        self.cancel(run);
    }

    /// Warn once when stop attempts end without any recovered run ID.
    pub(super) fn warn_missing_run(&self, id: &str, run: Option<u64>) {
        if run.is_some() {
            return;
        }
        {
            let mut remaining = self.remaining();
            if let Some(state) = remaining.get_mut(id) {
                if state.missing_run_warned {
                    return;
                }
                state.missing_run_warned = true;
            }
        }
        self.report(&format!(
            "warning: no GitHub run ID for {id}; cancellation skipped"
        ));
    }

    /// Suppress a cancellation warning only when a typed read proves it ended.
    fn cancel(&self, run: u64) {
        if let Some(Err(error)) = self.during_unwind(|| self.dependencies.github.cancel(run)) {
            match self.during_unwind(|| self.dependencies.github.state(run)) {
                Some(Ok(GithubRunState::Completed)) => self.report(&format!(
                    "information: GitHub run={run} already ended; cancellation not needed"
                )),
                state => {
                    if let Some(Err(state_error)) = state {
                        self.warn(&format!("run state for {run} failed"), &state_error);
                    }
                    self.warn(&format!("cancellation for {run} failed"), &error);
                }
            }
        }
    }
}
