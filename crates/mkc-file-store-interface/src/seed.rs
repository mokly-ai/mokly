//! Bounded, replaceable objects for one preview seed run, without enumeration.

use bytes::Bytes;

use crate::error::Result;
use crate::seed_name::SeedName;

/// Storage for seed inputs and results under the adapter's root or prefix.
#[unimock::unimock(api = SeedStoreMock)]
pub trait SeedStore: Send + Sync {
    /// Atomically publish the complete bytes, replacing any existing object.
    /// Puts above the name's size ceiling fail with an integrity error.
    fn put(&self, name: &SeedName, bytes: Bytes) -> Result<()>;
    /// Read at most the smaller of `max_bytes` and the name's size ceiling.
    ///
    /// Missing objects return `None`. Larger objects fail integrity checks
    /// without buffering the complete object. A zero limit permits empty objects.
    fn get(&self, name: &SeedName, max_bytes: u64) -> Result<Option<Vec<u8>>>;
}
