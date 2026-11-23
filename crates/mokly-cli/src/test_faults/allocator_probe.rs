//! Debug probe for the effective mimalloc purge delay.

use std::process::ExitCode;

use libmimalloc_sys::mi_option_get;

use crate::allocator::{MimallocPurgeDelay, PURGE_DELAY_OPTION, PurgeDelay};

use super::Faults;

/// Print the purge delay before and after the Changes policy when requested.
pub(crate) fn purge_delay() -> Option<ExitCode> {
    if !Faults::environment().has("allocator") {
        return None;
    }

    print_purge_delay("allocator-purge-delay");
    MimallocPurgeDelay.return_freed_memory_sooner();
    print_purge_delay("allocator-purge-delay-after-changes");
    Some(ExitCode::SUCCESS)
}

fn print_purge_delay(label: &str) {
    // SAFETY: The option index is valid and the probe runs before starting threads.
    let delay = unsafe { mi_option_get(PURGE_DELAY_OPTION) };
    println!("{label} {delay}");
}
