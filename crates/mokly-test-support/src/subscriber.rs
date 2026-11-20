//! Arbitrary scoped subscribers share the same process-wide interest guard.

use tracing::Subscriber;

use crate::interest_guard;

/// Run with the original subscriber after keeping parallel callsites enabled.
/// The subscriber's downcasts and dispatcher lifetime remain unchanged.
pub fn with_default<S, T>(subscriber: S, run: impl FnOnce() -> T) -> T
where
    S: Subscriber + Send + Sync + 'static,
{
    interest_guard::install();
    tracing::subscriber::with_default(subscriber, run)
}
