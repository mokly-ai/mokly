//! Injectable identity of the running native image, sampled without starting a process.

/// A writer may expose no identity until its bounded streaming image hash completes.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = NativeIdentityMock))]
pub trait NativeIdentity: Send + Sync {
    /// Whether the command cancelled optional preparation.
    fn cancelled(&self) -> bool {
        false
    }
    /// Prepare the identity on the optional writer before its document work.
    fn prepare(&self) {}
    /// Digest the running image, rather than a later replacement at its pathname.
    fn current(&self) -> Option<[u8; 32]>;
}
