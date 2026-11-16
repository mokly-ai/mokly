//! Nonblocking leases keep reusable encoder workspaces inside transit headroom.

/// Maximum number of reserved or active cache encoders.
pub(crate) const ENCODER_LEASES: usize = 8;

/// Idle workspaces retain their charge until the cache is dropped.
pub(crate) struct EncoderPool {
    available: Vec<usize>,
    allocated: usize,
    workspace: usize,
    /// Fixed workspace charge, including idle leases.
    pub(crate) bytes: usize,
}

impl EncoderPool {
    /// Allocate workspaces on first use, up to the fixed lease limit.
    pub(crate) fn new(workspace: usize) -> Self {
        Self {
            available: Vec::with_capacity(ENCODER_LEASES),
            allocated: 0,
            workspace,
            bytes: 0,
        }
    }

    /// Take an idle lease or reserve a new workspace from the available headroom.
    pub(crate) fn take(&mut self, headroom: usize) -> Option<usize> {
        if let Some(lease) = self.available.pop() {
            return Some(lease);
        }
        if self.allocated == ENCODER_LEASES || self.workspace > headroom {
            return None;
        }
        let lease = self.allocated;
        self.allocated += 1;
        self.bytes += self.workspace;
        Some(lease)
    }

    /// Return the lease while retaining its reusable workspace and charge.
    pub(crate) fn release(&mut self, lease: usize) {
        self.available.push(lease);
    }
}
