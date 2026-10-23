//! Injected blocking renderer and explicit release guards.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_model::usage::CatalogueUsage;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock, PreviewDocument};
use crate::diagnostics::DiagnosticsMock;
use crate::revision::{RenderLease, RenderLeaseMock};
use crate::work::Workers;

pub(super) type BlockGate = Arc<(Mutex<bool>, Condvar)>;
pub(super) type BlockedWork = (
    Unimock,
    Arc<Workers>,
    Arc<dyn Documents>,
    Arc<Notify>,
    BlockGate,
    Arc<AtomicUsize>,
);

pub(super) fn blocked() -> BlockedWork {
    blocked_with(1, false, 0)
}

pub(super) fn blocked_with(parallelism: u32, block_all: bool, timeouts: usize) -> BlockedWork {
    let started = Arc::new(Notify::new());
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let calls = Arc::new(AtomicUsize::new(0));
    let documents = Unimock::new(
        DocumentsMock::preview
            .each_call(matching!(_, _))
            .answers_arc({
                let started = started.clone();
                let gate = gate.clone();
                let calls = calls.clone();
                Arc::new(move |_, _, _| {
                    let first = calls.fetch_add(1, Ordering::SeqCst) == 0;
                    if first {
                        started.notify_one();
                    }
                    if first || block_all {
                        let (lock, signal) = gate.as_ref();
                        let mut released = lock.lock().unwrap();
                        while !*released {
                            released = signal.wait(released).unwrap();
                        }
                    }
                    Ok(PreviewDocument {
                        files: BTreeMap::new(),
                        document: "index.html".into(),
                        usage: CatalogueUsage::Ready {
                            instances: vec![],
                            slots: vec![],
                            ranges: vec![],
                        },
                    })
                })
            }),
    );
    let diagnostics = if timeouts == 0 {
        Unimock::new(())
    } else {
        Unimock::new(
            DiagnosticsMock::failed
                .each_call(matching!(_))
                .returns(())
                .n_times(timeouts),
        )
    };
    let service: Arc<dyn Documents> = Arc::new(documents.clone());
    (
        documents,
        Arc::new(Workers::new(parallelism, Arc::new(diagnostics))),
        service,
        started,
        gate,
        calls,
    )
}

pub(super) fn release(gate: &Arc<(Mutex<bool>, Condvar)>) {
    *gate.0.lock().unwrap() = true;
    gate.1.notify_all();
}

pub(super) fn lease() -> Arc<dyn RenderLease> {
    Arc::new(Unimock::new(
        RenderLeaseMock::valid.each_call(matching!()).returns(true),
    ))
}

pub(super) struct ReleaseOnDrop(BlockGate);
impl Drop for ReleaseOnDrop {
    fn drop(&mut self) {
        release(&self.0);
    }
}
pub(super) fn cleanup(gate: BlockGate) -> ReleaseOnDrop {
    ReleaseOnDrop(gate)
}
