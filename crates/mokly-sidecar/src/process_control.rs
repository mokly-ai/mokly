//! Shared process-tree control, shutdown enqueueing, and guaranteed kill on drop.

use std::sync::mpsc::{Receiver, SyncSender};
use std::sync::{Arc, Mutex};

use mokly_platform::processes::ProcessGroup;

use crate::codec::encode;
use crate::error::{InternalError, Result};
use crate::methods::{Call, Empty};
use crate::process_clock::Wait;
use crate::wire::Request;
use crate::workers::WorkerControl;

pub(super) struct ProcessControl {
    pub(super) group: Box<dyn ProcessGroup>,
    pub(super) outgoing: SyncSender<Vec<u8>>,
    pub(super) exited: Mutex<Receiver<()>>,
    pub(super) drained: Mutex<Receiver<()>>,
    pub(super) clock: Arc<dyn Wait>,
}

impl WorkerControl for ProcessControl {
    fn shutdown(&self) -> Result<()> {
        let frame = encode(&Request {
            id: 9_007_199_254_740_991,
            call: Call::Shutdown(Empty {}),
        })?;
        if self.outgoing.try_send(frame).is_err() {
            self.kill()?;
        }
        Ok(())
    }

    fn kill(&self) -> Result<()> {
        match self.group.kill() {
            Ok(()) => Ok(()),
            Err(source) => Err(InternalError::Platform { source }.into()),
        }
    }

    fn finish(&self, deadline: u64) -> Result<()> {
        let receiver = match self.exited.lock() {
            Ok(receiver) => receiver,
            Err(_) => return Err(InternalError::Synchronization.into()),
        };
        if !self.clock.exited(&receiver, deadline) {
            self.kill()?;
            self.clock.reaped(&receiver);
        } else {
            let drained = match self.drained.lock() {
                Ok(drained) => drained,
                Err(_) => return Err(InternalError::Synchronization.into()),
            };
            if !self.clock.drained(&drained, deadline) {
                self.kill()?;
            }
        }
        Ok(())
    }
}

impl Drop for ProcessControl {
    fn drop(&mut self) {
        if let Err(error) = self.group.kill() {
            tracing::warn!(%error, "could not stop sidecar tree");
        }
    }
}

#[cfg(test)]
#[path = "_tests_/process_control_tests.rs"]
mod process_control_tests;
