//! Environment fixture shared by publication settings tests.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::settings::{EnvironmentConfig, EnvironmentMock};

pub(super) fn config(overrides: &[(&str, &str)]) -> EnvironmentConfig {
    let mut values: BTreeMap<String, String> = [
        ("MKC_CATALOGUE_ORIGIN", "https://catalogues.example.net"),
        ("MKC_FILE_STORE", "gcs"),
        ("MKC_GCS_BUCKET", "private-bucket"),
        ("MKC_APP_ORIGIN", "https://app.example.com"),
        ("MKC_API_ORIGIN", "https://api.example.com"),
        ("MKC_DATABASE_URL", "postgres://localhost/test"),
    ]
    .into_iter()
    .map(|(key, value)| (key.into(), value.into()))
    .collect();
    values.insert("MKC_CATALOGUE_SIGNING_KEY".into(), "a".repeat(64));
    values.extend(
        overrides
            .iter()
            .map(|(key, value)| ((*key).into(), (*value).into())),
    );
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
        )),
    }
}
