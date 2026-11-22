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
/// `MIMALLOC_PURGE_DELAY` before `main`. It reads the legacy name
/// `MIMALLOC_RESET_DELAY` only when the environment has no `MIMALLOC_PURGE_DELAY`.
/// `mi_option_set_default` writes only an option that no valid environment value
/// set.
///
/// The write is a known formal data race. Serve's other threads can read the
/// purge delay while the write runs, and the bindings say that the setter is not
/// thread safe. The mimalloc v3.3.2 sources that `libmimalloc-sys` 0.1.49 vendors
/// show why a reader still gets a valid delay:
///
/// - Each option is a plain `long` (`include/mimalloc/internal.h:407-413`).
/// - `mi_option_get` reads it from any thread without atomics
///   (`src/options.c:271-280`).
/// - The options comment says that options "can be accessed by multiple threads"
///   (`src/options.c:27-30`).
/// - mimalloc exports `mi_option_set` for use at run time
///   (`include/mimalloc.h:506`).
///
/// So a concurrent reader sees the old or the new delay. Each reader only checks
/// the sign of the delay or computes a purge time from it. Both delays are
/// positive, so a purge only becomes due earlier or later. mimalloc v3.7.0 makes
/// the option state atomic (upstream issue #1494).
pub(super) struct MimallocPurgeDelay;

impl PurgeDelay for MimallocPurgeDelay {
    fn return_freed_memory_sooner(&self) {
        static SET_DEFAULT: Once = Once::new();
        SET_DEFAULT.call_once(|| {
            // SAFETY: The option index is valid and mimalloc reads its options at startup.
            // Once limits the update to one write. The doc comment of `MimallocPurgeDelay`
            // explains why readers on other threads still get a valid delay.
            unsafe { mi_option_set_default(PURGE_DELAY_OPTION, PURGE_DELAY_MS) };
        });
    }
}
