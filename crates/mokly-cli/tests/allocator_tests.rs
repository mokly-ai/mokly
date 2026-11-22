//! The Mokly binary's purge delay at startup and after ready Changes.

use std::env;
use std::ffi::OsStr;
use std::process::Command;

fn allocator_probe() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command
        .arg("--version")
        .env("MOKLY_TEST_STATIC_FAULTS", "allocator");
    for (name, _) in env::vars_os() {
        if name.eq_ignore_ascii_case(OsStr::new("MIMALLOC_PURGE_DELAY"))
            || name.eq_ignore_ascii_case(OsStr::new("MIMALLOC_RESET_DELAY"))
        {
            command.env_remove(name);
        }
    }
    command
}

#[test]
fn reduces_the_default_purge_delay_after_changes() {
    let output = allocator_probe().output().unwrap();
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "allocator-purge-delay 1000\nallocator-purge-delay-after-changes 30\n"
    );
}

#[test]
fn preserves_the_purge_delay_from_the_environment() {
    let output = allocator_probe()
        .env("MIMALLOC_PURGE_DELAY", "250")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "allocator-purge-delay 250\nallocator-purge-delay-after-changes 250\n"
    );
}
