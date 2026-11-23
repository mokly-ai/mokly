//! Unprovable working installations keep graph validation on the normal serial phase.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_compare::base_freshness::InstallInputs;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::{Error, Result};
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_signal::ChangeSignal;

use crate::changes_validation_admission::{GraphPreparationAdmission, ValidationRequest};
use crate::serve_eager_admission::EagerAdmission;

pub(super) trait PreparationValidation: GraphPreparationAdmission {
    fn inputs(&self, known: bool);
    fn after_usage(&self) -> bool;
}

pub(super) struct ProvenValidation {
    phase: Arc<dyn EagerAdmission>,
    cancel: Arc<dyn ChangeCancellation>,
    installs: Arc<dyn InstallInputs>,
    inputs: AtomicBool,
    after_usage: AtomicBool,
    state: Mutex<()>,
    changed: Condvar,
}

impl ProvenValidation {
    pub(super) fn shared(
        phase: Arc<dyn EagerAdmission>,
        cancel: Arc<dyn ChangeCancellation>,
        installs: Arc<dyn InstallInputs>,
    ) -> Arc<dyn PreparationValidation> {
        let gate = Arc::new(Self {
            phase,
            cancel,
            installs,
            inputs: AtomicBool::new(false),
            after_usage: AtomicBool::new(false),
            state: Mutex::new(()),
            changed: Condvar::new(),
        });
        let signal: Arc<dyn ChangeSignal> = gate.clone();
        gate.phase.observe(Arc::downgrade(&signal));
        gate.cancel.observe(Arc::downgrade(&signal));
        gate
    }

    fn eligible(&self, request: &ValidationRequest<'_>) -> Result<bool> {
        let (Some(checkout), Some(selection)) = (request.checkout, request.selection) else {
            return Ok(false);
        };
        if checkout.filtered
            || !self.inputs.load(Ordering::Acquire)
            || !selection.unmapped.is_empty()
            || request
                .base
                .is_some_and(|base| base.dependencies.tier == Tier::Fallback)
        {
            return Ok(false);
        }
        if request
            .base
            .is_some_and(|base| base.dependencies.tier == Tier::Installed)
        {
            return Ok(true);
        }
        for directory in &selection.directories {
            match self
                .installs
                .read(&request.config.repo_root.join(directory))
            {
                Ok(Some(_)) => {}
                Err(Error::Cancelled) => return Err(Error::Cancelled),
                _ => return Ok(false),
            }
        }
        Ok(true)
    }
}

impl GraphPreparationAdmission for ProvenValidation {
    fn enter(&self, request: &ValidationRequest<'_>) -> Result<()> {
        if !self.phase.adopted() && !self.eligible(request)? {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            while !self.phase.adopted() && !self.cancel.cancelled() {
                state = self
                    .changed
                    .wait(state)
                    .unwrap_or_else(|error| error.into_inner());
            }
        }
        self.after_usage
            .store(self.phase.adopted(), Ordering::Release);
        if self.cancel.cancelled() {
            Err(Error::Cancelled)
        } else {
            Ok(())
        }
    }
}

impl PreparationValidation for ProvenValidation {
    fn inputs(&self, known: bool) {
        self.inputs.store(known, Ordering::Release);
    }
    fn after_usage(&self) -> bool {
        self.after_usage.load(Ordering::Acquire)
    }
}

impl ChangeSignal for ProvenValidation {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}
