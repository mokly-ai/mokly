//! Desktop origin and cookie policy through the actual API binary and Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::path::Path;
use std::process::Command;

use mkc_test_pg::scratch_schema::ScratchSchema;

#[test]
fn api_admits_only_configured_origins_and_selects_each_request_cookie() {
    let Some(schema) = ScratchSchema::create("desktop_origins") else {
        return;
    };
    let script =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_desktop_origins.py");
    let output = Command::new("python3")
        .arg(script)
        .arg(env!("CARGO_BIN_EXE_mkc-api"))
        .env("MKC_TEST_DATABASE_URL", schema.scoped_url())
        .output()
        .unwrap();
    let report = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{report}");
    assert!(output.status.success(), "{report}");
}
