//! Actual API and Postgres smoke; configured or CI databases are mandatory.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::path::Path;
use std::process::Command;

use mkc_test_pg::scratch_schema::ScratchSchema;

use mkc_api::contract;

#[path = "support/python.rs"]
mod python;
mod support;

#[test]
fn running_api_completes_the_platform_lifecycle() {
    let Some(schema) = ScratchSchema::create("api_smoke") else {
        return;
    };
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_api.py");
    let output = Command::new("python3")
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/support/capture.py"))
        .arg(script)
        .arg(env!("CARGO_BIN_EXE_mkc-api"))
        .env("MKC_TEST_DATABASE_URL", schema.scoped_url())
        .output()
        .expect("start API smoke script");
    let report = format!(
        "{}{}",
        python::validate_output(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{report}");
    assert!(output.status.success(), "{report}");
}
