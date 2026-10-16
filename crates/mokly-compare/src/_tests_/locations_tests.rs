//! Windows' standard cache variable can isolate a child without relative-path writes.

use std::path::Path;

use crate::locations::cache_directory;

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
