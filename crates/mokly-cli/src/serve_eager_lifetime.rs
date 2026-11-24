//! Only the lifetime of the graph selected by classification can detach at keep.

use std::sync::{Arc, Mutex, Weak};

use mokly_cli::cancellation::Cancellation;
use mokly_git::control;
use mokly_server::changes::{ChangeCancellation, ChangeCommit};
use mokly_server::changes_signal::ChangeSignal;

use crate::serve_base_cancel::BaseLifetime;

pub(super) trait LifetimeSelection: BaseLifetime {
    fn select(&self, lifetime: Arc<dyn BaseLifetime>);
}

pub(super) struct SelectedLifetime(pub(super) Mutex<Arc<dyn BaseLifetime>>);

impl SelectedLifetime {
    fn current(&self) -> Arc<dyn BaseLifetime> {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
}

impl LifetimeSelection for SelectedLifetime {
    fn select(&self, lifetime: Arc<dyn BaseLifetime>) {
        *self.0.lock().unwrap_or_else(|error| error.into_inner()) = lifetime;
    }
}
impl BaseLifetime for SelectedLifetime {
    fn commit_keep(&self, publication: &dyn ChangeCommit) -> bool {
        self.current().commit_keep(publication)
    }
    fn detach(&self) {
        self.current().detach();
    }
}
impl Cancellation for SelectedLifetime {
    fn requested(&self) -> bool {
        self.current().requested()
    }
    fn interrupt(&self) -> bool {
        self.current().interrupt()
    }
}
impl ChangeCancellation for SelectedLifetime {
    fn cancelled(&self) -> bool {
        self.current().requested()
    }
    fn cancel(&self) {
        self.current().cancel();
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        self.current().observe(signal);
    }
}
impl control::Cancellation for SelectedLifetime {
    fn cancelled(&self) -> bool {
        self.current().requested()
    }
}
