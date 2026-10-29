//! Build the environment inherited by one Node sidecar process.

use std::ffi::OsString;
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
        let name_bytes = name.as_encoded_bytes();
        if starts_with_mokly(name_bytes, windows)
            || matches!(
                name_bytes,
                b"INIT_CWD" | b"npm_package_json" | b"npm_config_local_prefix"
            )
        {
            command.env_remove(name);
        }
    }
    command
        .env("PWD", repository)
        .env("MOKLY_POSTCSS_PHASES", "1");
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

#[cfg(test)]
#[path = "_tests_/process_environment_tests.rs"]
mod process_environment_tests;
