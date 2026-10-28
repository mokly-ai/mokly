//! One PostCSS context sends one sidecar request at a time and remembers its failures.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};

use mokly_model::runtime_diagnostic::RuntimeDiagnostic;

/// The request queue of one PostCSS context.
#[derive(Default)]
pub(crate) struct Turns {
    pub(crate) queue: Mutex<Failures>,
    /// Tickets taken so far, including requests that still wait for their turn.
    pub(crate) tickets: AtomicU64,
}

/// Failures that later requests of the context receive without a sidecar request.
#[derive(Default)]
pub(crate) struct Failures {
    /// The diagnostic of each failed effective input.
    inputs: BTreeMap<String, RuntimeDiagnostic>,
    /// A timeout or crash after its retry, with the first ticket that it spares.
    lost: Option<(u64, RuntimeDiagnostic)>,
}

/// One request's turn. The next request of the context starts when it drops.
pub(crate) struct Turn<'a> {
    ticket: u64,
    tickets: &'a AtomicU64,
    failures: MutexGuard<'a, Failures>,
}

impl Turns {
    /// Take a ticket, then wait until the earlier requests of the context finish.
    pub(crate) fn take(&self) -> Turn<'_> {
        let ticket = self.tickets.fetch_add(1, Ordering::SeqCst);
        Turn {
            ticket,
            tickets: &self.tickets,
            failures: self.queue.lock().unwrap_or_else(|error| error.into_inner()),
        }
    }
}

impl Turn<'_> {
    /// The recorded failure of this input, or a lost child that this request waited for.
    pub(crate) fn failure(&self, key: &str) -> Option<RuntimeDiagnostic> {
        if let Some(diagnostic) = self.failures.inputs.get(key) {
            return Some(diagnostic.clone());
        }
        match &self.failures.lost {
            Some((spared, diagnostic)) if self.ticket < *spared => Some(diagnostic.clone()),
            _ => None,
        }
    }

    /// Record a failed input. A lost child also fails every request that already has a ticket.
    pub(crate) fn fail(&mut self, key: &str, diagnostic: RuntimeDiagnostic, lost: bool) {
        if lost {
            self.failures.lost = Some((self.tickets.load(Ordering::SeqCst), diagnostic.clone()));
        }
        self.failures.inputs.insert(key.into(), diagnostic);
    }
}
