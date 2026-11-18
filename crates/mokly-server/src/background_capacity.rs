//! Injectable current bound for the sliding background render window.

/// Current number of background renders that may be in flight.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BackgroundCapacityMock))]
pub trait BackgroundCapacity: Send + Sync {
    /// Read capacity again before a view starts; zero permits one view.
    fn capacity(&self) -> usize;
}

/// Fixed capacity for hosts without a changing resource bound.
pub struct FixedCapacity(
    /// Maximum number of concurrent background renders.
    pub usize,
);

impl BackgroundCapacity for FixedCapacity {
    fn capacity(&self) -> usize {
        self.0
    }
}
