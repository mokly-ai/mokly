//! Mimalloc configuration for the CLI process.

use std::ffi::c_long;

use libmimalloc_sys::{mi_option_set_default, mi_option_t};

/// Index of `mi_option_purge_delay` in the mimalloc v2 and v3 headers.
pub(super) const PURGE_DELAY_OPTION: mi_option_t = 15;

/// Default purge delay in milliseconds.
const PURGE_DELAY_MS: c_long = 30;

/// Set the default purge delay before starting any threads.
///
/// Mimalloc reads environment options before `main` and keeps a valid override.
pub(super) fn return_freed_memory_sooner() {
    // SAFETY: The option index is valid and main calls this before starting threads.
    unsafe { mi_option_set_default(PURGE_DELAY_OPTION, PURGE_DELAY_MS) };
}
