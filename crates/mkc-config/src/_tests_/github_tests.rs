//! Optional GitHub settings fail closed for incomplete or invalid deployments.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::github::{GitHubConfigProvider, GitHubEnvironmentConfig};
use crate::settings::{EnvironmentMock, Error};

fn configured(values: BTreeMap<&'static str, String>) -> GitHubEnvironmentConfig {
    GitHubEnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
        )),
    }
}

fn values() -> BTreeMap<&'static str, String> {
    BTreeMap::from([
        ("MKC_GITHUB_APP_ID", "123".into()),
        ("MKC_GITHUB_CLIENT_ID", "Iv1.fixture".into()),
        ("MKC_GITHUB_CLIENT_SECRET", "secret".into()),
        ("MKC_GITHUB_APP_SLUG", "mokly-test".into()),
        (
            "MKC_GITHUB_PRIVATE_KEY",
            "PEM validated by the signer".into(),
        ),
        ("MKC_GITHUB_WEBHOOK_SECRET", "a".repeat(32)),
    ])
}

#[test]
fn absence_disables_github_and_complete_configuration_enables_it() {
    assert!(configured(BTreeMap::new()).load(false).unwrap().is_none());
    assert_eq!(
        configured(values()).load(false).unwrap().unwrap().app_id,
        123
    );
}

#[test]
fn every_missing_or_empty_setting_rejects_partial_configuration() {
    for key in values().keys() {
        let mut missing = values();
        missing.remove(key);
        assert!(
            matches!(configured(missing).load(false), Err(Error::Invalid(found)) if found == *key)
        );
        let mut empty = values();
        empty.insert(key, String::new());
        assert!(
            matches!(configured(empty).load(false), Err(Error::Invalid(found)) if found == *key)
        );
    }
}

#[test]
fn unset_transport_origins_default_to_github_itself() {
    let settings = configured(values()).load(true).unwrap().unwrap();
    assert_eq!(settings.api_origin, "https://api.github.com");
    assert_eq!(settings.web_origin, "https://github.com");
}

#[test]
fn a_development_deployment_keeps_both_recorded_origins() {
    let mut recorded = values();
    recorded.insert("MKC_GITHUB_API_ORIGIN", "http://127.0.0.1:8090".into());
    recorded.insert("MKC_GITHUB_WEB_ORIGIN", "http://127.0.0.1:8090".into());
    let settings = configured(recorded).load(true).unwrap().unwrap();
    assert_eq!(settings.api_origin, "http://127.0.0.1:8090");
    assert_eq!(settings.web_origin, "http://127.0.0.1:8090");
}

#[test]
fn one_origin_alone_names_the_missing_key() {
    for (present, missing) in [
        ("MKC_GITHUB_API_ORIGIN", "MKC_GITHUB_WEB_ORIGIN"),
        ("MKC_GITHUB_WEB_ORIGIN", "MKC_GITHUB_API_ORIGIN"),
    ] {
        let mut partial = values();
        partial.insert(present, "http://127.0.0.1:8090".into());
        assert!(
            matches!(configured(partial).load(true), Err(Error::Invalid(found)) if found == missing)
        );
    }
}

#[test]
fn recorded_origins_are_refused_outside_a_development_deployment() {
    for key in ["MKC_GITHUB_API_ORIGIN", "MKC_GITHUB_WEB_ORIGIN"] {
        let mut deployed = values();
        deployed.insert(key, "http://127.0.0.1:8090".into());
        assert!(
            matches!(configured(deployed).load(false), Err(Error::Invalid(found)) if found == key)
        );
    }
    let mut both = values();
    both.insert("MKC_GITHUB_API_ORIGIN", "https://api.example.com".into());
    both.insert("MKC_GITHUB_WEB_ORIGIN", "https://example.com".into());
    assert!(matches!(
        configured(both).load(false),
        Err(Error::Invalid("MKC_GITHUB_API_ORIGIN"))
    ));
}

#[test]
fn a_recorded_origin_must_still_be_an_exact_origin() {
    for value in ["http://example.com", "not a url", "http://127.0.0.1:8090/x"] {
        let mut malformed = values();
        malformed.insert("MKC_GITHUB_API_ORIGIN", value.into());
        malformed.insert("MKC_GITHUB_WEB_ORIGIN", "http://127.0.0.1:8090".into());
        assert!(matches!(
            configured(malformed).load(true),
            Err(Error::Invalid("MKC_GITHUB_API_ORIGIN"))
        ));
    }
}

#[test]
fn invalid_identifiers_and_weak_webhook_secrets_are_rejected() {
    for (key, value) in [
        ("MKC_GITHUB_APP_ID", "-1"),
        ("MKC_GITHUB_APP_ID", "0"),
        ("MKC_GITHUB_APP_ID", "abc"),
        ("MKC_GITHUB_APP_SLUG", "../other"),
        ("MKC_GITHUB_WEBHOOK_SECRET", "short"),
    ] {
        let mut settings = values();
        settings.insert(key, value.into());
        assert!(
            matches!(configured(settings).load(false), Err(Error::Invalid(found)) if found == key)
        );
    }
}
