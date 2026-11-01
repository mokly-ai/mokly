//! Build the environment inherited by one Node sidecar process.

use std::ffi::{OsStr, OsString};
use std::path::Path;
use std::process::Command;

/// Apply the sidecar environment policy to a command.
pub(crate) fn apply(
    command: &mut Command,
    inherited_names: impl IntoIterator<Item = OsString>,
    repository: &Path,
    windows: bool,
) {
    for name in inherited_names {
        if removed(&name, windows) {
            command.env_remove(name);
        }
    }
    command
        .env_remove("INIT_CWD")
        .env_remove("npm_package_json")
        .env_remove("npm_config_local_prefix")
        .env("PWD", repository)
        .env("MOKLY_POSTCSS_PHASES", "1");
}

fn removed(name: &OsStr, windows: bool) -> bool {
    let name_bytes = name.as_encoded_bytes();
    starts_with_mokly(name_bytes, windows)
        || name_equals(name_bytes, b"INIT_CWD", windows)
        || name_equals(name_bytes, b"npm_package_json", windows)
        || name_equals(name_bytes, b"npm_config_local_prefix", windows)
}

fn starts_with_mokly(name: &[u8], windows: bool) -> bool {
    let Some(prefix) = name.get(..6) else {
        return false;
    };
    if windows {
        prefix.eq_ignore_ascii_case(b"MOKLY_")
    } else {
        prefix == b"MOKLY_"
    }
}

fn name_equals(name: &[u8], expected: &[u8], windows: bool) -> bool {
    if windows {
        name.eq_ignore_ascii_case(expected)
    } else {
        name == expected
    }
}

#[cfg(test)]
#[path = "_tests_/process_environment_tests.rs"]
mod process_environment_tests;
