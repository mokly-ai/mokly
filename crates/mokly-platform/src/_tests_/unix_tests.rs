//! Signal error classification does not depend on ambient process IDs.

use std::io;

use crate::unix_process_tree::GroupOutcome;

use super::refused;

#[test]
fn missing_groups_are_stopped_and_other_errors_remain_errors() {
    assert_eq!(
        refused(io::Error::from_raw_os_error(libc::ESRCH), 1).unwrap(),
        GroupOutcome::Gone
    );
    assert_eq!(
        refused(io::Error::from_raw_os_error(libc::EINVAL), 1)
            .unwrap_err()
            .raw_os_error(),
        Some(libc::EINVAL)
    );
    #[cfg(not(target_os = "macos"))]
    assert_eq!(
        refused(io::Error::from_raw_os_error(libc::EPERM), 1)
            .unwrap_err()
            .raw_os_error(),
        Some(libc::EPERM)
    );
}
