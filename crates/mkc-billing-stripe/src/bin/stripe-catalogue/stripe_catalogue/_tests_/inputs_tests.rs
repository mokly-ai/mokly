//! Credential-mode and exact-origin input validation.

use unimock::{MockFn, Unimock, matching};

use crate::stripe_catalogue::args::CatalogueEnvironment;
use crate::stripe_catalogue::inputs::{
    ApiOriginMock, CatalogueKeyMock, SyncInputs, read_sync_inputs,
};
use crate::stripe_catalogue::report::ErrorLine;

#[test]
fn matching_restricted_key_modes_are_accepted() {
    assert_key_accepted("rk_test_fixture", CatalogueEnvironment::MainPreview);
    assert_key_accepted("rk_live_fixture", CatalogueEnvironment::Production);
}

#[test]
fn every_non_restricted_key_kind_has_the_exact_failure() {
    for key in [
        "sk_test_fixture",
        "sk_live_fixture",
        "pk_test_fixture",
        "garbage",
    ] {
        for environment in [
            CatalogueEnvironment::MainPreview,
            CatalogueEnvironment::Production,
        ] {
            assert_eq!(
                input_error(inputs_with_key(key, environment)).to_string(),
                "error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted",
                "key should be rejected as the wrong kind: {key}",
            );
        }
    }
}

#[test]
fn restricted_key_for_the_other_mode_keeps_the_exact_mode_failure() {
    for (key, environment) in [
        ("rk_live_fixture", CatalogueEnvironment::MainPreview),
        ("rk_test_fixture", CatalogueEnvironment::Production),
    ] {
        assert_eq!(
            input_error(inputs_with_key(key, environment)),
            ErrorLine::WrongKeyMode { environment }
        );
    }
}

#[test]
fn missing_and_empty_keys_use_the_exact_missing_key_failure() {
    for key in [None, Some("")] {
        let variables = Unimock::new(
            CatalogueKeyMock
                .next_call(matching!())
                .returns(key.map(str::to_owned)),
        );
        assert_eq!(
            input_error(read_sync_inputs(
                &variables,
                CatalogueEnvironment::MainPreview,
            )),
            ErrorLine::MissingKey
        );
    }
}

#[test]
fn default_and_allowed_exact_origins_are_accepted() {
    for origin in [
        None,
        Some("https://api.stripe.com"),
        Some("https://stripe.example.test/"),
        Some("https://stripe.example.test:8443"),
        Some("http://127.0.0.1:3210"),
        Some("http://127.0.0.1:80/"),
        Some("http://localhost:3210/"),
    ] {
        let result = inputs_with_origin(origin);
        assert!(result.is_ok(), "origin should be accepted: {origin:?}");
    }
}

#[test]
fn every_disallowed_origin_shape_has_the_exact_failure() {
    for origin in [
        "http://api.stripe.com",
        "http://127.0.0.1",
        "http://localhost",
        "http://0.0.0.0:3210",
        "http://[::1]:3210",
        "https://user@stripe.example.test",
        "https://stripe.example.test/path",
        "https://stripe.example.test?query=yes",
        "https://stripe.example.test#fragment",
        "https://stripe.example.test:",
        "ftp://stripe.example.test",
        "stripe.example.test",
        "https:///missing-host",
    ] {
        assert_eq!(
            input_error(inputs_with_origin(Some(origin))),
            ErrorLine::InvalidOrigin,
            "origin should be rejected: {origin}"
        );
    }
}

fn assert_key_accepted(key: &str, environment: CatalogueEnvironment) {
    let key_call = CatalogueKeyMock
        .next_call(matching!())
        .returns(Some(key.to_owned()));
    let variables = Unimock::new((key_call, ApiOriginMock.next_call(matching!()).returns(None)));
    assert!(read_sync_inputs(&variables, environment).is_ok());
}

fn inputs_with_key(key: &str, environment: CatalogueEnvironment) -> Result<SyncInputs, ErrorLine> {
    let variables = Unimock::new(
        CatalogueKeyMock
            .next_call(matching!())
            .returns(Some(key.to_owned())),
    );
    read_sync_inputs(&variables, environment)
}

fn inputs_with_origin(origin: Option<&str>) -> Result<SyncInputs, ErrorLine> {
    let variables = Unimock::new((
        CatalogueKeyMock
            .next_call(matching!())
            .returns(Some("rk_test_fixture".to_owned())),
        ApiOriginMock
            .next_call(matching!())
            .returns(origin.map(str::to_owned)),
    ));
    read_sync_inputs(&variables, CatalogueEnvironment::MainPreview)
}

fn input_error(result: Result<SyncInputs, ErrorLine>) -> ErrorLine {
    match result {
        Ok(_) => panic!("expected input validation failure"),
        Err(error) => error,
    }
}
