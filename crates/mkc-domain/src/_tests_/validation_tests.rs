//! Input and redirect regression cases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde::Deserialize;

use crate::validation::{config_path, email, name, repository, return_to};

#[derive(Deserialize)]
struct ReturnToFixture {
    accepted: Vec<AcceptedReturnTo>,
    rejected: Vec<Option<String>>,
}

#[derive(Deserialize)]
struct AcceptedReturnTo {
    input: String,
    output: String,
}

#[test]
fn normalizes_product_inputs() {
    assert_eq!(
        email(" Person@Example.com ").as_deref(),
        Some("person@example.com")
    );
    assert_eq!(name(" Work ").as_deref(), Some("Work"));
    assert!(repository("mokly-ai/mokly"));
    assert!(config_path("docs/mokly.config.json"));
    for value in [
        "a,b@example.com",
        "a\nb@example.com",
        "a@@example.com",
        "a@localhost",
    ] {
        assert!(email(value).is_none(), "{value}");
    }
    for value in [
        "/mokly.json",
        "../mokly.json",
        "a/../b.json",
        "C:\\mokly.json",
        "a//b.json",
        "a.js",
        "mokly.config.ts",
    ] {
        assert!(!config_path(value), "{value}");
    }
    assert!(name(&"x".repeat(81)).is_none());
    assert!(!repository("../repo"));
}

#[test]
fn return_destination_rejects_redirect_and_credential_tricks() {
    let fixture: ReturnToFixture =
        serde_json::from_str(include_str!("fixtures/return_to_cases.json")).unwrap();
    for case in fixture.accepted {
        assert_eq!(return_to(Some(&case.input)), case.output, "{}", case.input);
    }
    for value in fixture.rejected {
        assert_eq!(return_to(value.as_deref()), "/dashboard", "{value:?}");
    }
}
