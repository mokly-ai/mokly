//! Shared real API settings for independent replicas of one scratch database.

use std::env;
use std::net::SocketAddr;

use mkc_config::builds::BuildSettings;
use mkc_config::github::GitHubSettings;
use mkc_config::publications::{FileStorage, PublicationSettings};
use mkc_config::settings::{Mail, Settings};
use mkc_test_pg::scratch_schema::ScratchSchema;

use super::harness::{APP, SECRET};

/// Settings for one scratch schema, with GitHub served by the recorded double.
pub(super) fn settings(
    schema: &ScratchSchema,
    bind: SocketAddr,
    configured: bool,
    github: &str,
) -> Settings {
    settings_url(schema.scoped_url(), schema.name(), bind, configured, github)
}

/// Settings for one database URL, with GitHub served at the `github` origin.
pub(super) fn settings_url(
    database: &str,
    namespace: &str,
    bind: SocketAddr,
    configured: bool,
    github: &str,
) -> Settings {
    Settings {
        trusted_proxies: Default::default(),
        database_url: database.to_owned(),
        bind,
        app_origin: APP.into(),
        desktop_client: false,
        api_origin: format!("http://{bind}"),
        mail: Mail::Log,
        preview_sign_in: None,
        builds: configured.then(|| BuildSettings {
            api_key: "fixture-e2b-secret".into(),
            template: "fixture-template".into(),
            deployment_id: "fixture-builds".into(),
            denied_destinations: Vec::new(),
            per_process: 4,
        }),
        github: Some(GitHubSettings {
            app_id: 123,
            client_id: "Iv1.fixture".into(),
            client_secret: "fixture-client-secret".into(),
            app_slug: "mokly-test".into(),
            private_key: include_str!("../../../mkc-github/fixtures/test-key.pem").into(),
            webhook_secret: SECRET.into(),
            api_origin: github.into(),
            web_origin: github.into(),
        }),
        billing: None,
        publications: PublicationSettings {
            upload_memory_bytes: 536_870_912,
            upload_blob_gzip: false,
            ingest_workers: 8,
            domain: "catalogues.example.net".into(),
            scheme: "https".into(),
            port: None,
            bind: "127.0.0.1:0".parse().unwrap(),
            signing_key: "a".repeat(64),
            storage: FileStorage::Local(env::temp_dir().join(format!("mkc-github-{namespace}"))),
            hot_cache_bytes: 0,
        },
    }
}
