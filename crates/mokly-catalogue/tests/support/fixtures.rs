//! Behavior fixture data and exact diagnostic assertions.

use std::fs;
use std::path::Path;

use mokly_catalogue::diagnostic::{Issue, Warning};
use mokly_catalogue::error::CatalogueError;
use serde_json::{Value, json};

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
        let (issues, warnings) = match result.unwrap_err() {
            CatalogueError::Config(issue) => (vec![issue], Vec::new()),
            CatalogueError::Invalid { issues, warnings } => (issues, warnings),
            error => panic!("unexpected error: {error:?}"),
        };
        assert_eq!(
            json!(issues.iter().map(issue_json).collect::<Vec<_>>()),
            *expected,
            "{name}: complete issue list"
        );
        check_warnings(name, &fixture, &warnings);
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
        check_warnings(name, &fixture, &prepared.warnings);
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

fn issue_json(issue: &Issue) -> Value {
    json!({"code":issue.code.as_str(),"message":issue.message,
        "path":issue.location.as_ref().map(|location| &location.path),
        "line":issue.location.as_ref().map(|location| location.line),
        "column":issue.location.as_ref().map(|location| location.column)})
}

fn check_warnings(name: &str, fixture: &Value, warnings: &[Warning]) {
    let actual = json!(
        warnings
            .iter()
            .map(|warning| json!({"code":warning.code,
        "subject":warning.printed_subject(),"message":warning.message}))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        actual,
        fixture.get("warnings").unwrap_or(&json!([])).clone(),
        "{name}: complete warning list"
    );
}
