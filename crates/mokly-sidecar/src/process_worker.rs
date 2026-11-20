//! Concrete client session with one deadline shared by all diagnostic frames.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use crate::client::{Events, SidecarClient};
use crate::error::Result;
use crate::methods::Call;
use crate::operations::Operation;
use crate::postcss_phase::PhaseState;
use crate::process_clock::Wait;
use crate::process_memory::ResidentMemory;
use crate::process_transport::Deadlines;
use crate::wire::{Event, MethodResult, Request};
use crate::workers::{Diagnostics, Worker};

pub(super) struct ProcessWorker {
    pub(super) diagnostics: Arc<dyn Diagnostics>,
    pub(super) client: Box<dyn SidecarClient>,
    pub(super) clock: Arc<dyn Wait>,
    pub(super) memory: Arc<dyn ResidentMemory>,
    pub(super) discover_memory: Arc<AtomicBool>,
    pub(super) deadlines: Arc<Deadlines>,
    pub(super) phases: PhaseState,
    pub(super) compile_count: Arc<AtomicU64>,
}

impl ProcessWorker {
    fn deadline(&self, duration: u64) {
        self.deadlines.duration.store(duration, Ordering::SeqCst);
        self.deadlines.absolute.store(
            self.clock.now_ms().saturating_add(duration),
            Ordering::SeqCst,
        );
    }
}

impl Worker for ProcessWorker {
    fn handshake(&mut self, deadline_ms: u64) -> Result<()> {
        self.deadline(deadline_ms);
        self.client.handshake()
    }

    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult> {
        self.deadline(deadline_ms);
        self.compile_count.store(0, Ordering::Relaxed);
        if matches!(&request.call, Call::ProcessCss(_)) {
            self.phases.reset_stylesheet();
            self.discover_memory.store(true, Ordering::Relaxed);
        }
        let mut result = self.client.request(request);
        if let Ok(MethodResult::Bundle(bundle)) = &mut result {
            bundle.compile_count = self.compile_count.load(Ordering::Relaxed);
        }
        if matches!(&request.call, Call::ProcessCss(_))
            && let Err(crate::error::Error::Timeout { deadline_ms, .. }) = &result
            && let Some(phase) = self.phases.summary()
        {
            return Err(crate::error::Error::Timeout {
                deadline_ms: *deadline_ms,
                phase: Some(phase),
            });
        }
        result
    }

    fn memory_pressure(&self) {
        self.diagnostics.emit("Sidecar replacement remains above 1 GiB resident memory; backing off memory checks up to 500 completed requests.");
    }
    fn resident_bytes(&self) -> Result<u64> {
        self.memory
            .resident_bytes(self.discover_memory.swap(false, Ordering::Relaxed))
    }
}

pub(super) struct ForwardEvents {
    pub(super) diagnostics: Arc<dyn Diagnostics>,
    pub(super) phases: PhaseState,
    pub(super) compile_count: Arc<AtomicU64>,
}

impl Events for ForwardEvents {
    fn emit(&mut self, event: Event) {
        match event {
            Event::Diagnostic { message } => {
                if !self.phases.record(&message) {
                    self.diagnostics.emit(&message);
                }
            }
            Event::Operation { operation, pid } => {
                if operation == Operation::Esbuild {
                    self.compile_count.fetch_add(1, Ordering::Relaxed);
                }
                self.diagnostics.operation(operation, pid);
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/process_worker_tests.rs"]
mod process_worker_tests;

#[cfg(test)]
#[path = "_tests_/process_bundle_tests.rs"]
mod process_bundle_tests;
