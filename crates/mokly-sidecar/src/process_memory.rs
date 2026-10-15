//! Cross-platform resident-set query behind a test boundary.

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

use crate::error::Result;

/// Process resident memory, kept separate from process orchestration.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MemoryMock))]
pub trait ResidentMemory: Send + Sync {
    /// Current resident bytes of a process, or zero after it has exited.
    fn resident_bytes(&self, pid: u32) -> Result<u64>;
}

/// Host memory query for supported Linux, macOS, and Windows targets.
pub struct SystemMemory;

impl ResidentMemory for SystemMemory {
    fn resident_bytes(&self, pid: u32) -> Result<u64> {
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
            true,
            ProcessRefreshKind::nothing().with_memory(),
        );
        Ok(system
            .process(Pid::from_u32(pid))
            .map_or(0, |process| process.memory()))
    }
}
