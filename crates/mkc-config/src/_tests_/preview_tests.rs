//! The shared preview account and its optional settings are capability gated.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use mkc_domain::values::Plan;

use crate::capabilities::DeploymentEnvironment;
use crate::preview::PreviewSignInConfig;
use crate::settings::{EnvironmentConfig, EnvironmentMock, Error};

const VERIFIER_KEY: &str = "MKC_PREVIEW_SIGN_IN_VERIFIER";
const EMAIL_KEY: &str = "MKC_PREVIEW_SIGN_IN_EMAIL";
const PLAN_KEY: &str = "MKC_PREVIEW_SIGN_IN_PLAN";

fn verifier_fixture() -> &'static str {
    include_str!("../../../../infra/tests/fixtures/preview-verifier.txt")
        .lines()
        .nth(1)
        .unwrap()
}

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
    BTreeMap::from([(EMAIL_KEY, " Preview@Example.com ".to_owned())])
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
            assert_eq!(settings.email, "preview@example.com");
        } else {
            assert!(matches!(result, Err(Error::PreviewSignInDisallowed { .. })));
        }
    }
}

#[test]
fn verifier_requires_the_email_and_capability() {
    let verifier = verifier_fixture();
    let without_email = BTreeMap::from([(VERIFIER_KEY, verifier.to_owned())]);
    let missing = provider(without_email.clone()).preview_sign_in(true);
    assert!(
        matches!(
            missing,
            Err(Error::PreviewSignInPartial { missing: EMAIL_KEY })
        ),
        "expected missing email, got {:?}",
        missing.err()
    );

    let mut with_email = configured();
    with_email.insert(VERIFIER_KEY, verifier.to_owned());
    for values in [without_email, with_email] {
        let disallowed = provider(values).preview_sign_in(false).err().unwrap();
        assert!(matches!(
            disallowed,
            Error::PreviewSignInDisallowed { key: VERIFIER_KEY }
        ));
        assert!(!disallowed.to_string().contains(verifier));
    }
}

#[test]
fn malformed_emails_report_the_email_setting() {
    for value in ["", "preview@localhost", "preview\n@example.com"] {
        let mut values = configured();
        values.insert(EMAIL_KEY, value.to_owned());
        assert!(matches!(
            provider(values).preview_sign_in(true),
            Err(Error::PreviewSignInMalformed { key: EMAIL_KEY })
        ));
    }
}

#[test]
fn malformed_and_out_of_bounds_verifiers_name_only_their_setting() {
    let verifier = verifier_fixture();
    let salt = verifier.split('$').nth(3).unwrap();
    let hash = verifier.split('$').nth(4).unwrap();
    for malformed in [
        String::new(),
        verifier.replace("$scrypt$", "$argon2id$"),
        verifier.replace("ln=14", "ln=+14"),
        verifier.replace("ln=14", "ln=0"),
        verifier.replace("ln=14", "ln=17"),
        verifier.replace("r=8", "r=9"),
        verifier.replace("p=5", "p=0"),
        verifier.replace("p=5", "p=9"),
        verifier.replace("p=5", "p=5,x=1"),
        verifier.replace(salt, &salt.replace('/', "_")),
        verifier.replace(salt, &format!("{salt}==")),
        verifier.replace(salt, "AA"),
        verifier.replace(hash, "AA"),
        format!("{verifier}$extra"),
    ] {
        let mut values = configured();
        values.insert(VERIFIER_KEY, malformed.clone());
        let result = provider(values).preview_sign_in(true);
        assert!(
            matches!(
                result,
                Err(Error::PreviewSignInMalformed { key: VERIFIER_KEY })
            ),
            "expected malformed verifier error, got {:?}",
            result.as_ref().err()
        );
        let error = result.err().unwrap().to_string();
        assert!(error.contains(VERIFIER_KEY));
        assert!(malformed.is_empty() || !error.contains(&malformed));
    }
}

#[test]
fn verifiers_accept_the_inclusive_parameter_bounds() {
    for params in ["ln=1,r=8,p=1", "ln=16,r=8,p=8"] {
        let mut values = configured();
        values.insert(
            VERIFIER_KEY,
            verifier_fixture().replace("ln=14,r=8,p=5", params),
        );
        let result = provider(values).preview_sign_in(true);
        assert!(
            matches!(result, Ok(Some(_))),
            "{params}: {:?}",
            result.err()
        );
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
            values.insert(PLAN_KEY, value.to_owned());
        }
        let settings = provider(values).preview_sign_in(true).unwrap().unwrap();
        assert_eq!(settings.plan, expected);
    }
}

#[test]
fn unknown_preview_initial_plan_names_only_the_key() {
    for value in ["enterprise", "", "Team", " team "] {
        let mut values = configured();
        values.insert(PLAN_KEY, value.to_owned());
        let error = provider(values).preview_sign_in(true).err().unwrap();
        assert!(matches!(
            error,
            Error::PreviewSignInMalformed {
                key: "MKC_PREVIEW_SIGN_IN_PLAN"
            }
        ));
        assert!(!error.to_string().contains("Preview@Example.com"));
    }
}

#[test]
fn preview_initial_plan_requires_the_email() {
    let values = BTreeMap::from([(PLAN_KEY, "team".to_owned())]);
    assert!(matches!(
        provider(values).preview_sign_in(true),
        Err(Error::PreviewSignInPartial { missing: EMAIL_KEY })
    ));
}

#[test]
fn preview_initial_plan_requires_the_capability_even_without_identity_settings() {
    for mut values in [configured(), BTreeMap::new()] {
        values.insert(PLAN_KEY, "team".to_owned());
        let error = provider(values).preview_sign_in(false).err().unwrap();
        assert!(matches!(
            error,
            Error::PreviewSignInDisallowed {
                key: "MKC_PREVIEW_SIGN_IN_PLAN"
            }
        ));
        assert!(error.to_string().contains("MKC_PREVIEW_SIGN_IN_PLAN"));
    }
}
