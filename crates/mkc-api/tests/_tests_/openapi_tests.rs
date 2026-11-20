//! The CLI emits only pretty JSON and is stable across separate processes.

#![allow(clippy::unwrap_used)]

use std::process::Command;

use mkc_api::contract::document::ApiDoc;
use serde_json::Value;
use utoipa::OpenApi;

#[test]
fn openapi_prints_a_stable_document_without_configuration_or_logs() {
    let run = || {
        let output = Command::new(env!("CARGO_BIN_EXE_mkc-api"))
            .arg("openapi")
            .env_clear()
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
        output.stdout
    };
    let first = run();
    assert_eq!(first, run());
    assert_eq!(
        first,
        format!("{}\n", ApiDoc::openapi().to_pretty_json().unwrap()).as_bytes()
    );
    let parsed: Value = serde_json::from_slice(&first).unwrap();
    assert_eq!(parsed["openapi"], "3.1.0");
}
