//! Optional build group presence, bounds and safe error keys.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::HashMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::builds::{BuildConfigProvider, BuildEnvironmentConfig};
use crate::settings::{EnvironmentMock, Error};

fn config(values: Vec<(&'static str, String)>) -> BuildEnvironmentConfig {
    let values: HashMap<_, _> = values.into_iter().collect();
    BuildEnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
        )),
    }
}

fn complete() -> Vec<(&'static str, String)> {
    vec![
        ("MKC_E2B_API_KEY", "secret-api-key".into()),
        ("MKC_E2B_BUILD_TEMPLATE", "template-v1".into()),
        ("MKC_E2B_DEPLOYMENT_ID", "main-preview".into()),
    ]
}

#[test]
fn missing_group_disables_builds_and_every_partial_group_fails() {
    assert!(config(vec![]).load(false).unwrap().is_none());
    for bits in 1..7 {
        let values = complete()
            .into_iter()
            .enumerate()
            .filter(|(index, _)| bits & (1 << index) != 0)
            .map(|(_, item)| item)
            .collect();
        assert!(matches!(config(values).load(true), Err(Error::Invalid(_))));
    }
    assert!(matches!(
        config(complete()).load(false),
        Err(Error::Invalid("MKC_GITHUB_APP_ID"))
    ));
}

#[test]
fn complete_group_uses_documented_defaults_and_validates_each_required_key() {
    let settings = config(complete()).load(true).unwrap().unwrap();
    assert_eq!(settings.per_process, 4);
    assert_eq!(settings.deployment_id, "main-preview");
    assert!(settings.denied_destinations.is_empty());
    for index in 0..3 {
        let mut values = complete();
        values[index].1 = "".into();
        assert!(matches!(config(values).load(true), Err(Error::Invalid(_))));
    }
    for value in [
        "UPPERCASE",
        "with space",
        "with_underscore",
        "a/b",
        &"a".repeat(64),
    ] {
        let mut values = complete();
        values[2].1 = value.to_owned();
        assert!(matches!(
            config(values).load(true),
            Err(Error::Invalid("MKC_E2B_DEPLOYMENT_ID"))
        ));
    }
}

#[test]
fn process_limits_are_bounded_integers_and_errors_hide_values() {
    for value in ["1", "4", "16"] {
        let mut values = complete();
        values.push(("MKC_BUILDS_PER_PROCESS", value.into()));
        assert_eq!(
            config(values).load(true).unwrap().unwrap().per_process,
            value.parse::<usize>().unwrap()
        );
    }
    for value in ["0", "17", "-1", "1.5", "", "secret-value"] {
        let mut values = complete();
        values.push(("MKC_BUILDS_PER_PROCESS", value.into()));
        let Err(error) = config(values).load(true) else {
            panic!("must reject ceiling");
        };
        assert!(matches!(error, Error::Invalid("MKC_BUILDS_PER_PROCESS")));
        assert!(!format!("{error:?}").contains("secret-value"));
    }
}

#[test]
fn deny_entries_are_ips_or_cidrs_and_at_most_thirty_two() {
    let mut values = complete();
    values.push((
        "MKC_E2B_DENIED_DESTINATIONS",
        "203.0.113.19/24, 2001:db8::1,203.0.113.0/24".into(),
    ));
    assert_eq!(
        config(values)
            .load(true)
            .unwrap()
            .unwrap()
            .denied_destinations,
        ["2001:db8::1", "203.0.113.0/24"]
    );
    for value in [
        "",
        "example.com",
        "https://example.com",
        "10.0.0.1/33",
        "10.0.0.1,,10.0.0.2",
        &vec!["10.0.0.1"; 33].join(","),
    ] {
        let mut values = complete();
        values.push(("MKC_E2B_DENIED_DESTINATIONS", value.into()));
        assert!(matches!(
            config(values).load(true),
            Err(Error::Invalid("MKC_E2B_DENIED_DESTINATIONS"))
        ));
    }
    assert!(
        config(vec![("MKC_BUILDS_PER_PROCESS", "4".into())])
            .load(true)
            .is_err()
    );
}
