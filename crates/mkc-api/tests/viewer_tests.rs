//! Viewer smoke against the actual API process and required integration database.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;
use std::path::Path;
use std::process::Command;

use diesel::{Connection, PgConnection};

use mkc_api::contract;

#[path = "support/python.rs"]
mod python;
mod support;

#[test]
fn running_api_reads_the_published_contract_fixture() {
    let database = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".into());
    if let Err(error) = PgConnection::establish(&database) {
        assert!(
            env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
            "Required viewer database is unreachable: {error}"
        );
        eprintln!("SKIP viewer smoke: MKC_TEST_DATABASE_URL is unreachable: {error}");
        return;
    }
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_viewer_reads.py");
    let output = Command::new("python3")
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/support/capture.py"))
        .arg(script)
        .arg(env!("CARGO_BIN_EXE_mkc-api"))
        .env("MKC_TEST_DATABASE_URL", database)
        .output()
        .expect("start viewer smoke");
    let report = format!(
        "{}{}",
        python::validate_output(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{report}");
    assert!(output.status.success(), "{report}");
}
