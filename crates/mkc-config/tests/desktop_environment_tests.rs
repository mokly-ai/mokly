//! Strict desktop configuration through the real process environment.

#![cfg(unix)]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;
use std::ffi::OsString;
use std::os::unix::ffi::OsStringExt;
use std::process::Command;
use std::sync::Arc;

use mkc_config::catalogue::CatalogueConfig;
use mkc_config::settings::{ConfigProvider, EnvironmentConfig, Error, ProcessEnvironment};

#[test]
fn non_unicode_desktop_flags_fail_both_server_configurations() {
    let output = Command::new(env::current_exe().unwrap())
        .args(["--exact", "raw_flag_child", "--nocapture"])
        .env_clear()
        .envs([
            ("MKC_DESKTOP_ENV_TEST", "1"),
            ("MKC_ENV", "development"),
            ("MKC_DATABASE_URL", "postgres://localhost/test"),
            ("MKC_APP_ORIGIN", "http://localhost:8081"),
            ("MKC_API_ORIGIN", "http://localhost:8080"),
            ("MKC_CATALOGUE_ORIGIN", "http://localhost:8082"),
            (
                "MKC_CATALOGUE_SIGNING_KEY",
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ),
            ("MKC_FILE_STORE", "local"),
            ("MKC_MAILER", "log"),
        ])
        .env("MKC_FILE_STORE_ROOT", env::temp_dir())
        .env("MKC_DESKTOP_CLIENT", OsString::from_vec(vec![0xff]))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn raw_flag_child() {
    if env::var("MKC_DESKTOP_ENV_TEST").as_deref() != Ok("1") {
        return;
    }
    let config = EnvironmentConfig {
        environment: Arc::new(ProcessEnvironment),
    };
    assert!(matches!(
        config.load(),
        Err(Error::Invalid("MKC_DESKTOP_CLIENT"))
    ));
    assert!(matches!(
        config.catalogue(),
        Err(Error::Invalid("MKC_DESKTOP_CLIENT"))
    ));
}
