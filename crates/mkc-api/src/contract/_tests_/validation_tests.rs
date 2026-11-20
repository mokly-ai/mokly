//! The shared validator rejects drift and resolves component references locally.

#![allow(clippy::unwrap_used)]

use std::panic::catch_unwind;

use super::response_validation::validate;

#[test]
fn response_validation_rejects_a_missing_required_field() {
    let invalid = br#"{"status":"ok","version":"0.1.0","revision":"test"}"#;
    assert!(catch_unwind(|| validate("GET", "/v1/health", 200, invalid)).is_err());
    let valid = br#"{"status":"ok","version":"0.1.0","revision":"test","migrations":"current"}"#;
    validate("GET", "/v1/health", 200, valid);
}

#[test]
fn response_validation_rejects_an_unknown_reason_through_a_range_response() {
    let invalid = br#"{"error":{"code":"internal","reason":"unknown","message":"Failure","request_id":"test"}}"#;
    assert!(catch_unwind(|| validate("GET", "/v1/session", 500, invalid)).is_err());
}

#[test]
fn a_literal_path_segment_wins_before_a_parameter_segment() {
    let workspace = br#"{"id":"00000000-0000-0000-0000-000000000000","name":"Members","slug":"members","role":"owner","plan":"free","githubInstallationState":"absent","version":1,"canonicalSlug":"members"}"#;
    validate("GET", "/v1/workspaces/by-slug/members", 200, workspace);
}
