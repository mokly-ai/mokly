//! Production catalogue origin separation and explicit secret/storage configuration.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_file_store_interface::prefix::ObjectPrefix;

use crate::catalogue::CatalogueConfig;
use crate::publications::{FileStorage, PublicationConfig};
use crate::settings::{ConfigProvider, Error};

use super::support::config;

#[test]
fn catalogue_can_start_without_mail_credentials() {
    let settings = config(&[]).catalogue().unwrap();
    assert_eq!(settings.publications.ingest_workers, 8);
    assert_eq!(settings.publications.domain, "catalogues.example.net");
    assert_eq!(settings.publications.hot_cache_bytes, 134_217_728);
    assert!(matches!(
        settings.publications.storage,
        FileStorage::Gcs { .. }
    ));
}

#[test]
fn malformed_or_shared_production_origins_are_rejected() {
    for origin in [
        "http://catalogues.example.net",
        "https://example.com",
        "https://app.example.com",
        "https://catalogues.app.example.com",
        "https://catalogues.example.com",
        "https://catalogues.example.net/path",
        "https://u:p@catalogues.example.net",
        "https://catalogues.example.net?q=x",
        "https://catalogues.example.net#x",
    ] {
        assert!(
            matches!(
                config(&[("MKC_CATALOGUE_ORIGIN", origin)])
                    .publications(false, "https://app.example.com"),
                Err(Error::Invalid("MKC_CATALOGUE_ORIGIN"))
            ),
            "{origin}"
        );
    }
}

#[test]
fn public_suffix_rules_cover_multi_label_and_private_domains() {
    for (app, catalogue, accepted) in [
        (
            "https://app.example.co.uk",
            "https://catalogues.example.co.uk",
            false,
        ),
        (
            "https://app.example.co.uk",
            "https://catalogues.other.co.uk",
            true,
        ),
        (
            "https://app.github.io",
            "https://catalogues.github.io",
            true,
        ),
        ("https://app.example.com", "https://com", false),
        ("https://app.example.com", "https://127.0.0.1", false),
    ] {
        assert_eq!(
            config(&[("MKC_CATALOGUE_ORIGIN", catalogue)])
                .publications(false, app)
                .is_ok(),
            accepted,
            "{app}, {catalogue}"
        );
    }
}

#[test]
fn local_storage_and_loopback_http_require_explicit_development() {
    let values = [
        ("MKC_CATALOGUE_ORIGIN", "http://localhost:8082"),
        ("MKC_FILE_STORE", "local"),
        ("MKC_FILE_STORE_ROOT", "/private/blobs"),
    ];
    assert!(
        config(&values)
            .publications(false, "https://app.example.com")
            .is_err()
    );
    let settings = config(&values)
        .publications(true, "http://localhost:8081")
        .unwrap();
    assert_eq!(settings.port, Some(8082));
    assert!(matches!(settings.storage, FileStorage::Local(_)));
    assert!(matches!(
        config(&[("MKC_FILE_STORE", "local")]).publications(false, "https://app.example.com"),
        Err(Error::Invalid("MKC_FILE_STORE"))
    ));
}

#[test]
fn secret_and_listener_errors_identify_the_key_without_disclosing_values() {
    for (key, value) in [
        ("MKC_CATALOGUE_SIGNING_KEY", "bad-secret"),
        ("MKC_CATALOGUE_BIND", "not-an-address"),
        ("MKC_GCS_BUCKET", ""),
    ] {
        let error = config(&[(key, value)])
            .publications(false, "https://app.example.com")
            .err()
            .unwrap();
        assert!(matches!(error, Error::Invalid(name) if name == key));
        assert!(!error.to_string().contains(value) || value.is_empty());
    }
}

#[test]
fn invalid_gcs_prefixes_fail_both_startup_configurations() {
    for value in [
        "a".repeat(64),
        "PR-1".to_owned(),
        "pr_1".to_owned(),
        "pr.1".to_owned(),
        "pr/1".to_owned(),
        "pr-1/".to_owned(),
        "../pr-1".to_owned(),
        "pr%2f1".to_owned(),
        " ".to_owned(),
        " pr-1".to_owned(),
        "pr-1 ".to_owned(),
        "pr\n1".to_owned(),
        "pr\t1".to_owned(),
        "pré-1".to_owned(),
        "pr-１".to_owned(),
    ] {
        let source = config(&[
            ("MKC_ENV", "preview"),
            ("MKC_MAILER", "log"),
            ("MKC_GCS_PREFIX", &value),
        ]);
        assert!(
            matches!(source.load(), Err(Error::Invalid("MKC_GCS_PREFIX"))),
            "API accepted {value:?}"
        );
        assert!(
            matches!(source.catalogue(), Err(Error::Invalid("MKC_GCS_PREFIX"))),
            "catalogue accepted {value:?}"
        );
    }
}

#[test]
fn valid_gcs_prefixes_reach_both_startup_configurations_unchanged() {
    for value in [
        "a".to_owned(),
        "0".to_owned(),
        "-".to_owned(),
        "pr-123".to_owned(),
        "-abcdefghijklmnopqrstuvwxyz0123456789-".to_owned(),
        "a".repeat(63),
        "-".repeat(63),
    ] {
        let source = config(&[
            ("MKC_ENV", "preview"),
            ("MKC_MAILER", "log"),
            ("MKC_GCS_PREFIX", &value),
        ]);
        for settings in [
            source.load().unwrap().publications,
            source.catalogue().unwrap().publications,
        ] {
            let FileStorage::Gcs { bucket, prefix } = settings.storage else {
                panic!("expected GCS storage");
            };
            assert_eq!(bucket, "private-bucket");
            assert_eq!(
                prefix.as_ref().map(ObjectPrefix::as_str),
                Some(value.as_str())
            );
        }
    }
}

#[test]
fn unset_and_empty_gcs_prefixes_preserve_unprefixed_storage() {
    for overrides in [vec![], vec![("MKC_GCS_PREFIX", "")]] {
        let mut values = vec![("MKC_ENV", "preview"), ("MKC_MAILER", "log")];
        values.extend(overrides);
        let source = config(&values);
        for settings in [
            source.load().unwrap().publications,
            source.catalogue().unwrap().publications,
        ] {
            let FileStorage::Gcs { bucket, prefix } = settings.storage else {
                panic!("expected GCS storage");
            };
            assert_eq!(bucket, "private-bucket");
            assert_eq!(prefix, None);
        }
    }
}
