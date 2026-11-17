//! Real catalogue process tests for exact origin and framing headers.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;
use std::path::Path;
use std::process::Command;

use diesel::{Connection, PgConnection};

#[test]
fn catalogue_headers_and_grant_check_follow_the_desktop_flag() {
    let database = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".to_owned());
    if let Err(error) = PgConnection::establish(&database) {
        assert!(
            env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
            "Required catalogue database is unreachable: {error}"
        );
        eprintln!("SKIP catalogue origins: unconfigured Postgres is unreachable: {error}");
        return;
    }
    let script =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_catalogue_origins.py");
    let output = Command::new("python3")
        .arg(script)
        .arg(env!("CARGO_BIN_EXE_mkc-catalogue-server"))
        .env("MKC_TEST_DATABASE_URL", database)
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
