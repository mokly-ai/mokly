//! Retention defaults, bounds and database-only environment access.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::maintenance::{
    GitHubRetentionConfig, MaintenanceConfig, PublicationMaintenanceConfig,
    PublicationMaintenanceSettings,
};
use crate::publications::FileStorage;
use crate::settings::{EnvironmentConfig, EnvironmentMock, Error};

fn config(value: Option<&'static str>) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".into()),
                    "MKC_AUTH_LINK_RETENTION_SECONDS"
                    | "MKC_AUTH_SESSION_RETENTION_SECONDS"
                    | "MKC_AUTH_RATE_RETENTION_SECONDS"
                    | "MKC_BUILD_RETENTION_SECONDS" => value.map(str::to_owned),
                    _ => panic!("maintenance must not load serving credentials"),
                })),
        )),
    }
}

#[test]
fn defaults_retain_replay_diagnostics_without_serving_credentials() {
    let settings = config(None).maintenance().unwrap();
    assert_eq!(settings.link_seconds, 604_800);
    assert_eq!(settings.session_seconds, 86_400);
    assert_eq!(settings.rate_seconds, 86_400);
    assert_eq!(settings.build_seconds, 2_592_000);
    assert_eq!(config(Some("0")).maintenance().unwrap().link_seconds, 0);
    assert_eq!(
        config(Some("31536000")).maintenance().unwrap().link_seconds,
        31_536_000
    );
}

#[test]
fn invalid_retention_is_typed_and_never_includes_the_value() {
    for value in ["", "-1", "1.5", "31536001", "secret"] {
        assert!(matches!(
            config(Some(value)).maintenance(),
            Err(Error::Invalid("MKC_AUTH_LINK_RETENTION_SECONDS"))
        ));
    }
}

fn github_config(value: Option<&'static str>) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".into()),
                    "MKC_GITHUB_OAUTH_RETENTION_SECONDS"
                    | "MKC_GITHUB_DELIVERY_RETENTION_SECONDS" => value.map(str::to_owned),
                    _ => panic!("GitHub retention must not load serving credentials"),
                })),
        )),
    }
}

#[test]
fn github_retention_defaults_and_bounds_are_explicit() {
    let settings = github_config(None).github_retention().unwrap();
    assert_eq!(settings.oauth_seconds, 86_400);
    assert_eq!(settings.delivery_seconds, 2_592_000);
    assert_eq!(
        github_config(Some("0"))
            .github_retention()
            .unwrap()
            .oauth_seconds,
        0
    );
    assert_eq!(
        github_config(Some("31536000"))
            .github_retention()
            .unwrap()
            .delivery_seconds,
        31_536_000
    );
}

#[test]
fn invalid_github_retention_names_the_setting_only() {
    for value in ["", "-1", "1.5", "31536001", "secret"] {
        assert!(matches!(
            github_config(Some(value)).github_retention(),
            Err(Error::Invalid("MKC_GITHUB_OAUTH_RETENTION_SECONDS"))
        ));
    }
    let config = EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers(&|_, key| match key {
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".into()),
                    "MKC_GITHUB_DELIVERY_RETENTION_SECONDS" => Some("invalid".into()),
                    _ => None,
                }),
        )),
    };
    assert!(matches!(
        config.github_retention(),
        Err(Error::Invalid("MKC_GITHUB_DELIVERY_RETENTION_SECONDS"))
    ));
}

fn publication_config(
    environment: &'static str,
    storage: &'static str,
    override_setting: Option<(&'static str, Option<&'static str>)>,
) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    if let Some((setting, value)) = override_setting
                        && key == setting
                    {
                        return value.map(str::to_owned);
                    }
                    match key {
                        "MKC_ENV" => Some(environment.into()),
                        "MKC_DATABASE_URL" => Some("postgres://localhost/test".into()),
                        "MKC_FILE_STORE" => Some(storage.into()),
                        "MKC_GCS_BUCKET" => Some("private-bucket".into()),
                        "MKC_GCS_PREFIX" => None,
                        "MKC_FILE_STORE_ROOT" => Some("/private/blobs".into()),
                        _ => panic!("publication maintenance loaded an unrelated credential"),
                    }
                })),
        )),
    }
}

#[test]
fn publication_maintenance_loads_only_database_and_storage() {
    let settings = publication_config("production", "gcs", None).publication_maintenance();
    assert!(matches!(
        settings,
        Ok(PublicationMaintenanceSettings {
            storage: FileStorage::Gcs { bucket, prefix: None },
            ..
        }) if bucket == "private-bucket"
    ));
    assert!(matches!(
        publication_config("development", "local", None).publication_maintenance(),
        Ok(PublicationMaintenanceSettings {
            storage: FileStorage::Local(_),
            ..
        })
    ));
    assert!(matches!(
        publication_config("production", "local", None).publication_maintenance(),
        Err(Error::Invalid("MKC_FILE_STORE"))
    ));
    assert!(matches!(
        publication_config("production", "gcs", Some(("MKC_GCS_PREFIX", Some("pr-42"))))
            .publication_maintenance(),
        Ok(PublicationMaintenanceSettings {
            storage: FileStorage::Gcs { prefix: Some(prefix), .. },
            ..
        }) if prefix.as_str() == "pr-42"
    ));
}

#[test]
fn publication_maintenance_rejects_missing_or_invalid_database_and_storage() {
    for (key, value) in [
        ("MKC_DATABASE_URL", None),
        ("MKC_DATABASE_URL", Some("")),
        ("MKC_DATABASE_URL", Some("https://secret.invalid")),
        ("MKC_FILE_STORE", None),
        ("MKC_FILE_STORE", Some("")),
        ("MKC_FILE_STORE", Some("automatic")),
        ("MKC_GCS_BUCKET", None),
        ("MKC_GCS_BUCKET", Some("")),
        ("MKC_GCS_PREFIX", Some("../other")),
    ] {
        assert!(
            matches!(
                publication_config("production", "gcs", Some((key, value)))
                    .publication_maintenance(),
                Err(Error::Invalid(invalid)) if invalid == key
            ),
            "invalid configuration was not rejected: {key}"
        );
    }
    for value in [None, Some("")] {
        assert!(matches!(
            publication_config("development", "local", Some(("MKC_FILE_STORE_ROOT", value)))
                .publication_maintenance(),
            Err(Error::Invalid("MKC_FILE_STORE_ROOT"))
        ));
    }
}
