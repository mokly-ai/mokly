//! Initial preview plans use the real HTTP server and isolated Postgres schemas.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;
use std::path::Path;
use std::process::Command;

use mkc_api::contract;

#[path = "support/python.rs"]
mod python;
mod support;

#[test]
fn running_api_assigns_preview_workspace_plans() {
    let database = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".to_owned());
    let script =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_preview_plan.py");
    let output = Command::new("python3")
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/support/capture.py"))
        .arg(script)
        .arg(env!("CARGO_BIN_EXE_mkc-api"))
        .env("MKC_TEST_DATABASE_URL", database)
        .output()
        .expect("start preview plan integration test");
    let report = format!(
        "{}{}",
        python::validate_output(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{report}");
    assert!(output.status.success(), "{report}");
}
