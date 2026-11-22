//! Mimalloc configuration for the CLI process.

use std::ffi::c_long;
use std::sync::Once;

use libmimalloc_sys::{mi_option_set_default, mi_option_t};

/// Index of `mi_option_purge_delay` in the mimalloc v2 and v3 headers.
pub(super) const PURGE_DELAY_OPTION: mi_option_t = 15;

/// Default purge delay in milliseconds.
const PURGE_DELAY_MS: c_long = 30;

/// Allocator policy applied after Serve publishes ready Changes.
#[cfg_attr(test, unimock::unimock(api = PurgeDelayMock))]
pub(super) trait PurgeDelay {
    /// Reduce the default delay for returning freed memory.
    fn return_freed_memory_sooner(&self);
}

/// Process-wide purge delay backed by mimalloc.
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
