//! The operator command produces a verifier the API can use.

#![allow(clippy::unwrap_used)]

use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::str;

use mkc_auth::preview_verifier::PreviewVerifier;

#[test]
fn python_command_produces_a_verifier_for_the_trimmed_password() {
    let command =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../infra/scripts/preview-lifecycle.py");
    let password = include_str!("../../../infra/tests/fixtures/preview-verifier.txt")
        .lines()
        .next()
        .unwrap();
    let mut child = Command::new("python3")
        .arg(command)
        .arg("preview-verifier")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    {
        let mut input = child.stdin.take().unwrap();
        writeln!(input, "\n\t{password}  ").unwrap();
    }
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let verifier = PreviewVerifier::parse(str::from_utf8(&output.stdout).unwrap());
    assert!(verifier.is_some(), "Python must write a valid verifier");
    assert!(verifier.unwrap().matches(password));
}
