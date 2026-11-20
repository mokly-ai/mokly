//! Configuration validation at the environment trait boundary.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::settings::{ConfigProvider, EnvironmentConfig, EnvironmentMock, Error, Mail};

fn provider(
    mode: Option<&'static str>,
    app_origin: &'static str,
    mail: &'static str,
) -> EnvironmentConfig {
    provider_with_options(
        mode,
        app_origin,
        mail,
        Some("https://site.example.com"),
        None,
    )
}

fn provider_with_preview(
    mode: Option<&'static str>,
    app_origin: &'static str,
    mail: &'static str,
    preview: Option<(&'static str, &'static str)>,
) -> EnvironmentConfig {
    provider_with_options(
        mode,
        app_origin,
        mail,
        Some("https://site.example.com"),
        preview,
    )
}

fn provider_with_site(
    mode: Option<&'static str>,
    app_origin: &'static str,
    mail: &'static str,
    site_origin: Option<&'static str>,
) -> EnvironmentConfig {
    provider_with_options(mode, app_origin, mail, site_origin, None)
}

fn provider_with_options(
    mode: Option<&'static str>,
    app_origin: &'static str,
    mail: &'static str,
    site_origin: Option<&'static str>,
    preview: Option<(&'static str, &'static str)>,
) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_ENV" => mode.map(str::to_owned),
                    "MKC_APP_ORIGIN" => Some(app_origin.to_owned()),
                    "MKC_SITE_ORIGIN" => {
                        assert_eq!(mail, "postmark", "log delivery needs no site origin");
                        site_origin.map(str::to_owned)
                    }
                    "MKC_API_ORIGIN" => Some(if mode == Some("development") {
                        "http://localhost:8080".to_owned()
                    } else {
                        "https://api.example.com".to_owned()
                    }),
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".to_owned()),
                    "MKC_MAILER" => Some(mail.to_owned()),
                    "POSTMARK_FROM" | "POSTMARK_SERVER_TOKEN" => {
                        assert_eq!(mail, "postmark", "log delivery must not read credentials");
                        Some("test-mail-setting".to_owned())
                    }
                    "MKC_PREVIEW_SIGN_IN_SECRET" => preview.map(|(secret, _)| secret.to_owned()),
                    "MKC_PREVIEW_SIGN_IN_EMAIL" => preview.map(|(_, email)| email.to_owned()),
                    "MKC_CATALOGUE_ORIGIN" => Some(if mode == Some("development") {
                        "http://localhost:8082".to_owned()
                    } else {
                        "https://catalogues.example.net".to_owned()
                    }),
                    "MKC_CATALOGUE_SIGNING_KEY" => Some("a".repeat(64)),
                    "MKC_FILE_STORE" => Some("gcs".to_owned()),
                    "MKC_GCS_BUCKET" => Some("test-bucket".to_owned()),
                    _ => None,
                })),
        )),
    }
}

#[test]
fn preview_sign_in_is_loaded_only_in_its_named_environments() {
    for mode in [
        None,
        Some("production"),
        Some("preview"),
        Some("development"),
    ] {
        let result = provider_with_preview(
            mode,
            HTTPS,
            "postmark",
            Some((
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                " Preview@Example.com ",
            )),
        )
        .load();
        if matches!(mode, Some("preview" | "development")) {
            let preview = result.unwrap().preview_sign_in.unwrap();
            assert_eq!(preview.email, "preview@example.com");
        } else {
            assert!(matches!(result, Err(Error::PreviewSignInDisallowed { .. })));
        }
    }
}

const HTTPS: &str = "https://app.example.com";

