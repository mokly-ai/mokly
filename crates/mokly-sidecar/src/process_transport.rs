//! Bounded pipe transport and per-request deadline selection.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, SyncSender};

use crate::client::Transport;
use crate::codec::encode;
use crate::error::{Error, Result};
use crate::process_clock::Wait;
use crate::wire::{Frame, Request};

pub(super) struct Deadlines {
    pub(super) absolute: AtomicU64,
    pub(super) duration: AtomicU64,
}

pub(super) struct PipeTransport {
    pub(super) outgoing: SyncSender<Vec<u8>>,
    pub(super) incoming: Receiver<Result<Frame>>,
    pub(super) clock: Arc<dyn Wait>,
    pub(super) deadlines: Arc<Deadlines>,
}

impl Transport for PipeTransport {
    fn send(&mut self, request: &Request) -> Result<()> {
        let frame = encode(request)?;
        if self.outgoing.send(frame).is_err() {
            return Err(Error::Crashed);
        }
        Ok(())
    }

    fn receive(&mut self) -> Result<Frame> {
        self.clock.frame(
            &self.incoming,
            self.deadlines.absolute.load(Ordering::SeqCst),
            self.deadlines.duration.load(Ordering::SeqCst),
        )
    }
}
