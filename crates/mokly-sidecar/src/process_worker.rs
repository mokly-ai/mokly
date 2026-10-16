//! Concrete client session with one deadline shared by all diagnostic frames.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::client::{Events, SidecarClient};
use crate::error::Result;
use crate::methods::Call;
use crate::process_clock::Wait;
use crate::process_memory::ResidentMemory;
use crate::process_transport::Deadlines;
use crate::wire::{Event, MethodResult, Request};
use crate::workers::{Diagnostics, Worker};

pub(super) struct ProcessWorker {
    pub(super) client: Box<dyn SidecarClient>,
    pub(super) clock: Arc<dyn Wait>,
    pub(super) memory: Box<dyn ResidentMemory>,
    pub(super) discover_memory: AtomicBool,
    pub(super) deadlines: Arc<Deadlines>,
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
        if matches!(&request.call, Call::ProcessCss(_)) {
            self.discover_memory.store(true, Ordering::Relaxed);
        }
        self.client.request(request)
    }

    fn resident_bytes(&self) -> Result<u64> {
        self.memory
            .resident_bytes(self.discover_memory.swap(false, Ordering::Relaxed))
    }
}

pub(super) struct ForwardEvents(pub(super) Arc<dyn Diagnostics>);

impl Events for ForwardEvents {
    fn emit(&mut self, event: Event) {
        let Event::Diagnostic { message } = event;
        self.0.emit(&message);
    }
}

#[cfg(test)]
#[path = "_tests_/process_worker_tests.rs"]
mod process_worker_tests;
