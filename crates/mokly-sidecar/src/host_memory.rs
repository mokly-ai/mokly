//! Injectable physical-memory readings for default pool admission.

use std::sync::{Arc, Mutex};

use sysinfo::System;

/// Current memory available for additional resident allocations, without swap.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = HostMemoryMock))]
pub trait HostMemory: Send + Sync {
    /// Return unknown when the host or an applicable limit cannot be read.
    fn headroom_bytes(&self) -> Option<u64>;
}

/// One physical host reading, in bytes.
#[derive(Clone, Copy)]
pub struct PhysicalMemory {
    /// Total physical memory.
    pub total: u64,
    /// Physical memory used by programs and the operating system.
    pub used: u64,
}

/// Platform physical-memory query.
#[cfg_attr(test, unimock::unimock(api = HostProbeMock))]
pub trait HostProbe: Send + Sync {
    /// Read physical totals without counting swap.
    fn physical_memory(&self) -> PhysicalMemory;
}

/// Applicable process limits, including reclaimable file cache.
#[cfg_attr(test, unimock::unimock(api = MemoryLimitsMock))]
pub trait MemoryLimits: Send + Sync {
    /// Combine the host reading with every applicable finite process limit.
    fn headroom_bytes(&self, host: u64) -> Option<u64>;
}

/// Shared host and process-limit estimate.
pub struct MemoryEstimate {
    probe: Arc<dyn HostProbe>,
    limits: Arc<dyn MemoryLimits>,
}

impl MemoryEstimate {
    /// Inject the platform query and process-limit reader.
    pub fn new(probe: Arc<dyn HostProbe>, limits: Arc<dyn MemoryLimits>) -> Self {
        Self { probe, limits }
    }
}

impl HostMemory for MemoryEstimate {
    fn headroom_bytes(&self) -> Option<u64> {
        let memory = self.probe.physical_memory();
        if memory.total == 0 || memory.used == 0 || memory.used > memory.total {
            return None;
        }
        self.limits.headroom_bytes(memory.total - memory.used)
    }
}

/// Sysinfo's cache-aware physical-memory query.
#[derive(Default)]
pub struct SysinfoMemory(Mutex<System>);

impl HostProbe for SysinfoMemory {
    fn physical_memory(&self) -> PhysicalMemory {
        let mut system = self.0.lock().unwrap_or_else(|error| error.into_inner());
        system.refresh_memory();
        PhysicalMemory {
            total: system.total_memory(),
            used: system.used_memory(),
        }
    }
}

/// Host-only admission where no process memory controller applies.
pub struct NoMemoryLimits;

impl MemoryLimits for NoMemoryLimits {
    fn headroom_bytes(&self, host: u64) -> Option<u64> {
        Some(host)
    }
}

#[cfg(test)]
#[path = "_tests_/host_memory_tests.rs"]
mod host_memory_tests;
