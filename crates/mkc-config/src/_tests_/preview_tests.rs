//! Preview sign-in configuration is all-or-none and capability gated.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use mkc_domain::values::Plan;

use crate::capabilities::DeploymentEnvironment;
use crate::preview::PreviewSignInConfig;
use crate::settings::{EnvironmentConfig, EnvironmentMock, Error};

const SECRET_KEY: &str = "MKC_PREVIEW_SIGN_IN_SECRET";
const EMAIL_KEY: &str = "MKC_PREVIEW_SIGN_IN_EMAIL";

fn provider(values: BTreeMap<&'static str, String>) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
        )),
    }
}

fn configured() -> BTreeMap<&'static str, String> {
    BTreeMap::from([
        (SECRET_KEY, "a".repeat(64)),
        (EMAIL_KEY, " Preview@Example.com ".to_owned()),
    ])
}

#[test]
fn every_environment_has_an_explicit_preview_sign_in_capability() {
    for (mode, allowed) in [
        (None, false),
        (Some("production"), false),
        (Some("preview"), true),
        (Some("development"), true),
    ] {
        let capabilities = DeploymentEnvironment::parse(mode).unwrap().capabilities();
        assert_eq!(capabilities.preview_sign_in, allowed);
        let environment = match mode {
            Some(mode) => BTreeMap::from([("MKC_ENV", mode.to_owned())]),
            None => BTreeMap::new(),
        };
        assert!(
            provider(environment)
                .preview_sign_in(allowed)
                .unwrap()
                .is_none()
        );
        let mut values = configured();
        if let Some(mode) = mode {
            values.insert("MKC_ENV", mode.to_owned());
        }
        let result = provider(values).preview_sign_in(capabilities.preview_sign_in);
        if allowed {
            let settings = result.unwrap().unwrap();
            assert_eq!(settings.secret, "a".repeat(64));
            assert_eq!(settings.email, "preview@example.com");
        } else {
            assert!(matches!(result, Err(Error::PreviewSignInDisallowed { .. })));
        }
    }
}

#[test]
fn either_missing_setting_reports_partial_configuration() {
    for missing in [SECRET_KEY, EMAIL_KEY] {
        let mut values = configured();
        values.remove(missing);
        assert!(matches!(
            provider(values).preview_sign_in(true),
            Err(Error::PreviewSignInPartial { missing: found }) if found == missing
        ));
    }
}

#[test]
fn malformed_secrets_and_emails_report_their_setting() {
    for (key, value) in [
        (SECRET_KEY, String::new()),
        (SECRET_KEY, "a".repeat(63)),
        (SECRET_KEY, format!("{}G", "a".repeat(63))),
        (SECRET_KEY, format!("{}A", "a".repeat(63))),
        (EMAIL_KEY, String::new()),
        (EMAIL_KEY, "preview@localhost".to_owned()),
        (EMAIL_KEY, "preview\n@example.com".to_owned()),
    ] {
        let mut values = configured();
        values.insert(key, value);
        assert!(matches!(
            provider(values).preview_sign_in(true),
            Err(Error::PreviewSignInMalformed { key: found }) if found == key
        ));
    }
}

#[test]
fn preview_initial_plan_defaults_to_free_and_accepts_only_known_values() {
    for (value, expected) in [
        (None, Plan::Free),
        (Some("free"), Plan::Free),
        (Some("team"), Plan::Team),
    ] {
        let mut values = configured();
        if let Some(value) = value {
            values.insert("MKC_PREVIEW_SIGN_IN_PLAN", value.to_owned());
        }
        let settings = provider(values).preview_sign_in(true).unwrap().unwrap();
        assert_eq!(settings.plan, expected);
    }
}

#[test]
fn unknown_preview_initial_plan_names_only_the_key() {
    for value in ["enterprise", "", "Team", " team "] {
        let mut values = configured();
        values.insert("MKC_PREVIEW_SIGN_IN_PLAN", value.to_owned());
        let error = provider(values).preview_sign_in(true).err().unwrap();
        assert!(matches!(
            error,
            Error::PreviewSignInMalformed {
                key: "MKC_PREVIEW_SIGN_IN_PLAN"
            }
        ));
        assert!(!error.to_string().contains(&"a".repeat(64)));
        assert!(!error.to_string().contains("Preview@Example.com"));
    }
}

#[test]
fn preview_initial_plan_requires_both_identity_settings() {
    for missing in [
        vec![SECRET_KEY],
        vec![EMAIL_KEY],
        vec![SECRET_KEY, EMAIL_KEY],
    ] {
        let mut values = configured();
        values.insert("MKC_PREVIEW_SIGN_IN_PLAN", "team".to_owned());
        for key in &missing {
            values.remove(key);
        }
        assert!(
            matches!(provider(values).preview_sign_in(true), Err(Error::PreviewSignInPartial { missing: key }) if missing.contains(&key))
        );
    }
}

#[test]
fn preview_initial_plan_requires_the_capability_even_without_identity_settings() {
    for mut values in [configured(), BTreeMap::new()] {
        values.insert("MKC_PREVIEW_SIGN_IN_PLAN", "team".to_owned());
        let error = provider(values).preview_sign_in(false).err().unwrap();
        assert!(matches!(
            error,
            Error::PreviewSignInDisallowed {
                key: "MKC_PREVIEW_SIGN_IN_PLAN"
            }
        ));
        assert!(error.to_string().contains("MKC_PREVIEW_SIGN_IN_PLAN"));
        assert!(!error.to_string().contains(&"a".repeat(64)));
    }
}
