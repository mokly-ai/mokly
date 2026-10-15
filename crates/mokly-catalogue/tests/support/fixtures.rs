//! Behavior fixture data and exact diagnostic assertions.

use std::fs;
use std::path::Path;

use mokly_catalogue::error::CatalogueError;
use serde_json::Value;

#[path = "memory.rs"]
mod memory;

pub fn fixture(name: &str) -> Value {
    serde_json::from_str(
        &fs::read_to_string(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("tests/fixtures/identity")
                .join(format!("{name}.json")),
        )
        .unwrap(),
    )
    .unwrap()
}

pub fn check(name: &str) {
    let fixture = fixture(name);
    let result = memory::prepare(&fixture);
    if let Some(expected) = fixture.get("errors") {
        let issues = match result.unwrap_err() {
            CatalogueError::Config(issue) => vec![issue],
            CatalogueError::Invalid { issues, .. } => issues,
            error => panic!("unexpected error: {error:?}"),
        };
        for expected in expected.as_array().unwrap() {
            let issue = issues
                .iter()
                .find(|issue| issue.code.as_str() == expected["code"].as_str().unwrap())
                .unwrap_or_else(|| panic!("{name}: expected {expected}; got {issues:?}"));
            if let Some(message) = expected.get("message").and_then(Value::as_str) {
                assert_eq!(issue.message, message, "{name}");
            }
            if let Some(line) = expected.get("line").and_then(Value::as_u64) {
                assert_eq!(
                    issue.location.as_ref().unwrap().line,
                    line as usize,
                    "{name}: {issue:?}"
                );
            }
            if let Some(column) = expected.get("column").and_then(Value::as_u64) {
                assert_eq!(
                    issue.location.as_ref().unwrap().column,
                    column as usize,
                    "{name}: {issue:?}"
                );
            }
        }
    } else {
        let prepared = result.unwrap_or_else(|error| panic!("{name}: {error:?}"));
        let paths: Vec<_> = prepared
            .model
            .entries
            .iter()
            .map(|entry| entry.metadata.path.as_str())
            .collect();
        assert_eq!(
            serde_json::to_value(paths).unwrap(),
            fixture["paths"],
            "{name}"
        );
        if let Some(warnings) = fixture.get("warnings") {
            assert_eq!(
                prepared
                    .warnings
                    .iter()
                    .map(|warning| warning.code)
                    .collect::<Vec<_>>(),
                warnings
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_str().unwrap())
                    .collect::<Vec<_>>()
            );
        }
        for source in fixture
            .get("protected")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            assert!(
                prepared
                    .model
                    .sources
                    .contains(&source.as_str().unwrap().into()),
                "{name}: missing source {source}"
            );
        }
    }
}
