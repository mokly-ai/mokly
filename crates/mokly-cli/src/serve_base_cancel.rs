//! A kept base drops its preparing reader and follows only the command stop.

use std::sync::{Arc, Mutex, Weak};

use mokly_cli::cancellation::Cancellation;
use mokly_git::control;
use mokly_server::changes::{ChangeCancellation, ChangeCommit};
use mokly_server::changes_signal::ChangeSignal;

use crate::serve_changes_base::CombinedCancel;

/// One cancellation lifetime shared by all services of a prepared base.
pub(super) trait BaseLifetime:
    Cancellation + ChangeCancellation + control::Cancellation
{
    /// Called under the original classification's publication guard at keep.
    fn detach(&self);
    /// Serialize an eligible keep with the independent pending owner, when one exists.
    fn commit_keep(&self, publication: &dyn ChangeCommit) -> bool;
}

/// The base's initial reader lifetime, until its successful keep.
pub(super) struct PreparingBase {
    command: Arc<dyn Cancellation>,
    preparing: Mutex<Option<Arc<CombinedCancel>>>,
    owner: Mutex<Option<Arc<dyn ChangeCancellation>>>,
}

impl PreparingBase {
    /// Attach base work to the preparing classification and capture scope.
    pub(super) fn new(preparing: Arc<CombinedCancel>) -> Self {
        Self {
            command: preparing.command.clone(),
            preparing: Mutex::new(Some(preparing)),
            owner: Mutex::new(None),
        }
    }

    pub(super) fn owned(
        preparing: Arc<CombinedCancel>,
        owner: Arc<dyn ChangeCancellation>,
    ) -> Self {
        Self {
            command: preparing.command.clone(),
            preparing: Mutex::new(Some(preparing)),
            owner: Mutex::new(Some(owner)),
        }
    }

    fn preparing(&self) -> Option<Arc<CombinedCancel>> {
        self.preparing
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
}

impl BaseLifetime for PreparingBase {
    fn commit_keep(&self, publication: &dyn ChangeCommit) -> bool {
        let owner = self
            .owner
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        match owner {
            Some(owner) => owner.commit(publication),
            None => publication.apply(),
        }
    }
    fn detach(&self) {
        self.preparing
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        self.owner
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
    }
}

impl Cancellation for PreparingBase {
    fn requested(&self) -> bool {
        self.command.requested()
            || self.preparing().is_some_and(|preparing| {
                preparing.generation.cancelled() || preparing.operation.cancelled()
            })
    }

    fn interrupt(&self) -> bool {
        if let Some(preparing) = self.preparing() {
            preparing.generation.cancel();
        }
        false
    }
}

impl ChangeCancellation for PreparingBase {
    fn cancel(&self) {
        self.interrupt();
    }

    fn cancelled(&self) -> bool {
        self.requested()
    }

    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        if let Some(preparing) = self.preparing() {
            preparing.observe(signal);
        }
    }
}

impl control::Cancellation for PreparingBase {
    fn cancelled(&self) -> bool {
        self.requested()
    }
}
