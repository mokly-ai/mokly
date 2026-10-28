//! Windows' standard cache variable can isolate a child without relative-path writes.

use std::path::Path;

#[cfg(windows)]
use crate::locations::plain;
use crate::locations::{cache_directory, inside_repository};

#[test]
fn only_an_absolute_local_app_data_value_selects_an_alternate_os_cache_root() {
    let default = if cfg!(windows) {
        Path::new("C:/profile/cache")
    } else {
        Path::new("/profile/cache")
    };
    let isolated = if cfg!(windows) {
        Path::new("C:/test/cache")
    } else {
        Path::new("/test/cache")
    };
    assert_eq!(cache_directory(default, Some(isolated)), isolated);
    assert_eq!(
        cache_directory(default, Some(Path::new("relative"))),
        default
    );
    assert_eq!(cache_directory(default, Some(Path::new(""))), default);
    assert_eq!(cache_directory(default, None), default);
}

#[test]
fn repository_containment_uses_path_components() {
    let repository = Path::new(if cfg!(windows) {
        r"C:\work\repo"
    } else {
        "/work/repo"
    });
    let child = Path::new(if cfg!(windows) {
        r"C:\work\repo\cache"
    } else {
        "/work/repo/cache"
    });
    let sibling = Path::new(if cfg!(windows) {
        r"C:\work\repo-cache"
    } else {
        "/work/repo-cache"
    });
    let parent = Path::new(if cfg!(windows) { r"C:\work" } else { "/work" });
    assert!(inside_repository(child, repository));
    assert!(inside_repository(repository, repository));
    assert!(!inside_repository(sibling, repository));
    assert!(!inside_repository(parent, repository));
}

#[cfg(windows)]
#[test]
fn verbatim_windows_paths_share_the_plain_repository_form() {
    assert!(inside_repository(
        Path::new(r"\\?\C:\repo\cache\mokly\key"),
        Path::new(r"C:\repo"),
    ));
    assert!(inside_repository(
        Path::new(r"C:\repo\cache"),
        Path::new(r"\\?\C:\repo"),
    ));
    assert!(inside_repository(
        Path::new(r"\\?\UNC\server\share\repo\cache"),
        Path::new(r"\\server\share\repo"),
    ));
    assert!(!inside_repository(
        Path::new(r"\\?\C:\other\cache"),
        Path::new(r"C:\repo"),
    ));
    assert!(!inside_repository(
        Path::new(r"\\?\D:\repo\cache"),
        Path::new(r"C:\repo"),
    ));
    let volume = Path::new(r"\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\repo");
    assert_eq!(plain(volume), volume);
}
