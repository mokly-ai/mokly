//! Warning text retains module ownership without repeated prefixes.

use std::io;

use crate::remote::contracts::RequiredProgram;
use crate::remote::error::{Error, Operation};
use crate::remote::reporting::warning;

#[test]
fn warning_keeps_the_error_module_and_reserves_the_reporter_prefix() {
    let error = Error::MissingPrograms {
        programs: vec![RequiredProgram::Ssh],
    };
    assert_eq!(
        warning("availability failed", &error),
        "warning: availability failed: [xtask/remote] missing executables: `ssh`; install ssh with the operating system package manager"
    );
    assert_eq!(
        warning("", &error),
        "warning: [xtask/remote] missing executables: `ssh`; install ssh with the operating system package manager"
    );
}

#[test]
fn warning_deduplicates_embedded_prefixes_and_stays_on_one_line() {
    let error = Error::Io {
        operation: Operation::Github,
        source: io::Error::other(
            "[xtask/executor] [xtask/remote] provider failed\n[xtask/provider] [xtask/provider] detail",
        ),
    };
    let line = format!("[xtask/executor] {}", warning("cleanup failed", &error));
    assert_eq!(
        line,
        "[xtask/executor] warning: cleanup failed: [xtask/remote] Github operation failed: provider failed [xtask/provider] detail"
    );
}
