//! Both server entrypoints use the same strict desktop flag.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::catalogue::CatalogueConfig;
use crate::settings::{ConfigProvider, EnvironmentConfig, EnvironmentMock, Error};

fn config(value: Option<&'static str>) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_DESKTOP_CLIENT" => value.map(str::to_owned),
                    "MKC_ENV" => Some("production".into()),
                    "MKC_DATABASE_URL" => Some("postgres://localhost/test".into()),
                    "MKC_APP_ORIGIN" => Some("https://app.example.com".into()),
                    "MKC_API_ORIGIN" => Some("https://api.example.com".into()),
                    "MKC_CATALOGUE_ORIGIN" => Some("https://catalogues.example.net".into()),
                    "MKC_CATALOGUE_SIGNING_KEY" => Some("a".repeat(64)),
                    "MKC_FILE_STORE" => Some("gcs".into()),
                    "MKC_GCS_BUCKET" => Some("test-bucket".into()),
                    "MKC_MAILER" => Some("postmark".into()),
                    "MKC_SITE_ORIGIN" => Some("https://site.example.com".into()),
                    "POSTMARK_FROM" | "POSTMARK_SERVER_TOKEN" => Some("test-mail".into()),
                    _ => None,
                })),
        )),
    }
}

#[test]
fn api_and_catalogue_default_to_disabled_and_accept_exact_booleans() {
    for (value, expected) in [(None, false), (Some("false"), false), (Some("true"), true)] {
        assert_eq!(config(value).load().unwrap().desktop_client, expected);
        assert_eq!(config(value).catalogue().unwrap().desktop_client, expected);
    }
}

#[test]
fn api_and_catalogue_refuse_every_other_flag_value() {
    for value in [
        "", "1", "0", "yes", "TRUE", "False", " true", "false ", "true\n",
    ] {
        assert!(matches!(
            config(Some(value)).load(),
            Err(Error::Invalid("MKC_DESKTOP_CLIENT"))
        ));
        assert!(matches!(
            config(Some(value)).catalogue(),
            Err(Error::Invalid("MKC_DESKTOP_CLIENT"))
        ));
    }
}
