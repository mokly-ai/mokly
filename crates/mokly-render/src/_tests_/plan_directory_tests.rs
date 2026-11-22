//! Invalid native names fail before a candidate directory can be narrowed.

#[cfg(unix)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::ffi::OsString;
use std::io::ErrorKind;
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;
#[cfg(windows)]
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;

use mokly_source_interface::error::SourceError;

use crate::physical_inputs::checked_result;

use super::utf8_name;

#[test]
fn invalid_unicode_names_preserve_the_physical_input_error() {
    let root = PathBuf::from("fixture");
    #[cfg(unix)]
    let name = OsStr::from_bytes(b"bad-\xff");
    #[cfg(windows)]
    let native_name = OsString::from_wide(&[0x0062, 0x0061, 0x0064, 0x002d, 0xd800]);
    #[cfg(windows)]
    let name = native_name.as_os_str();
    assert!(matches!(checked_result(&root, utf8_name(name)),
        Err(SourceError::Io { operation: "check physical compilation input", path, source })
            if path == root && source.kind() == ErrorKind::InvalidData));
}
