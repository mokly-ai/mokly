//! Ingest worker, upload-memory and hot-cache publication settings.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use crate::catalogue::CatalogueConfig;
use crate::publications::PublicationConfig;
use crate::settings::{ConfigProvider, Error};

use super::support::config;

#[test]
fn ingest_workers_default_and_clamp_to_the_supported_range() {
    for (value, expected) in [
        ("-9", 1),
        ("0", 1),
        ("1", 1),
        ("8", 8),
        ("32", 32),
        ("99", 32),
    ] {
        let settings = config(&[("MKC_INGEST_WORKERS", value)])
            .publications(false, "https://app.example.com")
            .unwrap();
        assert_eq!(settings.ingest_workers, expected, "{value}");
    }
}

#[test]
fn upload_memory_has_a_512_mib_default_and_accepts_positive_bytes() {
    let settings = config(&[])
        .publications(false, "https://app.example.com")
        .unwrap();
    assert_eq!(settings.upload_memory_bytes, 536_870_912);
    for (value, expected) in [
        ("1", 1),
        ("67108864", 67_108_864),
        ("18446744073709551615", u64::MAX),
    ] {
        let settings = config(&[("MKC_UPLOAD_MEMORY_BYTES", value)])
            .publications(false, "https://app.example.com")
            .unwrap();
        assert_eq!(settings.upload_memory_bytes, expected);
    }
}

#[test]
fn upload_memory_rejects_zero_and_non_integer_values() {
    for value in ["", "0", "-1", "1.5", " 1", "1 ", "18446744073709551616"] {
        assert!(matches!(
            config(&[("MKC_UPLOAD_MEMORY_BYTES", value)])
                .publications(false, "https://app.example.com"),
            Err(Error::Invalid("MKC_UPLOAD_MEMORY_BYTES"))
        ));
    }
}

#[test]
fn blob_gzip_advertisement_defaults_off_and_accepts_strict_flags() {
    assert!(
        !config(&[])
            .publications(false, "https://app.example.com")
            .unwrap()
            .upload_blob_gzip
    );
    assert!(
        config(&[("MKC_UPLOAD_BLOB_GZIP", "true")])
            .publications(false, "https://app.example.com")
            .unwrap()
            .upload_blob_gzip
    );
    assert!(
        !config(&[("MKC_UPLOAD_BLOB_GZIP", "false")])
            .publications(false, "https://app.example.com")
            .unwrap()
            .upload_blob_gzip
    );
}

#[test]
fn blob_gzip_advertisement_rejects_non_boolean_values() {
    for value in ["", "TRUE", "1", " false", "false "] {
        assert!(matches!(
            config(&[("MKC_UPLOAD_BLOB_GZIP", value)])
                .publications(false, "https://app.example.com"),
            Err(Error::Invalid("MKC_UPLOAD_BLOB_GZIP"))
        ));
    }
}

#[test]
fn hot_cache_capacity_accepts_zero_and_nonnegative_integers() {
    for (value, expected) in [
        ("0", 0),
        ("8388608", 8_388_608),
        ("18446744073709551615", u64::MAX),
    ] {
        let source = config(&[
            ("MKC_ENV", "preview"),
            ("MKC_MAILER", "log"),
            ("MKC_CATALOGUE_HOT_CACHE_BYTES", value),
        ]);
        assert_eq!(
            source.catalogue().unwrap().publications.hot_cache_bytes,
            expected
        );
        assert_eq!(
            source.load().unwrap().publications.hot_cache_bytes,
            expected
        );
    }
}

#[test]
fn non_integer_ingest_workers_are_rejected() {
    for value in ["", "eight", "1.5"] {
        assert!(matches!(
            config(&[("MKC_INGEST_WORKERS", value)]).publications(false, "https://app.example.com"),
            Err(Error::Invalid("MKC_INGEST_WORKERS"))
        ));
    }
}

#[test]
fn hot_cache_capacity_rejects_non_integer_values() {
    for value in ["", "-1", "1.5", " 1", "1 ", "18446744073709551616"] {
        let source = config(&[
            ("MKC_ENV", "preview"),
            ("MKC_MAILER", "log"),
            ("MKC_CATALOGUE_HOT_CACHE_BYTES", value),
        ]);
        assert!(matches!(
            source.catalogue(),
            Err(Error::Invalid("MKC_CATALOGUE_HOT_CACHE_BYTES"))
        ));
        assert!(matches!(
            source.load(),
            Err(Error::Invalid("MKC_CATALOGUE_HOT_CACHE_BYTES"))
        ));
    }
}
