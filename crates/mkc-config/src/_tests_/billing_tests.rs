//! Optional billing settings fail closed without exposing credential values.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::billing::{BillingConfigProvider, BillingEnvironmentConfig};
use crate::settings::{ConfigProvider, EnvironmentConfig, EnvironmentMock, Error};

fn configured(values: BTreeMap<&'static str, String>) -> BillingEnvironmentConfig {
    BillingEnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
        )),
    }
}

fn values() -> BTreeMap<&'static str, String> {
    BTreeMap::from([
        ("MKC_BILLING", "stripe".to_owned()),
        ("MKC_STRIPE_SECRET_KEY", "rk_test_fixture".to_owned()),
        (
            "MKC_STRIPE_WEBHOOK_SECRET",
            "whsec_fixture_signing_secret".to_owned(),
        ),
    ])
}

#[test]
fn absent_or_empty_mode_disables_billing_and_complete_settings_enable_it() {
    assert!(configured(BTreeMap::new()).load(false).unwrap().is_none());
    assert!(
        configured(BTreeMap::from([("MKC_BILLING", String::new())]))
            .load(false)
            .unwrap()
            .is_none()
    );
    let settings = configured(values()).load(false).unwrap().unwrap();
    assert_eq!(settings.api_origin, "https://api.stripe.com");
    let mut secret_key = values();
    secret_key.insert("MKC_STRIPE_SECRET_KEY", "sk_test_fixture".to_owned());
    assert_eq!(
        configured(secret_key)
            .load(false)
            .unwrap()
            .unwrap()
            .secret_key,
        "sk_test_fixture"
    );
}

#[test]
fn every_missing_or_empty_required_setting_rejects_stripe_mode() {
    for key in ["MKC_STRIPE_SECRET_KEY", "MKC_STRIPE_WEBHOOK_SECRET"] {
        let mut missing = values();
        missing.remove(key);
        assert!(
            matches!(configured(missing).load(false), Err(Error::Invalid(found)) if found == key)
        );
        let mut empty = values();
        empty.insert(key, String::new());
        assert!(
            matches!(configured(empty).load(false), Err(Error::Invalid(found)) if found == key)
        );
    }
}

#[test]
fn secret_shapes_fail_with_only_the_setting_name() {
    for (key, value) in [
        ("MKC_STRIPE_SECRET_KEY", "pk_live_do_not_echo"),
        ("MKC_STRIPE_WEBHOOK_SECRET", "bad_webhook_secret"),
    ] {
        let mut settings = values();
        settings.insert(key, value.to_owned());
        let error = configured(settings).load(false).err().unwrap();
        assert!(matches!(error, Error::Invalid(found) if found == key));
        assert!(!error.to_string().contains(value));
    }
}

#[test]
fn http_loopback_with_an_explicit_port_requires_development() {
    for origin in ["http://localhost:12111", "http://127.0.0.1:12111"] {
        let mut settings = values();
        settings.insert("MKC_STRIPE_API_ORIGIN", origin.to_owned());
        assert!(matches!(
            configured(settings.clone()).load(false),
            Err(Error::Invalid("MKC_STRIPE_API_ORIGIN"))
        ));
        assert_eq!(
            configured(settings).load(true).unwrap().unwrap().api_origin,
            origin
        );
    }
    for origin in [
        "http://localhost",
        "http://stripe.example.com:12111",
        "https://user:secret@api.stripe.com",
        "https://api.stripe.com/v1",
        "https://api.stripe.com?fixture=true",
    ] {
        let mut settings = values();
        settings.insert("MKC_STRIPE_API_ORIGIN", origin.to_owned());
        assert!(matches!(
            configured(settings).load(true),
            Err(Error::Invalid("MKC_STRIPE_API_ORIGIN"))
        ));
    }
}

#[test]
fn unknown_billing_mode_fails_closed() {
    assert!(matches!(
        configured(BTreeMap::from([(
            "MKC_BILLING",
            "other-provider".to_owned()
        )]))
        .load(false),
        Err(Error::Invalid("MKC_BILLING"))
    ));
}

#[test]
fn top_level_settings_pass_only_the_development_loopback_capability() {
    let mut settings = values();
    settings.extend([
        ("MKC_ENV", "development".to_owned()),
        ("MKC_STRIPE_API_ORIGIN", "http://127.0.0.1:12111".to_owned()),
        (
            "MKC_DATABASE_URL",
            "postgres://localhost/mokly_test".to_owned(),
        ),
        ("MKC_APP_ORIGIN", "https://app.example.com".to_owned()),
        ("MKC_SITE_ORIGIN", "https://site.example.com".to_owned()),
        ("MKC_API_ORIGIN", "https://api.example.com".to_owned()),
        ("MKC_MAILER", "postmark".to_owned()),
        ("POSTMARK_FROM", "Mokly <test@example.com>".to_owned()),
        ("POSTMARK_SERVER_TOKEN", "fixture-token".to_owned()),
        (
            "MKC_CATALOGUE_ORIGIN",
            "https://catalogues.example.net".to_owned(),
        ),
        ("MKC_CATALOGUE_SIGNING_KEY", "a".repeat(64)),
        ("MKC_FILE_STORE", "gcs".to_owned()),
        ("MKC_GCS_BUCKET", "fixture-bucket".to_owned()),
    ]);
    let environment = configured(settings).environment;
    let loaded = EnvironmentConfig { environment }.load().unwrap();
    assert_eq!(loaded.billing.unwrap().api_origin, "http://127.0.0.1:12111");

    let mut production = values();
    production.extend([
        ("MKC_ENV", "production".to_owned()),
        ("MKC_STRIPE_API_ORIGIN", "http://127.0.0.1:12111".to_owned()),
        (
            "MKC_DATABASE_URL",
            "postgres://localhost/mokly_test".to_owned(),
        ),
        ("MKC_APP_ORIGIN", "https://app.example.com".to_owned()),
        ("MKC_SITE_ORIGIN", "https://site.example.com".to_owned()),
        ("MKC_API_ORIGIN", "https://api.example.com".to_owned()),
        ("MKC_MAILER", "postmark".to_owned()),
        ("POSTMARK_FROM", "Mokly <test@example.com>".to_owned()),
        ("POSTMARK_SERVER_TOKEN", "fixture-token".to_owned()),
        (
            "MKC_CATALOGUE_ORIGIN",
            "https://catalogues.example.net".to_owned(),
        ),
        ("MKC_CATALOGUE_SIGNING_KEY", "a".repeat(64)),
        ("MKC_FILE_STORE", "gcs".to_owned()),
        ("MKC_GCS_BUCKET", "fixture-bucket".to_owned()),
    ]);
    assert!(matches!(
        EnvironmentConfig {
            environment: configured(production).environment
        }
        .load(),
        Err(Error::Invalid("MKC_STRIPE_API_ORIGIN"))
    ));
}
