//! Signal error classification does not depend on ambient process IDs.

use std::io;

use super::group_is_gone;

#[test]
fn missing_groups_are_stopped_and_other_errors_remain_errors() {
    assert!(group_is_gone(&io::Error::from_raw_os_error(libc::ESRCH), 1));
    assert!(!group_is_gone(
        &io::Error::from_raw_os_error(libc::EINVAL),
        1
    ));
    #[cfg(not(target_os = "macos"))]
    assert!(!group_is_gone(
        &io::Error::from_raw_os_error(libc::EPERM),
        1
    ));
}