#[test]
fn each_environment_has_explicit_mail_capabilities() {
    for (mode, permits_log) in [
        (Some("production"), false),
        (None, false),
        (Some("preview"), true),
        (Some("development"), true),
    ] {
        let settings = provider(mode, HTTPS, "postmark").load().unwrap();
        assert!(matches!(settings.mail, Mail::Postmark { .. }));
        let logging = provider(mode, HTTPS, "log").load();
        if permits_log {
            assert!(matches!(logging.unwrap().mail, Mail::Log));
        } else {
            assert!(matches!(logging, Err(Error::Invalid("MKC_MAILER"))));
        }
    }
}

#[test]
fn postmark_uses_a_separate_validated_public_site_origin() {
    let settings = provider(Some("production"), HTTPS, "postmark")
        .load()
        .unwrap();
    assert!(matches!(
        settings.mail,
        Mail::Postmark { site_origin, .. } if site_origin == "https://site.example.com"
    ));
    for invalid in [
        None,
        Some("http://site.example.com"),
        Some("https://site.example.com/path"),
    ] {
        assert!(matches!(
            provider_with_site(Some("production"), HTTPS, "postmark", invalid).load(),
            Err(Error::Invalid("MKC_SITE_ORIGIN"))
        ));
    }
}

#[test]
fn only_development_allows_http_loopback_for_the_app_origin() {
    for mode in [
        Some("production"),
        None,
        Some("preview"),
        Some("development"),
    ] {
        for loopback in [
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            "http://[::1]:8081",
        ] {
            let result = provider(mode, loopback, "postmark").load();
            if mode == Some("development") {
                assert_eq!(result.unwrap().app_origin, loopback);
            } else {
                assert!(matches!(result, Err(Error::Invalid("MKC_APP_ORIGIN"))));
            }
        }
    }
}

#[test]
fn no_environment_permits_remote_http_or_credential_bearing_origins() {
    for mode in ["production", "preview", "development"] {
        for origin in [
            "http://app.example.com",
            "https://app.example.com/path",
            "https://user:password@app.example.com",
            "https://app.example.com?x=y",
            "https://app.example.com#fragment",
        ] {
            assert!(matches!(
                provider(Some(mode), origin, "postmark").load(),
                Err(Error::Invalid("MKC_APP_ORIGIN"))
            ));
        }
    }
}

#[test]
fn unknown_environment_fails_closed() {
    assert!(matches!(
        provider(Some("preveiw"), HTTPS, "log").load(),
        Err(Error::Invalid("MKC_ENV"))
    ));
}

#[test]
fn the_api_origin_is_required_and_exact() {
    let base = |origin: Option<&'static str>, mode: &'static str| EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_ENV" => Some(mode.to_owned()),
                    "MKC_API_ORIGIN" => origin.map(str::to_owned),
                    "MKC_APP_ORIGIN" => Some(HTTPS.to_owned()),
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".to_owned()),
                    "MKC_MAILER" => Some("log".to_owned()),
                    "MKC_CATALOGUE_ORIGIN" => Some("https://catalogues.example.net".to_owned()),
                    "MKC_CATALOGUE_SIGNING_KEY" => Some("a".repeat(64)),
                    "MKC_FILE_STORE" => Some("gcs".to_owned()),
                    "MKC_GCS_BUCKET" => Some("test-bucket".to_owned()),
                    _ => None,
                })),
        )),
    };
    assert_eq!(
        base(Some("https://api.example.com/"), "preview")
            .load()
            .unwrap()
            .api_origin,
        "https://api.example.com"
    );
    assert_eq!(
        base(Some("http://localhost:8080"), "development")
            .load()
            .unwrap()
            .api_origin,
        "http://localhost:8080"
    );
    for (origin, mode) in [
        (None, "preview"),
        (Some(""), "preview"),
        (Some("http://localhost:8080"), "preview"),
        (Some("https://api.example.com/v1"), "preview"),
        (Some("https://user@api.example.com"), "development"),
    ] {
        assert!(
            matches!(
                base(origin, mode).load(),
                Err(Error::Invalid("MKC_API_ORIGIN"))
            ),
            "{origin:?} {mode}"
        );
    }
}
