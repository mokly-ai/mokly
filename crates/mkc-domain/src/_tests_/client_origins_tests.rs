//! Shared literal and exact origin-set contract.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde::Deserialize;

use crate::client_origins::{AdmittedOrigins, ClientOrigin, DESKTOP_ORIGIN};

#[derive(Deserialize)]
struct Fixture {
    origin: String,
}

#[test]
fn desktop_origin_matches_the_shared_fixture() {
    let fixture: Fixture =
        serde_json::from_str(include_str!("../../../../fixtures/desktop-origin.json")).unwrap();
    assert_eq!(DESKTOP_ORIGIN, fixture.origin);
}

#[test]
fn admission_and_enumeration_use_the_same_exact_set() {
    let app = "https://app.example.com";
    for desktop in [false, true] {
        let origins = AdmittedOrigins::new(app.to_owned(), desktop);
        assert_eq!(origins.app_origin(), app);
        assert_eq!(origins.classify(Some(app)), Some(ClientOrigin::App));
        assert_eq!(
            origins.classify(Some(DESKTOP_ORIGIN)),
            desktop.then_some(ClientOrigin::Desktop)
        );
        let expected = if desktop {
            vec![app, DESKTOP_ORIGIN]
        } else {
            vec![app]
        };
        assert_eq!(origins.iter().collect::<Vec<_>>(), expected);
        for origin in [
            None,
            Some("null"),
            Some(""),
            Some("https://third.example.com"),
            Some("https://app.example.com/"),
            Some("https://app.example.com:443"),
            Some("mokly-app://desktop/"),
            Some("mokly-app://desktop:80"),
            Some("mokly-app://other"),
            Some("MOKLY-APP://desktop"),
        ] {
            assert_eq!(origins.classify(origin), None, "{origin:?}");
        }
    }
}
