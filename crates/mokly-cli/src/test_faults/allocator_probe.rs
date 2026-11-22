//! Debug probe for the effective mimalloc purge delay.

use std::process::ExitCode;

use libmimalloc_sys::mi_option_get;

use crate::allocator::PURGE_DELAY_OPTION;

use super::Faults;

/// Print the purge delay when the allocator probe is requested.
pub(crate) fn purge_delay() -> Option<ExitCode> {
    if !Faults::environment().has("allocator") {
        return None;
    }

    // SAFETY: The option index is valid and main calls this before starting threads.
    let delay = unsafe { mi_option_get(PURGE_DELAY_OPTION) };
    println!("allocator-purge-delay {delay}");
    Some(ExitCode::SUCCESS)
}
