//! Adapter errors keep their source type and IO errors keep portable codes.

use std::error::Error;
#[cfg(unix)]
use std::io;
use std::num::ParseIntError;

#[cfg(windows)]
use windows_sys::Win32::Foundation::{ERROR_CANT_RESOLVE_FILENAME, ERROR_STOPPED_ON_SYMLINK};

use crate::error::{InternalError, SourceError};

#[test]
fn backend_failures_preserve_the_original_error() {
    let source = "bad".parse::<u64>().unwrap_err();
    let error = SourceError::from(InternalError::Adapter {
        operation: "read blob",
        path: "specs/home.md".into(),
        source: Box::new(source),
    });
    let backend = error.source().unwrap().source().unwrap();
    assert!(backend.downcast_ref::<ParseIntError>().is_some());
    assert!(!error.is_vanished());
    assert_eq!(error.code(), "unknown");
}

#[cfg(unix)]
#[test]
fn filesystem_loop_and_overlong_name_codes_remain_visible() {
    for (raw, expected) in [(libc::ELOOP, "ELOOP"), (libc::ENAMETOOLONG, "ENAMETOOLONG")] {
        let error = SourceError::Io {
            operation: "read",
            path: "specs/home.md".into(),
            source: io::Error::from_raw_os_error(raw),
        };
        assert_eq!(error.code(), expected);
        assert!(!error.is_vanished());
        assert_eq!(error.is_symlink_error(), raw == libc::ELOOP);
    }
}

#[cfg(unix)]
#[test]
fn permission_descriptor_and_device_errors_do_not_indicate_replacement() {
    for raw in [
        libc::EACCES,
        libc::EMFILE,
        libc::EIO,
        libc::EINVAL,
        libc::EINTR,
    ] {
        let error = SourceError::Io {
            operation: "open resource stream",
            path: "image.svg".into(),
            source: io::Error::from_raw_os_error(raw),
        };
        assert!(!error.is_vanished());
        assert!(!error.is_symlink_error());
    }
}

#[cfg(windows)]
#[test]
fn windows_resolution_failures_identify_stopped_symlinks() {
    for raw in [ERROR_CANT_RESOLVE_FILENAME, ERROR_STOPPED_ON_SYMLINK] {
        let error = SourceError::Io {
            operation: "open resource stream",
            path: "image.svg".into(),
            source: std::io::Error::from_raw_os_error(raw as i32),
        };
        assert!(error.is_symlink_error());
        assert!(!error.is_vanished());
    }
}
