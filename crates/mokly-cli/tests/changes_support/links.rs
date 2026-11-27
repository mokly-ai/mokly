//! Directory links for package resolution in Changes fixtures.

use std::path::Path;

/// Link a dependency directory into an isolated fixture.
pub(super) fn link_directory(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(target, link).unwrap();
}
