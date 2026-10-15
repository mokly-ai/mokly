//! The binary reads and validates the timeout before configuration loading.

use std::process::Command;

#[test]
fn an_invalid_timeout_environment_has_its_typed_cli_diagnostic() {
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .arg("build")
        .env("MOKLY_SIDECARS", "1")
        .env("MOKLY_SIDECAR_TIMEOUT_MS", "0")
        .env("MOKLY_OUTPUT", "plain")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/cli-invalid] Set MOKLY_SIDECAR_TIMEOUT_MS to an integer from 1 to 18446744073709551615\n"
    );
}
