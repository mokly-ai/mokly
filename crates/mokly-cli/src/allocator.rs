//! Purge delay policy of mimalloc, the global allocator of the `mokly` binary.
//!
//! The purge delay is the time after which a freed memory range becomes due for
//! a purge, its return to the operating system. mimalloc runs a due purge only
//! during a later allocator call: a page free, a page abandon, or a collect. So
//! an idle process can keep freed memory for longer than the delay.
//!
//! `build` and `publish` keep the mimalloc default. Serve keeps it until its
//! first ready Changes, and then sets the shorter `PURGE_DELAY_MS` as the default.

use std::ffi::c_long;
use std::sync::Once;

use libmimalloc_sys::{mi_option_set_default, mi_option_t};

/// Index of `mi_option_purge_delay` in the mimalloc v2 and v3 headers.
pub(super) const PURGE_DELAY_OPTION: mi_option_t = 15;

/// Purge delay in milliseconds that Serve sets after its first ready Changes.
///
/// The mimalloc v3 default is 1,000 ms.
const PURGE_DELAY_MS: c_long = 30;

/// Allocator policy that Serve applies after it publishes ready Changes.
#[cfg_attr(test, unimock::unimock(api = PurgeDelayMock))]
pub(super) trait PurgeDelay {
    /// Make the shorter purge delay the default for the rest of the process.
    ///
    /// Serve calls this after each ready Changes result, and never after a
    /// failed one. A purge delay that the environment set stays.
    fn return_freed_memory_sooner(&self);
}

/// Process-wide purge delay backed by mimalloc.
///
/// Only the first call in a process writes the default. mimalloc reads
/// `MIMALLOC_PURGE_DELAY` and the legacy `MIMALLOC_RESET_DELAY` before `main`.
/// `mi_option_set_default` writes only an option that no valid environment value
/// set.
pub(super) struct MimallocPurgeDelay;

impl PurgeDelay for MimallocPurgeDelay {
    fn return_freed_memory_sooner(&self) {
        static SET_DEFAULT: Once = Once::new();
        SET_DEFAULT.call_once(|| {
            // SAFETY: The option index is valid and mimalloc reads its options at startup.
            // Once limits the update to one write. This relies on mimalloc v3 storing the
            // delay in a naturally aligned C long, so concurrent readers see either delay.
            unsafe { mi_option_set_default(PURGE_DELAY_OPTION, PURGE_DELAY_MS) };
        });
    }
}
