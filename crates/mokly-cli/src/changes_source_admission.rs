//! Optional source scheduling is independent of dependency and render admission.

use mokly_compare::error::Result;

/// Only a complete existing source lease proves the current warm path.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceCache {
    /// An existing complete extraction is already leased.
    Leased,
    /// No complete extraction was leased before configuration discovery.
    Unleased,
}

#[cfg_attr(test, unimock::unimock(api = SourceAdmissionMock))]
/// Schedule historical discovery without changing source or dependency selection.
pub trait SourceAdmission: Send + Sync {
    /// Wait only when an existing complete extraction does not supply the warm path.
    fn enter(&self, cache: SourceCache) -> Result<()>;
}
